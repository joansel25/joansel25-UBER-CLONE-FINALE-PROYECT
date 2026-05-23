const { Client, TravelMode, UnitSystem } = require('@googlemaps/google-maps-services-js');

const client = new Client({});

/**
 * Searches for places matching the user's text input using Places Autocomplete.
 * Called from the frontend search box as the user types.
 *
 * @param {string} input           - Text the user has typed
 * @param {string} [sessionToken]  - Groups autocomplete calls into a single billing session
 * @param {[number,number]} [location] - [lat, lng] to bias results toward user's area
 * @returns {Promise<Array>} List of place suggestions
 */
async function getPlacesAutocomplete(input, sessionToken, location) {
  if (!input || input.trim().length < 2) {
    return [];
  }

  const params = {
    input: input.trim(),
    key:   process.env.GOOGLE_MAPS_API_KEY,
  };

  if (sessionToken) params.sessiontoken = sessionToken;

  if (location) {
    params.location = { lat: location[0], lng: location[1] };
    params.radius   = 50000; // bias results within 50 km of user
  }

  const response = await client.placeAutocomplete({ params });

  if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
    const err = new Error(`Places API error: ${response.data.status}`);
    err.statusCode = 502;
    throw err;
  }

  return response.data.predictions.map(p => ({
    placeId:     p.place_id,
    description: p.description,
    mainText:    p.structured_formatting.main_text,
    secondaryText: p.structured_formatting.secondary_text,
  }));
}

/**
 * Calculates travel time and distance between multiple origins and destinations.
 * Useful for finding which nearby driver is fastest to reach the passenger.
 *
 * @param {Array<[number,number]>} origins      - Array of [lat, lng] points
 * @param {Array<[number,number]>} destinations - Array of [lat, lng] points
 * @returns {Promise<Array>} Matrix rows with distance and duration per pair
 */
async function getDistanceMatrix(origins, destinations) {
  const response = await client.distancematrix({
    params: {
      origins:      origins.map(([lat, lng]) => ({ lat, lng })),
      destinations: destinations.map(([lat, lng]) => ({ lat, lng })),
      mode:         TravelMode.driving,
      units:        UnitSystem.metric,
      key:          process.env.GOOGLE_MAPS_API_KEY,
    },
  });

  if (response.data.status !== 'OK') {
    const err = new Error(`Distance Matrix API error: ${response.data.status}`);
    err.statusCode = 502;
    throw err;
  }

  return response.data.rows.map((row, originIdx) => ({
    origin: response.data.origin_addresses[originIdx],
    destinations: row.elements.map((el, destIdx) => ({
      destination:     response.data.destination_addresses[destIdx],
      status:          el.status,
      distanceMeters:  el.status === 'OK' ? el.distance.value : null,
      distanceText:    el.status === 'OK' ? el.distance.text  : null,
      durationSeconds: el.status === 'OK' ? el.duration.value : null,
      durationText:    el.status === 'OK' ? el.duration.text  : null,
    })),
  }));
}

const FARES = {
  economy:  { base: 3500, perKm: 1200, perMin: 150 },
  xl:       { base: 5000, perKm: 1800, perMin: 200 },
  premium:  { base: 8000, perKm: 2500, perMin: 300 },
};

/**
 * Gets the optimal route between two points using Google Directions API.
 * Returns polyline, steps, distance, and duration.
 *
 * @param {[number, number]} origin      - [latitude, longitude]
 * @param {[number, number]} destination - [latitude, longitude]
 * @returns {Promise<object>}
 */
async function getDirections(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const response = await client.directions({
    params: {
      origin:      { lat: origin[0],      lng: origin[1] },
      destination: { lat: destination[0], lng: destination[1] },
      mode:        TravelMode.driving,
      units:       UnitSystem.metric,
      key:         apiKey,
    },
  });

  if (response.data.status !== 'OK') {
    const err = new Error(`Directions API error: ${response.data.status}`);
    err.statusCode = 502;
    throw err;
  }

  const route = response.data.routes[0];
  const leg   = route.legs[0];

  return {
    distanceMeters:  leg.distance.value,
    distanceText:    leg.distance.text,
    durationSeconds: leg.duration.value,
    durationText:    leg.duration.text,
    startAddress:    leg.start_address,
    endAddress:      leg.end_address,
    polyline:        route.overview_polyline.points,
    steps: leg.steps.map(s => ({
      instruction:    s.html_instructions,
      distanceMeters: s.distance.value,
      durationSeconds: s.duration.value,
    })),
  };
}

/**
 * Calculates fare estimate for a given distance and duration.
 * Uses fixed rates per vehicle category (COP).
 *
 * @param {number} distanceMeters
 * @param {number} durationSeconds
 * @param {'economy'|'xl'|'premium'} [category='economy']
 * @returns {{ category: string, fare: number, breakdown: object }}
 */
function calculateFare(distanceMeters, durationSeconds, category = 'economy') {
  const rates = FARES[category];
  if (!rates) {
    const err = new Error(`Invalid category: ${category}. Valid: economy, xl, premium`);
    err.statusCode = 400;
    throw err;
  }

  const km  = distanceMeters / 1000;
  const min = durationSeconds / 60;
  const fare = Math.ceil(rates.base + km * rates.perKm + min * rates.perMin);

  return {
    category,
    fare,
    currency: 'COP',
    breakdown: {
      base:          rates.base,
      distanceCost:  Math.ceil(km * rates.perKm),
      timeCost:      Math.ceil(min * rates.perMin),
    },
  };
}

/**
 * One-call helper: route + all three fare estimates.
 * Used by the trip creation endpoint.
 *
 * @param {[number,number]} origin      - [lat, lng]
 * @param {[number,number]} destination - [lat, lng]
 * @returns {Promise<object>}
 */
async function getTripEstimate(origin, destination) {
  const route = await getDirections(origin, destination);

  const fares = {
    economy: calculateFare(route.distanceMeters, route.durationSeconds, 'economy'),
    xl:      calculateFare(route.distanceMeters, route.durationSeconds, 'xl'),
    premium: calculateFare(route.distanceMeters, route.durationSeconds, 'premium'),
  };

  return { route, fares };
}

/**
 * Retrieves coordinates and formatted address for a given Place ID.
 * Called when the user selects an autocomplete suggestion so the frontend
 * can obtain the lat/lng needed for map markers and fare estimation.
 *
 * @param {string} placeId
 * @param {string} [sessionToken]
 * @returns {Promise<{ lat, lng, address, name }>}
 */
async function getPlaceDetails(placeId, sessionToken) {
  const params = {
    place_id: placeId,
    fields:   ['geometry', 'formatted_address', 'name'],
    key:      process.env.GOOGLE_MAPS_API_KEY,
  };
  if (sessionToken) params.sessiontoken = sessionToken;

  const response = await client.placeDetails({ params });

  if (response.data.status !== 'OK') {
    const err = new Error(`Place Details API error: ${response.data.status}`);
    err.statusCode = 502;
    throw err;
  }

  const result = response.data.result;
  return {
    lat:     result.geometry.location.lat,
    lng:     result.geometry.location.lng,
    address: result.formatted_address,
    name:    result.name,
  };
}

module.exports = { getPlacesAutocomplete, getPlaceDetails, getDistanceMatrix, getDirections, calculateFare, getTripEstimate };

import Config from 'react-native-config';

// Fallback hardcoded so the app works even if react-native-config build step is skipped
const MAPS_KEY = Config.GOOGLE_MAPS_API_KEY || 'AIzaSyCaFrQWis0JqXrStnI_34CaS64JL6lsj3E';
const BASE     = 'https://maps.googleapis.com/maps/api';

const FARES = {
  economy: { base: 3500, perKm: 1200, perMin: 150 },
  xl:      { base: 5000, perKm: 1800, perMin: 200 },
  premium: { base: 8000, perKm: 2500, perMin: 300 },
};

async function mapsGet(endpoint, params) {
  const allParams = { ...params, key: MAPS_KEY, language: params.language || 'es' };
  const query = Object.entries(allParams)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const res  = await fetch(`${BASE}/${endpoint}?${query}`);
  const data = await res.json();
  return data;
}

export async function getPlacesAutocomplete(input, sessionToken, location) {
  if (!input || input.trim().length < 2) return [];

  const params = { input: input.trim(), components: 'country:co' };
  if (sessionToken) params.sessiontoken = sessionToken;
  if (location) {
    params.location = `${location[0]},${location[1]}`;
    params.radius   = '50000';
  }

  const data = await mapsGet('place/autocomplete/json', params);

  if (data.status === 'ZERO_RESULTS') return [];
  if (data.status !== 'OK') {
    console.error('[Maps] autocomplete status:', data.status, data.error_message ?? '');
    const err = new Error(data.error_message || `Autocompletado no disponible (${data.status})`);
    err.statusCode  = 502;
    err.googleStatus = data.status;
    throw err;
  }

  return (data.predictions ?? []).map(p => ({
    placeId:       p.place_id,
    description:   p.description,
    mainText:      p.structured_formatting?.main_text      ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
  }));
}

export async function getPlaceDetails(placeId, sessionToken) {
  const params = { place_id: placeId, fields: 'geometry,formatted_address,name' };
  if (sessionToken) params.sessiontoken = sessionToken;

  const data = await mapsGet('place/details/json', params);

  if (data.status !== 'OK') {
    console.error('[Maps] place details status:', data.status, data.error_message ?? '');
    const err = new Error(data.error_message || `Detalles no disponibles (${data.status})`);
    err.statusCode   = 502;
    err.googleStatus = data.status;
    throw err;
  }

  const result = data.result;
  return {
    lat:     result.geometry.location.lat,
    lng:     result.geometry.location.lng,
    address: result.formatted_address,
    name:    result.name,
  };
}

export async function getDirections(originLat, originLng, destLat, destLng) {
  const params = {
    origin:      `${originLat},${originLng}`,
    destination: `${destLat},${destLng}`,
    mode:        'driving',
    units:       'metric',
  };

  const data = await mapsGet('directions/json', params);

  if (data.status === 'ZERO_RESULTS') {
    const err = new Error('No se encontró ruta entre los puntos seleccionados. Intenta con otras ubicaciones.');
    err.statusCode   = 404;
    err.googleStatus = 'ZERO_RESULTS';
    throw err;
  }

  if (data.status !== 'OK') {
    console.error('[Maps] directions status:', data.status, data.error_message ?? '');
    const err = new Error(data.error_message || `No se pudo calcular la ruta (${data.status}). Verifica que la API Directions esté habilitada en Google Cloud.`);
    err.statusCode   = 502;
    err.googleStatus = data.status;
    throw err;
  }

  const route = data.routes[0];
  const leg   = route.legs[0];

  return {
    distanceMeters:  leg.distance.value,
    distanceText:    leg.distance.text,
    durationSeconds: leg.duration.value,
    durationText:    leg.duration.text,
    polyline:        route.overview_polyline.points,
  };
}

export function calculateFare(distanceMeters, durationSeconds, category = 'economy') {
  const rates = FARES[category];
  if (!rates) {
    const err = new Error(`Categoría inválida: ${category}`);
    err.statusCode = 400;
    throw err;
  }

  const km   = distanceMeters / 1000;
  const min  = durationSeconds / 60;
  const fare = Math.ceil(rates.base + km * rates.perKm + min * rates.perMin);

  return {
    category,
    fare,
    currency: 'COP',
    breakdown: {
      base:         rates.base,
      distanceCost: Math.ceil(km  * rates.perKm),
      timeCost:     Math.ceil(min * rates.perMin),
    },
  };
}

export async function getTripEstimate(originLat, originLng, destLat, destLng) {
  const route = await getDirections(originLat, originLng, destLat, destLng);
  const fares = {
    economy: calculateFare(route.distanceMeters, route.durationSeconds, 'economy'),
    xl:      calculateFare(route.distanceMeters, route.durationSeconds, 'xl'),
    premium: calculateFare(route.distanceMeters, route.durationSeconds, 'premium'),
  };
  return { route, fares };
}

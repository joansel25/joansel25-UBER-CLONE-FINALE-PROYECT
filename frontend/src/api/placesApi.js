import { getPlacesAutocomplete, getPlaceDetails, reverseGeocode as reverseGeocodeService } from '../services/mapsService';

const placesApi = {
  autocomplete: async (input, { lat, lng, sessionToken } = {}) => {
    const location = (lat != null && lng != null) ? [lat, lng] : null;
    const results  = await getPlacesAutocomplete(input, sessionToken, location);
    return { data: results };
  },

  details: async (placeId, sessionToken) => {
    const result = await getPlaceDetails(placeId, sessionToken);
    return { data: result };
  },

  reverseGeocode: async (lat, lng) => {
    const result = await reverseGeocodeService(lat, lng);
    return { data: result };
  },
};

export default placesApi;

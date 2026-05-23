import client from './client';

const placesApi = {
  // input: text typed by user | lat,lng: bias results near user | sessionToken: billing group
  autocomplete: (input, { lat, lng, sessionToken } = {}) =>
    client.get('/places/autocomplete', { params: { input, lat, lng, sessionToken } }),

  // placeId from autocomplete → coordinates + formatted address
  details: (placeId, sessionToken) =>
    client.get('/places/details', { params: { placeId, sessionToken } }),
};

export default placesApi;

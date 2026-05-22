import client from './client';

const placesApi = {
  autocomplete: (input, sessionToken) =>
    client.get('/places/autocomplete', { params: { input, sessionToken } }),
  details: (placeId, sessionToken) =>
    client.get('/places/details', { params: { placeId, sessionToken } }),
};

export default placesApi;

import client from './client';

const tripApi = {
  estimate:     (params)              => client.get('/trips/estimate', { params }),
  create:       (data)               => client.post('/trips', data),
  getHistory:   (params)             => client.get('/trips', { params }),
  getAvailable: (params)             => client.get('/trips/available', { params }),
  getById:      (id)                 => client.get(`/trips/${id}`),
  accept:       (id, driverId)       => client.patch(`/trips/${id}/accept`, { driverId }),
  start:        (id)                 => client.patch(`/trips/${id}/start`),
  complete:     (id)                 => client.patch(`/trips/${id}/complete`),
  cancel:       (id)                 => client.patch(`/trips/${id}/cancel`),
  rate:         (id, rating)         => client.patch(`/trips/${id}/rate`, { rating }),
};

export default tripApi;

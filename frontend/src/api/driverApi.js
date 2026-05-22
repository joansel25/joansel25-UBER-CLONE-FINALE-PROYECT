import client from './client';

const driverApi = {
  register:       (data)                  => client.post('/drivers/register', data),
  getById:        (id)                    => client.get(`/drivers/${id}`),
  updateStatus:   (driverId, status)      => client.patch('/drivers/status', { driverId, status }),
  updateLocation: (driverId, lat, lng, tripId) =>
    client.patch('/drivers/location', { driverId, latitude: lat, longitude: lng, tripId }),
  getNearby:      (lat, lng, opts = {})   =>
    client.get('/drivers/nearby', { params: { latitude: lat, longitude: lng, ...opts } }),
};

export default driverApi;

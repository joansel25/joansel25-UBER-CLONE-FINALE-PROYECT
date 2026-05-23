import client from './client';

const driverApi = {
  register:       (vehicleInfo, licenseNumber) =>
    client.post('/drivers/register', { vehicleInfo, licenseNumber }),
  getMe:          ()                           => client.get('/drivers/me'),
  getById:        (id)                         => client.get(`/drivers/${id}`),
  updateStatus:   (driverId, status)           => client.patch('/drivers/status', { driverId, status }),
  updateLocation: (driverId, lat, lng, tripId) =>
    client.patch('/drivers/location', { driverId, latitude: lat, longitude: lng, tripId }),
  getNearby:      (lat, lng, opts = {})        =>
    client.get('/drivers/nearby', { params: { latitude: lat, longitude: lng, ...opts } }),
};

export default driverApi;

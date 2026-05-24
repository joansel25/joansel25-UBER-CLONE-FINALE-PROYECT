import client from './client';

const driverApi = {
  register:       (vehicleInfo, licenseNumber) =>
    client.post('/drivers/register', { vehicleInfo, licenseNumber }),
  getMe:          ()                           => client.get('/drivers/me'),
  getById:        (id)                         => client.get(`/drivers/${id}`),
  updateStatus:   (status)              => client.patch('/drivers/status', { status }),
  updateLocation: (lat, lng, tripId)    =>
    client.patch('/drivers/location', { latitude: lat, longitude: lng, tripId }),
  getNearby:      (lat, lng, opts = {})        =>
    client.get('/drivers/nearby', { params: { latitude: lat, longitude: lng, ...opts } }),
};

export default driverApi;

import client from './client';

const userApi = {
  register:      (data)    => client.post('/users/register', data),
  getMe:         ()        => client.get('/users/profile'),
  updateProfile: (updates) => client.patch('/users/profile', updates),
};

export default userApi;

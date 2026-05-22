import axios from 'axios';
import Config from 'react-native-config';
import auth from '@react-native-firebase/auth';

// Base URL comes from .env  →  API_URL=http://10.0.2.2:5000/api  (Android emulator)
//                             API_URL=http://localhost:5000/api   (iOS simulator)
const client = axios.create({
  baseURL: Config.API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the Firebase ID token automatically on every request
client.interceptors.request.use(async (config) => {
  const user = auth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error responses — always throw { message, statusCode }
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Unexpected error';
    const statusCode = error.response?.status || 0;
    const err = new Error(message);
    err.statusCode = statusCode;
    return Promise.reject(err);
  }
);

export default client;

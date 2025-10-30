import axios from 'axios';

// Create a single, configured axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000', // Base URL for the Express proxy server
});

// Interceptor to automatically add the JWT token to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Handle request errors
    return Promise.reject(error);
  }
);

export default api;
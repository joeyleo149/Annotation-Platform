import axios from 'axios';

// Create central Axios instance
const api = axios.create({
  baseURL: 'http://localhost:5138/api', // Replace with your ASP.NET backend URL/port
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token to every outbound request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
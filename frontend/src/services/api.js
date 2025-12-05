import axios from 'axios';

// Auto-detect environment based on where the app is running
const getBaseURL = () => {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local development
    return 'http://localhost:5006/api';
  } else {
    // Production (Render)
    return 'https://theopeninvitational-backend.onrender.com/api';
  }
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
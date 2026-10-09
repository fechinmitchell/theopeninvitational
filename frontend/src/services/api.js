// frontend/src/services/api.js
import axios from 'axios';

// Auto detect environment based on where the app is running
const getBaseURL = () => {
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local development
    return 'http://localhost:5006/api';
  }

  // Production (Render)
  return 'https://theopeninvitational-backend.onrender.com/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  // Render free tier can take up to a minute to wake up
  timeout: 70000,
});

// Add token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Messages the backend auth middleware returns when the token is missing or stale
const AUTH_FAILURE_MESSAGES = ['Invalid or expired token', 'Access token required'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error;

    // Stale login: clear it and send the user to log in again
    if ((status === 401 || status === 403) && AUTH_FAILURE_MESSAGES.includes(message)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      if (!window.location.pathname.startsWith('/login')) {
        const from = encodeURIComponent(window.location.pathname);
        window.location.href = `/login?expired=1&from=${from}`;
      }
    }

    // Friendlier message when the backend is asleep or unreachable
    if (!error.response && error.code === 'ECONNABORTED') {
      error.response = { data: { error: 'The server is taking too long to respond. Please try again.' } };
    } else if (!error.response) {
      error.response = { data: { error: 'Could not reach the server. Check your connection and try again.' } };
    }

    return Promise.reject(error);
  }
);

// Ping the backend early so Render starts waking up before the user submits anything
export const warmUpBackend = () => {
  api.get('/health').catch(() => {});
};

export default api;
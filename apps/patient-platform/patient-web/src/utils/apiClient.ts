import axios from 'axios';
import { API_CONFIG } from '../config/api';

export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  withCredentials: true,
  headers: {
    'ngrok-skip-browser-warning': 'true',
  }
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Extra safety: ensure header is present in every request
  config.headers['ngrok-skip-browser-warning'] = 'true';

  return config;
});

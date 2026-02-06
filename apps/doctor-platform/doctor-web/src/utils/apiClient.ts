/**
 * API Client - Doctor Portal
 * ===========================
 * 
 * Axios-based HTTP client for all API interactions.
 * Features:
 * - Automatic token handling
 * - Request/response interceptors
 * - Error handling
 */

import axios from 'axios';
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../config/api';

// =============================================================================
// Token Management
// =============================================================================

const TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const tokenManager = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string): void => localStorage.setItem(TOKEN_KEY, token),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string): void => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
  isAuthenticated: (): boolean => !!localStorage.getItem(TOKEN_KEY),
};

// =============================================================================
// Create Axios Instance
// =============================================================================

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// =============================================================================
// Request Interceptor
// =============================================================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get access token from localStorage (stored as 'authToken')
    const accessToken = tokenManager.getToken();
    // Get refresh token from localStorage (stored as 'refreshToken')
    const refreshToken = tokenManager.getRefreshToken();
    
    if (config.headers) {
      // Set access token in Authorization header (standard OAuth2/JWT format)
      // Format: Authorization: Bearer <access_token>
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      
      // Set refresh token in custom header for token refresh operations
      // Format: X-Refresh-Token: <refresh_token>
      if (refreshToken) {
        config.headers['X-Refresh-Token'] = refreshToken;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// =============================================================================
// Response Interceptor
// =============================================================================

// apiClient.interceptors.response.use(
//   (response) => response,
//   (error: AxiosError) => {
//     // Handle 401 Unauthorized
//     if (error.response?.status === 401) {
//       tokenManager.clearTokens();
//       // Redirect to login if not already there
//       if (window.location.pathname !== '/login') {
//         window.location.href = '/login';
//       }
//     }
//     return Promise.reject(error);
//   }
// );

export default apiClient;






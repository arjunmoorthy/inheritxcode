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
  clearAllStorage: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('idToken');
    localStorage.removeItem('userProfile');
  },
  isAuthenticated: (): boolean => !!localStorage.getItem(TOKEN_KEY),
  
  isTokenValid: (): boolean => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    
    // Basic JWT format check
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    try {
      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp) {
        // payload.exp is in seconds
        const isExpired = Date.now() >= payload.exp * 1000;
        return !isExpired;
      }
    } catch {
      return false; // Malformed base64 or JSON
    }
    
    return true; // Token has valid format and no expiration or is not yet expired
  },
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

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized or 403 Forbidden
    if (error.response?.status === 401 || error.response?.status === 403) {
      tokenManager.clearAllStorage();
      
      // Direct redirect to login for 401/403
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export default apiClient;






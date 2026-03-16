import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLogin, useCompleteNewPassword, fetchStaffProfile } from '../services/login';
import type { CompleteNewPasswordResponse, LoginResponse, StaffProfile } from '../services/login';
import { SESSION_START_KEY } from '@oncolife/ui-components';

interface User extends StaffProfile { }

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPasswordChangeRequired: boolean;
  authenticateLogin: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  completeNewPassword: (email: string, newPassword: string,) => Promise<CompleteNewPasswordResponse>;
  updateUserProfile: (profileData: Partial<User>) => void;
  setAuthToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordChangeRequired, setIsPasswordChangeRequired] = useState(false);
  const loginMutation = useLogin();
  const completeNewPasswordMutation = useCompleteNewPassword();

  // Consider authenticated if we have token in state or in localStorage (e.g. set by login callback/OAuth)
  const isAuthenticated = !!token || !!localStorage.getItem('authToken');

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
        try {
          // const profile = await fetchStaffProfile();
          // setUser(profile);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          // Optional: handle token expiration here
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const authenticateLogin = async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });

      const requiresPasswordChangeFromError =
        result.status_code === 403 && result.details?.requires_password_change;
      const requiresPasswordChange =
        result.data?.requiresPasswordChange || requiresPasswordChangeFromError;

      // Special case: backend signals mandatory password change via 403 payload
      if (requiresPasswordChange) {
        setIsPasswordChangeRequired(true);
        return {
          ...result,
          success: true,
          data: {
            ...(result.data ?? {}),
            requiresPasswordChange: true,
          },
        };
      }

      if (result.success) {
        sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());

        // Sync token to state so isAuthenticated is true (localStorage already set by mutation onSuccess)
        const accessToken =
          result.data?.access_token ??
          result.data?.session ??
          result.data?.tokens?.access_token;
        if (accessToken) {
          setToken(accessToken);
        }
        if (result.data?.user) {
          setUser(result.data.user as User);
        }

        return result;
      } else {
        // Use API message (e.g. "Invalid email or password.") for UI display
        throw new Error(result.message || result.error || 'Login failed');
      }
    } catch (err: unknown) {
      // Prefer API error body (e.g. 401/403: { success, status_code, message, details })
      const ax = err as {
        response?: { data?: LoginResponse };
        message?: string;
      };
      const apiData = ax.response?.data;

      // Special case: backend signals mandatory password change via 403 payload (error response)
      if (apiData?.status_code === 403 && apiData.details?.requires_password_change) {
        setIsPasswordChangeRequired(true);
        return {
          ...(apiData as LoginResponse),
          data: {
            ...(apiData.data ?? {}),
            requiresPasswordChange: true,
          },
        };
      }

      const apiMessage = apiData?.message;
      const message =
        typeof apiMessage === 'string' && apiMessage.trim()
          ? apiMessage
          : err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string'
            ? (err as Error).message
            : 'Login failed';
      throw new Error(message);
    }
  };

  const completeNewPassword = async (email: string, newPassword: string) => {
    try {
      const result = await completeNewPasswordMutation.mutateAsync({ email, newPassword });
      return result;
    } catch (error) {
      throw new Error('New password reset failed');
    }
  };

  const updateUserProfile = (profileData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...profileData };
      setUser(updatedUser);
      // Store in localStorage for persistence and UserContext sync
      localStorage.setItem('userProfile', JSON.stringify(updatedUser));
    } else {
      // If no user exists, create new user object
      const newUser = profileData as User;
      setUser(newUser);
      localStorage.setItem('userProfile', JSON.stringify(newUser));
    }
    // Trigger storage event so UserContext can pick up the change
    window.dispatchEvent(new Event('storage'));
  };

  const setAuthToken = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('authToken', newToken);
  };

  const logout = () => {
    // Clear all auth-related localStorage keys
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userType');
    localStorage.removeItem('profileCompleted');
    // Clear entire session storage (tokens, SSO data, etc.)
    sessionStorage.clear();
    setUser(null);
    setToken(null);
  };

  // Load user profile from localStorage on mount if available
  useEffect(() => {
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile && !user) {
      try {
        const parsedProfile = JSON.parse(storedProfile);
        setUser(parsedProfile);
      } catch (error) {
        console.error('Failed to parse stored profile:', error);
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isPasswordChangeRequired,
    isLoading,
    authenticateLogin,
    completeNewPassword,
    logout,
    updateUserProfile,
    setAuthToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 
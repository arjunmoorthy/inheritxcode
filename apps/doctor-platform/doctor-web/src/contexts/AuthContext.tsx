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

  const isAuthenticated = !!token;

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
        try {
          const profile = await fetchStaffProfile();
          setUser(profile);
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

      if (result.success) {
        sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());

        // Fetch full profile after successful login
        const profile = await fetchStaffProfile();
        setUser(profile);

        if (result.data?.requiresPasswordChange) {
          setIsPasswordChangeRequired(true);
        }
        return result;
      } else {
        // Include error code in thrown error for UI to parse
        throw new Error(result.error);
      }
    } catch (error: any) {
      // If error from backend, try to include error code
      if (error?.message) {
        throw error;
      }
      throw new Error('Login failed');
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

  const logout = () => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem(SESSION_START_KEY);
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isPasswordChangeRequired,
    isLoading,
    authenticateLogin,
    completeNewPassword,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 
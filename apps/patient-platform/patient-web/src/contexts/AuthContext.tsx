import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLogin, useCompleteNewPassword } from '../services/login';
import type { CompleteNewPasswordResponse, LoginResponse } from '../services/login';
import { SESSION_START_KEY } from '@oncolife/ui-components';
import { useQueryClient } from '@tanstack/react-query';
import { clearPatientUuid } from '../utils/patientUuid';
import type { User } from './authTypes';
import { getStoredUser, setStoredUser } from './authTypes';

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
  const queryClient = useQueryClient();

  const isAuthenticated = !!token;

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
        const storedUser = getStoredUser();
        if (storedUser) setUser(storedUser);
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const authenticateLogin = async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      
      if (result.success) {
        const userData = result.data?.user;
        const fullName = userData?.full_name ?? ([userData?.first_name, userData?.last_name].filter(Boolean).join(' ').trim() || undefined);
        const userPayload: User = {
          id: userData?.id ?? 0,
          uuid: userData?.uuid ?? '',
          email: userData?.email ?? email,
          name: fullName || undefined,
          first_name: userData?.first_name,
          last_name: userData?.last_name,
          full_name: userData?.full_name,
          role: userData?.role,
          patient_id: userData?.patient_id,
          staff_id: userData?.staff_id ?? null,
          is_active: userData?.is_active,
          is_verified: userData?.is_verified,
          is_first_login: userData?.is_first_login,
          auth_provider: userData?.auth_provider,
          last_login_at: userData?.last_login_at,
          created_at: userData?.created_at,
          updated_at: userData?.updated_at,
        };
        setUser(userPayload);
        setStoredUser(userPayload);
        // Token is stored by useLogin onSuccess; sync to state so headers use Bearer immediately
        const stored = localStorage.getItem('authToken');
        if (stored) setToken(stored);
        sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
        if (result.data?.requiresPasswordChange) {
          setIsPasswordChangeRequired(true);
        }
        // Refresh profile immediately for header/navigation
        await queryClient.invalidateQueries({ queryKey: ['profile'] });
        return result;
      } else {
        // API returns { success: false, message: "Invalid email or password.", data: null }
        throw new Error(result.message || result.error || 'Login failed');
      }
    } catch (err: unknown) {
      // Prefer API error body (e.g. 401: { success, status_code, message, details })
      const ax = err as { response?: { data?: { message?: string; details?: string | null } }; message?: string };
      const apiMessage = ax?.response?.data?.message;
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
    } catch {
      throw new Error('New password reset failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    setStoredUser(null);
    clearPatientUuid();
    sessionStorage.removeItem(SESSION_START_KEY);
    setToken(null);
    setUser(null);
    queryClient.removeQueries({ queryKey: ['profile'] });
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
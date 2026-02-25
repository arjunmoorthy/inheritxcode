import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';

interface LoginData {
  email: string;
  password: string;
}
interface CompleteNewPasswordData {
  email: string;
  currentPassword?: string;
  newPassword: string;
}

interface ForgotPasswordData {
  email: string;
}

interface VerifyResetTokenData {
  token: string;
}

interface ResetPasswordData {
  token: string;
  new_password: string;
  confirm_password: string;
}

interface SignupData {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  password?: string;
  confirm_password?: string;
  clinic_uuid: string;
  clinic_name?: string;
  department?: string;
  clinic_address?: string;
}

export interface CompleteNewPasswordResponse {
  success?: boolean;
  status?: string;
  message: string;
  data?: {
    tokens?: {
      access_token: string;
      refresh_token: string;
      id_token: string;
      token_type: string;
    };
  };
}
export interface LoginResponse {
  success: boolean;
  message: string;
  error?: string;
  data?: {
    user_status?: string;
    message?: string;
    session?: string;
    requiresPasswordChange?: boolean;
    // New response structure: tokens directly in data
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    token_type?: string;
    user?: any;
    // Old response structure: tokens nested in tokens object (backward compatibility)
    tokens?: {
      access_token: string;
      refresh_token: string;
      id_token: string;
      token_type: string;
    };
  };
}

const loginUser = async (data: LoginData): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(API_CONFIG.ENDPOINTS.AUTH.LOGIN, data);
  return response.data;
};

export const useLogin = () => {
  return useMutation({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // Handle session token (legacy)
      if (data.data?.session) {
        localStorage.setItem('authToken', data.data.session);
      }
      
      // Handle new response structure: tokens directly in data
      if (data.data?.access_token) {
        localStorage.setItem('authToken', data.data.access_token);
      }
      if (data.data?.refresh_token) {
        localStorage.setItem('refreshToken', data.data.refresh_token);
      }
      if (data.data?.id_token) {
        localStorage.setItem('idToken', data.data.id_token);
      }
      
      // Handle old response structure: tokens nested in tokens object (backward compatibility)
      if (data.data?.tokens) {
        localStorage.setItem('authToken', data.data.tokens.access_token);
        if (data.data.tokens.refresh_token) {
          localStorage.setItem('refreshToken', data.data.tokens.refresh_token);
        }
        if (data.data.tokens.id_token) {
          localStorage.setItem('idToken', data.data.tokens.id_token);
        }
      }
      
      // Store user data if available
      if (data.data?.user) {
        localStorage.setItem('userProfile', JSON.stringify(data.data.user));
      }
    },
    onError: (error) => {
      console.error('Login error:', error);
    },
  });
};

const completeNewPassword = async (data: CompleteNewPasswordData): Promise<CompleteNewPasswordResponse> => {
  const newData: Record<string, string | null> = {
    email: data?.email,
    new_password: data?.newPassword,
    session: localStorage.getItem('authToken'),
  };
  if (data?.currentPassword) {
    newData.current_password = data.currentPassword;
  }
  const response = await apiClient.post<CompleteNewPasswordResponse>(API_CONFIG.ENDPOINTS.AUTH.COMPLETE_NEW_PASSWORD, newData);
  return response.data;
};

export const useCompleteNewPassword = () => {
  return useMutation({
    mutationFn: completeNewPassword,
    onSuccess: (data) => {
      if (data.data?.tokens) {
        localStorage.setItem('authToken', data.data.tokens.access_token);
        localStorage.setItem('refreshToken', data.data.tokens.refresh_token);
      }
    },
    onError: (error) => {
      console.error('New password reset error:', error);
    },
  });
};

const forgotPassword = async (data: ForgotPasswordData) => {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, data);
  return response.data;
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: forgotPassword,
  });
};

const verifyResetToken = async (data: VerifyResetTokenData) => {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.VERIFY_RESET_TOKEN, data);
  return response.data;
};

export const useVerifyResetToken = () => {
  return useMutation({
    mutationFn: verifyResetToken,
  });
};

const resetPassword = async (data: ResetPasswordData) => {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, data);
  return response.data;
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: resetPassword,
  });
};

const signupUser = async (data: SignupData) => {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.SIGNUP, data);
  return response.data;
};

export const useSignup = () => {
  return useMutation({
    mutationFn: signupUser,
  });
};

// --- Social Signup & Profile Completion (Provided API Specs) ---

export interface GoogleSSOSignupData {
  id_token: string;
}

export interface GoogleSSOSignupResponse {
  success: boolean;
  message: string;
  data: {
    message: string;
    email: string;
    staff_id: number;
    first_name?: string | null;
    last_name?: string | null;
    access_token?: string;
    refresh_token?: string;
    is_profile_completed: boolean;
    created: boolean;
    staff_uuid?: string;
  };
}

// Flattened response type for easier use in components
export interface GoogleSSOSignupResponseData {
  message: string;
  email: string;
  staff_id: number;
  first_name?: string | null;
  last_name?: string | null;
  access_token?: string;
  refresh_token?: string;
  is_profile_completed: boolean;
  created: boolean;
  staff_uuid?: string;
}

const googleSSOSignup = async (data: GoogleSSOSignupData): Promise<GoogleSSOSignupResponseData> => {
  try {
    const response = await apiClient.post<GoogleSSOSignupResponse>(API_CONFIG.ENDPOINTS.AUTH.GOOGLE_SSO_SIGNUP, data);
    console.log('Google SSO Signup API Response:', response);
    
    // Extract data from nested structure
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    // Fallback for old format (backward compatibility)
    return response.data as any;
  } catch (error: any) {
    console.error('Google SSO Signup API Error:', error);
    // Re-throw to let the mutation handle it
    throw error;
  }
};

export const useGoogleSSOSignup = () => {
  return useMutation({
    mutationFn: googleSSOSignup,
    onSuccess: (data) => {
      // Store tokens if provided in response (only if profile is completed)
      // If profile is not completed, tokens will be stored after profile completion
      if (data.is_profile_completed && data.access_token) {
        localStorage.setItem('authToken', data.access_token);
      }
      if (data.is_profile_completed && data.refresh_token) {
        localStorage.setItem('refreshToken', data.refresh_token);
      }
    },
    onError: (error) => {
      console.error('Google SSO signup error:', error);
    },
  });
};

interface CompleteProfileData {
  staff_id: number;
  role: string;
  clinic_uuid: string;
  clinic_name: string;
  clinic_address: string;
  department: string;
}

interface CompleteProfileResponse {
  message: string;
  staff_id: number;
  staff_uuid: string;
  role: string;
  clinic_uuid: string;
  clinic_name: string;
  clinic_address: string;
  department: string;
}

const completeProfile = async (data: CompleteProfileData): Promise<CompleteProfileResponse> => {
  const response = await apiClient.post<CompleteProfileResponse>(API_CONFIG.ENDPOINTS.AUTH.PROFILE_COMPLETE, data);
  return response.data;
};

export const useCompleteProfile = () => {
  return useMutation({
    mutationFn: completeProfile,
  });
};

export interface StaffProfile {
  staff_id: number;
  staff_uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department?: string;
  clinic_name?: string;
  clinic_address?: string;
  clinic_uuid?: string;
}

export const fetchStaffProfile = async (): Promise<StaffProfile> => {
  const response = await apiClient.get<StaffProfile>(API_CONFIG.ENDPOINTS.STAFF.PROFILE);
  return response.data;
};


interface LogoutResponse {
  success: boolean;
  message: string;
}

const logoutUser = async (): Promise<LogoutResponse> => {
  const response = await apiClient.post<LogoutResponse>(API_CONFIG.ENDPOINTS.AUTH.LOGOUT);
  return response.data;
};


export const useLogout = () => {
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
    },
    onError: (error) => {
      console.error('Logout error:', error);
    },
  });
};

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';

interface LoginData {
  email: string;
  password: string;
}

interface CompleteNewPasswordData {
  email: string;
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
  success: boolean;
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

      if (data.data?.session) {
        localStorage.setItem('authToken', data.data.session);
      }
      if (data.data?.tokens) {
        localStorage.setItem('authToken', data.data.tokens.access_token);
      }
    },
    onError: (error) => {
      console.error('Login error:', error);
    },
  });
};

const completeNewPassword = async (data: CompleteNewPasswordData): Promise<CompleteNewPasswordResponse> => {
  const newData = {
    email: data?.email,
    new_password: data?.newPassword,
    session: localStorage.getItem('authToken'),
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
  message: string;
  email: string;
  staff_id: number;
  staff_uuid: string; // Added staff_uuid
  created: boolean;
}

const googleSSOSignup = async (data: GoogleSSOSignupData): Promise<GoogleSSOSignupResponse> => {
  const response = await apiClient.post<GoogleSSOSignupResponse>(API_CONFIG.ENDPOINTS.AUTH.GOOGLE_SSO_SIGNUP, data);
  return response.data;
};

export const useGoogleSSOSignup = () => {
  return useMutation({
    mutationFn: googleSSOSignup,
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
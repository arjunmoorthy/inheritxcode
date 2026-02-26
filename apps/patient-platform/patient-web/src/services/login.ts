import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';
import { setPatientUuid, clearPatientUuid } from '../utils/patientUuid';

interface LoginData {
  email: string;
  password: string;
}

interface CompleteNewPasswordData {
  email: string;
  currentPassword?: string;
  newPassword: string;
}

/** Payload for POST /api/v1/fax/change-password (set password page) */
interface ChangePasswordData {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
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
    tokens?: {
      access_token: string;
      refresh_token: string;
      id_token: string;
      token_type: string;
    };
    user?: {
      id: number;
      uuid: string;
      email: string;
      first_name?: string;
      last_name?: string;
      full_name?: string;
      role?: string;
      is_active?: boolean;
      patient_id?: number;
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
        if (data.data.tokens.refresh_token) {
          localStorage.setItem('refreshToken', data.data.tokens.refresh_token);
        }
      }
      if (data.data?.user?.uuid) {
        setPatientUuid(data.data.user.uuid);
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
  const response = await apiClient.post<CompleteNewPasswordResponse>(
    API_CONFIG.ENDPOINTS.AUTH.COMPLETE_NEW_PASSWORD,
    newData
  );
  return response.data;
};

const changePassword = async (data: ChangePasswordData): Promise<CompleteNewPasswordResponse> => {
  const payload = {
    email: data.email,
    current_password: data.currentPassword,
    new_password: data.newPassword,
    confirm_password: data.confirmPassword,
  };
  const response = await apiClient.post<CompleteNewPasswordResponse>(
    API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD,
    payload
  );
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

export const useChangePassword = () => {
  return useMutation({
    mutationFn: changePassword,
    onSuccess: (data) => {
      if (data.data?.tokens) {
        localStorage.setItem('authToken', data.data.tokens.access_token);
        localStorage.setItem('refreshToken', data.data.tokens.refresh_token);
      }
    },
    onError: (error) => {
      console.error('Change password error:', error);
    },
  });
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
      clearPatientUuid();
    },
    onError: (error) => {
      console.error('Logout error:', error);
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
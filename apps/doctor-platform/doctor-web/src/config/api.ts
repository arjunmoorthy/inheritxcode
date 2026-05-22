/**
 * API Configuration - Doctor Portal
 * ===================================
 * 
 * Centralized API configuration with versioned endpoints.
 * All API calls now use the /api/v1/ prefix.
 */

// Base URLs from environment variables
const API_BASE = import.meta.env.VITE_API_BASE || '';

// API Version prefix
const API_VERSION = '/api/v1';

export const API_CONFIG = {
  // Base URLs
  BASE_URL: `${API_BASE}${API_VERSION}`,
  API_VERSION,

  // Endpoint definitions - all versioned
  ENDPOINTS: {
    // Authentication
    AUTH: {
      LOGIN: '/auth/login',
      SIGNUP: '/auth/signup/staff',
      LOGOUT: '/auth/logout',
      COMPLETE_NEW_PASSWORD: '/auth/complete-new-password',
      GOOGLE_LOGIN: '/auth/google',
      GOOGLE_SSO_SIGNUP: '/auth/google/signup',
      PROFILE_COMPLETE: '/auth/profile/complete',
      FORGOT_PASSWORD: '/auth/forgot-password',
      VERIFY_RESET_TOKEN: '/auth/verify-reset-token',
      RESET_PASSWORD: '/auth/reset-password',
      DELETE_USER: '/auth/delete-user',
    },

    // Staff Management
    STAFF: {
      LIST: '/staff',
      ADD: '/staff/add',
      LIST_DOCTORS: '/staff/list/doctors',
      /** GET - All active staff members */
      ALL_STAFF: '/staff/all-staff',
      PROFILE: '/staff/profile',
      BY_UUID: (uuid: string) => `/staff/${uuid}`,
      /** PUT /staff/staff/{staff_id} - Update staff full_name and phone */
      BY_STAFF_ID: (staffId: number) => `/staff/staff/${staffId}`,
    },

    // Clinic Management
    CLINICS: {
      LIST: '/clinics',
      CREATE: '/clinics',
      BY_UUID: (uuid: string) => `/clinics/${uuid}`,
    },

    // Patient Access (read-only)
    PATIENTS: {
      LIST: '/patients',
      BY_UUID: (uuid: string) => `/patients/${uuid}`,
      ALERTS: (uuid: string) => `/patients/${uuid}/alerts`,
      CONVERSATIONS: (uuid: string) => `/dashboard/patient/${uuid}/summaries`,
      DIARY: (uuid: string) => `/patients/${uuid}/diary`,
      STATS: (uuid: string) => `/patients/${uuid}/stats`,
    },

    // Fax / Manual Patient
    FAX: {
      PATIENTS: {
        CREATE: '/fax/patients',
        UPDATE: (id: string) => `/fax/patients/${id}`,
      },
      /** POST - Change password (patient, nurse, physician); uses temp password as current_password */
      CHANGE_PASSWORD: '/fax/change-password',
    },

    // Dashboard & Analytics
    DASHBOARD: {
      LANDING: '/dashboard',
      PATIENT_LISTING_DASHBOARD: '/dashboard/patient-listing-dashboard',
      PATIENT_TIMELINE: (uuid: string) => `/dashboard/patient/${uuid}`,
      PATIENT_QUESTIONS: (uuid: string) => `/dashboard/patient/${uuid}/questions`,
      PATIENT_PROFILE_UPDATE: (uuid: string) => `/dashboard/patient/${uuid}/profile`,
      OVERALL_SUMMARY: (uuid: string) => `/dashboard/patient/${uuid}/overall-summary`,
      EM_DOCUMENTATION: (uuid: string) => `/dashboard/patient/${uuid}/em-documentation`,
      REPORTS_LIST: '/dashboard/reports',
      REPORTS_WEEKLY: '/dashboard/reports/weekly',
      REPORTS_GENERATE: '/dashboard/reports/generate',
      PATIENT_FAX_SEND: (uuid: string) => `/fax/outgoing/patient/${uuid}/symptoms`,
    },

    // Health Check
    HEALTH: '/health',
  },
} as const;

// Helper to build full URL
export const buildUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export default API_CONFIG;




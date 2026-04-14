/**
 * Staff Service - Doctor Portal
 * ==============================
 * 
 * Handles all staff-related API calls.
 * Connects to doctor-api backend endpoints.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';

// =============================================================================
// Types
// =============================================================================

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  clinicName?: string;
  npiNumber?: string;
}

export interface StaffListResponse {
  data: Staff[];
  total: number;
  page: number;
  page_size: number;
}

export interface AddStaffRequest {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  clinicName?: string;
  npiNumber?: string;
}

export interface UpdateStaffRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  clinicName?: string;
  npiNumber?: string;
}

/** Payload for POST /api/v1/staff/add */
export interface AddStaffV1Payload {
  role: string;
  full_name: string;
  email: string;
  phone: string;
  clinic_id: number;
  fax_number: string;
  doctor_ids: number[];
}

/** Doctor item from GET /api/v1/staff/list/doctors */
export interface DoctorListItem {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

/** Clinic from all-staff item */
export interface AllStaffClinic {
  id: number;
  uuid: string;
  name: string;
  address?: string;
  phone?: string | null;
  department?: string;
}

/** Staff item from GET /api/v1/staff/all-staff */
export interface AllStaffItem {
  id: number;
  uuid: string;
  user_id?: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  npi_number?: string | null;
  phone?: string | null;
  is_profile_completed?: boolean;
  is_active?: boolean;
  clinic?: AllStaffClinic;
}

/** Response from GET /api/v1/staff/all-staff */
export interface AllStaffResponse {
  success: boolean;
  message: string;
  data: AllStaffItem[];
}

export interface CurrentStaffProfile {
  staff_id?: number;
  first_name: string;
  last_name: string;
  role: string;
  email: string;
  phone: string;
  clinic_name: string;
  clinic_department: string;
  clinic_address: string;
  clinic_fax: string;
}

// Backend response types (from doctor-api)
interface BackendStaffResponse {
  staff_uuid: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  role: string;
  npi_number?: string;
  created_at?: string;
  updated_at?: string;
}

interface BackendStaffListResponse {
  staff: BackendStaffResponse[];
  total: number;
  skip: number;
  limit: number;
}

// =============================================================================
// Transform Functions (Backend → Frontend)
// =============================================================================

const transformStaff = (backend: BackendStaffResponse): Staff => ({
  id: backend.staff_uuid,
  firstName: backend.first_name || '',
  lastName: backend.last_name || '',
  email: backend.email_address,
  role: backend.role,
  clinicName: '', // TODO: Add clinic name from backend if available
  npiNumber: backend.npi_number,
});

// =============================================================================
// API Functions
// =============================================================================

const getStaff = async (
  page: number,
  search?: string,
  pageSize: number = 10
): Promise<StaffListResponse> => {
  try {
    const skip = (page - 1) * pageSize;
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: pageSize.toString(),
    });

    let endpoint = `${API_CONFIG.ENDPOINTS.STAFF.LIST}?${params.toString()}`;

    // Use search endpoint if search term provided
    if (search && search.length >= 2) {
      endpoint = `${API_CONFIG.ENDPOINTS.STAFF.LIST}/search?q=${encodeURIComponent(search)}&limit=${pageSize}`;

      const response = await apiClient.get<BackendStaffResponse[]>(endpoint);
      const staffList = response.data.map(transformStaff);

      return {
        data: staffList,
        total: staffList.length,
        page,
        page_size: pageSize,
      };
    }

    const response = await apiClient.get<BackendStaffListResponse>(endpoint);
    const staffList = response.data.staff.map(transformStaff);

    return {
      data: staffList,
      total: response.data.total,
      page,
      page_size: pageSize,
    };
  } catch (error) {
    console.error('Error fetching staff:', error);
    return {
      data: [],
      total: 0,
      page: 1,
      page_size: pageSize,
    };
  }
};

const addStaffMember = async (
  data: AddStaffRequest
): Promise<{ message: string; staff_uuid: string }> => {
  // Determine if this is a physician or staff member
  if (data.role === 'physician') {
    const response = await apiClient.post<{ message: string; staff_uuid: string }>(
      `${API_CONFIG.ENDPOINTS.STAFF.LIST}/physician`,
      {
        email_address: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        npi_number: data.npiNumber || '0000000000', // NPI is required for physicians
        clinic_uuid: '00000000-0000-0000-0000-000000000000', // TODO: Get from context
      }
    );
    return response.data;
  } else {
    const response = await apiClient.post<{ message: string; staff_uuid: string }>(
      `${API_CONFIG.ENDPOINTS.STAFF.LIST}/member`,
      {
        email_address: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role,
        physician_uuids: [], // TODO: Get from context
        clinic_uuid: '00000000-0000-0000-0000-000000000000', // TODO: Get from context
      }
    );
    return response.data;
  }
};

const updateStaffMember = async (_params: {
  id: string;
  data: UpdateStaffRequest
}): Promise<{ message: string }> => {
  // TODO: Implement when backend supports staff updates
  // const response = await apiClient.put(
  //   API_CONFIG.ENDPOINTS.STAFF.BY_UUID(id),
  //   {
  //     first_name: data.firstName,
  //     last_name: data.lastName,
  //     email_address: data.email,
  //     role: data.role,
  //   }
  // );
  // return response.data;
  throw new Error('Staff update not yet implemented in backend');
};

/** GET /api/v1/staff/list/doctors - list doctors for assignment (e.g. when adding nurse) */
const getDoctorsList = async (): Promise<DoctorListItem[]> => {
  try {
    const response = await apiClient.get<DoctorListItem[] | { data: DoctorListItem[] }>(
      API_CONFIG.ENDPOINTS.STAFF.LIST_DOCTORS
    );
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'data' in data) return (data as { data: DoctorListItem[] }).data;
    return [];
  } catch (error: any) {
    if (error?.response?.status === 403) {
      console.warn('User does not have permission to view full doctors list.');
      return [];
    }
    throw error;
  }
};

/** POST /api/v1/staff/add - add new staff with full payload */
const addStaffV1 = async (payload: AddStaffV1Payload): Promise<{ message?: string }> => {
  const response = await apiClient.post<{ message?: string }>(
    API_CONFIG.ENDPOINTS.STAFF.ADD,
    payload
  );
  return response.data;
};

/** Payload for PUT /api/v1/staff/staff/{staff_id} - update full_name and phone */
export interface UpdateStaffProfilePayload {
  full_name: string;
  phone: string;
}

/** PUT /api/v1/staff/staff/{staff_id} - Update staff full_name and phone */
const updateStaffProfile = async (
  staffId: number,
  payload: UpdateStaffProfilePayload
): Promise<unknown> => {
  const response = await apiClient.put<unknown>(
    API_CONFIG.ENDPOINTS.STAFF.BY_STAFF_ID(staffId),
    payload
  );
  return response.data;
};

// =============================================================================
// React Query Hooks
// =============================================================================

export const useStaff = (page: number, search?: string, pageSize: number = 10) => {
  return useQuery({
    queryKey: ['staff', page, search, pageSize],
    queryFn: () => getStaff(page, search, pageSize),
  });
};

export const useAddStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addStaffMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
};

export const useUpdateStaff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateStaffMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
};

/** GET /api/v1/staff/all-staff - Get all active staff members */
const getAllStaff = async (): Promise<AllStaffItem[]> => {
  const response = await apiClient.get<AllStaffResponse>(API_CONFIG.ENDPOINTS.STAFF.ALL_STAFF);
  if (response.data?.success && Array.isArray(response.data?.data)) {
    return response.data.data;
  }
  return [];
};

/** GET /api/v1/staff/profile - current logged-in staff profile */
const getCurrentStaffProfile = async (): Promise<CurrentStaffProfile | null> => {
  const response = await apiClient.get<any>(API_CONFIG.ENDPOINTS.STAFF.PROFILE);
  const payload = response.data?.data ?? response.data ?? {};
  const clinic = payload?.clinic ?? {};

  const firstName = payload?.first_name ?? payload?.user?.first_name ?? '';
  const lastName = payload?.last_name ?? payload?.user?.last_name ?? '';

  return {
    staff_id: payload?.staff_id ?? payload?.id ?? payload?.staff?.id,
    first_name: firstName,
    last_name: lastName,
    role: payload?.role ?? payload?.staff?.role ?? '',
    email: payload?.email ?? payload?.user?.email ?? '',
    phone: payload?.phone ?? payload?.staff?.phone ?? '',
    clinic_name: payload?.clinic_name ?? clinic?.name ?? '',
    clinic_department: payload?.clinic_department ?? payload?.department ?? clinic?.department ?? '',
    clinic_address: payload?.clinic_address ?? clinic?.address ?? '',
    clinic_fax: payload?.clinic_fax ?? payload?.fax_number ?? clinic?.fax ?? clinic?.phone ?? '',
  };
};

/** Fetch doctors list for staff assignment (e.g. nurse → doctor_ids) */
export const useStaffListDoctors = (enabled = true) => {
  return useQuery({
    queryKey: ['staff', 'list', 'doctors'],
    queryFn: getDoctorsList,
    enabled,
  });
};

/** Fetch all active staff (for Update Existing Staff list) */
export const useAllStaff = (enabled = true) => {
  return useQuery({
    queryKey: ['staff', 'all'],
    queryFn: getAllStaff,
    enabled,
  });
};

export const useCurrentStaffProfile = (enabled = true) => {
  return useQuery({
    queryKey: ['staff', 'profile'],
    queryFn: getCurrentStaffProfile,
    enabled,
  });
};

/** Add staff via POST /api/v1/staff/add */
export const useAddStaffV1 = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addStaffV1,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
};

/** Update current staff profile (full_name, phone) via PUT /api/v1/staff/staff/{staff_id} */
export const useUpdateStaffProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, payload }: { staffId: number; payload: UpdateStaffProfilePayload }) =>
      updateStaffProfile(staffId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
};

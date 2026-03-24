/**
 * Patient Service - Doctor Portal
 * ================================
 * 
 * Handles all patient-related API calls.
 * Connects to doctor-api backend endpoints.
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';
import type { PatientListingApiItem } from './dashboard';

// =============================================================================
// Types
// =============================================================================

export interface Patient {
  id: string; // Internal/Patient ID
  uuid: string; // Global UUID
  firstName: string;
  lastName: string;
  email: string;
  mrn: string;
  dateOfBirth: string;
  sex: 'Male' | 'Female' | 'Other';
  race: string;
  phoneNumber: string;
  physician: string;
  diseaseType: string;
  associateClinic: string;
  treatmentType: string;
  physician_ids?: number[];
  cancer_type?: string;
  diagnosis?: string;
  start_date?: string;
  end_date?: string;
  plan_name?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  chemotherapy_day?: string;
  next_chemotherapy_date?: string;
  location?: string;
  assigned_oncologist?: string;
  day_of_chemotherapy_treatment?: string;
  next_chemotherapy_treatment?: string;
}

export interface ConversationSummary {
  id: string | number;
  patient_uuid: string;
  summary_text: string;
  status: 'good' | 'fair' | 'poor' | string;
  created_at: string;
  tags: string[];
}

export interface PatientsResponse {
  data: Patient[];
  total: number;
  page: number;
  totalPages: number;
}

// Backend response types (from doctor-api)

interface BackendPatientDetail {
  uuid: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  dob?: string;
  sex?: string;
  disease_type?: string;
  treatment_type?: string;
  created_at?: string;
  mrn?: string;
  cancer_type?: string;
  diagnosis?: string;
  physician_ids?: number[];
  start_date?: string;
  end_date?: string;
  plan_name?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  chemotherapy_day?: string;
  next_chemotherapy_date?: string;
}

interface PatientListingApiResponse {
  status: string;
  data: PatientListingApiItem[];
}

const transformListingToPatient = (item: PatientListingApiItem): Patient => ({
  id: String(item.patient_id),
  uuid: item.patient_uuid || item.uuid || '',
  firstName: item.first_name || '',
  lastName: item.last_name || '',
  email: item.email || '',
  mrn: (item.mrn && String(item.mrn)) || String(item.patient_id),
  dateOfBirth: item.date_of_birth || '',
  sex: (item.gender === 'Male' ? 'Male' : item.gender === 'Female' ? 'Female' : 'Other') as 'Male' | 'Female' | 'Other',
  race: '',
  phoneNumber: item.phone_number || '',
  physician: '',
  diseaseType: item.diagnosis || item.cancer_type || item.disease_type || '',
  associateClinic: '',
  treatmentType: item.plan_name || '',
  start_date: item.start_date || undefined,
  end_date: item.end_date || undefined,
  plan_name: item.plan_name || undefined,
  location: item.location || undefined,
  assigned_oncologist: item.assigned_oncologist || undefined,
  day_of_chemotherapy_treatment: item.day_of_chemotherapy_treatment || undefined,
  next_chemotherapy_treatment: item.next_chemotherapy_treatment || undefined,
  past_medical_history: item.past_medical_history || undefined,
  past_surgical_history: item.past_surgical_history || undefined,
});

const transformPatientDetail = (backend: BackendPatientDetail): Patient => ({
  id: backend.uuid, // Using UUID as ID here for detail page compatibility
  uuid: backend.uuid,
  firstName: backend.first_name || '',
  lastName: backend.last_name || '',
  email: backend.email_address,
  mrn: backend.mrn || '',
  dateOfBirth: backend.dob || '',
  sex: (backend.sex as 'Male' | 'Female' | 'Other') || 'Other',
  race: '',
  phoneNumber: backend.phone_number || '',
  physician: '',
  diseaseType: backend.disease_type || backend.cancer_type || backend.diagnosis || '',
  associateClinic: '',
  treatmentType: backend.treatment_type || backend.plan_name || '',
  cancer_type: backend.cancer_type,
  diagnosis: backend.diagnosis,
  physician_ids: backend.physician_ids,
  start_date: backend.start_date,
  end_date: backend.end_date,
  plan_name: backend.plan_name,
  past_medical_history: backend.past_medical_history,
  past_surgical_history: backend.past_surgical_history,
  chemotherapy_day: backend.chemotherapy_day,
  next_chemotherapy_date: backend.next_chemotherapy_date,
});

// =============================================================================
// API Functions
// =============================================================================

const fetchPatientListing = async (
  search?: string | null
): Promise<PatientListingApiResponse> => {
  const searchTrimmed = typeof search === 'string' ? search.trim() : '';
  const url = searchTrimmed
    ? `${API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_LISTING_DASHBOARD}?search=${encodeURIComponent(searchTrimmed)}`
    : API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_LISTING_DASHBOARD;
  const response = await apiClient.get<PatientListingApiResponse>(url);
  return response.data;
};

const fetchPatients = async (
  page: number = 1,
  search: string = '',
  rowsPerPage: number = 10
): Promise<PatientsResponse> => {
  try {
    const listingResponse = await fetchPatientListing(search);
    const apiData = listingResponse?.data || [];
    const patients = apiData.map(transformListingToPatient);
    const total = patients.length;
    const startIndex = (page - 1) * rowsPerPage;
    const paginatedData = patients.slice(startIndex, startIndex + rowsPerPage);

    return {
      data: paginatedData,
      total,
      page,
      totalPages: Math.ceil(total / rowsPerPage) || 1,
    };
  } catch (error) {
    console.error('Error fetching patients:', error);
    return {
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }
};

const fetchPatientDetails = async (patientId: string): Promise<Patient> => {
  const response = await apiClient.get<BackendPatientDetail>(
    API_CONFIG.ENDPOINTS.PATIENTS.BY_UUID(patientId)
  );

  return transformPatientDetail(response.data);
};

// =============================================================================
// React Query Hooks
// =============================================================================

export const usePatients = (
  page: number = 1,
  search: string = '',
  rowsPerPage: number = 10
) => {
  return useQuery({
    queryKey: ['patients', page, search, rowsPerPage],
    queryFn: () => fetchPatients(page, search, rowsPerPage),
    placeholderData: keepPreviousData,
  });
};

export const usePatientDetails = (patientId: string) => {
  return useQuery({
    queryKey: ['patientDetails', patientId],
    queryFn: () => fetchPatientDetails(patientId),
    enabled: !!patientId,
  });
};

export const fetchPatientConversations = async (patientUuid: string): Promise<ConversationSummary[]> => {
  const response = await apiClient.get<ConversationSummary[]>(
    API_CONFIG.ENDPOINTS.PATIENTS.CONVERSATIONS(patientUuid)
  );
  return response.data;
};

export const usePatientConversations = (patientUuid: string) => {
  return useQuery({
    queryKey: ['patientConversations', patientUuid],
    queryFn: () => fetchPatientConversations(patientUuid),
    enabled: !!patientUuid,
  });
};

// =============================================================================
// Add Manual Patient (FAX / fax_patients)
// =============================================================================

export interface AddManualPatientPayload {
  patient_uuid?: string;
  first_name?: string;
  last_name?: string;
  mrn?: string;
  date_of_birth?: string;
  age?: number;
  gender?: string;
  email?: string;
  phone_number?: string;
  location?: string;
  cancer_type?: string;
  diagnosis?: string;
  oncologist?: string;
  start_date?: string;
  end_date?: string;
  plan_name?: string;
  regimen_name?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  chemotherapy_day?: string;
  day_of_chemotherapy_treatment?: string;
  next_chemotherapy_date?: string;
  next_chemotherapy_treatment?: string;
  physician_ids?: number[];
}

export interface PatientProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  mrn?: string;
  date_of_birth?: string;
  age?: number;
  gender?: string;
  email?: string;
  phone_number?: string;
  location?: string;
  cancer_type?: string;
  diagnosis?: string;
  physician_ids?: number[];
  start_date?: string;
  end_date?: string;
  plan_name?: string;
  regimen_name?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  chemotherapy_day?: string;
  day_of_chemotherapy_treatment?: string;
  next_chemotherapy_date?: string;
  next_chemotherapy_treatment?: string;
}

const addManualPatient = async (
  payload: AddManualPatientPayload
): Promise<unknown> => {
  const response = await apiClient.post(
    API_CONFIG.ENDPOINTS.FAX.PATIENTS.CREATE,
    payload
  );
  return response.data;
};

export const useAddManualPatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addManualPatient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['patientDetails'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

const updateFaxPatient = async (
  patientId: string,
  payload: AddManualPatientPayload
): Promise<unknown> => {
  const response = await apiClient.put(
    API_CONFIG.ENDPOINTS.FAX.PATIENTS.UPDATE(patientId),
    payload
  );
  return response.data;
};

export const useUpdateFaxPatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientId, payload }: { patientId: string; payload: AddManualPatientPayload }) =>
      updateFaxPatient(patientId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['patientDetails'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

const updatePatientProfile = async (
  patientUuid: string,
  payload: PatientProfileUpdatePayload
): Promise<unknown> => {
  const response = await apiClient.patch(
    API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_PROFILE_UPDATE(patientUuid),
    payload
  );
  return response.data;
};

export const useUpdatePatientProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientUuid, payload }: { patientUuid: string; payload: PatientProfileUpdatePayload }) =>
      updatePatientProfile(patientUuid, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['patientDetails'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

// =============================================================================
// Mutation Hooks (for future use when backend supports these)
// =============================================================================

export const useAddPatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Patient> => {
      // TODO: Implement when backend supports patient creation from doctor portal
      // const response = await apiClient.post(API_CONFIG.ENDPOINTS.PATIENTS.LIST, patientData);
      // return transformPatientDetail(response.data);
      throw new Error('Patient creation not yet implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

export const useUpdatePatient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Patient> => {
      // TODO: Implement when backend supports patient updates from doctor portal
      // const response = await apiClient.put(API_CONFIG.ENDPOINTS.PATIENTS.BY_UUID(id), patientData);
      // return transformPatientDetail(response.data);
      throw new Error('Patient update not yet implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

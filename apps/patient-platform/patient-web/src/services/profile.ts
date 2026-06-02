import { apiClient } from '../utils/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProfileFormData, ProfileScreenApiResponse, ProfileScreenData } from '../pages/ProfilePage/types';
import { getPatientUuid } from '../utils/patientUuid';

// export const fetchProfile = async () => {
//   const patientUuid = getPatientUuid();
//   if (!patientUuid) {
//     throw new Error('Not authenticated. Please sign in.');
//   }
//   const response = await apiClient.get(`/profile?patient_uuid=${encodeURIComponent(patientUuid)}`);
//   return response.data;
// };

export const fetchProfileScreen = async (uuid?: string): Promise<ProfileScreenData> => {
  const patientUuid = uuid || getPatientUuid();
  if (!patientUuid) {
    throw new Error('Not authenticated. Please sign in.');
  }
  const response = await apiClient.get<ProfileScreenApiResponse>(`/profile/screen?patient_uuid=${encodeURIComponent(patientUuid)}`);
  return response.data.data;
};

export const updateProfile = async (data: any) => {
  const patientUuid = getPatientUuid();
  if (!patientUuid) {
    throw new Error('Not authenticated. Please sign in.');
  }
  const response = await apiClient.patch(`/profile/screen?patient_uuid=${encodeURIComponent(patientUuid)}`, data);
  return response.data;
};

export const useFetchProfile = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['profile'],
    // queryFn: fetchProfile,
    enabled: options?.enabled ?? true,
  });
};

export const useFetchProfileScreen = (uuid?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['profile', 'screen', uuid],
    queryFn: () => fetchProfileScreen(uuid),
    enabled: options?.enabled ?? true,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      // Invalidate profile cache to refetch
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'screen'] });
    },
  });
};

export interface SeverityPoint {
  date: string;
  value: string;
}

export interface SeveritySeries {
  symptom_id: string;
  symptom_name: string;
  points: SeverityPoint[];
}

export interface TemperaturePoint {
  date: string;
  value: number;
}

export interface MedicationRow {
  date: string;
  symptom_id: string;
  symptom_name: string;
  severity: string;
  medication_name: string | null;
  medication_frequency: string | null;
}

export interface PatientTrendsResponse {
  patient_uuid: string;
  start_date: string;
  end_date: string;
  severity_series: SeveritySeries[];
  temperature_series: TemperaturePoint[];
  medications: MedicationRow[];
  chemo_dates: string[];
  last_chemo_date: string | null;
}

export const fetchPatientTrends = async (
  startDate?: string,
  endDate?: string
): Promise<PatientTrendsResponse> => {
  const patientUuid = getPatientUuid();
  if (!patientUuid) {
    throw new Error('Not authenticated. Please sign in.');
  }

  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const response = await apiClient.get<PatientTrendsResponse>(
    `/dashboard/patient/${encodeURIComponent(patientUuid)}/trends`,
    { params }
  );
  return response.data;
};

export const usePatientTrends = (
  startDate?: string,
  endDate?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: ['patientTrends', startDate, endDate],
    queryFn: () => fetchPatientTrends(startDate, endDate),
    enabled: options?.enabled ?? true,
  });
};
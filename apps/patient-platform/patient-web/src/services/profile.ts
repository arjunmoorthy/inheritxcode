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
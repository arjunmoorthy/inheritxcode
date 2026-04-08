import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';

export interface ClinicItem {
  id: number;
  uuid: string;
  name: string;
  address?: string;
  phone?: string | null;
  fax?: string | null;
  department?: string;
}

interface ClinicsResponse {
  success?: boolean;
  data?: ClinicItem[];
}

interface ClinicPayload {
  name: string;
  address: string;
  fax?: string;
}

const getClinics = async (): Promise<ClinicItem[]> => {
  const response = await apiClient.get<ClinicItem[] | ClinicsResponse>(API_CONFIG.ENDPOINTS.CLINICS.LIST);
  const data = response.data as any;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const createClinic = async (payload: ClinicPayload): Promise<unknown> => {
  const response = await apiClient.post(API_CONFIG.ENDPOINTS.CLINICS.CREATE, payload);
  return response.data;
};

const updateClinic = async (uuid: string, payload: ClinicPayload): Promise<unknown> => {
  const response = await apiClient.put(API_CONFIG.ENDPOINTS.CLINICS.BY_UUID(uuid), payload);
  return response.data;
};

export const useClinics = (enabled = true) =>
  useQuery({
    queryKey: ['clinics'],
    queryFn: getClinics,
    enabled,
  });

export const useCreateClinic = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createClinic,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinics'] }),
  });
};

export const useUpdateClinic = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, payload }: { uuid: string; payload: ClinicPayload }) =>
      updateClinic(uuid, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinics'] }),
  });
};

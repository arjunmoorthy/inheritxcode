import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';

export interface ClinicItem {
  id?: number;
  uuid: string;
  name: string;
  address?: string;
  phone?: string | null;
  fax?: string | null;
  department?: string;
}

interface ClinicsResponse {
  clinics?: Array<{
    uuid: string;
    clinic_name: string;
    clinic_address?: string | null;
    phone_number?: string | null;
    fax_number?: string | null;
    department?: string | null;
  }>;
  total?: number;
  skip?: number;
  limit?: number;
}

interface ClinicPayload {
  clinic_name: string;
  clinic_address: string;
  phone_number?: string;
  fax_number?: string;
}

const getClinics = async (): Promise<ClinicItem[]> => {
  const response = await apiClient.get<ClinicItem[] | ClinicsResponse>(API_CONFIG.ENDPOINTS.CLINICS.LIST);
  const data = response.data as any;
  const clinicsFromResponse =
    (Array.isArray(data?.clinics) && data.clinics) ||
    (Array.isArray(data?.data?.clinics) && data.data.clinics) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data) && data) ||
    [];

  if (Array.isArray(clinicsFromResponse)) {
    return clinicsFromResponse.map((clinic: any, idx: number) => ({
      id: clinic?.id ?? idx + 1,
      uuid: String(clinic?.uuid ?? ''),
      name: clinic?.clinic_name ?? clinic?.name ?? '',
      address: clinic?.clinic_address ?? clinic?.address ?? '',
      phone: clinic?.phone_number ?? clinic?.phone ?? null,
      fax: clinic?.fax_number ?? clinic?.fax ?? null,
      department: clinic?.department ?? '',
    }));
  }

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

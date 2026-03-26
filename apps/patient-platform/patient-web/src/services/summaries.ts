import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';
import { getPatientUuid } from '../utils/patientUuid';

export interface Summary {
  uuid: string;
  overall_feeling: string | null;
  created_at: string;
  bulleted_summary: string;
  longer_summary: string;
  symptom_list?: string[];
  severity_list?: any[] | { [key: string]: any };
  medication_list?: any[];
  triage_level?: string;
  personal_notes?: string;
  conversation_state?: string;
  // Add other fields as needed
}

const fetchSummaries = async (year: number, month: number): Promise<{ data: Summary[] }> => {
  const response = await apiClient.get<Summary[]>(
    API_CONFIG.ENDPOINTS.SUMMARIES.BY_MONTH(year, month)
  );
  // Wrap the array in { data: [] } to match component expectations
  return { data: response.data || [] };
};

export const useSummaries = (year: number, month: number) => {
  return useQuery({
    queryKey: ['summaries', year, month],
    queryFn: () => fetchSummaries(year, month),
    enabled: !!year && !!month,
  });
};

const fetchRecentSummaries = async (limit: number = 10): Promise<{ data: Summary[] }> => {
  const patientUuid = getPatientUuid();
  if (!patientUuid) return { data: [] };
  
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await apiClient.get<Summary[]>(
    `${API_CONFIG.ENDPOINTS.SUMMARIES.RECENT}?patient_uuid=${encodeURIComponent(patientUuid)}&timezone=${encodeURIComponent(timezone)}&limit=${limit}`
  );
  return { data: response.data || [] };
};

export const useRecentSummaries = (limit: number = 10) => {
  return useQuery({
    queryKey: ['summaries', 'recent', limit],
    queryFn: () => fetchRecentSummaries(limit),
  });
};


const fetchSummaryDetails = async (summaryId: string): Promise<Summary> => {
  try {
    const patientUuid = getPatientUuid();
    if (!patientUuid) throw new Error('Patient UUID not found');
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const url = `${API_CONFIG.ENDPOINTS.SUMMARIES.DETAIL(summaryId)}?patient_uuid=${encodeURIComponent(patientUuid)}&timezone=${encodeURIComponent(timezone)}`;
    
    const response = await apiClient.get<Summary>(url);
    return response.data;
  } catch (error) {
    console.error('Summary Details API Error:', error);
    throw error;
  }
};

export const useSummaryDetails = (summaryId: string) => {
    return useQuery({
        queryKey: ['summaryDetails', summaryId],
        queryFn: () => fetchSummaryDetails(summaryId),
        enabled: !!summaryId,
    });
};
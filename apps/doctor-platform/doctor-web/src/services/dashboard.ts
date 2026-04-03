/**
 * =============================================================================
 * Dashboard Service - Doctor Portal
 * =============================================================================
 * 
 * Module:      dashboard.ts
 * Description: API service for dashboard and analytics endpoints. Handles
 *              patient ranking, symptom timelines, and weekly reports.
 * 
 * Created:     2025-12-28
 * Modified:    2026-01-16
 * Author:      Naveen Babu S A
 * Version:     2.1.0
 * 
 * Endpoints Used:
 *   GET  /api/v1/dashboard            - Ranked patient list
 *   GET  /api/v1/dashboard/patient/:id - Patient detail with timeline
 *   GET  /api/v1/dashboard/reports/weekly - Weekly report data
 * 
 * Copyright:
 *   (c) 2026 OncoLife Health Technologies. All rights reserved.
 * =============================================================================
 */

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../utils/apiClient';
import { API_CONFIG } from '../config/api';

// =============================================================================
// Types
// =============================================================================

// API response from /dashboard/patient-listing-dashboard
export interface PatientListingApiItem {
  patient_id: number;
  patient_uuid?: string | null;
  uuid?: string | null;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  age: number;
  phone_number: string;
  email: string;
  /** Medical Record Number from API when available */
  mrn?: string | null;
  plan_name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  /** Diagnosis/cancer type from API when available */
  diagnosis?: string | null;
  cancer_type?: string | null;
  disease_type?: string | null;
  /** Last chemotherapy date from API */
  last_chemo_date?: string | null;
  location?: string | null;
  assigned_oncologist?: string | null;
  day_of_chemotherapy_treatment?: string | null;
  next_chemotherapy_treatment?: string | null;
  past_medical_history?: string | null;
  past_surgical_history?: string | null;
}

export interface PatientListingApiResponse {
  status: string;
  data: PatientListingApiItem[];
}

export interface PatientSummary {
  id: string;
  patientUuid?: string;
  patientName: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth: string;
  mrn: string;
  gender: string;
  startDate: string;
  endDate: string;
  symptoms: string;
  summary: string;
  lastUpdated: string;
  status: 'active' | 'inactive' | 'pending';
  priority: 'high' | 'medium' | 'low';
  maxSeverity: 'mild' | 'moderate' | 'severe' | 'urgent' | null;
  hasEscalation: boolean;
  severityBadge: string;
  email?: string;
  phoneNumber?: string;
  /** Diagnosis/cancer type from API when available */
  diagnosis?: string | null;
  /** Last chemotherapy date from API when available */
  lastChemoDate?: string | null;
  location?: string | null;
  assignedOncologist?: string | null;
  dayOfChemotherapyTreatment?: string | null;
  nextChemotherapyTreatment?: string | null;
  pastMedicalHistory?: string | null;
  pastSurgicalHistory?: string | null;
  plan_name?: string;
}

export interface PatientRanking {
  patient_uuid: string;
  first_name: string | null;
  last_name: string | null;
  email_address: string | null;
  last_checkin: string | null;
  max_severity: string | null;
  has_escalation: boolean;
  severity_badge: string;
}

export interface DashboardLanding {
  patients: PatientRanking[];
  total_patients: number;
  period_days: number;
}

export interface SymptomDataPoint {
  date: string | null;
  severity: string;
  severity_numeric: number;
}

export interface SeveritySeriesPoint {
  date: string;
  value: string;
}

export interface SeveritySeriesItem {
  symptom_id: string;
  symptom_name: string;
  points: SeveritySeriesPoint[];
}

export interface TemperatureSeriesPoint {
  date: string;
  value: number;
}

export interface MedicationItem {
  date: string;
  symptom_id: string;
  symptom_name: string;
  severity: string;
  medication_name: string;
  medication_frequency: string | null;
  severity_after_medication: string | null;
}

export interface TreatmentEvent {
  event_type: string;
  event_date: string | null;
  metadata: Record<string, unknown>;
}

export interface PatientTimeline {
  patient_uuid: string;
  start_date: string;
  end_date: string;
  severity_series: SeveritySeriesItem[];
  temperature_series: TemperatureSeriesPoint[];
  medications: MedicationItem[];
  chemo_dates?: string[];
  last_chemo_date?: string | null;
}

export interface SharedQuestion {
  id: string;
  question_text: string;
  category: string | null;
  is_answered: boolean;
  created_at: string | null;
}

export interface SharedQuestionsApiResponse {
  status: string;
  data: SharedQuestion[];
}

export interface WeeklyReportSummary {
  report_id: string | null;
  physician_id: string;
  report_week_start: string;
  report_week_end: string;
  generated_at: string;
  patient_count: number;
  total_alerts: number;
  total_questions: number;
}

export interface PatientReportSection {
  patient: Record<string, unknown>;
  symptoms: Record<string, unknown>;
  alerts: Array<Record<string, unknown>>;
  questions: Array<Record<string, unknown>>;
}

export interface WeeklyReportData {
  physician_id: string;
  report_week_start: string;
  report_week_end: string;
  generated_at: string;
  patient_count: number;
  total_alerts: number;
  total_questions: number;
  patients: PatientReportSection[];
}

export interface DashboardResponse {
  data: PatientSummary[];
  total: number;
  page: number;
  totalPages: number;
}

// =============================================================================
// Transform Functions
// =============================================================================



/*
// Helper function to transform patient ranking items to summary format
const transformPatientRankingToSummary = (ranking: PatientRanking): PatientSummary => ({
  id: ranking.patient_uuid,
  patientUuid: ranking.patient_uuid,
  patientName: `${ranking.first_name || ''} ${ranking.last_name || ''}`.trim() || 'Unknown',
  firstName: ranking.first_name || undefined,
  lastName: ranking.last_name || undefined,
  dateOfBirth: '',
  mrn: '',
  symptoms: '',
  summary: ranking.has_escalation ? 'urgent escalation' : (ranking.max_severity || ''),
  lastUpdated: ranking.last_checkin || '',
  status: 'active',
  priority: mapSeverityToPriority(ranking.max_severity),
  // Pass through severity data from API
  maxSeverity: (ranking.max_severity as 'mild' | 'moderate' | 'severe' | 'urgent') || null,
  hasEscalation: ranking.has_escalation,
  severityBadge: ranking.severity_badge,
});
*/

// =============================================================================
// API Functions
// =============================================================================

// Fetch patient listing from dashboard endpoint (search is passed as API query param)
const fetchPatientListingDashboard = async (
  search?: string | null,
  physicianIds?: (string | number)[] | null
): Promise<PatientListingApiResponse> => {
  const searchTrimmed = typeof search === 'string' ? search.trim() : '';
  const params = new URLSearchParams();
  if (searchTrimmed) params.set('search', searchTrimmed);
  
  if (physicianIds && physicianIds.length > 0) {
    physicianIds.forEach(id => {
      if (id !== 'all') params.append('physician_ids', String(id));
    });
  }

  const query = params.toString();
  const url = query
    ? `${API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_LISTING_DASHBOARD}?${query}`
    : API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_LISTING_DASHBOARD;
  const response = await apiClient.get<PatientListingApiResponse>(url);
  return response.data;
};

// Transform API item to PatientSummary for dashboard display
const transformListingToSummary = (item: PatientListingApiItem): PatientSummary => ({
  id:
    (item.patient_uuid && String(item.patient_uuid)) ||
    (item.uuid && String(item.uuid)) ||
    String(item.patient_id),
  patientUuid:
    (item.patient_uuid && String(item.patient_uuid)) ||
    (item.uuid && String(item.uuid)) ||
    undefined,
  patientName: `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown',
  firstName: item.first_name || undefined,
  gender: item.gender || '',
  lastName: item.last_name || undefined,
  dateOfBirth: item.date_of_birth || '',
  mrn: (item.mrn && String(item.mrn)) || String(item.patient_id),
  symptoms: '—',
  summary: item.plan_name || '—',
  lastUpdated: item.created_at || '',
  status: 'active',
  priority: 'medium',
  maxSeverity: null,
  hasEscalation: false,
  severityBadge: '',
  email: item.email || undefined,
  phoneNumber: item.phone_number || undefined,
  diagnosis: item.diagnosis ?? item.cancer_type ?? item.disease_type ?? undefined,
  lastChemoDate: item.last_chemo_date ?? null,
  startDate: item.start_date || '',
  endDate: item.end_date || '',
  location: item.location || undefined,
  assignedOncologist: item.assigned_oncologist || undefined,
  dayOfChemotherapyTreatment: item.day_of_chemotherapy_treatment || undefined,
  nextChemotherapyTreatment: item.next_chemotherapy_treatment || undefined,
  pastMedicalHistory: item.past_medical_history || undefined,
  pastSurgicalHistory: item.past_surgical_history || undefined,
  plan_name: item.plan_name || undefined,
});

// Fetch dashboard landing (ranked patient list)
const fetchDashboardLanding = async (days: number = 7): Promise<DashboardLanding> => {
  try {
    const response = await apiClient.get<DashboardLanding>(
      `${API_CONFIG.ENDPOINTS.DASHBOARD.LANDING}?days=${days}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard landing:', error);
    return {
      patients: [],
      total_patients: 0,
      period_days: days,
    };
  }
};

// Fetch patient summaries from patient-listing-dashboard endpoint (search via API param)
const fetchPatientSummaries = async (
  page: number = 1, 
  search: string = '', 
  filter: string = 'all',
  physicianIds?: (string | number)[] | null
): Promise<DashboardResponse> => {
  try {
    const listingResponse = await fetchPatientListingDashboard(search, physicianIds);
    const apiData = listingResponse?.data || [];
    let patients = apiData.map(transformListingToSummary);
    
    // Apply status filter
    if (filter && filter !== 'all') {
      patients = patients.filter(patient => patient.status === filter);
    }
    
    return {
      data: patients,
      total: patients.length,
      page,
      totalPages: patients.length > 0 ? 1 : 0,
    };
  } catch (error) {
    console.error('Error fetching patient summaries:', error);
    return {
      data: [],
      total: 0,
      page: 1,
      totalPages: 0,
    };
  }
};

// Fetch patient timeline data
const fetchPatientTimeline = async (
  patientUuid: string,
  startDate?: string,
  endDate?: string
): Promise<PatientTimeline> => {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const query = params.toString();
    const response = await apiClient.get<PatientTimeline>(
      `${API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_TIMELINE(patientUuid)}/trends${query ? `?${query}` : ''}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching patient timeline:', error);
    const today = new Date().toISOString().split('T')[0];
    return {
      patient_uuid: patientUuid,
      start_date: startDate || today,
      end_date: endDate || today,
      severity_series: [],
      temperature_series: [],
      medications: [],
      chemo_dates: [],
      last_chemo_date: null,
    };
  }
};

// Fetch patient's shared questions
const fetchPatientQuestions = async (patientUuid: string, limit?: number): Promise<SharedQuestion[]> => {
  try {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    const response = await apiClient.get<SharedQuestionsApiResponse>(
      `${API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_QUESTIONS(patientUuid)}${query ? `?${query}` : ''}`
    );
    return response.data?.data || [];
  } catch (error) {
    console.error('Error fetching patient questions:', error);
    return [];
  }
};

// Fetch weekly reports list
const fetchReportsList = async (): Promise<WeeklyReportSummary[]> => {
  try {
    const response = await apiClient.get<WeeklyReportSummary[]>(
      API_CONFIG.ENDPOINTS.DASHBOARD.REPORTS_LIST
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching reports list:', error);
    return [];
  }
};

// Fetch weekly report data
const fetchWeeklyReportData = async (weekStart?: string): Promise<WeeklyReportData> => {
  try {
    const url = weekStart 
      ? `${API_CONFIG.ENDPOINTS.DASHBOARD.REPORTS_WEEKLY}?week_start=${weekStart}`
      : API_CONFIG.ENDPOINTS.DASHBOARD.REPORTS_WEEKLY;
    const response = await apiClient.get<WeeklyReportData>(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching weekly report:', error);
    const now = new Date();
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - now.getDay());
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    
    return {
      physician_id: '',
      report_week_start: weekStartDate.toISOString().split('T')[0],
      report_week_end: weekEndDate.toISOString().split('T')[0],
      generated_at: new Date().toISOString(),
      patient_count: 0,
      total_alerts: 0,
      total_questions: 0,
      patients: [],
    };
  }
};

// Generate weekly report
const generateWeeklyReport = async (weekStart?: string): Promise<{ report_id: string }> => {
  const response = await apiClient.post<{ report_id: string }>(
    API_CONFIG.ENDPOINTS.DASHBOARD.REPORTS_GENERATE,
    { week_start: weekStart }
  );
  return response.data;
};

// Send Patient Fax
const sendPatientFax = async (patientUuid: string): Promise<unknown> => {
  const response = await apiClient.post(
    API_CONFIG.ENDPOINTS.DASHBOARD.PATIENT_FAX_SEND(patientUuid),
    {}
  );
  return response.data;
};

// =============================================================================
// React Query Hooks
// =============================================================================

export const useDashboardLanding = (days: number = 7) => {
  return useQuery({
    queryKey: ['dashboardLanding', days],
    queryFn: () => fetchDashboardLanding(days),
  });
};

export const usePatientSummaries = (
  page: number = 1, 
  search: string = '', 
  filter: string = 'all',
  physicianIds?: (string | number)[] | null
) => {
  return useQuery({
    queryKey: ['patientSummaries', page, search, filter, physicianIds],
    queryFn: () => fetchPatientSummaries(page, search, filter, physicianIds),
    placeholderData: keepPreviousData,
  });
};

export const usePatientTimeline = (
  patientUuid: string,
  startDate?: string,
  endDate?: string
) => {
  return useQuery({
    queryKey: ['patientTimeline', patientUuid, startDate, endDate],
    queryFn: () => fetchPatientTimeline(patientUuid, startDate, endDate),
    enabled: !!patientUuid,
  });
};

export const usePatientQuestions = (patientUuid: string, limit?: number) => {
  return useQuery({
    queryKey: ['patientQuestions', patientUuid, limit],
    queryFn: () => fetchPatientQuestions(patientUuid, limit),
    enabled: !!patientUuid,
  });
};

export const useReportsList = () => {
  return useQuery({
    queryKey: ['reportsList'],
    queryFn: fetchReportsList,
  });
};

export const useWeeklyReportData = (weekStart?: string) => {
  return useQuery({
    queryKey: ['weeklyReport', weekStart],
    queryFn: () => fetchWeeklyReportData(weekStart),
  });
};

export const useGenerateReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateWeeklyReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportsList'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyReport'] });
    },
  });
};

export const useSendPatientFax = () => {
  return useMutation({
    mutationFn: sendPatientFax,
    onSuccess: () => {
      // Logic for success if needed
    },
  });
};

// Legacy hook for backwards compatibility
export const usePatientDetails = (patientId: string) => {
  return useQuery({
    queryKey: ['patientDetails', patientId],
    queryFn: async (): Promise<PatientSummary> => {
      const listing = await fetchPatientListingDashboard();
      const matchedPatient = (listing?.data || []).find((item) => {
        const candidateUuid = (item.patient_uuid && String(item.patient_uuid)) || (item.uuid && String(item.uuid));
        return candidateUuid === patientId || String(item.patient_id) === patientId;
      });

      if (matchedPatient) {
        return transformListingToSummary(matchedPatient);
      }

      const timeline = await fetchPatientTimeline(patientId);
      return {
        id: timeline.patient_uuid,
        patientUuid: timeline.patient_uuid,
        patientName: '',
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        mrn: '',
        symptoms: timeline.severity_series.map((item) => item.symptom_name).join(', '),
        summary: '',
        lastUpdated: '',
        gender: '',
        endDate: '',
        startDate: '',
        status: 'active',
        priority: 'medium',
        maxSeverity: null,
        hasEscalation: false,
        severityBadge: '',
        phoneNumber: '',
        lastChemoDate: null,
      };
    },
    enabled: !!patientId,
  });
};

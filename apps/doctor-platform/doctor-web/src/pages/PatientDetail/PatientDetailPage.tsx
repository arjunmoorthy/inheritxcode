/**
 * Patient Detail Page - Patient Dashboard
 * =======================================
 * 
 * Detailed view of a patient with:
 * - Header with action buttons
 * - Left sidebar with filters (dates, symptoms, severity)
 * - Main content area with symptom/temperature graph
 * - Table data section
 * - Full responsive design
 * - Dark mode support
 * */

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaQuery, Snackbar, Dialog, DialogTitle, DialogContent, Button } from '@mui/material';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';
import {
  usePatientTimeline,
  usePatientDetails,
  usePatientQuestions,
  useSendPatientFax,
} from '../../services/dashboard';
import { useCurrentStaffProfile } from '../../services/staff';
import { useClinics } from '../../services/clinics';

export type PatientProfile = {
  mrn: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  regimenName: string;
  dayOfChemotherapy: string;
  nextChemotherapyTreatment: string;
  startDate: string;
  endDate: string;
  location: string;
  assignedOncologist: string;
  dayOfChemotherapyTreatment: string;
  pastMedicalHistory: string;
  pastSurgicalHistory: string;
  diagnosis: string;
};

// Components
import PatientDetailHeader from './components/PatientDetailHeader';
import FiltersSidebar from './components/FiltersSidebar';
import GraphSection from './components/GraphSection';
import PatientDataTable from './components/PatientDataTable';
import PatientTabs from './components/PatientTabs';
import { PatientFormModal } from '../Patients/components/PatientFormModal';
import type { Patient } from '../../services/patients';

// Symptom colors matching the image
const symptomColors: Record<string, string> = {
  'cough': '#FF9500',      // Orange
  'fever': '#EAB308',       // Yellow
  'pain': '#10B981',        // Green
  'vomiting': '#06B6D4',    // Light Blue
  'diarrhea': '#14B8A6',    // Teal
  'appetite loss': '#F97316', // Deep Orange
  'constipation': '#2563EB', // Dark Blue
  'shortness of breath': '#0EA5E9', // Sky Blue
  'headache': '#8B5CF6',    // Purple
  'dizziness': '#A855F7',   // Violet
  'insomnia': '#6366F1',    // Indigo
  'mouth sores': '#EC4899', // Pink
  'fatigue': '#8B5CF6',     // Purple
  'nausea': '#EC4899',      // Pink
  'temperature': '#EF4444', // Red
};

const fallbackSymptomPalette = [
  '#22C55E', // green
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#A855F7', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
];

const getSymptomColor = (symptomName: string) => {
  const key = toSymptomKey(symptomName);
  const mapped = symptomColors[key];
  if (mapped) return mapped;

  // Stable color selection for unknown/new symptom names.
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackSymptomPalette[hash % fallbackSymptomPalette.length];
};

const severityValueMap: Record<string, number> = {
  relieved: 0,
  none: 0,
  normal: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
  'very severe': 4,
  urgent: 4,
};

const toSymptomKey = (name: string) => name.trim().toLowerCase();
const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());
const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const parseIsoDateAsLocal = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};
const getWeekdayFromIsoDate = (dateStr?: string | null) => {
  if (!dateStr) return '--';
  const parsed = parseIsoDateAsLocal(dateStr);
  if (!parsed) return '--';
  return parsed.toLocaleDateString('en-US', { weekday: 'long' });
};
const splitPatientName = (fullName?: string) => {
  const normalized = (fullName || '').trim();
  if (!normalized) return { firstName: '--', lastName: '--' };
  const [firstName, ...lastNameParts] = normalized.split(/\s+/);
  return {
    firstName: firstName || '--',
    lastName: lastNameParts.join(' ') || '--',
  };
};
const buildDateRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const shiftIsoDate = (date: string, offsetDays: number) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + offsetDays);
  return toIsoDate(parsed);
};

const clampDate = (date: string, minDate: string, maxDate: string) => {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
};

const buildFocusedTimelineDates = (timelineData: {
  start_date: string;
  end_date: string;
  severity_series: Array<{ points: Array<{ date: string }> }>;
  temperature_series: Array<{ date: string }>;
}) => {
  const observedDates: string[] = [];
  timelineData.severity_series.forEach((series) => {
    series.points.forEach((point) => {
      if (point.date) observedDates.push(point.date);
    });
  });
  timelineData.temperature_series.forEach((point) => {
    if (point.date) observedDates.push(point.date);
  });

  if (!observedDates.length) {
    return buildDateRange(timelineData.start_date, timelineData.end_date);
  }

  observedDates.sort();
  const minObservedDate = observedDates[0];
  const paddedStart = clampDate(
    shiftIsoDate(minObservedDate, -2),
    timelineData.start_date,
    timelineData.end_date
  );
  const paddedEnd = timelineData.end_date;

  return buildDateRange(paddedStart, paddedEnd);
};

const fillSymptomSeriesByDate = (
  dates: string[],
  points: Array<{ date: string; value: string }>
) => {
  if (points.length <= 1) return points;

  const valueByDate = new Map(points.map((point) => [point.date, point.value] as const));
  const sortedInputDates = points.map((point) => point.date).sort();
  const firstDate = sortedInputDates[0];
  const lastDate = sortedInputDates[sortedInputDates.length - 1];
  let lastKnownValue: string | undefined;

  return dates
    .filter((date) => date >= firstDate && date <= lastDate)
    .map((date) => {
      const exactValue = valueByDate.get(date);
      if (exactValue) {
        lastKnownValue = exactValue;
      }

      if (!lastKnownValue) return null;
      return { date, value: lastKnownValue };
    })
    .filter((item): item is { date: string; value: string } => item !== null);
};

const fillTemperatureSeriesByDate = (
  dates: string[],
  points: Array<{ date: string; value: number }>
) => {
  if (points.length <= 1) return points;
  const sortedPoints = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = sortedPoints[0].date;
  const lastDate = sortedPoints[sortedPoints.length - 1].date;

  const dateToIndex = new Map(dates.map((date, idx) => [date, idx] as const));

  const interpolateValue = (date: string) => {
    for (let i = 0; i < sortedPoints.length - 1; i += 1) {
      const current = sortedPoints[i];
      const next = sortedPoints[i + 1];
      if (date < current.date || date > next.date) continue;

      const currentIdx = dateToIndex.get(current.date);
      const nextIdx = dateToIndex.get(next.date);
      const targetIdx = dateToIndex.get(date);
      if (
        typeof currentIdx !== 'number' ||
        typeof nextIdx !== 'number' ||
        typeof targetIdx !== 'number' ||
        nextIdx === currentIdx
      ) {
        return current.value;
      }

      const ratio = (targetIdx - currentIdx) / (nextIdx - currentIdx);
      return current.value + (next.value - current.value) * ratio;
    }
    return sortedPoints[sortedPoints.length - 1].value;
  };

  return dates
    .filter((date) => date >= firstDate && date <= lastDate)
    .map((date) => {
      const exact = sortedPoints.find((point) => point.date === date);
      return {
        date,
        value: typeof exact?.value === 'number' ? exact.value : interpolateValue(date),
      };
    });
};

// TODO: Temporary static timeline payload for UI demo.
// Remove this and use API response (`timeline`) after backend stabilizes.
const USE_STATIC_TIMELINE = false;
const STATIC_TIMELINE_DATA = {
  patient_uuid: '83669f94-fe4d-4b8b-8a1d-b90479f988ea',
  start_date: '2026-02-28',
  end_date: '2026-03-19',
  severity_series: [
    {
      symptom_id: 'COU-215',
      symptom_name: 'Cough',
      points: [
        { date: '2026-02-28', value: 'mild' },
        { date: '2026-03-02', value: 'mild' },
        { date: '2026-03-04', value: 'moderate' },
        { date: '2026-03-07', value: 'moderate' },
        { date: '2026-03-10', value: 'severe' },
        { date: '2026-03-13', value: 'moderate' },
        { date: '2026-03-16', value: 'severe' },
        { date: '2026-03-19', value: 'moderate' },
      ],
    },
    {
      symptom_id: 'FEV-202',
      symptom_name: 'Fever',
      points: [
        { date: '2026-03-01', value: 'mild' },
        { date: '2026-03-03', value: 'moderate' },
        { date: '2026-03-06', value: 'mild' },
        { date: '2026-03-09', value: 'moderate' },
        { date: '2026-03-12', value: 'mild' },
        { date: '2026-03-15', value: 'moderate' },
        { date: '2026-03-18', value: 'mild' },
        { date: '2026-03-19', value: 'mild' },
      ],
    },
    {
      symptom_id: 'NAU-203',
      symptom_name: 'Nausea',
      points: [
        { date: '2026-03-01', value: 'mild' },
        { date: '2026-03-05', value: 'mild' },
        { date: '2026-03-08', value: 'moderate' },
        { date: '2026-03-11', value: 'mild' },
        { date: '2026-03-14', value: 'moderate' },
        { date: '2026-03-17', value: 'moderate' },
        { date: '2026-03-19', value: 'moderate' },
      ],
    },
    {
      symptom_id: 'URG-103',
      symptom_name: 'URG-103',
      points: [
        { date: '2026-03-02', value: 'mild' },
        { date: '2026-03-06', value: 'mild' },
        { date: '2026-03-10', value: 'moderate' },
        { date: '2026-03-14', value: 'mild' },
        { date: '2026-03-18', value: 'moderate' },
        { date: '2026-03-19', value: 'mild' },
      ],
    },
    {
      symptom_id: 'VOM-204',
      symptom_name: 'Vomiting',
      points: [
        { date: '2026-03-01', value: 'mild' },
        { date: '2026-03-04', value: 'moderate' },
        { date: '2026-03-07', value: 'mild' },
        { date: '2026-03-10', value: 'moderate' },
        { date: '2026-03-13', value: 'moderate' },
        { date: '2026-03-16', value: 'moderate' },
        { date: '2026-03-19', value: 'moderate' },
      ],
    },
  ],
  temperature_series: [
    { date: '2026-02-28', value: 98.4 },
    { date: '2026-03-01', value: 98.8 },
    { date: '2026-03-02', value: 99.2 },
    { date: '2026-03-03', value: 99.6 },
    { date: '2026-03-04', value: 98.9 },
    { date: '2026-03-05', value: 99.4 },
    { date: '2026-03-06', value: 98.7 },
    { date: '2026-03-07', value: 99.1 },
    { date: '2026-03-08', value: 99.8 },
    { date: '2026-03-09', value: 100.2 },
    { date: '2026-03-10', value: 99.7 },
    { date: '2026-03-11', value: 99.3 },
    { date: '2026-03-12', value: 98.9 },
    { date: '2026-03-13', value: 99.6 },
    { date: '2026-03-14', value: 100.0 },
    { date: '2026-03-15', value: 99.4 },
    { date: '2026-03-16', value: 100.1 },
    { date: '2026-03-17', value: 99.5 },
    { date: '2026-03-18', value: 98.9 },
    { date: '2026-03-19', value: 98.3 },
  ],
  medications: [
    {
      date: '2026-03-19',
      symptom_id: 'VOM-204',
      symptom_name: 'Vomiting',
      severity: 'moderate',
      medication_name: 'Zofran (ondansetron) 8 mg every 8 hours',
      medication_frequency: null,
      severity_after_medication: 'mild',
    },
    {
      date: '2026-03-19',
      symptom_id: 'NAU-203',
      symptom_name: 'Nausea',
      severity: 'moderate',
      medication_name: 'Zofran (ondansetron) 8 mg every 8 hours',
      medication_frequency: null,
      severity_after_medication: 'mild',
    },
    {
      date: '2026-03-18',
      symptom_id: 'FEV-202',
      symptom_name: 'Fever',
      severity: 'mild',
      medication_name: 'Paracetamol 650 mg',
      medication_frequency: 'Every 6 hours as needed',
      severity_after_medication: 'relieved',
    },
    {
      date: '2026-03-16',
      symptom_id: 'COU-215',
      symptom_name: 'Cough',
      severity: 'severe',
      medication_name: 'Dextromethorphan syrup 10 ml',
      medication_frequency: 'Twice daily',
      severity_after_medication: 'moderate',
    },
  ],
  chemo_dates: ['2026-03-19'],
  last_chemo_date: '2026-03-19',
};

const PatientDetailPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery('(max-width:768px)');

  // Sidebar collapse state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Fullscreen chart state
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);

  // Fax mode state
  const FAX_CALLBACK_URL = 'https://webhook.site/acf434d1-2f2e-4455-a51f-260da5ae0687';
  const [isFaxMode, setIsFaxMode] = useState(false);
  const [isFaxPreviewOpen, setIsFaxPreviewOpen] = useState(false);
  const [editableClinicName, setEditableClinicName] = useState('');
  const [editableClinicFax, setEditableClinicFax] = useState('');
  const [selectedClinicUuid, setSelectedClinicUuid] = useState('');

  // Filter states
  const defaultStartDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }, []);
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['all']);
  const [severityRange, setSeverityRange] = useState<number[]>([2, 4]);

  // Notification state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    open: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ open: true, message, type });
  };

  const handleCloseToast = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setToast(prev => ({ ...prev, open: false }));
  };

  // Table pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Patient Profile Modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Patient Profile static data
  const [patientProfile, setPatientProfile] = useState<PatientProfile>({
    mrn: '001',
    firstName: 'Bobby',
    lastName: 'Johnson',
    email: 'bobby.johnson@email.com',
    phone: '(555) 123-4567',
    dateOfBirth: '1967-03-15',
    gender: 'Male',
    regimenName: 'Carboplatin + Pemetrexed',
    dayOfChemotherapy: 'Wednesday',
    nextChemotherapyTreatment: '',
    startDate: '',
    endDate: '',
    location: 'Boston, MA',
    assignedOncologist: '',
    dayOfChemotherapyTreatment: '',
    pastMedicalHistory: '',
    pastSurgicalHistory: '',
    diagnosis: '',
  });

  // Fetch data
  const {
    data: timeline,
    isLoading: timelineLoading,
    isFetching: timelineFetching,
    refetch: refetchTimeline,
  } = usePatientTimeline(uuid || '', startDate, endDate);
  const { data: clinics = [], isLoading: isLoadingClinics } = useClinics(isFaxPreviewOpen);
  const {
    data: patientDetails,
    isFetching: patientDetailsFetching,
    refetch: refetchPatientDetails,
  } = usePatientDetails(uuid || '');

  const {
    data: questions,
    isLoading: questionsLoading,
    isFetching: questionsFetching,
    refetch: refetchQuestions,
  } = usePatientQuestions(uuid || '', 50);

  const { mutateAsync: sendPatientFax, isPending: isSendingFax } = useSendPatientFax();
  const { data: currentStaffProfile } = useCurrentStaffProfile(true);

  useEffect(() => {
    if (!currentStaffProfile) return;
    console.log('Fax popup staff profile data:', currentStaffProfile);
  }, [currentStaffProfile]);

  // Static payload is kept only for temporary debugging.
  const timelineData = USE_STATIC_TIMELINE ? STATIC_TIMELINE_DATA : timeline;

  const patientForModal: Patient | null = useMemo(() => {
    if (!patientDetails) return null;
    return {
      id: uuid || '',
      uuid: uuid || '',
      firstName: patientProfile.firstName,
      lastName: patientProfile.lastName,
      email: patientProfile.email,
      phoneNumber: patientProfile.phone,
      mrn: patientProfile.mrn,
      dateOfBirth: patientProfile.dateOfBirth,
      sex: (patientDetails as any).gender || 'Other',
      race: '',
      physician: (patientDetails as any).physician || '',
      diseaseType: (patientDetails as any).diagnosis || '',
      associateClinic: 'Honor Health Cancer Care - Deer Valley',
      treatmentType: patientDetails.summary || '',
      plan_name: (patientDetails as any).plan_name || patientDetails.summary || '',
      start_date: (patientDetails as any).startDate || '',
      end_date: (patientDetails as any).endDate || '',
      location: (patientDetails as any).location || '',
      assigned_oncologist: (patientDetails as any).assignedOncologist || '',
      day_of_chemotherapy_treatment: (patientDetails as any).dayOfChemotherapyTreatment || '',
      next_chemotherapy_treatment: (patientDetails as any).nextChemotherapyTreatment || '',
      past_medical_history: (patientDetails as any).pastMedicalHistory || '',
      past_surgical_history: (patientDetails as any).pastSurgicalHistory || '',
      diagnosis: (patientDetails as any).diagnosis || '',
      physician_ids: (patientDetails as any).physician_ids,
      regimen_code: (patientDetails as any).regimenCode || '',
      stage: (patientDetails as any).stage || ''
    };
  }, [patientProfile, patientDetails, uuid]);

  const symptomOptions = useMemo(() => {
    const apiSymptoms = (timelineData?.severity_series || []).map((series) => {
      return {
        id: toSymptomKey(series.symptom_name),
        label: toTitleCase(series.symptom_name),
        color: getSymptomColor(series.symptom_name),
      };
    });
    return [{ id: 'all', label: 'All Symptoms', color: null }, ...apiSymptoms];
  }, [timelineData]);

  const handleBack = () => {
    navigate('/dashboard');
  };
  const handleRefreshDashboard = async () => {
    try {
      await Promise.all([
        refetchTimeline(),
        refetchPatientDetails(),
        refetchQuestions()
      ]);
      showToast('Dashboard updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to update dashboard.', 'error');
    }
  };

  const handleFaxClick = async () => {
    if (!isFaxMode) {
      setIsFaxMode(true);
      setIsFaxPreviewOpen(true);
    } else {
      try {
        const faxNumber = (editableClinicFax || '').trim();

        if (!uuid) {
          showToast('Patient UUID is missing.', 'error');
          return;
        }
        if (!faxNumber) {
          showToast('Fax number is required.', 'error');
          return;
        }

        await sendPatientFax({
          patientUuid: uuid,
          to: faxNumber,
          callbackUrl: FAX_CALLBACK_URL,
          days: 30,
        });
        showToast('Fax sent successfully!', 'success');
        setIsFaxMode(false);
        setIsFaxPreviewOpen(false);
      } catch (err) {
        console.error('Fax error:', err);
        showToast('Failed to send fax. Please try again.', 'error');
      }
    }
  };

  const handleCloseFaxPreview = () => {
    setIsFaxPreviewOpen(false);
    setIsFaxMode(false);
  };

  const clinicInfo = useMemo(() => {
    if (currentStaffProfile) {
      return {
        clinicName: currentStaffProfile.clinic_name || '--',
        clinicPhone: currentStaffProfile.clinic_fax || '--',
      };
    }
    try {
      const stored = localStorage.getItem('userProfile');
      const parsed = stored ? JSON.parse(stored) : {};

      console.log('parsed', parsed);
      return {
        clinicName: parsed?.clinic_name || parsed?.clinic?.name || '--',
        clinicPhone:
          parsed?.fax_number ||
          parsed?.clinic?.fax ||
          parsed?.clinic?.fax_number ||
          parsed?.clinic?.phone ||
          '--',
      };
    } catch {
      return { clinicName: '--', clinicPhone: '--' };
    }
  }, [currentStaffProfile]);

  useEffect(() => {
    if (!isFaxPreviewOpen) return;
    setEditableClinicName(clinicInfo?.clinicName || '');
    setEditableClinicFax(clinicInfo?.clinicPhone || '');
  }, [isFaxPreviewOpen, clinicInfo]);

  useEffect(() => {
    if (!isFaxPreviewOpen) return;
    const matchedClinic = clinics.find(
      (clinic) => (clinic.name || '').trim().toLowerCase() === (editableClinicName || '').trim().toLowerCase()
    );
    setSelectedClinicUuid(matchedClinic ? String(matchedClinic.uuid || matchedClinic.id) : '');
  }, [isFaxPreviewOpen, clinics, editableClinicName]);

  const formatDate = (dateStr: string) => {
    try {
      const localDate = parseIsoDateAsLocal(dateStr);
      if (!localDate) return dateStr;
      return localDate.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateShort = (dateStr: string) => {
    try {
      const localDate = parseIsoDateAsLocal(dateStr);
      if (!localDate) return dateStr;
      return localDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const tableData = useMemo(() => {
    if (!timelineData) return [];

    const dateToTemperature = new Map(
      timelineData.temperature_series.map((item) => [item.date, item.value] as const)
    );
    const severityBySymptomAndDate = new Map<string, string>();
    timelineData.severity_series.forEach((series) => {
      const symptomIdKey = series.symptom_id?.trim().toLowerCase();
      if (!symptomIdKey) return;
      series.points.forEach((point) => {
        if (!point?.date) return;
        const value = point.value?.trim();
        if (!value) return;
        severityBySymptomAndDate.set(`${symptomIdKey}|${point.date}`, value);
      });
    });
    const selectedSet = new Set(selectedSymptoms);

    const rows = timelineData.medications
      .filter((item) => selectedSymptoms.includes('all') || selectedSet.has(toSymptomKey(item.symptom_name)))
      .filter((item) => {
        const severityNumeric = severityValueMap[item.severity.toLowerCase()] ?? 0;
        return severityNumeric >= severityRange[0] && severityNumeric <= severityRange[1];
      })
      .map((item) => {
        const temperature = dateToTemperature.get(item.date);
        const severityFromSeries = severityBySymptomAndDate.get(
          `${item.symptom_id?.trim().toLowerCase()}|${item.date}`
        );
        const rawSeverity = (severityFromSeries || item.severity || '').trim();
        return {
          date: item.date,
          symptom: toTitleCase(item.symptom_name),
          severity: rawSeverity ? toTitleCase(rawSeverity) : '--',
          medicationName: item.medication_name?.trim() ? item.medication_name : '--',
          medicationFrequency: item.medication_frequency?.trim() ? item.medication_frequency : '--',
          temperature: typeof temperature === 'number' ? `${temperature.toFixed(1)}°F` : '—',
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return rows;
  }, [timelineData, selectedSymptoms, severityRange]);

  const handleDownloadReport = () => {
    if (!timelineData && !patientDetails) return;

    const escapeHtml = (value: unknown) =>
      String(value ?? '--')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const graphSvgElement = document.querySelector('[data-export-chart="patient-symptom-graph"] svg');
    const graphSvgMarkup = graphSvgElement ? graphSvgElement.outerHTML : '';
    const graphSvgForExport = graphSvgMarkup
      ? graphSvgMarkup.replace(
        '<svg',
        '<svg style="display:block;width:100%;height:auto;max-width:100%;overflow:visible" preserveAspectRatio="xMidYMid meet"'
      )
      : '';

    const rowsHtml = tableData
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td>${escapeHtml(row.symptom)}</td>
            <td>${escapeHtml(row.severity)}</td>
            <td>${escapeHtml(row.medicationName)}</td>
            <td>${escapeHtml(row.medicationFrequency)}</td>
            <td>${escapeHtml(row.temperature)}</td>
          </tr>
        `
      )
      .join('');

    const downloadedAt = new Date();
    const selectedSymptomsLabel = selectedSymptoms.includes('all')
      ? 'All Symptoms'
      : selectedSymptoms
        .map((symptomId) => symptomOptions.find((option) => option.id === symptomId)?.label || toTitleCase(symptomId))
        .join(', ');
    const graphLegendHtml = graphData.symptoms.length
      ? graphData.symptoms
        .map((symptom) => `
          <span style="display:inline-flex;align-items:center;margin:2px 10px 2px 0;font-size:12px;color:#334155;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${escapeHtml(symptom.color)};border:1px solid rgba(15,23,42,0.15);"></span>
            ${escapeHtml(symptom.name)}
          </span>
        `)
        .join('')
      : '<span style="font-size:12px;color:#64748b;">No symptom labels available</span>';

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Patient Dashboard Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            h2 { margin: 22px 0 10px; font-size: 16px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
            p { margin: 4px 0; font-size: 13px; }
            .meta { color: #475569; font-size: 12px; margin-bottom: 14px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; }
            .small { font-size: 12px; color: #475569; }
          </style>
        </head>
        <body>
          <h1>Patient Dashboard Report</h1>
          <p class="meta">Generated: ${escapeHtml(downloadedAt.toLocaleString())}</p>
          <p class="meta">Downloaded Time: ${escapeHtml(downloadedAt.toLocaleTimeString())}</p>

          <h2>Patient Details</h2>
          <div class="grid">
            <p><strong>Name:</strong> ${escapeHtml(patientDetails?.patientName || '--')}</p>
            <p><strong>MRN:</strong> ${escapeHtml(patientProfile.mrn)}</p>
            <p><strong>Email:</strong> ${escapeHtml(patientProfile.email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(patientProfile.phone)}</p>
            <p><strong>Date of Birth:</strong> ${escapeHtml(patientProfile.dateOfBirth || '--')}</p>
            <p><strong>Last Chemo Date:</strong> ${escapeHtml(timelineData?.last_chemo_date || patientDetails?.lastChemoDate || '--')}</p>
          </div>

          <h2>Applied Filters</h2>
          <div class="grid">
            <p><strong>Start Date:</strong> ${escapeHtml(startDate)}</p>
            <p><strong>End Date:</strong> ${escapeHtml(endDate)}</p>
            <p><strong>Symptoms:</strong> ${escapeHtml(selectedSymptomsLabel)}</p>
            <p><strong>Severity Range:</strong> ${escapeHtml(`${severityRange[0]} - ${severityRange[1]}`)}</p>
          </div>

          <h2>Timeline Summary</h2>
          <p class="small"><strong>Symptom Series:</strong> ${escapeHtml(timelineData?.severity_series?.length ?? 0)} | 
          <strong>Temperature Points:</strong> ${escapeHtml(timelineData?.temperature_series?.length ?? 0)} | 
          <strong>Medication Entries:</strong> ${escapeHtml(timelineData?.medications?.length ?? 0)}</p>
          
          <h2>Symptom & Temperature Graph</h2>
          <p class="small"><strong>Symptoms in Graph:</strong> ${graphLegendHtml}</p>
          ${graphSvgForExport
        ? `<div style="border:1px solid #cbd5e1; border-radius:8px; padding:10px; background:#f8fafc; overflow:visible;">${graphSvgForExport}</div>`
        : '<p class="small">Graph preview unavailable at export time.</p>'
      }

          <h2>Medications Table</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Symptom</th>
                <th>Severity</th>
                <th>Medication Name</th>
                <th>Medication Frequency</th>
                <th>Temperature</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6">No data available</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const datePart = new Date().toISOString().slice(0, 10);
      const patientNamePart = (patientDetails?.patientName || 'patient')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      link.href = url;
      link.download = `patient-dashboard-report-${patientNamePart || 'patient'}-${datePart}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Report downloaded successfully', 'success');
    } catch {
      showToast('Failed to download report', 'error');
    }
  };

  const handleSymptomToggle = (symptom: string) => {
    if (symptom === 'all') {
      setSelectedSymptoms(['all']);
    } else {
      setSelectedSymptoms(prev => {
        const newSelection = prev.includes(symptom)
          ? prev.filter(s => s !== symptom && s !== 'all')
          : [...prev.filter(s => s !== 'all'), symptom];
        return newSelection.length === 0 ? ['all'] : newSelection;
      });
    }
  };

  const handleResetFilters = () => {
    setStartDate(timelineData?.start_date || defaultStartDate);
    setEndDate(timelineData?.end_date || defaultEndDate);
    setSelectedSymptoms(['all']);
    setSeverityRange([2, 4]);
    setPage(0);
    setIsSidebarOpen(true);
  };

  // Process graph data
  const graphData = useMemo(() => {
    if (!timelineData) return { dates: [], symptoms: [] };

    const sortedDates = buildFocusedTimelineDates(timelineData);
    if (!sortedDates.length) return { dates: [], symptoms: [] };

    const selectedSet = new Set(
      selectedSymptoms.includes('all')
        ? timelineData.severity_series.map((series) => toSymptomKey(series.symptom_name))
        : selectedSymptoms
    );

    const filteredSymptoms = timelineData.severity_series
      .filter((series) => selectedSymptoms.includes('all') || selectedSet.has(toSymptomKey(series.symptom_name)))
      .map((series) => {
        const normalizedPoints = fillSymptomSeriesByDate(sortedDates, series.points);
        const points = normalizedPoints
          .map((point) => ({
            date: point.date,
            severity: point.value,
            severity_numeric: severityValueMap[point.value.toLowerCase()] ?? 0,
          }))
          .filter((point) => point.severity_numeric >= severityRange[0] && point.severity_numeric <= severityRange[1])
          .map((point) => ({
            ...point,
            dateIndex: sortedDates.indexOf(point.date),
          }))
          .filter((point) => point.dateIndex >= 0);

        return {
          name: toTitleCase(series.symptom_name),
          color: getSymptomColor(series.symptom_name),
          dataPoints: points,
        };
      })
      .filter((series) => series.dataPoints.length > 0);

    const normalizedTemperaturePoints = fillTemperatureSeriesByDate(sortedDates, timelineData.temperature_series);
    const temperatureDataPoints = normalizedTemperaturePoints
      .map((point) => ({
        date: point.date,
        severity: point.value >= 100.4 ? 'fever' : 'normal',
        severity_numeric: point.value,
        dateIndex: sortedDates.indexOf(point.date),
      }))
      .filter((point) => point.dateIndex >= 0);

    const withTemperature = temperatureDataPoints.length
      ? [
        ...filteredSymptoms,
        {
          name: 'Temperature',
          color: symptomColors.temperature,
          dataPoints: temperatureDataPoints,
        },
      ]
      : filteredSymptoms;

    return { dates: sortedDates, symptoms: withTemperature };
  }, [timelineData, selectedSymptoms, severityRange]);

  const chartMinDate = useMemo(() => {
    if (graphData.dates.length > 0) return graphData.dates[0];
    return timelineData?.start_date || '';
  }, [graphData.dates, timelineData?.start_date]);

  const chartMaxDate = useMemo(() => {
    if (graphData.dates.length > 0) return graphData.dates[graphData.dates.length - 1];
    return timelineData?.end_date || '';
  }, [graphData.dates, timelineData?.end_date]);

  const handleStartDateChange = (newStartDate: string) => {
    if (!chartMinDate || !chartMaxDate) {
      setStartDate(newStartDate);
      return;
    }
    const clampedStart = clampDate(newStartDate, chartMinDate, chartMaxDate);
    setStartDate(clampedStart);
    setEndDate((prevEndDate) => {
      const clampedEnd = clampDate(prevEndDate, chartMinDate, chartMaxDate);
      return clampedEnd < clampedStart ? clampedStart : clampedEnd;
    });
  };

  const handleEndDateChange = (newEndDate: string) => {
    if (!chartMinDate || !chartMaxDate) {
      setEndDate(newEndDate);
      return;
    }
    const clampedEnd = clampDate(newEndDate, chartMinDate, chartMaxDate);
    setEndDate(clampedEnd);
    setStartDate((prevStartDate) => {
      const clampedStart = clampDate(prevStartDate, chartMinDate, chartMaxDate);
      return clampedStart > clampedEnd ? clampedEnd : clampedStart;
    });
  };

  useEffect(() => {
    if (!chartMinDate || !chartMaxDate) return;

    setStartDate((prevStartDate) => {
      const nextStart = clampDate(prevStartDate, chartMinDate, chartMaxDate);
      return nextStart > endDate ? endDate : nextStart;
    });
    setEndDate((prevEndDate) => {
      const nextEnd = clampDate(prevEndDate, chartMinDate, chartMaxDate);
      return nextEnd < startDate ? startDate : nextEnd;
    });
  }, [chartMinDate, chartMaxDate]);

  useEffect(() => {
    if (!patientDetails) return;

    const fallbackNameParts = splitPatientName(patientDetails.patientName);
    const firstName = patientDetails.firstName?.trim() || fallbackNameParts.firstName;
    const lastName = patientDetails.lastName?.trim() || fallbackNameParts.lastName;

    setPatientProfile((prev) => ({
      ...prev,
      mrn: patientDetails.mrn?.trim() || '--',
      firstName: firstName || '--',
      lastName: lastName || '--',
      email: patientDetails.email?.trim() || '--',
      phone: patientDetails.phoneNumber?.trim() || '--',
      dateOfBirth: patientDetails.dateOfBirth?.trim() || '',
      gender: patientDetails.gender || '--',
      regimenName: patientDetails.summary?.trim() || '--',
      dayOfChemotherapy: getWeekdayFromIsoDate(patientDetails.lastChemoDate),
      nextChemotherapyTreatment: patientDetails.lastChemoDate ? `${patientDetails.lastChemoDate}T00:00` : '',
      startDate: (patientDetails as any).startDate || '',
      endDate: (patientDetails as any).endDate || '',
      location: (patientDetails as any).location || '--',
      assignedOncologist: (patientDetails as any).assignedOncologist || '--',
      dayOfChemotherapyTreatment: (patientDetails as any).dayOfChemotherapyTreatment || '--',
      pastMedicalHistory: (patientDetails as any).pastMedicalHistory || '--',
      pastSurgicalHistory: (patientDetails as any).pastSurgicalHistory || '--',
      diagnosis: (patientDetails as any).diagnosis || '--',
    }));
  }, [patientDetails]);

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[rgb(250,248,245)]'} transition-colors duration-200`}>
      {/* Fixed Header - always visible, outside scroll container */}
      <div className="flex-shrink-0">
        <PatientDetailHeader
          isDark={isDark}
          patientName={patientDetails?.patientName}
          onBack={handleBack}
          onProfileClick={() => setIsProfileModalOpen(true)}
          onRefreshClick={handleRefreshDashboard}
          onDownloadClick={handleDownloadReport}
          onFaxClick={handleFaxClick}
          isFaxMode={isFaxMode}
          isRefreshing={timelineFetching || patientDetailsFetching || questionsFetching || isSendingFax}
        />


      </div>
      {/* Main Content Area - scroll happens only here, header stays on top */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row relative">
        {/* Sidebar Toggle Button - Desktop */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`hidden md:flex absolute left-0 top-4 z-30 ${isSidebarOpen ? 'left-[320px]' : 'left-0'} transition-all duration-300 ${isDark
            ? 'bg-[#252320] border-slate-700 text-slate-300 hover:bg-[#2A2725]'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            } border rounded-r-lg p-2 shadow-md hover:shadow-lg items-center justify-center`}
          style={{
            borderLeft: 'none',
          }}
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? (
            <ChevronLeft size={20} className="transition-transform" />
          ) : (
            <ChevronRight size={20} className="transition-transform" />
          )}
        </button>

        {/* Mobile Filter Toggle Button */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`md:hidden fixed bottom-6 right-6 z-40 ${isDark
              ? 'bg-[#1e3a5f] text-white hover:bg-[#2563EB]'
              : 'bg-[#1e3a5f] text-white hover:bg-[#2563EB]'
              } rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center`}
            aria-label="Open filters"
          >
            <Filter size={24} />
          </button>
        )}

        {/* Mobile Overlay */}
        {isSidebarOpen && isMobile && (
          <div
            className="md:hidden absolute inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar - Filters */}
        {(!isMobile || isSidebarOpen) && (
          <FiltersSidebar
            isOpen={isSidebarOpen}
            isDark={isDark}
            isMobile={isMobile}
            onClose={() => setIsSidebarOpen(false)}
            startDate={startDate}
            endDate={endDate}
            selectedSymptoms={selectedSymptoms}
            symptomOptions={symptomOptions}
            severityRange={severityRange}
            minAvailableDate={chartMinDate}
            maxAvailableDate={chartMaxDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onSymptomToggle={handleSymptomToggle}
            onSeverityRangeChange={setSeverityRange}
            onResetFilters={handleResetFilters}
          />
        )}

        {/* Main Content - Graph and Table (scrollable) */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden transition-all duration-300 min-w-0 ${isDark ? '[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-slate-800' : '[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100'
            }`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isDark ? '#475569 #1A1917' : '#cbd5e1 #f1f5f9',
          }}
        >
          <div className="p-3 sm:p-4 md:p-5 space-y-3 md:space-y-4">
            {/* Graph Section */}
            <GraphSection
              graphData={graphData}
              isLoading={timelineLoading || timelineFetching}
              isDark={isDark}
              isSidebarOpen={isSidebarOpen}
              isChartFullscreen={isChartFullscreen}
              onFullscreenOpen={() => setIsChartFullscreen(true)}
              onFullscreenClose={() => setIsChartFullscreen(false)}
              patientName={patientDetails?.patientName}
              formatDateShort={formatDateShort}
              lastChemoDate={timelineData?.last_chemo_date ?? null}
              isFaxMode={isFaxMode}
            />

            {/* Table Section */}
            <PatientDataTable
              data={tableData}
              isDark={isDark}
              isLoading={timelineLoading || timelineFetching}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(newRowsPerPage) => {
                setRowsPerPage(newRowsPerPage);
                setPage(0);
              }}
              formatDate={formatDate}
            />

            {/* Tabs Section - Treatment, Questions, Diary */}
            <PatientTabs
              isDark={isDark}
              questions={questions}
              isLoading={questionsLoading}
            />
          </div>
        </div>
      </div>

      {/* Patient Profile Modal */}
      <PatientFormModal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        mode="edit"
        patient={patientForModal}
      />

      {/* Stylish Toast Notification */}
      <Snackbar 
        open={toast.open} 
        autoHideDuration={4000} 
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <div className={`rounded-lg p-3 min-w-[300px] flex items-center justify-between gap-3 transition-all duration-300 border shadow-lg z-50 ${
          toast.type === 'success'
            ? (isDark 
                ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                : 'bg-gradient-to-r from-green-50 to-green-100 border-green-300 text-green-700')
            : (isDark
                ? 'bg-red-500 border-red-500/50 text-white'
                : 'bg-gradient-to-r from-red-50 to-red-100 border-red-300 text-red-700')
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {/* {toast.type === 'success' ? '✅' : '❌'} */}
            </span>
            <span className="text-sm font-medium">
              {toast.message}
            </span>
          </div>
          <button 
            onClick={handleCloseToast}
            className={`p-1 rounded-md transition-colors ${
              toast.type === 'success'
                ? (isDark ? 'hover:bg-green-500/20' : 'hover:bg-green-200/50')
                : (isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-200/50')
            }`}
          >
            <X size={16} />
          </button>
        </div>
      </Snackbar>

      <Dialog
        open={isFaxPreviewOpen}
        onClose={handleCloseFaxPreview}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            height: '90vh',
            backgroundColor: isDark ? '#1A1917' : '#FAF8F5',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            backgroundColor: isDark ? '#252320' : 'white',
            color: isDark ? '#f1f5f9' : '#0f172a',
          }}
        >
          <div>
            <div className="text-base md:text-lg font-semibold">Fax Preview</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="min-w-0 md:col-span-2">
                <label className="text-sm font-medium mb-1 block">Clinic Name :</label> 
                <select
                  value={selectedClinicUuid}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedClinicUuid(value);
                    const selectedClinic = clinics.find(
                      (clinic) => String(clinic.uuid || clinic.id) === value
                    );
                    if (!selectedClinic) {
                      setEditableClinicName('');
                      setEditableClinicFax('');
                      return;
                    }
                    setEditableClinicName(selectedClinic.name || '');
                    setEditableClinicFax(selectedClinic.fax || selectedClinic.phone || '');
                  }}
                  className={`w-full min-w-0 px-2 py-1.5 rounded border text-xs md:text-sm ${isDark ? 'bg-[#1A1917] border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                >
                  <option value="">{isLoadingClinics ? 'Loading clinic list...' : 'Select clinic'}</option>
                  {clinics.map((clinic) => (
                    <option key={clinic.uuid || clinic.id} value={String(clinic.uuid || clinic.id)}>
                      {clinic.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="text-sm font-medium mb-1 block">Fax Number :</label>
                <input
                  type="text"
                  value={editableClinicFax}
                  onChange={(e) => setEditableClinicFax(e.target.value)}
                  placeholder="Fax number"
                  className={`w-full min-w-0 px-2 py-1.5 rounded border text-xs md:text-sm ${isDark ? 'bg-[#1A1917] border-slate-600 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outlined" onClick={handleCloseFaxPreview}>
              Close
            </Button>
            <Button
              variant="contained"
              onClick={handleFaxClick}
              disabled={isSendingFax}
              sx={{ backgroundColor: '#10b981', '&:hover': { backgroundColor: '#059669' } }}
            >
              {isSendingFax ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 2,
            overflow: 'auto',
            backgroundColor: isDark ? '#1A1917' : '#FAF8F5',
          }}
        >
          <div className="space-y-3 md:space-y-4">
            <GraphSection
              graphData={graphData}
              isLoading={timelineLoading || timelineFetching}
              isDark={isDark}
              isSidebarOpen={false}
              isChartFullscreen={isChartFullscreen}
              onFullscreenOpen={() => setIsChartFullscreen(true)}
              onFullscreenClose={() => setIsChartFullscreen(false)}
              patientName={patientDetails?.patientName}
              formatDateShort={formatDateShort}
              lastChemoDate={timelineData?.last_chemo_date ?? null}
              isFaxMode={true}
            />

            <PatientDataTable
              data={tableData}
              isDark={isDark}
              isLoading={timelineLoading || timelineFetching}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(newRowsPerPage) => {
                setRowsPerPage(newRowsPerPage);
                setPage(0);
              }}
              formatDate={formatDate}
            />

            <PatientTabs
              isDark={isDark}
              questions={questions}
              isLoading={questionsLoading}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientDetailPage;

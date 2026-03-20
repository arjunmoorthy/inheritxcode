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
 */

import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';
import {
  usePatientTimeline,
  usePatientDetails,
} from '../../services/dashboard';
import type { MedicationItem } from '../../services/dashboard';

// Components
import PatientDetailHeader from './components/PatientDetailHeader';
import FiltersSidebar from './components/FiltersSidebar';
import GraphSection from './components/GraphSection';
import PatientDataTable from './components/PatientDataTable';
import PatientTabs from './components/PatientTabs';
import PatientProfileModal, { type PatientProfile } from './components/PatientProfileModal';

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
  const [severityRange, setSeverityRange] = useState<number[]>([0, 4]);
  
  // Table pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  
  // Tab state
  const [tabValue, setTabValue] = useState(0);
  
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
    location: 'Boston, MA',
    regimenName: 'Carboplatin + Pemetrexed',
    dayOfChemotherapy: 'Wednesday',
    nextChemotherapyTreatment: '',
  });

  // Fetch data
  const { data: timeline, isLoading: timelineLoading } = usePatientTimeline(uuid || '', startDate, endDate);
  const { data: patientDetails } = usePatientDetails(uuid || '');
  // Static payload is kept only for temporary debugging.
  const timelineData = USE_STATIC_TIMELINE ? STATIC_TIMELINE_DATA : timeline;

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
    setSeverityRange([0, 4]);
    setPage(0);
  };

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

  const treatmentEvents = useMemo(() => {
    if (!timelineData) return [];

    return timelineData.medications.map((item: MedicationItem) => ({
      event_type: 'medication',
      event_date: item.date,
      metadata: {
        symptom: item.symptom_name,
        severity: item.severity,
        medication: item.medication_name,
        frequency: item.medication_frequency || 'N/A',
        severity_after_medication: item.severity_after_medication || 'N/A',
      },
    }));
  }, [timelineData]);

  const handleProfileSave = () => {
    // Handle save logic here
    console.log('Saving patient profile:', patientProfile);
    setIsProfileModalOpen(false);
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[rgb(250,248,245)]'} transition-colors duration-200`}>
      {/* Fixed Header - always visible, outside scroll container */}
      <div className="flex-shrink-0">
        <PatientDetailHeader
          isDark={isDark}
          patientName={patientDetails?.patientName}
          onBack={handleBack}
          onProfileClick={() => setIsProfileModalOpen(true)}
        />
      </div>
      {/* Main Content Area - scroll happens only here, header stays on top */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row relative">
        {/* Sidebar Toggle Button - Desktop */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`hidden md:flex absolute left-0 top-4 z-30 ${isSidebarOpen ? 'left-[320px]' : 'left-0'} transition-all duration-300 ${
            isDark 
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
            className={`md:hidden fixed bottom-6 right-6 z-40 ${
              isDark 
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
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onSymptomToggle={handleSymptomToggle}
            onSeverityRangeChange={setSeverityRange}
            onResetFilters={handleResetFilters}
          />
        )}

        {/* Main Content - Graph and Table (scrollable) */}
        <div 
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden transition-all duration-300 min-w-0 ${
            isDark ? '[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-slate-800' : '[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100'
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
              isLoading={timelineLoading}
              isDark={isDark}
              isSidebarOpen={isSidebarOpen}
              isChartFullscreen={isChartFullscreen}
              onFullscreenOpen={() => setIsChartFullscreen(true)}
              onFullscreenClose={() => setIsChartFullscreen(false)}
              patientName={patientDetails?.patientName}
              formatDateShort={formatDateShort}
              lastChemoDate={timelineData?.last_chemo_date ?? null}
            />

            {/* Table Section */}
            <PatientDataTable
              data={tableData}
              isDark={isDark}
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
              tabValue={tabValue}
              onTabChange={setTabValue}
              treatmentEvents={treatmentEvents}
              isDark={isDark}
              formatDate={formatDate}
            />
          </div>
        </div>
      </div>

      {/* Patient Profile Modal */}
      <PatientProfileModal
        open={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        patientProfile={patientProfile}
        onProfileChange={setPatientProfile}
        onSave={handleProfileSave}
        isDark={isDark}
      />
    </div>
  );
};

export default PatientDetailPage;

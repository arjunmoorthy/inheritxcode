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
  'pain': '#10B981',        // Green
  'vomiting': '#06B6D4',    // Light Blue
  'constipation': '#2563EB', // Dark Blue
  'temperature': '#EF4444', // Red
  'fatigue': '#8B5CF6',     // Purple
  'nausea': '#EC4899',      // Pink
};

// Static fallback data
const staticTimelineData = {
  patient_uuid: '1',
  period_days: 30,
  symptom_series: {
    'cough': [
      { date: '2026-01-30', severity: 'mild', severity_numeric: 1 },
      { date: '2026-02-01', severity: 'moderate', severity_numeric: 2 },
      { date: '2026-02-03', severity: 'severe', severity_numeric: 3 },
      { date: '2026-02-05', severity: 'moderate', severity_numeric: 2 },
    ],
    'pain': [
      { date: '2026-01-30', severity: 'moderate', severity_numeric: 2 },
      { date: '2026-02-01', severity: 'severe', severity_numeric: 3 },
      { date: '2026-02-03', severity: 'moderate', severity_numeric: 2 },
      { date: '2026-02-05', severity: 'mild', severity_numeric: 1 },
    ],
    'vomiting': [
      { date: '2026-01-31', severity: 'mild', severity_numeric: 1 },
      { date: '2026-02-02', severity: 'moderate', severity_numeric: 2 },
      { date: '2026-02-04', severity: 'mild', severity_numeric: 1 },
    ],
    'constipation': [
      { date: '2026-01-30', severity: 'moderate', severity_numeric: 2 },
      { date: '2026-02-02', severity: 'severe', severity_numeric: 3 },
      { date: '2026-02-05', severity: 'moderate', severity_numeric: 2 },
    ],
    'temperature': [
      { date: '2026-01-30', severity: 'normal', severity_numeric: 98.6 },
      { date: '2026-02-01', severity: 'elevated', severity_numeric: 100.2 },
      { date: '2026-02-03', severity: 'fever', severity_numeric: 101.8 },
      { date: '2026-02-05', severity: 'normal', severity_numeric: 98.4 },
    ],
  },
  treatment_events: [
    {
      event_type: 'chemotherapy',
      event_date: '2026-02-01',
      metadata: { cycle: 1, medication: 'Doxorubicin' },
    },
    {
      event_type: 'medication',
      event_date: '2026-02-03',
      metadata: { medication: 'Pain Relief', dosage: '10mg' },
    },
  ],
};

const staticTableData = [
  { date: '2026-02-06', symptom: 'Cough', severity: 'Moderate', temperature: '98.6°F' },
  { date: '2026-02-05', symptom: 'Pain', severity: 'Mild', temperature: '98.4°F' },
  { date: '2026-02-04', symptom: 'Vomiting', severity: 'Mild', temperature: '98.2°F' },
  { date: '2026-02-03', symptom: 'Cough', severity: 'Severe', temperature: '101.8°F' },
  { date: '2026-02-02', symptom: 'Constipation', severity: 'Severe', temperature: '99.2°F' },
];

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
  const [startDate, setStartDate] = useState('2026-01-30');
  const [endDate, setEndDate] = useState('2026-02-06');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['all', 'cough', 'pain', 'vomiting', 'constipation']);
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
  const { data: timeline, isLoading: timelineLoading, error: timelineError } = usePatientTimeline(uuid || '', 30);
  const { data: patientDetails } = usePatientDetails(uuid || '');

  // Use static data if API fails
  const displayTimeline = (!timelineLoading && (timelineError || !timeline?.symptom_series || Object.keys(timeline.symptom_series).length === 0))
    ? staticTimelineData
    : timeline || staticTimelineData;

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleSymptomToggle = (symptom: string) => {
    if (symptom === 'all') {
      setSelectedSymptoms(['all', 'cough', 'pain', 'vomiting', 'constipation']);
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
    setStartDate('2026-01-30');
    setEndDate('2026-02-06');
    setSelectedSymptoms(['all', 'cough', 'pain', 'vomiting', 'constipation']);
    setSeverityRange([0, 4]);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
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
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Process graph data
  const graphData = useMemo(() => {
    if (!displayTimeline?.symptom_series) return { dates: [], symptoms: [] };

    const allDates = new Set<string>();
    Object.entries(displayTimeline.symptom_series).forEach(([, dataPoints]) => {
      dataPoints.forEach((dp: any) => {
        if (dp.date) allDates.add(dp.date);
      });
    });
    const sortedDates = Array.from(allDates).sort();

    const symptoms = Object.entries(displayTimeline.symptom_series)
      .filter(([symptom]) => {
        if (selectedSymptoms.includes('all')) return true;
        return selectedSymptoms.includes(symptom.toLowerCase());
      })
      .map(([symptom, dataPoints]) => ({
        name: symptom,
        color: symptomColors[symptom.toLowerCase()] || symptomColors['cough'],
        dataPoints: (dataPoints as any[]).map(dp => ({
          ...dp,
          dateIndex: sortedDates.indexOf(dp.date || ''),
        })).filter(dp => dp.dateIndex >= 0),
      }));

    return { dates: sortedDates, symptoms };
  }, [displayTimeline, selectedSymptoms]);

  const handleProfileSave = () => {
    // Handle save logic here
    console.log('Saving patient profile:', patientProfile);
    setIsProfileModalOpen(false);
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#1A1917]' : 'bg-[#FAF8F5]'} transition-colors duration-200 overflow-hidden`}>
      {/* Header */}
      <PatientDetailHeader
        isDark={isDark}
        patientName={patientDetails?.patientName}
        onBack={handleBack}
        onProfileClick={() => setIsProfileModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
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
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar - Filters */}
        <FiltersSidebar
          isOpen={isSidebarOpen}
          isDark={isDark}
          isMobile={isMobile}
          onClose={() => setIsSidebarOpen(false)}
          startDate={startDate}
          endDate={endDate}
          selectedSymptoms={selectedSymptoms}
          severityRange={severityRange}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onSymptomToggle={handleSymptomToggle}
          onSeverityRangeChange={setSeverityRange}
          onResetFilters={handleResetFilters}
        />

        {/* Main Content - Graph and Table */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden transition-all duration-300 min-w-0`}>
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
            />

            {/* Table Section */}
            <PatientDataTable
              data={staticTableData}
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
              treatmentEvents={displayTimeline?.treatment_events || []}
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

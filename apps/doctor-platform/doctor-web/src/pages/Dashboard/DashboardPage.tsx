/**
 * =============================================================================
 * OncoLife Physician Dashboard
 * =============================================================================
 * 
 * Module:      DashboardPage.tsx
 * Description: Analytics-driven clinical monitoring dashboard for physicians.
 *              Displays severity-ranked patient list with real-time symptom
 *              data from the patient platform.
 * 
 * Created:     2025-12-28
 * Modified:    2026-01-16
 * Author:      Naveen Babu S A
 * Version:     3.0.0
 * 
 * Features:
 *   - Severity-ranked patient list (urgent/severe/moderate/mild)
 *   - Color-coded severity badges
 *   - Search and filter functionality
 *   - Real-time patient data from API
 *   - Click-through to patient detail view
 *   - Full dark mode and light mode support
 *   - Tailwind CSS styling
 * 
 * Copyright:
 *   (c) 2026 OncoLife Health Technologies. All rights reserved.
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, useMediaQuery } from '@mui/material';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Pagination from '@mui/material/Pagination';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import { 
  Search, 
  User,
  UserPlus,
  Activity,
  Calendar,
  FileText,
  ChevronRight,
  Stethoscope,
  MessageCircle,
  Pill
} from 'lucide-react';
import { usePatientSummaries, type PatientSummary } from '../../services/dashboard';
import { useAddManualPatient, type AddManualPatientPayload } from '../../services/patients';
import { useThemeMode } from '@oncolife/ui-components';
import { AddPatientModal, type PatientFormValues } from './components/AddPatientModal';

function computeAge(dateOfBirth: string | undefined): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : undefined;
}

function toAddManualPatientPayload(form: PatientFormValues): AddManualPatientPayload {
  return {
    first_name: form.firstName,
    last_name: form.lastName,
    mrn: form.mrn?.trim() || `MRN${Date.now()}`,
    date_of_birth: form.dateOfBirth || undefined,
    age: computeAge(form.dateOfBirth),
    gender: form.gender || undefined,
    email: form.email,
    phone_number: form.phone || undefined,
    cancer_type: form.diagnosis,
    oncologist: form.oncologist || undefined,
    start_date: form.treatmentStartDate || undefined,
    end_date: form.endDate || undefined,
    plan_name: form.regimenName || undefined,
    past_medical_history: form.pastMedicalHistory || undefined,
    past_surgical_history: form.pastSurgicalHistory || undefined,
  };
}

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [symptomTypeFilter, setSymptomTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [checkInFilter, setCheckInFilter] = useState('all');
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Debounce search: wait 400ms after typing stops; clear triggers API immediately
  useEffect(() => {
    const trimmed = typeof search === 'string' ? search.trim() : '';
    if (trimmed === '') {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 400);
    return () => clearTimeout(timer);
  }, [search]);
  
  const { data, isLoading, error } = usePatientSummaries(page, debouncedSearch, 'all');
  const addPatientMutation = useAddManualPatient();
  
  // Helper functions - defined before use
  const formatDOB = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string) => {
    if (!dateString || dateString === 'None') return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const getLastChemo = (_patient: PatientSummary): string => {
    return 'N/A';
  };

  const getDiagnosis = (patient: PatientSummary): string => {
    const p = patient as PatientSummary & { diagnosis?: string | null; cancer_type?: string | null; diseaseType?: string | null };
    const fromApi = p.diagnosis ?? p.cancer_type ?? p.diseaseType;
    if (fromApi && String(fromApi).trim()) return String(fromApi).trim();
    return 'N/A';
  };


  const getSeverity = (patient: PatientSummary): 'mild' | 'moderate' | 'severe' | 'urgent' => {
    // Use severity from API if available
    if (patient.maxSeverity) {
      return patient.maxSeverity;
    }
    // Fallback: detect from summary text
    const summary = patient.summary || '';
    if (summary.toLowerCase().includes('urgent') || summary.toLowerCase().includes('emergency') || patient.hasEscalation) {
      return 'urgent';
    }
    if (summary.toLowerCase().includes('severe')) {
      return 'severe';
    }
    if (summary.toLowerCase().includes('moderate')) {
      return 'moderate';
    }
    return 'mild';
  };
  
  // Static fallback data for when API fails or returns no data
  const staticPatients: PatientSummary[] = [
    {
      id: '1',
      patientName: 'Bobby Johnson',
      dateOfBirth: '1975-03-15',
      mrn: '001',
      symptoms: 'Fatigue, Shortness of breath',
      summary: 'Non-Small Cell Lung Cancer - Patient reporting increased fatigue and breathing difficulties',
      lastUpdated: '2026-01-05',
      status: 'active',
      priority: 'high',
      maxSeverity: 'severe',
      hasEscalation: false,
      severityBadge: 'severe',
      diagnosis: 'Non-Small Cell Lung Cancer',
    },
    {
      id: '2',
      patientName: 'Sarah Johnson',
      dateOfBirth: '1982-07-22',
      mrn: '002',
      symptoms: 'Nausea, Pain',
      summary: 'Breast Cancer Stage II - Managing treatment side effects',
      lastUpdated: '2026-01-04',
      status: 'active',
      priority: 'high',
      maxSeverity: 'severe',
      hasEscalation: false,
      severityBadge: 'severe',
      diagnosis: 'Breast Cancer Stage II',
    },
    {
      id: '3',
      patientName: 'Michael Chen',
      dateOfBirth: '1968-11-08',
      mrn: '003',
      symptoms: 'Diarrhea, Appetite loss',
      summary: 'Colorectal Cancer - Post-treatment monitoring',
      lastUpdated: '2026-01-03',
      status: 'active',
      priority: 'high',
      maxSeverity: 'severe',
      hasEscalation: false,
      severityBadge: 'severe',
      diagnosis: 'Colorectal Cancer',
    },
    {
      id: '4',
      patientName: 'Elena Rodriguez',
      dateOfBirth: '1979-05-30',
      mrn: '004',
      symptoms: 'Mild fatigue',
      summary: 'Ovarian Cancer - Stable condition, routine monitoring',
      lastUpdated: '2025-12-18',
      status: 'active',
      priority: 'low',
      maxSeverity: 'mild',
      hasEscalation: false,
      severityBadge: 'mild',
      diagnosis: 'Ovarian Cancer',
    },
  ];

  // Use static data only if API fails or returns no data (not when loading)
  // Only use static data when we're not loading and there's no current data
  const displayData = (!isLoading && (error || !data?.data || data.data.length === 0)) 
    ? [] 
    : (data?.data || []);
  
  // Filter patients: search via API for live data; client-side for static fallback
  const isUsingStaticFallback = !isLoading && (error || !data?.data || data.data.length === 0);
  const searchTrimmed = debouncedSearch;
  const filteredPatients = displayData.filter((patient) => {
    // Client-side search only when using static fallback (API handles search for live data)
    if (isUsingStaticFallback && searchTrimmed) {
      const searchLower = searchTrimmed.toLowerCase();
      const fullName = patient.patientName.toLowerCase();
      const parts = patient.patientName.toLowerCase().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const matchesSearch =
        fullName.includes(searchLower) ||
        firstName.includes(searchLower) ||
        lastName.includes(searchLower) ||
        (patient.mrn || '').toLowerCase().includes(searchLower) ||
        (patient.summary || '').toLowerCase().includes(searchLower) ||
        getDiagnosis(patient).toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    // Severity filter
    if (severityFilter !== 'all') {
      const patientSeverity = getSeverity(patient);
      if (severityFilter !== patientSeverity) return false;
    }
    
    // Check-in filter (simplified - can be enhanced with actual date logic)
    if (checkInFilter !== 'all' && patient.lastUpdated) {
      const lastCheckIn = new Date(patient.lastUpdated);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24));
      
      if (checkInFilter === 'today' && daysDiff !== 0) return false;
      if (checkInFilter === 'week' && daysDiff > 7) return false;
      if (checkInFilter === 'month' && daysDiff > 30) return false;
    }
    
    return true;
  });
  
  // Pagination for filtered results
  const itemsPerPage = 10;
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  
  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
  };
  
  const handleSymptomTypeChange = (event: any) => {
    setSymptomTypeFilter(event.target.value);
    setPage(1);
  };

  const handleSeverityChange = (event: any) => {
    setSeverityFilter(event.target.value);
    setPage(1);
  };

  const handleCheckInChange = (event: any) => {
    setCheckInFilter(event.target.value);
    setPage(1);
  };

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[rgb(250,248,245)]'} transition-colors duration-200`}>
      {/* Fixed Header - Enhanced Dashboard Style */}
      <div 
        className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917] border-b border-slate-800/50' : 'bg-white/95 backdrop-blur-sm border-b border-slate-200/60'} transition-all duration-200 shadow-sm`}
      >
        <div className="p-6 pb-5 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Activity size={22} className={isDark ? 'text-blue-400' : 'text-secondary'} />
              </div>
              <div>
                <h3 className={`text-3xl md:text-[1.75rem] font-bold font-serif ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 leading-tight`}>
                  Patient Dashboard
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1.5 mb-0 font-medium`}>
                  Monitor patient symptoms and clinical trends
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddPatientModalOpen(true)}
              className={`inline-flex text-white items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-100 ${
                isDark 
                  ? 'bg-[#1e3a5f]' 
                  : 'bg-[#1e3a5f]'
              }`}
            >
              <UserPlus size={16} />
              <span>Add Patient</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Fixed Search and Filters Bar */}
      <div
        className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917]/95 backdrop-blur-sm border-b border-slate-800/50' : 'bg-white/95 backdrop-blur-sm border-b border-slate-200/60'} transition-all duration-200 shadow-md`}
      >
        <div className="p-6 py-5 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px] w-full lg:w-auto">
            <TextField
              fullWidth
              placeholder="Search by first name, last name, or full name..."
              value={search}
              onChange={handleSearchChange}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} className="text-slate-500 dark:text-slate-400" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  boxShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease',
                  '& fieldset': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: '1.5px',
                  },
                  '&:hover fieldset': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                  '&.Mui-focused': {
                    boxShadow: isDark ? '0 0 0 3px rgba(37, 99, 235, 0.2)' : '0 0 0 3px rgba(37, 99, 235, 0.1)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#2563EB',
                    borderWidth: '2px',
                  },
                },
                '& .MuiInputBase-input': {
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  padding: '10px 14px',
                  '&::placeholder': {
                    color: isDark ? '#94a3b8' : '#64748b',
                    opacity: 0.7,
                  },
                },
              }}
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-row gap-3 items-center flex-wrap">
            <FormControl size="small" sx={{ minWidth: { xs: 140, sm: 160 } }}>
              <InputLabel 
                sx={{ 
                  color: isDark ? '#94a3b8' : '#64748b',
                  '&.Mui-focused': { color: '#2563EB' }
                }}
              >
                Symptom Type
              </InputLabel>
              <Select
                value={symptomTypeFilter}
                label="Symptom Type"
                onChange={handleSymptomTypeChange}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: isDark ? '#1A1917' : 'white',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      marginTop: '8px',
                      boxShadow: isDark 
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    },
                  },
                }}
                sx={{ 
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#2563EB',
                  },
                  '& .MuiSvgIcon-root': {
                    color: isDark ? '#94a3b8' : '#64748b',
                  },
                }}
              >
                <MenuItem value="all">All Symptoms</MenuItem>
                <MenuItem value="fatigue">Fatigue</MenuItem>
                <MenuItem value="pain">Pain</MenuItem>
                <MenuItem value="nausea">Nausea</MenuItem>
                <MenuItem value="breathing">Breathing Issues</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 140 } }}>
              <InputLabel 
                sx={{ 
                  color: isDark ? '#94a3b8' : '#64748b',
                  '&.Mui-focused': { color: '#2563EB' }
                }}
              >
                Severity
              </InputLabel>
              <Select
                value={severityFilter}
                label="Severity"
                onChange={handleSeverityChange}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: isDark ? '#1A1917' : 'white',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      marginTop: '8px',
                      boxShadow: isDark 
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    },
                  },
                }}
                sx={{ 
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#2563EB',
                  },
                  '& .MuiSvgIcon-root': {
                    color: isDark ? '#94a3b8' : '#64748b',
                  },
                }}
              >
                <MenuItem value="all">All Severities</MenuItem>
                <MenuItem value="mild">Mild</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="severe">Severe</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: 160, sm: 180 } }}>
              <InputLabel 
                sx={{ 
                  color: isDark ? '#94a3b8' : '#64748b',
                  '&.Mui-focused': { color: '#2563EB' }
                }}
              >
                Last Chatbot Check-in
              </InputLabel>
              <Select
                value={checkInFilter}
                label="Last Chatbot Check-in"
                onChange={handleCheckInChange}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: isDark ? '#1A1917' : 'white',
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      marginTop: '8px',
                      boxShadow: isDark 
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    },
                  },
                }}
                sx={{ 
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#2563EB',
                  },
                  '& .MuiSvgIcon-root': {
                    color: isDark ? '#94a3b8' : '#64748b',
                  },
                }}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
              </Select>
            </FormControl>
          </div>
          </div>
        </div>
      </div>
      
      {/* Patient List Container - Scrollable */}
      <div 
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${isDark ? '[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-slate-800' : '[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100'}`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? '#475569 #1A1917' : '#cbd5e1 #f1f5f9',
        }}
      >
        <div className="p-6 pt-4 pb-4 max-w-[1400px] mx-auto w-full">
          {/* Only show error if we're not using static data fallback */}
          {error && !isLoading && (!data?.data || data.data.length === 0) && (
            <Box sx={{ 
              p: 2, 
              bgcolor: isDark ? '#7f1d1d' : '#FEF2F2', 
              borderRadius: 2, 
              border: `1px solid ${isDark ? '#991b1b' : '#FECACA'}`,
              mb: 2 
            }}>
              <Typography 
                variant="body2"
                sx={{
                  color: isDark ? '#fca5a5' : '#dc2626',
                }}
              >
                Error loading patient summaries. Showing sample data.
              </Typography>
            </Box>
          )}
          
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <Card 
                  key={i} 
                  sx={{ 
                    borderRadius: 3,
                    backgroundColor: isDark ? '#1A1917' : 'white',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  }}
                >
                  <CardContent sx={{ backgroundColor: isDark ? '#1A1917' : 'white' }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Skeleton 
                        variant="circular" 
                        width={40} 
                        height={40}
                        sx={{
                          bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton 
                          variant="text" 
                          width="60%"
                          sx={{
                            bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                            mb: 1,
                          }}
                        />
                        <Skeleton 
                          variant="text" 
                          width="40%"
                          sx={{
                            bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                          }}
                        />
                      </Box>
                    </Box>
                    <Skeleton 
                      variant="rectangular" 
                      height={60} 
                      sx={{ 
                        borderRadius: 1,
                        bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                      }} 
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className={`text-center py-16 px-6 ${isDark ? 'bg-slate-900/30 border-slate-700/30' : 'bg-white/60 border-slate-200/60'} rounded-2xl border-2 border-dashed backdrop-blur-sm`}>
              <div className={`inline-flex p-4 rounded-full mb-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                <User size={40} className={`${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <h3 className={`text-xl font-semibold font-serif ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 mb-2`}>
                No Patients Found
              </h3>
              <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm m-0 max-w-md mx-auto`}>
                Try adjusting your search or filter criteria to find patients.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {paginatedPatients.map((patient) => {
                const severity = getSeverity(patient);
                const lastChemo = getLastChemo(patient);
                const lastChatbot = patient.lastUpdated || '';
                const dob = patient.dateOfBirth || (patient as any).date_of_birth || '';
                
                return (
                  <div
                    key={patient.id}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    className={`group ${isDark ? 'bg-[#252320] border-slate-700/50 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg'} rounded-lg border overflow-hidden transition-all duration-300 cursor-pointer shadow-sm`}
                  >
                    {/* Patient Card Content */}
                    <div className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Patient Name & MRN */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className={`font-bold ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'} text-base leading-tight`}>
                            {patient.patientName}
                          </div>
                          <div className={`text-xs mt-0.5 flex items-center gap-4 flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            <span className="flex items-center justify-center gap-2">
                              <FileText size={14} className="flex-shrink-0 self-center" />
                              <span className="leading-none">MRN: {patient.mrn || 'N/A'}</span>
                            </span>
                            <span className="flex items-center justify-center gap-2">
                              <Calendar size={14} className="flex-shrink-0 self-center" />
                              <span className="leading-none">DOB: {dob ? formatDOB(dob) : 'N/A'}</span>
                            </span>
                          </div>
                        </div>

                        {/* Middle: Diagnosis, Last Chatbot, Last Chemo (with light blue icons) */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 flex-1 sm:flex-initial sm:flex-nowrap sm:justify-center">
                          <div className="flex items-center justify-center gap-2">
                            <Stethoscope size={14} className={`flex-shrink-0 self-center ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                            <div className="flex items-center gap-1">
                              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Diagnosis: </span>
                              <span className={`text-sm ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}>{getDiagnosis(patient)}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <MessageCircle size={14} className={`flex-shrink-0 self-center ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                            <div className="flex items-center gap-1">
                              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Last Chatbot: </span>
                              <span className={`text-sm ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}>{lastChatbot ? formatDateShort(lastChatbot) : 'N/A'}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <Pill size={14} className={`flex-shrink-0 self-center ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                            <div className="flex items-center gap-1">
                              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Last Chemo: </span>
                              <span className={`text-sm ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}>{lastChemo && lastChemo !== 'None' ? formatDateShort(lastChemo) : 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Severity Badge (pill-shaped) */}
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex-shrink-0 ${
                          severity === 'urgent'
                            ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-500 text-white'
                            : severity === 'severe'
                            ? isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-500 text-white'
                            : severity === 'moderate'
                            ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-500 text-white'
                            : isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500 text-white'
                        }`}>
                          {severity}
                        </span>
                      </div>

                      {/* View Details link */}
                      <div className={`flex justify-end mt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patients/${patient.id}`);
                          }}
                          className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${
                            isDark 
                              ? 'text-blue-400 hover:text-blue-300' 
                              : 'text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          <span>View Details</span>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 pb-4">
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                showFirstButton
                showLastButton
                size={isMobile ? 'small' : 'medium'}
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: isDark ? '#cbd5e1' : '#475569',
                    '&.Mui-selected': {
                      backgroundColor: isDark ? '#2563EB' : '#2563EB',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: isDark ? '#3B82F6' : '#3B82F6',
                      },
                    },
                    '&:hover': {
                      backgroundColor: isDark ? '#2A2725' : '#f1f5f9',
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>
      {/* Add Patient Modal */}
      <AddPatientModal
        isOpen={isAddPatientModalOpen}
        onClose={() => setIsAddPatientModalOpen(false)}
        onSubmit={async (formData) => {
          const payload = toAddManualPatientPayload(formData);
          await addPatientMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
};

export default DashboardPage;

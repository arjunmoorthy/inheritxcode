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
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Drawer from '@mui/material/Drawer';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
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
  Pill,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { usePatientSummaries, type PatientSummary } from '../../services/dashboard';
import { useAddManualPatient, type AddManualPatientPayload } from '../../services/patients';
import { useThemeMode } from '@oncolife/ui-components';
import { useAuth } from '../../contexts/AuthContext';
import { useStaffListDoctors } from '../../services/staff';
import { AddPatientModal, type PatientFormValues } from './components/AddPatientModal';
import { ChatSummariesModal } from './components/ChatSummariesModal';

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
    location: form.location || undefined,
    // cancer_type: form.diagnosis,
    diagnosis: form.diagnosis,
    oncologist: form.oncologist || undefined,
    start_date: form.treatmentStartDate || undefined,
    end_date: form.endDate || undefined,
    plan_name: form.regimenName || undefined,
    past_medical_history: form.pastMedicalHistory || undefined,
    past_surgical_history: form.pastSurgicalHistory || undefined,
    chemotherapy_day: form.dayOfChemo || undefined,
    day_of_chemotherapy_treatment: form.dayOfChemo || undefined,
    next_chemotherapy_date: form.nextChemoDate || undefined,
    next_chemotherapy_treatment: form.nextChemoDate || undefined,
    physician_ids: form.physicianIds && form.physicianIds.length > 0 ? form.physicianIds : undefined,
  };
}

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isDark } = useThemeMode();
  const { user } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [search, setSearch] = useState('');
  const [symptomTypeFilter, setSymptomTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [checkInFilter, setCheckInFilter] = useState('all');
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedPatientForSummary, setSelectedPatientForSummary] = useState<{ uuid: string; name: string } | null>(null);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [selectedPhysicianIds, setSelectedPhysicianIds] = useState<(string | number)[]>(['all']);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Debounce search: wait 400ms after typing stops; clear triggers API immediately
  // Set default physician from user profile if not admin
  useEffect(() => {
    if (user && user.staff_id && selectedPhysicianIds.includes('all')) {
      // Defaulting to 'all' as per user's "limiting" concern
    }
  }, [user]);

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

  const { data, isLoading, error } = usePatientSummaries(1, debouncedSearch, 'all', selectedPhysicianIds);
  const { data: doctors = [] } = useStaffListDoctors();
  const addPatientMutation = useAddManualPatient();

  const handleOpenSummary = (e: React.MouseEvent, patient: PatientSummary) => {
    e.stopPropagation();
    setSelectedPatientForSummary({
      uuid: patient.patientUuid || patient.id,
      name: patient.patientName
    });
    setIsSummaryModalOpen(true);
  };

  // Helper functions - defined before use
  const formatDOB = (dateString: string) => {
    if (!dateString || dateString === 'None' || dateString === 'Invalid Date') return 'N/A';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatDateShort = (dateString: string) => {
    if (!dateString || dateString === 'None' || dateString === 'Invalid Date' || dateString === 'null') return 'N/A';
    try {
      // Preserve source calendar date from API strings (YYYY-MM-DD or ISO timestamp)
      // to avoid timezone-based day shifts in UI.
      const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = Number(match[1]);
        const monthIndex = Number(match[2]) - 1;
        const day = Number(match[3]);
        const utcDate = new Date(Date.UTC(year, monthIndex, day));
        return utcDate.toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
          timeZone: 'UTC',
        });
      }

      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return dateString;
    }
  };

  const getLastChemo = (patient: PatientSummary): string => {
    const p = patient as PatientSummary & { last_chemo_date?: string | null };
    const fromApi = patient.lastChemoDate ?? p.last_chemo_date ?? null;
    const normalized = fromApi ? String(fromApi).trim() : '';
    if (normalized && normalized !== 'null' && normalized !== 'None') return normalized;
    return 'N/A';
  };

  const getNextChemo = (patient: PatientSummary): string => {
    const fromApi = patient.nextChemotherapyTreatment ?? (patient as any).next_chemotherapy_date ?? (patient as any).next_chemotherapy_treatment ?? null;
    const normalized = fromApi ? String(fromApi).trim() : '';
    if (normalized && normalized !== 'null' && normalized !== 'None' && normalized !== '') return normalized;
    return 'N/A';
  };

  const getDiagnosis = (patient: PatientSummary): string => {
    const p = patient as PatientSummary & { diagnosis?: string | null; cancer_type?: string | null; diseaseType?: string | null };
    const fromApi = p.diagnosis ?? p.cancer_type ?? p.diseaseType;
    if (fromApi && String(fromApi).trim()) return String(fromApi).trim();
    return 'N/A';
  };


  const getSeverity = (patient: PatientSummary): 'mild' | 'moderate' | 'severe' | 'urgent' | null => {
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
    return null;
  };

  /*
// Mapping of symptom severity string to clinical priority
const mapSeverityToPriority = (severity: string | null | undefined): 'low' | 'medium' | 'high' | 'urgent' => {
  if (!severity) return 'low';
  switch (severity.toLowerCase()) {
    case 'urgent':
      return 'urgent';
    case 'severe':
      return 'high';
    case 'moderate':
      return 'medium';
    case 'mild':
    default:
      return 'low';
  }
};
*/

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

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const handleSymptomTypeChange = (event: any) => {
    setSymptomTypeFilter(event.target.value);
  };

  const handleSeverityChange = (event: any) => {
    setSeverityFilter(event.target.value);
  };

  const handleCheckInChange = (event: any) => {
    setCheckInFilter(event.target.value);
  };

  const handlePhysicianChange = (event: any) => {
    const {
      target: { value },
    } = event;

    const newValues = typeof value === 'string' ? value.split(',') : value;

    // Logic for "All Providers"
    if (newValues.includes('all')) {
      // If "all" was just added, it should be the only one (or we treat it as "clear filters")
      // Actually, if "all" is selected, we usually want to clear others.
      // Or if others are selected and user clicks "all", we switch to all.
      // Most likely: if they select a doctor, "all" should be removed. 
      // If they select "all", remove others.

      const lastSelected = newValues[newValues.length - 1];
      if (lastSelected === 'all') {
        setSelectedPhysicianIds(['all']);
      } else {
        // "all" was already there, but they added a doctor
        const filtered = newValues.filter((v: any) => v !== 'all');
        setSelectedPhysicianIds(filtered.length > 0 ? filtered : ['all']);
      }
    } else {
      setSelectedPhysicianIds(newValues.length > 0 ? newValues : ['all']);
    }
  };

  const getPatientRouteId = (patient: PatientSummary): string => {
    return patient.patientUuid || patient.id;
  };

  return (
    <div className={`doctor-dashboard flex flex-col h-full w-full overflow-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[rgb(250,248,245)]'} transition-colors duration-200`}>
      {/* Fixed Header - Compact on mobile */}
      <div
        className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917] border-b border-slate-800/50' : 'bg-white/95 backdrop-blur-sm border-b border-slate-200/60'} transition-all duration-200 shadow-sm`}
      >
        <div className="px-4 py-4 sm:p-6 sm:pb-5 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:justify-between md:items-center">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className={`p-2 sm:p-2.5 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Activity size={isMobile ? 20 : 22} className={isDark ? 'text-blue-400' : 'text-secondary'} />
              </div>
              <div className="min-w-0">
                <h3 className={`text-xl sm:text-2xl md:text-[1.75rem] font-bold font-serif ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 leading-tight truncate`}>
                  Patient Dashboard
                </h3>
                <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1 sm:mt-1.5 mb-0 font-medium hidden sm:block`}>
                  Monitor patient symptoms and clinical trends
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddPatientModalOpen(true)}
              className={`inline-flex text-white items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-100 w-full sm:w-auto ${isDark
                ? 'bg-blue-600 hover:bg-blue-500'
                : 'bg-[#1e3a5f] hover:bg-[#2e5077]'
                }`}
            >
              <UserPlus size={16} />
              <span>Add Patient</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fixed Search and Filters Bar - Compact on mobile with Filters drawer */}
      <div
        className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917]/95 backdrop-blur-sm border-b border-slate-800/50' : 'bg-white/95 backdrop-blur-sm border-b border-slate-200/60'} transition-all duration-200 shadow-md`}
      >
        <div className="px-4 py-4 sm:p-6 sm:py-5 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
            {/* Mobile: Filters button opens drawer; Desktop: inline dropdowns */}
            {isMobile ? (
              <div className="flex flex-row gap-2 w-full">
                <div className="doctor-search-bar flex-1 min-w-0">
                  <TextField
                    fullWidth
                    placeholder="Search patients..."
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
                        '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                      },
                    }}
                  />
                </div>
                <Button
                  variant="outlined"
                  onClick={() => setFiltersDrawerOpen(true)}
                  sx={{
                    minWidth: '46px',
                    width: '46px',
                    height: '40px',
                    borderRadius: '12px',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    p: 0,
                    '&:hover': {
                      borderColor: isDark ? '#475569' : '#cbd5e1',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  <SlidersHorizontal size={20} />
                </Button>
              </div>
            ) : (
              <div className="flex flex-row gap-4 items-end flex-wrap w-full justify-between">
                {/* Provider Filter - Admin Only */}
                 <div className="flex flex-col gap-1.5 w-full sm:w-[250px]">
                    <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', ml: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                      Provider
                    </Typography>
                    <FormControl size="small" sx={{ width: { xs: '100%', sm: 250 } }}>
                      <Select
                        multiple
                        value={selectedPhysicianIds}
                        onChange={handlePhysicianChange}
                        displayEmpty
                        IconComponent={ChevronDown}
                        renderValue={(selected) => {
                          if (selected.includes('all')) return 'All Providers';
                          if (selected.length === 0) return 'All Providers';
                          if (selected.length === 1) {
                            const doc = doctors.find(d => String(d.id) === String(selected[0]));
                            return doc?.full_name || `${doc?.first_name || ''} ${doc?.last_name || ''}`.trim() || `Doctor #${selected[0]}`;
                          }
                          return `${selected.length} Selected`;
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              backgroundColor: isDark ? '#252320' : 'white',
                              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                              borderRadius: '12px',
                              marginTop: '4px',
                              maxHeight: 400,
                              boxShadow: isDark
                                ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4)'
                                : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            },
                          },
                        }}
                        sx={{
                          borderRadius: '12px',
                          backgroundColor: isDark ? '#1A1917' : 'white',
                          color: isDark ? '#f1f5f9' : '#0f172a',
                          fontWeight: 500,
                          height: '40px',
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#475569' : '#cbd5e1' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2563EB' },
                          '& .MuiSelect-select': {
                            paddingTop: '8px',
                            paddingBottom: '8px',
                          }
                        }}
                      >
                        <MenuItem value="all" sx={{ py: 0.5 }}>
                          <Checkbox
                            size="small"
                            checked={selectedPhysicianIds.includes('all')}
                            sx={{ color: isDark ? '#64748b' : undefined, '&.Mui-checked': { color: '#2563EB' } }}
                          />
                          <ListItemText
                            primary="All Providers"
                            primaryTypographyProps={{ variant: 'body2', fontWeight: selectedPhysicianIds.includes('all') ? 600 : 400, color: isDark ? '#f1f5f9' : '#0f172a' }}
                          />
                        </MenuItem>
                        {doctors.map((doc) => {
                          const isSelected = selectedPhysicianIds.indexOf(doc.id) > -1;
                          return (
                            <MenuItem key={doc.id} value={doc.id} sx={{ py: 0.5 }}>
                              <Checkbox
                                size="small"
                                checked={isSelected}
                                sx={{ color: isDark ? '#64748b' : undefined, '&.Mui-checked': { color: '#2563EB' } }}
                              />
                              <ListItemText
                                primary={doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || `Doctor #${doc.id}`}
                                primaryTypographyProps={{ variant: 'body2', fontWeight: isSelected ? 600 : 400, color: isDark ? '#f1f5f9' : '#0f172a' }}
                              />
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  </div>

                {/* Search Filter */}
                <div className="flex flex-col gap-1.5 w-full sm:w-[250px]">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', ml: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                    Search
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Search by name..."
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
                      width: { xs: '100%', sm: 250 },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        height: '40px',
                        backgroundColor: isDark ? '#1A1917' : 'white',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        '& fieldset': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                        '&:hover fieldset': { borderColor: isDark ? '#475569' : '#cbd5e1' },
                      },
                    }}
                  />
                </div>

                {/* Symptom Type Filter */}
                <div className="flex flex-col gap-1.5 w-full sm:w-[250px]">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', ml: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                    Symptom Type
                  </Typography>
                  <FormControl size="small" sx={{ width: { xs: '100%', sm: 250 } }}>
                    <Select
                      value={symptomTypeFilter}
                      onChange={handleSymptomTypeChange}
                      IconComponent={ChevronDown}
                      sx={{
                        borderRadius: '12px',
                        height: '40px',
                        backgroundColor: isDark ? '#1A1917' : 'white',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                      }}
                    >
                      <MenuItem value="all">All Symptoms</MenuItem>
                      <MenuItem value="fatigue">Fatigue</MenuItem>
                      <MenuItem value="pain">Pain</MenuItem>
                      <MenuItem value="nausea">Nausea</MenuItem>
                      <MenuItem value="breathing">Breathing Issues</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                {/* Severity Filter */}
                <div className="flex flex-col gap-1.5 w-full sm:w-[250px]">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', ml: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                    Severity
                  </Typography>
                  <FormControl size="small" sx={{ width: { xs: '100%', sm: 250 } }}>
                    <Select
                      value={severityFilter}
                      onChange={handleSeverityChange}
                      IconComponent={ChevronDown}
                      sx={{
                        borderRadius: '12px',
                        height: '40px',
                        backgroundColor: isDark ? '#1A1917' : 'white',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                      }}
                    >
                      <MenuItem value="all">All Severities</MenuItem>
                      <MenuItem value="mild">Mild</MenuItem>
                      <MenuItem value="moderate">Moderate</MenuItem>
                      <MenuItem value="severe">Severe</MenuItem>
                      <MenuItem value="urgent">Urgent</MenuItem>
                    </Select>
                  </FormControl>
                </div>

                {/* Check-in Filter */}
                <div className="flex flex-col gap-1.5 w-full sm:w-[250px]">
                  <Typography variant="caption" sx={{ fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', ml: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                    Last Chatbot Check-in
                  </Typography>
                  <FormControl size="small" sx={{ width: { xs: '100%', sm: 250 } }}>
                    <Select
                      value={checkInFilter}
                      onChange={handleCheckInChange}
                      IconComponent={ChevronDown}
                      sx={{
                        borderRadius: '12px',
                        height: '40px',
                        backgroundColor: isDark ? '#1A1917' : 'white',
                        color: isDark ? '#f1f5f9' : '#0f172a',
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
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
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      <Drawer
        anchor="bottom"
        open={filtersDrawerOpen}
        onClose={() => setFiltersDrawerOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: isDark ? '#1A1917' : 'white',
            maxHeight: '85vh',
          },
        }}
      >
        <div className={`p-4 pb-6 ${isDark ? 'bg-[#1A1917]' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-4">
            <Typography variant="h6" sx={{ fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>
              Filters
            </Typography>
            <Button size="small" onClick={() => setFiltersDrawerOpen(false)} sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              Done
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            {user?.role === 'admin' && (
              <FormControl size="small" fullWidth className="doctor-filter-select">
                <InputLabel sx={{ color: isDark ? '#94a3b8' : '#64748b', '&.Mui-focused': { color: '#2563EB' } }}>Provider</InputLabel>
                <Select
                  multiple
                  value={selectedPhysicianIds}
                  label="Provider"
                  onChange={handlePhysicianChange}
                  renderValue={(selected) => {
                    if (selected.includes('all')) return 'All Providers';
                    if (selected.length === 0) return 'All Providers';
                    return `${selected.length} Selected`;
                  }}
                  sx={{
                    borderRadius: '8px',
                    backgroundColor: isDark ? '#1A1917' : 'white',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                  }}
                >
                  <MenuItem value="all">
                    <Checkbox checked={selectedPhysicianIds.includes('all')} />
                    <ListItemText primary="All Providers" />
                  </MenuItem>
                  {doctors.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      <Checkbox checked={selectedPhysicianIds.indexOf(doc.id) > -1} />
                      <ListItemText primary={doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || `Doctor #${doc.id}`} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <FormControl size="small" fullWidth className="doctor-filter-select">
              <InputLabel sx={{ color: isDark ? '#94a3b8' : '#64748b', '&.Mui-focused': { color: '#2563EB' } }}>Symptom Type</InputLabel>
              <Select
                value={symptomTypeFilter}
                label="Symptom Type"
                onChange={(e) => { handleSymptomTypeChange(e); }}
                sx={{
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                }}
              >
                <MenuItem value="all">All Symptoms</MenuItem>
                <MenuItem value="fatigue">Fatigue</MenuItem>
                <MenuItem value="pain">Pain</MenuItem>
                <MenuItem value="nausea">Nausea</MenuItem>
                <MenuItem value="breathing">Breathing Issues</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth className="doctor-filter-select">
              <InputLabel sx={{ color: isDark ? '#94a3b8' : '#64748b', '&.Mui-focused': { color: '#2563EB' } }}>Severity</InputLabel>
              <Select
                value={severityFilter}
                label="Severity"
                onChange={(e) => { handleSeverityChange(e); }}
                sx={{
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
                }}
              >
                <MenuItem value="all">All Severities</MenuItem>
                <MenuItem value="mild">Mild</MenuItem>
                <MenuItem value="moderate">Moderate</MenuItem>
                <MenuItem value="severe">Severe</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth className="doctor-filter-select">
              <InputLabel sx={{ color: isDark ? '#94a3b8' : '#64748b', '&.Mui-focused': { color: '#2563EB' } }}>Last Chatbot Check-in</InputLabel>
              <Select
                value={checkInFilter}
                label="Last Chatbot Check-in"
                onChange={(e) => { handleCheckInChange(e); }}
                sx={{
                  borderRadius: '8px',
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#334155' : '#e2e8f0' },
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
      </Drawer>

      {/* Patient List Container - Scrollable */}
      <div
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${isDark ? '[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-slate-800' : '[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100'}`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? '#475569 #1A1917' : '#cbd5e1 #f1f5f9',
        }}
      >
        <div className="px-4 py-4 sm:p-6 sm:pt-4 sm:pb-4 max-w-[1400px] mx-auto w-full">
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
              {filteredPatients.map((patient) => {
                const lastChemo = getLastChemo(patient);
                const lastChatbot = patient.lastUpdated || '';
                const nextChemo = getNextChemo(patient);
                const dob = patient.dateOfBirth || (patient as any).date_of_birth || '';
                const patientRouteId = getPatientRouteId(patient);
                const severity = getSeverity(patient) as 'mild' | 'moderate' | 'severe' | 'urgent' | null;

                return (
                  <div
                    key={patient.id}
                    onClick={() => navigate(`/patients/${patientRouteId}`)}
                    className={`group ${isDark ? 'bg-[#252320] border-slate-700/50 hover:border-blue-500/50' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg'} rounded-lg border overflow-hidden transition-all duration-300 cursor-pointer shadow-sm`}
                  >
                    {/* Patient Card Content - tighter padding on mobile */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:gap-4">
                        {/* Top row on mobile: Name + Severity badge */}
                        <div className="flex flex-row items-start justify-between gap-2 flex-wrap">
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                              <div className={`font-bold ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'} text-base leading-tight`}>
                                {patient.patientName}
                              </div>
                              {/* Chat Summary Section */}
                              {/* <div className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full border ${isDark ? 'bg-blue-500/5 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                <MessageCircle size={12} className="shrink-0" />
                                <span className="text-[11px] font-medium truncate max-w-[250px]">
                                  {patient.summary && patient.summary !== '—' ? patient.summary : 'Recently reported mild cough and pain'}
                                </span>
                              </div> */}
                            </div>
                            <div className={`text-xs mt-0.5 flex items-center gap-3 sm:gap-4 flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              <span className="flex items-center gap-1.5">
                                <FileText size={14} className="flex-shrink-0" />
                                <span>MRN: {patient.mrn || 'N/A'}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Calendar size={14} className="flex-shrink-0" />
                                <span>DOB: {dob ? formatDOB(dob) : 'N/A'}</span>
                              </span>
                            </div>
                          </div>
                          {/* Severity Badge - top-right on mobile */}
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold tracking-wider flex-shrink-0 ${severity === 'urgent'
                            ? isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-500 text-white'
                            : severity === 'severe'
                              ? isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-500 text-white'
                              : severity === 'moderate'
                                ? isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-500 text-white'
                                : severity === 'mild'
                                  ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500 text-white'
                                  : isDark ? 'bg-slate-500/20 text-slate-300' : 'bg-slate-200 text-slate-700'
                            }`}>
                            {severity ? `${severity.charAt(0).toUpperCase()}${severity.slice(1)}` : 'N/A'}
                          </span>

                        </div>

                        {/* Diagnosis, Last Chatbot, Last Chemo - stacked on mobile, row on desktop */}
                        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-y-2 sm:gap-x-6 min-w-0">
                          <div className="flex items-center gap-2">
                            <Stethoscope size={14} className={`flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                            <div className="flex items-center gap-1 min-w-0">
                              <span className={`text-xs shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Diagnosis: </span>
                              <span className={`text-sm truncate ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}>{getDiagnosis(patient)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle size={14} className={`flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                            <div className="flex items-center gap-1">
                              <span className={`text-xs shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Last Chatbot: </span>
                              <span className={`text-sm ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}>{lastChatbot ? formatDateShort(lastChatbot) : 'N/A'}</span>
                            </div>
                          </div>
                          {lastChemo && lastChemo !== 'None' && lastChemo !== 'Invalid Date' && (
                            <div className="flex items-center gap-2">
                              <Pill size={14} className={`flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                              <div className="flex items-center gap-1">
                                <span className={`text-xs shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Last Chemo: </span>
                                <span className={`text-sm ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}>{formatDateShort(lastChemo)}</span>
                              </div>
                            </div>
                          )}
                          {nextChemo && nextChemo !== 'N/A' && (
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className={`flex-shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
                              <div className="flex items-center gap-1">
                                <span className={`text-xs shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Next Chemo: </span>
                                <span className={`text-sm ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}>{formatDateShort(nextChemo)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className={`flex justify-end gap-3 mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patients/${patientRouteId}`);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${isDark
                            ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300'
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                            }`}
                        >
                          <span>View Details</span>
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={(e) => handleOpenSummary(e, patient)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 border ${isDark
                            ? 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                          <FileText size={16} />
                          <span>Summaries</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
        onSuccess={() => {
          setSnackbar({
            open: true,
            message: 'Patient added successfully.',
            severity: 'success',
          });
        }}
      />

      {/* Chat Summaries Modal */}
      {selectedPatientForSummary && (
        <ChatSummariesModal
          isOpen={isSummaryModalOpen}
          onClose={() => setIsSummaryModalOpen(false)}
          patientUuid={selectedPatientForSummary.uuid}
          patientName={selectedPatientForSummary.name}
        />
      )}

      {/* Success / error notification */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default DashboardPage;

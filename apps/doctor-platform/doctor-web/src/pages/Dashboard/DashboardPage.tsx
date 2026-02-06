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

import React, { useState } from 'react';
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
  Calendar, 
  User, 
  FileText, 
  AlertTriangle,
  ChevronRight,
  Activity,
  TrendingUp,
  Clock
} from 'lucide-react';
import { usePatientSummaries, type PatientSummary } from '../../services/dashboard';
import { useThemeMode } from '@oncolife/ui-components';

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  
  const { data, isLoading, error } = usePatientSummaries(page, search, filter);
  
  // Calculate dynamic stats from patient data
  const urgentCount = data?.data.filter(p => p.maxSeverity === 'urgent' || p.hasEscalation).length || 0;
  const checkInsToday = data?.data.filter(p => {
    if (!p.lastUpdated) return false;
    const lastCheckin = new Date(p.lastUpdated);
    const today = new Date();
    return lastCheckin.toDateString() === today.toDateString();
  }).length || 0;
  
  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
  };
  
  const handleFilterChange = (event: any) => {
    setFilter(event.target.value);
    setPage(1);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  const getSeverityStyles = (severity: 'mild' | 'moderate' | 'severe' | 'urgent') => {
    const styles = {
      mild: {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        accent: '#10B981',
      },
      moderate: {
        bg: 'bg-amber-50 dark:bg-amber-950/20',
        text: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/50',
        accent: '#F59E0B',
      },
      severe: {
        bg: 'bg-orange-50 dark:bg-orange-950/20',
        text: 'text-orange-600 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800/50',
        accent: '#EA580C',
      },
      urgent: {
        bg: 'bg-red-50 dark:bg-red-950/20',
        text: 'text-red-600 dark:text-red-500',
        border: 'border-red-200 dark:border-red-800/50',
        accent: '#DC2626',
      },
    };
    return styles[severity];
  };
  
  return (
    <div className={`p-6 max-w-[1400px] mx-auto  ${isDark ? 'bg-[#1A1917]' : 'bg-background'} min-h-screen transition-colors duration-200`}>
      {/* Header */}
      <div className="flex flex-col gap-2 mb-6 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className={`text-3xl md:text-[1.75rem] font-bold ${isDark ? 'text-slate-100' : 'text-primary'} m-0 flex items-center gap-3`}>
            <Activity size={28} className={isDark ? 'text-blue-400' : 'text-secondary'} />
            Patient Dashboard
          </h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1 mb-0`}>
            Monitor patient symptoms and clinical trends
          </p>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Patients */}
        <div className={`${isDark ? 'bg-[#1A1917] border-slate-700/50 hover:shadow-lg hover:border-slate-600' : 'bg-white border-slate-200 hover:shadow-md'} rounded-xl p-5 border relative overflow-hidden transition-all duration-200`}>
          <div className={`absolute top-0 left-0 right-0 h-[3px] ${isDark ? 'bg-blue-500' : 'bg-secondary'}`} />
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${isDark ? 'bg-blue-950/30 text-blue-400' : 'bg-blue-50 text-secondary'}`}>
            <User size={20} />
          </div>
          <div className={`text-[1.75rem] font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'} leading-none mb-1`}>
            {data?.total || 0}
          </div>
          <div className={`text-[0.8125rem] ${isDark ? 'text-slate-400' : 'text-slate-600'} font-medium`}>
            Total Patients
          </div>
        </div>
        
        {/* Urgent Cases */}
        <div className={`${isDark ? 'bg-[#1A1917] border-slate-700/50 hover:shadow-lg hover:border-slate-600' : 'bg-white border-slate-200 hover:shadow-md'} rounded-xl p-5 border relative overflow-hidden transition-all duration-200`}>
          <div className={`absolute top-0 left-0 right-0 h-[3px] ${isDark ? 'bg-red-500' : 'bg-red-600'}`} />
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${isDark ? 'bg-red-950/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
            <AlertTriangle size={20} />
          </div>
          <div className={`text-[1.75rem] font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'} leading-none mb-1`}>
            {urgentCount}
          </div>
          <div className={`text-[0.8125rem] ${isDark ? 'text-slate-400' : 'text-slate-600'} font-medium`}>
            Urgent Cases
          </div>
        </div>
        
        {/* Check-ins Today */}
        <div className={`${isDark ? 'bg-[#1A1917] border-slate-700/50 hover:shadow-lg hover:border-slate-600' : 'bg-white border-slate-200 hover:shadow-md'} rounded-xl p-5 border relative overflow-hidden transition-all duration-200`}>
          <div className={`absolute top-0 left-0 right-0 h-[3px] ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${isDark ? 'bg-emerald-950/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            <TrendingUp size={20} />
          </div>
          <div className={`text-[1.75rem] font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'} leading-none mb-1`}>
            {checkInsToday}
          </div>
          <div className={`text-[0.8125rem] ${isDark ? 'text-slate-400' : 'text-slate-600'} font-medium`}>
            Check-ins Today
          </div>
        </div>
        
        {/* Avg Response Time */}
        <div className={`${isDark ? 'bg-[#1A1917] border-slate-700/50 hover:shadow-lg hover:border-slate-600' : 'bg-white border-slate-200 hover:shadow-md'} rounded-xl p-5 border relative overflow-hidden transition-all duration-200`}>
          <div className={`absolute top-0 left-0 right-0 h-[3px] ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${isDark ? 'bg-purple-950/30 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
            <Clock size={20} />
          </div>
          <div className={`text-[1.75rem] font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'} leading-none mb-1`}>
            -
          </div>
          <div className={`text-[0.8125rem] ${isDark ? 'text-slate-400' : 'text-slate-600'} font-medium`}>
            Avg Response Time
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex gap-3 items-center flex-wrap mb-5">
        <div className="flex-1 min-w-[280px]">
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
                borderRadius: '10px',
                backgroundColor: isDark ? '#1A1917' : 'white',
                color: isDark ? '#f1f5f9' : '#0f172a',
                '& fieldset': {
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                },
                '&:hover fieldset': {
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#2563EB',
                },
              },
              '& .MuiInputBase-input': {
                color: isDark ? '#f1f5f9' : '#0f172a',
                '&::placeholder': {
                  color: isDark ? '#94a3b8' : '#64748b',
                  opacity: 0.6,
                },
              },
            }}
          />
        </div>
        
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel 
            sx={{ 
              color: isDark ? '#94a3b8' : '#64748b',
              '&.Mui-focused': { color: '#2563EB' }
            }}
          >
            Time Range
          </InputLabel>
          <Select
            value={filter}
            label="Time Range"
            onChange={handleFilterChange}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  marginTop: '8px',
                  boxShadow: isDark 
                    ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                    : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                },
              },
            }}
            sx={{ 
              borderRadius: '10px',
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
            <MenuItem 
              value="all"
              sx={{
                backgroundColor: isDark ? '#1A1917' : 'white',
                color: isDark ? '#f1f5f9' : '#0f172a',
                '&:hover': {
                  backgroundColor: isDark ? '#2A2725' : '#f1f5f9',
                },
                '&.Mui-selected': {
                  backgroundColor: isDark ? '#2563EB' : '#2563EB',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: isDark ? '#3B82F6' : '#3B82F6',
                  },
                },
              }}
            >
              All Time
            </MenuItem>
            <MenuItem 
              value="today"
              sx={{
                backgroundColor: isDark ? '#1A1917' : 'white',
                color: isDark ? '#f1f5f9' : '#0f172a',
                '&:hover': {
                  backgroundColor: isDark ? '#2A2725' : '#f1f5f9',
                },
                '&.Mui-selected': {
                  backgroundColor: isDark ? '#2563EB' : '#2563EB',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: isDark ? '#3B82F6' : '#3B82F6',
                  },
                },
              }}
            >
              Today
            </MenuItem>
            <MenuItem 
              value="week"
              sx={{
                backgroundColor: isDark ? '#1A1917' : 'white',
                color: isDark ? '#f1f5f9' : '#0f172a',
                '&:hover': {
                  backgroundColor: isDark ? '#2A2725' : '#f1f5f9',
                },
                '&.Mui-selected': {
                  backgroundColor: isDark ? '#2563EB' : '#2563EB',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: isDark ? '#3B82F6' : '#3B82F6',
                  },
                },
              }}
            >
              This Week
            </MenuItem>
            <MenuItem 
              value="month"
              sx={{
                backgroundColor: isDark ? '#1A1917' : 'white',
                color: isDark ? '#f1f5f9' : '#0f172a',
                '&:hover': {
                  backgroundColor: isDark ? '#2A2725' : '#f1f5f9',
                },
                '&.Mui-selected': {
                  backgroundColor: isDark ? '#2563EB' : '#2563EB',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: isDark ? '#3B82F6' : '#3B82F6',
                  },
                },
              }}
            >
              This Month
            </MenuItem>
          </Select>
        </FormControl>
      </div>
      
      {/* Patient List */}
      {error && (
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
            Error loading patient summaries. Please try again.
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
      ) : data?.data.length === 0 ? (
        <div className={`text-center py-12 px-6 ${isDark ? 'bg-[#1A1917] border-slate-700/50' : 'bg-white border-slate-300'} rounded-xl border border-dashed`}>
          <User size={48} className={`${isDark ? 'text-slate-500' : 'text-slate-400'} mx-auto mb-4`} />
          <h3 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 mb-2`}>
            No Patients Found
          </h3>
          <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm m-0`}>
            Try adjusting your search or filter criteria.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.data.map((patient) => {
            const severity = getSeverity(patient);
            const severityStyles = getSeverityStyles(severity);
            
            return (
              <div
                key={patient.id}
                onClick={() => navigate(`/patients/${patient.id}`)}
                className={`${isDark ? 'bg-[#1A1917] border-slate-700/50 hover:border-blue-500/70 hover:shadow-xl' : 'bg-white border-slate-200 hover:border-secondary hover:shadow-lg'} rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer hover:-translate-y-0.5`}
              >
                {/* Patient Header */}
                <div className={`flex justify-between p-4 md:p-5 ${isDark ? 'bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30 border-slate-700/50' : 'bg-gradient-to-r from-primary/8 via-secondary/8 to-primary/8 border-slate-200'} border-b md:flex-row flex-col md:items-center items-start gap-3`}>
                  <div className="flex items-center gap-6 flex-wrap md:flex-nowrap">
                    {/* Patient Name */}
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-full ${isDark ? 'bg-blue-600' : 'bg-primary'} text-white flex items-center justify-center font-semibold text-sm`}>
                        {getInitials(patient.patientName)}
                      </div>
                      <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'} text-base`}>
                        {patient.patientName}
                      </span>
                    </div>
                    
                    {/* DOB Badge */}
                    <div className={`flex items-center gap-1.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <Calendar size={14} />
                      DOB: {patient.dateOfBirth}
                    </div>
                    
                    {/* MRN Badge */}
                    <div className={`flex items-center gap-1.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      <FileText size={14} />
                      MRN: {patient.mrn}
                    </div>
                  </div>
                  
                  {/* Severity Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${severityStyles.bg} ${severityStyles.text} border ${severityStyles.border}`}>
                    {severity}
                  </span>
                </div>
                
                {/* Patient Content */}
                <div className="p-4 md:p-5 flex flex-col gap-3">
                  <div className="flex gap-3 items-start">
                    <span className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'} text-xs uppercase tracking-wider min-w-[80px] pt-0.5`}>
                      Symptoms
                    </span>
                    <span className={`${isDark ? 'text-slate-100' : 'text-slate-900'} text-sm leading-relaxed flex-1`}>
                      {patient.symptoms || 'No symptoms reported'}
                    </span>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'} text-xs uppercase tracking-wider min-w-[80px] pt-0.5`}>
                      Summary
                    </span>
                    <span className={`${isDark ? 'text-slate-100' : 'text-slate-900'} text-sm leading-relaxed flex-1`}>
                      {patient.summary || 'No summary available'}
                    </span>
                  </div>
                </div>
                
                {/* View Details Link */}
                <div className={`flex items-center justify-end px-5 py-3 ${isDark ? 'border-slate-700/50 text-blue-400 hover:bg-[#2A2725]/50' : 'border-slate-200 text-secondary hover:bg-slate-50'} border-t text-sm font-medium group transition-colors duration-200`}>
                  View Details
                  <ChevronRight 
                    size={16} 
                    className="ml-1 transition-transform duration-200 group-hover:translate-x-1" 
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex justify-center mt-6 p-4">
          <Pagination
            count={data.totalPages}
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
  );
};

export default DashboardPage;

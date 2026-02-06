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
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { 
  ArrowLeft, 
  User,
  RefreshCw,
  Send,
  Download,
  Calendar as CalendarIcon,
  Activity,
} from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';
import {
  usePatientTimeline,
  usePatientDetails,
} from '../../services/dashboard';

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
  treatment_events: [],
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
  
  // Filter states
  const [startDate, setStartDate] = useState('2026-01-30');
  const [endDate, setEndDate] = useState('2026-02-06');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['all', 'cough', 'pain', 'vomiting', 'constipation']);
  const [severityRange, setSeverityRange] = useState<number[]>([0, 4]);

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
      dataPoints.forEach(dp => {
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
        dataPoints: dataPoints.map(dp => ({
          ...dp,
          dateIndex: sortedDates.indexOf(dp.date || ''),
        })).filter(dp => dp.dateIndex >= 0),
      }));

    return { dates: sortedDates, symptoms };
  }, [displayTimeline, selectedSymptoms]);

  const renderGraph = () => {
    if (timelineLoading) {
      return (
        <div className="h-[400px] flex items-center justify-center">
          <Skeleton variant="rectangular" width="100%" height="100%" />
        </div>
      );
    }

    if (!graphData.dates.length || !graphData.symptoms.length) {
      return (
        <div className={`h-[400px] flex flex-col items-center justify-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          <Activity size={48} className="mb-4 opacity-50" />
          <Typography>No symptom data available for this period</Typography>
        </div>
      );
    }

    const { dates, symptoms } = graphData;
    const chartHeight = 400;
    const chartPadding = { top: 20, right: 20, bottom: 60, left: 80 };
    const chartWidth = Math.max(800, dates.length * 50);

    // Y-axis positions for severity levels
    const severityLevels = ['relieved', 'mild', 'moderate', 'severe', 'very severe'];

    // Temperature Y-axis (right side)
    const tempLevels = [96, 98, 100, 102, 104];

    return (
      <div className="relative overflow-x-auto">
        <div 
          className={`relative ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg`}
          style={{ height: chartHeight, minWidth: chartWidth }}
        >
          {/* Y-axis labels - Severity (left) */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-5 px-2" style={{ width: chartPadding.left }}>
            {severityLevels.map((level, i) => (
              <span 
                key={level}
                className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                style={{ marginTop: i === 0 ? 0 : -12 }}
              >
                {level}
              </span>
            ))}
          </div>

          {/* Y-axis labels - Temperature (right) */}
          <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-5 px-2" style={{ width: chartPadding.right }}>
            {tempLevels.map((temp, i) => (
              <span 
                key={temp}
                className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                style={{ marginTop: i === 0 ? 0 : -12 }}
              >
                {i === 0 ? '°F' : temp.toString()}
              </span>
            ))}
          </div>

          {/* Grid lines */}
          <div className="absolute inset-0" style={{ left: chartPadding.left, right: chartPadding.right, top: chartPadding.top, bottom: chartPadding.bottom }}>
            {severityLevels.map((_, i) => (
              <div
                key={i}
                className={`absolute left-0 right-0 ${isDark ? 'border-slate-700' : 'border-slate-200'} border-t border-dashed`}
                style={{ top: `${(i / (severityLevels.length - 1)) * 100}%` }}
              />
            ))}
          </div>

          {/* Chart area */}
          <svg
            className="absolute inset-0"
            style={{ left: chartPadding.left, right: chartPadding.right, top: chartPadding.top, bottom: chartPadding.bottom }}
            viewBox={`0 0 ${chartWidth - chartPadding.left - chartPadding.right} ${chartHeight - chartPadding.top - chartPadding.bottom}`}
            preserveAspectRatio="none"
          >
            {symptoms.map((symptom) => {
              if (symptom.dataPoints.length < 2) return null;

              const isTemperature = symptom.name.toLowerCase() === 'temperature';
              const points = symptom.dataPoints
                .sort((a, b) => a.dateIndex - b.dateIndex)
                .map((dp) => {
                  const x = (dp.dateIndex / (dates.length - 1 || 1)) * (chartWidth - chartPadding.left - chartPadding.right);
                  let y: number;
                  
                  if (isTemperature) {
                    // Map temperature to Y position (96-104°F range)
                    const temp = typeof dp.severity_numeric === 'number' ? dp.severity_numeric : 98.6;
                    const normalized = (temp - 96) / (104 - 96);
                    y = (1 - normalized) * (chartHeight - chartPadding.top - chartPadding.bottom);
                  } else {
                    // Map severity to Y position (0-4 scale)
                    const severity = dp.severity_numeric || 0;
                    y = (1 - (severity / 4)) * (chartHeight - chartPadding.top - chartPadding.bottom);
                  }
                  
                  return { x, y, dp };
                });

              // Draw line
              const pathData = points.map((p, i) => 
                `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              ).join(' ');

              return (
                <g key={symptom.name}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={symptom.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((point, pointIdx) => (
                    <Tooltip
                      key={pointIdx}
                      title={`${symptom.name}: ${isTemperature ? `${point.dp.severity_numeric}°F` : point.dp.severity} on ${formatDateShort(point.dp.date || '')}`}
                    >
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        fill={symptom.color}
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-6 transition-all"
                      />
                    </Tooltip>
                  ))}
                </g>
              );
            })}
          </svg>

          {/* X-axis labels */}
          <div 
            className="absolute left-0 right-0 flex justify-between px-4"
            style={{ bottom: chartPadding.bottom - 40, left: chartPadding.left, right: chartPadding.right }}
          >
            {dates.slice(0, 7).map((date, idx) => (
              <span 
                key={idx}
                className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              >
                {formatDateShort(date)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#1A1917]' : 'bg-[#FAF8F5]'} transition-colors duration-200 overflow-hidden`}>
      {/* Header */}
      <div className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917] border-b border-slate-800/50' : 'bg-white/80 backdrop-blur-sm border-b border-slate-200/60'} transition-colors duration-200 shadow-sm`}>
        <div className="p-6 pb-5 max-w-[1600px] mx-auto w-full">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-4">
              <IconButton
                onClick={handleBack}
                className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}
              >
                <ArrowLeft size={20} />
              </IconButton>
              <div className={`p-2.5 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Activity size={22} className={isDark ? 'text-blue-400' : 'text-[#1e3a5f]'} />
              </div>
              <div>
                <h1 className={`text-2xl md:text-3xl font-bold font-serif ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 leading-tight`}>
                  Patient Dashboard
                </h1>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1 mb-0`}>
                  {patientDetails?.patientName || 'Patient Details'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outlined"
                size="small"
                startIcon={<User size={16} />}
                className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
                sx={{
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                  '&:hover': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  },
                }}
              >
                Patient Profile
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshCw size={16} />}
                className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
                sx={{
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                  '&:hover': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  },
                }}
              >
                Update Dashboard
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Send size={16} />}
                className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
                sx={{
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                  '&:hover': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  },
                }}
              >
                Send Fax
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download size={16} />}
                className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
                sx={{
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  color: isDark ? '#cbd5e1' : '#475569',
                  '&:hover': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  },
                }}
              >
                Download Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Left Sidebar - Filters */}
        <div className={`flex-shrink-0 w-full md:w-80 ${isDark ? 'bg-[#252320] border-r border-slate-800/50' : 'bg-white border-r border-slate-200/60'} transition-colors duration-200 overflow-y-auto`}>
          <div className="p-6 space-y-6">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Start Date
              </label>
              <TextField
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: <CalendarIcon size={18} className={`mr-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                }}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                End Date
              </label>
              <TextField
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: <CalendarIcon size={18} className={`mr-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                }}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Symptom Type
              </label>
              <div className="space-y-2">
                {[
                  { id: 'all', label: 'All Symptoms', color: null },
                  { id: 'cough', label: 'cough', color: '#FF9500' },
                  { id: 'pain', label: 'pain', color: '#10B981' },
                  { id: 'vomiting', label: 'vomiting', color: '#06B6D4' },
                  { id: 'constipation', label: 'constipation', color: '#2563EB' },
                ].map((symptom) => (
                  <FormControlLabel
                    key={symptom.id}
                    control={
                      <Checkbox
                        checked={selectedSymptoms.includes(symptom.id)}
                        onChange={() => handleSymptomToggle(symptom.id)}
                        sx={{
                          color: isDark ? '#475569' : '#64748b',
                          '&.Mui-checked': {
                            color: symptom.color || '#2563EB',
                          },
                        }}
                      />
                    }
                    label={
                      <div className="flex items-center gap-2">
                        {symptom.color && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: symptom.color }}
                          />
                        )}
                        <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                          {symptom.label}
                        </span>
                      </div>
                    }
                    className="m-0"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Overall Severity
              </label>
              <div className="px-2">
                <Slider
                  value={severityRange}
                  onChange={(_, newValue) => setSeverityRange(newValue as number[])}
                  min={0}
                  max={4}
                  step={0.1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0, label: 'symptom relieved' },
                    { value: 4, label: 'very severe' },
                  ]}
                  sx={{
                    color: '#2563EB',
                    '& .MuiSlider-thumb': {
                      backgroundColor: '#2563EB',
                    },
                    '& .MuiSlider-track': {
                      backgroundColor: '#2563EB',
                    },
                    '& .MuiSlider-markLabel': {
                      color: isDark ? '#94a3b8' : '#64748b',
                      fontSize: '0.75rem',
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Graph and Table */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Graph Section */}
            <div className={`${isDark ? 'bg-[#252320] border-slate-700/50' : 'bg-white border-slate-200'} rounded-lg border p-6`}>
              <div className="mb-6">
                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  Symptom & Temperature Timeline
                </h3>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4">
                  {graphData.symptoms.map((symptom) => (
                    <div key={symptom.name} className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div
                          className="w-3 h-0.5"
                          style={{ backgroundColor: symptom.color }}
                        />
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: symptom.color }}
                        />
                      </div>
                      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        → {symptom.name.charAt(0).toUpperCase() + symptom.name.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {renderGraph()}
            </div>

            {/* Table Section */}
            <div className={`${isDark ? 'bg-[#252320] border-slate-700/50' : 'bg-white border-slate-200'} rounded-lg border p-6`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Patient Data
              </h3>
              
              {staticTableData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Date
                        </th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Symptom
                        </th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Severity
                        </th>
                        <th className={`text-left py-3 px-4 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                          Temperature
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {staticTableData.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`border-b ${isDark ? 'border-slate-800/50 hover:bg-slate-800/30' : 'border-slate-100 hover:bg-slate-50'} transition-colors`}
                        >
                          <td className={`py-3 px-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {formatDate(row.date)}
                          </td>
                          <td className={`py-3 px-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {row.symptom}
                          </td>
                          <td className={`py-3 px-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            <Chip
                              label={row.severity}
                              size="small"
                              sx={{
                                backgroundColor: row.severity === 'Severe' 
                                  ? isDark ? 'rgba(234, 88, 12, 0.2)' : 'rgba(234, 88, 12, 0.1)'
                                  : row.severity === 'Moderate'
                                  ? isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)'
                                  : isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                                color: row.severity === 'Severe'
                                  ? isDark ? '#ea580c' : '#c2410c'
                                  : row.severity === 'Moderate'
                                  ? isDark ? '#f59e0b' : '#d97706'
                                  : isDark ? '#10b981' : '#059669',
                                fontWeight: 500,
                              }}
                            />
                          </td>
                          <td className={`py-3 px-4 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {row.temperature}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Typography>No table data</Typography>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailPage;

/**
 * Filters Sidebar Component
 * Contains date range, symptom type, and severity filters
 */

import React from 'react';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { Filter, X, Calendar as CalendarIcon, Activity } from 'lucide-react';

interface FiltersSidebarProps {
  isOpen: boolean;
  isDark: boolean;
  isMobile: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  selectedSymptoms: string[];
  symptomOptions: Array<{ id: string; label: string; color: string | null }>;
  severityRange: number[];
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onSymptomToggle: (symptom: string) => void;
  onSeverityRangeChange: (range: number[]) => void;
  onResetFilters: () => void;
}

const FiltersSidebar: React.FC<FiltersSidebarProps> = ({
  isOpen,
  isDark,
  isMobile,
  onClose,
  startDate,
  endDate,
  selectedSymptoms,
  symptomOptions,
  severityRange,
  onStartDateChange,
  onEndDateChange,
  onSymptomToggle,
  onSeverityRangeChange,
  onResetFilters,
}) => {
  return (
    <div
      className={`flex-shrink-0 transition-all duration-300 ease-in-out ${
        isOpen 
          ? 'w-full md:w-80 opacity-100 z-50 md:z-auto pointer-events-auto' 
          : 'w-0 md:w-0 opacity-0 md:opacity-0 z-0 pointer-events-none'
      } ${isDark ? 'bg-[#252320] border-r border-slate-800/50' : 'bg-white border-r border-slate-200/60'} ${
        isOpen ? 'absolute md:relative inset-0 md:inset-auto left-0 md:left-auto' : ''
      } flex flex-col overflow-hidden h-full`}
    >
      <div 
        className={`p-4 md:p-6 space-y-4 md:space-y-6 flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${isOpen ? 'block' : 'hidden md:hidden'} ${isDark ? '[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-slate-800' : '[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100'}`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? '#475569 #252320' : '#cbd5e1 #ffffff',
        }}
      >
        {/* Mobile Close Button */}
        {isMobile && (
          <div className={`sticky top-0 z-10 flex items-center justify-between mb-3 pb-3 border-b ${isDark ? 'border-slate-700/50 bg-[#252320]' : 'border-slate-200/70 bg-white'}`}>
            <div className="flex items-center gap-2">
              <Filter size={18} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
              <h3 className={`text-base font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Filters
              </h3>
            </div>
            <IconButton
              size="small"
              onClick={onClose}
              className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}
              aria-label="Close filters"
            >
              <X size={20} />
            </IconButton>
          </div>
        )}

        {/* Sidebar Header - Desktop */}
        {!isMobile && (
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <Filter size={18} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
              <h3 className={`text-base font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Filters
              </h3>
            </div>
            <Tooltip title="Clear all filters">
              <IconButton
                size="small"
                onClick={onResetFilters}
                className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}
                aria-label="Clear all filters"
              >
                <X size={16} />
              </IconButton>
            </Tooltip>
          </div>
        )}

        {/* Date Range Section */}
        <div className={`${isDark ? 'bg-slate-900/30' : 'bg-slate-50'} rounded-lg p-3 md:p-4 space-y-3 md:space-y-4`}>
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <CalendarIcon size={16} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
            <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Date Range
            </label>
          </div>
          
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Start Date
            </label>
            <TextField
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              size="small"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  fontSize: '0.875rem',
                  '& fieldset': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                  '&:hover fieldset': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#2563EB',
                    borderWidth: '2px',
                  },
                },
              }}
            />
          </div>

          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              End Date
            </label>
            <TextField
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              size="small"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDark ? '#1A1917' : 'white',
                  color: isDark ? '#f1f5f9' : '#0f172a',
                  fontSize: '0.875rem',
                  '& fieldset': {
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                  '&:hover fieldset': {
                    borderColor: isDark ? '#475569' : '#cbd5e1',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#2563EB',
                    borderWidth: '2px',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Symptom Type Section */}
        <div className={`${isDark ? 'bg-slate-900/30' : 'bg-slate-50'} rounded-lg p-3 md:p-4`}>
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <Activity size={16} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
            <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Symptom Type
            </label>
          </div>
          <div className="space-y-2">
            {symptomOptions.map((symptom) => (
              <div
                key={symptom.id}
                className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                  selectedSymptoms.includes(symptom.id)
                    ? isDark ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
                    : isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100'
                }`}
              >
                <Checkbox
                  checked={selectedSymptoms.includes(symptom.id)}
                  onChange={() => onSymptomToggle(symptom.id)}
                  size="small"
                  sx={{
                    color: isDark ? '#475569' : '#64748b',
                    padding: '4px',
                    '&.Mui-checked': {
                      color: symptom.color || '#2563EB',
                    },
                  }}
                />
                {symptom.color && (
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: symptom.color }}
                  />
                )}
                <span className={`text-sm flex-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {symptom.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Severity Slider Section */}
        <div className={`${isDark ? 'bg-slate-900/30' : 'bg-slate-50'} rounded-lg p-3 md:p-4`}>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Activity size={16} className={isDark ? 'text-slate-400' : 'text-slate-600'} />
            <label className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Overall Severity
            </label>
          </div>
          <div className="px-1">
            <Slider
              value={severityRange}
              onChange={(_, newValue) => onSeverityRangeChange(newValue as number[])}
              min={0}
              max={4}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => value.toFixed(1)}
              marks={[
                { value: 0, label: 'Relieved' },
                { value: 4, label: 'Very Severe' },
              ]}
              sx={{
                color: '#2563EB',
                '& .MuiSlider-thumb': {
                  backgroundColor: '#2563EB',
                  width: 18,
                  height: 18,
                  '&:hover': {
                    boxShadow: '0 0 0 8px rgba(37, 99, 235, 0.16)',
                  },
                },
                '& .MuiSlider-track': {
                  backgroundColor: '#2563EB',
                  height: 4,
                },
                '& .MuiSlider-rail': {
                  backgroundColor: isDark ? '#334155' : '#e2e8f0',
                  height: 4,
                },
                '& .MuiSlider-markLabel': {
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                },
                '& .MuiSlider-valueLabel': {
                  backgroundColor: '#2563EB',
                  fontSize: '0.75rem',
                },
              }}
            />
            <div className="flex justify-between mt-2">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Symptom Relieved
              </span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Very Severe
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pt-2 border-t border-slate-700/50">
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={onResetFilters}
            sx={{
              borderColor: isDark ? '#334155' : '#e2e8f0',
              color: isDark ? '#cbd5e1' : '#475569',
              fontSize: '0.75rem',
              textTransform: 'none',
              '&:hover': {
                borderColor: isDark ? '#475569' : '#cbd5e1',
                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
              },
            }}
          >
            Reset Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FiltersSidebar;

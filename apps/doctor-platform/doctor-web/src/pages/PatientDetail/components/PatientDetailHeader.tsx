/**
 * Patient Detail Header Component
 * Header with patient info and action buttons
 */

import React from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { ArrowLeft, User, RefreshCw, Send, Download, Activity } from 'lucide-react';

interface PatientDetailHeaderProps {
  isDark: boolean;
  patientName?: string;
  onBack: () => void;
  onProfileClick: () => void;
}

const PatientDetailHeader: React.FC<PatientDetailHeaderProps> = ({
  isDark,
  patientName,
  onBack,
  onProfileClick,
}) => {
  return (
    <div className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917] border-b border-slate-800/50' : 'bg-white/80 backdrop-blur-sm border-b border-slate-200/60'} transition-colors duration-200 shadow-sm`}>
      <div className="px-4 py-3 md:px-6 md:py-4 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div className="flex items-center gap-3 flex-shrink-0">
            <IconButton
              onClick={onBack}
              size="small"
              className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}
              sx={{ padding: '8px' }}
            >
              <ArrowLeft size={18} />
            </IconButton>
            <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <Activity size={20} className={isDark ? 'text-blue-400' : 'text-[#1e3a5f]'} />
            </div>
            <div className="min-w-0">
              <h1 className={`text-xl md:text-2xl font-bold font-serif ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 leading-tight truncate`}>
                Patient Dashboard
              </h1>
              <p className={`text-xs md:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-0.5 mb-0 truncate`}>
                {patientName || 'Patient Details'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 md:gap-2 items-center justify-end">
            <Button
              variant="outlined"
              size="small"
              startIcon={<User size={14} />}
              onClick={onProfileClick}
              className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
              sx={{
                borderColor: isDark ? '#334155' : '#e2e8f0',
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '0.75rem',
                padding: '6px 12px',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              }}
            >
              <span className="hidden sm:inline">Patient Profile</span>
              <span className="sm:hidden">Profile</span>
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshCw size={14} />}
              className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
              sx={{
                borderColor: isDark ? '#334155' : '#e2e8f0',
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '0.75rem',
                padding: '6px 12px',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              }}
            >
              <span className="hidden sm:inline">Update Dashboard</span>
              <span className="sm:hidden">Update</span>
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Send size={14} />}
              className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
              sx={{
                borderColor: isDark ? '#334155' : '#e2e8f0',
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '0.75rem',
                padding: '6px 12px',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              }}
            >
              <span className="hidden sm:inline">Send Fax</span>
              <span className="sm:hidden">Fax</span>
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={14} />}
              className={isDark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : ''}
              sx={{
                borderColor: isDark ? '#334155' : '#e2e8f0',
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: '0.75rem',
                padding: '6px 12px',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              }}
            >
              <span className="hidden sm:inline">Download Report</span>
              <span className="sm:hidden">Download</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailHeader;

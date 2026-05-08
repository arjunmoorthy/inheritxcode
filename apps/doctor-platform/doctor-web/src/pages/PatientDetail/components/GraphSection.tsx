/**
 * Graph Section Component
 * Wrapper for the symptom graph with header, legend, and fullscreen functionality
 */

import React, { useState, useMemo } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { Maximize, Minimize, Calendar, Info } from 'lucide-react';
import SymptomGraph from './SymptomGraph';
import { usePatientOverallSummary } from '../../../services/dashboard';

interface Symptom {
  name: string;
  color: string;
  dataPoints: any[];
}

interface GraphData {
  dates: string[];
  symptoms: Symptom[];
}

interface GraphSectionProps {
  graphData: GraphData;
  isLoading: boolean;
  isDark: boolean;
  isSidebarOpen: boolean;
  isChartFullscreen: boolean;
  onFullscreenOpen: () => void;
  onFullscreenClose: () => void;
  patientName?: string;
  patientUuid?: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  formatDateShort: (date: string) => string;
  chemoDates?: string[];
  isFaxMode?: boolean;
}

const GraphSection: React.FC<GraphSectionProps> = ({
  graphData,
  isLoading,
  isDark,
  isSidebarOpen,
  isChartFullscreen,
  onFullscreenOpen,
  onFullscreenClose,
  patientName,
  patientUuid,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  formatDateShort,
  chemoDates,
  isFaxMode = false,
}) => {
  // Fetch summary data
  const { data: summaryData, isLoading: isSummaryLoading, isFetching: isSummaryFetching } = usePatientOverallSummary(
    patientUuid || '',
    startDate,
    endDate
  );
  const FAX_DASH_PATTERNS = [
    '', // solid
    '8,4', // dashed
    '2,2', // dotted
    '10,4,2,4', // dash-dot
    '5,5', // medium dash
    '15,5', // long dash
    '8,3,2,3,2,3', // dash-dot-dot
  ];

  return (
    <>
      {/* Graph Section */}
      <div className={`${isDark ? 'bg-[#252320] border-slate-700/50' : 'bg-white border-slate-200'} rounded-lg border p-3 md:p-4 relative`}>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h3 className={`text-sm md:text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'} truncate flex-1`}>
              Symptom & Temperature Timeline
            </h3>
            <Tooltip title="View fullscreen">
              <IconButton
                onClick={onFullscreenOpen}
                size="small"
                className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}
                sx={{
                  padding: '4px',
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  },
                }}
              >
                <Maximize size={16} />
              </IconButton>
            </Tooltip>
          </div>


          {/* Legend */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {graphData.symptoms.map((symptom, idx) => (
              <div key={symptom.name} className="flex items-center gap-1.5">
                <div className="flex items-center">
                  {isFaxMode ? (
                    <svg width="24" height="12" className="mr-1">
                      <line
                        x1="0" y1="6" x2="24" y2="6"
                        className={isDark ? 'stroke-slate-300 stroke-[2.5]' : 'stroke-slate-700 stroke-[2.5]'}
                        style={{ strokeDasharray: FAX_DASH_PATTERNS[idx % FAX_DASH_PATTERNS.length] }}
                      />
                    </svg>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <div
                        className="w-2.5 h-0.5 rounded-full"
                        style={{ backgroundColor: symptom.color }}
                      />
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: symptom.color }}
                      />
                    </div>
                  )}
                </div>
                <span className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                  {symptom.name.charAt(0).toUpperCase() + symptom.name.slice(1)}
                </span>
              </div>
            ))}

            {/* Chemo Legend */}
            {chemoDates && chemoDates.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center">
                  <svg width="24" height="12" className="mr-1">
                    <line
                      x1="0" y1="6" x2="24" y2="6"
                      stroke={isDark ? '#22d3ee' : '#0891b2'}
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                    />
                  </svg>
                </div>
                <span className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                  Chemo Day
                </span>
              </div>
            )}
          </div>
        </div>

        <SymptomGraph
          graphData={graphData}
          isLoading={isLoading}
          isDark={isDark}
          isSidebarOpen={isSidebarOpen}
          fullscreen={false}
          formatDateShort={formatDateShort}
          chemoDates={chemoDates}
          isFaxMode={isFaxMode}
        />
      </div>

      {/* Summary Card */}
      <div className={`mb-5 p-4 rounded-xl border transition-all duration-300 ${isDark
          ? 'bg-gradient-to-br from-[#2D2A26] to-[#252320] border-slate-700/50 shadow-inner'
          : 'bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border-blue-100/50 shadow-sm'
        }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isSummaryFetching ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
            <h4 className={`text-xs mb-0 font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Overall Summary
            </h4>
          </div>
          {isSummaryFetching && <CircularProgress size={12} thickness={5} sx={{ color: '#3b82f6' }} />}
        </div>

        {isSummaryLoading ? (
          <div className="flex flex-col gap-2">
            <div className={`h-4 w-3/4 rounded animate-pulse ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <div className={`h-4 w-1/2 rounded animate-pulse ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
          </div>
        ) : summaryData ? (
          <div className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {typeof summaryData === 'string' ? (
              summaryData
            ) : summaryData.summary ? (
              summaryData.summary
            ) : (
              <div className="flex flex-wrap gap-4">
                {Object.entries(summaryData).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase text-slate-400">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={`text-sm italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            No summary available for the selected range.
          </div>
        )}
      </div>

      {/* Fullscreen Chart Dialog */}
      <Dialog
        open={isChartFullscreen}
        onClose={onFullscreenClose}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            m: 0,
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            borderRadius: 0,
            backgroundColor: isDark ? '#1A1917' : '#FAF8F5',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 2,
            borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            backgroundColor: isDark ? '#252320' : 'white',
          }}
        >
          <div>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}
            >
              Symptom & Temperature Timeline
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: isDark ? '#94a3b8' : '#64748b', mt: 0.5 }}
            >
              {patientName || 'Patient Details'} - Full Screen View
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            {/* Legend in fullscreen */}
            <div className="hidden md:flex flex-wrap gap-4 mr-4">
              {graphData.symptoms.map((symptom, idx) => (
                <div key={symptom.name} className="flex items-center gap-2">
                  <div className="flex items-center">
                    {isFaxMode ? (
                      <svg width="30" height="12" className="mr-2">
                        <line
                          x1="0" y1="6" x2="30" y2="6"
                          className={isDark ? 'stroke-slate-300 stroke-[3]' : 'stroke-slate-700 stroke-[3]'}
                          style={{ strokeDasharray: FAX_DASH_PATTERNS[idx % FAX_DASH_PATTERNS.length] }}
                        />
                      </svg>
                    ) : (
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
                    )}
                  </div>
                  <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {symptom.name.charAt(0).toUpperCase() + symptom.name.slice(1)}
                  </span>
                </div>
              ))}
              
              {/* Chemo Legend in Fullscreen */}
              {chemoDates && chemoDates.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <svg width="30" height="12" className="mr-2">
                      <line
                        x1="0" y1="6" x2="30" y2="6"
                        stroke={isDark ? '#22d3ee' : '#0891b2'}
                        strokeWidth="3"
                        strokeDasharray="4 4"
                      />
                    </svg>
                  </div>
                  <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Chemo Day
                  </span>
                </div>
              )}
            </div>
            <Tooltip title="Exit fullscreen">
              <IconButton
                onClick={onFullscreenClose}
                sx={{
                  color: isDark ? '#cbd5e1' : '#475569',
                  '&:hover': {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                  },
                }}
              >
                <Minimize size={20} />
              </IconButton>
            </Tooltip>
          </div>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 4,
            backgroundColor: isDark ? '#1A1917' : '#FAF8F5',
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 80px)',
            overflow: 'auto',
          }}
        >
          {/* Mobile Legend */}
          <div className="md:hidden flex flex-wrap gap-4 mb-4">
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
            
            {/* Chemo Legend in Mobile Fullscreen */}
            {chemoDates && chemoDates.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <svg width="24" height="12" className="mr-1">
                    <line
                      x1="0" y1="6" x2="24" y2="6"
                      stroke={isDark ? '#22d3ee' : '#0891b2'}
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                    />
                  </svg>
                </div>
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  → Chemo Day
                </span>
              </div>
            )}
          </div>

          {/* Fullscreen Graph */}
          <div className="flex-1 min-h-0">
            <SymptomGraph
              graphData={graphData}
              isLoading={isLoading}
              isDark={isDark}
              isSidebarOpen={false}
              fullscreen={true}
              formatDateShort={formatDateShort}
              chemoDates={chemoDates}
              isFaxMode={isFaxMode}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GraphSection;

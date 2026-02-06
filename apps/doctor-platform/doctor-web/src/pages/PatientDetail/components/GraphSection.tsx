/**
 * Graph Section Component
 * Wrapper for the symptom graph with header, legend, and fullscreen functionality
 */

import React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { Maximize, Minimize } from 'lucide-react';
import SymptomGraph from './SymptomGraph';

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
  formatDateShort: (date: string) => string;
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
  formatDateShort,
}) => {
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
            {graphData.symptoms.map((symptom) => (
              <div key={symptom.name} className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  <div
                    className="w-2.5 h-0.5"
                    style={{ backgroundColor: symptom.color }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: symptom.color }}
                  />
                </div>
                <span className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>
                  {symptom.name.charAt(0).toUpperCase() + symptom.name.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <SymptomGraph
          graphData={graphData}
          isLoading={isLoading}
          isDark={isDark}
          isSidebarOpen={isSidebarOpen}
          fullscreen={false}
          formatDateShort={formatDateShort}
        />
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
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GraphSection;

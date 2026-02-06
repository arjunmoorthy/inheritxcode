/**
 * Symptom Graph Component
 * Displays symptom and temperature timeline chart
 */

import React from 'react';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import { Activity } from 'lucide-react';

interface SymptomDataPoint {
  date?: string;
  severity?: string;
  severity_numeric?: number;
  dateIndex: number;
}

interface Symptom {
  name: string;
  color: string;
  dataPoints: SymptomDataPoint[];
}

interface GraphData {
  dates: string[];
  symptoms: Symptom[];
}

interface SymptomGraphProps {
  graphData: GraphData;
  isLoading: boolean;
  isDark: boolean;
  isSidebarOpen: boolean;
  fullscreen?: boolean;
  formatDateShort: (date: string) => string;
}

const symptomColors: Record<string, string> = {
  'cough': '#FF9500',
  'pain': '#10B981',
  'vomiting': '#06B6D4',
  'constipation': '#2563EB',
  'temperature': '#EF4444',
  'fatigue': '#8B5CF6',
  'nausea': '#EC4899',
};

const SymptomGraph: React.FC<SymptomGraphProps> = ({
  graphData,
  isLoading,
  isDark,
  isSidebarOpen,
  fullscreen = false,
  formatDateShort,
}) => {
  if (isLoading) {
    return (
      <div className={`${fullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'} flex items-center justify-center`}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </div>
    );
  }

  if (!graphData.dates.length || !graphData.symptoms.length) {
    return (
      <div className={`${fullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'} flex flex-col items-center justify-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        <Activity size={48} className="mb-4 opacity-50" />
        <Typography>No symptom data available for this period</Typography>
      </div>
    );
  }

  const { dates, symptoms } = graphData;
  const chartHeight = fullscreen ? window.innerHeight - 200 : 380;
  const chartPadding = { top: 15, right: 20, bottom: 50, left: 70 };
  
  const calculateChartWidth = () => {
    if (fullscreen) {
      return Math.max(window.innerWidth - 100, dates.length * 60);
    }
    if (typeof window !== 'undefined') {
      const containerWidth = window.innerWidth - (isSidebarOpen ? 400 : 100);
      return Math.max(containerWidth, dates.length * 45);
    }
    return Math.max(700, dates.length * 45);
  };
  const chartWidth = calculateChartWidth();

  const severityLevels = ['relieved', 'mild', 'moderate', 'severe', 'very severe'];
  const tempLevels = [96, 98, 100, 102, 104];

  return (
    <div className="relative overflow-x-auto">
      <div 
        className={`relative ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg`}
        style={{ height: chartHeight }}
      >
        {/* Y-axis labels - Severity (left) */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-3 px-1.5" style={{ width: chartPadding.left }}>
          {severityLevels.map((level, i) => (
            <span 
              key={level}
              className={`text-[10px] sm:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              style={{ marginTop: i === 0 ? 0 : -10 }}
            >
              {level}
            </span>
          ))}
        </div>

        {/* Y-axis labels - Temperature (right) */}
        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-3 px-1.5" style={{ width: chartPadding.right }}>
          {tempLevels.map((temp, i) => (
            <span 
              key={temp}
              className={`text-[10px] sm:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              style={{ marginTop: i === 0 ? 0 : -10 }}
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
                  const temp = typeof dp.severity_numeric === 'number' 
                    ? Math.max(96, Math.min(104, dp.severity_numeric))
                    : 98.6;
                  const normalized = (temp - 96) / (104 - 96);
                  y = (1 - normalized) * (chartHeight - chartPadding.top - chartPadding.bottom);
                } else {
                  const severity = dp.severity_numeric || 0;
                  y = (1 - (severity / 4)) * (chartHeight - chartPadding.top - chartPadding.bottom);
                }
                
                return { x, y, dp };
              });

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
                    title={`${symptom.name}: ${isTemperature ? `${typeof point.dp.severity_numeric === 'number' ? point.dp.severity_numeric.toFixed(1) : point.dp.severity_numeric}°F` : point.dp.severity} on ${formatDateShort(point.dp.date || '')}`}
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
          className="absolute left-0 right-0 flex justify-between px-2"
          style={{ bottom: chartPadding.bottom - 35, left: chartPadding.left, right: chartPadding.right }}
        >
          {dates.map((date, idx) => (
            <span 
              key={idx}
              className={`text-[10px] sm:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} whitespace-nowrap`}
              style={{ 
                transform: 'translateX(-50%)',
                position: 'absolute',
                left: `${(idx / (dates.length - 1 || 1)) * 100}%`,
              }}
            >
              {formatDateShort(date)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SymptomGraph;

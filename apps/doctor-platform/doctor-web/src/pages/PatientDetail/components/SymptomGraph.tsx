/**
 * Symptom Graph Component
 * Displays symptom and temperature timeline chart
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { Activity } from 'lucide-react';

interface SymptomDataPoint {
  date?: string;
  severity?: string;
  severity_numeric?: number;
  dateIndex: number;
}

interface PlottedPoint {
  x: number;
  y: number;
  dp: SymptomDataPoint;
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
  lastChemoDate?: string | null;
}

const SymptomGraph: React.FC<SymptomGraphProps> = ({
  graphData,
  isLoading,
  isDark,
  isSidebarOpen,
  fullscreen = false,
  formatDateShort,
  lastChemoDate,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverCursor, setHoverCursor] = useState<{ x: number; y: number } | null>(null);
  const [activeSeriesName, setActiveSeriesName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const { dates, symptoms } = graphData;
  const hasData = dates.length > 0 && symptoms.length > 0;
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const chartHeight = fullscreen ? window.innerHeight - 200 : isMobileViewport ? 300 : 380;
  const chartPadding = { top: 15, right: 44, bottom: 50, left: 70 };
  
  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    const node = containerRef.current;
    const updateWidth = () => {
      const width = node.getBoundingClientRect().width;
      setContainerWidth(Math.max(320, Math.floor(width)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const chartWidth = useMemo(() => {
    if (containerWidth > 0) return containerWidth;
    if (typeof window === 'undefined') return 700;
    if (fullscreen) return Math.max(window.innerWidth - 100, 700);
    return Math.max(window.innerWidth - (isSidebarOpen ? 420 : 140), 700);
  }, [containerWidth, fullscreen, isSidebarOpen]);
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const maxXAxisLabels = fullscreen ? 16 : isMobileViewport ? 5 : 8;
  const labelStep = Math.max(1, Math.ceil(dates.length / maxXAxisLabels));
  const visibleLabelIndexes = new Set<number>();
  dates.forEach((_, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === dates.length - 1;
    if (isFirst || isLast || idx % labelStep === 0) {
      visibleLabelIndexes.add(idx);
    }
  });

  const severityLevels = ['relieved', 'mild', 'moderate', 'severe', 'very severe'];
  const chemoDateIndex = useMemo(() => {
    if (!lastChemoDate) return null;
    const index = dates.indexOf(lastChemoDate);
    return index >= 0 ? index : null;
  }, [dates, lastChemoDate]);
  const chemoLineX = useMemo(() => {
    if (chemoDateIndex === null) return null;
    return (chemoDateIndex / (dates.length - 1 || 1)) * plotWidth;
  }, [chemoDateIndex, dates.length, plotWidth]);
  const tempScale = useMemo(() => {
    return { min: 96, max: 104, levels: [104, 102, 100, 98, 96] };
  }, []);
  const buildSmoothPathData = (points: PlottedPoint[]) => {
    if (!points.length) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const current = points[i];
      const cx = (prev.x + current.x) / 2;
      const cy = (prev.y + current.y) / 2;
      path += ` Q ${prev.x} ${prev.y} ${cx} ${cy}`;
      if (i === points.length - 1) {
        path += ` T ${current.x} ${current.y}`;
      }
    }

    return path;
  };

  const seriesPoints = useMemo(() => {
    return symptoms.map((symptom) => {
      const isTemperature = symptom.name.toLowerCase() === 'temperature';
      const points = symptom.dataPoints
        .slice()
        .sort((a, b) => a.dateIndex - b.dateIndex)
        .map((dp) => {
          const x = (dp.dateIndex / (dates.length - 1 || 1)) * plotWidth;
          let y: number;

          if (isTemperature) {
            const temp = typeof dp.severity_numeric === 'number'
              ? Math.max(tempScale.min, Math.min(tempScale.max, dp.severity_numeric))
              : (tempScale.min + tempScale.max) / 2;
            const denominator = Math.max(0.01, tempScale.max - tempScale.min);
            const normalized = (temp - tempScale.min) / denominator;
            y = (1 - normalized) * (chartHeight - chartPadding.top - chartPadding.bottom);
          } else {
            const severity = dp.severity_numeric || 0;
            y = (1 - (severity / 4)) * (chartHeight - chartPadding.top - chartPadding.bottom);
          }

          return { x, y, dp };
        });

      return { symptom, isTemperature, points };
    });
  }, [symptoms, dates.length, plotWidth, chartHeight, chartPadding.bottom, chartPadding.top, tempScale.max, tempScale.min]);

  const hoverDetails = useMemo(() => {
    if (hoveredIndex === null) return null;
    const entries = seriesPoints
      .map(({ symptom, isTemperature, points }) => {
        if (activeSeriesName && symptom.name !== activeSeriesName) return null;
        const point = points.find((p) => p.dp.dateIndex === hoveredIndex);
        if (!point) return null;
        const value = isTemperature
          ? `${typeof point.dp.severity_numeric === 'number' ? point.dp.severity_numeric.toFixed(1) : point.dp.severity_numeric}°F`
          : `${point.dp.severity}`;
        return { name: symptom.name, value, color: symptom.color };
      })
      .filter((entry): entry is { name: string; value: string; color: string } => entry !== null);

    if (!entries.length) return null;

    const x = (hoveredIndex / (dates.length - 1 || 1)) * plotWidth;
    const fallbackY = plotHeight / 2;
    return {
      x,
      y: hoverCursor?.y ?? fallbackY,
      dateLabel: formatDateShort(dates[hoveredIndex] || ''),
      entries,
    };
  }, [hoveredIndex, seriesPoints, dates, plotWidth, formatDateShort, hoverCursor?.y, plotHeight, activeSeriesName]);

  const tooltipPosition = useMemo(() => {
    if (!hoverDetails) return null;
    const tooltipWidth = isMobileViewport ? 170 : 210;
    const estimatedHeight = 42 + hoverDetails.entries.length * 20;
    const sideOffset = 12;

    const preferRight = hoverDetails.x < plotWidth * 0.65;
    const rawLeft = chartPadding.left + hoverDetails.x + (preferRight ? sideOffset : -(tooltipWidth + sideOffset));
    const minLeft = 8;
    const maxLeft = chartPadding.left + plotWidth - tooltipWidth - 8;
    const clampedLeft = Math.max(minLeft, Math.min(rawLeft, maxLeft));

    const rawTop = chartPadding.top + hoverDetails.y - estimatedHeight / 2;
    const minTop = 8;
    const maxTop = chartPadding.top + plotHeight - estimatedHeight - 8;
    const clampedTop = Math.max(minTop, Math.min(rawTop, maxTop));

    return { left: clampedLeft, top: clampedTop, width: tooltipWidth };
  }, [hoverDetails, chartPadding.left, chartPadding.top, plotWidth, plotHeight, isMobileViewport]);

  if (isLoading) {
    return (
      <div className={`${fullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'} flex items-center justify-center`}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className={`${fullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'} flex flex-col items-center justify-center ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        <Activity size={48} className="mb-4 opacity-50" />
        <Typography>No symptom data available for this period</Typography>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative overflow-x-hidden w-full">
      <div 
        className={`relative ${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg`}
        style={{ height: chartHeight }}
      >
        {chemoLineX !== null && (
          <div
            className={`absolute text-[11px] font-semibold pointer-events-none ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}
            style={{
              left: chartPadding.left + chemoLineX,
              top: 2,
              transform: 'translateX(-50%)',
              zIndex: 2,
            }}
          >
            Chemo
          </div>
        )}
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
        <div
          className="absolute right-0 top-0 bottom-0 flex flex-col justify-between items-end py-3 pr-2"
          style={{ width: chartPadding.right }}
        >
          {tempScale.levels.map((temp, i) => (
            <span 
              key={temp}
              className={`text-[10px] sm:text-xs text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
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
          onMouseMove={(event) => {
            const svgRect = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - svgRect.left;
            const y = event.clientY - svgRect.top;
            const clampedX = Math.max(0, Math.min(plotWidth, x));
            const clampedY = Math.max(0, Math.min(plotHeight, y));
            const nextIndex = Math.round((clampedX / (plotWidth || 1)) * (dates.length - 1));
            setHoveredIndex(nextIndex);
            setHoverCursor({ x: clampedX, y: clampedY });

            let nearestSeries: string | null = null;
            let nearestDistance = Number.POSITIVE_INFINITY;
            seriesPoints.forEach(({ symptom, points }) => {
              points.forEach((point) => {
                const dx = point.x - clampedX;
                const dy = point.y - clampedY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestSeries = symptom.name;
                }
              });
            });
            setActiveSeriesName(nearestDistance <= (isMobileViewport ? 26 : 20) ? nearestSeries : null);
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (!touch) return;
            const svgRect = event.currentTarget.getBoundingClientRect();
            const x = touch.clientX - svgRect.left;
            const y = touch.clientY - svgRect.top;
            const clampedX = Math.max(0, Math.min(plotWidth, x));
            const clampedY = Math.max(0, Math.min(plotHeight, y));
            const nextIndex = Math.round((clampedX / (plotWidth || 1)) * (dates.length - 1));
            setHoveredIndex(nextIndex);
            setHoverCursor({ x: clampedX, y: clampedY });

            let nearestSeries: string | null = null;
            let nearestDistance = Number.POSITIVE_INFINITY;
            seriesPoints.forEach(({ symptom, points }) => {
              points.forEach((point) => {
                const dx = point.x - clampedX;
                const dy = point.y - clampedY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestSeries = symptom.name;
                }
              });
            });
            setActiveSeriesName(nearestDistance <= (isMobileViewport ? 28 : 22) ? nearestSeries : null);
          }}
          onTouchEnd={() => {
            setHoveredIndex(null);
            setHoverCursor(null);
            setActiveSeriesName(null);
          }}
          onMouseLeave={() => {
            setHoveredIndex(null);
            setHoverCursor(null);
            setActiveSeriesName(null);
          }}
        >
          {chemoLineX !== null && (
            <g>
              <line
                x1={chemoLineX}
                y1={0}
                x2={chemoLineX}
                y2={plotHeight}
                stroke={isDark ? '#22D3EE' : '#0891B2'}
                strokeWidth="1.5"
                strokeDasharray="5 5"
                opacity="0.9"
              />
            </g>
          )}
          {hoverDetails && (
            <line
              x1={hoverDetails.x}
              y1={0}
              x2={hoverDetails.x}
              y2={plotHeight}
              stroke={isDark ? '#64748b' : '#94a3b8'}
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}
          {seriesPoints.map(({ symptom, isTemperature, points }) => {
            if (points.length < 1) return null;
            const pathData = buildSmoothPathData(points);

            return (
              <g key={symptom.name}>
                {points.length > 1 && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke={symptom.color}
                    strokeWidth="2"
                    strokeDasharray={isTemperature ? '5 4' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={
                      activeSeriesName
                        ? (symptom.name === activeSeriesName ? 0.95 : 0.18)
                        : hoveredIndex !== null ? 0.5 : 0.9
                    }
                  />
                )}
                {points.map((point, pointIdx) => (
                  <g key={pointIdx}>
                    {points.length === 1 && (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="7"
                        fill={symptom.color}
                        opacity="0.18"
                      />
                    )}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={
                        hoveredIndex !== null && point.dp.dateIndex === hoveredIndex && (!activeSeriesName || symptom.name === activeSeriesName)
                          ? (isMobileViewport ? 5 : 6)
                          : (isMobileViewport ? 3.2 : 4)
                      }
                      fill={symptom.color}
                      stroke="white"
                      strokeWidth={hoveredIndex !== null && point.dp.dateIndex === hoveredIndex && (!activeSeriesName || symptom.name === activeSeriesName) ? '2.5' : '2'}
                      className="transition-all"
                      opacity={
                        activeSeriesName
                          ? (symptom.name === activeSeriesName ? 1 : 0.2)
                          : hoveredIndex !== null && point.dp.dateIndex !== hoveredIndex ? 0.4 : 1
                      }
                    />
                    {hoveredIndex !== null && point.dp.dateIndex === hoveredIndex && (!activeSeriesName || symptom.name === activeSeriesName) && (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isMobileViewport ? 8 : 10}
                        fill={symptom.color}
                        opacity="0.18"
                      />
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
        {hoverDetails && tooltipPosition && (
          <div
            className={`absolute z-10 rounded-xl px-3 py-2 shadow-lg border ${
              isDark ? 'bg-[#252320] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
            style={{
              left: tooltipPosition.left,
              top: tooltipPosition.top,
              width: tooltipPosition.width,
              pointerEvents: 'none',
            }}
          >
            <div className="text-sm font-semibold mb-1">{hoverDetails.dateLabel}</div>
            {hoverDetails.entries.map((entry) => (
              <div key={entry.name} className="text-xs sm:text-sm" style={{ color: entry.color }}>
                {entry.name}: <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{entry.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* X-axis labels */}
        <div 
          className="absolute left-0 right-0 flex justify-between px-2"
          style={{ bottom: chartPadding.bottom - 35, left: chartPadding.left, right: chartPadding.right }}
        >
          {dates.map((date, idx) => {
            if (!visibleLabelIndexes.has(idx)) return null;
            const isFirst = idx === 0;
            const isLast = idx === dates.length - 1;
            return (
              <span 
                key={idx}
                className={`text-[10px] sm:text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} whitespace-nowrap`}
                style={{ 
                  transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                  position: 'absolute',
                  left: `${(idx / (dates.length - 1 || 1)) * 100}%`,
                  maxWidth: `${Math.max(plotWidth / maxXAxisLabels, 40)}px`,
                }}
              >
                {formatDateShort(date)}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SymptomGraph;

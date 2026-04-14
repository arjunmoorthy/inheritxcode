/**
 * Symptom Graph Component
 * Displays symptom and temperature timeline chart
 */

import React, { useEffect, useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { Activity } from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
  lastChemoDate?: string | null;
  isFaxMode?: boolean;
}

type ChartRow = {
  date: string;
} & Record<string, number | string | undefined>;

const SEVERITY_LEVELS = ['Relieved', 'Mild', 'Moderate', 'Severe', 'Very Severe'] as const;
const TEMP_TICKS = [96, 98, 100, 102, 104];
const FAX_DASH_PATTERNS = ['', '8 4', '2 2', '10 4 2 4', '5 5', '15 5', '8 3 2 3 2 3'];
const CHART_MARGIN = { top: 14, right: 44, bottom: 50, left: 18 } as const;

const normalizeToIsoDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const prefixMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
  if (prefixMatch?.[1]) return prefixMatch[1];

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const SymptomGraph: React.FC<SymptomGraphProps> = ({
  graphData,
  isLoading,
  isDark,
  fullscreen = false,
  formatDateShort,
  lastChemoDate,
  isFaxMode = false,
}) => {
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );
  const [isPrintMode, setIsPrintMode] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onBeforePrint = () => setIsPrintMode(true);
    const onAfterPrint = () => setIsPrintMode(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);

    const mediaQuery = window.matchMedia('print');
    const onMediaChange = (event: MediaQueryListEvent) => setIsPrintMode(event.matches);
    mediaQuery.addEventListener('change', onMediaChange);

    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      mediaQuery.removeEventListener('change', onMediaChange);
    };
  }, []);

  const effectiveDark = isDark && !isPrintMode;

  const isMobileViewport = viewportWidth < 768;
  const chartHeight = isPrintMode
    ? 520
    : (fullscreen ? Math.max(420, window.innerHeight - 220) : isMobileViewport ? 300 : 380);
  const printChartWidth = Math.max(980, viewportWidth - 40);
  const { dates, symptoms } = graphData;
  const normalizedChemoDate = useMemo(() => normalizeToIsoDate(lastChemoDate), [lastChemoDate]);
  const chartDates = useMemo(() => {
    if (!dates.length) return dates;
    if (!normalizedChemoDate || dates.includes(normalizedChemoDate)) return dates;

    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    if (normalizedChemoDate < firstDate || normalizedChemoDate > lastDate) return dates;

    return [...dates, normalizedChemoDate].sort();
  }, [dates, normalizedChemoDate]);
  const hasData = chartDates.length > 0 && symptoms.length > 0;

  const seriesMeta = useMemo(() => (
    symptoms.map((symptom, idx) => ({
      name: symptom.name,
      key: `series_${idx}`,
      color: symptom.color,
      isTemperature: symptom.name.toLowerCase() === 'temperature',
    }))
  ), [symptoms]);

  const chartData = useMemo<ChartRow[]>(() => {
    return chartDates.map((date) => {
      const row: ChartRow = { date };
      symptoms.forEach((symptom, sIdx) => {
        const point = symptom.dataPoints.find((dp) => dp.date === date);
        row[`series_${sIdx}`] = point?.severity_numeric;
      });
      return row;
    });
  }, [chartDates, symptoms]);

  const maxXAxisLabels = fullscreen ? 16 : isMobileViewport ? 5 : 8;
  const labelStep = Math.max(1, Math.ceil(chartDates.length / maxXAxisLabels));
  const visibleTicks = useMemo(
    () => chartDates.filter((_, idx) => idx === 0 || idx === chartDates.length - 1 || idx % labelStep === 0),
    [chartDates, labelStep]
  );
  const chemoMarkerDate = useMemo(() => {
    if (!normalizedChemoDate || !chartDates.length) return null;
    return chartDates.includes(normalizedChemoDate) ? normalizedChemoDate : null;
  }, [normalizedChemoDate, chartDates]);

  if (isLoading) {
    return (
      <div className={`${fullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'} flex items-center justify-center`}>
        <Skeleton variant="rectangular" width="100%" height="100%" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className={`${fullscreen ? 'h-[calc(100vh-200px)]' : 'h-[400px]'} flex flex-col items-center justify-center ${effectiveDark ? 'text-slate-400' : 'text-slate-600'}`}>
        <Activity size={48} className="mb-4 opacity-50" />
        <Typography>No symptom data available for this period</Typography>
      </div>
    );
  }

  const chartContent = (
    <ComposedChart
      data={chartData}
      margin={CHART_MARGIN}
      width={isPrintMode ? printChartWidth : undefined}
      height={isPrintMode ? chartHeight : undefined}
    >
      <CartesianGrid strokeDasharray="4 4" stroke={effectiveDark ? '#334155' : '#cbd5e1'} vertical={false} />
      {[0, 1, 2, 3, 4].map((level) => (
        <ReferenceLine
          key={`severity-line-${level}`}
          y={level}
          yAxisId="severity"
          stroke={effectiveDark ? '#334155' : '#cbd5e1'}
          strokeDasharray="4 4"
          strokeWidth={1}
          ifOverflow="extendDomain"
        />
      ))}
      {chemoMarkerDate && (
        <ReferenceLine
          x={chemoMarkerDate}
          yAxisId="severity"
          stroke={effectiveDark ? '#22d3ee' : '#0891b2'}
          strokeDasharray="4 4"
          strokeWidth={2}
          ifOverflow="visible"
          label={{
            value: 'Chemo',
            position: 'insideTop',
            fill: effectiveDark ? '#67e8f9' : '#0e7490',
            fontSize: 11,
            fontWeight: 700,
            offset: 0,
          }}
        />
      )}
      <XAxis
        dataKey="date"
        ticks={visibleTicks}
        tick={{ fill: effectiveDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
        tickFormatter={formatDateShort}
        axisLine={false}
        tickLine={false}
        minTickGap={20}
      />
      <YAxis
        yAxisId="severity"
        domain={[0, 4]}
        ticks={[0, 1, 2, 3, 4]}
        tickFormatter={(value: number) => SEVERITY_LEVELS[value] ?? ''}
        tick={{ fill: effectiveDark ? '#94a3b8' : '#475569', fontSize: 11 }}
        width={70}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        yAxisId="temp"
        orientation="right"
        domain={[96, 104]}
        ticks={TEMP_TICKS}
        tickFormatter={(value: number) => String(value)}
        tick={{ fill: effectiveDark ? '#94a3b8' : '#475569', fontSize: 11 }}
        width={44}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        shared
        filterNull={false}
        cursor={{ stroke: effectiveDark ? '#64748b' : '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' }}
        content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const visibleEntries = payload.filter((entry) => entry.value !== null && entry.value !== undefined);
          if (!visibleEntries.length) return null;
          return (
            <div className={`rounded-xl px-3 py-2 shadow-lg border ${effectiveDark ? 'bg-[#252320] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
              <div className="text-sm font-semibold mb-1">{formatDateShort(String(label || ''))}</div>
              {visibleEntries.map((entry) => {
                const isTemp = entry.name === 'Temperature';
                return (
                  <div key={entry.name} className="text-xs sm:text-sm" style={{ color: String(entry.color || '#475569') }}>
                    {entry.name}:{' '}
                    <span className={effectiveDark ? 'text-slate-100' : 'text-slate-900'}>
                      {isTemp ? `${Number(entry.value).toFixed(1)}°F` : SEVERITY_LEVELS[Number(entry.value)]}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }}
      />

      {seriesMeta.map((series, idx) => (
        <Line
          key={series.key}
          yAxisId={series.isTemperature ? 'temp' : 'severity'}
          dataKey={series.key}
          name={series.name}
          type="monotone"
          stroke={isFaxMode ? (effectiveDark ? '#cbd5e1' : '#334155') : series.color}
          strokeWidth={isPrintMode ? 3 : (isFaxMode ? 2.5 : 2)}
          strokeDasharray={isFaxMode ? FAX_DASH_PATTERNS[idx % FAX_DASH_PATTERNS.length] : (series.isTemperature ? '5 4' : undefined)}
          dot={(dotProps: any) => {
            const { cx, cy, value } = dotProps;
            if (cx == null || cy == null || value == null) return null;

            // Use slightly different radii per symptom series so overlapping
            // same-day/same-severity reports remain visible.
            const baseRadius = isPrintMode ? 5 : (isFaxMode ? 4.5 : 4.8);
            const overlapRadiusOffset = series.isTemperature ? 0 : (idx % 3) * 1.1;
            const radius = baseRadius + overlapRadiusOffset;

            return (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={isFaxMode ? (effectiveDark ? '#cbd5e1' : '#334155') : series.color}
                stroke={isFaxMode ? (effectiveDark ? '#0f172a' : '#ffffff') : '#ffffff'}
                strokeWidth={isFaxMode ? 1.8 : 2}
              />
            );
          }}
          activeDot={{ r: 8, strokeWidth: 2.5 }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
    </ComposedChart>
  );

  return (
    <div data-export-chart="patient-symptom-graph" className="relative overflow-hidden w-full">
      <div className={`relative ${effectiveDark ? 'bg-slate-900/50' : 'bg-slate-50'} rounded-lg`} style={{ height: chartHeight }}>
        {isPrintMode ? (
          <div style={{ width: '100%', overflow: 'visible' }}>
            {chartContent}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartContent}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default SymptomGraph;

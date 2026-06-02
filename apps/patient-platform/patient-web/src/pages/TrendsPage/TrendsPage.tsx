/**
 * Trends Page - Patient Dashboard
 * =======================================
 * 
 * Interactive symptom timeline and medications tracker for patients.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';

import { usePatientTrends, useFetchProfileScreen } from '../../services/profile';
import FiltersSidebar from './components/FiltersSidebar';
import GraphSection from './components/GraphSection';
import PatientDataTable from './components/PatientDataTable';

// Symptom colors matching doctor side
const symptomColors: Record<string, string> = {
  'cough': '#FF9500',      // Orange
  'fever': '#EAB308',       // Yellow
  'pain': '#EC4899',        // Pink
  'vomiting': '#06B6D4',    // Light Blue
  'diarrhea': '#14B8A6',    // Teal
  'appetite loss': '#F97316', // Deep Orange
  'constipation': '#2563EB', // Dark Blue
  'shortness of breath': '#0EA5E9', // Sky Blue
  'headache': '#8B5CF6',    // Purple
  'dizziness': '#A855F7',   // Violet
  'insomnia': '#6366F1',    // Indigo
  'mouth sores': '#EC4899', // Pink
  'fatigue': '#8B5CF6',     // Purple
  'nausea': '#EC4899',      // Pink
  'joint': '#EAB308',       // Yellow
  'joint/muscle/general pain': '#EAB308', // Yellow
  'temperature': '#EF4444', // Red
};

const fallbackSymptomPalette = [
  '#22C55E', // green
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#A855F7', // purple
  '#EC4899', // pink
  '#EF4444', // red
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
];

const getSymptomColor = (symptomName: string) => {
  const key = toSymptomKey(symptomName);
  const mapped = symptomColors[key];
  if (mapped) return mapped;

  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackSymptomPalette[hash % fallbackSymptomPalette.length];
};

const severityValueMap: Record<string, number> = {
  relieved: 0,
  none: 0,
  normal: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
  'very severe': 4,
  urgent: 4,
};

const toSymptomKey = (name: string) => name.trim().toLowerCase();
const toTitleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDateAsLocal = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const shiftIsoDate = (date: string, offsetDays: number) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + offsetDays);
  return toIsoDate(parsed);
};

const clampDate = (date: string, minDate: string, maxDate: string) => {
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
};

const buildFocusedTimelineDates = (timelineData: {
  start_date: string;
  end_date: string;
  severity_series: Array<{ points: Array<{ date: string }> }>;
  temperature_series: Array<{ date: string }>;
}) => {
  const observedDates: string[] = [];
  timelineData.severity_series.forEach((series) => {
    series.points.forEach((point) => {
      if (point.date) observedDates.push(point.date);
    });
  });
  timelineData.temperature_series.forEach((point) => {
    if (point.date) observedDates.push(point.date);
  });

  if (!observedDates.length) {
    return buildDateRange(timelineData.start_date, timelineData.end_date);
  }

  observedDates.sort();
  const minObservedDate = observedDates[0];
  const paddedStart = clampDate(
    shiftIsoDate(minObservedDate, -2),
    timelineData.start_date,
    timelineData.end_date
  );
  const paddedEnd = timelineData.end_date;

  return buildDateRange(paddedStart, paddedEnd);
};

const fillSymptomSeriesByDate = (
  dates: string[],
  points: Array<{ date: string; value: string }>
) => {
  if (points.length <= 1) return points;

  const valueByDate = new Map(points.map((point) => [point.date, point.value] as const));
  const sortedInputDates = points.map((point) => point.date).sort();
  const firstDate = sortedInputDates[0];
  const lastDate = sortedInputDates[sortedInputDates.length - 1];
  let lastKnownValue: string | undefined;

  return dates
    .filter((date) => date >= firstDate && date <= lastDate)
    .map((date) => {
      const exactValue = valueByDate.get(date);
      if (exactValue) {
        lastKnownValue = exactValue;
      }

      if (!lastKnownValue) return null;
      return { date, value: lastKnownValue };
    })
    .filter((item): item is { date: string; value: string } => item !== null);
};

const fillTemperatureSeriesByDate = (
  dates: string[],
  points: Array<{ date: string; value: number }>
) => {
  if (points.length <= 1) return points;
  const sortedPoints = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = sortedPoints[0].date;
  const lastDate = sortedPoints[sortedPoints.length - 1].date;

  const dateToIndex = new Map(dates.map((date, idx) => [date, idx] as const));

  const interpolateValue = (date: string) => {
    for (let i = 0; i < sortedPoints.length - 1; i += 1) {
      const current = sortedPoints[i];
      const next = sortedPoints[i + 1];
      if (date < current.date || date > next.date) continue;

      const currentIdx = dateToIndex.get(current.date);
      const nextIdx = dateToIndex.get(next.date);
      const targetIdx = dateToIndex.get(date);
      if (
        typeof currentIdx !== 'number' ||
        typeof nextIdx !== 'number' ||
        typeof targetIdx !== 'number' ||
        nextIdx === currentIdx
      ) {
        return current.value;
      }

      const ratio = (targetIdx - currentIdx) / (nextIdx - currentIdx);
      return current.value + (next.value - current.value) * ratio;
    }
    return sortedPoints[sortedPoints.length - 1].value;
  };

  return dates
    .filter((date) => date >= firstDate && date <= lastDate)
    .map((date) => {
      const exact = sortedPoints.find((point) => point.date === date);
      return {
        date,
        value: typeof exact?.value === 'number' ? exact.value : interpolateValue(date),
      };
    });
};

const TrendsPage: React.FC = () => {
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery('(max-width:768px)');

  // Sidebar collapse state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Fullscreen chart state
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);

  // Filter states
  const defaultStartDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }, []);
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['all']);
  const [severityRange, setSeverityRange] = useState<number[]>([2, 4]);

  // Table pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Fetch data
  const {
    data: timeline,
    isLoading: timelineLoading,
    isFetching: timelineFetching,
  } = usePatientTrends(startDate, endDate);

  const { data: patientDetails } = useFetchProfileScreen();

  const formatDate = (dateStr: string) => {
    try {
      const localDate = parseIsoDateAsLocal(dateStr);
      if (!localDate) return dateStr;
      return localDate.toLocaleDateString('en-US', {
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
      const localDate = parseIsoDateAsLocal(dateStr);
      if (!localDate) return dateStr;
      return localDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const symptomOptions = useMemo(() => {
    const apiSymptoms = (timeline?.severity_series || []).map((series) => {
      return {
        id: toSymptomKey(series.symptom_name),
        label: toTitleCase(series.symptom_name),
        color: getSymptomColor(series.symptom_name),
      };
    });
    return [{ id: 'all', label: 'All Symptoms', color: null }, ...apiSymptoms];
  }, [timeline]);

  const tableData = useMemo(() => {
    if (!timeline) return [];

    const dateToTemperature = new Map(
      timeline.temperature_series.map((item) => [item.date, item.value] as const)
    );
    const severityBySymptomAndDate = new Map<string, string>();
    timeline.severity_series.forEach((series) => {
      const symptomIdKey = series.symptom_id?.trim().toLowerCase();
      if (!symptomIdKey) return;
      series.points.forEach((point) => {
        if (!point?.date) return;
        const value = point.value?.trim();
        if (!value) return;
        severityBySymptomAndDate.set(`${symptomIdKey}|${point.date}`, value);
      });
    });
    const selectedSet = new Set(selectedSymptoms);

    const rows = timeline.medications
      .filter((item) => selectedSymptoms.includes('all') || selectedSet.has(toSymptomKey(item.symptom_name)))
      .filter((item) => {
        const severityNumeric = severityValueMap[item.severity.toLowerCase()] ?? 0;
        return severityNumeric >= severityRange[0] && severityNumeric <= severityRange[1];
      })
      .map((item) => {
        const temperature = dateToTemperature.get(item.date);
        const severityFromSeries = severityBySymptomAndDate.get(
          `${item.symptom_id?.trim().toLowerCase()}|${item.date}`
        );
        const rawSeverity = (severityFromSeries || item.severity || '').trim();
        return {
          date: item.date,
          symptom: toTitleCase(item.symptom_name),
          severity: rawSeverity 
            ? (rawSeverity.toLowerCase() === 'moderate' ? 'Call Care Team' : toTitleCase(rawSeverity)) 
            : '--',
          medicationName: item.medication_name?.trim() ? item.medication_name : '--',
          medicationFrequency: item.medication_frequency?.trim() ? item.medication_frequency : '--',
          temperature: typeof temperature === 'number' ? `${temperature.toFixed(1)}°F` : '—',
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return rows;
  }, [timeline, selectedSymptoms, severityRange]);

  const handleSymptomToggle = (symptom: string) => {
    if (symptom === 'all') {
      setSelectedSymptoms(['all']);
    } else {
      setSelectedSymptoms(prev => {
        const newSelection = prev.includes(symptom)
          ? prev.filter(s => s !== symptom && s !== 'all')
          : [...prev.filter(s => s !== 'all'), symptom];
        return newSelection.length === 0 ? ['all'] : newSelection;
      });
    }
  };

  const handleResetFilters = () => {
    setStartDate(timeline?.start_date || defaultStartDate);
    setEndDate(timeline?.end_date || defaultEndDate);
    setSelectedSymptoms(['all']);
    setSeverityRange([2, 4]);
    setPage(0);
    setIsSidebarOpen(true);
  };

  // Process graph data
  const graphData = useMemo(() => {
    if (!timeline) return { dates: [], symptoms: [] };

    const sortedDates = buildFocusedTimelineDates(timeline);
    if (!sortedDates.length) return { dates: [], symptoms: [] };

    const selectedSet = new Set(
      selectedSymptoms.includes('all')
        ? timeline.severity_series.map((series) => toSymptomKey(series.symptom_name))
        : selectedSymptoms
    );

    const filteredSymptoms = timeline.severity_series
      .filter((series) => selectedSymptoms.includes('all') || selectedSet.has(toSymptomKey(series.symptom_name)))
      .map((series) => {
        const normalizedPoints = fillSymptomSeriesByDate(sortedDates, series.points);
        const points = normalizedPoints
          .map((point) => ({
            date: point.date,
            severity: point.value,
            severity_numeric: severityValueMap[point.value.toLowerCase()] ?? 0,
          }))
          .filter((point) => point.severity_numeric >= severityRange[0] && point.severity_numeric <= severityRange[1])
          .map((point) => ({
            ...point,
            dateIndex: sortedDates.indexOf(point.date),
          }))
          .filter((point) => point.dateIndex >= 0);

        return {
          name: toTitleCase(series.symptom_name),
          color: getSymptomColor(series.symptom_name),
          dataPoints: points,
        };
      })
      .filter((series) => series.dataPoints.length > 0);

    const normalizedTemperaturePoints = fillTemperatureSeriesByDate(sortedDates, timeline.temperature_series);
    const temperatureDataPoints = normalizedTemperaturePoints
      .map((point) => ({
        date: point.date,
        severity: point.value >= 100.4 ? 'fever' : 'normal',
        severity_numeric: point.value,
        dateIndex: sortedDates.indexOf(point.date),
      }))
      .filter((point) => point.dateIndex >= 0);

    const withTemperature = temperatureDataPoints.length
      ? [
        ...filteredSymptoms,
        {
          name: 'Temperature',
          color: symptomColors.temperature,
          dataPoints: temperatureDataPoints,
        },
      ]
      : filteredSymptoms;

    return { dates: sortedDates, symptoms: withTemperature };
  }, [timeline, selectedSymptoms, severityRange]);

  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    setEndDate((prevEndDate) => {
      return prevEndDate < newStartDate ? newStartDate : prevEndDate;
    });
  };

  const handleEndDateChange = (newEndDate: string) => {
    setEndDate(newEndDate);
    setStartDate((prevStartDate) => {
      return prevStartDate > newEndDate ? newEndDate : prevStartDate;
    });
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 w-full overflow-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[rgb(250,248,245)]'} transition-colors duration-200`}>
      {/* Fixed Header */}
      <div className={`flex-shrink-0 flex items-center justify-between p-4 border-b ${isDark ? 'bg-[#252320] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div>
          <h2 className={`text-lg md:text-xl font-bold mb-0 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            My Trends
          </h2>
          <p className={`text-xs md:text-sm mb-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Analyze your symptom progression, temperature readings, and medications.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row relative">
        {/* Sidebar Toggle Button - Desktop */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`hidden md:flex absolute left-0 top-4 z-30 ${isSidebarOpen ? 'left-[320px]' : 'left-0'} transition-all duration-300 ${isDark
            ? 'bg-[#252320] border-slate-700 text-slate-300 hover:bg-[#2A2725]'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            } border rounded-r-lg p-2 shadow-md hover:shadow-lg items-center justify-center`}
          style={{
            borderLeft: 'none',
          }}
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? (
            <ChevronLeft size={20} className="transition-transform" />
          ) : (
            <ChevronRight size={20} className="transition-transform" />
          )}
        </button>

        {/* Mobile Filter Toggle Button */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className={`md:hidden fixed bottom-6 right-6 z-40 bg-[#1e3a5f] text-white hover:bg-[#2563EB] rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center`}
            aria-label="Open filters"
          >
            <Filter size={24} />
          </button>
        )}

        {/* Mobile Overlay */}
        {isSidebarOpen && isMobile && (
          <div
            className="md:hidden absolute inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left Sidebar - Filters */}
        {(!isMobile || isSidebarOpen) && (
          <FiltersSidebar
            isOpen={isSidebarOpen}
            isDark={isDark}
            isMobile={isMobile}
            onClose={() => setIsSidebarOpen(false)}
            startDate={startDate}
            endDate={endDate}
            selectedSymptoms={selectedSymptoms}
            symptomOptions={symptomOptions}
            severityRange={severityRange}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onSymptomToggle={handleSymptomToggle}
            onSeverityRangeChange={setSeverityRange}
            onResetFilters={handleResetFilters}
          />
        )}

        {/* Main Content - Graph and Table */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden transition-all duration-300 min-w-0 ${isDark ? '[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-slate-800' : '[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100'
            }`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isDark ? '#475569 #1A1917' : '#cbd5e1 #f1f5f9',
          }}
        >
          <div className="p-3 sm:p-4 md:p-5 space-y-3 md:space-y-4">
            {/* Graph Section */}
            <GraphSection
              graphData={graphData}
              isLoading={timelineLoading || timelineFetching}
              isDark={isDark}
              isSidebarOpen={isSidebarOpen}
              isChartFullscreen={isChartFullscreen}
              onFullscreenOpen={() => setIsChartFullscreen(true)}
              onFullscreenClose={() => setIsChartFullscreen(false)}
              patientName={patientDetails?.first_name ? `${patientDetails.first_name} ${patientDetails.last_name || ''}` : 'My Trends'}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
              formatDateShort={formatDateShort}
              chemoDates={timeline?.chemo_dates ?? []}
              isFaxMode={false}
            />

            {/* Table Section */}
            {/* <PatientDataTable
              data={tableData}
              isDark={isDark}
              isLoading={timelineLoading || timelineFetching}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(newRowsPerPage) => {
                setRowsPerPage(newRowsPerPage);
                setPage(0);
              }}
              formatDate={formatDate}
            /> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendsPage;

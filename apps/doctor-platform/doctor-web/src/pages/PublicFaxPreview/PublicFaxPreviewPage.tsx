import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useThemeMode } from '@oncolife/ui-components';
import { usePatientDetails, usePatientQuestions, usePatientTimeline } from '../../services/dashboard';
import { useCurrentStaffProfile } from '../../services/staff';
import { tokenManager } from '../../utils/apiClient';
import GraphSection from '../PatientDetail/components/GraphSection';

const symptomColors: Record<string, string> = {
  cough: '#FF9500',
  fever: '#EAB308',
  pain: '#10B981',
  vomiting: '#06B6D4',
  diarrhea: '#14B8A6',
  'appetite loss': '#F97316',
  constipation: '#2563EB',
  'shortness of breath': '#0EA5E9',
  headache: '#8B5CF6',
  dizziness: '#A855F7',
  insomnia: '#6366F1',
  'mouth sores': '#EC4899',
  fatigue: '#8B5CF6',
  nausea: '#EC4899',
  temperature: '#EF4444',
};

const fallbackSymptomPalette = ['#22C55E', '#F59E0B', '#06B6D4', '#3B82F6', '#A855F7', '#EC4899', '#EF4444', '#14B8A6', '#6366F1', '#84CC16'];
const severityValueMap: Record<string, number> = { relieved: 0, none: 0, normal: 0, mild: 1, moderate: 2, severe: 3, 'very severe': 4, urgent: 4 };

const toSymptomKey = (name: string) => name.trim().toLowerCase();
const toSymptomIdKey = (id: unknown) => String(id ?? '').trim().toLowerCase();
const toTitleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());
const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const isIsoDate = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
const parseIsoDateAsLocal = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getSymptomColor = (symptomName: string) => {
  const key = toSymptomKey(symptomName);
  const mapped = symptomColors[key];
  if (mapped) return mapped;
  const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbackSymptomPalette[hash % fallbackSymptomPalette.length];
};

const buildDateRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [] as string[];
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
  timelineData.severity_series.forEach((series) => series.points.forEach((point) => point.date && observedDates.push(point.date)));
  timelineData.temperature_series.forEach((point) => point.date && observedDates.push(point.date));
  if (!observedDates.length) return buildDateRange(timelineData.start_date, timelineData.end_date);
  observedDates.sort();
  const minObservedDate = observedDates[0];
  const paddedStart = clampDate(shiftIsoDate(minObservedDate, -2), timelineData.start_date, timelineData.end_date);
  return buildDateRange(paddedStart, timelineData.end_date);
};

const fillSymptomSeriesByDate = (dates: string[], points: Array<{ date: string; value: string }>) => {
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
      if (exactValue) lastKnownValue = exactValue;
      if (!lastKnownValue) return null;
      return { date, value: lastKnownValue };
    })
    .filter((item): item is { date: string; value: string } => item !== null);
};

const fillTemperatureSeriesByDate = (dates: string[], points: Array<{ date: string; value: number }>) => {
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
      if (typeof currentIdx !== 'number' || typeof nextIdx !== 'number' || typeof targetIdx !== 'number' || nextIdx === currentIdx) return current.value;
      const ratio = (targetIdx - currentIdx) / (nextIdx - currentIdx);
      return current.value + (next.value - current.value) * ratio;
    }
    return sortedPoints[sortedPoints.length - 1].value;
  };

  return dates
    .filter((date) => date >= firstDate && date <= lastDate)
    .map((date) => {
      const exact = sortedPoints.find((point) => point.date === date);
      return { date, value: typeof exact?.value === 'number' ? exact.value : interpolateValue(date) };
    });
};

const PublicFaxPreviewPage: React.FC = () => {
  const { patientUiId } = useParams<{ patientUiId: string }>();
  const [searchParams] = useSearchParams();
  const { isDark } = useThemeMode();
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);
  const [clinicName, setClinicName] = useState('');
  const [clinicFax, setClinicFax] = useState('');

  const defaultStartDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }, []);
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], []);
  const initialStartDate = useMemo(() => {
    const fromQuery = searchParams.get('start_date');
    return isIsoDate(fromQuery) ? String(fromQuery) : defaultStartDate;
  }, [searchParams, defaultStartDate]);
  const initialEndDate = useMemo(() => {
    const fromQuery = searchParams.get('end_date');
    return isIsoDate(fromQuery) ? String(fromQuery) : defaultEndDate;
  }, [searchParams, defaultEndDate]);
  const [startDate] = useState(initialStartDate);
  const [endDate] = useState(initialEndDate);
  const [selectedSymptoms] = useState<string[]>(['all']);
  const [severityRange] = useState<number[]>([2, 4]);
  const tokenFromQuery = useMemo(() => searchParams.get('token') || '', [searchParams]);

  useEffect(() => {
    if (!tokenFromQuery) return;
    tokenManager.setToken(tokenFromQuery);
  }, [tokenFromQuery]);

  const { data: timeline, isLoading: timelineLoading, isFetching: timelineFetching } = usePatientTimeline(patientUiId || '', startDate, endDate);
  const { data: questions, isLoading: questionsLoading } = usePatientQuestions(patientUiId || '', 50);
  const { data: patientDetails } = usePatientDetails(patientUiId || '');
  const { data: currentStaffProfile } = useCurrentStaffProfile(true);

  useEffect(() => {
    if (currentStaffProfile) {
      setClinicName(currentStaffProfile.clinic_name || '--');
      setClinicFax(currentStaffProfile.clinic_fax || '--');
      return;
    }
    setClinicName('--');
    setClinicFax('--');
  }, [currentStaffProfile]);

  const formatDate = (dateStr: string) => {
    const localDate = parseIsoDateAsLocal(dateStr);
    if (!localDate) return dateStr;
    return localDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const formatDateShort = (dateStr: string) => {
    const localDate = parseIsoDateAsLocal(dateStr);
    if (!localDate) return dateStr;
    return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const tableData = useMemo(() => {
    if (!timeline) return [];
    const dateToTemperature = new Map(timeline.temperature_series.map((item) => [item.date, item.value] as const));
    const severityBySymptomAndDate = new Map<string, string>();
    timeline.severity_series.forEach((series) => {
      const symptomIdKey = toSymptomIdKey(series.symptom_id);
      if (!symptomIdKey) return;
      series.points.forEach((point) => {
        if (!point?.date) return;
        const value = point.value?.trim();
        if (!value) return;
        severityBySymptomAndDate.set(`${symptomIdKey}|${point.date}`, value);
      });
    });
    const selectedSet = new Set(selectedSymptoms);
    return timeline.medications
      .filter((item) => selectedSymptoms.includes('all') || selectedSet.has(toSymptomKey(item.symptom_name)))
      .map((item) => {
        const temperature = dateToTemperature.get(item.date);
        const severityFromSeries = severityBySymptomAndDate.get(`${toSymptomIdKey(item.symptom_id)}|${item.date}`);
        const rawSeverity = (severityFromSeries || item.severity || '').trim();
        return {
          date: item.date,
          symptom: toTitleCase(item.symptom_name),
          severity: rawSeverity ? toTitleCase(rawSeverity) : '--',
          medicationName: item.medication_name?.trim() ? item.medication_name : '--',
          medicationFrequency: item.medication_frequency?.trim() ? item.medication_frequency : '--',
          temperature: typeof temperature === 'number' ? `${temperature.toFixed(1)}°F` : '—',
        };
      })
      .filter((row) => {
        const severityNumeric = severityValueMap[row.severity.toLowerCase()] ?? 0;
        return severityNumeric >= severityRange[0] && severityNumeric <= severityRange[1];
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [timeline, selectedSymptoms, severityRange]);

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
            dateIndex: sortedDates.indexOf(point.date),
          }))
          .filter((point) => point.severity_numeric >= severityRange[0] && point.severity_numeric <= severityRange[1])
          .filter((point) => point.dateIndex >= 0);
        return { name: toTitleCase(series.symptom_name), color: getSymptomColor(series.symptom_name), dataPoints: points };
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

    return {
      dates: sortedDates,
      symptoms: temperatureDataPoints.length
        ? [...filteredSymptoms, { name: 'Temperature', color: symptomColors.temperature, dataPoints: temperatureDataPoints }]
        : filteredSymptoms,
    };
  }, [timeline, selectedSymptoms, severityRange]);

  return (
    <div className={`fax-print-root min-h-screen p-3 md:p-4 ${isDark ? 'bg-[#1A1917] text-slate-100' : 'bg-[rgb(250,248,245)] text-slate-900'}`}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          .fax-print-root {
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .fax-print-container {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
          }
          .fax-print-chart {
            page-break-inside: avoid;
            break-inside: avoid;
            width: 100% !important;
            overflow: visible !important;
          }
          .fax-print-chart > div,
          .fax-print-chart [data-export-chart="patient-symptom-graph"] {
            width: 100% !important;
            overflow: visible !important;
          }
          .fax-print-chart [data-export-chart="patient-symptom-graph"] > div {
            height: 520px !important;
            min-height: 520px !important;
          }
          .fax-print-chart .recharts-responsive-container {
            width: 100% !important;
            height: 520px !important;
            min-height: 520px !important;
          }
          .fax-print-chart .recharts-wrapper,
          .fax-print-chart .recharts-surface {
            width: 100% !important;
          }
        }
      `}</style>
      <div className="fax-print-container max-w-[1400px] mx-auto space-y-3">
        <div className={`${isDark ? 'bg-[#252320] border-slate-700/50' : 'bg-white border-slate-200'} rounded-lg border p-3`}>
          <h1 className="text-base md:text-lg font-semibold">Fax Preview</h1>
          <p className={`text-xs md:text-sm mb-0 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Patient UI ID: {patientUiId || '--'}
          </p>
          <p className={`text-xs md:text-sm mb-0 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Patient Name : {patientDetails?.patientName || '--'}
          </p>
          <p className={`text-xs md:text-sm mb-0 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Date Range: {startDate} to {endDate}
          </p>
          <div className={`text-xs md:text-sm font-medium flex flex-wrap items-center gap-x-6 gap-y-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            <span>Clinic Name : <span className="font-semibold">{clinicName || '--'}</span></span>
            <span>Fax Number : <span className="font-semibold">{clinicFax || '--'}</span></span>
          </div>
        </div>

        <div className="flex items-start min-h-0 gap-3">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="fax-print-chart">
              <GraphSection
                graphData={graphData}
                isLoading={timelineLoading || timelineFetching}
                isDark={isDark}
                isSidebarOpen={false}
                isChartFullscreen={isChartFullscreen}
                onFullscreenOpen={() => setIsChartFullscreen(true)}
                onFullscreenClose={() => setIsChartFullscreen(false)}
                patientName={patientDetails?.patientName}
                patientUuid={patientUiId}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={() => {}}
                onEndDateChange={() => {}}
                formatDateShort={formatDateShort}
                chemoDates={timeline?.chemo_dates ?? (timeline?.last_chemo_date ? [timeline.last_chemo_date] : [])}
                isFaxMode
              />
            </div>

            <div className={`${isDark ? 'bg-[#252320] border-slate-700/50' : 'bg-white border-slate-200'} rounded-lg border p-3`}>
              <h3 className={`text-sm md:text-base font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Medications
              </h3>
              {timelineLoading || timelineFetching ? (
                <div className={`text-sm py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading medications...</div>
              ) : tableData.length === 0 ? (
                <div className={`text-sm py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No table data</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px]">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <th className={`text-left py-2 px-2 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Date</th>
                        <th className={`text-left py-2 px-2 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Symptom</th>
                        <th className={`text-left py-2 px-2 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Severity</th>
                        <th className={`text-left py-2 px-2 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Medication Name and Frequency</th>
                        <th className={`text-left py-2 px-2 text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Temperature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, idx) => (
                        <tr key={`${row.date}-${row.symptom}-${idx}`} className={`border-b ${isDark ? 'border-slate-800/50' : 'border-slate-100'}`}>
                          <td className={`py-2 px-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>{formatDate(row.date)}</td>
                          <td className={`py-2 px-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>{row.symptom}</td>
                          <td className={`py-2 px-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.severity}</td>
                          <td className={`py-2 px-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.medicationName}</td>
                          <td className={`py-2 px-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'} whitespace-nowrap`}>{row.temperature}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`${isDark ? 'bg-[#252320] border-slate-700/50' : 'bg-white border-slate-200'} rounded-lg border p-3`}>
          <h3 className={`text-sm md:text-base font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Shared Questions
          </h3>
          {questionsLoading ? (
            <div className={`text-sm py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading shared questions...</div>
          ) : !questions || questions.length === 0 ? (
            <div className={`text-sm py-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No shared questions</div>
          ) : (
            <div className="space-y-2">
              {questions.map((question, idx) => (
                <div
                  key={question.id || `question-${idx}`}
                  className={`rounded border rounded-sm px-3 py-2 ${isDark ? 'border-slate-700 bg-[#1F1E1B]' : 'border-slate-200 bg-slate-50'}`}
                >
                  <p className={`text-xs md:text-sm font-medium mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {question.question_text}
                  </p>
                  <p className={`text-[11px] md:text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {question.category ? `${question.category} • ` : ''}
                    {question.created_at ? `Shared on ${new Date(question.created_at).toLocaleDateString()}` : 'Shared date unavailable'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicFaxPreviewPage;

/**
 * Patient Tabs Component
 * Displays Treatment Events, Shared Questions, and Diary Entries in tabs
 */

import React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { MessageSquare, Pill, Clock, FileText, Calendar as CalendarIcon } from 'lucide-react';

interface TreatmentEvent {
  event_type?: string;
  event_date?: string;
  metadata?: {
    cycle?: number;
    medication?: string;
    dosage?: string;
    [key: string]: any;
  };
}

interface PatientTabsProps {
  tabValue: number;
  onTabChange: (value: number) => void;
  treatmentEvents: TreatmentEvent[];
  isDark: boolean;
  formatDate: (date: string) => string;
}

const PatientTabs: React.FC<PatientTabsProps> = ({
  tabValue,
  onTabChange,
  treatmentEvents,
  isDark,
  formatDate,
}) => {
  return (
    <Paper 
      elevation={0}
      sx={{
        borderRadius: 2,
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        backgroundColor: isDark ? '#252320' : 'white',
        overflow: 'hidden',
      }}
    >
      <Tabs
        value={tabValue}
        onChange={(_, newValue) => onTabChange(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          backgroundColor: isDark ? '#1A1917' : '#f8fafc',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
            minHeight: '48px',
            padding: '12px 16px',
            color: isDark ? '#94a3b8' : '#64748b',
            gap: '8px',
            '&.Mui-selected': {
              color: isDark ? '#60a5fa' : '#2563EB',
              fontWeight: 600,
            },
            '&:hover': {
              color: isDark ? '#cbd5e1' : '#475569',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: isDark ? '#60a5fa' : '#2563EB',
            height: '3px',
          },
          '& .MuiTabs-scrollButtons': {
            color: isDark ? '#94a3b8' : '#64748b',
            '&.Mui-disabled': {
              opacity: 0.3,
            },
          },
        }}
      >
        <Tab
          icon={<Pill size={18} />}
          iconPosition="start"
          label="Treatment Events"
        />
        <Tab
          icon={<MessageSquare size={18} />}
          iconPosition="start"
          label="Shared Questions"
        />
        <Tab
          icon={<FileText size={18} />}
          iconPosition="start"
          label="Diary Entries"
        />
      </Tabs>

      <Box sx={{ p: 3, minHeight: '200px' }}>
        {/* Treatment Events Tab */}
        {tabValue === 0 && (
          <Box>
            {treatmentEvents && treatmentEvents.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {treatmentEvents.map((event, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                        backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                        transform: 'translateY(-1px)',
                        boxShadow: isDark 
                          ? '0 4px 12px rgba(0, 0, 0, 0.2)' 
                          : '0 2px 8px rgba(0, 0, 0, 0.08)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            color: isDark ? '#f1f5f9' : '#0f172a',
                            textTransform: 'capitalize',
                            fontSize: '0.875rem',
                            mb: 0.5,
                          }}
                        >
                          {event.event_type?.replace(/_/g, ' ') || 'Treatment Event'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Clock size={14} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                          <Typography
                            variant="body2"
                            sx={{
                              color: isDark ? '#94a3b8' : '#64748b',
                              fontSize: '0.8rem',
                            }}
                          >
                            {event.event_date ? formatDate(event.event_date) : 'Date not available'}
                          </Typography>
                        </Box>
                      </Box>
                      {event.metadata?.cycle && (
                        <Chip
                          icon={<CalendarIcon size={14} />}
                          label={`Cycle ${event.metadata.cycle}`}
                          size="small"
                          sx={{
                            backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)',
                            color: isDark ? '#60a5fa' : '#2563EB',
                            fontSize: '0.75rem',
                            height: '26px',
                            fontWeight: 500,
                            border: `1px solid ${isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(37, 99, 235, 0.2)'}`,
                          }}
                        />
                      )}
                    </Box>
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {Object.entries(event.metadata)
                            .filter(([key]) => key !== 'cycle')
                            .map(([key, value]) => (
                              <Chip
                                key={key}
                                label={`${key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}: ${value}`}
                                size="small"
                                sx={{
                                  backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.08)',
                                  color: isDark ? '#cbd5e1' : '#475569',
                                  fontSize: '0.7rem',
                                  height: '22px',
                                  fontWeight: 400,
                                }}
                              />
                            ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 8,
                  px: 2,
                }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 2,
                    borderRadius: '50%',
                    backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                    mb: 2,
                  }}
                >
                  <Pill size={32} style={{ color: isDark ? '#60a5fa' : '#2563EB', opacity: 0.7 }} />
                </Box>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: isDark ? '#cbd5e1' : '#475569',
                    fontWeight: 500,
                    mb: 1,
                  }}
                >
                  No treatment events recorded
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.875rem',
                  }}
                >
                  Treatment events and medication schedules will appear here when available.
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Shared Questions Tab */}
        {tabValue === 1 && (
          <Box>
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                px: 2,
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 2,
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                  mb: 2,
                }}
              >
                <MessageSquare size={32} style={{ color: isDark ? '#60a5fa' : '#2563EB', opacity: 0.7 }} />
              </Box>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: isDark ? '#cbd5e1' : '#475569',
                  fontWeight: 500,
                  mb: 1,
                }}
              >
                No shared questions
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '0.875rem',
                  maxWidth: '400px',
                  mx: 'auto',
                }}
              >
                Questions shared between patient and healthcare provider will appear here.
              </Typography>
            </Box>
          </Box>
        )}

        {/* Diary Entries Tab */}
        {tabValue === 2 && (
          <Box>
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                px: 2,
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 2,
                  borderRadius: '50%',
                  backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.08)',
                  mb: 2,
                }}
              >
                <FileText size={32} style={{ color: isDark ? '#60a5fa' : '#2563EB', opacity: 0.7 }} />
              </Box>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: isDark ? '#cbd5e1' : '#475569',
                  fontWeight: 500,
                  mb: 1,
                }}
              >
                No diary entries
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: '0.875rem',
                  maxWidth: '400px',
                  mx: 'auto',
                }}
              >
                Patient diary entries and notes will be displayed here when available.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default PatientTabs;

/**
 * Patient Tabs Component
 * Displays Shared Questions section
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useParams } from 'react-router-dom';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { MessageSquare, CheckCircle2, Clock } from 'lucide-react';
import { usePatientQuestions } from '../../../services/dashboard';

interface PatientTabsProps {
  isDark: boolean;
}

const PatientTabs: React.FC<PatientTabsProps> = ({
  isDark,
}) => {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: questions, isLoading } = usePatientQuestions(uuid || '', 50);

  const renderQuestions = () => {
    if (isLoading) {
      return (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Paper
              key={i}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'white',
              }}
            >
              <Skeleton variant="text" width="80%" height={24} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="40%" height={20} />
            </Paper>
          ))}
        </Stack>
      );
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return (
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
      );
    }

    return (
      <Stack spacing={2}>
        {questions.map((q) => (
          <Paper
            key={q.id}
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 1,
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'white',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: isDark ? '#4b5563' : '#cbd5e1',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
              }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  color: isDark ? '#f1f5f9' : '#1e293b',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  flex: 1,
                  pr: 2,
                }}
              >
                {q.question_text}
              </Typography>
              <Chip
                icon={q.is_answered ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                label={q.is_answered ? 'Answered' : 'Pending'}
                size="small"
                variant="outlined"
                sx={{
                  height: '24px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: q.is_answered 
                    ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)')
                    : (isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.05)'),
                  color: q.is_answered 
                    ? (isDark ? '#4ade80' : '#16a34a')
                    : (isDark ? '#fbbf24' : '#d97706'),
                  borderColor: q.is_answered 
                    ? (isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.2)')
                    : (isDark ? 'rgba(234, 179, 8, 0.2)' : 'rgba(234, 179, 8, 0.2)'),
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {q.category && (
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.025em',
                  }}
                >
                  {q.category}
                </Typography>
              )}
              {q.created_at && (
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#64748b' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  Shared on {new Date(q.created_at).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          </Paper>
        ))}
      </Stack>
    );
  };

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
      <Box
        sx={{
          borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          backgroundColor: isDark ? '#1A1917' : '#f8fafc',
          px: 2,
          py: 1.5,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: isDark ? '#60a5fa' : '#2563EB',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          <MessageSquare size={16} />
          Shared Questions
        </Typography>
      </Box>
      <Box sx={{ p: 3, minHeight: '200px' }}>
        <Box>
          {renderQuestions()}
        </Box>
      </Box>
    </Paper>
  );
};

export default PatientTabs;

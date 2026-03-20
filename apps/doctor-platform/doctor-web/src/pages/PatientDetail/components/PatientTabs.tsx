/**
 * Patient Tabs Component
 * Displays Shared Questions section
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { MessageSquare } from 'lucide-react';

interface PatientTabsProps {
  isDark: boolean;
}

const PatientTabs: React.FC<PatientTabsProps> = ({
  isDark,
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
      </Box>
    </Paper>
  );
};

export default PatientTabs;

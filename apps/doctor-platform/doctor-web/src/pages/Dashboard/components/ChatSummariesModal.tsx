import React from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import { MessageCircle } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useThemeMode } from '@oncolife/ui-components';
import { usePatientConversations } from '../../../services/patients';

interface ChatSummariesModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientUuid: string;
  patientName: string;
}

export const ChatSummariesModal: React.FC<ChatSummariesModalProps> = ({
  isOpen,
  onClose,
  patientUuid,
  patientName,
}) => {
  const { isDark } = useThemeMode();
  const { data: realConversations, isLoading } = usePatientConversations(patientUuid);

  const conversations = realConversations || [];

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getTriageMeta = (triageLevel?: string | null) => {
    const value = (triageLevel || '').toLowerCase();

    if (value === 'call_911') {
      return {
        label: 'Severe',
        bg: isDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)',
        color: isDark ? '#fca5a5' : '#991b1b',
      };
    }

    if (value === 'notify_care_team') {
      return {
        label: 'Moderate',
        bg: isDark ? 'rgba(249, 115, 22, 0.22)' : 'rgba(249, 115, 22, 0.12)',
        color: isDark ? '#fdba74' : '#9a3412',
      };
    }

    if (value === 'none') {
      return {
        label: 'Mild',
        bg: isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.12)',
        color: isDark ? '#6ee7b7' : '#065f46',
      };
    }

    const fallbackLabel = triageLevel
      ? triageLevel.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
      : 'Unknown';

    return {
      label: fallbackLabel,
      bg: isDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(100, 116, 139, 0.12)',
      color: isDark ? '#cbd5e1' : '#334155',
    };
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chat Summaries — ${patientName}`}
      titleDescription={`${conversations?.length || 0} summary entries from chatbot check-ins.`}
      size="lg"
    >
      <Box sx={{  minHeight: '300px' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={32} thickness={5} sx={{ color: '#2563EB' }} />
          </Box>
        ) : conversations && conversations.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {conversations.map((conv) => {
              // Extract human-readable symptoms from bulleted_summary if available
              const symptomNames = (() => {
                if (!conv.bulleted_summary) return [];
                const match = conv.bulleted_summary.match(/Symptoms:\s*([^|]+)/);
                if (match && match[1]) {
                  return match[1].split(',').map(s => s.trim()).filter(Boolean);
                }
                return [];
              })();

              const triageMeta = getTriageMeta((conv as { triage_level?: string | null }).triage_level);

              return (
                <Box
                  key={conv.uuid}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                      {formatDate(conv.created_at)}
                    </Typography>
                    <Chip
                      label={triageMeta.label}
                      size="small"
                      sx={{
                        height: '24px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: triageMeta.bg,
                        color: triageMeta.color,
                        border: 'none',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    />
                  </Box>

                  <Typography variant="body2" sx={{ color: isDark ? '#cbd5e1' : '#475569', mb: 2, lineHeight: 1.6 }}>
                    {conv.clinical_narrative_summary}
                  </Typography>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {(symptomNames.length > 0 ? symptomNames : (conv.symptom_list || [])).map((symptom) => (
                      <Chip
                        key={symptom}
                        label={symptom}
                        size="small"
                        sx={{
                          height: '24px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                          color: isDark ? '#94a3b8' : '#64748b',
                          border: 'none',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <MessageCircle size={24} className="text-blue-500" />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a', mb: 1 }}>
              No chat summaries found
            </Typography>
            <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              When the patient completes a chatbot check-in, summaries will appear here.
            </Typography>
          </Box>
        )}
      </Box>
    </Modal>
  );
};

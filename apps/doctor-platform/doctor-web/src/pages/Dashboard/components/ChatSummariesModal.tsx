/**
 * Chat Summaries Modal Component
 * Displays historical chatbot check-in summaries for a patient.
 */

import React from 'react';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import { MessageCircle } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { useThemeMode } from '@oncolife/ui-components';
import { usePatientConversations } from '../../../services/patients';

// Static mock data for demonstration
const MOCK_SUMMARIES = [
  {
    id: 'mock-1',
    created_at: '2026-01-05T10:00:00Z',
    status: 'good',
    summary_text: 'Patient reported mild cough and occasional pain. Stated medication is helping. Feeling optimistic about treatment progress.',
    tags: ['Cough', 'Pain']
  },
  {
    id: 'mock-2',
    created_at: '2026-01-03T14:30:00Z',
    status: 'fair',
    summary_text: 'Patient experiencing moderate constipation and mild pain. Requested guidance on dietary changes. Expressed some frustration with side effects.',
    tags: ['Constipation', 'Pain']
  },
  {
    id: 'mock-3',
    created_at: '2026-01-01T09:15:00Z',
    status: 'poor',
    summary_text: 'Patient reported severe pain and vomiting after chemo session. Had difficulty keeping food down. Advised to contact clinic if symptoms persist.',
    tags: ['Pain', 'Vomiting']
  },
  {
    id: 'mock-4',
    created_at: '2026-01-01T09:15:00Z',
    status: 'poor',
    summary_text: 'Patient reported severe pain and vomiting after chemo session. Had difficulty keeping food down. Advised to contact clinic if symptoms persist.',
    tags: ['Pain', 'Vomiting']
  },
  {
    id: 'mock-5',
    created_at: '2026-01-01T09:15:00Z',
    status: 'poor',
    summary_text: 'Patient reported severe pain and vomiting after chemo session. Had difficulty keeping food down. Advised to contact clinic if symptoms persist.',
    tags: ['Pain', 'Vomiting']
  }
];

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

  // Use mock data if real data is empty or errors (for demonstration)
  const conversations = (realConversations && realConversations.length > 0) 
    ? realConversations 
    : MOCK_SUMMARIES;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'good':
        return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'fair':
        return isDark ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200';
      case 'poor':
        return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200';
      default:
        return isDark ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-700 border-slate-200';
    }
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
            {conversations.map((conv) => (
              <Box
                key={conv.id}
                sx={{
                  p: 2,
                  borderRadius: 1,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: isDark ? '#f1f5f9' : '#0f172a' }}>
                    {formatDate(conv.created_at)}
                  </Typography>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(conv.status)} ml-auto`}>
                    {conv.status}
                  </span>
                </Box>
                <Typography variant="body2" sx={{ color: isDark ? '#cbd5e1' : '#475569', mb: 2, lineHeight: 1.6 }}>
                  {conv.summary_text}
                </Typography>
                {conv.tags && conv.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {conv.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
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
                )}
              </Box>
            ))}
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

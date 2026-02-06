/**
 * Patient Profile Modal Component
 * Displays and allows editing of patient information
 */

import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { User, X } from 'lucide-react';

export type PatientProfile = {
  mrn: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  location: string;
  regimenName: string;
  dayOfChemotherapy: string;
  nextChemotherapyTreatment: string;
};

interface PatientProfileModalProps {
  open: boolean;
  onClose: () => void;
  patientProfile: PatientProfile;
  onProfileChange: (profile: PatientProfile) => void;
  onSave: () => void;
  isDark: boolean;
}

const PatientProfileModal: React.FC<PatientProfileModalProps> = ({
  open,
  onClose,
  patientProfile,
  onProfileChange,
  onSave,
  isDark,
}) => {
  const handleFieldChange = (field: keyof PatientProfile, value: string) => {
    onProfileChange({ ...patientProfile, [field]: value });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          backgroundColor: isDark ? '#252320' : 'white',
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 2,
          borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          backgroundColor: isDark ? '#1A1917' : '#f8fafc',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.08)',
            }}
          >
            <User size={24} style={{ color: isDark ? '#60a5fa' : '#2563EB' }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontSize: '1.25rem',
              }}
            >
              Patient Profile
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: '0.875rem',
                mt: 0.5,
              }}
            >
              Manage patient information and preferences.
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: isDark ? '#94a3b8' : '#64748b',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            },
          }}
        >
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          backgroundColor: isDark ? '#252320' : 'white',
        }}
      >
        <Box sx={{ p: 3 }}>
          {/* Personal Information Section */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontSize: '1rem',
                mb: 3,
                pb: 1.5,
                borderBottom: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              Personal Information
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Medical Record Number (MRN)
                </Typography>
                <TextField
                  fullWidth
                  value={patientProfile.mrn}
                  onChange={(e) => handleFieldChange('mrn', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  First Name
                </Typography>
                <TextField
                  fullWidth
                  value={patientProfile.firstName}
                  onChange={(e) => handleFieldChange('firstName', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Last Name
                </Typography>
                <TextField
                  fullWidth
                  value={patientProfile.lastName}
                  onChange={(e) => handleFieldChange('lastName', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Email
                </Typography>
                <TextField
                  fullWidth
                  type="email"
                  value={patientProfile.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Phone
                </Typography>
                <TextField
                  fullWidth
                  type="tel"
                  value={patientProfile.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Date of Birth
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={patientProfile.dateOfBirth}
                  onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                  size="small"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Location
                </Typography>
                <TextField
                  fullWidth
                  value={patientProfile.location}
                  onChange={(e) => handleFieldChange('location', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Treatment Information Section */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: isDark ? '#f1f5f9' : '#0f172a',
                fontSize: '1rem',
                mb: 3,
                pb: 1.5,
                borderBottom: `2px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              }}
            >
              Treatment Information
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Regimen Name
                </Typography>
                <TextField
                  fullWidth
                  value={patientProfile.regimenName}
                  onChange={(e) => handleFieldChange('regimenName', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Day of Chemotherapy Treatment
                </Typography>
                <TextField
                  fullWidth
                  value={patientProfile.dayOfChemotherapy}
                  onChange={(e) => handleFieldChange('dayOfChemotherapy', e.target.value)}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>

              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Next Chemotherapy Treatment
                </Typography>
                <TextField
                  fullWidth
                  type="datetime-local"
                  value={patientProfile.nextChemotherapyTreatment}
                  onChange={(e) => handleFieldChange('nextChemotherapyTreatment', e.target.value)}
                  size="small"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDark ? '#1A1917' : '#f8fafc',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                      fontSize: '0.875rem',
                      '& fieldset': {
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                      },
                      '&:hover fieldset': {
                        borderColor: isDark ? '#475569' : '#cbd5e1',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#2563EB',
                        borderWidth: '2px',
                      },
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Save Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2, borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <Button
              variant="outlined"
              onClick={onClose}
              sx={{
                borderColor: isDark ? '#334155' : '#e2e8f0',
                color: isDark ? '#cbd5e1' : '#475569',
                textTransform: 'none',
                '&:hover': {
                  borderColor: isDark ? '#475569' : '#cbd5e1',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={onSave}
              sx={{
                backgroundColor: '#2563EB',
                color: 'white',
                textTransform: 'none',
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: '#1d4ed8',
                },
              }}
            >
              Save Changes
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PatientProfileModal;

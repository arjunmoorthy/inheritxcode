/**
 * OncoLife Physician Portal - Patients Management
 * Patient list with search and management capabilities
 */

import React, { useState, useEffect } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import { Search, Plus, Edit, Users, Calendar, Mail, ChevronRight } from 'lucide-react';
import { usePatients, type Patient } from '../../services/patients';
import { useThemeMode } from '@oncolife/ui-components';
import AddPatientModal from './components/AddPatientModal';
import EditPatientModal from './components/EditPatientModal';

// Theme colors (Doctor)
const colors = {
  primary: '#1E3A5F',
  primaryLight: '#2E5077',
  secondary: '#2563EB',
  background: '#F8FAFC',
  paper: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
};

const PatientsPage: React.FC = () => {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Debounce search: wait 400ms after typing stops; clear triggers API immediately
  useEffect(() => {
    const trimmed = typeof search === 'string' ? search.trim() : '';
    if (trimmed === '') {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 400);
    return () => clearTimeout(timer);
  }, [search]);
  
  const { data, isLoading, error } = usePatients(page + 1, debouncedSearch, rowsPerPage);
  
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };
  
  const handleAddPatient = () => {
    setIsAddModalOpen(true);
  };
  
  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsEditModalOpen(true);
  };
  
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'P';
  };
  
  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[rgb(250,248,245)]'} transition-colors duration-200`}>
      {/* Fixed Header */}
      <div 
        className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917] border-b border-slate-800/50' : 'bg-white/95 backdrop-blur-sm border-b border-slate-200/60'} transition-all duration-200 shadow-sm`}
      >
        <div className="p-6 pb-5 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Users size={22} className={isDark ? 'text-blue-400' : 'text-secondary'} />
              </div>
              <div>
                <h1 className={`text-3xl md:text-[1.75rem] font-bold font-serif ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 leading-tight`}>
                  Patient Management
                </h1>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1.5 mb-0 font-medium`}>
                  View and manage your patient roster
                </p>
              </div>
            </div>
            <Button
              variant="contained"
              startIcon={<Plus size={18} />}
              onClick={handleAddPatient}
              sx={{
                bgcolor: colors.primary,
                borderRadius: 2,
                px: 3,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: colors.primaryLight,
                },
              }}
            >
              Add Patient
            </Button>
          </div>
        </div>
      </div>
      
      {/* Fixed Search Bar */}
      <div
        className={`flex-shrink-0 ${isDark ? 'bg-[#1A1917]/95 backdrop-blur-sm border-b border-slate-800/50' : 'bg-white/95 backdrop-blur-sm border-b border-slate-200/60'} transition-all duration-200 shadow-md`}
      >
        <div className="p-6 py-5 max-w-[1400px] mx-auto w-full">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <TextField
                fullWidth
                placeholder="Search by first name, last name, or full name..."
                value={search}
                onChange={handleSearchChange}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    backgroundColor: isDark ? '#1A1917' : 'white',
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    boxShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                    transition: 'all 0.2s ease',
                    '& fieldset': {
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      borderWidth: '1.5px',
                    },
                    '&:hover fieldset': {
                      borderColor: isDark ? '#475569' : '#cbd5e1',
                    },
                    '&.Mui-focused': {
                      boxShadow: isDark ? '0 0 0 3px rgba(37, 99, 235, 0.2)' : '0 0 0 3px rgba(37, 99, 235, 0.1)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2563EB',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: isDark ? '#f1f5f9' : '#0f172a',
                    padding: '10px 14px',
                    '&::placeholder': {
                      color: isDark ? '#94a3b8' : '#64748b',
                      opacity: 0.7,
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Scrollable Content Area */}
      <div 
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${isDark ? '[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-slate-800' : '[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100'}`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? '#475569 #1A1917' : '#cbd5e1 #f1f5f9',
        }}
      >
        <div className="p-6 pt-4 pb-4 max-w-[1400px] mx-auto w-full">
          {error && (
        <Box sx={{ 
          p: 2, 
          bgcolor: isDark ? '#7f1d1d' : '#FEF2F2', 
          borderRadius: 2, 
          border: `1px solid ${isDark ? '#991b1b' : '#FECACA'}`,
          mb: 2 
        }}>
          <Typography 
            variant="body2"
            sx={{
              color: isDark ? '#fca5a5' : '#dc2626',
            }}
          >
            Error loading patients. Please try again.
          </Typography>
        </Box>
      )}
      
      {isLoading ? (
        <div className={`${isDark ? 'bg-[#1A1917] border-slate-700/50' : 'bg-white border-slate-200'} rounded-xl border overflow-hidden`}>
          <Box sx={{ p: 3 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Skeleton 
                  variant="circular" 
                  width={40} 
                  height={40}
                  sx={{
                    bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Skeleton 
                    variant="text" 
                    width="40%"
                    sx={{
                      bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                      mb: 1,
                    }}
                  />
                  <Skeleton 
                    variant="text" 
                    width="60%"
                    sx={{
                      bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        </div>
      ) : data?.data.length === 0 ? (
        <div className={`${isDark ? 'bg-[#1A1917] border-slate-700/50' : 'bg-white border-slate-200'} rounded-xl border overflow-hidden`}>
          <div className="text-center py-16 px-6">
            <Users size={48} className={`${isDark ? 'text-slate-500' : 'text-slate-400'} mx-auto mb-4`} />
            <h3 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'} m-0 mb-2`}>
              No Patients Found
            </h3>
            <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} text-sm m-0`}>
              Add your first patient or try a different search term.
            </p>
          </div>
        </div>
      ) : isMobile ? (
        // Mobile Card View
        <Box>
          {data?.data.map((patient) => (
            <div 
              key={patient.id}
              className={`${isDark ? 'bg-[#1A1917] border-slate-700/50' : 'bg-white border-slate-200'} rounded-xl border mb-3 overflow-hidden`}
            >
              <div className={`flex items-center gap-3 p-4 ${isDark ? 'bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30 border-slate-700/50' : 'bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border-slate-200'} border-b`}>
                <Avatar sx={{ 
                  bgcolor: isDark ? '#2563EB' : colors.primary, 
                  width: 44, 
                  height: 44,
                  fontWeight: 600,
                }}>
                  {getInitials(patient.firstName, patient.lastName)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                    {patient.firstName} {patient.lastName}
                  </Typography>
                  <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                    MRN: {patient.mrn}
                  </Typography>
                </Box>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Email</span>
                  <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{patient.email}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>DOB</span>
                  <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{patient.dateOfBirth}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className={`font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Sex</span>
                  <span className={isDark ? 'text-slate-100' : 'text-slate-900'}>{patient.sex}</span>
                </div>
              </div>
              <div className={`flex justify-end px-4 py-3 ${isDark ? 'border-slate-700/50' : 'border-slate-200'} border-t`}>
                <Button
                  size="small"
                  endIcon={<ChevronRight size={16} />}
                  onClick={() => handleEditPatient(patient)}
                  sx={{ 
                    color: isDark ? '#60a5fa' : colors.secondary,
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                    },
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          ))}
          
          {data && data.total > rowsPerPage && (
            <TablePagination
              component="div"
              count={data.total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
              sx={{ 
                bgcolor: isDark ? '#1A1917' : colors.paper, 
                borderRadius: 2, 
                mt: 2,
                color: isDark ? '#f1f5f9' : '#0f172a',
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  color: isDark ? '#f1f5f9' : '#0f172a',
                },
                '& .MuiIconButton-root': {
                  color: isDark ? '#cbd5e1' : '#475569',
                },
              }}
            />
          )}
        </Box>
      ) : (
        // Desktop Table View
        <div className={`${isDark ? 'bg-[#1A1917] border-slate-700/50' : 'bg-white border-slate-200'} rounded-xl border overflow-hidden`}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: isDark ? 'rgba(30, 58, 95, 0.3)' : 'rgba(30, 58, 95, 0.08)' }}>
                  <TableCell sx={{ fontWeight: 600, color: isDark ? '#cbd5e1' : colors.primary }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: isDark ? '#cbd5e1' : colors.primary }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: isDark ? '#cbd5e1' : colors.primary }}>MRN</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: isDark ? '#cbd5e1' : colors.primary }}>DOB</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: isDark ? '#cbd5e1' : colors.primary }}>Sex</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: isDark ? '#cbd5e1' : colors.primary }} align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data?.data.map((patient) => (
                  <TableRow 
                    key={patient.id}
                    sx={{ 
                      '&:hover': { bgcolor: isDark ? '#2A2725' : colors.background },
                      cursor: 'pointer',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    }}
                  >
                    <TableCell sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ 
                          bgcolor: isDark ? '#2563EB' : colors.primary, 
                          width: 36, 
                          height: 36,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                        }}>
                          {getInitials(patient.firstName, patient.lastName)}
                        </Avatar>
                        <Typography fontWeight={500} sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                          {patient.firstName} {patient.lastName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Mail size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                        {patient.email}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={patient.mrn} 
                        size="small" 
                        sx={{ 
                          bgcolor: isDark ? 'rgba(37, 99, 235, 0.2)' : `${colors.secondary}15`,
                          color: isDark ? '#60a5fa' : colors.secondary,
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Calendar size={14} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                        {patient.dateOfBirth}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: isDark ? '#f1f5f9' : '#0f172a' }}>{patient.sex}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit Patient">
                        <IconButton
                          size="small"
                          onClick={() => handleEditPatient(patient)}
                          sx={{ 
                            color: isDark ? '#60a5fa' : colors.secondary,
                            '&:hover': { 
                              bgcolor: isDark ? 'rgba(96, 165, 250, 0.15)' : `${colors.secondary}15`,
                            },
                          }}
                        >
                          <Edit size={18} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            component="div"
            count={data?.total || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
            sx={{
              borderTop: `1px solid ${isDark ? '#334155' : colors.border}`,
              bgcolor: isDark ? '#1A1917' : colors.background,
              color: isDark ? '#f1f5f9' : '#0f172a',
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                color: isDark ? '#f1f5f9' : '#0f172a',
              },
              '& .MuiIconButton-root': {
                color: isDark ? '#cbd5e1' : '#475569',
                '&:hover': {
                  bgcolor: isDark ? '#2A2725' : '#f1f5f9',
                },
              },
            }}
          />
        </div>
      )}
        </div>
      </div>
      
      {/* Modals */}
      <AddPatientModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      
      <EditPatientModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPatient(null);
        }}
        patient={selectedPatient}
      />
    </div>
  );
};

export default PatientsPage;

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Typography,
  Box,
  useTheme,
  useMediaQuery,
  InputAdornment
} from '@mui/material';
import { X, User, Mail, Calendar, Phone, Shield, Globe, Heart } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useThemeMode } from '@oncolife/ui-components';
import { useAddPatient, type Patient } from '../../../services/patients';

// Validation Schema
const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
  email: z.string().email('Please enter a valid email address'),
  mrn: z.string().min(1, 'Patient ID (MRN) is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  sex: z.string().min(1, 'Sex assigned at birth is required').refine(
    (val) => ['Male', 'Female', 'Other'].includes(val),
    { message: 'Please select a valid option' }
  ),
  race: z.string().min(1, 'Race is required'),
  phoneNumber: z.string()
    .min(1, 'Phone number is required')
    .regex(/^[\d\s\-\(\)]+$/, 'Please enter a valid phone number'),
  physician: z.string().min(1, 'Physician is required'),
  diseaseType: z.string().min(1, 'Disease type is required'),
  associateClinic: z.string().min(1, 'Associate clinic is required'),
  treatmentType: z.string().min(1, 'Treatment type is required'),
});

type PatientFormValues = z.infer<typeof patientSchema>;

interface AddPatientModalProps {
  open: boolean;
  onClose: () => void;
}

const AddPatientModal: React.FC<AddPatientModalProps> = ({ open, onClose }) => {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const addPatientMutation = useAddPatient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      mrn: '',
      dateOfBirth: '',
      sex: undefined,
      race: '',
      phoneNumber: '',
      physician: '',
      diseaseType: '',
      associateClinic: '',
      treatmentType: '',
    },
  });

  // Helper function to get TextField sx styles with error handling
  const getTextFieldStyles = (hasError: boolean) => ({
    '& .MuiInputBase-root': {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
      borderRadius: '8px',
      '&:hover': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC',
      },
      '&.Mui-focused': {
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
      },
    },
    '& .MuiInputBase-input': {
      color: isDark ? '#F5F3EE' : '#0F172A',
    },
    '& .MuiInputLabel-root': {
      color: hasError 
        ? (isDark ? '#FCA5A5' : '#DC2626')
        : (isDark ? '#B8B3A8' : '#64748B'),
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: hasError 
        ? (isDark ? '#EF4444' : '#DC2626')
        : (isDark ? '#3D3A35' : '#E2E8F0'),
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: hasError 
        ? (isDark ? '#F87171' : '#EF4444')
        : (isDark ? '#5C574F' : '#CBD5E1'),
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: hasError 
        ? (isDark ? '#F87171' : '#DC2626')
        : (isDark ? '#7BA3C9' : '#1E3A5F'),
    },
    '& .MuiFormHelperText-root': {
      color: hasError 
        ? (isDark ? '#FCA5A5' : '#DC2626')
        : (isDark ? '#B8B3A8' : '#64748B'),
      marginLeft: '0',
      marginTop: '4px',
    },
  });

  // Helper function to get Select sx styles with error handling
  const getSelectStyles = (hasError: boolean) => ({
    color: isDark ? '#F5F3EE' : '#0F172A',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#FFFFFF',
    '&:hover': {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F8FAFC',
    },
    '&.Mui-focused': {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#FFFFFF',
    },
    '& .MuiSvgIcon-root': {
      color: isDark ? '#B8B3A8' : '#64748B',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: hasError 
        ? (isDark ? '#EF4444' : '#DC2626')
        : (isDark ? '#3D3A35' : '#E2E8F0'),
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: hasError 
        ? (isDark ? '#F87171' : '#EF4444')
        : (isDark ? '#5C574F' : '#CBD5E1'),
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: hasError 
        ? (isDark ? '#F87171' : '#DC2626')
        : (isDark ? '#7BA3C9' : '#1E3A5F'),
    },
  });

  const onSubmit = async (data: PatientFormValues) => {
    try {
      await addPatientMutation.mutateAsync(data as Omit<Patient, 'id'>);
      reset();
      onClose();
    } catch (error) {
      console.error('Error adding patient:', error);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        className: `
          rounded-xl
          min-w-[320px] max-w-[900px] w-full
          m-4 sm:m-6 lg:m-0
          ${isDark ? 'bg-[#252320] text-[#F5F3EE]' : 'bg-white text-slate-900'}
          transition-colors duration-300
        `,
      }}
    >
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent 
          className={`
            p-4 sm:p-6 md:p-8
            [&::-webkit-scrollbar]:w-2
            ${isDark ? '[&::-webkit-scrollbar-track]:bg-[#1A1917] [&::-webkit-scrollbar-thumb]:bg-[#3D3A35] [&::-webkit-scrollbar-thumb:hover]:bg-[#5C574F]' : '[&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400'}
            [&::-webkit-scrollbar-thumb]:rounded
          `}
        >
          {/* Header */}
          <div className={`
            flex justify-between items-start mb-6 sm:mb-8
            pb-3 sm:pb-4
            border-b ${isDark ? 'border-[#3D3A35]' : 'border-slate-200'}
          `}>
            <div>
              <Typography 
                variant={isMobile ? "h6" : "h5"} 
                component="h2" 
                fontWeight={600} 
                className={`mb-1 ${isDark ? 'text-[#F5F3EE]' : 'text-slate-900'}`}
                sx={{ fontSize: isMobile ? '1.125rem' : undefined }}
              >
                Add Patient
              </Typography>
              <Typography 
                variant="body2" 
                className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'}
                sx={{ fontSize: isMobile ? '0.8125rem' : undefined }}
              >
                Please enter Patient's detail
              </Typography>
            </div>
            <IconButton 
              type="button"
              onClick={onClose} 
              size="small"
              className={`${isDark ? 'text-[#B8B3A8] hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <X size={isMobile ? 18 : 20} />
            </IconButton>
          </div>

          {/* Form Fields */}
          <Box 
            className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8"
          >
            {/* First Name */}
            <Controller
              name="firstName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="First Name"
                  placeholder="First Name"
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.firstName}
                  helperText={errors.firstName?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <User size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.firstName)}
                />
              )}
            />

            {/* Last Name */}
            <Controller
              name="lastName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Last Name"
                  placeholder="Last Name"
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.lastName}
                  helperText={errors.lastName?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <User size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.lastName)}
                />
              )}
            />

            {/* Email */}
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Email"
                  placeholder="Patient's Email"
                  type="email"
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Mail size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.email)}
                />
              )}
            />

            {/* Date of Birth */}
            <Controller
              name="dateOfBirth"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Date of birth"
                  placeholder="DOB"
                  type="date"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.dateOfBirth}
                  helperText={errors.dateOfBirth?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Calendar size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.dateOfBirth)}
                />
              )}
            />

            {/* Sex */}
            <Controller
              name="sex"
              control={control}
              render={({ field }) => (
                <FormControl 
                  fullWidth 
                  error={!!errors.sex}
                  className="mb-4 sm:mb-6"
                >
                  <InputLabel
                    sx={{
                      color: errors.sex 
                        ? (isDark ? '#FCA5A5' : '#DC2626')
                        : (isDark ? '#B8B3A8' : '#64748B'),
                    }}
                  >
                    Sex Assigned at birth
                  </InputLabel>
                  <Select
                    {...field}
                    label="Sex Assigned at birth"
                    size={isMobile ? 'small' : 'medium'}
                    sx={getSelectStyles(!!errors.sex)}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                      PaperProps: {
                        sx: {
                          backgroundColor: isDark ? '#252320' : '#FFFFFF',
                          borderRadius: '8px',
                          border: `1px solid ${isDark ? '#3D3A35' : '#E2E8F0'}`,
                          boxShadow: isDark 
                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          maxHeight: 300,
                          '& .MuiList-root': {
                            padding: '4px 0',
                            maxHeight: 300,
                            overflow: 'auto',
                            '&::-webkit-scrollbar': {
                              width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                              backgroundColor: isDark ? '#1A1917' : '#F1F5F9',
                              borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: isDark ? '#3D3A35' : '#CBD5E1',
                              borderRadius: '4px',
                              '&:hover': {
                                backgroundColor: isDark ? '#5C574F' : '#94A3B8',
                              },
                            },
                          },
                          '& .MuiMenuItem-root': {
                            color: isDark ? '#F5F3EE' : '#0F172A',
                            padding: '10px 16px',
                            fontSize: '0.875rem',
                            minHeight: 'auto',
                            '&:hover': {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                            },
                            '&.Mui-selected': {
                              backgroundColor: isDark ? 'rgba(123, 163, 201, 0.2)' : 'rgba(30, 58, 95, 0.1)',
                              '&:hover': {
                                backgroundColor: isDark ? 'rgba(123, 163, 201, 0.3)' : 'rgba(30, 58, 95, 0.15)',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                  {errors.sex && (
                    <Typography variant="caption" className={`${isDark ? 'text-red-400' : 'text-red-500'} mt-1 ml-4`}>
                      {errors.sex.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />

            {/* Race */}
            <Controller
              name="race"
              control={control}
              render={({ field }) => (
                <FormControl 
                  fullWidth 
                  error={!!errors.race}
                  className="mb-4 sm:mb-6"
                >
                  <InputLabel
                    sx={{
                      color: errors.race 
                        ? (isDark ? '#FCA5A5' : '#DC2626')
                        : (isDark ? '#B8B3A8' : '#64748B'),
                      fontSize: isMobile ? '0.8125rem' : '0.875rem',
                    }}
                  >
                    Race
                  </InputLabel>
                  <Select
                    {...field}
                    label="Race"
                    size={isMobile ? 'small' : 'medium'}
                    sx={getSelectStyles(!!errors.race)}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                      PaperProps: {
                        sx: {
                          backgroundColor: isDark ? '#252320' : '#FFFFFF',
                          borderRadius: '8px',
                          border: `1px solid ${isDark ? '#3D3A35' : '#E2E8F0'}`,
                          boxShadow: isDark 
                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          maxHeight: 300,
                          '& .MuiList-root': {
                            padding: '4px 0',
                            maxHeight: 300,
                            overflow: 'auto',
                            '&::-webkit-scrollbar': {
                              width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                              backgroundColor: isDark ? '#1A1917' : '#F1F5F9',
                              borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: isDark ? '#3D3A35' : '#CBD5E1',
                              borderRadius: '4px',
                              '&:hover': {
                                backgroundColor: isDark ? '#5C574F' : '#94A3B8',
                              },
                            },
                          },
                          '& .MuiMenuItem-root': {
                            color: isDark ? '#F5F3EE' : '#0F172A',
                            padding: '10px 16px',
                            fontSize: '0.875rem',
                            minHeight: 'auto',
                            '&:hover': {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                            },
                            '&.Mui-selected': {
                              backgroundColor: isDark ? 'rgba(123, 163, 201, 0.2)' : 'rgba(30, 58, 95, 0.1)',
                              '&:hover': {
                                backgroundColor: isDark ? 'rgba(123, 163, 201, 0.3)' : 'rgba(30, 58, 95, 0.15)',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="">Select</MenuItem>
                    <MenuItem value="White">White</MenuItem>
                    <MenuItem value="Black">Black</MenuItem>
                    <MenuItem value="Asian">Asian</MenuItem>
                    <MenuItem value="Hispanic">Hispanic</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </Select>
                  <Typography 
                    variant="caption" 
                    className={`text-xs ${isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} mt-1 ml-4`}
                  >
                    (Select the one that best applies)
                  </Typography>
                  {errors.race && (
                    <Typography variant="caption" className={`${isDark ? 'text-red-400' : 'text-red-500'} mt-1 ml-4 block`}>
                      {errors.race.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />

            {/* Patient ID (MRN) */}
            <Controller
              name="mrn"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Patient ID (MRN)"
                  placeholder="Patient ID"
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.mrn}
                  helperText={errors.mrn?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Shield size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.mrn)}
                />
              )}
            />

            {/* Phone Number */}
            <Controller
              name="phoneNumber"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Phone Number"
                  placeholder="XXXX-XXX-XX"
                  type="tel"
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.phoneNumber}
                  helperText={errors.phoneNumber?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Phone size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.phoneNumber)}
                />
              )}
            />

            {/* Physician */}
            <Controller
              name="physician"
              control={control}
              render={({ field }) => (
                <FormControl 
                  fullWidth 
                  error={!!errors.physician}
                  className="mb-4 sm:mb-6"
                >
                  <InputLabel
                    sx={{
                      color: errors.physician 
                        ? (isDark ? '#FCA5A5' : '#DC2626')
                        : (isDark ? '#B8B3A8' : '#64748B'),
                    }}
                  >
                    Physician
                  </InputLabel>
                  <Select
                    {...field}
                    label="Physician"
                    size={isMobile ? 'small' : 'medium'}
                    sx={getSelectStyles(!!errors.physician)}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                      PaperProps: {
                        sx: {
                          backgroundColor: isDark ? '#252320' : '#FFFFFF',
                          borderRadius: '8px',
                          border: `1px solid ${isDark ? '#3D3A35' : '#E2E8F0'}`,
                          boxShadow: isDark 
                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          maxHeight: 300,
                          '& .MuiList-root': {
                            padding: '4px 0',
                            maxHeight: 300,
                            overflow: 'auto',
                            '&::-webkit-scrollbar': {
                              width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                              backgroundColor: isDark ? '#1A1917' : '#F1F5F9',
                              borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: isDark ? '#3D3A35' : '#CBD5E1',
                              borderRadius: '4px',
                              '&:hover': {
                                backgroundColor: isDark ? '#5C574F' : '#94A3B8',
                              },
                            },
                          },
                          '& .MuiMenuItem-root': {
                            color: isDark ? '#F5F3EE' : '#0F172A',
                            padding: '10px 16px',
                            fontSize: '0.875rem',
                            minHeight: 'auto',
                            '&:hover': {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                            },
                            '&.Mui-selected': {
                              backgroundColor: isDark ? 'rgba(123, 163, 201, 0.2)' : 'rgba(30, 58, 95, 0.1)',
                              '&:hover': {
                                backgroundColor: isDark ? 'rgba(123, 163, 201, 0.3)' : 'rgba(30, 58, 95, 0.15)',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="">Select</MenuItem>
                    <MenuItem value="Dr. Smith">Dr. Smith</MenuItem>
                    <MenuItem value="Dr. Johnson">Dr. Johnson</MenuItem>
                    <MenuItem value="Dr. Williams">Dr. Williams</MenuItem>
                    <MenuItem value="Dr. Brown">Dr. Brown</MenuItem>
                    <MenuItem value="Dr. Davis">Dr. Davis</MenuItem>
                  </Select>
                  {errors.physician && (
                    <Typography variant="caption" className={`${isDark ? 'text-red-400' : 'text-red-500'} mt-1 ml-4`}>
                      {errors.physician.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />

            {/* Associate Clinic */}
            <Controller
              name="associateClinic"
              control={control}
              render={({ field }) => (
                <FormControl 
                  fullWidth 
                  error={!!errors.associateClinic}
                  className="mb-4 sm:mb-6"
                >
                  <InputLabel
                    sx={{
                      color: errors.associateClinic 
                        ? (isDark ? '#FCA5A5' : '#DC2626')
                        : (isDark ? '#B8B3A8' : '#64748B'),
                    }}
                  >
                    Associate Clinic
                  </InputLabel>
                  <Select
                    {...field}
                    label="Associate Clinic"
                    size={isMobile ? 'small' : 'medium'}
                    sx={getSelectStyles(!!errors.associateClinic)}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      },
                      PaperProps: {
                        sx: {
                          backgroundColor: isDark ? '#252320' : '#FFFFFF',
                          borderRadius: '8px',
                          border: `1px solid ${isDark ? '#3D3A35' : '#E2E8F0'}`,
                          boxShadow: isDark 
                            ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          maxHeight: 300,
                          '& .MuiList-root': {
                            padding: '4px 0',
                            maxHeight: 300,
                            overflow: 'auto',
                            '&::-webkit-scrollbar': {
                              width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                              backgroundColor: isDark ? '#1A1917' : '#F1F5F9',
                              borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              backgroundColor: isDark ? '#3D3A35' : '#CBD5E1',
                              borderRadius: '4px',
                              '&:hover': {
                                backgroundColor: isDark ? '#5C574F' : '#94A3B8',
                              },
                            },
                          },
                          '& .MuiMenuItem-root': {
                            color: isDark ? '#F5F3EE' : '#0F172A',
                            padding: '10px 16px',
                            fontSize: '0.875rem',
                            minHeight: 'auto',
                            '&:hover': {
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                            },
                            '&.Mui-selected': {
                              backgroundColor: isDark ? 'rgba(123, 163, 201, 0.2)' : 'rgba(30, 58, 95, 0.1)',
                              '&:hover': {
                                backgroundColor: isDark ? 'rgba(123, 163, 201, 0.3)' : 'rgba(30, 58, 95, 0.15)',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="">Select</MenuItem>
                    <MenuItem value="Oncology Center">Oncology Center</MenuItem>
                    <MenuItem value="Pulmonary Clinic">Pulmonary Clinic</MenuItem>
                    <MenuItem value="Gastroenterology">Gastroenterology</MenuItem>
                    <MenuItem value="Urology Center">Urology Center</MenuItem>
                    <MenuItem value="Gynecology">Gynecology</MenuItem>
                  </Select>
                  {errors.associateClinic && (
                    <Typography variant="caption" className={`${isDark ? 'text-red-400' : 'text-red-500'} mt-1 ml-4`}>
                      {errors.associateClinic.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />

            {/* Disease Type */}
            <Controller
              name="diseaseType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Patient Disease Type"
                  placeholder="Disease Type"
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.diseaseType}
                  helperText={errors.diseaseType?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Globe size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.diseaseType)}
                />
              )}
            />

            {/* Treatment Type */}
            <Controller
              name="treatmentType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Treatment Type"
                  placeholder="Treatment Type"
                  size={isMobile ? 'small' : 'medium'}
                  error={!!errors.treatmentType}
                  helperText={errors.treatmentType?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Heart size={isMobile ? 18 : 20} className={isDark ? 'text-[#B8B3A8]' : 'text-slate-500'} />
                      </InputAdornment>
                    ),
                  }}
                  sx={getTextFieldStyles(!!errors.treatmentType)}
                />
              )}
            />
          </Box>
        </DialogContent>

        <DialogActions 
          className={`
            p-4 sm:p-6 md:p-8
            gap-2
            flex-col sm:flex-row
            [&>*]:w-full sm:[&>*]:w-auto
          `}
        >
          <Button
            type="button"
            variant="outlined"
            onClick={handleCancel}
            fullWidth={isMobile}
            size={isMobile ? 'medium' : 'large'}
            className={isDark ? 'border-[#3D3A35] text-[#F5F3EE] hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}
            sx={{
              borderColor: isDark ? '#3D3A35' : '#1E3A5F',
              color: isDark ? '#F5F3EE' : '#1E3A5F',
              padding: isMobile ? '0.625rem 1.5rem' : '0.75rem 2rem',
              '&:hover': {
                borderColor: isDark ? '#5C574F' : '#2E5077',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(30, 58, 95, 0.04)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || addPatientMutation.isPending}
            fullWidth={isMobile}
            size={isMobile ? 'medium' : 'large'}
            className={isDark ? 'bg-[#7BA3C9] text-[#1A1917] hover:bg-[#A5C4DE] disabled:opacity-50' : 'bg-primary text-white hover:bg-primary-dark disabled:opacity-50'}
            sx={{
              backgroundColor: isDark ? '#7BA3C9' : '#1E3A5F',
              color: isDark ? '#1A1917' : '#FFFFFF',
              padding: isMobile ? '0.625rem 1.5rem' : '0.75rem 2rem',
              '&:hover': {
                backgroundColor: isDark ? '#A5C4DE' : '#2E5077',
              },
              '&:disabled': {
                backgroundColor: isDark ? 'rgba(123, 163, 201, 0.5)' : 'rgba(30, 58, 95, 0.5)',
                color: isDark ? 'rgba(26, 25, 23, 0.5)' : 'rgba(255, 255, 255, 0.5)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            {isSubmitting || addPatientMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default AddPatientModal;

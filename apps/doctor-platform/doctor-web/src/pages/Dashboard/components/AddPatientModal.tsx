/**
 * Add Patient Modal Component
 * Modal form for adding new patients with validation
 * Uses common UI components (Input, Select, Button)
 */

import React, { useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTheme, useMediaQuery } from '@mui/material';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import type { SingleValue, MultiValue } from 'react-select';
import { useThemeMode } from '@oncolife/ui-components';
import { DatePicker as MUIDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Stethoscope,
  Pill,
  AlertCircle,
} from 'lucide-react';
import { useStaffListDoctors } from '../../../services/staff';
import { useClinics, type ClinicItem } from '../../../services/clinics';
import dayjs from 'dayjs';

// Validation Schema
const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  mrn: z.string().min(1, 'MRN is required').regex(/^\d+$/, 'MRN must contain only numbers'),
  dateOfBirth: z.string().refine((val) => !val || dayjs(val).isBefore(dayjs().add(1, 'day')), 'Date of birth cannot be in the future').optional(),
  gender: z.string().optional(),
  location: z.string().optional(),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  patientStatus: z.enum(['active', 'inactive', 'pending']),
  regimenName: z.string().optional(),
  regimenCode: z.string().optional(),
  regimenStage: z.string().optional(),
  dayOfChemo: z.string().optional(),
  treatmentStartDate: z.string().optional(),
  nextChemoDate: z.string().optional(),
  endDate: z.string().optional(),
  oncologist: z.string().optional(),
  pastMedicalHistory: z.string().optional(),
  pastSurgicalHistory: z.string().optional(),
  physicianIds: z.array(z.number()).optional(),
});

export type PatientFormValues = z.infer<typeof patientSchema>;

function getDefaultFormValues(): PatientFormValues {
  const today = dayjs().format('YYYY-MM-DD');
  const fourMonthsLater = dayjs().add(4, 'month').format('YYYY-MM-DD');
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mrn: '',
    dateOfBirth: '',
    gender: '',
    location: DEFAULT_LOCATION,
    diagnosis: '',
    patientStatus: 'active',
    regimenName: '',
    regimenCode: '',
    regimenStage: '',
    dayOfChemo: '',
    treatmentStartDate: today,
    nextChemoDate: '',
    endDate: fourMonthsLater,
    oncologist: '',
    pastMedicalHistory: '',
    pastSurgicalHistory: '',
    physicianIds: [],
  };
}

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: PatientFormValues) => void | Promise<void>;
  /** Called after a successful add (before modal closes). Use to show success notification. */
  onSuccess?: () => void;
}

// Select Options
const patientStatusOptions: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
];

const dayOfChemoOptions: SelectOption[] = [
  { value: '', label: 'Select day' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const genderOptions: SelectOption[] = [
  { value: '', label: 'Select gender' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];
const DEFAULT_LOCATION = '';

/** Extract user-facing message from API error (e.g. { error, error_code, message, details }) or axios shape */
function getApiErrorMessage(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string; error_code?: string; details?: unknown } }; message?: string };
  const msg = ax?.response?.data?.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  if (typeof ax?.message === 'string' && ax.message.trim()) return ax.message.trim();
  return 'Something went wrong. Please try again.';
}

export const AddPatientModal: React.FC<AddPatientModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
}) => {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { data: doctors = [], isLoading: isLoadingDoctors } = useStaffListDoctors(isOpen);
  const { data: clinicsData, isLoading: isLoadingClinics } = useClinics(isOpen);
  const clinics: ClinicItem[] = (clinicsData as ClinicItem[] | undefined) ?? [];
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const locationOptions = React.useMemo<SelectOption[]>(
    () =>
      clinics
        .map((clinic) => ({
          value: clinic.name,
          label: clinic.name,
        }))
        .filter((option) => option.value && option.label),
    [clinics]
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: getDefaultFormValues(),
  });

  // Clear error when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      reset(getDefaultFormValues());
    }
  }, [isOpen, reset]);

  // Pre-fill doctor/oncologist ONLY if the logged in user is a physician
  useEffect(() => {
    if (isOpen && user && user.role === 'physician') {
      const matchingDoctor = doctors.find((d: any) => d.id === user.staff_id);

      const docId = matchingDoctor ? matchingDoctor.id : user.staff_id;
      const docName = matchingDoctor
        ? (matchingDoctor.full_name || `${matchingDoctor.first_name || ''} ${matchingDoctor.last_name || ''}`.trim() || matchingDoctor.email || `Doctor #${matchingDoctor.id}`)
        : (`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || `Doctor #${user.staff_id}`);

      if (docId) {
        setValue('physicianIds', [docId]);
        setValue('oncologist', `Dr. ${docName}`.replace('Dr. Dr.', 'Dr.'));
      }
    }
  }, [isOpen, user, doctors.length, setValue]);

  const handleFormSubmit = async (data: PatientFormValues) => {
    setErrorMessage(null);
    try {
      if (onSubmit) {
        await onSubmit(data);
      }
      onSuccess?.();
      reset();
      onClose();
    } catch (err) {
      console.error('Error adding patient:', err);
      setErrorMessage(getApiErrorMessage(err));
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Add New Patient"
      titleDescription="Enter patient information to create a new profile."
      size="xl"
    >
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
      <div className={`${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        <style>{`
          .compact-form [class*="mb-5"] {
            margin-bottom: 0.75rem !important;
          }
          @media (min-width: 640px) {
            .compact-form [class*="mb-5"] {
              margin-bottom: 1rem !important;
            }
          }
        `}</style>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="compact-form space-y-4 sm:space-y-5">
          {/* Personal Information Section */}
          <div className="space-y-3">
            <div className={`pb-2 sm:pb-2.5 mb-3 sm:mb-3.5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <h3 className={`text-sm sm:text-base font-semibold font-serif ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Personal Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="First Name *"
                    placeholder="Enter first name"
                    icon={<User size={18} />}
                    error={errors.firstName?.message}
                    fullWidth
                  />
                )}
              />

              {/* Last Name */}
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Last Name *"
                    placeholder="Enter last name"
                    icon={<User size={18} />}
                    error={errors.lastName?.message}
                    fullWidth
                  />
                )}
              />

              {/* Email */}
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Email *"
                    type="email"
                    placeholder="patient@email.com"
                    icon={<Mail size={18} />}
                    error={errors.email?.message}
                    fullWidth
                  />
                )}
              />

              {/* Phone */}
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    icon={<Phone size={18} />}
                    error={errors.phone?.message}
                    fullWidth
                  />
                )}
              />

              {/* MRN */}
              <Controller
                name="mrn"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="MRN *"
                    placeholder="e.g., 123456"
                    icon={<User size={18} />}
                    error={errors.mrn?.message}
                    fullWidth
                    onChange={(e) => {
                      const onlyNums = e.target.value.replace(/\D/g, '');
                      field.onChange(onlyNums);
                    }}
                  />
                )}
              />

              {/* Date of Birth */}
              <Controller
                name="dateOfBirth"
                control={control}
                render={({ field }) => (
                  <div className="w-full mb-5">
                    <label
                      className={`block text-[13px] font-semibold mb-1 uppercase tracking-wide transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-900'
                      }`}
                    >
                      Date of Birth
                    </label>
                    <MUIDatePicker
                      value={field.value ? dayjs(field.value, 'YYYY-MM-DD', true) : null}
                      onChange={(newValue) => field.onChange(newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : '')}
                      format="MM/DD/YYYY"
                      views={['day', 'month', 'year']}
                      disableFuture
                      slotProps={{
                        popper: {
                          sx: { zIndex: 100000 },
                        },
                        textField: {
                          fullWidth: true,
                          placeholder: 'Date of Birth',
                          error: !!errors.dateOfBirth?.message,
                          helperText: errors.dateOfBirth?.message,
                          sx: {
                            '& .MuiInputBase-root': {
                              backgroundColor: isDark ? '#2A2725' : '#F8FAFC',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: errors.dateOfBirth?.message
                                ? '#EF4444'
                                : (isDark ? '#3A3835' : '#E2E8F0'),
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '15px',
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              />

              {/* Gender */}
              <Controller
                name="gender"
                control={control}
                render={({ field }) => {
                  const selectedOption = genderOptions.find(opt => opt.value === field.value);
                  return (
                    <Select
                      label="Gender"
                      options={genderOptions}
                      value={selectedOption || null}
                      onChange={(newValue: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                        const option = Array.isArray(newValue) ? newValue[0] : newValue;
                        field.onChange(option?.value as string || '');
                      }}
                      placeholder="Select gender"
                      error={errors.gender?.message}
                      fullWidth
                    />
                  );
                }}
              />

               {/* Location */}
              <Controller
                name="location"
                control={control}
                render={({ field }) => {
                  const selectedOption =
                    locationOptions.find(opt => opt.value === field.value) ||
                    (field.value ? { value: field.value, label: field.value } : null);
                  const locationSelectOptions = selectedOption
                    ? [...locationOptions, ...(locationOptions.some(opt => opt.value === selectedOption.value) ? [] : [selectedOption])]
                    : locationOptions;
                  return (
                    <Select
                      label="Location"
                      options={locationSelectOptions}
                      value={selectedOption || null}
                      isDisabled={isLoadingClinics}
                      onChange={(newValue: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                        const option = Array.isArray(newValue) ? newValue[0] : newValue;
                        field.onChange(option?.value as string || '');
                      }}
                      placeholder={isLoadingClinics ? 'Loading clinics...' : 'Select location'}
                      error={errors.location?.message}
                      fullWidth
                    />
                  );
                }}
              />
            </div>
          </div>

          {/* Medical Information Section */}
          <div className={`space-y-4 sm:space-y-5 pt-4 sm:pt-5 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className={`pb-2 sm:pb-2.5 mb-3 sm:mb-3.5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <h3 className={`text-sm sm:text-base font-semibold font-serif ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Medical Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Diagnosis */}
              <div className="md:col-span-2">
                <Controller
                  name="diagnosis"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Diagnosis *"
                      placeholder="e.g., Non-Small Cell Lung Cancer"
                      icon={<Stethoscope size={18} />}
                      error={errors.diagnosis?.message}
                      fullWidth
                    />
                  )}
                />
              </div>

              {/* Patient Status */}
              <Controller
                name="patientStatus"
                control={control}
                render={({ field }) => {
                  const selectedOption = patientStatusOptions.find(opt => opt.value === field.value);
                  return (
                    <Select
                      label="Patient Status"
                      options={patientStatusOptions}
                      value={selectedOption || null}
                      onChange={(newValue: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                        const option = Array.isArray(newValue) ? newValue[0] : newValue;
                        field.onChange(option?.value as string || '');
                      }}
                      placeholder="Select status"
                      error={errors.patientStatus?.message}
                      fullWidth
                    />
                  );
                }}
              />

              {/* Assigned Doctor */}
              <Controller
                name="physicianIds"
                control={control}
                render={({ field }) => {
                  let doctorOptions = doctors.map(doc => ({
                    value: doc.id,
                    label: doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || doc.email || `Doctor #${doc.id}`
                  }));

                  // If user is a physician, ONLY show them in the list (filter out other doctors)
                  if (user?.role === 'physician') {
                    const myOption = doctorOptions.find(opt => opt.value === user.staff_id);
                    if (myOption) {
                      doctorOptions = [myOption];
                    } else if (user.staff_id) {
                      doctorOptions = [{
                        value: user.staff_id,
                        label: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || `Doctor #${user.staff_id}`
                      }];
                    } else {
                      doctorOptions = [];
                    }
                  } else if (user && (user.role === 'doctor' || user.role === 'admin')) {
                    // For other roles, keep existing behavior of adding themselves to the list if missing
                    if (!doctorOptions.find(opt => opt.value === user.staff_id) && user.staff_id) {
                      doctorOptions.push({
                        value: user.staff_id,
                        label: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || `Doctor #${user.staff_id}`
                      });
                    }
                  }

                  const selectedOption = doctorOptions.find(opt => (field.value ?? []).includes(opt.value as number)) || null;
                  return (
                    <Select
                      label="Assigned Oncologist"
                      options={doctorOptions}
                      value={selectedOption}
                      isDisabled={isLoadingDoctors}
                      onChange={(selected) => {
                        const selectedDoc = selected as SingleValue<SelectOption>;
                        const values = selectedDoc ? [selectedDoc.value as number] : [];
                        field.onChange(values);

                        // Update oncologist text field with selected doctor name
                        let doctorName = '';
                        if (selectedDoc) {
                          const name = String(selectedDoc.label);
                          doctorName = name.startsWith('Dr.') ? name : `Dr. ${name}`;
                        }
                        setValue('oncologist', doctorName, { shouldValidate: true });
                      }}
                      placeholder={isLoadingDoctors ? "Loading doctors..." : "Select a doctor"}
                      fullWidth
                    />
                  );
                }}
              />

              {/* Regimen Name */}
              <Controller
                name="regimenName"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Regimen Name"
                    placeholder="e.g., Carboplatin + Pemetrexed"
                    icon={<Pill size={18} />}
                    error={errors.regimenName?.message}
                    fullWidth
                  />
                )}
              />

              {/* Regimen Code */}
              <Controller
                name="regimenCode"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Regimen Code"
                    placeholder="e.g., PEMBRO-CARBO-PEM"
                    icon={<Pill size={18} />}
                    error={errors.regimenCode?.message}
                    fullWidth
                  />
                )}
              />

              {/* Regimen Stage */}
              <Controller
                name="regimenStage"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Regimen Stage"
                    placeholder="e.g., Stage IV"
                    icon={<Stethoscope size={18} />}
                    error={errors.regimenStage?.message}
                    fullWidth
                  />
                )}
              />

              {/* Day of Chemotherapy Treatment */}
              <Controller
                name="dayOfChemo"
                control={control}
                render={({ field }) => {
                  const selectedOption = dayOfChemoOptions.find(opt => opt.value === field.value);
                  return (
                    <Select
                      label="Day of Chemotherapy Treatment"
                      options={dayOfChemoOptions}
                      value={selectedOption || null}
                      onChange={(newValue: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                        const option = Array.isArray(newValue) ? newValue[0] : newValue;
                        field.onChange(option?.value as string || '');
                      }}
                      placeholder="Select day"
                      error={errors.dayOfChemo?.message}
                      fullWidth
                    />
                  );
                }}
              />

              {/* Treatment Start Date */}
              <Controller
                name="treatmentStartDate"
                control={control}
                render={({ field }) => (
                  <div className="w-full mb-5">
                    <label
                      className={`block text-[13px] font-semibold mb-1.5 uppercase tracking-wide transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-900'
                      }`}
                    >
                      Treatment Start Date
                    </label>
                    <MUIDatePicker
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(newValue) => {
                        const formatted = newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : '';
                        field.onChange(formatted);
                        if (formatted) {
                          const newEndDate = dayjs(formatted).add(4, 'month').format('YYYY-MM-DD');
                          setValue('endDate', newEndDate, { shouldValidate: true, shouldDirty: true });
                        }
                      }}
                      format="MM/DD/YYYY"
                      slotProps={{
                        popper: { sx: { zIndex: 100000 } },
                        textField: {
                          fullWidth: true,
                          placeholder: 'Treatment Start Date',
                          error: !!errors.treatmentStartDate?.message,
                          helperText: errors.treatmentStartDate?.message,
                          InputProps: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Calendar size={18} />
                              </InputAdornment>
                            ),
                          },
                          sx: {
                            '& .MuiInputBase-root': {
                              minHeight: '52px',
                              backgroundColor: isDark ? '#2A2725' : '#F8FAFC',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: errors.treatmentStartDate?.message
                                ? '#EF4444'
                                : (isDark ? '#3A3835' : '#E2E8F0'),
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '15px',
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              />

              {/* Next Chemotherapy Treatment */}
              <Controller
                name="nextChemoDate"
                control={control}
                render={({ field }) => (
                  <div className="w-full mb-5">
                    <label
                      className={`block text-[13px] font-semibold mb-1.5 uppercase tracking-wide transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-900'
                      }`}
                    >
                      Next Chemotherapy Treatment
                    </label>
                    <MUIDatePicker
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(newValue) => field.onChange(newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : '')}
                      format="MM/DD/YYYY"
                      slotProps={{
                        popper: { sx: { zIndex: 100000 } },
                        textField: {
                          fullWidth: true,
                          placeholder: 'Next Chemotherapy Treatment',
                          error: !!errors.nextChemoDate?.message,
                          helperText: errors.nextChemoDate?.message,
                          InputProps: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Calendar size={18} />
                              </InputAdornment>
                            ),
                          },
                          sx: {
                            '& .MuiInputBase-root': {
                              minHeight: '52px',
                              backgroundColor: isDark ? '#2A2725' : '#F8FAFC',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: errors.nextChemoDate?.message
                                ? '#EF4444'
                                : (isDark ? '#3A3835' : '#E2E8F0'),
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '15px',
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              />

              {/* Treatment End Date */}
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <div className="w-full mb-5">
                    <label
                      className={`block text-[13px] font-semibold mb-1.5 uppercase tracking-wide transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-900'
                      }`}
                    >
                      Treatment End Date
                    </label>
                    <MUIDatePicker
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(newValue) => field.onChange(newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : '')}
                      format="MM/DD/YYYY"
                      slotProps={{
                        popper: { sx: { zIndex: 100000 } },
                        textField: {
                          fullWidth: true,
                          placeholder: 'Treatment End Date',
                          error: !!errors.endDate?.message,
                          helperText: errors.endDate?.message,
                          InputProps: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <Calendar size={18} />
                              </InputAdornment>
                            ),
                          },
                          sx: {
                            '& .MuiInputBase-root': {
                              minHeight: '52px',
                              backgroundColor: isDark ? '#2A2725' : '#F8FAFC',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: errors.endDate?.message
                                ? '#EF4444'
                                : (isDark ? '#3A3835' : '#E2E8F0'),
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '15px',
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              />

              {/* Oncologist */}
              {/* <Controller
                name="oncologist"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Oncologist"
                    placeholder="e.g., Dr. Sarah Smith"
                    icon={<Stethoscope size={18} />}
                    fullWidth
                  />
                )}
              /> */}

              {/* Past Medical History */}
              <div className="md:col-span-2">
                <Controller
                  name="pastMedicalHistory"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Past Medical History"
                      placeholder="e.g., Hypertension, Type 2 Diabetes"
                      fullWidth
                    />
                  )}
                />
              </div>

              {/* Past Surgical History */}
              <div className="md:col-span-2">
                <Controller
                  name="pastSurgicalHistory"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Past Surgical History"
                      placeholder="e.g., Appendectomy (2010)"
                      fullWidth
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* API error message shown above the buttons; icon and text aligned */}
          {errorMessage && (
            <div
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                isDark
                  ? 'border-red-800/40 bg-red-900/20 text-red-400'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
              role="alert"
            >
              <AlertCircle size={20} className="shrink-0 self-center" aria-hidden />
              <span className="font-medium leading-snug">{errorMessage}</span>
            </div>
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="outlined"
              onClick={handleCancel}
              fullWidth={isMobile}
              size="medium"
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
              disabled={isSubmitting}
              fullWidth={isMobile}
              size="medium"
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
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </ModalFooter>
        </form>
      </div>
      </LocalizationProvider>
    </Modal>
  );
};

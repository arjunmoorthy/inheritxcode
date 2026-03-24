/**
 * Shared Patient Form Modal - Add & Edit
 * Same form, only condition (mode) changes: add = POST, edit = PUT
 */

import React, { useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTheme, useMediaQuery } from '@mui/material';
import Button from '@mui/material/Button';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select, type SelectOption } from '../../../components/ui/Select';
import type { SingleValue, MultiValue } from 'react-select';
import { useThemeMode } from '@oncolife/ui-components';
import {
  useAddManualPatient,
  useUpdatePatientProfile,
  type AddManualPatientPayload,
  type PatientProfileUpdatePayload,
  type Patient,
} from '../../../services/patients';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Stethoscope,
  Pill,
} from 'lucide-react';
import { useStaffListDoctors } from '../../../services/staff';

const patientSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  mrn: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  location: z.string().optional(),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  patientStatus: z.enum(['active', 'inactive', 'pending']),
  regimenName: z.string().optional(),
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

const defaultFormValues: PatientFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  mrn: '',
  dateOfBirth: '',
  gender: '',
  location: 'Honor Health Cancer Care - Deer Valley',
  diagnosis: '',
  patientStatus: 'active',
  regimenName: '',
  dayOfChemo: '',
  treatmentStartDate: '',
  nextChemoDate: '',
  endDate: '',
  oncologist: '',
  pastMedicalHistory: '',
  pastSurgicalHistory: '',
  physicianIds: [],
};

function patientToFormValues(patient: Patient): PatientFormValues {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    phone: patient.phoneNumber,
    mrn: patient.mrn,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.sex,
    location: 'Honor Health Cancer Care - Deer Valley',
    diagnosis: patient.diseaseType,
    patientStatus: 'active',
    regimenName: patient.treatmentType,
    dayOfChemo: '',
    treatmentStartDate: '',
    nextChemoDate: '',
    endDate: '',
    oncologist: patient.physician,
    pastMedicalHistory: '',
    pastSurgicalHistory: '',
    physicianIds: patient.physician_ids || [],
  };
}

function computeAge(dateOfBirth: string | undefined): number | undefined {
  if (!dateOfBirth) return undefined;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : undefined;
}

function toPatientProfileUpdatePayload(form: PatientFormValues): PatientProfileUpdatePayload {
  return {
    mrn: form.mrn || undefined,
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    phone_number: form.phone || undefined,
    date_of_birth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    location: form.location || undefined,
    regimen_name: form.regimenName || undefined,
    chemotherapy_day: form.dayOfChemo || undefined,
    next_chemotherapy_at: form.nextChemoDate ? `${form.nextChemoDate}T12:00:00.000Z` : undefined,
  };
}

function toAddManualPatientPayload(form: PatientFormValues, patientUuid?: string): AddManualPatientPayload {
  return {
    patient_uuid: patientUuid,
    first_name: form.firstName,
    last_name: form.lastName,
    mrn: form.mrn?.trim() || `MRN${Date.now()}`,
    date_of_birth: form.dateOfBirth || undefined,
    age: computeAge(form.dateOfBirth),
    gender: form.gender || undefined,
    email: form.email,
    phone_number: form.phone || undefined,
    cancer_type: form.diagnosis,
    oncologist: form.oncologist || undefined,
    start_date: form.treatmentStartDate || undefined,
    end_date: form.endDate || undefined,
    plan_name: form.regimenName || undefined,
    past_medical_history: form.pastMedicalHistory || undefined,
    past_surgical_history: form.pastSurgicalHistory || undefined,
    physician_ids: form.physicianIds && form.physicianIds.length > 0 ? form.physicianIds : undefined,
  };
}

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
const locationOptions: SelectOption[] = [
  { value: 'Honor Health Cancer Care - Deer Valley', label: 'Honor Health Cancer Care - Deer Valley' },
];

export type PatientFormModalMode = 'add' | 'edit';

interface PatientFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: PatientFormModalMode;
  patient?: Patient | null;
}

export const PatientFormModal: React.FC<PatientFormModalProps> = ({
  open,
  onClose,
  mode,
  patient = null,
}) => {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const addMutation = useAddManualPatient();
  const updateMutation = useUpdatePatientProfile();
  const { data: doctors = [] } = useStaffListDoctors(open);
  const { user } = useAuth();

  const isEdit = mode === 'edit';

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: defaultFormValues,
  });

  useEffect(() => {
    if (open) {
      if (isEdit && patient) {
        reset(patientToFormValues(patient));
      } else {
        reset(defaultFormValues);
      }
    }
  }, [open, isEdit, patient, reset]);

  // Pre-fill doctor/oncologist ONLY if the logged in user is a physician
  useEffect(() => {
    if (open && user && user.role === 'physician') {
      const isPhysician = user.role === 'physician'; // Always true here now
      
      // For physicians, we always want to ensure it's set to them if it's a new patient or if they are editing
      if (!isEdit || isPhysician) {
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
    }
  }, [open, isEdit, user, doctors.length, setValue]);

  const handleFormSubmit = async (data: PatientFormValues) => {
    try {
      if (isEdit && patient) {
        const payload = toPatientProfileUpdatePayload(data);
        await updateMutation.mutateAsync({ patientUuid: patient.uuid, payload });
      } else {
        const payload = toAddManualPatientPayload(data);
        await addMutation.mutateAsync(payload);
      }
      reset();
      onClose();
    } catch (error) {
      console.error(isEdit ? 'Error updating patient:' : 'Error adding patient:', error);
    }
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const isPending = addMutation.isPending || updateMutation.isPending;
  const title = isEdit ? 'Edit Patient' : 'Add New Patient';
  const description = isEdit
    ? 'Update patient information.'
    : 'Enter patient information to create a new profile.';
  const submitLabel = isEdit ? 'Update' : 'Save';
  const submitDisabled = isSubmitting || isPending;

  return (
    <Modal
      isOpen={open}
      onClose={handleCancel}
      title={title}
      titleDescription={description}
      size="xl"
    >
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
          <div className="space-y-3">
            <div className={`pb-2 sm:pb-2.5 mb-3 sm:mb-3.5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <h3 className={`text-sm sm:text-base font-semibold font-serif ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Personal Information
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Controller name="firstName" control={control} render={({ field }) => (
                <Input {...field} label="First Name *" placeholder="Enter first name" icon={<User size={18} />} error={errors.firstName?.message} fullWidth />
              )} />
              <Controller name="lastName" control={control} render={({ field }) => (
                <Input {...field} label="Last Name *" placeholder="Enter last name" icon={<User size={18} />} error={errors.lastName?.message} fullWidth />
              )} />
              <Controller name="email" control={control} render={({ field }) => (
                <Input {...field} label="Email *" type="email" placeholder="patient@email.com" icon={<Mail size={18} />} error={errors.email?.message} fullWidth />
              )} />
              <Controller name="phone" control={control} render={({ field }) => (
                <Input {...field} label="Phone" type="tel" placeholder="(555) 123-4567" icon={<Phone size={18} />} fullWidth />
              )} />
              <Controller name="mrn" control={control} render={({ field }) => (
                <Input {...field} label="MRN" placeholder="e.g., MRN123456" icon={<User size={18} />} fullWidth />
              )} />
              <Controller name="dateOfBirth" control={control} render={({ field }) => (
                <Input {...field} label="Date of Birth" type="date" icon={<Calendar size={18} />} fullWidth />
              )} />
              <Controller name="gender" control={control} render={({ field }) => {
                const selectedOption = genderOptions.find(opt => opt.value === field.value);
                return (
                  <Select
                    label="Gender"
                    options={genderOptions}
                    value={selectedOption || null}
                    onChange={(v: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                      const opt = Array.isArray(v) ? v[0] : v;
                      field.onChange(opt?.value as string || '');
                    }}
                    placeholder="Select gender"
                    fullWidth
                  />
                );
              }} />
              <Controller name="location" control={control} render={({ field }) => {
                const selectedOption = locationOptions.find(opt => opt.value === field.value);
                return (
                  <Select
                    label="Location"
                    options={locationOptions}
                    value={selectedOption || null}
                    onChange={(v: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                      const opt = Array.isArray(v) ? v[0] : v;
                      field.onChange(opt?.value as string || '');
                    }}
                    placeholder="Select location"
                    fullWidth
                  />
                );
              }} />
            </div>
          </div>

          <div className={`space-y-4 sm:space-y-5 pt-4 sm:pt-5 border-t ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className={`pb-2 sm:pb-2.5 mb-3 sm:mb-3.5 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-200'}`}>
              <h3 className={`text-sm sm:text-base font-semibold font-serif ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Medical Information
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Controller name="diagnosis" control={control} render={({ field }) => (
                  <Input {...field} label="Diagnosis *" placeholder="e.g., Non-Small Cell Lung Cancer" icon={<Stethoscope size={18} />} error={errors.diagnosis?.message} fullWidth />
                )} />
              </div>
              <Controller name="patientStatus" control={control} render={({ field }) => {
                const selectedOption = patientStatusOptions.find(opt => opt.value === field.value);
                return (
                  <Select label="Patient Status" options={patientStatusOptions} value={selectedOption || null}
                    onChange={(v: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                      const opt = Array.isArray(v) ? v[0] : v;
                      field.onChange(opt?.value as string || '');
                    }}
                    placeholder="Select status" error={errors.patientStatus?.message} fullWidth />
                );
              }} />
              <Controller name="physicianIds" control={control} render={({ field }) => {
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
                    onChange={(v: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                      const selectedDoc = v as SingleValue<SelectOption>;
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
                    placeholder="Select a doctor"
                    fullWidth
                  />
                );
              }} />
              <Controller name="regimenName" control={control} render={({ field }) => (
                <Input {...field} label="Regimen Name" placeholder="e.g., Carboplatin + Pemetrexed" icon={<Pill size={18} />} fullWidth />
              )} />
              <Controller name="dayOfChemo" control={control} render={({ field }) => {
                const selectedOption = dayOfChemoOptions.find(opt => opt.value === field.value);
                return (
                  <Select label="Day of Chemotherapy Treatment" options={dayOfChemoOptions} value={selectedOption || null}
                    onChange={(v: SingleValue<SelectOption> | MultiValue<SelectOption>) => {
                      const opt = Array.isArray(v) ? v[0] : v;
                      field.onChange(opt?.value as string || '');
                    }}
                    placeholder="Select day" fullWidth />
                );
              }} />
              <Controller name="treatmentStartDate" control={control} render={({ field }) => (
                <Input {...field} label="Treatment Start Date" type="date" icon={<Calendar size={18} />} fullWidth />
              )} />
              <Controller name="nextChemoDate" control={control} render={({ field }) => (
                <Input {...field} label="Next Chemotherapy Treatment" type="date" icon={<Calendar size={18} />} fullWidth />
              )} />
              <Controller name="endDate" control={control} render={({ field }) => (
                <Input {...field} label="Treatment End Date" type="date" icon={<Calendar size={18} />} fullWidth />
              )} />
              {/* <Controller name="oncologist" control={control} render={({ field }) => (
                <Input {...field} label="Oncologist" placeholder="e.g., Dr. Sarah Smith" icon={<Stethoscope size={18} />} fullWidth />
              )} /> */}
              <div className="md:col-span-2">
                <Controller name="pastMedicalHistory" control={control} render={({ field }) => (
                  <Input {...field} label="Past Medical History" placeholder="e.g., Hypertension, Type 2 Diabetes" fullWidth />
                )} />
              </div>
              <div className="md:col-span-2">
                <Controller name="pastSurgicalHistory" control={control} render={({ field }) => (
                  <Input {...field} label="Past Surgical History" placeholder="e.g., Appendectomy (2010)" fullWidth />
                )} />
              </div>
            </div>
          </div>

          <ModalFooter>
            <Button type="button" variant="outlined" onClick={handleCancel} fullWidth={isMobile} size="medium"
              className={isDark ? 'border-[#3D3A35] text-[#F5F3EE] hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}
              sx={{
                borderColor: isDark ? '#3D3A35' : '#1E3A5F', color: isDark ? '#F5F3EE' : '#1E3A5F', padding: isMobile ? '0.625rem 1.5rem' : '0.75rem 2rem',
                '&:hover': { borderColor: isDark ? '#5C574F' : '#2E5077', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(30, 58, 95, 0.04)' }, transition: 'all 0.3s ease'
              }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitDisabled} fullWidth={isMobile} size="medium"
              className={isDark ? 'bg-[#7BA3C9] text-[#1A1917] hover:bg-[#A5C4DE] disabled:opacity-50' : 'bg-primary text-white hover:bg-primary-dark disabled:opacity-50'}
              sx={{
                backgroundColor: isDark ? '#7BA3C9' : '#1E3A5F', color: isDark ? '#1A1917' : '#FFFFFF', padding: isMobile ? '0.625rem 1.5rem' : '0.75rem 2rem',
                '&:hover': { backgroundColor: isDark ? '#A5C4DE' : '#2E5077' },
                '&:disabled': { backgroundColor: isDark ? 'rgba(123, 163, 201, 0.5)' : 'rgba(30, 58, 95, 0.5)', color: isDark ? 'rgba(26, 25, 23, 0.5)' : 'rgba(255, 255, 255, 0.5)' }, transition: 'all 0.3s ease'
              }}>
              {submitDisabled ? (isEdit ? 'Updating...' : 'Saving...') : submitLabel}
            </Button>
          </ModalFooter>
        </form>
      </div>
    </Modal>
  );
};

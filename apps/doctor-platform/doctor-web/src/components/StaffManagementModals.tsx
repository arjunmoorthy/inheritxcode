import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Phone, Building, MapPin, Printer, User, Edit, UserCog, CheckCircle, X, Trash2 } from 'lucide-react';
import { Button, Input, Select, Modal, ModalFooter } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useUser } from '../contexts/UserContext';
import { useThemeMode } from '@oncolife/ui-components';
import { Snackbar, Alert } from '@mui/material';
import { useAddStaffV1, useStaffListDoctors, useUpdateStaffById, useAllStaff, useCurrentStaffProfile, useDeleteStaffById } from '../services/staff';
import { useClinics, useCreateClinic, useUpdateClinic, type ClinicItem } from '../services/clinics';
import { useStaffManagement } from '../contexts/StaffManagementContext';

// Staff member type (from all-staff API + for update API)
interface StaffMember {
    id: string;
    staffId?: number;
    name: string;
    role: string;
    department: string;
    email: string;
    phone: string;
    clinic: string;
    clinicId?: number;
    address: string;
    fax: string;
}

// Staff form schema
const staffSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().min(1, 'Phone number is required'),
    doctorIds: z.array(z.number()).optional(),
    clinicName: z.string().optional(),
    clinicDepartment: z.string().optional(),
    clinicAddress: z.string().optional(),
    clinicFax: z.string().optional(),
    selectedClinicUuid: z.string().min(1, 'Please select a clinic'),
});

type StaffFormValues = z.infer<typeof staffSchema>;

const clinicSchema = z.object({
    name: z.string().min(1, 'Clinic name is required'),
    address: z.string().min(1, 'Clinic address is required'),
    fax: z.string().min(1, 'Fax number is required'),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

const StaffManagementModals: React.FC = () => {
    const { profile } = useUser();
    const { isDark } = useThemeMode();
    const { showAddStaffModal, showUpdateStaffModal, showClinicRegistrationModal, clinicRegistrationMode, closeModals } = useStaffManagement();
    const { data: currentStaffProfile } = useCurrentStaffProfile(true);

    // States
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [addStaffSuccess, setAddStaffSuccess] = useState<{ message: string; email?: string; role?: string } | null>(null);
    const [updateStaffSuccess, setUpdateStaffSuccess] = useState(false);
    const [editingClinic, setEditingClinic] = useState<ClinicItem | null>(null);
    const [showClinicFormModal, setShowClinicFormModal] = useState(false);
    const [alertInfo, setAlertInfo] = useState<{ message: string; severity: 'error' | 'success' } | null>(null);
    const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Mutations/Services
    const addStaffMutation = useAddStaffV1();
    const updateStaffByIdMutation = useUpdateStaffById();
    const deleteStaffByIdMutation = useDeleteStaffById();
    const createClinicMutation = useCreateClinic();
    const updateClinicMutation = useUpdateClinic();
    const { data: allStaffData = [], isLoading: isLoadingAllStaff } = useAllStaff(showUpdateStaffModal);
    const { data: doctorsList = [], isLoading: isLoadingDoctors } = useStaffListDoctors(showAddStaffModal);
    const { data: clinics = [], isLoading: isLoadingClinics } = useClinics(showClinicRegistrationModal || showAddStaffModal);

    const staffMembers: StaffMember[] = (allStaffData || []).map((s) => ({
        id: s.uuid || String(s.id),
        staffId: s.id,
        name: s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || '—',
        role: s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : '—',
        department: s.clinic?.department ?? (s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : ''),
        email: s.email || '',
        phone: s.phone || '',
        clinic: s.clinic?.name ?? '',
        clinicId: s.clinic?.id,
        address: s.clinic?.address ?? '',
        fax: '',
    }));

    const doctorOptions: SelectOption[] = (doctorsList || []).map((d) => ({
        value: d.id,
        label: d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || `Doctor ${d.id}`,
    }));

    const roleOptions = [
        { value: 'Doctor', label: 'Doctor' },
        { value: 'Nurse', label: 'Nurse' },
        { value: 'Navigator', label: 'Navigator' },
        { value: 'Research coordinator', label: 'Research coordinator' },
        { value: 'Medical Assistant', label: 'Medical Assistant' },
    ];
    const clinicOptions: SelectOption[] = (clinics || []).map((clinic) => ({
        value: clinic.id ?? '',
        label: clinic.name || `Clinic ${clinic.id}`,
    }));

    // Form
    const {
        register: registerStaff,
        handleSubmit: handleSubmitStaff,
        control: controlStaff,
        formState: { errors: staffErrors, isSubmitting: isSubmittingStaff },
        reset: resetStaff,
        watch: watchStaff,
        setValue: setValueStaff,
        setError: setErrorStaff,
    } = useForm<StaffFormValues & { autofillClinicInfo?: boolean; doctorIds?: number[] }>({
        resolver: zodResolver(staffSchema),
        defaultValues: {
            role: '',
            fullName: '',
            email: '',
            phone: '',
            autofillClinicInfo: false,
            clinicName: '',
            clinicDepartment: '',
            clinicAddress: '',
            clinicFax: '',
            selectedClinicUuid: '',
            doctorIds: [],
        },
    });
    const autofillClinicInfo = watchStaff('autofillClinicInfo');
    const profileClinicName = (currentStaffProfile?.clinic_name || profile?.clinic_name || '').trim();

    const {
        register: registerClinic,
        handleSubmit: handleSubmitClinic,
        formState: { errors: clinicErrors, isSubmitting: isSubmittingClinic },
        reset: resetClinic,
        setValue: setValueClinic,
    } = useForm<ClinicFormValues>({
        resolver: zodResolver(clinicSchema),
        defaultValues: {
            name: '',
            address: '',
            fax: '',
        },
    });

    useEffect(() => {
        if (!showAddStaffModal) return;
        setValueStaff('autofillClinicInfo', false);
        setValueStaff('selectedClinicUuid', '');
    }, [showAddStaffModal, setValueStaff]);

    // Preserve previous behavior: when checkbox is checked, always use profile clinic data.
    useEffect(() => {
        if (!showAddStaffModal || !autofillClinicInfo) return;
        const profileClinicName = currentStaffProfile?.clinic_name || profile?.clinic_name || '';
        const matchedClinic = (clinics || []).find(
            (clinic) => (clinic.name || '').trim().toLowerCase() === profileClinicName.trim().toLowerCase()
        );
        setValueStaff('selectedClinicUuid', matchedClinic ? String(matchedClinic.id) : '');
        setValueStaff('clinicName', profileClinicName);
        setValueStaff('clinicDepartment', currentStaffProfile?.clinic_department || profile?.clinic_department || '');
        setValueStaff('clinicAddress', currentStaffProfile?.clinic_address || profile?.clinic_address || '');
        setValueStaff('clinicFax', currentStaffProfile?.clinic_fax || profile?.clinic_fax || '');
    }, [showAddStaffModal, autofillClinicInfo, currentStaffProfile, profile, clinics, setValueStaff]);

    const handleAddStaff = async (values: StaffFormValues & { autofillClinicInfo?: boolean; doctorIds?: number[] }) => {
        if (values.role && values.role !== 'Doctor' && (values.doctorIds?.length ?? 0) < 1) {
            setErrorStaff('doctorIds', { type: 'manual', message: 'Please select at least one doctor for this role.' });
            return;
        }
        try {
            const autofill = !!values.autofillClinicInfo;
            const clinicFax = currentStaffProfile?.clinic_fax || profile?.clinic_fax || '';
            const clinicId = Number(values.selectedClinicUuid);
            if (!Number.isFinite(clinicId) || clinicId < 1) {
                setErrorStaff('selectedClinicUuid', { type: 'manual', message: 'Please select a valid clinic.' });
                return;
            }
            const payload = {
                role: (values.role || 'doctor').toLowerCase().replace(/\s+/g, '_'),
                full_name: values.fullName,
                email: values.email,
                phone: values.phone || '',
                clinic_id: clinicId,
                fax_number: autofill ? clinicFax : (values.clinicFax || ''),
                doctor_ids: values.doctorIds ?? [],
            };
            const result = await addStaffMutation.mutateAsync(payload) as { message?: string; staff_uuid?: string; email?: string; role?: string };
            setAddStaffSuccess({
                message: result.message || 'Staff added successfully',
                email: result.email,
                role: result.role,
            });
            resetStaff();
        } catch (error: unknown) {
            console.error('Add staff failed:', error);
            throw error;
        }
    };

    const handleUpdateStaff = async (values: StaffFormValues) => {
        const staffId = editingStaff?.staffId ?? (editingStaff?.id && /^\d+$/.test(String(editingStaff.id)) ? Number(editingStaff.id) : null);
        if (staffId == null) return;
        try {
            await updateStaffByIdMutation.mutateAsync({
                staffId,
                payload: {
                    full_name: values.fullName.trim(),
                    phone: values.phone || '',
                },
            });
            resetStaff();
            setEditingStaff(null);
            setUpdateStaffSuccess(true);
        } catch (error) {
            console.error('Update staff failed:', error);
            throw error;
        }
    };

    const handleEditStaff = (staff: StaffMember) => {
        setEditingStaff(staff);
        setValueStaff('role', staff.role);
        setValueStaff('fullName', staff.name);
        setValueStaff('email', staff.email);
        setValueStaff('phone', staff.phone);
        if (staff.clinicId) {
            setValueStaff('selectedClinicUuid', String(staff.clinicId));
        }
    };

    const handleDeleteClick = (staff: StaffMember) => {
        setStaffToDelete(staff);
        setShowDeleteConfirm(true);
    };

    const confirmDeleteStaff = async () => {
        if (!staffToDelete) return;
        const staffId = staffToDelete.staffId ?? (staffToDelete.id && /^\d+$/.test(String(staffToDelete.id)) ? Number(staffToDelete.id) : null);
        if (staffId == null) return;
        try {
            const result = await deleteStaffByIdMutation.mutateAsync(staffId) as any;
            setShowDeleteConfirm(false);
            setStaffToDelete(null);
            setAlertInfo({ 
                message: result?.message || result?.data?.message || 'Staff deleted successfully', 
                severity: 'success' 
            });
        } catch (error) {
            console.error('Delete staff failed:', error);
            setAlertInfo({ message: 'Failed to delete staff member. Please try again.', severity: 'error' });
        }
    };

    const handleCloseAddStaff = () => {
        setAddStaffSuccess(null);
        resetStaff();
        closeModals();
    };

    const handleCloseUpdateStaff = () => {
        setUpdateStaffSuccess(false);
        resetStaff();
        setEditingStaff(null);
        closeModals();
    };

    const handleAddAnotherStaff = () => {
        setAddStaffSuccess(null);
        resetStaff();
    };

    const handleCloseClinicModal = () => {
        closeModals();
    };

    const handleCloseClinicFormModal = () => {
        setEditingClinic(null);
        resetClinic();
        setShowClinicFormModal(false);
    };

    const handleCloseClinicFlow = () => {
        handleCloseClinicFormModal();
        closeModals();
    };

    const showTopError = (message: string) => {
        setAlertInfo({ message, severity: 'error' });
    };

    const handleEditClinic = (clinic: ClinicItem) => {
        setEditingClinic(clinic);
        setValueClinic('name', clinic.name || '');
        setValueClinic('address', clinic.address || '');
        setValueClinic('fax', clinic.fax || clinic.phone || '');
        setShowClinicFormModal(true);
    };

    const handleClinicSubmit = async (values: ClinicFormValues) => {
        try {
            if (editingClinic?.uuid) {
                await updateClinicMutation.mutateAsync({
                    uuid: editingClinic.uuid,
                    payload: {
                        clinic_name: values.name,
                        clinic_address: values.address,
                        fax_number: values.fax,
                    },
                });
            } else {
                await createClinicMutation.mutateAsync({
                    clinic_name: values.name,
                    clinic_address: values.address,
                    fax_number: values.fax,
                });
            }
            setEditingClinic(null);
            resetClinic();
            setShowClinicFormModal(false);
        } catch (error: any) {
            const apiMessage =
                error?.response?.data?.message ||
                error?.message ||
                'Failed to save clinic. Please try again.';
            showTopError(apiMessage);
            console.error('Clinic save failed:', error);
        }
    };

    useEffect(() => {
        if (showClinicRegistrationModal && clinicRegistrationMode === 'add') {
            setEditingClinic({ id: 0, uuid: '', name: '', address: '', fax: '', phone: '', department: '' });
            resetClinic({ name: '', address: '', fax: '' });
            setShowClinicFormModal(true);
            return;
        }
        if (showClinicRegistrationModal && clinicRegistrationMode === 'list') {
            setShowClinicFormModal(false);
            setEditingClinic(null);
            resetClinic();
            return;
        }
        if (!showClinicRegistrationModal) {
            setShowClinicFormModal(false);
            setEditingClinic(null);
            resetClinic();
        }
    }, [showClinicRegistrationModal, clinicRegistrationMode, resetClinic]);

    return (
        <>
            <Snackbar
                open={!!alertInfo}
                autoHideDuration={6000}
                onClose={() => setAlertInfo(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                sx={{ zIndex: 100100 }}
            >
                <Alert
                    onClose={() => setAlertInfo(null)}
                    severity={alertInfo?.severity || 'error'}
                    variant="filled"
                    sx={{
                        width: '100%',
                        minWidth: 300,
                        fontWeight: 600,
                        alignItems: 'center',
                        '& .MuiAlert-message': {
                            width: '100%',
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                        '& .MuiAlert-action': {
                            display: 'flex',
                            alignItems: 'center',
                            margin: 0,
                            paddingLeft: 8,
                        },
                    }}
                    icon={false}
                    action={
                        <button
                            type="button"
                            onClick={() => setAlertInfo(null)}
                            className="text-white/90 hover:text-white transition-colors items-center justify-center flex"
                            aria-label="Close message"
                        >
                            <X size={18} />
                        </button>
                    }
                >
                    {alertInfo?.message}
                </Alert>
            </Snackbar>

            {/* Add New Staff Modal */}
            <Modal
                isOpen={showAddStaffModal}
                onClose={handleCloseAddStaff}
                title="Add New Staff Member"
                size="lg"
            >
                {addStaffSuccess ? (
                    <div className="">
                        <div className="flex flex-col items-center text-center">
                            <div className={`flex items-center justify-center w-14 h-14 rounded-full shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className={`mt-5 text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {addStaffSuccess.message}
                            </h3>
                            {(addStaffSuccess.email || addStaffSuccess.role) && (
                                <div className={`mt-4 w-full max-w-sm mx-auto px-4 py-3 rounded-xl text-left ${isDark ? 'bg-slate-800/60 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                        {addStaffSuccess.role && (
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200/80 text-slate-700'}`}>
                                                {addStaffSuccess.role}
                                            </span>
                                        )}
                                        {addStaffSuccess.email && (
                                            <span className="text-sm break-all">{addStaffSuccess.email}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <ModalFooter className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-700">
                            <Button type="button" variant="outline" onClick={handleAddAnotherStaff}>
                                Add another
                            </Button>
                            <Button type="button" variant="primary" onClick={handleCloseAddStaff}>
                                Close
                            </Button>
                        </ModalFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitStaff(handleAddStaff)} className="space-y-4">
                        <Controller
                            name="role"
                            control={controlStaff}
                            render={({ field }) => (
                                <Select
                                    label="Role *"
                                    placeholder="Select role"
                                    options={roleOptions}
                                    error={staffErrors.role?.message}
                                    value={roleOptions.find(option => option.value === field.value) || null}
                                    onChange={(option: any) => field.onChange(option?.value || '')}
                                />
                            )}
                        />
                        {watchStaff('role') && watchStaff('role') !== 'Doctor' && (
                            <div className="space-y-1">
                                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Select doctor(s) this staff member will work with.
                                </p>
                                <Controller
                                    name="doctorIds"
                                    control={controlStaff}
                                    render={({ field }) => (
                                        <Select
                                            label="Select Doctor(s) *"
                                            placeholder={isLoadingDoctors ? 'Loading doctor list...' : 'Select one or more doctors'}
                                            options={doctorOptions}
                                            isMulti
                                            isDisabled={isLoadingDoctors}
                                            error={staffErrors.doctorIds?.message}
                                            value={doctorOptions.filter((opt) => (field.value ?? []).includes(Number(opt.value)))}
                                            onChange={(selected) => {
                                                field.onChange(
                                                    (Array.isArray(selected) ? selected : selected ? [selected] : []).map(
                                                        (o) => Number(o.value)
                                                    )
                                                );
                                            }}
                                        />
                                    )}
                                />
                            </div>
                        )}
                        <Input
                            label="Full Name *"
                            placeholder="Jane Doe"
                            icon={<User size={18} />}
                            error={staffErrors.fullName?.message}
                            {...registerStaff('fullName')}
                        />
                        <Input
                            label="Email *"
                            type="email"
                            placeholder="jane@clinic.org"
                            icon={<Mail size={18} />}
                            error={staffErrors.email?.message}
                            {...registerStaff('email')}
                        />
                        <Input
                            label="Phone *"
                            type="tel"
                            placeholder="(555) 000-0000"
                            icon={<Phone size={18} />}
                            error={staffErrors.phone?.message}
                            {...registerStaff('phone')}
                        />
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                id="autofill-clinic-global"
                                checked={watchStaff('autofillClinicInfo') || false}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setValueStaff('autofillClinicInfo', checked);
                                    if (checked) {
                                        const profileClinicName = currentStaffProfile?.clinic_name || profile?.clinic_name || '';
                                        const matchedClinic = (clinics || []).find(
                                            (clinic) => (clinic.name || '').trim().toLowerCase() === profileClinicName.trim().toLowerCase()
                                        );
                                        setValueStaff('selectedClinicUuid', matchedClinic ? String(matchedClinic.id) : '');
                                        setValueStaff('clinicName', profileClinicName);
                                        setValueStaff('clinicDepartment', currentStaffProfile?.clinic_department || profile?.clinic_department || '');
                                        setValueStaff('clinicAddress', currentStaffProfile?.clinic_address || profile?.clinic_address || '');
                                        setValueStaff('clinicFax', currentStaffProfile?.clinic_fax || profile?.clinic_fax || '');
                                    } else {
                                        setValueStaff('clinicName', '');
                                        setValueStaff('clinicDepartment', '');
                                        setValueStaff('clinicAddress', '');
                                        setValueStaff('clinicFax', '');
                                    }
                                }}
                                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                            />
                            <label
                                htmlFor="autofill-clinic-global"
                                className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                            >
                                Autofill clinic info from my profile
                            </label>
                        </div>
                        <Controller
                            name="selectedClinicUuid"
                            control={controlStaff}
                            render={({ field }) => (
                                <Select
                                    label="Clinic *"
                                    placeholder={isLoadingClinics ? 'Loading clinic list...' : 'Select clinic'}
                                    options={clinicOptions}
                                    error={staffErrors.selectedClinicUuid?.message}
                                    isDisabled={isLoadingClinics || !!watchStaff('autofillClinicInfo')}
                                    value={
                                        clinicOptions.find((opt) => String(opt.value) === String(field.value))
                                        || (
                                            autofillClinicInfo && profileClinicName
                                                ? { value: '__profile_clinic__', label: profileClinicName }
                                                : null
                                        )
                                    }
                                    onChange={(option: any) => {
                                        const value = option?.value ? String(option.value) : '';
                                        field.onChange(value);
                                        const selectedClinic = (clinics || []).find(
                                            (clinic) => String(clinic.id) === value
                                        );
                                        if (!selectedClinic) {
                                            setValueStaff('clinicName', '');
                                            setValueStaff('clinicDepartment', '');
                                            setValueStaff('clinicAddress', '');
                                            setValueStaff('clinicFax', '');
                                            return;
                                        }
                                        setValueStaff('clinicName', selectedClinic.name || '');
                                        setValueStaff('clinicDepartment', selectedClinic.department || '');
                                        setValueStaff('clinicAddress', selectedClinic.address || '');
                                        setValueStaff('clinicFax', selectedClinic.fax || selectedClinic.phone || '');
                                    }}
                                />
                            )}
                        />
                        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            {/* <Input
                                label="Department"
                                placeholder="Enter department"
                                icon={<Building size={18} />}
                                disabled={!!watchStaff('autofillClinicInfo')}
                                {...registerStaff('clinicDepartment')}
                            /> */}
                            <Input
                                label="Address"
                                placeholder="Enter clinic address"
                                icon={<MapPin size={18} />}
                                disabled={!!watchStaff('autofillClinicInfo')}
                                {...registerStaff('clinicAddress')}
                            />
                            <Input
                                label="Fax"
                                placeholder="Enter fax number"
                                icon={<Printer size={18} />}
                                disabled={!!watchStaff('autofillClinicInfo')}
                                {...registerStaff('clinicFax')}
                            />
                        </div>
                        <ModalFooter>
                            <Button type="button" variant="outline" onClick={handleCloseAddStaff}>Cancel</Button>
                            <Button type="submit" variant="primary" loading={isSubmittingStaff || addStaffMutation.isPending}>Add Staff</Button>
                        </ModalFooter>
                    </form>
                )}
            </Modal>

            {/* Update/List Staff Modal */}
            <Modal
                isOpen={showUpdateStaffModal}
                onClose={handleCloseUpdateStaff}
                title="Manage Staff Members"
                titleDescription={editingStaff ? undefined : updateStaffSuccess ? undefined : "View and manage your team members."}
                size="lg"
            >
                {updateStaffSuccess ? (
                    <div className="py-4">
                        <div className="flex flex-col items-center text-center space-y-5">
                            <div className={`flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Staff updated successfully</h3>
                            </div>
                        </div>
                        <ModalFooter className="mt-8">
                            <Button type="button" variant="primary" onClick={handleCloseUpdateStaff}>Close</Button>
                        </ModalFooter>
                    </div>
                ) : !editingStaff ? (
                    <div className="space-y-4">
                        {isLoadingAllStaff ? (
                            <div className="py-12 flex items-center justify-center">Loading staff list...</div>
                        ) : staffMembers.length === 0 ? (
                            <div className="py-12 text-center">No staff members found.</div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                                {staffMembers.map((staff) => (
                                    <button
                                        key={staff.id}
                                        onClick={() => handleEditStaff(staff)}
                                        className={`w-full text-left p-4 rounded-xl border transition-colors ${isDark ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800/80 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold">{staff.name}</h3>
                                                <p className="text-sm opacity-70">{staff.email}</p>
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>{staff.role}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditStaff(staff);
                                                    }}
                                                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-600'}`}
                                                    title="Edit staff"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteClick(staff);
                                                    }}
                                                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50' + ' text-red-600'}`}
                                                    title="Delete staff"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <ModalFooter className="mt-6">
                            <Button variant="outline" onClick={handleCloseUpdateStaff}>Close</Button>
                        </ModalFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitStaff(handleUpdateStaff)} className="space-y-5">
                        <Input label="Role" value={editingStaff?.role ?? ''} icon={<UserCog size={18} />} disabled />
                        <Input label="Full name" placeholder="Jane Doe" icon={<User size={18} />} error={staffErrors.fullName?.message} {...registerStaff('fullName')} />
                        <Input label="Email" type="email" value={watchStaff('email') ?? ''} icon={<Mail size={18} />} disabled />
                        <Input label="Phone *" type="tel" placeholder="(555) 000-0000" icon={<Phone size={18} />} error={staffErrors.phone?.message} {...registerStaff('phone')} />
                        <ModalFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setEditingStaff(null)}>Back</Button>
                            <Button type="submit" variant="primary" loading={isSubmittingStaff || updateStaffByIdMutation.isPending}>Save changes</Button>
                        </ModalFooter>
                    </form>
                )}
            </Modal>

            {/* Clinic Registration Modal */}
            <Modal
                isOpen={showClinicRegistrationModal && clinicRegistrationMode === 'list'}
                onClose={handleCloseClinicModal}
                title="Update Existing Clinic"
                size="lg"
            >
                <div className="space-y-4">
                    {isLoadingClinics ? (
                        <div className="py-12 flex items-center justify-center">Loading clinics...</div>
                    ) : clinics.length === 0 ? (
                        <div className="py-12 text-center">No clinics found.</div>
                    ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            {clinics.map((clinic) => (
                                <button
                                    key={clinic.uuid || clinic.id}
                                    onClick={() => handleEditClinic(clinic)}
                                    className={`w-full text-left p-4 rounded-xl border transition-colors ${isDark ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800/80 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold">{clinic.name}</h3>
                                            <p className="text-sm opacity-70">{clinic.address || 'No address'}</p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                                Fax: {clinic.fax || clinic.phone || 'N/A'}
                                            </span>
                                        </div>
                                        <Edit size={16} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    <ModalFooter className="mt-6">
                        <Button variant="outline" onClick={handleCloseClinicModal}>Close</Button>
                    </ModalFooter>
                </div>
            </Modal>

            <Modal
                isOpen={showClinicFormModal}
                onClose={handleCloseClinicFlow}
                title={editingClinic?.uuid ? 'Edit Clinic' : 'Add Clinic'}
                size="lg"
            >
                <form onSubmit={handleSubmitClinic(handleClinicSubmit)} className="space-y-5">
                    <Input
                        label="Clinic Name *"
                        placeholder="Enter clinic name"
                        icon={<Building size={18} />}
                        error={clinicErrors.name?.message}
                        {...registerClinic('name')}
                    />
                    <Input
                        label="Clinic Address *"
                        placeholder="Enter clinic address"
                        icon={<MapPin size={18} />}
                        error={clinicErrors.address?.message}
                        {...registerClinic('address')}
                    />
                    <Input
                        label="Fax Number *"
                        placeholder="Enter fax number"
                        icon={<Printer size={18} />}
                        error={clinicErrors.fax?.message}
                        {...registerClinic('fax')}
                    />
                    <ModalFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={handleCloseClinicFlow}>Close</Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={isSubmittingClinic || createClinicMutation.isPending || updateClinicMutation.isPending}
                        >
                            {editingClinic?.uuid ? 'Save changes' : 'Create clinic'}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                title="Delete Staff Member"
                size="sm"
            >
                <div className="space-y-4">
                    <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        Are you sure you want to delete <strong>{staffToDelete?.name}</strong>? This action cannot be undone.
                    </p>
                    <ModalFooter className="mt-6">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(false)}
                        >
                            No, Keep
                        </Button>
                        <Button
                            variant="primary"
                            className="bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 text-white"
                            onClick={confirmDeleteStaff}
                            loading={deleteStaffByIdMutation.isPending}
                        >
                            Yes, Delete
                        </Button>
                    </ModalFooter>
                </div>
            </Modal>
        </>
    );
};

export default StaffManagementModals;

import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Phone, Building, MapPin, Printer, User, Edit, UserCog, CheckCircle } from 'lucide-react';
import { Button, Input, Select, Modal, ModalFooter } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useUser } from '../contexts/UserContext';
import { useThemeMode } from '@oncolife/ui-components';
import { useAddStaffV1, useStaffListDoctors, useUpdateStaffProfile, useAllStaff, useCurrentStaffProfile } from '../services/staff';
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
});

type StaffFormValues = z.infer<typeof staffSchema>;

const StaffManagementModals: React.FC = () => {
    const { profile } = useUser();
    const { isDark } = useThemeMode();
    const { showAddStaffModal, showUpdateStaffModal, closeModals } = useStaffManagement();
    const { data: currentStaffProfile } = useCurrentStaffProfile(true);

    // States
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [addStaffSuccess, setAddStaffSuccess] = useState<{ message: string; email?: string; role?: string } | null>(null);
    const [updateStaffSuccess, setUpdateStaffSuccess] = useState(false);

    // Mutations/Services
    const addStaffMutation = useAddStaffV1();
    const updateStaffProfileMutation = useUpdateStaffProfile();
    const { data: allStaffData = [], isLoading: isLoadingAllStaff } = useAllStaff(showUpdateStaffModal);
    const { data: doctorsList = [], isLoading: isLoadingDoctors } = useStaffListDoctors(showAddStaffModal);

    const staffMembers: StaffMember[] = (allStaffData || []).map((s) => ({
        id: s.uuid || String(s.id),
        staffId: s.id,
        name: s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || '—',
        role: s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : '—',
        department: s.clinic?.department ?? (s.role ? s.role.charAt(0).toUpperCase() + s.role.slice(1) : ''),
        email: s.email || '',
        phone: s.phone || '',
        clinic: s.clinic?.name ?? '',
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
    ];

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
            doctorIds: [],
        },
    });

    useEffect(() => {
        if (!showAddStaffModal) return;
        setValueStaff('autofillClinicInfo', false);
    }, [showAddStaffModal, setValueStaff]);

    const handleAddStaff = async (values: StaffFormValues & { autofillClinicInfo?: boolean; doctorIds?: number[] }) => {
        if (values.role && values.role !== 'Doctor' && (values.doctorIds?.length ?? 0) < 1) {
            setErrorStaff('doctorIds', { type: 'manual', message: 'Please select at least one doctor for this role.' });
            return;
        }
        try {
            const autofill = !!values.autofillClinicInfo;
            const clinicName = currentStaffProfile?.clinic_name || profile?.clinic_name || '';
            const clinicDepartment = currentStaffProfile?.clinic_department || profile?.clinic_department || '';
            const clinicAddress = currentStaffProfile?.clinic_address || profile?.clinic_address || '';
            const clinicFax = currentStaffProfile?.clinic_fax || profile?.clinic_fax || '';
            const payload = {
                role: (values.role || 'doctor').toLowerCase().replace(/\s+/g, '_'),
                full_name: values.fullName,
                email: values.email,
                phone: values.phone || '',
                clinic_name: autofill ? clinicName : (values.clinicName || ''),
                clinic_department: autofill ? clinicDepartment : (values.clinicDepartment || ''),
                clinic_address: autofill ? clinicAddress : (values.clinicAddress || ''),
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
            await updateStaffProfileMutation.mutateAsync({
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

    return (
        <>
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
                                        setValueStaff('clinicName', currentStaffProfile?.clinic_name || profile?.clinic_name || '');
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
                        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Input
                                label="Clinic"
                                placeholder="Enter clinic name"
                                icon={<Building size={18} />}
                                disabled={!!watchStaff('autofillClinicInfo')}
                                {...registerStaff('clinicName')}
                            />
                            <Input
                                label="Department"
                                placeholder="Enter department"
                                icon={<Building size={18} />}
                                disabled={!!watchStaff('autofillClinicInfo')}
                                {...registerStaff('clinicDepartment')}
                            />
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
                                            <div>
                                                <h3 className="font-semibold">{staff.name}</h3>
                                                <p className="text-sm opacity-70">{staff.email}</p>
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>{staff.role}</span>
                                            </div>
                                            <Edit size={16} />
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
                            <Button type="submit" variant="primary" loading={isSubmittingStaff || updateStaffProfileMutation.isPending}>Save changes</Button>
                        </ModalFooter>
                    </form>
                )}
            </Modal>
        </>
    );
};

export default StaffManagementModals;

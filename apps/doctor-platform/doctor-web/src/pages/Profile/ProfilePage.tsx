/**
 * OncoLife - Physician Profile Page
 * View and edit physician profile information
 */

import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Phone, Building, MapPin, Printer, User, Edit, Save, X, ChevronDown, UserPlus, Settings, UserCog, CheckCircle } from 'lucide-react';
import { Button, Input, Select, Modal, ModalFooter } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { useUser } from '../../contexts/UserContext';
import { useThemeMode } from '@oncolife/ui-components';
import { useAddStaffV1, useStaffListDoctors, useUpdateStaffProfile, useAllStaff } from '../../services/staff';

// Validation Schema
const profileSchema = z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    role: z.string().min(1, 'Role is required'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().min(1, 'Phone number is required'),
    clinic_name: z.string().min(1, 'Clinic name is required'),
    clinic_department: z.string().optional(),
    clinic_address: z.string().min(1, 'Clinic address is required'),
    clinic_fax: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

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

// Staff form schema (no doctorIds refine here - we validate that only in Add Staff submit)
const staffSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Please enter a valid email address'),
    phone: z.string().optional(),
    doctorIds: z.array(z.number()).optional(),
});

type StaffFormValues = z.infer<typeof staffSchema>;

const ProfilePage: React.FC = () => {
    const { profile, updateProfile } = useUser();
    const { isDark } = useThemeMode();
    const updateStaffProfileMutation = useUpdateStaffProfile();
    const [isEditing, setIsEditing] = useState(false);
    
    // Manage Staff states
    const [showManageStaffDropdown, setShowManageStaffDropdown] = useState(false);
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [showUpdateStaffModal, setShowUpdateStaffModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const [addStaffSuccess, setAddStaffSuccess] = useState<{ message: string; email?: string; role?: string } | null>(null);
    const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
    const [updateStaffSuccess, setUpdateStaffSuccess] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { data: allStaffData = [], isLoading: isLoadingAllStaff } = useAllStaff(showUpdateStaffModal);
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

    const profileFormDefaults: ProfileFormValues = {
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        role: profile?.role || 'Oncology Patient Navigator',
        email: profile?.email || '',
        phone: profile?.phone || '',
        clinic_name: profile?.clinic_name || '',
        clinic_department: profile?.clinic_department || '',
        clinic_address: profile?.clinic_address || '',
        clinic_fax: profile?.clinic_fax || '',
    };

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: profileFormDefaults,
    });

    // Prefill form with profile from localStorage (user + nested clinic) when profile loads or changes
    useEffect(() => {
        if (!profile) return;
        reset({
            first_name: profile.first_name ?? '',
            last_name: profile.last_name ?? '',
            role: profile.role ?? 'Oncology Patient Navigator',
            email: profile.email ?? '',
            phone: profile.phone ?? '',
            clinic_name: profile.clinic_name ?? '',
            clinic_department: profile.clinic_department ?? '',
            clinic_address: profile.clinic_address ?? '',
            clinic_fax: profile.clinic_fax ?? '',
        });
    }, [profile, reset]);

    const onSubmit = async (values: ProfileFormValues) => {
        try {
            const staffId = profile?.staff_id ?? (typeof profile?.id === 'number' ? profile.id : null);
            if (staffId != null) {
                await updateStaffProfileMutation.mutateAsync({
                    staffId,
                    payload: {
                        full_name: `${values.first_name} ${values.last_name}`.trim(),
                        phone: values.phone || '',
                    },
                });
            }
            updateProfile({
                first_name: values.first_name,
                last_name: values.last_name,
                role: values.role,
                email: values.email,
                phone: values.phone,
                clinic_name: values.clinic_name,
                clinic_department: values.clinic_department,
                clinic_address: values.clinic_address,
                clinic_fax: values.clinic_fax,
            });
            reset(values);
            setIsEditing(false);
            setProfileSaveSuccess(true);
        } catch (error) {
            console.error('Profile update failed:', error);
            throw error;
        }
    };

    const handleCancel = () => {
        reset(profileFormDefaults);
        setIsEditing(false);
    };

    // Get user initials
    const getInitials = () => {
        if (profile) {
            const first = profile.first_name?.[0] || '';
            const last = profile.last_name?.[0] || '';
            return (first + last).toUpperCase() || 'DR';
        }
        return 'DR';
    };

    const getUserName = () => {
        if (profile) {
            return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Doctor';
        }
        return 'Doctor';
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowManageStaffDropdown(false);
            }
        };

        if (showManageStaffDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showManageStaffDropdown]);

    // Staff form
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
            doctorIds: [],
        },
    });

    const addStaffMutation = useAddStaffV1();
    const { data: doctorsList = [], isLoading: isLoadingDoctors } = useStaffListDoctors(showAddStaffModal);

    const doctorOptions: SelectOption[] = (doctorsList || []).map((d) => ({
        value: d.id,
        label: d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || `Doctor ${d.id}`,
    }));

    const handleAddStaff = async (values: StaffFormValues & { autofillClinicInfo?: boolean; doctorIds?: number[] }) => {
        if (values.role && values.role !== 'Doctor' && (values.doctorIds?.length ?? 0) < 1) {
            setErrorStaff('doctorIds', { type: 'manual', message: 'Please select at least one doctor for this role.' });
            return;
        }
        try {
            const autofill = !!values.autofillClinicInfo;
            const payload = {
                role: (values.role || 'doctor').toLowerCase().replace(/\s+/g, '_'),
                full_name: values.fullName,
                email: values.email,
                phone: values.phone || '',
                clinic_name: autofill ? (profile?.clinic_name || '') : '',
                clinic_department: autofill ? (profile?.clinic_department || '') : '',
                clinic_address: autofill ? (profile?.clinic_address || '') : '',
                fax_number: autofill ? (profile?.clinic_fax || '') : '',
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
            const err = error as { response?: { data?: { message?: string } } };
            const message = err.response?.data?.message;
            if (message && typeof message === 'string' && message.toLowerCase().includes('doctor_ids')) {
                setErrorStaff('doctorIds', { type: 'manual', message });
            }
            throw error;
        }
    };

    const handleUpdateStaff = async (values: StaffFormValues) => {
        const staffId = editingStaff?.staffId ?? (editingStaff?.id && /^\d+$/.test(String(editingStaff.id)) ? Number(editingStaff.id) : null);
        if (staffId == null) {
            console.error('Update staff failed: staff id not found');
            return;
        }
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
        setShowAddStaffModal(false);
    };

    const handleAddAnotherStaff = () => {
        setAddStaffSuccess(null);
        resetStaff();
    };

    const handleCloseUpdateStaff = () => {
        setUpdateStaffSuccess(false);
        resetStaff();
        setEditingStaff(null);
        setShowUpdateStaffModal(false);
    };

    // Auto-hide profile save success message after 4 seconds
    useEffect(() => {
        if (!profileSaveSuccess) return;
        const t = setTimeout(() => setProfileSaveSuccess(false), 4000);
        return () => clearTimeout(t);
    }, [profileSaveSuccess]);

    // Role options
    const roleOptions = [
        { value: 'Doctor', label: 'Doctor' },
        { value: 'Nurse', label: 'Nurse' },
    ];

    return (
        <div className={`min-h-screen p-4 md:p-8 transition-colors ${isDark ? 'bg-[#1A1917]' : 'bg-gradient-to-br from-white to-slate-50'
            }`}>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Profile
                    </h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                        Manage your account information
                    </p>
                </div>

                {/* Profile save success message */}
                {profileSaveSuccess && (
                    <div
                        className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-3 border ${
                            isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                        role="status"
                        aria-live="polite"
                    >
                        <CheckCircle size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-medium">Profile updated successfully.</span>
                    </div>
                )}

                {/* Profile Card */}
                <div className={`rounded-2xl shadow-lg overflow-hidden mb-6 transition-colors ${isDark ? 'bg-[#2A2725]' : 'bg-white'
                    }`}>
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-primary to-primary-dark p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-6 text-center sm:text-left">
                                {/* Avatar */}
                                <div className="w-24 h-24 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center text-white text-3xl font-bold shadow-xl">
                                    {getInitials()}
                                </div>

                                {/* Name & Role */}
                                <div className="text-white">
                                    <h2 className={`text-2xl md:text-3xl font-bold mb-1 text-white`}>{getUserName()}</h2>
                                    <p className="text-white/80 text-lg">{profile?.role || 'Oncology Patient Navigator'}</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
                                {/* Manage Staff Button - only for admin */}
                                {profile?.role === 'admin' && (
                                <div className="relative" ref={dropdownRef}>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setShowManageStaffDropdown(!showManageStaffDropdown)}
                                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 py-2.5 px-4 w-full sm:w-auto"
                                    >
                                        <UserCog size={16} className="mr-2" />
                                        Manage Staff
                                        <ChevronDown size={16} className={`ml-2 transition-transform ${showManageStaffDropdown ? 'rotate-180' : ''}`} />
                                    </Button>
                                    
                                    {/* Dropdown Menu */}
                                    {showManageStaffDropdown && (
                                        <div className={`absolute right-0 mt-2 w-56 rounded-lg shadow-lg z-50 transition-colors ${
                                            isDark ? 'bg-[#2A2725] border border-slate-700' : 'bg-white border border-slate-200'
                                        }`}>
                                            <div className="py-1">
                                                <button
                                                    onClick={() => {
                                                        setShowAddStaffModal(true);
                                                        setShowManageStaffDropdown(false);
                                                    }}
                                                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                                                        isDark 
                                                            ? 'hover:bg-slate-800 text-slate-200' 
                                                            : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <UserPlus size={18} />
                                                    <span className="font-medium">Add New Staff</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowUpdateStaffModal(true);
                                                        setShowManageStaffDropdown(false);
                                                    }}
                                                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                                                        isDark 
                                                            ? 'hover:bg-slate-800 text-slate-200' 
                                                            : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <Settings size={18} />
                                                    <span className="font-medium">Update Existing Staff</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                )}

                                {/* Edit Profile Button */}
                                {!isEditing ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setIsEditing(true)}
                                        className="bg-white/20 hover:bg-white/30 text-white border-white/30 py-2.5 px-4 w-full sm:w-auto"
                                    >
                                        <Edit size={16} className="mr-2" />
                                        Edit Profile
                                    </Button>
                                ) : (
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-start">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={handleCancel}
                                            className="bg-white/20 hover:bg-white/30 text-white border-white/30 py-2.5 px-4 flex-1 sm:flex-none"
                                        >
                                            <X size={16} className="mr-2" />
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={handleSubmit(onSubmit)}
                                            loading={isSubmitting || updateStaffProfileMutation.isPending}
                                            className="bg-secondary hover:bg-secondary-dark py-2.5 px-4 flex-1 sm:flex-none"
                                        >
                                            <Save size={16} className="mr-2" />
                                            Save
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Form Content */}
                    <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8">
                        {/* Contact Information Section */}
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-primary/10 mb-3">
                                    <User size={20} className="text-primary" />
                                </div>
                                <h3 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Contact Information
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="First Name"
                                    placeholder="John"
                                    icon={<User size={18} />}
                                    error={errors.first_name?.message}
                                    disabled={!isEditing}
                                    {...register('first_name')}
                                />

                                <Input
                                    label="Last Name"
                                    placeholder="Doe"
                                    icon={<User size={18} />}
                                    error={errors.last_name?.message}
                                    disabled={!isEditing}
                                    {...register('last_name')}
                                />

                                <Input
                                    label="Email"
                                    type="email"
                                    placeholder="doctor@clinic.com"
                                    icon={<Mail size={18} />}
                                    error={errors.email?.message}
                                    disabled={!isEditing}
                                    {...register('email')}
                                />

                                <Input
                                    label="Phone"
                                    type="tel"
                                    placeholder="(555) 234-5678"
                                    icon={<Phone size={18} />}
                                    error={errors.phone?.message}
                                    disabled={!isEditing}
                                    {...register('phone')}
                                />
                            </div>
                        </div>

                        {/* Clinic Information Section (read-only) */}
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-primary/10 mb-3">
                                    <Building size={20} className="text-primary" />
                                </div>
                                <h3 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Clinic Information
                                </h3>
                            </div>
                            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                Read-only. Sourced from your account.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Clinic"
                                    placeholder="Metro Cancer Treatment Center"
                                    icon={<Building size={18} />}
                                    error={errors.clinic_name?.message}
                                    disabled
                                    {...register('clinic_name')}
                                />

                                <Input
                                    label="Department"
                                    placeholder="Patient Navigation Services"
                                    icon={<Building size={18} />}
                                    error={errors.clinic_department?.message}
                                    disabled
                                    {...register('clinic_department')}
                                />

                                <Input
                                    label="Address"
                                    placeholder="1234 Medical Plaza, Suite 500, Chicago, IL 60601"
                                    icon={<MapPin size={18} />}
                                    error={errors.clinic_address?.message}
                                    disabled
                                    {...register('clinic_address')}
                                />

                                <Input
                                    label="Fax"
                                    type="tel"
                                    placeholder="(555) 234-5679"
                                    icon={<Printer size={18} />}
                                    error={errors.clinic_fax?.message}
                                    disabled
                                    {...register('clinic_fax')}
                                />
                            </div>
                        </div>
                    </form>
                </div>
            </div>

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
                                Select doctor(s) this staff member will work with. List is loaded from your clinic.
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
                        label="Phone"
                        type="tel"
                        placeholder="(555) 000-0000"
                        icon={<Phone size={18} />}
                        error={staffErrors.phone?.message}
                        {...registerStaff('phone')}
                    />

                    <div className="flex items-center gap-2 mb-4">
                        <input
                            type="checkbox"
                            id="autofill-clinic"
                            checked={watchStaff('autofillClinicInfo') || false}
                            onChange={(e) => setValueStaff('autofillClinicInfo', e.target.checked)}
                            className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                        />
                        <label
                            htmlFor="autofill-clinic"
                            className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                        >
                            Autofill clinic info from my profile
                        </label>
                    </div>

                    {watchStaff('autofillClinicInfo') && (
                        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <Input
                                label="Clinic"
                                value={profile?.clinic_name || 'Clinic name'}
                                icon={<Building size={18} />}
                                disabled
                            />

                            <Input
                                label="Department"
                                value={profile?.clinic_department || 'Department'}
                                icon={<Building size={18} />}
                                disabled
                            />

                            <Input
                                label="Address"
                                value={profile?.clinic_address || 'Clinic address'}
                                icon={<MapPin size={18} />}
                                disabled
                            />

                            <Input
                                label="Fax"
                                value={profile?.clinic_fax || 'Fax number'}
                                icon={<Printer size={18} />}
                                disabled
                            />
                        </div>
                    )}

                    <ModalFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCloseAddStaff}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={isSubmittingStaff || addStaffMutation.isPending}
                        >
                            Add Staff
                        </Button>
                    </ModalFooter>
                </form>
                )}
            </Modal>

            {/* Update Existing Staff Modal */}
            <Modal
                isOpen={showUpdateStaffModal}
                onClose={handleCloseUpdateStaff}
                title="Update Existing Staff"
                titleDescription={editingStaff ? undefined : updateStaffSuccess ? undefined : "Choose a team member below to edit their details."}
                size="lg"
            >
                {updateStaffSuccess ? (
                    <div className="py-4">
                        <div className="flex flex-col items-center text-center space-y-5">
                            <div className={`flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                                <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Staff updated successfully
                                </h3>
                                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Changes have been saved.
                                </p>
                            </div>
                        </div>
                        <ModalFooter className="mt-8">
                            <Button type="button" variant="primary" onClick={handleCloseUpdateStaff}>
                                Close
                            </Button>
                        </ModalFooter>
                    </div>
                ) : !editingStaff ? (
                    <div className="space-y-4">
                        {isLoadingAllStaff ? (
                            <div className={`py-12 flex flex-col items-center justify-center gap-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <p className="text-sm font-medium">Loading staff list...</p>
                            </div>
                        ) : staffMembers.length === 0 ? (
                            <div className={`py-12 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <User size={40} className={`mx-auto mb-3 opacity-50 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                                <p className="text-sm font-medium">No staff members found.</p>
                                <p className="text-xs mt-1 max-w-xs mx-auto">Add staff from the &quot;Add New Staff&quot; option to see them here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto -mx-1 px-0 sm:-mx-2">
                                {staffMembers.map((staff) => (
                                    <button
                                        key={staff.id}
                                        type="button"
                                        onClick={() => handleEditStaff(staff)}
                                        style={{
                                            border: isDark ? '1px solid #64748b' : '1px solid #cbd5e1',
                                        }}
                                        className={`w-full text-left rounded-xl transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 ${
                                            isDark
                                                ? 'bg-slate-800/60 hover:bg-slate-800/80 focus:ring-offset-[#252320]'
                                                : 'bg-white hover:bg-slate-50 focus:ring-offset-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3 p-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-semibold text-[15px] mb-1 truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                    {staff.name}
                                                </h3>
                                                <p className={`text-sm truncate mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                    {staff.email || 'No email'}
                                                </p>
                                                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${
                                                    isDark ? 'bg-slate-700/80 text-slate-300' : 'bg-slate-200/80 text-slate-700'
                                                }`}>
                                                    {staff.role}
                                                </span>
                                            </div>
                                            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-700/80 text-slate-300' : 'bg-slate-200/80 text-slate-600'}`}>
                                                <Edit size={16} aria-hidden />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <ModalFooter className="mt-6">
                            <Button variant="outline" onClick={handleCloseUpdateStaff}>
                                Close
                            </Button>
                        </ModalFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitStaff(handleUpdateStaff)} className="space-y-5">
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            Only <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>full name</strong> and <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>phone</strong> can be edited. Other fields are read-only.
                        </p>

                        <Input
                            label="Role"
                            value={editingStaff?.role ?? ''}
                            icon={<UserCog size={18} />}
                            disabled
                        />

                        <Input
                            label="Full name"
                            placeholder="e.g. Jane Doe"
                            icon={<User size={18} />}
                            error={staffErrors.fullName?.message}
                            {...registerStaff('fullName')}
                        />

                        <Input
                            label="Email"
                            type="email"
                            value={watchStaff('email') ?? editingStaff?.email ?? ''}
                            icon={<Mail size={18} />}
                            disabled
                        />

                        <Input
                            label="Phone"
                            type="tel"
                            placeholder="e.g. (555) 000-0000"
                            icon={<Phone size={18} />}
                            error={staffErrors.phone?.message}
                            {...registerStaff('phone')}
                        />

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className={`text-xs font-medium uppercase tracking-wide mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                Clinic information
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* <Input
                                    label="Clinic name"
                                    value={editingStaff?.clinic || '—'}
                                    icon={<Building size={18} />}
                                    disabled
                                /> */}
                                <Input
                                    label="Department"
                                    value={editingStaff?.department || '—'}
                                    icon={<Building size={18} />}
                                    disabled
                                />
                                {/* <div className="sm:col-span-2">
                                    <Input
                                        label="Address"
                                        value={editingStaff?.address || '—'}
                                        icon={<MapPin size={18} />}
                                        disabled
                                    />
                                </div> */}
                            </div>
                        </div>

                        <ModalFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setEditingStaff(null);
                                    resetStaff();
                                }}
                            >
                                Back
                            </Button>
                            <Button type="submit" variant="primary" loading={isSubmittingStaff || updateStaffProfileMutation.isPending}>
                                Save changes
                            </Button>
                        </ModalFooter>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ProfilePage;

/**
 * OncoLife - Physician Profile Page
 * View and edit physician profile information
 */

import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Phone, Building, MapPin, Printer, User, Edit, Save, X, ChevronDown, UserPlus, Settings, UserCog } from 'lucide-react';
import { Button, Input, Select, Modal, ModalFooter } from '@/components/ui';
import { useUser } from '../../contexts/UserContext';
import { useThemeMode } from '@oncolife/ui-components';

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

// Staff member type
interface StaffMember {
    id: string;
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
    phone: z.string().optional(),
});

type StaffFormValues = z.infer<typeof staffSchema>;

const ProfilePage: React.FC = () => {
    const { profile } = useUser();
    const { isDark } = useThemeMode();
    const [isEditing, setIsEditing] = useState(false);
    
    // Manage Staff states
    const [showManageStaffDropdown, setShowManageStaffDropdown] = useState(false);
    const [showAddStaffModal, setShowAddStaffModal] = useState(false);
    const [showUpdateStaffModal, setShowUpdateStaffModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Static staff data
    const [staffMembers] = useState<StaffMember[]>([
        {
            id: '1',
            name: 'Dr. Smith',
            role: 'Doctor',
            department: 'Oncology',
            email: 'dr.smith@clinic.org',
            phone: '(555) 111-2222',
            clinic: 'Metro Cancer Treatment Center',
            address: '1234 Medical Plaza, Suite 500, Chicago, IL 60601',
            fax: '(555) 111-2223',
        },
        {
            id: '2',
            name: 'Nurse Williams',
            role: 'Nurse',
            department: 'Patient Navigation Services',
            email: 'nurse.williams@clinic.org',
            phone: '(555) 333-4444',
            clinic: 'Metro Cancer Treatment Center',
            address: '1234 Medical Plaza, Suite 500, Chicago, IL 60601',
            fax: '(555) 333-4445',
        },
        {
            id: '3',
            name: 'Amy Torres',
            role: 'Admin',
            department: 'Administration',
            email: 'amy.torres@clinic.org',
            phone: '(555) 555-6666',
            clinic: 'Metro Cancer Treatment Center',
            address: '1234 Medical Plaza, Suite 500, Chicago, IL 60601',
            fax: '(555) 555-6667',
        },
    ]);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || '',
            role: profile?.role || 'Oncology Patient Navigator',
            email: profile?.email || '',
            phone: profile?.phone || '',
            clinic_name: profile?.clinic_name || '',
            clinic_department: profile?.clinic_department || '',
            clinic_address: profile?.clinic_address || '',
            clinic_fax: profile?.clinic_fax || '',
        },
    });

    const onSubmit = async (values: ProfileFormValues) => {
        try {
            // TODO: Call API to update profile
            console.log('Profile update:', values);
            setIsEditing(false);
        } catch (error) {
            console.error('Profile update failed:', error);
        }
    };

    const handleCancel = () => {
        reset();
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
    } = useForm<StaffFormValues & { autofillClinicInfo?: boolean }>({
        resolver: zodResolver(staffSchema),
        defaultValues: {
            role: '',
            fullName: '',
            email: '',
            phone: '',
            autofillClinicInfo: false,
        },
    });

    const handleAddStaff = async (values: StaffFormValues) => {
        try {
            // TODO: Call API to add staff
            console.log('Add staff:', values);
            resetStaff();
            setShowAddStaffModal(false);
        } catch (error) {
            console.error('Add staff failed:', error);
        }
    };

    const handleUpdateStaff = async (values: StaffFormValues) => {
        try {
            // TODO: Call API to update staff
            console.log('Update staff:', values, editingStaff?.id);
            resetStaff();
            setEditingStaff(null);
            setShowUpdateStaffModal(false);
        } catch (error) {
            console.error('Update staff failed:', error);
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
        resetStaff();
        setShowAddStaffModal(false);
    };

    const handleCloseUpdateStaff = () => {
        resetStaff();
        setEditingStaff(null);
        setShowUpdateStaffModal(false);
    };

    // Role options
    const roleOptions = [
        { value: 'Doctor', label: 'Doctor' },
        { value: 'Nurse', label: 'Nurse' },
        { value: 'Admin', label: 'Admin' },
        { value: 'Medical Assistant', label: 'Medical Assistant' },
        { value: 'Patient Navigator', label: 'Patient Navigator' },
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
                                {/* Manage Staff Button */}
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
                                            loading={isSubmitting}
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

                        {/* Clinic Information Section */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-primary/10 mb-3">
                                    <Building size={20} className="text-primary" />
                                </div>
                                <h3 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Clinic Information
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label="Clinic"
                                    placeholder="Metro Cancer Treatment Center"
                                    icon={<Building size={18} />}
                                    error={errors.clinic_name?.message}
                                    disabled={!isEditing}
                                    {...register('clinic_name')}
                                />

                                <Input
                                    label="Department"
                                    placeholder="Patient Navigation Services"
                                    icon={<Building size={18} />}
                                    error={errors.clinic_department?.message}
                                    disabled={!isEditing}
                                    {...register('clinic_department')}
                                />

                                <Input
                                    label="Address"
                                    placeholder="1234 Medical Plaza, Suite 500, Chicago, IL 60601"
                                    icon={<MapPin size={18} />}
                                    error={errors.clinic_address?.message}
                                    disabled={!isEditing}
                                    {...register('clinic_address')}
                                />

                                <Input
                                    label="Fax"
                                    type="tel"
                                    placeholder="(555) 234-5679"
                                    icon={<Printer size={18} />}
                                    error={errors.clinic_fax?.message}
                                    disabled={!isEditing}
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
                            loading={isSubmittingStaff}
                        >
                            Add Staff
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Update Existing Staff Modal */}
            <Modal
                isOpen={showUpdateStaffModal}
                onClose={handleCloseUpdateStaff}
                title="Update Existing Staff"
                titleDescription={editingStaff ? undefined : "Select a staff member to edit"}
                size="lg"
            >
                {!editingStaff ? (
                    <div className="space-y-3">
                        {staffMembers.map((staff) => (
                            <div
                                key={staff.id}
                                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                                    isDark
                                        ? 'border-slate-700 hover:bg-slate-800'
                                        : 'border-slate-200 hover:bg-slate-50'
                                }`}
                                onClick={() => handleEditStaff(staff)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                            {staff.name}
                                        </h3>
                                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {staff.role} · {staff.department}
                                        </p>
                                    </div>
                                    <Edit
                                        size={18}
                                        className={isDark ? 'text-slate-400' : 'text-slate-600'}
                                    />
                                </div>
                            </div>
                        ))}
                        <ModalFooter>
                            <Button
                                variant="outline"
                                onClick={handleCloseUpdateStaff}
                            >
                                Close
                            </Button>
                        </ModalFooter>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitStaff(handleUpdateStaff)} className="space-y-4">
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
                                id="autofill-clinic-edit"
                                checked={watchStaff('autofillClinicInfo') || false}
                                onChange={(e) => setValueStaff('autofillClinicInfo', e.target.checked)}
                                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                            />
                            <label
                                htmlFor="autofill-clinic-edit"
                                className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                            >
                                Autofill clinic info from my profile
                            </label>
                        </div>

                        {watchStaff('autofillClinicInfo') && (
                            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <Input
                                    label="Clinic"
                                    value={profile?.clinic_name || editingStaff.clinic || 'Clinic name'}
                                    icon={<Building size={18} />}
                                    disabled
                                />

                                <Input
                                    label="Department"
                                    value={profile?.clinic_department || editingStaff.department || 'Department'}
                                    icon={<Building size={18} />}
                                    disabled
                                />

                                <Input
                                    label="Address"
                                    value={profile?.clinic_address || editingStaff.address || 'Clinic address'}
                                    icon={<MapPin size={18} />}
                                    disabled
                                />

                                <Input
                                    label="Fax"
                                    value={profile?.clinic_fax || editingStaff.fax || 'Fax number'}
                                    icon={<Printer size={18} />}
                                    disabled
                                />
                            </div>
                        )}

                        <ModalFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setEditingStaff(null);
                                    resetStaff();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={isSubmittingStaff}
                            >
                                Update Staff
                            </Button>
                        </ModalFooter>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ProfilePage;

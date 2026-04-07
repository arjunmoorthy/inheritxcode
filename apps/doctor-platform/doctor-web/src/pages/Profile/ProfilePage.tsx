import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Phone, Building, MapPin, Printer, User, Edit, Save, X, CheckCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useUser } from '../../contexts/UserContext';
import { useThemeMode } from '@oncolife/ui-components';
import { useCurrentStaffProfile, useUpdateStaffProfile } from '../../services/staff';

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

const ProfilePage: React.FC = () => {
    const { profile, updateProfile } = useUser();
    const { isDark } = useThemeMode();
    const updateStaffProfileMutation = useUpdateStaffProfile();
    const { data: apiProfile } = useCurrentStaffProfile(true);
    const [isEditing, setIsEditing] = useState(false);
    const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
    const lastLoggedProfileRef = useRef<string>('');
    const lastSyncedProfileRef = useRef<string>('');

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

    // Prefill form with profile from localStorage when profile loads
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

    // Prefill and persist profile from GET /api/v1/staff/profile
    useEffect(() => {
        if (!apiProfile) return;
        const snapshot = JSON.stringify(apiProfile);
        if (lastSyncedProfileRef.current === snapshot) return;
        lastSyncedProfileRef.current = snapshot;
        if (lastLoggedProfileRef.current !== snapshot) lastLoggedProfileRef.current = snapshot;
        updateProfile({
            staff_id: apiProfile.staff_id,
            first_name: apiProfile.first_name,
            last_name: apiProfile.last_name,
            role: apiProfile.role,
            email: apiProfile.email,
            phone: apiProfile.phone,
            clinic_name: apiProfile.clinic_name,
            clinic_department: apiProfile.clinic_department,
            clinic_address: apiProfile.clinic_address,
            clinic_fax: apiProfile.clinic_fax,
        });
        reset({
            first_name: apiProfile.first_name,
            last_name: apiProfile.last_name,
            role: apiProfile.role || 'Oncology Patient Navigator',
            email: apiProfile.email,
            phone: apiProfile.phone,
            clinic_name: apiProfile.clinic_name,
            clinic_department: apiProfile.clinic_department,
            clinic_address: apiProfile.clinic_address,
            clinic_fax: apiProfile.clinic_fax,
        });
    }, [apiProfile, reset, updateProfile]);

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
            const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
            const r = profile.role?.toLowerCase();
            const isDoctor = r === 'doctor' || r === 'physician';
            return fullName ? (isDoctor ? `Dr. ${fullName}` : fullName) : isDoctor ? 'Doctor' : 'User';
        }
        return 'User';
    };

    // Auto-hide profile save success message after 4 seconds
    useEffect(() => {
        if (!profileSaveSuccess) return;
        const t = setTimeout(() => setProfileSaveSuccess(false), 4000);
        return () => clearTimeout(t);
    }, [profileSaveSuccess]);

    return (
        <div className={`p-4 md:p-8 transition-colors ${isDark ? 'bg-[#1A1917]' : 'bg-gradient-to-br from-white to-slate-50'}`}>
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Profile</h1>
                    <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Manage your account information</p>
                </div>

                {profileSaveSuccess && (
                    <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-3 border ${isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`} role="status">
                        <CheckCircle size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-medium">Profile updated successfully.</span>
                    </div>
                )}

                <div className={`rounded-2xl shadow-lg overflow-hidden mb-6 transition-colors ${isDark ? 'bg-[#2A2725]' : 'bg-white'}`}>
                    <div className="bg-gradient-to-r from-primary to-primary-dark p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-6 text-center sm:text-left">
                                <div className="w-24 h-24 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center text-white text-3xl font-bold shadow-xl">
                                    {getInitials()}
                                </div>
                                <div className="text-white">
                                    <h2 className={`text-2xl md:text-3xl font-bold mb-1 text-white`}>{getUserName()}</h2>
                                    <p className="text-white/80 text-lg">{profile?.role || 'Oncology Patient Navigator'}</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
                                {!isEditing ? (
                                    <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/30 py-2.5 px-4 w-full sm:w-auto">
                                        <Edit size={16} className="mr-2" />Edit Profile
                                    </Button>
                                ) : (
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-start">
                                        <Button variant="secondary" size="sm" onClick={handleCancel} className="bg-white/20 hover:bg-white/30 text-white border-white/30 py-2.5 px-4 flex-1 sm:flex-none">
                                            <X size={16} className="mr-2" />Cancel
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting || updateStaffProfileMutation.isPending} className="bg-secondary hover:bg-secondary-dark py-2.5 px-4 flex-1 sm:flex-none">
                                            <Save size={16} className="mr-2" />Save
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8">
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-primary/10 mb-3">
                                    <User size={20} className="text-primary" />
                                </div>
                                <h3 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>Contact Information</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="First Name" placeholder="John" icon={<User size={18} />} error={errors.first_name?.message} disabled={!isEditing} {...register('first_name')} />
                                <Input label="Last Name" placeholder="Doe" icon={<User size={18} />} error={errors.last_name?.message} disabled={!isEditing} {...register('last_name')} />
                                <Input label="Email" type="email" placeholder="doctor@clinic.com" icon={<Mail size={18} />} error={errors.email?.message} disabled={!isEditing} {...register('email')} />
                                <Input label="Phone *" type="tel" placeholder="(555) 234-5678" icon={<Phone size={18} />} error={errors.phone?.message} disabled={!isEditing} {...register('phone')} />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-primary/10 mb-3">
                                    <Building size={20} className="text-primary" />
                                </div>
                                <h3 className={`text-xl font-bold leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>Clinic Information</h3>
                            </div>
                            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Read-only. Sourced from your account.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Clinic" placeholder="Metro Cancer Treatment Center" icon={<Building size={18} />} disabled {...register('clinic_name')} />
                                <Input label="Department" placeholder="Patient Navigation Services" icon={<Building size={18} />} disabled {...register('clinic_department')} />
                                <Input label="Address" placeholder="1234 Medical Plaza, Suite 500, Chicago, IL 60601" icon={<MapPin size={18} />} disabled {...register('clinic_address')} />
                                <Input label="Fax" type="tel" placeholder="(555) 234-5679" icon={<Printer size={18} />} disabled {...register('clinic_fax')} />
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;

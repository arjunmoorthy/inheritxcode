/**
 * OncoLife - Physician Profile Page
 * View and edit physician profile information
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Phone, Building, MapPin, Printer, User, Edit, Save, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
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

const ProfilePage: React.FC = () => {
    const { profile } = useUser();
    const { isDark } = useThemeMode();
    const [isEditing, setIsEditing] = useState(false);

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
                                    <h2 className="text-2xl md:text-3xl font-bold mb-1">{getUserName()}</h2>
                                    <p className="text-white/80 text-lg">{profile?.role || 'Oncology Patient Navigator'}</p>
                                </div>
                            </div>

                            <div className="flex justify-center sm:justify-start">
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
        </div>
    );
};

export default ProfilePage;

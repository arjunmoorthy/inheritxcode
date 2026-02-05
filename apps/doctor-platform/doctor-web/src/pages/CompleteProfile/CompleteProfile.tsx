import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Activity, CheckCircle, MapPin, Building, Stethoscope, Briefcase, UserCheck, User } from 'lucide-react';
import { useCompleteProfile } from '../../services/login';
import { Button, Input, Select } from '@/components/ui';
import { useThemeMode } from '@oncolife/ui-components';
import { useAuth } from '../../contexts/AuthContext';

const completeProfileSchema = z.object({
    role: z.string().min(1, 'Role is required'),
    clinic_name: z.string().min(1, 'Clinic name is required'),
    department: z.string().min(1, 'Department is required'),
    clinic_address: z.string().min(1, 'Clinic address is required'),
    clinic_uuid: z.string().min(1, 'Clinic UUID is required'),
});

type CompleteProfileValues = z.infer<typeof completeProfileSchema>;

const roleOptions = [
    { value: 'doctor', label: 'Doctor' },
    { value: 'nurse', label: 'Nurse' },
    { value: 'staff', label: 'Staff' },
    { value: 'admin', label: 'Administrator' },
];

const CompleteProfile: React.FC = () => {
    const [searchParams] = useSearchParams();
    const staffId = searchParams.get('staff_id');
    const urlFirstName = searchParams.get('first_name') || '';
    const urlLastName = searchParams.get('last_name') || '';

    const [serverError, setServerError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const { isDark } = useThemeMode();
    const { } = useAuth();
    const navigate = useNavigate();
    const completeProfileMutation = useCompleteProfile();

    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isSubmitting },
    } = useForm<CompleteProfileValues>({
        resolver: zodResolver(completeProfileSchema),
        defaultValues: {
            role: 'staff',
            clinic_uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' // Default UUID provided in spec
        }
    });

    const onSubmit = async (values: CompleteProfileValues) => {
        setServerError(null);
        try {
            const payload = {
                ...values,
                staff_id: parseInt(staffId || '0', 10),
            };
            const result = await completeProfileMutation.mutateAsync(payload);

            // Backend returns the established profile on success
            if (result.staff_uuid) {
                setIsSuccess(true);
                setTimeout(() => navigate('/dashboard'), 2000);
            } else {
                setServerError('Failed to complete profile.');
            }
        } catch (err: any) {
            setServerError(err.message || 'An error occurred.');
        }
    };

    return (
        <div className={`min-h-screen lg:h-screen flex flex-col lg:flex-row transition-colors duration-500 overflow-x-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
            {/* Left Brand Panel */}
            <div className="flex-1 flex flex-col justify-center items-center px-8 lg:px-12 py-16 lg:py-0 bg-[#1E3A5F] relative overflow-hidden min-h-[300px] lg:min-h-0 lg:h-full">
                {/* Visual Elements */}
                <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
                    <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500 rounded-full blur-[120px]" />
                </div>

                {/* Mesh pattern overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
                />

                <div className="relative z-10 text-center max-w-lg animate-fade-in px-4">
                    {/* Logo Section */}
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-2xl">
                        <Activity size={32} className="text-white animate-pulse-soft" />
                    </div>

                    <h1 className="text-2xl md:text-4xl font-bold mb-3 tracking-tight font-serif text-white">
                        OncoLife
                    </h1>

                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mb-6 font-sans">
                        <span className="text-[10px] md:text-xs font-medium text-blue-100 uppercase tracking-widest">
                            Physician Portal
                        </span>
                    </div>

                    <p className="text-sm md:text-base text-blue-50/70 leading-relaxed max-w-xs mx-auto hidden md:block font-light">
                        Advanced clinical monitoring & symptom management for oncology care teams.
                    </p>

                    {/* Profile Completion Card */}
                    {/* <div className="mt-8 hidden lg:block">
                        <div className="bg-white/5 backdrop-blur-md rounded-2xl py-8 px-10 p-6 border border-white/10 shadow-xl">
                            <div className="flex items-center justify-center mb-4">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center border-2 border-white/20 shadow-lg">
                                    <UserCheck size={32} className="text-white" />
                                </div>
                            </div>
                            <h3 className="text-white font-semibold text-lg mb-1">Complete Your Profile</h3>
                            <p className="text-blue-100/80 text-sm mb-4">Finish setting up your account</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-blue-100/90 text-xs">
                                    <UserCheck size={14} className="text-blue-300" />
                                    <span>Professional Setup</span>
                                </div>
                                <div className="flex items-center gap-2 text-blue-100/90 text-xs">
                                    <Activity size={14} className="text-teal-300" />
                                    <span>Quick & Secure</span>
                                </div>
                            </div>
                        </div>
                    </div> */}
                </div>
            </div>

            {/* Right Form Panel */}
            <div className={`flex-[1.3] flex flex-col lg:h-full transition-colors duration-500 overflow-y-auto ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
                <div className="flex-1 flex flex-col justify-start items-center px-4 py-8 md:px-12 lg:py-12">
                    <div className={`w-full max-w-2xl animate-fade-in transition-all duration-300 ${isDark
                        ? 'bg-[#2A2725] border border-[#3A3835] shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
                        : 'bg-white border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.04)]'
                        } rounded-3xl overflow-hidden`}>

                        <div className="p-8 md:p-10 lg:p-12">
                            {/* Title Header */}
                            <div className="text-center mb-8">
                                <h2 className={`text-xl md:text-2xl font-bold mb-2 font-serif transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    Complete Your Profile
                                </h2>
                                <p className={`text-[13px] md:text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Just a few more details to set up your practice account
                                </p>
                            </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="First Name"
                                value={urlFirstName}
                                readOnly
                                disabled
                                icon={<User size={16} />}
                            />
                            <Input
                                label="Last Name"
                                value={urlLastName}
                                readOnly
                                disabled
                                icon={<User size={16} />}
                            />
                        </div>

                        <Controller
                            name="role"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    label="Your Professional Role"
                                    options={roleOptions}
                                    placeholder="Select your role"
                                    error={errors.role?.message}
                                    value={roleOptions.find(option => option.value === field.value)}
                                    onChange={(option: any) => field.onChange(option?.value || '')}
                                />
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Clinic Name"
                                placeholder="City Healthcare Center"
                                icon={<Building size={16} />}
                                error={errors.clinic_name?.message}
                                {...register('clinic_name')}
                            />
                            <Input
                                label="Department"
                                placeholder="Oncology"
                                icon={<Stethoscope size={16} />}
                                error={errors.department?.message}
                                {...register('department')}
                            />
                        </div>

                        <Input
                            label="Clinic Address"
                            placeholder="123 Medical Plaza, Suite 400"
                            icon={<MapPin size={16} />}
                            error={errors.clinic_address?.message}
                            {...register('clinic_address')}
                        />

                        <Input
                            label="Clinic UUID"
                            placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                            icon={<Briefcase size={16} />}
                            error={errors.clinic_uuid?.message}
                            {...register('clinic_uuid')}
                        />

                        <div className="pt-4">
                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                size="md"
                                loading={isSubmitting}
                                disabled={isSuccess}
                            >
                                {isSuccess ? 'Profile Completed!' : 'Complete Setup'}
                            </Button>

                            {serverError && (
                                <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-sm flex items-center gap-2">
                                    <Activity size={16} />
                                    {serverError}
                                </div>
                            )}

                            {isSuccess && (
                                <div className="mt-4 p-3 rounded-xl bg-emerald-900/20 border border-emerald-800/40 text-emerald-400 text-sm flex items-center gap-2">
                                    <CheckCircle size={16} />
                                    Account set up successfully! Redirecting to dashboard...
                                </div>
                            )}
                        </div>
                    </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfile;

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Activity, CheckCircle, Mail, User, Lock, ShieldCheck, Building, MapPin, Stethoscope, Briefcase, UserCircle, Sparkles } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useSignup, useGoogleSSOSignup } from '../../services/login';
import { Button, Input, Select } from '@/components/ui';

import { useThemeMode } from '@oncolife/ui-components';

// Validation Schema
const signupSchema = z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Please enter a valid email address'),
    role: z.string().min(1, 'Role is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Confirm password is required'),
    clinic_uuid: z.string().optional().or(z.literal('')),
    clinic_name: z.string().min(1, 'Clinic name is required'),
    department: z.string().min(1, 'Department is required'),
    clinic_address: z.string().min(1, 'Clinic address is required'),
}).refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

const roleOptions = [
    { value: 'doctor', label: 'Doctor' },
    { value: 'nurse', label: 'Nurse' },
    { value: 'staff', label: 'Staff' },
    { value: 'admin', label: 'Administrator' },
];

const SignUpPage: React.FC = () => {
    const [serverError, setServerError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const { isDark } = useThemeMode();

    const signupMutation = useSignup();
    const googleSSOMutation = useGoogleSSOSignup();
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isSubmitting },
    } = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            role: 'staff',
        }
    });

    const onSignupSubmit = async (values: SignupFormValues) => {
        setServerError(null);
        setSuccessMessage(null);
        try {
            const signupData = {
                ...values,
                clinic_uuid: values.clinic_uuid || '',
            };
            const result = await signupMutation.mutateAsync(signupData as any);
            if (result.success || (result as any).created) {
                setIsSuccess(true);
                setSuccessMessage(result.message || 'User provisioned successfully');
            } else {
                setServerError(result.message || 'Registration failed. Please try again.');
            }
        } catch (err: any) {
            setServerError(err.message || 'An error occurred during registration.');
        }
    };

    return (
        <div className={`min-h-screen lg:h-screen flex flex-col lg:flex-row transition-colors duration-500 overflow-x-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'
            }`}>
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

                </div>
            </div>

            {/* Right Form Panel */}
            <div className={`flex-[1.3] flex flex-col lg:h-full transition-colors duration-500 overflow-y-auto ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'
                }`}>
                <div className="flex-1 flex flex-col justify-start items-center px-4 py-8 md:px-12 lg:py-12">
                    <div className={`w-full max-w-2xl animate-fade-in transition-all duration-300 ${isDark
                        ? 'bg-[#2A2725] border border-[#3A3835] shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
                        : 'bg-white border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.04)]'
                        } rounded-3xl overflow-hidden`}>

                        <div className="p-8 md:p-10 lg:p-12">
                            {/* Title Header */}
                            <div className="text-center mb-8">
                                <h2 className={`text-xl md:text-2xl font-bold mb-2 font-serif transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'
                                    }`}>
                                    Create Physician Account
                                </h2>
                                <p className={`text-[13px] md:text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'
                                    }`}>
                                    Join our clinical monitoring dashboard
                                </p>
                            </div>

                            <form onSubmit={handleSubmit(onSignupSubmit)} className="space-y-6">
                                {/* Section: Personal Details */}
                                <div>
                                    <h3 className={`text-[11px] font-bold uppercase tracking-[0.1em] mb-4 flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                                        <UserCircle size={14} />
                                        Personal Information
                                    </h3>
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-5 gap-y-4">
                                        <Input
                                            label="First Name"
                                            placeholder="John"
                                            icon={<User size={16} />}
                                            error={errors.first_name?.message}
                                            {...register('first_name')}
                                        />

                                        <Input
                                            label="Last Name"
                                            placeholder="Doe"
                                            icon={<User size={16} />}
                                            error={errors.last_name?.message}
                                            {...register('last_name')}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                                        <Input
                                            label="Email Address"
                                            type="email"
                                            placeholder="physician@clinic.com"
                                            icon={<Mail size={16} />}
                                            error={errors.email?.message}
                                            {...register('email')}
                                        />

                                        <Controller
                                            name="role"
                                            control={control}
                                            render={({ field }) => (
                                                <Select
                                                    label="Role"
                                                    options={roleOptions}
                                                    placeholder="Select your role"
                                                    error={errors.role?.message}
                                                    value={roleOptions.find(option => option.value === field.value)}
                                                    onChange={(option: any) => field.onChange(option?.value || '')}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Section: Security */}
                                <div>
                                    <h3 className={`text-[11px] font-bold uppercase tracking-[0.1em] mb-3 flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                                        Account Security
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                                        <Input
                                            label="Password"
                                            type="password"
                                            placeholder="••••••••"
                                            icon={<Lock size={16} />}
                                            error={errors.password?.message}
                                            {...register('password')}
                                        />

                                        <Input
                                            label="Confirm Password"
                                            type="password"
                                            placeholder="••••••••"
                                            icon={<ShieldCheck size={16} />}
                                            error={errors.confirm_password?.message}
                                            {...register('confirm_password')}
                                        />
                                    </div>
                                </div>

                                {/* Section: Clinic Details */}
                                <div>
                                    <h3 className={`text-[11px] font-bold uppercase tracking-[0.1em] mb-3 flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                                        Practice Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                                        <Input
                                            label="Clinic ID (Optional)"
                                            placeholder="3fa85f64-..."
                                            icon={<Briefcase size={16} />}
                                            error={errors.clinic_uuid?.message}
                                            {...register('clinic_uuid')}
                                        />

                                        <Input
                                            label="Clinic Name"
                                            placeholder="City General Hospital"
                                            icon={<Building size={16} />}
                                            error={errors.clinic_name?.message}
                                            {...register('clinic_name')}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                                        <Input
                                            label="Department"
                                            placeholder="Oncology"
                                            icon={<Stethoscope size={16} />}
                                            error={errors.department?.message}
                                            {...register('department')}
                                        />

                                        <Input
                                            label="Clinic Address"
                                            placeholder="123 Medical Dr."
                                            icon={<MapPin size={16} />}
                                            error={errors.clinic_address?.message}
                                            {...register('clinic_address')}
                                        />
                                    </div>
                                </div>

                                {/* Submit Button & Results */}
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || isSuccess}
                                        className={`group relative w-full overflow-hidden rounded-xl font-bold text-[15px] transition-all duration-300 ${
                                          isSubmitting || isSuccess
                                            ? 'opacity-60 cursor-not-allowed'
                                            : 'hover:scale-[1.02] active:scale-[0.98]'
                                        } bg-[#1E3A5F] text-white shadow-lg hover:shadow-xl hover:bg-[#1a4a7f] py-3.5 px-6 flex items-center justify-center gap-2`}
                                    >
                                        {isSubmitting ? (
                                          <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Creating Account...</span>
                                          </>
                                        ) : isSuccess ? (
                                          <>
                                            <CheckCircle size={18} className="shrink-0" />
                                            <span>Registration Complete</span>
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles size={18} className="shrink-0 group-hover:rotate-12 transition-transform" />
                                            <span>Complete Registration</span>
                                          </>
                                        )}
                                    </button>

                                    {/* Status Feedback (Error/Success) below button */}
                                    {(serverError || isSuccess) && (
                                        <div className={`mt-4 px-4 py-3 rounded-xl text-[13px] flex items-center gap-3 animate-fade-in border ${isSuccess
                                            ? (isDark ? 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
                                            : (isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : 'bg-red-50 border-red-200 text-red-600')
                                            }`}>
                                            {isSuccess ? <CheckCircle size={18} className="shrink-0" /> : <Activity size={18} className="shrink-0" />}
                                            <p className="font-medium !mb-0">
                                                {isSuccess
                                                    ? successMessage || "Registration successful! Please check your email to verify your account."
                                                    : serverError}
                                            </p>
                                        </div>
                                    )}

                                    {isSuccess && (
                                        <div className="mt-4 animate-fade-in">
                                            <Button variant="outline" fullWidth onClick={() => navigate('/login')} size="md">
                                                Go to Sign In
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </form>

                            {/* Divider */}
                            {!isSuccess && (
                                <div className="mt-8">
                                    <div className="relative mb-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className={`w-full border-t border ${isDark ? 'border-[#3A3835]' : 'border-slate-300'}`}></div>
                                        </div>
                                        <div className="relative flex justify-center text-[11px] uppercase">
                                            <span className={`px-4 font-bold tracking-widest ${isDark ? 'bg-[#2A2725] text-slate-500' : 'bg-white text-slate-500'
                                                }`}>
                                                Or continue with
                                            </span>
                                        </div>
                                    </div>

                                    {/* Google Sign Up */}
                                    <div className="flex justify-center">
                                        <GoogleLogin
                                            onSuccess={async (credentialResponse) => {
                                                if (credentialResponse.credential) {
                                                    try {
                                                        const result = await googleSSOMutation.mutateAsync({
                                                            id_token: credentialResponse.credential
                                                        });

                                                        if (result.created || result.message.includes('exists')) {
                                                            // Logic for success
                                                            setSuccessMessage(result.message);
                                                            setIsSuccess(true);

                                                            // In a real app, you might want to redirect to /complete-profile 
                                                            // if result.created is true, or /dashboard if false.
                                                            setTimeout(() => {
                                                                if (result.created) {
                                                                    navigate(`/complete-profile?staff_id=${result.staff_id}&email=${result.email}`);
                                                                } else {
                                                                    navigate('/dashboard');
                                                                }
                                                            }, 1500);
                                                        }
                                                    } catch (err: any) {
                                                        setServerError(err.response?.data?.detail || 'Google authentication failed');
                                                    }
                                                }
                                            }}
                                            onError={() => {
                                                setServerError('Google Login Failed');
                                            }}
                                            useOneTap
                                            theme={isDark ? 'filled_black' : 'outline'}
                                            shape="pill"
                                            width="100%"
                                        />
                                    </div>

                                    {/* Sign In Link */}
                                    <div className={`mt-6 text-center text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'
                                        }`}>
                                        Already have an account?
                                        <Link to="/login" className="link-primary ml-2 font-bold text-secondary">
                                            Sign In
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;

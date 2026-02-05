/**
 * OncoLife - Physician Registration Page
 * Create new physician account
 * Using reusable UI components
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, User, Building, Activity, CheckCircle } from 'lucide-react';
import { useSignup, googleLogin } from '../../services/login';
import { Button, Input, Select } from '@/components/ui';

import { useThemeMode } from '@oncolife/ui-components';

// Validation Schema
const signupSchema = z.object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().min(1, 'Last name is required'),
    email: z.string().email('Please enter a valid email address'),
    role: z.string().min(1, 'Role is required'),
    clinic_uuid: z.string().min(1, 'Clinic ID is required'),
});

type SignupFormValues = z.infer<typeof signupSchema>;

const roleOptions = [
    { value: 'doctor', label: 'Doctor' },
    { value: 'nurse', label: 'Nurse' },
    { value: 'admin', label: 'Administrator' },
];

const SignUpPage: React.FC = () => {
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const { isDark } = useThemeMode();

    const signupMutation = useSignup();
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        control,
        formState: { errors, isSubmitting },
    } = useForm<SignupFormValues>({
        resolver: zodResolver(signupSchema),
    });

    const onSignupSubmit = async (values: SignupFormValues) => {
        setServerError(null);
        try {
            const result = await signupMutation.mutateAsync(values);
            if (result.success) {
                setIsSuccess(true);
            } else {
                setServerError(result.message || 'Registration failed. Please try again.');
            }
        } catch (err: any) {
            setServerError(err.message || 'An error occurred during registration.');
        }
    };

    return (
        <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-gradient-to-br from-primary/5 to-secondary/5'
            }`}>
            {/* Left Brand Panel */}
            <div className="flex-1 flex flex-col justify-center items-center px-12 py-12 md:py-0 bg-gradient-to-br from-primary to-primary-dark text-white relative overflow-hidden min-h-[180px] md:min-h-0">
                {/* Background decorative elements */}
                <div className="absolute -top-[30%] -right-[20%] w-[60%] h-[60%] bg-secondary/25 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-[20%] -left-[20%] w-[60%] h-[60%] bg-accent/15 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 text-center max-w-md">
                    {/* Logo */}
                    <div className="w-18 h-18 md:w-[72px] md:h-[72px] rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto mb-5 md:mb-3 border border-white/20">
                        <Activity size={32} className="text-white" />
                    </div>

                    <h1 className="text-2xl md:text-4xl font-bold mb-2 tracking-tight font-serif">
                        OncoLife
                    </h1>

                    <p className="text-base md:text-lg opacity-85 mb-6 md:mb-0 font-medium">
                        Physician Portal
                    </p>

                    <p className="text-sm opacity-70 leading-relaxed hidden md:block">
                        Join our clinical dashboard for oncology care teams.<br />
                        Monitor patient symptoms, trends, and escalations.
                    </p>
                </div>
            </div>

            {/* Right Form Panel */}
            <div className={`flex-1 flex flex-col justify-center items-center px-5 py-8 md:px-6 md:py-12 transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-background'
                }`}>
                <div className={`w-full max-w-2xl card-elevated animate-fade-in px-9 py-9 md:px-5 md:py-6 transition-colors duration-300 ${isDark ? 'bg-[#2A2725] border border-[#3A3835]' : 'bg-white'
                    }`}>
                    {/* Title */}
                    <h2 className={`text-2xl md:text-xl font-bold mb-2 text-center font-serif transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'
                        }`}>
                        Create Physician Account
                    </h2>

                    <p className={`text-sm mb-7 text-center leading-relaxed transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                        Register to access the clinical monitoring dashboard
                    </p>

                    {isSuccess ? (
                        <div className="text-center py-2.5">
                            <div className={`bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-4 rounded-lg text-sm mb-6 flex flex-col items-center text-center gap-3 animate-fade-in ${isDark ? 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400' : ''
                                }`}>
                                <CheckCircle size={32} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                                <p>
                                    Registration Successful! Please check your email to verify your account before signing in.
                                </p>
                            </div>

                            <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
                                Go to Sign In
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSignupSubmit)}>
                            {/* Server Error */}
                            {serverError && (
                                <div className={`bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-lg text-[13px] mb-4 flex items-center gap-2 animate-fade-in ${isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : ''
                                    }`}>
                                    <Activity size={16} />
                                    {serverError}
                                </div>
                            )}

                            {/* Name Fields - Two Column Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                <Input
                                    label="First Name"
                                    placeholder="John"
                                    icon={<User size={18} />}
                                    error={errors.first_name?.message}
                                    {...register('first_name')}
                                />

                                <Input
                                    label="Last Name"
                                    placeholder="Doe"
                                    icon={<User size={18} />}
                                    error={errors.last_name?.message}
                                    {...register('last_name')}
                                />
                            </div>

                            {/* Email */}
                            <Input
                                label="Email Address"
                                type="email"
                                placeholder="physician@clinic.com"
                                icon={<Mail size={18} />}
                                error={errors.email?.message}
                                {...register('email')}
                            />

                            {/* Role - Using Controller for react-select */}
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

                            {/* Clinic UUID */}
                            <Input
                                label="Clinic ID"
                                placeholder="Enter clinic UUID"
                                icon={<Building size={18} />}
                                helperText="Contact your clinic administrator for this ID"
                                error={errors.clinic_uuid?.message}
                                {...register('clinic_uuid')}
                            />

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                loading={isSubmitting}
                            >
                                {isSubmitting ? 'Registering...' : 'Register as Physician'}
                            </Button>
                        </form>
                    )}

                    {/* Divider */}
                    {!isSuccess && (
                        <>
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className={`w-full border-t transition-colors duration-300 ${isDark ? 'border-[#3A3835]' : 'border-slate-200'}`}></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className={`px-3 font-medium tracking-wide transition-colors duration-300 ${isDark ? 'bg-[#2A2725] text-slate-500' : 'bg-white text-slate-500'
                                        }`}>
                                        Or continue with
                                    </span>
                                </div>
                            </div>

                            {/* Google Sign Up */}
                            <button
                                onClick={googleLogin}
                                type="button"
                                className={`w-full px-6 py-3 text-[15px] font-medium rounded-lg cursor-pointer transition-smooth flex items-center justify-center gap-3 hover-lift ${isDark
                                        ? 'bg-[#1A1917] border border-[#3A3835] text-slate-300 hover:bg-[#3A3835]'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-background hover:border-secondary/40'
                                    }`}
                            >
                                <img
                                    src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
                                    alt="Google"
                                    className="w-5 h-5"
                                />
                                Sign up with Google
                            </button>

                            {/* Sign In Link */}
                            <div className={`mt-6 text-center text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                Already have an account?
                                <Link to="/login" className="link-primary ml-1.5">
                                    Sign In
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;

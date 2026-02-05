/**
 * OncoLife - Reset Password Page
 * Password reset with token verification
 * Using reusable UI components
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, Activity, CheckCircle, Loader } from 'lucide-react';
import { useVerifyResetToken, useResetPassword } from '../../services/login';
import { Button, Input } from '@/components/ui';

import { useThemeMode } from '@oncolife/ui-components';

// Validation Schema
const resetPasswordSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const ResetPasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const { isDark } = useThemeMode();

    const verifyTokenMutation = useVerifyResetToken();
    const resetPasswordMutation = useResetPassword();
    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(resetPasswordSchema),
    });

    // Verify token on mount
    useEffect(() => {
        const verifyToken = async () => {
            if (!token) {
                setError('Invalid or missing reset token');
                setIsVerifying(false);
                return;
            }

            try {
                const result = await verifyTokenMutation.mutateAsync({ token });
                if (result.success) {
                    setTokenValid(true);
                } else {
                    setError('Invalid or expired reset token');
                }
            } catch (err: any) {
                setError('Unable to verify reset token');
            } finally {
                setIsVerifying(false);
            }
        };

        verifyToken();
    }, [token]);

    const onResetSubmit = async (values: ResetPasswordFormValues) => {
        if (!token) return;

        setError(null);
        try {
            const result = await resetPasswordMutation.mutateAsync({
                token,
                new_password: values.password,
            });

            if (result.success) {
                setIsSuccess(true);
            } else {
                setError(result.message || 'Failed to reset password');
            }
        } catch (err: any) {
            setError('An error occurred while resetting your password');
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
                        Secure password reset for your account.<br />
                        Maintain access to your clinical dashboard.
                    </p>
                </div>
            </div>

            {/* Right Login Panel */}
            <div className={`flex-1 flex flex-col justify-center items-center px-5 py-8 md:px-6 md:py-12 transition-colors duration-300 ${isDark ? 'bg-[#1A1917]' : 'bg-background'
                }`}>
                <div className={`w-full max-w-md card-elevated animate-fade-in px-9 py-9 md:px-5 md:py-6 transition-colors duration-300 ${isDark ? 'bg-[#2A2725] border border-[#3A3835]' : 'bg-white'
                    }`}>
                    {/* Title */}
                    <h2 className={`text-2xl md:text-xl font-bold mb-2 text-center font-serif transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'
                        }`}>
                        Reset Your Password
                    </h2>

                    <p className={`text-sm mb-7 text-center leading-relaxed transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                        Enter your new password below
                    </p>

                    {/* Verifying State */}
                    {isVerifying ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Loader size={32} className="text-secondary animate-spin mb-4" />
                            <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>Verifying reset token...</p>
                        </div>
                    ) : !tokenValid ? (
                        /* Error State */
                        <>
                            <div className={`bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-lg text-[13px] mb-4 flex items-center gap-2 animate-fade-in ${isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : ''
                                }`}>
                                <AlertCircle size={16} />
                                {error}
                            </div>

                            <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
                                Return to Sign In
                            </Button>
                        </>
                    ) : isSuccess ? (
                        /* Success State */
                        <>
                            <div className={`bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-4 rounded-lg text-sm mb-6 flex flex-col items-center text-center gap-3 animate-fade-in ${isDark ? 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400' : ''
                                }`}>
                                <CheckCircle size={32} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                                <p>
                                    Your password has been reset successfully. You can now use your new password to sign in.
                                </p>
                            </div>

                            <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
                                Proceed to Sign In
                            </Button>
                        </>
                    ) : (
                        /* Reset Password Form */
                        <form onSubmit={handleSubmit(onResetSubmit)}>
                            {/* Error Message */}
                            {error && (
                                <div className={`bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-lg text-[13px] mb-4 flex items-center gap-2 animate-fade-in ${isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : ''
                                    }`}>
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            {/* New Password Field */}
                            <Input
                                label="New Password"
                                type="password"
                                placeholder="Enter new password"
                                error={errors.password?.message}
                                autoComplete="new-password"
                                {...register('password')}
                            />

                            {/* Confirm Password Field */}
                            <Input
                                label="Confirm Password"
                                type="password"
                                placeholder="Confirm new password"
                                error={errors.confirmPassword?.message}
                                autoComplete="new-password"
                                {...register('confirmPassword')}
                            />

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                variant="primary"
                                fullWidth
                                loading={isSubmitting}
                            >
                                {isSubmitting ? 'Updating...' : 'Reset Password'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;

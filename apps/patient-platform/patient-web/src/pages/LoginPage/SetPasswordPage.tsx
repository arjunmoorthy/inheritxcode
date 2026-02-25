/**
 * OncoLife Ruby - Set Password Page
 * "Compassionate Care, Intelligent Triage"
 *
 * First-time / staff-created account: mandatory password change.
 * User has logged in with temporary password and must set a new one.
 * Enhanced with Tailwind CSS and dark mode support.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, Activity, CheckCircle, Info } from 'lucide-react';
import { useChangePassword } from '../../services/login';
import { Input } from '../../components/ui';
import { useThemeMode } from '@oncolife/ui-components';

// Validation Schema
const setPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current temporary password is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

interface LocationState {
  email?: string;
}

const SetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailFromState = (location.state as LocationState)?.email;
  const emailFromQuery = searchParams.get('email');
  const email = emailFromState ?? emailFromQuery ?? undefined;

  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const { isDark } = useThemeMode();

  const changePasswordMutation = useChangePassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
  });


  const onSubmit = async (values: SetPasswordFormValues) => {
    if (!email) return;

    setError(null);
    try {
      const result = await changePasswordMutation.mutateAsync({
        email,
        currentPassword: values.currentPassword,
        newPassword: values.password,
        confirmPassword: values.confirmPassword,
      });

      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.message || 'Failed to set password');
      }
    } catch {
      setError('An error occurred while setting your password');
    }
  };

  const handleContinue = () => {
    navigate('/chat');
  };

  // No email: show loader briefly, then invalid-link message (e.g. direct /set-password with no ?email=)
  if (!email) {
    return (
      <div
        className={`min-h-screen flex flex-col md:flex-row items-center justify-center transition-colors duration-500 ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}
      >
        <div className="flex flex-col items-center gap-4 px-6">
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isDark ? 'bg-amber-900/20 text-amber-400' : 'bg-amber-50 text-amber-600'}`}
          >
            <AlertCircle size={32} />
          </div>
          <p className={`text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Invalid or incomplete link. Use the set-password link from your email, or sign in from the login page.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-2 bg-primary text-white rounded-xl font-medium text-sm py-2.5 px-5 hover:bg-primary-dark transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen md:h-screen flex flex-col md:flex-row transition-colors duration-500 overflow-x-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}
    >
      {/* Left Brand Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-12 py-12 md:py-0 bg-gradient-to-br from-primary to-primary-dark relative overflow-hidden min-h-[200px] md:min-h-0 md:h-full">
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-light rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-light rounded-full blur-[120px]" />
        </div>

        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 text-center max-w-lg animate-fade-in px-4">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-2xl">
            <Activity size={32} className="text-white animate-pulse-soft" />
          </div>

          <h1 className="text-2xl md:text-4xl font-bold mb-3 tracking-tight font-serif text-white">
            OncoLife
          </h1>

          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 mb-6 font-sans">
            <span className="text-[10px] md:text-xs font-medium text-white/90 uppercase tracking-widest">
              Ruby
            </span>
          </div>

          <p className="text-sm md:text-base text-white/70 leading-relaxed max-w-xs mx-auto hidden md:block font-light">
            &quot;Compassionate Care, Intelligent Triage&quot;
          </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div
        className={`flex-[1.2] flex flex-col md:h-full transition-colors duration-500 overflow-y-auto ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}
      >
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-10 md:px-12 md:py-8 lg:py-12">
          <div
            className={`w-full max-w-md animate-fade-in transition-all duration-300 ${
              isDark
                ? 'bg-[#2A2725] border border-[#3A3835] shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
                : 'bg-white border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.04)]'
            } rounded-3xl overflow-hidden`}
          >
            <div className="p-8 md:p-10">
              {/* Title Header */}
              <div className="text-center mb-8">
                <h2
                  className={`text-xl md:text-2xl font-bold mb-2 font-serif transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}
                >
                  Set Your Password
                </h2>
                <p
                  className={`text-[13px] md:text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  For security, please create a new password. You must change your
                  temporary password before you can continue.
                </p>
              </div>

              {isSuccess ? (
                <div className="text-center py-8 animate-fade-in">
                  <div
                    className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isDark ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}
                  >
                    <CheckCircle size={48} />
                  </div>
                  <h3
                    className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}
                  >
                    You&apos;re All Set!
                  </h3>
                  <p
                    className={`text-sm mb-8 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    Your password has been updated. You can now access your
                    personalized care resources.
                  </p>
                  <button
                    onClick={handleContinue}
                    className="w-full bg-primary text-white rounded-xl font-bold text-[15px] py-3.5 px-6 flex items-center justify-center gap-2 transition-all duration-300 hover:bg-primary-dark hover:shadow-xl shadow-lg"
                  >
                    Continue to Dashboard
                  </button>
                </div>
              ) : (
                <>
                  {/* Info box for staff-created accounts */}
                  <div
                    className={`mb-6 px-4 py-3 rounded-xl text-[13px] flex items-start gap-3 border ${
                      isDark
                        ? 'bg-primary/10 border-primary/30 text-slate-200'
                        : 'bg-primary/5 border-primary/20 text-slate-800'
                    }`}
                  >
                    <Info size={18} className="shrink-0 mt-0.5" />
                    <p>
                      Your account was created by your care team. Enter the
                      temporary password from your welcome email below, then
                      set a new password.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {error && (
                      <div
                        className={`mb-6 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-fade-in border ${isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}
                      >
                        <AlertCircle size={18} className="shrink-0" />
                        <p>{error}</p>
                      </div>
                    )}

                    <Input
                      label="Current temporary password"
                      type="password"
                      placeholder="Enter password from welcome email"
                      error={errors.currentPassword?.message}
                      autoComplete="current-password"
                      {...register('currentPassword')}
                    />

                    <Input
                      label="New Password"
                      type="password"
                      placeholder="••••••••"
                      error={errors.password?.message}
                      autoComplete="new-password"
                      {...register('password')}
                    />

                    <Input
                      label="Confirm Password"
                      type="password"
                      placeholder="••••••••"
                      error={errors.confirmPassword?.message}
                      autoComplete="new-password"
                      {...register('confirmPassword')}
                    />

                    <p
                      className={`text-xs -mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}
                    >
                      Password must be at least 8 characters.
                    </p>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`group relative w-full overflow-hidden rounded-xl font-bold text-[15px] transition-all duration-300 ${
                          isSubmitting
                            ? 'opacity-60 cursor-not-allowed'
                            : 'hover:scale-[1.02] active:scale-[0.98]'
                        } bg-primary text-white shadow-lg hover:shadow-xl hover:bg-primary-dark py-3.5 px-6 flex items-center justify-center gap-2`}
                      >
                        {isSubmitting ? (
                          <>
                            <svg
                              className="animate-spin h-5 w-5"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            <span>Setting Password...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={18} className="shrink-0" />
                            <span>Set Password</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>

          <div
            className={`mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${isDark ? 'text-slate-600' : 'text-slate-400'}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <rect
                x="3"
                y="11"
                width="18"
                height="11"
                rx="2"
                ry="2"
              />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure Access
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetPasswordPage;

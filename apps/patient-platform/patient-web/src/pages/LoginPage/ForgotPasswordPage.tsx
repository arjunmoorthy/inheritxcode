/**
 * OncoLife Ruby - Forgot Password Page
 * "Compassionate Care, Intelligent Triage"
 * 
 * Patient forgot password page with Tailwind CSS and dark mode support
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, ArrowLeft, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import { useForgotPassword } from '../../services/login';
import { Input } from '../../components/ui';
import { useThemeMode } from '@oncolife/ui-components';

// Validation Schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const ForgotPasswordPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const { isDark } = useThemeMode();
  const forgotPasswordMutation = useForgotPassword();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setError(null);
    try {
      const result = await forgotPasswordMutation.mutateAsync({ email: values.email });
      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.message || 'Unable to process request. Please try again.');
      }
    } catch {
      setError('An error occurred. Please verify your email and try again.');
    }
  };

  return (
    <div className={`min-h-screen lg:h-screen flex flex-col lg:flex-row transition-colors duration-500 overflow-x-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
      {/* Left Brand Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-12 py-16 lg:py-0 bg-gradient-to-br from-primary to-primary-dark relative overflow-hidden min-h-[300px] lg:min-h-0 lg:h-full">
        {/* Visual Elements */}
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-light rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-light rounded-full blur-[120px]" />
        </div>

        {/* Mesh pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
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
            "Compassionate Care, Intelligent Triage"
          </p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className={`flex-[1.2] flex flex-col lg:h-full transition-colors duration-500 overflow-y-auto ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
        <div className="flex-1 flex flex-col justify-center items-center px-5 py-10 lg:px-12 lg:py-12">
          <div className={`w-full max-w-md animate-fade-in transition-all duration-300 ${isDark
            ? 'bg-[#2A2725] border border-[#3A3835] shadow-[0_20px_50px_rgba(0,0,0,0.3)]'
            : 'bg-white border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.04)]'
            } rounded-3xl overflow-hidden`}>

            <div className="p-8 md:p-10">
              {/* Title Header */}
              <div className="text-center mb-8">
                <h2 className={`text-xl md:text-2xl font-bold mb-2 font-serif transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Reset Your Password
                </h2>
                <p className={`text-[13px] md:text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Enter your email address to receive a password reset link
                </p>
              </div>

              {isSuccess ? (
                <div className="text-center py-8 animate-fade-in">
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isDark ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <CheckCircle size={48} />
                  </div>
                  <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Check Your Email</h3>
                  <p className={`text-sm mb-8 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Instructions have been sent to your email. Please check your inbox and follow the link to reset your password.
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="w-full bg-primary text-white rounded-xl font-bold text-[15px] py-3.5 px-6 flex items-center justify-center gap-2 transition-all duration-300 hover:bg-primary-dark hover:shadow-xl shadow-lg"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Error Message */}
                  {error && (
                    <div className={`mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-3 animate-fade-in ${isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : ''}`}>
                      <AlertCircle size={18} className="shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="Enter your email"
                    icon={<Mail size={18} />}
                    error={errors.email?.message}
                    autoComplete="email"
                    {...register('email')}
                  />

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
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Mail size={18} className="shrink-0" />
                          <span>Send Reset Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className={`w-full text-sm font-bold transition-colors flex items-center justify-center gap-2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <ArrowLeft size={16} />
                    Back to Sign In
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className={`mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure Access
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

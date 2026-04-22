/**
 * OncoLife - Physician Portal Login Page
 * Clinical Dashboard Access
 * Enhanced with premium dark/light mode UI
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, Activity, ArrowLeft, CheckCircle, Mail, LogIn, Shield, Wrench, Rocket } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../contexts/AuthContext';
import { useForgotPassword, useGoogleSSOSignup } from '../../services/login';
import { Input } from '@/components/ui';

import { useThemeMode } from '@oncolife/ui-components';

const showDemoButton =
  import.meta.env.VITE_DEMO_MODE === 'true' ||
  (import.meta.env.DEV && window.location.hostname === 'localhost');

// Validation Schemas
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const LoginPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const { isDark } = useThemeMode();
  const { authenticateLogin } = useAuth();
  const forgotPasswordMutation = useForgotPassword();
  const googleSSOMutation = useGoogleSSOSignup();
  const navigate = useNavigate();

  // React Hook Form for Login
  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Dev mode auto-login function
  const handleDevLogin = async () => {
    // Preferred: real login using demo credentials from env (dev/demo only).
    // Fallback: public demo mode (read-only, no real API token).
    const demoEmail = "demo-doctor@yopmail.com";
    const demoPassword =  "Inx@!123";

    if (demoEmail && demoPassword) {
      try {
        setError(null);
        const result = await authenticateLogin(demoEmail, demoPassword);
        if (result?.success) {
          window.location.href = '/dashboard';
          return;
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        setError(err?.message || 'Demo login failed. Falling back to read-only demo.');
      }
    }

    navigate('/demo', { replace: true });
  };

  // React Hook Form for Forgot Password
  const {
    register: forgotRegister,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors, isSubmitting: isForgotSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const isLoading = isLoginSubmitting || isForgotSubmitting;

  const onLoginSubmit = async (values: LoginFormValues) => {
    setError(null);
    try {
      const result = await authenticateLogin(values.email, values.password);

      // Handle navigation based on user status
      const requiresPasswordChange =
        result?.data?.requiresPasswordChange ||
        result?.details?.requires_password_change;
      if (requiresPasswordChange) {
        navigate(`/set-password?email=${encodeURIComponent(values.email)}`, {
          state: { email: values.email },
        });
        return;
      }

      // Store tokens if available in the response (service already stores, but ensure they're set)
      if (result?.success && result?.data) {
        // Handle new response structure: tokens directly in data
        if (result.data.access_token) {
          localStorage.setItem('authToken', result.data.access_token);
        }
        if (result.data.refresh_token) {
          localStorage.setItem('refreshToken', result.data.refresh_token);
        }
        if (result.data.id_token) {
          localStorage.setItem('idToken', result.data.id_token);
        }

        // Store user details if available
        if (result.data.user) {
          localStorage.setItem('userProfile', JSON.stringify(result.data.user));
        }
      }

      if (result?.success) {
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      // Show API message dynamically (e.g. 401: "Invalid email or password.")
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage =
        (typeof e?.response?.data?.message === 'string' && e.response.data.message.trim()
          ? e.response.data.message
          : null) ?? (typeof e?.message === 'string' && e.message.trim() ? e.message : null) ?? 'Invalid credentials. Please check your email and password.';
      setError(errorMessage);
    }
  };

  const onForgotPasswordSubmit = async (values: ForgotPasswordFormValues) => {
    setError(null);
    try {
      const result = await forgotPasswordMutation.mutateAsync({ email: values.email });
      // API returns a string for 200 response, or an object with success property
      if (typeof result === 'string' || result?.success) {
        setForgotSuccess(true);
      } else {
        setError(result?.message || 'Unable to process request. Please try again.');
      }
    } catch (err: any) {
      setError('An error occurred. Please verify your email and try again.');
    }
  };

  const toggleForgotPassword = () => {
    setIsForgotPassword(!isForgotPassword);
    setForgotSuccess(false);
    setError(null);
  };

  return (
    <div className={`min-h-screen lg:h-screen flex flex-col lg:flex-row transition-colors duration-500 overflow-x-hidden ${isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'}`}>
      {/* Left Brand Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-12 py-16 lg:py-0 bg-[#1E3A5F] relative overflow-hidden min-h-[300px] lg:min-h-0 lg:h-full">
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
                  {isForgotPassword ? 'Reset Your Password' : 'Physician Sign In'}
                </h2>
                <p className={`text-[13px] md:text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isForgotPassword
                    ? 'Enter your email address to receive a password reset link'
                    : 'Access your patient dashboard and clinical monitoring tools'}
                </p>
              </div>

              <form onSubmit={isForgotPassword ? handleForgotSubmit(onForgotPasswordSubmit) : handleLoginSubmit(onLoginSubmit)} className="space-y-5">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="physician@clinic.com"
                  icon={<Mail size={18} />}
                  error={isForgotPassword ? forgotErrors.email?.message : loginErrors.email?.message}
                  {...(isForgotPassword ? forgotRegister('email') : loginRegister('email'))}
                />

                {!isForgotPassword && (
                  <div className="space-y-1">
                    <Input
                      label="Password"
                      type="password"
                      placeholder="Enter your password"
                      error={loginErrors.password?.message}
                      autoComplete="current-password"
                      {...loginRegister('password')}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={toggleForgotPassword}
                        className="text-[13px] text-secondary font-bold hover:underline transition-all"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading || (isForgotPassword && forgotSuccess)}
                    className={`group relative w-full overflow-hidden rounded-xl font-bold text-[15px] transition-all duration-300 ${isLoading || (isForgotPassword && forgotSuccess)
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:scale-[1.02] active:scale-[0.98]'
                      } bg-[#1E3A5F] text-white shadow-lg hover:shadow-xl hover:bg-[#1a4a7f] py-3.5 px-6 flex items-center justify-center gap-2`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{isForgotPassword ? 'Sending...' : 'Signing in...'}</span>
                      </>
                    ) : (
                      <>
                        {isForgotPassword ? (
                          forgotSuccess ? (
                            <>
                              <CheckCircle size={18} className="shrink-0" />
                              <span>Email Sent</span>
                            </>
                          ) : (
                            <>
                              <Mail size={18} className="shrink-0" />
                              <span>Send Reset Link</span>
                            </>
                          )
                        ) : (
                          <>
                            <LogIn size={18} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            <span>Sign In</span>
                          </>
                        )}
                      </>
                    )}
                  </button>

                  {/* Status Feedback (Error/Success) below button */}
                  {(error || (isForgotPassword && forgotSuccess)) && (
                    <div className={`mt-4 px-4 py-3 rounded-xl text-[13px] flex items-center gap-3 animate-fade-in border ${forgotSuccess
                      ? (isDark ? 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600')
                      : (isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : 'bg-red-50 border-red-200 text-red-600')
                      }`}>
                      {forgotSuccess ? <CheckCircle size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
                      <p className="font-medium !mb-0">
                        {forgotSuccess
                          ? "Instructions have been sent to your email. Please check your inbox."
                          : error}
                      </p>
                    </div>
                  )}
                </div>

                {isForgotPassword && (
                  <button
                    type="button"
                    onClick={toggleForgotPassword}
                    className={`w-full text-sm font-bold transition-colors flex items-center justify-center gap-2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <ArrowLeft size={16} />
                    Back to Sign In
                  </button>
                )}
              </form>

              {!isForgotPassword && !forgotSuccess && (
                <div className="mt-8">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className={`w-full`}></div>
                      {/* border-t border ${isDark ? 'border-[#3A3835]' : 'border-slate-300'} */}
                    </div>
                    {/* <div className="relative flex justify-center text-[11px] uppercase">
                      <span className={`px-4 font-bold tracking-widest ${isDark ? 'bg-[#2A2725] text-slate-500' : 'bg-white text-slate-500'}`}>
                        Or continue with
                      </span>
                    </div> */}
                  </div>

                  {/* <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={async (credentialResponse) => {
                        if (credentialResponse.credential) {
                          try {
                            setError(null);
                            const result = await googleSSOMutation.mutateAsync({
                              id_token: credentialResponse.credential
                            });

                            console.log('Google SSO Login Response:', result);

                            // Handle both new user creation and existing user login
                            if (result && (result.created || result.staff_id)) {
                              // Store Google SSO response data (tokens, etc.) for later use
                              // Always store in sessionStorage for profile completion flow
                              sessionStorage.setItem('googleSSOResponse', JSON.stringify({
                                access_token: result.access_token,
                                refresh_token: result.refresh_token,
                                staff_id: result.staff_id,
                                email: result.email,
                                first_name: result.first_name,
                                last_name: result.last_name,
                                staff_uuid: result.staff_uuid,
                              }));

                              // Check if profile needs to be completed
                              if (result.is_profile_completed === false) {
                                // Build query params with all available data
                                const queryParams = new URLSearchParams({
                                  staff_id: result.staff_id.toString(),
                                  email: result.email || '',
                                  ...(result.first_name && { first_name: result.first_name }),
                                  ...(result.last_name && { last_name: result.last_name }),
                                }).toString();
                                navigate(`/complete-profile?${queryParams}`);
                              } else {
                                // Profile already completed - store tokens and redirect
                                if (result.access_token) {
                                  localStorage.setItem('authToken', result.access_token);
                                }
                                if (result.refresh_token) {
                                  localStorage.setItem('refreshToken', result.refresh_token);
                                }
                                // Redirect to dashboard
                                window.location.href = '/dashboard';
                              }
                            } else {
                              // Unexpected response format
                              setError(result?.message || 'Unexpected response from server');
                            }
                          } catch (err: any) {
                            console.error('Google SSO Login Error:', err);
                            const errorMessage = err?.response?.data?.detail 
                              || err?.response?.data?.message 
                              || err?.message 
                              || 'Google authentication failed. Please try again.';
                            setError(errorMessage);
                          }
                        }
                      }}
                      onError={() => {
                        setError('Google Login Failed');
                      }}
                      useOneTap
                      theme={isDark ? 'filled_black' : 'outline'}
                      shape="pill"
                      width="100%"
                    />
                  </div> */}

                  {/* <div className={`mt-6 text-center text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Don't have an account?
                    <Link to="/signup" className="link-primary ml-2 font-bold text-secondary">
                      Register Now
                    </Link>
                  </div> */}

                  {/* Development Mode Card */}

                  <div className="mt-8 animate-fade-in">
                    {/* HIPAA Notice */}
                    {/* <div className="flex items-center justify-center gap-2 mb-4">
                      <Shield size={16} className="text-teal-400" />
                      <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        Secure, HIPAA-compliant access
                      </span>
                    </div> */}
                    {/* {showDemoButton && ( */}
                      <>
                        {/* Local Development Mode Card */}
                        {/* <div className={`rounded-2xl border-2 p-5 transition-all duration-300 ${isDark
                          ? 'bg-emerald-900/20 border-emerald-700/40'
                          : 'bg-emerald-50 border-emerald-200'
                          }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <Wrench size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-700'} />
                            <h3 className={`font-bold text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                              Local Development Mode
                            </h3>
                          </div>

                          <button
                            onClick={handleDevLogin}
                            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 ${isDark
                              ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-400 hover:to-blue-400 shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40'
                              : 'bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600 shadow-md hover:shadow-lg'
                              }`}
                          >
                            <Rocket size={16} className="shrink-0" />
                            <span>Quick Dev Login (No Password)</span>
                          </button>
                        </div> */}
                      </>
                    {/* )} */}
                    {/* Copyright Notice */}
                    <div className={`mt-4 text-center text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      © 2026 HEALTHAI - ONCOLIFE PHYSICIAN PORTAL
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>

          {/* <div className={`mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure HIPAA Portal
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

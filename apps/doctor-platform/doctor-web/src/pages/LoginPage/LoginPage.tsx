/**
 * OncoLife - Physician Portal Login Page
 * Clinical Dashboard Access
 * Using reusable UI components
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, AlertCircle, Activity, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useForgotPassword, googleLogin } from '../../services/login';
import { Button, Input } from '@/components/ui';

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
  const handleDevLogin = () => {
    // Set a fake token for local development
    localStorage.setItem('authToken', 'dev-mode-token-22222222-2222-2222-2222-222222222222');
    navigate('/dashboard');
    window.location.reload(); // Refresh to pick up the new token
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
      if (result?.data?.requiresPasswordChange) {
        navigate('/reset-password');
      } else if (result?.data?.user_status === 'CONFIRMED') {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError('Invalid credentials. Please check your email and password.');
    }
  };

  const onForgotPasswordSubmit = async (values: ForgotPasswordFormValues) => {
    setError(null);
    try {
      const result = await forgotPasswordMutation.mutateAsync({ email: values.email });
      if (result.success) {
        setForgotSuccess(true);
      } else {
        setError(result.message || 'Unable to process request. Please try again.');
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
            Clinical dashboard for oncology care teams.<br />
            Monitor patient symptoms, trends, and escalations.
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
            {isForgotPassword ? 'Reset Your Password' : 'Physician Sign In'}
          </h2>

          <p className={`text-sm mb-7 text-center leading-relaxed transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'
            }`}>
            {isForgotPassword
              ? 'Enter your email address to receive a password reset link'
              : 'Access your patient dashboard and clinical monitoring tools'}
          </p>

          {/* Error Message */}
          {error && (
            <div className={`bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-lg text-[13px] mb-4 flex items-center gap-2 animate-fade-in ${isDark ? 'bg-red-900/20 border-red-800/40 text-red-400' : ''
              }`}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Success Message for Forgot Password */}
          {isForgotPassword && forgotSuccess ? (
            <>
              <div className={`bg-emerald-50 border border-emerald-200 text-emerald-600 px-4 py-4 rounded-lg text-sm mb-6 flex flex-col items-center text-center gap-3 animate-fade-in ${isDark ? 'bg-emerald-900/20 border-emerald-800/40 text-emerald-400' : ''
                }`}>
                <CheckCircle size={32} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                <p>
                  Reset link sent! If an account exists,
                  you'll receive an email with password reset instructions.
                </p>
              </div>

              <Button variant="outline" fullWidth onClick={toggleForgotPassword} className={isDark ? 'border-[#3A3835] text-slate-300 hover:bg-[#3A3835]' : ''}>
                <ArrowLeft size={18} className="mr-2" />
                Back to Sign In
              </Button>
            </>
          ) : (
            <form onSubmit={isForgotPassword ? handleForgotSubmit(onForgotPasswordSubmit) : handleLoginSubmit(onLoginSubmit)}>
              {/* Email Field */}
              <Input
                label="Email Address"
                type="email"
                placeholder="physician@clinic.com"
                icon={<Mail size={18} />}
                error={isForgotPassword ? forgotErrors.email?.message : loginErrors.email?.message}
                {...(isForgotPassword ? forgotRegister('email') : loginRegister('email'))}
              />

              {/* Password Field (only for login) */}
              {!isForgotPassword && (
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter password"
                  error={loginErrors.password?.message}
                  autoComplete="current-password"
                  {...loginRegister('password')}
                />
              )}

              {/* Forgot Password Link (only for login) */}
              {!isForgotPassword && (
                <div className="flex justify-end mb-6">
                  <button
                    type="button"
                    onClick={toggleForgotPassword}
                    className="text-sm text-secondary font-medium hover:underline transition-all"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isLoading}
              >
                {isLoading
                  ? (isForgotPassword ? 'Sending...' : 'Authenticating...')
                  : (isForgotPassword ? 'Send Reset Link' : 'Sign In to Dashboard')}
              </Button>

              {/* Back to Login (only for forgot password) */}
              {isForgotPassword && (
                <button
                  type="button"
                  onClick={toggleForgotPassword}
                  className={`w-full mt-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <ArrowLeft size={16} />
                  Back to Sign In
                </button>
              )}
            </form>
          )}

          {/* Divider */}
          {!isForgotPassword && !forgotSuccess && (
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

              {/* Google Sign In */}
              <button
                onClick={googleLogin}
                type="button"
                className={`w-full px-6 py-3 text-[15px] font-medium rounded-lg cursor-pointer transition-smooth flex items-center justify-center gap-3 mt-4 hover-lift ${isDark
                  ? 'bg-[#1A1917] border border-[#3A3835] text-slate-300 hover:bg-[#3A3835]'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-background hover:border-secondary/40'
                  }`}
              >
                <img
                  src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png"
                  alt="Google"
                  className="w-5 h-5"
                />
                Sign in with Google
              </button>

              {/* Sign Up Link */}
              <div className={`mt-6 text-center text-sm transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-600'
                }`}>
                Don't have an account?
                <Link
                  to="/signup"
                  className="link-primary ml-1.5"
                >
                  Register as Physician
                </Link>
              </div>

              {/* Security Notice */}
              <div className={`mt-6 pt-6 border-t text-center text-xs flex items-center justify-center gap-2 transition-colors duration-300 ${isDark ? 'border-[#3A3835] text-slate-500' : 'border-slate-200 text-slate-500'
                }`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Secure, HIPAA-compliant access
              </div>
            </>
          )}
          {/* Dev Mode Quick Login - Shows in local dev or when VITE_DEMO_MODE=true */}
          {showDemoButton && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#d4edda',
              borderRadius: '8px',
              border: '1px solid #28a745'
            }}>
              <div style={{ fontSize: '14px', color: '#155724', marginBottom: '10px' }}>
                🛠️ <strong>Local Development Mode</strong>
              </div>
              <button
                onClick={handleDevLogin}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                🚀 Quick Dev Login (No Password)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

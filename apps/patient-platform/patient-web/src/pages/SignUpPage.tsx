import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';
import { useSignUp } from '../services/signup';
import { useAuth } from '../contexts/AuthContext';

const SignUpPage = () => {
  const { isDark, toggleTheme } = useThemeMode();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    emailAddress: '',
    firstName: '',
    lastName: ''
  });
  const [error, setError] = useState('');
  
  const signUpMutation = useSignUp();

  // Redirect to app when already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/chat', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    signUpMutation.mutate(formData, {
      onSuccess: () => {
        navigate('/login');
      },
      onError: (error) => {
        setError(error.message || 'Registration failed. Please try again.');
      }
    });
  };

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
      isDark ? 'bg-[#1A1917]' : 'bg-[#F8FAFC]'
    } py-12 px-4 sm:px-6 lg:px-8`}>
      {/* Dark Mode Toggle */}
      <button
        onClick={toggleTheme}
        className={`fixed top-4 right-4 z-50 p-3 rounded-full transition-all duration-200 ${
          isDark 
            ? 'bg-[#2A2725] text-white hover:bg-[#3A3835] border border-slate-700 shadow-lg' 
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-lg'
        }`}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className={`mt-6 text-center text-3xl font-extrabold transition-colors duration-300 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className={`rounded-md shadow-sm -space-y-px transition-all duration-300 ${
            isDark ? 'shadow-[0_10px_40px_rgba(0,0,0,0.2)]' : 'shadow-sm'
          }`}>
            <div>
              <label htmlFor="firstName" className="sr-only">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border rounded-t-md focus:outline-none focus:ring-2 focus:z-10 sm:text-sm transition-all duration-200 ${
                  isDark
                    ? 'bg-[#1A1917] border-slate-700 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-primary/20'
                }`}
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="sr-only">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border focus:outline-none focus:ring-2 focus:z-10 sm:text-sm transition-all duration-200 ${
                  isDark
                    ? 'bg-[#1A1917] border-slate-700 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-primary/20'
                }`}
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="emailAddress"
                name="emailAddress"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border rounded-b-md focus:outline-none focus:ring-2 focus:z-10 sm:text-sm transition-all duration-200 ${
                  isDark
                    ? 'bg-[#1A1917] border-slate-700 text-white placeholder:text-slate-500 focus:border-primary focus:ring-primary/20'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:ring-primary/20'
                }`}
                placeholder="Email address"
                value={formData.emailAddress}
                onChange={handleChange}
              />
            </div>
          </div>

          {error && (
            <div className={`text-sm text-center transition-colors duration-300 ${
              isDark ? 'text-red-400' : 'text-red-600'
            }`}>
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={signUpMutation.isPending}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {signUpMutation.isPending ? 'Creating account...' : 'Sign up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignUpPage;

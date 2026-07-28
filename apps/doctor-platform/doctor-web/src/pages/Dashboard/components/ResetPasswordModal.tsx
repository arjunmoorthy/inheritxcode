import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { useThemeMode } from '@oncolife/ui-components';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { Lock } from 'lucide-react';
import { apiClient } from '../../../utils/apiClient';
import { API_CONFIG } from '../../../config/api';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientEmail: string;
  patientName: string;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  patientEmail,
  patientName,
}) => {
  const { isDark } = useThemeMode();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Reset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // Assuming you have an API endpoint to change password. We use the email and password here.
      const payload = {
        email: patientEmail,
        new_password: password,
        confirm_password: confirmPassword,
      };
      
      console.log('Sending payload:', payload);

      await apiClient.post('/fax/reset-patient-password', payload);
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      title="Reset Password"
      titleDescription={`Reset password for ${patientName}`}
      size="md"
    >
      <div className={`${isDark ? 'text-slate-100' : 'text-slate-900'} p-1`}>
        {success ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-500 mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">Password Reset Successfully</h3>
            <p className="text-sm text-slate-500">The password has been updated.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">
              Please enter a new password below.
            </p>
            
            <Input
              label="New Password"
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={18} />}
              fullWidth
              required
            />
            
            <Input
              label="Confirm Password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock size={18} />}
              fullWidth
              required
            />
            
            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded-md border border-red-500/20">
                {error}
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outlined"
                onClick={onClose}
                disabled={isLoading}
                sx={{
                  color: isDark ? '#94a3b8' : '#64748b',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                  textTransform: 'none',
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isLoading}
                sx={{
                  backgroundColor: '#2563EB',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#1D4ED8',
                  },
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

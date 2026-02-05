/**
 * Input Component - Tailwind CSS
 * Reusable input field with icon support, error states, and password toggle
 */

import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    icon?: React.ReactNode;
    fullWidth?: boolean;
    showPasswordToggle?: boolean; // Auto-enabled for type="password"
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
    label,
    error,
    helperText,
    icon,
    fullWidth = true,
    showPasswordToggle,
    className = '',
    id,
    type = 'text',
    disabled,
    ...props
}, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const { isDark } = useThemeMode();
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const widthClass = fullWidth ? 'w-full' : '';

    // Auto-enable password toggle for password inputs
    const isPasswordInput = type === 'password';
    const shouldShowToggle = showPasswordToggle !== false && isPasswordInput;
    const actualType = shouldShowToggle && showPassword ? 'text' : type;

    // Auto-add lock icon for password fields if no icon provided
    const displayIcon = icon || (isPasswordInput ? <Lock size={18} /> : null);

    return (
        <div className={`${widthClass} mb-5`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className={`block text-[13px] font-semibold mb-1.5 uppercase tracking-wide transition-colors ${isDark ? 'text-slate-300' : 'text-slate-900'
                        }`}
                >
                    {label}
                </label>
            )}

            <div
                className={`flex items-center rounded-lg px-4 border transition-all duration-200 ${error
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-900/20'
                    : disabled
                        ? isDark
                            ? 'border-[#3A3835] bg-[#2A2725]'
                            : 'border-slate-200 bg-slate-50'
                        : isDark
                            ? 'border-[#3A3835] bg-[#2A2725] focus-within:border-primary focus-within:bg-[#3A3835]'
                            : 'border-slate-200 bg-background focus-within:border-secondary focus-within:bg-white'
                    }`}
            >
                {displayIcon && (
                    <span className={`flex items-center justify-center mr-2.5 transition-colors ${isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                        {displayIcon}
                    </span>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    type={actualType}
                    disabled={disabled}
                    className={`flex-1 border-none outline-none bg-transparent text-[15px] py-3 transition-colors ${isDark
                        ? 'text-white placeholder:text-slate-500'
                        : 'text-slate-900 placeholder:text-slate-500'
                        } placeholder:opacity-60 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
                    {...props}
                />

                {shouldShowToggle && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`p-1.5 transition-colors ${isDark
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>

            {error && (
                <span className="block text-red-600 dark:text-red-400 text-xs mt-1 font-medium">
                    {error}
                </span>
            )}

            {helperText && !error && (
                <span className={`block text-xs mt-1 transition-colors ${isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                    {helperText}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

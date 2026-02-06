/**
 * Button Component - Tailwind CSS
 * Reusable button with multiple variants and sizes
 */

import React from 'react';
import { useThemeMode } from '@oncolife/ui-components';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    loading?: boolean;
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    disabled,
    className = '',
    children,
    ...props
}) => {
    const { isDark } = useThemeMode();
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary: isDark 
            ? 'bg-primary text-white hover:bg-primary-light active:bg-primary-dark focus:ring-primary shadow-sm hover:shadow-md hover:-translate-y-0.5'
            : 'bg-primary text-white hover:bg-primary-light active:bg-primary-dark focus:ring-primary shadow-sm hover:shadow-md hover:-translate-y-0.5',
        secondary: 'bg-secondary text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-secondary shadow-sm hover:shadow-md hover:-translate-y-0.5',
        outline: isDark
            ? 'bg-slate-800 text-slate-200 border-2 border-slate-600 hover:bg-slate-700 hover:border-slate-500 active:bg-slate-600 focus:ring-slate-500'
            : 'bg-white text-slate-700 border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 focus:ring-slate-300',
        ghost: isDark
            ? 'bg-transparent text-slate-300 hover:bg-slate-800 active:bg-slate-700 focus:ring-slate-600'
            : 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus:ring-slate-300',
        danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus:ring-red-500 shadow-sm hover:shadow-md hover:-translate-y-0.5',
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-6 py-3 text-[15px]',
        lg: 'px-8 py-4 text-base',
    };

    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                </>
            ) : (
                children
            )}
        </button>
    );
};

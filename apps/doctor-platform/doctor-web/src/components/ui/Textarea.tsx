/**
 * Textarea Component - Tailwind CSS
 * Reusable textarea with error states
 */

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
    label,
    error,
    helperText,
    fullWidth = true,
    className = '',
    id,
    rows = 4,
    ...props
}) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <div className={`${widthClass} mb-5`}>
            {label && (
                <label
                    htmlFor={textareaId}
                    className="block text-[13px] font-semibold text-slate-900 mb-1.5 uppercase tracking-wide"
                >
                    {label}
                </label>
            )}

            <div
                className={`bg-background rounded-lg px-4 py-2 border transition-all duration-200 ${error
                        ? 'border-red-500 bg-red-50/30'
                        : 'border-slate-200 focus-within:border-secondary focus-within:bg-white'
                    }`}
            >
                <textarea
                    id={textareaId}
                    rows={rows}
                    className={`w-full border-none outline-none bg-transparent text-[15px] py-3 text-slate-900 placeholder:text-slate-500 placeholder:opacity-60 resize-vertical ${className}`}
                    {...props}
                />
            </div>

            {error && (
                <span className="block text-red-600 text-xs mt-1 font-medium">
                    {error}
                </span>
            )}

            {helperText && !error && (
                <span className="block text-slate-500 text-xs mt-1">
                    {helperText}
                </span>
            )}
        </div>
    );
};

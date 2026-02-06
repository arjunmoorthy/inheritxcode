/**
 * Modal Component - Tailwind CSS
 * Reusable modal dialog with backdrop
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useThemeMode } from '@oncolife/ui-components';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showCloseButton?: boolean;
    titleDescription?: string;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    titleDescription,
    children,
    size = 'md',
    showCloseButton = true,
}) => {
    const { isDark } = useThemeMode();

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizes = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 z-[99999]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative rounded-xl shadow-2xl w-full ${sizes[size]} max-h-[95vh] sm:max-h-[90vh] overflow-hidden transition-colors duration-200 ${
                    isDark ? 'bg-[#252320] text-[#F5F3EE]' : 'bg-white border border-slate-100'
                }`}
            >
                {/* Header */}
                {(title || titleDescription || showCloseButton) && (
                    <div className={`flex items-start justify-between px-4 py-3 sm:px-6 sm:py-4 border-b transition-colors duration-200 ${
                        isDark ? 'border-slate-700' : 'border-slate-200'
                    }`}>
                        <div className="flex-1 pr-3">
                            {title && (
                                <h2 className={`text-lg sm:text-xl font-bold font-serif transition-colors duration-200 ${
                                    isDark ? 'text-slate-100' : 'text-slate-900'
                                }`}>
                                    {title}
                                </h2>
                            )}
                            {titleDescription && (
                                <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-1.5 mb-0 font-medium leading-relaxed`}>
                                    {titleDescription}
                                </p>
                            )}
                        </div>
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className={`p-1.5 sm:p-2 rounded-lg transition-colors duration-200 flex-shrink-0 ${
                                    isDark 
                                        ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-800' 
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                }`}
                                aria-label="Close modal"
                            >
                                <X size={18} className="sm:w-5 sm:h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className={`px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto max-h-[calc(95vh-120px)] sm:max-h-[calc(90vh-100px)] transition-colors duration-200 ${
                    isDark ? 'bg-[#252320] text-[#F5F3EE]' : 'bg-white'
                }`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export interface ModalFooterProps {
    children: React.ReactNode;
    className?: string;
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => {
    const { isDark } = useThemeMode();
    
    return (
        <div className={`flex items-center justify-end gap-3 sm:gap-4 px-3 py-2 border-t transition-colors duration-200 ${
            isDark 
                ? 'border-slate-700 bg-[#252320] text-[#F5F3EE]' 
                : 'border-slate-200 bg-slate-50/80'
        } ${className}`}>
            {children}
        </div>
    );
};

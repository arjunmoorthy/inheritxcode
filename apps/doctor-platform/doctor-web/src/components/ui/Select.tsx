/**
 * Select Component - Enhanced with react-select
 * Beautiful dropdown UI with search, better UX than native select
 */

import React from 'react';
import ReactSelect from 'react-select';
import type { Props as ReactSelectProps, StylesConfig } from 'react-select';
import { useThemeMode } from '@oncolife/ui-components';

export interface SelectOption {
    value: string | number;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<ReactSelectProps<SelectOption>, 'options'> {
    label?: string;
    error?: string;
    helperText?: string;
    options: SelectOption[];
    placeholder?: string;
    fullWidth?: boolean;
    isSearchable?: boolean;
}

export const Select = React.forwardRef<any, SelectProps>(({
    label,
    error,
    helperText,
    options,
    placeholder = 'Select an option',
    fullWidth = true,
    isSearchable = true,
    className = '',
    id,
    ...props
}, ref) => {
    const { isDark } = useThemeMode();
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const widthClass = fullWidth ? 'w-full' : '';

    // Custom styles to match Tailwind design with dark mode support
    const customStyles: StylesConfig<SelectOption> = {
        control: (base, state) => ({
            ...base,
            backgroundColor: error 
                ? (isDark ? 'rgba(127, 29, 29, 0.2)' : 'rgba(254, 242, 242, 0.3)')
                : (isDark ? '#2A2725' : '#F8FAFC'),
            borderColor: error 
                ? '#EF4444' 
                : state.isFocused 
                    ? '#2563EB' 
                    : (isDark ? '#3A3835' : '#E2E8F0'),
            borderRadius: '0.5rem',
            borderWidth: '1px',
            minHeight: '52px',
            paddingLeft: '0.75rem',
            paddingRight: '0.75rem',
            boxShadow: 'none',
            transition: 'all 0.2s',
            cursor: 'pointer',
            '&:hover': {
                borderColor: state.isFocused 
                    ? '#2563EB' 
                    : (isDark ? '#4A4845' : '#CBD5E1'),
                backgroundColor: state.isFocused 
                    ? (isDark ? '#3A3835' : '#FFFFFF')
                    : (isDark ? '#2A2725' : '#F8FAFC'),
            },
        }),
        valueContainer: (base) => ({
            ...base,
            padding: '0',
            fontSize: '15px',
        }),
        input: (base) => ({
            ...base,
            margin: '0',
            padding: '0',
            color: isDark ? '#FFFFFF' : '#0F172A',
        }),
        placeholder: (base) => ({
            ...base,
            color: isDark ? '#94A3B8' : '#64748B',
            opacity: 0.9,
            fontSize: '15px',
        }),
        singleValue: (base) => ({
            ...base,
            color: isDark ? '#FFFFFF' : '#0F172A',
            fontSize: '15px',
        }),
        menu: (base) => ({
            ...base,
            borderRadius: '0.5rem',
            boxShadow: isDark 
                ? '0 20px 50px rgba(0, 0, 0, 0.3)' 
                : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: `1px solid ${isDark ? '#3A3835' : '#E2E8F0'}`,
            backgroundColor: isDark ? '#2A2725' : '#FFFFFF',
            marginTop: '4px',
            overflow: 'hidden',
        }),
        menuPortal: (base) => ({
            ...base,
            zIndex: 100000,
        }),
        menuList: (base) => ({
            ...base,
            padding: '4px',
            maxHeight: '240px',
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
                ? '#2563EB'
                : state.isFocused
                    ? (isDark ? '#3A3835' : '#EFF6FF')
                    : 'transparent',
            color: state.isSelected 
                ? '#FFFFFF' 
                : (isDark ? '#E2E8F0' : '#0F172A'),
            cursor: state.isDisabled ? 'not-allowed' : 'pointer',
            padding: '10px 12px',
            borderRadius: '0.375rem',
            fontSize: '15px',
            transition: 'all 0.15s',
            '&:active': {
                backgroundColor: state.isSelected 
                    ? '#1D4ED8' 
                    : (isDark ? '#4A4845' : '#DBEAFE'),
            },
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (base, state) => ({
            ...base,
            color: isDark ? '#94A3B8' : '#64748B',
            padding: '0',
            transition: 'transform 0.2s',
            transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            '&:hover': {
                color: isDark ? '#E2E8F0' : '#0F172A',
            },
        }),
        clearIndicator: (base) => ({
            ...base,
            color: isDark ? '#94A3B8' : '#64748B',
            padding: '0',
            marginRight: '8px',
            '&:hover': {
                color: '#EF4444',
            },
        }),
        // Multi-select tags: theme-aware background and text for light/dark
        multiValue: (base) => ({
            ...base,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.9)' : '#E2E8F0',
            borderRadius: '0.375rem',
            border: isDark ? '1px solid rgba(71, 85, 105, 0.6)' : 'none',
        }),
        multiValueLabel: (base) => ({
            ...base,
            display: 'flex',
            alignItems: 'center',
            fontSize: '15px',
            lineHeight: 1.5,
            paddingTop: 0,
            paddingBottom: 0,
            color: isDark ? '#F1F5F9' : '#0F172A',
        }),
        multiValueRemove: (base) => ({
            ...base,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: '4px',
            paddingRight: '4px',
            cursor: 'pointer',
            '&:hover': {
                backgroundColor: isDark ? 'rgba(248, 113, 113, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
            },
        }),
    };

    return (
        <div className={`${widthClass} mb-5`}>
            {label && (
                <label
                    htmlFor={selectId}
                    className={`block text-[13px] font-semibold mb-1.5 uppercase tracking-wide transition-colors ${
                        isDark ? 'text-slate-300' : 'text-slate-900'
                    }`}
                >
                    {label}
                </label>
            )}

            <ReactSelect
                ref={ref}
                inputId={selectId}
                options={options}
                placeholder={placeholder}
                isSearchable={isSearchable}
                styles={customStyles}
                menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
                menuPosition="fixed"
                className={className}
                classNamePrefix="react-select"
                {...props}
            />

            {error && (
                <span className={`block text-xs mt-1 font-medium transition-colors ${
                    isDark ? 'text-red-400' : 'text-red-600'
                }`}>
                    {error}
                </span>
            )}

            {helperText && !error && (
                <span className={`block text-xs mt-1 transition-colors ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                    {helperText}
                </span>
            )}
        </div>
    );
});

Select.displayName = 'Select';

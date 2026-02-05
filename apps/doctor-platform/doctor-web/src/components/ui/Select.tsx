/**
 * Select Component - Enhanced with react-select
 * Beautiful dropdown UI with search, better UX than native select
 */

import React from 'react';
import ReactSelect from 'react-select';
import type { Props as ReactSelectProps, StylesConfig } from 'react-select';

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
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const widthClass = fullWidth ? 'w-full' : '';

    // Custom styles to match Tailwind design
    const customStyles: StylesConfig<SelectOption> = {
        control: (base, state) => ({
            ...base,
            backgroundColor: error ? 'rgba(254, 242, 242, 0.3)' : '#F8FAFC',
            borderColor: error ? '#EF4444' : state.isFocused ? '#2563EB' : '#E2E8F0',
            borderRadius: '0.5rem',
            borderWidth: '1px',
            minHeight: '52px',
            paddingLeft: '0.75rem',
            paddingRight: '0.75rem',
            boxShadow: 'none',
            transition: 'all 0.2s',
            cursor: 'pointer',
            '&:hover': {
                borderColor: state.isFocused ? '#2563EB' : '#CBD5E1',
                backgroundColor: state.isFocused ? '#FFFFFF' : '#F8FAFC',
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
            color: '#0F172A',
        }),
        placeholder: (base) => ({
            ...base,
            color: '#64748B',
            opacity: 0.6,
            fontSize: '15px',
        }),
        singleValue: (base) => ({
            ...base,
            color: '#0F172A',
            fontSize: '15px',
        }),
        menu: (base) => ({
            ...base,
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #E2E8F0',
            marginTop: '4px',
            overflow: 'hidden',
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
                    ? '#EFF6FF'
                    : 'transparent',
            color: state.isSelected ? '#FFFFFF' : '#0F172A',
            cursor: state.isDisabled ? 'not-allowed' : 'pointer',
            padding: '10px 12px',
            borderRadius: '0.375rem',
            fontSize: '15px',
            transition: 'all 0.15s',
            '&:active': {
                backgroundColor: state.isSelected ? '#1D4ED8' : '#DBEAFE',
            },
        }),
        indicatorSeparator: () => ({
            display: 'none',
        }),
        dropdownIndicator: (base, state) => ({
            ...base,
            color: '#64748B',
            padding: '0',
            transition: 'transform 0.2s',
            transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            '&:hover': {
                color: '#0F172A',
            },
        }),
        clearIndicator: (base) => ({
            ...base,
            color: '#64748B',
            padding: '0',
            marginRight: '8px',
            '&:hover': {
                color: '#EF4444',
            },
        }),
    };

    return (
        <div className={`${widthClass} mb-5`}>
            {label && (
                <label
                    htmlFor={selectId}
                    className="block text-[13px] font-semibold text-slate-900 mb-1.5 uppercase tracking-wide"
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
                className={className}
                classNamePrefix="react-select"
                {...props}
            />

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
});

Select.displayName = 'Select';

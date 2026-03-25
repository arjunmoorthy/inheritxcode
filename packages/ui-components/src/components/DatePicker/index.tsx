import React, { useState } from 'react';
import { DatePicker as MUIDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Dayjs } from 'dayjs';
import { Calendar } from 'lucide-react';
import { DatePickerContainer, DateDisplayButton } from './DatePicker.styles';

interface SharedDatePickerProps {
  value: Dayjs | null;
  onChange: (date: Dayjs) => void;
  label?: string;
  placeholder?: string;
  views?: ('day' | 'month' | 'year')[];
  fullWidth?: boolean;
}

const SharedDatePicker: React.FC<SharedDatePickerProps> = ({
  value,
  onChange,
  label = 'Select Month & Year',
  placeholder,
  views = ['month', 'year'],
  fullWidth = false,
}) => {
  const [open, setOpen] = useState(false);

  const handleDateChange = (newDate: Dayjs | null) => {
    if (newDate) {
      onChange(newDate);
      setOpen(false);
    }
  };

  const hasDayView = views.includes('day');
  const formatCurrentDate = (date: Dayjs) =>
    hasDayView ? date.format('MM/DD/YYYY') : date.format('MMMM YYYY');

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
      <DatePickerContainer $fullWidth={fullWidth}>
        {open ? (
          <MUIDatePicker
            label={label}
            views={views}
            value={value}
            onChange={handleDateChange}
            open={true}
            onClose={() => setOpen(false)}
            format={hasDayView ? 'MM/DD/YYYY' : 'MM/YYYY'}
            slotProps={{
              popper: {
                sx: { zIndex: 100000 },
              },
              textField: {
                size: 'small',
                sx: {
                  '& .MuiInputBase-root': { 
                    height: '48px',
                    width: fullWidth ? '100%' : 'auto'
                  },
                  '& .MuiInputLabel-root': { fontSize: '14px' },
                  width: fullWidth ? '100%' : 'auto'
                },
              },
            }}
          />
        ) : (
          <DateDisplayButton onClick={() => setOpen(true)} $fullWidth={fullWidth}>
            <span>
              {value
                ? formatCurrentDate(value)
                : (placeholder || label)}
            </span>
            <Calendar />
          </DateDisplayButton>
        )}
      </DatePickerContainer>
    </LocalizationProvider>
  );
};

export default SharedDatePicker; 
import React, { forwardRef } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { uk } from 'date-fns/locale/uk';

// Register Ukrainian locale
registerLocale('uk', uk);

// Custom Input for consistent styling
const CustomInput = forwardRef(({ value, onClick, className, placeholder }, ref) => (
    <button type="button" className={className} onClick={onClick} ref={ref}>
        {value || placeholder || "__. __. ____"}
    </button>
));

const UKDatePicker = ({ selected, onChange, placeholder, className, isRedDeadline }) => {
    return (
        <DatePicker
            selected={selected ? new Date(selected) : null}
            onChange={(date) => {
                // Convert to YYYY-MM-DD string for backend compliance
                if (!date) return onChange(null);
                // Adjust for timezone offset to avoid "day before" bugs
                const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                const dateStr = offsetDate.toISOString().split('T')[0];
                onChange(dateStr);
            }}
            locale="uk"
            dateFormat="dd.MM.yyyy"
            placeholderText={placeholder}
            customInput={
                <CustomInput
                    className={className || `w-full p-1 text-[12px] font-bold bg-white border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${isRedDeadline ? 'border-red-400 text-red-600' : 'border-slate-200 text-slate-700'}`}
                />
            }
            popperClassName="z-50"
            portalId="root-portal" // Ensure it renders above other elements if needed
        />
    );
};

export default UKDatePicker;

'use client';

import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  /**
   * Show an empty default option ("— Chọn —") at the top of the list.
   * Useful for required/optional selects that should be resettable.
   */
  clearable?: boolean;
  /** Text shown for the empty option. Defaults to "— Chọn —". */
  clearLabel?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, error, id, children, clearable, clearLabel = '— Chọn —', ...props },
    ref,
  ) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2, 9)}`;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full appearance-none rounded-xl border border-gray-200 bg-white bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:20px] bg-[right_10px_center] bg-no-repeat px-3.5 py-2.5 pr-10 text-sm text-gray-900 transition-all duration-200 focus:border-swan-400 focus:outline-none focus:ring-4 focus:ring-swan-500/15 disabled:bg-gray-50',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
            className,
          )}
          {...props}
        >
          {clearable && <option value="">{clearLabel}</option>}
          {children}
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';

'use client';

import { forwardRef, TextareaHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/**
 * Shared Textarea primitive used by every form across Swan CRM.
 *
 * A11y wiring (Story A.4, F-MED-02):
 * - `aria-required` reflects the `required` prop so screen readers announce the field as required.
 * - `aria-invalid="true"` is set whenever `error` is present.
 * - `aria-describedby` programmatically links the textarea to the error or hint message
 *   so assistive tech reads the helper text when the field is focused.
 * - A visual asterisk is appended to the label when `required` is true.
 * - `forwardRef` preserves compatibility with react-hook-form's `register()`.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, required, rows = 3, ...props }, ref) => {
    const reactId = useId();
    const baseId = id ?? `ta-${reactId}`;
    const errorId = `${baseId}-error`;
    const hintId = `${baseId}-hint`;
    const describedBy = error ? errorId : hint ? hintId : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={baseId} className="mb-1.5 block text-sm font-medium text-gray-700">
            {label}
            {required && (
              <span aria-hidden="true" className="ml-0.5 text-red-500">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={baseId}
          rows={rows}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-200 focus:border-swan-400 focus:outline-none focus:ring-4 focus:ring-swan-500/15 disabled:bg-gray-50 disabled:text-gray-500 resize-none',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-500/15',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1 text-xs text-red-500">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-gray-400">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
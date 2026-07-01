'use client';

import {
  forwardRef,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Format a raw digit string with Vietnamese thousand separators (dots).
 * Example: "1500000" → "1.500.000"
 *
 * Returns empty string for falsy input (0 or '' displays as empty, since
 * VND zero is more noise than signal in a payment form).
 */
export function formatVNDInput(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '';
  // Remove everything that's not a digit
  const digits = String(raw).replace(/\D/g, '');
  if (!digits || digits === '0') return '';
  // Add thousand separators (dots) from right
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Strip thousand separators to get raw digit string.
 * Example: "1.500.000" → "1500000"
 */
export function parseVNDInput(formatted: string): string {
  return formatted.replace(/\./g, '');
}

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  /** Controlled numeric value (VND, integer). 0/empty shows as empty. */
  value?: number | null;
  /** Uncontrolled default numeric value. */
  defaultValue?: number;
  /** Called whenever the value changes with the raw integer (0 if empty). */
  onChange?: (value: number) => void;
  /** Called on blur with the final integer value. */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Label text displayed above the input. */
  label?: string;
  /** Error message displayed below the input. */
  error?: string;
  /** Hint message displayed below the input (suppressed when error is present). */
  hint?: string;
  /** Placeholder shown when the input is empty. */
  placeholder?: string;
}

/**
 * CurrencyInput — VND-thousand-separator input primitive.
 *
 * Behavior:
 * - On focus: strip thousand separators → raw digits (easy editing)
 * - On blur: format with thousand separators (readable)
 * - Rejects non-digit input (letters, decimals, scientific notation signs)
 * - Paste: strips non-digit characters, converts commas/periods used as
 *   thousand separators, then reformats
 * - Negative values are rejected
 * - No decimal support (VND has no sub-units)
 * - 0 or empty is displayed as empty (UX: zero is more noise than signal
 *   in a payment/case-discount form)
 *
 * A11y:
 * - `aria-required` reflects the `required` prop
 * - `aria-invalid="true"` is set whenever `error` is present
 * - `aria-describedby` links to error or hint text
 * - Visual asterisk appended to label when `required` is true
 * - `role="alert"` on error message for immediate screen reader announcement
 * - `type="text"` + `inputMode="numeric"` for mobile numeric keyboards
 *
 * Form compatibility:
 * - `forwardRef` preserves react-hook-form `register()` compatibility
 * - Supports both controlled (value + onChange) and uncontrolled modes
 * - When uncontrolled, `onChange` reports the current numeric value
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      id,
      required,
      value: controlledValue,
      defaultValue,
      onChange,
      onBlur,
      placeholder = '0',
      disabled,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const baseId = id ?? `ci-${reactId}`;
    const errorId = `${baseId}-error`;
    const hintId = `${baseId}-hint`;
    const describedBy = error ? errorId : hint ? hintId : undefined;

    const innerRef = useRef<HTMLInputElement | null>(null);
    const [displayValue, setDisplayValue] = useState<string>(() => {
      if (controlledValue !== undefined && controlledValue !== null) {
        return formatVNDInput(controlledValue);
      }
      if (defaultValue !== undefined && defaultValue !== null) {
        return formatVNDInput(defaultValue);
      }
      return '';
    });
    const [isFocused, setIsFocused] = useState(false);

    /** Sync the controlled value into displayValue when not focused */
    useEffect(() => {
      if (controlledValue === undefined || controlledValue === null) return;
      if (isFocused) return;
      const formatted = formatVNDInput(controlledValue);
      setDisplayValue((prev) => (prev === formatted ? prev : formatted));
    }, [controlledValue, isFocused]);

    /** Strip non-digit characters from input */
    const sanitizeInput = useCallback((raw: string): string => {
      return raw.replace(/\D/g, '');
    }, []);

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        // On focus: strip separators for easy editing
        setDisplayValue(parseVNDInput(displayValue));
        rest.onFocus?.(e);
      },
      [displayValue, rest],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        // On blur: reformat with separators
        const raw = parseVNDInput(displayValue);
        const formatted = raw ? formatVNDInput(raw) : '';
        setDisplayValue(formatted);

        const numVal = raw ? Number(raw) : 0;
        onChange?.(numVal);
        onBlur?.(e);
      },
      [displayValue, onChange, onBlur],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Strip non-digits on every keystroke
        const digits = sanitizeInput(raw);
        setDisplayValue(digits);

        // Notify parent with numeric value
        onChange?.(digits ? Number(digits) : 0);
      },
      [sanitizeInput, onChange],
    );

    const handlePaste = useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text');
        const digits = sanitizeInput(pasted);

        const input = innerRef.current;
        if (input) {
          // Splice: replace selection with pasted digits
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          const before = parseVNDInput(displayValue).slice(0, start);
          const after = parseVNDInput(displayValue).slice(end);
          const newDigits = before + digits + after;
          setDisplayValue(newDigits);
          onChange?.(newDigits ? Number(newDigits) : 0);
        } else {
          setDisplayValue(digits);
          onChange?.(digits ? Number(digits) : 0);
        }
      },
      [displayValue, sanitizeInput, onChange],
    );

    /** Allow only digit keys, control keys, and navigation keys */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Allow: backspace, delete, tab, escape, enter, arrows, home, end
        if (
          e.key === 'Backspace' ||
          e.key === 'Delete' ||
          e.key === 'Tab' ||
          e.key === 'Escape' ||
          e.key === 'Enter' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'Home' ||
          e.key === 'End'
        ) {
          rest.onKeyDown?.(e);
          return;
        }

        // Allow Ctrl/Cmd + anything (select all, copy, paste, cut, undo, etc.)
        if (e.ctrlKey || e.metaKey) {
          rest.onKeyDown?.(e);
          return;
        }

        // Allow digits only
        if (/^\d$/.test(e.key)) {
          rest.onKeyDown?.(e);
          return;
        }

        // Block everything else (letters, period, comma, minus, e, +, etc.)
        e.preventDefault();
      },
      [rest],
    );

    /** Merge forwarded ref with our inner ref */
    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      },
      [ref],
    );

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={baseId}
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            {label}
            {required && (
              <span aria-hidden="true" className="ml-0.5 text-red-500">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          <input
            ref={setRefs}
            id={baseId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-label={label || rest['aria-label']}
            className={cn(
              'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all duration-200 focus:border-swan-400 focus:outline-none focus:ring-4 focus:ring-swan-500/15 disabled:bg-gray-50 disabled:text-gray-500',
              error &&
                'border-red-400 focus:border-red-400 focus:ring-red-500/15',
              className,
            )}
            {...rest}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-red-500">
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
CurrencyInput.displayName = 'CurrencyInput';

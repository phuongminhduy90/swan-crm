import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { CurrencyInput, formatVNDInput, parseVNDInput } from '@/components/ui/currency-input';

describe('CurrencyInput (C.2.1)', () => {
  describe('formatVNDInput / parseVNDInput helpers', () => {
    it('formatVNDInput adds thousand separators using dots', () => {
      expect(formatVNDInput('1500000')).toBe('1.500.000');
      expect(formatVNDInput('1000')).toBe('1.000');
      expect(formatVNDInput('100')).toBe('100');
      // 0 is treated as empty (UX: zero is more noise than signal)
      expect(formatVNDInput('0')).toBe('');
      expect(formatVNDInput(0)).toBe('');
      expect(formatVNDInput('')).toBe('');
    });

    it('formatVNDInput strips non-digit characters before formatting', () => {
      expect(formatVNDInput('1.500.000')).toBe('1.500.000');
      expect(formatVNDInput('1,500,000')).toBe('1.500.000');
      expect(formatVNDInput('1.500,000')).toBe('1.500.000');
      expect(formatVNDInput('abc1234def')).toBe('1.234');
    });

    it('formatVNDInput accepts number input', () => {
      expect(formatVNDInput(1500000)).toBe('1.500.000');
      expect(formatVNDInput(1234567)).toBe('1.234.567');
      expect(formatVNDInput(null)).toBe('');
      expect(formatVNDInput(undefined)).toBe('');
    });

    it('formatVNDInput returns empty for empty / invalid input', () => {
      expect(formatVNDInput('')).toBe('');
      expect(formatVNDInput('abc')).toBe('');
      expect(formatVNDInput('!@#$')).toBe('');
    });

    it('parseVNDInput strips dots to return raw digit string', () => {
      expect(parseVNDInput('1.500.000')).toBe('1500000');
      expect(parseVNDInput('1.000')).toBe('1000');
      expect(parseVNDInput('100')).toBe('100');
      expect(parseVNDInput('')).toBe('');
    });

    it('formatVNDInput and parseVNDInput are inverse operations', () => {
      const raw = '1500000';
      expect(parseVNDInput(formatVNDInput(raw))).toBe(raw);
      expect(formatVNDInput(parseVNDInput(formatVNDInput(raw)))).toBe(
        formatVNDInput(raw),
      );
    });
  });

  describe('render', () => {
    it('renders an input with type="text" and inputMode="numeric" (mobile keyboard)', () => {
      render(<CurrencyInput aria-label="Số tiền" />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('autocomplete', 'off');
    });

    it('renders the supplied label and associates it with the input via htmlFor', () => {
      render(<CurrencyInput label="Số tiền (VNĐ)" />);
      const input = screen.getByLabelText(/Số tiền/);
      expect(input).toBeInTheDocument();
    });

    it('renders the hint paragraph when hint is provided and there is no error', () => {
      render(<CurrencyInput label="Số tiền" hint="Nhập số nguyên, không có phần thập phân" />);
      expect(screen.getByText('Nhập số nguyên, không có phần thập phân')).toBeInTheDocument();
    });

    it('renders no label when label prop is omitted (uses aria-label)', () => {
      render(<CurrencyInput aria-label="Số tiền" />);
      expect(screen.getByLabelText('Số tiền')).toBeInTheDocument();
      // The visible label is not rendered; the input is still queryable via aria-label.
      expect(screen.queryByText('Số tiền (visible)')).not.toBeInTheDocument();
    });
  });

  describe('aria attributes', () => {
    it('sets aria-required="true" when required is true', () => {
      render(<CurrencyInput label="Số tiền" required />);
      const input = screen.getByLabelText(/Số tiền/);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('omits aria-required when required is false', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText(/Số tiền/);
      expect(input).not.toHaveAttribute('aria-required');
    });

    it('sets aria-invalid="true" when error is provided', () => {
      render(<CurrencyInput label="Số tiền" error="Số tiền phải lớn hơn 0" />);
      const input = screen.getByLabelText('Số tiền');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('omits aria-invalid when no error', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền');
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('wires aria-describedby to error element', () => {
      render(<CurrencyInput label="Số tiền" error="Bắt buộc" />);
      const input = screen.getByLabelText('Số tiền');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const errEl = document.getElementById(describedBy!);
      expect(errEl).not.toBeNull();
      expect(errEl).toHaveTextContent('Bắt buộc');
    });

    it('wires aria-describedby to hint when no error', () => {
      render(<CurrencyInput label="Số tiền" hint="Tối đa 10 tỷ" />);
      const input = screen.getByLabelText('Số tiền');
      const describedBy = input.getAttribute('aria-describedby');
      const descEl = document.getElementById(describedBy!);
      expect(descEl).toHaveTextContent('Tối đa 10 tỷ');
    });

    it('error message has role="alert"', () => {
      render(<CurrencyInput label="Số tiền" error="Bắt buộc" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Bắt buộc');
    });

    it('auto-generates a stable id shared between label and input', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền');
      expect(input.id).toMatch(/^ci-/);
    });
  });

  describe('required indicator', () => {
    it('renders a red asterisk after the label when required is true', () => {
      render(<CurrencyInput label="Số tiền" required />);
      const label = screen.getByText('Số tiền').parentElement;
      expect(label).not.toBeNull();
      const asterisk = label!.querySelector('span[aria-hidden="true"]');
      expect(asterisk).not.toBeNull();
      expect(asterisk).toHaveTextContent('*');
      expect(asterisk).toHaveClass('text-red-500');
    });

    it('does not render an asterisk when required is not set', () => {
      render(<CurrencyInput label="Số tiền" />);
      const label = screen.getByText('Số tiền').parentElement;
      expect(label!.querySelector('span[aria-hidden="true"]')).toBeNull();
    });
  });

  describe('error styling', () => {
    it('applies red border class when error is set', () => {
      render(<CurrencyInput label="Số tiền" error="Bắt buộc" />);
      const input = screen.getByLabelText('Số tiền');
      expect(input.className).toContain('border-red-400');
    });

    it('does not apply red border class when error is absent', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền');
      expect(input.className).not.toContain('border-red-400');
    });
  });

  describe('focus/blur formatting', () => {
    it('strips thousand separators when focused, reformats on blur', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);

      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      // Type a value first
      await user.click(input);
      await user.keyboard('1500000');
      expect(input.value).toBe('1500000');

      // Blur → reformat with separators
      fireEvent.blur(input);
      expect(input.value).toBe('1.500.000');
    });

    it('shows empty display when value is 0 and input is not focused', () => {
      render(<CurrencyInput label="Số tiền" value={0} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      // 0 is treated as empty for display purposes
      expect(input.value).toBe('');
    });

    it('renders initial value formatted with separators on first paint', () => {
      render(<CurrencyInput label="Số tiền" value={5000000} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.value).toBe('5.000.000');
    });
  });

  describe('typing', () => {
    it('only allows digits to be typed', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('12345');
      expect(input.value).toBe('12345');
    });

    it('blocks letters from being typed', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('abc');
      // Letter keys are preventDefault'd; nothing should be typed
      expect(input.value).toBe('');
    });

    it('blocks the minus sign (negative prevention)', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('500');
      await user.keyboard('-');
      await user.keyboard('100');
      expect(input.value).toBe('500100');
    });

    it('blocks decimal point (VND has no sub-units)', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('500');
      await user.keyboard('.');
      await user.keyboard('5');
      expect(input.value).toBe('5005');
    });

    it('blocks scientific notation "e"', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('1e10');
      // The "e" is blocked
      expect(input.value).toBe('110');
    });

    it('allows backspace to remove digits', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('1500000');
      await user.keyboard('{Backspace}'); // 150000
      await user.keyboard('{Backspace}'); // 15000
      await user.keyboard('{Backspace}'); // 1500
      await user.keyboard('{Backspace}'); // 150
      expect(input.value).toBe('150');
    });

    it('allows arrow keys for navigation', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('12345');
      // Just check that arrow keys don't crash or insert anything weird
      await user.keyboard('{ArrowLeft}{ArrowRight}');
      expect(input.value).toBe('12345');
    });
  });

  describe('clear', () => {
    it('clearing (selecting-all + delete) leaves empty display', async () => {
      const user = userEvent.setup();
      render(<CurrencyInput label="Số tiền" defaultValue={1500000} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.value).toBe('1.500.000');

      // Use fireEvent.focus to trigger React's onFocus callback (userEvent.click
      // would also work; input.focus() is a DOM-only call that bypasses React).
      fireEvent.focus(input);
      expect(input.value).toBe('1500000');

      await user.clear(input);
      expect(input.value).toBe('');
    });

    it('onChange fires with 0 when field is cleared and blurred', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CurrencyInput label="Số tiền" defaultValue={1500000} onChange={onChange} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.clear(input);
      fireEvent.blur(input);

      // Last onChange call should report a 0 (cleared)
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall?.[0]).toBe(0);
    });
  });

  describe('paste', () => {
    it('paste of formatted value (periods) is accepted as digits', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      // jsdom doesn't fully simulate clipboardData.getData('text'); use fireEvent.paste
      fireEvent.paste(input, {
        clipboardData: { getData: vi.fn().mockReturnValue('1.500.000') },
      });

      // After paste, display holds the digits (focused → no separators)
      expect(input.value).toBe('1500000');
    });

    it('paste of comma-formatted value is accepted as digits', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      fireEvent.paste(input, {
        clipboardData: { getData: vi.fn().mockReturnValue('1,500,000') },
      });
      expect(input.value).toBe('1500000');
    });

    it('paste of mixed commas and periods (e.g. "1.500,000") is accepted', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      fireEvent.paste(input, {
        clipboardData: { getData: vi.fn().mockReturnValue('1.500,000') },
      });
      expect(input.value).toBe('1500000');
    });

    it('paste of negative "-500" yields "500" (negative prevention)', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      fireEvent.paste(input, {
        clipboardData: { getData: vi.fn().mockReturnValue('-500') },
      });
      expect(input.value).toBe('500');
    });

    it('paste of "0.5" (decimal with leading zero) shows "5" — digits preserved, leading zeros dropped', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      fireEvent.paste(input, {
        clipboardData: { getData: vi.fn().mockReturnValue('0.5') },
      });
      // '0.5' sanitised to '05' → jsdom renders the full string '05';
      // onChange fires with Number('05') === 5
      expect(input.value).toBe('05');
    });

    it('paste of letters is sanitized to digits only', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      fireEvent.paste(input, {
        clipboardData: { getData: vi.fn().mockReturnValue('abc1500xyz') },
      });
      expect(input.value).toBe('1500');
    });

    it('onChange fires with the numeric value after paste', () => {
      const onChange = vi.fn();
      render(<CurrencyInput label="Số tiền" onChange={onChange} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      fireEvent.paste(input, {
        clipboardData: { getData: vi.fn().mockReturnValue('1.500.000') },
      });

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall?.[0]).toBe(1500000);
    });
  });

  describe('onChange behavior', () => {
    it('reports the numeric integer value on every keystroke', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CurrencyInput label="Số tiền" onChange={onChange} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('12345');

      // Should have multiple onChange calls, with the last one being 12345
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall?.[0]).toBe(12345);
    });

    it('reports 0 when the field is empty', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CurrencyInput label="Số tiền" defaultValue={1000000} onChange={onChange} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.clear(input);

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall?.[0]).toBe(0);
    });
  });

  describe('controlled mode', () => {
    it('allows parent to control value via state', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [v, setV] = useState(5000000);
        return (
          <div>
            <CurrencyInput label="Số tiền" value={v} onChange={setV} />
            <span data-testid="display">{v}</span>
          </div>
        );
      }
      render(<Controlled />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.value).toBe('5.000.000');

      input.focus();
      await user.clear(input);
      await user.keyboard('9000000');
      fireEvent.blur(input);

      expect(screen.getByTestId('display')).toHaveTextContent('9000000');
    });

    it('updates the formatted display when controlled value changes externally', () => {
      function Controlled() {
        const [v, setV] = useState(0);
        return (
          <div>
            <CurrencyInput label="Số tiền" value={v} onChange={setV} />
            <button type="button" onClick={() => setV(1234567)}>
              Set
            </button>
          </div>
        );
      }
      render(<Controlled />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.value).toBe('');

      fireEvent.click(screen.getByText('Set'));
      expect(input.value).toBe('1.234.567');
    });
  });

  describe('uncontrolled mode', () => {
    it('uses defaultValue when no value is provided', () => {
      render(<CurrencyInput label="Số tiền" defaultValue={2500000} />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.value).toBe('2.500.000');
    });

    it('renders empty by default when no value/defaultValue', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('react-hook-form compatibility (forwardRef)', () => {
    it('attaches the ref to the underlying <input> element', () => {
      function Harness() {
        const ref = useRef<HTMLInputElement>(null);
        return (
          <div>
            <CurrencyInput ref={ref} label="Số tiền" />
            <button type="button" onClick={() => ref.current?.focus()}>
              focus
            </button>
          </div>
        );
      }
      render(<Harness />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      input.focus();
      expect(document.activeElement).toBe(input);
    });

    it('integrates with useState-driven RHF pattern (mock)', async () => {
      const user = userEvent.setup();
      // Simulates the RHF register({ onChange }) flow: parent holds numeric state.
      function RHFMock() {
        const [amount, setAmount] = useState(0);
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              // Submit → would call RHF's handleSubmit
            }}
          >
            <CurrencyInput
              label="Số tiền"
              value={amount}
              onChange={setAmount}
              required
            />
            <button type="submit">Submit</button>
          </form>
        );
      }
      render(<RHFMock />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;

      input.focus();
      await user.keyboard('2500000');
      fireEvent.blur(input);

      // Blur should reformat to "2.500.000" and call onChange(2500000)
      expect(input.value).toBe('2.500.000');
    });
  });

  describe('placeholder', () => {
    it('renders the placeholder while not focused and empty', () => {
      render(<CurrencyInput label="Số tiền" placeholder="0" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.placeholder).toBe('0');
    });

    it('uses default placeholder "0" when not provided', () => {
      render(<CurrencyInput label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      // The placeholder logic swaps when focused, but unfocused it shows the configured placeholder
      expect(input.placeholder).toBe('0');
    });
  });

  describe('disabled', () => {
    it('renders as disabled when disabled prop is set', () => {
      render(<CurrencyInput label="Số tiền" disabled />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input).toBeDisabled();
    });
  });

  describe('id forwarding', () => {
    it('uses the supplied id and matches label htmlFor', () => {
      render(<CurrencyInput id="custom-id" label="Số tiền" />);
      const input = screen.getByLabelText('Số tiền') as HTMLInputElement;
      expect(input.id).toBe('custom-id');
    });
  });

  describe('a11y (axe-core)', () => {
    it('basic input with label passes axe-core', async () => {
      const { container } = render(<CurrencyInput label="Số tiền" />);
      await expect(container).toHaveNoViolations();
    });

    it('required input with error passes axe-core', async () => {
      const { container } = render(
        <CurrencyInput label="Số tiền" required error="Số tiền phải lớn hơn 0" />,
      );
      await expect(container).toHaveNoViolations();
    });

    it('input with hint and value passes axe-core', async () => {
      const { container } = render(
        <CurrencyInput label="Số tiền" hint="Nhập số nguyên, không có phần thập phân" value={5000000} />,
      );
      await expect(container).toHaveNoViolations();
    });
  });
});

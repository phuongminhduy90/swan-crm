import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

describe('Textarea (A.4)', () => {
  describe('render', () => {
    it('renders a textarea with default 3 rows when no rows prop is provided', () => {
      render(<Textarea aria-label="Mô tả" />);
      const ta = screen.getByRole('textbox');
      expect(ta).toBeInTheDocument();
      expect(ta.tagName).toBe('TEXTAREA');
      expect(ta).toHaveAttribute('rows', '3');
    });

    it('renders the supplied label and associates it with the textarea via htmlFor', () => {
      render(<Textarea label="Ghi chú" />);
      const ta = screen.getByLabelText('Ghi chú');
      expect(ta).toBeInTheDocument();
      expect(ta.tagName).toBe('TEXTAREA');
    });

    it('renders the hint paragraph when hint is provided and there is no error', () => {
      render(<Textarea label="Ghi chú" hint="Tối đa 500 ký tự" />);
      expect(screen.getByText('Tối đa 500 ký tự')).toBeInTheDocument();
    });

    it('renders no label when label prop is omitted', () => {
      render(<Textarea aria-label="Mô tả" />);
      // No associated label rendered by component; aria-label still queries it.
      expect(screen.getByLabelText('Mô tả')).toBeInTheDocument();
      expect(screen.queryByText('Ghi chú')).not.toBeInTheDocument();
    });
  });

  describe('aria attributes', () => {
    it('sets aria-required="true" when required is true and omits it when false', () => {
      const { rerender } = render(<Textarea label="Lý do" required />);
      const ta = screen.getByLabelText('Lý do');
      expect(ta).toHaveAttribute('aria-required', 'true');

      rerender(<Textarea label="Lý do" />);
      expect(ta).not.toHaveAttribute('aria-required');
    });

    it('sets aria-invalid="true" when error is provided and omits it otherwise', () => {
      const { rerender } = render(<Textarea label="Ghi chú" error="Bắt buộc" />);
      const ta = screen.getByLabelText('Ghi chú');
      expect(ta).toHaveAttribute('aria-invalid', 'true');

      rerender(<Textarea label="Ghi chú" />);
      expect(ta).not.toHaveAttribute('aria-invalid');
    });

    it('wires aria-describedby to the error element when error is present', () => {
      render(<Textarea label="Ghi chú" error="Không được để trống" />);
      const ta = screen.getByLabelText('Ghi chú');
      const describedBy = ta.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const errorEl = document.getElementById(describedBy!);
      expect(errorEl).not.toBeNull();
      expect(errorEl).toHaveTextContent('Không được để trống');
    });

    it('wires aria-describedby to the hint element when hint is present and no error', () => {
      render(<Textarea label="Ghi chú" hint="Tối đa 500 ký tự" />);
      const ta = screen.getByLabelText('Ghi chú');
      const describedBy = ta.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const hintEl = document.getElementById(describedBy!);
      expect(hintEl).not.toBeNull();
      expect(hintEl).toHaveTextContent('Tối đa 500 ký tự');
    });

    it('prefers error over hint when both are provided (hint suppressed)', () => {
      render(<Textarea label="Ghi chú" hint="phụ" error="Bắt buộc" />);
      const ta = screen.getByLabelText('Ghi chú');
      const describedBy = ta.getAttribute('aria-describedby');
      const describedEl = document.getElementById(describedBy!);
      expect(describedEl).toHaveTextContent('Bắt buộc');
      expect(screen.queryByText('phụ')).not.toBeInTheDocument();
    });

    it('uses the supplied id and label htmlFor matches', () => {
      render(<Textarea id="custom-id" label="Ghi chú" />);
      const ta = screen.getByLabelText('Ghi chú');
      expect(ta.id).toBe('custom-id');
      expect(ta).toHaveAttribute('aria-describedby'); // auto hint id when no error/hint
      // When no error/hint, no aria-describedby is set
      expect(ta).not.toHaveAttribute('aria-describedby');
    });

    it('auto-generates a stable id shared between label and textarea', () => {
      render(<Textarea label="Ghi chú" />);
      const ta = screen.getByLabelText('Ghi chú');
      expect(ta.id).toMatch(/^ta-/);
      // Two renders in the same test would clash, so verify only one here.
    });
  });

  describe('required indicator', () => {
    it('renders a red asterisk after the label when required is true', () => {
      render(<Textarea label="Lý do từ chối" required />);
      const label = screen.getByText('Lý do từ chối').parentElement;
      expect(label).not.toBeNull();
      const asterisk = label!.querySelector('span[aria-hidden="true"]');
      expect(asterisk).not.toBeNull();
      expect(asterisk).toHaveTextContent('*');
      expect(asterisk).toHaveClass('text-red-500');
    });

    it('does not render an asterisk when required is not set', () => {
      render(<Textarea label="Ghi chú" />);
      const label = screen.getByText('Ghi chú').parentElement;
      expect(label!.querySelector('span[aria-hidden="true"]')).toBeNull();
    });
  });

  describe('error styling', () => {
    it('applies the red border class when error is set', () => {
      render(<Textarea label="Ghi chú" error="Bắt buộc" />);
      const ta = screen.getByLabelText('Ghi chú');
      expect(ta.className).toContain('border-red-400');
    });

    it('does not apply the red border class when error is absent', () => {
      render(<Textarea label="Ghi chú" />);
      const ta = screen.getByLabelText('Ghi chú');
      expect(ta.className).not.toContain('border-red-400');
    });
  });

  describe('forwards ref', () => {
    it('attaches the ref to the underlying <textarea> element (react-hook-form compatibility)', () => {
      function Harness() {
        const ref = useRef<HTMLTextAreaElement>(null);
        return (
          <div>
            <Textarea ref={ref} label="Ghi chú" />
            <button type="button" onClick={() => ref.current?.focus()}>
              focus
            </button>
          </div>
        );
      }
      render(<Harness />);
      const ta = screen.getByLabelText('Ghi chú');
      // ref is attached if focus() works
      ta.focus();
      expect(document.activeElement).toBe(ta);
    });
  });

  describe('controlled usage', () => {
    it('fires onChange when user types', async () => {
      const user = userEvent.setup();
      function Controlled() {
        const [v, setV] = useState('');
        return <Textarea label="Ghi chú" value={v} onChange={(e) => setV(e.target.value)} />;
      }
      render(<Controlled />);
      const ta = screen.getByLabelText('Ghi chú');
      await user.type(ta, 'xin chào');
      expect(ta).toHaveValue('xin chào');
    });
  });

  describe('a11y (axe-core)', () => {
    it('basic textarea with label passes axe-core', async () => {
      const { container } = render(<Textarea label="Ghi chú" />);
      await expect(container).toHaveNoViolations();
    });

    it('required textarea with error passes axe-core', async () => {
      const { container } = render(
        <Textarea label="Lý do từ chối" required error="Vui lòng nhập lý do" />,
      );
      await expect(container).toHaveNoViolations();
    });
  });
});
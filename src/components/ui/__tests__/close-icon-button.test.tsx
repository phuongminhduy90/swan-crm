import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderWithProviders } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { CloseIconButton } from '@/components/ui/close-icon-button';

describe('CloseIconButton (A.3)', () => {
  describe('render & ARIA', () => {
    it('renders as a <button type="button"> with aria-label="Đóng" by default', () => {
      render(<CloseIconButton onClose={() => {}} />);
      const button = screen.getByRole('button', { name: 'Đóng' });
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-label', 'Đóng');
    });

    it('uses a custom ariaLabel when provided', () => {
      render(<CloseIconButton onClose={() => {}} ariaLabel="Đóng hộp thoại" />);
      const button = screen.getByRole('button', { name: 'Đóng hộp thoại' });
      expect(button).toBeInTheDocument();
    });

    it('renders the Lucide X icon as a decorative, aria-hidden SVG', () => {
      const { container } = render(<CloseIconButton onClose={() => {}} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('forwards an external className to the rendered button', () => {
      render(
        <CloseIconButton onClose={() => {}} className="absolute right-4 top-4" />,
      );
      const button = screen.getByRole('button', { name: 'Đóng' });
      expect(button).toHaveClass('absolute');
      expect(button).toHaveClass('right-4');
      expect(button).toHaveClass('top-4');
    });

    it('exposes a visible focus ring for keyboard users', () => {
      render(<CloseIconButton onClose={() => {}} />);
      const button = screen.getByRole('button', { name: 'Đóng' });
      // Tailwind compiles `focus-visible:ring-2` into a class fragment.
      expect(button.className).toMatch(/focus-visible:ring-2/);
    });

    it('does not render a visible text label — accessible name comes from aria-label only', () => {
      render(<CloseIconButton onClose={() => {}} />);
      const button = screen.getByRole('button', { name: 'Đóng' });
      // The button has no inner text node — only an aria-hidden SVG.
      expect(button.textContent).toBe('');
    });
  });

  describe('click behavior', () => {
    it('calls onClose with the underlying mouse event when clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CloseIconButton onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Đóng' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      // jsdom user-event dispatches SyntheticBaseEvent wrappers around the
      // real DOM MouseEvent — we only assert the argument was passed, not its
      // exact runtime class.
      expect(onClose.mock.calls[0]?.[0]).toBeDefined();
    });

    it('falls back to native onClick when onClose is not provided', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<CloseIconButton onClick={onClick} />);

      await user.click(screen.getByRole('button', { name: 'Đóng' }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('invokes both onClose and onClick when both are supplied', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onClick = vi.fn();
      render(<CloseIconButton onClose={onClose} onClick={onClick} />);

      await user.click(screen.getByRole('button', { name: 'Đóng' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('skips the native onClick fallback when onClose calls preventDefault', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn((event) => event.preventDefault());
      const onClick = vi.fn();
      render(<CloseIconButton onClose={onClose} onClick={onClick} />);

      await user.click(screen.getByRole('button', { name: 'Đóng' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not fire onClose when disabled', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CloseIconButton onClose={onClose} disabled />);

      const button = screen.getByRole('button', { name: 'Đóng' });
      expect(button).toBeDisabled();
      await user.click(button);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('keyboard activation', () => {
    it('fires onClose when activated via Space', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CloseIconButton onClose={onClose} />);

      const button = screen.getByRole('button', { name: 'Đóng' });
      button.focus();
      await user.keyboard(' ');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('fires onClose when activated via Enter', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<CloseIconButton onClose={onClose} />);

      const button = screen.getByRole('button', { name: 'Đóng' });
      button.focus();
      await user.keyboard('{Enter}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('sizing variants', () => {
    it('default size applies h-4 / w-4 to the descendant SVG', () => {
      render(<CloseIconButton onClose={() => {}} />);
      const button = screen.getByRole('button', { name: 'Đóng' });
      // Tailwind arbitrary variant `[&_svg]:h-4` lives on the parent button.
      expect(button.className).toMatch(/\[&_svg\]:h-4/);
      expect(button.className).toMatch(/\[&_svg\]:w-4/);
    });

    it('sm size applies h-3.5 / w-3.5 to the descendant SVG', () => {
      render(<CloseIconButton onClose={() => {}} size="sm" />);
      const button = screen.getByRole('button', { name: 'Đóng' });
      expect(button.className).toMatch(/\[&_svg\]:h-3\.5/);
      expect(button.className).toMatch(/\[&_svg\]:w-3\.5/);
    });
  });

  describe('forwarded props', () => {
    it('forwards arbitrary HTML attributes (e.g. data-testid)', () => {
      render(<CloseIconButton onClose={() => {}} data-testid="close-x" />);
      expect(screen.getByTestId('close-x')).toBeInTheDocument();
    });

    it('exposes a ref to the rendered button element', () => {
      let captured: HTMLButtonElement | null = null;
      render(
        <CloseIconButton
          onClose={() => {}}
          ref={(node) => {
            captured = node;
          }}
        />,
      );
      expect(captured).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe('a11y (axe-core)', () => {
    it('has no axe-core violations on the standalone button', async () => {
      const { container } = renderWithProviders(<CloseIconButton onClose={() => {}} />);
      await expect(container).toHaveNoViolations();
    });

    it('has no axe-core violations with a custom ariaLabel', async () => {
      const { container } = renderWithProviders(
        <CloseIconButton onClose={() => {}} ariaLabel="Đóng hộp thoại" />,
      );
      await expect(container).toHaveNoViolations();
    });
  });
});
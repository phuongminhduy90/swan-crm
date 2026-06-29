import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderWithProviders, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';

describe('Modal (A.2)', () => {
  describe('render & basic ARIA', () => {
    it('renders role="dialog" and aria-modal="true" when open', () => {
      render(
        <Modal open onClose={() => {}} title="Tiêu đề">
          <p>nội dung</p>
        </Modal>,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('renders nothing when closed (open=false)', () => {
      const { container } = render(
        <Modal open={false} onClose={() => {}} title="Tiêu đề">
          <p>nội dung</p>
        </Modal>,
      );
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders an <h2> with the title text when title is provided', () => {
      render(
        <Modal open onClose={() => {}} title="Tạo khách hàng">
          <p>nội dung</p>
        </Modal>,
      );
      const heading = screen.getByRole('heading', { level: 2, name: 'Tạo khách hàng' });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H2');
    });

    it('renders a description <p> with the description text when description is provided', () => {
      render(
        <Modal
          open
          onClose={() => {}}
          title="Tiêu đề"
          description="Mô tả phụ"
        >
          <div data-testid="body">nội dung</div>
        </Modal>,
      );
      // The description <p> lives inside the dialog header, not in children.
      const dialog = screen.getByRole('dialog');
      const descriptionEl = within(dialog).getByText('Mô tả phụ');
      expect(descriptionEl.tagName).toBe('P');
    });

    it('omits the header <h2> when title is not provided', () => {
      render(
        <Modal open onClose={() => {}}>
          <div data-testid="body">nội dung</div>
        </Modal>,
      );
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    });
  });

  describe('aria-labelledby / aria-describedby', () => {
    it('auto-generates a title id and wires aria-labelledby when titleId is not provided', () => {
      render(
        <Modal open onClose={() => {}} title="Tiêu đề">
          <p>nội dung</p>
        </Modal>,
      );
      const dialog = screen.getByRole('dialog');
      const heading = screen.getByRole('heading', { level: 2 });
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(heading.id).toBe(labelledBy);
    });

    it('auto-generates a description id and wires aria-describedby when descriptionId is not provided', () => {
      render(
        <Modal
          open
          onClose={() => {}}
          title="Tiêu đề"
          description="Mô tả"
        >
          <p>nội dung</p>
        </Modal>,
      );
      const dialog = screen.getByRole('dialog');
      const descriptionId = dialog.getAttribute('aria-describedby');
      expect(descriptionId).toBeTruthy();
      const descriptionEl = document.getElementById(descriptionId as string);
      expect(descriptionEl).not.toBeNull();
      expect(descriptionEl?.textContent).toBe('Mô tả');
    });

    it('uses the consumer-provided titleId on the <h2> and aria-labelledby', () => {
      const { container } = render(
        <Modal
          open
          onClose={() => {}}
          title="Tiêu đề"
          titleId="my-title"
        >
          <p>nội dung</p>
        </Modal>,
      );
      const heading = container.querySelector('h2');
      expect(heading?.id).toBe('my-title');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'my-title');
    });

    it('uses the consumer-provided descriptionId on the <p> and aria-describedby', () => {
      render(
        <Modal
          open
          onClose={() => {}}
          title="Tiêu đề"
          description="Mô tả"
          descriptionId="my-desc"
        >
          <p>nội dung</p>
        </Modal>,
      );
      const descriptionEl = document.getElementById('my-desc');
      expect(descriptionEl).not.toBeNull();
      expect(descriptionEl?.tagName).toBe('P');
      expect(descriptionEl?.textContent).toBe('Mô tả');
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'my-desc');
    });

    it('does not wire aria-labelledby or aria-describedby when neither title nor description is provided', () => {
      render(
        <Modal open onClose={() => {}}>
          <p>nội dung</p>
        </Modal>,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-labelledby');
      expect(dialog).not.toHaveAttribute('aria-describedby');
    });
  });

  describe('focus on open', () => {
    function TwoButtonHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button data-testid="trigger" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="T">
            <button data-testid="first">First</button>
            <button data-testid="second">Second</button>
          </Modal>
        </>
      );
    }

    it('focuses the first focusable element inside the dialog on open', async () => {
      const user = userEvent.setup();
      render(<TwoButtonHarness />);
      await user.click(screen.getByTestId('trigger'));

      // The close button is the first focusable in DOM order (Modal renders
      // it before the body content). Confirm focus moved into the dialog.
      const closeButton = await screen.findByRole('button', { name: 'Đóng' });
      expect(closeButton).toHaveFocus();
    });

    it('focuses the close button (first focusable in DOM order) when only the panel renders', async () => {
      // Even when no title/description and no interactive children are passed,
      // the Modal's built-in close button is always rendered and is the first
      // focusable element in DOM order. So the close button receives focus.
      function EmptyBodyHarness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button data-testid="trigger" onClick={() => setOpen(true)}>
              Open
            </button>
            <Modal open={open} onClose={() => setOpen(false)}>
              <span>chỉ có text, không có focusable con</span>
            </Modal>
          </>
        );
      }
      const user = userEvent.setup();
      render(<EmptyBodyHarness />);
      await user.click(screen.getByTestId('trigger'));

      const closeButton = await screen.findByRole('button', { name: 'Đóng' });
      expect(closeButton).toHaveFocus();
    });
  });

  describe('focus trap — Tab cycling', () => {
    function ThreeButtonHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button data-testid="trigger" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="T">
            <button data-testid="a">A</button>
            <button data-testid="b">B</button>
            <button data-testid="c">C</button>
          </Modal>
        </>
      );
    }

    // Focusable DOM order inside the panel (close button is rendered first):
    //   1. close (aria-label="Đóng")
    //   2. a, 3. b, 4. c
    // Tab cycle: close → a → b → c → close.

    it('Tab from the last focusable wraps to the first (close button)', async () => {
      const user = userEvent.setup();
      render(<ThreeButtonHarness />);
      await user.click(screen.getByTestId('trigger'));

      const c = screen.getByTestId('c');
      const closeButton = screen.getByRole('button', { name: 'Đóng' });
      c.focus();
      expect(c).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(closeButton).toHaveFocus();
    });

    it('Shift+Tab from the close button wraps to the last focusable', async () => {
      const user = userEvent.setup();
      render(<ThreeButtonHarness />);
      await user.click(screen.getByTestId('trigger'));

      const closeButton = screen.getByRole('button', { name: 'Đóng' });
      const c = screen.getByTestId('c');
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(c).toHaveFocus();
    });

    it('Tab between non-wrap positions lets the browser move focus normally', async () => {
      const user = userEvent.setup();
      render(<ThreeButtonHarness />);
      await user.click(screen.getByTestId('trigger'));

      const a = await screen.findByTestId('a');
      const b = screen.getByTestId('b');
      a.focus();
      await user.keyboard('{Tab}');
      expect(b).toHaveFocus();
    });
  });

  describe('ESC closes', () => {
    it('pressing Escape inside the dialog calls onClose', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} title="T">
          <button data-testid="inside">Inside</button>
        </Modal>,
      );
      await user.click(screen.getByTestId('inside'));
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('focus return on close', () => {
    it('restores focus to the trigger button after the modal closes', async () => {
      const user = userEvent.setup();
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button data-testid="trigger" onClick={() => setOpen(true)}>
              Open
            </button>
            <Modal open={open} onClose={() => setOpen(false)} title="T">
              <button data-testid="inside">Inside</button>
            </Modal>
          </>
        );
      }
      render(<Harness />);
      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      // Confirm focus moved into the dialog (close button is first focusable).
      const closeButton = await screen.findByRole('button', { name: 'Đóng' });
      expect(closeButton).toHaveFocus();

      // Close via the close button (X) — fires onClose → parent sets open=false.
      await user.click(closeButton);

      // The dialog should be gone and the trigger should have focus again.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('does not throw when restoring focus to a stale element', () => {
      function Harness() {
        const [open, setOpen] = useState(true);
        // Stale ref that will not be in the DOM after unmount.
        const staleRef = useRef<HTMLButtonElement>(null);
        return (
          <>
            <button
              ref={staleRef}
              data-testid="stale"
              style={{ display: 'none' }}
            >
              stale
            </button>
            <Modal open={open} onClose={() => setOpen(false)} title="T">
              <button>X</button>
            </Modal>
          </>
        );
      }
      const { unmount } = render(<Harness />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('backdrop click', () => {
    it('clicking the overlay (outside the panel) calls onClose', async () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal open onClose={onClose} title="T">
          <button data-testid="inside">Inside</button>
        </Modal>,
      );
      // The overlay is the outermost fixed wrapper. Dispatch a click whose
      // target is the overlay element directly (not a descendant).
      const overlay = container.querySelector('.fixed.inset-0.z-50') as HTMLElement;
      const evt = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(evt, 'target', { value: overlay, writable: false });
      overlay.dispatchEvent(evt);
      expect(onClose).toHaveBeenCalled();
    });

    it('clicking inside the panel does NOT call onClose', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} title="T">
          <button data-testid="inside">Inside</button>
        </Modal>,
      );
      await user.click(screen.getByTestId('inside'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('body scroll lock', () => {
    it('locks body scroll when open and restores it when closed', async () => {
      const user = userEvent.setup();
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button data-testid="open" onClick={() => setOpen(true)}>
              Open
            </button>
            <button data-testid="close" onClick={() => setOpen(false)}>
              Close
            </button>
            <Modal open={open} onClose={() => setOpen(false)} title="T">
              <span>x</span>
            </Modal>
          </>
        );
      }
      render(<Harness />);

      expect(document.body.style.overflow).toBe('');
      await user.click(screen.getByTestId('open'));
      expect(document.body.style.overflow).toBe('hidden');

      await user.click(screen.getByTestId('close'));
      expect(document.body.style.overflow).toBe('');
    });

    it('restores body scroll on unmount even when open is still true', () => {
      const { unmount } = render(
        <Modal open onClose={() => {}} title="T">
          <span>x</span>
        </Modal>,
      );
      expect(document.body.style.overflow).toBe('hidden');
      unmount();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('a11y (axe-core)', () => {
    it('has no axe-core violations when title + description are set', async () => {
      const { container } = renderWithProviders(
        <Modal open onClose={() => {}} title="Tiêu đề" description="Mô tả">
          <label>
            Tên
            <input type="text" />
          </label>
        </Modal>,
      );
      const dialog = container.querySelector('[role="dialog"]') as Element;
      await expect(dialog).toHaveNoViolations();
    });

    it('has no axe-core violations with explicit titleId and descriptionId', async () => {
      const { container } = renderWithProviders(
        <Modal
          open
          onClose={() => {}}
          title="Tiêu đề"
          description="Mô tả"
          titleId="t"
          descriptionId="d"
        >
          <label>
            Tên
            <input type="text" />
          </label>
        </Modal>,
      );
      const dialog = container.querySelector('[role="dialog"]') as Element;
      await expect(dialog).toHaveNoViolations();
    });
  });
});
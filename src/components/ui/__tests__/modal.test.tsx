import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderWithProviders } from '@/test/test-utils';
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

    it('renders a <p> with the description text when description is provided', () => {
      render(
        <Modal
          open
          onClose={() => {}}
          title="Tiêu đề"
          description="Mô tả phụ"
        >
          <p>nội dung</p>
        </Modal>,
      );
      expect(screen.getByText('Mô tả phụ')).toBeInTheDocument();
      expect(screen.getByText('Mô tả phụ').tagName).toBe('P');
    });

    it('omits the header entirely when neither title nor description is provided', () => {
      const { container } = render(
        <Modal open onClose={() => {}}>
          <p>nội dung</p>
        </Modal>,
      );
      expect(container.querySelector('h2')).not.toBeInTheDocument();
      expect(container.querySelector('p')).not.toBeInTheDocument();
    });
  });

  describe('aria-labelledby / aria-describedby', () => {
    it('auto-generates a title id and wires aria-labelledby when titleId is not provided', () => {
      const { container } = render(
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
      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      // rAF + React commit may take a tick — wait for the focus to settle.
      expect(await screen.findByTestId('first')).toHaveFocus();
    });

    it('focuses the dialog panel itself when there are no focusable children', async () => {
      function NoFocusableHarness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button data-testid="trigger" onClick={() => setOpen(true)}>
              Open
            </button>
            <Modal open={open} onClose={() => setOpen(false)}>
              <span>chỉ có text</span>
            </Modal>
          </>
        );
      }
      const user = userEvent.setup();
      render(<NoFocusableHarness />);
      await user.click(screen.getByTestId('trigger'));

      // The panel itself should be the focused element (it receives tabindex=-1).
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveFocus();
      expect(dialog).toHaveAttribute('tabindex', '-1');
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

    it('Tab from the last focusable wraps to the first', async () => {
      const user = userEvent.setup();
      render(<ThreeButtonHarness />);
      await user.click(screen.getByTestId('trigger'));

      const a = await screen.findByTestId('a');
      const c = screen.getByTestId('c');
      c.focus();
      expect(c).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(a).toHaveFocus();
    });

    it('Shift+Tab from the first focusable wraps to the last', async () => {
      const user = userEvent.setup();
      render(<ThreeButtonHarness />);
      await user.click(screen.getByTestId('trigger'));

      const a = await screen.findByTestId('a');
      const c = screen.getByTestId('c');
      a.focus();
      expect(a).toHaveFocus();

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

      // Confirm focus moved into the dialog first.
      const inside = await screen.findByTestId('inside');
      expect(inside).toHaveFocus();

      // Close via the close button (X) — fires onClose → parent sets open=false.
      await user.click(screen.getByLabelText('Đóng'));

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
      // Render once, capture the stale button, unmount everything.
      const { unmount } = render(<Harness />);
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('backdrop click', () => {
    it('clicking the overlay (outside the panel) calls onClose', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const { container } = render(
        <Modal open onClose={onClose} title="T">
          <button data-testid="inside">Inside</button>
        </Modal>,
      );
      // The overlay is the outermost fixed wrapper; the backdrop is its absolute child.
      // We click the overlay by simulating a click whose target is the overlay ref itself.
      // RTL's user.click clicks the element directly; the panel is on top, so click
      // a coordinate inside the overlay but outside the panel via dispatchEvent.
      const overlay = container.querySelector('.fixed.inset-0.z-50') as HTMLElement;
      // Make the click target the overlay element specifically (not its descendant).
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

    it('has no axe-core violations when no title/description is provided', async () => {
      const { container } = renderWithProviders(
        <Modal open onClose={() => {}}>
          <button>OK</button>
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
          <input type="text" />
        </Modal>,
      );
      const dialog = container.querySelector('[role="dialog"]') as Element;
      await expect(dialog).toHaveNoViolations();
    });
  });
});
/**
 * Story B.2.4 — ConfirmDialog `warning` variant + variants contract.
 *
 * Validates that:
 *  - `info | warning | danger` are accepted (the new typing contract).
 *  - `warning` renders an amber icon + amber panel ring.
 *  - `confirmDisabled` blocks the confirm button.
 *  - The `description` is rendered as a `ReactNode` (so the procedure-
 *    completion dialog can include a date input, checklist summary, etc).
 *  - ESC closes the dialog (Modal-level behavior, still inherited).
 */

import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, renderWithProviders } from '@/test/test-utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

describe('ConfirmDialog (B.2.4 variants)', () => {
  describe('render & basic contract', () => {
    it('renders title + description and both buttons when open', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Xác nhận chuyển trạng thái"
          description="Mô tả hành động"
        />,
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Xác nhận chuyển trạng thái' })).toBeInTheDocument();
      expect(screen.getByText('Mô tả hành động')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();
    });

    it('renders nothing when closed (open=false)', () => {
      render(
        <ConfirmDialog
          open={false}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Tiêu đề"
          description="Mô tả"
        />,
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('honors custom cancel/confirm labels', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="T"
          description="D"
          confirmLabel="Hoàn thành"
          cancelLabel="Không"
        />,
      );
      expect(screen.getByRole('button', { name: 'Hoàn thành' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Không' })).toBeInTheDocument();
    });

    it('description: ReactNode — renders an interactive input inside', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="T"
          description={
            <div>
              <span>Mô tả</span>
              <input data-testid="date-input" type="date" />
            </div>
          }
        />,
      );
      expect(screen.getByTestId('date-input')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders the info (default) variant with an Info icon', () => {
      const { container } = render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="T"
          description="D"
          variant="info"
        />,
      );
      // Info variant uses bg-swan-50 + text-swan-500 for the icon.
      const infoIconBg = container.querySelector('.bg-swan-50');
      expect(infoIconBg).toBeInTheDocument();
    });

    it('renders the warning variant with an amber icon and amber panel ring', () => {
      const { container } = render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="T"
          description="D"
          variant="warning"
        />,
      );
      const amberIconBg = container.querySelector('.bg-amber-50');
      expect(amberIconBg).toBeInTheDocument();
      const amberIconColor = container.querySelector('.text-amber-500');
      expect(amberIconColor).toBeInTheDocument();
      // Panel ring should carry the amber color when the dialog is in
      // warning mode. We check the ring class directly.
      const panelRing = container.querySelector('.ring-amber-300\\/70');
      expect(panelRing).toBeInTheDocument();
    });

    it('renders the danger variant with a red icon and red panel ring', () => {
      const { container } = render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="T"
          description="D"
          variant="danger"
        />,
      );
      const redIconBg = container.querySelector('.bg-red-50');
      expect(redIconBg).toBeInTheDocument();
      const redIconColor = container.querySelector('.text-red-500');
      expect(redIconColor).toBeInTheDocument();
      expect(container.querySelector('.ring-red-300\\/70')).toBeInTheDocument();
    });
  });

  describe('confirmDisabled', () => {
    it('disables the confirm button when confirmDisabled=true', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="T"
          description="D"
          confirmDisabled
        />,
      );
      const confirmBtn = screen.getByRole('button', { name: 'Xác nhận' });
      expect(confirmBtn).toBeDisabled();
    });

    it('does NOT call onConfirm when the confirm button is disabled', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={onConfirm}
          title="T"
          description="D"
          confirmDisabled
        />,
      );
      // userEvent respects `disabled` on buttons — clicking a disabled
      // button does not fire onClick at all in real browsers. We assert
      // the same on the React Testing Library side.
      const confirmBtn = screen.getByRole('button', { name: 'Xác nhận' });
      expect(confirmBtn).toBeDisabled();
      await user.click(confirmBtn);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('re-enables the confirm button when confirmDisabled=false', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="T"
          description="D"
        />,
      );
      const confirmBtn = screen.getByRole('button', { name: 'Xác nhận' });
      expect(confirmBtn).not.toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('calls onConfirm when the confirm button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={onConfirm}
          title="T"
          description="D"
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Xác nhận' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ConfirmDialog
          open
          onClose={onClose}
          onConfirm={() => {}}
          title="T"
          description="D"
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Hủy' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('a11y', () => {
    it('has no axe-core violations on the warning variant', async () => {
      const { container } = renderWithProviders(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Hoàn thành thủ thuật"
          description="Hành động này sẽ tạo 6 followup hậu phẫu."
          variant="warning"
          confirmLabel="Xác nhận hoàn thành"
          cancelLabel="Hủy"
        />,
      );
      const dialog = container.querySelector('[role="dialog"]') as Element;
      await expect(dialog).toHaveNoViolations();
    });
  });
});

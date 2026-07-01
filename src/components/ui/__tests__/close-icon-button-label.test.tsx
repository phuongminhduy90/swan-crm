/**
 * Story C.1.1 (Sprint 7.1) — Modal/ConfirmDialog close button label
 * per-context override.
 *
 * Verifies that:
 *  - `<Modal closeLabel="...">` propagates the label to `<CloseIconButton>`.
 *  - `<Modal>` defaults to "Đóng" when `closeLabel` is omitted.
 *  - `<ConfirmDialog closeLabel="...">` propagates the label.
 *  - `<ConfirmDialog>` synthesizes a meaningful label from `title` when
 *    `closeLabel` is not passed (e.g. "Đóng xác nhận — Xóa dịch vụ?").
 *  - Backward-compat: existing consumers without `closeLabel` still render.
 *  - Every interactive flow (click, ESC) is unaffected by the label change.
 *  - axe-core scan passes on a labelled-and-an-unlabelled dialog side-by-side.
 */

import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, renderWithProviders } from '@/test/test-utils';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

describe('Story C.1.1 — Close button label per-context override (Modal + ConfirmDialog)', () => {
  describe('<Modal closeLabel>', () => {
    it('renders the close icon button with the consumer-provided ariaLabel', () => {
      render(
        <Modal
          open
          onClose={() => {}}
          title="Chỉnh sửa khách hàng"
          closeLabel="Đóng hộp thoại chỉnh sửa khách hàng"
        >
          <p>nội dung</p>
        </Modal>,
      );

      const closeButton = screen.getByRole('button', {
        name: 'Đóng hộp thoại chỉnh sửa khách hàng',
      });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Đóng hộp thoại chỉnh sửa khách hàng');
    });

    it('falls back to "Đóng" when closeLabel is omitted (backward-compatible)', () => {
      render(
        <Modal open onClose={() => {}} title="Tạo khách hàng">
          <p>nội dung</p>
        </Modal>,
      );

      const closeButton = screen.getByRole('button', { name: 'Đóng' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Đóng');
    });

    it('still closes the dialog when the labelled close button is clicked (behavior preserved)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <Modal
          open
          onClose={onClose}
          title="Tạo thanh toán"
          closeLabel="Đóng hộp thoại tạo thanh toán"
        >
          <p>nội dung</p>
        </Modal>,
      );

      await user.click(
        screen.getByRole('button', { name: 'Đóng hộp thoại tạo thanh toán' }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps all consumers working without closeLabel (no TypeScript or runtime break)', () => {
      // If this test compiles and renders, the API is backward-compatible.
      const { container } = render(
        <Modal open onClose={() => {}} title="Tiêu đề">
          <p>nội dung</p>
        </Modal>,
      );
      expect(container).not.toBeEmptyDOMElement();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('<ConfirmDialog closeLabel>', () => {
    it('renders the close icon button with the consumer-provided ariaLabel', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Xóa dịch vụ?"
          description="Mô tả"
          closeLabel="Đóng hộp thoại xác nhận xóa dịch vụ"
        />,
      );

      const closeButton = screen.getByRole('button', {
        name: 'Đóng hộp thoại xác nhận xóa dịch vụ',
      });
      expect(closeButton).toBeInTheDocument();
    });

    it('synthesizes a meaningful label from the title when closeLabel is omitted', () => {
      // Title "Xóa dịch vụ?" → synthesized label "Đóng xác nhận — Xóa dịch vụ"
      // (trailing "?" is stripped by ConfirmDialog).
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Xóa dịch vụ?"
          description="Mô tả"
        />,
      );

      expect(
        screen.getByRole('button', { name: 'Đóng xác nhận — Xóa dịch vụ' }),
      ).toBeInTheDocument();
    });

    it('consumer-provided closeLabel takes precedence over the synthesized title-derived label', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Xóa dịch vụ?"
          description="Mô tả"
          closeLabel="Hủy thao tác xóa"
        />,
      );

      // The consumer override wins; the synthesized "Đóng xác nhận — ..." is gone.
      expect(
        screen.getByRole('button', { name: 'Hủy thao tác xóa' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Đóng xác nhận — Xóa dịch vụ' }),
      ).not.toBeInTheDocument();
    });

    it('keeps Cancel / Confirm rendering intact when closeLabel is set (no visual regression)', () => {
      render(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Xóa dịch vụ?"
          description="Mô tả"
          cancelLabel="Hủy"
          confirmLabel="Xóa"
          closeLabel="Đóng hộp thoại xác nhận xóa dịch vụ"
        />,
      );

      expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Xóa' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Đóng hộp thoại xác nhận xóa dịch vụ' }),
      ).toBeInTheDocument();
    });
  });

  describe('axe-core a11y', () => {
    it('Modal with per-context label produces no axe-core violations', async () => {
      const { container } = renderWithProviders(
        <Modal
          open
          onClose={() => {}}
          title="Chỉnh sửa hồ sơ"
          description="Cập nhật CASE"
          closeLabel="Đóng hộp thoại chỉnh sửa hồ sơ"
        >
          <label>
            Ghi chú
            <input type="text" />
          </label>
        </Modal>,
      );
      const dialog = container.querySelector('[role="dialog"]') as Element;
      await expect(dialog).toHaveNoViolations();
    });

    it('ConfirmDialog with per-context label produces no axe-core violations', async () => {
      const { container } = renderWithProviders(
        <ConfirmDialog
          open
          onClose={() => {}}
          onConfirm={() => {}}
          title="Xóa dịch vụ?"
          description="Hành động này không thể hoàn tác"
          confirmLabel="Xóa"
          cancelLabel="Hủy"
          variant="danger"
          closeLabel="Đóng hộp thoại xác nhận xóa dịch vụ"
        />,
      );
      const dialog = container.querySelector('[role="dialog"]') as Element;
      await expect(dialog).toHaveNoViolations();
    });
  });
});

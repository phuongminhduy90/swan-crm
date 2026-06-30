/**
 * Story B.2.4 — `procedure_completed` second-confirm dialog.
 *
 * Validates that `StatusWorkflow` opens a richer `ConfirmDialog` when the
 * user picks `procedure_completed` as the next status:
 *  - `warning` variant (amber icon + amber panel ring).
 *  - `actualProcedureDate` input is rendered and required.
 *  - Confirm button is disabled until the date is filled.
 *  - Checklist summary is shown when provided.
 *  - Side-effects summary is shown when provided.
 *  - `onTransition` receives the captured date via the second arg.
 *  - `window.confirm` is never called (anti-pattern A9).
 */

import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@/test/test-utils';
import type { CaseStatus } from '@/lib/types';
import type { StatusTransitionExtra } from '@/components/cases/status-workflow';
import { StatusWorkflow } from '@/components/cases/status-workflow';

// Stub the global `window.confirm`/`alert` so the test environment is
// faithful to the A9 anti-pattern gate from `SPRINT_6_2_EXECUTION_PLAN`.
const confirmSpy = vi.fn();
const alertSpy = vi.fn();
window.confirm = confirmSpy;
window.alert = alertSpy;

describe('StatusWorkflow (B.2.4 procedure_completed second-confirm)', () => {
  describe('procedure_completed dialog surface', () => {
    // The button that triggers the second-confirm dialog is the
    // status-label for `procedure_completed` ("Đã thực hiện xong").
    const PROCEDURE_BUTTON = 'Đã thực hiện xong';
    const GENERIC_CANCEL = 'Hủy';

    it('renders a button labeled with the procedure_completed status when allowed', () => {
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
        />,
      );
      expect(
        screen.getByRole('button', { name: PROCEDURE_BUTTON }),
      ).toBeInTheDocument();
    });

    it('clicking the button opens a warning-variant confirm dialog', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
        />,
      );
      await user.click(screen.getByRole('button', { name: PROCEDURE_BUTTON }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      // Heading comes from `Modal title=` — confirm `aria-labelledby` is wired.
      expect(dialog).toHaveAttribute('aria-labelledby');
      // Warning variant renders the amber panel ring.
      expect(dialog.querySelector('.ring-amber-300\\/70')).toBeInTheDocument();
      expect(dialog.querySelector('.bg-amber-50')).toBeInTheDocument();
      // The icon color is amber (not red).
      expect(dialog.querySelector('.text-amber-500')).toBeInTheDocument();
    });

    it('renders a required <input type="date"> for actualProcedureDate', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
        />,
      );
      await user.click(screen.getByRole('button', { name: PROCEDURE_BUTTON }));

      const dateInput = screen.getByLabelText(/Ngày thực hiện thủ thuật/);
      expect(dateInput).toBeInTheDocument();
      expect(dateInput).toHaveAttribute('type', 'date');
      expect(dateInput).toHaveAttribute('aria-required', 'true');
      expect(dateInput).toBeRequired();
    });
  });

  describe('confirm button gating on actualProcedureDate', () => {
    it('starts disabled when the dialog opens with no initial date', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));

      const confirmBtn = screen.getByRole('button', { name: /Xác nhận hoàn thành/ });
      expect(confirmBtn).toBeDisabled();
    });

    it('re-enables the confirm button after a date is entered', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));

      const dateInput = screen.getByLabelText(/Ngày thực hiện thủ thuật/);
      await user.type(dateInput, '2026-06-15');

      const confirmBtn = screen.getByRole('button', { name: /Xác nhận hoàn thành/ });
      expect(confirmBtn).not.toBeDisabled();
    });

    it('does NOT call onTransition when the confirm button is disabled', async () => {
      const user = userEvent.setup();
      const onTransition = vi.fn(async () => {});
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={onTransition}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));

      const confirmBtn = screen.getByRole('button', { name: /Xác nhận hoàn thành/ });
      expect(confirmBtn).toBeDisabled();
      await user.click(confirmBtn);
      expect(onTransition).not.toHaveBeenCalled();
    });

    it('calls onTransition with the captured date when confirm is clicked', async () => {
      const user = userEvent.setup();
      const onTransition: (
        newStatus: CaseStatus,
        extra?: StatusTransitionExtra,
      ) => Promise<void> = async () => {};
      const onTransitionSpy = vi.fn(onTransition);
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={onTransitionSpy}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));

      const dateInput = screen.getByLabelText(/Ngày thực hiện thủ thuật/);
      await user.type(dateInput, '2026-06-20');

      await user.click(screen.getByRole('button', { name: /Xác nhận hoàn thành/ }));

      expect(onTransitionSpy).toHaveBeenCalledTimes(1);
      const [firstArg, secondArg] = onTransitionSpy.mock.calls[0] as [
        CaseStatus,
        StatusTransitionExtra | undefined,
      ];
      expect(firstArg).toBe('procedure_completed');
      expect(secondArg?.actualProcedureDate).toBe('2026-06-20');
    });

    it('cancellation closes the dialog without calling onTransition', async () => {
      const user = userEvent.setup();
      const onTransition = vi.fn(async () => {});
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={onTransition}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));
      await user.click(screen.getByRole('button', { name: 'Hủy' }));
      expect(onTransition).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('checklist + side-effect summaries', () => {
    it('renders a "Đạt N/M" pill when checklist summary is allPassed', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: true, passedCount: 6, totalCount: 6 }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));
      expect(screen.getByText(/Đạt 6\/6/)).toBeInTheDocument();
    });

    it('renders a "Thiếu K/N" pill when checklist summary has missing items', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 4, totalCount: 6 }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));
      expect(screen.getByText(/Thiếu 2\/6/)).toBeInTheDocument();
      // Includes the "Vui lòng hoàn thành…" guidance copy.
      expect(
        screen.getByText(/Vui lòng hoàn thành các hạng mục còn thiếu/),
      ).toBeInTheDocument();
    });

    it('renders the followups count and tasks description when sideEffectSummary is provided', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
          sideEffectSummary={{
            followupsCount: 6,
            tasksDescription: 'Task CSKH chụp ảnh + chăm sóc sau phẫu',
          }}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));
      expect(screen.getByText(/6 followup hậu phẫu/)).toBeInTheDocument();
      expect(screen.getByText(/Task CSKH chụp ảnh/)).toBeInTheDocument();
    });
  });

  describe('non-procedure_completed transitions are unchanged', () => {
    it('non-procedure_completed target renders the generic dialog without a date input', async () => {
      const user = userEvent.setup();
      render(
        <StatusWorkflow
          currentStatus="waiting_doctor_review"
          onTransition={async () => {}}
        />,
      );
      // "Đủ điều kiện chuyên môn" is a safe forward transition.
      await user.click(screen.getByRole('button', { name: /Đủ điều kiện chuyên môn/ }));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      // Generic dialog does NOT contain the date input.
      expect(
        dialog.querySelector('input[type="date"]'),
      ).not.toBeInTheDocument();
    });
  });

  describe('anti-pattern A9 (native confirm/alert)', () => {
    it('never calls window.confirm during the procedure_completed flow', async () => {
      const user = userEvent.setup();
      confirmSpy.mockClear();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('never calls window.alert during the procedure_completed flow', async () => {
      const user = userEvent.setup();
      alertSpy.mockClear();
      render(
        <StatusWorkflow
          currentStatus="in_procedure"
          onTransition={async () => {}}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'Đã thực hiện xong' }));
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });
});

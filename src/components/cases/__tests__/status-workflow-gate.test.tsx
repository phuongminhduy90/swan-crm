/**
 * Story B.2.1 (F-CRIT-10) — StatusWorkflow gate tests.
 *
 * Verifies the L1 UI gate:
 *   1. allPassed=false disables the 3 gated transitions + red banner visible
 *   2. allPassed=true enables all transitions + banner hidden
 *   3. flag OFF bypasses gate (regression baseline, identical to pre-B.2.1)
 *   4. non-gated transitions are unaffected when the gate is active
 *
 * @see docs/ux-redesign/STORY_B2_1_EXECUTION_PLAN.md §7.2.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

// Stub window.confirm/alert so the env is faithful to the A9 anti-pattern gate.
const confirmSpy = vi.fn();
const alertSpy = vi.fn();
window.confirm = confirmSpy;
window.alert = alertSpy;

// `isFlagEnabled` reads `process.env.NEXT_PUBLIC_FEATURE_*` synchronously, so
// we control gate flag via env var (no need to mock the helper).
import { StatusWorkflow } from '@/components/cases/status-workflow';

describe('Story B.2.1 — StatusWorkflow (FEATURE_CHECKLIST_GATE)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    confirmSpy.mockClear();
    alertSpy.mockClear();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('gate ON + allPassed === false (gating engages)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
    });

    it('disables the "→ checked_in" button when currentStatus=reminder_sent and allPassed=false', () => {
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['blood_test_result', 'fasting_compliant']}
        />,
      );
      const button = screen.getByRole('button', { name: /Khách đã check-in/ });
      expect(button).toBeDisabled();
    });

    it('disables the "→ in_procedure" button when currentStatus=checked_in and allPassed=false', () => {
      render(
        <StatusWorkflow
          currentStatus="checked_in"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['allergy_declared']}
        />,
      );
      const button = screen.getByRole('button', { name: /Đang thực hiện/ });
      expect(button).toBeDisabled();
    });

    it('disables the "→ medically_approved" button when currentStatus=waiting_doctor_review and allPassed=false', () => {
      render(
        <StatusWorkflow
          currentStatus="waiting_doctor_review"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['pregnancy_test_done']}
        />,
      );
      const button = screen.getByRole('button', { name: /Đủ điều kiện chuyên môn/ });
      expect(button).toBeDisabled();
    });

    it('renders the red banner listing the failed item keys', () => {
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['blood_test_result', 'fasting_compliant']}
        />,
      );
      const banner = screen.getByTestId('checklist-gate-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('role', 'alert');
      expect(banner).toHaveAttribute('aria-live', 'polite');
      expect(banner.textContent).toMatch(/blood_test_result/);
      expect(banner.textContent).toMatch(/fasting_compliant/);
      expect(screen.getByRole('button', { name: /Mở checklist/ })).toBeInTheDocument();
    });

    it('does NOT disable non-gated transitions (regression — reminder_sent → postponed stays enabled)', () => {
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['blood_test_result']}
        />,
      );
      // "Hoãn ca" is a caution transition, not gated.
      const postponeBtn = screen.getByRole('button', { name: /Hoãn ca/ });
      expect(postponeBtn).not.toBeDisabled();
    });
  });

  describe('gate ON + allPassed === true (no blocking)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
    });

    it('enables the gated button when allPassed=true', () => {
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: true, passedCount: 12, totalCount: 12 }}
        />,
      );
      const button = screen.getByRole('button', { name: /Khách đã check-in/ });
      expect(button).not.toBeDisabled();
    });

    it('does NOT render the red banner when allPassed=true', () => {
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: true, passedCount: 12, totalCount: 12 }}
        />,
      );
      expect(screen.queryByTestId('checklist-gate-banner')).not.toBeInTheDocument();
    });
  });

  describe('gate OFF (flag is the canonical OFF in production — regression baseline)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE;
    });

    it('does NOT disable the gated button when allPassed=false and flag is OFF', () => {
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['blood_test_result']}
        />,
      );
      const button = screen.getByRole('button', { name: /Khách đã check-in/ });
      expect(button).not.toBeDisabled();
    });

    it('does NOT render the red banner when flag is OFF', () => {
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['blood_test_result']}
        />,
      );
      expect(screen.queryByTestId('checklist-gate-banner')).not.toBeInTheDocument();
    });
  });

  describe('"Mở checklist" CTA', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_FEATURE_CHECKLIST_GATE = 'true';
    });

    it('scrolls to the checklist anchor via DOM lookup when no ref prop is supplied', async () => {
      const user = userEvent.setup();
      // Provide a DOM target for the fallback scrollIntoView call.
      const anchor = document.createElement('div');
      anchor.id = 'clinical-checklist-anchor';
      anchor.scrollIntoView = vi.fn();
      document.body.appendChild(anchor);

      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['blood_test_result']}
        />,
      );

      await user.click(screen.getByRole('button', { name: /Mở checklist/ }));
      expect(anchor.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: 'smooth' }),
      );

      anchor.remove();
    });

    it('does NOT navigate to a dead URL (anti-pattern A8)', () => {
      // The "Mở checklist" button must be a <button>, not an <a href="…">.
      // If a future regression adds a dead link, this test will fail.
      render(
        <StatusWorkflow
          currentStatus="reminder_sent"
          onTransition={async () => {}}
          checklistSummary={{ allPassed: false, passedCount: 8, totalCount: 12 }}
          failedChecklistKeys={['blood_test_result']}
        />,
      );
      const cta = screen.getByRole('button', { name: /Mở checklist/ });
      expect(cta.tagName).toBe('BUTTON');
      expect(cta.getAttribute('href')).toBeNull();
    });
  });
});
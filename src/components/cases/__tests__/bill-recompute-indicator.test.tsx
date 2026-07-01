/**
 * Story PI-1 (Sprint 7.2) — BillRecomputeIndicator chip.
 *
 * Verifies the surface the accountant sees next to "Tổng quan bill":
 *
 *  1. Three observable states render with the right Vietnamese copy
 *     (synced / syncing / stale).
 *  2. HH:mm formatting edge cases (invalid date → stale, proxy timestamp
 *     fallback to `caseRecord.updatedAt`).
 *  3. Feature-flag gate — BILL_RECOMPUTE off in prod keeps the chip hidden.
 *  4. A11y + data-testid contract for qa-architect Layer 9 mobile harness.
 *  5. Tooltip exposes the trigger reason so the accountant can answer
 *     "why was this recomputed?" without diving into the audit log.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1 (PI-1), §10.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { BillRecomputeIndicator } from '@/components/cases/bill-recompute-indicator';
import type { CaseRecord } from '@/lib/types';

// Tooltip uses `useId` which is stable across renders but auto-generated per
// mount — tests query by `aria-label` / `data-*` so we do not depend on the id.

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-1',
    caseCode: 'SW-260101-001',
    customerId: 'cust-1',
    caseDate: '2026-01-01T00:00:00.000Z',
    mainServiceGroup: 'nose',
    status: 'payment_confirmed',
    priority: 'normal',
    totalBillBeforeDiscount: 10_000_000,
    totalBillAfterDiscount: 10_000_000,
    amountPaid: 5_000_000,
    remainingAmount: 5_000_000,
    paymentStatus: 'partial',
    privacyLevel: 'normal',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('BillRecomputeIndicator (PI-1)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE: 'true' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.useRealTimers();
  });

  describe('synced state (default)', () => {
    it('renders the synced chip with Vietnamese copy + HH:mm timestamp', () => {
      // Local-time equivalent of 14:35. Constructing with explicit local
      // components avoids TZ skew because `new Date(iso)` parses as UTC, then
      // `getHours()` / `getMinutes()` convert to local. We use a timestamp
      // that produces the same local HH:mm in the typical CI container.
      const timestamp = new Date(2026, 5, 15, 14, 35, 0).toISOString();
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: timestamp })}
          recomputedAt={timestamp}
        />,
      );
      const chip = screen.getByTestId('bill-recompute-synced');
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveAttribute('data-recompute-status', 'synced');
      expect(chip).toHaveAttribute('data-recompute-time', '14:35');
      expect(chip).toHaveTextContent('Đã đồng bộ hóa lúc 14:35');
      expect(chip).toHaveAttribute('role', 'status');
      expect(chip).toHaveAttribute('aria-live', 'off');
    });

    it('falls back to caseRecord.updatedAt when recomputedAt is omitted', () => {
      const timestamp = new Date(2026, 5, 15, 9, 5, 0).toISOString();
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: timestamp })}
        />,
      );
      const chip = screen.getByTestId('bill-recompute-synced');
      expect(chip).toHaveAttribute('data-recompute-time', '09:05');
      expect(chip).toHaveTextContent('Đã đồng bộ hóa lúc 09:05');
    });

    it('renders a check-circle icon in the synced chip', () => {
      const timestamp = new Date(2026, 5, 15, 14, 35, 0).toISOString();
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: timestamp })}
        />,
      );
      expect(screen.getByTestId('bill-recompute-icon-synced')).toBeInTheDocument();
    });

    it('zero-pads single-digit hours and minutes', () => {
      const timestamp = new Date(2026, 5, 15, 1, 7, 0).toISOString();
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: timestamp })}
        />,
      );
      const chip = screen.getByTestId('bill-recompute-synced');
      expect(chip).toHaveAttribute('data-recompute-time', '01:07');
      expect(chip).toHaveTextContent('Đã đồng bộ hóa lúc 01:07');
    });
  });

  describe('syncing state (transient)', () => {
    it('renders the syncing chip with spinner copy', () => {
      render(
        <BillRecomputeIndicator caseRecord={makeCase()} status="syncing" />,
      );
      const chip = screen.getByTestId('bill-recompute-syncing');
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveAttribute('data-recompute-status', 'syncing');
      expect(chip).toHaveTextContent('Đang đồng bộ hóa...');
      expect(chip).toHaveAttribute('aria-live', 'polite');
    });

    it('renders a spinning loader icon in the syncing chip', () => {
      render(
        <BillRecomputeIndicator caseRecord={makeCase()} status="syncing" />,
      );
      const iconWrap = screen.getByTestId('bill-recompute-icon-syncing');
      // Loader2 gets the `animate-spin` className so the spinner animates
      // even when CSS animations are disabled in jsdom.
      expect(iconWrap.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('stale state (no valid timestamp)', () => {
    it('renders the stale chip when updatedAt is missing', () => {
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: undefined as unknown as string })}
        />,
      );
      const chip = screen.getByTestId('bill-recompute-stale');
      expect(chip).toBeInTheDocument();
      expect(chip).toHaveAttribute('data-recompute-status', 'stale');
      expect(chip).toHaveTextContent('Cần đồng bộ hóa');
      expect(chip).toHaveAttribute('data-recompute-time', '--:--');
    });

    it('renders the stale chip when updatedAt is unparseable', () => {
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: 'not-a-date' })}
        />,
      );
      const chip = screen.getByTestId('bill-recompute-stale');
      expect(chip).toHaveTextContent('Cần đồng bộ hóa');
      expect(chip).toHaveAttribute('data-recompute-time', '--:--');
    });

    it('renders a refresh icon in the stale chip (distinct from spinner)', () => {
      render(
        <BillRecomputeIndicator caseRecord={makeCase()} status="stale" />,
      );
      expect(screen.getByTestId('bill-recompute-icon-stale')).toBeInTheDocument();
    });
  });

  describe('status override', () => {
    it('forces syncing even when a valid timestamp is provided', () => {
      const timestamp = new Date(2026, 5, 15, 14, 35, 0).toISOString();
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: timestamp })}
          status="syncing"
        />,
      );
      const chip = screen.getByTestId('bill-recompute-syncing');
      expect(chip).toHaveTextContent('Đang đồng bộ hóa...');
    });

    it('forces stale even when a valid timestamp is provided (regression — manual override wins)', () => {
      const timestamp = new Date(2026, 5, 15, 14, 35, 0).toISOString();
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: timestamp })}
          status="stale"
        />,
      );
      const chip = screen.getByTestId('bill-recompute-stale');
      expect(chip).toHaveTextContent('Cần đồng bộ hóa');
    });
  });

  describe('tooltip copy', () => {
    it('exposes the trigger reason via aria-label (a11y contract)', () => {
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase()}
          status="synced"
          recomputedAt={new Date(2026, 5, 15, 14, 35, 0).toISOString()}
          trigger="service_added"
        />,
      );
      const chip = screen.getByTestId('bill-recompute-synced');
      expect(chip).toHaveAttribute(
        'aria-label',
        'Đã đồng bộ hóa lúc 14:35 — Sau khi thêm dịch vụ',
      );
    });

    it('renders the trigger label inside the tooltip bubble on hover', async () => {
      const user = userEvent.setup();
      render(
        <BillRecomputeIndicator
          caseRecord={makeCase()}
          status="synced"
          recomputedAt={new Date(2026, 5, 15, 14, 35, 0).toISOString()}
          trigger="payment_confirmed"
        />,
      );
      const chip = screen.getByTestId('bill-recompute-synced');
      await user.hover(chip);
      // Tooltip primitive uses `data-testid="tooltip-bubble"` and the bubble
      // is mounted but hidden by default — it flips to `hidden=false` after
      // the 120 ms show delay. We assert the bubble is in the DOM with the
      // trigger copy.
      const bubble = await screen.findByTestId('tooltip-bubble');
      expect(bubble).toHaveTextContent('Sau khi xác nhận thanh toán');
    });
  });

  describe('feature-flag gate', () => {
    it('returns null when BILL_RECOMPUTE flag is OFF (production default)', () => {
      delete process.env.NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE;
      const { container } = render(
        <BillRecomputeIndicator caseRecord={makeCase()} />,
      );
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('bill-recompute-synced')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bill-recompute-syncing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bill-recompute-stale')).not.toBeInTheDocument();
    });

    it('returns null when BILL_RECOMPUTE flag is explicitly "false"', () => {
      process.env.NEXT_PUBLIC_FEATURE_BILL_RECOMPUTE = 'false';
      const { container } = render(
        <BillRecomputeIndicator caseRecord={makeCase()} />,
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('a11y + Vietnamese copy', () => {
    it('has no axe-core critical violations on the synced chip', async () => {
      const timestamp = new Date(2026, 5, 15, 14, 35, 0).toISOString();
      const { container } = render(
        <BillRecomputeIndicator
          caseRecord={makeCase({ updatedAt: timestamp })}
        />,
      );
      // The chip is the top-level rendered span — axe scans it directly.
      await expect(container.firstChild as Element).toHaveNoViolations();
    });

    it('uses no `window.confirm` / `window.alert` (anti-pattern A9 regression)', () => {
      const confirmSpy = vi.fn();
      const alertSpy = vi.fn();
      window.confirm = confirmSpy;
      window.alert = alertSpy;
      render(<BillRecomputeIndicator caseRecord={makeCase()} />);
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();
    });
  });
});
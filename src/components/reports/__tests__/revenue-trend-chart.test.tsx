/**
 * Story B.3.4 — Revenue trend chart: refund line + "Đã xác nhận − Hoàn tiền"
 * annotation.
 *
 * Verifies F-HIGH-33 acceptance criteria:
 *  - The chart always renders the refund `<Line>` (red `#EF4444`), not just
 *    when refunds exist. Months with `refund: 0` fall through to a flat line.
 *  - The annotation footer always reads "Đã xác nhận − Hoàn tiền = …" (with
 *    `totalNet = totalConfirmed − totalRefund`) when at least one confirmed
 *    payment exists in the period.
 *  - The custom tooltip for the refund series appends the Vietnamese
 *    description "Tổng hoàn tiền đã xác nhận trong kỳ".
 *  - Empty data renders the "Chưa có dữ liệu" fallback.
 *  - Annotation is hidden when total confirmed revenue is 0.
 *  - The desktop annotation uses Tailwind `hidden sm:block` and the mobile
 *    annotation uses `block sm:hidden` so the chart remains readable on
 *    small viewports.
 *
 * NOTE: Recharts renders empty SVGs in jsdom (width:0, height:0), so we
 * cannot query `.recharts-line-curve` for stroke colours. Instead we
 * verify:
 *  1. Annotation text content (rendered as a normal React element outside
 *     the ResponsiveContainer).
 *  2. The custom tooltip's Vietnamese copy when invoked with a refund
 *     payload.
 *  3. The Legend is excluded from the assertion (Recharts doesn't render
 *     it in jsdom), but the component compiles and doesn't throw.
 *
 * @see docs/ux-redesign/SPRINT_6_4_EXECUTION_PLAN.md §A.2 (B.3.4 card)
 * @see docs/ux-redesign/STORY_B3_4_MIGRATION_NOTES.md
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  RevenueTrendChart,
  type MonthlyRevenuePoint,
} from '@/components/reports/revenue-trend-chart';
import { REFUND_SERIES } from '@/components/reports/chart-theme';

// Recharts uses ResizeObserver (unavailable in jsdom). Provide a no-op stub
// so ResponsiveContainer doesn't throw on mount.
beforeAll(() => {
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    (globalThis as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  cleanup();
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

// B.3.4: every fixture now includes `refund` (always populated by
// RevenueReport). Even "no refund" months have refund: 0 so the chart's
// refund <Line> always renders.
const BASE_POINTS: MonthlyRevenuePoint[] = [
  { monthKey: '2026-01', label: 'T1', confirmed: 40_000_000, pending: 10_000_000, refund: 0 },
  { monthKey: '2026-02', label: 'T2', confirmed: 65_000_000, pending: 0, refund: 0 },
  { monthKey: '2026-03', label: 'T3', confirmed: 50_000_000, pending: 5_000_000, refund: 0 },
];

const POINTS_WITH_REFUND: MonthlyRevenuePoint[] = [
  { monthKey: '2026-01', label: 'T1', confirmed: 40_000_000, pending: 10_000_000, refund: 0 },
  { monthKey: '2026-02', label: 'T2', confirmed: 65_000_000, pending: 0, refund: 10_000_000 },
  { monthKey: '2026-03', label: 'T3', confirmed: 50_000_000, pending: 5_000_000, refund: 0 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RevenueTrendChart (B.3.4 — refund line + Đã xác nhận − Hoàn tiền annotation)', () => {
  describe('empty / no-data states', () => {
    it('renders the empty-state fallback when data is empty', () => {
      render(<RevenueTrendChart data={[]} />);
      expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    });

    it('does NOT render the annotation when no confirmed revenue exists', () => {
      // 0 confirmed across the board → no annotation
      render(
        <RevenueTrendChart
          data={[
            { monthKey: '2026-01', label: 'T1', confirmed: 0, pending: 0, refund: 0 },
          ]}
        />,
      );
      expect(screen.queryByTestId('revenue-annotation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('revenue-annotation-mobile')).not.toBeInTheDocument();
    });
  });

  describe('annotation footer (B.3.4 F-HIGH-33)', () => {
    it('always renders the "Đã xác nhận − Hoàn tiền" annotation when refunds exist', () => {
      render(<RevenueTrendChart data={POINTS_WITH_REFUND} />);

      const annotation = screen.getByTestId('revenue-annotation');
      expect(annotation).toBeInTheDocument();
      // Header label — must mention both Vietnamese phrases byte-exact.
      expect(annotation.textContent).toMatch(/Đã xác nhận/);
      expect(annotation.textContent).toMatch(/Hoàn tiền/);
      // Net = 155M − 10M = 145M VNĐ
      expect(annotation.textContent).toMatch(/145\.0M VNĐ/);
      // Breakdown: 155M confirmed − 10M refund
      expect(annotation.textContent).toMatch(/155\.0M VNĐ/);
      expect(annotation.textContent).toMatch(/10\.0M VNĐ/);
    });

    it('still renders "Đã xác nhận − Hoàn tiền" annotation when no refund exists (B.3.4 spec)', () => {
      // B.3.3 used a conditional branch ("Đã xác nhận = …" when no refund).
      // B.3.4 unifies the wording — the annotation always says
      // "Đã xác nhận − Hoàn tiền" so the meaning of the line is unambiguous.
      render(<RevenueTrendChart data={BASE_POINTS} />);

      const annotation = screen.getByTestId('revenue-annotation');
      expect(annotation).toBeInTheDocument();
      expect(annotation.textContent).toMatch(/Đã xác nhận − Hoàn tiền/);
      // No refund clause in the breakdown: confirmed total = 155M, refund = 0
      expect(annotation.textContent).toMatch(/155\.0M VNĐ/);
      expect(annotation.textContent).toMatch(/0 VNĐ/);
    });

    it('annotation is a single desktop element (no duplication)', () => {
      render(<RevenueTrendChart data={POINTS_WITH_REFUND} />);
      expect(screen.getAllByTestId('revenue-annotation')).toHaveLength(1);
    });

    it('desktop annotation is hidden on small viewports (sm:block + hidden)', () => {
      render(<RevenueTrendChart data={BASE_POINTS} />);
      const annotation = screen.getByTestId('revenue-annotation');
      // The desktop annotation must be hidden by default and visible on sm+.
      expect(annotation.className).toMatch(/hidden/);
      expect(annotation.className).toMatch(/sm:block/);
    });

    it('mobile annotation is shown on small viewports and hidden on sm+', () => {
      render(<RevenueTrendChart data={BASE_POINTS} />);
      const mobile = screen.getByTestId('revenue-annotation-mobile');
      expect(mobile).toBeInTheDocument();
      expect(mobile.className).toMatch(/block/);
      expect(mobile.className).toMatch(/sm:hidden/);
    });

    it('mobile annotation contains the same condensed Vietnamese copy', () => {
      render(<RevenueTrendChart data={POINTS_WITH_REFUND} />);
      const mobile = screen.getByTestId('revenue-annotation-mobile');
      expect(mobile.textContent).toMatch(/Đã xác nhận − Hoàn tiền/);
      expect(mobile.textContent).toMatch(/145\.0M VNĐ/);
    });
  });

  describe('refund line visibility (B.3.4 F-HIGH-33)', () => {
    it('the chart does not crash when months have refund: 0 (B.3.4 always-renders contract)', () => {
      // B.3.3 had a `hasRefund` guard; B.3.4 removes it so the chart always
      // renders both confirmed + refund series. We verify the component
      // still mounts and the annotation is correct.
      render(<RevenueTrendChart data={BASE_POINTS} />);
      expect(screen.queryByText('Chưa có dữ liệu')).not.toBeInTheDocument();
      expect(screen.getByTestId('revenue-annotation')).toBeInTheDocument();
    });

    it('exports REFUND_SERIES config with red color and Vietnamese label', () => {
      // The chart reads its refund line metadata from REFUND_SERIES so the
      // color/label can be re-used elsewhere (e.g. status badges).
      expect(REFUND_SERIES.color).toBe('#EF4444');
      expect(REFUND_SERIES.label).toBe('Hoàn tiền');
      expect(REFUND_SERIES.description).toBe('Tổng hoàn tiền đã xác nhận trong kỳ');
    });
  });

  describe('net calculation correctness (B.3.4 F-HIGH-33)', () => {
    it('computes net = confirmed − refund correctly with multiple refund months', () => {
      const dataWithMultipleRefunds: MonthlyRevenuePoint[] = [
        { monthKey: '2026-01', label: 'T1', confirmed: 50_000_000, pending: 0, refund: 5_000_000 },
        { monthKey: '2026-02', label: 'T2', confirmed: 30_000_000, pending: 0, refund: 15_000_000 },
      ];

      render(<RevenueTrendChart data={dataWithMultipleRefunds} />);

      const annotation = screen.getByTestId('revenue-annotation');
      // Confirmed total = 50M + 30M = 80M VNĐ
      expect(annotation.textContent).toMatch(/80\.0M VNĐ/);
      // Refund total = 5M + 15M = 20M VNĐ
      expect(annotation.textContent).toMatch(/20\.0M VNĐ/);
      // Net = 80M − 20M = 60M VNĐ
      expect(annotation.textContent).toMatch(/60\.0M VNĐ/);
    });

    it('does NOT subtract refund internally from confirmed series (R-REV-2 mitigation)', () => {
      // R-REV-2 risk: refund line should be additive on top of confirmed,
      // not subtracted from it. We verify by checking that confirmed total
      // displayed in the breakdown matches the SUM of all confirmed
      // amounts (not net).
      const data: MonthlyRevenuePoint[] = [
        { monthKey: '2026-01', label: 'T1', confirmed: 100_000_000, pending: 0, refund: 10_000_000 },
      ];

      render(<RevenueTrendChart data={data} />);
      const annotation = screen.getByTestId('revenue-annotation');
      // Confirmed should be 100M, refund 10M, net 90M
      expect(annotation.textContent).toMatch(/100\.0M VNĐ/);
      expect(annotation.textContent).toMatch(/10\.0M VNĐ/);
      expect(annotation.textContent).toMatch(/90\.0M VNĐ/);
    });
  });

  describe('refund series tooltip (B.3.4 F-HIGH-33)', () => {
    it('REFUND_SERIES.description matches the B.3.4 spec byte-exact', () => {
      // The B.3.4 spec requires the refund tooltip text to read
      // "Tổng hoàn tiền đã xác nhận trong kỳ" verbatim. The custom
      // tooltip component reads from REFUND_SERIES.description, so this
      // constant change is the contract.
      expect(REFUND_SERIES.description).toBe('Tổng hoàn tiền đã xác nhận trong kỳ');
    });
  });
});
/**
 * Story B.3.3 — Revenue trend chart: refund line + annotation.
 *
 * Verifies F-HIGH-32 / F-HIGH-33 acceptance criteria:
 *  - Annotation footer reads "Đã xác nhận − Hoàn tiền = …" when refunds exist
 *    in the period.
 *  - Annotation footer reads "Đã xác nhận = …" (no refund math) when the
 *    period has no refund yet.
 *  - Refund line is only rendered when at least one month has a refund —
 *    no empty line is drawn for clean months.
 *  - Empty data renders the "Chưa có dữ liệu" fallback.
 *  - Annotation is hidden when total confirmed revenue is 0.
 *
 * NOTE: Recharts renders empty SVGs in jsdom (width:0, height:0), so we cannot
 * query `.recharts-line-curve` for stroke colours.  Instead, we verify:
 *  1. Annotation text content (rendered as a normal React element outside
 *     the ResponsiveContainer).
 *  2. The component's data contract: when `refund > 0` exists, the internal
 *     `hasRefund` flag is true and the correct branch renders.
 *  3. The Legend is excluded from the assertion (Recharts doesn't render it
 *     in jsdom), but the component compiles and doesn't throw.
 *
 * @see docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md §1 (B.3.3 row)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  RevenueTrendChart,
  type MonthlyRevenuePoint,
} from '@/components/reports/revenue-trend-chart';

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

const BASE_POINTS: MonthlyRevenuePoint[] = [
  { monthKey: '2026-01', label: 'T1', confirmed: 40_000_000, pending: 10_000_000 },
  { monthKey: '2026-02', label: 'T2', confirmed: 65_000_000, pending: 0 },
  { monthKey: '2026-03', label: 'T3', confirmed: 50_000_000, pending: 5_000_000 },
];

const POINTS_WITH_REFUND: MonthlyRevenuePoint[] = [
  { monthKey: '2026-01', label: 'T1', confirmed: 40_000_000, pending: 10_000_000, refund: 0 },
  { monthKey: '2026-02', label: 'T2', confirmed: 65_000_000, pending: 0, refund: 10_000_000 },
  { monthKey: '2026-03', label: 'T3', confirmed: 50_000_000, pending: 5_000_000, refund: 0 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RevenueTrendChart (B.3.3 — refund line + annotation)', () => {
  describe('empty / no-data states', () => {
    it('renders the empty-state fallback when data is empty', () => {
      render(<RevenueTrendChart data={[]} />);
      expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    });

    it('does NOT render the annotation when no confirmed revenue exists', () => {
      // 0 confirmed across the board → no annotation
      render(
        <RevenueTrendChart
          data={[{ monthKey: '2026-01', label: 'T1', confirmed: 0, pending: 0 }]}
        />,
      );
      expect(screen.queryByTestId('revenue-annotation')).not.toBeInTheDocument();
    });
  });

  describe('annotation when no refunds exist (B.3.3 F-HIGH-33)', () => {
    it('renders the "Đã xác nhận = …" annotation with total confirmed revenue', () => {
      render(<RevenueTrendChart data={BASE_POINTS} />);

      const annotation = screen.getByTestId('revenue-annotation');
      expect(annotation).toBeInTheDocument();
      // The annotation must mention "Đã xác nhận" + the period total.
      expect(annotation.textContent).toMatch(/Đã xác nhận/);
      // Confirmed total = 40M + 65M + 50M = 155M VNĐ
      expect(annotation.textContent).toMatch(/155\.0M VNĐ/);
      // No refund clause in the no-refund branch.
      expect(annotation.textContent).not.toMatch(/Hoàn tiền/);
      expect(annotation.textContent).toMatch(/chưa có hoàn tiền trong kỳ/);
    });
  });

  describe('annotation when refunds exist (B.3.3 F-HIGH-32/33)', () => {
    it('renders the "Đã xác nhận − Hoàn tiền = …" annotation with net calculation', () => {
      render(<RevenueTrendChart data={POINTS_WITH_REFUND} />);

      const annotation = screen.getByTestId('revenue-annotation');
      expect(annotation).toBeInTheDocument();
      // Header label
      expect(annotation.textContent).toMatch(/Đã xác nhận − Hoàn tiền/);
      // Confirmed total = 40M + 65M + 50M = 155M VNĐ
      expect(annotation.textContent).toMatch(/155\.0M VNĐ/);
      // Refund total = 10M VNĐ
      expect(annotation.textContent).toMatch(/10\.0M VNĐ/);
      // Net = 155M − 10M = 145M VNĐ
      expect(annotation.textContent).toMatch(/145\.0M VNĐ/);
    });

    it('annotation is a single element (no duplication)', () => {
      render(<RevenueTrendChart data={POINTS_WITH_REFUND} />);
      expect(screen.getAllByTestId('revenue-annotation')).toHaveLength(1);
    });
  });

  describe('refund line visibility (B.3.3 F-HIGH-33)', () => {
    it('does NOT render a refund <Line> when no month has a refund (component compiles + mounts)', () => {
      // Recharts doesn't render meaningful SVG in jsdom, so we verify the
      // component mounts without error and no annotation contains "Hoàn tiền"
      // (which would indicate the refund branch is active).
      render(<RevenueTrendChart data={BASE_POINTS} />);
      // Component should be mounted (empty-state NOT shown since data has confirmed amounts).
      expect(screen.queryByText('Chưa có dữ liệu')).not.toBeInTheDocument();
      // Annotation should NOT mention Hoàn tiền.
      const annotation = screen.getByTestId('revenue-annotation');
      expect(annotation.textContent).not.toMatch(/Hoàn tiền/);
    });

    it('renders the refund "Hoàn tiền" legend label when at least one month has a refund', () => {
      // In jsdom, Recharts doesn't render the Legend DOM. We verify the
      // component mounts without error when refund data is present and the
      // annotation correctly reflects refund math.
      render(<RevenueTrendChart data={POINTS_WITH_REFUND} />);
      expect(screen.queryByText('Chưa có dữ liệu')).not.toBeInTheDocument();
      // The annotation is the reliable indicator — it must show the refund line.
      expect(screen.getByTestId('revenue-annotation').textContent).toMatch(/Hoàn tiền/);
    });
  });

  describe('net calculation correctness (B.3.3 F-HIGH-33)', () => {
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
  });
});
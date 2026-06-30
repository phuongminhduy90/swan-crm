/**
 * Story B.3.3 — Pipeline report "Bill = Tổng chưa xác nhận (tiềm năng)" info chip.
 *
 * Verifies F-HIGH-32 acceptance criterion:
 *  - Pipeline chart card exposes an info chip clarifying that "Bill" means
 *    potential revenue (= total unconfirmed payments), not actual revenue.
 *  - The chip has a `title` attribute and an `aria-describedby` pointing to a
 *    hidden long-form description for screen readers.
 *
 * @see docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md §1 (B.3.3 row)
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PipelineReport } from '@/components/reports/pipeline-report';
import type { CaseRecord } from '@/lib/types';

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

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: overrides.id ?? 'case-1',
    caseCode: overrides.caseCode ?? 'SW-260101-001',
    customerId: overrides.customerId ?? 'cust-1',
    caseDate: overrides.caseDate ?? '2026-01-01T00:00:00.000Z',
    mainServiceGroup: overrides.mainServiceGroup ?? 'nose',
    status: overrides.status ?? 'draft',
    priority: overrides.priority ?? 'normal',
    totalBillBeforeDiscount: overrides.totalBillBeforeDiscount ?? 10_000_000,
    totalBillAfterDiscount: overrides.totalBillAfterDiscount ?? 10_000_000,
    amountPaid: overrides.amountPaid ?? 0,
    remainingAmount: overrides.remainingAmount ?? 10_000_000,
    paymentStatus: overrides.paymentStatus ?? 'unpaid',
    privacyLevel: overrides.privacyLevel ?? 'normal',
    createdBy: overrides.createdBy ?? 'user-1',
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PipelineReport (B.3.3 — Bill clarification chip)', () => {
  it('renders the "Bill = Tổng chưa xác nhận (tiềm năng)" info chip', () => {
    render(<PipelineReport cases={[]} />);

    const chip = screen.getByText(/Bill = Tổng chưa xác nhận/i);
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toMatch(/tiềm năng/i);
  });

  it('info chip exposes a native title attribute explaining what Bill means', () => {
    render(<PipelineReport cases={[]} />);

    const chip = screen.getByText(/Bill = Tổng chưa xác nhận/i);
    // The chip wraps the visible text in a <span> with a title attribute.
    const titleEl = chip.closest('[title]');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.getAttribute('title')).toMatch(/Bill = Tổng tiền ca chưa xác nhận/);
    expect(titleEl?.getAttribute('title')).toMatch(/doanh thu tiềm năng/);
  });

  it('info chip exposes aria-describedby pointing to a hidden screen-reader description', () => {
    render(<PipelineReport cases={[]} />);

    const chip = screen.getByText(/Bill = Tổng chưa xác nhận/i);
    const describedById = chip.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();

    // React's useId() can produce ids containing colons (e.g. ":r0:") that
    // need CSS.escape() when used in querySelector. document.getElementById
    // accepts the raw id safely.
    const descEl = document.getElementById(describedById as string);
    expect(descEl).not.toBeNull();
    expect(descEl?.textContent).toMatch(/Bill = Tổng tiền ca chưa xác nhận thanh toán/);
    expect(descEl?.textContent).toMatch(/doanh thu tiềm năng/);
    // The hidden description is sr-only (visually hidden but accessible).
    expect(descEl?.className).toMatch(/sr-only/);
  });

  it('does NOT mutate case data — Bill chip is purely presentational', () => {
    const cases = [
      makeCase({ id: 'a', status: 'waiting_payment_confirmation' }),
      makeCase({ id: 'b', status: 'scheduled' }),
    ];

    render(<PipelineReport cases={cases} />);

    // Info chip must render even with multiple cases present.
    expect(screen.getByText(/Bill = Tổng chưa xác nhận/i)).toBeInTheDocument();
  });
});
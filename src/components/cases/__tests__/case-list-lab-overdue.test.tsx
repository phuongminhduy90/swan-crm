/**
 * Story B.1.4 — `isLabOverdue` helper in case-list.tsx
 *
 * Verifies the date-only overdue logic for the `lab_overdue` URL filter.
 * This is a pure function test — no DOM rendering required.
 *
 * @see src/components/cases/case-list.tsx
 */

import { describe, expect, it } from 'vitest';
import { isLabOverdue } from '@/components/cases/case-list';
import type { CaseRecord } from '@/lib/types';

const NOW = new Date('2026-06-30T10:00:00.000Z');

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: overrides.id ?? 'case-1',
    caseCode: 'SW-260101-001',
    customerId: 'cust-1',
    caseDate: '2026-01-01T00:00:00.000Z',
    mainServiceGroup: 'nose',
    status: overrides.status ?? 'draft',
    priority: 'normal',
    totalBillBeforeDiscount: 10_000_000,
    totalBillAfterDiscount: 10_000_000,
    amountPaid: 0,
    remainingAmount: 10_000_000,
    paymentStatus: 'unpaid',
    privacyLevel: 'normal',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isLabOverdue (B.1.4 — case-list filter)', () => {
  it('returns false when status is not waiting_lab_test', () => {
    const c = makeCase({
      status: 'lab_test_done',
      expectedLabDate: '2025-01-01T00:00:00.000Z',
    });
    expect(isLabOverdue(c, NOW)).toBe(false);
  });

  it('returns false when expectedLabDate is not set', () => {
    const c = makeCase({
      status: 'waiting_lab_test',
      expectedLabDate: undefined,
    });
    expect(isLabOverdue(c, NOW)).toBe(false);
  });

  it('returns false when expectedLabDate is not a parseable date string', () => {
    const c = makeCase({
      status: 'waiting_lab_test',
      expectedLabDate: 'not-a-date',
    });
    expect(isLabOverdue(c, NOW)).toBe(false);
  });

  it('returns true when expectedLabDate is before today (date-only)', () => {
    const c = makeCase({
      status: 'waiting_lab_test',
      expectedLabDate: '2026-06-29T00:00:00.000Z',
    });
    expect(isLabOverdue(c, NOW)).toBe(true);
  });

  it('returns false when expectedLabDate is today (same day)', () => {
    const c = makeCase({
      status: 'waiting_lab_test',
      expectedLabDate: '2026-06-30T00:00:00.000Z',
    });
    expect(isLabOverdue(c, NOW)).toBe(false);
  });

  it('returns false when expectedLabDate is in the future', () => {
    const c = makeCase({
      status: 'waiting_lab_test',
      expectedLabDate: '2026-07-01T00:00:00.000Z',
    });
    expect(isLabOverdue(c, NOW)).toBe(false);
  });

  it('excludes terminal statuses — completed is not overdue', () => {
    const c = makeCase({
      status: 'completed',
      expectedLabDate: '2025-01-01T00:00:00.000Z',
    });
    expect(isLabOverdue(c, NOW)).toBe(false);
  });

  it('excludes cancelled status', () => {
    const c = makeCase({
      status: 'cancelled',
      expectedLabDate: '2025-01-01T00:00:00.000Z',
    });
    expect(isLabOverdue(c, NOW)).toBe(false);
  });
});
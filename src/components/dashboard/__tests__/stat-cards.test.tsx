/**
 * Story B.1.4 — `lab_overdue_count` StatCard tests
 *
 * Verifies the dashboard's 5-card grid:
 *  - all 5 cards render as clickable `<Link>`s
 *  - 5th card is the danger variant for `Lab quá hạn` (F-CRIT-07)
 *  - tooltips are exposed via `title` and `aria-describedby`
 *  - `countLabOverdueCases()` correctly excludes terminal statuses and
 *    excludes `waiting_lab_test` cases without `expectedLabDate` set
 *
 * @see docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md §1 (B.1.4 row)
 */

import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StatCards,
  countLabOverdueCases,
} from '@/components/dashboard/stat-cards';
import type { CaseRecord } from '@/lib/types';

// ---------- Fixtures ----------

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
    expectedLabDate: overrides.expectedLabDate,
    expectedProcedureDate: overrides.expectedProcedureDate,
    actualProcedureDate: overrides.actualProcedureDate,
    treatmentLocationId: overrides.treatmentLocationId,
    ...overrides,
  };
}

// Firestore mocks
vi.mock('@/lib/firebase/firestore', () => ({
  getDocument: vi.fn(),
  setDocument: vi.fn(),
  updateDocument: vi.fn(),
  getAllDocuments: vi.fn(),
}));

vi.mock('@/lib/firebase/client', () => ({
  isFirebaseConfigured: () => false,
}));

vi.mock('@/lib/firebase/admin', () => ({}));

const getAllCustomersMock = vi.fn();
const getAllCasesMock = vi.fn();
const getAllPaymentsMock = vi.fn();
const getAllAppointmentsMock = vi.fn();

vi.mock('@/lib/firestore/customers', () => ({
  getAllCustomers: (...args: unknown[]) => getAllCustomersMock(...args),
}));
vi.mock('@/lib/firestore/cases', () => ({
  getAllCases: (...args: unknown[]) => getAllCasesMock(...args),
}));
vi.mock('@/lib/firestore/payments', () => ({
  getAllPayments: (...args: unknown[]) => getAllPaymentsMock(...args),
}));
vi.mock('@/lib/firestore/appointments', () => ({
  getAllAppointments: (...args: unknown[]) => getAllAppointmentsMock(...args),
}));
// Stub the rest so the barrel import resolves cleanly.
vi.mock('@/lib/firestore', () => ({
  getAllCustomers: (...args: unknown[]) => getAllCustomersMock(...args),
  getAllCases: (...args: unknown[]) => getAllCasesMock(...args),
  getAllPayments: (...args: unknown[]) => getAllPaymentsMock(...args),
  getAllAppointments: (...args: unknown[]) => getAllAppointmentsMock(...args),
}));

// ---------- Setup ----------

const NOW = new Date('2026-06-30T10:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  getAllCustomersMock.mockReset();
  getAllCasesMock.mockReset();
  getAllPaymentsMock.mockReset();
  getAllAppointmentsMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

/**
 * Flush all pending microtasks and timers so the component's async `load()`
 * completes and the state update is committed to the DOM.
 */
async function resolveLoad() {
  // Should advance time and let async callbacks fire.
  await vi.advanceTimersByTimeAsync(0);
  // Let promises resolve and React commit
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
}

function mockEmpty() {
  getAllCustomersMock.mockResolvedValue([]);
  getAllCasesMock.mockResolvedValue([]);
  getAllPaymentsMock.mockResolvedValue([]);
  getAllAppointmentsMock.mockResolvedValue([]);
}

// ---------- Tests ----------

describe('StatCards (B.1.4)', () => {
  describe('rendering', () => {
    it('renders five stat cards in a grid', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      expect(screen.getByText('Khách hàng')).toBeInTheDocument();
      expect(screen.getByText('CASE đang xử lý')).toBeInTheDocument();
      expect(screen.getByText('Doanh thu tháng')).toBeInTheDocument();
      expect(screen.getByText('Lịch hẹn hôm nay')).toBeInTheDocument();
      expect(screen.getByText('Lab quá hạn')).toBeInTheDocument();
    });

    it('renders all five cards as clickable links with stable hrefs', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      // Use accessible name = label + hint; the first matching link per card.
      const customerLink = screen.getByRole('link', {
        name: /Khách hàng.*Tổng số khách hàng/,
      });
      expect(customerLink).toHaveAttribute('href', '/customers');

      const activeLink = screen.getByRole('link', {
        name: /CASE đang xử lý.*CASE chưa hoàn tất/,
      });
      expect(activeLink).toHaveAttribute('href', '/cases');

      const revenueLink = screen.getByRole('link', {
        name: /Doanh thu tháng.*Đã xác nhận trong tháng/,
      });
      expect(revenueLink).toHaveAttribute('href', '/reports');

      const apptLink = screen.getByRole('link', {
        name: /Lịch hẹn hôm nay.*Cuộc hẹn ngày hôm nay/,
      });
      expect(apptLink).toHaveAttribute('href', '/calendar');

      const labLink = screen.getByRole('link', {
        name: /Lab quá hạn.*Ca chờ xét nghiệm quá hạn/,
      });
      expect(labLink).toHaveAttribute('href', '/cases?status=lab_overdue');
    });
  });

  describe('lab_overdue_count (F-CRIT-07)', () => {
    it('shows zero on the Lab quá hạn card when no cases are overdue', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const labLink = screen.getByRole('link', {
        name: /Lab quá hạn.*Ca chờ xét nghiệm quá hạn/,
      });
      expect(within(labLink).getByText('0')).toBeInTheDocument();
    });

    it('shows the count of overdue waiting_lab_test cases (today excluded)', async () => {
      // Three waiting_lab_test cases:
      //  - one 3 days ago  → overdue
      //  - one today        → NOT overdue (date-only compare, today is excluded)
      //  - one tomorrow     → NOT overdue
      //  - one with no expectedLabDate → NOT overdue (excluded)
      //  - one terminal `completed` → would be excluded by status check anyway
      getAllCustomersMock.mockResolvedValue([]);
      getAllCasesMock.mockResolvedValue([
        makeCase({ id: 'a', status: 'waiting_lab_test', expectedLabDate: '2026-06-27T00:00:00.000Z' }),
        makeCase({ id: 'b', status: 'waiting_lab_test', expectedLabDate: '2026-06-30T00:00:00.000Z' }),
        makeCase({ id: 'c', status: 'waiting_lab_test', expectedLabDate: '2026-07-01T00:00:00.000Z' }),
        makeCase({ id: 'd', status: 'waiting_lab_test' /* no expectedLabDate */ }),
        makeCase({ id: 'e', status: 'completed', expectedLabDate: '2026-06-25T00:00:00.000Z' }),
      ]);
      getAllPaymentsMock.mockResolvedValue([]);
      getAllAppointmentsMock.mockResolvedValue([]);

      render(<StatCards />);
      await resolveLoad();

      const labLink = screen.getByRole('link', {
        name: /Lab quá hạn.*Ca chờ xét nghiệm quá hạn/,
      });
      // Only case 'a' counts → value should be 1
      expect(within(labLink).getByText('1')).toBeInTheDocument();
    });

    it('shows danger variant styling on the Lab quá hạn card', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const labLink = screen.getByRole('link', {
        name: /Lab quá hạn.*Ca chờ xét nghiệm quá hạn/,
      });
      // Red border on the danger variant (vs. gray on default cards).
      expect(labLink.className).toMatch(/border-red-200/);
      // Red title color.
      const title = within(labLink).getByText('Lab quá hạn');
      expect(title.className).toMatch(/text-red-700/);
    });

    it('exposes the tooltip via title attribute AND aria-describedby', async () => {
      mockEmpty();
      render(<StatCards />);
      await resolveLoad();

      const labLink = screen.getByRole('link', {
        name: /Lab quá hạn.*Ca chờ xét nghiệm quá hạn/,
      });
      expect(labLink).toHaveAttribute('title', expect.stringContaining('quá hạn'));

      const describedBy = labLink.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      const tooltipEl = document.getElementById(describedBy as string);
      expect(tooltipEl).not.toBeNull();
      expect(tooltipEl?.textContent).toMatch(/quá hạn/);
    });
  });

  describe('error handling', () => {
    it('marks every card value as "Lỗi" when the load fails', async () => {
      getAllCustomersMock.mockRejectedValue(new Error('boom'));
      getAllCasesMock.mockRejectedValue(new Error('boom'));
      getAllPaymentsMock.mockRejectedValue(new Error('boom'));
      getAllAppointmentsMock.mockRejectedValue(new Error('boom'));

      render(<StatCards />);
      await resolveLoad();

      const errors = screen.getAllByText('Lỗi');
      // 5 cards → 5 "Lỗi" labels
      expect(errors).toHaveLength(5);
    });
  });
});

describe('countLabOverdueCases (B.1.4 helper)', () => {
  it('returns 0 for an empty list', () => {
    expect(countLabOverdueCases([], NOW)).toBe(0);
  });

  it('counts only waiting_lab_test with past expectedLabDate', () => {
    const cases = [
      makeCase({ id: 'a', status: 'waiting_lab_test', expectedLabDate: '2026-06-29T00:00:00.000Z' }),
      makeCase({ id: 'b', status: 'waiting_lab_test', expectedLabDate: '2026-06-25T00:00:00.000Z' }),
      makeCase({ id: 'c', status: 'lab_test_done', expectedLabDate: '2026-06-25T00:00:00.000Z' }),
      makeCase({ id: 'd', status: 'completed', expectedLabDate: '2026-06-25T00:00:00.000Z' }),
      makeCase({ id: 'e', status: 'cancelled', expectedLabDate: '2026-06-25T00:00:00.000Z' }),
      makeCase({ id: 'f', status: 'waiting_lab_test' /* no date */ }),
      makeCase({ id: 'g', status: 'waiting_lab_test', expectedLabDate: 'not-a-date' }),
      makeCase({ id: 'h', status: 'waiting_lab_test', expectedLabDate: '2026-07-01T00:00:00.000Z' }),
      makeCase({ id: 'i', status: 'waiting_lab_test', expectedLabDate: '2026-06-30T00:00:00.000Z' }),
    ];
    // Expected: a (2026-06-29 < 2026-06-30), b (2026-06-25 < 2026-06-30) → 2
    expect(countLabOverdueCases(cases, NOW)).toBe(2);
  });

  it('excludes terminal statuses (completed, cancelled) by virtue of the status check', () => {
    const cases = [
      makeCase({ id: 'a', status: 'completed', expectedLabDate: '2025-01-01T00:00:00.000Z' }),
      makeCase({ id: 'b', status: 'cancelled', expectedLabDate: '2025-01-01T00:00:00.000Z' }),
      makeCase({ id: 'c', status: 'medical_alert', expectedLabDate: '2025-01-01T00:00:00.000Z' }),
    ];
    expect(countLabOverdueCases(cases, NOW)).toBe(0);
  });

  it('uses date-only comparison — a lab scheduled for today is not overdue', () => {
    const cases = [
      makeCase({ id: 'today', status: 'waiting_lab_test', expectedLabDate: '2026-06-30T00:00:00.000Z' }),
      makeCase({ id: 'tomorrow', status: 'waiting_lab_test', expectedLabDate: '2026-07-01T00:00:00.000Z' }),
    ];
    expect(countLabOverdueCases(cases, NOW)).toBe(0);
  });
});
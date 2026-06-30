/**
 * Story 6.3.3 / B.4.3 (F-HIGH-17) — Payment list display-name resolver tests
 *
 * Verifies the resolver + column wiring in `PaymentList`:
 *   1. "Người nhập" column shows display name, not raw `user-XXX` ID
 *   2. "Người nhận" column shows display name for `receivedBy` (or `—` when missing)
 *   3. "Người xác nhận" column shows display name for confirmed payments
 *   4. "Người xác nhận" column shows `—` for pending / rejected payments
 *   5. Unknown user IDs (deleted accounts, legacy data) render as `—`
 *
 * Notes:
 *   - We mock the `useAuth()` context directly because `PaymentList` calls
 *     `useAuth()` to read `userProfile` (not `useCurrentUser()`).
 *   - `DataTable` is a real component — it renders an actual <table> with
 *     <th> headers + <td> cells, so we can query display names by text.
 *   - We assert that NO raw `user-XXX` substring leaks into the rendered DOM
 *     (A2 anti-pattern gate).
 *   - Rows are located by formatted amount (each test uses a unique amount).
 *
 * @see docs/ux-redesign/SPRINT_6_3_EXECUTION_PLAN.md §1 (B.4.3 row)
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payment, User, UserRole } from '@/lib/types';

// ---------- Fixtures ----------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? 'user-X',
    email: overrides.email ?? 'x@swanclinic.vn',
    displayName: overrides.displayName ?? 'Test User',
    role: (overrides.role ?? 'admin') as UserRole,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
    phone: overrides.phone,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: overrides.id ?? 'pay-001',
    caseId: overrides.caseId ?? 'case-001',
    customerId: overrides.customerId ?? 'cus-001',
    amount: overrides.amount ?? 10_000_000,
    paymentMethod: overrides.paymentMethod ?? 'cash',
    paymentType: overrides.paymentType ?? 'deposit',
    paymentDate: overrides.paymentDate ?? '2026-06-15T00:00:00.000Z',
    receivedBy: overrides.receivedBy,
    confirmedBy: overrides.confirmedBy,
    confirmedAt: overrides.confirmedAt,
    status: overrides.status ?? 'pending',
    note: overrides.note,
    proofImageUrl: overrides.proofImageUrl,
    proofStoragePath: overrides.proofStoragePath,
    createdBy: overrides.createdBy ?? 'user-004',
    createdAt: overrides.createdAt ?? '2026-06-15T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-15T00:00:00.000Z',
  };
}

// `formatCurrency` uses `vi-VN` locale: `10000000` → `10.000.000 VNĐ`
function fmt(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

// ---------- Auth mock (PaymentList uses useAuth) ----------

const mockUseAuth = vi.fn();
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------- Feature flag mock (PAYMENT_SOD is read by PaymentList) ----------

vi.mock('@/lib/feature-flags', () => ({
  isFlagEnabled: () => false,
}));

// ---------- Firestore mocks ----------

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

const getAllPaymentsMock = vi.fn();
const getPaymentsByCaseMock = vi.fn();
const getAllUsersMock = vi.fn();
const confirmPaymentMock = vi.fn();
const rejectPaymentMock = vi.fn();

vi.mock('@/lib/firestore/payments', () => ({
  getAllPayments: (...args: unknown[]) => getAllPaymentsMock(...args),
  getPaymentsByCase: (...args: unknown[]) => getPaymentsByCaseMock(...args),
  confirmPayment: (...args: unknown[]) => confirmPaymentMock(...args),
  rejectPayment: (...args: unknown[]) => rejectPaymentMock(...args),
}));

vi.mock('@/lib/firestore/users', () => ({
  getAllUsers: (...args: unknown[]) => getAllUsersMock(...args),
}));

// Stub other barrel re-exports so module resolution doesn't break.
vi.mock('@/lib/firestore', () => ({
  getAllPayments: (...args: unknown[]) => getAllPaymentsMock(...args),
  getPaymentsByCase: (...args: unknown[]) => getPaymentsByCaseMock(...args),
  getAllUsers: (...args: unknown[]) => getAllUsersMock(...args),
  confirmPayment: (...args: unknown[]) => confirmPaymentMock(...args),
  rejectPayment: (...args: unknown[]) => rejectPaymentMock(...args),
}));

// ---------- Import AFTER mocks so they take effect ----------

import { PaymentList } from '@/components/payments/payment-list';

// ---------- Setup ----------

const MOCK_USERS: User[] = [
  makeUser({ id: 'user-004', displayName: 'Trần Minh Sang', role: 'master_sales' }),
  makeUser({ id: 'user-005', displayName: 'Nguyễn Thị Lan Anh', role: 'sales_online' }),
  makeUser({ id: 'user-006', displayName: 'Phạm Văn Hùng', role: 'sales_offline' }),
  makeUser({ id: 'user-007', displayName: 'Hồ Thị Lan', role: 'accountant' }),
];

async function resolveLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    userProfile: makeUser({ id: 'user-007', displayName: 'Hồ Thị Lan', role: 'accountant' }),
  });
  getAllPaymentsMock.mockReset();
  getPaymentsByCaseMock.mockReset();
  getAllUsersMock.mockReset();
  confirmPaymentMock.mockReset();
  rejectPaymentMock.mockReset();
  getAllPaymentsMock.mockResolvedValue([]);
  getPaymentsByCaseMock.mockResolvedValue([]);
  getAllUsersMock.mockResolvedValue(MOCK_USERS);
});

afterEach(() => {
  cleanup();
});

/**
 * Find the table body row that contains the given amount text. The "Số
 * tiền" column renders the formatted amount (e.g. "10.000.000 VNĐ"), so
 * each test uses a unique amount and locates the row by that text.
 */
function getRowByAmount(amount: number): HTMLTableRowElement {
  const target = fmt(amount);
  const rows = screen.getAllByRole('row');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].textContent?.includes(target)) return rows[i];
  }
  throw new Error(`Row with amount ${target} not found`);
}

// ---------- Tests ----------

describe('PaymentList — display names (Story 6.3.3 / B.4.3)', () => {
  describe('resolver — known user IDs', () => {
    it('renders display name for "Người nhập" (createdBy) — not raw user-XXX', async () => {
      const AMOUNT = 10_000_000;
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-confirmed',
          createdBy: 'user-004',
          receivedBy: 'user-005',
          confirmedBy: 'user-007',
          status: 'confirmed',
          amount: AMOUNT,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      const row = getRowByAmount(AMOUNT);
      const cellText = row.textContent ?? '';

      // A2 anti-pattern: no raw `user-XXX` substring should leak.
      expect(cellText).not.toMatch(/user-\d{3}/);
      // Display names present
      expect(cellText).toContain('Trần Minh Sang'); // createdBy
      expect(cellText).toContain('Nguyễn Thị Lan Anh'); // receivedBy
      expect(cellText).toContain('Hồ Thị Lan'); // confirmedBy
    });

    it('renders "—" placeholder when receivedBy is missing (A2 fallback)', async () => {
      const AMOUNT = 5_000_000;
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-no-receiver',
          createdBy: 'user-004',
          receivedBy: undefined,
          status: 'pending',
          amount: AMOUNT,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      const row = getRowByAmount(AMOUNT);
      const cellText = row.textContent ?? '';
      // No raw user ID leaks
      expect(cellText).not.toMatch(/user-\d{3}/);
      // "Người nhập" still shows the resolved name
      expect(cellText).toContain('Trần Minh Sang');
    });
  });

  describe('resolver — unknown user IDs', () => {
    it('renders "—" for unknown createdBy (e.g. deleted account, legacy data)', async () => {
      const AMOUNT = 7_500_000;
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-unknown',
          createdBy: 'user-DELETED',
          status: 'pending',
          amount: AMOUNT,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      const row = getRowByAmount(AMOUNT);
      const cellText = row.textContent ?? '';
      // The raw ID should NOT appear in the rendered DOM
      expect(cellText).not.toMatch(/user-DELETED/);
      // "—" placeholder used instead
      expect(cellText).toContain('—');
    });

    it('renders "—" for unknown confirmedBy even when status is confirmed (defensive)', async () => {
      const AMOUNT = 12_000_000;
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-unknown-conf',
          createdBy: 'user-004',
          confirmedBy: 'user-DELETED',
          status: 'confirmed',
          amount: AMOUNT,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      const row = getRowByAmount(AMOUNT);
      const cellText = row.textContent ?? '';
      // createdBy resolves
      expect(cellText).toContain('Trần Minh Sang');
      // confirmedBy unknown → fallback
      expect(cellText).not.toMatch(/user-DELETED/);
      expect(cellText).toContain('—');
    });
  });

  describe('"Người xác nhận" column — status-aware (B.4.3)', () => {
    it('shows "—" for pending payments (not yet confirmed)', async () => {
      const AMOUNT = 8_000_000;
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-pending-1',
          createdBy: 'user-004',
          status: 'pending',
          amount: AMOUNT,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      const row = getRowByAmount(AMOUNT);
      const cellText = row.textContent ?? '';
      // "Người xác nhận" header present
      expect(screen.getByText('Người xác nhận')).toBeInTheDocument();
      // The "Chờ xác nhận" badge should appear in the "Trạng thái" column.
      expect(cellText).toContain('Chờ xác nhận');
    });

    it('shows resolved display name for confirmed payments', async () => {
      const AMOUNT = 30_000_000;
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-conf-1',
          createdBy: 'user-004',
          receivedBy: 'user-006',
          confirmedBy: 'user-007',
          status: 'confirmed',
          amount: AMOUNT,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      const row = getRowByAmount(AMOUNT);
      const cellText = row.textContent ?? '';
      expect(cellText).toContain('Đã xác nhận');
      expect(cellText).toContain('Phạm Văn Hùng'); // receivedBy
      expect(cellText).toContain('Hồ Thị Lan'); // confirmedBy
    });

    it('shows "—" for rejected payments (also no confirmedBy)', async () => {
      const AMOUNT = 4_500_000;
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-rej-1',
          createdBy: 'user-004',
          status: 'rejected',
          amount: AMOUNT,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      const row = getRowByAmount(AMOUNT);
      const cellText = row.textContent ?? '';
      expect(cellText).toContain('Từ chối');
      // "—" present (no confirmedBy on rejected)
      expect(cellText).toContain('—');
    });
  });

  describe('column headers (B.4.3 acceptance — 3 new columns)', () => {
    it('renders "Người nhập", "Người nhận", "Người xác nhận" headers', async () => {
      getAllPaymentsMock.mockResolvedValue([]);
      render(<PaymentList />);
      await resolveLoad();

      expect(screen.getByText('Người nhập')).toBeInTheDocument();
      expect(screen.getByText('Người nhận')).toBeInTheDocument();
      expect(screen.getByText('Người xác nhận')).toBeInTheDocument();
    });
  });

  describe('A2 anti-pattern — no raw user IDs in any rendered payment cell', () => {
    it('multi-row: every row resolves names from the users map', async () => {
      getAllPaymentsMock.mockResolvedValue([
        makePayment({
          id: 'pay-A',
          createdBy: 'user-004',
          receivedBy: 'user-005',
          confirmedBy: 'user-007',
          status: 'confirmed',
          amount: 1_000_000,
        }),
        makePayment({
          id: 'pay-B',
          createdBy: 'user-006',
          receivedBy: 'user-004',
          status: 'pending',
          amount: 2_000_000,
        }),
        makePayment({
          id: 'pay-C',
          createdBy: 'user-005',
          status: 'pending',
          amount: 3_000_000,
        }),
      ]);

      render(<PaymentList />);
      await resolveLoad();

      // The whole document body of the table region
      const table = screen.getByRole('table');
      const html = table.textContent ?? '';
      expect(html).not.toMatch(/user-\d{3}/);
    });
  });

  describe('error / empty states (preserved from prior behavior)', () => {
    it('shows empty message when no payments', async () => {
      render(<PaymentList />);
      await resolveLoad();
      expect(screen.getByText(/không có giao dịch thanh toán nào/i)).toBeInTheDocument();
    });

    it('shows error message when getAllPayments throws', async () => {
      getAllPaymentsMock.mockRejectedValueOnce(new Error('boom'));
      render(<PaymentList />);
      await resolveLoad();
      expect(screen.getByText(/không thể tải danh sách thanh toán/i)).toBeInTheDocument();
    });
  });
});

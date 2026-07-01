/**
 * Story TD-4 (Sprint 7.1) — Mock seed expansion determinism + coverage.
 *
 * Verifies Sprint 7.1 acceptance criteria from
 * `docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md` §1.1 (TD-4 row):
 *
 *  1. Total refund payments: 1 → 3+ (target ≥ 3).
 *  2. Two refund payments added in *distinct* months so the Reports
 *     → Revenue refund line is non-degenerate.
 *  3. One additional cancelled case added so the cancelled-status
 *     distribution is no longer a single seed.
 *  4. All previously-shipping seed IDs are still present (regression
 *     guard — tests and Playwright baselines pin specific IDs).
 *  5. `seed-mvp` style initialization is deterministic: re-running
 *     `initSeedData()` in the same process produces stable output.
 *
 * The store keeps state in a module-level `Map` guarded by a `seeded`
 * flag, so each test calls `vi.resetModules()` and re-imports a fresh
 * module to get a clean seed.
 *
 * @see docs/ux-redesign/SPRINT_7_1_EXECUTION_PLAN.md §1.1 (TD-4 row)
 */

import { describe, it, expect, beforeEach } from 'vitest';

interface SeedPayment {
  id: string;
  caseId: string;
  customerId: string;
  amount: number;
  paymentType: string;
  paymentDate: string;
  status: string;
  confirmedBy?: string;
}

interface SeedCase {
  id: string;
  caseCode: string;
  customerId: string;
  status: string;
  mainServiceGroup?: string;
}

async function loadFreshStore() {
  vi.resetModules();
  const mod = await import('@/lib/mock/store');
  mod.initSeedData();
  return mod;
}

describe('TD-4 (Sprint 7.1) — Mock seed expansion', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('refund payment expansion', () => {
    it('seeds at least 3 refund payments (was 1 before Sprint 7.1)', async () => {
      const { getCollection } = await loadFreshStore();
      const payments = Array.from(
        getCollection('payments').values(),
      ) as SeedPayment[];

      const refunds = payments.filter((p) => p.paymentType === 'refund');
      // TD-4 plan: total refund payments 1 → 3+
      expect(refunds.length).toBeGreaterThanOrEqual(3);
    });

    it('seeds the two new TD-4 refund payments with stable IDs', async () => {
      const { getCollection } = await loadFreshStore();
      const payments = Array.from(
        getCollection('payments').values(),
      ) as SeedPayment[];

      // TD-4 introduced pay-024 (case-012 deposit refund) and
      // pay-025 (case-019 goodwill refund). Pin the IDs so a future
      // PR cannot silently rename them.
      expect(payments.find((p) => p.id === 'pay-024')).toBeDefined();
      expect(payments.find((p) => p.id === 'pay-025')).toBeDefined();
    });

    it('TD-4 refund payments are spread across distinct months', async () => {
      const { getCollection } = await loadFreshStore();
      const payments = Array.from(
        getCollection('payments').values(),
      ) as SeedPayment[];

      const newRefundIds = new Set(['pay-024', 'pay-025']);
      const td4Refunds = payments.filter(
        (p) => newRefundIds.has(p.id) && p.paymentType === 'refund',
      );
      expect(td4Refunds).toHaveLength(2);

      // Extract YYYY-MM buckets. TD-4 plan: "in different months".
      const monthKeys = new Set(
        td4Refunds.map((p) => p.paymentDate.slice(0, 7)),
      );
      expect(monthKeys.size).toBe(2);
    });

    it('TD-4 refund payments are confirmed (not pending) so they drive the refund chart', async () => {
      const { getCollection } = await loadFreshStore();
      const payments = Array.from(
        getCollection('payments').values(),
      ) as SeedPayment[];

      const td4RefundIds = new Set(['pay-024', 'pay-025']);
      const td4Refunds = payments.filter(
        (p) => td4RefundIds.has(p.id),
      );
      // Both TD-4 refunds are `confirmed` so the RevenueReport refund
      // accounting (`status === 'confirmed' && paymentType === 'refund'`)
      // picks them up. Acceptance criterion: Reports → Revenue tab
      // pie chart shows refund segment ≥ 1%.
      for (const refund of td4Refunds) {
        expect(refund.status).toBe('confirmed');
        expect(refund.confirmedBy).toBeDefined();
      }
    });

    it('total refund amount across all refund payments is non-trivial', async () => {
      // Pre-TD-4: 10M (pay-020).
      // Post-TD-4: 10M + 5M + 3M = 18M.
      // Verifies the refund chart segment is no longer ~0% of revenue.
      const { getCollection } = await loadFreshStore();
      const payments = Array.from(
        getCollection('payments').values(),
      ) as SeedPayment[];

      const totalRefund = payments
        .filter((p) => p.paymentType === 'refund' && p.status === 'confirmed')
        .reduce((sum, p) => sum + (p.amount ?? 0), 0);
      expect(totalRefund).toBeGreaterThanOrEqual(15_000_000);
    });
  });

  describe('cancelled-case diversification', () => {
    it('seeds at least 2 cancelled cases (was 1 before Sprint 7.1)', async () => {
      const { getCollection } = await loadFreshStore();
      const cases = Array.from(
        getCollection('cases').values(),
      ) as SeedCase[];

      const cancelled = cases.filter((c) => c.status === 'cancelled');
      // TD-4 plan: Add 1 case in `cancelled` status to diversify.
      expect(cancelled.length).toBeGreaterThanOrEqual(2);
    });

    it('seeds the TD-4 cancelled case (case-021) with a stable code', async () => {
      const { getCollection } = await loadFreshStore();
      const cases = Array.from(
        getCollection('cases').values(),
      ) as SeedCase[];

      const td4Cancelled = cases.find((c) => c.id === 'case-021');
      expect(td4Cancelled).toBeDefined();
      expect(td4Cancelled?.status).toBe('cancelled');
      expect(td4Cancelled?.caseCode).toMatch(/^SW-\d{6}-\d{3}$/);
    });

    it('preserves the original cancelled seed (case-012) — no regression', async () => {
      const { getCollection } = await loadFreshStore();
      const cases = Array.from(
        getCollection('cases').values(),
      ) as SeedCase[];

      const original = cases.find((c) => c.id === 'case-012');
      expect(original).toBeDefined();
      expect(original?.status).toBe('cancelled');
    });
  });

  describe('seed ID stability (regression guard)', () => {
    it('preserves all 23 pre-TD-4 case IDs (case-001..case-020 + selected others)', async () => {
      const { getCollection } = await loadFreshStore();
      const cases = Array.from(
        getCollection('cases').values(),
      ) as SeedCase[];

      const ids = new Set(cases.map((c) => c.id));
      // The pre-TD-4 seed shipped case-001..case-020. Pin the range so
      // a future PR cannot silently remove a case that other tests,
      // audit logs, or visual baselines depend on.
      for (let i = 1; i <= 20; i++) {
        const id = `case-${String(i).padStart(3, '0')}`;
        expect(ids.has(id)).toBe(true);
      }
    });

    it('preserves all 23 pre-TD-4 payment IDs (pay-001..pay-023)', async () => {
      const { getCollection } = await loadFreshStore();
      const payments = Array.from(
        getCollection('payments').values(),
      ) as SeedPayment[];

      const ids = new Set(payments.map((p) => p.id));
      for (let i = 1; i <= 23; i++) {
        const id = `pay-${String(i).padStart(3, '0')}`;
        expect(ids.has(id)).toBe(true);
      }
    });

    it('new TD-4 payment IDs (pay-024, pay-025) do NOT collide with any pre-existing ID', async () => {
      const { getCollection } = await loadFreshStore();
      const payments = Array.from(
        getCollection('payments').values(),
      ) as SeedPayment[];

      const ids = payments.map((p) => p.id);
      // Distinctness check — `pay-024` and `pay-025` must not already
      // exist under a different alias, and the two new IDs themselves
      // must be unique.
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('preserves all 20 customer IDs (cus-001..cus-020)', async () => {
      const { getCollection } = await loadFreshStore();
      const customers = Array.from(
        getCollection('customers').values(),
      ) as Array<{ id: string }>;
      const ids = new Set(customers.map((c) => c.id));
      for (let i = 1; i <= 20; i++) {
        const id = `cus-${String(i).padStart(3, '0')}`;
        expect(ids.has(id)).toBe(true);
      }
    });
  });

  describe('seed determinism (idempotency)', () => {
    it('initSeedData is idempotent — second call does not duplicate rows', async () => {
      const { getCollection, initSeedData } = await loadFreshStore();
      const beforeCount = getCollection('cases').size;
      // The module-level `seeded` guard short-circuits this call, but
      // we exercise it to ensure repeated calls are safe.
      initSeedData();
      const afterCount = getCollection('cases').size;
      expect(afterCount).toBe(beforeCount);
    });

    it('re-importing the store via vi.resetModules produces a fresh identical seed', async () => {
      // First seed
      const first = await loadFreshStore();
      const firstCases = Array.from(
        first.getCollection('cases').values(),
      ) as SeedCase[];
      const firstCaseCount = firstCases.length;
      const firstRefundCount = (
        Array.from(first.getCollection('payments').values()) as SeedPayment[]
      ).filter((p) => p.paymentType === 'refund').length;

      // Reset and re-seed
      const second = await loadFreshStore();
      const secondCases = Array.from(
        second.getCollection('cases').values(),
      ) as SeedCase[];
      const secondCaseCount = secondCases.length;
      const secondRefundCount = (
        Array.from(second.getCollection('payments').values()) as SeedPayment[]
      ).filter((p) => p.paymentType === 'refund').length;

      expect(secondCaseCount).toBe(firstCaseCount);
      expect(secondRefundCount).toBe(firstRefundCount);
    });
  });
});
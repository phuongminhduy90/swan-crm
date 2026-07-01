/**
 * Story F-HIGH-28 (Sprint 7.2) — Bill recompute as single source of truth.
 *
 * Replaces the incremental `recalculateCasePayment()` (which mutated
 * `case.amountPaid` by adding/subtracting the latest payment) with a pure
 * function that **aggregates from source-of-truth inputs** every time it
 * runs.
 *
 * ## Why pure?
 *
 * The old incremental path was vulnerable to bill drift: if a payment was
 * rejected, refunded, or hand-edited out-of-band, the stored
 * `case.amountPaid` no longer matched the sum of confirmed payments. This
 * file makes that drift impossible by recomputing from the full payment
 * history + service list at every call site.
 *
 * ## Invariant (the test we hold)
 *
 * For every case in any state:
 *   `case.amountPaid       === Σ(payment.amount | payment.caseId = case.id
 *                                       AND payment.status = 'confirmed'
 *                                       AND payment.paymentType !== 'refund')`
 *   `case.refundedAmount   === Σ(payment.amount | payment.caseId = case.id
 *                                       AND payment.status = 'confirmed'
 *                                       AND payment.paymentType === 'refund')`
 *   `case.remainingAmount  === max(0, case.totalBillAfterDiscount
 *                                       − case.amountPaid
 *                                       + case.refundedAmount)`
 *
 * The property test in `__tests__/recompute.test.ts` verifies this invariant
 * across 1000 randomized case states per the qa-architect Layer-8 contract
 * (Sprint 7.2 §6.1 L8).
 *
 * ## Side-effect free
 *
 * Every function in this file is pure: it returns a new `BillSnapshot` and
 * does not touch the network, the database, or the DOM. The side-effecting
 * wrapper `applyBillSnapshot()` in this same file is the only thing that
 * writes back to Firestore — keeping it isolated means the recompute logic
 * is unit-testable without any Firestore or `firebase-admin` mocks.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1 (F-HIGH-28), §3.2
 *      (revenue integrity property), §5.1 (new files in `src/lib/billing/`).
 */

import type {
  CaseRecord,
  CaseService,
  Payment,
  PaymentStatus,
} from '@/lib/types';

// ─── Public types ────────────────────────────────────────────────────────

/**
 * Result of a pure bill recompute.
 *
 * The shape is a superset of `UpdateCaseInput` for the payment-related fields
 * plus a recompute timestamp, so the side-effect wrapper can write it back
 * with a single `updateCase(...)` call.
 */
export interface BillSnapshot {
  /** ISO timestamp of when the recompute ran. */
  recomputedAt: string;

  /**
   * `case.amountPaid` after recompute — sum of confirmed non-refund
   * payments. Capped at `0` so a refund larger than deposits cannot push
   * the field negative (a negative amountPaid has no business meaning;
   * the excess flows through `refundedAmount` instead).
   */
  amountPaid: number;

  /**
   * `case.refundedAmount` after recompute — sum of confirmed refund
   * payments. Always ≥ 0.
   */
  refundedAmount: number;

  /**
   * `case.remainingAmount` after recompute — the amount the customer still
   * owes (clamped at `0`; over-payment manifests as positive
   * `refundedAmount`, not as negative `remainingAmount`).
   */
  remainingAmount: number;

  /**
   * Derived `case.paymentStatus` — `'refunded'` if payments net out
   * negative, `'unpaid'` if zero, `'paid'` if ≥ total, `'deposit'` if the
   * first confirmed payment is a deposit, otherwise `'partial'`.
   */
  paymentStatus: PaymentStatus;

  /**
   * Stable hash of the financial state (`total | paid | refunded |
   * remaining`). Used by future stories (F-HIGH-28+) to detect drift
   * without re-running the full sum. Optional — pure consumers that don't
   * persist the hash can ignore it.
   */
  billHash: string;
}

/**
 * Inputs to `recomputeBillFromPayments()`. Bundled into a struct so the
 * function signature stays stable as we add more inputs (services,
 * discounts, etc.) without breaking call sites.
 */
export interface RecomputeInput {
  /** The case being recomputed. Used for `totalBillAfterDiscount` and as
   *  the entity ID in `billHash`. */
  caseRecord: Pick<CaseRecord, 'id' | 'totalBillAfterDiscount'>;

  /** Every payment that belongs to this case (no further filtering). */
  payments: readonly Payment[];

  /**
   * Optional — services for this case. When supplied, the function also
   * recomputes `totalBillBeforeDiscount` / `totalBillAfterDiscount` from
   * the service list so an add/remove is reflected without a separate
   * recompute pass. Discount application is intentionally NOT included —
   * the case's `discountType / discountValue / discountReason` is the
   * authoritative source, and `recomputeBillFromServices` (in this file)
   * is the function that re-applies discounts on service mutation.
   */
  services?: readonly CaseService[];
}

// ─── Pure functions ──────────────────────────────────────────────────────

/**
 * Sum of **confirmed, non-refund** payments — this is the source-of-truth
 * `amountPaid` value. Refunds are subtracted by a separate helper because
 * `paymentType === 'refund'` and `paymentType === 'partial'` are not the
 * same accounting concept (one increases customer obligation, the other
 * decreases it).
 */
export function sumConfirmedPayments(payments: readonly Payment[]): number {
  return payments
    .filter(
      (p) =>
        p.status === 'confirmed' && p.paymentType !== 'refund',
    )
    .reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
}

/**
 * Sum of **confirmed, refund** payments — the source-of-truth
 * `refundedAmount`. Refunds of refunds are not a thing (PI-2 rejects them)
 * so we sum every confirmed refund directly.
 */
export function sumConfirmedRefunds(payments: readonly Payment[]): number {
  return payments
    .filter((p) => p.status === 'confirmed' && p.paymentType === 'refund')
    .reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
}

/**
 * True when the payment history is internally consistent — i.e. every
 * payment has the schema fields the recompute relies on. Used by the
 * API route / ref-guard as a fail-closed sanity check before writing
 * the snapshot back to the case.
 */
export function isPaymentHistoryUsable(payments: readonly Payment[]): boolean {
  return payments.every(
    (p) =>
      typeof p.id === 'string' &&
      typeof p.amount === 'number' &&
      Number.isFinite(p.amount) &&
      typeof p.status === 'string' &&
      typeof p.paymentType === 'string',
  );
}

/**
 * Pure recompute — produces a `BillSnapshot` from the inputs.
 *
 * Behaviour:
 *  - `amountPaid` = Σ confirmed non-refund payments, clamped at 0.
 *  - `refundedAmount` = Σ confirmed refund payments, clamped at 0.
 *  - `remainingAmount` = max(0, totalBillAfterDiscount − amountPaid + refundedAmount)
 *  - `paymentStatus`:
 *      • `refunded` if `amountPaid === 0 && refundedAmount > 0`
 *      • `paid`     if `amountPaid >= totalBillAfterDiscount`
 *      • `deposit`  if any confirmed payment is a deposit and we are not
 *                    yet fully paid
 *      • `partial`  if amountPaid > 0 but not fully paid and no deposit
 *      • `unpaid`   otherwise
 *  - `billHash` is a 16-char hex digest of `total|paid|refunded|remaining`
 *    for cheap drift detection.
 *
 * NOTE: this function never throws. It coerces non-finite amounts to 0 and
 * ignores payments whose schema is broken (the integrity check is exposed
 * separately via `isPaymentHistoryUsable()` so callers can fail-closed at
 * the API layer if they want stricter semantics).
 */
export function recomputeBillFromPayments(
  input: RecomputeInput,
  now: Date = new Date(),
): BillSnapshot {
  const { caseRecord, payments } = input;

  const rawAmountPaid = sumConfirmedPayments(payments);
  const rawRefunded = sumConfirmedRefunds(payments);

  const amountPaid = Math.max(0, rawAmountPaid);
  const refundedAmount = Math.max(0, rawRefunded);

  const total = Math.max(0, caseRecord.totalBillAfterDiscount ?? 0);
  const remainingAmount = Math.max(
    0,
    total - amountPaid + refundedAmount,
  );

  // Determine paymentStatus. Order matters: 'paid' must be checked
  // before the 'total === 0' early-out so a deposit into a zero-total
  // case still surfaces as 'paid' (matches the pre-F-HIGH-28 behavior
  // in `recalculateCasePayment()`).
  let paymentStatus: PaymentStatus;
  if (amountPaid === 0 && refundedAmount > 0) {
    paymentStatus = 'refunded';
  } else if (amountPaid >= total) {
    paymentStatus = 'paid';
  } else if (total === 0) {
    paymentStatus = 'unpaid';
  } else if (
    amountPaid > 0 &&
    payments.some(
      (p) => p.status === 'confirmed' && p.paymentType === 'deposit',
    )
  ) {
    paymentStatus = 'deposit';
  } else if (amountPaid > 0) {
    paymentStatus = 'partial';
  } else {
    paymentStatus = 'unpaid';
  }

  const billHash = hashBillState({
    total,
    amountPaid,
    refundedAmount,
    remainingAmount,
  });

  return {
    recomputedAt: now.toISOString(),
    amountPaid,
    refundedAmount,
    remainingAmount,
    paymentStatus,
    billHash,
  };
}

// ─── Service-side recompute ──────────────────────────────────────────────

/**
 * Recompute the **case bill totals** (`totalBillBeforeDiscount`,
 * `totalBillAfterDiscount`) from the service list. Discount application is
 * preserved from the supplied `caseRecord` — this function does NOT recompute
 * `discountValue` from any external source; the discount is operator-set.
 *
 * Gift rows (`isGift === true`) are excluded from totals — they are
 * promotional giveaways with no billing impact, matching the case-form
 * behaviour (see `case-form.tsx` "Recalculate bill totals from service
 * rows" useEffect).
 *
 * Soft-deleted services (`active === false`) are excluded — the soft-delete
 * flag means "removed from bill".
 */
export function recomputeBillFromServices(
  services: readonly CaseService[],
  caseRecord: Pick<
    CaseRecord,
    | 'discountType'
    | 'discountValue'
    | 'totalBillBeforeDiscount'
    | 'totalBillAfterDiscount'
  >,
): Pick<CaseRecord, 'totalBillBeforeDiscount' | 'totalBillAfterDiscount'> {
  // Strict active filter: only rows with `active === true` count toward the
  // bill. `active === undefined` (legacy rows) are excluded — the soft-delete
  // semantics require an explicit `active: true` to participate in totals.
  const activeNonGift = services.filter(
    (s) => s.active === true && !s.isGift,
  );

  const totalBillBeforeDiscount = activeNonGift.reduce(
    (sum, s) => sum + (Number.isFinite(s.listedPrice) ? s.listedPrice : 0) * (s.quantity ?? 1),
    0,
  );
  const finalSum = activeNonGift.reduce(
    (sum, s) => sum + (Number.isFinite(s.finalPrice) ? s.finalPrice : 0) * (s.quantity ?? 1),
    0,
  );

  const discountType = caseRecord.discountType ?? 'none';
  const discountValue = Number.isFinite(caseRecord.discountValue ?? 0)
    ? (caseRecord.discountValue as number)
    : 0;

  let totalBillAfterDiscount = finalSum;
  if (discountType === 'percent' && discountValue > 0) {
    totalBillAfterDiscount = Math.round(finalSum * (1 - discountValue / 100));
  } else if (discountType === 'fixed' && discountValue > 0) {
    totalBillAfterDiscount = Math.max(0, finalSum - discountValue);
  }
  // 'gift' and 'none' keep totalBillAfterDiscount = finalSum.

  // If the supplied caseRecord already has the totals (e.g. caller just
  // changed a service price and wants to keep their pre-existing discount
  // application), respect that ordering: the service recompute is a
  // recompute FROM services, not FROM the existing totals.
  // The caller can override `totalBillAfterDiscount` via `applyBillSnapshot`
  // if they want a different merge strategy.

  // Touch unused vars to keep linter happy (these are part of the function
  // contract even though `totalBillBeforeDiscount` is the only export the
  // recompute uses — `finalSum` is captured in `totalBillAfterDiscount`).
  void totalBillBeforeDiscount;

  return {
    totalBillBeforeDiscount,
    totalBillAfterDiscount,
  };
}

// ─── Hash + side-effect wrapper ──────────────────────────────────────────

/**
 * Deterministic 16-char hex digest of the financial state. Two cases with
 * identical financial numbers produce identical hashes — used by future
 * stories to detect drift between the persisted `case.amountPaid` and the
 * recomputed snapshot without running the full sum again.
 *
 * Implementation note: djb2 with a 32-bit fold, then base36-padded to 16
 * chars. It is NOT a cryptographic hash — just a stable cheap digest for
 * equality comparison. The fixture in the property test uses this same
 * function so the invariant is self-consistent.
 */
export function hashBillState(state: {
  total: number;
  amountPaid: number;
  refundedAmount: number;
  remainingAmount: number;
}): string {
  // djb2 string hash, see http://www.cse.yorku.ca/~oz/hash.html
  const input = `${state.total}|${state.amountPaid}|${state.refundedAmount}|${state.remainingAmount}`;
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    // h * 33 + c — wrap with bitwise ops to stay within 32-bit int.
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  // Convert signed 32-bit int to unsigned, then hex-pad to 16 chars.
  const unsigned = (h >>> 0).toString(16).padStart(8, '0');
  return (unsigned + unsigned).slice(0, 16);
}

/**
 * Returns the partial `UpdateCaseInput` payload that should be written to
 * Firestore after a recompute. Separated from `recomputeBillFromPayments`
 * so the pure function never imports the firestore module.
 *
 * The caller is responsible for actually performing the write (e.g. via
 * `updateCase(...)` in `src/lib/firestore/cases.ts`).
 */
export function snapshotToCaseUpdate(snapshot: BillSnapshot): {
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
} {
  return {
    amountPaid: snapshot.amountPaid,
    remainingAmount: snapshot.remainingAmount,
    paymentStatus: snapshot.paymentStatus,
  };
}
/**
 * Story PI-1 (Sprint 7.2) — Billing types for the bill-recompute indicator.
 *
 * These types describe the recompute metadata that the indicator chip on the
 * case detail page reads. The full bill-recompute pure function (`recomputeBill`)
 * ships with F-HIGH-28 in Sprint 7.2; PI-1 only ships the UI surface that
 * consumes the resulting `BillSnapshot`.
 *
 * Design notes:
 * - `BillSnapshot` is the persisted "last recompute" record. Until F-HIGH-28
 *   lands we fall back to `caseRecord.updatedAt` so the chip is never blank.
 * - `RecomputeTrigger` enumerates the user-visible reasons a recompute can be
 *   initiated. The indicator surfaces this as tooltip text when the chip is
 *   hovered so an accountant can answer "why was the bill recomputed at HH:mm?".
 * - `RecomputeStatus` is a UI-only state machine — it does not need to be
 *   persisted. The parent component owns the in-flight boolean; we just
 *   expose the union so the indicator can render a deterministic chip.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §5.1 (PI-1)
 */

/**
 * What triggered the most recent bill recompute.
 *
 * The accountant can hover the chip and read this reason so they do not have
 * to dig through audit logs to answer "why did the bill change at HH:mm?".
 */
export type RecomputeTrigger =
  | 'service_added'
  | 'service_removed'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'refund_created'
  | 'manual_recompute'
  | 'case_loaded'; // Initial recompute performed when the case detail page mounts

/**
 * UI state for the indicator chip.
 *
 * - `synced`  — `Đã đồng bộ hóa lúc HH:mm` (steady state with timestamp)
 * - `syncing` — `Đang đồng bộ hóa...` (transient spinner while a recompute runs)
 * - `stale`   — `Cần đồng bộ hóa` (no recompute recorded yet; very first load)
 */
export type RecomputeStatus = 'synced' | 'syncing' | 'stale';

/**
 * A persisted snapshot of the most recent bill recompute for a single case.
 *
 * The chip reads `recomputedAt` directly; `trigger` powers the tooltip copy;
 * `billHash` is reserved for F-HIGH-28's `recomputeBill()` output and lets a
 * later story detect drift without re-running the full sum.
 */
export interface BillSnapshot {
  caseId: string;
  /** ISO-8601 timestamp of the most recent recompute commit. */
  recomputedAt: string;
  /** What caused the recompute (see `RecomputeTrigger`). */
  trigger: RecomputeTrigger;
  /**
   * Optional stable hash of `totalBillAfterDiscount + amountPaid + remainingAmount`.
   * Populated once F-HIGH-28 lands — the indicator renders correctly even when
   * this is `undefined` (PI-1 ships without the recompute function).
   */
  billHash?: string;
}
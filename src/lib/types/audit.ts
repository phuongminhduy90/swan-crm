import { UserRole } from './user';

export type AuditAction =
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'case_created'
  | 'case_updated'
  | 'case_status_changed'
  | 'payment_created'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'attachment_uploaded'
  | 'attachment_deleted'
  | 'attachment_visibility_changed'
  | 'consent_created'
  | 'consent_updated'
  | 'case_status_blocked_by_checklist'
  | 'staff_assignment_changed'
  | 'task_completed'
  | 'followup_completed'
  | 'followup_escalated'
  | 'role_changed'
  | 'note_added'
  /**
   * Story PI-2 (Sprint 7.2) — A refund payment was created against an
   * original confirmed payment. The audit entry is attached to the ORIGINAL
   * payment (entityType='payment', entityId=originalPaymentId) so auditors
   * can trace refund chains without scanning the whole ledger. The refund
   * payment itself also receives a `payment_created` audit entry carrying
   * the `originalPaymentId` link in its `after` payload.
   */
  | 'payment_refunded'
  /**
   * Story S3 / RR-4 — dashboard StatCard computation fell back to a safe
   * default value (currently `0`) because the source data shape was
   * unexpected and the computation threw. Indicates a data-quality issue
   * that should be investigated; the dashboard still rendered.
   */
  | 'dashboard_render_fallback'
  /**
   * Story F-HIGH-28 (Sprint 7.2) — Case bill totals were recomputed from the
   * source-of-truth service list + payment history (no incremental drift).
   * The `after` payload carries the trigger (service_added | service_removed
   * | service_updated | payment_confirmed | payment_rejected | refund_created
   * | manual_recompute) and the resulting snapshot (amountPaid,
   * refundedAmount, remainingAmount, paymentStatus, totalBillAfterDiscount,
   * billHash). Auditors use this to trace every bill-state change back to a
   * single source-of-truth recompute.
   */
  | 'bill_recomputed'
  /**
   * Story F-CRIT-08 (Sprint 7.2) — A payment confirmation transaction was
   * COMMITTED successfully. The transaction wraps three writes in a single
   * atomic batch: (1) payment.status → 'confirmed' with confirmedBy/confirmedAt,
   * (2) case.amountPaid/remainingAmount/paymentStatus recomputed from the
   * full payment history, and (3) a `payment_transaction_committed` audit log
   * entry. All three writes succeed or all three are rolled back. The
   * `before` payload carries the pre-transaction payment + case snapshot;
   * `after` carries the post-transaction payment + case snapshot. The
   * `caseId` is also included in `after` for fast filtering.
   *
   * Written by: `confirmPaymentTransaction` in `@/lib/payments/transaction.ts`
   * (gated by `NEXT_PUBLIC_FEATURE_PAYMENT_TX`).
   */
  | 'payment_transaction_committed'
  /**
   * Story F-CRIT-08 (Sprint 7.2) — A payment confirmation transaction was
   * ABORTED. The transaction failed at one of its three writes (e.g. case
   * recompute failure, audit log write failure) and the entire transaction
   * was rolled back so no partial state was persisted. The payment remains
   * in `pending`; the case amounts were not mutated. The `before` payload
   * carries the payment record that was about to be confirmed; `after`
   * carries `{ aborted: true, reason: <error message>, stage: <payment|case|audit> }`.
   * Auditors use this entry to detect confirmation failures that did not
   * result in a successful `payment_transaction_committed` entry for the
   * same payment within the same window.
   *
   * Written by: `confirmPaymentTransaction` in `@/lib/payments/transaction.ts`
   * (gated by `NEXT_PUBLIC_FEATURE_PAYMENT_TX`).
   */
  | 'payment_transaction_aborted';

export type AuditEntityType =
  | 'customer'
  | 'case'
  | 'payment'
  | 'attachment'
  | 'consent'
  | 'task'
  | 'followup'
  | 'user'
  /**
   * Story S3 / RR-4 — dashboard surface (e.g. `/dashboard`). Used only by
   * `dashboard_render_fallback` events so the silent-fallback path can be
   * traced via the existing `/audit-logs` UI.
   */
  | 'dashboard';

export interface AuditLog {
  id: string;

  actorId: string;
  actorName: string;
  actorRole: UserRole;

  action: AuditAction;

  entityType: AuditEntityType;
  entityId: string;

  before?: Record<string, unknown>;
  after?: Record<string, unknown>;

  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateAuditLogInput {
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

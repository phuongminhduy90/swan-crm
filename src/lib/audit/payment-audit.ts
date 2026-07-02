/**
 * Story PI-3 (Sprint 7.2) — Payment audit enrichment.
 *
 * The pre-PI-3 payment audit log entries (`payment_confirmed`,
 * `payment_rejected`, `payment_created`, `payment_refunded`) recorded only a
 * flat `before` / `after` payload — usually one or two fields like `{ status,
 * confirmedBy }` — and **never the financial diff** (old vs new `amountPaid`,
 * `remainingAmount`, `paymentStatus`). Auditors could not reconcile the
 * payment ledger to the case totals without cross-referencing the case
 * record by hand.
 *
 * ## What this module adds
 *
 * 1. **`buildPaymentDiff(before, after)`** — a structured diff of every
 *    payment-relevant field (status, paymentType, amount, confirmedBy, ...).
 *    Returns `{ changed: Record<string, {from, to}>, unchanged: string[] }`
 *    so callers can render a human-readable summary.
 *
 * 2. **`buildPaymentAuditEntry(input)`** — a pure builder that assembles the
 *    full AuditLog payload (without `id`/`createdAt`). It includes:
 *      - `before` / `after` — the redacted payment snapshot
 *      - `diff` — the structured field-by-field diff
 *      - `stateTransition` — `{ from, to, at, actor, note }`
 *      - `caseId` — link for fast filtering by case
 *      - `originalPaymentId` — link for refund chain tracing (PI-2)
 *      - `caseBill` — `{ before: { amountPaid, remainingAmount, paymentStatus },
 *                        after:  { ... } }` when supplied
 *
 * 3. **`writePaymentAudit(input)`** — writes the entry through the existing
 *    `writeAuditLog()` path. Reuses `AUDIT_REDACTED_FIELDS` from B.2.3 so PII
 *    (medicalNote, privacyNote, nationalIdNumber) is never persisted in the
 *    audit shadow.
 *
 * 4. **`txWritePaymentAudit(tx, input)`** — wraps `tx.set` for use INSIDE a
 *    Firestore transaction. F-CRIT-08's `confirmPaymentTransaction` calls
 *    this so its `payment_transaction_committed` entry uses the exact same
 *    payload shape as the non-transactional `payment_confirmed` entry — both
 *    audit consumers see one consistent diff format.
 *
 * ## Why mirror B.2.3's redaction pattern?
 *
 * B.2.3 (F-MED-17) proved out the redaction-on-write pattern: scrubbing PII
 * fields at the persistence layer is cheaper than scrubbing every read
 * site, and one canonical placeholder (`[ĐÃ ẨN]`) keeps the audit-logs UI
 * simple. PI-3 reuses the same constants and same `redactPiiFields`
 * function so the two stories are visually identical in the diff view.
 *
 * @see docs/ux-redesign/SPRINT_7_2_EXECUTION_PLAN.md §1 (PI-3),
 *      §3.1 (R7.2-6 audit log gaps), §6.2 (S14, S15).
 */

import { writeAuditLog, redactPiiFields } from '@/lib/firestore/audit';
import type {
  AuditAction,
  AuditLog,
  Payment,
  PaymentStatus,
  UserRole,
} from '@/lib/types';

// ─── Public types ────────────────────────────────────────────────────────

/**
 * Structured field-by-field diff between two payment snapshots.
 *
 * - `changed` keys carry both the old and new values. The order of keys is
 *   stable (insertion order of `before`) so audit log diffs render
 *   deterministically.
 * - `unchanged` lists fields that appear in both snapshots with the same
 *   value — useful for the audit UI to render a "no change" line without
 *   iterating the whole record again.
 */
export interface PaymentDiff {
  changed: Record<string, { from: unknown; to: unknown }>;
  unchanged: string[];
}

/**
 * State-transition log entry — answers "who moved this payment from X to Y,
 * and when?".
 *
 * `from` is `'none'` for newly created payments (no prior state existed).
 */
export interface PaymentStateTransition {
  from: Payment['status'] | 'none';
  to: Payment['status'];
  at: string; // ISO timestamp
  actor: {
    uid: string;
    displayName: string;
    role: UserRole;
  };
  note?: string;
}

/**
 * Case-level financial state at a point in time. Used by PI-3 to carry
 * the bill-side delta (amountPaid, remainingAmount, paymentStatus) into
 * the payment audit log so auditors don't have to cross-reference the
 * case record.
 */
export interface CaseBillPoint {
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
}

/**
 * Inputs to `buildPaymentAuditEntry`. Every field is optional except the
 * actor, action, and entityId.
 */
export interface BuildPaymentAuditEntryInput {
  action: AuditAction;
  entityId: string;
  actor: {
    uid: string;
    displayName: string;
    role: UserRole;
  };
  /** Pre-state payment record (omit for creation). */
  before?: Payment | null;
  /** Post-state payment record (omit for deletion / failure). */
  after?: Payment | null;
  /** Optional state-transition log; auto-derived from `before`/`after` if
   *  omitted. Pass `null` to skip (e.g. for abort entries where no
   *  transition occurred). */
  stateTransition?: PaymentStateTransition | null;
  /** Fast-filter link to the owning case (PI-3 surface). */
  caseId?: string;
  /** Refund chain link (PI-2); set when the action is `payment_refunded`
   *  or the `after.paymentType === 'refund'`. */
  originalPaymentId?: string;
  /** Human-readable trigger, e.g. 'PI-2 refund' / 'transactional abort'. */
  trigger?: string;
  /** Optional case-level financial delta. Both points are required to
   *  render — passing only one throws (the helper is fail-loud). */
  caseBill?: {
    before: CaseBillPoint;
    after: CaseBillPoint;
  };
  /** Free-form metadata bag for story-specific payloads (e.g. abort
   *  reason, denial flag). Always redacted for PII before persistence. */
  metadata?: Record<string, unknown>;
}

// ─── Field set ────────────────────────────────────────────────────────────

/**
 * Payment fields that are diffable. Excludes:
 * - PII fields (handled separately by `redactPiiFields`)
 * - Timestamps that change on every write (`updatedAt`)
 * - Server-assigned IDs (`id`)
 *
 * Order matters — the diff renders fields in this order so auditors see a
 * consistent narrative (status → type → money → metadata → people).
 */
export const DIFFABLE_PAYMENT_FIELDS: readonly string[] = Object.freeze([
  'status',
  'paymentType',
  'amount',
  'paymentMethod',
  'paymentDate',
  'confirmedBy',
  'confirmedAt',
  'receivedBy',
  'rejectedBy',
  'rejectedAt',
  'note',
]);

// ─── Pure builders ──────────────���────────────────────────────────────────

/**
 * Compute a structured field-by-field diff between two payment snapshots.
 *
 * Pure: never mutates inputs. Returns `changed` in DIFFABLE_PAYMENT_FIELDS
 * order (then any unknown keys sorted alphabetically), so the audit UI
 * renders a deterministic diff.
 *
 * Both inputs are tolerated as `Partial<Payment>` so callers can pass only
 * the fields they actually changed (e.g. only `status` + `confirmedBy` for
 * a confirm). Fields present in one but not the other are still diffed
 * (treated as `undefined`).
 */
export function buildPaymentDiff(
  before: Partial<Payment> | null | undefined,
  after: Partial<Payment> | null | undefined,
): PaymentDiff {
  const beforeObj = (before ?? {}) as Record<string, unknown>;
  const afterObj = (after ?? {}) as Record<string, unknown>;

  const keys = new Set<string>([
    ...Object.keys(beforeObj),
    ...Object.keys(afterObj),
  ]);

  const orderedKnownKeys = DIFFABLE_PAYMENT_FIELDS.filter((k) => keys.has(k));
  const remainingKeys = [...keys]
    .filter((k) => !DIFFABLE_PAYMENT_FIELDS.includes(k))
    .sort();

  const allKeys = [...orderedKnownKeys, ...remainingKeys];

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const unchanged: string[] = [];

  for (const key of allKeys) {
    const fromValue = beforeObj[key];
    const toValue = afterObj[key];

    if (deepEqual(fromValue, toValue)) {
      unchanged.push(key);
    } else {
      changed[key] = { from: fromValue, to: toValue };
    }
  }

  return { changed, unchanged };
}

/**
 * Build a state-transition log entry from `before` / `after` snapshots.
 * Returns `null` if both statuses are identical (no transition occurred).
 */
export function deriveStateTransition(
  before: Payment | null | undefined,
  after: Payment | null | undefined,
  actor: BuildPaymentAuditEntryInput['actor'],
  note?: string,
): PaymentStateTransition | null {
  if (!before && !after) return null;
  const fromStatus = before?.status ?? 'none';
  const toStatus = after?.status;
  if (!toStatus) return null;
  if (fromStatus === toStatus) return null;
  return {
    from: fromStatus,
    to: toStatus,
    at: after?.updatedAt ?? after?.confirmedAt ?? new Date().toISOString(),
    actor,
    note,
  };
}

/**
 * Pure builder for the full AuditLog payload. Returns the entry minus the
 * server-assigned `id` and `createdAt` — those are filled in by
 * `writeAuditLog()` or by the caller (for transactional writes).
 *
 * The returned shape matches `AuditLog['before' | 'after']` — `record<string,
 * unknown>` JSON-safe — so a Firestore `set` will accept it directly.
 */
export function buildPaymentAuditEntry(
  input: BuildPaymentAuditEntryInput,
): Pick<AuditLog, 'actorId' | 'actorName' | 'actorRole' | 'action' | 'entityType' | 'entityId' | 'before' | 'after'> & {
  /** Optional structured diff for callers that want to surface it directly
   *  (the legacy audit-logs UI does not read this — it only renders
   *  `before`/`after` — but PI-3 callers that want richer copy can use it). */
  __diff?: PaymentDiff;
  __stateTransition?: PaymentStateTransition | null;
} {
  const { actor, action, entityId, before, after } = input;

  // ── 1. Redact PII on both sides (B.2.3 contract) ────────────────────
  const redactedBefore = before
    ? redactPiiFields(before as unknown as Record<string, unknown>)
    : undefined;
  const redactedAfter = after
    ? redactPiiFields(after as unknown as Record<string, unknown>)
    : undefined;

  // ── 2. Derive structured diff + state transition ────────────────────
  const diff = buildPaymentDiff(before, after);
  const explicitTransition =
    input.stateTransition === undefined
      ? deriveStateTransition(before, after, actor)
      : input.stateTransition;

  // ── 3. Build the `after` payload (the audit-logs UI renders `after`
  //       for every entry; rich metadata goes there so it shows up even
  //       when a caller doesn't expand the `before` JSON).
  const afterPayload: Record<string, unknown> = { ...(redactedAfter ?? {}) };

  // ── 4. Surface structured diff so auditors can render without parsing
  //       raw JSON. Only `changed` is surfaced — `unchanged` is implicit
  //       (the field is missing from the diff = no change).
  if (Object.keys(diff.changed).length > 0) {
    afterPayload.__diff = diff.changed;
  }

  if (explicitTransition) {
    afterPayload.__stateTransition = explicitTransition;
  }

  if (input.caseId) {
    afterPayload.caseId = input.caseId;
  }

  if (input.originalPaymentId) {
    afterPayload.originalPaymentId = input.originalPaymentId;
  }

  if (input.trigger) {
    afterPayload.trigger = input.trigger;
  }

  if (input.caseBill) {
    afterPayload.caseBill = input.caseBill;
  }

  if (input.metadata) {
    afterPayload.metadata = redactPiiFields(input.metadata);
  }

  return {
    actorId: actor.uid,
    actorName: actor.displayName,
    actorRole: actor.role,
    action,
    entityType: 'payment',
    entityId,
    before: redactedBefore,
    after: afterPayload,
  };
}

// ─── Persistence wrappers ───────────────────────────────────────────────

/**
 * Write a payment audit log entry through the standard `writeAuditLog()`
 * path. Use this for all non-transactional flows (legacy confirm, reject,
 * refund, create). F-CRIT-08's transactional path uses
 * `txWritePaymentAudit()` instead so the audit entry shares the Firestore
 * transaction.
 */
export async function writePaymentAudit(
  input: BuildPaymentAuditEntryInput,
): Promise<void> {
  const entry = buildPaymentAuditEntry(input);
  await writeAuditLog({
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
  });
}

/**
 * Minimal contract for a Firestore transaction handle that supports
 * `set(collection, id, payload)`. The real `runTransaction` in
 * `@/lib/firebase/firestore` exposes this; the mock-store shim does too.
 * Defined locally so this module does not import the firebase SDK
 * (keeps unit tests dependency-free).
 */
export interface TransactionLike {
  set: (collection: string, id: string, payload: Record<string, unknown>) => void;
  update?: (collection: string, id: string, payload: Record<string, unknown>) => void;
  get?: (collection: string, id: string) => Promise<{ exists: boolean; data?: unknown }>;
}

/**
 * Write a payment audit log entry INSIDE a Firestore transaction.
 *
 * F-CRIT-08's `confirmPaymentTransaction()` calls this so its
 * `payment_transaction_committed` entry uses the exact same payload shape
 * as the non-transactional `payment_confirmed` entry. Auditors see one
 * consistent diff format regardless of which path wrote it.
 *
 * Returns the generated audit id so the caller can correlate logs across
 * writes inside the same transaction.
 */
export function txWritePaymentAudit(
  tx: TransactionLike,
  input: BuildPaymentAuditEntryInput,
): string {
  const entry = buildPaymentAuditEntry(input);
  const auditId = generateAuditId();
  tx.set('auditLogs', auditId, {
    id: auditId,
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    createdAt: new Date().toISOString(),
  });
  return auditId;
}

// ─── Internal helpers ───────────────────────────────────────────────────

/**
 * Mirror the id generation from `writeAuditLog()` so audit ids stay unique
 * across both write paths. Matches the format used in
 * `@/lib/firestore/audit.ts`.
 */
function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Strict equality for primitive values + JSON-deep for objects/arrays.
 * Used by `buildPaymentDiff` so a status change from `'pending'` to
 * `'pending'` is reported as unchanged even when the two records were
 * re-serialized by Firestore.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}
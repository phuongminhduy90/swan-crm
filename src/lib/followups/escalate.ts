/**
 * Story B.1.5 (F-HIGH-20) — Auto-escalate followups when a patient reports
 * elevated pain (>= 4) or status "issue_reported" on a post-op followup.
 *
 * The escalation must notify the assigned doctor + nurse (resolved from the
 * case's staff assignment), with a fallback to all users with the
 * `doctor` or `nurse` role when no assignment exists. A 6h debounce window
 * prevents notification storms; a double-escalation guard prevents
 * duplicate notifications when the case is already in `medical_alert`.
 *
 * The logic is split into two pieces so each can be unit-tested in
 * isolation:
 *
 *   - `evaluateEscalation()` — pure function that decides whether an
 *     escalation is required given the (before, after) followup + the case
 *     status + the lastEscalatedAt timestamp. Returns a discriminated
 *     `EscalationDecision` so callers always handle every branch.
 *
 *   - `resolveEscalationRecipients()` — pure function that resolves the
 *     notification recipients from the case's staff assignment with a
 *     role-based fallback. Returns de-duplicated user IDs + baseline
 *     roles.
 *
 * The HTTP route handler (`/api/followups/[id]`) is the orchestrator that
 * reads the current case + followup, calls `evaluateEscalation`, then
 * calls the fire-and-forget trigger function in `@/lib/notifications/trigger`.
 *
 * Per anti-pattern gate A11 — the audit log entry must NEVER include
 * `medicalNote`, `privacyNote`, or `nationalIdNumber`. The `before` /
 * `after` snapshots passed to the orchestrator are scrubbed by
 * `redactPiiFields` inside `writeAuditLog` (Story B.2.3), so the route
 * passes raw values without any PII handling at this layer.
 *
 * @see docs/ux-redesign/SPRINT_6_2_EXECUTION_PLAN.md §1 (B.1.5 row)
 */

import type {
  CaseRecord,
  CaseStatus,
  Followup,
  StaffAssignment,
  User,
  UserRole,
} from '@/lib/types';

// ── Constants ────────────────────────────────────────────────────────────

/**
 * Pain level threshold at which a followup is escalated. Per the BACKLOG
 * (B.1.5 AC) and Sprint 6.2 §2.4 locked decisions, 4+ on the 0-10 scale
 * is "moderate-to-severe" → needs clinician review.
 */
export const ESCALATION_PAIN_THRESHOLD = 4;

/**
 * Debounce window in milliseconds. 6 hours = 6 * 60 * 60 * 1000.
 * A noisy case (e.g. patient keeps updating pain level) cannot re-trigger
 * the same escalation within this window. Documented as the recommended
 * default per Sprint 6.2 §7.2.4 + Appendix A Q4.
 */
export const ESCALATION_DEBOUNCE_MS = 6 * 60 * 60 * 1000;

// ── Decision type ────────────────────────────────────────────────────────

export type EscalationDecision =
  | { escalated: false; reason: 'no_change' }
  | { escalated: false; reason: 'below_threshold' }
  | { escalated: false; reason: 'already_medical_alert' }
  | { escalated: false; reason: 'within_debounce'; lastEscalatedAt: string; nextEligibleAt: string }
  | { escalated: true; reason: 'pain_above_threshold'; painLevel: number; nowIso: string }
  | { escalated: true; reason: 'issue_reported'; nowIso: string };

/**
 * Inputs to `evaluateEscalation`. `prev` is required so we can detect
 * "transition into escalation condition" instead of every save firing
 * (e.g. patient reports pain=5, then status moves contact → completed).
 */
export interface EvaluateEscalationInput {
  prev: Pick<Followup, 'status' | 'painLevel'>;
  next: Pick<Followup, 'status' | 'painLevel'>;
  caseStatus: CaseStatus;
  lastEscalatedAt?: string;
  now?: Date; // injectable for deterministic tests
}

// ── Decision (pure) ──────────────────────────────────────────────────────

/**
 * Decide whether a followup update should trigger an escalation.
 *
 * Rules (Sprint 6.2 §2.4 + §7.2):
 *   1. `painLevel >= 4` AND painLevel moved into the threshold (or was
 *      already there) AND case is not in `medical_alert` AND outside the
 *      6h debounce window → escalate.
 *   2. `status === 'issue_reported'` AND case is not in `medical_alert`
 *      AND outside the debounce window → escalate.
 *   3. Otherwise → no escalation. The discriminated `reason` makes every
 *      negative branch explicit so the audit log can record why no
 *      notification fired.
 */
export function evaluateEscalation(input: EvaluateEscalationInput): EscalationDecision {
  const { prev, next, caseStatus, lastEscalatedAt } = input;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  // Already-escalated guard: if the case is already in `medical_alert`,
  // do not double-notify. This is the primary alert-fatigue mitigation.
  if (caseStatus === 'medical_alert') {
    return { escalated: false, reason: 'already_medical_alert' };
  }

  // Debounce window: 1 escalation per case per 6h.
  if (lastEscalatedAt) {
    const last = Date.parse(lastEscalatedAt);
    if (!Number.isNaN(last)) {
      const elapsed = now.getTime() - last;
      if (elapsed >= 0 && elapsed < ESCALATION_DEBOUNCE_MS) {
        return {
          escalated: false,
          reason: 'within_debounce',
          lastEscalatedAt,
          nextEligibleAt: new Date(last + ESCALATION_DEBOUNCE_MS).toISOString(),
        };
      }
    }
  }

  // Trigger 2: status transitioned INTO issue_reported.
  // We require a transition (prev status !== 'issue_reported') so a
  // repeated save of the same condition does not fire multiple times.
  // Re-entry into issue_reported after a clinical resolution is the
  // natural escalation event we want to capture.
  if (next.status === 'issue_reported' && prev.status !== 'issue_reported') {
    return { escalated: true, reason: 'issue_reported', nowIso };
  }

  // Trigger 1: painLevel >= threshold.
  // We treat "went from below → at-or-above threshold" as the escalation
  // trigger. A patient whose pain has been 5 across two saves does NOT
  // re-escalate (the 6h debounce + already_medical_alert guard covers it),
  // but the initial crossing of the threshold is what we log + notify.
  if (
    typeof next.painLevel === 'number' &&
    next.painLevel >= ESCALATION_PAIN_THRESHOLD
  ) {
    const wasAbove =
      typeof prev.painLevel === 'number' && prev.painLevel >= ESCALATION_PAIN_THRESHOLD;
    if (!wasAbove) {
      return {
        escalated: true,
        reason: 'pain_above_threshold',
        painLevel: next.painLevel,
        nowIso,
      };
    }
  }

  return { escalated: false, reason: 'below_threshold' };
}

// ── Recipient resolution (pure) ──────────────────────────────────────────

export interface EscalationRecipients {
  /** Specific user IDs resolved from the case's staff assignment (may be empty). */
  recipientUserIds: string[];
  /** Baseline roles preserved as a safety net so the notification still fires. */
  recipientRoles: UserRole[];
  /** Display names of the resolved doctor + nurse(s) for the notification body. */
  doctorNames: string[];
  nurseNames: string[];
  /** True when fallback fired (no doctor/nurse was in the staff assignment). */
  fallbackUsed: boolean;
}

/**
 * Resolve the recipient set for an escalation notification.
 *
 * Order:
 *   1. Use `case.staffAssignment`: `doctorId` + `nurseIds[]` → user IDs.
 *   2. Resolve display names from the user directory.
 *   3. If BOTH the doctor ID and nurse IDs are empty (no clinical staff
 *      assigned to the case), fall back to all users with role
 *      `doctor` / `nurse` from `users`.
 *   4. Always include baseline roles `cso` + `admin` so the notification
 *      is never lost even if staff resolution returns nothing.
 */
export function resolveEscalationRecipients(input: {
  caseId: string;
  assignment: StaffAssignment | null;
  users: User[];
}): EscalationRecipients {
  const { assignment, users } = input;
  const recipientUserIds: string[] = [];
  const doctorNames: string[] = [];
  const nurseNames: string[] = [];

  let fallbackUsed = false;
  const byId = new Map(users.map((u) => [u.id, u] as const));

  const addId = (id?: string) => {
    if (!id) return;
    if (!recipientUserIds.includes(id)) recipientUserIds.push(id);
  };

  if (assignment) {
    if (assignment.doctorId) {
      addId(assignment.doctorId);
      const name = byId.get(assignment.doctorId)?.displayName?.trim();
      if (name) doctorNames.push(name);
    }
    if (Array.isArray(assignment.nurseIds)) {
      for (const nid of assignment.nurseIds) {
        if (!nid) continue;
        addId(nid);
        const name = byId.get(nid)?.displayName?.trim();
        if (name) nurseNames.push(name);
      }
    }
  }

  if (recipientUserIds.length === 0) {
    // Fallback: every active doctor + nurse in the directory.
    const clinical = users.filter(
      (u) => u.isActive && (u.role === 'doctor' || u.role === 'nurse'),
    );
    for (const u of clinical) {
      addId(u.id);
      if (u.role === 'doctor') doctorNames.push(u.displayName);
      else nurseNames.push(u.displayName);
    }
    if (clinical.length > 0) fallbackUsed = true;
  }

  return {
    recipientUserIds,
    recipientRoles: ['cso', 'admin'],
    doctorNames,
    nurseNames,
    fallbackUsed,
  };
}

// ── Convenience ──────────────────────────────────────────────────────────

/**
 * Convenience wrapper around `resolveEscalationRecipients` for code paths
 * that already have a `CaseRecord` rather than a `StaffAssignment`.
 */
export function resolveEscalationRecipientsForCase(input: {
  caseRecord: CaseRecord;
  assignment: StaffAssignment | null;
  users: User[];
}): EscalationRecipients {
  return resolveEscalationRecipients({
    caseId: input.caseRecord.id,
    assignment: input.assignment,
    users: input.users,
  });
}

// ── Audit payload helper ─────────────────────────────────────────────────

/**
 * Build the audit-log `before` / `after` snapshot for an escalation
 * event. Only includes escalation-relevant fields (status, painLevel) +
 * the case status + lastEscalatedAt. PII fields (medicalNote etc.) are
 * intentionally excluded; `writeAuditLog` (Story B.2.3) will also redact
 * them defensively if any slip through.
 */
export function buildEscalationAuditSnapshot(input: {
  prev: Pick<Followup, 'status' | 'painLevel'>;
  next: Pick<Followup, 'status' | 'painLevel'>;
  caseStatus: CaseStatus;
  decision: EscalationDecision;
  resolvedDoctorNames: string[];
  resolvedNurseNames: string[];
}): { before: Record<string, unknown>; after: Record<string, unknown> } {
  return {
    before: {
      status: input.prev.status,
      painLevel: input.prev.painLevel ?? null,
      caseStatus: input.caseStatus,
    },
    after: {
      status: input.next.status,
      painLevel: input.next.painLevel ?? null,
      caseStatus: input.caseStatus,
      decision: input.decision,
      doctorNames: input.resolvedDoctorNames,
      nurseNames: input.resolvedNurseNames,
    },
  };
}

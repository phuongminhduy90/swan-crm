/**
 * Story B.1.5 (F-HIGH-20) — Auto-escalate followups for painLevel >= 4
 * OR status === 'issue_reported'.
 *
 * These tests cover the pure decision + recipient-resolution helpers in
 * `src/lib/followups/escalate.ts`. The helpers are intentionally pure so
 * every branch of every rule can be exercised without spinning up
 * firestore / firebase / next.
 *
 * @see docs/ux-redesign/SPRINT_6_2_EXECUTION_PLAN.md §2.4, §7.2
 */

import { describe, it, expect } from 'vitest';

import {
  evaluateEscalation,
  resolveEscalationRecipients,
  resolveEscalationRecipientsForCase,
  buildEscalationAuditSnapshot,
  ESCALATION_PAIN_THRESHOLD,
  ESCALATION_DEBOUNCE_MS,
} from '@/lib/followups/escalate';
import type {
  CaseRecord,
  CaseStatus,
  Followup,
  FollowupStatus,
  StaffAssignment,
  SeverityLevel,
  User,
  UserRole,
} from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────

function isoOffset(minutes: number): string {
  // Subtract N minutes from a fixed "now" so test is deterministic.
  return new Date('2026-06-30T12:00:00.000Z').toISOString();
}

const NOW = new Date('2026-06-30T12:00:00.000Z');

function status(s: FollowupStatus): Pick<Followup, 'status' | 'painLevel'> {
  return { status: s };
}

function pain(s: FollowupStatus, p: SeverityLevel): Pick<Followup, 'status' | 'painLevel'> {
  return { status: s, painLevel: p };
}

function makeUser(id: string, role: UserRole, name: string): User {
  return {
    id,
    email: `${id}@swanclinic.vn`,
    displayName: name,
    role,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-001',
    caseCode: 'CASE-001',
    customerId: 'cust-001',
    caseDate: '2026-06-01T00:00:00.000Z',
    mainServiceGroup: 'nose',
    status: 'post_op_d3',
    priority: 'normal',
    totalBillBeforeDiscount: 25_000_000,
    totalBillAfterDiscount: 25_000_000,
    amountPaid: 25_000_000,
    remainingAmount: 0,
    paymentStatus: 'paid',
    privacyLevel: 'normal',
    createdBy: 'user-001',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  } as CaseRecord;
}

// ── Suite: evaluateEscalation ────────────────────────────────────────────

describe('escalate — evaluateEscalation (Story B.1.5 / F-HIGH-20)', () => {
  it('exports the documented threshold (4) and debounce (6h)', () => {
    expect(ESCALATION_PAIN_THRESHOLD).toBe(4);
    expect(ESCALATION_DEBOUNCE_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('does not escalate when nothing changed', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 3),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('below_threshold');
  });

  it('does not escalate when painLevel stays at 2 (below threshold)', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 2),
      next: pain('contacted', 2),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('below_threshold');
  });

  it('escalates when painLevel crosses from 3 → 4', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 4),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(true);
    if (d.escalated && d.reason === 'pain_above_threshold') {
      expect(d.painLevel).toBe(4);
      expect(d.nowIso).toBe(NOW.toISOString());
    } else {
      throw new Error(`expected pain_above_threshold, got ${JSON.stringify(d)}`);
    }
  });

  it('escalates when painLevel crosses from 2 → 5 (well above threshold)', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 2),
      next: pain('contacted', 5),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(true);
    if (d.escalated && d.reason === 'pain_above_threshold') {
      expect(d.painLevel).toBe(5);
    } else {
      throw new Error('expected pain_above_threshold');
    }
  });

  it('does NOT re-escalate when painLevel was already ≥ 4 before AND after', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 4),
      next: pain('contacted', 4),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    // No cross of threshold = no new escalation event.
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('below_threshold');
  });

  it('does NOT re-escalate when painLevel was 4 → 5 (already above threshold)', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 4),
      next: pain('contacted', 5),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('below_threshold');
  });

  it('escalates when status moves into issue_reported', () => {
    const d = evaluateEscalation({
      prev: status('contacted'),
      next: status('issue_reported'),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(true);
    expect(d.reason).toBe('issue_reported');
  });

  it('does NOT re-escalate when status is already issue_reported (no transition)', () => {
    const d = evaluateEscalation({
      prev: status('issue_reported'),
      next: status('issue_reported'),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('below_threshold');
  });

  it('returns already_medical_alert reason when case.status === "medical_alert"', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 5),
      caseStatus: 'medical_alert',
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('already_medical_alert');
  });

  it('returns within_debounce when lastEscalatedAt is < 6h ago', () => {
    const oneHourAgo = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 5),
      caseStatus: 'post_op_d3',
      lastEscalatedAt: oneHourAgo,
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    if (!d.escalated && d.reason === 'within_debounce') {
      expect(d.nextEligibleAt).toBe(
        new Date(Date.parse(oneHourAgo) + ESCALATION_DEBOUNCE_MS).toISOString(),
      );
    } else {
      throw new Error(`expected within_debounce, got ${JSON.stringify(d)}`);
    }
  });

  it('re-escalates after the 6h debounce window has passed', () => {
    const sevenHoursAgo = new Date(NOW.getTime() - 7 * 60 * 60 * 1000).toISOString();
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 5),
      caseStatus: 'post_op_d3',
      lastEscalatedAt: sevenHoursAgo,
      now: NOW,
    });
    expect(d.escalated).toBe(true);
    if (d.escalated && d.reason === 'pain_above_threshold') {
      expect(d.painLevel).toBe(5);
    } else {
      throw new Error('expected pain_above_threshold after debounce');
    }
  });

  it('treats malformed lastEscalatedAt as "never escalated" (defensive)', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 5),
      caseStatus: 'post_op_d3',
      lastEscalatedAt: 'not-a-date',
      now: NOW,
    });
    expect(d.escalated).toBe(true);
    expect(d.reason).toBe('pain_above_threshold');
  });

  it('treats undefined lastEscalatedAt as "never escalated"', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 5),
      caseStatus: 'post_op_d3',
      lastEscalatedAt: undefined,
      now: NOW,
    });
    expect(d.escalated).toBe(true);
    expect(d.reason).toBe('pain_above_threshold');
  });

  it('is debounce-aware (does not re-escalate within 5h59m)', () => {
    const almost6hAgo = new Date(NOW.getTime() - (6 * 60 * 60 * 1000 - 60_000)).toISOString();
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('contacted', 6),
      caseStatus: 'post_op_d3',
      lastEscalatedAt: almost6hAgo,
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('within_debounce');
  });

  it('issues_reported wins over painLevel when both trigger conditions are true', () => {
    const d = evaluateEscalation({
      prev: pain('contacted', 3),
      next: pain('issue_reported', 5),
      caseStatus: 'post_op_d3',
      now: NOW,
    });
    expect(d.escalated).toBe(true);
    expect(d.reason).toBe('issue_reported');
  });

  it('no_change reason: identical status + identical pain in non-escalating range', () => {
    const d = evaluateEscalation({
      prev: pain('pending', 0),
      next: pain('pending', 0),
      caseStatus: 'post_op_d1',
      now: NOW,
    });
    expect(d.escalated).toBe(false);
    expect(d.reason).toBe('below_threshold');
  });
});

// ── Suite: resolveEscalationRecipients ───────────────────────────────────

describe('escalate — resolveEscalationRecipients (Story B.1.5)', () => {
  it('uses doctorId + nurseIds from the staff assignment (resolved names)', () => {
    const assignment: StaffAssignment = {
      id: 'sa-001',
      caseId: 'case-001',
      doctorId: 'user-008',
      nurseIds: ['user-009', 'user-099'],
      assignedBy: 'user-001',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    const users: User[] = [
      makeUser('user-008', 'doctor', 'BS. Phạm Ngọc Anh'),
      makeUser('user-009', 'nurse', 'Nguyễn Thị Mai'),
      makeUser('user-099', 'nurse', 'Trần Thị Hoa'),
    ];
    const r = resolveEscalationRecipients({ caseId: 'case-001', assignment, users });
    expect(r.recipientUserIds.sort()).toEqual(['user-008', 'user-009', 'user-099']);
    expect(r.doctorNames).toEqual(['BS. Phạm Ngọc Anh']);
    expect(r.nurseNames.sort()).toEqual(['Nguyễn Thị Mai', 'Trần Thị Hoa']);
    expect(r.fallbackUsed).toBe(false);
    expect(r.recipientRoles).toContain('admin');
    expect(r.recipientRoles).toContain('cso');
  });

  it('deduplicates recipientUserIds across doctorId and nurseIds', () => {
    const assignment: StaffAssignment = {
      id: 'sa-001',
      caseId: 'case-001',
      doctorId: 'user-008',
      nurseIds: ['user-008'], // pathological duplicate
      assignedBy: 'user-001',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    const r = resolveEscalationRecipients({
      caseId: 'case-001',
      assignment,
      users: [makeUser('user-008', 'doctor', 'BS. Phạm Ngọc Anh')],
    });
    expect(r.recipientUserIds).toEqual(['user-008']);
  });

  it('falls back to all doctors + nurses in the directory when no assignment', () => {
    const users: User[] = [
      makeUser('user-008', 'doctor', 'BS. A'),
      makeUser('user-009', 'nurse', 'YT. B'),
      makeUser('user-001', 'admin', 'Admin'),
      makeUser('user-005', 'sales_online', 'Sales'),
    ];
    const r = resolveEscalationRecipients({
      caseId: 'case-001',
      assignment: null,
      users,
    });
    expect(r.fallbackUsed).toBe(true);
    expect(r.recipientUserIds.sort()).toEqual(['user-008', 'user-009']);
    expect(r.doctorNames).toEqual(['BS. A']);
    expect(r.nurseNames).toEqual(['YT. B']);
  });

  it('falls back when assignment exists but has no doctor/nurse IDs', () => {
    const assignment: StaffAssignment = {
      id: 'sa-001',
      caseId: 'case-001',
      masterSalesId: 'user-004',
      assignedBy: 'user-001',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    const users: User[] = [
      makeUser('user-008', 'doctor', 'BS. A'),
      makeUser('user-009', 'nurse', 'YT. B'),
    ];
    const r = resolveEscalationRecipients({ caseId: 'case-001', assignment, users });
    expect(r.fallbackUsed).toBe(true);
    expect(r.recipientUserIds.sort()).toEqual(['user-008', 'user-009']);
  });

  it('skips inactive doctor/nurse during fallback', () => {
    const users: User[] = [
      makeUser('user-008', 'doctor', 'BS. Active'),
      { ...makeUser('user-009', 'nurse', 'YT. Inactive'), isActive: false },
    ];
    const r = resolveEscalationRecipients({
      caseId: 'case-001',
      assignment: null,
      users,
    });
    expect(r.recipientUserIds).toEqual(['user-008']);
    expect(r.nurseNames).toEqual([]);
  });

  it('returns empty recipientUserIds + fallbackUsed=false when no clinical users anywhere', () => {
    const users: User[] = [
      makeUser('user-001', 'admin', 'Admin'),
      makeUser('user-004', 'master_sales', 'Sales'),
    ];
    const r = resolveEscalationRecipients({
      caseId: 'case-001',
      assignment: null,
      users,
    });
    expect(r.recipientUserIds).toEqual([]);
    expect(r.fallbackUsed).toBe(false);
    // Baseline roles preserved so the notification is still visible.
    expect(r.recipientRoles).toContain('admin');
    expect(r.recipientRoles).toContain('cso');
  });

  it('resolveEscalationRecipientsForCase is a thin wrapper', () => {
    const caseRecord = makeCase({ id: 'case-002' });
    const assignment: StaffAssignment = {
      id: 'sa-002',
      caseId: 'case-002',
      doctorId: 'user-008',
      assignedBy: 'user-001',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };
    const r = resolveEscalationRecipientsForCase({
      caseRecord,
      assignment,
      users: [makeUser('user-008', 'doctor', 'BS. A')],
    });
    expect(r.recipientUserIds).toEqual(['user-008']);
  });
});

// ── Suite: buildEscalationAuditSnapshot ──────────────────────────────────

describe('escalate — buildEscalationAuditSnapshot (Story B.1.5)', () => {
  it('contains prev/next status+painLevel + caseStatus + decision', () => {
    const decision: ReturnType<typeof evaluateEscalation> = {
      escalated: true,
      reason: 'pain_above_threshold',
      painLevel: 5,
      nowIso: NOW.toISOString(),
    };
    const snap = buildEscalationAuditSnapshot({
      prev: pain('contacted', 3),
      next: pain('contacted', 5),
      caseStatus: 'post_op_d3',
      decision,
      resolvedDoctorNames: ['BS. A'],
      resolvedNurseNames: ['YT. B'],
    });
    expect(snap.before).toMatchObject({
      status: 'contacted',
      painLevel: 3,
      caseStatus: 'post_op_d3',
    });
    expect(snap.after).toMatchObject({
      status: 'contacted',
      painLevel: 5,
      caseStatus: 'post_op_d3',
      doctorNames: ['BS. A'],
      nurseNames: ['YT. B'],
    });
    expect((snap.after as Record<string, unknown>).decision).toEqual(decision);
  });

  it('omits PII fields (medicalNote / privacyNote / nationalIdNumber) — A11 contract', () => {
    const decision: ReturnType<typeof evaluateEscalation> = {
      escalated: true,
      reason: 'issue_reported',
      nowIso: NOW.toISOString(),
    };
    const snap = buildEscalationAuditSnapshot({
      prev: status('contacted'),
      next: status('issue_reported'),
      caseStatus: 'post_op_d3',
      decision,
      resolvedDoctorNames: [],
      resolvedNurseNames: [],
    });
    const flat = JSON.stringify(snap);
    expect(flat).not.toMatch(/medicalNote/);
    expect(flat).not.toMatch(/privacyNote/);
    expect(flat).not.toMatch(/nationalIdNumber/);
  });
});

// Surface the types so downstream imports are explicit and tree-shake-proof.
type _AssertCaseSurface = CaseStatus;
type _AssertSeverity = SeverityLevel;
const _iso = isoOffset(0); // keep helper referenced
void _iso;

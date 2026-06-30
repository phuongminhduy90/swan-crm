/**
 * Story B.2.1 (F-CRIT-03 / F-CRIT-10) — Unit tests for the pre-procedure
 * clinical checklist evaluator.
 *
 * Covers:
 *   1. allPassed derivation (including 6 new clinical items + legacy 6)
 *   2. N/A short-circuit (`'not_applicable'` value passes)
 *   3. treatment_consent_signed derived from Consent entity (incl. revoked)
 *   4. Historical-case fail-closed behaviour
 *   5. Pure-function determinism
 *   6. GATED_TRANSITIONS set membership
 *
 * @see docs/ux-redesign/STORY_B2_1_EXECUTION_PLAN.md §7.2.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockGetCase = vi.fn();
const mockGetStaffAssignment = vi.fn();
const mockGetCoordinationByCase = vi.fn();
const mockGetConsentsByCase = vi.fn();

vi.mock('@/lib/firestore/cases', () => ({
  getCase: (...args: unknown[]) => mockGetCase(...args),
}));
vi.mock('@/lib/firestore/staff-assignments', () => ({
  getStaffAssignment: (...args: unknown[]) => mockGetStaffAssignment(...args),
}));
vi.mock('@/lib/firestore/treatment-locations', () => ({
  getCoordinationByCase: (...args: unknown[]) => mockGetCoordinationByCase(...args),
}));
vi.mock('@/lib/firestore/consents', () => ({
  getConsentsByCase: (...args: unknown[]) => mockGetConsentsByCase(...args),
}));

// Dynamic import AFTER mocks so the module picks up our test-controlled deps.
import {
  evaluateClinicalChecklist,
  isGatedTransition,
  isChecklistValuePassed,
  GATED_TRANSITIONS,
  CLINICAL_ITEM_KEYS,
} from '@/lib/checklist/evaluatePreProcedureChecklist';
import type {
  CaseRecord,
  StaffAssignment,
  HospitalCoordination,
  Consent,
} from '@/lib/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: 'case-001',
    caseCode: 'CASE-001',
    customerId: 'cust-001',
    caseDate: '2026-06-01T00:00:00.000Z',
    mainServiceGroup: 'nose',
    // Default status is `reminder_sent` — the source state of one of the
    // 3 gated transitions. The legacy `reminder_sent` checklist item
    // requires the status itself to be reminder_sent/checked_in/in_procedure,
    // so the default fixture must be in one of those statuses.
    status: 'reminder_sent',
    priority: 'normal',
    totalBillBeforeDiscount: 10_000_000,
    totalBillAfterDiscount: 10_000_000,
    amountPaid: 0,
    remainingAmount: 10_000_000,
    paymentStatus: 'unpaid',
    privacyLevel: 'normal',
    createdBy: 'user-003',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    // Default to all clinical items satisfied — individual tests override.
    bloodTestResult: true,
    allergyDeclared: true,
    pregnancyTestDone: true,
    anesthesiaReviewComplete: true,
    fastingCompliant: true,
    treatmentConsentSigned: true,
    ...overrides,
  } as CaseRecord;
}

function makeStaff(overrides: Partial<StaffAssignment> = {}): StaffAssignment {
  return {
    id: 'sa-001',
    caseId: 'case-001',
    doctorId: 'user-008',
    nurseIds: ['user-009'],
    cskhPostopId: 'user-011',
    ...overrides,
  } as StaffAssignment;
}

function makeConsent(overrides: Partial<Consent> = {}): Consent {
  return {
    id: 'con-001',
    customerId: 'cust-001',
    caseId: 'case-001',
    consentType: 'treatment',
    consentStatus: 'granted',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const ALL_CLINICAL_TRUE = {
  bloodTestResult: true,
  allergyDeclared: true,
  pregnancyTestDone: true,
  anesthesiaReviewComplete: true,
  fastingCompliant: true,
  treatmentConsentSigned: true,
} as const;

// ─── Suite ─────────────────────────────────────────────────────────────────

describe('Story B.2.1 — evaluateClinicalChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default happy path: case exists, staff assigned, consent granted.
    mockGetCase.mockResolvedValue(makeCase());
    mockGetStaffAssignment.mockResolvedValue(makeStaff());
    mockGetCoordinationByCase.mockResolvedValue(null);
    mockGetConsentsByCase.mockResolvedValue([makeConsent()]);
  });

  // ─── 1. allPassed derivation ──────────────────────────────────────────────

  it('allPassed === true when every required item (legacy + clinical) passes', async () => {
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(true);
    expect(result.failedKeys).toEqual([]);
  });

  it('allPassed === false when 1 clinical item is missing — failedKeys includes it', async () => {
    mockGetCase.mockResolvedValue(makeCase({ bloodTestResult: undefined }));
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(false);
    expect(result.failedKeys).toContain('blood_test_result');
  });

  it('returns 12 items total (6 legacy + 6 clinical)', async () => {
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.items).toHaveLength(12);
  });

  it('all 6 clinical item keys are present in the items list', async () => {
    const result = await evaluateClinicalChecklist('case-001');
    const keys = result.items.map((i) => i.key);
    for (const clinicalKey of CLINICAL_ITEM_KEYS) {
      expect(keys).toContain(clinicalKey);
    }
  });

  // ─── 2. N/A short-circuit ────────────────────────────────────────────────

  it('treats pregnancy_test_done = "not_applicable" as passed (male patient / non-reproductive procedure)', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, pregnancyTestDone: 'not_applicable' }),
    );
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(true);
    expect(result.failedKeys).not.toContain('pregnancy_test_done');
  });

  it('treats blood_test_result = "not_applicable" as passed (filler injection, no anesthesia)', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, bloodTestResult: 'not_applicable' }),
    );
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(true);
    expect(result.failedKeys).not.toContain('blood_test_result');
  });

  it('treats treatment_consent_signed = "not_applicable" as passed (no Consent entity fallback)', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, treatmentConsentSigned: 'not_applicable' }),
    );
    // No consents returned — without N/A the evaluator would fall back to
    // the consent collection and possibly fail. With N/A, it bypasses.
    mockGetConsentsByCase.mockResolvedValue([]);
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(true);
  });

  // ─── 3. Treatment consent derivation ─────────────────────────────────────

  it('treatment_consent_signed === true when Consent.status === "granted" and linked to case', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, treatmentConsentSigned: undefined }),
    );
    mockGetConsentsByCase.mockResolvedValue([
      makeConsent({ consentStatus: 'granted', caseId: 'case-001' }),
    ]);
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(true);
  });

  it('treatment_consent_signed === false when Consent.status === "revoked"', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, treatmentConsentSigned: undefined }),
    );
    mockGetConsentsByCase.mockResolvedValue([
      makeConsent({ consentStatus: 'revoked', caseId: 'case-001' }),
    ]);
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(false);
    expect(result.failedKeys).toContain('treatment_consent_signed');
  });

  it('treatment_consent_signed === false when Consent is pending (not granted)', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, treatmentConsentSigned: undefined }),
    );
    mockGetConsentsByCase.mockResolvedValue([
      makeConsent({ consentStatus: 'pending', caseId: 'case-001' }),
    ]);
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(false);
    expect(result.failedKeys).toContain('treatment_consent_signed');
  });

  it('ignores treatment consent attached to a DIFFERENT case', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, treatmentConsentSigned: undefined }),
    );
    mockGetConsentsByCase.mockResolvedValue([
      makeConsent({ consentStatus: 'granted', caseId: 'case-other' }),
    ]);
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(false);
    expect(result.failedKeys).toContain('treatment_consent_signed');
  });

  // ─── 4. Fail-closed for legacy / historical cases ────────────────────────

  it('historical case without new fields defaults to allPassed === false', async () => {
    // Legacy case — no clinical fields at all, no Consent entity either.
    // The evaluator must treat ALL 6 clinical items as missing (fail-closed).
    mockGetCase.mockResolvedValue(makeCase({
      bloodTestResult: undefined,
      allergyDeclared: undefined,
      pregnancyTestDone: undefined,
      anesthesiaReviewComplete: undefined,
      fastingCompliant: undefined,
      treatmentConsentSigned: undefined,
    }));
    mockGetConsentsByCase.mockResolvedValue([]); // no treatment consent
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(false);
    // All 6 clinical keys should appear in failedKeys
    for (const clinicalKey of CLINICAL_ITEM_KEYS) {
      expect(result.failedKeys).toContain(clinicalKey);
    }
  });

  it('returns allPassed === false when the case record does not exist', async () => {
    mockGetCase.mockResolvedValue(null);
    const result = await evaluateClinicalChecklist('case-001');
    expect(result.allPassed).toBe(false);
    expect(result.items).toEqual([]);
  });

  // ─── 5. Pure-function determinism ────────────────────────────────────────

  it('same input → same output (deterministic)', async () => {
    mockGetCase.mockResolvedValue(
      makeCase({ ...ALL_CLINICAL_TRUE, bloodTestResult: 'not_applicable' }),
    );
    const a = await evaluateClinicalChecklist('case-001');
    const b = await evaluateClinicalChecklist('case-001');
    expect(a.allPassed).toBe(b.allPassed);
    expect(a.items.map((i) => i.passed)).toEqual(b.items.map((i) => i.passed));
    expect(a.failedKeys).toEqual(b.failedKeys);
  });

  // ─── 6. isChecklistValuePassed helper ────────────────────────────────────

  describe('isChecklistValuePassed', () => {
    it('"not_applicable" → passed', () => {
      expect(isChecklistValuePassed('not_applicable')).toBe(true);
    });
    it('true → passed', () => {
      expect(isChecklistValuePassed(true)).toBe(true);
    });
    it('false → NOT passed', () => {
      expect(isChecklistValuePassed(false)).toBe(false);
    });
    it('undefined → NOT passed (fail-closed for legacy data)', () => {
      expect(isChecklistValuePassed(undefined)).toBe(false);
    });
  });

  // ─── 7. GATED_TRANSITIONS set ────────────────────────────────────────────

  describe('GATED_TRANSITIONS + isGatedTransition', () => {
    it('contains exactly the 3 statuses — checked_in, in_procedure, medically_approved', () => {
      expect(GATED_TRANSITIONS.size).toBe(3);
      expect(GATED_TRANSITIONS.has('checked_in')).toBe(true);
      expect(GATED_TRANSITIONS.has('in_procedure')).toBe(true);
      expect(GATED_TRANSITIONS.has('medically_approved')).toBe(true);
    });

    it('isGatedTransition returns true for the 3 gated statuses', () => {
      expect(isGatedTransition('checked_in')).toBe(true);
      expect(isGatedTransition('in_procedure')).toBe(true);
      expect(isGatedTransition('medically_approved')).toBe(true);
    });

    it('isGatedTransition returns false for non-gated statuses', () => {
      expect(isGatedTransition('procedure_completed')).toBe(false);
      expect(isGatedTransition('post_op_d1')).toBe(false);
      expect(isGatedTransition('completed')).toBe(false);
      expect(isGatedTransition('cancelled')).toBe(false);
      expect(isGatedTransition('postponed')).toBe(false);
      expect(isGatedTransition('medical_alert')).toBe(false);
      expect(isGatedTransition('scheduled')).toBe(false);
      expect(isGatedTransition('reminder_sent')).toBe(false);
    });
  });
});
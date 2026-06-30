import { getCase } from '@/lib/firestore/cases';
import { getStaffAssignment } from '@/lib/firestore/staff-assignments';
import { getCoordinationByCase } from '@/lib/firestore/treatment-locations';
import { getConsentsByCase } from '@/lib/firestore/consents';
import type { CaseStatus, ClinicalChecklistValue } from '@/lib/types';

/**
 * Story B.2.1 — Pre-procedure checklist evaluator.
 *
 * Mirrors the runtime signature of `evaluatePreProcedureChecklist` in
 * `src/lib/checklist/index.ts` (legacy 6-item evaluator) but adds the
 * 6 clinical items introduced by F-CRIT-03/F-CRIT-10.
 *
 * This file is the **single source of truth** for:
 *   - The 6 clinical item keys (must match the case-record fields and the
 *     UI labels — see `CLINICAL_ITEM_LABELS`).
 *   - The `allPassed` derivation (including N/A short-circuit).
 *   - The `GATED_TRANSITIONS` set (the 3 status targets whose source state
 *     requires physical patient presence and clinical clearance).
 *
 * Anti-pattern A12 (skipped clinical gates) is closed here: any new clinical
 * gate MUST be added to this file — not duplicated in components.
 */

export interface ClinicalChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  required: boolean;
}

export interface ClinicalChecklistResult {
  items: ClinicalChecklistItem[];
  allPassed: boolean;
  /** Convenience — keys that are required but currently NOT passed. */
  failedKeys: string[];
}

/**
 * The 6 clinical checklist items introduced by Story B.2.1.
 *
 * `key` MUST match the field name on `CaseRecord` (`bloodTestResult`, etc.)
 * because the evaluator reads the case record directly to determine pass/fail.
 *
 * `label` is the Vietnamese label rendered in `ChecklistPanel`.
 */
export const CLINICAL_ITEM_LABELS: Record<string, string> = {
  blood_test_result: 'Có kết quả xét nghiệm máu',
  allergy_declared: 'Đã khai báo dị ứng',
  pregnancy_test_done: 'Xét nghiệm thai (nếu áp dụng)',
  anesthesia_review_complete: 'Bác sĩ gây mê đã khám',
  fasting_compliant: 'Nhịn ăn/uống đúng quy định',
  treatment_consent_signed: 'Đã ký cam kết điều trị',
};

/**
 * Order matters for UI rendering — preserve this sequence so the panel
 * matches the medical director's sign-off doc.
 */
export const CLINICAL_ITEM_KEYS: readonly string[] = [
  'blood_test_result',
  'allergy_declared',
  'pregnancy_test_done',
  'anesthesia_review_complete',
  'fasting_compliant',
  'treatment_consent_signed',
] as const;

/**
 * The 3 status targets whose transition requires `allPassed === true`.
 *
 * - `checked_in` — patient physically at the clinic
 * - `in_procedure` — procedure has started, no turning back
 * - `medically_approved` — doctor's clinical sign-off
 *
 * NOTE: `procedure_completed` is intentionally NOT in this set — the
 * procedure already happened; gating it after-the-fact would be a no-op.
 * Post-op statuses (`post_op_*`, `completed`) are also not gated.
 *
 * Both UI (`StatusWorkflow`) and server (`PATCH /api/cases/[id]/status`)
 * must consult this set so they stay in sync.
 */
export const GATED_TRANSITIONS: ReadonlySet<CaseStatus> = new Set<CaseStatus>([
  'checked_in',
  'in_procedure',
  'medically_approved',
]);

/**
 * Helper — does this transition target require the clinical checklist to pass?
 */
export function isGatedTransition(target: CaseStatus): boolean {
  return GATED_TRANSITIONS.has(target);
}

/**
 * Pure helper — determines whether a single checklist value satisfies
 * a required gate.
 *
 *   - 'not_applicable' → passed (gate short-circuits)
 *   - `true` → passed
 *   - `false` or `undefined` → NOT passed (fail-closed)
 */
export function isChecklistValuePassed(value: ClinicalChecklistValue | undefined): boolean {
  if (value === 'not_applicable') return true;
  return value === true;
}

/**
 * Evaluate the pre-procedure checklist for a case.
 *
 * Loads: caseRecord, staffAssignment, coordination, consents.
 * Returns the union of legacy 6 items + new 6 clinical items.
 *
 * `allPassed === true` only if every required item passes (legacy 6 + new 6).
 *
 * NOTE on backward-compat (fail-closed):
 *   Historical cases predating the B.2.1 schema will have `undefined`
 *   values for the 6 new fields. The evaluator treats `undefined` as
 *   fail-closed — the gate engages until a coordinator explicitly marks
 *   the field. This is a deliberate choice: under-blocking is a patient
 *   safety event; over-blocking is operational cost.
 */
export async function evaluateClinicalChecklist(
  caseId: string,
): Promise<ClinicalChecklistResult> {
  const [caseRecord, staffAssignment, coordination, consents] = await Promise.all([
    getCase(caseId),
    getStaffAssignment(caseId),
    getCoordinationByCase(caseId),
    getConsentsByCase(caseId),
  ]);

  if (!caseRecord) {
    return { items: [], allPassed: false, failedKeys: [] };
  }

  const requiresHospital =
    caseRecord.treatmentLocationType !== undefined &&
    caseRecord.treatmentLocationType !== 'swan';

  // ─── Treatment consent derivation ──────────────────────────────────────
  // `treatment_consent_signed` is derived from the existing Consent entity.
  // The Consent must:
  //   1. Be tied to this case (`caseId === caseId`)
  //   2. Have type 'treatment'
  //   3. Have status 'granted'
  //   4. NOT have been revoked (revokedAt undefined — note: the current
  //      `Consent` shape doesn't have `revokedAt`, so we treat
  //      `consentStatus === 'revoked'` as the revocation signal)
  const treatmentConsent = consents.find(
    (c) => c.consentType === 'treatment' && c.caseId === caseId,
  );
  const treatmentConsentPassed =
    treatmentConsent?.consentStatus === 'granted';

  // ─── Legacy 6 items (unchanged from prior evaluator) ──────────────────
  const legacyItems: ClinicalChecklistItem[] = [
    {
      key: 'lab_done',
      label: 'Xét nghiệm đã hoàn tất',
      passed: ['lab_test_done', 'medically_approved', 'scheduled'].includes(
        caseRecord.status,
      ),
      required: Boolean(caseRecord.expectedLabDate),
    },
    {
      key: 'doctor_approved',
      label: 'Bác sĩ đã duyệt',
      passed:
        Boolean(staffAssignment?.doctorId) &&
        [
          'medically_approved',
          'scheduled',
          'reminder_sent',
          'checked_in',
          'in_procedure',
          'procedure_completed',
          'waiting_images_upload',
          'post_op_d1',
          'post_op_d3',
          'post_op_d7',
          'post_op_d14',
          'post_op_d30',
          'post_op_d90',
          'completed',
        ].includes(caseRecord.status),
      required: true,
    },
    {
      key: 'reminder_sent',
      label: 'Khách đã được nhắc lịch',
      passed: ['reminder_sent', 'checked_in', 'in_procedure'].includes(
        caseRecord.status,
      ),
      required: true,
    },
    {
      key: 'hospital_confirmed',
      label: 'Bệnh viện đã xác nhận (nếu ca liên kết)',
      passed: !requiresHospital || Boolean(coordination?.hospitalConfirmed),
      required: Boolean(requiresHospital),
    },
    {
      key: 'nurse_assigned',
      label: 'Điều dưỡng đã được phân công',
      passed: Boolean(
        staffAssignment?.nurseIds && staffAssignment.nurseIds.length > 0,
      ),
      required: true,
    },
    {
      key: 'cskh_assigned',
      label: 'CSKH hậu phẫu đã được phân công',
      passed: Boolean(staffAssignment?.cskhPostopId),
      required: true,
    },
  ];

  // ─── Story B.2.1 — 6 new clinical items ────────────────────────────────
  const clinicalItems: ClinicalChecklistItem[] = [
    {
      key: 'blood_test_result',
      label: CLINICAL_ITEM_LABELS.blood_test_result,
      passed: isChecklistValuePassed(caseRecord.bloodTestResult),
      required: true,
    },
    {
      key: 'allergy_declared',
      label: CLINICAL_ITEM_LABELS.allergy_declared,
      passed: isChecklistValuePassed(caseRecord.allergyDeclared),
      required: true,
    },
    {
      key: 'pregnancy_test_done',
      label: CLINICAL_ITEM_LABELS.pregnancy_test_done,
      passed: isChecklistValuePassed(caseRecord.pregnancyTestDone),
      required: true,
    },
    {
      key: 'anesthesia_review_complete',
      label: CLINICAL_ITEM_LABELS.anesthesia_review_complete,
      passed: isChecklistValuePassed(caseRecord.anesthesiaReviewComplete),
      required: true,
    },
    {
      key: 'fasting_compliant',
      label: CLINICAL_ITEM_LABELS.fasting_compliant,
      passed: isChecklistValuePassed(caseRecord.fastingCompliant),
      required: true,
    },
    {
      key: 'treatment_consent_signed',
      label: CLINICAL_ITEM_LABELS.treatment_consent_signed,
      // Derived from Consent entity (see derivation above), with N/A escape hatch.
      passed:
        caseRecord.treatmentConsentSigned === 'not_applicable'
          ? true
          : treatmentConsentPassed,
      required: true,
    },
  ];

  const items = [...legacyItems, ...clinicalItems];
  const requiredItems = items.filter((i) => i.required);
  const failedItems = requiredItems.filter((i) => !i.passed);
  const allPassed = failedItems.length === 0;

  return {
    items,
    allPassed,
    failedKeys: failedItems.map((i) => i.key),
  };
}
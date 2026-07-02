import { TreatmentLocationType } from './treatment-location';

/**
 * Story B.2.1 — Pre-procedure clinical checklist value type.
 *
 * Each clinical gate item can be:
 *   - `true`   — the item is satisfied
 *   - `false`  — the item is explicitly NOT satisfied (counts as missing)
 *   - `'not_applicable'` — the item is irrelevant for this case (e.g. pregnancy
 *     test for a male patient, blood test for a filler injection). The gate
 *     treats N/A as passed.
 *   - `undefined` — legacy/historical case predating the B.2.1 schema; the
 *     evaluator treats this as fail-closed (counts as missing) so the gate
 *     engages until a coordinator explicitly marks the item.
 */
export type ClinicalChecklistValue = boolean | 'not_applicable';

export type ServiceCategory =
  | 'nose'
  | 'breast'
  | 'body'
  | 'eyes'
  | 'skin'
  | 'injectable'
  | 'other';

export type CaseStatus =
  | 'draft'
  | 'waiting_customer_info'
  | 'waiting_payment_confirmation'
  | 'payment_confirmed'
  | 'waiting_location_assignment'
  | 'waiting_hospital_confirmation'
  | 'hospital_confirmed'
  | 'waiting_doctor_review'
  | 'waiting_lab_test'
  | 'lab_test_done'
  | 'medically_approved'
  | 'scheduled'
  | 'reminder_sent'
  | 'checked_in'
  | 'in_procedure'
  | 'procedure_completed'
  | 'waiting_images_upload'
  | 'post_op_d1'
  | 'post_op_d3'
  | 'post_op_d7'
  | 'post_op_d14'
  | 'post_op_d30'
  | 'post_op_d90'
  | 'completed'
  | 'postponed'
  | 'cancelled'
  | 'complaint'
  | 'medical_alert'
  | 'medical_alert_resolved';

export type PaymentStatus = 'unpaid' | 'deposit' | 'partial' | 'paid' | 'refunded';
export type CasePriority = 'normal' | 'high' | 'urgent';
export type DiscountType = 'none' | 'percent' | 'fixed' | 'gift';

export interface CaseRecord {
  id: string;
  caseCode: string;
  customerId: string;
  caseDate: string;

  mainServiceGroup: ServiceCategory;

  treatmentLocationId?: string;
  treatmentLocationType?: TreatmentLocationType;

  expectedLabDate?: string;

  /**
   * Story PI-4 (Sprint 7.2) — Forecasted procedure date. Used as the
   * backward-compat fallback only — see `actualProcedureDate` for the
   * source-of-truth convention.
   *
   * Stored as ISO-8601 string (e.g. `2026-07-15T00:00:00.000Z`). Vietnam
   * is UTC+7 (no DST), so the storage form is local-midnight rendered as
   * UTC midnight. The actual fix for any TZ drift is owned by Sprint 7.3
   * C.3.2 — this story only documents the convention.
   *
   * @see resolveProcedureDateForFollowups in `@/lib/firestore/followups`.
   */
  expectedProcedureDate?: string;

  /**
   * Story B.2.4 + Story PI-4 (Sprint 7.2) — Date the case ACTUALLY moved
   * to `procedure_completed`. **Source of truth** for D1/D3/D7/D14/D30/D90
   * follow-up due-date computation. Captured from a `<input type="date">`
   * in the status-workflow UI BEFORE the status flip; persisted to the
   * case record; then passed as the `procedureDate` argument to
   * `createPostOpFollowups`.
   *
   * Resolution priority when scheduling follow-ups:
   *   1. `actualProcedureDate`  ← preferred
   *   2. `expectedProcedureDate` ← backward-compat fallback
   *   3. `new Date()`           ← terminal fallback (prevents orphans)
   *
   * Storage convention: ISO-8601 string, UTC midnight. Same TZ disclaimer
   * as `expectedProcedureDate` above — Sprint 7.3 C.3.2 owns the canonical
   * form. PI-4 only documents the contract.
   *
   * @see resolveProcedureDateForFollowups in `@/lib/firestore/followups`.
   */
  actualProcedureDate?: string;

  status: CaseStatus;
  priority: CasePriority;

  totalBillBeforeDiscount: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountReason?: string;

  totalBillAfterDiscount: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;

  salesNote?: string;
  medicalNote?: string;
  internalNote?: string;

  privacyLevel: 'normal' | 'vip' | 'highly_sensitive';

  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;

  /** Soft-delete flag — false khi bị cascade-delete từ customer deletion */
  active?: boolean;

  /**
   * Story B.1.5 (F-HIGH-20) — Timestamp of the last auto-escalation
   * triggered by a followup painLevel >= 4 / issue_reported. Used for a
   * 6h debounce window so a noisy case does not flood doctor/nurse with
   * duplicate notifications. Optional for backward compatibility —
   * cases predating the story have no value and are treated as
   * "never escalated" (so the first escalation fires).
   */
  lastEscalatedAt?: string;

  // ─── Story B.2.1 (F-CRIT-03 + F-CRIT-10) — Clinical checklist gates ──────
  // Six optional fields that, together with the existing `Consent` entity,
  // drive the pre-procedure gate (`evaluatePreProcedureChecklist`). All
  // fields are optional for backward-compat — historical cases with
  // `undefined` values are treated as fail-closed (gate engages until the
  // coordinator marks them). 'not_applicable' short-circuits the gate to
  // `passed` for items where the medical context makes the requirement moot
  // (e.g. pregnancy test for male patients).

  /** Có kết quả xét nghiệm máu (CBC / đông máu / sinh hóa). */
  bloodTestResult?: ClinicalChecklistValue;

  /** Đã khai báo dị ứng (thuốc, vật liệu, thức ăn) — true khi đã xác nhận dù là âm tính. */
  allergyDeclared?: ClinicalChecklistValue;

  /** Xét nghiệm thai cho bệnh nhân nữ trong độ tuổi sinh sản. */
  pregnancyTestDone?: ClinicalChecklistValue;

  /** Bác sĩ gây mê đã khám trước phẫu thuật (vô cảm). */
  anesthesiaReviewComplete?: ClinicalChecklistValue;

  /** Bệnh nhân nhịn ăn/uống đúng quy định trước phẫu thuật. */
  fastingCompliant?: ClinicalChecklistValue;

  /**
   * Bệnh nhân đã ký cam kết điều trị. Derived từ Consent entity có
   * `consentType === 'treatment'`, `consentStatus === 'granted'` và
   * chưa bị thu hồi. Trường này là cache hint — evaluator vẫn đọc trực
   * tiếp từ collection `consents` để tránh stale state.
   */
  treatmentConsentSigned?: ClinicalChecklistValue;
}

export interface CreateCaseInput {
  customerId: string;
  mainServiceGroup: ServiceCategory;
  priority?: CasePriority;
  totalBillBeforeDiscount: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountReason?: string;
  totalBillAfterDiscount: number;
  amountPaid?: number;
  treatmentLocationId?: string;
  treatmentLocationType?: TreatmentLocationType;
  expectedLabDate?: string;
  expectedProcedureDate?: string;
  salesNote?: string;
  medicalNote?: string;
  internalNote?: string;
  privacyLevel?: 'normal' | 'vip' | 'highly_sensitive';
}

export interface UpdateCaseInput extends Partial<CreateCaseInput> {
  status?: CaseStatus;
  actualProcedureDate?: string;
  amountPaid?: number;
  remainingAmount?: number;
  paymentStatus?: PaymentStatus;
  /** Story B.1.5 — updated by the auto-escalation debounce mechanism. */
  lastEscalatedAt?: string;
}

export interface CaseService {
  id: string;
  caseId: string;

  serviceName: string;
  serviceCategory: ServiceCategory;

  listedPrice: number;
  finalPrice: number;
  quantity: number;

  isMainService: boolean;
  isGift: boolean;
  isUpsell: boolean;

  note?: string;
  active?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseServiceInput {
  caseId: string;
  serviceName: string;
  serviceCategory: ServiceCategory;
  listedPrice: number;
  finalPrice: number;
  quantity: number;
  isMainService?: boolean;
  isGift?: boolean;
  isUpsell?: boolean;
  note?: string;
}
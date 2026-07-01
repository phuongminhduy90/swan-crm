import { UserRole } from '@/lib/types';

// Fields considered sensitive — access controlled per role
export const SENSITIVE_CUSTOMER_FIELDS: string[] = [
  'nationalIdNumber',
  'nationalIdIssueDate',
  'nationalIdIssuePlace',
  'address',
  'medicalNote',
  'privacyNote',
];

// Which roles can view sensitive customer fields (CCCD, địa chỉ, ghi chú riêng tư)
// Bao gồm cả sales roles để họ có thể xem CCCD / địa chỉ phục vụ tư vấn
export const SENSITIVE_FIELD_ACCESS_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'cso',
  'master_sales',
  'sales_online',
  'sales_offline',
  'coordinator',
  'doctor',
];

// Which roles can view medical notes (ghi chú y tế lâm sàng)
// Bao gồm sales roles vì họ cần nắm bệnh nền / dị ứng khi tư vấn khách
export const MEDICAL_NOTE_ACCESS_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'cso',
  'master_sales',
  'sales_online',
  'sales_offline',
  'doctor',
  'nurse',
  'coordinator',
];

// Which roles can see payment amounts and finance data
export const PAYMENT_DATA_ACCESS_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'cso',
  'master_sales',
  'accountant',
];

// Which roles can see media-approved attachments
export const MEDIA_APPROVED_ACCESS_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'cso',
  'media',
];

// Which roles can change attachment visibility
export const CHANGE_VISIBILITY_ROLES: UserRole[] = [
  'admin',
  'cso',
];

// Which roles can confirm payments
// Story B.3.1 (F-CRIT-06) — Accountant removed. Only `admin` can confirm
// payments, and even admin cannot confirm a payment they created (SoD).
// The SoD guard lives in /api/payments/[id]/confirm and is gated behind the
// `NEXT_PUBLIC_FEATURE_PAYMENT_SOD` flag (default OFF in production).
export const PAYMENT_CONFIRM_ROLES: UserRole[] = [
  'admin',
];

// Which roles can create payments
export const PAYMENT_CREATE_ROLES: UserRole[] = [
  'admin',
  'cso',
  'master_sales',
  'sales_online',
  'sales_offline',
  'accountant',
];

// Which roles can change case status (generic — all allowed roles).
//
// Story RR-2 (carry-over from Sprint 6.1): removed `nurse` and `cskh_postop`.
// Both roles lack the `cases:write` permission in `ROLE_PERMISSIONS`, so the
// server route's `requirePermission('cases:write')` gate already rejected them
// with 403. Listing them here was dead code that misled downstream readers
// about which roles could actually change status. The invariant is now pinned
// by `src/constants/__tests__/permissions.test.ts`.
//
// Remaining 5 roles all hold `cases:write`:
//   - admin       (full)
//   - cso         (operations lead)
//   - master_sales (sales lead — assigned/creates cases)
//   - coordinator (clinical scheduling)
//   - doctor      (clinical review)
export const CASE_STATUS_CHANGE_ROLES: UserRole[] = [
  'admin',
  'cso',
  'master_sales',
  'coordinator',
  'doctor',
];

// Which roles can cancel or postpone a case
// Chỉ management — không để nurse/cskh_postop hủy ca
export const CASE_CANCEL_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'cso',
  'master_sales',
];

// Which roles can make medical decisions (approve/alert) on a case
export const CASE_MEDICAL_DECISION_ROLES: UserRole[] = [
  'admin',
  'cso',
  'doctor',
];

// Which roles can transition post-op statuses (D1→D90, completed, complaint)
export const CASE_POSTOP_STATUS_ROLES: UserRole[] = [
  'admin',
  'cso',
  'doctor',
  'nurse',
  'cskh_postop',
  'coordinator',
];

// Which roles can approve customer deletion requests
// master_sales bị loại — sales role không nên phê duyệt xóa dữ liệu
export const DELETE_APPROVE_ROLES: UserRole[] = [
  'admin',
  'cso',
  'ceo',
];

/**
 * Story PI-2 (Sprint 7.2) — Who can create a refund payment.
 *
 * Refund creation is a financial write: a separate Payment record with
 * `paymentType: 'refund'` is appended and the case bill is recomputed.
 * Three roles can do this:
 *   - `admin`     — full financial authority
 *   - `ceo`       — oversight + audit visibility
 *   - `accountant` — owns daily reconciliation; refunds are a core
 *                    accountant task (matches Vietnamese clinic accounting
 *                    practice — refunds are distinct transactions, not
 *                    negations).
 *
 * Additionally, the **creator of the original payment** can refund their own
 * entry — this is enforced at runtime inside the API route (not encoded in
 * this constant) so we don't accidentally widen the static list to every
 * role that has `payments:write`. Sales can create payments but should NOT
 * create refunds against them without management involvement.
 *
 * Production rollout is gated by `FEATURE_PAYMENT_TX` (default OFF) per the
 * Sprint 7.2 plan §0.3 D7.2-5.
 */
export const REFUND_CREATE_ROLES: UserRole[] = [
  'admin',
  'ceo',
  'accountant',
];

import { CaseStatus, UserRole } from '@/lib/types';
import type { StaffAssignment } from '@/lib/types/staff-assignment';

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  draft: 'Nháp',
  waiting_customer_info: 'Chờ bổ sung thông tin',
  waiting_payment_confirmation: 'Chờ xác nhận thanh toán',
  payment_confirmed: 'Đã xác nhận thanh toán',
  waiting_location_assignment: 'Chờ chọn nơi thực hiện',
  waiting_hospital_confirmation: 'Chờ bệnh viện xác nhận',
  hospital_confirmed: 'Bệnh viện đã xác nhận',
  waiting_doctor_review: 'Chờ bác sĩ duyệt',
  waiting_lab_test: 'Chờ xét nghiệm',
  lab_test_done: 'Đã xét nghiệm',
  medically_approved: 'Đủ điều kiện chuyên môn',
  scheduled: 'Đã xếp lịch',
  reminder_sent: 'Đã nhắc lịch',
  checked_in: 'Khách đã check-in',
  in_procedure: 'Đang thực hiện',
  procedure_completed: 'Đã thực hiện xong',
  waiting_images_upload: 'Chờ upload hình ảnh',
  post_op_d1: 'Hậu phẫu D1',
  post_op_d3: 'Hậu phẫu D3',
  post_op_d7: 'Hậu phẫu D7',
  post_op_d14: 'Hậu phẫu D14',
  post_op_d30: 'Hậu phẫu D30',
  post_op_d90: 'Hậu phẫu D90',
  completed: 'Hoàn tất',
  postponed: 'Hoãn ca',
  cancelled: 'Hủy ca',
  complaint: 'Khiếu nại',
  medical_alert: 'Cảnh báo chuyên môn',
  medical_alert_resolved: 'Đã xử lý cảnh báo',
};

export const CASE_STATUS_COLORS: Record<CaseStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  waiting_customer_info: 'bg-orange-100 text-orange-700 border-orange-200',
  waiting_payment_confirmation: 'bg-amber-100 text-amber-700 border-amber-200',
  payment_confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  waiting_location_assignment: 'bg-sky-100 text-sky-700 border-sky-200',
  waiting_hospital_confirmation: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  hospital_confirmed: 'bg-teal-100 text-teal-700 border-teal-200',
  waiting_doctor_review: 'bg-violet-100 text-violet-700 border-violet-200',
  waiting_lab_test: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  lab_test_done: 'bg-blue-100 text-blue-700 border-blue-200',
  medically_approved: 'bg-green-100 text-green-700 border-green-200',
  scheduled: 'bg-swan-100 text-swan-700 border-swan-200',
  reminder_sent: 'bg-swan-100 text-swan-600 border-swan-200',
  checked_in: 'bg-swan-200 text-swan-800 border-swan-300',
  in_procedure: 'bg-champagne-400/20 text-champagne-600 border-champagne-400/30',
  procedure_completed: 'bg-green-100 text-green-800 border-green-200',
  waiting_images_upload: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  post_op_d1: 'bg-pink-100 text-pink-700 border-pink-200',
  post_op_d3: 'bg-pink-100 text-pink-700 border-pink-200',
  post_op_d7: 'bg-pink-100 text-pink-700 border-pink-200',
  post_op_d14: 'bg-rose-100 text-rose-700 border-rose-200',
  post_op_d30: 'bg-rose-100 text-rose-700 border-rose-200',
  post_op_d90: 'bg-rose-100 text-rose-700 border-rose-200',
  completed: 'bg-gray-100 text-gray-700 border-gray-200',
  postponed: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  complaint: 'bg-red-200 text-red-800 border-red-300',
  medical_alert: 'bg-orange-200 text-orange-900 border-orange-300',
  medical_alert_resolved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

// Allowed forward transitions per status
export const CASE_STATUS_TRANSITIONS: Partial<Record<CaseStatus, CaseStatus[]>> = {
  draft: ['waiting_customer_info', 'waiting_payment_confirmation', 'cancelled'],
  waiting_customer_info: ['waiting_payment_confirmation', 'cancelled'],
  waiting_payment_confirmation: ['payment_confirmed', 'cancelled'],
  payment_confirmed: ['waiting_location_assignment'],
  waiting_location_assignment: ['waiting_hospital_confirmation', 'waiting_doctor_review'],
  waiting_hospital_confirmation: ['hospital_confirmed', 'postponed'],
  // B.1.2 (F-CRIT-04): clinical-safety gate — case must pass doctor review (and
  // lab when applicable) before scheduling. `scheduled` is reachable only via
  // `medically_approved`. See docs/ux-redesign/STORY_B1_2_MIGRATION_NOTES.md.
  hospital_confirmed: ['waiting_doctor_review', 'waiting_lab_test'],
  waiting_doctor_review: ['medically_approved', 'medical_alert', 'postponed'],
  waiting_lab_test: ['lab_test_done'],
  lab_test_done: ['medically_approved', 'medical_alert'],
  medically_approved: ['scheduled'],
  scheduled: ['reminder_sent', 'postponed', 'cancelled'],
  reminder_sent: ['checked_in', 'postponed'],
  checked_in: ['in_procedure'],
  in_procedure: ['procedure_completed'],
  procedure_completed: ['waiting_images_upload', 'post_op_d1'],
  waiting_images_upload: ['post_op_d1'],
  post_op_d1: ['post_op_d3', 'completed', 'medical_alert', 'complaint'],
  post_op_d3: ['post_op_d7', 'completed', 'medical_alert', 'complaint'],
  post_op_d7: ['post_op_d14', 'completed', 'medical_alert', 'complaint'],
  post_op_d14: ['post_op_d30', 'completed', 'medical_alert', 'complaint'],
  post_op_d30: ['post_op_d90', 'completed', 'medical_alert', 'complaint'],
  post_op_d90: ['completed', 'medical_alert', 'complaint'],
  medical_alert: ['medical_alert_resolved', 'complaint', 'completed'],
  medical_alert_resolved: [],
  complaint: ['completed'],
};

export const POST_OP_STATUSES: CaseStatus[] = [
  'post_op_d1',
  'post_op_d3',
  'post_op_d7',
  'post_op_d14',
  'post_op_d30',
  'post_op_d90',
];

export const TERMINAL_STATUSES: CaseStatus[] = ['completed', 'cancelled', 'medical_alert_resolved'];

// Hex colors for chart visualizations (Recharts doesn't accept Tailwind classes)
export const CASE_STATUS_HEX: Record<CaseStatus, string> = {
  draft: '#9CA3AF',
  waiting_customer_info: '#F97316',
  waiting_payment_confirmation: '#F59E0B',
  payment_confirmed: '#10B981',
  waiting_location_assignment: '#0EA5E9',
  waiting_hospital_confirmation: '#06B6D4',
  hospital_confirmed: '#14B8A6',
  waiting_doctor_review: '#8B5CF6',
  waiting_lab_test: '#6366F1',
  lab_test_done: '#3B82F6',
  medically_approved: '#22C55E',
  scheduled: '#00ADBE',
  reminder_sent: '#00B5C4',
  checked_in: '#0E9DAB',
  in_procedure: '#C9A96E',
  procedure_completed: '#16A34A',
  waiting_images_upload: '#EAB308',
  post_op_d1: '#EC4899',
  post_op_d3: '#EC4899',
  post_op_d7: '#EC4899',
  post_op_d14: '#F43F5E',
  post_op_d30: '#F43F5E',
  post_op_d90: '#F43F5E',
  completed: '#6B7280',
  postponed: '#64748B',
  cancelled: '#EF4444',
  complaint: '#DC2626',
  medical_alert: '#EA580C',
  medical_alert_resolved: '#10B981',
};

// Pipeline funnel — high-level status groups used in pipeline chart
export const PIPELINE_STAGES = [
  { key: 'draft', label: 'Khởi tạo' },
  { key: 'confirmed', label: 'Xác nhận' },
  { key: 'scheduled', label: 'Xếp lịch' },
  { key: 'in_procedure', label: 'Thực hiện' },
  { key: 'post_op', label: 'Hậu phẫu' },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]['key'];

/**
 * Map a CaseStatus to a high-level pipeline stage.
 */
export function getPipelineStage(status: CaseStatus): PipelineStageKey | null {
  if (status === 'draft' || status === 'waiting_customer_info') return 'draft';
  if (
    status === 'waiting_payment_confirmation' ||
    status === 'payment_confirmed' ||
    status === 'waiting_location_assignment' ||
    status === 'waiting_hospital_confirmation' ||
    status === 'hospital_confirmed' ||
    status === 'waiting_doctor_review' ||
    status === 'waiting_lab_test' ||
    status === 'lab_test_done' ||
    status === 'medically_approved'
  ) {
    return 'confirmed';
  }
  if (status === 'scheduled' || status === 'reminder_sent' || status === 'checked_in') {
    return 'scheduled';
  }
  if (status === 'in_procedure' || status === 'procedure_completed' || status === 'waiting_images_upload') {
    return 'in_procedure';
  }
  if (POST_OP_STATUSES.includes(status)) return 'post_op';
  return null; // completed/cancelled/postponed/complaint/medical_alert/medical_alert_resolved
}

// ─── Next-owner banner (Story B.4.2) ────────────────────────────────────

/**
 * Banner urgency level (controls background palette):
 *  - 'red'   — blocked / overdue / clinical-risk status. Highest visual weight.
 *  - 'amber' — action-needed status. Clinician should act this shift.
 *  - 'aqua'  — informational / handoff pending. Neutral.
 */
export type NextOwnerUrgency = 'red' | 'amber' | 'aqua';

/**
 * Which `StaffAssignment` field to read for the actual person's user ID.
 * The page resolves the field against `staffAssignment` to display the
 * name (or 'Chưa phân công' fallback).
 */
export type NextOwnerStaffField =
  | 'masterSalesId'
  | 'salesOnlineId'
  | 'salesOfflineId'
  | 'accountantId'
  | 'doctorId'
  | 'coordinatorId'
  | 'cskhPostopId'
  | 'mediaId';

export interface NextOwner {
  /** Role that owns the next action for this case status. */
  role: UserRole;
  /**
   * Which `StaffAssignment` field resolves to the assigned person. `null`
   * when the role has no single dedicated slot on the assignment form
   * (e.g. role is `admin` / `ceo` / `cso`).
   */
  staffField: NextOwnerStaffField | null;
  /** Short Vietnamese reason explaining why this role owns the next action. */
  reason: string;
  /** Visual urgency level — drives banner color tokens. */
  urgency: NextOwnerUrgency;
}

/**
 * Story B.4.2 (F-CRIT-09) — derive the next-action owner for a case status.
 *
 * Returns `null` for terminal / admin-only statuses (no single owning role).
 * Otherwise returns `{ role, staffField, reason, urgency }` so the page
 * banner can render role + name + reason + colored background without
 * duplicating routing logic in JSX.
 *
 * Notes:
 *  - All `POST_OP_STATUSES` flow to `cskh_postop` (post-op follow-up owner).
 *  - `waiting_*` / `scheduled` / `reminder_sent` / `checked_in` /
 *    `in_procedure` are action-needed (`amber`).
 *  - `medical_alert` / `complaint` / `cancelled` / `medical_alert_resolved`
 *    are clinical-risk / blocked (`red`).
 *  - `draft` / `payment_confirmed` / `hospital_confirmed` /
 *    `medically_approved` / `lab_test_done` / `waiting_images_upload` are
 *    informational handoff (`aqua`).
 */
export function getNextOwner(status: CaseStatus): NextOwner | null {
  switch (status) {
    // ── Sales-owned intake / payment ──
    case 'draft':
      return {
        role: 'master_sales',
        staffField: 'masterSalesId',
        reason: 'Trưởng kinh doanh cần khởi tạo ca và phân công sales theo dõi.',
        urgency: 'aqua',
      };
    case 'waiting_customer_info':
      return {
        role: 'master_sales',
        staffField: 'masterSalesId',
        reason: 'Đang chờ khách bổ sung thông tin — sales theo dõi và nhắc nhở.',
        urgency: 'amber',
      };
    case 'waiting_payment_confirmation':
      return {
        role: 'accountant',
        staffField: 'accountantId',
        reason: 'Kế toán cần xác nhận thanh toán để ca chuyển sang giai đoạn tiếp theo.',
        urgency: 'amber',
      };
    case 'payment_confirmed':
      return {
        role: 'master_sales',
        staffField: 'masterSalesId',
        reason: 'Thanh toán đã xác nhận — sales chọn nơi thực hiện cho khách.',
        urgency: 'aqua',
      };

    // ── Location + clinical intake ──
    case 'waiting_location_assignment':
      return {
        role: 'master_sales',
        staffField: 'masterSalesId',
        reason: 'Sales cần chọn bệnh viện / phòng khám cho ca.',
        urgency: 'amber',
      };
    case 'waiting_hospital_confirmation':
      return {
        role: 'coordinator',
        staffField: 'coordinatorId',
        reason: 'Điều phối viên đang chờ bệnh viện xác nhận lịch.',
        urgency: 'amber',
      };
    case 'hospital_confirmed':
      return {
        role: 'doctor',
        staffField: 'doctorId',
        reason: 'Bệnh viện đã xác nhận — bác sĩ sẽ duyệt hồ sơ chuyên môn.',
        urgency: 'aqua',
      };
    case 'waiting_doctor_review':
      return {
        role: 'doctor',
        staffField: 'doctorId',
        reason: 'Đang chờ bác sĩ duyệt hồ sơ chuyên môn.',
        urgency: 'amber',
      };
    case 'waiting_lab_test':
      return {
        role: 'coordinator',
        staffField: 'coordinatorId',
        reason: 'Đang chờ kết quả xét nghiệm — điều phối viên theo dõi.',
        urgency: 'amber',
      };
    case 'lab_test_done':
      return {
        role: 'doctor',
        staffField: 'doctorId',
        reason: 'Đã có kết quả xét nghiệm — bác sĩ duyệt cuối.',
        urgency: 'aqua',
      };
    case 'medically_approved':
      return {
        role: 'master_sales',
        staffField: 'masterSalesId',
        reason: 'Đã đủ điều kiện chuyên môn — sales chốt lịch thủ thuật.',
        urgency: 'aqua',
      };

    // ── Scheduling + procedure ──
    case 'scheduled':
      return {
        role: 'master_sales',
        staffField: 'masterSalesId',
        reason: 'Đã xếp lịch — sales nhắc lịch và theo dõi check-in.',
        urgency: 'amber',
      };
    case 'reminder_sent':
      return {
        role: 'coordinator',
        staffField: 'coordinatorId',
        reason: 'Đã nhắc lịch — điều phối viên chờ khách check-in.',
        urgency: 'amber',
      };
    case 'checked_in':
      return {
        role: 'doctor',
        staffField: 'doctorId',
        reason: 'Khách đã check-in — bác sĩ chuẩn bị vào thủ thuật.',
        urgency: 'amber',
      };
    case 'in_procedure':
      return {
        role: 'doctor',
        staffField: 'doctorId',
        reason: 'Đang thực hiện thủ thuật — bác sĩ phụ trách.',
        urgency: 'amber',
      };
    case 'procedure_completed':
      return {
        role: 'cskh_postop',
        staffField: 'cskhPostopId',
        reason: 'Đã hoàn thành thủ thuật — CSKH hậu phẫu theo dõi D1 → D90.',
        urgency: 'aqua',
      };
    case 'waiting_images_upload':
      return {
        role: 'media',
        staffField: 'mediaId',
        reason: 'Đang chờ media upload hình ảnh trước/sau.',
        urgency: 'aqua',
      };

    // ── Post-op follow-up — CSKH owns every D-step ──
    case 'post_op_d1':
    case 'post_op_d3':
    case 'post_op_d7':
    case 'post_op_d14':
    case 'post_op_d30':
    case 'post_op_d90':
      return {
        role: 'cskh_postop',
        staffField: 'cskhPostopId',
        reason: 'Hậu phẫu — CSKH cập nhật tình trạng theo mốc D1 → D90.',
        urgency: 'amber',
      };

    // ── Blocked / risk states ──
    case 'medical_alert':
      return {
        role: 'doctor',
        staffField: 'doctorId',
        reason: 'Cảnh báo chuyên môn — bác sĩ xử lý ngay.',
        urgency: 'red',
      };
    case 'medical_alert_resolved':
      return {
        role: 'doctor',
        staffField: 'doctorId',
        reason: 'Cảnh báo đã xử lý — bác sĩ xác nhận hoàn tất.',
        urgency: 'red',
      };
    case 'complaint':
      return {
        role: 'cso',
        staffField: null,
        reason: 'Khiếu nại — CSO điều phối xử lý.',
        urgency: 'red',
      };
    case 'cancelled':
      return {
        role: 'cso',
        staffField: null,
        reason: 'Ca đã hủy — CSO đánh giá và đóng case.',
        urgency: 'red',
      };
    case 'postponed':
      return {
        role: 'master_sales',
        staffField: 'masterSalesId',
        reason: 'Ca đang hoãn — sales theo dõi lịch mới.',
        urgency: 'amber',
      };
    case 'completed':
      return null;
    default:
      return null;
  }
}

/**
 * Story B.4.2 — resolve a `NextOwner` to the assigned user's display name.
 *
 * - When `staffField` is `null`, returns the role label as a fallback (the
 *   role does not have a dedicated assignment slot — e.g. CSO owns all
 *   `cancelled` cases at the org level).
 * - When `staffField` is set but the assignment is missing or empty,
 *   returns `null` so the page renders "Chưa phân công" without crashing.
 *
 * Pure function — does not touch React or fetch state. Caller passes the
 * already-loaded `staffAssignment` + `users` arrays.
 */
export function resolveNextOwnerName(
  nextOwner: NextOwner | null,
  staffAssignment: StaffAssignment | null | undefined,
  usersMap: Map<string, { displayName: string }>,
  roleLabel: string,
): { displayName: string; isRoleFallback: boolean } | null {
  if (!nextOwner) return null;
  if (!nextOwner.staffField) {
    return { displayName: roleLabel, isRoleFallback: true };
  }
  const assignedId = staffAssignment?.[nextOwner.staffField] as
    | string
    | string[]
    | undefined;
  if (!assignedId || (Array.isArray(assignedId) && assignedId.length === 0)) {
    return null;
  }
  const primaryId = Array.isArray(assignedId) ? assignedId[0] : assignedId;
  const user = primaryId ? usersMap.get(primaryId) : undefined;
  if (!user) {
    // Unknown user ID — render graceful "Chưa phân công" instead of leaking
    // a raw `user-001` string (A2 anti-pattern).
    return null;
  }
  return { displayName: user.displayName, isRoleFallback: false };
}

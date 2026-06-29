import { CaseStatus } from '@/lib/types';

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
  medical_alert: ['procedure_completed', 'complaint', 'completed'],
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

export const TERMINAL_STATUSES: CaseStatus[] = ['completed', 'cancelled'];

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
  return null; // completed/cancelled/postponed/complaint/medical_alert
}

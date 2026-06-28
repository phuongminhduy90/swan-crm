import { getCase } from '@/lib/firestore/cases';
import { getCustomer } from '@/lib/firestore/customers';
import { getStaffAssignment } from '@/lib/firestore/staff-assignments';
import { getCoordinationByCase } from '@/lib/firestore/treatment-locations';
import { getPaymentsByCase } from '@/lib/firestore/payments';

export interface ChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  required: boolean;
}

export async function evaluatePreHospitalChecklist(
  caseId: string,
): Promise<{ items: ChecklistItem[]; allPassed: boolean }> {
  const [caseRecord, payments, staffAssignment] = await Promise.all([
    getCase(caseId),
    getPaymentsByCase(caseId),
    getStaffAssignment(caseId),
  ]);

  if (!caseRecord) {
    return { items: [], allPassed: false };
  }

  // Load customer trực tiếp theo ID — không load toàn bộ collection
  const customer = await getCustomer(caseRecord.customerId);

  const confirmedPayments = payments.filter((p) => p.status === 'confirmed');
  const hasConfirmedPayment = confirmedPayments.length > 0;

  const items: ChecklistItem[] = [
    {
      key: 'customer_name',
      label: 'Có họ tên khách hàng',
      passed: Boolean(customer?.fullName),
      required: true,
    },
    {
      key: 'customer_phone',
      label: 'Có số điện thoại',
      passed: Boolean(customer?.phone),
      required: true,
    },
    {
      key: 'customer_dob',
      label: 'Có ngày sinh hoặc năm sinh',
      passed: Boolean(customer?.dateOfBirth),
      required: true,
    },
    {
      key: 'main_service',
      label: 'Có dịch vụ chính',
      passed: Boolean(caseRecord.mainServiceGroup),
      required: true,
    },
    {
      key: 'total_bill',
      label: 'Có tổng bill',
      passed: caseRecord.totalBillAfterDiscount > 0,
      required: true,
    },
    {
      key: 'payment_confirmed',
      label: 'Có thanh toán được xác nhận',
      passed: hasConfirmedPayment,
      required: true,
    },
    {
      key: 'treatment_location',
      label: 'Có nơi thực hiện',
      passed: Boolean(caseRecord.treatmentLocationId),
      required: true,
    },
    {
      key: 'lab_date',
      label: 'Có ngày xét nghiệm hoặc ngày dự kiến',
      passed: Boolean(caseRecord.expectedLabDate || caseRecord.expectedProcedureDate),
      required: true,
    },
    {
      key: 'procedure_date',
      label: 'Có ngày thực hiện dự kiến',
      passed: Boolean(caseRecord.expectedProcedureDate),
      required: true,
    },
    {
      key: 'coordinator',
      label: 'Có điều phối viên phụ trách',
      passed: Boolean(staffAssignment?.coordinatorId),
      required: true,
    },
    {
      key: 'vip_privacy_note',
      label: 'Có ghi chú riêng tư (nếu khách VIP/nhạy cảm)',
      passed:
        caseRecord.privacyLevel === 'normal' ||
        Boolean(caseRecord.internalNote || customer?.privacyNote),
      required: caseRecord.privacyLevel !== 'normal',
    },
  ];

  const requiredItems = items.filter((i) => i.required);
  const allPassed = requiredItems.every((i) => i.passed);

  return { items, allPassed };
}

export async function evaluatePreProcedureChecklist(
  caseId: string,
): Promise<{ items: ChecklistItem[]; allPassed: boolean }> {
  const [caseRecord, staffAssignment, coordination] = await Promise.all([
    getCase(caseId),
    getStaffAssignment(caseId),
    getCoordinationByCase(caseId),
  ]);

  if (!caseRecord) {
    return { items: [], allPassed: false };
  }

  const requiresHospital =
    caseRecord.treatmentLocationType &&
    caseRecord.treatmentLocationType !== 'swan';

  const items: ChecklistItem[] = [
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
      passed: Boolean(staffAssignment?.doctorId),
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
      passed:
        !requiresHospital ||
        Boolean(coordination?.hospitalConfirmed),
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

  const requiredItems = items.filter((i) => i.required);
  const allPassed = requiredItems.every((i) => i.passed);

  return { items, allPassed };
}

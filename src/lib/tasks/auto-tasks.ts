import { CaseStatus, CaseRecord } from '@/lib/types';
import { createTask } from '@/lib/firestore/tasks';
import { getStaffAssignment } from '@/lib/firestore/staff-assignments';

/**
 * Automatically creates tasks when a case status changes.
 * Per spec §20.3
 */
export async function triggerAutoTasks(
  caseRecord: CaseRecord,
  newStatus: CaseStatus,
  createdBy: string,
): Promise<void> {
  const caseId = caseRecord.id;
  const customerId = caseRecord.customerId;
  const staffAssignment = await getStaffAssignment(caseId);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString();

  const tasksToCreate: Parameters<typeof createTask>[0][] = [];

  switch (newStatus) {
    case 'draft':
    case 'waiting_customer_info':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Bổ sung thông tin khách hàng`,
        caseId,
        customerId,
        assignedTo: staffAssignment?.masterSalesId ?? staffAssignment?.salesOnlineId ?? staffAssignment?.salesOfflineId,
        department: 'sales',
        priority: 'high',
        dueDate: tomorrowISO,
      });
      break;

    case 'waiting_payment_confirmation':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Xác nhận thanh toán`,
        description: `Xác nhận thanh toán cho ca ${caseRecord.caseCode}`,
        caseId,
        customerId,
        assignedTo: staffAssignment?.accountantId,
        assignedRole: 'accountant',
        department: 'accounting',
        priority: 'high',
        dueDate: tomorrowISO,
      });
      break;

    case 'payment_confirmed':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Chọn nơi thực hiện`,
        caseId,
        customerId,
        assignedTo: staffAssignment?.coordinatorId,
        assignedRole: 'coordinator',
        department: 'coordination',
        priority: 'high',
        dueDate: tomorrowISO,
      });
      break;

    case 'waiting_hospital_confirmation':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Gửi yêu cầu xác nhận bệnh viện`,
        caseId,
        customerId,
        assignedTo: staffAssignment?.coordinatorId,
        assignedRole: 'coordinator',
        department: 'coordination',
        priority: 'urgent',
        dueDate: tomorrowISO,
      });
      break;

    case 'waiting_doctor_review':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Duyệt hồ sơ chuyên môn`,
        caseId,
        customerId,
        assignedTo: staffAssignment?.doctorId,
        assignedRole: 'doctor',
        department: 'medical',
        priority: 'high',
        dueDate: tomorrowISO,
      });
      break;

    case 'waiting_lab_test':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Xếp lịch xét nghiệm`,
        caseId,
        customerId,
        assignedTo: staffAssignment?.coordinatorId,
        assignedRole: 'coordinator',
        department: 'coordination',
        priority: 'high',
        dueDate: tomorrowISO,
      });
      break;

    case 'scheduled':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Nhắc lịch khách hàng`,
        description: `Gọi điện xác nhận lịch hẹn với khách hàng`,
        caseId,
        customerId,
        department: 'sales',
        priority: 'high',
        // 1 ngày trước ngày PT để có thời gian nhắc
        dueDate: caseRecord.expectedProcedureDate
          ? new Date(new Date(caseRecord.expectedProcedureDate).getTime() - 24 * 60 * 60 * 1000).toISOString()
          : tomorrowISO,
      });
      break;

    case 'procedure_completed':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] Upload hình ảnh sau thực hiện`,
        caseId,
        customerId,
        department: 'medical',
        priority: 'high',
        dueDate: tomorrowISO,
      });
      break;

    case 'medical_alert':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] ⚠️ Xử lý cảnh báo chuyên môn`,
        caseId,
        customerId,
        assignedTo: staffAssignment?.doctorId,
        assignedRole: 'doctor',
        department: 'medical',
        priority: 'urgent',
        dueDate: tomorrowISO,
      });
      break;

    case 'complaint':
      tasksToCreate.push({
        title: `[${caseRecord.caseCode}] 🚨 Xử lý khiếu nại khách hàng`,
        caseId,
        customerId,
        assignedRole: 'cso',
        department: 'management',
        priority: 'urgent',
        dueDate: tomorrowISO,
      });
      break;

    default:
      break;
  }

  // Create all tasks
  await Promise.all(
    tasksToCreate.map((task) => createTask(task, createdBy)),
  );
}

import { CaseRecord, Customer, Payment } from '@/lib/types';
import { sendInAppNotification } from './in-app';
import {
  buildNewCaseNotification,
  buildPaymentPendingNotification,
  buildHospitalCoordinationNotification,
  buildMedicalAlertNotification,
  buildComplaintNotification,
  buildPostOpFollowupDueNotification,
} from './templates';

/**
 * Fire-and-forget notification triggers.
 * Each function:
 *  - Builds notification body from templates
 *  - Sends in-app notification
 *  - Catches all errors (never throws — caller doesn't await)
 */

export function triggerNewCaseNotification(
  caseRecord: CaseRecord,
  customer: Customer,
  staffNames?: Record<string, string>,
  locationName?: string,
): void {
  try {
    const { title, body } = buildNewCaseNotification({
      caseRecord,
      customer,
      staffNames,
      locationName,
    });
    void sendInAppNotification({
      eventType: 'new_case_created',
      title,
      body,
      caseId: caseRecord.id,
      customerId: customer.id,
      recipientRoles: ['admin', 'cso', 'master_sales', 'coordinator'],
    });
  } catch (err) {
    console.error('[triggerNewCaseNotification] Failed:', err);
  }
}

export function triggerPaymentPendingNotification(
  payment: Payment,
  caseRecord: CaseRecord,
  customer: Customer,
  creatorName: string,
): void {
  try {
    const { title, body } = buildPaymentPendingNotification({
      caseCode: caseRecord.caseCode,
      customerName: customer.fullName,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentType: payment.paymentType,
      createdByName: creatorName,
    });
    void sendInAppNotification({
      eventType: 'payment_pending',
      title,
      body,
      caseId: caseRecord.id,
      customerId: customer.id,
      recipientRoles: ['accountant', 'admin'],
    });
  } catch (err) {
    console.error('[triggerPaymentPendingNotification] Failed:', err);
  }
}

export function triggerPaymentConfirmedNotification(
  payment: Payment,
  caseRecord: CaseRecord,
): void {
  try {
    void sendInAppNotification({
      eventType: 'payment_confirmed',
      title: `✅ Thanh toán đã xác nhận — ${caseRecord.caseCode}`,
      body: `Thanh toán ${payment.amount.toLocaleString('vi-VN')} VNĐ cho ca ${caseRecord.caseCode} đã được xác nhận.`,
      caseId: caseRecord.id,
      recipientRoles: ['master_sales', 'admin'],
    });
  } catch (err) {
    console.error('[triggerPaymentConfirmedNotification] Failed:', err);
  }
}

export function triggerHospitalCoordinationRequired(
  caseRecord: CaseRecord,
  customer: Customer,
  locationName: string,
  coordinatorName: string,
): void {
  try {
    const { title, body } = buildHospitalCoordinationNotification({
      caseCode: caseRecord.caseCode,
      customerName: customer.fullName,
      locationName,
      expectedLabDate: caseRecord.expectedLabDate,
      expectedProcedureDate: caseRecord.expectedProcedureDate,
      coordinatorName,
    });
    void sendInAppNotification({
      eventType: 'hospital_coordination_required',
      title,
      body,
      caseId: caseRecord.id,
      customerId: customer.id,
      recipientRoles: ['coordinator', 'admin'],
    });
  } catch (err) {
    console.error('[triggerHospitalCoordinationRequired] Failed:', err);
  }
}

export function triggerPostOpFollowupDue(
  caseCode: string,
  customerId: string,
  caseId: string,
  customerName: string,
  followupDay: string,
  assigneeName: string,
  assigneeId: string,
): void {
  try {
    const { title, body } = buildPostOpFollowupDueNotification({
      caseCode,
      customerName,
      followupDay,
      assigneeName,
    });
    void sendInAppNotification({
      eventType: 'postop_followup_due',
      title,
      body,
      caseId,
      customerId,
      recipientUserIds: [assigneeId],
      recipientRoles: ['cskh_postop'],
    });
  } catch (err) {
    console.error('[triggerPostOpFollowupDue] Failed:', err);
  }
}

export function triggerMedicalAlert(caseRecord: CaseRecord): void {
  try {
    const { title, body } = buildMedicalAlertNotification(caseRecord.caseCode);
    void sendInAppNotification({
      eventType: 'medical_alert',
      title,
      body,
      caseId: caseRecord.id,
      recipientRoles: ['doctor', 'cso', 'admin'],
    });
  } catch (err) {
    console.error('[triggerMedicalAlert] Failed:', err);
  }
}

export function triggerComplaint(caseRecord: CaseRecord): void {
  try {
    const { title, body } = buildComplaintNotification(caseRecord.caseCode);
    void sendInAppNotification({
      eventType: 'complaint',
      title,
      body,
      caseId: caseRecord.id,
      recipientRoles: ['cso', 'admin', 'master_sales'],
    });
  } catch (err) {
    console.error('[triggerComplaint] Failed:', err);
  }
}
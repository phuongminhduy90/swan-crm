import { CaseRecord, Customer, Payment, UserRole } from '@/lib/types';
import { sendInAppNotification } from './in-app';
import {
  buildNewCaseNotification,
  buildPaymentPendingNotification,
  buildHospitalCoordinationNotification,
  buildMedicalAlertNotification,
  buildComplaintNotification,
  buildPostOpFollowupDueNotification,
} from './templates';
import { getStaffAssignment } from '@/lib/firestore/staff-assignments';
import { getAllUsers } from '@/lib/firestore/users';

/**
 * Story B.1.7 — Default fallback label when a CSKH display name cannot be
 * resolved from the case's staff assignment. Kept as the literal string
 * `'CSKH'` per the BACKLOG: the spec deliberately uses a localized role
 * label rather than `'unknown'` / `'general'` (anti-pattern A1).
 */
export const CSKH_FALLBACK_LABEL = 'CSKH';

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

/**
 * Story B.1.7 (F-MED-19) — Resolve the CSKH (post-op customer-care) display
 * name dynamically from a case's staff assignment.
 *
 * Background:
 *   The previous implementation in `/api/cases/[id]/status/route.ts` passed
 *   the literal string `'CSKH'` as `assigneeName` to `triggerPostOpFollowupDue`.
 *   That meant the notification body always read "Được giao: CSKH" regardless
 *   of who was actually assigned. Receivers couldn't tell which CSKH to
 *   contact without opening the case.
 *
 * Resolution contract:
 *   1. Look up the staff assignment for the case.
 *   2. If `cskhPostopId` is present, resolve the user's display name from
 *      the user directory (single `getAllUsers()` call to amortize lookups).
 *   3. Fall back to the literal `'CSKH'` in any of these cases:
 *      - no staff assignment exists for the case
 *      - the assignment has no `cskhPostopId`
 *      - the user directory does not contain a matching user
 *      - the staff lookup throws (defensive — never crash a notification)
 *
 * This function NEVER throws. All errors are swallowed and logged so the
 * caller (a fire-and-forget notification trigger) is unaffected.
 *
 * @param caseId The case whose CSKH should be resolved.
 * @returns The CSKH display name, or the literal `'CSKH'` fallback.
 */
export async function resolveCskhDisplayName(caseId: string): Promise<string> {
  try {
    const assignment = await getStaffAssignment(caseId);
    const cskhPostopId = assignment?.cskhPostopId;
    if (!cskhPostopId) return CSKH_FALLBACK_LABEL;

    const allUsers = await getAllUsers();
    const byId = new Map(allUsers.map((u) => [u.id, u] as const));
    const displayName = byId.get(cskhPostopId)?.displayName?.trim();
    if (!displayName) return CSKH_FALLBACK_LABEL;

    return displayName;
  } catch (err) {
    console.error('[resolveCskhDisplayName] Staff/user lookup failed:', err);
    return CSKH_FALLBACK_LABEL;
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

/**
 * Story B.2.2 (F-HIGH-19) — Fire-and-forget: notify the medical team
 * (doctor + cso + admin) when a medical alert is resolved.
 */
export function triggerMedicalAlertResolved(caseRecord: CaseRecord): void {
  try {
    void sendInAppNotification({
      eventType: 'medical_alert_resolved',
      title: `✅ CẢNH BÁO CHUYÊN MÔN ĐÃ XỬ LÝ — ${caseRecord.caseCode}`,
      body: `Ca ${caseRecord.caseCode} đã được xử lý cảnh báo chuyên môn.`,
      caseId: caseRecord.id,
      recipientRoles: ['doctor', 'cso', 'admin'],
    });
  } catch (err) {
    console.error('[triggerMedicalAlertResolved] Failed:', err);
  }
}

export function triggerComplaint(caseRecord: CaseRecord): void {
  // Fire-and-forget: resolve medical team from staff assignment, then send.
  // We keep the outer function sync (callers do `triggerComplaint(existing)`)
  // but do all the async resolution work in an inner async IIFE so the API
  // route handler doesn't need to await us.
  void (async () => {
    try {
      // 1. Resolve the medical team from the case's staff assignment.
      //    The original recipients (cso, admin, master_sales) are preserved
      //    below as a baseline so the notification still fires even if the
      //    assignment hasn't been created yet.
      const recipientUserIds: string[] = [];
      let staffNames: { doctor?: string; nurse?: string; coordinator?: string } = {};

      try {
        const assignment = await getStaffAssignment(caseRecord.id);
        if (assignment) {
          if (assignment.doctorId) recipientUserIds.push(assignment.doctorId);
          if (assignment.coordinatorId) recipientUserIds.push(assignment.coordinatorId);
          if (Array.isArray(assignment.nurseIds)) {
            recipientUserIds.push(...assignment.nurseIds);
          }

          // Resolve display names for the notification body. Use getAllUsers()
          // (small dataset — 12 roles in dev) instead of N point-reads.
          const userIdsToResolve = [
            assignment.doctorId,
            assignment.coordinatorId,
            ...(assignment.nurseIds ?? []),
          ].filter((id): id is string => Boolean(id));

          if (userIdsToResolve.length > 0) {
            const allUsers = await getAllUsers();
            const byId = new Map(allUsers.map((u) => [u.id, u] as const));
            if (assignment.doctorId) {
              staffNames.doctor = byId.get(assignment.doctorId)?.displayName;
            }
            if (assignment.coordinatorId) {
              staffNames.coordinator = byId.get(assignment.coordinatorId)?.displayName;
            }
            const firstNurse = assignment.nurseIds?.[0];
            if (firstNurse) {
              staffNames.nurse = byId.get(firstNurse)?.displayName;
            }
          }
        }
      } catch (err) {
        // Don't abort the complaint notification just because staff lookup
        // failed — fall through to the baseline recipients.
        console.error('[triggerComplaint] Staff resolution failed:', err);
      }

      // 2. Build the body. PII fields (nationalIdNumber, medicalNote,
      //    privacyNote) are NEVER included in the notification payload.
      //    Only case code + customer name + assigned medical staff names.
      const { title, body } = buildComplaintNotification({
        caseCode: caseRecord.caseCode,
        staffNames,
      });

      // 3. Send. Recipient set = baseline (cso/admin/master_sales roles) +
      //    specifically-resolved doctor/nurse/coordinator users.
      await sendInAppNotification({
        eventType: 'complaint',
        title,
        body,
        caseId: caseRecord.id,
        recipientRoles: ['cso', 'admin', 'master_sales'] satisfies UserRole[],
        recipientUserIds: dedupe(recipientUserIds),
      });
    } catch (err) {
      console.error('[triggerComplaint] Failed:', err);
    }
  })();
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
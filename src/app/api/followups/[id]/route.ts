import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateFollowup, getFollowup } from '@/lib/firestore/followups';
import { writeAuditLog } from '@/lib/firestore/audit';
import { getCase, updateCase } from '@/lib/firestore/cases';
import { getStaffAssignment } from '@/lib/firestore/staff-assignments';
import { getAllUsers } from '@/lib/firestore/users';
import { getCustomer } from '@/lib/firestore/customers';
import { SeverityLevel } from '@/lib/types';
import { requirePermission, isErrorResponse } from '@/lib/api/auth';
import {
  evaluateEscalation,
  resolveEscalationRecipients,
  buildEscalationAuditSnapshot,
} from '@/lib/followups/escalate';
import { triggerFollowupEscalation } from '@/lib/notifications/trigger';

const updateFollowupSchema = z.object({
  status: z.enum(['pending', 'contacted', 'no_response', 'issue_reported', 'completed']).optional(),
  customerCondition: z.string().optional(),
  painLevel: z.number().min(0).max(5).optional(),
  swellingLevel: z.number().min(0).max(5).optional(),
  bruisingLevel: z.number().min(0).max(5).optional(),
  requestedImage: z.boolean().optional(),
  imageUploaded: z.boolean().optional(),
  note: z.string().optional(),
  nextAction: z.string().optional(),
});

/**
 * PATCH /api/followups/[id]
 *
 * Story B.1.5 (F-HIGH-20) — Auto-escalate a followup when painLevel
 * crosses into the threshold (>= 4) or the status transitions to
 * `issue_reported`. Escalation flow:
 *
 *   1. Read the prev followup snapshot.
 *   2. Persist the update.
 *   3. Read the parent case + its staff assignment + the user directory.
 *   4. Call `evaluateEscalation` (pure) — returns a discriminated
 *      `EscalationDecision`. The decision is also persisted via
 *      `writeAuditLog` so the clinical ops team can audit why a
 *      notification was sent (or not) for every save.
 *   5. If escalation is required: resolve recipients, fire the
 *      notification, update `case.lastEscalatedAt` to enable the 6h
 *      debounce window, and write a `followup_escalated` audit entry.
 *
 * The orchestration itself runs in a `try` block — failures during the
 * resolution / notification step NEVER block the persist + `followup_completed`
 * audit log. The escalation is an opportunism, not a transactional
 * requirement (the underlying followup is already saved).
 *
 * @see docs/ux-redesign/STORY_B1_5_IMPLEMENTATION_REPORT.md
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authResult = await requirePermission(request, 'followups:write');
    if (isErrorResponse(authResult)) return authResult;
    const user = authResult.user;

    const body = await request.json();
    const data = updateFollowupSchema.parse(body);

    // ── 1. Read the prev followup so we can detect transitions ────────
    const prev = await getFollowup(params.id);
    if (!prev) {
      return NextResponse.json(
        { error: 'Không tìm thấy followup' },
        { status: 404 },
      );
    }

    await updateFollowup(params.id, {
      status: data.status,
      customerCondition: data.customerCondition,
      painLevel: data.painLevel as SeverityLevel | undefined,
      swellingLevel: data.swellingLevel as SeverityLevel | undefined,
      bruisingLevel: data.bruisingLevel as SeverityLevel | undefined,
      requestedImage: data.requestedImage,
      imageUploaded: data.imageUploaded,
      note: data.note,
      nextAction: data.nextAction,
    });

    if (data.status === 'completed') {
      await writeAuditLog({
        actorId: user.uid,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'followup_completed',
        entityType: 'followup',
        entityId: params.id,
        before: { status: 'pending' },
        after: { status: 'completed' },
      });
    }

    // ── 2. Story B.1.5 — escalation orchestration ─────────────────────
    //
    // We do this in a self-contained async IIFE so a slow staff lookup
    // never blocks the response, and so we can never accidentally throw
    // out of the route handler. Fire-and-forget is intentional here per
    // Sprint 6.2 §8.6 (integration tests cover the success path).
    void (async () => {
      try {
        const caseRecord = await getCase(prev.caseId);
        if (!caseRecord) return;

        // Both `prev.painLevel` and `data.painLevel` are typed safely:
        // `prev.painLevel` is `SeverityLevel | undefined` (typed source
        // of truth), while `data.painLevel` is `number | undefined` from
        // the Zod validator. The Zod schema already constrains the
        // numeric range to 0–5 (matches `SeverityLevel`), so a cast
        // here is safe and matches the existing line-35 pattern.
        const nextPainLevel = (data.painLevel ?? prev.painLevel) as SeverityLevel | undefined;

        const decision = evaluateEscalation({
          prev: { status: prev.status, painLevel: prev.painLevel },
          next: {
            status: data.status ?? prev.status,
            painLevel: nextPainLevel,
          },
          caseStatus: caseRecord.status,
          lastEscalatedAt: caseRecord.lastEscalatedAt,
        });

        // 2a. Always audit the decision (escalated or not) so clinical
        //     ops has a 1-line trail per save. `writeAuditLog` handles
        //     PII redaction internally (Story B.2.3). `before`/`after`
        //     intentionally exclude the followup body — only the
        //     escalation-relevant fields + the decision itself go to
        //     the log.
        const auditSnapshot = buildEscalationAuditSnapshot({
          prev: { status: prev.status, painLevel: prev.painLevel },
          next: {
            status: data.status ?? prev.status,
            painLevel: nextPainLevel,
          },
          caseStatus: caseRecord.status,
          decision,
          resolvedDoctorNames: [], // filled below when escalating
          resolvedNurseNames: [],
        });
        await writeAuditLog({
          actorId: user.uid,
          actorName: user.displayName,
          actorRole: user.role,
          action: 'followup_escalated',
          entityType: 'followup',
          entityId: params.id,
          before: auditSnapshot.before,
          after: auditSnapshot.after,
        });

        if (!decision.escalated) return;

        // 2b. Resolve recipients from the case's staff assignment
        //     with a fallback to all active doctor/nurse users.
        const [assignment, users, customer] = await Promise.all([
          getStaffAssignment(caseRecord.id)
            .then((a) => a)
            .catch(() => null),
          getAllUsers(),
          getCustomer(caseRecord.customerId)
            .then((c) => c)
            .catch(() => null),
        ]);

        const resolved = resolveEscalationRecipients({
          caseId: caseRecord.id,
          assignment,
          users,
        });

        // 2c. Fire-and-forget notification. The trigger function is
        //     defensive (catches its own errors) so the IIFE cannot
        //     leak an unhandled rejection to the process.
        triggerFollowupEscalation({
          caseRecord,
          customerName: customer?.fullName ?? 'Khách hàng',
          followupDay: prev.followupDay,
          painLevel: nextPainLevel,
          trigger:
            decision.reason === 'issue_reported'
              ? 'issue_reported'
              : 'pain_above_threshold',
          recipientUserIds: resolved.recipientUserIds,
          recipientRoles: resolved.recipientRoles,
          doctorNames: resolved.doctorNames,
          nurseNames: resolved.nurseNames,
        });

        // 2d. Stamp the case's lastEscalatedAt to drive the 6h
        //     debounce window on the next save. We use
        //     `decision.nowIso` so the audit log + the debounce
        //     horizon agree exactly.
        await updateCase(
          caseRecord.id,
          { lastEscalatedAt: decision.nowIso },
          user.uid,
        );
      } catch (err) {
        // Swallow + log; never propagate to the caller. The followup
        // update is already persisted.
        console.error('[followup escalation] orchestration failed:', err);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Dữ liệu không hợp lệ' },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update followup error:', error);
    return NextResponse.json(
      { error: 'Không thể cập nhật followup: ' + message },
      { status: 500 },
    );
  }
}

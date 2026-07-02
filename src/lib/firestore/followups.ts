import { Followup, UpdateFollowupInput, FollowupDay } from '@/lib/types';
import {
  setDocument,
  updateDocument,
  getAllDocuments,
  getDocument,
} from '@/lib/firebase/firestore';
import { addDays } from 'date-fns';

const COLLECTION = 'followups';

/**
 * Story PI-4 (Sprint 7.2) — Offsets for each follow-up day, measured from
 * `case.actualProcedureDate` (the date the case actually moved to
 * `procedure_completed`). D1 = procedure day +1, D3 = +3, ..., D90 = +90.
 *
 * `actualProcedureDate` is the **source of truth** for all D1–D90 due-date
 * computation — see `resolveProcedureDateForFollowups` below. The client-side
 * status-workflow captures the date from a `<input type="date">` BEFORE
 * flipping status to `procedure_completed`, persists it to the case, and
 * then passes it as the `procedureDate` argument to `createPostOpFollowups`.
 *
 * @see docs/ux-redesign/STORY_PI_4_IMPLEMENTATION_REPORT.md
 */
const FOLLOWUP_DAYS: { day: FollowupDay; offset: number }[] = [
  { day: 'D1', offset: 1 },
  { day: 'D3', offset: 3 },
  { day: 'D7', offset: 7 },
  { day: 'D14', offset: 14 },
  { day: 'D30', offset: 30 },
  { day: 'D90', offset: 90 },
];

/**
 * Story PI-4 (Sprint 7.2) — Resolve the procedure date used for D1–D90
 * follow-up scheduling.
 *
 * Resolution order (priority 1 → 3):
 *
 *   1. `case.actualProcedureDate` — the date the case ACTUALLY moved to
 *      `procedure_completed`. This is the **source of truth** per the
 *      Sprint 7.2 plan §R7.2-8 convention. Captured by the status-workflow
 *      UI before the status flip; persisted to the case record.
 *   2. `case.expectedProcedureDate` — the forecasted date. Used as a
 *      backward-compat fallback for legacy cases that were transition by
 *      some old code path (e.g. seed data, scripts/imports) without ever
 *      capturing an `actualProcedureDate`.
 *   3. `new Date().toISOString()` — terminal fallback. The case will still
 *      get its D1–D90 trail scheduled, anchored to "now". This matches the
 *      pre-PI-4 behaviour and prevents orphan cases if no date is known.
 *
 * Both inputs are typed as `string | undefined` because Firestore stores
 * them as ISO-8601 strings (see `src/lib/types/case.ts` `CaseRecord`).
 * The terminal fallback is also a string for the same reason. Callers can
 * pass the result directly to `createPostOpFollowups(caseId, customerId,
 * procedureDate, assignedTo)` — both `Date` and `string` are accepted.
 *
 * @param caseRecord The case that just transitioned to `procedure_completed`.
 * @returns ISO-8601 string suitable for `createPostOpFollowups`.
 */
export function resolveProcedureDateForFollowups(
  caseRecord: { actualProcedureDate?: string; expectedProcedureDate?: string },
): string {
  if (caseRecord.actualProcedureDate) {
    return caseRecord.actualProcedureDate;
  }
  if (caseRecord.expectedProcedureDate) {
    return caseRecord.expectedProcedureDate;
  }
  return new Date().toISOString();
}

export async function getFollowupsByCase(caseId: string): Promise<Followup[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data as unknown as Followup[];
}

export async function getAllFollowups(): Promise<Followup[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Followup[]).sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
}

/**
 * Story B.2.4 + Story PI-4 (Sprint 7.2) — Create the D1/D3/D7/D14/D30/D90
 * post-op follow-up trail for a case that just moved to
 * `procedure_completed`.
 *
 * Contract:
 *   - `procedureDate` is the **actual** procedure date. Callers should
 *     resolve it via `resolveProcedureDateForFollowups(caseRecord)` so the
 *     priority order (actual → expected → now) is followed.
 *   - Accepts both `Date` and ISO `string` for convenience.
 *   - Returns the full Followup array (length 6) so callers can use the
 *     id list for notifications, audit, or downstream side-effects.
 *   - Each followup is created in the `pending` state with
 *     `requestedImage` + `imageUploaded` defaults aligned to the existing
 *     UI defaults.
 */
export async function createPostOpFollowups(
  caseId: string,
  customerId: string,
  procedureDate: Date | string,
  assignedTo: string | undefined,
): Promise<Followup[]> {
  const now = new Date().toISOString();
  const created: Followup[] = [];
  // Chấp nhận cả Date và ISO string
  const dateObj = typeof procedureDate === 'string' ? new Date(procedureDate) : procedureDate;

  for (const { day, offset } of FOLLOWUP_DAYS) {
    const id = `fup-${caseId}-${day}-${Math.random().toString(36).slice(2, 6)}`;
    const dueDate = addDays(dateObj, offset).toISOString();

    const followup: Followup = {
      id,
      caseId,
      customerId,
      followupDay: day,
      dueDate,
      assignedTo,
      status: 'pending',
      requestedImage: false,
      imageUploaded: false,
      createdAt: now,
      updatedAt: now,
    };

    await setDocument(COLLECTION, id, followup);
    created.push(followup);
  }

  return created;
}

export async function updateFollowup(
  id: string,
  input: UpdateFollowupInput,
): Promise<void> {
  await updateDocument(COLLECTION, id, input);
}

/**
 * Story B.1.5 (F-HIGH-20) — Read a single followup by ID.
 *
 * Needed by `/api/followups/[id]` to capture the `prev` snapshot before
 * applying a status / painLevel update, so the escalation decision can
 * detect a transition (e.g. pain: 3 → 5).
 */
export async function getFollowup(id: string): Promise<Followup | null> {
  const data = await getDocument<Record<string, unknown>>(COLLECTION, id);
  return data ? (data as unknown as Followup) : null;
}

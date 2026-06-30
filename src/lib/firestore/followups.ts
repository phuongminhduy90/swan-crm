import { Followup, UpdateFollowupInput, FollowupDay } from '@/lib/types';
import {
  setDocument,
  updateDocument,
  getAllDocuments,
  getDocument,
} from '@/lib/firebase/firestore';
import { addDays, format } from 'date-fns';

const COLLECTION = 'followups';

const FOLLOWUP_DAYS: { day: FollowupDay; offset: number }[] = [
  { day: 'D1', offset: 1 },
  { day: 'D3', offset: 3 },
  { day: 'D7', offset: 7 },
  { day: 'D14', offset: 14 },
  { day: 'D30', offset: 30 },
  { day: 'D90', offset: 90 },
];

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

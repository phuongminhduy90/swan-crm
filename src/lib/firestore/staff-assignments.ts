import { StaffAssignment, UpdateStaffAssignmentInput } from '@/lib/types';
import {
  getAllDocuments,
  setDocument,
  updateDocument,
} from '@/lib/firebase/firestore';

const COLLECTION = 'staffAssignments';

export async function getStaffAssignment(caseId: string): Promise<StaffAssignment | null> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data.length > 0 ? (data[0] as unknown as StaffAssignment) : null;
}

export async function createStaffAssignment(
  caseId: string,
  input: UpdateStaffAssignmentInput,
  assignedBy: string,
): Promise<StaffAssignment> {
  const id = `sa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  // Strip null values — StaffAssignment uses `?: T | undefined`, not nullable
  const cleanInput: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== null) cleanInput[key] = value;
  }

  const assignment: StaffAssignment = {
    id,
    caseId,
    ...(cleanInput as Partial<StaffAssignment>),
    assignedBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, assignment);
  return assignment;
}

export async function updateStaffAssignment(
  id: string,
  input: UpdateStaffAssignmentInput,
  updatedBy: string,
): Promise<void> {
  await updateDocument(COLLECTION, id, { ...input, updatedBy });
}

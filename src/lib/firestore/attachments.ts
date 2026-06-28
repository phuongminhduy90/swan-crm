import { Attachment, CreateAttachmentInput, AttachmentVisibility } from '@/lib/types';
import {
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';

const COLLECTION = 'attachments';

export async function getAttachmentsByCase(caseId: string): Promise<Attachment[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'caseId', operator: '==', value: caseId },
  ]);
  return data as unknown as Attachment[];
}

export async function getAllAttachments(): Promise<Attachment[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Attachment[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function createAttachment(
  input: CreateAttachmentInput,
  uploadedBy: string,
): Promise<Attachment> {
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const attachment: Attachment = {
    id,
    caseId: input.caseId,
    customerId: input.customerId,
    type: input.type,
    fileName: input.fileName,
    fileUrl: input.fileUrl,
    storagePath: input.storagePath,
    mimeType: input.mimeType,
    size: input.size,
    visibility: input.visibility ?? 'private', // default private
    consentRequired: input.consentRequired ?? false,
    note: input.note,
    uploadedBy,
    createdAt: now,
    updatedAt: now,
  };

  await setDocument(COLLECTION, id, attachment);
  return attachment;
}

export async function updateAttachmentVisibility(
  id: string,
  visibility: AttachmentVisibility,
  updatedBy: string,
): Promise<void> {
  await updateDocument(COLLECTION, id, { visibility, updatedBy });
}

export async function linkConsentToAttachment(
  id: string,
  consentId: string,
): Promise<void> {
  await updateDocument(COLLECTION, id, { consentId });
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  return (await getDocument<Record<string, unknown>>(COLLECTION, id)) as unknown as Attachment | null;
}

export async function deleteAttachment(id: string): Promise<void> {
  await deleteDocument(COLLECTION, id);
}

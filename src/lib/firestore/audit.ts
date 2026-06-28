import { AuditLog, CreateAuditLogInput } from '@/lib/types';
import { setDocument, getAllDocuments } from '@/lib/firebase/firestore';

const COLLECTION = 'auditLogs';

export async function writeAuditLog(input: CreateAuditLogInput): Promise<void> {
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const log: AuditLog = {
    id,
    actorId: input.actorId,
    actorName: input.actorName,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    createdAt: now,
  };

  // Fire and forget — never throw on audit log failure
  try {
    await setDocument(COLLECTION, id, log);
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}

export async function getAllAuditLogs(): Promise<AuditLog[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as AuditLog[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getAuditLogsByEntity(
  entityType: AuditLog['entityType'],
  entityId: string,
): Promise<AuditLog[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION, [
    { field: 'entityType', operator: '==', value: entityType },
    { field: 'entityId', operator: '==', value: entityId },
  ]);
  return (data as unknown as AuditLog[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

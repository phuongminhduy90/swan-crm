import { AuditLog, CreateAuditLogInput } from '@/lib/types';
import { setDocument, getAllDocuments } from '@/lib/firebase/firestore';

const COLLECTION = 'auditLogs';

/**
 * Story B.2.3 (F-MED-17) — PII redaction in audit log diff.
 *
 * Fields that contain protected health information (PHI) / personally
 * identifiable information (PII) are stripped from both `beforeData` and
 * `afterData` BEFORE the audit log is persisted to storage. The redacted
 * payload is replaced with the literal placeholder string `[ĐÃ ẨN]` so
 * downstream diff renderers can show "value removed" without leaking the
 * raw value.
 *
 * The redacted fields were selected by the data-privacy-expert during
 * Sprint 6.2 review. The source documents (e.g. customer records) still
 * contain the raw value — only the audit log shadow record is scrubbed.
 * Any "view full diff" affordance must read from the source document,
 * not from this audit log.
 *
 * @see docs/ux-redesign/STORY_B2_3_IMPLEMENTATION_REPORT.md
 * @see docs/ux-redesign/STORY_B2_3_MIGRATION_NOTES.md
 */
export const AUDIT_REDACTED_FIELDS: readonly string[] = Object.freeze([
  'medicalNote',
  'privacyNote',
  'nationalIdNumber',
]);

/**
 * Public placeholder string inserted at every redacted field. UI code in
 * the audit-logs page uses this constant when rendering the diff so we
 * never accidentally diverge the display from the persistence layer.
 */
export const AUDIT_REDACTED_PLACEHOLDER = '[ĐÃ ẨN]' as const;

/**
 * Build a shallow-redacted copy of `payload`. Every key listed in
 * `AUDIT_REDACTED_FIELDS` is replaced by the placeholder string
 * regardless of whether it was originally present (preserves key parity
 * between `before` and `after` for diff renderers).
 *
 * The function is pure — no mutation of the input — and defensive: any
 * unexpected non-plain-object payload (`null`, arrays, primitive) is
 * normalized to `undefined` so callers never persist an ambiguous
 * sentinel into the audit log's typed `before?`/`after?` shape.
 */
export function redactPiiFields(
  payload: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  const redacted: Record<string, unknown> = { ...payload };
  for (const field of AUDIT_REDACTED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(redacted, field)) {
      redacted[field] = AUDIT_REDACTED_PLACEHOLDER;
    }
  }
  return redacted;
}

/**
 * Persist an audit log entry. The `before` and `after` snapshots are
 * scrubbed of PII fields (medicalNote, privacyNote, nationalIdNumber)
 * before they reach storage — both shapes are redacted, so a diff
 * between two redacted records is safe to render in the UI.
 *
 * The redaction is a behavior change on the WRITE path only. Source
 * documents (customers, cases, ...) are NOT modified. The raw PII still
 * lives on those records for authorized users; the audit log carries a
 * placeholder so no accidental PII leak can occur through the diff.
 */
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
    before: redactPiiFields(input.before),
    after: redactPiiFields(input.after),
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

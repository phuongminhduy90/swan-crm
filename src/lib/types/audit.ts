import { UserRole } from './user';

export type AuditAction =
  | 'customer_created'
  | 'customer_updated'
  | 'customer_deleted'
  | 'case_created'
  | 'case_updated'
  | 'case_status_changed'
  | 'payment_created'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'attachment_uploaded'
  | 'attachment_deleted'
  | 'attachment_visibility_changed'
  | 'consent_created'
  | 'consent_updated'
  | 'case_status_blocked_by_checklist'
  | 'staff_assignment_changed'
  | 'task_completed'
  | 'followup_completed'
  | 'followup_escalated'
  | 'role_changed'
  | 'note_added'
  /**
   * Story S3 / RR-4 — dashboard StatCard computation fell back to a safe
   * default value (currently `0`) because the source data shape was
   * unexpected and the computation threw. Indicates a data-quality issue
   * that should be investigated; the dashboard still rendered.
   */
  | 'dashboard_render_fallback';

export type AuditEntityType =
  | 'customer'
  | 'case'
  | 'payment'
  | 'attachment'
  | 'consent'
  | 'task'
  | 'followup'
  | 'user'
  /**
   * Story S3 / RR-4 — dashboard surface (e.g. `/dashboard`). Used only by
   * `dashboard_render_fallback` events so the silent-fallback path can be
   * traced via the existing `/audit-logs` UI.
   */
  | 'dashboard';

export interface AuditLog {
  id: string;

  actorId: string;
  actorName: string;
  actorRole: UserRole;

  action: AuditAction;

  entityType: AuditEntityType;
  entityId: string;

  before?: Record<string, unknown>;
  after?: Record<string, unknown>;

  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateAuditLogInput {
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

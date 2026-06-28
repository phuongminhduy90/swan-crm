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
  | 'consent_updated'
  | 'staff_assignment_changed'
  | 'task_completed'
  | 'followup_completed'
  | 'role_changed'
  | 'note_added';

export type AuditEntityType =
  | 'customer'
  | 'case'
  | 'payment'
  | 'attachment'
  | 'consent'
  | 'task'
  | 'followup'
  | 'user';

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

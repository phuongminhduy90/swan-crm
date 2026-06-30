import { UserRole } from './user';

export type NotificationEventType =
  | 'new_case_created'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'hospital_coordination_required'
  | 'hospital_confirmed'
  | 'lab_test_due'
  | 'procedure_scheduled'
  | 'customer_checked_in'
  | 'procedure_completed'
  | 'images_missing'
  | 'postop_followup_due'
  | 'complaint'
  | 'medical_alert'
  | 'medical_alert_resolved';

export type NotificationChannel = 'in_app' | 'telegram' | 'zalo_placeholder';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface Notification {
  id: string;

  eventType: NotificationEventType;

  title: string;
  body: string;

  caseId?: string;
  customerId?: string;

  recipientUserIds?: string[];
  recipientRoles?: UserRole[];

  channel: NotificationChannel;
  status: NotificationStatus;

  readBy?: string[];

  createdAt: string;
  sentAt?: string;
  errorMessage?: string;
}

export interface CreateNotificationInput {
  eventType: NotificationEventType;
  title: string;
  body: string;
  caseId?: string;
  customerId?: string;
  recipientUserIds?: string[];
  recipientRoles?: UserRole[];
  channel?: NotificationChannel;
}
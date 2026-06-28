import { Notification, CreateNotificationInput } from '@/lib/types';
import {
  setDocument,
  updateDocument,
  getAllDocuments,
} from '@/lib/firebase/firestore';

const COLLECTION = 'notifications';

export async function getAllNotifications(): Promise<Notification[]> {
  const data = await getAllDocuments<Record<string, unknown>>(COLLECTION);
  return (data as unknown as Notification[]).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getNotificationsForUser(userId: string): Promise<Notification[]> {
  const all = await getAllNotifications();
  return all.filter(
    (n) => n.recipientUserIds?.includes(userId),
  );
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  const notification: Notification = {
    id,
    eventType: input.eventType,
    title: input.title,
    body: input.body,
    caseId: input.caseId,
    customerId: input.customerId,
    recipientUserIds: input.recipientUserIds,
    recipientRoles: input.recipientRoles,
    channel: input.channel ?? 'in_app',
    status: 'pending',
    readBy: [],
    createdAt: now,
  };

  await setDocument(COLLECTION, id, notification);
  return notification;
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const all = await getAllNotifications();
  const notif = all.find((n) => n.id === notificationId);
  if (!notif) return;

  const readBy = [...(notif.readBy ?? [])];
  if (!readBy.includes(userId)) readBy.push(userId);
  await updateDocument(COLLECTION, notificationId, { readBy });
}

export async function markNotificationSent(id: string): Promise<void> {
  await updateDocument(COLLECTION, id, {
    status: 'sent',
    sentAt: new Date().toISOString(),
  });
}

export async function markNotificationFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  await updateDocument(COLLECTION, id, {
    status: 'failed',
    errorMessage,
  });
}

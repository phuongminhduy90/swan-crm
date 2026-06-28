import { CreateNotificationInput } from '@/lib/types';
import { createNotification } from '@/lib/firestore/notifications';

/**
 * Creates an in-app notification.
 * Per spec §21.1
 */
export async function sendInAppNotification(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await createNotification({ ...input, channel: 'in_app' });
  } catch (err) {
    console.error('[InApp Notification] Failed:', err);
  }
}

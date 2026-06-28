/**
 * Telegram Bot notification adapter.
 * Per spec §21.1 and §21.6 — never sends sensitive data.
 * 
 * Usage: Call from server-side (API routes / Cloud Functions only).
 * Do NOT call from client components.
 */

interface TelegramSendResult {
  ok: boolean;
  error?: string;
}

/**
 * Send a message to a Telegram chat.
 * Requires TELEGRAM_BOT_TOKEN environment variable.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not configured. Skipping.');
    return { ok: false, error: 'Bot token not configured' };
  }

  if (!chatId) {
    return { ok: false, error: 'Chat ID not provided' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.description ?? 'Unknown error' };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.error('[Telegram] Send failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Send notification to accounting chat
 */
export async function notifyAccounting(text: string): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID_ACCOUNTING ?? '';
  return sendTelegramMessage(chatId, text);
}

/**
 * Send notification to coordination chat
 */
export async function notifyCoordination(text: string): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID_COORDINATION ?? '';
  return sendTelegramMessage(chatId, text);
}

/**
 * Send notification to post-op team chat
 */
export async function notifyPostop(text: string): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID_POSTOP ?? '';
  return sendTelegramMessage(chatId, text);
}

/**
 * Send notification to management chat
 */
export async function notifyManagement(text: string): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID_MANAGEMENT ?? '';
  return sendTelegramMessage(chatId, text);
}

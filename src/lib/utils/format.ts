type DateInput = Date | string | number | null | undefined;

/**
 * Coerce various date-shaped inputs into a valid Date instance.
 * Handles: Date, ISO string, epoch ms (number), and Firestore Timestamp-like
 * objects that expose `.toDate()`. Returns null for falsy or unparseable values.
 */
function toDate(input: unknown): Date | null {
  if (input == null || input === '') return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'string' || typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp or any object with .toDate() (defensive)
  if (typeof (input as { toDate?: () => Date })?.toDate === 'function') {
    try {
      const d = (input as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function formatDateVN(input: DateInput): string {
  const date = toDate(input);
  if (!date) return '—';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatDateTimeVN(input: DateInput): string {
  const date = toDate(input);
  if (!date) return '—';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('84')) {
    return `0${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
}

/**
 * Format large numbers compactly: 1.2M, 350K, 1.5B, or full number with locale separators.
 */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('vi-VN').format(n);
}

/**
 * Format VND compactly with currency suffix: "1.2M VNĐ", "350K VNĐ".
 */
export function formatVNDCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B VNĐ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M VNĐ`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K VNĐ`;
  return `${new Intl.NumberFormat('vi-VN').format(n)} VNĐ`;
}

/**
 * Get short month label in Vietnamese: "T1", "T2", ..., "T12".
 * Accepts a Date or a month index (0-11).
 */
export function getMonthLabel(input: Date | number): string {
  const monthIndex = typeof input === 'number' ? input : input.getMonth();
  return `T${monthIndex + 1}`;
}

/**
 * Get full month/year label: "Tháng 6/2026".
 */
export function getMonthYearLabel(date: Date): string {
  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
}

/**
 * Get month key in "YYYY-MM" format for grouping.
 */
export function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Format percentage with one decimal: "12.5%".
 */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}
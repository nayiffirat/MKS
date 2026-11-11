/**
 * Shared local-timezone date, currency rounding, and GTIN normalization helpers.
 */

export function round2(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/**
 * GS1 SKT rule: YYYY-MM-DD is valid through the end of that local calendar day.
 * Returns < 0 if expired (e.g. yesterday => -1), 0 if expiring today, > 0 for future days.
 */
export function daysUntilExpiry(isoDate?: string | null): number | null {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const expLocal = new Date(year, month - 1, day);
  if (expLocal.getFullYear() !== year || expLocal.getMonth() !== month - 1 || expLocal.getDate() !== day) {
    return null;
  }
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expLocal.getTime() - todayLocal.getTime()) / 86_400_000);
}

export function isExpiredDate(isoDate?: string | null): boolean {
  const d = daysUntilExpiry(isoDate);
  return d !== null && d < 0;
}

/**
 * Returns local `YYYY-MM-DDTHH:mm` suitable for `<input type="datetime-local" />`
 * without shifting 3 hours backward in UTC+3 Turkey.
 */
export function getLocalDateTimeInputValue(date: Date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/**
 * Normalizes EAN-8 / UPC-A / EAN-13 / GTIN-14 numeric codes to canonical 14-digit GTIN
 * so `0869...` and `869...` always match reliably. Non-numeric custom SKUs are trimmed & uppercased.
 */
export function normalizeGtin(code?: string | null): string {
  const raw = String(code ?? '').trim();
  if (!raw) return '';
  if (/^\d{8,14}$/.test(raw)) {
    return raw.padStart(14, '0');
  }
  return raw;
}

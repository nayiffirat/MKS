/**
 * Turkish-friendly string normalization and matching utility.
 * Handles uppercase/lowercase Turkish characters (İ/i, I/ı, Ş/ş, Ğ/ğ, Ü/ü, Ö/ö, Ç/ç)
 * and strips diacritics so that queries like "ismail" match "İsmail", "sogan" matches "Soğan",
 * "sahın" matches "Şahin", etc.
 */
export function normalizeTurkish(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Checks whether `target` contains `query` considering Turkish characters and diacritics.
 */
export function turkishIncludes(target: string | null | undefined, query: string | null | undefined): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;
  return normalizeTurkish(target).includes(normalizeTurkish(query));
}

/**
 * Multi-field Turkish search helper. Returns true if query matches any of the fields.
 */
export function turkishMatchesAny(fields: (string | null | undefined)[], query: string | null | undefined): boolean {
  if (!query || !query.trim()) return true;
  const normalizedQuery = normalizeTurkish(query);
  return fields.some(f => normalizeTurkish(f).includes(normalizedQuery));
}

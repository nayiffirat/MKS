/**
 * HTML çıktılarında (PDF/yazdırma şablonları, markdown önizleme) DOM XSS enjeksiyonunu
 * önlemek için kullanıcı/harici kaynaklı metinleri güvenli şekilde kaçırır.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

import { UserProfile } from '../types';

export interface WhatsAppTemplateVars {
    isim?: string;
    bakiye?: string;
    eski_bakiye?: string;
    odenen?: string;
    kalan_bakiye?: string;
    tarih?: string;
    link?: string;
    firma?: string;
    vade?: string;
    fatura_no?: string;
    urunler?: string;
    mahsul?: string;
    koy?: string;
    odeme_yontemi?: string;
    not?: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: Required<NonNullable<UserProfile['whatsappTemplates']>> = {
    collectionReceipt:
        `🧾 *{firma} - TAHSİLAT DEKONTU*\n` +
        `Sayın *{isim}*,\n` +
        `📅 Tarih: {tarih}\n` +
        `💳 Ödeme Yöntemi: {odeme_yontemi}\n\n` +
        `• Önceki Bakiye: {eski_bakiye}\n` +
        `• Tahsil Edilen: *{odenen}*\n` +
        `• Güncel Kalan Bakiye: *{kalan_bakiye}*\n\n` +
        `Ödemeniz cari hesabınıza işlenmiştir. Bereketli sezonlar dileriz.`,

    debtReminder:
        `📌 *{firma} - CARİ HESAP BİLGİLENDİRME*\n` +
        `Sayın *{isim}*,\n` +
        `{tarih} itibarıyla cari hesabınızdaki güncel bakiyeniz *{bakiye}* olarak görünmektedir.\n` +
        `🔗 Detaylı ekstrenizi ve reçetelerinizi buradan inceleyebilirsiniz:\n{link}\n\n` +
        `İyi çalışmalar ve bereketli hasatlar dileriz.`,

    prescriptionShare:
        `🌿 *{firma} - ZİRAİ REÇETE & FATURA*\n` +
        `Sayın *{isim}*,\n` +
        `📅 Tarih: {tarih} | No: {fatura_no}\n` +
        `🌱 Mahsul: {mahsul}\n\n` +
        `{urunler}\n` +
        `💰 Toplam Tutar: *{bakiye}*\n` +
        `Bereketli olsun.`,

    announcement:
        `📢 *{firma} - ZİRAİ DUYURU & UYARI*\n` +
        `Sayın *{isim}* ({koy}),\n` +
        `📅 Tarih: {tarih}\n` +
        `🌱 Bölgemizde *{mahsul}* ekili alanlar için güncel zirai gözlem ve uygulama uyarımız:\n` +
        `• Tarlalarınızda hastalık, zararlı ve hava durumu koşullarına karşı rutin kontrollerinizi aksatmamanızı öneririz.\n\n` +
        `Detaylı bilgi ve reçete danışmanlığı için bizimle iletişime geçebilirsiniz. Bereketli günler dileriz.`
};

export function renderWhatsAppTemplate(
    template: string | undefined,
    fallbackKey: keyof typeof DEFAULT_WHATSAPP_TEMPLATES,
    vars: WhatsAppTemplateVars
): string {
    const raw = (template && template.trim()) ? template : DEFAULT_WHATSAPP_TEMPLATES[fallbackKey];
    return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
        const val = (vars as Record<string, string | undefined>)[key];
        return val !== undefined ? val : '';
    }).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Canonical international WhatsApp phone normalizer (E.164 digits without '+').
 * Supports Turkish `05xx...`, `5xx...`, `905xx...`, `+90 5xx...`, `0090 5xx...`,
 * and international `+...` / `00...` numbers. Returns `''` when invalid.
 */
export function normalizeWaPhone(phone?: string | null): string {
    const raw = String(phone ?? '').trim();
    if (!raw) return '';
    const hasExplicitIntlPrefix = raw.startsWith('+');
    let digits = raw.replace(/\D/g, '');
    if (!digits) return '';

    if (!hasExplicitIntlPrefix && digits.startsWith('00')) {
        digits = digits.slice(2);
    } else if (!hasExplicitIntlPrefix && digits.startsWith('0') && digits.length === 11) {
        digits = '90' + digits.slice(1);
    } else if (!hasExplicitIntlPrefix && digits.length === 10 && digits.startsWith('5')) {
        digits = '90' + digits;
    }

    if (digits.startsWith('0')) return '';
    if (digits.length < 11 || digits.length > 15) return '';
    return digits;
}

/**
 * Builds a verified `https://wa.me/<digits>?text=...` URL, or returns `''` if the phone is invalid/empty.
 */
export function buildWaUrl(phone?: string | null, text?: string): string {
    const normalized = normalizeWaPhone(phone);
    if (!normalized) return '';
    if (text && text.length > 0) {
        return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
    }
    return `https://wa.me/${normalized}`;
}

/**
 * Builds a clean `tel:` href (`tel:+905...` or `tel:05...`) or returns `undefined` if empty/invalid.
 */
export function toTelHref(phone?: string | null): string | undefined {
    const raw = String(phone ?? '').trim();
    if (!raw) return undefined;
    const cleaned = raw.replace(/[^\d+]/g, '');
    const digitCount = cleaned.replace(/\D/g, '').length;
    if (digitCount < 7) return undefined;
    return `tel:${cleaned}`;
}

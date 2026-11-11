import { PesticideCategory } from '../types';

export interface EncryptedBackupEnvelopeV1 {
    format: 'MKS_ENCRYPTED_BACKUP_V1';
    kdf: 'PBKDF2-SHA256';
    iterations: number;
    cipher: 'AES-256-GCM';
    createdAt: string;
    saltBase64: string;
    ivBase64: string;
    ciphertextBase64: string;
}

const PBKDF2_ITERATIONS = 310_000;
const MIN_PBKDF2_ITERATIONS = 10_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const sub = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64.trim());
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

async function deriveAes256Key(password: string, salt: Uint8Array, iterations: number, usage: KeyUsage[]): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        usage
    );
}

export async function encryptMksBackup(plainJson: string, password: string): Promise<string> {
    if (!password || password.trim().length < 8) {
        throw new Error('Şifreli yedek güvenliği için en az 8 karakterli bir parola belirleyin.');
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAes256Key(password, salt, PBKDF2_ITERATIONS, ['encrypt']);
    const plaintextBytes = new TextEncoder().encode(plainJson);
    const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        plaintextBytes as BufferSource
    );

    const envelope: EncryptedBackupEnvelopeV1 = {
        format: 'MKS_ENCRYPTED_BACKUP_V1',
        kdf: 'PBKDF2-SHA256',
        iterations: PBKDF2_ITERATIONS,
        cipher: 'AES-256-GCM',
        createdAt: new Date().toISOString(),
        saltBase64: bytesToBase64(salt),
        ivBase64: bytesToBase64(iv),
        ciphertextBase64: bytesToBase64(new Uint8Array(cipherBuffer))
    };

    return JSON.stringify(envelope, null, 2);
}

export async function decryptMksBackup(encryptedPayload: string, password: string): Promise<string> {
    if (!password) {
        throw new Error('Yedeği çözmek için parolayı girin.');
    }
    let parsed: Partial<EncryptedBackupEnvelopeV1>;
    try {
        parsed = JSON.parse(encryptedPayload.replace(/^\uFEFF/, '').trim());
    } catch {
        throw new Error('Geçersiz .mksbackup dosya formatı.');
    }

    if (
        parsed.format !== 'MKS_ENCRYPTED_BACKUP_V1' ||
        !parsed.saltBase64 ||
        !parsed.ivBase64 ||
        !parsed.ciphertextBase64
    ) {
        throw new Error('Bu dosya geçerli bir MKS AES-256 şifreli yedek dosyası değil.');
    }

    const rawIters = Number(parsed.iterations);
    if (Number.isFinite(rawIters) && (rawIters < MIN_PBKDF2_ITERATIONS || rawIters > MAX_PBKDF2_ITERATIONS)) {
        throw new Error('Geçersiz anahtar türetme parametresi (güvenlik sınırı dışında).');
    }
    const iterations = Number.isFinite(rawIters) && rawIters > 0 ? Math.floor(rawIters) : PBKDF2_ITERATIONS;
    const salt = base64ToBytes(parsed.saltBase64);
    const iv = base64ToBytes(parsed.ivBase64);
    const ciphertext = base64ToBytes(parsed.ciphertextBase64);

    try {
        const key = await deriveAes256Key(password, salt, iterations, ['decrypt']);
        const plainBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as BufferSource },
            key,
            ciphertext as BufferSource
        );
        const decoded = new TextDecoder().decode(plainBuffer);
        // Verify decrypted content is valid JSON
        JSON.parse(decoded);
        return decoded;
    } catch {
        throw new Error('Parola hatalı veya şifreli yedek dosyası bozulmuş!');
    }
}

export interface ParsedDelimitedTable {
    delimiter: ';' | ',' | '\t';
    headers: string[];
    rows: string[][];
}

export function detectDelimiter(firstLine: string): ';' | ',' | '\t' {
    const counts: Record<';' | ',' | '\t', number> = { ';': 0, ',': 0, '\t': 0 };
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
        const ch = firstLine[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (!inQuotes && (ch === ';' || ch === ',' || ch === '\t')) {
            counts[ch]++;
        }
    }
    if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) return ';';
    if (counts['\t'] >= counts[','] && counts['\t'] > 0) return '\t';
    return ',';
}

export function parseDelimitedText(rawText: string): ParsedDelimitedTable {
    const cleaned = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const firstNewline = cleaned.indexOf('\n');
    const firstLine = firstNewline === -1 ? cleaned : cleaned.slice(0, firstNewline);
    const delimiter = detectDelimiter(firstLine);

    const allRows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (inQuotes) {
            if (ch === '"') {
                if (cleaned[i + 1] === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentField += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delimiter) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (ch === '\n') {
                currentRow.push(currentField.trim());
                if (currentRow.some(cell => cell.length > 0)) {
                    allRows.push(currentRow);
                }
                currentRow = [];
                currentField = '';
            } else {
                currentField += ch;
            }
        }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(cell => cell.length > 0)) {
            allRows.push(currentRow);
        }
    }

    if (allRows.length === 0) {
        return { delimiter, headers: [], rows: [] };
    }

    const headers = allRows[0].map((h, idx) => h || `Sütun ${idx + 1}`);
    const rows = allRows.slice(1);
    return { delimiter, headers, rows };
}

export function buildUtf8BomCsv(
    headers: string[],
    rows: (string | number | undefined | null)[][]
): string {
    const escapeCell = (val: string | number | undefined | null): string => {
        if (val === undefined || val === null) return '';
        let str = String(val);
        // Prevent spreadsheet formula injection (=, +, -, @, tab, CR) on non-numeric string values
        if (typeof val === 'string' && /^[=+\-@\t\r]/.test(str) && !/^-[0-9]+([.,][0-9]+)?$/.test(str.trim())) {
            str = `'${str}`;
        }
        if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const lines = [
        headers.map(escapeCell).join(';'),
        ...rows.map(r => r.map(escapeCell).join(';'))
    ];
    return '\uFEFF' + lines.join('\r\n');
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        try {
            if (a.parentNode) document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {}
    }, 15_000);
}

/**
 * Türkçe ve uluslararası sayı biçimlerini ("1.250", "1.250,50", "1,250,000", "1250,75", "12.5")
 * doğru ondalık sayıya çevirir.
 */
export function parseTurkishNumber(raw?: string): number {
    if (!raw) return 0;
    let s = String(raw)
        .trim()
        .replace(/[₺$€£%\s\u00A0]/g, '')
        .replace(/TL|TRY/gi, '')
        .trim();
    if (!s) return 0;

    const sign = s.startsWith('-') ? -1 : 1;
    s = s.replace(/^[+-]/, '');

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            // Turkish/EU: 1.250,50 -> 1250.50
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            // US/UK: 1,250.50 -> 1250.50
            s = s.replace(/,/g, '');
        }
    } else if (hasComma) {
        // Multiple commas = US thousand separators (e.g. 1,250,000); single comma with !=3 trailing digits or TR decimal
        const parts = s.split(',');
        if (parts.length > 2) {
            s = parts.join('');
        } else {
            // Single comma in Turkish context is decimal separator (e.g. "1250,50" or "12,5")
            s = s.replace(',', '.');
        }
    } else if (hasDot) {
        const parts = s.split('.');
        if (parts.length > 2) {
            // Multiple dots = Turkish thousand separators (e.g. "1.250.000")
            s = parts.join('');
        } else if (parts.length === 2 && parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0])) {
            // Exact pattern like "1.250" or "25.000" -> Turkish thousand separator (1250 / 25000)
            s = parts.join('');
        }
    }

    const n = parseFloat(s);
    return Number.isFinite(n) ? sign * n : 0;
}

export function resolvePesticideCategory(raw?: string): PesticideCategory {
    const norm = (raw || '').toLocaleLowerCase('tr-TR').trim();
    if (!norm) return PesticideCategory.OTHER;
    if (norm.includes('insekt') || norm.includes('böcek') || norm.includes('bocek')) return PesticideCategory.INSECTICIDE;
    if (norm.includes('herbis') || /(^|\s)ot(\s|$|ilac|ilaç)/.test(norm)) return PesticideCategory.HERBICIDE;
    if (norm.includes('fungis') || norm.includes('mantar')) return PesticideCategory.FUNGICIDE;
    if (norm.includes('granül') || norm.includes('granul') || norm.includes('taban')) return PesticideCategory.GRANULAR_FERTILIZER;
    if (norm.includes('gübre') || norm.includes('gubre') || norm.includes('besle')) return PesticideCategory.FERTILIZER;
    if (norm.includes('nemat')) return PesticideCategory.NEMATICIDE;
    if (norm.includes('tohum')) return PesticideCategory.SEED;
    if (norm.includes('bgd') || norm.includes('düzenleyici') || norm.includes('duzenleyici')) return PesticideCategory.GROWTH_REGULATOR;
    return PesticideCategory.OTHER;
}

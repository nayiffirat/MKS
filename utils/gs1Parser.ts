import { normalizeTurkish } from './search';
import { isExpiredDate, normalizeGtin } from './dateUtils';

// ---------------------------------------------------------------------------
// GS1 core helpers
// ---------------------------------------------------------------------------

export const GS = '\u001D';

export type GS1CodeType = 'GTIN' | 'GS1_DATAMATRIX' | 'SSCC' | 'RAW' | 'UNKNOWN';

/** Physical symbology, derived from the AIM prefix (]d2, ]Q3, ]C1 …) or a camera format hint. */
export type GS1Symbology =
  | 'datamatrix'
  | 'qr'
  | 'gs1-128'
  | 'gs1-databar'
  | 'ean13'
  | 'ean8'
  | 'upca'
  | 'upce'
  | 'itf14'
  | 'code128'
  | 'code39'
  | 'digital-link'
  | 'unknown';

export interface GS1ParseResult {
  raw: string;
  type: GS1CodeType;
  symbology: GS1Symbology;
  gtin?: string;            // always normalised to 14 digits
  expiryDate?: string;      // ISO YYYY-MM-DD (AI 17)
  productionDate?: string;  // ISO YYYY-MM-DD (AI 11)
  dueDate?: string;         // ISO YYYY-MM-DD (AI 12)
  packagingDate?: string;   // ISO YYYY-MM-DD (AI 13)
  bestBeforeDate?: string;  // ISO YYYY-MM-DD (AI 15)
  sellByDate?: string;      // ISO YYYY-MM-DD (AI 16)
  batch?: string;           // AI 10 (Lot / Parti)
  serial?: string;          // AI 21 (Seri No)
  variant?: string;         // AI 20
  count?: number;           // AI 30 / 37
  sscc?: string;            // 18 digits (AI 00)
  ais: Record<string, string>;
  /** true when SKT (AI 17) is before today (local calendar day, GS1 inclusive rule). */
  expired: boolean;
  /** true when the GS separator was missing and Lot/Seri boundaries could not be determined reliably. */
  ambiguous: boolean;
  /** true when the code came from a GS1 Digital Link URL (https://…/01/{gtin}/10/{lot}…). */
  isDigitalLink?: boolean;
  /** Unparsed tail after an unrecognised element (kept instead of silently dropped). */
  rest?: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** GS1 Modulo-10 check digit over all digits except the last one. */
export function calcGS1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48;
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGS1Number(digits: string, length?: number): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;
  if (length !== undefined && digits.length !== length) return false;
  return calcGS1CheckDigit(digits.slice(0, -1)) === Number(digits[digits.length - 1]);
}

/** Validates a 13-digit GS1 GLN (Global Location Number) incl. Modulo-10 check digit. */
export function validateGLN(gln: string): boolean {
  return isValidGS1Number((gln ?? '').trim(), 13);
}

/** A valid example GLN for placeholders (passes validateGLN). */
export const EXAMPLE_GLN = '8680000000006';

/** YYMMDD -> YYYY-MM-DD. DD=00 means last day of month (GS1 spec). */
export function gs1DateToISO(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  let dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return null;
  // GS1 century rule: year is within -49/+50 of the current year.
  const nowYear = new Date().getFullYear();
  const base = Math.floor(nowYear / 100) * 100;
  let year = base + yy;
  if (year - nowYear > 50) year -= 100;
  else if (nowYear - year > 49) year += 100;
  const lastDay = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  if (dd === 0) dd = lastDay;
  if (dd > lastDay) return null;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function isoToGS1Date(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[1].slice(2)}${m[2]}${m[3]}` : '';
}

// ---------------------------------------------------------------------------
// GS1 Application Identifier table
// ---------------------------------------------------------------------------

interface AISpec {
  /** Fixed value length (no FNC1 needed). */
  fixed?: number;
  /** Max value length for variable (FNC1/GS terminated) AIs. */
  max: number;
  /** Value must be all digits. */
  numeric?: boolean;
  /** Value is a YYMMDD date. */
  date?: boolean;
}

const DATE_AIS = new Set(['11', '12', '13', '15', '16', '17']);

/**
 * Number of digits of the AI that starts at `pos`, derived from its 2-digit prefix
 * (GS1 General Specifications, AI table). Returns 0 when the prefix is not a GS1 AI.
 */
function aiDigitCount(s: string, pos: number): number {
  const p2 = s.substr(pos, 2);
  if (!/^\d{2}$/.test(p2)) return 0;
  const n = Number(p2);
  if (n <= 4) return 2;                                     // 00-04
  if (n >= 10 && n <= 22) return 2;                         // 10-22 (11..19 dates, 20 variant, 21 serial, 22 CPV)
  if (n === 23 || n === 24 || n === 25) return 3;           // 235, 240-243, 250-255
  if (n === 30 || n === 37) return 2;                       // count
  if ((n >= 31 && n <= 36) || n === 39) return 4;           // 310n..369n, 390n..395n
  if (n === 40 || n === 41 || n === 42) return 3;           // 400-403, 410-417, 420-427
  if (n === 43) return 4;                                   // 4300-4333
  if (n === 70) return 4;                                   // 7001..7041
  if (n === 71) return 3;                                   // 710-717 (NHRN)
  if (n === 72) return 4;                                   // 7230..7259
  if (n === 80 || n === 81 || n === 82) return 4;           // 8001..8200
  if (n >= 90 && n <= 99) return 2;                         // internal / company
  return 0;
}

function aiSpec(ai: string): AISpec {
  if (ai === '00') return { fixed: 18, max: 18, numeric: true };
  if (ai === '01' || ai === '02' || ai === '03') return { fixed: 14, max: 14, numeric: true };
  if (ai === '04') return { max: 16 };
  if (/^1[1-9]$/.test(ai)) return { fixed: 6, max: 6, numeric: true, date: DATE_AIS.has(ai) };
  if (ai === '10' || ai === '21' || ai === '22') return { max: 20 };
  if (ai === '20') return { fixed: 2, max: 2, numeric: true };
  if (ai === '235') return { max: 28 };
  if (ai === '240' || ai === '241' || ai === '250' || ai === '251') return { max: 30 };
  if (ai === '242') return { max: 6, numeric: true };
  if (ai === '243' || ai === '254') return { max: 20 };
  if (ai === '253') return { max: 30 };
  if (ai === '255') return { max: 25, numeric: true };
  if (ai === '30' || ai === '37') return { max: 8, numeric: true };
  if (/^3[1-6]\d\d$/.test(ai)) return { fixed: 6, max: 6, numeric: true };
  if (/^39[0-5]\d$/.test(ai)) {
    const third = ai[2];
    if (third === '0' || third === '2') return { max: 15, numeric: true };
    if (third === '1' || third === '3') return { max: 18, numeric: true };
    if (third === '4') return { max: 4, numeric: true };
    return { max: 6, numeric: true };
  }
  if (ai === '400' || ai === '401' || ai === '403') return { max: 30 };
  if (ai === '402') return { max: 17, numeric: true };
  if (/^41[0-7]$/.test(ai)) return { fixed: 13, max: 13, numeric: true };
  if (ai === '420') return { max: 20 };
  if (ai === '421') return { max: 12 };
  if (ai === '422' || ai === '424' || ai === '426') return { max: 3, numeric: true };
  if (ai === '423' || ai === '425') return { max: 15, numeric: true };
  if (ai === '427') return { max: 3 };
  if (/^43\d\d$/.test(ai)) return { max: 70 };
  if (ai === '7001') return { max: 13, numeric: true };
  if (ai === '7003') return { fixed: 10, max: 10, numeric: true };
  if (ai === '7006') return { fixed: 6, max: 6, numeric: true };
  if (ai === '7004') return { max: 4, numeric: true };
  if (/^70\d\d$/.test(ai)) return { max: 30 };
  if (/^71\d$/.test(ai)) return { max: 20 };
  if (/^72\d\d$/.test(ai)) return { max: 90 };
  if (ai === '8001') return { fixed: 14, max: 14, numeric: true };
  if (ai === '8005') return { fixed: 6, max: 6, numeric: true };
  if (ai === '8006' || ai === '8017' || ai === '8018' || ai === '8026') return { fixed: 18, max: 18, numeric: true };
  if (/^8[0-2]\d\d$/.test(ai)) return { max: 70 };
  if (ai === '90') return { max: 30 };
  if (/^9[1-9]$/.test(ai)) return { max: 90 };
  return { max: 90 };
}

/** Returns the AI string at `pos` or null when the text there is not a GS1 AI. */
function matchAI(s: string, pos: number): string | null {
  const len = aiDigitCount(s, pos);
  if (!len) return null;
  const ai = s.substr(pos, len);
  return /^\d+$/.test(ai) && ai.length === len ? ai : null;
}

function isPlausibleFixedValue(ai: string, spec: AISpec, value: string): boolean {
  if (spec.fixed !== undefined && value.length !== spec.fixed) return false;
  if (spec.numeric && !/^\d+$/.test(value)) return false;
  if (spec.date && !gs1DateToISO(value)) return false;
  if ((ai === '01' || ai === '02' || ai === '03') && !isValidGS1Number(value, 14)) return false;
  if (ai === '00' && !isValidGS1Number(value, 18)) return false;
  return true;
}

/** Strong boundary signal: a fixed AI whose value validates (date / check digit). */
function isStrongFixedAt(s: string, pos: number): boolean {
  const ai = matchAI(s, pos);
  if (!ai) return false;
  if (!(DATE_AIS.has(ai) || ai === '01' || ai === '02' || ai === '00')) return false;
  const spec = aiSpec(ai);
  return isPlausibleFixedValue(ai, spec, s.substr(pos + ai.length, spec.fixed ?? 0));
}

/**
 * Memoised check: can s[pos..] be completely tokenised as a sequence of GS1 elements
 * (without GS separators)? Used to find candidate ends of variable-length fields.
 */
function makeParseableChecker(s: string) {
  const memo = new Map<number, boolean>();
  const check = (pos: number, depth: number): boolean => {
    if (pos === s.length) return true;
    if (pos > s.length || depth > 12) return false;
    const cached = memo.get(pos);
    if (cached !== undefined) return cached;
    let ok = false;
    const ai = matchAI(s, pos);
    if (ai) {
      const spec = aiSpec(ai);
      const vStart = pos + ai.length;
      if (spec.fixed !== undefined) {
        const value = s.substr(vStart, spec.fixed);
        ok = isPlausibleFixedValue(ai, spec, value) && check(vStart + spec.fixed, depth + 1);
      } else {
        const hardEnd = Math.min(s.length, vStart + spec.max);
        for (let j = vStart + 1; j <= hardEnd && !ok; j++) {
          const value = s.slice(vStart, j);
          if (spec.numeric && !/^\d+$/.test(value)) break;
          ok = check(j, depth + 1);
        }
      }
    }
    memo.set(pos, ok);
    return ok;
  };
  return (pos: number) => check(pos, 0);
}

interface VariableEnd {
  end: number;
  ambiguous: boolean;
}

/**
 * Wedge-mode scanners often drop the invisible GS separator. When no GS exists we
 * enumerate every position where the rest of the string still tokenises cleanly:
 *  - a following strong fixed AI (17/11/15/16 valid date, 01 valid check digit) wins;
 *  - otherwise, if several boundaries are possible, the result is flagged ambiguous
 *    (Lot/Seri must be confirmed by the user) and the most plausible split is used.
 */
/** AIs that realistically follow a Lot/Seri field on pesticide / pharma packs (BKTS/GTS). */
const BOUNDARY_AIS = new Set(['01', '10', '11', '15', '16', '17', '21', '30', '37']);

function findVariableEnd(
  s: string,
  ai: string,
  start: number,
  spec: AISpec,
  hasGS: boolean,
  parseable: (pos: number) => boolean,
  seen: Record<string, string>,
): VariableEnd {
  const gsIdx = s.indexOf(GS, start);
  if (hasGS) return { end: gsIdx === -1 ? s.length : gsIdx, ambiguous: false };

  const hardEnd = Math.min(s.length, start + spec.max);
  const candidates: number[] = [];
  for (let i = start + 1; i <= hardEnd; i++) {
    if (spec.numeric && !/^\d$/.test(s[i - 1])) break;
    if (i === s.length) { candidates.push(i); continue; }
    const next = matchAI(s, i);
    // A boundary is only plausible when it starts a common, not-yet-seen, different AI
    // (a lot like "L2310A" must not be split at its inner "10").
    if (!next || next === ai || seen[next] !== undefined || !BOUNDARY_AIS.has(next)) continue;
    if (parseable(i)) candidates.push(i);
  }
  if (candidates.length === 0) return { end: hardEnd, ambiguous: s.length > hardEnd };
  if (candidates.length === 1) return { end: candidates[0], ambiguous: false };

  const strong = candidates.find(i => i < s.length && isStrongFixedAt(s, i));
  if (strong !== undefined) return { end: strong, ambiguous: false };

  // Prefer a boundary that starts the "other" common variable AI (10 <-> 21).
  const other = ai === '10' ? '21' : ai === '21' ? '10' : null;
  const preferred =
    (other && candidates.find(i => i < s.length && s.startsWith(other, i))) ||
    candidates.find(i => i < s.length && (s.startsWith('10', i) || s.startsWith('21', i))) ||
    candidates[candidates.length - 1];
  return { end: preferred, ambiguous: true };
}

function applyAI(result: GS1ParseResult, ai: string, value: string): void {
  result.ais[ai] = value;
  switch (ai) {
    case '00':
      result.sscc = value;
      if (!isValidGS1Number(value, 18)) result.errors.push('SSCC kontrol hanesi hatalı');
      break;
    case '01':
    case '02':
      result.gtin = value.padStart(14, '0');
      if (!isValidGS1Number(result.gtin, 14)) result.errors.push('GTIN kontrol hanesi hatalı');
      break;
    case '10': result.batch = value; break;
    case '21': result.serial = value; break;
    case '20': result.variant = value; break;
    case '30':
    case '37': {
      const n = Number(value);
      if (Number.isFinite(n)) result.count = n;
      break;
    }
    case '11':
    case '12':
    case '13':
    case '15':
    case '16':
    case '17': {
      const iso = gs1DateToISO(value);
      const label: Record<string, string> = { '11': 'üretim tarihi', '12': 'vade tarihi', '13': 'paketleme tarihi', '15': 'TETT', '16': 'satış son tarihi', '17': 'SKT' };
      if (!iso) { result.errors.push(`Geçersiz ${label[ai]}: ${value}`); break; }
      if (ai === '17') result.expiryDate = iso;
      else if (ai === '11') result.productionDate = iso;
      else if (ai === '12') result.dueDate = iso;
      else if (ai === '13') result.packagingDate = iso;
      else if (ai === '15') result.bestBeforeDate = iso;
      else result.sellByDate = iso;
      break;
    }
  }
}

const AIM_SYMBOLOGY: Record<string, GS1Symbology> = {
  ']d1': 'datamatrix', ']d2': 'datamatrix',
  ']Q1': 'qr', ']Q3': 'qr',
  ']C0': 'code128', ']C1': 'gs1-128',
  ']e0': 'gs1-databar',
  ']E0': 'ean13', ']E4': 'ean8', ']E1': 'upce',
  ']A0': 'code39', ']I1': 'itf14',
};
const GS1_AIM = new Set([']d2', ']Q3', ']C1', ']e0']);

/** Maps camera library format names (html5-qrcode / ZXing / BarcodeDetector / ML Kit) to a symbology. */
export function symbologyFromFormatName(format?: string | null): GS1Symbology {
  const f = String(format ?? '').toUpperCase().replace(/[\s-]/g, '_');
  if (!f) return 'unknown';
  if (f.includes('DATA_MATRIX') || f === 'DATAMATRIX') return 'datamatrix';
  if (f.includes('QR')) return 'qr';
  if (f === 'EAN_13' || f === 'EAN13') return 'ean13';
  if (f === 'EAN_8' || f === 'EAN8') return 'ean8';
  if (f === 'UPC_A' || f === 'UPCA') return 'upca';
  if (f === 'UPC_E' || f === 'UPCE') return 'upce';
  if (f === 'ITF' || f === 'ITF14' || f === 'ITF_14') return 'itf14';
  if (f.includes('128')) return 'code128';
  if (f.includes('39')) return 'code39';
  if (f.includes('RSS') || f.includes('DATABAR')) return 'gs1-databar';
  return 'unknown';
}

function newResult(raw: string, symbology: GS1Symbology): GS1ParseResult {
  return { raw, type: 'UNKNOWN', symbology, ais: {}, expired: false, ambiguous: false, valid: false, errors: [], warnings: [] };
}

function finalise(result: GS1ParseResult): GS1ParseResult {
  result.expired = isExpiredDate(result.expiryDate);
  if (result.expired) result.warnings.push(`Son kullanma tarihi geçmiş (SKT: ${result.expiryDate})`);
  result.valid = result.errors.length === 0 && !result.ambiguous;
  return result;
}

/** Parses a GS1 Digital Link URI: https://domain/…/01/{gtin}/10/{lot}/21/{ser}?17=YYMMDD */
function parseDigitalLink(s: string, result: GS1ParseResult): boolean {
  let url: URL;
  try { url = new URL(s); } catch { return false; }
  if (!/^https?:$/.test(url.protocol)) return false;
  const segs = url.pathname.split('/').filter(Boolean).map(seg => {
    try { return decodeURIComponent(seg); } catch { return seg; }
  });
  const shortNames: Record<string, string> = { gtin: '01', lot: '10', ser: '21', exp: '17', sscc: '00', cpv: '22' };
  const startIdx = segs.findIndex((seg, i) => (seg === '01' || seg === '00' || seg === '414' || seg === 'gtin') && i + 1 < segs.length);
  if (startIdx === -1) return false;
  for (let i = startIdx; i + 1 < segs.length; i += 2) {
    const ai = shortNames[segs[i].toLowerCase()] ?? segs[i];
    if (!/^\d{2,4}$/.test(ai)) break;
    applyAI(result, ai, segs[i + 1]);
  }
  url.searchParams.forEach((value, key) => {
    const ai = shortNames[key.toLowerCase()] ?? key;
    if (/^\d{2,4}$/.test(ai)) applyAI(result, ai, value);
  });
  if (!result.gtin && !result.sscc) return false;
  result.isDigitalLink = true;
  return true;
}

/** Strips control characters (except GS) and normalises GS stand-ins from scanners/inputs. */
export function sanitizeScannedText(raw: string): string {
  return String(raw ?? '')
    .replace(/<GS>|\\x1d|\\u001d|\{GS\}|\[GS\]/gi, GS)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001C\u001E\u001F\u007F]/g, '')
    .trim();
}

/**
 * Parses 1D EAN-8/UPC-A/EAN-13/GTIN-14, bare SSCC-18, GS1 element strings
 * (DataMatrix / GS1-128 / GS1 QR) in raw (FNC1/GS) or human readable "(01)..(17).." form,
 * GS1 Digital Link URLs, and returns `type: 'RAW'` (valid, no errors) for plain custom barcodes.
 */
export function parseGS1Barcode(raw: string, formatHint?: string | null): GS1ParseResult {
  const original = String(raw ?? '');
  let s = sanitizeScannedText(original);
  const aim = /^\][A-Za-z]\d/.exec(s)?.[0] ?? '';
  const symbology: GS1Symbology = (aim && AIM_SYMBOLOGY[aim]) || symbologyFromFormatName(formatHint);
  const result = newResult(original, symbology);
  if (!s) { result.errors.push('Boş barkod'); return result; }
  if (aim) s = s.slice(aim.length);
  s = s.replace(/^\u001D+/, '').replace(/\u001D+$/, '');

  // GS1 Digital Link (QR)
  if (/^https?:\/\//i.test(s)) {
    if (parseDigitalLink(s, result)) {
      if (result.symbology === 'unknown') result.symbology = 'qr';
      result.type = result.sscc && !result.gtin ? 'SSCC' : 'GS1_DATAMATRIX';
      return finalise(result);
    }
    result.type = 'RAW';
    result.valid = true;
    return result;
  }

  // Plain 1D codes
  if (/^\d{8}$|^\d{12,14}$/.test(s)) {
    result.type = 'GTIN';
    result.gtin = s.padStart(14, '0');
    result.ais['01'] = result.gtin;
    if (result.symbology === 'unknown') {
      result.symbology = s.length === 8 ? 'ean8' : s.length === 12 ? 'upca' : s.length === 13 ? 'ean13' : 'itf14';
    }
    if (!isValidGS1Number(s)) result.errors.push('GTIN kontrol hanesi hatalı');
    return finalise(result);
  }
  if (/^\d{18}$/.test(s)) {
    result.type = 'SSCC';
    applyAI(result, '00', s);
    return finalise(result);
  }

  const isHumanReadable = /^\(\d{2,4}\)/.test(s);
  const hasGS = s.includes(GS);
  const looksGS1 =
    isHumanReadable ||
    GS1_AIM.has(aim) ||
    hasGS ||
    (/^0[12]\d{14}/.test(s) && isValidGS1Number(s.slice(2, 16), 14)) ||
    (/^00\d{18}/.test(s) && isValidGS1Number(s.slice(2, 20), 18));

  if (!looksGS1) {
    // Internal / custom barcode (Code128 SKU, 9-11 digit shop codes, QR text …)
    result.type = 'RAW';
    result.valid = true;
    return result;
  }

  if (isHumanReadable) {
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) applyAI(result, m[1], m[2].replace(/\u001D/g, '').trim());
  } else {
    // Only consulted when no GS exists, so positions coincide with `s`.
    const parseable = makeParseableChecker(s);
    let pos = 0;
    while (pos < s.length) {
      if (s[pos] === GS) { pos++; continue; }
      const ai = matchAI(s, pos);
      if (!ai) {
        result.rest = s.slice(pos).replace(/\u001D/g, '');
        result.errors.push(`Tanınmayan GS1 alanı @${pos}: ${s.slice(pos, pos + 6)}`);
        break;
      }
      const spec = aiSpec(ai);
      pos += ai.length;
      let value: string;
      if (spec.fixed !== undefined) {
        value = s.substr(pos, spec.fixed);
        if (value.length !== spec.fixed) { result.errors.push(`AI (${ai}) eksik veri`); break; }
        pos += spec.fixed;
        if (spec.numeric && !/^\d+$/.test(value)) result.errors.push(`AI (${ai}) sayısal olmalı: ${value}`);
      } else {
        const { end, ambiguous } = findVariableEnd(s, ai, pos, spec, hasGS, parseable, result.ais);
        value = s.slice(pos, end);
        pos = end;
        if (ambiguous) result.ambiguous = true;
        if (!value) result.errors.push(`AI (${ai}) boş değer`);
      }
      applyAI(result, ai, value);
    }
    if (result.ambiguous) {
      const msg = 'Ayırıcı (GS) yok: Lot / Seri No sınırı kesin değil. Lütfen Lot ve Seri numarasını kutu üzerinden kontrol edip onaylayın.';
      result.warnings.push(msg);
      result.errors.push(msg);
    }
  }

  if (Object.keys(result.ais).length === 0) { result.errors.push('GS1 verisi bulunamadı'); return finalise(result); }
  result.type = result.sscc && !result.gtin ? 'SSCC' : 'GS1_DATAMATRIX';
  if (result.symbology === 'unknown' && result.type === 'GS1_DATAMATRIX') result.symbology = 'datamatrix';
  return finalise(result);
}

// ---------------------------------------------------------------------------
// Matching helpers (inventory ↔ scanned code)
// ---------------------------------------------------------------------------

/**
 * Canonical value to store in `InventoryItem.barcode`: the product GTIN (EAN-13 form when it
 * has a leading zero), never the raw 2D string that carries per-box serial/lot/SKT.
 */
export function canonicalBarcodeFromParsed(parsed: GS1ParseResult | null | undefined): string {
  if (!parsed) return '';
  if (parsed.gtin) {
    const g = parsed.gtin.padStart(14, '0');
    return g.startsWith('0') ? g.slice(1) : g;
  }
  if (parsed.sscc) return parsed.sscc;
  return sanitizeScannedText(parsed.raw).replace(/\u001D/g, '');
}

/** Normalised product key for comparisons (14-digit GTIN or trimmed custom code). */
export function scanKey(parsed: GS1ParseResult | null | undefined): string {
  if (!parsed) return '';
  if (parsed.gtin) return normalizeGtin(parsed.gtin);
  return normalizeGtin(sanitizeScannedText(parsed.raw).replace(/\u001D/g, ''));
}

/** True when an inventory/pesticide record's gtin/barcode matches the scanned code. */
export function itemMatchesScan(
  item: { gtin?: string; barcode?: string } | null | undefined,
  parsed: GS1ParseResult | null | undefined,
): boolean {
  if (!item || !parsed) return false;
  const key = scanKey(parsed);
  if (!key) return false;
  const candidates = [item.gtin, item.barcode].filter(Boolean) as string[];
  for (const c of candidates) {
    if (normalizeGtin(c) === key) return true;
    // Legacy rows stored the raw 2D GS1 string in `barcode`: compare its GTIN.
    if (c.length > 16) {
      const legacy = parseGS1Barcode(c);
      if (legacy.gtin && normalizeGtin(legacy.gtin) === key) return true;
    }
    if (parsed.type === 'RAW' && c.trim() === sanitizeScannedText(parsed.raw)) return true;
  }
  return false;
}

/** Finds the first live record matching the scan (GTIN-normalised). */
export function findItemByScan<T extends { gtin?: string; barcode?: string; deletedAt?: string }>(
  items: T[] | null | undefined,
  parsed: GS1ParseResult | null | undefined,
): T | undefined {
  if (!Array.isArray(items) || !parsed) return undefined;
  return items.find(i => i && !i.deletedAt && itemMatchesScan(i, parsed));
}


// ---------------------------------------------------------------------------
// Tank mix (phytotoxicity / incompatibility) engine
// ---------------------------------------------------------------------------

export interface TankMixInput { name: string; category?: string; activeIngredient?: string }

export interface TankMixWarning {
  severity: 'danger' | 'warning';
  items: [string, string];
  title: string;
  message: string;
}

export interface TankMixOrderStep { step: number; name: string; formulation: string }

export interface TankMixResult {
  compatible: boolean;
  warnings: TankMixWarning[];
  mixingOrder: TankMixOrderStep[];
}

const norm = (t: string | null | undefined): string => normalizeTurkish(t).replace(/ı/g, 'i');

type Tag = 'COPPER' | 'CALCIUM' | 'AMINO' | 'ALKALI' | 'OP' | 'SULFUR' | 'OIL' | 'HERBICIDE' | 'INSECTICIDE';

const TAG_KEYWORDS: Record<Tag, string[]> = {
  COPPER: ['bakir', 'copper', 'bordo', 'oksiklorur', 'oxychloride', 'hidroksit', 'hydroxide', 'cuso4'],
  CALCIUM: ['kalsiyum', 'calcium', 'cano3', 'kalsiyum nitrat'],
  AMINO: ['amino', 'aminoasit', 'amino asit', 'protein hidrolizat'],
  ALKALI: ['bordo', 'kirec', 'alkali', 'kirec kukurt', 'lime sulfur', 'lime sulphur', 'polisulfur'],
  OP: ['organofosfat', 'organik fosfor', 'organophosphate', 'chlorpyrifos', 'klorpirifos', 'dimethoate', 'dimetoat', 'malathion', 'malatiyon', 'diazinon', 'phosmet', 'fosmet', 'methidathion', 'metidatiyon', 'acephate', 'asefat'],
  SULFUR: ['kukurt', 'sulfur', 'sulphur', 'thiovit'],
  OIL: ['yazlik yag', 'beyaz yag', 'mineral yag', 'parafin yag', 'paraffin oil', 'summer oil', 'kislik yag'],
  HERBICIDE: ['herbisit', 'herbicide', 'yabanci ot', 'glyphosate', 'glifosat', '2,4-d', 'mcpa', 'paraquat', 'glufosinate', 'pendimethalin', 'tribenuron', 'nicosulfuron'],
  INSECTICIDE: ['insektisit', 'insecticide', 'akarisit', 'deltamethrin', 'deltametrin', 'acetamiprid', 'asetamiprid', 'abamectin', 'abamektin', 'cyhalothrin', 'sihalotrin', 'imidacloprid', 'imidakloprid', 'spinosad', 'chlorantraniliprole', 'klorantraniliprol', 'chlorpyrifos', 'klorpirifos'],
};

const MIX_RULES: { a: Tag; b: Tag; severity: 'danger' | 'warning'; title: string; message: string }[] = [
  { a: 'COPPER', b: 'CALCIUM', severity: 'danger', title: 'Bakır + Kalsiyum', message: 'Bakırlı preparatlar kalsiyumlu gübrelerle çökelti oluşturur, meme tıkanır ve yaprakta yanıklık (fitotoksisite) yapabilir.' },
  { a: 'COPPER', b: 'AMINO', severity: 'danger', title: 'Bakır + Aminoasit', message: 'Aminoasitler bakırı şelatlayıp bitkiye hızlı geçirir; ciddi yaprak/meyve yanıklığı riski vardır.' },
  { a: 'ALKALI', b: 'OP', severity: 'danger', title: 'Alkali (Bordo/Kireç) + Organofosfat', message: 'Alkali ortamda organik fosforlu insektisitler hidrolize olur ve etkinliğini kaybeder.' },
  { a: 'SULFUR', b: 'OIL', severity: 'danger', title: 'Kükürt + Yazlık Yağ', message: 'Kükürt ile yağ birlikte veya 3-4 hafta arayla uygulanmamalıdır; şiddetli yaprak yanıklığı yapar.' },
  { a: 'COPPER', b: 'OIL', severity: 'warning', title: 'Bakır + Yağ', message: 'Yağlar bakırın bitkiye nüfuzunu artırır; hassas çeşitlerde yanıklık görülebilir.' },
  { a: 'HERBICIDE', b: 'INSECTICIDE', severity: 'warning', title: 'Herbisit + İnsektisit', message: 'Herbisitler aynı tankta kültür bitkisi ilaçlarıyla karıştırılmamalıdır; ürüne zarar ve sürüklenme riski vardır. Ayrı pülverizatör kullanın.' },
];

// User-required order: SC -> WP/WG -> EC -> SL/SP
const FORMULATION_RANK: Record<string, number> = { SC: 1, FS: 1, CS: 1, SE: 1, WP: 2, WG: 2, WDG: 2, DF: 2, EC: 3, EW: 3, OD: 3, ME: 3, SL: 4, SP: 4, SG: 4 };

function detectFormulation(item: TankMixInput): string {
  const text = `${item.name} ${item.category ?? ''}`.toUpperCase();
  const m = text.match(/\b(WDG|SC|FS|CS|SE|WP|WG|DF|EC|EW|OD|ME|SL|SP|SG)\b/);
  return m ? m[1] : '';
}

function tagsOf(item: TankMixInput): Set<Tag> {
  const text = norm(`${item.name} ${item.category ?? ''} ${item.activeIngredient ?? ''}`);
  const tags = new Set<Tag>();
  (Object.keys(TAG_KEYWORDS) as Tag[]).forEach(tag => {
    if (TAG_KEYWORDS[tag].some(k => text.includes(k))) tags.add(tag);
  });
  return tags;
}

export function checkTankMixCompatibility(items: TankMixInput[]): TankMixResult {
  const list = (items ?? []).filter(i => i && i.name && i.name.trim());
  const tagged = list.map(i => ({ item: i, tags: tagsOf(i) }));
  const warnings: TankMixWarning[] = [];

  for (let i = 0; i < tagged.length; i++) {
    for (let j = i + 1; j < tagged.length; j++) {
      const x = tagged[i], y = tagged[j];
      for (const r of MIX_RULES) {
        if ((x.tags.has(r.a) && y.tags.has(r.b)) || (x.tags.has(r.b) && y.tags.has(r.a))) {
          warnings.push({ severity: r.severity, items: [x.item.name, y.item.name], title: r.title, message: r.message });
        }
      }
    }
  }

  const mixingOrder = list
    .map((item, idx) => ({ item, idx, f: detectFormulation(item) }))
    .sort((a, b) => (FORMULATION_RANK[a.f] ?? 5) - (FORMULATION_RANK[b.f] ?? 5) || a.idx - b.idx)
    .map((x, k) => ({ step: k + 1, name: x.item.name, formulation: x.f || 'Bilinmiyor' }));

  return { compatible: !warnings.some(w => w.severity === 'danger'), warnings, mixingOrder };
}

// ---------------------------------------------------------------------------
// Equivalent (muadil) product finder
// ---------------------------------------------------------------------------

export const ACTIVE_INGREDIENTS: { id: string; label: string; aliases: string[] }[] = [
  { id: 'deltamethrin', label: 'Deltamethrin', aliases: ['deltamethrin', 'deltametrin'] },
  { id: 'acetamiprid', label: 'Acetamiprid', aliases: ['acetamiprid', 'asetamiprid'] },
  { id: 'abamectin', label: 'Abamectin', aliases: ['abamectin', 'abamektin'] },
  { id: 'lambda-cyhalothrin', label: 'Lambda-cyhalothrin', aliases: ['lambda-cyhalothrin', 'lambda cyhalothrin', 'lambda-sihalotrin', 'lambda sihalotrin' ] },
  { id: 'glyphosate', label: 'Glyphosate', aliases: ['glyphosate', 'glifosat', 'glyfosat'] },
  { id: 'tebuconazole', label: 'Tebuconazole', aliases: ['tebuconazole', 'tebukonazol'] },
  { id: 'mancozeb', label: 'Mancozeb', aliases: ['mancozeb', 'mankozeb'] },
  { id: 'copper-oxychloride', label: 'Bakır Oksiklorür', aliases: ['bakir oksiklorur', 'copper oxychloride', 'oksiklorur'] },
  { id: 'azoxystrobin', label: 'Azoxystrobin', aliases: ['azoxystrobin', 'azoksistrobin'] },
  { id: 'imidacloprid', label: 'Imidacloprid', aliases: ['imidacloprid', 'imidakloprid'] },
  { id: 'spinosad', label: 'Spinosad', aliases: ['spinosad'] },
  { id: 'chlorantraniliprole', label: 'Chlorantraniliprole', aliases: ['chlorantraniliprole', 'klorantraniliprol', 'klorantranilipirol'] },
  { id: 'urea', label: 'Üre %46', aliases: ['ure', 'urea', '46-0-0', 'ure 46'] },
  { id: 'dap', label: 'DAP 18-46', aliases: ['dap', '18-46-0', '18-46', 'diamonyum fosfat'] },
  { id: 'map', label: 'MAP 12-61', aliases: ['map', '12-61-0', '12-61', 'monoamonyum fosfat'] },
  { id: 'potassium-nitrate', label: 'Potasyum Nitrat', aliases: ['potasyum nitrat', 'potassium nitrate', '13-0-46', 'kno3'] },
  { id: 'mkp', label: 'MKP 0-52-34', aliases: ['mkp', '0-52-34', 'monopotasyum fosfat'] },
];

const aliasRegex = new Map<string, RegExp>();
function hasAlias(text: string, alias: string): boolean {
  let re = aliasRegex.get(alias);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`);
    aliasRegex.set(alias, re);
  }
  return re.test(text);
}

function itemText(item: any): string {
  return norm([item?.pesticideName, item?.name, item?.activeIngredient, item?.category, item?.description].filter(Boolean).join(' '));
}

function ingredientsIn(text: string): string[] {
  return ACTIVE_INGREDIENTS.filter(ai => ai.aliases.some(a => hasAlias(text, a))).map(ai => ai.id);
}

export interface EquivalentMatch {
  item: any;
  name: string;
  ingredients: string[]; // labels
  quantity: number;
  inStock: boolean;
}

/**
 * Query may be an active ingredient or a product name. If it's a product name in
 * inventory, that product's ingredients are used. Returns in-stock items sharing ≥1 ingredient.
 */
export function findEquivalentProducts(searchQuery: string, inventory: any[]): EquivalentMatch[] {
  const q = norm(searchQuery);
  if (!q || !Array.isArray(inventory)) return [];
  const live = inventory.filter(i => i && !i.deletedAt);

  let wanted = ingredientsIn(q);
  const sourceItems = live.filter(i => norm(i.pesticideName ?? i.name).includes(q));
  if (wanted.length === 0) wanted = Array.from(new Set(sourceItems.flatMap(i => ingredientsIn(itemText(i)))));
  if (wanted.length === 0) return [];

  const labelOf = (id: string) => ACTIVE_INGREDIENTS.find(a => a.id === id)?.label ?? id;
  return live
    .map(item => {
      const shared = ingredientsIn(itemText(item)).filter(id => wanted.includes(id));
      const quantity = Number(item.quantity) || 0;
      return { item, name: String(item.pesticideName ?? item.name ?? ''), ingredients: shared.map(labelOf), quantity, inStock: quantity > 0 };
    })
    .filter(m => m.ingredients.length > 0 && m.inStock)
    .sort((a, b) => b.ingredients.length - a.ingredients.length || b.quantity - a.quantity);
}

// ---------------------------------------------------------------------------
// Ministry (BKTS / GTS) bulk export
// ---------------------------------------------------------------------------

/**
 * Export row shape. Accepts both the legacy export fields (`serialNo`, `lotNo`, `prescriptionNo`)
 * and the persistent `types.ts › MinistryRecord` fields (`serialNumber`, `lotNumber`, `documentNo`).
 */
export interface MinistryExportRecord {
  system?: 'BKTS' | 'BKST' | 'GTS' | 'BRECETE';
  recordType?: string;
  date?: string;
  farmerTcNo?: string;
  farmerName?: string;
  supplierName?: string;
  productName?: string;
  gtin?: string;
  serialNo?: string;
  serialNumber?: string;
  lotNo?: string;
  lotNumber?: string;
  expiryDate?: string; // ISO
  quantity?: number;
  unit?: string;
  senderGln?: string;
  receiverGln?: string;
  prescriptionNo?: string;
  documentNo?: string;
  bReceteCode?: string;
  sscc?: string;
  waybillNo?: string;
  status?: string;
  deletedAt?: string;
}

/** @deprecated kept for backwards compatibility – use MinistryExportRecord. */
export type MinistryRecord = MinistryExportRecord;

export interface MinistryExportFile { fileName: string; mimeType: string; content: string }

export const FREE_SALE_STATUS = 'Kayıtsız Serbest Satış';

// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
export const xmlEsc = (v: unknown): string =>
  String(v ?? '')
    .replace(XML_INVALID, '')
    .replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));

export const csvEsc = (v: unknown): string => {
  // eslint-disable-next-line no-control-regex
  let s = String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // CSV/Excel formula injection guard
  return /[;",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const lotOf = (r: MinistryExportRecord) => r.lotNumber ?? r.lotNo ?? '';
const serialOf = (r: MinistryExportRecord) => r.serialNumber ?? r.serialNo ?? '';
const docOf = (r: MinistryExportRecord) => r.prescriptionNo ?? r.documentNo ?? '';
const sysOf = (r: MinistryExportRecord) => (r.system === 'BKST' || !r.system ? 'BKTS' : r.system);

/** Official export never includes unregistered free sales or deleted rows. */
export function filterOfficialMinistryRecords<T extends MinistryExportRecord>(records: T[] | null | undefined): T[] {
  return (Array.isArray(records) ? records : []).filter(r => r && !r.deletedAt && r.status !== FREE_SALE_STATUS);
}

/** GS1 human-readable element string for a unit: (01)GTIN(21)SN(17)YYMMDD(10)LOT */
export function buildGS1ElementString(r: MinistryExportRecord): string {
  const serial = serialOf(r);
  const lot = lotOf(r);
  return [
    r.gtin ? `(01)${r.gtin.padStart(14, '0')}` : '',
    serial ? `(21)${serial}` : '',
    r.expiryDate ? `(17)${isoToGS1Date(r.expiryDate)}` : '',
    lot ? `(10)${lot}` : '',
  ].join('');
}

/**
 * Builds a bulk notification payload. Field names follow BKTS/GTS "satış bildirimi" semantics;
 * shortcut: generic schema, not the ministry WSDL — map tags to the official XSD when the web service contract is provided.
 * 'Kayıtsız Serbest Satış' rows are always excluded from the official export.
 */
export function generateMinistryExportFile(records: any[], format: 'xml' | 'txt' | 'csv'): MinistryExportFile {
  const rows: MinistryExportRecord[] = filterOfficialMinistryRecords(records as MinistryExportRecord[]);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  if (format === 'xml') {
    const body = rows.map(r => [
      '    <Bildirim>',
      `      <Sistem>${xmlEsc(sysOf(r))}</Sistem>`,
      `      <KayitTuru>${xmlEsc(r.recordType ?? '')}</KayitTuru>`,
      `      <Tarih>${xmlEsc(r.date ?? '')}</Tarih>`,
      `      <GonderenGLN>${xmlEsc(r.senderGln ?? '')}</GonderenGLN>`,
      `      <AliciGLN>${xmlEsc(r.receiverGln ?? '')}</AliciGLN>`,
      `      <AliciTCKN>${xmlEsc(r.farmerTcNo ?? '')}</AliciTCKN>`,
      `      <AliciAdSoyad>${xmlEsc(r.farmerName ?? '')}</AliciAdSoyad>`,
      `      <Tedarikci>${xmlEsc(r.supplierName ?? '')}</Tedarikci>`,
      `      <UrunAdi>${xmlEsc(r.productName ?? '')}</UrunAdi>`,
      `      <GTIN>${xmlEsc(r.gtin ?? '')}</GTIN>`,
      `      <SeriNo>${xmlEsc(serialOf(r))}</SeriNo>`,
      `      <PartiNo>${xmlEsc(lotOf(r))}</PartiNo>`,
      `      <SonKullanmaTarihi>${xmlEsc(r.expiryDate ?? '')}</SonKullanmaTarihi>`,
      `      <Miktar>${xmlEsc(r.quantity ?? 1)}</Miktar>`,
      `      <Birim>${xmlEsc(r.unit ?? 'Adet')}</Birim>`,
      `      <BelgeNo>${xmlEsc(docOf(r))}</BelgeNo>`,
      `      <BReceteKodu>${xmlEsc(r.bReceteCode ?? '')}</BReceteKodu>`,
      `      <SSCC>${xmlEsc(r.sscc ?? '')}</SSCC>`,
      `      <IrsaliyeNo>${xmlEsc(r.waybillNo ?? '')}</IrsaliyeNo>`,
      '    </Bildirim>',
    ].join('\n')).join('\n');
    return {
      fileName: `bkts_gts_bildirim_${stamp}.xml`,
      mimeType: 'application/xml;charset=utf-8',
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<!-- MKS dışa aktarım dosyası: Bakanlık servisine otomatik gönderim yapılmamıştır. -->\n<TopluBildirim olusturmaTarihi="${xmlEsc(new Date().toISOString())}" kayitSayisi="${rows.length}">\n  <Bildirimler>\n${body}\n  </Bildirimler>\n</TopluBildirim>\n`,
    };
  }

  if (format === 'txt') {
    return {
      fileName: `karekod_listesi_${stamp}.txt`,
      mimeType: 'text/plain;charset=utf-8',
      content: rows.map(buildGS1ElementString).filter(Boolean).join('\r\n') + '\r\n',
    };
  }

  const header = ['Sistem', 'Kayıt Türü', 'Tarih', 'TCKN', 'Ad Soyad', 'Tedarikçi', 'Ürün', 'GTIN', 'Seri No', 'Parti/Lot', 'SKT', 'Miktar', 'Birim', 'Gönderen GLN', 'Alıcı GLN', 'Belge No', 'B-Reçete', 'SSCC', 'Durum'];
  const lines = rows.map(r => [
    sysOf(r), r.recordType, r.date, r.farmerTcNo, r.farmerName, r.supplierName, r.productName, r.gtin, serialOf(r), lotOf(r),
    r.expiryDate, r.quantity, r.unit, r.senderGln, r.receiverGln, docOf(r), r.bReceteCode, r.sscc, r.status,
  ].map(csvEsc).join(';'));
  return {
    fileName: `bkts_gts_bildirim_${stamp}.csv`,
    mimeType: 'text/csv;charset=utf-8',
    content: '\uFEFF' + [header.join(';'), ...lines].join('\r\n') + '\r\n', // BOM so Excel (TR) reads UTF-8
  };
}

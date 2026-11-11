/**
 * Persistent BKTS / GTS / B-Reçete store helpers.
 *
 * Primary storage is IndexedDB via `dbService` (`getMinistryRecords`, `saveMinistryRecord`,
 * `saveMinistryRecordsBatch`, `getMinistryShipments`, `saveMinistryShipment`, `nextDocumentCounter`).
 * Those methods are called defensively (`(dbService as any).x?.()`) and a user-scoped localStorage
 * mirror is used as a fallback so records are never silently lost.
 */
import { dbService } from '../services/db';
import { auth } from '../services/firebase';
import type { MinistryRecord, MinistryShipmentRecord } from '../types';

const db = dbService as any;

const uidKey = () => auth?.currentUser?.uid || 'guest';
const RECORDS_KEY = () => `mks_ministry_records_v1_${uidKey()}`;
const SHIPMENTS_KEY = () => `mks_ministry_shipments_v1_${uidKey()}`;
const COUNTER_KEY = (prefix: string, year: number) => `mks_doc_counter_${uidKey()}_${prefix}_${year}`;

export interface StoreWriteResult {
  ok: boolean;
  storage: 'indexeddb' | 'local' | 'none';
  error?: string;
}

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[ministryStore] local read failed', key, e);
    return [];
  }
}

function writeLocal<T extends { id: string }>(key: string, rows: T[]): boolean {
  try {
    const existing = readLocal<T>(key);
    const map = new Map<string, T>(existing.map(r => [r.id, r]));
    rows.forEach(r => map.set(r.id, r));
    localStorage.setItem(key, JSON.stringify(Array.from(map.values())));
    return true;
  } catch (e) {
    console.error('[ministryStore] local write failed', key, e);
    return false;
  }
}

function mergeById<T extends { id: string; lastUpdated?: string }>(...lists: (T[] | null | undefined)[]): T[] {
  const map = new Map<string, T>();
  for (const list of lists) {
    for (const row of list || []) {
      if (!row || !row.id) continue;
      const prev = map.get(row.id);
      if (!prev || String(row.lastUpdated || '') >= String(prev.lastUpdated || '')) map.set(row.id, row);
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Ministry records (satış / mal kabul defteri)
// ---------------------------------------------------------------------------

export async function loadMinistryRecords(extra?: MinistryRecord[]): Promise<MinistryRecord[]> {
  let fromDb: MinistryRecord[] = [];
  try {
    if (typeof db.getMinistryRecords === 'function') fromDb = (await db.getMinistryRecords()) || [];
  } catch (e) {
    console.warn('[ministryStore] getMinistryRecords failed', e);
  }
  return mergeById(readLocal<MinistryRecord>(RECORDS_KEY()), fromDb, extra).filter(r => !r.deletedAt);
}

export async function saveMinistryRecords(records: MinistryRecord[]): Promise<StoreWriteResult> {
  const rows = (records || []).filter(Boolean).map(r => ({ ...r, lastUpdated: r.lastUpdated || new Date().toISOString() }));
  if (rows.length === 0) return { ok: true, storage: 'none' };
  try {
    if (typeof db.saveMinistryRecordsBatch === 'function') {
      await db.saveMinistryRecordsBatch(rows);
      return { ok: true, storage: 'indexeddb' };
    }
    if (typeof db.saveMinistryRecord === 'function') {
      for (const r of rows) await db.saveMinistryRecord(r);
      return { ok: true, storage: 'indexeddb' };
    }
  } catch (e: any) {
    console.error('[ministryStore] IndexedDB save failed, falling back to local mirror', e);
    const ok = writeLocal(RECORDS_KEY(), rows);
    return { ok, storage: ok ? 'local' : 'none', error: e?.message || String(e) };
  }
  const ok = writeLocal(RECORDS_KEY(), rows);
  return { ok, storage: ok ? 'local' : 'none', error: ok ? undefined : 'Yerel depolama yazılamadı' };
}

// ---------------------------------------------------------------------------
// Shipments (SSCC koli / irsaliye mal kabul)
// ---------------------------------------------------------------------------

export async function loadMinistryShipments(extra?: MinistryShipmentRecord[]): Promise<MinistryShipmentRecord[]> {
  let fromDb: MinistryShipmentRecord[] = [];
  try {
    if (typeof db.getMinistryShipments === 'function') fromDb = (await db.getMinistryShipments()) || [];
  } catch (e) {
    console.warn('[ministryStore] getMinistryShipments failed', e);
  }
  return mergeById(readLocal<MinistryShipmentRecord>(SHIPMENTS_KEY()), fromDb, extra).filter(s => !s.deletedAt);
}

export async function saveMinistryShipmentRecord(rec: MinistryShipmentRecord): Promise<StoreWriteResult> {
  const row = { ...rec, lastUpdated: new Date().toISOString() };
  try {
    if (typeof db.saveMinistryShipment === 'function') {
      await db.saveMinistryShipment(row);
      return { ok: true, storage: 'indexeddb' };
    }
  } catch (e: any) {
    console.error('[ministryStore] saveMinistryShipment failed, falling back to local mirror', e);
    const ok = writeLocal(SHIPMENTS_KEY(), [row]);
    return { ok, storage: ok ? 'local' : 'none', error: e?.message || String(e) };
  }
  const ok = writeLocal(SHIPMENTS_KEY(), [row]);
  return { ok, storage: ok ? 'local' : 'none', error: ok ? undefined : 'Yerel depolama yazılamadı' };
}

// ---------------------------------------------------------------------------
// Sequential document numbers (REC-YYYY-0001)
// ---------------------------------------------------------------------------

/**
 * Returns the next sequential document number `PREFIX-YYYY-NNNN`.
 * Uses `dbService.nextDocumentCounter(prefix, year)` (IndexedDB transaction) when available;
 * otherwise a local per-user counter that is collision-checked against `existingNumbers`.
 */
export async function nextDocumentNumber(prefix: string, existingNumbers: Iterable<string> = []): Promise<string> {
  const year = new Date().getFullYear();
  const taken = new Set<string>(Array.from(existingNumbers || []).filter(Boolean).map(String));
  const fmt = (n: number) => `${prefix}-${year}-${String(n).padStart(4, '0')}`;

  try {
    if (typeof db.nextDocumentCounter === 'function') {
      const res = await db.nextDocumentCounter(prefix, year);
      if (typeof res === 'string' && res.trim()) {
        if (!taken.has(res)) return res;
      } else if (Number.isFinite(Number(res)) && Number(res) > 0) {
        let n = Number(res);
        let candidate = fmt(n);
        let guard = 0;
        while (taken.has(candidate) && guard++ < 10000) candidate = fmt(++n);
        return candidate;
      }
    }
  } catch (e) {
    console.warn('[ministryStore] nextDocumentCounter failed, using local counter', e);
  }

  // Local fallback: max(existing for this year, stored counter) + 1
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let maxExisting = 0;
  taken.forEach(t => {
    const m = re.exec(t);
    if (m) maxExisting = Math.max(maxExisting, Number(m[1]));
  });
  let stored = 0;
  try { stored = Number(localStorage.getItem(COUNTER_KEY(prefix, year)) || 0) || 0; } catch { /* storage unavailable */ }
  let n = Math.max(maxExisting, stored) + 1;
  let candidate = fmt(n);
  let guard = 0;
  while (taken.has(candidate) && guard++ < 10000) candidate = fmt(++n);
  try { localStorage.setItem(COUNTER_KEY(prefix, year), String(n)); } catch (e) { console.warn('[ministryStore] counter persist failed', e); }
  return candidate;
}

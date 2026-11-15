import { openDB, IDBPDatabase } from 'idb';
import { Capacitor } from '@capacitor/core';
import { getLocalDateString } from './dateUtils';

/**
 * Uygulama içi kalıcı PDF arşivi.
 * Üretilen her PDF (indirme, paylaşma, yazdırma fark etmeksizin) hem anlık bellek
 * önbelleğine hem cihazın IndexedDB deposuna kaydedilir; böylece telefon, tablet,
 * web ve masaüstünde "PDF Belgeleri" listesi her zaman gecikmesiz dolar.
 */
export interface ArchivedPdf {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  blob: Blob;
  category?: string;
}

interface StoredArchivedPdfRow {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  category?: string;
  bytes?: ArrayBuffer;
  blob?: Blob;
}

const DB_NAME = 'mks-pdf-archive';
const STORE = 'files';
const MAX_ITEMS = 60;
const PDF_HISTORY_STORAGE_KEY = 'mks_pdf_history';
export const PDF_ARCHIVE_EVENT = 'mks-pdf-archived';

const memoryArchive = new Map<string, ArchivedPdf>();

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

export function inferPdfCategory(name: string): string {
  const n = (name || '').toLocaleLowerCase('tr-TR');
  if (n.includes('mutabakat')) return 'Mutabakat';
  if (n.includes('tahsilat') || n.includes('makbuz') || n.includes('dekont')) return 'Tahsilat Makbuzu';
  if (n.includes('recete') || n.includes('receti') || n.includes('satis') || n.includes('iade') || n.includes('fatura')) {
    return 'Fatura / Reçete';
  }
  if (n.includes('ekstre') || n.includes('cari')) return 'Cari Ekstre & Rapor';
  if (n.includes('depo') || n.includes('stok') || n.includes('urun') || n.includes('siparis')) return 'Depo & Stok';
  if (n.includes('bkts') || n.includes('gts') || n.includes('denetim') || n.includes('efatura')) return 'Resmî Denetim';
  return 'Genel Rapor';
}

function normalizePdfFileName(name: string): string {
  const trimmed = (name || `MKS_Belge_${getLocalDateString()}.pdf`).trim();
  if (!trimmed) return `MKS_Belge_${getLocalDateString()}.pdf`;
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
}

function emitPdfArchiveEvent(detail?: { name?: string; size?: number }) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(PDF_ARCHIVE_EVENT, { detail }));
  } catch {}
}

function recordLocalPdfHistory(cleanName: string, sizeBytes: number) {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    const raw = window.localStorage.getItem(PDF_HISTORY_STORAGE_KEY) || '[]';
    const parsed = JSON.parse(raw);
    const list: Array<{ name: string; path: string; size: number; date: string; timestamp?: number }> = Array.isArray(parsed)
      ? parsed
      : [];
    const now = new Date();
    const formattedDate =
      now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const newItem = {
      name: cleanName,
      path: cleanName,
      size: sizeBytes > 0 ? sizeBytes : 48500,
      date: formattedDate,
      timestamp: Date.now()
    };

    const deduped = [
      newItem,
      ...list.filter(item => (item?.name || '').toLowerCase() !== cleanName.toLowerCase())
    ].slice(0, 50);
    window.localStorage.setItem(PDF_HISTORY_STORAGE_KEY, JSON.stringify(deduped));
  } catch {}
}

function removeFromLocalPdfHistory(name?: string, clearAll = false) {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    if (clearAll) {
      window.localStorage.removeItem(PDF_HISTORY_STORAGE_KEY);
      return;
    }
    if (!name) return;
    const raw = window.localStorage.getItem(PDF_HISTORY_STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const next = list.filter((item: any) => (item?.name || '').toLowerCase() !== name.toLowerCase());
    window.localStorage.setItem(PDF_HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export async function archivePdf(name: string, blob: Blob): Promise<void> {
  try {
    if (!blob || blob.size === 0) return;
    const cleanName = normalizePdfFileName(name);
    const category = inferPdfCategory(cleanName);
    const now = Date.now();
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    // 1. Aynı adlı eski bellek kaydını temizle ve yenisini senkron olarak en üste ekle (0ms gecikme)
    const cleanLower = cleanName.toLowerCase();
    for (const [key, item] of memoryArchive.entries()) {
      if (item.name.toLowerCase() === cleanLower) {
        memoryArchive.delete(key);
      }
    }
    if (memoryArchive.size >= MAX_ITEMS) {
      const oldest = Array.from(memoryArchive.values()).sort((a, b) => a.timestamp - b.timestamp);
      for (const extra of oldest.slice(0, memoryArchive.size - MAX_ITEMS + 1)) {
        memoryArchive.delete(extra.id);
      }
    }

    const normalizedBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const entry: ArchivedPdf = {
      id,
      name: cleanName,
      size: normalizedBlob.size,
      timestamp: now,
      blob: normalizedBlob,
      category
    };
    memoryArchive.set(id, entry);

    // 2. İndirme geçmişini ve arayüzü senkron bilgilendir
    recordLocalPdfHistory(cleanName, normalizedBlob.size);
    emitPdfArchiveEvent({ name: cleanName, size: normalizedBlob.size });

    // 3. Kalıcı IndexedDB deposuna ArrayBuffer olarak kaydet (web / mobil WebView uyumlu)
    if (typeof indexedDB === 'undefined') return;
    const bytes = await normalizedBlob.arrayBuffer();
    const db = await getDb();
    const all = (await db.getAll(STORE)) as StoredArchivedPdfRow[];
    const tx = db.transaction(STORE, 'readwrite');

    for (const old of all.filter(f => (f.name || '').toLowerCase() === cleanLower)) {
      void tx.store.delete(old.id);
    }
    const rest = all
      .filter(f => (f.name || '').toLowerCase() !== cleanLower)
      .sort((a, b) => b.timestamp - a.timestamp);
    for (const extra of rest.slice(MAX_ITEMS - 1)) {
      void tx.store.delete(extra.id);
    }

    const row: StoredArchivedPdfRow = {
      id,
      name: cleanName,
      size: normalizedBlob.size,
      timestamp: now,
      category,
      bytes
    };
    void tx.store.put(row);
    await tx.done;

    emitPdfArchiveEvent({ name: cleanName, size: normalizedBlob.size });
  } catch (err) {
    console.warn('PDF arşive eklenemedi:', err);
  }
}

/** En yeni en üstte olacak şekilde tarih sırasıyla döner. */
export async function listArchivedPdfs(): Promise<ArchivedPdf[]> {
  const byName = new Map<string, ArchivedPdf>();

  // 1. Önce bellek önbelleğindeki anlık kayıtları al
  for (const item of memoryArchive.values()) {
    const key = item.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev || item.timestamp >= prev.timestamp) {
      byName.set(key, item);
    }
  }

  // 2. Kalıcı IndexedDB kayıtlarıyla birleştir (yeniden yüklemelerde belleği de tazele)
  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await getDb();
      const rows = (await db.getAll(STORE)) as StoredArchivedPdfRow[];
      for (const row of rows) {
        if (!row || !row.name) continue;
        let reconstructedBlob: Blob | null = null;
        if (row.bytes && row.bytes.byteLength > 0) {
          reconstructedBlob = new Blob([row.bytes], { type: 'application/pdf' });
        } else if (row.blob && row.blob.size > 0) {
          reconstructedBlob =
            row.blob.type === 'application/pdf' ? row.blob : new Blob([row.blob], { type: 'application/pdf' });
        }
        if (!reconstructedBlob || reconstructedBlob.size === 0) continue;

        const restored: ArchivedPdf = {
          id: row.id,
          name: row.name,
          size: row.size || reconstructedBlob.size,
          timestamp: row.timestamp || Date.now(),
          blob: reconstructedBlob,
          category: row.category || inferPdfCategory(row.name)
        };

        if (!memoryArchive.has(restored.id)) {
          memoryArchive.set(restored.id, restored);
        }

        const key = restored.name.toLowerCase();
        const prev = byName.get(key);
        if (!prev || restored.timestamp > prev.timestamp) {
          byName.set(key, restored);
        }
      }
    } catch {}
  }

  return Array.from(byName.values()).sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteArchivedPdf(id: string): Promise<void> {
  try {
    let deletedName: string | undefined;
    const memItem = memoryArchive.get(id);
    if (memItem) {
      deletedName = memItem.name;
      memoryArchive.delete(id);
    }
    if (typeof indexedDB !== 'undefined') {
      const db = await getDb();
      if (!deletedName) {
        const existing = (await db.get(STORE, id)) as StoredArchivedPdfRow | undefined;
        deletedName = existing?.name;
      }
      await db.delete(STORE, id);
    }
    removeFromLocalPdfHistory(deletedName, false);
    emitPdfArchiveEvent();
  } catch {}
}

export async function clearArchivedPdfs(): Promise<void> {
  try {
    memoryArchive.clear();
    if (typeof indexedDB !== 'undefined') {
      const db = await getDb();
      await db.clear(STORE);
    }
    removeFromLocalPdfHistory(undefined, true);
    emitPdfArchiveEvent();
  } catch {}
}

interface MksNativeBridge {
  begin(name: string): boolean;
  append(chunkBase64: string): boolean;
  finish(mode: string): boolean;
}

function getAndroidBridge(): MksNativeBridge | null {
  if (typeof window === 'undefined') return null;
  const b = (window as any).MksNative as MksNativeBridge | undefined;
  return b && typeof b.begin === 'function' ? b : null;
}

export function hasNativePdfBridge(): boolean {
  return typeof window !== 'undefined' && !!getAndroidBridge();
}

async function sendToAndroid(name: string, blob: Blob, mode: 'open' | 'share'): Promise<boolean> {
  const bridge = getAndroidBridge();
  if (!bridge) return false;
  try {
    if (!bridge.begin(name)) return false;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const CHUNK = 384 * 1024; // 3'ün katı: base64 parçaları dolgusuz birleşir
    for (let offset = 0; offset < bytes.length; offset += CHUNK) {
      const slice = bytes.subarray(offset, offset + CHUNK);
      let binary = '';
      for (let i = 0; i < slice.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, slice.subarray(i, i + 0x8000) as unknown as number[]);
      }
      if (!bridge.append(btoa(binary))) return false;
    }
    return bridge.finish(mode);
  } catch (err) {
    console.warn('Yerel PDF köprüsü başarısız:', err);
    return false;
  }
}

/**
 * PDF Blob içeriğini doğrudan cihaza/bilgisayara indirir.
 */
export function downloadPdfBlob(name: string, blob: Blob): boolean {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const cleanName = normalizePdfFileName(name);
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Arşivdeki PDF belgesini gizli bir iframe ile doğrudan yazdırır (desteklenmezse yeni sekmede açar).
 */
export function printPdfBlob(name: string, blob: Blob): boolean {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    iframe.src = url;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      setTimeout(() => {
        try {
          iframe.remove();
          URL.revokeObjectURL(url);
        } catch {}
      }, 3000);
    };

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
          void openPdfBlob(name, blob, 'open');
          cleanup();
          return;
        }
        win.focus();
        win.print();
        setTimeout(cleanup, 60_000);
      } catch {
        void openPdfBlob(name, blob, 'open');
        cleanup();
      }
    };

    document.body.appendChild(iframe);
    return true;
  } catch {
    void openPdfBlob(name, blob, 'open');
    return false;
  }
}

/**
 * Bir PDF'i cihazda açar ya da paylaşır.
 * Android: yerel köprü (PDF görüntüleyici / paylaş menüsü). iOS: sistem paylaşım sayfası.
 * Web ve masaüstü: yeni sekmede açar (pop-up engellenirse indirir).
 */
export async function openPdfBlob(name: string, blob: Blob, mode: 'open' | 'share' = 'open'): Promise<boolean> {
  const cleanName = normalizePdfFileName(name);
  if (await sendToAndroid(cleanName, blob, mode)) return true;

  const file = new File([blob], cleanName, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
  const canShareFile =
    typeof nav !== 'undefined' &&
    typeof nav.share === 'function' &&
    typeof nav.canShare === 'function' &&
    nav.canShare({ files: [file] });

  if (canShareFile && (mode === 'share' || Capacitor.isNativePlatform())) {
    try {
      await nav.share({ files: [file], title: cleanName });
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    const win = Capacitor.isNativePlatform() ? null : window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    return false;
  }
}

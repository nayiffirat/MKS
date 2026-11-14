import { openDB, IDBPDatabase } from 'idb';
import { Capacitor } from '@capacitor/core';

/**
 * Uygulama içi kalıcı PDF arşivi.
 * Üretilen her PDF (indirme, paylaşma, yazdırma fark etmeksizin) cihazın IndexedDB deposuna
 * kaydedilir; böylece telefon, tablet, web ve masaüstünde "PDF Belgeleri" listesi her zaman dolar.
 */
export interface ArchivedPdf {
  id: string;
  name: string;
  size: number;
  timestamp: number;
  blob: Blob;
}

const DB_NAME = 'mks-pdf-archive';
const STORE = 'files';
const MAX_ITEMS = 60;
export const PDF_ARCHIVE_EVENT = 'mks-pdf-archived';

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

export async function archivePdf(name: string, blob: Blob): Promise<void> {
  try {
    if (typeof indexedDB === 'undefined' || !blob || blob.size === 0) return;
    const cleanName = (name || `MKS_Belge_${new Date().toISOString().slice(0, 10)}.pdf`).trim();
    const db = await getDb();
    const all = (await db.getAll(STORE)) as ArchivedPdf[];
    const tx = db.transaction(STORE, 'readwrite');
    // Aynı adlı eski kopyayı yenisiyle değiştir (belge düzenlenip tekrar alındıysa en üste çıkar)
    for (const old of all.filter(f => f.name === cleanName)) {
      void tx.store.delete(old.id);
    }
    const rest = all.filter(f => f.name !== cleanName).sort((a, b) => b.timestamp - a.timestamp);
    for (const extra of rest.slice(MAX_ITEMS - 1)) {
      void tx.store.delete(extra.id);
    }
    const now = Date.now();
    void tx.store.put({
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      size: blob.size,
      timestamp: now,
      blob
    } as ArchivedPdf);
    await tx.done;
    window.dispatchEvent(new CustomEvent(PDF_ARCHIVE_EVENT));
  } catch (err) {
    console.warn('PDF arşive eklenemedi:', err);
  }
}

/** En yeni en üstte olacak şekilde tarih sırasıyla döner. */
export async function listArchivedPdfs(): Promise<ArchivedPdf[]> {
  try {
    if (typeof indexedDB === 'undefined') return [];
    const db = await getDb();
    const all = (await db.getAll(STORE)) as ArchivedPdf[];
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export async function deleteArchivedPdf(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, id);
  } catch {}
}

interface MksNativeBridge {
  begin(name: string): boolean;
  append(chunkBase64: string): boolean;
  finish(mode: string): boolean;
}

function getAndroidBridge(): MksNativeBridge | null {
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
 * Bir PDF'i cihazda açar ya da paylaşır.
 * Android: yerel köprü (PDF görüntüleyici / paylaş menüsü). iOS: sistem paylaşım sayfası.
 * Web ve masaüstü: yeni sekmede açar.
 */
export async function openPdfBlob(name: string, blob: Blob, mode: 'open' | 'share' = 'open'): Promise<boolean> {
  if (await sendToAndroid(name, blob, mode)) return true;

  const file = new File([blob], name, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
  const canShareFile = typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });

  if (canShareFile && (mode === 'share' || Capacitor.isNativePlatform())) {
    try {
      await nav.share({ files: [file], title: name });
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
      a.download = name;
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

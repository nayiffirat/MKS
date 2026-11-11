/**
 * MKS Çoklu Depo & EDM e-Fatura / BKTS / GTS Stok Ayrıştırma Yöneticisi
 * ----------------------------------------------------------------------
 * Kullanıcı bazlı (UID izole) resmi e-Fatura, BKTS ve GTS depo yönetimi.
 * Yeni açılan her hesap %100 tertemiz ve sıfır sahte/demo veri ile başlar.
 */

import { auth } from '../services/firebase';
import { dbService } from '../services/db';
import { round4 } from './dateUtils';

export type WarehouseSourceType = 'SYSTEM' | 'EFATURA' | 'BKTS' | 'GTS';

export type IncomingRoutingAction =
  | 'EFATURA_ONLY'
  | 'BOTH_EFATURA_AND_SYSTEM'
  | 'BKTS_GTS_ONLY';

export interface OfficialWarehouseItem {
  id: string;
  productName: string;
  barcode?: string;
  gtin?: string;
  category: 'PESTICIDE' | 'FERTILIZER' | 'SEED' | 'OTHER';
  unit: 'Adet' | 'Litre' | 'Kg' | 'Torba' | 'Koli';
  vatRate: number;
  purchasePrice: number;
  salePrice: number;
  /** Resmi e-Fatura ile giren ve henüz faturası kesilmemiş stok miktarı */
  efaturaStock: number;
  /** BKTS (Bitki Koruma Ürünleri Takip Sistemi) resmi bildirimli stok miktarı */
  bktsStock: number;
  /** Geriye dönük alan uyumluluğu */
  bkstStock?: number;
  /** GTS (Gübre Takip Sistemi) resmi bildirimli stok miktarı */
  gtsStock: number;
  /** Sistem Deposu ile eşleştirilmiş ürün ID'si (varsa) */
  linkedSystemInventoryId?: string;
  /**
   * "Sadece e-Fatura Deposu" ile girip henüz fiziki Sistem Deposuna aktarılmamış miktar.
   * Tanımsızsa (eski kayıt) bir kez `efaturaStock` kadar aktarılabilir kabul edilir.
   */
  pendingSystemTransferQty?: number;
  /** Bugüne kadar fiziki Sistem Deposuna aktarılan toplam miktar (tekrar aktarım koruması) */
  systemTransferredQty?: number;
  lastSystemTransferAt?: string;
  lastInvoiceNo?: string;
  lastSupplierName?: string;
  updatedAt: string;
}

export interface IncomingEdmInvoiceLine {
  id: string;
  productName: string;
  barcode?: string;
  gtin?: string;
  quantity: number;
  unit: 'Adet' | 'Litre' | 'Kg' | 'Torba' | 'Koli';
  unitPrice: number;
  discountRates?: number[];
  vatRate: number;
  category: 'PESTICIDE' | 'FERTILIZER' | 'SEED' | 'OTHER';
  routingMode: 'EFATURA_ONLY' | 'TRANSFER_TO_SYSTEM';
  ministryBadge?: 'BKTS' | 'BKST' | 'GTS' | 'NONE';
}

export interface IncomingEdmInvoice {
  id: string;
  ettn: string;
  invoiceNo: string;
  supplierName: string;
  supplierVkn: string;
  issueDate: string;
  invoiceType: 'SATIS' | 'ISTISNA' | 'IADE';
  /** PROCESSING: işlem sürüyor (çift dokunma / yarım kalan işlem koruması) */
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED';
  processedSummary?: string;
  /** Son işlem denemesinde oluşan hata (kullanıcıya dürüstçe gösterilir) */
  lastError?: string;
  lines: IncomingEdmInvoiceLine[];
}

export interface OutgoingEdmInvoiceRecord {
  id: string;
  ettn: string;
  invoiceNo: string;
  documentType: 'EFATURA' | 'EARSIV' | 'EMUSTAHSIL' | 'EIRSALIYE';
  customerName: string;
  customerTaxOrTcNo: string;
  issueDate: string;
  totalAmount: number;
  totalVat: number;
  /** KDV hariç satır toplamları (satır bazlı yuvarlanmış) */
  totalNet?: number;
  /**
   * DRAFT: Yalnız yerel taslak — resmi GİB/entegratör gönderimi YAPILMADI.
   * PENDING_SEND / SENT: gerçek entegratör bağlantısı geldiğinde kullanılacak.
   */
  status?: 'DRAFT' | 'PENDING_SEND' | 'SENT';
  deductedFromSystemStock: boolean;
  lines: {
    officialItemId: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    vatRate: number;
    lineNet?: number;
    lineVat?: number;
  }[];
}

/** Resmi entegratör çağrısı henüz yok: tüm giden belgeler yerel TASLAK'tır. */
export const EDM_DRAFT_LABEL = 'TASLAK BELGE — Resmi GİB Entegrasyonu Aktif Değil';

export type EInvoiceProviderId =
  | 'EDM'
  | 'QNB_EFINANS'
  | 'UYUMSOFT'
  | 'ELOGO'
  | 'MIKRO_ZIRVE'
  | 'SOVOS_FORIBA'
  | 'IZIBIZ'
  | 'DIGITAL_PLANET'
  | 'TURKKEP'
  | 'GIB_PORTAL';

export const EINVOICE_PROVIDERS: { id: EInvoiceProviderId; name: string; endpointHint: string }[] = [
  { id: 'EDM', name: 'EDM Bilişim (E-Dönüşüm Merkezi)', endpointHint: 'portal.edmbilisim.com.tr' },
  { id: 'QNB_EFINANS', name: 'QNB eFinans (QNB Finansbank)', endpointHint: 'portal.efinans.com.tr' },
  { id: 'UYUMSOFT', name: 'Uyumsoft e-Uyum (İdea)', endpointHint: 'efatura.uyumsoft.com.tr' },
  { id: 'ELOGO', name: 'Logo Yazılım (e-Logo)', endpointHint: 'pb.elogo.com.tr' },
  { id: 'MIKRO_ZIRVE', name: 'Zirve / Mikro / Paraşüt (e-Mikro)', endpointHint: 'emikro.com.tr' },
  { id: 'SOVOS_FORIBA', name: 'Sovos Foriba (FIT Solutions)', endpointHint: 'bulut.foriba.com' },
  { id: 'IZIBIZ', name: 'İzibiz Bilişim Özel Entegratör', endpointHint: 'portal.izibiz.com.tr' },
  { id: 'DIGITAL_PLANET', name: 'Digital Planet (Netbt)', endpointHint: 'efatura.digitalplanet.com.tr' },
  { id: 'TURKKEP', name: 'TürkKep E-Dönüşüm', endpointHint: 'efatura.turkkep.com.tr' },
  { id: 'GIB_PORTAL', name: 'GİB e-Arşiv Portal & Evrensel UBL-TR XML', endpointHint: 'earsivportal.efatura.gov.tr' }
];

export interface EdmConfig {
  enabled: boolean;
  provider: EInvoiceProviderId;
  username: string;
  password?: string;
  companyVknOrTc: string;
  companyTitle: string;
  defaultInvoicePrefix: string;
  environment: 'LIVE' | 'TEST';
  autoCheckMukellef: boolean;
}

const LEGACY_DEMO_IDS = new Set(['edm-inc-101', 'edm-inc-102']);
const LEGACY_DEMO_INVOICE_NOS = new Set(['TKR2026000014829', 'SYG2026000089310']);

function getActiveUidScope(): string | null {
  return auth.currentUser?.uid || localStorage.getItem('lastUserId') || null;
}

function getScopedKey(base: string): string | null {
  const uid = getActiveUidScope();
  return uid ? `${base}_${uid}` : null;
}

/** EDM veri setlerinin temel anahtarları (IndexedDB aynası da bu anahtarlarla yazılır). */
export const EDM_DATA_KEYS = {
  warehouse: 'mks_official_efatura_warehouse_v2',
  incoming: 'mks_edm_incoming_invoices_v2',
  outgoing: 'mks_edm_outgoing_invoices_v2'
} as const;

export type EdmDataKey = (typeof EDM_DATA_KEYS)[keyof typeof EDM_DATA_KEYS];

/**
 * Veri setini IndexedDB'ye (ve oradan bulut senkronuna) aynalar.
 * `dbService.saveEdmData` henüz yoksa yalnız localStorage kullanılır.
 */
function mirrorEdmDataToIndexedDb(baseKey: EdmDataKey, data: unknown): void {
  try {
    const saveFn = (dbService as any)?.saveEdmData;
    if (typeof saveFn !== 'function') return;
    Promise.resolve(saveFn(baseKey, data)).catch((err: unknown) => {
      console.error(`[EDM] IndexedDB aynalama başarısız (${baseKey}):`, err);
    });
  } catch (err) {
    console.error(`[EDM] IndexedDB aynalama başlatılamadı (${baseKey}):`, err);
  }
}

/**
 * Veri setini kullanıcıya özel localStorage anahtarına yazar ve IndexedDB'ye aynalar.
 * Başarısız olursa `false` döner — çağıran taraf kullanıcıya hata göstermelidir.
 */
function persistEdmDataset(baseKey: EdmDataKey, data: unknown): boolean {
  const key = getScopedKey(baseKey);
  if (!key) {
    console.error(`[EDM] Aktif kullanıcı bulunamadı; ${baseKey} kaydedilemedi.`);
    return false;
  }
  let ok = false;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    ok = true;
  } catch (err) {
    console.error(`[EDM] localStorage yazımı başarısız (${baseKey}) — kota dolu olabilir:`, err);
  }
  mirrorEdmDataToIndexedDb(baseKey, data);
  return ok;
}

/**
 * Yerel kopya yoksa (cihaz değişimi / localStorage temizliği) IndexedDB aynasından geri yükler.
 * `dbService.getEdmData` yoksa sessizce hiçbir şey yapmaz. Geri yükleme olduysa `true` döner.
 */
export async function hydrateEdmDataFromIndexedDb(): Promise<boolean> {
  const getFn = (dbService as any)?.getEdmData;
  if (typeof getFn !== 'function') return false;
  let restored = false;
  for (const baseKey of Object.values(EDM_DATA_KEYS)) {
    const key = getScopedKey(baseKey);
    if (!key) continue;
    try {
      if (localStorage.getItem(key)) continue;
      const data = await getFn(baseKey);
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(key, JSON.stringify(data));
        restored = true;
      }
    } catch (err) {
      console.error(`[EDM] IndexedDB'den geri yükleme başarısız (${baseKey}):`, err);
    }
  }
  if (restored) {
    window.dispatchEvent(new CustomEvent('mks-official-warehouse-updated'));
  }
  return restored;
}

// Clean up legacy unscoped sample keys once
function purgeLegacyDemoStorage(): void {
  try {
    const rawUnscoped = localStorage.getItem('mks_edm_incoming_invoices_v1');
    if (rawUnscoped) {
      localStorage.removeItem('mks_edm_incoming_invoices_v1');
    }
  } catch (err) {
    console.error('[EDM] Eski demo anahtarı temizlenemedi:', err);
  }
}

export const DEFAULT_EDM_CONFIG: EdmConfig = {
  enabled: false,
  provider: 'EDM',
  username: '',
  password: '',
  companyVknOrTc: '',
  companyTitle: '',
  defaultInvoicePrefix: 'MKS',
  environment: 'LIVE',
  autoCheckMukellef: true
};

export function getEdmConfig(): EdmConfig {
  try {
    const key = getScopedKey('mks_edm_config_v2');
    if (!key) return DEFAULT_EDM_CONFIG;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sessionPwd = sessionStorage.getItem(`${key}_pwd`) || '';
      return { ...DEFAULT_EDM_CONFIG, ...parsed, password: sessionPwd || parsed.password || '' };
    }
  } catch (err) {
    console.error('[EDM] Ayarlar okunamadı:', err);
  }
  return DEFAULT_EDM_CONFIG;
}

export function saveEdmConfig(cfg: EdmConfig): boolean {
  try {
    const key = getScopedKey('mks_edm_config_v2');
    if (!key) {
      console.error('[EDM] Aktif kullanıcı bulunamadı; ayarlar kaydedilemedi.');
      return false;
    }
    const { password, ...rest } = cfg;
    if (password) {
      sessionStorage.setItem(`${key}_pwd`, password);
    } else {
      sessionStorage.removeItem(`${key}_pwd`);
    }
    // Never persist cleartext EDM password in long-lived localStorage
    localStorage.setItem(key, JSON.stringify(rest));
    return true;
  } catch (err) {
    console.error('[EDM] Ayarlar kaydedilemedi:', err);
    return false;
  }
}

export function getOfficialWarehouseItems(): OfficialWarehouseItem[] {
  try {
    const key = getScopedKey(EDM_DATA_KEYS.warehouse);
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((it: OfficialWarehouseItem) => !LEGACY_DEMO_INVOICE_NOS.has(String(it.lastInvoiceNo || '')))
          .map((it: any) => ({
            ...it,
            bktsStock: Number(it.bktsStock ?? it.bkstStock ?? 0)
          }));
      }
    }
  } catch (err) {
    console.error('[EDM] e-Fatura deposu okunamadı:', err);
  }
  return [];
}

export function saveOfficialWarehouseItems(items: OfficialWarehouseItem[]): boolean {
  const ok = persistEdmDataset(EDM_DATA_KEYS.warehouse, items);
  if (ok) {
    window.dispatchEvent(new CustomEvent('mks-official-warehouse-updated'));
  }
  return ok;
}

export function getIncomingEdmInvoices(): IncomingEdmInvoice[] {
  purgeLegacyDemoStorage();
  try {
    const key = getScopedKey(EDM_DATA_KEYS.incoming);
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (inv: IncomingEdmInvoice) =>
            !LEGACY_DEMO_IDS.has(inv.id) && !LEGACY_DEMO_INVOICE_NOS.has(inv.invoiceNo)
        );
      }
    }
  } catch (err) {
    console.error('[EDM] Gelen e-Faturalar okunamadı:', err);
  }
  return [];
}

export function saveIncomingEdmInvoices(list: IncomingEdmInvoice[]): boolean {
  const clean = list.filter(
    inv => !LEGACY_DEMO_IDS.has(inv.id) && !LEGACY_DEMO_INVOICE_NOS.has(inv.invoiceNo)
  );
  return persistEdmDataset(EDM_DATA_KEYS.incoming, clean);
}

export function getOutgoingEdmInvoices(): OutgoingEdmInvoiceRecord[] {
  try {
    const key = getScopedKey(EDM_DATA_KEYS.outgoing);
    if (!key) return [];
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('[EDM] Giden belgeler okunamadı:', err);
  }
  return [];
}

export function saveOutgoingEdmInvoices(list: OutgoingEdmInvoiceRecord[]): boolean {
  return persistEdmDataset(EDM_DATA_KEYS.outgoing, list);
}

/**
 * Zincirleme iskonto (%10 + %5 + %3) sonrası gerçek net birim maliyeti hesaplar.
 * Alış birim fiyatı kuruş kaybı olmaması için 4 haneye yuvarlanır (satır toplamı ayrıca round2).
 */
export function calculateChainedNetPrice(basePrice: number, discounts: number[] = []): number {
  let net = Number(basePrice) || 0;
  for (const d of discounts) {
    const rate = Number(d) || 0;
    if (rate > 0 && rate < 100) {
      net = net * (1 - rate / 100);
    }
  }
  return round4(net);
}

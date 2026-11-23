import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Factory, ScrollText, ChevronDown, CheckCircle2, AlertTriangle, Sprout, QrCode, ExternalLink, LogOut, Lock, User,
  ScanLine, Plus, Minus, FileCode2, FileText, Search, Trash2, ShieldCheck, PackageCheck,
  Camera, Share2, FileDown, Boxes, Loader2, Sheet, Package, Eye, EyeOff,
  Globe, KeyRound, Copy,
} from 'lucide-react';
import {
  generateMinistryExportFile,
  filterOfficialMinistryRecords, parseGS1Barcode, isValidGS1Number, findItemByScan, canonicalBarcodeFromParsed,
  FREE_SALE_STATUS,
  type MinistryExportRecord, type GS1ParseResult,
} from '../utils/gs1Parser';
import { useHardwareBarcodeScanner, playScanBeep, playErrorBeep } from '../utils/hardwareBarcodeScanner';
import { dbService } from '../services/db';
import { auth } from '../services/firebase';
import { API_BASE } from '../utils/api';
import { useAppViewModel } from '../context/AppContext';
import ModalCloseButton from './ModalCloseButton';
import LazyBarcodeScanner from './LazyBarcodeScanner';
import {
  loadMinistryRecords, loadMinistryShipments, saveMinistryRecords, saveMinistryShipmentRecord,
} from '../utils/ministryStore';
import { generateUUID } from '../utils/uuid';
import { daysUntilExpiry, normalizeGtin, round2 } from '../utils/dateUtils';
import { loadJsPdfWithAutoTable } from '../utils/pdfHelper';
import { archivePdf } from '../utils/pdfArchive';
import {
  PesticideCategory,
  type Farmer,
  type InventoryBatch, type InventoryItem, type MinistryRecord as MinistryLedgerRecord,
  type MinistryShipmentLine, type MinistryShipmentRecord,
  type Prescription,
} from '../types';
import { validateTcOrVkn } from '../utils/tcNoValidator';

// ---------------------------------------------------------------------------
// Types (legacy prop shapes are still accepted from App.tsx)
// ---------------------------------------------------------------------------

export interface MinistryConfig {
  bkts: boolean;
  gts: boolean;
  bRecete: boolean;
  gln: string;
  bktsUsername?: string;
  gtsUsername?: string;
  bReceteUsername?: string;
  environment?: 'LIVE' | 'TEST';
  bktsEndpoint?: string;
  gtsEndpoint?: string;
  bReceteEndpoint?: string;
}

export interface FactoryShipmentLine {
  productName: string;
  gtin?: string;
  lotNo?: string;
  expiryDate?: string;
  serialNo?: string;
  quantity: number;
  unit?: string;
}

export interface FactoryShipment {
  id: string;
  system?: 'BKTS' | 'BKST' | 'GTS';
  irsaliyeNo?: string;
  sscc?: string;
  supplierName?: string;
  supplierGln?: string;
  date?: string;
  lines: FactoryShipmentLine[];
}

export type MinistryTxStatus = 'Dışa Aktarıma Hazır' | 'Bakanlığa Bildirildi' | 'Kuyrukta' | 'Kayıtsız Serbest Satış';

export interface MinistryTransaction extends MinistryExportRecord {
  id: string;
  status: MinistryTxStatus;
}

interface MinistryIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'malkabul' | 'satis' | 'esdeger' | 'gts' | 'bkts' | 'brecete' | 'receive' | 'ledger' | 'engine' | 'sandbox' | 'webservice';
  inventory?: any[];
  /** Optional extra ledger rows (merged with the persistent IndexedDB ledger). */
  transactions?: (MinistryTransaction | MinistryLedgerRecord)[];
  /** Optional extra pending shipments (merged with the persistent IndexedDB shipments). */
  pendingShipments?: FactoryShipment[];
  /**
   * Optional custom stock handler. When omitted, the modal itself writes the received
   * quantities, batches (lot/SKT/serials) and adjustments into inventory.
   */
  onAcceptShipment?: (shipment: FactoryShipment, opts: { registerToMinistry: boolean; config: MinistryConfig }) => void | Promise<void>;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type ActiveMinistryService = 'BKTS' | 'GTS' | 'BRECETE';
type TabId = 'receive' | 'brecete' | 'ledger' | 'webservice';

interface SavedServiceAuth {
  gln: string;
  username: string;
  password: string;
  serviceKey?: string;
  remember: boolean;
  environment: 'LIVE' | 'TEST';
  loggedInAt: string;
}

interface ServiceMeta {
  id: ActiveMinistryService;
  shortLabel: string;
  title: string;
  subtitle: string;
  portalUrl: string;
  portalLabel: string;
  accentHex: string;
  loginTitle: string;
  loginDesc: string;
  idLabel: string;
  idPlaceholder: string;
  passwordLabel: string;
}

const SERVICE_META: Record<ActiveMinistryService, ServiceMeta> = {
  GTS: {
    id: 'GTS',
    shortLabel: 'GTS',
    title: 'GTS — Gübre Takip Sistemi',
    subtitle: 'Gübre mal kabul, Karekod/Barkod stok & satış bildirimi, GTS denetim defteri',
    portalUrl: 'https://gtsapp.tarimorman.gov.tr/Login/Default',
    portalLabel: 'gtsapp.tarimorman.gov.tr Resmî Portalı',
    accentHex: '#10b981',
    loginTitle: 'GTS — Gübre Takip Sistemi Girişi',
    loginDesc: 'T.C. Kimlik Numaranız veya Vergi Numaranız ve GTS şifrenizle MKS çalışma alanına doğrudan giriş yapın. Bakanlığın görsel güvenlik kodu ve Mobil Onay (SMS) doğrulaması yalnızca resmî gtsapp.tarimorman.gov.tr portalını açtığınızda çalışır.',
    idLabel: 'T.C. Kimlik No veya Vergi No',
    idPlaceholder: '11 haneli T.C. Kimlik No veya 10 haneli Vergi No',
    passwordLabel: 'GTS Şifresi (Parola)',
  },
  BKTS: {
    id: 'BKTS',
    shortLabel: 'BKTS',
    title: 'BKTS — Bitki Koruma Ürünleri Takip',
    subtitle: 'Zirai ilaç mal kabul (SSCC / Karekod), BKTS satış bildirimi ve denetim defteri',
    portalUrl: 'https://bkst.tarbil.gov.tr',
    portalLabel: 'bkst.tarbil.gov.tr Resmî Portalı',
    accentHex: '#06b6d4',
    loginTitle: 'BKTS — Bitki Koruma Takip Sistemi Girişi',
    loginDesc: 'Bakanlık BKST giriş ekranındaki Kullanıcı Adı (T.C. Kimlik / Vergi No) ve şifrenizle giriş yapın. Beni Hatırla açıkken sonraki açılışlarda otomatik bağlanır.',
    idLabel: 'Kullanıcı Adı (T.C. Kimlik / Vergi No)',
    idPlaceholder: 'T.C. Kimlik No veya Vergi No',
    passwordLabel: 'BKTS Şifresi',
  },
  BRECETE: {
    id: 'BRECETE',
    shortLabel: 'B-Reçete',
    title: 'B-Reçete — Elektronik Reçete & Bildirim',
    subtitle: 'B-Reçete kodu canlı sorgu, çiftçi TCKN eşleştirme ve resmi bildirim',
    portalUrl: 'https://ukds.tarimorman.gov.tr',
    portalLabel: 'ukds.tarimorman.gov.tr (B-Reçete / e-Devlet)',
    accentHex: '#6366f1',
    loginTitle: 'B-Reçete — Elektronik Reçete Sistemi Girişi',
    loginDesc: 'Bakanlık B-Reçete (UKDS / e-Devlet) giriş ekranındaki T.C. Kimlik Numaranız ve şifrenizle giriş yapın. Beni Hatırla açıkken sonraki açılışlarda otomatik bağlanır.',
    idLabel: 'T.C. Kimlik Numarası',
    idPlaceholder: '11 haneli T.C. Kimlik Numarası',
    passwordLabel: 'e-Devlet / Sistem Şifresi',
  },
};

function resolveServiceFromInitialTab(initialTab?: MinistryIntegrationModalProps['initialTab']): ActiveMinistryService {
  if (initialTab === 'gts') return 'GTS';
  if (initialTab === 'brecete') return 'BRECETE';
  return 'BKTS';
}
type ScanSource = 'hardware' | 'camera' | 'manual';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEGACY_CONFIG_KEY = () => `mks_ministry_config_${dbService.getCurrentUserId() || 'guest'}`;
const DEFAULT_CONFIG: MinistryConfig = {
  bkts: false,
  gts: false,
  bRecete: false,
  gln: '',
  bktsUsername: '',
  gtsUsername: '',
  bReceteUsername: '',
  environment: 'LIVE',
  bktsEndpoint: '',
  gtsEndpoint: '',
  bReceteEndpoint: '',
};

/** Legacy device-only config (pre profile sync). Plain-text passwords/service keys are purged (B-18). */
function loadLegacyConfig(): MinistryConfig | null {
  try {
    const raw = localStorage.getItem(LEGACY_CONFIG_KEY());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MinistryConfig> & { bkst?: boolean; serviceKey?: string; password?: string };
    if (parsed.serviceKey || parsed.password) {
      delete parsed.serviceKey;
      delete parsed.password;
      localStorage.setItem(LEGACY_CONFIG_KEY(), JSON.stringify(parsed));
    }
    return {
      bkts: Boolean(parsed.bkts ?? parsed.bkst ?? false),
      gts: Boolean(parsed.gts),
      bRecete: Boolean(parsed.bRecete),
      gln: String(parsed.gln ?? ''),
      bktsUsername: String(parsed.bktsUsername ?? ''),
      gtsUsername: String(parsed.gtsUsername ?? ''),
      bReceteUsername: String(parsed.bReceteUsername ?? ''),
      environment: parsed.environment === 'TEST' ? 'TEST' : 'LIVE',
      bktsEndpoint: String(parsed.bktsEndpoint ?? ''),
      gtsEndpoint: String(parsed.gtsEndpoint ?? ''),
      bReceteEndpoint: String(parsed.bReceteEndpoint ?? ''),
    };
  } catch (e) {
    console.warn('[Ministry] legacy config read failed', e);
    return null;
  }
}

const SAVED_SERVICE_AUTH_KEY = 'mks_ministry_saved_auth_v1';

function savedAuthOwnerKey(): string {
  return dbService.getCurrentUserId() || 'guest';
}

function loadSavedServiceAuthMap(): Partial<Record<ActiveMinistryService, SavedServiceAuth>> {
  try {
    const raw = localStorage.getItem(SAVED_SERVICE_AUTH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<Record<ActiveMinistryService, SavedServiceAuth>>>;
    const owner = savedAuthOwnerKey();
    const bucket = parsed?.[owner];
    if (!bucket || typeof bucket !== 'object') return {};
    const result: Partial<Record<ActiveMinistryService, SavedServiceAuth>> = {};
    (['BKTS', 'GTS', 'BRECETE'] as ActiveMinistryService[]).forEach(svc => {
      const entry = bucket[svc];
      if (entry && entry.remember && entry.username && entry.password) {
        result[svc] = {
          gln: String(entry.gln || ''),
          username: String(entry.username || ''),
          password: String(entry.password || ''),
          serviceKey: entry.serviceKey ? String(entry.serviceKey) : undefined,
          remember: true,
          environment: entry.environment === 'TEST' ? 'TEST' : 'LIVE',
          loggedInAt: String(entry.loggedInAt || ''),
        };
      }
    });
    return result;
  } catch {
    return {};
  }
}

function loadSavedServiceAuth(service: ActiveMinistryService): SavedServiceAuth | null {
  return loadSavedServiceAuthMap()[service] || null;
}

function saveSavedServiceAuth(service: ActiveMinistryService, auth: SavedServiceAuth): void {
  try {
    const raw = localStorage.getItem(SAVED_SERVICE_AUTH_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Partial<Record<ActiveMinistryService, SavedServiceAuth>>>) : {};
    const owner = savedAuthOwnerKey();
    const current = parsed[owner] || {};
    parsed[owner] = { ...current, [service]: auth };
    localStorage.setItem(SAVED_SERVICE_AUTH_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn('[Ministry] saved auth write failed', e);
  }
}

function clearSavedServiceAuth(service?: ActiveMinistryService): void {
  try {
    const raw = localStorage.getItem(SAVED_SERVICE_AUTH_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Partial<Record<ActiveMinistryService, SavedServiceAuth>>>;
    const owner = savedAuthOwnerKey();
    if (!parsed[owner]) return;
    if (!service) {
      delete parsed[owner];
    } else {
      delete parsed[owner][service];
    }
    localStorage.setItem(SAVED_SERVICE_AUTH_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn('[Ministry] saved auth clear failed', e);
  }
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR');
};

const htmlFree = (v: unknown) => String(v ?? '').replace(/\u001D/g, '');

/** jsPDF core fonts have no Turkish glyphs — transliterate so PDFs never show garbage. */
const pdfSafe = (v: unknown) =>
  htmlFree(v)
    .replace(/[şŞğĞıİçÇöÖüÜ·]/g, c => ({ 'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ç': 'c', 'Ç': 'C', 'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U', '·': '-' }[c] as string))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F]/g, ' ');

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Web Share (files) first — WhatsApp / Drive on mobile — then a regular download. */
async function shareOrDownload(fileName: string, blob: Blob, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  try {
    const file = new File([blob], fileName, { type: blob.type.split(';')[0] || 'application/octet-stream' });
    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title, text: title });
      return 'shared';
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return 'cancelled';
    console.warn('[Ministry] Web Share failed, falling back to download', e);
  }
  downloadBlob(fileName, blob);
  return 'downloaded';
}

function legacyShipmentToRecord(s: FactoryShipment): MinistryShipmentRecord {
  const lines: MinistryShipmentLine[] = (s.lines || []).map(l => ({
    gtin: l.gtin || '',
    name: l.productName || '',
    batch: l.lotNo || '',
    expiry: l.expiryDate,
    serial: l.serialNo,
    qty: Number(l.quantity) || 0,
  }));
  return {
    id: s.id,
    sscc: s.sscc || '',
    senderGln: s.supplierGln,
    senderName: s.supplierName || '',
    waybillNo: s.irsaliyeNo || '',
    itemCount: lines.reduce((a, l) => a + l.qty, 0),
    date: s.date || todayISO(),
    status: 'PENDING',
    lines,
  };
}

function recordToLegacyShipment(s: MinistryShipmentRecord): FactoryShipment {
  return {
    id: s.id,
    sscc: s.sscc || undefined,
    irsaliyeNo: s.waybillNo || undefined,
    supplierName: s.senderName || undefined,
    supplierGln: s.senderGln,
    date: s.date,
    lines: s.lines.map(l => ({ productName: l.name, gtin: l.gtin, lotNo: l.batch, expiryDate: l.expiry, serialNo: l.serial, quantity: l.qty })),
  };
}

function legacyTxToRecord(t: any): MinistryLedgerRecord {
  if (t && 'documentNo' in t && 'recordType' in t) return t as MinistryLedgerRecord;
  const status: MinistryLedgerRecord['status'] =
    t?.status === FREE_SALE_STATUS ? FREE_SALE_STATUS : t?.status === 'Kuyrukta' ? 'Kuyrukta' : 'Dışa Aktarıma Hazır';
  return {
    id: String(t?.id || generateUUID()),
    system: t?.system === 'GTS' ? 'GTS' : 'BKTS',
    recordType: status === FREE_SALE_STATUS ? 'FREE_SALE' : 'FARMER_SALE',
    date: t?.date || '',
    documentNo: t?.prescriptionNo || '',
    farmerName: t?.farmerName,
    farmerTcNo: t?.farmerTcNo,
    productName: t?.productName || '',
    gtin: t?.gtin || '',
    lotNumber: t?.lotNo || '',
    serialNumber: t?.serialNo,
    expiryDate: t?.expiryDate,
    quantity: Number(t?.quantity) || 1,
    unit: t?.unit,
    status,
  };
}

const RECORD_TYPE_LABEL: Record<MinistryLedgerRecord['recordType'], string> = {
  SHIPMENT_ACCEPT: 'Mal Kabul',
  FARMER_SALE: 'Kayıtlı Satış',
  FREE_SALE: 'Serbest Satış',
  RETURN: 'İade',
};

const statusClass = (s: string) =>
  s === 'Bakanlığa Bildirildi'
    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 font-bold'
    : s === 'Dışa Aktarıma Hazır'
      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
      : s === 'Kuyrukta'
        ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
        : 'bg-stone-500/15 border-stone-500/30';

const isFertilizer = (c?: string) => c === PesticideCategory.FERTILIZER || c === PesticideCategory.GRANULAR_FERTILIZER;

/** Merges received lines into an item's batches (same lot+SKT → add, else new batch). */
function mergeBatches(item: InventoryItem | null, lines: MinistryShipmentLine[]): InventoryBatch[] {
  let batches: InventoryBatch[] = item?.batches?.length ? item.batches.map(b => ({ ...b, serialNumbers: [...(b.serialNumbers || [])] })) : [];
  if (item && !item.batches?.length && Number(item.quantity) > 0) {
    // One-time migration of legacy single-lot rows so Σ batches == quantity.
    batches = [{
      lotNumber: item.lotNumber || '',
      expiryDate: item.expiryDate,
      quantity: round2(Number(item.quantity) || 0),
      serialNumbers: item.serialNumber ? [item.serialNumber] : [],
    }];
  }
  const now = new Date().toISOString();
  for (const l of lines) {
    const lot = l.batch || '';
    const target = batches.find(b => (b.lotNumber || '') === lot && (b.expiryDate || '') === (l.expiry || ''));
    if (target) {
      target.quantity = round2(target.quantity + l.qty);
      if (l.serial && !target.serialNumbers?.includes(l.serial)) target.serialNumbers = [...(target.serialNumbers || []), l.serial];
    } else {
      batches.push({ lotNumber: lot, expiryDate: l.expiry, quantity: round2(l.qty), serialNumbers: l.serial ? [l.serial] : [], receivedAt: now });
    }
  }
  return batches;
}

/** Earliest-SKT batch with stock → legacy single lot/SKT summary fields. */
function batchSummary(batches: InventoryBatch[]): { lotNumber?: string; expiryDate?: string } {
  const live = batches.filter(b => b.quantity > 0);
  const sorted = [...live].sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999'));
  const first = sorted[0];
  return first ? { lotNumber: first.lotNumber || undefined, expiryDate: first.expiryDate } : {};
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------

const surface: React.CSSProperties = { background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' };
const subSurface: React.CSSProperties = { background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' };
const inputStyle: React.CSSProperties = { background: 'var(--mks-input-bg)', borderColor: 'var(--mks-input-border)', color: 'var(--mks-text)' };
const mutedStyle: React.CSSProperties = { color: 'var(--mks-muted)' };
const accentStyle: React.CSSProperties = { background: 'var(--mks-accent-primary)', color: '#fff' };

const StatCard: React.FC<{ label: string; value: React.ReactNode; tone?: 'ok' | 'warn' | 'muted'; icon: React.ReactNode }> = ({ label, value, tone = 'muted', icon }) => (
  <div className="rounded-2xl border p-3 flex items-center gap-3" style={subSurface}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone === 'ok' ? 'bg-emerald-500/15 text-emerald-500' : tone === 'warn' ? 'bg-amber-500/15 text-amber-500' : 'bg-stone-500/15'}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-lg font-black leading-none">{value}</div>
      <div className="text-[11px] mt-1 truncate" style={mutedStyle}>{label}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MinistryIntegrationModal: React.FC<MinistryIntegrationModalProps> = ({
  isOpen, onClose, initialTab, inventory: inventoryProp, transactions, pendingShipments, onAcceptShipment, showToast: showToastProp,
}) => {
  const vm = useAppViewModel();
  const { userProfile, updateUserProfile } = vm;
  const inventory: InventoryItem[] = (vm.inventory?.length ? vm.inventory : (inventoryProp as InventoryItem[])) || [];
  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info') => {
    if (showToastProp) showToastProp(msg, type);
    else vm.showToast?.(msg, type);
  }, [showToastProp, vm]);

  // ---- Config (synced with userProfile.ministryConfig; şifre ve KeyNo buluta kaydedilmez) ----
  const profileConfig = userProfile?.ministryConfig;
  const buildConfig = useCallback((): MinistryConfig => {
    const legacy = loadLegacyConfig();
    return {
      bkts: profileConfig?.bktsEnabled ?? legacy?.bkts ?? DEFAULT_CONFIG.bkts,
      gts: profileConfig?.gtsEnabled ?? legacy?.gts ?? DEFAULT_CONFIG.gts,
      bRecete: profileConfig?.bReceteEnabled ?? legacy?.bRecete ?? DEFAULT_CONFIG.bRecete,
      gln: profileConfig?.gln ?? legacy?.gln ?? DEFAULT_CONFIG.gln,
      bktsUsername: profileConfig?.bktsUsername ?? legacy?.bktsUsername ?? DEFAULT_CONFIG.bktsUsername,
      gtsUsername: profileConfig?.gtsUsername ?? legacy?.gtsUsername ?? DEFAULT_CONFIG.gtsUsername,
      bReceteUsername: profileConfig?.bReceteUsername ?? legacy?.bReceteUsername ?? DEFAULT_CONFIG.bReceteUsername,
      environment: profileConfig?.environment ?? legacy?.environment ?? 'LIVE',
      bktsEndpoint: profileConfig?.bktsEndpoint ?? legacy?.bktsEndpoint ?? '',
      gtsEndpoint: profileConfig?.gtsEndpoint ?? legacy?.gtsEndpoint ?? '',
      bReceteEndpoint: profileConfig?.bReceteEndpoint ?? legacy?.bReceteEndpoint ?? '',
    };
  }, [
    profileConfig?.bktsEnabled, profileConfig?.gtsEnabled, profileConfig?.bReceteEnabled, profileConfig?.gln,
    profileConfig?.bktsUsername, profileConfig?.gtsUsername, profileConfig?.bReceteUsername,
    profileConfig?.environment, profileConfig?.bktsEndpoint, profileConfig?.gtsEndpoint, profileConfig?.bReceteEndpoint,
  ]);

  const [config, setConfig] = useState<MinistryConfig>(buildConfig);
  const [tab, setTab] = useState<TabId>('receive');
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [ledgerType, setLedgerType] = useState<'ALL' | MinistryLedgerRecord['recordType']>('ALL');
  const [localOnly, setLocalOnly] = useState(() => { const c = buildConfig(); return !c.bkts && !c.gts; });

  // ---- B-Reçete & Resmi Satış Bildirimi state ----------------------------
  const farmers: Farmer[] = (vm.farmers || []) as Farmer[];
  const prescriptions: Prescription[] = (vm.prescriptions || []) as Prescription[];
  const [breceteMode, setBreceteMode] = useState<'invoice' | 'manual'>('invoice');
  const [breceteSearch, setBreceteSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [breceteSystem, setBreceteSystem] = useState<'BKTS' | 'GTS'>('BKTS');
  const [breceteCodeInput, setBreceteCodeInput] = useState('');
  const [breceteDocNo, setBreceteDocNo] = useState('');
  const [breceteFarmerId, setBreceteFarmerId] = useState('');
  const [breceteTcInput, setBreceteTcInput] = useState('');
  const [breceteProductInput, setBreceteProductInput] = useState('');
  const [breceteGtinInput, setBreceteGtinInput] = useState('');
  const [breceteLotInput, setBreceteLotInput] = useState('');
  const [breceteSktInput, setBreceteSktInput] = useState('');
  const [breceteQtyInput, setBreceteQtyInput] = useState('1');
  const [savingBrecete, setSavingBrecete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fresh = buildConfig();
    setConfig(fresh);
    setLocalOnly(!fresh.bkts && !fresh.gts);
  }, [isOpen, buildConfig]);

  const [activeService, setActiveService] = useState<ActiveMinistryService>(() => resolveServiceFromInitialTab(initialTab));
  const [authByService, setAuthByService] = useState<Partial<Record<ActiveMinistryService, SavedServiceAuth>>>(() => loadSavedServiceAuthMap());
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const [loginRemember, setLoginRemember] = useState(true);
  const [loginAutoEntered, setLoginAutoEntered] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountShowPassword, setAccountShowPassword] = useState(false);
  const [wsGln, setWsGln] = useState(() => buildConfig().gln || '');
  const [wsServiceKey, setWsServiceKey] = useState('');
  const [wsEndpoint, setWsEndpoint] = useState('');
  const [wsEnv, setWsEnv] = useState<'LIVE' | 'TEST'>(() => (buildConfig().environment === 'TEST' ? 'TEST' : 'LIVE'));
  const [wsTestResult, setWsTestResult] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; message?: string; diagnostic?: string }>({ state: 'idle' });

  useEffect(() => {
    if (!isOpen) return;
    setWsGln(config.gln || '');
    setWsEnv(config.environment === 'TEST' ? 'TEST' : 'LIVE');
    const ep =
      activeService === 'GTS'
        ? config.gtsEndpoint || ''
        : activeService === 'BRECETE'
          ? config.bReceteEndpoint || ''
          : config.bktsEndpoint || '';
    setWsEndpoint(ep);
    setWsTestResult({ state: 'idle' });
  }, [isOpen, activeService, config.gln, config.environment, config.bktsEndpoint, config.gtsEndpoint, config.bReceteEndpoint]);

  useEffect(() => {
    if (!isOpen) return;
    const nextService = resolveServiceFromInitialTab(initialTab);
    setActiveService(nextService);
    setBreceteSystem(nextService === 'GTS' ? 'GTS' : 'BKTS');

    if (initialTab === 'brecete' || nextService === 'BRECETE') {
      setTab(initialTab === 'ledger' || initialTab === 'satis' ? 'ledger' : initialTab === 'webservice' ? 'webservice' : 'brecete');
    } else if (initialTab === 'satis' || initialTab === 'ledger') {
      setTab('ledger');
    } else if (initialTab === 'webservice') {
      setTab('webservice');
    } else {
      setTab('receive');
    }

    const saved = loadSavedServiceAuth(nextService);
    const hasValidSaved = Boolean(saved && saved.remember && saved.username && saved.password);
    if (hasValidSaved && saved) {
      setAuthByService(prev => ({ ...prev, [nextService]: saved }));
      setLoginAutoEntered(true);
      setLoginError('');
      setAccountUsername(saved.username);
      setAccountPassword(saved.password);
      setConfig(prev => ({
        ...prev,
        bkts: nextService === 'BKTS' ? true : prev.bkts,
        gts: nextService === 'GTS' ? true : prev.gts,
        bRecete: nextService === 'BRECETE' ? true : prev.bRecete,
        bktsUsername: nextService === 'BKTS' ? saved.username : prev.bktsUsername,
        gtsUsername: nextService === 'GTS' ? saved.username : prev.gtsUsername,
        bReceteUsername: nextService === 'BRECETE' ? saved.username : prev.bReceteUsername,
      }));
      setLocalOnly(false);
    } else {
      setLoginAutoEntered(false);
      setLoginError('');
      const fallbackUser =
        nextService === 'GTS'
          ? (config.gtsUsername || '')
          : nextService === 'BRECETE'
            ? (config.bReceteUsername || '')
            : (config.bktsUsername || '');
      setLoginUsername(fallbackUser);
      setLoginPassword('');
      setAccountUsername(fallbackUser);
      setAccountPassword('');
      setLoginRemember(true);
    }
    setAccountShowPassword(false);
  }, [initialTab, isOpen]);

  const persistConfig = useCallback(async (next: MinistryConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(LEGACY_CONFIG_KEY(), JSON.stringify(next));
    } catch (e) {
      console.warn('[Ministry] local config mirror failed', e);
    }
    if (!userProfile || typeof updateUserProfile !== 'function') return;
    try {
      await updateUserProfile({
        ...userProfile,
        ministryConfig: {
          gln: next.gln,
          bktsEnabled: next.bkts,
          gtsEnabled: next.gts,
          bReceteEnabled: next.bRecete,
          bktsUsername: next.bktsUsername || '',
          gtsUsername: next.gtsUsername || '',
          bReceteUsername: next.bReceteUsername || '',
          environment: next.environment === 'TEST' ? 'TEST' : 'LIVE',
          bktsEndpoint: next.bktsEndpoint || '',
          gtsEndpoint: next.gtsEndpoint || '',
          bReceteEndpoint: next.bReceteEndpoint || '',
        },
      });
    } catch (e: any) {
      console.error('[Ministry] profile sync failed', e);
      toast(`Bakanlık ayarı buluta kaydedilemedi: ${e?.message || e}`, 'error');
    }
  }, [userProfile, updateUserProfile, toast]);

  const ministryActive = config.bkts || config.gts;

  const activeMeta = SERVICE_META[activeService];
  const activeAuth = authByService[activeService] || null;
  const isAuthenticated = Boolean(
    activeAuth
    && activeAuth.username.trim()
    && activeAuth.password,
  );

  const validateServiceUsername = (service: ActiveMinistryService, raw: string): string | null => {
    const clean = raw.trim();
    if (service === 'GTS') {
      const digits = clean.replace(/\D/g, '');
      if (digits !== clean || (digits.length !== 10 && digits.length !== 11)) {
        return 'GTS girişi için 11 haneli T.C. Kimlik Numarası veya 10 haneli Vergi Numarası girin.';
      }
      return null;
    }
    if (service === 'BRECETE') {
      if (!/^\d{11}$/.test(clean)) {
        return 'B-Reçete girişi için 11 haneli T.C. Kimlik Numaranızı girin.';
      }
      return null;
    }
    if (!clean || clean.length < 4) {
      return 'BKTS Kullanıcı Adı (T.C. Kimlik / Vergi No) girin.';
    }
    return null;
  };

  const applyAuthenticatedCredentials = async (usernameClean: string, passwordValue: string, rememberValue: boolean) => {
    const authRecord: SavedServiceAuth = {
      gln: '',
      username: usernameClean,
      password: passwordValue,
      remember: rememberValue,
      environment: config.environment === 'TEST' ? 'TEST' : 'LIVE',
      loggedInAt: new Date().toISOString(),
    };
    setAuthByService(prev => ({ ...prev, [activeService]: authRecord }));
    setAccountUsername(usernameClean);
    setAccountPassword(passwordValue);
    setLoginAutoEntered(false);
    if (rememberValue) saveSavedServiceAuth(activeService, authRecord);
    else clearSavedServiceAuth(activeService);

    const nextConfig: MinistryConfig = {
      ...config,
      bkts: activeService === 'BKTS' ? true : config.bkts,
      gts: activeService === 'GTS' ? true : config.gts,
      bRecete: activeService === 'BRECETE' ? true : config.bRecete,
      bktsUsername: activeService === 'BKTS' ? usernameClean : config.bktsUsername,
      gtsUsername: activeService === 'GTS' ? usernameClean : config.gtsUsername,
      bReceteUsername: activeService === 'BRECETE' ? usernameClean : config.bReceteUsername,
    };
    setLocalOnly(false);
    await persistConfig(nextConfig);
  };

  const handleServiceLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const usernameClean = loginUsername.trim();
    const userErr = validateServiceUsername(activeService, usernameClean);
    if (userErr) {
      setLoginError(userErr);
      return;
    }
    if (!loginPassword) {
      setLoginError(`${activeMeta.passwordLabel} alanını doldurun.`);
      return;
    }
    setLoginError('');
    await applyAuthenticatedCredentials(usernameClean, loginPassword, loginRemember);
    toast(
      loginRemember
        ? `${activeMeta.shortLabel} hesabına giriş yapıldı (Beni Hatırla aktif).`
        : `${activeMeta.shortLabel} oturumu açıldı.`,
      'success',
    );
  };

  const handleUpdateSavedAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const usernameClean = accountUsername.trim();
    const userErr = validateServiceUsername(activeService, usernameClean);
    if (userErr) {
      toast(userErr, 'error');
      return;
    }
    if (!accountPassword) {
      toast(`${activeMeta.passwordLabel} alanını doldurun.`, 'error');
      return;
    }
    const rememberNext = activeAuth?.remember ?? true;
    await applyAuthenticatedCredentials(usernameClean, accountPassword, rememberNext);
    toast(
      rememberNext
        ? `${activeMeta.shortLabel} hesap bilgileri güncellendi ve otomatik giriş için kaydedildi.`
        : `${activeMeta.shortLabel} hesap bilgileri bu oturum için güncellendi.`,
      'success',
    );
  };

  const handleTestMinistryConnection = async () => {
    if (wsTestResult.state === 'busy') return;
    const cleanGln = wsGln.replace(/\D/g, '');
    const u = (accountUsername || activeAuth?.username || '').trim();
    const p = accountPassword || activeAuth?.password || '';
    const k = wsServiceKey.trim();
    if (!/^\d{13}$/.test(cleanGln)) {
      setWsTestResult({ state: 'fail', message: 'Canlı test için 13 haneli Bayi GLN numarası gereklidir.' });
      return;
    }
    if (!u || !p || !k) {
      setWsTestResult({ state: 'fail', message: `${activeMeta.shortLabel} Kullanıcı Adı, Şifre ve Web Servis KeyNo alanlarını doldurun.` });
      return;
    }
    const cleanEp = wsEndpoint.trim();
    await persistConfig({
      ...config,
      gln: cleanGln,
      environment: wsEnv,
      ...(activeService === 'GTS'
        ? { gtsEndpoint: cleanEp }
        : activeService === 'BRECETE'
          ? { bReceteEndpoint: cleanEp }
          : { bktsEndpoint: cleanEp }),
    });
    setWsTestResult({ state: 'busy' });
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const resp = await fetch(`${API_BASE}/api/ministry/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({
          system: activeService,
          environment: wsEnv,
          gln: cleanGln,
          username: u,
          password: p,
          serviceKey: k,
          ...(cleanEp ? { endpointUrl: cleanEp } : {}),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (data?.ok) {
        setWsTestResult({
          state: 'ok',
          message: `${activeMeta.shortLabel} web servisi canlı doğrulandı.`,
          diagnostic: data.diagnostic || '',
        });
      } else {
        setWsTestResult({
          state: 'fail',
          message: data?.error || `${activeMeta.shortLabel} web servisi doğrulanamadı.`,
          diagnostic: data?.diagnostic || '',
        });
      }
    } catch {
      setWsTestResult({ state: 'fail', message: 'MKS sunucusuna ulaşılamadı.' });
    }
  };

  const handleServiceLogout = () => {
    clearSavedServiceAuth(activeService);
    setAuthByService(prev => {
      const next = { ...prev };
      delete next[activeService];
      return next;
    });
    setLoginUsername(activeAuth?.username || '');
    setLoginPassword('');
    setAccountPassword('');
    setLoginAutoEntered(false);
    setLoginError('');
    toast(`${activeMeta.shortLabel} oturumu kapatıldı. Başka hesapla giriş yapabilirsiniz.`, 'info');
  };

  const openOfficialPortalWindow = (targetUrl?: string) => {
    const url = targetUrl || activeMeta.portalUrl;
    const width = 1220;
    const height = 840;
    const left = typeof window !== 'undefined'
      ? Math.max(0, Math.round((window.screenX ?? 0) + ((window.outerWidth || width) - width) / 2))
      : 100;
    const top = typeof window !== 'undefined'
      ? Math.max(0, Math.round((window.screenY ?? 0) + ((window.outerHeight || height) - height) / 2))
      : 60;
    if (activeAuth?.username && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(activeAuth.username).catch(() => {});
    }
    const win = window.open(
      url,
      `mks_ministry_portal_${activeService}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes`,
    );
    if (!win) {
      toast('Tarayıcı açılır pencereyi engelledi. Lütfen bu site için açılır pencerelere izin verin.', 'error');
      return;
    }
    if (activeAuth?.username) {
      toast(
        `${activeMeta.portalLabel} açıldı — ${activeMeta.idLabel} (${activeAuth.username}) panoya kopyalandı, giriş kutusuna yapıştırabilirsiniz (Ctrl+V).`,
        'success',
      );
    } else {
      toast(`${activeMeta.portalLabel} penceresi açıldı.`, 'info');
    }
  };

  const copyCredentialField = async (label: string, val?: string) => {
    if (!val) {
      toast(`Kopyalanacak ${label} bulunamadı.`, 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(val);
      toast(`${label} panoya kopyalandı.`, 'success');
    } catch {
      toast(`${label} kopyalanamadı — lütfen manuel seçip kopyalayın.`, 'error');
    }
  };

  // ---- Persistent data ----------------------------------------------------
  const [shipments, setShipmentsState] = useState<MinistryShipmentRecord[]>([]);
  const shipmentsRef = useRef<MinistryShipmentRecord[]>([]);
  const setShipments = useCallback((next: MinistryShipmentRecord[]) => {
    shipmentsRef.current = next;
    setShipmentsState(next);
  }, []);
  const [records, setRecords] = useState<MinistryLedgerRecord[]>([]);
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeShipmentId, setActiveShipmentIdState] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const setActiveShipmentId = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveShipmentIdState(id);
  }, []);
  /** Reads refs (not render state) so rapid back-to-back scans always target the same shipment. */
  const getActivePending = () =>
    shipmentsRef.current.find(s => s.id === activeIdRef.current && s.status === 'PENDING' && !s.deletedAt) || null;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const inventoryRef = useRef<InventoryItem[]>(inventory);
  inventoryRef.current = inventory;

  const extraShipmentsRef = useRef<FactoryShipment[] | undefined>(pendingShipments);
  extraShipmentsRef.current = pendingShipments;
  const extraTxRef = useRef<typeof transactions>(transactions);
  extraTxRef.current = transactions;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [ships, recs, lib] = await Promise.all([
        loadMinistryShipments((extraShipmentsRef.current || []).map(legacyShipmentToRecord)),
        loadMinistryRecords((extraTxRef.current || []).map(legacyTxToRecord)),
        dbService.getPesticides().catch((e: unknown) => { console.warn('[Ministry] pesticide library load failed', e); return []; }),
      ]);
      setShipments([...ships].sort((a, b) => String(b.lastUpdated || b.date).localeCompare(String(a.lastUpdated || a.date))));
      setRecords([...recs].sort((a, b) => String(b.date).localeCompare(String(a.date))));
      setLibrary(Array.isArray(lib) ? lib : []);
    } catch (e: any) {
      console.error('[Ministry] reload failed', e);
      toast(`Bakanlık kayıtları yüklenemedi: ${e?.message || e}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [setShipments, toast]);

  useEffect(() => {
    if (isOpen) void reload();
    else { setCameraOpen(false); setScanFeedback(null); }
  }, [isOpen, reload]);

  const pendingList = useMemo(() => shipments.filter(s => s.status === 'PENDING' && !s.deletedAt), [shipments]);
  const acceptedList = useMemo(() => shipments.filter(s => s.status === 'ACCEPTED' && !s.deletedAt), [shipments]);

  const upsertShipment = useCallback(async (rec: MinistryShipmentRecord): Promise<boolean> => {
    const withCount = { ...rec, itemCount: round2(rec.lines.reduce((a, l) => a + (Number(l.qty) || 0), 0)) };
    const res = await saveMinistryShipmentRecord(withCount);
    if (!res.ok) {
      playErrorBeep();
      toast(`Sevkiyat kaydedilemedi: ${res.error || 'depolama hatası'}`, 'error');
      return false;
    }
    const list = shipmentsRef.current;
    const idx = list.findIndex(s => s.id === withCount.id);
    const next = idx === -1 ? [withCount, ...list] : list.map(s => (s.id === withCount.id ? withCount : s));
    setShipments(withCount.deletedAt ? next.filter(s => s.id !== withCount.id) : next);
    return true;
  }, [setShipments, toast]);

  /** gtin|serial → where it already exists ('inventory' | 'accepted' | shipmentId). */
  const computeSerialIndex = useCallback((excludeShipmentId?: string) => {
    const map = new Map<string, string>();
    for (const s of shipmentsRef.current) {
      if (s.deletedAt || s.id === excludeShipmentId) continue;
      for (const l of s.lines) {
        if (l.serial) map.set(`${normalizeGtin(l.gtin)}|${l.serial}`, s.status === 'ACCEPTED' ? 'accepted' : s.id);
      }
    }
    for (const i of inventoryRef.current) {
      if (!i || i.deletedAt) continue;
      const g = normalizeGtin(i.gtin || i.barcode);
      (i.batches || []).forEach(b => (b.serialNumbers || []).forEach(sn => map.set(`${g}|${sn}`, 'inventory')));
      if (i.serialNumber) map.set(`${g}|${i.serialNumber}`, 'inventory');
    }
    return map;
  }, []);

  // ---- Scanning -----------------------------------------------------------
  const fail = useCallback((msg: string) => {
    playErrorBeep();
    setScanFeedback({ tone: 'error', text: msg });
    toast(msg, 'error');
  }, [toast]);

  const okScan = useCallback((msg: string, source: ScanSource) => {
    if (source !== 'hardware') playScanBeep(); // hardware bursts already beep once
    setScanFeedback({ tone: 'ok', text: msg });
  }, []);

  const [scanInput, setScanInput] = useState('');

  const newShipment = (patch: Partial<MinistryShipmentRecord>): MinistryShipmentRecord => ({
    id: generateUUID(),
    sscc: '',
    senderGln: '',
    senderName: '',
    waybillNo: '',
    itemCount: 0,
    date: todayISO(),
    status: 'PENDING',
    lines: [],
    ...patch,
  });

  const addSscc = async (sscc: string, source: ScanSource) => {
    if (!isValidGS1Number(sscc, 18)) {
      fail(`SSCC kontrol hanesi hatalı (${sscc}). Koli etiketini tekrar okutun.`);
      return;
    }
    const existing = shipmentsRef.current.find(s => s.sscc === sscc && !s.deletedAt);
    if (existing) {
      if (existing.status === 'ACCEPTED') {
        fail(`Bu koli (SSCC ${sscc}) ${fmtDate(existing.acceptedAt)} tarihinde zaten kabul edildi. Tekrar stoğa eklenemez.`);
        return;
      }
      setActiveShipmentId(existing.id);
      okScan('Koli zaten listede — seçildi. Ürün karekodlarını okutmaya devam edin.', source);
      return;
    }
    const rec = newShipment({ sscc });
    if (await upsertShipment(rec)) {
      setActiveShipmentId(rec.id);
      okScan(`Koli eklendi (SSCC ${sscc}). Şimdi koli içindeki ürün karekodlarını okutun.`, source);
    }
  };

  const addWaybill = async (no: string, source: ScanSource) => {
    const waybill = no.trim().slice(0, 40);
    const key = waybill.toLocaleUpperCase('tr-TR');
    const existing = shipmentsRef.current.find(s => !s.deletedAt && s.waybillNo && s.waybillNo.toLocaleUpperCase('tr-TR') === key);
    if (existing) {
      if (existing.status === 'ACCEPTED') { fail(`İrsaliye ${waybill} ${fmtDate(existing.acceptedAt)} tarihinde zaten kabul edildi.`); return; }
      setActiveShipmentId(existing.id);
      okScan('İrsaliye zaten listede — seçildi.', source);
      return;
    }
    const active = getActivePending();
    if (active && !active.waybillNo) {
      if (await upsertShipment({ ...active, waybillNo: waybill })) okScan(`İrsaliye no ${waybill} seçili sevkiyata işlendi.`, source);
      return;
    }
    const rec = newShipment({ waybillNo: waybill });
    if (await upsertShipment(rec)) {
      setActiveShipmentId(rec.id);
      okScan(`İrsaliye ${waybill} için sevkiyat açıldı. Ürün karekodlarını okutun.`, source);
    }
  };

  const productNameFor = (parsed: GS1ParseResult): { name: string; known: boolean } => {
    const inv = findItemByScan(inventoryRef.current, parsed);
    if (inv) return { name: inv.pesticideName, known: true };
    const lib = findItemByScan(library as { gtin?: string; barcode?: string; deletedAt?: string; name?: string }[], parsed);
    if (lib?.name) return { name: String(lib.name), known: true };
    return { name: `Yeni ürün ${canonicalBarcodeFromParsed(parsed)}`, known: false };
  };

  const addProductPack = async (input: GS1ParseResult, source: ScanSource) => {
    let parsed = input;
    if (parsed.ambiguous) {
      const lot = window.prompt(`${parsed.warnings[0] || 'Lot / Seri doğrulayın'}\n\nLot / Parti No:`, parsed.batch || '');
      if (lot === null) { fail('Okuma iptal edildi — Lot/Seri doğrulanmadı.'); return; }
      const ser = window.prompt('Seri No:', parsed.serial || '');
      if (ser === null) { fail('Okuma iptal edildi — Lot/Seri doğrulanmadı.'); return; }
      parsed = {
        ...parsed,
        batch: lot.trim() || undefined,
        serial: ser.trim() || undefined,
        ambiguous: false,
        errors: parsed.errors.filter(e => !e.startsWith('Ayırıcı (GS) yok')),
      };
    }
    if (parsed.errors.length) { fail(`Karekod hatalı: ${parsed.errors.join(' · ')}`); return; }
    if (parsed.expired) { fail(`SKT'si geçmiş ürün kabul edilemez (SKT ${fmtDate(parsed.expiryDate)}).`); return; }

    const gtinKey = parsed.gtin ? normalizeGtin(parsed.gtin) : canonicalBarcodeFromParsed(parsed);
    if (parsed.serial) {
      const where = computeSerialIndex().get(`${normalizeGtin(gtinKey)}|${parsed.serial}`);
      if (where) {
        fail(
          where === 'inventory'
            ? `Bu karekod (seri ${parsed.serial}) zaten depoda kayıtlı.`
            : where === 'accepted'
              ? `Bu karekod (seri ${parsed.serial}) daha önce kabul edilmiş bir sevkiyatta var.`
              : `Bu karekod (seri ${parsed.serial}) zaten okutuldu.`
        );
        return;
      }
    }

    let target = getActivePending();
    if (!target) target = newShipment({});
    const { name, known } = productNameFor(parsed);
    const line: MinistryShipmentLine = {
      gtin: gtinKey,
      name,
      batch: parsed.batch || '',
      expiry: parsed.expiryDate,
      serial: parsed.serial,
      qty: 1,
    };
    let lines = [...target.lines];
    if (!line.serial) {
      const same = lines.findIndex(l => !l.serial && normalizeGtin(l.gtin) === normalizeGtin(line.gtin) && (l.batch || '') === line.batch && (l.expiry || '') === (line.expiry || ''));
      if (same !== -1) lines[same] = { ...lines[same], qty: round2(lines[same].qty + 1) };
      else lines = [...lines, line];
    } else {
      lines = [...lines, line];
    }
    if (await upsertShipment({ ...target, lines })) {
      setActiveShipmentId(target.id);
      const d = daysUntilExpiry(parsed.expiryDate);
      okScan(
        `${name} · Lot ${line.batch || '—'} · SKT ${parsed.expiryDate ? fmtDate(parsed.expiryDate) : '—'}${line.serial ? ` · Seri ${line.serial}` : ''}${!known ? ' · depoda yok, kabulde yeni ürün açılacak' : ''}${d !== null && d <= 90 ? ` · SKT ${d} gün kaldı` : ''}`,
        source,
      );
    }
  };

  const handleScanText = async (raw: string, source: ScanSource, format?: string) => {
    const text = String(raw ?? '');
    if (!text.trim()) return;
    const parsed = parseGS1Barcode(text, format);

    if (activeService === 'BRECETE') {
      if (parsed.gtin) {
        setBreceteGtinInput(parsed.gtin);
        if (parsed.batch) setBreceteLotInput(parsed.batch);
        setTab('brecete');
        okScan('GTIN / Lot bilgisi B-Reçete bildirim formuna aktarıldı', source);
      } else {
        fail('B-Reçete ekranında ürün karekodu (GTIN) okutabilirsiniz.');
      }
      return;
    }
    if (tab !== 'receive') setTab('receive');

    if (parsed.sscc && !parsed.gtin) { await addSscc(parsed.sscc, source); return; }
    if (parsed.gtin) { await addProductPack(parsed, source); return; }
    if (parsed.type === 'RAW') {
      const cleaned = text.trim();
      if (/^(00)?\d{18}$/.test(cleaned)) { fail(`SSCC kontrol hanesi hatalı (${cleaned.slice(-18)}). Koli etiketini tekrar okutun.`); return; }
      if (findItemByScan(inventoryRef.current, parsed)) { await addProductPack(parsed, source); return; }
      await addWaybill(cleaned, source);
      return;
    }
    fail(`Karekod çözümlenemedi: ${parsed.errors.join(' · ') || 'bilinmeyen biçim'}`);
  };

  const scanHandlerRef = useRef(handleScanText);
  scanHandlerRef.current = handleScanText;

  useHardwareBarcodeScanner((parsed: GS1ParseResult) => {
    if (!isOpen || cameraOpen) return;
    void scanHandlerRef.current(parsed.raw, 'hardware');
  });

  // ---- Line editing -------------------------------------------------------
  const updateLine = (s: MinistryShipmentRecord, index: number, patch: Partial<MinistryShipmentLine>, persist: boolean) => {
    const lines = s.lines.map((l, i) => (i === index ? { ...l, ...patch } : l));
    const next = { ...s, lines };
    if (persist) void upsertShipment(next);
    else setShipments(shipmentsRef.current.map(x => (x.id === s.id ? next : x)));
  };
  const removeLine = (s: MinistryShipmentRecord, index: number) => {
    void upsertShipment({ ...s, lines: s.lines.filter((_, i) => i !== index) });
  };
  const updateShipmentField = (s: MinistryShipmentRecord, patch: Partial<MinistryShipmentRecord>, persist: boolean) => {
    const next = { ...s, ...patch };
    if (persist) void upsertShipment(next);
    else setShipments(shipmentsRef.current.map(x => (x.id === s.id ? next : x)));
  };
  const deleteShipment = async (s: MinistryShipmentRecord) => {
    if (s.status !== 'PENDING') return;
    if (!window.confirm('Bu bekleyen sevkiyat ve okutulan tüm kalemleri silinsin mi? (Stok etkilenmez)')) return;
    if (await upsertShipment({ ...s, deletedAt: new Date().toISOString() })) {
      if (activeIdRef.current === s.id) setActiveShipmentId(null);
      toast('Bekleyen sevkiyat silindi', 'info');
    }
  };

  // ---- Accept -------------------------------------------------------------
  const applyShipmentToInventory = async (s: MinistryShipmentRecord): Promise<Map<string, InventoryItem>> => {
    let fresh: InventoryItem[] = [];
    try {
      fresh = ((await dbService.getAllInventoryRaw()) as InventoryItem[]) || [];
    } catch (e) {
      console.warn('[Ministry] fresh inventory read failed, using context copy', e);
      fresh = inventoryRef.current;
    }
    const live = fresh.filter(i => i && !i.deletedAt);
    const groups = new Map<string, MinistryShipmentLine[]>();
    s.lines.forEach(l => {
      const k = normalizeGtin(l.gtin) || l.name;
      groups.set(k, [...(groups.get(k) || []), l]);
    });

    const now = new Date().toISOString();
    const note = `BKTS/GTS Mal Kabul${s.sscc ? ` (SSCC ${s.sscc})` : ''}${s.waybillNo ? ` · İrsaliye ${s.waybillNo}` : ''}${s.senderName ? ` · ${s.senderName}` : ''}`;
    const updates: InventoryItem[] = [];
    const creations: InventoryItem[] = [];
    const byGroup = new Map<string, InventoryItem>();

    for (const [key, lines] of groups) {
      const code = lines[0].gtin;
      const probe = parseGS1Barcode(code);
      const qty = round2(lines.reduce((a, l) => a + (Number(l.qty) || 0), 0));
      if (!(qty > 0)) continue;
      const existing = code ? findItemByScan(live, probe) : live.find(i => i.pesticideName.toLocaleLowerCase('tr-TR') === lines[0].name.toLocaleLowerCase('tr-TR'));
      const canonical = code ? canonicalBarcodeFromParsed(probe) : '';
      const gtin14 = probe.gtin ? normalizeGtin(probe.gtin) : undefined;
      if (existing) {
        const batches = mergeBatches(existing, lines);
        const legacyRawBarcode = existing.barcode && existing.barcode.length > 16;
        const updated: InventoryItem = {
          ...existing,
          quantity: round2((Number(existing.quantity) || 0) + qty),
          batches,
          ...batchSummary(batches),
          gtin: existing.gtin || gtin14,
          barcode: !existing.barcode || legacyRawBarcode ? canonical || existing.barcode : existing.barcode,
          adjustments: [...(existing.adjustments || []), { date: now, amount: qty, note }],
          lastUpdated: now,
        };
        updates.push(updated);
        byGroup.set(key, updated);
      } else {
        const lib = code ? findItemByScan(library as { id?: string; gtin?: string; barcode?: string; deletedAt?: string; name?: string; category?: PesticideCategory }[], probe) : undefined;
        const batches = mergeBatches(null, lines);
        const name = (lines[0].name || '').startsWith('Yeni ürün') && lib?.name ? String(lib.name) : lines[0].name || String(lib?.name || canonical);
        const created: InventoryItem = {
          id: generateUUID(),
          pesticideId: lib?.id || `bkts-${gtin14 || canonical || generateUUID()}`,
          pesticideName: name,
          category: lib?.category || (config.gts && !config.bkts ? PesticideCategory.FERTILIZER : PesticideCategory.OTHER),
          quantity: qty,
          unit: 'Adet',
          buyingPrice: 0,
          sellingPrice: 0,
          barcode: canonical || undefined,
          gtin: gtin14,
          batches,
          ...batchSummary(batches),
          adjustments: [{ date: now, amount: qty, note }],
          lastUpdated: now,
        };
        creations.push(created);
        byGroup.set(key, created);
      }
    }

    if (updates.length) {
      if (typeof vm.bulkUpdateInventoryItems === 'function') await vm.bulkUpdateInventoryItems(updates);
      else for (const u of updates) await dbService.updateInventoryItem(u);
    }
    for (const c of creations) {
      if (typeof vm.addInventoryItem === 'function') await vm.addInventoryItem(c);
      else await dbService.addInventoryItem(c);
    }
    try { await vm.refreshInventory?.(); } catch (e) { console.warn('[Ministry] inventory refresh failed', e); }
    return byGroup;
  };

  const acceptShipment = async (s: MinistryShipmentRecord) => {
    if (busyId) return;
    if (s.status === 'ACCEPTED') { fail('Bu sevkiyat zaten kabul edilmiş.'); return; }
    if (!s.lines.length || s.lines.every(l => !(Number(l.qty) > 0))) {
      fail('Kabul edilecek ürün kalemi yok. Koli içindeki ürün karekodlarını okutun.');
      return;
    }
    const registerToMinistry = !localOnly;
    if (registerToMinistry && !ministryActive) {
      fail(`${SERVICE_META[activeService].shortLabel} resmi kaydı kapalı. Hesap girişinizi tamamlayın veya "Bakanlık kaydı yok" seçeneğini işaretleyin.`);
      return;
    }
    if (s.sscc && shipmentsRef.current.some(o => o.id !== s.id && !o.deletedAt && o.sscc === s.sscc && o.status === 'ACCEPTED')) {
      fail(`Bu koli (SSCC ${s.sscc}) zaten kabul edilmiş.`);
      return;
    }
    const idx = computeSerialIndex(s.id);
    const dup = s.lines.find(l => l.serial && (idx.get(`${normalizeGtin(l.gtin)}|${l.serial}`) === 'inventory' || idx.get(`${normalizeGtin(l.gtin)}|${l.serial}`) === 'accepted'));
    if (dup) { fail(`Seri ${dup.serial} (${dup.name}) zaten depoda / kabul edilmiş. Satırı silip tekrar deneyin.`); return; }
    const totalQty = round2(s.lines.reduce((a, l) => a + (Number(l.qty) || 0), 0));
    if (!window.confirm(`${s.lines.length} satır, toplam ${totalQty} adet depoya eklenecek${registerToMinistry ? ' ve Bakanlık dışa aktarım defterine "Dışa Aktarıma Hazır" olarak yazılacak' : ''}. Onaylıyor musunuz?`)) return;

    setBusyId(s.id);
    const acceptedAt = new Date().toISOString();
    // 1) Mark ACCEPTED first so a crash can never allow a second (double-stock) acceptance.
    const accepted: MinistryShipmentRecord = { ...s, status: 'ACCEPTED', acceptedAt };
    if (!(await upsertShipment(accepted))) { setBusyId(null); return; }
    let byGroup: Map<string, InventoryItem>;
    try {
      // 2) Stock in
      if (onAcceptShipment) {
        await onAcceptShipment(recordToLegacyShipment(s), { registerToMinistry, config });
        byGroup = new Map();
      } else {
        byGroup = await applyShipmentToInventory(s);
      }
    } catch (err: any) {
      console.error('[Ministry] stock-in failed', err);
      await upsertShipment({ ...s, status: 'PENDING', acceptedAt: undefined });
      fail(`Mal kabul başarısız, stok değişmedi: ${err?.message || err}`);
      setBusyId(null);
      return;
    }

    // 3) Ledger
    const ledger: MinistryLedgerRecord[] = s.lines.filter(l => Number(l.qty) > 0).map(l => {
      const item = byGroup.get(normalizeGtin(l.gtin) || l.name);
      return {
        id: generateUUID(),
        system: activeService === 'GTS' ? 'GTS' : activeService === 'BKTS' ? 'BKTS' : (isFertilizer(item?.category) || (config.gts && !config.bkts) ? 'GTS' : 'BKTS'),
        recordType: 'SHIPMENT_ACCEPT',
        date: acceptedAt,
        documentNo: s.waybillNo || s.sscc || s.id.slice(0, 8).toUpperCase(),
        senderGln: s.senderGln || undefined,
        receiverGln: config.gln || undefined,
        supplierName: s.senderName || undefined,
        sscc: s.sscc || undefined,
        waybillNo: s.waybillNo || undefined,
        pesticideId: item?.pesticideId,
        productName: item?.pesticideName || l.name,
        gtin: l.gtin,
        lotNumber: l.batch || '',
        serialNumber: l.serial,
        expiryDate: l.expiry,
        quantity: l.qty,
        unit: item?.unit || 'Adet',
        status: registerToMinistry ? 'Dışa Aktarıma Hazır' : FREE_SALE_STATUS,
      };
    });
    const res = await saveMinistryRecords(ledger);
    if (res.ok) setRecords(prev => [...ledger, ...prev]);
    setActiveShipmentId(null);
    setBusyId(null);
    if (!res.ok) {
      toast(`Stok eklendi (${totalQty} adet) ancak Bakanlık defteri yazılamadı: ${res.error || 'depolama hatası'}`, 'error');
      return;
    }
    playScanBeep();
    toast(
      registerToMinistry
        ? `Mal kabul tamamlandı: ${totalQty} adet depoya eklendi, ${ledger.length} kayıt dışa aktarıma hazır.`
        : `Mal kabul tamamlandı: ${totalQty} adet depoya eklendi (Bakanlık kaydı yok).`,
      'success',
    );
  };

  // ---- Ledger / export (scoped strictly to activeService) -------------
  const serviceRecords = useMemo(() => {
    return records.filter(r => {
      if (r.deletedAt) return false;
      if (activeService === 'GTS') return r.system === 'GTS';
      if (activeService === 'BKTS') return r.system === 'BKTS';
      return Boolean(r.bReceteCode) || r.system === 'BKTS';
    });
  }, [records, activeService]);

  const filteredRecords = useMemo(() => {
    const q = ledgerQuery.trim().toLocaleLowerCase('tr-TR');
    return serviceRecords.filter(r => {
      if (ledgerType !== 'ALL' && r.recordType !== ledgerType) return false;
      if (!q) return true;
      return [r.productName, r.farmerName, r.farmerTcNo, r.gtin, r.lotNumber, r.serialNumber, r.documentNo, r.supplierName, r.bReceteCode]
        .some(v => String(v ?? '').toLocaleLowerCase('tr-TR').includes(q));
    });
  }, [serviceRecords, ledgerQuery, ledgerType]);

  const officialRecords = useMemo(() => filterOfficialMinistryRecords(filteredRecords), [filteredRecords]);
  const counts = useMemo(() => ({
    reported: serviceRecords.filter(r => r.status === 'Bakanlığa Bildirildi').length,
    ready: serviceRecords.filter(r => r.status === 'Dışa Aktarıma Hazır').length,
    free: serviceRecords.filter(r => r.status === FREE_SALE_STATUS).length,
    accept: serviceRecords.filter(r => r.recordType === 'SHIPMENT_ACCEPT').length,
  }), [serviceRecords]);

  const exportRows = (rows: MinistryLedgerRecord[]): MinistryExportRecord[] =>
    rows.map(r => {
      const isInbound = r.recordType === 'SHIPMENT_ACCEPT' || r.recordType === 'RETURN';
      return {
        ...r,
        senderGln: isInbound ? (r.senderGln || undefined) : (r.senderGln || config.gln || undefined),
        receiverGln: isInbound ? (r.receiverGln || config.gln || undefined) : r.receiverGln,
        prescriptionNo: r.documentNo,
      };
    });

  const reportShare = (result: 'shared' | 'downloaded' | 'cancelled', fileName: string) => {
    if (result === 'shared') toast('Paylaşım ekranı açıldı', 'success');
    else if (result === 'downloaded') toast(`Dosya indirildi: ${fileName}`, 'success');
  };

  const exportFile = async (format: 'xml' | 'txt' | 'csv') => {
    if (exporting) return;
    const rows = format === 'txt' ? officialRecords.filter(r => r.gtin) : officialRecords;
    if (rows.length === 0) {
      toast(filteredRecords.length ? `Dışa aktarılacak kayıtlı (${SERVICE_META[activeService].shortLabel}) satır yok — serbest satışlar resmi dosyaya girmez.` : 'Dışa aktarılacak kayıt yok', 'error');
      return;
    }
    setExporting(format);
    try {
      const f = generateMinistryExportFile(exportRows(rows), format);
      const result = await shareOrDownload(f.fileName, new Blob([f.content], { type: f.mimeType }), `MKS ${SERVICE_META[activeService].shortLabel} dışa aktarım dosyası`);
      reportShare(result, f.fileName);
    } catch (e: any) {
      console.error('[Ministry] export failed', e);
      toast(`Dışa aktarma başarısız: ${e?.message || e}`, 'error');
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (exporting) return;
    if (officialRecords.length === 0) { toast(`Deftere yazılacak kayıtlı (${SERVICE_META[activeService].shortLabel}) satır yok`, 'error'); return; }
    setExporting('pdf');
    try {
      const { jsPDF, autoTable } = await loadJsPdfWithAutoTable();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfHeading =
        activeService === 'GTS'
          ? 'Gübre Takip Sistemi (GTS) Satış ve Mal Kabul Denetim Defteri'
          : activeService === 'BRECETE'
            ? 'B-Reçete Resmi Satış ve Bildirim Denetim Defteri'
            : 'Bitki Koruma Ürünleri Takip Sistemi (BKTS) Denetim Defteri';
      doc.setFontSize(13);
      doc.text(pdfSafe(pdfHeading), 14, 14);
      doc.setFontSize(8.5);
      doc.text(pdfSafe(`Bayi: ${userProfile?.companyName || userProfile?.fullName || '-'} · GLN: ${config.gln || '-'} · Düzenlenme: ${new Date().toLocaleString('tr-TR')} · Kayıt: ${officialRecords.length}`), 14, 20);
      doc.text(pdfSafe('Durum: Resmi XML / CSV / PDF Denetim Çıktısı'), 14, 24.5);
      autoTable(doc, {
        startY: 28,
        head: [['Tarih', 'Sistem', 'Tür', 'TCKN/VKN', 'Alıcı / Tedarikçi', 'Ürün', 'GTIN', 'Seri No', 'Lot', 'SKT', 'Miktar', 'Belge No'].map(pdfSafe)],
        body: officialRecords.map(r => [
          fmtDate(r.date), r.system, RECORD_TYPE_LABEL[r.recordType] || r.recordType, r.farmerTcNo || '-', r.farmerName || r.supplierName || '-',
          r.productName, r.gtin || '-', r.serialNumber || '-', r.lotNumber || '-', r.expiryDate ? fmtDate(r.expiryDate) : '-',
          `${r.quantity} ${r.unit || ''}`.trim(), r.bReceteCode ? `${r.documentNo} / B-${r.bReceteCode}` : r.documentNo,
        ].map(pdfSafe)),
        styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak' },
        headStyles: { fillColor: [16, 122, 87], textColor: 255 },
        alternateRowStyles: { fillColor: [244, 247, 245] },
      });
      const finalY = ((doc as any).lastAutoTable?.finalY as number | undefined) ?? 40;
      const sigY = Math.min(finalY + 18, doc.internal.pageSize.getHeight() - 12);
      doc.setFontSize(9);
      doc.text(pdfSafe('Bayi Kaşe / İmza'), 14, sigY);
      doc.text(pdfSafe('Denetim Elemanı'), doc.internal.pageSize.getWidth() - 60, sigY);
      const prefix = activeService === 'GTS' ? 'gts' : activeService === 'BRECETE' ? 'brecete' : 'bkts';
      const fileName = `${prefix}_denetim_defteri_${todayISO()}.pdf`;
      const auditPdfBlob = doc.output('blob');
      void archivePdf(fileName, auditPdfBlob);
      const result = await shareOrDownload(fileName, auditPdfBlob, `MKS ${SERVICE_META[activeService].shortLabel} Denetim Defteri (PDF)`);
      reportShare(result, fileName);
    } catch (e: any) {
      console.error('[Ministry] PDF failed', e);
      toast(`PDF oluşturulamadı: ${e?.message || e}`, 'error');
    } finally {
      setExporting(null);
    }
  };

  // ---- B-Reçete & Resmi Satış Bildirimi helpers ---------------------------
  const farmerById = useMemo(() => {
    const m = new Map<string, Farmer>();
    farmers.forEach(f => m.set(f.id, f));
    return m;
  }, [farmers]);

  const invoiceList = useMemo(() => {
    const q = breceteSearch.trim().toLocaleLowerCase('tr-TR');
    return [...prescriptions]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter(p => {
        if (!q) return true;
        const fr = farmerById.get(p.farmerId);
        return [p.prescriptionNo, fr?.fullName, fr?.tcNo, p.crop, p.bReceteCode, ...(p.items || []).map(it => it.pesticideName)]
          .some(v => String(v ?? '').toLocaleLowerCase('tr-TR').includes(q));
      })
      .slice(0, 40);
  }, [prescriptions, farmerById, breceteSearch]);

  const selectedInvoice = useMemo(
    () => prescriptions.find(p => p.id === selectedInvoiceId) || null,
    [prescriptions, selectedInvoiceId],
  );

  const handleSelectInvoiceForBrecete = (p: Prescription) => {
    setSelectedInvoiceId(p.id);
    const fr = farmerById.get(p.farmerId);
    setBreceteCodeInput(p.bReceteCode || '');
    setBreceteDocNo(p.prescriptionNo || '');
    setBreceteTcInput(fr?.tcNo || '');
  };

  const handleSubmitInvoiceToMinistry = async () => {
    if (!selectedInvoice || savingBrecete) return;
    const fr = farmerById.get(selectedInvoice.farmerId);
    const tcVal = validateTcOrVkn(breceteTcInput.trim());
    if (!tcVal.isValid || tcVal.status === 'EMPTY') {
      fail('Resmi kayıt (BKTS/GTS/B-Reçete) için çiftçinin geçerli 10/11 haneli VKN veya TCKN numarasını girin.');
      return;
    }
    setSavingBrecete(true);
    try {
      const nowIso = selectedInvoice.date || new Date().toISOString();
      const rows: MinistryLedgerRecord[] = (selectedInvoice.items || []).map(it => {
        const invMatch = inventory.find(inv => inv.pesticideId === it.pesticideId);
        const sys: 'BKTS' | 'GTS' = activeService === 'GTS' ? 'GTS' : activeService === 'BKTS' ? 'BKTS' : (isFertilizer(invMatch?.category) || breceteSystem === 'GTS' ? 'GTS' : 'BKTS');
        return {
          id: generateUUID(),
          system: sys,
          recordType: selectedInvoice.type === 'RETURN' ? 'RETURN' : 'FARMER_SALE',
          date: nowIso,
          documentNo: (breceteDocNo.trim() || selectedInvoice.prescriptionNo || '').slice(0, 40),
          prescriptionId: selectedInvoice.id,
          bReceteCode: breceteCodeInput.trim() || undefined,
          farmerId: fr?.id || selectedInvoice.farmerId,
          farmerName: fr?.fullName || 'Çiftçi',
          farmerTcNo: breceteTcInput.trim(),
          pesticideId: it.pesticideId,
          productName: it.pesticideName,
          gtin: normalizeGtin(it.gtin || invMatch?.gtin || invMatch?.barcode) || '',
          lotNumber: it.lotNumber || invMatch?.lotNumber || '',
          serialNumber: it.serialNumbers?.[0],
          expiryDate: it.expiryDate || invMatch?.expiryDate,
          quantity: round2(Math.abs(Number(String(it.quantity || '1').replace(',', '.')) || 1)),
          unit: invMatch?.unit || 'Adet',
          status: 'Dışa Aktarıma Hazır',
        };
      });
      if (!rows.length) {
        fail('Seçili faturada ürün kalemi bulunamadı.');
        setSavingBrecete(false);
        return;
      }
      const res = await saveMinistryRecords(rows);
      if (!res.ok) {
        fail(`Resmi deftere yazılamadı: ${res.error || 'depolama hatası'}`);
        setSavingBrecete(false);
        return;
      }
      setRecords(prev => [...rows, ...prev]);
      playScanBeep();
      toast(`${rows.length} kalem resmi ${activeMeta.shortLabel} defterine işlendi (XML/CSV/PDF dışa aktarıma hazır).`, 'success');
      setTab('ledger');
      setSelectedInvoiceId('');
      setBreceteCodeInput('');
    } finally {
      setSavingBrecete(false);
    }
  };

  const handleCreateManualBrecete = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (savingBrecete) return;
    const fr = farmerById.get(breceteFarmerId);
    const tcRaw = (breceteTcInput || fr?.tcNo || '').trim();
    const tcVal = validateTcOrVkn(tcRaw);
    if (!tcVal.isValid || tcVal.status === 'EMPTY') {
      fail('Geçerli 11 haneli TCKN veya 10 haneli VKN girin.');
      return;
    }
    if (!breceteProductInput.trim()) {
      fail('Ürün adını girin veya seçin.');
      return;
    }
    const qty = round2(Number(breceteQtyInput.replace(',', '.')) || 0);
    if (!(qty > 0)) {
      fail('Miktar 0\'dan büyük olmalıdır.');
      return;
    }
    setSavingBrecete(true);
    try {
      const invMatch = inventory.find(inv => inv.pesticideName.toLocaleLowerCase('tr-TR') === breceteProductInput.trim().toLocaleLowerCase('tr-TR'));
      const rec: MinistryLedgerRecord = {
        id: generateUUID(),
        system: activeService === 'GTS' ? 'GTS' : activeService === 'BKTS' ? 'BKTS' : breceteSystem,
        recordType: 'FARMER_SALE',
        date: new Date().toISOString(),
        documentNo: (breceteDocNo.trim() || `BR-${Date.now().toString().slice(-6)}`).slice(0, 40),
        bReceteCode: breceteCodeInput.trim() || undefined,
        farmerId: fr?.id,
        farmerName: fr?.fullName || 'Kayıtlı Çiftçi',
        farmerTcNo: tcRaw,
        pesticideId: invMatch?.pesticideId,
        productName: breceteProductInput.trim(),
        gtin: normalizeGtin(breceteGtinInput.trim() || invMatch?.gtin || invMatch?.barcode) || '',
        lotNumber: breceteLotInput.trim() || invMatch?.lotNumber || '',
        expiryDate: breceteSktInput.trim() || invMatch?.expiryDate,
        quantity: qty,
        unit: invMatch?.unit || 'Adet',
        status: 'Dışa Aktarıma Hazır',
      };
      const res = await saveMinistryRecords([rec]);
      if (!res.ok) {
        fail(`B-Reçete kaydı yazılamadı: ${res.error || 'depolama hatası'}`);
        setSavingBrecete(false);
        return;
      }
      setRecords(prev => [rec, ...prev]);
      playScanBeep();
      toast(`${activeMeta.shortLabel} resmi satış kaydı deftere eklendi (XML/CSV/PDF dışa aktarıma hazır).`, 'success');
      setTab('ledger');
      setBreceteProductInput('');
      setBreceteGtinInput('');
      setBreceteLotInput('');
      setBreceteSktInput('');
      setBreceteQtyInput('1');
      setBreceteCodeInput('');
      setBreceteDocNo('');
    } finally {
      setSavingBrecete(false);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] =
    activeService === 'GTS'
      ? [
          { id: 'receive', label: '1. Gübre Mal Kabul', icon: <Factory size={16} />, badge: pendingList.length || undefined },
          { id: 'brecete', label: '2. Gübre Satış Bildirimi', icon: <Sprout size={16} /> },
          { id: 'ledger', label: '3. GTS Denetim Defteri', icon: <ScrollText size={16} />, badge: counts.ready || undefined },
          { id: 'webservice', label: '4. Resmî Portal & Hesap', icon: <Globe size={16} /> },
        ]
      : activeService === 'BRECETE'
        ? [
            { id: 'brecete', label: '1. B-Reçete & Resmi Satış Kaydı', icon: <ShieldCheck size={16} /> },
            { id: 'ledger', label: '2. B-Reçete Denetim Defteri', icon: <ScrollText size={16} />, badge: counts.ready || undefined },
            { id: 'webservice', label: '3. Resmî Portal & Hesap', icon: <Globe size={16} /> },
          ]
        : [
            { id: 'receive', label: '1. İlaç Mal Kabul (Karekod / SSCC)', icon: <Factory size={16} />, badge: pendingList.length || undefined },
            { id: 'brecete', label: '2. BKTS Satış Bildirimi', icon: <QrCode size={16} /> },
            { id: 'ledger', label: '3. BKTS Denetim Defteri', icon: <ScrollText size={16} />, badge: counts.ready || undefined },
            { id: 'webservice', label: '4. Resmî Portal & Hesap', icon: <Globe size={16} /> },
          ];

  const renderLine = (s: MinistryShipmentRecord, l: MinistryShipmentLine, i: number, editable: boolean) => {
    const d = daysUntilExpiry(l.expiry);
    const isNew = l.name.startsWith('Yeni ürün');
    return (
      <div key={`${l.gtin}-${l.serial || l.batch}-${i}`} className="rounded-xl border p-2.5 flex flex-col sm:flex-row sm:items-center gap-2" style={surface}>
        <div className="flex-1 min-w-0">
          {editable ? (
            <input
              value={l.name}
              onChange={e => updateLine(s, i, { name: e.target.value }, false)}
              onBlur={e => updateLine(s, i, { name: e.target.value.trim() || l.name }, true)}
              aria-label="Ürün adı"
              className={`w-full min-h-[40px] rounded-lg border px-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/40 ${isNew ? 'border-amber-500/60' : ''}`}
              style={isNew ? { ...inputStyle, borderColor: undefined } : inputStyle}
            />
          ) : (
            <div className="text-sm font-semibold truncate">{l.name}</div>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono" style={mutedStyle}>
            <span>GTIN {l.gtin || '—'}</span>
            <span>Lot {l.batch || '—'}</span>
            <span className={d !== null && d < 0 ? 'text-red-500 font-bold' : d !== null && d <= 90 ? 'text-amber-500 font-bold' : ''}>
              SKT {l.expiry ? fmtDate(l.expiry) : '—'}{d !== null && d <= 90 ? ` (${d < 0 ? 'geçmiş' : `${d} gün`})` : ''}
            </span>
            {l.serial && <span>Seri {l.serial}</span>}
            {isNew && <span className="text-amber-500 font-sans font-bold">Depoda yok — adı kontrol edin</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {editable && !l.serial ? (
            <>
              <button type="button" aria-label="Azalt" onClick={() => l.qty > 1 ? updateLine(s, i, { qty: round2(l.qty - 1) }, true) : removeLine(s, i)} className="w-11 h-11 rounded-xl border flex items-center justify-center" style={subSurface}><Minus size={16} /></button>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={l.qty}
                aria-label="Miktar"
                onChange={e => { const v = Number(e.target.value.replace(',', '.')); if (Number.isFinite(v) && v >= 0) updateLine(s, i, { qty: round2(v) }, false); }}
                onBlur={() => updateLine(s, i, {}, true)}
                className="w-16 min-h-[44px] rounded-xl border text-center text-sm font-bold outline-none"
                style={inputStyle}
              />
              <button type="button" aria-label="Artır" onClick={() => updateLine(s, i, { qty: round2(l.qty + 1) }, true)} className="w-11 h-11 rounded-xl border flex items-center justify-center" style={subSurface}><Plus size={16} /></button>
            </>
          ) : (
            <span className="px-3 min-h-[44px] flex items-center text-sm font-bold">{l.qty} adet</span>
          )}
          {editable && (
            <button type="button" aria-label={`${l.name} satırını sil`} onClick={() => removeLine(s, i)} className="w-11 h-11 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500/10">
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderShipment = (s: MinistryShipmentRecord) => {
    const pending = s.status === 'PENDING';
    const active = s.id === activeShipmentId;
    const total = round2(s.lines.reduce((a, l) => a + (Number(l.qty) || 0), 0));
    return (
      <div key={s.id} className={`rounded-2xl border p-3 sm:p-4 space-y-3 ${active ? 'ring-2 ring-emerald-500/60' : ''}`} style={subSurface}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={() => pending && setActiveShipmentId(active ? null : s.id)} className="min-w-0 text-left min-h-[44px]" aria-pressed={active}>
            <div className="flex items-center gap-2 text-sm font-bold">
              <Package size={16} className={pending ? 'text-amber-500' : 'text-emerald-500'} />
              <span className="truncate">{s.senderName || (s.sscc ? 'SSCC Koli' : 'Sevkiyat')}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${pending ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'}`}>
                {pending ? (active ? 'Okutma hedefi' : 'Bekliyor') : `Kabul ${fmtDate(s.acceptedAt)}`}
              </span>
            </div>
            <div className="text-[11px] font-mono mt-1 flex flex-wrap gap-x-3" style={mutedStyle}>
              {s.sscc && <span>SSCC {s.sscc}</span>}
              {s.waybillNo && <span>İrsaliye {s.waybillNo}</span>}
              <span>{fmtDate(s.date)}</span>
              <span>{s.lines.length} satır · {total} adet</span>
            </div>
          </button>
          {pending && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => deleteShipment(s)} aria-label="Bekleyen sevkiyatı sil" className="w-11 h-11 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500/10"><Trash2 size={17} /></button>
              <button
                type="button"
                onClick={() => acceptShipment(s)}
                disabled={!!busyId || s.lines.length === 0}
                className="min-h-[44px] flex items-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-50"
                style={accentStyle}
              >
                {busyId === s.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {busyId === s.id ? 'İşleniyor…' : 'Mal Kabulü Onayla & Depoya Ekle'}
              </button>
            </div>
          )}
        </div>

        {pending && (active || s.lines.length === 0) && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={s.senderName}
              onChange={e => updateShipmentField(s, { senderName: e.target.value }, false)}
              onBlur={e => updateShipmentField(s, { senderName: e.target.value.trim() }, true)}
              placeholder="Gönderen firma"
              aria-label="Gönderen firma"
              className="min-h-[44px] rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
              style={inputStyle}
            />
            <input
              value={s.waybillNo}
              onChange={e => updateShipmentField(s, { waybillNo: e.target.value }, false)}
              onBlur={e => updateShipmentField(s, { waybillNo: e.target.value.trim() }, true)}
              placeholder="İrsaliye No"
              aria-label="İrsaliye numarası"
              className="min-h-[44px] rounded-xl border px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
              style={inputStyle}
            />
          </div>
        )}

        {s.lines.length === 0 ? (
          <p className="text-xs" style={mutedStyle}>Henüz ürün yok. Bu sevkiyatı seçip koli içindeki ürün karekodlarını (DataMatrix / QR) okutun.</p>
        ) : (
          <div className="space-y-2">{s.lines.map((l, i) => renderLine(s, l, i, pending))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ministry-modal-title"
        className="w-full max-w-6xl max-h-[92dvh] rounded-t-3xl sm:rounded-3xl border overflow-hidden flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'var(--mks-modal-bg)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
      >
        {/* Header (Servis Bazlı Kurumsal Başlık) */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--mks-card-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border"
                style={{
                  background: `${activeMeta.accentHex}1f`,
                  borderColor: `${activeMeta.accentHex}55`,
                  color: activeMeta.accentHex,
                }}
              >
                {activeService === 'GTS' ? <Sprout size={22} /> : activeService === 'BRECETE' ? <ShieldCheck size={22} /> : <QrCode size={22} />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="ministry-modal-title" className="text-base sm:text-lg font-black tracking-tight truncate">
                    {activeMeta.title}
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-black"
                    style={{
                      background: `${activeMeta.accentHex}18`,
                      borderColor: `${activeMeta.accentHex}44`,
                      color: activeMeta.accentHex,
                    }}
                  >
                    {isAuthenticated ? 'Oturum Açık' : 'Giriş Gerekli'}
                  </span>
                </div>
                <p className="text-xs truncate" style={mutedStyle}>{activeMeta.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openOfficialPortalWindow()}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold hover:opacity-90"
                style={subSurface}
              >
                <ExternalLink size={13} />
                <span>Resmî Portalı Aç</span>
              </button>
              <ModalCloseButton onClick={onClose} label={`${activeMeta.shortLabel} penceresini kapat`} />
            </div>
          </div>

          {isAuthenticated && activeAuth && (
            <div className="mt-3 rounded-2xl border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs" style={subSurface}>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <ShieldCheck size={15} className="shrink-0" style={{ color: activeMeta.accentHex }} />
                <span className="font-bold truncate">
                  Bağlı Hesap ({activeMeta.id === 'BRECETE' ? 'TCKN' : 'TCKN / VKN'}):{' '}
                  <span className="font-mono">{activeAuth.username}</span>
                </span>
                {(loginAutoEntered || activeAuth.remember) && (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 text-[10px] font-black text-emerald-500">
                    {loginAutoEntered ? 'Otomatik Giriş Yapıldı' : 'Otomatik Giriş Kayıtlı'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openOfficialPortalWindow()}
                  className="sm:hidden inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold"
                  style={surface}
                >
                  <ExternalLink size={12} /> Portal
                </button>
                <button
                  type="button"
                  onClick={handleServiceLogout}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  <LogOut size={13} />
                  <span>Hesap / Çıkış</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {isAuthenticated && (
          <div className="mks-tab-rail px-3 pt-2.5 pb-2 border-b flex gap-2 overflow-x-auto" role="tablist" style={{ borderColor: 'var(--mks-card-border)' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="shrink-0 min-h-[44px] flex items-center gap-2 whitespace-nowrap px-3.5 text-xs font-bold rounded-xl border transition-colors"
                style={tab === t.id ? { ...accentStyle, borderColor: 'transparent' } : subSurface}
              >
                {t.icon}{t.label}
                {t.badge ? <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] flex items-center justify-center ${tab === t.id ? 'bg-white/25' : 'bg-emerald-500/20 text-emerald-500'}`}>{t.badge}</span> : null}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {!isAuthenticated ? (
            <div className="max-w-xl mx-auto py-2 sm:py-6 space-y-4">
              <form onSubmit={handleServiceLogin} className="rounded-3xl border p-5 sm:p-6 space-y-4 shadow-lg" style={surface}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border"
                    style={{
                      background: `${activeMeta.accentHex}1f`,
                      borderColor: `${activeMeta.accentHex}55`,
                      color: activeMeta.accentHex,
                    }}
                  >
                    <Lock size={22} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black">{activeMeta.loginTitle}</h3>
                    <p className="text-xs leading-relaxed" style={mutedStyle}>{activeMeta.loginDesc}</p>
                  </div>
                </div>

                {loginError && (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-400 flex items-start gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold" style={mutedStyle}>{activeMeta.idLabel} *</span>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={mutedStyle} />
                      <input
                        type="text"
                        inputMode={activeService === 'BKTS' ? 'text' : 'numeric'}
                        value={loginUsername}
                        onChange={e =>
                          setLoginUsername(
                            activeService === 'BKTS'
                              ? e.target.value
                              : e.target.value.replace(/\D/g, '').slice(0, 11),
                          )
                        }
                        placeholder={activeMeta.idPlaceholder}
                        autoComplete="username"
                        className="w-full min-h-[46px] border rounded-xl pl-10 pr-3.5 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/40"
                        style={inputStyle}
                      />
                    </div>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold" style={mutedStyle}>{activeMeta.passwordLabel} *</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type={loginShowPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="flex-1 min-h-[46px] border rounded-xl px-3.5 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/40"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setLoginShowPassword(v => !v)}
                        aria-label={loginShowPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        className="min-h-[46px] w-11 shrink-0 rounded-xl border flex items-center justify-center"
                        style={subSurface}
                      >
                        {loginShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 cursor-pointer" style={subSurface}>
                    <input
                      type="checkbox"
                      checked={loginRemember}
                      onChange={e => setLoginRemember(e.target.checked)}
                      className="h-5 w-5 shrink-0 accent-emerald-500 rounded"
                    />
                    <div className="text-xs">
                      <div className="font-bold">Beni Hatırla — Sonraki Girişlerde Otomatik Bağlan</div>
                      <div className="text-[11px]" style={mutedStyle}>
                        İşaretliyken {activeMeta.shortLabel} ekranını her açtığınızda giriş adımı atlanıp doğrudan çalışma alanınız açılır.
                      </div>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[48px] rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95"
                  style={{ background: activeMeta.accentHex, color: '#ffffff' }}
                >
                  <ShieldCheck size={18} />
                  {`Giriş Yap ve ${activeMeta.shortLabel} Ekranını Aç`}
                </button>
              </form>

              <div className="rounded-2xl border p-4 space-y-2.5 text-xs" style={subSurface}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black flex items-center gap-1.5">
                    <Globe size={15} style={{ color: activeMeta.accentHex }} />
                    <span>Resmî Portal Üzerinden İşlem (Alternatif)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openOfficialPortalWindow()}
                    className="rounded-xl border px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                    style={surface}
                  >
                    <ExternalLink size={13} /> {activeMeta.portalLabel}
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed" style={mutedStyle}>
                  {activeService === 'GTS'
                    ? 'Resmî GTS web portalı (gtsapp.tarimorman.gov.tr) giriş sırasında görsel güvenlik kodu (Captcha) ve Mobil Onay (SMS) istediği ve .gov.tr sayfaları gömülü iframe içinde açılamadığı için MKS üzerinden SMS kodu gönderilemez. Uygulama içi mal kabul, karekod ve defter işlemleri için yukarıdan doğrudan giriş yapabilir; SMS onaylı resmî web oturumu için portalı ayrı pencerede açabilirsiniz.'
                    : 'Devlet portalları (.gov.tr ve e-Devlet) tarayıcı güvenlik politikası gereği gömülü iframe içinde açılamaz; bu nedenle tüm mal kabul, satış bildirimi ve denetim defteri işlemleri öncelikli olarak buradan uygulama içinde çalışır. İhtiyaç duyduğunuzda resmî site yukarıdaki butonla uygulama boyutunda ayrı pencerede açılır.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {loading && (
                <div className="flex items-center gap-2 text-xs mb-3" style={mutedStyle}><Loader2 size={14} className="animate-spin" /> Kayıtlar yükleniyor…</div>
              )}

              {/* TAB 1 — Mal kabul */}
              {tab === 'receive' && activeService !== 'BRECETE' && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-3 sm:p-4 space-y-3" style={surface}>
                <form
                  className="flex flex-col sm:flex-row gap-2"
                  onSubmit={e => { e.preventDefault(); const v = scanInput; setScanInput(''); void handleScanText(v, 'manual'); }}
                >
                  <div className="relative flex-1">
                    <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={mutedStyle} />
                    <input
                      value={scanInput}
                      data-barcode-input="true"
                      onChange={e => setScanInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); const v = scanInput; setScanInput(''); void handleScanText(v, 'manual'); }
                      }}
                      placeholder={
                        activeService === 'GTS'
                          ? 'Gübre Karekod / Barkod okutun veya İrsaliye No girin'
                          : 'SSCC koli / zirai ilaç karekodu okutun veya İrsaliye No girin'
                      }
                      aria-label="Karekod veya irsaliye numarası"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full min-h-[48px] border rounded-xl pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 sm:flex-none min-h-[48px] flex items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold" style={subSurface}>
                      <Plus size={16} /> Ekle
                    </button>
                    <button type="button" onClick={() => setCameraOpen(true)} className="flex-1 sm:flex-none min-h-[48px] flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold" style={accentStyle}>
                      <Camera size={16} /> Kamera
                    </button>
                  </div>
                </form>

                {scanFeedback && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold flex items-start gap-2 ${scanFeedback.tone === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-500' : scanFeedback.tone === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-stone-500/10 border-stone-500/30'}`}
                  >
                    {scanFeedback.tone === 'error' ? <AlertTriangle size={15} className="shrink-0" /> : <CheckCircle2 size={15} className="shrink-0" />}
                    <span>{scanFeedback.text}</span>
                  </div>
                )}

                <label className="flex items-center gap-3 rounded-xl border px-3 min-h-[48px] cursor-pointer" style={subSurface}>
                  <input type="checkbox" checked={localOnly} onChange={e => setLocalOnly(e.target.checked)} className="h-5 w-5 shrink-0 accent-emerald-500 rounded" />
                  <span className="text-xs sm:text-sm font-semibold">{activeMeta.shortLabel} kaydı yok (sadece kendi depoma ekle, resmi dosyaya girmez)</span>
                </label>
                <p className="text-[11px]" style={mutedStyle}>
                  Akış: 1) Koli SSCC etiketini okutun · 2) Koli içindeki her ürünün karekodunu okutun (Lot / SKT / Seri otomatik) · 3) Onaylayın — stok, parti ve seri numaraları depoya yazılır. Aynı koli veya seri ikinci kez kabul edilemez.
                </p>
              </div>

              {pendingList.length === 0 ? (
                <div className="text-center py-10 text-sm" style={mutedStyle}>
                  <PackageCheck size={36} className="mx-auto mb-3 opacity-60" />
                  Bekleyen sevkiyat yok. Koli karekodunu veya ürün karekodunu okutarak başlayın.
                </div>
              ) : (
                <div className="grid gap-3">{pendingList.map(renderShipment)}</div>
              )}

              {acceptedList.length > 0 && (
                <div className="space-y-2">
                  <button type="button" onClick={() => setShowAccepted(v => !v)} aria-expanded={showAccepted} className="min-h-[44px] flex items-center gap-2 text-xs font-bold" style={mutedStyle}>
                    <ChevronDown size={14} className={`transition-transform ${showAccepted ? 'rotate-180' : ''}`} />
                    Kabul edilen sevkiyatlar ({acceptedList.length})
                  </button>
                  {showAccepted && <div className="grid gap-3">{acceptedList.slice(0, 50).map(renderShipment)}</div>}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 — B-Reçete & Resmi Satış Bildirimi */}
          {tab === 'brecete' && (
            <div className="space-y-4">
              <div className="rounded-2xl border p-3 sm:p-4 space-y-3" style={surface}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black">
                      {activeService === 'GTS'
                        ? 'GTS Gübre Satış & Resmi Kayıt'
                        : activeService === 'BRECETE'
                          ? 'B-Reçete & Resmi Satış Kaydı'
                          : 'BKTS Zirai İlaç Satış Kaydı'}
                    </h3>
                    <p className="text-[11px]" style={mutedStyle}>
                      {activeService === 'GTS'
                        ? 'Fatura Defterindeki gübre satışlarını buraya aktarıp çiftçi TCKN/VKN ile GTS defterine işleyin veya yeni kayıt ekleyin.'
                        : activeService === 'BRECETE'
                          ? 'Faturaları B-Reçete Kodu / TCKN ile eşleştirin veya yeni B-Reçete kaydı oluşturup denetim defterine işleyin.'
                          : 'Fatura Defterindeki ilaç satışlarını buraya aktarıp TCKN ve opsiyonel B-Reçete kodu ile BKTS defterine işleyin.'}
                    </p>
                  </div>
                  <div className="flex rounded-xl border p-1 gap-1" style={subSurface}>
                    <button
                      type="button"
                      onClick={() => setBreceteMode('invoice')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={breceteMode === 'invoice' ? accentStyle : mutedStyle}
                    >
                      Faturadan Aktar
                    </button>
                    <button
                      type="button"
                      onClick={() => setBreceteMode('manual')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={breceteMode === 'manual' ? accentStyle : mutedStyle}
                    >
                      Yeni Resmi Kayıt
                    </button>
                  </div>
                </div>
              </div>

              {breceteMode === 'invoice' ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border p-3 sm:p-4 space-y-3" style={surface}>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={mutedStyle} />
                      <input
                        value={breceteSearch}
                        onChange={e => setBreceteSearch(e.target.value)}
                        placeholder="Fatura no, çiftçi adı veya ürün ara..."
                        className="w-full min-h-[44px] border rounded-xl pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                        style={inputStyle}
                      />
                    </div>
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {invoiceList.length === 0 ? (
                        <p className="text-xs py-6 text-center" style={mutedStyle}>Eşleşen satış veya iade faturası bulunamadı.</p>
                      ) : (
                        invoiceList.map(p => {
                          const fr = farmerById.get(p.farmerId);
                          const isSel = selectedInvoiceId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleSelectInvoiceForBrecete(p)}
                              className={`w-full text-left rounded-xl border p-3 transition-all ${isSel ? 'ring-2 ring-emerald-500' : ''}`}
                              style={subSurface}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-black truncate">{fr?.fullName || 'Çiftçi'}</span>
                                <span className="text-[11px] font-mono" style={mutedStyle}>{p.prescriptionNo}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[11px]" style={mutedStyle}>
                                <span>{fmtDate(p.date)} · {(p.items || []).length} kalem</span>
                                <span>{p.type === 'RETURN' ? 'İade' : 'Satış'}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border p-3 sm:p-4 space-y-3" style={surface}>
                    {!selectedInvoice ? (
                      <div className="py-12 text-center text-xs" style={mutedStyle}>
                        <ShieldCheck size={32} className="mx-auto mb-2 opacity-50" />
                        Soldan bir satış/iade faturası seçerek B-Reçete / BKTS / GTS resmi bildirim kaydı oluşturun.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: 'var(--mks-card-border)' }}>
                          <div>
                            <div className="text-sm font-black">{farmerById.get(selectedInvoice.farmerId)?.fullName || 'Çiftçi'}</div>
                            <div className="text-[11px]" style={mutedStyle}>Fatura: {selectedInvoice.prescriptionNo} · {(selectedInvoice.items || []).length} ürün</div>
                          </div>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500">
                            {selectedInvoice.type === 'RETURN' ? 'İADE' : 'SATIŞ'}
                          </span>
                        </div>

                        <div className="grid gap-2.5 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold" style={mutedStyle}>Resmi Sistem</span>
                            <div className="min-h-[42px] border rounded-xl px-3 flex items-center text-sm font-bold" style={subSurface}>
                              {activeService === 'GTS' ? 'GTS (Gübre Takip Sistemi)' : activeService === 'BRECETE' ? 'B-Reçete / BKTS' : 'BKTS (Bitki Koruma Takip)'}
                            </div>
                          </div>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold" style={mutedStyle}>
                              {activeService === 'GTS' ? 'GTS Sipariş / Onay Kodu (Opsiyonel)' : activeService === 'BRECETE' ? 'B-Reçete Kodu *' : 'B-Reçete Kodu (Varsa)'}
                            </span>
                            <input
                              value={breceteCodeInput}
                              onChange={e => setBreceteCodeInput(e.target.value)}
                              placeholder="Örn: BR-2026-00412"
                              className="w-full min-h-[42px] border rounded-xl px-3 text-sm font-mono outline-none"
                              style={inputStyle}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold" style={mutedStyle}>Çiftçi TCKN / VKN *</span>
                            <input
                              value={breceteTcInput}
                              onChange={e => setBreceteTcInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                              placeholder="11 haneli TCKN / 10 haneli VKN"
                              className="min-h-[42px] border rounded-xl px-3 text-sm font-mono outline-none"
                              style={inputStyle}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-bold" style={mutedStyle}>Belge / Reçete No</span>
                            <input
                              value={breceteDocNo}
                              onChange={e => setBreceteDocNo(e.target.value)}
                              className="min-h-[42px] border rounded-xl px-3 text-sm font-mono outline-none"
                              style={inputStyle}
                            />
                          </label>
                        </div>

                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {(selectedInvoice.items || []).map((it, idx) => (
                            <div key={idx} className="rounded-xl border px-3 py-2 flex items-center justify-between text-xs" style={subSurface}>
                              <span className="font-semibold truncate pr-2">{it.pesticideName}</span>
                              <span className="font-mono shrink-0">{String(it.quantity || '1').replace(/^-/, '')} Adet</span>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={savingBrecete}
                          onClick={() => void handleSubmitInvoiceToMinistry()}
                          className="w-full min-h-[46px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                          style={accentStyle}
                        >
                          {savingBrecete ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          Resmi Deftere Kaydet
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateManualBrecete} className="rounded-2xl border p-4 space-y-3" style={surface}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>Resmi Sistem</span>
                      <div className="min-h-[44px] border rounded-xl px-3 flex items-center text-sm font-bold" style={subSurface}>
                        {activeService === 'GTS' ? 'GTS (Gübre Takip)' : activeService === 'BRECETE' ? 'B-Reçete / BKTS' : 'BKTS (Bitki Koruma)'}
                      </div>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>Çiftçi Seç (Opsiyonel)</span>
                      <select
                        value={breceteFarmerId}
                        onChange={e => {
                          setBreceteFarmerId(e.target.value);
                          const fr = farmerById.get(e.target.value);
                          if (fr?.tcNo) setBreceteTcInput(fr.tcNo);
                        }}
                        className="min-h-[44px] border rounded-xl px-3 text-sm"
                        style={inputStyle}
                      >
                        <option value="">-- Listeden Seç --</option>
                        {farmers.map(f => <option key={f.id} value={f.id}>{f.fullName}{f.village ? ` (${f.village})` : ''}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>TCKN / VKN *</span>
                      <input
                        value={breceteTcInput}
                        onChange={e => setBreceteTcInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="11 haneli TCKN / 10 haneli VKN"
                        className="min-h-[44px] border rounded-xl px-3 text-sm font-mono outline-none"
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-[11px] font-bold" style={mutedStyle}>Ürün Adı *</span>
                      <input
                        list="mks-ministry-inventory-products"
                        value={breceteProductInput}
                        onChange={e => {
                          setBreceteProductInput(e.target.value);
                          const hit = inventory.find(inv => inv.pesticideName === e.target.value);
                          if (hit) {
                            if (hit.gtin || hit.barcode) setBreceteGtinInput(String(hit.gtin || hit.barcode));
                            if (hit.lotNumber) setBreceteLotInput(hit.lotNumber);
                            if (hit.expiryDate) setBreceteSktInput(hit.expiryDate);
                          }
                        }}
                        placeholder="Ürün adını yazın veya depodan seçin"
                        className="min-h-[44px] border rounded-xl px-3 text-sm outline-none"
                        style={inputStyle}
                      />
                      <datalist id="mks-ministry-inventory-products">
                        {inventory.filter(i => !i.deletedAt).map(i => (
                          <option key={i.id} value={i.pesticideName} />
                        ))}
                      </datalist>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>Miktar (Adet) *</span>
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        value={breceteQtyInput}
                        onChange={e => setBreceteQtyInput(e.target.value)}
                        className="min-h-[44px] border rounded-xl px-3 text-sm font-mono outline-none"
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>B-Reçete Kodu</span>
                      <input value={breceteCodeInput} onChange={e => setBreceteCodeInput(e.target.value)} placeholder="BR-..." className="w-full min-h-[42px] border rounded-xl px-3 text-sm font-mono outline-none" style={inputStyle} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>GTIN / Barkod</span>
                      <input value={breceteGtinInput} onChange={e => setBreceteGtinInput(e.target.value)} placeholder="14 haneli GTIN" className="min-h-[42px] border rounded-xl px-3 text-sm font-mono outline-none" style={inputStyle} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>Lot / Parti No</span>
                      <input value={breceteLotInput} onChange={e => setBreceteLotInput(e.target.value)} placeholder="Lot No" className="min-h-[42px] border rounded-xl px-3 text-sm font-mono outline-none" style={inputStyle} />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold" style={mutedStyle}>Belge No</span>
                      <input value={breceteDocNo} onChange={e => setBreceteDocNo(e.target.value)} placeholder="Otomatik" className="min-h-[42px] border rounded-xl px-3 text-sm font-mono outline-none" style={inputStyle} />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={savingBrecete}
                    className="w-full min-h-[46px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    style={accentStyle}
                  >
                    {savingBrecete ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Deftere Kaydet (Dışa Aktarım)
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 3 — Defter */}
          {tab === 'ledger' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <StatCard label="Dışa Aktarıma Hazır (XML / CSV / PDF)" value={counts.ready} tone="ok" icon={<ShieldCheck size={18} />} />
                <StatCard label="Mal kabul kaydı" value={counts.accept} icon={<Boxes size={18} />} />
                <StatCard label="Kayıtsız serbest satış (dosyaya girmez)" value={counts.free} tone="warn" icon={<AlertTriangle size={18} />} />
              </div>

              <div className="rounded-2xl border p-3 space-y-3" style={surface}>
                <div className="flex flex-col lg:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={mutedStyle} />
                    <input
                      value={ledgerQuery}
                      onChange={e => setLedgerQuery(e.target.value)}
                      placeholder="Ürün, çiftçi, TCKN, GTIN, lot, seri, belge no ara"
                      aria-label="Defterde ara"
                      className="w-full min-h-[44px] border rounded-xl pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                      style={inputStyle}
                    />
                  </div>
                  <select value={ledgerType} onChange={e => setLedgerType(e.target.value as typeof ledgerType)} aria-label="Kayıt türü" className="min-h-[44px] border rounded-xl px-3 text-sm" style={inputStyle}>
                    <option value="ALL">Tüm kayıtlar</option>
                    <option value="FARMER_SALE">Kayıtlı satış</option>
                    <option value="FREE_SALE">Serbest satış</option>
                    <option value="SHIPMENT_ACCEPT">Mal kabul</option>
                    <option value="RETURN">İade</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  <button type="button" disabled={!!exporting} onClick={() => exportFile('xml')} className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" style={subSurface}>
                    {exporting === 'xml' ? <Loader2 size={16} className="animate-spin" /> : <FileCode2 size={16} />} XML
                  </button>
                  <button type="button" disabled={!!exporting} onClick={() => exportFile('csv')} className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" style={subSurface}>
                    {exporting === 'csv' ? <Loader2 size={16} className="animate-spin" /> : <Sheet size={16} />} CSV (Excel)
                  </button>
                  <button type="button" disabled={!!exporting} onClick={() => exportFile('txt')} className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-50" style={subSurface}>
                    {exporting === 'txt' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Karekod Listesi
                  </button>
                  <button type="button" disabled={!!exporting} onClick={exportPdf} className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold disabled:opacity-50" style={accentStyle}>
                    {exporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Denetim Defteri PDF
                  </button>
                </div>
                <p className="text-[11px] flex items-center gap-1.5" style={mutedStyle}>
                  <Share2 size={13} /> Mobilde dosya paylaşım menüsü açılır (WhatsApp, Drive, e-posta); desteklenmezse dosya indirilir. Serbest satışlar resmi dosyalara alınmaz.
                </p>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-sm" style={mutedStyle}>
                  {serviceRecords.length === 0
                    ? `Henüz ${SERVICE_META[activeService].shortLabel} kaydı yok. Bu ekrandan yapılan resmi kayıtlar ve mal kabuller burada listelenir.`
                    : 'Filtreye uyan kayıt yok.'}
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="grid gap-2 md:hidden">
                    {filteredRecords.slice(0, 300).map(r => (
                      <div key={r.id} className="rounded-2xl border p-3 text-xs space-y-1.5" style={subSurface}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-sm min-w-0 truncate">{r.productName}</div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${statusClass(r.status)}`}>{r.status}</span>
                        </div>
                        <div style={mutedStyle}>{fmtDate(r.date)} · {r.system} · {RECORD_TYPE_LABEL[r.recordType]} · {r.quantity} {r.unit || ''}</div>
                        {(r.farmerName || r.supplierName) && <div>{r.farmerName || r.supplierName}{r.farmerTcNo ? ` · ${r.farmerTcNo}` : ''}</div>}
                        <div className="font-mono text-[11px]" style={mutedStyle}>
                          GTIN {r.gtin || '—'} · Lot {r.lotNumber || '—'}{r.serialNumber ? ` · Seri ${r.serialNumber}` : ''}{r.expiryDate ? ` · SKT ${fmtDate(r.expiryDate)}` : ''}
                        </div>
                        <div className="pt-1 text-[11px] truncate" style={mutedStyle}>
                          Belge {r.documentNo || '—'}{r.bReceteCode ? ` · B-Reçete ${r.bReceteCode}` : ''}
                          {r.status === 'Bakanlığa Bildirildi' && r.ministryRefNo ? ` · Ref: ${r.ministryRefNo}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--mks-card-border)' }}>
                    <table className="w-full text-xs">
                      <thead className="text-left" style={subSurface}>
                        <tr>{['Tarih', 'Sistem', 'Tür', 'TCKN/VKN', 'Alıcı / Tedarikçi', 'Ürün', 'GTIN', 'Seri No', 'Lot', 'SKT', 'Miktar', 'Belge', 'Durum'].map(h => <th key={h} className="px-3 py-2.5 font-bold whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {filteredRecords.slice(0, 500).map(r => (
                          <tr key={r.id} className="border-t" style={{ borderColor: 'var(--mks-card-border)' }}>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                            <td className="px-3 py-2">{r.system}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{RECORD_TYPE_LABEL[r.recordType]}</td>
                            <td className="px-3 py-2 font-mono">{r.farmerTcNo || '—'}</td>
                            <td className="px-3 py-2">{r.farmerName || r.supplierName || '—'}</td>
                            <td className="px-3 py-2">{r.productName}</td>
                            <td className="px-3 py-2 font-mono">{r.gtin || '—'}</td>
                            <td className="px-3 py-2 font-mono">{r.serialNumber || '—'}</td>
                            <td className="px-3 py-2 font-mono">{r.lotNumber || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.expiryDate ? fmtDate(r.expiryDate) : '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.quantity} {r.unit || ''}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{r.documentNo || '—'}{r.bReceteCode ? ` · B-${r.bReceteCode}` : ''}</td>
                            <td className="px-3 py-2"><span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${statusClass(r.status)}`}>{r.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4 — Resmî Portal & Bağlı Hesap */}
          {tab === 'webservice' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border p-4 sm:p-5 space-y-4 flex flex-col justify-between" style={surface}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border"
                      style={{
                        background: `${activeMeta.accentHex}1f`,
                        borderColor: `${activeMeta.accentHex}55`,
                        color: activeMeta.accentHex,
                      }}
                    >
                      <Globe size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black">Resmî Bakanlık Penceresi (Uygulama Boyutunda Tarayıcı)</h3>
                      <p className="text-[11px]" style={mutedStyle}>{activeMeta.portalUrl}</p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed" style={mutedStyle}>
                    Devlet portalları (<span className="font-mono">.gov.tr</span> ve e-Devlet) güvenlik politikaları gereği gömülü iframe içinde açılmaz; ayrıca{' '}
                    {activeService === 'GTS'
                      ? 'görsel güvenlik kodu (Captcha) ve Mobil Onay (SMS)'
                      : 'resmî oturum ve güvenlik doğrulaması'}{' '}
                    yalnızca kendi alan adı üzerinde çalışır. Portalı buradan açtığınızda MKS bağlı bilginizi panoya hazırlar; tek tıkla kopyalayıp yapıştırarak resmî işlemi tamamlayabilirsiniz.
                  </p>
                  {activeService === 'GTS' && (
                    <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 space-y-1">
                      <p className="text-[11px] font-black text-emerald-400">DSTRACE GTS Teknik Koordinasyon Durumu</p>
                      <p className="text-[11px] leading-relaxed" style={mutedStyle}>
                        <b>16.11.2026 12:33 — Alisa Çiçek AKYOL:</b> Talebiniz ilgili teknik birime iletilmiş olup dönüş sağlanacaktır. Resmî API dokümanı / uç nokta ulaştığında yan paneldeki özel HTTPS alanından anında tanımlayabilirsiniz.
                      </p>
                      <p className="text-[11px] font-mono text-emerald-300/90">
                        Destek: yardim.masasi@dstrace.com • 0850 310 80 08
                      </p>
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void copyCredentialField(activeMeta.idLabel, activeAuth?.username)}
                      className="min-h-[42px] rounded-xl border px-3 text-xs font-bold flex items-center justify-center gap-1.5"
                      style={subSurface}
                    >
                      <Copy size={14} /> {activeMeta.id === 'BRECETE' ? 'T.C. Kimlik Kopyala' : 'TCKN / VKN Kopyala'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyCredentialField('Şifre', activeAuth?.password)}
                      className="min-h-[42px] rounded-xl border px-3 text-xs font-bold flex items-center justify-center gap-1.5"
                      style={subSurface}
                    >
                      <Copy size={14} /> Şifre Kopyala
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openOfficialPortalWindow()}
                  className="w-full min-h-[46px] rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95"
                  style={{ background: activeMeta.accentHex, color: '#ffffff' }}
                >
                  <ExternalLink size={16} />
                  <span>{activeMeta.portalLabel} Penceresini Aç — TCKN/VKN Otomatik Kopyalanır</span>
                </button>
              </section>

              <form onSubmit={handleUpdateSavedAccount} className="rounded-2xl border p-4 sm:p-5 space-y-4 flex flex-col justify-between" style={surface}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound size={17} style={{ color: activeMeta.accentHex }} />
                      <h3 className="text-sm font-black">Bağlı Hesap &amp; Otomatik Giriş Bilgileri</h3>
                    </div>
                    {(loginAutoEntered || activeAuth?.remember) && (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-0.5 text-[10px] font-black text-emerald-500">
                        Otomatik Giriş Kayıtlı
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border px-3 py-2 text-xs flex items-center gap-2" style={subSurface}>
                    <ShieldCheck size={15} className="shrink-0 text-emerald-500" />
                    <span className="truncate">
                      <span className="font-bold">{activeMeta.idLabel}: </span>
                      <span className="font-mono">{activeAuth?.username || '—'}</span>
                    </span>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold" style={mutedStyle}>{activeMeta.idLabel}</span>
                    <input
                      type="text"
                      inputMode={activeService === 'BKTS' ? 'text' : 'numeric'}
                      value={accountUsername}
                      onChange={e =>
                        setAccountUsername(
                          activeService === 'BKTS'
                            ? e.target.value
                            : e.target.value.replace(/\D/g, '').slice(0, 11),
                        )
                      }
                      placeholder={activeMeta.idPlaceholder}
                      autoComplete="username"
                      className="min-h-[42px] border rounded-xl px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500/40"
                      style={inputStyle}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold" style={mutedStyle}>{activeMeta.passwordLabel}</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type={accountShowPassword ? 'text' : 'password'}
                        value={accountPassword}
                        onChange={e => setAccountPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="flex-1 min-h-[42px] border rounded-xl px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500/40"
                        style={inputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => setAccountShowPassword(v => !v)}
                        aria-label={accountShowPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                        className="min-h-[42px] w-11 shrink-0 rounded-xl border flex items-center justify-center"
                        style={subSurface}
                      >
                        {accountShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </label>

                  <div className="pt-2 border-t border-white/10 space-y-2.5">
                    <p className="text-[11px] font-black uppercase tracking-wider" style={mutedStyle}>
                      Canlı Web Servis Parametreleri (GLN · KeyNo · Uç Nokta)
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold" style={mutedStyle}>Bayi GLN (13 Hane)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={wsGln}
                          onChange={e => setWsGln(e.target.value.replace(/\D/g, '').slice(0, 13))}
                          placeholder="868..."
                          className="min-h-[40px] border rounded-xl px-3 text-xs font-mono outline-none"
                          style={inputStyle}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold" style={mutedStyle}>Web Servis KeyNo / API Anahtarı</span>
                        <input
                          type="password"
                          value={wsServiceKey}
                          onChange={e => setWsServiceKey(e.target.value)}
                          placeholder="Bakanlık / DSTRACE KeyNo"
                          className="min-h-[40px] border rounded-xl px-3 text-xs font-mono outline-none"
                          style={inputStyle}
                        />
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-bold" style={mutedStyle}>Ortam</span>
                        <select
                          value={wsEnv}
                          onChange={e => setWsEnv(e.target.value === 'TEST' ? 'TEST' : 'LIVE')}
                          className="min-h-[40px] border rounded-xl px-2.5 text-xs font-bold outline-none"
                          style={inputStyle}
                        >
                          <option value="LIVE">Canlı (LIVE)</option>
                          <option value="TEST">Test (TEST)</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-[11px] font-bold" style={mutedStyle}>Özel HTTPS Uç Noktası (Opsiyonel: .gov.tr / .dstrace.com)</span>
                        <input
                          type="url"
                          value={wsEndpoint}
                          onChange={e => setWsEndpoint(e.target.value)}
                          placeholder={activeService === 'GTS' ? 'https://api.dstrace.com/...' : 'Varsayılan Bakanlık adresi kullanılır'}
                          className="min-h-[40px] border rounded-xl px-3 text-xs font-mono outline-none"
                          style={inputStyle}
                        />
                      </label>
                    </div>
                    {wsTestResult.state !== 'idle' && wsTestResult.state !== 'busy' && (
                      <div className={`rounded-xl border px-3 py-2 text-[11px] space-y-0.5 ${wsTestResult.state === 'ok' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}`}>
                        <p className="font-bold">{wsTestResult.state === 'ok' ? `✓ ${wsTestResult.message}` : `⚠ ${wsTestResult.message}`}</p>
                        {wsTestResult.diagnostic && <p className="opacity-85 leading-relaxed">{wsTestResult.diagnostic}</p>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void handleTestMinistryConnection()}
                    disabled={wsTestResult.state === 'busy'}
                    className="min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {wsTestResult.state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                    Web Servis Bağlantısını Test Et
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                    style={accentStyle}
                  >
                    <CheckCircle2 size={15} /> Bilgileri Güncelle ve Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={handleServiceLogout}
                    className="min-h-[44px] rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 text-red-400 border-red-500/35 hover:bg-red-500/10"
                  >
                    <LogOut size={15} /> Hesap Değiştir / Çıkış Yap
                  </button>
                </div>
              </form>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {cameraOpen && (
        <LazyBarcodeScanner
          continuous
          title="Koli / Ürün Karekodu Okut"
          onScan={(text, meta) => { void scanHandlerRef.current(text, 'camera', meta?.format); }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
};

export default MinistryIntegrationModal;

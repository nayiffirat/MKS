import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Landmark, Factory, ScrollText, FlaskConical, ChevronDown, CheckCircle2, AlertTriangle,
  ScanLine, Plus, Minus, FileCode2, FileText, Search, Trash2, ShieldCheck, ShieldAlert, PackageCheck,
  Camera, Share2, FileDown, Info, Boxes, Loader2, Sheet, Package,
} from 'lucide-react';
import {
  validateGLN, findEquivalentProducts, checkTankMixCompatibility, generateMinistryExportFile,
  filterOfficialMinistryRecords, parseGS1Barcode, isValidGS1Number, findItemByScan, canonicalBarcodeFromParsed,
  EXAMPLE_GLN, FREE_SALE_STATUS,
  type MinistryExportRecord, type TankMixInput, type GS1ParseResult,
} from '../utils/gs1Parser';
import { useHardwareBarcodeScanner, playScanBeep, playErrorBeep } from '../utils/hardwareBarcodeScanner';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import ModalCloseButton from './ModalCloseButton';
import LazyBarcodeScanner from './LazyBarcodeScanner';
import {
  loadMinistryRecords, loadMinistryShipments, saveMinistryRecords, saveMinistryShipmentRecord,
} from '../utils/ministryStore';
import { generateUUID } from '../utils/uuid';
import { daysUntilExpiry, normalizeGtin, round2 } from '../utils/dateUtils';
import { loadJsPdfWithAutoTable } from '../utils/pdfHelper';
import {
  PesticideCategory,
  type InventoryBatch, type InventoryItem, type MinistryRecord as MinistryLedgerRecord,
  type MinistryShipmentLine, type MinistryShipmentRecord,
} from '../types';

// ---------------------------------------------------------------------------
// Types (legacy prop shapes are still accepted from App.tsx)
// ---------------------------------------------------------------------------

export interface MinistryConfig {
  bkts: boolean;
  gts: boolean;
  bRecete: boolean;
  gln: string;
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
  initialTab?: 'malkabul' | 'satis' | 'esdeger' | 'receive' | 'ledger' | 'engine';
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

type TabId = 'receive' | 'ledger' | 'engine';
type ScanSource = 'hardware' | 'camera' | 'manual';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEGACY_CONFIG_KEY = () => `mks_ministry_config_${dbService.getCurrentUserId() || 'guest'}`;
const DEFAULT_CONFIG: MinistryConfig = { bkts: false, gts: false, bRecete: false, gln: '' };

/** Legacy device-only config (pre profile sync). The plain-text service key is purged (B-18). */
function loadLegacyConfig(): MinistryConfig | null {
  try {
    const raw = localStorage.getItem(LEGACY_CONFIG_KEY());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MinistryConfig> & { bkst?: boolean; serviceKey?: string };
    if (parsed.serviceKey) {
      delete parsed.serviceKey;
      localStorage.setItem(LEGACY_CONFIG_KEY(), JSON.stringify(parsed));
    }
    return {
      bkts: Boolean(parsed.bkts ?? parsed.bkst ?? false),
      gts: Boolean(parsed.gts),
      bRecete: Boolean(parsed.bRecete),
      gln: String(parsed.gln ?? ''),
    };
  } catch (e) {
    console.warn('[Ministry] legacy config read failed', e);
    return null;
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
  s === 'Dışa Aktarıma Hazır'
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

const Switch: React.FC<{ label: string; on: boolean; onText: string; offText: string; onChange: (v: boolean) => void }> = ({ label, on, onText, offText, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className="flex items-center gap-3 rounded-2xl border px-3 min-h-[48px] transition-colors text-left"
    style={subSurface}
  >
    <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-stone-500/50'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </span>
    <span className="flex flex-col leading-tight">
      <span className="text-[11px]" style={mutedStyle}>{label}</span>
      <span className={`text-xs font-bold ${on ? 'text-emerald-500' : ''}`} style={on ? undefined : mutedStyle}>{on ? onText : offText}</span>
    </span>
  </button>
);

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

  // ---- Config (synced with userProfile.ministryConfig) ---------------------
  const profileConfig = userProfile?.ministryConfig;
  const buildConfig = useCallback((): MinistryConfig => {
    const legacy = loadLegacyConfig();
    return {
      bkts: profileConfig?.bktsEnabled ?? legacy?.bkts ?? DEFAULT_CONFIG.bkts,
      gts: profileConfig?.gtsEnabled ?? legacy?.gts ?? DEFAULT_CONFIG.gts,
      bRecete: profileConfig?.bReceteEnabled ?? legacy?.bRecete ?? DEFAULT_CONFIG.bRecete,
      gln: profileConfig?.gln ?? legacy?.gln ?? DEFAULT_CONFIG.gln,
    };
  }, [profileConfig?.bktsEnabled, profileConfig?.gtsEnabled, profileConfig?.bReceteEnabled, profileConfig?.gln]);

  const [config, setConfig] = useState<MinistryConfig>(buildConfig);
  const [showCredentials, setShowCredentials] = useState(false);
  const [tab, setTab] = useState<TabId>('receive');
  const [localOnly, setLocalOnly] = useState(() => { const c = buildConfig(); return !c.bkts && !c.gts; });

  useEffect(() => {
    if (!isOpen) return;
    const fresh = buildConfig();
    setConfig(fresh);
    setLocalOnly(!fresh.bkts && !fresh.gts);
  }, [isOpen, buildConfig]);

  useEffect(() => {
    if (!initialTab || !isOpen) return;
    if (initialTab === 'malkabul' || initialTab === 'receive') setTab('receive');
    else if (initialTab === 'satis' || initialTab === 'ledger') setTab('ledger');
    else if (initialTab === 'esdeger' || initialTab === 'engine') setTab('engine');
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
        ministryConfig: { gln: next.gln, bktsEnabled: next.bkts, gtsEnabled: next.gts, bReceteEnabled: next.bRecete },
      });
    } catch (e: any) {
      console.error('[Ministry] profile sync failed', e);
      toast(`Bakanlık ayarı buluta kaydedilemedi: ${e?.message || e}`, 'error');
    }
  }, [userProfile, updateUserProfile, toast]);

  const glnState: 'empty' | 'valid' | 'invalid' = !config.gln ? 'empty' : validateGLN(config.gln) ? 'valid' : 'invalid';
  const ministryActive = config.bkts || config.gts;

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

    if (tab === 'engine') {
      const hit = findItemByScan(inventoryRef.current, parsed);
      if (hit) { setQuery(hit.pesticideName); okScan(`${hit.pesticideName} için muadiller listelendi`, source); }
      else fail('Okutulan ürün depoda bulunamadı.');
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
      fail('BKTS/GTS kaydı kapalı. Üstteki anahtarlardan açın veya "BKTS/GTS kaydı yok" seçeneğini işaretleyin.');
      return;
    }
    if (registerToMinistry && glnState !== 'valid') {
      fail('Bakanlık kaydı için geçerli 13 haneli GLN girin veya "BKTS/GTS kaydı yok" seçin.');
      setShowCredentials(true);
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
        system: isFertilizer(item?.category) || (config.gts && !config.bkts) ? 'GTS' : 'BKTS',
        recordType: 'SHIPMENT_ACCEPT',
        date: acceptedAt,
        documentNo: s.waybillNo || s.sscc || s.id.slice(0, 8).toUpperCase(),
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

  // ---- Ledger / export ----------------------------------------------------
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [ledgerType, setLedgerType] = useState<'ALL' | MinistryLedgerRecord['recordType']>('ALL');
  const [ledgerSystem, setLedgerSystem] = useState<'ALL' | 'BKTS' | 'GTS'>('ALL');

  const filteredRecords = useMemo(() => {
    const q = ledgerQuery.trim().toLocaleLowerCase('tr-TR');
    return records.filter(r => {
      if (r.deletedAt) return false;
      if (ledgerType !== 'ALL' && r.recordType !== ledgerType) return false;
      if (ledgerSystem !== 'ALL' && r.system !== ledgerSystem) return false;
      if (!q) return true;
      return [r.productName, r.farmerName, r.farmerTcNo, r.gtin, r.lotNumber, r.serialNumber, r.documentNo, r.supplierName, r.bReceteCode]
        .some(v => String(v ?? '').toLocaleLowerCase('tr-TR').includes(q));
    });
  }, [records, ledgerQuery, ledgerType, ledgerSystem]);

  const officialRecords = useMemo(() => filterOfficialMinistryRecords(filteredRecords), [filteredRecords]);
  const counts = useMemo(() => ({
    ready: records.filter(r => r.status === 'Dışa Aktarıma Hazır' && !r.deletedAt).length,
    free: records.filter(r => r.status === FREE_SALE_STATUS && !r.deletedAt).length,
    accept: records.filter(r => r.recordType === 'SHIPMENT_ACCEPT' && !r.deletedAt).length,
  }), [records]);

  const exportRows = (rows: MinistryLedgerRecord[]): MinistryExportRecord[] =>
    rows.map(r => ({ ...r, senderGln: config.gln || undefined, prescriptionNo: r.documentNo }));

  const reportShare = (result: 'shared' | 'downloaded' | 'cancelled', fileName: string) => {
    if (result === 'shared') toast('Paylaşım ekranı açıldı', 'success');
    else if (result === 'downloaded') toast(`Dosya indirildi: ${fileName}`, 'success');
  };

  const exportFile = async (format: 'xml' | 'txt' | 'csv') => {
    if (exporting) return;
    const rows = format === 'txt' ? officialRecords.filter(r => r.gtin) : officialRecords;
    if (rows.length === 0) {
      toast(filteredRecords.length ? 'Dışa aktarılacak kayıtlı (BKTS/GTS) satır yok — serbest satışlar resmi dosyaya girmez.' : 'Dışa aktarılacak kayıt yok', 'error');
      return;
    }
    setExporting(format);
    try {
      const f = generateMinistryExportFile(exportRows(rows), format);
      const result = await shareOrDownload(f.fileName, new Blob([f.content], { type: f.mimeType }), 'MKS BKTS/GTS dışa aktarım dosyası');
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
    if (officialRecords.length === 0) { toast('Deftere yazılacak kayıtlı (BKTS/GTS) satır yok', 'error'); return; }
    setExporting('pdf');
    try {
      const { jsPDF, autoTable } = await loadJsPdfWithAutoTable();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(13);
      doc.text(pdfSafe('Bitki Koruma Ürünleri / Gübre Satış ve Mal Kabul Denetim Defteri'), 14, 14);
      doc.setFontSize(8.5);
      doc.text(pdfSafe(`Bayi: ${userProfile?.companyName || userProfile?.fullName || '-'} · GLN: ${config.gln || '-'} · Düzenlenme: ${new Date().toLocaleString('tr-TR')} · Kayıt: ${officialRecords.length}`), 14, 20);
      doc.text(pdfSafe('Durum: Dışa Aktarıma Hazır (XML / CSV / PDF) — Bakanlık web servisine otomatik gönderim yapılmamıştır.'), 14, 24.5);
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
      const fileName = `bkts_gts_denetim_defteri_${todayISO()}.pdf`;
      const result = await shareOrDownload(fileName, doc.output('blob'), 'MKS Denetim Defteri (PDF)');
      reportShare(result, fileName);
    } catch (e: any) {
      console.error('[Ministry] PDF failed', e);
      toast(`PDF oluşturulamadı: ${e?.message || e}`, 'error');
    } finally {
      setExporting(null);
    }
  };

  // ---- Engine tab ---------------------------------------------------------
  const [query, setQuery] = useState('');
  const [tank, setTank] = useState<TankMixInput[]>([]);
  const [customTankItem, setCustomTankItem] = useState('');
  const equivalents = useMemo(() => (query.trim().length >= 2 ? findEquivalentProducts(query, inventory) : []), [query, inventory]);
  const mix = useMemo(() => checkTankMixCompatibility(tank), [tank]);
  const addToTank = (item: TankMixInput) => {
    if (!item.name.trim() || tank.some(t => t.name === item.name)) return;
    setTank(prev => [...prev, item]);
  };

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'receive', label: 'Fabrikadan Mal Kabul', icon: <Factory size={16} />, badge: pendingList.length || undefined },
    { id: 'ledger', label: 'Satış & Denetim Defteri', icon: <ScrollText size={16} />, badge: counts.ready || undefined },
    { id: 'engine', label: 'Muadil & Tank Karışımı', icon: <FlaskConical size={16} /> },
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
          <div className="grid gap-2 sm:grid-cols-3">
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
            <input
              value={s.senderGln || ''}
              onChange={e => updateShipmentField(s, { senderGln: e.target.value.replace(/\D/g, '').slice(0, 13) }, false)}
              onBlur={e => updateShipmentField(s, { senderGln: e.target.value.replace(/\D/g, '').slice(0, 13) }, true)}
              placeholder="Gönderen GLN (ops.)"
              inputMode="numeric"
              aria-label="Gönderen GLN"
              className={`min-h-[44px] rounded-xl border px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/40 ${s.senderGln && !validateGLN(s.senderGln) ? 'border-red-500/60' : ''}`}
              style={s.senderGln && !validateGLN(s.senderGln) ? { ...inputStyle, borderColor: undefined } : inputStyle}
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
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ministry-modal-title"
        className="w-full max-w-6xl max-h-[92dvh] rounded-t-3xl sm:rounded-3xl border overflow-hidden flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'var(--mks-modal-bg)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--mks-card-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}>
                <Landmark size={22} />
              </div>
              <div className="min-w-0">
                <h2 id="ministry-modal-title" className="text-base sm:text-lg font-black tracking-tight truncate">Bakanlık Kayıt Merkezi</h2>
                <p className="text-xs truncate" style={mutedStyle}>BKTS · GTS · B-Reçete · Fabrikadan Mal Kabul</p>
              </div>
            </div>
            <ModalCloseButton onClick={onClose} label="Bakanlık penceresini kapat" />
          </div>

          <div className="mt-3 rounded-2xl border px-3 py-2.5 flex items-start gap-2 text-xs" style={subSurface}>
            <Info size={16} className="shrink-0 mt-0.5 text-emerald-500" />
            <span>
              <b>Durum: Dışa Aktarıma Hazır (XML / CSV / PDF).</b>{' '}
              <span style={mutedStyle}>MKS kayıtları kalıcı olarak saklar ve resmi dosya üretir; Bakanlık web servisine otomatik canlı gönderim yapılmaz.</span>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-2">
            <Switch label="BKTS (İlaç Takip)" on={config.bkts} onText="Kayıtlı" offText="Kaydı Yok" onChange={v => void persistConfig({ ...config, bkts: v })} />
            <Switch label="GTS (Gübre Takip)" on={config.gts} onText="Kayıtlı" offText="Kaydı Yok" onChange={v => void persistConfig({ ...config, gts: v })} />
            <Switch label="B-Reçete" on={config.bRecete} onText="Satışta kod alanı açık" offText="Kapalı" onChange={v => void persistConfig({ ...config, bRecete: v })} />
            <button
              type="button"
              onClick={() => setShowCredentials(s => !s)}
              aria-expanded={showCredentials}
              className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-bold"
              style={subSurface}
            >
              {glnState === 'valid' ? <ShieldCheck size={16} className="text-emerald-500" /> : <ShieldAlert size={16} className={glnState === 'invalid' ? 'text-red-500' : ''} />}
              Bayi GLN
              <ChevronDown size={14} className={`transition-transform ${showCredentials ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showCredentials && (
            <div className="mt-2 rounded-2xl border p-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" style={subSurface}>
              <label className="flex flex-col gap-1">
                <span className="text-[11px]" style={mutedStyle}>Bayi GLN Numarası (13 hane, profil ile senkron)</span>
                <div className="relative">
                  <input
                    value={config.gln}
                    onChange={e => setConfig(c => ({ ...c, gln: e.target.value.replace(/\D/g, '').slice(0, 13) }))}
                    onBlur={e => void persistConfig({ ...config, gln: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                    inputMode="numeric"
                    placeholder={EXAMPLE_GLN}
                    aria-label="Bayi GLN numarası"
                    className={`w-full min-h-[44px] border rounded-xl px-3 pr-28 text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/40 ${glnState === 'invalid' ? 'border-red-500/70' : ''}`}
                    style={glnState === 'invalid' ? { ...inputStyle, borderColor: undefined } : inputStyle}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold">
                    {glnState === 'valid' && <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={13} /> Geçerli</span>}
                    {glnState === 'invalid' && <span className="text-red-500">{config.gln.length < 13 ? `${config.gln.length}/13` : 'Kontrol hanesi hatalı'}</span>}
                  </span>
                </div>
              </label>
              <p className="text-[11px] sm:max-w-[260px]" style={mutedStyle}>
                Web servis anahtarı istenmez: canlı Bakanlık bağlantısı yoktur, kayıtlar dışa aktarım dosyası olarak verilir.
              </p>
            </div>
          )}
        </div>

        {/* Tabs */}
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

        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {loading && (
            <div className="flex items-center gap-2 text-xs mb-3" style={mutedStyle}><Loader2 size={14} className="animate-spin" /> Kayıtlar yükleniyor…</div>
          )}

          {/* TAB 1 — Mal kabul */}
          {tab === 'receive' && (
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
                      placeholder="SSCC koli / ürün karekodu okutun veya İrsaliye No girin"
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
                  <span className="text-xs sm:text-sm font-semibold">BKTS/GTS kaydı yok (sadece kendi depoma ekle, resmi dosyaya girmez)</span>
                  {!localOnly && !ministryActive && (
                    <span className="ml-auto text-[11px] text-amber-500 flex items-center gap-1 shrink-0"><AlertTriangle size={13} /> Kayıt kapalı</span>
                  )}
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

          {/* TAB 2 — Defter */}
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
                  <select value={ledgerSystem} onChange={e => setLedgerSystem(e.target.value as typeof ledgerSystem)} aria-label="Sistem" className="min-h-[44px] border rounded-xl px-3 text-sm" style={inputStyle}>
                    <option value="ALL">BKTS + GTS</option>
                    <option value="BKTS">BKTS</option>
                    <option value="GTS">GTS</option>
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
                  {records.length === 0
                    ? 'Henüz kayıt yok. BKTS modunda yapılan TC kimlikli satışlar ve onaylanan mal kabulleri burada listelenir.'
                    : 'Filtreye uyan kayıt yok.'}
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="grid gap-2 md:hidden">
                    {filteredRecords.slice(0, 300).map(r => (
                      <div key={r.id} className="rounded-2xl border p-3 text-xs space-y-1" style={subSurface}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-sm min-w-0 truncate">{r.productName}</div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${statusClass(r.status)}`}>{r.status}</span>
                        </div>
                        <div style={mutedStyle}>{fmtDate(r.date)} · {r.system} · {RECORD_TYPE_LABEL[r.recordType]} · {r.quantity} {r.unit || ''}</div>
                        {(r.farmerName || r.supplierName) && <div>{r.farmerName || r.supplierName}{r.farmerTcNo ? ` · ${r.farmerTcNo}` : ''}</div>}
                        <div className="font-mono text-[11px]" style={mutedStyle}>
                          GTIN {r.gtin || '—'} · Lot {r.lotNumber || '—'}{r.serialNumber ? ` · Seri ${r.serialNumber}` : ''}{r.expiryDate ? ` · SKT ${fmtDate(r.expiryDate)}` : ''}
                        </div>
                        <div className="text-[11px]" style={mutedStyle}>Belge {r.documentNo || '—'}{r.bReceteCode ? ` · B-Reçete ${r.bReceteCode}` : ''}</div>
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

          {/* TAB 3 — Muadil & tank */}
          {tab === 'engine' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border p-4 space-y-3" style={surface}>
                <h3 className="text-sm font-black">Muadil İlaç / Gübre Bul</h3>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={mutedStyle} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Etken madde veya ürün adı (örn. Abamectin, DAP 18-46)"
                    aria-label="Etken madde veya ürün adı"
                    className="w-full min-h-[44px] border rounded-xl pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                    style={inputStyle}
                  />
                </div>
                {query.trim().length >= 2 && equivalents.length === 0 && (
                  <p className="text-xs" style={mutedStyle}>Stokta eşleşen muadil bulunamadı.</p>
                )}
                <ul className="space-y-2">
                  {equivalents.map(m => (
                    <li key={String(m.item.id ?? m.name)} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={subSurface}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{m.name}</div>
                        <div className="text-[11px] text-emerald-500">{m.ingredients.join(' + ')} · Stok: {m.quantity} {m.item.unit ?? ''}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToTank({ name: m.name, category: m.item.category, activeIngredient: m.ingredients.join(', ') })}
                        className="shrink-0 min-h-[44px] rounded-xl border px-3 text-xs font-bold flex items-center gap-1"
                        style={surface}
                      >
                        <Plus size={14} /> Tanka Ekle
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border p-4 space-y-3" style={surface}>
                <h3 className="text-sm font-black">Tank Karışımı & Fitotoksisite Kontrolü</h3>
                <form
                  className="flex gap-2"
                  onSubmit={e => { e.preventDefault(); addToTank({ name: customTankItem.trim() }); setCustomTankItem(''); }}
                >
                  <input
                    value={customTankItem}
                    onChange={e => setCustomTankItem(e.target.value)}
                    placeholder="Ürün ekle (örn. Kükürt 80 WG)"
                    aria-label="Tanka ürün ekle"
                    className="flex-1 min-h-[44px] border rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
                    style={inputStyle}
                  />
                  <button type="submit" className="w-11 min-h-[44px] rounded-xl flex items-center justify-center" style={accentStyle} aria-label="Tanka ekle"><Plus size={18} /></button>
                </form>

                {tank.length === 0 ? (
                  <p className="text-xs" style={mutedStyle}>Tanka ürün ekleyin; uyumsuzluklar ve karışım sırası otomatik hesaplanır.</p>
                ) : (
                  <>
                    <div className={`rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-2 border ${mix.compatible ? (mix.warnings.length ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500') : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                      {mix.compatible && !mix.warnings.length ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      {!mix.compatible ? 'Karıştırılmamalı!' : mix.warnings.length ? 'Dikkatli karıştırın' : 'Bilinen bir uyumsuzluk yok'}
                    </div>

                    {mix.warnings.map((w, i) => (
                      <div key={i} className={`rounded-xl border px-3 py-2 ${w.severity === 'danger' ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                        <div className={`text-xs font-bold ${w.severity === 'danger' ? 'text-red-500' : 'text-amber-500'}`}>{w.title}</div>
                        <div className="text-[11px]" style={mutedStyle}>{w.items[0]} ↔ {w.items[1]}</div>
                        <div className="text-xs mt-1">{w.message}</div>
                      </div>
                    ))}

                    <div>
                      <div className="text-[11px] mb-1" style={mutedStyle}>Önerilen karışım sırası (SC → WP/WG → EC → SL/SP)</div>
                      <ol className="space-y-1.5">
                        {mix.mixingOrder.map(o => (
                          <li key={o.name} className="flex items-center gap-3 rounded-xl border pl-3 text-sm" style={subSurface}>
                            <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center">{o.step}</span>
                            <span className="flex-1 truncate">{o.name}</span>
                            <span className="text-[11px] font-mono" style={mutedStyle}>{o.formulation}</span>
                            <button type="button" onClick={() => setTank(prev => prev.filter(t => t.name !== o.name))} aria-label={`${o.name} çıkar`} className="w-11 h-11 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-xl">
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {cameraOpen && (
        <LazyBarcodeScanner
          continuous
          title={tab === 'engine' ? 'Ürün Karekodu Okut' : 'Koli / Ürün Karekodu Okut'}
          onScan={(text, meta) => { void scanHandlerRef.current(text, 'camera', meta?.format); }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
};

export default MinistryIntegrationModal;

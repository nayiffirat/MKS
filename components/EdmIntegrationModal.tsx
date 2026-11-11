import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  FileText,
  Receipt,
  Package,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Trash2,
  Printer,
  Download,
  Search,
  Building2,
  Landmark,
  Sprout,
  Settings,
  Layers,
  Send
} from 'lucide-react';
import {
  EdmConfig,
  EINVOICE_PROVIDERS,
  EInvoiceProviderId,
  IncomingEdmInvoice,
  IncomingEdmInvoiceLine,
  OfficialWarehouseItem,
  OutgoingEdmInvoiceRecord,
  getEdmConfig,
  saveEdmConfig,
  getIncomingEdmInvoices,
  saveIncomingEdmInvoices,
  getOfficialWarehouseItems,
  saveOfficialWarehouseItems,
  getOutgoingEdmInvoices,
  saveOutgoingEdmInvoices,
  calculateChainedNetPrice,
  hydrateEdmDataFromIndexedDb,
  EDM_DRAFT_LABEL
} from '../utils/edmWarehouseManager';
import { useAppViewModel } from '../context/AppContext';
import { useBackHandler, useScrollLock } from '../utils/navigationManager';
import { PesticideCategory, InventoryItem, Supplier } from '../types';
import { dbService } from '../services/db';
import { round2, round4, normalizeGtin } from '../utils/dateUtils';
import { generateUUID } from '../utils/uuid';
import { validateTcOrVkn } from '../utils/tcNoValidator';
import { ModalCloseButton } from './ModalCloseButton';

/** GİB'in kabul ettiği KDV oranları (eski 1/8/18 oranları geriye dönük faturalar için korunur) */
const ALLOWED_VAT_RATES = [0, 1, 8, 10, 18, 20] as const;
const EDM_UNITS: IncomingEdmInvoiceLine['unit'][] = ['Adet', 'Litre', 'Kg', 'Torba', 'Koli'];
const INVOICE_PREFIX_RE = /^[A-Z0-9]{3}$/;

/** Türkçe güvenli küçük harf (İ/I/ı doğru eşleşsin) */
const trLower = (s?: string | null): string => String(s ?? '').trim().toLocaleLowerCase('tr-TR');
const trUpper = (s?: string | null): string => String(s ?? '').trim().toLocaleUpperCase('tr-TR');

/** Yalnız sayısal 8-14 haneli kodları GTIN-14 anahtarına çevirir; aksi halde boş döner */
const gtinKey = (code?: string | null): string => {
  const n = normalizeGtin(code);
  return /^\d{14}$/.test(n) ? n : '';
};

/** "0,5" / "1.234,50" / "2.5" girişlerini sayıya çevirir; geçersizse NaN */
const parseDecimal = (raw: string | number | null | undefined): number => {
  const s = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!s) return NaN;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
};

const cleanTaxId = (s?: string | null): string => String(s ?? '').replace(/\s+/g, '');

/** Zorunlu VKN/TCKN: boş değer de geçersiz sayılır */
const checkRequiredTaxId = (value?: string | null) => {
  const result = validateTcOrVkn(cleanTaxId(value));
  return { ok: result.isValid && result.status !== 'EMPTY', result };
};

const formatTl = (n: number) =>
  (Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** e-Fatura kategorisini Sistem Deposu kategorisine eşler (bilinmeyen → Diğer) */
const mapEdmCategory = (c: OfficialWarehouseItem['category']): PesticideCategory => {
  switch (c) {
    case 'FERTILIZER':
      return PesticideCategory.FERTILIZER;
    case 'PESTICIDE':
      return PesticideCategory.INSECTICIDE;
    case 'SEED':
      return PesticideCategory.SEED;
    default:
      return PesticideCategory.OTHER;
  }
};

/** Önce GTIN, sonra ham barkod, en son Türkçe-güvenli ad ile Sistem Deposu eşleşmesi */
const findInventoryMatch = (
  items: InventoryItem[],
  p: { gtin?: string; barcode?: string; name: string }
): InventoryItem | undefined => {
  const live = (items || []).filter(i => !i.deletedAt);
  const g = gtinKey(p.gtin) || gtinKey(p.barcode);
  if (g) {
    const byGtin = live.find(i => gtinKey(i.gtin) === g || gtinKey(i.barcode) === g);
    if (byGtin) return byGtin;
  }
  const rawBarcode = String(p.barcode || '').trim();
  if (rawBarcode) {
    const byBarcode = live.find(i => String(i.barcode || '').trim() === rawBarcode);
    if (byBarcode) return byBarcode;
  }
  const name = trLower(p.name);
  return name ? live.find(i => trLower(i.pesticideName) === name) : undefined;
};

/** Önce GTIN, sonra ham barkod, en son ad ile e-Fatura Deposu kalem eşleşmesi */
const findOfficialMatchIndex = (
  items: OfficialWarehouseItem[],
  p: { gtin?: string; barcode?: string; name: string }
): number => {
  const g = gtinKey(p.gtin) || gtinKey(p.barcode);
  if (g) {
    const idx = items.findIndex(i => gtinKey(i.gtin) === g || gtinKey(i.barcode) === g);
    if (idx >= 0) return idx;
  }
  const rawBarcode = String(p.barcode || '').trim();
  if (rawBarcode) {
    const idx = items.findIndex(i => String(i.barcode || '').trim() === rawBarcode);
    if (idx >= 0) return idx;
  }
  const name = trLower(p.name);
  return name ? items.findIndex(i => trLower(i.productName) === name) : -1;
};

/** Eski kayıtlarda alan yoksa mevcut e-Fatura stoğu bir kez aktarılabilir kabul edilir */
const getPendingTransferQty = (item: OfficialWarehouseItem): number =>
  round4(Math.max(0, Number(item.pendingSystemTransferQty ?? item.efaturaStock) || 0));

type DraftLine = {
  officialItemId: string;
  productName: string;
  quantity: number;
  /** Kullanıcının yazdığı ham miktar (virgüllü kesir desteği) */
  qtyInput?: string;
  maxEfaturaStock: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
};

interface EdmIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'incoming' | 'issue' | 'warehouses' | 'settings';
}

export const EdmIntegrationModal: React.FC<EdmIntegrationModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'incoming'
}) => {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    suppliers,
    addSupplier,
    addSupplierPurchase,
    farmers,
    showToast
  } = useAppViewModel();

  const [activeTab, setActiveTab] = useState<'incoming' | 'issue' | 'warehouses' | 'settings'>(initialTab);
  const [config, setConfig] = useState<EdmConfig>(getEdmConfig);
  const [incomingInvoices, setIncomingInvoices] = useState<IncomingEdmInvoice[]>(getIncomingEdmInvoices);
  const [officialWarehouse, setOfficialWarehouse] = useState<OfficialWarehouseItem[]>(getOfficialWarehouseItems);
  const [outgoingInvoices, setOutgoingInvoices] = useState<OutgoingEdmInvoiceRecord[]>(getOutgoingEdmInvoices);
  const [searchQuery, setSearchQuery] = useState('');

  // New Incoming Invoice Manual Form State
  const [isAddIncomingOpen, setIsAddIncomingOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierVkn, setNewSupplierVkn] = useState('');
  const [newInvoiceNo, setNewInvoiceNo] = useState('');
  const [newLineName, setNewLineName] = useState('');
  const [newLineQty, setNewLineQty] = useState('10');
  const [newLinePrice, setNewLinePrice] = useState('500');
  const [newLineVat, setNewLineVat] = useState('20');
  const [newLineCategory, setNewLineCategory] = useState<IncomingEdmInvoiceLine['category']>('PESTICIDE');
  const [newLineUnit, setNewLineUnit] = useState<IncomingEdmInvoiceLine['unit']>('Adet');
  const [newLineBarcode, setNewLineBarcode] = useState('');
  const [newLineRouting, setNewLineRouting] = useState<'EFATURA_ONLY' | 'TRANSFER_TO_SYSTEM'>('EFATURA_ONLY');

  // Outgoing e-Fatura Issue State (ONLY from e-Fatura Warehouse!)
  const [selectedDocType, setSelectedDocType] = useState<'EFATURA' | 'EARSIV' | 'EMUSTAHSIL'>('EARSIV');
  const [customerName, setCustomerName] = useState('');
  const [customerTaxNo, setCustomerTaxNo] = useState('');
  const [alsoDeductFromSystemStock, setAlsoDeductFromSystemStock] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);

  // Busy locks (state for UI + ref for same-tick double taps)
  const [processingId, setProcessingId] = useState<string | null>(null);
  const processingRef = useRef<string | null>(null);
  const [transferringId, setTransferringId] = useState<string | null>(null);
  const transferRef = useRef<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const issuingRef = useRef(false);
  const configErrorShownRef = useRef(false);

  useScrollLock(isOpen);
  useBackHandler(isOpen, onClose, 'edm_integration_modal', 78);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      setConfig(getEdmConfig());
      setIncomingInvoices(getIncomingEdmInvoices());
      setOfficialWarehouse(getOfficialWarehouseItems());
      setOutgoingInvoices(getOutgoingEdmInvoices());
      // Yerel kopya silinmişse (cihaz değişimi vb.) IndexedDB aynasından geri yükle
      let cancelled = false;
      hydrateEdmDataFromIndexedDb()
        .then(restored => {
          if (!restored || cancelled) return;
          setIncomingInvoices(getIncomingEdmInvoices());
          setOfficialWarehouse(getOfficialWarehouseItems());
          setOutgoingInvoices(getOutgoingEdmInvoices());
        })
        .catch(err => console.error('[EDM] Geri yükleme hatası:', err));
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [isOpen, initialTab]);

  const updateAndPersistConfig = (next: EdmConfig) => {
    setConfig(next);
    const ok = saveEdmConfig(next);
    if (!ok && !configErrorShownRef.current) {
      configErrorShownRef.current = true;
      showToast?.('EDM ayarları kaydedilemedi (depolama hatası). Değişiklikler kalıcı değil.', 'error');
    } else if (ok) {
      configErrorShownRef.current = false;
    }
  };

  /** Gelen fatura listesini state + kalıcı depoya yazar; başarısızsa kullanıcıyı uyarır */
  const persistIncoming = (list: IncomingEdmInvoice[]): boolean => {
    setIncomingInvoices(list);
    const ok = saveIncomingEdmInvoices(list);
    if (!ok) showToast?.('Gelen e-Fatura listesi kaydedilemedi (depolama hatası).', 'error');
    return ok;
  };

  /** Kapanış (closure) bayatlığına karşı her zaman kalıcı depodaki güncel listeyi temel al */
  const latestIncoming = (): IncomingEdmInvoice[] => {
    const stored = getIncomingEdmInvoices();
    return stored.length ? stored : incomingInvoices;
  };

  const latestOfficial = (): OfficialWarehouseItem[] => {
    const stored = getOfficialWarehouseItems();
    return stored.length ? stored : officialWarehouse;
  };

  const readFreshInventory = async (): Promise<InventoryItem[]> => {
    try {
      const list = await dbService.getInventory();
      return Array.isArray(list) ? (list as InventoryItem[]) : inventory || [];
    } catch (err) {
      console.error('[EDM] Güncel envanter okunamadı, ekrandaki liste kullanılıyor:', err);
      return inventory || [];
    }
  };

  /**
   * Toggles a single line's routing mode between:
   * - EFATURA_ONLY ("Sadece e-Fatura Deposunda Bırak")
   * - TRANSFER_TO_SYSTEM ("Sistem Deposuna & Tedarikçi Carisine de Aktar")
   */
  const toggleLineRouting = (invoiceId: string, lineId: string, mode: 'EFATURA_ONLY' | 'TRANSFER_TO_SYSTEM') => {
    const updated = latestIncoming().map(inv => {
      if (inv.id !== invoiceId || inv.status !== 'PENDING') return inv;
      return {
        ...inv,
        lines: inv.lines.map(l => (l.id === lineId ? { ...l, routingMode: mode } : l))
      };
    });
    persistIncoming(updated);
  };

  /**
   * Sets all lines of an invoice to either EFATURA_ONLY or TRANSFER_TO_SYSTEM
   */
  const setAllLinesRouting = (invoiceId: string, mode: 'EFATURA_ONLY' | 'TRANSFER_TO_SYSTEM') => {
    const updated = latestIncoming().map(inv => {
      if (inv.id !== invoiceId || inv.status !== 'PENDING') return inv;
      return {
        ...inv,
        lines: inv.lines.map(l => ({ ...l, routingMode: mode }))
      };
    });
    persistIncoming(updated);
  };

  /**
   * Gelen faturadaki tedarikçiyi YALNIZ doğrulanmış VKN/TCKN (yoksa Türkçe-güvenli ad) ile bulur;
   * bulunamazsa oluşturur ve dönen / yeniden okunan gerçek ID'yi verir.
   */
  const resolveSupplierId = async (
    inv: IncomingEdmInvoice
  ): Promise<{ id: string | null; created: boolean; reason?: string }> => {
    const rawTax = cleanTaxId(inv.supplierVkn === '-' ? '' : inv.supplierVkn);
    const taxCheck = checkRequiredTaxId(rawTax);
    const validTaxId = taxCheck.ok ? rawTax : '';
    const nameKey = trLower(inv.supplierName);

    const matchIn = (list: Supplier[]): Supplier | undefined => {
      const live = (list || []).filter(s => !s.deletedAt);
      if (validTaxId) {
        const byTax = live.find(
          s => cleanTaxId(s.vkn) === validTaxId || cleanTaxId(s.tcNo) === validTaxId
        );
        if (byTax) return byTax;
      }
      if (!nameKey) return undefined;
      // Ad eşleşmesi: farklı geçerli VKN'li başka bir firmayla karışmasın
      return live.find(
        s =>
          trLower(s.name) === nameKey &&
          (!validTaxId || (!cleanTaxId(s.vkn) && !cleanTaxId(s.tcNo)))
      );
    };

    let freshSuppliers: Supplier[] = suppliers || [];
    try {
      const list = await dbService.getSuppliers();
      if (Array.isArray(list)) freshSuppliers = list as Supplier[];
    } catch (err) {
      console.error('[EDM] Tedarikçi listesi okunamadı:', err);
    }
    const existing = matchIn(freshSuppliers);
    if (existing) return { id: existing.id, created: false };

    if (!addSupplier) return { id: null, created: false, reason: 'tedarikçi ekleme servisi kullanılamıyor' };
    const res: any = await addSupplier({
      name: inv.supplierName.trim(),
      phoneNumber: '',
      ...(validTaxId.length === 11 ? { tcNo: validTaxId } : validTaxId ? { vkn: validTaxId } : {})
    });
    const returnedId =
      typeof res === 'string' && res
        ? res
        : res && typeof res === 'object' && typeof res.id === 'string'
          ? (res.id as string)
          : null;
    if (returnedId) return { id: returnedId, created: true };

    try {
      const after = await dbService.getSuppliers();
      const m = matchIn((after || []) as Supplier[]);
      if (m) return { id: m.id, created: true };
    } catch (err) {
      console.error('[EDM] Yeni tedarikçi yeniden okunamadı:', err);
    }
    return { id: null, created: true, reason: 'yeni tedarikçi kaydı okunamadı' };
  };

  /** Yarım kalmış (PROCESSING) faturayı kullanıcı onayıyla tekrar beklemeye alır */
  const resetStuckInvoice = (inv: IncomingEdmInvoice) => {
    if (processingRef.current === inv.id) return;
    const ok = window.confirm(
      `"${inv.invoiceNo}" işlemi yarım kalmış görünüyor. Tekrar işlemeden önce Sistem Deposu ve Tedarikçi Carisinde bu faturanın yazılıp yazılmadığını kontrol edin.\n\nFaturayı "Bekliyor" durumuna almak istiyor musunuz?`
    );
    if (!ok) return;
    persistIncoming(
      latestIncoming().map(i =>
        i.id === inv.id
          ? { ...i, status: 'PENDING' as const, lastError: 'Yarım kalan işlem kullanıcı tarafından sıfırlandı — mükerrer kayda dikkat.' }
          : i
      )
    );
  };

  /**
   * Processes an incoming EDM e-Fatura according to each line's selected routing mode
   */
  const processIncomingInvoice = async (invArg: IncomingEdmInvoice) => {
    if (processingRef.current) {
      showToast?.('Başka bir e-Fatura işleniyor, lütfen bekleyin.', 'info');
      return;
    }
    // Kapanıştaki kopya bayat olabilir: kalıcı depodaki güncel faturayı kullan
    const inv = latestIncoming().find(i => i.id === invArg.id) || invArg;
    if (inv.status === 'PROCESSED') {
      showToast?.('Bu e-Fatura zaten işlenmiş.', 'info');
      return;
    }
    if (inv.status === 'PROCESSING') {
      showToast?.('Bu e-Fatura işleniyor ya da önceki işlem yarım kaldı. Kontrol edip "Yarım kalan işlemi sıfırla" ile tekrar deneyin.', 'error');
      return;
    }

    processingRef.current = inv.id;
    setProcessingId(inv.id);

    const markInvoice = (patch: Partial<IncomingEdmInvoice>): boolean =>
      persistIncoming(latestIncoming().map(i => (i.id === inv.id ? { ...i, ...patch } : i)));

    if (!markInvoice({ status: 'PROCESSING', lastError: undefined })) {
      processingRef.current = null;
      setProcessingId(null);
      return;
    }

    let purchaseAttempted = false;
    try {
      const nowIso = new Date().toISOString();
      const nextOfficial = [...latestOfficial()];
      const transferLines = inv.lines.filter(l => l.routingMode === 'TRANSFER_TO_SYSTEM');
      const efaturaOnlyCount = inv.lines.length - transferLines.length;

      for (const line of inv.lines) {
        const netCost = calculateChainedNetPrice(line.unitPrice, line.discountRates || []);
        const suggestedSalePrice = round2(netCost * 1.25);
        const qty = Number(line.quantity) || 0;
        const isBkts = line.ministryBadge === 'BKTS' || line.ministryBadge === 'BKST';
        const isGts = line.ministryBadge === 'GTS';
        const lineGtin = gtinKey(line.gtin) || gtinKey(line.barcode) || undefined;

        // 1. Always add to Official e-Fatura Warehouse (so it can be invoiced out via e-Fatura later)
        const existingIdx = findOfficialMatchIndex(nextOfficial, {
          gtin: line.gtin,
          barcode: line.barcode,
          name: line.productName
        });

        if (existingIdx >= 0) {
          const curr = nextOfficial[existingIdx];
          const pendingBase = getPendingTransferQty(curr);
          nextOfficial[existingIdx] = {
            ...curr,
            gtin: curr.gtin || lineGtin,
            barcode: curr.barcode || line.barcode,
            efaturaStock: round4(curr.efaturaStock + qty),
            bktsStock: isBkts ? round4(curr.bktsStock + qty) : curr.bktsStock,
            gtsStock: isGts ? round4(curr.gtsStock + qty) : curr.gtsStock,
            // Sadece e-Fatura deposuna giren miktar sonradan fiziki depoya bir kez aktarılabilir
            pendingSystemTransferQty:
              line.routingMode === 'EFATURA_ONLY' ? round4(pendingBase + qty) : pendingBase,
            systemTransferredQty:
              line.routingMode === 'TRANSFER_TO_SYSTEM'
                ? round4((Number(curr.systemTransferredQty) || 0) + qty)
                : curr.systemTransferredQty,
            purchasePrice: netCost,
            salePrice: curr.salePrice || suggestedSalePrice,
            lastInvoiceNo: inv.invoiceNo,
            lastSupplierName: inv.supplierName,
            updatedAt: nowIso
          };
        } else {
          nextOfficial.push({
            id: `off-${generateUUID()}`,
            productName: line.productName,
            barcode: line.barcode,
            gtin: lineGtin,
            category: line.category,
            unit: line.unit,
            vatRate: line.vatRate,
            purchasePrice: netCost,
            salePrice: suggestedSalePrice,
            efaturaStock: qty,
            bktsStock: isBkts ? qty : 0,
            gtsStock: isGts ? qty : 0,
            pendingSystemTransferQty: line.routingMode === 'EFATURA_ONLY' ? qty : 0,
            systemTransferredQty: line.routingMode === 'TRANSFER_TO_SYSTEM' ? qty : 0,
            lastInvoiceNo: inv.invoiceNo,
            lastSupplierName: inv.supplierName,
            updatedAt: nowIso
          });
        }
      }

      // 2. "TRANSFER_TO_SYSTEM" kalemleri: stok artışını YALNIZ addSupplierPurchase yapar (çift stok yok)
      let totalNet = 0;
      let totalVat = 0;
      if (transferLines.length > 0) {
        if (!addSupplierPurchase) {
          throw new Error('Tedarikçi alım servisi kullanılamıyor');
        }
        const supplier = await resolveSupplierId(inv);
        if (!supplier.id) {
          throw new Error(`Tedarikçi carisi bulunamadı/oluşturulamadı (${supplier.reason || 'bilinmeyen hata'})`);
        }

        const grouped = new Map<
          string,
          {
            pesticideId: string;
            pesticideName: string;
            quantity: number;
            unit: string;
            netTotal: number;
            sellingPrice: number;
            gtin?: string;
            barcode?: string;
          }
        >();

        for (const line of transferLines) {
          const netCost = calculateChainedNetPrice(line.unitPrice, line.discountRates || []);
          const suggestedSalePrice = round2(netCost * 1.25);
          const qty = Number(line.quantity) || 0;
          // e-Fatura satır bazlı yuvarlama: satır neti ve satır KDV'si ayrı ayrı round2
          const lineNet = round2(qty * netCost);
          const lineVat = round2((lineNet * (Number(line.vatRate) || 0)) / 100);
          totalNet += lineNet;
          totalVat += lineVat;
          const lineGtin = gtinKey(line.gtin) || gtinKey(line.barcode) || undefined;

          // Her kalemde güncel envanteri yeniden oku (aynı ürün iki satırdaysa bayat veri kullanılmasın)
          const freshInventory = await readFreshInventory();
          const match = findInventoryMatch(freshInventory, {
            gtin: line.gtin,
            barcode: line.barcode,
            name: line.productName
          });

          let pesticideId: string;
          if (match) {
            pesticideId = match.pesticideId;
          } else {
            // Kütüphanede/depoda yoksa önce gerçek ID ile oluştur (miktar 0); artışı alım kaydı yapar
            pesticideId = generateUUID();
            await (dbService as any).addGlobalPesticide?.({
              id: pesticideId,
              name: line.productName,
              activeIngredient: 'Belirtilmedi',
              defaultDosage: '',
              category: mapEdmCategory(line.category),
              description: `EDM e-Fatura (${inv.invoiceNo}) ile otomatik eklendi.`,
              barcode: line.barcode || undefined
            });
            await addInventoryItem({
              id: generateUUID(),
              pesticideId,
              pesticideName: line.productName,
              category: mapEdmCategory(line.category),
              quantity: 0,
              unit: line.unit,
              buyingPrice: netCost,
              cashPrice: suggestedSalePrice,
              sellingPrice: round2(suggestedSalePrice * 1.1),
              barcode: line.barcode || '',
              gtin: lineGtin,
              lastUpdated: nowIso,
              lowStockThreshold: 5
            });
          }

          // Aynı envanter kalemine düşen satırları birleştir (tek alım kaydında üzerine yazma olmasın)
          const prev = grouped.get(pesticideId);
          if (prev) {
            prev.quantity = round4(prev.quantity + qty);
            prev.netTotal = round2(prev.netTotal + lineNet);
          } else {
            grouped.set(pesticideId, {
              pesticideId,
              pesticideName: match?.pesticideName || line.productName,
              quantity: qty,
              unit: match?.unit || line.unit,
              netTotal: lineNet,
              sellingPrice: suggestedSalePrice,
              gtin: lineGtin,
              barcode: line.barcode || undefined
            });
          }
        }

        totalNet = round2(totalNet);
        totalVat = round2(totalVat);
        const totalAmount = round2(totalNet + totalVat);
        const purchaseItems = [...grouped.values()].map(g => ({
          pesticideId: g.pesticideId,
          pesticideName: g.pesticideName,
          quantity: g.quantity,
          unit: g.unit,
          buyingPrice: g.quantity > 0 ? round4(g.netTotal / g.quantity) : 0,
          sellingPrice: g.sellingPrice,
          ...(g.gtin ? { gtin: g.gtin } : {}),
          ...(g.barcode ? { barcode: g.barcode } : {})
        }));

        purchaseAttempted = true;
        await addSupplierPurchase({
          supplierId: supplier.id,
          date: inv.issueDate,
          type: 'PURCHASE',
          receiptNo: inv.invoiceNo,
          items: purchaseItems,
          totalAmount,
          note: `EDM e-Fatura (${inv.invoiceNo}) Sistem Deposuna Aktarım • KDV dahil: Net ${formatTl(totalNet)} ₺ + KDV ${formatTl(totalVat)} ₺`
        });
      }

      // 3. e-Fatura deposunu kaydet
      const officialSaved = saveOfficialWarehouseItems(nextOfficial);
      if (officialSaved) setOfficialWarehouse(nextOfficial);

      const summaryText =
        `${efaturaOnlyCount} kalem sadece e-Fatura Deposunda bırakıldı • ${transferLines.length} kalem Sistem Deposuna & Tedarikçi Carisine aktarıldı` +
        (transferLines.length > 0 ? ` (KDV dahil ${formatTl(totalNet + totalVat)} ₺ borç).` : '.') +
        (officialSaved ? '' : ' ⚠ e-Fatura Deposu kaydedilemedi (depolama hatası)!');

      markInvoice({ status: 'PROCESSED', processedSummary: summaryText, lastError: undefined });
      showToast?.(summaryText, officialSaved ? 'success' : 'error');
    } catch (err) {
      console.error('[EDM] Gelen e-Fatura işlenemedi:', err);
      const msg = err instanceof Error ? err.message : String(err);
      const lastError = purchaseAttempted
        ? `İşlem hata verdi: ${msg}. Stok/cari kısmen yazılmış olabilir; tekrar işlemeden önce Tedarikçi Carisini ve Sistem Deposunu kontrol edin.`
        : `İşlem tamamlanamadı: ${msg}. Sistem Deposuna ve Tedarikçi Carisine hareket yazılmadı.`;
      markInvoice({ status: 'PENDING', lastError });
      showToast?.(lastError, 'error');
    } finally {
      processingRef.current = null;
      setProcessingId(null);
    }
  };

  /**
   * Transfers quantity from e-Fatura Warehouse to Physical Sistem Deposu later on demand.
   * Yalnız henüz aktarılmamış miktar (pendingSystemTransferQty) bir kez aktarılır; tekrar tıklama stok eklemez.
   */
  const transferFromEfaturaToSystem = async (itemArg: OfficialWarehouseItem) => {
    if (transferRef.current) {
      showToast?.('Bir aktarım sürüyor, lütfen bekleyin.', 'info');
      return;
    }
    const base = latestOfficial();
    const item = base.find(i => i.id === itemArg.id) || itemArg;
    const qty = getPendingTransferQty(item);
    if (qty <= 0) {
      showToast?.(`"${item.productName}" için Sistem Deposuna aktarılmamış e-Fatura miktarı yok (daha önce aktarıldı).`, 'info');
      return;
    }
    if (!window.confirm(`"${item.productName}" için ${qty} ${item.unit} fiziki Sistem Deposuna eklenecek. Bu miktar bir daha aktarılamaz. Onaylıyor musunuz?`)) {
      return;
    }

    transferRef.current = item.id;
    setTransferringId(item.id);
    const nowIso = new Date().toISOString();

    // 1) Önce "aktarıldı" işaretini kaydet: çift tıklama / yeniden açma aynı miktarı iki kez ekleyemez
    const markedItem: OfficialWarehouseItem = {
      ...item,
      pendingSystemTransferQty: 0,
      systemTransferredQty: round4((Number(item.systemTransferredQty) || 0) + qty),
      lastSystemTransferAt: nowIso,
      updatedAt: nowIso
    };
    const marked = base.map(i => (i.id === item.id ? markedItem : i));
    if (!saveOfficialWarehouseItems(marked)) {
      showToast?.('e-Fatura deposu kaydedilemedi (depolama hatası); aktarım yapılmadı.', 'error');
      transferRef.current = null;
      setTransferringId(null);
      return;
    }
    setOfficialWarehouse(marked);

    try {
      const freshInventory = await readFreshInventory();
      const match = findInventoryMatch(freshInventory, {
        gtin: item.gtin,
        barcode: item.barcode,
        name: item.productName
      });
      const adjustment = {
        date: nowIso,
        amount: qty,
        note: `EDM e-Fatura deposundan Sistem Deposuna aktarım (${item.lastInvoiceNo || 'fatura no yok'} • ${item.lastSupplierName || 'tedarikçi yok'})`
      };

      if (match) {
        await updateInventoryItem({
          ...match,
          quantity: round2(Number(match.quantity || 0) + qty),
          buyingPrice: item.purchasePrice || match.buyingPrice,
          lastUpdated: nowIso,
          adjustments: [...(match.adjustments || []), adjustment]
        });
      } else {
        const pesticideId = generateUUID();
        await (dbService as any).addGlobalPesticide?.({
          id: pesticideId,
          name: item.productName,
          activeIngredient: 'Belirtilmedi',
          defaultDosage: '',
          category: mapEdmCategory(item.category),
          description: 'EDM e-Fatura deposundan aktarım ile otomatik eklendi.',
          barcode: item.barcode || undefined
        });
        await addInventoryItem({
          id: generateUUID(),
          pesticideId,
          pesticideName: item.productName,
          category: mapEdmCategory(item.category),
          quantity: round2(qty),
          unit: item.unit,
          buyingPrice: item.purchasePrice,
          cashPrice: item.salePrice,
          sellingPrice: round2(item.salePrice * 1.1),
          barcode: item.barcode || '',
          gtin: gtinKey(item.gtin) || gtinKey(item.barcode) || undefined,
          lastUpdated: nowIso,
          lowStockThreshold: 5,
          adjustments: [adjustment]
        });
      }

      showToast?.(`"${item.productName}" (${qty} ${item.unit}) fiziki Sistem Deposuna aktarıldı. Bu miktar tekrar aktarılamaz.`, 'success');
    } catch (err) {
      console.error('[EDM] Sistem Deposuna aktarım başarısız:', err);
      // Stok yazılamadı: "aktarıldı" işaretini geri al ki kullanıcı tekrar deneyebilsin
      const rolledBack = latestOfficial().map(i =>
        i.id === item.id
          ? {
              ...i,
              pendingSystemTransferQty: qty,
              systemTransferredQty: item.systemTransferredQty,
              lastSystemTransferAt: item.lastSystemTransferAt
            }
          : i
      );
      if (saveOfficialWarehouseItems(rolledBack)) setOfficialWarehouse(rolledBack);
      const msg = err instanceof Error ? err.message : String(err);
      showToast?.(`Sistem Deposuna aktarım başarısız: ${msg}`, 'error');
    } finally {
      transferRef.current = null;
      setTransferringId(null);
    }
  };

  /** Manuel / XML gelen e-Fatura kaydı: VKN doğrulama, kesirli miktar, KDV oranı ve mükerrer kontrolü */
  const handleAddManualIncoming = () => {
    if (!newSupplierName.trim() || !newLineName.trim()) {
      showToast?.('Lütfen firma ve ürün adını giriniz.', 'error');
      return;
    }
    const supplierTax = checkRequiredTaxId(newSupplierVkn);
    if (!supplierTax.ok) {
      showToast?.(
        `Tedarikçi VKN/TC geçersiz: ${supplierTax.result.message || 'VKN (10 hane) veya TC Kimlik (11 hane) zorunludur.'}`,
        'error'
      );
      return;
    }
    const supplierVkn = cleanTaxId(newSupplierVkn);
    const parsedQty = round4(parseDecimal(newLineQty));
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      showToast?.('Lütfen 0\'dan büyük geçerli bir miktar giriniz (kesirli olabilir, örn. 0,5).', 'error');
      return;
    }
    const parsedUnitPrice = round4(parseDecimal(newLinePrice));
    if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0) {
      showToast?.('Lütfen geçerli bir birim alış fiyatı giriniz.', 'error');
      return;
    }
    const parsedVat = Number(newLineVat);
    if (!(ALLOWED_VAT_RATES as readonly number[]).includes(parsedVat)) {
      showToast?.(`KDV oranı yalnızca %${ALLOWED_VAT_RATES.join(', %')} olabilir.`, 'error');
      return;
    }
    const typedInvoiceNo = newInvoiceNo.trim();
    if (typedInvoiceNo) {
      const duplicate = latestIncoming().some(
        i => trUpper(i.invoiceNo) === trUpper(typedInvoiceNo) && cleanTaxId(i.supplierVkn) === supplierVkn
      );
      if (duplicate) {
        showToast?.(`"${typedInvoiceNo}" numaralı fatura bu tedarikçi için zaten kayıtlı. Mükerrer kayıt engellendi.`, 'error');
        return;
      }
    }

    const rawBarcode = newLineBarcode.trim();
    const curYear = new Date().getFullYear();
    const created: IncomingEdmInvoice = {
      id: `edm-inc-${generateUUID()}`,
      // Manuel kayıtta yerel kimlik — gerçek ETTN entegratörden gelince değiştirilir
      ettn: generateUUID(),
      invoiceNo: typedInvoiceNo || `EDM${curYear}${String(Date.now()).slice(-9)}`,
      supplierName: newSupplierName.trim(),
      supplierVkn,
      issueDate: new Date().toISOString().slice(0, 10),
      invoiceType: 'SATIS',
      status: 'PENDING',
      lines: [
        {
          id: `l-${generateUUID()}`,
          productName: newLineName.trim(),
          barcode: rawBarcode || undefined,
          gtin: gtinKey(rawBarcode) || undefined,
          quantity: parsedQty,
          unit: newLineUnit,
          unitPrice: parsedUnitPrice,
          vatRate: parsedVat,
          category: newLineCategory,
          routingMode: newLineRouting,
          ministryBadge:
            newLineCategory === 'FERTILIZER' ? 'GTS' : newLineCategory === 'PESTICIDE' ? 'BKTS' : 'NONE'
        }
      ]
    };
    const next = [created, ...latestIncoming()];
    if (!persistIncoming(next)) return;
    setIsAddIncomingOpen(false);
    setNewLineName('');
    setNewLineBarcode('');
    setNewInvoiceNo('');
    showToast?.('Gelen e-Fatura listeye eklendi.', 'success');
  };

  // Available items for Outgoing e-Fatura: STRICTLY ONLY items with efaturaStock > 0!
  const invoiceableOfficialItems = useMemo(
    () => officialWarehouse.filter(i => i.efaturaStock > 0),
    [officialWarehouse]
  );

  const addDraftLineFromOfficial = (item: OfficialWarehouseItem) => {
    const existing = draftLines.find(l => l.officialItemId === item.id);
    if (existing) {
      const currentQty = Number.isFinite(parseDecimal(existing.qtyInput ?? existing.quantity))
        ? parseDecimal(existing.qtyInput ?? existing.quantity)
        : existing.quantity;
      const nextQty = round4(currentQty + 1);
      if (nextQty > item.efaturaStock) {
        showToast?.(`e-Fatura deposunda bu üründen en fazla ${item.efaturaStock} ${item.unit} bulunmaktadır!`, 'error');
        return;
      }
      setDraftLines(prev =>
        prev.map(l => (l.officialItemId === item.id ? { ...l, quantity: nextQty, qtyInput: undefined } : l))
      );
      return;
    }
    setDraftLines(prev => [
      ...prev,
      {
        officialItemId: item.id,
        productName: item.productName,
        quantity: Math.min(1, item.efaturaStock),
        maxEfaturaStock: item.efaturaStock,
        unit: item.unit,
        unitPrice: item.salePrice,
        vatRate: item.vatRate
      }
    ]);
  };

  const handleIssueOfficialInvoice = async () => {
    if (issuingRef.current) return;

    if (!customerName.trim()) {
      showToast?.('Lütfen alıcı Ad Soyad/Ünvan giriniz.', 'error');
      return;
    }
    const customerTax = checkRequiredTaxId(customerTaxNo);
    if (!customerTax.ok) {
      showToast?.(
        `Alıcı TC/VKN geçersiz: ${customerTax.result.message || 'TC Kimlik (11 hane) veya VKN (10 hane) giriniz.'}`,
        'error'
      );
      return;
    }
    const dealerTax = checkRequiredTaxId(config.companyVknOrTc);
    if (!dealerTax.ok) {
      showToast?.('Belge için geçerli Bayi VKN / TC Kimlik No gerekli. Lütfen "4. EDM ayarları" sekmesinden düzeltin.', 'error');
      return;
    }
    const prefix = String(config.defaultInvoicePrefix || '').trim().toUpperCase();
    if (!INVOICE_PREFIX_RE.test(prefix)) {
      showToast?.('Fatura seri ön eki tam 3 karakter (A-Z / 0-9) olmalıdır. "4. EDM ayarları" sekmesinden düzeltin.', 'error');
      return;
    }
    if (draftLines.length === 0) {
      showToast?.('Lütfen e-Fatura Deposundan en az 1 ürün seçiniz.', 'error');
      return;
    }

    // Kesirli miktarları (0,5 lt) virgül destekli çöz
    const parsedLines = draftLines.map(l => ({
      ...l,
      quantity: round4(parseDecimal(l.qtyInput ?? String(l.quantity)))
    }));
    const badQty = parsedLines.find(l => !Number.isFinite(l.quantity) || l.quantity <= 0);
    if (badQty) {
      showToast?.(`"${badQty.productName}" için geçerli bir miktar giriniz (0'dan büyük, örn. 0,5).`, 'error');
      return;
    }

    issuingRef.current = true;
    setIsIssuing(true);
    try {
      const freshOfficial = latestOfficial();
      const storedOutgoing = getOutgoingEdmInvoices();
      const previousOutgoing = storedOutgoing.length ? storedOutgoing : outgoingInvoices;

      // Validate quantities never exceed efaturaStock (güncel depodan)
      for (const line of parsedLines) {
        const offItem = freshOfficial.find(i => i.id === line.officialItemId);
        if (!offItem || line.quantity > offItem.efaturaStock + 1e-9) {
          showToast?.(
            `"${line.productName}" için e-Fatura deposunda yeterli stok yok (Mevcut: ${offItem?.efaturaStock || 0}).`,
            'error'
          );
          return;
        }
      }

      // Fiziki stok düşülecekse: önce güncel envanterle kontrol et — yetersizse sessizce 0'a kırpma, uyar
      const sysPlan = new Map<string, { item: InventoryItem; qty: number }>();
      if (alsoDeductFromSystemStock) {
        const freshInventory = await readFreshInventory();
        const problems: string[] = [];
        for (const line of parsedLines) {
          const offItem = freshOfficial.find(i => i.id === line.officialItemId);
          const match = findInventoryMatch(freshInventory, {
            gtin: offItem?.gtin,
            barcode: offItem?.barcode,
            name: line.productName
          });
          if (!match) {
            problems.push(`"${line.productName}": Sistem Deposunda eşleşen ürün yok`);
            continue;
          }
          const planned = sysPlan.get(match.id);
          const needed = round4((planned?.qty || 0) + line.quantity);
          const available = Number(match.quantity) || 0;
          if (available + 1e-9 < needed) {
            problems.push(`"${line.productName}": fiziki stok yetersiz (Mevcut ${available} ${match.unit}, gerekli ${needed})`);
            continue;
          }
          sysPlan.set(match.id, { item: match, qty: needed });
        }
        if (problems.length > 0) {
          showToast?.(
            `Fiziki stok düşümü yapılamaz — ${problems.join(' • ')}. Stoğu düzeltin veya "Fiziki Sistem Deposundan da düşülsün" seçeneğini kapatın. Belge oluşturulmadı.`,
            'error'
          );
          return;
        }
      }

      // Satır bazlı yuvarlama (GİB ile aynı toplam): lineNet = round2(qty × birim), lineVat = round2(lineNet × KDV)
      const recordLines = parsedLines.map(l => {
        const unitPrice = round4(Number(l.unitPrice) || 0);
        const lineNet = round2(l.quantity * unitPrice);
        const lineVat = round2((lineNet * (Number(l.vatRate) || 0)) / 100);
        return {
          officialItemId: l.officialItemId,
          productName: l.productName,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice,
          vatRate: l.vatRate,
          lineNet,
          lineVat
        };
      });
      const totalNet = round2(recordLines.reduce((acc, l) => acc + l.lineNet, 0));
      const totalVat = round2(recordLines.reduce((acc, l) => acc + l.lineVat, 0));

      // Yerel taslak numarası: seri + yıl bazlı sıra (yeni yılda 1'den başlar)
      const currentYear = new Date().getFullYear();
      const numberPrefix = `${prefix}${currentYear}`;
      const maxSeq = previousOutgoing.reduce((max, inv) => {
        const no = String(inv.invoiceNo || '');
        if (!no.startsWith(numberPrefix)) return max;
        const m = no.slice(numberPrefix.length).match(/^(\d{1,9})$/);
        return m ? Math.max(max, parseInt(m[1], 10) || 0) : max;
      }, 0);
      const newRecord: OutgoingEdmInvoiceRecord = {
        id: `out-${generateUUID()}`,
        // Yerel taslak kimliği — GİB ETTN'si DEĞİLDİR (entegratör bağlanınca yanıttan alınacak)
        ettn: generateUUID(),
        invoiceNo: `${numberPrefix}${String(maxSeq + 1).padStart(9, '0')}`,
        documentType: selectedDocType,
        customerName: customerName.trim(),
        customerTaxOrTcNo: cleanTaxId(customerTaxNo),
        issueDate: new Date().toISOString().slice(0, 10),
        totalNet,
        totalAmount: round2(totalNet + totalVat),
        totalVat,
        status: 'DRAFT',
        deductedFromSystemStock: alsoDeductFromSystemStock,
        lines: recordLines
      };

      // 1) Önce taslak belgeyi kaydet
      const nextOutgoing = [newRecord, ...previousOutgoing];
      if (!saveOutgoingEdmInvoices(nextOutgoing)) {
        showToast?.('Taslak belge kaydedilemedi (depolama hatası). Hiçbir stok düşülmedi.', 'error');
        return;
      }
      setOutgoingInvoices(nextOutgoing);

      // 2) e-Fatura deposundan düş (yetersizlik yukarıda engellendi; kırpma yok)
      const nowIso = new Date().toISOString();
      const nextOfficial = freshOfficial.map(item => {
        const used = recordLines
          .filter(l => l.officialItemId === item.id)
          .reduce((acc, l) => acc + l.quantity, 0);
        if (!used) return item;
        return {
          ...item,
          efaturaStock: round4(item.efaturaStock - used),
          updatedAt: nowIso
        };
      });
      if (!saveOfficialWarehouseItems(nextOfficial)) {
        saveOutgoingEdmInvoices(previousOutgoing);
        setOutgoingInvoices(previousOutgoing);
        showToast?.('e-Fatura deposu güncellenemedi (depolama hatası). Taslak geri alındı, stok düşülmedi.', 'error');
        return;
      }
      setOfficialWarehouse(nextOfficial);

      // 3) İsteğe bağlı fiziki Sistem Deposu düşümü — hata olursa hepsini geri al
      const applied: InventoryItem[] = [];
      try {
        for (const { item, qty } of sysPlan.values()) {
          await updateInventoryItem({
            ...item,
            quantity: round2((Number(item.quantity) || 0) - qty),
            lastUpdated: nowIso,
            adjustments: [
              ...(item.adjustments || []),
              { date: nowIso, amount: -qty, note: `EDM taslak belge ${newRecord.invoiceNo} (${customerName.trim()})` }
            ]
          });
          applied.push(item);
        }
      } catch (stockErr) {
        console.error('[EDM] Fiziki stok düşümü başarısız, geri alınıyor:', stockErr);
        for (const original of applied) {
          try {
            await updateInventoryItem(original);
          } catch (rollbackErr) {
            console.error('[EDM] Fiziki stok geri alınamadı:', original.pesticideName, rollbackErr);
          }
        }
        saveOfficialWarehouseItems(freshOfficial);
        setOfficialWarehouse(freshOfficial);
        saveOutgoingEdmInvoices(previousOutgoing);
        setOutgoingInvoices(previousOutgoing);
        throw stockErr;
      }

      setDraftLines([]);

      showToast?.(
        `${newRecord.invoiceNo} — ${EDM_DRAFT_LABEL}. Yerel taslak ${selectedDocType} kaydedildi ve e-Fatura stoğundan düşüldü${alsoDeductFromSystemStock ? ' (fiziki stoktan da düşüldü)' : ''}. GİB'e gönderim YAPILMADI.`,
        'info'
      );
    } catch (err) {
      console.error('[EDM] Taslak belge oluşturulamadı:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast?.(`Taslak belge oluşturulamadı: ${msg}. Değişiklikler geri alındı.`, 'error');
    } finally {
      issuingRef.current = false;
      setIsIssuing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-mks-modal="true"
      className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div className="bg-stone-950 border border-white/15 rounded-3xl w-full max-w-6xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {/* ==================== HEADER ==================== */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-950/90 via-stone-900 to-stone-950 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
              <Receipt size={24} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  EDM E-Fatura &amp; Çoklu Depo Ayrıştırma Merkezi
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  e-Fatura Deposu + Sistem Deposu + BKTS/GTS
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-200 border border-amber-500/40 flex items-center gap-1">
                  <AlertTriangle size={11} /> {EDM_DRAFT_LABEL}
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Gelen e-Faturaları ister <b>Sadece e-Fatura Deposunda</b> bırakın, ister <b>Sistem Deposuna &amp; Tedarikçi Carisine</b> aktarın. Fatura keserken <b>sadece e-Faturalı ürünler</b> listelenir!
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} className="self-end sm:self-auto" />
        </div>

        {/* ==================== NAVIGATION TABS ==================== */}
        <div className="px-4 sm:px-6 py-2.5 bg-stone-900/90 border-b border-white/10 mks-tab-rail">
          {[
            {
              id: 'incoming' as const,
              label: '1. Gelen e-Faturalar',
              badge: incomingInvoices.filter(i => i.status === 'PENDING').length
            },
            {
              id: 'issue' as const,
              label: '2. Taslak e-Fatura / e-Arşiv',
              badge: invoiceableOfficialItems.length
            },
            {
              id: 'warehouses' as const,
              label: '3. Depolar arası stok',
              badge: officialWarehouse.length
            },
            {
              id: 'settings' as const,
              label: '4. EDM ayarları'
            }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 min-h-[44px] px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                activeTab === t.id
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-sm font-extrabold'
                  : 'bg-stone-950/80 text-stone-300 border-white/10 hover:bg-stone-800'
              }`}
            >
              <span>{t.label}</span>
              {typeof t.badge === 'number' && (
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] font-bold tabular-nums">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ==================== BODY CONTENT ==================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ---------------- TAB 1: INCOMING E-INVOICES & WAREHOUSE ROUTING ---------------- */}
          {activeTab === 'incoming' && (
            <div className="space-y-5">
              {/* Architecture Info Banner */}
              <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                    <Layers size={16} /> Alınan fiziki mal ile kesilen fatura farklıysa nasıl çalışır?
                  </h3>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    • <b>Sadece e-Fatura deposunda bırak:</b> Gerçek dükkan stoğunuzu (Sistem Deposu) ve Tedarikçi Carinizi <b>etkilemez</b>. Ürün sadece resmi <b>e-Fatura Deposuna</b> girer; fatura keserken karşınıza çıkar.<br />
                    • <b>Sistem deposuna ve cariye aktar:</b> Fatura ile gelen mal birebir aynıysa hem <b>e-Fatura Deposuna</b>, hem gerçek <b>Sistem Deposuna</b>, hem de <b>Tedarikçi Carisine</b> işlenir.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddIncomingOpen(!isAddIncomingOpen)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Plus size={15} /> Yeni gelen e-Fatura ekle
                </button>
              </div>

              {/* Manual Incoming Invoice Form */}
              {isAddIncomingOpen && (
                <div className="bg-stone-900 border border-indigo-500/40 rounded-2xl p-4 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                    Manuel / XML Gelen e-Fatura Kaydı
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      value={newSupplierName}
                      onChange={e => setNewSupplierName(e.target.value)}
                      placeholder="Tedarikçi Firma Ünvanı"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                    />
                    <div>
                      <input
                        value={newSupplierVkn}
                        onChange={e => setNewSupplierVkn(e.target.value.replace(/[^\d\s]/g, ''))}
                        inputMode="numeric"
                        maxLength={13}
                        placeholder="Tedarikçi VKN (10) / TC No (11) — zorunlu"
                        className={`w-full min-h-[44px] px-3 py-2.5 bg-stone-950 border rounded-xl text-xs text-white ${
                          newSupplierVkn.trim() && !checkRequiredTaxId(newSupplierVkn).ok
                            ? 'border-rose-500/70'
                            : 'border-white/15'
                        }`}
                      />
                      {newSupplierVkn.trim() && !checkRequiredTaxId(newSupplierVkn).ok && (
                        <p className="text-[10px] text-rose-300 mt-1">{checkRequiredTaxId(newSupplierVkn).result.message}</p>
                      )}
                    </div>
                    <input
                      value={newInvoiceNo}
                      onChange={e => setNewInvoiceNo(e.target.value)}
                      placeholder="e-Fatura No (Örn: EDM2026000123)"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    <input
                      value={newLineName}
                      onChange={e => setNewLineName(e.target.value)}
                      placeholder="Faturadaki Ürün Adı"
                      className="sm:col-span-2 min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                    />
                    <input
                      value={newLineBarcode}
                      onChange={e => setNewLineBarcode(e.target.value)}
                      placeholder="Barkod / GTIN (opsiyonel)"
                      inputMode="numeric"
                      className="sm:col-span-2 min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white font-mono"
                    />
                    <select
                      value={newLineCategory}
                      onChange={e => setNewLineCategory(e.target.value as IncomingEdmInvoiceLine['category'])}
                      aria-label="Kategori"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="PESTICIDE">🏛️ İlaç (BKTS)</option>
                      <option value="FERTILIZER">🌱 Gübre (GTS)</option>
                      <option value="SEED">Tohum</option>
                      <option value="OTHER">Diğer</option>
                    </select>
                    <select
                      value={newLineRouting}
                      onChange={e => setNewLineRouting(e.target.value as any)}
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white font-bold"
                    >
                      <option value="EFATURA_ONLY">🧾 Sadece e-Fatura Deposu</option>
                      <option value="TRANSFER_TO_SYSTEM">🔄 Sistem Deposuna da Aktar</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newLineQty}
                      onChange={e => setNewLineQty(e.target.value)}
                      placeholder="Miktar (örn. 0,5)"
                      aria-label="Miktar"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                    />
                    <select
                      value={newLineUnit}
                      onChange={e => setNewLineUnit(e.target.value as IncomingEdmInvoiceLine['unit'])}
                      aria-label="Birim"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white font-bold"
                    >
                      {EDM_UNITS.map(u => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newLinePrice}
                      onChange={e => setNewLinePrice(e.target.value)}
                      placeholder="Birim Fiyat (₺, KDV hariç)"
                      aria-label="Birim fiyat"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                    />
                    <select
                      value={newLineVat}
                      onChange={e => setNewLineVat(e.target.value)}
                      aria-label="KDV oranı"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white font-bold"
                    >
                      {ALLOWED_VAT_RATES.map(r => (
                        <option key={r} value={String(r)}>
                          KDV %{r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsAddIncomingOpen(false)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleAddManualIncoming}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 text-stone-950 font-black text-xs"
                    >
                      Listeye Ekle
                    </button>
                  </div>
                </div>
              )}

              {/* Incoming Invoices List */}
              <div className="space-y-4">
                {incomingInvoices.length === 0 ? (
                  <div className="bg-stone-900/60 border border-dashed border-white/15 rounded-2xl p-10 text-center space-y-3">
                    <Receipt size={32} className="mx-auto text-indigo-400 opacity-75" />
                    <div className="text-sm font-bold text-white">Henüz kayıtlı gelen e-Fatura bulunmuyor</div>
                    <p className="text-xs text-stone-400 max-w-md mx-auto">
                      EDM hesabınızı bağladığınızda veya üstteki <b>"Yeni Gelen e-Fatura Ekle"</b> butonunu kullandığınızda gelen faturalarınız burada listelenir.
                    </p>
                  </div>
                ) : null}
                {incomingInvoices.map(inv => (
                  <div
                    key={inv.id}
                    className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${
                      inv.status === 'PROCESSED'
                        ? 'bg-stone-900/40 border-emerald-500/30'
                        : 'bg-stone-900/90 border-white/15'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-black font-mono">
                            {inv.invoiceNo}
                          </span>
                          <span className="text-sm sm:text-base font-black text-white">{inv.supplierName}</span>
                          <span className="text-xs text-stone-400">VKN: {inv.supplierVkn}</span>
                          <span className="text-xs text-stone-400">• Tarih: {inv.issueDate}</span>
                        </div>
                        {inv.processedSummary && (
                          <p className="text-xs text-emerald-400 font-bold mt-1">✅ {inv.processedSummary}</p>
                        )}
                        {inv.lastError && inv.status !== 'PROCESSED' && (
                          <p className="text-xs text-rose-300 font-bold mt-1 flex items-start gap-1">
                            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {inv.lastError}
                          </p>
                        )}
                      </div>

                      {inv.status === 'PENDING' ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            disabled={!!processingId}
                            onClick={() => setAllLinesRouting(inv.id, 'EFATURA_ONLY')}
                            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold disabled:opacity-50"
                          >
                            Tümünü e-Fatura Deposunda Bırak
                          </button>
                          <button
                            disabled={!!processingId}
                            onClick={() => setAllLinesRouting(inv.id, 'TRANSFER_TO_SYSTEM')}
                            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[11px] font-bold disabled:opacity-50"
                          >
                            Tümünü Sistem Deposuna Aktar
                          </button>
                          <button
                            disabled={!!processingId}
                            aria-busy={processingId === inv.id}
                            onClick={() => processIncomingInvoice(inv)}
                            className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center gap-1.5 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <CheckCircle2 size={15} />{' '}
                            {processingId === inv.id ? 'İşleniyor…' : 'Seçilen Şekilde Onayla & İşle'}
                          </button>
                        </div>
                      ) : inv.status === 'PROCESSING' ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-black">
                            ⏳ İşleniyor
                          </span>
                          {processingId !== inv.id && (
                            <button
                              onClick={() => resetStuckInvoice(inv)}
                              className="min-h-[44px] px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-bold"
                            >
                              Yarım kalan işlemi sıfırla
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
                          ✅ İşlendi
                        </span>
                      )}
                    </div>

                    {/* Invoice Lines with Individual Warehouse Target Selector */}
                    <div className="space-y-2.5">
                      {inv.lines.map(line => {
                        const netUnit = calculateChainedNetPrice(line.unitPrice, line.discountRates || []);
                        return (
                          <div
                            key={line.id}
                            className="bg-stone-950/80 border border-white/10 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-white text-xs sm:text-sm">{line.productName}</span>
                                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-black">
                                  🧾 e-Fatura Kalemi
                                </span>
                                {(line.ministryBadge === 'BKTS' || line.ministryBadge === 'BKST') && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-black">
                                    🏛️ BKTS İlaç
                                  </span>
                                )}
                                {line.ministryBadge === 'GTS' && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
                                    🌱 GTS Gübre
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-400 flex flex-wrap items-center gap-3">
                                <span>
                                  Miktar: <b className="text-white">{line.quantity} {line.unit}</b>
                                </span>
                                <span>
                                  Liste: <b>{line.unitPrice.toLocaleString('tr-TR')} ₺</b>
                                </span>
                                {line.discountRates && line.discountRates.length > 0 && (
                                  <span className="text-amber-300">
                                    İskonto: %{line.discountRates.join(' + %')} ➔ Net: <b>{netUnit.toLocaleString('tr-TR')} ₺</b>
                                  </span>
                                )}
                                <span>KDV: %{line.vatRate}</span>
                              </div>
                            </div>

                            {/* 2-Button Warehouse Routing Switch per Line */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                disabled={inv.status !== 'PENDING' || !!processingId}
                                onClick={() => toggleLineRouting(inv.id, line.id, 'EFATURA_ONLY')}
                                className={`min-h-[44px] px-3 py-2 rounded-xl text-[11px] font-black border transition-all disabled:cursor-not-allowed ${
                                  line.routingMode === 'EFATURA_ONLY'
                                    ? 'bg-amber-500 text-stone-950 border-amber-400 shadow'
                                    : 'bg-stone-900 text-stone-400 border-white/10 hover:text-white'
                                }`}
                              >
                                🧾 Sadece e-Fatura Deposunda Bırak
                              </button>
                              <button
                                disabled={inv.status !== 'PENDING' || !!processingId}
                                onClick={() => toggleLineRouting(inv.id, line.id, 'TRANSFER_TO_SYSTEM')}
                                className={`min-h-[44px] px-3 py-2 rounded-xl text-[11px] font-black border transition-all disabled:cursor-not-allowed ${
                                  line.routingMode === 'TRANSFER_TO_SYSTEM'
                                    ? 'bg-emerald-500 text-stone-950 border-emerald-400 shadow'
                                    : 'bg-stone-900 text-stone-400 border-white/10 hover:text-white'
                                }`}
                              >
                                🔄 Sistem Deposuna &amp; Cariye Aktar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------------- TAB 2: ISSUE OUTGOING E-FATURA (STRICTLY FROM E-FATURA WAREHOUSE) ---------------- */}
          {activeTab === 'issue' && (
            <div className="space-y-5">
              {/* Draft-only warning: no live GİB / integrator call exists yet */}
              <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 flex items-start gap-3" role="note">
                <AlertTriangle size={22} className="text-amber-300 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-black text-amber-200">{EDM_DRAFT_LABEL}</h3>
                  <p className="text-xs text-stone-300 mt-0.5">
                    Bu ekranda oluşturulan belgeler yalnızca <b>yerel taslaktır</b>; GİB&apos;e veya özel entegratöre <b>gönderilmez</b>, yasal fatura yerine geçmez. Resmi belgeyi entegratör portalınızdan kesin. Taslak kaydedildiğinde e-Fatura Deposu stoğu (ve seçerseniz fiziki stok) düşülür.
                  </p>
                </div>
              </div>

              {/* Zero-Mistake Filter Banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck size={22} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-black text-emerald-300">
                    Yanlış Ürün Faturası Kesmeyi Engelleyen Akıllı Filtre Aktif!
                  </h3>
                  <p className="text-xs text-stone-300 mt-0.5">
                    Aşağıdaki ürün listesinde <b>SADECE e-Fatura ile girişi yapılmış (e-Fatura Deposunda stoğu bulunan)</b> ürünler yer alır. e-Fatura girişi olmayan ürünler burada kesinlikle görünmez; böylece olmayan ürünün faturasını kesme hatası %100 önlenir.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Only e-Fatura Warehouse Stock List */}
                <div className="lg:col-span-6 bg-stone-900/90 border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                      🧾 e-Fatura Deposundaki Faturalanabilir Ürünler ({invoiceableOfficialItems.length})
                    </h4>
                  </div>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Sadece e-Faturalı ürünlerde ara..."
                      className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-white/10 rounded-xl text-xs text-white"
                    />
                  </div>

                  {invoiceableOfficialItems.length === 0 ? (
                    <div className="text-center py-10 text-stone-400 text-xs space-y-2">
                      <p>Henüz e-Fatura Deposunda faturalanabilir stok bulunmuyor.</p>
                      <button
                        onClick={() => setActiveTab('incoming')}
                        className="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold"
                      >
                        1. Sekmeden Gelen e-Fatura Onaylayın
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {invoiceableOfficialItems
                        .filter(i => !searchQuery || trLower(i.productName).includes(trLower(searchQuery)) || (!!i.barcode && i.barcode.includes(searchQuery.trim())))
                        .map(item => (
                          <div
                            key={item.id}
                            className="bg-stone-950 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2 hover:border-indigo-500/40 transition-all"
                          >
                            <div>
                              <div className="text-xs font-black text-white">{item.productName}</div>
                              <div className="flex items-center gap-2 mt-1 text-[11px]">
                                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-black">
                                  Resmi e-Fatura Stoğu: {item.efaturaStock} {item.unit}
                                </span>
                                <span className="text-stone-400">
                                  Satış: {item.salePrice.toLocaleString('tr-TR')} ₺ (KDV %{item.vatRate})
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => addDraftLineFromOfficial(item)}
                              className="min-h-[44px] px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs shrink-0"
                            >
                              + Taslağa Ekle
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Right: Outgoing e-Fatura Builder */}
                <div className="lg:col-span-6 bg-stone-900/90 border border-white/10 rounded-2xl p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                      📤 Taslak Belge (Resmi Gönderim Yok)
                    </h4>
                    <div className="flex items-center gap-1.5">
                      {(['EARSIV', 'EFATURA', 'EMUSTAHSIL'] as const).map(dt => (
                        <button
                          key={dt}
                          onClick={() => setSelectedDocType(dt)}
                          aria-pressed={selectedDocType === dt}
                          className={`min-h-[44px] px-2.5 py-1 rounded-lg text-[10px] font-black ${
                            selectedDocType === dt
                              ? 'bg-emerald-500 text-stone-950'
                              : 'bg-stone-950 text-stone-400 border border-white/10'
                          }`}
                        >
                          {dt === 'EARSIV' ? 'e-Arşiv' : dt === 'EFATURA' ? 'e-Fatura' : 'e-Müstahsil'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="Alıcı Ad Soyad / Firma Ünvanı"
                      className="min-h-[44px] px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                    />
                    <div>
                      <input
                        value={customerTaxNo}
                        onChange={e => setCustomerTaxNo(e.target.value.replace(/[^\d\s]/g, ''))}
                        inputMode="numeric"
                        maxLength={13}
                        placeholder="TC Kimlik No (11 Hane) veya VKN (10 Hane)"
                        className={`w-full min-h-[44px] px-3 py-2.5 bg-stone-950 border rounded-xl text-xs text-white ${
                          customerTaxNo.trim() && !checkRequiredTaxId(customerTaxNo).ok
                            ? 'border-rose-500/70'
                            : 'border-white/15'
                        }`}
                      />
                      {customerTaxNo.trim() && !checkRequiredTaxId(customerTaxNo).ok && (
                        <p className="text-[10px] text-rose-300 mt-1">{checkRequiredTaxId(customerTaxNo).result.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Option to deduct from only e-Fatura warehouse vs both */}
                  <label className="flex items-center gap-2.5 p-3 min-h-[44px] rounded-xl bg-stone-950 border border-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alsoDeductFromSystemStock}
                      onChange={e => setAlsoDeductFromSystemStock(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500"
                    />
                    <span className="text-xs text-stone-200">
                      <b>Fiziki Sistem Deposundan da düşülsün mü?</b> (İşaretlenmezse <u>sadece e-Fatura Deposundan</u> düşer, dükkan stoğunuza dokunmaz)
                    </span>
                  </label>

                  {/* Selected Lines */}
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {draftLines.length === 0 ? (
                      <div className="text-center py-6 text-stone-500 text-xs">
                        Soldaki e-Fatura stoğundan ürün seçiniz.
                      </div>
                    ) : (
                      draftLines.map(line => (
                        <div
                          key={line.officialItemId}
                          className="bg-stone-950 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{line.productName}</div>
                            <div className="text-[10px] text-stone-400">
                              Maks. Faturalanabilir: {line.maxEfaturaStock} {line.unit} • Birim: {line.unitPrice} ₺
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${line.productName} miktarı`}
                              value={line.qtyInput ?? String(line.quantity).replace('.', ',')}
                              onChange={e => {
                                const raw = e.target.value;
                                const parsed = parseDecimal(raw);
                                if (Number.isFinite(parsed) && parsed > line.maxEfaturaStock) {
                                  showToast?.(
                                    `e-Fatura deposunda bu üründen en fazla ${line.maxEfaturaStock} ${line.unit} bulunmaktadır!`,
                                    'error'
                                  );
                                  return;
                                }
                                setDraftLines(prev =>
                                  prev.map(l =>
                                    l.officialItemId === line.officialItemId
                                      ? {
                                          ...l,
                                          qtyInput: raw,
                                          quantity: Number.isFinite(parsed) && parsed > 0 ? round4(parsed) : l.quantity
                                        }
                                      : l
                                  )
                                );
                              }}
                              className="w-20 min-h-[44px] px-2 py-1 bg-stone-900 border border-white/15 rounded-lg text-center text-white font-bold"
                            />
                            <button
                              onClick={() =>
                                setDraftLines(prev => prev.filter(l => l.officialItemId !== line.officialItemId))
                              }
                              aria-label={`${line.productName} satırını kaldır`}
                              className="w-11 h-11 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={handleIssueOfficialInvoice}
                    disabled={isIssuing}
                    aria-busy={isIssuing}
                    className="w-full min-h-[48px] py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Send size={15} />{' '}
                    {isIssuing
                      ? 'Taslak kaydediliyor…'
                      : `TASLAK ${selectedDocType === 'EARSIV' ? 'e-Arşiv' : selectedDocType === 'EFATURA' ? 'e-Fatura' : 'e-Müstahsil'} Kaydet & e-Fatura Stoğundan Düş`}
                  </button>
                  <p className="text-[10px] text-amber-200/90 text-center">
                    {EDM_DRAFT_LABEL} — GİB&apos;e gönderim yapılmaz.
                  </p>

                  {outgoingInvoices.length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <div className="text-[11px] font-black text-stone-400">Son taslak belgeler</div>
                      {outgoingInvoices.slice(0, 5).map(rec => (
                        <div key={rec.id} className="flex items-center justify-between gap-2 text-[11px] text-stone-300">
                          <span className="font-mono truncate">{rec.invoiceNo}</span>
                          <span className="truncate">{rec.customerName}</span>
                          <span className="tabular-nums">{formatTl(rec.totalAmount)} ₺</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 font-black text-[9px]">
                            {rec.status === 'SENT' ? 'GÖNDERİLDİ' : rec.status === 'PENDING_SEND' ? 'GÖNDERİM BEKLİYOR' : 'TASLAK'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- TAB 3: 3-WAREHOUSE COMPARISON MATRIX ---------------- */}
          {activeTab === 'warehouses' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-stone-900 border border-indigo-500/30 rounded-2xl p-4">
                  <div className="text-xs font-black text-indigo-300">🧾 1. e-FATURA DEPOSU (EDM)</div>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Resmi alış e-Faturası ile giren ve müşteriye e-Fatura/e-Arşiv kesilebilir stok havuzu.
                  </p>
                </div>
                <div className="bg-stone-900 border border-emerald-500/30 rounded-2xl p-4">
                  <div className="text-xs font-black text-emerald-300">🏠 2. SİSTEM DEPOSU (FİZİKİ DÜKKAN)</div>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Dükkanınızdaki gerçek fiziki stok ve gerçek müşteri/tedarikçi cari hesabınız.
                  </p>
                </div>
                <div className="bg-stone-900 border border-amber-500/30 rounded-2xl p-4">
                  <div className="text-xs font-black text-amber-300">🏛️ 3. BKTS &amp; 🌱 GTS RESMİ STOK</div>
                  <p className="text-[11px] text-stone-400 mt-1">
                    Tarım Bakanlığı sisteminde bayi GLN numaranız üzerinde görünen karekodlu ilaç/gübre stoğu.
                  </p>
                </div>
              </div>

              <div className="bg-stone-900 border border-white/10 rounded-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-950 text-stone-400 border-b border-white/10">
                      <th className="p-3 font-black">Ürün Adı &amp; Kaynak Rozeti</th>
                      <th className="p-3 font-black text-center text-indigo-300">🧾 e-Fatura Stoğu</th>
                      <th className="p-3 font-black text-center text-amber-300">🏛️ BKTS / 🌱 GTS</th>
                      <th className="p-3 font-black text-center text-emerald-300">🏠 Fiziki Sistem Stoğu</th>
                      <th className="p-3 font-black text-right">Depolar Arası İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {officialWarehouse.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-stone-400 text-xs">
                          Henüz resmi e-Fatura / BKTS deposunda kayıtlı stok bulunmuyor.
                        </td>
                      </tr>
                    ) : null}
                    {officialWarehouse.map(item => {
                      const sysMatch = findInventoryMatch(inventory || [], {
                        gtin: item.gtin,
                        barcode: item.barcode,
                        name: item.productName
                      });
                      const pendingQty = getPendingTransferQty(item);
                      const isTransferring = transferringId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.02]">
                          <td className="p-3">
                            <div className="font-black text-white">{item.productName}</div>
                            <div className="text-[10px] text-stone-400">
                              Son Fatura: {item.lastInvoiceNo || '—'} • {item.lastSupplierName || ''}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-black">
                              {item.efaturaStock} {item.unit}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold">
                              BKTS: {item.bktsStock} / GTS: {item.gtsStock}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-black">
                              {sysMatch ? `${sysMatch.quantity} ${sysMatch.unit}` : '0 (Aktarılmadı)'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => transferFromEfaturaToSystem(item)}
                              disabled={pendingQty <= 0 || !!transferringId}
                              aria-busy={isTransferring}
                              title={
                                pendingQty <= 0
                                  ? 'Aktarılmamış e-Fatura miktarı yok'
                                  : `${pendingQty} ${item.unit} fiziki depoya aktarılabilir`
                              }
                              className="min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-black disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isTransferring
                                ? 'Aktarılıyor…'
                                : pendingQty > 0
                                  ? `🔄 ${pendingQty} ${item.unit} Sistem Deposuna Aktar`
                                  : '✅ Aktarıldı'}
                            </button>
                            {Number(item.systemTransferredQty) > 0 && (
                              <div className="text-[10px] text-stone-500 mt-1">
                                Toplam aktarılan: {item.systemTransferredQty} {item.unit}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---------------- TAB 4: EDM & MULTI-PROVIDER SETTINGS (VAR / KAYDI YOK) ---------------- */}
          {activeTab === 'settings' && (
            <div className="bg-stone-900 border border-white/10 rounded-2xl p-5 space-y-4 max-w-3xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-sm font-black text-white">
                    E-Fatura Özel Entegratör Seçimi (EDM + 10 Entegratör Desteği)
                  </h3>
                  <p className="text-xs text-stone-400">
                    Sadece EDM değil; Türkiye&apos;deki tüm GİB lisanslı özel entegratörler (UBL-TR 2.1 standardı) desteklenir. Kullanmıyorsanız &ldquo;Kapalı / Serbest&rdquo; bırakabilirsiniz.
                  </p>
                </div>
                <button
                  onClick={() => updateAndPersistConfig({ ...config, enabled: !config.enabled })}
                  aria-pressed={config.enabled}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-black shrink-0 ${
                    config.enabled
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-stone-800 text-stone-400 border border-white/10'
                  }`}
                >
                  {config.enabled ? '🟡 Entegratör Bilgileri Kayıtlı (Canlı Bağlantı Yok)' : '⚪ E-Fatura Kaydı Yok / Kapalı'}
                </button>
              </div>

              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2.5" role="note">
                <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
                <p className="text-xs text-stone-300">
                  <b className="text-amber-200">{EDM_DRAFT_LABEL}.</b> MKS şu an seçilen entegratöre veya GİB&apos;e <b>bağlanmıyor</b>; buradaki kullanıcı adı/şifre hiçbir servise gönderilmez. Şifre yalnızca bu oturumda (sessionStorage) tutulur. Kesilen belgeler yerel <b>taslak</b> olarak kaydedilir; resmi faturayı entegratör portalınızdan kesin.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-indigo-300 block mb-1.5">
                  Çalıştığınız Özel Entegratör Firmayı Seçin
                </label>
                <select
                  value={config.provider || 'EDM'}
                  onChange={e =>
                    updateAndPersistConfig({ ...config, provider: e.target.value as EInvoiceProviderId })
                  }
                  className="w-full px-3.5 py-3 bg-stone-950 border border-indigo-500/40 rounded-xl text-xs font-bold text-white"
                >
                  {EINVOICE_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.endpointHint})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-stone-400 block mb-1">Entegratör Web Servis Kullanıcı Adı</label>
                  <input
                    value={config.username}
                    onChange={e => updateAndPersistConfig({ ...config, username: e.target.value })}
                    placeholder="Örn: EDM / QNB / Uyumsoft / e-Logo kullanıcı adı"
                    className="w-full px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 block mb-1">EDM Web Servis Şifresi</label>
                  <input
                    type="password"
                    value={config.password || ''}
                    onChange={e => updateAndPersistConfig({ ...config, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 bg-stone-950 border border-white/15 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 block mb-1">Bayi VKN / TC Kimlik No</label>
                  <input
                    value={config.companyVknOrTc}
                    onChange={e => updateAndPersistConfig({ ...config, companyVknOrTc: e.target.value.replace(/[^\d\s]/g, '') })}
                    inputMode="numeric"
                    maxLength={13}
                    placeholder="10 veya 11 haneli vergi/TC no"
                    className={`w-full min-h-[44px] px-3 py-2.5 bg-stone-950 border rounded-xl text-xs text-white ${
                      config.companyVknOrTc.trim() && !checkRequiredTaxId(config.companyVknOrTc).ok
                        ? 'border-rose-500/70'
                        : 'border-white/15'
                    }`}
                  />
                  {config.companyVknOrTc.trim() && !checkRequiredTaxId(config.companyVknOrTc).ok && (
                    <p className="text-[10px] text-rose-300 mt-1">{checkRequiredTaxId(config.companyVknOrTc).result.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-stone-400 block mb-1">Fatura Seri Ön Eki (3 Harf)</label>
                  <input
                    maxLength={3}
                    value={config.defaultInvoicePrefix}
                    onChange={e =>
                      updateAndPersistConfig({
                        ...config,
                        defaultInvoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                      })
                    }
                    placeholder="MKS"
                    className={`w-full min-h-[44px] px-3 py-2.5 bg-stone-950 border rounded-xl text-xs text-white font-mono ${
                      INVOICE_PREFIX_RE.test(config.defaultInvoicePrefix || '') ? 'border-white/15' : 'border-rose-500/70'
                    }`}
                  />
                  {!INVOICE_PREFIX_RE.test(config.defaultInvoicePrefix || '') && (
                    <p className="text-[10px] text-rose-300 mt-1">Seri ön eki tam 3 karakter olmalı (A-Z, 0-9).</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EdmIntegrationModal;

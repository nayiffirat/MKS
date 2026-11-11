import { createMultiPagePdf, renderElementToCanvas } from '../utils/pdfHelper';
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Plus, Package, DollarSign, TrendingUp, 
    Trash2, Edit2, Save, X, AlertCircle, Filter,
    ArrowUpRight, ArrowDownRight, BarChart3, PieChart, FlaskConical,
    History, User, Calendar, List, Download, Eye, EyeOff, Camera, Barcode, Truck, RefreshCw, ChevronRight, ClipboardCheck, ArrowRight, ShoppingCart, Share2, Sparkles, Loader2, Upload, ShieldCheck, Layers
} from 'lucide-react';
import LazyBarcodeScanner from './LazyBarcodeScanner';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { dbService } from '../services/db';
import { auth } from '../services/firebase';
import { InventoryItem, InventoryBatch, Pesticide, PesticideCategory, SupplierPurchase } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';
import { SmartOrderModal } from './SmartOrderModal';
import { useBackHandler } from '../utils/navigationManager';
import { parseGS1Barcode, findItemByScan, canonicalBarcodeFromParsed, GS1ParseResult } from '../utils/gs1Parser';
import { daysUntilExpiry, round2 } from '../utils/dateUtils';
import { playScanBeep, playErrorBeep } from '../utils/hardwareBarcodeScanner';
import { generateAIContent, DEFAULT_GEMINI_MODEL } from '../utils/gemini';
import { InventoryItemFormModal, applyScanToInventoryForm, getScanIssues } from './inventory/InventoryItemFormModal';
import { InventoryQuickStockModal, InventoryEditAdjustmentModal, InventoryOcrInvoiceModal } from './inventory/InventoryStockAdjustmentModals';
import { InventoryBatchPriceModal, InventoryRebuildModal } from './inventory/InventoryBatchPriceModal';

// ---------------------------------------------------------------------------
// Parti (batch) / seri yardımcıları — B-03 / B-04
// ---------------------------------------------------------------------------

const normLot = (v?: string) => String(v || '').trim().toLocaleUpperCase('tr-TR');
const normSerial = (v?: string) => String(v || '').trim();
const normName = (v?: string) => String(v || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');

/** Batches of an item; legacy single lot/SKT/seri fields are migrated into one batch on the fly. */
const getItemBatches = (item: InventoryItem): InventoryBatch[] => {
    if (Array.isArray(item.batches) && item.batches.length > 0) {
        return item.batches.map(b => ({ ...b, serialNumbers: b.serialNumbers ? [...b.serialNumbers] : undefined }));
    }
    if (item.lotNumber || item.expiryDate || item.serialNumber) {
        return [{
            lotNumber: item.lotNumber || '',
            expiryDate: item.expiryDate || undefined,
            quantity: round2(Math.max(0, Number(item.quantity) || 0)),
            serialNumbers: item.serialNumber ? [item.serialNumber] : undefined,
            receivedAt: item.lastUpdated
        }];
    }
    return [];
};

/** All serial numbers already registered in the warehouse → owning product name. */
const collectRegisteredSerials = (items: InventoryItem[], excludeItemId?: string): Map<string, string> => {
    const map = new Map<string, string>();
    for (const it of items) {
        if (!it || it.deletedAt || it.id === excludeItemId) continue;
        if (it.serialNumber) map.set(normSerial(it.serialNumber), it.pesticideName);
        for (const b of it.batches || []) {
            for (const s of b.serialNumbers || []) if (s) map.set(normSerial(s), it.pesticideName);
        }
    }
    return map;
};

/** Legacy summary fields = earliest-SKT batch that still has stock (FEFO head). */
const summarizeBatches = (batches: InventoryBatch[]): { lotNumber?: string; expiryDate?: string } => {
    if (batches.length === 0) return {};
    const live = batches.filter(b => (Number(b.quantity) || 0) > 0);
    const pool = live.length > 0 ? live : batches;
    const withExpiry = pool.filter(b => !!b.expiryDate).sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
    const head = withExpiry[0] || pool[pool.length - 1];
    return { lotNumber: head.lotNumber || undefined, expiryDate: head.expiryDate || undefined };
};

/**
 * Stock-in merge: same lot (and compatible SKT) → quantity added to that batch; new lot → new batch.
 * Returns the fields to spread over the item (batches + legacy summary). No batch info → nothing changes.
 */
const mergeStockInBatch = (
    item: InventoryItem,
    entry: { lotNumber?: string; expiryDate?: string; quantity: number; serialNumber?: string }
): Partial<InventoryItem> => {
    const lot = String(entry.lotNumber || '').trim();
    const exp = entry.expiryDate || undefined;
    const serial = normSerial(entry.serialNumber);
    if (!lot && !exp && !serial) return {};
    const qty = round2(Number(entry.quantity) || 0);
    const batches = getItemBatches(item);
    const idx = batches.findIndex(b => normLot(b.lotNumber) === normLot(lot) && (!exp || !b.expiryDate || b.expiryDate === exp));
    if (idx >= 0) {
        const b = batches[idx];
        batches[idx] = {
            ...b,
            expiryDate: b.expiryDate || exp,
            quantity: round2((Number(b.quantity) || 0) + qty),
            serialNumbers: serial ? Array.from(new Set([...(b.serialNumbers || []), serial])) : b.serialNumbers
        };
    } else {
        batches.push({
            lotNumber: lot,
            expiryDate: exp,
            quantity: qty,
            serialNumbers: serial ? [serial] : undefined,
            receivedAt: new Date().toISOString()
        });
    }
    const summary = summarizeBatches(batches);
    return {
        batches,
        lotNumber: summary.lotNumber,
        expiryDate: summary.expiryDate,
        serialNumber: serial || item.serialNumber
    };
};

const toNum = (val: string | number | undefined | null) => {
    const parsed = parseFloat(String(val ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
};

type SupplierPurchaseItemDraft = SupplierPurchase['items'][number];

export const InventoryScreen: React.FC<{ 
    onNavigateToPrescription?: (id: string) => void;
    onNavigateToSupplier?: (id: string) => void;
}> = ({ onNavigateToPrescription, onNavigateToSupplier }) => {
    const { 
        inventory, 
        addInventoryItem, 
        updateInventoryItem, 
        bulkUpdateInventoryItems,
        deleteInventoryItem, softDeleteInventoryItem, restoreInventoryItem, permanentlyDeleteInventoryItem,
        refreshInventory,
        refreshStats,
        showToast,
        hapticFeedback,
        farmers,
        prescriptions,
        suppliers,
        supplierPurchases,
        addSupplierPurchase,
        updateSupplier,
        stats,
        userProfile,
        updateUserProfile,
        activeTeamMember,
        prescriptionLabel,
        farmerLabel,
        farmerPluralLabel,
        accounts
    } = useAppViewModel();
    const isSales = activeTeamMember?.role === 'SALES';
    const canEditInventory = !isSales;
    const hideCost = Boolean(userProfile?.hideCostAndProfit || (isSales && userProfile?.hideBuyingPricesForStaff));
    
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS' | 'PROFIT_LOSS'>('LIST');
    
    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'EXPIRED' | 'SKT_30' | 'SKT_60' | 'SKT_90'>('ALL');

    // Year Selection
    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const yearsList = useMemo(() => {
        const list = [];
        for (let y = currentYear; y >= currentYear - 4; y--) {
            list.push(y);
        }
        return list;
    }, [currentYear]);

    // Modal States
    const [isRebuildModalOpen, setIsRebuildModalOpen] = useState(false);
    const [rebuildState, setRebuildState] = useState<'IDLE' | 'ANALYZING' | 'RESULT' | 'REPAIRING'>('IDLE');
    const [mismatches, setMismatches] = useState<{pesticideId: string, pesticideName: string, currentQty: number, calculatedQty: number, purchasedQty: number, soldQty: number, adjustedQty: number}[]>([]);
    const [selectedMismatches, setSelectedMismatches] = useState<Set<string>>(new Set());
    const [rebuildSearchTerm, setRebuildSearchTerm] = useState('');
    const [isSmartOrderModalOpen, setIsSmartOrderModalOpen] = useState(false);

    const handleAnalyzeInventory = async () => {
        setRebuildState('ANALYZING');
        try {
            const results = await dbService.analyzeInventoryBalances();
            setMismatches(results);
            setSelectedMismatches(new Set(results.map(r => r.pesticideId)));
            setRebuildState('RESULT');
        } catch (error) {
            console.error("Analysis error:", error);
            showToast("Stoklar analiz edilirken hata oluştu.", "error");
            setIsRebuildModalOpen(false);
            setRebuildState('IDLE');
        }
    };

    const handleRepairInventory = async () => {
        setRebuildState('REPAIRING');
        try {
            const selectedFixes = mismatches.filter(m => selectedMismatches.has(m.pesticideId));
            await dbService.applyInventoryFixes(selectedFixes.map(m => ({
                pesticideId: m.pesticideId,
                quantity: Number(m.calculatedQty) || 0
            })));
            await refreshInventory();
            await refreshStats();
            showToast("Seçilen stoklar kusursuz bir şekilde onarıldı.", "success");
            setRebuildState('RESULT');
            setIsRebuildModalOpen(false);
            if (hapticFeedback) hapticFeedback('success');
        } catch (error) {
            console.error("Repair error:", error);
            showToast("Stoklar onarılırken hata oluştu.", "error");
            setRebuildState('RESULT');
        }
    };

    const handleFullRebuild = async () => {
        setRebuildState('REPAIRING');
        try {
            await dbService.rebuildInventoryBalances();
            await refreshInventory();
            await refreshStats();
            showToast("Tüm depo bakiyeleri geçmiş fişlerden baştan sona kusursuzca yeniden hesaplandı.", "success");
            setRebuildState('RESULT');
            setIsRebuildModalOpen(false);
            if (hapticFeedback) hapticFeedback('success');
        } catch (error) {
            console.error("Full rebuild error:", error);
            showToast("Depo yeniden hesaplanırken hata oluştu.", "error");
            setRebuildState('RESULT');
        }
    };
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPriceUpdateModalOpen, setIsPriceUpdateModalOpen] = useState(false);
    const [priceUpdateSearch, setPriceUpdateSearch] = useState('');
    const [priceUpdateItems, setPriceUpdateItems] = useState<InventoryItem[]>([]);

    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isQuickStockModalOpen, setIsQuickStockModalOpen] = useState(false);
    const [quickStockQuantity, setQuickStockQuantity] = useState('');
    const [isEditAdjustmentModalOpen, setIsEditAdjustmentModalOpen] = useState(false);
    const [editingAdjustmentIdx, setEditingAdjustmentIdx] = useState<number | null>(null);
    const [editingAdjustmentAmount, setEditingAdjustmentAmount] = useState('');
    const [showProfitability, setShowProfitability] = useState(false);
    const [isListMenuOpen, setIsListMenuOpen] = useState(false);
    const [stockFilter, setStockFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'IN_STOCK'>('ALL');
    const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [selectedDetailItem, setSelectedDetailItem] = useState<InventoryItem | null>(null);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState<'ALL' | 'SALE' | 'PURCHASE' | 'ADJUSTMENT'>('ALL');
    const [purchaseHistory, setPurchaseHistory] = useState<{ id: string; targetId: string; name: string; date: string; price: number; quantity: string; isReturn: boolean; type: 'SALE' | 'PURCHASE' }[]>([]);

    useEffect(() => {
        if (!selectedDetailItem) {
            setPurchaseHistory([]);
            return;
        }
        
        const history: { id: string; targetId: string; name: string; date: string; price: number; quantity: string; isReturn: boolean; isSupplierSale?: boolean; type: 'SALE' | 'PURCHASE' }[] = [];
        
        supplierPurchases.filter(p => {
            if (p.deletedAt) return false;
            if (selectedYear < currentYear && p.date) {
                const year = new Date(p.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        }).forEach((p, pIdx) => {
            (p.items || []).filter(i => i.pesticideId === selectedDetailItem.pesticideId).forEach((item, iIdx) => {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                const supplierName = supplier ? supplier.name : 'Bilinmeyen Tedarikçi';
                const qtyStr = String(item.quantity || '0').replace(',', '.');
                const parsedQty = parseFloat(qtyStr) || 0;
                
                const isSale = p.type === 'SALE' || p.note?.includes('SATIŞ');
                const isReturn = p.type === 'RETURN' || (p.note?.includes('İADE') && !isSale);
                const effectiveQty = Math.abs(parsedQty);

                history.push({
                    id: iIdx === 0 ? p.id : `${p.id}-${iIdx}-${pIdx}`,
                    targetId: p.supplierId,
                    name: supplierName,
                    date: p.date,
                    price: item.buyingPrice || 0,
                    quantity: effectiveQty.toString(),
                    isReturn: Boolean(isReturn),
                    isSupplierSale: Boolean(isSale),
                    type: isSale ? 'SALE' : 'PURCHASE'
                });
            });
        });
        
        setPurchaseHistory(history);
    }, [selectedDetailItem, supplierPurchases, suppliers, selectedYear]);

    const [isScanning, setIsScanning] = useState(false);
    const [lastFormScan, setLastFormScan] = useState<{ parsed: GS1ParseResult; ts: number } | null>(null);
    
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });
    
    // Form States
    const [productName, setProductName] = useState('');
    const [selectedPesticide, setSelectedPesticide] = useState<Pesticide | null>(null);
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [formData, setFormData] = useState<import('./inventory/InventoryItemFormModal').InventoryFormDataState>({
        quantity: '',
        unit: 'Adet',
        buyingPrice: '',
        cashBuyingPrice: '',
        sellingPrice: '',
        cashPrice: '',
        lowStockThreshold: '',
        barcode: '',
        category: PesticideCategory.OTHER,
        gtin: '',
        lotNumber: '',
        expiryDate: '',
        serialNumber: '',
        packUnitName: '',
        packSize: ''
    });

    // Emanet (#22) & Karantina (#23) local form states
    const [consignParty, setConsignParty] = useState('');
    const [consignType, setConsignType] = useState<'GIVEN' | 'TAKEN' | 'RETURNED'>('GIVEN');
    const [consignQty, setConsignQty] = useState('');
    const [consignNote, setConsignNote] = useState('');
    const [quarantineAddQty, setQuarantineAddQty] = useState('');
    const [quarantineReasonInput, setQuarantineReasonInput] = useState('');

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const pestData = await dbService.getPesticides();
            setPesticides(pestData);
            await refreshInventory();
            setLoading(false);
        };
        init();
    }, []);

    // One-time auto-fix for corrupted inventory data (e.g. duplicates, NaN)
    // Disabled automatic run to prevent infinite loops. Can be triggered manually if needed.
    const fixAnomalies = async () => {
        if (inventory.length === 0) return;
        
        console.log('Starting inventory anomaly check...');
        let needsRefresh = false;
        const seenMap = new Map<string, InventoryItem>();
        
        // We do this in a single pass to be efficient
        for (const item of inventory) {
            let isCorrupted = false;
            
            // 1. Fix NaN or null in numbers
            const fixedItem = { ...item };
            if (isNaN(Number(fixedItem.quantity)) || fixedItem.quantity === null) { fixedItem.quantity = 0; isCorrupted = true; }
            if (isNaN(Number(fixedItem.buyingPrice)) || fixedItem.buyingPrice === null) { fixedItem.buyingPrice = 0; isCorrupted = true; }
            if (isNaN(Number(fixedItem.sellingPrice)) || fixedItem.sellingPrice === null) { fixedItem.sellingPrice = 0; isCorrupted = true; }
            if (isNaN(Number(fixedItem.cashBuyingPrice)) || fixedItem.cashBuyingPrice === null) { fixedItem.cashBuyingPrice = fixedItem.buyingPrice; isCorrupted = true; }
            if (isNaN(Number(fixedItem.cashPrice)) || fixedItem.cashPrice === null) { fixedItem.cashPrice = fixedItem.sellingPrice; isCorrupted = true; }

            // Force numeric types
            fixedItem.quantity = Number(fixedItem.quantity);
            fixedItem.buyingPrice = Number(fixedItem.buyingPrice);
            fixedItem.sellingPrice = Number(fixedItem.sellingPrice);
            fixedItem.cashBuyingPrice = Number(fixedItem.cashBuyingPrice);
            fixedItem.cashPrice = Number(fixedItem.cashPrice);

            // 2. Deduplicate
            if (seenMap.has(fixedItem.pesticideId)) {
                const existing = seenMap.get(fixedItem.pesticideId)!;
                existing.quantity += fixedItem.quantity;
                await updateInventoryItem(existing);
                await permanentlyDeleteInventoryItem(fixedItem.id);
                needsRefresh = true;
                continue;
            } else {
                seenMap.set(fixedItem.pesticideId, fixedItem);
            }

            if (isCorrupted) {
                await updateInventoryItem(fixedItem);
                needsRefresh = true;
            }
        }
        
        if (needsRefresh) {
            await refreshInventory();
            showToast('Envanter verileri optimize edildi', 'info');
        }
    };

    // B-16: SKT is the last valid day, compared on the local calendar (shared helper).
    const getDaysUntilExpiry = (expiryDate?: string): number | null => daysUntilExpiry(expiryDate);

    const sktRadarCounts = useMemo(() => {
        let expired = 0;
        let d30 = 0;
        let d60 = 0;
        let d90 = 0;
        inventory.forEach(item => {
            if (item.deletedAt || (Number(item.quantity) || 0) <= 0) return;
            const days = getDaysUntilExpiry(item.expiryDate);
            if (days === null) return;
            if (days < 0) expired++;
            else if (days <= 30) d30++;
            else if (days <= 60) d60++;
            else if (days <= 90) d90++;
        });
        return { expired, d30, d60, d90, totalRisk: expired + d30 + d60 + d90 };
    }, [inventory]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const qLower = searchTerm.toLocaleLowerCase('tr-TR');
            const matchesSearch = item.pesticideName.toLocaleLowerCase('tr-TR').includes(qLower) || 
                                (item.barcode && item.barcode.includes(searchTerm)) ||
                                (item.gtin && item.gtin.includes(searchTerm)) ||
                                (item.lotNumber && item.lotNumber.toLocaleLowerCase('tr-TR').includes(qLower));
            const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
            
            let matchesStock = true;
            if (stockFilter === 'OUT_OF_STOCK') matchesStock = item.quantity <= 0;
            else if (stockFilter === 'IN_STOCK') matchesStock = item.quantity > 0;

            let matchesExpiry = true;
            if (expiryFilter !== 'ALL') {
                const days = getDaysUntilExpiry(item.expiryDate);
                if (days === null) matchesExpiry = false;
                else if (expiryFilter === 'EXPIRED') matchesExpiry = days < 0;
                else if (expiryFilter === 'SKT_30') matchesExpiry = days >= 0 && days <= 30;
                else if (expiryFilter === 'SKT_60') matchesExpiry = days >= 0 && days <= 60;
                else if (expiryFilter === 'SKT_90') matchesExpiry = days >= 0 && days <= 90;
            }
            
            return matchesSearch && matchesCategory && matchesStock && matchesExpiry;
        });
    }, [inventory, searchTerm, categoryFilter, stockFilter, expiryFilter]);

    const purchasedQuantityMap = useMemo(() => {
        const map = new Map<string, number>();
        supplierPurchases.filter(p => {
            if (p.deletedAt) return false;
            if (selectedYear < currentYear && p.date) {
                const year = new Date(p.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        }).forEach(purchase => {
            (purchase.items || []).forEach(item => {
                const qtyStr = String(item.quantity || '0').replace(',', '.');
                const qty = parseFloat(qtyStr) || 0;
                if (isNaN(qty) || qty === 0) return;

                const isSale = purchase.type === 'SALE' || purchase.note?.includes('SATIŞ');
                const isReturn = purchase.type === 'RETURN' || (purchase.note?.includes('İADE') && !isSale);
                const isReturnOrSale = isSale || isReturn || qty < 0;
                const effectiveQty = isReturnOrSale ? -Math.abs(qty) : Math.abs(qty);

                const current = map.get(item.pesticideId) || 0;
                map.set(item.pesticideId, Math.round((current + effectiveQty + Number.EPSILON) * 100) / 100);
            });
        });
        return map;
    }, [supplierPurchases, selectedYear, currentYear]);

    const getTotalIncomingQuantity = (item: InventoryItem, year: number) => {
        const supplierPurchased = purchasedQuantityMap.get(item.pesticideId) || 0;
        const positiveManualAdjustments = (item.adjustments || [])
            .filter(a => {
                const amt = Number(a.amount) || 0;
                if (amt <= 0) return false;
                if (year < currentYear && a.date) {
                    const adjYear = new Date(a.date).getFullYear();
                    if (!isNaN(adjYear) && adjYear !== year) return false;
                }
                return true;
            })
            .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
        return Math.round((supplierPurchased + positiveManualAdjustments + Number.EPSILON) * 100) / 100;
    };

    const getYearlyItemQuantity = (item: InventoryItem, year: number) => {
        if (year === currentYear) return Number(item.quantity) || 0;
        const purchased = purchasedQuantityMap.get(item.pesticideId) || 0;
        const sold = prescriptions.filter(p => !p.deletedAt && !(!p.isInventoryProcessed && p.isProcessed === false) && p.date && new Date(p.date).getFullYear() === year)
            .reduce((acc, p) => {
                const isReturn = p.type === 'RETURN';
                const qty = (p.items || [])
                    .filter(i => i.pesticideId === item.pesticideId)
                    .reduce((sum, found) => sum + (parseFloat(String(found.quantity || '0').replace(',', '.')) || 0), 0);
                return isReturn ? acc - qty : acc + qty;
            }, 0);
        const adj = (item.adjustments || [])
            .filter(a => a.date && new Date(a.date).getFullYear() === year)
            .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
        const yearNet = Math.round((purchased - sold + adj + Number.EPSILON) * 100) / 100;
        return (purchased > 0 || sold > 0 || adj !== 0) ? yearNet : (Number(item.quantity) || 0);
    };

    const filteredPesticides = useMemo(() => {
        if (!productName || selectedPesticide) return [];
        return pesticides.filter(p => 
            p.name.toLocaleLowerCase('tr-TR').includes(productName.toLocaleLowerCase('tr-TR')) || 
            (p.barcode && p.barcode.includes(productName))
        ).slice(0, 20);
    }, [pesticides, productName, selectedPesticide]);

    /** Fresh inventory straight from IndexedDB (never a stale React snapshot). */
    const readFreshInventory = async (): Promise<InventoryItem[]> => {
        try {
            const raw = await dbService.getAllInventoryRaw();
            if (Array.isArray(raw)) return (raw as InventoryItem[]).filter(i => i && !i.deletedAt);
        } catch (err) {
            console.warn('Fresh inventory read failed, using in-memory list:', err);
        }
        return inventory.filter(i => !i.deletedAt);
    };

    const readFreshItem = async (id: string): Promise<InventoryItem | null> => {
        const all = await readFreshInventory();
        return all.find(i => i.id === id) || null;
    };

    /**
     * B-24: products created from the warehouse are written WITHOUT a fake dose ('100ml/100L') and
     * preferably into the user's own library (when the db layer offers it). Write errors are surfaced.
     */
    const createWarehousePesticide = async (name: string, category: PesticideCategory, description: string, barcode?: string): Promise<Pesticide> => {
        const cleanName = name.trim().replace(/\s+/g, ' ');
        const dup = pesticides.find(p => !p.deletedAt && normName(p.name) === normName(cleanName));
        if (dup) return dup;
        const newPest: Pesticide = {
            id: crypto.randomUUID(),
            name: cleanName,
            activeIngredient: 'Belirtilmedi',
            defaultDosage: '',
            category,
            description,
            ...(barcode ? { barcode } : {})
        };
        const svc = dbService as any;
        if (typeof svc.addUserPesticide === 'function') await svc.addUserPesticide(newPest);
        else if (typeof svc.addCustomPesticide === 'function') await svc.addCustomPesticide(newPest);
        else await dbService.addGlobalPesticide(newPest);
        setPesticides(prev => [...prev, newPest]);
        return newPest;
    };

    const handleAddItem = async () => {
        if (!productName.trim()) {
            showToast('Lütfen ürün adı giriniz', 'error');
            return;
        }
        if (isSaving) return;
        
        setIsSaving(true);
        try {
            let finalPesticideId = '';
            let finalPesticideName = productName.trim();
            let finalCategory = formData.category;

            // B-04: the same 2D karekod (seri no) can never enter the warehouse twice.
            const freshInventory = await readFreshInventory();
            const enteredSerial = normSerial(formData.serialNumber);
            const requestedQty = toNum(formData.quantity);
            if (requestedQty < 0) {
                showToast('Giriş miktarı negatif olamaz. Stok düşmek için sayım/düzeltme kullanın.', 'error');
                return;
            }
            if (enteredSerial && requestedQty <= 0) {
                showToast('Seri numaralı (karekodlu) giriş için miktar en az 1 olmalı.', 'error');
                return;
            }
            if (enteredSerial) {
                const owner = collectRegisteredSerials(freshInventory).get(enteredSerial);
                if (owner) {
                    showToast(`Bu karekod zaten girilmiş: Seri ${enteredSerial} (${owner}). Giriş reddedildi.`, 'error');
                    playErrorBeep();
                    hapticFeedback('error');
                    return;
                }
            }

            const scanParsed = formData.barcode ? parseGS1Barcode(formData.barcode) : null;
            const existingPest = selectedPesticide
                || pesticides.find(p => !p.deletedAt && normName(p.name) === normName(finalPesticideName))
                || (scanParsed ? findItemByScan(pesticides, scanParsed) : undefined);
            
            if (existingPest) {
                finalPesticideId = existingPest.id;
                finalPesticideName = existingPest.name;
                finalCategory = existingPest.category;
            } else {
                try {
                    const created = await createWarehousePesticide(finalPesticideName, finalCategory, 'Depo eklemesi ile otomatik eklendi.', formData.barcode || undefined);
                    finalPesticideId = created.id;
                    finalPesticideName = created.name;
                } catch (pestErr) {
                    console.error('Pesticide create error:', pestErr);
                    showToast('Yeni ürün kütüphaneye kaydedilemedi. Depo girişi yapılmadı.', 'error');
                    hapticFeedback('error');
                    return;
                }
            }

            const _parseFloatSafe = (val: string | number) => {
                const parsed = parseFloat(String(val).replace(',', '.'));
                return isNaN(parsed) ? 0 : parsed;
            };

            const addQty = round2(_parseFloatSafe(formData.quantity));
            const buyingPrice = _parseFloatSafe(formData.buyingPrice);
            
            const stringValCB = String(formData.cashBuyingPrice).trim();
            const cashBuyingPrice = stringValCB !== '' ? _parseFloatSafe(stringValCB) : buyingPrice;
            
            const sellingPrice = _parseFloatSafe(formData.sellingPrice);
            
            const stringValCP = String(formData.cashPrice).trim();
            const cashPrice = stringValCP !== '' ? _parseFloatSafe(stringValCP) : sellingPrice;

            const stringValThreshold = String(formData.lowStockThreshold || '').trim();
            const parsedPackSize = _parseFloatSafe(formData.packSize || '');

            // B-05: store only the canonical product code (never the raw 2D GS1 string).
            const canonicalBarcode = scanParsed ? canonicalBarcodeFromParsed(scanParsed) : '';
            const canonicalGtin = (formData.gtin || '').trim() || scanParsed?.gtin || '';
            const stockInEntry = {
                lotNumber: formData.lotNumber,
                expiryDate: formData.expiryDate,
                quantity: addQty,
                serialNumber: enteredSerial || undefined
            };

            // Fresh DB copy (not the possibly stale React list) so concurrent changes are not overwritten.
            const inventoryExisting = freshInventory.find(i => i.pesticideId === finalPesticideId);
            
            if (inventoryExisting) {
                const newTotalQty = round2((Number(inventoryExisting.quantity) || 0) + addQty);
                const updatedItem: InventoryItem = {
                    ...inventoryExisting,
                    quantity: newTotalQty,
                    unit: formData.unit || inventoryExisting.unit,
                    buyingPrice: buyingPrice !== 0 ? buyingPrice : inventoryExisting.buyingPrice,
                    cashBuyingPrice: cashBuyingPrice !== 0 ? cashBuyingPrice : inventoryExisting.cashBuyingPrice,
                    sellingPrice: sellingPrice !== 0 ? sellingPrice : inventoryExisting.sellingPrice,
                    cashPrice: cashPrice !== 0 ? cashPrice : inventoryExisting.cashPrice,
                    barcode: canonicalBarcode || inventoryExisting.barcode,
                    gtin: canonicalGtin || inventoryExisting.gtin,
                    // B-03/B-04: new lot → new batch, same lot → quantity added; legacy fields = earliest-SKT summary.
                    ...mergeStockInBatch(inventoryExisting, stockInEntry),
                    packUnitName: formData.packUnitName || inventoryExisting.packUnitName,
                    packSize: parsedPackSize > 0 ? parsedPackSize : inventoryExisting.packSize,
                    lastUpdated: new Date().toISOString(),
                    lowStockThreshold: stringValThreshold !== '' ? _parseFloatSafe(stringValThreshold) : inventoryExisting.lowStockThreshold
                };

                if (addQty !== 0) {
                    updatedItem.adjustments = [
                        ...(updatedItem.adjustments || []),
                        {
                            date: new Date().toISOString(),
                            amount: addQty,
                            note: `Manuel Stok Girişi${formData.lotNumber ? ` (Lot ${formData.lotNumber.trim()})` : ''}`
                        }
                    ];
                }

                await updateInventoryItem(updatedItem);
                showToast('Ürün depoda mevcuttu. Var olan ürünün üzerine miktar başarıyla eklendi.', 'success');
                hapticFeedback('success');
                closeModal();
                return;
            }

            const baseNewItem: InventoryItem = {
                id: crypto.randomUUID(),
                pesticideId: finalPesticideId,
                pesticideName: finalPesticideName,
                category: finalCategory,
                quantity: addQty,
                unit: formData.unit,
                buyingPrice: buyingPrice,
                cashBuyingPrice: cashBuyingPrice,
                sellingPrice: sellingPrice,
                cashPrice: cashPrice,
                barcode: canonicalBarcode || undefined,
                gtin: canonicalGtin || undefined,
                lotNumber: formData.lotNumber || undefined,
                expiryDate: formData.expiryDate || undefined,
                serialNumber: enteredSerial || undefined,
                packUnitName: formData.packUnitName || undefined,
                packSize: parsedPackSize > 0 ? parsedPackSize : undefined,
                lastUpdated: new Date().toISOString(),
                lowStockThreshold: _parseFloatSafe(formData.lowStockThreshold)
            };
            const newItem: InventoryItem = {
                ...baseNewItem,
                ...mergeStockInBatch({ ...baseNewItem, lotNumber: undefined, expiryDate: undefined, serialNumber: undefined }, stockInEntry)
            };

            if (addQty !== 0) {
                newItem.adjustments = [{
                    date: new Date().toISOString(),
                    amount: addQty,
                    note: 'Manuel Stok Girişi'
                }];
            }
            await addInventoryItem(newItem);

            showToast('Ürün depoya eklendi', 'success');
            hapticFeedback('success');
            closeModal();
        } catch (error) {
            console.error("Add item error:", error);
            showToast('Ürün eklenirken bir hata oluştu', 'error');
            hapticFeedback('error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateItem = async () => {
        if (!selectedItem || isSaving) return;

        const _parseFloatSafe = (val: string | number) => toNum(val);

        // AK-31: re-read the record — the modal snapshot may be stale (sale / purchase / other device).
        const fresh = (await readFreshItem(selectedItem.id)) || selectedItem;
        const shownQty = round2(Number(selectedItem.quantity) || 0);
        const freshQty = round2(Number(fresh.quantity) || 0);
        const formQty = round2(_parseFloatSafe(formData.quantity));
        const userChangedQty = formQty !== shownQty;
        // Quantity untouched in the form → keep the live DB quantity (never overwrite concurrent movements).
        const newTotalQty = userChangedQty ? formQty : freshQty;
        const qtyDiff = round2(newTotalQty - freshQty);

        const enteredSerial = normSerial(formData.serialNumber);
        if (enteredSerial && enteredSerial !== normSerial(fresh.serialNumber)) {
            const owner = collectRegisteredSerials(await readFreshInventory(), fresh.id).get(enteredSerial);
            if (owner) {
                showToast(`Bu seri numarası başka bir üründe kayıtlı (${owner}).`, 'error');
                playErrorBeep();
                return;
            }
        }

        const performUpdate = async () => {
        setIsSaving(true);
        try {
            const buyingPrice = _parseFloatSafe(formData.buyingPrice);
            
            const stringValCB = String(formData.cashBuyingPrice).trim();
            const cashBuyingPrice = stringValCB !== '' ? _parseFloatSafe(stringValCB) : buyingPrice;
            
            const sellingPrice = _parseFloatSafe(formData.sellingPrice);
            
            const stringValCP = String(formData.cashPrice).trim();
            const cashPrice = stringValCP !== '' ? _parseFloatSafe(stringValCP) : sellingPrice;

            const stringValThreshold = String(formData.lowStockThreshold || '').trim();
            const parsedPackSize = _parseFloatSafe(formData.packSize || '');

            const scanParsed = formData.barcode ? parseGS1Barcode(formData.barcode) : null;
            const canonicalBarcode = scanParsed ? canonicalBarcodeFromParsed(scanParsed) : '';

            // Keep batches consistent with an edited lot / SKT: the batch shown as summary gets the new values.
            let batches = Array.isArray(fresh.batches) ? fresh.batches.map(b => ({ ...b })) : undefined;
            const newLot = (formData.lotNumber || '').trim();
            const newExp = formData.expiryDate || '';
            if (batches && batches.length > 0 && (newLot !== (selectedItem.lotNumber || '') || newExp !== (selectedItem.expiryDate || ''))) {
                const idx = batches.length === 1 ? 0 : batches.findIndex(b => normLot(b.lotNumber) === normLot(selectedItem.lotNumber) && (b.expiryDate || '') === (selectedItem.expiryDate || ''));
                if (idx >= 0) batches[idx] = { ...batches[idx], lotNumber: newLot, expiryDate: newExp || undefined };
            }

            const updatedItem: InventoryItem = {
                ...fresh,
                pesticideName: productName.trim() || fresh.pesticideName,
                category: formData.category || fresh.category,
                quantity: newTotalQty,
                unit: formData.unit,
                buyingPrice: buyingPrice,
                cashBuyingPrice: cashBuyingPrice,
                sellingPrice: sellingPrice,
                cashPrice: cashPrice,
                barcode: canonicalBarcode || undefined,
                gtin: (formData.gtin || '').trim() || scanParsed?.gtin || undefined,
                lotNumber: newLot || undefined,
                expiryDate: newExp || undefined,
                serialNumber: enteredSerial || undefined,
                ...(batches ? { batches } : {}),
                packUnitName: formData.packUnitName || undefined,
                packSize: parsedPackSize > 0 ? parsedPackSize : undefined,
                lastUpdated: new Date().toISOString(),
                lowStockThreshold: stringValThreshold !== '' ? _parseFloatSafe(stringValThreshold) : 0
            };

            // Log manual adjustment (rounded, relative to the fresh DB quantity)
            if (qtyDiff !== 0) {
                updatedItem.adjustments = [
                    ...(updatedItem.adjustments || []),
                    {
                        date: new Date().toISOString(),
                        amount: qtyDiff,
                        note: `Manuel Stok Düzeltmesi (${freshQty} → ${newTotalQty} ${updatedItem.unit})`
                    }
                ];
            }
            
            await updateInventoryItem(updatedItem);

            // Sync with global pesticides if possible
            const currentPest = pesticides.find(p => p.id === updatedItem.pesticideId);
            if (currentPest && (currentPest.name !== updatedItem.pesticideName || currentPest.category !== updatedItem.category || (currentPest.barcode || '') !== (updatedItem.barcode || ''))) {
                try {
                    await dbService.updateGlobalPesticide({
                        ...currentPest,
                        name: updatedItem.pesticideName,
                        category: updatedItem.category,
                        barcode: updatedItem.barcode
                    });
                    // Update local state
                    setPesticides(prev => prev.map(p => p.id === currentPest.id ? { ...p, name: updatedItem.pesticideName, category: updatedItem.category, barcode: updatedItem.barcode } : p));
                } catch (pestErr) {
                    console.error('Pesticide library sync error:', pestErr);
                    showToast('Depo güncellendi ancak ürün kütüphanesi senkronize edilemedi.', 'info');
                }
            }
            
            showToast('Ürün bilgileri güncellendi', 'success');
            hapticFeedback('success');
            closeModal();
        } catch (error) {
            console.error("Update item error:", error);
            showToast('Güncelleme sırasında bir hata oluştu', 'error');
            hapticFeedback('error');
        } finally {
            setIsSaving(false);
        }
        };

        if (qtyDiff !== 0) {
            const staleNote = freshQty !== shownQty ? ` Not: form açıkken stok ${shownQty} → ${freshQty} olarak değişti.` : '';
            setConfirmModal({
                isOpen: true,
                title: 'Manuel Stok Düzeltmesi',
                message: `Sistem ${freshQty} → Yeni ${newTotalQty} ${formData.unit || fresh.unit} (fark ${qtyDiff > 0 ? '+' : ''}${qtyDiff}). Fiziksel sayım için "Stok Sayımı" önerilir.${staleNote} Devam edilsin mi?`,
                onConfirm: () => { void performUpdate(); }
            });
            return;
        }
        await performUpdate();
    };

    const [auditCountInput, setAuditCountInput] = useState<string>('');
    const [auditNoteInput, setAuditNoteInput] = useState<string>('');

    const auditBusyRef = React.useRef(false);

    // AK-15: keep the open detail modal in sync with live inventory changes (sales, purchases, other devices).
    useEffect(() => {
        if (!selectedDetailItem) return;
        const live = inventory.find(i => i.id === selectedDetailItem.id);
        if (live && live !== selectedDetailItem && (live.lastUpdated !== selectedDetailItem.lastUpdated || live.quantity !== selectedDetailItem.quantity)) {
            setSelectedDetailItem(live);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inventory]);

    const handleAuditItem = async () => {
        if (!selectedDetailItem || isSaving || auditBusyRef.current) return;
        // AK-15: a count can only be approved for the current year (past years show derived quantities).
        if (selectedYear !== currentYear) {
            showToast(`Stok sayımı yalnız güncel yılda (${currentYear}) onaylanabilir.`, 'error');
            return;
        }

        const rawCount = auditCountInput.trim() !== ''
            ? parseFloat(auditCountInput.replace(',', '.'))
            : Number(selectedDetailItem.quantity);

        if (!Number.isFinite(rawCount) || rawCount < 0) {
            showToast('Lütfen geçerli bir sayım adedi giriniz.', 'error');
            return;
        }
        // AK-35: counted quantity is rounded exactly like the difference → quantity and adjustments stay consistent.
        const parsedCount = round2(rawCount);

        // AK-15: re-read the live record so concurrent sales / purchases / consignment logs are not overwritten.
        const fresh = (await readFreshItem(selectedDetailItem.id)) || selectedDetailItem;
        const prevQty = round2(Number(fresh.quantity) || 0);
        const diff = round2(parsedCount - prevQty);
        const unit = fresh.unit;

        const performAudit = async () => {
            if (auditBusyRef.current) return;
            auditBusyRef.current = true;
            setIsSaving(true);
            try {
                // Re-read once more right before writing (the confirm dialog may have stayed open).
                const latest = (await readFreshItem(selectedDetailItem.id)) || fresh;
                const latestQty = round2(Number(latest.quantity) || 0);
                const finalDiff = round2(parsedCount - latestQty);
                const nowIso = new Date().toISOString();
                const newAuditRecord = {
                    id: crypto.randomUUID(),
                    date: nowIso,
                    countedQuantity: parsedCount,
                    previousQuantity: latestQty,
                    unit: latest.unit,
                    approvedBy: activeTeamMember?.fullName || userProfile?.fullName || 'Sorumlu Mühendis',
                    note: auditNoteInput.trim() || undefined
                };

                const updatedAdjustments = finalDiff !== 0
                    ? [
                        ...(latest.adjustments || []),
                        {
                            date: nowIso,
                            amount: finalDiff,
                            note: `Onaylı Stok Sayımı (${parsedCount} ${latest.unit})`
                        }
                    ]
                    : (latest.adjustments || []);

                const updated: InventoryItem = {
                    ...latest,
                    quantity: parsedCount,
                    lastAuditDate: nowIso,
                    lastUpdated: nowIso,
                    adjustments: updatedAdjustments,
                    auditHistory: [newAuditRecord, ...(latest.auditHistory || [])]
                };

                await updateInventoryItem(updated);
                setSelectedDetailItem(updated);
                setAuditCountInput(String(parsedCount));
                setAuditNoteInput('');
                showToast(`Stok sayımı onaylandı (${parsedCount} ${latest.unit}).`, 'success');
                hapticFeedback('success');
            } catch (error) {
                console.error('Stock count error:', error);
                showToast('Stok sayımı kaydedilemedi', 'error');
                hapticFeedback('error');
            } finally {
                auditBusyRef.current = false;
                setIsSaving(false);
            }
        };

        const staleNote = prevQty !== round2(Number(selectedDetailItem.quantity) || 0)
            ? ` Not: ekran açıkken stok ${round2(Number(selectedDetailItem.quantity) || 0)} → ${prevQty} olarak değişti.`
            : '';
        setConfirmModal({
            isOpen: true,
            title: 'Stok Sayımını Onayla',
            message: `Sistem ${prevQty} → Sayılan ${parsedCount} ${unit} (fark ${diff > 0 ? '+' : ''}${diff}).${staleNote} Onaylandığında stok sayılan miktar olarak kaydedilir.`,
            onConfirm: () => { void performAudit(); }
        });
    };

    const handleDeleteItem = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Ürün Silinecek',
            message: 'Bu ürünü depodan silmek istediğinize emin misiniz? (Çöp kutusuna taşınacaktır)',
            onConfirm: async () => {
                try {
                    await softDeleteInventoryItem(id);
                    showToast('Ürün çöp kutusuna taşındı', 'success');
                    hapticFeedback('medium');
                } catch (error) {
                    console.error("Delete error:", error);
                    showToast("Ürün silinirken bir hata oluştu.", 'error');
                    hapticFeedback('error');
                }
            }
        });
    };

    const openAddModal = (presetProductName?: string) => {
        setFormData({ 
            quantity: '', 
            unit: 'Adet', 
            buyingPrice: '', 
            cashBuyingPrice: '', 
            sellingPrice: '', 
            cashPrice: '', 
            lowStockThreshold: '5', 
            barcode: '',
            category: PesticideCategory.OTHER,
            gtin: '',
            lotNumber: '',
            expiryDate: '',
            serialNumber: '',
            packUnitName: '',
            packSize: ''
        });
        setSelectedPesticide(null);
        setProductName(presetProductName || '');
        setSelectedSupplierId('');
        setIsAddModalOpen(true);
    };

    const openEditModal = (item: InventoryItem) => {
        setSelectedItem(item);
        setProductName(item.pesticideName);
        setSelectedSupplierId('');
        setFormData({
            quantity: item.quantity.toString(),
            unit: item.unit,
            buyingPrice: item.buyingPrice.toString(),
            cashBuyingPrice: (item.cashBuyingPrice || 0).toString(),
            sellingPrice: item.sellingPrice.toString(),
            cashPrice: (item.cashPrice || 0).toString(),
            lowStockThreshold: (item.lowStockThreshold || 0).toString(),
            barcode: item.barcode || '',
            category: item.category,
            gtin: item.gtin || '',
            lotNumber: item.lotNumber || '',
            expiryDate: item.expiryDate || '',
            serialNumber: item.serialNumber || '',
            packUnitName: item.packUnitName || '',
            packSize: item.packSize ? String(item.packSize) : ''
        });
        setIsEditModalOpen(true);
    };

    const openDetailModal = (item: InventoryItem) => {
        setSelectedDetailItem(item);
        setAuditCountInput(String(item.quantity ?? 0));
        setAuditNoteInput('');
        setConsignParty('');
        setConsignQty('');
        setConsignNote('');
        setQuarantineAddQty('');
        setQuarantineReasonInput('');
        setHistorySearchQuery('');
        setHistoryTypeFilter('ALL');
        setIsDetailModalOpen(true);
        hapticFeedback('light');
    };

    // #22 Emanet (Konsinye) Stok Ekle
    const handleAddConsignment = async () => {
        if (!selectedDetailItem) return;
        const qty = parseFloat(consignQty.replace(',', '.')) || 0;
        if (!consignParty.trim() || qty <= 0) {
            showToast('Lütfen karşı taraf adını ve geçerli miktarı girin.', 'error');
            return;
        }
        const nowIso = new Date().toISOString();
        const rec: import('../types').ConsignmentRecord = {
            id: crypto.randomUUID(),
            date: nowIso,
            partyName: consignParty.trim(),
            type: consignType,
            quantity: qty,
            note: consignNote.trim() || undefined
        };
        const currentConsign = Number(selectedDetailItem.consignmentQty) || 0;
        const nextConsign = consignType === 'GIVEN'
            ? currentConsign + qty
            : consignType === 'TAKEN'
            ? currentConsign + qty
            : Math.max(0, currentConsign - qty);

        // GIVEN decreases physical shelf stock, RETURNED restores physical shelf stock if it was GIVEN
        let nextShelfQty = Number(selectedDetailItem.quantity) || 0;
        let adjNote = '';
        let adjDelta = 0;
        if (consignType === 'GIVEN') {
            nextShelfQty -= qty;
            adjDelta = -qty;
            adjNote = `Emanet Verildi: ${consignParty.trim()}`;
        } else if (consignType === 'TAKEN') {
            nextShelfQty += qty;
            adjDelta = qty;
            adjNote = `Emanet Alındı: ${consignParty.trim()}`;
        } else {
            nextShelfQty += qty;
            adjDelta = qty;
            adjNote = `Emanet İadesi Alındı: ${consignParty.trim()}`;
        }

        const updated: InventoryItem = {
            ...selectedDetailItem,
            quantity: nextShelfQty,
            consignmentQty: nextConsign,
            consignmentLogs: [rec, ...(selectedDetailItem.consignmentLogs || [])],
            adjustments: adjDelta !== 0
                ? [...(selectedDetailItem.adjustments || []), { date: nowIso, amount: adjDelta, note: adjNote }]
                : selectedDetailItem.adjustments,
            lastUpdated: nowIso
        };
        setIsSaving(true);
        try {
            await updateInventoryItem(updated);
            setSelectedDetailItem(updated);
            setConsignParty('');
            setConsignQty('');
            setConsignNote('');
            showToast('Emanet hareketi kaydedildi.', 'success');
            hapticFeedback('success');
        } catch {
            showToast('Emanet kaydedilirken hata oluştu.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // #23 Karantina Stoğu Yönetimi
    const handleAddQuarantine = async () => {
        if (!selectedDetailItem) return;
        const qty = parseFloat(quarantineAddQty.replace(',', '.')) || 0;
        if (qty <= 0 || !quarantineReasonInput.trim()) {
            showToast('Karantina miktarı ve sebebi zorunludur.', 'error');
            return;
        }
        const nowIso = new Date().toISOString();
        const qRec: import('../types').QuarantineRecord = {
            id: crypto.randomUUID(),
            date: nowIso,
            lotNumber: selectedDetailItem.lotNumber,
            expiryDate: selectedDetailItem.expiryDate,
            quantity: qty,
            reason: quarantineReasonInput.trim(),
            resolved: false
        };
        const updated: InventoryItem = {
            ...selectedDetailItem,
            quantity: Math.max(0, (Number(selectedDetailItem.quantity) || 0) - qty),
            quarantineQty: (Number(selectedDetailItem.quarantineQty) || 0) + qty,
            quarantineLogs: [qRec, ...(selectedDetailItem.quarantineLogs || [])],
            adjustments: [
                ...(selectedDetailItem.adjustments || []),
                { date: nowIso, amount: -qty, note: `Karantinaya Ayrıldı (${quarantineReasonInput.trim()})` }
            ],
            lastUpdated: nowIso
        };
        setIsSaving(true);
        try {
            await updateInventoryItem(updated);
            setSelectedDetailItem(updated);
            setQuarantineAddQty('');
            setQuarantineReasonInput('');
            showToast('Ürün karantina stoğuna ayrıldı.', 'success');
            hapticFeedback('medium');
        } catch {
            showToast('Karantina kaydında hata oluştu.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResolveQuarantine = async (recId: string, action: 'RESTORE_TO_STOCK' | 'DISPOSE') => {
        if (!selectedDetailItem) return;
        const target = (selectedDetailItem.quarantineLogs || []).find(q => q.id === recId);
        if (!target || target.resolved) return;
        const nowIso = new Date().toISOString();
        const nextQLogs = (selectedDetailItem.quarantineLogs || []).map(q =>
            q.id === recId ? { ...q, resolved: true, resolvedAt: nowIso } : q
        );
        const nextQQty = Math.max(0, (Number(selectedDetailItem.quarantineQty) || 0) - target.quantity);
        const restore = action === 'RESTORE_TO_STOCK';
        const updated: InventoryItem = {
            ...selectedDetailItem,
            quantity: restore ? (Number(selectedDetailItem.quantity) || 0) + target.quantity : selectedDetailItem.quantity,
            quarantineQty: nextQQty,
            quarantineLogs: nextQLogs,
            adjustments: restore
                ? [...(selectedDetailItem.adjustments || []), { date: nowIso, amount: target.quantity, note: 'Karantinadan Sağlam Stoğa Aktarıldı' }]
                : selectedDetailItem.adjustments,
            lastUpdated: nowIso
        };
        setIsSaving(true);
        try {
            await updateInventoryItem(updated);
            setSelectedDetailItem(updated);
            showToast(restore ? 'Ürün sağlam stoğa geri aktarıldı.' : 'Karantina kaydı imha/iade olarak kapatıldı.', 'success');
        } catch {
            showToast('İşlem sırasında hata oluştu.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleQuickStockAdd = async () => {
        if (!selectedDetailItem || isSaving) return;
        const addQty = round2(parseFloat(quickStockQuantity.replace(',', '.')) || 0);
        if (addQty <= 0) {
            showToast('Lütfen geçerli bir miktar giriniz', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const fresh = (await readFreshItem(selectedDetailItem.id)) || selectedDetailItem;
            const updatedItem: InventoryItem = {
                ...fresh,
                quantity: round2((Number(fresh.quantity) || 0) + addQty),
                lastUpdated: new Date().toISOString(),
                adjustments: [
                    ...(fresh.adjustments || []),
                    {
                        date: new Date().toISOString(),
                        amount: addQty,
                        note: 'Hızlı Stok Girişi'
                    }
                ]
            };

            await updateInventoryItem(updatedItem);
            showToast('Stok başarıyla eklendi', 'success');
            hapticFeedback('success');
            setIsQuickStockModalOpen(false);
            setQuickStockQuantity('');
            setSelectedDetailItem(updatedItem);
        } catch (error) {
            showToast('Stok eklenirken hata oluştu', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateAdjustment = async () => {
        if (!selectedDetailItem || editingAdjustmentIdx === null) return;
        const newAmount = parseFloat(editingAdjustmentAmount.replace(',', '.')) || 0;
        
        setIsSaving(true);
        try {
            const adjustments = [...(selectedDetailItem.adjustments || [])];
            const oldAmount = adjustments[editingAdjustmentIdx].amount;
            
            adjustments[editingAdjustmentIdx] = {
                ...adjustments[editingAdjustmentIdx],
                amount: newAmount,
                date: new Date().toISOString()
            };

            const quantityDiff = newAmount - oldAmount;
            const updatedItem: InventoryItem = {
                ...selectedDetailItem,
                quantity: selectedDetailItem.quantity + quantityDiff,
                adjustments,
                lastUpdated: new Date().toISOString()
            };

            await updateInventoryItem(updatedItem);
            showToast('Hareket güncellendi', 'success');
            hapticFeedback('success');
            setIsEditAdjustmentModalOpen(false);
            setEditingAdjustmentIdx(null);
            setSelectedDetailItem(updatedItem);
        } catch (error) {
            showToast('Hata oluştu', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAdjustment = async () => {
        if (!selectedDetailItem || editingAdjustmentIdx === null) return;
        
        setIsSaving(true);
        try {
            const adjustments = [...(selectedDetailItem.adjustments || [])];
            const removedAmount = adjustments[editingAdjustmentIdx].amount;
            
            adjustments.splice(editingAdjustmentIdx, 1);

            const updatedItem: InventoryItem = {
                ...selectedDetailItem,
                quantity: selectedDetailItem.quantity - removedAmount,
                adjustments,
                lastUpdated: new Date().toISOString()
            };

            await updateInventoryItem(updatedItem);
            showToast('Hareket silindi', 'success');
            hapticFeedback('medium');
            setIsEditAdjustmentModalOpen(false);
            setEditingAdjustmentIdx(null);
            setSelectedDetailItem(updatedItem);
        } catch (error) {
            showToast('Silme sırasında hata oluştu', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const openPriceUpdateModal = () => {
        setPriceUpdateItems([...inventory]);
        setPriceUpdateSearch('');
        setIsPriceUpdateModalOpen(true);
        hapticFeedback('medium');
    };

    const handleBatchPriceUpdate = async () => {
        setIsSaving(true);
        try {
            // Find items that actually changed
            const itemsToUpdate = priceUpdateItems.filter(item => {
                const original = inventory.find(i => i.id === item.id);
                if (!original) return false;
                return original.buyingPrice !== item.buyingPrice || 
                       original.cashBuyingPrice !== item.cashBuyingPrice ||
                       original.sellingPrice !== item.sellingPrice ||
                       original.cashPrice !== item.cashPrice;
            });

            if (itemsToUpdate.length === 0) {
                showToast('Değişiklik yapılmadı', 'info');
                setIsPriceUpdateModalOpen(false);
                return;
            }

            if (itemsToUpdate.length > 0) {
                const preparedItems = itemsToUpdate.map(item => ({
                    ...item,
                    lastUpdated: new Date().toISOString()
                }));
                await bulkUpdateInventoryItems(preparedItems);
            }

            showToast(`${itemsToUpdate.length} ürün fiyatı güncellendi`, 'success');
            hapticFeedback('success');
            setIsPriceUpdateModalOpen(false);
        } catch (error) {
            console.error("Batch update error:", error);
            showToast('Güncelleme sırasında hata oluştu', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setIsEditModalOpen(false);
        setIsDetailModalOpen(false);
        setIsQuickStockModalOpen(false);
        setIsEditAdjustmentModalOpen(false);
        setShowProfitability(false);
        setIsListMenuOpen(false);
        setSelectedItem(null);
        setSelectedDetailItem(null);
        setSelectedSupplierId('');
        setHistorySearchQuery('');
        setHistoryTypeFilter('ALL');
        setLastFormScan(null);
    };

    // --- Hardware back button: close the topmost Inventory modal instead of leaving the screen ---
    const [isOcrInvoiceOpen, setIsOcrInvoiceOpen] = useState(false);
    useBackHandler(isAddModalOpen || isEditModalOpen, closeModal, 'inventory_form_modal', 55);
    useBackHandler(isDetailModalOpen, closeModal, 'inventory_detail_modal', 55);
    useBackHandler(isQuickStockModalOpen, () => setIsQuickStockModalOpen(false), 'inventory_quick_stock', 60);
    useBackHandler(isEditAdjustmentModalOpen, () => setIsEditAdjustmentModalOpen(false), 'inventory_edit_adjustment', 60);
    useBackHandler(isPriceUpdateModalOpen, () => setIsPriceUpdateModalOpen(false), 'inventory_price_update', 55);
    useBackHandler(isRebuildModalOpen, () => setIsRebuildModalOpen(false), 'inventory_rebuild', 55);
    useBackHandler(isSmartOrderModalOpen, () => setIsSmartOrderModalOpen(false), 'inventory_smart_order', 55);
    useBackHandler(isOcrInvoiceOpen, () => setIsOcrInvoiceOpen(false), 'inventory_ocr_invoice', 55);
    useBackHandler(isScanning, () => setIsScanning(false), 'inventory_scanner', 70);
    useBackHandler(confirmModal.isOpen, () => setConfirmModal(prev => ({ ...prev, isOpen: false })), 'inventory_confirm', 80);

    // --- USB / Wireless POS barcode gun: filter the stock list by the scanned barcode / GTIN ---
    useEffect(() => {
        const onPosScan = (e: Event) => {
            const raw = String((e as CustomEvent).detail?.rawBarcode || '').trim();
            if (!raw) return;
            sessionStorage.removeItem('mks_pending_pos_barcode');
            // B-29: GTIN-normalised matching (EAN-8 / UPC-A / EAN-13 / GTIN-14 + legacy raw 2D barcodes).
            const parsed = parseGS1Barcode(raw);
            const hit = findItemByScan(inventory, parsed);
            setActiveTab('LIST');
            if (hit) {
                // Hardware bursts already beep once (hardwareBarcodeScanner) — no second beep here.
                setSearchTerm(hit.barcode || hit.gtin || hit.pesticideName);
            } else {
                playErrorBeep();
                setSearchTerm(canonicalBarcodeFromParsed(parsed) || raw);
                showToast('Okutulan barkod depoda bulunamadı.', 'info');
            }
        };
        window.addEventListener('mks-pos-barcode-scanned', onPosScan);
        return () => window.removeEventListener('mks-pos-barcode-scanned', onPosScan);
    }, [inventory]);

    // --- AI purchase invoice OCR (POST /api/generate via generateAIContent) (#44) ---
    const [ocrRows, setOcrRows] = useState<import('./inventory/InventoryStockAdjustmentModals').OcrInvoiceRow[]>([]);
    const [ocrSupplierId, setOcrSupplierId] = useState<string>('');
    const [ocrInvoiceNo, setOcrInvoiceNo] = useState<string>('');
    const [isOcrBusy, setIsOcrBusy] = useState(false);

    const handleInvoicePhoto = async (file: File | undefined) => {
        if (!file) return;
        setIsOcrBusy(true);
        setOcrRows([]);
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(String(r.result));
                r.onerror = () => reject(r.error);
                r.readAsDataURL(file);
            });
            const prompt = 'Bu bir zirai ilaç/gübre/tohum TEDARİKÇİ ALIŞ FATURASI fotoğrafı. Fatura numarasını ve kalemlerini çıkar. Sadece geçerli JSON nesnesi döndür (markdown yok): {"invoiceNo":"varsa fatura no","supplierName":"varsa tedarikçi ünvanı","items":[{"name":"Ürün ticari adı","quantity":sayı,"unit":"Adet|Litre|Kg|Kutu|Çuval","buyingPrice":liste birim fiyatı sayı,"discountPct":iskonto yüzdesi sayı yoksa 0,"vatPct":KDV yüzdesi sayı yoksa 0,"lotNumber":"varsa lot/parti no yoksa boş","expiryDate":"varsa YYYY-MM-DD yoksa boş"}]}';
            const text = await generateAIContent(DEFAULT_GEMINI_MODEL, [{
                role: 'user',
                parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'image/jpeg', data: dataUrl.replace(/^data:[^;]+;base64,/, '') } }]
            }]);
            let rawItems: any[] = [];
            const objStart = text.indexOf('{');
            const arrStart = text.indexOf('[');
            if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
                const parsedObj = JSON.parse(text.slice(objStart, text.lastIndexOf('}') + 1));
                rawItems = Array.isArray(parsedObj?.items) ? parsedObj.items : [];
                if (parsedObj?.invoiceNo) setOcrInvoiceNo(String(parsedObj.invoiceNo).trim());
                if (parsedObj?.supplierName && !ocrSupplierId) {
                    const sLower = String(parsedObj.supplierName).toLocaleLowerCase('tr-TR');
                    const matchedSup = suppliers.find(s => !s.deletedAt && (s.name.toLocaleLowerCase('tr-TR').includes(sLower) || sLower.includes(s.name.toLocaleLowerCase('tr-TR'))));
                    if (matchedSup) setOcrSupplierId(matchedSup.id);
                }
            } else if (arrStart !== -1) {
                const parsedArr = JSON.parse(text.slice(arrStart, text.lastIndexOf(']') + 1));
                rawItems = Array.isArray(parsedArr) ? parsedArr : [];
            }
            const rows = rawItems
                .filter((r: any) => r && String(r.name || '').trim())
                .map((r: any) => ({
                    name: String(r.name).trim(),
                    quantity: String(Number(r.quantity) || 1),
                    unit: String(r.unit || 'Adet'),
                    buyingPrice: String(Number(r.buyingPrice) || 0),
                    discountPct: String(Number(r.discountPct) || 0),
                    vatPct: String(Number(r.vatPct) || 0),
                    lotNumber: r.lotNumber ? String(r.lotNumber).trim() : '',
                    expiryDate: r.expiryDate && /^\d{4}-\d{2}-\d{2}$/.test(String(r.expiryDate)) ? String(r.expiryDate) : ''
                }));
            if (rows.length === 0) showToast('Faturada ürün kalemi bulunamadı', 'error');
            setOcrRows(rows);
        } catch (err) {
            console.error('Invoice OCR error:', err);
            showToast('Fatura okunamadı, daha net bir fotoğraf deneyin', 'error');
        } finally {
            setIsOcrBusy(false);
        }
    };

    const ocrBusyRef = React.useRef(false);

    const addOcrRowsToInventory = async () => {
        if (ocrRows.length === 0 || isSaving || ocrBusyRef.current) return;
        type OcrRow = import('./inventory/InventoryStockAdjustmentModals').OcrInvoiceRow;
        const num = (v?: string) => { const n = parseFloat(String(v || '0').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
        const calcNetUnit = (r: OcrRow) => {
            const gross = num(r.buyingPrice);
            const disc = Math.min(100, Math.max(0, num(r.discountPct)));
            const vat = Math.max(0, num(r.vatPct));
            return round2(gross * (1 - disc / 100) * (1 + vat / 100));
        };

        // AK-18 (4): every row needs a name and a positive, finite quantity.
        const badRows = ocrRows.filter(r => !String(r.name || '').trim() || !(num(r.quantity) > 0));
        if (badRows.length > 0) {
            showToast(`${badRows.length} satırda ürün adı veya miktar geçersiz (0 / negatif). Lütfen düzeltin ya da satırı silin.`, 'error');
            return;
        }

        // AK-18 (2): the same invoice must not be imported twice (same supplier + receipt no).
        const invoiceNo = ocrInvoiceNo.trim();
        if (invoiceNo) {
            const key = invoiceNo.toLocaleUpperCase('tr-TR');
            const duplicate = ocrSupplierId
                ? supplierPurchases.some(p => !p.deletedAt && p.supplierId === ocrSupplierId && String(p.receiptNo || '').trim().toLocaleUpperCase('tr-TR') === key)
                : inventory.some(i => !i.deletedAt && (i.adjustments || []).some(a => String(a.note || '').includes(`(#${invoiceNo})`)));
            if (duplicate) {
                showToast(`Bu fatura (No: ${invoiceNo}) daha önce işlenmiş. Mükerrer giriş engellendi.`, 'error');
                playErrorBeep();
                return;
            }
        }

        // AK-18 (3): merge rows of the same product + lot + SKT so one row never overwrites another.
        type Group = { name: string; unit: string; qty: number; amount: number; lotNumber: string; expiryDate: string; rowIdx: number[] };
        const groups: Group[] = [];
        ocrRows.forEach((row, idx) => {
            const qty = round2(num(row.quantity));
            const net = calcNetUnit(row);
            const lot = String(row.lotNumber || '').trim();
            const exp = row.expiryDate || '';
            const g = groups.find(x => normName(x.name) === normName(row.name) && normLot(x.lotNumber) === normLot(lot) && x.expiryDate === exp);
            if (g) {
                g.qty = round2(g.qty + qty);
                g.amount = round2(g.amount + qty * net);
                g.rowIdx.push(idx);
            } else {
                groups.push({ name: row.name.trim(), unit: row.unit || 'Adet', qty, amount: round2(qty * net), lotNumber: lot, expiryDate: exp, rowIdx: [idx] });
            }
        });

        ocrBusyRef.current = true;
        setIsSaving(true);
        const processedRows = new Set<number>();
        let stockTouched = false;
        try {
            const purchaseItems: SupplierPurchaseItemDraft[] = [];
            // Working copies: fresh DB state + every write of this import (never the stale React list).
            const working = new Map<string, InventoryItem>();
            (await readFreshInventory()).forEach(i => { if (!working.has(i.pesticideId)) working.set(i.pesticideId, i); });
            const pestCache = new Map<string, Pesticide>();
            pesticides.forEach(p => { if (!p.deletedAt) pestCache.set(normName(p.name), p); });

            for (const g of groups) {
                const qty = g.qty;
                const netPrice = qty > 0 ? round2(g.amount / qty) : 0;
                let pest = pestCache.get(normName(g.name));
                if (!pest) {
                    pest = await createWarehousePesticide(g.name, PesticideCategory.OTHER, 'AI alış faturası ile otomatik eklendi.');
                    pestCache.set(normName(pest.name), pest);
                }
                const pestId = pest.id;
                const existing = working.get(pestId);

                if (ocrSupplierId) {
                    // When supplier is selected, addSupplierPurchase will add the quantities via updateInventoryFromPurchase
                    // (which also merges the Lot/SKT batch from the purchase line). Here we only ensure the InventoryItem exists.
                    if (!existing) {
                        const created: InventoryItem = {
                            id: crypto.randomUUID(),
                            pesticideId: pestId,
                            pesticideName: pest.name,
                            category: pest.category,
                            quantity: 0,
                            unit: g.unit,
                            buyingPrice: netPrice,
                            cashBuyingPrice: netPrice,
                            sellingPrice: round2(netPrice * 1.25),
                            cashPrice: round2(netPrice * 1.2),
                            lastUpdated: new Date().toISOString()
                        };
                        await addInventoryItem(created);
                        working.set(pestId, created);
                    }
                    purchaseItems.push({
                        pesticideId: pestId,
                        pesticideName: pest.name,
                        quantity: qty,
                        unit: g.unit,
                        buyingPrice: netPrice,
                        sellingPrice: existing?.sellingPrice || round2(netPrice * 1.25),
                        lotNumber: g.lotNumber || undefined,
                        expiryDate: g.expiryDate || undefined
                    });
                } else {
                    const adjustment = {
                        date: new Date().toISOString(),
                        amount: qty,
                        note: `AI Alış Faturası Girişi${invoiceNo ? ` (#${invoiceNo})` : ''}`
                    };
                    const stockEntry = { lotNumber: g.lotNumber, expiryDate: g.expiryDate, quantity: qty };
                    if (existing) {
                        const updated: InventoryItem = {
                            ...existing,
                            quantity: round2((Number(existing.quantity) || 0) + qty),
                            buyingPrice: netPrice || existing.buyingPrice,
                            ...mergeStockInBatch(existing, stockEntry),
                            lastUpdated: new Date().toISOString(),
                            adjustments: [...(existing.adjustments || []), adjustment]
                        };
                        await updateInventoryItem(updated);
                        working.set(pestId, updated);
                    } else {
                        const base: InventoryItem = {
                            id: crypto.randomUUID(),
                            pesticideId: pestId,
                            pesticideName: pest.name,
                            category: pest.category,
                            quantity: qty,
                            unit: g.unit,
                            buyingPrice: netPrice,
                            cashBuyingPrice: netPrice,
                            sellingPrice: round2(netPrice * 1.25),
                            cashPrice: round2(netPrice * 1.2),
                            lastUpdated: new Date().toISOString(),
                            adjustments: [adjustment]
                        };
                        const created: InventoryItem = { ...base, ...mergeStockInBatch(base, stockEntry) };
                        await addInventoryItem(created);
                        working.set(pestId, created);
                    }
                    stockTouched = true;
                    g.rowIdx.forEach(i => processedRows.add(i));
                }
            }

            if (ocrSupplierId && purchaseItems.length > 0) {
                const totalAmount = round2(purchaseItems.reduce((s, it) => s + it.quantity * it.buyingPrice, 0));
                await addSupplierPurchase({
                    supplierId: ocrSupplierId,
                    date: new Date().toISOString(),
                    type: 'PURCHASE',
                    receiptNo: invoiceNo || undefined,
                    items: purchaseItems,
                    totalAmount,
                    note: `AI Alış Faturası Tarama${invoiceNo ? ` (Fatura No: ${invoiceNo})` : ''}`
                });
                stockTouched = true;
                ocrRows.forEach((_, i) => processedRows.add(i));
            }

            showToast(
                ocrSupplierId
                    ? `${groups.length} ürün depoya ve tedarikçi carisine işlendi.`
                    : `${groups.length} ürün depoya işlendi. Satış fiyatlarını kontrol edebilirsiniz.`,
                'success'
            );
            hapticFeedback('success');
            setOcrRows([]);
            setOcrInvoiceNo('');
            setIsOcrInvoiceOpen(false);
        } catch (err) {
            console.error('Invoice OCR add error:', err);
            // AK-18 (1): drop the rows that were already written so a retry never adds them twice.
            if (processedRows.size > 0) setOcrRows(prev => prev.filter((_, i) => !processedRows.has(i)));
            showToast(
                processedRows.size > 0
                    ? `İşlem yarıda kaldı: ${processedRows.size} satır işlendi ve listeden çıkarıldı; kalanları tekrar deneyin.`
                    : 'İşlem sırasında hata oluştu, hiçbir stok/cari kaydı yapılmadı.',
                'error'
            );
            hapticFeedback('error');
        } finally {
            if (stockTouched) refreshInventory().catch(() => undefined);
            ocrBusyRef.current = false;
            setIsSaving(false);
        }
    };

    // Helper for Turkish characters (jsPDF default fonts don't support them well without custom fonts)
    const tr = (text: string | undefined | null) => {
        if (!text) return '';
        return String(text)
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u').replace(/Ü/g, 'U')
            .replace(/ş/g, 's').replace(/Ş/g, 'S')
            .replace(/ı/g, 'i').replace(/İ/g, 'I')
            .replace(/ö/g, 'o').replace(/Ö/g, 'O')
            .replace(/ç/g, 'c').replace(/Ç/g, 'C');
    };

    const generateInventoryPDF = async (type: 'CUSTOMER' | 'INTERNAL' | 'FULL') => {
        setIsListMenuOpen(false);
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const engineerName = userProfile.fullName || 'Ziraat Mühendisi';
        
        try {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '800px';
            container.style.backgroundColor = '#ffffff';
            container.style.padding = '40px';
            container.style.color = '#1c1917';
            container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

            const sortedInventory = [...filteredInventory].sort((a, b) => a.category.localeCompare(b.category));
            
            let title = '';
            let columns = '';
            
            if (type === 'CUSTOMER') {
                title = 'MÜŞTERİ FİYAT LİSTESİ';
                columns = `
                    <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-left-radius: 6px;">Ürün Adı</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669;">Kategori</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669;">Birim</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-right-radius: 6px; text-align: right;">Satış Fiyatı</th>
                `;
            } else if (type === 'INTERNAL') {
                title = 'İÇ STOK VE MALİYET LİSTESİ';
                columns = `
                    <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-left-radius: 6px;">Ürün Adı</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669;">Kategori</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; text-align: center;">Stok</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669;">Birim</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; text-align: right;">Alış Fiyatı (Vadeli)</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-right-radius: 6px; text-align: right;">Alış Fiyatı (Peşin)</th>
                `;
            } else {
                title = 'TAM STOK VE FİNANSAL RAPOR';
                columns = `
                    <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-left-radius: 6px;">Ürün Adı</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669;">Kategori</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; text-align: center;">Stok</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; text-align: right;">Alış (V/P)</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; text-align: right;">Satış (V/P)</th>
                    <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-right-radius: 6px; text-align: right;">Toplam Maliyet (V/P)</th>
                `;
            }

            let htmlContent = `
                <div style="margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
                        <div>
                            <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 5px 0; color: #1c1917; text-transform: uppercase;">MÜHENDİS KAYIT SİSTEMİ</h1>
                            <h2 style="font-size: 16px; font-weight: 600; margin: 0; color: #10b981;">Dijital Tarım ve Stok Yönetim Sistemi</h2>
                        </div>
                        <div style="text-align: right; color: #57534e; font-size: 12px;">
                            <div style="font-weight: bold; margin-bottom: 3px;">Rapor No: #INV-${Math.floor(Math.random() * 10000)}</div>
                            <div style="margin-bottom: 3px;">Tarih: ${dateStr} ${timeStr}</div>
                            <div>Sorumlu: ${engineerName}</div>
                        </div>
                    </div>

                    <h3 style="font-size: 20px; font-weight: 800; color: #292524; margin: 0 0 15px 0;">${title}</h3>
                    
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                        <thead>
                            <tr style="background-color: #10b981; color: white;">
                                ${columns}
                            </tr>
                        </thead>
                        <tbody>
            `;

            sortedInventory.forEach((item, i) => {
                const bg = i % 2 === 0 ? '#fafaf9' : '#ffffff';
                htmlContent += `<tr style="background-color: ${bg}; border-bottom: 1px solid #e7e5e4;">`;
                
                if (type === 'CUSTOMER') {
                    htmlContent += `
                        <td style="padding: 10px; font-weight: 600;">${item.pesticideName}</td>
                        <td style="padding: 10px;">${item.category}</td>
                        <td style="padding: 10px;">${item.unit}</td>
                        <td style="padding: 10px; text-align: right; font-family: monospace; font-weight: bold; font-size: 13px;">${formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')}</td>
                    `;
                } else if (type === 'INTERNAL') {
                    htmlContent += `
                        <td style="padding: 10px; font-weight: 600;">${item.pesticideName}</td>
                        <td style="padding: 10px;">${item.category}</td>
                        <td style="padding: 10px; text-align: center;"><span style="background-color: #fef3c7; color: #78350f; border: 1px solid #fde68a; font-family: monospace; font-weight: 800; padding: 2px 7px; border-radius: 4px; font-size: 11px; display: inline-block;">${item.quantity}</span></td>
                        <td style="padding: 10px;">${item.unit}</td>
                        <td style="padding: 10px; text-align: right; font-family: monospace; color: #ef4444;">${formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY')}</td>
                        <td style="padding: 10px; text-align: right; font-family: monospace; color: #10b981;">${formatCurrency(item.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}</td>
                    `;
                } else {
                    htmlContent += `
                        <td style="padding: 10px; font-weight: 600;">${item.pesticideName}</td>
                        <td style="padding: 10px;">${item.category}</td>
                        <td style="padding: 10px; text-align: center;"><span style="background-color: #fef3c7; color: #78350f; border: 1px solid #fde68a; font-family: monospace; font-weight: 800; padding: 2px 7px; border-radius: 4px; font-size: 11px; display: inline-block;">${item.quantity} ${item.unit}</span></td>
                        <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 10px;">
                            <span style="color:#ef4444">${formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY')}</span> / 
                            <span style="color:#10b981">${formatCurrency(item.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}</span>
                        </td>
                        <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 10px;">
                            <span>${formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')}</span> / 
                            <span>${formatCurrency(item.cashPrice || 0, userProfile?.currency || 'TRY')}</span>
                        </td>
                        <td style="padding: 10px; text-align: right; font-family: monospace; font-size: 10px;">
                            <span style="color:#ef4444">${formatCurrency(item.quantity * item.buyingPrice, userProfile?.currency || 'TRY')}</span> / 
                            <span style="color:#10b981">${formatCurrency(item.quantity * (item.cashBuyingPrice || 0), userProfile?.currency || 'TRY')}</span>
                        </td>
                    `;
                }
                htmlContent += `</tr>`;
            });
            
            htmlContent += `</tbody></table></div>`;

            if (type !== 'CUSTOMER') {
                const totalCost = sortedInventory.reduce((acc, i) => acc + (i.quantity * i.buyingPrice), 0);
                const totalCashCost = sortedInventory.reduce((acc, i) => acc + (i.quantity * (i.cashBuyingPrice || 0)), 0);
                const totalRevenue = sortedInventory.reduce((acc, i) => acc + (i.quantity * i.sellingPrice), 0);
                const totalCashRevenue = sortedInventory.reduce((acc, i) => acc + (i.quantity * (i.cashPrice || 0)), 0);

                htmlContent += `
                    <div style="background-color: #f8faf9; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px; width: 400px; margin-left: auto; page-break-inside: avoid;">
                        <h4 style="font-size: 14px; font-weight: 800; color: #1c1917; margin: 0 0 10px 0; text-transform: uppercase;">FİNANSAL ÖZET</h4>
                        <table style="width: 100%; font-size: 11px;">
                            <tr>
                                <td style="padding: 5px 0; color: #57534e;">Toplam Stok Maliyeti (Vadeli / Peşin):</td>
                                <td style="text-align: right; font-weight: bold; font-family: monospace;">${formatCurrency(totalCost, userProfile?.currency || 'TRY')} / ${formatCurrency(totalCashCost, userProfile?.currency || 'TRY')}</td>
                            </tr>
                `;
                
                if (type === 'FULL') {
                    htmlContent += `
                            <tr>
                                <td style="padding: 5px 0; color: #57534e;">Toplam Potansiyel Ciro (Vadeli / Peşin):</td>
                                <td style="text-align: right; font-weight: bold; font-family: monospace;">${formatCurrency(totalRevenue, userProfile?.currency || 'TRY')} / ${formatCurrency(totalCashRevenue, userProfile?.currency || 'TRY')}</td>
                            </tr>
                            <tr><td colspan="2"><hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 5px 0;"></td></tr>
                            <tr>
                                <td style="padding: 5px 0; color: #10b981; font-weight: 700; font-size: 12px;">Tahmini Net Kar (Vadeli / Peşin):</td>
                                <td style="text-align: right; font-weight: 700; font-family: monospace; font-size: 12px; color: #10b981;">
                                    ${formatCurrency(totalRevenue - totalCost, userProfile?.currency || 'TRY')} / ${formatCurrency(totalCashRevenue - totalCashCost, userProfile?.currency || 'TRY')}
                                </td>
                            </tr>
                    `;
                }
                htmlContent += `</table></div>`;
            }

            container.innerHTML = htmlContent;
            document.body.appendChild(container);

            const canvas = await renderElementToCanvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(container);
            
            const pdf = await createMultiPagePdf(canvas);
            pdf.save(`MKS_Depo_Raporu_${type}_${dateStr.replace(/\./g, '_')}.pdf`);
            
            showToast('Kurumsal PDF Raporu oluşturuldu', 'success');
        } catch (error) {
            console.error(error);
            showToast('PDF oluşturulurken hata!', 'error');
        }
    };

    const generateItemReport = async (item: InventoryItem) => {
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        const history: { id: string; targetId: string; name: string; date: string; price: number; quantity: string; isReturn: boolean; type: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' }[] = [];

        // Purchase history for this item
        supplierPurchases.filter(p => !p.deletedAt).forEach(p => {
            const purchaseItem = p.items.find(i => i.pesticideId === item.pesticideId);
            if (purchaseItem) {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                const supplierName = supplier ? supplier.name : 'Bilinmeyen Tedarikçi';
                const qtyStr = String(purchaseItem.quantity || '0').replace(',', '.');
                const parsedQty = parseFloat(qtyStr) || 0;
                
                const isSale = p.type === 'SALE' || p.note?.includes('SATIŞ');
                const isReturn = p.type === 'RETURN' || (p.note?.includes('İADE') && !isSale);
                const effectiveQty = Math.abs(parsedQty);

                history.push({
                    id: p.id,
                    targetId: p.supplierId,
                    name: supplierName,
                    date: p.date,
                    price: purchaseItem.buyingPrice || 0,
                    quantity: effectiveQty.toString(),
                    isReturn: Boolean(isReturn),
                    type: isSale ? 'SALE' : 'PURCHASE'
                });
            }
        });

        // Sales history for this item
        prescriptions.filter(p => !p.deletedAt).forEach(p => {
            const saleItem = p.items.find(i => i.pesticideId === item.pesticideId);
            if (saleItem) {
                const qty = parseFloat(saleItem.quantity?.toString().replace(',', '.') || '0') || 0;
                const isReturn = p.type === 'RETURN';
                const qtyMultiplier = isReturn ? 1 : -1;
                const impact = qty * qtyMultiplier;
                history.push({
                    id: p.id,
                    targetId: p.farmerId,
                    name: farmerMap[p.farmerId] || `Bilinmeyen ${farmerLabel}`,
                    date: p.date,
                    price: saleItem.unitPrice || 0,
                    quantity: Math.abs(qty).toString(),
                    isReturn: impact > 0,
                    type: 'SALE'
                });
            }
        });

        // Adjustments history
        const adjustmentsHistory = (item?.adjustments || []).map((adj, idx) => ({
            id: `adj-${idx}`,
            index: idx,
            targetId: 'manual',
            name: adj.note || 'Manuel Stok Düzeltme',
            date: adj.date,
            price: 0,
            quantity: Math.abs(adj.amount).toString(),
            isReturn: adj.amount < 0,
            type: 'ADJUSTMENT' as const
        }));

        const localHistory = [...history, ...adjustmentsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        let totalPurchasesQty = 0;
        let totalSalesQty = 0;

        localHistory.forEach(h => {
             const qty = parseFloat(h.quantity) || 0;
             if (h.type === 'PURCHASE') {
                 if (h.isReturn) {
                     totalPurchasesQty -= qty;
                 } else {
                     totalPurchasesQty += qty;
                 }
             } else if (h.type === 'SALE') {
                 if (h.isReturn) {
                     totalSalesQty -= qty; // Return from customer = less net sales
                 } else {
                     totalSalesQty += qty;
                 }
             }
        });
        
        try {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '800px';
            container.style.backgroundColor = '#ffffff';
            container.style.padding = '40px';
            container.style.color = '#1c1917';
            container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

            let htmlContent = `
                <div style="margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
                        <div>
                            <h1 style="font-size: 28px; font-weight: 900; margin: 0 0 5px 0; color: #1c1917; text-transform: uppercase;">MÜHENDİS KAYIT SİSTEMİ</h1>
                            <h2 style="font-size: 16px; font-weight: 600; margin: 0; color: #10b981;">Ürün Detay Raporu</h2>
                        </div>
                        <div style="text-align: right; color: #57534e; font-size: 12px;">
                            <div style="margin-bottom: 3px;">Tarih: ${dateStr} ${timeStr}</div>
                            <div>Sorumlu: ${userProfile.fullName || 'Ziraat Mühendisi'}</div>
                        </div>
                    </div>

                    <div style="background-color: #f8faf9; border: 1px solid #d1d5db; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between;">
                        <div>
                            <h3 style="font-size: 20px; font-weight: 800; color: #10b981; margin: 0 0 10px 0;">${item.pesticideName}</h3>
                            <div style="color: #57534e; font-size: 12px; margin-bottom: 5px;">Kategori: <span style="font-weight: 600; color: #1c1917;">${item.category}</span></div>
                            <div style="color: #57534e; font-size: 12px; margin-bottom: 5px;">Mevcut Stok: <span style="font-weight: 800; color: #1c1917; font-size: 14px;">${Number(item.quantity).toString()} ${item.unit}</span></div>
                            <div style="color: #57534e; font-size: 12px; margin-bottom: 5px;">Toplam Alınan: <span style="font-weight: 700; color: #10b981;">${totalPurchasesQty} ${item.unit}</span></div>
                            <div style="color: #57534e; font-size: 12px;">Toplam Satılan: <span style="font-weight: 700; color: #3b82f6;">${totalSalesQty} ${item.unit}</span></div>
                        </div>
                        <div style="display: flex; gap: 30px;">
                            <div>
                                <div style="color: #57534e; font-size: 11px; margin-bottom: 5px;">Vadeli Alış: <span style="font-family: monospace; font-weight: bold; color: #ef4444;">${formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY')}</span></div>
                                <div style="color: #57534e; font-size: 11px;">Peşin Alış: <span style="font-family: monospace; font-weight: bold; color: #10b981;">${formatCurrency(item.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}</span></div>
                            </div>
                            <div>
                                <div style="color: #57534e; font-size: 11px; margin-bottom: 5px;">Vadeli Satış: <span style="font-family: monospace; font-weight: bold; color: #ef4444;">${formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')}</span></div>
                                <div style="color: #57534e; font-size: 11px;">Peşin Satış: <span style="font-family: monospace; font-weight: bold; color: #10b981;">${formatCurrency(item.cashPrice || 0, userProfile?.currency || 'TRY')}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <h4 style="font-size: 16px; font-weight: 800; color: #1c1917; margin: 0 0 10px 0;">İŞLEM GEÇMİŞİ</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                    <thead>
                        <tr style="background-color: #10b981; color: white;">
                            <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-left-radius: 6px;">Tarih</th>
                            <th style="padding: 10px; border-bottom: 2px solid #059669;">İşlem Tipi</th>
                            <th style="padding: 10px; border-bottom: 2px solid #059669;">Kişi / Kurum</th>
                            <th style="padding: 10px; border-bottom: 2px solid #059669; text-align: right;">Miktar</th>
                            <th style="padding: 10px; border-bottom: 2px solid #059669; text-align: right;">Birim Fiyat</th>
                            <th style="padding: 10px; border-bottom: 2px solid #059669; border-top-right-radius: 6px; text-align: right;">Toplam</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            if (localHistory.length === 0) {
                htmlContent += `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #78716c;">Bu ürün için henüz işlem geçmişi bulunmamaktadır.</td></tr>`;
            } else {
                localHistory.forEach((h, i) => {
                    const bg = i % 2 === 0 ? '#fafaf9' : '#ffffff';
                    const isReturn = h.isReturn;
                    
                    let typeStr = '';
                    let typeColor = '';
                    
                    if (h.type === 'ADJUSTMENT') {
                        typeStr = 'Manuel Düzeltme';
                        typeColor = isReturn ? '#d97706' : '#d97706'; // Amber-600
                    } else if (h.type === 'SALE') {
                        typeStr = isReturn ? 'Satış İadesi' : 'Satış';
                        typeColor = isReturn ? '#dc2626' : '#10b981'; // Red / Emerald
                    } else {
                        typeStr = isReturn ? 'Alış İadesi' : 'Alış';
                        typeColor = isReturn ? '#10b981' : '#dc2626'; // Emerald / Red
                    }

                    const total = Number(h.quantity) * h.price;

                    htmlContent += `
                        <tr style="background-color: ${bg}; border-bottom: 1px solid #e7e5e4;">
                            <td style="padding: 10px;">${new Date(h.date).toLocaleDateString('tr-TR')}</td>
                            <td style="padding: 10px; font-weight: bold; color: ${typeColor};">${typeStr}</td>
                            <td style="padding: 10px; font-weight: 600;">${h.name}</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">${isReturn ? '-' : (h.type === 'ADJUSTMENT' && !isReturn ? '+' : '')}${Number(h.quantity)} ${item.unit}</td>
                            <td style="padding: 10px; text-align: right; font-family: monospace;">${h.type === 'ADJUSTMENT' ? '-' : formatCurrency(h.price, userProfile?.currency || 'TRY')}</td>
                            <td style="padding: 10px; text-align: right; font-family: monospace; font-weight: bold;">${h.type === 'ADJUSTMENT' ? '-' : formatCurrency(total, userProfile?.currency || 'TRY')}</td>
                        </tr>
                    `;
                });
            }

            htmlContent += `</tbody></table>`;

            container.innerHTML = htmlContent;
            document.body.appendChild(container);

            const canvas = await renderElementToCanvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(container);
            
            const pdf = await createMultiPagePdf(canvas);
            pdf.save(`MKS_Urun_Raporu_${item.pesticideName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr.replace(/\./g, '_')}.pdf`);
            
            showToast('Ürün detay raporu oluşturuldu', 'success');
        } catch (error) {
            console.error(error);
            showToast('PDF oluşturulurken hata!', 'error');
        }
    };

    // Sales History for Detail View
    const farmerMap = useMemo(() => {
        return farmers.reduce((acc, f) => {
            acc[f.id] = f.fullName;
            return acc;
        }, {} as Record<string, string>);
    }, [farmers]);

    const salesHistory = useMemo(() => {
        if (!selectedDetailItem) return [];
        
        const history: { id: string; targetId: string; name: string; date: string; price: number; quantity: string; isReturn: boolean; type: 'SALE' | 'PURCHASE' }[] = [];
        
        prescriptions.filter(p => {
            if (p.deletedAt) return false;
            if (!p.isInventoryProcessed && p.isProcessed === false) return false;
            if (selectedYear < currentYear && p.date) {
                const year = new Date(p.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        }).forEach((p, pIdx) => {
            (p.items || []).filter(i => i.pesticideId === selectedDetailItem.pesticideId).forEach((item, iIdx) => {
                const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
                const isReturn = p.type === 'RETURN';
                const qtyMultiplier = isReturn ? 1 : -1;
                const impact = qty * qtyMultiplier;
                history.push({
                    id: iIdx === 0 ? p.id : `${p.id}-${iIdx}-${pIdx}`,
                    targetId: p.farmerId,
                    name: farmerMap[p.farmerId] || `Bilinmeyen ${farmerLabel}`,
                    date: p.date,
                    price: item.unitPrice || 0,
                    quantity: Math.abs(qty).toString(),
                    isReturn: impact > 0,
                    type: 'SALE'
                });
            });
        });
        
        return history;
    }, [selectedDetailItem, prescriptions, farmerMap, selectedYear, currentYear]);

    const combinedHistory = useMemo(() => {
        const adjustmentsHistory = (selectedDetailItem?.adjustments || []).filter(adj => {
            if (selectedYear < currentYear && adj.date) {
                const year = new Date(adj.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        }).map((adj, idx) => ({
            id: `adj-${idx}`,
            index: idx,
            targetId: 'manual',
            name: adj.note || 'Manuel Stok Düzeltme',
            date: adj.date,
            price: 0,
            quantity: Math.abs(adj.amount).toString(),
            isReturn: adj.amount < 0,
            type: 'ADJUSTMENT' as 'SALE'|'PURCHASE'|'ADJUSTMENT'
        }));
        
        return [...salesHistory, ...purchaseHistory, ...adjustmentsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [salesHistory, purchaseHistory, selectedDetailItem, selectedYear]);

    const salesCount = useMemo(() => combinedHistory.filter(i => i.type === 'SALE').length, [combinedHistory]);
    const purchaseCount = useMemo(() => combinedHistory.filter(i => i.type === 'PURCHASE').length, [combinedHistory]);
    const adjustmentCount = useMemo(() => combinedHistory.filter(i => i.type === 'ADJUSTMENT').length, [combinedHistory]);

    const filteredCombinedHistory = useMemo(() => {
        let list = combinedHistory;

        if (historyTypeFilter !== 'ALL') {
            list = list.filter(item => item.type === historyTypeFilter);
        }

        if (historySearchQuery.trim()) {
            const query = historySearchQuery.trim().toLowerCase();
            list = list.filter(item => {
                const nameMatch = item.name.toLowerCase().includes(query);

                const rawPriceStr = item.price.toString();
                const formattedPriceStr = formatCurrency(item.price, userProfile?.currency || 'TRY').toLowerCase();
                const priceMatch = rawPriceStr.includes(query) || formattedPriceStr.includes(query);

                const qtyMatch = item.quantity.toString().includes(query);

                let dateFormatted = '';
                try {
                    dateFormatted = new Date(item.date).toLocaleDateString('tr-TR');
                } catch (e) {
                    dateFormatted = item.date;
                }
                const dateMatch = dateFormatted.includes(query) || item.date.includes(query);

                const typeLabel = item.type === 'SALE'
                    ? (item.isReturn ? 'satış iade' : 'satış')
                    : item.type === 'PURCHASE'
                    ? (item.isReturn ? 'alım iade tedarikçi' : 'alım tedarikçi')
                    : 'depomdan manuel düzeltme fark';
                const typeMatch = typeLabel.toLowerCase().includes(query);

                return nameMatch || priceMatch || qtyMatch || dateMatch || typeMatch;
            });
        }

        return list;
    }, [combinedHistory, historySearchQuery, historyTypeFilter, userProfile?.currency]);

    const profitabilityMetrics = useMemo(() => {
        if (!selectedDetailItem) return null;

        const buyingPrice = selectedDetailItem.buyingPrice || 0;
        const sellingPrice = selectedDetailItem.sellingPrice || 0;
        
        // 1. Kârlılık Oranı (%)
        const profitMargin = buyingPrice > 0 ? ((sellingPrice - buyingPrice) / buyingPrice) * 100 : 0;

        // 2. Kalan Stoktan Yapılacak Kâr
        const remainingStock = selectedDetailItem.quantity || 0;
        const expectedProfit = remainingStock * (sellingPrice - buyingPrice);

        // 3. Bu üründen yapılan satışlardan elde edilen kâr
        let totalRealizedProfit = 0;
        let totalSoldQuantity = 0;

        prescriptions.filter(p => !p.deletedAt && !(!p.isInventoryProcessed && p.isProcessed === false)).forEach(p => {
            const sign = p.type === 'RETURN' ? -1 : 1;
            (p.items || []).filter(i => i.pesticideId === selectedDetailItem.pesticideId).forEach(item => {
                if (item && item.unitPrice !== undefined) {
                    const qtyStr = item.quantity?.toString() || '0';
                    const parsedQty = Math.abs(parseFloat(qtyStr.replace(',', '.')) || 0);
                    if (!isNaN(parsedQty) && parsedQty !== 0) {
                        const profitPerUnit = (Number(item.unitPrice) || 0) - buyingPrice;
                        totalRealizedProfit += sign * (profitPerUnit * parsedQty);
                        totalSoldQuantity += sign * parsedQty;
                    }
                }
            });
        });

        return {
            profitMargin,
            expectedProfit,
            totalRealizedProfit,
            totalSoldQuantity
        };
    }, [selectedDetailItem, prescriptions]);

    // Analysis Data
    const analysisData = useMemo(() => {
        const totalCost = inventory.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.buyingPrice) || 0)), 0);
        const totalPotentialRevenue = inventory.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0)), 0);
        const cashTotalCost = inventory.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.cashBuyingPrice) || 0)), 0);
        const cashTotalPotentialRevenue = inventory.reduce((acc, item) => acc + ((Number(item.quantity) || 0) * (Number(item.cashPrice) || 0)), 0);
        const potentialProfit = totalPotentialRevenue - totalCost;
        const profitMargin = totalCost > 0 ? (potentialProfit / totalCost) * 100 : 0;
        const cashPotentialProfit = cashTotalPotentialRevenue - cashTotalCost;
        const cashProfitMargin = cashTotalCost > 0 ? (cashPotentialProfit / cashTotalCost) * 100 : 0;

        const categoryDistribution = inventory.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + ((Number(item.quantity) || 0) * (Number(item.buyingPrice) || 0));
            return acc;
        }, {} as Record<string, number>);

        const chartData = Object.entries(categoryDistribution).map(([name, value]) => ({ name, value }));

        return {
            totalCost,
            totalPotentialRevenue,
            potentialProfit,
            profitMargin,
            cashTotalCost,
            cashTotalPotentialRevenue,
            cashPotentialProfit,
            cashProfitMargin,
            chartData
        };
    }, [inventory]);

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    const profitLossData = useMemo(() => {
        const processed = prescriptions.filter(p => {
            if (!p.isInventoryProcessed || p.deletedAt) return false;
            if (p.date) {
                const year = new Date(p.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        });
        
        let totalSoldCost = 0;
        let totalSoldRevenue = 0;

        const buyingPriceMap = inventory.reduce((acc, item) => {
            acc[item.pesticideId] = item.buyingPrice;
            return acc;
        }, {} as Record<string, number>);

        processed.forEach(p => {
            const sign = p.type === 'RETURN' ? -1 : 1;
            (p.items || []).forEach(item => {
                const qty = Math.abs(parseFloat(String(item.quantity || '0').replace(',', '.')) || 0);
                if (qty > 0) {
                    const cost = Number(buyingPriceMap[item.pesticideId]) || 0;
                    const revenue = Number(item.unitPrice) || 0;
                    
                    totalSoldCost += sign * qty * cost;
                    totalSoldRevenue += sign * qty * revenue;
                }
            });
        });

        const cashBalance = accounts.filter(a => a.type === 'CASH').reduce((acc, a) => acc + a.balance, 0);
        const bankBalance = accounts.filter(a => a.type === 'BANK').reduce((acc, a) => acc + a.balance, 0);
        const totalProfit = totalSoldRevenue - totalSoldCost - stats.totalExpenses;
        const netProfit = totalProfit + cashBalance + bankBalance;
        const margin = totalSoldCost > 0 ? (totalProfit / (totalSoldCost + stats.totalExpenses)) * 100 : 0;

        return {
            totalSoldCost,
            totalSoldRevenue,
            totalProfit,
            netProfit,
            cashBalance,
            bankBalance,
            margin,
            processedCount: processed.length,
            totalExpenses: stats.totalExpenses
        };
    }, [inventory, prescriptions, stats.totalExpenses, accounts, selectedYear]);

    return (
        <div className="p-4 pb-32 max-w-5xl mx-auto animate-in fade-in duration-500">
            {/* Quick action bar: ministry stock-in, equivalent finder, AI invoice OCR */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                <button
                    onClick={() => (window as any).mks_open_ministry?.('malkabul')}
                    className="flex items-center justify-center gap-2 min-h-[42px] px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all"
                ><ShieldCheck size={15} className="shrink-0" /><span className="truncate">Fabrikadan Mal Kabul (BKTS/GTS)</span></button>
                <button
                    onClick={() => (window as any).mks_open_ministry?.('esdeger')}
                    className="flex items-center justify-center gap-2 min-h-[42px] px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold hover:bg-sky-500/20 active:scale-95 transition-all"
                ><Layers size={15} className="shrink-0" /><span className="truncate">Eşdeğer / Muadil İlaç Bul</span></button>
                <button
                    onClick={() => { setOcrRows([]); setIsOcrInvoiceOpen(true); }}
                    className="flex items-center justify-center gap-2 min-h-[42px] px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 active:scale-95 transition-all"
                ><Sparkles size={15} className="shrink-0" /><span className="truncate">AI Alış Faturası Tara</span></button>
            </div>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 shrink-0">
                        <Package className="text-emerald-500" size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-stone-100 tracking-tight leading-tight">Depo ve Stok</h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span>
                            <span className="text-[11px] font-medium text-stone-400">Stok, maliyet ve sayım yönetimi</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-1 w-full flex-nowrap overflow-hidden">
                    <div className="relative flex-1 min-w-0">
                        <button 
                            onClick={() => setIsListMenuOpen(!isListMenuOpen)}
                            className="w-full bg-stone-900/80 hover:bg-stone-800 text-stone-300 px-1 py-1.5 rounded-xl font-black text-[9px] border border-white/10 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 group shadow-sm uppercase tracking-tighter h-11 min-w-0"
                        >
                            <List size={14} className="text-stone-500 group-hover:text-emerald-400 transition-colors shrink-0" />
                            <span className="truncate w-full text-center px-0.5">Depo Raporu</span>
                        </button>
                        
                        {isListMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsListMenuOpen(false)}></div>
                                <div className="absolute top-full left-0 mt-2 w-52 bg-stone-900 border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-2 border-b border-white/5 bg-stone-950/50">
                                        <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest px-2">PDF Rapor Seçenekleri</span>
                                    </div>
                                    <button 
                                        onClick={() => { generateInventoryPDF('CUSTOMER'); setIsListMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-stone-300 hover:bg-stone-800 hover:text-emerald-400 flex items-center gap-3 transition-colors"
                                    >
                                        <User size={12} className="text-blue-400" />
                                        Müşteri Fiyat Listesi
                                    </button>
                                    <button 
                                        onClick={() => { generateInventoryPDF('INTERNAL'); setIsListMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-stone-300 hover:bg-stone-800 hover:text-emerald-400 flex items-center gap-3 transition-colors"
                                    >
                                        <Package size={12} className="text-amber-400" />
                                        İç Stok & Maliyet Listesi
                                    </button>
                                    <button 
                                        onClick={() => { generateInventoryPDF('FULL'); setIsListMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-stone-300 hover:bg-stone-800 hover:text-emerald-400 flex items-center gap-3 transition-colors"
                                    >
                                        <TrendingUp size={12} className="text-emerald-400" />
                                        Tam Finansal Rapor
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="relative flex-1 min-w-0">
                        <button 
                            onClick={() => setIsStockMenuOpen(!isStockMenuOpen)}
                            className={`w-full px-1 py-1.5 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 font-black text-[9px] uppercase tracking-tighter shadow-sm active:scale-95 h-11 min-w-0 ${stockFilter !== 'ALL' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-stone-900/80 border-white/10 text-stone-500 hover:text-stone-300'}`}
                        >
                            {stockFilter === 'ALL' ? <Eye size={14} className="shrink-0" /> : stockFilter === 'OUT_OF_STOCK' ? <EyeOff size={14} className="shrink-0" /> : <Eye size={14} className="shrink-0" />}
                            <span className="truncate w-full text-center px-0.5">{stockFilter === 'ALL' ? "Tümünü Göster" : "Filtreli"}</span>
                        </button>

                        {isStockMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsStockMenuOpen(false)}></div>
                                <div className="absolute top-full right-0 mt-2 w-40 bg-stone-900 border border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button 
                                        onClick={() => { setStockFilter('ALL'); setIsStockMenuOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-[10px] font-bold flex items-center gap-3 transition-colors ${stockFilter === 'ALL' ? 'bg-stone-800 text-emerald-400' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'}`}
                                    >
                                        <List size={12} /> Tümünü Göster
                                    </button>
                                    <button 
                                        onClick={() => { setStockFilter('OUT_OF_STOCK'); setIsStockMenuOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-[10px] font-bold flex items-center gap-3 transition-colors ${stockFilter === 'OUT_OF_STOCK' ? 'bg-stone-800 text-amber-400' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'}`}
                                    >
                                        <EyeOff size={12} /> Bitenleri Göster
                                    </button>
                                    <button 
                                        onClick={() => { setStockFilter('IN_STOCK'); setIsStockMenuOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-[10px] font-bold flex items-center gap-3 transition-colors ${stockFilter === 'IN_STOCK' ? 'bg-stone-800 text-emerald-400' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'}`}
                                    >
                                        <Eye size={12} /> Kalanları Göster
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {canEditInventory && (
                        <button 
                            onClick={openPriceUpdateModal}
                            className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-500/30 px-1 py-1.5 rounded-xl font-black text-[9px] shadow-sm active:scale-95 transition-all flex flex-col items-center justify-center gap-1 uppercase tracking-tighter h-11 min-w-0"
                        >
                            <DollarSign size={14} className="shrink-0" />
                            <span className="truncate w-full text-center px-0.5">Fiyat Güncelle</span>
                        </button>
                    )}

                    {canEditInventory && (
                        <button 
                            onClick={() => openAddModal()}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-1 py-1.5 rounded-xl font-black text-[9px] shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 uppercase tracking-tighter h-11 min-w-0"
                        >
                            <Plus size={16} className="shrink-0" />
                            <span className="truncate w-full text-center px-0.5">Ürün Ekle</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div className="flex gap-1.5 bg-stone-900/80 p-1 rounded-2xl border border-white/10 w-fit shadow-inner">
                <button 
                    onClick={() => setActiveTab('LIST')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'LIST' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'}`}
                >
                    <Package size={14} /> 🏠 Sistem Deposu
                </button>
                {!isSales && !hideCost && (
                    <>
                        <button 
                            onClick={() => setActiveTab('ANALYSIS')}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'ANALYSIS' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'}`}
                        >
                            <BarChart3 size={14} /> Finansal Analiz
                        </button>
                        <button 
                            onClick={() => setActiveTab('PROFIT_LOSS')}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'PROFIT_LOSS' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'}`}
                        >
                            <TrendingUp size={14} /> Kar / Zarar
                        </button>
                    </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => (window as any).mks_open_edm?.('incoming')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-black flex items-center gap-1.5 shadow-sm"
                >
                  <span>🧾 e-Fatura Deposu &amp; Gelen e-Faturalar</span>
                </button>
                <button
                  onClick={() => (window as any).mks_open_edm?.('issue')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-black flex items-center gap-1.5 shadow-sm"
                >
                  <span>📤 Sadece e-Faturalı Stoğa Fatura Kes</span>
                </button>
              </div>
            </div>

            {activeTab === 'LIST' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                    {/* Search & Filter */}
                    <div className="flex flex-col gap-2 mb-4">
                        <div className="flex flex-wrap sm:flex-nowrap gap-2">
                            <select 
                                className="flex-1 bg-stone-900/80 border border-white/10 rounded-xl px-3 py-2 text-stone-400 text-xs font-bold outline-none cursor-pointer hover:text-stone-200 transition-colors min-w-0"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="ALL">Tüm Kategoriler</option>
                                {Object.values(PesticideCategory).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>

                            <div className="flex items-center gap-1.5 bg-stone-900/80 border border-white/10 rounded-xl px-2.5 py-2 text-stone-300 text-xs font-bold shadow-sm">
                                <Calendar size={14} className="text-emerald-400 shrink-0" />
                                <select 
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    className="bg-transparent text-stone-200 text-xs font-bold outline-none cursor-pointer pr-1"
                                >
                                    {yearsList.map(y => (
                                        <option key={y} value={y} className="bg-stone-900 text-stone-200">
                                            {y} Yılı {y < currentYear ? '(Devir)' : '(Güncel)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={() => setIsSmartOrderModalOpen(true)}
                                className="flex-1 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 transition-all rounded-xl px-2 py-2 flex items-center justify-center gap-1.5 min-w-0 group"
                                title="Akıllı Sipariş Listesi"
                            >
                                <ShoppingCart size={14} className="group-hover:scale-110 transition-transform duration-500 shrink-0" />
                                <span className="text-xs font-bold truncate">Sipariş Listesi</span>
                            </button>
                        </div>
                        <div className="w-full bg-stone-900/80 border border-white/10 rounded-xl flex items-center px-3 py-0.5 shadow-sm focus-within:border-emerald-500/50 transition-all">
                            <Search className="text-stone-500 shrink-0" size={18} />
                            <input 
                                type="text"
                                placeholder="Ürün adı, barkod, GTIN veya Lot ara..."
                                className="w-full bg-transparent p-2.5 text-stone-200 outline-none text-sm font-medium placeholder-stone-600"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* SKT Radarı (30 / 60 / 90 Gün) (#17) */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setExpiryFilter('ALL')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${expiryFilter === 'ALL' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-stone-900/80 text-stone-400 border-white/10 hover:text-stone-200'}`}
                            >
                                Tüm SKT'ler
                            </button>
                            <button
                                type="button"
                                onClick={() => setExpiryFilter('EXPIRED')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${expiryFilter === 'EXPIRED' ? 'bg-red-600 text-white border-red-500' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'}`}
                            >
                                ⛔ SKT Geçmiş ({sktRadarCounts.expired})
                            </button>
                            <button
                                type="button"
                                onClick={() => setExpiryFilter('SKT_30')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${expiryFilter === 'SKT_30' ? 'bg-rose-600 text-white border-rose-500' : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'}`}
                            >
                                🚨 ≤30 Gün ({sktRadarCounts.d30})
                            </button>
                            <button
                                type="button"
                                onClick={() => setExpiryFilter('SKT_60')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${expiryFilter === 'SKT_60' ? 'bg-amber-600 text-stone-950 border-amber-500' : 'bg-amber-500/10 text-amber-300 border-amber-500/20 hover:bg-amber-500/20'}`}
                            >
                                ⏳ ≤60 Gün ({sktRadarCounts.d30 + sktRadarCounts.d60})
                            </button>
                            <button
                                type="button"
                                onClick={() => setExpiryFilter('SKT_90')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${expiryFilter === 'SKT_90' ? 'bg-sky-600 text-white border-sky-500' : 'bg-sky-500/10 text-sky-300 border-sky-500/20 hover:bg-sky-500/20'}`}
                            >
                                📅 ≤90 Gün FEFO ({sktRadarCounts.totalRisk - sktRadarCounts.expired})
                            </button>
                        </div>
                    </div>

                    {selectedYear < currentYear && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 flex items-center gap-3 text-amber-300 text-xs font-bold shadow-sm animate-in fade-in duration-300">
                            <Calendar size={18} className="text-amber-400 shrink-0" />
                            <div>
                                <span>{selectedYear} Yılı Stok Durumları ve Hareketleri Gösteriliyor</span>
                                <p className="text-[10px] text-amber-400/70 font-normal mt-0.5">Devredilen geçmiş yıl stok verilerini görüntülüyorsunuz. Güncel envanter için {currentYear} yılını seçebilirsiniz.</p>
                            </div>
                        </div>
                    )}

                    {/* Inventory List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map(item => {
                                const displayQty = getYearlyItemQuantity(item, selectedYear);
                                return (
                                <div 
                                    key={item.id} 
                                    onClick={() => openDetailModal(item)}
                                    className={`bg-stone-900/80 backdrop-blur border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-sm transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden ${
                                        displayQty <= 0 
                                        ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                                        : 'border-white/5 hover:border-emerald-500/30 hover:bg-stone-900'
                                    }`}
                                >
                                    {/* Stock Badge - Compact & High Visibility */}
                                    <div className="absolute top-0 right-0 flex shadow-md z-10 rounded-bl-xl sm:rounded-bl-2xl overflow-hidden border-b border-l border-white/5">
                                        <div className="px-1.5 sm:px-2 py-1 bg-stone-800/90 backdrop-blur-sm text-stone-300 font-black font-mono text-[9px] sm:text-[10px] flex items-center gap-1 border-r border-white/5">
                                            <Truck size={10} />
                                            {getTotalIncomingQuantity(item, selectedYear)} <span className="text-[6.5px] sm:text-[7px] opacity-70 font-sans uppercase">GELEN</span>
                                        </div>
                                        <div className={`px-2 sm:px-3 py-1 font-black font-mono text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 ${
                                            displayQty <= 0 
                                            ? 'bg-red-500 text-white' 
                                            : (item.lowStockThreshold && displayQty <= item.lowStockThreshold)
                                            ? 'bg-amber-500 text-stone-950 animate-pulse'
                                            : 'bg-emerald-500 text-stone-950'
                                        }`}>
                                            <Package size={11} />
                                            {Number(displayQty).toString()} <span className="text-[7px] sm:text-[8px] opacity-70 font-sans uppercase">KALAN</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-start mb-2 sm:mb-3 pr-28 sm:pr-32">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-black text-stone-100 text-xs sm:text-sm truncate tracking-tight group-hover:text-emerald-400 transition-colors uppercase">{item.pesticideName}</h3>
                                                {(item.lowStockThreshold && item.quantity > 0 && item.quantity <= item.lowStockThreshold) && (
                                                    <span className="flex h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-amber-500 shrink-0"></span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1 mt-1">
                                                <span className="text-[7.5px] sm:text-[8px] font-black text-stone-500 bg-stone-950/60 px-1.5 py-0.5 rounded-full border border-white/5 uppercase tracking-wider inline-block">
                                                    {item.category}
                                                </span>
                                                {(item.lowStockThreshold && item.quantity > 0 && item.quantity <= item.lowStockThreshold) && (
                                                    <span className="text-[7px] font-black text-amber-500 uppercase tracking-tighter">AZALAN STOK</span>
                                                )}
                                                {item.expiryDate && (() => {
                                                    const d = getDaysUntilExpiry(item.expiryDate);
                                                    if (d === null) return null;
                                                    if (d < 0) return <span className="text-[7.5px] sm:text-[8px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">⛔ SKT GEÇTİ</span>;
                                                    if (d <= 30) return <span className="text-[7.5px] sm:text-[8px] font-black px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">🚨 SKT {d}G</span>;
                                                    if (d <= 90) return <span className="text-[7.5px] sm:text-[8px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">⏳ FEFO {d}G</span>;
                                                    return <span className="text-[7.5px] sm:text-[8px] font-mono text-stone-500">SKT: {item.expiryDate}</span>;
                                                })()}
                                                {item.lotNumber && (
                                                    <span className="text-[7.5px] sm:text-[8px] font-mono text-stone-400 bg-stone-950/60 px-1.5 py-0.5 rounded border border-white/5">Lot: {item.lotNumber}</span>
                                                )}
                                                {item.packSize && item.packSize > 1 && (
                                                    <span className="text-[7.5px] sm:text-[8px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                                        1 {item.packUnitName || 'Koli'}={item.packSize} {item.unit}
                                                    </span>
                                                )}
                                                {(item.consignmentQty || 0) > 0 && (
                                                    <span className="text-[7.5px] sm:text-[8px] font-bold text-indigo-300 bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/25">
                                                        Emanet: {item.consignmentQty}
                                                    </span>
                                                )}
                                                {(item.quarantineQty || 0) > 0 && (
                                                    <span className="text-[7.5px] sm:text-[8px] font-bold text-rose-300 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/25">
                                                        Karantina: {item.quarantineQty}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Compact Price Grid */}
                                    <div className="space-y-1 sm:space-y-1.5">
                                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                            <div className="bg-stone-950/60 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-white/5 group-hover:border-blue-500/20 transition-colors">
                                                <span className="text-[7px] sm:text-[8px] text-stone-500 font-black uppercase block mb-0.5 tracking-wider">Peşin Satış</span>
                                                <span className="text-blue-400 font-black font-mono text-[11px] sm:text-xs">
                                                    {formatCurrency(Math.round(item.cashPrice || 0), userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                            <div className="bg-stone-950/60 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-white/5 group-hover:border-amber-500/20 transition-colors">
                                                <span className="text-[7px] sm:text-[8px] text-stone-500 font-black uppercase block mb-0.5 tracking-wider">Vadeli Satış</span>
                                                <span className="text-amber-400 font-black font-mono text-[11px] sm:text-xs">
                                                    {formatCurrency(Math.round(item.sellingPrice), userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                        </div>

                                        {!hideCost && (
                                            <div className="flex items-center justify-between px-2 py-0.5 bg-stone-950/40 rounded-md border border-white/5 text-[8px] sm:text-[9px] text-stone-400 font-mono">
                                                <span>Alış: {formatCurrency(Math.round(item.cashBuyingPrice || 0), userProfile?.currency || 'TRY')} <span className="opacity-60">(Peşin)</span></span>
                                                <span>{formatCurrency(Math.round(item.buyingPrice), userProfile?.currency || 'TRY')} <span className="opacity-60">(Vade)</span></span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action row at bottom */}
                                    <div className="mt-2 sm:mt-3 flex justify-end">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                generateItemReport(item);
                                            }}
                                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg border border-emerald-500/20 transition-colors flex items-center justify-center gap-1.5"
                                            title="PDF Raporu İndir"
                                        >
                                            <Download size={12} />
                                            <span className="text-[9px] font-bold uppercase">Rapor PDF</span>
                                        </button>
                                    </div>
                                </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full text-center py-12 border-2 border-dashed border-stone-800 rounded-2xl text-stone-600">
                                <Package size={48} className="mx-auto mb-4 opacity-20" />
                                <p>Deponuzda ürün bulunamadı.</p>
                                <button onClick={() => openAddModal()} className="text-emerald-500 font-bold mt-2 hover:underline">Yeni Ürün Ekle</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'ANALYSIS' && (
                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                    {/* Compact Analysis Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Peşin Analiz */}
                        <div className="bg-stone-900/40 backdrop-blur-sm rounded-[2rem] border border-white/5 p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-emerald-500/10"></div>
                            
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                                        <DollarSign size={16} />
                                    </div>
                                    <h3 className="text-xs font-black text-stone-200 uppercase tracking-widest">Peşin Analiz</h3>
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${analysisData.cashProfitMargin >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    %{analysisData.cashProfitMargin.toFixed(1)} MARJ
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                <div className="bg-stone-950/40 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-stone-500 font-black uppercase tracking-widest mb-1">Maliyet</p>
                                    <p className="text-sm font-black text-stone-300 font-mono truncate" title={formatCurrency(analysisData.cashTotalCost, userProfile?.currency || 'TRY')}>
                                        {formatCurrency(analysisData.cashTotalCost, userProfile?.currency || 'TRY')}
                                    </p>
                                </div>
                                <div className="bg-stone-950/40 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-stone-500 font-black uppercase tracking-widest mb-1">Potansiyel Ciro</p>
                                    <p className="text-sm font-black text-emerald-400/90 font-mono truncate" title={formatCurrency(analysisData.cashTotalPotentialRevenue, userProfile?.currency || 'TRY')}>
                                        {formatCurrency(analysisData.cashTotalPotentialRevenue, userProfile?.currency || 'TRY')}
                                    </p>
                                </div>
                                <div className="col-span-2 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest mb-0.5">Tahmini Peşin Kar</p>
                                        <p className={`text-xl font-black font-mono ${analysisData.cashPotentialProfit >= 0 ? 'text-emerald-400' : 'text-red-400'} truncate`}>
                                            {formatCurrency(analysisData.cashPotentialProfit, userProfile?.currency || 'TRY')}
                                        </p>
                                    </div>
                                    <TrendingUp size={20} className="text-emerald-500/20" />
                                </div>
                            </div>
                        </div>

                        {/* Vadeli Analiz */}
                        <div className="bg-stone-900/40 backdrop-blur-sm rounded-[2rem] border border-white/5 p-5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-amber-500/10"></div>
                            
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                                        <Calendar size={16} />
                                    </div>
                                    <h3 className="text-xs font-black text-stone-200 uppercase tracking-widest">Vadeli Analiz</h3>
                                </div>
                                <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${analysisData.profitMargin >= 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                                    %{analysisData.profitMargin.toFixed(1)} MARJ
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                <div className="bg-stone-950/40 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-stone-500 font-black uppercase tracking-widest mb-1">Maliyet</p>
                                    <p className="text-sm font-black text-stone-300 font-mono truncate" title={formatCurrency(analysisData.totalCost, userProfile?.currency || 'TRY')}>
                                        {formatCurrency(analysisData.totalCost, userProfile?.currency || 'TRY')}
                                    </p>
                                </div>
                                <div className="bg-stone-950/40 p-3 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-stone-500 font-black uppercase tracking-widest mb-1">Potansiyel Ciro</p>
                                    <p className="text-sm font-black text-amber-400/90 font-mono truncate" title={formatCurrency(analysisData.totalPotentialRevenue, userProfile?.currency || 'TRY')}>
                                        {formatCurrency(analysisData.totalPotentialRevenue, userProfile?.currency || 'TRY')}
                                    </p>
                                </div>
                                <div className="col-span-2 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] text-amber-500/60 font-black uppercase tracking-widest mb-0.5">Tahmini Vadeli Kar</p>
                                        <p className={`text-xl font-black font-mono ${analysisData.potentialProfit >= 0 ? 'text-amber-400' : 'text-red-400'} truncate`}>
                                            {formatCurrency(analysisData.potentialProfit, userProfile?.currency || 'TRY')}
                                        </p>
                                    </div>
                                    <BarChart3 size={20} className="text-amber-500/20" />
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-stone-900 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-stone-200 font-bold mb-6 flex items-center gap-2 text-sm">
                                <PieChart size={16} className="text-emerald-500" />
                                Kategori Bazlı Maliyet Dağılımı
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={analysisData.chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            isAnimationActive={false}
                                        >
                                            {analysisData.chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#1c1917', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                            formatter={(value: number) => formatCurrency(value, userProfile?.currency || 'TRY')}
                                        />
                                    </RePieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                {analysisData.chartData.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                        <span className="text-[10px] text-stone-400 truncate flex-1">{item.name}</span>
                                        <span className="text-[10px] text-stone-300 font-mono">{((item.value / analysisData.totalCost) * 100).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-stone-900 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-stone-200 font-bold mb-6 flex items-center gap-2 text-sm">
                                <TrendingUp size={16} className="text-blue-500" />
                                En Yüksek Kar Marjlı Ürünler (Top 5)
                            </h3>
                            <div className="space-y-3">
                                {[...inventory]
                                    .sort((a, b) => (b.sellingPrice - b.buyingPrice) - (a.sellingPrice - a.buyingPrice))
                                    .slice(0, 5)
                                    .map((item, idx) => {
                                        const profit = item.sellingPrice - item.buyingPrice;
                                        const margin = item.buyingPrice > 0 ? (profit / item.buyingPrice) * 100 : 100;
                                        return (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-stone-950/50 rounded-xl border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-lg bg-stone-800 flex items-center justify-center text-[10px] font-bold text-stone-400">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-stone-300">{item.pesticideName}</div>
                                                        <div className="text-[10px] text-stone-500">{item.category}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-emerald-400 font-mono">
                                                        +{formatCurrency(profit, userProfile?.currency || 'TRY')}
                                                    </div>
                                                    <div className="text-[10px] text-stone-500 font-mono">
                                                        %{margin.toFixed(0)} Marj
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'PROFIT_LOSS' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-stone-900 border border-white/5 p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                                    <ArrowDownRight size={20} />
                                </div>
                                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">Satılan Ürün Maliyeti</span>
                            </div>
                            <div className="text-2xl font-black text-stone-100">{formatCurrency(profitLossData.totalSoldCost, userProfile?.currency || 'TRY')}</div>
                            <p className="text-[10px] text-stone-600 mt-2 font-medium">{profitLossData.processedCount} adet işlenmiş fatura baz alınmıştır.</p>
                        </div>

                        <div className="bg-stone-900 border border-white/5 p-5 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <ArrowUpRight size={20} />
                                </div>
                                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">Satış Geliri</span>
                            </div>
                            <div className="text-2xl font-black text-stone-100">{formatCurrency(profitLossData.totalSoldRevenue, userProfile?.currency || 'TRY')}</div>
                            <p className="text-[10px] text-stone-600 mt-2 font-medium">{prescriptionLabel}lerdeki birim fiyatlar üzerinden hesaplanmıştır.</p>
                        </div>

                        <div className="bg-stone-900 border border-white/5 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 ${profitLossData.netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profitLossData.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    <DollarSign size={20} />
                                </div>
                                <span className="text-stone-500 text-[10px] font-bold uppercase tracking-wider">Net Kar / Zarar</span>
                            </div>
                            <div className={`text-2xl font-black ${profitLossData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(profitLossData.netProfit, userProfile?.currency || 'TRY')}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${profitLossData.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                    %{profitLossData.margin.toFixed(1)} Marj
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Info Card */}
                    <div className="bg-stone-900 border border-white/5 p-8 rounded-3xl shadow-sm">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-stone-100 tracking-tight">Finansal Özet</h3>
                                <p className="text-stone-500 text-xs font-bold uppercase tracking-widest">Gerçekleşen Satış Analizi</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">Toplam Satış Geliri</span>
                                <span className="text-stone-100 font-black">{formatCurrency(profitLossData.totalSoldRevenue, userProfile?.currency || 'TRY')}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">Toplam Ürün Maliyeti</span>
                                <span className="text-stone-100 font-black text-red-400">-{formatCurrency(profitLossData.totalSoldCost, userProfile?.currency || 'TRY')}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">İşletme Giderleri</span>
                                <span className="text-stone-100 font-black text-red-400">-{formatCurrency(profitLossData.totalExpenses, userProfile?.currency || 'TRY')}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">Kasadaki Para</span>
                                <span className="text-stone-100 font-black text-emerald-400">{formatCurrency(profitLossData.cashBalance, userProfile?.currency || 'TRY')}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                <span className="text-stone-400 font-medium">Hesaptaki Para</span>
                                <span className="text-stone-100 font-black text-emerald-400">{formatCurrency(profitLossData.bankBalance, userProfile?.currency || 'TRY')}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-stone-100 font-black text-lg">Toplam Net Kar</span>
                                <span className={`text-2xl font-black ${profitLossData.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatCurrency(profitLossData.netProfit, userProfile?.currency || 'TRY')}
                                </span>
                            </div>
                        </div>

                        <div className="mt-10 p-4 bg-stone-950/50 rounded-2xl border border-white/5 flex items-start gap-3">
                            <AlertCircle className="text-amber-500 shrink-0" size={18} />
                            <p className="text-xs text-stone-500 leading-relaxed">
                                Bu veriler, "İşlenmiş" olarak işaretlenen ve stoktan düşülen faturalardaki ürünlerin, deponuzdaki güncel alış fiyatları ile faturadaki satış fiyatları karşılaştırılarak hesaplanmıştır.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <InventoryItemFormModal
                isAddModalOpen={isAddModalOpen}
                isEditModalOpen={isEditModalOpen}
                productName={productName}
                setProductName={setProductName}
                selectedPesticide={selectedPesticide}
                setSelectedPesticide={setSelectedPesticide}
                pesticides={pesticides}
                filteredPesticides={filteredPesticides}
                formData={formData}
                setFormData={setFormData}
                currency={userProfile?.currency}
                isSaving={isSaving}
                showToast={showToast}
                onOpenScanner={() => setIsScanning(true)}
                onClose={closeModal}
                onSaveAdd={handleAddItem}
                onSaveEdit={handleUpdateItem}
                lastScan={lastFormScan}
            />

            {/* Detail Modal — Wide & Organized 2-Column Bento Layout on Desktop & Web */}
            {isDetailModalOpen && selectedDetailItem && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5"
                    onClick={closeModal}
                >
                    <div
                        className="bg-stone-900 w-full max-w-lg md:max-w-3xl lg:max-w-5xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex flex-wrap justify-between items-center gap-3 bg-stone-950/60 shrink-0">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-lg sm:text-xl font-black text-stone-100 tracking-tight truncate">{selectedDetailItem.pesticideName}</h3>
                                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
                                        {selectedDetailItem.category}
                                    </span>
                                </div>
                                {(selectedDetailItem.gtin || selectedDetailItem.barcode) && (
                                    <p className="text-[11px] font-mono text-stone-400 mt-0.5">
                                        GTIN / Barkod: {selectedDetailItem.gtin || selectedDetailItem.barcode}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {canEditInventory && (
                                    <div className="flex items-center gap-1.5 mr-1 pr-2 border-r border-white/10">
                                        <button 
                                            onClick={() => {
                                                closeModal();
                                                openEditModal(selectedDetailItem);
                                            }} 
                                            className="min-w-[40px] min-h-[40px] px-3 py-2 bg-stone-800 text-stone-300 rounded-xl hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-xs font-bold"
                                            title="Düzenle"
                                        >
                                            <Edit2 size={15} />
                                            <span className="hidden sm:inline">Düzenle</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleDeleteItem(selectedDetailItem.id);
                                            }} 
                                            className="min-w-[40px] min-h-[40px] p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-red-400 transition-colors flex items-center justify-center"
                                            title="Sil"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                                {!hideCost && (
                                    <button 
                                        onClick={() => setShowProfitability(!showProfitability)} 
                                        className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${showProfitability ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-800 text-stone-300 hover:text-white border border-transparent'}`}
                                    >
                                        <TrendingUp size={15} /> Kâr Oranı
                                    </button>
                                )}
                                <button
                                    onClick={closeModal}
                                    aria-label="Kapat"
                                    data-mks-modal-close="true"
                                    className="w-10 h-10 min-w-[40px] min-h-[40px] bg-stone-800 text-stone-300 rounded-xl hover:text-white transition-colors flex items-center justify-center"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain custom-scrollbar space-y-5 flex-1 min-h-0">
                            {/* Profitability View */}
                            {!hideCost && showProfitability && profitabilityMetrics && (
                                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300 bg-stone-950/50 p-4 rounded-2xl border border-emerald-500/20">
                                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp size={14} /> Kârlılık Analizi
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20">
                                            <span className="text-[11px] text-emerald-400/90 font-bold uppercase block mb-1">Kârlılık Oranı</span>
                                            <span className="text-emerald-400 font-black text-2xl font-mono">
                                                %{profitabilityMetrics.profitMargin.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/20">
                                            <span className="text-[11px] text-blue-400/90 font-bold uppercase block mb-1">Gerçekleşen Kâr ({profitabilityMetrics.totalSoldQuantity} Satış)</span>
                                            <span className="text-blue-400 font-black text-xl font-mono">
                                                {formatCurrency(profitabilityMetrics.totalRealizedProfit, userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                        <div className="bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20">
                                            <span className="text-[11px] text-amber-400/90 font-bold uppercase block mb-1">Kalan Stoktan Beklenen Kâr</span>
                                            <span className="text-amber-400 font-black text-xl font-mono">
                                                {formatCurrency(profitabilityMetrics.expectedProfit, userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Top 6-Card Summary & Quick Action Strip */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                <div className="bg-stone-950/60 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-between">
                                    <div>
                                        <span className="text-[11px] text-stone-400 font-bold uppercase block mb-1">
                                            {selectedYear === currentYear ? 'Mevcut Stok' : `${selectedYear} Stoku`}
                                        </span>
                                        <span className={`${getYearlyItemQuantity(selectedDetailItem, selectedYear) <= 0 ? 'text-red-400' : 'text-emerald-400'} font-black text-xl font-mono`}>
                                            {getYearlyItemQuantity(selectedDetailItem, selectedYear)} <span className="text-xs text-stone-400 font-sans">{selectedDetailItem.unit}</span>
                                        </span>
                                    </div>
                                    <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-stone-400">
                                        <span className="flex items-center gap-1"><Truck size={11} /> Giriş:</span>
                                        <strong className="text-stone-200 font-mono">{getTotalIncomingQuantity(selectedDetailItem, selectedYear)} {selectedDetailItem.unit}</strong>
                                    </div>
                                </div>

                                <div className="bg-stone-950/60 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-center">
                                    <span className="text-[11px] text-stone-400 font-bold uppercase block mb-1">Vadeli Alış</span>
                                    <span className="text-stone-200 font-black text-lg font-mono">
                                        {hideCost ? '••••' : formatCurrency(selectedDetailItem.buyingPrice, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>

                                <div className="bg-stone-950/60 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-center">
                                    <span className="text-[11px] text-stone-400 font-bold uppercase block mb-1">Vadeli Satış</span>
                                    <span className="text-amber-400 font-black text-lg font-mono">
                                        {formatCurrency(selectedDetailItem.sellingPrice, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>

                                <div className="bg-stone-950/60 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-center">
                                    <span className="text-[11px] text-stone-400 font-bold uppercase block mb-1">Peşin Alış</span>
                                    <span className="text-stone-200 font-black text-lg font-mono">
                                        {hideCost ? '••••' : formatCurrency(selectedDetailItem.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>

                                <div className="bg-stone-950/60 p-3.5 rounded-2xl border border-white/10 flex flex-col justify-center">
                                    <span className="text-[11px] text-stone-400 font-bold uppercase block mb-1">Peşin Satış</span>
                                    <span className="text-sky-400 font-black text-lg font-mono">
                                        {formatCurrency((selectedDetailItem.cashPrice || 0), userProfile?.currency || 'TRY')}
                                    </span>
                                </div>

                                <div className="grid grid-rows-2 gap-2">
                                    <button 
                                        onClick={() => generateItemReport(selectedDetailItem)} 
                                        className="bg-stone-950/60 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-stone-300 hover:text-sky-400 hover:bg-stone-900 transition-colors px-3 py-2 min-h-[42px]"
                                    >
                                        <Download size={14} className="shrink-0" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider">Detaylı Rapor</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setQuickStockQuantity('');
                                            setIsQuickStockModalOpen(true);
                                        }} 
                                        className="bg-emerald-600/15 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-600/25 transition-colors px-3 py-2 min-h-[42px]"
                                    >
                                        <Plus size={15} className="shrink-0" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider">Stok Ekle</span>
                                    </button>
                                </div>
                            </div>

                            {/* 2-Column Balanced Desktop & Web Operations Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                {/* Left Column (6 cols): Onaylı Stok Sayımı + FEFO Partiler */}
                                <div className="lg:col-span-6 space-y-5">
                                    {/* Onaylı Stok Sayımı Sistemi */}
                                    <div className="bg-stone-950/45 p-5 rounded-3xl border border-emerald-500/20 space-y-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                                <ClipboardCheck size={16} className="text-emerald-500 shrink-0" /> Onaylı Stok Sayımı
                                            </h4>
                                            <span className="text-xs font-bold text-stone-300">
                                                Mevcut Stok: <strong className="text-emerald-400 font-mono">{getYearlyItemQuantity(selectedDetailItem, selectedYear)} {selectedDetailItem.unit}</strong>
                                            </span>
                                        </div>

                                        {canEditInventory && (
                                            <div className="bg-stone-950/75 p-4 rounded-2xl border border-white/10 space-y-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1.5">
                                                            Sayılan Fiziki Adet ({selectedDetailItem.unit})
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={auditCountInput}
                                                            onChange={(e) => setAuditCountInput(e.target.value)}
                                                            placeholder={String(selectedDetailItem.quantity)}
                                                            className="w-full min-h-[44px] bg-stone-900 border border-stone-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-mono font-black text-white outline-none transition-colors"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-300 uppercase mb-1.5">
                                                            Sayım Notu (İsteğe Bağlı)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={auditNoteInput}
                                                            onChange={(e) => setAuditNoteInput(e.target.value)}
                                                            placeholder="Örn: Sezon başı raf sayımı"
                                                            className="w-full min-h-[44px] bg-stone-900 border border-stone-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-stone-200 outline-none transition-colors"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={isSaving || selectedYear !== currentYear}
                                                    onClick={handleAuditItem}
                                                    className="w-full min-h-[44px] py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 active:scale-[0.99]"
                                                >
                                                    <ClipboardCheck size={16} />
                                                    Stok Sayımını Onayla
                                                </button>
                                                {selectedYear !== currentYear && (
                                                    <p className="text-[11px] font-bold text-amber-400/90 text-center">
                                                        Geçmiş yıl ({selectedYear}) görüntüleniyor. Sayım yalnız {currentYear} yılında onaylanabilir.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-2 pt-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-black text-stone-300 uppercase tracking-wider">
                                                    Onaylanan Sayım Kayıtları
                                                </span>
                                                <span className="text-[11px] font-mono text-stone-400">
                                                    {(selectedDetailItem.auditHistory?.length || (selectedDetailItem.lastAuditDate ? 1 : 0))} Kayıt
                                                </span>
                                            </div>

                                            {(selectedDetailItem.auditHistory && selectedDetailItem.auditHistory.length > 0) ? (
                                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                                    {selectedDetailItem.auditHistory.map((rec) => (
                                                        <div
                                                            key={rec.id}
                                                            className="bg-stone-950/70 px-4 py-3 rounded-2xl border border-emerald-500/15 flex items-center justify-between gap-3"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-stone-200">
                                                                    <Calendar size={12} className="text-emerald-400 shrink-0" />
                                                                    <span>
                                                                        {new Date(rec.date).toLocaleDateString('tr-TR', {
                                                                            day: '2-digit',
                                                                            month: '2-digit',
                                                                            year: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                {(rec.approvedBy || rec.note) && (
                                                                    <p className="text-[11px] text-stone-400 mt-0.5 truncate">
                                                                        {rec.approvedBy ? `${rec.approvedBy}` : ''}
                                                                        {rec.approvedBy && rec.note ? ' • ' : ''}
                                                                        {rec.note || ''}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="text-sm font-black font-mono text-emerald-400">
                                                                    {rec.countedQuantity} {rec.unit || selectedDetailItem.unit}
                                                                </div>
                                                                {rec.previousQuantity !== undefined && rec.previousQuantity !== rec.countedQuantity && (
                                                                    <div className="text-[11px] font-mono text-stone-400">
                                                                        Önceki: {rec.previousQuantity} {rec.unit || selectedDetailItem.unit}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : selectedDetailItem.lastAuditDate ? (
                                                <div className="bg-stone-950/70 px-4 py-3 rounded-2xl border border-emerald-500/15 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-stone-200">
                                                        <Calendar size={12} className="text-emerald-400 shrink-0" />
                                                        <span>
                                                            {new Date(selectedDetailItem.lastAuditDate).toLocaleDateString('tr-TR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-black font-mono text-emerald-400">
                                                        {selectedDetailItem.quantity} {selectedDetailItem.unit}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-5 bg-stone-950/50 rounded-2xl border border-dashed border-stone-800">
                                                    <p className="text-xs text-stone-300 font-medium">Henüz onaylanmış bir stok sayımı bulunmuyor.</p>
                                                    <p className="text-[11px] text-stone-400 mt-1">Sayım onaylandığında sayım tarihi ve sayılan adet burada listelenir.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* B-03/B-04: Parti (Lot / SKT / Seri) dökümü */}
                                    {getItemBatches(selectedDetailItem).length > 0 && (
                                        <div className="bg-stone-950/45 p-5 rounded-3xl border border-white/10 space-y-2.5">
                                            <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-2">
                                                <Layers size={15} /> Partiler (FEFO — En Yakın SKT Üstte)
                                            </h4>
                                            {getItemBatches(selectedDetailItem)
                                                .slice()
                                                .sort((a, b) => String(a.expiryDate || '9999').localeCompare(String(b.expiryDate || '9999')))
                                                .map((b, i) => {
                                                    const d = daysUntilExpiry(b.expiryDate);
                                                    return (
                                                        <div key={`${b.lotNumber}-${b.expiryDate || ''}-${i}`} className="flex items-center justify-between gap-2 bg-stone-950/70 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs">
                                                            <span className="font-mono text-stone-200 truncate">Lot: {b.lotNumber || '—'}</span>
                                                            <span className={`font-mono ${d === null ? 'text-stone-400' : d < 0 ? 'text-red-400 font-black' : d <= 30 ? 'text-amber-400' : 'text-stone-300'}`}>
                                                                {b.expiryDate ? `SKT ${b.expiryDate}${d !== null && d < 0 ? ' (GEÇMİŞ)' : ''}` : 'SKT —'}
                                                            </span>
                                                            <span className="font-mono font-black text-emerald-400 shrink-0">
                                                                {round2(Number(b.quantity) || 0)} {selectedDetailItem.unit}
                                                                {b.serialNumbers?.length ? <span className="text-stone-400 font-normal"> • {b.serialNumbers.length} seri</span> : null}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>

                                {/* Right Column (6 cols): Emanet (Konsinye) + Karantina */}
                                <div className="lg:col-span-6 space-y-5">
                                    {/* Emanet (Konsinye) Stok Takibi (#22) */}
                                    <div className="bg-indigo-950/20 p-5 rounded-3xl border border-indigo-500/20 space-y-3.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                                                <Truck size={15} className="text-indigo-400 shrink-0" /> Emanet (Konsinye) Stok Takibi
                                            </h4>
                                            <span className="text-[11px] font-black font-mono text-indigo-300 bg-indigo-500/15 px-3 py-1 rounded-full border border-indigo-500/30 shrink-0">
                                                Emanet: {selectedDetailItem.consignmentQty || 0} {selectedDetailItem.unit}
                                            </span>
                                        </div>
                                        {canEditInventory && (
                                            <div className="bg-stone-950/65 p-4 rounded-2xl border border-white/10 space-y-3">
                                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                                    <select
                                                        value={consignType}
                                                        onChange={(e) => setConsignType(e.target.value as any)}
                                                        className="sm:col-span-4 min-h-[42px] bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs font-bold text-stone-200 outline-none"
                                                    >
                                                        <option value="GIVEN">📤 Emanet Verildi</option>
                                                        <option value="TAKEN">📥 Emanet Alındı</option>
                                                        <option value="RETURNED">🔄 İade Döndü</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        value={consignParty}
                                                        onChange={(e) => setConsignParty(e.target.value)}
                                                        placeholder="Bayi / Üretici / Tedarikçi adı"
                                                        className="sm:col-span-5 min-h-[42px] bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 outline-none"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={consignQty}
                                                        onChange={(e) => setConsignQty(e.target.value)}
                                                        placeholder={`Miktar (${selectedDetailItem.unit})`}
                                                        className="sm:col-span-3 min-h-[42px] bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs font-mono text-stone-200 outline-none"
                                                    />
                                                </div>
                                                <div className="flex gap-2.5">
                                                    <input
                                                        type="text"
                                                        value={consignNote}
                                                        onChange={(e) => setConsignNote(e.target.value)}
                                                        placeholder="Not (opsiyonel)"
                                                        className="flex-1 min-h-[42px] bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={isSaving}
                                                        onClick={handleAddConsignment}
                                                        className="min-h-[42px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition-all disabled:opacity-50 shrink-0"
                                                    >
                                                        Kaydet
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {(selectedDetailItem.consignmentLogs && selectedDetailItem.consignmentLogs.length > 0) && (
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                {selectedDetailItem.consignmentLogs.map(log => (
                                                    <div key={log.id} className="bg-stone-950/65 px-3.5 py-2.5 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                                        <div>
                                                            <span className="font-bold text-stone-200">{log.partyName}</span>
                                                            <span className="text-[11px] text-indigo-300 ml-2 uppercase font-bold">
                                                                {log.type === 'GIVEN' ? 'Emanet Verildi' : log.type === 'TAKEN' ? 'Emanet Alındı' : 'İade Döndü'}
                                                            </span>
                                                            <div className="text-[11px] text-stone-400">
                                                                {new Date(log.date).toLocaleDateString('tr-TR')}{log.note ? ` • ${log.note}` : ''}
                                                            </div>
                                                        </div>
                                                        <span className="font-mono font-black text-indigo-300">{log.quantity} {selectedDetailItem.unit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* İade Karantina & Lot Yönetimi (#23) */}
                                    <div className="bg-rose-950/20 p-5 rounded-3xl border border-rose-500/20 space-y-3.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-2">
                                                <AlertCircle size={15} className="text-rose-400 shrink-0" /> İade & Hasarlı Ürün Karantinası
                                            </h4>
                                            <span className="text-[11px] font-black font-mono text-rose-300 bg-rose-500/15 px-3 py-1 rounded-full border border-rose-500/30 shrink-0">
                                                Karantina: {selectedDetailItem.quarantineQty || 0} {selectedDetailItem.unit}
                                            </span>
                                        </div>
                                        {canEditInventory && (
                                            <div className="bg-stone-950/65 p-4 rounded-2xl border border-white/10 space-y-2.5">
                                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={quarantineAddQty}
                                                        onChange={(e) => setQuarantineAddQty(e.target.value)}
                                                        placeholder={`Miktar (${selectedDetailItem.unit})`}
                                                        className="sm:col-span-4 min-h-[42px] bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs font-mono text-stone-200 outline-none"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={quarantineReasonInput}
                                                        onChange={(e) => setQuarantineReasonInput(e.target.value)}
                                                        placeholder="Karantina sebebi (Örn: Ambalaj sızıntısı, SKT şüpheli iade)"
                                                        className="sm:col-span-8 min-h-[42px] bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 outline-none"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={handleAddQuarantine}
                                                    className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black whitespace-nowrap disabled:opacity-50 transition-colors"
                                                >
                                                    Karantinaya Ayır
                                                </button>
                                            </div>
                                        )}
                                        {(selectedDetailItem.quarantineLogs && selectedDetailItem.quarantineLogs.length > 0) && (
                                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                                {selectedDetailItem.quarantineLogs.map(q => (
                                                    <div key={q.id} className="bg-stone-950/65 px-3.5 py-2.5 rounded-xl border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                        <div>
                                                            <div className="font-bold text-stone-200">
                                                                {q.quantity} {selectedDetailItem.unit} — <span className="text-rose-300">{q.reason}</span>
                                                            </div>
                                                            <div className="text-[11px] text-stone-400">
                                                                {new Date(q.date).toLocaleDateString('tr-TR')}
                                                                {q.farmerName ? ` • ${q.farmerName}` : ''}
                                                                {q.lotNumber ? ` • Lot: ${q.lotNumber}` : ''}
                                                            </div>
                                                        </div>
                                                        {q.resolved ? (
                                                            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">Çözümlendi</span>
                                                        ) : canEditInventory && (
                                                            <div className="flex gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResolveQuarantine(q.id, 'RESTORE_TO_STOCK')}
                                                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-bold border border-emerald-500/30"
                                                                >
                                                                    Sağlam Stoğa Al
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResolveQuarantine(q.id, 'DISPOSE')}
                                                                    className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-bold border border-white/10"
                                                                >
                                                                    İmha / İade Kapat
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {canEditInventory && (
                            <div className="px-6 py-4 border-t border-white/10 bg-stone-950/60 shrink-0 flex justify-end">
                                <button 
                                    onClick={() => {
                                        closeModal();
                                        openEditModal(selectedDetailItem);
                                    }}
                                    className="w-full sm:w-auto min-w-[240px] px-6 py-3 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/10"
                                >
                                    <Edit2 size={16} />
                                    Stok Bilgilerini Düzenle
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <InventoryQuickStockModal
                isOpen={isQuickStockModalOpen}
                selectedDetailItem={selectedDetailItem}
                quickStockQuantity={quickStockQuantity}
                setQuickStockQuantity={setQuickStockQuantity}
                onClose={() => setIsQuickStockModalOpen(false)}
                onConfirm={handleQuickStockAdd}
            />

            <InventoryEditAdjustmentModal
                isOpen={isEditAdjustmentModalOpen}
                selectedDetailItem={selectedDetailItem}
                editingAdjustmentIdx={editingAdjustmentIdx}
                editingAdjustmentAmount={editingAdjustmentAmount}
                setEditingAdjustmentAmount={setEditingAdjustmentAmount}
                onClose={() => setIsEditAdjustmentModalOpen(false)}
                onDelete={handleDeleteAdjustment}
                onUpdate={handleUpdateAdjustment}
            />

            {isScanning && (
                <LazyBarcodeScanner 
                    onScan={(code, meta) => {
                        const parsed = parseGS1Barcode(code, meta?.format);
                        // B-05 / B-22: canonical GTIN in `barcode`, Lot/SKT/Seri reset per scan, errors shown in the form.
                        setFormData(prev => applyScanToInventoryForm(prev, parsed));
                        setLastFormScan({ parsed, ts: Date.now() });
                        // Pre-select the library product when the scanned GTIN is already known.
                        if (isAddModalOpen && !selectedPesticide) {
                            const knownInv = findItemByScan(inventory, parsed);
                            const knownPest = knownInv
                                ? pesticides.find(p => p.id === knownInv.pesticideId)
                                : findItemByScan(pesticides, parsed);
                            if (knownPest) {
                                setSelectedPesticide(knownPest);
                                setProductName(knownPest.name);
                            }
                        }
                        setIsScanning(false);
                        const issues = getScanIssues(parsed);
                        if (issues.errors.length > 0) {
                            playErrorBeep();
                            showToast(`Barkod hatalı: ${issues.errors[0]}`, 'error');
                        } else {
                            playScanBeep();
                            showToast(parsed.type === 'GS1_DATAMATRIX' ? 'GS1 2D Karekod (GTIN/Lot/SKT) çözümlendi!' : 'Barkod tarandı', issues.warnings.length > 0 ? 'info' : 'success');
                        }
                    }}
                    onClose={() => setIsScanning(false)}
                />
            )}

            <InventoryBatchPriceModal
                isOpen={isPriceUpdateModalOpen}
                inventory={inventory}
                priceUpdateItems={priceUpdateItems}
                setPriceUpdateItems={setPriceUpdateItems}
                priceUpdateSearch={priceUpdateSearch}
                setPriceUpdateSearch={setPriceUpdateSearch}
                isSaving={isSaving}
                onClose={() => setIsPriceUpdateModalOpen(false)}
                onSave={handleBatchPriceUpdate}
            />

            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />

            <InventoryRebuildModal
                isOpen={isRebuildModalOpen}
                rebuildState={rebuildState}
                mismatches={mismatches}
                setMismatches={setMismatches}
                selectedMismatches={selectedMismatches}
                setSelectedMismatches={setSelectedMismatches}
                rebuildSearchTerm={rebuildSearchTerm}
                setRebuildSearchTerm={setRebuildSearchTerm}
                onClose={() => {
                    setIsRebuildModalOpen(false);
                    setRebuildState('IDLE');
                    setRebuildSearchTerm('');
                }}
                onFullRebuild={handleFullRebuild}
                onRepairSelected={handleRepairInventory}
            />

            <InventoryOcrInvoiceModal
                isOpen={isOcrInvoiceOpen}
                isOcrBusy={isOcrBusy}
                ocrRows={ocrRows}
                setOcrRows={setOcrRows}
                suppliers={suppliers}
                ocrSupplierId={ocrSupplierId}
                setOcrSupplierId={setOcrSupplierId}
                ocrInvoiceNo={ocrInvoiceNo}
                setOcrInvoiceNo={setOcrInvoiceNo}
                isSaving={isSaving}
                onClose={() => setIsOcrInvoiceOpen(false)}
                onPhotoSelect={handleInvoicePhoto}
                onAddRows={addOcrRowsToInventory}
            />

            <SmartOrderModal 
                isOpen={isSmartOrderModalOpen}
                onClose={() => setIsSmartOrderModalOpen(false)}
                inventory={inventory}
                suppliers={suppliers}
                supplierPurchases={supplierPurchases}
                prescriptions={prescriptions}
                showToast={showToast}
            />

        </div>
    );
};

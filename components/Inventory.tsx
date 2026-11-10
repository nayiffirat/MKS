import { createMultiPagePdf } from '../utils/pdfHelper';
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Plus, Package, DollarSign, TrendingUp, 
    Trash2, Edit2, Save, X, AlertCircle, Filter,
    ArrowUpRight, ArrowDownRight, BarChart3, PieChart, FlaskConical,
    History, User, Calendar, List, Download, Eye, EyeOff, Camera, Barcode, Truck, RefreshCw, ChevronRight, ClipboardCheck, ArrowRight, ShoppingCart, Share2
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { dbService } from '../services/db';
import { auth } from '../services/firebase';
import { InventoryItem, Pesticide, PesticideCategory } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';
import { PesticideOCRScanner } from './PesticideOCRScanner';
import { SmartOrderModal } from './SmartOrderModal';

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
    
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'LIST' | 'ANALYSIS' | 'PROFIT_LOSS'>('LIST');
    
    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

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
            if (p.date) {
                const year = new Date(p.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        }).forEach(p => {
            const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
            if (item) {
                const supplier = suppliers.find(s => s.id === p.supplierId);
                const supplierName = supplier ? supplier.name : 'Bilinmeyen Tedarikçi';
                const qtyStr = String(item.quantity || '0').replace(',', '.');
                const parsedQty = parseFloat(qtyStr) || 0;
                
                const isSale = p.type === 'SALE' || p.note?.includes('SATIŞ');
                const isReturn = p.type === 'RETURN' || (p.note?.includes('İADE') && !isSale);
                const effectiveQty = Math.abs(parsedQty);

                history.push({
                    id: p.id,
                    targetId: p.supplierId,
                    name: supplierName,
                    date: p.date,
                    price: item.buyingPrice || 0,
                    quantity: effectiveQty.toString(),
                    isReturn: Boolean(isReturn),
                    isSupplierSale: Boolean(isSale),
                    type: isSale ? 'SALE' : 'PURCHASE'
                });
            }
        });
        
        setPurchaseHistory(history);
    }, [selectedDetailItem, supplierPurchases, suppliers, selectedYear]);

    const [isScanning, setIsScanning] = useState(false);
    
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
    const [formData, setFormData] = useState({
        quantity: '',
        unit: 'Adet',
        buyingPrice: '',
        cashBuyingPrice: '',
        sellingPrice: '',
        cashPrice: '',
        lowStockThreshold: '',
        barcode: '',
        category: PesticideCategory.OTHER
    });

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

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.pesticideName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) || 
                                (item.barcode && item.barcode.includes(searchTerm));
            const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
            
            let matchesStock = true;
            if (stockFilter === 'OUT_OF_STOCK') matchesStock = item.quantity <= 0;
            else if (stockFilter === 'IN_STOCK') matchesStock = item.quantity > 0;
            
            return matchesSearch && matchesCategory && matchesStock;
        });
    }, [inventory, searchTerm, categoryFilter, stockFilter]);

    const purchasedQuantityMap = useMemo(() => {
        const map = new Map<string, number>();
        supplierPurchases.filter(p => {
            if (p.deletedAt) return false;
            if (p.date) {
                const year = new Date(p.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        }).forEach(purchase => {
            purchase.items.forEach(item => {
                const qtyStr = String(item.quantity || '0').replace(',', '.');
                const qty = parseFloat(qtyStr) || 0;
                if (isNaN(qty) || qty === 0) return;

                const isSale = purchase.type === 'SALE' || purchase.note?.includes('SATIŞ');
                const isReturn = purchase.type === 'RETURN' || (purchase.note?.includes('İADE') && !isSale);
                const isReturnOrSale = isSale || isReturn || qty < 0;
                const effectiveQty = isReturnOrSale ? -Math.abs(qty) : Math.abs(qty);

                const current = map.get(item.pesticideId) || 0;
                map.set(item.pesticideId, current + effectiveQty);
            });
        });
        return map;
    }, [supplierPurchases, selectedYear]);

    const getYearlyItemQuantity = (item: InventoryItem, year: number) => {
        if (year === currentYear) return item.quantity;
        const purchased = purchasedQuantityMap.get(item.pesticideId) || 0;
        const sold = prescriptions.filter(p => !p.deletedAt && p.date && new Date(p.date).getFullYear() === year)
            .reduce((acc, p) => {
                const isReturn = p.type === 'RETURN';
                const found = p.items.find(i => i.pesticideId === item.pesticideId);
                const qty = found ? (parseFloat(String(found.quantity || '0').replace(',', '.')) || 0) : 0;
                return isReturn ? acc - qty : acc + qty;
            }, 0);
        const adj = (item.adjustments || [])
            .filter(a => a.date && new Date(a.date).getFullYear() === year)
            .reduce((acc, a) => acc + (a.amount || 0), 0);
        const yearNet = purchased - sold + adj;
        return (purchased > 0 || sold > 0 || adj !== 0) ? yearNet : item.quantity;
    };

    const filteredPesticides = useMemo(() => {
        if (!productName || selectedPesticide) return [];
        return pesticides.filter(p => 
            p.name.toLocaleLowerCase('tr-TR').includes(productName.toLocaleLowerCase('tr-TR')) || 
            (p.barcode && p.barcode.includes(productName))
        ).slice(0, 20);
    }, [pesticides, productName, selectedPesticide]);

    const handleAddItem = async () => {
        if (!productName.trim()) {
            showToast('Lütfen ürün adı giriniz', 'error');
            return;
        }
        
        setIsSaving(true);
        try {
            let finalPesticideId = '';
            let finalPesticideName = productName.trim();
            let finalCategory = formData.category;

            const existingPest = selectedPesticide || pesticides.find(p => p.name.toLocaleLowerCase('tr-TR') === finalPesticideName.toLocaleLowerCase('tr-TR'));
            
            if (existingPest) {
                finalPesticideId = existingPest.id;
                finalPesticideName = existingPest.name;
                finalCategory = existingPest.category;
            } else {
                finalPesticideId = crypto.randomUUID();
                const newPest: Pesticide = {
                    id: finalPesticideId,
                    name: finalPesticideName,
                    activeIngredient: 'Belirtilmedi',
                    defaultDosage: '100ml/100L',
                    category: finalCategory,
                    description: 'Depo eklemesi ile otomatik eklendi.'
                };
                await dbService.addGlobalPesticide(newPest);
                setPesticides(prev => [...prev, newPest]);
            }

            const _parseFloatSafe = (val: string | number) => {
                const parsed = parseFloat(String(val).replace(',', '.'));
                return isNaN(parsed) ? 0 : parsed;
            };

            const addQty = _parseFloatSafe(formData.quantity);
            const buyingPrice = _parseFloatSafe(formData.buyingPrice);
            
            const stringValCB = String(formData.cashBuyingPrice).trim();
            const cashBuyingPrice = stringValCB !== '' ? _parseFloatSafe(stringValCB) : buyingPrice;
            
            const sellingPrice = _parseFloatSafe(formData.sellingPrice);
            
            const stringValCP = String(formData.cashPrice).trim();
            const cashPrice = stringValCP !== '' ? _parseFloatSafe(stringValCP) : sellingPrice;

            const stringValThreshold = String(formData.lowStockThreshold || '').trim();

            const inventoryExisting = inventory.find(i => i.pesticideId === finalPesticideId);
            
            if (inventoryExisting) {
                const newTotalQty = inventoryExisting.quantity + addQty;
                const updatedItem: InventoryItem = {
                    ...inventoryExisting,
                    quantity: newTotalQty,
                    unit: formData.unit || inventoryExisting.unit,
                    buyingPrice: buyingPrice !== 0 ? buyingPrice : inventoryExisting.buyingPrice,
                    cashBuyingPrice: cashBuyingPrice !== 0 ? cashBuyingPrice : inventoryExisting.cashBuyingPrice,
                    sellingPrice: sellingPrice !== 0 ? sellingPrice : inventoryExisting.sellingPrice,
                    cashPrice: cashPrice !== 0 ? cashPrice : inventoryExisting.cashPrice,
                    barcode: formData.barcode || inventoryExisting.barcode,
                    lastUpdated: new Date().toISOString(),
                    lowStockThreshold: stringValThreshold !== '' ? _parseFloatSafe(stringValThreshold) : inventoryExisting.lowStockThreshold
                };

                if (addQty !== 0) {
                    updatedItem.adjustments = [
                        ...(updatedItem.adjustments || []),
                        {
                            date: new Date().toISOString(),
                            amount: addQty,
                            note: 'Manuel Stok Girişi'
                        }
                    ];
                }

                await updateInventoryItem(updatedItem);
                showToast('Ürün depoda mevcuttu. Var olan ürünün üzerine miktar başarıyla eklendi.', 'success');
                hapticFeedback('success');
                closeModal();
                return;
            }

            const newItem: InventoryItem = {
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
                barcode: formData.barcode,
                lastUpdated: new Date().toISOString(),
                lowStockThreshold: _parseFloatSafe(formData.lowStockThreshold)
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
        if (!selectedItem) return;

        setIsSaving(true);
        try {
            const _parseFloatSafe = (val: string | number) => {
                const parsed = parseFloat(String(val).replace(',', '.'));
                return isNaN(parsed) ? 0 : parsed;
            };

            const newTotalQty = _parseFloatSafe(formData.quantity);
            const qtyDiff = newTotalQty - selectedItem.quantity;

            const buyingPrice = _parseFloatSafe(formData.buyingPrice);
            
            const stringValCB = String(formData.cashBuyingPrice).trim();
            const cashBuyingPrice = stringValCB !== '' ? _parseFloatSafe(stringValCB) : buyingPrice;
            
            const sellingPrice = _parseFloatSafe(formData.sellingPrice);
            
            const stringValCP = String(formData.cashPrice).trim();
            const cashPrice = stringValCP !== '' ? _parseFloatSafe(stringValCP) : sellingPrice;

            const stringValThreshold = String(formData.lowStockThreshold || '').trim();

            const updatedItem: InventoryItem = {
                ...selectedItem,
                pesticideName: productName.trim() || selectedItem.pesticideName,
                category: formData.category || selectedItem.category,
                quantity: newTotalQty,
                unit: formData.unit,
                buyingPrice: buyingPrice,
                cashBuyingPrice: cashBuyingPrice,
                sellingPrice: sellingPrice,
                cashPrice: cashPrice,
                barcode: formData.barcode,
                lastUpdated: new Date().toISOString(),
                lowStockThreshold: stringValThreshold !== '' ? _parseFloatSafe(stringValThreshold) : 0
            };

            // Log manual adjustment
            if (qtyDiff !== 0) {
                updatedItem.adjustments = [
                    ...(updatedItem.adjustments || []),
                    {
                        date: new Date().toISOString(),
                        amount: qtyDiff,
                        note: 'Manuel Stok Düzeltmesi'
                    }
                ];
            }
            
            await updateInventoryItem(updatedItem);

            // Sync with global pesticides if possible
            const currentPest = pesticides.find(p => p.id === updatedItem.pesticideId);
            if (currentPest && (currentPest.name !== updatedItem.pesticideName || currentPest.category !== updatedItem.category || currentPest.barcode !== updatedItem.barcode)) {
                await dbService.updateGlobalPesticide({
                    ...currentPest,
                    name: updatedItem.pesticideName,
                    category: updatedItem.category,
                    barcode: updatedItem.barcode
                });
                // Update local state
                setPesticides(prev => prev.map(p => p.id === currentPest.id ? { ...p, name: updatedItem.pesticideName, category: updatedItem.category, barcode: updatedItem.barcode } : p));
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

    const handleAuditItem = async () => {
        if (!selectedDetailItem) return;
        
        const updated = {
            ...selectedDetailItem,
            lastAuditDate: new Date().toISOString()
        };
        
        setIsSaving(true);
        try {
            await updateInventoryItem(updated);
            setSelectedDetailItem(updated);
            showToast('Stok sayımı onaylandı ve denetlendi olarak işaretlendi.', 'success');
            hapticFeedback('success');
        } catch (error) {
            showToast('Hata oluştu', 'error');
        } finally {
            setIsSaving(false);
        }
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
            category: PesticideCategory.OTHER
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
            category: item.category
        });
        setIsEditModalOpen(true);
    };

    const openDetailModal = (item: InventoryItem) => {
        setSelectedDetailItem(item);
        setHistorySearchQuery('');
        setHistoryTypeFilter('ALL');
        setIsDetailModalOpen(true);
        hapticFeedback('light');
    };

    const handleQuickStockAdd = async () => {
        if (!selectedDetailItem) return;
        const addQty = parseFloat(quickStockQuantity.replace(',', '.')) || 0;
        if (addQty <= 0) {
            showToast('Lütfen geçerli bir miktar giriniz', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const updatedItem: InventoryItem = {
                ...selectedDetailItem,
                quantity: selectedDetailItem.quantity + addQty,
                lastUpdated: new Date().toISOString(),
                adjustments: [
                    ...(selectedDetailItem.adjustments || []),
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

            const canvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(container);
            
            const pdf = createMultiPagePdf(canvas);
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

            const canvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false
            });

            document.body.removeChild(container);
            
            const pdf = createMultiPagePdf(canvas);
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
            if (p.date) {
                const year = new Date(p.date).getFullYear();
                if (!isNaN(year) && year !== selectedYear) return false;
            }
            return true;
        }).forEach(p => {
            const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
            if (item) {
                const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
                const isReturn = p.type === 'RETURN';
                const qtyMultiplier = isReturn ? 1 : -1;
                const impact = qty * qtyMultiplier;
                history.push({
                    id: p.id,
                    targetId: p.farmerId,
                    name: farmerMap[p.farmerId] || `Bilinmeyen ${farmerLabel}`,
                    date: p.date,
                    price: item.unitPrice || 0,
                    quantity: Math.abs(qty).toString(),
                    isReturn: impact > 0,
                    type: 'SALE'
                });
            }
        });
        
        return history;
    }, [selectedDetailItem, prescriptions, farmerMap, selectedYear]);

    const combinedHistory = useMemo(() => {
        const adjustmentsHistory = (selectedDetailItem?.adjustments || []).filter(adj => {
            if (adj.date) {
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

        prescriptions.filter(p => !p.deletedAt).forEach(p => {
            const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
            if (item && item.unitPrice) {
                const qtyStr = item.quantity?.toString() || '0';
                const parsedQty = parseFloat(qtyStr.replace(',', '.')) || 0;
                if (!isNaN(parsedQty) && parsedQty !== 0) {
                    const profitPerUnit = item.unitPrice - buyingPrice;
                    totalRealizedProfit += (profitPerUnit * parsedQty);
                    totalSoldQuantity += parsedQty;
                }
            }
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
        const totalCost = inventory.reduce((acc, item) => acc + (item.quantity * item.buyingPrice), 0);
        const totalPotentialRevenue = inventory.reduce((acc, item) => acc + (item.quantity * item.sellingPrice), 0);
        const cashTotalCost = inventory.reduce((acc, item) => acc + (item.quantity * (item.cashBuyingPrice || 0)), 0);
        const cashTotalPotentialRevenue = inventory.reduce((acc, item) => acc + (item.quantity * (item.cashPrice || 0)), 0);
        const potentialProfit = totalPotentialRevenue - totalCost;
        const profitMargin = totalCost > 0 ? (potentialProfit / totalCost) * 100 : 0;
        const cashPotentialProfit = cashTotalPotentialRevenue - cashTotalCost;
        const cashProfitMargin = cashTotalCost > 0 ? (cashPotentialProfit / cashTotalCost) * 100 : 0;

        const categoryDistribution = inventory.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + (item.quantity * item.buyingPrice);
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
            p.items.forEach(item => {
                const qty = parseFloat(String(item.quantity || '0').replace(',', '.'));
                if (qty > 0) {
                    const cost = buyingPriceMap[item.pesticideId] || 0;
                    const revenue = item.unitPrice || 0;
                    
                    totalSoldCost += qty * cost;
                    totalSoldRevenue += qty * revenue;
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20">
                        <Package className="text-emerald-500" size={24} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-2xl font-black text-stone-100 tracking-tight">DEPOM</h1>
                        <div className="flex flex-col">
                            <span className="text-stone-500 text-[8px] font-black uppercase tracking-widest opacity-50">Stok & Maliyet Yönetimi</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                <span className="text-[7px] font-black text-emerald-500 uppercase tracking-[0.2em] animate-in fade-in slide-in-from-left-2 duration-700">Denetimli Stok Sistemi Aktif</span>
                            </div>
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
            <div className="flex gap-1.5 mb-6 bg-stone-900/80 p-1 rounded-2xl border border-white/10 w-fit shadow-inner">
                <button 
                    onClick={() => setActiveTab('LIST')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === 'LIST' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'}`}
                >
                    <Package size={14} /> Stok Listesi
                </button>
                {!isSales && (
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
                                placeholder="Ürün ara..."
                                className="w-full bg-transparent p-2.5 text-stone-200 outline-none text-sm font-medium placeholder-stone-600"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map(item => {
                                const displayQty = getYearlyItemQuantity(item, selectedYear);
                                return (
                                <div 
                                    key={item.id} 
                                    onClick={() => openDetailModal(item)}
                                    className={`bg-stone-900/80 backdrop-blur border rounded-2xl p-4 shadow-sm transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden ${
                                        displayQty <= 0 
                                        ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                                        : 'border-white/5 hover:border-emerald-500/30 hover:bg-stone-900'
                                    }`}
                                >
                                    {/* Stock Badge - High Visibility */}
                                    <div className="absolute top-0 right-0 flex shadow-lg z-10 rounded-bl-2xl overflow-hidden border-b border-l border-white/5">
                                        <div className="px-2 py-1.5 bg-stone-800/90 backdrop-blur-sm text-stone-300 font-black font-mono text-[10px] flex items-center gap-1 border-r border-white/5">
                                            <Truck size={10} />
                                            {purchasedQuantityMap.get(item.pesticideId) || 0} <span className="text-[7px] opacity-70 font-sans uppercase">ALINAN</span>
                                        </div>
                                        <div className={`px-3 py-1.5 font-black font-mono text-xs flex items-center gap-1.5 ${
                                            displayQty <= 0 
                                            ? 'bg-red-500 text-white' 
                                            : (item.lowStockThreshold && displayQty <= item.lowStockThreshold)
                                            ? 'bg-amber-500 text-stone-950 animate-pulse'
                                            : 'bg-emerald-500 text-stone-950'
                                        }`}>
                                            <Package size={12} />
                                            {Number(displayQty).toString()} <span className="text-[8px] opacity-70 font-sans uppercase">KALAN</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-start mb-4 pr-16">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-stone-100 text-sm truncate tracking-tight group-hover:text-emerald-400 transition-colors uppercase">{item.pesticideName}</h3>
                                                {(item.lowStockThreshold && item.quantity > 0 && item.quantity <= item.lowStockThreshold) && (
                                                    <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[8px] font-black text-stone-500 bg-stone-950/50 px-2 py-0.5 rounded-full border border-white/5 uppercase tracking-widest inline-block">
                                                    {item.category}
                                                </span>
                                                {(item.lowStockThreshold && item.quantity > 0 && item.quantity <= item.lowStockThreshold) && (
                                                    <span className="text-[7px] font-black text-amber-500 uppercase tracking-tighter">AZALAN STOK</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {/* Row 1: Peşin */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-stone-950/40 p-2 rounded-xl border border-white/5 group-hover:border-blue-500/20 transition-colors">
                                                <span className="text-[8px] text-stone-500 font-black uppercase block mb-0.5 tracking-wider">Peşin Alış</span>
                                                <span className="text-stone-300 font-black font-mono text-xs">
                                                    {formatCurrency(Math.round(item.cashBuyingPrice || 0), userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                            <div className="bg-stone-950/40 p-2 rounded-xl border border-white/5 group-hover:border-blue-500/20 transition-colors">
                                                <span className="text-[8px] text-stone-500 font-black uppercase block mb-0.5 tracking-wider">Peşin Satış</span>
                                                <span className="text-blue-400 font-black font-mono text-xs">
                                                    {formatCurrency(Math.round(item.cashPrice || 0), userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Row 2: Vadeli */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-stone-950/40 p-2 rounded-xl border border-white/5 group-hover:border-amber-500/20 transition-colors">
                                                <span className="text-[8px] text-stone-500 font-black uppercase block mb-0.5 tracking-wider">Vadeli Alış</span>
                                                <span className="text-stone-300 font-black font-mono text-xs">
                                                    {formatCurrency(Math.round(item.buyingPrice), userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                            <div className="bg-stone-950/40 p-2 rounded-xl border border-white/5 group-hover:border-amber-500/20 transition-colors">
                                                <span className="text-[8px] text-stone-500 font-black uppercase block mb-0.5 tracking-wider">Vadeli Satış</span>
                                                <span className="text-amber-400 font-black font-mono text-xs">
                                                    {formatCurrency(Math.round(item.sellingPrice), userProfile?.currency || 'TRY')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action row at bottom */}
                                    <div className="mt-3 flex justify-end">
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

            {/* Add/Edit Modal */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                            <h3 className="font-bold text-stone-100">
                                {isEditModalOpen ? 'Ürün Düzenle' : 'Depoya Ürün Ekle'}
                            </h3>
                            <button onClick={closeModal} className="text-stone-500 hover:text-stone-300">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Ürün Adı</label>
                                        <PesticideOCRScanner 
                                            onScanSuccess={(data) => {
                                                setProductName(data.productName);
                                                if (Object.values(PesticideCategory).includes(data.category as PesticideCategory)) {
                                                    setFormData(prev => ({ ...prev, category: data.category as PesticideCategory }));
                                                }
                                                // search if it existing
                                                const existingPest = pesticides.find(p => p.name.toLocaleLowerCase('tr-TR') === data.productName.toLocaleLowerCase('tr-TR'));
                                                if (existingPest) {
                                                    setSelectedPesticide(existingPest);
                                                }
                                            }}
                                            onError={(err) => showToast(err, 'error')}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Package className="absolute left-3 top-3 text-stone-500" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Ürün adını giriniz..." 
                                            className={`w-full bg-stone-950 border rounded-xl p-3 pl-10 text-stone-200 text-sm outline-none transition-all ${selectedPesticide ? 'border-emerald-500/50' : 'border-stone-800 focus:border-emerald-500/50'}`}
                                            value={productName}
                                            onChange={(e) => {
                                                setProductName(e.target.value);
                                                if (selectedPesticide) setSelectedPesticide(null);
                                            }}
                                        />
                                        {(isAddModalOpen && selectedPesticide) && (
                                            <button 
                                                onClick={() => {
                                                    setSelectedPesticide(null);
                                                    setProductName('');
                                                }}
                                                className="absolute right-3 top-3 text-stone-500 hover:text-stone-300"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                        
                                        {/* Suggestions Dropdown */}
                                        {isAddModalOpen && filteredPesticides.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-800 rounded-xl shadow-xl max-h-48 overflow-y-auto z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                                                <div className="p-2 border-b border-white/5 bg-stone-950/30">
                                                    <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest px-1">Kayıtlı İlaçlardan Seç</span>
                                                </div>
                                                {filteredPesticides.map(p => (
                                                    <button 
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedPesticide(p);
                                                            setProductName(p.name);
                                                            setFormData(prev => ({ ...prev, category: p.category }));
                                                        }}
                                                        className="w-full text-left p-3 hover:bg-stone-800 border-b border-white/5 last:border-0 flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <div className="font-bold text-stone-200 text-sm group-hover:text-emerald-400 transition-colors">{p.name}</div>
                                                            <div className="text-[10px] text-stone-500">{p.category}</div>
                                                        </div>
                                                        <Plus size={14} className="text-stone-700 group-hover:text-emerald-500" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Kategori</label>
                                    <select 
                                        className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500/50"
                                        value={formData.category}
                                        onChange={(e) => setFormData({...formData, category: e.target.value as PesticideCategory})}
                                    >
                                        {Object.values(PesticideCategory).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Stok Miktarı</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Birim</label>
                                    <select 
                                        className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-stone-200 text-sm outline-none focus:border-emerald-500/50"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({...formData, unit: e.target.value})}
                                    >
                                        <option value="Adet">Adet</option>
                                        <option value="Litre">Litre</option>
                                        <option value="Kg">Kg</option>
                                        <option value="Kutu">Kutu</option>
                                        <option value="Çuval">Çuval</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Vadeli Alış ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                        <input 
                                            type="number" 
                                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                            value={formData.buyingPrice}
                                            onChange={(e) => setFormData({...formData, buyingPrice: e.target.value})}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Peşin Alış ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                        <input 
                                            type="number" 
                                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                            value={formData.cashBuyingPrice}
                                            onChange={(e) => setFormData({...formData, cashBuyingPrice: e.target.value})}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Vadeli Satış ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                        <input 
                                            type="number" 
                                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                            value={formData.sellingPrice}
                                            onChange={(e) => setFormData({...formData, sellingPrice: e.target.value})}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Peşin Satış ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3 text-stone-600" size={14} />
                                        <input 
                                            type="number" 
                                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                            value={formData.cashPrice}
                                            onChange={(e) => setFormData({...formData, cashPrice: e.target.value})}
                                            placeholder={formData.buyingPrice ? `${formData.buyingPrice} (V. Alış)` : "0.00"}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Kritik Stok Seviyesi</label>
                                    <div className="relative">
                                        <AlertCircle className="absolute left-3 top-3 text-stone-600" size={14} />
                                        <input 
                                            type="number" 
                                            className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                            value={formData.lowStockThreshold}
                                            onChange={(e) => setFormData({...formData, lowStockThreshold: e.target.value})}
                                            placeholder="5"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Barkod (Opsiyonel)</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Barcode className="absolute left-3 top-3 text-stone-600" size={14} />
                                            <input 
                                                type="text" 
                                                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 pl-8 text-stone-200 text-sm outline-none focus:border-emerald-500/50 font-mono"
                                                value={formData.barcode}
                                                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                                                placeholder="Barkod girin veya tarayın"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => setIsScanning(true)}
                                            className="bg-stone-800 p-3 rounded-xl border border-white/5 text-stone-300 hover:bg-stone-700 transition-colors"
                                            title="Barkod Tara"
                                        >
                                            <Camera size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Profit Preview */}
                            {(Number(formData.sellingPrice) > 0 && Number(formData.buyingPrice) > 0) && (
                                <div className="bg-stone-950 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                                    <span className="text-xs text-stone-500 font-bold">Birim Kar:</span>
                                    <span className={`text-sm font-black font-mono ${Number(formData.sellingPrice) - Number(formData.buyingPrice) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatCurrency(Number(formData.sellingPrice) - Number(formData.buyingPrice), userProfile?.currency || 'TRY')}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 bg-stone-950/50 flex justify-end gap-3">
                            <button 
                                onClick={closeModal}
                                className="px-4 py-2 rounded-xl text-stone-400 hover:text-stone-200 font-bold text-sm transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={isEditModalOpen ? handleUpdateItem : handleAddItem}
                                disabled={(isAddModalOpen && !productName.trim()) || isSaving}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        {isEditModalOpen ? 'Güncelleniyor...' : 'Kaydediliyor...'}
                                    </>
                                ) : (
                                    isEditModalOpen ? 'Güncelle' : 'Kaydet'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {isDetailModalOpen && selectedDetailItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-start bg-stone-950/50">
                            <div>
                                <h3 className="text-xl font-black text-stone-100 tracking-tight">{selectedDetailItem.pesticideName}</h3>
                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">{selectedDetailItem.category}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {canEditInventory && (
                                    <div className="flex items-center gap-1.5 mr-2 pr-2 border-r border-white/10">
                                        <button 
                                            onClick={() => {
                                                closeModal();
                                                openEditModal(selectedDetailItem);
                                            }} 
                                            className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-emerald-400 transition-colors"
                                            title="Düzenle"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button 
                                            onClick={() => {
                                                handleDeleteItem(selectedDetailItem.id);
                                            }} 
                                            className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-red-400 transition-colors"
                                            title="Sil"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                                <button 
                                    onClick={() => setShowProfitability(!showProfitability)} 
                                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${showProfitability ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-stone-800 text-stone-400 hover:text-stone-200 border border-transparent'}`}
                                >
                                    <TrendingUp size={16} /> Kâr Oranı
                                </button>
                                <button onClick={closeModal} className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-stone-200 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Profitability View */}
                            {showProfitability && profitabilityMetrics && (
                                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp size={14} /> Kârlılık Analizi
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                                            <span className="text-[10px] text-emerald-500/80 font-bold uppercase block mb-1">Kârlılık Oranı</span>
                                            <span className="text-emerald-400 font-black text-2xl font-mono">
                                                %{profitabilityMetrics.profitMargin.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                                            <span className="text-[10px] text-blue-500/80 font-bold uppercase block mb-1">Gerçekleşen Kâr ({profitabilityMetrics.totalSoldQuantity} Satış)</span>
                                            <span className="text-blue-400 font-black text-xl font-mono">
                                                {formatCurrency(profitabilityMetrics.totalRealizedProfit, userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                        <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 col-span-2">
                                            <span className="text-[10px] text-amber-500/80 font-bold uppercase block mb-1">Kalan Stoktan Beklenen Kâr</span>
                                            <span className="text-amber-400 font-black text-xl font-mono">
                                                {formatCurrency(profitabilityMetrics.expectedProfit, userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Stock Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5 space-y-2">
                                    <div>
                                        <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">
                                            {selectedYear === currentYear ? 'Mevcut Stok (Kalan)' : `${selectedYear} Yılı Stok`}
                                        </span>
                                        <span className={`${getYearlyItemQuantity(selectedDetailItem, selectedYear) <= 0 ? 'text-red-400' : 'text-emerald-400'} font-black text-xl`}>
                                            {getYearlyItemQuantity(selectedDetailItem, selectedYear)} <span className="text-xs text-stone-600 font-sans">{selectedDetailItem.unit}</span>
                                        </span>
                                    </div>
                                    <div className="pt-2 border-t border-white/5">
                                        <span className="text-[10px] text-stone-500 font-bold uppercase block mb-0.5">Toplam Alınan (Tedarikçiden)</span>
                                        <span className="text-stone-300 font-black text-lg flex items-center gap-1.5">
                                            <Truck size={12} className="text-stone-500" />
                                            {purchasedQuantityMap.get(selectedDetailItem.pesticideId) || 0} <span className="text-[10px] text-stone-600 font-sans">{selectedDetailItem.unit}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-rows-2 gap-2">
                                    <button 
                                        onClick={() => generateItemReport(selectedDetailItem)} 
                                        className="bg-stone-950/50 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-stone-400 hover:text-blue-400 hover:bg-stone-900 transition-all group p-2 min-h-[60px]"
                                    >
                                        <Download size={16} className="mb-1 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Detaylı Rapor</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setQuickStockQuantity('');
                                            setIsQuickStockModalOpen(true);
                                        }} 
                                        className="bg-emerald-600/10 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center text-emerald-500 hover:text-emerald-400 hover:bg-emerald-600/20 transition-all group p-2 min-h-[60px]"
                                    >
                                        <Plus size={16} className="mb-1 group-hover:scale-110 transition-transform" />
                                        <span className="text-[9px] font-bold uppercase tracking-wider">Stok Ekle</span>
                                    </button>
                                </div>
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Vadeli Alış</span>
                                    <span className="text-stone-300 font-bold text-lg">
                                        {formatCurrency(selectedDetailItem.buyingPrice, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Vadeli Satış</span>
                                    <span className="text-amber-400 font-bold text-lg">
                                        {formatCurrency(selectedDetailItem.sellingPrice, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Peşin Alış</span>
                                    <span className="text-stone-300 font-bold text-lg">
                                        {formatCurrency(selectedDetailItem.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>
                                <div className="bg-stone-950/50 p-4 rounded-2xl border border-white/5">
                                    <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Peşin Satış</span>
                                    <span className="text-blue-400 font-bold text-lg">
                                        {formatCurrency((selectedDetailItem.cashPrice || 0), userProfile?.currency || 'TRY')}
                                    </span>
                                </div>
                            </div>

                            {/* Stock Ledger Summary System */}
                            <div className="bg-stone-900/40 p-5 rounded-[2rem] border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                        <List size={14} className="text-emerald-500" /> Stok Defteri Özeti
                                    </h4>
                                    <span className="text-[9px] font-bold text-emerald-500/60 italic flex items-center gap-1">
                                        <RefreshCw size={10} className="animate-spin-slow" /> Denetimli Sistem
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-stone-500">Toplam Alımlar (+)</span>
                                        <span className="text-emerald-400 font-bold">+{purchasedQuantityMap.get(selectedDetailItem.pesticideId) || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-stone-500">Toplam Satışlar (-)</span>
                                        <span className="text-blue-400 font-bold">-{
                                            prescriptions.filter(p => !p.deletedAt).reduce((acc, p) => {
                                                const isReturn = p.type === 'RETURN';
                                                const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
                                                const qty = item?.quantity ? parseFloat(item.quantity.toString().replace(',', '.')) || 0 : 0;
                                                const qtyMultiplier = isReturn ? 1 : -1;
                                                const impact = qty * qtyMultiplier;
                                                return impact < 0 ? acc + Math.abs(impact) : acc;
                                            }, 0)
                                        }</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-stone-500">Müşteri İadeleri (+)</span>
                                        <span className="text-stone-300 font-bold">+{
                                            prescriptions.filter(p => !p.deletedAt).reduce((acc, p) => {
                                                const isReturn = p.type === 'RETURN';
                                                const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
                                                const qty = item?.quantity ? parseFloat(item.quantity.toString().replace(',', '.')) || 0 : 0;
                                                const qtyMultiplier = isReturn ? 1 : -1;
                                                const impact = qty * qtyMultiplier;
                                                return impact > 0 ? acc + impact : acc;
                                            }, 0)
                                        }</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-stone-500">Manuel Düzeltmeler (±)</span>
                                        <span className={`${(selectedDetailItem.adjustments?.reduce((a: number, b: any) => a + b.amount, 0) || 0) < 0 ? 'text-rose-400' : 'text-amber-400'} font-bold`}>
                                            {(selectedDetailItem.adjustments?.reduce((a: number, b: any) => a + (b.amount || 0), 0) || 0).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-xs font-black text-stone-200">
                                        {selectedYear === currentYear ? 'KAYITLI NET STOK' : `${selectedYear} YILI NET STOK`}
                                    </span>
                                    <span className="text-lg font-black text-emerald-400 font-mono tracking-tighter">
                                        {getYearlyItemQuantity(selectedDetailItem, selectedYear)} <span className="text-xs font-sans text-stone-600">{selectedDetailItem.unit}</span>
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-stone-500 uppercase">Son Denetim</span>
                                    <span className="text-[10px] font-bold text-stone-400">
                                        {selectedDetailItem.lastAuditDate 
                                            ? new Date(selectedDetailItem.lastAuditDate).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                                            : 'Henüz Yapılmadı'}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleAuditItem}
                                    className="w-full mt-2 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
                                >
                                    <ClipboardCheck size={14} className="group-hover:scale-110 transition-transform" />
                                    Stok Sayımını Onayla
                                </button>
                            </div>

                            {/* Combined History */}
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                    <h4 className="text-xs font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                        <History size={14} className="text-blue-500" />
                                        Hareket Geçmişi
                                        <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full font-bold font-mono">
                                            {filteredCombinedHistory.length} / {combinedHistory.length}
                                        </span>
                                    </h4>

                                    {/* Quick Filter Tabs */}
                                    {combinedHistory.length > 0 && (
                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                                            <button
                                                type="button"
                                                onClick={() => setHistoryTypeFilter('ALL')}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                                                    historyTypeFilter === 'ALL'
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                                                }`}
                                            >
                                                Tümü ({combinedHistory.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHistoryTypeFilter('SALE')}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                                                    historyTypeFilter === 'SALE'
                                                        ? 'bg-blue-600 text-white shadow-sm'
                                                        : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                                                }`}
                                            >
                                                Satışlar ({salesCount})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setHistoryTypeFilter('PURCHASE')}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                                                    historyTypeFilter === 'PURCHASE'
                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                        : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                                                }`}
                                            >
                                                Alımlar ({purchaseCount})
                                            </button>
                                            {adjustmentCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setHistoryTypeFilter('ADJUSTMENT')}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                                                        historyTypeFilter === 'ADJUSTMENT'
                                                            ? 'bg-amber-600 text-white shadow-sm'
                                                            : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                                                    }`}
                                                >
                                                    Depom ({adjustmentCount})
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Movement Search Bar */}
                                {combinedHistory.length > 0 && (
                                    <div className="relative mb-3">
                                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={historySearchQuery}
                                            onChange={(e) => setHistorySearchQuery(e.target.value)}
                                            placeholder="Kişi / tedarikçi adı, fiyat, miktar veya tarih ara..."
                                            className="w-full bg-stone-950 border border-stone-800 focus:border-blue-500/50 rounded-xl pl-9 pr-9 py-2.5 text-xs text-stone-200 outline-none transition-all placeholder-stone-600 shadow-inner"
                                        />
                                        {historySearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setHistorySearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 p-0.5 rounded-full hover:bg-stone-800 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                )}
                                
                                <div className="space-y-2">
                                    {filteredCombinedHistory.length > 0 ? (
                                        filteredCombinedHistory.map((record, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => {
                                                    if (record.type === 'SALE' && onNavigateToPrescription) {
                                                        closeModal();
                                                        onNavigateToPrescription(record.id);
                                                    } else if (record.type === 'PURCHASE' && onNavigateToSupplier) {
                                                        closeModal();
                                                        onNavigateToSupplier(record.targetId);
                                                    } else if (record.type === 'ADJUSTMENT') {
                                                        setEditingAdjustmentIdx((record as any).index);
                                                        setEditingAdjustmentAmount(record.isReturn ? `-${record.quantity}` : record.quantity);
                                                        setIsEditAdjustmentModalOpen(true);
                                                    }
                                                }}
                                                className="bg-stone-950/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-stone-800 transition-colors"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                                        record.type === 'SALE' ? ((record as any).isSupplierSale ? 'bg-indigo-500/10 text-indigo-400' : 'bg-stone-900 text-blue-500') : 
                                                        record.type === 'PURCHASE' ? (record.isReturn ? 'bg-rose-500/10 text-rose-400' : 'bg-stone-900 text-emerald-500') :
                                                        'bg-stone-900 text-amber-500'
                                                    }`}>
                                                        {record.type === 'SALE' ? ((record as any).isSupplierSale ? <Truck size={18} /> : <User size={18} />) : 
                                                         record.type === 'PURCHASE' ? <Truck size={18} /> : 
                                                         <AlertCircle size={18} />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-stone-200 flex items-center gap-2">
                                                            {record.name}
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                                                                record.type === 'SALE' ? ((record as any).isSupplierSale ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400') : 
                                                                record.type === 'PURCHASE' ? (record.isReturn ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400') :
                                                                'bg-amber-500/10 text-amber-400'
                                                            }`}>
                                                                {record.type === 'SALE' ? ((record as any).isSupplierSale ? 'TEDARİKÇİYE SATIŞ' : 'SATIŞ') : 
                                                                 record.type === 'PURCHASE' ? (record.isReturn ? 'ALIŞ İADESİ' : 'ALIM') : 
                                                                 'MANUEL DÜZELTME'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-0.5">
                                                            <Calendar size={10} />
                                                            {new Date(record.date).toLocaleDateString('tr-TR')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <div className={`text-sm font-black font-mono ${
                                                            record.type === 'ADJUSTMENT' ? (record.isReturn ? 'text-rose-400' : 'text-amber-400') :
                                                            (record.isReturn ? 'text-rose-400' : (record.type === 'SALE' ? ((record as any).isSupplierSale ? 'text-indigo-400' : 'text-blue-400') : 'text-emerald-400'))
                                                        }`}>
                                                            {record.type === 'ADJUSTMENT' ? (Number(record.quantity) > 0 ? '+' : '') : ((record.isReturn || record.type === 'SALE') ? '-' : '+')}
                                                            {record.type === 'ADJUSTMENT' ? record.quantity : formatCurrency(record.price, userProfile?.currency || 'TRY')}
                                                            {record.type === 'ADJUSTMENT' && ` ${selectedDetailItem.unit}`}
                                                        </div>
                                                        <div className={`text-[10px] font-bold ${record.isReturn ? 'text-rose-500/80' : ((record as any).isSupplierSale ? 'text-indigo-400/80' : 'text-stone-600')}`}>
                                                            {record.type === 'ADJUSTMENT' ? 'Fark' : (record.isReturn ? 'İADE: ' : (record.type === 'SALE' ? 'SATIŞ: ' : 'Miktar: ')) + record.quantity + ' ' + selectedDetailItem.unit}
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                                </div>
                                            </div>
                                        ))
                                    ) : combinedHistory.length > 0 ? (
                                        <div className="text-center py-8 bg-stone-950/40 rounded-2xl border border-dashed border-stone-800 p-6">
                                            <Filter size={22} className="mx-auto text-stone-600 mb-2" />
                                            <p className="text-xs font-bold text-stone-400">Aramanıza Uygun Hareket Bulunamadı</p>
                                            <p className="text-[11px] text-stone-600 mt-1">
                                                {historySearchQuery ? `"${historySearchQuery}" kriteri ile ` : ''}Seçili filtre ile eşleşen işlem yok.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setHistorySearchQuery('');
                                                    setHistoryTypeFilter('ALL');
                                                }}
                                                className="mt-3 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-blue-400 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                                            >
                                                <RefreshCw size={12} />
                                                Filtreleri Temizle
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 bg-stone-950/30 rounded-2xl border border-dashed border-stone-800">
                                            <p className="text-xs text-stone-600">Bu ürün için henüz hiçbir hareket bulunmuyor.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {canEditInventory && (
                            <div className="p-6 border-t border-white/10 bg-stone-950/50">
                                <button 
                                    onClick={() => {
                                        closeModal();
                                        openEditModal(selectedDetailItem);
                                    }}
                                    className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Edit2 size={16} />
                                    Stok Bilgilerini Düzenle
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick Stock Add Modal */}
            {isQuickStockModalOpen && selectedDetailItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-[280px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                            <h3 className="text-xs font-black text-stone-100 uppercase tracking-widest">Hızlı Stok Ekle</h3>
                            <button onClick={() => setIsQuickStockModalOpen(false)} className="text-stone-500 hover:text-stone-300 p-1">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Ürün</p>
                                <p className="text-sm font-black text-emerald-400">{selectedDetailItem.pesticideName}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block text-center">Eklenecek Miktar ({selectedDetailItem.unit})</label>
                                <input 
                                    autoFocus
                                    type="number" 
                                    placeholder="0"
                                    className="w-full bg-stone-950 border border-emerald-500/30 rounded-2xl p-4 text-center text-2xl font-black text-emerald-400 outline-none focus:border-emerald-500 shadow-inner"
                                    value={quickStockQuantity}
                                    onChange={(e) => setQuickStockQuantity(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleQuickStockAdd()}
                                />
                            </div>

                            <button 
                                onClick={handleQuickStockAdd}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-stone-950 rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                DEPOYA EKLE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Adjustment Modal */}
            {isEditAdjustmentModalOpen && selectedDetailItem && editingAdjustmentIdx !== null && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-[280px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                            <h3 className="text-xs font-black text-stone-100 uppercase tracking-widest">Hareketi Düzenle</h3>
                            <button onClick={() => setIsEditAdjustmentModalOpen(false)} className="text-stone-500 hover:text-stone-300 p-1">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Ürün / Hareket</p>
                                <p className="text-sm font-black text-amber-400">{selectedDetailItem.pesticideName}</p>
                                <p className="text-[10px] text-stone-500 mt-1 uppercase">{selectedDetailItem.adjustments?.[editingAdjustmentIdx]?.note || 'Manuel Stok Düzeltme'}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest block text-center">Miktar ({selectedDetailItem.unit})</label>
                                <input 
                                    autoFocus
                                    type="number" 
                                    placeholder="0"
                                    className="w-full bg-stone-950 border border-amber-500/30 rounded-2xl p-4 text-center text-2xl font-black text-amber-400 outline-none focus:border-amber-500 shadow-inner"
                                    value={editingAdjustmentAmount}
                                    onChange={(e) => setEditingAdjustmentAmount(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateAdjustment()}
                                />
                                <p className="text-[9px] text-stone-600 text-center italic">Eksi (-) değerler stoktan düşer.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={handleDeleteAdjustment}
                                    className="py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} />
                                    SİL
                                </button>
                                <button 
                                    onClick={handleUpdateAdjustment}
                                    className="py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-2xl font-bold text-xs shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={14} />
                                    GÜNCELLE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Scanner Modal */}
            {isScanning && (
                <BarcodeScanner 
                    onScan={(code) => {
                        setFormData(prev => ({ ...prev, barcode: code }));
                        setIsScanning(false);
                        showToast('Barkod tarandı', 'success');
                    }}
                    onClose={() => setIsScanning(false)}
                />
            )}

            {/* Price Batch Update Modal */}
            {isPriceUpdateModalOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-stone-900 w-full max-w-4xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500/20 rounded-2xl text-amber-500 border border-amber-500/20">
                                    <DollarSign size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-stone-100 tracking-tight">Hızlı Fiyat Güncelleme</h3>
                                    <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Alış ve Satış Fiyatlarını Toplu Düzenle</p>
                                </div>
                            </div>
                            <button onClick={() => setIsPriceUpdateModalOpen(false)} className="p-2 bg-stone-800 text-stone-500 hover:text-stone-300 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 bg-stone-950/30 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-4 top-3 text-stone-600" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Ürün Ara..." 
                                    className="w-full bg-stone-900 border border-white/5 rounded-2xl p-3 pl-12 text-stone-200 text-sm outline-none focus:border-amber-500/30 transition-all font-bold"
                                    value={priceUpdateSearch}
                                    onChange={(e) => setPriceUpdateSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                                {priceUpdateItems
                                    .filter(item => item.pesticideName.toLocaleLowerCase('tr-TR').includes(priceUpdateSearch.toLocaleLowerCase('tr-TR')))
                                    .map((item, idx) => {
                                        const actualIdx = priceUpdateItems.findIndex(i => i.id === item.id);
                                        const original = inventory.find(i => i.id === item.id);
                                        const isChanged = original && (
                                            original.buyingPrice !== item.buyingPrice || 
                                            original.cashBuyingPrice !== item.cashBuyingPrice ||
                                            original.sellingPrice !== item.sellingPrice ||
                                            original.cashPrice !== item.cashPrice
                                        );

                                        return (
                                            <div 
                                                key={item.id} 
                                                className={`p-4 rounded-3xl border transition-all ${isChanged ? 'bg-amber-500/5 border-amber-500/30 shadow-lg' : 'bg-stone-950/50 border-white/5'}`}
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-black text-stone-100 truncate">{item.pesticideName}</h4>
                                                        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{item.category}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-stone-600 font-mono bg-stone-900 px-2 py-0.5 rounded-full">
                                                        Stok: {item.quantity} {item.unit}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                    {/* Buying Section */}
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest ml-1">V. Alış</label>
                                                        <div className="relative">
                                                            <input 
                                                                type="number" 
                                                                className="w-full bg-stone-900 border border-white/5 rounded-xl p-2 text-xs font-bold text-stone-300 outline-none focus:border-amber-500/50 font-mono h-9"
                                                                value={item.buyingPrice || ''}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    const newList = [...priceUpdateItems];
                                                                    newList[actualIdx] = { ...newList[actualIdx], buyingPrice: isNaN(val) ? 0 : val };
                                                                    setPriceUpdateItems(newList);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest ml-1">P. Alış</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-stone-900 border border-white/5 rounded-xl p-2 text-xs font-bold text-stone-300 outline-none focus:border-emerald-500/50 font-mono h-9"
                                                            value={item.cashBuyingPrice || ''}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                const newList = [...priceUpdateItems];
                                                                newList[actualIdx] = { ...newList[actualIdx], cashBuyingPrice: isNaN(val) ? 0 : val };
                                                                setPriceUpdateItems(newList);
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Selling Section */}
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest ml-1">V. Satış</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-stone-900 border border-amber-500/20 rounded-xl p-2 text-xs font-black text-amber-400 outline-none focus:border-amber-500 font-mono h-9 shadow-inner shadow-amber-500/5"
                                                            value={item.sellingPrice || ''}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                const newList = [...priceUpdateItems];
                                                                newList[actualIdx] = { ...newList[actualIdx], sellingPrice: isNaN(val) ? 0 : val };
                                                                setPriceUpdateItems(newList);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-blue-500/70 uppercase tracking-widest ml-1">P. Satış</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full bg-stone-900 border border-blue-500/20 rounded-xl p-2 text-xs font-black text-blue-400 outline-none focus:border-blue-500 font-mono h-9 shadow-inner shadow-blue-500/5"
                                                            value={item.cashPrice || ''}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                const newList = [...priceUpdateItems];
                                                                newList[actualIdx] = { ...newList[actualIdx], cashPrice: isNaN(val) ? 0 : val };
                                                                setPriceUpdateItems(newList);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 bg-stone-950/50 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Düzenlenen Ürün Sayısı</span>
                                <span className="text-xl font-black text-amber-500 font-mono">
                                    {priceUpdateItems.filter(item => {
                                        const original = inventory.find(i => i.id === item.id);
                                        return original && (
                                            original.buyingPrice !== item.buyingPrice || 
                                            original.cashBuyingPrice !== item.cashBuyingPrice ||
                                            original.sellingPrice !== item.sellingPrice ||
                                            original.cashPrice !== item.cashPrice
                                        );
                                    }).length}
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsPriceUpdateModalOpen(false)}
                                    className="px-6 py-3 rounded-2xl text-stone-400 hover:text-stone-200 font-bold text-sm transition-all"
                                >
                                    Vazgeç
                                </button>
                                <button 
                                    onClick={handleBatchPriceUpdate}
                                    disabled={isSaving}
                                    className="px-10 py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-2xl font-black text-sm shadow-xl shadow-amber-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            GÜNCELLENİYOR
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            FİYATLARI KAYDET
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />

            {isRebuildModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1c1c1c] border border-stone-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col font-sans">
                        <div className="p-6 border-b border-stone-800/50 flex items-center justify-between bg-stone-900/50">
                            <div>
                                <h3 className="text-xl font-bold text-stone-100 mb-1 flex items-center gap-2">
                                    <RefreshCw size={20} className="text-orange-500" />
                                    Depo Onarım Uzmanı & Düzeltme
                                </h3>
                                <p className="text-xs text-stone-400 font-medium">Stok uyuşmazlıkları tespit edilir, hedeflenen stokları doğrudan düzenleyip onaylayabilirsiniz.</p>
                            </div>
                            {rebuildState !== 'ANALYZING' && rebuildState !== 'REPAIRING' && (
                                <button
                                    onClick={() => {
                                        setIsRebuildModalOpen(false);
                                        setRebuildState('IDLE');
                                        setRebuildSearchTerm('');
                                    }}
                                    className="p-2 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl transition-colors shrink-0"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        <div className="p-6 max-h-[65vh] overflow-y-auto">
                            {rebuildState === 'ANALYZING' && (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <RefreshCw size={40} className="text-orange-500 animate-spin" />
                                    <div className="text-center">
                                        <div className="font-bold text-stone-200">Veritabanı Analiz Ediliyor</div>
                                        <div className="text-xs text-stone-500 mt-1">Geçmiş fişler ve faturalar taranıyor...</div>
                                    </div>
                                </div>
                            )}

                            {rebuildState === 'RESULT' && (
                                <div className="space-y-4">
                                    {mismatches.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                            <div className="w-16 h-16 rounded-full bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-center">
                                                <ClipboardCheck size={32} className="text-emerald-500" />
                                            </div>
                                            <div className="text-center">
                                                <div className="font-bold text-emerald-400 text-lg">Kusursuz!</div>
                                                <div className="text-sm text-stone-400 mt-2 max-w-[320px]">
                                                    Deponuzdaki tüm ürünlerin stok miktarları geçmiş alım, satım ve iadelerle birebir eşleşiyor.
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleFullRebuild}
                                                className="mt-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                                            >
                                                <RefreshCw size={14} />
                                                Tüm Depoyu Baştan Sıfırla & İşle
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="p-3 bg-orange-950/30 border border-orange-500/20 rounded-xl flex items-start gap-3">
                                                <AlertCircle size={18} className="text-orange-400 shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="text-sm font-bold text-orange-400 flex items-center justify-between">
                                                        <span>Onarım & Düzeltme Gerekli ({mismatches.length} Ürün)</span>
                                                    </div>
                                                    <div className="text-xs text-orange-400/80 mt-1">
                                                        Hesaplanan miktar otomatik dolmuştur. İsterseniz yeşil kutudan stok hedefini <strong>elle değiştirebilirsiniz</strong>.
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Search and Selection Toolbar */}
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                                                    <input 
                                                        type="text"
                                                        placeholder="Onarım listesinde ara..."
                                                        value={rebuildSearchTerm}
                                                        onChange={(e) => setRebuildSearchTerm(e.target.value)}
                                                        className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-orange-500/50 transition-colors"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (selectedMismatches.size === mismatches.length) {
                                                            setSelectedMismatches(new Set());
                                                        } else {
                                                            setSelectedMismatches(new Set(mismatches.map(m => m.pesticideId)));
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-bold transition-colors shrink-0"
                                                >
                                                    {selectedMismatches.size === mismatches.length ? 'Seçimi Temizle' : 'Tümünü Seç'}
                                                </button>
                                            </div>

                                            <div className="space-y-2 mt-2">
                                                {mismatches
                                                    .filter(item => item.pesticideName.toLocaleLowerCase('tr-TR').includes(rebuildSearchTerm.toLocaleLowerCase('tr-TR')))
                                                    .map((item, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className={`p-3 bg-stone-900 border rounded-xl flex flex-col transition-colors ${selectedMismatches.has(item.pesticideId) ? 'border-orange-500/40 bg-orange-950/10' : 'border-stone-800 opacity-75'}`}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <div 
                                                                className="flex items-center gap-3 pr-4 overflow-hidden cursor-pointer flex-1"
                                                                onClick={() => {
                                                                    const newSet = new Set(selectedMismatches);
                                                                    if (newSet.has(item.pesticideId)) newSet.delete(item.pesticideId);
                                                                    else newSet.add(item.pesticideId);
                                                                    setSelectedMismatches(newSet);
                                                                }}
                                                            >
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={selectedMismatches.has(item.pesticideId)}
                                                                    onChange={() => {}}
                                                                    className="shrink-0 w-4 h-4 rounded border-stone-600 bg-stone-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-stone-900 transition-all pointer-events-none"
                                                                />
                                                                <div className="font-semibold text-sm text-stone-200 truncate" title={item.pesticideName}>
                                                                    {item.pesticideName}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] text-stone-500 font-bold uppercase">Mevcut</span>
                                                                    <span className="text-xs font-bold text-red-400 line-through">{item.currentQty}</span>
                                                                </div>
                                                                <ArrowRight size={14} className="text-stone-600 shrink-0" />
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[9px] text-emerald-500 font-bold uppercase flex items-center gap-1">
                                                                        <Edit2 size={10} /> Yeni Stok
                                                                    </span>
                                                                    <input 
                                                                        type="number"
                                                                        step="any"
                                                                        value={item.calculatedQty}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value);
                                                                            const newQty = isNaN(val) ? 0 : val;
                                                                            setMismatches(prev => prev.map(m => m.pesticideId === item.pesticideId ? { ...m, calculatedQty: newQty } : m));
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="w-20 bg-stone-950 border border-emerald-500/40 focus:border-emerald-400 rounded-lg px-2 py-0.5 text-xs font-black text-emerald-400 text-right outline-none transition-colors"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="mt-2.5 flex items-center gap-4 border-t border-stone-800/80 pt-2">
                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-500/30"></div>
                                                                <div className="flex flex-col shrink-0 min-w-0">
                                                                    <span className="text-[9px] text-stone-500 font-bold uppercase leading-tight truncate">Alınan</span>
                                                                    <span className="text-xs font-black text-emerald-400">+{item.purchasedQty}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                <div className="shrink-0 w-2 h-2 rounded-full bg-red-500/30"></div>
                                                                <div className="flex flex-col shrink-0 min-w-0">
                                                                    <span className="text-[9px] text-stone-500 font-bold uppercase leading-tight truncate">Satılan / İade</span>
                                                                    <span className="text-xs font-black text-red-400">-{item.soldQty}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-1">
                                                                <div className="shrink-0 w-2 h-2 rounded-full bg-blue-500/30"></div>
                                                                <div className="flex flex-col shrink-0 min-w-0">
                                                                    <span className="text-[9px] text-stone-500 font-bold uppercase leading-tight truncate">Fark</span>
                                                                    <span className="text-xs font-black text-blue-400">
                                                                        {(item.calculatedQty - item.currentQty) > 0 ? '+' : ''}{(item.calculatedQty - item.currentQty).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {rebuildState === 'REPAIRING' && (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <RefreshCw size={40} className="text-orange-500 animate-spin" />
                                    <div className="text-center">
                                        <div className="font-bold text-stone-200">Kusursuz Bir Şekilde Onarılıyor</div>
                                        <div className="text-xs text-stone-500 mt-1">Stok bakiyeleri güncelleniyor...</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {rebuildState === 'RESULT' && (
                            <div className="p-6 bg-stone-900/50 border-t border-stone-800/50 flex flex-wrap items-center justify-between gap-3">
                                <button
                                    onClick={handleFullRebuild}
                                    title="Tüm depoyu geçmiş işlem kayıtlarından baştan sona yeniden hesaplar"
                                    className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                                >
                                    <RefreshCw size={14} className="text-orange-400" />
                                    Tüm Depoyu Yeniden Hesapla
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setIsRebuildModalOpen(false);
                                            setRebuildState('IDLE');
                                            setRebuildSearchTerm('');
                                        }}
                                        className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-bold text-xs transition-colors"
                                    >
                                        Kapat
                                    </button>
                                    {mismatches.length > 0 && (
                                        <button
                                            onClick={handleRepairInventory}
                                            disabled={selectedMismatches.size === 0}
                                            className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 rounded-xl font-black text-xs shadow-xl shadow-orange-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                                        >
                                            <RefreshCw size={14} />
                                            {selectedMismatches.size === mismatches.length ? 'Tümünü Onar' : 'Seçilileri Onar'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <SmartOrderModal 
                isOpen={isSmartOrderModalOpen}
                onClose={() => setIsSmartOrderModalOpen(false)}
                inventory={inventory}
                suppliers={suppliers}
                supplierPurchases={supplierPurchases}
                showToast={showToast}
            />

        </div>
    );
};

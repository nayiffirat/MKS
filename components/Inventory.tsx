import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Plus, Package, DollarSign, TrendingUp, 
    Trash2, Edit2, Save, X, AlertCircle, Filter,
    ArrowUpRight, ArrowDownRight, BarChart3, PieChart, FlaskConical,
    History, User, Calendar, List, Download, Eye, EyeOff, Camera, Barcode, Truck, RefreshCw, ChevronRight, ClipboardCheck
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, Cell, PieChart as RePieChart, Pie
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoogleGenAI, Type } from "@google/genai";
import { dbService } from '../services/db';
import { auth } from '../services/firebase';
import { InventoryItem, Pesticide, PesticideCategory } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';

export const InventoryScreen: React.FC<{ 
    onNavigateToPrescription?: (id: string) => void;
    onNavigateToSupplier?: (id: string) => void;
}> = ({ onNavigateToPrescription, onNavigateToSupplier }) => {
    const { 
        inventory, 
        addInventoryItem, 
        updateInventoryItem, 
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

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
    const [purchaseHistory, setPurchaseHistory] = useState<{ id: string; targetId: string; name: string; date: string; price: number; quantity: string; isReturn: boolean; type: 'SALE' | 'PURCHASE' }[]>([]);

    useEffect(() => {
        const fetchPurchaseHistory = async () => {
            if (!selectedDetailItem) {
                setPurchaseHistory([]);
                return;
            }
            
            const history: { id: string; targetId: string; name: string; date: string; price: number; quantity: string; isReturn: boolean; type: 'SALE' | 'PURCHASE' }[] = [];
            
            for (const supplier of suppliers) {
                const purchases = await dbService.getSupplierPurchases(supplier.id);
                purchases.filter(p => !p.deletedAt).forEach(p => {
                    const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
                    if (item) {
                        const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
                        history.push({
                            id: p.id,
                            targetId: supplier.id,
                            name: supplier.name,
                            date: p.date,
                            price: item.buyingPrice || 0,
                            quantity: Math.abs(qty).toString(),
                            isReturn: qty < 0,
                            type: 'PURCHASE'
                        });
                    }
                });
            }
            
            setPurchaseHistory(history);
        };
        
        fetchPurchaseHistory();
    }, [selectedDetailItem, suppliers]);

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
    useEffect(() => {
        const fixAnomalies = async () => {
            if (inventory.length === 0) return;
            
            let needsRefresh = false;
            const seenMap = new Map<string, InventoryItem>();
            
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

                // Sync name and category from global pesticides
                const pest = pesticides.find(p => p.id === fixedItem.pesticideId);
                if (pest) {
                    if (pest.name !== fixedItem.pesticideName) {
                        fixedItem.pesticideName = pest.name;
                        isCorrupted = true;
                    }
                    if (pest.category !== fixedItem.category) {
                        fixedItem.category = pest.category;
                        isCorrupted = true;
                    }
                }

                // 2. Deduplicate
                if (seenMap.has(fixedItem.pesticideId)) {
                    // It's a duplicate. Merge quantity into the first one, delete this one.
                    const existing = seenMap.get(fixedItem.pesticideId)!;
                    existing.quantity += fixedItem.quantity;
                    
                    // Update existing
                    await updateInventoryItem(existing);
                    
                    // Permanent delete the duplicate
                    await permanentlyDeleteInventoryItem(fixedItem.id);
                    needsRefresh = true;
                } else {
                    seenMap.set(fixedItem.pesticideId, fixedItem);
                    
                    // 3. Sync Prices & Quantity from Official Records
                    
                    // Calculate expected total purchases for this specific item
                    let expectedQuantity = 0;
                    supplierPurchases.filter(p => !p.deletedAt).forEach(purchase => {
                        purchase.items.forEach(pi => {
                            if (pi.pesticideId === fixedItem.pesticideId) {
                                const q = parseFloat(String(pi.quantity).replace(',', '.')) || 0;
                                if (purchase.type === 'RETURN') expectedQuantity -= q;
                                else expectedQuantity += q;
                            }
                        });
                    });

                    // Subtract sales
                    prescriptions.filter(p => !p.deletedAt).forEach(pres => {
                        pres.items.forEach(pi => {
                            if (pi.pesticideId === fixedItem.pesticideId) {
                                const q = parseFloat(String(pi.quantity).replace(',', '.')) || 0;
                                if (pres.type === 'RETURN') {
                                    // Returned by farmer -> comes back to inventory
                                    expectedQuantity += q;
                                } else {
                                    expectedQuantity -= q;
                                }
                            }
                        });
                    });

                    // Add manual adjustments
                    if (fixedItem.adjustments && fixedItem.adjustments.length > 0) {
                        fixedItem.adjustments.forEach(adj => {
                            expectedQuantity += (parseFloat(String(adj.amount).replace(',', '.')) || 0);
                        });
                    }

                    // Force the actual quantity to perfectly match history (supplier, sales, adjustments)
                    // We check if it has ANY history at all
                    const hasHistory = supplierPurchases.some(p => !p.deletedAt && p.items.some(pi => pi.pesticideId === fixedItem.pesticideId)) ||
                                       prescriptions.some(p => !p.deletedAt && p.items.some(pi => pi.pesticideId === fixedItem.pesticideId)) ||
                                       (fixedItem.adjustments && fixedItem.adjustments.length > 0);
                    
                    if (hasHistory && fixedItem.quantity !== expectedQuantity) {
                        fixedItem.quantity = expectedQuantity;
                        isCorrupted = true;
                    }

                    // Sync Prices from Latest Purchase
                    const relatedPurchases = supplierPurchases.filter(p => 
                        !p.deletedAt && p.items.some(pi => pi.pesticideId === fixedItem.pesticideId) && p.type === 'PURCHASE'
                    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (relatedPurchases.length > 0) {
                        const latestPurchase = relatedPurchases[0];
                        const purchasedItem = latestPurchase.items.find(pi => pi.pesticideId === fixedItem.pesticideId);
                        if (purchasedItem && purchasedItem.buyingPrice) {
                            const newBuyingPrice = parseFloat(String(purchasedItem.buyingPrice).replace(',', '.')) || 0;
                            // Update price if it was 0 or corrupted (or forcefully sync to match supplier)
                            // We will forcefully sync it to ensure "alış satış sorunlu" problem is gone.
                            if (newBuyingPrice > 0) {
                                fixedItem.buyingPrice = newBuyingPrice;
                                fixedItem.cashBuyingPrice = newBuyingPrice; // Usually same
                                
                                // Optional: Update selling price based on logic if it's 0
                                if (fixedItem.sellingPrice <= 0) {
                                    fixedItem.sellingPrice = newBuyingPrice * 1.2;
                                    fixedItem.cashPrice = newBuyingPrice * 1.2;
                                }
                                isCorrupted = true; // Flag for update
                            }
                        }
                    }

                    if (isCorrupted || 
                        typeof item.quantity !== 'number' || 
                        typeof item.buyingPrice !== 'number' || 
                        typeof item.sellingPrice !== 'number') {
                        await updateInventoryItem(fixedItem);
                        needsRefresh = true;
                    }
                }
            }
            
            if (needsRefresh) {
                await refreshInventory();
            }
        };
        
        fixAnomalies();
    }, [inventory, supplierPurchases, prescriptions]); 

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
        supplierPurchases.filter(p => !p.deletedAt).forEach(purchase => {
            purchase.items.forEach(item => {
                const qty = parseFloat(item.quantity.toString().replace(',', '.')) || 0;
                const current = map.get(item.pesticideId) || 0;
                if (purchase.type === 'RETURN') {
                    map.set(item.pesticideId, current - qty);
                } else {
                    map.set(item.pesticideId, current + qty);
                }
            });
        });
        return map;
    }, [supplierPurchases]);

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

            const parseFloatSafe = (val: string | number) => parseFloat(String(val).replace(',', '.')) || 0;
            
            const addQty = parseFloatSafe(formData.quantity);
            const buyingPrice = parseFloatSafe(formData.buyingPrice);
            const cashBuyingPrice = parseFloatSafe(formData.cashBuyingPrice) || buyingPrice;
            const sellingPrice = parseFloatSafe(formData.sellingPrice);
            const cashPrice = parseFloatSafe(formData.cashPrice) || sellingPrice;

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
                    lowStockThreshold: parseFloatSafe(formData.lowStockThreshold) !== 0 ? parseFloatSafe(formData.lowStockThreshold) : inventoryExisting.lowStockThreshold
                };

                if (addQty !== 0) {
                    updatedItem.adjustments = [
                        ...(updatedItem.adjustments || []),
                        {
                            date: new Date().toISOString(),
                            amount: addQty,
                            note: 'Depomdan Eklenen'
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
                lowStockThreshold: parseFloatSafe(formData.lowStockThreshold)
            };

            if (addQty !== 0) {
                newItem.adjustments = [{
                    date: new Date().toISOString(),
                    amount: addQty,
                    note: 'Depomdan'
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
            const parseFloatSafe = (val: string | number) => parseFloat(String(val).replace(',', '.')) || 0;
            const newTotalQty = parseFloatSafe(formData.quantity);
            const qtyDiff = newTotalQty - selectedItem.quantity;

            const buyingPrice = parseFloatSafe(formData.buyingPrice);
            const cashBuyingPrice = parseFloatSafe(formData.cashBuyingPrice) || buyingPrice;
            const sellingPrice = parseFloatSafe(formData.sellingPrice);
            const cashPrice = parseFloatSafe(formData.cashPrice) || sellingPrice;

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
                lowStockThreshold: parseFloatSafe(formData.lowStockThreshold)
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
    };

    const handleAiLens = () => {
        fileInputRef.current?.click();
    };

    const processImageWithAI = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsAiProcessing(true);
            showToast('Yapay zeka ürünü inceliyor...', 'info');

            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
            });
            reader.readAsDataURL(file);
            const base64Data = await base64Promise;

            const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
            const ai = new GoogleGenAI({ apiKey: apiKey?.replace(/['"]+/g, '').trim() });
            
            const generateContent = async (modelName: string) => {
                return await ai.models.generateContent({
                    model: modelName,
                    contents: [
                        {
                            parts: [
                                { inlineData: { data: base64Data, mimeType: file.type } },
                                { text: "Bu bir zirai ilaç veya gübre etiketi. Lütfen etiketteki bilgileri oku ve şu formatta JSON olarak dön: Ürün Adı (productName), Kategori (category - HERBICIDE, INSECTICIDE, FUNGICIDE, FERTILIZER, ACARICIDE, OTHER seçeneklerinden biri), Birim (unit - Adet, Litre, Kg, Kutu, Çuval seçeneklerinden biri). Sadece JSON dön." }
                            ]
                        }
                    ],
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                productName: { type: Type.STRING },
                                category: { 
                                    type: Type.STRING,
                                    enum: Object.values(PesticideCategory)
                                },
                                unit: { 
                                    type: Type.STRING,
                                    enum: ['Adet', 'Litre', 'Kg', 'Kutu', 'Çuval']
                                }
                            },
                            required: ["productName", "category", "unit"]
                        }
                    }
                });
            };

            let response;
            try {
                response = await generateContent("gemini-3-flash-preview");
            } catch (e) {
                console.warn("Falling back to gemini-2.5-flash", e);
                response = await generateContent("gemini-2.5-flash");
            }

            const result = JSON.parse(response.text || '{}');
            
            if (result.productName) {
                setProductName(result.productName);
                const matchedPest = pesticides.find(p => p.name.toLocaleLowerCase('tr-TR') === result.productName.toLocaleLowerCase('tr-TR'));
                if (matchedPest) {
                    setSelectedPesticide(matchedPest);
                    setFormData(prev => ({ 
                        ...prev, 
                        category: matchedPest.category,
                        unit: result.unit || prev.unit
                    }));
                } else {
                    setFormData(prev => ({ 
                        ...prev, 
                        category: result.category as PesticideCategory || PesticideCategory.OTHER,
                        unit: result.unit || 'Adet'
                    }));
                }
                showToast('Ürün başarıyla tanındı!', 'success');
                hapticFeedback('success');
            } else {
                showToast('Ürün tanınamadı, lütfen bilgileri manuel girin.', 'error');
            }

        } catch (error: any) {
            console.error("AI Lens Error:", error);
            const errMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
            
            dbService.addSystemError({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                source: 'Inventory (AI Lens)',
                message: errMsg,
                userEmail: auth.currentUser?.email || 'Bilinmiyor'
            });

            showToast('Şu anda sunucularımızda aşırı yoğunluk yaşanmaktadır. Lütfen biraz sonra tekrar deneyin.', 'error');
        } finally {
            setIsAiProcessing(false);
            if (e.target) e.target.value = '';
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

    const generateInventoryPDF = (type: 'CUSTOMER' | 'INTERNAL' | 'FULL') => {
        const doc = new jsPDF();
        const dateStr = new Date().toLocaleDateString('tr-TR');
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const engineerName = userProfile.fullName || 'Ziraat Mühendisi';
        
        // --- CORPORATE HEADER ---
        // Emerald Header Bar
        doc.setFillColor(16, 185, 129);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(tr('MÜHENDİS KAYIT SİSTEMİ'), 14, 20);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(tr('Dijital Tarim ve Stok Yönetim Sistemi'), 14, 28);
        
        // Right side header info
        doc.setFontSize(9);
        doc.text(tr(`Tarih: ${dateStr} ${timeStr}`), 196, 15, { align: 'right' });
        doc.text(tr(`Rapor No: #INV-${Math.floor(Math.random() * 10000)}`), 196, 22, { align: 'right' });
        doc.text(tr(`Sorumlu: ${engineerName}`), 196, 29, { align: 'right' });

        // --- REPORT TITLE ---
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        
        let title = '';
        let head: string[][] = [];
        let body: any[] = [];
        
        const sortedInventory = [...filteredInventory].sort((a, b) => a.category.localeCompare(b.category));

        if (type === 'CUSTOMER') {
            title = 'MUSTERI FIYAT LISTESI';
            head = [[tr('Ürün Adı'), tr('Kategori'), tr('Birim'), tr('Satış Fiyatı')]];
            body = sortedInventory.map(item => [
                tr(item.pesticideName),
                tr(item.category),
                tr(item.unit),
                `${formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')}`
            ]);
        } else if (type === 'INTERNAL') {
            title = 'IC STOK VE MALIYET LISTESI';
            head = [[tr('Ürün Adı'), tr('Kategori'), tr('Stok'), tr('Birim'), tr('Alış Fiyatı (Vadeli)'), tr('Alış Fiyatı (Peşin)')]];
            body = sortedInventory.map(item => [
                tr(item.pesticideName),
                tr(item.category),
                Number(item.quantity).toString(),
                tr(item.unit),
                `${formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY')}`,
                `${formatCurrency(item.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}`
            ]);
        } else {
            title = 'TAM STOK VE FINANSAL RAPOR';
            head = [[tr('Ürün Adı'), tr('Kategori'), tr('Stok'), tr('Alış (V/P)'), tr('Satış (V/P)'), tr('Toplam Maliyet (V/P)')]];
            body = sortedInventory.map(item => [
                tr(item.pesticideName),
                tr(item.category),
                `${item.quantity} ${tr(item.unit)}`,
                `${formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY')} / ${formatCurrency(item.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}`,
                `${formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')} / ${formatCurrency(item.cashPrice || 0, userProfile?.currency || 'TRY')}`,
                `${formatCurrency(item.quantity * item.buyingPrice, userProfile?.currency || 'TRY')} / ${formatCurrency(item.quantity * (item.cashBuyingPrice || 0), userProfile?.currency || 'TRY')}`
            ]);
        }

        doc.text(tr(title), 14, 55);
        
        // Horizontal line under title
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.5);
        doc.line(14, 58, 60, 58);

        // --- TABLE ---
        autoTable(doc, {
            startY: 65,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { 
                fillColor: [16, 185, 129], 
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 4,
                font: 'helvetica',
                textColor: [60, 60, 60],
                lineColor: [230, 230, 230]
            },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [20, 20, 20] }
            },
            alternateRowStyles: { fillColor: [250, 252, 251] },
            margin: { left: 14, right: 14 }
        });

        // --- SUMMARY BOXES (For Internal and Full) ---
        if (type !== 'CUSTOMER') {
            const finalY = (doc as any).lastAutoTable.finalY + 15;
            const totalCost = sortedInventory.reduce((acc, i) => acc + (i.quantity * i.buyingPrice), 0);
            const totalCashCost = sortedInventory.reduce((acc, i) => acc + (i.quantity * (i.cashBuyingPrice || 0)), 0);
            const totalRevenue = sortedInventory.reduce((acc, i) => acc + (i.quantity * i.sellingPrice), 0);
            const totalCashRevenue = sortedInventory.reduce((acc, i) => acc + (i.quantity * (i.cashPrice || 0)), 0);
            
            // Summary Box Background
            doc.setFillColor(245, 247, 246);
            doc.roundedRect(14, finalY, 182, type === 'FULL' ? 45 : 25, 3, 3, 'F');
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 100, 100);
            doc.text(tr('FINANSAL OZET'), 20, finalY + 8);
            
            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text(tr(`Toplam Stok Maliyeti (Vadeli / Peşin):`), 20, finalY + 16);
            doc.text(`${formatCurrency(totalCost, userProfile?.currency || 'TRY')} / ${formatCurrency(totalCashCost, userProfile?.currency || 'TRY')}`, 190, finalY + 16, { align: 'right' });
            
            if (type === 'FULL') {
                doc.text(tr(`Toplam Potansiyel Ciro (Vadeli / Peşin):`), 20, finalY + 23);
                doc.text(`${formatCurrency(totalRevenue, userProfile?.currency || 'TRY')} / ${formatCurrency(totalCashRevenue, userProfile?.currency || 'TRY')}`, 190, finalY + 23, { align: 'right' });
                
                doc.setDrawColor(220, 220, 220);
                doc.line(20, finalY + 26, 190, finalY + 26);
                
                doc.setFontSize(12);
                doc.setTextColor(16, 185, 129);
                doc.text(tr(`Tahmini Net Kar (Vadeli / Peşin):`), 20, finalY + 31);
                doc.text(`${formatCurrency(totalRevenue - totalCost, userProfile?.currency || 'TRY')} / ${formatCurrency(totalCashRevenue - totalCashCost, userProfile?.currency || 'TRY')}`, 190, finalY + 31, { align: 'right' });
            }
        }

        // --- FOOTER ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                tr(`Mühendis Kayıt Sistemi - Profesyonel Stok Yönetim Raporu | Sayfa ${i} / ${pageCount}`),
                105,
                285,
                { align: 'center' }
            );
            doc.text(
                tr('Bu belge dijital olarak olusturulmustur.'),
                105,
                290,
                { align: 'center' }
            );
        }

        doc.save(`MKS_Depo_Raporu_${type}_${dateStr.replace(/\./g, '_')}.pdf`);
        setIsListMenuOpen(false);
        showToast('Kurumsal PDF Raporu oluşturuldu', 'success');
    };

    const generateItemReport = (item: InventoryItem) => {
        const doc = new jsPDF();
        
        // --- HEADER ---
        doc.setFillColor(16, 185, 129);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(tr('URUN DETAY RAPORU'), 14, 25);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('tr-TR');
        doc.text(tr(`Tarih: ${dateStr}`), 196, 25, { align: 'right' });

        // --- ITEM DETAILS ---
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(tr(item.pesticideName), 14, 55);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(tr(`Kategori: ${item.category}`), 14, 62);
        doc.text(tr(`Mevcut Stok: ${Number(item.quantity).toString()} ${item.unit}`), 14, 68);
        
        doc.text(tr(`Vadeli Alış: ${formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY')}`), 105, 62);
        doc.text(tr(`Peşin Alış: ${formatCurrency(item.cashBuyingPrice || 0, userProfile?.currency || 'TRY')}`), 105, 68);
        
        doc.text(tr(`Vadeli Satış: ${formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')}`), 150, 62);
        doc.text(tr(`Peşin Satış: ${formatCurrency(item.cashPrice || 0, userProfile?.currency || 'TRY')}`), 150, 68);

        // Horizontal line
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 75, 196, 75);

        // --- HISTORY TABLE ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(tr('ISLEM GECMISI'), 14, 85);

        const head = [[tr('Tarih'), tr('İşlem Tipi'), tr('Kişi / Kurum'), tr('Miktar'), tr('Birim Fiyat'), tr('Toplam')]];
        const body = combinedHistory.map(h => {
            const isReturn = h.isReturn;
            let typeStr = h.type === 'SALE' ? (isReturn ? 'Satış İadesi' : 'Satış') : (isReturn ? 'Alış İadesi' : 'Alış');
            const total = Number(h.quantity) * h.price;
            
            return [
                new Date(h.date).toLocaleDateString('tr-TR'),
                tr(typeStr),
                tr(h.name),
                `${isReturn ? '-' : ''}${h.quantity} ${tr(item.unit)}`,
                formatCurrency(h.price, userProfile?.currency || 'TRY'),
                formatCurrency(total, userProfile?.currency || 'TRY')
            ];
        });

        autoTable(doc, {
            startY: 90,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: { 
                fillColor: [16, 185, 129], 
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 4,
                font: 'helvetica',
                textColor: [60, 60, 60]
            },
            columnStyles: {
                1: { fontStyle: 'bold' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: { fillColor: [250, 252, 251] },
            margin: { left: 14, right: 14 }
        });

        // --- FOOTER ---
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                tr(`Mühendis Kayıt Sistemi - Ürün Detay Raporu | Sayfa ${i} / ${pageCount}`),
                105,
                285,
                { align: 'center' }
            );
        }

        doc.save(`MKS_Urun_Raporu_${tr(item.pesticideName).replace(/\s+/g, '_')}_${dateStr.replace(/\./g, '_')}.pdf`);
        showToast('Ürün detay raporu oluşturuldu', 'success');
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
        
        prescriptions.filter(p => !p.deletedAt).forEach(p => {
            const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
            if (item) {
                const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
                history.push({
                    id: p.id,
                    targetId: p.farmerId,
                    name: farmerMap[p.farmerId] || `Bilinmeyen ${farmerLabel}`,
                    date: p.date,
                    price: item.unitPrice || 0,
                    quantity: Math.abs(qty).toString(),
                    isReturn: qty < 0,
                    type: 'SALE'
                });
            }
        });
        
        return history;
    }, [selectedDetailItem, prescriptions, farmerMap]);

    const combinedHistory = useMemo(() => {
        const adjustmentsHistory = (selectedDetailItem?.adjustments || []).map((adj, idx) => ({
            id: `adj-${idx}`,
            index: idx,
            targetId: 'manual',
            name: adj.note || 'Depomdan',
            date: adj.date,
            price: 0,
            quantity: Math.abs(adj.amount).toString(),
            isReturn: adj.amount < 0,
            type: 'ADJUSTMENT' as 'SALE'|'PURCHASE'|'ADJUSTMENT'
        }));
        
        return [...salesHistory, ...purchaseHistory, ...adjustmentsHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [salesHistory, purchaseHistory, selectedDetailItem]);

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
        const processed = prescriptions.filter(p => p.isInventoryProcessed && !p.deletedAt);
        
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
    }, [inventory, prescriptions, stats.totalExpenses, accounts]);

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
                
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button 
                            onClick={() => setIsListMenuOpen(!isListMenuOpen)}
                            className="bg-stone-900/80 hover:bg-stone-800 text-stone-300 px-3 py-1.5 rounded-xl font-black text-[11px] border border-white/10 active:scale-95 transition-all flex items-center gap-1.5 group shadow-sm uppercase tracking-wider"
                        >
                            <List size={14} className="text-stone-500 group-hover:text-emerald-400 transition-colors" />
                            Depo Raporu
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

                    <div className="relative">
                        <button 
                            onClick={() => setIsStockMenuOpen(!isStockMenuOpen)}
                            className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider shadow-sm active:scale-95 ${stockFilter !== 'ALL' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-stone-900/80 border-white/10 text-stone-500 hover:text-stone-300'}`}
                        >
                            {stockFilter === 'ALL' ? <List size={14} /> : stockFilter === 'OUT_OF_STOCK' ? <EyeOff size={14} /> : <Eye size={14} />}
                            {stockFilter === 'ALL' ? "Tümünü Göster" : stockFilter === 'OUT_OF_STOCK' ? "Bitenleri Göster" : "Kalanları Göster"}
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
                            onClick={() => openAddModal()}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl font-black text-[11px] shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-1.5 uppercase tracking-wider"
                        >
                            <Plus size={16} />
                            Ürün Ekle
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
                    <div className="flex gap-2 mb-4">
                        <div className="flex-[4] bg-stone-900/80 border border-white/10 rounded-xl flex items-center px-3 shadow-sm focus-within:border-emerald-500/50 transition-all">
                            <Search className="text-stone-500" size={16} />
                            <input 
                                type="text"
                                placeholder="Ürün ara..."
                                className="w-full bg-transparent p-2 text-stone-200 outline-none text-xs font-medium placeholder-stone-600"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select 
                            className="flex-1 bg-stone-900/80 border border-white/10 rounded-xl px-2 text-stone-400 text-[10px] font-bold outline-none cursor-pointer hover:text-stone-200 transition-colors min-w-[100px]"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="ALL">Tüm Kategoriler</option>
                            {Object.values(PesticideCategory).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Inventory List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map(item => (
                                <div 
                                    key={item.id} 
                                    onClick={() => openDetailModal(item)}
                                    className={`bg-stone-900/80 backdrop-blur border rounded-2xl p-4 shadow-sm transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden ${
                                        item.quantity <= 0 
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
                                            item.quantity <= 0 
                                            ? 'bg-red-500 text-white' 
                                            : (item.lowStockThreshold && item.quantity <= item.lowStockThreshold)
                                            ? 'bg-amber-500 text-stone-950 animate-pulse'
                                            : 'bg-emerald-500 text-stone-950'
                                        }`}>
                                            <Package size={12} />
                                            {Number(item.quantity).toString()} <span className="text-[8px] opacity-70 font-sans uppercase">KALAN</span>
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

                                    {/* Date removed for space saving */}
                                </div>
                            ))
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
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Ürün Adı</label>
                                        {isAddModalOpen && (
                                            <button 
                                                onClick={handleAiLens}
                                                disabled={isAiProcessing}
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isAiProcessing ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                                            >
                                                {isAiProcessing ? (
                                                    <>
                                                        <RefreshCw size={12} className="animate-spin" />
                                                        İşleniyor...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Camera size={12} />
                                                        AI Lens
                                                    </>
                                                )}
                                            </button>
                                        )}
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
                                        <span className="text-[10px] text-stone-500 font-bold uppercase block mb-1">Mevcut Stok (Kalan)</span>
                                        <span className={`${selectedDetailItem.quantity <= 0 ? 'text-red-400' : 'text-emerald-400'} font-black text-xl`}>
                                            {selectedDetailItem.quantity} <span className="text-xs text-stone-600 font-sans">{selectedDetailItem.unit}</span>
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
                                            prescriptions.filter(p => !p.deletedAt && p.type !== 'RETURN').reduce((acc, p) => {
                                                const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
                                                return acc + (item?.quantity ? (parseFloat(item.quantity.toString()) || 0) : 0);
                                            }, 0)
                                        }</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-stone-500">Müşteri İadeleri (+)</span>
                                        <span className="text-stone-300 font-bold">+{
                                            prescriptions.filter(p => !p.deletedAt && p.type === 'RETURN').reduce((acc, p) => {
                                                const item = p.items.find(i => i.pesticideId === selectedDetailItem.pesticideId);
                                                return acc + (item?.quantity ? (parseFloat(item.quantity.toString()) || 0) : 0);
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
                                    <span className="text-xs font-black text-stone-200">KAYITLI NET STOK</span>
                                    <span className="text-lg font-black text-emerald-400 font-mono tracking-tighter">
                                        {selectedDetailItem.quantity} <span className="text-xs font-sans text-stone-600">{selectedDetailItem.unit}</span>
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
                                <h4 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <History size={14} className="text-blue-500" />
                                    Hareket Geçmişi
                                </h4>
                                
                                <div className="space-y-2">
                                    {combinedHistory.length > 0 ? (
                                        combinedHistory.map((record, idx) => (
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
                                                        record.type === 'SALE' ? 'bg-stone-900 text-blue-500' : 
                                                        record.type === 'PURCHASE' ? 'bg-stone-900 text-emerald-500' :
                                                        'bg-stone-900 text-amber-500'
                                                    }`}>
                                                        {record.type === 'SALE' ? <User size={18} /> : 
                                                         record.type === 'PURCHASE' ? <Truck size={18} /> : 
                                                         <AlertCircle size={18} />}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-stone-200">
                                                            {record.name}
                                                            <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded-md ${
                                                                record.type === 'SALE' ? 'bg-blue-500/10 text-blue-400' : 
                                                                record.type === 'PURCHASE' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                'bg-amber-500/10 text-amber-400'
                                                            }`}>
                                                                {record.type === 'SALE' ? 'SATIŞ' : 
                                                                 record.type === 'PURCHASE' ? 'ALIM' : 
                                                                 'DEPOMDAN'}
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
                                                            (record.isReturn ? 'text-rose-400' : (record.type === 'SALE' ? 'text-blue-400' : 'text-emerald-400'))
                                                        }`}>
                                                            {record.type === 'ADJUSTMENT' ? (Number(record.quantity) > 0 ? '+' : '') : (record.isReturn ? '-' : '')}
                                                            {record.type === 'ADJUSTMENT' ? record.quantity : formatCurrency(record.price, userProfile?.currency || 'TRY')}
                                                            {record.type === 'ADJUSTMENT' && ` ${selectedDetailItem.unit}`}
                                                        </div>
                                                        <div className={`text-[10px] font-bold ${record.isReturn ? 'text-rose-500/80' : 'text-stone-600'}`}>
                                                            {record.type === 'ADJUSTMENT' ? 'Fark' : (record.isReturn ? 'İADE: ' : 'Miktar: ') + record.quantity + ' ' + selectedDetailItem.unit}
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                                </div>
                                            </div>
                                        ))
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
                                <p className="text-[10px] text-stone-500 mt-1 uppercase">{selectedDetailItem.adjustments?.[editingAdjustmentIdx]?.note || 'Depomdan'}</p>
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

            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                capture="environment"
                onChange={processImageWithAI} 
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
            />
        </div>
    );
};

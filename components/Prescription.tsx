
// ... imports ...
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import { Farmer, Pesticide, Prescription, PesticideCategory, VisitLog, AppNotification } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { safeStringify } from '../utils/json';
import { Check, Plus, Trash2, FileOutput, Share2, FileText, Calendar, MapPin, X, User, Loader2, Search, FlaskConical, MessageCircle, Edit2, AlertCircle, ArrowLeft, Printer, Package, Download, MessageSquare, RefreshCw, AlertTriangle, Camera, Barcode, TrendingUp, Star, Lightbulb, ChevronRight } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

interface PrescriptionFormProps {
    onBack: () => void;
    initialFarmerId?: string;
    initialPrescriptionId?: string;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ onBack, initialFarmerId, initialPrescriptionId }) => {
    const { 
        userProfile, 
        refreshStats, 
        updateUserProfile,
        prescriptions: contextPrescriptions,
        togglePrescriptionStatus,
        softDeletePrescription,
        farmers: contextFarmers,
        inventory: contextInventory,
        plants: contextPlants,
        showToast,
        hapticFeedback,
        activeTeamMember,
        teamMembers,
        t
    } = useAppViewModel();
    const isSales = activeTeamMember?.role === 'SALES';
    const farmerLabel = 'Çiftçi';
    const farmerPluralLabel = 'Çiftçiler';
    const prescriptionLabel = 'Fatura';

    const canEditPrescription = !isSales;
    const canCreatePrescription = canEditPrescription;
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'DETAIL'>(initialFarmerId ? 'FORM' : 'LIST');
    
    // Sub-navigation sync
    useEffect(() => {
        const handlePop = (e: PopStateEvent) => {
            const state = e.state;
            if (state?.view === 'PRESCRIPTIONS') {
                if (state.subView) {
                    setViewMode(state.subView);
                    if (state.step) {
                        setStep(state.step);
                    } else {
                        setStep(initialFarmerId ? 2 : 1);
                    }
                    if (state.subView === 'DETAIL' && state.detailId) {
                        const target = contextPrescriptions.find(p => p.id === state.detailId);
                        if (target) setDetailPrescription(target);
                    }
                } else {
                    setViewMode('LIST');
                    setDetailPrescription(null);
                    setEditingId(null);
                    setStep(1);
                }
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [contextPrescriptions, initialFarmerId]);

    const changeViewMode = (mode: 'LIST' | 'FORM' | 'DETAIL', detailId?: string, replace = false) => {
        if (mode === viewMode) return;
        
        if (mode === 'LIST') {
            if (window.history.state?.subView) {
                window.history.back();
            } else {
                setViewMode('LIST');
                setDetailPrescription(null);
                setEditingId(null);
            }
        } else {
            const initialStep = (mode === 'FORM' && initialFarmerId) ? 2 : 1;
            const state = { ...window.history.state, subView: mode, detailId, step: initialStep };
            if (replace) {
                window.history.replaceState(state, '');
            } else {
                window.history.pushState(state, '');
            }
            setViewMode(mode);
            setStep(initialStep);
        }
    };

    const handleScan = (barcode: string) => {
        // Search in inventory first
        const invItem = contextInventory.find(item => item.barcode === barcode);
        if (invItem) {
            const p = pesticides.find(pest => pest.id === invItem.pesticideId);
            if (p) {
                addItem(p);
                return;
            }
        }
        
        // Search in pesticides if not found in inventory or if inventory item pesticide not found
        const pesticide = pesticides.find(p => p.barcode === barcode);
        if (pesticide) {
            addItem(pesticide);
        } else {
            showToast("Barkod bulunamadı: " + barcode, 'error');
        }
    };

    const changeStep = (newStep: number) => {
        if (newStep === step) return;
        window.history.pushState({ ...window.history.state, step: newStep }, '');
        setStep(newStep);
    };
    
    const [farmerMap, setFarmerMap] = useState<Record<string, Farmer>>({});

    const [step, setStep] = useState(1);
    const [isScanning, setIsScanning] = useState(false);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
    const [selectedPlantId, setSelectedPlantId] = useState('');
    const [farmerSearchTerm, setFarmerSearchTerm] = useState('');
    const [pesticideSearchTerm, setPesticideSearchTerm] = useState('');
    const [prescriptionSearchTerm, setPrescriptionSearchTerm] = useState('');
    
    // Updated state to include quantity and price
    const [selectedItems, setSelectedItems] = useState<{pesticide: Pesticide, dosage: string, quantity: string, unitPrice?: string, totalPrice?: number, buyingPrice?: number}[]>([]);
    const [showPrices, setShowPrices] = useState(true);
    const [customPrescriptionNo, setCustomPrescriptionNo] = useState('');
    const [prescriptionPriceType, setPrescriptionPriceType] = useState<'CASH' | 'TERM'>('TERM');
    const [prescriptionDiscount, setPrescriptionDiscount] = useState<string>('');
    const [prescriptionDueDate, setPrescriptionDueDate] = useState('');
    const [isManualDueDate, setIsManualDueDate] = useState(false);
    const [prescriptionType, setPrescriptionType] = useState<'SALE' | 'RETURN'>('SALE');
    
    const currentPrescriptionLabel = prescriptionType === 'RETURN' ? 'İade Faturası' : 'Satış Faturası';
    
    // Recommendations State
    const [recommendedIds, setRecommendedIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('crm_recommended_pesticides');
        return saved ? JSON.parse(saved) : [];
    });
    const [showRecommendations, setShowRecommendations] = useState(false);

    useEffect(() => {
        localStorage.setItem('crm_recommended_pesticides', safeStringify(recommendedIds));
    }, [recommendedIds]);

    const toggleRecommendation = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setRecommendedIds(prev => 
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };
    
    // Detail View State
    const [detailPrescription, setDetailPrescription] = useState<Prescription | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [prescriptionToDelete, setPrescriptionToDelete] = useState<string | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showProfitId, setShowProfitId] = useState<string | null>(null);
    const [hasInitializedEdit, setHasInitializedEdit] = useState(false);
    const [hasInitializedFarmer, setHasInitializedFarmer] = useState(false);
    
    const [filterMode, setFilterMode] = useState<'ALL' | 'PROCESSED' | 'UNPROCESSED'>('ALL');
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const receiptRef = useRef<HTMLDivElement>(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportStartDate, setReportStartDate] = useState<string>(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [reportTypeSelection, setReportTypeSelection] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (initialFarmerId && !hasInitializedFarmer && farmers.length > 0) {
            const preSelected = farmers.find(farm => farm.id === initialFarmerId);
            if (preSelected) {
                setSelectedFarmer(preSelected);
                setStep(2);
                setHasInitializedFarmer(true);
                // Ensure history state is correct for initial step 2
                if (window.history.state?.view === 'PRESCRIPTIONS' && !window.history.state.step) {
                    window.history.replaceState({ ...window.history.state, step: 2 }, '');
                }
            }
        }
    }, [initialFarmerId, farmers, hasInitializedFarmer]);

    useEffect(() => {
        if (initialPrescriptionId && !hasInitializedEdit && contextPrescriptions.length > 0 && pesticides.length > 0) {
            const p = contextPrescriptions.find(presc => presc.id === initialPrescriptionId);
            if (p) {
                handleEdit(null as any, p);
                setHasInitializedEdit(true);
            }
        }
    }, [initialPrescriptionId, contextPrescriptions, pesticides, hasInitializedEdit]);

    useEffect(() => {
        if (!selectedFarmer || prescriptionPriceType !== 'TERM' || isManualDueDate) {
            if (prescriptionPriceType !== 'TERM') {
                setPrescriptionDueDate('');
            }
            return;
        }

        // Use selected plant for calculation if available
        const plant = contextPlants.find(p => p.id === selectedPlantId);
        if (plant && plant.maturityDate) {
            const [month, day] = plant.maturityDate.split('-').map(Number);
            if (!isNaN(month) && !isNaN(day)) {
                const now = new Date();
                let year = now.getFullYear();
                
                // If the maturity date for this year has passed significantly (e.g. 1 month), set to next year
                // But usually in seasonal agriculture, we target the upcoming harvest.
                const targetDate = new Date(year, month - 1, day);
                if (targetDate < now) {
                    // Check if it's way in the past
                    const diffDays = (now.getTime() - targetDate.getTime()) / (1000 * 3600 * 24);
                    if (diffDays > 30) {
                        year += 1;
                    }
                }
                
                const calculatedDate = new Date(year, month - 1, day);
                setPrescriptionDueDate(format(calculatedDate, 'yyyy-MM-dd'));
                return;
            }
        }
        
        const field = selectedFarmer.fields?.find(f => f.id === selectedFieldId);
        if (!field) {
            setPrescriptionDueDate('');
            return;
        }

        const currentYear = new Date().getFullYear();
        let targetMonth = 11; // Aralık, 0-indexed (December)
        let targetDay = 31;
        const cropLower = (field.crop || '').toLocaleLowerCase('tr-TR');

        if (cropLower.includes('arpa')) {
            targetMonth = 5; // Haziran (June)
            targetDay = 1;
        } else if (cropLower.includes('buğday') || cropLower.includes('bugday')) {
            targetMonth = 5; // Haziran
            targetDay = 15;
        } else if (cropLower.includes('pamuk')) {
            targetMonth = 10; // Kasım (November)
            targetDay = 1;
        } else if (cropLower.includes('mısır') || cropLower.includes('misir')) {
            targetMonth = 10; // Kasım
            targetDay = 15;
        }

        const calculatedDate = new Date(currentYear, targetMonth, targetDay);
        setPrescriptionDueDate(format(calculatedDate, 'yyyy-MM-dd'));

    }, [selectedFieldId, selectedFarmer, prescriptionPriceType, selectedPlantId, contextPlants]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fListRaw, pestList] = await Promise.all([
                dbService.getFarmers(),
                dbService.getPesticides()
            ]);
            const fList = fListRaw.filter(f => !f.deletedAt);

            setFarmers(fList);
            setPesticides(pestList);

            const fMap: Record<string, Farmer> = {};
            fListRaw.forEach(f => { fMap[f.id] = f; });
            setFarmerMap(fMap);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackFromForm = () => {
        if (step > 1 && !initialFarmerId) {
            window.history.back();
        } else if (initialFarmerId) {
            onBack(); 
        } else {
            changeViewMode('LIST');
            resetForm();
        }
    };

    const resetForm = (type: 'SALE' | 'RETURN' = 'SALE') => {
        setStep(1);
        setSelectedFarmer(null);
        setFarmerSearchTerm('');
        setPesticideSearchTerm('');
        setSelectedItems([]);
        setSelectedFieldId('');
        setSelectedFieldIds([]);
        setSelectedPlantId('');
        setDetailPrescription(null);
        setIsProcessingPdf(false);
        setEditingId(null);
        setHasInitializedEdit(false);
        setHasInitializedFarmer(false);
        setShowPrices(true);
        setCustomPrescriptionNo('');
        setPrescriptionPriceType('TERM');
        setPrescriptionDueDate('');
        setIsManualDueDate(false);
        setPrescriptionType(type);
    };

    const addItem = (pesticide: Pesticide) => {
        setSelectedItems(prevItems => {
            const existingItem = prevItems.find(i => i.pesticide.id === pesticide.id);
            if (existingItem) {
                // Increment quantity if already exists
                const currentQty = parseFloat(existingItem.quantity.replace(',', '.')) || 0;
                const newQty = currentQty + 1;
                const price = parseFloat(existingItem.unitPrice || '0') || 0;
                
                return prevItems.map(i => 
                    i.pesticide.id === pesticide.id 
                        ? { ...i, quantity: newQty.toString(), totalPrice: newQty * price }
                        : i
                );
            } else {
                // Find inventory item to get selling price
                const inventoryItem = contextInventory.find(inv => inv.pesticideId === pesticide.id);
                let sellingPrice = '';
                let initialPrice = 0;
                let costPrice = 0;
                
                if (inventoryItem) {
                    if (prescriptionPriceType === 'CASH' && inventoryItem.cashPrice) {
                        sellingPrice = inventoryItem.cashPrice.toString();
                        initialPrice = inventoryItem.cashPrice;
                    } else {
                        sellingPrice = inventoryItem.sellingPrice.toString();
                        initialPrice = inventoryItem.sellingPrice;
                    }
                    costPrice = inventoryItem.buyingPrice || 0;
                }

                // Initialize quantity as '1'
                const initialQty = 1;
                
                return [...prevItems, { 
                    pesticide, 
                    dosage: pesticide.defaultDosage, 
                    quantity: initialQty.toString(), 
                    unitPrice: sellingPrice, 
                    totalPrice: initialQty * initialPrice,
                    buyingPrice: costPrice
                }];
            }
        });
        setPesticideSearchTerm(''); // Seçimden sonra aramayı temizle
    };

    const removeItem = (id: string) => {
        setSelectedItems(selectedItems.filter(i => i.pesticide.id !== id));
    };

    const updateDosage = (id: string, newDosage: string) => {
        setSelectedItems(selectedItems.map(i => i.pesticide.id === id ? { ...i, dosage: newDosage } : i));
    };

    const updateQuantity = (id: string, newQuantity: string) => {
        setSelectedItems(selectedItems.map(i => {
            if (i.pesticide.id === id) {
                const qty = parseFloat(newQuantity.replace(',', '.')) || 0;
                const price = parseFloat((i.unitPrice || '0').replace(',', '.')) || 0;
                return { ...i, quantity: newQuantity, totalPrice: qty * price };
            }
            return i;
        }));
    };

    const updatePrice = (id: string, newPrice: string) => {
        setSelectedItems(selectedItems.map(i => {
            if (i.pesticide.id === id) {
                const qty = parseFloat((i.quantity || '0').replace(',', '.')) || 0;
                const price = parseFloat(newPrice.replace(',', '.')) || 0;
                return { ...i, unitPrice: newPrice, totalPrice: qty * price };
            }
            return i;
        }));
    };

    const handlePriceTypeChange = (newType: 'CASH' | 'TERM') => {
        setPrescriptionPriceType(newType);
        setSelectedItems(selectedItems.map(i => {
            const invItem = contextInventory.find(inv => inv.pesticideId === i.pesticide.id);
            let newPrice = i.unitPrice;
            if (invItem) {
                if (newType === 'CASH' && invItem.cashPrice) {
                    newPrice = invItem.cashPrice.toString();
                } else {
                    newPrice = invItem.sellingPrice.toString();
                }
            }
            const qty = parseFloat(i.quantity.replace(',', '.')) || 0;
            const price = parseFloat(newPrice || '0') || 0;
            return { ...i, unitPrice: newPrice, totalPrice: qty * price };
        }));
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setPrescriptionToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!prescriptionToDelete) return;
        await softDeletePrescription(prescriptionToDelete);
        await loadData();
        showToast(`${prescriptionLabel} ${t('toast.movedToTrash') || 'çöp kutusuna taşındı'}`, 'info');
        hapticFeedback('medium');
        if (viewMode === 'DETAIL') {
            changeViewMode('LIST');
            setDetailPrescription(null);
        }
        setPrescriptionToDelete(null);
    };

    const handleEdit = (e: React.MouseEvent | null, p: Prescription) => {
        if (e) e.stopPropagation();
        
        const farmer = farmerMap[p.farmerId];
        if (farmer) {
            setSelectedFarmer(farmer);
            setSelectedFieldId(p.fieldId || '');
            setSelectedFieldIds(p.fieldIds || (p.fieldId ? [p.fieldId] : []));
            setSelectedPlantId(p.plantId || '');
        }

        // Reconstruct Pesticide objects from stored items
        const reconstructedItems = p.items.map(item => {
            const libraryPesticide = pesticides.find(pest => pest.id === item.pesticideId);
            const basePesticide = libraryPesticide || {
                id: item.pesticideId,
                name: item.pesticideName,
                activeIngredient: 'Bilinmiyor',
                defaultDosage: item.dosage,
                category: PesticideCategory.OTHER,
                description: 'Kütüphaneden silinmiş ilaç'
            } as Pesticide;

            return { 
                pesticide: basePesticide, 
                dosage: item.dosage,
                quantity: item.quantity || '', // Map existing quantity or default to empty
                unitPrice: item.unitPrice ? item.unitPrice.toString() : '',
                totalPrice: item.totalPrice || 0,
                buyingPrice: item.buyingPrice
            };
        });

        // Eğer en az bir üründe fiyat varsa, fiyat modunu aç
        if (reconstructedItems.some(i => i.unitPrice)) {
            setShowPrices(true);
        } else {
            setShowPrices(false);
        }

        setCustomPrescriptionNo(p.prescriptionNo || '');
        setPrescriptionPriceType(p.priceType || 'TERM');
        setPrescriptionType(p.type || 'SALE');
        if (p.dueDate) {
            setPrescriptionDueDate(p.dueDate.split('T')[0]);
            setIsManualDueDate(true);
        } else {
            setPrescriptionDueDate('');
            setIsManualDueDate(false);
        }
        setSelectedItems(reconstructedItems);
        setEditingId(p.id);
        changeViewMode('FORM');
        setStep(2); // Set step without pushing again since changeViewMode already pushed
        window.history.replaceState({ ...window.history.state, step: 2 }, '');
    };

    const handleViewDetail = (p: Prescription) => {
        setDetailPrescription(p);
        const farmer = farmerMap[p.farmerId];
        if (farmer) setSelectedFarmer(farmer);
        changeViewMode('DETAIL', p.id);
    };

    const toggleProcessed = async (e: React.MouseEvent, p: Prescription) => {
        e.stopPropagation();
        
        try {
            const updated = await togglePrescriptionStatus(p.id);
            showToast(p.isProcessed ? `${prescriptionLabel} işlenmedi olarak işaretlendi` : `${prescriptionLabel} işlendi olarak işaretlendi`, 'success');
            hapticFeedback('success');
            
            // If we are in detail view, update the detail state as well
            if (detailPrescription && detailPrescription.id === p.id && updated) {
                setDetailPrescription(updated);
            }
        } catch (error) {
            console.error("Toggle processed error:", error);
            showToast("Durum güncellenirken bir hata oluştu.", 'error');
            hapticFeedback('error');
        }
    };

    const handleStatusChange = async (e: React.MouseEvent, p: Prescription, newStatus: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'INVOICED') => {
        e.stopPropagation();
        
        setConfirmModal({
            isOpen: true,
            title: 'Durum Değiştirilecek',
            message: `Sipariş durumunu '${newStatus}' olarak değiştirmek istiyor musunuz?`,
            variant: 'info',
            onConfirm: async () => {
                try {
                    const updatedPrescription = { 
                        ...p, 
                        status: newStatus,
                        deliveredById: newStatus === 'DELIVERED' ? (activeTeamMember?.id || p.deliveredById) : p.deliveredById
                    };
                    await dbService.updatePrescription(updatedPrescription);
                    await refreshStats();
                    
                    // Update context by triggering a refresh or manual state update
                    // For now, updating local detail state
                    if (detailPrescription && detailPrescription.id === p.id) {
                        setDetailPrescription(updatedPrescription);
                    }
                    showToast(`Sipariş durumu güncellendi`, 'success');
                    hapticFeedback('success');
                } catch (error) {
                    console.error("Error updating status:", error);
                    showToast("İşlem sırasında bir hata oluştu", 'error');
                    hapticFeedback('error');
                }
            }
        });
    };

    const handleSave = async () => {
        if (!selectedFarmer) return;
        
        const items = selectedItems.map(i => ({
            pesticideId: i.pesticide.id,
            pesticideName: i.pesticide.name,
            dosage: i.dosage,
            quantity: i.quantity ? i.quantity.replace(',', '.') : '', // Save standardized quantity
            unitPrice: i.unitPrice ? parseFloat(i.unitPrice.replace(',', '.')) : undefined,
            totalPrice: i.totalPrice,
            buyingPrice: i.buyingPrice
        }));

        const initialTotal = items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
        const discountValue = parseFloat(prescriptionDiscount.replace(',', '.')) || 0;
        const totalAmount = Math.max(0, initialTotal - discountValue);
        
        if (editingId) {
            // Update existing
            const original = contextPrescriptions.find(p => p.id === editingId);
            if (!original) return;

            // If it was already processed, revert old inventory first
            if (original.isInventoryProcessed) {
                await dbService.revertInventory(original);
            }

            const updatedPrescription: Prescription = {
                ...original,
                farmerId: selectedFarmer.id,
                fieldId: selectedFieldIds.length === 1 ? selectedFieldIds[0] : (selectedFieldId || undefined),
                fieldIds: selectedFieldIds,
                plantId: selectedPlantId || undefined,
                engineerName: userProfile.fullName || original.engineerName,
                prescriptionNo: customPrescriptionNo.trim() || original.prescriptionNo,
                items: items,
                totalAmount: totalAmount > 0 ? totalAmount : undefined,
                discountAmount: discountValue > 0 ? discountValue : undefined,
                priceType: prescriptionPriceType,
                type: prescriptionType,
                dueDate: prescriptionPriceType === 'TERM' && prescriptionDueDate ? new Date(prescriptionDueDate).toISOString() : undefined,
                isProcessed: original.isProcessed,
                isInventoryProcessed: false // Reset this so it can be re-processed
            };

            await dbService.updatePrescription(updatedPrescription);
            
            // Re-process with new items unconditionally
            await dbService.processInventory(updatedPrescription);
            await refreshStats();

            const finalUpdated = { ...updatedPrescription, isInventoryProcessed: true };
            setDetailPrescription(finalUpdated);
            changeViewMode('DETAIL', finalUpdated.id);
        } else {
            // Create new
            const newPrescription: Prescription = {
                id: crypto.randomUUID(),
                farmerId: selectedFarmer.id,
                fieldId: selectedFieldIds.length === 1 ? selectedFieldIds[0] : (selectedFieldId || undefined),
                fieldIds: selectedFieldIds,
                plantId: selectedPlantId || undefined,
                date: new Date().toISOString(),
                prescriptionNo: customPrescriptionNo.trim() || `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                engineerName: userProfile.fullName || 'Ziraat Mühendisi',
                items: items,
                isOfficial: true,
                isProcessed: false,
                isInventoryProcessed: false,
                totalAmount: totalAmount > 0 ? totalAmount : undefined,
                discountAmount: discountValue > 0 ? discountValue : undefined,
                priceType: prescriptionPriceType,
                type: prescriptionType,
                dueDate: prescriptionPriceType === 'TERM' && prescriptionDueDate ? new Date(prescriptionDueDate).toISOString() : undefined,
                status: undefined,
                createdById: activeTeamMember?.id
            };

            await dbService.addPrescription(newPrescription);
            await dbService.processInventory(newPrescription);
            
            const currentTypeLabel = newPrescription.type === 'RETURN' ? 'İade Faturası' : 'Satış Faturası';
            
            // Create a visit log entry automatically
            const newVisit: VisitLog = {
                id: crypto.randomUUID(),
                farmerId: selectedFarmer.id,
                fieldId: selectedFieldIds.length > 0 ? selectedFieldIds[0] : (selectedFieldId || undefined),
                date: new Date().toISOString(),
                note: `${currentTypeLabel} işlendi (${newPrescription.prescriptionNo})`,
                village: selectedFarmer.village
            };
            await dbService.addVisit(newVisit);
            
            // Add a notification
            const newNotification: AppNotification = {
                id: crypto.randomUUID(),
                type: 'SUCCESS',
                title: `${currentTypeLabel} ve Reçete Kaydı`,
                message: `${selectedFarmer.fullName} için ${currentTypeLabel.toLowerCase()} işlendi ve ziyaret kaydı oluşturuldu.`,
                date: new Date().toISOString(),
                isRead: false
            };
            await dbService.addNotification(newNotification);
            
            const finalNew = { ...newPrescription, isInventoryProcessed: true };
            setDetailPrescription(finalNew);
            changeViewMode('DETAIL', finalNew.id, true);
        }

        await loadData();
        await refreshStats();
        showToast(`${currentPrescriptionLabel} başarıyla kaydedildi`, 'success');
        hapticFeedback('success');
    };

    const handleWhatsAppText = (targetPrescription: Prescription, targetFarmer: Farmer) => {
        const farmer = farmerMap[targetPrescription.farmerId];
        const typeLabel = targetPrescription.type === 'RETURN' ? 'İADE FATURASI' : 'ZİRAİ FATURA';
        let text = `*${typeLabel}*\n`;
        text += `Sayın *${targetFarmer.fullName}*,\n\n`;
        
        const fIds = targetPrescription.fieldIds || (targetPrescription.fieldId ? [targetPrescription.fieldId] : []);
        if (fIds.length > 0 && farmer?.fields) {
            const names = fIds.map(id => farmer.fields.find(f => f.id === id)?.name).filter(Boolean);
            if (names.length > 0) {
                text += `Araziler: ${names.join(', ')}\n`;
            }
        }

        text += `Tarih: ${new Date(targetPrescription.date).toLocaleDateString('tr-TR')}\n`;
        text += `Fatura No: ${targetPrescription.prescriptionNo}\n\n`;
        
        const hasPrices = targetPrescription.items.some(item => item.unitPrice && item.unitPrice > 0);

        if (hasPrices) {
            text += `*Ürün Listesi:*\n`;
            targetPrescription.items.forEach(item => {
                const qty = item.quantity ? item.quantity.toString().replace(/^-/, '').replace(',', '.') : '1';
                const price = item.unitPrice || 0;
                const total = Math.abs(item.totalPrice || (parseFloat(qty) * price) || 0);
                
                text += `- ${item.pesticideName}: ${qty} Adet x ${formatCurrency(price, userProfile?.currency || 'TRY')} = *${formatCurrency(total, userProfile?.currency || 'TRY')}*\n`;
            });
            
            if (targetPrescription.totalAmount) {
                if (targetPrescription.discountAmount && targetPrescription.discountAmount > 0) {
                    text += `\nAra Toplam: ${formatCurrency(targetPrescription.totalAmount + targetPrescription.discountAmount, userProfile?.currency || 'TRY')}\n`;
                    text += `İskonto (İndirim): -${formatCurrency(targetPrescription.discountAmount, userProfile?.currency || 'TRY')}\n`;
                }
                text += `\n*ÖDENECEK TUTAR: ${formatCurrency(targetPrescription.totalAmount, userProfile?.currency || 'TRY')}*\n`;
            }
        } else {
            text += `*Kullanılacak İlaçlar:*\n`;
            targetPrescription.items.forEach(item => {
                text += `- ${item.pesticideName}: *${item.dosage}*`;
                if (item.quantity) text += ` (${item.quantity} Adet)`;
                text += `\n`;
            });
        }
        
        text += `\nGeçmiş olsun.\n${targetPrescription.engineerName}`;
        
        const url = `https://wa.me/${targetFarmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handlePdfAction = async (action: 'SHARE' | 'DOWNLOAD', targetPrescription?: Prescription, targetFarmer?: Farmer) => {
        if (!receiptRef.current) return;
        setIsProcessingPdf(true);

        const currentPrescription = targetPrescription || detailPrescription;
        const currentFarmer = targetFarmer || selectedFarmer;

        if (!currentPrescription || !currentFarmer) return;

        try {
            // Mobile Optimization: Reduced Scale & JPEG
            const canvas = await html2canvas(receiptRef.current, {
                scale: 2, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF('p', 'mm', 'a5');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth * ratio, imgHeight * ratio);
            
            const pdfBlob = pdf.output('blob');
            
            // Türkçe karakterleri tamamen ASCII'ye çevir (Android dosya sistemi uyumluluğu için)
            const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
            const safeName = currentFarmer.fullName
                .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            const pNo = currentPrescription.prescriptionNo;
            const fileName = `${safeName}_${currentPrescription.type === 'RETURN' ? 'Iade' : 'Satis'}_${pNo}.pdf`;

            if (action === 'DOWNLOAD') {
                pdf.save(fileName);
            } else {
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                const shareData = {
                    files: [file],
                    title: currentPrescription.type === 'RETURN' ? 'İade Faturası' : 'Zirai Satış Faturası',
                };
                try {
                    if (navigator.canShare && navigator.canShare(shareData)) {
                        await navigator.share(shareData);
                    } else {
                        throw new Error("Share API not supported");
                    }
                } catch (err) {
                    console.warn("Share failed, fallback to download", err);
                    pdf.save(fileName);
                }
            }

        } catch (error) {
            console.error("PDF Action Error:", error);
            alert("PDF işleminde bir hata oluştu.");
        } finally {
            setIsProcessingPdf(false);
        }
    };

    const filteredFarmers = farmers.filter(f => 
        f.fullName.toLocaleLowerCase('tr-TR').includes(farmerSearchTerm.toLocaleLowerCase('tr-TR')) ||
        f.village.toLocaleLowerCase('tr-TR').includes(farmerSearchTerm.toLocaleLowerCase('tr-TR'))
    );

    const filteredInventoryItems = contextInventory.filter(inv => 
        inv.pesticideName.toLocaleLowerCase('tr-TR').includes(pesticideSearchTerm.toLocaleLowerCase('tr-TR'))
    );

    const filteredPrescriptions = contextPrescriptions.filter(p => {
        const farmer = farmerMap[p.farmerId];
        const search = prescriptionSearchTerm.toLocaleLowerCase('tr-TR');
        
        const matchesSearch = p.prescriptionNo.toLocaleLowerCase('tr-TR').includes(search) ||
            (farmer?.fullName && farmer.fullName.toLocaleLowerCase('tr-TR').includes(search));
            
        const matchesFilter = filterMode === 'ALL' || 
            (filterMode === 'PROCESSED' && p.isProcessed) ||
            (filterMode === 'UNPROCESSED' && !p.isProcessed);
            
        return matchesSearch && matchesFilter;
    });

    const trToEn = (text: string) => {
        if (!text) return '';
        return text
            .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
            .replace(/Ü/g, 'U').replace(/ü/g, 'u')
            .replace(/Ş/g, 'S').replace(/ş/g, 's')
            .replace(/İ/g, 'I').replace(/ı/g, 'i')
            .replace(/Ö/g, 'O').replace(/ö/g, 'o')
            .replace(/Ç/g, 'C').replace(/ç/g, 'c');
    };

    const pdfCurrency = (amount: number) => {
        return new Intl.NumberFormat('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const generatePrescriptionReportPDF = () => {
        setIsGeneratingReport(true);
        setTimeout(() => {
            try {
                const doc = new jsPDF();
                
                doc.setFont("helvetica", "bold");
                doc.setFontSize(22);
                doc.setTextColor(59, 130, 246);
                doc.text(trToEn(userProfile?.companyName || "FATURA RAPORU"), 14, 22);
                
                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.setFont("helvetica", "normal");
                doc.text(`Tarih Araligi: ${format(new Date(reportStartDate), 'dd.MM.yyyy')} - ${format(new Date(reportEndDate), 'dd.MM.yyyy')}`, 14, 30);
                doc.text(`Olusturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 35);
                
                let currentY = 45;

                const start = new Date(reportStartDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(reportEndDate);
                end.setHours(23, 59, 59, 999);

                const filtered = contextPrescriptions.filter(p => {
                    const date = new Date(p.date || Date.now());
                    return date >= start && date <= end;
                });

                let totalSales = 0;
                let totalReturns = 0;

                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 0, 0);
                doc.text(trToEn(reportTypeSelection === 'DETAILED' ? "FATURA LISTESI (DETAYLI)" : "FATURA LISTESI (ÖZET)"), 14, currentY);

                if (reportTypeSelection === 'SUMMARY') {
                    const tableData = filtered.map(p => {
                        const farmer = contextFarmers.find(f => f.id === p.farmerId);
                        const netAmount = p.totalAmount || 0;
                        
                        if (p.type === 'RETURN') {
                            totalReturns += netAmount;
                        } else {
                            totalSales += netAmount;
                        }

                        return [
                            format(new Date(p.date || Date.now()), 'dd.MM.yyyy'),
                            trToEn(farmer?.fullName || '-'),
                            p.prescriptionNo || '-',
                            p.type === 'RETURN' ? 'Iade' : 'Satis',
                            p.dueDate ? format(new Date(p.dueDate), 'dd.MM.yyyy') : '-',
                            pdfCurrency(netAmount)
                        ];
                    });

                    autoTable(doc, {
                        startY: currentY + 5,
                        head: [['Tarih', 'Musteri', 'Fatura No', 'Tur', 'Vade', 'Tutar']],
                        body: tableData.length > 0 ? tableData : [['Secili tarihte kayit yok.', '', '', '', '', '']],
                        theme: 'grid',
                        styles: { font: 'helvetica', fontSize: 9 },
                        headStyles: { fillColor: [59, 130, 246] },
                        columnStyles: { 5: { halign: 'right' } }
                    });
                } else {
                    const tableBody: any[] = [];
                    filtered.forEach(p => {
                        const farmer = contextFarmers.find(f => f.id === p.farmerId);
                        const pDate = format(new Date(p.date || Date.now()), 'dd.MM.yyyy');
                        const vDate = p.dueDate ? ` | Vade: ${format(new Date(p.dueDate), 'dd.MM.yyyy')}` : '';
                        const netAmount = p.totalAmount || 0;
                        
                        if (p.type === 'RETURN') {
                            totalReturns += netAmount;
                        } else {
                            totalSales += netAmount;
                        }
                        
                        // Invoice Header Row
                        tableBody.push([
                            { 
                                content: `${pDate} | ${trToEn(farmer?.fullName || '-')} | Fatura No: ${p.prescriptionNo || '-'} | Tur: ${p.type === 'RETURN' ? 'Iade' : 'Satis'}${vDate}`, 
                                colSpan: 4, 
                                styles: { fillColor: [245, 245, 245], fontStyle: 'bold', textColor: [0,0,0] } 
                            },
                            {
                                content: pdfCurrency(netAmount),
                                styles: { fillColor: [245, 245, 245], fontStyle: 'bold', textColor: [0,0,0], halign: 'right' } 
                            }
                        ]);
                        
                        // Invoice Items
                        p.items.forEach(item => {
                            tableBody.push([
                                '', // indent
                                trToEn(item.pesticideName),
                                item.quantity ? `${item.quantity}` : '-',
                                item.unitPrice ? pdfCurrency(item.unitPrice) : '-',
                                item.totalPrice ? pdfCurrency(item.totalPrice) : '-'
                            ]);
                        });

                        // Discount Row
                        if (p.discountAmount && p.discountAmount > 0) {
                            tableBody.push([
                                '', 
                                { content: 'İskonto (Indirim)', styles: { fontStyle: 'bold', textColor: [220, 38, 38] } },
                                '', 
                                '', 
                                { content: `-${pdfCurrency(p.discountAmount)}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38], halign: 'right' } }
                            ]);
                        }
                    });

                    autoTable(doc, {
                        startY: currentY + 5,
                        head: [['', 'Urun Adi', 'Miktar', 'Birim Fiyat', 'Tutar']],
                        body: tableBody.length > 0 ? tableBody : [['', 'Secili tarihte kayit yok.', '', '', '']],
                        theme: 'grid',
                        styles: { font: 'helvetica', fontSize: 9 },
                        headStyles: { fillColor: [59, 130, 246] },
                        columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
                    });
                }

                currentY = (doc as any).lastAutoTable.finalY + 15;

                // Summary
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(trToEn("OZET"), 14, currentY);

                autoTable(doc, {
                    startY: currentY + 5,
                    head: [['Kalem', 'Tutar']],
                    body: [
                        ['Toplam Satis Tutari', pdfCurrency(totalSales)],
                        ['Toplam Iade Tutari', pdfCurrency(totalReturns)],
                        ['Net Toplam', pdfCurrency(totalSales - totalReturns)]
                    ],
                    theme: 'grid',
                    styles: { font: 'helvetica', fontSize: 10 },
                    headStyles: { fillColor: [16, 185, 129] },
                    columnStyles: { 1: { halign: 'right' } }
                });

                doc.save(`Fatura_Raporu_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
                setIsGeneratingReport(false);
                setIsReportModalOpen(false);
            } catch (error) {
                console.error(error);
                setIsGeneratingReport(false);
                alert("PDF oluşturulurken bir hata oluştu.");
            }
        }, 500);
    };

    if (viewMode === 'LIST') {
        return (
            <div className="relative h-full min-h-[80vh]">
                <div className="p-4 max-w-3xl mx-auto pb-24">
                    <header className="mb-4 flex justify-between items-center sticky top-0 bg-stone-950/80 backdrop-blur z-20 py-2">
                        <div>
                            <h2 className="text-2xl font-bold text-stone-100">{t('prescription.title', { label: prescriptionLabel })}</h2>
                            <p className="text-sm text-stone-500">{t('prescription.subtitle', { label: prescriptionLabel.toLowerCase() })}</p>
                            {userProfile.lastSyncTime && (
                                <p className="text-[10px] text-emerald-500/80 mt-0.5 flex items-center">
                                    <Check size={10} className="mr-1" />
                                    {t('prescription.last_sync')}: {new Date(userProfile.lastSyncTime).toLocaleTimeString(userProfile.language === 'tr' ? 'tr-TR' : userProfile.language === 'ar' ? 'ar-SA' : 'en-US', {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            )}
                        </div>
                        <button 
                            onClick={() => setIsReportModalOpen(true)}
                            className="px-3 py-1.5 bg-stone-900 text-stone-400 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-800 transition-all active:scale-95 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                            title="Rapor Oluştur"
                        >
                            <FileText size={14} />
                            Rapor
                        </button>
                    </header>

                    <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-6 sticky top-20 z-10 backdrop-blur-md">
                        <Search className="text-stone-500 ml-3" size={18} />
                        <input 
                            type="text" 
                            placeholder={t('prescription.search_placeholder', { farmer: farmerLabel, label: prescriptionLabel.toLowerCase() })} 
                            className="w-full p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-sm"
                            value={prescriptionSearchTerm}
                            onChange={e => setPrescriptionSearchTerm(e.target.value)}
                        />
                        {prescriptionSearchTerm && (
                            <button onClick={() => setPrescriptionSearchTerm('')} className="p-2 text-stone-500 hover:text-stone-300">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex p-1 bg-stone-900/80 backdrop-blur-xl rounded-2xl border border-white/5 mb-8 w-fit shadow-inner">
                        <button 
                            onClick={() => setFilterMode('ALL')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                filterMode === 'ALL' 
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            {t('prescription.filter_all')}
                        </button>
                        <button 
                            onClick={() => setFilterMode('UNPROCESSED')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                filterMode === 'UNPROCESSED' 
                                ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${filterMode === 'UNPROCESSED' ? 'bg-white animate-pulse' : 'bg-rose-500'}`}></div>
                            {t('prescription.filter_unprocessed')}
                        </button>
                        <button 
                            onClick={() => setFilterMode('PROCESSED')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                                filterMode === 'PROCESSED' 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 scale-[1.02]' 
                                : 'text-stone-500 hover:text-stone-300'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${filterMode === 'PROCESSED' ? 'bg-white' : 'bg-blue-500'}`}></div>
                            {t('prescription.filter_processed')}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {isLoading ? (
                            <ListSkeleton count={5} />
                        ) : filteredPrescriptions.length === 0 ? (
                            <EmptyState
                                icon={FileText}
                                title={prescriptionSearchTerm ? t('prescription.empty_search', { label: prescriptionLabel.toLowerCase() }) : t('prescription.empty_list', { label: prescriptionLabel.toLowerCase() })}
                                description={!prescriptionSearchTerm ? t('prescription.empty_hint', { label: prescriptionLabel.toLowerCase() }) : ''}
                                actionLabel={canCreatePrescription && !prescriptionSearchTerm ? `Yeni ${prescriptionLabel} Oluştur` : undefined}
                                onAction={canCreatePrescription && !prescriptionSearchTerm ? () => changeViewMode('FORM') : undefined}
                                actionIcon={Plus}
                            />
                        ) : (
                            filteredPrescriptions.map(p => {
                                const farmer = farmerMap[p.farmerId];
                                const dateObj = new Date(p.date);

                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => handleViewDetail(p)}
                                        className="bg-stone-900/80 backdrop-blur-xl p-2.5 rounded-2xl shadow-xl border border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden group cursor-pointer active:scale-[0.98]"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold border shadow-inner shrink-0 ${p.type === 'RETURN' ? 'bg-amber-900/20 text-amber-500 border-amber-500/20' : 'bg-blue-900/20 text-blue-400 border-blue-500/20'}`}>
                                                    {p.type === 'RETURN' ? <ArrowLeft size={16} /> : <FileText size={16} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <h3 className="font-black text-stone-100 text-sm leading-tight truncate tracking-tight">{farmer?.fullName || t('prescription.unknown_farmer', { farmer: farmerLabel })}</h3>
                                                        {p.type === 'RETURN' && (
                                                            <span className="text-[7px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30">İADE</span>
                                                        )}
                                                        {p.priceType === 'CASH' && (
                                                            <span className="text-[7px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/30">PEŞİN</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-[8px] text-stone-500 font-black uppercase tracking-widest">{p.prescriptionNo}</p>
                                                        <span className="text-[8px] text-stone-400 font-bold flex items-center bg-stone-800/50 px-1.5 py-0.5 rounded">
                                                            <User size={8} className="mr-1" />
                                                            {p.createdById ? (teamMembers.find(m => m.id === p.createdById)?.fullName || t('prescription.manager')) : t('prescription.manager')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                                                <div className="flex items-center gap-1.5">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setShowProfitId(p.id); }}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 transition-all active:scale-90"
                                                        title="Kar/Zarar Analizi"
                                                    >
                                                        <TrendingUp size={14} />
                                                    </button>
                                                    {p.totalAmount && p.totalAmount > 0 && (
                                                        <span className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded border shadow-sm ${p.type === 'RETURN' ? 'bg-amber-950/50 text-amber-400 border-amber-500/20' : 'bg-emerald-950/50 text-emerald-400 border-emerald-500/20'}`}>
                                                            {p.type === 'RETURN' ? '-' : ''}{formatCurrency(p.totalAmount, userProfile?.currency || 'TRY')}
                                                        </span>
                                                    )}
                                                    <span className="text-[8px] font-black text-stone-400 flex items-center bg-stone-950/50 px-1.5 py-0.5 rounded border border-white/5 shadow-sm uppercase tracking-widest">
                                                        <Calendar size={8} className="mr-1" />
                                                        {dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <button 
                                                        type="button"
                                                        onClick={(e) => toggleProcessed(e, p)}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border-2 active:scale-90 relative z-30 shadow-lg ${
                                                            p.isProcessed 
                                                            ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                                                            : 'bg-rose-600/10 border-rose-500/30 text-rose-400'
                                                        }`}
                                                    >
                                                        {p.isProcessed ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                                                    </button>
                                            </div>
                                        </div>
                                        <div className="pl-11 mt-1">
                                            <div className="flex flex-wrap gap-1">
                                                {p.items.slice(0, 3).map((item, idx) => (
                                                    <span key={idx} className="text-[7px] font-black uppercase tracking-widest bg-stone-950/50 text-stone-500 px-1.5 py-0.5 rounded border border-white/5">
                                                        {item.pesticideName} {item.quantity && `(x${item.quantity.toString().replace(/^-/, '')})`}
                                                    </span>
                                                ))}
                                                {p.items.length > 3 && (
                                                    <span className="text-[7px] font-black uppercase tracking-widest bg-stone-950/50 text-stone-600 px-1.5 py-0.5 rounded border border-white/5">
                                                        +{p.items.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {canCreatePrescription && (
                    <div className="fixed bottom-32 right-6 md:bottom-10 md:right-10 z-50 flex flex-col gap-2 shadow-2xl">
                        <button 
                            onClick={() => { resetForm('RETURN'); changeViewMode('FORM'); }}
                            className="bg-amber-500 text-stone-900 px-6 py-3 rounded-full shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all transform hover:scale-105 flex items-center justify-center gap-2 font-bold text-sm border border-stone-900"
                        >
                            <ArrowLeft size={18} /> İade Faturası
                        </button>
                        <button 
                            onClick={() => { resetForm('SALE'); changeViewMode('FORM'); }}
                            className="bg-emerald-600 text-white px-6 py-4 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 flex items-center justify-center gap-2 font-bold text-sm"
                        >
                            <Plus size={24} /> Satış Faturası
                        </button>
                    </div>
                )}

                {showProfitId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-stone-900 border border-white/10 w-full max-w-[280px] rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-base font-black text-stone-100 flex items-center gap-2">
                                    <TrendingUp className="text-emerald-500" size={18} />
                                    Kar/Zarar
                                </h2>
                                <button onClick={() => setShowProfitId(null)} className="p-1.5 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                            </div>

                            {(() => {
                                const p = contextPrescriptions.find(presc => presc.id === showProfitId);
                                if (!p) return null;

                                const totalSales = p.totalAmount || 0;
                                const itemsWithCost = p.items.map(item => {
                                    const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
                                    let cost = item.buyingPrice;
                                    if (cost === undefined) {
                                        const invItem = contextInventory.find(inv => inv.pesticideId === item.pesticideId);
                                        cost = invItem?.buyingPrice || 0;
                                    }
                                    return {
                                        ...item,
                                        qty,
                                        cost,
                                        totalCost: qty * cost,
                                        totalSale: item.totalPrice || 0
                                    };
                                });

                                const totalCost = itemsWithCost.reduce((acc, item) => acc + item.totalCost, 0);
                                const profit = totalSales - totalCost;
                                const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

                                return (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="bg-stone-950 p-3 rounded-xl border border-white/5">
                                                <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5">Satış</p>
                                                <p className="text-base font-black text-stone-100 font-mono">{formatCurrency(totalSales, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            <div className="bg-stone-950 p-3 rounded-xl border border-white/5">
                                                <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5">Maliyet</p>
                                                <p className="text-base font-black text-stone-400 font-mono">{formatCurrency(totalCost, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            <div className={`p-3 rounded-xl border ${profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <p className={`text-[9px] font-black uppercase tracking-widest ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {profit >= 0 ? 'Net Kar' : 'Net Zarar'}
                                                    </p>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${profit >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                        %{profitMargin.toFixed(1)}
                                                    </span>
                                                </div>
                                                <p className={`text-lg font-black font-mono ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formatCurrency(Math.abs(profit), userProfile?.currency || 'TRY')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 no-scrollbar">
                                            {itemsWithCost.map((item, idx) => (
                                                <div key={idx} className="bg-stone-950/50 p-2 rounded-lg border border-white/5 flex justify-between items-center">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-bold text-stone-300 truncate">{item.pesticideName}</p>
                                                        <p className="text-[8px] text-stone-500">{item.qty} x {formatCurrency(item.cost, userProfile?.currency || 'TRY')}</p>
                                                    </div>
                                                    <div className="text-right ml-2">
                                                        <p className={`text-[9px] font-black font-mono ${item.totalSale - item.totalCost >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {formatCurrency(item.totalSale - item.totalCost, userProfile?.currency || 'TRY')}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button 
                                            onClick={() => setShowProfitId(null)}
                                            className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                                        >
                                            Kapat
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                <ConfirmationModal 
                    isOpen={isDeleteModalOpen}
                    onClose={() => { setIsDeleteModalOpen(false); setPrescriptionToDelete(null); }}
                    onConfirm={confirmDelete}
                    title={`${prescriptionLabel} Silinecek`}
                    message={t('prescription.delete_confirm', { label: prescriptionLabel.toLowerCase() }) || `Bu ${prescriptionLabel.toLowerCase()}yi silmek istediğinize emin misiniz?`}
                />

                {isReportModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-black text-stone-100 flex items-center gap-2">
                                    <Calendar className="text-emerald-500" size={20} />
                                    Tarih Aralığı Seçin
                                </h2>
                                <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Rapor Türü</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setReportTypeSelection('SUMMARY')}
                                            className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${reportTypeSelection === 'SUMMARY' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-stone-950 border-white/5 text-stone-400 hover:bg-stone-800'}`}
                                        >
                                            Sadece Fatura (Özet)
                                        </button>
                                        <button 
                                            onClick={() => setReportTypeSelection('DETAILED')}
                                            className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${reportTypeSelection === 'DETAILED' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-stone-950 border-white/5 text-stone-400 hover:bg-stone-800'}`}
                                        >
                                            Detaylı Rapor
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Başlangıç</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-stone-950 text-white rounded-xl p-3 border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                                            value={reportStartDate}
                                            onChange={e => setReportStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Bitiş</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-stone-950 text-white rounded-xl p-3 border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                                            value={reportEndDate}
                                            onChange={e => setReportEndDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold transition-colors"
                                        onClick={() => {
                                            const today = new Date();
                                            setReportStartDate(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
                                            setReportEndDate(format(today, 'yyyy-MM-dd'));
                                        }}
                                    >
                                        Bu Ay
                                    </button>
                                    <button 
                                        className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold transition-colors"
                                        onClick={() => {
                                            const today = new Date();
                                            setReportStartDate(format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'));
                                            setReportEndDate(format(today, 'yyyy-MM-dd'));
                                        }}
                                    >
                                        Bu Yıl
                                    </button>
                                    <button 
                                        className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold transition-colors"
                                        onClick={() => {
                                            setReportStartDate('2020-01-01');
                                            setReportEndDate(format(new Date(), 'yyyy-MM-dd'));
                                        }}
                                    >
                                        Tümü
                                    </button>
                                </div>
                                <button 
                                    onClick={generatePrescriptionReportPDF}
                                    disabled={isGeneratingReport}
                                    className="w-full mt-4 py-3.5 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center hover:bg-emerald-500 active:scale-95 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                                >
                                    {isGeneratingReport ? (
                                        <><Loader2 size={18} className="mr-2 animate-spin" /> Hazırlanıyor...</>
                                    ) : (
                                        <><Download size={18} className="mr-2" /> PDF Oluştur</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (viewMode === 'DETAIL' && detailPrescription) {
        return (
            <div className="p-4 max-w-2xl mx-auto pb-24 animate-in slide-in-from-right duration-200 min-h-[80vh]">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => { setDetailPrescription(null); changeViewMode('LIST'); }} className="text-stone-400 hover:text-stone-200 flex items-center px-2 py-1 rounded-lg hover:bg-stone-900 transition-colors">
                        <ArrowLeft size={20} className="mr-1" /> Listeye Dön
                    </button>
                    <div className="flex space-x-2">
                        <div className="flex items-center space-x-1 bg-stone-900 rounded-full border border-white/10 p-1">
                            <button 
                                type="button"
                                onClick={(e) => toggleProcessed(e, detailPrescription)}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-2 ${
                                    detailPrescription.isProcessed 
                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                                    : 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                                }`}
                            >
                                {detailPrescription.isProcessed ? <Check size={14} /> : <X size={14} />}
                                {detailPrescription.isProcessed ? t('prescription.processed') : t('prescription.unprocessed')}
                            </button>
                        </div>
                        <button 
                            onClick={() => setShowProfitId(detailPrescription.id)} 
                            className="p-2 bg-stone-800 text-emerald-400 rounded-full border border-white/5 hover:bg-stone-700 transition-all"
                            title="Kar/Zarar Analizi"
                        >
                            <TrendingUp size={18} />
                        </button>
                        {canEditPrescription && (
                            <button 
                                onClick={(e) => handleEdit(e, detailPrescription)} 
                                className="p-2 bg-stone-800 text-stone-300 rounded-full border border-white/5 hover:bg-stone-700 hover:text-emerald-400 transition-all"
                                title="Düzenle"
                            >
                                <Edit2 size={18} />
                            </button>
                        )}
                        {canEditPrescription && (
                            <button 
                                onClick={(e) => handleDelete(e, detailPrescription.id)}
                                className="p-2 bg-stone-800 text-stone-300 rounded-full border border-white/5 hover:bg-red-900/40 hover:text-red-400 transition-all"
                                title="Sil"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Receipt View Reuse */}
                <div className="relative mb-8 drop-shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
                    {/* Main Receipt Body */}
                    <div ref={receiptRef} className="bg-[#fdfdfc] px-8 pt-10 pb-6 rounded-t-xl text-left relative overflow-hidden text-stone-800">
                        {/* Subtle noise/texture overlay for paper effect */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

                        {/* Top Thermal Edge Band */}
                        <div className={`absolute top-0 left-0 w-full h-1.5 ${detailPrescription.type === 'RETURN' ? 'bg-amber-500' : 'bg-stone-800'}`}></div>

                        <div className="flex justify-between mb-8 relative z-10">
                            <div>
                                <h3 className="font-bold text-2xl text-stone-900 tracking-tight">
                                    {detailPrescription.type === 'RETURN' ? 'Zirai İade Faturası' : 'Zirai Satış Faturası'}
                                </h3>
                                <p className="text-xs text-stone-400 mt-1 uppercase font-bold tracking-widest">{detailPrescription.prescriptionNo}</p>
                                <p className="text-[10px] text-stone-500 font-bold mt-1 flex items-center">
                                    <User size={10} className="mr-1" />
                                    {detailPrescription.createdById ? (teamMembers.find(m => m.id === detailPrescription.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                </p>
                                {(() => {
                                    const fIds = detailPrescription.fieldIds || (detailPrescription.fieldId ? [detailPrescription.fieldId] : []);
                                    if (fIds.length === 0) return null;
                                    const fieldNames = fIds.map(id => selectedFarmer?.fields?.find(f => f.id === id)?.name).filter(Boolean);
                                    if (fieldNames.length === 0) return null;
                                    return (
                                        <p className="text-[10px] text-emerald-600 font-bold mt-1">
                                            {fieldNames.length > 1 ? 'Araziler: ' : 'Arazi: '}{fieldNames.join(', ')}
                                        </p>
                                    );
                                })()}
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-emerald-700 text-xl">{selectedFarmer?.fullName}</p>
                                <p className="text-xs text-stone-500">{selectedFarmer?.village}</p>
                                <p className="text-[10px] text-stone-400 mt-1">{new Date(detailPrescription.date).toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
                                {detailPrescription.priceType === 'TERM' && (
                                    <div className="mt-2">
                                        <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                            Vade: {detailPrescription.dueDate ? new Date(detailPrescription.dueDate).toLocaleDateString('tr-TR') : 'Belirtilmedi'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="min-h-[250px] relative z-10">
                            {detailPrescription.totalAmount && detailPrescription.totalAmount > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="text-stone-400 uppercase text-[9px] font-black tracking-widest border-b-2 border-stone-200">
                                        <tr>
                                            <th className="pb-3 text-left w-[40%]">Ürün Adı</th>
                                            <th className="pb-3 text-center w-[15%]">Adet</th>
                                            <th className="pb-3 text-right w-[20%]">Birim Fiyat</th>
                                            <th className="pb-3 text-right w-[25%]">Toplam</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {detailPrescription.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="py-3">
                                                    <div className="font-bold text-stone-800">{item.pesticideName}</div>
                                                    <div className="text-[10px] text-stone-500 font-mono mt-0.5">Doz: {item.dosage}</div>
                                                </td>
                                                <td className="py-3 text-center font-bold text-stone-700">
                                                    {item.quantity ? item.quantity.toString().replace(/^-/, '') : '-'}
                                                </td>
                                                <td className="py-3 text-right font-mono text-stone-500">
                                                    {item.unitPrice ? formatCurrency(item.unitPrice, userProfile?.currency || 'TRY') : '-'}
                                                </td>
                                                <td className="py-3 text-right font-mono font-bold text-stone-900">
                                                    {item.totalPrice ? formatCurrency(Math.abs(item.totalPrice), userProfile?.currency || 'TRY') : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        {detailPrescription.discountAmount && detailPrescription.discountAmount > 0 && (
                                            <tr>
                                                <td colSpan={4} className="pt-4 pb-2">
                                                    <div className="border-t-2 border-dashed border-stone-300 pt-4 flex justify-between items-center text-stone-500">
                                                        <span className="font-bold uppercase text-[10px] tracking-widest">
                                                            Ara Toplam
                                                        </span>
                                                        <span className="font-black font-mono text-lg tracking-tight line-through">
                                                            {formatCurrency(Math.abs((detailPrescription.totalAmount || 0) + (detailPrescription.discountAmount || 0)), userProfile?.currency || 'TRY')}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {detailPrescription.discountAmount && detailPrescription.discountAmount > 0 && (
                                            <tr>
                                                <td colSpan={4} className="pb-4">
                                                    <div className="flex justify-between items-center text-rose-500">
                                                        <span className="font-bold uppercase text-[10px] tracking-widest">
                                                            İskonto (İndirim)
                                                        </span>
                                                        <span className="font-black font-mono text-lg tracking-tight">
                                                            -{formatCurrency(Math.abs(detailPrescription.discountAmount || 0), userProfile?.currency || 'TRY')}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td colSpan={4} className={detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? "pt-2" : "pt-4"}>
                                                <div className={`${detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'border-t border-stone-200' : 'border-t-2 border-dashed border-stone-300'} pt-4 flex justify-between items-center`}>
                                                    <span className={`font-bold uppercase text-[10px] tracking-widest ${detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                                                        {detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'İNDİRİMLİ TUTAR' : (detailPrescription.priceType === 'CASH' ? 'PEŞİN ' : 'VADELİ ') + (detailPrescription.type === 'RETURN' ? 'İADE TOPLAMI' : 'SATIŞ TOPLAMI')}
                                                    </span>
                                                    <span className={`font-black font-mono text-2xl tracking-tight ${detailPrescription.discountAmount && detailPrescription.discountAmount > 0 ? 'text-emerald-700' : 'text-emerald-600'}`}>
                                                        {formatCurrency(Math.abs(detailPrescription.totalAmount || 0), userProfile?.currency || 'TRY')}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="text-stone-400 uppercase text-[9px] font-black tracking-widest border-b-2 border-stone-200">
                                        <tr>
                                            <th className="pb-3 text-left">Ürün / İlaç Adı</th>
                                            <th className="pb-3 text-right">Uygulama Dozajı</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {detailPrescription.items.map((item, idx) => (
                                            <tr key={idx} className="group">
                                                <td className="py-4 font-bold text-stone-800">
                                                    {item.pesticideName}
                                                    {item.quantity && (
                                                        <span className="ml-2 text-stone-500 font-bold text-xs bg-stone-100 px-2 py-0.5 rounded-full">
                                                            {item.quantity.toString().replace(/^-/, '')} Adet
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 text-right font-mono font-bold text-emerald-600">{item.dosage}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="mt-12 pt-6 flex justify-between items-end relative z-10">
                            <div className="text-[10px] text-stone-400/80 font-mono leading-relaxed">
                                Bu belge Mühendis Kayıt Sistemi<br/>
                                tarafından oluşturulmuştur.<br/>
                                <strong>v3.1.2</strong>
                            </div>
                            <div className="text-center">
                                <div className="font-serif italic text-xl text-blue-900/80 mb-1">{detailPrescription.engineerName}</div>
                                <div className="text-[9px] text-stone-400 uppercase tracking-widest border-t border-stone-200 pt-2 font-bold">Dijital Onay / Kaşe</div>
                            </div>
                        </div>
                    </div>
                    {/* Jagged / Perforated Bottom Edge */}
                    <div className="w-full h-3 overflow-hidden block z-10 relative -mt-[1px]">
                        <svg viewBox="0 0 1200 30" preserveAspectRatio="none" className="w-full h-full block" style={{ fill: '#fdfdfc' }}>
                            <path d="M0,0 L0,15 L15,30 L30,15 L45,30 L60,15 L75,30 L90,15 L105,30 L120,15 L135,30 L150,15 L165,30 L180,15 L195,30 L210,15 L225,30 L240,15 L255,30 L270,15 L285,30 L300,15 L315,30 L330,15 L345,30 L360,15 L375,30 L390,15 L405,30 L420,15 L435,30 L450,15 L465,30 L480,15 L495,30 L510,15 L525,30 L540,15 L555,30 L570,15 L585,30 L600,15 L615,30 L630,15 L645,30 L660,15 L675,30 L690,15 L705,30 L720,15 L735,30 L750,15 L765,30 L780,15 L795,30 L810,15 L825,30 L840,15 L855,30 L870,15 L885,30 L900,15 L915,30 L930,15 L945,30 L960,15 L975,30 L990,15 L1005,30 L1020,15 L1035,30 L1050,15 L1065,30 L1080,15 L1095,30 L1110,15 L1125,30 L1140,15 L1155,30 L1170,15 L1185,30 L1200,15 L1200,0 Z"></path>
                        </svg>
                    </div>
                </div>

                {/* SPLIT ACTION BUTTONS */}
                <div className="flex gap-2">
                    <button 
                        onClick={() => handlePdfAction('SHARE', detailPrescription, selectedFarmer || undefined)} 
                        disabled={isProcessingPdf}
                        className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                    >
                        {isProcessingPdf ? <Loader2 size={20} className="mr-2 animate-spin"/> : <Share2 size={20} className="mr-2"/>}
                        WhatsApp PDF
                    </button>
                    
                    <button 
                        onClick={() => selectedFarmer && handleWhatsAppText(detailPrescription, selectedFarmer)}
                        className="flex-1 py-4 rounded-2xl bg-[#25D366] text-white font-black text-sm shadow-xl hover:bg-[#20bd5a] flex items-center justify-center active:scale-95 transition-all"
                    >
                        <MessageCircle size={20} className="mr-2"/>
                        WP Özet
                    </button>

                    <button 
                        onClick={() => handlePdfAction('DOWNLOAD', detailPrescription, selectedFarmer || undefined)} 
                        disabled={isProcessingPdf}
                        className="px-6 py-4 rounded-2xl bg-stone-800 text-stone-300 font-black text-sm border border-white/5 hover:bg-stone-700 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                    >
                        {isProcessingPdf ? <Loader2 size={20} className="animate-spin"/> : <Download size={20} />}
                    </button>
                </div>

                <ConfirmationModal 
                    isOpen={isDeleteModalOpen}
                    onClose={() => { setIsDeleteModalOpen(false); setPrescriptionToDelete(null); }}
                    onConfirm={confirmDelete}
                    title={`${prescriptionLabel} Silinecek`}
                    message={t('prescription.delete_confirm', { label: prescriptionLabel.toLowerCase() }) || `Bu ${prescriptionLabel.toLowerCase()}yi silmek istediğinize emin misiniz?`}
                />

                {showProfitId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-stone-900 border border-white/10 w-full max-w-[280px] rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-base font-black text-stone-100 flex items-center gap-2">
                                    <TrendingUp className="text-emerald-500" size={18} />
                                    Kar/Zarar
                                </h2>
                                <button onClick={() => setShowProfitId(null)} className="p-1.5 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors">
                                    <X size={14} />
                                </button>
                            </div>

                            {(() => {
                                const p = contextPrescriptions.find(presc => presc.id === showProfitId);
                                if (!p) return null;

                                const totalSales = p.totalAmount || 0;
                                const itemsWithCost = p.items.map(item => {
                                    const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
                                    let cost = item.buyingPrice;
                                    if (cost === undefined) {
                                        const invItem = contextInventory.find(inv => inv.pesticideId === item.pesticideId);
                                        cost = invItem?.buyingPrice || 0;
                                    }
                                    return {
                                        ...item,
                                        qty,
                                        cost,
                                        totalCost: qty * cost,
                                        totalSale: item.totalPrice || 0
                                    };
                                });

                                const totalCost = itemsWithCost.reduce((acc, item) => acc + item.totalCost, 0);
                                const profit = totalSales - totalCost;
                                const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

                                return (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="bg-stone-950 p-3 rounded-xl border border-white/5">
                                                <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5">Satış</p>
                                                <p className="text-base font-black text-stone-100 font-mono">{formatCurrency(totalSales, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            <div className="bg-stone-950 p-3 rounded-xl border border-white/5">
                                                <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5">Maliyet</p>
                                                <p className="text-base font-black text-stone-400 font-mono">{formatCurrency(totalCost, userProfile?.currency || 'TRY')}</p>
                                            </div>
                                            <div className={`p-3 rounded-xl border ${profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <p className={`text-[9px] font-black uppercase tracking-widest ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {profit >= 0 ? 'Net Kar' : 'Net Zarar'}
                                                    </p>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${profit >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                        %{profitMargin.toFixed(1)}
                                                    </span>
                                                </div>
                                                <p className={`text-lg font-black font-mono ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {formatCurrency(Math.abs(profit), userProfile?.currency || 'TRY')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1 no-scrollbar">
                                            {itemsWithCost.map((item, idx) => (
                                                <div key={idx} className="bg-stone-950/50 p-2 rounded-lg border border-white/5 flex justify-between items-center">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-bold text-stone-300 truncate">{item.pesticideName}</p>
                                                        <p className="text-[8px] text-stone-500">{item.qty} x {formatCurrency(item.cost, userProfile?.currency || 'TRY')}</p>
                                                    </div>
                                                    <div className="text-right ml-2">
                                                        <p className={`text-[9px] font-black font-mono ${item.totalSale - item.totalCost >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {formatCurrency(item.totalSale - item.totalCost, userProfile?.currency || 'TRY')}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button 
                                            onClick={() => setShowProfitId(null)}
                                            className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                                        >
                                            Kapat
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-4 max-w-3xl mx-auto pb-24 animate-in slide-in-from-right duration-200">
            <div className="flex items-center mb-6">
                 <button onClick={handleBackFromForm} className="mr-4 text-stone-400 hover:text-stone-200 flex items-center">
                    <X size={20} className="mr-1" /> İptal
                 </button>
                 <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden mx-4">
                     <div className={`h-full bg-emerald-600 transition-all duration-300 ${step === 1 ? 'w-1/5' : (step === 2 ? 'w-2/5' : (step === 3 ? 'w-3/5' : (step === 4 ? 'w-4/5' : 'w-full')))}`}></div>
                 </div>
                 <span className="font-bold text-emerald-500 text-sm whitespace-nowrap">Adım {step}/5</span>
            </div>

            {step === 1 && (
                <div className="pb-24">
                    <div className="flex items-center justify-center mb-4">
                        <h2 className="text-2xl font-bold text-stone-100 text-center">
                            {editingId ? `${currentPrescriptionLabel} Düzenle: ${farmerLabel}` : `${currentPrescriptionLabel} Oluştur: ${farmerLabel} Seçimi`}
                        </h2>
                    </div>
                    
                    <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-4">
                        <Search className="text-stone-500 ml-3" size={18} />
                        <input 
                            type="text" 
                            placeholder={`${farmerLabel} adı veya köy ile ara...`} 
                            className="w-full p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-sm"
                            value={farmerSearchTerm}
                            onChange={e => setFarmerSearchTerm(e.target.value)}
                        />
                        {farmerSearchTerm && (
                            <button onClick={() => setFarmerSearchTerm('')} className="p-2 text-stone-500 hover:text-stone-300">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1 text-center block w-full">{farmerLabel} Listesi</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[450px] overflow-y-auto pr-2 no-scrollbar">
                                {filteredFarmers.map(f => (
                                    <button 
                                        key={f.id} 
                                        onClick={() => { setSelectedFarmer(f); setSelectedFieldId(''); changeStep(2); }}
                                        className={`w-full text-left p-4 rounded-2xl border flex justify-between items-center group transition-all ${
                                            selectedFarmer?.id === f.id
                                            ? 'bg-emerald-900/20 border-emerald-500 shadow-lg shadow-emerald-900/10'
                                            : 'bg-stone-900 border-white/5 hover:border-emerald-500/50 hover:bg-stone-800/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedFarmer?.id === f.id ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 group-hover:bg-emerald-900/30 group-hover:text-emerald-500'}`}>
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <span className="font-bold text-stone-100 block text-sm group-hover:text-emerald-400">{f.fullName}</span>
                                                <span className="text-[10px] text-stone-500 flex items-center mt-1"><MapPin size={10} className="mr-1"/> {f.village}</span>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className={`${selectedFarmer?.id === f.id ? 'text-emerald-500' : 'text-stone-700'}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="pb-24 slide-in-from-right animate-in">
                    <div className="flex items-center justify-center mb-6">
                        <h2 className="text-2xl font-bold text-stone-100 text-center">
                            {selectedFarmer?.fullName} - Tarla Seçimi
                        </h2>
                    </div>

                    <div className="space-y-4 max-w-xl mx-auto">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1 block text-center">İlacın Uygulanacağı Araziyi Belirleyin</label>
                        
                        {!selectedFarmer ? (
                             <div className="p-12 border-2 border-dashed border-stone-800 rounded-3xl text-center text-stone-600 flex flex-col items-center gap-3">
                                <User size={40} className="opacity-20" />
                                <p className="text-sm font-medium">Lütfen önce çiftçi seçiniz</p>
                                <button onClick={() => changeStep(1)} className="text-emerald-500 text-xs font-bold underline">Geri Dön</button>
                            </div>
                        ) : (
            <div className="grid grid-cols-1 gap-3">
                {selectedFarmer.fields?.map(field => {
                    const isSelected = selectedFieldIds.includes(field.id);
                    return (
                        <button 
                            key={field.id} 
                            onClick={() => { 
                                setSelectedFieldIds(prev => 
                                    prev.includes(field.id) 
                                        ? prev.filter(id => id !== field.id) 
                                        : [...prev, field.id]
                                );
                            }}
                            className={`w-full text-left p-5 rounded-2xl border flex justify-between items-center group transition-all relative overflow-hidden ${
                                isSelected
                                ? 'bg-emerald-900/20 border-emerald-500 shadow-lg shadow-emerald-500/10'
                                : 'bg-stone-900 border-white/5 hover:border-emerald-500/50 hover:bg-stone-800/10'
                            }`}
                        >
                            <div className="flex items-center gap-4 relative z-10">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-800 text-stone-500 group-hover:bg-emerald-900/30'}`}>
                                    <MapPin size={22} />
                                </div>
                                <div>
                                    <span className={`font-black block text-base leading-tight ${isSelected ? 'text-emerald-400' : 'text-stone-100'}`}>{field.name}</span>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center bg-stone-950/50 px-2 py-1 rounded-lg border border-white/5">
                                            {field.crop}
                                        </span>
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/10">
                                            {field.size} Dekar
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all ${isSelected ? 'bg-emerald-500 text-white scale-110' : 'bg-stone-800 text-stone-600'}`}>
                                <Check size={14} strokeWidth={4} />
                            </div>
                        </button>
                    );
                })}
                                {(!selectedFarmer.fields || selectedFarmer.fields.length === 0) && (
                                    <div className="p-12 border-2 border-dashed border-stone-800 rounded-3xl text-center text-stone-600 flex flex-col items-center gap-3">
                                        <MapPin size={40} className="opacity-20" />
                                        <p className="text-sm font-medium">Bu çiftçinin kayıtlı tarlası bulunamadı.</p>
                                        <p className="text-[10px] text-stone-500 italic max-w-[200px]">Lütfen Çiftçiler bölümünden tarla ekleyiniz veya tarlasız devam etmek için bir alan oluşturun.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Plant Selection (Optional) */}
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest">Bitki / Mahsul Seçimi (Opsiyonel)</label>
                                {selectedPlantId && (
                                    <button 
                                        onClick={() => setSelectedPlantId('')}
                                        className="text-[10px] font-black text-rose-500 uppercase tracking-widest"
                                    >
                                        Temizle
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 scroll-hide">
                                {contextPlants.map(plant => (
                                    <button
                                        key={plant.id}
                                        onClick={() => setSelectedPlantId(plant.id === selectedPlantId ? '' : plant.id)}
                                        className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                            selectedPlantId === plant.id 
                                                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-lg shadow-amber-900/20' 
                                                : 'bg-stone-900 text-stone-500 border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        {plant.name}
                                    </button>
                                ))}
                                {contextPlants.length === 0 && (
                                    <p className="text-[10px] text-stone-600 font-bold italic py-2">Henüz kayıtlı bitki bulunamadı.</p>
                                )}
                            </div>
                            <p className="text-[9px] text-stone-600 mt-2 leading-relaxed">
                                * Bitki seçimi yaparsanız, vadeli satışlarda ödeme tarihi bu bitkinin olgunlaşma süresine göre otomatik belirlenir.
                            </p>
                        </div>
                    </div>
                    
                    <div className="fixed bottom-20 left-0 w-full p-4 md:static md:p-0 md:mt-12 z-30 bg-gradient-to-t from-stone-950 via-stone-950 to-transparent pb-6">
                        <div className="max-w-xl mx-auto flex gap-3">
                            <button 
                                onClick={() => changeStep(1)} 
                                className="flex-1 py-4 bg-stone-900 text-stone-400 rounded-2xl font-bold flex items-center justify-center transition-all border border-white/5 hover:text-white"
                            >
                                <ArrowLeft size={20} className="mr-2"/> Çiftçi Seçimi
                            </button>
                            <button 
                                disabled={selectedFieldIds.length === 0}
                                onClick={() => changeStep(3)} 
                                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-emerald-500/20 disabled:opacity-30 disabled:grayscale active:scale-95 transition-all border border-emerald-500/20"
                            >
                                Ürün Seçimine Geç <ChevronRight size={20} className="ml-2"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="pb-24">
                    <h2 className="text-2xl font-bold mb-4 text-stone-100 text-center">
                        {editingId ? `${currentPrescriptionLabel} Düzenle: İlaçlar` : 'İlaç Seç'}
                    </h2>
                    
                    <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-6">
                        <Search className="text-stone-500 ml-3" size={18} />
                        <input 
                            type="text" 
                            placeholder="İlaç adı veya etken madde ara..." 
                            className="w-full p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-sm"
                            value={pesticideSearchTerm}
                            onChange={e => setPesticideSearchTerm(e.target.value)}
                        />
                        <button 
                            onClick={() => setShowRecommendations(true)}
                            className={`p-2.5 rounded-xl ml-1 transition-colors relative mr-1 hover:scale-105 active:scale-95 ${recommendedIds.length > 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'}`}
                            title="Ürün Tavsiyeleri"
                        >
                            <Lightbulb size={18} />
                            {recommendedIds.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-stone-900"></span>
                            )}
                        </button>
                        <button 
                            onClick={() => setIsScanning(true)}
                            className="p-2.5 bg-stone-800 text-stone-300 rounded-xl mr-1 hover:bg-stone-700 transition-colors"
                            title="Barkod Okut"
                        >
                            <Barcode size={18} />
                        </button>
                        {pesticideSearchTerm && (
                            <button onClick={() => setPesticideSearchTerm('')} className="p-2 text-stone-500 hover:text-stone-300">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="mb-8">
                        <label className="text-xs font-bold text-stone-500 mb-3 block uppercase tracking-widest">Depodan Seç</label>
                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                            {filteredInventoryItems.length > 0 ? (
                                filteredInventoryItems.map(inv => {
                                    const p = pesticides.find(pest => pest.id === inv.pesticideId) || {
                                        id: inv.pesticideId,
                                        name: inv.pesticideName,
                                        activeIngredient: 'Bilinmiyor',
                                        defaultDosage: '100ml/100L',
                                        category: inv.category,
                                        description: 'Depo ürünü'
                                    } as Pesticide;
                                    
                                    const isSelected = selectedItems.some(i => i.pesticide.id === p.id);
                                    return (
                                        <div 
                                            key={inv.id}
                                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex justify-between items-center ${
                                                isSelected 
                                                ? 'bg-stone-800/50 border-emerald-900/30' 
                                                : 'bg-stone-900 border-white/5 hover:border-emerald-500/30 hover:bg-stone-800'
                                            }`}
                                        >
                                            <div 
                                                className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                                                onClick={() => !isSelected && addItem(p)}
                                            >
                                                <div className="p-2 bg-stone-800 rounded-lg text-stone-400 group-hover:text-emerald-400 shrink-0">
                                                    <Package size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className={`font-bold block text-sm truncate ${isSelected ? 'text-stone-500' : 'text-stone-200'}`}>{inv.pesticideName}</span>
                                                    <span className="text-[10px] text-stone-500 font-mono block truncate">Stok: {inv.quantity} {inv.unit} | Fiyat: {formatCurrency(inv.sellingPrice, userProfile?.currency || 'TRY')}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                <button
                                                    onClick={(e) => toggleRecommendation(p.id, e)}
                                                    className={`p-2.5 rounded-lg transition-colors active:scale-90 ${recommendedIds.includes(p.id) ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' : 'text-stone-600 hover:text-amber-400 hover:bg-stone-700/50'}`}
                                                    title={recommendedIds.includes(p.id) ? "Tavsiyelerden Çıkar" : "Tavsiyelere Ekle"}
                                                >
                                                    <Star size={18} fill={recommendedIds.includes(p.id) ? "currentColor" : "none"} />
                                                </button>
                                                <button
                                                    onClick={() => !isSelected && addItem(p)}
                                                    disabled={isSelected}
                                                    className={`p-2.5 rounded-lg transition-colors min-w-[44px] flex items-center justify-center ${isSelected ? 'text-emerald-500 bg-emerald-500/10 opacity-50 cursor-not-allowed' : 'text-stone-200 bg-stone-800 hover:bg-emerald-600'}`}
                                                >
                                                    {isSelected ? <Check size={18} /> : <Plus size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-6 text-stone-600 border border-dashed border-stone-800 rounded-xl">
                                    <p className="text-xs">Depoda uygun ilaç bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="fixed bottom-20 left-0 w-full p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-stone-950 via-stone-950 to-transparent pb-6">
                        <div className="max-w-3xl mx-auto">
                             {selectedItems.length > 0 && (
                                 <div className="mb-4 bg-stone-900/80 backdrop-blur-md border border-white/5 rounded-xl p-2 overflow-x-auto no-scrollbar flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300">
                                     <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest ml-1 shrink-0">Seçilenler:</span>
                                     {selectedItems.map((item, i) => (
                                         <div key={i} className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap flex items-center gap-1">
                                             {item.pesticide.name}
                                             <button onClick={() => removeItem(item.pesticide.id)} className="hover:text-rose-400"><X size={10} /></button>
                                             <button onClick={() => setIsScanning(true)} className="hover:text-emerald-400"><Barcode size={10} /></button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                             <button 
                                disabled={selectedItems.length === 0}
                                onClick={() => changeStep(4)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/40 disabled:opacity-50 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border border-emerald-500/20"
                             >
                                İlaç Detaylarını Gir <Check size={20} className="ml-2" />
                             </button>
                        </div>
                    </div>

                    {showRecommendations && (
                        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
                            <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm" onClick={() => setShowRecommendations(false)}></div>
                            <div className="bg-stone-900 border border-stone-800 w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                                <div className="p-4 border-b border-stone-800 bg-amber-500/5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2 text-amber-500">
                                        <Lightbulb size={20} />
                                        <h3 className="font-bold text-stone-100">Ürün Tavsiyeleri & Notlar</h3>
                                    </div>
                                    <button onClick={() => setShowRecommendations(false)} className="text-stone-400 hover:text-white p-1 rounded-full"><X size={20}/></button>
                                </div>
                                <div className="p-4 overflow-y-auto flex-1 space-y-2 no-scrollbar">
                                    {recommendedIds.length === 0 ? (
                                        <div className="text-center py-10 opacity-50 px-4">
                                            <Star size={32} className="mx-auto mb-4 text-stone-500" />
                                            <p className="text-sm text-stone-400 font-medium">Henüz notlarına eklediğin bir ürün yok.</p>
                                            <p className="text-xs text-stone-500 mt-2">Depodan seçerken yıldız (⭐) butonuna basarak unutmamak için ürün ekleyebilirsin.</p>
                                        </div>
                                    ) : (
                                        recommendedIds.map(rid => {
                                           const pInfo = pesticides.find(p => p.id === rid); 
                                           if (!pInfo) return null;
                                           const invItem = contextInventory.find(inv => inv.pesticideId === rid);
                                           const isSelected = selectedItems.some(i => i.pesticide.id === rid);

                                            return (
                                                <div key={rid} className="w-full text-left p-3 rounded-xl bg-stone-800/30 border border-stone-800 flex justify-between items-center group">
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <span className="font-bold text-stone-200 block text-sm truncate">{pInfo.name}</span>
                                                        {invItem ? (
                                                            <span className="text-[10px] text-emerald-500 font-mono block truncate">Stokta Var: {invItem.quantity} {invItem.unit}</span>
                                                        ) : (
                                                            <span className="text-[10px] text-rose-500 font-mono block truncate">Depoda Yok</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button 
                                                            onClick={() => toggleRecommendation(rid)}
                                                            className="p-2 text-stone-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                            title="Notlardan Sil"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                        {invItem && (
                                                            <button
                                                                onClick={() => {
                                                                    if (!isSelected) {
                                                                        addItem(pInfo);
                                                                    } else {
                                                                        removeItem(pInfo.id);
                                                                    }
                                                                }}
                                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isSelected ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                                                            >
                                                                {isSelected ? 'Çıkar' : 'Ekle'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {step === 4 && (
                <div>
                     <h2 className="text-2xl font-bold mb-4 text-stone-100 text-center">
                        İlaç Detayları
                    </h2>
                    <div className="space-y-3 pb-40">
                        {/* Horizontal Controls Row */}
                        <div className="flex items-center gap-1.5">
                            {/* Invoice No */}
                            <div className="flex-1 flex items-center space-x-1.5 bg-stone-900 px-2 py-2 rounded-xl border border-white/5 shadow-inner">
                                <span className="text-[8px] text-stone-500 font-black uppercase tracking-tighter whitespace-nowrap">NO:</span>
                                <input 
                                    type="text" 
                                    value={customPrescriptionNo}
                                    onChange={(e) => setCustomPrescriptionNo(e.target.value)}
                                    placeholder="OTO"
                                    className="bg-transparent border-none text-[10px] text-stone-100 w-full focus:ring-0 p-0 placeholder:text-stone-700 outline-none font-black"
                                />
                            </div>

                            {/* Payment Type Toggle */}
                            <div className="flex-1 flex items-center bg-stone-900 rounded-xl border border-white/5 p-0.5">
                                <button
                                    onClick={() => handlePriceTypeChange('CASH')}
                                    className={`flex-1 py-1.5 text-[8px] font-black rounded-lg transition-all ${prescriptionPriceType === 'CASH' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-500'}`}
                                >
                                    PEŞİN
                                </button>
                                <button
                                    onClick={() => handlePriceTypeChange('TERM')}
                                    className={`flex-1 py-1.5 text-[8px] font-black rounded-lg transition-all ${prescriptionPriceType === 'TERM' ? 'bg-stone-700 text-white shadow-lg' : 'text-stone-500'}`}
                                >
                                    VADE
                                </button>
                            </div>
                            
                            {/* Due Date Input */}
                            <div className={`flex-1 flex items-center space-x-1.5 bg-stone-900 px-2 py-2 rounded-xl border border-white/5 shadow-inner transition-all duration-300 ${prescriptionPriceType === 'CASH' ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                                <Calendar size={10} className="text-amber-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[7px] font-black text-stone-500 uppercase tracking-tighter leading-none mb-0.5">VADE</p>
                                    <div className="text-[9px] text-stone-200 font-black truncate relative">
                                        <input
                                            type="date"
                                            value={prescriptionDueDate}
                                            onChange={(e) => {
                                                setPrescriptionDueDate(e.target.value);
                                                setIsManualDueDate(true);
                                            }}
                                            className="bg-transparent border-none text-[9px] text-stone-200 font-black w-full focus:ring-0 p-0 outline-none relative z-10"
                                            style={{ colorScheme: 'dark' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-stone-900/80 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-white/5 relative overflow-hidden group animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                                
                                <div className="flex items-start justify-between gap-4 relative z-10">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            <h4 className="font-black text-stone-100 text-xs tracking-tight truncate">{item.pesticide.name}</h4>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest pl-1">ADET / MİKTAR</label>
                                                <div className="bg-stone-950 border border-white/5 rounded-xl overflow-hidden focus-within:border-emerald-500/40 transition-all">
                                                    <input 
                                                        type="text" 
                                                        value={item.quantity}
                                                        onChange={(e) => updateQuantity(item.pesticide.id, e.target.value)}
                                                        className="w-full p-2.5 bg-transparent font-black outline-none text-stone-200 text-xs text-center"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest pl-1">BİRİM FİYAT</label>
                                                <div className="bg-stone-950 border border-white/5 rounded-xl overflow-hidden focus-within:border-amber-500/40 transition-all">
                                                    <input 
                                                        type="text" 
                                                        value={item.unitPrice || ''}
                                                        onChange={(e) => updatePrice(item.pesticide.id, e.target.value)}
                                                        className="w-full p-2.5 bg-transparent font-black outline-none text-stone-200 text-xs text-center"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end justify-between h-[100px]">
                                        <button 
                                            onClick={() => removeItem(item.pesticide.id)} 
                                            className="p-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all active:scale-95 shadow-sm"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-stone-500 uppercase tracking-widest leading-none mb-1">ARA TOPLAM</p>
                                            <span className="text-base font-black text-emerald-400 font-mono tracking-tighter block leading-none">
                                                {formatCurrency(item.totalPrice || 0, userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {selectedItems.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed border-stone-800 rounded-2xl text-stone-600 bg-stone-900/20">
                                <FlaskConical size={32} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Hiç ilaç seçilmedi.</p>
                            </div>
                        )}
                    </div>

                    <div className="fixed bottom-20 left-0 w-full p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-stone-950 via-stone-950 to-transparent pb-6">
                        <div className="max-w-3xl mx-auto">
                             <button 
                                disabled={selectedItems.length === 0}
                                onClick={() => changeStep(5)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/40 disabled:opacity-50 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border border-emerald-500/20"
                             >
                                Devam Et <Check size={20} className="ml-2" />
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 5 && (
                <div className="pb-24">
                    <h2 className="text-2xl font-bold mb-6 text-stone-100 text-center">Önizleme ve Onay</h2>
                    <div className="bg-stone-900 p-6 rounded-xl shadow-sm border border-white/5 mb-6">
                         <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                             <div>
                                 <p className="text-sm text-stone-500">{farmerLabel}</p>
                                 <p className="font-bold text-lg text-stone-200">{selectedFarmer?.fullName}</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-sm text-stone-500">Tarih</p>
                                 <p className="font-medium text-stone-300">{new Date().toLocaleDateString()}</p>
                             </div>
                         </div>
                         <div className="space-y-2">
                             {selectedItems.map((item, idx) => (
                                 <div key={idx} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                                     <div>
                                         <span className="font-medium text-stone-400 block">{item.pesticide.name}</span>
                                         {item.quantity && <span className="text-xs text-stone-500 font-bold bg-stone-950 px-2 py-0.5 rounded-full inline-block mt-1">{item.quantity.toString().replace(/^-/, '')} Adet</span>}
                                     </div>
                                     <div className="text-right">
                                         <span className="font-bold text-stone-200 block">{item.dosage}</span>
                                         <div className="flex flex-col items-end mt-1">
                                             {item.totalPrice && item.totalPrice > 0 ? (
                                                 <span className="text-xs text-emerald-400 font-mono block">
                                                     {formatCurrency(item.totalPrice, userProfile?.currency || 'TRY')}
                                                 </span>
                                             ) : null}
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             
                             {/* Toplam Tutar Gösterimi */}
                             {selectedItems.some(i => i.totalPrice && i.totalPrice > 0) && (() => {
                                 const initialTotal = selectedItems.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
                                 const discountValue = parseFloat(prescriptionDiscount.replace(',', '.')) || 0;
                                 const finalTotal = Math.max(0, initialTotal - discountValue);

                                 return (
                                     <div className="pt-4 border-t border-white/10 mt-4 space-y-3">
                                         <div className="flex justify-between items-center">
                                             <div>
                                                 <span className="font-bold text-stone-300 block">TOPLAM TUTAR</span>
                                                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-1 inline-block ${prescriptionPriceType === 'CASH' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-stone-800 text-stone-500'}`}>
                                                     {prescriptionPriceType === 'CASH' ? 'PEŞİN ' : 'VADELİ '} {prescriptionType === 'RETURN' ? 'İADE' : 'SATIŞ'}
                                                 </span>
                                             </div>
                                             <span className={`font-bold font-mono ${discountValue > 0 ? 'text-stone-500 text-sm line-through' : 'text-emerald-400 text-lg'}`}>
                                                 {formatCurrency(initialTotal, userProfile?.currency || 'TRY')}
                                             </span>
                                         </div>
                                         
                                         <div className="flex justify-between items-center bg-stone-950 p-3 rounded-xl border border-stone-800">
                                             <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">İskonto Tutarı Gir</span>
                                             <input
                                                type="number"
                                                value={prescriptionDiscount}
                                                onChange={(e) => setPrescriptionDiscount(e.target.value)}
                                                className="w-28 bg-stone-900 border border-stone-800 rounded-lg p-2 text-right font-mono font-bold text-rose-400 outline-none focus:border-rose-500 transition-colors"
                                                placeholder="0.00"
                                             />
                                         </div>

                                         {discountValue > 0 && (
                                            <div className="flex justify-between items-center pt-2">
                                                 <span className="font-black text-emerald-400 block text-lg tracking-tight">İNDİRİMLİ TUTAR</span>
                                                 <span className="font-black text-emerald-400 text-2xl font-mono">
                                                     {formatCurrency(finalTotal, userProfile?.currency || 'TRY')}
                                                 </span>
                                            </div>
                                         )}
                                     </div>
                                 );
                             })()}
                         </div>
                    </div>
                    <div className="fixed bottom-20 left-0 w-full p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-stone-950 via-stone-950 to-transparent pb-6">
                        <div className="max-w-3xl mx-auto">
                            <button 
                                onClick={handleSave}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 flex items-center justify-center transition-all border border-emerald-500/20"
                            >
                                <FileOutput className="mr-2" /> {editingId ? `${currentPrescriptionLabel} Güncelle` : `${currentPrescriptionLabel} Oluştur`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isScanning && (
                <BarcodeScanner 
                    onScan={handleScan} 
                    onClose={() => setIsScanning(false)} 
                    continuous={true}
                />
            )}

            {showProfitId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-stone-100 flex items-center gap-3">
                                <TrendingUp className="text-emerald-500" />
                                Kar/Zarar Analizi
                            </h2>
                            <button onClick={() => setShowProfitId(null)} className="p-2 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        {(() => {
                            const p = contextPrescriptions.find(presc => presc.id === showProfitId);
                            if (!p) return null;

                            const totalSales = p.totalAmount || 0;
                            const itemsWithCost = p.items.map(item => {
                                const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
                                let cost = item.buyingPrice;
                                if (cost === undefined) {
                                    const invItem = contextInventory.find(inv => inv.pesticideId === item.pesticideId);
                                    cost = invItem?.buyingPrice || 0;
                                }
                                return {
                                    ...item,
                                    qty,
                                    cost,
                                    totalCost: qty * cost,
                                    totalSale: item.totalPrice || 0
                                };
                            });

                            const totalCost = itemsWithCost.reduce((acc, item) => acc + item.totalCost, 0);
                            const profit = totalSales - totalCost;
                            const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

                            return (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="bg-stone-950 p-4 rounded-2xl border border-white/5">
                                            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Toplam Satış</p>
                                            <p className="text-xl font-black text-stone-100 font-mono">{formatCurrency(totalSales, userProfile?.currency || 'TRY')}</p>
                                        </div>
                                        <div className="bg-stone-950 p-4 rounded-2xl border border-white/5">
                                            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Toplam Maliyet</p>
                                            <p className="text-xl font-black text-stone-400 font-mono">{formatCurrency(totalCost, userProfile?.currency || 'TRY')}</p>
                                        </div>
                                        <div className={`p-4 rounded-2xl border ${profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <p className={`text-[10px] font-black uppercase tracking-widest ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {profit >= 0 ? 'Net Kar' : 'Net Zarar'}
                                                </p>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${profit >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                    %{profitMargin.toFixed(1)}
                                                </span>
                                            </div>
                                            <p className={`text-2xl font-black font-mono ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatCurrency(Math.abs(profit), userProfile?.currency || 'TRY')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 no-scrollbar">
                                        <p className="text-[10px] font-black text-stone-600 uppercase tracking-widest ml-1">Ürün Bazlı Detay</p>
                                        {itemsWithCost.map((item, idx) => (
                                            <div key={idx} className="bg-stone-950/50 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] font-bold text-stone-300 truncate">{item.pesticideName}</p>
                                                    <p className="text-[9px] text-stone-500">{item.qty} Adet x {formatCurrency(item.cost, userProfile?.currency || 'TRY')} (Maliyet)</p>
                                                </div>
                                                <div className="text-right ml-3">
                                                    <p className={`text-[10px] font-black font-mono ${item.totalSale - item.totalCost >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {formatCurrency(item.totalSale - item.totalCost, userProfile?.currency || 'TRY')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={() => setShowProfitId(null)}
                                        className="w-full py-4 bg-stone-800 hover:bg-stone-700 text-white rounded-2xl font-bold text-sm transition-all active:scale-95"
                                    >
                                        Kapat
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
            />
        </div>
    );
};

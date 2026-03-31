
// ... imports ...
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import { Farmer, Pesticide, Prescription, PesticideCategory, VisitLog, AppNotification } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { Check, Plus, Trash2, FileOutput, Share2, FileText, Calendar, MapPin, X, User, Loader2, Search, FlaskConical, MessageCircle, Edit2, AlertCircle, ArrowLeft, Printer, Package, Download, MessageSquare, RefreshCw, AlertTriangle, Camera, Barcode } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';

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
        showToast,
        hapticFeedback,
        activeTeamMember,
        teamMembers,
        t
    } = useAppViewModel();
    const isCompany = userProfile.accountType === 'COMPANY';
    const isSales = activeTeamMember?.role === 'SALES';
    const farmerLabel = isCompany ? 'Bayi' : 'Çiftçi';
    const farmerPluralLabel = isCompany ? 'Bayiler' : 'Çiftçiler';
    const prescriptionLabel = isCompany ? 'Sipariş' : 'Reçete';

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

    const changeViewMode = (mode: 'LIST' | 'FORM' | 'DETAIL', detailId?: string) => {
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
            window.history.pushState({ ...window.history.state, subView: mode, detailId, step: initialStep }, '');
            setViewMode(mode);
            setStep(initialStep);
        }
    };

    const handleScan = (barcode: string) => {
        setIsScanning(false);
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
            alert("Barkod bulunamadı: " + barcode);
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
    const [farmerSearchTerm, setFarmerSearchTerm] = useState('');
    const [pesticideSearchTerm, setPesticideSearchTerm] = useState('');
    const [prescriptionSearchTerm, setPrescriptionSearchTerm] = useState('');
    
    // Updated state to include quantity and price
    const [selectedItems, setSelectedItems] = useState<{pesticide: Pesticide, dosage: string, quantity: string, unitPrice?: string, totalPrice?: number}[]>([]);
    const [showPrices, setShowPrices] = useState(true);
    const [customPrescriptionNo, setCustomPrescriptionNo] = useState('');
    const [prescriptionPriceType, setPrescriptionPriceType] = useState<'CASH' | 'TERM'>('TERM');
    
    // Detail View State
    const [detailPrescription, setDetailPrescription] = useState<Prescription | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [prescriptionToDelete, setPrescriptionToDelete] = useState<string | null>(null);

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [hasInitializedEdit, setHasInitializedEdit] = useState(false);
    const [hasInitializedFarmer, setHasInitializedFarmer] = useState(false);
    
    const [filterMode, setFilterMode] = useState<'ALL' | 'PROCESSED' | 'UNPROCESSED'>('ALL');
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);



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

    const loadData = async () => {
        const [fList, pestList] = await Promise.all([
            dbService.getFarmers(),
            dbService.getPesticides()
        ]);

        setFarmers(fList);
        setPesticides(pestList);

        const fMap: Record<string, Farmer> = {};
        fList.forEach(f => { fMap[f.id] = f; });
        setFarmerMap(fMap);
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

    const resetForm = () => {
        setStep(1);
        setSelectedFarmer(null);
        setFarmerSearchTerm('');
        setPesticideSearchTerm('');
        setSelectedItems([]);
        setDetailPrescription(null);
        setIsProcessingPdf(false);
        setEditingId(null);
        setHasInitializedEdit(false);
        setHasInitializedFarmer(false);
        setShowPrices(true);
        setCustomPrescriptionNo('');
        setPrescriptionPriceType('TERM');
    };

    const addItem = (pesticide: Pesticide) => {
        if (!selectedItems.find(i => i.pesticide.id === pesticide.id)) {
            // Find inventory item to get selling price
            const inventoryItem = contextInventory.find(inv => inv.pesticideId === pesticide.id);
            let sellingPrice = '';
            let initialPrice = 0;
            
            if (inventoryItem) {
                if (prescriptionPriceType === 'CASH' && inventoryItem.cashPrice) {
                    sellingPrice = inventoryItem.cashPrice.toString();
                    initialPrice = inventoryItem.cashPrice;
                } else {
                    sellingPrice = inventoryItem.sellingPrice.toString();
                    initialPrice = inventoryItem.sellingPrice;
                }
            }

            // Initialize quantity as '1'
            const initialQty = 1;
            
            setSelectedItems([...selectedItems, { 
                pesticide, 
                dosage: pesticide.defaultDosage, 
                quantity: initialQty.toString(), 
                unitPrice: sellingPrice, 
                totalPrice: initialQty * initialPrice
            }]);
            setPesticideSearchTerm(''); // Seçimden sonra aramayı temizle
        }
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
                const qty = parseInt(newQuantity) || 0;
                const price = parseFloat(i.unitPrice || '0') || 0;
                return { ...i, quantity: newQuantity, totalPrice: qty * price };
            }
            return i;
        }));
    };

    const updatePrice = (id: string, newPrice: string) => {
        setSelectedItems(selectedItems.map(i => {
            if (i.pesticide.id === id) {
                const qty = parseInt(i.quantity) || 0;
                const price = parseFloat(newPrice) || 0;
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
            const qty = parseInt(i.quantity) || 0;
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
                totalPrice: item.totalPrice || 0
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
        
        const message = p.isProcessed 
            ? `Bu ${prescriptionLabel.toLowerCase()}yi 'İşlenmedi' durumuna geri almak istiyor musunuz?` 
            : `Bu ${prescriptionLabel.toLowerCase()} işlensin mi? (Onaylanırsa İşlenenler bölümüne aktarılacaktır)`;
            
        if (window.confirm(message)) {
            try {
                const updated = await togglePrescriptionStatus(p.id);
                showToast(p.isProcessed ? `${prescriptionLabel} işlenmedi olarak işaretlendi` : `${prescriptionLabel} başarıyla işlendi`, 'success');
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
        }
    };

    const handleStatusChange = async (e: React.MouseEvent, p: Prescription, newStatus: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'INVOICED') => {
        e.stopPropagation();
        
        if (window.confirm(`Sipariş durumunu '${newStatus}' olarak değiştirmek istiyor musunuz?`)) {
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
    };

    const handleSave = async () => {
        if (!selectedFarmer) return;
        
        const items = selectedItems.map(i => ({
            pesticideId: i.pesticide.id,
            pesticideName: i.pesticide.name,
            dosage: i.dosage,
            quantity: i.quantity, // Save quantity
            unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : undefined,
            totalPrice: i.totalPrice
        }));

        const totalAmount = items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
        
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
                fieldId: selectedFieldId || undefined,
                engineerName: userProfile.fullName || original.engineerName,
                prescriptionNo: customPrescriptionNo.trim() || original.prescriptionNo,
                items: items,
                totalAmount: totalAmount > 0 ? totalAmount : undefined,
                priceType: prescriptionPriceType,
                isProcessed: true,
                isInventoryProcessed: false // Reset this so it can be re-processed
            };

            await dbService.updatePrescription(updatedPrescription);
            
            // Re-process with new items
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
                fieldId: selectedFieldId || undefined,
                date: new Date().toISOString(),
                prescriptionNo: customPrescriptionNo.trim() || `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                engineerName: userProfile.fullName || 'Ziraat Mühendisi',
                items: items,
                isOfficial: true,
                isProcessed: true,
                isInventoryProcessed: false,
                totalAmount: totalAmount > 0 ? totalAmount : undefined,
                priceType: prescriptionPriceType,
                status: isCompany ? 'PENDING' : undefined,
                createdById: activeTeamMember?.id
            };

            await dbService.addPrescription(newPrescription);
            await dbService.processInventory(newPrescription);
            
            // Create a visit log entry automatically
            const newVisit: VisitLog = {
                id: crypto.randomUUID(),
                farmerId: selectedFarmer.id,
                fieldId: selectedFieldId || undefined,
                date: new Date().toISOString(),
                note: `${prescriptionLabel} verildi (${newPrescription.prescriptionNo})`,
                village: selectedFarmer.village
            };
            await dbService.addVisit(newVisit);
            
            // Add a notification
            const newNotification: AppNotification = {
                id: crypto.randomUUID(),
                type: 'SUCCESS',
                title: `${prescriptionLabel} ve Ziyaret Kaydı`,
                message: `${selectedFarmer.fullName} için ${prescriptionLabel.toLowerCase()} yazıldı ve ziyaret kaydı oluşturuldu.`,
                date: new Date().toISOString(),
                isRead: false
            };
            await dbService.addNotification(newNotification);
            
            const finalNew = { ...newPrescription, isInventoryProcessed: true };
            setDetailPrescription(finalNew);
            changeViewMode('DETAIL', finalNew.id);
        }

        await loadData();
        await refreshStats();
        showToast(`${prescriptionLabel} başarıyla kaydedildi`, 'success');
        hapticFeedback('success');
    };

    const handleWhatsAppText = (targetPrescription: Prescription, targetFarmer: Farmer) => {
        let text = `*ZİRAİ REÇETE*\n`;
        text += `Sayın *${targetFarmer.fullName}*,\n\n`;
        text += `Tarih: ${new Date(targetPrescription.date).toLocaleDateString('tr-TR')}\n`;
        text += `${prescriptionLabel} No: ${targetPrescription.prescriptionNo}\n\n`;
        
        const hasPrices = targetPrescription.items.some(item => item.unitPrice && item.unitPrice > 0);

        if (hasPrices) {
            text += `*Ürün Listesi:*\n`;
            targetPrescription.items.forEach(item => {
                const qty = item.quantity || '1';
                const price = item.unitPrice || 0;
                const total = item.totalPrice || (parseFloat(qty) * price) || 0;
                
                text += `- ${item.pesticideName}: ${qty} Adet x ${formatCurrency(price, userProfile?.currency || 'TRY')} = *${formatCurrency(total, userProfile?.currency || 'TRY')}*\n`;
            });
            
            if (targetPrescription.totalAmount) {
                text += `\n*GENEL TOPLAM: ${formatCurrency(targetPrescription.totalAmount, userProfile?.currency || 'TRY')}*\n`;
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
            const safeName = currentFarmer.fullName.replace(/[^a-zA-Z0-9]/g, '_');
            const pNo = currentPrescription.prescriptionNo;
            const fileName = `Recete_${safeName}_${pNo}.pdf`;

            if (action === 'DOWNLOAD') {
                pdf.save(fileName);
            } else {
                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
                const shareData = {
                    files: [file],
                    title: `Zirai ${prescriptionLabel}`,
                    // text alanı bazı Android cihazlarda dosya paylaşımını engelleyebiliyor, bu yüzden boş bırakıyoruz.
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
        f.fullName.toLowerCase().includes(farmerSearchTerm.toLowerCase()) ||
        f.village.toLowerCase().includes(farmerSearchTerm.toLowerCase())
    );

    const filteredInventoryItems = contextInventory.filter(inv => 
        inv.pesticideName.toLowerCase().includes(pesticideSearchTerm.toLowerCase())
    );

    const filteredPrescriptions = contextPrescriptions.filter(p => {
        const farmer = farmerMap[p.farmerId];
        const search = prescriptionSearchTerm.toLowerCase();
        
        const matchesSearch = p.prescriptionNo.toLowerCase().includes(search) ||
            (farmer?.fullName && farmer.fullName.toLowerCase().includes(search));
            
        const matchesFilter = filterMode === 'ALL' || 
            (filterMode === 'PROCESSED' && p.isProcessed) ||
            (filterMode === 'UNPROCESSED' && !p.isProcessed);
            
        return matchesSearch && matchesFilter;
    });

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const result = await dbService.backupAllData();
            updateUserProfile({ ...userProfile, lastSyncTime: result.timestamp });
            alert("Tüm veriler başarıyla Firebase'e yedeklendi.");
        } catch (error) {
            alert("Yedekleme hatası: " + (error as any).message);
        } finally {
            setIsSyncing(false);
        }
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
                            onClick={handleSync} 
                            disabled={isSyncing}
                            className="px-3 py-1.5 bg-stone-900 text-stone-400 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                            title={t('prescription.sync')}
                        >
                            <RefreshCw size={14} className={isSyncing ? "animate-spin text-emerald-500" : ""} />
                            {isSyncing ? t('prescription.syncing') : t('prescription.sync')}
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
                        {filteredPrescriptions.length === 0 ? (
                            <div className="text-center py-24 text-stone-600 border-2 border-dashed border-stone-800/50 rounded-[2.5rem] mx-1">
                                <div className="w-16 h-16 bg-stone-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                                    <FileText size={32} className="text-stone-700" />
                                </div>
                                <p className="font-bold tracking-tight">{prescriptionSearchTerm ? t('prescription.empty_search', { label: prescriptionLabel.toLowerCase() }) : t('prescription.empty_list', { label: prescriptionLabel.toLowerCase() })}</p>
                                {!prescriptionSearchTerm && <p className="text-xs mt-2 text-stone-500 font-medium">{t('prescription.empty_hint', { label: prescriptionLabel.toLowerCase() })}</p>}
                            </div>
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
                                                <div className="w-8 h-8 rounded-lg bg-blue-900/20 text-blue-400 flex items-center justify-center font-bold border border-blue-500/20 shadow-inner shrink-0">
                                                    <FileText size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-stone-100 text-sm leading-tight truncate tracking-tight">{farmer?.fullName || t('prescription.unknown_farmer', { farmer: farmerLabel })}</h3>
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
                                                    {p.totalAmount && p.totalAmount > 0 && (
                                                        <span className="text-[9px] font-black text-emerald-400 font-mono bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-sm">
                                                            {formatCurrency(p.totalAmount, userProfile?.currency || 'TRY')}
                                                        </span>
                                                    )}
                                                    <span className="text-[8px] font-black text-stone-400 flex items-center bg-stone-950/50 px-1.5 py-0.5 rounded border border-white/5 shadow-sm uppercase tracking-widest">
                                                        <Calendar size={8} className="mr-1" />
                                                        {dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                {isCompany ? (
                                                    <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                                                        p.status === 'APPROVED' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                                        p.status === 'DELIVERED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                                        p.status === 'INVOICED' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                                                        'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                                                    }`}>
                                                        {p.status === 'APPROVED' ? t('prescription.status_approved') :
                                                         p.status === 'DELIVERED' ? t('prescription.status_delivered') :
                                                         p.status === 'INVOICED' ? t('prescription.status_invoiced') :
                                                         t('prescription.status_pending')}
                                                    </div>
                                                ) : (
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
                                                )}
                                            </div>
                                        </div>
                                        <div className="pl-11 mt-1">
                                            <div className="flex flex-wrap gap-1">
                                                {p.items.slice(0, 3).map((item, idx) => (
                                                    <span key={idx} className="text-[7px] font-black uppercase tracking-widest bg-stone-950/50 text-stone-500 px-1.5 py-0.5 rounded border border-white/5">
                                                        {item.pesticideName} {item.quantity && `(x${item.quantity})`}
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
                    <button 
                        onClick={() => { resetForm(); changeViewMode('FORM'); }}
                        className="fixed bottom-32 right-6 md:bottom-10 md:right-10 bg-emerald-600 text-white px-6 py-4 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center gap-2 font-bold text-sm"
                    >
                        <Plus size={24} /> Yeni Reçete
                    </button>
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
                        {isCompany ? (
                            <div className="flex items-center space-x-1 bg-stone-900 rounded-full border border-white/10 p-1">
                                <button 
                                    type="button"
                                    onClick={(e) => handleStatusChange(e, detailPrescription, 'PENDING')}
                                    disabled={activeTeamMember?.role !== 'MANAGER' && activeTeamMember?.role !== 'SALES'}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                                        detailPrescription.status === 'PENDING' || !detailPrescription.status
                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                                        : 'text-stone-500 hover:text-stone-300 disabled:opacity-50'
                                    }`}
                                >
                                    BEKLİYOR
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => handleStatusChange(e, detailPrescription, 'APPROVED')}
                                    disabled={activeTeamMember?.role !== 'MANAGER'}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                                        detailPrescription.status === 'APPROVED' 
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                        : 'text-stone-500 hover:text-stone-300 disabled:opacity-50'
                                    }`}
                                >
                                    ONAYLANDI
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => handleStatusChange(e, detailPrescription, 'DELIVERED')}
                                    disabled={activeTeamMember?.role !== 'MANAGER' && activeTeamMember?.role !== 'WAREHOUSE'}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                                        detailPrescription.status === 'DELIVERED' 
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                        : 'text-stone-500 hover:text-stone-300 disabled:opacity-50'
                                    }`}
                                >
                                    TESLİM EDİLDİ
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => handleStatusChange(e, detailPrescription, 'INVOICED')}
                                    disabled={activeTeamMember?.role !== 'MANAGER' && activeTeamMember?.role !== 'ACCOUNTING'}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                                        detailPrescription.status === 'INVOICED' 
                                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                                        : 'text-stone-500 hover:text-stone-300 disabled:opacity-50'
                                    }`}
                                >
                                    FATURALANDI
                                </button>
                            </div>
                        ) : (
                            <button 
                                type="button"
                                onClick={(e) => toggleProcessed(e, detailPrescription)}
                                className={`p-2.5 rounded-full border transition-all active:scale-90 ${
                                    detailPrescription.isProcessed 
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                                }`}
                                title={detailPrescription.isProcessed ? "İşlendi" : "İşlenmedi"}
                            >
                                {detailPrescription.isProcessed ? <Check size={20} /> : <X size={20} />}
                            </button>
                        )}
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
                <div ref={receiptRef} className="bg-white p-8 rounded-xl shadow-lg border border-stone-200 text-left mb-8 relative overflow-hidden text-stone-800">
                    <div className="absolute top-0 left-0 w-full h-3 bg-emerald-600"></div>
                    <div className="flex justify-between mb-8 pt-4">
                         <div>
                            <h3 className="font-bold text-2xl text-stone-900 tracking-tight">Zirai {prescriptionLabel}</h3>
                            <p className="text-xs text-stone-400 mt-1 uppercase font-bold tracking-widest">{detailPrescription.prescriptionNo}</p>
                            <p className="text-[10px] text-stone-500 font-bold mt-1 flex items-center">
                                <User size={10} className="mr-1" />
                                {detailPrescription.createdById ? (teamMembers.find(m => m.id === detailPrescription.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                            </p>
                            {detailPrescription.fieldId && (
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">
                                    Tarla: {selectedFarmer?.fields?.find(f => f.id === detailPrescription.fieldId)?.name || 'Bilinmiyor'}
                                </p>
                            )}
                         </div>
                         <div className="text-right">
                             <p className="font-bold text-emerald-700 text-xl">{selectedFarmer?.fullName}</p>
                             <p className="text-xs text-stone-500">{selectedFarmer?.village}</p>
                             <p className="text-[10px] text-stone-400 mt-1">{new Date(detailPrescription.date).toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
                         </div>
                    </div>
                    
                    <div className="min-h-[250px]">
                        {detailPrescription.totalAmount && detailPrescription.totalAmount > 0 ? (
                            <table className="w-full text-sm">
                                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-black tracking-widest border-b border-stone-100">
                                    <tr>
                                        <th className="p-3 text-left w-[40%]">Ürün Adı</th>
                                        <th className="p-3 text-center w-[15%]">Adet</th>
                                        <th className="p-3 text-right w-[20%]">Birim Fiyat</th>
                                        <th className="p-3 text-right w-[25%]">Toplam</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {detailPrescription.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3">
                                                <div className="font-bold text-stone-800">{item.pesticideName}</div>
                                                <div className="text-[10px] text-stone-500 font-mono mt-0.5">Doz: {item.dosage}</div>
                                            </td>
                                            <td className="p-3 text-center font-bold text-stone-700">
                                                {item.quantity || '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-stone-600">
                                                {item.unitPrice ? formatCurrency(item.unitPrice, userProfile?.currency || 'TRY') : '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-stone-800">
                                                {item.totalPrice ? formatCurrency(item.totalPrice, userProfile?.currency || 'TRY') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-stone-50/50 border-t border-stone-200">
                                        <td colSpan={3} className="p-3 text-right font-bold text-stone-500 uppercase text-[10px] tracking-widest pt-4">
                                            {detailPrescription.priceType === 'CASH' ? 'PEŞİN SATIŞ ' : 'VADELİ SATIŞ '}
                                            {prescriptionLabel} Toplamı
                                        </td>
                                        <td className="p-3 text-right font-black text-emerald-600 font-mono text-lg pt-4">
                                            {formatCurrency(detailPrescription.totalAmount, userProfile?.currency || 'TRY')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-black tracking-widest">
                                    <tr>
                                        <th className="p-4 text-left rounded-l-xl">Ürün / İlaç Adı</th>
                                        <th className="p-4 text-right rounded-r-xl">Uygulama Dozajı</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {detailPrescription.items.map((item, idx) => (
                                        <tr key={idx} className="group">
                                            <td className="p-4 font-bold text-stone-800">
                                                {item.pesticideName}
                                                {item.quantity && (
                                                    <span className="ml-2 text-stone-500 font-bold text-xs bg-stone-100 px-2 py-0.5 rounded-full">
                                                        {item.quantity} Adet
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-emerald-600">{item.dosage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="mt-12 pt-6 border-t-2 border-dashed border-stone-100 flex justify-between items-end">
                        <div className="text-[10px] text-stone-400 leading-relaxed">
                            Bu belge Mühendis Kayıt Sistemi<br/>
                            tarafından oluşturulmuştur.<br/>
                            <strong>Mühendis Kayıt Sistemi v3.1.2</strong>
                        </div>
                        <div className="text-center">
                            <div className="font-serif italic text-xl text-blue-900 mb-1">{detailPrescription.engineerName}</div>
                            <div className="text-[9px] text-stone-400 uppercase tracking-widest border-t border-stone-200 pt-2 font-bold">Dijital Onay / Kaşe</div>
                        </div>
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
                        PDF Paylaş
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
                     <div className={`h-full bg-emerald-600 transition-all duration-300 ${step === 1 ? 'w-1/4' : (step === 2 ? 'w-2/4' : (step === 3 ? 'w-3/4' : 'w-full'))}`}></div>
                 </div>
                 <span className="font-bold text-emerald-500 text-sm whitespace-nowrap">Adım {step}/4</span>
            </div>

            {step === 1 && (
                <div className="pb-24">
                    <div className="flex items-center justify-center mb-4">
                        <h2 className="text-2xl font-bold text-stone-100 text-center">
                            {editingId ? `${prescriptionLabel} Düzenle: ${farmerLabel}` : `${farmerLabel} Seçimi`}
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">{farmerLabel}</label>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                                    {filteredFarmers.map(f => (
                                        <button 
                                            key={f.id} 
                                            onClick={() => { setSelectedFarmer(f); setSelectedFieldId(''); }}
                                            className={`w-full text-left p-2 rounded-xl border flex justify-between items-center group transition-colors ${
                                                selectedFarmer?.id === f.id
                                                ? 'bg-emerald-900/20 border-emerald-500'
                                                : 'bg-stone-900 border-white/5 hover:border-emerald-500/50'
                                            }`}
                                        >
                                            <div>
                                                <span className="font-bold text-stone-200 block text-xs group-hover:text-emerald-400">{f.fullName}</span>
                                                <span className="text-[9px] text-stone-500 flex items-center mt-0.5"><MapPin size={9} className="mr-1"/> {f.village}</span>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedFarmer?.id === f.id ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 group-hover:bg-emerald-900/30 group-hover:text-emerald-500'}`}>
                                                {selectedFarmer?.id === f.id ? <Check size={12} /> : <User size={12} />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Tarla</label>
                                <div className="space-y-2">
                                    {!selectedFarmer ? (
                                        <div className="p-8 border-2 border-dashed border-stone-800 rounded-xl text-center text-stone-600 text-xs">
                                            Önce çiftçi seçiniz
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedFarmer.fields?.map(field => (
                                                <button 
                                                    key={field.id} 
                                                    onClick={() => setSelectedFieldId(field.id)}
                                                    className={`w-full text-left p-2 rounded-xl border flex justify-between items-center group transition-colors ${
                                                        selectedFieldId === field.id
                                                        ? 'bg-emerald-900/20 border-emerald-500'
                                                        : 'bg-stone-900 border-white/5 hover:border-emerald-500/50'
                                                    }`}
                                                >
                                                    <div>
                                                        <span className="font-bold text-stone-200 block text-xs group-hover:text-emerald-400">{field.name}</span>
                                                        <span className="text-[9px] text-stone-500 flex items-center mt-0.5">{field.crop} - {field.size} da</span>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedFieldId === field.id ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 group-hover:bg-emerald-900/30 group-hover:text-emerald-500'}`}>
                                                        {selectedFieldId === field.id ? <Check size={12} /> : <MapPin size={12} />}
                                                    </div>
                                                </button>
                                            ))}
                                            {(!selectedFarmer.fields || selectedFarmer.fields.length === 0) && (
                                                <div className="p-8 border-2 border-dashed border-stone-800 rounded-xl text-center text-stone-600 text-xs">
                                                    Bu çiftçinin kayıtlı tarlası bulunamadı.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="fixed bottom-20 left-0 w-full p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-stone-950 via-stone-950 to-transparent pb-6">
                        <div className="max-w-3xl mx-auto">
                            <button 
                                disabled={!selectedFarmer}
                                onClick={() => changeStep(2)} 
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-emerald-900/30 disabled:opacity-50 active:scale-95 transition-all border border-emerald-500/20"
                            >
                                İlaç Seçimine Geç <Plus size={20} className="ml-2"/>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="pb-24">
                    <h2 className="text-2xl font-bold mb-4 text-stone-100 text-center">
                        {editingId ? `${prescriptionLabel} Düzenle: İlaçlar` : 'İlaç Seç'}
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
                                        <button 
                                            key={inv.id}
                                            onClick={() => !isSelected && addItem(p)}
                                            disabled={isSelected}
                                            className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center ${
                                                isSelected 
                                                ? 'bg-stone-800/50 border-emerald-900/30 opacity-50 cursor-not-allowed' 
                                                : 'bg-stone-900 border-white/5 hover:border-emerald-500/30 hover:bg-stone-800'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className="p-2 bg-stone-800 rounded-lg text-stone-400 group-hover:text-emerald-400">
                                                    <Package size={16} />
                                                </div>
                                                <div>
                                                    <span className="font-bold text-stone-200 block text-sm">{inv.pesticideName}</span>
                                                    <span className="text-[10px] text-stone-500 font-mono">Stok: {inv.quantity} {inv.unit} | Fiyat: {formatCurrency(inv.sellingPrice, userProfile?.currency || 'TRY')}</span>
                                                </div>
                                            </div>
                                            {isSelected ? (
                                                <Check size={16} className="text-emerald-500" />
                                            ) : (
                                                <Plus size={16} className="text-stone-600" />
                                            )}
                                        </button>
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
                                onClick={() => changeStep(3)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/40 disabled:opacity-50 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border border-emerald-500/20"
                             >
                                İlaç Detaylarını Gir <Check size={20} className="ml-2" />
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div>
                    <h2 className="text-2xl font-bold mb-4 text-stone-100 text-center">
                        İlaç Detayları
                    </h2>
                    <div className="space-y-4 pb-40">
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            <div className="flex items-center space-x-2 bg-stone-900 px-3 py-2 rounded-xl border border-stone-800">
                                <span className="text-[9px] text-stone-500 font-bold uppercase tracking-tighter whitespace-nowrap">Reçete No:</span>
                                <input 
                                    type="text" 
                                    value={customPrescriptionNo}
                                    onChange={(e) => setCustomPrescriptionNo(e.target.value)}
                                    placeholder="Otomatik"
                                    className="bg-transparent border-none text-[11px] text-stone-200 w-full focus:ring-0 p-0 placeholder:text-stone-700 outline-none font-bold"
                                />
                            </div>
                            <div className="flex items-center bg-stone-900 rounded-xl border border-stone-800 p-1">
                                <button
                                    onClick={() => handlePriceTypeChange('CASH')}
                                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${prescriptionPriceType === 'CASH' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    PEŞİN
                                </button>
                                <button
                                    onClick={() => handlePriceTypeChange('TERM')}
                                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${prescriptionPriceType === 'TERM' ? 'bg-stone-700 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    VADELİ
                                </button>
                            </div>
                            <div className="flex items-center justify-between bg-stone-900 px-3 py-2 rounded-xl border border-stone-800">
                                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-tight whitespace-nowrap">Fiyatlar</span>
                                <button 
                                    onClick={() => setShowPrices(!showPrices)}
                                    className={`w-8 h-5 rounded-full p-0.5 transition-colors shrink-0 ${showPrices ? 'bg-emerald-600' : 'bg-stone-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showPrices ? 'translate-x-3' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </div>
                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-stone-900 p-3 rounded-xl shadow-sm border border-emerald-900/10 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 mb-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                                            <h4 className="font-bold text-stone-100 text-xs truncate">{item.pesticide.name}</h4>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <input 
                                                    type="text" 
                                                    value={item.dosage}
                                                    onChange={(e) => updateDosage(item.pesticide.id, e.target.value)}
                                                    className="w-full p-2 bg-stone-950 border border-stone-800 rounded-lg font-medium outline-none focus:border-emerald-500 text-stone-200 transition-colors text-[11px]"
                                                    placeholder="Dozaj (Örn: 50cc)"
                                                />
                                            </div>
                                            <div className="w-16 shrink-0">
                                                <input 
                                                    type="text" 
                                                    value={item.quantity}
                                                    onChange={(e) => updateQuantity(item.pesticide.id, e.target.value)}
                                                    className="w-full p-2 bg-stone-950 border border-stone-800 rounded-lg font-medium outline-none focus:border-emerald-500 text-stone-200 transition-colors text-[11px] text-center"
                                                    placeholder="Adet"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <button onClick={() => removeItem(item.pesticide.id)} className="text-stone-700 hover:text-rose-500 p-1 transition-colors"><Trash2 size={14}/></button>
                                        {showPrices && (
                                            <div className="text-right">
                                                <input 
                                                    type="number" 
                                                    value={item.unitPrice || ''}
                                                    onChange={(e) => updatePrice(item.pesticide.id, e.target.value)}
                                                    className="w-20 p-1.5 bg-stone-950 border border-stone-800 rounded-lg font-bold outline-none focus:border-emerald-500 text-emerald-400 transition-colors text-[10px] text-right"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {showPrices && (
                                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                                        <span className="text-[9px] text-stone-600 font-black uppercase tracking-widest">Satır Toplamı</span>
                                        <span className="text-xs font-black text-emerald-400 font-mono">
                                            {formatCurrency(item.totalPrice || 0, userProfile?.currency || 'TRY')}
                                        </span>
                                    </div>
                                )}
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
                                onClick={() => changeStep(4)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/40 disabled:opacity-50 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border border-emerald-500/20"
                             >
                                Devam Et <Check size={20} className="ml-2" />
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 4 && (
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
                                         {item.quantity && <span className="text-xs text-stone-500 font-bold bg-stone-950 px-2 py-0.5 rounded-full inline-block mt-1">{item.quantity} Adet</span>}
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
                             {selectedItems.some(i => i.totalPrice && i.totalPrice > 0) && (
                                 <div className="flex justify-between py-4 border-t border-white/10 mt-4 items-center">
                                     <div>
                                         <span className="font-bold text-stone-300 block">TOPLAM TUTAR</span>
                                         <span className={`text-[10px] font-black px-2 py-0.5 rounded-full mt-1 inline-block ${prescriptionPriceType === 'CASH' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-stone-800 text-stone-500'}`}>
                                             {prescriptionPriceType === 'CASH' ? 'PEŞİN SATIŞ' : 'VADELİ SATIŞ'}
                                         </span>
                                     </div>
                                     <span className="font-bold text-emerald-400 text-lg font-mono">
                                         {formatCurrency(selectedItems.reduce((acc, item) => acc + (item.totalPrice || 0), 0), userProfile?.currency || 'TRY')}
                                     </span>
                                 </div>
                             )}
                         </div>
                    </div>
                    <div className="fixed bottom-20 left-0 w-full p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-stone-950 via-stone-950 to-transparent pb-6">
                        <div className="max-w-3xl mx-auto">
                            <button 
                                onClick={handleSave}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 flex items-center justify-center transition-all border border-emerald-500/20"
                            >
                                <FileOutput className="mr-2" /> {editingId ? `${prescriptionLabel}yi Güncelle` : `${prescriptionLabel}yi Oluştur`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isScanning && (
                <BarcodeScanner 
                    onScan={handleScan} 
                    onClose={() => setIsScanning(false)} 
                />
            )}
        </div>
    );
};

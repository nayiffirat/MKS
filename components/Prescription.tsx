
// ... imports ...
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import { Farmer, Pesticide, Prescription, PesticideCategory, VisitLog, AppNotification } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { GeminiService } from '../services/gemini';
import { Check, Plus, Trash2, FileOutput, Share2, FileText, Calendar, MapPin, X, User, Loader2, Search, FlaskConical, MessageCircle, Edit2, AlertCircle, ArrowLeft, Printer, Package, Download, MessageSquare, RefreshCw, Mic, MicOff, Sparkles, Waves } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
        farmers: contextFarmers,
        inventory: contextInventory,
        showToast,
        hapticFeedback
    } = useAppViewModel();
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'DETAIL'>(initialFarmerId ? 'FORM' : 'LIST');
    
    // Sub-navigation sync
    useEffect(() => {
        const handlePop = (e: PopStateEvent) => {
            const state = e.state;
            if (state?.view === 'PRESCRIPTIONS') {
                if (state.subView) {
                    setViewMode(state.subView);
                    if (state.subView === 'DETAIL' && state.detailId) {
                        const target = contextPrescriptions.find(p => p.id === state.detailId);
                        if (target) setDetailPrescription(target);
                    }
                } else {
                    setViewMode('LIST');
                    setDetailPrescription(null);
                    setEditingId(null);
                }
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [contextPrescriptions]);

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
            window.history.pushState({ ...window.history.state, subView: mode, detailId }, '');
            setViewMode(mode);
        }
    };
    
    const [farmerMap, setFarmerMap] = useState<Record<string, Farmer>>({});

    const [step, setStep] = useState(1);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [farmerSearchTerm, setFarmerSearchTerm] = useState('');
    const [pesticideSearchTerm, setPesticideSearchTerm] = useState('');
    const [prescriptionSearchTerm, setPrescriptionSearchTerm] = useState('');
    
    // Updated state to include quantity and price
    const [selectedItems, setSelectedItems] = useState<{pesticide: Pesticide, dosage: string, quantity: string, unitPrice?: string, totalPrice?: number}[]>([]);
    const [showPrices, setShowPrices] = useState(false);
    
    const [isSaved, setIsSaved] = useState(false);
    const [savedPrescription, setSavedPrescription] = useState<Prescription | null>(null);
    
    // Detail View State
    const [detailPrescription, setDetailPrescription] = useState<Prescription | null>(null);

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const [filterMode, setFilterMode] = useState<'ALL' | 'PROCESSED' | 'UNPROCESSED'>('ALL');
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isParsingVoice, setIsParsingVoice] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [prescriptionListeningTime, setPrescriptionListeningTime] = useState(0);
    const receiptRef = useRef<HTMLDivElement>(null);
    const prescriptionTimerRef = useRef<NodeJS.Timeout | null>(null);

    const startFullVoicePrescription = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast('Tarayıcınız sesli girişi desteklemiyor.', 'error');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        const transcriptRef = { current: '' };
        let silenceTimer: NodeJS.Timeout | null = null;

        const stopRecognition = () => {
            if (silenceTimer) clearTimeout(silenceTimer);
            if (prescriptionTimerRef.current) clearInterval(prescriptionTimerRef.current);
            try {
                recognition.stop();
            } catch (e) {}
            setIsListening(false);
            setPrescriptionListeningTime(0);
        };

        recognition.onstart = () => {
            setIsListening(true);
            setVoiceTranscript('');
            transcriptRef.current = '';
            hapticFeedback('light');
            showToast('Reçete bilgilerini söyleyin...', 'info');
            
            setPrescriptionListeningTime(10);
            prescriptionTimerRef.current = setInterval(() => {
                setPrescriptionListeningTime(prev => {
                    if (prev <= 1) {
                        if (prescriptionTimerRef.current) clearInterval(prescriptionTimerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            // Auto-stop after 12 seconds total (giving a bit of buffer)
            silenceTimer = setTimeout(() => {
                stopRecognition();
            }, 12000);
        };

        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let currentFinal = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    currentFinal += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            transcriptRef.current += currentFinal;
            setVoiceTranscript(transcriptRef.current + interimTranscript);
        };

        recognition.onend = async () => {
            setIsListening(false);
            setPrescriptionListeningTime(0);
            if (silenceTimer) clearTimeout(silenceTimer);
            if (prescriptionTimerRef.current) clearInterval(prescriptionTimerRef.current);
            
            // Use transcriptRef directly to avoid closure issues with state
            // Also include any remaining interim transcript if possible, though onend usually means it's final
            const transcriptToParse = (transcriptRef.current || voiceTranscript).trim();
            
            if (!transcriptToParse) {
                setIsParsingVoice(false);
                return;
            }

            setIsParsingVoice(true);
            hapticFeedback('medium');
            
            try {
                const parsedData = await GeminiService.parsePrescriptionFromVoice(transcriptToParse);
                
                if (parsedData) {
                    // Try to match farmer
                    if (parsedData.farmerName) {
                        const matchedFarmer = farmers.find(f => 
                            f.fullName.toLowerCase().includes(parsedData.farmerName.toLowerCase())
                        );
                        if (matchedFarmer) setSelectedFarmer(matchedFarmer);
                    }

                    // Map items
                    const newItems: any[] = [];
                    if (parsedData.items && Array.isArray(parsedData.items)) {
                        for (const item of parsedData.items) {
                            const matchedPesticide = pesticides.find(p => 
                                p.name.toLowerCase().includes(item.pesticideName.toLowerCase())
                            );
                            
                            if (matchedPesticide) {
                                const inventoryItem = contextInventory.find(inv => inv.pesticideId === matchedPesticide.id);
                                const sellingPrice = inventoryItem ? inventoryItem.sellingPrice : 0;
                                const qty = 1;

                                newItems.push({
                                    pesticide: matchedPesticide,
                                    dosage: item.dosage || matchedPesticide.defaultDosage,
                                    quantity: qty.toString(),
                                    unitPrice: sellingPrice ? sellingPrice.toString() : '',
                                    totalPrice: qty * sellingPrice
                                });
                            }
                        }
                    }

                    if (newItems.length > 0) {
                        setSelectedItems(newItems);
                        setStep(2);
                        showToast('Reçete başarıyla analiz edildi.', 'success');
                    } else {
                        showToast('İlaçlar kütüphanede bulunamadı.', 'info');
                    }
                }
            } catch (error) {
                console.error("Voice parse error:", error);
                showToast('Ses analizi başarısız oldu.', 'error');
            } finally {
                setIsParsingVoice(false);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.start();
    };

    const startVoiceInput = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast('Tarayıcınız sesli girişi desteklemiyor.', 'error');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            hapticFeedback('light');
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setPesticideSearchTerm(transcript);
            if (event.results[0].isFinal) {
                hapticFeedback('medium');
                setIsListening(false);
                recognition.stop();
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (initialFarmerId && farmers.length > 0) {
            const preSelected = farmers.find(farm => farm.id === initialFarmerId);
            if (preSelected) {
                setSelectedFarmer(preSelected);
                setStep(2);
            }
        }
    }, [initialFarmerId, farmers]);

    useEffect(() => {
        if (initialPrescriptionId && contextPrescriptions.length > 0 && pesticides.length > 0) {
            const p = contextPrescriptions.find(presc => presc.id === initialPrescriptionId);
            if (p) {
                handleEdit(null as any, p);
            }
        }
    }, [initialPrescriptionId, contextPrescriptions, pesticides]);

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
        if (initialFarmerId) {
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
        setIsSaved(false);
        setSavedPrescription(null);
        setDetailPrescription(null);
        setIsProcessingPdf(false);
        setEditingId(null);
    };

    const addItem = (pesticide: Pesticide) => {
        if (!selectedItems.find(i => i.pesticide.id === pesticide.id)) {
            // Find inventory item to get selling price
            const inventoryItem = contextInventory.find(inv => inv.pesticideId === pesticide.id);
            const sellingPrice = inventoryItem ? inventoryItem.sellingPrice.toString() : '';

            // Initialize quantity as '1'
            const initialQty = 1;
            const initialPrice = inventoryItem ? inventoryItem.sellingPrice : 0;
            
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

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Bu reçeteyi silmek istediğinize emin misiniz?")) {
            const target = contextPrescriptions.find(p => p.id === id);
            if (target && target.isInventoryProcessed) {
                await dbService.revertInventory(target);
            }
            await dbService.deletePrescription(id);
            await loadData();
            await refreshStats();
            showToast('Reçete başarıyla silindi', 'success');
            hapticFeedback('medium');
            if (viewMode === 'DETAIL') {
                changeViewMode('LIST');
                setDetailPrescription(null);
            }
        }
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

        setSelectedItems(reconstructedItems);
        setEditingId(p.id);
        setStep(2); // Jump directly to items
        changeViewMode('FORM');
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
            ? "Bu reçeteyi 'İşlenmedi' durumuna geri almak istiyor musunuz?" 
            : "Bu reçete işlensin mi? (Onaylanırsa İşlenenler bölümüne aktarılacaktır)";
            
        if (window.confirm(message)) {
            try {
                const updated = await togglePrescriptionStatus(p.id);
                showToast(p.isProcessed ? 'Reçete işlenmedi olarak işaretlendi' : 'Reçete başarıyla işlendi', 'success');
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
                items: items,
                totalAmount: totalAmount > 0 ? totalAmount : undefined
            };

            await dbService.updatePrescription(updatedPrescription);
            
            // If it's still marked as processed, re-process with new items
            if (updatedPrescription.isProcessed) {
                await dbService.processInventory(updatedPrescription);
            }

            setSavedPrescription(updatedPrescription);
        } else {
            // Create new
            const newPrescription: Prescription = {
                id: crypto.randomUUID(),
                farmerId: selectedFarmer.id,
                fieldId: selectedFieldId || undefined,
                date: new Date().toISOString(),
                prescriptionNo: `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                engineerName: userProfile.fullName || 'Ziraat Mühendisi',
                items: items,
                isOfficial: true,
                isProcessed: false,
                totalAmount: totalAmount > 0 ? totalAmount : undefined
            };

            await dbService.addPrescription(newPrescription);
            
            // Create a visit log entry automatically
            const newVisit: VisitLog = {
                id: crypto.randomUUID(),
                farmerId: selectedFarmer.id,
                fieldId: selectedFieldId || undefined,
                date: new Date().toISOString(),
                note: `Reçete verildi (${newPrescription.prescriptionNo})`,
                village: selectedFarmer.village
            };
            await dbService.addVisit(newVisit);
            
            // Add a notification
            const newNotification: AppNotification = {
                id: crypto.randomUUID(),
                type: 'SUCCESS',
                title: 'Reçete ve Ziyaret Kaydı',
                message: `${selectedFarmer.fullName} için reçete yazıldı ve ziyaret kaydı oluşturuldu.`,
                date: new Date().toISOString(),
                isRead: false
            };
            await dbService.addNotification(newNotification);
            
            setSavedPrescription(newPrescription);
        }

        setIsSaved(true);
        await loadData();
        await refreshStats();
        showToast('Reçete başarıyla kaydedildi', 'success');
        hapticFeedback('success');
        changeViewMode('LIST');
        resetForm();
    };

    const handleWhatsAppText = (targetPrescription: Prescription, targetFarmer: Farmer) => {
        let text = `*ZİRAİ REÇETE*\n`;
        text += `Sayın *${targetFarmer.fullName}*,\n\n`;
        text += `Tarih: ${new Date(targetPrescription.date).toLocaleDateString('tr-TR')}\n`;
        text += `Reçete No: ${targetPrescription.prescriptionNo}\n\n`;
        text += `*Kullanılacak İlaçlar:*\n`;
        
        targetPrescription.items.forEach(item => {
            text += `- ${item.pesticideName}: *${item.dosage}*`;
            if (item.quantity) text += ` (${item.quantity} Adet)`;
            text += `\n`;
        });
        
        text += `\nGeçmiş olsun.\n${targetPrescription.engineerName}`;
        
        const url = `https://wa.me/${targetFarmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const handlePdfAction = async (action: 'SHARE' | 'DOWNLOAD', targetPrescription?: Prescription, targetFarmer?: Farmer) => {
        if (!receiptRef.current) return;
        setIsProcessingPdf(true);

        const currentPrescription = targetPrescription || savedPrescription || detailPrescription;
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
                    title: 'Zirai Reçete',
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

    const filteredPesticides = pesticides.filter(p => 
        p.name.toLowerCase().includes(pesticideSearchTerm.toLowerCase()) ||
        p.activeIngredient.toLowerCase().includes(pesticideSearchTerm.toLowerCase())
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
                            <h2 className="text-2xl font-bold text-stone-100">Reçete Defteri</h2>
                            <p className="text-sm text-stone-500">Yazılan resmi reçeteler</p>
                            {userProfile.lastSyncTime && (
                                <p className="text-[10px] text-emerald-500/80 mt-0.5 flex items-center">
                                    <Check size={10} className="mr-1" />
                                    Son Yedekleme: {new Date(userProfile.lastSyncTime).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            )}
                        </div>
                        <button 
                            onClick={handleSync} 
                            disabled={isSyncing}
                            className="px-3 py-1.5 bg-stone-900 text-stone-400 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                            title="Verileri Buluta Yedekle"
                        >
                            <RefreshCw size={14} className={isSyncing ? "animate-spin text-emerald-500" : ""} />
                            {isSyncing ? 'Yedekleniyor...' : 'Senkronize'}
                        </button>
                    </header>

                    <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-6 sticky top-20 z-10 backdrop-blur-md">
                        <Search className="text-stone-500 ml-3" size={18} />
                        <input 
                            type="text" 
                            placeholder="Çiftçi adı veya reçete no ara..." 
                            className="w-full p-3 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-sm"
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
                            Tümü
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
                            İşlenmeyenler
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
                            İşlenenler
                        </button>
                    </div>

                    <div className="space-y-5">
                        {filteredPrescriptions.length === 0 ? (
                            <div className="text-center py-24 text-stone-600 border-2 border-dashed border-stone-800/50 rounded-[2.5rem] mx-1">
                                <div className="w-16 h-16 bg-stone-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                                    <FileText size={32} className="text-stone-700" />
                                </div>
                                <p className="font-bold tracking-tight">{prescriptionSearchTerm ? 'Aranan kriterlere uygun reçete bulunamadı.' : 'Henüz reçete oluşturulmadı.'}</p>
                                {!prescriptionSearchTerm && <p className="text-xs mt-2 text-stone-500 font-medium">Yeni reçete yazmak için + butonuna basın.</p>}
                            </div>
                        ) : (
                            filteredPrescriptions.map(p => {
                                const farmer = farmerMap[p.farmerId];
                                const dateObj = new Date(p.date);

                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => handleViewDetail(p)}
                                        className="bg-stone-900/80 backdrop-blur-xl p-5 rounded-[2rem] shadow-xl border border-white/10 hover:border-emerald-500/30 transition-all relative overflow-hidden group cursor-pointer active:scale-[0.98]"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 rounded-2xl bg-blue-900/20 text-blue-400 flex items-center justify-center font-bold border border-blue-500/20 shadow-inner">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-stone-100 text-lg leading-tight truncate tracking-tight">{farmer?.fullName || 'Bilinmeyen Çiftçi'}</h3>
                                                    <p className="text-[10px] text-stone-500 font-black uppercase tracking-widest mt-1">{p.prescriptionNo}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2.5">
                                                <div className="flex items-center gap-2">
                                                    {p.totalAmount && p.totalAmount > 0 && (
                                                        <span className="text-[11px] font-black text-emerald-400 font-mono bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-sm">
                                                            {p.totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-black text-stone-400 flex items-center bg-stone-950/50 px-2.5 py-1 rounded-lg border border-white/5 shadow-sm uppercase tracking-widest">
                                                        <Calendar size={11} className="mr-1.5" />
                                                        {dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => toggleProcessed(e, p)}
                                                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all border-2 active:scale-90 relative z-30 shadow-lg ${
                                                        p.isProcessed 
                                                        ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                                                        : 'bg-rose-600/10 border-rose-500/30 text-rose-400'
                                                    }`}
                                                >
                                                    {p.isProcessed ? <Check size={22} strokeWidth={3} /> : <X size={22} strokeWidth={3} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="pl-16 mt-1">
                                            <div className="flex flex-wrap gap-2">
                                                {p.items.slice(0, 3).map((item, idx) => (
                                                    <span key={idx} className="text-[9px] font-black uppercase tracking-widest bg-stone-950/50 text-stone-500 px-3 py-1.5 rounded-xl border border-white/5">
                                                        {item.pesticideName} {item.quantity && `(x${item.quantity})`}
                                                    </span>
                                                ))}
                                                {p.items.length > 3 && (
                                                    <span className="text-[9px] font-black uppercase tracking-widest bg-stone-950/50 text-stone-600 px-3 py-1.5 rounded-xl border border-white/5">
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

                <button 
                    onClick={() => { resetForm(); changeViewMode('FORM'); }}
                    className="fixed bottom-32 right-6 md:bottom-10 md:right-10 bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center"
                >
                    <Plus size={28} />
                </button>
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
                        <button 
                            onClick={(e) => handleEdit(e, detailPrescription)} 
                            className="p-2 bg-stone-800 text-stone-300 rounded-full border border-white/5 hover:bg-stone-700 hover:text-emerald-400 transition-all"
                            title="Düzenle"
                        >
                            <Edit2 size={18} />
                        </button>
                        <button 
                            onClick={(e) => handleDelete(e, detailPrescription.id)}
                            className="p-2 bg-stone-800 text-stone-300 rounded-full border border-white/5 hover:bg-red-900/40 hover:text-red-400 transition-all"
                            title="Sil"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Receipt View Reuse */}
                <div ref={receiptRef} className="bg-white p-8 rounded-xl shadow-lg border border-stone-200 text-left mb-8 relative overflow-hidden text-stone-800">
                    <div className="absolute top-0 left-0 w-full h-3 bg-emerald-600"></div>
                    <div className="flex justify-between mb-8 pt-4">
                         <div>
                            <h3 className="font-bold text-2xl text-stone-900 tracking-tight">Zirai Reçete</h3>
                            <p className="text-xs text-stone-400 mt-1 uppercase font-bold tracking-widest">{detailPrescription.prescriptionNo}</p>
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
                                                {item.unitPrice ? item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-stone-800">
                                                {item.totalPrice ? item.totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-stone-50/50 border-t border-stone-200">
                                        <td colSpan={3} className="p-3 text-right font-bold text-stone-500 uppercase text-[10px] tracking-widest pt-4">Reçete Toplamı</td>
                                        <td className="p-3 text-right font-black text-emerald-600 font-mono text-lg pt-4">
                                            {detailPrescription.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
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
                            Bu belge dijital asistan tarafından<br/>
                            mühendis onayıyla oluşturulmuştur.<br/>
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
            </div>
        );
    }

    if (isSaved && savedPrescription) {
        return (
            <div className="p-6 max-w-2xl mx-auto text-center animate-in zoom-in duration-300 min-h-[80vh]">
                <div className="w-20 h-20 bg-green-900/30 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check size={40} />
                </div>
                <h2 className="text-2xl font-bold text-stone-100 mb-2">
                    {editingId ? 'Reçete Güncellendi!' : 'Reçete Kaydedildi!'}
                </h2>
                <p className="text-stone-500 mb-8">Reçete No: {savedPrescription.prescriptionNo}</p>
                
                <div ref={receiptRef} className="bg-white p-8 rounded-xl shadow-lg border border-stone-200 text-left mb-8 relative overflow-hidden text-stone-800">
                    <div className="absolute top-0 left-0 w-full h-3 bg-emerald-600"></div>
                    <div className="flex justify-between mb-8 pt-4">
                         <div>
                            <h3 className="font-bold text-2xl text-stone-900 tracking-tight">Zirai Reçete</h3>
                            <p className="text-xs text-stone-400 mt-1 uppercase font-bold tracking-widest">{savedPrescription.prescriptionNo}</p>
                            {savedPrescription.fieldId && (
                                <p className="text-[10px] text-emerald-600 font-bold mt-1">
                                    Tarla: {selectedFarmer?.fields?.find(f => f.id === savedPrescription.fieldId)?.name || 'Bilinmiyor'}
                                </p>
                            )}
                         </div>
                         <div className="text-right">
                             <p className="font-bold text-emerald-700 text-xl">{selectedFarmer?.fullName}</p>
                             <p className="text-xs text-stone-500">{selectedFarmer?.village}</p>
                             <p className="text-[10px] text-stone-400 mt-1">{new Date(savedPrescription.date).toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
                         </div>
                    </div>
                    
                    <div className="min-h-[250px]">
                        {savedPrescription.totalAmount && savedPrescription.totalAmount > 0 ? (
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
                                    {savedPrescription.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-3">
                                                <div className="font-bold text-stone-800">{item.pesticideName}</div>
                                                <div className="text-[10px] text-stone-500 font-mono mt-0.5">Doz: {item.dosage}</div>
                                            </td>
                                            <td className="p-3 text-center font-bold text-stone-700">
                                                {item.quantity || '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono text-stone-600">
                                                {item.unitPrice ? item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-stone-800">
                                                {item.totalPrice ? item.totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-stone-50/50 border-t border-stone-200">
                                        <td colSpan={3} className="p-3 text-right font-bold text-stone-500 uppercase text-[10px] tracking-widest pt-4">Reçete Toplamı</td>
                                        <td className="p-3 text-right font-black text-emerald-600 font-mono text-lg pt-4">
                                            {savedPrescription.totalAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
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
                                    {savedPrescription.items.map((item, idx) => (
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
                            Bu belge dijital asistan tarafından<br/>
                            mühendis onayıyla oluşturulmuştur.<br/>
                            <strong>Mühendis Kayıt Sistemi v3.1.2</strong>
                        </div>
                        <div className="text-center">
                            <div className="font-serif italic text-xl text-blue-900 mb-1">{savedPrescription.engineerName}</div>
                            <div className="text-[9px] text-stone-400 uppercase tracking-widest border-t border-stone-200 pt-2 font-bold">Dijital Onay / Kaşe</div>
                        </div>
                    </div>
                </div>

                {/* SPLIT ACTION BUTTONS */}
                <div className="flex gap-2 mb-3">
                    <button 
                        onClick={() => handlePdfAction('SHARE', savedPrescription, selectedFarmer || undefined)} 
                        disabled={isProcessingPdf}
                        className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                    >
                        {isProcessingPdf ? <Loader2 size={20} className="mr-2 animate-spin"/> : <Share2 size={20} className="mr-2"/>}
                        PDF Paylaş
                    </button>
                    
                    <button 
                        onClick={() => selectedFarmer && handleWhatsAppText(savedPrescription, selectedFarmer)}
                        className="flex-1 py-4 rounded-2xl bg-[#25D366] text-white font-black text-sm shadow-xl hover:bg-[#20bd5a] flex items-center justify-center active:scale-95 transition-all"
                    >
                        <MessageCircle size={20} className="mr-2"/>
                        WP Özet
                    </button>

                    <button 
                        onClick={() => handlePdfAction('DOWNLOAD', savedPrescription, selectedFarmer || undefined)} 
                        disabled={isProcessingPdf}
                        className="px-6 py-4 rounded-2xl bg-stone-800 text-stone-300 font-black text-sm border border-white/5 hover:bg-stone-700 flex items-center justify-center disabled:opacity-70 active:scale-95 transition-all"
                    >
                        {isProcessingPdf ? <Loader2 size={20} className="mr-2 animate-spin"/> : <Download size={20} />}
                    </button>
                </div>
                
                <button onClick={handleBackFromForm} className="w-full py-4 rounded-2xl bg-stone-900 text-stone-400 font-bold hover:text-stone-200 transition-colors border border-white/5 text-sm">
                    Listeye Dön
                </button>
            </div>
        );
    }

    // ... (step === 1, step === 2, step === 3 renderers remain same) ...
    return (
        <div className="p-4 max-w-3xl mx-auto pb-24 animate-in slide-in-from-right duration-200">
            <div className="flex items-center mb-6">
                 <button onClick={handleBackFromForm} className="mr-4 text-stone-400 hover:text-stone-200 flex items-center">
                    <X size={20} className="mr-1" /> İptal
                 </button>
                 <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden mx-4">
                     <div className={`h-full bg-emerald-600 transition-all duration-300 ${step === 1 ? 'w-1/3' : (step === 2 ? 'w-2/3' : 'w-full')}`}></div>
                 </div>
                 <span className="font-bold text-emerald-500 text-sm whitespace-nowrap">Adım {step}/3</span>
            </div>

            {step === 1 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-stone-100">
                            {editingId ? 'Reçete Düzenle: Çiftçi' : 'Çiftçi Seçimi'}
                        </h2>
                        <button 
                            onClick={startFullVoicePrescription}
                            disabled={isParsingVoice}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                isListening 
                                ? 'bg-rose-600 text-white animate-pulse' 
                                : 'bg-amber-600/20 text-amber-500 border border-amber-500/30 hover:bg-amber-600 hover:text-white'
                            }`}
                        >
                            {isParsingVoice ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Sparkles size={14} />
                            )}
                            {isListening ? (prescriptionListeningTime > 0 ? `Dinleniyor (${prescriptionListeningTime}s)` : 'Dinleniyor...') : (isParsingVoice ? 'Analiz Ediliyor...' : 'Sesle Reçete Oluştur')}
                        </button>
                    </div>

                    {isListening && voiceTranscript && (
                        <div className="mb-4 p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-2">
                                <Waves size={14} className="text-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Canlı Döküm</span>
                            </div>
                            <p className="text-stone-300 text-sm italic">"{voiceTranscript}"</p>
                        </div>
                    )}
                    
                    <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-4">
                        <Search className="text-stone-500 ml-3" size={18} />
                        <input 
                            type="text" 
                            placeholder="Çiftçi adı veya köy ile ara..." 
                            className="w-full p-3 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-sm"
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
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest ml-1">Çiftçi</label>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                                    {filteredFarmers.map(f => (
                                        <button 
                                            key={f.id} 
                                            onClick={() => { setSelectedFarmer(f); setSelectedFieldId(''); }}
                                            className={`w-full text-left p-4 rounded-xl border flex justify-between items-center group transition-colors ${
                                                selectedFarmer?.id === f.id
                                                ? 'bg-emerald-900/20 border-emerald-500'
                                                : 'bg-stone-900 border-white/5 hover:border-emerald-500/50'
                                            }`}
                                        >
                                            <div>
                                                <span className="font-bold text-stone-200 block group-hover:text-emerald-400">{f.fullName}</span>
                                                <span className="text-xs text-stone-500 flex items-center mt-1"><MapPin size={10} className="mr-1"/> {f.village}</span>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedFarmer?.id === f.id ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 group-hover:bg-emerald-900/30 group-hover:text-emerald-500'}`}>
                                                {selectedFarmer?.id === f.id ? <Check size={16} /> : <User size={16} />}
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
                                                    className={`w-full text-left p-4 rounded-xl border flex justify-between items-center group transition-colors ${
                                                        selectedFieldId === field.id
                                                        ? 'bg-emerald-900/20 border-emerald-500'
                                                        : 'bg-stone-900 border-white/5 hover:border-emerald-500/50'
                                                    }`}
                                                >
                                                    <div>
                                                        <span className="font-bold text-stone-200 block group-hover:text-emerald-400">{field.name}</span>
                                                        <span className="text-xs text-stone-500 flex items-center mt-1">{field.crop} - {field.size} da</span>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedFieldId === field.id ? 'bg-emerald-600 text-white' : 'bg-stone-800 text-stone-500 group-hover:bg-emerald-900/30 group-hover:text-emerald-500'}`}>
                                                        {selectedFieldId === field.id ? <Check size={16} /> : <MapPin size={16} />}
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
                    
                    <div className="mt-8 flex justify-end">
                        <button 
                            disabled={!selectedFarmer}
                            onClick={() => setStep(2)} 
                            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center shadow-lg shadow-emerald-900/30 disabled:opacity-50 active:scale-95 transition-all"
                        >
                            İlaç Seçimine Geç <Plus size={20} className="ml-2"/>
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div>
                    <h2 className="text-2xl font-bold mb-4 text-stone-100">
                        {editingId ? 'Reçete Düzenle: İlaçlar' : 'İlaç Ekle'}
                    </h2>
                    
                    <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1 mb-6">
                        <Search className="text-stone-500 ml-3" size={18} />
                        <input 
                            type="text" 
                            placeholder="İlaç adı veya etken madde ara..." 
                            className="w-full p-3 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-sm"
                            value={pesticideSearchTerm}
                            onChange={e => setPesticideSearchTerm(e.target.value)}
                        />
                        <button 
                            onClick={startVoiceInput}
                            className={`p-2 rounded-xl transition-all mr-1 ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-stone-500 hover:text-emerald-400 hover:bg-stone-800'}`}
                        >
                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                        {pesticideSearchTerm && (
                            <button onClick={() => setPesticideSearchTerm('')} className="p-2 text-stone-500 hover:text-stone-300">
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="mb-8">
                        <label className="text-xs font-bold text-stone-500 mb-3 block uppercase tracking-widest">Kütüphaneden Seç</label>
                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                            {filteredPesticides.length > 0 ? (
                                filteredPesticides.map(p => {
                                    const isSelected = selectedItems.some(i => i.pesticide.id === p.id);
                                    return (
                                        <button 
                                            key={p.id}
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
                                                    <FlaskConical size={16} />
                                                </div>
                                                <div>
                                                    <span className="font-bold text-stone-200 block text-sm">{p.name}</span>
                                                    <span className="text-[10px] text-stone-500 font-mono">{p.activeIngredient}</span>
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
                                    <p className="text-xs">Uygun ilaç bulunamadı.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pb-40">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-stone-500 block uppercase tracking-widest">Seçilen İlaçlar ve Dozaj</label>
                            <div className="flex items-center space-x-2">
                                <span className="text-xs text-stone-400 font-medium">Fiyat Ekle</span>
                                <button 
                                    onClick={() => setShowPrices(!showPrices)}
                                    className={`w-10 h-6 rounded-full p-1 transition-colors ${showPrices ? 'bg-emerald-600' : 'bg-stone-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${showPrices ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </div>
                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-stone-900 p-4 rounded-xl shadow-sm border border-emerald-900/10 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <h4 className="font-bold text-stone-100">{item.pesticide.name}</h4>
                                    </div>
                                    <button onClick={() => removeItem(item.pesticide.id)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 size={16}/></button>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="flex-1">
                                        <input 
                                            type="text" 
                                            value={item.dosage}
                                            onChange={(e) => updateDosage(item.pesticide.id, e.target.value)}
                                            className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-lg font-medium outline-none focus:border-emerald-500 text-stone-200 transition-colors text-sm"
                                            placeholder="Dozaj (Örn: 50cc)"
                                        />
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <input 
                                            type="text" 
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.pesticide.id, e.target.value)}
                                            className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-lg font-medium outline-none focus:border-emerald-500 text-stone-200 transition-colors text-sm"
                                            placeholder="Adet"
                                        />
                                    </div>
                                </div>
                                {showPrices && (
                                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center space-x-2 w-1/2">
                                            <span className="text-xs text-stone-500">Birim Fiyat:</span>
                                            <input 
                                                type="number" 
                                                value={item.unitPrice || ''}
                                                onChange={(e) => updatePrice(item.pesticide.id, e.target.value)}
                                                className="w-full p-2 bg-stone-950 border border-stone-800 rounded-lg font-medium outline-none focus:border-emerald-500 text-stone-200 transition-colors text-sm text-right"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-stone-500 block">Toplam</span>
                                            <span className="text-emerald-400 font-bold font-mono">
                                                {(item.totalPrice || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {selectedItems.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed border-stone-800 rounded-2xl text-stone-600 bg-stone-900/20">
                                <FlaskConical size={32} className="mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Yukarıdan ilaç arayıp ekleyiniz.</p>
                            </div>
                        )}
                    </div>

                    <div className="fixed bottom-20 left-0 w-full p-4 md:static md:p-0 md:mt-8 z-30 bg-gradient-to-t from-stone-950 via-stone-950 to-transparent pb-6">
                        <div className="max-w-3xl mx-auto">
                             <button 
                                disabled={selectedItems.length === 0}
                                onClick={() => setStep(3)}
                                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/40 disabled:opacity-50 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center border border-emerald-500/20"
                             >
                                Devam Et <Check size={20} className="ml-2" />
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div>
                    <h2 className="text-2xl font-bold mb-6 text-stone-100">Önizleme ve Onay</h2>
                    <div className="bg-stone-900 p-6 rounded-xl shadow-sm border border-white/5 mb-6">
                         <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                             <div>
                                 <p className="text-sm text-stone-500">Çiftçi</p>
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
                                         {item.totalPrice && item.totalPrice > 0 ? (
                                             <span className="text-xs text-emerald-400 font-mono block mt-1">
                                                 {item.totalPrice.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                             </span>
                                         ) : null}
                                     </div>
                                 </div>
                             ))}
                             
                             {/* Toplam Tutar Gösterimi */}
                             {selectedItems.some(i => i.totalPrice && i.totalPrice > 0) && (
                                 <div className="flex justify-between py-4 border-t border-white/10 mt-4">
                                     <span className="font-bold text-stone-300">TOPLAM TUTAR</span>
                                     <span className="font-bold text-emerald-400 text-lg font-mono">
                                         {selectedItems.reduce((acc, item) => acc + (item.totalPrice || 0), 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                     </span>
                                 </div>
                             )}
                         </div>
                    </div>
                    <button 
                        onClick={handleSave}
                        className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 flex items-center justify-center transition-all"
                    >
                        <FileOutput className="mr-2" /> {editingId ? 'Reçeteyi Güncelle' : 'Reçeteyi Oluştur'}
                    </button>
                </div>
            )}
        </div>
    );
};

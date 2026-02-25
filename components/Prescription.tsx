
// ... imports ...
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import { Farmer, Pesticide, Prescription, PesticideCategory } from '../types';
import { useAppViewModel } from '../context/AppContext';
import { Check, Plus, Trash2, FileOutput, Share2, FileText, Calendar, MapPin, X, User, Loader2, Search, FlaskConical, MessageCircle, Edit2, AlertCircle, ArrowLeft, Printer, Package, Download, MessageSquare } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PrescriptionFormProps {
    onBack: () => void;
    initialFarmerId?: string;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ onBack, initialFarmerId }) => {
    const { userProfile, refreshStats } = useAppViewModel();
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'DETAIL'>(initialFarmerId ? 'FORM' : 'LIST');
    
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [farmerMap, setFarmerMap] = useState<Record<string, Farmer>>({});

    const [step, setStep] = useState(1);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [pesticides, setPesticides] = useState<Pesticide[]>([]);
    
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [farmerSearchTerm, setFarmerSearchTerm] = useState('');
    const [pesticideSearchTerm, setPesticideSearchTerm] = useState('');
    const [prescriptionSearchTerm, setPrescriptionSearchTerm] = useState('');
    
    // Updated state to include quantity
    const [selectedItems, setSelectedItems] = useState<{pesticide: Pesticide, dosage: string, quantity: string}[]>([]);
    
    const [isSaved, setIsSaved] = useState(false);
    const [savedPrescription, setSavedPrescription] = useState<Prescription | null>(null);
    
    // Detail View State
    const [detailPrescription, setDetailPrescription] = useState<Prescription | null>(null);

    // Edit Mode State
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const [isProcessingPdf, setIsProcessingPdf] = useState(false);
    const receiptRef = useRef<HTMLDivElement>(null);

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

    const loadData = async () => {
        const [pList, fList, pestList] = await Promise.all([
            dbService.getAllPrescriptions(),
            dbService.getFarmers(),
            dbService.getPesticides()
        ]);

        setPrescriptions(pList);
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
            setViewMode('LIST');
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
            // Initialize quantity as empty string
            setSelectedItems([...selectedItems, { pesticide, dosage: pesticide.defaultDosage, quantity: '' }]);
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
        setSelectedItems(selectedItems.map(i => i.pesticide.id === id ? { ...i, quantity: newQuantity } : i));
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Bu reçeteyi silmek istediğinize emin misiniz?")) {
            await dbService.deletePrescription(id);
            await loadData();
            await refreshStats();
            if (viewMode === 'DETAIL') {
                setViewMode('LIST');
                setDetailPrescription(null);
            }
        }
    };

    const handleEdit = (e: React.MouseEvent, p: Prescription) => {
        e.stopPropagation();
        
        const farmer = farmerMap[p.farmerId];
        if (farmer) setSelectedFarmer(farmer);

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
                quantity: item.quantity || '' // Map existing quantity or default to empty
            };
        });

        setSelectedItems(reconstructedItems);
        setEditingId(p.id);
        setStep(2); // Jump directly to items
        setViewMode('FORM');
    };

    const handleViewDetail = (p: Prescription) => {
        setDetailPrescription(p);
        const farmer = farmerMap[p.farmerId];
        if (farmer) setSelectedFarmer(farmer);
        setViewMode('DETAIL');
    };

    const handleSave = async () => {
        if (!selectedFarmer) return;
        
        if (editingId) {
            // Update existing
            const original = prescriptions.find(p => p.id === editingId);
            if (!original) return;

            const updatedPrescription: Prescription = {
                ...original,
                farmerId: selectedFarmer.id,
                engineerName: userProfile.fullName || original.engineerName,
                items: selectedItems.map(i => ({
                    pesticideId: i.pesticide.id,
                    pesticideName: i.pesticide.name,
                    dosage: i.dosage,
                    quantity: i.quantity // Save quantity
                }))
            };

            await dbService.updatePrescription(updatedPrescription);
            setSavedPrescription(updatedPrescription);
        } else {
            // Create new
            const newPrescription: Prescription = {
                id: crypto.randomUUID(),
                farmerId: selectedFarmer.id,
                date: new Date().toISOString(),
                prescriptionNo: `REC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                engineerName: userProfile.fullName || 'Ziraat Mühendisi',
                items: selectedItems.map(i => ({
                    pesticideId: i.pesticide.id,
                    pesticideName: i.pesticide.name,
                    dosage: i.dosage,
                    quantity: i.quantity // Save quantity
                })),
                isOfficial: true
            };

            await dbService.addPrescription(newPrescription);
            setSavedPrescription(newPrescription);
        }

        setIsSaved(true);
        await loadData();
        await refreshStats();
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

    const filteredPrescriptions = prescriptions.filter(p => {
        const farmer = farmerMap[p.farmerId];
        const search = prescriptionSearchTerm.toLowerCase();
        return (
            p.prescriptionNo.toLowerCase().includes(search) ||
            (farmer?.fullName && farmer.fullName.toLowerCase().includes(search))
        );
    });

    // ... (Render logic remains same, updating the share button text/icon in detail & success views) ...

    if (viewMode === 'LIST') {
        return (
            <div className="relative h-full min-h-[80vh]">
                <div className="p-4 max-w-3xl mx-auto pb-24">
                    <header className="mb-4 flex justify-between items-center sticky top-0 bg-stone-950/80 backdrop-blur z-20 py-2">
                        <div>
                            <h2 className="text-2xl font-bold text-stone-100">Reçete Defteri</h2>
                            <p className="text-sm text-stone-500">Yazılan resmi reçeteler</p>
                        </div>
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

                    <div className="space-y-4">
                        {filteredPrescriptions.length === 0 ? (
                            <div className="text-center py-20 text-stone-600 border-2 border-dashed border-stone-800 rounded-xl">
                                <p>{prescriptionSearchTerm ? 'Aranan kriterlere uygun reçete bulunamadı.' : 'Henüz reçete oluşturulmadı.'}</p>
                                {!prescriptionSearchTerm && <p className="text-sm mt-2 text-stone-500">Sağ alttaki butona basarak yeni reçete yazın.</p>}
                            </div>
                        ) : (
                            filteredPrescriptions.map(p => {
                                const farmer = farmerMap[p.farmerId];
                                const dateObj = new Date(p.date);

                                return (
                                    <div 
                                        key={p.id} 
                                        onClick={() => handleViewDetail(p)}
                                        className="bg-stone-900/80 p-4 rounded-xl shadow-sm border border-white/5 hover:shadow-md transition-all relative overflow-hidden group cursor-pointer active:scale-[0.98]"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center font-bold">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-stone-200">{farmer?.fullName || 'Bilinmeyen Çiftçi'}</h3>
                                                    <p className="text-xs text-stone-500 font-mono">{p.prescriptionNo}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="text-xs font-bold text-stone-400 flex items-center bg-stone-950/50 px-2 py-1 rounded border border-white/5">
                                                    <Calendar size={10} className="mr-1" />
                                                    {dateObj.toLocaleDateString('tr-TR')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="pl-13 mt-2">
                                            <div className="flex flex-wrap gap-1">
                                                {p.items.slice(0, 3).map((item, idx) => (
                                                    <span key={idx} className="text-[10px] bg-stone-800 text-stone-400 px-2 py-1 rounded-full border border-stone-700">
                                                        {item.pesticideName} {item.quantity && `(x${item.quantity})`}
                                                    </span>
                                                ))}
                                                {p.items.length > 3 && (
                                                    <span className="text-[10px] bg-stone-800 text-stone-500 px-2 py-1 rounded-full border border-stone-700">
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
                    onClick={() => { resetForm(); setViewMode('FORM'); }}
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
                    <button onClick={() => { setDetailPrescription(null); setViewMode('LIST'); }} className="text-stone-400 hover:text-stone-200 flex items-center px-2 py-1 rounded-lg hover:bg-stone-900 transition-colors">
                        <ArrowLeft size={20} className="mr-1" /> Listeye Dön
                    </button>
                    <div className="flex space-x-2">
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
                         </div>
                         <div className="text-right">
                             <p className="font-bold text-emerald-700 text-xl">{selectedFarmer?.fullName}</p>
                             <p className="text-xs text-stone-500">{selectedFarmer?.village}</p>
                             <p className="text-[10px] text-stone-400 mt-1">{new Date(detailPrescription.date).toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
                         </div>
                    </div>
                    
                    <div className="min-h-[250px]">
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
                         </div>
                         <div className="text-right">
                             <p className="font-bold text-emerald-700 text-xl">{selectedFarmer?.fullName}</p>
                             <p className="text-xs text-stone-500">{selectedFarmer?.village}</p>
                             <p className="text-[10px] text-stone-400 mt-1">{new Date(savedPrescription.date).toLocaleDateString('tr-TR', { dateStyle: 'long' })}</p>
                         </div>
                    </div>
                    
                    <div className="min-h-[250px]">
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
                    <h2 className="text-2xl font-bold mb-4 text-stone-100">
                        {editingId ? 'Reçete Düzenle: Çiftçi' : 'Çiftçi Seçimi'}
                    </h2>
                    
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

                    <div className="space-y-2">
                        {filteredFarmers.map(f => (
                            <button 
                                key={f.id} 
                                onClick={() => { setSelectedFarmer(f); setStep(2); }}
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
                    {editingId && (
                         <div className="mt-4 flex justify-end">
                              <button onClick={() => setStep(2)} className="px-6 py-3 bg-stone-800 text-stone-300 rounded-xl font-bold flex items-center">
                                  İlaçlara Geç <AlertCircle size={16} className="ml-2"/>
                              </button>
                         </div>
                    )}
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
                        <label className="text-xs font-bold text-stone-500 mb-1 block uppercase tracking-widest">Seçilen İlaçlar ve Dozaj</label>
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
                                     <span className="font-bold text-stone-200">{item.dosage}</span>
                                 </div>
                             ))}
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

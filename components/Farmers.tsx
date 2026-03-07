
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ContactService, ContactInfo } from '../services/contact';
import { Farmer, VisitLog, Prescription, ManualDebt } from '../types';
import { COMMON_CROPS } from '../constants';
import { Search, Phone, MessageCircle, MapPin, Wheat, ChevronLeft, ChevronRight, Contact, Loader2, User, Ruler, FileText, Calendar, Navigation, Plus, X, ArrowLeft, Edit2, Trash2, CheckSquare, Square, Check, FlaskConical, Clock, ImageIcon, Sparkles, Upload, AlertCircle, MessageSquare, Share2, Save, Download, FileJson, RefreshCw, Wallet, History, CreditCard, TrendingDown, TrendingUp as TrendingUpIcon, Send, Copy } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface FarmersProps {
  onBack: () => void;
  onNavigateToPrescription: (farmerId: string) => void;
  onEditPrescription: (prescriptionId: string) => void;
  onEditVisit: (visitId: string) => void;
}

interface TempContact {
  id: string;
  fullName: string;
  phoneNumber: string;
  isAlreadyRegistered?: boolean;
}

// --- MODAL COMPONENT (MOVED OUTSIDE) ---
interface FarmerModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'ADD' | 'EDIT';
    isSaving: boolean;
    data: {
        id: string;
        fullName: string;
        phoneNumber: string;
        village: string;
        fields: { id: string; name: string; size: string; crop: string; plantingDate?: string; currentStage?: string; }[];
    };
    setData: (data: any) => void;
    onSave: (e: React.FormEvent) => void;
}

const FarmerModal: React.FC<FarmerModalProps> = ({ isOpen, onClose, mode, isSaving, data, setData, onSave }) => {
    if (!isOpen) return null;

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val.length < 4) setData({ ...data, phoneNumber: '+90 ' });
        else if (!val.startsWith('+90')) setData({ ...data, phoneNumber: '+90 ' + val.replace(/^\+90\s*/, '') });
        else setData({ ...data, phoneNumber: val });
    };

    const addField = () => {
        setData({
            ...data,
            fields: [...(data.fields || []), { id: crypto.randomUUID() as string, name: '', size: '', crop: '' }]
        });
    };

    const removeField = (id: string) => {
        if (!data.fields || data.fields.length <= 1) return;
        setData({
            ...data,
            fields: data.fields.filter(f => f.id !== id)
        });
    };

    const updateField = (id: string, field: string, value: string) => {
        setData({
            ...data,
            fields: (data.fields || []).map(f => f.id === id ? { ...f, [field]: value } : f)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-stone-900 rounded-3xl w-full max-w-md p-5 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 z-10"><X size={16} /></button>
            <div className="text-center mb-4 shrink-0"><h2 className="text-base font-bold text-stone-100">{mode === 'ADD' ? 'Yeni Çiftçi Ekle' : 'Çiftçiyi Düzenle'}</h2></div>
            
            <form onSubmit={onSave} className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
              <div className="space-y-2.5">
                <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Ad Soyad</label><input required type="text" value={data.fullName} onChange={e => setData({...data, fullName: e.target.value})} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" placeholder="İsim" /></div>
                <div className="grid grid-cols-2 gap-2.5">
                    <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Telefon</label><input required type="tel" value={data.phoneNumber} onChange={handlePhoneChange} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" /></div>
                    <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Köy</label><input required type="text" value={data.village} onChange={e => setData({...data, village: e.target.value})} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" /></div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Tarlalar / Araziler</label>
                    <button type="button" onClick={addField} className="flex items-center gap-1 text-[9px] font-bold bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-900/50 transition-all">
                        <Plus size={12} /> Tarla Ekle
                    </button>
                </div>

                <div className="space-y-3">
                    {(data.fields || []).map((field, idx) => (
                        <div key={field.id} className="p-3 bg-stone-950/50 border border-stone-800 rounded-2xl relative animate-in slide-in-from-top-2 duration-200">
                            {data.fields && data.fields.length > 1 && (
                                <button type="button" onClick={() => removeField(field.id)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-900/80 text-white rounded-full flex items-center justify-center border border-red-500/30 shadow-lg active:scale-90 transition-all">
                                    <X size={10} />
                                </button>
                            )}
                            <div className="grid grid-cols-12 gap-2">
                                <div className="col-span-12">
                                    <input 
                                        type="text" 
                                        placeholder="Tarla Adı (Örn: Ev Arkası)" 
                                        value={field.name} 
                                        onChange={e => updateField(field.id, 'name', e.target.value)}
                                        className="w-full bg-transparent border-b border-stone-800 py-1 text-[11px] text-stone-200 outline-none focus:border-emerald-500/50"
                                    />
                                </div>
                                <div className="col-span-5">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Alan (da)</label>
                                    <input 
                                        required
                                        type="number" 
                                        value={field.size} 
                                        onChange={e => updateField(field.id, 'size', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                    />
                                </div>
                                <div className="col-span-7">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Ürün</label>
                                    <input 
                                        required
                                        type="text" 
                                        list="crop-options"
                                        value={field.crop} 
                                        onChange={e => updateField(field.id, 'crop', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                        placeholder="Ürün Seçin veya Yazın"
                                    />
                                    <datalist id="crop-options">
                                        {COMMON_CROPS.map(crop => (
                                            <option key={crop} value={crop} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="col-span-6">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Ekim Tarihi</label>
                                    <input 
                                        type="date" 
                                        value={field.plantingDate || ''} 
                                        onChange={e => updateField(field.id, 'plantingDate', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                    />
                                </div>
                                <div className="col-span-6">
                                    <label className="text-[8px] font-bold text-stone-600 uppercase ml-1">Mevcut Evre</label>
                                    <input 
                                        type="text" 
                                        value={field.currentStage || ''} 
                                        onChange={e => updateField(field.id, 'currentStage', e.target.value)}
                                        className="w-full p-2 bg-stone-900 border border-stone-800 rounded-lg outline-none font-medium text-white text-[11px]" 
                                        placeholder="Örn: Çimlenme"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
              </div>

              <div className="pt-2 shrink-0">
                <button disabled={isSaving} type="submit" className="w-full bg-emerald-700 text-white py-3.5 rounded-2xl font-bold text-xs shadow-xl shadow-emerald-900/20 flex justify-center items-center active:scale-95 transition-all border border-emerald-500/20">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : 'Çiftçiyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
    );
};

export const Farmers: React.FC<FarmersProps> = ({ onBack, onNavigateToPrescription, onEditPrescription, onEditVisit }) => {
  const { currentUser } = useAuth();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  // Sub-navigation sync
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const state = e.state;
      if (state?.view === 'FARMERS') {
        if (state.farmerId) {
          const target = farmers.find(f => f.id === state.farmerId);
          if (target) setSelectedFarmer(target);
        } else {
          setSelectedFarmer(null);
        }
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [farmers]);

  const changeFarmerSelection = (farmer: Farmer | null) => {
    if (farmer === selectedFarmer) return;

    if (!farmer) {
      if (window.history.state?.farmerId) {
        window.history.back();
      } else {
        setSelectedFarmer(null);
      }
    } else {
      window.history.pushState({ ...window.history.state, farmerId: farmer.id }, '');
      setSelectedFarmer(farmer);
    }
  };
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Specific Data for Selected Farmer
  const [farmerVisits, setFarmerVisits] = useState<VisitLog[]>([]);
  const [farmerPrescriptions, setFarmerPrescriptions] = useState<Prescription[]>([]);
  const [farmerManualDebts, setFarmerManualDebts] = useState<ManualDebt[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Prescription Detail & Sharing
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Visit Editing State
  // Contact Selection States
  const [importPreviewList, setImportPreviewList] = useState<TempContact[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Add/Edit Farmer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [isSavingFarmer, setIsSavingFarmer] = useState(false);
  const [editFarmerData, setEditFarmerData] = useState({
      id: '',
      fullName: '',
      phoneNumber: '+90 ',
      village: '',
      fields: [{ id: crypto.randomUUID() as string, name: '', size: '', crop: '', plantingDate: '', currentStage: '' }]
  });
  
  // Detail View Tab State
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VISITS' | 'PRESCRIPTIONS' | 'DEBT'>('GENERAL');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Manual Debt Modal State
  const [isManualDebtModalOpen, setIsManualDebtModalOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [isSavingDebt, setIsSavingDebt] = useState(false);

  // Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isViewingReport, setIsViewingReport] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Bulk Message Modal State
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkTargetVillage, setBulkTargetVillage] = useState('ALL');
  const [selectedBulkFarmerIds, setSelectedBulkFarmerIds] = useState<Set<string>>(new Set());

  const loadFarmers = async () => {
      const list = await dbService.getFarmers();
      setFarmers(list);
  };

  useEffect(() => {
    loadFarmers();
  }, []);

  // Fetch farmer specific data when selected
  useEffect(() => {
    if (selectedFarmer) {
        loadFarmerDetails();
    }
  }, [selectedFarmer]);

  const loadFarmerDetails = async () => {
      if (!selectedFarmer) return;
      setIsDataLoading(true);
      const [visits, prescriptions, debts] = await Promise.all([
          dbService.getVisitsByFarmer(selectedFarmer.id),
          dbService.getPrescriptionsByFarmer(selectedFarmer.id),
          dbService.getManualDebtsByFarmer(selectedFarmer.id)
      ]);
      
      // Sort by date descending (newest first)
      setFarmerVisits(visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setFarmerPrescriptions(prescriptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setFarmerManualDebts(debts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setIsDataLoading(false);
  };

  // --- VISIT ACTIONS ---
  const handleDeleteVisit = async (visitId: string) => {
      if (window.confirm("Bu ziyaret kaydını silmek istediğinize emin misiniz?")) {
          await deleteVisit(visitId);
          showToast('Ziyaret kaydı silindi', 'success');
          hapticFeedback('medium');
          await loadFarmerDetails(); // Listeyi yenile
      }
  };

  const handleWhatsAppText = () => {
      if (!selectedPrescription || !selectedFarmer) return;
      
      let text = `*ZİRAİ REÇETE*\n`;
      text += `Sayın *${selectedFarmer.fullName}*,\n\n`;
      text += `Tarih: ${new Date(selectedPrescription.date).toLocaleDateString('tr-TR')}\n`;
      text += `Reçete No: ${selectedPrescription.prescriptionNo}\n\n`;
      text += `*Kullanılacak İlaçlar:*\n`;
      
      selectedPrescription.items.forEach(item => {
          text += `- ${item.pesticideName}: *${item.dosage}*`;
          if (item.quantity) text += ` (${item.quantity} Adet)`;
          text += `\n`;
      });
      
      text += `\nGeçmiş olsun.\n${selectedPrescription.engineerName}`;
      
      const url = `https://wa.me/${selectedFarmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const handlePdfAction = async (action: 'SHARE' | 'DOWNLOAD') => {
    if (!receiptRef.current || !selectedPrescription || !selectedFarmer) return;
    setIsProcessingPdf(true);

    try {
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
        
        // Türkçe karakterleri temizle
        const safeName = selectedFarmer.fullName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `Recete_${safeName}.pdf`;

        if (action === 'DOWNLOAD') {
            pdf.save(fileName);
        } else {
            const pdfBlob = pdf.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const shareData = {
                files: [file],
                title: 'Zirai Reçete'
                // text alanı Android'de dosya paylaşımını bozabiliyor, bu yüzden boş bırakıyoruz.
            };

            try {
                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                } else {
                    throw new Error("Paylaşım desteklenmiyor");
                }
            } catch (shareError) {
                console.warn("Share failed, trying fallback.", shareError);
                // Fallback olarak indirmeyi dene
                pdf.save(fileName);
            }
        }

    } catch (error) {
        console.error("PDF Action Error:", error);
        alert("PDF oluşturulurken hata oluştu.");
    } finally {
        setIsProcessingPdf(false);
    }
  };

  // ... (Import functions are same, condensed for brevity) ...
  const processImportedContacts = (contacts: ContactInfo[]) => {
    if (contacts.length > 0) {
        const existingNumbers = new Set(farmers.map(f => f.phoneNumber.replace(/\s/g, '')));
        const tempContacts: TempContact[] = contacts.map(c => {
            const formatted = ContactService.formatPhoneNumber(c.phoneNumber);
            return { id: crypto.randomUUID(), fullName: c.fullName, phoneNumber: formatted, isAlreadyRegistered: existingNumbers.has(formatted.replace(/\s/g, '')) };
        });
        setImportPreviewList(tempContacts);
        setSelectedImportIds(new Set(tempContacts.filter(c => !c.isAlreadyRegistered).map(c => c.id)));
        setIsImportModalOpen(true);
    } else {
        alert("Kişi bulunamadı.");
    }
  };

  const handleContactImport = async () => {
    if (ContactService.isSupported()) {
        try {
            setIsImporting(true);
            const contacts = await ContactService.getContactsNative();
            processImportedContacts(contacts);
        } catch (e) {
            fileInputRef.current?.click();
        } finally { setIsImporting(false); }
    } else { fileInputRef.current?.click(); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
          const contacts = await ContactService.parseVCF(file);
          processImportedContacts(contacts);
      } catch (err) { alert("Dosya hatası."); } 
      finally { setIsImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const confirmBulkImport = async () => {
      const toAdd = importPreviewList.filter(c => selectedImportIds.has(c.id)).map(c => ({ 
          fullName: c.fullName, 
          phoneNumber: c.phoneNumber, 
          village: 'Rehberden Aktarıldı', 
          fields: [{ id: crypto.randomUUID(), name: 'Genel', size: 0, crop: 'Belirtilmedi' }] 
      }));
      if (toAdd.length > 0) {
          setIsImporting(true);
          await bulkAddFarmers(toAdd);
          await loadFarmers();
          setIsImportModalOpen(false);
          setImportPreviewList([]);
          alert(`${toAdd.length} çiftçi eklendi.`);
      }
      setIsImporting(false);
  };

  const toggleSelectImport = (contact: TempContact) => {
      if (contact.isAlreadyRegistered) return;
      const newSelected = new Set(selectedImportIds);
      if (newSelected.has(contact.id)) newSelected.delete(contact.id); else newSelected.add(contact.id);
      setSelectedImportIds(newSelected);
  };

  const handleSaveFarmer = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingFarmer(true);
      try {
          const farmerData = { 
              fullName: editFarmerData.fullName, 
              phoneNumber: editFarmerData.phoneNumber, 
              village: editFarmerData.village, 
              fields: (editFarmerData.fields || []).map(f => ({
                  ...f,
                  size: Number(f.size) || 0,
                  plantingDate: f.plantingDate || undefined,
                  currentStage: f.currentStage || undefined
              }))
          };
          
          if (modalMode === 'ADD') {
              await addFarmer(farmerData);
          } else { 
              const updated = { id: editFarmerData.id, ...farmerData }; 
              await updateFarmer(updated); 
              setSelectedFarmer(updated); 
          }
          
          await loadFarmers();
          resetModal();
      } catch (error) {
          console.error("Save Error", error);
      } finally {
          setIsSavingFarmer(false);
      }
  };

  const resetModal = () => {
      setIsModalOpen(false); setModalMode('ADD');
      setEditFarmerData({ 
          id: '', 
          fullName: '', 
          phoneNumber: '+90 ', 
          village: '', 
          fields: [{ id: crypto.randomUUID() as string, name: '', size: '', crop: '', plantingDate: '', currentStage: '' }] 
      });
  };

  const openEditModal = () => {
      if (!selectedFarmer) return;
      setEditFarmerData({ 
          id: selectedFarmer.id, 
          fullName: selectedFarmer.fullName, 
          phoneNumber: selectedFarmer.phoneNumber, 
          village: selectedFarmer.village, 
          fields: (selectedFarmer.fields || []).map(f => ({ 
              ...f, 
              size: f.size.toString(),
              plantingDate: f.plantingDate || '',
              currentStage: f.currentStage || ''
          }))
      });
      setModalMode('EDIT'); setIsModalOpen(true);
  };

  const { addPayment, deletePayment: removePayment, addManualDebt, deleteManualDebt, payments, bulkAddFarmers, addFarmer, updateFarmer, deleteFarmer, userProfile, updateUserProfile, updateVisit, deleteVisit, showToast, hapticFeedback } = useAppViewModel();

  const handleSavePayment = async () => {
      if (!selectedFarmer || !paymentAmount) return;
      setIsSavingPayment(true);
      try {
          await addPayment({
              farmerId: selectedFarmer.id,
              amount: Number(paymentAmount),
              date: new Date().toISOString(),
              method: 'CASH',
              note: paymentNote
          });
          showToast('Ödeme kaydedildi', 'success');
          hapticFeedback('success');
          setIsPaymentModalOpen(false);
          setPaymentAmount('');
          setPaymentNote('');
          await loadFarmerDetails();
      } catch (e) {
          showToast('Ödeme kaydedilemedi', 'error');
      } finally {
          setIsSavingPayment(false);
      }
  };

  const handleSaveManualDebt = async () => {
      if (!selectedFarmer || !debtAmount) return;
      setIsSavingDebt(true);
      try {
          await addManualDebt({
              farmerId: selectedFarmer.id,
              amount: Number(debtAmount),
              date: new Date().toISOString(),
              note: debtNote
          });
          showToast('Borç kaydedildi', 'success');
          hapticFeedback('success');
          setIsManualDebtModalOpen(false);
          setDebtAmount('');
          setDebtNote('');
          await loadFarmerDetails();
      } catch (e) {
          showToast('Borç kaydedilemedi', 'error');
      } finally {
          setIsSavingDebt(false);
      }
  };

  const handleDeleteManualDebt = async (id: string) => {
      if (window.confirm("Bu borç kaydını silmek istediğinize emin misiniz?")) {
          await deleteManualDebt(id);
          showToast('Borç kaydı silindi', 'success');
          hapticFeedback('medium');
          await loadFarmerDetails();
      }
  };

  const handleReportWhatsAppText = () => {
      if (!selectedFarmer) return;
      
      let text = `*CARİ HESAP EKSTRESİ*\n`;
      text += `Sayın *${selectedFarmer.fullName}*,\n\n`;
      text += `Dönem: ${reportStartDate ? new Date(reportStartDate).toLocaleDateString('tr-TR') : 'Başlangıç'} - ${reportEndDate ? new Date(reportEndDate).toLocaleDateString('tr-TR') : 'Güncel'}\n\n`;
      
      const filteredItems = [
          ...farmerPrescriptions.map(p => ({ ...p, type: 'DEBT', label: 'Reçete Satışı' })),
          ...farmerPayments.map(p => ({ ...p, type: 'PAYMENT', label: 'Tahsilat' })),
          ...farmerManualDebts.map(d => ({ ...d, type: 'DEBT', label: 'Manuel Borç' }))
      ]
      .filter(item => {
          const itemDate = new Date(item.date);
          if (reportStartDate && itemDate < new Date(reportStartDate)) return false;
          if (reportEndDate && itemDate > new Date(reportEndDate)) return false;
          return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      filteredItems.forEach(item => {
          const date = new Date(item.date).toLocaleDateString('tr-TR');
          const amount = (item as any).amount || (item as any).totalAmount;
          text += `${date} | ${item.label}: *${item.type === 'DEBT' ? '-' : '+'}${amount.toLocaleString('tr-TR')} ₺*\n`;
      });

      text += `\n*TOPLAM DURUM:*\n`;
      text += `Toplam Alış: *${totalDebt.toLocaleString('tr-TR')} ₺*\n`;
      text += `Toplam Ödeme: *${totalPaid.toLocaleString('tr-TR')} ₺*\n`;
      text += `*KALAN BAKİYE: ${Math.abs(balance).toLocaleString('tr-TR')} ₺ ${balance >= 0 ? 'ALACAK' : 'BORÇ'}*\n`;
      
      const url = `https://wa.me/${selectedFarmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const handleReportPdfAction = async (action: 'SHARE' | 'DOWNLOAD') => {
      if (!selectedFarmer || !reportRef.current) return;
      setIsGeneratingReport(true);
      try {
          const canvas = await html2canvas(reportRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false,
              allowTaint: true
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
          
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth * ratio, imgHeight * ratio);
          
          const safeName = selectedFarmer.fullName.replace(/[^a-zA-Z0-9]/g, '_');
          const fileName = `${safeName}_Cari_Rapor.pdf`;

          if (action === 'DOWNLOAD') {
              pdf.save(fileName);
              showToast('Rapor indirildi', 'success');
          } else {
              const pdfBlob = pdf.output('blob');
              const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
              const shareData = {
                  files: [file],
                  title: 'Cari Hesap Raporu'
              };

              try {
                  if (navigator.canShare && navigator.canShare(shareData)) {
                      await navigator.share(shareData);
                  } else {
                      throw new Error("Paylaşım desteklenmiyor");
                  }
              } catch (shareError) {
                  console.warn("Share failed, trying fallback.", shareError);
                  pdf.save(fileName);
              }
          }
      } catch (e) {
          showToast('Rapor işlemi başarısız', 'error');
      } finally {
          setIsGeneratingReport(false);
      }
  };

  const getDueDate = (item: any) => {
      if (item.type === 'PAYMENT') return null;
      if (!selectedFarmer) return null;
      
      let crop = '';
      if (item.fieldId) {
          const field = selectedFarmer.fields.find(f => f.id === item.fieldId);
          if (field) crop = field.crop;
      } else if (item.note) {
          crop = item.note; // Manual debt might have crop in note
      }
      
      const d = new Date(item.date);
      const year = d.getFullYear();
      const cropLower = crop.toLowerCase();
      
      if (cropLower.includes('buğday') || cropLower.includes('arpa')) {
          return `30 Haz ${d.getMonth() > 5 ? year + 1 : year}`;
      }
      if (cropLower.includes('pamuk') || cropLower.includes('mısır')) {
          return `30 Kas ${d.getMonth() > 10 ? year + 1 : year}`;
      }
      return null;
  };

  const handleDeletePayment = async (id: string) => {
      if (window.confirm("Bu ödeme kaydını silmek istediğinize emin misiniz?")) {
          await removePayment(id);
          showToast('Ödeme kaydı silindi', 'success');
      }
  };

  const farmerPayments = payments.filter(p => p.farmerId === selectedFarmer?.id);
  const totalPaid = farmerPayments.reduce((acc, p) => acc + p.amount, 0);
  const totalDebt = farmerPrescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0) + farmerManualDebts.reduce((acc, d) => acc + d.amount, 0);
  const balance = totalPaid - totalDebt;

  const handleDeleteFarmer = async () => {
      if (!selectedFarmer) return;
      if (window.confirm("Bu çiftçiyi ve tüm kayıtlarını silmek istediğinize emin misiniz?")) {
          await deleteFarmer(selectedFarmer.id); 
          showToast('Çiftçi kaydı silindi', 'success');
          hapticFeedback('medium');
          changeFarmerSelection(null); 
          await loadFarmers();
      }
  };

  const filteredFarmers = farmers.filter(f => f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || f.village.toLowerCase().includes(searchTerm.toLowerCase()));

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

  const villages = useMemo(() => {
    const v = new Set(farmers.map(f => f.village));
    return Array.from(v).sort();
  }, [farmers]);

  const bulkTargetFarmers = useMemo(() => {
    return farmers.filter(f => bulkTargetVillage === 'ALL' || f.village === bulkTargetVillage);
  }, [farmers, bulkTargetVillage]);

  const handleSendBulkWhatsApp = (farmer: Farmer) => {
    const text = bulkMessage;
    const url = `https://wa.me/${farmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // --- DETAIL VIEW ---
  if (selectedFarmer) {
     if (selectedPrescription) {
         return (
            <div className="pb-24 animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-3 border-b border-white/5">
                    <button onClick={() => setSelectedPrescription(null)} className="flex items-center text-stone-400 hover:text-stone-200 font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-xs">
                        <ChevronLeft className="mr-1" size={18}/> Reçeteye Dön
                    </button>
                    <button 
                        onClick={() => onEditPrescription(selectedPrescription.id)}
                        className="flex items-center px-3 py-1.5 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-700 transition-all active:scale-95"
                    >
                        <Edit2 size={14} className="mr-1.5" />
                        <span className="text-[10px] font-black uppercase tracking-wide">Düzenle</span>
                    </button>
                </div>
                <div ref={receiptRef} className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm mx-auto relative overflow-hidden text-stone-900 mb-6 border border-stone-300 mt-2">
                    <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600"></div>
                    <div className="flex justify-between items-start mb-6 pt-2">
                        <div><h3 className="font-black text-lg text-stone-900 tracking-tight">ZİRAİ REÇETE</h3><p className="text-[9px] text-stone-500 font-bold uppercase tracking-widest mt-1">No: {selectedPrescription.prescriptionNo}</p></div>
                        <div className="text-right"><p className="font-bold text-emerald-700 text-sm">{selectedFarmer.fullName}</p><p className="text-[9px] text-stone-500">{new Date(selectedPrescription.date).toLocaleDateString('tr-TR')}</p></div>
                    </div>
                    <div className="border-t border-b border-stone-100 py-4 my-4"><table className="w-full text-xs"><thead className="text-stone-400 uppercase font-black text-[8px] tracking-wider text-left"><tr><th className="pb-2">Ürün</th><th className="pb-2 text-right">Dozaj</th></tr></thead><tbody className="divide-y divide-stone-100">{selectedPrescription.items.map((item, idx) => (<tr key={idx}><td className="py-2 font-bold text-stone-800">{item.pesticideName} {item.quantity && <span className="text-stone-500 text-[10px]">({item.quantity} Ad.)</span>}</td><td className="py-2 text-right font-mono font-bold text-emerald-600">{item.dosage}</td></tr>))}</tbody></table></div>
                    <div className="flex justify-between items-end mt-6"><div className="text-[8px] text-stone-400 leading-tight">MKS Dijital Onaylı<br/>Güvenli Belge</div><div className="text-center"><div className="font-serif italic text-xs text-blue-900 font-bold">{selectedPrescription.engineerName}</div><div className="w-20 h-px bg-stone-300 mt-1"></div><div className="text-[8px] text-stone-400 uppercase tracking-widest mt-0.5">İmza / Kaşe</div></div></div>
                </div>
                
                {/* ACTION BUTTONS */}
                <div className="max-w-sm mx-auto flex gap-2 mt-4">
                    <button 
                        onClick={() => handlePdfAction('SHARE')} 
                        disabled={isProcessingPdf} 
                        className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                    >
                        {isProcessingPdf ? <Loader2 size={16} className="animate-spin mr-2"/> : <Share2 size={16} className="mr-2"/>} 
                        PDF Paylaş
                    </button>
                    
                    <button 
                        onClick={handleWhatsAppText}
                        className="flex-1 py-3 rounded-xl bg-[#25D366] text-white font-bold shadow-xl hover:bg-[#20bd5a] active:scale-95 transition-all flex items-center justify-center text-xs"
                    >
                        <MessageCircle size={16} className="mr-2"/> 
                        WP Özet
                    </button>

                    <button 
                        onClick={() => handlePdfAction('DOWNLOAD')} 
                        disabled={isProcessingPdf} 
                        className="px-4 py-3 rounded-xl bg-stone-800 text-stone-200 font-bold border border-white/10 hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                    >
                        {isProcessingPdf ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} 
                    </button>
                </div>
            </div>
         );
     }

     if (isViewingReport) {
         return (
            <div className="pb-24 animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-3 border-b border-white/5">
                    <button onClick={() => setIsViewingReport(false)} className="flex items-center text-stone-400 hover:text-stone-200 font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-xs">
                        <ChevronLeft className="mr-1" size={18}/> Cari Hesaba Dön
                    </button>
                </div>
                
                <div className="overflow-x-auto pb-4">
                    <div ref={reportRef} className="bg-white p-8 rounded-2xl shadow-xl w-[210mm] mx-auto text-stone-900 border border-stone-300 mt-2">
                        <div className="flex justify-between items-start border-b-2 border-stone-900 pb-6 mb-8">
                            <div>
                                <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">Cari Hesap Ekstresi</h1>
                                <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Ziraat Mühendisi Otomasyon Sistemi</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold">{new Date().toLocaleDateString('tr-TR')}</p>
                                <p className="text-[10px] text-stone-500">Rapor No: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-10 mb-10">
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Müşteri Bilgileri</h2>
                                <p className="text-xl font-black mb-1">{selectedFarmer.fullName}</p>
                                <p className="text-sm text-stone-600 mb-1">{selectedFarmer.village}</p>
                                <p className="text-sm font-mono text-stone-500">{selectedFarmer.phoneNumber}</p>
                            </div>
                            <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                                <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Rapor Dönemi</h2>
                                <p className="text-lg font-bold">
                                    {reportStartDate ? new Date(reportStartDate).toLocaleDateString('tr-TR') : 'Başlangıç'} - {reportEndDate ? new Date(reportEndDate).toLocaleDateString('tr-TR') : 'Güncel'}
                                </p>
                            </div>
                        </div>

                        <table className="w-full mb-10">
                            <thead>
                                <tr className="border-b-2 border-stone-900 text-left">
                                    <th className="py-4 text-[10px] font-black uppercase tracking-widest">Tarih</th>
                                    <th className="py-4 text-[10px] font-black uppercase tracking-widest">İşlem</th>
                                    <th className="py-4 text-[10px] font-black uppercase tracking-widest">Açıklama</th>
                                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-right">Borç</th>
                                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-right">Alacak</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ...farmerPrescriptions.map(p => ({ ...p, type: 'DEBT', label: 'Reçete Satışı' })),
                                    ...farmerPayments.map(p => ({ ...p, type: 'PAYMENT', label: 'Tahsilat' })),
                                    ...farmerManualDebts.map(d => ({ ...d, type: 'DEBT', label: 'Manuel Borç' }))
                                ]
                                .filter(item => {
                                    const itemDate = new Date(item.date);
                                    if (reportStartDate && itemDate < new Date(reportStartDate)) return false;
                                    if (reportEndDate && itemDate > new Date(reportEndDate)) return false;
                                    return true;
                                })
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                .map((item, idx) => (
                                    <tr key={idx} className="border-b border-stone-100">
                                        <td className="py-4 text-sm">{new Date(item.date).toLocaleDateString('tr-TR')}</td>
                                        <td className="py-4 text-sm font-bold">{item.label}</td>
                                        <td className="py-4 text-sm text-stone-500">{(item as any).note || '-'}</td>
                                        <td className="py-4 text-sm text-right font-bold text-rose-600">{item.type === 'DEBT' ? `${((item as any).amount || (item as any).totalAmount).toLocaleString('tr-TR')} ₺` : '-'}</td>
                                        <td className="py-4 text-sm text-right font-bold text-emerald-600">{item.type === 'PAYMENT' ? `${(item as any).amount.toLocaleString('tr-TR')} ₺` : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-end">
                            <div className="w-80 space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-stone-100">
                                    <span className="text-xs font-bold text-stone-500 uppercase">Toplam Alışlar</span>
                                    <span className="text-lg font-bold text-rose-600">{totalDebt.toLocaleString('tr-TR')} ₺</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-stone-100">
                                    <span className="text-xs font-bold text-stone-500 uppercase">Toplam Ödemeler</span>
                                    <span className="text-lg font-bold text-emerald-600">{totalPaid.toLocaleString('tr-TR')} ₺</span>
                                </div>
                                <div className="flex justify-between items-center py-4 bg-stone-900 text-white px-6 rounded-2xl shadow-xl">
                                    <span className="text-sm font-black uppercase tracking-widest">Kalan Bakiye</span>
                                    <span className="text-2xl font-black">{Math.round(Math.abs(balance)).toLocaleString('tr-TR')} ₺ {balance >= 0 ? 'ALACAK' : 'BORÇ'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-20 pt-10 border-t border-stone-100 text-center">
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.2em]">Bu belge dijital olarak oluşturulmuştur.</p>
                        </div>
                    </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="max-w-sm mx-auto flex gap-2 mt-4 px-4">
                    <button 
                        onClick={() => handleReportPdfAction('SHARE')} 
                        disabled={isGeneratingReport} 
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-900/30 hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                    >
                        {isGeneratingReport ? <Loader2 size={16} className="animate-spin mr-2"/> : <Share2 size={16} className="mr-2"/>} 
                        PDF Paylaş
                    </button>
                    
                    <button 
                        onClick={handleReportWhatsAppText}
                        className="flex-1 py-3 rounded-xl bg-[#25D366] text-white font-bold shadow-xl hover:bg-[#20bd5a] active:scale-95 transition-all flex items-center justify-center text-xs"
                    >
                        <MessageCircle size={16} className="mr-2"/> 
                        WP Özet
                    </button>

                    <button 
                        onClick={() => handleReportPdfAction('DOWNLOAD')} 
                        disabled={isGeneratingReport} 
                        className="px-4 py-3 rounded-xl bg-stone-800 text-stone-200 font-bold border border-white/10 hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                    >
                        {isGeneratingReport ? <Loader2 size={16} className="animate-spin"/> : <Download size={16}/>} 
                    </button>
                </div>
            </div>
         );
     }

     return (
        <div className="pb-24 animate-in slide-in-from-right duration-300">
            {/* STABILIZED HEADER: Sticky & Better Buttons */}
            <div className="sticky top-0 z-20 bg-stone-950/90 backdrop-blur-xl border-b border-white/5 py-3 mb-4 -mx-4 px-4 flex justify-between items-center shadow-lg shadow-black/20">
                 <button onClick={() => changeFarmerSelection(null)} className="flex items-center text-stone-400 hover:text-stone-200 font-bold px-3 py-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors text-xs">
                     <ChevronLeft className="mr-1" size={18}/> Geri
                 </button>
                 <div className="flex items-center space-x-2">
                     <button onClick={openEditModal} className="flex items-center px-4 py-2 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-700 transition-all active:scale-95 shadow-md">
                        <Edit2 size={14} className="mr-1.5" />
                        <span className="text-[10px] font-black uppercase tracking-wide">Düzenle</span>
                     </button>
                     <button onClick={handleDeleteFarmer} className="flex items-center justify-center w-9 h-9 bg-stone-800 text-stone-400 rounded-xl border border-white/5 hover:text-red-400 hover:bg-stone-700 transition-all active:scale-95 shadow-md">
                        <Trash2 size={14} />
                     </button>
                 </div>
            </div>

            {/* Compact Profile Card */}
            <div className="bg-stone-900/80 backdrop-blur rounded-3xl p-4 shadow-lg border border-white/5 mb-4 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-emerald-900/10 to-transparent -z-10"></div>
                
                <div className="flex items-center space-x-3 w-full mb-4">
                    <div className="w-12 h-12 bg-stone-800 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-xl font-black text-emerald-500 shadow-lg">
                        {selectedFarmer.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <h2 className="text-base font-black text-stone-100 truncate tracking-tight">{selectedFarmer.fullName}</h2>
                        <div className="flex items-center text-stone-500 text-xs mt-0.5 font-bold">
                            <MapPin size={10} className="mr-1 text-emerald-500/70"/> {selectedFarmer.village}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 w-full">
                    {/* Buttons condensed */}
                    {[
                        { icon: Phone, label: 'Ara', href: `tel:${selectedFarmer.phoneNumber}` },
                        { icon: MessageCircle, label: 'WP', href: `https://wa.me/${selectedFarmer.phoneNumber.replace(/[^0-9]/g, '')}`, target: '_blank' },
                        { icon: MessageSquare, label: 'SMS', href: `sms:${selectedFarmer.phoneNumber}` },
                        { icon: Navigation, label: 'Yol', action: () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedFarmer.village)}`, '_blank') }
                    ].map((btn, i) => (
                        btn.href ? (
                            <a key={i} href={btn.href} target={btn.target} className="flex flex-col items-center justify-center py-2 bg-stone-800/40 rounded-xl hover:bg-stone-800 transition-all border border-white/5 active:scale-95">
                                <btn.icon size={16} className="mb-1 text-stone-400"/>
                                <span className="text-[8px] font-bold text-stone-500 uppercase tracking-tighter">{btn.label}</span>
                            </a>
                        ) : (
                            <button key={i} onClick={btn.action} className="flex flex-col items-center justify-center py-2 bg-stone-800/40 rounded-xl hover:bg-stone-800 transition-all border border-white/5 active:scale-95">
                                <btn.icon size={16} className="mb-1 text-stone-400"/>
                                <span className="text-[8px] font-bold text-stone-500 uppercase tracking-tighter">{btn.label}</span>
                            </button>
                        )
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-stone-900/60 backdrop-blur rounded-xl mb-4 border border-white/5 shadow-inner">
                {(['GENERAL', 'VISITS', 'PRESCRIPTIONS', 'DEBT'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === tab ? 'bg-stone-700 text-white shadow-md' : 'text-stone-500 hover:text-stone-300'}`}>
                        {tab === 'GENERAL' ? 'Genel' : (tab === 'VISITS' ? 'Ziyaret' : (tab === 'PRESCRIPTIONS' ? 'Reçete' : 'Cari'))}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="animate-in fade-in duration-300">
                {activeTab === 'GENERAL' && (
                    <div className="space-y-3">
                        <div className="bg-stone-900/80 backdrop-blur p-4 rounded-2xl border border-white/5 shadow-sm">
                            <h3 className="font-bold text-stone-200 text-xs mb-3 flex items-center uppercase tracking-wider opacity-70"><Wheat size={14} className="mr-1.5 text-amber-500"/> Tarla Bilgileri</h3>
                            <div className="space-y-2">
                                {(selectedFarmer.fields || []).map((field, idx) => (
                                    <div key={field.id} className="p-3 bg-stone-950/50 rounded-xl border border-white/5">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex-1">
                                                <p className="text-[8px] text-stone-500 uppercase font-bold mb-0.5">{field.name || `Tarla ${idx + 1}`}</p>
                                                <p className="text-sm font-bold text-stone-200">{field.crop}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] text-stone-500 uppercase font-bold mb-0.5">Alan</p>
                                                <p className="text-sm font-bold text-emerald-500">{field.size} <span className="text-[10px] font-normal text-stone-400">da</span></p>
                                            </div>
                                        </div>
                                        {(field.plantingDate || field.currentStage) && (
                                            <div className="flex gap-4 pt-2 border-t border-white/5">
                                                {field.plantingDate && (
                                                    <div>
                                                        <p className="text-[7px] text-stone-500 uppercase font-bold">Ekim</p>
                                                        <p className="text-[10px] text-stone-300">{new Date(field.plantingDate).toLocaleDateString('tr-TR')}</p>
                                                    </div>
                                                )}
                                                {field.currentStage && (
                                                    <div>
                                                        <p className="text-[7px] text-stone-500 uppercase font-bold">Evre</p>
                                                        <p className="text-[10px] text-stone-300">{field.currentStage}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-stone-500 uppercase">Toplam Arazi</span>
                                    <span className="text-xs font-black text-stone-200">{(selectedFarmer.fields || []).reduce((acc, f) => acc + f.size, 0)} da</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => onNavigateToPrescription(selectedFarmer.id)} className="flex-1 py-3.5 bg-emerald-700 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center text-xs uppercase tracking-wider">
                                <FileText className="mr-2" size={16}/> Yeni Reçete Yaz
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'DEBT' && (
                    <div className="space-y-3">
                        {/* Balance Card */}
                        <div className="bg-stone-900/80 backdrop-blur p-4 rounded-2xl border border-white/5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-stone-200 text-xs flex items-center uppercase tracking-wider opacity-70"><Wallet size={14} className="mr-1.5 text-emerald-500"/> Cari Durum</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsReportModalOpen(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-900/20 active:scale-95 transition-all flex items-center">
                                        <Download size={12} className="mr-1"/> Raporla
                                    </button>
                                    <button onClick={() => setIsManualDebtModalOpen(true)} className="bg-rose-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-rose-900/20 active:scale-95 transition-all flex items-center">
                                        <Plus size={12} className="mr-1"/> Borç Ekle
                                    </button>
                                    <button onClick={() => setIsPaymentModalOpen(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center">
                                        <CreditCard size={12} className="mr-1"/> Tahsilat Al
                                    </button>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-stone-500 uppercase font-black mb-1">Toplam Borç</p>
                                    <p className="text-lg font-black text-rose-500">{totalDebt.toLocaleString('tr-TR')} ₺</p>
                                </div>
                                <div className="bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-stone-500 uppercase font-black mb-1">Toplam Ödeme</p>
                                    <p className="text-lg font-black text-emerald-500">{totalPaid.toLocaleString('tr-TR')} ₺</p>
                                </div>
                            </div>

                            <div className={`p-4 rounded-xl border flex items-center justify-between ${balance >= 0 ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-rose-900/20 border-rose-500/20'}`}>
                                <div>
                                    <p className="text-[9px] text-stone-400 uppercase font-black mb-0.5">Güncel Bakiye</p>
                                    <p className={`text-xl font-black ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {Math.round(Math.abs(balance)).toLocaleString('tr-TR')} ₺
                                        <span className="text-xs font-bold ml-1">{balance >= 0 ? 'Alacaklı' : 'Borçlu'}</span>
                                    </p>
                                </div>
                                {balance < 0 ? <TrendingDown size={24} className="text-rose-500 opacity-50" /> : <TrendingUpIcon size={24} className="text-emerald-500 opacity-50" />}
                            </div>
                        </div>

                        {/* History */}
                        <div className="bg-stone-900/80 backdrop-blur p-4 rounded-2xl border border-white/5 shadow-sm">
                            <h3 className="font-bold text-stone-200 text-xs mb-3 flex items-center uppercase tracking-wider opacity-70"><History size={14} className="mr-1.5 text-blue-500"/> İşlem Geçmişi</h3>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                {[
                                    ...farmerPrescriptions.map(p => ({ ...p, type: 'DEBT', label: 'Reçete Satışı' })), 
                                    ...farmerPayments.map(p => ({ ...p, type: 'PAYMENT', label: 'Tahsilat' })),
                                    ...farmerManualDebts.map(d => ({ ...d, type: 'DEBT', label: 'Manuel Borç' }))
                                ]
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((item, idx) => {
                                        const dueDate = getDueDate(item);
                                        const isOverdue = dueDate && new Date() > new Date(dueDate.replace('Haz', 'Jun').replace('Kas', 'Nov'));
                                        
                                        return (
                                            <div key={idx} className="p-3 bg-stone-950/50 rounded-xl border border-white/5 flex items-center justify-between group relative">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'DEBT' ? 'bg-rose-900/20 text-rose-500' : 'bg-emerald-900/20 text-emerald-500'}`}>
                                                        {item.type === 'DEBT' ? <FileText size={14} /> : <CreditCard size={14} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-stone-200">{item.label}</p>
                                                        <p className="text-[8px] text-stone-500">{new Date(item.date).toLocaleDateString('tr-TR')}</p>
                                                        {dueDate && (
                                                            <p className={`text-[7px] font-bold mt-0.5 ${isOverdue ? 'text-rose-500 animate-pulse' : 'text-amber-500'}`}>
                                                                Vade: {dueDate}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-3">
                                                    <div>
                                                        <p className={`text-xs font-black ${item.type === 'DEBT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {item.type === 'DEBT' ? '-' : '+'}{(item as any).amount?.toLocaleString('tr-TR') || (item as any).totalAmount?.toLocaleString('tr-TR')} ₺
                                                        </p>
                                                        {(item as any).note && <p className="text-[7px] text-stone-500 italic truncate max-w-[60px]">{(item as any).note}</p>}
                                                    </div>
                                                    {item.type === 'PAYMENT' ? (
                                                        <button onClick={() => handleDeletePayment(item.id)} className="opacity-0 group-hover:opacity-100 p-1 text-stone-500 hover:text-rose-500 transition-all">
                                                            <Trash2 size={12}/>
                                                        </button>
                                                    ) : (
                                                        (item as any).id.startsWith('manual') && (
                                                            <button onClick={() => handleDeleteManualDebt(item.id)} className="opacity-0 group-hover:opacity-100 p-1 text-stone-500 hover:text-rose-500 transition-all">
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'VISITS' && (
                    <div className="space-y-2">
                        {isDataLoading ? <Loader2 size={20} className="animate-spin text-emerald-500 mx-auto"/> : farmerVisits.length > 0 ? farmerVisits.map(visit => (
                            <div key={visit.id} className="bg-stone-900/80 p-3 rounded-xl border border-white/5 hover:bg-stone-900 transition-colors">
                                <div className="flex justify-between items-start mb-1.5">
                                    <span className="text-[9px] font-bold text-stone-400 flex items-center bg-stone-950/50 px-1.5 py-0.5 rounded border border-white/5"><Calendar size={9} className="mr-1 text-emerald-500" />{new Date(visit.date).toLocaleDateString('tr-TR')}</span>
                                    <span className="text-[9px] text-stone-600 flex items-center"><Clock size={9} className="mr-1" />{new Date(visit.date).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-[11px] text-stone-300 italic mb-1.5 leading-relaxed line-clamp-3">"{visit.note}"</p>
                                <div className="flex justify-between items-center pt-1.5 border-t border-white/5">
                                    <div className="flex gap-1.5">{visit.photoUri && <ImageIcon size={12} className="text-blue-400"/>}{visit.aiAnalysis && <Sparkles size={12} className="text-purple-400"/>}</div>
                                    <div className="flex gap-1.5"><button onClick={() => onEditVisit(visit.id)} className="text-stone-500 hover:text-emerald-400"><Edit2 size={12}/></button><button onClick={() => handleDeleteVisit(visit.id)} className="text-stone-500 hover:text-red-400"><Trash2 size={12}/></button></div>
                                </div>
                            </div>
                        )) : <div className="text-center py-6 text-stone-600 text-[10px]">Kayıt yok.</div>}
                    </div>
                )}
                
                {activeTab === 'PRESCRIPTIONS' && (
                    <div className="space-y-2">
                         {isDataLoading ? <Loader2 size={20} className="animate-spin text-amber-500 mx-auto"/> : farmerPrescriptions.length > 0 ? farmerPrescriptions.map(p => (
                            <div key={p.id} onClick={() => setSelectedPrescription(p)} className="bg-stone-900/80 p-3 rounded-xl border border-white/5 hover:bg-stone-800 transition-colors cursor-pointer active:scale-98">
                                <div className="flex justify-between items-start mb-1.5">
                                    <div><span className="text-[8px] font-mono text-stone-500 block uppercase">No: {p.prescriptionNo}</span></div>
                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-800/30">{new Date(p.date).toLocaleDateString('tr-TR')}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">{p.items.map((item, idx) => (<span key={idx} className="text-[8px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded flex items-center"><FlaskConical size={8} className="mr-1 text-stone-500"/>{item.pesticideName}</span>))}</div>
                            </div>
                        )) : <div className="text-center py-6 text-stone-600 text-[10px]">Reçete yok.</div>}
                    </div>
                )}
            </div>

            {/* Modals Code */}
            {/* HERE IS THE FIX: Using the separated FarmerModal component */}
            <FarmerModal 
                isOpen={isModalOpen}
                onClose={resetModal}
                mode={modalMode}
                isSaving={isSavingFarmer}
                data={editFarmerData}
                setData={setEditFarmerData}
                onSave={handleSaveFarmer}
            />
            
            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-stone-900 rounded-3xl w-full max-w-md p-5 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200">
                        <button onClick={() => setIsPaymentModalOpen(false)} className="absolute top-3 right-3 p-1.5 bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 z-10"><X size={16} /></button>
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-emerald-900/30 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Wallet size={24} />
                            </div>
                            <h2 className="text-base font-bold text-stone-100">Tahsilat Kaydı</h2>
                            <p className="text-[10px] text-stone-500 mt-1">{selectedFarmer.fullName}</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Ödeme Tutarı (₺)</label>
                                <input 
                                    type="number" 
                                    value={paymentAmount} 
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    className="w-full p-3.5 bg-stone-950 border border-stone-800 rounded-2xl outline-none font-black text-emerald-500 text-xl focus:border-emerald-500/50 transition-all text-center" 
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Not (Opsiyonel)</label>
                                <textarea 
                                    value={paymentNote} 
                                    onChange={e => setPaymentNote(e.target.value)}
                                    className="w-full p-3 bg-stone-950 border border-stone-800 rounded-xl outline-none text-stone-200 text-xs focus:border-emerald-500/50 transition-all h-20 resize-none" 
                                    placeholder="Ödeme açıklaması..."
                                />
                            </div>
                            <button 
                                onClick={handleSavePayment}
                                disabled={isSavingPayment || !paymentAmount}
                                className="w-full bg-emerald-700 text-white py-3.5 rounded-2xl font-bold text-xs shadow-xl shadow-emerald-900/20 flex justify-center items-center active:scale-95 transition-all border border-emerald-500/20 disabled:opacity-50"
                            >
                                {isSavingPayment ? <Loader2 size={18} className="animate-spin" /> : 'Tahsilatı Onayla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Manual Debt Modal */}
            {isManualDebtModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-stone-900 rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                            <h2 className="text-sm font-bold text-stone-100 flex items-center"><Plus className="mr-2 text-rose-500" size={16}/> Borç Ekle</h2>
                            <button onClick={() => setIsManualDebtModalOpen(false)} className="text-stone-500 hover:text-stone-300"><X size={18}/></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Tutar (₺)</label>
                                <input type="number" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Açıklama / Ürün</label>
                                <textarea value={debtNote} onChange={(e) => setDebtNote(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all h-24 resize-none" placeholder="Örn: Geçmiş borç, Gübre borcu vb." />
                            </div>
                            <button disabled={isSavingDebt || !debtAmount} onClick={handleSaveManualDebt} className="w-full bg-rose-700 text-white py-3.5 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50 flex items-center justify-center">
                                {isSavingDebt ? <Loader2 className="animate-spin mr-2" size={16}/> : <Save className="mr-2" size={16}/>} Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {isReportModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-stone-900 rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                            <h2 className="text-sm font-bold text-stone-100 flex items-center"><Download className="mr-2 text-blue-500" size={16}/> Cari Rapor Oluştur</h2>
                            <button onClick={() => setIsReportModalOpen(false)} className="text-stone-500 hover:text-stone-300"><X size={18}/></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Başlangıç</label>
                                    <input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Bitiş</label>
                                    <input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500" />
                                </div>
                            </div>
                            <p className="text-[9px] text-stone-500 italic">Tarih seçmezseniz tüm zamanların raporu oluşturulur.</p>
                            <button onClick={() => { setIsViewingReport(true); setIsReportModalOpen(false); }} className="w-full bg-blue-700 text-white py-3.5 rounded-xl font-bold text-xs shadow-lg flex items-center justify-center">
                                <FileText className="mr-2" size={16}/> Raporu Görüntüle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPrescription && !isProcessingPdf && (
                <div className="hidden"></div>
            )}
        </div>
    );
}

  // --- LIST VIEW ---
  return (
    <div className="pb-24 relative min-h-[80vh]">
      <input type="file" accept=".vcf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      <div className="flex items-center justify-between mb-3 mt-2 px-1">
          <button onClick={onBack} className="flex items-center text-stone-400 hover:text-stone-200 font-medium py-1 rounded-lg transition-colors text-xs"><ArrowLeft size={16} className="mr-1"/> Geri</button>
          <div className="text-right">
              <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block">{farmers.length} Çiftçi</span>
              {userProfile.lastSyncTime && (
                  <span className="text-[8px] text-emerald-500/80 flex items-center justify-end mt-0.5">
                      <Check size={8} className="mr-0.5" />
                      Son Yedek: {new Date(userProfile.lastSyncTime).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                  </span>
              )}
          </div>
      </div>

      <div className="sticky top-0 z-10 bg-stone-950/80 backdrop-blur-md pb-2 pt-0">
         <div className="bg-stone-900 rounded-xl shadow-sm border border-white/5 flex items-center p-0.5">
             <Search className="text-stone-500 ml-2" size={14} />
             <input type="text" placeholder="Çiftçi adı veya köy ara..." className="w-full p-2 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-[11px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             <button onClick={handleSync} disabled={isSyncing} className={`px-2 py-1.5 rounded-lg transition-all m-0.5 flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider ${isSyncing ? 'bg-emerald-900/30 text-emerald-500' : 'bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-emerald-400'}`}>
                 {isSyncing ? <Loader2 size={10} className="animate-spin"/> : <RefreshCw size={10}/>}
                 {isSyncing ? '...' : 'Senk'}
             </button>
             <button 
                onClick={() => setIsBulkMessageModalOpen(true)}
                className="p-1.5 bg-stone-800 hover:bg-stone-700 text-blue-400 rounded-lg transition-all m-0.5 flex items-center justify-center"
             >
                 <MessageSquare size={14}/>
             </button>
             <button onClick={handleContactImport} disabled={isImporting} className={`p-1.5 rounded-lg transition-all m-0.5 flex items-center justify-center ${isImporting ? 'bg-emerald-900/30 text-emerald-500' : 'bg-stone-800 hover:bg-stone-700 text-emerald-500'}`}>{isImporting ? <Loader2 size={14} className="animate-spin"/> : <Contact size={14}/>}</button>
         </div>
      </div>

      <div className="space-y-1">
        {filteredFarmers.map(farmer => (
            <div key={farmer.id} onClick={() => changeFarmerSelection(farmer)} className="bg-stone-900/80 backdrop-blur rounded-xl p-2 shadow-sm border border-white/5 flex items-center justify-between hover:bg-stone-800/80 transition-all cursor-pointer group active:scale-[0.98]">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-stone-800 text-stone-500 flex items-center justify-center font-bold text-xs group-hover:bg-emerald-900/30 group-hover:text-emerald-400 transition-colors border border-white/5 shadow-inner">{farmer.fullName.charAt(0)}</div>
                    <div>
                        <h3 className="font-bold text-stone-200 text-xs tracking-tight">{farmer.fullName}</h3>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                             <span className="text-[8px] text-stone-500 flex items-center bg-stone-950/50 px-1 py-0.5 rounded border border-white/5 font-medium"><MapPin size={7} className="mr-1 text-emerald-500/70"/> {farmer.village}</span>
                             {farmer.fields && farmer.fields.length > 0 && (
                                <span className="text-[8px] text-amber-500/80 bg-amber-900/10 px-1 py-0.5 rounded border border-amber-800/20 font-bold">
                                    {farmer.fields.length} Tarla
                                </span>
                             )}
                        </div>
                    </div>
                </div>
                <div className="bg-stone-800/50 p-1 rounded-lg text-stone-600 group-hover:text-emerald-400 transition-colors"><ChevronRight size={12} /></div>
            </div>
        ))}
        {filteredFarmers.length === 0 && <div className="text-center py-10"><User size={28} className="mx-auto mb-2 text-stone-700"/><p className="text-stone-500 text-[10px]">Kayıt yok.</p></div>}
      </div>

      <button onClick={() => { setModalMode('ADD'); setIsModalOpen(true); }} className="fixed bottom-32 right-5 bg-emerald-600 text-white p-3 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center"><Plus size={22} /></button>

      {/* Bulk Message Modal */}
      {isBulkMessageModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-stone-900 rounded-3xl w-full max-w-md flex flex-col max-h-[90vh] shadow-2xl border border-white/10">
                  <div className="p-4 border-b border-white/5 shrink-0 flex justify-between items-center">
                      <h2 className="text-base font-bold text-stone-100 flex items-center gap-2">
                          <MessageSquare className="text-blue-500" size={18}/> 
                          Toplu Mesaj Gönder
                      </h2>
                      <button onClick={() => setIsBulkMessageModalOpen(false)} className="text-stone-500 hover:text-stone-300">
                          <X size={18}/>
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                      <div>
                          <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Hedef Grup (Köy)</label>
                          <select 
                            value={bulkTargetVillage}
                            onChange={(e) => setBulkTargetVillage(e.target.value)}
                            className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2.5 text-stone-200 text-xs outline-none focus:border-blue-500"
                          >
                              <option value="ALL">Tüm Çiftçiler ({farmers.length})</option>
                              {villages.map((v: string) => (
                                  <option key={v} value={v}>{v} ({farmers.filter((f: Farmer) => f.village === v).length})</option>
                              ))}
                          </select>
                      </div>

                      <div>
                          <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Mesaj İçeriği</label>
                          <textarea 
                            value={bulkMessage}
                            onChange={(e) => setBulkMessage(e.target.value)}
                            placeholder="Örn: Değerli üreticilerimiz, yarın beklenen don olayına karşı önlem alınız..."
                            className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-stone-100 text-sm focus:border-blue-500 outline-none transition-all h-32 resize-none"
                          />
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Alıcı Listesi ({bulkTargetFarmers.length})</label>
                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                              {bulkTargetFarmers.map((f: Farmer) => (
                                  <div key={f.id} className="flex items-center justify-between p-2 bg-stone-950/50 rounded-lg border border-white/5">
                                      <div className="flex flex-col">
                                          <span className="text-[11px] font-bold text-stone-200">{f.fullName}</span>
                                          <span className="text-[9px] text-stone-500">{f.phoneNumber}</span>
                                      </div>
                                      <button 
                                        onClick={() => handleSendBulkWhatsApp(f)}
                                        disabled={!bulkMessage.trim()}
                                        className="p-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-30"
                                      >
                                          <Send size={12} />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>

                  <div className="p-4 border-t border-white/5 bg-stone-900/80">
                      <p className="text-[9px] text-stone-500 mb-3 leading-tight">
                          * WhatsApp kısıtlamaları nedeniyle mesajlar tek tek gönderilmelidir. Her alıcı için butona basmanız gerekmektedir.
                      </p>
                      <button 
                        onClick={() => setIsBulkMessageModalOpen(false)}
                        className="w-full bg-stone-800 text-stone-300 py-3 rounded-xl font-bold text-xs hover:bg-stone-700 transition-all"
                      >
                          Kapat
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Modals (Import & Add/Edit) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 rounded-3xl w-full max-w-md flex flex-col max-h-[85vh] shadow-2xl border border-white/10">
                <div className="p-4 border-b border-white/5 shrink-0 flex justify-between items-center"><h2 className="text-base font-bold text-stone-100 flex items-center"><Contact className="mr-2 text-emerald-500" size={18}/> Rehber Aktarımı</h2><button onClick={() => setIsImportModalOpen(false)} className="text-stone-500 hover:text-stone-300"><X size={18}/></button></div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">{importPreviewList.map(contact => (<div key={contact.id} onClick={() => toggleSelectImport(contact)} className={`flex items-center p-2.5 rounded-xl transition-colors border ${contact.isAlreadyRegistered ? 'opacity-40 bg-stone-950 border-transparent' : selectedImportIds.has(contact.id) ? 'bg-emerald-900/10 border-emerald-500/20' : 'hover:bg-white/5 border-transparent'}`}><div className={`w-4 h-4 rounded flex items-center justify-center mr-3 ${selectedImportIds.has(contact.id) ? 'bg-emerald-600 text-white' : 'border-2 border-stone-700'}`}>{selectedImportIds.has(contact.id) && <Check size={10}/>}</div><div className="flex-1 min-w-0"><p className="font-bold text-stone-200 text-xs truncate">{contact.fullName}</p><p className="text-[10px] text-stone-500 font-mono">{contact.phoneNumber}</p></div></div>))}</div>
                <div className="p-4 border-t border-white/5 bg-stone-900/80"><button disabled={selectedImportIds.size === 0 || isImporting} onClick={confirmBulkImport} className="w-full bg-emerald-700 text-white py-3 rounded-xl font-bold text-xs shadow-lg disabled:opacity-50 flex items-center justify-center">{isImporting ? <Loader2 className="animate-spin mr-2"/> : <Plus className="mr-2"/>} {selectedImportIds.size} Kişiyi Ekle</button></div>
            </div>
        </div>
      )}

      {/* ADD/EDIT MODAL FOR LIST VIEW - FIX: Using extracted component */}
      <FarmerModal 
        isOpen={isModalOpen}
        onClose={resetModal}
        mode={modalMode}
        isSaving={isSavingFarmer}
        data={editFarmerData}
        setData={setEditFarmerData}
        onSave={handleSaveFarmer}
      />

    </div>
  );
};

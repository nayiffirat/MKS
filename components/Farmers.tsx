
import React, { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import { ContactService, ContactInfo } from '../services/contact';
import { Farmer, VisitLog, Prescription } from '../types';
import { Search, Phone, MessageCircle, MapPin, Wheat, ChevronLeft, ChevronRight, Contact, Loader2, User, Ruler, FileText, Calendar, Navigation, Plus, X, ArrowLeft, Edit2, Trash2, CheckSquare, Square, Check, FlaskConical, Clock, ImageIcon, Sparkles, Upload, AlertCircle, MessageSquare, Share2, Save, Download, FileJson } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface FarmersProps {
  onBack: () => void;
  onNavigateToPrescription: (farmerId: string) => void;
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
        fieldSize: string;
        crops: string;
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

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-stone-900 rounded-3xl w-full max-w-md p-5 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200">
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-stone-800 rounded-full text-stone-400 hover:text-stone-200"><X size={16} /></button>
            <div className="text-center mb-4"><h2 className="text-base font-bold text-stone-100">{mode === 'ADD' ? 'Yeni Çiftçi Ekle' : 'Çiftçiyi Düzenle'}</h2></div>
            <form onSubmit={onSave} className="space-y-2.5">
              <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase">Ad Soyad</label><input required type="text" value={data.fullName} onChange={e => setData({...data, fullName: e.target.value})} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs" placeholder="İsim" /></div>
              <div className="grid grid-cols-2 gap-2.5">
                  <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase">Telefon</label><input required type="tel" value={data.phoneNumber} onChange={handlePhoneChange} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs" /></div>
                  <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase">Köy</label><input required type="text" value={data.village} onChange={e => setData({...data, village: e.target.value})} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                  <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase">Arazi (da)</label><input type="number" value={data.fieldSize} onChange={e => setData({...data, fieldSize: e.target.value})} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs" /></div>
                  <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase">Ürün</label><input type="text" value={data.crops} onChange={e => setData({...data, crops: e.target.value})} className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs" /></div>
              </div>
              <button disabled={isSaving} type="submit" className="w-full bg-emerald-700 text-white py-3 rounded-xl font-bold text-xs shadow-lg mt-2 flex justify-center items-center">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Kaydet'}
              </button>
            </form>
          </div>
        </div>
    );
};

export const Farmers: React.FC<FarmersProps> = ({ onBack, onNavigateToPrescription }) => {
  const { bulkAddFarmers, addFarmer, updateFarmer, deleteFarmer, userProfile, updateVisit, deleteVisit } = useAppViewModel();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Specific Data for Selected Farmer
  const [farmerVisits, setFarmerVisits] = useState<VisitLog[]>([]);
  const [farmerPrescriptions, setFarmerPrescriptions] = useState<Prescription[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Prescription Detail & Sharing
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Visit Editing State
  const [editingVisit, setEditingVisit] = useState<VisitLog | null>(null);
  const [editVisitNote, setEditVisitNote] = useState('');

  // Contact Selection States
  const [importPreviewList, setImportPreviewList] = useState<TempContact[]>([]);
  const [selectedImportIds, setSelectedImportIds] = useState<Set<string>>(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Add/Edit Farmer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [isSavingFarmer, setIsSavingFarmer] = useState(false);
  const [editFarmerData, setEditFarmerData] = useState({
      id: '',
      fullName: '',
      phoneNumber: '+90 ',
      village: '',
      fieldSize: '',
      crops: ''
  });
  
  // Detail View Tab State
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VISITS' | 'PRESCRIPTIONS'>('GENERAL');

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
      const [visits, prescriptions] = await Promise.all([
          dbService.getVisitsByFarmer(selectedFarmer.id),
          dbService.getPrescriptionsByFarmer(selectedFarmer.id)
      ]);
      
      // Sort by date descending (newest first)
      setFarmerVisits(visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setFarmerPrescriptions(prescriptions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setIsDataLoading(false);
  };

  // --- VISIT ACTIONS ---
  const handleDeleteVisit = async (visitId: string) => {
      if (window.confirm("Bu ziyaret kaydını silmek istediğinize emin misiniz?")) {
          await deleteVisit(visitId);
          await loadFarmerDetails(); // Listeyi yenile
      }
  };

  const openEditVisitModal = (visit: VisitLog) => {
      setEditingVisit(visit);
      setEditVisitNote(visit.note);
  };

  const handleSaveVisit = async () => {
      if (!editingVisit) return;
      await updateVisit({
          ...editingVisit,
          note: editVisitNote
      });
      setEditingVisit(null);
      setEditVisitNote('');
      await loadFarmerDetails();
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
      const toAdd = importPreviewList.filter(c => selectedImportIds.has(c.id)).map(c => ({ fullName: c.fullName, phoneNumber: c.phoneNumber, village: 'Rehberden Aktarıldı', fieldSize: 0, crops: '' }));
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
          const farmerData = { fullName: editFarmerData.fullName, phoneNumber: editFarmerData.phoneNumber, village: editFarmerData.village, fieldSize: Number(editFarmerData.fieldSize) || 0, crops: editFarmerData.crops };
          
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
      setEditFarmerData({ id: '', fullName: '', phoneNumber: '+90 ', village: '', fieldSize: '', crops: '' });
  };

  const openEditModal = () => {
      if (!selectedFarmer) return;
      setEditFarmerData({ id: selectedFarmer.id, fullName: selectedFarmer.fullName, phoneNumber: selectedFarmer.phoneNumber, village: selectedFarmer.village, fieldSize: selectedFarmer.fieldSize.toString(), crops: selectedFarmer.crops || '' });
      setModalMode('EDIT'); setIsModalOpen(true);
  };

  const handleDeleteFarmer = async () => {
      if (!selectedFarmer) return;
      if (window.confirm("Bu çiftçiyi ve tüm kayıtlarını silmek istediğinize emin misiniz?")) {
          await deleteFarmer(selectedFarmer.id); setSelectedFarmer(null); await loadFarmers();
      }
  };

  const filteredFarmers = farmers.filter(f => f.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || f.village.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- DETAIL VIEW ---
  if (selectedFarmer) {
     if (selectedPrescription) {
         return (
            <div className="pb-24 animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-3 border-b border-white/5">
                    <button onClick={() => setSelectedPrescription(null)} className="flex items-center text-stone-400 hover:text-stone-200 font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-xs">
                        <ChevronLeft className="mr-1" size={18}/> Reçeteye Dön
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

     return (
        <div className="pb-24 animate-in slide-in-from-right duration-300">
            {/* STABILIZED HEADER: Sticky & Better Buttons */}
            <div className="sticky top-0 z-20 bg-stone-950/90 backdrop-blur-xl border-b border-white/5 py-3 mb-4 -mx-4 px-4 flex justify-between items-center shadow-lg shadow-black/20">
                 <button onClick={() => setSelectedFarmer(null)} className="flex items-center text-stone-400 hover:text-stone-200 font-bold px-3 py-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors text-xs">
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
            <div className="bg-stone-900/80 backdrop-blur rounded-2xl p-4 shadow-sm border border-white/5 mb-4 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-emerald-900/20 to-transparent -z-10"></div>
                
                <div className="flex items-center space-x-3 w-full mb-3">
                    <div className="w-14 h-14 bg-stone-800 border-2 border-emerald-900/50 rounded-full flex items-center justify-center text-xl font-bold text-emerald-500 shadow-md">
                        {selectedFarmer.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <h2 className="text-lg font-bold text-stone-100 truncate">{selectedFarmer.fullName}</h2>
                        <div className="flex items-center text-stone-400 text-xs mt-0.5">
                            <MapPin size={10} className="mr-1 text-emerald-500"/> {selectedFarmer.village}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 w-full">
                    {/* Buttons condensed */}
                    {[
                        { icon: Phone, label: 'Ara', href: `tel:${selectedFarmer.phoneNumber}`, color: 'emerald' },
                        { icon: MessageCircle, label: 'WP', href: `https://wa.me/${selectedFarmer.phoneNumber.replace(/[^0-9]/g, '')}`, color: 'green', target: '_blank' },
                        { icon: MessageSquare, label: 'SMS', href: `sms:${selectedFarmer.phoneNumber}`, color: 'blue' },
                        { icon: Navigation, label: 'Yol', action: () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedFarmer.village)}`, '_blank'), color: 'amber' }
                    ].map((btn, i) => (
                        btn.href ? (
                            <a key={i} href={btn.href} target={btn.target} className="flex flex-col items-center justify-center p-2 bg-stone-800/60 rounded-xl hover:bg-stone-800 transition-colors border border-white/5 active:scale-95">
                                <btn.icon size={16} className={`mb-1 text-stone-400 group-hover:text-${btn.color}-500`}/>
                                <span className="text-[9px] font-bold text-stone-500">{btn.label}</span>
                            </a>
                        ) : (
                            <button key={i} onClick={btn.action} className="flex flex-col items-center justify-center p-2 bg-stone-800/60 rounded-xl hover:bg-stone-800 transition-colors border border-white/5 active:scale-95">
                                <btn.icon size={16} className={`mb-1 text-stone-400`}/>
                                <span className="text-[9px] font-bold text-stone-500">{btn.label}</span>
                            </button>
                        )
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-stone-900/60 backdrop-blur rounded-xl mb-4 border border-white/5">
                {(['GENERAL', 'VISITS', 'PRESCRIPTIONS'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all ${activeTab === tab ? 'bg-stone-700 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}>
                        {tab === 'GENERAL' ? 'Genel' : (tab === 'VISITS' ? 'Ziyaretler' : 'Reçeteler')}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="animate-in fade-in duration-300">
                {activeTab === 'GENERAL' && (
                    <div className="space-y-3">
                        <div className="bg-stone-900/80 backdrop-blur p-4 rounded-2xl border border-white/5 shadow-sm">
                            <h3 className="font-bold text-stone-200 text-xs mb-3 flex items-center uppercase tracking-wider opacity-70"><Wheat size={14} className="mr-1.5 text-amber-500"/> Tarla Bilgileri</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-stone-950/50 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-stone-500 uppercase font-bold mb-1">Arazi Büyüklüğü</p>
                                    <p className="text-base font-bold text-stone-200">{selectedFarmer.fieldSize} <span className="text-[10px] font-normal text-stone-400">da</span></p>
                                </div>
                                <div className="p-3 bg-stone-950/50 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-stone-500 uppercase font-bold mb-1">Ekili Ürün</p>
                                    <p className="text-base font-bold text-stone-200">{selectedFarmer.crops || '-'}</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onNavigateToPrescription(selectedFarmer.id)} className="w-full py-3.5 bg-emerald-700 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center text-xs uppercase tracking-wider">
                            <FileText className="mr-2" size={16}/> Yeni Reçete Yaz
                        </button>
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
                                    <div className="flex gap-1.5"><button onClick={() => openEditVisitModal(visit)} className="text-stone-500 hover:text-emerald-400"><Edit2 size={12}/></button><button onClick={() => handleDeleteVisit(visit.id)} className="text-stone-500 hover:text-red-400"><Trash2 size={12}/></button></div>
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
            {editingVisit && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-stone-900 rounded-3xl w-full max-w-md p-5 shadow-2xl relative border border-white/10">
                        <button onClick={() => setEditingVisit(null)} className="absolute top-3 right-3 p-1.5 bg-stone-800 rounded-full text-stone-400 hover:text-stone-200"><X size={16} /></button>
                        <h3 className="text-base font-bold text-stone-100 mb-3 flex items-center"><Edit2 size={16} className="mr-2 text-emerald-500" /> Notu Düzenle</h3>
                        <textarea value={editVisitNote} onChange={(e) => setEditVisitNote(e.target.value)} className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 outline-none focus:border-emerald-500/50 transition-all h-28 resize-none mb-3" placeholder="Not..." />
                        <button onClick={handleSaveVisit} className="w-full bg-emerald-700 text-white py-2.5 rounded-xl font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all text-xs">Kaydet</button>
                    </div>
                </div>
            )}
            
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
          <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">{farmers.length} Çiftçi</span>
      </div>

      <div className="sticky top-0 z-10 bg-stone-950/80 backdrop-blur-md pb-2.5 pt-0">
         <div className="bg-stone-900 rounded-2xl shadow-sm border border-white/5 flex items-center p-1">
             <Search className="text-stone-500 ml-3" size={16} />
             <input type="text" placeholder="Çiftçi adı veya köy ara..." className="w-full p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
             <button onClick={handleContactImport} disabled={isImporting} className={`p-1.5 rounded-xl transition-all m-1 flex items-center justify-center ${isImporting ? 'bg-emerald-900/30 text-emerald-500' : 'bg-stone-800 hover:bg-stone-700 text-emerald-500'}`}>{isImporting ? <Loader2 size={16} className="animate-spin"/> : <Contact size={16}/>}</button>
         </div>
      </div>

      <div className="space-y-2">
        {filteredFarmers.map(farmer => (
            <div key={farmer.id} onClick={() => setSelectedFarmer(farmer)} className="bg-stone-900/80 backdrop-blur rounded-2xl p-2.5 shadow-sm border border-white/5 flex items-center justify-between hover:bg-stone-800/80 hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-stone-800 text-stone-500 flex items-center justify-center font-bold text-sm group-hover:bg-emerald-900/30 group-hover:text-emerald-400 transition-colors border border-white/5">{farmer.fullName.charAt(0)}</div>
                    <div>
                        <h3 className="font-bold text-stone-200 text-sm">{farmer.fullName}</h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                             <span className="text-[9px] text-stone-500 flex items-center bg-stone-950/50 px-1.5 py-0.5 rounded border border-white/5"><MapPin size={8} className="mr-1"/> {farmer.village}</span>
                             {farmer.crops && <span className="text-[9px] text-amber-500 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-800/30 font-medium">{farmer.crops}</span>}
                        </div>
                    </div>
                </div>
                <div className="bg-stone-800 p-1 rounded-full text-stone-500 group-hover:text-emerald-400 transition-colors"><ChevronRight size={14} /></div>
            </div>
        ))}
        {filteredFarmers.length === 0 && <div className="text-center py-10"><User size={28} className="mx-auto mb-2 text-stone-700"/><p className="text-stone-500 text-[10px]">Kayıt yok.</p></div>}
      </div>

      <button onClick={() => { setModalMode('ADD'); setIsModalOpen(true); }} className="fixed bottom-32 right-5 bg-emerald-600 text-white p-3 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center"><Plus size={22} /></button>

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

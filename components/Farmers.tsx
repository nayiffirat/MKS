
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ContactService, ContactInfo } from '../services/contact';
import { Farmer, VisitLog, Prescription, ManualDebt, Payment, Pesticide } from '../types';
import { COMMON_CROPS, CROP_PESTICIDE_COSTS, DEFAULT_PESTICIDE_COST, CROP_AGRONOMY_INTEL, DEFAULT_AGRONOMY } from '../constants';
import { Search, Phone, MessageCircle, MapPin, Wheat, ChevronLeft, ChevronRight, Contact, Loader2, User, Ruler, FileText, Calendar, Navigation, Plus, X, ArrowLeft, Edit2, Trash2, CheckSquare, Square, Check, FlaskConical, Clock, ImageIcon, Upload, AlertCircle, MessageSquare, Share2, Save, Download, FileJson, RefreshCw, RefreshCcw, Wallet, History, CreditCard, TrendingDown, TrendingUp as TrendingUpIcon, Send, Copy, ClipboardList, AlertTriangle, Sprout, Info, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { DebtReminderModal } from './DebtReminderModal';

interface FarmersProps {
  onBack: () => void;
  onNavigateToPrescription: (farmerId: string) => void;
  onEditPrescription: (prescriptionId: string) => void;
  onEditVisit: (visitId: string) => void;
  selectedFarmerId?: string | null;
  onSelectFarmer?: (id: string | null) => void;
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
    onDelete?: () => void;
    farmerLabel: string;
}

const FarmerModal: React.FC<FarmerModalProps> = ({ isOpen, onClose, mode, isSaving, data, setData, onSave, onDelete, farmerLabel }) => {
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
            <div className="text-center mb-4 shrink-0"><h2 className="text-base font-bold text-stone-100">{mode === 'ADD' ? `Yeni ${farmerLabel} Ekle` : `${farmerLabel}yi Düzenle`}</h2></div>
            
            <form onSubmit={onSave} className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-4">
              <div className="space-y-2.5">
                <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Ad Soyad</label><input required type="text" value={data.fullName} onChange={e => setData({...data, fullName: e.target.value})} className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" placeholder="İsim" /></div>
                <div className="grid grid-cols-2 gap-2.5">
                    <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Telefon</label><input required type="tel" value={data.phoneNumber} onChange={handlePhoneChange} className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" /></div>
                    <div><label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Köy</label><input required type="text" value={data.village} onChange={e => setData({...data, village: e.target.value})} className="w-full p-2 bg-stone-950 border border-stone-800 rounded-xl outline-none font-medium text-white text-xs focus:border-emerald-500/50 transition-all" /></div>
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

              <div className="pt-2 shrink-0 flex gap-2">
                {mode === 'EDIT' && onDelete && (
                    <button 
                        type="button" 
                        onClick={() => {
                            onClose();
                            onDelete();
                        }}
                        className="px-4 bg-rose-900/20 text-rose-500 rounded-2xl font-bold text-xs border border-rose-500/20 hover:bg-rose-900/30 transition-all active:scale-95"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
                <button disabled={isSaving} type="submit" className="flex-1 bg-emerald-700 text-white py-3.5 rounded-2xl font-bold text-xs shadow-xl shadow-emerald-900/20 flex justify-center items-center active:scale-95 transition-all border border-emerald-500/20">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : `${farmerLabel}yi Kaydet`}
                </button>
              </div>
            </form>
          </div>
        </div>
    );
};

export const Farmers: React.FC<FarmersProps> = ({ onBack, onNavigateToPrescription, onEditPrescription, onEditVisit, selectedFarmerId, onSelectFarmer }) => {
  const { currentUser } = useAuth();
  const { 
    accounts, 
    addPayment, 
    updatePayment,
    softDeletePayment: removePayment, 
    addManualDebt, 
    updateManualDebt, 
    deleteManualDebt, 
    payments, 
    prescriptions, 
    manualDebts, 
    myPayments,
    bulkAddFarmers, 
    addFarmer, 
    updateFarmer, 
    softDeleteFarmer, 
    userProfile, 
    updateUserProfile, 
    updateVisit, 
    softDeleteVisit, 
    showToast, 
    hapticFeedback, 
    activeTeamMember,
    teamMembers,
    farmerLabel,
    farmerPluralLabel,
    prescriptionLabel,
    inventory,
    addPrescription,
    togglePrescriptionStatus,
    softDeletePrescription,
    t
  } = useAppViewModel();
  const isSales = activeTeamMember?.role === 'SALES';

  const canEditFarmer = !isSales;
  const canCreateFarmer = canEditFarmer;
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
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

  const [isDebtReminderModalOpen, setIsDebtReminderModalOpen] = useState(false);

  // Sync with prop
  useEffect(() => {
    if (selectedFarmerId) {
      const target = farmers.find(f => f.id === selectedFarmerId);
      if (target) {
        setSelectedFarmer(target);
        setActiveTab('DEBT');
      }
    } else {
      setSelectedFarmer(null);
    }
  }, [selectedFarmerId, farmers]);

  // Sub-navigation sync
  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const state = e.state;
      if (state?.view === 'FARMERS') {
        if (state.farmerId) {
          const target = farmers.find(f => f.id === state.farmerId);
          if (target) {
            if (onSelectFarmer) onSelectFarmer(target.id);
            else setSelectedFarmer(target);
          }
        } else {
          if (onSelectFarmer) onSelectFarmer(null);
          else setSelectedFarmer(null);
        }

        if (state.modal) {
          setIsModalOpen(true);
        } else {
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [farmers, onSelectFarmer]);

  const toggleModal = (open: boolean) => {
    if (open === isModalOpen) return;
    if (open) {
      window.history.pushState({ ...window.history.state, modal: 'FARMER_FORM' }, '');
    } else if (window.history.state?.modal === 'FARMER_FORM') {
      window.history.back();
      return;
    }
    setIsModalOpen(open);
  };

  const changeFarmerSelection = (farmer: Farmer | null) => {
    if (farmer === selectedFarmer) return;

    setSelectedPrescription(null);
    if (!farmer) {
      if (onSelectFarmer) {
        onSelectFarmer(null);
      } else {
        setSelectedFarmer(null);
      }
      
      if (window.history.state?.farmerId) {
        window.history.back();
      }
    } else {
      setActiveTab('DEBT');
      if (!window.history.state?.farmerId) {
        window.history.pushState({ ...window.history.state, farmerId: farmer.id }, '');
      }
      
      if (onSelectFarmer) {
        onSelectFarmer(farmer.id);
      } else {
        setSelectedFarmer(farmer);
      }
    }
  };
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Specific Data for Selected Farmer
  const [farmerVisits, setFarmerVisits] = useState<VisitLog[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const farmerPrescriptions = useMemo(() => 
    prescriptions.filter(p => p.farmerId === selectedFarmer?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [prescriptions, selectedFarmer]);

  const farmerManualDebts = useMemo(() => 
    manualDebts.filter(d => d.farmerId === selectedFarmer?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [manualDebts, selectedFarmer]);

  // Prescription Detail & Sharing
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [prescriptionToDelete, setPrescriptionToDelete] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VISITS' | 'PRESCRIPTIONS' | 'DEBT'>('DEBT');

  const tabs = useMemo(() => {
    const allTabs = [
        { id: 'GENERAL', label: 'Genel Bilgiler', icon: User },
        { id: 'VISITS', label: 'Reçeteler', icon: ClipboardList },
        { id: 'PRESCRIPTIONS', label: prescriptionLabel, icon: FileText },
        { id: 'DEBT', label: 'Borç / Tahsilat', icon: Wallet }
    ];
    
    if (isSales) {
        return allTabs.filter(t => t.id === 'DEBT' || t.id === 'PRESCRIPTIONS');
    }
    return allTabs;
  }, [isSales, prescriptionLabel]);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHECK' | 'TEDYE'>('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  // Manual Debt Modal State
  const [isManualDebtModalOpen, setIsManualDebtModalOpen] = useState(false);
  const [editingManualDebt, setEditingManualDebt] = useState<ManualDebt | null>(null);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [debtDate, setDebtDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingDebt, setIsSavingDebt] = useState(false);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<{ pesticideId: string, pesticideName: string, quantity: number, unitPrice: number }[]>([]);
  const [isSavingReturn, setIsSavingReturn] = useState(false);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');

  // Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [isViewingReport, setIsViewingReport] = useState(false);
  const [reportType, setReportType] = useState<'SUMMARY' | 'DETAILED'>('SUMMARY');
  const [reportFieldId, setReportFieldId] = useState<string>('ALL');
  const [reportCrop, setReportCrop] = useState<string>('ALL');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const reportRef = useRef<HTMLDivElement>(null);

  const loadFarmers = async () => {
      setIsLoading(true);
      try {
          const list = await dbService.getFarmers();
          setFarmers(list.filter(f => !f.deletedAt));
      } finally {
          setIsLoading(false);
      }
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

  // Set default selected year to the latest available year
  const farmerPayments = useMemo(() => 
    payments.filter(p => p.farmerId === selectedFarmer?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
  [payments, selectedFarmer]);
  
  // Calculate available years for filtering
  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(new Date().getFullYear());
      
      farmerPrescriptions.forEach(p => years.add(new Date(p.date).getFullYear()));
      farmerPayments.forEach(p => years.add(new Date(p.date).getFullYear()));
      farmerManualDebts.forEach(d => years.add(new Date(d.date).getFullYear()));
      
      return Array.from(years).sort((a, b) => b - a);
  }, [farmerPrescriptions, farmerPayments, farmerManualDebts]);

  const availableCrops = useMemo(() => {
    if (!selectedFarmer?.fields) return [];
    const crops = new Set(selectedFarmer.fields.map(f => f.crop).filter(Boolean));
    return Array.from(crops).sort();
  }, [selectedFarmer]);

  const reportItems = useMemo(() => {
    if (!selectedFarmer) return [];
    // Only include checks/notes that do not have a relatedId (i.e. not generated by a normal Payment record) to prevent duplication
    const farmerMyPayments = myPayments.filter(p => p.farmerId === selectedFarmer.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId);
    return [
        ...farmerPrescriptions.map(p => ({ 
            ...p, 
            type: p.priceType === 'CASH' ? 'CASH' : 'DEBT', 
            label: p.priceType === 'CASH' ? 'Peşin Satış' : ((p.totalAmount || 0) < 0 ? 'İade Makbuzu' : `${prescriptionLabel} Satışı`),
            note: p.prescriptionNo ? `Fatura No: ${p.prescriptionNo}` : ''
        })),
        ...farmerPayments.map(p => ({ 
            ...p, 
            type: 'PAYMENT', 
            label: 'Tahsilat' 
        })),
        ...farmerMyPayments.map(p => ({ 
            ...p, 
            type: 'PAYMENT', 
            label: p.type === 'CHECK' ? 'Çek Tahsilatı' : (p.type === 'PROMISSORY_NOTE' ? 'Senet Tahsilatı' : 'Tahsilat'), 
            date: p.issueDate,
            note: p.note
        })),
        ...farmerManualDebts.map(d => ({ 
            ...d, 
            type: 'DEBT', 
            label: 'Manuel Borç' 
        }))
    ]
    .filter(item => {
        const itemDate = new Date((item as any).date);
        if (reportStartDate && itemDate < new Date(reportStartDate)) return false;
        if (reportEndDate && itemDate > new Date(reportEndDate)) return false;
        
        // Tarla Filtresi - Sadece reçeteler tarlaya bağlıdır. Ödemeler ve manuel borçlar her zaman gösterilir.
        if (reportFieldId !== 'ALL' && (item as any).type !== 'PAYMENT' && (item as any).label !== 'Manuel Borç') {
            const fIds = (item as any).fieldIds || ((item as any).fieldId ? [(item as any).fieldId] : []);
            if (!fIds.includes(reportFieldId)) return false;
        }

        // Ürün Filtresi
        if (reportCrop !== 'ALL' && (item as any).type !== 'PAYMENT' && (item as any).label !== 'Manuel Borç') {
            const fIds = (item as any).fieldIds || ((item as any).fieldId ? [(item as any).fieldId] : []);
            const farmerFields = selectedFarmer.fields || [];
            const matchesCrop = fIds.some((fid: string) => {
                const field = farmerFields.find(f => f.id === fid);
                return field?.crop === reportCrop;
            });
            if (!matchesCrop) return false;
        }
        
        return true;
    })
    .sort((a, b) => new Date((a as any).date).getTime() - new Date((b as any).date).getTime());
  }, [farmerPrescriptions, farmerPayments, farmerManualDebts, myPayments, reportStartDate, reportEndDate, reportFieldId, reportCrop, selectedFarmer, prescriptionLabel]);

  const reportTotalDebt = useMemo(() => reportItems.filter(item => item.type === 'DEBT' && ((item as any).totalAmount >= 0 || (item as any).amount >= 0)).reduce((acc, item) => acc + ((item as any).amount || (item as any).totalAmount || 0), 0), [reportItems]);
  const reportTotalPaid = useMemo(() => {
      const payments = reportItems.filter(item => item.type === 'PAYMENT').reduce((acc, item) => acc + (item as any).amount, 0);
      const returns = reportItems.filter(item => item.type === 'DEBT' && (item as any).totalAmount < 0).reduce((acc, item) => acc + Math.abs((item as any).totalAmount), 0);
      return payments + returns;
  }, [reportItems]);
  const reportBalance = reportTotalPaid - reportTotalDebt;

  // Filter transactions by selected year
  const filteredPrescriptions = useMemo(() => 
      farmerPrescriptions.filter(p => new Date(p.date).getFullYear() === selectedYear),
  [farmerPrescriptions, selectedYear]);

  const filteredPayments = useMemo(() => {
      const regularPayments = farmerPayments.filter(p => new Date(p.date).getFullYear() === selectedYear);
      const checkPayments = myPayments.filter(p => p.farmerId === selectedFarmer?.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId && new Date(p.issueDate).getFullYear() === selectedYear);
      return [...regularPayments, ...checkPayments.map(p => ({ ...p, date: p.issueDate }))];
  }, [farmerPayments, myPayments, selectedFarmer, selectedYear]);

  const filteredManualDebts = useMemo(() => 
      farmerManualDebts.filter(d => new Date(d.date).getFullYear() === selectedYear),
  [farmerManualDebts, selectedYear]);

  const openingBalance = useMemo(() => {
      let balance = 0;
      
      // Sum all transactions BEFORE the selected year
      farmerPrescriptions.forEach(p => {
          if (new Date(p.date).getFullYear() < selectedYear && p.priceType !== 'CASH') {
              balance -= (p.totalAmount || 0);
          }
      });
      
      farmerManualDebts.forEach(d => {
          if (new Date(d.date).getFullYear() < selectedYear && !d.id.startsWith('turnover-')) {
              balance -= d.amount;
          }
      });
      
      farmerPayments.forEach(p => {
          if (new Date(p.date).getFullYear() < selectedYear) {
              balance += p.amount;
          }
      });

      myPayments.forEach(p => {
          if (p.farmerId === selectedFarmer?.id && !p.deletedAt && p.status !== 'CANCELLED' && new Date(p.issueDate).getFullYear() < selectedYear) {
              balance += p.amount;
          }
      });
      
      return balance;
  }, [farmerPrescriptions, farmerManualDebts, farmerPayments, myPayments, selectedYear, selectedFarmer]);

  const yearTotalPaid = useMemo(() => filteredPayments.reduce((acc, p) => acc + p.amount, 0), [filteredPayments]);
  const yearTotalDebt = useMemo(() => 
    filteredPrescriptions.filter(p => p.priceType !== 'CASH').reduce((acc, p) => acc + (p.totalAmount || 0), 0) + 
    filteredManualDebts.filter(d => !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0),
  [filteredPrescriptions, filteredManualDebts]);

  const yearBalance = openingBalance + yearTotalPaid - yearTotalDebt;

  // Overall totals for report or general info if needed
  const totalPaid = useMemo(() => {
      const cashPayments = farmerPayments.reduce((acc, p) => acc + p.amount, 0);
      const checkPayments = myPayments.filter(p => p.farmerId === selectedFarmer?.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId).reduce((acc, p) => acc + p.amount, 0);
      return cashPayments + checkPayments;
  }, [farmerPayments, myPayments, selectedFarmer]);

  const totalDebt = farmerPrescriptions.filter(p => p.priceType !== 'CASH').reduce((acc, p) => acc + (p.totalAmount || 0), 0) + farmerManualDebts.filter(d => !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0);
  const overallBalance = totalPaid - totalDebt;

  useEffect(() => {
    if (availableYears.length > 0) {
        setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  const loadFarmerDetails = async () => {
      if (!selectedFarmer) return;
      setIsDataLoading(true);
      try {
          const visits = await dbService.getVisitsByFarmer(selectedFarmer.id);
          // Sort by date descending (newest first)
          setFarmerVisits(visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (error) {
          console.error("Error loading farmer details:", error);
      } finally {
          setIsDataLoading(false);
      }
  };

  // --- VISIT ACTIONS ---
  const handleDeleteVisit = async (visitId: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Reçete Silinecek',
          message: 'Bu reçeteyi silmek istediğinize emin misiniz?',
          onConfirm: async () => {
              await softDeleteVisit(visitId);
              showToast('Reçete silindi', 'success');
              hapticFeedback('medium');
              await loadFarmerDetails(); // Listeyi yenile
          }
      });
  };

  const handleWhatsAppText = () => {
      if (!selectedPrescription || !selectedFarmer) return;
      
      let text = `*ZİRAİ FATURA*\n`;
      text += `Sayın *${selectedFarmer.fullName}*,\n\n`;
      text += `Tarih: ${new Date(selectedPrescription.date).toLocaleDateString('tr-TR')}\n`;
      text += `${prescriptionLabel} No: ${selectedPrescription.prescriptionNo}\n\n`;
      text += `*Kullanılacak İlaçlar:*\n`;
      
      selectedPrescription.items.forEach(item => {
          text += `- ${item.pesticideName}: *${item.dosage}*`;
          if (item.quantity) text += ` (${item.quantity.toString().replace(/^-/, '')} Adet)`;
          text += `\n`;
      });
      
      text += `\nGeçmiş olsun.\n${selectedPrescription.engineerName}`;
      
      const url = `https://wa.me/${selectedFarmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const handleCopyPortalLink = async () => {
      if (!selectedFarmer || !currentUser) return;
      
      const baseUrl = window.location.origin + window.location.pathname;
      const portalPath = baseUrl.endsWith('/') ? baseUrl + 'portal.html' : baseUrl.replace(/\/[^\/]*$/, '/portal.html');
      const url = new URL(portalPath);
      url.searchParams.set('portalId', selectedFarmer.id);
      url.searchParams.set('engineerId', currentUser.uid);
      const portalUrl = url.toString();
      
      let text = `Sayın *${selectedFarmer.fullName}*,\n\n`;
      text += `Size özel hazırladığımız *${farmerLabel} Portalı*'na aşağıdaki linkten ulaşabilirsiniz. Bu portal üzerinden güncel borç durumunuzu, aldığınız ilaçları ve ${prescriptionLabel.toLowerCase()}lerinizi takip edebilirsiniz.\n\n`;
      text += `🔗 *Portal Linkiniz:*\n${portalUrl}\n\n`;
      text += `İyi çalışmalar dileriz.`;
      
      try {
          await navigator.clipboard.writeText(text);
          showToast('Portal linki ve mesajı kopyalandı', 'success');
          hapticFeedback('success');
      } catch (err) {
          console.error('Failed to copy link: ', err);
          showToast('Link kopyalanamadı', 'error');
          hapticFeedback('error');
      }
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
        
        // Türkçe karakterleri temizle ve ASCII'ye çevir
        const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
        const safeName = selectedFarmer.fullName
            .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
        const fileName = `${safeName}_Receti.pdf`;

        if (action === 'DOWNLOAD') {
            pdf.save(fileName);
        } else {
            const pdfBlob = pdf.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const shareData = {
                files: [file],
                title: `Zirai ${prescriptionLabel}`
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
      toggleModal(false); setModalMode('ADD');
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
      setModalMode('EDIT'); toggleModal(true);
  };

  const parseFloatSafe = (val: string | number) => parseFloat(String(val).replace(',', '.')) || 0;

  const handleSavePayment = async () => {
      if (!selectedFarmer || !paymentAmount) return;
      setIsSavingPayment(true);
      try {
          const parsedAmount = parseFloatSafe(paymentAmount);
          if (editingPayment) {
              await updatePayment({
                  ...editingPayment,
                  amount: parsedAmount,
                  note: paymentNote,
                  method: paymentMethod,
                  dueDate: (paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') ? paymentDate : undefined,
                  accountId: selectedAccountId || undefined
              });
              showToast('Ödeme güncellendi', 'success');
          } else {
              await addPayment({
                  farmerId: selectedFarmer.id,
                  amount: parsedAmount,
                  date: new Date().toISOString(),
                  method: paymentMethod,
                  dueDate: (paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') ? paymentDate : undefined,
                  note: paymentNote,
                  accountId: selectedAccountId || undefined,
                  createdById: activeTeamMember?.id
              });
              showToast('Ödeme kaydedildi', 'success');
          }
          hapticFeedback('success');
          setIsPaymentModalOpen(false);
          setEditingPayment(null);
          setPaymentAmount('');
          setPaymentNote('');
          setPaymentMethod('CASH');
          setPaymentDate(new Date().toISOString().split('T')[0]);
          setSelectedAccountId('');
          await loadFarmerDetails();
      } catch (e) {
          showToast('İşlem başarısız', 'error');
      } finally {
          setIsSavingPayment(false);
      }
  };

  const findLastPriceForPesticide = (pesticideId: string) => {
      const sortedPrescriptions = [...farmerPrescriptions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      for (const p of sortedPrescriptions) {
          const item = p.items.find(i => i.pesticideId === pesticideId);
          if (item && item.unitPrice) {
              return item.unitPrice;
          }
      }
      return 0;
  };

  const handleAddReturnItem = (pesticide: Pesticide) => {
      if (returnItems.some(i => i.pesticideId === pesticide.id)) {
          showToast('Bu ürün zaten iade listesinde', 'error');
          return;
      }
      const lastPrice = findLastPriceForPesticide(pesticide.id);
      setReturnItems([...returnItems, {
          pesticideId: pesticide.id,
          pesticideName: pesticide.name,
          quantity: 1,
          unitPrice: lastPrice
      }]);
      setReturnSearchTerm('');
  };

  const handleSaveReturn = async () => {
      if (!selectedFarmer || returnItems.length === 0) return;
      setIsSavingReturn(true);
      try {
          const totalAmount = returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
          const prescriptionData = {
              farmerId: selectedFarmer.id,
              date: new Date().toISOString(),
              engineerName: userProfile.fullName,
              type: 'RETURN' as const,
              items: returnItems.map(item => ({
                  pesticideId: item.pesticideId,
                  pesticideName: item.pesticideName,
                  dosage: 'İade',
                  quantity: item.quantity.toString(),
                  unitPrice: item.unitPrice,
                  totalPrice: -(item.quantity * item.unitPrice),
                  priceType: 'CASH' as const
              })),
              isOfficial: false,
              totalAmount: -totalAmount,
              isProcessed: false,
              isInventoryProcessed: false
          };
          
          const id = await addPrescription(prescriptionData);
          
          showToast('İade başarıyla kaydedildi', 'success');
          hapticFeedback('success');
          setIsReturnModalOpen(false);
          setReturnItems([]);
          await loadFarmerDetails();
      } catch (error) {
          showToast('İade kaydedilirken hata oluştu', 'error');
      } finally {
          setIsSavingReturn(false);
      }
  };

  const handleEditPayment = (payment: Payment) => {
      setEditingPayment(payment);
      setPaymentAmount(payment.amount.toString());
      setPaymentNote(payment.note || '');
      setSelectedAccountId(payment.accountId || '');
      setIsPaymentModalOpen(true);
  };

  const handleSaveManualDebt = async () => {
      if (!selectedFarmer || !debtAmount) return;
      setIsSavingDebt(true);
      try {
          const parsedAmount = parseFloatSafe(debtAmount);
          if (editingManualDebt) {
              await updateManualDebt({
                  ...editingManualDebt,
                  amount: parsedAmount,
                  date: new Date(debtDate).toISOString(),
                  note: debtNote
              });
              showToast('Borç güncellendi', 'success');
          } else {
              await addManualDebt({
                  farmerId: selectedFarmer.id,
                  amount: parsedAmount,
                  date: new Date(debtDate).toISOString(),
                  note: debtNote,
                  createdById: activeTeamMember?.id
              });
              showToast('Borç kaydedildi', 'success');
          }
          hapticFeedback('success');
          setIsManualDebtModalOpen(false);
          setEditingManualDebt(null);
          setDebtAmount('');
          setDebtNote('');
          setDebtDate(new Date().toISOString().split('T')[0]);
          await loadFarmerDetails();
      } catch (e) {
          showToast('İşlem başarısız', 'error');
      } finally {
          setIsSavingDebt(false);
      }
  };

  const handleEditManualDebt = (debt: ManualDebt) => {
      setEditingManualDebt(debt);
      setDebtAmount(debt.amount.toString());
      setDebtNote(debt.note || '');
      setDebtDate(new Date(debt.date).toISOString().split('T')[0]);
      setIsManualDebtModalOpen(true);
  };

  const handleDeleteManualDebt = async (id: string) => {
      setConfirmModal({
          isOpen: true,
          title: 'Borç Kaydı Silinecek',
          message: 'Bu borç kaydını silmek istediğinize emin misiniz?',
          onConfirm: async () => {
              await deleteManualDebt(id);
              showToast('Borç kaydı silindi', 'success');
              hapticFeedback('medium');
              setIsManualDebtModalOpen(false);
              setEditingManualDebt(null);
              await loadFarmerDetails();
          }
      });
  };

  const handleReportWhatsAppText = () => {
      if (!selectedFarmer) return;
      
      let text = `*CARİ HESAP EKSTRESİ*\n`;
      text += `Sayın *${selectedFarmer.fullName}*,\n\n`;
      text += `Dönem: ${reportStartDate ? new Date(reportStartDate).toLocaleDateString('tr-TR') : 'Başlangıç'} - ${reportEndDate ? new Date(reportEndDate).toLocaleDateString('tr-TR') : 'Güncel'}\n\n`;
      
      reportItems.forEach(item => {
          const date = new Date(item.date).toLocaleDateString('tr-TR');
          const amount = (item as any).amount || (item as any).totalAmount;
          const desc = (item as any).note ? ` - ${(item as any).note}` : '';
          text += `${date} | ${item.label}${desc}: *${item.type === 'DEBT' ? '-' : item.type === 'CASH' ? '' : '+'}${formatCurrency(amount, userProfile?.currency || 'TRY')}*\n`;
      });

      text += `\n*TOPLAM DURUM:*\n`;
      text += `Toplam Alış: *${formatCurrency(reportTotalDebt, userProfile?.currency || 'TRY')}*\n`;
      text += `Toplam Ödeme: *${formatCurrency(reportTotalPaid, userProfile?.currency || 'TRY')}*\n`;
      text += `*KALAN BAKİYE: ${formatCurrency(Math.abs(reportBalance), userProfile?.currency || 'TRY')} ${reportBalance >= 0 ? 'ALACAK' : 'BORÇ'}*\n`;
      
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
          
          // Türkçe karakterleri temizle ve ASCII'ye çevir
          const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
          const safeName = selectedFarmer.fullName
            .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
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

  const handleSendDebtReminder = () => {
      if (!selectedFarmer) return;
      
      const debtAmount = Math.abs(overallBalance);
      const formattedDebt = formatCurrency(debtAmount, (userProfile?.currency as any) || 'TRY');
      
      const baseUrl = window.location.origin + window.location.pathname;
      const portalPath = baseUrl.endsWith('/') ? baseUrl + 'portal.html' : baseUrl.replace(/\/[^\/]*$/, '/portal.html');
      const url = new URL(portalPath);
      url.searchParams.set('portalId', selectedFarmer.id);
      url.searchParams.set('engineerId', currentUser?.uid || '');
      const portalUrl = url.toString();
      
      let text = `Sayın *${selectedFarmer.fullName}*,\n\n`;
      text += `Güncel hesap bakiyeniz *${formattedDebt}* borç bakiyesi vermektedir.\n\n`;
      text += `Detaylı hesap ekstrenizi, aldığınız ürünleri ve ödemelerinizi size özel ${farmerLabel.toLowerCase()} portalınızdan inceleyebilirsiniz:\n\n`;
      text += `🔗 *Portal Linkiniz:*\n${portalUrl}\n\n`;
      text += `İyi çalışmalar dileriz.`;
      
      const waUrl = `https://wa.me/${selectedFarmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
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
      setConfirmModal({
          isOpen: true,
          title: 'Ödeme Kaydı Silinecek',
          message: 'Bu ödeme kaydını silmek istediğinize emin misiniz?',
          onConfirm: async () => {
              await removePayment(id);
              showToast('Ödeme kaydı silindi', 'success');
          }
      });
  };

  const handleDeleteFarmer = async (farmerToMaybeDelete?: Farmer) => {
      const targetFarmer = farmerToMaybeDelete || selectedFarmer;
      if (!targetFarmer) return;

      // Find the farmer in our calculated list to get the balance
      const farmerInfo = farmersWithDebt.find(f => f.id === targetFarmer.id);
      const balance = farmerInfo?.overallBalance || 0;
      const hasRecords = farmerPrescriptions.length > 0 || farmerManualDebts.length > 0 || farmerPayments.length > 0;

      let warningMessage = `Bu ${farmerLabel.toLowerCase()}yi ve tüm kayıtlarını silmek istediğinize emin misiniz?`;
      
      if (Math.abs(balance) > 0.01) {
          showToast(`Bakiyesi olan ${farmerLabel.toLowerCase()} silinemez. Lütfen önce bakiyeyi sıfırlayın.`, 'error');
          return;
      } else if (hasRecords) {
          warningMessage = `Bu ${farmerLabel.toLowerCase()}ye ait geçmiş işlem kayıtları bulunmaktadır. Silme işlemi tüm bu kayıtları da silecektir. Devam etmek istiyor musunuz?`;
      }

      setConfirmModal({
          isOpen: true,
          title: `${farmerLabel} Silinecek`,
          message: warningMessage,
          onConfirm: async () => {
              await softDeleteFarmer(targetFarmer.id); 
              showToast(`${farmerLabel} kaydı silindi`, 'success');
              hapticFeedback('medium');
              if (selectedFarmer?.id === targetFarmer.id) {
                  changeFarmerSelection(null); 
              }
              await loadFarmers();
          }
      });
  };

  const farmersWithDebt = useMemo(() => {
    return farmers.map(farmer => {
      const fPayments = payments.filter(p => p.farmerId === farmer.id);
      const fMyPayments = myPayments.filter(p => p.farmerId === farmer.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId);
      const fPrescriptions = prescriptions.filter(p => p.farmerId === farmer.id);
      const fManualDebts = manualDebts.filter(d => d.farmerId === farmer.id);
      
      const totalPaid = fPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0) + 
                       fMyPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const totalDebt = fPrescriptions.filter(p => p.priceType !== 'CASH').reduce((acc, p) => {
        const amt = Number(p.totalAmount) || 0;
        const isReturn = p.type === 'RETURN';
        // If it's a return, it should decrease the debt. 
        // We assume totalAmount for returns is already negative or we handle the sign.
        // To be safe, for returns we subtract the absolute amount or just use the raw amount if the system stores it negative.
        return acc + (isReturn ? -Math.abs(amt) : Math.abs(amt));
      }, 0) + 
      fManualDebts.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
      
      const overallBalance = totalPaid - totalDebt;
      return { ...farmer, overallBalance };
    }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr-TR'));
  }, [farmers, payments, myPayments, prescriptions, manualDebts]);

  const filteredFarmers = farmersWithDebt.filter(f => f.fullName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) || f.village.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')));

  const downloadFarmersPdf = () => {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Ciftci Cari Listesi", 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 28);

      const trToEn = (str: string) => {
          if (!str) return '';
          return str.replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
              .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');
      };
      
      const pdfCurrency = (amount: number) => {
          return new Intl.NumberFormat('en-US', { style: 'currency', currency: userProfile?.currency || 'TRY' })
              .format(amount)
              .replace('TRY', 'TL')
              .replace('₺', 'TL');
      };

      const tableData = farmersWithDebt.map(f => [
          trToEn(f.fullName),
          f.phoneNumber,
          trToEn(f.village),
          `${pdfCurrency(Math.abs(f.overallBalance || 0))} ${f.overallBalance && f.overallBalance > 0 ? 'ALACAK' : 'BORC'}`
      ]);

      (doc as any).autoTable({
          startY: 35,
          head: [['Ad Soyad', 'Telefon', 'Koy', 'Bakiye']],
          body: tableData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [16, 185, 129] } // Emerald 500
      });

      doc.save('Ciftci_Cari_Listesi.pdf');
  };

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

  // --- DETAIL VIEW ---
  if (selectedFarmer) {
     if (selectedPrescription) {
         return (
            <div className="pb-24 animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-3 border-b border-white/5">
                    <button onClick={() => setSelectedPrescription(null)} className="flex items-center text-stone-400 hover:text-stone-200 font-medium px-2 py-1 -ml-2 rounded-lg hover:bg-white/5 transition-colors text-xs">
                        <ChevronLeft className="mr-1" size={18}/> Cariye Dön
                    </button>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => onEditPrescription(selectedPrescription.id)}
                            className="flex items-center px-3 py-1.5 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-700 transition-all active:scale-95"
                        >
                            <Edit2 size={14} className="mr-1.5" />
                            <span className="text-[10px] font-black uppercase tracking-wide">Düzenle</span>
                        </button>
                        <button 
                            onClick={() => {
                                setPrescriptionToDelete(selectedPrescription.id);
                                setIsDeleteModalOpen(true);
                            }}
                            className="flex items-center px-3 py-1.5 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:text-rose-400 hover:bg-stone-700 transition-all active:scale-95"
                        >
                            <Trash2 size={14} className="mr-1.5" />
                            <span className="text-[10px] font-black uppercase tracking-wide">Sil</span>
                        </button>
                    </div>
                </div>
                <div ref={receiptRef} className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm mx-auto relative overflow-hidden text-stone-900 mb-6 border border-stone-300 mt-2">
                    <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600"></div>
                    <div className="flex justify-between items-start mb-6 pt-2">
                        <div>
                            <h3 className="font-black text-lg text-stone-900 tracking-tight">
                                {selectedPrescription.totalAmount && selectedPrescription.totalAmount < 0 ? 'İADE MAKBUZU' : 'ZİRAİ FATURA'}
                            </h3>
                            <p className="text-[9px] text-stone-500 font-bold uppercase tracking-widest mt-1">No: {selectedPrescription.prescriptionNo}</p>
                            {(() => {
                                const fIds = selectedPrescription.fieldIds || (selectedPrescription.fieldId ? [selectedPrescription.fieldId] : []);
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
                            <p className="font-bold text-emerald-700 text-sm">{selectedFarmer.fullName}</p>
                            <p className="text-[9px] text-stone-500">{new Date(selectedPrescription.date).toLocaleDateString('tr-TR')}</p>
                        </div>
                    </div>
                    
                    <div className="min-h-[200px]">
                        {selectedPrescription.totalAmount && selectedPrescription.totalAmount !== 0 ? (
                            <table className="w-full text-xs">
                                <thead className="bg-stone-50 text-stone-500 uppercase text-[8px] font-black tracking-widest border-b border-stone-100">
                                    <tr>
                                        <th className="p-2 text-left w-[40%]">Ürün Adı</th>
                                        <th className="p-2 text-center w-[15%]">Adet</th>
                                        <th className="p-2 text-right w-[20%]">Birim Fiyat</th>
                                        <th className="p-2 text-right w-[25%]">Toplam</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {selectedPrescription.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="p-2">
                                                <div className="font-bold text-stone-800">{item.pesticideName}</div>
                                                <div className="text-[9px] text-stone-500 font-mono mt-0.5">Doz: {item.dosage}</div>
                                            </td>
                                            <td className="p-2 text-center font-bold text-stone-700">
                                                {item.quantity ? item.quantity.toString().replace(/^-/, '') : '-'}
                                            </td>
                                            <td className="p-2 text-right font-mono text-stone-600">
                                                {item.unitPrice ? formatCurrency(item.unitPrice, userProfile?.currency || 'TRY') : '-'}
                                            </td>
                                            <td className="p-2 text-right font-mono font-bold text-stone-800">
                                                {item.totalPrice ? formatCurrency(Math.abs(item.totalPrice), userProfile?.currency || 'TRY') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-stone-50/50 border-t border-stone-200">
                                        <td colSpan={3} className="p-2 text-right font-bold text-stone-500 uppercase text-[9px] tracking-widest pt-3">
                                            {selectedPrescription.discountAmount && selectedPrescription.discountAmount > 0 ? 'Ara Toplam' : (selectedPrescription.totalAmount < 0 ? 'İade Toplamı' : `${prescriptionLabel} Toplamı`)}
                                        </td>
                                        <td className={`p-2 text-right font-black font-mono text-sm pt-3 ${selectedPrescription.discountAmount && selectedPrescription.discountAmount > 0 ? 'text-stone-500 line-through' : 'text-emerald-600'}`}>
                                            {formatCurrency(Math.abs((selectedPrescription.totalAmount || 0) + (selectedPrescription.discountAmount || 0)), userProfile?.currency || 'TRY')}
                                        </td>
                                    </tr>
                                    {selectedPrescription.discountAmount && selectedPrescription.discountAmount > 0 && (
                                        <>
                                            <tr className="bg-stone-50/50">
                                                <td colSpan={3} className="p-2 text-right font-bold text-rose-500 uppercase text-[9px] tracking-widest pt-1">
                                                    İskonto (İndirim)
                                                </td>
                                                <td className="p-2 text-right font-black text-rose-500 font-mono text-sm pt-1">
                                                    -{formatCurrency(selectedPrescription.discountAmount, userProfile?.currency || 'TRY')}
                                                </td>
                                            </tr>
                                            <tr className="bg-stone-100 border-t border-stone-200">
                                                <td colSpan={3} className="p-2 text-right font-bold text-emerald-700 uppercase text-[10px] tracking-widest pt-2 pb-2">
                                                    İndirimli Tutar
                                                </td>
                                                <td className="p-2 text-right font-black text-emerald-700 font-mono text-lg pt-2 pb-2">
                                                    {formatCurrency(Math.abs(selectedPrescription.totalAmount || 0), userProfile?.currency || 'TRY')}
                                                </td>
                                            </tr>
                                        </>
                                    )}
                                </tfoot>
                            </table>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-stone-50 text-stone-500 uppercase text-[8px] font-black tracking-widest">
                                    <tr>
                                        <th className="p-2 text-left rounded-l-lg">Ürün / İlaç Adı</th>
                                        <th className="p-2 text-right rounded-r-lg">Uygulama Dozajı</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {selectedPrescription.items.map((item, idx) => (
                                        <tr key={idx} className="group">
                                            <td className="p-2 font-bold text-stone-800">
                                                {item.pesticideName}
                                                {item.quantity && (
                                                    <span className="ml-1 text-stone-500 font-bold text-[9px] bg-stone-100 px-1.5 py-0.5 rounded-full">
                                                        {item.quantity.toString().replace(/^-/, '')} Adet
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2 text-right font-mono font-bold text-emerald-600">{item.dosage}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <div className="mt-8 pt-4 border-t-2 border-dashed border-stone-100 flex justify-between items-end">
                        <div className="text-[7px] text-stone-400 leading-relaxed">
                            Bu belge Mühendis Kayıt Sistemi<br/>
                            tarafından oluşturulmuştur.<br/>
                            <strong>MKS v3.1.2</strong>
                        </div>
                        <div className="text-center">
                            <div className="font-serif italic text-sm text-blue-900 mb-1">{selectedPrescription.engineerName}</div>
                            <div className="text-[7px] text-stone-400 uppercase tracking-widest border-t border-stone-200 pt-1 font-bold">Dijital Onay / Kaşe</div>
                        </div>
                    </div>
                </div>
                
                {/* ACTION BUTTONS */}
                <div className="max-w-sm mx-auto flex gap-2 mt-4">
                    <button 
                        onClick={() => handlePdfAction('SHARE')} 
                        disabled={isProcessingPdf} 
                        className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold shadow-xl shadow-emerald-900/30 hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                    >
                        {isProcessingPdf ? <Loader2 size={16} className="animate-spin mr-2"/> : <Share2 size={16} className="mr-2"/>} 
                        WhatsApp PDF
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

                <ConfirmationModal 
                    isOpen={isDeleteModalOpen}
                    onClose={() => { setIsDeleteModalOpen(false); setPrescriptionToDelete(null); }}
                    onConfirm={async () => {
                        if (prescriptionToDelete) {
                            await softDeletePrescription(prescriptionToDelete);
                            showToast(`${prescriptionLabel} silindi`, 'info');
                            hapticFeedback('medium');
                            setSelectedPrescription(null);
                            setPrescriptionToDelete(null);
                        }
                    }}
                    title={`${prescriptionLabel} Silinecek`}
                    message={t('prescription.delete_confirm', { label: prescriptionLabel.toLowerCase() }) || `Bu ${prescriptionLabel.toLowerCase()}yi silmek istediğinize emin misiniz?`}
                />
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
                    <div className="relative mt-4 mb-4 drop-shadow-[0_10px_20px_rgba(0,0,0,0.1)] w-[210mm] mx-auto min-w-[210mm]">
                        <div ref={reportRef} className="bg-[#fdfdfc] px-8 pt-10 pb-6 rounded-t-xl text-left relative overflow-hidden text-stone-800">
                            {/* Subtle noise/texture overlay for paper effect */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

                            {/* Top Edge Band */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-blue-600"></div>

                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div>
                                    <h1 className="text-3xl font-black uppercase tracking-tight mb-1">Cari Hesap Raporu</h1>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{selectedFarmer.fullName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold mb-1 text-stone-600">
                                        Dönem: {reportStartDate ? new Date(reportStartDate).toLocaleDateString('tr-TR') : 'Başlangıç'} - {reportEndDate ? new Date(reportEndDate).toLocaleDateString('tr-TR') : 'Güncel'}
                                    </p>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">
                                        Tür: {reportType === 'DETAILED' ? 'Detaylı (Ürün İçerikli)' : 'Özet (Fatura Bilgileri)'}
                                    </p>
                                    {reportFieldId !== 'ALL' && (
                                        <p className="text-xs font-bold text-blue-600 mt-2 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                            Filtre: {selectedFarmer.fields.find(f => f.id === reportFieldId)?.name} Tarlası
                                        </p>
                                    )}
                                    {reportCrop !== 'ALL' && (
                                        <p className="text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                                            Filtre: {reportCrop} Ürünü
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="relative z-10">
                                <table className="w-full mb-10">
                                    <thead className="text-stone-400 uppercase text-[9px] font-black tracking-widest border-b-2 border-stone-200">
                                        <tr className="text-left">
                                            <th className="pb-3 w-[15%]">Tarih</th>
                                            <th className="pb-3 w-[20%]">İşlem</th>
                                            <th className="pb-3 w-[25%]">Açıklama</th>
                                            <th className="pb-3 text-right w-[20%]">Borç</th>
                                            <th className="pb-3 text-right w-[20%]">Alacak</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportItems.map((item, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr className="border-b border-stone-100/60">
                                                    <td className="py-3 text-xs font-mono text-stone-500">{new Date(item.date).toLocaleDateString('tr-TR')}</td>
                                                    <td className="py-3 text-[11px] font-bold uppercase tracking-wide text-stone-700">{item.label}</td>
                                                    <td className="py-3 text-xs text-stone-500">{(item as any).note || (item.type === 'CASH' ? `Tutar: ${formatCurrency(Math.abs((item as any).amount || (item as any).totalAmount), userProfile?.currency || 'TRY')}` : '-')}</td>
                                                    <td className="py-3 text-sm text-right font-bold font-mono text-rose-600">
                                                        {item.type === 'DEBT' && ((item as any).totalAmount >= 0 || (item as any).amount >= 0) ? formatCurrency((item as any).amount || (item as any).totalAmount, userProfile?.currency || 'TRY') : '-'}
                                                    </td>
                                                    <td className="py-3 text-sm text-right font-bold font-mono text-emerald-600">
                                                        {item.type === 'PAYMENT' ? formatCurrency((item as any).amount, userProfile?.currency || 'TRY') : (item.type === 'DEBT' && (item as any).totalAmount < 0 ? formatCurrency(Math.abs((item as any).totalAmount), userProfile?.currency || 'TRY') : '-')}
                                                    </td>
                                                </tr>
                                                {reportType === 'DETAILED' && (item as any).items && (
                                                    <tr>
                                                        <td colSpan={5} className="bg-stone-50/50 p-0 border-b border-stone-200">
                                                            <div className="px-6 py-3 ml-8 border-l-2 border-stone-200/50">
                                                                <table className="w-full text-[10px]">
                                                                    <thead className="text-stone-400 uppercase font-bold tracking-widest text-[8px] border-b border-stone-200/50">
                                                                        <tr>
                                                                            <th className="text-left pb-1 w-[45%]">Ürün Adı</th>
                                                                            <th className="text-center pb-1 w-[20%]">Miktar</th>
                                                                            <th className="text-right pb-1 w-[15%]">B. Fiyat</th>
                                                                            <th className="text-right pb-1 w-[20%]">Toplam</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-stone-100/50">
                                                                        {(item as any).items.map((subItem: any, sIdx: number) => (
                                                                            <tr key={sIdx}>
                                                                                <td className="py-1.5 font-bold text-stone-700">{subItem.pesticideName}</td>
                                                                                <td className="py-1.5 text-center font-mono text-stone-500">{subItem.quantity} <span className="text-[8px]">{subItem.unit}</span></td>
                                                                                <td className="py-1.5 text-right font-mono text-stone-500">{formatCurrency(subItem.unitPrice || 0, userProfile?.currency || 'TRY')}</td>
                                                                                <td className="py-1.5 text-right font-bold font-mono text-stone-800">{formatCurrency((subItem.quantity || 0) * (subItem.unitPrice || 0), userProfile?.currency || 'TRY')}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="flex justify-end pt-4 border-t-2 border-dashed border-stone-300">
                                    <div className="w-80 space-y-2">
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Dönem Toplam Alış</span>
                                            <span className="text-sm font-bold font-mono text-rose-600">{formatCurrency(reportTotalDebt, userProfile?.currency || 'TRY')}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-stone-100/50 pb-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Dönem Toplam Ödeme</span>
                                            <span className="text-sm font-bold font-mono text-emerald-600">{formatCurrency(reportTotalPaid, userProfile?.currency || 'TRY')}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2">
                                            <span className="text-xs font-black text-stone-800 uppercase tracking-wider">Devreden Bakiye</span>
                                            <span className={`text-xl font-black font-mono tracking-tight ${reportBalance > 0 ? 'text-rose-600' : reportBalance < 0 ? 'text-emerald-600' : 'text-stone-800'}`}>
                                                {formatCurrency(Math.abs(reportBalance), userProfile?.currency || 'TRY')} {reportBalance > 0 ? '(B)' : reportBalance < 0 ? '(A)' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-12 pt-6 flex justify-between items-end">
                                    <div className="text-[9px] text-stone-400/80 font-mono leading-relaxed">
                                        Bu belge Mühendis Kayıt Sistemi<br/>
                                        tarafından oluşturulmuştur.<br/>
                                        <strong>v3.1.2</strong>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-serif italic text-lg text-blue-900/80 mb-1">{userProfile?.fullName || 'Yönetici'}</div>
                                        <div className="text-[8px] text-stone-400 uppercase tracking-widest border-t border-stone-200 pt-1.5 font-bold">Dijital Onay / Kaşe</div>
                                    </div>
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
                </div>

                {/* ACTION BUTTONS */}
                <div className="max-w-sm mx-auto flex gap-2 mt-4 px-4">
                    <button 
                        onClick={() => handleReportPdfAction('SHARE')} 
                        disabled={isGeneratingReport} 
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-xl shadow-blue-900/30 hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 text-xs"
                    >
                        {isGeneratingReport ? <Loader2 size={16} className="animate-spin mr-2"/> : <Share2 size={16} className="mr-2"/>} 
                        WhatsApp PDF
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
            {/* Compact Profile Card */}
            <div className="bg-stone-900/80 backdrop-blur rounded-3xl p-4 shadow-lg border border-white/5 mb-4 flex flex-col items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-emerald-900/10 to-transparent -z-10"></div>
                
                <div className="flex items-center space-x-3 w-full mb-4">
                    <button onClick={() => changeFarmerSelection(null)} className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-stone-200 transition-colors active:scale-90">
                        <ChevronLeft size={18}/>
                    </button>
                    <div className="w-12 h-12 bg-stone-800 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-xl font-black text-emerald-500 shadow-lg">
                        {selectedFarmer.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-base font-black text-stone-100 truncate tracking-tight">{selectedFarmer.fullName}</h2>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {canEditFarmer && (
                                    <button onClick={openEditModal} className="p-1.5 bg-stone-800/60 text-stone-400 rounded-lg hover:text-emerald-400 transition-all active:scale-90 border border-white/5">
                                        <Edit2 size={12} />
                                    </button>
                                )}
                                {canEditFarmer && (
                                    <button onClick={() => handleDeleteFarmer()} className="p-1.5 bg-stone-800/60 text-stone-400 rounded-lg hover:text-red-400 transition-all active:scale-90 border border-white/5">
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
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
                        { icon: Wallet, label: 'Borç Hatırlat', action: handleSendDebtReminder },
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

                <button 
                    onClick={handleCopyPortalLink}
                    className="w-full mt-3 py-2.5 bg-emerald-900/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-900/40 transition-colors"
                >
                    <Copy size={14} />
                    {farmerLabel} Portalı Linkini Kopyala
                </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-stone-900/60 backdrop-blur rounded-xl mb-2 border border-white/5 shadow-inner">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === tab.id ? 'bg-stone-700 text-white shadow-md' : 'text-stone-500 hover:text-stone-300'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Year Selector - Visible for relevant tabs */}
            {(activeTab === 'PRESCRIPTIONS' || activeTab === 'DEBT') && availableYears.length > 1 && (
                <div className="flex gap-1 overflow-x-auto no-scrollbar mb-4 py-1">
                    {availableYears.map(year => (
                        <button 
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shrink-0 ${selectedYear === year ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20' : 'bg-stone-900/50 text-stone-500 border-white/5 hover:text-stone-300'}`}
                        >
                            {year}
                        </button>
                    ))}
                </div>
            )}

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
                        {canEditFarmer && (
                            <div className="flex gap-2">
                                <button onClick={() => onNavigateToPrescription(selectedFarmer.id)} className="flex-1 py-3.5 bg-emerald-700 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center text-xs uppercase tracking-wider">
                                    <FileText className="mr-2" size={16}/> Yeni {prescriptionLabel} Yaz
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'DEBT' && (
                    <div className="space-y-3">
                        {/* Balance Card */}
                        <div className="bg-stone-900/80 backdrop-blur p-4 rounded-2xl border border-white/5 shadow-sm">
                            <div className="mb-4">
                                <div className="flex gap-1.5 w-full">
                                    <button onClick={() => setIsReportModalOpen(true)} className="flex-1 bg-blue-600 text-white px-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center">
                                        <Download size={10} className="mr-1"/> Rapor
                                    </button>
                                    {canEditFarmer && (
                                        <>
                                            <button onClick={() => setIsManualDebtModalOpen(true)} className="flex-1 bg-rose-600 text-white px-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center">
                                                <Plus size={10} className="mr-1"/> Borç
                                            </button>
                                            <button onClick={() => setIsPaymentModalOpen(true)} className="flex-1 bg-emerald-600 text-white px-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center">
                                                <CreditCard size={10} className="mr-1"/> Tahsilat
                                            </button>
                                            <button onClick={() => setIsReturnModalOpen(true)} className="flex-1 bg-amber-600 text-white px-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center">
                                                <RefreshCcw size={10} className="mr-1"/> İade Al
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-stone-500 uppercase font-black mb-1">{selectedYear} Toplam Borç</p>
                                    <p className="text-lg font-black text-rose-500">{formatCurrency((yearTotalDebt + (openingBalance < 0 ? Math.abs(openingBalance) : 0)), userProfile?.currency || 'TRY')}</p>
                                </div>
                                <div className="bg-stone-950/50 p-3 rounded-xl border border-white/5">
                                    <p className="text-[8px] text-stone-500 uppercase font-black mb-1">{selectedYear} Toplam Ödeme</p>
                                    <p className="text-lg font-black text-emerald-500">{formatCurrency((yearTotalPaid + (openingBalance > 0 ? openingBalance : 0)), userProfile?.currency || 'TRY')}</p>
                                </div>
                            </div>

                            <div className={`p-4 rounded-xl border flex items-center justify-between ${yearBalance >= 0 ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-rose-900/20 border-rose-500/20'}`}>
                                <div>
                                    <p className="text-[9px] text-stone-400 uppercase font-black mb-0.5">{selectedYear} Sonu Bakiye</p>
                                    <p className={`text-xl font-black ${yearBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {formatCurrency(Math.round(Math.abs(yearBalance)), userProfile?.currency || 'TRY')}
                                        <span className="text-xs font-bold ml-1">{yearBalance >= 0 ? 'Alacaklı' : 'Borçlu'}</span>
                                    </p>
                                </div>
                                {yearBalance < 0 ? <TrendingDown size={24} className="text-rose-500 opacity-50" /> : <TrendingUpIcon size={24} className="text-emerald-500 opacity-50" />}
                            </div>
                        </div>

                        {/* History */}
                        <div className="bg-stone-900/80 backdrop-blur p-4 rounded-2xl border border-white/5 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-stone-200 text-xs flex items-center uppercase tracking-wider opacity-70"><History size={14} className="mr-1.5 text-blue-500"/> İşlem Geçmişi</h3>
                            </div>

                            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                {/* Opening Balance Row */}
                                {openingBalance !== 0 && (
                                    <div className="p-3 bg-emerald-900/10 rounded-xl border border-emerald-500/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-900/20 text-emerald-500 flex items-center justify-center">
                                                <RefreshCw size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-200">{selectedYear} Devir Bakiyesi</p>
                                                <p className="text-[8px] text-stone-500">01.01.{selectedYear}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xs font-black ${openingBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {openingBalance >= 0 ? '+' : ''}{formatCurrency(openingBalance, userProfile?.currency || 'TRY')}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {[
                                    ...filteredPrescriptions.map(p => ({ ...p, type: p.priceType === 'CASH' ? 'CASH' : 'DEBT', label: p.priceType === 'CASH' ? 'Peşin Satış' : ((p.totalAmount || 0) < 0 ? 'İade Makbuzu' : `${prescriptionLabel} Satışı`) })), 
                                    ...filteredPayments.map(p => ({ ...p, type: 'PAYMENT', label: 'Tahsilat' })),
                                    ...filteredManualDebts.filter(d => !d.id.startsWith('turnover-')).map(d => ({ ...d, type: 'DEBT', label: 'Manuel Borç' }))
                                ]
                                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((item, idx) => {
                                        const dueDate = getDueDate(item);
                                        const isOverdue = dueDate && new Date() > new Date(dueDate.replace('Haz', 'Jun').replace('Kas', 'Nov'));
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`p-3 ${item.label === 'İade Makbuzu' ? 'bg-emerald-900/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]' : 'bg-stone-950/50 border-white/5'} rounded-xl border flex items-center justify-between group relative cursor-pointer hover:bg-stone-900/80 active:scale-[0.98] transition-all`}
                                                onClick={() => {
                                                    if (item.label === `${prescriptionLabel} Satışı` || item.label === 'İade Makbuzu') {
                                                        const prescription = farmerPrescriptions.find(p => p.id === item.id);
                                                        if (prescription) setSelectedPrescription(prescription);
                                                    } else if (item.label === 'Manuel Borç') {
                                                        const debt = farmerManualDebts.find(d => d.id === item.id);
                                                        if (debt) handleEditManualDebt(debt);
                                                    } else if (item.label === 'Tahsilat') {
                                                        const payment = farmerPayments.find(p => p.id === item.id);
                                                        if (payment) handleEditPayment(payment);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'DEBT' ? ((item as any).totalAmount < 0 ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'bg-rose-900/20 text-rose-500') : item.type === 'CASH' ? 'bg-blue-900/20 text-blue-500' : 'bg-emerald-900/20 text-emerald-500'}`}>
                                                        {item.label === 'İade Makbuzu' ? <RefreshCcw size={14} /> : (item.type === 'DEBT' || item.type === 'CASH' ? <FileText size={14} /> : <CreditCard size={14} />)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-stone-200">{item.label}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-[8px] text-stone-500">{new Date(item.date).toLocaleDateString('tr-TR')}</p>
                                                            <span className="text-[7px] text-stone-400 font-bold flex items-center bg-stone-800/50 px-1 py-0.5 rounded">
                                                                <User size={8} className="mr-0.5" />
                                                                {(item as any).createdById ? (teamMembers.find(m => m.id === (item as any).createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                                            </span>
                                                        </div>
                                                        {dueDate && (
                                                            <p className={`text-[7px] font-bold mt-0.5 ${isOverdue ? 'text-rose-500 animate-pulse' : 'text-amber-500'}`}>
                                                                Vade: {dueDate}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-3">
                                                    <div>
                                                        <p className={`text-xs font-black ${item.type === 'DEBT' ? ((item as any).totalAmount < 0 ? 'text-emerald-400' : 'text-rose-400') : item.type === 'CASH' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                            {item.type === 'DEBT' ? ((item as any).totalAmount < 0 ? '+' : '-') : item.type === 'CASH' ? '' : '+'}{formatCurrency(Math.abs((item as any).amount || (item as any).totalAmount), userProfile?.currency || 'TRY')}
                                                        </p>
                                                        {(item as any).note && <p className="text-[7px] text-stone-500 italic truncate max-w-[60px]">{(item as any).note}</p>}
                                                    </div>
                                                    {item.type === 'PAYMENT' ? (
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                            <button onClick={(e) => { e.stopPropagation(); handleEditPayment(item as any); }} className="p-1 text-stone-500 hover:text-emerald-500">
                                                                <Edit2 size={12}/>
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeletePayment(item.id); }} className="p-1 text-stone-500 hover:text-rose-500 transition-all">
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        item.label === 'Manuel Borç' && (
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button onClick={(e) => { e.stopPropagation(); handleEditManualDebt(item as any); }} className="p-1 text-stone-500 hover:text-emerald-500">
                                                                    <Edit2 size={12}/>
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteManualDebt(item.id); }} className="p-1 text-stone-500 hover:text-rose-500">
                                                                    <Trash2 size={12}/>
                                                                </button>
                                                            </div>
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
                                    <div className="flex gap-1.5">{visit.photoUri && <ImageIcon size={12} className="text-blue-400"/>}</div>
                                    <div className="flex gap-1.5"><button onClick={() => onEditVisit(visit.id)} className="text-stone-500 hover:text-emerald-400"><Edit2 size={12}/></button><button onClick={() => handleDeleteVisit(visit.id)} className="text-stone-500 hover:text-red-400"><Trash2 size={12}/></button></div>
                                </div>
                            </div>
                        )) : <div className="text-center py-6 text-stone-600 text-[10px]">Kayıt yok.</div>}
                    </div>
                )}
                
                {activeTab === 'PRESCRIPTIONS' && (
                    <div className="space-y-2">
                         {isDataLoading ? <Loader2 size={20} className="animate-spin text-amber-500 mx-auto"/> : filteredPrescriptions.length > 0 ? filteredPrescriptions.map(p => (
                            <div key={p.id} onClick={() => setSelectedPrescription(p)} className="bg-stone-900/80 p-3 rounded-xl border border-white/5 hover:bg-stone-800 transition-colors cursor-pointer active:scale-98">
                                <div className="flex justify-between items-start mb-1.5">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-mono text-stone-500 block uppercase">No: {p.prescriptionNo}</span>
                                        {(p.totalAmount || 0) < 0 && (
                                            <span className="text-[7px] font-black text-emerald-500 bg-emerald-900/30 px-1 border border-emerald-500/30 rounded uppercase tracking-tighter w-fit">İADE</span>
                                        )}
                                    </div>
                                    <span className={`text-[9px] font-bold ${(p.totalAmount || 0) < 0 ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/30' : 'text-amber-400 bg-amber-900/20 border-amber-800/30'} px-1.5 py-0.5 rounded border`}>{new Date(p.date).toLocaleDateString('tr-TR')}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">{p.items.map((item, idx) => (<span key={idx} className="text-[8px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded flex items-center"><FlaskConical size={8} className="mr-1 text-stone-500"/>{item.pesticideName}</span>))}</div>
                            </div>
                        )) : <div className="text-center py-6 text-stone-600 text-[10px]">{prescriptionLabel} yok.</div>}
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
                farmerLabel={farmerLabel}
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
                                <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Ödeme Tutarı ({getCurrencySymbol(userProfile?.currency || 'TRY')})</label>
                                <input 
                                    type="number" 
                                    value={paymentAmount} 
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    className="w-full p-3.5 bg-stone-950 border border-stone-800 rounded-2xl outline-none font-black text-emerald-500 text-xl focus:border-emerald-500/50 transition-all text-center" 
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Ödeme Yöntemi</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'CASH', label: 'Nakit' },
                                        { id: 'CHECK', label: 'Çek' },
                                        { id: 'TEDYE', label: 'Tediye' }
                                    ].map(method => (
                                        <button 
                                            key={method.id}
                                            onClick={() => setPaymentMethod(method.id as any)}
                                            className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${paymentMethod === method.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-stone-950 border-stone-800 text-stone-500'}`}
                                        >
                                            {method.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') && (
                                <div className="animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Vade Tarihi</label>
                                    <div className="relative">
                                        <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                                        <input 
                                            type="date" 
                                            className="w-full h-[46px] bg-stone-950 border border-stone-800 rounded-2xl pl-10 pr-4 text-xs text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Hesap Seçin</label>
                                <select 
                                    value={selectedAccountId}
                                    onChange={e => setSelectedAccountId(e.target.value)}
                                    className="w-full h-[46px] px-4 bg-stone-950 border border-stone-800 rounded-2xl outline-none text-stone-200 text-xs focus:border-emerald-500/50 transition-all"
                                >
                                    <option value="">Hesap Seçilmedi</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: userProfile?.currency || 'TRY' }).format(acc.balance)})</option>
                                    ))}
                                </select>
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

            {/* Return Modal */}
            {isReturnModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-stone-900 rounded-3xl w-full max-w-lg p-5 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <button onClick={() => setIsReturnModalOpen(false)} className="absolute top-3 right-3 p-1.5 bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 z-10"><X size={16} /></button>
                        <div className="text-center mb-4 shrink-0">
                            <div className="w-12 h-12 bg-amber-900/30 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <RefreshCcw size={24} />
                            </div>
                            <h2 className="text-base font-bold text-stone-100">İade Al</h2>
                            <p className="text-[10px] text-stone-500 mt-1">{selectedFarmer?.fullName}</p>
                        </div>
                        
                        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                            {/* Product Search */}
                            <div>
                                <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">Ürün Ara</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
                                    <input 
                                        type="text" 
                                        value={returnSearchTerm} 
                                        onChange={e => setReturnSearchTerm(e.target.value)}
                                        className="w-full p-3 bg-stone-950 border border-stone-800 rounded-xl outline-none text-stone-200 text-xs pl-10 focus:border-amber-500/50 transition-all" 
                                        placeholder="İade edilecek ürünü arayın..."
                                    />
                                </div>
                                {returnSearchTerm.length > 1 && (
                                    <div className="mt-2 bg-stone-950 border border-stone-800 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                                        {inventory.filter(p => p.pesticideName.toLocaleLowerCase('tr-TR').includes(returnSearchTerm.toLocaleLowerCase('tr-TR'))).map(p => (
                                            <button 
                                                key={p.pesticideId} 
                                                onClick={() => handleAddReturnItem({ id: p.pesticideId, name: p.pesticideName, activeIngredient: '', defaultDosage: '', category: p.category })}
                                                className="w-full text-left p-3 hover:bg-stone-900 text-stone-300 text-xs border-b border-stone-800/50 last:border-0"
                                            >
                                                {p.pesticideName}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Return Items */}
                            {returnItems.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">İade Edilecek Ürünler</label>
                                    {returnItems.map((item, index) => (
                                        <div key={item.pesticideId} className="bg-stone-950 p-3 rounded-xl border border-stone-800 flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-stone-200 truncate">{item.pesticideName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex items-center bg-stone-900 rounded-lg overflow-hidden border border-stone-800">
                                                        <button onClick={() => {
                                                            const newItems = [...returnItems];
                                                            newItems[index].quantity = Math.max(0, newItems[index].quantity - 1);
                                                            setReturnItems(newItems);
                                                        }} className="px-2 py-1 text-stone-400 hover:text-white">-</button>
                                                        <input 
                                                            type="number"
                                                            step="any"
                                                            value={item.quantity}
                                                            onChange={e => {
                                                                const newItems = [...returnItems];
                                                                newItems[index].quantity = parseFloat(e.target.value.replace(',', '.')) || 0;
                                                                setReturnItems(newItems);
                                                            }}
                                                            className="w-12 bg-transparent text-xs font-bold text-stone-200 text-center outline-none"
                                                        />
                                                        <button onClick={() => {
                                                            const newItems = [...returnItems];
                                                            newItems[index].quantity += 1;
                                                            setReturnItems(newItems);
                                                        }} className="px-2 py-1 text-stone-400 hover:text-white">+</button>
                                                    </div>
                                                    <span className="text-[10px] text-stone-500">x</span>
                                                    <input 
                                                        type="number"
                                                        value={item.unitPrice}
                                                        onChange={e => {
                                                            const newItems = [...returnItems];
                                                            newItems[index].unitPrice = parseFloat(e.target.value.replace(',', '.')) || 0;
                                                            setReturnItems(newItems);
                                                        }}
                                                        className="w-20 bg-stone-900 border border-stone-800 rounded-lg px-2 py-1 text-xs text-stone-200 outline-none focus:border-amber-500/50"
                                                    />
                                                    <span className="text-[10px] text-stone-500">{userProfile?.currency || 'TRY'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-black text-amber-500">{formatCurrency(item.quantity * item.unitPrice, userProfile?.currency || 'TRY')}</p>
                                                <button onClick={() => setReturnItems(returnItems.filter((_, i) => i !== index))} className="text-[10px] text-rose-500 hover:text-rose-400 mt-1 uppercase font-bold">Kaldır</button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-3 border-t border-stone-800 flex justify-between items-center">
                                        <span className="text-xs font-bold text-stone-400 uppercase">Toplam İade Tutarı</span>
                                        <span className="text-lg font-black text-amber-500">
                                            {formatCurrency(returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0), userProfile?.currency || 'TRY')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="shrink-0 pt-4 mt-2 border-t border-white/5">
                            <button 
                                onClick={handleSaveReturn}
                                disabled={isSavingReturn || returnItems.length === 0}
                                className="w-full bg-amber-700 text-white py-3.5 rounded-2xl font-bold text-xs shadow-xl shadow-amber-900/20 flex justify-center items-center active:scale-95 transition-all border border-amber-500/20 disabled:opacity-50"
                            >
                                {isSavingReturn ? <Loader2 size={18} className="animate-spin" /> : 'İadeyi Onayla'}
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
                            <h2 className="text-sm font-bold text-stone-100 flex items-center">
                                {editingManualDebt ? <Edit2 className="mr-2 text-emerald-500" size={16}/> : <Plus className="mr-2 text-rose-500" size={16}/>} 
                                {editingManualDebt ? 'Borç Düzenle' : 'Borç Ekle'}
                            </h2>
                            <div className="flex items-center gap-2">
                                {editingManualDebt && (
                                    <button onClick={() => handleDeleteManualDebt(editingManualDebt.id)} className="text-stone-500 hover:text-rose-500 transition-colors p-1" title="Sil">
                                        <Trash2 size={16}/>
                                    </button>
                                )}
                                <button onClick={() => { setIsManualDebtModalOpen(false); setEditingManualDebt(null); }} className="text-stone-500 hover:text-stone-300 p-1"><X size={18}/></button>
                            </div>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Tarih</label>
                                <input type="date" value={debtDate} onChange={(e) => setDebtDate(e.target.value)} className="w-full bg-stone-950 border border-white/10 rounded-xl px-4 py-3 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Tutar ({getCurrencySymbol(userProfile?.currency || 'TRY')})</label>
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
                            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
                                {availableYears.map(year => (
                                    <button 
                                        key={year}
                                        onClick={() => {
                                            setReportStartDate(`${year}-01-01`);
                                            setReportEndDate(`${year}-12-31`);
                                        }}
                                        className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-[10px] font-bold border border-white/5 whitespace-nowrap active:scale-95 transition-all"
                                    >
                                        {year} Yılı
                                    </button>
                                ))}
                            </div>
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
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Rapor Türü</label>
                                    <select 
                                        value={reportType} 
                                        onChange={(e) => setReportType(e.target.value as any)}
                                        className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500"
                                    >
                                        <option value="SUMMARY">Özet (Sadece Fatura)</option>
                                        <option value="DETAILED">Detaylı (Ürün İçerikli)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Ürün Filtresi</label>
                                    <select 
                                        value={reportCrop} 
                                        onChange={(e) => {
                                            setReportCrop(e.target.value);
                                            if (e.target.value !== 'ALL') setReportFieldId('ALL');
                                        }}
                                        className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500"
                                    >
                                        <option value="ALL">Tüm Ürünler</option>
                                        {availableCrops.map(crop => (
                                            <option key={crop} value={crop}>{crop}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-stone-500 uppercase mb-1.5 block">Tarla Filtresi</label>
                                    <select 
                                        value={reportFieldId} 
                                        onChange={(e) => {
                                            setReportFieldId(e.target.value);
                                            if (e.target.value !== 'ALL') setReportCrop('ALL');
                                        }}
                                        className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-stone-100 text-xs outline-none focus:border-blue-500"
                                    >
                                        <option value="ALL">Tüm Tarlalar</option>
                                        {selectedFarmer?.fields.map(field => (
                                            <option key={field.id} value={field.id}>{field.name} ({field.crop})</option>
                                        ))}
                                    </select>
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
          <div className="flex items-center gap-3">
              <button onClick={onBack} className="flex items-center text-stone-400 hover:text-stone-200 font-medium py-1 rounded-lg transition-colors text-xs"><ArrowLeft size={16} className="mr-1"/> Geri</button>
              <button 
                  onClick={downloadFarmersPdf}
                  className="py-1.5 px-3 bg-amber-600 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-900/20"
              >
                  <FileText size={14} />
                  Raporla
              </button>
          </div>
          <div className="text-right">
              <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block">{farmers.length} {farmerLabel}</span>
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
             <input type="text" placeholder={`${farmerLabel} adı veya köy ara...`} className="w-full p-2 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-[11px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         </div>
      </div>

      <div className="space-y-1">
        {isLoading ? (
            <ListSkeleton count={8} />
        ) : filteredFarmers.length === 0 ? (
            <EmptyState
                icon={User}
                title={searchTerm ? t('farmer.empty_search', { label: farmerLabel.toLowerCase() }) : t('farmer.empty_list', { label: farmerLabel.toLowerCase() })}
                description={!searchTerm ? t('farmer.empty_hint', { label: farmerLabel.toLowerCase() }) : ''}
                actionLabel={canCreateFarmer && !searchTerm ? `Yeni ${farmerLabel} Ekle` : undefined}
                onAction={canCreateFarmer && !searchTerm ? () => toggleModal(true) : undefined}
                actionIcon={Plus}
            />
        ) : filteredFarmers.map(farmer => (
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
                <div className="flex items-center space-x-3">
                    <div className="text-right">
                        <div className={`text-xs font-bold ${farmer.overallBalance && farmer.overallBalance < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {formatCurrency(Math.abs(farmer.overallBalance || 0), userProfile?.currency || 'TRY')}
                        </div>
                        <div className="text-[8px] text-stone-500 uppercase tracking-wider">
                            {farmer.overallBalance && farmer.overallBalance < 0 ? 'Borç' : 'Alacak'}
                        </div>
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${farmer.phoneNumber}`);
                        }}
                        className="p-1.5 bg-stone-800/50 hover:bg-emerald-900/30 text-stone-400 hover:text-emerald-400 rounded-lg transition-colors border border-white/5"
                    >
                        <Phone size={12} />
                    </button>
                    <div className="bg-stone-800/50 p-1 rounded-lg text-stone-600 group-hover:text-emerald-400 transition-colors"><ChevronRight size={12} /></div>
                </div>
            </div>
        ))}
        {filteredFarmers.length === 0 && <div className="text-center py-10"><User size={28} className="mx-auto mb-2 text-stone-700"/><p className="text-stone-500 text-[10px]">Kayıt yok.</p></div>}
      </div>

      {canCreateFarmer && (
          <button onClick={() => { setModalMode('ADD'); toggleModal(true); }} className="fixed bottom-32 right-5 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center gap-2 font-bold text-sm">
            <Plus size={22} /> Yeni Cari
          </button>
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
        onDelete={handleDeleteFarmer}
        farmerLabel={farmerLabel}
      />

      <DebtReminderModal
        isOpen={isDebtReminderModalOpen}
        onClose={() => setIsDebtReminderModalOpen(false)}
        farmersWithDebt={farmersWithDebt}
        currency={(userProfile?.currency as 'TRY' | 'USD' | 'EUR') || 'TRY'}
        farmerLabel={farmerLabel}
        engineerId={currentUser?.uid || ''}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />

    </div>
  );
};

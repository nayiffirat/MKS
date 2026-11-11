import { createMultiPagePdf, renderElementToCanvas } from '../utils/pdfHelper';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ContactService, ContactInfo } from '../services/contact';
import { Farmer, Field, VisitLog, Prescription, ManualDebt, Payment, Pesticide, CardSettlementOption } from '../types';
import { COMMON_CROPS, CROP_PESTICIDE_COSTS, DEFAULT_PESTICIDE_COST, CROP_AGRONOMY_INTEL, DEFAULT_AGRONOMY } from '../constants';
import { Search, Phone, MessageCircle, MapPin, Wheat, ChevronLeft, ChevronRight, Contact, Loader2, User, Ruler, FileText, Calendar, Navigation, Plus, X, ArrowLeft, Edit2, Trash2, CheckSquare, Square, Check, FlaskConical, Clock, ImageIcon, Upload, AlertCircle, MessageSquare, Share2, Save, Download, FileJson, RefreshCw, RefreshCcw, Wallet, History, CreditCard, TrendingDown, TrendingUp as TrendingUpIcon, Send, Copy, ClipboardList, AlertTriangle, Sprout, Info, Scale, ShieldAlert, ShieldCheck, Hammer, ClipboardCheck, CheckCircle2, Satellite, Megaphone, Split } from 'lucide-react';
import { renderWhatsAppTemplate, normalizeWaPhone, DEFAULT_WHATSAPP_TEMPLATES } from '../utils/whatsappTemplates';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import {
  computeFarmerLedgerTotals,
  computeFifoUnpaidDebtAgeDays,
  getBouncedRelatedPaymentIds,
  getIndependentFarmerMyPayments
} from '../utils/ledger';
import { validateTcOrVkn } from '../utils/tcNoValidator';

const escapeHtml = (val: unknown): string =>
  String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { DebtReminderModal } from './DebtReminderModal';
import { FarmerFinancialAnalysisModal } from './FarmerFinancialAnalysisModal';
import { turkishMatchesAny } from '../utils/search';
import { useBackHandler, useScrollLock } from '../utils/navigationManager';
import { generatePortalToken } from '../utils/crypto';
import { buildPublicPortalUrl } from '../utils/api';
import { FarmerModal } from './farmers/FarmerFormModal';
import { FieldPolygonDrawerModal } from './farmers/FieldPolygonDrawerModal';
import { FieldSatelliteAnalyzerModal } from './farmers/FieldSatelliteAnalyzerModal';
import { FarmerStatementReportView } from './farmers/FarmerStatementReportView';
import { FarmerPrescriptionPreview } from './farmers/FarmerPrescriptionPreview';
import {
    FarmerManualDebtModal,
    FarmerReportFilterModal,
    FarmerContactImportModal,
    FarmerBalanceRepairModal,
    TempContactItem as TempContact,
} from './farmers/FarmerModalsBundle';

interface FarmersProps {
  onBack: () => void;
  onNavigateToPrescription: (farmerId: string) => void;
  onEditPrescription: (prescriptionId: string) => void;
  onEditVisit: (visitId: string) => void;
  selectedFarmerId?: string | null;
  onSelectFarmer?: (id: string | null) => void;
}

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
    farmers: contextFarmers,
    payments, 
    prescriptions, 
    manualDebts, 
    myPayments,
    plants,
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
    refreshStats,
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
  const [isFinancialAnalysisOpen, setIsFinancialAnalysisOpen] = useState(false);

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

  const toggleModal = (open: boolean) => {
    if (open === isModalOpen) return;
    setIsModalOpen(open);
  };

  const changeFarmerSelection = (farmer: Farmer | null) => {
    if (farmer === selectedFarmer) return;

    setSelectedPrescription(null);
    setIsViewingReport(false);
    setIsReportModalOpen(false);
    if (!farmer) {
      if (onSelectFarmer) {
        onSelectFarmer(null);
      } else {
        setSelectedFarmer(null);
      }
      if (window.history.state?.farmerId) {
        const nextState = { ...window.history.state };
        delete nextState.farmerId;
        window.history.replaceState(nextState, '');
      }
    } else {
      setActiveTab('DEBT');
      if (!window.history.state?.farmerId) {
        window.history.pushState({ ...window.history.state, view: 'FARMERS', farmerId: farmer.id }, '');
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
    prescriptions.filter(p => !p.deletedAt && p.farmerId === selectedFarmer?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [prescriptions, selectedFarmer]);

  const farmerManualDebts = useMemo(() => 
    manualDebts.filter(d => !d.deletedAt && d.farmerId === selectedFarmer?.id)
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
  const [editFarmerData, setEditFarmerData] = useState<any>({
      id: '',
      fullName: '',
      phoneNumber: '+90 ',
      village: '',
      tcNo: '',
      creditLimit: '',
      riskScoreOverride: '',
      fields: [{ id: crypto.randomUUID() as string, name: '', size: '', crop: '', plantingDate: '', currentStage: '' }]
  });
  const [satelliteTargetField, setSatelliteTargetField] = useState<Field | null>(null);
  const [directPolygonEditField, setDirectPolygonEditField] = useState<Field | null>(null);

  // Parçalı Tahsilat (#27) & Toplu Duyuru (#37) States
  const [isFarmerSplitPayment, setIsFarmerSplitPayment] = useState(false);
  const [farmerSplitRows, setFarmerSplitRows] = useState<{
      id: string;
      method: 'CASH' | 'CARD' | 'CHECK' | 'TEDYE';
      amount: string;
      accountId: string;
      dueDate: string;
      cardOption: CardSettlementOption;
  }[]>([
      { id: 'fsp-1', method: 'CASH', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'UNBLOCKED' },
      { id: 'fsp-2', method: 'CARD', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'DAYS_30' },
  ]);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announceVillage, setAnnounceVillage] = useState('ALL');
  const [announceCrop, setAnnounceCrop] = useState('ALL');
  const [announceTemplate, setAnnounceTemplate] = useState('');
  const [sentAnnouncementFarmerIds, setSentAnnouncementFarmerIds] = useState<Set<string>>(new Set());
  
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
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'CHECK' | 'TEDYE'>('CASH');
  const [cardOption, setCardOption] = useState<'UNBLOCKED' | 'DAYS_15' | 'DAYS_30' | 'DAYS_45'>('UNBLOCKED');
  const [commissionRate, setCommissionRate] = useState('4');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const isSavingPaymentRef = useRef(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentCrop, setPaymentCrop] = useState('');

  // Manual Debt Modal State
  const [isManualDebtModalOpen, setIsManualDebtModalOpen] = useState(false);
  const [editingManualDebt, setEditingManualDebt] = useState<ManualDebt | null>(null);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [debtDate, setDebtDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  const isSavingDebtRef = useRef(false);

  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<{ pesticideId: string, pesticideName: string, quantity: number, unitPrice: number }[]>([]);
  const [isSavingReturn, setIsSavingReturn] = useState(false);
  const isSavingReturnRef = useRef(false);
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

  // Cari Onar States
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);

  // Deterministic Step-by-Step Back Stack & Modal Scroll Lock
  useBackHandler(isViewingReport, () => setIsViewingReport(false), 'farmer_ekstre_preview', 68);
  useBackHandler(
    isReportModalOpen,
    () => {
      setIsReportModalOpen(false);
      setIsViewingReport(false);
    },
    'farmer_ekstre_modal',
    64
  );
  useBackHandler(!!selectedPrescription, () => setSelectedPrescription(null), 'farmer_prescription_detail', 60);
  useBackHandler(isPaymentModalOpen, () => setIsPaymentModalOpen(false), 'farmer_payment_modal', 58);
  useBackHandler(isManualDebtModalOpen, () => setIsManualDebtModalOpen(false), 'farmer_debt_modal', 58);
  useBackHandler(isReturnModalOpen, () => setIsReturnModalOpen(false), 'farmer_return_modal', 58);
  useBackHandler(isFinancialAnalysisOpen, () => setIsFinancialAnalysisOpen(false), 'farmer_fin_modal', 58);
  useBackHandler(isDebtReminderModalOpen, () => setIsDebtReminderModalOpen(false), 'farmer_reminder_modal', 58);
  useBackHandler(isRepairModalOpen, () => setIsRepairModalOpen(false), 'farmer_repair_modal', 58);
  useBackHandler(isImportModalOpen, () => setIsImportModalOpen(false), 'farmer_import_modal', 58);
  useBackHandler(isModalOpen, () => setIsModalOpen(false), 'farmer_edit_modal', 58);
  useBackHandler(!!selectedFarmer, () => changeFarmerSelection(null), 'farmer_detail_view', 25);

  useScrollLock(
    isReportModalOpen ||
      isPaymentModalOpen ||
      isManualDebtModalOpen ||
      isReturnModalOpen ||
      isFinancialAnalysisOpen ||
      isDebtReminderModalOpen ||
      isRepairModalOpen ||
      isImportModalOpen ||
      isModalOpen
  );
  const [repairState, setRepairState] = useState<'IDLE' | 'ANALYZING' | 'RESULT' | 'REPAIRING'>('IDLE');
  const [repairMismatches, setRepairMismatches] = useState<{
      farmerId: string, 
      farmerName: string, 
      currentBalance: number, 
      calculatedBalance: number, 
      brokenPrescriptions: {id: string, expected: number, actual: number}[],
      brokenPayments?: {id: string, expected: number, actual: number}[],
      brokenMyPayments?: {id: string, expected: number, actual: number}[],
      brokenManualDebts?: {id: string, expected: number, actual: number}[]
  }[]>([]);
  const [selectedRepairs, setSelectedRepairs] = useState<Set<string>>(new Set());

  const handleAnalyzeFarmers = async () => {
      setRepairState('ANALYZING');
      try {
          const results = await dbService.analyzeFarmerBalances();
          setRepairMismatches(results);
          setSelectedRepairs(new Set(results.map(r => r.farmerId)));
          setRepairState('RESULT');
      } catch (error) {
          console.error("Analysis error:", error);
          showToast("Cariler analiz edilirken hata oluştu.", "error");
          setIsRepairModalOpen(false);
          setRepairState('IDLE');
      }
  };

  const handleRepairFarmers = async () => {
      setRepairState('REPAIRING');
      try {
          const selectedFixes = repairMismatches.filter(m => selectedRepairs.has(m.farmerId));
          await dbService.applyFarmerFixes(selectedFixes.map(m => ({
              farmerId: m.farmerId,
              brokenPrescriptions: m.brokenPrescriptions,
              brokenPayments: m.brokenPayments,
              brokenMyPayments: m.brokenMyPayments,
              brokenManualDebts: m.brokenManualDebts
          })));
          showToast("Seçilen cariler kusursuz bir şekilde onarıldı.", "success");
          
          await refreshStats();
          setIsRepairModalOpen(false);
          setRepairState('IDLE');
      } catch (error) {
          console.error("Repair error:", error);
          showToast("Cariler onarılırken hata oluştu.", "error");
          setRepairState('RESULT');
      }
  };

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

  useEffect(() => {
    if (contextFarmers && contextFarmers.length >= 0) {
      const activeList = contextFarmers.filter(f => !f.deletedAt);
      setFarmers(activeList);
      setSelectedFarmer(prev => prev ? (activeList.find(f => f.id === prev.id) || prev) : null);
    }
  }, [contextFarmers]);

  // Fetch farmer specific data when selected
  useEffect(() => {
    if (selectedFarmer) {
        loadFarmerDetails();
        if (selectedFarmer.portalToken && selectedFarmer.portalToken.length >= 16) {
            dbService.publishFarmerPortalShare(selectedFarmer.id, false).catch(() => {});
        }
    }
  }, [selectedFarmer]);

  // Set default selected year to the latest available year
  const farmerPayments = useMemo(() => 
    payments.filter(p => !p.deletedAt && p.farmerId === selectedFarmer?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
  [payments, selectedFarmer]);
  
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Calculate available years for filtering
  const availableYears = useMemo(() => {
      const years = new Set<number>();
      years.add(currentYear);
      for (let y = currentYear; y >= currentYear - 4; y--) {
          years.add(y);
      }
      farmerPrescriptions.forEach(p => {
          const y = new Date(p.date).getFullYear();
          if (!isNaN(y)) years.add(y);
      });
      farmerPayments.forEach(p => {
          const y = new Date(p.date).getFullYear();
          if (!isNaN(y)) years.add(y);
      });
      farmerManualDebts.forEach(d => {
          const y = new Date(d.date).getFullYear();
          if (!isNaN(y)) years.add(y);
      });
      
      return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, farmerPrescriptions, farmerPayments, farmerManualDebts]);

  const availableCrops = useMemo(() => {
    if (!selectedFarmer) return [];
    const crops = new Set<string>();

    // 1. Farmer's fields
    if (selectedFarmer.fields) {
      selectedFarmer.fields.forEach(f => {
        if (f.crop && f.crop.trim()) crops.add(f.crop.trim());
      });
    }

    // 2. Farmer's prescriptions / sales
    farmerPrescriptions.forEach(p => {
      const c = (p.crop || p.cropName || (plants?.find(pl => pl.id === p.plantId)?.name))?.trim();
      if (c) crops.add(c);
    });

    // 3. Farmer's payments with crop
    farmerPayments.forEach(p => {
      if (p.crop && p.crop.trim()) crops.add(p.crop.trim());
    });

    return Array.from(crops).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [selectedFarmer, farmerPrescriptions, farmerPayments, plants]);

  const reportItems = useMemo(() => {
    if (!selectedFarmer) return [];
    // Only include checks/notes that do not have a relatedId (i.e. not generated by a normal Payment record) to prevent duplication
    const farmerMyPayments = myPayments.filter(p => p.farmerId === selectedFarmer.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId);
    return [
        ...farmerPrescriptions.map(p => {
            const isReturn = p.type === 'RETURN' || (p.totalAmount || 0) < 0;
            const pCrop = p.crop || p.cropName || (plants?.find(pl => pl.id === p.plantId)?.name);
            return { 
                ...p, 
                type: p.priceType === 'CASH' ? 'CASH' : 'DEBT', 
                label: p.priceType === 'CASH' ? 'Peşin Satış' : (isReturn ? 'İade Makbuzu' : `${prescriptionLabel} Satışı`),
                note: [
                    p.prescriptionNo ? `Fatura No: ${p.prescriptionNo}` : '',
                    pCrop ? `[Mahsul: ${pCrop}]` : ''
                ].filter(Boolean).join(' ')
            };
        }),
        ...farmerPayments.map(p => ({ 
            ...p, 
            type: 'PAYMENT', 
            label: p.crop ? `Tahsilat (${p.crop})` : 'Tahsilat' 
        })),
        ...farmerMyPayments.map(p => ({ 
            ...p, 
            type: 'PAYMENT', 
            label: p.type === 'CHECK' ? 'Çek Tahsilatı' : (p.type === 'PROMISSORY_NOTE' ? 'Senet Tahsilatı' : 'Tahsilat'), 
            date: p.issueDate,
            note: p.note
        })),
        ...farmerManualDebts.filter(d => !d.id.startsWith('turnover-')).map(d => ({ 
            ...d, 
            type: 'DEBT', 
            label: 'Manuel Borç/Alacak' 
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
        if (reportCrop !== 'ALL') {
            const cropLower = reportCrop.toLowerCase().trim();

            if ((item as any).type === 'DEBT' || (item as any).type === 'CASH') {
                const itemCrop = ((item as any).crop || (item as any).cropName || 
                    plants?.find(pl => pl.id === (item as any).plantId)?.name ||
                    (() => {
                        const fIds = (item as any).fieldIds || ((item as any).fieldId ? [(item as any).fieldId] : []);
                        const farmerFields = selectedFarmer?.fields || [];
                        const matchedField = farmerFields.find(f => fIds.includes(f.id));
                        return matchedField?.crop;
                    })() || '')?.trim();

                if (itemCrop.toLowerCase() !== cropLower) {
                    return false;
                }
            } else if ((item as any).type === 'PAYMENT') {
                const paymentCrop = ((item as any).crop || (item as any).cropName || '')?.trim();
                const paymentNote = ((item as any).note || '').toLowerCase();

                if (paymentCrop) {
                    if (paymentCrop.toLowerCase() !== cropLower) return false;
                } else if (paymentNote.includes(cropLower)) {
                    // Note explicitly matches this crop
                } else {
                    // If note mentions another known crop, exclude it
                    const otherCrops = availableCrops.filter(c => c.toLowerCase().trim() !== cropLower);
                    const isForOtherCrop = otherCrops.some(c => paymentNote.includes(c.toLowerCase().trim()));
                    if (isForOtherCrop) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    })
    .sort((a, b) => new Date((a as any).date).getTime() - new Date((b as any).date).getTime());
  }, [farmerPrescriptions, farmerPayments, farmerManualDebts, myPayments, reportStartDate, reportEndDate, reportFieldId, reportCrop, selectedFarmer, prescriptionLabel, plants, availableCrops]);

  const reportTotalDebt = useMemo(() => reportItems.filter(item => {
      if (item.type !== 'DEBT') return false;
      const amt = (item as any).totalAmount !== undefined ? (item as any).totalAmount : (item as any).amount;
      return (Number(amt) || 0) >= 0;
  }).reduce((acc, item) => acc + ((item as any).amount || (item as any).totalAmount || 0), 0), [reportItems]);
  const reportTotalPaid = useMemo(() => {
      const payments = reportItems.filter(item => item.type === 'PAYMENT').reduce((acc, item) => acc + ((item as any).amount || 0), 0);
      const returnsOrCredit = reportItems.filter(item => {
          if (item.type !== 'DEBT') return false;
          const amt = (item as any).totalAmount !== undefined ? (item as any).totalAmount : (item as any).amount;
          return (Number(amt) || 0) < 0 || item.label === 'İade Makbuzu';
      }).reduce((acc, item) => acc + Math.abs((item as any).totalAmount || (item as any).amount || 0), 0);
      return payments + returnsOrCredit;
  }, [reportItems]);
  const reportBalance = reportTotalPaid - reportTotalDebt;

  // Filter transactions by selected year
  const filteredPrescriptions = useMemo(() => 
      farmerPrescriptions.filter(p => new Date(p.date).getFullYear() === selectedYear),
  [farmerPrescriptions, selectedYear]);

  const bouncedRelatedIds = useMemo(() => getBouncedRelatedPaymentIds(myPayments), [myPayments]);

  const filteredPayments = useMemo(() => {
      const regularPayments = farmerPayments.filter(p => !bouncedRelatedIds.has(p.id) && new Date(p.date).getFullYear() === selectedYear);
      const checkPayments = getIndependentFarmerMyPayments(myPayments, selectedFarmer?.id)
          .filter(p => new Date(p.date).getFullYear() === selectedYear);
      return [...regularPayments, ...checkPayments];
  }, [farmerPayments, myPayments, bouncedRelatedIds, selectedFarmer, selectedYear]);

  const filteredManualDebts = useMemo(() => 
      farmerManualDebts.filter(d => new Date(d.date).getFullYear() === selectedYear),
  [farmerManualDebts, selectedYear]);

  const openingBalance = useMemo(() => {
      let balance = 0;
      
      // Sum all transactions BEFORE the selected year
      farmerPrescriptions.forEach(p => {
          if (new Date(p.date).getFullYear() < selectedYear && p.priceType !== 'CASH') {
              const amt = Number(p.totalAmount) || 0;
              const isReturn = p.type === 'RETURN' || amt < 0;
              balance -= (isReturn ? -Math.abs(amt) : Math.abs(amt));
          }
      });
      
      farmerManualDebts.forEach(d => {
          if (new Date(d.date).getFullYear() < selectedYear && !d.id.startsWith('turnover-')) {
              balance -= d.amount;
          }
      });
      
      farmerPayments.forEach(p => {
          if (!bouncedRelatedIds.has(p.id) && new Date(p.date).getFullYear() < selectedYear) {
              balance += p.amount;
          }
      });

      getIndependentFarmerMyPayments(myPayments, selectedFarmer?.id).forEach(p => {
          if (new Date(p.date).getFullYear() < selectedYear) {
              balance += p.amount;
          }
      });
      
      return balance;
  }, [farmerPrescriptions, farmerManualDebts, farmerPayments, myPayments, bouncedRelatedIds, selectedYear, selectedFarmer]);

  const yearTotalPaid = useMemo(() => filteredPayments.reduce((acc, p) => acc + p.amount, 0), [filteredPayments]);
  const yearTotalDebt = useMemo(() => 
    filteredPrescriptions.filter(p => p.priceType !== 'CASH').reduce((acc, p) => {
        const amt = Number(p.totalAmount) || 0;
        const isReturn = p.type === 'RETURN' || amt < 0;
        return acc + (isReturn ? -Math.abs(amt) : Math.abs(amt));
    }, 0) + 
    filteredManualDebts.filter(d => !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0),
  [filteredPrescriptions, filteredManualDebts]);

  const yearBalance = openingBalance + yearTotalPaid - yearTotalDebt;

  // Overall totals via single source of truth ledger
  const selectedFarmerLedger = useMemo(() => computeFarmerLedgerTotals({
      farmerId: selectedFarmer?.id,
      prescriptions: farmerPrescriptions,
      manualDebts: farmerManualDebts,
      payments: farmerPayments,
      myPayments
  }), [selectedFarmer, farmerPrescriptions, farmerManualDebts, farmerPayments, myPayments]);
  const totalPaid = selectedFarmerLedger.totalPaid;
  const totalDebt = selectedFarmerLedger.totalDebt;
  const overallBalance = selectedFarmerLedger.signedBalance;

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

  const buildSecurePortalUrl = (farmer: Farmer) => {
      let token = farmer.portalToken;
      if (!token || token.length < 16) {
          token = generatePortalToken();
          farmer.portalToken = token;
          dbService.updateFarmer({ ...farmer, portalToken: token })
              .then(() => dbService.publishFarmerPortalShare(farmer.id, true))
              .catch(() => {});
      } else {
          dbService.publishFarmerPortalShare(farmer.id, true).catch(() => {});
      }

      return buildPublicPortalUrl(token);
  };

  const handleCopyPortalLink = async () => {
      if (!selectedFarmer || !currentUser) return;
      
      const portalUrl = buildSecurePortalUrl(selectedFarmer);
      
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
        const canvas = await renderElementToCanvas(receiptRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            allowTaint: true
        });

        const pdf = await createMultiPagePdf(canvas);
        
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
        showToast("PDF oluşturulurken hata oluştu.", "error");
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
        showToast("Kişi bulunamadı.", "info");
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
      } catch (err) { showToast("Dosya hatası.", "error"); } 
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
          showToast(`${toAdd.length} çiftçi eklendi.`, "success");
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
      const tcCheck = validateTcOrVkn(editFarmerData.tcNo);
      if (!tcCheck.isValid) {
          showToast(tcCheck.message, 'error');
          return;
      }
      setIsSavingFarmer(true);
      try {
          const parsedCreditLimit = editFarmerData.creditLimit !== undefined && String(editFarmerData.creditLimit).trim() !== ''
              ? Number(editFarmerData.creditLimit) || 0
              : undefined;

          const farmerData = { 
              fullName: editFarmerData.fullName, 
              phoneNumber: editFarmerData.phoneNumber, 
              village: editFarmerData.village, 
              tcNo: editFarmerData.tcNo,
              creditLimit: parsedCreditLimit,
              riskScoreOverride: (editFarmerData.riskScoreOverride || undefined) as Farmer['riskScoreOverride'],
              fields: (editFarmerData.fields || []).map((f: any) => ({
                  ...f,
                  size: Number(f.size) || 0,
                  plantingDate: f.plantingDate || undefined,
                  currentStage: f.currentStage || undefined
              }))
          };
          
          if (modalMode === 'ADD') {
              await addFarmer(farmerData);
          } else { 
              const updated = { ...(selectedFarmer || {}), id: editFarmerData.id, ...farmerData }; 
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
          tcNo: '',
          creditLimit: '',
          riskScoreOverride: '',
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
          tcNo: selectedFarmer.tcNo || '',
          creditLimit: selectedFarmer.creditLimit ?? '',
          riskScoreOverride: selectedFarmer.riskScoreOverride || '',
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
      if (isSavingPayment || isSavingPaymentRef.current) return;
      if (!selectedFarmer) return;
      if (!editingPayment && isFarmerSplitPayment) {
          const validRows = farmerSplitRows.filter(r => parseFloatSafe(r.amount) > 0);
          if (validRows.length === 0) {
              showToast('En az bir geçerli ödeme kalemi giriniz', 'error');
              return;
          }
          isSavingPaymentRef.current = true;
          setIsSavingPayment(true);
          try {
              const nowIso = new Date().toISOString();
              for (let i = 0; i < validRows.length; i++) {
                  const row = validRows[i];
                  const amt = parseFloatSafe(row.amount);
                  const fallbackAcc = row.method === 'CARD'
                      ? (accounts.find(a => a.type === 'BANK')?.id || accounts[0]?.id)
                      : (accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id);
                  await addPayment({
                      farmerId: selectedFarmer.id,
                      amount: amt,
                      date: nowIso,
                      method: row.method,
                      crop: paymentCrop || undefined,
                      cardOption: row.method === 'CARD' ? row.cardOption : undefined,
                      commissionRate: row.method === 'CARD' && row.cardOption === 'UNBLOCKED' ? parseFloatSafe(commissionRate) : undefined,
                      dueDate: (row.method === 'CHECK' || row.method === 'TEDYE') ? row.dueDate : undefined,
                      note: `${paymentNote ? paymentNote + ' • ' : ''}Karma Tahsilat (${i + 1}/${validRows.length})`,
                      accountId: row.accountId || fallbackAcc || undefined,
                      createdById: activeTeamMember?.id
                  });
              }
              showToast(`${validRows.length} kalem karma tahsilat kaydedildi`, 'success');
              hapticFeedback('success');
              setIsPaymentModalOpen(false);
              setIsFarmerSplitPayment(false);
              setFarmerSplitRows([
                  { id: 'fsp-1', method: 'CASH', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'UNBLOCKED' },
                  { id: 'fsp-2', method: 'CARD', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'DAYS_30' },
              ]);
              setPaymentNote('');
              setPaymentCrop('');
              await loadFarmerDetails();
          } catch (e) {
              showToast('Karma tahsilat kaydedilemedi', 'error');
          } finally {
              isSavingPaymentRef.current = false;
              setIsSavingPayment(false);
          }
          return;
      }
      if (!paymentAmount) return;
      isSavingPaymentRef.current = true;
      setIsSavingPayment(true);
      try {
          const parsedAmount = parseFloatSafe(paymentAmount);
          const parsedCommRate = parseFloatSafe(commissionRate);

          const targetAccountId = selectedAccountId || accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id;

          if (editingPayment) {
              await updatePayment({
                  ...editingPayment,
                  amount: parsedAmount,
                  note: paymentNote,
                  crop: paymentCrop || undefined,
                  method: paymentMethod,
                  cardOption: paymentMethod === 'CARD' ? cardOption : undefined,
                  commissionRate: paymentMethod === 'CARD' ? parsedCommRate : undefined,
                  dueDate: (paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') ? paymentDate : undefined,
                  accountId: targetAccountId || undefined
              });
              showToast('Ödeme güncellendi', 'success');
          } else {
              await addPayment({
                  farmerId: selectedFarmer.id,
                  amount: parsedAmount,
                  date: new Date().toISOString(),
                  method: paymentMethod,
                  crop: paymentCrop || undefined,
                  cardOption: paymentMethod === 'CARD' ? cardOption : undefined,
                  commissionRate: paymentMethod === 'CARD' ? parsedCommRate : undefined,
                  dueDate: (paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') ? paymentDate : undefined,
                  note: paymentNote,
                  accountId: targetAccountId || undefined,
                  createdById: activeTeamMember?.id
              });
              showToast('Ödeme kaydedildi', 'success');
          }
          hapticFeedback('success');
          setIsPaymentModalOpen(false);
          setEditingPayment(null);
          setPaymentAmount('');
          setPaymentNote('');
          setPaymentCrop('');
          setPaymentMethod('CASH');
          setCardOption('UNBLOCKED');
          setCommissionRate('4');
          setPaymentDate(new Date().toISOString().split('T')[0]);
          setSelectedAccountId('');
          await loadFarmerDetails();
      } catch (e) {
          showToast('İşlem başarısız', 'error');
      } finally {
          isSavingPaymentRef.current = false;
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
      if (isSavingReturn || isSavingReturnRef.current) return;
      if (!selectedFarmer || returnItems.length === 0) return;
      isSavingReturnRef.current = true;
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
              isProcessed: true,
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
          isSavingReturnRef.current = false;
          setIsSavingReturn(false);
      }
  };

  const handleEditPayment = (payment: Payment) => {
      setEditingPayment(payment);
      setPaymentAmount(payment.amount.toString());
      setPaymentNote(payment.note || '');
      setPaymentCrop(payment.crop || '');
      setSelectedAccountId(payment.accountId || '');
      setIsPaymentModalOpen(true);
  };

  const handleSendReceipt = async (payment: Payment) => {
      hapticFeedback('medium');
      const currency = userProfile?.currency || 'TRY';
      const farmerName = selectedFarmer?.fullName || 'Sayın Müşterimiz';
      const dateStr = new Date(payment.date).toLocaleDateString('tr-TR');
      const amountStr = formatCurrency(payment.amount, currency);
      const paymentTypeStr =
          payment.method === 'CHECK' ? 'Çek' :
          payment.method === 'TEDYE' ? 'Tediye' :
          payment.method === 'CARD' ? 'Kredi Kartı / POS' : 'Nakit';

      // Güncel ve önceki bakiye hesabı (#36)
      const currentDebtAmt = overallBalance < 0 ? Math.abs(overallBalance) : 0;
      const previousDebtAmt = Math.max(0, currentDebtAmt + payment.amount);
      const prevBalStr = previousDebtAmt > 0 ? `${formatCurrency(previousDebtAmt, currency)} Borç` : '0,00 TL';
      const remainingBalStr = overallBalance < -0.01
          ? `${formatCurrency(Math.abs(overallBalance), currency)} Borç`
          : overallBalance > 0.01
              ? `${formatCurrency(overallBalance, currency)} Alacak`
              : '0,00 TL (Kapandı)';
                          
      setIsProcessingPdf(true);
      try {
          const container = document.createElement('div');
          container.style.position = 'absolute';
          container.style.left = '-9999px';
          container.style.top = '0';
          container.innerHTML = `
              <div id="receipt-print-${payment.id}" style="width: 420px; padding: 40px; background: white; color: #1c1917; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  <div style="text-align: center; margin-bottom: 24px;">
                      <h2 style="margin: 0; font-size: 24px; font-weight: 900; color: #064e3b; text-transform: uppercase;">${userProfile?.companyName || 'ZİRAİ OTOMASYON'}</h2>
                      <p style="margin: 5px 0 0; font-size: 13px; font-weight: 700; color: #57534e; letter-spacing: 2px;">TAHSİLAT DEKONTU</p>
                  </div>
                  <div style="border-top: 2px dashed #d6d3d1; margin: 16px 0;"></div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Tarih:</span>
                      <strong style="color: #292524;">${dateStr}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Müşteri:</span>
                      <strong style="color: #292524;">${farmerName}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Ödeme Yöntemi:</span>
                      <strong style="color: #292524;">${paymentTypeStr}</strong>
                  </div>
                  ${payment.dueDate ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Vade Tarihi:</span>
                      <strong style="color: #292524;">${new Date(payment.dueDate).toLocaleDateString('tr-TR')}</strong>
                  </div>` : ''}
                  ${payment.note ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Açıklama:</span>
                      <strong style="color: #292524;">${payment.note}</strong>
                  </div>` : ''}
                  <div style="background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px 16px; margin: 18px 0;">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
                          <span style="color: #57534e; font-weight: 600;">Önceki Bakiye:</span>
                          <strong style="color: #44403c;">${prevBalStr}</strong>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 15px;">
                          <span style="color: #065f46; font-weight: 800;">Tahsil Edilen:</span>
                          <strong style="color: #059669; font-size: 18px;">${amountStr}</strong>
                      </div>
                      <div style="border-top: 1px solid #d6d3d1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 14px;">
                          <span style="color: #1c1917; font-weight: 800;">Güncel Kalan Bakiye:</span>
                          <strong style="color: ${overallBalance < -0.01 ? '#dc2626' : '#059669'};">${remainingBalStr}</strong>
                      </div>
                  </div>
                  <div style="margin-top: 24px; border-top: 1px solid #e7e5e4; padding-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
                      <div style="font-size: 11px; font-weight: 600; color: #78716c;">
                          Ödemeniz cari hesabınıza işlenmiştir.<br/>Bereketli sezonlar dileriz.
                      </div>
                      <div style="border: 2px solid ${userProfile?.stampColor || '#1d4ed8'}; border-radius: 6px; padding: 6px 10px; transform: rotate(-2.5deg); color: ${userProfile?.stampColor || '#1d4ed8'}; font-size: 8px; text-align: center; max-width: 190px;">
                          <div style="font-weight: 900; text-transform: uppercase; border-bottom: 1px solid ${userProfile?.stampColor || '#1d4ed8'}; padding-bottom: 2px; margin-bottom: 2px; font-size: 8.5px;">
                              ${(userProfile?.stampTitle || userProfile?.companyName || 'ZİRAİ OTOMASYON').toUpperCase()}
                          </div>
                          <div style="font-weight: 800; font-size: 8px; margin-bottom: 1px;">
                              ${userProfile?.stampSubTitle || userProfile?.fullName || 'Ziraat Mühendisi'}
                          </div>
                          <div style="font-size: 7.5px; opacity: 0.9;">
                              ${userProfile?.stampTaxInfo || 'Resmi Dijital Onaylı Kaşe'}
                          </div>
                      </div>
                  </div>
              </div>
          `;
          document.body.appendChild(container);
          
          const elementToCapture = container.firstElementChild as HTMLElement;
          const canvas = await renderElementToCanvas(elementToCapture, {
              scale: 3, 
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false
          });
          
          document.body.removeChild(container);
          
          const pdf = await createMultiPagePdf(canvas);
          const pdfBlob = pdf.output('blob');
          
          const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
          const safeName = farmerName
              .replace(/[ĞğÜüŞşİıÖöÇç]/g, match => charMap[match])
              .replace(/[^a-zA-Z0-9]/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_|_$/g, '');
          const fileName = `${safeName}_Tahsilat_Dekontu.pdf`;
          
          const fallbackToWhatsApp = (phone?: string, text?: string) => {
              const encodedMessage = encodeURIComponent(text || '');
              const phoneParam = normalizeWaPhone(phone);
              const whatsappUrl = phoneParam 
                  ? `https://wa.me/${phoneParam}?text=${encodedMessage}` 
                  : `https://wa.me/?text=${encodedMessage}`;
              window.open(whatsappUrl, '_blank');
          };

          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          const message = renderWhatsAppTemplate(
              userProfile?.whatsappTemplates?.collectionReceipt,
              'collectionReceipt',
              {
                  firma: userProfile?.companyName || 'Zirai Mühendislik',
                  isim: farmerName,
                  tarih: dateStr,
                  odeme_yontemi: paymentTypeStr,
                  eski_bakiye: prevBalStr,
                  odenen: amountStr,
                  kalan_bakiye: remainingBalStr,
                  bakiye: remainingBalStr,
              }
          );
          const shareData = {
              files: [file],
              title: 'Tahsilat Dekontu',
              text: message
          };
          
          if (navigator.canShare && navigator.canShare(shareData)) {
              try {
                  await navigator.share(shareData);
              } catch (shareError) {
                  console.log('Share canceled or failed', shareError);
                  fallbackToWhatsApp(selectedFarmer?.phoneNumber, message);
              }
          } else {
              pdf.save(fileName);
              fallbackToWhatsApp(selectedFarmer?.phoneNumber, message);
          }
      } catch (e) {
          console.error('PDF Error:', e);
          showToast('Makbuz oluşturulamadı', 'error');
      } finally {
          setIsProcessingPdf(false);
      }
  };

  const handleSaveManualDebt = async () => {
      if (isSavingDebt || isSavingDebtRef.current) return;
      if (!selectedFarmer || !debtAmount) return;
      isSavingDebtRef.current = true;
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
          isSavingDebtRef.current = false;
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
          const canvas = await renderElementToCanvas(reportRef.current, {
              scale: 2,
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false,
              allowTaint: true
          });
          const pdf = await createMultiPagePdf(canvas);
          
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
      const formattedDebt = `${formatCurrency(debtAmount, (userProfile?.currency as any) || 'TRY')} ${overallBalance < 0 ? 'Borç' : 'Alacak'}`;
      const portalUrl = buildSecurePortalUrl(selectedFarmer);
      const text = renderWhatsAppTemplate(
          userProfile?.whatsappTemplates?.debtReminder,
          'debtReminder',
          {
              firma: userProfile?.companyName || 'Zirai Mühendislik',
              isim: selectedFarmer.fullName,
              tarih: new Date().toLocaleDateString('tr-TR'),
              bakiye: formattedDebt,
              kalan_bakiye: formattedDebt,
              link: portalUrl,
              koy: selectedFarmer.village,
          }
      );
      const cleanPhone = normalizeWaPhone(selectedFarmer.phoneNumber);
      const waUrl = cleanPhone
          ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
          : `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
  };

  const handleGenerateFarmerReconciliationPdf = async () => {
      if (!selectedFarmer) return;
      setIsProcessingPdf(true);
      try {
          hapticFeedback('medium');
          showToast('Resmi Cari Mutabakat Mektubu hazırlanıyor...', 'info');
          const currency = userProfile?.currency || 'TRY';
          const todayStr = new Date().toLocaleDateString('tr-TR');
          const absBal = Math.abs(overallBalance);
          const directionText =
              overallBalance < -0.01
                  ? 'BORÇLU (Şirketimiz Alacaklı)'
                  : overallBalance > 0.01
                      ? 'ALACAKLI (Şirketimiz Borçlu)'
                      : 'BAKİYE SIFIR (Mutabık)';
          const companyTitle = escapeHtml(userProfile?.companyName || userProfile?.stampTitle || 'ZİRAİ MÜHENDİSLİK & TARIM MARKET');
          const safeFullName = escapeHtml(userProfile?.fullName || 'Ziraat Mühendisi');
          const safePhone = userProfile?.phoneNumber ? `• ${escapeHtml(userProfile.phoneNumber)}` : '';
          const safeFarmerName = escapeHtml(selectedFarmer.fullName);
          const safeFarmerTc = selectedFarmer.tcNo ? `T.C. / VKN: <strong>${escapeHtml(selectedFarmer.tcNo)}</strong> • ` : '';
          const safeFarmerVillage = escapeHtml(selectedFarmer.village || '-');
          const safeFarmerPhone = escapeHtml(selectedFarmer.phoneNumber || '-');
          const safeStampColor = /^#[0-9a-fA-F]{3,8}$/.test(userProfile?.stampColor || '') ? userProfile!.stampColor! : '#1d4ed8';
          const safeStampTitle = escapeHtml((userProfile?.stampTitle || userProfile?.companyName || 'ZİRAİ MÜHENDİSLİK').toUpperCase());
          const safeStampSub = escapeHtml(userProfile?.stampSubTitle || userProfile?.fullName || 'Ziraat Mühendisi');
          const safeStampTax = escapeHtml(userProfile?.stampTaxInfo || 'Resmi Dijital Onaylı Kaşe');

          const container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.left = '-9999px';
          container.style.top = '0';
          container.innerHTML = `
              <div style="width: 794px; min-height: 1080px; padding: 56px 60px; background: #ffffff; color: #1c1917; font-family: 'Segoe UI', Roboto, Arial, sans-serif; box-sizing: border-box;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #064e3b; padding-bottom: 20px; margin-bottom: 28px;">
                      <div>
                          <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #064e3b; text-transform: uppercase;">${companyTitle}</h1>
                          <p style="margin: 6px 0 0; font-size: 13px; color: #57534e; font-weight: 600;">${safeFullName} ${safePhone}</p>
                      </div>
                      <div style="text-align: right;">
                          <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 900; letter-spacing: 1px;">
                              CARİ HESAP MUTABAKAT MEKTUBU
                          </div>
                          <p style="margin: 8px 0 0; font-size: 12px; color: #57534e; font-weight: 700;">Tarih: ${escapeHtml(todayStr)}</p>
                      </div>
                  </div>

                  <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 18px 22px; margin-bottom: 26px;">
                      <p style="margin: 0 0 6px; font-size: 11px; font-weight: 800; color: #78716c; text-transform: uppercase; letter-spacing: 1px;">SAYIN ÜRETİCİ / MUHATAP BİLGİLERİ</p>
                      <h2 style="margin: 0; font-size: 19px; font-weight: 900; color: #1c1917;">${safeFarmerName}</h2>
                      <p style="margin: 6px 0 0; font-size: 13px; color: #44403c;">
                          ${safeFarmerTc}
                          Köy / Mevki: <strong>${safeFarmerVillage}</strong> • Telefon: <strong>${safeFarmerPhone}</strong>
                      </p>
                  </div>

                  <p style="font-size: 14px; line-height: 1.75; color: #292524; margin-bottom: 24px;">
                      Sayın <strong>${safeFarmerName}</strong>,<br/>
                      İşletmemiz nezdindeki cari hesabınızın <strong>${escapeHtml(todayStr)}</strong> tarihi itibarıyla yapılan kontroller sonucunda aşağıda detayları belirtilen bakiyeyi verdiği tespit edilmiştir. Kayıtlarımızla mutabık olup olmadığınızı aşağıdaki bölümü imzalayarak tarafımıza bildirmenizi rica ederiz.
                  </p>

                  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
                      <thead>
                          <tr style="background: #064e3b; color: #ffffff;">
                              <th style="padding: 12px 16px; text-align: left; border-radius: 8px 0 0 0;">Mutabakat Tarihi</th>
                              <th style="padding: 12px 16px; text-align: right;">Toplam Borç</th>
                              <th style="padding: 12px 16px; text-align: right;">Toplam Tahsilat</th>
                              <th style="padding: 12px 16px; text-align: right;">Net Cari Bakiye</th>
                              <th style="padding: 12px 16px; text-align: center; border-radius: 0 8px 0 0;">Bakiye Durumu</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr style="background: #f5f5f4; font-weight: 700;">
                              <td style="padding: 14px 16px; border-bottom: 2px solid #d6d3d1;">${escapeHtml(todayStr)}</td>
                              <td style="padding: 14px 16px; text-align: right; border-bottom: 2px solid #d6d3d1;">${escapeHtml(formatCurrency(totalDebt, currency))}</td>
                              <td style="padding: 14px 16px; text-align: right; border-bottom: 2px solid #d6d3d1;">${escapeHtml(formatCurrency(totalPaid, currency))}</td>
                              <td style="padding: 14px 16px; text-align: right; font-size: 16px; font-weight: 900; color: #064e3b; border-bottom: 2px solid #d6d3d1;">${escapeHtml(formatCurrency(absBal, currency))}</td>
                              <td style="padding: 14px 16px; text-align: center; font-size: 12px; font-weight: 900; border-bottom: 2px solid #d6d3d1;">${escapeHtml(directionText)}</td>
                          </tr>
                      </tbody>
                  </table>

                  <div style="border: 1px dashed #a8a29e; background: #fffbeb; border-radius: 10px; padding: 14px 18px; margin-bottom: 36px; font-size: 12px; color: #78350f;">
                      <strong>Not:</strong> İşbu mutabakat mektubuna tebliğ tarihinden itibaren 1 (bir) ay içerisinde itiraz edilmediği takdirde 6102 sayılı TTK m. 94 uyarınca cari hesap bakiyesi kesinleşmiş sayılır.
                  </div>

                  <div style="display: flex; gap: 24px; margin-top: 20px;">
                      <div style="flex: 1; border: 2px solid #d6d3d1; border-radius: 14px; padding: 20px; min-height: 190px; display: flex; flex-direction: column; justify-content: space-between;">
                          <div>
                              <div style="font-size: 12px; font-weight: 900; color: #064e3b; text-transform: uppercase; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; margin-bottom: 10px;">
                                  GÖNDEREN İŞLETME (KAŞE / İMZA)
                              </div>
                              <div style="font-size: 13px; font-weight: 800; color: #1c1917;">${companyTitle}</div>
                              <div style="font-size: 11px; color: #57534e; margin-top: 4px;">${escapeHtml(userProfile?.fullName || '')}</div>
                          </div>
                          ${userProfile?.stampEnabled !== false ? `
                          <div style="align-self: center; border: 2px solid ${safeStampColor}; border-radius: 8px; padding: 8px 14px; transform: rotate(-2deg); color: ${safeStampColor}; text-align: center; margin-top: 12px;">
                              <div style="font-size: 10px; font-weight: 900; text-transform: uppercase;">${safeStampTitle}</div>
                              <div style="font-size: 9px; font-weight: 700;">${safeStampSub}</div>
                              <div style="font-size: 8px;">${safeStampTax}</div>
                          </div>` : '<div style="font-size: 11px; color: #a8a29e; text-align: center;">Kaşe / İmza</div>'}
                      </div>

                      <div style="flex: 1; border: 2px solid #d6d3d1; border-radius: 14px; padding: 20px; min-height: 190px; display: flex; flex-direction: column; justify-content: space-between;">
                          <div>
                              <div style="font-size: 12px; font-weight: 900; color: #1c1917; text-transform: uppercase; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px; margin-bottom: 10px;">
                                  ÜRETİCİ / MÜŞTERİ ONAYI (İMZA)
                              </div>
                              <div style="font-size: 13px; font-weight: 800; color: #1c1917; margin-bottom: 12px;">${safeFarmerName}</div>
                              <div style="display: flex; gap: 18px; font-size: 12px; font-weight: 800; color: #292524; margin-top: 10px;">
                                  <span>☐ MUTABIKIZ</span>
                                  <span>☐ MUTABIK DEĞİLİZ</span>
                              </div>
                          </div>
                          <div style="font-size: 11px; color: #78716c; border-top: 1px dashed #d6d3d1; padding-top: 8px;">
                              Tarih / İmza:
                          </div>
                      </div>
                  </div>
              </div>
          `;
          document.body.appendChild(container);
          const canvas = await renderElementToCanvas(container.firstElementChild as HTMLElement, {
              scale: 3,
              backgroundColor: '#ffffff',
              useCORS: true,
              logging: false,
          });
          document.body.removeChild(container);
          const pdf = await createMultiPagePdf(canvas);
          const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
          const safeName = selectedFarmer.fullName
              .replace(/[ĞğÜüŞşİıÖöÇç]/g, m => charMap[m])
              .replace(/[^a-zA-Z0-9]/g, '_');
          pdf.save(`${safeName}_Cari_Mutabakat_${new Date().toISOString().split('T')[0]}.pdf`);
          showToast('Cari Mutabakat Mektubu (PDF) indirildi', 'success');
      } catch (err) {
          console.error('Farmer reconciliation PDF error:', err);
          showToast('Mutabakat PDF oluşturulamadı', 'error');
      } finally {
          setIsProcessingPdf(false);
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
    const nowMs = Date.now();
    return farmers.map(farmer => {
      const totals = computeFarmerLedgerTotals({
        farmerId: farmer.id,
        prescriptions,
        manualDebts,
        payments,
        myPayments
      });
      const overallBalance = totals.signedBalance;
      const curDebtAmt = totals.netDebt > 0 ? totals.netDebt : 0;
      const debtAgeDays = computeFifoUnpaidDebtAgeDays({
        farmerId: farmer.id,
        prescriptions,
        manualDebts,
        payments,
        myPayments,
        nowMs
      });
      const payRatio = totals.totalDebt > 0 ? totals.totalPaid / totals.totalDebt : 1;
      const overLimit = (farmer.creditLimit || 0) > 0 && curDebtAmt > (farmer.creditLimit || 0);
      const autoGrade: 'A' | 'B' | 'C' | 'D' =
          overLimit || (debtAgeDays > 240 && payRatio < 0.25)
              ? 'D'
              : curDebtAmt <= 50 || (payRatio >= 0.7 && debtAgeDays <= 90)
                  ? 'A'
                  : debtAgeDays <= 180 && payRatio >= 0.35
                      ? 'B'
                      : 'C';
      const effectiveRiskGrade: 'A' | 'B' | 'C' | 'D' = farmer.riskScoreOverride || autoGrade;
      return { ...farmer, overallBalance, effectiveRiskGrade };
    }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr-TR'));
  }, [farmers, payments, myPayments, prescriptions, manualDebts]);

  const filteredFarmers = farmersWithDebt.filter(f => 
    turkishMatchesAny([f.fullName, f.village, f.tcNo, f.phoneNumber], searchTerm)
  );

  const downloadFarmersPdf = async () => {
      setIsGeneratingReport(true);
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
          
          let tableHtml = `
            <div style="margin-bottom: 30px;">
                <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #1c1917;">ÇİFTÇİ CARİ LİSTESİ</h1>
                <p style="font-size: 14px; margin: 0; color: #78716c;">Tarih: ${new Date().toLocaleDateString('tr-TR')} &nbsp;&bull;&nbsp; Toplam Çiftçi: ${farmersWithDebt.length}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                <thead>
                    <tr style="background-color: #10b981; color: white;">
                        <th style="padding: 12px; border-bottom: 2px solid #059669; border-top-left-radius: 8px;">Ad Soyad</th>
                        <th style="padding: 12px; border-bottom: 2px solid #059669;">T.C. No</th>
                        <th style="padding: 12px; border-bottom: 2px solid #059669;">Telefon</th>
                        <th style="padding: 12px; border-bottom: 2px solid #059669;">Köy/Mevki</th>
                        <th style="padding: 12px; border-bottom: 2px solid #059669; border-top-right-radius: 8px; text-align: right;">Bakiye</th>
                    </tr>
                </thead>
                <tbody>
          `;
          
          farmersWithDebt.forEach((f, i) => {
              const bg = i % 2 === 0 ? '#fafaf9' : '#ffffff';
              const balanceStr = formatCurrency(Math.abs(f.overallBalance || 0), userProfile?.currency || 'TRY');
              const statusStr = f.overallBalance && f.overallBalance > 0 ? '<span style="color:#10b981;font-weight:bold;margin-left:4px;">ALACAK</span>' : (f.overallBalance && f.overallBalance < 0 ? '<span style="color:#ef4444;font-weight:bold;margin-left:4px;">BORÇ</span>' : '');
              
              tableHtml += `
                <tr style="background-color: ${bg}; border-bottom: 1px solid #e7e5e4;">
                    <td style="padding: 12px; font-weight: 600;">${escapeHtml(f.fullName)}</td>
                    <td style="padding: 12px; font-family: monospace; color: #57534e;">${escapeHtml(f.tcNo || '-')}</td>
                    <td style="padding: 12px; color: #57534e;">${escapeHtml(f.phoneNumber || '-')}</td>
                    <td style="padding: 12px; color: #57534e;">${escapeHtml(f.village || '-')}</td>
                    <td style="padding: 12px; text-align: right; font-family: monospace; font-size: 13px;">${escapeHtml(balanceStr)} ${statusStr}</td>
                </tr>
              `;
          });
          
          tableHtml += `
                </tbody>
            </table>
          `;
          
          container.innerHTML = tableHtml;
          document.body.appendChild(container);
          
          const canvas = await renderElementToCanvas(container, {
              scale: 3,
              backgroundColor: '#ffffff',
              logging: false
          });
          
          document.body.removeChild(container);
          
          const pdf = await createMultiPagePdf(canvas);
          pdf.save('Ciftci_Cari_Listesi.pdf');
          showToast('Kurumsal PDF indirildi', 'success');
          
      } catch (error) {
          console.error(error);
          showToast('PDF oluşturulurken hata oluştu', 'error');
      } finally {
          setIsGeneratingReport(false);
      }
  };

  const handleSync = async () => {
      setIsSyncing(true);
      try {
          const result = await dbService.backupAllData();
          updateUserProfile({ ...userProfile, lastSyncTime: result.timestamp });
          showToast("Tüm veriler başarıyla Firebase'e yedeklendi.", "success");
      } catch (error) {
          showToast("Yedekleme hatası: " + (error as any).message, "error");
      } finally {
          setIsSyncing(false);
      }
  };

  // --- DETAIL VIEW ---
  if (selectedFarmer) {
     if (selectedPrescription) {
         return (
            <FarmerPrescriptionPreview
                selectedFarmer={selectedFarmer}
                selectedPrescription={selectedPrescription}
                receiptRef={receiptRef}
                userProfile={userProfile}
                prescriptionLabel={prescriptionLabel}
                isProcessingPdf={isProcessingPdf}
                isDeleteModalOpen={isDeleteModalOpen}
                deleteConfirmMessage={t('prescription.delete_confirm', { label: prescriptionLabel.toLowerCase() }) || `Bu ${prescriptionLabel.toLowerCase()}yi silmek istediğinize emin misiniz?`}
                onBack={() => setSelectedPrescription(null)}
                onEditPrescription={onEditPrescription}
                onRequestDelete={(id) => {
                    setPrescriptionToDelete(id);
                    setIsDeleteModalOpen(true);
                }}
                onCloseDeleteModal={() => {
                    setIsDeleteModalOpen(false);
                    setPrescriptionToDelete(null);
                }}
                onConfirmDelete={async () => {
                    if (prescriptionToDelete) {
                        await softDeletePrescription(prescriptionToDelete);
                        showToast(`${prescriptionLabel} silindi`, 'info');
                        hapticFeedback('medium');
                        setSelectedPrescription(null);
                        setPrescriptionToDelete(null);
                    }
                }}
                onPdfAction={handlePdfAction}
                onWhatsAppText={handleWhatsAppText}
            />
         );
     }

     if (isViewingReport) {
         return (
            <FarmerStatementReportView
                selectedFarmer={selectedFarmer}
                reportRef={reportRef}
                reportStartDate={reportStartDate}
                reportEndDate={reportEndDate}
                reportType={reportType}
                reportFieldId={reportFieldId}
                reportCrop={reportCrop}
                reportItems={reportItems}
                reportTotalDebt={reportTotalDebt}
                reportTotalPaid={reportTotalPaid}
                reportBalance={reportBalance}
                userProfile={userProfile}
                isGeneratingReport={isGeneratingReport}
                onBack={() => setIsViewingReport(false)}
                onPdfAction={handleReportPdfAction}
                onWhatsAppText={handleReportWhatsAppText}
            />
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
                                <button 
                                    onClick={() => setIsFinancialAnalysisOpen(true)} 
                                    title="Finansal Analiz & Kârlılık"
                                    className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-all active:scale-90 border border-emerald-500/20 flex items-center gap-1 px-2"
                                >
                                    <TrendingUpIcon size={12} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Finans</span>
                                </button>
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
                        <div className="flex items-center text-stone-500 text-xs mt-0.5 font-bold gap-2.5 flex-wrap">
                            <span className="flex items-center"><MapPin size={10} className="mr-1 text-emerald-500/70"/> {selectedFarmer.village}</span>
                            {selectedFarmer.tcNo && (
                                <span className="flex items-center text-stone-300 font-mono text-[10px] bg-stone-800/80 px-2 py-0.5 rounded-md border border-white/5">
                                    <CreditCard size={10} className="mr-1 text-blue-400" />
                                    TC: {selectedFarmer.tcNo}
                                </span>
                            )}
                            {(() => {
                                const unpaidRx = farmerPrescriptions.filter(p => p.priceType !== 'CASH' && (p.totalAmount || 0) > 0);
                                const oldestTimestamp = unpaidRx.length > 0
                                    ? Math.min(...unpaidRx.map(p => new Date(p.date).getTime()))
                                    : Date.now();
                                const curDebtAmt = overallBalance < 0 ? Math.abs(overallBalance) : 0;
                                const debtAgeDays = curDebtAmt > 50 ? Math.max(0, Math.floor((Date.now() - oldestTimestamp) / (1000 * 60 * 60 * 24))) : 0;
                                const payRatio = totalDebt > 0 ? totalPaid / totalDebt : 1;
                                const overLimit = (selectedFarmer.creditLimit || 0) > 0 && curDebtAmt > (selectedFarmer.creditLimit || 0);
                                const autoGrade: 'A' | 'B' | 'C' | 'D' =
                                    overLimit || (debtAgeDays > 240 && payRatio < 0.25)
                                        ? 'D'
                                        : curDebtAmt <= 50 || (payRatio >= 0.7 && debtAgeDays <= 90)
                                            ? 'A'
                                            : debtAgeDays <= 180 && payRatio >= 0.35
                                                ? 'B'
                                                : 'C';
                                const finalGrade = selectedFarmer.riskScoreOverride || autoGrade;
                                const riskMap: Record<'A' | 'B' | 'C' | 'D', { label: string; cls: string }> = {
                                    A: { label: 'A Güvenilir', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
                                    B: { label: 'B Standart', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
                                    C: { label: 'C Gecikmeli', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
                                    D: { label: 'D Yüksek Risk', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/40' },
                                };
                                const riskGrade = riskMap[finalGrade];
                                return (
                                    <>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${riskGrade.cls}`}>
                                            <ShieldCheck size={10} />
                                            {riskGrade.label}{selectedFarmer.riskScoreOverride ? ' (Manuel)' : ''}
                                        </span>
                                        {debtAgeDays > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-stone-800/90 text-stone-300 border border-white/10">
                                                <Clock size={10} className="text-amber-400" />
                                                Yaşlandırma: {debtAgeDays} Gün
                                            </span>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        {(selectedFarmer.creditLimit || 0) > 0 && (() => {
                            const curDebtAmt = overallBalance < 0 ? Math.abs(overallBalance) : 0;
                            const limit = selectedFarmer.creditLimit || 1;
                            const pct = Math.min(100, Math.round((curDebtAmt / limit) * 100));
                            const isExceeded = curDebtAmt > limit;
                            return (
                                <div className="mt-2.5 bg-stone-950/70 border border-white/5 rounded-xl p-2">
                                    <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                                        <span className={isExceeded ? 'text-rose-400 font-black' : 'text-stone-400'}>
                                            {isExceeded ? 'Kredi Limiti Aşıldı' : 'Kredi / Açık Hesap Limiti'}
                                        </span>
                                        <span className="font-mono text-stone-200">
                                            {formatCurrency(curDebtAmt, userProfile?.currency || 'TRY')} / {formatCurrency(limit, userProfile?.currency || 'TRY')} (%{Math.round((curDebtAmt / limit) * 100)})
                                        </span>
                                    </div>
                                    <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${isExceeded ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-2 w-full">
                    {/* Buttons condensed */}
                    {[
                        { icon: Phone, label: 'Ara', href: `tel:${selectedFarmer.phoneNumber}` },
                        { icon: MessageCircle, label: 'WhatsApp', href: `https://wa.me/${selectedFarmer.phoneNumber.replace(/[^0-9]/g, '')}`, target: '_blank' },
                        { icon: Wallet, label: 'Hatırlat', action: handleSendDebtReminder },
                        { icon: Navigation, label: 'Konum', action: () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedFarmer.village)}`, '_blank') }
                    ].map((btn, i) => (
                        btn.href ? (
                            <a key={i} href={btn.href} target={btn.target} className="flex flex-col items-center justify-center min-h-[46px] py-2 px-1 bg-stone-800/40 rounded-xl hover:bg-stone-800 transition-all border border-white/5 active:scale-95">
                                <btn.icon size={16} className="mb-1 text-stone-300"/>
                                <span className="text-[10px] font-bold text-stone-300 truncate max-w-full">{btn.label}</span>
                            </a>
                        ) : (
                            <button key={i} onClick={btn.action} className="flex flex-col items-center justify-center min-h-[46px] py-2 px-1 bg-stone-800/40 rounded-xl hover:bg-stone-800 transition-all border border-white/5 active:scale-95">
                                <btn.icon size={16} className="mb-1 text-stone-300"/>
                                <span className="text-[10px] font-bold text-stone-300 truncate max-w-full">{btn.label}</span>
                            </button>
                        )
                    ))}
                </div>

                <button 
                    onClick={handleCopyPortalLink}
                    className="w-full mt-3 min-h-[42px] py-2.5 bg-emerald-900/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-900/40 transition-colors"
                >
                    <Copy size={14} />
                    {farmerLabel} Portalı Linkini Kopyala
                </button>
            </div>

            {/* Tabs */}
            <div className="mks-tab-rail flex gap-1 p-1 bg-stone-900/60 backdrop-blur rounded-xl mb-2 border border-white/5 shadow-inner">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 min-w-[68px] min-h-[40px] px-2 py-2 text-[11px] font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${activeTab === tab.id ? 'bg-stone-700 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}>
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
                                        <div className="flex flex-wrap gap-2 pt-2.5 mt-2 border-t border-white/5">
                                            <button
                                                type="button"
                                                onClick={() => setDirectPolygonEditField(field)}
                                                className="flex-1 py-2 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-sky-300 border border-sky-500/25 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                                            >
                                                <MapPin size={12} />
                                                <span>{field.polygonGeoJson ? 'Parsel Sınırını Düzenle' : 'Parsel Sınırı Çiz'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!field.polygonGeoJson) {
                                                        setDirectPolygonEditField(field);
                                                        showToast('Uydu analizi için önce tarlanın sınır poligonunu çizin.', 'info');
                                                    } else {
                                                        setSatelliteTargetField(field);
                                                    }
                                                }}
                                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/35 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                                            >
                                                <Satellite size={12} />
                                                <span>Uydu Analizi (NDVI / Sulama / Çamur)</span>
                                            </button>
                                        </div>
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
                                <div className="flex flex-wrap gap-1.5 w-full">
                                    <button onClick={() => setIsReportModalOpen(true)} className="flex-1 min-w-[68px] bg-blue-600 text-white px-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center">
                                        <Download size={10} className="mr-1"/> Rapor
                                    </button>
                                    <button onClick={handleGenerateFarmerReconciliationPdf} className="flex-1 min-w-[78px] bg-indigo-600 text-white px-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all flex items-center justify-center" title="Resmi Cari Hesap Mutabakat Mektubu (PDF)">
                                        <Scale size={10} className="mr-1"/> Mutabakat
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

                            {/* Yıl Seçimi ve Devir Alanı */}
                            <div className="p-3 bg-stone-950/60 rounded-xl border border-white/10 space-y-2.5">
                                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={16} className="text-emerald-400 shrink-0" />
                                        <span className="text-xs font-black text-stone-200 uppercase tracking-wide">Yıl Seçimi & Devir</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 bg-stone-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-stone-300 text-xs font-bold shadow-sm">
                                        <Calendar size={14} className="text-emerald-400 shrink-0" />
                                        <select 
                                            value={selectedYear}
                                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                                            className="bg-transparent text-stone-200 text-xs font-bold outline-none cursor-pointer pr-1"
                                        >
                                            {availableYears.map(y => (
                                                <option key={y} value={y} className="bg-stone-900 text-stone-200">
                                                    {y} Yılı {y < currentYear ? '(Devir)' : '(Güncel)'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-stone-400 font-bold block uppercase tracking-wider">
                                            01.01.{selectedYear} Devir Bakiyesi
                                        </span>
                                        <span className="text-[9px] text-stone-500 block">Geçmiş yıllardan aktarılan açılış bakiyesi</span>
                                    </div>
                                    <span className={`text-sm font-black font-mono ${openingBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {openingBalance >= 0 ? '+' : ''}{formatCurrency(openingBalance, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>

                                {selectedYear < currentYear && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-center gap-2 text-amber-300 text-[11px] font-medium">
                                        <Calendar size={14} className="text-amber-400 shrink-0" />
                                        <span>{selectedYear} Yılı devir kaydı ve geçmiş cari dökümü gösteriliyor.</span>
                                    </div>
                                )}
                            </div>

                            {/* Detailed Financial & Profitability Analysis Action Button (Küçültülmüş) */}
                            <button
                                onClick={() => setIsFinancialAnalysisOpen(true)}
                                className="w-full mt-2.5 px-3 py-2 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/20 rounded-xl flex items-center justify-between text-emerald-400 transition-all active:scale-[0.98] group shadow-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <TrendingUpIcon size={14} className="text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold">Detaylı Finansal Analiz & Kârlılık</span>
                                </div>
                                <ChevronRight size={14} className="text-emerald-400/70 group-hover:translate-x-0.5 transition-transform" />
                            </button>
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
                                    ...filteredPrescriptions.map(p => {
                                        const isReturn = p.type === 'RETURN' || (p.totalAmount || 0) < 0;
                                        return { 
                                            ...p, 
                                            type: p.priceType === 'CASH' ? 'CASH' : 'DEBT', 
                                            label: p.priceType === 'CASH' ? 'Peşin Satış' : (isReturn ? 'İade Makbuzu' : `${prescriptionLabel} Satışı`) 
                                        };
                                    }), 
                                    ...filteredPayments.map(p => ({ ...p, type: 'PAYMENT', label: 'Tahsilat' })),
                                    ...filteredManualDebts.filter(d => !d.id.startsWith('turnover-')).map(d => ({ ...d, type: 'DEBT', label: 'Manuel Borç/Alacak' }))
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
                                                    } else if (item.label === 'Manuel Borç/Alacak') {
                                                        const debt = farmerManualDebts.find(d => d.id === item.id);
                                                        if (debt) handleEditManualDebt(debt);
                                                    } else if (item.label === 'Tahsilat') {
                                                        const payment = farmerPayments.find(p => p.id === item.id);
                                                        if (payment) handleEditPayment(payment);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.type === 'DEBT' ? (((item as any).totalAmount !== undefined ? (item as any).totalAmount < 0 : (item as any).amount < 0) || item.label === 'İade Makbuzu' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' : 'bg-rose-900/20 text-rose-500') : item.type === 'CASH' ? 'bg-blue-900/20 text-blue-500' : 'bg-emerald-900/20 text-emerald-500'}`}>
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
                                                        <p className={`text-xs font-black ${item.type === 'DEBT' ? (((item as any).totalAmount !== undefined ? (item as any).totalAmount < 0 : (item as any).amount < 0) || item.label === 'İade Makbuzu' ? 'text-emerald-400' : 'text-rose-400') : item.type === 'CASH' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                            {item.type === 'DEBT' ? (((item as any).totalAmount !== undefined ? (item as any).totalAmount < 0 : (item as any).amount < 0) || item.label === 'İade Makbuzu' ? '+' : '-') : item.type === 'CASH' ? '' : '+'}{formatCurrency(Math.abs((item as any).amount || (item as any).totalAmount), userProfile?.currency || 'TRY')}
                                                        </p>
                                                        {(item as any).note && <p className="text-[7px] text-stone-500 italic truncate max-w-[60px]">{(item as any).note}</p>}
                                                    </div>
                                                    {item.type === 'PAYMENT' ? (
                                                        <div className="flex gap-2 items-center">
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button onClick={(e) => { e.stopPropagation(); handleEditPayment(item as any); }} className="p-1 text-stone-500 hover:text-emerald-500">
                                                                    <Edit2 size={12}/>
                                                                </button>
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeletePayment(item.id); }} className="p-1 text-stone-500 hover:text-rose-500 transition-all">
                                                                    <Trash2 size={12}/>
                                                                </button>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); handleSendReceipt(item as any); }} className="px-2 py-0.5 text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-all flex items-center justify-center">
                                                                MAKBUZ
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        (item.label === 'Manuel Borç' || item.label === 'Manuel Borç/Alacak') && (
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
                         {isDataLoading ? <Loader2 size={20} className="animate-spin text-amber-500 mx-auto"/> : filteredPrescriptions.length > 0 ? filteredPrescriptions.map(p => {
                            const isReturn = p.type === 'RETURN' || (p.totalAmount || 0) < 0;
                            return (
                            <div key={p.id} onClick={() => setSelectedPrescription(p)} className="bg-stone-900/80 p-3 rounded-xl border border-white/5 hover:bg-stone-800 transition-colors cursor-pointer active:scale-98">
                                <div className="flex justify-between items-start mb-1.5">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[8px] font-mono text-stone-500 block uppercase">No: {p.prescriptionNo}</span>
                                        {isReturn && (
                                            <span className="text-[7px] font-black text-emerald-500 bg-emerald-900/30 px-1 border border-emerald-500/30 rounded uppercase tracking-tighter w-fit">İADE</span>
                                        )}
                                    </div>
                                    <span className={`text-[9px] font-bold ${isReturn ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/30' : 'text-amber-400 bg-amber-900/20 border-amber-800/30'} px-1.5 py-0.5 rounded border`}>{new Date(p.date).toLocaleDateString('tr-TR')}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">{p.items.map((item, idx) => (<span key={idx} className="text-[8px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded flex items-center"><FlaskConical size={8} className="mr-1 text-stone-500"/>{item.pesticideName}</span>))}</div>
                            </div>
                        )}) : <div className="text-center py-6 text-stone-600 text-[10px]">{prescriptionLabel} yok.</div>}
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
                        
                        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                            {!editingPayment && (
                                <div className="flex items-center justify-between bg-stone-950 border border-white/10 rounded-2xl p-2.5">
                                    <div className="flex items-center gap-2">
                                        <Split size={14} className="text-emerald-400" />
                                        <div>
                                            <span className="text-[11px] font-black text-stone-200 block">Parçalı / Karma Tahsilat</span>
                                            <span className="text-[9px] text-stone-500">Nakit + Kart + Çek aynı anda tahsil et</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsFarmerSplitPayment(prev => !prev)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                                            isFarmerSplitPayment
                                                ? 'bg-emerald-600 text-white border-emerald-400'
                                                : 'bg-stone-900 text-stone-400 border-white/10 hover:text-white'
                                        }`}
                                    >
                                        {isFarmerSplitPayment ? 'Aktif' : 'Aç'}
                                    </button>
                                </div>
                            )}

                            {!editingPayment && isFarmerSplitPayment ? (
                                <div className="space-y-2.5">
                                    {farmerSplitRows.map((row, rIdx) => (
                                        <div key={row.id} className="bg-stone-950 border border-white/10 rounded-2xl p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-emerald-400 uppercase">{rIdx + 1}. Ödeme Kalemi</span>
                                                {farmerSplitRows.length > 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFarmerSplitRows(prev => prev.filter(r => r.id !== row.id))}
                                                        className="text-stone-500 hover:text-rose-400"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {[
                                                    { id: 'CASH', label: 'Nakit' },
                                                    { id: 'CARD', label: 'K. Kartı' },
                                                    { id: 'CHECK', label: 'Çek' },
                                                    { id: 'TEDYE', label: 'Tediye' }
                                                ].map(m => (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => setFarmerSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, method: m.id as any } : r))}
                                                        className={`min-h-[40px] py-2 rounded-xl text-xs font-bold border ${
                                                            row.method === m.id
                                                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                                                : 'bg-stone-900 border-stone-800 text-stone-400'
                                                        }`}
                                                    >
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="Tutar (0.00)"
                                                    value={row.amount}
                                                    onChange={e => setFarmerSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r))}
                                                    className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl font-mono font-black text-emerald-400 text-sm outline-none"
                                                />
                                                <select
                                                    value={row.accountId}
                                                    onChange={e => setFarmerSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, accountId: e.target.value } : r))}
                                                    className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 outline-none"
                                                >
                                                    <option value="">Varsayılan Hesap</option>
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {row.method === 'CARD' && (
                                                <select
                                                    value={row.cardOption}
                                                    onChange={e => setFarmerSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, cardOption: e.target.value as CardSettlementOption } : r))}
                                                    className="w-full p-2 bg-stone-900 border border-amber-500/20 rounded-xl text-[11px] font-bold text-amber-300 outline-none"
                                                >
                                                    <option value="UNBLOCKED">Blokesiz (Anında)</option>
                                                    <option value="DAYS_15">15 Gün POS Bloke (%0 Komisyon)</option>
                                                    <option value="DAYS_30">30 Gün POS Bloke (%0 Komisyon)</option>
                                                    <option value="DAYS_45">45 Gün POS Bloke (%0 Komisyon)</option>
                                                </select>
                                            )}
                                            {(row.method === 'CHECK' || row.method === 'TEDYE') && (
                                                <input
                                                    type="date"
                                                    value={row.dueDate}
                                                    onChange={e => setFarmerSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, dueDate: e.target.value } : r))}
                                                    className="w-full p-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 outline-none"
                                                />
                                            )}
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between pt-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFarmerSplitRows(prev => [
                                                    ...prev,
                                                    { id: `fsp-${Date.now()}`, method: 'CHECK', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'UNBLOCKED' }
                                                ])
                                            }
                                            className="px-3 py-1.5 rounded-xl bg-stone-800 text-stone-300 text-[10px] font-black uppercase flex items-center gap-1"
                                        >
                                            <Plus size={12} /> Kalem Ekle
                                        </button>
                                        <div className="text-right">
                                            <span className="text-[9px] text-stone-500 uppercase font-bold block">Toplam Tahsilat</span>
                                            <span className="text-sm font-black text-emerald-400 font-mono">
                                                {formatCurrency(farmerSplitRows.reduce((s, r) => s + parseFloatSafe(r.amount), 0), userProfile?.currency || 'TRY')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                            <>
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
                                <label className="text-xs font-bold text-stone-400 ml-1 mb-1 block">Ödeme Yöntemi</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'CASH', label: 'Nakit' },
                                        { id: 'CARD', label: 'K. Kartı' },
                                        { id: 'CHECK', label: 'Çek' },
                                        { id: 'TEDYE', label: 'Tediye' }
                                    ].map(method => (
                                        <button 
                                            key={method.id}
                                            onClick={() => setPaymentMethod(method.id as any)}
                                            className={`min-h-[42px] py-2.5 rounded-xl text-xs font-bold border transition-all ${paymentMethod === method.id ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm' : 'bg-stone-950 border-stone-800 text-stone-400'}`}
                                        >
                                            {method.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {paymentMethod === 'CARD' && (
                                <div className="p-3.5 bg-stone-950 border border-emerald-500/20 rounded-2xl space-y-3 animate-in fade-in duration-200">
                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Bloke / Valör Seçeneği</label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {[
                                                { id: 'UNBLOCKED', label: 'Blokesiz (Anında)', desc: '%4 Komisyon' },
                                                { id: 'DAYS_15', label: '15 Gün Bloke', desc: '%0 Komisyon' },
                                                { id: 'DAYS_30', label: '30 Gün Bloke', desc: '%0 Komisyon' },
                                                { id: 'DAYS_45', label: '45 Gün Bloke', desc: '%0 Komisyon' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setCardOption(opt.id as any)}
                                                    className={`p-2.5 rounded-xl border text-left transition-all ${cardOption === opt.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-700'}`}
                                                >
                                                    <div className="text-[10px] font-bold">{opt.label}</div>
                                                    <div className="text-[8px] text-stone-500">{opt.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {cardOption === 'UNBLOCKED' ? (
                                        <div className="space-y-2 pt-1 border-t border-white/5">
                                            <div className="flex items-center justify-between gap-2">
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Banka POS Komisyon Oranı (%)</label>
                                                <input 
                                                    type="number"
                                                    step="0.1"
                                                    value={commissionRate}
                                                    onChange={e => setCommissionRate(e.target.value)}
                                                    className="w-20 p-1.5 bg-stone-900 border border-stone-700 rounded-lg text-right text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500"
                                                />
                                            </div>
                                            {parseFloatSafe(paymentAmount) > 0 && (
                                                <div className="bg-emerald-950/40 border border-emerald-500/20 p-2.5 rounded-xl text-[10px] space-y-1">
                                                    <div className="flex justify-between text-stone-400">
                                                        <span>Toplam Tahsilat:</span>
                                                        <span className="font-bold text-white">{parseFloatSafe(paymentAmount).toLocaleString('tr-TR')} TL</span>
                                                    </div>
                                                    <div className="flex justify-between text-rose-400">
                                                        <span>POS Komisyonu (%{commissionRate}):</span>
                                                        <span className="font-bold">-{((parseFloatSafe(paymentAmount) * parseFloatSafe(commissionRate)) / 100).toLocaleString('tr-TR')} TL</span>
                                                    </div>
                                                    <div className="flex justify-between text-emerald-400 font-bold border-t border-emerald-500/20 pt-1">
                                                        <span>Hesaba Geçiş (Net):</span>
                                                        <span>{(parseFloatSafe(paymentAmount) - (parseFloatSafe(paymentAmount) * parseFloatSafe(commissionRate)) / 100).toLocaleString('tr-TR')} TL</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-amber-950/30 border border-amber-500/20 p-2.5 rounded-xl text-[10px] text-amber-300/90 leading-relaxed">
                                            <p className="font-bold text-amber-400 mb-0.5">ⓘ Bloke Süreci Bilgilendirmesi</p>
                                            <p>Çiftçiden tüm tutar <strong>tahsil edilecek</strong> ve borcu kapanacaktır. Tutar komisyonsuz olarak <strong>{cardOption === 'DAYS_15' ? '15' : cardOption === 'DAYS_30' ? '30' : '45'} gün sonra ({new Date(Date.now() + (cardOption === 'DAYS_15' ? 15 : cardOption === 'DAYS_30' ? 30 : 45)*86400000).toLocaleDateString('tr-TR')})</strong> bloke kalkarak hesabınıza otomatik geçecektir.</p>
                                        </div>
                                    )}
                                </div>
                            )}

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
                            </>
                            )}
                            <div>
                                <label className="text-[9px] font-bold text-stone-500 ml-1 uppercase tracking-wider">İlgili Mahsul / Ürün (İsteğe Bağlı - Ürün Bazlı Ödeme)</label>
                                <select 
                                    value={paymentCrop}
                                    onChange={e => setPaymentCrop(e.target.value)}
                                    className="w-full h-[46px] px-4 bg-stone-950 border border-stone-800 rounded-2xl outline-none text-stone-200 text-xs focus:border-emerald-500/50 transition-all"
                                >
                                    <option value="">Genel Ödeme (Tüm Hesap)</option>
                                    {availableCrops.map(crop => (
                                        <option key={crop} value={crop}>{crop} Mahsulü İçin Ödeme</option>
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
                                disabled={isSavingPayment || (!editingPayment && isFarmerSplitPayment ? farmerSplitRows.every(r => parseFloatSafe(r.amount) <= 0) : !paymentAmount)}
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


            <FarmerManualDebtModal
                isOpen={isManualDebtModalOpen}
                editingManualDebt={editingManualDebt}
                debtDate={debtDate}
                setDebtDate={setDebtDate}
                debtAmount={debtAmount}
                setDebtAmount={setDebtAmount}
                debtNote={debtNote}
                setDebtNote={setDebtNote}
                isSavingDebt={isSavingDebt}
                currency={userProfile?.currency}
                onClose={() => { setIsManualDebtModalOpen(false); setEditingManualDebt(null); }}
                onSave={handleSaveManualDebt}
                onDelete={handleDeleteManualDebt}
            />

            <FarmerReportFilterModal
                isOpen={isReportModalOpen}
                selectedFarmer={selectedFarmer}
                availableYears={availableYears}
                availableCrops={availableCrops}
                reportStartDate={reportStartDate}
                setReportStartDate={setReportStartDate}
                reportEndDate={reportEndDate}
                setReportEndDate={setReportEndDate}
                reportType={reportType}
                setReportType={setReportType}
                reportCrop={reportCrop}
                setReportCrop={setReportCrop}
                reportFieldId={reportFieldId}
                setReportFieldId={setReportFieldId}
                onClose={() => setIsReportModalOpen(false)}
                onViewReport={() => { setIsViewingReport(true); setIsReportModalOpen(false); }}
            />

            {selectedPrescription && !isProcessingPdf && (
                <div className="hidden"></div>
            )}

            {selectedFarmer && (
                <FarmerFinancialAnalysisModal
                    isOpen={isFinancialAnalysisOpen}
                    onClose={() => setIsFinancialAnalysisOpen(false)}
                    farmer={selectedFarmer}
                    farmerLabel={farmerLabel}
                    prescriptions={farmerPrescriptions}
                    payments={farmerPayments}
                    manualDebts={farmerManualDebts}
                    myPayments={myPayments}
                    inventory={inventory}
                    visits={farmerVisits}
                    currency={userProfile?.currency}
                />
            )}

            {selectedFarmer && directPolygonEditField && (
                <FieldPolygonDrawerModal
                    isOpen={true}
                    fieldName={`${selectedFarmer.fullName} • ${directPolygonEditField.name || directPolygonEditField.crop}`}
                    initialGeoJson={directPolygonEditField.polygonGeoJson}
                    initialCenter={
                        directPolygonEditField.centroidLat && directPolygonEditField.centroidLng
                            ? { lat: directPolygonEditField.centroidLat, lng: directPolygonEditField.centroidLng }
                            : selectedFarmer.latitude && selectedFarmer.longitude
                            ? { lat: selectedFarmer.latitude, lng: selectedFarmer.longitude }
                            : undefined
                    }
                    onClose={() => setDirectPolygonEditField(null)}
                    onSave={async (payload) => {
                        const updatedField: Field = {
                            ...directPolygonEditField,
                            size: payload.dekar,
                            polygonGeoJson: payload.polygonGeoJson,
                            polygonBbox: payload.polygonBbox,
                            centroidLat: payload.centroidLat,
                            centroidLng: payload.centroidLng,
                            tkgmIl: payload.tkgmIl || directPolygonEditField.tkgmIl,
                            tkgmIlce: payload.tkgmIlce || directPolygonEditField.tkgmIlce,
                            tkgmMahalle: payload.tkgmMahalle || directPolygonEditField.tkgmMahalle,
                            tkgmAda: payload.tkgmAda || directPolygonEditField.tkgmAda,
                            tkgmParsel: payload.tkgmParsel || directPolygonEditField.tkgmParsel,
                        };
                        const updatedFarmer: Farmer = {
                            ...selectedFarmer,
                            latitude: selectedFarmer.latitude || payload.centroidLat,
                            longitude: selectedFarmer.longitude || payload.centroidLng,
                            fields: (selectedFarmer.fields || []).map((f: Field) =>
                                f.id === updatedField.id ? updatedField : f
                            ),
                        };
                        await updateFarmer(updatedFarmer);
                        setSelectedFarmer(updatedFarmer);
                        setDirectPolygonEditField(null);
                        setSatelliteTargetField(updatedField);
                        showToast(`Parsel sınırı (${payload.dekar} daa) kaydedildi.`, 'success');
                    }}
                />
            )}

            {selectedFarmer && satelliteTargetField && (
                <FieldSatelliteAnalyzerModal
                    isOpen={true}
                    field={satelliteTargetField}
                    farmerName={selectedFarmer.fullName}
                    onClose={() => setSatelliteTargetField(null)}
                    onEditPolygon={() => {
                        const fld = satelliteTargetField;
                        setSatelliteTargetField(null);
                        setDirectPolygonEditField(fld);
                    }}
                />
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
                  onClick={() => {
                      setIsRepairModalOpen(true);
                      handleAnalyzeFarmers();
                  }}
                  className="py-1.5 px-3 bg-red-600/20 border border-red-500/30 rounded-lg text-red-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-red-600/30 transition-colors shadow-lg shadow-red-900/20"
              >
                  <RefreshCw size={14} />
                  Cari Onar
              </button>
              <button 
                  onClick={downloadFarmersPdf}
                  className="py-1.5 px-3 bg-amber-600 rounded-lg text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-900/20"
              >
                  <FileText size={14} />
                  Raporla
              </button>
              <button
                  onClick={() => {
                      setAnnounceTemplate(userProfile?.whatsappTemplates?.announcement || DEFAULT_WHATSAPP_TEMPLATES.announcement);
                      setSentAnnouncementFarmerIds(new Set());
                      setIsAnnouncementModalOpen(true);
                  }}
                  className="py-1.5 px-3 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 hover:bg-emerald-600/30 transition-colors"
                  title="Köy ve Mahsul Bazlı Toplu WhatsApp Zirai Duyuru"
              >
                  <Megaphone size={13} />
                  Toplu Duyuru
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
                        <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap">
                             <span className="text-[8px] text-stone-500 flex items-center bg-stone-950/50 px-1 py-0.5 rounded border border-white/5 font-medium"><MapPin size={7} className="mr-1 text-emerald-500/70"/> {farmer.village}</span>
                             {farmer.tcNo && (
                                <span className="text-[8px] text-stone-400 bg-stone-950/50 px-1 py-0.5 rounded border border-white/5 font-mono">
                                    TC: {farmer.tcNo}
                                </span>
                             )}
                             {farmer.fields && farmer.fields.length > 0 && (
                                <span className="text-[8px] text-amber-500/80 bg-amber-900/10 px-1 py-0.5 rounded border border-amber-800/20 font-bold">
                                    {farmer.fields.length} Tarla
                                </span>
                             )}
                             {(farmer as any).effectiveRiskGrade && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded border font-black ${
                                    (farmer as any).effectiveRiskGrade === 'A' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                    (farmer as any).effectiveRiskGrade === 'B' ? 'bg-sky-500/15 text-sky-400 border-sky-500/30' :
                                    (farmer as any).effectiveRiskGrade === 'C' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                    'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                }`}>
                                    Not: {(farmer as any).effectiveRiskGrade}
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
                            changeFarmerSelection(farmer);
                            setIsFinancialAnalysisOpen(true);
                        }}
                        title="Finansal Analiz & Kârlılık"
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all border border-emerald-500/20 active:scale-95 flex items-center gap-1"
                    >
                        <TrendingUpIcon size={12} />
                        <span className="text-[9px] font-bold hidden sm:inline">Finans</span>
                    </button>
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

      <FarmerContactImportModal
        isOpen={isImportModalOpen}
        importPreviewList={importPreviewList}
        selectedImportIds={selectedImportIds}
        isImporting={isImporting}
        onClose={() => setIsImportModalOpen(false)}
        onToggleSelect={toggleSelectImport}
        onConfirmImport={confirmBulkImport}
      />

      {/* ADD/EDIT MODAL FOR LIST VIEW */}
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

      <FarmerBalanceRepairModal
        isOpen={isRepairModalOpen}
        repairState={repairState}
        repairMismatches={repairMismatches}
        selectedRepairs={selectedRepairs}
        setSelectedRepairs={setSelectedRepairs}
        onClose={() => {
            setIsRepairModalOpen(false);
            setRepairState('IDLE');
        }}
        onRepair={handleRepairFarmers}
      />

      {/* Toplu Köy / Ürün Bazlı WhatsApp Zirai Duyuru Modalı (#37) */}
      {isAnnouncementModalOpen && (() => {
          const villages = Array.from(new Set<string>(farmers.map(f => (f.village || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr-TR'));
          const crops = Array.from(new Set<string>(farmers.flatMap(f => (f.fields || []).map(fl => (fl.crop || '').trim())).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr-TR'));
          const targetRecipients = farmers.filter(f => {
              const villageOk = announceVillage === 'ALL' || (f.village || '').trim() === announceVillage;
              const cropOk = announceCrop === 'ALL' || (f.fields || []).some(fl => (fl.crop || '').trim() === announceCrop);
              return villageOk && cropOk && Boolean(normalizeWaPhone(f.phoneNumber));
          });
          const nextPendingFarmer = targetRecipients.find(f => !sentAnnouncementFarmerIds.has(f.id));

          const sendToFarmer = (farmerTarget: Farmer) => {
              const joinedCrops = Array.from(new Set((farmerTarget.fields || []).map(fl => fl.crop).filter(Boolean))).join(', ');
              const farmerCrops = joinedCrops || (announceCrop !== 'ALL' ? announceCrop : 'Genel Mahsul');
              const msg = renderWhatsAppTemplate(announceTemplate, 'announcement', {
                  firma: userProfile?.companyName || 'Zirai Mühendislik',
                  isim: farmerTarget.fullName,
                  koy: farmerTarget.village || '-',
                  mahsul: announceCrop !== 'ALL' ? announceCrop : farmerCrops,
                  tarih: new Date().toLocaleDateString('tr-TR'),
              });
              const phone = normalizeWaPhone(farmerTarget.phoneNumber);
              if (!phone) {
                  showToast('Geçerli telefon numarası bulunamadı', 'error');
                  return;
              }
              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
              setSentAnnouncementFarmerIds(prev => {
                  const next = new Set(prev);
                  next.add(farmerTarget.id);
                  return next;
              });
          };

          return (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-stone-900 border border-emerald-500/25 w-full max-w-lg rounded-3xl p-5 shadow-2xl max-h-[90vh] flex flex-col">
                      <div className="flex items-center justify-between mb-4 shrink-0">
                          <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                                  <Megaphone size={20} />
                              </div>
                              <div>
                                  <h3 className="text-base font-black text-stone-100">Toplu Zirai WhatsApp Duyurusu</h3>
                                  <p className="text-[11px] text-stone-400">Köy ve mahsule göre hedef üreticilere don, hastalık veya ilaçlama uyarısı gönderin</p>
                              </div>
                          </div>
                          <button onClick={() => setIsAnnouncementModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white">
                              <X size={16} />
                          </button>
                      </div>

                      <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar flex-1">
                          <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                  <label className="text-[9px] font-black text-stone-500 uppercase tracking-wider ml-1 mb-1 block">Köy / Bölge Filtresi</label>
                                  <select
                                      value={announceVillage}
                                      onChange={e => setAnnounceVillage(e.target.value)}
                                      className="w-full bg-stone-950 border border-white/10 rounded-xl p-2.5 text-xs text-stone-100 outline-none"
                                  >
                                      <option value="ALL">Tüm Köyler ({villages.length})</option>
                                      {villages.map(v => (
                                          <option key={v} value={v}>{v}</option>
                                      ))}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-[9px] font-black text-stone-500 uppercase tracking-wider ml-1 mb-1 block">Mahsul Filtresi</label>
                                  <select
                                      value={announceCrop}
                                      onChange={e => setAnnounceCrop(e.target.value)}
                                      className="w-full bg-stone-950 border border-white/10 rounded-xl p-2.5 text-xs text-stone-100 outline-none"
                                  >
                                      <option value="ALL">Tüm Mahsuller ({crops.length})</option>
                                      {crops.map(c => (
                                          <option key={c} value={c}>{c}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>

                          <div>
                              <div className="flex items-center justify-between mb-1">
                                  <label className="text-[9px] font-black text-stone-500 uppercase tracking-wider ml-1">Duyuru Mesajı ({'{isim}'}, {'{koy}'}, {'{mahsul}'}, {'{firma}'})</label>
                              </div>
                              <textarea
                                  value={announceTemplate}
                                  onChange={e => setAnnounceTemplate(e.target.value)}
                                  className="w-full bg-stone-950 border border-white/10 rounded-2xl p-3 text-xs text-stone-100 outline-none focus:border-emerald-500/50 h-28 resize-none"
                              />
                          </div>

                          <div className="bg-stone-950/80 border border-white/5 rounded-2xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-wider">
                                      Hedef Alıcılar ({sentAnnouncementFarmerIds.size}/{targetRecipients.length} Gönderildi)
                                  </span>
                                  {nextPendingFarmer && (
                                      <button
                                          type="button"
                                          onClick={() => sendToFarmer(nextPendingFarmer)}
                                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                                      >
                                          <Send size={11} /> Sıradakine Gönder ({nextPendingFarmer.fullName.split(' ')[0]})
                                      </button>
                                  )}
                              </div>
                              {targetRecipients.length === 0 ? (
                                  <p className="text-xs text-stone-500 py-3 text-center">Seçilen köy/mahsul kriterine uyan telefonlu üretici bulunamadı.</p>
                              ) : (
                                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                      {targetRecipients.map(rec => {
                                          const isSent = sentAnnouncementFarmerIds.has(rec.id);
                                          return (
                                              <div key={rec.id} className="flex items-center justify-between bg-stone-900/90 border border-white/5 rounded-xl px-3 py-2">
                                                  <div>
                                                      <span className="text-xs font-bold text-stone-200">{rec.fullName}</span>
                                                      <span className="text-[10px] text-stone-500 ml-2">{rec.village}</span>
                                                  </div>
                                                  <button
                                                      type="button"
                                                      onClick={() => sendToFarmer(rec)}
                                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                                                          isSent
                                                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                              : 'bg-stone-800 text-stone-200 border-white/10 hover:bg-emerald-600 hover:text-white'
                                                      }`}
                                                  >
                                                      {isSent ? '✓ Gönderildi' : 'WP Gönder'}
                                                  </button>
                                              </div>
                                          );
                                      })}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          );
      })()}

      <DebtReminderModal
        isOpen={isDebtReminderModalOpen}
        onClose={() => setIsDebtReminderModalOpen(false)}
        farmersWithDebt={farmersWithDebt}
        allFarmers={farmers}
        currency={(userProfile?.currency as 'TRY' | 'USD' | 'EUR') || 'TRY'}
        farmerLabel={farmerLabel}
        engineerId={currentUser?.uid || ''}
        companyName={userProfile?.companyName || 'MKS Mühendisim'}
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

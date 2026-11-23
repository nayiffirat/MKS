import { archivePdf } from '../utils/pdfArchive';
import { createMultiPagePdf, renderElementToCanvas } from '../utils/pdfHelper';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../services/db';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ContactService, ContactInfo } from '../services/contact';
import { Farmer, Field, VisitLog, Prescription, ManualDebt, Payment, Pesticide, CardSettlementOption } from '../types';
import { Search, Phone, MessageCircle, MapPin, Wheat, ChevronLeft, ChevronRight, Contact, Loader2, User, Users, FileText, Calendar, Navigation, Plus, X, ArrowLeft, Edit2, Trash2, Check, FlaskConical, Clock, ImageIcon, RefreshCw, RefreshCcw, Wallet, History, CreditCard, TrendingDown, TrendingUp as TrendingUpIcon, Send, Copy, ClipboardList, Scale, ShieldCheck, Satellite, Megaphone, Split, Download } from 'lucide-react';
import { renderWhatsAppTemplate, normalizeWaPhone, DEFAULT_WHATSAPP_TEMPLATES, buildWaUrl } from '../utils/whatsappTemplates';
import { parseTrDecimal } from '../utils/currency';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { getLocalDateString } from '../utils/dateUtils';
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
    visits: contextVisits,
    softDeleteVisit, 
    showToast, 
    hapticFeedback, 
    activeTeamMember,
    teamMembers,
    farmerLabel,
    prescriptionLabel,
    inventory,
    addPrescription,
    softDeletePrescription,
    refreshStats,
    t
  } = useAppViewModel();
  const isSales = activeTeamMember?.role === 'SALES';

  const canEditFarmer = !isSales;
  const canCreateFarmer = canEditFarmer;
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [listFilter, setListFilter] = useState<'ALL' | 'DEBT' | 'CREDIT' | 'ZERO'>('ALL');
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
      { id: 'fsp-1', method: 'CASH', amount: '', accountId: '', dueDate: getLocalDateString(), cardOption: 'UNBLOCKED' },
      { id: 'fsp-2', method: 'CARD', amount: '', accountId: '', dueDate: getLocalDateString(), cardOption: 'DAYS_30' },
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
        { id: 'DEBT', label: 'Borç / Tahsilat', icon: Wallet },
        { id: 'PRESCRIPTIONS', label: prescriptionLabel, icon: FileText },
        { id: 'VISITS', label: 'Reçeteler', icon: ClipboardList },
        { id: 'GENERAL', label: 'Genel Bilgiler', icon: User }
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
  const [paymentDate, setPaymentDate] = useState(getLocalDateString());
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
  const [debtDate, setDebtDate] = useState(getLocalDateString());
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
          await refreshStats();
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    if (contextFarmers && contextFarmers.length >= 0) {
      const activeList = contextFarmers.filter(f => !f.deletedAt);
      setFarmers(activeList);
      setIsLoading(false);
      setSelectedFarmer(prev => prev ? (activeList.find(f => f.id === prev.id) || null) : null);
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

  useEffect(() => {
    if (!selectedFarmer) return;
    loadFarmerDetails();
    const onCloudSync = () => {
      loadFarmerDetails();
    };
    window.addEventListener('mks-cloud-sync-applied', onCloudSync);
    return () => window.removeEventListener('mks-cloud-sync-applied', onCloudSync);
  }, [selectedFarmer?.id, contextVisits]);

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
              balance -= (Number(d.amount) || 0);
          }
      });
      
      farmerPayments.forEach(p => {
          if (!bouncedRelatedIds.has(p.id) && new Date(p.date).getFullYear() < selectedYear) {
              balance += (Number(p.amount) || 0);
          }
      });

      getIndependentFarmerMyPayments(myPayments, selectedFarmer?.id).forEach(p => {
          if (new Date(p.date).getFullYear() < selectedYear) {
              balance += (Number(p.amount) || 0);
          }
      });
      
      return balance;
  }, [farmerPrescriptions, farmerManualDebts, farmerPayments, myPayments, bouncedRelatedIds, selectedYear, selectedFarmer]);

  const yearTotalPaid = useMemo(() => filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0), [filteredPayments]);
  const yearTotalDebt = useMemo(() => 
    filteredPrescriptions.filter(p => p.priceType !== 'CASH').reduce((acc, p) => {
        const amt = Number(p.totalAmount) || 0;
        const isReturn = p.type === 'RETURN' || amt < 0;
        return acc + (isReturn ? -Math.abs(amt) : Math.abs(amt));
    }, 0) + 
    filteredManualDebts.filter(d => !d.id.startsWith('turnover-')).reduce((acc, d) => acc + (Number(d.amount) || 0), 0),
  [filteredPrescriptions, filteredManualDebts]);

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
      
      const url = buildWaUrl(selectedFarmer.phoneNumber, text) || `https://wa.me/?text=${encodeURIComponent(text)}`;
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
            void archivePdf(fileName, pdfBlob);
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
      if (isImporting) return;
      const toAdd = importPreviewList.filter(c => selectedImportIds.has(c.id)).map(c => ({ 
          fullName: c.fullName, 
          phoneNumber: c.phoneNumber, 
          village: 'Rehberden Aktarıldı', 
          fields: [{ id: crypto.randomUUID(), name: 'Genel', size: 0, crop: 'Belirtilmedi' }] 
      }));
      if (toAdd.length > 0) {
          setIsImporting(true);
          try {
              await bulkAddFarmers(toAdd);
              await loadFarmers();
              setIsImportModalOpen(false);
              setImportPreviewList([]);
              showToast(`${toAdd.length} çiftçi eklendi.`, "success");
          } finally {
              setIsImporting(false);
          }
      }
  };

  const toggleSelectImport = (contact: TempContact) => {
      if (contact.isAlreadyRegistered) return;
      const newSelected = new Set(selectedImportIds);
      if (newSelected.has(contact.id)) newSelected.delete(contact.id); else newSelected.add(contact.id);
      setSelectedImportIds(newSelected);
  };

  const handleSaveFarmer = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isSavingFarmer) return;
      const tcCheck = validateTcOrVkn(editFarmerData.tcNo);
      if (!tcCheck.isValid) {
          showToast(tcCheck.message, 'error');
          return;
      }
      setIsSavingFarmer(true);
      try {
          const parsedCreditLimit = editFarmerData.creditLimit !== undefined && String(editFarmerData.creditLimit).trim() !== ''
              ? parseTrDecimal(editFarmerData.creditLimit)
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
                  size: parseTrDecimal(f.size),
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
              size: String(f.size ?? ''),
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
                  { id: 'fsp-1', method: 'CASH', amount: '', accountId: '', dueDate: getLocalDateString(), cardOption: 'UNBLOCKED' },
                  { id: 'fsp-2', method: 'CARD', amount: '', accountId: '', dueDate: getLocalDateString(), cardOption: 'DAYS_30' },
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
          setPaymentDate(getLocalDateString());
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
          
          await addPrescription(prescriptionData);
          
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
              <div id="receipt-print-${escapeHtml(payment.id)}" style="width: 420px; padding: 40px; background: white; color: #1c1917; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  <div style="text-align: center; margin-bottom: 24px;">
                      <h2 style="margin: 0; font-size: 24px; font-weight: 900; color: #064e3b; text-transform: uppercase;">${escapeHtml(userProfile?.companyName || 'ZİRAİ OTOMASYON')}</h2>
                      <p style="margin: 5px 0 0; font-size: 13px; font-weight: 700; color: #57534e; letter-spacing: 2px;">TAHSİLAT DEKONTU</p>
                  </div>
                  <div style="border-top: 2px dashed #d6d3d1; margin: 16px 0;"></div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Tarih:</span>
                      <strong style="color: #292524;">${escapeHtml(dateStr)}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Müşteri:</span>
                      <strong style="color: #292524;">${escapeHtml(farmerName)}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Ödeme Yöntemi:</span>
                      <strong style="color: #292524;">${escapeHtml(paymentTypeStr)}</strong>
                  </div>
                  ${payment.dueDate ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Vade Tarihi:</span>
                      <strong style="color: #292524;">${escapeHtml(new Date(payment.dueDate).toLocaleDateString('tr-TR'))}</strong>
                  </div>` : ''}
                  ${payment.note ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                      <span style="color: #78716c; font-weight: 600;">Açıklama:</span>
                      <strong style="color: #292524;">${escapeHtml(payment.note)}</strong>
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
                      <div style="border: 2px solid ${/^#[0-9a-fA-F]{3,8}$/.test(String(userProfile?.stampColor || '').trim()) ? String(userProfile?.stampColor).trim() : '#1d4ed8'}; border-radius: 6px; padding: 6px 10px; transform: rotate(-2.5deg); color: ${/^#[0-9a-fA-F]{3,8}$/.test(String(userProfile?.stampColor || '').trim()) ? String(userProfile?.stampColor).trim() : '#1d4ed8'}; font-size: 8px; text-align: center; max-width: 190px;">
                          <div style="font-weight: 900; text-transform: uppercase; border-bottom: 1px solid ${/^#[0-9a-fA-F]{3,8}$/.test(String(userProfile?.stampColor || '').trim()) ? String(userProfile?.stampColor).trim() : '#1d4ed8'}; padding-bottom: 2px; margin-bottom: 2px; font-size: 8.5px;">
                              ${escapeHtml((userProfile?.stampTitle || userProfile?.companyName || 'ZİRAİ OTOMASYON').toUpperCase())}
                          </div>
                          <div style="font-weight: 800; font-size: 8px; margin-bottom: 1px;">
                              ${escapeHtml(userProfile?.stampSubTitle || userProfile?.fullName || 'Ziraat Mühendisi')}
                          </div>
                          <div style="font-size: 7.5px; opacity: 0.9;">
                              ${escapeHtml(userProfile?.stampTaxInfo || 'Resmi Dijital Onaylı Kaşe')}
                          </div>
                      </div>
                  </div>
              </div>
          `;
          document.body.appendChild(container);
          let canvas: HTMLCanvasElement;
          try {
              const elementToCapture = container.firstElementChild as HTMLElement;
              canvas = await renderElementToCanvas(elementToCapture, {
                  scale: 3, 
                  backgroundColor: '#ffffff',
                  useCORS: true,
                  logging: false
              });
          } finally {
              if (container.parentNode) container.parentNode.removeChild(container);
          }
          
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
            void archivePdf(fileName, pdfBlob);
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
              } catch {
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
          setDebtDate(getLocalDateString());
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
      setDebtDate(getLocalDateString(debt.date));
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
      
      const url = buildWaUrl(selectedFarmer.phoneNumber, text) || `https://wa.me/?text=${encodeURIComponent(text)}`;
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
            void archivePdf(fileName, pdfBlob);
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
          let canvas: HTMLCanvasElement;
          try {
              canvas = await renderElementToCanvas(container.firstElementChild as HTMLElement, {
                  scale: 3,
                  backgroundColor: '#ffffff',
                  useCORS: true,
                  logging: false,
              });
          } finally {
              if (container.parentNode) container.parentNode.removeChild(container);
          }
          const pdf = await createMultiPagePdf(canvas);
          const charMap: {[key: string]: string} = {'Ğ':'G','ğ':'g','Ü':'U','ü':'u','Ş':'S','ş':'s','İ':'I','ı':'i','Ö':'O','ö':'o','Ç':'C','ç':'c'};
          const safeName = selectedFarmer.fullName
              .replace(/[ĞğÜüŞşİıÖöÇç]/g, m => charMap[m])
              .replace(/[^a-zA-Z0-9]/g, '_');
          pdf.save(`${safeName}_Cari_Mutabakat_${getLocalDateString()}.pdf`);
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

  const farmerPortfolioSummary = useMemo(() => {
    let debtorCount = 0;
    let creditCount = 0;
    let zeroCount = 0;
    let totalReceivable = 0;
    let totalFieldsCount = 0;
    let totalDekar = 0;

    for (const f of farmersWithDebt) {
      const bal = Number(f.overallBalance) || 0;
      if (bal < -0.01) {
        debtorCount += 1;
        totalReceivable += Math.abs(bal);
      } else if (bal > 0.01) {
        creditCount += 1;
      } else {
        zeroCount += 1;
      }
      const fFields = f.fields || [];
      totalFieldsCount += fFields.length;
      for (const fl of fFields) {
        totalDekar += Number(fl.size) || 0;
      }
    }

    return {
      totalCount: farmersWithDebt.length,
      debtorCount,
      creditCount,
      zeroCount,
      totalReceivable,
      totalFieldsCount,
      totalDekar: Math.round(totalDekar * 10) / 10
    };
  }, [farmersWithDebt]);

  const filteredFarmers = useMemo(() => {
    return farmersWithDebt.filter(f => {
      if (!turkishMatchesAny([f.fullName, f.village, f.tcNo, f.phoneNumber], searchTerm)) {
        return false;
      }
      const bal = Number(f.overallBalance) || 0;
      if (listFilter === 'DEBT') return bal < -0.01;
      if (listFilter === 'CREDIT') return bal > 0.01;
      if (listFilter === 'ZERO') return Math.abs(bal) <= 0.01;
      return true;
    });
  }, [farmersWithDebt, searchTerm, listFilter]);

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
          let canvas: HTMLCanvasElement;
          try {
              canvas = await renderElementToCanvas(container, {
                  scale: 3,
                  backgroundColor: '#ffffff',
                  logging: false
              });
          } finally {
              if (container.parentNode) container.parentNode.removeChild(container);
          }
          
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

      const currency = userProfile?.currency || 'TRY';
      const totalFarmerDekar = Math.round(((selectedFarmer.fields || []).reduce((acc, f) => acc + (Number(f.size) || 0), 0)) * 10) / 10;
      const yearHistoryItems = [
          ...filteredPrescriptions.map(p => {
              const isReturn = p.type === 'RETURN' || (Number(p.totalAmount) || 0) < 0;
              return {
                  ...p,
                  type: p.priceType === 'CASH' ? 'CASH' : 'DEBT',
                  label: p.priceType === 'CASH' ? 'Peşin Satış' : (isReturn ? 'İade Makbuzu' : `${prescriptionLabel} Satışı`)
              };
          }),
          ...filteredPayments.map(p => ({ ...p, type: 'PAYMENT', label: 'Tahsilat' })),
          ...filteredManualDebts.filter(d => !d.id.startsWith('turnover-')).map(d => ({ ...d, type: 'DEBT', label: 'Manuel Borç/Alacak' }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return (
        <div className="pb-24 animate-in slide-in-from-right duration-300 max-w-7xl mx-auto">
            {/* KATMAN 1: Kurumsal Çiftçi Kimlik & İletişim Kartı */}
            <section className="v22-forest-card p-4 sm:p-5 rounded-3xl mb-4 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => changeFarmerSelection(null)}
                            aria-label="Çiftçiler listesine dön"
                            className="v22-keep-white shrink-0 h-10 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center gap-1 text-xs font-bold transition-colors active:scale-95"
                        >
                            <ChevronLeft size={16} />
                            <span className="hidden sm:inline">Çiftçiler</span>
                        </button>

                        <div className="v22-keep-white w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-xl font-black text-white shadow-sm shrink-0">
                            {selectedFarmer.fullName.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                            <h2 className="v22-keep-white text-base sm:text-xl font-black text-white truncate tracking-tight">
                                {selectedFarmer.fullName}
                            </h2>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span className="v22-keep-white inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white/10 border border-white/15 text-white/90">
                                    <MapPin size={11} className="text-emerald-300 shrink-0" />
                                    {selectedFarmer.village || 'Merkez'}
                                </span>
                                <span className="v22-keep-white inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-white/10 border border-white/15 text-white/90">
                                    <Wheat size={11} className="text-amber-300 shrink-0" />
                                    {(selectedFarmer.fields || []).length} Tarla · {totalFarmerDekar} da
                                </span>
                                {selectedFarmer.tcNo && (
                                    <span className="v22-keep-white inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-white/10 border border-white/15 text-white/90">
                                        <CreditCard size={11} className="text-sky-300 shrink-0" />
                                        TC: {selectedFarmer.tcNo}
                                    </span>
                                )}
                                {(() => {
                                    const unpaidRx = farmerPrescriptions.filter(p => p.priceType !== 'CASH' && (Number(p.totalAmount) || 0) > 0);
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
                                        A: { label: 'A Güvenilir', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/35' },
                                        B: { label: 'B Standart', cls: 'bg-sky-500/20 text-sky-200 border-sky-400/35' },
                                        C: { label: 'C Gecikmeli', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/35' },
                                        D: { label: 'D Yüksek Risk', cls: 'bg-rose-500/25 text-rose-200 border-rose-400/45' },
                                    };
                                    const riskGrade = riskMap[finalGrade];
                                    return (
                                        <>
                                            <span className={`v22-keep-white inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${riskGrade.cls}`}>
                                                <ShieldCheck size={11} />
                                                {riskGrade.label}{selectedFarmer.riskScoreOverride ? ' (Manuel)' : ''}
                                            </span>
                                            {debtAgeDays > 0 && (
                                                <span className="v22-keep-white inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-white/10 text-amber-200 border border-white/15">
                                                    <Clock size={11} className="text-amber-300" />
                                                    Yaşlandırma: {debtAgeDays} Gün
                                                </span>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                        <button
                            type="button"
                            onClick={() => setIsFinancialAnalysisOpen(true)}
                            title="Finansal Analiz & Kârlılık"
                            className="v22-keep-white px-3 py-1.5 min-h-[34px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-xl transition-all active:scale-95 border border-emerald-400/30 flex items-center gap-1.5 text-xs font-extrabold"
                        >
                            <TrendingUpIcon size={13} />
                            <span>Finans Analizi</span>
                        </button>
                        {canEditFarmer && (
                            <button
                                type="button"
                                onClick={openEditModal}
                                title="Çiftçiyi Düzenle"
                                aria-label="Çiftçiyi Düzenle"
                                className="v22-keep-white p-2 min-h-[34px] min-w-[34px] bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all active:scale-95 border border-white/15 flex items-center justify-center"
                            >
                                <Edit2 size={14} />
                            </button>
                        )}
                        {canEditFarmer && (
                            <button
                                type="button"
                                onClick={() => handleDeleteFarmer()}
                                title="Çiftçiyi Sil"
                                aria-label="Çiftçiyi Sil"
                                className="v22-keep-white p-2 min-h-[34px] min-w-[34px] bg-rose-500/15 hover:bg-rose-500/30 text-rose-200 rounded-xl transition-all active:scale-95 border border-rose-400/30 flex items-center justify-center"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {(selectedFarmer.creditLimit || 0) > 0 && (() => {
                    const curDebtAmt = overallBalance < 0 ? Math.abs(overallBalance) : 0;
                    const limit = selectedFarmer.creditLimit || 1;
                    const pct = Math.min(100, Math.round((curDebtAmt / limit) * 100));
                    const isExceeded = curDebtAmt > limit;
                    return (
                        <div className="mt-3 bg-black/25 border border-white/10 rounded-2xl p-2.5">
                            <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                                <span className={isExceeded ? 'v22-keep-white text-rose-300 font-black' : 'v22-keep-white text-white/80'}>
                                    {isExceeded ? 'Kredi Limiti Aşıldı' : 'Kredi / Açık Hesap Limiti'}
                                </span>
                                <span className="v22-keep-white font-mono tabular-nums text-white">
                                    {formatCurrency(curDebtAmt, currency)} / {formatCurrency(limit, currency)} (%{Math.round((curDebtAmt / limit) * 100)})
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all rounded-full ${isExceeded ? 'bg-rose-400' : pct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })()}

                {/* Tek Satırlık Hızlı İletişim & Portal Şeridi */}
                <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-white/15">
                    <a
                        href={`tel:${selectedFarmer.phoneNumber}`}
                        className="v22-keep-white px-3 py-1.5 min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                    >
                        <Phone size={13} className="text-sky-300" />
                        <span>Ara</span>
                    </a>
                    <a
                        href={buildWaUrl(selectedFarmer.phoneNumber) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="v22-keep-white px-3 py-1.5 min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                    >
                        <MessageCircle size={13} className="text-emerald-300" />
                        <span>WhatsApp</span>
                    </a>
                    <button
                        type="button"
                        onClick={handleSendDebtReminder}
                        className="v22-keep-white px-3 py-1.5 min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                    >
                        <Wallet size={13} className="text-amber-300" />
                        <span>Borç Hatırlat</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedFarmer.village || '')}`, '_blank')}
                        className="v22-keep-white px-3 py-1.5 min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                    >
                        <Navigation size={13} className="text-indigo-300" />
                        <span>Konum</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyPortalLink}
                        className="v22-keep-white px-3 py-1.5 min-h-[36px] rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-xs font-bold text-emerald-200 flex items-center gap-1.5 transition-colors"
                    >
                        <Copy size={13} />
                        <span>{farmerLabel} Portalı Linkini Kopyala</span>
                    </button>
                    {canEditFarmer && (
                        <button
                            type="button"
                            onClick={() => onNavigateToPrescription(selectedFarmer.id)}
                            className="sm:ml-auto px-3.5 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-[#f39264] to-[#e57c4b] hover:from-[#f6a077] hover:to-[#eb8758] text-[#0b211d] text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                        >
                            <Plus size={14} />
                            <span>Yeni {prescriptionLabel} / Satış</span>
                        </button>
                    )}
                </div>
            </section>

            {/* KATMAN 2: Birleşik Sekme ve Tekil Yıl Seçici Şeridi */}
            <div className="v22-bento-card p-2 sm:p-2.5 mb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => {
                        const TabIcon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                type="button"
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className="min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition-all"
                                style={
                                    isActive
                                        ? { background: 'var(--mks-accent-primary)', color: '#ffffff' }
                                        : { background: 'var(--mks-subcard)', color: 'var(--mks-muted)' }
                                }
                            >
                                <TabIcon size={14} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {(activeTab === 'PRESCRIPTIONS' || activeTab === 'DEBT') && availableYears.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 lg:pt-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 shrink-0" style={{ color: 'var(--mks-muted)' }}>
                            Dönem:
                        </span>
                        {availableYears.map(year => {
                            const isSelected = selectedYear === year;
                            return (
                                <button
                                    type="button"
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className="px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border shrink-0"
                                    style={
                                        isSelected
                                            ? { background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)', borderColor: 'var(--mks-accent-primary)' }
                                            : { background: 'var(--mks-subcard)', color: 'var(--mks-muted)', borderColor: 'var(--mks-card-border)' }
                                    }
                                >
                                    {year}{year === currentYear ? ' · Güncel' : ''}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* KATMAN 3: Sekme İçerikleri */}
            <div className="animate-in fade-in duration-300">
                {activeTab === 'GENERAL' && (
                    <div className="space-y-4">
                        <div className="v22-bento-card p-4 sm:p-5 space-y-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: 'var(--mks-card-border)' }}>
                                <h3 className="text-sm font-extrabold flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                                    <Wheat size={16} className="text-amber-500" />
                                    <span>Kayıtlı Tarla &amp; Parsel Bilgileri ({(selectedFarmer.fields || []).length})</span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}>
                                        Toplam: {totalFarmerDekar} da
                                    </span>
                                    {canEditFarmer && (
                                        <button
                                            type="button"
                                            onClick={() => onNavigateToPrescription(selectedFarmer.id)}
                                            className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5"
                                            style={{ background: 'var(--mks-accent-primary)' }}
                                        >
                                            <Plus size={14} /> Yeni {prescriptionLabel}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {(selectedFarmer.fields || []).length === 0 ? (
                                <div className="p-6 rounded-2xl border border-dashed text-center text-xs" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}>
                                    Bu çiftçiye ait kayıtlı tarla bilgisi bulunmuyor. Düzenle menüsünden tarla ekleyebilirsiniz.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(selectedFarmer.fields || []).map((field, idx) => (
                                        <div key={field.id} className="p-3.5 rounded-2xl border space-y-2.5" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[10px] uppercase font-bold truncate" style={{ color: 'var(--mks-muted)' }}>
                                                        {field.name || `Tarla ${idx + 1}`}
                                                    </p>
                                                    <p className="text-sm font-extrabold truncate" style={{ color: 'var(--mks-text)' }}>
                                                        {field.crop || 'Ürün Belirtilmedi'}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--mks-muted)' }}>Alan</p>
                                                    <p className="text-sm font-black font-mono tabular-nums text-emerald-500">
                                                        {field.size} <span className="text-[11px] font-semibold" style={{ color: 'var(--mks-muted)' }}>da</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {(field.plantingDate || field.currentStage) && (
                                                <div className="flex gap-4 pt-2 border-t" style={{ borderColor: 'var(--mks-card-border)' }}>
                                                    {field.plantingDate && (
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--mks-muted)' }}>Ekim</p>
                                                            <p className="text-xs font-semibold" style={{ color: 'var(--mks-text)' }}>{new Date(field.plantingDate).toLocaleDateString('tr-TR')}</p>
                                                        </div>
                                                    )}
                                                    {field.currentStage && (
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--mks-muted)' }}>Evre</p>
                                                            <p className="text-xs font-semibold" style={{ color: 'var(--mks-text)' }}>{field.currentStage}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--mks-card-border)' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setDirectPolygonEditField(field)}
                                                    className="flex-1 min-h-[34px] py-1.5 px-3 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                                                    style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                                                >
                                                    <MapPin size={12} className="text-sky-500" />
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
                                                    className="flex-1 min-h-[34px] py-1.5 px-3 rounded-xl border text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-colors"
                                                    style={{ background: 'var(--mks-accent-soft)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-accent-soft-text)' }}
                                                >
                                                    <Satellite size={12} />
                                                    <span>Uydu Analizi (NDVI)</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'DEBT' && (
                    <div className="space-y-4">
                        {/* 4 Sütunlu Finansal Özet Kartları */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className="v22-bento-card p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                                        01.01.{selectedYear} Devir
                                    </span>
                                    <RefreshCw size={14} style={{ color: 'var(--mks-muted)' }} />
                                </div>
                                <div className={`text-xl font-extrabold font-mono tabular-nums truncate mt-2 ${openingBalance > 0.01 ? 'text-emerald-500' : openingBalance < -0.01 ? 'text-rose-500' : ''}`} style={Math.abs(openingBalance) <= 0.01 ? { color: 'var(--mks-text)' } : undefined}>
                                    {openingBalance > 0.01 ? '+' : ''}{formatCurrency(openingBalance, currency)}
                                </div>
                                <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
                                    {openingBalance > 0.01 ? 'Alacak Devri' : openingBalance < -0.01 ? 'Borç Devri' : 'Geçmiş Yıl Devri Sıfır'}
                                </p>
                            </div>

                            <div className="v22-bento-card p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                                        {selectedYear} Dönem Borç / Satış
                                    </span>
                                    <TrendingDown size={14} className="text-rose-500" />
                                </div>
                                <div className="text-xl font-extrabold font-mono tabular-nums text-rose-500 truncate mt-2">
                                    {formatCurrency((yearTotalDebt + (openingBalance < 0 ? Math.abs(openingBalance) : 0)), currency)}
                                </div>
                                <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
                                    Dönem satış &amp; manuel borçlar
                                </p>
                            </div>

                            <div className="v22-bento-card p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                                        {selectedYear} Dönem Tahsilat
                                    </span>
                                    <CreditCard size={14} className="text-emerald-500" />
                                </div>
                                <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-500 truncate mt-2">
                                    {formatCurrency((yearTotalPaid + (openingBalance > 0 ? openingBalance : 0)), currency)}
                                </div>
                                <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
                                    Nakit, kart, çek &amp; iadeler
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsFinancialAnalysisOpen(true)}
                                className="v22-bento-card p-4 text-left flex flex-col justify-between group"
                            >
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                                        Net Güncel Cari Bakiye
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${overallBalance < -0.01 ? 'bg-rose-500/15 text-rose-500' : overallBalance > 0.01 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-sky-500/15 text-sky-500'}`}>
                                        {overallBalance < -0.01 ? 'BORÇLU' : overallBalance > 0.01 ? 'ALACAKLI' : 'MUTABIK'}
                                    </span>
                                </div>
                                <div className={`text-xl font-extrabold font-mono tabular-nums truncate mt-2 ${overallBalance < -0.01 ? 'text-rose-500' : overallBalance > 0.01 ? 'text-emerald-500' : ''}`} style={Math.abs(overallBalance) <= 0.01 ? { color: 'var(--mks-text)' } : undefined}>
                                    {formatCurrency(Math.abs(overallBalance), currency)}
                                </div>
                                <p className="text-[11px] font-bold mt-1 flex items-center justify-between w-full" style={{ color: 'var(--mks-accent-primary)' }}>
                                    <span>Tüm zamanlar net durum</span>
                                    <span>Finansal Analiz →</span>
                                </p>
                            </button>
                        </div>

                        {/* Kurumsal Cari Hareketler & İşlem Çubuğu */}
                        <div className="v22-bento-card p-4 sm:p-5 space-y-3.5">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--mks-card-border)' }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}>
                                        <History size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-extrabold" style={{ color: 'var(--mks-text)' }}>
                                            Cari Hesap Hareketleri ({selectedYear})
                                        </h3>
                                        <p className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                                            {yearHistoryItems.length} dönem hareketi kayıtlı
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {canEditFarmer && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setIsPaymentModalOpen(true)}
                                                className="px-3.5 py-2 min-h-[36px] rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                                style={{ background: 'var(--mks-accent-primary)' }}
                                            >
                                                <Plus size={14} />
                                                <span>Tahsilat Al</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsManualDebtModalOpen(true)}
                                                className="px-3 py-2 min-h-[36px] rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 border border-rose-500/30 text-xs font-extrabold flex items-center gap-1.5 active:scale-95 transition-all"
                                            >
                                                <Plus size={14} />
                                                <span>Borç Ekle</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsReturnModalOpen(true)}
                                                className="px-3 py-2 min-h-[36px] rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 text-xs font-extrabold flex items-center gap-1.5 active:scale-95 transition-all"
                                            >
                                                <RefreshCcw size={13} />
                                                <span>İade Al</span>
                                            </button>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsReportModalOpen(true)}
                                        className="px-3 py-2 min-h-[36px] rounded-xl border text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                        style={{ background: 'var(--mks-subcard)', color: 'var(--mks-text)', borderColor: 'var(--mks-card-border)' }}
                                    >
                                        <Download size={13} />
                                        <span>Ekstre / Rapor</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGenerateFarmerReconciliationPdf}
                                        title="Resmi Cari Hesap Mutabakat Mektubu (PDF)"
                                        className="px-3 py-2 min-h-[36px] rounded-xl border text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                                        style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)', borderColor: 'var(--mks-card-border)' }}
                                    >
                                        <Scale size={13} />
                                        <span>Mutabakat PDF</span>
                                    </button>
                                </div>
                            </div>

                            {selectedYear < currentYear && (
                                <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-2.5 flex items-center gap-2 text-amber-500 text-xs font-semibold">
                                    <Calendar size={14} className="shrink-0" />
                                    <span>{selectedYear} Yılı devir kaydı ve geçmiş cari dökümü görüntüleniyor.</span>
                                </div>
                            )}

                            <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                                {openingBalance !== 0 && (
                                    <div className="p-3 rounded-2xl border flex items-center justify-between gap-3" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                                                <RefreshCw size={15} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-text)' }}>{selectedYear} Devir Bakiyesi</p>
                                                <p className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>01.01.{selectedYear} Açılış</p>
                                            </div>
                                        </div>
                                        <p className={`text-sm font-black font-mono tabular-nums shrink-0 ${openingBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {openingBalance >= 0 ? '+' : ''}{formatCurrency(openingBalance, currency)}
                                        </p>
                                    </div>
                                )}

                                {yearHistoryItems.length === 0 && openingBalance === 0 ? (
                                    <div className="p-8 rounded-2xl border border-dashed text-center text-xs" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}>
                                        {selectedYear} yılına ait cari hareket kaydı bulunmuyor.
                                    </div>
                                ) : (
                                    yearHistoryItems.map((item, idx) => {
                                        const dueDate = getDueDate(item);
                                        const isOverdue = dueDate && new Date() > new Date(dueDate.replace('Haz', 'Jun').replace('Kas', 'Nov'));
                                        const rawAmt = (item as any).amount ?? (item as any).totalAmount;
                                        const parsedAmt = Number(rawAmt);
                                        const safeAmt = Number.isFinite(parsedAmt) ? Math.abs(parsedAmt) : 0;
                                        const isNegativeDebt =
                                            item.type === 'DEBT' &&
                                            (((item as any).totalAmount !== undefined
                                                ? (Number((item as any).totalAmount) || 0) < 0
                                                : (Number((item as any).amount) || 0) < 0) ||
                                                item.label === 'İade Makbuzu');

                                        return (
                                            <div
                                                key={`${item.id}-${idx}`}
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
                                                className="p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all"
                                                style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                        item.type === 'DEBT'
                                                            ? (isNegativeDebt ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500')
                                                            : item.type === 'CASH'
                                                                ? 'bg-sky-500/15 text-sky-500'
                                                                : 'bg-emerald-500/15 text-emerald-500'
                                                    }`}>
                                                        {item.label === 'İade Makbuzu'
                                                            ? <RefreshCcw size={15} />
                                                            : (item.type === 'DEBT' || item.type === 'CASH' ? <FileText size={15} /> : <CreditCard size={15} />)}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-text)' }}>{item.label}</p>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                            <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                                                                {new Date(item.date).toLocaleDateString('tr-TR')}
                                                            </span>
                                                            <span className="text-[10px] font-bold flex items-center px-1.5 py-0.5 rounded-md border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}>
                                                                <User size={9} className="mr-1" />
                                                                {(item as any).createdById ? (teamMembers.find(m => m.id === (item as any).createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                                            </span>
                                                            {dueDate && (
                                                                <span className={`text-[10px] font-bold ${isOverdue ? 'text-rose-500' : 'text-amber-500'}`}>
                                                                    Vade: {dueDate}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right flex items-center gap-2 shrink-0">
                                                    <div>
                                                        <p className={`text-sm font-black font-mono tabular-nums ${
                                                            item.type === 'DEBT'
                                                                ? (isNegativeDebt ? 'text-emerald-500' : 'text-rose-500')
                                                                : item.type === 'CASH'
                                                                    ? 'text-sky-500'
                                                                    : 'text-emerald-500'
                                                        }`}>
                                                            {item.type === 'DEBT' ? (isNegativeDebt ? '+' : '-') : item.type === 'CASH' ? '' : '+'}{formatCurrency(safeAmt, currency)}
                                                        </p>
                                                        {(item as any).note && (
                                                            <p className="text-[10px] italic truncate max-w-[110px]" style={{ color: 'var(--mks-muted)' }}>
                                                                {(item as any).note}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {item.type === 'PAYMENT' ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleEditPayment(item as any); }}
                                                                title="Tahsilatı Düzenle"
                                                                aria-label="Tahsilatı Düzenle"
                                                                className="p-1.5 rounded-lg border transition-colors"
                                                                style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                                                            >
                                                                <Edit2 size={12} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleDeletePayment(item.id); }}
                                                                title="Tahsilatı Sil"
                                                                aria-label="Tahsilatı Sil"
                                                                className="p-1.5 rounded-lg border text-rose-500 transition-colors"
                                                                style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleSendReceipt(item as any); }}
                                                                className="px-2.5 py-1.5 text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 rounded-lg hover:bg-emerald-500/20 transition-all"
                                                            >
                                                                MAKBUZ
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        (item.label === 'Manuel Borç' || item.label === 'Manuel Borç/Alacak') && (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleEditManualDebt(item as any); }}
                                                                    title="Borç Kaydını Düzenle"
                                                                    aria-label="Borç Kaydını Düzenle"
                                                                    className="p-1.5 rounded-lg border transition-colors"
                                                                    style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteManualDebt(item.id); }}
                                                                    title="Borç Kaydını Sil"
                                                                    aria-label="Borç Kaydını Sil"
                                                                    className="p-1.5 rounded-lg border text-rose-500 transition-colors"
                                                                    style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'VISITS' && (
                    <div className="v22-bento-card p-4 sm:p-5 space-y-2.5">
                        {isDataLoading ? (
                            <Loader2 size={20} className="animate-spin text-emerald-500 mx-auto" />
                        ) : farmerVisits.length > 0 ? (
                            farmerVisits.map(visit => (
                                <div key={visit.id} className="p-3.5 rounded-2xl border transition-colors" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="text-[11px] font-bold flex items-center px-2 py-0.5 rounded-lg border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}>
                                            <Calendar size={11} className="mr-1.5 text-emerald-500" />{new Date(visit.date).toLocaleDateString('tr-TR')}
                                        </span>
                                        <span className="text-[11px] flex items-center" style={{ color: 'var(--mks-muted)' }}>
                                            <Clock size={11} className="mr-1" />{new Date(visit.date).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <p className="text-xs italic mb-2 leading-relaxed line-clamp-3" style={{ color: 'var(--mks-text)' }}>"{visit.note}"</p>
                                    <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: 'var(--mks-card-border)' }}>
                                        <div className="flex gap-1.5">{visit.photoUri && <ImageIcon size={13} className="text-sky-500" />}</div>
                                        <div className="flex gap-1.5">
                                            <button type="button" onClick={() => onEditVisit(visit.id)} className="p-1.5 rounded-lg border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}><Edit2 size={12} /></button>
                                            <button type="button" onClick={() => handleDeleteVisit(visit.id)} className="p-1.5 rounded-lg border text-rose-500" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}><Trash2 size={12} /></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-xs" style={{ color: 'var(--mks-muted)' }}>Kayıtlı tarla ziyareti / reçete bulunmuyor.</div>
                        )}
                    </div>
                )}

                {activeTab === 'PRESCRIPTIONS' && (
                    <div className="v22-bento-card p-4 sm:p-5 space-y-2.5">
                        {isDataLoading ? (
                            <Loader2 size={20} className="animate-spin text-amber-500 mx-auto" />
                        ) : filteredPrescriptions.length > 0 ? (
                            filteredPrescriptions.map(p => {
                                const isReturn = p.type === 'RETURN' || (Number(p.totalAmount) || 0) < 0;
                                const pAmt = Number(p.totalAmount);
                                const safePAmt = Number.isFinite(pAmt) ? Math.abs(pAmt) : 0;
                                return (
                                    <div key={p.id} onClick={() => setSelectedPrescription(p)} className="p-3.5 rounded-2xl border transition-all cursor-pointer hover:opacity-95 active:scale-[0.99]" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-mono font-bold uppercase" style={{ color: 'var(--mks-text)' }}>
                                                    No: {p.prescriptionNo || '-'}
                                                </span>
                                                {isReturn && (
                                                    <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/15 px-1.5 py-0.5 border border-emerald-500/30 rounded-md uppercase">İADE</span>
                                                )}
                                                <span className="text-xs font-black font-mono tabular-nums" style={{ color: isReturn ? '#10b981' : 'var(--mks-text)' }}>
                                                    {formatCurrency(safePAmt, currency)}
                                                </span>
                                            </div>
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border ${isReturn ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25' : 'text-amber-500 bg-amber-500/10 border-amber-500/25'}`}>
                                                {new Date(p.date).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {p.items.map((item, idx) => (
                                                <span key={idx} className="text-[11px] px-2 py-0.5 rounded-lg border flex items-center" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}>
                                                    <FlaskConical size={10} className="mr-1 text-emerald-500" />
                                                    {item.pesticideName}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-8 text-xs" style={{ color: 'var(--mks-muted)' }}>{selectedYear} yılına ait {prescriptionLabel.toLowerCase()} kaydı yok.</div>
                        )}
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
                                                    { id: `fsp-${Date.now()}`, method: 'CHECK', amount: '', accountId: '', dueDate: getLocalDateString(), cardOption: 'UNBLOCKED' }
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
  const listCurrency = userProfile?.currency || 'TRY';
  return (
    <div className="pb-24 relative min-h-[80vh] max-w-7xl mx-auto">
      <input type="file" accept=".vcf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      {/* Kurumsal Komuta Kartı */}
      <section className="v22-bento-card p-4 sm:p-5 mb-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Ana panele dön"
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 transition-colors"
              style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black tracking-tight" style={{ color: 'var(--mks-text)' }}>
                  Çiftçi Cari &amp; Arazi Merkezi
                </h2>
                {userProfile?.lastSyncTime && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500">
                    <Check size={10} />
                    Son Yedek: {new Date(userProfile.lastSyncTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--mks-muted)' }}>
                {farmerPortfolioSummary.totalCount} kayıtlı çiftçi · {farmerPortfolioSummary.debtorCount} borçlu cari · Toplam Alacak:{' '}
                <span className="font-mono font-extrabold" style={{ color: 'var(--mks-text)' }}>
                  {formatCurrency(farmerPortfolioSummary.totalReceivable, listCurrency)}
                </span>{' '}
                · {farmerPortfolioSummary.totalFieldsCount} Tarla ({farmerPortfolioSummary.totalDekar} da)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canCreateFarmer && (
              <button
                type="button"
                onClick={() => { setModalMode('ADD'); toggleModal(true); }}
                className="min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-black text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                style={{ background: 'var(--mks-accent-primary)' }}
              >
                <Plus size={15} />
                <span>Yeni Çiftçi Ekle</span>
              </button>
            )}
            {canCreateFarmer && (
              <button
                type="button"
                onClick={handleContactImport}
                disabled={isImporting}
                className="min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
              >
                {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Contact size={14} className="text-sky-500" />}
                <span>Rehberden Aktar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAnnounceTemplate(userProfile?.whatsappTemplates?.announcement || DEFAULT_WHATSAPP_TEMPLATES.announcement);
                setSentAnnouncementFarmerIds(new Set());
                setIsAnnouncementModalOpen(true);
              }}
              title="Köy ve Mahsul Bazlı Toplu WhatsApp Zirai Duyuru"
              className="min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors"
              style={{ background: 'var(--mks-accent-soft)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-accent-soft-text)' }}
            >
              <Megaphone size={14} />
              <span>Toplu Duyuru</span>
            </button>
            <button
              type="button"
              onClick={downloadFarmersPdf}
              disabled={isGeneratingReport}
              className="min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
            >
              {isGeneratingReport ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} className="text-amber-500" />}
              <span>PDF Liste</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRepairModalOpen(true);
                handleAnalyzeFarmers();
              }}
              className="min-h-[38px] px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-500 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={13} />
              <span>Cari Onar</span>
            </button>
          </div>
        </div>

        {/* Arama ve Hızlı Filtre Sekmeleri */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 pt-3 border-t" style={{ borderColor: 'var(--mks-card-border)' }}>
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--mks-muted)' }} />
            <input
              type="text"
              placeholder="Ad, soyad, köy, T.C. No veya telefon ile çiftçi ara..."
              aria-label="Çiftçi ara"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-9 rounded-xl border text-xs font-semibold outline-none transition-colors"
              style={{
                background: 'var(--mks-subcard)',
                borderColor: 'var(--mks-card-border)',
                color: 'var(--mks-text)'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Aramayı temizle"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg"
                style={{ color: 'var(--mks-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'ALL', label: `Tümü (${farmerPortfolioSummary.totalCount})` },
              { id: 'DEBT', label: `Borçlu Cariler (${farmerPortfolioSummary.debtorCount})` },
              { id: 'CREDIT', label: `Alacaklı Cariler (${farmerPortfolioSummary.creditCount})` },
              { id: 'ZERO', label: `Bakiyesi Kapalı (${farmerPortfolioSummary.zeroCount})` }
            ].map(flt => {
              const isSelected = listFilter === flt.id;
              return (
                <button
                  type="button"
                  key={flt.id}
                  onClick={() => setListFilter(flt.id as any)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border text-[11px] font-extrabold whitespace-nowrap shrink-0 transition-all"
                  style={
                    isSelected
                      ? { background: 'var(--mks-accent-primary)', color: '#ffffff', borderColor: 'var(--mks-accent-primary)' }
                      : { background: 'var(--mks-subcard)', color: 'var(--mks-muted)', borderColor: 'var(--mks-card-border)' }
                  }
                >
                  {flt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Çiftçi Kartları Grid Yapısı */}
      {isLoading ? (
        <ListSkeleton count={8} />
      ) : filteredFarmers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchTerm || listFilter !== 'ALL' ? 'Filtreye uygun çiftçi bulunamadı' : t('farmer.empty_list', { label: farmerLabel.toLowerCase() })}
          description={searchTerm || listFilter !== 'ALL' ? 'Arama kelimesini veya cari filtre seçimini değiştirerek tekrar deneyebilirsiniz.' : t('farmer.empty_hint', { label: farmerLabel.toLowerCase() })}
          actionLabel={
            searchTerm || listFilter !== 'ALL'
              ? 'Filtreyi Temizle'
              : (canCreateFarmer ? `Yeni ${farmerLabel} Ekle` : undefined)
          }
          onAction={
            searchTerm || listFilter !== 'ALL'
              ? () => { setSearchTerm(''); setListFilter('ALL'); }
              : (canCreateFarmer ? () => { setModalMode('ADD'); toggleModal(true); } : undefined)
          }
          actionIcon={searchTerm || listFilter !== 'ALL' ? RefreshCw : Plus}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {filteredFarmers.map(farmer => {
            const fFields = farmer.fields || [];
            const fDekar = Math.round(fFields.reduce((acc, fl) => acc + (Number(fl.size) || 0), 0) * 10) / 10;
            const bal = Number(farmer.overallBalance) || 0;
            const isDebtor = bal < -0.01;
            const isCreditor = bal > 0.01;
            const grade = (farmer as any).effectiveRiskGrade as 'A' | 'B' | 'C' | 'D' | undefined;

            return (
              <div
                key={farmer.id}
                onClick={() => changeFarmerSelection(farmer)}
                className="v22-bento-card p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer group active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border"
                    style={{
                      background: 'var(--mks-accent-soft)',
                      color: 'var(--mks-accent-soft-text)',
                      borderColor: 'var(--mks-card-border)'
                    }}
                  >
                    {farmer.fullName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-sm truncate" style={{ color: 'var(--mks-text)' }}>
                      {farmer.fullName}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className="text-[11px] flex items-center px-1.5 py-0.5 rounded-md border font-semibold"
                        style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                      >
                        <MapPin size={10} className="mr-1 text-emerald-500 shrink-0" />
                        {farmer.village || 'Merkez'}
                      </span>
                      {fFields.length > 0 && (
                        <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20 font-bold">
                          {fFields.length} Tarla{fDekar > 0 ? ` · ${fDekar} da` : ''}
                        </span>
                      )}
                      {farmer.tcNo && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md border font-mono"
                          style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                        >
                          TC: {farmer.tcNo}
                        </span>
                      )}
                      {grade && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-black ${
                          grade === 'A' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' :
                          grade === 'B' ? 'bg-sky-500/15 text-sky-500 border-sky-500/30' :
                          grade === 'C' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
                          'bg-rose-500/15 text-rose-500 border-rose-500/30'
                        }`}>
                          Not: {grade}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className={`text-sm font-black font-mono tabular-nums ${
                      isDebtor ? 'text-rose-500' : isCreditor ? 'text-emerald-500' : ''
                    }`} style={!isDebtor && !isCreditor ? { color: 'var(--mks-text)' } : undefined}>
                      {formatCurrency(Math.abs(bal), listCurrency)}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                      {isDebtor ? 'Borçlu' : isCreditor ? 'Alacaklı' : 'Mutabık'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      changeFarmerSelection(farmer);
                      setIsFinancialAnalysisOpen(true);
                    }}
                    title="Finansal Analiz & Kârlılık"
                    aria-label="Finansal Analiz"
                    className="p-2 rounded-xl border transition-all active:scale-95 hidden sm:flex items-center gap-1 text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    <TrendingUpIcon size={13} />
                    <span className="text-[10px] font-extrabold">Finans</span>
                  </button>

                  {farmer.phoneNumber && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`tel:${farmer.phoneNumber}`);
                      }}
                      title="Ara"
                      aria-label="Çiftçiyi Ara"
                      className="p-2 rounded-xl border transition-colors"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                    >
                      <Phone size={13} />
                    </button>
                  )}

                  <div
                    className="p-1.5 rounded-xl border group-hover:text-emerald-500 transition-colors"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                  >
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canCreateFarmer && (
        <button
          type="button"
          onClick={() => { setModalMode('ADD'); toggleModal(true); }}
          className="md:hidden fixed bottom-24 right-4 text-white px-4 py-3 rounded-full shadow-xl transition-all active:scale-95 z-40 flex items-center justify-center gap-1.5 font-extrabold text-xs"
          style={{ background: 'var(--mks-accent-primary)' }}
        >
          <Plus size={18} /> Yeni Çiftçi
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

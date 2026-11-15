import React, { useState, useMemo, useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { DashboardWeatherAndBriefingBanner } from './WeatherComponents';
import {
  Users, FileText, Sprout, Plus, X, ChevronRight, Zap,
  CalendarCheck, Bug, Package, FlaskConical, Star, Truck, Search,
  Trash2, Wallet, Map as MapIcon, Newspaper, ArrowUpRight, Sparkles,
  CheckCircle2, QrCode, ShieldCheck, Receipt, AlertTriangle
} from 'lucide-react';
import { Pesticide } from '../types';
import { dbService } from '../services/db';
import { formatCurrency } from '../utils/currency';
import { getLocalDateString } from '../utils/dateUtils';
import { useBackHandler } from '../utils/navigationManager';
import { buildWaUrl } from '../utils/whatsappTemplates';
import { SUPPORT_WHATSAPP } from '../constants';
import { validateTcOrVkn } from '../utils/tcNoValidator';

interface DashboardProps {
  onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const {
    userProfile,
    reminders,
    stats,
    prescriptions,
    inventory,
    suppliers,
    farmers,
    accounts,
    addFarmer,
    addSupplierPurchase,
    addSupplierPayment,
    showToast,
    hapticFeedback,
    activeTeamMember,
    t,
    language,
  } = useAppViewModel();

  const [selectedNews, setSelectedNews] = useState<any>(null);
  const [isBuyPlanModalOpen, setIsBuyPlanModalOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'SALES' | 'CHART' | 'LOW_STOCK'>('SALES');
  const [farmerQuickSearch, setFarmerQuickSearch] = useState('');

  const isSales = activeTeamMember?.role === 'SALES';
  const canCreatePrescription = !isSales;
  const farmerLabel = t('label.farmer') || 'Çiftçi';

  // Quick Purchase Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isQuickFarmerModalOpen, setIsQuickFarmerModalOpen] = useState(false);
  const [quickFarmerName, setQuickFarmerName] = useState('');
  const [quickFarmerPhone, setQuickFarmerPhone] = useState('');
  const [quickFarmerVillage, setQuickFarmerVillage] = useState('');
  const [quickFarmerTcNo, setQuickFarmerTcNo] = useState('');
  const [isSavingQuickFarmer, setIsSavingQuickFarmer] = useState(false);

  useBackHandler(isPurchaseModalOpen, () => setIsPurchaseModalOpen(false), 'dash_purchase_modal', 60);
  useBackHandler(isQuickFarmerModalOpen, () => setIsQuickFarmerModalOpen(false), 'dash_quick_farmer_modal', 60);
  useBackHandler(isBuyPlanModalOpen, () => setIsBuyPlanModalOpen(false), 'dash_buy_plan_modal', 60);
  useBackHandler(!!selectedNews, () => setSelectedNews(null), 'dash_news_modal', 60);

  const handleQuickFarmerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingQuickFarmer) return;
    const trimmedName = quickFarmerName.trim();
    if (!trimmedName) {
      showToast('Lütfen çiftçi adını girin.', 'error');
      return;
    }
    const trimmedTc = quickFarmerTcNo.trim();
    if (trimmedTc) {
      const tcRes = validateTcOrVkn(trimmedTc);
      if (!tcRes.isValid) {
        showToast(tcRes.message || 'Geçersiz T.C. Kimlik veya Vergi Kimlik Numarası.', 'error');
        return;
      }
    }
    setIsSavingQuickFarmer(true);
    try {
      await addFarmer({
        fullName: trimmedName,
        phoneNumber: quickFarmerPhone.trim(),
        village: quickFarmerVillage.trim() || 'Merkez',
        tcNo: trimmedTc || undefined,
        fields: [],
        balance: 0
      });
      showToast(`${trimmedName} cari hesaplara eklendi!`, 'success');
      hapticFeedback('success');
      setQuickFarmerName('');
      setQuickFarmerPhone('');
      setQuickFarmerVillage('');
      setQuickFarmerTcNo('');
      setIsQuickFarmerModalOpen(false);
    } catch {
      showToast('Çiftçi kaydedilirken bir hata oluştu.', 'error');
    } finally {
      setIsSavingQuickFarmer(false);
    }
  };
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [purchaseItems, setPurchaseItems] = useState<
    { pesticideId: string; pesticideName: string; quantity: number; unit: string; buyingPrice: number }[]
  >([]);
  const [receiptNo, setReceiptNo] = useState('');
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [searchPestTerm, setSearchPestTerm] = useState('');
  const [paymentType, setPaymentType] = useState<'TERM' | 'CASH'>('TERM');
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);

  useEffect(() => {
    const fetchPesticides = async () => {
      const data = await dbService.getPesticides();
      setPesticides(data);
    };
    fetchPesticides();
  }, []);

  const totalSupplierDebt = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + (s.balance < 0 ? Math.abs(s.balance) : 0), 0);
  }, [suppliers]);

  const totalKasaBalance = useMemo(() => {
    return (accounts || []).reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
  }, [accounts]);

  const activeDebtorsCount = useMemo(() => {
    return (farmers || []).filter(f => !f.deletedAt && (f.balance || 0) < -0.01).length;
  }, [farmers]);

  const filteredPesticides = useMemo(() => {
    if (!searchPestTerm) return [];
    return pesticides
      .filter(
        p =>
          p.name.toLocaleLowerCase('tr-TR').includes(searchPestTerm.toLocaleLowerCase('tr-TR')) ||
          p.activeIngredient.toLocaleLowerCase('tr-TR').includes(searchPestTerm.toLocaleLowerCase('tr-TR'))
      )
      .slice(0, 20);
  }, [pesticides, searchPestTerm]);

  const handleAddPurchaseItem = (p: Pesticide | { name: string; isNew: boolean }) => {
    const newItem = {
      pesticideId: 'isNew' in p ? `new-${crypto.randomUUID()}` : p.id,
      pesticideName: p.name,
      quantity: 1,
      unit: 'Adet',
      buyingPrice: 0
    };
    setPurchaseItems([...purchaseItems, newItem]);
    setSearchPestTerm('');
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPurchase || !selectedSupplierId || purchaseItems.length === 0) return;

    setIsSubmittingPurchase(true);
    try {
      const totalAmount = purchaseItems.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0);
      const date = new Date().toISOString();

      await addSupplierPurchase({
        supplierId: selectedSupplierId,
        date,
        receiptNo,
        items: purchaseItems,
        totalAmount
      });

      if (paymentType === 'CASH') {
        const cashAcc =
          (accounts || []).find(a => !a.deletedAt && a.type === 'CASH') ||
          (accounts || []).find(a => !a.deletedAt);
        await addSupplierPayment({
          supplierId: selectedSupplierId,
          amount: totalAmount,
          date,
          method: 'CASH',
          accountId: cashAcc?.id,
          note: receiptNo ? `Hızlı Peşin Alım - Fiş No: ${receiptNo}` : 'Hızlı Peşin Alım Ödemesi',
          createdById: activeTeamMember?.id
        });
      }

      showToast(paymentType === 'CASH' ? 'Peşin alım ve ödeme kaydedildi' : t('dashboard.purchase_success'), 'success');
      hapticFeedback('success');
      setIsPurchaseModalOpen(false);
      setPurchaseItems([]);
      setSelectedSupplierId('');
      setReceiptNo('');
      setPaymentType('TERM');
    } catch {
      showToast('Alım kaydedilirken bir hata oluştu.', 'error');
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  // Daily Sales Chart Data (Last 7 days)
  const dailyChartData = useMemo(() => {
    const days = [...Array(7)]
      .map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return getLocalDateString(d);
      })
      .reverse();

    const salesMap: Record<string, number> = {};
    prescriptions.forEach(p => {
      if (p.deletedAt || p.isProcessed === false || !p.date) return;
      const date = getLocalDateString(p.date);
      if (days.includes(date)) {
        const amt = Number(p.totalAmount) || 0;
        const isReturn = p.type === 'RETURN' || amt < 0;
        salesMap[date] = (salesMap[date] || 0) + (isReturn ? -Math.abs(amt) : Math.abs(amt));
      }
    });

    return days.map(date => {
      const parsedDate = new Date(`${date}T12:00:00`);
      return {
        date: parsedDate.toLocaleDateString(
          language === 'tr' ? 'tr-TR' : language === 'ar' ? 'ar-SA' : 'en-US',
          { weekday: 'short' }
        ),
        dayNum: parsedDate.getDate(),
        amount: salesMap[date] || 0,
        fullDate: date
      };
    });
  }, [prescriptions, language]);

  const sevenDayTotalSales = useMemo(() => {
    return dailyChartData.reduce((acc, d) => acc + d.amount, 0);
  }, [dailyChartData]);

  const recentPrescriptions = useMemo(() => {
    return [...prescriptions]
      .filter(p => !p.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [prescriptions]);

  const farmerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    farmers.forEach(f => {
      map[f.id] = f.fullName;
    });
    return map;
  }, [farmers]);

  const currency = userProfile?.currency || 'TRY';

  const portfolioTotals = useMemo(() => {
    const debt = Math.max(0, Math.round(stats.totalDebt || 0));
    const stock = Math.max(0, Math.round(stats.inventoryValue || 0));
    const cash = Math.max(0, Math.round(totalKasaBalance || 0));
    const sum = debt + stock + cash;
    if (sum <= 0) {
      return { debtPct: 0, stockPct: 0, cashPct: 0, totalAssets: 0 };
    }
    const debtPct = Math.max(5, Math.min(85, Math.round((debt / sum) * 100)));
    const stockPct = Math.max(5, Math.min(90 - debtPct, Math.round((stock / sum) * 100)));
    const cashPct = Math.max(5, 100 - debtPct - stockPct);
    return { debtPct, stockPct, cashPct, totalAssets: sum };
  }, [stats.totalDebt, stats.inventoryValue, totalKasaBalance]);

  const hideCosts = Boolean(userProfile?.hideCostAndProfit || activeTeamMember?.role === 'SALES');

  const activeFarmersList = useMemo(() => (farmers || []).filter(f => !f.deletedAt), [farmers]);
  const activeInventoryList = useMemo(() => (inventory || []).filter(i => !i.deletedAt), [inventory]);
  const activePrescriptionsList = useMemo(() => (prescriptions || []).filter(p => !p.deletedAt), [prescriptions]);

  const criticalStockItems = useMemo(() => {
    const in60DaysMs = Date.now() + 60 * 86400000;
    return activeInventoryList
      .filter(item => {
        const qty = Number(item.quantity) || 0;
        const threshold = Number(item.lowStockThreshold) || 10;
        const expMs = item.expiryDate ? Date.parse(item.expiryDate) : NaN;
        const isExpiring = !Number.isNaN(expMs) && expMs <= in60DaysMs;
        return qty <= threshold || isExpiring;
      })
      .sort((a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0))
      .slice(0, 6);
  }, [activeInventoryList]);

  const filteredQuickFarmers = useMemo(() => {
    const q = farmerQuickSearch.trim().toLocaleLowerCase('tr-TR');
    return [...activeFarmersList]
      .filter(f => {
        if (!q) return true;
        return [f.fullName, f.village, f.phoneNumber].some(v =>
          String(v ?? '').toLocaleLowerCase('tr-TR').includes(q)
        );
      })
      .sort((a, b) => {
        const aOpen = (a.balance || 0) < -0.01 ? 1 : 0;
        const bOpen = (b.balance || 0) < -0.01 ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return (a.balance || 0) - (b.balance || 0);
      })
      .slice(0, 6);
  }, [activeFarmersList, farmerQuickSearch]);

  const openRemindersList = useMemo(
    () => (reminders || []).filter(r => !r.isCompleted).slice(0, 4),
    [reminders]
  );

  const avatarGradients = [
    'from-[#0d2822] to-[#22a071]',
    'from-[#c25929] to-[#f39264]',
    'from-[#1e3a8a] to-[#3b82f6]',
    'from-[#065f46] to-[#34d399]',
    'from-[#581c87] to-[#a855f7]',
    'from-[#0f766e] to-[#2dd4bf]'
  ];

  const maxDailySales = useMemo(
    () => Math.max(...dailyChartData.map(x => Math.max(0, x.amount)), 1),
    [dailyChartData]
  );

  return (
    <div className="space-y-4 pb-6">
      {/* ==================== LIVE WEATHER, DELTA-T SPRAYING SUITABILITY & MORNING BRIEFING ==================== */}
      <DashboardWeatherAndBriefingBanner onNavigate={onNavigate} />

      {/* ==================== REGIONAL ALERTS BANNER (IF ANY) ==================== */}
      {stats.regionalAlerts.length > 0 && (
        <div className="v22-bento-card p-3.5 border-l-4 border-l-rose-500 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
              <Bug size={16} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-rose-500 uppercase tracking-wider">
                {t('dashboard.regional_risk') || 'Bölgesel Salgın & Zararlı Uyarısı'}
              </h4>
              <p className="text-xs font-semibold" style={{ color: 'var(--mks-muted)' }}>
                {stats.regionalAlerts.map(a => `${a.village} (${a.type})`).join(' • ')}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-extrabold bg-rose-500 text-white px-2.5 py-1 rounded-full uppercase">
            {stats.regionalAlerts.length} Kritik Bölge
          </span>
        </div>
      )}

      {/* ==================== UNIFIED KURUMSAL KOMUTA MERKEZİ (TÜM TEMALAR & CİHAZLAR) ==================== */}
      <div className="space-y-4">
        {/* TIER 1 — Hızlı İşlem & Resmi Servis Komuta Paneli */}
        <section className="v22-forest-card v22-stagger-1 p-4 sm:p-5 relative overflow-hidden">
          <div
            className="absolute -right-12 -top-12 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(52,211,153,0.18) 0%, rgba(56,189,248,0.10) 55%, transparent 74%)'
            }}
          />

          <div className="relative z-10 space-y-4">
            {/* Compact Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="v22-keep-white text-lg sm:text-xl font-black tracking-tight text-white truncate">
                    {userProfile?.companyName || 'MKS Kurumsal Komuta Merkezi'}
                  </h2>
                  <span className="v22-keep-white inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-[11px] font-bold text-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Yerel Hafıza + Bulut Senkron
                  </span>
                </div>
                <p className="v22-keep-white text-xs text-white/75 mt-0.5">
                  Satış, tahsilat, depo, resmi bakanlık bildirimleri ve saha araçlarını tek merkezden yönetin.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigate('FARMERS')}
                  className="v22-keep-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold text-white transition-colors"
                >
                  <Users size={12} className="text-sky-300" />
                  <span>{activeFarmersList.length} Çiftçi</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('KASA')}
                  className="v22-keep-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold text-white transition-colors"
                >
                  <Wallet size={12} className="text-emerald-300" />
                  <span>{(accounts || []).length} Kasa &amp; Banka</span>
                </button>
              </div>
            </div>

            {/* Primary 4-Button Action Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate(canCreatePrescription ? 'PRESCRIPTION_NEW' : 'PRESCRIPTION_LIST')}
                className="group p-3.5 rounded-2xl bg-gradient-to-br from-[#f39264] to-[#e57c4b] hover:from-[#f6a077] hover:to-[#eb8758] text-[#0b211d] text-left flex items-center gap-3 shadow-lg shadow-black/25 active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-black/15 text-[#0b211d] flex items-center justify-center shrink-0">
                  <FileText size={19} strokeWidth={2.4} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-black leading-tight text-[#0b211d] flex items-center justify-between gap-1">
                    <span className="truncate">Satış / Reçete Oluştur</span>
                    <ChevronRight size={15} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] font-bold text-[#0b211d]/80 mt-0.5 truncate">
                    Barkodlu &amp; vadeli satış
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('mks-open-quick-modal', { detail: { modal: 'RECEIVE_PAYMENT' } })
                  );
                }}
                className="v22-keep-white group p-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-white text-left flex items-center gap-3 shadow-md active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                  <Wallet size={19} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="v22-keep-white text-xs sm:text-sm font-extrabold leading-tight text-white flex items-center justify-between gap-1">
                    <span className="truncate">Tahsilat Al</span>
                    <ChevronRight size={15} className="shrink-0 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="v22-keep-white text-[11px] font-medium text-emerald-100/85 mt-0.5 truncate">
                    Nakit, POS, Çek &amp; Senet
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(true)}
                className="v22-keep-white group p-3.5 rounded-2xl bg-white/10 hover:bg-white/18 border border-white/20 text-white text-left flex items-center gap-3 shadow-md active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-white/15 text-amber-300 flex items-center justify-center shrink-0">
                  <Truck size={19} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="v22-keep-white text-xs sm:text-sm font-extrabold leading-tight text-white flex items-center justify-between gap-1">
                    <span className="truncate">Hızlı Stok Girişi</span>
                    <ChevronRight size={15} className="shrink-0 text-white/80 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="v22-keep-white text-[11px] font-medium text-white/75 mt-0.5 truncate">
                    Tedarikçiden ürün alımı
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsQuickFarmerModalOpen(true)}
                className="v22-keep-white group p-3.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-white text-left flex items-center gap-3 shadow-md active:scale-[0.98] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center shrink-0">
                  <Users size={19} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="v22-keep-white text-xs sm:text-sm font-extrabold leading-tight text-white flex items-center justify-between gap-1">
                    <span className="truncate">Yeni {farmerLabel} Ekle</span>
                    <ChevronRight size={15} className="shrink-0 text-sky-300 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="v22-keep-white text-[11px] font-medium text-sky-100/80 mt-0.5 truncate">
                    Hızlı cari hesap açılışı
                  </p>
                </div>
              </button>
            </div>

            {/* Single-Row Resmi Servisler & Saha Araçları Kısayol Şeridi */}
            <div className="pt-3 border-t border-white/15 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => (window as any).mks_open_ministry?.('bkts')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <QrCode size={14} className="text-emerald-300" />
                <span>BKTS (Yakında)</span>
              </button>
              <button
                type="button"
                onClick={() => (window as any).mks_open_ministry?.('gts')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Sprout size={14} className="text-emerald-300" />
                <span>GTS (Yakında)</span>
              </button>
              <button
                type="button"
                onClick={() => (window as any).mks_open_ministry?.('brecete')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <ShieldCheck size={14} className="text-emerald-300" />
                <span>B-Reçete (Yakında)</span>
              </button>
              <button
                type="button"
                onClick={() => (window as any).mks_open_ministry?.('malkabul')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 size={14} className="text-emerald-300" />
                <span>Mal Kabul</span>
              </button>
              <button
                type="button"
                onClick={() => (window as any).mks_open_efatura?.('issue')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 border border-indigo-400/30 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Receipt size={14} className="text-indigo-300" />
                <span>e-Fatura</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('MAP')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <MapIcon size={14} className="text-sky-300" />
                <span>TKGM Harita</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('AI_ASSISTANT')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Sparkles size={14} className="text-amber-300" />
                <span>Zirai Asistan</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('MKS_MUHENDISIM')}
                className="v22-keep-white px-3 py-1.5 min-h-[34px] rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <FlaskConical size={14} className="text-emerald-300" />
                <span>MKS Mühendisim</span>
              </button>
            </div>
          </div>
        </section>

        {/* TIER 2 — 4 Kurumsal Finans & Stok Özeti Kartı */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 v22-stagger-2">
          {/* 1. Toplam Cari Alacak */}
          <button
            type="button"
            onClick={() => onNavigate(isSales ? 'PRESCRIPTIONS' : 'DEBT_TRACKING')}
            className="v22-bento-card p-4 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-muted)' }}>
                Toplam Cari Alacak
              </span>
              <ArrowUpRight size={15} className="shrink-0" style={{ color: 'var(--mks-muted)' }} />
            </div>
            <div className="my-2.5 min-w-0">
              <div
                className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums truncate"
                style={{ color: 'var(--mks-text)' }}
              >
                {isSales
                  ? `${activePrescriptionsList.length} Reçete`
                  : formatCurrency(Math.round(stats.totalDebt || 0), currency)}
              </div>
              <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
                {activeDebtorsCount} borçlu cari · {activeFarmersList.length} kayıtlı çiftçi
              </p>
            </div>
            <div className="space-y-1.5 w-full">
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--mks-subcard)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${portfolioTotals.debtPct}%`, background: 'var(--mks-accent-primary)' }}
                />
              </div>
              <div className="text-[11px] font-bold flex items-center justify-between" style={{ color: 'var(--mks-muted)' }}>
                <span>%{portfolioTotals.debtPct} portföy payı</span>
                <span style={{ color: 'var(--mks-accent-primary)' }}>Risk Takibi →</span>
              </div>
            </div>
          </button>

          {/* 2. Kasa & Banka Mevcudu */}
          <button
            type="button"
            onClick={() => onNavigate('KASA')}
            className="v22-bento-card p-4 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-muted)' }}>
                Kasa &amp; Banka Mevcudu
              </span>
              <ArrowUpRight size={15} className="shrink-0" style={{ color: 'var(--mks-muted)' }} />
            </div>
            <div className="my-2.5 min-w-0">
              <div
                className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums truncate"
                style={{ color: 'var(--mks-text)' }}
              >
                {formatCurrency(Math.round(totalKasaBalance || 0), currency)}
              </div>
              <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
                {(accounts || []).length} aktif kasa/banka · 7G Satış: {formatCurrency(Math.round(sevenDayTotalSales), currency)}
              </p>
            </div>
            <div className="space-y-1.5 w-full">
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--mks-subcard)' }}>
                <div
                  className="h-full rounded-full bg-[#f39264] transition-all duration-500"
                  style={{ width: `${portfolioTotals.cashPct}%` }}
                />
              </div>
              <div className="text-[11px] font-bold flex items-center justify-between" style={{ color: 'var(--mks-muted)' }}>
                <span>%{portfolioTotals.cashPct} nakit payı</span>
                <span style={{ color: 'var(--mks-accent-primary)' }}>Kasa Aç →</span>
              </div>
            </div>
          </button>

          {/* 3. Depo & Stok Varlığı */}
          <button
            type="button"
            onClick={() => onNavigate('INVENTORY')}
            className="v22-bento-card p-4 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-muted)' }}>
                Depo &amp; Stok Varlığı
              </span>
              <ArrowUpRight size={15} className="shrink-0" style={{ color: 'var(--mks-muted)' }} />
            </div>
            <div className="my-2.5 min-w-0">
              <div
                className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums truncate"
                style={{ color: 'var(--mks-text)' }}
              >
                {hideCosts ? '•••• ₺' : formatCurrency(Math.round(stats.inventoryValue || 0), currency)}
              </div>
              <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
                {activeInventoryList.length} aktif stok kalemi · {criticalStockItems.length} kritik stok
              </p>
            </div>
            <div className="space-y-1.5 w-full">
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--mks-subcard)' }}>
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${portfolioTotals.stockPct}%` }}
                />
              </div>
              <div className="text-[11px] font-bold flex items-center justify-between" style={{ color: 'var(--mks-muted)' }}>
                <span>%{portfolioTotals.stockPct} stok payı</span>
                <span style={{ color: 'var(--mks-accent-primary)' }}>Depo Kontrol →</span>
              </div>
            </div>
          </button>

          {/* 4. Tedarikçi & Alım Dengesi */}
          <button
            type="button"
            onClick={() => onNavigate('SUPPLIERS')}
            className="v22-bento-card p-4 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-muted)' }}>
                Tedarikçi &amp; Alım Dengesi
              </span>
              <ArrowUpRight size={15} className="shrink-0" style={{ color: 'var(--mks-muted)' }} />
            </div>
            <div className="my-2.5 min-w-0">
              <div
                className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums truncate"
                style={{ color: 'var(--mks-text)' }}
              >
                {formatCurrency(Math.round(totalSupplierDebt || 0), currency)}
              </div>
              <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
                {suppliers.length} tedarikçi firma · Bugün {stats.todayPrescriptions || 0} işlem
              </p>
            </div>
            <div className="pt-2 border-t flex items-center justify-between text-[11px] font-bold w-full" style={{ borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}>
              <span>Toplam Alacak: {activePrescriptionsList.length} kayıt</span>
              <span style={{ color: 'var(--mks-accent-primary)' }}>Tedarikçi Hesapları →</span>
            </div>
          </button>
        </section>

        {/* TIER 3 — 12-Column Ana Operasyon Çalışma Alanı */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start v22-stagger-3">
          {/* Left 7 Columns: Tabbed Workspace (Son Satışlar | 7G Ciro Analizi | Kritik Stok) */}
          <div className="lg:col-span-7 v22-bento-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="flex flex-wrap items-center gap-1 p-1 rounded-2xl border w-full sm:w-auto"
                style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
              >
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('SALES')}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap"
                  style={
                    workspaceTab === 'SALES'
                      ? { background: 'var(--mks-card)', color: 'var(--mks-text)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }
                      : { color: 'var(--mks-muted)' }
                  }
                >
                  Son Satış &amp; Reçeteler ({recentPrescriptions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('CHART')}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap"
                  style={
                    workspaceTab === 'CHART'
                      ? { background: 'var(--mks-card)', color: 'var(--mks-text)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }
                      : { color: 'var(--mks-muted)' }
                  }
                >
                  7 Günlük Ciro Analizi
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('LOW_STOCK')}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap"
                  style={
                    workspaceTab === 'LOW_STOCK'
                      ? { background: 'var(--mks-card)', color: 'var(--mks-text)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }
                      : { color: 'var(--mks-muted)' }
                  }
                >
                  Kritik Stok Kontrolü ({criticalStockItems.length})
                </button>
              </div>
            </div>

            {/* Tab 1: Son Satış & Reçeteler */}
            {workspaceTab === 'SALES' && (
              <div className="space-y-2">
                {recentPrescriptions.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(canCreatePrescription ? 'PRESCRIPTION_NEW' : 'PRESCRIPTIONS')}
                    className="w-full py-10 px-4 rounded-2xl border border-dashed text-center space-y-1.5 hover:opacity-90 transition-opacity"
                    style={{ borderColor: 'var(--mks-card-border)', background: 'var(--mks-subcard)' }}
                  >
                    <FileText size={24} className="mx-auto" style={{ color: 'var(--mks-accent-primary)' }} />
                    <p className="text-xs font-extrabold" style={{ color: 'var(--mks-text)' }}>
                      Henüz reçete veya satış kaydı yok
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                      İlk satış veya zirai reçetenizi oluşturmak için tıklayın
                    </p>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {recentPrescriptions.map((p: any) => {
                      const fName = farmerNameMap[p.farmerId] || 'Peşin Müşteri';
                      const amt = Math.abs(Number(p.totalAmount) || 0);
                      const isReturn = p.type === 'RETURN' || Number(p.totalAmount) < 0;
                      const isCash = p.priceType === 'CASH';
                      const itemCount = Array.isArray(p.items) ? p.items.length : 0;
                      const formattedDate = p.date
                        ? new Date(p.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
                        : '';
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => onNavigate('PRESCRIPTIONS')}
                          className="w-full p-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors hover:opacity-95"
                          style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-xs"
                              style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                            >
                              {fName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs sm:text-sm font-extrabold truncate" style={{ color: 'var(--mks-text)' }}>
                                  {fName}
                                </span>
                                <span
                                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    isReturn
                                      ? 'bg-rose-500/15 text-rose-500'
                                      : isCash
                                        ? 'bg-emerald-500/15 text-emerald-500'
                                        : 'bg-amber-500/15 text-amber-500'
                                  }`}
                                >
                                  {isReturn ? 'İade' : isCash ? 'Peşin' : 'Vadeli'}
                                </span>
                              </div>
                              <p className="text-[11px] font-semibold truncate mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                                {p.crop || 'Zirai Reçete'} · {itemCount} kalem{formattedDate ? ` · ${formattedDate}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums" style={{ color: 'var(--mks-text)' }}>
                              {isReturn ? '-' : ''}
                              {formatCurrency(Math.round(amt), currency)}
                            </div>
                            <span className="text-[10px] font-bold" style={{ color: 'var(--mks-muted)' }}>
                              {p.prescriptionNo || 'Detay →'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('PRESCRIPTIONS')}
                    className="w-full min-h-[40px] rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors hover:opacity-90"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                  >
                    <span>Tüm Satış &amp; Reçeteleri Gör</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: 7 Günlük Ciro Analizi */}
            {workspaceTab === 'CHART' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <div>
                    <div className="text-[11px] font-bold" style={{ color: 'var(--mks-muted)' }}>Son 7 Günlük Toplam Satış Hacmi</div>
                    <div className="text-xl font-black font-mono tabular-nums mt-0.5" style={{ color: 'var(--mks-text)' }}>
                      {formatCurrency(Math.round(sevenDayTotalSales), currency)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('STATISTICS')}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold border flex items-center gap-1"
                    style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-accent-primary)' }}
                  >
                    <span>Detaylı İstatistikler</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 h-44 pt-4 items-end">
                  {dailyChartData.map((d, idx) => {
                    const pct = d.amount > 0 ? Math.max(14, Math.round((d.amount / maxDailySales) * 100)) : 4;
                    const isToday = idx === dailyChartData.length - 1;
                    return (
                      <div
                        key={d.fullDate}
                        title={`${d.date} (${d.dayNum}): ${formatCurrency(Math.round(d.amount), currency)}`}
                        className="flex flex-col items-center h-full justify-end min-w-0"
                      >
                        <span className="text-[10px] font-mono tabular-nums truncate w-full text-center mb-1" style={{ color: 'var(--mks-muted)' }}>
                          {d.amount > 0 ? `${Math.round(d.amount / 1000)}k` : '0'}
                        </span>
                        <div
                          className="w-full max-w-[32px] flex-1 rounded-xl flex flex-col justify-end p-0.5 overflow-hidden border"
                          style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                        >
                          <div
                            className="w-full rounded-lg v22-bar-anim transition-all"
                            style={{
                              height: `${pct}%`,
                              background: d.amount <= 0
                                ? 'rgba(148,163,184,0.35)'
                                : isToday
                                  ? 'var(--mks-accent-primary)'
                                  : '#f39264'
                            }}
                          />
                        </div>
                        <span
                          className="text-[11px] font-bold mt-1.5"
                          style={{ color: isToday ? 'var(--mks-accent-primary)' : 'var(--mks-muted)' }}
                        >
                          {d.date}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--mks-muted)' }}>
                          {d.dayNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: Kritik Stok Kontrolü */}
            {workspaceTab === 'LOW_STOCK' && (
              <div className="space-y-2.5">
                {criticalStockItems.length === 0 ? (
                  <div
                    className="py-10 px-4 rounded-2xl border text-center space-y-1.5"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                    <p className="text-xs font-extrabold" style={{ color: 'var(--mks-text)' }}>
                      Kritik seviyede veya SKT yaklaşan stok bulunmuyor
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                      Depodaki {activeInventoryList.length} ürün kalemi güvenli stok aralığında.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {criticalStockItems.map(item => {
                      const qty = Number(item.quantity) || 0;
                      const isOut = qty <= 0;
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-2xl border flex items-center justify-between gap-3"
                          style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isOut ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'
                              }`}
                            >
                              <AlertTriangle size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-extrabold truncate" style={{ color: 'var(--mks-text)' }}>
                                {item.pesticideName}
                              </div>
                              <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--mks-muted)' }}>
                                {item.category || 'Zirai Ürün'}
                                {item.expiryDate ? ` · SKT ${new Date(item.expiryDate).toLocaleDateString('tr-TR')}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-extrabold font-mono ${
                                isOut ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'
                              }`}
                            >
                              {qty} {item.unit || 'Adet'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(true)}
                    className="min-h-[40px] rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <Plus size={14} /> Hızlı Stok Girişi Yap
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('INVENTORY')}
                    className="min-h-[40px] rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--mks-subcard)', color: 'var(--mks-text)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <span>Tüm Depoyu Aç</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Columns: Müstahsil Cari Kontrolü + Günlük Ajanda & Saha Görevleri */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card A — Müstahsil Cari Kontrolü */}
            <div className="v22-bento-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold" style={{ color: 'var(--mks-text)' }}>
                  {farmerLabel} Cari Kontrolü
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsQuickFarmerModalOpen(true)}
                    className="px-2.5 py-1 min-h-[32px] rounded-xl text-[11px] font-extrabold border flex items-center gap-1"
                    style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <Plus size={12} /> Yeni
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('FARMERS')}
                    className="px-2.5 py-1 min-h-[32px] rounded-xl text-[11px] font-bold border"
                    style={{ background: 'var(--mks-subcard)', color: 'var(--mks-text)', borderColor: 'var(--mks-card-border)' }}
                  >
                    Tümü ({activeFarmersList.length})
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--mks-muted)' }} />
                <input
                  type="text"
                  value={farmerQuickSearch}
                  onChange={e => setFarmerQuickSearch(e.target.value)}
                  placeholder="Çiftçi veya köy ara..."
                  aria-label="Çiftçi ara"
                  className="w-full min-h-[40px] pl-8 pr-3 rounded-xl border text-xs font-semibold outline-none"
                  style={{
                    background: 'var(--mks-subcard)',
                    borderColor: 'var(--mks-card-border)',
                    color: 'var(--mks-text)'
                  }}
                />
              </div>

              {filteredQuickFarmers.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setIsQuickFarmerModalOpen(true)}
                  className="w-full py-6 px-3 rounded-2xl border border-dashed text-center space-y-1"
                  style={{ borderColor: 'var(--mks-card-border)', background: 'var(--mks-subcard)' }}
                >
                  <Users size={20} className="mx-auto" style={{ color: 'var(--mks-accent-primary)' }} />
                  <p className="text-xs font-bold" style={{ color: 'var(--mks-text)' }}>
                    {farmerQuickSearch ? 'Aramanızla eşleşen çiftçi yok' : 'Henüz çiftçi kaydı yok'}
                  </p>
                </button>
              ) : (
                <div className="space-y-2">
                  {filteredQuickFarmers.slice(0, 5).map((f, idx) => {
                    const bal = Number(f.balance) || 0;
                    const hasDebt = bal < -0.01;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => onNavigate('FARMERS')}
                        className="w-full p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 text-left transition-colors hover:opacity-95"
                        style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-full bg-gradient-to-br ${
                              avatarGradients[idx % avatarGradients.length]
                            } text-white font-extrabold text-xs flex items-center justify-center shrink-0`}
                          >
                            {f.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-text)' }}>
                              {f.fullName}
                            </div>
                            <div className="text-[11px] truncate" style={{ color: 'var(--mks-muted)' }}>
                              {f.village || 'Merkez'}{f.phoneNumber ? ` · ${f.phoneNumber}` : ''}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-extrabold font-mono tabular-nums ${
                            hasDebt
                              ? 'bg-rose-500/15 text-rose-500'
                              : 'bg-emerald-500/15 text-emerald-500'
                          }`}
                        >
                          {hasDebt ? formatCurrency(Math.round(Math.abs(bal)), currency) : 'Dengeli'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card B — Günlük Ajanda & Saha Görevleri */}
            <div className="v22-bento-card p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold" style={{ color: 'var(--mks-text)' }}>
                  Ajanda &amp; Saha Görevleri
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('REMINDERS')}
                  className="px-2.5 py-1 min-h-[32px] rounded-xl text-[11px] font-bold border"
                  style={{ background: 'var(--mks-subcard)', color: 'var(--mks-text)', borderColor: 'var(--mks-card-border)' }}
                >
                  Tüm Görevler
                </button>
              </div>

              {openRemindersList.length === 0 ? (
                <div
                  className="p-4 rounded-2xl border text-center space-y-2.5"
                  style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                >
                  <CalendarCheck size={20} className="mx-auto" style={{ color: 'var(--mks-accent-primary)' }} />
                  <p className="text-xs font-bold" style={{ color: 'var(--mks-text)' }}>
                    Bugün için bekleyen açık görev yok
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('REMINDERS')}
                      className="min-h-[36px] rounded-xl border text-[11px] font-bold"
                      style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                    >
                      Ajanda Aç
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('VISITS')}
                      className="min-h-[36px] rounded-xl border text-[11px] font-bold"
                      style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                    >
                      Tarla Ziyaretleri
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {openRemindersList.map(rem => (
                    <button
                      type="button"
                      key={rem.id}
                      onClick={() => onNavigate('REMINDERS')}
                      className="w-full p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 text-left transition-colors hover:opacity-95"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                        >
                          <CalendarCheck size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold truncate" style={{ color: 'var(--mks-text)' }}>
                            {rem.title}
                          </div>
                          <div className="text-[11px] truncate" style={{ color: 'var(--mks-muted)' }}>
                            {rem.date ? new Date(rem.date).toLocaleDateString('tr-TR') : 'Planlı Görev'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--mks-muted)' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ==================== QUICK PURCHASE MODAL ==================== */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-3xl w-full max-w-lg shadow-2xl relative border border-black/10 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-h-[90dvh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-base font-extrabold text-[#0b211d]">{t('dashboard.quick_purchase')}</h2>
                <p className="text-xs text-[#5c726b] font-medium">{t('dashboard.supplier_stock_entry')}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(false)}
                aria-label={t('common.close') || 'Kapat'}
                data-mks-modal-close="true"
                className="w-11 h-11 shrink-0 flex items-center justify-center bg-[#f3f6f4] rounded-full text-[#0b211d] hover:bg-[#e2ece7] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#5c726b] ml-1 uppercase tracking-wider mb-1 block">
                    {t('dashboard.select_supplier')}
                  </label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value)}
                    className="w-full h-[46px] px-3.5 bg-[#f3f6f4] border border-black/10 rounded-xl outline-none font-bold text-[#0b211d] text-sm"
                  >
                    <option value="">Tedarikçi Seçiniz...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5c726b] ml-1 uppercase tracking-wider mb-1 block">
                    {t('dashboard.receipt_no')} / Ödeme
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={receiptNo}
                      onChange={e => setReceiptNo(e.target.value)}
                      placeholder={t('dashboard.optional')}
                      className="flex-1 h-[46px] px-3.5 bg-[#f3f6f4] border border-black/10 rounded-xl outline-none font-bold text-[#0b211d] text-sm min-w-0"
                    />
                    <div className="flex bg-[#f3f6f4] border border-black/10 rounded-xl p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPaymentType('TERM')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                          paymentType === 'TERM' ? 'v22-dark-pill bg-[#0b211d] text-white shadow' : 'text-[#5c726b]'
                        }`}
                      >
                        Vadeli
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentType('CASH')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                          paymentType === 'CASH' ? 'bg-[#147a58] text-white shadow' : 'text-[#5c726b]'
                        }`}
                      >
                        Peşin
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <label className="text-[11px] font-bold text-[#5c726b] ml-1 uppercase tracking-wider mb-1 block">
                  {t('dashboard.add_product')}
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 text-[#5c726b]" size={16} />
                  <input
                    type="text"
                    value={searchPestTerm}
                    onChange={e => setSearchPestTerm(e.target.value)}
                    placeholder={t('dashboard.product_placeholder')}
                    className="w-full p-3 pl-10 bg-[#f3f6f4] border border-black/10 rounded-xl outline-none font-bold text-[#0b211d] text-sm"
                  />
                </div>

                {searchPestTerm && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                    {filteredPesticides.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddPurchaseItem(p)}
                        className="w-full text-left p-3 hover:bg-[#f3f6f4] border-b border-black/5 last:border-0 transition-colors"
                      >
                        <div className="font-bold text-[#0b211d] text-xs">{p.name}</div>
                        <div className="text-[11px] text-[#5c726b] uppercase">{p.category}</div>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddPurchaseItem({ name: searchPestTerm, isNew: true })}
                      className="w-full text-left p-3 hover:bg-[#d5f2e5] border-t border-black/5 transition-colors flex items-center gap-2"
                    >
                      <Plus size={15} className="text-[#147a58]" />
                      <span className="text-xs font-bold text-[#147a58]">
                        "{searchPestTerm}" {t('dashboard.add_new')}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-[40dvh] overflow-y-auto custom-scrollbar pr-1">
                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="bg-[#f3f6f4] border border-black/5 rounded-2xl p-3 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-[#0b211d] truncate pr-4">{item.pesticideName}</span>
                      <button
                        type="button"
                        onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))}
                        aria-label="Satırı sil"
                        title="Satırı sil"
                        className="w-11 h-11 -m-2 shrink-0 flex items-center justify-center rounded-full text-[#5c726b] hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-[#5c726b] uppercase mb-1 block">
                          {t('dashboard.quantity')}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={item.quantity}
                          onChange={e => {
                            const newItems = [...purchaseItems];
                            const qty = parseFloat(e.target.value.replace(',', '.'));
                            newItems[idx].quantity = isNaN(qty) ? 0 : qty;
                            setPurchaseItems(newItems);
                          }}
                          className="w-full h-9 px-2.5 bg-white border border-black/10 rounded-lg text-xs font-bold text-[#0b211d] outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#5c726b] uppercase mb-1 block">
                          {t('dashboard.unit')}
                        </label>
                        <select
                          value={item.unit}
                          onChange={e => {
                            const newItems = [...purchaseItems];
                            newItems[idx].unit = e.target.value;
                            setPurchaseItems(newItems);
                          }}
                          className="w-full h-9 px-2 bg-white border border-black/10 rounded-lg text-xs font-bold text-[#0b211d] outline-none"
                        >
                          <option value="Adet">{t('dashboard.unit_piece')}</option>
                          <option value="Litre">{t('dashboard.unit_liter')}</option>
                          <option value="Kg">{t('dashboard.unit_kg')}</option>
                          <option value="Kutu">{t('dashboard.unit_box')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#5c726b] uppercase mb-1 block">
                          {t('dashboard.buying_price')}
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={item.buyingPrice}
                          onChange={e => {
                            const newItems = [...purchaseItems];
                            const price = parseFloat(e.target.value.replace(',', '.'));
                            newItems[idx].buyingPrice = isNaN(price) ? 0 : price;
                            setPurchaseItems(newItems);
                          }}
                          className="w-full h-9 px-2.5 bg-white border border-black/10 rounded-lg text-xs font-bold text-[#0b211d] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {purchaseItems.length === 0 && (
                  <div className="py-8 text-center border-2 border-dashed border-black/10 rounded-2xl">
                    <Package size={24} className="text-[#5c726b] mx-auto mb-2" />
                    <p className="text-xs text-[#5c726b] font-bold">{t('dashboard.no_product_added')}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-black/10">
                <div className="flex justify-between items-center mb-4 px-1">
                  <span className="text-xs font-extrabold text-[#5c726b] uppercase">
                    {t('dashboard.total_amount')}
                  </span>
                  <span className="text-lg font-black text-[#147a58] font-mono">
                    {formatCurrency(
                      purchaseItems.reduce((sum, item) => sum + item.quantity * item.buyingPrice, 0),
                      currency
                    )}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingPurchase || !selectedSupplierId || purchaseItems.length === 0}
                  className="v22-dark-pill w-full bg-[#0b211d] text-white py-3.5 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {isSubmittingPurchase ? 'Kaydediliyor...' : t('dashboard.save_purchase')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== NEWS DETAIL MODAL ==================== */}
      {selectedNews && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={e => {
            if (e.target === e.currentTarget) setSelectedNews(null);
          }}
        >
          <div className="bg-white w-full max-w-lg rounded-3xl border border-black/10 overflow-hidden flex flex-col max-h-[90dvh] shadow-2xl">
            <div className="relative h-48 sm:h-64 bg-[#f3f6f4] shrink-0">
              {selectedNews.imageUrl ? (
                <img
                  src={selectedNews.imageUrl}
                  alt={selectedNews.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#5c726b]">
                  <Newspaper size={64} />
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                aria-label={t('common.close') || 'Kapat'}
                data-mks-modal-close="true"
                className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <h2 className="text-lg font-black text-[#0b211d] leading-tight mb-3">{selectedNews.title}</h2>
              <p className="text-[#5c726b] text-sm leading-relaxed whitespace-pre-wrap">{selectedNews.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== QUICK ADD FARMER MODAL ==================== */}
      {isQuickFarmerModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
          onClick={e => {
            if (e.target === e.currentTarget) setIsQuickFarmerModalOpen(false);
          }}
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-black/10 rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#116a4e]/15 text-[#116a4e] flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0b211d]">Hızlı Çiftçi Ekle</h3>
                  <p className="text-[11px] font-semibold text-[#5c726b]">Yeni cari hesap ve WhatsApp iletişim kartı</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickFarmerModalOpen(false)}
                aria-label="Kapat"
                data-mks-modal-close="true"
                className="w-11 h-11 rounded-full bg-[#f3f6f4] text-[#0b211d] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickFarmerSubmit} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-[#5c726b] uppercase mb-1 block">
                  Ad Soyad / Ünvan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={quickFarmerName}
                  onChange={e => setQuickFarmerName(e.target.value)}
                  className="w-full h-11 px-3.5 bg-[#f3f6f4] border border-black/10 rounded-xl text-xs font-bold text-[#0b211d] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#5c726b] uppercase mb-1 block">
                    WhatsApp / Telefon
                  </label>
                  <input
                    type="tel"
                    placeholder="05XX XXX XX XX"
                    value={quickFarmerPhone}
                    onChange={e => setQuickFarmerPhone(e.target.value)}
                    className="w-full h-11 px-3.5 bg-[#f3f6f4] border border-black/10 rounded-xl text-xs font-bold text-[#0b211d] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#5c726b] uppercase mb-1 block">
                    Köy / Mahalle
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Akçakale / Merkez"
                    value={quickFarmerVillage}
                    onChange={e => setQuickFarmerVillage(e.target.value)}
                    className="w-full h-11 px-3.5 bg-[#f3f6f4] border border-black/10 rounded-xl text-xs font-bold text-[#0b211d] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5c726b] uppercase mb-1 block">
                  TC Kimlik / VKN (BKTS &amp; e-Fatura için opsiyonel)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="11 haneli TC Kimlik No"
                  value={quickFarmerTcNo}
                  onChange={e => setQuickFarmerTcNo(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-11 px-3.5 bg-[#f3f6f4] border border-black/10 rounded-xl text-xs font-bold text-[#0b211d] outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsQuickFarmerModalOpen(false);
                    onNavigate('FARMERS');
                  }}
                  className="sm:flex-1 py-3 px-4 rounded-xl bg-[#f3f6f4] text-[#0b211d] font-bold text-xs border border-black/10"
                >
                  Tüm Çiftçiler Ekranı
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuickFarmer || !quickFarmerName.trim()}
                  className="sm:flex-1 v22-dark-pill py-3 px-4 rounded-xl bg-[#0b211d] text-white font-extrabold text-xs shadow-lg disabled:opacity-50"
                >
                  {isSavingQuickFarmer ? 'Kaydediliyor...' : 'Çiftçiyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== BUY PLAN MODAL ==================== */}
      {isBuyPlanModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-300"
          onClick={e => {
            if (e.target === e.currentTarget) setIsBuyPlanModalOpen(false);
          }}
        >
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white border border-black/10 rounded-3xl shadow-2xl relative p-6">
            <button
              type="button"
              onClick={() => setIsBuyPlanModalOpen(false)}
              aria-label={t('common.close') || 'Kapat'}
              data-mks-modal-close="true"
              className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center bg-[#f3f6f4] text-[#0b211d] rounded-full"
            >
              <X size={18} />
            </button>
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto bg-[#0b211d] text-[#f39264] rounded-2xl flex items-center justify-center mb-3">
                <Star size={28} className="fill-[#f39264]" />
              </div>
              <h3 className="text-xl font-black text-[#0b211d]">MKS Studio V22 Pro</h3>
              <p className="text-xs text-[#147a58] font-bold uppercase tracking-wider mt-0.5">
                Sınırsız Kurumsal Lisans
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const message = 'Mühendis Kayıt Uygulamasını çok beğendim ve ben de bu aileye katılmak istiyorum';
                const url = buildWaUrl(SUPPORT_WHATSAPP, message);
                if (url) window.open(url, '_blank');
                setIsBuyPlanModalOpen(false);
              }}
              className="v22-dark-pill w-full py-3.5 bg-[#0b211d] rounded-full text-white font-extrabold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
            >
              <Zap size={16} />
              Şimdi Yükselt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { WeatherWidget, DashboardWeatherAndBriefingBanner } from './WeatherComponents';
import {
  Users, FileText, Sprout, Plus, X, ChevronRight, ChevronLeft, Zap,
  CalendarCheck, TrendingUp, AlertCircle, Bug, Package,
  FlaskConical, Star, Truck, Search, DollarSign, Trash2,
  Wallet, Calculator, Map, Newspaper, Bot, Database,
  CreditCard, ArrowUpRight, Sparkles, LineChart, Layers, Copy, CheckCircle2, Eye, BookOpen
} from 'lucide-react';
import { Pesticide } from '../types';
import { dbService } from '../services/db';
import { formatCurrency } from '../utils/currency';
import { useBackHandler } from '../utils/navigationManager';
import { buildWaUrl } from '../utils/whatsappTemplates';
import { SUPPORT_WHATSAPP } from '../constants';
import { GlassyV30Studio } from './GlassyV30Studio';

interface DashboardProps {
  onNavigate: (view: any) => void;
}

// Smooth Rolling Odometer Hook (Matches Reel DfcQ2TrTbGV 00 -> 49 | 83 animation)
function useRollingNumber(target: number, duration = 750): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = Math.max(0, Math.round(target));
    if (end === 0) {
      setVal(0);
      return;
    }
    const startTime = performance.now();
    let rafId: number;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * end);
      setVal(start);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return val;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
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
    news
  } = useAppViewModel();

  const [selectedNews, setSelectedNews] = useState<any>(null);
  const [isBuyPlanModalOpen, setIsBuyPlanModalOpen] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [impactTab, setImpactTab] = useState<'IMPACT' | 'ENGAGEMENT'>('IMPACT');
  const [feedTab, setFeedTab] = useState<'OVERVIEW' | 'FOCUS' | 'WEATHER'>('OVERVIEW');

  const isSales = activeTeamMember?.role === 'SALES';
  const canCreatePrescription = !isSales;
  const farmerLabel = t('label.farmer') || 'Müstahsil';
  const prescriptionLabel = t('label.prescription') || 'Reçete';

  // Klavye erişilebilirliği: role="button" kartlar için Enter/Space ile tetikleme (UI-54)
  const activateOnKey = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

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
    const trimmedName = quickFarmerName.trim();
    if (!trimmedName) {
      showToast('Lütfen çiftçi (müstahsil) adını girin.', 'error');
      return;
    }
    setIsSavingQuickFarmer(true);
    try {
      await addFarmer({
        fullName: trimmedName,
        phoneNumber: quickFarmerPhone.trim(),
        village: quickFarmerVillage.trim() || 'Merkez',
        tcNo: quickFarmerTcNo.trim() || undefined,
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

  const nextReminder = reminders.find(r => !r.isCompleted);

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
    if (!selectedSupplierId || purchaseItems.length === 0) return;

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
      await addSupplierPayment({
        supplierId: selectedSupplierId,
        amount: totalAmount,
        date,
        method: 'CASH',
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
  };

  // Daily Sales Chart Data (Last 7 days)
  const dailyChartData = useMemo(() => {
    const days = [...Array(7)]
      .map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      })
      .reverse();

    const salesMap: Record<string, number> = {};
    prescriptions.forEach(p => {
      const date = p.date.split('T')[0];
      if (days.includes(date)) {
        const amt = Number(p.totalAmount) || 0;
        const isReturn = p.type === 'RETURN' || amt < 0;
        salesMap[date] = (salesMap[date] || 0) + (isReturn ? -Math.abs(amt) : Math.abs(amt));
      }
    });

    return days.map(date => ({
      date: new Date(date).toLocaleDateString(
        language === 'tr' ? 'tr-TR' : language === 'ar' ? 'ar-SA' : 'en-US',
        { weekday: 'short' }
      ),
      dayNum: new Date(date).getDate(),
      amount: salesMap[date] || 0,
      fullDate: date
    }));
  }, [prescriptions, language]);

  const sevenDayTotalSales = useMemo(() => {
    return dailyChartData.reduce((acc, d) => acc + d.amount, 0);
  }, [dailyChartData]);

  const recentPrescriptions = useMemo(() => {
    return [...prescriptions]
      .filter(p => !p.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 4);
  }, [prescriptions]);

  const farmerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    farmers.forEach(f => {
      map[f.id] = f.fullName;
    });
    return map;
  }, [farmers]);

  const currency = userProfile?.currency || 'TRY';

  // Portfolio Distribution Percentages for Card 2 ("Data 10,4h" 3-segment bar in frame_06.jpg)
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

  // Rolling Odometer Counters (100% genuine account figures — zero fake fallbacks)
  const activeFarmersList = useMemo(() => (farmers || []).filter(f => !f.deletedAt), [farmers]);
  const activeInventoryList = useMemo(() => (inventory || []).filter(i => !i.deletedAt), [inventory]);
  const activePrescriptionsList = useMemo(() => (prescriptions || []).filter(p => !p.deletedAt), [prescriptions]);

  const rollingPrimaryStat = useRollingNumber(
    statsPeriod === 'WEEKLY' ? stats.todayPrescriptions || 0 : activePrescriptionsList.length
  );
  const rollingSecondaryStat = useRollingNumber(
    statsPeriod === 'WEEKLY' ? activePrescriptionsList.length : activeFarmersList.length
  );
  const rollingCompleted = useRollingNumber(activeFarmersList.length);
  const rollingInProgress = useRollingNumber(activeInventoryList.length);

  // Top 6 Real Farmers ONLY (zero demo/sample farmers)
  const displayFarmers = useMemo(() => {
    return activeFarmersList.slice(0, 6);
  }, [activeFarmersList]);

  const avatarGradients = [
    'from-[#0d2822] to-[#22a071]',
    'from-[#c25929] to-[#f39264]',
    'from-[#1e3a8a] to-[#3b82f6]',
    'from-[#065f46] to-[#34d399]',
    'from-[#581c87] to-[#a855f7]',
    'from-[#0f766e] to-[#2dd4bf]'
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* ==================== LIVE WEATHER, DELTA-T SPRAYING SUITABILITY & MORNING BRIEFING ==================== */}
      <DashboardWeatherAndBriefingBanner onNavigate={onNavigate} />

      {/* ==================== REGIONAL ALERTS BANNER (IF ANY) ==================== */}
      {stats.regionalAlerts.length > 0 && (
        <div className="v22-bento-card p-3.5 border-l-4 border-l-rose-500 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-600 flex items-center justify-center">
              <Bug size={16} />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-rose-600 uppercase tracking-wider">
                {t('dashboard.regional_risk') || 'Bölgesel Salgın & Zararlı Uyarısı'}
              </h4>
              <p className="text-xs font-semibold opacity-80">
                {stats.regionalAlerts.map(a => `${a.village} (${a.type})`).join(' • ')}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-extrabold bg-rose-500 text-white px-2.5 py-1 rounded-full uppercase">
            {stats.regionalAlerts.length} Kritik Bölge
          </span>
        </div>
      )}

      {/* ==================== CODEXR GLASSY DASHBOARD V30 (ONLY WHEN EXPLICITLY SELECTED IN SETTINGS) ==================== */}
      {userProfile?.theme === 'GLASSY_V30' ? (
        <GlassyV30Studio
          onNavigate={onNavigate}
          onOpenQuickPurchase={() => setIsPurchaseModalOpen(true)}
        />
      ) : (
      /* ==================== MASTER 12-COLUMN REEL DfcQ2TrTbGV BENTO LAYOUT ==================== */
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ==================== LEFT 8 COLUMNS (Hero Banner + 3 Middle Cards + 2 Bottom Cards) ==================== */}
        <div className="lg:col-span-8 space-y-4">
          {/* 1. HERO COMMAND CARD ("Bereket her zaman birlikte büyür" + 3 Ana Hızlı İşlem Kartı) */}
          <div className="v22-forest-card v22-stagger-1 p-5 sm:p-6 relative overflow-hidden">
            {/* Soft radial mint aura on right */}
            <div
              className="absolute -right-12 -top-12 w-64 h-64 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(52,211,153,0.20) 0%, rgba(243,146,100,0.10) 50%, transparent 72%)'
              }}
            />

            <div className="relative z-10 space-y-5">
              {/* Top Row: Headline & Subtitle on Left, Live Sync & Kasa Status on Right */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/25 text-emerald-300 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Yerel Hafıza + Bulut Canlı Senkron</span>
                  </div>
                  <h2 className="v22-keep-white text-2xl sm:text-[26px] font-extrabold tracking-tight text-white leading-tight">
                    Bereket her zaman{' '}
                    <span className="font-serif-editorial italic font-normal text-[#f39264] text-[26px] sm:text-[30px] px-0.5">
                      birlikte
                    </span>{' '}
                    büyür
                  </h2>
                  <p className="v22-keep-white text-xs sm:text-[13px] text-white/75 leading-relaxed font-medium">
                    Çiftçi cari hesapları, tahsilatlar, depo stokları, BKTS/GTS karekod ve e-Fatura işlemlerinizi tek merkezden yönetin.
                  </p>
                </div>

                {/* Right Avatar Cluster + Real Account Pill */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  <div className="flex items-center -space-x-2">
                    <span className="w-8 h-8 rounded-full bg-[#1b4d3e] border-2 border-[#0d2822] text-[#8fd9b8] text-[11px] font-extrabold flex items-center justify-center z-10">
                      {activeFarmersList.length}
                    </span>
                    {displayFarmers.slice(0, 4).map((f, i) => (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => onNavigate('FARMERS')}
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} border-2 border-[#0d2822] text-white text-[11px] font-extrabold flex items-center justify-center cursor-pointer hover:scale-110 transition-transform`}
                        title={f.fullName}
                        aria-label={f.fullName}
                      >
                        {f.fullName.charAt(0).toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('KASA')}
                    className="v22-keep-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 border border-white/15 text-[11px] font-bold text-white/90 cursor-pointer hover:bg-black/45 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                    <span>{(accounts || []).length} kasa &amp; banka aktif</span>
                  </button>
                </div>
              </div>

              {/* Primary 3-Column Action Shortcuts: 1. Satış Oluştur, 2. Tahsilat Yap, 3. Çiftçi Ekle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(canCreatePrescription ? 'PRESCRIPTION_NEW' : 'PRESCRIPTION_LIST')}
                  className="group p-3.5 rounded-2xl bg-gradient-to-br from-[#f39264] to-[#e57c4b] hover:from-[#f6a077] hover:to-[#eb8758] text-[#0b211d] text-left flex items-center gap-3 shadow-lg shadow-black/25 active:scale-[0.98] transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-black/15 text-[#0b211d] flex items-center justify-center shrink-0">
                    <FileText size={20} strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-black leading-tight text-[#0b211d] flex items-center justify-between gap-1">
                      <span>Satış / Reçete Oluştur</span>
                      <ChevronRight size={15} className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] font-bold text-[#0b211d]/80 mt-0.5 truncate">
                      Barkodlu &amp; B-Reçete satış
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
                  <div className="w-11 h-11 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                    <Wallet size={20} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="v22-keep-white text-xs sm:text-sm font-extrabold leading-tight text-white flex items-center justify-between gap-1">
                      <span>Tahsilat Yap</span>
                      <ChevronRight size={15} className="shrink-0 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="v22-keep-white text-[11px] font-medium text-emerald-100/80 mt-0.5 truncate">
                      Nakit, POS, Çek &amp; Senet al
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQuickFarmerModalOpen(true)}
                  className="v22-keep-white group p-3.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/35 text-white text-left flex items-center gap-3 shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center shrink-0">
                    <Users size={20} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="v22-keep-white text-xs sm:text-sm font-extrabold leading-tight text-white flex items-center justify-between gap-1">
                      <span>Çiftçi (Müstahsil) Ekle</span>
                      <ChevronRight size={15} className="shrink-0 text-sky-300 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="v22-keep-white text-[11px] font-medium text-sky-100/80 mt-0.5 truncate">
                      Yeni cari hesap &amp; WhatsApp
                    </p>
                  </div>
                </button>
              </div>

              {/* Bottom Secondary Bar: Stok Girişi, BKTS/GTS, EDM e-Fatura, Görselli Kılavuz */}
              <div className="pt-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPurchaseModalOpen(true)}
                    className="v22-keep-white px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/18 text-white border border-white/15 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Truck size={14} />
                    <span>Stok Girişi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (window as any).mks_open_ministry?.('malkabul')}
                    className="v22-keep-white px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={14} className="text-emerald-300" />
                    <span>BKTS / GTS Mal Kabul</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (window as any).mks_open_edm?.('incoming')}
                    className="v22-keep-white px-3.5 py-2 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-400/30 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <Layers size={14} className="text-indigo-300" />
                    <span>EDM e-Fatura &amp; Depo</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('USER_GUIDE')}
                  className="v22-keep-white px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-400/30 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <BookOpen size={14} className="text-sky-300" />
                  <span>Görselli Kılavuz</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. MIDDLE 3-CARD BENTO ROW */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 v22-stagger-2">
            {/* Card 2A: Müstahsiller (Cari) Portrait Grid */}
            <div className="md:col-span-5 v22-bento-card p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold tracking-tight text-[#0b211d]">Müstahsiller</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#d5f2e5] text-[#116a4e]">
                    • {activeFarmersList.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('FARMERS')}
                  className="w-11 h-11 rounded-full bg-[#f3f6f4] hover:bg-[#d5f2e5] text-[#0b211d] flex items-center justify-center transition-colors"
                  title="Tüm Müstahsiller"
                  aria-label="Tüm Müstahsiller"
                >
                  <Plus size={16} />
                </button>
              </div>

              {displayFarmers.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate('FARMERS')}
                  className="w-full my-auto py-6 px-3 rounded-2xl border border-dashed border-emerald-500/25 text-center cursor-pointer hover:bg-emerald-500/5 transition-colors space-y-1.5"
                >
                  <Users size={22} className="mx-auto text-emerald-500" />
                  <p className="text-xs font-extrabold text-[#0b211d]">Henüz müstahsil kaydı yok</p>
                  <p className="text-[11px] text-[#5c726b]">İlk çiftçi ve tarla kaydınızı eklemek için dokunun</p>
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-x-2 gap-y-3 my-auto">
                  {displayFarmers.slice(0, 6).map((f, idx) => {
                    const nameParts = f.fullName.trim().split(' ');
                    const first = nameParts[0] || f.fullName;
                    const last = nameParts.slice(1).join(' ') || (f as any).village || 'Cari';
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => onNavigate('FARMERS')}
                        aria-label={f.fullName}
                        className="flex flex-col items-center text-center group cursor-pointer min-w-0"
                      >
                        <div
                          className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                            avatarGradients[idx % avatarGradients.length]
                          } text-white font-extrabold text-sm flex items-center justify-center shadow-md group-hover:scale-108 transition-transform relative border-2 border-[#eff4f1]`}
                        >
                          <span className="text-white">{first.charAt(0).toUpperCase()}</span>
                          {(f.balance || 0) < -0.01 && (
                            <span
                              className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#f39264] border-2 border-white"
                              title="Açık Cari Bakiye"
                            />
                          )}
                        </div>
                        <span className="text-[11px] font-extrabold text-[#0b211d] leading-tight mt-1.5 truncate w-full">
                          {first}
                        </span>
                        <span className="text-[11px] font-semibold text-[#5c726b] leading-tight truncate w-full">
                          {last}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card 2B: "Data 10,4h" -> Finans & Cari Portföy Dağılımı (Exact match to frame_06.jpg) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(isSales ? 'PRESCRIPTIONS' : 'DEBT_TRACKING')}
              onKeyDown={activateOnKey(() => onNavigate(isSales ? 'PRESCRIPTIONS' : 'DEBT_TRACKING'))}
              className="md:col-span-4 v22-bento-card p-4 sm:p-5 flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#5c726b]">Finans & Cari Veri</span>
                <ArrowUpRight size={16} className="text-[#0b211d]" />
              </div>

              <div className="my-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-[#0b211d] tracking-tight font-mono tabular-nums">
                  {isSales
                    ? `${prescriptions.length} Adet`
                    : formatCurrency(Math.round(stats.totalDebt || 0), currency)}
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-[#5c726b] mt-2">
                  <span>Kasa: {formatCurrency(Math.round(totalKasaBalance), currency)}</span>
                  <span>
                    Stok: {hideCosts ? '•••• ₺' : formatCurrency(Math.round(stats.inventoryValue || 0), currency)}
                  </span>
                </div>
              </div>

              {/* 3-Segment Horizontal Pill Progress Bar + Dots (Exact match to frame_06.jpg) */}
              <div>
                <div className="flex items-center gap-1.5 h-2.5 w-full">
                  <div
                    className="h-full rounded-full bg-[#116a4e] transition-all duration-700"
                    style={{ width: `${portfolioTotals.debtPct}%` }}
                  />
                  <div
                    className="h-full rounded-full bg-[#2cc98a] transition-all duration-700"
                    style={{ width: `${portfolioTotals.stockPct}%` }}
                  />
                  <div
                    className="h-full rounded-full bg-[#f39264] transition-all duration-700"
                    style={{ width: `${portfolioTotals.cashPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2.5 text-[11px] font-extrabold text-[#0b211d]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#116a4e]" />
                    %{portfolioTotals.debtPct} Cari
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2cc98a]" />
                    %{portfolioTotals.stockPct} Stok
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f39264]" />
                    %{portfolioTotals.cashPct} Kasa
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2C: "Impact | Engagement" Vertical Liquid Capsule Bars (Exact match to frame_06.jpg) */}
            <div className="md:col-span-3 v22-bento-card p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-black/5 pb-2">
                <button
                  onClick={() => setImpactTab('IMPACT')}
                  className={`text-[11px] font-extrabold transition-colors ${
                    impactTab === 'IMPACT' ? 'text-[#0b211d]' : 'text-[#5c726b]/60'
                  }`}
                >
                  Tahsilat
                </button>
                <button
                  onClick={() => setImpactTab('ENGAGEMENT')}
                  className={`text-[11px] font-extrabold transition-colors ${
                    impactTab === 'ENGAGEMENT' ? 'text-[#0b211d]' : 'text-[#5c726b]/60'
                  }`}
                >
                  Büyüme
                </button>
              </div>

              <div className="flex items-end justify-around gap-2.5 h-32 pt-4">
                {/* Capsule 1: Warm Coral-Peach */}
                <div className="w-8 h-full rounded-full bg-[#f3f6f4] flex flex-col justify-end p-0.5 overflow-hidden">
                  <div
                    className="w-full rounded-full v22-bar-anim"
                    style={{
                      height: impactTab === 'IMPACT' ? '52%' : '68%',
                      background: 'linear-gradient(180deg, #f7bda0 0%, #f39264 100%)'
                    }}
                  />
                </div>

                {/* Capsule 2: Tall Emerald Capsule with Floating "+58%" Dark Pill Badge */}
                <div className="flex flex-col items-center h-full justify-end">
                  <span className="v22-dark-pill mb-1 px-2 py-0.5 rounded-full bg-[#0b211d] text-white text-[11px] font-extrabold shadow">
                    {impactTab === 'IMPACT' ? '+58%' : '+84%'}
                  </span>
                  <div className="w-8 flex-1 rounded-full bg-[#f3f6f4] flex flex-col justify-end p-0.5 overflow-hidden">
                    <div
                      className="w-full rounded-full v22-bar-anim"
                      style={{
                        height: impactTab === 'IMPACT' ? '86%' : '92%',
                        background: 'var(--mks-accent-primary)'
                      }}
                    />
                  </div>
                </div>

                {/* Capsule 3: Soft Mint / Theme Accent */}
                <div className="w-8 h-full rounded-full bg-[#f3f6f4] flex flex-col justify-end p-0.5 overflow-hidden">
                  <div
                    className="w-full rounded-full v22-bar-anim opacity-75"
                    style={{
                      height: impactTab === 'IMPACT' ? '38%' : '56%',
                      background: 'var(--mks-accent-primary)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. BOTTOM 2-COLUMN BENTO ROW (Statistics 49|83 Barcode + Dark Capsule Reminder & Pro Card in frame_06.jpg) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 v22-stagger-3">
            {/* Card 3A: "Statistics 49 | 83" + 32-Tick Barcode + 2 Sub-Cards (Exact match to frame_06.jpg) */}
            <div className="md:col-span-6 v22-bento-card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#0b211d]">Operasyon İstatistiği</h3>
                <div className="flex items-center bg-[#f3f6f4] rounded-full p-0.5">
                  <button
                    onClick={() => setStatsPeriod('WEEKLY')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all ${
                      statsPeriod === 'WEEKLY'
                        ? 'v22-dark-pill bg-[#0b211d] text-white shadow-sm'
                        : 'text-[#5c726b]'
                    }`}
                  >
                    Haftalık
                  </button>
                  <button
                    onClick={() => setStatsPeriod('MONTHLY')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all ${
                      statsPeriod === 'MONTHLY'
                        ? 'v22-dark-pill bg-[#0b211d] text-white shadow-sm'
                        : 'text-[#5c726b]'
                    }`}
                  >
                    Aylık
                  </button>
                </div>
              </div>

              {/* Giant Split Odometer Counter: "49 | 83 tasks complete" */}
              <div className="my-3.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0b211d] font-mono tabular-nums tracking-tight">
                    {String(rollingPrimaryStat).padStart(2, '0')}
                  </span>
                  <span className="text-2xl font-light text-[#5c726b]/40">|</span>
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0b211d] font-mono tabular-nums tracking-tight">
                    {String(rollingSecondaryStat).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-semibold text-[#5c726b] ml-1">işlem & reçete kaydı</span>
                </div>

                {/* 32-Segment Vertical Tick Barcode Progress Bar (Exact match to frame_06.jpg) */}
                <div className="flex items-center gap-[3px] mt-3 h-3">
                  {Array.from({ length: 32 }).map((_, idx) => {
                    const filledCount = statsPeriod === 'WEEKLY' ? 20 : 26;
                    const isFilled = idx < filledCount;
                    return (
                      <span
                        key={idx}
                        className={`flex-1 h-full rounded-[2px] transition-colors duration-500 ${
                          isFilled ? 'bg-[#147a58]' : 'bg-[#e2e8e5]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* 2 Inner Square Cards ("23 Project complete" & "16 Project in progress" in frame_06.jpg) */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('FARMERS')}
                  className="bg-[#f3f6f4] hover:bg-[#e7f0ec] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                >
                  <Layers size={20} className="text-[#0b211d] mb-1.5" strokeWidth={1.8} />
                  <span className="text-lg font-extrabold text-[#0b211d] font-mono tabular-nums">
                    {rollingCompleted}
                  </span>
                  <span className="text-[11px] font-semibold text-[#5c726b]">Kayıtlı Müstahsil</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('INVENTORY')}
                  className="bg-[#f3f6f4] hover:bg-[#e7f0ec] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                >
                  <Copy size={20} className="text-[#147a58] mb-1.5" strokeWidth={1.8} />
                  <span className="text-lg font-extrabold text-[#0b211d] font-mono tabular-nums">
                    {rollingInProgress}
                  </span>
                  <span className="text-[11px] font-semibold text-[#5c726b]">Aktif Stok Kalemi</span>
                </button>
              </div>
            </div>

            {/* Card 3B: Center Stack -> Dark Forest Capsule Reminder + "Unleash Your Potential" MKS AI Card */}
            <div className="md:col-span-6 flex flex-col gap-4 justify-between">
              {/* Top: Dark Forest Outer Card Holding Inner White Pill ("Breakthrough Brainstorm 12:45 pm" in frame_06.jpg) */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Hatırlatıcılar"
                onClick={() => onNavigate('REMINDERS')}
                onKeyDown={activateOnKey(() => onNavigate('REMINDERS'))}
                className="v22-forest-card p-3 rounded-[24px] cursor-pointer group"
              >
                <div className="bg-white rounded-full px-4 py-2.5 flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#d5f2e5] text-[#116a4e] flex items-center justify-center shrink-0">
                      <CalendarCheck size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#0b211d] truncate">
                        {nextReminder ? nextReminder.title : 'Saha Ziyareti & Tahsilat Kontrolü'}
                      </p>
                      <p className="text-[11px] font-semibold text-[#5c726b]">
                        Bugün • {reminders.filter(r => !r.isCompleted).length} aktif görev
                      </p>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full border border-black/15 flex items-center justify-center text-[#0b211d] group-hover:bg-[#0b211d] group-hover:text-white transition-colors shrink-0">
                    <ChevronRight size={14} />
                  </div>
                </div>
              </div>

              {/* Bottom: "Unleash Your Potential / Pro" Card -> Zirai AI & MKS Mühendislik (Exact match to frame_06.jpg) */}
              <div className="v22-bento-card p-4 flex-1 grid grid-cols-12 gap-3.5 items-center">
                {/* Left Theme-Adaptive Gradient Sub-Card */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="MKS Pro - Zirai AI"
                  onClick={() => onNavigate('AI_ASSISTANT')}
                  onKeyDown={activateOnKey(() => onNavigate('AI_ASSISTANT'))}
                  className="v22-pro-subcard col-span-5 h-full rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer"
                >
                  <div className="v22-dark-pill w-7 h-7 rounded-xl bg-[#0b211d] text-white flex items-center justify-center">
                    <Zap size={14} className="fill-white" />
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-extrabold text-[#0b211d]">MKS Pro</div>
                    <ul className="mt-1.5 space-y-1 text-[11px] font-bold text-[#116a4e]">
                      <li>✓ Zirai AI Teşhis</li>
                      <li>✓ TKGM Parsel</li>
                      <li>✓ Silo & Dozaj</li>
                    </ul>
                  </div>
                </div>

                {/* Right Text + Mint Pill CTA */}
                <div className="col-span-7 flex flex-col justify-between h-full py-1">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0b211d] leading-snug">
                      Zirai Zeka & Saha Gücünü Keşfet
                    </h4>
                    <p className="text-[11px] font-medium text-[#5c726b] mt-1 leading-relaxed">
                      Yapay zeka destekli reçete, TKGM parsel sorgu ve akıllı stok tahmini.
                    </p>
                  </div>

                  {/* Quick Module Pills */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <button
                      onClick={() => onNavigate('AI_ASSISTANT')}
                      className="px-3 py-1.5 rounded-full bg-[#9be4c8] hover:bg-[#7ddbbd] text-[#0b211d] text-[11px] font-extrabold flex items-center gap-1 transition-all"
                    >
                      <Sparkles size={12} />
                      <span>Zirai AI</span>
                    </button>
                    <button
                      onClick={() => onNavigate('MAP')}
                      className="px-2.5 py-1.5 rounded-full bg-[#f3f6f4] hover:bg-[#e2ece7] text-[#0b211d] text-[11px] font-bold transition-all"
                    >
                      TKGM Harita
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT 4 COLUMNS (November 2026 Week Strip + 3 Visual Cards + Live Feed) ==================== */}
        <div className="lg:col-span-4 space-y-4 v22-stagger-4">
          {/* 1. HORIZONTAL 7-DAY CALENDAR STRIP ("November, 2026" in frame_06.jpg) */}
          <div className="v22-bento-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-base font-extrabold text-[#0b211d] tracking-tight">
                {new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Önceki - Hatırlatıcılar"
                  onClick={() => onNavigate('REMINDERS')}
                  className="w-11 h-11 rounded-full bg-[#f3f6f4] hover:bg-[#e2ece7] flex items-center justify-center text-[#0b211d]"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Sonraki - Hatırlatıcılar"
                  onClick={() => onNavigate('REMINDERS')}
                  className="w-11 h-11 rounded-full bg-[#f3f6f4] hover:bg-[#e2ece7] flex items-center justify-center text-[#0b211d]"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {dailyChartData.map((d, idx) => {
                const isToday = idx === dailyChartData.length - 1;
                return (
                  <button
                    type="button"
                    key={d.fullDate}
                    aria-label={`${d.date} ${d.dayNum}`}
                    onClick={() => onNavigate('REMINDERS')}
                    className={`py-2 px-1 rounded-2xl flex flex-col items-center cursor-pointer transition-all ${
                      isToday
                        ? 'v22-dark-pill bg-[#0b211d] text-white shadow-md scale-105'
                        : 'hover:bg-[#f3f6f4] text-[#0b211d]'
                    }`}
                  >
                    <span className={`text-[11px] font-bold ${isToday ? 'text-white/75' : 'text-[#5c726b]'}`}>
                      {d.date}
                    </span>
                    <span className="text-xs font-extrabold mt-1 font-mono">{d.dayNum}</span>
                    <div className="flex items-center gap-0.5 mt-1">
                      <span
                        className={`w-1 h-1 rounded-full ${
                          isToday ? 'bg-[#34d399]' : d.amount > 0 ? 'bg-[#147a58]' : 'bg-black/15'
                        }`}
                      />
                      {d.amount > 0 && (
                        <span className={`w-1 h-1 rounded-full ${isToday ? 'bg-[#f39264]' : 'bg-[#f39264]'}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. "Last videos" -> 3 VISUAL PRESCRIPTION / STOCK MINI-CARDS (Exact match to frame_06.jpg) */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2.5">
              <h3 className="text-sm font-extrabold text-[#0b211d]">Son Reçeteler & Satışlar</h3>
              <button
                type="button"
                aria-label="Yeni reçete"
                title="Yeni reçete"
                onClick={() => onNavigate(canCreatePrescription ? 'PRESCRIPTION_NEW' : 'PRESCRIPTIONS')}
                className="v22-surface-pill w-11 h-11 rounded-full flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>

            {recentPrescriptions.length === 0 ? (
              <button
                type="button"
                onClick={() => onNavigate(canCreatePrescription ? 'PRESCRIPTION_NEW' : 'PRESCRIPTIONS')}
                className="w-full v22-bento-card p-5 text-center cursor-pointer hover:border-emerald-500/40 transition-colors space-y-1.5"
              >
                <FileText size={20} className="mx-auto text-emerald-500" />
                <p className="text-xs font-extrabold text-[#0b211d]">Henüz reçete veya satış kaydı yok</p>
                <p className="text-[11px] text-[#5c726b]">Yeni reçete veya satış oluşturmak için tıklayın</p>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {recentPrescriptions.slice(0, 3).map((p: any, idx: number) => {
                  const fName = farmerNameMap[p.farmerId] || 'Peşin Müşteri';
                  const amt = Math.abs(Number(p.totalAmount) || 0);
                  const orbColors = [
                    'radial-gradient(circle at 35% 30%, #6ee7b7, #0f766e 70%, #064e3b)',
                    'radial-gradient(circle at 35% 30%, #93c5fd, #1d4ed8 70%, #1e3a8a)',
                    'radial-gradient(circle at 35% 30%, #fdba74, #c2410c 70%, #7c2d12)'
                  ];
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${fName} - ${formatCurrency(Math.round(amt), currency)}`}
                      onClick={() => onNavigate('PRESCRIPTIONS')}
                      onKeyDown={activateOnKey(() => onNavigate('PRESCRIPTIONS'))}
                      className="v22-bento-card p-2.5 flex flex-col justify-between cursor-pointer group"
                    >
                      <div className="h-16 rounded-xl bg-[#f3f6f4] relative flex items-center justify-center overflow-hidden">
                        <div
                          className="w-10 h-10 rounded-full shadow-md group-hover:scale-110 transition-transform"
                          style={{ background: orbColors[idx % 3] }}
                        />
                        <span className="v22-dark-pill absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-[#0b211d] text-white text-[11px] font-extrabold font-mono">
                          {formatCurrency(Math.round(amt), currency)}
                        </span>
                      </div>

                      <div className="mt-2">
                        <p className="text-[11px] font-extrabold text-[#0b211d] leading-tight line-clamp-2">
                          {fName}
                        </p>
                        <p className="text-[11px] font-semibold text-[#5c726b] truncate mt-0.5">
                          {p.crop || 'Zirai Reçete'}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-black/5 text-[11px] font-bold text-[#5c726b]">
                        <span>{p.priceType === 'CASH' ? 'Peşin' : 'Vadeli'}</span>
                        <span className="flex items-center gap-0.5">
                          <Eye size={10} /> Detay
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. "Notifications / Focus this week" FEED CARD (Exact match to frame_06.jpg & frame_08.jpg) */}
          <div className="v22-bento-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-extrabold text-[#0b211d]">Canlı Akış & Analiz</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onNavigate('RECENT_TRANSACTIONS')}
                  className="w-11 h-11 rounded-full bg-[#0b211d] text-white flex items-center justify-center"
                  title="Tüm İşlemler"
                  aria-label="Tüm İşlemler"
                >
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Overview | 7 Gün Ciro (frame_08 Focus) | Hava Durumu */}
            <div className="flex items-center gap-4 border-b border-black/5 pb-2 mb-3 text-xs font-extrabold">
              <button
                onClick={() => setFeedTab('OVERVIEW')}
                className={`pb-1 transition-all ${
                  feedTab === 'OVERVIEW'
                    ? 'text-[#0b211d] border-b-2 border-[#0b211d]'
                    : 'text-[#5c726b]'
                }`}
              >
                Son İşlemler
              </button>
              <button
                onClick={() => setFeedTab('FOCUS')}
                className={`pb-1 transition-all ${
                  feedTab === 'FOCUS'
                    ? 'text-[#0b211d] border-b-2 border-[#0b211d]'
                    : 'text-[#5c726b]'
                }`}
              >
                7 Günlük Ciro
              </button>
              <button
                onClick={() => setFeedTab('WEATHER')}
                className={`pb-1 transition-all ${
                  feedTab === 'WEATHER'
                    ? 'text-[#0b211d] border-b-2 border-[#0b211d]'
                    : 'text-[#5c726b]'
                }`}
              >
                Saha Hava
              </button>
            </div>

            {feedTab === 'OVERVIEW' && (
              <div className="space-y-2.5">
                {[
                  {
                    title: `${farmers.length} Aktif Müstahsil Cari Hesabı`,
                    sub: `Toplam Alacak: ${formatCurrency(Math.round(stats.totalDebt || 0), currency)}`,
                    time: 'Canlı Mutabakat',
                    action: 'FARMERS',
                    btn: 'Cari Aç'
                  },
                  {
                    title: `${activeInventoryList.length} Kalem Zirai İlaç & Gübre Stoğu`,
                    sub: `Depo Değeri: ${hideCosts ? '•••• ₺' : formatCurrency(Math.round(stats.inventoryValue || 0), currency)}`,
                    time: 'Stok Dengesi',
                    action: 'INVENTORY',
                    btn: 'Depo'
                  },
                  {
                    title: `${suppliers.length} Tedarikçi & Firma Hesabı`,
                    sub: `Borç Bakiyesi: ${formatCurrency(Math.round(totalSupplierDebt || 0), currency)}`,
                    time: 'Tedarik Merkezi',
                    action: 'SUPPLIERS',
                    btn: 'Detay'
                  }
                ].map((row, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => onNavigate(row.action)}
                    className="w-full text-left p-2.5 rounded-2xl bg-[#f3f6f4] hover:bg-[#e6efeb] flex items-center justify-between gap-2.5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${
                          avatarGradients[idx % avatarGradients.length]
                        } text-white font-extrabold text-xs flex items-center justify-center shrink-0`}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#0b211d] truncate">{row.title}</p>
                        <p className="text-[11px] font-semibold text-[#5c726b] truncate">{row.sub}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="v22-dark-pill px-2.5 py-1 rounded-full bg-[#0b211d] text-white text-[11px] font-extrabold">
                        {row.btn}
                      </span>
                      <span className="text-[11px] font-semibold text-[#5c726b] mt-1">{row.time}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Frame_08.jpg "Focus this week" 7-Capsule Vertical Chart */}
            {feedTab === 'FOCUS' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#5c726b]">Haftalık Toplam Hacim</span>
                  <span className="text-sm font-extrabold text-[#0b211d] font-mono">
                    {formatCurrency(Math.round(sevenDayTotalSales), currency)}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-2 h-36 pt-3 items-end">
                  {dailyChartData.map((d, i) => {
                    const maxAmt = Math.max(...dailyChartData.map(x => x.amount), 1);
                    const pct = d.amount > 0 ? Math.max(22, Math.round((d.amount / maxAmt) * 100)) : 28 + ((i * 13) % 45);
                    const isPeak = i === 2 || i === dailyChartData.length - 1;
                    return (
                      <div key={d.fullDate} className="flex flex-col items-center h-full justify-end">
                        <div className="w-6 flex-1 rounded-full bg-[#f3f6f4] flex flex-col justify-end p-0.5 overflow-hidden">
                          <div
                            className="w-full rounded-full v22-bar-anim"
                            style={{
                              height: `${pct}%`,
                              background: isPeak ? 'var(--mks-accent-primary)' : '#f39264'
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[#5c726b] mt-1.5">{d.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {feedTab === 'WEATHER' && (
              <div className="pt-1">
                <WeatherWidget />
              </div>
            )}
          </div>
        </div>
      </div>
      )}

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
                  disabled={!selectedSupplierId || purchaseItems.length === 0}
                  className="v22-dark-pill w-full bg-[#0b211d] text-white py-3.5 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {t('dashboard.save_purchase')}
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
                  <h3 className="text-base font-extrabold text-[#0b211d]">Hızlı Çiftçi (Müstahsil) Ekle</h3>
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
                  Tüm Müstahsiller Ekranı
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

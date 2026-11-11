import React, { useState, useMemo } from 'react';
import {
  Plus, LayoutGrid, Bell, Search, ArrowUpRight, Check,
  DollarSign, Briefcase, PhoneCall, Calendar,
  Users, Layers, Activity, Ticket, Package, Zap, Headphones, Watch,
  Speaker, MousePointer, Lightbulb, Terminal, Music, ShieldCheck,
  FileText, QrCode, BookOpen, Sparkles, TrendingUp, Filter, Download
} from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { ViewState } from '../types';

interface GlassyV30StudioProps {
  onNavigate: (view: ViewState | string) => void;
  onOpenQuickPurchase?: () => void;
}

type V30SubTab = 'OVERVIEW' | 'PRODUCTS' | 'PIPELINE' | 'CUSTOMERS' | 'REPORTS';

export const GlassyV30Studio: React.FC<GlassyV30StudioProps> = ({
  onNavigate,
  onOpenQuickPurchase
}) => {
  const {
    stats,
    farmers,
    inventory,
    prescriptions,
    accounts,
    userProfile
  } = useAppViewModel();

  const [activeSubTab, setActiveSubTab] = useState<V30SubTab>('OVERVIEW');
  const [revenueRange, setRevenueRange] = useState<'TODAY' | 'WEEK' | 'MONTH'>('TODAY');
  const [salesRange, setSalesRange] = useState<'WEEK' | 'MONTH' | 'YEAR'>('WEEK');
  const [targetEnabled, setTargetEnabled] = useState(true);
  const [targetPercent, setTargetPercent] = useState(64);
  const [activeMetricPill, setActiveMetricPill] = useState<'REVENUE' | 'DEALS' | 'CALLS' | 'MEETINGS'>('REVENUE');
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({
    customers: false,
    pipeline: false,
    liveUsers: true,
    tickets: false,
    prod_0: true,
    prod_1: true,
    prod_2: true,
    prod_3: true,
    prod_4: false,
    prod_5: true,
    prod_6: true,
    prod_7: true,
    prod_8: true,
    prod_9: true
  });
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const currency = userProfile?.currency || 'TRY';

  const flipToggle = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setToggleStates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Klavye erişilebilirliği: role="button" kartlar için Enter/Space ile tetikleme (UI-54)
  const activateOnKey = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  // Real + fallback Products for the 5x2 3D Glossy Squircle Grid (Exact match to f_28.jpg)
  const v30Products = useMemo(() => {
    const iconConfigs = [
      {
        gradient: 'linear-gradient(145deg, #ec4899 0%, #be185d 100%)',
        glow: 'rgba(236, 72, 153, 0.45)',
        barColor: '#34d399',
        Icon: Music
      },
      {
        gradient: 'linear-gradient(145deg, #a3e635 0%, #4d7c0f 100%)',
        glow: 'rgba(163, 230, 53, 0.42)',
        barColor: '#34d399',
        Icon: Zap
      },
      {
        gradient: 'linear-gradient(145deg, #34d399 0%, #047857 100%)',
        glow: 'rgba(52, 211, 153, 0.45)',
        barColor: '#34d399',
        Icon: Layers
      },
      {
        gradient: 'linear-gradient(145deg, #60a5fa 0%, #1d4ed8 100%)',
        glow: 'rgba(59, 130, 246, 0.48)',
        barColor: '#34d399',
        Icon: Headphones
      },
      {
        gradient: 'linear-gradient(145deg, #f87171 0%, #b91c1c 100%)',
        glow: 'rgba(248, 113, 113, 0.42)',
        barColor: '#34d399',
        Icon: Activity
      },
      {
        gradient: 'linear-gradient(145deg, #38bdf8 0%, #0369a1 100%)',
        glow: 'rgba(56, 189, 248, 0.45)',
        barColor: '#ef4444',
        Icon: Speaker
      },
      {
        gradient: 'linear-gradient(145deg, #c084fc 0%, #6b21a8 100%)',
        glow: 'rgba(192, 132, 252, 0.45)',
        barColor: '#f59e0b',
        Icon: Watch
      },
      {
        gradient: 'linear-gradient(145deg, #fbbf24 0%, #b45309 100%)',
        glow: 'rgba(251, 191, 36, 0.42)',
        barColor: '#f59e0b',
        Icon: MousePointer
      },
      {
        gradient: 'linear-gradient(145deg, #facc15 0%, #854d0e 100%)',
        glow: 'rgba(250, 204, 21, 0.40)',
        barColor: '#34d399',
        Icon: Lightbulb
      },
      {
        gradient: 'linear-gradient(145deg, #2dd4bf 0%, #0f766e 100%)',
        glow: 'rgba(45, 212, 191, 0.45)',
        barColor: '#34d399',
        Icon: Terminal
      }
    ];

    const liveItems = (inventory || []).filter(i => !i.deletedAt);
    return liveItems.slice(0, 20).map((item, idx) => {
      const cfg = iconConfigs[idx % iconConfigs.length];
      const qty = Number(item.quantity) || 0;
      const statusType = qty <= 0 ? 'OUT' : qty <= (item.lowStockThreshold || 10) ? 'LOW' : 'OK';
      return {
        id: item.id,
        name: item.pesticideName,
        category: item.category || 'Zirai Ürün',
        price: Number(item.sellingPrice) || 0,
        qty,
        statusLabel: statusType === 'OUT' ? 'Stok Tükendi' : statusType === 'LOW' ? `Kritik: ${qty} ad.` : `${qty} stokta`,
        statusType,
        soldCount: 0,
        stockPct: statusType === 'OUT' ? 5 : statusType === 'LOW' ? 25 : Math.min(100, Math.max(30, qty)),
        ...cfg
      };
    });
  }, [inventory]);

  const filteredV30Products = useMemo(() => {
    return v30Products.filter(p => {
      if (productCategoryFilter !== 'ALL' && p.category !== productCategoryFilter) return false;
      if (productSearch && !p.name.toLocaleLowerCase('tr-TR').includes(productSearch.toLocaleLowerCase('tr-TR'))) return false;
      return true;
    });
  }, [v30Products, productCategoryFilter, productSearch]);

  // 7-Day Real Bar Chart Data computed from real prescriptions
  const weeklyBars = useMemo(() => {
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const buckets: { iso: string; day: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      buckets.push({ iso, day: dayNames[d.getDay()], total: 0 });
    }
    (prescriptions || []).forEach(p => {
      if (p.deletedAt) return;
      const dStr = (p.date || '').split('T')[0];
      const hit = buckets.find(b => b.iso === dStr);
      if (hit) hit.total += Math.max(0, Number(p.totalAmount) || 0);
    });
    const maxVal = Math.max(...buckets.map(b => b.total), 1);
    return buckets.map((b, idx) => ({
      day: b.day,
      val: Math.round((b.total / 1000) * 10) / 10,
      pct: b.total > 0 ? Math.max(12, Math.round((b.total / maxVal) * 90)) : 6,
      active: idx === buckets.length - 1
    }));
  }, [prescriptions]);

  // Customers List for V30 Customers Table — 100% genuine farmers ONLY
  // Son işlem tarihi: müstahsilin en son reçete/satış kaydından (UI-12: sahte 'Aktif Cari' yerine)
  const lastTxDateByFarmer = useMemo(() => {
    const map: Record<string, string> = {};
    (prescriptions || []).forEach(p => {
      if (p.deletedAt || !p.farmerId || !p.date) return;
      if (!map[p.farmerId] || p.date > map[p.farmerId]) map[p.farmerId] = p.date;
    });
    return map;
  }, [prescriptions]);

  const v30Customers = useMemo(() => {
    const activeFarmers = (farmers || []).filter(f => !f.deletedAt);
    return activeFarmers.map((f, idx) => {
      const lastIso = lastTxDateByFarmer[f.id];
      const lastDate = lastIso ? new Date(lastIso) : null;
      return {
        id: f.id,
        name: f.fullName,
        email: f.phoneNumber || '—',
        company: f.village ? `${f.village}` : 'Kayıtlı İşletme',
        status: (f.balance || 0) < -0.01 ? 'Açık Bakiye' : 'Dengeli',
        owner: userProfile?.fullName || 'Bayi Hesabı',
        ltv: Math.abs(f.balance || 0),
        lastContact: lastDate && !isNaN(lastDate.getTime()) ? lastDate.toLocaleDateString('tr-TR') : '—',
        avatarColor: ['#ec4899', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4'][idx % 6]
      };
    });
  }, [farmers, userProfile?.fullName, lastTxDateByFarmer]);

  // 60 radial ticks for the Quarterly Target Gauge (Exact match to frame_03.jpg / f_05.jpg)
  const radialTicks = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  // SVG Circle Math for 64% Target Gauge
  const gaugeRadius = 74;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (targetPercent / 100) * gaugeCircumference;
  const knobAngleRad = ((targetPercent / 100) * 360 - 90) * (Math.PI / 180);
  const knobX = 96 + gaugeRadius * Math.cos(knobAngleRad);
  const knobY = 96 + gaugeRadius * Math.sin(knobAngleRad);

  // Reusable iOS Sky-Blue Toggle Switch (Exact match to CodeXR V30)
  // UI-44: role="switch" + aria-checked, 44px dokunma alanı (görsel boyut aynı kalır)
  const renderV30Toggle = (isOn: boolean, onClick: (e: React.MouseEvent) => void, label?: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={label}
      onClick={onClick}
      className="min-w-[44px] min-h-[44px] -my-2.5 flex items-center justify-center shrink-0"
    >
      <span
        className={`w-10 h-5 rounded-full p-0.5 transition-all duration-300 flex items-center shrink-0 ${
          isOn
            ? 'bg-gradient-to-r from-[#38bdf8] to-[#0284c7] shadow-[0_0_14px_rgba(56,189,248,0.55)] justify-end'
            : 'bg-white/15 border border-white/15 justify-start'
        }`}
      >
        <span className="w-4 h-4 rounded-full bg-white shadow-md transition-transform" />
      </span>
    </button>
  );

  return (
    <div className="v30-studio-wrapper space-y-4 text-white">
      {/* ==================== V30 TOP SUB-NAVIGATION HEADER BAR (Exact Match to Reel Dfj_FGsTAVB) ==================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-0.5 pb-2 border-b border-white/10">
        {/* Left: Horizontal Underline Tabs (Overview | Sales/Pipeline | Products | Customers | Reports) */}
        <div className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar">
          {[
            { id: 'OVERVIEW' as V30SubTab, label: 'Genel Bakış', trSub: 'Komuta Paneli' },
            { id: 'PRODUCTS' as V30SubTab, label: 'Ürünler', trSub: '3D Stok & İlaçlar' },
            { id: 'PIPELINE' as V30SubTab, label: 'Vadeli Satışlar', trSub: 'Vadeli & Kampanya' },
            { id: 'CUSTOMERS' as V30SubTab, label: 'Müşteriler', trSub: 'Müstahsil Cari' },
            { id: 'REPORTS' as V30SubTab, label: 'Raporlar', trSub: 'Finansal Analiz' }
          ].map(tab => {
            const active = activeSubTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                aria-pressed={active}
                className={`relative pb-2.5 min-h-[44px] text-left transition-all group shrink-0 select-none ${
                  active ? 'text-white font-extrabold' : 'text-white/70 hover:text-white/85 font-semibold'
                }`}
              >
                <div className="text-sm sm:text-[15px] tracking-tight flex items-center gap-1.5">
                  <span>{tab.label}</span>
                  <span className="text-[11px] font-normal text-white/70 hidden sm:inline">({tab.trSub})</span>
                </div>
                {active && (
                  <span className="absolute bottom-0 left-0 w-7 h-[2.5px] rounded-full bg-white shadow-[0_0_10px_#ffffff]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: 4 Circular Glass Action Buttons (+ | Grid | Bell[3] | Avatar) + MKS Quick Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('PRESCRIPTION_NEW')}
            title="Yeni Satış / Reçete Oluştur (+)"
            aria-label="Yeni Satış / Reçete Oluştur"
            className="w-11 h-11 rounded-full border border-dashed border-white/35 bg-white/5 hover:bg-white/15 flex items-center justify-center text-white transition-all active:scale-95"
          >
            <Plus size={16} />
          </button>

          <span className="h-5 w-[1px] bg-white/15 mx-0.5" />

          <button
            type="button"
            onClick={() => (window as any).mks_open_edm?.('incoming')}
            title="EDM e-Fatura Deposu & Sistem Deposu"
            aria-label="EDM e-Fatura Deposu"
            className="px-3 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/18 text-[11px] font-bold text-white flex items-center gap-1.5 transition-all"
          >
            <Layers size={13} className="text-[#38bdf8]" />
            <span className="hidden sm:inline">e-Fatura & Depo</span>
          </button>

          <button
            type="button"
            onClick={() => (window as any).mks_open_ministry?.('malkabul')}
            title="Tarım Bakanlığı BKTS / GTS Karekod"
            aria-label="Tarım Bakanlığı BKTS / GTS Karekod"
            className="px-3 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/18 text-[11px] font-bold text-white flex items-center gap-1.5 transition-all"
          >
            <QrCode size={13} className="text-emerald-400" />
            <span className="hidden sm:inline">BKTS / GTS</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('USER_GUIDE')}
            title="Görselli Kullanım Kılavuzu"
            aria-label="Görselli Kullanım Kılavuzu"
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/18 flex items-center justify-center text-white transition-all"
          >
            <BookOpen size={15} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('NOTIFICATIONS')}
            title="Bildirimler"
            aria-label="Bildirimler"
            className="relative w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/18 flex items-center justify-center text-white transition-all"
          >
            <Bell size={15} />
            {(stats.activeReminders || 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-[#38bdf8] text-[#041326] text-[11px] font-black flex items-center justify-center shadow-[0_0_8px_#38bdf8]">
                {stats.activeReminders}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('PROFILE')}
            title={userProfile?.fullName || 'Kurumsal Profil'}
            aria-label={userProfile?.fullName || 'Kurumsal Profil'}
            className="relative w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 via-sky-400 to-emerald-400 p-[1.5px] cursor-pointer hover:scale-105 transition-transform"
          >
            <div className="w-full h-full rounded-full bg-[#1e222b] flex items-center justify-center font-black text-xs text-white">
              {(userProfile?.fullName || 'NF').charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#252830]" />
          </button>
        </div>
      </div>

      {/* =============================================================================================== */}
      {/* SCREEN 1: OVERVIEW BENTO GRID (1:1 Match to Reel Dfj_FGsTAVB frame_03.jpg & f_05.jpg)          */}
      {/* =============================================================================================== */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch animate-in fade-in duration-300">
          {/* ==================== COLUMN 1 (3 COLS): TEAM ONLINE + 60-TICK QUARTERLY TARGET GAUGE ==================== */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Top Left Card: "Team • 4 online now" */}
            <div className="v30-glass-card p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Ekip & Müstahsil</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <span className="text-[11px] text-white/60 font-medium">
                      {v30Customers.length} aktif cari bağlı
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('FARMERS')}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all"
                  title="Müstahsil Ekle / Gör"
                  aria-label="Müstahsil Ekle / Gör"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Overlapping Circular Pastel Avatars (Real Farmers Only) */}
              <div className="flex items-center -space-x-2.5 mt-4 pt-1">
                {v30Customers.slice(0, 4).map((av, idx) => (
                  <button
                    type="button"
                    key={av.id}
                    onClick={() => onNavigate('FARMERS')}
                    title={av.name}
                    aria-label={av.name}
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-200 to-teal-400 border-2 border-[#343740] text-[#181a20] font-extrabold text-xs flex items-center justify-center cursor-pointer hover:scale-110 hover:z-20 transition-all shadow-md"
                  >
                    {av.name.charAt(0).toUpperCase()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onNavigate('FARMERS')}
                  aria-label={`${v30Customers.length} müstahsil`}
                  className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border-2 border-white/25 text-white text-xs font-extrabold flex items-center justify-center z-10 transition-all"
                >
                  {v30Customers.length}
                </button>
              </div>
            </div>

            {/* Bottom Left Card: "Quarterly Target • Q4 2026 · Whole company" with 60-Tick Radial Gauge */}
            <div className="v30-glass-card p-5 flex-1 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Sezon Hedefi</h3>
                  <p className="text-[11px] text-white/55 font-medium mt-0.5">
                    2026 Sezonu • Tüm Bayi & Saha
                  </p>
                </div>
                {renderV30Toggle(targetEnabled, () => setTargetEnabled(!targetEnabled), 'Sezon hedefini göster')}
              </div>

              {/* 60-Tick Radial Circular Gauge Ring (Exact match to frame_03.jpg) */}
              <div className="relative w-48 h-48 mx-auto my-3 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 192 192">
                  <defs>
                    <linearGradient id="v30SkyArc" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="50%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                    <filter id="v30ArcGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3.5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Outer dark frosted groove */}
                  <circle
                    cx="96"
                    cy="96"
                    r={gaugeRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="6"
                  />

                  {/* 60 Inner Radial Tick Marks */}
                  {radialTicks.map(i => {
                    const angle = (i * 6 - 90) * (Math.PI / 180);
                    const isMajor = i % 5 === 0;
                    const rInner = isMajor ? 54 : 57;
                    const rOuter = 63;
                    const x1 = 96 + rInner * Math.cos(angle);
                    const y1 = 96 + rInner * Math.sin(angle);
                    const x2 = 96 + rOuter * Math.cos(angle);
                    const y2 = 96 + rOuter * Math.sin(angle);
                    const isPassed = (i / 60) * 100 <= targetPercent;
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isPassed ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.22)'}
                        strokeWidth={isMajor ? '1.8' : '1.1'}
                        strokeLinecap="round"
                      />
                    );
                  })}

                  {/* Glowing Sky-Blue Progress Arc */}
                  {targetEnabled && (
                    <>
                      <circle
                        cx="96"
                        cy="96"
                        r={gaugeRadius}
                        fill="none"
                        stroke="url(#v30SkyArc)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={gaugeCircumference}
                        strokeDashoffset={gaugeOffset}
                        transform="rotate(-90 96 96)"
                        filter="url(#v30ArcGlow)"
                        className="transition-all duration-500"
                      />
                      {/* Glowing white/sky knob at end of arc */}
                      <circle
                        cx={knobX}
                        cy={knobY}
                        r="6.5"
                        fill="#ffffff"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        filter="url(#v30ArcGlow)"
                        className="transition-all duration-500"
                      />
                    </>
                  )}
                </svg>

                {/* Center Percentage & Forecast Readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <div className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                    {targetPercent}
                    <span className="text-lg font-bold text-white/80 ml-0.5">%</span>
                  </div>
                  <span className="text-[11px] font-semibold text-white/70 mt-0.5">Gerçekleşen</span>
                  <span className="text-[11px] font-bold text-[#7dd3fc] mt-1 flex items-center gap-0.5">
                    <span>↗</span> 82% sezon tahmini
                  </span>
                </div>
              </div>

              {/* –  $412k of $640k  + Stepper Row */}
              <div className="flex items-center justify-center gap-3 my-1">
                <button
                  type="button"
                  aria-label="Hedefi azalt"
                  onClick={() => setTargetPercent(p => Math.max(10, p - 5))}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 font-bold text-sm"
                >
                  –
                </button>
                <span className="text-xs font-bold text-white/85 tabular-nums">
                  {formatCurrency(stats.totalSales || 0, currency)}
                </span>
                <button
                  type="button"
                  aria-label="Hedefi artır"
                  onClick={() => setTargetPercent(p => Math.min(100, p + 5))}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 font-bold text-sm"
                >
                  +
                </button>
              </div>

              {/* Bottom 4 Metric Circles (Revenue | Deals | Calls | Meetings) */}
              <div className="mt-3 pt-3 border-t border-white/10">
                <span className="text-[11px] font-semibold text-white/70 block mb-2">Metrik</span>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {[
                    { id: 'REVENUE' as const, label: 'Ciro', Icon: DollarSign },
                    { id: 'DEALS' as const, label: 'Reçete', Icon: Briefcase },
                    { id: 'CALLS' as const, label: 'Görüşme', Icon: PhoneCall },
                    { id: 'MEETINGS' as const, label: 'Ziyaret', Icon: Calendar }
                  ].map(m => {
                    const act = activeMetricPill === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        aria-pressed={act}
                        onClick={() => setActiveMetricPill(m.id)}
                        className="flex flex-col items-center gap-1 group min-h-[44px]"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            act
                              ? 'bg-white text-[#181a20] shadow-[0_0_16px_rgba(255,255,255,0.45)] font-bold'
                              : 'bg-white/10 text-white/70 group-hover:bg-white/20 border border-white/10'
                          }`}
                        >
                          <m.Icon size={14} />
                        </div>
                        <span className={`text-[11px] font-semibold ${act ? 'text-white' : 'text-white/70'}`}>
                          {m.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ==================== COLUMN 2 (5 COLS): REVENUE SPLINE + LEADS/APPROVALS + 7-DAY BAR CHART ==================== */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Top Center Card: "Revenue $23.3k / $28k" with Glowing White Spline Curve */}
            <div className="v30-glass-card p-5 relative overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-white/70">Toplam Ciro</span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
                      {formatCurrency(stats.totalSales || 0, currency)}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 mt-1">
                    <ArrowUpRight size={13} />
                    <span>Canlı satış ve reçete toplamı</span>
                  </div>
                </div>

                {/* Segmented Glass Switcher: Today | Week | Month */}
                <div className="flex items-center bg-black/25 border border-white/12 rounded-full p-0.5">
                  {[
                    { id: 'TODAY' as const, label: 'Bugün' },
                    { id: 'WEEK' as const, label: 'Hafta' },
                    { id: 'MONTH' as const, label: 'Ay' }
                  ].map(r => (
                    <button
                      type="button"
                      key={r.id}
                      aria-pressed={revenueRange === r.id}
                      onClick={() => setRevenueRange(r.id)}
                      className={`px-3 py-1 min-h-[36px] rounded-full text-[11px] font-bold transition-all ${
                        revenueRange === r.id
                          ? 'bg-white/20 text-white shadow-sm border border-white/20'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smooth Glowing White Area Spline Chart (Exact match to frame_03.jpg) */}
              <div className="mt-3 h-24 w-full relative">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 400 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="v30WhiteArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,68 C70,65 130,52 210,36 C280,22 340,18 400,26 L400,88 L0,88 Z"
                    fill="url(#v30WhiteArea)"
                  />
                  <path
                    d="M0,68 C70,65 130,52 210,36 C280,22 340,18 400,26"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* 5 Real Summary Mini Indicators at bottom of Revenue card */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-left">
                <div>
                  <div className="text-[11px] font-extrabold text-white/90 tabular-nums">
                    {formatCurrency(stats.totalDebt || 0, currency)}
                  </div>
                  <div className="text-[11px] font-medium text-white/70">Toplam Alacak</div>
                </div>
                <div>
                  <div className="text-[11px] font-extrabold text-white/90 tabular-nums">
                    {formatCurrency(stats.inventoryValue || 0, currency)}
                  </div>
                  <div className="text-[11px] font-medium text-white/70">Depo Stoğu</div>
                </div>
                <div>
                  <div className="text-[11px] font-extrabold text-white/90 tabular-nums">
                    {formatCurrency((accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0), currency)}
                  </div>
                  <div className="text-[11px] font-medium text-white/70">Kasa & Banka</div>
                </div>
              </div>
            </div>

            {/* Middle Center Split Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onNavigate('PRESCRIPTIONS')}
                onKeyDown={activateOnKey(() => onNavigate('PRESCRIPTIONS'))}
                className="v30-glass-card p-4 flex flex-col justify-between cursor-pointer hover:border-white/30 transition-all"
              >
                <div>
                  <span className="text-[11px] font-semibold text-white/70">Toplam Kayıt</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Reçete & Satışlar</h4>
                </div>

                <div className="flex items-end justify-between gap-2 mt-6">
                  <div>
                    <span className="text-2xl font-extrabold text-white tabular-nums">
                      {(prescriptions || []).filter(p => !p.deletedAt).length}
                    </span>
                  </div>
                </div>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => (window as any).mks_open_edm?.('incoming')}
                onKeyDown={activateOnKey(() => (window as any).mks_open_edm?.('incoming'))}
                className="v30-glass-card p-4 flex flex-col justify-between cursor-pointer hover:border-white/30 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-white/70">Resmi Depo & Fatura</span>
                    <h4 className="text-sm font-bold text-white mt-0.5">EDM e-Fatura Merkezi</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-[#38bdf8]/20 border border-[#38bdf8]/40 text-[#7dd3fc] text-[11px] font-black uppercase">
                    EDM
                  </span>
                </div>

                <div className="my-2">
                  <div className="text-sm font-extrabold text-white">Çoklu Depo Ayrımı</div>
                  <div className="text-[11px] text-white/70 truncate">
                    e-Fatura Deposu • BKTS / GTS • Sistem Deposu
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/25 border border-white/10 rounded-full px-2.5 py-1">
                  <span className="text-[11px] font-semibold text-white/75">Merkezi Aç</span>
                  <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center text-emerald-300">
                    <Check size={11} />
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Center Card: "Sales (k$)" 7-Day Column Chart with Wed Sky-Blue Highlight & Tooltip 28,5 */}
            <div className="v30-glass-card p-5 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-white">Haftalık Satış Dağılımı (Bin ₺)</h3>
                <div className="flex items-center bg-black/25 border border-white/12 rounded-full p-0.5">
                  {(['WEEK', 'MONTH', 'YEAR'] as const).map(p => (
                    <button
                      type="button"
                      key={p}
                      aria-pressed={salesRange === p}
                      onClick={() => setSalesRange(p)}
                      className={`px-2.5 py-0.5 min-h-[36px] rounded-full text-[11px] font-bold transition-all ${
                        salesRange === p
                          ? 'bg-white/20 text-white border border-white/20'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {p === 'WEEK' ? 'Hafta' : p === 'MONTH' ? 'Ay' : 'Yıl'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-3 h-36 pt-4">
                {/* Y-axis labels */}
                <div className="flex flex-col justify-between h-full text-[11px] font-mono text-white/70 pr-1 pb-4">
                  <span>40,0</span>
                  <span>32,0</span>
                  <span>24,0</span>
                  <span>16,0</span>
                  <span>8,0</span>
                  <span>0,0</span>
                </div>

                {/* 7 Frosted Columns */}
                <div className="flex-1 grid grid-cols-7 gap-2.5 h-full items-end">
                  {weeklyBars.map((b, i) => (
                    <div key={i} className="flex flex-col items-center h-full justify-end group">
                      <div className="relative w-full flex flex-col items-center justify-end h-full">
                        {b.active && (
                          <div className="mb-1.5 px-2 py-0.5 rounded-full bg-white text-[#12151c] text-[11px] font-extrabold shadow-[0_0_12px_rgba(255,255,255,0.6)]">
                            {b.val}
                          </div>
                        )}
                        <div
                          style={{ height: `${b.pct}%` }}
                          className={`w-full max-w-[34px] rounded-t-xl transition-all duration-500 ${
                            b.active
                              ? 'bg-gradient-to-t from-[#0284c7] via-[#38bdf8] to-[#bae6fd] shadow-[0_0_20px_rgba(56,189,248,0.5)]'
                              : 'bg-gradient-to-t from-white/10 to-white/30 group-hover:from-white/20 group-hover:to-white/45'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[11px] mt-1.5 font-semibold ${
                          b.active ? 'text-white font-extrabold' : 'text-white/50'
                        }`}
                      >
                        {b.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ==================== COLUMN 3 (4 COLS): 4-SUBCARD BENTO CLUSTER + DISCOVERY CALL AUDIO PLAYER ==================== */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Top Right 2x2 Frosted Cluster Container */}
            <div className="v30-glass-card p-3.5 grid grid-cols-2 gap-3">
              {/* 1. Customers */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActiveSubTab('CUSTOMERS')}
                onKeyDown={activateOnKey(() => setActiveSubTab('CUSTOMERS'))}
                className="v30-inner-subcard p-3.5 flex flex-col justify-between cursor-pointer hover:border-white/25 transition-all"
              >
                <div className="flex items-center justify-between">
                  <Users size={15} className="text-white/75" />
                  {renderV30Toggle(toggleStates.customers, e => flipToggle('customers', e), 'Müstahsil göstergesi')}
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-white tabular-nums">
                      {v30Customers.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-white/60">Müstahsil Cari</span>
                </div>
              </div>

              {/* 2. Pipeline */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActiveSubTab('PIPELINE')}
                onKeyDown={activateOnKey(() => setActiveSubTab('PIPELINE'))}
                className="v30-inner-subcard p-3.5 flex flex-col justify-between cursor-pointer hover:border-white/25 transition-all row-span-2"
              >
                <div className="flex items-center justify-between">
                  <Layers size={15} className="text-white/75" />
                  {renderV30Toggle(toggleStates.pipeline, e => flipToggle('pipeline', e), 'Vadeli satış göstergesi')}
                </div>

                <div className="space-y-2 my-3">
                  {[
                    { label: 'Müstahsil Alacak', w: stats.totalDebt ? '70%' : '5%', col: 'bg-white/50' },
                    { label: 'Depo Stok Değeri', w: stats.inventoryValue ? '60%' : '5%', col: 'bg-[#38bdf8]' }
                  ].map((st, idx) => (
                    <div key={idx}>
                      <div className="text-[11px] text-white/70 mb-0.5">{st.label}</div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full ${st.col}`} style={{ width: st.w }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-extrabold text-white tabular-nums">
                      {formatCurrency(stats.inventoryValue || 0, currency)}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-white/60">Depo Stok Değeri</span>
                </div>
              </div>

              {/* 3. LIVE Active Stock Items */}
              <div className="v30-inner-subcard p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-extrabold text-white/80 tracking-wider">
                    CANLI
                  </span>
                  {renderV30Toggle(toggleStates.liveUsers, e => flipToggle('liveUsers', e), 'Canlı stok göstergesi')}
                </div>

                <div className="my-2 h-10">
                  <svg className="w-full h-full" viewBox="0 0 120 40">
                    <path
                      d="M0,32 L20,26 L40,29 L60,18 L80,22 L100,10 L120,14"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold text-white tabular-nums">
                      {v30Products.length}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400">Kalem</span>
                  </div>
                  <span className="text-[11px] font-medium text-white/60">Stok Kalemi</span>
                </div>
              </div>

              {/* 4. Open Tasks */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onNavigate('REMINDERS')}
                onKeyDown={activateOnKey(() => onNavigate('REMINDERS'))}
                className="v30-inner-subcard p-3.5 flex items-center justify-between col-span-2 cursor-pointer hover:border-white/25 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/80">
                    <Ticket size={16} />
                  </div>
                  <div>
                    <div className="text-base font-extrabold text-white tabular-nums">
                      {stats.activeReminders || 0}{' '}
                      <span className="text-xs font-semibold text-white/60">Saha Görevi & Vade</span>
                    </div>
                    <span className="text-[11px] text-white/70">Tahsilat & Tarla Ziyaret Hatırlatıcıları</span>
                  </div>
                </div>
                {renderV30Toggle(toggleStates.tickets, e => flipToggle('tickets', e), 'Saha görevlerini göster')}
              </div>
            </div>

            {/* UI-12: Sahte ses oynatıcı kartı (sabit 01:24 / 03:45, ölü Önceki/Sonraki butonları) kaldırıldı. */}
          </div>
        </div>
      )}

      {/* =============================================================================================== */}
      {/* SCREEN 2: PRODUCTS VIEW WITH 3D GLOSSY SQUIRCLE ICONS (1:1 Match to f_28.jpg / frame_11.jpg)   */}
      {/* =============================================================================================== */}
      {activeSubTab === 'PRODUCTS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Top 4 Frosted KPI Cards (11 Products | $73.6k Inventory value | 2 Low stock | 1 Out of stock) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { label: 'Toplam Ürün', val: v30Products.length, Icon: Package },
              { label: 'Stok Değeri', val: formatCurrency(stats.inventoryValue || 0, currency), Icon: DollarSign },
              { label: 'Kritik Stok', val: v30Products.filter(p => p.statusType === 'LOW').length, Icon: Activity },
              { label: 'Tükenen', val: v30Products.filter(p => p.statusType === 'OUT').length, Icon: Ticket }
            ].map((kpi, idx) => (
              <div key={idx} className="v30-glass-card p-4 sm:p-5 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white/80 mb-3" aria-hidden="true">
                  <kpi.Icon size={15} />
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{kpi.val}</div>
                <div className="text-[11px] font-medium text-white/70 mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Filter & Search Bar (Category Pills + Search Input + "+ Add product" White CTA Pill) */}
          <div className="v30-glass-card p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {['ALL', 'İnsektisit', 'Fungisit', 'Bitki Besleme', 'Gübre'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setProductCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 ${
                    productCategoryFilter === cat
                      ? 'bg-[#38bdf8] text-[#041326] font-extrabold shadow-[0_0_12px_rgba(56,189,248,0.45)]'
                      : 'bg-white/8 hover:bg-white/15 text-white/70'
                  }`}
                >
                  {cat === 'ALL' ? `Tümü (${v30Products.length})` : cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <div className="relative flex-1 sm:w-56">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="İlaç veya gübre ara..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-full bg-white/8 border border-white/15 text-xs text-white placeholder-white/45 focus:outline-none focus:border-white/35"
                />
              </div>

              <button
                onClick={() => (onOpenQuickPurchase ? onOpenQuickPurchase() : onNavigate('INVENTORY'))}
                className="px-4 py-1.5 rounded-full bg-white text-[#12151e] hover:bg-white/90 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shrink-0 active:scale-95 transition-all"
              >
                <Plus size={13} strokeWidth={2.8} />
                <span>Ürün Ekle</span>
              </button>
            </div>
          </div>

          {/* 5x2 Grid of Frosted Product Cards with 3D Glossy Squircle Icons (Exact match to f_28.jpg) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {filteredV30Products.map((prod, idx) => {
              const toggleKey = `prod_${idx}`;
              const isOn = toggleStates[toggleKey] ?? true;
              const ProdIcon = prod.Icon;
              return (
                <div
                  key={prod.id}
                  role="button"
                  tabIndex={0}
                  aria-label={prod.name}
                  onClick={() => onNavigate('INVENTORY')}
                  onKeyDown={activateOnKey(() => onNavigate('INVENTORY'))}
                  className="v30-glass-card p-4 flex flex-col justify-between cursor-pointer hover:translate-y-[-3px] transition-all duration-300 group"
                >
                  {/* Top Row: Stock Pill Badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        prod.statusType === 'OUT'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                          : prod.statusType === 'LOW'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                          : 'bg-white/10 text-white/80 border-white/15'
                      }`}
                    >
                      {prod.statusLabel}
                    </span>
                  </div>

                  {/* Center: 3D Glossy Squircle Icon (64x64px) with Specular Inner Highlight */}
                  <div className="my-5 flex items-center justify-center">
                    <div
                      style={{
                        background: prod.gradient,
                        boxShadow: `0 14px 28px -6px ${prod.glow}, inset 0 2px 4px rgba(255,255,255,0.55), inset 0 -3px 6px rgba(0,0,0,0.35)`
                      }}
                      className="w-16 h-16 rounded-[20px] flex items-center justify-center text-white group-hover:scale-108 transition-transform duration-300 border border-white/25"
                    >
                      <ProdIcon size={26} strokeWidth={2.1} />
                    </div>
                  </div>

                  {/* Title + Price Row */}
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-xs sm:text-[13px] font-bold text-white truncate">{prod.name}</h4>
                      <span className="text-xs sm:text-[13px] font-extrabold text-white tabular-nums shrink-0">
                        {formatCurrency(prod.price, currency)}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70 truncate mt-0.5">{prod.category}</p>

                    {/* Stock Level Colored Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden my-3">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${prod.stockPct}%`, backgroundColor: prod.barColor }}
                      />
                    </div>

                    {/* Bottom Row: Sold Count + iOS Sky-Blue Toggle Switch */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[11px] font-semibold text-white/70">
                        ↗ {prod.soldCount.toLocaleString('tr-TR')} satış
                      </span>
                      {renderV30Toggle(isOn, e => flipToggle(toggleKey, e), `${prod.name} göster`)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =============================================================================================== */}
      {/* SCREEN 3: DEALS PIPELINE KANBAN (1:1 Match to f_18.jpg)                                         */}
      {/* =============================================================================================== */}
      {activeSubTab === 'PIPELINE' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { label: 'Açık Vadeli Alacak', val: formatCurrency(stats.totalDebt || 0, currency) },
              { label: 'Depo Stok Değeri', val: formatCurrency(stats.inventoryValue || 0, currency) },
              { label: 'Kayıtlı Reçete', val: `${(prescriptions || []).filter(p => !p.deletedAt).length} Adet` },
              { label: 'Toplam Satış Hacmi', val: formatCurrency(stats.totalSales || 0, currency) }
            ].map((k, i) => (
              <div key={i} className="v30-glass-card p-4 sm:p-5">
                <div className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{k.val}</div>
                <div className="text-[11px] font-medium text-white/55 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="v30-glass-card p-6 text-center space-y-3">
            <h4 className="text-sm font-bold text-white">Vadeli Alacak & Reçete Takip Merkezi (BKTS / e-Fatura Uyumlu)</h4>
            <p className="text-xs text-white/60 max-w-lg mx-auto">
              Tüm müstahsil vadeli bakiyelerini, vade yaşlandırmalarını ve tahsilat geçmişini tek ekrandan yönetin.
            </p>
            <button
              onClick={() => onNavigate('DEBT_TRACKING')}
              className="px-5 py-2.5 rounded-full bg-white text-[#12151e] font-extrabold text-xs inline-flex items-center gap-1.5"
            >
              <span>Vadeli Alacak Ekranına Git →</span>
            </button>
          </div>
        </div>
      )}

      {/* =============================================================================================== */}
      {/* SCREEN 4: CUSTOMERS FROSTED CRM TABLE                                                           */}
      {/* =============================================================================================== */}
      {activeSubTab === 'CUSTOMERS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { label: 'Toplam Müstahsil', val: v30Customers.length },
              { label: 'Borçlu Cari Sayısı', val: (farmers || []).filter(f => !f.deletedAt && (f.balance || 0) < -0.01).length },
              { label: 'Toplam Satış Hacmi', val: formatCurrency(stats.totalSales || 0, currency) },
              { label: 'Toplam Cari Alacak', val: formatCurrency(stats.totalDebt || 0, currency) }
            ].map((k, i) => (
              <div key={i} className="v30-glass-card p-4 sm:p-5">
                <div className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{k.val}</div>
                <div className="text-[11px] font-medium text-white/55 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Search & Add Customer Bar */}
          <div className="v30-glass-card p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45" />
              <input
                type="text"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                placeholder="Müstahsil, köy veya telefon ara..."
                className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white/8 border border-white/15 text-xs text-white placeholder-white/45 focus:outline-none"
              />
            </div>
            <button
              onClick={() => onNavigate('FARMERS')}
              className="px-4 py-1.5 rounded-full bg-white text-[#12151e] font-extrabold text-xs flex items-center gap-1.5 shadow-lg"
            >
              <Plus size={13} strokeWidth={2.8} />
              <span>Müstahsil Ekle</span>
            </button>
          </div>

          {/* Frosted Glass Table */}
          <div className="v30-glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/70">
                    <th className="py-3 px-4">Müstahsil</th>
                    <th className="py-3 px-4">Köy / İşletme</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4">Sorumlu</th>
                    <th className="py-3 px-4 text-right">Bakiye / Hacim</th>
                    <th className="py-3 px-4 text-right">Son İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 text-xs">
                  {v30Customers
                    .filter(c =>
                      !customerSearch ||
                      c.name.toLocaleLowerCase('tr-TR').includes(customerSearch.toLocaleLowerCase('tr-TR'))
                    )
                    .map(c => (
                      <tr
                        key={c.id}
                        tabIndex={0}
                        aria-label={c.name}
                        onClick={() => onNavigate('FARMERS')}
                        onKeyDown={activateOnKey(() => onNavigate('FARMERS'))}
                        className="hover:bg-white/8 focus:bg-white/8 outline-none cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              style={{ backgroundColor: c.avatarColor }}
                              className="w-8 h-8 rounded-full text-white font-extrabold text-xs flex items-center justify-center shrink-0"
                            >
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white">{c.name}</div>
                              <div className="text-[11px] text-white/70">{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white/75 font-medium">{c.company}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white/70">{c.owner}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-white tabular-nums">
                          {formatCurrency(c.ltv, currency)}
                        </td>
                        <td className="py-3 px-4 text-right text-white/70 text-[11px]">{c.lastContact}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================================================== */}
      {/* SCREEN 5: REPORTS EXECUTIVE ANALYTICS (1:1 Match to f_13.jpg)                                   */}
      {/* =============================================================================================== */}
      {activeSubTab === 'REPORTS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { label: 'Dönem Toplam Satış', val: formatCurrency(stats.totalSales || 0, currency) },
              { label: 'Toplam Müstahsil Alacağı', val: formatCurrency(stats.totalDebt || 0, currency) },
              { label: 'Depo Envanter Değeri', val: formatCurrency(stats.inventoryValue || 0, currency) },
              { label: 'Kasa + Banka Nakit', val: formatCurrency((accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0), currency) }
            ].map((k, i) => (
              <div key={i} className="v30-glass-card p-4 sm:p-5">
                <div className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">{k.val}</div>
                <div className="text-[11px] font-medium text-white/55 mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 v30-glass-card p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Dönemsel Ciro & Tahsilat Eğrisi</h3>
                  <p className="text-[11px] text-white/55">12 Aylık Karşılaştırmalı Finansal Rapor</p>
                </div>
                <button
                  onClick={() => onNavigate('REPORTS')}
                  className="px-3.5 py-1.5 rounded-full bg-white text-[#12151e] font-extrabold text-xs flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>PDF Ekstre & Rapor İndir</span>
                </button>
              </div>

              <div className="h-52 flex items-end gap-3 pt-8">
                {[42, 56, 48, 68, 74, 62, 85, 92, 78, 88, 96, 84].map((v, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div
                      style={{ height: `${v}%` }}
                      className={`w-full rounded-t-lg ${
                        idx === 10
                          ? 'bg-gradient-to-t from-[#0284c7] to-[#38bdf8] shadow-[0_0_16px_rgba(56,189,248,0.5)]'
                          : 'bg-white/20 hover:bg-white/35'
                      }`}
                    />
                    <span className="text-[11px] text-white/70 font-mono">A{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 v30-glass-card p-5 flex flex-col items-center justify-center text-center">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="14" />
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * 0.28}
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 60}
                    strokeDashoffset={2 * Math.PI * 60 * 0.78}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold text-white">
                    {formatCurrency(
                      (accounts || []).reduce((s, a) => s + (Number(a.balance) || 0), 0) + (stats.inventoryValue || 0),
                      currency
                    )}
                  </span>
                  <span className="text-[11px] text-white/70">Net Kasa & Stok</span>
                </div>
              </div>
              <p className="text-xs font-semibold text-white/75 mt-2">
                Stok, Vadeli Alacak ve Nakit Kasa Dağılımı
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

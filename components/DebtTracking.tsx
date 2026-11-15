import React, { useState, useMemo } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  MessageCircle,
  AlertCircle,
  Filter,
  Calendar,
  User,
  TrendingDown,
  Clock,
  Phone,
  FileText,
  Plus,
  X,
  Trash2,
  History,
  Wallet,
  MapPin,
  ShieldCheck,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { buildWaUrl } from '../utils/whatsappTemplates';
import { getLocalDateString } from '../utils/dateUtils';
import {
  computeFarmerLedgerTotals,
  computeFifoUnpaidDebtAgeDays
} from '../utils/ledger';
import { turkishMatchesAny } from '../utils/search';
import { Farmer, CollectionLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { DebtReminderModal } from './DebtReminderModal';

interface DebtTrackingProps {
  onSelectFarmer?: (farmerId: string) => void;
}

type RiskGrade = 'A' | 'B' | 'C' | 'D';
type DebtFilterType = 'ALL' | 'OVERDUE' | 'HIGH_DEBT' | 'HIGH_RISK' | 'PROMISED';

const RISK_META: Record<RiskGrade, { label: string; cls: string }> = {
  A: { label: 'A Güvenilir', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  B: { label: 'B Standart', cls: 'bg-sky-500/15 text-sky-500 border-sky-500/30' },
  C: { label: 'C Gecikmeli', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  D: { label: 'D Yüksek Risk', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' }
};

export const DebtTracking: React.FC<DebtTrackingProps> = ({ onSelectFarmer }) => {
  const {
    farmers,
    prescriptions,
    payments,
    myPayments,
    manualDebts,
    stats,
    userProfile,
    farmerLabel,
    collectionLogs,
    addCollectionLog,
    deleteCollectionLog,
    plants
  } = useAppViewModel();
  const { currentUser } = useAuth();
  const currency = userProfile?.currency || 'TRY';
  const activeFarmerLabel = farmerLabel || 'Çiftçi';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<DebtFilterType>('ALL');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useState(false);

  const [newLog, setNewLog] = useState<Partial<CollectionLog>>({
    type: 'PHONE_CALL',
    status: 'REMINDED',
    date: getLocalDateString(),
    note: ''
  });

  const farmerDebtDetails = useMemo(() => {
    const nowMs = Date.now();
    return (farmers || [])
      .filter(f => !f.deletedAt)
      .map(farmer => {
        const totals = computeFarmerLedgerTotals({
          farmerId: farmer.id,
          prescriptions,
          manualDebts,
          payments,
          myPayments
        });
        const rawBalance =
          totals.signedBalance !== 0 ? totals.signedBalance : (Number(farmer.balance) || 0);
        if (rawBalance >= -0.01) return null;

        const totalDebt = Math.abs(rawBalance);
        const farmerPrescriptions = prescriptions
          .filter(p => p.farmerId === farmer.id && !p.deletedAt)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const overduePrescriptions = farmerPrescriptions.filter(p => {
          if (p.priceType === 'CASH' || !p.dueDate) return false;
          return new Date(p.dueDate).getTime() < nowMs;
        });

        const debtAgeDays = computeFifoUnpaidDebtAgeDays({
          farmerId: farmer.id,
          prescriptions,
          manualDebts,
          payments,
          myPayments,
          nowMs
        });

        const payRatio =
          totals.totalDebt > 0
            ? Math.min(1, Math.max(0, totals.totalPaid / totals.totalDebt))
            : 1;
        const payRatioPct = Math.round(payRatio * 100);
        const overLimit = (farmer.creditLimit || 0) > 0 && totalDebt > (farmer.creditLimit || 0);

        const autoGrade: RiskGrade =
          overLimit || (debtAgeDays > 240 && payRatio < 0.25)
            ? 'D'
            : totalDebt <= 50 || (payRatio >= 0.7 && debtAgeDays <= 90)
              ? 'A'
              : debtAgeDays <= 180 && payRatio >= 0.35
                ? 'B'
                : 'C';
        const riskGrade: RiskGrade = farmer.riskScoreOverride || autoGrade;

        const farmerLogs = collectionLogs
          .filter(l => l.farmerId === farmer.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latestLog = farmerLogs[0];
        const hasPromise = latestLog?.status === 'PROMISED_TO_PAY';

        return {
          farmer,
          totalDebt,
          balance: rawBalance,
          hasOverdue: overduePrescriptions.length > 0 || debtAgeDays > 90,
          explicitOverdueCount: overduePrescriptions.length,
          debtAgeDays,
          payRatioPct,
          overLimit,
          riskGrade,
          latestPrescription: farmerPrescriptions[0],
          latestLog,
          logCount: farmerLogs.length,
          hasPromise
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.farmer.fullName.localeCompare(b.farmer.fullName, 'tr-TR'));
  }, [farmers, prescriptions, payments, myPayments, manualDebts, collectionLogs]);

  const portfolioSummary = useMemo(() => {
    let totalPortfolioDebt = 0;
    let bucket0_30 = 0;
    let bucket31_90 = 0;
    let bucket91_180 = 0;
    let bucket180Plus = 0;
    let overdueSummaryCount = 0;
    let highRiskCount = 0;
    let promisedCount = 0;
    let overdueOrAgedDebt = 0;

    for (const d of farmerDebtDetails) {
      totalPortfolioDebt += d.totalDebt;
      if (d.debtAgeDays <= 30) bucket0_30 += d.totalDebt;
      else if (d.debtAgeDays <= 90) bucket31_90 += d.totalDebt;
      else if (d.debtAgeDays <= 180) bucket91_180 += d.totalDebt;
      else bucket180Plus += d.totalDebt;

      if (d.hasOverdue) overdueSummaryCount += 1;
      if (d.riskGrade === 'C' || d.riskGrade === 'D') highRiskCount += 1;
      if (d.hasPromise) promisedCount += 1;
      if (d.hasOverdue || d.riskGrade === 'C' || d.riskGrade === 'D') {
        overdueOrAgedDebt += d.totalDebt;
      }
    }

    const denom = totalPortfolioDebt > 0 ? totalPortfolioDebt : 1;
    return {
      totalPortfolioDebt: totalPortfolioDebt > 0 ? totalPortfolioDebt : (stats.totalDebt || 0),
      overdueOrAgedDebt,
      overdueSummaryCount,
      highRiskCount,
      promisedCount,
      bucket0_30,
      bucket31_90,
      bucket91_180,
      bucket180Plus,
      pct0_30: Math.round((bucket0_30 / denom) * 100),
      pct31_90: Math.round((bucket31_90 / denom) * 100),
      pct91_180: Math.round((bucket91_180 / denom) * 100),
      pct180Plus: Math.round((bucket180Plus / denom) * 100)
    };
  }, [farmerDebtDetails, stats.totalDebt]);

  const filteredFarmers = useMemo(() => {
    let result = farmerDebtDetails.filter(d =>
      turkishMatchesAny([d.farmer.fullName, d.farmer.village, d.farmer.phoneNumber, d.farmer.tcNo], searchTerm)
    );

    if (filterType === 'OVERDUE') {
      result = result.filter(d => d.hasOverdue);
    } else if (filterType === 'HIGH_DEBT') {
      result = [...result].sort((a, b) => a.balance - b.balance);
    } else if (filterType === 'HIGH_RISK') {
      result = result
        .filter(d => d.riskGrade === 'C' || d.riskGrade === 'D')
        .sort((a, b) => b.totalDebt - a.totalDebt);
    } else if (filterType === 'PROMISED') {
      result = result.filter(d => d.hasPromise);
    }

    return result;
  }, [farmerDebtDetails, searchTerm, filterType]);

  const handleSendReminder = (e: React.MouseEvent, farmer: Farmer, amount: number) => {
    e.stopPropagation();
    const message = `Sayın ${farmer.fullName}, bakiyenizde ${formatCurrency(amount, currency)} borç gözükmektedir. Ödeme durumunuzu kontrol etmenizi rica ederiz. İyi günler dileriz.`;
    const whatsappUrl = buildWaUrl(farmer.phoneNumber, message) || `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleOpenLog = (farmerId: string) => {
    setSelectedFarmerId(farmerId);
    setIsLogModalOpen(true);
  };

  const selectedDetail = useMemo(
    () => farmerDebtDetails.find(d => d.farmer.id === selectedFarmerId) || null,
    [farmerDebtDetails, selectedFarmerId]
  );

  const selectedFarmer = useMemo(
    () => farmers.find(f => f.id === selectedFarmerId),
    [farmers, selectedFarmerId]
  );

  const selectedFarmerLogs = useMemo(
    () =>
      collectionLogs
        .filter(l => l.farmerId === selectedFarmerId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [collectionLogs, selectedFarmerId]
  );

  const handleAddLog = async () => {
    if (!selectedFarmerId || !newLog.type || !newLog.status || !newLog.date) return;

    await addCollectionLog({
      farmerId: selectedFarmerId,
      date: newLog.date,
      type: newLog.type as any,
      status: newLog.status as any,
      note: newLog.note,
      nextCallDate: newLog.nextCallDate
    });

    setNewLog({
      type: 'PHONE_CALL',
      status: 'REMINDED',
      date: getLocalDateString(),
      note: ''
    });
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-24 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* KATMAN 1: Kurumsal Alacak & Risk Komuta Başlığı */}
      <section className="v22-forest-card p-4 sm:p-5 rounded-3xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="v22-keep-white text-base sm:text-xl font-black text-white tracking-tight">
              Alacak, Vade &amp; Kredi Risk Merkezi
            </h2>
            <p className="v22-keep-white text-xs text-white/75 mt-1">
              FIFO vade yaşlandırma, risk skorlaması, tahsilat sözü takibi ve toplu WhatsApp hatırlatmalarını tek merkezden yönetin.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="v22-keep-white inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 border border-white/15 text-white">
                <User size={12} className="text-sky-300" />
                <span>{farmerDebtDetails.length} Borçlu Çiftçi</span>
              </span>
              <span className="v22-keep-white inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 border border-amber-400/35 text-amber-200">
                <Clock size={12} />
                <span>{portfolioSummary.overdueSummaryCount} Gecikmiş / Vadesi Geçen</span>
              </span>
              <span className="v22-keep-white inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 border border-rose-400/35 text-rose-200">
                <ShieldCheck size={12} />
                <span>{portfolioSummary.highRiskCount} Yüksek Risk (C/D)</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsBulkMessageModalOpen(true)}
              className="v22-keep-white px-4 py-2.5 min-h-[40px] rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-200 text-xs font-extrabold flex items-center gap-2 transition-all active:scale-95"
            >
              <MessageCircle size={15} className="text-[#25D366]" />
              <span>Toplu WhatsApp Hatırlatma Merkezi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('mks-open-quick-modal', { detail: { modal: 'RECEIVE_PAYMENT' } })
                );
              }}
              className="px-4 py-2.5 min-h-[40px] rounded-xl bg-gradient-to-r from-[#f39264] to-[#e57c4b] hover:from-[#f6a077] hover:to-[#eb8758] text-[#0b211d] text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Wallet size={15} />
              <span>Hızlı Tahsilat Al</span>
            </button>
          </div>
        </div>
      </section>

      {/* KATMAN 2: 4 Sütunlu Finansal Risk & Yaşlandırma KPI Kartları */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Kart 1: Toplam Açık Alacak */}
        <div className="v22-bento-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              Toplam Açık Alacak
            </span>
            <TrendingDown size={15} className="text-rose-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-500 font-mono tabular-nums truncate my-2">
            {formatCurrency(portfolioSummary.totalPortfolioDebt, currency)}
          </div>
          <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--mks-muted)' }}>
            {farmerDebtDetails.length} borçlu çiftçi carisi
          </p>
        </div>

        {/* Kart 2: Gecikmiş & Yüksek Riskli Alacak */}
        <div className="v22-bento-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              Gecikmiş &amp; Riskli Alacak
            </span>
            <AlertCircle size={15} className="text-amber-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-500 font-mono tabular-nums truncate my-2">
            {formatCurrency(portfolioSummary.overdueOrAgedDebt, currency)}
          </div>
          <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--mks-muted)' }}>
            {portfolioSummary.overdueSummaryCount} gecikmiş · {portfolioSummary.highRiskCount} C/D risk notu
          </p>
        </div>

        {/* Kart 3: FIFO Borç Yaşlandırma Dağılımı */}
        <div className="v22-bento-card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              FIFO Borç Yaşlandırma
            </span>
            <Clock size={15} style={{ color: 'var(--mks-muted)' }} />
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden flex mb-2.5" style={{ background: 'var(--mks-subcard)' }}>
            <div className="bg-emerald-500 h-full" style={{ width: `${portfolioSummary.pct0_30}%` }} title={`0-30 Gün: ${portfolioSummary.pct0_30}%`} />
            <div className="bg-sky-500 h-full" style={{ width: `${portfolioSummary.pct31_90}%` }} title={`31-90 Gün: ${portfolioSummary.pct31_90}%`} />
            <div className="bg-amber-500 h-full" style={{ width: `${portfolioSummary.pct91_180}%` }} title={`91-180 Gün: ${portfolioSummary.pct91_180}%`} />
            <div className="bg-rose-500 h-full" style={{ width: `${portfolioSummary.pct180Plus}%` }} title={`180+ Gün: ${portfolioSummary.pct180Plus}%`} />
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
            <div className="flex items-center justify-between gap-1 truncate">
              <span className="text-emerald-500 font-bold">0-30g</span>
              <span className="font-mono font-bold truncate" style={{ color: 'var(--mks-text)' }}>{formatCurrency(portfolioSummary.bucket0_30, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-1 truncate">
              <span className="text-sky-500 font-bold">31-90g</span>
              <span className="font-mono font-bold truncate" style={{ color: 'var(--mks-text)' }}>{formatCurrency(portfolioSummary.bucket31_90, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-1 truncate">
              <span className="text-amber-500 font-bold">91-180g</span>
              <span className="font-mono font-bold truncate" style={{ color: 'var(--mks-text)' }}>{formatCurrency(portfolioSummary.bucket91_180, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-1 truncate">
              <span className="text-rose-500 font-bold">180+g</span>
              <span className="font-mono font-bold truncate" style={{ color: 'var(--mks-text)' }}>{formatCurrency(portfolioSummary.bucket180Plus, currency)}</span>
            </div>
          </div>
        </div>

        {/* Kart 4: Tahsilat İrtibat & Ödeme Sözü */}
        <button
          type="button"
          onClick={() => setFilterType(prev => (prev === 'PROMISED' ? 'ALL' : 'PROMISED'))}
          className="v22-bento-card p-4 flex flex-col justify-between text-left"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              İrtibat &amp; Ödeme Sözü
            </span>
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-500 font-mono tabular-nums truncate my-2">
            {portfolioSummary.promisedCount} Ödeme Sözü
          </div>
          <p className="text-[11px] font-semibold flex items-center justify-between w-full" style={{ color: 'var(--mks-muted)' }}>
            <span>{collectionLogs.length} toplam görüşme notu</span>
            <span style={{ color: 'var(--mks-accent-primary)' }}>
              {filterType === 'PROMISED' ? 'Tümünü Göster' : 'Sözleri Süz →'}
            </span>
          </p>
        </button>
      </section>

      {/* KATMAN 3: Arama / Filtre Çubuğu ve 2 Sütunlu Kurumsal Borçlu Çiftçi Kartları */}
      <section className="v22-bento-card p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--mks-muted)' }} />
            <input
              type="text"
              placeholder={`${activeFarmerLabel} adı, köy veya telefon numarası ile alacak ara...`}
              aria-label="Borçlu çiftçi ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
              { id: 'ALL', label: `Tümü (${farmerDebtDetails.length})` },
              { id: 'OVERDUE', label: `Gecikenler (${portfolioSummary.overdueSummaryCount})` },
              { id: 'HIGH_DEBT', label: 'Yüksek Borç Sıralı' },
              { id: 'HIGH_RISK', label: `Yüksek Risk C/D (${portfolioSummary.highRiskCount})` },
              { id: 'PROMISED', label: `Ödeme Sözü (${portfolioSummary.promisedCount})` }
            ].map(tab => {
              const isSelected = filterType === tab.id;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as DebtFilterType)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border text-[11px] font-extrabold whitespace-nowrap shrink-0 transition-all"
                  style={
                    isSelected
                      ? { background: 'var(--mks-accent-primary)', color: '#ffffff', borderColor: 'var(--mks-accent-primary)' }
                      : { background: 'var(--mks-subcard)', color: 'var(--mks-muted)', borderColor: 'var(--mks-card-border)' }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Borçlu Çiftçi Kartları Grid */}
      {filteredFarmers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredFarmers.map(detail => {
            const riskMeta = RISK_META[detail.riskGrade];
            const plantName = detail.latestPrescription?.plantId
              ? plants.find(p => p.id === detail.latestPrescription?.plantId)?.name
              : undefined;

            return (
              <div
                key={detail.farmer.id}
                onClick={() => handleOpenLog(detail.farmer.id)}
                className="v22-bento-card p-4 flex flex-col justify-between gap-3 cursor-pointer"
              >
                {/* Üst Kısım: Kimlik & Kalan Borç */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border"
                      style={{
                        background: 'var(--mks-accent-soft)',
                        color: 'var(--mks-accent-soft-text)',
                        borderColor: 'var(--mks-card-border)'
                      }}
                    >
                      {detail.farmer.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-black truncate" style={{ color: 'var(--mks-text)' }}>
                          {detail.farmer.fullName}
                        </h3>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${riskMeta.cls}`}>
                          {riskMeta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <MapPin size={11} className="text-emerald-500 shrink-0" />
                          {detail.farmer.village || 'Merkez'}
                        </span>
                        {detail.farmer.phoneNumber && (
                          <span className="font-mono">{detail.farmer.phoneNumber}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                      Kalan Borç
                    </p>
                    <p className="text-base sm:text-lg font-black text-rose-500 font-mono tabular-nums">
                      {formatCurrency(detail.totalDebt, currency)}
                    </p>
                    <p className="text-[10px] font-bold" style={{ color: 'var(--mks-muted)' }}>
                      Tahsilat: %{detail.payRatioPct}
                    </p>
                  </div>
                </div>

                {/* Orta Bilgi Şeridi */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold font-mono"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                  >
                    <Clock size={11} className={detail.debtAgeDays > 90 ? 'text-rose-500' : 'text-amber-500'} />
                    Yaşlandırma: {detail.debtAgeDays} Gün
                  </span>

                  {detail.explicitOverdueCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-extrabold bg-amber-500/15 text-amber-500 border-amber-500/30">
                      <AlertCircle size={11} />
                      Vadesi Geçmiş ({detail.explicitOverdueCount})
                    </span>
                  ) : detail.debtAgeDays > 90 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-extrabold bg-amber-500/15 text-amber-500 border-amber-500/30">
                      <AlertCircle size={11} />
                      90+ Gün Vade
                    </span>
                  ) : null}

                  {detail.overLimit && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-extrabold bg-rose-500/15 text-rose-500 border-rose-500/30">
                      Kredi Limiti Aşıldı
                    </span>
                  )}

                  <span
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                  >
                    <FileText size={11} />
                    Son İşlem:{' '}
                    {detail.latestPrescription
                      ? new Date(detail.latestPrescription.date).toLocaleDateString('tr-TR')
                      : '-'}
                    {plantName ? ` · ${plantName}` : ''}
                  </span>

                  {detail.latestLog && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${
                        detail.latestLog.status === 'PROMISED_TO_PAY'
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                          : 'bg-sky-500/15 text-sky-500 border-sky-500/30'
                      }`}
                    >
                      {detail.latestLog.status === 'REMINDED'
                        ? 'Hatırlatıldı'
                        : detail.latestLog.status === 'PROMISED_TO_PAY'
                          ? 'Ödeme Sözü'
                          : detail.latestLog.status === 'PAID'
                            ? 'Ödendi'
                            : 'Ulaşılamadı'}
                      {detail.latestLog.nextCallDate
                        ? ` · Arama: ${new Date(detail.latestLog.nextCallDate).toLocaleDateString('tr-TR')}`
                        : ''}
                    </span>
                  )}
                </div>

                {/* Alt Aksiyon Şeridi */}
                <div
                  className="flex flex-wrap items-center gap-2 pt-3 border-t"
                  style={{ borderColor: 'var(--mks-card-border)' }}
                >
                  <button
                    type="button"
                    onClick={(e) => handleSendReminder(e, detail.farmer, detail.totalDebt)}
                    className="px-3 py-1.5 min-h-[34px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-500 border border-emerald-500/25 text-[11px] font-extrabold flex items-center gap-1.5 transition-colors"
                  >
                    <MessageCircle size={13} />
                    <span>WP Hatırlat</span>
                  </button>

                  {detail.farmer.phoneNumber && (
                    <a
                      href={`tel:${detail.farmer.phoneNumber}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 min-h-[34px] rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                    >
                      <Phone size={12} className="text-sky-500" />
                      <span>Ara</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLog(detail.farmer.id);
                    }}
                    className="px-3 py-1.5 min-h-[34px] rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                  >
                    <History size={12} />
                    <span>İrtibat &amp; Söz ({detail.logCount})</span>
                  </button>

                  {onSelectFarmer && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFarmer(detail.farmer.id);
                      }}
                      className="ml-auto px-3 py-1.5 min-h-[34px] rounded-xl text-[11px] font-extrabold text-white flex items-center gap-1 transition-all active:scale-95"
                      style={{ background: 'var(--mks-accent-primary)' }}
                    >
                      <span>Cariye Git</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="v22-bento-card p-12 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 border"
            style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
          >
            <Filter size={26} />
          </div>
          <h3 className="font-extrabold text-sm mb-1" style={{ color: 'var(--mks-text)' }}>
            Kriterlere Uygun Borçlu Çiftçi Bulunamadı
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--mks-muted)' }}>
            Arama ifadenizi veya risk filtresini temizleyerek tüm alacakları görebilirsiniz.
          </p>
          {(searchTerm || filterType !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFilterType('ALL');
              }}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white"
              style={{ background: 'var(--mks-accent-primary)' }}
            >
              Filtreyi Sıfırla
            </button>
          )}
        </div>
      )}

      {/* İrtibat & Görüşme Geçmişi Modalı */}
      <AnimatePresence>
        {isLogModalOpen && selectedFarmer && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogModalOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-2xl border-t sm:border rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
              style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
            >
              {/* Modal Header */}
              <div
                className="p-4 sm:p-5 border-b flex flex-wrap justify-between items-center gap-3"
                style={{ borderColor: 'var(--mks-card-border)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-500 shrink-0">
                    <History size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black truncate" style={{ color: 'var(--mks-text)' }}>
                      {selectedFarmer.fullName}
                    </h3>
                    <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                      İrtibat &amp; Tahsilat Sözü Geçmişi
                      {selectedDetail ? ` · Borç: ${formatCurrency(selectedDetail.totalDebt, currency)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) =>
                      handleSendReminder(
                        e,
                        selectedFarmer,
                        selectedDetail?.totalDebt ?? Math.abs(selectedFarmer.balance || 0)
                      )
                    }
                    className="px-3 py-1.5 min-h-[34px] rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 text-[11px] font-extrabold flex items-center gap-1"
                  >
                    <MessageCircle size={13} /> WP Hatırlat
                  </button>
                  {onSelectFarmer && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogModalOpen(false);
                        onSelectFarmer(selectedFarmer.id);
                      }}
                      className="px-3 py-1.5 min-h-[34px] rounded-xl text-[11px] font-extrabold text-white flex items-center gap-1"
                      style={{ background: 'var(--mks-accent-primary)' }}
                    >
                      Cariye Git <ArrowRight size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLogModalOpen(false)}
                    aria-label="Kapat"
                    className="p-2 rounded-xl border"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar">
                {/* New Log Section */}
                <div className="space-y-3.5">
                  <h4 className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    Yeni İrtibat / Söz Kaydı Ekle
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase ml-1" style={{ color: 'var(--mks-muted)' }}>
                        Tarih
                      </label>
                      <input
                        type="date"
                        value={newLog.date}
                        onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                        className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none"
                        style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase ml-1" style={{ color: 'var(--mks-muted)' }}>
                        İrtibat Tipi
                      </label>
                      <select
                        value={newLog.type}
                        onChange={(e) => setNewLog({ ...newLog, type: e.target.value as any })}
                        className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none"
                        style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                      >
                        <option value="PHONE_CALL" className="bg-stone-900 text-stone-100">Telefon Araması</option>
                        <option value="WP_MESSAGE" className="bg-stone-900 text-stone-100">WhatsApp Mesajı</option>
                        <option value="IN_PERSON" className="bg-stone-900 text-stone-100">Yüz Yüze Görüşme</option>
                        <option value="OTHER" className="bg-stone-900 text-stone-100">Diğer</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase ml-1" style={{ color: 'var(--mks-muted)' }}>
                        Durum
                      </label>
                      <select
                        value={newLog.status}
                        onChange={(e) => setNewLog({ ...newLog, status: e.target.value as any })}
                        className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-semibold outline-none"
                        style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                      >
                        <option value="REMINDED" className="bg-stone-900 text-stone-100">Hatırlatıldı</option>
                        <option value="PROMISED_TO_PAY" className="bg-stone-900 text-stone-100">Ödeme Sözü Alındı</option>
                        <option value="PAID" className="bg-stone-900 text-stone-100">Ödeme Yapıldı</option>
                        <option value="UNREACHABLE" className="bg-stone-900 text-stone-100">Ulaşılamadı</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase ml-1" style={{ color: 'var(--mks-muted)' }}>
                        Sonraki Arama
                      </label>
                      <input
                        type="date"
                        value={newLog.nextCallDate || ''}
                        onChange={(e) => setNewLog({ ...newLog, nextCallDate: e.target.value })}
                        className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-mono outline-none"
                        style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase ml-1" style={{ color: 'var(--mks-muted)' }}>
                      Görüşme Notu
                    </label>
                    <textarea
                      value={newLog.note}
                      onChange={(e) => setNewLog({ ...newLog, note: e.target.value })}
                      placeholder="Görüşme detaylarını ve varsa ödeme sözünü buraya kaydedin..."
                      className="w-full border rounded-xl px-3.5 py-2.5 text-xs outline-none min-h-[88px] resize-none"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLog}
                    className="w-full py-3 rounded-2xl text-white font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
                    style={{ background: 'var(--mks-accent-primary)' }}
                  >
                    <Plus size={16} />
                    <span>Kaydı Ekle</span>
                  </button>
                </div>

                {/* History Section */}
                <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--mks-card-border)' }}>
                  <h4 className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    Geçmiş Görüşmeler ({selectedFarmerLogs.length})
                  </h4>
                  <div className="space-y-2.5">
                    {selectedFarmerLogs.length > 0 ? (
                      selectedFarmerLogs.map((log) => (
                        <div
                          key={log.id}
                          className="border rounded-2xl p-3.5 space-y-2"
                          style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2">
                              {log.type === 'PHONE_CALL' && <Phone size={14} className="text-sky-500" />}
                              {log.type === 'WP_MESSAGE' && <MessageCircle size={14} className="text-emerald-500" />}
                              {log.type === 'IN_PERSON' && <User size={14} className="text-amber-500" />}
                              {log.type === 'OTHER' && <FileText size={14} style={{ color: 'var(--mks-muted)' }} />}
                              <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--mks-text)' }}>
                                {log.type === 'PHONE_CALL'
                                  ? 'ARAMA'
                                  : log.type === 'WP_MESSAGE'
                                    ? 'MESAJ'
                                    : log.type === 'IN_PERSON'
                                      ? 'GÖRÜŞME'
                                      : 'DİĞER'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteCollectionLog(log.id)}
                              title="Kaydı Sil"
                              aria-label="Görüşme kaydını sil"
                              className="p-1.5 text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="flex justify-between items-end gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium" style={{ color: 'var(--mks-text)' }}>
                                {log.note || 'Not girilmedi'}
                              </p>
                              {log.nextCallDate && (
                                <p className="text-[11px] text-amber-500 font-bold mt-1.5 flex items-center gap-1.5">
                                  <Calendar size={11} /> Sonraki Arama: {new Date(log.nextCallDate).toLocaleDateString('tr-TR')}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  log.status === 'REMINDED'
                                    ? 'bg-sky-500/15 text-sky-500'
                                    : log.status === 'PROMISED_TO_PAY'
                                      ? 'bg-emerald-500/15 text-emerald-500'
                                      : log.status === 'PAID'
                                        ? 'bg-emerald-500/15 text-emerald-500'
                                        : 'bg-rose-500/15 text-rose-500'
                                }`}
                              >
                                {log.status === 'REMINDED'
                                  ? 'Hatırlatıldı'
                                  : log.status === 'PROMISED_TO_PAY'
                                    ? 'Söz Alındı'
                                    : log.status === 'PAID'
                                      ? 'Ödendi'
                                      : 'Ulaşılamadı'}
                              </span>
                              <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--mks-muted)' }}>
                                {new Date(log.date).toLocaleDateString('tr-TR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        className="text-center py-8 border border-dashed rounded-2xl"
                        style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                      >
                        <p className="text-xs font-medium" style={{ color: 'var(--mks-muted)' }}>
                          Henüz bir görüşme kaydı bulunmuyor.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DebtReminderModal
        isOpen={isBulkMessageModalOpen}
        onClose={() => setIsBulkMessageModalOpen(false)}
        farmersWithDebt={farmerDebtDetails.map(d => ({ ...d.farmer, overallBalance: d.balance }))}
        allFarmers={farmers}
        currency={(userProfile?.currency as 'TRY' | 'USD' | 'EUR') || 'TRY'}
        farmerLabel={activeFarmerLabel}
        engineerId={currentUser?.uid || ''}
        companyName={userProfile?.companyName || 'MKS Mühendisim'}
        onLogReminderSent={async (farmerId, note) => {
          await addCollectionLog({
            farmerId,
            date: getLocalDateString(),
            type: 'WP_MESSAGE',
            status: 'REMINDED',
            note
          });
        }}
      />
    </div>
  );
};

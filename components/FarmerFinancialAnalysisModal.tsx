import React, { useState, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Wallet, 
  BarChart3, 
  Calendar, 
  X, 
  Copy, 
  Download, 
  Check, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Receipt, 
  ShoppingBag, 
  CreditCard, 
  Info,
  Layers,
  Award,
  ChevronRight,
  FileText
} from 'lucide-react';
import { Farmer, Prescription, Payment, ManualDebt, InventoryItem, VisitLog } from '../types';
import { formatCurrency } from '../utils/currency';
import { useAppViewModel } from '../context/AppContext';

interface FarmerFinancialAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  farmer: Farmer;
  farmerLabel?: string;
  prescriptions: Prescription[];
  payments: Payment[];
  manualDebts: ManualDebt[];
  myPayments?: any[];
  inventory: InventoryItem[];
  visits?: VisitLog[];
  currency?: 'TRY' | 'USD' | 'EUR';
}

export const FarmerFinancialAnalysisModal: React.FC<FarmerFinancialAnalysisModalProps> = ({
  isOpen,
  onClose,
  farmer,
  farmerLabel = 'Çiftçi',
  prescriptions,
  payments,
  manualDebts,
  myPayments = [],
  inventory,
  visits = [],
  currency = 'TRY'
}) => {
  const { userProfile, activeTeamMember } = useAppViewModel();
  const hideCostAndProfit = Boolean(
    userProfile?.hideCostAndProfit ||
    (userProfile?.hideBuyingPricesForStaff && activeTeamMember?.role === 'SALES')
  );
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PRODUCTS' | 'PAYMENTS' | 'MONTHLY'>('OVERVIEW');
  const [copied, setCopied] = useState(false);

  // Available years from farmer records
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    prescriptions.forEach(p => years.add(new Date(p.date).getFullYear()));
    payments.forEach(p => years.add(new Date(p.date).getFullYear()));
    manualDebts.forEach(d => years.add(new Date(d.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [prescriptions, payments, manualDebts]);

  // Inventory buying price lookup map
  const buyingPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    inventory.forEach(item => {
      map[item.pesticideId] = item.buyingPrice || 0;
      map[item.id] = item.buyingPrice || 0;
    });
    return map;
  }, [inventory]);

  // Filtered dataset according to year selection
  const filteredData = useMemo(() => {
    const filterByYear = (dateStr: string) => {
      if (selectedYear === 'ALL') return true;
      return new Date(dateStr).getFullYear().toString() === selectedYear;
    };

    const filteredPrescriptions = prescriptions.filter(p => !p.deletedAt && filterByYear(p.date));
    const filteredPayments = payments.filter(p => !p.deletedAt && filterByYear(p.date));
    const filteredManualDebts = manualDebts.filter(d => !d.deletedAt && filterByYear(d.date));

    return {
      prescriptions: filteredPrescriptions,
      payments: filteredPayments,
      manualDebts: filteredManualDebts
    };
  }, [prescriptions, payments, manualDebts, selectedYear]);

  // Main Financial Metrics Calculation
  const metrics = useMemo(() => {
    const { prescriptions: pList, payments: payList, manualDebts: debtList } = filteredData;

    let grossSales = 0;
    let returnAmount = 0;
    let manualDebtTotal = 0;
    let totalCost = 0;
    let itemCountTotal = 0;

    pList.forEach(p => {
      const pTotal = p.totalAmount || 0;
      const isReturn = p.type === 'RETURN' || pTotal < 0;

      if (isReturn) {
        returnAmount += Math.abs(pTotal);
      } else {
        grossSales += pTotal;
      }

      // Calculate cost of items inside prescription
      if (p.items && p.items.length > 0) {
        p.items.forEach(item => {
          let qty = parseFloat(String(item.quantity || '1').replace(',', '.')) || 1;
          if (qty < 0) qty = Math.abs(qty);

          // Get buying price: from item first, then inventory lookup
          let unitBuyingPrice = item.buyingPrice;
          if (unitBuyingPrice === undefined || unitBuyingPrice === null || unitBuyingPrice === 0) {
            unitBuyingPrice = buyingPriceMap[item.pesticideId] || 0;
          }

          const itemCost = qty * unitBuyingPrice;
          if (isReturn) {
            totalCost -= itemCost;
          } else {
            totalCost += itemCost;
            itemCountTotal += qty;
          }
        });
      }
    });

    debtList.forEach(d => {
      if (!d.id.startsWith('turnover-')) {
        manualDebtTotal += (d.amount || 0);
      }
    });

    const netSales = (grossSales + manualDebtTotal) - returnAmount;
    const netProfit = netSales - totalCost;
    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0;

    // Payments Received
    const totalPayments = payList.reduce((acc, p) => acc + (p.amount || 0), 0);
    const collectionRate = netSales > 0 ? Math.min(100, Math.max(0, (totalPayments / netSales) * 100)) : (totalPayments > 0 ? 100 : 0);
    const remainingBalance = netSales - totalPayments;

    // Payment methods breakdown
    const paymentMethods: Record<string, number> = {
      CASH: 0,
      CARD: 0,
      CHECK: 0,
      TEDYE: 0,
      OTHER: 0
    };
    payList.forEach(p => {
      const method = p.method || 'CASH';
      paymentMethods[method] = (paymentMethods[method] || 0) + (p.amount || 0);
    });

    // Average order value
    const totalOrdersCount = pList.filter(p => p.type !== 'RETURN' && (p.totalAmount || 0) >= 0).length;
    const averageOrderValue = totalOrdersCount > 0 ? grossSales / totalOrdersCount : 0;

    return {
      grossSales,
      returnAmount,
      manualDebtTotal,
      netSales,
      totalCost,
      netProfit,
      profitMargin,
      totalPayments,
      collectionRate,
      remainingBalance,
      paymentMethods,
      totalOrdersCount,
      averageOrderValue,
      itemCountTotal
    };
  }, [filteredData, buyingPriceMap]);

  // Product-Level Analysis
  const productAnalysis = useMemo(() => {
    const map: Record<string, {
      id: string;
      name: string;
      totalQuantity: number;
      totalRevenue: number;
      totalCost: number;
      netProfit: number;
      profitMargin: number;
      salesCount: number;
    }> = {};

    filteredData.prescriptions.forEach(p => {
      const isReturn = p.type === 'RETURN' || (p.totalAmount || 0) < 0;
      if (!p.items) return;

      p.items.forEach(item => {
        let qty = parseFloat(String(item.quantity || '1').replace(',', '.')) || 1;
        if (qty < 0) qty = Math.abs(qty);
        const unitPrice = item.unitPrice || (qty > 0 && item.totalPrice ? item.totalPrice / qty : 0);
        const revenue = item.totalPrice !== undefined ? item.totalPrice : qty * unitPrice;

        let unitCost = item.buyingPrice;
        if (unitCost === undefined || unitCost === null || unitCost === 0) {
          unitCost = buyingPriceMap[item.pesticideId] || 0;
        }
        const cost = qty * unitCost;

        const key = item.pesticideId || item.pesticideName;
        if (!map[key]) {
          map[key] = {
            id: key,
            name: item.pesticideName || 'İsimsiz Ürün',
            totalQuantity: 0,
            totalRevenue: 0,
            totalCost: 0,
            netProfit: 0,
            profitMargin: 0,
            salesCount: 0
          };
        }

        if (isReturn) {
          map[key].totalQuantity -= qty;
          map[key].totalRevenue -= revenue;
          map[key].totalCost -= cost;
        } else {
          map[key].totalQuantity += qty;
          map[key].totalRevenue += revenue;
          map[key].totalCost += cost;
          map[key].salesCount += 1;
        }
      });
    });

    const result = Object.values(map).map(prod => {
      const netProfit = prod.totalRevenue - prod.totalCost;
      const profitMargin = prod.totalRevenue > 0 ? (netProfit / prod.totalRevenue) * 100 : 0;
      return {
        ...prod,
        netProfit,
        profitMargin
      };
    });

    return result.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredData.prescriptions, buyingPriceMap]);

  // Monthly Breakdown Data for Selected Year
  const monthlyData = useMemo(() => {
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const months = monthNames.map((name, index) => ({
      monthIndex: index,
      name,
      sales: 0,
      payments: 0,
      cost: 0,
      profit: 0
    }));

    filteredData.prescriptions.forEach(p => {
      const m = new Date(p.date).getMonth();
      const pTotal = p.totalAmount || 0;
      if (p.type === 'RETURN' || pTotal < 0) {
        months[m].sales -= Math.abs(pTotal);
      } else {
        months[m].sales += pTotal;
      }

      if (p.items) {
        p.items.forEach(item => {
          let qty = parseFloat(String(item.quantity || '1').replace(',', '.')) || 1;
          let unitCost = item.buyingPrice || buyingPriceMap[item.pesticideId] || 0;
          const cost = qty * unitCost;
          if (p.type === 'RETURN' || pTotal < 0) {
            months[m].cost -= cost;
          } else {
            months[m].cost += cost;
          }
        });
      }
    });

    filteredData.manualDebts.forEach(d => {
      if (!d.id.startsWith('turnover-')) {
        const m = new Date(d.date).getMonth();
        months[m].sales += (d.amount || 0);
      }
    });

    filteredData.payments.forEach(p => {
      const m = new Date(p.date).getMonth();
      months[m].payments += (p.amount || 0);
    });

    months.forEach(m => {
      m.profit = m.sales - m.cost;
    });

    return months;
  }, [filteredData, buyingPriceMap]);

  // Copy Summary Function
  const handleCopySummary = () => {
    const costLines = hideCostAndProfit
      ? ''
      : `📦 *Satış Maliyeti (COGS):* ${formatCurrency(metrics.totalCost, currency)}\n` +
        `✨ *Net Ticari Kâr:* ${formatCurrency(metrics.netProfit, currency)} (%${metrics.profitMargin.toFixed(1)} Kâr Marjı)\n`;
    const text = `📊 *${farmer.fullName} - Finansal Analiz Raporu* (${selectedYear === 'ALL' ? 'Tüm Zamanlar' : selectedYear})\n` +
      `📍 Köy: ${farmer.village || 'Belirtilmemiş'}\n` +
      `----------------------------------------\n` +
      `💰 *Toplam Satış (Ciro):* ${formatCurrency(metrics.netSales, currency)}\n` +
      costLines +
      `💳 *Tahsil Edilen Tutar:* ${formatCurrency(metrics.totalPayments, currency)} (%${metrics.collectionRate.toFixed(1)} Tahsilat)\n` +
      `⚠️ *Kalan Borç Bakiye:* ${formatCurrency(metrics.remainingBalance, currency)}\n` +
      `----------------------------------------\n` +
      `📋 *Toplam İşlem Sayısı:* ${metrics.totalOrdersCount} Reçete/Satış\n` +
      `📅 Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-stone-900/95 rounded-[2rem] w-full max-w-4xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-stone-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-stone-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg shadow-lg">
              {farmer.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">{farmer.fullName}</h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                  {farmerLabel} Finans Analizi
                </span>
              </div>
              <p className="text-xs text-stone-400 font-medium">
                {farmer.village ? `📍 ${farmer.village}` : 'MKS Finansal Veri Analizi'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Year selector */}
            <div className="flex items-center gap-1.5 bg-stone-900 border border-white/10 rounded-xl px-2.5 py-1.5">
              <Calendar size={14} className="text-stone-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-xs font-bold text-stone-200 outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-stone-900 text-stone-200">Tüm Zamanlar</option>
                {availableYears.map(year => (
                  <option key={year} value={year.toString()} className="bg-stone-900 text-stone-200">{year}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-xs hover:bg-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
              title="Özet Raporu Kopyala"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="hidden sm:inline">{copied ? 'Kopyalandı' : 'Raporu Kopyala'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-stone-800/80 hover:bg-stone-700 text-stone-400 hover:text-white rounded-xl transition-all active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Top 4 KPI Cards */}
        <div className="p-4 bg-stone-950/30 border-b border-white/5 shrink-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            
            {/* KPI 1: Total Sales */}
            <div className="p-3.5 bg-stone-900/80 rounded-2xl border border-blue-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Toplam Satış (Ciro)</span>
                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                  <TrendingUp size={14} />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                {formatCurrency(metrics.netSales, currency)}
              </div>
              <div className="text-[9px] text-stone-400 font-medium mt-1 flex items-center gap-1">
                <ShoppingBag size={10} className="text-blue-400" />
                <span>{metrics.totalOrdersCount} Satış İşlemi</span>
              </div>
            </div>

            {/* KPI 2: Cost of Sales */}
            <div className="p-3.5 bg-stone-900/80 rounded-2xl border border-amber-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Satış Maliyeti (COGS)</span>
                <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                  <Package size={14} />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                {hideCostAndProfit ? '••••••' : formatCurrency(metrics.totalCost, currency)}
              </div>
              <div className="text-[9px] text-stone-400 font-medium mt-1 flex items-center gap-1">
                <Layers size={10} className="text-amber-400" />
                <span>{hideCostAndProfit ? 'Tezgah Modunda Gizli' : 'Stok Alış Maliyetleri'}</span>
              </div>
            </div>

            {/* KPI 3: Net Profit & Margin */}
            <div className={`p-3.5 bg-stone-900/80 rounded-2xl border ${metrics.netProfit >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'} relative overflow-hidden group`}>
              <div className={`absolute top-0 right-0 w-16 h-16 ${metrics.netProfit >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5'} rounded-full blur-xl pointer-events-none`}></div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-black ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'} uppercase tracking-wider`}>Net Ticari Kâr</span>
                <div className={`p-1.5 ${metrics.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} rounded-lg`}>
                  <DollarSign size={14} />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                {hideCostAndProfit ? '••••••' : formatCurrency(metrics.netProfit, currency)}
              </div>
              <div className="text-[9px] font-bold mt-1 flex items-center gap-1">
                <Percent size={10} className={metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                <span className={metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {hideCostAndProfit ? 'Gizli' : `%${metrics.profitMargin.toFixed(1)} Kâr Marjı`}
                </span>
              </div>
            </div>

            {/* KPI 4: Payments & Remaining Balance */}
            <div className="p-3.5 bg-stone-900/80 rounded-2xl border border-purple-500/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider">Tahsilat & Bakiye</span>
                <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Wallet size={14} />
                </div>
              </div>
              <div className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                {formatCurrency(metrics.totalPayments, currency)}
              </div>
              <div className="text-[9px] text-stone-300 font-medium mt-1 flex items-center justify-between">
                <span>Kalan: <strong className="text-amber-400 font-mono">{formatCurrency(farmer.balance !== undefined ? farmer.balance : metrics.remainingBalance, currency)}</strong></span>
              </div>
            </div>

          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 p-2 bg-stone-950/80 border-b border-white/5 overflow-x-auto custom-scrollbar shrink-0">
          {[
            { id: 'OVERVIEW', label: 'GENEL ÖZET & KÂRLILIK', icon: BarChart3 },
            { id: 'PRODUCTS', label: 'ÜRÜN BAZLI KÂRLILIK', icon: ShoppingBag },
            { id: 'PAYMENTS', label: 'TAHSİLAT DÖKÜMÜ', icon: CreditCard },
            { id: 'MONTHLY', label: 'AYLIK TREND', icon: Calendar },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all duration-150 ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-stone-950 shadow-lg shadow-emerald-500/20'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Income vs Expense Financial Table */}
              <div className="bg-stone-900/60 border border-white/5 rounded-2xl p-4 sm:p-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-300 mb-4 flex items-center gap-2">
                  <Receipt size={16} className="text-emerald-400" />
                  <span>Finansal Gelir & Gider Tablosu</span>
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-stone-400 font-medium">Reçete / Ürün Satışları</span>
                    <span className="font-bold font-mono text-emerald-400">+{formatCurrency(metrics.grossSales, currency)}</span>
                  </div>

                  {metrics.manualDebtTotal > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-stone-400 font-medium">Manuel Borç Kayıtları</span>
                      <span className="font-bold font-mono text-emerald-400">+{formatCurrency(metrics.manualDebtTotal, currency)}</span>
                    </div>
                  )}

                  {metrics.returnAmount > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-stone-400 font-medium">İade ve İskontolar</span>
                      <span className="font-bold font-mono text-rose-400">-{formatCurrency(metrics.returnAmount, currency)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-2.5 bg-white/5 px-3 rounded-xl font-bold">
                    <span className="text-white uppercase tracking-wider text-[11px]">Net Satış Geliri (Ciro)</span>
                    <span className="font-mono text-sm text-blue-400">{formatCurrency(metrics.netSales, currency)}</span>
                  </div>

                  {!hideCostAndProfit && (
                    <>
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-stone-400 font-medium">Satılan Ürünlerin Stok Alış Maliyeti (COGS)</span>
                        <span className="font-bold font-mono text-amber-400">-{formatCurrency(metrics.totalCost, currency)}</span>
                      </div>

                      <div className="flex justify-between items-center py-3 bg-emerald-500/10 border border-emerald-500/20 px-3 rounded-xl">
                        <div>
                          <span className="text-emerald-400 font-black uppercase tracking-wider text-xs block">Net Ticari Kâr</span>
                          <span className="text-[10px] text-stone-400 font-medium">Satış Geliri - Satış Maliyeti</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-black text-emerald-400 block">{formatCurrency(metrics.netProfit, currency)}</span>
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">%{metrics.profitMargin.toFixed(1)} Kâr Oranı</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Progress & Collection Health */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Collection Bar */}
                <div className="bg-stone-900/60 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-stone-300">Tahsilat Performansı</span>
                    <span className="text-xs font-mono font-bold text-purple-400">%{metrics.collectionRate.toFixed(1)}</span>
                  </div>
                  <div className="w-full bg-stone-800 rounded-full h-3 overflow-hidden p-0.5 border border-white/5">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${metrics.collectionRate}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-stone-400 mt-2 font-medium">
                    <span>Tahsil Edilen: <strong className="text-white font-mono">{formatCurrency(metrics.totalPayments, currency)}</strong></span>
                    <span>Kalan: <strong className="text-amber-400 font-mono">{formatCurrency(metrics.remainingBalance, currency)}</strong></span>
                  </div>
                </div>

                {/* Basket & Order Statistics */}
                <div className="bg-stone-900/60 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                  <span className="text-xs font-bold text-stone-300 mb-2 block">Ortalama Sipariş / Reçete İstatistiği</span>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white/5 p-2.5 rounded-xl">
                      <span className="text-[9px] text-stone-400 font-bold uppercase block">Ort. Sepet Tutarı</span>
                      <span className="text-xs font-mono font-black text-white mt-1 block">
                        {formatCurrency(metrics.averageOrderValue, currency)}
                      </span>
                    </div>
                    <div className="bg-white/5 p-2.5 rounded-xl">
                      <span className="text-[9px] text-stone-400 font-bold uppercase block">Toplam Satılan Ürün Adedi</span>
                      <span className="text-xs font-mono font-black text-emerald-400 mt-1 block">
                        {metrics.itemCountTotal.toFixed(0)} Adet/Litre
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: PRODUCT LEVEL PROFITABILITY */}
          {activeTab === 'PRODUCTS' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-300 flex items-center gap-2">
                  <ShoppingBag size={16} className="text-emerald-400" />
                  <span>Çiftçiye Satılan Ürünlerin Kârlılık Listesi ({productAnalysis.length} Çeşit Ürün)</span>
                </h3>
              </div>

              {productAnalysis.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs font-medium bg-stone-900/40 rounded-2xl border border-white/5">
                  Bu seçilen dönemde satılan ürün bulunamadı.
                </div>
              ) : (
                <div className="space-y-2">
                  {productAnalysis.map((prod, index) => (
                    <div
                      key={prod.id || index}
                      className="p-3.5 bg-stone-900/80 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{prod.name}</h4>
                          <span className="text-[10px] text-stone-400 font-medium">
                            Satılan Miktar: <strong className="text-stone-200">{prod.totalQuantity} Adet/Birim</strong> ({prod.salesCount} İşlem)
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-right bg-stone-950/40 p-2 sm:p-0 sm:bg-transparent rounded-xl">
                        <div>
                          <span className="text-[9px] text-stone-500 font-bold uppercase block">Toplam Ciro</span>
                          <span className="text-xs font-mono font-bold text-white">
                            {formatCurrency(prod.totalRevenue, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-500 font-bold uppercase block">Stok Maliyeti</span>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {hideCostAndProfit ? '••••' : formatCurrency(prod.totalCost, currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-stone-500 font-bold uppercase block">Kâr / Marj</span>
                          <span className={`text-xs font-mono font-black ${prod.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {hideCostAndProfit ? '••••' : `${formatCurrency(prod.netProfit, currency)} (%${prod.profitMargin.toFixed(0)})`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAYMENTS & COLLECTIONS */}
          {activeTab === 'PAYMENTS' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Payment Methods Distribution Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-stone-900/60 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Nakit Tahsilat</span>
                  <span className="text-sm font-black font-mono text-emerald-400">
                    {formatCurrency(metrics.paymentMethods.CASH || 0, currency)}
                  </span>
                </div>
                <div className="p-3 bg-stone-900/60 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Kredi Kartı</span>
                  <span className="text-sm font-black font-mono text-blue-400">
                    {formatCurrency(metrics.paymentMethods.CARD || 0, currency)}
                  </span>
                </div>
                <div className="p-3 bg-stone-900/60 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Çek / Senet</span>
                  <span className="text-sm font-black font-mono text-purple-400">
                    {formatCurrency(metrics.paymentMethods.CHECK || 0, currency)}
                  </span>
                </div>
                <div className="p-3 bg-stone-900/60 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Tediye / Diğer</span>
                  <span className="text-sm font-black font-mono text-amber-400">
                    {formatCurrency((metrics.paymentMethods.TEDYE || 0) + (metrics.paymentMethods.OTHER || 0), currency)}
                  </span>
                </div>
              </div>

              {/* Payment Records List */}
              <div className="bg-stone-900/60 border border-white/5 rounded-2xl p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-300 mb-3 flex items-center gap-2">
                  <CreditCard size={16} className="text-purple-400" />
                  <span>Geçmiş Tahsilat Kayıtları ({filteredData.payments.length})</span>
                </h3>

                {filteredData.payments.length === 0 ? (
                  <div className="text-center py-8 text-stone-500 text-xs font-medium">
                    Tahsilat kaydı bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredData.payments.map((pay) => (
                      <div key={pay.id} className="p-3 bg-stone-950/60 rounded-xl border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {pay.method === 'CASH' ? 'Nakit Ödeme' : pay.method === 'CARD' ? 'Kredi Kartı' : pay.method === 'CHECK' ? 'Çek' : 'Tahsilat'}
                            </span>
                            {pay.note && <span className="text-[10px] text-stone-400 italic">({pay.note})</span>}
                          </div>
                          <span className="text-[10px] text-stone-500 font-medium">
                            {new Date(pay.date).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-black text-emerald-400">
                          +{formatCurrency(pay.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: MONTHLY TREND */}
          {activeTab === 'MONTHLY' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-300 flex items-center gap-2">
                <Calendar size={16} className="text-blue-400" />
                <span>Aylık Satış, Tahsilat ve Kâr Dağılımı ({selectedYear === 'ALL' ? 'Tüm Zamanlar' : selectedYear})</span>
              </h3>

              <div className="space-y-2">
                {monthlyData.map(m => {
                  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.sales, d.payments)));
                  const salesWidth = maxVal > 0 ? (m.sales / maxVal) * 100 : 0;
                  const payWidth = maxVal > 0 ? (m.payments / maxVal) * 100 : 0;

                  return (
                    <div key={m.monthIndex} className="p-3 bg-stone-900/80 rounded-2xl border border-white/5 space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-stone-200">{m.name}</span>
                        <div className="flex gap-3 font-mono text-[11px]">
                          <span className="text-blue-400">Satış: {formatCurrency(m.sales, currency)}</span>
                          <span className="text-purple-400">Tahsilat: {formatCurrency(m.payments, currency)}</span>
                          {!hideCostAndProfit && (
                            <span className={m.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              Kâr: {formatCurrency(m.profit, currency)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Bars */}
                      {(m.sales > 0 || m.payments > 0) && (
                        <div className="space-y-1">
                          {m.sales > 0 && (
                            <div className="w-full bg-stone-950 rounded-full h-2 overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${salesWidth}%` }}></div>
                            </div>
                          )}
                          {m.payments > 0 && (
                            <div className="w-full bg-stone-950 rounded-full h-2 overflow-hidden">
                              <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${payWidth}%` }}></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-stone-950/80 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-stone-500 font-medium">
            MKS Zirai Otomasyon & Finans Engine
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl transition-all active:scale-95"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};

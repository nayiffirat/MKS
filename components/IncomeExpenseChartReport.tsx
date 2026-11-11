import React, { useState, useMemo, useRef } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, PieChart as RePieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Filter, Download, 
  ArrowUpRight, ArrowDownRight, PieChart, BarChart2, Activity, 
  FileText, CheckCircle2, Search, RefreshCcw, Sparkles, Layers,
  Receipt, ArrowDownLeft, Wallet, ShieldCheck, ChevronRight
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAppViewModel } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { loadJsPdf } from '../utils/pdfHelper';

type Granularity = 'daily' | 'weekly' | 'monthly';
type ActiveViewTab = 'TREND' | 'COMPARISON' | 'CATEGORIES' | 'TRANSACTIONS';

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  RENT: 'Kira Gideri',
  ELECTRICITY: 'Elektrik Gideri',
  WATER: 'Su Gideri',
  FUEL: 'Yakıt / Ulaşım',
  SALARY: 'Personel Maaşları',
  TAX: 'Vergi / Resmi Ödemeler',
  HOME: 'Kişisel / Ev Giderleri',
  OTHER: 'Diğer İşletme Giderleri',
  SUPPLIER_PAYMENT: 'Tedarikçi Ödemesi',
  SUPPLIER_PURCHASE: 'Ürün Alım Faturası'
};

const CATEGORY_COLORS = [
  '#f43f5e', '#f97316', '#eab308', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#14b8a6', '#6366f1', '#a855f7', '#3b82f6'
];

const INCOME_COLORS = [
  '#10b981', '#3b82f6', '#06b6d4', '#14b8a6', '#8b5cf6', '#a855f7'
];

export const IncomeExpenseChartReport: React.FC = () => {
  const { 
    payments, 
    expenses, 
    myPayments, 
    supplierPurchases, 
    prescriptions, 
    transactions, 
    farmers,
    suppliers,
    userProfile,
    farmerLabel
  } = useAppViewModel();

  // Date Range state (Default: Current month)
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [activeTab, setActiveTab] = useState<ActiveViewTab>('TREND');
  const [searchQuery, setSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);

  // Helper date checking
  const dateRange = useMemo(() => {
    const start = startOfDay(parseISO(startDate));
    const end = endOfDay(parseISO(endDate));
    return { start, end };
  }, [startDate, endDate]);

  // Aggregate all raw financial entries
  const allFinancialEntries = useMemo(() => {
    const list: Array<{
      id: string;
      date: Date;
      dateStr: string;
      type: 'INCOME' | 'EXPENSE';
      amount: number;
      category: string;
      categoryLabel: string;
      title: string;
      source: string;
    }> = [];

    // 1. Farmer Collections (Gelir - Tahsilat)
    payments.forEach(p => {
      if (p.deletedAt) return;
      const pDate = new Date(p.date);
      const farmer = farmers.find(f => f.id === p.farmerId);
      const farmerName = farmer ? farmer.fullName : `${farmerLabel || 'Müşteri'}`;
      
      let methodText = 'Nakit';
      if (p.method === 'CARD') methodText = 'Kredi Kartı';
      if (p.method === 'CHECK') methodText = 'Çek';
      if (p.method === 'TEDYE') methodText = 'Havale/EFT';

      list.push({
        id: `pay-${p.id}`,
        date: pDate,
        dateStr: p.date,
        type: 'INCOME',
        amount: Math.abs(p.amount || 0),
        category: 'FARMER_COLLECTION',
        categoryLabel: `${farmerLabel || 'Çiftçi'} Tahsilatı`,
        title: `${farmerName} Tahsilatı (${methodText})`,
        source: farmerName
      });
    });

    // 2. Direct Cash Prescriptions/Sales (Gelir - Peşin Satış)
    prescriptions.forEach(p => {
      if (p.deletedAt) return;
      if (p.type === 'RETURN') return; // Handled separately or excluded from positive income
      // Only include if marked CASH or processed as cash sale
      if (p.priceType === 'CASH' && (p.totalAmount || 0) > 0) {
        const pDate = new Date(p.date);
        const farmer = farmers.find(f => f.id === p.farmerId);
        const farmerName = farmer ? farmer.fullName : 'Peşin Müşteri';

        list.push({
          id: `presc-${p.id}`,
          date: pDate,
          dateStr: p.date,
          type: 'INCOME',
          amount: Math.abs(p.totalAmount || 0),
          category: 'CASH_SALE',
          categoryLabel: 'Peşin Reçete / Ürün Satışı',
          title: `Peşin Satış - Fiş No: ${(p as any).receiptNo || p.prescriptionNo || '-'} (${farmerName})`,
          source: farmerName
        });
      }
    });

    // 3. Transactions table INCOME entries
    transactions.forEach(t => {
      if (t.deletedAt) return;
      if (t.type === 'INCOME') {
        const tDate = new Date(t.date);
        list.push({
          id: `tx-inc-${t.id}`,
          date: tDate,
          dateStr: t.date,
          type: 'INCOME',
          amount: Math.abs(t.amount || 0),
          category: t.category || 'OTHER_INCOME',
          categoryLabel: t.category || 'Diğer Kasa Geliri',
          title: t.description || 'Kasa/Banka Geliri',
          source: 'İşletme Kasası'
        });
      }
    });

    // 4. Operating Expenses (Gider - İşletme Giderleri)
    expenses.forEach(e => {
      if (e.deletedAt) return;
      const eDate = new Date(e.date);
      const catLabel = EXPENSE_CATEGORY_LABELS[e.category] || e.category || 'İşletme Gideri';

      list.push({
        id: `exp-${e.id}`,
        date: eDate,
        dateStr: e.date,
        type: 'EXPENSE',
        amount: Math.abs(e.amount || 0),
        category: e.category || 'OPERATING_EXPENSE',
        categoryLabel: catLabel,
        title: e.title || catLabel,
        source: 'İşletme Gideri'
      });
    });

    // 5. My Payments (Gider - Tedarikçi Ödemeleri & Çek/Senet)
    myPayments.forEach(mp => {
      if (mp.deletedAt || mp.status === 'CANCELLED') return;
      const mpDate = new Date(mp.issueDate || mp.dueDate);
      const supplier = suppliers.find(s => s.id === mp.supplierId);
      const suppName = supplier ? supplier.name : (mp.supplierName || 'Tedarikçi');

      list.push({
        id: `mypay-${mp.id}`,
        date: mpDate,
        dateStr: mp.issueDate || mp.dueDate,
        type: 'EXPENSE',
        amount: Math.abs(mp.amount || 0),
        category: 'SUPPLIER_PAYMENT',
        categoryLabel: 'Tedarikçi Ödemesi',
        title: `Tedarikçi Ödemesi: ${suppName} (${mp.type || 'Ödeme'})`,
        source: suppName
      });
    });

    // 6. Supplier Purchases (Gider - Ürün Alım Faturası)
    supplierPurchases.forEach(sp => {
      if (sp.deletedAt) return;
      if (sp.type === 'SALE') return; // Supplier sale is income if tracked elsewhere
      const spDate = new Date(sp.date);
      const supplier = suppliers.find(s => s.id === sp.supplierId);
      const suppName = supplier ? supplier.name : 'Tedarikçi';
      const totAmt = sp.totalAmount || sp.items.reduce((acc, i) => acc + (i.quantity * (i.buyingPrice || 0)), 0) || 0;

      if (totAmt > 0) {
        list.push({
          id: `supp-purch-${sp.id}`,
          date: spDate,
          dateStr: sp.date,
          type: 'EXPENSE',
          amount: Math.abs(totAmt),
          category: 'SUPPLIER_PURCHASE',
          categoryLabel: 'Tedarikçi Faturası (Alım)',
          title: `Ürün Alım Faturası - Fiş No: ${(sp as any).receiptNo || (sp as any).purchaseNo || '-'} (${suppName})`,
          source: suppName
        });
      }
    });

    // 7. Transactions table EXPENSE entries
    transactions.forEach(t => {
      if (t.deletedAt) return;
      if (t.type === 'EXPENSE') {
        const tDate = new Date(t.date);
        list.push({
          id: `tx-exp-${t.id}`,
          date: tDate,
          dateStr: t.date,
          type: 'EXPENSE',
          amount: Math.abs(t.amount || 0),
          category: t.category || 'OTHER_EXPENSE',
          categoryLabel: t.category || 'Kasa/Banka Çıkışı',
          title: t.description || 'Kasa/Banka Çıkışı',
          source: 'İşletme Kasası'
        });
      }
    });

    return list.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [payments, expenses, myPayments, supplierPurchases, prescriptions, transactions, farmers, suppliers, farmerLabel]);

  // Filter entries strictly within date range
  const filteredEntries = useMemo(() => {
    return allFinancialEntries.filter(entry => {
      return isWithinInterval(entry.date, dateRange);
    });
  }, [allFinancialEntries, dateRange]);

  // Overall financial metrics for current range
  const summaryMetrics = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    filteredEntries.forEach(item => {
      if (item.type === 'INCOME') {
        totalIncome += item.amount;
        incomeCount++;
      } else {
        totalExpense += item.amount;
        expenseCount++;
      }
    });

    const netProfit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
    const days = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDailyIncome = totalIncome / days;
    const avgDailyExpense = totalExpense / days;

    return {
      totalIncome,
      totalExpense,
      netProfit,
      margin,
      incomeCount,
      expenseCount,
      days,
      avgDailyIncome,
      avgDailyExpense
    };
  }, [filteredEntries, dateRange]);

  // Prepare time series chart data based on selected granularity
  const timeSeriesChartData = useMemo(() => {
    const map: Record<string, { label: string; dateObj: Date; income: number; expense: number; net: number }> = {};

    filteredEntries.forEach(entry => {
      let key = '';
      let label = '';

      if (granularity === 'daily') {
        key = format(entry.date, 'yyyy-MM-dd');
        label = format(entry.date, 'dd MMM', { locale: tr });
      } else if (granularity === 'weekly') {
        key = format(entry.date, 'yyyy-II'); // ISO week
        label = `${format(entry.date, 'dd MMM', { locale: tr })} Haftası`;
      } else {
        key = format(entry.date, 'yyyy-MM');
        label = format(entry.date, 'MMM yyyy', { locale: tr });
      }

      if (!map[key]) {
        map[key] = {
          label,
          dateObj: entry.date,
          income: 0,
          expense: 0,
          net: 0
        };
      }

      if (entry.type === 'INCOME') {
        map[key].income += entry.amount;
      } else {
        map[key].expense += entry.amount;
      }
      map[key].net = map[key].income - map[key].expense;
    });

    const result = Object.values(map).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    return result;
  }, [filteredEntries, granularity]);

  // Categorical Expenses Donut Chart Data
  const expenseCategoriesData = useMemo(() => {
    const catMap: Record<string, { name: string; value: number }> = {};

    filteredEntries.filter(e => e.type === 'EXPENSE').forEach(e => {
      const name = e.categoryLabel || 'Diğer Giderler';
      if (!catMap[name]) catMap[name] = { name, value: 0 };
      catMap[name].value += e.amount;
    });

    return Object.values(catMap).sort((a, b) => b.value - a.value);
  }, [filteredEntries]);

  // Categorical Income Sources Donut Chart Data
  const incomeSourcesData = useMemo(() => {
    const sourceMap: Record<string, { name: string; value: number }> = {};

    filteredEntries.filter(e => e.type === 'INCOME').forEach(e => {
      const name = e.categoryLabel || 'Diğer Gelirler';
      if (!sourceMap[name]) sourceMap[name] = { name, value: 0 };
      sourceMap[name].value += e.amount;
    });

    return Object.values(sourceMap).sort((a, b) => b.value - a.value);
  }, [filteredEntries]);

  // Filtered transactions for detail table
  const tableTransactions = useMemo(() => {
    return filteredEntries.filter(tx => {
      const matchesType = txTypeFilter === 'ALL' || tx.type === txTypeFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
        tx.title.toLowerCase().includes(query) || 
        tx.categoryLabel.toLowerCase().includes(query) ||
        tx.source.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }, [filteredEntries, txTypeFilter, searchQuery]);

  // Quick Date Preset Handler
  const applyPreset = (preset: 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30' | 'THIS_YEAR' | 'ALL') => {
    const now = new Date();
    if (preset === 'TODAY') {
      const todayStr = format(now, 'yyyy-MM-dd');
      setStartDate(todayStr);
      setEndDate(todayStr);
      setGranularity('daily');
    } else if (preset === 'THIS_WEEK') {
      setStartDate(format(subDays(now, 7), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
      setGranularity('daily');
    } else if (preset === 'THIS_MONTH') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
      setGranularity('daily');
    } else if (preset === 'LAST_MONTH') {
      const prevMonth = subDays(startOfMonth(now), 1);
      setStartDate(format(startOfMonth(prevMonth), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(prevMonth), 'yyyy-MM-dd'));
      setGranularity('daily');
    } else if (preset === 'LAST_30') {
      setStartDate(format(subDays(now, 30), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
      setGranularity('daily');
    } else if (preset === 'THIS_YEAR') {
      setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
      setGranularity('monthly');
    } else if (preset === 'ALL') {
      setStartDate('2020-01-01');
      setEndDate(format(now, 'yyyy-MM-dd'));
      setGranularity('monthly');
    }
  };

  // Export Executive PDF Report
  const exportPDFReport = async () => {
    setIsExportingPdf(true);
    try {
      const jsPDF = await loadJsPdf();
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // Header
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(userProfile?.companyName || 'ISLETME GELIR-GIDER ANALIZ RAPORU', 14, 14);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Tarih Araligi: ${format(parseISO(startDate), 'dd.MM.yyyy')} - ${format(parseISO(endDate), 'dd.MM.yyyy')}`, 14, 22);
      doc.text(`Rapor Tarihi: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 27);

      let y = 42;

      // Metrics Summary Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 34, 3, 3, 'FD');

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('TOPLAM GELIR', 20, y + 10);
      doc.text('TOPLAM GIDER', 80, y + 10);
      doc.text('NET KAR / DURUM', 140, y + 10);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(`${summaryMetrics.totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${userProfile?.currency || 'TRY'}`, 20, y + 20);

      doc.setTextColor(244, 63, 94); // Rose
      doc.text(`${summaryMetrics.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${userProfile?.currency || 'TRY'}`, 80, y + 20);

      doc.setTextColor(summaryMetrics.netProfit >= 0 ? 16 : 244, summaryMetrics.netProfit >= 0 ? 185 : 63, summaryMetrics.netProfit >= 0 ? 129 : 94);
      doc.text(`${summaryMetrics.netProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${userProfile?.currency || 'TRY'}`, 140, y + 20);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Islem Adedi: ${summaryMetrics.incomeCount}`, 20, y + 27);
      doc.text(`Islem Adedi: ${summaryMetrics.expenseCount}`, 80, y + 27);
      doc.text(`Kar Marji: %${summaryMetrics.margin.toFixed(1)}`, 140, y + 27);

      y += 44;

      // Expenses Category Table
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Gider Kategorileri Dagilimi', 14, y);
      y += 6;

      const catRows = expenseCategoriesData.map(c => [
        c.name,
        `${c.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${userProfile?.currency || 'TRY'}`,
        `%${summaryMetrics.totalExpense > 0 ? ((c.value / summaryMetrics.totalExpense) * 100).toFixed(1) : '0'}`
      ]);

      if (catRows.length > 0) {
        // Render simple table
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, 182, 7, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Kategori', 18, y + 5);
        doc.text('Tutar', 120, y + 5);
        doc.text('Oran', 170, y + 5);
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        catRows.forEach((row, idx) => {
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(14, y, 182, 6, 'F');
          }
          doc.text(row[0], 18, y + 4.5);
          doc.text(row[1], 120, y + 4.5);
          doc.text(row[2], 170, y + 4.5);
          y += 6;
        });
      }

      y += 10;

      // Income Sources Table
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Gelir Kaynaklari Dagilimi', 14, y);
      y += 6;

      const incRows = incomeSourcesData.map(c => [
        c.name,
        `${c.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${userProfile?.currency || 'TRY'}`,
        `%${summaryMetrics.totalIncome > 0 ? ((c.value / summaryMetrics.totalIncome) * 100).toFixed(1) : '0'}`
      ]);

      if (incRows.length > 0) {
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, 182, 7, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Gelir Kaynagi', 18, y + 5);
        doc.text('Tutar', 120, y + 5);
        doc.text('Oran', 170, y + 5);
        y += 8;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        incRows.forEach((row, idx) => {
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(14, y, 182, 6, 'F');
          }
          doc.text(row[0], 18, y + 4.5);
          doc.text(row[1], 120, y + 4.5);
          doc.text(row[2], 170, y + 4.5);
          y += 6;
        });
      }

      doc.save(`Gelir_Gider_Analiz_Raporu_${startDate}_${endDate}.pdf`);
    } catch (err) {
      console.error("PDF Export error:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div ref={reportRef} className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Date Range Selection Bar */}
      <div className="bg-stone-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-100 tracking-tight flex items-center gap-2">
                  Gelir - Gider Analiz Raporu
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-extrabold uppercase">
                    Canlı
                  </span>
                </h2>
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">
                  İşletmenizin nakit akışını ve mali performansını tarih aralığına göre inceleyin
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportPDFReport}
              disabled={isExportingPdf}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 active:scale-95 text-stone-200 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md"
            >
              <Download size={15} className="text-emerald-400" />
              {isExportingPdf ? 'Hazırlanıyor...' : 'PDF İndir'}
            </button>
          </div>
        </div>

        {/* Date Inputs & Quick Presets */}
        <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          {/* Custom Date Pickers */}
          <div className="md:col-span-5 flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-black text-stone-400 uppercase tracking-wider mb-1 block">
                Başlangıç Tarihi
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>

            <span className="text-stone-500 font-bold pt-4">-</span>

            <div className="flex-1">
              <label className="text-[11px] font-black text-stone-400 uppercase tracking-wider mb-1 block">
                Bitiş Tarihi
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="md:col-span-7 flex flex-wrap items-center gap-1.5 pt-2 md:pt-4">
            {[
              { id: 'TODAY', label: 'Bugün' },
              { id: 'THIS_WEEK', label: 'Son 7 gün' },
              { id: 'THIS_MONTH', label: 'Bu ay' },
              { id: 'LAST_MONTH', label: 'Geçen ay' },
              { id: 'LAST_30', label: 'Son 30 gün' },
              { id: 'THIS_YEAR', label: 'Bu yıl' },
              { id: 'ALL', label: 'Tümü' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id as any)}
                className="min-h-[38px] px-3 py-1.5 bg-stone-950/60 hover:bg-stone-800 text-stone-300 hover:text-white rounded-xl text-xs font-bold border border-white/10 active:scale-95 transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Financial Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Income Card */}
        <div className="bg-stone-900/80 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:scale-125 transition-transform"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <ArrowDownLeft size={14} className="text-emerald-400" />
              Toplam Gelir
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              {summaryMetrics.incomeCount} İşlem
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {formatCurrency(summaryMetrics.totalIncome, userProfile?.currency || 'TRY')}
          </div>
          <div className="text-[11px] font-bold text-stone-400 mt-2 flex items-center gap-1">
            <span>Günlük Ort:</span>
            <span className="text-stone-200 font-mono">{formatCurrency(summaryMetrics.avgDailyIncome, userProfile?.currency || 'TRY')}</span>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-stone-900/80 backdrop-blur-md border border-rose-500/20 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-rose-500/10 rounded-full blur-xl group-hover:scale-125 transition-transform"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight size={14} className="text-rose-400" />
              Toplam Gider
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
              {summaryMetrics.expenseCount} İşlem
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-rose-400 tracking-tight">
            {formatCurrency(summaryMetrics.totalExpense, userProfile?.currency || 'TRY')}
          </div>
          <div className="text-[11px] font-bold text-stone-400 mt-2 flex items-center gap-1">
            <span>Günlük Ort:</span>
            <span className="text-stone-200 font-mono">{formatCurrency(summaryMetrics.avgDailyExpense, userProfile?.currency || 'TRY')}</span>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className={`bg-stone-900/80 backdrop-blur-md border rounded-2xl p-4 shadow-xl relative overflow-hidden group transition-all ${
          summaryMetrics.netProfit >= 0 ? 'border-indigo-500/20 hover:border-indigo-500/40' : 'border-rose-500/20 hover:border-rose-500/40'
        }`}>
          <div className={`absolute -right-4 -bottom-4 w-20 h-20 rounded-full blur-xl group-hover:scale-125 transition-transform ${
            summaryMetrics.netProfit >= 0 ? 'bg-indigo-500/10' : 'bg-rose-500/10'
          }`}></div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
              summaryMetrics.netProfit >= 0 ? 'text-indigo-400' : 'text-rose-400'
            }`}>
              <Wallet size={14} />
              Net Durum (Kar/Zarar)
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${
              summaryMetrics.netProfit >= 0 ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              %{summaryMetrics.margin.toFixed(1)} Marj
            </span>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${
            summaryMetrics.netProfit >= 0 ? 'text-indigo-400' : 'text-rose-400'
          }`}>
            {summaryMetrics.netProfit >= 0 ? '+' : ''}{formatCurrency(summaryMetrics.netProfit, userProfile?.currency || 'TRY')}
          </div>
          <div className="text-[11px] font-bold text-stone-400 mt-2 flex items-center gap-1">
            <span>Dönem Süresi:</span>
            <span className="text-stone-200">{summaryMetrics.days} Gün</span>
          </div>
        </div>

        {/* Income-to-Expense Ratio Card */}
        <div className="bg-stone-900/80 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-xl relative overflow-hidden group hover:border-white/10 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity size={14} className="text-amber-400" />
              Gelir / Gider Oranı
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-stone-100 tracking-tight">
            {summaryMetrics.totalExpense > 0 
              ? `${(summaryMetrics.totalIncome / summaryMetrics.totalExpense).toFixed(2)}x` 
              : '100%'}
          </div>
          <div className="text-[11px] font-bold text-stone-400 mt-2 flex items-center gap-1">
            <span>Finansal Sağlık:</span>
            <span className={`font-bold ${summaryMetrics.totalIncome >= summaryMetrics.totalExpense ? 'text-emerald-400' : 'text-rose-400'}`}>
              {summaryMetrics.totalIncome >= summaryMetrics.totalExpense ? 'Pozitif Akış' : 'Gider Fazlası'}
            </span>
          </div>
        </div>

      </div>

      {/* Tab Navigation & Granularity Toggle */}
      <div className="bg-stone-900/60 border border-white/5 rounded-2xl p-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 overflow-hidden">
        
        {/* Main Tab Controls */}
        <div className="mks-tab-rail w-full lg:w-auto">
          {[
            { id: 'TREND', label: 'Gelir - Gider trendi', icon: TrendingUp },
            { id: 'COMPARISON', label: 'Karşılaştırma', icon: BarChart2 },
            { id: 'CATEGORIES', label: 'Kategori dağılımı', icon: PieChart },
            { id: 'TRANSACTIONS', label: 'Detaylı hareketler', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveViewTab)}
              className={`shrink-0 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-stone-950 font-extrabold shadow-sm'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Granularity Switcher (for Charts) */}
        {activeTab !== 'TRANSACTIONS' && (
          <div className="flex items-center gap-1 bg-stone-950/80 border border-white/10 rounded-xl p-1 self-start lg:self-auto shrink-0">
            <span className="text-[11px] font-bold text-stone-400 px-2">Ölçek:</span>
            {[
              { id: 'daily', label: 'Günlük' },
              { id: 'weekly', label: 'Haftalık' },
              { id: 'monthly', label: 'Aylık' }
            ].map(g => (
              <button
                key={g.id}
                onClick={() => setGranularity(g.id as Granularity)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  granularity === g.id
                    ? 'bg-stone-800 text-emerald-400 border border-white/10'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Main Tab Content */}

      {/* 1. Area Trend Chart */}
      {activeTab === 'TREND' && (
        <div className="bg-stone-900/80 border border-white/5 rounded-3xl p-5 shadow-2xl relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <TrendingUp className="text-emerald-500" size={16} />
                Nakit Akış Zaman Serisi Analizi
              </h3>
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Seçili tarih aralığında Gelir, Gider ve Net Kar değişimi
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-stone-300">Gelir</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span className="text-stone-300">Gider</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-stone-300">Net Durum</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full pt-4">
            {timeSeriesChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-stone-400 font-bold text-xs">
                Seçili tarih aralığında hareket bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    stroke="#71717a" 
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={10} 
                    tickLine={false}
                    tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '16px', color: '#fff', fontSize: '12px' }}
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value) || 0, userProfile?.currency || 'TRY'),
                      name === 'income' ? 'Gelir' : (name === 'expense' ? 'Gider' : 'Net Durum')
                    ]}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* 2. Side-by-Side Bar Chart */}
      {activeTab === 'COMPARISON' && (
        <div className="bg-stone-900/80 border border-white/5 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <BarChart2 className="text-blue-500" size={16} />
                Dönemsel Gelir ve Gider Karşılaştırması
              </h3>
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                Her dönem dilimi için doğrudan Gelir ve Gider sütun kıyası
              </p>
            </div>
          </div>

          <div className="h-80 w-full pt-4">
            {timeSeriesChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-stone-400 font-bold text-xs">
                Veri bulunamadı.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSeriesChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="label" stroke="#71717a" fontSize={10} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={10} tickLine={false} tickFormatter={(val) => `${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '16px', color: '#fff', fontSize: '12px' }}
                    formatter={(val: any, name: any) => [
                      formatCurrency(Number(val) || 0, userProfile?.currency || 'TRY'),
                      name === 'income' ? 'Gelir' : 'Gider'
                    ]}
                  />
                  <Bar dataKey="income" name="income" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* 3. Donut Categories Chart */}
      {activeTab === 'CATEGORIES' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Expenses Breakdown */}
          <div className="bg-stone-900/80 border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2 mb-1">
                <PieChart className="text-rose-500" size={16} />
                Gider Kategorileri Dağılımı
              </h3>
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-4">
                Toplam Giderin harcama kalemlerine göre dağılımı
              </p>
            </div>

            {expenseCategoriesData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-stone-400 font-bold text-xs">
                Bu tarih aralığında gider kaydı yok.
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={expenseCategoriesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expenseCategoriesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                        formatter={(val: any) => [formatCurrency(Number(val) || 0, userProfile?.currency || 'TRY'), 'Gider']}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>

                {/* Category List */}
                <div className="w-full space-y-2 mt-4">
                  {expenseCategoriesData.map((item, idx) => {
                    const pct = summaryMetrics.totalExpense > 0 ? ((item.value / summaryMetrics.totalExpense) * 100).toFixed(1) : '0';
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-stone-950/50 border border-white/5 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}></div>
                          <span className="font-bold text-stone-300">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-stone-100">{formatCurrency(item.value, userProfile?.currency || 'TRY')}</span>
                          <span className="text-[11px] font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 font-mono">%{pct}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Income Sources Breakdown */}
          <div className="bg-stone-900/80 border border-white/5 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2 mb-1">
                <PieChart className="text-emerald-500" size={16} />
                Gelir Kaynakları Dağılımı
              </h3>
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-4">
                Toplam Gelirin tahsilat ve satış kanallarına göre dağılımı
              </p>
            </div>

            {incomeSourcesData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-stone-400 font-bold text-xs">
                Bu tarih aralığında gelir kaydı yok.
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={incomeSourcesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {incomeSourcesData.map((entry, index) => (
                          <Cell key={`cell-inc-${index}`} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                        formatter={(val: any) => [formatCurrency(Number(val) || 0, userProfile?.currency || 'TRY'), 'Gelir']}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>

                {/* Income Source List */}
                <div className="w-full space-y-2 mt-4">
                  {incomeSourcesData.map((item, idx) => {
                    const pct = summaryMetrics.totalIncome > 0 ? ((item.value / summaryMetrics.totalIncome) * 100).toFixed(1) : '0';
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-stone-950/50 border border-white/5 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: INCOME_COLORS[idx % INCOME_COLORS.length] }}></div>
                          <span className="font-bold text-stone-300">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-stone-100">{formatCurrency(item.value, userProfile?.currency || 'TRY')}</span>
                          <span className="text-[11px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 font-mono">%{pct}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 4. Detail Transactions Table */}
      {activeTab === 'TRANSACTIONS' && (
        <div className="bg-stone-900/80 border border-white/5 rounded-3xl p-5 shadow-2xl space-y-4">
          
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {[
                { id: 'ALL', label: 'Tüm Hareketler' },
                { id: 'INCOME', label: 'Gelirler (+)' },
                { id: 'EXPENSE', label: 'Giderler (-)' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTxTypeFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    txTypeFilter === f.id
                      ? (f.id === 'INCOME' ? 'bg-emerald-500 text-stone-950' : f.id === 'EXPENSE' ? 'bg-rose-500 text-white' : 'bg-stone-100 text-stone-900')
                      : 'bg-stone-950 text-stone-400 hover:text-white border border-white/5'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-3 text-stone-500" />
              <input 
                type="text"
                placeholder="Açıklama, isim ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-stone-950 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-bold"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950 text-stone-400 text-[11px] uppercase tracking-wider font-extrabold border-b border-white/5">
                <tr>
                  <th className="p-3">Tarih</th>
                  <th className="p-3">Tür</th>
                  <th className="p-3">Açıklama / Taraf</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3 text-right">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tableTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-stone-400 font-bold">
                      Aramanıza veya seçili filtrelere uygun finansal hareket bulunamadı.
                    </td>
                  </tr>
                ) : (
                  tableTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-stone-800/50 transition-colors">
                      <td className="p-3 font-mono text-stone-400 text-[11px] font-bold">
                        {format(tx.date, 'dd.MM.yyyy HH:mm')}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${
                          tx.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {tx.type === 'INCOME' ? 'GELİR' : 'GİDER'}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-stone-200">
                        {tx.title}
                      </td>
                      <td className="p-3 text-stone-400 text-[11px]">
                        {tx.categoryLabel}
                      </td>
                      <td className={`p-3 text-right font-mono font-black text-sm ${
                        tx.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount, userProfile?.currency || 'TRY')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};

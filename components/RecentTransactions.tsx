
import React, { useState, useMemo } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { FileText, CreditCard, Plus, Receipt, History as HistoryIcon, Calendar, User, ArrowUpRight, ArrowDownLeft, Tag, ShoppingBag, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

type FilterType = 'ALL' | 'PRESCRIPTION' | 'PAYMENT' | 'DEBT' | 'EXPENSE' | 'MY_PAYMENT';

interface ActivityItem {
  id: string;
  type: 'PRESCRIPTION' | 'PAYMENT' | 'DEBT' | 'EXPENSE' | 'MY_PAYMENT';
  date: string;
  title: string;
  subtitle: string;
  amount: number;
  isIncome: boolean;
  details?: string;
  farmerId?: string;
}

interface RecentTransactionsProps {
  onSelectFarmer?: (id: string) => void;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({ onSelectFarmer }) => {
  const { prescriptions, payments, manualDebts, expenses, myPayments, farmers, suppliers } = useAppViewModel();
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const allActivities = useMemo(() => {
    const activities: ActivityItem[] = [];

    // Prescriptions
    prescriptions.forEach(p => {
      const farmer = farmers.find(f => f.id === p.farmerId);
      activities.push({
        id: p.id,
        type: 'PRESCRIPTION',
        date: p.date,
        title: farmer?.fullName || 'Bilinmeyen Çiftçi',
        subtitle: 'Reçete Yazıldı',
        amount: p.totalAmount || 0,
        isIncome: true, // Sales are potential income
        details: `${p.items.length} kalem ürün`,
        farmerId: p.farmerId
      });
    });

    // Payments Received
    payments.forEach(p => {
      const farmer = farmers.find(f => f.id === p.farmerId);
      activities.push({
        id: p.id,
        type: 'PAYMENT',
        date: p.date,
        title: farmer?.fullName || 'Bilinmeyen Çiftçi',
        subtitle: 'Tahsilat Alındı',
        amount: p.amount,
        isIncome: true,
        details: p.note,
        farmerId: p.farmerId
      });
    });

    // Manual Debts
    manualDebts.forEach(d => {
      if (d.note?.includes('Devir Bakiyesi')) return;
      const farmer = farmers.find(f => f.id === d.farmerId);
      activities.push({
        id: d.id,
        type: 'DEBT',
        date: d.date,
        title: farmer?.fullName || 'Bilinmeyen Çiftçi',
        subtitle: 'Borç Eklendi',
        amount: d.amount,
        isIncome: true, // Debt added to farmer is income for engineer
        details: d.note,
        farmerId: d.farmerId
      });
    });

    // Expenses
    expenses.forEach(e => {
      activities.push({
        id: e.id,
        type: 'EXPENSE',
        date: e.date,
        title: e.title,
        subtitle: 'Gider Kaydı',
        amount: e.amount,
        isIncome: false,
        details: e.category
      });
    });

    // My Payments (to suppliers)
    myPayments.forEach(p => {
      activities.push({
        id: p.id,
        type: 'MY_PAYMENT',
        date: p.issueDate,
        title: p.supplierName,
        subtitle: `Ödeme (${p.type})`,
        amount: p.amount,
        isIncome: false,
        details: p.status === 'PAID' ? 'Ödendi' : 'Bekliyor'
      });
    });

    return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [prescriptions, payments, manualDebts, expenses, myPayments, farmers]);

  const filteredActivities = useMemo(() => {
    return allActivities.filter(activity => {
      const matchesType = filterType === 'ALL' || activity.type === filterType;
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        activity.title.toLowerCase().includes(searchLower) || 
        activity.subtitle.toLowerCase().includes(searchLower) ||
        (activity.details && activity.details.toLowerCase().includes(searchLower));
      
      return matchesType && matchesSearch;
    });
  }, [allActivities, filterType, searchQuery]);

  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    filteredActivities.forEach(activity => {
      const dateKey = activity.date.split('T')[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(activity);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredActivities]);

  const summary = useMemo(() => {
    const totalIncome = filteredActivities.filter(a => a.isIncome).reduce((acc, a) => acc + a.amount, 0);
    const totalExpense = filteredActivities.filter(a => !a.isIncome).reduce((acc, a) => acc + a.amount, 0);
    return { totalIncome, totalExpense };
  }, [filteredActivities]);

  const getTypeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'PRESCRIPTION': return <FileText size={16} className="text-emerald-400" />;
      case 'PAYMENT': return <CreditCard size={16} className="text-blue-400" />;
      case 'DEBT': return <Plus size={16} className="text-rose-400" />;
      case 'EXPENSE': return <Receipt size={16} className="text-amber-400" />;
      case 'MY_PAYMENT': return <ShoppingBag size={16} className="text-purple-400" />;
      default: return <HistoryIcon size={16} />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-stone-100 tracking-tight flex items-center">
            <HistoryIcon className="mr-2 text-emerald-500" size={20} />
            Son İşlemler
          </h1>
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">
            Günlük bazda tüm aktiviteleriniz
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-2xl p-3 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-widest mb-1 flex items-center">
            <ArrowDownLeft size={10} className="mr-1" /> Toplam Giriş
          </span>
          <span className="text-sm font-black text-emerald-400">
            {summary.totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
          </span>
        </div>
        <div className="bg-rose-900/20 border border-rose-500/20 rounded-2xl p-3 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest mb-1 flex items-center">
            <ArrowUpRight size={10} className="mr-1" /> Toplam Çıkış
          </span>
          <span className="text-sm font-black text-rose-400">
            {summary.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 sticky top-0 z-10 bg-stone-950/80 backdrop-blur-md py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
          <input 
            type="text" 
            placeholder="Çiftçi, tedarikçi veya detay ara..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-900/80 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-emerald-500/50 transition-all"
          />
        </div>

        <div className="flex overflow-x-auto hide-scrollbar space-x-2 pb-1">
          {[
            { id: 'ALL', label: 'Tümü' },
            { id: 'PRESCRIPTION', label: 'Reçeteler' },
            { id: 'PAYMENT', label: 'Tahsilatlar' },
            { id: 'DEBT', label: 'Borçlandırmalar' },
            { id: 'EXPENSE', label: 'Giderler' },
            { id: 'MY_PAYMENT', label: 'Tedarikçi Ödemeleri' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setFilterType(filter.id as FilterType)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0 ${
                filterType === filter.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'bg-stone-900 text-stone-400 border border-white/5 hover:bg-stone-800'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {groupedActivities.length > 0 ? (
          groupedActivities.map(([date, items]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center space-x-3 px-1">
                <div className="h-px flex-1 bg-white/5"></div>
                <div className="flex items-center space-x-2 bg-stone-900/50 px-3 py-1 rounded-full border border-white/5">
                  <Calendar size={10} className="text-stone-500" />
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                    {format(new Date(date), 'd MMMM yyyy, EEEE', { locale: tr })}
                  </span>
                </div>
                <div className="h-px flex-1 bg-white/5"></div>
              </div>

              <div className="grid gap-2">
                {items.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      if (item.farmerId && onSelectFarmer) {
                        onSelectFarmer(item.farmerId);
                      }
                    }}
                    className="group bg-stone-900/40 backdrop-blur-sm border border-white/5 rounded-2xl p-3 flex items-center justify-between hover:bg-stone-800/60 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-stone-950 flex items-center justify-center border border-white/5 shadow-inner group-hover:border-white/10 transition-colors">
                        {getTypeIcon(item.type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xs font-bold text-stone-100">{item.title}</h3>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-white/5 text-stone-500 font-bold uppercase tracking-tighter">
                            {format(new Date(item.date), 'HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[10px] text-stone-500 font-medium">{item.subtitle}</span>
                          {item.details && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-stone-700"></span>
                              <span className="text-[10px] text-stone-600 italic truncate max-w-[120px]">{item.details}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-xs font-black flex items-center justify-end ${item.isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.isIncome ? <ArrowDownLeft size={10} className="mr-1" /> : <ArrowUpRight size={10} className="mr-1" />}
                        {item.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </div>
                      <div className="text-[8px] font-bold text-stone-600 uppercase tracking-widest mt-0.5">
                        {item.isIncome ? 'Giriş' : 'Çıkış'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-stone-600">
            <HistoryIcon size={48} className="opacity-10 mb-4" />
            <p className="text-sm font-medium">Henüz bir işlem kaydı bulunmuyor.</p>
          </div>
        )}
      </div>
    </div>
  );
};

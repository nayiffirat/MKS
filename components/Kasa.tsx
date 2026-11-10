import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Account, Transaction } from '../types';
import { roundAmount } from '../utils/currency';
import { turkishMatchesAny } from '../utils/search';
import { 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Share2, 
  Trash2, 
  Edit2, 
  Search, 
  CreditCard, 
  Banknote, 
  History,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  X,
  User,
  Building2,
  Tag,
  Calendar,
  Clock,
  Briefcase
} from 'lucide-react';

interface KasaProps {
  onBack: () => void;
}

export const Kasa: React.FC<KasaProps> = ({ onBack }) => {
  const { 
    accounts, 
    transactions, 
    farmers = [],
    suppliers = [],
    payments = [],
    prescriptions = [],
    expenses = [],
    myPayments = [],
    addAccount, 
    updateAccount, 
    deleteAccount, 
    addTransaction, 
    deleteTransaction,
    showToast,
    hapticFeedback,
    userProfile
  } = useAppViewModel();

  const [viewMode, setViewMode] = useState<'ACCOUNTS' | 'TRANSACTIONS'>('ACCOUNTS');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showDeleteConfirmAccount, setShowDeleteConfirmAccount] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  // Add Money / Manual Transaction Form States
  const [moneyType, setMoneyType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [moneyAmount, setMoneyAmount] = useState('');
  const [moneyPartyName, setMoneyPartyName] = useState('');
  const [moneyDescription, setMoneyDescription] = useState('');
  const [moneyAccountId, setMoneyAccountId] = useState('');
  const [moneyCategory, setMoneyCategory] = useState('Diğer');
  const [moneyDate, setMoneyDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [isSubmittingMoney, setIsSubmittingMoney] = useState(false);

  // Account Detail View States
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accountViewTab, setAccountViewTab] = useState<'ALL' | 'DAILY'>('ALL');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCalendarOpen) {
      setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [isCalendarOpen, selectedDate]);

  const selectedDateISO = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [selectedDate]);

  const handleDateSelect = (dateStr: string) => {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const newDate = new Date(y, m, d, 12, 0, 0);
      setSelectedDate(newDate);
      hapticFeedback('light');
    }
  };

  const jumpToToday = () => {
    setSelectedDate(new Date());
    hapticFeedback('light');
  };

  // Form states for account
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'CASH' | 'BANK'>('CASH');
  const [iban, setIban] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  // Helper to determine who the money came from/went to
  const getPartyDetails = (tx: Transaction) => {
    if (tx.partyName) {
      return {
        name: tx.partyName,
        type: tx.partyType || 'OTHER',
        label: tx.partyType === 'FARMER' ? 'Çiftçi / Müşteri' : tx.partyType === 'SUPPLIER' ? 'Tedarikçi' : tx.partyType === 'EXPENSE' ? 'Gider Kalemi' : 'Kişi / Firma'
      };
    }

    if (tx.relatedId) {
      // 1. Check Farmer Payments
      const payment = payments.find(p => p.id === tx.relatedId);
      if (payment) {
        const farmer = farmers.find(f => f.id === payment.farmerId);
        if (farmer) return { name: farmer.fullName, type: 'FARMER', label: 'Çiftçi / Müşteri' };
      }
      // 2. Check Prescriptions
      const prescription = prescriptions.find(p => p.id === tx.relatedId);
      if (prescription) {
        const farmer = farmers.find(f => f.id === prescription.farmerId);
        if (farmer) return { name: farmer.fullName, type: 'FARMER', label: 'Çiftçi / Müşteri' };
      }
      // 3. Check Supplier from partyId or suppliers list
      if (tx.partyId) {
        const supplier = suppliers.find(s => s.id === tx.partyId);
        if (supplier) return { name: supplier.name, type: 'SUPPLIER', label: 'Tedarikçi' };
      }
      // 4. Check Expenses
      const expense = expenses.find(e => e.id === tx.relatedId);
      if (expense) {
        return { name: expense.title, type: 'EXPENSE', label: 'Gider Kalemi' };
      }
      // 5. Check MyPayments
      const myPay = myPayments.find(mp => mp.id === tx.relatedId);
      if (myPay) {
        const name = myPay.farmerName || myPay.supplierName;
        if (name) return { name, type: myPay.farmerName ? 'FARMER' : 'SUPPLIER', label: myPay.farmerName ? 'Çiftçi / Müşteri' : 'Tedarikçi' };
      }
    }

    // Smart parsing from description if available
    if (tx.description) {
      const desc = tx.description;
      if (desc.includes('ödemesi') || desc.includes('tahsilatı')) {
        const namePart = desc.split(/ödemesi|tahsilatı/i)[0].trim();
        if (namePart && namePart.length > 2 && !namePart.includes('Peşin')) {
          return { name: namePart, type: 'OTHER', label: 'İlgili Kişi / Firma' };
        }
      }
    }

    return { name: 'Genel / Belirtilmedi', type: 'OTHER', label: 'Genel İşlem' };
  };

  const formatTxDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { date: dateStr, time: '', full: dateStr };
      const dateFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
      const timeFormatted = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      const fullFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(d);
      const exactTime = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { date: dateFormatted, time: timeFormatted, fullDate: fullFormatted, exactTime };
    } catch {
      return { date: dateStr, time: '', fullDate: dateStr, exactTime: '' };
    }
  };

  const handleAccountClick = (account: Account) => {
    setSelectedAccount(account);
    setSelectedDate(new Date());
    hapticFeedback('light');
  };

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
    hapticFeedback('light');
  };

  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
    hapticFeedback('light');
  };

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) nextDay();
    if (isRightSwipe) prevDay();
    setTouchStart(0);
    setTouchEnd(0);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isYesterday = (date: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();
  };

  const formatDateHeader = (date: Date) => {
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const party = getPartyDetails(tx);
      const matchesSearch = turkishMatchesAny([tx.description, tx.category, party.name], searchTerm);
      const matchesFilter = filterType === 'ALL' || tx.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [transactions, searchTerm, filterType, farmers, suppliers, payments, prescriptions, expenses, myPayments]);

  // Calculate running balances for all transactions per account
  // Ordered chronologically ascending: oldest -> newest
  const { runningBalances, balancesBefore } = useMemo(() => {
    const runningMap: Record<string, number> = {};
    const beforeMap: Record<string, number> = {};

    // Group active transactions by account
    const txsByAccount: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
      if (!txsByAccount[tx.accountId]) {
        txsByAccount[tx.accountId] = [];
      }
      txsByAccount[tx.accountId].push(tx);
    }

    // For each account, sort chronologically ascending and compute running balance
    for (const accId in txsByAccount) {
      const list = [...txsByAccount[accId]].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      let bal = 0;
      for (const tx of list) {
        beforeMap[tx.id] = bal;
        if (tx.type === 'INCOME') {
          bal = Math.round((bal + tx.amount + Number.EPSILON) * 100) / 100;
        } else {
          bal = Math.round((bal - tx.amount + Number.EPSILON) * 100) / 100;
        }
        runningMap[tx.id] = bal;
      }
    }

    return { runningBalances: runningMap, balancesBefore: beforeMap };
  }, [transactions]);

  const selectedDayTransactions = useMemo(() => {
    if (!selectedAccount) return [];
    return transactions.filter(tx => {
      if (tx.accountId !== selectedAccount.id) return false;
      const txDate = new Date(tx.date);
      return txDate.getDate() === selectedDate.getDate() &&
             txDate.getMonth() === selectedDate.getMonth() &&
             txDate.getFullYear() === selectedDate.getFullYear();
    });
  }, [transactions, selectedAccount, selectedDate]);

  const accountAllTransactions = useMemo(() => {
    if (!selectedAccount) return [];
    return transactions
      .filter(tx => tx.accountId === selectedAccount.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedAccount]);

  const currentAccountTransactions = accountViewTab === 'DAILY' ? selectedDayTransactions : accountAllTransactions;

  const dailyIncome = useMemo(() => selectedDayTransactions.filter(t => t.type === 'INCOME').reduce((a, b) => a + b.amount, 0), [selectedDayTransactions]);
  const dailyExpense = useMemo(() => selectedDayTransactions.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + b.amount, 0), [selectedDayTransactions]);

  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accounts]);

  const handleSaveAccount = async () => {
    if (!accountName.trim()) {
      showToast('Lütfen hesap adını giriniz', 'error');
      return;
    }

    try {
      if (editingAccount) {
        await updateAccount({
          ...editingAccount,
          name: accountName,
          type: accountType,
          iban: accountType === 'BANK' ? iban : undefined,
          accountHolder: accountType === 'BANK' ? accountHolder : undefined
        });
        showToast('Hesap güncellendi', 'success');
      } else {
        await addAccount({
          name: accountName,
          type: accountType,
          iban: accountType === 'BANK' ? iban : undefined,
          accountHolder: accountType === 'BANK' ? accountHolder : undefined
        });
        showToast('Hesap oluşturuldu', 'success');
      }
      resetForm();
      hapticFeedback('success');
    } catch (e) {
      showToast('İşlem başarısız oldu', 'error');
    }
  };

  const handleAddMoney = async () => {
    if (isSubmittingMoney) return;
    if (!moneyAmount || !moneyAccountId || !moneyDescription) {
      showToast('Lütfen gerekli alanları doldurunuz', 'error');
      return;
    }

    try {
      setIsSubmittingMoney(true);
      const amount = parseFloat(moneyAmount.replace(',', '.')) || 0;
      if (isNaN(amount) || amount <= 0) {
        showToast('Geçerli bir tutar giriniz', 'error');
        return;
      }

      await addTransaction({
        accountId: moneyAccountId,
        type: moneyType,
        amount: amount,
        date: moneyDate ? new Date(moneyDate).toISOString() : new Date().toISOString(),
        description: moneyDescription,
        category: moneyCategory,
        partyName: moneyPartyName.trim() || undefined,
        partyType: 'OTHER'
      });

      showToast(moneyType === 'INCOME' ? 'Para girişi eklendi' : 'Para çıkışı eklendi', 'success');
      setMoneyAmount('');
      setMoneyDescription('');
      setMoneyPartyName('');
      setMoneyAccountId('');
      setShowAddMoney(false);
      hapticFeedback('success');
    } catch (e) {
      showToast('İşlem başarısız oldu', 'error');
    } finally {
      setIsSubmittingMoney(false);
    }
  };

  const resetForm = () => {
    setAccountName('');
    setAccountType('CASH');
    setIban('');
    setAccountHolder('');
    setShowAddAccount(false);
    setEditingAccount(null);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setAccountName(account.name);
    setAccountType(account.type);
    setIban(account.iban || '');
    setAccountHolder(account.accountHolder || '');
    setShowAddAccount(true);
  };

  const shareIban = (account: Account) => {
    if (!account.iban) return;
    const text = `Banka: ${account.name}\nHesap Sahibi: ${account.accountHolder}\nIBAN: ${account.iban}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    hapticFeedback('medium');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: userProfile.currency || 'TRY' }).format(roundAmount(amount));
  };

  // SINGLE ACCOUNT DETAIL VIEW
  if (selectedAccount) {
    return (
      <div className="flex flex-col h-full bg-stone-950">
        {/* Detail Header */}
        <div className="bg-gradient-to-br from-stone-900 to-stone-950 px-6 pt-8 pb-6 border-b border-white/5 relative overflow-hidden">
          <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 ${selectedAccount.type === 'CASH' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
          
          <div className="relative z-10">
            <button 
              onClick={() => setSelectedAccount(null)} 
              className="flex items-center gap-2 text-stone-400 hover:text-white mb-6 transition-colors"
            >
              <ChevronLeft size={20} />
              <span className="text-xs font-bold uppercase tracking-wider">Kasalar</span>
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl ${selectedAccount.type === 'CASH' ? 'bg-amber-500/10 text-amber-500 shadow-amber-500/10' : 'bg-blue-500/10 text-blue-500 shadow-blue-500/10'}`}>
                {selectedAccount.bankLogo ? (
                  <span className="text-4xl">{selectedAccount.bankLogo}</span>
                ) : (
                  selectedAccount.type === 'CASH' ? <Banknote size={32} /> : <CreditCard size={32} />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">{selectedAccount.name}</h2>
                <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{selectedAccount.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabı'}</p>
              </div>
            </div>
            
            <div>
              <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Güncel Bakiye</p>
              <p className="text-4xl font-black text-white font-mono tracking-tight">{formatCurrency(selectedAccount.balance)}</p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle for Single Account */}
        <div className="flex gap-2 px-6 pt-3 pb-3 bg-stone-900 border-b border-white/5">
          <button 
            type="button"
            onClick={() => setAccountViewTab('ALL')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${accountViewTab === 'ALL' ? 'bg-stone-800 text-amber-400 border border-amber-500/20 shadow-sm' : 'text-stone-400 hover:text-white'}`}
          >
            Tüm Hesap Hareketleri ({accountAllTransactions.length})
          </button>
          <button 
            type="button"
            onClick={() => setAccountViewTab('DAILY')}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${accountViewTab === 'DAILY' ? 'bg-stone-800 text-amber-400 border border-amber-500/20 shadow-sm' : 'text-stone-400 hover:text-white'}`}
          >
            Günlük Görünüm
          </button>
        </div>

        {/* Date Navigator - Only active in DAILY mode */}
        {accountViewTab === 'DAILY' && (
          <div className="flex items-center justify-between px-4 py-3 bg-stone-900/90 border-b border-white/5">
            <button 
              type="button"
              onClick={prevDay} 
              className="p-2 text-stone-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-95"
              title="Önceki Gün"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Clickable Date with Interactive Calendar Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsCalendarOpen(true);
                  hapticFeedback('light');
                }}
                className="flex flex-col items-center px-4 py-2 rounded-2xl bg-stone-950/80 hover:bg-stone-950 active:scale-95 transition-all cursor-pointer border border-white/5 hover:border-amber-500/50 shadow-md group"
              >
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {formatDateHeader(selectedDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
                    {isToday(selectedDate) ? 'Bugün' : isYesterday(selectedDate) ? 'Dün' : 'Tarih Değiştir'}
                  </span>
                  <span className="text-[8px] text-stone-400 font-medium">• takvimi aç</span>
                </div>
              </button>

              {/* Native Date Picker overlay - works seamlessly across iOS, Android, and Desktop */}
              <input
                ref={dateInputRef}
                type="date"
                value={selectedDateISO}
                onChange={(e) => {
                  handleDateSelect(e.target.value);
                  setIsCalendarOpen(false);
                }}
                className="sr-only"
                style={{ colorScheme: 'dark' }}
                title="Tarih seçmek için dokunun"
              />
            </div>

            <div className="flex items-center gap-1">
              {!isToday(selectedDate) && (
                <button
                  type="button"
                  onClick={jumpToToday}
                  className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                  title="Bugüne Dön"
                >
                  Bugün
                </button>
              )}
              <button 
                type="button"
                onClick={nextDay} 
                className="p-2 text-stone-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-95"
                title="Sonraki Gün"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Interactive Calendar Modal */}
        {isCalendarOpen && (() => {
          const year = calendarMonth.getFullYear();
          const month = calendarMonth.getMonth();
          
          const monthName = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(calendarMonth);
          const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const daysInPrevMonth = new Date(year, month, 0).getDate();

          const prevMonthDays = Array.from({ length: firstDayIndex }, (_, i) => daysInPrevMonth - firstDayIndex + i + 1);
          const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
          const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
          const nextMonthDays = Array.from({ length: totalCells - (firstDayIndex + daysInMonth) }, (_, i) => i + 1);

          const daysOfWeek = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

          const handlePrevMonth = () => {
            setCalendarMonth(new Date(year, month - 1, 1));
            hapticFeedback('light');
          };

          const handleNextMonth = () => {
            setCalendarMonth(new Date(year, month + 1, 1));
            hapticFeedback('light');
          };

          const selectDay = (day: number) => {
            const newD = new Date(year, month, day, 12, 0, 0);
            setSelectedDate(newD);
            setIsCalendarOpen(false);
            hapticFeedback('medium');
          };

          const todayObj = new Date();
          const isTodayMonth = todayObj.getFullYear() === year && todayObj.getMonth() === month;
          const todayDateNum = todayObj.getDate();

          const isSelectedMonth = selectedDate.getFullYear() === year && selectedDate.getMonth() === month;
          const selectedDateNum = selectedDate.getDate();

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white capitalize">{monthName}</h3>
                      <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Kasa Tarihi Seçin</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-2 text-stone-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-95"
                      title="Önceki Ay"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-2 text-stone-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-95"
                      title="Sonraki Ay"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className="p-2 text-stone-400 hover:text-rose-400 hover:bg-white/5 rounded-xl transition-all active:scale-95 ml-1"
                      title="Kapat"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(new Date());
                      setIsCalendarOpen(false);
                      hapticFeedback('medium');
                    }}
                    className="py-1.5 px-2 bg-stone-950 hover:bg-amber-500/20 text-stone-300 hover:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/5 transition-all text-center"
                  >
                    Bugün
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      setSelectedDate(d);
                      setIsCalendarOpen(false);
                      hapticFeedback('medium');
                    }}
                    className="py-1.5 px-2 bg-stone-950 hover:bg-amber-500/20 text-stone-300 hover:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/5 transition-all text-center"
                  >
                    Dün
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      const dayOfWeek = (d.getDay() + 6) % 7;
                      d.setDate(d.getDate() - dayOfWeek);
                      setSelectedDate(d);
                      setIsCalendarOpen(false);
                      hapticFeedback('medium');
                    }}
                    className="py-1.5 px-2 bg-stone-950 hover:bg-amber-500/20 text-stone-300 hover:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/5 transition-all text-center"
                  >
                    Hafta Başı
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(year, month, 1, 12, 0, 0);
                      setSelectedDate(d);
                      setIsCalendarOpen(false);
                      hapticFeedback('medium');
                    }}
                    className="py-1.5 px-2 bg-stone-950 hover:bg-amber-500/20 text-stone-300 hover:text-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/5 transition-all text-center"
                  >
                    Ay Başı
                  </button>
                </div>

                {/* Days of Week */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {daysOfWeek.map((day, idx) => (
                    <div key={idx} className={`text-[10px] font-black uppercase tracking-wider py-1 ${idx >= 5 ? 'text-amber-400/80' : 'text-stone-500'}`}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {/* Leading Days */}
                  {prevMonthDays.map((d, idx) => (
                    <div key={`prev-${idx}`} className="p-2 text-stone-700 text-xs font-mono select-none">
                      {d}
                    </div>
                  ))}

                  {/* Current Month Days */}
                  {currentMonthDays.map((d) => {
                    const isSelected = isSelectedMonth && selectedDateNum === d;
                    const isTodayCell = isTodayMonth && todayDateNum === d;
                    
                    // Check if there are transactions for selected account on this day
                    const hasTransactions = transactions.some(tx => {
                      if (!selectedAccount || tx.accountId !== selectedAccount.id) return false;
                      const txD = new Date(tx.date);
                      return txD.getFullYear() === year && txD.getMonth() === month && txD.getDate() === d;
                    });

                    return (
                      <button
                        key={`curr-${d}`}
                        type="button"
                        onClick={() => selectDay(d)}
                        className={`relative p-2 rounded-xl text-xs font-mono font-bold transition-all active:scale-90 flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/30 scale-105 font-black'
                            : isTodayCell
                            ? 'bg-stone-800 text-amber-400 border border-amber-500/40 hover:bg-stone-700'
                            : 'text-stone-200 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{d}</span>
                        {hasTransactions && !isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute bottom-1"></span>
                        )}
                        {hasTransactions && isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-950 absolute bottom-1"></span>
                        )}
                      </button>
                    );
                  })}

                  {/* Trailing Days */}
                  {nextMonthDays.map((d, idx) => (
                    <div key={`next-${idx}`} className="p-2 text-stone-700 text-xs font-mono select-none">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Footer action */}
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (typeof (dateInputRef.current as any)?.showPicker === 'function') {
                          (dateInputRef.current as any).showPicker();
                        } else {
                          dateInputRef.current?.click();
                        }
                      } catch (err) {
                        dateInputRef.current?.click();
                      }
                    }}
                    className="text-[10px] font-bold text-stone-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Calendar size={12} />
                    <span>Cihaz Takvimini Aç</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-bold transition-all"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Daily Summary - Only active in DAILY mode */}
        {accountViewTab === 'DAILY' && (
          <div className="flex gap-2 px-6 py-4 bg-stone-950">
            <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <ArrowDownLeft size={16} />
              </div>
              <div>
                <p className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest">Giriş</p>
                <p className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(dailyIncome)}</p>
              </div>
            </div>
            <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center">
                <ArrowUpRight size={16} />
              </div>
              <div>
                <p className="text-[9px] font-black text-rose-500/70 uppercase tracking-widest">Çıkış</p>
                <p className="text-sm font-bold text-rose-400 font-mono">{formatCurrency(dailyExpense)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div 
          className="flex-1 overflow-y-auto p-6 pt-2"
          onTouchStart={accountViewTab === 'DAILY' ? handleTouchStart : undefined}
          onTouchMove={accountViewTab === 'DAILY' ? handleTouchMove : undefined}
          onTouchEnd={accountViewTab === 'DAILY' ? handleTouchEnd : undefined}
        >
          <div className="bg-stone-900 rounded-3xl border border-white/5 overflow-hidden">
            {currentAccountTransactions.map((tx, idx) => {
              const party = getPartyDetails(tx);
              const dateTime = formatTxDateTime(tx.date);
              const balAfter = runningBalances[tx.id] ?? 0;

              return (
                <div 
                  key={tx.id} 
                  onClick={() => setSelectedTransaction(tx)}
                  className={`p-5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:bg-white/10 ${idx !== currentAccountTransactions.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {tx.type === 'INCOME' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-stone-100">{tx.description}</h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {/* Party Detail */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {party.type === 'FARMER' ? <User size={11} /> : party.type === 'SUPPLIER' ? <Building2 size={11} /> : <Tag size={11} />}
                          {party.name}
                        </span>
                        <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">{tx.category || 'Genel'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-black text-lg font-mono ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    {/* Son Bakiye & Tarih/Saat */}
                    <div className="flex flex-col items-end gap-1 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        Bakiye: {formatCurrency(balAfter)}
                      </span>
                      <p className="text-[10px] font-bold text-stone-400 mt-0.5 font-mono flex items-center justify-end gap-1">
                        <Clock size={10} className="text-stone-500" />
                        {accountViewTab === 'ALL' ? `${dateTime.date} • ` : ''}{dateTime.time}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {currentAccountTransactions.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-stone-600">
                <History size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">
                  {accountViewTab === 'DAILY' ? 'Bu tarihte işlem yok' : 'Bu hesaba ait henüz işlem kaydı yok'}
                </p>
                {accountViewTab === 'DAILY' && (
                  <p className="text-xs text-stone-500 mt-2">Sağa veya sola kaydırarak günleri değiştirebilirsiniz</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-stone-950">
      {/* Header */}
      <div className="bg-stone-900 px-6 py-8 border-b border-white/5">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-stone-400"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-stone-100 tracking-tight">Kasa & Banka</h1>
            <p className="text-stone-500 mt-1 font-medium">Finansal durumunuzu ve işlem detaylarınızı yönetin</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setMoneyType('INCOME');
                setShowAddMoney(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <Plus size={18} />
              İşlem Ekle
            </button>
            <button 
              onClick={() => setShowAddAccount(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <Plus size={18} />
              Hesap Ekle
            </button>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-stone-800 rounded-3xl p-6 text-white border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="relative z-10">
            <p className="text-stone-400 text-xs font-black uppercase tracking-[0.2em]">Toplam Varlık</p>
            <h2 className="text-4xl font-black mt-2 tracking-tight font-mono">{formatCurrency(totalBalance)}</h2>
            <div className="flex gap-4 mt-6">
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <TrendingUp size={16} className="text-emerald-400" />
                <span className="text-[10px] font-black uppercase tracking-wider">Gelir Odaklı</span>
              </div>
              <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <Wallet size={16} className="text-amber-400" />
                <span className="text-[10px] font-black uppercase tracking-wider">{accounts.length} Hesap</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-8 bg-stone-950 p-1 rounded-2xl border border-white/5">
          <button 
            onClick={() => setViewMode('ACCOUNTS')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'ACCOUNTS' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
          >
            <CreditCard size={16} />
            Hesaplarım
          </button>
          <button 
            onClick={() => setViewMode('TRANSACTIONS')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'TRANSACTIONS' ? 'bg-stone-800 text-blue-400 shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
          >
            <History size={16} />
            İşlemler & Detaylar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {viewMode === 'ACCOUNTS' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accounts.map(account => (
              <div 
                key={account.id} 
                onClick={() => handleAccountClick(account)}
                className="bg-stone-900 rounded-3xl p-6 border border-white/5 hover:border-white/10 transition-all group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${account.type === 'CASH' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {account.bankLogo ? (
                        <span className="text-3xl">{account.bankLogo}</span>
                      ) : (
                        account.type === 'CASH' ? <Banknote size={28} /> : <CreditCard size={28} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-100 text-lg group-hover:text-emerald-400 transition-colors">{account.name}</h3>
                      <p className="text-stone-500 text-[10px] font-black uppercase tracking-wider">{account.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabı'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditAccount(account); }}
                      className="p-2 hover:bg-white/5 rounded-xl text-stone-500 hover:text-blue-400 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirmAccount(account.id); }}
                      className="p-2 hover:bg-white/5 rounded-xl text-stone-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Bakiye</p>
                  <p className="text-2xl font-black text-stone-100 font-mono">{formatCurrency(account.balance)}</p>
                </div>

                {account.type === 'BANK' && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <div className="overflow-hidden">
                        <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">IBAN</p>
                        <p className="text-stone-400 font-mono text-xs truncate">{account.iban}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); shareIban(account); }}
                        className="ml-4 bg-emerald-500/10 text-emerald-500 p-3 rounded-2xl hover:bg-emerald-500/20 transition-colors active:scale-90 shrink-0"
                      >
                        <Share2 size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {accounts.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 bg-stone-900 rounded-3xl border-2 border-dashed border-white/5">
                <div className="w-20 h-20 bg-stone-950 rounded-full flex items-center justify-center text-stone-700 mb-4">
                  <Wallet size={40} />
                </div>
                <h3 className="text-lg font-bold text-stone-100">Henüz hesap eklenmemiş</h3>
                <p className="text-stone-500 text-sm mt-1">Nakit kasa veya banka hesabı ekleyerek başlayın</p>
                <button 
                  onClick={() => setShowAddAccount(true)}
                  className="mt-6 bg-stone-100 text-stone-900 px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white transition-all"
                >
                  Hesap Ekle
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                <input 
                  type="text"
                  placeholder="Açıklama, kişi, firma veya kategori ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-900 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-emerald-500/50 transition-all text-sm font-medium"
                />
              </div>
              <div className="flex gap-2">
                {(['ALL', 'INCOME', 'EXPENSE'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-stone-100 text-stone-900 shadow-lg' : 'bg-stone-900 text-stone-500 border border-white/5 hover:border-white/10'}`}
                  >
                    {type === 'ALL' ? 'Tümü' : type === 'INCOME' ? 'Giriş (+)' : 'Çıkış (-)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            <div className="bg-stone-900 rounded-3xl border border-white/5 overflow-hidden">
              {filteredTransactions.map((tx, idx) => {
                const account = accounts.find(a => a.id === tx.accountId);
                const party = getPartyDetails(tx);
                const dateTime = formatTxDateTime(tx.date);

                return (
                  <div 
                    key={tx.id} 
                    onClick={() => setSelectedTransaction(tx)}
                    className={`p-5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer active:bg-white/10 ${idx !== filteredTransactions.length - 1 ? 'border-b border-white/5' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {tx.type === 'INCOME' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-100">{tx.description}</h4>
                        
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {/* Paranın Kimden Geldiği / Kime Gittiği */}
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {party.type === 'FARMER' ? <User size={11} /> : party.type === 'SUPPLIER' ? <Building2 size={11} /> : <Tag size={11} />}
                            {party.name}
                          </span>

                          <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">{tx.category || 'Genel'}</span>
                          <span className="w-1 h-1 bg-stone-800 rounded-full"></span>
                          <span className="text-[10px] font-medium text-stone-400">{account?.name || 'Hesap Seçilmedi'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`font-black text-lg font-mono ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      {/* Son Bakiye & Tarih/Saat */}
                      <div className="flex flex-col items-end gap-1 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          Bakiye: {formatCurrency(runningBalances[tx.id] ?? 0)}
                        </span>
                        <p className="text-[10px] font-bold text-stone-400 mt-0.5 font-mono flex items-center justify-end gap-1">
                          <Calendar size={10} className="text-stone-500" />
                          {dateTime.date} • {dateTime.time}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredTransactions.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-stone-600">
                  <History size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">İşlem kaydı bulunamadı</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Money / Manual Transaction Modal */}
      {showAddMoney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 pt-8 pb-6 flex justify-between items-center border-b border-white/5">
              <h2 className="text-2xl font-black text-stone-100 tracking-tight">Kasa İşlemi Ekle</h2>
              <button onClick={() => setShowAddMoney(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={24} className="text-stone-500" />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {/* Transaction Type Toggle */}
              <div className="flex gap-2 p-1 bg-stone-950 rounded-2xl border border-white/5">
                <button 
                  type="button"
                  onClick={() => setMoneyType('INCOME')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${moneyType === 'INCOME' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-stone-500'}`}
                >
                  <ArrowDownLeft size={16} />
                  Para Girişi (+)
                </button>
                <button 
                  type="button"
                  onClick={() => setMoneyType('EXPENSE')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${moneyType === 'EXPENSE' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-stone-500'}`}
                >
                  <ArrowUpRight size={16} />
                  Para Çıkışı (-)
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Hedef Hesap / Kasa</label>
                  <select 
                    value={moneyAccountId}
                    onChange={(e) => setMoneyAccountId(e.target.value)}
                    className="w-full px-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-blue-500/50 transition-all font-medium appearance-none"
                  >
                    <option value="">Hesap Seçiniz</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">
                    {moneyType === 'INCOME' ? 'Paranın Geldiği Kişi / Firma (Kimden)' : 'Paranın Gittiği Kişi / Firma (Kime)'}
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Örn: Ahmet Yılmaz, Hektaş A.Ş. veya Serbest Kişi"
                      value={moneyPartyName}
                      onChange={(e) => setMoneyPartyName(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-blue-500/50 transition-all font-medium"
                    />
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Tutar</label>
                  <div className="relative">
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={moneyAmount}
                      onChange={(e) => setMoneyAmount(e.target.value)}
                      className="w-full pl-5 pr-16 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-blue-500/50 transition-all font-mono text-xl"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-stone-500 font-bold">{userProfile.currency || 'TRY'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">İşlem Açıklaması</label>
                  <input 
                    type="text"
                    placeholder="İşlem açıklaması giriniz"
                    value={moneyDescription}
                    onChange={(e) => setMoneyDescription(e.target.value)}
                    className="w-full px-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-blue-500/50 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Kategori</label>
                    <select 
                      value={moneyCategory}
                      onChange={(e) => setMoneyCategory(e.target.value)}
                      className="w-full px-4 py-3.5 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-blue-500/50 transition-all font-medium text-xs appearance-none"
                    >
                      <option value="Diğer">Diğer</option>
                      <option value="Sermaye">Sermaye</option>
                      <option value="Kredi">Kredi</option>
                      <option value="İade">İade</option>
                      <option value="Çiftçi Tahsilat">Çiftçi Tahsilat</option>
                      <option value="Tedarikçi Ödemesi">Tedarikçi Ödemesi</option>
                      <option value="Kişisel">Kişisel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Tarih & Saat</label>
                    <input 
                      type="datetime-local"
                      value={moneyDate}
                      onChange={(e) => setMoneyDate(e.target.value)}
                      className="w-full px-3 py-3 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-blue-500/50 transition-all font-medium text-xs"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 pb-8 flex gap-3">
              <button 
                type="button"
                onClick={() => setShowAddMoney(false)}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-stone-500 hover:bg-white/5 transition-all"
              >
                Vazgeç
              </button>
              <button 
                type="button"
                disabled={isSubmittingMoney}
                onClick={handleAddMoney}
                className={`flex-[2] py-4 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${moneyType === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'}`}
              >
                {isSubmittingMoney ? 'Kaydediliyor...' : (moneyType === 'INCOME' ? 'Giriş Kaydet (+)' : 'Çıkış Kaydet (-)')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-stone-900 w-full max-w-md rounded-[2.5rem] border border-white/10 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`h-2 ${selectedTransaction.type === 'INCOME' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${selectedTransaction.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {selectedTransaction.type === 'INCOME' ? <ArrowDownLeft size={32} /> : <ArrowUpRight size={32} />}
                </div>
                <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={24} className="text-stone-500" />
                </button>
              </div>

              {/* Amount Display */}
              <div className="mb-6">
                <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">İşlem Tutarı</p>
                <p className={`text-4xl font-black font-mono tracking-tight ${selectedTransaction.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedTransaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(selectedTransaction.amount)}
                </p>
              </div>

              {/* Bakiye Değişimi & Son Bakiye Takibi */}
              <div className="bg-stone-950 p-4 rounded-2xl border border-white/5 mb-6">
                <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center justify-between">
                  <span>Hesap Bakiye Takibi</span>
                  <span className="text-amber-400 font-bold">{accounts.find(a => a.id === selectedTransaction.accountId)?.name || 'Kasa'}</span>
                </p>
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-center">
                  <div>
                    <p className="text-[9px] text-stone-500 uppercase font-black">Önceki Bakiye</p>
                    <p className="font-mono text-xs font-bold text-stone-300 mt-1">
                      {formatCurrency(balancesBefore[selectedTransaction.id] ?? 0)}
                    </p>
                  </div>
                  <div className="border-x border-white/5">
                    <p className="text-[9px] text-stone-500 uppercase font-black">İşlem</p>
                    <p className={`font-mono text-xs font-black mt-1 ${selectedTransaction.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedTransaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(selectedTransaction.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-amber-400 uppercase font-black">Son Bakiye</p>
                    <p className="font-mono text-xs font-black text-amber-300 mt-1">
                      {formatCurrency(runningBalances[selectedTransaction.id] ?? 0)}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] text-stone-400 text-center mt-2 font-medium">
                  Bu işlem sonrası son bakiye: <strong className="text-amber-300 font-mono">{formatCurrency(runningBalances[selectedTransaction.id] ?? 0)}</strong>
                </p>
              </div>

              {/* Who the money came from / went to Banner */}
              {(() => {
                const party = getPartyDetails(selectedTransaction);
                return (
                  <div className="bg-stone-950 p-4 rounded-2xl border border-white/5 mb-6">
                    <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2 flex items-center justify-between">
                      <span>{selectedTransaction.type === 'INCOME' ? 'Paranın Geldiği Kişi / Firma' : 'Paranın Gittiği Kişi / Firma'}</span>
                      <span className="text-amber-400 font-bold">{party.label}</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                        {party.type === 'FARMER' ? <User size={20} /> : party.type === 'SUPPLIER' ? <Building2 size={20} /> : <Briefcase size={20} />}
                      </div>
                      <div>
                        <p className="text-stone-100 font-black text-base">{party.name}</p>
                        <p className="text-stone-500 text-xs font-medium">İlgili Taraf Kaydı</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">İşlem Türü</p>
                    <p className="text-stone-100 font-bold">{selectedTransaction.type === 'INCOME' ? 'Gelir / Giriş (+)' : 'Gider / Çıkış (-)'}</p>
                  </div>
                  <div>
                    <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Kategori</p>
                    <p className="text-stone-100 font-bold">{selectedTransaction.category || 'Genel'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">İşlem Açıklaması</p>
                  <p className="text-stone-100 font-medium leading-relaxed bg-stone-950/40 p-3 rounded-xl border border-white/5 text-sm">{selectedTransaction.description}</p>
                </div>

                {/* Date and Exact Time */}
                {(() => {
                  const dt = formatTxDateTime(selectedTransaction.date);
                  return (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div>
                        <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">İşlem Tarihi</p>
                        <p className="text-stone-200 text-xs font-bold flex items-center gap-1.5">
                          <Calendar size={14} className="text-amber-500" />
                          {dt.fullDate}
                        </p>
                      </div>
                      <div>
                        <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Tam Saati</p>
                        <p className="text-stone-200 text-xs font-bold flex items-center gap-1.5 font-mono">
                          <Clock size={14} className="text-blue-400" />
                          {dt.exactTime || dt.time}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Account Details */}
                {accounts.find(a => a.id === selectedTransaction.accountId) && (
                  <div className="bg-stone-950/60 p-4 rounded-2xl border border-white/5 mt-2">
                    <p className="text-stone-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">İşlem Yapılan Hesap</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center text-stone-400">
                          <Wallet size={16} />
                        </div>
                        <p className="text-stone-200 font-bold text-sm">{accounts.find(a => a.id === selectedTransaction.accountId)?.name}</p>
                      </div>
                      <span className="text-xs font-mono font-bold text-stone-400">
                        Bakiye: {formatCurrency(accounts.find(a => a.id === selectedTransaction.accountId)?.balance || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={async () => {
                    if (window.confirm('Bu kasa işlemini silmek istediğinize emin misiniz?')) {
                      await deleteTransaction(selectedTransaction.id);
                      setSelectedTransaction(null);
                      showToast('İşlem silindi', 'success');
                    }
                  }}
                  className="px-4 py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Sil
                </button>
                <button 
                  onClick={() => setSelectedTransaction(null)}
                  className="flex-1 py-4 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirmAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 w-full max-w-sm rounded-[2rem] border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-bold text-stone-100">Hesap Silinsin mi?</h3>
            <p className="text-xs text-stone-400">Bu hesabı silmek bağlı işlem geçmişinizi etkileyebilir.</p>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setShowDeleteConfirmAccount(null)}
                className="flex-1 py-3 bg-stone-800 text-stone-300 rounded-xl font-bold text-xs"
              >
                Vazgeç
              </button>
              <button 
                onClick={async () => {
                  await deleteAccount(showDeleteConfirmAccount);
                  setShowDeleteConfirmAccount(null);
                  showToast('Hesap silindi', 'success');
                }}
                className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-8 pt-8 pb-6 flex justify-between items-center border-b border-white/5">
              <h2 className="text-2xl font-black text-stone-100 tracking-tight">
                {editingAccount ? 'Hesabı Düzenle' : 'Yeni Hesap Ekle'}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X size={24} className="text-stone-500" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex gap-2 p-1 bg-stone-950 rounded-2xl border border-white/5">
                <button 
                  type="button"
                  onClick={() => setAccountType('CASH')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${accountType === 'CASH' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500'}`}
                >
                  Nakit Kasa
                </button>
                <button 
                  type="button"
                  onClick={() => setAccountType('BANK')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${accountType === 'BANK' ? 'bg-stone-800 text-blue-400 shadow-sm' : 'text-stone-500'}`}
                >
                  Banka Hesabı
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Hesap Adı</label>
                  <input 
                    type="text"
                    placeholder="Örn: Merkez Kasa, Ziraat Bankası"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-medium"
                  />
                </div>

                {accountType === 'BANK' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">Hesap Sahibi</label>
                      <input 
                        type="text"
                        placeholder="Örn: MKS Tarım Ltd. Şti."
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        className="w-full px-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">IBAN Numarası</label>
                      <input 
                        type="text"
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                        value={iban}
                        onChange={(e) => setIban(e.target.value)}
                        className="w-full px-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-8 pb-8 flex gap-3">
              <button 
                type="button"
                onClick={resetForm}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-stone-500 hover:bg-white/5 transition-all"
              >
                Vazgeç
              </button>
              <button 
                type="button"
                onClick={handleSaveAccount}
                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 shadow-xl shadow-emerald-900/20 transition-all active:scale-95"
              >
                {editingAccount ? 'Güncelle' : 'Hesap Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


import React, { useState, useMemo } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Account, Transaction } from '../types';
import { 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Share2, 
  Trash2, 
  Edit2, 
  Search, 
  Filter, 
  CreditCard, 
  Banknote, 
  History,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  X,
  Check,
  Info
} from 'lucide-react';

interface KasaProps {
  onBack: () => void;
}

export const Kasa: React.FC<KasaProps> = ({ onBack }) => {
  const { 
    accounts, 
    transactions, 
    addAccount, 
    updateAccount, 
    deleteAccount, 
    addTransaction, 
    deleteTransaction,
    showToast,
    hapticFeedback
  } = useAppViewModel();

  const [viewMode, setViewMode] = useState<'ACCOUNTS' | 'TRANSACTIONS'>('ACCOUNTS');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  // Form states
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'CASH' | 'BANK'>('CASH');
  const [iban, setIban] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           tx.category?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'ALL' || tx.type === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [transactions, searchTerm, filterType]);

  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + curr.balance, 0);
  }, [accounts]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleAddAccount = async () => {
    if (!accountName) {
      showToast('Lütfen hesap adı giriniz', 'error');
      return;
    }

    try {
      const bankData = accountType === 'BANK' ? {
        iban,
        accountHolder
      } : {};

      if (editingAccount) {
        await updateAccount({
          ...editingAccount,
          name: accountName,
          type: accountType,
          ...bankData
        });
        showToast('Hesap güncellendi', 'success');
      } else {
        await addAccount({
          name: accountName,
          type: accountType,
          ...bankData
        });
        showToast('Hesap oluşturuldu', 'success');
      }
      resetForm();
      hapticFeedback('success');
    } catch (e) {
      showToast('İşlem başarısız oldu', 'error');
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
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };

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
            <p className="text-stone-500 mt-1 font-medium">Finansal durumunuzu yönetin</p>
          </div>
          <button 
            onClick={() => setShowAddAccount(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
          >
            <Plus size={24} />
          </button>
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
            İşlemler
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {viewMode === 'ACCOUNTS' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {accounts.map(account => (
              <div key={account.id} className="bg-stone-900 rounded-3xl p-6 border border-white/5 hover:border-white/10 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${account.type === 'CASH' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                      {account.type === 'CASH' ? <Banknote size={28} /> : <CreditCard size={28} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-100 text-lg">{account.name}</h3>
                      <p className="text-stone-500 text-[10px] font-black uppercase tracking-wider">{account.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabı'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEditAccount(account)}
                      className="p-2 hover:bg-white/5 rounded-xl text-stone-500 hover:text-blue-400 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(account.id)}
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
                        onClick={() => shareIban(account)}
                        className="ml-4 bg-emerald-500/10 text-emerald-500 p-3 rounded-2xl hover:bg-emerald-500/20 transition-colors active:scale-90"
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
                  placeholder="İşlem ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-900 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                />
              </div>
              <div className="flex gap-2">
                {(['ALL', 'INCOME', 'EXPENSE'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === type ? 'bg-stone-100 text-stone-900 shadow-lg' : 'bg-stone-900 text-stone-500 border border-white/5 hover:border-white/10'}`}
                  >
                    {type === 'ALL' ? 'Tümü' : type === 'INCOME' ? 'Giriş' : 'Çıkış'}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction List */}
            <div className="bg-stone-900 rounded-3xl border border-white/5 overflow-hidden">
              {filteredTransactions.map((tx, idx) => {
                const account = accounts.find(a => a.id === tx.accountId);
                return (
                  <div key={tx.id} className={`p-5 flex items-center justify-between hover:bg-white/5 transition-colors ${idx !== filteredTransactions.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {tx.type === 'INCOME' ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-100">{tx.description}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">{tx.category || 'Genel'}</span>
                          <span className="w-1 h-1 bg-stone-800 rounded-full"></span>
                          <span className="text-[10px] font-medium text-stone-400">{account?.name || 'Bilinmeyen Hesap'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-lg font-mono ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <p className="text-[10px] font-bold text-stone-500 mt-0.5 font-mono">
                        {new Date(tx.date).toLocaleDateString('tr-TR')}
                      </p>
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
                  onClick={() => setAccountType('CASH')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${accountType === 'CASH' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500'}`}
                >
                  Nakit Kasa
                </button>
                <button 
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
                        placeholder="Ad Soyad"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        className="w-full px-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2 ml-1">IBAN</label>
                      <input 
                        type="text"
                        placeholder="TR00 0000..."
                        value={iban}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\s/g, '').toUpperCase();
                          const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                          if (formatted.length <= 32) setIban(formatted);
                        }}
                        className="w-full px-5 py-4 bg-stone-950 border border-white/5 rounded-2xl text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-8 pb-8 flex gap-3">
              <button 
                onClick={resetForm}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-stone-500 hover:bg-white/5 transition-all"
              >
                Vazgeç
              </button>
              <button 
                onClick={handleAddAccount}
                className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 shadow-xl shadow-emerald-900/20 transition-all active:scale-95"
              >
                {editingAccount ? 'Güncelle' : 'Hesabı Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-stone-900 w-full max-w-sm rounded-[2.5rem] border border-white/10 p-8 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={40} />
            </div>
            <h3 className="text-xl font-black text-stone-100 mb-2">Hesabı Sil?</h3>
            <p className="text-stone-500 text-sm mb-8">Bu işlem geri alınamaz ve tüm işlem geçmişi silinecektir.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-stone-500 hover:bg-white/5 transition-all"
              >
                Vazgeç
              </button>
              <button 
                onClick={() => {
                  deleteAccount(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                  showToast('Hesap silindi', 'success');
                  hapticFeedback('medium');
                }}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 shadow-xl shadow-rose-900/20 transition-all active:scale-95"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

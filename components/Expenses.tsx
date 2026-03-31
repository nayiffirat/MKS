
import React, { useState, useMemo } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Expense } from '../types';
import { Plus, Trash2, Receipt, Calendar, Tag, ChevronLeft, AlertCircle, TrendingDown, User, Edit2, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';

interface ExpensesProps {
  onBack: () => void;
}

const EXPENSE_CATEGORIES = [
  { id: 'RENT', label: 'Kira', color: 'bg-blue-500' },
  { id: 'ELECTRICITY', label: 'Elektrik', color: 'bg-yellow-500' },
  { id: 'WATER', label: 'Su', color: 'bg-cyan-500' },
  { id: 'FUEL', label: 'Yakıt', color: 'bg-orange-500' },
  { id: 'SALARY', label: 'Maaş', color: 'bg-purple-500' },
  { id: 'TAX', label: 'Vergi', color: 'bg-red-500' },
  { id: 'HOME', label: 'Ev', color: 'bg-teal-500' },
  { id: 'OTHER', label: 'Diğer', color: 'bg-stone-500' },
] as const;

export const ExpensesScreen: React.FC<ExpensesProps> = ({ onBack }) => {
  const { expenses, addExpense, updateExpense, deleteExpense, stats, hapticFeedback, accounts, userProfile, activeTeamMember, teamMembers } = useAppViewModel();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id'>>({
    title: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'OTHER',
    note: '',
    accountId: ''
  });

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(c => totals[c.id] = 0);
    expenses.forEach(e => {
      if (totals[e.category] !== undefined) {
        totals[e.category] += e.amount;
      } else {
        totals['OTHER'] = (totals['OTHER'] || 0) + e.amount;
      }
    });
    return totals;
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    if (!selectedCategory) return expenses;
    return expenses.filter(e => e.category === selectedCategory);
  }, [expenses, selectedCategory]);

  const handleOpenAddModal = () => {
    setNewExpense({
      title: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: (selectedCategory as any) || 'OTHER',
      note: '',
      accountId: ''
    });
    setIsAddModalOpen(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.title || newExpense.amount <= 0) return;

    await addExpense({
        ...newExpense,
        createdById: activeTeamMember?.id
    });
    await hapticFeedback('success');
    setIsAddModalOpen(false);
    setNewExpense({
      title: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'OTHER',
      note: '',
      accountId: ''
    });
  };

  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense || !editingExpense.title || editingExpense.amount <= 0) return;

    const updatedExpense = {
      ...editingExpense,
      date: new Date(editingExpense.date).toISOString()
    };

    await updateExpense(updatedExpense);
    await hapticFeedback('success');
    setEditingExpense(null);
    setSelectedExpense(updatedExpense); // Update details view
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) {
      await deleteExpense(id);
      await hapticFeedback('medium');
      if (selectedExpense?.id === id) {
        setSelectedExpense(null);
      }
    }
  };

  const getCategoryLabel = (catId: string) => {
    return EXPENSE_CATEGORIES.find(c => c.id === catId)?.label || 'Diğer';
  };

  const getCategoryColor = (catId: string) => {
    return EXPENSE_CATEGORIES.find(c => c.id === catId)?.color || 'bg-stone-500';
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-stone-950/80 backdrop-blur-md border-b border-stone-800 px-4 py-4 flex items-center gap-4">
        <button 
          onClick={() => selectedCategory ? setSelectedCategory(null) : onBack()}
          className="p-2 hover:bg-stone-900 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold flex-1">
          {selectedCategory ? `${getCategoryLabel(selectedCategory)} Giderleri` : 'İşletme Giderleri'}
        </h1>
        <button 
          onClick={handleOpenAddModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl transition-all active:scale-95 flex items-center gap-2 px-4"
        >
          <Plus size={20} />
          <span className="text-sm font-bold">Gider Ekle</span>
        </button>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {!selectedCategory && (
          <>
            {/* Stats Card */}
            <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <TrendingDown size={120} className="text-rose-500" />
              </div>
              <div className="relative z-10">
                <p className="text-stone-400 text-sm font-medium mb-1">Toplam Yıllık Gider</p>
                <h2 className="text-4xl font-black text-rose-500 tracking-tight">
                  {formatCurrency(stats.totalExpenses, userProfile?.currency || 'TRY')}
                </h2>
                <div className="mt-4 flex items-center gap-2 text-xs text-stone-500 bg-stone-950/50 w-fit px-3 py-1.5 rounded-full border border-stone-800">
                  <AlertCircle size={14} />
                  <span>Net kar hesabı için tüm giderlerinizi girmeniz önerilir.</span>
                </div>
              </div>
            </div>

            {/* Categories Grid */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider px-2">Gider Kategorileri</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXPENSE_CATEGORIES.map(cat => (
                  <motion.div
                    key={cat.id}
                    layout
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-stone-800/50 transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center text-white shadow-lg`}>
                      <Receipt size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-stone-100">{cat.label}</h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {expenses.filter(e => e.category === cat.id).length} İşlem
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <p className="font-bold text-rose-500">
                        {formatCurrency(categoryTotals[cat.id] || 0, userProfile?.currency || 'TRY')}
                      </p>
                      <ChevronRight size={18} className="text-stone-600" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Expenses List for Selected Category */}
        {selectedCategory && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">
                {getCategoryLabel(selectedCategory)} Kayıtları
              </h3>
              <span className="text-sm font-bold text-rose-500">
                Toplam: {formatCurrency(categoryTotals[selectedCategory] || 0, userProfile?.currency || 'TRY')}
              </span>
            </div>
            
            {filteredExpenses.length === 0 ? (
              <div className="bg-stone-900/50 border border-dashed border-stone-800 rounded-2xl p-12 text-center">
                <Receipt size={48} className="mx-auto text-stone-700 mb-4" />
                <p className="text-stone-500">Bu kategoride henüz kaydedilmiş bir gider yok.</p>
              </div>
            ) : (
              filteredExpenses.map((expense) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={expense.id}
                  onClick={() => setSelectedExpense(expense)}
                  className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center gap-4 group cursor-pointer hover:bg-stone-800/50 transition-colors"
                >
                  <div className={`w-12 h-12 rounded-xl ${getCategoryColor(expense.category)} flex items-center justify-center text-white shadow-lg`}>
                    <Receipt size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold truncate">{expense.title}</h4>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(expense.date).toLocaleDateString('tr-TR')}
                      </span>
                      <span className="flex items-center bg-stone-800/50 px-1.5 py-0.5 rounded text-[10px] font-bold text-stone-400">
                        <User size={10} className="mr-1" />
                        {expense.createdById ? (teamMembers.find(m => m.id === expense.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-500">
                      -{formatCurrency(expense.amount, userProfile?.currency || 'TRY')}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-stone-900 rounded-t-[2rem] sm:rounded-[2rem] border border-stone-800 shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black">Yeni Gider Kaydı</h2>
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-2 hover:bg-stone-800 rounded-full"
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Gider Başlığı</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                      <input 
                        type="text"
                        required
                        placeholder="Örn: Ofis Kirası, Elektrik Faturası..."
                        className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={newExpense.title}
                        onChange={e => setNewExpense({...newExpense, title: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Tutar ({getCurrencySymbol(userProfile?.currency || 'TRY')})</label>
                      <input 
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-rose-500"
                        value={newExpense.amount || ''}
                        onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Tarih</label>
                      <input 
                        type="date"
                        required
                        className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={newExpense.date}
                        onChange={e => setNewExpense({...newExpense, date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Hesap Seçin</label>
                    <select 
                      className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                      value={newExpense.accountId}
                      onChange={e => setNewExpense({...newExpense, accountId: e.target.value})}
                    >
                      <option value="">Hesap Seçilmedi</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: userProfile.currency || 'TRY' }).format(acc.balance)})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Kategori</label>
                    <div className="grid grid-cols-3 gap-2">
                      {EXPENSE_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewExpense({...newExpense, category: cat.id as any})}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all ${
                            newExpense.category === cat.id 
                              ? 'bg-emerald-600 border-emerald-500 text-white' 
                              : 'bg-stone-950 border-stone-800 text-stone-500 hover:border-stone-700'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Not (Opsiyonel)</label>
                    <textarea 
                      className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-24"
                      placeholder="Eklemek istediğiniz detaylar..."
                      value={newExpense.note}
                      onChange={e => setNewExpense({...newExpense, note: e.target.value})}
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] mt-2"
                  >
                    Gideri Kaydet
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Selected Expense Details Modal */}
      <AnimatePresence>
        {selectedExpense && !editingExpense && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedExpense(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Gider Detayı</h3>
                  <button 
                    onClick={() => setSelectedExpense(null)}
                    className="p-2 bg-stone-800 hover:bg-stone-700 rounded-full text-stone-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl ${getCategoryColor(selectedExpense.category)} flex items-center justify-center text-white shadow-lg`}>
                      <Receipt size={32} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-white">{selectedExpense.title}</h4>
                      <span className="inline-block mt-1 text-xs px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 font-bold uppercase">
                        {getCategoryLabel(selectedExpense.category)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-stone-950 rounded-2xl p-5 space-y-4 border border-stone-800">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500 text-sm font-medium">Tutar</span>
                      <span className="text-xl font-bold text-rose-500">
                        -{formatCurrency(selectedExpense.amount, userProfile?.currency || 'TRY')}
                      </span>
                    </div>
                    <div className="h-px bg-stone-800" />
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500 text-sm font-medium">Tarih</span>
                      <span className="text-stone-300 font-medium">
                        {new Date(selectedExpense.date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <div className="h-px bg-stone-800" />
                    <div className="flex justify-between items-center">
                      <span className="text-stone-500 text-sm font-medium">Ekleyen</span>
                      <span className="text-stone-300 font-medium">
                        {selectedExpense.createdById ? (teamMembers.find(m => m.id === selectedExpense.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                      </span>
                    </div>
                    {selectedExpense.accountId && (
                      <>
                        <div className="h-px bg-stone-800" />
                        <div className="flex justify-between items-center">
                          <span className="text-stone-500 text-sm font-medium">Hesap</span>
                          <span className="text-stone-300 font-medium">
                            {accounts.find(a => a.id === selectedExpense.accountId)?.name || 'Bilinmeyen Hesap'}
                          </span>
                        </div>
                      </>
                    )}
                    {selectedExpense.note && (
                      <>
                        <div className="h-px bg-stone-800" />
                        <div>
                          <span className="block text-stone-500 text-sm font-medium mb-2">Not</span>
                          <p className="text-stone-300 text-sm leading-relaxed bg-stone-900 p-3 rounded-xl border border-stone-800">
                            {selectedExpense.note}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setEditingExpense(selectedExpense)}
                      className="flex-1 bg-stone-800 hover:bg-stone-700 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit2 size={18} />
                      Düzenle
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedExpense.id)}
                      className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-rose-500/20"
                    >
                      <Trash2 size={18} />
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Expense Modal */}
      <AnimatePresence>
        {editingExpense && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingExpense(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-stone-800 flex justify-between items-center bg-stone-900/50 backdrop-blur-md sticky top-0 z-10">
                <h3 className="text-xl font-bold text-white">Gideri Düzenle</h3>
                <button 
                  onClick={() => setEditingExpense(null)}
                  className="p-2 bg-stone-800 hover:bg-stone-700 rounded-full text-stone-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar">
                <form onSubmit={handleEditExpense} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Gider Başlığı</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white font-medium"
                      placeholder="Örn: Ofis Kirası"
                      value={editingExpense.title}
                      onChange={e => setEditingExpense({...editingExpense, title: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Tutar</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 font-bold">
                          {getCurrencySymbol(userProfile?.currency || 'TRY')}
                        </span>
                        <input 
                          type="number" 
                          required
                          min="0.01"
                          step="0.01"
                          className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white font-bold"
                          placeholder="0.00"
                          value={editingExpense.amount || ''}
                          onChange={e => setEditingExpense({...editingExpense, amount: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Tarih</label>
                      <input 
                        type="date" 
                        required
                        className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white font-medium"
                        value={editingExpense.date.split('T')[0]}
                        onChange={e => setEditingExpense({...editingExpense, date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Ödenen Hesap (Opsiyonel)</label>
                    <select 
                      className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-white font-medium appearance-none"
                      value={editingExpense.accountId || ''}
                      onChange={e => setEditingExpense({...editingExpense, accountId: e.target.value})}
                    >
                      <option value="">Hesap Seçilmedi</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: userProfile.currency || 'TRY' }).format(acc.balance)})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Kategori</label>
                    <div className="grid grid-cols-3 gap-2">
                      {EXPENSE_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setEditingExpense({...editingExpense, category: cat.id as any})}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all ${
                            editingExpense.category === cat.id 
                              ? 'bg-emerald-600 border-emerald-500 text-white' 
                              : 'bg-stone-950 border-stone-800 text-stone-500 hover:border-stone-700'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Not (Opsiyonel)</label>
                    <textarea 
                      className="w-full bg-stone-950 border border-stone-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-24"
                      placeholder="Eklemek istediğiniz detaylar..."
                      value={editingExpense.note || ''}
                      onChange={e => setEditingExpense({...editingExpense, note: e.target.value})}
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] mt-2"
                  >
                    Değişiklikleri Kaydet
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

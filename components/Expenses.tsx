
import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Expense } from '../types';
import { Plus, Trash2, Receipt, Calendar, Tag, ChevronLeft, AlertCircle, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  { id: 'OTHER', label: 'Diğer', color: 'bg-stone-500' },
] as const;

export const ExpensesScreen: React.FC<ExpensesProps> = ({ onBack }) => {
  const { expenses, addExpense, deleteExpense, stats, hapticFeedback, accounts } = useAppViewModel();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id'>>({
    title: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'OTHER',
    note: '',
    accountId: ''
  });

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.title || newExpense.amount <= 0) return;

    await addExpense(newExpense);
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

  const handleDelete = async (id: string) => {
    if (window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) {
      await deleteExpense(id);
      await hapticFeedback('medium');
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
          onClick={onBack}
          className="p-2 hover:bg-stone-900 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold flex-1">İşletme Giderleri</h1>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-xl transition-all active:scale-95 flex items-center gap-2 px-4"
        >
          <Plus size={20} />
          <span className="text-sm font-bold">Gider Ekle</span>
        </button>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Stats Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <TrendingDown size={120} className="text-rose-500" />
          </div>
          <div className="relative z-10">
            <p className="text-stone-400 text-sm font-medium mb-1">Toplam Yıllık Gider</p>
            <h2 className="text-4xl font-black text-rose-500 tracking-tight">
              {stats.totalExpenses.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
            </h2>
            <div className="mt-4 flex items-center gap-2 text-xs text-stone-500 bg-stone-950/50 w-fit px-3 py-1.5 rounded-full border border-stone-800">
              <AlertCircle size={14} />
              <span>Net kar hesabı için tüm giderlerinizi girmeniz önerilir.</span>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider px-2">Son Giderler</h3>
          {expenses.length === 0 ? (
            <div className="bg-stone-900/50 border border-dashed border-stone-800 rounded-2xl p-12 text-center">
              <Receipt size={48} className="mx-auto text-stone-700 mb-4" />
              <p className="text-stone-500">Henüz kaydedilmiş bir gider yok.</p>
            </div>
          ) : (
            expenses.map((expense) => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={expense.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center gap-4 group"
              >
                <div className={`w-12 h-12 rounded-xl ${getCategoryColor(expense.category)} flex items-center justify-center text-white shadow-lg`}>
                  <Receipt size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold truncate">{expense.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-bold uppercase">
                      {getCategoryLabel(expense.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(expense.date).toLocaleDateString('tr-TR')}
                    </span>
                    {expense.note && (
                      <span className="truncate italic">
                        - {expense.note}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-rose-500">
                    -{expense.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                  </p>
                  <button 
                    onClick={() => handleDelete(expense.id)}
                    className="p-2 text-stone-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
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
                      <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5 ml-1">Tutar (₺)</label>
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
                        <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(acc.balance)})</option>
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
    </div>
  );
};

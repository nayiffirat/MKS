
import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { MyPayment } from '../types';
import { 
    CreditCard, Calendar, CheckCircle2, AlertCircle, 
    Search, Filter, Plus, Trash2, Clock, 
    ArrowLeft, ChevronRight, Check, X, DollarSign,
    TrendingDown, CalendarClock
} from 'lucide-react';

interface PaymentsProps {
    onBack?: () => void;
}

export const Payments: React.FC<PaymentsProps> = ({ onBack }) => {
    const { myPayments, updateMyPayment, deleteMyPayment, showToast, hapticFeedback } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

    const getLedColor = (payment: MyPayment) => {
        if (payment.status === 'PAID') return 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(payment.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]';
        if (diffDays <= 3) return 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]';
        
        return 'border-white/5';
    };

    const handleTogglePaid = async (payment: MyPayment) => {
        const newStatus = payment.status === 'PAID' ? 'PENDING' : 'PAID';
        await updateMyPayment({ ...payment, status: newStatus });
        showToast(newStatus === 'PAID' ? 'Ödeme ödendi olarak işaretlendi' : 'Ödeme bekliyor olarak işaretlendi', 'success');
        hapticFeedback('success');
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) {
            await deleteMyPayment(id);
            showToast('Ödeme kaydı silindi', 'info');
            hapticFeedback('medium');
        }
    };

    const filteredPayments = myPayments.filter(p => {
        const matchesSearch = p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (p.note || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'ALL' || 
                             (filter === 'PAID' && p.status === 'PAID') || 
                             (filter === 'PENDING' && p.status === 'PENDING');
        return matchesSearch && matchesFilter;
    });

    const pendingCount = myPayments.filter(p => p.status === 'PENDING').length;
    const totalPendingAmount = myPayments.filter(p => p.status === 'PENDING').reduce((acc, p) => acc + p.amount, 0);

    return (
        <div className="min-h-screen bg-stone-950 pb-24">
            {/* Header */}
            <div className="bg-stone-900/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 px-4 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button onClick={onBack} className="p-2 bg-stone-800 rounded-xl text-stone-400">
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <div>
                            <h1 className="text-xl font-black text-white tracking-tight">Ödemelerim</h1>
                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Çek, Senet ve Vadeli Ödemeler</p>
                        </div>
                    </div>
                    <div className="bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                            {pendingCount} Bekleyen
                        </span>
                    </div>
                </div>

                {/* Search & Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                        <input 
                            type="text"
                            placeholder="Tedarikçi veya not ara..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-stone-950 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-emerald-500/30 transition-all"
                        />
                    </div>
                    <select 
                        value={filter}
                        onChange={e => setFilter(e.target.value as any)}
                        className="bg-stone-950 border border-white/5 rounded-xl px-3 text-xs font-bold text-stone-400 outline-none"
                    >
                        <option value="ALL">Tümü</option>
                        <option value="PENDING">Bekleyen</option>
                        <option value="PAID">Ödenen</option>
                    </select>
                </div>
            </div>

            <div className="px-4 py-6 space-y-6">
                {/* Summary Card */}
                <div className="bg-gradient-to-br from-stone-900 to-stone-950 p-5 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingDown size={14} className="text-rose-500" />
                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Toplam Bekleyen Ödeme</span>
                        </div>
                        <div className="text-3xl font-black text-white tracking-tighter">
                            {totalPendingAmount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                        </div>
                    </div>
                </div>

                {/* Payments List */}
                <div className="grid gap-4">
                    {filteredPayments.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-stone-600">
                            <CreditCard size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-bold uppercase tracking-widest">Kayıtlı ödeme bulunamadı</p>
                        </div>
                    ) : (
                        filteredPayments.map(payment => (
                            <div 
                                key={payment.id}
                                className={`bg-stone-900/40 rounded-2xl border-2 p-4 transition-all duration-300 relative overflow-hidden ${getLedColor(payment)}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${payment.type === 'CHECK' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                            <CreditCard size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white leading-tight">{payment.supplierName}</h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">
                                                    {payment.type === 'CHECK' ? 'ÇEK' : 'SENET'}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-stone-700"></span>
                                                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">
                                                    {new Date(payment.dueDate).toLocaleDateString('tr-TR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-white tracking-tight">
                                            {payment.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                        </div>
                                        <div className="flex items-center justify-end gap-1 mt-0.5">
                                            <Clock size={10} className="text-stone-600" />
                                            <span className="text-[9px] font-bold text-stone-600 uppercase">
                                                Vade: {new Date(payment.dueDate).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {payment.note && (
                                    <div className="bg-stone-950/50 p-2 rounded-lg mb-4">
                                        <p className="text-[11px] text-stone-400 italic">"{payment.note}"</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                    <button 
                                        onClick={() => handleTogglePaid(payment)}
                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                            payment.status === 'PAID'
                                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                            : 'bg-stone-800 text-stone-400 border border-white/5 hover:bg-stone-700'
                                        }`}
                                    >
                                        {payment.status === 'PAID' ? <CheckCircle2 size={14} /> : <Check size={14} />}
                                        {payment.status === 'PAID' ? 'ÖDENDİ' : 'ÖDENDİ İŞARETLE'}
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(payment.id)}
                                        className="p-2 bg-stone-800 text-stone-500 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all border border-white/5"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

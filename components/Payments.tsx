
import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { MyPayment } from '../types';
import { 
    CreditCard, Calendar, CheckCircle2, AlertCircle, 
    Search, Filter, Plus, Trash2, Clock, 
    ArrowLeft, ChevronRight, Check, X, DollarSign,
    TrendingDown, TrendingUp, CalendarClock, Wallet
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';

interface PaymentsProps {
    onBack?: () => void;
}

export const Payments: React.FC<PaymentsProps> = ({ onBack }) => {
    const { 
        myPayments, updateMyPayment, deleteMyPayment, addMyPayment,
        showToast, hapticFeedback, userProfile, stats,
        farmers, suppliers, t
    } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
    const [activeTab, setActiveTab] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES');
    const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({
        type: 'CHECK' as MyPayment['type'],
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        note: '',
        targetId: '', // farmerId or supplierId
        targetName: '', // custom name if not selected from list
        isManualTarget: false
    });

    const handleAddPayment = async () => {
        if (!newPayment.amount || (!newPayment.targetId && !newPayment.targetName)) {
            showToast('Lütfen tüm alanları doldurun', 'error');
            return;
        }

        const amount = parseFloat(newPayment.amount.replace(',', '.')) || 0;
        if (isNaN(amount) || amount <= 0) {
            showToast('Geçerli bir tutar girin', 'error');
            return;
        }

        const paymentData: any = {
            amount,
            issueDate: new Date().toISOString(),
            dueDate: new Date(newPayment.dueDate).toISOString(),
            type: newPayment.type,
            status: 'PENDING',
            note: newPayment.note,
        };

        if (activeTab === 'RECEIVABLES') {
            if (newPayment.isManualTarget) {
                paymentData.farmerName = newPayment.targetName;
            } else {
                const farmer = farmers.find(f => f.id === newPayment.targetId);
                paymentData.farmerId = newPayment.targetId;
                paymentData.farmerName = farmer?.fullName || newPayment.targetName;
            }
        } else {
            if (newPayment.isManualTarget) {
                paymentData.supplierName = newPayment.targetName;
            } else {
                const supplier = suppliers.find(s => s.id === newPayment.targetId);
                paymentData.supplierId = newPayment.targetId;
                paymentData.supplierName = supplier?.name || newPayment.targetName;
            }
        }

        try {
            await addMyPayment(paymentData);
            showToast('Ödeme kaydı eklendi', 'success');
            hapticFeedback('success');
            setIsAddModalOpen(false);
            setNewPayment({
                type: 'CHECK',
                amount: '',
                dueDate: new Date().toISOString().split('T')[0],
                note: '',
                targetId: '',
                targetName: '',
                isManualTarget: false
            });
        } catch (error) {
            console.error('Add payment error:', error);
            showToast('Ödeme eklenirken bir hata oluştu', 'error');
        }
    };

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
        const isReceivable = !!payment.farmerId || !!payment.farmerName;
        const msg = newStatus === 'PAID' 
            ? (isReceivable ? 'Tahsil edildi olarak işaretlendi' : 'Ödeme ödendi olarak işaretlendi')
            : 'Bekliyor olarak işaretlendi';
        showToast(msg, 'success');
        hapticFeedback('success');
    };

    const handleDelete = async (id: string) => {
        setPaymentToDelete(id);
    };

    const confirmDelete = async () => {
        if (paymentToDelete) {
            await deleteMyPayment(paymentToDelete);
            showToast('Ödeme kaydı silindi', 'info');
            hapticFeedback('medium');
            setPaymentToDelete(null);
        }
    };

    const tabFilteredPayments = myPayments.filter(p => {
        if (activeTab === 'RECEIVABLES') return !!p.farmerId || !!p.farmerName;
        return !!p.supplierId || !!p.supplierName;
    });

    const filteredPayments = tabFilteredPayments.filter(p => {
        const name = (p.supplierName || p.farmerName || '').toLocaleLowerCase('tr-TR');
        const matchesSearch = name.includes(searchTerm.toLocaleLowerCase('tr-TR')) || 
                             (p.note || '').toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'));
        const matchesFilter = filter === 'ALL' || 
                             (filter === 'PAID' && p.status === 'PAID') || 
                             (filter === 'PENDING' && p.status === 'PENDING');
        return matchesSearch && matchesFilter;
    });

    const pendingCount = tabFilteredPayments.filter(p => p.status === 'PENDING').length;
    const totalPendingAmount = tabFilteredPayments.filter(p => p.status === 'PENDING').reduce((acc, p) => acc + p.amount, 0);

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
                            <h1 className="text-xl font-black text-white tracking-tight">Çek, Senet, Tedye</h1>
                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Müşteri Alacakları ve Ödemelerim</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                        >
                            <Plus size={16} />
                            Ödeme Ekle
                        </button>
                        <div className={`px-3 py-1.5 rounded-full border ${activeTab === 'RECEIVABLES' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'RECEIVABLES' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {pendingCount} Bekleyen
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-stone-950/50 backdrop-blur rounded-xl mb-4 border border-white/5 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('RECEIVABLES')} 
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'RECEIVABLES' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                        Müşteri Alacakları
                    </button>
                    <button 
                        onClick={() => setActiveTab('PAYABLES')} 
                        className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 ${activeTab === 'PAYABLES' ? 'bg-rose-600 text-white shadow-md' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                        Tedarikçi Ödemeleri
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                        <input 
                            type="text"
                            placeholder="İsim veya not ara..."
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
                {/* Net Financial Status */}
                <div className="bg-stone-900/60 border border-white/5 rounded-3xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Wallet size={16} className="text-stone-400" />
                            <h3 className="text-xs font-black text-stone-300 uppercase tracking-widest">Net Finansal Durum</h3>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Bekleyen Alacaklar</span>
                            <span className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(stats.totalPendingReceivables || 0, userProfile?.currency || 'TRY')}</span>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Bekleyen Ödemeler</span>
                            <span className="text-lg font-black text-rose-400 font-mono">{formatCurrency(stats.totalPendingPayables || 0, userProfile?.currency || 'TRY')}</span>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                        <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest block mb-1">Net Bakiye (Alacak - Ödeme)</span>
                        <span className={`text-2xl font-black font-mono ${((stats.totalPendingReceivables || 0) - (stats.totalPendingPayables || 0)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatCurrency(((stats.totalPendingReceivables || 0) - (stats.totalPendingPayables || 0)), userProfile?.currency || 'TRY')}
                        </span>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-stone-900 to-stone-950 p-5 rounded-3xl border border-white/5 shadow-xl relative overflow-hidden group">
                    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl transition-all duration-500 ${activeTab === 'RECEIVABLES' ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' : 'bg-rose-500/10 group-hover:bg-rose-500/20'}`}></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-1">
                            {activeTab === 'RECEIVABLES' ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-rose-500" />}
                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                {activeTab === 'RECEIVABLES' ? 'Toplam Bekleyen Tahsilat' : 'Toplam Bekleyen Ödeme'}
                            </span>
                        </div>
                        <div className="text-3xl font-black text-white tracking-tighter">
                            {formatCurrency(totalPendingAmount, userProfile?.currency || 'TRY')}
                        </div>
                    </div>
                </div>

                {/* Payments List */}
                <div className="grid gap-4">
                    {filteredPayments.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-stone-600">
                            <CreditCard size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-bold uppercase tracking-widest">
                                {activeTab === 'RECEIVABLES' ? 'Kayıtlı tahsilat bulunamadı' : 'Kayıtlı ödeme bulunamadı'}
                            </p>
                        </div>
                    ) : (
                        filteredPayments.map(payment => (
                            <div 
                                key={payment.id}
                                className={`bg-stone-900/40 rounded-2xl border-2 p-4 transition-all duration-300 relative overflow-hidden ${getLedColor(payment)}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${
                                            payment.farmerId || payment.farmerName ? 'bg-emerald-500/10 text-emerald-500' : 
                                            payment.type === 'CHECK' ? 'bg-blue-500/10 text-blue-500' : 
                                            payment.type === 'CARD_INSTALLMENT' ? 'bg-orange-500/10 text-orange-500' :
                                            payment.type === 'DEFERRED_CARD' ? 'bg-amber-500/10 text-amber-500' :
                                            'bg-purple-500/10 text-purple-500'
                                        }`}>
                                            {payment.farmerId || payment.farmerName ? <CalendarClock size={20} /> : 
                                             (payment.type === 'CARD_INSTALLMENT' || payment.type === 'DEFERRED_CARD') ? <CreditCard size={20} /> :
                                             <DollarSign size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white leading-tight">{payment.supplierName || payment.farmerName}</h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${payment.farmerId || payment.farmerName ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {payment.farmerId || payment.farmerName ? 'MÜŞTERİ ALACAĞI' : 'TEDARİKÇİ ÖDEMESİ'}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-stone-700"></span>
                                                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">
                                                    {payment.type === 'CHECK' ? 'ÇEK' : 
                                                     payment.type === 'TEDYE' ? 'TEDYE' : 
                                                     payment.type === 'PROMISSORY_NOTE' ? 'SENET' : 
                                                     payment.type === 'CARD_INSTALLMENT' ? 'KART TAKSİDİ' :
                                                     payment.type === 'DEFERRED_CARD' ? 'ÖTELEMELİ KART' : 'DİĞER'}
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
                                            {formatCurrency(payment.amount, userProfile?.currency || 'TRY')}
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
                                        {payment.status === 'PAID' 
                                            ? (payment.farmerId || payment.farmerName ? 'TAHSİL EDİLDİ' : 'ÖDENDİ') 
                                            : (payment.farmerId || payment.farmerName ? 'TAHSİL EDİLDİ İŞARETLE' : 'ÖDENDİ İŞARETLE')}
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

            <ConfirmationModal
                isOpen={!!paymentToDelete}
                onClose={() => setPaymentToDelete(null)}
                onConfirm={confirmDelete}
                title="Ödeme Kaydı Silinecek"
                message="Bu ödeme kaydını silmek istediğinize emin misiniz?"
            />

            {/* Add Payment Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-stone-100 flex items-center gap-3">
                                <Plus className="text-emerald-500" />
                                {activeTab === 'RECEIVABLES' ? 'Yeni Alacak Kaydı' : 'Yeni Ödeme Kaydı'}
                            </h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-400">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ödeme Tipi</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { id: 'CHECK', label: 'Çek' },
                                        { id: 'PROMISSORY_NOTE', label: 'Senet' },
                                        { id: 'TEDYE', label: 'Tediye' },
                                        { id: 'CARD_INSTALLMENT', label: 'Kart Taksidi' },
                                        { id: 'DEFERRED_CARD', label: 'Ötelemeli Kart' },
                                        { id: 'OTHER', label: 'Diğer' }
                                    ].map(type => (
                                        <button
                                            key={type.id}
                                            onClick={() => setNewPayment({ ...newPayment, type: type.id as any })}
                                            className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all ${
                                                newPayment.type === type.id 
                                                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                                                : 'bg-stone-950 border-white/5 text-stone-500 hover:border-white/10'
                                            }`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">
                                    {activeTab === 'RECEIVABLES' ? 'Çiftçi / Müşteri' : 'Tedarikçi / Kurum'}
                                </label>
                                <div className="flex flex-col gap-2">
                                    {!newPayment.isManualTarget ? (
                                        <select
                                            value={newPayment.targetId}
                                            onChange={(e) => setNewPayment({ ...newPayment, targetId: e.target.value })}
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                        >
                                            <option value="">Seçiniz...</option>
                                            {activeTab === 'RECEIVABLES' 
                                                ? farmers.map(f => <option key={f.id} value={f.id}>{f.fullName}</option>)
                                                : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                            }
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder="İsim giriniz..."
                                            value={newPayment.targetName}
                                            onChange={(e) => setNewPayment({ ...newPayment, targetName: e.target.value })}
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                        />
                                    )}
                                    <button 
                                        onClick={() => setNewPayment({ ...newPayment, isManualTarget: !newPayment.isManualTarget, targetId: '', targetName: '' })}
                                        className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 text-left ml-1"
                                    >
                                        {newPayment.isManualTarget ? 'Listeden Seç' : 'Elle İsim Gir'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Tutar</label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={newPayment.amount}
                                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Vade Tarihi</label>
                                    <input
                                        type="date"
                                        value={newPayment.dueDate}
                                        onChange={(e) => setNewPayment({ ...newPayment, dueDate: e.target.value })}
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Not</label>
                                <textarea
                                    placeholder="Ödeme detayı..."
                                    value={newPayment.note}
                                    onChange={(e) => setNewPayment({ ...newPayment, note: e.target.value })}
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all h-20 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleAddPayment}
                                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

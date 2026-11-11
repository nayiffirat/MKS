
import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { MyPayment } from '../types';
import { 
    CreditCard, Calendar, CheckCircle2, AlertCircle, 
    Search, Filter, Plus, Trash2, Clock, 
    ArrowLeft, ChevronRight, Check, X, DollarSign,
    TrendingDown, TrendingUp, CalendarClock, Wallet, Share2
} from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';

interface PaymentsProps {
    onBack?: () => void;
}

export const Payments: React.FC<PaymentsProps> = ({ onBack }) => {
    const { 
        myPayments, updateMyPayment, deleteMyPayment, addMyPayment,
        addSupplierPayment,
        showToast, hapticFeedback, userProfile, stats,
        farmers, suppliers, t
    } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
    const [portfolioFilter, setPortfolioFilter] = useState<'ALL' | 'PORTFOLIO' | 'ENDORSED' | 'BOUNCED'>('ALL');
    const [activeTab, setActiveTab] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES');
    const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [endorseTargetPayment, setEndorseTargetPayment] = useState<MyPayment | null>(null);
    const [selectedEndorseSupplierId, setSelectedEndorseSupplierId] = useState('');
    const [endorseNote, setEndorseNote] = useState('');
    const [isEndorsing, setIsEndorsing] = useState(false);
    const [newPayment, setNewPayment] = useState({
        type: 'CHECK' as MyPayment['type'],
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
        note: '',
        targetId: '', // farmerId or supplierId
        targetName: '', // custom name if not selected from list
        isManualTarget: false,
        checkSerialNo: '',
        bankName: '',
        drawerName: ''
    });

    const handleAddPayment = async () => {
        if (isSubmittingPayment) return;
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
            checkSerialNo: newPayment.checkSerialNo.trim() || undefined,
            bankName: newPayment.bankName.trim() || undefined,
            drawerName: newPayment.drawerName.trim() || undefined,
            portfolioStatus: activeTab === 'RECEIVABLES' ? 'PORTFOLIO' : 'ISSUED',
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
            setIsSubmittingPayment(true);
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
                isManualTarget: false,
                checkSerialNo: '',
                bankName: '',
                drawerName: ''
            });
        } catch (error) {
            console.error('Add payment error:', error);
            showToast('Ödeme eklenirken bir hata oluştu', 'error');
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const handleSendReceipt = (payment: MyPayment) => {
        hapticFeedback('medium');
        
        const farmerObj = farmers.find(f => f.id === payment.farmerId);
        const farmerName = payment.farmerName || farmerObj?.fullName || 'Sayın Müşterimiz';
        
        const dateStr = new Date(payment.dueDate).toLocaleDateString('tr-TR');
        const amountStr = formatCurrency(payment.amount, userProfile?.currency || 'TRY');
        const paymentTypeStr = payment.type === 'CHECK' ? 'Çek' : 
                            payment.type === 'TEDYE' ? 'Tediye' : 
                            payment.type === 'PROMISSORY_NOTE' ? 'Senet' : 
                            payment.type === 'CARD_INSTALLMENT' ? 'Kart Taksidi' :
                            payment.type === 'DEFERRED_CARD' ? 'Ötelemeli Kart' : 'Nakit/Diğer';
                            
        const statusStr = payment.status === 'PAID' ? 'Tahsil Edildi' : 'Tahsilat Bekleniyor';
        
        let message = `Merhaba ${farmerName},\n\n`;
        message += `Tahsilat makbuzunuz aşağıdadır:\n`;
        message += `---------------------------------\n`;
        message += `Vade Tarihi: ${dateStr}\n`;
        message += `Tutar: ${amountStr}\n`;
        message += `Ödeme Tipi: ${paymentTypeStr}\n`;
        message += `Durum: ${statusStr}\n`;
        if (payment.note) {
            message += `Not: ${payment.note}\n`;
        }
        message += `---------------------------------\n`;
        message += `Bizi tercih ettiğiniz için teşekkür ederiz.`;

        // Send via WhatsApp or Web Share
        if (navigator.share) {
            navigator.share({
                title: 'Tahsilat Makbuzu',
                text: message
            }).catch((err) => {
                console.log('Ekran paylaşımı iptal edildi veya desteklenmiyor', err);
                fallbackToWhatsApp(farmerObj?.phoneNumber, message);
            });
        } else {
            fallbackToWhatsApp(farmerObj?.phoneNumber, message);
        }
    };

    const fallbackToWhatsApp = (phone: string | undefined, message: string) => {
        const encodedMessage = encodeURIComponent(message);
        let phoneParam = '';
        if (phone) {
            let cleanPhone = phone.replace(/[^0-9+]/g, '');
            if (cleanPhone.startsWith('0')) {
                cleanPhone = '9' + cleanPhone;
            } else if (!cleanPhone.startsWith('+') && cleanPhone.length === 10) {
                cleanPhone = '90' + cleanPhone;
            }
            phoneParam = cleanPhone.replace('+', ''); // wa.me needs number without +
        }
        const whatsappUrl = phoneParam 
            ? `https://wa.me/${phoneParam}?text=${encodedMessage}` 
            : `https://wa.me/?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
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
        const isReceivable = !!payment.farmerId || !!payment.farmerName;
        const nextPortfolioStatus =
            payment.portfolioStatus === 'ENDORSED'
                ? 'ENDORSED'
                : newStatus === 'PAID'
                    ? (isReceivable ? 'COLLECTED' : 'ISSUED')
                    : (isReceivable ? 'PORTFOLIO' : 'ISSUED');
        await updateMyPayment({ ...payment, status: newStatus, portfolioStatus: nextPortfolioStatus });
        const msg = newStatus === 'PAID' 
            ? (isReceivable ? 'Tahsil edildi olarak işaretlendi' : 'Ödeme ödendi olarak işaretlendi')
            : 'Bekliyor olarak işaretlendi';
        showToast(msg, 'success');
        hapticFeedback('success');
    };

    const handleToggleBounced = async (payment: MyPayment) => {
        const isCurrentlyBounced = payment.portfolioStatus === 'BOUNCED';
        await updateMyPayment({
            ...payment,
            status: 'PENDING',
            portfolioStatus: isCurrentlyBounced ? 'PORTFOLIO' : 'BOUNCED'
        });
        showToast(isCurrentlyBounced ? 'Portföye geri alındı' : 'Karşılıksız / Protestolu olarak işaretlendi', isCurrentlyBounced ? 'info' : 'error');
        hapticFeedback('warning');
    };

    const handleConfirmEndorse = async () => {
        if (!endorseTargetPayment || !selectedEndorseSupplierId || isEndorsing) return;
        if (
            endorseTargetPayment.status === 'PAID' ||
            endorseTargetPayment.portfolioStatus === 'BOUNCED' ||
            endorseTargetPayment.portfolioStatus === 'ENDORSED' ||
            endorseTargetPayment.portfolioStatus === 'COLLECTED'
        ) {
            showToast('Tahsil edilmiş, karşılıksız veya zaten ciro edilmiş evrak tekrar ciro edilemez', 'error');
            return;
        }
        const supplier = suppliers.find(s => s.id === selectedEndorseSupplierId);
        if (!supplier) {
            showToast('Lütfen ciro edilecek tedarikçiyi seçin', 'error');
            return;
        }
        try {
            setIsEndorsing(true);
            const docLabel = endorseTargetPayment.type === 'PROMISSORY_NOTE' ? 'Senedi' : 'Çeki';
            const serialPart = endorseTargetPayment.checkSerialNo ? ` • Seri No: ${endorseTargetPayment.checkSerialNo}` : '';
            const bankPart = endorseTargetPayment.bankName ? ` • ${endorseTargetPayment.bankName}` : '';
            const duePart = ` • Vade: ${new Date(endorseTargetPayment.dueDate).toLocaleDateString('tr-TR')}`;
            const extraNote = endorseNote.trim() ? ` (${endorseNote.trim()})` : '';

            await addSupplierPayment({
                supplierId: supplier.id,
                amount: endorseTargetPayment.amount,
                date: new Date().toISOString(),
                method: 'OTHER',
                dueDate: endorseTargetPayment.dueDate,
                isPaid: true,
                note: `Müşteri ${docLabel} Cirosu: ${endorseTargetPayment.farmerName || 'Müşteri'}${serialPart}${bankPart}${duePart}${extraNote}`
            });

            await updateMyPayment({
                ...endorseTargetPayment,
                status: 'PAID',
                accountId: undefined,
                portfolioStatus: 'ENDORSED',
                endorsedToSupplierId: supplier.id,
                endorsedToSupplierName: supplier.name,
                endorsedDate: new Date().toISOString(),
            });

            showToast(`${docLabel} ${supplier.name} carisine ciro edildi ve borçtan düşüldü`, 'success');
            hapticFeedback('success');
            setEndorseTargetPayment(null);
            setSelectedEndorseSupplierId('');
            setEndorseNote('');
        } catch (err) {
            console.error('Endorse error:', err);
            showToast('Ciro işlemi sırasında hata oluştu', 'error');
        } finally {
            setIsEndorsing(false);
        }
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
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const name = (p.supplierName || p.farmerName || '').toLocaleLowerCase('tr-TR');
        const matchesSearch = name.includes(q) || 
                             (p.note || '').toLocaleLowerCase('tr-TR').includes(q) ||
                             (p.checkSerialNo || '').toLocaleLowerCase('tr-TR').includes(q) ||
                             (p.bankName || '').toLocaleLowerCase('tr-TR').includes(q) ||
                             (p.endorsedToSupplierName || '').toLocaleLowerCase('tr-TR').includes(q);
        const matchesFilter = filter === 'ALL' || 
                             (filter === 'PAID' && p.status === 'PAID') || 
                             (filter === 'PENDING' && p.status === 'PENDING');
        const effectivePortfolio = p.portfolioStatus || (p.status === 'PAID' ? 'COLLECTED' : 'PORTFOLIO');
        const matchesPortfolio =
            activeTab !== 'RECEIVABLES' ||
            portfolioFilter === 'ALL' ||
            effectivePortfolio === portfolioFilter;
        return matchesSearch && matchesFilter && matchesPortfolio;
    });

    const pendingCount = tabFilteredPayments.filter(p => p.status === 'PENDING').length;
    const totalPendingAmount = tabFilteredPayments.filter(p => p.status === 'PENDING').reduce((acc, p) => acc + p.amount, 0);

    return (
        <div className="min-h-screen bg-stone-950 pb-24">
            {/* Header */}
            <div className="bg-stone-900/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30 px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {onBack && (
                            <button onClick={onBack} className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center bg-stone-800 rounded-xl text-stone-300 shrink-0">
                                <ArrowLeft size={18} />
                            </button>
                        )}
                        <div className="min-w-0">
                            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">Çek, Senet ve Tahsilat</h1>
                            <p className="text-xs font-medium text-stone-400 truncate">Müşteri alacakları ve tedarikçi ödemeleri</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className={`px-2.5 py-1.5 rounded-full border ${activeTab === 'RECEIVABLES' ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-rose-500/10 border-rose-500/25'}`}>
                            <span className={`text-[11px] font-bold tabular-nums ${activeTab === 'RECEIVABLES' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pendingCount} bekleyen
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all"
                        >
                            <Plus size={15} />
                            <span>Ödeme ekle</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 p-1 bg-stone-950/60 backdrop-blur rounded-xl mb-3 border border-white/5">
                    <button 
                        onClick={() => setActiveTab('RECEIVABLES')} 
                        className={`min-h-[40px] px-2 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${activeTab === 'RECEIVABLES' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                    >
                        Müşteri alacakları
                    </button>
                    <button 
                        onClick={() => setActiveTab('PAYABLES')} 
                        className={`min-h-[40px] px-2 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${activeTab === 'PAYABLES' ? 'bg-rose-600 text-white shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
                    >
                        Tedarikçi ödemeleri
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                        <input 
                            type="text"
                            placeholder="İsim, banka veya evrak no ara..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-stone-950 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-emerald-500/40 transition-all"
                        />
                    </div>
                    <select 
                        value={filter}
                        onChange={e => setFilter(e.target.value as any)}
                        className="bg-stone-950 border border-white/10 rounded-xl px-3 text-xs font-bold text-stone-300 outline-none shrink-0"
                    >
                        <option value="ALL">Tümü</option>
                        <option value="PENDING">Bekleyen</option>
                        <option value="PAID">Ödenen</option>
                    </select>
                </div>

                {activeTab === 'RECEIVABLES' && (
                    <div className="mks-tab-rail mt-3">
                        {[
                            { id: 'ALL', label: 'Tüm portföy' },
                            { id: 'PORTFOLIO', label: 'Portföyde bekleyen' },
                            { id: 'ENDORSED', label: 'Ciro edilenler' },
                            { id: 'BOUNCED', label: 'Karşılıksız / Protesto' }
                        ].map(chip => (
                            <button
                                key={chip.id}
                                onClick={() => setPortfolioFilter(chip.id as any)}
                                className={`shrink-0 min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                                    portfolioFilter === chip.id
                                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                        : 'bg-stone-950/70 border-white/10 text-stone-400 hover:text-stone-200'
                                }`}
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                )}
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
                                                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
                                                    {payment.type === 'CHECK' ? 'ÇEK' : 
                                                     payment.type === 'TEDYE' ? 'TEDYE' : 
                                                     payment.type === 'PROMISSORY_NOTE' ? 'SENET' : 
                                                     payment.type === 'CARD_INSTALLMENT' ? 'KART TAKSİDİ' :
                                                     payment.type === 'DEFERRED_CARD' ? 'KREDİ KARTI BLOKE' : 'DİĞER'}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-stone-700"></span>
                                                <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">
                                                    {new Date(payment.dueDate).toLocaleDateString('tr-TR')}
                                                </span>
                                            </div>
                                            {(payment.checkSerialNo || payment.bankName || payment.drawerName || payment.portfolioStatus) && (
                                                <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                                                    {payment.checkSerialNo && (
                                                        <span className="px-2 py-0.5 rounded-md bg-stone-800/90 border border-white/10 text-stone-200 text-[10px] font-mono font-bold">
                                                            #{payment.checkSerialNo}
                                                        </span>
                                                    )}
                                                    {payment.bankName && (
                                                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold">
                                                            {payment.bankName}
                                                        </span>
                                                    )}
                                                    {payment.drawerName && (
                                                        <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-300 text-[10px] font-bold">
                                                            Keşideci: {payment.drawerName}
                                                        </span>
                                                    )}
                                                    {payment.portfolioStatus === 'ENDORSED' && (
                                                        <span className="px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/35 text-violet-300 text-[10px] font-bold">
                                                            Ciro edildi → {payment.endorsedToSupplierName || 'Tedarikçi'}
                                                        </span>
                                                    )}
                                                    {payment.portfolioStatus === 'BOUNCED' && (
                                                        <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                                                            Karşılıksız / Protesto
                                                        </span>
                                                    )}
                                                    {payment.portfolioStatus === 'PORTFOLIO' && payment.status === 'PENDING' && (payment.type === 'CHECK' || payment.type === 'PROMISSORY_NOTE') && (
                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px] font-bold">
                                                            Portföyde
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {payment.type === 'DEFERRED_CARD' && (
                                                <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                                                        Bloke kalkış: {new Date(payment.dueDate).toLocaleDateString('tr-TR')}
                                                    </span>
                                                    {payment.status === 'PAID' ? (
                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                                            Bloke kalktı (tahsil edildi)
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 text-[10px] font-bold">
                                                            Bloke bekliyor
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-lg font-black text-white tracking-tight tabular-nums">
                                            {formatCurrency(payment.amount, userProfile?.currency || 'TRY')}
                                        </div>
                                        <div className="flex items-center justify-end gap-1 mt-0.5">
                                            <Clock size={10} className="text-stone-500" />
                                            <span className="text-[10px] font-semibold text-stone-400 tabular-nums">
                                                Vade: {new Date(payment.dueDate).toLocaleDateString('tr-TR')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {payment.note && (
                                    <div className="bg-stone-950/50 p-2.5 rounded-xl mb-3">
                                        <p className="text-xs text-stone-300 italic">"{payment.note}"</p>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-white/5">
                                    <button 
                                        onClick={() => handleTogglePaid(payment)}
                                        className={`flex-1 min-w-[140px] min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            payment.status === 'PAID'
                                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-stone-800 text-stone-200 border border-white/10 hover:bg-stone-700'
                                        }`}
                                    >
                                        {payment.status === 'PAID' ? <CheckCircle2 size={14} /> : <Check size={14} />}
                                        {payment.portfolioStatus === 'ENDORSED'
                                            ? 'Ciro edildi'
                                            : payment.status === 'PAID' 
                                                ? (payment.farmerId || payment.farmerName ? 'Tahsil edildi' : 'Ödendi') 
                                                : (payment.farmerId || payment.farmerName ? 'Tahsil edildi işaretle' : 'Ödendi işaretle')}
                                    </button>
                                    {(payment.farmerId || payment.farmerName) && (payment.type === 'CHECK' || payment.type === 'PROMISSORY_NOTE') && payment.status === 'PENDING' && payment.portfolioStatus !== 'ENDORSED' && payment.portfolioStatus !== 'BOUNCED' && payment.portfolioStatus !== 'COLLECTED' && (
                                        <button
                                            onClick={() => {
                                                setEndorseTargetPayment(payment);
                                                setSelectedEndorseSupplierId(suppliers[0]?.id || '');
                                                setEndorseNote('');
                                            }}
                                            className="min-h-[40px] px-3.5 py-2 bg-violet-500/15 text-violet-300 font-bold text-xs rounded-xl hover:bg-violet-500/25 transition-all border border-violet-500/30"
                                            title="Müşteri çekini/senedini tedarikçiye ciro et ve borçtan düş"
                                        >
                                            Ciro et
                                        </button>
                                    )}
                                    {(payment.farmerId || payment.farmerName) && (payment.type === 'CHECK' || payment.type === 'PROMISSORY_NOTE') && payment.portfolioStatus !== 'ENDORSED' && (
                                        <button
                                            onClick={() => handleToggleBounced(payment)}
                                            className={`min-h-[40px] px-3 py-2 font-bold text-xs rounded-xl transition-all border flex items-center gap-1 ${
                                                payment.portfolioStatus === 'BOUNCED'
                                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                                    : 'bg-stone-800 text-stone-300 border-white/10 hover:text-rose-400'
                                            }`}
                                            title="Karşılıksız / Protestolu İşaretle"
                                        >
                                            <AlertCircle size={14} />
                                            <span className="hidden sm:inline">Protesto</span>
                                        </button>
                                    )}
                                    {(payment.farmerId || payment.farmerName) && (
                                        <button 
                                            onClick={() => handleSendReceipt(payment)}
                                            className="min-h-[40px] px-3.5 py-2 bg-emerald-500/10 text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/20 flex items-center justify-center"
                                        >
                                            Makbuz
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleDelete(payment.id)}
                                        className="min-h-[40px] min-w-[40px] p-2 bg-stone-800 text-stone-400 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-all border border-white/10 flex items-center justify-center"
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

                            {(newPayment.type === 'CHECK' || newPayment.type === 'PROMISSORY_NOTE') && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-stone-950/60 p-3 rounded-2xl border border-white/5">
                                    <div>
                                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1 block">Seri / Evrak No</label>
                                        <input
                                            type="text"
                                            placeholder="Örn: CK-849201"
                                            value={newPayment.checkSerialNo}
                                            onChange={(e) => setNewPayment({ ...newPayment, checkSerialNo: e.target.value })}
                                            className="w-full bg-stone-900 border border-white/5 rounded-xl p-2.5 text-xs font-mono text-stone-100 outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1 block">Banka / Şube</label>
                                        <input
                                            type="text"
                                            placeholder="Örn: Ziraat Bankası"
                                            value={newPayment.bankName}
                                            onChange={(e) => setNewPayment({ ...newPayment, bankName: e.target.value })}
                                            className="w-full bg-stone-900 border border-white/5 rounded-xl p-2.5 text-xs text-stone-100 outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1 block">Keşideci Adı</label>
                                        <input
                                            type="text"
                                            placeholder="Asıl borçlu (opsiyonel)"
                                            value={newPayment.drawerName}
                                            onChange={(e) => setNewPayment({ ...newPayment, drawerName: e.target.value })}
                                            className="w-full bg-stone-900 border border-white/5 rounded-xl p-2.5 text-xs text-stone-100 outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                </div>
                            )}

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
                                disabled={isSubmittingPayment}
                                onClick={handleAddPayment}
                                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                            >
                                {isSubmittingPayment ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Endorse Check/Promissory Note to Supplier Modal (#26) */}
            {endorseTargetPayment && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-stone-900 border border-violet-500/30 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-stone-100">Tedarikçiye Ciro Et</h3>
                                <p className="text-xs text-stone-400 mt-0.5">
                                    Müşteri evrakı seçilen tedarikçi carisinden otomatik düşülür
                                </p>
                            </div>
                            <button
                                onClick={() => setEndorseTargetPayment(null)}
                                className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="bg-stone-950 border border-white/5 rounded-2xl p-4 mb-4 space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-stone-400">{endorseTargetPayment.farmerName || 'Müşteri'}</span>
                                <span className="text-base font-black text-violet-300 font-mono">
                                    {formatCurrency(endorseTargetPayment.amount, userProfile?.currency || 'TRY')}
                                </span>
                            </div>
                            <div className="text-[11px] text-stone-500">
                                Vade: {new Date(endorseTargetPayment.dueDate).toLocaleDateString('tr-TR')}
                                {endorseTargetPayment.checkSerialNo ? ` • No: ${endorseTargetPayment.checkSerialNo}` : ''}
                                {endorseTargetPayment.bankName ? ` • ${endorseTargetPayment.bankName}` : ''}
                            </div>
                        </div>

                        {suppliers.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-bold mb-4">
                                Ciro yapılacak kayıtlı tedarikçi bulunamadı. Önce Tedarikçiler ekranından firma ekleyin.
                            </div>
                        ) : (
                            <div className="space-y-3 mb-5">
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1 mb-1.5 block">
                                        Ciro Edilecek Tedarikçi *
                                    </label>
                                    <select
                                        value={selectedEndorseSupplierId}
                                        onChange={(e) => setSelectedEndorseSupplierId(e.target.value)}
                                        className="w-full bg-stone-950 border border-white/10 rounded-2xl p-3.5 text-sm text-stone-100 outline-none focus:border-violet-500/50"
                                    >
                                        <option value="">Tedarikçi Seçiniz...</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1 mb-1.5 block">
                                        Ciro Açıklaması (Opsiyonel)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Örn: Gübre faturası mahsuben teslim edildi"
                                        value={endorseNote}
                                        onChange={(e) => setEndorseNote(e.target.value)}
                                        className="w-full bg-stone-950 border border-white/10 rounded-2xl p-3 text-xs text-stone-100 outline-none focus:border-violet-500/50"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setEndorseTargetPayment(null)}
                                className="flex-1 py-3.5 bg-stone-800 text-stone-300 rounded-2xl font-bold text-xs"
                            >
                                Vazgeç
                            </button>
                            <button
                                disabled={isEndorsing || !selectedEndorseSupplierId || suppliers.length === 0}
                                onClick={handleConfirmEndorse}
                                className="flex-1 py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-violet-900/30"
                            >
                                {isEndorsing ? 'Ciro İşleniyor...' : 'Ciroyu Onayla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

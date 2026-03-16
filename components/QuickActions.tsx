import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppViewModel } from '../context/AppContext';
import { Farmer, Expense, Payment } from '../types';
import { Plus, MessageSquare, Wallet, Receipt, CreditCard, X, AlertCircle, Send, Loader2, Save, MessageCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const QuickActions: React.FC = () => {
    const { farmers, payments, prescriptions, manualDebts, addExpense, addPayment, accounts, showToast, hapticFeedback } = useAppViewModel();
    const [isOpen, setIsOpen] = useState(false);
    
    // Modals state
    const [activeModal, setActiveModal] = useState<'BULK_MESSAGE' | 'DEBT_REMINDER' | 'ADD_EXPENSE' | 'RECEIVE_PAYMENT' | null>(null);

    // Compute farmers with balances
    const farmersWithBalances = useMemo(() => {
        return farmers.map(farmer => {
            const fPayments = payments.filter(p => p.farmerId === farmer.id);
            const fPrescriptions = prescriptions.filter(p => p.farmerId === farmer.id);
            const fManualDebts = manualDebts.filter(d => d.farmerId === farmer.id);
            
            const totalPaid = fPayments.reduce((acc, p) => acc + p.amount, 0);
            const totalDebt = fPrescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0) + 
                              fManualDebts.filter(d => !d.note?.includes('Devir Bakiyesi')).reduce((acc, d) => acc + d.amount, 0);
            
            const overallBalance = totalPaid - totalDebt;
            return { ...farmer, overallBalance };
        });
    }, [farmers, payments, prescriptions, manualDebts]);

    // --- BULK MESSAGE STATE ---
    const [bulkMessage, setBulkMessage] = useState('');
    const [bulkTargetVillage, setBulkTargetVillage] = useState('ALL');
    
    const villages = useMemo(() => {
        return Array.from(new Set(farmers.map(f => f.village).filter(Boolean))).sort();
    }, [farmers]);

    const bulkTargetFarmers = useMemo(() => {
        if (bulkTargetVillage === 'ALL') return farmers;
        return farmers.filter(f => f.village === bulkTargetVillage);
    }, [farmers, bulkTargetVillage]);

    const handleSendBulkWhatsApp = (farmer: Farmer) => {
        const url = `https://wa.me/${farmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(bulkMessage)}`;
        window.open(url, '_blank');
    };

    // --- DEBT REMINDER STATE ---
    const [debtReminderTemplate, setDebtReminderTemplate] = useState('Sayın [İSİM],\n\n[TARİH] tarihi itibarıyla [BAKİYE] ödenmemiş bakiyeniz bulunmaktadır.\n\nBilginize sunar, iyi çalışmalar dileriz.');
    
    const debtors = useMemo(() => {
        return farmersWithBalances
            .filter(f => f.overallBalance < 0)
            .sort((a, b) => a.overallBalance - b.overallBalance);
    }, [farmersWithBalances]);

    const handleSendDebtReminder = (farmer: Farmer & { overallBalance: number }) => {
        const balance = Math.abs(farmer.overallBalance).toLocaleString('tr-TR') + ' ₺';
        const date = new Date().toLocaleDateString('tr-TR');
        
        let text = debtReminderTemplate
            .replace(/\[İSİM\]/g, farmer.fullName)
            .replace(/\[BAKİYE\]/g, balance)
            .replace(/\[TARİH\]/g, date);
            
        const url = `https://wa.me/${farmer.phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // --- ADD EXPENSE STATE ---
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseCategory, setExpenseCategory] = useState<Expense['category']>('OTHER');
    const [expenseAccountId, setExpenseAccountId] = useState(accounts[0]?.id || '');

    const handleSaveExpense = async () => {
        if (!expenseAmount || !expenseTitle) return;
        try {
            await addExpense({
                amount: parseFloat(expenseAmount),
                title: expenseTitle,
                category: expenseCategory,
                date: new Date().toISOString(),
                accountId: expenseAccountId || undefined
            });
            showToast('Gider başarıyla eklendi', 'success');
            hapticFeedback();
            setActiveModal(null);
            setExpenseAmount('');
            setExpenseTitle('');
        } catch (error) {
            showToast('Gider eklenirken hata oluştu', 'error');
        }
    };

    // --- RECEIVE PAYMENT STATE ---
    const [paymentFarmerId, setPaymentFarmerId] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentAccountId, setPaymentAccountId] = useState(accounts[0]?.id || '');
    const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('CASH');
    const [paymentNote, setPaymentNote] = useState('');

    const handleSavePayment = async () => {
        if (!paymentFarmerId || !paymentAmount) return;
        try {
            await addPayment({
                farmerId: paymentFarmerId,
                amount: parseFloat(paymentAmount),
                date: new Date().toISOString(),
                method: paymentMethod,
                note: paymentNote,
                accountId: paymentAccountId || undefined
            });
            showToast('Tahsilat başarıyla eklendi', 'success');
            hapticFeedback();
            setActiveModal(null);
            setPaymentAmount('');
            setPaymentNote('');
            setPaymentFarmerId('');
        } catch (error) {
            showToast('Tahsilat eklenirken hata oluştu', 'error');
        }
    };

    return (
        <>
            <div className="relative flex-1 h-full">
                {typeof document !== 'undefined' && createPortal(
                    <AnimatePresence>
                        {isOpen && (
                            <>
                                {/* Backdrop to close menu */}
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-[9997] bg-black/40 backdrop-blur-sm"
                                    onClick={() => setIsOpen(false)}
                                />
                                
                                {/* Bubble Menu */}
                                <motion.div 
                                    initial={{ opacity: 0, y: 20, scale: 0.9, x: '-50%' }}
                                    animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                                    exit={{ opacity: 0, y: 20, scale: 0.9, x: '-50%' }}
                                    className="fixed bottom-24 left-1/2 z-[9998] w-[85%] max-w-[320px] bg-stone-900/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden ring-1 ring-white/20"
                                >
                                    <div className="p-3 space-y-1.5">
                                        <button 
                                            onClick={() => { setActiveModal('DEBT_REMINDER'); setIsOpen(false); }}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <Wallet size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">Toplu Borç Hatırlatma</div>
                                                <div className="text-[10px] text-stone-500 font-medium mt-0.5">Borçlulara WhatsApp mesajı</div>
                                            </div>
                                            <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => { setActiveModal('BULK_MESSAGE'); setIsOpen(false); }}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <MessageSquare size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">Toplu Mesaj Gönder</div>
                                                <div className="text-[10px] text-stone-500 font-medium mt-0.5">Tüm çiftçilere duyuru</div>
                                            </div>
                                            <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => { setActiveModal('ADD_EXPENSE'); setIsOpen(false); }}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <Receipt size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">Gider Ekle</div>
                                                <div className="text-[10px] text-stone-500 font-medium mt-0.5">İşletme gideri kaydet</div>
                                            </div>
                                            <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => { setActiveModal('RECEIVE_PAYMENT'); setIsOpen(false); }}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <CreditCard size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">Tahsilat (Ödeme Al)</div>
                                                <div className="text-[10px] text-stone-500 font-medium mt-0.5">Çiftçiden ödeme kaydet</div>
                                            </div>
                                            <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

                {/* Main Trigger Button */}
                <div className="flex flex-col items-center justify-end w-full h-full relative pb-1">
                    <button 
                        onClick={() => {
                            setIsOpen(!isOpen);
                            hapticFeedback();
                        }} 
                        className={`absolute -top-5 left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-12 rounded-full transition-all active:scale-95 shadow-xl z-50 ${isOpen ? 'bg-stone-800 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/30'}`}
                    >
                        <Plus size={24} strokeWidth={2.5} className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
                    </button>
                    <span className={`text-[8px] font-bold transition-all ${isOpen ? 'text-emerald-400 opacity-100' : 'text-stone-500 opacity-60'}`}>
                        Hızlı İşlem
                    </span>
                </div>
            </div>

            {/* MODALS - Rendered via Portal to break out of stacking context */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {activeModal === 'BULK_MESSAGE' && (
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-0 bg-stone-950 z-[9999] flex flex-col"
                        >
                            <div className="p-4 border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                                        <MessageSquare size={20}/> 
                                    </div>
                                    Toplu Mesaj Gönder
                                </h2>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors"
                                >
                                    <X size={24}/>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Hedef Grup (Köy)</label>
                                    <select 
                                        value={bulkTargetVillage} 
                                        onChange={(e) => setBulkTargetVillage(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm outline-none focus:border-blue-500 transition-all appearance-none"
                                    >
                                        <option value="ALL">Tüm Çiftçiler ({farmers.length})</option>
                                        {villages.map((v: string) => <option key={v} value={v}>{v} ({farmers.filter((f: Farmer) => f.village === v).length})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Mesaj İçeriği</label>
                                    <textarea 
                                        value={bulkMessage} 
                                        onChange={(e) => setBulkMessage(e.target.value)} 
                                        placeholder="Örn: Değerli üreticilerimiz..." 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-base focus:border-blue-500 outline-none transition-all h-48 resize-none" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Alıcı Listesi ({bulkTargetFarmers.length} Kişi)</label>
                                    <div className="space-y-2">
                                        {bulkTargetFarmers.map((f: Farmer) => (
                                            <div key={f.id} className="flex items-center justify-between p-4 bg-stone-900/50 rounded-2xl border border-white/5">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-stone-100">{f.fullName}</span>
                                                    <span className="text-xs text-stone-500">{f.phoneNumber}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleSendBulkWhatsApp(f)} 
                                                    disabled={!bulkMessage.trim()} 
                                                    className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-30"
                                                >
                                                    <Send size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeModal === 'DEBT_REMINDER' && (
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-0 bg-stone-950 z-[9999] flex flex-col"
                        >
                            <div className="p-4 border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                                        <Wallet size={20}/> 
                                    </div>
                                    Borç Hatırlatma
                                </h2>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors"
                                >
                                    <X size={24}/>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                                        <AlertCircle className="text-rose-500" size={20}/>
                                    </div>
                                    <div className="text-sm text-rose-200/90 leading-relaxed">
                                        Şu anda toplam <strong className="text-rose-400">{debtors.length}</strong> çiftçinin ödenmemiş borcu bulunmaktadır. Aşağıdaki listeden tek tıkla hatırlatma gönderebilirsiniz.
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">Mesaj Şablonu</label>
                                        <span className="text-[10px] text-stone-600 font-medium">[İSİM], [BAKİYE], [TARİH]</span>
                                    </div>
                                    <textarea 
                                        value={debtReminderTemplate} 
                                        onChange={(e) => setDebtReminderTemplate(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all h-40 resize-none font-mono" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Borçlu Listesi ({debtors.length} Kişi)</label>
                                    <div className="space-y-2">
                                        {debtors.map((f) => (
                                            <div key={f.id} className="flex items-center justify-between p-4 bg-stone-900/50 rounded-2xl border border-white/5 hover:bg-stone-900 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-stone-100">{f.fullName}</span>
                                                    <span className="text-xs text-rose-400 font-mono font-bold mt-1">{Math.abs(f.overallBalance || 0).toLocaleString('tr-TR')} ₺</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleSendDebtReminder(f)} 
                                                    disabled={!debtReminderTemplate.trim()} 
                                                    className="px-4 py-2.5 bg-[#25D366]/10 text-[#25D366] rounded-xl hover:bg-[#25D366] hover:text-white transition-all disabled:opacity-30 flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                                >
                                                    <MessageCircle size={16} /> Gönder
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeModal === 'ADD_EXPENSE' && (
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-0 bg-stone-950 z-[9999] flex flex-col"
                        >
                            <div className="p-4 border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                                        <Receipt size={20}/> 
                                    </div>
                                    Gider Ekle
                                </h2>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors"
                                >
                                    <X size={24}/>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Tutar (₺)</label>
                                    <input 
                                        type="number" 
                                        value={expenseAmount} 
                                        onChange={(e) => setExpenseAmount(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-5 text-2xl font-bold text-orange-500 focus:border-orange-500 outline-none transition-all placeholder:text-stone-800" 
                                        placeholder="0.00" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Açıklama</label>
                                    <input 
                                        type="text" 
                                        value={expenseTitle} 
                                        onChange={(e) => setExpenseTitle(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-base focus:border-orange-500 outline-none transition-all" 
                                        placeholder="Örn: Traktör Yakıtı, Ofis Kirası vb." 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Kategori</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['FUEL', 'RENT', 'ELECTRICITY', 'WATER', 'SALARY', 'TAX', 'OTHER'].map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setExpenseCategory(cat as any)}
                                                className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all ${expenseCategory === cat ? 'bg-orange-500 border-orange-500 text-white' : 'bg-stone-900 border-white/5 text-stone-400 hover:border-white/20'}`}
                                            >
                                                {cat === 'FUEL' ? 'Yakıt' : cat === 'RENT' ? 'Kira' : cat === 'ELECTRICITY' ? 'Elektrik' : cat === 'WATER' ? 'Su' : cat === 'SALARY' ? 'Maaş' : cat === 'TAX' ? 'Vergi' : 'Diğer'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {accounts.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Ödeme Hesabı</label>
                                        <select 
                                            value={expenseAccountId} 
                                            onChange={(e) => setExpenseAccountId(e.target.value)} 
                                            className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-orange-500 outline-none transition-all appearance-none"
                                        >
                                            <option value="">Hesap Seçiniz (Opsiyonel)</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString('tr-TR')} ₺)</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="pt-4">
                                    <button 
                                        disabled={!expenseAmount || !expenseTitle} 
                                        onClick={handleSaveExpense} 
                                        className="w-full bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-orange-600/20 disabled:opacity-50 flex items-center justify-center transition-all active:scale-[0.98]"
                                    >
                                        <Save className="mr-2" size={20}/> GİDERİ KAYDET
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeModal === 'RECEIVE_PAYMENT' && (
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed inset-0 bg-stone-950 z-[9999] flex flex-col"
                        >
                            <div className="p-4 border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                                        <CreditCard size={20}/> 
                                    </div>
                                    Tahsilat Yap
                                </h2>
                                <button 
                                    onClick={() => setActiveModal(null)} 
                                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-stone-400 hover:text-stone-100 transition-colors"
                                >
                                    <X size={24}/>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Çiftçi Seçin</label>
                                    <select 
                                        value={paymentFarmerId} 
                                        onChange={(e) => setPaymentFarmerId(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-base focus:border-emerald-500 outline-none transition-all appearance-none"
                                    >
                                        <option value="">Çiftçi Seçiniz...</option>
                                        {farmersWithBalances.map(f => (
                                            <option key={f.id} value={f.id}>
                                                {f.fullName} (Borç: {Math.abs(f.overallBalance || 0).toLocaleString('tr-TR')} ₺)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Tahsilat Tutarı (₺)</label>
                                    <input 
                                        type="number" 
                                        value={paymentAmount} 
                                        onChange={(e) => setPaymentAmount(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-5 text-2xl font-bold text-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-stone-800" 
                                        placeholder="0.00" 
                                    />
                                </div>
                                {accounts.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Tahsilat Hesabı</label>
                                        <select 
                                            value={paymentAccountId} 
                                            onChange={(e) => setPaymentAccountId(e.target.value)} 
                                            className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-emerald-500 outline-none transition-all appearance-none"
                                        >
                                            <option value="">Hesap Seçiniz (Opsiyonel)</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.balance.toLocaleString('tr-TR')} ₺)</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">Ödeme Yöntemi & Not</label>
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        {(['CASH', 'CARD', 'CHECK', 'OTHER'] as const).map((method) => (
                                            <button
                                                key={method}
                                                onClick={() => setPaymentMethod(method)}
                                                className={`py-3 rounded-xl border text-[10px] font-bold transition-all ${paymentMethod === method ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-stone-900 border-white/5 text-stone-400'}`}
                                            >
                                                {method === 'CASH' ? 'Nakit' : method === 'CARD' ? 'Kart' : method === 'CHECK' ? 'Çek' : 'Diğer'}
                                            </button>
                                        ))}
                                    </div>
                                    <input 
                                        type="text" 
                                        value={paymentNote} 
                                        onChange={(e) => setPaymentNote(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-emerald-500 outline-none transition-all" 
                                        placeholder="Ödeme ile ilgili not (Opsiyonel)" 
                                    />
                                </div>
                                <div className="pt-4">
                                    <button 
                                        disabled={!paymentFarmerId || !paymentAmount} 
                                        onClick={handleSavePayment} 
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center transition-all active:scale-[0.98]"
                                    >
                                        <Save className="mr-2" size={20}/> TAHSİLATI KAYDET
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

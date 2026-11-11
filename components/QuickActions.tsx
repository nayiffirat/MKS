import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppViewModel } from '../context/AppContext';
import { Farmer, Expense, Payment } from '../types';
import { Plus, MessageSquare, Wallet, Receipt, CreditCard, AlertCircle, Send, Loader2, Save, MessageCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, getCurrencySymbol } from '../utils/currency';
import { useBackHandler } from '../utils/navigationManager';
import { buildWaUrl } from '../utils/whatsappTemplates';
import { ModalCloseButton } from './ModalCloseButton';

export const QuickActions: React.FC = () => {
    const { 
        farmers, 
        payments, 
        prescriptions, 
        manualDebts, 
        addExpense, 
        addPayment, 
        accounts, 
        showToast, 
        hapticFeedback, 
        userProfile,
        farmerLabel,
        farmerPluralLabel,
        prescriptionLabel,
        activeTeamMember,
        t,
        language
    } = useAppViewModel();
    const [isOpen, setIsOpen] = useState(false);
    
    // Modals state
    const [activeModal, setActiveModal] = useState<'BULK_MESSAGE' | 'DEBT_REMINDER' | 'ADD_EXPENSE' | 'RECEIVE_PAYMENT' | null>(null);

    // Handle back button for modals and menu via the app-wide back stack (UI-45)
    useBackHandler(!!activeModal, () => setActiveModal(null), 'quick-actions-modal', 40);
    useBackHandler(isOpen, () => setIsOpen(false), 'quick-actions-menu', 35);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ modal?: typeof activeModal }>).detail;
            if (detail?.modal) {
                setIsOpen(false);
                setActiveModal(detail.modal);
            }
        };
        window.addEventListener('mks-open-quick-modal', handler);
        return () => window.removeEventListener('mks-open-quick-modal', handler);
    }, []);

    const toggleOpen = (open: boolean) => {
        if (open === isOpen) return;
        setIsOpen(open);
    };

    const changeActiveModal = (modal: typeof activeModal) => {
        if (modal === activeModal) return;
        setActiveModal(modal);
    };

    const openModalFromMenu = (modal: typeof activeModal) => {
        setIsOpen(false);
        setActiveModal(modal);
    };

    const openWhatsApp = (phone: string | undefined | null, text: string) => {
        const url = buildWaUrl(phone, text);
        if (!url) {
            showToast(t('quick.noValidPhone'), 'error');
            return;
        }
        window.open(url, '_blank');
    };

    // Compute farmers with balances (using AppContext's reconciled farmer.balance)
    const farmersWithBalances = useMemo(() => {
        return farmers.filter(f => !f.deletedAt).map(farmer => {
            if (typeof farmer.balance === 'number') {
                return { ...farmer, overallBalance: farmer.balance };
            }
            const fPayments = payments.filter(p => !p.deletedAt && p.farmerId === farmer.id);
            const fPrescriptions = prescriptions.filter(p => !p.deletedAt && p.farmerId === farmer.id && p.priceType !== 'CASH');
            const fManualDebts = manualDebts.filter(d => !d.deletedAt && d.farmerId === farmer.id && !d.id.startsWith('turnover-'));
            
            const totalPaid = fPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
            const totalDebt = fPrescriptions.reduce((acc, p) => {
                const amt = Number(p.totalAmount) || 0;
                const isReturn = p.type === 'RETURN' || amt < 0;
                return acc + (isReturn ? -Math.abs(amt) : Math.abs(amt));
            }, 0) + fManualDebts.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
            
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
        openWhatsApp(farmer.phoneNumber, bulkMessage);
    };

    // --- DEBT REMINDER STATE ---
    const [debtReminderTemplate, setDebtReminderTemplate] = useState('');

    useEffect(() => {
        setDebtReminderTemplate(t('quick.debtReminder.template'));
    }, [language]);
    
    const debtors = useMemo(() => {
        return farmersWithBalances
            .filter(f => f.overallBalance < 0)
            .sort((a, b) => a.overallBalance - b.overallBalance);
    }, [farmersWithBalances]);

    const handleSendDebtReminder = (farmer: Farmer & { overallBalance: number }) => {
        const balance = formatCurrency(Math.abs(farmer.overallBalance), userProfile?.currency || 'TRY');
        const date = new Date().toLocaleDateString(language === 'tr' ? 'tr-TR' : language === 'en' ? 'en-US' : 'ar-SA');
        
        let text = debtReminderTemplate
            .replace(/\[NAME\]/g, farmer.fullName)
            .replace(/\[BALANCE\]/g, balance)
            .replace(/\[DATE\]/g, date)
            .replace(/\[İSİM\]/g, farmer.fullName) // Backward compatibility
            .replace(/\[BAKİYE\]/g, balance)
            .replace(/\[TARİH\]/g, date);
            
        openWhatsApp(farmer.phoneNumber, text);
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
                amount: parseFloat(expenseAmount.replace(',', '.')) || 0,
                title: expenseTitle,
                category: expenseCategory,
                date: new Date().toISOString(),
                accountId: expenseAccountId || undefined,
                createdById: activeTeamMember?.id
            });
            showToast(t('quick.addExpense.success'), 'success');
            hapticFeedback();
            changeActiveModal(null);
            setExpenseAmount('');
            setExpenseTitle('');
        } catch (error) {
            showToast(t('quick.addExpense.error'), 'error');
        }
    };

    // --- RECEIVE PAYMENT STATE ---
    const [paymentFarmerId, setPaymentFarmerId] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentAccountId, setPaymentAccountId] = useState(accounts[0]?.id || '');
    const [paymentMethod, setPaymentMethod] = useState<Payment['method']>('CASH');
    const [paymentCardOption, setPaymentCardOption] = useState<'UNBLOCKED' | 'DAYS_15' | 'DAYS_30' | 'DAYS_45'>('UNBLOCKED');
    const [paymentCommissionRate, setPaymentCommissionRate] = useState('4');
    const [paymentNote, setPaymentNote] = useState('');
    const [isSavingPayment, setIsSavingPayment] = useState(false);

    const handleSavePayment = async () => {
        if (!paymentFarmerId || !paymentAmount || isSavingPayment) return;
        try {
            setIsSavingPayment(true);
            const parsedAmt = parseFloat(paymentAmount.replace(',', '.')) || 0;
            const parsedCommRate = parseFloat(paymentCommissionRate.replace(',', '.')) || 0;
            await addPayment({
                farmerId: paymentFarmerId,
                amount: parsedAmt,
                date: new Date().toISOString(),
                method: paymentMethod,
                cardOption: paymentMethod === 'CARD' ? paymentCardOption : undefined,
                commissionRate: paymentMethod === 'CARD' ? parsedCommRate : undefined,
                note: paymentNote,
                accountId: paymentAccountId || undefined,
                createdById: activeTeamMember?.id
            });
            showToast(t('quick.receivePayment.success'), 'success');
            hapticFeedback();
            changeActiveModal(null);
            setPaymentAmount('');
            setPaymentNote('');
            setPaymentFarmerId('');
            setPaymentCardOption('UNBLOCKED');
            setPaymentCommissionRate('4');
        } catch (error) {
            showToast(t('quick.receivePayment.error'), 'error');
        } finally {
            setIsSavingPayment(false);
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
                                    onClick={() => toggleOpen(false)}
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
                                            onClick={() => openModalFromMenu('DEBT_REMINDER')}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <Wallet size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">{t('quick.debtReminder') || 'Toplu Borç Hatırlatma'}</div>
                                                <div className="text-[11px] text-stone-400 font-medium mt-0.5">{t('quick.debtReminder.desc') || 'Borçlulara WhatsApp mesajı'}</div>
                                            </div>
                                            <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => openModalFromMenu('BULK_MESSAGE')}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <MessageSquare size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">{t('quick.bulkMessage') || 'Toplu Mesaj Gönder'}</div>
                                                <div className="text-[11px] text-stone-400 font-medium mt-0.5">{t('quick.bulkMessage.desc') || 'Tüm çiftçilere duyuru'}</div>
                                            </div>
                                            <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => openModalFromMenu('ADD_EXPENSE')}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <Receipt size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">{t('quick.addExpense') || 'Gider Ekle'}</div>
                                                <div className="text-[11px] text-stone-400 font-medium mt-0.5">{t('quick.addExpense.desc') || 'İşletme gideri kaydet'}</div>
                                            </div>
                                            <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-400 transition-colors" />
                                        </button>
                                        
                                        <button 
                                            onClick={() => openModalFromMenu('RECEIVE_PAYMENT')}
                                            className="w-full flex items-center p-4 rounded-2xl hover:bg-white/5 transition-all text-left group active:scale-[0.98]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shadow-inner">
                                                <CreditCard size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-stone-100">{t('quick.receivePayment') || 'Tahsilat (Ödeme Al)'}</div>
                                                <div className="text-[11px] text-stone-400 font-medium mt-0.5">{farmerLabel} {t('quick.receivePayment.desc') || 'den ödeme kaydet'}</div>
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

                {/* Main Trigger Floating Action Button */}
                <div className="flex items-center justify-center flex-1 h-full relative px-1">
                    <button 
                        type="button"
                        aria-label={t('quick.action') || 'Hızlı İşlem'}
                        aria-expanded={isOpen}
                        onClick={() => {
                            toggleOpen(!isOpen);
                            hapticFeedback();
                        }} 
                        className={`-mt-5 flex items-center justify-center w-12 h-12 rounded-full transition-all active:scale-90 shadow-xl z-50 ring-4 ring-black/40 ${
                            isOpen 
                                ? 'bg-stone-800 text-emerald-400 border border-emerald-500/40 shadow-emerald-500/30' 
                                : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-500/40'
                        }`}
                    >
                        <Plus size={26} strokeWidth={2.6} className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
                    </button>
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
                            <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                                        <MessageSquare size={20}/> 
                                    </div>
                                    Toplu Mesaj Gönder
                                </h2>
                                <ModalCloseButton 
                                    onClick={() => changeActiveModal(null)} 
                                    label={t('common.close')}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.bulkMessage.village')}</label>
                                    <select 
                                        value={bulkTargetVillage} 
                                        onChange={(e) => setBulkTargetVillage(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm outline-none focus:border-blue-500 transition-all appearance-none"
                                    >
                                        <option value="ALL">{t('quick.bulkMessage.all')} {farmerPluralLabel} ({farmers.length})</option>
                                        {villages.map((v: string) => <option key={v} value={v}>{v} ({farmers.filter((f: Farmer) => f.village === v).length})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.bulkMessage.content')}</label>
                                    <textarea 
                                        value={bulkMessage} 
                                        onChange={(e) => setBulkMessage(e.target.value)} 
                                        placeholder={t('quick.bulkMessage.placeholder')} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-base focus:border-blue-500 outline-none transition-all h-48 resize-none" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.bulkMessage.list')} ({bulkTargetFarmers.length} {t('quick.person')})</label>
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
                                                    aria-label={`WhatsApp: ${f.fullName}`}
                                                    className="w-11 h-11 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-30"
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
                            <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                                        <Wallet size={20}/> 
                                    </div>
                                    {t('quick.debtReminder') || 'Borç Hatırlatma'}
                                </h2>
                                <ModalCloseButton 
                                    onClick={() => changeActiveModal(null)} 
                                    label={t('common.close')}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                                        <AlertCircle className="text-rose-500" size={20}/>
                                    </div>
                                    <div className="text-sm text-rose-200/90 leading-relaxed">
                                        {t('quick.debtReminder.info1') || 'Şu anda toplam'} <strong className="text-rose-400">{debtors.length}</strong> {t('quick.debtReminder.info2') || 'çiftçinin ödenmemiş borcu bulunmaktadır. Aşağıdaki listeden tek tıkla hatırlatma gönderebilirsiniz.'}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider">{t('quick.messageTemplate') || 'Mesaj Şablonu'}</label>
                                        <span className="text-[11px] text-stone-400 font-medium">[NAME], [BALANCE], [DATE]</span>
                                    </div>
                                    <textarea 
                                        value={debtReminderTemplate} 
                                        onChange={(e) => setDebtReminderTemplate(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-rose-500 outline-none transition-all h-40 resize-none font-mono" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.debtorList') || 'Borçlu Listesi'} ({debtors.length} {t('quick.person') || 'Kişi'})</label>
                                    <div className="space-y-2">
                                        {debtors.map((f) => (
                                            <div key={f.id} className="flex items-center justify-between p-4 bg-stone-900/50 rounded-2xl border border-white/5 hover:bg-stone-900 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-stone-100">{f.fullName}</span>
                                                    <span className="text-xs text-rose-400 font-mono font-bold mt-1">{formatCurrency(Math.abs(f.overallBalance || 0), userProfile?.currency || 'TRY')}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleSendDebtReminder(f)} 
                                                    disabled={!debtReminderTemplate.trim()} 
                                                    className="px-4 py-2.5 bg-[#25D366]/10 text-[#25D366] rounded-xl hover:bg-[#25D366] hover:text-white transition-all disabled:opacity-30 flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                                                >
                                                    <MessageCircle size={16} /> {t('quick.send') || 'Gönder'}
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
                            <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                                        <Receipt size={20}/> 
                                    </div>
                                    {t('quick.addExpense.title')}
                                </h2>
                                <ModalCloseButton 
                                    onClick={() => changeActiveModal(null)} 
                                    label={t('common.close')}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.addExpense.amount')} ({getCurrencySymbol(userProfile?.currency || 'TRY')})</label>
                                    <input 
                                        type="number" 
                                        value={expenseAmount} 
                                        onChange={(e) => setExpenseAmount(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-5 text-2xl font-bold text-orange-500 focus:border-orange-500 outline-none transition-all placeholder:text-stone-800" 
                                        placeholder="0.00" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.addExpense.name')}</label>
                                    <input 
                                        type="text" 
                                        value={expenseTitle} 
                                        onChange={(e) => setExpenseTitle(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-base focus:border-orange-500 outline-none transition-all" 
                                        placeholder={t('quick.bulkMessage.placeholder')} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.addExpense.category')}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['FUEL', 'RENT', 'ELECTRICITY', 'WATER', 'SALARY', 'TAX', 'OTHER'].map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => setExpenseCategory(cat as any)}
                                                className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all ${expenseCategory === cat ? 'bg-orange-500 border-orange-500 text-white' : 'bg-stone-900 border-white/5 text-stone-400 hover:border-white/20'}`}
                                            >
                                                {cat === 'FUEL' ? (language === 'tr' ? 'Yakıt' : language === 'en' ? 'Fuel' : 'وقود') : 
                                                 cat === 'RENT' ? (language === 'tr' ? 'Kira' : language === 'en' ? 'Rent' : 'إيجار') : 
                                                 cat === 'ELECTRICITY' ? (language === 'tr' ? 'Elektrik' : language === 'en' ? 'Electricity' : 'كهرباء') : 
                                                 cat === 'WATER' ? (language === 'tr' ? 'Su' : language === 'en' ? 'Water' : 'ماء') : 
                                                 cat === 'SALARY' ? (language === 'tr' ? 'Maaş' : language === 'en' ? 'Salary' : 'راتب') : 
                                                 cat === 'TAX' ? (language === 'tr' ? 'Vergi' : language === 'en' ? 'Tax' : 'ضريبة') : 
                                                 (language === 'tr' ? 'Diğer' : language === 'en' ? 'Other' : 'أخرى')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {accounts.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.addExpense.account')}</label>
                                        <select 
                                            value={expenseAccountId} 
                                            onChange={(e) => setExpenseAccountId(e.target.value)} 
                                            className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-orange-500 outline-none transition-all appearance-none"
                                        >
                                            <option value="">{t('quick.receivePayment.selectAccount')}...</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, userProfile?.currency || 'TRY')})</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="pt-4">
                                    <button 
                                        disabled={!expenseAmount || !expenseTitle} 
                                        onClick={handleSaveExpense} 
                                        className="w-full bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-orange-600/20 disabled:opacity-50 flex items-center justify-center transition-all active:scale-[0.98]"
                                    >
                                        <Save className="mr-2" size={20}/> {t('quick.addExpense.save')}
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
                            <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top))] border-b border-white/10 shrink-0 flex justify-between items-center bg-stone-900/80 backdrop-blur-xl sticky top-0">
                                <h2 className="text-lg font-bold text-stone-100 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                                        <CreditCard size={20}/> 
                                    </div>
                                    {t('quick.receivePayment.title')}
                                </h2>
                                <ModalCloseButton 
                                    onClick={() => changeActiveModal(null)} 
                                    label={t('common.close')}
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{farmerLabel} {t('quick.receivePayment.farmer')}</label>
                                    <select 
                                        value={paymentFarmerId} 
                                        onChange={(e) => setPaymentFarmerId(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-base focus:border-emerald-500 outline-none transition-all appearance-none"
                                    >
                                        <option value="">{farmerLabel} {t('quick.receivePayment.farmer')}...</option>
                                        {farmersWithBalances.map(f => {
                                            // overallBalance = ödenen - borç → negatif: borç, pozitif: alacak (fazla ödeme)
                                            const bal = Number(f.overallBalance) || 0;
                                            const balLabel = bal < 0 ? t('quick.balance.debt') : bal > 0 ? t('quick.balance.credit') : t('quick.balance.none');
                                            return (
                                                <option key={f.id} value={f.id}>
                                                    {f.fullName} ({balLabel}{bal !== 0 ? `: ${formatCurrency(Math.abs(bal), userProfile?.currency || 'TRY')}` : ''})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.receivePayment.amount')} ({getCurrencySymbol(userProfile?.currency || 'TRY')})</label>
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
                                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.receivePayment.account')}</label>
                                        <select 
                                            value={paymentAccountId} 
                                            onChange={(e) => setPaymentAccountId(e.target.value)} 
                                            className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-emerald-500 outline-none transition-all appearance-none"
                                        >
                                            <option value="">{t('quick.receivePayment.selectAccount')}...</option>
                                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, userProfile?.currency || 'TRY')})</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-400 uppercase tracking-wider block">{t('quick.receivePayment.method')}</label>
                                    <div className="grid grid-cols-4 gap-2 mb-3">
                                        {(['CASH', 'CARD', 'CHECK', 'OTHER'] as const).map((method) => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => setPaymentMethod(method)}
                                                className={`py-3 rounded-xl border text-[11px] font-bold transition-all ${paymentMethod === method ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-stone-900 border-white/5 text-stone-400'}`}
                                            >
                                                {method === 'CASH' ? t('quick.receivePayment.cash') : method === 'CARD' ? t('quick.receivePayment.card') : method === 'CHECK' ? t('quick.receivePayment.check') : t('quick.receivePayment.other')}
                                            </button>
                                        ))}
                                    </div>

                                    {paymentMethod === 'CARD' && (
                                        <div className="p-3 bg-stone-900 border border-emerald-500/20 rounded-2xl space-y-3 mb-3">
                                            <label className="text-[11px] font-bold text-stone-400 uppercase block mb-1">{t('quick.blockOption')}</label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {[
                                                    { id: 'UNBLOCKED', label: 'Blokesiz', desc: '%4 Komisyon' },
                                                    { id: 'DAYS_15', label: '15 Gün', desc: '%0 Komisyon' },
                                                    { id: 'DAYS_30', label: '30 Gün', desc: '%0 Komisyon' },
                                                    { id: 'DAYS_45', label: '45 Gün', desc: '%0 Komisyon' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => setPaymentCardOption(opt.id as any)}
                                                        className={`p-2 rounded-xl border text-left transition-all ${paymentCardOption === opt.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-stone-950 border-white/5 text-stone-400'}`}
                                                    >
                                                        <div className="text-[11px] font-bold">{opt.label}</div>
                                                        <div className="text-[11px] text-stone-400">{opt.desc}</div>
                                                    </button>
                                                ))}
                                            </div>

                                            {paymentCardOption === 'UNBLOCKED' && (
                                                <div className="flex items-center justify-between pt-1 border-t border-white/5">
                                                    <label htmlFor="quick-pos-commission" className="text-[11px] font-bold text-stone-400 uppercase">{t('quick.posCommission')}</label>
                                                    <input 
                                                        id="quick-pos-commission"
                                                        type="number"
                                                        step="0.1"
                                                        inputMode="decimal"
                                                        value={paymentCommissionRate}
                                                        onChange={e => setPaymentCommissionRate(e.target.value)}
                                                        className="w-20 h-11 px-2 bg-stone-950 border border-stone-800 rounded-lg text-right text-sm font-bold text-emerald-400 outline-none focus:border-emerald-500"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <input 
                                        type="text" 
                                        value={paymentNote} 
                                        onChange={(e) => setPaymentNote(e.target.value)} 
                                        className="w-full bg-stone-900 border border-white/10 rounded-2xl px-4 py-4 text-stone-100 text-sm focus:border-emerald-500 outline-none transition-all" 
                                        placeholder={t('quick.receivePayment.note')} 
                                    />
                                </div>
                                <div className="pt-4">
                                    <button 
                                        disabled={!paymentFarmerId || !paymentAmount || isSavingPayment} 
                                        onClick={handleSavePayment} 
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center transition-all active:scale-[0.98]"
                                    >
                                        <Save className="mr-2" size={20}/> {isSavingPayment ? t('quick.saving') : t('quick.receivePayment.save')}
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

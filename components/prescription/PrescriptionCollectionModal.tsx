import React, { useState } from 'react';
import { X, Wallet, Loader2, Check, Calendar, Download, Plus, Trash2, Split } from 'lucide-react';
import { format } from 'date-fns';
import { Farmer, Account, Payment, CardSettlementOption } from '../../types';
import { getCurrencySymbol, formatCurrency } from '../../utils/currency';
import { useBackHandler } from '../../utils/navigationManager';

interface PrescriptionCollectionModalProps {
    isOpen: boolean;
    farmers: Farmer[];
    accounts: Account[];
    currency?: string;
    selectedPaymentFarmerId: string;
    setSelectedPaymentFarmerId: (val: string) => void;
    paymentAmount: string;
    setPaymentAmount: (val: string) => void;
    selectedAccountId: string;
    setSelectedAccountId: (val: string) => void;
    paymentMethod: 'CASH' | 'CHECK' | 'TEDYE';
    setPaymentMethod: (val: 'CASH' | 'CHECK' | 'TEDYE') => void;
    paymentDate: string;
    setPaymentDate: (val: string) => void;
    paymentNote: string;
    setPaymentNote: (val: string) => void;
    isSavingPayment: boolean;
    setIsSavingPayment: (val: boolean) => void;
    editingPayment: Payment | null;
    activeTeamMemberId?: string;
    updatePayment: (p: Payment) => Promise<void>;
    addPayment: (p: Omit<Payment, 'id'>) => Promise<any>;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    hapticFeedback: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
    onClose: () => void;
    onSavedReset: () => void;
}

export const PrescriptionCollectionModal: React.FC<PrescriptionCollectionModalProps> = React.memo(({
    isOpen,
    farmers,
    accounts,
    currency,
    selectedPaymentFarmerId,
    setSelectedPaymentFarmerId,
    paymentAmount,
    setPaymentAmount,
    selectedAccountId,
    setSelectedAccountId,
    paymentMethod,
    setPaymentMethod,
    paymentDate,
    setPaymentDate,
    paymentNote,
    setPaymentNote,
    isSavingPayment,
    setIsSavingPayment,
    editingPayment,
    activeTeamMemberId,
    updatePayment,
    addPayment,
    showToast,
    hapticFeedback,
    onClose,
    onSavedReset,
}) => {
    const [isSplitMode, setIsSplitMode] = useState(false);
    const [splitRows, setSplitRows] = useState<{
        id: string;
        method: 'CASH' | 'CARD' | 'CHECK' | 'TEDYE';
        amount: string;
        accountId: string;
        dueDate: string;
        cardOption: CardSettlementOption;
    }[]>(() => [
        { id: 'row-1', method: 'CASH', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'UNBLOCKED' },
        { id: 'row-2', method: 'CARD', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'DAYS_30' },
    ]);

    // Donanım geri tuşu modalı kapatsın (sayfadan çıkmasın)
    useBackHandler(isOpen, onClose, 'prescription_collection_modal', 80);

    if (!isOpen) return null;

    const splitTotal = splitRows.reduce((sum, r) => {
        const val = parseFloat(r.amount.replace(/,/g, '.'));
        return sum + (isNaN(val) || val <= 0 ? 0 : val);
    }, 0);

    const validSplitRows = splitRows.filter(r => {
        const val = parseFloat(r.amount.replace(/,/g, '.'));
        return !isNaN(val) && val > 0;
    });

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-stone-900 rounded-3xl w-full max-w-md p-5 shadow-2xl relative border border-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh] pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                <button 
                    onClick={onClose} 
                    aria-label="Kapat"
                    className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 z-10"
                >
                    <X size={18} />
                </button>
                <div className="text-center mb-6 shrink-0">
                    <div className="w-12 h-12 bg-emerald-900/30 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Wallet size={24} />
                    </div>
                    <h2 className="text-base font-bold text-stone-100">Tahsilat Faturası</h2>
                    <p className="text-xs text-stone-400 mt-1">Çiftçiden ödeme tahsil et</p>
                </div>
                
                <div className="space-y-4 overflow-y-auto pr-2 pb-4 no-scrollbar">
                    <div>
                        <label className="block text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Çiftçi Seçimi <span className="text-rose-500">*</span></label>
                        <select 
                            className="w-full bg-stone-950 text-white px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/5 font-medium appearance-none"
                            value={selectedPaymentFarmerId}
                            onChange={(e) => setSelectedPaymentFarmerId(e.target.value)}
                        >
                            <option value="" disabled>Çiftçi Seçin...</option>
                            {farmers.map(f => (
                                <option key={f.id} value={f.id}>{f.fullName}</option>
                            ))}
                        </select>
                    </div>

                    {!editingPayment && (
                        <div className="flex items-center justify-between bg-stone-950/80 border border-white/5 rounded-2xl p-2.5">
                            <div className="flex items-center gap-2">
                                <Split size={15} className="text-emerald-400" />
                                <div>
                                    <span className="text-[11px] font-black text-stone-200 block">Parçalı / Karma Tahsilat</span>
                                    <span className="text-[9px] text-stone-500">Nakit + Kart + Çek aynı anda tahsil et</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSplitMode(prev => !prev)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                                    isSplitMode
                                        ? 'bg-emerald-600 text-white border-emerald-400'
                                        : 'bg-stone-900 text-stone-400 border-white/10 hover:text-white'
                                }`}
                            >
                                {isSplitMode ? 'Aktif' : 'Aç'}
                            </button>
                        </div>
                    )}

                    {isSplitMode && !editingPayment ? (
                        <div className="space-y-3">
                            {splitRows.map((row, idx) => (
                                <div key={row.id} className="bg-stone-950/90 border border-white/10 rounded-2xl p-3 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                            {idx + 1}. Ödeme Kalemi
                                        </span>
                                        {splitRows.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => setSplitRows(prev => prev.filter(r => r.id !== row.id))}
                                                className="p-1 text-stone-500 hover:text-rose-400"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {[
                                            { id: 'CASH', label: 'Nakit' },
                                            { id: 'CARD', label: 'Kart' },
                                            { id: 'CHECK', label: 'Çek' },
                                            { id: 'TEDYE', label: 'Tediye' }
                                        ].map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, method: m.id as any } : r))}
                                                className={`py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${
                                                    row.method === m.id
                                                        ? 'bg-emerald-600 border-emerald-500 text-white'
                                                        : 'bg-stone-900 border-stone-800 text-stone-400'
                                                }`}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            placeholder="Tutar (0.00)"
                                            value={row.amount}
                                            onChange={e => setSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: e.target.value } : r))}
                                            className="w-full bg-stone-900 text-emerald-400 px-3 py-2.5 rounded-xl outline-none border border-white/5 font-mono text-sm font-black"
                                        />
                                        <select
                                            value={row.accountId}
                                            onChange={e => setSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, accountId: e.target.value } : r))}
                                            className="w-full bg-stone-900 text-white px-2.5 py-2.5 rounded-xl outline-none border border-white/5 text-xs"
                                        >
                                            <option value="">Varsayılan Kasa/Banka</option>
                                            {accounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {row.method === 'CARD' && (
                                        <select
                                            value={row.cardOption}
                                            onChange={e => setSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, cardOption: e.target.value as CardSettlementOption } : r))}
                                            className="w-full bg-stone-900 text-amber-300 px-3 py-2 rounded-xl outline-none border border-amber-500/20 text-[11px] font-bold"
                                        >
                                            <option value="UNBLOCKED">Ertesi Gün / Blokesiz POS</option>
                                            <option value="DAYS_15">15 Gün POS Bloke (%0 Komisyon)</option>
                                            <option value="DAYS_30">30 Gün POS Bloke (%0 Komisyon)</option>
                                            <option value="DAYS_45">45 Gün POS Bloke (%0 Komisyon)</option>
                                        </select>
                                    )}
                                    {(row.method === 'CHECK' || row.method === 'TEDYE') && (
                                        <input
                                            type="date"
                                            value={row.dueDate}
                                            onChange={e => setSplitRows(prev => prev.map(r => r.id === row.id ? { ...r, dueDate: e.target.value } : r))}
                                            className="w-full bg-stone-900 text-white px-3 py-2 rounded-xl outline-none border border-white/5 text-xs"
                                        />
                                    )}
                                </div>
                            ))}

                            <div className="flex items-center justify-between pt-1">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSplitRows(prev => [
                                            ...prev,
                                            {
                                                id: `row-${Date.now()}`,
                                                method: 'CHECK',
                                                amount: '',
                                                accountId: '',
                                                dueDate: new Date().toISOString().split('T')[0],
                                                cardOption: 'UNBLOCKED'
                                            }
                                        ])
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                                >
                                    <Plus size={12} /> Kalem Ekle
                                </button>
                                <div className="text-right">
                                    <span className="text-[9px] font-black text-stone-500 uppercase block">Toplam Karma Tahsilat</span>
                                    <span className="text-base font-black text-emerald-400 font-mono">
                                        {formatCurrency(splitTotal, (currency as any) || 'TRY')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                    <>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Tutar ({getCurrencySymbol((currency as any) || 'TRY')}) <span className="text-rose-500">*</span></label>
                            <input 
                                type="number" 
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-stone-950 text-emerald-400 px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/5 font-mono text-lg font-black"
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Kasa/Banka</label>
                            <select 
                                className="w-full bg-stone-950 text-white px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/5 font-medium appearance-none"
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                            >
                                <option value="">Seçiniz (Opsiyonel)</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Ödeme Yöntemi <span className="text-rose-500">*</span></label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'CASH', label: 'Nakit' },
                                { id: 'CHECK', label: 'Çek' },
                                { id: 'TEDYE', label: 'Tediye' }
                            ].map(method => (
                                <button 
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id as any)}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${paymentMethod === method.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-stone-950 border-stone-800 text-stone-500'}`}
                                >
                                    {method.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">
                            {(paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') ? 'Vade Tarihi' : 'İşlem Tarihi'}
                        </label>
                        <input 
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full bg-stone-950 text-white px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/5 font-medium"
                        />
                    </div>
                    </>
                    )}

                    <div>
                        <label className="block text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Açıklama (Opsiyonel)</label>
                        <textarea 
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="Makbuz notu..."
                            className="w-full bg-stone-950 text-white px-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/5 font-medium resize-none h-20"
                        />
                    </div>
                </div>

                <div className="pt-4 mt-2 border-t border-white/5 shrink-0 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl font-bold text-sm transition-all"
                    >
                        İptal
                    </button>
                    <button 
                        disabled={isSavingPayment || !selectedPaymentFarmerId || (isSplitMode && !editingPayment ? validSplitRows.length === 0 : !paymentAmount)}
                        onClick={async () => {
                            setIsSavingPayment(true);
                            try {
                                if (isSplitMode && !editingPayment) {
                                    if (validSplitRows.length === 0) {
                                        showToast('En az bir geçerli ödeme tutarı giriniz', 'error');
                                        setIsSavingPayment(false);
                                        return;
                                    }
                                    const nowIso = new Date().toISOString();
                                    for (let i = 0; i < validSplitRows.length; i++) {
                                        const row = validSplitRows[i];
                                        const amt = parseFloat(row.amount.replace(/,/g, '.'));
                                        const defaultAcc =
                                            row.method === 'CARD'
                                                ? (accounts.find(a => a.type === 'BANK')?.id || accounts[0]?.id)
                                                : (accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id);
                                        await addPayment({
                                            farmerId: selectedPaymentFarmerId,
                                            amount: amt,
                                            date: nowIso,
                                            method: row.method,
                                            cardOption: row.method === 'CARD' ? row.cardOption : undefined,
                                            dueDate: (row.method === 'CHECK' || row.method === 'TEDYE') ? row.dueDate : undefined,
                                            note: `${paymentNote ? paymentNote + ' • ' : ''}Karma Tahsilat (${i + 1}/${validSplitRows.length})`,
                                            accountId: row.accountId || defaultAcc || undefined,
                                            createdById: activeTeamMemberId
                                        });
                                    }
                                    showToast(`${validSplitRows.length} kalem karma tahsilat kaydedildi`, 'success');
                                    setIsSplitMode(false);
                                    setSplitRows([
                                        { id: 'row-1', method: 'CASH', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'UNBLOCKED' },
                                        { id: 'row-2', method: 'CARD', amount: '', accountId: '', dueDate: new Date().toISOString().split('T')[0], cardOption: 'DAYS_30' },
                                    ]);
                                    hapticFeedback('success');
                                    onSavedReset();
                                    return;
                                }

                                const parsedAmount = parseFloat(paymentAmount.replace(/,/g, ''));
                                if (isNaN(parsedAmount) || parsedAmount <= 0) {
                                    showToast('Geçerli bir tutar giriniz', 'error');
                                    setIsSavingPayment(false);
                                    return;
                                }

                                const targetAccountId = selectedAccountId || accounts.find(a => a.type === 'CASH')?.id || accounts[0]?.id;

                                if (editingPayment) {
                                    await updatePayment({
                                        ...editingPayment,
                                        amount: parsedAmount,
                                        note: paymentNote,
                                        method: paymentMethod,
                                        dueDate: (paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') ? paymentDate : undefined,
                                        accountId: targetAccountId || undefined,
                                        farmerId: selectedPaymentFarmerId
                                    });
                                    showToast('Tahsilat güncellendi', 'success');
                                } else {
                                    await addPayment({
                                        farmerId: selectedPaymentFarmerId,
                                        amount: parsedAmount,
                                        date: new Date().toISOString(),
                                        method: paymentMethod,
                                        dueDate: (paymentMethod === 'CHECK' || paymentMethod === 'TEDYE') ? paymentDate : undefined,
                                        note: paymentNote,
                                        accountId: targetAccountId || undefined,
                                        createdById: activeTeamMemberId
                                    });
                                    showToast('Tahsilat kaydedildi', 'success');
                                }

                                hapticFeedback('success');
                                onSavedReset();
                            } catch (e) {
                                showToast('Tahsilat kaydedilemedi', 'error');
                            } finally {
                                setIsSavingPayment(false);
                            }
                        }}
                        className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            isSavingPayment || !selectedPaymentFarmerId || (isSplitMode && !editingPayment ? validSplitRows.length === 0 : !paymentAmount)
                            ? 'bg-emerald-900/50 text-emerald-700 cursor-not-allowed' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 active:scale-95'
                        }`}
                    >
                        {isSavingPayment ? <Loader2 size={18} className="animate-spin" /> : <><Check size={18} /> Kaydet</>}
                    </button>
                </div>
            </div>
        </div>
    );
});

PrescriptionCollectionModal.displayName = 'PrescriptionCollectionModal';

interface PrescriptionReportRangeModalProps {
    isOpen: boolean;
    reportTypeSelection: 'SUMMARY' | 'DETAILED';
    setReportTypeSelection: (val: 'SUMMARY' | 'DETAILED') => void;
    reportStartDate: string;
    setReportStartDate: (val: string) => void;
    reportEndDate: string;
    setReportEndDate: (val: string) => void;
    isGeneratingReport: boolean;
    onClose: () => void;
    onGenerate: () => void;
}

export const PrescriptionReportRangeModal: React.FC<PrescriptionReportRangeModalProps> = React.memo(({
    isOpen,
    reportTypeSelection,
    setReportTypeSelection,
    reportStartDate,
    setReportStartDate,
    reportEndDate,
    setReportEndDate,
    isGeneratingReport,
    onClose,
    onGenerate,
}) => {
    useBackHandler(isOpen, onClose, 'prescription_report_range_modal', 80);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-stone-100 flex items-center gap-2">
                        <Calendar className="text-emerald-500" size={20} />
                        Tarih Aralığı Seçin
                    </h2>
                    <button onClick={onClose} aria-label="Kapat" className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Rapor Türü</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setReportTypeSelection('SUMMARY')}
                                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${reportTypeSelection === 'SUMMARY' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-stone-950 border-white/5 text-stone-400 hover:bg-stone-800'}`}
                            >
                                Sadece Fatura (Özet)
                            </button>
                            <button 
                                onClick={() => setReportTypeSelection('DETAILED')}
                                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${reportTypeSelection === 'DETAILED' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400' : 'bg-stone-950 border-white/5 text-stone-400 hover:bg-stone-800'}`}
                            >
                                Detaylı Rapor
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Başlangıç</label>
                            <input 
                                type="date" 
                                className="w-full bg-stone-950 text-white rounded-xl p-3 border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                                value={reportStartDate}
                                onChange={e => setReportStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Bitiş</label>
                            <input 
                                type="date" 
                                className="w-full bg-stone-950 text-white rounded-xl p-3 border border-white/5 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm font-medium"
                                value={reportEndDate}
                                onChange={e => setReportEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold transition-colors"
                            onClick={() => {
                                const today = new Date();
                                setReportStartDate(format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
                                setReportEndDate(format(today, 'yyyy-MM-dd'));
                            }}
                        >
                            Bu Ay
                        </button>
                        <button 
                            className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold transition-colors"
                            onClick={() => {
                                const today = new Date();
                                setReportStartDate(format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'));
                                setReportEndDate(format(today, 'yyyy-MM-dd'));
                            }}
                        >
                            Bu Yıl
                        </button>
                        <button 
                            className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold transition-colors"
                            onClick={() => {
                                setReportStartDate('2020-01-01');
                                setReportEndDate(format(new Date(), 'yyyy-MM-dd'));
                            }}
                        >
                            Tümü
                        </button>
                    </div>
                    <button 
                        onClick={onGenerate}
                        disabled={isGeneratingReport}
                        className="w-full mt-4 py-3.5 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center hover:bg-emerald-500 active:scale-95 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                    >
                        {isGeneratingReport ? (
                            <><Loader2 size={18} className="mr-2 animate-spin" /> Hazırlanıyor...</>
                        ) : (
                            <><Download size={18} className="mr-2" /> PDF Oluştur</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});

PrescriptionReportRangeModal.displayName = 'PrescriptionReportRangeModal';

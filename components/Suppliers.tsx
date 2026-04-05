
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Truck, Plus, Trash2, Edit2, ChevronRight, ChevronLeft, 
    Package, CreditCard, ArrowUpRight, ArrowDownRight, 
    Search, Phone, MapPin, Calendar, DollarSign, 
    AlertCircle, CheckCircle2, FlaskConical, Info, X, User, RefreshCcw,
    Receipt, Save, Barcode
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { useAppViewModel } from '../context/AppContext';
import { dbService } from '../services/db';
import { Supplier, SupplierPurchase, SupplierPayment, PesticideCategory, InventoryItem } from '../types';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export const Suppliers: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { 
        suppliers, addSupplier, updateSupplier, 
        addSupplierPurchase, updateSupplierPurchase, deleteSupplierPurchase,
        addSupplierPayment, updateSupplierPayment, deleteSupplierPayment,
        softDeleteSupplier,
        inventory, addInventoryItem, showToast, hapticFeedback,
        prescriptions,
        accounts, userProfile,
        activeTeamMember,
        teamMembers,
        visits,
        isInitialized
    } = useAppViewModel();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isLoading, setIsLoading] = useState(!isInitialized);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    
    useEffect(() => {
        if (isInitialized) {
            setIsLoading(false);
        }
    }, [isInitialized]);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    // Form States
    const [newSupplier, setNewSupplier] = useState({ name: '', phoneNumber: '', address: '' });
    const [newPayment, setNewPayment] = useState({ amount: '', method: 'CASH' as any, note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0 });
    const [newPurchase, setNewPurchase] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number }[],
        note: string,
        receiptNo: string
    }>({ items: [], note: '', receiptNo: '' });
    const [newReturn, setNewReturn] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number }[],
        note: string,
        receiptNo: string
    }>({ items: [], note: '', receiptNo: '' });
    
    // New Pesticide Form (Inside Purchase)
    const [isAddingNewPesticide, setIsAddingNewPesticide] = useState(false);
    const [newPesticide, setNewPesticide] = useState({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [suppliers, searchTerm]);

    const handleAddSupplier = async () => {
        if (!newSupplier.name) return;
        await addSupplier(newSupplier);
        setIsAddModalOpen(false);
        setNewSupplier({ name: '', phoneNumber: '', address: '' });
        showToast('Tedarikçi başarıyla eklendi', 'success');
    };

    const handleUpdateSupplier = async () => {
        if (!editingSupplier || !editingSupplier.name) return;
        await updateSupplier(editingSupplier);
        setIsEditModalOpen(false);
        setEditingSupplier(null);
        showToast('Tedarikçi güncellendi', 'success');
    };

    const handleAddPurchase = async () => {
        if (!selectedSupplier || newPurchase.items.length === 0) return;
        
        const totalAmount = newPurchase.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);
        
        await addSupplierPurchase({
            supplierId: selectedSupplier.id,
            date: new Date().toISOString(),
            receiptNo: newPurchase.receiptNo,
            items: newPurchase.items,
            totalAmount,
            note: newPurchase.note,
            createdById: activeTeamMember?.id
        });
        
        setIsPurchaseModalOpen(false);
        setNewPurchase({ items: [], note: '', receiptNo: '' });
        showToast('Alım başarıyla kaydedildi ve depoya aktarıldı', 'success');
    };

    const handleAddReturn = async () => {
        if (!selectedSupplier || newReturn.items.length === 0) return;
        
        const totalAmount = newReturn.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);
        
        // Convert quantities to negative for returns
        const returnItems = newReturn.items.map(item => ({
            ...item,
            quantity: -Math.abs(item.quantity)
        }));

        await addSupplierPurchase({
            supplierId: selectedSupplier.id,
            date: new Date().toISOString(),
            receiptNo: newReturn.receiptNo,
            items: returnItems,
            totalAmount: -Math.abs(totalAmount),
            note: newReturn.note ? `İADE: ${newReturn.note}` : 'İADE',
            createdById: activeTeamMember?.id
        });
        
        setIsReturnModalOpen(false);
        setNewReturn({ items: [], note: '', receiptNo: '' });
        showToast('İade başarıyla kaydedildi ve depodan düşüldü', 'success');
    };

    const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);

    const handleAddPayment = async () => {
        if (!selectedSupplier || !newPayment.amount) return;
        
        if (editingPayment) {
            await updateSupplierPayment({
                ...editingPayment,
                amount: parseFloat(newPayment.amount),
                method: newPayment.method,
                dueDate: (newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') ? newPayment.dueDate : undefined,
                note: newPayment.note,
                accountId: newPayment.accountId || undefined
            });
            showToast('Ödeme güncellendi', 'success');
        } else {
            await addSupplierPayment({
                supplierId: selectedSupplier.id,
                amount: parseFloat(newPayment.amount),
                date: new Date().toISOString(),
                method: newPayment.method,
                dueDate: (newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') ? newPayment.dueDate : undefined,
                note: newPayment.note,
                accountId: newPayment.accountId || undefined,
                createdById: activeTeamMember?.id,
                installments: newPayment.method === 'CARD' ? newPayment.installments : undefined,
                producerCardMonths: newPayment.method === 'CARD' ? newPayment.producerCardMonths : undefined
            });
            showToast('Ödeme kaydedildi', 'success');
        }
        
        setIsPaymentModalOpen(false);
        setEditingPayment(null);
        setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0 });
    };

    const handleEditPayment = (payment: SupplierPayment) => {
        setEditingPayment(payment);
        setNewPayment({
            amount: payment.amount.toString(),
            method: payment.method,
            note: payment.note || '',
            dueDate: payment.dueDate || new Date().toISOString().split('T')[0],
            accountId: payment.accountId || '',
            installments: payment.installments || 1,
            producerCardMonths: payment.producerCardMonths || 0
        });
        setIsPaymentModalOpen(true);
    };

    const handleAddNewPesticideToPurchase = () => {
        if (!newPesticide.name) return;
        
        const tempId = `new-${crypto.randomUUID()}`;
        const newItem = {
            pesticideId: tempId,
            pesticideName: newPesticide.name,
            quantity: 1,
            unit: newPesticide.unit,
            buyingPrice: 0
        };
        
        setNewPurchase(prev => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
        
        setIsAddingNewPesticide(false);
        setNewPesticide({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
    };

    // Helper to get stats for a product (bought/sold)
    const getProductStats = (pesticideId: string) => {
        const item = inventory.find(i => i.pesticideId === pesticideId);
        const soldCount = prescriptions.reduce((acc, p) => {
            const pItem = p.items.find(i => i.pesticideId === pesticideId);
            if (pItem && pItem.quantity) {
                return acc + (parseInt(pItem.quantity) || 0);
            }
            return acc;
        }, 0);
        
        return {
            stock: item?.quantity || 0,
            sold: soldCount,
            unit: item?.unit || 'Adet'
        };
    };

    const handleClosePayment = () => {
        setIsPaymentModalOpen(false);
        setEditingPayment(null);
        setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0 });
    };

    if (selectedSupplier) {
        return (
            <SupplierDetailView 
                supplier={selectedSupplier} 
                onBack={() => setSelectedSupplier(null)}
                onOpenPurchase={() => setIsPurchaseModalOpen(true)}
                onOpenPayment={() => {
                    setEditingPayment(null);
                    setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0 });
                    setIsPaymentModalOpen(true);
                }}
                onOpenDebt={() => setIsDebtModalOpen(true)}
                onOpenReturn={() => setIsReturnModalOpen(true)}
                getProductStats={getProductStats}
                isPurchaseModalOpen={isPurchaseModalOpen}
                setIsPurchaseModalOpen={setIsPurchaseModalOpen}
                handleAddPurchase={handleAddPurchase}
                newPurchase={newPurchase}
                setNewPurchase={setNewPurchase}
                inventory={inventory}
                isAddingNewPesticide={isAddingNewPesticide}
                setIsAddingNewPesticide={setIsAddingNewPesticide}
                newPesticide={newPesticide}
                setNewPesticide={setNewPesticide}
                handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                isPaymentModalOpen={isPaymentModalOpen}
                setIsPaymentModalOpen={setIsPaymentModalOpen}
                handleAddPayment={handleAddPayment}
                newPayment={newPayment}
                setNewPayment={setNewPayment}
                isDebtModalOpen={isDebtModalOpen}
                setIsDebtModalOpen={setIsDebtModalOpen}
                addSupplierPurchase={addSupplierPurchase}
                updateSupplierPurchase={updateSupplierPurchase}
                deleteSupplierPurchase={deleteSupplierPurchase}
                deleteSupplierPayment={deleteSupplierPayment}
                handleEditPayment={handleEditPayment}
                handleClosePayment={handleClosePayment}
                editingPayment={editingPayment}
                showToast={showToast}
                isReturnModalOpen={isReturnModalOpen}
                setIsReturnModalOpen={setIsReturnModalOpen}
                handleAddReturn={handleAddReturn}
                newReturn={newReturn}
                setNewReturn={setNewReturn}
                onEdit={(s: Supplier) => { setEditingSupplier(s); setIsEditModalOpen(true); }}
                accounts={accounts}
                softDeleteSupplier={softDeleteSupplier}
            />
        );
    }

    return (
        <div className="p-4 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black text-stone-100 tracking-tight">Tedarikçiler</h1>
                </div>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-2"
                >
                    <Plus size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Yeni Ekle</span>
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                <input 
                    type="text" 
                    placeholder="Tedarikçi ara..."
                    className="w-full bg-stone-900 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-stone-200 outline-none focus:border-emerald-500/50 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? (
                    <div className="col-span-1 md:col-span-2">
                        <ListSkeleton count={4} />
                    </div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="col-span-1 md:col-span-2">
                        <EmptyState
                            icon={Package}
                            title={searchTerm ? "Tedarikçi bulunamadı" : "Henüz tedarikçi eklenmemiş"}
                            description={!searchTerm ? "İlk tedarikçinizi ekleyerek alım ve ödeme takibine başlayın." : ""}
                            actionLabel={!searchTerm ? "Yeni Tedarikçi Ekle" : undefined}
                            onAction={!searchTerm ? () => setIsAddModalOpen(true) : undefined}
                            actionIcon={Plus}
                        />
                    </div>
                ) : filteredSuppliers.map(supplier => (
                    <div 
                        key={supplier.id}
                        onClick={() => setSelectedSupplier(supplier)}
                        className="bg-stone-900 border border-white/5 rounded-[1.8rem] p-5 hover:border-emerald-500/30 transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center text-emerald-500 border border-white/5">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <h3 className="font-black text-stone-100 text-base tracking-tight">{supplier.name}</h3>
                                    <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                        <Phone size={10} />
                                        {supplier.phoneNumber || 'Telefon Yok'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingSupplier(supplier); setIsEditModalOpen(true); }}
                                    className="p-2 bg-stone-800 text-stone-400 rounded-xl hover:text-emerald-400 transition-colors active:scale-90"
                                >
                                    <Edit2 size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-stone-950/50 p-3 rounded-2xl border border-white/5">
                                <span className="text-[9px] text-stone-500 font-black uppercase tracking-widest block mb-1">Toplam Alım</span>
                                <span className="text-stone-200 font-black font-mono text-sm">
                                    {formatCurrency(Math.round(supplier.totalDebt), userProfile?.currency || 'TRY')}
                                </span>
                            </div>
                            <div className={`p-3 rounded-2xl border ${supplier.balance < 0 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                                <span className="text-[9px] text-stone-500 font-black uppercase tracking-widest block mb-1">Bakiye</span>
                                <span className={`font-black font-mono text-sm ${supplier.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {formatCurrency(Math.round(Math.abs(supplier.balance)), userProfile?.currency || 'TRY')}
                                    {supplier.balance < 0 && <span className="text-[8px] ml-1 opacity-60 font-sans">(Borç)</span>}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Supplier Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                            <Truck className="text-emerald-500" />
                            Yeni Tedarikçi
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Tedarikçi Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="Örn: Akdeniz Tarım"
                                    value={newSupplier.name}
                                    onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Telefon</label>
                                <input 
                                    type="tel" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder="05xx xxx xx xx"
                                    value={newSupplier.phoneNumber}
                                    onChange={(e) => setNewSupplier({...newSupplier, phoneNumber: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Adres</label>
                                <textarea 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all h-24 resize-none"
                                    placeholder="Tedarikçi adresi..."
                                    value={newSupplier.address}
                                    onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
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
                                onClick={handleAddSupplier}
                                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Supplier Modal */}
            {isEditModalOpen && editingSupplier && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                            <Edit2 className="text-emerald-500" />
                            Tedarikçi Düzenle
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Tedarikçi Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    value={editingSupplier.name}
                                    onChange={(e) => setEditingSupplier({...editingSupplier, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Telefon</label>
                                <input 
                                    type="tel" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    value={editingSupplier.phoneNumber}
                                    onChange={(e) => setEditingSupplier({...editingSupplier, phoneNumber: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Adres</label>
                                <textarea 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all h-24 resize-none"
                                    value={editingSupplier.address}
                                    onChange={(e) => setEditingSupplier({...editingSupplier, address: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={handleUpdateSupplier}
                                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                            >
                                Güncelle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />
        </div>
    );
};

const DebtModal = ({ supplier, onClose, onSave }: any) => {
    const { userProfile, teamMembers } = useAppViewModel();
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                    <AlertCircle className="text-amber-500" />
                    Borç Ekle
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Borç Tutarı ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                        <input 
                            type="number" 
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-amber-500/50 transition-all font-mono"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Açıklama</label>
                        <textarea 
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-amber-500/50 transition-all h-24 resize-none"
                            placeholder="Borç nedeni..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-8">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                    >
                        İptal
                    </button>
                    <button 
                        onClick={() => onSave(parseFloat(amount), note)}
                        className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-amber-900/20"
                    >
                        Borcu Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};

const SupplierDetailView = ({ 
    supplier, onBack, onOpenPurchase, onOpenPayment, onOpenDebt, onOpenReturn, getProductStats,
    isPurchaseModalOpen, setIsPurchaseModalOpen, handleAddPurchase, newPurchase, setNewPurchase, inventory,
    isAddingNewPesticide, setIsAddingNewPesticide, newPesticide, setNewPesticide, handleAddNewPesticideToPurchase,
    isPaymentModalOpen, setIsPaymentModalOpen, handleAddPayment, newPayment, setNewPayment, handleEditPayment, handleClosePayment, editingPayment,
    isDebtModalOpen, setIsDebtModalOpen, addSupplierPurchase, updateSupplierPurchase, deleteSupplierPurchase, deleteSupplierPayment, showToast,
    isReturnModalOpen, setIsReturnModalOpen, handleAddReturn, newReturn, setNewReturn,
    onEdit, accounts, softDeleteSupplier
}: any) => {
    const { userProfile, teamMembers } = useAppViewModel();
    const [activeTab, setActiveTab] = useState<'PURCHASES' | 'PAYMENTS'>('PURCHASES');
    const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
    const [payments, setPayments] = useState<SupplierPayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingPurchase, setEditingPurchase] = useState<SupplierPurchase | null>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const loadData = async () => {
        setIsLoading(true);
        const [purchList, payList] = await Promise.all([
            dbService.getSupplierPurchases(supplier.id),
            dbService.getSupplierPayments(supplier.id)
        ]);
        setPurchases(purchList.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setPayments(payList.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setIsLoading(false);
    };

    React.useEffect(() => {
        loadData();
    }, [supplier]);

    const handleDeletePurchase = async (id: string) => {
        console.log('Tedarikçi alımı siliniyor:', id);
        setConfirmModal({
            isOpen: true,
            title: 'Alım Kaydı Silinecek',
            message: 'Bu alım kaydını silmek istediğinize emin misiniz? Stoklar geri alınacaktır.',
            onConfirm: async () => {
                try {
                    await deleteSupplierPurchase(id);
                    showToast('Alım kaydı silindi', 'info');
                    await loadData();
                } catch (error) {
                    console.error('Alım silme hatası:', error);
                    showToast('Alım silinirken bir hata oluştu', 'error');
                }
            }
        });
    };

    const handleDeletePayment = async (id: string) => {
        console.log('Tedarikçi ödemesi siliniyor:', id);
        setConfirmModal({
            isOpen: true,
            title: 'Ödeme Kaydı Silinecek',
            message: 'Bu ödeme kaydını silmek istediğinize emin misiniz?',
            onConfirm: async () => {
                try {
                    await deleteSupplierPayment(id);
                    showToast('Ödeme kaydı silindi', 'info');
                    await loadData();
                } catch (error) {
                    console.error('Ödeme silme hatası:', error);
                    showToast('Ödeme silinirken bir hata oluştu', 'error');
                }
            }
        });
    };

    const handleUpdatePurchase = async () => {
        if (!editingPurchase) return;
        await updateSupplierPurchase(editingPurchase);
        setEditingPurchase(null);
        showToast('Alım kaydı güncellendi', 'success');
        loadData();
    };

    // Unique products purchased from this supplier
    const purchasedProducts = useMemo(() => {
        const productMap = new Map<string, { id: string, name: string, totalQty: number, unit: string }>();
        purchases.forEach(p => {
            p.items.forEach(item => {
                const existing = productMap.get(item.pesticideId);
                if (existing) {
                    existing.totalQty += item.quantity;
                } else {
                    productMap.set(item.pesticideId, { 
                        id: item.pesticideId, 
                        name: item.pesticideName, 
                        totalQty: item.quantity,
                        unit: item.unit
                    });
                }
            });
        });
        return Array.from(productMap.values());
    }, [purchases]);

    return (
        <div className="p-4 space-y-6 animate-in slide-in-from-right duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-black text-stone-100 tracking-tight">{supplier.name}</h1>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => onEdit(supplier)}
                        className="p-2.5 bg-stone-900 text-stone-400 rounded-xl hover:text-emerald-400 transition-colors border border-white/5 active:scale-95"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button 
                        onClick={async () => {
                            setConfirmModal({
                                isOpen: true,
                                title: 'Tedarikçi Silinecek',
                                message: 'Bu tedarikçiyi ve tüm kayıtlarını silmek istediğinize emin misiniz?',
                                onConfirm: async () => {
                                    await softDeleteSupplier(supplier.id);
                                    showToast('Tedarikçi silindi', 'info');
                                }
                            });
                        }}
                        className="p-2.5 bg-stone-900 text-stone-400 rounded-xl hover:text-rose-400 transition-colors border border-white/5 active:scale-95"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-900 border border-white/5 p-4 rounded-3xl">
                    <span className="text-[10px] text-stone-500 font-black uppercase tracking-widest block mb-1">Toplam Alım</span>
                    <div className="text-xl font-black text-stone-100 font-mono">
                        {formatCurrency(Math.round(supplier.totalDebt), userProfile?.currency || 'TRY')}
                    </div>
                </div>
                <div className={`p-4 rounded-3xl border ${supplier.balance < 0 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                    <span className="text-[10px] text-stone-500 font-black uppercase tracking-widest block mb-1">Bakiye</span>
                    <div className={`text-xl font-black font-mono ${supplier.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatCurrency(Math.round(Math.abs(supplier.balance)), userProfile?.currency || 'TRY')}
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-60">
                        {supplier.balance < 0 ? 'Ödenecek Borç' : 'Alacaklı'}
                    </span>
                </div>
            </div>

            <div className="flex gap-1 sm:gap-2">
                <button 
                    onClick={onOpenPurchase}
                    className="flex-1 py-2 sm:py-3 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold text-[9px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 active:scale-95 transition-all"
                >
                    <Package size={14} />
                    <span className="text-center">Alış Yap</span>
                </button>
                <button 
                    onClick={onOpenPayment}
                    className="flex-1 py-2 sm:py-3 bg-blue-600 text-white rounded-xl sm:rounded-2xl font-bold text-[9px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 active:scale-95 transition-all"
                >
                    <CreditCard size={14} />
                    <span className="text-center">Ödeme Yap</span>
                </button>
                <button 
                    onClick={onOpenDebt}
                    className="flex-1 py-2 sm:py-3 bg-amber-600 text-white rounded-xl sm:rounded-2xl font-bold text-[9px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 active:scale-95 transition-all"
                >
                    <AlertCircle size={14} />
                    <span className="text-center">Borç Ekle</span>
                </button>
                <button 
                    onClick={onOpenReturn}
                    className="flex-1 py-2 sm:py-3 bg-rose-600 text-white rounded-xl sm:rounded-2xl font-bold text-[9px] sm:text-xs uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 active:scale-95 transition-all"
                >
                    <RefreshCcw size={14} />
                    <span className="text-center">İade Yap</span>
                </button>
            </div>

            <div className="flex bg-stone-900/50 p-1 rounded-2xl border border-white/5">
                <button 
                    onClick={() => setActiveTab('PURCHASES')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PURCHASES' ? 'bg-stone-800 text-emerald-400 shadow-sm' : 'text-stone-500'}`}
                >
                    Alımlar
                </button>
                <button 
                    onClick={() => setActiveTab('PAYMENTS')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PAYMENTS' ? 'bg-stone-800 text-blue-400 shadow-sm' : 'text-stone-500'}`}
                >
                    Ödemeler
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {activeTab === 'PURCHASES' ? (
                        <>
                            <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] pl-1">Alınan Ürünler</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {purchasedProducts.map(product => {
                                    const stats = getProductStats(product.id);
                                    return (
                                        <div key={product.id} className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/20 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-stone-950 flex items-center justify-center text-emerald-500">
                                                    <FlaskConical size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-stone-200 text-sm">{product.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Toplam Alınan:</span>
                                                        <span className="text-[10px] font-black text-stone-300 font-mono">{product.totalQty} {product.unit}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Stok:</span>
                                                    <span className={`text-xs font-black font-mono ${stats.stock === 0 ? 'text-rose-500' : 'text-emerald-400'}`}>{stats.stock}</span>
                                                </div>
                                                <div className="flex items-center gap-2 justify-end mt-0.5">
                                                    <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">Satılan:</span>
                                                    <span className="text-xs font-black text-blue-400 font-mono">{stats.sold}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {purchasedProducts.length === 0 && (
                                    <div className="py-12 text-center">
                                        <Package size={40} className="text-stone-800 mx-auto mb-3" />
                                        <p className="text-stone-600 text-xs font-medium">Henüz ürün alımı yapılmamış.</p>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] pl-1 mt-6">İşlem Geçmişi</h3>
                            <div className="space-y-3">
                                {isLoading ? (
                                    <ListSkeleton count={3} />
                                ) : purchases.length === 0 ? (
                                    <EmptyState
                                        icon={Package}
                                        title="Alım/İade kaydı yok"
                                        description="Bu tedarikçiden henüz bir alım veya iade işlemi yapılmamış."
                                    />
                                ) : purchases.map(purchase => (
                                    <div key={purchase.id} className="bg-stone-900/40 border border-white/5 rounded-2xl p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${purchase.totalAmount < 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                    {purchase.totalAmount < 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-stone-300 uppercase tracking-wider">{purchase.totalAmount < 0 ? 'Ürün İadesi' : 'Ürün Alımı'}</span>
                                                    {purchase.receiptNo && (
                                                        <span className={`text-[8px] font-bold uppercase tracking-widest ${purchase.totalAmount < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>Fiş No: {purchase.receiptNo}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-stone-500 font-mono flex items-center gap-1">
                                                    {new Date(purchase.date).toLocaleDateString('tr-TR')}
                                                    <span className="flex items-center bg-stone-800/50 px-1 py-0.5 rounded ml-1">
                                                        <User size={8} className="mr-0.5" />
                                                        {purchase.createdById ? (teamMembers.find((m: any) => m.id === purchase.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                                    </span>
                                                </span>
                                                <button 
                                                    onClick={() => setEditingPurchase(purchase)}
                                                    className="p-1.5 text-stone-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeletePurchase(purchase.id)}
                                                    className="p-2 text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-95"
                                                    title="Alımı Sil"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 mb-3">
                                            {purchase.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-[11px]">
                                                    <span className="text-stone-400">{item.pesticideName} ({item.quantity} {item.unit})</span>
                                                    <span className="text-stone-500 font-mono">{formatCurrency(item.buyingPrice * item.quantity, userProfile?.currency || 'TRY')}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Toplam</span>
                                            <span className="text-sm font-black text-stone-100 font-mono">{formatCurrency(purchase.totalAmount, userProfile?.currency || 'TRY')}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            {isLoading ? (
                                <ListSkeleton count={3} />
                            ) : payments.length === 0 ? (
                                <EmptyState
                                    icon={CreditCard}
                                    title="Ödeme kaydı yok"
                                    description="Bu tedarikçiye henüz bir ödeme yapılmamış."
                                />
                            ) : payments.map(payment => (
                                <div key={payment.id} className="bg-stone-900/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <CreditCard size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-stone-200 uppercase tracking-wider">Ödeme Yapıldı</span>
                                                <span className="text-[8px] font-bold text-stone-600 bg-stone-950 px-1.5 py-0.5 rounded uppercase tracking-widest">{payment.method}</span>
                                            </div>
                                            <div className="text-[9px] text-stone-500 font-mono mt-0.5 flex items-center gap-1">
                                                {new Date(payment.date).toLocaleDateString('tr-TR')}
                                                <span className="flex items-center bg-stone-800/50 px-1 py-0.5 rounded ml-1">
                                                    <User size={8} className="mr-0.5" />
                                                    {payment.createdById ? (teamMembers.find((m: any) => m.id === payment.createdById)?.fullName || 'Yönetici') : 'Yönetici'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <div className="text-sm font-black text-emerald-400 font-mono">-{formatCurrency(payment.amount, userProfile?.currency || 'TRY')}</div>
                                            {payment.note && <div className="text-[8px] text-stone-600 italic truncate max-w-[100px]">{payment.note}</div>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleEditPayment(payment)}
                                                className="p-2.5 text-stone-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all active:scale-95 border border-transparent hover:border-emerald-500/20"
                                                title="Ödemeyi Düzenle"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePayment(payment.id)}
                                                className="p-2.5 text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-95 border border-transparent hover:border-rose-500/20"
                                                title="Ödemeyi Sil"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {payments.length === 0 && (
                                <div className="py-12 text-center">
                                    <CreditCard size={40} className="text-stone-800 mx-auto mb-3" />
                                    <p className="text-stone-600 text-xs font-medium">Henüz ödeme kaydı yok.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Purchase Modal */}
            {isPurchaseModalOpen && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setIsPurchaseModalOpen(false)}
                    onSave={handleAddPurchase}
                    newPurchase={newPurchase}
                    setNewPurchase={setNewPurchase}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    userProfile={userProfile}
                    showToast={showToast}
                />
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && (
                <PaymentModal 
                    supplier={supplier}
                    onClose={handleClosePayment}
                    onSave={handleAddPayment}
                    newPayment={newPayment}
                    setNewPayment={setNewPayment}
                    accounts={accounts}
                    userProfile={userProfile}
                    isEdit={!!editingPayment}
                />
            )}

            {/* Debt Modal */}
            {isDebtModalOpen && (
                <DebtModal 
                    supplier={supplier}
                    onClose={() => setIsDebtModalOpen(false)}
                    onSave={async (amount: number, note: string) => {
                        await addSupplierPurchase({
                            supplierId: supplier.id,
                            date: new Date().toISOString(),
                            items: [],
                            totalAmount: amount,
                            note: note || 'Manuel borç ekleme'
                        });
                        setIsDebtModalOpen(false);
                        showToast('Borç eklendi', 'success');
                        loadData();
                    }}
                />
            )}

            {/* Edit Purchase Modal */}
            {isReturnModalOpen && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setIsReturnModalOpen(false)}
                    onSave={handleAddReturn}
                    newPurchase={newReturn}
                    setNewPurchase={setNewReturn}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    isReturn={true}
                    showToast={showToast}
                />
            )}
            
            {editingPurchase && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setEditingPurchase(null)}
                    onSave={handleUpdatePurchase}
                    newPurchase={editingPurchase}
                    setNewPurchase={setEditingPurchase}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    isEdit={true}
                    isReturn={editingPurchase.totalAmount < 0}
                    showToast={showToast}
                />
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />
        </div>
    );
};

const PurchaseModal = ({ 
    supplier, onClose, onSave, newPurchase, setNewPurchase, inventory, 
    isAddingNewPesticide, setIsAddingNewPesticide, newPesticide, setNewPesticide, handleAddNewPesticideToPurchase,
    isEdit = false, isReturn = false, showToast
}: any) => {
    const { userProfile, teamMembers } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    
    const handleScan = (barcode: string) => {
        const item = inventory.find((i: InventoryItem) => i.barcode === barcode);
        if (item) {
            handleAddItem(item);
        } else {
            showToast('Ürün bulunamadı', 'error');
        }
    };
    
    const filteredInventory = useMemo(() => {
        if (!searchTerm) return [];
        return inventory.filter((i: InventoryItem) => i.pesticideName.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5);
    }, [inventory, searchTerm]);

    const handleAddNewPesticideToPurchaseLocal = () => {
        if (!newPesticide.name) return;
        
        // Check if it already exists in inventory
        const existingItem = inventory.find((i: InventoryItem) => i.pesticideName.toLowerCase().trim() === newPesticide.name.toLowerCase().trim());
        
        if (existingItem) {
            handleAddItem(existingItem);
            setIsAddingNewPesticide(false);
            setNewPesticide({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
            return;
        }

        const tempId = `new-${crypto.randomUUID()}`;
        const newItem = {
            pesticideId: tempId,
            pesticideName: newPesticide.name,
            quantity: isReturn ? -1 : 1,
            unit: newPesticide.unit,
            buyingPrice: 0
        };
        
        setNewPurchase({
            ...newPurchase,
            items: [...newPurchase.items, newItem]
        });
        
        setIsAddingNewPesticide(false);
        setNewPesticide({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });
    };

    const handleAddItem = (item: InventoryItem) => {
        const exists = newPurchase.items.find((i: any) => i.pesticideId === item.pesticideId);
        if (exists) return;

        setNewPurchase({
            ...newPurchase,
            items: [...newPurchase.items, {
                pesticideId: item.pesticideId,
                pesticideName: item.pesticideName,
                quantity: isReturn ? -1 : 1,
                unit: item.unit,
                buyingPrice: item.buyingPrice
            }]
        });
        setSearchTerm('');
    };

    const removeItem = (id: string) => {
        setNewPurchase({
            ...newPurchase,
            items: newPurchase.items.filter((i: any) => i.pesticideId !== id)
        });
    };

    const updateItem = (id: string, field: string, value: any) => {
        let finalValue = value;
        if (field === 'quantity' && isReturn) {
            finalValue = -Math.abs(value);
        }
        setNewPurchase({
            ...newPurchase,
            items: newPurchase.items.map((i: any) => i.pesticideId === id ? { ...i, [field]: finalValue } : i)
        });
    };

    const total = newPurchase.items.reduce((acc: number, item: any) => acc + (item.buyingPrice * item.quantity), 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
            <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 my-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-stone-100 flex items-center gap-3">
                        {isReturn ? <RefreshCcw className="text-rose-500" /> : <Package className="text-emerald-500" />}
                        {isReturn ? 'İade Yap' : (isEdit ? 'Alımı Düzenle' : 'Ürün Alımı')}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-stone-800 rounded-full text-stone-500"><X size={16} /></button>
                </div>

                <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">
                                {isReturn ? 'İade Fiş Numarası' : 'Fiş Numarası'}
                            </label>
                            <div className="relative">
                                <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 pl-9 pr-4 text-xs text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                    placeholder={isReturn ? "İade fiş no giriniz..." : "Fiş no giriniz..."}
                                    value={newPurchase.receiptNo || ''}
                                    onChange={(e) => setNewPurchase({...newPurchase, receiptNo: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ürün Ekle</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                    <input 
                                        type="text" 
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 pl-9 pr-4 text-xs text-stone-100 outline-none focus:border-emerald-500/50 transition-all"
                                        placeholder="Ürün ara..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button 
                                    onClick={() => setIsScanning(true)}
                                    className="bg-stone-800 p-3 rounded-xl border border-white/5 text-stone-300 hover:bg-stone-700 transition-colors"
                                    title="Barkod Tara"
                                >
                                    <Barcode size={20} />
                                </button>
                            </div>
                            
                            {searchTerm && (
                                <div className="absolute z-20 w-full mt-2 bg-stone-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    {filteredInventory.map((item: InventoryItem) => (
                                        <button 
                                            key={item.id}
                                            onClick={() => handleAddItem(item)}
                                            className="w-full p-3 text-left hover:bg-stone-700 flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-stone-900 rounded-lg">
                                                    <FlaskConical size={14} className="text-emerald-500" />
                                                </div>
                                                <span className="text-xs font-bold text-stone-200">{item.pesticideName}</span>
                                            </div>
                                            <Plus size={14} className="text-stone-400" />
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => setIsAddingNewPesticide(true)}
                                        className="w-full p-3 text-left hover:bg-emerald-900/40 flex items-center gap-3 text-emerald-400 border-t border-white/10 bg-emerald-500/10 transition-colors"
                                    >
                                        <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                                            <Plus size={14} />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-wider">Yeni İlaç Kaydı Yap</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {newPurchase.items.map((item: any) => (
                            <div key={item.pesticideId} className="bg-stone-950/50 border border-white/5 rounded-2xl p-4 space-y-4">
                                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-stone-900 rounded-xl">
                                            <FlaskConical size={16} className="text-emerald-500" />
                                        </div>
                                        <span className="text-sm font-bold text-stone-200">{item.pesticideName}</span>
                                    </div>
                                    <button 
                                        onClick={() => removeItem(item.pesticideId)} 
                                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
                                        title="Ürünü Çıkar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-stone-900 rounded-xl p-1">
                                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-2 mb-1 block pt-2">Miktar ({item.unit})</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-transparent border-none p-2 text-sm font-bold text-stone-100 outline-none"
                                            value={Math.abs(item.quantity)}
                                            onChange={(e) => updateItem(item.pesticideId, 'quantity', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div className="bg-stone-900 rounded-xl p-1">
                                        <label className="text-[9px] font-black text-stone-500 uppercase tracking-widest ml-2 mb-1 block pt-2">{isReturn ? 'İade Fiyatı' : 'Alış Fiyatı'} ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-transparent border-none p-2 text-sm font-bold text-stone-100 outline-none"
                                            value={item.buyingPrice}
                                            onChange={(e) => updateItem(item.pesticideId, 'buyingPrice', parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 px-1">
                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Ara Toplam</span>
                                    <span className="text-sm font-black text-emerald-400 font-mono">{formatCurrency(Math.abs(item.quantity) * item.buyingPrice, userProfile?.currency || 'TRY')}</span>
                                </div>
                            </div>
                        ))}
                        {newPurchase.items.length === 0 && (
                            <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-[2rem] bg-stone-950/30">
                                <div className="w-16 h-16 bg-stone-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Package size={24} className="text-stone-600" />
                                </div>
                                <p className="text-stone-500 text-[10px] font-black uppercase tracking-widest">Ürün eklemek için yukarıdan arayın</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-stone-950/80 border border-white/5 rounded-2xl p-5 flex justify-between items-center mt-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Genel Toplam</span>
                            <span className="text-xs font-medium text-stone-400">{newPurchase.items.length} Kalem Ürün</span>
                        </div>
                        <span className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(Math.abs(total), userProfile?.currency || 'TRY')}</span>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <X size={16} />
                        İptal
                    </button>
                    <button 
                        onClick={onSave}
                        disabled={newPurchase.items.length === 0}
                        className={`flex-1 py-4 ${isReturn ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'} text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        <Save size={16} />
                        {isReturn ? 'İadeyi Kaydet' : 'Kaydet'}
                    </button>
                </div>
            </div>

            {isScanning && (
                <BarcodeScanner 
                    onScan={handleScan}
                    onClose={() => setIsScanning(false)}
                />
            )}
            
            {/* New Pesticide Sub-Modal */}
            {isAddingNewPesticide && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
                        <h3 className="text-lg font-black text-stone-100 mb-6 flex items-center gap-3">
                            <FlaskConical className="text-emerald-500" />
                            Yeni İlaç Kaydı
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">İlaç Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50"
                                    placeholder="İlaç adı..."
                                    value={newPesticide.name}
                                    onChange={(e) => setNewPesticide({...newPesticide, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Birim</label>
                                <select 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50"
                                    value={newPesticide.unit}
                                    onChange={(e) => setNewPesticide({...newPesticide, unit: e.target.value})}
                                >
                                    <option value="Adet">Adet</option>
                                    <option value="Litre">Litre</option>
                                    <option value="Kg">Kg</option>
                                    <option value="Gram">Gram</option>
                                    <option value="Kutu">Kutu</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setIsAddingNewPesticide(false)}
                                className="flex-1 py-3 bg-stone-800 text-stone-400 rounded-xl font-bold text-xs"
                            >
                                Vazgeç
                            </button>
                            <button 
                                onClick={handleAddNewPesticideToPurchaseLocal}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs"
                            >
                                Listeye Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PaymentModal = ({ supplier, onClose, onSave, newPayment, setNewPayment, accounts, userProfile, isEdit = false }: any) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                    <CreditCard className={isEdit ? "text-emerald-500" : "text-blue-500"} />
                    {isEdit ? 'Ödemeyi Düzenle' : 'Ödeme Yap'}
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ödeme Tutarı ({getCurrencySuffix(userProfile?.currency || 'TRY')})</label>
                        <input 
                            type="number"
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all font-mono"
                            placeholder="0.00"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Hesap Seçin</label>
                        <select 
                            className="w-full h-[54px] px-4 bg-stone-950 border border-white/5 rounded-2xl text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                            value={newPayment.accountId}
                            onChange={(e) => setNewPayment({...newPayment, accountId: e.target.value})}
                        >
                            <option value="">Hesap Seçilmedi</option>
                            {accounts.map((acc: any) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({new Intl.NumberFormat('tr-TR', { style: 'currency', currency: userProfile?.currency || 'TRY' }).format(acc.balance)})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ödeme Yöntemi</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['CASH', 'CARD', 'CHECK', 'PROMISSORY_NOTE', 'OTHER'].map(method => (
                                <button 
                                    key={method}
                                    onClick={() => setNewPayment({...newPayment, method, installments: 1, producerCardMonths: 0})}
                                    className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${newPayment.method === method ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                >
                                    {method === 'CASH' ? 'Nakit' : method === 'CARD' ? 'Kart' : method === 'CHECK' ? 'Çek' : method === 'PROMISSORY_NOTE' ? 'Senet' : 'Diğer'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {newPayment.method === 'CARD' && (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Kart Tipi</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => setNewPayment({...newPayment, producerCardMonths: 0})}
                                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${!newPayment.producerCardMonths ? 'bg-stone-100 border-stone-100 text-stone-900' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                    >
                                        Normal Kart / Taksit
                                    </button>
                                    <button 
                                        onClick={() => setNewPayment({...newPayment, installments: 1, producerCardMonths: 1})}
                                        className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${newPayment.producerCardMonths > 0 ? 'bg-stone-100 border-stone-100 text-stone-900' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                    >
                                        Üretici Kart
                                    </button>
                                </div>
                            </div>
                            
                            {newPayment.producerCardMonths > 0 ? (
                                <div>
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ödeme Vadesi (Ay)</label>
                                    <div className="grid grid-cols-6 gap-1">
                                        {[1, 2, 3, 4, 5, 6].map(m => (
                                            <button 
                                                key={m}
                                                onClick={() => setNewPayment({...newPayment, producerCardMonths: m})}
                                                className={`py-2 rounded-lg text-[10px] font-black border transition-all ${newPayment.producerCardMonths === m ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Taksit Sayısı</label>
                                    <div className="grid grid-cols-6 gap-1">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(t => (
                                            <button 
                                                key={t}
                                                onClick={() => setNewPayment({...newPayment, installments: t})}
                                                className={`py-2 rounded-lg text-[10px] font-black border transition-all ${newPayment.installments === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-stone-950 border-white/5 text-stone-500'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {(newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Vade Tarihi</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" />
                                <input 
                                    type="date" 
                                    className="w-full h-[54px] bg-stone-950 border border-white/5 rounded-2xl pl-12 pr-4 text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                                    value={newPayment.dueDate}
                                    onChange={(e) => setNewPayment({...newPayment, dueDate: e.target.value})}
                                />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Not</label>
                        <textarea 
                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-4 text-sm text-stone-100 outline-none focus:border-blue-500/50 transition-all h-24 resize-none"
                            placeholder="Ödeme notu..."
                            value={newPayment.note}
                            onChange={(e) => setNewPayment({...newPayment, note: e.target.value})}
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-8">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                    >
                        İptal
                    </button>
                    <button 
                        onClick={onSave}
                        className={`flex-1 py-4 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg ${isEdit ? 'bg-emerald-600 shadow-emerald-900/20' : 'bg-blue-600 shadow-blue-900/20'}`}
                    >
                        {isEdit ? 'Güncelle' : 'Ödemeyi Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
};


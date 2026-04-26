
import React, { useState, useMemo, useEffect } from 'react';
import { 
    Truck, Plus, Trash2, Edit2, ChevronRight, ChevronLeft, 
    Package, CreditCard, ArrowUpRight, ArrowDownRight, 
    Search, Phone, MapPin, Calendar, DollarSign, 
    AlertCircle, CheckCircle2, FlaskConical, Info, X, User, RefreshCcw,
    Receipt, Save, Barcode, Download, ArrowDownLeft
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppViewModel } from '../context/AppContext';
import { dbService } from '../services/db';
import { Supplier, SupplierPurchase, SupplierPayment, PesticideCategory, InventoryItem } from '../types';
import { formatCurrency, getCurrencySuffix } from '../utils/currency';
import { ConfirmationModal } from './ConfirmationModal';
import { ListSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export const Suppliers: React.FC<{ onBack: () => void; initialSupplierId?: string | null; }> = ({ onBack, initialSupplierId }) => {
    const { 
        suppliers, addSupplier, updateSupplier, 
        addSupplierPurchase, updateSupplierPurchase, softDeleteSupplierPurchase,
        addSupplierPayment, updateSupplierPayment, softDeleteSupplierPayment,
        softDeleteSupplier,
        inventory, addInventoryItem, showToast, hapticFeedback,
        prescriptions, supplierPurchases,
        accounts, userProfile,
        activeTeamMember,
        teamMembers,
        visits,
        isInitialized,
        myPayments
    } = useAppViewModel();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isLoading, setIsLoading] = useState(!isInitialized);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    
    useEffect(() => {
        if (isInitialized && initialSupplierId) {
            const supplier = suppliers.find(s => s.id === initialSupplierId);
            if (supplier) {
                setSelectedSupplier(supplier);
            }
        }
    }, [initialSupplierId, isInitialized, suppliers]);

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
    const [newPayment, setNewPayment] = useState({ amount: '', method: 'CASH' as any, note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type: 'PAY' as 'PAY' | 'RECEIVE' });
    const [newPurchase, setNewPurchase] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number, sellingPrice?: number }[],
        note: string,
        receiptNo: string,
        paymentType: 'TERM' | 'CASH'
    }>({ items: [], note: '', receiptNo: '', paymentType: 'TERM' });
    const [newReturn, setNewReturn] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number, sellingPrice?: number }[],
        note: string,
        receiptNo: string
    }>({ items: [], note: '', receiptNo: '' });
    const [newSale, setNewSale] = useState<{
        items: { pesticideId: string, pesticideName: string, quantity: number, unit: string, buyingPrice: number, sellingPrice?: number }[],
        note: string,
        receiptNo: string
    }>({ items: [], note: '', receiptNo: '' });
    
    // New Pesticide Form (Inside Purchase)
    const [isAddingNewPesticide, setIsAddingNewPesticide] = useState(false);
    const [newPesticide, setNewPesticide] = useState({ name: '', category: PesticideCategory.OTHER, unit: 'Adet' });

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => s.name.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')));
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

    const handleAddPurchase = async (manualSupplierId?: string) => {
        const targetSupplierId = manualSupplierId || selectedSupplier?.id;
        if (!targetSupplierId || newPurchase.items.length === 0) return;
        
        const totalAmount = newPurchase.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);
        const date = new Date().toISOString();
        
        await addSupplierPurchase({
            supplierId: targetSupplierId,
            date,
            type: 'PURCHASE',
            receiptNo: newPurchase.receiptNo,
            items: newPurchase.items,
            totalAmount,
            note: newPurchase.note,
            createdById: activeTeamMember?.id
        });

        // If it's a cash purchase, automatically add a payment
        if (newPurchase.paymentType === 'CASH') {
            await addSupplierPayment({
                supplierId: targetSupplierId,
                amount: totalAmount,
                date,
                method: 'CASH',
                note: newPurchase.receiptNo ? `Peşin Alım - Fiş No: ${newPurchase.receiptNo}` : 'Peşin Alım Ödemesi',
                createdById: activeTeamMember?.id
            });
        }
        
        setIsPurchaseModalOpen(false);
        setNewPurchase({ items: [], note: '', receiptNo: '', paymentType: 'TERM' });
        showToast(newPurchase.paymentType === 'CASH' ? 'Peşin alım ve ödeme kaydedildi' : 'Alım başarıyla kaydedildi ve depoya aktarıldı', 'success');
    };

    const handleAddReturn = async (manualSupplierId?: string) => {
        const targetSupplierId = manualSupplierId || selectedSupplier?.id;
        if (!targetSupplierId || newReturn.items.length === 0) return;
        
        const totalAmount = newReturn.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);
        
        await addSupplierPurchase({
            supplierId: targetSupplierId,
            date: new Date().toISOString(),
            type: 'RETURN',
            receiptNo: newReturn.receiptNo,
            items: newReturn.items,
            totalAmount: -Math.abs(totalAmount),
            note: newReturn.note ? `İADE: ${newReturn.note}` : 'İADE',
            createdById: activeTeamMember?.id
        });
        
        setIsReturnModalOpen(false);
        setNewReturn({ items: [], note: '', receiptNo: '' });
        showToast('İade başarıyla kaydedildi ve depodan düşüldü', 'success');
    };

    const handleAddSale = async (manualSupplierId?: string) => {
        const targetSupplierId = manualSupplierId || selectedSupplier?.id;
        if (!targetSupplierId || newSale.items.length === 0) return;
        
        const totalAmount = newSale.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);
        
        // Convert quantities to negative for sales
        const saleItems = newSale.items.map(item => ({
            ...item,
            quantity: -Math.abs(item.quantity)
        }));

        await addSupplierPurchase({
            supplierId: targetSupplierId,
            date: new Date().toISOString(),
            receiptNo: newSale.receiptNo,
            items: saleItems,
            totalAmount: -Math.abs(totalAmount),
            note: newSale.note ? `SATIŞ: ${newSale.note}` : 'SATIŞ',
            createdById: activeTeamMember?.id
        });
        
        setIsSaleModalOpen(false);
        setNewSale({ items: [], note: '', receiptNo: '' });
        showToast('Satış başarıyla kaydedildi ve depodan düşüldü', 'success');
    };

    const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);

    const handleAddPayment = async () => {
        if (!selectedSupplier || !newPayment.amount) return;
        
        const parseFloatSafe = (val: string | number) => parseFloat(String(val).replace(',', '.')) || 0;
        
        if (editingPayment) {
            await updateSupplierPayment({
                ...editingPayment,
                amount: parseFloatSafe(newPayment.amount),
                method: newPayment.method,
                dueDate: (newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') ? newPayment.dueDate : undefined,
                note: newPayment.note,
                accountId: newPayment.accountId || undefined
            });
            showToast('Ödeme güncellendi', 'success');
        } else {
            await addSupplierPayment({
                supplierId: selectedSupplier.id,
                amount: parseFloatSafe(newPayment.amount),
                date: new Date().toISOString(),
                method: newPayment.method,
                dueDate: (newPayment.method === 'CHECK' || newPayment.method === 'PROMISSORY_NOTE') ? newPayment.dueDate : undefined,
                note: newPayment.note,
                accountId: newPayment.accountId || undefined,
                createdById: activeTeamMember?.id,
                installments: newPayment.method === 'CARD' ? newPayment.installments : undefined,
                producerCardMonths: newPayment.method === 'CARD' ? newPayment.producerCardMonths : undefined,
                type: newPayment.type
            });
            showToast('Ödeme kaydedildi', 'success');
        }
        
        setIsPaymentModalOpen(false);
        setEditingPayment(null);
        setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type: 'PAY' });
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
            producerCardMonths: payment.producerCardMonths || 0,
            type: payment.type || 'PAY'
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
            buyingPrice: 0,
            sellingPrice: 0
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
        const currentStock = item?.quantity || 0;
        
        let soldCount = 0;
        prescriptions.forEach(p => {
            p.items.forEach(i => {
                if (i.pesticideId === pesticideId) {
                    const qtyStr = i.quantity?.toString() || '0';
                    const parsedQty = parseFloat(qtyStr.replace(',', '.')) || 0;
                    if (!isNaN(parsedQty)) {
                        soldCount += parsedQty;
                    }
                }
            });
        });
        
        return {
            stock: currentStock,
            sold: soldCount,
            unit: item?.unit || 'Adet'
        };
    };

    const handleClosePayment = () => {
        setIsPaymentModalOpen(false);
        setEditingPayment(null);
        setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type: 'PAY' });
    };

    if (selectedSupplier) {
        return (
            <SupplierDetailView 
                supplier={selectedSupplier} 
                onBack={() => setSelectedSupplier(null)}
                onOpenPurchase={() => setIsPurchaseModalOpen(true)}
                onOpenPayment={(type: 'PAY' | 'RECEIVE' = 'PAY') => {
                    setEditingPayment(null);
                    setNewPayment({ amount: '', method: 'CASH', note: '', dueDate: new Date().toISOString().split('T')[0], accountId: '', installments: 1, producerCardMonths: 0, type });
                    setIsPaymentModalOpen(true);
                }}
                onOpenDebt={() => setIsDebtModalOpen(true)}
                onOpenReturn={() => setIsReturnModalOpen(true)}
                onOpenSale={() => setIsSaleModalOpen(true)}
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
                softDeleteSupplierPurchase={softDeleteSupplierPurchase}
                deleteSupplierPayment={softDeleteSupplierPayment}
                handleEditPayment={handleEditPayment}
                handleClosePayment={handleClosePayment}
                editingPayment={editingPayment}
                showToast={showToast}
                isReturnModalOpen={isReturnModalOpen}
                setIsReturnModalOpen={setIsReturnModalOpen}
                handleAddReturn={handleAddReturn}
                newReturn={newReturn}
                setNewReturn={setNewReturn}
                isSaleModalOpen={isSaleModalOpen}
                setIsSaleModalOpen={setIsSaleModalOpen}
                handleAddSale={handleAddSale}
                newSale={newSale}
                setNewSale={setNewSale}
                onEdit={(s: Supplier) => { setEditingSupplier(s); setIsEditModalOpen(true); }}
                accounts={accounts}
                softDeleteSupplier={softDeleteSupplier}
                myPayments={myPayments}
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
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => {
                            setSelectedSupplier(null);
                            setNewPurchase({ items: [], note: '', receiptNo: '', paymentType: 'TERM' });
                            setIsPurchaseModalOpen(true);
                        }}
                        className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-900/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Package size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">Alım Yap</span>
                    </button>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">Yeni Ekle</span>
                    </button>
                </div>
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

            {isPurchaseModalOpen && !selectedSupplier && (
                <PurchaseModal 
                    supplier={null}
                    onClose={() => setIsPurchaseModalOpen(false)}
                    onSave={async (id: string) => {
                        await handleAddPurchase(id);
                    }}
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
        </div>
    );
};

const DebtModal = ({ supplier, onClose, onSave }: any) => {
    const { userProfile, teamMembers } = useAppViewModel();
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

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
                        onClick={async () => {
                            if (isSaving) return;
                            setIsSaving(true);
                            try {
                                const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
                                await onSave(parsedAmount, note);
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving || !amount}
                        className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-amber-900/20 disabled:opacity-50"
                    >
                        {isSaving ? 'Kaydediliyor...' : 'Borcu Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SupplierDetailView = ({ 
    supplier, onBack, onOpenPurchase, onOpenPayment, onOpenDebt, onOpenReturn, onOpenSale, getProductStats,
    isPurchaseModalOpen, setIsPurchaseModalOpen, handleAddPurchase, newPurchase, setNewPurchase, inventory,
    isAddingNewPesticide, setIsAddingNewPesticide, newPesticide, setNewPesticide, handleAddNewPesticideToPurchase,
    isPaymentModalOpen, setIsPaymentModalOpen, handleAddPayment, newPayment, setNewPayment, handleEditPayment, handleClosePayment, editingPayment,
    isDebtModalOpen, setIsDebtModalOpen, addSupplierPurchase, updateSupplierPurchase, softDeleteSupplierPurchase, softDeleteSupplierPayment, showToast,
    isReturnModalOpen, setIsReturnModalOpen, handleAddReturn, newReturn, setNewReturn,
    isSaleModalOpen, setIsSaleModalOpen, handleAddSale, newSale, setNewSale,
    onEdit, accounts, softDeleteSupplier, myPayments
}: any) => {
    const { userProfile, teamMembers } = useAppViewModel();
    const [activeTab, setActiveTab] = useState<'PURCHASES' | 'PAYMENTS'>('PURCHASES');
    const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
    const [payments, setPayments] = useState<SupplierPayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingPurchase, setEditingPurchase] = useState<SupplierPurchase | null>(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportOptions, setReportOptions] = useState({
        type: 'SUMMARY' as 'SUMMARY' | 'DETAILED',
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
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
        const activePurchases = purchList.filter(p => !p.deletedAt);
        const activePayments = payList.filter(p => !p.deletedAt);
        // Only include checks that are standalone (no relatedId linking them back to a SupplierPayment)
        const activeMyPayments = myPayments.filter((p: any) => p.supplierId === supplier.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId);
        
        setPurchases(activePurchases.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        
        // Combine regular payments and checks/notes
        const allPayments = [
            ...activePayments,
            ...activeMyPayments.map((p: any) => ({ ...p, type: 'MY_PAYMENT', date: p.issueDate }))
        ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setPayments(allPayments);
        setIsLoading(false);
    };

    const generateReport = () => {
        const doc = new jsPDF();
        const currency = userProfile?.currency || 'TRY';
        
        // Filter transactions by date
        const start = new Date(reportOptions.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(reportOptions.endDate);
        end.setHours(23, 59, 59, 999);

        const filteredPurchases = purchases.filter(p => {
            const date = new Date(p.date);
            return date >= start && date <= end;
        });
        const filteredPayments = payments.filter((p: any) => {
            const date = new Date(p.date);
            return date >= start && date <= end;
        });

        // Header
        doc.setFontSize(20);
        doc.setTextColor(40);
        doc.text("TEDARIKÇI CARI HESAP EKSTRESI", 105, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Rapor Aralığı: ${new Date(reportOptions.startDate).toLocaleDateString('tr-TR')} - ${new Date(reportOptions.endDate).toLocaleDateString('tr-TR')}`, 195, 10, { align: 'right' });
        doc.text(`Oluşturma: ${new Date().toLocaleDateString('tr-TR')}`, 195, 15, { align: 'right' });

        // Supplier Info
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(`Tedarikçi: ${supplier.name}`, 14, 35);
        if (supplier.phoneNumber) doc.text(`Telefon: ${supplier.phoneNumber}`, 14, 42);
        if (supplier.address) doc.text(`Adres: ${supplier.address}`, 14, 49);

        // Summary Box (Recalculate based on filtered data)
        const totalDebt = filteredPurchases.reduce((acc, p) => acc + (p.totalAmount > 0 ? p.totalAmount : 0), 0);
        const totalCredit = filteredPurchases.reduce((acc, p) => acc + (p.totalAmount < 0 ? Math.abs(p.totalAmount) : 0), 0) + filteredPayments.reduce((acc, p) => acc + p.amount, 0);
        const periodBalance = totalCredit - totalDebt;

        doc.setDrawColor(200);
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(14, 55, 182, 25, 3, 3, 'FD');
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Dönem Borç", 30, 63);
        doc.text("Dönem Ödeme", 90, 63);
        doc.text("Dönem Bakiye", 150, 63);

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(formatCurrency(totalDebt, currency), 30, 72);
        doc.text(formatCurrency(totalCredit, currency), 90, 72);
        doc.setTextColor(periodBalance < 0 ? 200 : 0, periodBalance < 0 ? 0 : 150, 0);
        doc.text(formatCurrency(Math.abs(periodBalance), currency) + (periodBalance < 0 ? " (Borç)" : " (Alacak)"), 150, 72);

        // Table Data
        const allTransactions = [
            ...filteredPurchases.map(p => ({
                date: p.date,
                type: p.totalAmount < 0 ? (p.note?.includes('SATIŞ') ? 'SATIŞ' : 'İADE') : 'ALIM',
                desc: reportOptions.type === 'DETAILED' 
                    ? (p.items || []).map(i => `${i.pesticideName} (${i.quantity} ${i.unit})`).join(', ') + (p.note ? ` - ${p.note}` : '')
                    : p.note || (p.receiptNo ? `Fiş No: ${p.receiptNo}` : '-'),
                debt: p.totalAmount > 0 ? p.totalAmount : 0,
                credit: p.totalAmount < 0 ? Math.abs(p.totalAmount) : 0
            })),
            ...filteredPayments.map(p => {
                let type = 'ÖDEME';
                let method = (p as any).method || '';
                if ((p as any).type === 'CHECK') {
                    type = 'ÇEK';
                    method = 'Çek';
                } else if ((p as any).type === 'PROMISSORY') {
                    type = 'SENET';
                    method = 'Senet';
                }
                
                return {
                    date: p.date,
                    type,
                    desc: `${method}${p.note ? ` - ${p.note}` : ''}`,
                    debt: 0,
                    credit: p.amount
                };
            })
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        autoTable(doc, {
            startY: 90,
            head: [['Tarih', 'İşlem Tipi', 'Açıklama', 'Borç', 'Alacak']],
            body: allTransactions.map(t => [
                new Date(t.date).toLocaleDateString('tr-TR'),
                t.type,
                t.desc,
                t.debt > 0 ? formatCurrency(t.debt, currency) : '-',
                t.credit > 0 ? formatCurrency(t.credit, currency) : '-'
            ]),
            headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { top: 90 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                2: { cellWidth: 80 } // Description column wider
            }
        });

        doc.save(`${supplier.name.replace(/\s+/g, '_')}_Ekstre_${reportOptions.type}.pdf`);
        showToast('Rapor başarıyla oluşturuldu', 'success');
        setIsReportModalOpen(false);
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
                    await softDeleteSupplierPurchase(id);
                    showToast('Alım kaydı çöp kutusuna taşındı', 'info');
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
                    await softDeleteSupplierPayment(id);
                    showToast('Ödeme kaydı çöp kutusuna taşındı', 'info');
                    await loadData();
                } catch (error) {
                    console.error('Ödeme silme hatası:', error);
                    showToast('Ödeme silinirken bir hata oluştu', 'error');
                }
            }
        });
    };

    const handleUpdatePurchase = async (manualId?: string) => {
        if (!editingPurchase) return;
        
        // If manualId is provided and different from current supplierId (though unlikely in edit)
        const updatedPurchase = {
            ...editingPurchase,
            supplierId: manualId || editingPurchase.supplierId
        };

        await updateSupplierPurchase(updatedPurchase);
        setEditingPurchase(null);
        showToast('Alım kaydı güncellendi', 'success');
        loadData();
    };

    // Unique products purchased from this supplier
    const purchasedProducts = useMemo(() => {
        const productMap = new Map<string, { id: string, name: string, totalQty: number, unit: string }>();
        purchases.forEach(p => {
            (p.items || []).forEach(item => {
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
                        onClick={() => setIsReportModalOpen(true)}
                        className="px-4 py-2.5 bg-stone-900 text-stone-400 rounded-xl hover:text-blue-400 transition-colors border border-white/5 active:scale-95"
                        title="Ekstre Al (PDF)"
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest">Ekstre</span>
                    </button>
                    <button 
                        onClick={() => onEdit(supplier)}
                        className="p-2.5 bg-stone-900 text-stone-400 rounded-xl hover:text-emerald-400 transition-colors border border-white/5 active:scale-95"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button 
                        onClick={async () => {
                            if (Math.abs(supplier.balance) > 0.01) {
                                showToast('Bakiyesi olan tedarikçi silinemez. Lütfen önce bakiyeyi sıfırlayın.', 'error');
                                return;
                            }
                            setConfirmModal({
                                isOpen: true,
                                title: 'Tedarikçi Silinecek',
                                message: 'Bu tedarikçiyi ve tüm kayıtlarını silmek istediğinize emin misiniz?',
                                onConfirm: async () => {
                                    await softDeleteSupplier(supplier.id);
                                    showToast('Tedarikçi silindi', 'info');
                                    onBack();
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

            <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={onOpenReturn}
                    className="py-3 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <RefreshCcw size={14} />
                    <span>İade Yap</span>
                </button>
                <button 
                    onClick={onOpenDebt}
                    className="py-3 bg-amber-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <AlertCircle size={14} />
                    <span>Borç Ekle</span>
                </button>
                <button 
                    onClick={() => onOpenPayment('RECEIVE')}
                    className="py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <ArrowDownLeft size={14} />
                    <span>Ödeme Al</span>
                </button>
                <button 
                    onClick={() => onOpenPayment('PAY')}
                    className="py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <CreditCard size={14} />
                    <span>Ödeme Yap</span>
                </button>
                <button 
                    onClick={onOpenPurchase}
                    className="py-3 bg-emerald-700 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <Package size={14} />
                    <span>Alış Yap</span>
                </button>
                <button 
                    onClick={onOpenSale}
                    className="py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                    <ArrowUpRight size={14} />
                    <span>Satış Yap</span>
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
                                                <div className={`p-1.5 rounded-lg ${purchase.totalAmount < 0 ? (purchase.note?.startsWith('SATIŞ') ? 'bg-indigo-500/10 text-indigo-500' : 'bg-rose-500/10 text-rose-500') : 'bg-emerald-500/10 text-emerald-500'}`}>
                                                    {purchase.totalAmount < 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-stone-300 uppercase tracking-wider">
                                                        {purchase.totalAmount < 0 ? (purchase.note?.startsWith('SATIŞ') ? 'Tedarikçiye Satış' : 'Ürün İadesi') : 'Ürün Alımı'}
                                                    </span>
                                                    {purchase.receiptNo && (
                                                        <span className={`text-[8px] font-bold uppercase tracking-widest ${purchase.totalAmount < 0 ? (purchase.note?.startsWith('SATIŞ') ? 'text-indigo-500' : 'text-rose-500') : 'text-emerald-500'}`}>Fiş No: {purchase.receiptNo}</span>
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
                                            <span className={`text-sm font-black font-mono ${purchase.totalAmount < 0 ? 'text-emerald-400' : 'text-stone-100'}`}>
                                                {purchase.totalAmount < 0 ? '+' : ''}{formatCurrency(Math.abs(purchase.totalAmount), userProfile?.currency || 'TRY')}
                                            </span>
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
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${payment.type === 'RECEIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {payment.type === 'RECEIVE' ? <ArrowDownLeft size={18} /> : <CreditCard size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-stone-200 uppercase tracking-wider">{payment.type === 'RECEIVE' ? 'Ödeme Alındı' : 'Ödeme Yapıldı'}</span>
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
                                            <div className={`text-sm font-black font-mono ${payment.type === 'RECEIVE' ? 'text-amber-400' : 'text-emerald-400'}`}>{payment.type === 'RECEIVE' ? '+' : '-'}{formatCurrency(payment.amount, userProfile?.currency || 'TRY')}</div>
                                            {payment.note && <div className="text-[8px] text-stone-600 italic truncate max-w-[100px]">{payment.note}</div>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleEditPayment(payment)}
                                                className="p-2.5 text-stone-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all active:scale-95 border border-transparent hover:border-emerald-500/20"
                                                title={payment.type === 'RECEIVE' ? 'Tahsilatı Düzenle' : 'Ödemeyi Düzenle'}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePayment(payment.id)}
                                                className="p-2.5 text-stone-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all active:scale-95 border border-transparent hover:border-rose-500/20"
                                                title={payment.type === 'RECEIVE' ? 'Tahsilatı Sil' : 'Ödemeyi Sil'}
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
                    onSave={async (id: string) => {
                        await handleAddPurchase(id);
                        loadData();
                    }}
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
                    onSave={async () => {
                        await handleAddPayment();
                        loadData();
                    }}
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
                    onSave={async (id: string) => {
                        await handleAddReturn(id);
                        loadData();
                    }}
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

            {isSaleModalOpen && (
                <PurchaseModal 
                    supplier={supplier}
                    onClose={() => setIsSaleModalOpen(false)}
                    onSave={async (id: string) => {
                        await handleAddSale(id);
                        loadData();
                    }}
                    newPurchase={newSale}
                    setNewPurchase={setNewSale}
                    inventory={inventory}
                    isAddingNewPesticide={isAddingNewPesticide}
                    setIsAddingNewPesticide={setIsAddingNewPesticide}
                    newPesticide={newPesticide}
                    setNewPesticide={setNewPesticide}
                    handleAddNewPesticideToPurchase={handleAddNewPesticideToPurchase}
                    isSale={true}
                    showToast={showToast}
                />
            )}

            {isReportModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-stone-100 flex items-center gap-3">
                                <Download className="text-blue-500" />
                                Ekstre Seçenekleri
                            </h2>
                            <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-stone-800 rounded-full text-stone-500"><X size={16} /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-2 p-1 bg-stone-950 rounded-2xl border border-white/5">
                                <button 
                                    onClick={() => setReportOptions({...reportOptions, type: 'SUMMARY'})}
                                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportOptions.type === 'SUMMARY' ? 'bg-blue-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    Özet
                                </button>
                                <button 
                                    onClick={() => setReportOptions({...reportOptions, type: 'DETAILED'})}
                                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportOptions.type === 'DETAILED' ? 'bg-blue-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                                >
                                    Detaylı
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Başlangıç</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-3 text-xs text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                                            value={reportOptions.startDate}
                                            onChange={(e) => setReportOptions({...reportOptions, startDate: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Bitiş</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl p-3 text-xs text-stone-100 outline-none focus:border-blue-500/50 transition-all"
                                            value={reportOptions.endDate}
                                            onChange={(e) => setReportOptions({...reportOptions, endDate: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {[new Date().getFullYear(), new Date().getFullYear() - 1].map(year => (
                                        <button 
                                            key={year}
                                            onClick={() => setReportOptions({
                                                ...reportOptions, 
                                                startDate: `${year}-01-01`,
                                                endDate: `${year}-12-31`
                                            })}
                                            className="px-3 py-1.5 bg-stone-800 border border-white/5 rounded-lg text-[10px] font-bold text-stone-400 hover:bg-stone-700 hover:text-white transition-all"
                                        >
                                            {year} Yılı
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => setReportOptions({
                                            ...reportOptions, 
                                            startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
                                            endDate: new Date().toISOString().split('T')[0]
                                        })}
                                        className="px-3 py-1.5 bg-stone-800 border border-white/5 rounded-lg text-[10px] font-bold text-stone-400 hover:bg-stone-700 hover:text-white transition-all"
                                    >
                                        Son 30 Gün
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={generateReport}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                            >
                                <Download size={18} />
                                PDF Oluştur
                            </button>
                        </div>
                    </div>
                </div>
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
    isEdit = false, isReturn = false, isSale = false, showToast
}: any) => {
    const { userProfile, teamMembers, suppliers } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localSupplierId, setLocalSupplierId] = useState(supplier?.id || '');
    
    const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
    
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
        return inventory.filter((i: InventoryItem) => i.pesticideName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))).slice(0, 20);
    }, [inventory, searchTerm]);

    const handleAddNewPesticideToPurchaseLocal = () => {
        if (!newPesticide.name) return;
        
        // Check if it already exists in inventory
        const existingItem = inventory.find((i: InventoryItem) => i.pesticideName.toLocaleLowerCase('tr-TR').trim() === newPesticide.name.toLocaleLowerCase('tr-TR').trim());
        
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
            quantity: (isReturn || isSale) ? -1 : 1,
            unit: newPesticide.unit,
            buyingPrice: 0,
            sellingPrice: 0
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
                quantity: (isReturn || isSale) ? -1 : 1,
                unit: item.unit,
                buyingPrice: item.buyingPrice || 0,
                sellingPrice: item.sellingPrice || 0
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
        if (field === 'quantity' && (isReturn || isSale)) {
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
            <div className="bg-stone-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 my-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-stone-100 flex items-center gap-3">
                        {isReturn ? <RefreshCcw className="text-rose-500" /> : (isSale ? <ArrowUpRight className="text-indigo-500" /> : <Package className="text-emerald-500" />)}
                        {step === 1 ? 'Ürün Seçimi' : (isReturn ? 'İade Detayları' : (isSale ? 'Satış Detayları' : 'Alım Detayları'))}
                    </h2>
                    <div className="flex items-center gap-2">
                        {step === 2 && !isEdit && (
                            <button 
                                onClick={() => setStep(1)}
                                className="px-3 py-1.5 bg-stone-800 text-stone-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:text-white transition-colors flex items-center gap-1"
                            >
                                <ChevronLeft size={14} />
                                Geri
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 bg-stone-800 rounded-full text-stone-500"><X size={16} /></button>
                    </div>
                </div>

                {step === 1 ? (
                    <div className="space-y-5">
                        <div className="relative">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ürün Arayın veya Ekleyin</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                    <input 
                                        type="text" 
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 pl-9 pr-4 text-xs text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-bold"
                                        placeholder="Ürün adı veya barkod..."
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
                                <div className="absolute z-20 w-full mt-2 bg-stone-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto font-sans">
                                    {filteredInventory.map((item: InventoryItem) => (
                                        <button 
                                            key={item.id}
                                            onClick={() => handleAddItem(item)}
                                            className="w-full p-4 text-left hover:bg-stone-700 flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-stone-900 rounded-lg">
                                                    <FlaskConical size={14} className="text-emerald-500" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-stone-200">{item.pesticideName}</span>
                                                    <span className="text-[9px] text-stone-500 uppercase font-black tracking-widest">{item.category}</span>
                                                </div>
                                            </div>
                                            <Plus size={14} className="text-stone-400" />
                                        </button>
                                    ))}
                                    <button 
                                        onClick={() => setIsAddingNewPesticide(true)}
                                        className="w-full p-4 text-left hover:bg-emerald-900/40 flex items-center gap-3 text-emerald-400 border-t border-white/10 bg-emerald-500/10 transition-colors"
                                    >
                                        <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                                            <Plus size={14} />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-wider text-center flex-1">Listede Yok mu? Yeni Ürün Kaydı Aç</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="bg-stone-950/30 rounded-[2rem] p-4 border border-white/5 min-h-[250px]">
                            <h4 className="text-[10px] font-black text-stone-600 uppercase tracking-widest mb-4 ml-1 text-center">Seçilen Ürünler ({newPurchase.items.length})</h4>
                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                                {newPurchase.items.map((item: any) => (
                                    <div key={item.pesticideId} className="flex items-center justify-between p-3.5 bg-stone-900/50 rounded-[1.5rem] border border-white/5 group animate-in slide-in-from-right-2 duration-200">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-stone-950 flex items-center justify-center text-emerald-500/30 border border-white/5">
                                                <FlaskConical size={18} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-stone-200">{item.pesticideName}</span>
                                                <span className="text-[9px] text-stone-500 font-black uppercase">{item.unit}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeItem(item.pesticideId)} 
                                            className="p-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                {newPurchase.items.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-stone-600 opacity-50">
                                        <Package size={48} strokeWidth={1} className="mb-4" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Henüz ürün seçilmedi</span>
                                        <p className="text-[9px] text-stone-700">Ürün eklemek için arama alanını kullanın</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={onClose}
                                className="flex-1 py-4 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={() => setStep(2)}
                                disabled={newPurchase.items.length === 0}
                                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                            >
                                <span>Fiyat ve Adet Girin</span>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {!supplier && !isEdit && (
                                <div className="flex flex-col gap-1.5 sm:col-span-2">
                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">
                                        Tedarikçi Seçin
                                    </label>
                                    <div className="relative">
                                        <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                        <select 
                                            className="w-full bg-stone-950 border border-white/5 rounded-2xl py-4 pl-11 pr-4 text-xs font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all appearance-none"
                                            value={localSupplierId}
                                            onChange={(e) => setLocalSupplierId(e.target.value)}
                                        >
                                            <option value="">Seçiniz...</option>
                                            {suppliers.filter((s: Supplier) => !s.deletedAt).map((s: Supplier) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 rotate-90" />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">
                                    {isReturn ? 'İade Fiş No' : 'Fiş No'}
                                </label>
                                <div className="relative">
                                    <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                                    <input 
                                        type="text" 
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl py-4 pl-11 pr-4 text-xs font-bold text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono"
                                        placeholder="Fiş No"
                                        value={newPurchase.receiptNo || ''}
                                        onChange={(e) => setNewPurchase({...newPurchase, receiptNo: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 block">
                                    Ödeme Şekli
                                </label>
                                <div className="flex bg-stone-950 border border-white/5 rounded-2xl p-1.5 h-[50px]">
                                    <button 
                                        onClick={() => setNewPurchase({...newPurchase, paymentType: 'TERM'})}
                                        className={`flex-1 rounded-xl text-[10px] font-black uppercase transition-all ${newPurchase.paymentType === 'TERM' ? 'bg-stone-800 text-white shadow-lg' : 'text-stone-600 hover:text-stone-400'}`}
                                    >
                                        Vadeli
                                    </button>
                                    <button 
                                        onClick={() => setNewPurchase({...newPurchase, paymentType: 'CASH'})}
                                        className={`flex-1 rounded-xl text-[10px] font-black uppercase transition-all ${newPurchase.paymentType === 'CASH' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-600 hover:text-stone-400'}`}
                                    >
                                        Peşin
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                            {newPurchase.items.map((item: any) => (
                                <div key={item.pesticideId} className="bg-stone-950/40 border border-white/5 rounded-[2rem] p-5 space-y-5 hover:bg-stone-950/60 transition-all duration-300">
                                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-stone-900 rounded-xl text-emerald-500">
                                                <FlaskConical size={16} />
                                            </div>
                                            <span className="text-sm font-black text-stone-100">{item.pesticideName}</span>
                                        </div>
                                        {!isEdit && (
                                            <button 
                                                onClick={() => removeItem(item.pesticideId)} 
                                                className="p-2 text-stone-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                                title="Listeden Çıkar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest block text-center">Alış ({getCurrencySuffix(userProfile?.currency)})</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-black text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono text-center"
                                                value={item.buyingPrice || ''}
                                                onChange={(e) => updateItem(item.pesticideId, 'buyingPrice', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest block text-center">Satış ({getCurrencySuffix(userProfile?.currency)})</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-black text-stone-100 outline-none focus:border-blue-500/50 transition-all font-mono text-center"
                                                value={item.sellingPrice || ''}
                                                onChange={(e) => updateItem(item.pesticideId, 'sellingPrice', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest block text-center">Miktar ({item.unit})</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-stone-900 border border-white/5 rounded-xl p-3 text-[13px] font-black text-stone-100 outline-none focus:border-amber-500/50 transition-all font-mono text-center"
                                                value={Math.abs(item.quantity) || ''}
                                                onChange={(e) => updateItem(item.pesticideId, 'quantity', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center px-2 pt-1">
                                        <span className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Ara Toplam</span>
                                        <span className="text-base font-black text-emerald-400 font-mono tracking-tighter">{formatCurrency(Math.abs(item.quantity) * item.buyingPrice, userProfile?.currency)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-stone-950/80 border border-white/5 rounded-[2rem] p-6 flex justify-between items-center mt-6 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-500">
                                <Package size={100} />
                            </div>
                            <div className="flex flex-col relative z-10">
                                <span className="text-[11px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1.5 block">Genel Toplam</span>
                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1 bg-stone-900 rounded-lg text-stone-400 text-[10px] font-black uppercase border border-white/5">
                                        {newPurchase.items.length} Kalem / {newPurchase.items.reduce((acc: number, cur: any) => acc + Math.abs(cur.quantity), 0)} Ürün
                                    </div>
                                </div>
                            </div>
                            <div className="text-4xl font-black text-emerald-400 font-mono tracking-tight relative z-10">
                                {formatCurrency(total, userProfile?.currency)}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-2">
                            {!isEdit && (
                                <button 
                                    onClick={() => setStep(1)}
                                    className="flex-1 py-5 bg-stone-800 hover:bg-stone-700 text-stone-400 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <ChevronLeft size={18} />
                                    Listeye Dön
                                </button>
                            )}
                            <button 
                                onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        await onSave(localSupplierId);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                disabled={isSaving || newPurchase.items.length === 0 || (!supplier && !localSupplierId)}
                                className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.1em] active:scale-95 transition-all shadow-xl shadow-emerald-900/30 disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {isSaving ? <RefreshCcw size={20} className="animate-spin" /> : <Save size={20} />}
                                {isEdit ? 'Güncelle' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isAddingNewPesticide && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-stone-100 flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-xl">
                                    <FlaskConical className="text-emerald-500" size={20} />
                                </div>
                                Yeni Ürün Kaydı
                            </h3>
                            <button onClick={() => setIsAddingNewPesticide(false)} className="p-2 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-2 mb-2 block">Ürün Adı</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-5 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-bold"
                                    placeholder="Ürün adı (Örn: Gübre 10)"
                                    value={newPesticide.name}
                                    onChange={(e) => setNewPesticide({...newPesticide, name: e.target.value})}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-2 mb-2 block">Satış Birimi</label>
                                <select 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl p-5 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-bold appearance-none cursor-pointer"
                                    value={newPesticide.unit}
                                    onChange={(e) => setNewPesticide({...newPesticide, unit: e.target.value})}
                                >
                                    <option value="Adet">Adet</option>
                                    <option value="Litre">Litre</option>
                                    <option value="Kg">Kg</option>
                                    <option value="Gram">Gram</option>
                                    <option value="Paket">Paket</option>
                                    <option value="Kutu">Kutu</option>
                                    <option value="Çuval">Çuval</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-4 mt-10">
                            <button 
                                onClick={() => setIsAddingNewPesticide(false)}
                                className="flex-1 py-4 bg-stone-800 text-stone-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:text-stone-300 transition-colors"
                            >
                                Vazgeç
                            </button>
                            <button 
                                onClick={handleAddNewPesticideToPurchaseLocal}
                                className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/40 active:scale-95 transition-all"
                            >
                                Listeye Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isScanning && (
                <div className="fixed inset-0 z-[150] bg-black">
                    <BarcodeScanner 
                        onScan={(code) => {
                            handleScan(code);
                            setIsScanning(false);
                        }}
                        onClose={() => setIsScanning(false)}
                    />
                </div>
            )}
        </div>
    );
};

const PaymentModal = ({ supplier, onClose, onSave, newPayment, setNewPayment, accounts, userProfile, isEdit = false }: any) => {
    const [isSaving, setIsSaving] = useState(false);
    const isReceive = newPayment.type === 'RECEIVE';
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <h2 className="text-xl font-black text-stone-100 mb-6 flex items-center gap-3">
                    {isReceive ? <ArrowDownLeft className="text-emerald-500" /> : <CreditCard className={isEdit ? "text-emerald-500" : "text-blue-500"} />}
                    {isEdit ? 'Ödemeyi Düzenle' : (isReceive ? 'Ödeme Al' : 'Ödeme Yap')}
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
                        onClick={async () => {
                            if (isSaving) return;
                            setIsSaving(true);
                            try {
                                await onSave();
                            } finally {
                                setIsSaving(false);
                            }
                        }}
                        disabled={isSaving}
                        className={`flex-1 py-4 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg disabled:opacity-50 ${isEdit ? 'bg-emerald-600 shadow-emerald-900/20' : 'bg-blue-600 shadow-blue-900/20'}`}
                    >
                        {isSaving ? 'Kaydediliyor...' : (isEdit ? 'Güncelle' : (isReceive ? 'Tahsilatı Kaydet' : 'Ödemeyi Kaydet'))}
                    </button>
                </div>
            </div>
        </div>
    );
};


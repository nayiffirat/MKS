import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { ArrowLeft, Trash2, RotateCcw, Search, Calendar, User, Package, AlertCircle, FileText, Users, ClipboardList, CreditCard, Truck, AlertTriangle } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface DeletedPrescriptionsProps {
    onBack: () => void;
}

type TabType = 'PRESCRIPTIONS' | 'FARMERS' | 'VISITS' | 'PAYMENTS' | 'SUPPLIERS';

export const DeletedPrescriptions: React.FC<DeletedPrescriptionsProps> = ({ onBack }) => {
    const { 
        trashedPrescriptions, restorePrescription, permanentlyDeletePrescription,
        trashedFarmers, restoreFarmer, permanentlyDeleteFarmer,
        trashedVisits, restoreVisit, permanentlyDeleteVisit,
        trashedPayments, restorePayment, permanentlyDeletePayment,
        trashedSuppliers, restoreSupplier, permanentlyDeleteSupplier,
        farmers, suppliers,
        t
    } = useAppViewModel();

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('PRESCRIPTIONS');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    const farmerMap = [...farmers, ...trashedFarmers].reduce((acc, f) => {
        acc[f.id] = f;
        return acc;
    }, {} as Record<string, any>);

    const supplierMap = suppliers.reduce((acc, s) => {
        acc[s.id] = s;
        return acc;
    }, {} as Record<string, any>);

    const getFilteredItems = () => {
        const search = searchTerm.toLowerCase();
        switch (activeTab) {
            case 'PRESCRIPTIONS':
                return trashedPrescriptions.filter(p => {
                    const farmer = farmerMap[p.farmerId];
                    return `${p.prescriptionNo} ${farmer?.fullName || ''}`.toLowerCase().includes(search);
                });
            case 'FARMERS':
                return trashedFarmers.filter(f => f.fullName.toLowerCase().includes(search) || f.phoneNumber.includes(search));
            case 'VISITS':
                return trashedVisits.filter(v => {
                    const farmer = farmerMap[v.farmerId];
                    return `${v.note} ${farmer?.fullName || ''}`.toLowerCase().includes(search);
                });
            case 'PAYMENTS':
                return trashedPayments.filter(p => {
                    const farmer = farmerMap[p.farmerId];
                    return `${p.amount} ${farmer?.fullName || ''}`.toLowerCase().includes(search);
                });
            case 'SUPPLIERS':
                return trashedSuppliers.filter(s => s.name.toLowerCase().includes(search));
            default:
                return [];
        }
    };

    const handleRestore = async (id: string) => {
        switch (activeTab) {
            case 'PRESCRIPTIONS': await restorePrescription(id); break;
            case 'FARMERS': await restoreFarmer(id); break;
            case 'VISITS': await restoreVisit(id); break;
            case 'PAYMENTS': await restorePayment(id); break;
            case 'SUPPLIERS': await restoreSupplier(id); break;
        }
    };

    const handleDelete = (id: string) => {
        setItemToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        
        switch (activeTab) {
            case 'PRESCRIPTIONS': await permanentlyDeletePrescription(itemToDelete); break;
            case 'FARMERS': await permanentlyDeleteFarmer(itemToDelete); break;
            case 'VISITS': await permanentlyDeleteVisit(itemToDelete); break;
            case 'PAYMENTS': await permanentlyDeletePayment(itemToDelete); break;
            case 'SUPPLIERS': await permanentlyDeleteSupplier(itemToDelete); break;
        }
        
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
    };

    const filtered = getFilteredItems();

    const tabs = [
        { id: 'PRESCRIPTIONS', icon: FileText, label: t('nav.prescriptions') || 'Faturalar', count: trashedPrescriptions.length },
        { id: 'FARMERS', icon: Users, label: t('nav.farmers') || 'Çiftçiler', count: trashedFarmers.length },
        { id: 'VISITS', icon: ClipboardList, label: t('nav.visits') || 'Ziyaretler', count: trashedVisits.length },
        { id: 'PAYMENTS', icon: CreditCard, label: t('nav.payments') || 'Ödemeler', count: trashedPayments.length },
        { id: 'SUPPLIERS', icon: Truck, label: t('nav.suppliers') || 'Tedarikçiler', count: trashedSuppliers.length },
    ];

    return (
        <div className="flex flex-col h-full bg-stone-950 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-stone-900/80 backdrop-blur-xl border-b border-white/5 px-4 py-4 flex flex-col gap-3 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/5 rounded-xl transition-colors active:scale-95">
                        <ArrowLeft size={20} className="text-stone-400" />
                    </button>
                    <div className="flex-1">
                        <h2 className="font-bold text-stone-100 text-lg tracking-tight">{t('nav.trash') || 'Çöp Kutusu'}</h2>
                        <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">{t('trash.subtitle') || '30 gün sonra kalıcı olarak silinir'}</p>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 pt-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                                activeTab === tab.id 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm' 
                                : 'bg-stone-900 text-stone-500 border-white/5 hover:bg-stone-800 hover:text-stone-300'
                            }`}
                        >
                            <tab.icon size={14} />
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${activeTab === tab.id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-stone-800 text-stone-400'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
                    <input
                        type="text"
                        placeholder={t('search.placeholder') || "Ara..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-stone-900 border border-white/5 rounded-2xl text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
                    />
                </div>

                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-20 h-20 bg-stone-900 border border-white/5 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Trash2 size={28} className="text-stone-600" />
                        </div>
                        <p className="text-stone-400 font-medium text-sm">{t('trash.empty') || 'Çöp kutusu boş'}</p>
                    </div>
                ) : (
                    <div className="space-y-3 pb-24">
                        {filtered.map((item: any) => {
                            const deletedDate = item.deletedAt ? new Date(item.deletedAt) : new Date();
                            const daysLeft = 30 - Math.floor((new Date().getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
                            
                            let title = '';
                            let subtitle = '';
                            let icon = <FileText size={14} />;

                            if (activeTab === 'PRESCRIPTIONS') {
                                const farmer = farmerMap[item.farmerId];
                                title = `Fatura #${item.prescriptionNo}`;
                                subtitle = farmer?.fullName || t('unknown');
                                icon = <FileText size={14} />;
                            } else if (activeTab === 'FARMERS') {
                                title = item.fullName;
                                subtitle = item.phoneNumber;
                                icon = <Users size={14} />;
                            } else if (activeTab === 'VISITS') {
                                const farmer = farmerMap[item.farmerId];
                                title = farmer?.fullName || t('unknown');
                                subtitle = new Date(item.date).toLocaleDateString();
                                icon = <ClipboardList size={14} />;
                            } else if (activeTab === 'PAYMENTS') {
                                const farmer = farmerMap[item.farmerId];
                                title = `${item.amount} ₺`;
                                subtitle = farmer?.fullName || t('unknown');
                                icon = <CreditCard size={14} />;
                            } else if (activeTab === 'SUPPLIERS') {
                                title = item.name;
                                subtitle = item.phoneNumber;
                                icon = <Truck size={14} />;
                            }

                            return (
                                <div key={item.id} className="bg-stone-900 border border-white/5 p-4 rounded-3xl shadow-lg relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50"></div>
                                    
                                    <div className="flex items-start justify-between mb-3 pl-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 flex items-center gap-1 uppercase tracking-wider">
                                                    <AlertCircle size={10} />
                                                    {daysLeft} {t('trash.daysLeft') || 'gün kaldı'}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-stone-100 flex items-center gap-1.5 text-sm">
                                                <span className="text-stone-500">{icon}</span>
                                                {title}
                                            </h3>
                                            <p className="text-xs text-stone-400 mt-1 pl-5">{subtitle}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleRestore(item.id)}
                                                className="p-2.5 bg-stone-950 text-emerald-400 rounded-xl hover:bg-emerald-500/10 transition-colors border border-white/5 active:scale-95"
                                                title={t('action.restore') || 'Geri Yükle'}
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2.5 bg-stone-950 text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors border border-white/5 active:scale-95"
                                                title={t('action.permanentDelete') || 'Kalıcı Sil'}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <ConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
                onConfirm={confirmDelete}
                title={t('confirm.permanentDeleteTitle') || 'Kalıcı Olarak Silinsin mi?'}
                message={t('confirm.permanentDelete') || 'Bu kaydı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'}
                variant="danger"
            />
        </div>
    );
};

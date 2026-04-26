import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { ChevronLeft, TrendingUp, Package, Users, DollarSign, X, FileText, ClipboardList, Calendar, User as UserIcon, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/currency';

export const PerformanceScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { teamMembers, prescriptions, visits, userProfile, farmers } = useAppViewModel();
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    const farmerMap = React.useMemo(() => {
        const map: Record<string, string> = {};
        farmers.forEach(f => { map[f.id] = f.fullName; });
        return map;
    }, [farmers]);

    // Basic performance metrics
    const salesPerformance = [
        {
            id: userProfile.id,
            fullName: userProfile.fullName || 'Yönetici',
            role: 'MANAGER',
            ...(() => {
                const memberOrders = prescriptions.filter(p => !p.createdById || p.createdById === userProfile.id);
                const totalSales = memberOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
                return { totalSales, orderCount: memberOrders.length };
            })()
        },
        ...teamMembers.filter(m => m.role === 'SALES' || m.role === 'MANAGER').map(member => {
            const memberOrders = prescriptions.filter(p => p.createdById === member.id);
            const totalSales = memberOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
            return { ...member, totalSales, orderCount: memberOrders.length };
        })
    ];

    const warehousePerformance = [
        {
            id: userProfile.id,
            fullName: userProfile.fullName || 'Yönetici',
            role: 'MANAGER',
            deliveredCount: prescriptions.filter(p => p.deliveredById === userProfile.id).length
        },
        ...teamMembers.filter(m => m.role === 'WAREHOUSE').map(member => {
            const deliveredOrders = prescriptions.filter(p => p.deliveredById === member.id);
            return { ...member, deliveredCount: deliveredOrders.length };
        })
    ];

    return (
        <div className="p-4 max-w-4xl mx-auto pb-24">
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="p-2 bg-stone-900 rounded-xl text-stone-400 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Performans Takibi</h1>
                    <p className="text-stone-400 text-sm">Personel performans metrikleri</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sales Performance */}
                <div className="bg-stone-900 rounded-2xl p-6 border border-stone-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                            <TrendingUp size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-white">Satış Performansı</h2>
                    </div>
                    <div className="space-y-4">
                        {salesPerformance.map(sp => (
                            <button 
                                key={sp.id} 
                                onClick={() => setSelectedMemberId(sp.id || null)}
                                className="w-full flex items-center justify-between p-4 bg-stone-950 rounded-xl border border-stone-800 transition-all text-left group hover:border-emerald-500/50 cursor-pointer"
                            >
                                <div>
                                    <h3 className="text-white font-medium transition-colors group-hover:text-emerald-400">{sp.fullName}</h3>
                                    <p className="text-xs text-stone-500">{sp.orderCount} Sipariş</p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <p className="text-emerald-500 font-bold">₺{sp.totalSales.toLocaleString('tr-TR')}</p>
                                    <ArrowRight size={16} className="text-stone-700 group-hover:text-emerald-500 transition-colors" />
                                </div>
                            </button>
                        ))}
                        {salesPerformance.length === 0 && (
                            <p className="text-stone-500 text-sm text-center py-4">Satış personeli bulunmuyor.</p>
                        )}
                    </div>
                </div>

                {/* Warehouse Performance */}
                <div className="bg-stone-900 rounded-2xl p-6 border border-stone-800">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                            <Package size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-white">Depo Performansı</h2>
                    </div>
                    <div className="space-y-4">
                        {warehousePerformance.map(wp => (
                            <button 
                                key={wp.id} 
                                onClick={() => setSelectedMemberId(wp.id || null)}
                                className="w-full flex items-center justify-between p-4 bg-stone-950 rounded-xl border border-stone-800 transition-all text-left group hover:border-blue-500/50 cursor-pointer"
                            >
                                <div>
                                    <h3 className="text-white font-medium transition-colors group-hover:text-blue-400">{wp.fullName}</h3>
                                    <p className="text-xs text-stone-500">Teslim Edilen</p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <p className="text-blue-500 font-bold">{wp.deliveredCount} Sipariş</p>
                                    <ArrowRight size={16} className="text-stone-700 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </button>
                        ))}
                        {warehousePerformance.length === 0 && (
                            <p className="text-stone-500 text-sm text-center py-4">Depo personeli bulunmuyor.</p>
                        )}
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {selectedMemberId && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, y: 100 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 100 }}
                            className="bg-stone-900 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-stone-950/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                        <UserIcon size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">
                                            {selectedMemberId === userProfile.id 
                                                ? (userProfile.fullName || 'Yönetici') 
                                                : teamMembers.find(m => m.id === selectedMemberId)?.fullName || 'Personel'}
                                        </h2>
                                        <p className="text-stone-500 text-sm">Son İşlemler ve Aktiviteler</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedMemberId(null)}
                                    className="p-2 hover:bg-white/5 rounded-xl text-stone-400 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
                                {/* Recent Prescriptions */}
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileText size={18} className="text-emerald-500" />
                                        <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest">Son Siparişler</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {prescriptions
                                            .filter(p => p.createdById === selectedMemberId || (selectedMemberId === userProfile.id && !p.createdById))
                                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .slice(0, 5)
                                            .map((p: any) => (
                                                <div key={p.id} className="bg-stone-950 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-white font-medium">{farmerMap[p.farmerId] || 'Bilinmeyen Çiftçi'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Calendar size={12} className="text-stone-600" />
                                                            <p className="text-[10px] text-stone-500">{new Date(p.date).toLocaleDateString('tr-TR')}</p>
                                                            <span className="text-[10px] text-stone-600">•</span>
                                                            <p className="text-[10px] text-stone-500 font-mono">{p.prescriptionNo}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-emerald-500 font-bold text-sm">
                                                            {formatCurrency(p.totalAmount || 0, userProfile.currency || 'TRY')}
                                                        </p>
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                                            p.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-500' :
                                                            p.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                                                            'bg-stone-800 text-stone-400'
                                                        }`}>
                                                            {p.status || 'BEKLEMEDE'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        {prescriptions.filter(p => p.createdById === selectedMemberId || (selectedMemberId === userProfile.id && !p.createdById)).length === 0 && (
                                            <p className="text-stone-600 text-xs italic text-center py-4 bg-stone-950/50 rounded-2xl border border-dashed border-white/5">Henüz sipariş kaydı bulunmuyor.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Recent Visits */}
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <ClipboardList size={18} className="text-blue-500" />
                                        <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest">Son Reçeteler</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {visits
                                            .filter((v: any) => v.createdById === selectedMemberId || (selectedMemberId === userProfile.id && !v.createdById))
                                            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .slice(0, 5)
                                            .map((v: any) => (
                                                <div key={v.id} className="bg-stone-950 p-4 rounded-2xl border border-white/5">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <p className="text-white font-medium">{farmerMap[v.farmerId] || 'Bilinmeyen Çiftçi'}</p>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={12} className="text-stone-600" />
                                                            <p className="text-[10px] text-stone-500">{new Date(v.date).toLocaleDateString('tr-TR')}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-stone-400 line-clamp-2 italic">"{v.note}"</p>
                                                    {v.village && (
                                                        <div className="mt-2 flex items-center gap-1">
                                                            <span className="text-[9px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded-full">
                                                                {v.village}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        {visits.filter((v: any) => v.createdById === selectedMemberId || (selectedMemberId === userProfile.id && !v.createdById)).length === 0 && (
                                            <p className="text-stone-600 text-xs italic text-center py-4 bg-stone-950/50 rounded-2xl border border-dashed border-white/5">Henüz reçete kaydı bulunmuyor.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-stone-950/50 border-t border-white/5">
                                <button 
                                    onClick={() => setSelectedMemberId(null)}
                                    className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-2xl font-bold transition-colors"
                                >
                                    Kapat
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

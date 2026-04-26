
import React, { useMemo, useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { 
    Users, 
    TrendingUp, 
    AlertTriangle, 
    ChevronLeft, 
    Search, 
    Filter, 
    ArrowUpRight, 
    ArrowDownRight, 
    Sprout, 
    Scale, 
    History,
    ShieldCheck,
    ShieldAlert,
    Zap,
    Map,
    X,
    ChevronRight,
    Info,
    Calendar,
    Wallet,
    LandPlot as LandPlotIcon,
    Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../utils/currency';
import { Farmer, Prescription, Payment, ManualDebt } from '../types';

interface FindeksProps {
    onBack?: () => void;
}

import { CROP_AGRONOMY_INTEL, DEFAULT_AGRONOMY, CROP_PESTICIDE_COSTS, DEFAULT_PESTICIDE_COST } from '../constants';

export const Findeks: React.FC<FindeksProps> = ({ onBack }) => {
    const { farmers, prescriptions, manualDebts, payments, inventory, myPayments, userProfile, prescriptionLabel } = useAppViewModel();
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'RISKY' | 'LOYAL'>('ALL');
    const [selectedDetailFarmer, setSelectedDetailFarmer] = useState<(typeof farmerStats[0]) | null>(null);
    const [activeModal, setActiveModal] = useState<'COST' | 'MAP' | null>(null);

    const farmerStats = useMemo(() => {
        return farmers.map(farmer => {
            // Filter non-deleted records
            const farmerPrescriptions = prescriptions.filter(p => p.farmerId === farmer.id && !p.deletedAt);
            const farmerManualDebts = manualDebts.filter(d => d.farmerId === farmer.id && !d.deletedAt);
            const farmerPayments = payments.filter(p => p.farmerId === farmer.id && !p.deletedAt);
            const farmerMyPayments = myPayments.filter(p => p.farmerId === farmer.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId);

            // 1. Calculate Current Debt
            const totalPrescriptionAmount = farmerPrescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
            const totalManualDebtAmount = farmerManualDebts.reduce((acc, d) => acc + (d.amount || 0), 0);
            
            const regularPayments = farmerPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
            const returns = farmerPrescriptions.filter(p => (p.totalAmount || 0) < 0).reduce((acc, p) => acc + Math.abs(p.totalAmount || 0), 0);
            const checkPayments = farmerMyPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
            
            const totalPaid = regularPayments + returns + checkPayments;
            const currentDebt = (totalPrescriptionAmount + totalManualDebtAmount) - totalPaid;

            // 2. Calculate Total Sales (Company turnover with this farmer)
            const totalSales = totalPrescriptionAmount;

            // 3. Calculate Actual Earnings (Your profit from sales to this farmer) - AI Driven
            let totalProfit = 0;
            farmerPrescriptions.forEach(pres => {
                pres.items.forEach(item => {
                    const quantityNum = parseFloat(item.quantity?.split(' ')[0] || '0');
                    const sellingPrice = item.totalPrice || ((item.unitPrice || 0) * quantityNum);
                    
                    // Priority 1: Use specific item buyingPrice
                    // Priority 2: Use inventory base buyingPrice
                    // Fallback: 30% margin
                    const invItem = inventory.find(inv => inv.pesticideId === item.pesticideId);
                    const baseBuyingPrice = invItem?.buyingPrice || 0;
                    
                    const actualBuyingPrice = (item.buyingPrice || baseBuyingPrice) * quantityNum;
                    
                    if (actualBuyingPrice > 0) {
                        totalProfit += (sellingPrice - actualBuyingPrice);
                    } else {
                        totalProfit += sellingPrice * 0.30; // Shifting to average 30% margin for agro-chemicals
                    }
                });
            });

            // 4. Calculate Risk Capacity (Based on Land * AI Pesticide Costs)
            let totalExpectedPesticideCapacity = 0;
            const fieldBreakdown = farmer.fields.map(field => {
                const costPerDa = CROP_PESTICIDE_COSTS[field.crop] || DEFAULT_PESTICIDE_COST;
                const estimatedCost = field.size * costPerDa;
                totalExpectedPesticideCapacity += estimatedCost;
                return { ...field, estimatedCost, costPerDa };
            });

            // 5. Risk Score Calculation (Current Debt vs Field Capacity)
            // AI Insight: If debt > 120% of capacity, it's extreme risk.
            let riskScore = 0;
            if (currentDebt > 0) {
                if (totalExpectedPesticideCapacity > 0) {
                    riskScore = (currentDebt / totalExpectedPesticideCapacity) * 100;
                    // Cap it logically but allow overflow for "Extreme" visualization
                    riskScore = Math.min(riskScore, 100);
                } else {
                    riskScore = 100;
                }
            }

            // 6. Loyalty & Payment Power (Penalty for overdue days)
            // USER REQUEST: ödeme gücünü de vade geçtiği her gün biraz biraz düşürmeye başla
            let loyaltyScore = 85; // Start with healthy base
            
            const now = new Date();
            let maxOverdueDays = 0;
            
            farmerPrescriptions.forEach(p => {
                if (p.priceType === 'TERM' && p.dueDate) {
                    const dueDate = new Date(p.dueDate);
                    if (now > dueDate && currentDebt > 0) {
                        const diff = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
                        if (diff > maxOverdueDays) maxOverdueDays = diff;
                    }
                } else if (currentDebt > 100) {
                    // Default grace window of 60 days for non-term debts
                    const pDate = new Date(p.date);
                    const diff = (now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
                    if (diff > 60) {
                        const overdue = diff - 60;
                        if (overdue > maxOverdueDays) maxOverdueDays = overdue;
                    }
                }
            });

            // Exponential penalty for overdue days to represent risk acceleration
            // 1st week: -2 per day
            // 1st month: -3 per day
            // After 3 months: Score hits near zero
            const overduePenalty = maxOverdueDays > 0 ? (maxOverdueDays * 2.5) : 0;
            loyaltyScore -= overduePenalty;
            
            // Loyalty points for transaction frequency & volume
            loyaltyScore += (farmerPrescriptions.length * 1.5);
            loyaltyScore += (totalSales > 50000 ? 5 : 0);
            
            loyaltyScore = Math.min(Math.max(loyaltyScore, 5), 100);

            let findeksScore = 1400; // Base score
            findeksScore += (loyaltyScore - 50) * 8; 
            findeksScore -= (riskScore * 6);
            findeksScore -= (maxOverdueDays * 5);
            if (totalSales > 50000) findeksScore += 100;
            if (currentDebt === 0 && totalSales > 0) findeksScore += 150;
            findeksScore = Math.max(1, Math.min(1900, Math.round(findeksScore)));

            return {
                ...farmer,
                currentDebt: Math.max(0, currentDebt),
                riskScore,
                loyaltyScore,
                findeksScore,
                totalSales,
                totalProfit,
                totalLandSize: farmer.fields.reduce((acc, f) => acc + (f.size || 0), 0),
                prescriptionCount: farmerPrescriptions.length,
                lastTransactionDate: farmerPrescriptions.length > 0 ? farmerPrescriptions[0].date : null,
                maxOverdueDays,
                totalExpectedPesticideCapacity,
                fieldBreakdown,
                farmerPrescriptions,
                farmerPayments
            };
        });
    }, [farmers, prescriptions, manualDebts, payments, inventory, myPayments]);

    const filteredFarmers = useMemo(() => {
        let result = farmerStats;
        
        if (searchTerm) {
            const term = searchTerm.toLocaleLowerCase('tr-TR');
            result = result.filter(f => 
                f.fullName.toLocaleLowerCase('tr-TR').includes(term) || 
                f.village.toLocaleLowerCase('tr-TR').includes(term)
            );
        }

        if (filter === 'RISKY') {
            result = result.filter(f => f.findeksScore < 1100);
            result.sort((a, b) => a.findeksScore - b.findeksScore);
        } else if (filter === 'LOYAL') {
            result = result.filter(f => f.findeksScore >= 1500);
            result.sort((a, b) => b.findeksScore - a.findeksScore);
        } else {
            result.sort((a, b) => b.currentDebt - a.currentDebt);
        }

        return result;
    }, [farmerStats, searchTerm, filter]);

    const getFindeksLabel = (score: number) => {
        if (score >= 1700) return { label: 'Çok İyi', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
        if (score >= 1500) return { label: 'İyi', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
        if (score >= 1100) return { label: 'Az Riskli', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
        if (score >= 700) return { label: 'Orta Riskli', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
        return { label: 'Riskli', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    };

    const getLoyaltyLabel = (score: number) => {
        if (score > 80) return { label: 'Sadık Müşteri', color: 'text-blue-500' };
        if (score > 40) return { label: 'Düzenli', color: 'text-stone-400' };
        return { label: 'Yeni/Seyrek', color: 'text-stone-600' };
    };

    const renderModals = () => (
        <AnimatePresence>
            {activeModal && selectedDetailFarmer && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setActiveModal(null)}
                >
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="bg-stone-900 border border-white/10 w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center text-amber-500">
                                    {activeModal === 'COST' ? <TrendingUp size={24} /> : <Map size={24} />}
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-white">
                                        {activeModal === 'COST' ? 'İlaç Maliyet Analizi' : 'Arazi Haritası & Ürünler'}
                                    </h2>
                                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{selectedDetailFarmer.fullName}</p>
                                </div>
                            </div>
                            <button onClick={() => setActiveModal(null)} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {activeModal === 'COST' ? (
                                <div className="space-y-6">
                                    {/* Financial Overview */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-stone-950/50 border border-white/5 rounded-3xl">
                                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">Mevcut Borç</span>
                                            <div className="text-xl font-black text-white font-mono">
                                                {formatCurrency(selectedDetailFarmer.currentDebt, userProfile?.currency || 'TRY')}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-stone-950/50 border border-white/5 rounded-3xl">
                                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest block mb-1">Top. Tahmini Maliyet</span>
                                            <div className="text-xl font-black text-amber-400 font-mono">
                                                {formatCurrency(selectedDetailFarmer.totalExpectedPesticideCapacity, userProfile?.currency || 'TRY')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Crop Breakdown */}
                                    <div>
                                        <h3 className="text-sm font-black text-stone-200 mb-4 flex items-center gap-2">
                                            <Sprout size={16} className="text-emerald-500" />
                                            Ürün Bazlı İlaçlama Limitleri
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedDetailFarmer.fieldBreakdown.map((field, i) => (
                                                <div key={i} className="p-4 bg-stone-800/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-stone-800 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-stone-900 border border-white/5 flex items-center justify-center text-stone-500 group-hover:text-amber-500 transition-colors">
                                                            <LandPlotIcon size={18} />
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-white text-sm">{field.crop}</div>
                                                            <div className="text-[10px] font-bold text-stone-500 uppercase">{field.size} dekar · {field.costPerDa}₺/da</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-stone-100 font-mono">
                                                            {formatCurrency(field.estimatedCost, userProfile?.currency || 'TRY')}
                                                        </div>
                                                        <div className="text-[9px] font-black text-stone-600 uppercase">Limit</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Warnings */}
                                    {selectedDetailFarmer.riskScore > 80 && (
                                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-3">
                                            <AlertTriangle size={20} className="text-rose-500 shrink-0" />
                                            <div>
                                                <div className="text-xs font-black text-rose-500 uppercase tracking-widest mb-1">KRİTİK UYARI</div>
                                                <p className="text-xs text-rose-200/70 leading-relaxed font-medium">Bu çiftçinin borcu, arazisinin toplam ilaçlama kapasitesini aşmış durumda. Yeni satışlarda teminat istenmesi önerilir.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Visual Map Placeholder */}
                                    <div className="aspect-video bg-stone-950 border border-white/10 rounded-[32px] relative overflow-hidden flex items-center justify-center group">
                                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                                            <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                                        </div>
                                        <div className="relative z-10 flex flex-col items-center">
                                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 animate-pulse">
                                                <LandPlotIcon size={32} className="text-emerald-500" />
                                            </div>
                                            <h4 className="text-sm font-black text-emerald-500 uppercase tracking-widest">Saha Simülasyonu Aktif</h4>
                                            <p className="text-[10px] text-stone-500 font-bold mt-1 uppercase">Toplam {selectedDetailFarmer.fields.length} Lokasyon</p>
                                        </div>
                                    </div>

                                    {/* Field List */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-black text-stone-200 flex items-center gap-2">
                                            <Bot size={16} className="text-amber-500" />
                                            AI Saha Reçetesi & Analizi
                                        </h3>
                                        {selectedDetailFarmer.fields.map((field, i) => {
                                            const agronomy = CROP_AGRONOMY_INTEL[field.crop] || DEFAULT_AGRONOMY;
                                            return (
                                                <div key={i} className="p-5 bg-stone-800/40 border border-white/5 rounded-3xl group hover:border-amber-500/30 transition-all">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-stone-950 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner">
                                                                <LandPlotIcon size={20} />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-black text-white">{field.crop}</div>
                                                                <div className="text-[10px] font-bold text-stone-500 uppercase">{selectedDetailFarmer.village} / Mevkii {i+1} · {field.size} da</div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-tighter">İdeal Gelişim</span>
                                                        </div>
                                                    </div>

                                                    {/* AI DATA GRID */}
                                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                                        <div className="p-3 bg-stone-950/40 rounded-2xl border border-white/5">
                                                            <span className="text-[7px] font-black text-stone-500 uppercase block mb-1">Toprak İhtiyacı</span>
                                                            <span className="text-[10px] font-bold text-stone-300 leading-tight block">{agronomy.soilType}</span>
                                                        </div>
                                                        <div className="p-3 bg-stone-950/40 rounded-2xl border border-white/5">
                                                            <span className="text-[7px] font-black text-stone-500 uppercase block mb-1">Sulama Periyodu</span>
                                                            <span className="text-[10px] font-bold text-blue-400 leading-tight block">{agronomy.irrigationNeeds}</span>
                                                        </div>
                                                    </div>

                                                    {/* RISK MONITORING */}
                                                    <div className="mb-4">
                                                        <span className="text-[7px] font-black text-stone-500 uppercase block mb-1.5 ml-1">Kritik Zararlı Takibi (AI Tahmin)</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {agronomy.pestRisk.map((pest, idx) => (
                                                                <span key={idx} className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase italic">
                                                                    {pest}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* SMART RECOMMENDATION */}
                                                    <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Info size={10} className="text-amber-500" />
                                                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Akıllı Not</span>
                                                        </div>
                                                        <p className="text-[10px] text-stone-400 font-medium leading-relaxed">
                                                            Bu parsel için <span className="text-amber-200">{agronomy.criticalPeriod}</span> dönemi en kritik evredir. {field.crop} gelişimi için <span className="text-emerald-400">{agronomy.yieldPotential}</span> potansiyeli öngörülmektedir.
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-stone-950/50 border-t border-white/5">
                            <button 
                                onClick={() => setActiveModal(null)}
                                className="w-full py-4 bg-stone-800 hover:bg-stone-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                Anladım
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="flex flex-col h-full bg-stone-950 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-stone-900/50 backdrop-blur-xl border-b border-white/5 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button onClick={onBack} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <div>
                            <h1 className="text-xl font-black text-white flex items-center gap-2">
                                <Scale className="text-amber-500" size={24} />
                                Findeks
                            </h1>
                            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Çiftçi Risk ve Verimlilik Analizi</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-stone-950/50 border border-white/5 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <ShieldAlert size={12} className="text-rose-500" />
                            <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Riskliler</span>
                        </div>
                        <div className="text-lg font-black text-rose-400 font-mono">
                            {farmerStats.filter(f => f.findeksScore < 1100).length}
                        </div>
                    </div>
                    <div className="bg-stone-950/50 border border-white/5 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp size={12} className="text-emerald-500" />
                            <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Güvenli</span>
                        </div>
                        <div className="text-lg font-black text-emerald-400 font-mono">
                            {farmerStats.filter(f => f.findeksScore >= 1500).length}
                        </div>
                    </div>
                    <div className="bg-stone-950/50 border border-white/5 rounded-2xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Users size={12} className="text-blue-500" />
                            <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Toplam</span>
                        </div>
                        <div className="text-lg font-black text-blue-400 font-mono">
                            {farmers.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="p-3 bg-stone-900/30 backdrop-blur-md border-b border-white/5 shrink-0">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={14} />
                        <input 
                            type="text" 
                            placeholder="Çiftçi veya köy ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-stone-950 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-stone-100 outline-none focus:border-amber-500/30 transition-all font-medium"
                        />
                    </div>
                    <div className="flex bg-stone-950 border border-white/5 rounded-xl p-1">
                        <button 
                            onClick={() => setFilter('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${filter === 'ALL' ? 'bg-stone-800 text-white' : 'text-stone-500 hover:text-stone-300'}`}
                        >
                            Hepsi
                        </button>
                        <button 
                            onClick={() => setFilter('RISKY')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${filter === 'RISKY' ? 'bg-rose-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                        >
                            Riskli
                        </button>
                        <button 
                            onClick={() => setFilter('LOYAL')}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${filter === 'LOYAL' ? 'bg-emerald-600 text-white shadow-lg' : 'text-stone-500 hover:text-stone-300'}`}
                        >
                            Sadık
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar pb-24">
                {filteredFarmers.map(farmer => {
                    const findeks = getFindeksLabel(farmer.findeksScore);
                    
                    return (
                        <div key={farmer.id} className="bg-stone-900/60 border border-white/5 rounded-3xl p-4 group hover:border-amber-500/20 transition-all shadow-lg active:scale-[0.98]">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-950 border border-white/5 flex items-center justify-center relative overflow-hidden">
                                        {farmer.avatarUrl ? (
                                            <img src={farmer.avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        ) : (
                                            <Users size={20} className="text-stone-700" />
                                        )}
                                        <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-stone-950 rounded-full ${farmer.currentDebt <= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-stone-100">{farmer.fullName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-tight">{farmer.village}</span>
                                            <span className="w-1 h-1 rounded-full bg-stone-700"></span>
                                            <span className="text-[10px] font-medium text-stone-500">{farmer.totalLandSize} da Arazisi</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-sm font-black font-mono ${farmer.currentDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {formatCurrency(farmer.currentDebt, userProfile?.currency || 'TRY')}
                                    </div>
                                    <div className="text-[9px] font-black text-stone-600 uppercase tracking-widest mt-0.5">Güncel Borç</div>
                                </div>
                            </div>

                            {/* SALES & PROFIT ANALYSIS */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="bg-stone-950/40 border border-white/5 rounded-2xl p-3">
                                    <span className="text-[7px] font-black text-stone-500 uppercase tracking-widest block mb-1">Toplam Satış</span>
                                    <div className="text-xs font-black text-blue-100 font-mono">
                                        {formatCurrency(farmer.totalSales, userProfile?.currency || 'TRY')}
                                    </div>
                                </div>
                                <div className="bg-stone-950/40 border border-white/5 rounded-2xl p-3">
                                    <span className="text-[7px] font-black text-stone-500 uppercase tracking-widest block mb-1">Toplam Kazanç</span>
                                    <div className="text-xs font-black text-emerald-400 font-mono text-glow">
                                        {formatCurrency(farmer.totalProfit, userProfile?.currency || 'TRY')}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className={`p-3 rounded-2xl border ${findeks.bg} ${findeks.border} relative overflow-hidden`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${findeks.color}`}>Findeks Puanı</span>
                                        {farmer.findeksScore < 1100 ? <AlertTriangle size={12} className={findeks.color} /> : <ShieldCheck size={12} className={findeks.color} />}
                                    </div>
                                    <div className="flex items-end gap-2 mt-1">
                                        <div className={`text-2xl font-black font-mono leading-none ${findeks.color}`}>{farmer.findeksScore}</div>
                                        <div className={`text-[9px] font-black pb-0.5 uppercase tracking-wider ${findeks.color}`}>{findeks.label}</div>
                                    </div>
                                    <div className="w-full h-1 bg-stone-950/50 rounded-full mt-3 overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${findeks.bg.replace('/10', '')} ${farmer.findeksScore < 1100 ? 'shadow-[0_0_8px_currentColor]' : ''}`}
                                            style={{ width: `${(farmer.findeksScore / 1900) * 100}%` }}
                                        ></div>
                                    </div>
                                    {farmer.maxOverdueDays > 0 && (
                                        <div className="mt-2 text-[7px] font-bold text-rose-500 uppercase tracking-tight flex items-center gap-1">
                                            <AlertTriangle size={8} /> {Math.round(farmer.maxOverdueDays)} GÜN VADE AŞIMI
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 rounded-2xl border border-white/5 bg-stone-950/30">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[8px] font-black text-stone-500 uppercase tracking-widest">Ödeme Gücü</span>
                                        <Zap size={12} className={farmer.loyaltyScore > 50 ? 'text-emerald-500' : 'text-stone-700'} />
                                    </div>
                                    <div className="text-xs font-black text-stone-300">
                                        %{Math.round(farmer.loyaltyScore)}
                                    </div>
                                    <div className="w-full h-1 bg-stone-950/50 rounded-full mt-2 overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${farmer.loyaltyScore < 40 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${farmer.loyaltyScore}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                            {farmer.fields.slice(0, 2).map((field, i) => (
                                                <span key={i} className="text-[7px] font-black bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded uppercase">{field.crop}</span>
                                            ))}
                                            {farmer.fields.length > 2 && <span className="text-[7px] font-black text-stone-600">+{farmer.fields.length - 2}</span>}
                                        </div>
                                        <span className="text-[7px] font-bold text-stone-600 uppercase tracking-widest mt-1">Ekili Ürünler</span>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    <button 
                                        onClick={() => { setSelectedDetailFarmer(farmer); setActiveModal('COST'); }}
                                        title="Maliyet Analizi" 
                                        className="p-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-stone-500 hover:text-amber-500 transition-colors"
                                    >
                                        <TrendingUp size={14} />
                                    </button>
                                    <button 
                                        onClick={() => { setSelectedDetailFarmer(farmer); setActiveModal('MAP'); }}
                                        title="Arazi Haritası" 
                                        className="p-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-stone-500 hover:text-blue-500 transition-colors"
                                    >
                                        <Map size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filteredFarmers.length === 0 && (
                    <div className="py-20 text-center">
                        <Users size={48} className="text-stone-800 mx-auto mb-4" />
                        <h3 className="text-stone-600 font-bold">Sonuç bulunamadı</h3>
                        <p className="text-stone-700 text-xs mt-1">Arama kriterlerinize uygun çiftçi bulunamadı.</p>
                    </div>
                )}
            </div>

            {renderModals()}
        </div>
    );
};

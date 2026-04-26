import React, { useState } from 'react';
import { Calculator as CalcIcon, ArrowLeft, Percent, DollarSign, TrendingUp, RefreshCcw, Ruler } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useAppViewModel } from '../context/AppContext';

interface CalculatorProps {
    onBack: () => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ onBack }) => {
    const { userProfile } = useAppViewModel();
    const [buyingPrice, setBuyingPrice] = useState<string>('');
    const [sellingPrice, setSellingPrice] = useState<string>('');
    const [margin, setMargin] = useState<string>('');
    const [packageSize, setPackageSize] = useState<string>('');
    const [dosagePerDekar, setDosagePerDekar] = useState<string>('');
    
    const [profit, setProfit] = useState<number | null>(null);
    const [calculatedMargin, setCalculatedMargin] = useState<number | null>(null);
    const [calculatedSellingPrice, setCalculatedSellingPrice] = useState<number | null>(null);
    const [costPerDekar, setCostPerDekar] = useState<number | null>(null);

    const parseFloatSafe = (val: string) => parseFloat(val.replace(',', '.')) || 0;

    const handleCalculateMargin = () => {
        const buy = parseFloatSafe(buyingPrice);
        const sell = parseFloatSafe(sellingPrice);
        
        if (!isNaN(buy) && !isNaN(sell) && buy > 0) {
            const profitAmount = sell - buy;
            const marginPercent = (profitAmount / buy) * 100;
            setProfit(profitAmount);
            setCalculatedMargin(marginPercent);
            setCalculatedSellingPrice(null); // Reset other calculation
            calculateDekarCost(sell);
        }
    };

    const handleCalculateSellingPrice = () => {
        const buy = parseFloatSafe(buyingPrice);
        const marg = parseFloatSafe(margin);

        if (!isNaN(buy) && !isNaN(marg) && buy > 0) {
            const profitAmount = buy * (marg / 100);
            const sell = buy + profitAmount;
            setProfit(profitAmount);
            setCalculatedSellingPrice(sell);
            setCalculatedMargin(null); // Reset other calculation
            calculateDekarCost(sell);
        }
    };

    const calculateDekarCost = (sellPrice: number) => {
        const pkgSize = parseFloatSafe(packageSize);
        const dosage = parseFloatSafe(dosagePerDekar);
        
        if (!isNaN(pkgSize) && !isNaN(dosage) && pkgSize > 0) {
            const cost = (sellPrice / pkgSize) * dosage;
            setCostPerDekar(cost);
        } else {
            setCostPerDekar(null);
        }
    };

    const handleReset = () => {
        setBuyingPrice('');
        setSellingPrice('');
        setMargin('');
        setPackageSize('');
        setDosagePerDekar('');
        setProfit(null);
        setCalculatedMargin(null);
        setCalculatedSellingPrice(null);
        setCostPerDekar(null);
    };

    return (
        <div className="p-4 space-y-6 animate-in fade-in duration-500 pb-24">
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-stone-900 border border-white/10 rounded-xl text-stone-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-stone-100">Hesaplama Aracı</h1>
                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Kâr ve Marj Hesapla</p>
                    </div>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-2xl">
                    <CalcIcon className="text-emerald-500" size={24} />
                </div>
            </header>

            <div className="bg-stone-900/60 border border-white/10 rounded-3xl p-5 space-y-5">
                
                {/* Inputs */}
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Alış Fiyatı</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
                            <input 
                                type="number" 
                                className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono"
                                placeholder="0.00"
                                value={buyingPrice}
                                onChange={(e) => setBuyingPrice(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Satış Fiyatı</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
                                <input 
                                    type="number" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono"
                                    placeholder="0.00"
                                    value={sellingPrice}
                                    onChange={(e) => setSellingPrice(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Kâr Marjı (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600" size={16} />
                                <input 
                                    type="number" 
                                    className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm text-stone-100 outline-none focus:border-emerald-500/50 transition-all font-mono"
                                    placeholder="0"
                                    value={margin}
                                    onChange={(e) => setMargin(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Ruler size={12} className="text-amber-500" /> Dekar Maliyeti (Opsiyonel)
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Ambalaj (L/Kg)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 px-4 text-sm text-stone-100 outline-none focus:border-amber-500/50 transition-all font-mono"
                                        placeholder="Örn: 1, 5, 20"
                                        value={packageSize}
                                        onChange={(e) => setPackageSize(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1 mb-1.5 block">Doz (cc/gr)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        className="w-full bg-stone-950 border border-white/5 rounded-2xl py-3 px-4 text-sm text-stone-100 outline-none focus:border-amber-500/50 transition-all font-mono"
                                        placeholder="Örn: 100, 250"
                                        value={dosagePerDekar}
                                        onChange={(e) => setDosagePerDekar(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                        onClick={handleCalculateMargin}
                        disabled={!buyingPrice || !sellingPrice}
                        className="py-3 bg-emerald-600/20 text-emerald-400 rounded-2xl font-bold text-xs active:scale-95 transition-all border border-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Percent size={14} /> Marj Hesapla
                    </button>
                    <button 
                        onClick={handleCalculateSellingPrice}
                        disabled={!buyingPrice || !margin}
                        className="py-3 bg-blue-600/20 text-blue-400 rounded-2xl font-bold text-xs active:scale-95 transition-all border border-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <DollarSign size={14} /> Fiyat Hesapla
                    </button>
                </div>

                <button 
                    onClick={handleReset}
                    className="w-full py-3 bg-stone-800 text-stone-400 rounded-2xl font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <RefreshCcw size={14} /> Temizle
                </button>

                {/* Results */}
                {(profit !== null || calculatedMargin !== null || calculatedSellingPrice !== null) && (
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                        <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                            <TrendingUp size={12} className="text-emerald-500" /> Sonuçlar
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-stone-950 rounded-2xl p-4 border border-white/5">
                                <span className="block text-[9px] font-bold text-stone-500 uppercase tracking-widest mb-1">Net Kâr</span>
                                <span className="text-lg font-black text-emerald-400 font-mono">
                                    {profit !== null ? formatCurrency(profit, userProfile?.currency || 'TRY') : '-'}
                                </span>
                            </div>
                            
                            {calculatedMargin !== null && (
                                <div className="bg-stone-950 rounded-2xl p-4 border border-white/5">
                                    <span className="block text-[9px] font-bold text-stone-500 uppercase tracking-widest mb-1">Kâr Marjı</span>
                                    <span className="text-lg font-black text-blue-400 font-mono">
                                        %{calculatedMargin.toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {calculatedSellingPrice !== null && (
                                <div className="bg-stone-950 rounded-2xl p-4 border border-white/5">
                                    <span className="block text-[9px] font-bold text-stone-500 uppercase tracking-widest mb-1">Önerilen Satış Fiyatı</span>
                                    <span className="text-lg font-black text-amber-400 font-mono">
                                        {formatCurrency(calculatedSellingPrice, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>
                            )}

                            {costPerDekar !== null && (
                                <div className="bg-stone-950 rounded-2xl p-4 border border-white/5 col-span-2">
                                    <span className="block text-[9px] font-bold text-stone-500 uppercase tracking-widest mb-1">Dekar Maliyeti</span>
                                    <span className="text-xl font-black text-rose-400 font-mono">
                                        {formatCurrency(costPerDekar, userProfile?.currency || 'TRY')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

import React from 'react';
import { TrendingUp, X } from 'lucide-react';
import { Prescription, InventoryItem } from '../../types';
import { formatCurrency } from '../../utils/currency';

interface PrescriptionProfitModalProps {
    showProfitId: string | null;
    prescriptions: Prescription[];
    inventory: InventoryItem[];
    currency?: string;
    onClose: () => void;
}

export const PrescriptionProfitModal: React.FC<PrescriptionProfitModalProps> = React.memo(({
    showProfitId,
    prescriptions,
    inventory,
    currency,
    onClose,
}) => {
    if (!showProfitId) return null;

    const p = prescriptions.find(presc => presc.id === showProfitId);
    if (!p) return null;

    const totalSales = p.totalAmount || 0;
    const itemsWithCost = p.items.map(item => {
        const qty = parseFloat(item.quantity?.toString().replace(',', '.') || '0') || 0;
        let cost = item.buyingPrice;
        if (cost === undefined) {
            const invItem = inventory.find(inv => inv.pesticideId === item.pesticideId);
            cost = invItem?.buyingPrice || 0;
        }
        return {
            ...item,
            qty,
            cost,
            totalCost: qty * cost,
            totalSale: item.totalPrice || 0
        };
    });

    const totalCost = itemsWithCost.reduce((acc, item) => acc + item.totalCost, 0);
    const profit = totalSales - totalCost;
    const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;
    const curr = (currency as any) || 'TRY';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2rem] p-5 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-black text-stone-100 flex items-center gap-2">
                        <TrendingUp className="text-emerald-500" size={18} />
                        Kar/Zarar Analizi
                    </h2>
                    <button onClick={onClose} className="p-1.5 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors">
                        <X size={14} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2">
                        <div className="bg-stone-950 p-3 rounded-xl border border-white/5">
                            <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5">Toplam Satış</p>
                            <p className="text-base font-black text-stone-100 font-mono">{formatCurrency(totalSales, curr)}</p>
                        </div>
                        <div className="bg-stone-950 p-3 rounded-xl border border-white/5">
                            <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-0.5">Toplam Maliyet</p>
                            <p className="text-base font-black text-stone-400 font-mono">{formatCurrency(totalCost, curr)}</p>
                        </div>
                        <div className={`p-3 rounded-xl border ${profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                            <div className="flex justify-between items-start mb-0.5">
                                <p className={`text-[9px] font-black uppercase tracking-widest ${profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {profit >= 0 ? 'Net Kar' : 'Net Zarar'}
                                </p>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${profit >= 0 ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                    %{profitMargin.toFixed(1)}
                                </span>
                            </div>
                            <p className={`text-lg font-black font-mono ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatCurrency(Math.abs(profit), curr)}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 no-scrollbar">
                        <p className="text-[9px] font-black text-stone-600 uppercase tracking-widest ml-1">Ürün Bazlı Detay</p>
                        {itemsWithCost.map((item, idx) => (
                            <div key={idx} className="bg-stone-950/50 p-2.5 rounded-lg border border-white/5 flex justify-between items-center">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold text-stone-300 truncate">{item.pesticideName}</p>
                                    <p className="text-[8px] text-stone-500">{item.qty} Adet x {formatCurrency(item.cost, curr)}</p>
                                </div>
                                <div className="text-right ml-2">
                                    <p className={`text-[10px] font-black font-mono ${item.totalSale - item.totalCost >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {formatCurrency(item.totalSale - item.totalCost, curr)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={onClose}
                        className="w-full py-3 bg-stone-800 hover:bg-stone-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
                    >
                        Kapat
                    </button>
                </div>
            </div>
        </div>
    );
});

PrescriptionProfitModal.displayName = 'PrescriptionProfitModal';

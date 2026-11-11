import React from 'react';
import { DollarSign, X, Search, RefreshCw, Save, ClipboardCheck, AlertCircle, ArrowRight, Edit2 } from 'lucide-react';
import { InventoryItem } from '../../types';

interface InventoryBatchPriceModalProps {
    isOpen: boolean;
    inventory: InventoryItem[];
    priceUpdateItems: InventoryItem[];
    setPriceUpdateItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    priceUpdateSearch: string;
    setPriceUpdateSearch: (val: string) => void;
    isSaving: boolean;
    onClose: () => void;
    onSave: () => void;
}

export const InventoryBatchPriceModal: React.FC<InventoryBatchPriceModalProps> = React.memo(({
    isOpen,
    inventory,
    priceUpdateItems,
    setPriceUpdateItems,
    priceUpdateSearch,
    setPriceUpdateSearch,
    isSaving,
    onClose,
    onSave,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-stone-900 w-full max-w-4xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-stone-950/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/20 rounded-2xl text-amber-500 border border-amber-500/20">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-stone-100 tracking-tight">Hızlı Fiyat Güncelleme</h3>
                            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Alış ve Satış Fiyatlarını Toplu Düzenle</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-stone-800 text-stone-500 hover:text-stone-300 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 bg-stone-950/30 border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute left-4 top-3 text-stone-600" size={18} />
                        <input 
                            type="text" 
                            placeholder="Ürün Ara..." 
                            className="w-full bg-stone-900 border border-white/5 rounded-2xl p-3 pl-12 text-stone-200 text-sm outline-none focus:border-amber-500/30 transition-all font-bold"
                            value={priceUpdateSearch}
                            onChange={(e) => setPriceUpdateSearch(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                        {priceUpdateItems
                            .filter(item => item.pesticideName.toLocaleLowerCase('tr-TR').includes(priceUpdateSearch.toLocaleLowerCase('tr-TR')))
                            .map((item) => {
                                const actualIdx = priceUpdateItems.findIndex(i => i.id === item.id);
                                const original = inventory.find(i => i.id === item.id);
                                const isChanged = original && (
                                    original.buyingPrice !== item.buyingPrice || 
                                    original.cashBuyingPrice !== item.cashBuyingPrice ||
                                    original.sellingPrice !== item.sellingPrice ||
                                    original.cashPrice !== item.cashPrice
                                );

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`p-4 rounded-3xl border transition-all ${isChanged ? 'bg-amber-500/5 border-amber-500/30 shadow-lg' : 'bg-stone-950/50 border-white/5'}`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-black text-stone-100 truncate">{item.pesticideName}</h4>
                                                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{item.category}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-stone-600 font-mono bg-stone-900 px-2 py-0.5 rounded-full">
                                                Stok: {item.quantity} {item.unit}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest ml-1">V. Alış</label>
                                                <div className="relative">
                                                    <input 
                                                        type="number" 
                                                        className="w-full bg-stone-900 border border-white/5 rounded-xl p-2 text-xs font-bold text-stone-300 outline-none focus:border-amber-500/50 font-mono h-9"
                                                        value={item.buyingPrice || ''}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            const newList = [...priceUpdateItems];
                                                            newList[actualIdx] = { ...newList[actualIdx], buyingPrice: isNaN(val) ? 0 : val };
                                                            setPriceUpdateItems(newList);
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-stone-600 uppercase tracking-widest ml-1">P. Alış</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-stone-900 border border-white/5 rounded-xl p-2 text-xs font-bold text-stone-300 outline-none focus:border-emerald-500/50 font-mono h-9"
                                                    value={item.cashBuyingPrice || ''}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        const newList = [...priceUpdateItems];
                                                        newList[actualIdx] = { ...newList[actualIdx], cashBuyingPrice: isNaN(val) ? 0 : val };
                                                        setPriceUpdateItems(newList);
                                                    }}
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-amber-500/70 uppercase tracking-widest ml-1">V. Satış</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-stone-900 border border-amber-500/20 rounded-xl p-2 text-xs font-black text-amber-400 outline-none focus:border-amber-500 font-mono h-9 shadow-inner shadow-amber-500/5"
                                                    value={item.sellingPrice || ''}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        const newList = [...priceUpdateItems];
                                                        newList[actualIdx] = { ...newList[actualIdx], sellingPrice: isNaN(val) ? 0 : val };
                                                        setPriceUpdateItems(newList);
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black text-blue-500/70 uppercase tracking-widest ml-1">P. Satış</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-stone-900 border border-blue-500/20 rounded-xl p-2 text-xs font-black text-blue-400 outline-none focus:border-blue-500 font-mono h-9 shadow-inner shadow-blue-500/5"
                                                    value={item.cashPrice || ''}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        const newList = [...priceUpdateItems];
                                                        newList[actualIdx] = { ...newList[actualIdx], cashPrice: isNaN(val) ? 0 : val };
                                                        setPriceUpdateItems(newList);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 bg-stone-950/50 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Düzenlenen Ürün Sayısı</span>
                        <span className="text-xl font-black text-amber-500 font-mono">
                            {priceUpdateItems.filter(item => {
                                const original = inventory.find(i => i.id === item.id);
                                return original && (
                                    original.buyingPrice !== item.buyingPrice || 
                                    original.cashBuyingPrice !== item.cashBuyingPrice ||
                                    original.sellingPrice !== item.sellingPrice ||
                                    original.cashPrice !== item.cashPrice
                                );
                            }).length}
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="px-6 py-3 rounded-2xl text-stone-400 hover:text-stone-200 font-bold text-sm transition-all"
                        >
                            Vazgeç
                        </button>
                        <button 
                            onClick={onSave}
                            disabled={isSaving}
                            className="px-10 py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-2xl font-black text-sm shadow-xl shadow-amber-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    GÜNCELLENİYOR
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    FİYATLARI KAYDET
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
InventoryBatchPriceModal.displayName = 'InventoryBatchPriceModal';

export interface InventoryMismatchItem {
    pesticideId: string;
    pesticideName: string;
    currentQty: number;
    calculatedQty: number;
    purchasedQty: number;
    soldQty: number;
    adjustedQty: number;
}

interface InventoryRebuildModalProps {
    isOpen: boolean;
    rebuildState: 'IDLE' | 'ANALYZING' | 'RESULT' | 'REPAIRING';
    mismatches: InventoryMismatchItem[];
    setMismatches: React.Dispatch<React.SetStateAction<InventoryMismatchItem[]>>;
    selectedMismatches: Set<string>;
    setSelectedMismatches: (val: Set<string>) => void;
    rebuildSearchTerm: string;
    setRebuildSearchTerm: (val: string) => void;
    onClose: () => void;
    onFullRebuild: () => void;
    onRepairSelected: () => void;
}

export const InventoryRebuildModal: React.FC<InventoryRebuildModalProps> = React.memo(({
    isOpen,
    rebuildState,
    mismatches,
    setMismatches,
    selectedMismatches,
    setSelectedMismatches,
    rebuildSearchTerm,
    setRebuildSearchTerm,
    onClose,
    onFullRebuild,
    onRepairSelected,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1c1c1c] border border-stone-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col font-sans">
                <div className="p-6 border-b border-stone-800/50 flex items-center justify-between bg-stone-900/50">
                    <div>
                        <h3 className="text-xl font-bold text-stone-100 mb-1 flex items-center gap-2">
                            <RefreshCw size={20} className="text-orange-500" />
                            Depo Onarım Uzmanı &amp; Düzeltme
                        </h3>
                        <p className="text-xs text-stone-400 font-medium">Stok uyuşmazlıkları tespit edilir, hedeflenen stokları doğrudan düzenleyip onaylayabilirsiniz.</p>
                    </div>
                    {rebuildState !== 'ANALYZING' && rebuildState !== 'REPAIRING' && (
                        <button
                            onClick={onClose}
                            className="p-2 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-xl transition-colors shrink-0"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                <div className="p-6 max-h-[65vh] overflow-y-auto">
                    {rebuildState === 'ANALYZING' && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <RefreshCw size={40} className="text-orange-500 animate-spin" />
                            <div className="text-center">
                                <div className="font-bold text-stone-200">Veritabanı Analiz Ediliyor</div>
                                <div className="text-xs text-stone-500 mt-1">Geçmiş fişler ve faturalar taranıyor...</div>
                            </div>
                        </div>
                    )}

                    {rebuildState === 'RESULT' && (
                        <div className="space-y-4">
                            {mismatches.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-center">
                                        <ClipboardCheck size={32} className="text-emerald-500" />
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-emerald-400 text-lg">Kusursuz!</div>
                                        <div className="text-sm text-stone-400 mt-2 max-w-[320px]">
                                            Deponuzdaki tüm ürünlerin stok miktarları geçmiş alım, satım ve iadelerle birebir eşleşiyor.
                                        </div>
                                    </div>
                                    <button
                                        onClick={onFullRebuild}
                                        className="mt-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 text-orange-400 border border-orange-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                                    >
                                        <RefreshCw size={14} />
                                        Tüm Depoyu Baştan Sıfırla &amp; İşle
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-3 bg-orange-950/30 border border-orange-500/20 rounded-xl flex items-start gap-3">
                                        <AlertCircle size={18} className="text-orange-400 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-orange-400 flex items-center justify-between">
                                                <span>Onarım &amp; Düzeltme Gerekli ({mismatches.length} Ürün)</span>
                                            </div>
                                            <div className="text-xs text-orange-400/80 mt-1">
                                                Hesaplanan miktar otomatik dolmuştur. İsterseniz yeşil kutudan stok hedefini <strong>elle değiştirebilirsiniz</strong>.
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                                            <input 
                                                type="text"
                                                placeholder="Onarım listesinde ara..."
                                                value={rebuildSearchTerm}
                                                onChange={(e) => setRebuildSearchTerm(e.target.value)}
                                                className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 outline-none focus:border-orange-500/50 transition-colors"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (selectedMismatches.size === mismatches.length) {
                                                    setSelectedMismatches(new Set());
                                                } else {
                                                    setSelectedMismatches(new Set(mismatches.map(m => m.pesticideId)));
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-bold transition-colors shrink-0"
                                        >
                                            {selectedMismatches.size === mismatches.length ? 'Seçimi Temizle' : 'Tümünü Seç'}
                                        </button>
                                    </div>

                                    <div className="space-y-2 mt-2">
                                        {mismatches
                                            .filter(item => item.pesticideName.toLocaleLowerCase('tr-TR').includes(rebuildSearchTerm.toLocaleLowerCase('tr-TR')))
                                            .map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                className={`p-3 bg-stone-900 border rounded-xl flex flex-col transition-colors ${selectedMismatches.has(item.pesticideId) ? 'border-orange-500/40 bg-orange-950/10' : 'border-stone-800 opacity-75'}`}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div 
                                                        className="flex items-center gap-3 pr-4 overflow-hidden cursor-pointer flex-1"
                                                        onClick={() => {
                                                            const newSet = new Set(selectedMismatches);
                                                            if (newSet.has(item.pesticideId)) newSet.delete(item.pesticideId);
                                                            else newSet.add(item.pesticideId);
                                                            setSelectedMismatches(newSet);
                                                        }}
                                                    >
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedMismatches.has(item.pesticideId)}
                                                            onChange={() => {}}
                                                            className="shrink-0 w-4 h-4 rounded border-stone-600 bg-stone-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-stone-900 transition-all pointer-events-none"
                                                        />
                                                        <div className="font-semibold text-sm text-stone-200 truncate" title={item.pesticideName}>
                                                            {item.pesticideName}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] text-stone-500 font-bold uppercase">Mevcut</span>
                                                            <span className="text-xs font-bold text-red-400 line-through">{item.currentQty}</span>
                                                        </div>
                                                        <ArrowRight size={14} className="text-stone-600 shrink-0" />
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[9px] text-emerald-500 font-bold uppercase flex items-center gap-1">
                                                                <Edit2 size={10} /> Yeni Stok
                                                            </span>
                                                            <input 
                                                                type="number"
                                                                step="any"
                                                                value={item.calculatedQty}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    const newQty = isNaN(val) ? 0 : val;
                                                                    setMismatches(prev => prev.map(m => m.pesticideId === item.pesticideId ? { ...m, calculatedQty: newQty } : m));
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-20 bg-stone-950 border border-emerald-500/40 focus:border-emerald-400 rounded-lg px-2 py-0.5 text-xs font-black text-emerald-400 text-right outline-none transition-colors"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-2.5 flex items-center gap-4 border-t border-stone-800/80 pt-2">
                                                    <div className="flex items-center gap-1.5 flex-1">
                                                        <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-500/30"></div>
                                                        <div className="flex flex-col shrink-0 min-w-0">
                                                            <span className="text-[9px] text-stone-500 font-bold uppercase leading-tight truncate">Alınan</span>
                                                            <span className="text-xs font-black text-emerald-400">+{item.purchasedQty}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-1">
                                                        <div className="shrink-0 w-2 h-2 rounded-full bg-red-500/30"></div>
                                                        <div className="flex flex-col shrink-0 min-w-0">
                                                            <span className="text-[9px] text-stone-500 font-bold uppercase leading-tight truncate">Satılan / İade</span>
                                                            <span className="text-xs font-black text-red-400">-{item.soldQty}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-1">
                                                        <div className="shrink-0 w-2 h-2 rounded-full bg-blue-500/30"></div>
                                                        <div className="flex flex-col shrink-0 min-w-0">
                                                            <span className="text-[9px] text-stone-500 font-bold uppercase leading-tight truncate">Fark</span>
                                                            <span className="text-xs font-black text-blue-400">
                                                                {(item.calculatedQty - item.currentQty) > 0 ? '+' : ''}{(item.calculatedQty - item.currentQty).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {rebuildState === 'REPAIRING' && (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <RefreshCw size={40} className="text-orange-500 animate-spin" />
                            <div className="text-center">
                                <div className="font-bold text-stone-200">Kusursuz Bir Şekilde Onarılıyor</div>
                                <div className="text-xs text-stone-500 mt-1">Stok bakiyeleri güncelleniyor...</div>
                            </div>
                        </div>
                    )}
                </div>

                {rebuildState === 'RESULT' && (
                    <div className="p-6 bg-stone-900/50 border-t border-stone-800/50 flex flex-wrap items-center justify-between gap-3">
                        <button
                            onClick={onFullRebuild}
                            title="Tüm depoyu geçmiş işlem kayıtlarından baştan sona yeniden hesaplar"
                            className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5"
                        >
                            <RefreshCw size={14} className="text-orange-400" />
                            Tüm Depoyu Yeniden Hesapla
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-bold text-xs transition-colors"
                            >
                                Kapat
                            </button>
                            {mismatches.length > 0 && (
                                <button
                                    onClick={onRepairSelected}
                                    disabled={selectedMismatches.size === 0}
                                    className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 rounded-xl font-black text-xs shadow-xl shadow-orange-600/20 active:scale-95 transition-all flex items-center gap-1.5"
                                >
                                    <RefreshCw size={14} />
                                    {selectedMismatches.size === mismatches.length ? 'Tümünü Onar' : 'Seçilileri Onar'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
InventoryRebuildModal.displayName = 'InventoryRebuildModal';

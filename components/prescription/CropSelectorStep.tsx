import React from 'react';
import { Sprout, User, Check, AlertCircle, Search, X, Plus, Wheat, ArrowLeft, ChevronRight } from 'lucide-react';
import { Farmer, Plant } from '../../types';

interface CropSelectorStepProps {
    selectedFarmer: Farmer | null;
    selectedCrop: string;
    setSelectedCrop: (val: string) => void;
    cropSearchTerm: string;
    setCropSearchTerm: (val: string) => void;
    farmerCrops: string[];
    filteredCropsList: string[];
    contextPlants: Plant[];
    setSelectedPlantId: (id: string) => void;
    hapticFeedback: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
    onChangeStep: (step: number) => void;
}

export const CropSelectorStep: React.FC<CropSelectorStepProps> = React.memo(({
    selectedFarmer,
    selectedCrop,
    setSelectedCrop,
    cropSearchTerm,
    setCropSearchTerm,
    farmerCrops,
    filteredCropsList,
    contextPlants,
    setSelectedPlantId,
    hapticFeedback,
    onChangeStep,
}) => {
    const selectCropValue = (cropVal: string, hapticType: 'light' | 'medium' = 'light') => {
        setSelectedCrop(cropVal);
        const match = contextPlants.find(p => p.name.toLowerCase() === cropVal.toLowerCase());
        if (match) setSelectedPlantId(match.id);
        hapticFeedback(hapticType);
    };

    return (
        <div className="pb-28 sm:pb-24 slide-in-from-right animate-in">
            <div className="flex flex-col items-center justify-center mb-3 sm:mb-6 text-center">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1.5 sm:mb-2 border border-emerald-500/20">
                    <Sprout size={20} className="sm:w-6 sm:h-6" />
                </div>
                <h2 className="text-base sm:text-2xl font-black text-stone-100 tracking-tight">
                    {selectedFarmer?.fullName}
                </h2>
                <div className="flex items-center gap-1 mt-1">
                    <span className="text-[9.5px] sm:text-[11px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 sm:py-1 rounded-full border border-amber-500/20">
                        Zorunlu Alan: Mahsul (Ürün) Seçimi
                    </span>
                </div>
                <p className="text-[11px] sm:text-xs text-stone-400 mt-1 sm:mt-2 max-w-md">
                    Satışı yapılan mahsulü seçiniz (ürün bazlı filtreleme ve ödeme takibi).
                </p>
            </div>

            <div className="space-y-3 sm:space-y-5 max-w-xl mx-auto">
                {!selectedFarmer ? (
                    <div className="p-8 sm:p-12 border-2 border-dashed border-stone-800 rounded-2xl sm:rounded-3xl text-center text-stone-600 flex flex-col items-center gap-2 sm:gap-3">
                        <User size={32} className="opacity-20 sm:w-10 sm:h-10" />
                        <p className="text-xs sm:text-sm font-medium">Lütfen önce çiftçi seçiniz</p>
                        <button onClick={() => onChangeStep(1)} className="text-emerald-500 text-xs font-bold underline">Geri Dön</button>
                    </div>
                ) : (
                    <>
                        {selectedCrop ? (
                            <div className="bg-emerald-950/40 border-2 border-emerald-500 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-md sm:shadow-lg shadow-emerald-950/40 animate-in zoom-in-95">
                                <div className="flex items-center gap-2.5 sm:gap-3">
                                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center font-black shadow-md shrink-0">
                                        <Check size={18} strokeWidth={3} className="sm:w-6 sm:h-6" />
                                    </div>
                                    <div>
                                        <p className="text-[8.5px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-400">Seçilen Satış Mahsulü</p>
                                        <h3 className="text-sm sm:text-xl font-black text-white">{selectedCrop}</h3>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCrop('')}
                                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-900 hover:bg-stone-800 text-rose-400 border border-white/5 rounded-lg sm:rounded-xl text-xs font-bold transition-all active:scale-95"
                                >
                                    Değiştir
                                </button>
                            </div>
                        ) : (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-center gap-2 sm:gap-3">
                                <AlertCircle size={18} className="text-amber-400 shrink-0" />
                                <p className="text-[11px] sm:text-xs font-medium text-amber-300">
                                    Devam etmek için aşağıdaki listeden veya aramadan satışı yapılan mahsulü seçiniz.
                                </p>
                            </div>
                        )}

                        <div className="bg-stone-900 rounded-xl sm:rounded-2xl shadow-sm border border-white/5 flex items-center p-1 sm:p-1.5">
                            <Search className="text-stone-500 ml-2.5 sm:ml-3 shrink-0" size={16} />
                            <input 
                                type="text" 
                                placeholder="Mahsul veya ürün ara (örn: Pamuk, Buğday)..." 
                                className="w-full p-2 sm:p-2.5 bg-transparent outline-none font-medium text-stone-200 placeholder-stone-600 text-xs sm:text-sm"
                                value={cropSearchTerm}
                                onChange={e => setCropSearchTerm(e.target.value)}
                            />
                            {cropSearchTerm && (
                                <button 
                                    onClick={() => setCropSearchTerm('')} 
                                    className="p-1.5 text-stone-500 hover:text-stone-300"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {cropSearchTerm.trim() && (
                            <button
                                type="button"
                                onClick={() => {
                                    selectCropValue(cropSearchTerm.trim(), 'medium');
                                    setCropSearchTerm('');
                                }}
                                className="w-full p-2.5 sm:p-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl sm:rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Plus size={15} />
                                <span>&ldquo;{cropSearchTerm.trim()}&rdquo; olarak seç</span>
                            </button>
                        )}

                        {farmerCrops.length > 0 && !cropSearchTerm && (
                            <div>
                                <label className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1.5 sm:mb-2">
                                    Çiftçinin Mevcut Mahsulleri
                                </label>
                                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                    {farmerCrops.map((crop: string) => (
                                        <button
                                            key={`farmer-crop-${crop}`}
                                            type="button"
                                            onClick={() => selectCropValue(crop, 'light')}
                                            className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border text-left flex items-center justify-between transition-all active:scale-95 ${
                                                selectedCrop === crop
                                                    ? 'bg-emerald-900/30 border-emerald-500 text-white shadow-md'
                                                    : 'bg-stone-900/80 border-white/5 text-stone-300 hover:border-emerald-500/30 hover:bg-stone-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Wheat size={15} className="text-amber-400 shrink-0" />
                                                <span className="font-bold text-xs sm:text-sm truncate">{crop}</span>
                                            </div>
                                            {selectedCrop === crop && <Check size={14} className="text-emerald-400 shrink-0 ml-1" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                                <label className="text-[9px] sm:text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                    Tüm Mahsul & Ürün Listesi
                                </label>
                                <span className="text-[9px] sm:text-[10px] text-stone-500 font-medium">
                                    {filteredCropsList.length} Ürün
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 max-h-[340px] overflow-y-auto pr-1 no-scrollbar">
                                {filteredCropsList.map((crop: string) => {
                                    const isSelected = selectedCrop === crop;
                                    return (
                                        <button
                                            key={crop}
                                            type="button"
                                            onClick={() => selectCropValue(crop, 'light')}
                                            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left flex items-center justify-between transition-all active:scale-95 ${
                                                isSelected
                                                    ? 'bg-emerald-500 text-stone-950 border-emerald-400 shadow-md shadow-emerald-950 font-black'
                                                    : 'bg-stone-900 border-white/5 text-stone-300 hover:border-white/20 hover:bg-stone-800'
                                            }`}
                                        >
                                            <span className="text-xs truncate">{crop}</span>
                                            {isSelected ? (
                                                <Check size={14} strokeWidth={3} className="shrink-0 ml-1 text-stone-950" />
                                            ) : (
                                                <Sprout size={13} className="shrink-0 ml-1 text-stone-600" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
            
            <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 w-full p-2.5 sm:p-4 md:static md:p-0 md:mt-12 z-30 bg-gradient-to-t from-[var(--mks-canvas-bg)] via-[var(--mks-canvas-bg)] to-transparent pb-4 sm:pb-6">
                <div className="max-w-xl mx-auto flex gap-2 sm:gap-3">
                    <button 
                        onClick={() => onChangeStep(1)} 
                        className="flex-1 py-3 sm:py-4 bg-stone-900 text-stone-400 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center transition-all border border-white/5 hover:text-white text-xs sm:text-base"
                    >
                        <ArrowLeft size={16} className="mr-1.5 sm:mr-2"/> Çiftçi Seçimi
                    </button>
                    <button 
                        disabled={!selectedCrop || !selectedCrop.trim()}
                        onClick={() => onChangeStep(3)} 
                        className="flex-[2] py-3 sm:py-4 bg-emerald-600 text-white rounded-xl sm:rounded-2xl font-bold flex items-center justify-center shadow-lg shadow-emerald-500/20 disabled:opacity-30 disabled:grayscale active:scale-95 transition-all border border-emerald-500/20 text-xs sm:text-base"
                    >
                        {selectedCrop ? (
                            <>
                                <span className="truncate">İlaç Seçimine Geç ({selectedCrop})</span>
                                <ChevronRight size={16} className="ml-1.5 sm:ml-2 shrink-0"/>
                            </>
                        ) : (
                            <span>Lütfen Mahsul Seçiniz</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});

CropSelectorStep.displayName = 'CropSelectorStep';

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
        <div className="pb-28 sm:pb-12 slide-in-from-right animate-in space-y-3">
            {/* Kurumsal Adım Başlığı */}
            <div className="v22-bento-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/25 shrink-0">
                        <Sprout size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm sm:text-base font-black text-[color:var(--mks-text)] tracking-tight truncate">
                                {selectedFarmer?.fullName || 'Çiftçi Seçilmedi'}
                            </h2>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                                Zorunlu: Ekili Ürün
                            </span>
                        </div>
                        <p className="text-[11px] text-[color:var(--mks-muted)] font-medium mt-0.5 truncate">
                            Satış veya iade faturasının işleneceği mahsulü seçiniz.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onChangeStep(1)}
                    className="v22-surface-pill px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 hover:opacity-90 shrink-0"
                >
                    <ArrowLeft size={13} /> Çiftçi Değiştir
                </button>
            </div>

            {!selectedFarmer ? (
                <div className="v22-bento-card p-8 text-center text-[color:var(--mks-muted)] flex flex-col items-center gap-2.5">
                    <User size={32} className="opacity-30" />
                    <p className="text-xs sm:text-sm font-semibold">Lütfen önce çiftçi seçiniz</p>
                    <button onClick={() => onChangeStep(1)} className="v22-dark-pill px-4 py-2 rounded-xl text-xs font-bold">
                        1. Adıma Dön
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {selectedCrop ? (
                        <div className="rounded-2xl border-2 border-emerald-500/70 bg-emerald-500/10 p-3 flex items-center justify-between gap-3 shadow-sm animate-in zoom-in-95">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                                    <Check size={18} strokeWidth={3} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Seçili Ekili Ürün</p>
                                    <h3 className="text-sm sm:text-base font-black text-[color:var(--mks-text)] truncate">{selectedCrop}</h3>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedCrop('')}
                                className="v22-surface-pill px-3 py-1.5 rounded-xl text-xs font-bold text-rose-500 shrink-0"
                            >
                                Değiştir
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 flex items-center gap-2">
                            <AlertCircle size={16} className="text-amber-500 shrink-0" />
                            <p className="text-[11px] sm:text-xs font-semibold text-amber-600">
                                Devam etmek için çiftçinin ekili ürünlerinden veya aşağıdan mahsul seçiniz.
                            </p>
                        </div>
                    )}

                    {/* Arama & Özel Mahsul Ekle */}
                    <div className="v22-bento-card p-1.5 flex items-center gap-2">
                        <Search className="text-[color:var(--mks-muted)] ml-2.5 shrink-0" size={16} />
                        <input 
                            type="text" 
                            placeholder="Ekili ürün veya mahsul ara (örn: Pamuk, Buğday)..." 
                            className="w-full py-2 bg-transparent outline-none font-semibold text-[color:var(--mks-text)] placeholder-[color:var(--mks-muted)] text-xs sm:text-sm"
                            value={cropSearchTerm}
                            onChange={e => setCropSearchTerm(e.target.value)}
                        />
                        {cropSearchTerm && (
                            <button 
                                onClick={() => setCropSearchTerm('')} 
                                className="p-1.5 text-[color:var(--mks-muted)] hover:text-[color:var(--mks-text)]"
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
                            className="w-full p-2.5 bg-emerald-500/15 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            <Plus size={15} />
                            <span>&ldquo;{cropSearchTerm.trim()}&rdquo; mahsul olarak seç</span>
                        </button>
                    )}

                    {farmerCrops.length > 0 && !cropSearchTerm && (
                        <div className="v22-bento-card p-3 space-y-2">
                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">
                                Çiftçinin Kayıtlı Mahsulleri
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {farmerCrops.map((crop: string) => {
                                    const active = selectedCrop === crop;
                                    return (
                                        <button
                                            key={`farmer-crop-${crop}`}
                                            type="button"
                                            onClick={() => { selectCropValue(crop, 'light'); onChangeStep(3); }}
                                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all active:scale-95 ${
                                                active
                                                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm font-black'
                                                    : 'bg-[color:var(--mks-subcard)] border-[color:var(--mks-card-border)] text-[color:var(--mks-text)] hover:border-emerald-500/40'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Wheat size={14} className={active ? 'text-white shrink-0' : 'text-amber-500 shrink-0'} />
                                                <span className="font-bold text-xs truncate">{crop}</span>
                                            </div>
                                            {active && <Check size={14} className="shrink-0 ml-1" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="v22-bento-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-[color:var(--mks-muted)] uppercase tracking-wider">
                                Tüm Mahsul & Ürün Kataloğu
                            </label>
                            <span className="text-[10px] text-[color:var(--mks-muted)] font-semibold">
                                {filteredCropsList.length} Ürün
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                            {filteredCropsList.map((crop: string) => {
                                const isSelected = selectedCrop === crop;
                                return (
                                    <button
                                        key={crop}
                                        type="button"
                                        onClick={() => { selectCropValue(crop, 'light'); }}
                                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all active:scale-95 ${
                                            isSelected
                                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm font-black'
                                                : 'bg-[color:var(--mks-subcard)] border-[color:var(--mks-card-border)] text-[color:var(--mks-text)] hover:border-emerald-500/40 font-semibold'
                                        }`}
                                    >
                                        <span className="text-xs truncate">{crop}</span>
                                        {isSelected ? (
                                            <Check size={13} strokeWidth={3} className="shrink-0 ml-1" />
                                        ) : (
                                            <Sprout size={12} className="shrink-0 ml-1 opacity-40" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            
            <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 w-full p-2.5 sm:p-4 md:static md:p-0 md:mt-4 z-30 bg-gradient-to-t from-[var(--mks-canvas-bg)] via-[var(--mks-canvas-bg)] to-transparent pb-4 sm:pb-0">
                <div className="max-w-3xl mx-auto flex gap-2">
                    <button 
                        type="button"
                        onClick={() => onChangeStep(1)} 
                        className="v22-surface-pill px-4 py-3 rounded-xl font-bold flex items-center justify-center text-xs sm:text-sm shrink-0"
                    >
                        <ArrowLeft size={15} className="mr-1.5"/> Geri
                    </button>
                    <button 
                        type="button"
                        disabled={!selectedCrop || !selectedCrop.trim()}
                        onClick={() => onChangeStep(3)} 
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center shadow-md disabled:opacity-40 active:scale-95 transition-all text-xs sm:text-sm"
                    >
                        {selectedCrop ? (
                            <>
                                <span className="truncate">3. Adım: İlaç Seçimine Geç ({selectedCrop})</span>
                                <ChevronRight size={16} className="ml-1.5 shrink-0"/>
                            </>
                        ) : (
                            <span>Devam Etmek İçin Ekili Ürün Seçiniz</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
});

CropSelectorStep.displayName = 'CropSelectorStep';

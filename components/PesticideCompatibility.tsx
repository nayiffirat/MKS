
import React, { useState, useEffect, useRef } from 'react';
import { Pesticide, PesticideCategory } from '../types';
import { dbService } from '../services/db';
import { GeminiService } from '../services/gemini';
import { useAppViewModel } from '../context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, XCircle, Info, ArrowLeft, FlaskConical, Search, ChevronRight, Plus, Trash2, Loader2, Sparkles, Beaker, X, Wand2, Zap } from 'lucide-react';

interface CompatibilityResult {
    status: 'SAFE' | 'WARNING' | 'DANGER';
    message: string;
    details: string;
    precautions?: string[];
}

const COMPATIBILITY_DATA: Record<string, Record<string, CompatibilityResult>> = {
    [PesticideCategory.INSECTICIDE]: {
        [PesticideCategory.FUNGICIDE]: { status: 'SAFE', message: 'Genellikle Güvenli', details: 'Çoğu insektisit ve fungisit karıştırılabilir. Ancak bakırlı fungisitlerle bazı organofosfatlı insektisitlere dikkat edilmelidir.' },
        [PesticideCategory.HERBICIDE]: { status: 'WARNING', message: 'Dikkatli Olunmalı', details: 'Herbisitlerle karıştırmak fitotoksite (bitki yanıklığı) riskini artırabilir. Ayrı uygulama önerilir.' },
        [PesticideCategory.FERTILIZER]: { status: 'SAFE', message: 'Güvenli', details: 'Yaprak gübreleri ile çoğu insektisit uyumludur.' },
    },
    [PesticideCategory.FUNGICIDE]: {
        [PesticideCategory.FERTILIZER]: { status: 'SAFE', message: 'Güvenli', details: 'Besleme ürünleri fungisit etkisini genellikle bozmaz.' },
        [PesticideCategory.GROWTH_REGULATOR]: { status: 'WARNING', message: 'Test Edilmeli', details: 'BGD ürünleri pH hassasiyeti nedeniyle fungisitlerle reaksiyona girebilir.' },
    },
    [PesticideCategory.HERBICIDE]: {
        [PesticideCategory.FERTILIZER]: { status: 'DANGER', message: 'Önerilmez', details: 'Herbisitlerin yabancı ot öldürme mekanizması gübre ile çakışabilir veya bitkide ağır strese yol açabilir.' },
    }
};

export const PesticideCompatibility: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { showToast, hapticFeedback } = useAppViewModel();
    const [activeTab, setActiveTab] = useState<'CATEGORY' | 'LIBRARY'>('CATEGORY');
    
    // Category Tab State
    const [cat1, setCat1] = useState<PesticideCategory | ''>('');
    const [cat2, setCat2] = useState<PesticideCategory | ''>('');

    // Library Tab State
    const [allPesticides, setAllPesticides] = useState<Pesticide[]>([]);
    const [selectedPesticides, setSelectedPesticides] = useState<Pesticide[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [aiResult, setAiResult] = useState<CompatibilityResult | null>(null);

    useEffect(() => {
        const loadPesticides = async () => {
            const list = await dbService.getPesticides();
            setAllPesticides(list);
        };
        loadPesticides();
    }, []);

    const getCategoryResult = (): CompatibilityResult | null => {
        if (!cat1 || !cat2) return null;
        if (cat1 === cat2) return { status: 'SAFE', message: 'Aynı Grup', details: 'Aynı kategorideki ürünler genellikle fiziksel olarak karışabilir ancak doz aşımına dikkat edilmelidir.' };
        
        const res = COMPATIBILITY_DATA[cat1]?.[cat2] || COMPATIBILITY_DATA[cat2]?.[cat1];
        return res || { status: 'WARNING', message: 'Bilinmiyor / Test Gerekli', details: 'Bu kombinasyon için kesin veri yok. Kavanoz testi yapılması önerilir.' };
    };

    const handleCheckAiCompatibility = async () => {
        if (selectedPesticides.length < 2) {
            showToast('Analiz için en az 2 ilaç seçmelisiniz.', 'info');
            return;
        }
        
        setIsChecking(true);
        setAiResult(null);
        hapticFeedback('medium');
        
        try {
            const result = await GeminiService.checkMixtureCompatibility(selectedPesticides);
            console.log("AI Compatibility Result:", result);
            if (result && result.status) {
                setAiResult(result);
                hapticFeedback('success');
                showToast('Analiz tamamlandı.', 'success');
            } else {
                throw new Error("Analiz sonucu anlaşılamadı. Lütfen tekrar deneyin.");
            }
        } catch (error: any) {
            console.error("AI Compatibility Check Error:", error);
            const errorMsg = error.message || 'Analiz sırasında bir hata oluştu.';
            showToast(errorMsg, 'error');
            hapticFeedback('error');
        } finally {
            setIsChecking(false);
        }
    };

    const categoryResult = getCategoryResult();

    const filteredPesticides = allPesticides.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(p => !selectedPesticides.find(s => s.id === p.id));

    const CelebrationEffect = () => (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden"
        >
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                    opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-emerald-500/10 blur-[100px]"
            />
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ 
                        x: 0, 
                        y: 0, 
                        scale: 0,
                        rotate: 0 
                    }}
                    animate={{ 
                        x: (Math.random() - 0.5) * 1000, 
                        y: (Math.random() - 0.5) * 1000,
                        scale: [0, 1, 0],
                        rotate: Math.random() * 360
                    }}
                    transition={{ 
                        duration: 2 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2
                    }}
                    className="absolute"
                >
                    <Sparkles className="text-emerald-400" size={12 + Math.random() * 20} />
                </motion.div>
            ))}
        </motion.div>
    );

    const DangerEffect = () => (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none"
        >
            <motion.div 
                animate={{ 
                    opacity: [0.2, 0.5, 0.2],
                }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 bg-rose-600/20"
            />
            <div className="absolute inset-0 border-[20px] border-rose-600/10 blur-xl" />
        </motion.div>
    );

    return (
        <div className="min-h-screen bg-stone-950 text-stone-200 pb-40">
            <AnimatePresence>
                {aiResult?.status === 'SAFE' && <CelebrationEffect />}
                {aiResult?.status === 'DANGER' && <DangerEffect />}
            </AnimatePresence>

            <div className="bg-stone-900/50 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-30 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 bg-stone-800 rounded-xl text-stone-400"><ArrowLeft size={20}/></button>
                    <h1 className="text-lg font-bold">Karışım Uyumluluğu</h1>
                </div>
                
                <div className="flex bg-stone-950 p-1 rounded-xl border border-white/5">
                    <button 
                        onClick={() => setActiveTab('CATEGORY')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'CATEGORY' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                        Grup Bazlı
                    </button>
                    <button 
                        onClick={() => setActiveTab('LIBRARY')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'LIBRARY' ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300'}`}
                    >
                        Kütüphane Bazlı
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-8 max-w-2xl mx-auto">
                <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-2xl flex gap-3">
                    <Info className="text-emerald-500 shrink-0" size={20} />
                    <p className="text-[11px] text-emerald-200/70 leading-relaxed">
                        Bu tablo genel bilgilendirme amaçlıdır. İlaç etiketindeki uyarılar her zaman önceliklidir. 
                        Büyük tank karışımlarından önce mutlaka küçük bir kapta <b>Kavanoz Testi</b> yapınız.
                    </p>
                </div>

                {activeTab === 'CATEGORY' ? (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">1. Ürün Grubu</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(PesticideCategory).map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => setCat1(cat)}
                                        className={`p-3 rounded-xl text-[10px] font-bold border transition-all ${cat1 === cat ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/20' : 'bg-stone-900 border-white/5 text-stone-400'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center border border-white/10">
                                <Plus size={20} className="text-stone-500" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">2. Ürün Grubu</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(PesticideCategory).map(cat => (
                                    <button 
                                        key={cat} 
                                        onClick={() => setCat2(cat)}
                                        className={`p-3 rounded-xl text-[10px] font-bold border transition-all ${cat2 === cat ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/20' : 'bg-stone-900 border-white/5 text-stone-400'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {categoryResult && (
                            <div className={`mt-8 p-6 rounded-[2rem] border animate-in zoom-in duration-300 ${
                                categoryResult.status === 'SAFE' ? 'bg-emerald-900/20 border-emerald-500/30' : 
                                categoryResult.status === 'WARNING' ? 'bg-amber-900/20 border-amber-500/30' : 
                                'bg-rose-900/20 border-rose-500/30'
                            }`}>
                                <div className="flex items-center gap-3 mb-4">
                                    {categoryResult.status === 'SAFE' && <CheckCircle2 className="text-emerald-500" size={24} />}
                                    {categoryResult.status === 'WARNING' && <AlertTriangle className="text-amber-500" size={24} />}
                                    {categoryResult.status === 'DANGER' && <XCircle className="text-rose-500" size={24} />}
                                    <h3 className={`text-lg font-black ${
                                        categoryResult.status === 'SAFE' ? 'text-emerald-400' : 
                                        categoryResult.status === 'WARNING' ? 'text-amber-400' : 
                                        'text-rose-400'
                                    }`}>{categoryResult.message}</h3>
                                </div>
                                <p className="text-stone-300 text-sm leading-relaxed">{categoryResult.details}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <div className="bg-stone-900 rounded-2xl border border-white/5 flex items-center p-1 px-4 shadow-inner focus-within:border-emerald-500/50 transition-all">
                                <Search size={18} className="text-stone-500" />
                                <input 
                                    type="text"
                                    placeholder="Karışıma ilaç eklemek için ara..."
                                    className="w-full p-3 bg-transparent outline-none text-sm placeholder:text-stone-600"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="p-1 text-stone-600 hover:text-stone-400">
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2">
                                <AnimatePresence mode="popLayout">
                                    {filteredPesticides.length > 0 ? (
                                        filteredPesticides.map(p => (
                                            <motion.button 
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedPesticides(prev => [...prev, p]);
                                                    setSearchTerm('');
                                                    hapticFeedback('light');
                                                }}
                                                className="w-full p-4 bg-stone-900/40 border border-white/5 rounded-2xl flex items-center justify-between hover:bg-stone-800/60 transition-all group active:scale-[0.98]"
                                            >
                                                <div className="text-left">
                                                    <p className="text-sm font-bold text-stone-200 group-hover:text-emerald-400 transition-colors">{p.name}</p>
                                                    <p className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">{p.activeIngredient}</p>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:text-emerald-500 transition-all">
                                                    <Plus size={16} />
                                                </div>
                                            </motion.button>
                                        ))
                                    ) : searchTerm ? (
                                        <div className="py-12 text-center text-stone-600">
                                            <Search size={32} className="mx-auto mb-2 opacity-20" />
                                            <p className="text-xs">Aradığınız ilaç bulunamadı</p>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-stone-600">
                                            <Beaker size={32} className="mx-auto mb-2 opacity-20" />
                                            <p className="text-xs">Kütüphaneden ilaç seçerek başlayın</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {aiResult && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-6 rounded-[2.5rem] border shadow-2xl relative overflow-hidden ${
                                    aiResult.status === 'SAFE' ? 'bg-emerald-950/40 border-emerald-500/30' : 
                                    aiResult.status === 'WARNING' ? 'bg-amber-950/40 border-amber-500/30' : 
                                    'bg-rose-950/40 border-rose-500/30'
                                }`}
                            >
                                {aiResult.status === 'SAFE' && (
                                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 blur-[50px] rounded-full" />
                                )}
                                
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`p-3 rounded-2xl ${
                                        aiResult.status === 'SAFE' ? 'bg-emerald-500/20 text-emerald-400' : 
                                        aiResult.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' : 
                                        'bg-rose-500/20 text-rose-400'
                                    }`}>
                                        {aiResult.status === 'SAFE' && <CheckCircle2 size={24} />}
                                        {aiResult.status === 'WARNING' && <AlertTriangle size={24} />}
                                        {aiResult.status === 'DANGER' && <XCircle size={24} />}
                                    </div>
                                    <div>
                                        <h3 className={`text-xl font-black tracking-tight ${
                                            aiResult.status === 'SAFE' ? 'text-emerald-400' : 
                                            aiResult.status === 'WARNING' ? 'text-amber-400' : 
                                            'text-rose-400'
                                        }`}>{aiResult.message}</h3>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Yapay Zeka Analizi</p>
                                    </div>
                                </div>
                                <p className="text-stone-200 text-sm leading-relaxed mb-6 font-medium">{aiResult.details}</p>
                                
                                {aiResult.precautions && aiResult.precautions.length > 0 && (
                                    <div className="space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                            <Zap size={12} className="text-amber-500" /> Önemli Önlemler
                                        </p>
                                        {aiResult.precautions.map((p, i) => (
                                            <div key={i} className="flex gap-3 items-start text-xs text-stone-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                <p className="leading-relaxed">{p}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button 
                                    onClick={() => setAiResult(null)}
                                    className="mt-6 w-full py-3 bg-stone-800/50 hover:bg-stone-800 text-stone-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Sonucu Kapat
                                </button>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>

            {/* Selected Items Holder - Fixed Bottom */}
            {activeTab === 'LIBRARY' && (
                <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-8 pointer-events-none">
                    <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: selectedPesticides.length > 0 ? 0 : 100 }}
                        className="max-w-2xl mx-auto pointer-events-auto"
                    >
                        <div className="bg-stone-900/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-4 shadow-2xl shadow-black/50">
                            <div className="flex items-center justify-between mb-4 px-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                                        <FlaskConical size={16} />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-stone-100">Karışım Haznesi</span>
                                    <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{selectedPesticides.length}</span>
                                </div>
                                {selectedPesticides.length > 0 && (
                                    <button 
                                        onClick={() => {
                                            setSelectedPesticides([]);
                                            setAiResult(null);
                                            hapticFeedback('medium');
                                        }}
                                        className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500/10 px-3 py-1 rounded-full transition-all"
                                    >
                                        Temizle
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-4 px-2 no-scrollbar">
                                <AnimatePresence mode="popLayout">
                                    {selectedPesticides.map(p => (
                                        <motion.div 
                                            layout
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            key={p.id}
                                            className="shrink-0 bg-stone-800 border border-white/5 p-3 rounded-2xl flex items-center gap-3 group relative"
                                        >
                                            <div className="min-w-[80px]">
                                                <p className="text-[11px] font-bold text-stone-100 truncate max-w-[120px]">{p.name}</p>
                                                <p className="text-[9px] text-stone-500 font-medium truncate max-w-[120px]">{p.activeIngredient}</p>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setSelectedPesticides(prev => prev.filter(s => s.id !== p.id));
                                                    hapticFeedback('light');
                                                }}
                                                className="p-1.5 bg-stone-700 rounded-lg text-stone-400 hover:bg-rose-500 hover:text-white transition-all"
                                            >
                                                <X size={12} />
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            <button 
                                onClick={handleCheckAiCompatibility}
                                disabled={isChecking || selectedPesticides.length < 2}
                                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all relative overflow-hidden group ${
                                    selectedPesticides.length < 2 
                                    ? 'bg-stone-800 text-stone-600 cursor-not-allowed' 
                                    : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 active:scale-[0.98]'
                                }`}
                            >
                                {isChecking ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <Wand2 size={18} className="group-hover:rotate-12 transition-transform" />
                                        Karışımı Analiz Et
                                    </>
                                )}
                                {selectedPesticides.length >= 2 && !isChecking && (
                                    <motion.div 
                                        animate={{ x: ['-100%', '200%'] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                                    />
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

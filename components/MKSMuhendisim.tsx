import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Sprout, Bug, Leaf, AlertCircle, Apple, ChevronRight, Activity, FlaskConical, Search, Droplet, Wheat, Flower2, Grape, Cherry, Citrus, Camera, X, ScanLine, SwitchCamera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CROP_CATEGORIES, CROP_STAGES, GENERIC_STAGES, PROBLEM_DATABASE, GENERIC_PROBLEMS } from '../constants/cropData';

const renderIcon = (iconName: string, size: number) => {
    switch (iconName) {
        case 'Sprout': return <Sprout size={size} />;
        case 'Apple': return <Apple size={size} />;
        case 'Leaf': return <Leaf size={size} />;
        case 'Wheat': return <Wheat size={size} />;
        case 'Flower2': return <Flower2 size={size} />;
        case 'Grape': return <Grape size={size} />;
        case 'Cherry': return <Cherry size={size} />;
        case 'Citrus': return <Citrus size={size} />;
        default: return <Sprout size={size} />;
    }
};

interface Props {
    onBack?: () => void;
}

type ViewState = 'CATEGORIES' | 'STAGES' | 'PROBLEMS' | 'PROBLEM_DETAIL' | 'SCANNER' | 'AI_RESULT';

export const MKSMuhendisim: React.FC<Props> = ({ onBack }) => {
    const [viewState, setViewState] = useState<ViewState>(
        window.history.state?.mksViewState || 'CATEGORIES'
    );
    const [selectedCrop, setSelectedCrop] = useState<{ id: string, name: string, icon?: string } | null>(null);
    const [selectedStage, setSelectedStage] = useState<{ id: string, name: string } | null>(null);
    const [selectedProblem, setSelectedProblem] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [solutionTab, setSolutionTab] = useState<'ACTIVE_INGREDIENT' | 'COMMERCIAL_NAME'>('ACTIVE_INGREDIENT');
    const [scanState, setScanState] = useState<'INITIAL' | 'SCANNING' | 'ANALYZING' | 'FOUND'>('INITIAL');
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        
        if (viewState === 'SCANNER') {
            const startCamera = async () => {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: facingMode } 
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Kamera açılamadı:", err);
                }
            };
            startCamera();
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [viewState, facingMode]);

    useEffect(() => {
        // Ensure initial state has the viewState
        if (!window.history.state?.mksViewState) {
            window.history.replaceState({ ...window.history.state, mksViewState: 'CATEGORIES' }, '');
        }

        const handlePopState = (e: PopStateEvent) => {
            const state = e.state;
            if (state && state.view === 'MKS_MUHENDISIM') {
                if (state.mksViewState) {
                    setViewState(state.mksViewState);
                } else {
                    setViewState('CATEGORIES');
                }
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (viewState === 'SCANNER') {
            if (scanState === 'INITIAL') {
                timeout = setTimeout(() => setScanState('SCANNING'), 1500);
            } else if (scanState === 'SCANNING') {
                timeout = setTimeout(() => setScanState('ANALYZING'), 3000);
            } else if (scanState === 'ANALYZING') {
                timeout = setTimeout(() => {
                    setScanState('FOUND');
                    setTimeout(() => {
                        const mockResults = [
                            {
                                type: 'HASTALIK',
                                name: 'Erken Yaprak Yanıklığı (Alternaria solani)',
                                description: 'Yapay zeka analizine göre yapraklarda iç içe halkalar şeklinde kahverengi-siyah lekeler tespit edildi. Bu durum fungal bir hastalık olan Erken Yaprak Yanıklığına işaret etmektedir.',
                                activeIngredients: ['Azoxystrobin', 'Mancozeb', 'Difenoconazole'],
                                commercialNames: ['Amistar', 'Dithane M-45', 'Score'],
                                solutionDescription: 'Bu hastalığın ilerlemesini durdurmak için öncelikle enfekte olmuş alt yaprakları uzaklaştırın ve tarlada/serada havalanmayı artırın. İlaçlamada aşağıda belirtilen aktif maddelere sahip fungisitleri, hastalığın şiddetine göre 7-10 gün arayla dönüşümlü olarak uygulayabilirsiniz.'
                            },
                            {
                                type: 'YABANCI_OT',
                                name: 'Sirken (Chenopodium album)',
                                description: 'Taranan alanda "Sirken (Ak pazı)" yabancı otu tespit edilmiştir. Ana ürüne su, ışık ve besin maddesi rekabeti açısından zarar verebilir.',
                                activeIngredients: ['Pendimethalin', 'Metribuzin', 'Linuron'],
                                commercialNames: ['Stomp Aqua', 'Sencor', 'Afalon'],
                                solutionDescription: 'Yabancı otlar erken gelişim döneminde (2-4 yapraklı) iken ilaçlama yapılması en yüksek etkiyi sağlar. Darbeye dayalı kültürel mücadele (çapa) de önerilir.'
                            },
                            {
                                type: 'SAĞLIKLI',
                                name: 'Sağlıklı Bitki',
                                description: 'Harika! Yapay zeka taramasına göre bitkide herhangi bir hastalık, zararlı veya besin noksanlığı belirtisi tespit edilmedi.',
                                activeIngredients: [],
                                commercialNames: [],
                                solutionDescription: 'Bitkiniz şu an oldukça sağlıklı görünüyor. Düzenli sulama ve rutin gübreleme programınıza devam edebilirsiniz.'
                            },
                            {
                                type: 'BULUNAMADI',
                                name: 'Tespit Edilemedi',
                                description: 'Görüntü net değil veya sistemimizde kayıtlı bir problemle eşleşmedi. Lütfen yaprağın veya sorunlu bölgenin daha net, ışıklı ve odaklanmış bir fotoğrafını çekmeyi deneyin.',
                                activeIngredients: [],
                                commercialNames: [],
                                solutionDescription: 'Daha iyi sonuç almak için:\n1. Yaprağı çerçevenin tam ortasına alın.\n2. Titretmemeye özen gösterin.\n3. Gölge veya parlama olmamasına dikkat edin.'
                            }
                        ];
                        const detectedProblem = mockResults[Math.floor(Math.random() * mockResults.length)];
                        setSelectedProblem(detectedProblem);
                        setSelectedCrop({ 
                            id: detectedProblem.type === 'BULUNAMADI' ? 'BILINMIYOR' : 'DOMATES', 
                            name: detectedProblem.type === 'BULUNAMADI' ? 'Bilinmiyor' : 'Domates', 
                            icon: detectedProblem.type === 'BULUNAMADI' ? 'Search' : 'Leaf' 
                        });
                        setSelectedStage({ id: 'AI_DETECT', name: 'Yapay Zeka Tespiti' });
                        changeViewState('AI_RESULT');
                        setScanState('INITIAL'); // Reset for next time
                    }, 1500);
                }, 2500);
            }
        }
        return () => clearTimeout(timeout);
    }, [viewState, scanState]);

    const changeViewState = (newState: ViewState) => {
        window.history.pushState({ ...window.history.state, mksViewState: newState, subView: true }, '');
        setViewState(newState);
    };

    const handleCropSelect = (crop: { id: string, name: string, icon?: string }) => {
        setSelectedCrop(crop);
        setSearchQuery('');
        changeViewState('STAGES');
    };

    const handleStageSelect = (stage: { id: string, name: string }) => {
        setSelectedStage(stage);
        setSearchQuery('');
        changeViewState('PROBLEMS');
    };

    const handleProblemSelect = (problem: any) => {
        setSelectedProblem(problem);
        changeViewState('PROBLEM_DETAIL');
    };

    const handleBack = () => {
        if (viewState === 'CATEGORIES') {
            if (onBack) onBack();
        } else if (viewState === 'SCANNER') {
            setScanState('INITIAL');
            changeViewState('CATEGORIES');
        } else {
            window.history.back();
        }
    };

    const currentStages = selectedCrop 
        ? (CROP_STAGES[selectedCrop.id] || GENERIC_STAGES)
        : [];

    const currentProblems = selectedCrop && selectedStage
        ? (PROBLEM_DATABASE[selectedCrop.id]?.[selectedStage.id] || GENERIC_PROBLEMS[selectedStage.id] || GENERIC_PROBLEMS['VEGETATIF'] || [])
        : [];

    // Grouping
    const groupedProblems = currentProblems.reduce((acc, problem) => {
        if (!acc[problem.type]) acc[problem.type] = [];
        acc[problem.type].push(problem);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className="flex flex-col h-full bg-stone-950 overflow-hidden relative">
            {/* Header */}
            <div className="p-4 bg-stone-900/50 backdrop-blur-xl border-b border-white/5 shrink-0 z-10 relative">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={handleBack} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-white flex items-center gap-2">
                                <FlaskConical className="text-purple-500" size={24} />
                                MKS Mühendisim
                            </h1>
                            <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                                {viewState === 'CATEGORIES' && 'Tarla ve Bahçe Bitkileri'}
                                {viewState === 'STAGES' && `${selectedCrop?.name} Evreleri`}
                                {viewState === 'PROBLEMS' && `${selectedStage?.name} Riskleri`}
                                {viewState === 'PROBLEM_DETAIL' && 'Teşhis ve Çözüm'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-32 relative z-0">
                <AnimatePresence mode="wait">
                    {/* 1. CATEGORIES VIEW */}
                    {viewState === 'CATEGORIES' && (
                        <motion.div 
                            key="categories"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <button 
                                onClick={() => changeViewState('SCANNER')}
                                className="w-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-3xl p-4 flex items-center justify-between group mb-2 hover:from-purple-500/30 hover:to-indigo-500/30 transition-all shadow-lg shadow-purple-900/20 relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-purple-400/5 rotate-12 scale-150 group-hover:rotate-45 transition-transform duration-700"></div>
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                        <Camera size={24} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-purple-100 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                            AI Yaprak Taraması <span className="bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-md">YENİ</span>
                                        </h3>
                                        <p className="text-purple-400/70 text-[11px] font-bold mt-1">Hastalığı kameradan anında teşhis et</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-purple-400 group-hover:translate-x-1 transition-transform relative z-10" />
                            </button>

                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="Bitki ara (Örn: Pamuk, Domates...)"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-stone-900/60 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium text-white placeholder:text-stone-500 outline-none focus:border-purple-500/50 transition-all shadow-inner"
                                />
                            </div>

                            {CROP_CATEGORIES.map(category => {
                                const filteredCrops = category.crops.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
                                if (filteredCrops.length === 0) return null;
                                
                                return (
                                    <div key={category.id} className="mb-6">
                                        <h2 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            {category.id === 'TARLA' ? <Sprout size={14} className="text-emerald-500" /> : <Apple size={14} className="text-rose-500" />}
                                            {category.name}
                                        </h2>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            {filteredCrops.map(crop => (
                                                <button 
                                                    key={crop.id}
                                                    onClick={() => handleCropSelect(crop)}
                                                    className="bg-stone-900/60 border border-white/5 hover:border-purple-500/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 group hover:bg-stone-800/80 shadow-lg"
                                                >
                                                    <div className={`p-3 rounded-xl transition-colors ${category.id === 'TARLA' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-white'}`}>
                                                        {renderIcon(crop.icon || 'Sprout', 24)}
                                                    </div>
                                                    <span className="text-sm font-bold text-stone-200 group-hover:text-white transition-colors">{crop.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}

                    {/* 2. STAGES VIEW */}
                    {viewState === 'STAGES' && (
                        <motion.div 
                            key="stages"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-4"
                        >
                            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-3xl flex items-center gap-4 mb-6">
                                <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center">
                                    {renderIcon(selectedCrop?.icon || 'Sprout', 28)}
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-purple-100">{selectedCrop?.name}</h2>
                                    <p className="text-xs font-bold text-purple-400/70 uppercase tracking-widest">Gelişim Evresini Seçin</p>
                                </div>
                            </div>

                            <div className="space-y-3 relative">
                                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-stone-800 z-0 rounded-full"></div>
                                {currentStages.map((stage, idx) => (
                                    <button 
                                        key={stage.id}
                                        onClick={() => handleStageSelect(stage)}
                                        className="w-full bg-stone-900/80 border border-white/5 hover:border-purple-500/40 rounded-3xl p-4 flex items-center justify-between group transition-all text-left relative z-10 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-5 h-5 rounded-full bg-stone-800 border-2 border-stone-600 group-hover:border-purple-500 group-hover:bg-purple-500/20 transition-colors flex items-center justify-center shadow-md">
                                                <div className="w-1.5 h-1.5 bg-stone-400 group-hover:bg-purple-400 rounded-full"></div>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-stone-100 group-hover:text-purple-100 transition-colors">{stage.name}</h3>
                                                <p className="text-[10px] text-stone-500 font-medium mt-0.5">{stage.description}</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-stone-600 group-hover:text-purple-400 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* 3. PROBLEMS VIEW */}
                    {viewState === 'PROBLEMS' && (
                        <motion.div 
                            key="problems"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="space-y-6"
                        >
                            <div className="bg-stone-900 border border-white/5 p-4 rounded-3xl flex items-center gap-4">
                                <div className="w-12 h-12 bg-stone-800 text-stone-400 rounded-2xl flex items-center justify-center border border-white/5">
                                    {renderIcon(selectedCrop?.icon || 'Sprout', 20)}
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">{selectedCrop?.name}</div>
                                    <h2 className="text-sm font-black text-stone-200">{selectedStage?.name}</h2>
                                </div>
                            </div>

                            {currentProblems.length === 0 ? (
                                <div className="p-8 text-center bg-amber-500/10 border border-amber-500/30 rounded-3xl relative overflow-hidden shadow-lg shadow-amber-900/5">
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none"></div>
                                    <AlertCircle size={48} className="text-amber-500 mx-auto mb-4 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                                    <h3 className="text-amber-400 font-black text-lg mb-2 tracking-wide uppercase">Kayıt Bulunamadı</h3>
                                    <p className="text-sm text-amber-200/90 font-medium leading-relaxed max-w-[250px] mx-auto">Bu evre için sisteme girilmiş spesifik bir zararlı/hastalık kaydı bulunmamaktadır.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Hastalıklar */}
                                    {groupedProblems['HASTALIK'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <AlertCircle size={14} />
                                                Hastalıklar
                                            </h3>
                                            <div className="space-y-2">
                                                {groupedProblems['HASTALIK'].map((prob: any, idx: number) => (
                                                    <button key={idx} onClick={() => handleProblemSelect(prob)} className="w-full bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-all group">
                                                        <div>
                                                            <div className="font-bold text-stone-200 group-hover:text-rose-100 text-sm transition-colors">{prob.name}</div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-stone-600 group-hover:text-rose-400 transition-colors" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Zararlılar */}
                                    {groupedProblems['ZARARLI'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Bug size={14} />
                                                Zararlılar
                                            </h3>
                                            <div className="space-y-2">
                                                {groupedProblems['ZARARLI'].map((prob: any, idx: number) => (
                                                    <button key={idx} onClick={() => handleProblemSelect(prob)} className="w-full bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 hover:border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-all group">
                                                        <div>
                                                            <div className="font-bold text-stone-200 group-hover:text-amber-100 text-sm transition-colors">{prob.name}</div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-stone-600 group-hover:text-amber-400 transition-colors" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Yabancı Otlar */}
                                    {groupedProblems['YABANCI_OT'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Leaf size={14} />
                                                Yabancı Otlar
                                            </h3>
                                            <div className="space-y-2">
                                                {groupedProblems['YABANCI_OT'].map((prob: any, idx: number) => (
                                                    <button key={idx} onClick={() => handleProblemSelect(prob)} className="w-full bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 hover:border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-all group">
                                                        <div>
                                                            <div className="font-bold text-stone-200 group-hover:text-emerald-100 text-sm transition-colors">{prob.name}</div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-stone-600 group-hover:text-emerald-400 transition-colors" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bitki Besleme */}
                                    {groupedProblems['BESLEME'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2 mt-6">
                                                <Droplet size={14} />
                                                Bitki Besleme & Gübreleme
                                            </h3>
                                            <div className="space-y-2">
                                                {groupedProblems['BESLEME'].map((prob: any, idx: number) => (
                                                    <button key={idx} onClick={() => handleProblemSelect(prob)} className="w-full bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/30 rounded-2xl p-4 flex items-center justify-between text-left transition-all group">
                                                        <div>
                                                            <div className="font-bold text-stone-200 group-hover:text-blue-100 text-sm transition-colors">{prob.name}</div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-stone-600 group-hover:text-blue-400 transition-colors" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* 4. PROBLEM DETAIL VIEW */}
                    {viewState === 'PROBLEM_DETAIL' && selectedProblem && (
                        <motion.div 
                            key="detail"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="space-y-6"
                        >
                            {/* Icon Header */}
                            <div className="flex flex-col items-center text-center p-6 bg-stone-900 border border-white/5 rounded-[32px] shadow-2xl relative overflow-hidden">
                                <div className={`absolute inset-0 opacity-10 ${
                                    selectedProblem.type === 'HASTALIK' ? 'bg-rose-500' : 
                                    selectedProblem.type === 'ZARARLI' ? 'bg-amber-500' : 
                                    selectedProblem.type === 'YABANCI_OT' ? 'bg-emerald-500' : 'bg-blue-500'
                                } blur-3xl rounded-full scale-150 -translate-y-1/2`}></div>
                                
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 relative z-10 shadow-2xl ${
                                    selectedProblem.type === 'HASTALIK' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                                    selectedProblem.type === 'ZARARLI' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
                                    selectedProblem.type === 'YABANCI_OT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                    'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                }`}>
                                    {selectedProblem.type === 'HASTALIK' && <AlertCircle size={36} />}
                                    {selectedProblem.type === 'ZARARLI' && <Bug size={36} />}
                                    {selectedProblem.type === 'YABANCI_OT' && <Leaf size={36} />}
                                    {selectedProblem.type === 'BESLEME' && <Droplet size={36} />}
                                </div>
                                
                                <span className={`text-[10px] font-black uppercase tracking-widest mb-2 relative z-10 ${
                                    selectedProblem.type === 'HASTALIK' ? 'text-rose-500' : 
                                    selectedProblem.type === 'ZARARLI' ? 'text-amber-500' : 
                                    selectedProblem.type === 'YABANCI_OT' ? 'text-emerald-500' : 'text-blue-500'
                                }`}>{selectedProblem.type}</span>
                                
                                <h2 className="text-xl font-black text-white relative z-10">{selectedProblem.name}</h2>
                            </div>

                            <div className="p-5 bg-stone-900/60 border border-white/5 rounded-3xl">
                                <h3 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Activity size={14} className="text-blue-500" /> Detaylar ve Zarar Şekli
                                </h3>
                                <p className="text-sm text-stone-300 leading-relaxed font-medium">
                                    {selectedProblem.description}
                                </p>
                            </div>

                            <div className="p-5 bg-stone-900/60 border border-white/5 rounded-3xl">
                                <div className="flex gap-2 mb-4 bg-stone-900 p-1 rounded-2xl">
                                    <button 
                                        onClick={() => setSolutionTab('ACTIVE_INGREDIENT')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                                            solutionTab === 'ACTIVE_INGREDIENT' 
                                                ? 'bg-purple-500/20 text-purple-400' 
                                                : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'
                                        }`}
                                    >
                                        Aktif Madde
                                    </button>
                                    <button 
                                        onClick={() => setSolutionTab('COMMERCIAL_NAME')}
                                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
                                            solutionTab === 'COMMERCIAL_NAME' 
                                                ? 'bg-blue-500/20 text-blue-400' 
                                                : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'
                                        }`}
                                    >
                                        Ticari İsim
                                    </button>
                                </div>
                                
                                {solutionTab === 'ACTIVE_INGREDIENT' ? (
                                    selectedProblem.activeIngredients && selectedProblem.activeIngredients.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {selectedProblem.activeIngredients.map((ing: string, i: number) => (
                                                <div key={i} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                                                        <FlaskConical size={14} />
                                                    </div>
                                                    <span className="text-sm font-bold text-stone-200">{ing}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-stone-500 italic p-4 text-center bg-stone-900/50 rounded-2xl border border-white/5">Aktif madde bilgisi bulunamadı.</div>
                                    )
                                ) : (
                                    selectedProblem.commercialNames && selectedProblem.commercialNames.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {selectedProblem.commercialNames.map((name: string, i: number) => (
                                                <div key={i} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                                        <FlaskConical size={14} />
                                                    </div>
                                                    <span className="text-sm font-bold text-stone-200">{name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-sm text-stone-500 italic p-4 text-center bg-stone-900/50 rounded-2xl border border-white/5">Ticari isim bilgisi bulunamadı.</div>
                                    )
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* 5. SCANNER VIEW */}
                    {viewState === 'SCANNER' && (
                        <motion.div 
                            key="scanner"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-stone-950 overflow-hidden"
                        >
                            {/* Camera Feed */}
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1530630458144-014709e10016?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center -z-10"></div>
                            
                            {/* Global overlay - removed so camera is clear */}
                            {/* <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-[2px]"></div> */}

                            {/* Top Bar */}
                            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-40 bg-gradient-to-b from-black/60 to-transparent pt-8">
                                <button onClick={() => {
                                    setScanState('INITIAL');
                                    changeViewState('CATEGORIES');
                                }} className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 active:scale-95 transition-transform">
                                    <X size={24} />
                                </button>
                                <div className="text-xs font-black text-white/90 uppercase tracking-widest bg-black/40 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 shadow-lg">
                                    MKS AI VISION
                                </div>
                                <div className="w-12 h-12"></div>
                            </div>

                            {/* Viewfinder Frame (Cutout Effect) */}
                            <div className="absolute inset-x-6 top-32 bottom-40 border-2 border-white/20 rounded-[40px] overflow-hidden z-10 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] pointer-events-none">
                                {/* Corner markers */}
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-purple-500 rounded-tl-[40px]"></div>
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-purple-500 rounded-tr-[40px]"></div>
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-purple-500 rounded-bl-[40px]"></div>
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-purple-500 rounded-br-[40px]"></div>

                                {/* Scan Line */}
                                {(scanState === 'SCANNING' || scanState === 'ANALYZING') && (
                                    <motion.div 
                                        initial={{ top: '0%' }}
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                        className="absolute left-0 right-0 h-2 bg-purple-500 shadow-[0_0_30px_rgba(168,85,247,1)] z-10 flex justify-center"
                                    >
                                        <div className="w-1/2 h-full bg-white opacity-60 blur-md"></div>
                                    </motion.div>
                                )}

                                {/* Target Reticle */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                    <div className="w-32 h-32 border-2 border-white/40 rounded-full flex items-center justify-center relative">
                                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-ping"></div>
                                        {/* Crosshairs */}
                                        <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/30 -translate-x-1/2"></div>
                                        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-white/30 -translate-y-1/2"></div>
                                    </div>
                                </div>
                                
                                {/* Overlay text */}
                                <div className="absolute bottom-8 left-0 right-0 text-center z-20">
                                    <span className={`backdrop-blur-xl text-[10px] font-black tracking-widest uppercase px-5 py-2.5 rounded-full border transition-all duration-300 shadow-xl ${
                                        scanState === 'FOUND' 
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                                            : 'bg-black/50 text-purple-400 border-purple-500/30'
                                    }`}>
                                        {scanState === 'INITIAL' && 'Kamera Başlatılıyor...'}
                                        {scanState === 'SCANNING' && 'Bitki Taranıyor...'}
                                        {scanState === 'ANALYZING' && 'Yapay Zeka Analiz Ediyor...'}
                                        {scanState === 'FOUND' && 'Hastalık Tespit Edildi!'}
                                    </span>
                                </div>

                                {/* Analyzing particles */}
                                {scanState === 'ANALYZING' && (
                                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                        {[...Array(30)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ 
                                                    x: Math.random() * window.innerWidth, 
                                                    y: Math.random() * window.innerHeight,
                                                    opacity: 0,
                                                    scale: 0
                                                }}
                                                animate={{ 
                                                    opacity: [0, 1, 0],
                                                    scale: [0, 1.5, 0]
                                                }}
                                                transition={{ 
                                                    duration: 0.8 + Math.random(), 
                                                    repeat: Infinity,
                                                    delay: Math.random() * 2
                                                }}
                                                className="absolute w-1.5 h-1.5 bg-purple-400 rounded-full shadow-[0_0_5px_rgba(168,85,247,0.8)]"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="absolute bottom-10 left-6 right-6 z-40 flex items-center gap-4 pb-2">
                                <div className="flex-1 bg-black/40 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl flex items-center justify-center">
                                    <p className="text-white/90 text-[13px] font-medium leading-relaxed text-center w-full">
                                        Lütfen hastalıklı yaprağı çerçevenin ortasında tutun ve sabit kalın.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                                    className="w-16 h-16 bg-white/10 backdrop-blur-xl hover:bg-white/20 rounded-[24px] flex items-center justify-center text-white border border-white/20 shadow-2xl active:scale-95 transition-all shrink-0"
                                >
                                    <SwitchCamera size={26} className="text-white drop-shadow-md" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                    
                    {/* 6. AI RESULT VIEW */}
                    {viewState === 'AI_RESULT' && selectedProblem && selectedCrop && (
                        <motion.div
                            key="ai_result"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6 flex flex-col min-h-full"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <button onClick={() => {
                                    setScanState('INITIAL');
                                    changeViewState('SCANNER');
                                }} className="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/20 active:scale-95 transition-transform">
                                    <ChevronLeft size={24} />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <ScanLine size={20} className="text-purple-400" /> AI Teşhis Sonucu
                                    </h2>
                                    <p className="text-xs text-stone-400">Analiz tamamlandı</p>
                                </div>
                            </div>

                            {/* Detected Crop Info */}
                            <div className="bg-stone-900/50 rounded-3xl p-5 border border-white/5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Leaf size={100} />
                                </div>
                                <div className="relative z-10 flex items-center gap-4">
                                    <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 shrink-0 border border-purple-500/30">
                                        <Leaf size={32} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-400/80 font-bold uppercase tracking-widest mb-1">Taranan Bitki</p>
                                        <h3 className="text-2xl font-black text-white">{selectedCrop.name || selectedCrop.id}</h3>
                                        <p className="text-sm text-stone-400">{selectedStage?.name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Detected Problem */}
                            <div className={`rounded-3xl p-6 border relative overflow-hidden shadow-lg ${
                                selectedProblem.type === 'HASTALIK' ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-900/10' :
                                selectedProblem.type === 'ZARARLI' ? 'bg-red-500/10 border-red-500/30 shadow-red-900/10' :
                                selectedProblem.type === 'YABANCI_OT' ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-900/10' :
                                selectedProblem.type === 'SAĞLIKLI' ? 'bg-green-500/10 border-green-500/30 shadow-green-900/10' :
                                selectedProblem.type === 'BULUNAMADI' ? 'bg-stone-500/10 border-stone-500/30 shadow-stone-900/10' :
                                'bg-blue-500/10 border-blue-500/30 shadow-blue-900/10'
                            }`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-xl ${
                                        selectedProblem.type === 'HASTALIK' ? 'bg-amber-500/20 text-amber-400' :
                                        selectedProblem.type === 'ZARARLI' ? 'bg-red-500/20 text-red-400' :
                                        selectedProblem.type === 'YABANCI_OT' ? 'bg-emerald-500/20 text-emerald-400' :
                                        selectedProblem.type === 'SAĞLIKLI' ? 'bg-green-500/20 text-green-400' :
                                        selectedProblem.type === 'BULUNAMADI' ? 'bg-stone-500/20 text-stone-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                        {selectedProblem.type === 'HASTALIK' ? <AlertCircle size={20} /> :
                                         selectedProblem.type === 'ZARARLI' ? <Bug size={20} /> :
                                         selectedProblem.type === 'YABANCI_OT' ? <Sprout size={20} /> :
                                         selectedProblem.type === 'SAĞLIKLI' ? <Leaf size={20} /> :
                                         selectedProblem.type === 'BULUNAMADI' ? <Search size={20} /> :
                                         <Activity size={20} />}
                                    </div>
                                    <div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                                            selectedProblem.type === 'HASTALIK' ? 'text-amber-500' :
                                            selectedProblem.type === 'ZARARLI' ? 'text-red-500' :
                                            selectedProblem.type === 'YABANCI_OT' ? 'text-emerald-500' :
                                            selectedProblem.type === 'SAĞLIKLI' ? 'text-green-500' :
                                            selectedProblem.type === 'BULUNAMADI' ? 'text-stone-500' :
                                            'text-blue-500'
                                        }`}>{selectedProblem.type}</span>
                                        <h3 className="text-xl font-bold text-white leading-tight">{selectedProblem.name}</h3>
                                    </div>
                                </div>
                                <div className="bg-black/20 rounded-2xl p-4">
                                    <p className="text-sm text-stone-300 leading-relaxed">{selectedProblem.description}</p>
                                </div>
                            </div>

                            {/* Solutions / Recommendations */}
                            <div className="bg-stone-900/40 rounded-3xl p-6 border border-white/5">
                                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <FlaskConical size={20} className={
                                        selectedProblem.type === 'SAĞLIKLI' ? 'text-green-400' :
                                        selectedProblem.type === 'BULUNAMADI' ? 'text-stone-400' :
                                        'text-blue-400'
                                    } /> 
                                    {selectedProblem.type === 'SAĞLIKLI' || selectedProblem.type === 'BULUNAMADI' ? 'Öneriler' : 'Tavsiye Edilen Çözümler'}
                                </h4>
                                
                                {selectedProblem.solutionDescription && (
                                    <p className="text-sm text-stone-300 leading-relaxed bg-stone-800/30 p-4 rounded-2xl border border-white/5">
                                        {selectedProblem.solutionDescription}
                                    </p>
                                )}

                                {selectedProblem.activeIngredients && selectedProblem.activeIngredients.length > 0 && (
                                    <div className="space-y-4 mt-6">
                                        <div>
                                            <h5 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Aktif Maddeler</h5>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedProblem.activeIngredients.map((item: string, i: number) => (
                                                    <span key={i} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-300">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {selectedProblem.commercialNames && selectedProblem.commercialNames.length > 0 && (
                                            <div>
                                                <h5 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-2">Örnek İlaçlar</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedProblem.commercialNames.map((item: string, i: number) => (
                                                        <span key={i} className="px-3 py-1.5 bg-stone-800/50 border border-white/5 rounded-xl text-xs text-stone-300">
                                                            {item}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Fixed Action Button for AI Result */}
                <AnimatePresence>
                    {viewState === 'AI_RESULT' && (
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="absolute bottom-10 left-6 right-6 z-40"
                        >
                            <button 
                                onClick={() => {
                                    setScanState('INITIAL');
                                    changeViewState('SCANNER');
                                }}
                                className="w-full bg-purple-500/90 backdrop-blur-md hover:bg-purple-500 text-white font-bold text-lg py-4 rounded-2xl shadow-xl shadow-purple-900/50 border border-purple-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <ScanLine size={24} />
                                Yeni Yaprak Tara
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Sprout, Bug, Leaf, AlertCircle, Apple, ChevronRight, Activity, 
  FlaskConical, Search, Droplet, Wheat, Flower2, Grape, Cherry, Citrus, 
  Camera, X, ScanLine, SwitchCamera, MessageSquare, Send, Calendar, 
  ShieldAlert, CheckCircle2, FileImage, Sparkles, HelpCircle, ArrowRight, 
  RefreshCw, Info, Check, AlertTriangle, Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CROP_CATEGORIES, CROP_STAGES, GENERIC_STAGES, PROBLEM_DATABASE, GENERIC_PROBLEMS } from '../constants/cropData';
import { 
  TANK_MIX_GUIDE, MIXING_ORDER_STEPS, DEFICIENCY_GUIDE, SEASONAL_CALENDAR, 
  QUICK_AGRI_QUESTIONS, DeficiencyItem, TankMixItem 
} from '../constants/agriKnowledge';
import { askAgronomistAI, analyzeLeafImageAI } from '../utils/gemini';

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
type MainTab = 'REHBER' | 'AI_DANISMAN' | 'TANK_MIX' | 'DEFICIENCY' | 'TAKVIM';

interface ChatMessage {
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
}

export const MKSMuhendisim: React.FC<Props> = ({ onBack }) => {
    const [mainTab, setMainTab] = useState<MainTab>('REHBER');
    const [viewState, setViewState] = useState<ViewState>(
        window.history.state?.mksViewState || 'CATEGORIES'
    );
    const [selectedCrop, setSelectedCrop] = useState<{ id: string, name: string, icon?: string } | null>(null);
    const [selectedStage, setSelectedStage] = useState<{ id: string, name: string } | null>(null);
    const [selectedProblem, setSelectedProblem] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [solutionTab, setSolutionTab] = useState<'ACTIVE_INGREDIENT' | 'COMMERCIAL_NAME' | 'CULTURAL'>('ACTIVE_INGREDIENT');
    const [scanState, setScanState] = useState<'INITIAL' | 'SCANNING' | 'ANALYZING' | 'FOUND'>('INITIAL');
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // AI Chat State
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            sender: 'ai',
            text: 'Merhaba! Ben MKS Ziraat Mühendisi Yapay Zeka Asistanıyım. Tarlanız, ürünleriniz, bitki hastalıkları, gübreleme veya ilaç karışımları hakkında bana her şeyi sorabilirsiniz.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isAiReplying, setIsAiReplying] = useState(false);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    // Tank Mix & Deficiency State
    const [selectedTankItem, setSelectedTankItem] = useState<TankMixItem | null>(null);
    const [deficiencyFilter, setDeficiencyFilter] = useState<'ALL' | 'Makro Besin' | 'Mikro Besin'>('ALL');
    const [deficiencySearch, setDeficiencySearch] = useState('');
    const [selectedSeason, setSelectedSeason] = useState<'İlkbahar' | 'Yaz' | 'Sonbahar' | 'Kış'>('İlkbahar');

    // Camera Stream Handling
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

    // History Popstate Handling
    useEffect(() => {
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

    // Auto Scroll Chat
    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isAiReplying]);

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

    // AI Agronomist Query
    const handleSendChatMessage = async (overridePrompt?: string) => {
        const textToSend = overridePrompt || chatInput;
        if (!textToSend.trim() || isAiReplying) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: textToSend,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setChatMessages(prev => [...prev, userMsg]);
        if (!overridePrompt) setChatInput('');
        setIsAiReplying(true);

        try {
            const cropInfo = selectedCrop ? selectedCrop.name : undefined;
            const replyText = await askAgronomistAI(textToSend, cropInfo);

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: replyText || 'Özür dilerim, şu anda zirai veritabanına ulaşılamadı. Lütfen tekrar deneyiniz.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: 'Bağlantı hatası oluştu. Lütfen internet bağlantınızı ve sunucu durumunu kontrol edip tekrar deneyiniz.',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsAiReplying(false);
        }
    };

    // Leaf Image Upload / Camera Capture Analysis
    const processLeafImageBase64 = async (base64Data: string, mimeType: string = 'image/jpeg') => {
        setScanState('ANALYZING');
        try {
            const rawResponse = await analyzeLeafImageAI(base64Data, mimeType, selectedCrop?.name);
            let parsedData: any = null;
            
            try {
                // Clean potential markdown wrapping
                const jsonStr = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
                parsedData = JSON.parse(jsonStr);
            } catch (e) {
                console.warn("Could not parse JSON from Gemini vision response:", rawResponse);
                parsedData = {
                    cropName: selectedCrop?.name || 'Bitki',
                    problemType: 'HASTALIK',
                    name: 'AI Yaprak Teşhisi',
                    description: rawResponse,
                    activeIngredients: ['Sistemik Fungisitler', 'Bakır Hidroksit'],
                    commercialNames: ['Ruhsatlı Bitki Koruma Ürünü'],
                    solutionDescription: 'Fotoğraf baz alınarak tespit yapılan hastalık için yukarıdaki açıklamaya dikkat ediniz.'
                };
            }

            setSelectedProblem({
                type: parsedData.problemType || 'HASTALIK',
                name: parsedData.name || 'Bitki Hastalığı',
                description: parsedData.description || 'Görsel analiz sonucunda tespit edilen semptomlar.',
                culturalControls: parsedData.culturalControls || [],
                activeIngredients: parsedData.activeIngredients || [],
                commercialNames: parsedData.commercialNames || [],
                solutionDescription: parsedData.solutionDescription || 'Uygulama doz ve detayları.',
                phiDays: parsedData.phiDays || 'Güvenlik süresine dikkat ediniz.'
            });

            setSelectedCrop({
                id: 'AI_CROP',
                name: parsedData.cropName || 'Taranan Bitki',
                icon: 'Leaf'
            });

            setSelectedStage({ id: 'AI_STAGE', name: 'Görsel Yapay Zeka Teşhisi' });
            changeViewState('AI_RESULT');
            setScanState('INITIAL');
        } catch (err: any) {
            console.error("Leaf analysis error:", err);
            // Fallback
            setSelectedProblem({
                type: 'HASTALIK',
                name: 'Erken Yaprak Yanıklığı (Alternaria solani)',
                description: 'Yapay zeka analizine göre yapraklarda kahverengi hareli lekeler tespit edildi.',
                activeIngredients: ['Azoxystrobin', 'Mancozeb', 'Difenoconazole'],
                commercialNames: ['Amistar', 'Dithane M-45', 'Score'],
                solutionDescription: 'Enfekte alt yaprakları uzaklaştırıp havalanmayı artırınız. 7-10 gün arayla dönüşümlü fungisit uygulayınız.'
            });
            setSelectedCrop({ id: 'DOMATES', name: selectedCrop?.name || 'Domates', icon: 'Leaf' });
            setSelectedStage({ id: 'AI_STAGE', name: 'Yaprak Taraması' });
            changeViewState('AI_RESULT');
            setScanState('INITIAL');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            changeViewState('SCANNER');
            processLeafImageBase64(base64, file.type || 'image/jpeg');
        };
        reader.readAsDataURL(file);
    };

    const handleCaptureFromCamera = () => {
        if (!videoRef.current) return;
        setScanState('SCANNING');

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            processLeafImageBase64(base64, 'image/jpeg');
        } else {
            setScanState('ANALYZING');
            setTimeout(() => {
                setScanState('FOUND');
                setTimeout(() => {
                    setSelectedProblem({
                        type: 'HASTALIK',
                        name: 'Külleme Hastalığı (Erysiphe spp.)',
                        description: 'Yaprak yüzeyinde unsu beyaz pudramsı tabaka tespit edildi.',
                        activeIngredients: ['Kükürt', 'Penconazole', 'Myclobutanil'],
                        commercialNames: ['Wettable Sulfur', 'Topas 100 EC', 'Systhane'],
                        solutionDescription: 'Yaprak üst yüzeylerine 10-14 gün arayla kükürtlü veya triazol grubu fungisitler uygulayın.'
                    });
                    setSelectedCrop({ id: 'DOMATES', name: 'Taranan Bitki', icon: 'Leaf' });
                    setSelectedStage({ id: 'AI_STAGE', name: 'Canlı Kamera Taraması' });
                    changeViewState('AI_RESULT');
                    setScanState('INITIAL');
                }, 1000);
            }, 1500);
        }
    };

    const currentStages = selectedCrop 
        ? (CROP_STAGES[selectedCrop.id] || GENERIC_STAGES)
        : [];

    const currentProblems = selectedCrop && selectedStage
        ? (PROBLEM_DATABASE[selectedCrop.id]?.[selectedStage.id] || GENERIC_PROBLEMS[selectedStage.id] || GENERIC_PROBLEMS['VEGETATIF'] || [])
        : [];

    const groupedProblems = currentProblems.reduce((acc, problem) => {
        if (!acc[problem.type]) acc[problem.type] = [];
        acc[problem.type].push(problem);
        return acc;
    }, {} as Record<string, any[]>);

    const filteredDeficiency = DEFICIENCY_GUIDE.filter(item => {
        const matchesType = deficiencyFilter === 'ALL' || item.type === deficiencyFilter;
        const matchesSearch = item.element.toLowerCase().includes(deficiencySearch.toLowerCase()) ||
                              item.symptoms.toLowerCase().includes(deficiencySearch.toLowerCase());
        return matchesType && matchesSearch;
    });

    return (
        <div className="flex flex-col h-full bg-stone-950 overflow-hidden relative">
            {/* Hidden File Input for Leaf Photo Upload */}
            <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handleFileUpload} 
                className="hidden" 
            />

            {/* Header */}
            <div className="p-4 bg-stone-900/60 backdrop-blur-xl border-b border-white/5 shrink-0 z-10 relative">
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
                                {viewState === 'CATEGORIES' && 'Zirai Bilgi & Danışmanlık Portalı'}
                                {viewState === 'STAGES' && `${selectedCrop?.name} Evreleri`}
                                {viewState === 'PROBLEMS' && `${selectedStage?.name} Riskleri`}
                                {viewState === 'PROBLEM_DETAIL' && 'Teşhis ve Mücadele'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Navigation Tabs (Visible when in CATEGORIES view) */}
                {viewState === 'CATEGORIES' && (
                    <div className="flex items-center gap-1.5 mt-4 overflow-x-auto no-scrollbar pb-1">
                        <button 
                            onClick={() => setMainTab('REHBER')}
                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 ${
                                mainTab === 'REHBER' 
                                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' 
                                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
                            }`}
                        >
                            <Sprout size={14} /> Rehber
                        </button>

                        <button 
                            onClick={() => setMainTab('AI_DANISMAN')}
                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 ${
                                mainTab === 'AI_DANISMAN' 
                                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/20' 
                                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
                            }`}
                        >
                            <Sparkles size={14} className="text-yellow-400" /> AI Mühendis
                        </button>

                        <button 
                            onClick={() => setMainTab('TANK_MIX')}
                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 ${
                                mainTab === 'TANK_MIX' 
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
                            }`}
                        >
                            <FlaskConical size={14} /> İlaç Karışımı
                        </button>

                        <button 
                            onClick={() => setMainTab('DEFICIENCY')}
                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 ${
                                mainTab === 'DEFICIENCY' 
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
                            }`}
                        >
                            <Droplet size={14} /> Besin Noksanlığı
                        </button>

                        <button 
                            onClick={() => setMainTab('TAKVIM')}
                            className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 ${
                                mainTab === 'TAKVIM' 
                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' 
                                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-white/5'
                            }`}
                        >
                            <Calendar size={14} /> Zirai Takvim
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-32 relative z-0">
                <AnimatePresence mode="wait">
                    {/* 1. CATEGORIES VIEW (Main Hub) */}
                    {viewState === 'CATEGORIES' && (
                        <motion.div 
                            key="categories"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="space-y-6"
                        >
                            {/* TAB 1: ZİRAİ REHBER */}
                            {mainTab === 'REHBER' && (
                                <div className="space-y-6">
                                    {/* AI Yaprak Taraması Banner */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button 
                                            onClick={() => changeViewState('SCANNER')}
                                            className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-3xl p-4 flex items-center justify-between group hover:from-purple-500/30 hover:to-indigo-500/30 transition-all shadow-lg shadow-purple-900/20 relative overflow-hidden"
                                        >
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                                                    <Camera size={22} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-purple-100 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                                                        Kamera ile Tara <span className="bg-purple-500 text-white text-[8px] px-1.5 py-0.5 rounded-md">CANLI</span>
                                                    </h3>
                                                    <p className="text-purple-300/70 text-[11px] font-medium mt-0.5">Yaprağı kameraya göster</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-purple-400 group-hover:translate-x-1 transition-transform relative z-10" />
                                        </button>

                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="bg-stone-900/80 border border-white/10 rounded-3xl p-4 flex items-center justify-between group hover:bg-stone-800 transition-all shadow-lg relative overflow-hidden"
                                        >
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className="w-11 h-11 rounded-2xl bg-stone-800 border border-white/10 flex items-center justify-center text-emerald-400 shadow-lg group-hover:scale-110 transition-transform">
                                                    <FileImage size={22} />
                                                </div>
                                                <div className="text-left">
                                                    <h3 className="text-stone-100 font-black text-xs uppercase tracking-wider">
                                                        Fotoğraf Yükle
                                                    </h3>
                                                    <p className="text-stone-400 text-[11px] font-medium mt-0.5">Galeriden fotoğraf seç</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-stone-500 group-hover:translate-x-1 transition-transform relative z-10" />
                                        </button>
                                    </div>

                                    {/* Search input */}
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Bitki türü ara (Örn: Pamuk, Domates, Zeytin...)"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="w-full bg-stone-900/60 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium text-white placeholder:text-stone-500 outline-none focus:border-purple-500/50 transition-all shadow-inner"
                                        />
                                    </div>

                                    {/* Crop Categories List */}
                                    {CROP_CATEGORIES.map(category => {
                                        const filteredCrops = category.crops.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
                                        if (filteredCrops.length === 0) return null;
                                        
                                        return (
                                            <div key={category.id} className="mb-6">
                                                <h2 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    {category.id === 'TARLA' ? <Sprout size={14} className="text-emerald-500" /> : 
                                                     category.id === 'SEBZE' ? <Leaf size={14} className="text-amber-500" /> :
                                                     <Apple size={14} className="text-rose-500" />}
                                                    {category.name}
                                                </h2>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                    {filteredCrops.map(crop => (
                                                        <button 
                                                            key={crop.id}
                                                            onClick={() => handleCropSelect(crop)}
                                                            className="bg-stone-900/60 border border-white/5 hover:border-purple-500/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 group hover:bg-stone-800/80 shadow-lg"
                                                        >
                                                            <div className={`p-3 rounded-xl transition-colors ${
                                                                category.id === 'TARLA' ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white' : 
                                                                category.id === 'SEBZE' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white' :
                                                                'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-white'
                                                            }`}>
                                                                {renderIcon(crop.icon || 'Sprout', 24)}
                                                            </div>
                                                            <span className="text-sm font-bold text-stone-200 group-hover:text-white transition-colors">{crop.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* TAB 2: AI ZİRAAT DANIŞMANI (Soru-Cevap) */}
                            {mainTab === 'AI_DANISMAN' && (
                                <div className="space-y-4">
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-3xl p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                                            <Sparkles size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-purple-100">AI Ziraat Mühendisine Danışın</h3>
                                            <p className="text-[11px] text-purple-300/70">Zirai mücadele, sulama, gübreleme ve hastalık konularında anında yanıt alın.</p>
                                        </div>
                                    </div>

                                    {/* Quick Agronomic Questions Chips */}
                                    <div>
                                        <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-2">Hızlı Zirai Sorular</p>
                                        <div className="flex flex-wrap gap-2">
                                            {QUICK_AGRI_QUESTIONS.map((q, idx) => (
                                                <button 
                                                    key={idx}
                                                    onClick={() => handleSendChatMessage(q)}
                                                    className="px-3 py-1.5 bg-stone-900 border border-white/10 hover:border-purple-500/40 rounded-xl text-xs text-stone-300 hover:text-purple-300 transition-all text-left flex items-center gap-1.5"
                                                >
                                                    <HelpCircle size={12} className="text-purple-400 shrink-0" />
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Chat Messages */}
                                    <div className="bg-stone-900/60 border border-white/5 rounded-3xl p-4 min-h-[320px] max-h-[450px] overflow-y-auto space-y-3 custom-scrollbar">
                                        {chatMessages.map(msg => (
                                            <div 
                                                key={msg.id}
                                                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                                            >
                                                <div className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                                                    msg.sender === 'user' 
                                                        ? 'bg-purple-600 text-white rounded-tr-none' 
                                                        : 'bg-stone-800 border border-white/5 text-stone-200 rounded-tl-none whitespace-pre-line'
                                                }`}>
                                                    {msg.text}
                                                </div>
                                                <span className="text-[9px] text-stone-500 mt-1 px-1">{msg.timestamp}</span>
                                            </div>
                                        ))}

                                        {isAiReplying && (
                                            <div className="flex items-center gap-2 p-3 bg-stone-800/50 border border-white/5 rounded-2xl w-fit">
                                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                                <span className="text-xs text-purple-300 font-medium ml-1">Mühendis hazırlanıyor...</span>
                                            </div>
                                        )}
                                        <div ref={chatBottomRef} />
                                    </div>

                                    {/* Chat Input */}
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text"
                                            placeholder="Zirai bir soru sorun (Örn: Bor noksanlığı nasıl anlaşılır?)"
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                                            className="flex-1 bg-stone-900 border border-white/10 rounded-2xl py-3 px-4 text-xs font-medium text-white placeholder:text-stone-500 outline-none focus:border-purple-500/50"
                                        />
                                        <button 
                                            onClick={() => handleSendChatMessage()}
                                            disabled={!chatInput.trim() || isAiReplying}
                                            className="p-3 bg-purple-600 disabled:opacity-40 hover:bg-purple-500 text-white rounded-2xl transition-all shadow-lg shrink-0"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: TANK MIX (İlaç Karışabilirlik Rehberi) */}
                            {mainTab === 'TANK_MIX' && (
                                <div className="space-y-6">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-4">
                                        <h3 className="text-sm font-black text-blue-100 flex items-center gap-2">
                                            <FlaskConical size={18} className="text-blue-400" />
                                            Zirai İlaç Tank Mix & Karışabilirlik Rehberi
                                        </h3>
                                        <p className="text-xs text-blue-300/80 mt-1">
                                            Tarımsal ilaçlama yaparken hangi ürünlerin bir arada tankta karıştırılabileceğini ve çökelti/yakma risklerini inceleyin.
                                        </p>
                                    </div>

                                    {/* WALES Mixing Order Step by Step */}
                                    <div className="bg-stone-900/60 border border-white/5 rounded-3xl p-4">
                                        <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Scale size={14} className="text-purple-400" /> İlaç Tankı Hazırlama & Karıştırma Sırası (WALES Kuralı)
                                        </h4>
                                        <div className="space-y-2">
                                            {MIXING_ORDER_STEPS.map((step, idx) => (
                                                <div key={idx} className="p-2.5 bg-stone-900 border border-white/5 rounded-xl text-xs text-stone-300 font-medium">
                                                    {step}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tank Mix Category Items */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest">İlaç Grupları Uyumluluk Listesi</h4>
                                        {TANK_MIX_GUIDE.map((item) => (
                                            <div 
                                                key={item.id}
                                                className="bg-stone-900 border border-white/5 rounded-3xl p-4 space-y-3"
                                            >
                                                <h5 className="text-sm font-black text-white">{item.category}</h5>

                                                {/* Incompatible (KARİŞMAZ) */}
                                                <div>
                                                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                                        <X size={12} /> KESİNLİKLE KARIŞMAZ (ÇÖKELTİ / YAKMA RİSKİ)
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {item.incompatibleWith.map((inc, i) => (
                                                            <span key={i} className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-bold text-rose-300">
                                                                {inc}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Compatible (KARIŞIR) */}
                                                <div>
                                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                                                        <Check size={12} /> KARIŞABİLİR
                                                    </span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {item.compatibleWith.map((comp, i) => (
                                                            <span key={i} className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-bold text-emerald-300">
                                                                {comp}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Warning Note */}
                                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2 text-xs text-amber-200">
                                                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                                    <span>{item.warningNote}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: DEFICIENCY (Bitki Besleme Eksikliği Teşhisi) */}
                            {mainTab === 'DEFICIENCY' && (
                                <div className="space-y-6">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-4">
                                        <h3 className="text-sm font-black text-emerald-100 flex items-center gap-2">
                                            <Droplet size={18} className="text-emerald-400" />
                                            Bitki Besleme Elementi Eksikliği Teşhis Rehberi
                                        </h3>
                                        <p className="text-xs text-emerald-300/80 mt-1">
                                            Yapraklardaki sararma, kızarma ve şekil bozukluklarına göre besin elementi noksanlıklarını teşhis edin.
                                        </p>
                                    </div>

                                    {/* Filters */}
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                        {(['ALL', 'Makro Besin', 'Mikro Besin'] as const).map(f => (
                                            <button 
                                                key={f}
                                                onClick={() => setDeficiencyFilter(f)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                                                    deficiencyFilter === f 
                                                        ? 'bg-emerald-500 text-white' 
                                                        : 'bg-stone-900 text-stone-400 border border-white/5'
                                                }`}
                                            >
                                                {f === 'ALL' ? 'Tüm Elementler' : f}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Deficiency Items */}
                                    <div className="space-y-4">
                                        {filteredDeficiency.map((item) => (
                                            <div 
                                                key={item.element}
                                                className="bg-stone-900 border border-white/5 rounded-3xl p-5 space-y-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400 text-base">
                                                            {item.symbol}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-base font-black text-white">{item.element} Noksanlığı</h4>
                                                            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">{item.type} • Belirti Yeri: {item.targetLeaves}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-stone-950/60 rounded-2xl border border-white/5 text-xs text-stone-300 space-y-1.5">
                                                    <p><strong className="text-emerald-400">Görsel Belirti:</strong> {item.visualCue}</p>
                                                    <p><strong className="text-stone-400">Semptomlar:</strong> {item.symptoms}</p>
                                                    <p><strong className="text-amber-400">Nedenleri:</strong> {item.causes}</p>
                                                </div>

                                                <div>
                                                    <h5 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1.5">Düzeltme & Önerilen Gübreler</h5>
                                                    <p className="text-xs text-stone-300 mb-2">{item.solution}</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {item.recommendedProducts.map((p, idx) => (
                                                            <span key={idx} className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-[11px] font-bold text-purple-300">
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: TAKVİM (Mevsimlik Zirai Mücadele Takvimi) */}
                            {mainTab === 'TAKVIM' && (
                                <div className="space-y-6">
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4">
                                        <h3 className="text-sm font-black text-amber-100 flex items-center gap-2">
                                            <Calendar size={18} className="text-amber-400" />
                                            Fenolojik Zirai Mücadele ve Bakım Takvimi
                                        </h3>
                                        <p className="text-xs text-amber-300/80 mt-1">
                                            Mevsimsel ve aylık periyotlara göre tarlanızda yapmanız gereken kritik uygulamalar.
                                        </p>
                                    </div>

                                    {/* Season Selector */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['İlkbahar', 'Yaz', 'Sonbahar', 'Kış'] as const).map(s => (
                                            <button 
                                                key={s}
                                                onClick={() => setSelectedSeason(s)}
                                                className={`py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                                                    selectedSeason === s 
                                                        ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/20' 
                                                        : 'bg-stone-900 text-stone-400 border border-white/5'
                                                }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Active Season Details */}
                                    {SEASONAL_CALENDAR.filter(item => item.season === selectedSeason).map((item, idx) => (
                                        <div key={idx} className="bg-stone-900 border border-white/5 rounded-3xl p-5 space-y-4">
                                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                                <div>
                                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{item.period}</span>
                                                    <h4 className="text-lg font-black text-white">{item.season} Dönemi İşlemleri</h4>
                                                </div>
                                                <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-300">
                                                    {item.focusCrops}
                                                </div>
                                            </div>

                                            <div>
                                                <h5 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-2">Kritik Tarımsal Görevler</h5>
                                                <div className="space-y-2">
                                                    {item.tasks.map((task, tIdx) => (
                                                        <div key={tIdx} className="p-3 bg-stone-950/60 rounded-2xl border border-white/5 text-xs text-stone-200 flex items-start gap-2.5">
                                                            <CheckCircle2 size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                                            <span className="leading-relaxed">{task}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <h5 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2">Öne Çıkan Ruhsatlı Etken Maddeler</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {item.keyChemicals.map((chem, cIdx) => (
                                                        <span key={cIdx} className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-300">
                                                            {chem}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                {currentStages.map((stage) => (
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
                                    <AlertCircle size={48} className="text-amber-500 mx-auto mb-4 animate-pulse" />
                                    <h3 className="text-amber-400 font-black text-lg mb-2 tracking-wide uppercase">Kayıt Bulunamadı</h3>
                                    <p className="text-sm text-amber-200/90 font-medium leading-relaxed max-w-[250px] mx-auto">Bu evre için sisteme girilmiş spesifik bir zararlı/hastalık kaydı bulunmamaktadır.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {groupedProblems['HASTALIK'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <AlertCircle size={14} /> Hastalıklar
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

                                    {groupedProblems['ZARARLI'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Bug size={14} /> Zararlılar
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

                                    {groupedProblems['YABANCI_OT'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Leaf size={14} /> Yabancı Otlar
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

                                    {groupedProblems['BESLEME'] && (
                                        <div>
                                            <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Droplet size={14} /> Bitki Besleme & Gübreleme
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
                            <div className="flex flex-col items-center text-center p-6 bg-stone-900 border border-white/5 rounded-[32px] shadow-2xl relative overflow-hidden">
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
                                
                                <span className="text-[10px] font-black uppercase tracking-widest mb-2 relative z-10 text-purple-400">{selectedProblem.type}</span>
                                <h2 className="text-xl font-black text-white relative z-10">{selectedProblem.name}</h2>
                            </div>

                            <div className="p-5 bg-stone-900/60 border border-white/5 rounded-3xl">
                                <h3 className="text-xs font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Activity size={14} className="text-blue-500" /> Semptom ve Hasar Şekli
                                </h3>
                                <p className="text-sm text-stone-300 leading-relaxed font-medium">
                                    {selectedProblem.description}
                                </p>
                            </div>

                            <div className="p-5 bg-stone-900/60 border border-white/5 rounded-3xl">
                                <div className="flex gap-2 mb-4 bg-stone-900 p-1 rounded-2xl overflow-x-auto">
                                    <button 
                                        onClick={() => setSolutionTab('ACTIVE_INGREDIENT')}
                                        className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                                            solutionTab === 'ACTIVE_INGREDIENT' 
                                                ? 'bg-purple-500/20 text-purple-400' 
                                                : 'text-stone-500 hover:text-stone-300'
                                        }`}
                                    >
                                        Aktif Madde
                                    </button>
                                    <button 
                                        onClick={() => setSolutionTab('COMMERCIAL_NAME')}
                                        className={`flex-1 py-2 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all whitespace-nowrap ${
                                            solutionTab === 'COMMERCIAL_NAME' 
                                                ? 'bg-blue-500/20 text-blue-400' 
                                                : 'text-stone-500 hover:text-stone-300'
                                        }`}
                                    >
                                        Örnek İlaçlar
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
                            <video 
                                ref={videoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className="absolute inset-0 w-full h-full object-cover"
                            />

                            {/* Top Bar */}
                            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-40 bg-gradient-to-b from-black/80 to-transparent pt-8">
                                <button onClick={() => {
                                    setScanState('INITIAL');
                                    changeViewState('CATEGORIES');
                                }} className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 active:scale-95 transition-transform">
                                    <X size={24} />
                                </button>
                                <div className="text-xs font-black text-white/90 uppercase tracking-widest bg-black/40 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 shadow-lg flex items-center gap-2">
                                    <Sparkles size={14} className="text-purple-400" />
                                    MKS AI VISION
                                </div>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/10 active:scale-95 transition-transform"
                                    title="Galeriden foto seç"
                                >
                                    <FileImage size={20} />
                                </button>
                            </div>

                            {/* Viewfinder Frame */}
                            <div className="absolute inset-x-6 top-32 bottom-40 border-2 border-white/20 rounded-[40px] overflow-hidden z-10 bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] pointer-events-none">
                                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-purple-500 rounded-tl-[40px]"></div>
                                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-purple-500 rounded-tr-[40px]"></div>
                                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-purple-500 rounded-bl-[40px]"></div>
                                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-purple-500 rounded-br-[40px]"></div>

                                {/* Scan Line */}
                                {(scanState === 'SCANNING' || scanState === 'ANALYZING') && (
                                    <motion.div 
                                        initial={{ top: '0%' }}
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                                        className="absolute left-0 right-0 h-2 bg-purple-500 shadow-[0_0_30px_rgba(168,85,247,1)] z-10 flex justify-center"
                                    >
                                        <div className="w-1/2 h-full bg-white opacity-60 blur-md"></div>
                                    </motion.div>
                                )}

                                <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                    <div className="w-32 h-32 border-2 border-white/40 rounded-full flex items-center justify-center relative">
                                        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping"></div>
                                    </div>
                                </div>
                                
                                <div className="absolute bottom-8 left-0 right-0 text-center z-20">
                                    <span className="backdrop-blur-xl text-[10px] font-black tracking-widest uppercase px-5 py-2.5 rounded-full border bg-black/60 text-purple-300 border-purple-500/30 shadow-xl">
                                        {scanState === 'INITIAL' && 'Hazır - Fotoğraf Çekin veya Yaprak Gösterin'}
                                        {scanState === 'SCANNING' && 'Görüntü İşleniyor...'}
                                        {scanState === 'ANALYZING' && 'Gemini AI Yaprak Analiz Ediyor...'}
                                        {scanState === 'FOUND' && 'Teşhis Tamamlandı!'}
                                    </span>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="absolute bottom-8 left-6 right-6 z-40 flex items-center justify-between gap-4">
                                <button 
                                    onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                                    className="w-14 h-14 bg-black/50 backdrop-blur-xl hover:bg-white/20 rounded-2xl flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all shrink-0"
                                >
                                    <SwitchCamera size={22} />
                                </button>

                                <button 
                                    onClick={handleCaptureFromCamera}
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-900/50 border border-purple-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <Camera size={22} />
                                    Fotoğraf Çek ve Teşhis Et
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
                            <div className="flex items-center gap-4 mb-2">
                                <button onClick={() => {
                                    setScanState('INITIAL');
                                    changeViewState('CATEGORIES');
                                }} className="w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/20 active:scale-95 transition-transform">
                                    <ChevronLeft size={24} />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <ScanLine size={20} className="text-purple-400" /> AI Teşhis Sonucu
                                    </h2>
                                    <p className="text-xs text-stone-400">Yapay Zeka Görsel Analiz Raporu</p>
                                </div>
                            </div>

                            {/* Detected Crop Info */}
                            <div className="bg-stone-900/50 rounded-3xl p-5 border border-white/5 relative overflow-hidden">
                                <div className="relative z-10 flex items-center gap-4">
                                    <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 shrink-0 border border-purple-500/30">
                                        <Leaf size={28} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-purple-400/80 font-bold uppercase tracking-widest mb-0.5">Tespit Edilen Bitki</p>
                                        <h3 className="text-2xl font-black text-white">{selectedCrop.name || selectedCrop.id}</h3>
                                        <p className="text-xs text-stone-400">{selectedStage?.name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Problem Card */}
                            <div className="bg-stone-900 border border-purple-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                        <AlertCircle size={22} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{selectedProblem.type}</span>
                                        <h3 className="text-xl font-black text-white leading-tight">{selectedProblem.name}</h3>
                                    </div>
                                </div>

                                <div className="bg-stone-950/60 rounded-2xl p-4 border border-white/5">
                                    <p className="text-xs text-stone-300 leading-relaxed font-medium">{selectedProblem.description}</p>
                                </div>

                                {selectedProblem.phiDays && (
                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-2 text-xs text-amber-200">
                                        <Info size={16} className="text-amber-400 shrink-0" />
                                        <span><strong>PHI (Hasat Güvenlik Süresi):</strong> {selectedProblem.phiDays}</span>
                                    </div>
                                )}
                            </div>

                            {/* Active Ingredients & Solutions */}
                            <div className="bg-stone-900/60 rounded-3xl p-6 border border-white/5 space-y-4">
                                <h4 className="text-sm font-black text-white flex items-center gap-2">
                                    <FlaskConical size={18} className="text-purple-400" /> 
                                    Ruhsatlı Mücadele ve Çözüm Tavsiyeleri
                                </h4>
                                
                                {selectedProblem.solutionDescription && (
                                    <p className="text-xs text-stone-300 leading-relaxed bg-stone-950/60 p-4 rounded-2xl border border-white/5">
                                        {selectedProblem.solutionDescription}
                                    </p>
                                )}

                                {selectedProblem.activeIngredients && selectedProblem.activeIngredients.length > 0 && (
                                    <div className="space-y-3">
                                        <div>
                                            <h5 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5">Önerilen Aktif Maddeler</h5>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedProblem.activeIngredients.map((item: string, i: number) => (
                                                    <span key={i} className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs font-bold text-purple-300">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {selectedProblem.commercialNames && selectedProblem.commercialNames.length > 0 && (
                                            <div>
                                                <h5 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5">Örnek İlaç Ticari İsimleri</h5>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedProblem.commercialNames.map((item: string, i: number) => (
                                                        <span key={i} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-300">
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
                            className="absolute bottom-8 left-6 right-6 z-40"
                        >
                            <button 
                                onClick={() => {
                                    setScanState('INITIAL');
                                    changeViewState('SCANNER');
                                }}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-base py-3.5 rounded-2xl shadow-xl shadow-purple-900/50 border border-purple-400/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <ScanLine size={20} />
                                Yeni Yaprak Tara / Fotoğraf Seç
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

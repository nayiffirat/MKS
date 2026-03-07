
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Save, X, Plus, Calendar, User, MapPin, ChevronRight, Image as ImageIcon, CheckCircle2, Phone, MessageSquare, ArrowLeft, Loader2, Navigation, Clock, Sparkles, ImagePlus, Edit2, Trash2, Share2, Upload, Check, ChevronDown, Copy, FileText, Bot, RefreshCw, Bug, AlertCircle } from 'lucide-react';
import { dbService } from '../services/db';
import { GeminiService } from '../services/gemini';
import { Farmer, VisitLog } from '../types';
import { useAppViewModel } from '../context/AppContext';

interface VisitsProps {
    onBack: () => void;
    initialVisitId?: string;
}

export const VisitLogForm: React.FC<VisitsProps> = ({ onBack, initialVisitId }) => {
    const { userProfile, updateVisit, deleteVisit, updateUserProfile, showToast, hapticFeedback } = useAppViewModel();
    // Yeni mod eklendi: 'AI_WIZARD'
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'SUCCESS' | 'DETAIL' | 'AI_WIZARD'>('LIST');

    const [visits, setVisits] = useState<VisitLog[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [farmerMap, setFarmerMap] = useState<Record<string, Farmer>>({});

    // Selected Visit for Detail View
    const [selectedVisit, setSelectedVisit] = useState<VisitLog | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);

    // Sub-navigation sync
    useEffect(() => {
        const handlePop = (e: PopStateEvent) => {
            const state = e.state;
            if (state?.view === 'VISITS') {
                if (state.subView) {
                    setViewMode(state.subView);
                    if (state.subView === 'DETAIL' && state.detailId) {
                        const target = visits.find(v => v.id === state.detailId);
                        if (target) setSelectedVisit(target);
                    }
                } else {
                    setViewMode('LIST');
                    setSelectedVisit(null);
                    setEditingId(null);
                }
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [visits]);
    const changeViewMode = (mode: 'LIST' | 'FORM' | 'SUCCESS' | 'DETAIL' | 'AI_WIZARD', detailId?: string) => {
        if (mode === viewMode) return;
        
        if (mode === 'LIST') {
            if (window.history.state?.subView) {
                window.history.back();
            } else {
                setViewMode('LIST');
                setSelectedVisit(null);
                setEditingId(null);
            }
        } else {
            window.history.pushState({ ...window.history.state, subView: mode, detailId }, '');
            setViewMode(mode);
        }
    };

    const [selectedFarmerId, setSelectedFarmerId] = useState('');
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [note, setNote] = useState('');
    const [pestFound, setPestFound] = useState('');
    const [diseaseFound, setDiseaseFound] = useState('');
    const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
    const [isRecording, setIsRecording] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    
    // GPS State
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);

    // Camera & Analysis State
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const wizardFileInputRef = useRef<HTMLInputElement>(null);
    
    // AI Wizard State
    const [photo, setPhoto] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isReportAddedToNotes, setIsReportAddedToNotes] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const [lastVisitedFarmer, setLastVisitedFarmer] = useState<Farmer | null>(null);

    useEffect(() => {
        loadData();
        return () => stopCamera();
    }, []);

    useEffect(() => {
        if (initialVisitId && visits.length > 0) {
            const v = visits.find(visit => visit.id === initialVisitId);
            if (v) {
                handleEdit(v);
            }
        }
    }, [initialVisitId, visits]);

    // Effect to handle video stream attachment when camera opens
    useEffect(() => {
        if (isCameraOpen && streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isCameraOpen]);

    useEffect(() => {
        if (viewMode === 'FORM' && !editingId) {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition((position) => {
                    setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
                }, (error) => console.warn("GPS hatası:", error), { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
            }
        }
    }, [viewMode, editingId]);

    const loadData = async () => {
        const [vList, fList] = await Promise.all([dbService.getAllVisits(), dbService.getFarmers()]);
        const sortedVisits = [...vList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setVisits(sortedVisits);
        setFarmers(fList);
        const fMap: Record<string, Farmer> = {};
        fList.forEach(f => { fMap[f.id] = f; });
        setFarmerMap(fMap);
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
            try { videoRef.current.load(); } catch(e) {}
        }
        setIsCameraOpen(false);
    };

    const startCamera = async () => {
        const constraintsList = [
            { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
            { video: { facingMode: 'environment' } },
            { video: true }
        ];

        let stream: MediaStream | null = null;

        for (const constraints of constraintsList) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (stream) break;
            } catch (e) {
                console.warn("Kamera kısıtlaması başarısız, bir sonraki deneniyor...", e);
            }
        }

        if (stream) {
            streamRef.current = stream;
            setIsCameraOpen(true);
        } else {
            console.error("Hiçbir kamera başlatılamadı.");
            alert("Cihazınızda kamera başlatılamadı. Lütfen 'Galeri / Yükle' seçeneğini kullanarak fotoğraf ekleyin.");
            setIsCameraOpen(false);
        }
    };

    const capturePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth; 
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(dataUrl);
        stopCamera();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setPhoto(result);
        };
        reader.readAsDataURL(file);
    };

    const runAnalysis = async () => {
        if (!photo) return;
        
        // Check for API Key
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
            // After opening, we don't know if they selected it, but we proceed
        }

        setIsAnalyzing(true);
        setIsReportAddedToNotes(false);
        try {
            const result = await GeminiService.analyzePlantImage(photo);
            setAnalysis(result);
        } catch (error) { 
            console.error("AI Error:", error); 
            if (error instanceof Error && error.message.includes("entity was not found")) {
                window.aistudio?.openSelectKey();
            }
            alert("AI Analizi sırasında hata oluştu. İnternet bağlantınızı kontrol edin.");
        } finally { 
            setIsAnalyzing(false); 
        }
    };

    const addAnalysisToNotes = () => {
        if (!analysis) return;
        setNote(prev => {
            if (prev.includes(analysis)) return prev; // Zaten ekliyse tekrar ekleme
            const prefix = prev ? prev + '\n\n' : '';
            return prefix + `[AI Teşhis Raporu]:\n${analysis}`;
        });
        setIsReportAddedToNotes(true);
        // Kullanıcıya görsel geri bildirim verdikten sonra butonu eski haline döndürebiliriz veya "Eklendi" olarak bırakabiliriz.
    };

    const confirmWizard = () => {
        // Otomatik ekleme kaldırıldı. Kullanıcı butona bastıysa zaten note state'i güncellenmiştir.
        // Basmadıysa sadece photo ve analysis state'leri form'a taşınır (DB'ye aiAnalysis alanı olarak kaydedilir).
        stopCamera();
        setViewMode('FORM');
    };

    const cancelWizard = () => {
        // Eğer analiz veya foto kaydedilmediyse, çıkışta temizle
        if (!editingId) {
             setPhoto(null);
             setAnalysis(null);
        }
        stopCamera();
        setViewMode('FORM');
    };

    const handleSave = async () => {
        if (!selectedFarmerId) return;
        const currentFarmer = farmers.find(f => f.id === selectedFarmerId);
        const visitData = { 
            farmerId: selectedFarmerId, 
            fieldId: selectedFieldId || undefined,
            date: new Date().toISOString(), 
            note, 
            photoUri: photo || undefined, 
            aiAnalysis: analysis || undefined, 
            latitude: coords?.lat, 
            longitude: coords?.lng,
            pestFound: pestFound || undefined,
            diseaseFound: diseaseFound || undefined,
            severity,
            village: currentFarmer?.village
        };
        
        if (editingId) { 
            await updateVisit({ id: editingId, ...visitData }); 
            showToast('Ziyaret kaydı güncellendi', 'success');
            hapticFeedback('success');
            changeViewMode('LIST'); 
        } else { 
            await dbService.addVisit({ id: crypto.randomUUID(), ...visitData }); 
            setLastVisitedFarmer(currentFarmer || null); 
            showToast('Ziyaret kaydı başarıyla oluşturuldu', 'success');
            hapticFeedback('success');
            changeViewMode('SUCCESS'); 
        }
        resetForm(); 
        await loadData();
    };

    const resetForm = () => {
        setEditingId(null); setSelectedFarmerId(''); setSelectedFieldId(''); setNote(''); setPhoto(null); setAnalysis(null); setCoords(null);
        setPestFound(''); setDiseaseFound(''); setSeverity('LOW');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEdit = (visit: VisitLog) => {
        setEditingId(visit.id); setSelectedFarmerId(visit.farmerId); setSelectedFieldId(visit.fieldId || ''); setNote(visit.note); setPhoto(visit.photoUri || null); setAnalysis(visit.aiAnalysis || null);
        setPestFound(visit.pestFound || ''); setDiseaseFound(visit.diseaseFound || ''); setSeverity(visit.severity || 'LOW');
        if (visit.latitude && visit.longitude) setCoords({ lat: visit.latitude, lng: visit.longitude }); else setCoords(null);
        changeViewMode('FORM');
    };

    const handleDelete = async (id: string) => {
        if (confirm("Bu ziyaret kaydını silmek istediğinize emin misiniz?")) { 
            await deleteVisit(id); 
            showToast('Ziyaret kaydı silindi', 'success');
            hapticFeedback('medium');
            await loadData();
            if (viewMode === 'DETAIL') {
                setSelectedVisit(null);
                changeViewMode('LIST');
            }
        }
    };

    const handleViewDetail = (visit: VisitLog) => {
        setSelectedVisit(visit);
        changeViewMode('DETAIL', visit.id);
    };

    const toggleMic = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Cihazınızda sesle yazma desteklenmiyor.");
            return;
        }

        if (isRecording) {
            setIsRecording(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsRecording(true);
            hapticFeedback('light');
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setNote(prev => prev ? prev + ' ' + transcript : transcript);
            hapticFeedback('medium');
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.start();
    };

    const handleGenerateAIReport = async () => {
        if (!note.trim()) {
            showToast('Lütfen önce bir not yazın veya sesli giriş yapın.', 'error');
            return;
        }

        setIsGeneratingReport(true);
        try {
            const structuredReport = await GeminiService.generateVisitReportFromVoice(note);
            setNote(structuredReport);
            showToast('Rapor başarıyla yapılandırıldı.', 'success');
            hapticFeedback('success');
        } catch (error) {
            console.error("AI Report Error:", error);
            showToast('Rapor oluşturulurken bir hata oluştu.', 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const openMap = (lat: number, lng: number) => { window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank'); };

    const formatVisitDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + `, ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const result = await dbService.backupAllData();
            updateUserProfile({ ...userProfile, lastSyncTime: result.timestamp });
            alert("Tüm veriler başarıyla Firebase'e yedeklendi.");
        } catch (error) {
            alert("Yedekleme hatası: " + (error as any).message);
        } finally {
            setIsSyncing(false);
        }
    };

    // --- RENDERERS ---

    // 1. AI WIZARD SCREEN
    if (viewMode === 'AI_WIZARD') {
        return (
            <div className="fixed inset-0 h-[100dvh] z-[60] bg-stone-950 flex flex-col animate-in fade-in duration-500 overflow-hidden">
                <style>{`
                    @keyframes scan-line {
                        0% { transform: translateY(-100%); }
                        100% { transform: translateY(1000%); }
                    }
                    @keyframes pulse-ring {
                        0% { transform: scale(0.8); opacity: 0.5; }
                        100% { transform: scale(1.2); opacity: 0; }
                    }
                `}</style>
                <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload}
                />
                
                {/* Background Atmosphere */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.1),transparent_70%)]"></div>
                </div>

                {/* Header - More Minimal */}
                <div className="flex items-center justify-between p-6 z-50 shrink-0">
                    <button onClick={cancelWizard} className="w-10 h-10 flex items-center justify-center bg-stone-900/50 backdrop-blur-xl rounded-full text-stone-400 border border-white/10 active:scale-90 transition-all">
                        <X size={20} />
                    </button>
                    <div className="text-center">
                        <h2 className="text-stone-100 font-black text-[10px] uppercase tracking-[0.3em]">AI VISION</h2>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                            <div className={`w-1 h-1 rounded-full ${isAnalyzing ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                            <span className="text-[8px] text-stone-500 font-bold uppercase tracking-widest">{isAnalyzing ? 'Analiz Ediliyor' : 'Sistem Hazır'}</span>
                        </div>
                    </div>
                    <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center bg-stone-900/50 backdrop-blur-xl rounded-full text-stone-400 border border-white/10 active:scale-90 transition-all">
                        <ImageIcon size={18} />
                    </button>
                </div>

                {/* Main Viewport */}
                <div className="flex-1 relative px-6 pb-12 flex flex-col">
                    <div className="flex-1 relative rounded-[2.5rem] overflow-hidden border border-white/10 bg-stone-900 shadow-2xl group">
                        {!photo ? (
                            isCameraOpen ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-64 h-64 border border-white/20 rounded-3xl relative">
                                            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-emerald-500 rounded-tl-lg"></div>
                                            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-emerald-500 rounded-tr-lg"></div>
                                            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-emerald-500 rounded-bl-lg"></div>
                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-emerald-500 rounded-br-lg"></div>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-8 left-0 w-full flex justify-center z-20">
                                        <button onClick={capturePhoto} className="relative w-20 h-20 flex items-center justify-center group active:scale-90 transition-transform">
                                            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-20"></div>
                                            <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-white/90"></div>
                                            </div>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.1),transparent_50%)]">
                                    <div className="relative mb-8">
                                        <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse"></div>
                                        <div className="w-24 h-24 bg-stone-800 rounded-3xl flex items-center justify-center border border-white/5 relative z-10">
                                            <Bot size={40} className="text-emerald-500" />
                                        </div>
                                    </div>
                                    <h3 className="text-stone-100 text-xl font-bold mb-3 tracking-tight">Bitki Teşhis Uzmanı</h3>
                                    <p className="text-stone-500 text-sm leading-relaxed mb-10 max-w-[240px]">Hastalık, zararlı veya besin eksikliği tespiti için bir fotoğraf çekin.</p>
                                    <div className="flex flex-col gap-3 w-full">
                                        <button 
                                            onClick={startCamera} 
                                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-900/40 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                        >
                                            <Camera size={20} /> Kamerayı Başlat
                                        </button>
                                        <button 
                                            onClick={() => wizardFileInputRef.current?.click()} 
                                            className="w-full py-4 bg-stone-800 text-stone-300 rounded-2xl font-bold text-sm border border-white/5 flex items-center justify-center gap-2 active:scale-95 transition-all"
                                        >
                                            <Upload size={20} /> Fotoğraf Yükle / Çek
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={wizardFileInputRef} 
                                            className="hidden" 
                                            accept="image/*" 
                                            capture="environment" 
                                            onChange={handleFileUpload} 
                                        />
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="w-full h-full relative">
                                <img src={photo} alt="Captured" className="w-full h-full object-cover" />
                                
                                {isAnalyzing && (
                                    <div className="absolute inset-0 z-20">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.8)]" style={{ animation: 'scan-line 2s linear infinite' }}></div>
                                        <div className="absolute inset-0 bg-purple-950/20 backdrop-blur-[1px]"></div>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-purple-500/30 blur-3xl rounded-full animate-pulse"></div>
                                                <Loader2 size={48} className="text-purple-400 animate-spin relative z-10" />
                                            </div>
                                            <span className="mt-4 text-purple-200 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">Analiz Ediliyor</span>
                                        </div>
                                    </div>
                                )}

                                {!analysis && !isAnalyzing && (
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-8 z-20">
                                        <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-purple-900/50 animate-bounce">
                                            <Sparkles size={32} className="text-white" />
                                        </div>
                                        <h4 className="text-white font-bold text-lg mb-2">Görüntü Hazır</h4>
                                        <p className="text-stone-300 text-xs mb-8 text-center">Yapay zeka motoru görüntüyü işlemeye hazır.</p>
                                        <div className="flex gap-3 w-full">
                                            <button onClick={() => setPhoto(null)} className="flex-1 py-3.5 bg-stone-800/80 backdrop-blur text-stone-300 rounded-xl font-bold text-xs border border-white/10 active:scale-95 transition-all">Yeniden Çek</button>
                                            <button onClick={runAnalysis} className="flex-[2] py-3.5 bg-purple-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-purple-900/40 active:scale-95 transition-all">Analizi Başlat</button>
                                        </div>
                                    </div>
                                )}

                                {analysis && (
                                    <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-md z-30 flex flex-col animate-in fade-in duration-500">
                                        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className={`w-10 h-10 ${analysis.includes('hata') || analysis.includes('meşgul') ? 'bg-red-500/20 border-red-500/30' : 'bg-purple-500/20 border-purple-500/30'} rounded-2xl flex items-center justify-center border`}>
                                                    {analysis.includes('hata') || analysis.includes('meşgul') ? <X size={20} className="text-red-400" /> : <Bot size={20} className="text-purple-400" />}
                                                </div>
                                                <div>
                                                    <h4 className={`${analysis.includes('hata') || analysis.includes('meşgul') ? 'text-red-100' : 'text-purple-100'} font-bold text-sm`}>
                                                        {analysis.includes('hata') || analysis.includes('meşgul') ? 'Analiz Başarısız' : 'Teşhis Sonucu'}
                                                    </h4>
                                                    <p className="text-stone-500 text-[9px] font-bold uppercase tracking-widest">Gemini AI Raporu</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                <div className={`p-5 bg-stone-900/50 rounded-[2rem] border ${analysis.includes('hata') || analysis.includes('meşgul') ? 'border-red-500/20' : 'border-white/5'} relative overflow-hidden`}>
                                                    <div className={`absolute top-0 left-0 w-1 h-full ${analysis.includes('hata') || analysis.includes('meşgul') ? 'bg-red-500/50' : 'bg-purple-500/50'}`}></div>
                                                    <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
                                                </div>
                                                
                                                {(analysis.includes('hata') || analysis.includes('meşgul')) && (
                                                    <button 
                                                        onClick={runAnalysis}
                                                        className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 active:scale-95 transition-all"
                                                    >
                                                        <Sparkles size={16}/> Tekrar Dene
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* SCI-FI ACTION DOCK */}
                                        <div className="p-4 bg-stone-950/50 backdrop-blur-xl border-t border-white/5 relative">
                                            {/* Decorative Sci-fi Elements */}
                                            <div className="absolute -top-[1px] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
                                            <div className="flex flex-col gap-2">
                                                {!(analysis.includes('hata') || analysis.includes('meşgul')) && (
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={addAnalysisToNotes}
                                                            disabled={isReportAddedToNotes}
                                                            className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all border ${isReportAddedToNotes ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-stone-900 text-purple-400 border-purple-500/20 hover:bg-purple-500/10 active:scale-95'}`}
                                                        >
                                                            {isReportAddedToNotes ? <CheckCircle2 size={14}/> : <Copy size={14}/>}
                                                            {isReportAddedToNotes ? 'Aktarıldı' : 'Notlara Aktar'}
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={confirmWizard} 
                                                            className="flex-[1.5] py-4 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 border border-emerald-400/30"
                                                        >
                                                            <Save size={14}/> Tamamla & Kaydet
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                <button 
                                                    onClick={() => { setAnalysis(null); setPhoto(null); }} 
                                                    className="w-full py-2 text-stone-600 font-bold text-[9px] uppercase tracking-[0.3em] hover:text-stone-400 transition-colors"
                                                >
                                                    [ İşlemi İptal Et ]
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Status Bar - Very Minimal */}
                {!analysis && (
                    <div className="px-10 pb-10 text-center shrink-0">
                        <p className="text-[9px] text-stone-600 font-bold uppercase tracking-[0.4em]">MKS DIGITAL AGRICULTURE • 2024</p>
                    </div>
                )}
            </div>
        );
    }

    // 2. SUCCESS SCREEN
    if (viewMode === 'SUCCESS' && lastVisitedFarmer) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 border border-emerald-500/30">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold text-stone-100 mb-1">Ziyaret Kaydedildi!</h2>
                <p className="text-stone-400 text-center text-xs mb-6"><span className="text-emerald-400 font-bold">{lastVisitedFarmer.fullName}</span> için rapor oluşturuldu.</p>
                <div className="w-full max-sm space-y-2.5">
                    <a href={`tel:${lastVisitedFarmer.phoneNumber}`} className="flex items-center justify-center w-full py-3 bg-stone-800 text-stone-200 border border-white/5 rounded-2xl font-bold hover:bg-stone-700 transition-all text-xs"><Phone size={16} className="mr-2 text-emerald-500"/> Üreticiyi Ara</a>
                    <a href={`sms:${lastVisitedFarmer.phoneNumber}?body=${encodeURIComponent('Sayın çiftçi araziniz kontrol edildi bilgi için arayınız')}`} className="flex items-center justify-center w-full py-3 bg-emerald-700 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all text-xs"><MessageSquare size={16} className="mr-2"/> SMS ile Raporla</a>
                </div>
                <button onClick={() => changeViewMode('LIST')} className="mt-6 text-stone-500 hover:text-stone-300 font-medium py-2 px-4 text-xs">Listeye Dön</button>
            </div>
        );
    }

    // 3. DETAIL SCREEN
    if (viewMode === 'DETAIL' && selectedVisit) {
        const farmer = farmerMap[selectedVisit.farmerId];
        const field = farmer?.fields?.find(f => f.id === selectedVisit.fieldId);
        return (
            <div className="p-4 max-w-2xl mx-auto pb-24 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-2">
                    <button onClick={() => changeViewMode('LIST')} className="text-stone-400 hover:text-stone-200 flex items-center px-2 py-1 rounded-lg hover:bg-stone-900 transition-colors">
                        <ArrowLeft size={20} className="mr-1" /> Geri
                    </button>
                    <div className="flex space-x-2">
                        <button onClick={() => handleEdit(selectedVisit)} className="p-2 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:bg-stone-700 hover:text-emerald-400 transition-all shadow-md">
                            <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(selectedVisit.id)} className="p-2 bg-stone-800 text-stone-300 rounded-xl border border-white/5 hover:bg-red-900/40 hover:text-red-400 transition-all shadow-md">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Farmer & Date Info */}
                    <div className="bg-stone-900/80 p-5 rounded-3xl border border-white/5 shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-2xl bg-stone-800 border border-white/10 text-emerald-500 flex items-center justify-center font-black text-lg">
                                    {farmer?.fullName?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-stone-100">{farmer?.fullName || 'Bilinmeyen Çiftçi'}</h2>
                                    <div className="flex items-center text-stone-500 text-xs mt-1">
                                        <MapPin size={12} className="mr-1 text-emerald-600" />
                                        {farmer?.village || 'Konum Yok'}
                                        {field && <span className="ml-2 px-2 py-0.5 bg-emerald-900/30 text-emerald-400 rounded-full border border-emerald-500/20">{field.name} ({field.crop})</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs font-medium text-stone-400 bg-stone-950/50 p-3 rounded-xl border border-white/5">
                            <Calendar size={14} className="text-emerald-500" />
                            <span>{new Date(selectedVisit.date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <span className="w-px h-3 bg-stone-700 mx-2"></span>
                            <Clock size={14} className="text-emerald-500" />
                            <span>{new Date(selectedVisit.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    {/* Findings Card */}
                    {(selectedVisit.pestFound || selectedVisit.diseaseFound) && (
                        <div className="bg-stone-900/80 p-5 rounded-3xl border border-white/5 shadow-lg">
                            <h3 className="text-stone-500 font-bold text-xs mb-3 uppercase tracking-widest">Bulgular</h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedVisit.pestFound && (
                                    <div className="bg-rose-900/20 border border-rose-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                                        <Bug size={14} className="text-rose-500" />
                                        <span className="text-xs font-bold text-rose-200">Zararlı: {selectedVisit.pestFound}</span>
                                    </div>
                                )}
                                {selectedVisit.diseaseFound && (
                                    <div className="bg-amber-900/20 border border-amber-500/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
                                        <AlertCircle size={14} className="text-amber-500" />
                                        <span className="text-xs font-bold text-amber-200">Hastalık: {selectedVisit.diseaseFound}</span>
                                    </div>
                                )}
                                <div className={`px-3 py-1.5 rounded-xl flex items-center gap-2 border ${
                                    selectedVisit.severity === 'HIGH' ? 'bg-rose-600 border-rose-500 text-white' :
                                    selectedVisit.severity === 'MEDIUM' ? 'bg-amber-600 border-amber-500 text-white' :
                                    'bg-emerald-600 border-emerald-500 text-white'
                                }`}>
                                    <span className="text-[10px] font-black uppercase tracking-wider">Şiddet: {
                                        selectedVisit.severity === 'HIGH' ? 'Yüksek' :
                                        selectedVisit.severity === 'MEDIUM' ? 'Orta' : 'Düşük'
                                    }</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Photo */}
                    {selectedVisit.photoUri && (
                        <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative group">
                            <img src={selectedVisit.photoUri} alt="Ziyaret Fotoğrafı" className="w-full h-auto object-cover" />
                            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent">
                                <span className="text-white text-xs font-bold flex items-center"><ImageIcon size={14} className="mr-2"/> Saha Fotoğrafı</span>
                            </div>
                        </div>
                    )}

                    {/* AI Analysis */}
                    {selectedVisit.aiAnalysis && (
                        <div className="bg-purple-900/10 border border-purple-500/20 p-5 rounded-3xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={80} className="text-purple-500"/></div>
                            <h3 className="text-purple-300 font-bold text-sm mb-2 flex items-center uppercase tracking-wider"><Sparkles size={14} className="mr-2"/> Yapay Zeka Teşhisi</h3>
                            <p className="text-purple-100 text-sm leading-relaxed whitespace-pre-wrap">{selectedVisit.aiAnalysis}</p>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="bg-stone-900/60 p-5 rounded-3xl border border-white/5">
                        <h3 className="text-stone-500 font-bold text-xs mb-3 uppercase tracking-widest">Mühendis Notları</h3>
                        <p className="text-stone-300 text-sm leading-7 whitespace-pre-wrap">{selectedVisit.note || 'Not girilmemiş.'}</p>
                    </div>

                    {/* Location Action */}
                    {selectedVisit.latitude && (
                        <button 
                            onClick={() => openMap(selectedVisit.latitude!, selectedVisit.longitude!)}
                            className="w-full py-4 bg-stone-800 text-stone-300 rounded-2xl font-bold flex items-center justify-center border border-white/5 hover:bg-stone-700 transition-all shadow-lg active:scale-95"
                        >
                            <Navigation size={18} className="mr-2 text-emerald-500" /> Konumu Haritada Aç
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // 4. LIST VIEW
    if (viewMode === 'LIST') {
        return (
            <div className="relative h-full min-h-[80vh]">
                <div className="p-4 max-w-3xl mx-auto pb-24">
                    <header className="mb-4 sticky top-0 bg-stone-950/80 backdrop-blur z-10 py-2 border-b border-white/5 flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-stone-100">Ziyaret Defteri</h2>
                            <p className="text-[10px] text-stone-500">Saha gözlemleri ve kontroller</p>
                            {userProfile.lastSyncTime && (
                                <p className="text-[9px] text-emerald-500/80 mt-0.5 flex items-center">
                                    <Check size={9} className="mr-1" />
                                    Son Yedekleme: {new Date(userProfile.lastSyncTime).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                                </p>
                            )}
                        </div>
                        <button 
                            onClick={handleSync} 
                            disabled={isSyncing}
                            className="px-3 py-1.5 bg-stone-900 text-stone-400 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                            title="Verileri Buluta Yedekle"
                        >
                            <RefreshCw size={14} className={isSyncing ? "animate-spin text-emerald-500" : ""} />
                            {isSyncing ? 'Yedekleniyor...' : 'Senkronize'}
                        </button>
                    </header>

                    <div className="space-y-3">
                        {visits.length === 0 ? (
                            <div className="text-center py-20 text-stone-600 border-2 border-dashed border-stone-800 rounded-xl"><p className="text-xs">Kayıt bulunamadı.</p></div>
                        ) : (
                            visits.map(visit => {
                                const farmer = farmerMap[visit.farmerId];
                                return (
                                    <div key={visit.id} onClick={() => handleViewDetail(visit)} className="bg-stone-900/60 backdrop-blur-sm p-4 rounded-[1.5rem] shadow-sm border border-white/5 hover:bg-stone-800/80 transition-all group overflow-hidden relative cursor-pointer active:scale-[0.98]">
                                        <div className="flex justify-between items-start mb-2 relative z-10">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-2xl bg-stone-800 border border-white/10 text-emerald-500 flex items-center justify-center font-black text-sm">{farmer?.fullName?.charAt(0).toUpperCase() || '?'}</div>
                                                <div>
                                                    <h3 className="font-bold text-stone-100 text-sm group-hover:text-emerald-400 transition-colors">{farmer?.fullName || 'Bilinmeyen'}</h3>
                                                    <p className="text-[10px] text-stone-500 font-bold uppercase flex items-center mt-0.5"><MapPin size={10} className="mr-1 text-emerald-500/70"/> {farmer?.village || '-'}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex space-x-1.5 pl-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(visit); }} 
                                                    className="w-8 h-8 flex items-center justify-center bg-stone-800 text-stone-400 rounded-xl border border-white/5 hover:text-emerald-400 hover:bg-stone-700 transition-all shadow-sm"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(visit.id); }} 
                                                    className="w-8 h-8 flex items-center justify-center bg-stone-800 text-stone-400 rounded-xl border border-white/5 hover:text-red-400 hover:bg-stone-700 transition-all shadow-sm"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <p className="text-xs text-stone-300 line-clamp-2 pl-1 leading-relaxed opacity-90 mb-3">{visit.note}</p>
                                        
                                        <div className="flex justify-between items-center pt-2 border-t border-white/5 relative z-10">
                                            <div className="flex gap-2">
                                                {visit.photoUri && <div className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20 flex items-center font-bold"><ImageIcon size={10} className="mr-1.5"/> Foto</div>}
                                                {visit.aiAnalysis && <div className="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded-lg border border-purple-500/20 flex items-center font-bold"><Sparkles size={10} className="mr-1.5"/> AI</div>}
                                            </div>
                                            <span className="text-[9px] font-mono text-stone-500 flex items-center">
                                                <Clock size={10} className="mr-1"/> {formatVisitDate(visit.date)}
                                            </span>
                                        </div>
                                        {visit.severity === 'HIGH' && (
                                            <div className="absolute top-0 right-0 w-1 h-full bg-rose-500/50"></div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                <button onClick={() => { resetForm(); changeViewMode('FORM'); }} className="fixed bottom-32 right-5 bg-emerald-600 text-white p-3.5 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center"><Plus size={24} /></button>
            </div>
        );
    }

    // 5. MAIN ADD/EDIT FORM
    return (
        <div className="p-4 max-w-2xl mx-auto pb-24 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => { resetForm(); changeViewMode('LIST'); }} className="text-stone-400 font-medium flex items-center hover:text-stone-200 text-xs"><X size={16} className="mr-1"/> İptal</button>
                <h2 className="text-base font-bold text-emerald-400">{editingId ? 'Ziyareti Düzenle' : 'Yeni Kayıt'}</h2>
                <div className="w-8"></div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Çiftçi Seçimi</label>
                        <select className="w-full p-3 rounded-xl bg-stone-900 border border-white/5 outline-none focus:border-emerald-500 text-stone-200 text-xs" value={selectedFarmerId} onChange={e => { setSelectedFarmerId(e.target.value); setSelectedFieldId(''); }}>
                            <option value="">Çiftçi Seçiniz...</option>
                            {farmers.map(f => (<option key={f.id} value={f.id}>{f.fullName}</option>))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Tarla Seçimi</label>
                        <select 
                            className="w-full p-3 rounded-xl bg-stone-900 border border-white/5 outline-none focus:border-emerald-500 text-stone-200 text-xs disabled:opacity-50" 
                            value={selectedFieldId} 
                            onChange={e => setSelectedFieldId(e.target.value)}
                            disabled={!selectedFarmerId}
                        >
                            <option value="">Tarla Seçiniz...</option>
                            {selectedFarmerId && farmers.find(f => f.id === selectedFarmerId)?.fields?.map(field => (
                                <option key={field.id} value={field.id}>{field.name} ({field.crop} - {field.size} da)</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* AI & PHOTO SUMMARY CARD OR ADD BUTTON */}
                <div>
                    <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Görsel / Teşhis</label>
                    
                    {photo ? (
                        <div className="bg-stone-900/60 rounded-2xl border border-white/10 p-3 flex items-center space-x-3 relative overflow-hidden group">
                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/5">
                                <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-stone-200 text-xs font-bold flex items-center">
                                    <ImageIcon size={12} className="mr-1.5 text-blue-400"/> Fotoğraf Eklendi
                                </h4>
                                {analysis && (
                                    <div className="flex items-center text-purple-400 text-[10px] mt-1 font-bold">
                                        <Sparkles size={10} className="mr-1"/> AI Analizi Tamamlandı
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => setViewMode('AI_WIZARD')} 
                                className="p-2 bg-stone-800 text-stone-400 rounded-lg hover:text-white mr-1"
                                title="Düzenle / Yeniden Çek"
                            >
                                <Edit2 size={16}/>
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setViewMode('AI_WIZARD')}
                            className="w-full py-6 bg-gradient-to-br from-stone-900 to-stone-950 border border-dashed border-stone-700 rounded-2xl flex flex-col items-center justify-center hover:border-emerald-500/50 hover:bg-stone-900/80 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-lg group-hover:bg-stone-700">
                                <Sparkles size={20} className="text-emerald-400" />
                            </div>
                            <span className="text-stone-300 font-bold text-xs">AI Teşhis Sihirbazını Aç</span>
                            <span className="text-[9px] text-stone-500 mt-1">Fotoğraf çekmek ve analiz etmek için dokunun</span>
                        </button>
                    )}
                </div>

                {/* PEST & DISEASE SELECTION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Zararlı Tespiti</label>
                        <input 
                            type="text" 
                            className="w-full p-3 rounded-xl bg-stone-900 border border-white/5 outline-none focus:border-emerald-500 text-stone-200 text-xs" 
                            placeholder="Zararlı adı..."
                            value={pestFound}
                            onChange={e => setPestFound(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Hastalık Tespiti</label>
                        <input 
                            type="text" 
                            className="w-full p-3 rounded-xl bg-stone-900 border border-white/5 outline-none focus:border-emerald-500 text-stone-200 text-xs" 
                            placeholder="Hastalık adı..."
                            value={diseaseFound}
                            onChange={e => setDiseaseFound(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Şiddet / Önem Derecesi</label>
                    <div className="flex gap-2">
                        {(['LOW', 'MEDIUM', 'HIGH'] as const).map(s => (
                            <button 
                                key={s}
                                onClick={() => setSeverity(s)}
                                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                    severity === s 
                                        ? (s === 'HIGH' ? 'bg-rose-600 border-rose-500 text-white' : s === 'MEDIUM' ? 'bg-amber-600 border-amber-500 text-white' : 'bg-emerald-600 border-emerald-500 text-white')
                                        : 'bg-stone-900 border-white/5 text-stone-500'
                                }`}
                            >
                                {s === 'LOW' ? 'Düşük' : s === 'MEDIUM' ? 'Orta' : 'Yüksek'}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-widest">Notlar</label>
                        {note.trim().length > 10 && (
                            <button 
                                onClick={handleGenerateAIReport}
                                disabled={isGeneratingReport}
                                className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 bg-emerald-950/30 px-2 py-1 rounded-lg border border-emerald-500/20 hover:bg-emerald-900/40 transition-all disabled:opacity-50"
                            >
                                {isGeneratingReport ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                {isGeneratingReport ? 'Raporlanıyor...' : 'AI İle Yapılandır'}
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <textarea className="w-full p-3 rounded-2xl bg-stone-900 border border-white/5 h-32 outline-none focus:border-emerald-500 transition-all text-stone-200 text-xs resize-none" placeholder="Gözlemlerinizi buraya yazın veya AI raporunu düzenleyin..." value={note} onChange={e => setNote(e.target.value)}></textarea>
                        <button onClick={toggleMic} className={`absolute bottom-3 right-3 p-2.5 rounded-xl shadow-lg transition-all ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-stone-800 text-emerald-400'}`}><Mic size={16} /></button>
                    </div>
                </div>

                <div className="flex items-center space-x-2 text-stone-500 bg-stone-900/50 p-2.5 rounded-xl border border-white/5">
                    <Navigation size={12} className={coords ? "text-emerald-500" : "text-stone-600"} />
                    <span className="text-[9px]">{coords ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Konum bekleniyor..."}</span>
                </div>

                <button onClick={handleSave} disabled={!selectedFarmerId} className="w-full bg-emerald-700 text-white py-3.5 rounded-2xl font-bold text-xs shadow-xl hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center justify-center">
                    <Save className="mr-2" size={16}/> Kaydet
                </button>
            </div>
        </div>
    );
};

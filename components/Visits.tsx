
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, Save, X, Plus, Calendar, User, MapPin, ChevronRight, Image as ImageIcon, CheckCircle2, Phone, MessageSquare, ArrowLeft, Loader2, Navigation, Clock, Sparkles, ImagePlus, Edit2, Trash2, Share2, Upload, Check, ChevronDown, Copy, FileText } from 'lucide-react';
import { dbService } from '../services/db';
import { GeminiService } from '../services/gemini';
import { Farmer, VisitLog } from '../types';
import { useAppViewModel } from '../context/AppContext';

interface VisitsProps {
    onBack: () => void;
}

export const VisitLogForm: React.FC<VisitsProps> = ({ onBack }) => {
    const { userProfile, updateVisit, deleteVisit } = useAppViewModel();
    // Yeni mod eklendi: 'AI_WIZARD'
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'SUCCESS' | 'DETAIL' | 'AI_WIZARD'>('LIST');

    const [visits, setVisits] = useState<VisitLog[]>([]);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [farmerMap, setFarmerMap] = useState<Record<string, Farmer>>({});

    // Selected Visit for Detail View
    const [selectedVisit, setSelectedVisit] = useState<VisitLog | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedFarmerId, setSelectedFarmerId] = useState('');
    const [note, setNote] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    
    // GPS State
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);

    // Camera & Analysis State
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // AI Wizard State
    const [photo, setPhoto] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isReportAddedToNotes, setIsReportAddedToNotes] = useState(false);

    const [lastVisitedFarmer, setLastVisitedFarmer] = useState<Farmer | null>(null);

    useEffect(() => {
        loadData();
        return () => stopCamera();
    }, []);

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
        setIsCameraOpen(true);
        
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
            if (videoRef.current) videoRef.current.srcObject = stream;
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
        setIsAnalyzing(true);
        setIsReportAddedToNotes(false);
        try {
            const result = await GeminiService.analyzePlantImage(photo);
            setAnalysis(result);
        } catch (error) { 
            console.error("AI Error:", error); 
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
        const visitData = { farmerId: selectedFarmerId, date: new Date().toISOString(), note, photoUri: photo || undefined, aiAnalysis: analysis || undefined, latitude: coords?.lat, longitude: coords?.lng };
        
        if (editingId) { 
            await updateVisit({ id: editingId, ...visitData }); 
            setViewMode('LIST'); 
        } else { 
            await dbService.addVisit({ id: crypto.randomUUID(), ...visitData }); 
            setLastVisitedFarmer(currentFarmer || null); 
            setViewMode('SUCCESS'); 
        }
        resetForm(); 
        await loadData();
    };

    const resetForm = () => {
        setEditingId(null); setSelectedFarmerId(''); setNote(''); setPhoto(null); setAnalysis(null); setCoords(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEdit = (visit: VisitLog) => {
        setEditingId(visit.id); setSelectedFarmerId(visit.farmerId); setNote(visit.note); setPhoto(visit.photoUri || null); setAnalysis(visit.aiAnalysis || null);
        if (visit.latitude && visit.longitude) setCoords({ lat: visit.latitude, lng: visit.longitude }); else setCoords(null);
        setViewMode('FORM');
    };

    const handleDelete = async (id: string) => {
        if (confirm("Bu ziyaret kaydını silmek istediğinize emin misiniz?")) { 
            await deleteVisit(id); 
            await loadData();
            if (viewMode === 'DETAIL') {
                setSelectedVisit(null);
                setViewMode('LIST');
            }
        }
    };

    const handleViewDetail = (visit: VisitLog) => {
        setSelectedVisit(visit);
        setViewMode('DETAIL');
    };

    const toggleMic = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { alert("Cihazınızda sesle yazma desteklenmiyor."); return; }
        setIsRecording(!isRecording);
        if (!isRecording) { setTimeout(() => { setNote(prev => prev + " Arazide kontrol yapıldı."); setIsRecording(false); }, 1500); }
    };

    const openMap = (lat: number, lng: number) => { window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank'); };

    const formatVisitDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + `, ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    };

    // --- RENDERERS ---

    // 1. AI WIZARD SCREEN
    if (viewMode === 'AI_WIZARD') {
        return (
            <div className="fixed inset-0 z-[60] bg-stone-950 flex flex-col animate-in slide-in-from-bottom duration-300">
                <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload}
                />
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-stone-900/50 backdrop-blur border-b border-white/5 shrink-0">
                    <button onClick={cancelWizard} className="p-2 bg-stone-800 rounded-full text-stone-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col items-center">
                        <h2 className="text-stone-100 font-bold text-sm">AI Teşhis Sihirbazı</h2>
                        <span className="text-[10px] text-stone-500">Fotoğraf Çek & Analiz Et</span>
                    </div>
                    <div className="w-9"></div> {/* Spacer */}
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center pb-32">
                    
                    {/* CAMERA / IMAGE AREA */}
                    <div className="w-full max-w-md aspect-[3/4] bg-black rounded-3xl overflow-hidden relative shadow-2xl border border-stone-800 mb-6 group shrink-0">
                        {!photo ? (
                            isCameraOpen ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                                    <div className="absolute bottom-6 left-0 w-full flex justify-center items-center gap-6 z-20">
                                         <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-stone-900/60 backdrop-blur rounded-full text-stone-300 hover:text-white border border-white/10"><ImagePlus size={24}/></button>
                                         <button onClick={capturePhoto} className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center bg-white/20 hover:scale-105 transition-transform"><div className="w-12 h-12 rounded-full bg-white"></div></button>
                                         <button onClick={stopCamera} className="p-3 bg-red-900/60 backdrop-blur rounded-full text-white border border-white/10"><X size={24}/></button>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900">
                                    <Sparkles size={48} className="text-stone-700 mb-4" />
                                    <p className="text-stone-500 text-xs mb-6 text-center px-8">Bitki hastalığını veya zararlıyı tespit etmek için fotoğraf yükleyin.</p>
                                    <div className="flex gap-3">
                                        <button onClick={startCamera} className="px-5 py-3 bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center shadow-lg hover:bg-emerald-600 transition-all"><Camera size={16} className="mr-2"/> Kamera Aç</button>
                                        <button onClick={() => fileInputRef.current?.click()} className="px-5 py-3 bg-stone-800 text-stone-300 rounded-xl font-bold text-xs flex items-center border border-white/5 hover:bg-stone-700 transition-all"><Upload size={16} className="mr-2"/> Galeri</button>
                                    </div>
                                </div>
                            )
                        ) : (
                            <>
                                <img src={photo} alt="Analiz" className="w-full h-full object-cover" />
                                <div className="absolute top-3 right-3 flex gap-2 z-20">
                                     <button onClick={() => { setPhoto(null); setAnalysis(null); setIsReportAddedToNotes(false); }} className="p-2 bg-black/60 text-white rounded-full backdrop-blur"><Trash2 size={16}/></button>
                                </div>
                                {!analysis && !isAnalyzing && (
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-6 z-20">
                                        <button onClick={runAnalysis} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold shadow-xl shadow-purple-900/40 hover:bg-purple-500 transition-all flex items-center justify-center animate-in slide-in-from-bottom-4">
                                            <Sparkles size={20} className="mr-2"/> Analizi Başlat
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        {isAnalyzing && (
                            <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                                <Loader2 size={48} className="text-purple-500 animate-spin mb-4" />
                                <p className="text-purple-200 font-bold text-lg animate-pulse">Teşhis Ediliyor...</p>
                                <p className="text-purple-400/60 text-xs mt-2">Gemini AI görüntüleri işliyor</p>
                            </div>
                        )}
                    </div>

                    {/* ANALYSIS RESULT AREA */}
                    {analysis && (
                        <div className="w-full max-w-md animate-in slide-in-from-bottom duration-500">
                            <div className="bg-stone-900/80 border border-purple-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                                
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-purple-300 font-bold text-sm flex items-center uppercase tracking-wider">
                                        <Sparkles size={14} className="mr-2 text-purple-500"/> AI Raporu
                                    </h3>
                                    
                                    <button 
                                        onClick={addAnalysisToNotes}
                                        disabled={isReportAddedToNotes}
                                        className={`flex items-center text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${isReportAddedToNotes ? 'bg-emerald-900/50 text-emerald-400 cursor-default' : 'bg-purple-900/40 text-purple-200 hover:bg-purple-800/60'}`}
                                    >
                                        {isReportAddedToNotes ? <Check size={12} className="mr-1"/> : <Copy size={12} className="mr-1"/>}
                                        {isReportAddedToNotes ? 'Eklendi' : 'Notlara Ekle'}
                                    </button>
                                </div>

                                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                    <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">{analysis}</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* BOTTOM ACTION BAR - Fixed to bottom */}
                <div className="w-full p-4 bg-stone-900 border-t border-white/5 pb-10 flex gap-3 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] shrink-0 mt-auto">
                     <button onClick={cancelWizard} className="flex-1 py-4 rounded-xl font-bold text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 transition-all border border-white/5">
                         İptal
                     </button>
                     <button 
                        onClick={confirmWizard} 
                        disabled={!photo}
                        className="flex-[2] py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center border border-emerald-500/20"
                     >
                         <CheckCircle2 size={18} className="mr-2"/> 
                         {analysis ? 'Tamamla' : 'Fotoğrafı Ekle'}
                     </button>
                </div>
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
                    <a href={`sms:${lastVisitedFarmer.phoneNumber}?body=Rapor`} className="flex items-center justify-center w-full py-3 bg-emerald-700 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all text-xs"><MessageSquare size={16} className="mr-2"/> SMS ile Raporla</a>
                </div>
                <button onClick={() => setViewMode('LIST')} className="mt-6 text-stone-500 hover:text-stone-300 font-medium py-2 px-4 text-xs">Listeye Dön</button>
            </div>
        );
    }

    // 3. DETAIL SCREEN
    if (viewMode === 'DETAIL' && selectedVisit) {
        const farmer = farmerMap[selectedVisit.farmerId];
        return (
            <div className="p-4 max-w-2xl mx-auto pb-24 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-stone-950/90 backdrop-blur z-20 py-2">
                    <button onClick={() => setViewMode('LIST')} className="text-stone-400 hover:text-stone-200 flex items-center px-2 py-1 rounded-lg hover:bg-stone-900 transition-colors">
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
                        </div>
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
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                <button onClick={() => { resetForm(); setViewMode('FORM'); }} className="fixed bottom-32 right-5 bg-emerald-600 text-white p-3.5 rounded-full shadow-lg shadow-emerald-900/50 hover:bg-emerald-500 transition-all transform hover:scale-105 z-50 flex items-center justify-center"><Plus size={24} /></button>
            </div>
        );
    }

    // 5. MAIN ADD/EDIT FORM
    return (
        <div className="p-4 max-w-2xl mx-auto pb-24 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between mb-4">
                <button onClick={() => { resetForm(); setViewMode('LIST'); }} className="text-stone-400 font-medium flex items-center hover:text-stone-200 text-xs"><X size={16} className="mr-1"/> İptal</button>
                <h2 className="text-base font-bold text-emerald-400">{editingId ? 'Ziyareti Düzenle' : 'Yeni Kayıt'}</h2>
                <div className="w-8"></div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Çiftçi Seçimi</label>
                    <select className="w-full p-3 rounded-xl bg-stone-900 border border-white/5 outline-none focus:border-emerald-500 text-stone-200 text-xs" value={selectedFarmerId} onChange={e => setSelectedFarmerId(e.target.value)}>
                        <option value="">Çiftçi Seçiniz...</option>
                        {farmers.map(f => (<option key={f.id} value={f.id}>{f.fullName}</option>))}
                    </select>
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

                <div>
                    <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Notlar</label>
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

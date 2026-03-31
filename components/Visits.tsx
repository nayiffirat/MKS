
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Save, X, Plus, Calendar, User, MapPin, ChevronRight, Image as ImageIcon, CheckCircle2, Phone, MessageSquare, ArrowLeft, Loader2, Navigation, Clock, ImagePlus, Edit2, Trash2, Share2, Upload, Check, ChevronDown, Copy, FileText, RefreshCw, Bug, AlertCircle } from 'lucide-react';
import { dbService } from '../services/db';
import { Farmer, VisitLog } from '../types';
import { useAppViewModel } from '../context/AppContext';

interface VisitsProps {
    onBack: () => void;
    initialVisitId?: string;
}

export const VisitLogForm: React.FC<VisitsProps> = ({ onBack, initialVisitId }) => {
    const { userProfile, updateVisit, softDeleteVisit, updateUserProfile, showToast, hapticFeedback } = useAppViewModel();
    const isCompany = userProfile.accountType === 'COMPANY';
    const farmerLabel = isCompany ? 'Bayi' : 'Çiftçi';
    const farmerPluralLabel = isCompany ? 'Bayiler' : 'Çiftçiler';
    // Yeni mod eklendi: 'DETAIL'
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'SUCCESS' | 'DETAIL' | 'QUICK_VISIT'>('LIST');

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

                if (state.modal === 'CAMERA') {
                    startCamera();
                } else {
                    stopCamera();
                }
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, [visits]);

    const toggleCamera = (open: boolean) => {
        if (open === isCameraOpen) return;
        if (open) {
            window.history.pushState({ ...window.history.state, modal: 'CAMERA' }, '');
            startCamera();
        } else if (window.history.state?.modal === 'CAMERA') {
            window.history.back();
            return;
        } else {
            stopCamera();
        }
    };
    const changeViewMode = (mode: 'LIST' | 'FORM' | 'SUCCESS' | 'DETAIL' | 'QUICK_VISIT', detailId?: string) => {
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
    
    // GPS State
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);

    // Camera & Analysis State
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const wizardFileInputRef = useRef<HTMLInputElement>(null);
    
    const [photo, setPhoto] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
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

    const handleSave = async () => {
        if (!selectedFarmerId) return;
        const currentFarmer = farmers.find(f => f.id === selectedFarmerId);
        const visitData = { 
            farmerId: selectedFarmerId, 
            fieldId: selectedFieldId || undefined,
            date: new Date().toISOString(), 
            note, 
            photoUri: photo || undefined, 
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
        setEditingId(null); setSelectedFarmerId(''); setSelectedFieldId(''); setNote(''); setPhoto(null); setCoords(null);
        setPestFound(''); setDiseaseFound(''); setSeverity('LOW');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEdit = (visit: VisitLog) => {
        setEditingId(visit.id); setSelectedFarmerId(visit.farmerId); setSelectedFieldId(visit.fieldId || ''); setNote(visit.note); setPhoto(visit.photoUri || null);
        setPestFound(visit.pestFound || ''); setDiseaseFound(visit.diseaseFound || ''); setSeverity(visit.severity || 'LOW');
        if (visit.latitude && visit.longitude) setCoords({ lat: visit.latitude, lng: visit.longitude }); else setCoords(null);
        changeViewMode('FORM');
    };

    const handleDelete = async (id: string) => {
        if (confirm("Bu ziyaret kaydını silmek istediğinize emin misiniz?")) { 
            await softDeleteVisit(id); 
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

    // 1. SUCCESS SCREEN
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
                                    <h2 className="text-xl font-bold text-stone-100">{farmer?.fullName || `Bilinmeyen ${farmerLabel}`}</h2>
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
                        <button 
                            onClick={() => changeViewMode('QUICK_VISIT')}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl border border-emerald-500/20 hover:bg-emerald-500 transition-all active:scale-95 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                        >
                            <Plus size={14} /> Hızlı Ziyaret
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

    // 5. QUICK VISIT VIEW
    if (viewMode === 'QUICK_VISIT') {
        return (
            <div className="p-4 max-w-md mx-auto">
                <header className="mb-6 flex items-center justify-between">
                    <button onClick={() => changeViewMode('LIST')} className="p-2 text-stone-400"><ArrowLeft /></button>
                    <h2 className="text-lg font-bold text-stone-100">Hızlı Ziyaret</h2>
                    <div className="w-10"></div>
                </header>
                
                <div className="space-y-4">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-widest mb-1">{farmerLabel} Seçin</label>
                    <select 
                        value={selectedFarmerId}
                        onChange={(e) => setSelectedFarmerId(e.target.value)}
                        className="w-full bg-stone-900 border border-white/10 text-white p-4 rounded-2xl"
                    >
                        <option value="">Seçiniz...</option>
                        {farmers.map(f => <option key={f.id} value={f.id}>{f.fullName}</option>)}
                    </select>
                    
                    {selectedFarmerId && (
                        <button 
                            onClick={async () => {
                                await dbService.addVisit({
                                    id: crypto.randomUUID(),
                                    farmerId: selectedFarmerId,
                                    date: new Date().toISOString(),
                                    note: 'Hızlı ziyaret',
                                    severity: 'LOW',
                                    createdById: userProfile.id
                                });
                                showToast('Ziyaret kaydedildi', 'success');
                                changeViewMode('LIST');
                            }}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center hover:bg-emerald-500 transition-all active:scale-95"
                        >
                            <CheckCircle2 size={20} className="mr-2" /> Ziyaret Edildi
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // 6. MAIN ADD/EDIT FORM
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
                        <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">{farmerLabel} Seçimi</label>
                        <select className="w-full p-3 rounded-xl bg-stone-900 border border-white/5 outline-none focus:border-emerald-500 text-stone-200 text-xs" value={selectedFarmerId} onChange={e => { setSelectedFarmerId(e.target.value); setSelectedFieldId(''); }}>
                            <option value="">{farmerLabel} Seçiniz...</option>
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

                {/* PHOTO SUMMARY CARD OR ADD BUTTON */}
                <div>
                    <label className="block text-[9px] font-bold text-stone-500 mb-1.5 uppercase tracking-widest">Görsel</label>
                    
                    {photo ? (
                        <div className="bg-stone-900/60 rounded-2xl border border-white/10 p-3 flex items-center space-x-3 relative overflow-hidden group">
                            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/5">
                                <img src={photo} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-stone-200 text-xs font-bold flex items-center">
                                    <ImageIcon size={12} className="mr-1.5 text-blue-400"/> Fotoğraf Eklendi
                                </h4>
                            </div>
                            <button 
                                onClick={() => { setPhoto(null); startCamera(); }} 
                                className="p-2 bg-stone-800 text-stone-400 rounded-lg hover:text-white mr-1"
                                title="Yeniden Çek"
                            >
                                <RefreshCw size={16}/>
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={startCamera}
                            className="w-full py-6 bg-gradient-to-br from-stone-900 to-stone-950 border border-dashed border-stone-700 rounded-2xl flex flex-col items-center justify-center hover:border-emerald-500/50 hover:bg-stone-900/80 transition-all group"
                        >
                            <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform shadow-lg group-hover:bg-stone-700">
                                <Camera size={20} className="text-emerald-400" />
                            </div>
                            <span className="text-stone-300 font-bold text-xs">Fotoğraf Ekle</span>
                            <span className="text-[9px] text-stone-500 mt-1">Saha gözlemi için fotoğraf çekin</span>
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
                    </div>
                    <div className="relative">
                        <textarea className="w-full p-3 rounded-2xl bg-stone-900 border border-white/5 h-32 outline-none focus:border-emerald-500 transition-all text-stone-200 text-xs resize-none" placeholder="Gözlemlerinizi buraya yazın..." value={note} onChange={e => setNote(e.target.value)}></textarea>
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

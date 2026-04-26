import React, { useState, useRef, useMemo, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider } from '../services/firebase';
import { linkWithPopup, signInWithPopup, signInWithRedirect, linkWithRedirect, getRedirectResult } from 'firebase/auth';
import { Loader2, ChevronLeft, Camera, X, Sparkles, Image as ImageIcon, Search, AlertCircle, CheckCircle2, Check, Copy, UserPlus, Users } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/db';
import { Farmer } from '../types';

interface AiAssistantProps {
    onBack?: () => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ onBack }) => {
    const { currentUser } = useAuth();
    const { showToast, hapticFeedback, userProfile, inventory } = useAppViewModel();

    const isGoogleUser = useMemo(() => {
        return currentUser?.providerData?.some(p => p.providerId === 'google.com');
    }, [currentUser]);

    // Handle Redirect Result on Mount (Crucial for mobile phones)
    useEffect(() => {
        const checkRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    showToast('Bağlantı başarıyla aktif edildi!', 'success');
                    hapticFeedback('success');
                }
            } catch (error: any) {
                console.error("Redirect auth error:", error);
                if (error.code === 'auth/credential-already-in-use') {
                    showToast('Bu hesap zaten bağlı.', 'info');
                }
            }
        };
        checkRedirect();
    }, []);

    const [authErrorType, setAuthErrorType] = useState<'none' | 'iframe-restricted' | 'blocked'>('none');

    
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    
    // Reçeteye Ekleme Özellikleri
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [showFarmerPicker, setShowFarmerPicker] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSavingVisit, setIsSavingVisit] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load farmers for the picker
    React.useEffect(() => {
        const loadFarmers = async () => {
            const data = await dbService.getFarmers();
            setFarmers(data);
        };
        loadFarmers();
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setAnalysis(null);
            setIsLoading(true); // Show loading while processing image
            
            try {
                // Image compression for mobile devices (especially iOS with large photos)
                const compressedBase64 = await compressImage(file);
                setImageBase64(compressedBase64);
                if (e.target) e.target.value = ''; // Reset input value
            } catch (err) {
                console.error("Image processing failed:", err);
                showToast('Görüntü işlenemedi. Lütfen başka bir fotoğraf deneyin.', 'error');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = event.target?.result as string;
                img.onerror = () => reject(new Error("Image load error"));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200; // Optimal for Gemini Vision
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d', { alpha: false });
                    if (ctx) {
                        // Background for transparent PNGs
                        ctx.fillStyle = "#000";
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        // Quality 0.8 is a good balance between size and detail
                        resolve(canvas.toDataURL('image/jpeg', 0.8));
                    } else {
                        reject(new Error("Canvas context failed"));
                    }
                };
            };
            reader.onerror = () => reject(new Error("File read error"));
        });
    };

    const handleAnalyze = async () => {
        if (!imageBase64 || isLoading) return;

        if (!navigator.onLine) {
            showToast('Lütfen internet bağlantınızı kontrol edin. Analiz için internet gereklidir.', 'error');
            return;
        }

        hapticFeedback('medium');
        setIsLoading(true);

        try {
            if (!imageBase64.includes(',')) throw new Error('Görüntü verisi geçersiz.');

            // Build Inventory Context
            const inventoryContext = inventory && inventory.length > 0 
                ? inventory.map(i => `- ${i.pesticideName} (${i.category}): ${i.quantity} ${i.unit}`).join('\n')
                : 'Depoda kayıtlı ilaç bulunmuyor.';

            // FRONTEND DIRECT GEMINI CALL
            const apiKey = process.env.GEMINI_API_KEY;
            
            if (apiKey) {
                // Determine mimeType and base64Data
                const base64Data = imageBase64.split(',')[1];
                const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
                
                const ai = new GoogleGenAI({ apiKey: apiKey.replace(/['"]+/g, '').trim() });

                const generateAiContent = async (modelName: string) => {
                    return await ai.models.generateContent({
                        model: modelName,
                        contents: {
                            parts: [
                                { text: "Lütfen bu bitki fotoğrafını bir ziraat mühendisi uzmanlığıyla analiz et. Varsa hastalıkları, zararlıları veya besin noksanlıklarını teşhis et. Teşhisin ismini, nedenini ve detaylı çözüm önerilerini (ilaç, etken madde veya kültürel önlem) profesyonel bir dille açıkla. Mümkün olduğunca spesifik ol." },
                                { inlineData: { mimeType, data: base64Data } }
                            ]
                        },
                        config: {
                            temperature: 0.1,
                            systemInstruction: `Sen, 'Mühendis Kayıt Sistemi' bünyesinde çalışan, üst düzey bir bitki koruma uzmanı ve ziraat mühendisisin.
                            
                            TEŞHİS VE ÇÖZÜM PROTOKOLÜ:
                            1. FOTOĞRAF ANALİZİ: Görüntüdeki belirtileri (leke, renk değişimi, şekil bozukluğu, böcek vb.) bilimsel olarak açıkla.
                            2. TEŞHİS: Sorun(lar)ın ismini ve şiddetini belirt.
                            3. TEDAVİ PLANI: Kimyasal, biyolojik ve kültürel mücadele yöntemlerini sıralar.
                            4. ÇİFTÇİ REÇETESİ: En altta kesinlikle "*** ÇİFTÇİ REÇETESİ ***" şeklinde bir başlık aç. Bu başlığın altına SADECE çiftçiye verilmesi/kullanması gereken ilaçların listesini, dozlarını ve uygulama şeklini madde madde yaz. Bu kısım kısa, net ve doğrudan raftan verilmeye hazır reçete formatında olmalıdır.
                            
                            DEPO ENVANTERİYLE TAM ENTEGRASYON:
                            Kullanıcının deposunda bulunan güncel ürün listesi aşağıdadır:
                            ${inventoryContext}
                            
                            KRİTİK TALİMAT:
                            - Reçete yazarken ÖNCELİKLE kullanıcının deposunda (listede) olan ilaçları öner. 
                            - Eğer depoda uygun ürün varsa: "**💡 Depondaki şu ürün(ler) bu sorun için tam çözümdür: [Ürün Adı]**" şeklinde vurgula.
                            - Depoda yoksa piyasadaki en etkili etken maddeleri öner.
                            
                            FORMAT: 
                            - Yanıtlarını yapılandırılmış markdown (baslıklar, listeler) kullanarak ver.
                            - Gereksiz giriş-sonuç cümlelerinden kaçın, direkt bilgi odaklı ol.
                            - Mühendislik ciddiyetiyle ama kullanıcıya yardımcı olan bir tonda yaz.`
                        }
                    });
                };

                let response;
                try {
                    response = await generateAiContent("gemini-3-flash-preview");
                } catch (e: any) {
                    console.warn("Primary AI model failed (likely 503), trying fallback...", e);
                    // Use Gemini Flash Latest as fallback
                    response = await generateAiContent("gemini-flash-latest");
                }

                if (response.text) {
                    setAnalysis(response.text);
                    hapticFeedback('success');
                    setIsLoading(false);
                    return;
                }
            }

            // Fallback to Server if logic fails (e.g., frontend API key missing)
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64,
                    inventoryContext
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Sunucu hatası oluştu');
            }

            const data = await res.json();
            
            if (!data.analysis) {
                throw new Error('Yapay zeka yanıt üretemedi.');
            }
            
            setAnalysis(data.analysis);
            hapticFeedback('success');

        } catch (error: any) {
            console.error("AI Analysis Error:", error);
            let userFriendlyMessage = 'Analiz başarısız oldu.';
            
            const errMsg = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
            if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('key not valid')) {
                userFriendlyMessage = 'Geçersiz API Anahtarı. Lütfen ayayrlardan güncelleyin.';
            } else if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('denied access')) {
                userFriendlyMessage = 'Kullandığınız API anahtarı engellenmiş (403). Lütfen yeni bir API anahtarı oluşturun.';
            } else if (errMsg.includes('quota') || errMsg.includes('429')) {
                userFriendlyMessage = 'Günlük kapasite doldu. Lütfen daha sonra tekrar deneyin.';
            } else if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('overloaded')) {
                userFriendlyMessage = 'Şu an tüm veri merkezlerinde aşırı yoğunluk yaşanıyor (503). Lütfen 30 saniye bekleyip tekrar deneyin.';
            } else if (errMsg.includes('safety')) {
                userFriendlyMessage = 'Güvenlik filtreleri (hassas içerik vb.) nedeniyle analiz engellendi.';
            } else if (errMsg.includes('Requested entity was not found')) {
                userFriendlyMessage = 'Model bulunamadı veya yetkiniz yok. Lütfen anahtarınızı güncelleyin.';
            } else {
                userFriendlyMessage = `İşlem hatası: Lütfen tekrar deneyin.`;
            }

            showToast(userFriendlyMessage, 'error');
            setAnalysis(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAsVisit = async (farmer: Farmer) => {
        if (!analysis || isSavingVisit) return;
        
        setIsSavingVisit(true);
        hapticFeedback('medium');
        
        try {
            const newVisit = {
                id: `VISIT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                farmerId: farmer.id,
                date: new Date().toISOString(),
                note: `[YAPAY ZEKA - BİTKİ ANALİZ RAPORU]\n\n${analysis}`,
                village: farmer.village,
                severity: 'MEDIUM' as 'MEDIUM', 
                createdById: auth.currentUser?.uid
            };
            
            await dbService.addVisit(newVisit);
            showToast(`${farmer.fullName} için ziyaret kaydı oluşturuldu!`, 'success');
            setShowFarmerPicker(false);
            hapticFeedback('success');
        } catch (error) {
            console.error("Visit Save Error:", error);
            showToast('Reçete kaydedilirken bir hata oluştu.', 'error');
        } finally {
            setIsSavingVisit(false);
        }
    };

    const filteredFarmers = farmers.filter(f => 
        f.fullName.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) ||
        f.village.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR'))
    );

    return (
        <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="bg-stone-900/50 backdrop-blur-xl border-b border-white/10 p-4 pt-12 flex items-center justify-between sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => onBack?.()}
                        className="p-2 bg-white/5 rounded-full text-stone-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-white font-bold text-lg leading-tight flex items-center gap-2">
                            Zirai Teşhis Asistanı <Sparkles size={16} className="text-emerald-400" />
                        </h2>
                        <p className="text-stone-500 text-xs font-medium">Yapay Zeka Destekli Mühendis Asistanı</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <AnimatePresence mode="wait">
                    {!imageBase64 ? (
                        <motion.div 
                            key="empty"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="h-full flex flex-col items-center justify-center text-center space-y-10 py-10"
                        >
                            <div className="relative">
                                <div className="w-28 h-28 bg-emerald-600/10 rounded-full flex items-center justify-center border border-emerald-500/30 relative z-10 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                                    <Camera size={44} className="text-emerald-400" />
                                </div>
                                <motion.div 
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 3 }}
                                    className="absolute inset-0 bg-emerald-500 rounded-full -m-4"
                                />
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0, 0.2] }}
                                    transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                                    className="absolute inset-0 bg-emerald-400 rounded-full -m-2"
                                />
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-2xl font-black text-white tracking-tight">Bitki Analizi</h3>
                                <p className="text-stone-400 max-w-[260px] mx-auto text-sm leading-relaxed">
                                    Hasta veya zararlı gören yaprağın fotoğrafını net bir şekilde çekin, asistanınız teşhisi koysun.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 w-full max-w-[280px]">
                                <button 
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.setAttribute('capture', 'environment');
                                            fileInputRef.current.click();
                                        }
                                    }}
                                    className="flex items-center gap-4 p-5 bg-emerald-600 text-white rounded-3xl hover:bg-emerald-500 transition-all active:scale-95 shadow-[0_10px_30px_rgba(16,185,129,0.2)] group"
                                >
                                    <div className="p-3 bg-white/20 rounded-2xl group-hover:scale-110 transition-transform">
                                        <Camera size={24} />
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm font-bold">Kamerayı Başlat</span>
                                        <span className="block text-[10px] opacity-70">Canlı fotoğraf çek</span>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => {
                                        if (fileInputRef.current) {
                                            fileInputRef.current.removeAttribute('capture');
                                            fileInputRef.current.click();
                                        }
                                    }}
                                    className="flex items-center gap-4 p-5 bg-stone-900 border border-white/5 text-white rounded-3xl hover:bg-stone-800 transition-all active:scale-95 group"
                                >
                                    <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                                        <ImageIcon size={24} className="text-stone-400" />
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm font-bold text-stone-200">Galeriden Yükle</span>
                                        <span className="block text-[10px] text-stone-500">Cihazından dosya seç</span>
                                    </div>
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="content"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            {/* Image Preview Container */}
                            <div className="relative rounded-[2.5rem] overflow-hidden aspect-[4/3] border-4 border-white/5 shadow-2xl group ring-1 ring-white/10">
                                <img src={imageBase64} alt="Preview" className="w-full h-full object-cover" />
                                
                                {isLoading && (
                                    <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                                        <motion.div 
                                            animate={{ top: ['0%', '100%', '0%'] }}
                                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                            className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_20px_#10b981] z-20"
                                        />
                                        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px]" />
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                
                                <button 
                                    onClick={() => { setImageFile(null); setImageBase64(null); setAnalysis(null); }}
                                    className="absolute top-6 right-6 p-3 bg-black/60 backdrop-blur-xl rounded-2xl text-white hover:bg-rose-500 transition-colors shadow-xl"
                                >
                                    <X size={20} />
                                </button>

                                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                    <div className="px-4 py-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-full">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Görüntü Hazır</span>
                                    </div>
                                </div>
                            </div>

                            {!analysis && !isLoading && (
                                <motion.button 
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleAnalyze}
                                    className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(5,150,105,0.3)] transition-all"
                                >
                                    <Search size={24} />
                                    ANALİZİ BAŞLAT
                                </motion.button>
                            )}

                            {isLoading && (
                                <div className="bg-stone-900 border border-emerald-500/10 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="relative">
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                            className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full"
                                        />
                                        <Sparkles size={20} className="text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-xl font-bold text-white">Tarayıcı Çalışıyor</h4>
                                        <p className="text-stone-500 text-sm max-w-[200px] mx-auto">
                                            Bitki kütüphanesi ve depo stokları ile karşılaştırma yapılıyor...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {analysis && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="space-y-6 pb-20"
                                >
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-5 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                            <CheckCircle2 size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-black">Teşhis Tamamlandı</h3>
                                            <p className="text-emerald-400/70 text-xs font-bold uppercase tracking-widest">Uzman Raporu Hazır</p>
                                        </div>
                                    </div>

                                    <div className="bg-stone-900 ring-1 ring-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 -mr-10 -mt-10 opacity-[0.03]">
                                            <Sparkles size={200} className="text-emerald-500" />
                                        </div>
                                        <div className="markdown-body text-stone-200 text-sm leading-relaxed relative z-10 selection:bg-emerald-500/30">
                                            <ReactMarkdown>{analysis}</ReactMarkdown>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => { setImageFile(null); setImageBase64(null); setAnalysis(null); }}
                                        className="w-full py-5 bg-stone-900 border border-white/5 text-stone-400 font-bold rounded-2xl hover:bg-stone-800 transition-all flex items-center justify-center gap-3 active:scale-95 mb-4"
                                    >
                                        <Camera size={20} />
                                        Başka Bir Bitki Tara
                                    </button>

                                    <button 
                                        onClick={() => setShowFarmerPicker(true)}
                                        className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-emerald-900/20"
                                    >
                                        <UserPlus size={20} />
                                        Çiftçi Reçetelerine Ekle
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Farmer Picker Modal */}
            <AnimatePresence>
                {showFarmerPicker && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            exit={{ y: 100 }}
                            className="bg-stone-900 w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-white/10"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-white">Çiftçi Seçin</h3>
                                    <p className="text-stone-500 text-[10px] uppercase font-bold tracking-widest">Raporu kime kaydedelim?</p>
                                </div>
                                <button 
                                    onClick={() => setShowFarmerPicker(false)}
                                    className="p-2 bg-white/5 rounded-full text-stone-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-4 bg-stone-950/50 backdrop-blur-sm sticky top-0 z-10">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600" size={18} />
                                    <input 
                                        type="text"
                                        placeholder="Çiftçi adı veya köy ara..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-stone-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-emerald-500/30 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {filteredFarmers.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Users size={40} className="text-stone-800 mx-auto mb-3" />
                                        <p className="text-stone-600 text-sm font-bold">Çiftçi bulunamadı.</p>
                                    </div>
                                ) : (
                                    filteredFarmers.map((farmer) => (
                                        <button 
                                            key={farmer.id}
                                            onClick={() => handleAddAsVisit(farmer)}
                                            disabled={isSavingVisit}
                                            className="w-full flex items-center justify-between p-4 bg-stone-800/40 hover:bg-stone-800 rounded-2xl border border-white/5 transition-all group active:scale-[0.98] disabled:opacity-50"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-emerald-900/20 text-emerald-500 rounded-xl flex items-center justify-center font-black group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                                    {farmer.fullName.charAt(0)}
                                                </div>
                                                <div className="text-left">
                                                    <h4 className="font-bold text-stone-200 group-hover:text-white transition-colors">{farmer.fullName}</h4>
                                                    <p className="text-[10px] text-stone-500 uppercase font-bold">{farmer.village}</p>
                                                </div>
                                            </div>
                                            <div className="p-2 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Check size={16} className="text-emerald-500" />
                                            </div>
                                        </button>
                                    ))
                                )
                                }
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileSelect}
            />
        </div>
    );
};

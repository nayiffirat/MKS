import React, { useState, useRef, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { useAppViewModel } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider } from '../services/firebase';
import { getRedirectResult } from 'firebase/auth';
import { Loader2, ChevronLeft, Camera, X, Sparkles, Image as ImageIcon, Search, AlertCircle, CheckCircle2, Check, Copy, Bug, Droplet } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { dbService } from '../services/db';

interface ProductAiAssistantProps {
    onBack?: () => void;
}

export const ProductAiAssistant: React.FC<ProductAiAssistantProps> = ({ onBack }) => {
    const { currentUser } = useAuth();
    const { showToast, hapticFeedback } = useAppViewModel();

    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAnalysis(null);
            setIsLoading(true);
            
            try {
                const compressedBase64 = await compressImage(file);
                setImageBase64(compressedBase64);
                if (e.target) e.target.value = '';
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
                    const MAX_WIDTH = 1200;
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
                        ctx.fillStyle = "#000";
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
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
            showToast('Lütfen internet bağlantınızı kontrol edin.', 'error');
            return;
        }

        hapticFeedback('medium');
        setIsLoading(true);

        try {
            const base64Data = imageBase64.split(',')[1];
            const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
            
            const apiKey = process.env.GEMINI_API_KEY;
            
            if (!apiKey) throw new Error('API anahtarı bulunamadı.');

            const ai = new GoogleGenAI({ apiKey: apiKey.replace(/['"]+/g, '').trim() });

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType: mimeType } },
                        { text: "Bu bir zirai ilaç veya gübre etiketi. Lütfen etiketteki bilgileri oku ve şu formatta JSON olarak detaylı bilgi ver: Ürün Adı (name), Kullanım Amacı (purpose), Dozaj ve Uygulama (dosage), Önemli Uyarılar (warnings). Profesyonel, detaylı ve yardımcı bir dil kullan." }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            purpose: { type: Type.STRING },
                            dosage: { type: Type.STRING },
                            warnings: { type: Type.STRING }
                        },
                        required: ["name", "purpose", "dosage", "warnings"]
                    }
                }
            });

            const result = JSON.parse(response.text || '{}');
            setAnalysis(result);
            hapticFeedback('success');
        } catch (error: any) {
            console.error("AI Analysis Error:", error);
            showToast('Analiz başarısız oldu. Lütfen tekrar deneyin.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

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
                            Ürün Bilgi Asistanı <Sparkles size={16} className="text-amber-400" />
                        </h2>
                        <p className="text-stone-500 text-xs font-medium">Akıllı Ürün Tanıma ve Teknik Destek</p>
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
                                <div className="w-28 h-28 bg-amber-600/10 rounded-full flex items-center justify-center border border-amber-500/30 relative z-10 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
                                    <Search size={44} className="text-amber-400" />
                                </div>
                                <motion.div 
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                                    transition={{ repeat: Infinity, duration: 3 }}
                                    className="absolute inset-0 bg-amber-500 rounded-full -m-4"
                                />
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-2xl font-black text-white tracking-tight">Ürün Tanıma</h3>
                                <p className="text-stone-400 max-w-[260px] mx-auto text-sm leading-relaxed">
                                    İlacın veya gübrenin etiketini çekin; kullanım amacını, dozajını ve kritik uyarıları anında öğrenin.
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
                                    className="flex items-center gap-4 p-5 bg-amber-600 text-stone-950 rounded-3xl hover:bg-amber-500 transition-all active:scale-95 shadow-[0_10px_30px_rgba(245,158,11,0.2)] group"
                                >
                                    <div className="p-3 bg-white/20 rounded-2xl group-hover:scale-110 transition-transform">
                                        <Camera size={24} />
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm font-black uppercase">Kamerayı Başlat</span>
                                        <span className="block text-[10px] opacity-70 font-bold uppercase">Etiketi Tara</span>
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
                                        <span className="block text-[10px] text-stone-500 uppercase font-bold">Cihazdan Fotoğraf Seç</span>
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
                            <div className="relative rounded-[2.5rem] overflow-hidden aspect-[4/3] border-4 border-white/5 shadow-2xl group ring-1 ring-white/10">
                                <img src={imageBase64} alt="Preview" className="w-full h-full object-cover" />
                                
                                {isLoading && (
                                    <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                                        <motion.div 
                                            animate={{ top: ['0%', '100%', '0%'] }}
                                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                            className="absolute left-0 right-0 h-1 bg-amber-400 shadow-[0_0_20px_#f59e0b] z-20"
                                        />
                                        <div className="absolute inset-0 bg-amber-500/10 backdrop-blur-[1px]" />
                                    </div>
                                )}

                                <button 
                                    onClick={() => { setImageBase64(null); setAnalysis(null); }}
                                    className="absolute top-6 right-6 p-3 bg-black/60 backdrop-blur-xl rounded-2xl text-white hover:bg-rose-500 transition-colors shadow-xl"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {!analysis && !isLoading && (
                                <motion.button 
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleAnalyze}
                                    className="w-full py-6 bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 shadow-[0_20px_40px_rgba(245,158,11,0.3)] transition-all"
                                >
                                    <Search size={24} />
                                    ÜRÜNÜ ANALİZ ET
                                </motion.button>
                            )}

                            {isLoading && (
                                <div className="bg-stone-900 border border-amber-500/10 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="relative">
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                            className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full"
                                        />
                                        <Sparkles size={20} className="text-amber-400 absolute inset-0 m-auto animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-xl font-bold text-white">Veriler İşleniyor</h4>
                                        <p className="text-stone-500 text-sm max-w-[200px] mx-auto">
                                            Etiket bilgileri profesyonel teknik veri tabanıyla eşleştiriliyor...
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
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                                            <CheckCircle2 size={24} className="text-stone-950" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-black">{analysis.name}</h3>
                                            <p className="text-amber-400/70 text-xs font-bold uppercase tracking-widest">Ürün Bilgileri Hazır</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-stone-900 ring-1 ring-white/5 rounded-[2rem] p-6 space-y-3">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                                <Bug size={14} />
                                                <span>Kullanım Amacı</span>
                                            </div>
                                            <p className="text-stone-200 text-sm leading-relaxed italic">
                                                {analysis.purpose}
                                            </p>
                                        </div>

                                        <div className="bg-stone-900 ring-1 ring-white/5 rounded-[2rem] p-6 space-y-3">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                                <Droplet size={14} />
                                                <span>Dozaj ve Uygulama</span>
                                            </div>
                                            <p className="text-stone-200 text-sm leading-relaxed">
                                                {analysis.dosage}
                                            </p>
                                        </div>

                                        <div className="bg-rose-500/5 ring-1 ring-rose-500/20 rounded-[2rem] p-6 space-y-3">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                                                <AlertCircle size={14} />
                                                <span>Önemli Uyarılar</span>
                                            </div>
                                            <p className="text-rose-200/80 text-[11px] leading-relaxed font-medium">
                                                {analysis.warnings}
                                            </p>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={() => { setImageBase64(null); setAnalysis(null); }}
                                        className="w-full py-5 bg-amber-600 text-stone-950 font-black rounded-2xl hover:bg-amber-500 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-amber-900/20"
                                    >
                                        <Camera size={20} />
                                        BAŞKA BİR ÜRÜN TARA
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

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

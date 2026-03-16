import React, { useState, useRef } from 'react';
import { ChevronLeft, Camera, Upload, Loader2, Leaf, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { GoogleGenAI } from '@google/genai';
import { motion } from 'motion/react';

interface AiDiagnosisProps {
    onBack: () => void;
}

export const AiDiagnosis: React.FC<AiDiagnosisProps> = ({ onBack }) => {
    const { showToast, hapticFeedback } = useAppViewModel();
    const [image, setImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
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
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    setImage(compressedBase64);
                    setResult(null);
                };
                img.src = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeImage = async () => {
        if (!image) return;

        setIsAnalyzing(true);
        hapticFeedback('medium');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
            
            // Extract base64 data
            const base64Data = image.split(',')[1];
            const mimeType = image.split(';')[0].split(':')[1];

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: mimeType
                            }
                        },
                        {
                            text: "Bu bitki fotoğrafını analiz et. Kısa bir özet şeklinde yaz. Bitkide kısaca şu sorun var de, altına da çözümü şu ilaçların kullanılması veya yapılması gereken şeyi kısaca yaz. Sadece tarımsal bir sorun varsa cevap ver, değilse fotoğrafın tarımla ilgili olmadığını belirt."
                        }
                    ]
                }
            });

            setResult(response.text || 'Analiz sonucu alınamadı.');
            hapticFeedback('success');
        } catch (error) {
            console.error("AI Diagnosis Error:", error);
            showToast('Analiz sırasında bir hata oluştu.', 'error');
            hapticFeedback('error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="p-4 space-y-4 pb-24 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
                <button 
                    onClick={onBack}
                    className="p-2 bg-stone-900 border border-white/10 rounded-xl text-stone-400 hover:text-white transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-stone-100">AI Teşhis</h1>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Yapay Zeka Destekli Analiz</p>
                </div>
            </div>

            {!image ? (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-square border-2 border-dashed border-emerald-500/30 rounded-3xl flex flex-col items-center justify-center bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 transition-colors"
                >
                    <div className="p-4 bg-emerald-500/20 rounded-full mb-4">
                        <Camera size={32} className="text-emerald-500" />
                    </div>
                    <p className="text-stone-300 font-bold">Fotoğraf Çek veya Yükle</p>
                    <p className="text-[10px] text-stone-500 mt-1">Hastalık veya zararlı tespiti için</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="relative rounded-3xl overflow-hidden border border-white/10">
                        <img src={image} alt="Uploaded plant" className="w-full h-auto max-h-80 object-cover" />
                        <button 
                            onClick={() => { setImage(null); setResult(null); }}
                            className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-md rounded-full text-white"
                        >
                            <Upload size={16} />
                        </button>
                    </div>

                    {!result && (
                        <button 
                            onClick={analyzeImage}
                            disabled={isAnalyzing}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Analiz Ediliyor...
                                </>
                            ) : (
                                <>
                                    <Leaf size={18} />
                                    Analizi Başlat
                                </>
                            )}
                        </button>
                    )}

                    {result && (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-stone-900 border border-emerald-500/30 rounded-2xl p-4 shadow-lg"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 size={18} className="text-emerald-500" />
                                <h3 className="font-black text-stone-200 uppercase tracking-widest text-xs">Teşhis Sonucu</h3>
                            </div>
                            <div className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">
                                {result}
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
            />
        </div>
    );
};

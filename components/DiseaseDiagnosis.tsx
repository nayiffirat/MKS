
import React, { useState } from 'react';
import { Camera, Upload, Sparkles, AlertCircle, CheckCircle2, ArrowLeft, Loader2, Bug, FlaskConical, FileText, X } from 'lucide-react';
import { GeminiService } from '../services/gemini';
import { useAppViewModel } from '../context/AppContext';

interface DiseaseDiagnosisProps {
    onBack: () => void;
}

export const DiseaseDiagnosis: React.FC<DiseaseDiagnosisProps> = ({ onBack }) => {
    const { hapticFeedback, showToast } = useAppViewModel();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{
        diseaseName: string;
        confidence: string;
        description: string;
        symptoms: string[];
        treatment: string[];
        recommendedPesticides: string[];
    } | null>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSelectedImage(reader.result as string);
                setAnalysisResult(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeImage = async () => {
        if (!selectedImage) return;
        
        // Check for API Key
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
        }

        setIsAnalyzing(true);
        hapticFeedback('medium');
        
        try {
            // Extract base64 data
            const base64Data = selectedImage.split(',')[1];
            const result = await GeminiService.analyzePlantDisease(base64Data);
            
            if (result) {
                setAnalysisResult(result);
                hapticFeedback('success');
            } else {
                showToast('Analiz başarısız oldu. Lütfen tekrar deneyin.', 'error');
            }
        } catch (error) {
            console.error("Analysis error:", error);
            if (error instanceof Error && error.message.includes("entity was not found")) {
                window.aistudio?.openSelectKey();
            }
            showToast('Bir hata oluştu. Lütfen internet bağlantınızı kontrol edin.', 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="p-4 pb-32 max-w-2xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 bg-stone-900 border border-white/5 rounded-xl text-stone-400 hover:text-stone-200 transition-all active:scale-90">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-stone-100 tracking-tight flex items-center gap-2">
                        <Sparkles className="text-emerald-500" size={24} />
                        AI HASTALIK TEŞHİSİ
                    </h1>
                    <p className="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Yapay Zeka Destekli Bitki Sağlığı</p>
                </div>
            </div>

            {/* Upload Area */}
            <div className="space-y-6">
                {!selectedImage ? (
                    <label className="block">
                        <div className="border-2 border-dashed border-stone-800 rounded-[2rem] p-12 flex flex-col items-center justify-center bg-stone-900/30 hover:bg-stone-900/50 hover:border-emerald-500/30 transition-all cursor-pointer group">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
                                <Camera size={32} />
                            </div>
                            <h3 className="text-stone-200 font-bold mb-1">Bitki Fotoğrafı Yükle</h3>
                            <p className="text-stone-500 text-xs text-center max-w-[200px]">Hastalığı teşhis etmek için yaprağın veya meyvenin net bir fotoğrafını çekin.</p>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                        </div>
                    </label>
                ) : (
                    <div className="space-y-4">
                        <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl aspect-square bg-stone-900">
                            <img src={selectedImage} alt="Selected plant" className="w-full h-full object-cover" />
                            <button 
                                onClick={() => setSelectedImage(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {!analysisResult && (
                            <button 
                                onClick={analyzeImage}
                                disabled={isAnalyzing}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        Analiz Ediliyor...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        Teşhis Et
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Results */}
                {analysisResult && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-stone-900 border border-emerald-500/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="text-emerald-500" size={18} />
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Teşhis Tamamlandı</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-stone-100 tracking-tight">{analysisResult.diseaseName}</h2>
                                    <p className="text-stone-500 text-xs font-bold">Güven Skoru: <span className="text-emerald-400">%{analysisResult.confidence}</span></p>
                                </div>
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500">
                                    <Bug size={24} />
                                </div>
                            </div>

                            <p className="text-stone-300 text-sm leading-relaxed mb-6">
                                {analysisResult.description}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <AlertCircle size={14} className="text-amber-500" />
                                        Belirtiler
                                    </h4>
                                    <ul className="space-y-2">
                                        {analysisResult.symptoms.map((s, i) => (
                                            <li key={i} className="text-xs text-stone-400 flex items-start gap-2">
                                                <div className="w-1 h-1 rounded-full bg-stone-700 mt-1.5 shrink-0"></div>
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <FlaskConical size={14} className="text-blue-500" />
                                        Tedavi Yöntemleri
                                    </h4>
                                    <ul className="space-y-2">
                                        {analysisResult.treatment.map((t, i) => (
                                            <li key={i} className="text-xs text-stone-400 flex items-start gap-2">
                                                <div className="w-1 h-1 rounded-full bg-stone-700 mt-1.5 shrink-0"></div>
                                                {t}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="bg-stone-900 border border-white/5 rounded-3xl p-6">
                            <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <FileText size={14} className="text-emerald-500" />
                                Önerilen İlaç Grupları
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {analysisResult.recommendedPesticides.map((p, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-stone-950 border border-white/5 rounded-xl text-[11px] font-bold text-stone-300">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="w-full py-4 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
                        >
                            Yeni Analiz Yap
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

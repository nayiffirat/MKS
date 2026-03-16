import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, FlaskConical, Search, Check, X, Loader2, AlertTriangle, Info } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { GoogleGenAI } from '@google/genai';
import { Pesticide } from '../types';
import { dbService } from '../services/db';
import { motion } from 'motion/react';

interface MixtureTestProps {
    onBack: () => void;
}

export const MixtureTest: React.FC<MixtureTestProps> = ({ onBack }) => {
    const { showToast, hapticFeedback } = useAppViewModel();
    const [selectedPesticides, setSelectedPesticides] = useState<Pesticide[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [library, setLibrary] = useState<Pesticide[]>([]);

    useEffect(() => {
        const fetchPesticides = async () => {
            const data = await dbService.getPesticides();
            setLibrary(data);
        };
        fetchPesticides();
    }, []);

    const filteredLibrary = useMemo(() => {
        return library.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [library, searchTerm]);

    const togglePesticide = (pesticide: Pesticide) => {
        if (selectedPesticides.find(p => p.id === pesticide.id)) {
            setSelectedPesticides(selectedPesticides.filter(p => p.id !== pesticide.id));
        } else {
            setSelectedPesticides([...selectedPesticides, pesticide]);
        }
    };

    const testMixture = async () => {
        if (selectedPesticides.length < 2) {
            showToast('Lütfen en az 2 ilaç seçin.', 'info');
            return;
        }

        setIsTesting(true);
        hapticFeedback('medium');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
            
            const pesticideNames = selectedPesticides.map(p => p.name).join(', ');
            const prompt = `Şu tarım ilaçlarının (veya etken maddelerinin) karışım durumunu test et: ${pesticideNames}. 
            Karışıp karışamayacağını, neden karışmadığını veya karışırken nelere dikkat edilmesi gerektiğini kısa bir özetle yaz. 
            Eğer kesin bir bilgi yoksa, "Kavanoz testi yapılması önerilir" şeklinde belirt.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt
            });

            setResult(response.text || 'Test sonucu alınamadı.');
            hapticFeedback('success');
        } catch (error) {
            console.error("Mixture Test Error:", error);
            showToast('Test sırasında bir hata oluştu.', 'error');
            hapticFeedback('error');
        } finally {
            setIsTesting(false);
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
                    <h1 className="text-xl font-black text-stone-100">Karışım Testi</h1>
                    <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">Yapay Zeka Destekli</p>
                </div>
            </div>

            <div className="bg-stone-900 border border-white/10 rounded-2xl p-4">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="İlaç ara..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-purple-500/50 transition-colors"
                    />
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                    {filteredLibrary.length === 0 ? (
                        <p className="text-center text-stone-500 text-xs py-4">İlaç bulunamadı.</p>
                    ) : (
                        filteredLibrary.map(pesticide => {
                            const isSelected = selectedPesticides.some(p => p.id === pesticide.id);
                            return (
                                <div 
                                    key={pesticide.id}
                                    onClick={() => togglePesticide(pesticide)}
                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                        isSelected 
                                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-100' 
                                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-800'
                                    }`}
                                >
                                    <div>
                                        <p className="font-bold text-xs">{pesticide.name}</p>
                                        <p className="text-[9px] uppercase tracking-widest opacity-70">{pesticide.category}</p>
                                    </div>
                                    {isSelected && <Check size={16} className="text-purple-400" />}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {selectedPesticides.length > 0 && (
                <div className="bg-stone-900 border border-white/10 rounded-2xl p-4">
                    <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3">Seçilen İlaçlar ({selectedPesticides.length})</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {selectedPesticides.map(p => (
                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-1 bg-stone-800 border border-stone-700 rounded-lg text-[10px] font-bold text-stone-300">
                                {p.name}
                                <button onClick={() => togglePesticide(p)} className="hover:text-red-400"><X size={12} /></button>
                            </span>
                        ))}
                    </div>

                    {!result && (
                        <button 
                            onClick={testMixture}
                            disabled={isTesting || selectedPesticides.length < 2}
                            className="w-full py-3 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                        >
                            {isTesting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Test Ediliyor...
                                </>
                            ) : (
                                <>
                                    <FlaskConical size={16} />
                                    Karışımı Test Et
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {result && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-stone-900 border border-purple-500/30 rounded-2xl p-4 shadow-lg"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={18} className="text-purple-500" />
                        <h3 className="font-black text-stone-200 uppercase tracking-widest text-xs">Test Sonucu</h3>
                    </div>
                    <div className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {result}
                    </div>
                    <button 
                        onClick={() => { setResult(null); setSelectedPesticides([]); }}
                        className="mt-4 w-full py-2 bg-stone-800 text-stone-300 rounded-lg text-xs font-bold hover:bg-stone-700 transition-colors"
                    >
                        Yeni Test Yap
                    </button>
                </motion.div>
            )}
        </div>
    );
};

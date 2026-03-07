
import React, { useState } from 'react';
import { PesticideCategory } from '../types';
import { AlertTriangle, CheckCircle2, XCircle, Info, ArrowLeft, FlaskConical, Search, ChevronRight, Plus } from 'lucide-react';

interface CompatibilityResult {
    status: 'SAFE' | 'WARNING' | 'DANGER';
    message: string;
    details: string;
}

const COMPATIBILITY_DATA: Record<string, Record<string, CompatibilityResult>> = {
    [PesticideCategory.INSECTICIDE]: {
        [PesticideCategory.FUNGICIDE]: { status: 'SAFE', message: 'Genellikle Güvenli', details: 'Çoğu insektisit ve fungisit karıştırılabilir. Ancak bakırlı fungisitlerle bazı organofosfatlı insektisitlere dikkat edilmelidir.' },
        [PesticideCategory.HERBICIDE]: { status: 'WARNING', message: 'Dikkatli Olunmalı', details: 'Herbisitlerle karıştırmak fitotoksite (bitki yanıklığı) riskini artırabilir. Ayrı uygulama önerilir.' },
        [PesticideCategory.FERTILIZER]: { status: 'SAFE', message: 'Güvenli', details: 'Yaprak gübreleri ile çoğu insektisit uyumludur.' },
    },
    [PesticideCategory.FUNGICIDE]: {
        [PesticideCategory.FERTILIZER]: { status: 'SAFE', message: 'Güvenli', details: 'Besleme ürünleri fungisit etkisini genellikle bozmaz.' },
        [PesticideCategory.GROWTH_REGULATOR]: { status: 'WARNING', message: 'Test Edilmeli', details: 'BGD ürünleri pH hassasiyeti nedeniyle fungisitlerle reaksiyona girebilir.' },
    },
    [PesticideCategory.HERBICIDE]: {
        [PesticideCategory.FERTILIZER]: { status: 'DANGER', message: 'Önerilmez', details: 'Herbisitlerin yabancı ot öldürme mekanizması gübre ile çakışabilir veya bitkide ağır strese yol açabilir.' },
    }
};

export const PesticideCompatibility: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [cat1, setCat1] = useState<PesticideCategory | ''>('');
    const [cat2, setCat2] = useState<PesticideCategory | ''>('');

    const getResult = (): CompatibilityResult | null => {
        if (!cat1 || !cat2) return null;
        if (cat1 === cat2) return { status: 'SAFE', message: 'Aynı Grup', details: 'Aynı kategorideki ürünler genellikle fiziksel olarak karışabilir ancak doz aşımına dikkat edilmelidir.' };
        
        const res = COMPATIBILITY_DATA[cat1]?.[cat2] || COMPATIBILITY_DATA[cat2]?.[cat1];
        return res || { status: 'WARNING', message: 'Bilinmiyor / Test Gerekli', details: 'Bu kombinasyon için kesin veri yok. Kavanoz testi yapılması önerilir.' };
    };

    const result = getResult();

    return (
        <div className="min-h-screen bg-stone-950 text-stone-200 pb-20">
            <div className="bg-stone-900/50 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-30 flex items-center gap-4">
                <button onClick={onBack} className="p-2 bg-stone-800 rounded-xl text-stone-400"><ArrowLeft size={20}/></button>
                <h1 className="text-lg font-bold">Karışım Uyumluluğu</h1>
            </div>

            <div className="p-6 space-y-8 max-w-2xl mx-auto">
                <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-2xl flex gap-3">
                    <Info className="text-emerald-500 shrink-0" size={20} />
                    <p className="text-[11px] text-emerald-200/70 leading-relaxed">
                        Bu tablo genel bilgilendirme amaçlıdır. İlaç etiketindeki uyarılar her zaman önceliklidir. 
                        Büyük tank karışımlarından önce mutlaka küçük bir kapta <b>Kavanoz Testi</b> yapınız.
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">1. Ürün Grubu</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(PesticideCategory).map(cat => (
                                <button 
                                    key={cat} 
                                    onClick={() => setCat1(cat)}
                                    className={`p-3 rounded-xl text-[10px] font-bold border transition-all ${cat1 === cat ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/20' : 'bg-stone-900 border-white/5 text-stone-400'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center border border-white/10">
                            <Plus size={20} className="text-stone-500" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest ml-1">2. Ürün Grubu</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(PesticideCategory).map(cat => (
                                <button 
                                    key={cat} 
                                    onClick={() => setCat2(cat)}
                                    className={`p-3 rounded-xl text-[10px] font-bold border transition-all ${cat2 === cat ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/20' : 'bg-stone-900 border-white/5 text-stone-400'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {result && (
                    <div className={`mt-8 p-6 rounded-[2rem] border animate-in zoom-in duration-300 ${
                        result.status === 'SAFE' ? 'bg-emerald-900/20 border-emerald-500/30' : 
                        result.status === 'WARNING' ? 'bg-amber-900/20 border-amber-500/30' : 
                        'bg-rose-900/20 border-rose-500/30'
                    }`}>
                        <div className="flex items-center gap-3 mb-4">
                            {result.status === 'SAFE' && <CheckCircle2 className="text-emerald-500" size={24} />}
                            {result.status === 'WARNING' && <AlertTriangle className="text-amber-500" size={24} />}
                            {result.status === 'DANGER' && <XCircle className="text-rose-500" size={24} />}
                            <h3 className={`text-lg font-black ${
                                result.status === 'SAFE' ? 'text-emerald-400' : 
                                result.status === 'WARNING' ? 'text-amber-400' : 
                                'text-rose-400'
                            }`}>{result.message}</h3>
                        </div>
                        <p className="text-stone-300 text-sm leading-relaxed">{result.details}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

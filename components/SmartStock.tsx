import React, { useState, useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Package, TrendingUp, AlertTriangle, ArrowLeft, Bot, RefreshCw, BarChart2, CheckCircle2, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export const SmartStock: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { inventory, prescriptions, t } = useAppViewModel();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const performAnalysis = async () => {
    setLoading(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Gemini API anahtarı bulunamadı.");

      const ai = new GoogleGenAI({ apiKey });

      // Gather simple stats to avoid huge token usage
      const stockItems = inventory.map(i => `${i.pesticideName} (${i.category}): ${i.quantity} adet/lt`).join('\n');
      
      const salesCount = prescriptions.length;
      const recentSales = prescriptions.slice(0, 50).map(p => {
        const itemStr = p.items.map(i => `${i.pesticideName} (${i.quantity} miktar)`).join(', ');
        return `Tarih: ${p.date.split('T')[0]} - Satışlar: ${itemStr}`;
      }).join('\n');

      const prompt = `Sen zeki bir perakende ve tarım stok analistisin. 
Aşağıda bayinin güncel stok durumu ve son satış hareketleri (reçeteler) yer alıyor.
Verilere bakarak:
1. Hangi ürünlerin tükenmek üzere olduğunu tespit et.
2. Hangi ürünlerin satış hızına göre stok riskinde olduğunu (ve tahmini ne zaman biteceğini) hesapla.
3. Sezonluk veya hızlı giden ürünler için tavsiyelerde bulun.

Format: Okunması çok kolay, madde işaretli, kısa paragraflar halinde profesyonel bir ziraat tavsiyesi ver. MD formatında ver. Kaliteli başlıklar kullan.

STOK DURUMU:
${stockItems.slice(0, 1000)} /* Limiting to avoid large context */

SON SATIŞLAR:
${recentSales.slice(0, 1500)}

Lütfen bana çok net ve aksiyona geçirici stok uyarısı ve sipariş tavsiyeleri ver.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt
      });

      setAnalysis(response.text || "Analiz yapılamadı.");

    } catch (error) {
      console.error(error);
      setAnalysis("Uyarı: Analiz için sunucu bağlantısı sağlanamadı. Lütfen daha sonra tekrar deneyin veya API ayarlarını kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!analysis && inventory.length > 0 && prescriptions.length > 0) {
      // automatically run first time
    }
  }, [analysis, inventory, prescriptions]);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between mb-4 mt-8 lg:mt-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-stone-900 border border-white/10 rounded-xl hover:bg-stone-800 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="text-emerald-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Akıllı Stok Tahmini
            </h1>
            <p className="text-xs text-stone-400">Yapay Zeka Destekli Erken Uyarı Sistemi</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick Stats overview before AI generated report */}
        <div className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
           <div>
             <p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">Kayıtlı Ürün</p>
             <h3 className="text-2xl font-bold text-white">{inventory.length}</h3>
           </div>
           <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><Package size={20} /></div>
        </div>
        <div className="bg-stone-900 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
           <div>
             <p className="text-stone-400 text-xs font-bold uppercase tracking-wider mb-1">Satış Verisi (Son Dönem)</p>
             <h3 className="text-2xl font-bold text-white">{prescriptions.length} İşlem</h3>
           </div>
           <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400"><BarChart2 size={20} /></div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-stone-900 to-stone-950 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="relative z-10">
           <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
             <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Bot size={20} className="text-emerald-400" />
                Gemini Stok Analizi
             </h2>
             <button 
                onClick={performAnalysis}
                disabled={loading || inventory.length === 0}
                className="flex items-center gap-2 bg-stone-800 hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
             >
                <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
                {loading ? "Analiz Ediliyor..." : "Yeni Analiz İste"}
             </button>
           </div>

           {loading ? (
             <div className="flex flex-col items-center justify-center py-12 text-stone-400 space-y-4">
                <Loader2 size={32} className="animate-spin text-emerald-500 mb-2" />
                <p>Geçmiş satışlarınız ve güncel stok durumunuz inceleniyor...</p>
                <p className="text-xs opacity-60">Bu işlem birkaç saniye sürebilir.</p>
             </div>
           ) : analysis ? (
             <div className="prose prose-invert max-w-none text-sm prose-emerald prose-p:leading-relaxed prose-headings:font-bold prose-a:text-emerald-400">
               <div dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }} />
             </div>
           ) : (
             <div className="text-center py-12">
               <div className="w-16 h-16 bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-500">
                  <AlertTriangle size={32} />
               </div>
               <h3 className="text-white font-bold mb-2">Analiz Henüz Başlamadı</h3>
               <p className="text-stone-400 text-sm max-w-sm mx-auto mb-6">
                 Yapay zeka, geçmiş reçetelerinizi ve depo durumunuzu analiz ederek bitmek üzere olan ürünleri, sipariş vermeniz gereken tarihleri ve kritik uyarıları raporlayacaktır.
               </p>
               <button 
                  onClick={performAnalysis}
                  disabled={inventory.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
               >
                  Verileri Analiz Et
               </button>
               {inventory.length === 0 && <p className="text-red-400 text-xs mt-3">Devam etmek için depoya ürün eklemeniz gerekmektedir.</p>}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// Simple helper to render basic markdown bold and bullet points safely without heavy libraries
function formatMarkdown(text: string) {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n\* /g, '<br/>• ');
  
  return `<p>${html}</p>`;
}

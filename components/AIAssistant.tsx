import React, { useState, useRef, useEffect } from 'react';
import { Bot, Loader2, Leaf, Image as ImageIcon, Sparkles, X, ArrowLeft, AlertTriangle, ScanSearch, FileText, Info, Camera, Sprout, RefreshCw } from 'lucide-react';
import { dbService } from '../services/db';
import { API_BASE } from '../utils/api';
import { generateAIContent } from '../utils/gemini';

type ParsedAIResponse = {
  basarili_mi: boolean;
  hata_mesaji: string | null;
  teshis?: {
    bitki_turu: string;
    sorun_kategorisi: string;
    sorun_adi: string;
    guvenilirlik_yuzdesi: number;
  };
  recete?: {
    urun_grubu: string;
    aktif_madde_ve_orani: string;
    ornek_ticari_urun_referanslari: string[];
    uygulama_dozu: string;
    ziraat_muhendisi_notu: string;
  };
};

function parseAIResponse(text: string): ParsedAIResponse | null {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
    
    return JSON.parse(cleaned.trim());
  } catch(e) {
    return null;
  }
}

export const AIAssistant: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'result' | 'error'>('idle');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ParsedAIResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const startAnalysis = async (base64Image: string) => {
    setAnalysisState('analyzing');
    setCurrentImage(base64Image);
    setResultData(null);
    setErrorMessage(null);

    try {
      let depotInfoStr = "";
      try {
        const inventory = await dbService.getInventory();
        const pesticides = await dbService.getPesticides();
        const availableProducts = inventory
          .filter(i => i.quantity > 0)
          .map(i => pesticides.find(p => p.id === i.pesticideId)?.name)
          .filter(Boolean);
        
        if (availableProducts.length > 0) {
          depotInfoStr = `\n\nDEPODAKİ MEVCUT ÜRÜNLER:\n${availableProducts.join(', ')}\n\nÖNEMLİ: Reçete oluştururken (Özellikle "ornek_ticari_urun_referanslari" kısmında) ÖNCELİKLİ OLARAK yukarıda listelenen ve depomuzda mevcut olan ürünleri önermeye çalış. Eğer depodaki bir ürünü öneriyorsan isminin sonuna " (Depoda Mevcut)" ibaresini ekle. Eğer depoda uygun ürün yoksa dışarıdan diğer tavsiye ürünlerinizi önerebilirsin.`;
        }
      } catch (err) {
        console.error("Depo bilgisi alınamadı", err);
      }
      
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.substring( base64Image.indexOf(":")+1, base64Image.indexOf(";") );
      
      const config = {
        systemInstruction: `Sen, "Mühendis Kayıt Sistemi" entegrasyonuyla çalışan, tarla bitkileri, sebzeler, meyve ağaçları ve seracılık dahil tüm bitki türlerinde (geniş spektrumlu) uzmanlaşmış kıdemli bir ziraat mühendisi yapay zekasısın.

GÖREVİN:
Sana gönderilen görseli (bitki, yaprak, meyve, kök veya tarla) detaylıca analiz etmek; bitki türünü belirlemek, hastalık, zararlı, yabancı ot veya bitki besleme (noksanlık) sorunlarını teşhis etmek ve profesyonel bir tarımsal reçete oluşturmaktır.

KESİN KURALLAR (CRITICAL INSTRUCTIONS):

1-ZORUNLU FORMAT: Yanıtın SADECE VE KESİNLİKLE geçerli bir JSON objesi olmalıdır. JSON objesinin başlangıcı { ve bitişi } dışında HİÇBİR selamlama, uyarı, ön bilgi, son söz veya markdown işareti (\`\`\`json vb.) KULLANILMAYACAKTIR.

2-GÖRSEL DOĞRULAMA: Yüklenen görsel bir bitkiye ait değilse, aşırı bulanıksa veya teşhis konulmasını imkansız kılan bir durum varsa, ASLA varsayımsal veya uydurma reçete yazma. "basarili_mi" değerini false yap ve "hata_mesaji" kısmına teknik bir açıklama gir.

3-PROFESYONEL REÇETELEME: Reçeteleri oluştururken Türkiye ve küresel tarım standartlarında ruhsatlı aktif maddeleri baz al. Ticari örnekler verirken Bayer, UPL, Agrobest, Platin Kimya gibi sektördeki güvenilir firmaların ürün profillerine uygun referanslar sun.

4-KAPSAM: Tanımlanamayan nadir bir bitki veya spesifik bir yerel varyete ile karşılaşırsan, en yakın bitki familyasına göre analiz yap ve bunu "ziraat_muhendisi_notu" kısmında belirt.

ZORUNLU JSON ŞEMASI:
{
  "basarili_mi": true,
  "hata_mesaji": null,
  "teshis": {
    "bitki_turu": "Örn: Mısır, Domates, Fıstık vb.",
    "sorun_kategorisi": "Hastalık | Zararlı | Besin Noksanlığı | Yabancı Ot | Sağlıklı",
    "sorun_adi": "Örn: Pamuk Çizgili Yaprak Kurdu (Spodoptera exigua) veya Potasyum Noksanlığı",
    "guvenilirlik_yuzdesi": 92
  },
  "recete": {
    "urun_grubu": "Örn: İnsektisit, Fungisit, Herbisit, Yaprak Gübresi",
    "aktif_madde_ve_orani": "Örn: %5 SG Emamectin Benzoate",
    "ornek_ticari_urun_referanslari": ["Proclaim benzeri", "Farklı bir eşdeğer ürün"],
    "uygulama_dozu": "Örn: 40 g / 100 L su",
    "ziraat_muhendisi_notu": "Örn: İlaçlama akşam saatlerinde yapılmalı, arılara toksik olduğu için çiçeklenme döneminde dikkat edilmelidir."
  }
}
${depotInfoStr}`
      };

      const text = await generateAIContent(
        'gemini-3-flash-preview',
        [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          { text: "Bu görseli tarımsal açıdan detaylıca analiz et." }
        ],
        config
      );

      const parsed = parseAIResponse(text || "");
      if (parsed) {
         setResultData(parsed);
         setAnalysisState('result');
      } else {
         setErrorMessage("Gelen yanıt anlaşılamadı. Farklı bir görsel seçerek tekrar deneyin.");
         setAnalysisState('error');
      }

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      setErrorMessage(error?.message || error?.toString() || "Bir hata oluştu. Lütfen tekrar deneyin.");
      setAnalysisState('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      startAnalysis(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetScanner = () => {
     setAnalysisState('idle');
     setCurrentImage(null);
     setResultData(null);
     setErrorMessage(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] lg:h-[calc(100vh-40px)] bg-black p-4 relative overflow-hidden font-sans">
      {/* Background Decor - Ambient Apple-like blurred blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="flex items-center justify-between mb-4 mt-8 lg:mt-0 relative z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all">
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl shadow-lg flex items-center justify-center">
             <Leaf className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-white flex items-center gap-2">Tarımsal Analiz</h1>
          </div>
        </div>
      </div>

      <div className="flex-1 relative z-10 overflow-y-auto mb-4 pb-20">
        {analysisState === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in duration-700">
            <div className="relative mb-8">
               <div className="w-32 h-32 bg-white/5 backdrop-blur-2xl rounded-[40px] border border-white/10 flex items-center justify-center relative shadow-2xl">
                 <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-[40px] opacity-50"></div>
                 <Bot size={56} className="text-emerald-400 relative z-10" strokeWidth={1.5} />
                 <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-2 shadow-lg border-2 border-black">
                   <Sprout size={18} />
                 </div>
               </div>
            </div>
            
            <div className="space-y-3 relative z-10 mb-12">
              <h2 className="text-[32px] font-semibold text-white tracking-tight leading-tight">
                Bitkinizi <br/><span className="text-emerald-400">Teşhis Edin</span>
              </h2>
              <p className="text-white/50 max-w-sm mx-auto text-[15px] leading-relaxed">
                 Görselinizi yükleyerek hastalığı teşhis edin, bitki sağlığı durumunu analiz edin veya ilaçlama reçetesi oluşturun.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md relative z-10">
               <button 
                 onClick={() => cameraInputRef.current?.click()}
                 className="flex flex-col items-center justify-center gap-3 py-8 px-4 bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 rounded-[32px] transition-all active:scale-[0.98] group shadow-sm"
               >
                  <div className="w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center group-hover:scale-105 transition-all duration-300">
                     <Camera size={26} strokeWidth={1.5} />
                  </div>
                  <span className="block text-[15px] font-medium text-white tracking-wide">Kamera</span>
               </button>

               <button 
                 onClick={() => galleryInputRef.current?.click()}
                 className="flex flex-col items-center justify-center gap-3 py-8 px-4 bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 rounded-[32px] transition-all active:scale-[0.98] group shadow-sm"
               >
                  <div className="w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center group-hover:scale-105 transition-all duration-300">
                     <ImageIcon size={26} strokeWidth={1.5} />
                  </div>
                  <span className="block text-[15px] font-medium text-white tracking-wide">Galeri</span>
               </button>
            </div>
          </div>
        )}

        {analysisState === 'analyzing' && currentImage && (
           <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in w-full max-w-sm mx-auto">
              <div className="relative mb-8">
                 <div className="relative rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
                    <img src={currentImage} className="w-64 h-64 object-cover" alt="Analyzing" />
                    <div className="absolute top-0 left-0 right-0 h-1 bg-white shadow-[0_0_20px_rgba(255,255,255,1)] animate-[scan_2s_ease-in-out_infinite]" />
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
                 </div>
                 <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-5 py-2.5 shadow-xl flex items-center gap-3">
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span className="text-[13px] font-semibold text-white tracking-wide">Analiz Ediliyor</span>
                 </div>
              </div>
              <p className="text-white/60 text-[15px] max-w-[250px] animate-pulse">
                Laboratuvar analizi gerçekleştiriliyor...
              </p>
           </div>
        )}

        {analysisState === 'error' && errorMessage && (
           <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in">
              <div className="w-24 h-24 bg-red-500/10 backdrop-blur-xl rounded-[32px] flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
                 <AlertTriangle size={40} strokeWidth={1.5} />
              </div>
              <h2 className="text-[26px] font-semibold text-white mb-2 tracking-tight">Başarısız</h2>
              <p className="text-white/60 max-w-sm mb-8 text-[15px] leading-relaxed">{errorMessage}</p>
              
              <button 
                onClick={resetScanner}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-xl text-white border border-white/10 hover:bg-white/20 rounded-full font-medium transition-all shadow-lg active:scale-95"
              >
                <RefreshCw size={20} />
                Yeni Tarama Başlat
              </button>
           </div>
        )}

        {analysisState === 'result' && resultData && (
           <div className="max-w-md mx-auto space-y-5 animate-in slide-in-from-bottom-8 duration-500">
               {currentImage && (
                  <div className="relative h-56 w-full rounded-[32px] overflow-hidden shadow-2xl border border-white/10">
                    <img src={currentImage} className="w-full h-full object-cover" alt="Analyzed" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-5">
                       <span className="text-white/90 text-[13px] font-medium tracking-wide flex items-center gap-2 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full">
                          <Bot size={16} className="text-emerald-400" /> 
                          Tarama Tamamlandı
                       </span>
                    </div>
                  </div>
               )}

               {!resultData.basarili_mi ? (
                 <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 p-6 rounded-[32px] shadow-lg relative overflow-hidden">
                    <div className="relative z-10 flex gap-4">
                       <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                         <AlertTriangle size={24} className="text-red-400" />
                       </div>
                       <div>
                         <span className="block font-semibold text-white text-[18px] tracking-tight mb-1">Sorun Tespit Edilemedi</span>
                         <p className="text-[15px] leading-relaxed text-white/70">
                            {resultData.hata_mesaji || 'Görselden tarımsal bir veri çıkarılamadı. Farklı bir fotoğraf deneyin.'}
                         </p>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-5">
                    <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] shadow-xl relative overflow-hidden">
                       <h3 className="text-white font-semibold mb-5 flex items-center gap-3 text-[18px] tracking-tight">
                          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                             <ScanSearch size={22} />
                          </div>
                          Teşhis Sonucu
                       </h3>
                       
                       <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <span className="text-[12px] text-white/50 block font-medium mb-1">Bitki Türü</span>
                            <span className="font-semibold text-white text-[16px]">{resultData.teshis?.bitki_turu}</span>
                          </div>
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <span className="text-[12px] text-white/50 block font-medium mb-1">Kategori</span>
                            <span className="font-semibold text-white text-[16px]">{resultData.teshis?.sorun_kategorisi}</span>
                          </div>
                       </div>
                       
                       <div className="bg-emerald-500/10 rounded-2xl p-5 border border-emerald-500/20 mb-5 relative overflow-hidden">
                          <span className="text-[12px] text-emerald-400 block font-medium mb-1">Sorun Adı / Etmen</span>
                          <span className="font-semibold text-white text-[22px] leading-tight">{resultData.teshis?.sorun_adi}</span>
                       </div>
                       
                       <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                          <div className="flex justify-between items-end mb-3">
                             <span className="text-[12px] text-white/50 font-medium">Yapay Zeka Güvenilirliği</span>
                             <span className="text-white font-bold text-[16px]">%{resultData.teshis?.guvenilirlik_yuzdesi || 0}</span>
                          </div>
                          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${resultData.teshis?.guvenilirlik_yuzdesi || 0}%` }}></div>
                          </div>
                       </div>
                    </div>

                    {resultData.recete && (
                       <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-6 rounded-[32px] shadow-xl relative overflow-hidden">
                           <h3 className="text-white font-semibold mb-5 flex items-center gap-3 text-[18px] tracking-tight relative z-10">
                              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl">
                                 <FileText size={22} />
                              </div>
                              Mühendis Reçetesi
                           </h3>
                           
                           <div className="space-y-3 relative z-10">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                  <span className="text-[12px] text-white/50 block font-medium mb-1">Ürün Grubu</span>
                                  <span className="font-semibold text-white text-[15px]">{resultData.recete.urun_grubu}</span>
                                </div>
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                  <span className="text-[12px] text-white/50 block font-medium mb-1">Uygulama Dozu</span>
                                  <span className="font-semibold text-white text-[15px]">{resultData.recete.uygulama_dozu}</span>
                                </div>
                              </div>
                              
                              <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-[12px] text-white/50 block font-medium mb-2">Aktif Madde ve Oranı</span>
                                <span className="font-semibold text-white text-[18px] tracking-tight">{resultData.recete.aktif_madde_ve_orani}</span>
                              </div>
                              
                              <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
                                <span className="text-[12px] text-white/50 block font-medium mb-3">Örnek Ticari Ürünler</span>
                                <div className="flex flex-wrap gap-2">
                                  {resultData.recete.ornek_ticari_urun_referanslari?.map((ref, i) => (
                                     <span key={i} className="px-3.5 py-1.5 bg-white/10 text-white font-medium rounded-full text-[13px]">{ref}</span>
                                  ))}
                                </div>
                              </div>
                              
                              {resultData.recete.ziraat_muhendisi_notu && (
                                 <div className="mt-4 p-5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                    <div className="flex gap-4">
                                       <div className="shrink-0 mt-0.5">
                                          <Info size={20} className="text-blue-400" />
                                       </div>
                                       <div>
                                          <span className="text-[13px] text-blue-400 font-semibold block mb-1">Önemli Not</span>
                                          <p className="leading-relaxed text-white/80 text-[14px]">{resultData.recete.ziraat_muhendisi_notu}</p>
                                       </div>
                                    </div>
                                 </div>
                              )}
                           </div>
                       </div>
                    )}
                 </div>
               )}
           </div>
        )}

        {/* Hidden inputs for scanning */}
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          ref={cameraInputRef} 
          onChange={handleFileChange}
        />
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={galleryInputRef} 
          onChange={handleFileChange}
        />
      </div>

      {analysisState === 'result' && (
         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-2rem)] z-20">
            <button 
              onClick={resetScanner}
              className="w-full flex items-center justify-center gap-3 p-4 bg-white/10 backdrop-blur-2xl border border-white/20 hover:bg-white/20 text-white rounded-full shadow-2xl active:scale-[0.98] transition-all font-semibold tracking-wide text-[16px]"
            >
               <ScanSearch size={22} />
               Yeni Görsel Tara
            </button>
         </div>
      )}
    </div>
  );
};




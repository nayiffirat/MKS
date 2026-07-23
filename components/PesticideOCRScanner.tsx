import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { PesticideCategory } from '../types';
import { API_BASE } from '../utils/api';
import { generateAIContent } from '../utils/gemini';

interface ScannedData {
  productName: string;
  category: PesticideCategory | string;
}

interface PesticideOCRScannerProps {
  onScanSuccess: (data: ScannedData) => void;
  onError: (errorMsg: string) => void;
}

export const PesticideOCRScanner: React.FC<PesticideOCRScannerProps> = ({ onScanSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64String = event.target?.result as string;
        await processImage(base64String);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error("File loading error:", error?.message || error);
      onError("Görsel yüklenirken bir hata oluştu.");
      setLoading(false);
    }
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processImage = async (base64Image: string) => {
    try {
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.substring( base64Image.indexOf(":")+1, base64Image.indexOf(";") );
      
      const responseTextRaw = await generateAIContent(
        'gemini-3-flash-preview',
        [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: `Sen bir zirai ilaç ve gübre etiket okuyucususun (OCR). 
Gönderilen görselden ürünün adını ve kategorisini çıkarman gerekiyor.

Çıkarılacak Kategoriler bunlardan biri OLMALIDIR:
- İnsektisit (Böcek)
- Herbisit (Ot)
- Fungisit (Mantar)
- Gübre / Besleme
- Bitki Gelişim Düzenleyici (BGD)
- Diğer

Yanıt SADECE VE KESİNLİKLE aşağıdaki gibi geçerli bir JSON objesi olmalıdır:
{
  "productName": "Örn: CORAGEN 20 SC",
  "category": "Örn: İnsektisit (Böcek)"
}
`
          }
        ]
      );

      let responseText = responseTextRaw || "";
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const result = JSON.parse(responseText);
        if (result.productName) {
           onScanSuccess({
              productName: result.productName,
              category: result.category
           });
        } else {
           onError("Ürün adı tespit edilemedi.");
        }
      } catch (e) {
         onError("Etiket verisi okunamadı. Farklı bir fotoğraf deneyin.");
      }

    } catch (error: any) {
       console.error("OCR Error:", error);
       onError(error?.message || "Tarama sırasında bir hata oluştu.");
    } finally {
       setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
      <button 
        type="button"
        disabled={loading}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold transition-colors border border-emerald-500/30 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
        {loading ? 'Taranıyor...' : 'Etiketten Tara'}
      </button>
    </div>
  );
};

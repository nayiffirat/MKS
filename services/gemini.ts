
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const GeminiService = {
  /**
   * Analyzes plant health using gemini-3.1-flash-image-preview for superior reasoning.
   */
  async analyzePlantImage(base64Image: string): Promise<string> {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
        }
        
        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API anahtarı bulunamadı.");
        }
        
        const ai = new GoogleGenAI({ apiKey });
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: cleanBase64
                        }
                    },
                    {
                        text: "Sen uzman bir Ziraat Mühendisisin. Bu fotoğraftaki bitkiyi derinlemesine analiz et. Varsa hastalığı, zararlıyı veya besin noksanlığını teşhis et. Teşhisin adını, nedenlerini ve profesyonel çözüm önerilerini (ilaçlama, gübreleme veya kültürel önlemler) içeren kısa bir rapor sun. Yanıtın teknik ama anlaşılır bir dille Türkçe olmalı."
                    }
                ]
            },
            config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                maxOutputTokens: 2000
            }
        });

        return response.text || "Görsel analiz edilemedi, lütfen tekrar deneyin.";
    } catch (error) {
      console.error("Gemini 3 Image Analysis Error:", error);
      if (error instanceof Error && error.message.includes("entity was not found")) {
          window.aistudio?.openSelectKey();
      }
      return "AI servisi şu an meşgul veya görsel işlenemedi. Lütfen tekrar deneyin.";
    }
  },

  /**
   * Structured plant disease diagnosis using Gemini 3.
   */
  async analyzePlantDisease(base64Image: string): Promise<any> {
    try {
        // Check for API Key first
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
            // Proceed anyway as per instructions to handle race condition
        }

        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API anahtarı bulunamadı.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: cleanBase64
                        }
                    },
                    {
                        text: `Sen uzman bir Ziraat Mühendisisin. Bu fotoğraftaki bitkiyi analiz et ve bulgularını JSON formatında döndür.
                        JSON yapısı şu şekilde olmalı:
                        {
                            "diseaseName": "Hastalık Adı",
                            "confidence": "Güven Skoru (0-100 arası sayı)",
                            "description": "Hastalığın kısa ve teknik açıklaması",
                            "symptoms": ["Belirti 1", "Belirti 2"],
                            "treatment": ["Tedavi 1", "Tedavi 2"],
                            "recommendedPesticides": ["İlaç Grubu 1", "İlaç Grubu 2"]
                        }
                        Sadece JSON döndür, başka metin ekleme. Türkçe kullan.`
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
            }
        });

        const text = response.text || "{}";
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("JSON parse error:", text);
            // Fallback if JSON is wrapped in markdown
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw e;
        }
    } catch (error) {
        console.error("Gemini 3 Disease Analysis Error:", error);
        if (error instanceof Error && (error.message.includes("entity was not found") || error.message.includes("API key"))) {
            window.aistudio?.openSelectKey();
        }
        throw error;
    }
  },

  /**
   * General agricultural knowledge assistant using Gemini 3.
   */
  async askAgriBot(prompt: string): Promise<string> {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
        }

        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API anahtarı bulunamadı.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: prompt,
            config: {
                systemInstruction: "Sen 'MKS Asistan' adında, deneyimli bir Kıdemli Ziraat Mühendisisin. Tarım mevzuatı, bitki koruma, bitki besleme ve akıllı tarım teknolojileri konularında uzmansın. Yanıtların profesyonel, yapıcı, kısa ve Türkçe olmalı. Gemini 3 motoru ile en güncel teknik verileri kullan.",
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                maxOutputTokens: 1000
            }
        });

        return response.text || "Üzgünüm, bu soruyu şu an yanıtlayamıyorum.";
    } catch (error) {
        console.error("Gemini 3 Text API Error:", error);
        if (error instanceof Error && error.message.includes("entity was not found")) {
            window.aistudio?.openSelectKey();
        }
        return "Bağlantı hatası oluştu. Lütfen sorunuzu tekrar sorun.";
    }
  },

  /**
   * Generates a structured visit report from a voice transcript.
   */
  async generateVisitReportFromVoice(transcript: string): Promise<string> {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
        }

        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API anahtarı bulunamadı.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `Aşağıdaki metin bir ziraat mühendisinin saha ziyareti sırasında aldığı sesli notun dökümüdür. 
            Bu metni profesyonel, yapılandırılmış ve teknik bir saha ziyaret raporuna dönüştür. 
            Rapor şu başlıkları içermeli (eğer metinde bilgi varsa): 
            - Genel Gözlem
            - Tespit Edilen Sorunlar (Hastalık/Zararlı)
            - Önerilen Uygulamalar
            - Çiftçiye Verilen Tavsiyeler
            
            Metin: "${transcript}"
            
            Yanıtın sadece rapor metni olsun, başka açıklama ekleme. Türkçe kullan.`,
            config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                maxOutputTokens: 1500
            }
        });

        return response.text || "Rapor oluşturulamadı.";
    } catch (error) {
        console.error("Gemini 3 Voice Report Error:", error);
        if (error instanceof Error && error.message.includes("entity was not found")) {
            window.aistudio?.openSelectKey();
        }
        return "AI raporu oluşturulurken bir hata oluştu.";
    }
  },

  /**
   * Parses a voice transcript into a structured prescription object.
   */
  async parsePrescriptionFromVoice(transcript: string): Promise<any> {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
        }

        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API anahtarı bulunamadı.");
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Aşağıdaki metin bir ziraat mühendisinin sesli olarak söylediği reçete bilgileridir. 
            Bu metni analiz et ve bilgileri JSON formatında döndür.
            
            Metin: "${transcript}"`,
            config: {
                systemInstruction: "Sen bir ziraat reçete analiz asistanısın. Verilen metinden çiftçi adını, ürün türünü, teşhisi ve ilaç listesini (isim, dozaj, uygulama şekli) ayıkla. Sadece JSON döndür.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        farmerName: { type: "STRING" },
                        cropType: { type: "STRING" },
                        diagnosis: { type: "STRING" },
                        recommendations: { type: "STRING" },
                        items: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    pesticideName: { type: "STRING" },
                                    dosage: { type: "STRING" },
                                    applicationMethod: { type: "STRING" }
                                },
                                required: ["pesticideName"]
                            }
                        }
                    }
                },
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
            }
        });

        const text = response.text || "{}";
        try {
            return JSON.parse(text);
        } catch (e) {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw e;
        }
    } catch (error: any) {
        console.error("Gemini 3 Prescription Parse Error:", error);
        if (error instanceof Error && (error.message.includes("entity was not found") || error.message.includes("API key"))) {
            window.aistudio?.openSelectKey();
        }
        throw error;
    }
  },

  /**
   * Checks compatibility between specific pesticides.
   */
  async checkMixtureCompatibility(pesticides: any[]): Promise<any> {
    try {
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
            await window.aistudio.openSelectKey();
        }

        const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("API anahtarı bulunamadı.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const pesticideList = pesticides.map(p => `${p.name} (${p.activeIngredient})`).join(", ");
        
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: `Sen uzman bir Ziraat Mühendisisin. Aşağıdaki ilaçların bir tank karışımında (mikstür) birlikte kullanılıp kullanılamayacağını analiz et.
            
            İlaç Listesi: ${pesticideList}
            
            Analizini şu JSON formatında döndür:
            {
                "status": "SAFE" | "WARNING" | "DANGER",
                "message": "Kısa özet (örn: Güvenli, Dikkatli Olunmalı, Kesinlikle Karıştırılmamalı)",
                "details": "Nedenleri ve teknik detayları içeren açıklama",
                "precautions": ["Önlem 1", "Önlem 2"]
            }
            
            Sadece JSON döndür, başka metin ekleme. Türkçe kullan.`,
            config: {
                responseMimeType: "application/json",
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
            }
        });

        const text = response.text || "{}";
        try {
            return JSON.parse(text);
        } catch (e) {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw e;
        }
    } catch (error: any) {
        console.error("Gemini 3 Compatibility Check Error:", error);
        if (error instanceof Error && (error.message.includes("entity was not found") || error.message.includes("API key"))) {
            window.aistudio?.openSelectKey();
        }
        throw error;
    }
  }
};

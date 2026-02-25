
import { GoogleGenAI } from "@google/genai";

// Strictly follow GenAI guidelines: use the API key directly from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const GeminiService = {
  /**
   * Analyzes plant health using gemini-3-flash-preview for superior reasoning.
   */
  async analyzePlantImage(base64Image: string): Promise<string> {
    try {
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
                // Enabling thinking for better analysis accuracy with limited budget
                thinkingConfig: { thinkingBudget: 1000 },
                maxOutputTokens: 2000
            }
        });

        return response.text || "Görsel analiz edilemedi, lütfen tekrar deneyin.";
    } catch (error) {
      console.error("Gemini 3 Image Analysis Error:", error);
      return "AI servisi şu an meşgul veya görsel işlenemedi. Lütfen tekrar deneyin.";
    }
  },

  /**
   * General agricultural knowledge assistant using Gemini 3.
   */
  async askAgriBot(prompt: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: "Sen 'MKS Asistan' adında, deneyimli bir Kıdemli Ziraat Mühendisisin. Tarım mevzuatı, bitki koruma, bitki besleme ve akıllı tarım teknolojileri konularında uzmansın. Yanıtların profesyonel, yapıcı, kısa ve Türkçe olmalı. Gemini 3 motoru ile en güncel teknik verileri kullan.",
                thinkingConfig: { thinkingBudget: 500 },
                maxOutputTokens: 1000
            }
        });

        return response.text || "Üzgünüm, bu soruyu şu an yanıtlayamıyorum.";
    } catch (error) {
        console.error("Gemini 3 Text API Error:", error);
        return "Bağlantı hatası oluştu. Lütfen sorunuzu tekrar sorun.";
    }
  }
};

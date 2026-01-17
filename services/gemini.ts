import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: In a real production app, you should not hardcode the API key in the frontend.
// Since this is a demo environment, we assume the key is injected via environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'DEMO_KEY' });

export const GeminiService = {
  async analyzePlantImage(base64Image: string): Promise<string> {
    try {
        // Remove data URL prefix if present for clean base64
        const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Optimized for speed and image tasks
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: cleanBase64
                        }
                    },
                    {
                        text: "Bu bir bitki hastalığı veya zararlısı fotoğrafı olabilir. Lütfen bir Ziraat Mühendisi gibi analiz et. Hastalığın/zararlının adını tahmin et ve kısa bir çözüm önerisi sun. Yanıtı Türkçe ver."
                    }
                ]
            }
        });

        return response.text || "Analiz yapılamadı.";
    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      return "Yapay zeka servisine ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.";
    }
  },

  async speechToText(audioBase64: string): Promise<string> {
      // Future implementation for voice notes
      return "Sesli not özelliği henüz aktif değil.";
  }
};
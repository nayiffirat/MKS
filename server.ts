import express from "express";
import path from "path";
import cors from 'cors';
import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';
import stringifySafe from 'json-stringify-safe';

async function startServer() {
  const app = express();
  // Cloud Run sets K_SERVICE, AIS doesn't.
  // AIS requires port 3000. Cloud Run requires PORT environment variable.
  const PORT = process.env.K_SERVICE ? (Number(process.env.PORT) || 8080) : 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());

  // AI Generation Endpoint (Server-side)
  // Bu endpoint, iOS tarafında API anahtarı veya CORS sorunlarını aşmak için merkezi köprüdür.
  app.post("/api/generate", async (req, res) => {
    try {
      // Hem platformun sağladığı hem de manuel girilen anahtarı kontrol et
      let apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
      
      // Kaynak belirginleştirme (Debugging)
      if (apiKey) {
        console.log(`[AI Proxy] API Anahtarı bulundu. Uzunluk: ${apiKey.length}. Başlangıç: ${apiKey.substring(0, 4)}...`);
      }

      if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey.length < 10) {
        console.error("KRİTİK: GEMINI_API_KEY bulunamadı veya çok kısa!");
        return res.status(500).json({ 
          error: "Sunucu tarafında API anahtarı (GEMINI_API_KEY) tanımlı değil. Lütfen Cloud Run ortam değişkenlerine GEMINI_API_KEY eklediğinizden emin olun.",
          code: "MISSING_API_KEY"
        });
      }

      const { model: modelName, contents, config } = req.body;
      
      // @google/genai v1.x SDK syntax:
      const ai = new GoogleGenAI({ apiKey: apiKey });
      
      // Normalize contents: if it's an array of parts, wrap it in a content object
      let normalizedContents = contents;
      if (Array.isArray(contents) && contents.length > 0 && !contents[0].parts && !contents[0].role) {
        normalizedContents = { role: 'user', parts: contents };
      }

      const response = await ai.models.generateContent({
        model: modelName || "gemini-3-flash-preview",
        contents: normalizedContents,
        config: config
      });

      const text = typeof response.text === 'function' ? await response.text() : response.text;
      res.json({ text: String(text || "") });
    } catch (error: any) {
      // Create a safe error representation to avoid cyclic serialization issues
      const safeError = {
        message: error.message || "Bilinmeyen bir hata oluştu",
        name: error.name,
        code: error.code || "AI_GENERATION_FAILED",
        status: error.status,
        details: error.details
      };
      
      console.error("AI Sunucu Hatası (Gemini):", safeError.message);
      
      // Log full error safely
      try {
        console.error("Full Error Debug:", stringifySafe(error));
      } catch (e) {
        console.error("Could not stringify even with stringifySafe");
      }

      res.status(500).json({ 
        error: String(safeError.message),
        code: String(safeError.code)
      });
    }
  });

  // Hata Ayıklama (Debug) Endpoint'i
  app.get("/api/check-ai", (req, res) => {
    res.json({
      status: "ready",
      hasKey: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      env: process.env.NODE_ENV || "development"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support React Router by serving index.html for all other routes
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}

startServer();

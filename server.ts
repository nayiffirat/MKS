import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import cors from 'cors';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // AI Route
  app.post('/api/ai/analyze', async (req: Request, res: Response): Promise<void> => {
    try {
      const { imageBase64, inventoryContext } = req.body;
      
      let apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
          apiKey = apiKey.replace(/['"]+/g, '').trim();
      }
      
      if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === '') {
          res.status(500).json({ error: 'Yapay zeka sistemi için gerekli anahtar (API Key) yapılandırılmamış. Lütfen yöneticiye başvurun veya Ayarlar > Yapay Zeka bölümünden kendi anahtarınızı tanımlayın.' });
          return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const generateAiContent = async (modelName: string) => {
          return await ai.models.generateContent({
              model: modelName,
              contents: {
                  parts: [
                      { text: "Lütfen bu bitki fotoğrafını bir ziraat mühendisi uzmanlığıyla analiz et. Varsa hastalıkları, zararlıları veya besin noksanlıklarını teşhis et. Teşhisin ismini, nedenini ve detaylı çözüm önerilerini (ilaç, etken madde veya kültürel önlem) profesyonel bir dille açıkla. Mümkün olduğunca spesifik ol." },
                      { inlineData: { mimeType, data: base64Data } }
                  ]
              },
              config: {
                  temperature: 0.1,
                  systemInstruction: `Sen, 'Mühendis Kayıt Sistemi' bünyesinde çalışan, üst düzey bir bitki koruma uzmanı ve ziraat mühendisisin.
                  
                  TEŞHİS VE ÇÖZÜM PROTOKOLÜ:
                  1. FOTOĞRAF ANALİZİ: Görüntüdeki belirtileri (leke, renk değişimi, şekil bozukluğu, böcek vb.) bilimsel olarak açıkla.
                  2. TEŞHİS: Sorun(lar)ın ismini ve şiddetini belirt.
                  3. TEDAVİ PLANI: Kimyasal, biyolojik ve kültürel mücadele yöntemlerini sıralar.
                  4. ÇİFTÇİ REÇETESİ: En altta kesinlikle "*** ÇİFTÇİ REÇETESİ ***" şeklinde bir başlık aç. Bu başlığın altına SADECE çiftçiye verilmesi/kullanması gereken ilaçların listesini, dozlarını ve uygulama şeklini madde madde yaz. Bu kısım kısa, net ve doğrudan raftan verilmeye hazır reçete formatında olmalıdır.
                  
                  DEPO ENVANTERİYLE TAM ENTEGRASYON:
                  Kullanıcının deposunda bulunan güncel ürün listesi aşağıdadır:
                  ${inventoryContext || 'Depoda kayıtlı ilaç bulunmuyor.'}
                  
                  KRİTİK TALİMAT:
                  - Reçete yazarken ÖNCELİKLE kullanıcının deposunda (listede) olan ilaçları öner. 
                  - Eğer depoda uygun ürün varsa: "**💡 Depondaki şu ürün(ler) bu sorun için tam çözümdür: [Ürün Adı]**" şeklinde vurgula.
                  - Depoda yoksa piyasadaki en etkili etken maddeleri öner.
                  
                  FORMAT: 
                  - Yanıtlarını yapılandırılmış markdown (baslıklar, listeler) kullanarak ver.
                  - Gereksiz giriş-sonuç cümlelerinden kaçın, direkt bilgi odaklı ol.
                  - Mühendislik ciddiyetiyle ama kullanıcıya yardımcı olan bir tonda yaz.`
              }
          });
      };

      let response;
      try {
          response = await generateAiContent("gemini-3.1-flash-preview");
      } catch (e: any) {
          console.warn("Primary AI model failed (likely 503), trying fallback...", e);
          response = await generateAiContent("gemini-3-flash-preview");
      }

      if (!response.text) {
          throw new Error('Yapay zeka yanıt üretemedi.');
      }

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("AI Server Error:", error);
      res.status(500).json({ 
          error: error.message || 'Analiz başarısız oldu.',
          details: error.response?.data || error
      });
    }
  });

  // AI Mixture Test Route
  app.post('/api/ai/mixture', async (req: Request, res: Response): Promise<void> => {
    try {
      const { pesticideNames } = req.body;
      
      let apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
          apiKey = apiKey.replace(/['"]+/g, '').trim();
      }
      
      if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === '') {
          res.status(500).json({ error: 'Yapay zeka sistemi için gerekli anahtar (API Key) yapılandırılmamış. Lütfen yöneticiye başvurun veya Ayarlar > Yapay Zeka bölümünden kendi anahtarınızı tanımlayın.' });
          return;
      }

      if (!pesticideNames) {
          res.status(400).json({ error: 'İlaç isimleri eksik.' });
          return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Şu tarım ilaçlarının (veya etken maddelerinin) karışım durumunu test et: ${pesticideNames}. 
      Karışıp karışamayacağını, neden karışmadığını veya karışırken nelere dikkat edilmesi gerektiğini kısa bir özetle yaz. 
      Eğer kesin bir bilgi yoksa, "Kavanoz testi yapılması önerilir" şeklinde belirt.`;

      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
              temperature: 0.1
          }
      });

      if (!response.text) {
          throw new Error('Yapay zeka yanıt üretemedi.');
      }

      res.json({ result: response.text });
    } catch (error: any) {
      console.error("AI Mixture Error:", error);
      res.status(500).json({ 
          error: error.message || 'Karışım testi başarısız oldu.',
          details: error.response?.data || error
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

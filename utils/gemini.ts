import { API_BASE } from './api';
import { auth } from '../services/firebase';

export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

export const generateAIContent = async (modelName: string, contents: any, config?: any): Promise<string> => {
  const payload = JSON.stringify({
    model: modelName || DEFAULT_GEMINI_MODEL,
    contents: contents,
    config: config
  });

  let idToken: string | null = null;
  try {
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch {
    idToken = null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
  };

  // Denenecek uç noktalar (Önce mevcut origin / API_BASE, ardından yerel sunucu 3000)
  const endpoints = Array.from(
    new Set([
      `${API_BASE}/api/generate`,
      '/api/generate',
      'http://127.0.0.1:3000/api/generate'
    ])
  );

  let lastError = 'Yapay zeka servisine ulaşılamadı.';

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        lastError = errData.error || `HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      if (data && typeof data.text === 'string' && data.text.trim()) {
        return data.text;
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
    }
  }

  console.error('MKS AI Proxy Error:', lastError);
  throw new Error(lastError);
};

/**
 * Ziraat Mühendisi Yapay Zeka Sorusu Sor
 */
export const askAgronomistAI = async (userPrompt: string, cropContext?: string, businessContext?: string) => {
  const systemContext = `Sen Türkiye'nin en deneyimli, uzman Ziraat Mühendisi ve MKS (Mühendis Kayıt Sistemi) Yapay Zeka Danışmanısın (TARGEM / TAGEM ve Ziraat Fakültesi teknik kaynaklarına %100 hakimsin).
Sana sorulan tarımsal veya işletme/stok/finans sorularına son derece detaylı, akademik ama çiftçi ve ziraat mühendisinin doğrudan sahada ve bayide uygulayabileceği pratik, net ve Türkçe yanıtlar ver.

Eğer soru bitki hastalıkları, zararlılar, gübreleme veya ilaçlama hakkındaysa şu başlıkları kullan:
1. **Teşhis & Durum Özeti**: Sorunun teknik ve fizyolojik tanımı.
2. **Kültürel ve Biyolojik Önlemler**: İlaçsız çözüm, havalandırma, budama, sulama, ekim nöbeti.
3. **Kimyasal Mücadele & Etken Maddeler**: Türkiye'de ruhsatlı resmi etken maddeler (Aktif maddeler), depodaki mevcut uygun ilaçlar ve örnek ticari isimler.
4. **Dozaj & PHI (Hasat Arası Süre)**: Uygulama zamanı ve güvenlik kuralları.
5. **Kritik Uyarılar**: Hava sıcaklığı, rüzgar, pH, tank karışım uyarıları.

Eğer soru MKS içindeki stoklar, çiftçi borçları, kasa durumu veya finansal analiz hakkındaysa aşağıdaki canlı işletme verilerini baz alarak net rakamlarla yanıt ver.
${cropContext ? `\nİlgili Bitki Bağlamı: ${cropContext}` : ''}
${businessContext ? `\nCANLI MKS İŞLETME & DEPO VERİLERİ:\n${businessContext}` : ''}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: `${systemContext}\n\nKullanıcı Sorusu: ${userPrompt}` }]
    }
  ];

  return await generateAIContent(DEFAULT_GEMINI_MODEL, contents);
};

/**
 * Kameradan veya Galeriden Yaprak / Hastalık Fotoğrafı Analizi (Gemini Vision)
 */
export const analyzeLeafImageAI = async (base64Data: string, mimeType: string = 'image/jpeg', cropHint?: string) => {
  const prompt = `Sen uzman bir Bitki Koruma Ziraat Mühendisisin. Gönderilen yaprak/bitki fotoğrafını detaylı analiz et.

Lütfen aşağıdaki formatta tamamen geçerli bir JSON yanıtı döndür (JSON kod bloğu markdown olmadan, doğrudan JSON string olarak):
{
  "cropName": "Tespit edilen bitki adı (Örn: Domates, Pamuk, Buğday...)",
  "problemType": "HASTALIK" veya "ZARARLI" veya "YABANCI_OT" veya "BESLEME" veya "SAĞLIKLI" veya "BULUNAMADI",
  "name": "Hastalık/Zararlı Türkçe Adı ve Latince İsmi (Örn: Erken Yaprak Yanıklığı - Alternaria solani)",
  "confidence": "%95",
  "description": "Görseldeki semptomların detaylı yapay zeka analizi ve leke/hasar tanımı.",
  "culturalControls": ["Kültürel önlem 1", "Kültürel önlem 2"],
  "activeIngredients": ["Aktif Madde 1 (örn. Azoxystrobin)", "Aktif Madde 2"],
  "commercialNames": ["Örnek İlaç 1", "Örnek İlaç 2"],
  "solutionDescription": "Uygulama zamanı, dozu ve dikkat edilmesi gereken noktalar.",
  "phiDays": "Hasat arası bekleme süresi (örn: 7 gün)"
}

${cropHint ? `Kullanıcı Notu/Bitki Bilgisi: ${cropHint}` : ''}`;

  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  const contents = [
    {
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64
          }
        }
      ]
    }
  ];

  return await generateAIContent(DEFAULT_GEMINI_MODEL, contents);
};

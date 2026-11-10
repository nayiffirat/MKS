import { API_BASE } from './api';

export const generateAIContent = async (modelName: string, contents: any, config?: any) => {
  try {
    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName || 'gemini-3.6-flash',
        contents: contents,
        config: config
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error("Gemini API Proxy Error:", errorMessage);
    throw new Error(errorMessage);
  }
};

/**
 * Ziraat Mühendisi Yapay Zeka Sorusu Sor
 */
export const askAgronomistAI = async (userPrompt: string, cropContext?: string) => {
  const systemContext = `Sen Türkiye'nin en deneyimli, uzman Ziraat Mühendisisin (TARGEM / TAGEM ve Ziraat Fakültesi teknik kaynaklarına %100 hakimsin).
Sana sorulan tarımsal sorulara son derece detaylı, akademik ama çiftçi ve ziraat mühendisinin doğrudan tarlada uygulayabileceği pratik, net ve Türkçe yanıtlar ver.

Yanıt verirken şu başlıkları ve yapıları kullan:
1. **Teşhis & Durum Özeti**: Sorunun teknik ve fizyolojik tanımı.
2. **Kültürel ve Biyolojik Önlemler**: İlaçsız çözüm, havalandırma, budama, sulama, ekim nöbeti.
3. **Kimyasal Mücadele & Etken Maddeler**: Türkiye'de ruhsatlı resmi etken maddeler (Aktif maddeler) ve örnek ilaç ticari isimleri.
4. **Dozaj & PHI (Hasat Arası Süre)**: Uygulama zamanı ve güvenlik kuralları.
5. **Kritik Uyarılar**: Hava sıcaklığı, rüzgar, pH, tank karışım uyarıları.

${cropContext ? `İlgili Bitki Bağlamı: ${cropContext}` : ''}`;

  const contents = [
    {
      role: 'user',
      parts: [
        { text: `${systemContext}\n\nÇiftçi/Kullanıcı Sorusu: ${userPrompt}` }
      ]
    }
  ];

  return await generateAIContent('gemini-3.6-flash', contents);
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

  return await generateAIContent('gemini-3.6-flash', contents);
};


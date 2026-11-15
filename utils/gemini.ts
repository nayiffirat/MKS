import { API_BASE, PUBLIC_PORTAL_ORIGIN } from './api';
import { auth } from '../services/firebase';

export const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

export interface AIChatHistoryTurn {
  role: 'user' | 'ai';
  text: string;
}

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

  // Denenecek uç noktalar (Mevcut origin / API_BASE, bulut Portal API ve yerel sunucu 3000)
  const endpoints = Array.from(
    new Set([
      ...(API_BASE ? [`${API_BASE}/api/generate`] : []),
      '/api/generate',
      `${PUBLIC_PORTAL_ORIGIN}/api/generate`,
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
 * Ziraat Mühendisi & MKS İşletme Copilot Yapay Zeka Sorusu Sor (Çok turlu hafıza destekli)
 */
export const askAgronomistAI = async (
  userPrompt: string,
  cropContext?: string,
  businessContext?: string,
  history?: AIChatHistoryTurn[]
) => {
  const systemContext = `Sen Türkiye'nin en deneyimli, uzman Ziraat Mühendisi ve MKS (Mühendis Kayıt Sistemi) Yapay Zeka Karar Destek Danışmanısın (T.C. Tarım ve Orman Bakanlığı Resmi BKÜ Kataloğu, TAGEM teknik bültenleri ve Ziraat Fakültesi doktrinlerine %100 hakimsin).
Sana sorulan tarımsal veya işletme/stok/cari/finans sorularına son derece detaylı, sayısal kanıtlara dayalı, doğrudan sahada ve bayide aksiyon alınabilir net ve Türkçe yanıtlar ver.

Eğer soru bitki hastalıkları, zararlılar, gübreleme, tank karışımı veya ilaçlama hakkındaysa şu başlıkları kullan:
1. **Teşhis & Eşik Özeti**: Etmenin biyolojik tanımı ve Ekonomik Zarar Eşiği (EZE).
2. **Kültürel ve Biyolojik Önlemler**: İlaçsız çözüm, havalandırma, budama, sulama, ekim nöbeti.
3. **Kimyasal Mücadele & Depo / BKÜ Eşleşmesi**: Resmi ruhsatlı etken maddeler, direnç yönetimi (IRAC/FRAC/HRAC) ve varsa bayinin kendi deposundaki uygun mevcut ilaçlar (stok adediyle).
4. **Dozaj, Tank Karışımı & PHI (Hasat Arası Süre)**: Uygulama zamanı, su pH/sertlik ve güvenli bekleme süresi.

Eğer soru MKS içindeki stoklar, SKT takibi, çiftçi borçları, tahsilat önceliği, kasa durumu veya finansal analiz hakkındaysa aşağıdaki canlı işletme verilerini ve RAG eşleşmelerini baz alarak isim, miktar ve net TL/döviz rakamlarıyla yanıt ver; somut aksiyon listesi öner.
${cropContext ? `\nİlgili Bitki Bağlamı:\n${cropContext}` : ''}
${businessContext ? `\nCANLI MKS İŞLETME, DEPO VE RESMİ BKÜ VERİLERİ:\n${businessContext}` : ''}`;

  const recentTurns = (history || [])
    .filter(turn => turn.text && turn.text.trim())
    .slice(-8)
    .map(turn => ({
      role: turn.role === 'ai' ? 'model' : 'user',
      parts: [{ text: turn.text.slice(0, 2000) }]
    }));

  const contents = [
    ...recentTurns,
    {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  ];

  return await generateAIContent(DEFAULT_GEMINI_MODEL, contents, {
    systemInstruction: systemContext
  });
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

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Bot, Loader2, Leaf, Image as ImageIcon, Sparkles, ArrowLeft, AlertTriangle,
  ScanSearch, FileText, Info, Camera, Sprout, RefreshCw, Send, MessageSquare,
  Package, TrendingUp, Users, Wallet, CheckCircle2
} from 'lucide-react';
import { dbService } from '../services/db';
import { generateAIContent, askAgronomistAI } from '../utils/gemini';
import { useAppViewModel } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';

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

interface ChatMsg {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
}

function parseAIResponse(text: string): ParsedAIResponse | null {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned.trim());
  } catch (e) {
    return null;
  }
}

export const AIAssistant: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { inventory, farmers, stats, accounts, suppliers, prescriptions, userProfile } = useAppViewModel();
  const currency = userProfile?.currency || 'TRY';

  const [activeTab, setActiveTab] = useState<'CHAT' | 'VISION'>('CHAT');

  // Vision Scanner States
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'result' | 'error'>('idle');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ParsedAIResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Live AI Chat Copilot States
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: 'Merhaba! Ben **MKS Zirai & Finansal Yapay Zeka Asistanınızım**. Deponuzdaki canlı ilaç stoklarına, çiftçi bakiyelerinize, kasa durumunuza ve TARGEM/TAGEM bitki koruma veritabanına doğrudan bağlıyım.\n\nBana hem **bitki hastalıkları / reçete / dozaj** sorabilir hem de **deponuzdaki stokları, borçlu müşterileri ve finansal durumunuzu** analiz ettirebilirsiniz.',
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Build live MKS ERP context string for the AI Copilot
  const liveBusinessContext = useMemo(() => {
    const totalKasa = (accounts || []).reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const totalSupplierDebt = (suppliers || []).reduce((acc, s) => acc + ((s.balance || 0) < 0 ? Math.abs(s.balance) : 0), 0);
    const debtors = (farmers || [])
      .filter(f => !f.deletedAt && (f.balance || 0) < -0.01)
      .sort((a, b) => (a.balance || 0) - (b.balance || 0));

    const topDebtorsStr = debtors
      .slice(0, 8)
      .map(f => `${f.fullName}: ${formatCurrency(Math.abs(f.balance || 0), currency)}`)
      .join(', ');

    const inStockItems = (inventory || [])
      .filter(i => (Number(i.quantity) || 0) > 0)
      .slice(0, 30)
      .map(i => `${i.pesticideName} (${i.category}): ${i.quantity} ${i.unit} [Alış: ${formatCurrency(i.buyingPrice, currency)}, Satış: ${formatCurrency(i.sellingPrice, currency)}]`)
      .join('\n');

    const criticalStockItems = (inventory || [])
      .filter(i => (Number(i.quantity) || 0) <= (Number(i.lowStockThreshold) || 5))
      .map(i => `${i.pesticideName}: ${i.quantity} ${i.unit} kaldı`)
      .join(', ');

    return [
      `- Toplam Müşteri Alacağı (Çiftçi Borcu): ${formatCurrency(stats.totalDebt || 0, currency)} (${debtors.length} borçlu çiftçi)`,
      `- En Yüksek Borçlu Çiftçiler: ${topDebtorsStr || 'Borçlu çiftçi yok'}`,
      `- Kasa ve Banka Toplam Mevcudu: ${formatCurrency(totalKasa, currency)}`,
      `- Tedarikçilere Toplam Borcumuz: ${formatCurrency(totalSupplierDebt, currency)}`,
      `- Depo Toplam Stok Maliyeti: ${formatCurrency(stats.inventoryValue || 0, currency)} | Potansiyel Satış Cirosu: ${formatCurrency(stats.potentialRevenue || 0, currency)}`,
      `- Toplam Satış Cirosu: ${formatCurrency(stats.totalSales || 0, currency)} (${prescriptions.length} reçete/fatura)`,
      `- Kritik / Azalan Stoklar: ${criticalStockItems || 'Kritik seviyede ürün yok'}`,
      `- Depodaki Mevcut Ürünler:\n${inStockItems || 'Depoda ürün kayıtlı değil'}`
    ].join('\n');
  }, [inventory, farmers, stats, accounts, suppliers, prescriptions, currency]);

  const handleSendChat = async (presetPrompt?: string) => {
    const promptText = (presetPrompt || chatInput).trim();
    if (!promptText || isSending) return;

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: promptText,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!presetPrompt) setChatInput('');
    setIsSending(true);

    try {
      const reply = await askAgronomistAI(promptText, undefined, liveBusinessContext);
      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          text: reply || 'Yanıt oluşturulamadı, lütfen tekrar deneyin.',
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'ai',
          text: `Yapay zeka servisine bağlanırken bir hata oluştu: ${err?.message || 'Bağlantı hatası'}`,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const startAnalysis = async (base64Image: string) => {
    setAnalysisState('analyzing');
    setCurrentImage(base64Image);
    setResultData(null);
    setErrorMessage(null);

    try {
      let depotInfoStr = '';
      try {
        const inv = await dbService.getInventory();
        const pesticides = await dbService.getPesticides();
        const availableProducts = inv
          .filter(i => i.quantity > 0)
          .map(i => i.pesticideName || pesticides.find(p => p.id === i.pesticideId)?.name)
          .filter(Boolean);

        if (availableProducts.length > 0) {
          depotInfoStr = `\n\nDEPODAKİ MEVCUT ÜRÜNLER:\n${availableProducts.join(', ')}\n\nÖNEMLİ: Reçete oluştururken (Özellikle "ornek_ticari_urun_referanslari" kısmında) ÖNCELİKLİ OLARAK yukarıda listelenen ve depomuzda mevcut olan ürünleri önermeye çalış. Eğer depodaki bir ürünü öneriyorsan isminin sonuna " (Depoda Mevcut)" ibaresini ekle. Eğer depoda uygun ürün yoksa dışarıdan diğer tavsiye ürünlerinizi önerebilirsin.`;
        }
      } catch (err) {
        console.error('Depo bilgisi alınamadı', err);
      }

      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

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
          { text: 'Bu görseli tarımsal açıdan detaylıca analiz et ve JSON şemasına tam uygun yanıt ver.' }
        ],
        config
      );

      const parsed = parseAIResponse(text || '');
      if (parsed) {
        setResultData(parsed);
        setAnalysisState('result');
      } else {
        setErrorMessage('Gelen yanıt anlaşılamadı. Farklı bir görsel seçerek tekrar deneyin.');
        setAnalysisState('error');
      }
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      setErrorMessage(error?.message || error?.toString() || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      setAnalysisState('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
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

  const quickPrompts = [
    {
      icon: Package,
      label: 'Depo & Kritik Stok Analizi',
      prompt: 'Depomdaki mevcut ürünleri ve kritik/azalan stokları inceleyip hangi ürünleri acil sipariş etmem gerektiğini listele.'
    },
    {
      icon: Users,
      label: 'Alacak & Tahsilat Özeti',
      prompt: 'En yüksek borcu olan çiftçilerimi analiz et ve tahsilat öncelik sırası ile nakit akışı tavsiyesi ver.'
    },
    {
      icon: Sprout,
      label: 'Pamuk Zararlı Reçetesi (Depodan)',
      prompt: 'Pamukta yaprak biti, yeşil kurt ve kırmızı örümcek için depomdaki mevcut ilaçları da dikkate alarak reçete ve dozaj öner.'
    },
    {
      icon: Leaf,
      label: 'Buğday Ot & Gübreleme',
      prompt: 'Buğday kardeşlenme ve sapa kalkma döneminde yabancı ot mücadelesi ve üst gübreleme programını açıkla.'
    },
    {
      icon: Wallet,
      label: 'Kasa & Finansal Durum Yorumu',
      prompt: 'Canlı kasa bakiyemi, toplam müşteri alacaklarımı, tedarikçi borçlarımı ve depo maliyetimi karşılaştırarak finansal sağlık raporu çıkar.'
    },
    {
      icon: Sparkles,
      label: 'Domates Yaprak Yanıklığı',
      prompt: 'Domateste erken ve geç yaprak yanıklığı (Alternaria / Phytophthora) teşhisi, etken maddeleri ve uygulama dozlarını yaz.'
    }
  ];

  const renderFormattedText = (raw: string) => {
    const html = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-400 font-bold">$1</strong>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n- /g, '<br/>• ')
      .replace(/\n\* /g, '<br/>• ')
      .replace(/\n(\d+)\. /g, '<br/><strong>$1.</strong> ');
    return <div className="leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 pb-28 space-y-5 animate-in fade-in duration-300">
      {/* Header & Mode Switcher */}
      <div className="v22-card rounded-[28px] p-4 sm:p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-stone-900/70 border border-white/10 rounded-2xl hover:bg-stone-800 transition-all"
          >
            <ArrowLeft size={18} className="text-stone-200" />
          </button>
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg flex items-center justify-center shrink-0">
            <Sparkles className="v22-keep-white text-white" size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-stone-100">
                MKS Yapay Zeka Merkezi
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={11} /> Canlı Aktif
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Canlı Depo, Cari & Ziraat Mühendisi AI Copilot + Görsel Bitki Teşhisi
            </p>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex bg-stone-950/70 p-1 rounded-2xl border border-white/10 shrink-0">
          <button
            onClick={() => setActiveTab('CHAT')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'CHAT'
                ? 'bg-emerald-600 v22-keep-white text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <MessageSquare size={14} />
            AI Danışman & Copilot
          </button>
          <button
            onClick={() => setActiveTab('VISION')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'VISION'
                ? 'bg-emerald-600 v22-keep-white text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Camera size={14} />
            Görsel Bitki Teşhisi
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: LIVE AI CHAT & ERP COPILOT ==================== */}
      {activeTab === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Quick Prompts Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="v22-card rounded-[26px] p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-stone-400">
                  Hızlı Zirai & Finansal Komutlar
                </span>
                <Sparkles size={14} className="text-emerald-400" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {quickPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendChat(item.prompt)}
                    disabled={isSending}
                    className="w-full text-left p-3 rounded-2xl bg-stone-950/50 hover:bg-stone-900 border border-white/5 hover:border-emerald-500/30 transition-all flex items-center gap-3 group disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                      <item.icon size={15} />
                    </div>
                    <span className="text-xs font-bold text-stone-200 group-hover:text-emerald-400 transition-colors">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live ERP Snapshot Badge */}
            <div className="v22-card rounded-[26px] p-4 border border-white/10 space-y-2.5">
              <div className="text-[11px] font-black uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <TrendingUp size={13} className="text-emerald-400" />
                AI Bağlı Canlı Veritabanı
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-stone-950/50 border border-white/5">
                  <span className="text-[10px] text-stone-400 block">Depo Çeşidi</span>
                  <span className="font-black text-stone-100">{inventory.length} Ürün</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-950/50 border border-white/5">
                  <span className="text-[10px] text-stone-400 block">Kayıtlı Çiftçi</span>
                  <span className="font-black text-stone-100">{farmers.length} Cari</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-950/50 border border-white/5 col-span-2">
                  <span className="text-[10px] text-stone-400 block">Toplam Alacak (Aktif)</span>
                  <span className="font-black text-emerald-400">
                    {formatCurrency(stats.totalDebt || 0, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Conversation Panel */}
          <div className="lg:col-span-8 v22-card rounded-[28px] border border-white/10 flex flex-col h-[540px] sm:h-[600px] overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-4 ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 v22-keep-white text-white rounded-br-none shadow-md'
                        : 'bg-stone-950/70 border border-white/10 text-stone-200 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-75 flex items-center gap-1">
                        {msg.role === 'ai' ? (
                          <>
                            <Bot size={12} className="text-emerald-400" /> MKS Ziraat & ERP AI
                          </>
                        ) : (
                          'Siz'
                        )}
                      </span>
                      <span className="text-[10px] opacity-60">{msg.time}</span>
                    </div>
                    {msg.role === 'ai' ? (
                      renderFormattedText(msg.text)
                    ) : (
                      <p className="text-sm leading-relaxed v22-keep-white">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-stone-950/70 border border-white/10 rounded-2xl rounded-bl-none p-4 flex items-center gap-3 text-stone-300">
                    <Loader2 size={18} className="animate-spin text-emerald-400" />
                    <span className="text-xs font-bold">
                      MKS veritabanı ve zirai kaynaklar taranıyor...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-3 sm:p-4 border-t border-white/10 bg-stone-950/50 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Zirai hastalık, ilaç dozu, stok durumu veya borç analizi sorun..."
                className="flex-1 bg-stone-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-500 outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                disabled={isSending || !chatInput.trim()}
                className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 v22-keep-white text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-md"
              >
                <Send size={15} />
                <span className="hidden sm:inline">Gönder</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: VISUAL LEAF & DISEASE SCANNER ==================== */}
      {activeTab === 'VISION' && (
        <div className="v22-card rounded-[28px] p-5 sm:p-8 border border-white/10">
          {analysisState === 'idle' && (
            <div className="flex flex-col items-center justify-center text-center py-6">
              <div className="w-24 h-24 bg-emerald-500/10 rounded-[32px] border border-emerald-500/20 flex items-center justify-center relative mb-6">
                <Bot size={44} className="text-emerald-400" strokeWidth={1.6} />
                <div className="absolute -bottom-2 -right-2 bg-emerald-500 v22-keep-white text-white rounded-full p-2 shadow-lg">
                  <Sprout size={16} />
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-stone-100 tracking-tight mb-2">
                Bitkinizi <span className="text-emerald-400">Görselden Teşhis Edin</span>
              </h2>
              <p className="text-stone-400 max-w-md mx-auto text-sm leading-relaxed mb-8">
                Yaprak, meyve veya zararlı fotoğrafını yükleyin; yapay zeka hastalığı teşhis etsin ve
                öncelikle <strong className="text-stone-200">deponuzda mevcut olan ilaçlardan</strong> reçete oluştursun.
              </p>

              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 py-7 px-4 bg-stone-950/60 border border-white/10 hover:border-emerald-500/40 rounded-3xl transition-all active:scale-[0.98] group"
                >
                  <div className="w-14 h-14 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
                    <Camera size={26} strokeWidth={1.8} />
                  </div>
                  <span className="block text-sm font-bold text-stone-100">Kamera ile Çek</span>
                </button>

                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 py-7 px-4 bg-stone-950/60 border border-white/10 hover:border-emerald-500/40 rounded-3xl transition-all active:scale-[0.98] group"
                >
                  <div className="w-14 h-14 bg-blue-500/15 text-blue-400 rounded-full flex items-center justify-center group-hover:scale-105 transition-all">
                    <ImageIcon size={26} strokeWidth={1.8} />
                  </div>
                  <span className="block text-sm font-bold text-stone-100">Galeriden Seç</span>
                </button>
              </div>
            </div>
          )}

          {analysisState === 'analyzing' && currentImage && (
            <div className="flex flex-col items-center justify-center text-center py-8 max-w-sm mx-auto">
              <div className="relative mb-8">
                <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                  <img src={currentImage} className="w-60 h-60 object-cover" alt="Analyzing" />
                </div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-stone-900 border border-emerald-500/30 rounded-full px-5 py-2 shadow-xl flex items-center gap-2.5">
                  <Loader2 size={16} className="animate-spin text-emerald-400" />
                  <span className="text-xs font-bold text-stone-100 whitespace-nowrap">
                    Analiz Ediliyor...
                  </span>
                </div>
              </div>
              <p className="text-stone-400 text-sm animate-pulse">
                Bitki dokusu ve depo stok uyumu inceleniyor...
              </p>
            </div>
          )}

          {analysisState === 'error' && errorMessage && (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mb-4 border border-red-500/20">
                <AlertTriangle size={36} />
              </div>
              <h2 className="text-xl font-black text-stone-100 mb-2">Teşhis Tamamlanamadı</h2>
              <p className="text-stone-400 max-w-sm mb-6 text-sm">{errorMessage}</p>
              <button
                onClick={resetScanner}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 v22-keep-white text-white rounded-2xl font-bold text-xs transition-all"
              >
                <RefreshCw size={16} />
                Yeni Tarama Başlat
              </button>
            </div>
          )}

          {analysisState === 'result' && resultData && (
            <div className="max-w-xl mx-auto space-y-5">
              {currentImage && (
                <div className="relative h-52 w-full rounded-3xl overflow-hidden shadow-xl border border-white/10">
                  <img src={currentImage} className="w-full h-full object-cover" alt="Analyzed" />
                  <div className="absolute bottom-3 left-3 bg-stone-950/80 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Bot size={14} /> Yapay Zeka Teşhisi Tamamlandı
                  </div>
                </div>
              )}

              {!resultData.basarili_mi ? (
                <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl flex gap-4">
                  <AlertTriangle size={24} className="text-red-400 shrink-0" />
                  <div>
                    <span className="block font-bold text-stone-100 text-base mb-1">
                      Sorun Tespit Edilemedi
                    </span>
                    <p className="text-sm text-stone-300">
                      {resultData.hata_mesaji ||
                        'Görselden tarımsal bir veri çıkarılamadı. Farklı bir fotoğraf deneyin.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-stone-950/60 border border-white/10 p-5 rounded-3xl space-y-4">
                    <h3 className="text-stone-100 font-black flex items-center gap-2.5 text-base">
                      <ScanSearch size={20} className="text-emerald-400" />
                      Teşhis Sonucu
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-stone-900/70 rounded-2xl p-3.5 border border-white/5">
                        <span className="text-[11px] text-stone-400 block mb-0.5">Bitki Türü</span>
                        <span className="font-bold text-stone-100 text-sm">
                          {resultData.teshis?.bitki_turu}
                        </span>
                      </div>
                      <div className="bg-stone-900/70 rounded-2xl p-3.5 border border-white/5">
                        <span className="text-[11px] text-stone-400 block mb-0.5">Kategori</span>
                        <span className="font-bold text-stone-100 text-sm">
                          {resultData.teshis?.sorun_kategorisi}
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20">
                      <span className="text-[11px] text-emerald-400 block font-bold mb-1">
                        Sorun Adı / Etmen
                      </span>
                      <span className="font-black text-stone-100 text-lg">
                        {resultData.teshis?.sorun_adi}
                      </span>
                    </div>

                    <div className="bg-stone-900/70 rounded-2xl p-3.5 border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-stone-400">Teşhis Güvenilirliği</span>
                        <span className="text-stone-100 font-black text-sm">
                          %{resultData.teshis?.guvenilirlik_yuzdesi || 0}
                        </span>
                      </div>
                      <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${resultData.teshis?.guvenilirlik_yuzdesi || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {resultData.recete && (
                    <div className="bg-stone-950/60 border border-white/10 p-5 rounded-3xl space-y-3">
                      <h3 className="text-stone-100 font-black flex items-center gap-2.5 text-base">
                        <FileText size={20} className="text-blue-400" />
                        Mühendis Reçetesi (Depo Uyumlu)
                      </h3>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-stone-900/70 rounded-2xl p-3.5 border border-white/5">
                          <span className="text-[11px] text-stone-400 block mb-0.5">Ürün Grubu</span>
                          <span className="font-bold text-stone-100 text-sm">
                            {resultData.recete.urun_grubu}
                          </span>
                        </div>
                        <div className="bg-stone-900/70 rounded-2xl p-3.5 border border-white/5">
                          <span className="text-[11px] text-stone-400 block mb-0.5">
                            Uygulama Dozu
                          </span>
                          <span className="font-bold text-stone-100 text-sm">
                            {resultData.recete.uygulama_dozu}
                          </span>
                        </div>
                      </div>

                      <div className="bg-stone-900/70 rounded-2xl p-4 border border-white/5">
                        <span className="text-[11px] text-stone-400 block mb-1">
                          Aktif Madde ve Oranı
                        </span>
                        <span className="font-bold text-stone-100 text-sm">
                          {resultData.recete.aktif_madde_ve_orani}
                        </span>
                      </div>

                      <div className="bg-stone-900/70 rounded-2xl p-4 border border-white/5">
                        <span className="text-[11px] text-stone-400 block mb-2">
                          Önerilen Ticari Ürünler
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {resultData.recete.ornek_ticari_urun_referanslari?.map((ref, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold rounded-full text-xs"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>

                      {resultData.recete.ziraat_muhendisi_notu && (
                        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex gap-3">
                          <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs text-blue-400 font-bold block mb-0.5">
                              Ziraat Mühendisi Notu
                            </span>
                            <p className="text-xs text-stone-300 leading-relaxed">
                              {resultData.recete.ziraat_muhendisi_notu}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={resetScanner}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 v22-keep-white text-white rounded-2xl font-bold text-sm transition-all shadow-lg"
              >
                <ScanSearch size={18} />
                Yeni Görsel Tara
              </button>
            </div>
          )}

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
      )}
    </div>
  );
};

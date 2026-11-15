import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Calculator,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Droplets,
  FileCheck2,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Info,
  Layers,
  Leaf,
  Loader2,
  LucideIcon,
  MessageSquare,
  Mic,
  MicOff,
  Package,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
  Video,
  Wallet,
  Wheat,
  X
} from 'lucide-react';
import { dbService } from '../services/db';
import { generateAIContent, askAgronomistAI, AIChatHistoryTurn } from '../utils/gemini';
import { useAppViewModel } from '../context/AppContext';
import { formatCurrency } from '../utils/currency';
import { OFFICIAL_BKU_CATALOG } from '../constants/bkuCatalog';
import { CROP_CATEGORIES } from '../constants/cropData';
import { CROP_AGRONOMY_PROFILES } from '../constants/agriKnowledge';
import {
  analyzeQueryLocallyAndEnrich,
  BkuMatchResult,
  buildSmartErpRadar,
  calculateSmartPrescription,
  findMatchesForDiagnosis,
  getAllCropsFlat,
  getProblemsForCrop,
  QueryEnrichmentResult
} from '../utils/aiIntelligenceEngine';
import { InventoryItem } from '../types';

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
  engineSource?: 'CLOUD_RAG' | 'LOCAL_RAG' | 'WELCOME';
  enrichment?: QueryEnrichmentResult;
}

type PromptCategory = 'TÜMÜ' | 'FİNANS' | 'DEPO' | 'ZİRAİ' | 'TANK';

interface QuickPromptDef {
  id: string;
  category: Exclude<PromptCategory, 'TÜMÜ'>;
  icon: LucideIcon;
  label: string;
  subtitle: string;
  prompt: string;
}

export interface AIAssistantProps {
  onBack: () => void;
  onNavigate?: (view: string) => void;
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
  } catch {
    return null;
  }
}

const WELCOME_MSG: ChatMsg = {
  id: 'welcome',
  role: 'ai',
  engineSource: 'WELCOME',
  time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  text:
    'Merhaba! Ben **MKS Hibrit Yapay Zeka & Karar Destek Asistanınızım**.\n\n' +
    'Deponuzdaki canlı ilaç stoklarına, çiftçi cari ve vade bakiyelerine, kasa/banka durumunuza, **1.089 ruhsatlı Bakanlık BKÜ ilacına** ve **32 kültür bitkisi agronomi pasaportuna** doğrudan bağlıyım.\n\n' +
    'Sol menüden bir bitki seçebilir, tek tıkla hızlı finansal/zirai analiz çalıştırabilir ya da sesli/yazılı soru sorabilirsiniz.'
};

export const AIAssistant: React.FC<AIAssistantProps> = ({ onBack, onNavigate }) => {
  const {
    inventory,
    farmers,
    stats,
    accounts,
    suppliers,
    prescriptions,
    reminders,
    visits,
    expenses,
    userProfile,
    showToast
  } = useAppViewModel();
  const currency = userProfile?.currency || 'TRY';

  const [activeTab, setActiveTab] = useState<'CHAT' | 'RADAR' | 'WIZARD' | 'VISION'>('CHAT');

  // ERP Canlı Bağlam & Radar
  const erpContext = useMemo(
    () => ({
      inventory: inventory || [],
      farmers: farmers || [],
      stats,
      accounts: accounts || [],
      suppliers: suppliers || [],
      prescriptions: prescriptions || [],
      reminders: reminders || [],
      visits: visits || [],
      expenses: expenses || [],
      userProfile
    }),
    [inventory, farmers, stats, accounts, suppliers, prescriptions, reminders, visits, expenses, userProfile]
  );

  const radar = useMemo(() => buildSmartErpRadar(erpContext), [erpContext]);
  const allCrops = useMemo(() => getAllCropsFlat(), []);

  // Chat Copilot States
  const [selectedCropId, setSelectedCropId] = useState<string>('');
  const [promptCategory, setPromptCategory] = useState<PromptCategory>('TÜMÜ');
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME_MSG]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Prescription & Dosage Wizard States
  const [wizardCropId, setWizardCropId] = useState<string>('PAMUK');
  const wizardProblems = useMemo(() => getProblemsForCrop(wizardCropId), [wizardCropId]);
  const [wizardProblemId, setWizardProblemId] = useState<string>('');
  const [wizardArea, setWizardArea] = useState<number>(50);
  const [wizardWaterPerDa, setWizardWaterPerDa] = useState<number>(25);
  const [wizardTankLiters, setWizardTankLiters] = useState<number>(400);

  useEffect(() => {
    if (wizardProblems.length > 0 && !wizardProblems.some(p => p.id === wizardProblemId)) {
      setWizardProblemId(wizardProblems[0].id);
    }
  }, [wizardProblems, wizardProblemId]);

  const wizardResult = useMemo(
    () =>
      calculateSmartPrescription({
        cropId: wizardCropId,
        problemId: wizardProblemId,
        areaDekar: wizardArea,
        tankLiters: wizardTankLiters,
        waterPerDekarLiters: wizardWaterPerDa,
        inventory: inventory || []
      }),
    [wizardCropId, wizardProblemId, wizardArea, wizardTankLiters, wizardWaterPerDa, inventory]
  );

  // Vision Scanner States
  const [visionCropHint, setVisionCropHint] = useState<string>('');
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'result' | 'error'>('idle');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ParsedAIResponse | null>(null);
  const [visionMatches, setVisionMatches] = useState<{
    depotMatches: InventoryItem[];
    bkuMatches: BkuMatchResult[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsLiveCameraOpen(false);
  }, []);

  useEffect(() => {
    if (activeTab !== 'VISION') {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [activeTab, stopLiveCamera]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const openLiveCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Bu tarayıcıda canlı kamera akışı desteklenmiyor. Mobil kamera seçeneğini kullanabilirsiniz.');
      cameraInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      setIsLiveCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      setCameraError('Kamera izni alınamadı veya cihazda kamera bulunamadı. Dosyadan fotoğraf seçebilirsiniz.');
      cameraInputRef.current?.click();
    }
  };

  const captureFromLiveCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopLiveCamera();
    startAnalysis(dataUrl);
  };

  const quickPrompts: QuickPromptDef[] = useMemo(
    () => [
      {
        id: 'fin-debtors',
        category: 'FİNANS',
        icon: Users,
        label: 'Alacak & Tahsilat Önceliği',
        subtitle: `${radar.debtorCount} borçlu cari • Risk sıralaması`,
        prompt:
          'En yüksek borcu olan çiftçilerimi ve toplam alacak içindeki paylarını analiz et; tahsilat öncelik sırası ile nakit akışı stratejisi öner.'
      },
      {
        id: 'fin-health',
        category: 'FİNANS',
        icon: Wallet,
        label: 'Kasa & Bilanço Check-Up',
        subtitle: `Skor: ${radar.financialScore}/100 (${radar.scoreLabel})`,
        prompt:
          'Canlı kasa/banka bakiyemi, toplam müşteri alacaklarımı, tedarikçi borçlarımı, depo maliyetimi ve beklenen kâr marjını karşılaştırarak finansal sağlık raporu çıkar.'
      },
      {
        id: 'stk-critical',
        category: 'DEPO',
        icon: Package,
        label: 'Kritik Stok & Acil Sipariş',
        subtitle: `${radar.criticalStockItems.length} kritik / tükenen ürün`,
        prompt:
          'Depomdaki mevcut ürünleri ve kritik/azalan stokları inceleyip acil sipariş edilmesi gereken ürünleri ve stok maliyet etkisini listele.'
      },
      {
        id: 'stk-skt',
        category: 'DEPO',
        icon: ShieldAlert,
        label: 'SKT & Lot Risk Taraması',
        subtitle: `${radar.expiringItems.length} yaklaşan/geçmiş SKT lotu`,
        prompt:
          'Son kullanma tarihi (SKT) yaklaşan veya dolmuş lotları listele, bu ürünlerin eritilmesi için mevsimsel satış stratejisi öner.'
      },
      {
        id: 'agr-seasonal',
        category: 'ZİRAİ',
        icon: Calendar,
        label: `${radar.currentMonthName} Ayı Zirai Gündemi`,
        subtitle: `${radar.currentSeasonItem.season} dönemi reçete planı`,
        prompt: `${radar.currentMonthName} ayı ve ${radar.currentSeasonItem.season} dönemi için bölgemizdeki öncelikli bitki hastalıkları/zararlıları ve depodaki stoklarıma göre hazır reçete paketleri öner.`
      },
      {
        id: 'agr-pamuk',
        category: 'ZİRAİ',
        icon: Sprout,
        label: 'Pamuk Zararlı & BKÜ Reçetesi',
        subtitle: 'Depodaki uygun ürün eşleşmeli',
        prompt:
          'Pamukta yaprak biti, yeşil kurt, beyazsinek ve kırmızı örümcek için resmi BKÜ etken maddelerini ve depomdaki mevcut ilaçları dikkate alarak uygulama reçetesi hazırla.'
      },
      {
        id: 'agr-domates',
        category: 'ZİRAİ',
        icon: Leaf,
        label: 'Domates Mildiyö / Tuta / Külleme',
        subtitle: 'Kültürel + kimyasal + PHI uyarısı',
        prompt:
          'Domateste Tuta absoluta, erken/geç yaprak yanıklığı (mildiyö) ve külleme mücadelesinde direnç yönetimine uygun etken madde rotasyonu ve PHI sürelerini yaz.'
      },
      {
        id: 'tnk-mix',
        category: 'TANK',
        icon: FlaskConical,
        label: 'Tank Karışımı & Su pH Protokolü',
        subtitle: 'WALES sırası + bakır/kükürt/EC kuralları',
        prompt:
          'İlaçlama tankında WALES karıştırma sırasını, su pH ve sertlik sınırlarını ve bakır/kükürt/kalsiyum/yağ karışım yasaklarını özetle.'
      }
    ],
    [radar]
  );

  const filteredQuickPrompts = useMemo(() => {
    if (promptCategory === 'TÜMÜ') return quickPrompts;
    return quickPrompts.filter(p => p.category === promptCategory);
  }, [promptCategory, quickPrompts]);

  const handleSendChat = async (presetPrompt?: string, explicitCropId?: string) => {
    const promptText = (presetPrompt || chatInput).trim();
    if (!promptText || isSending) return;

    const effectiveCropId = explicitCropId !== undefined ? explicitCropId : selectedCropId;
    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: promptText,
      time: nowTime
    };

    const historyTurns: AIChatHistoryTurn[] = messages
      .filter(m => m.id !== 'welcome')
      .slice(-8)
      .map(m => ({ role: m.role, text: m.text }));

    setMessages(prev => [...prev, userMsg]);
    if (!presetPrompt) setChatInput('');
    setIsSending(true);
    setActiveTab('CHAT');

    const enrichment = analyzeQueryLocallyAndEnrich(promptText, erpContext, effectiveCropId || undefined);
    const selectedCropName = effectiveCropId ? allCrops.find(c => c.id === effectiveCropId)?.name : undefined;

    try {
      const reply = await askAgronomistAI(
        promptText,
        selectedCropName,
        enrichment.ragContext,
        historyTurns
      );

      setMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'ai',
          text: reply || enrichment.localFallbackAnswer,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          engineSource: 'CLOUD_RAG',
          enrichment
        }
      ]);
    } catch {
      // Bulut servisi çevrimdışı veya erişilemez olsa dahi canlı yerel ERP + BKÜ motorundan gerçek verili yanıt üret
      setMessages(prev => [
        ...prev,
        {
          id: `l-${Date.now()}`,
          role: 'ai',
          text: enrichment.localFallbackAnswer,
          time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          engineSource: 'LOCAL_RAG',
          enrichment
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Tarayıcınız sesli komut özelliğini desteklemiyor.', 'info');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'tr-TR';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        if (transcript.trim()) {
          setChatInput(prev => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
        }
        setIsListening(false);
      };
      rec.onerror = () => {
        setIsListening(false);
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
      showToast('Mikrofon başlatılamadı.', 'error');
    }
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(id);
      setTimeout(() => setCopiedMsgId(null), 1800);
    } catch {
      showToast('Metin kopyalanamadı.', 'info');
    }
  };

  const startAnalysis = async (base64Image: string) => {
    setAnalysisState('analyzing');
    setCurrentImage(base64Image);
    setResultData(null);
    setVisionMatches(null);
    setErrorMessage(null);

    try {
      let depotInfoStr = '';
      let activeInvSnapshot: InventoryItem[] = inventory || [];
      try {
        const inv = await dbService.getInventory();
        const pesticides = await dbService.getPesticides();
        if (inv && inv.length > 0) activeInvSnapshot = inv;
        const availableProducts = activeInvSnapshot
          .filter(i => !i.deletedAt && i.quantity > 0)
          .map(i => i.pesticideName || pesticides.find(p => p.id === i.pesticideId)?.name)
          .filter(Boolean);

        if (availableProducts.length > 0) {
          depotInfoStr = `\n\nDEPODAKİ MEVCUT ÜRÜNLER:\n${availableProducts.join(', ')}\n\nÖNEMLİ: Reçete oluştururken (Özellikle "ornek_ticari_urun_referanslari" kısmında) ÖNCELİKLİ OLARAK yukarıda listelenen ve depomuzda mevcut olan ürünleri önermeye çalış. Eğer depodaki bir ürünü öneriyorsan isminin sonuna " (Depoda Mevcut)" ibaresini ekle. Eğer depoda uygun ürün yoksa resmi ruhsatlı eşdeğer etken maddeli ürünleri öner.`;
        }
      } catch {
        // Mevcut context stoğu ile devam et
      }

      const cropHintText = visionCropHint
        ? `Kullanıcı tarafından belirtilen muhtemel bitki türü: ${allCrops.find(c => c.id === visionCropHint)?.name || visionCropHint}. `
        : '';

      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';'));

      const config = {
        systemInstruction: `Sen, "Mühendis Kayıt Sistemi" entegrasyonuyla çalışan, T.C. Tarım ve Orman Bakanlığı BKÜ veritabanına hakim kıdemli bir bitki koruma ziraat mühendisi yapay zekasısın.

GÖREVİN:
Sana gönderilen görseli (bitki, yaprak, meyve, kök veya zararlı) detaylıca analiz etmek; bitki türünü belirlemek, hastalık, zararlı, yabancı ot veya besin noksanlığı sorunlarını teşhis etmek ve profesyonel bir tarımsal reçete oluşturmaktır.

KESİN KURALLAR:
1- Yanıtın SADECE geçerli bir JSON objesi olmalıdır. Markdown kod bloğu veya ekstra metin ekleme.
2- Görsel bitkiye ait değilse veya teşhis konulamayacak kadar bulanıksa "basarili_mi": false yapıp teknik sebebini "hata_mesaji" alanına yaz.
3- Türkiye'de ruhsatlı etken maddeleri ve oranlarını baz al.

ZORUNLU JSON ŞEMASI:
{
  "basarili_mi": true,
  "hata_mesaji": null,
  "teshis": {
    "bitki_turu": "Örn: Mısır, Domates, Pamuk vb.",
    "sorun_kategorisi": "Hastalık | Zararlı | Besin Noksanlığı | Yabancı Ot | Sağlıklı",
    "sorun_adi": "Örn: Pamuk Yaprakkurdu (Spodoptera littoralis) veya Potasyum Noksanlığı",
    "guvenilirlik_yuzdesi": 92
  },
  "recete": {
    "urun_grubu": "Örn: İnsektisit, Fungisit, Herbisit, Yaprak Gübresi",
    "aktif_madde_ve_orani": "Örn: %5 SG Emamectin Benzoate",
    "ornek_ticari_urun_referanslari": ["Depodan veya ruhsatlı ürün 1", "Eşdeğer ürün 2"],
    "uygulama_dozu": "Örn: 40 g / 100 L su",
    "ziraat_muhendisi_notu": "Uygulama saati, arı toksisitesi, PHI süresi ve tank karışım uyarısı."
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
          { text: `${cropHintText}Bu görseli tarımsal açıdan detaylıca analiz et ve JSON şemasına tam uygun yanıt ver.` }
        ],
        config
      );

      const parsed = parseAIResponse(text || '');
      if (parsed) {
        setResultData(parsed);
        setAnalysisState('result');
        if (parsed.basarili_mi) {
          const matches = findMatchesForDiagnosis(
            parsed.teshis?.bitki_turu,
            parsed.recete?.aktif_madde_ve_orani,
            parsed.teshis?.sorun_adi,
            activeInvSnapshot
          );
          setVisionMatches(matches);
        }
      } else {
        setErrorMessage('Gelen yanıt çözümlenemedi. Daha net ve yakın plan bir fotoğraf ile tekrar deneyin.');
        setAnalysisState('error');
      }
    } catch (error: any) {
      setErrorMessage(
        error?.message || 'Yapay zeka görsel analiz servisine ulaşılamadı. İnternet veya sunucu bağlantınızı kontrol edin.'
      );
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
    stopLiveCamera();
    setAnalysisState('idle');
    setCurrentImage(null);
    setResultData(null);
    setVisionMatches(null);
    setErrorMessage(null);
  };

  const renderFormattedText = (raw: string) => {
    const html = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--mks-accent-primary)" class="font-bold">$1</strong>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n- /g, '<br/>• ')
      .replace(/\n\* /g, '<br/>• ')
      .replace(/\n(\d+)\. /g, '<br/><strong>$1.</strong> ');
    return <div className="leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const selectedCropProfile = selectedCropId ? CROP_AGRONOMY_PROFILES[selectedCropId] : undefined;

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-28 space-y-5 animate-in fade-in duration-300">
      {/* ==================== CORPORATE HEADER & TAB BAR ==================== */}
      <div className="v22-bento-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={onBack}
              className="v22-surface-pill p-2.5 rounded-2xl transition-all shrink-0"
              title="Geri Dön"
            >
              <ArrowLeft size={18} />
            </button>
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md v22-keep-white"
              style={{
                background: 'linear-gradient(135deg, var(--mks-accent-primary) 0%, #0d9488 100%)',
                color: '#ffffff'
              }}
            >
              <Sparkles size={22} className="v22-keep-white text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight" style={{ color: 'var(--mks-text)' }}>
                  MKS Yapay Zeka & Karar Destek Merkezi
                </h1>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                  style={{
                    background: 'var(--mks-accent-soft)',
                    color: 'var(--mks-accent-soft-text)'
                  }}
                >
                  <CheckCircle2 size={11} /> Canlı RAG + ERP Aktif
                </span>
              </div>
              <p className="text-xs sm:text-[13px] mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                Canlı Depo, Cari Risk, 1.089 Ruhsatlı BKÜ Kataloğu ve 32 Bitki Agronomi Zekası
              </p>
            </div>
          </div>

          {/* 4 Corporate Mode Tabs */}
          <div
            className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl border shrink-0"
            style={{
              background: 'var(--mks-subcard)',
              borderColor: 'var(--mks-card-border)'
            }}
          >
            {[
              { id: 'CHAT' as const, label: 'AI Copilot & Danışman', icon: MessageSquare },
              { id: 'RADAR' as const, label: 'Canlı İşletme & Risk Radarı', icon: Activity },
              { id: 'WIZARD' as const, label: 'Akıllı Reçete Sihirbazı', icon: Calculator },
              { id: 'VISION' as const, label: 'Görsel Bitki Teşhisi', icon: Camera }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive ? 'v22-dark-pill shadow-sm' : 'v22-dock-tab'
                  }`}
                >
                  <tab.icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 Clickable Executive KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <button
            onClick={() => setActiveTab('RADAR')}
            className="text-left p-3.5 rounded-2xl border transition-all hover:scale-[1.01] group"
            style={{
              background: 'var(--mks-subcard)',
              borderColor: 'var(--mks-card-border)'
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                Finansal Sağlık & Kasa
              </span>
              <TrendingUp size={15} style={{ color: 'var(--mks-accent-primary)' }} />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg sm:text-xl font-black" style={{ color: 'var(--mks-text)' }}>
                {radar.financialScore}/100
              </span>
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
              >
                {radar.scoreLabel}
              </span>
            </div>
            <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
              Kasa+Banka: <strong style={{ color: 'var(--mks-text)' }}>{formatCurrency(radar.totalKasa, currency)}</strong>
            </p>
          </button>

          <button
            onClick={() => setActiveTab('RADAR')}
            className="text-left p-3.5 rounded-2xl border transition-all hover:scale-[1.01] group"
            style={{
              background: 'var(--mks-subcard)',
              borderColor: 'var(--mks-card-border)'
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                Aktif Alacak & Riskli Cari
              </span>
              <Users size={15} className="text-amber-600" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg sm:text-xl font-black truncate" style={{ color: 'var(--mks-text)' }}>
                {formatCurrency(radar.totalReceivables, currency)}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 shrink-0">
                {radar.debtorCount} Cari
              </span>
            </div>
            <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
              Tedarikçi Borcu:{' '}
              <strong style={{ color: 'var(--mks-text)' }}>{formatCurrency(radar.totalSupplierDebt, currency)}</strong>
            </p>
          </button>

          <button
            onClick={() => setActiveTab('RADAR')}
            className="text-left p-3.5 rounded-2xl border transition-all hover:scale-[1.01] group"
            style={{
              background: 'var(--mks-subcard)',
              borderColor: 'var(--mks-card-border)'
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                Depo Stok & SKT Radarı
              </span>
              <Package size={15} className="text-rose-600" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg sm:text-xl font-black" style={{ color: 'var(--mks-text)' }}>
                {radar.inStockCount} Ürün
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  radar.criticalStockItems.length > 0 ? 'bg-rose-500/15 text-rose-700' : 'bg-emerald-500/15 text-emerald-700'
                }`}
              >
                {radar.criticalStockItems.length} Kritik
              </span>
            </div>
            <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
              SKT Riski: <strong style={{ color: 'var(--mks-text)' }}>{radar.expiringItems.length} Lot</strong> • Ort. Marj:{' '}
              <strong style={{ color: 'var(--mks-text)' }}>%{radar.averageMarginPct.toFixed(1)}</strong>
            </p>
          </button>

          <button
            onClick={() => setActiveTab('WIZARD')}
            className="text-left p-3.5 rounded-2xl border transition-all hover:scale-[1.01] group"
            style={{
              background: 'var(--mks-subcard)',
              borderColor: 'var(--mks-card-border)'
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                Resmi BKÜ & Zirai Ağ
              </span>
              <Wheat size={15} style={{ color: 'var(--mks-accent-primary)' }} />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg sm:text-xl font-black" style={{ color: 'var(--mks-text)' }}>
                {OFFICIAL_BKU_CATALOG.length.toLocaleString('tr-TR')}
              </span>
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
                style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
              >
                32 Bitki
              </span>
            </div>
            <p className="text-[11px] mt-1 truncate" style={{ color: 'var(--mks-muted)' }}>
              {radar.currentMonthName} ({radar.currentSeasonItem.season}) •{' '}
              <strong style={{ color: 'var(--mks-text)' }}>{radar.activeFarmerCount} Çiftçi</strong>
            </p>
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: LIVE AI COPILOT & RAG CHAT ==================== */}
      {activeTab === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Intelligence Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            {/* Crop Context Switcher */}
            <div className="v22-bento-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--mks-muted)' }}>
                  <Sprout size={14} style={{ color: 'var(--mks-accent-primary)' }} />
                  Bitki Bağlamı (RAG Odak)
                </span>
                {selectedCropId && (
                  <button
                    onClick={() => setSelectedCropId('')}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg v22-surface-pill"
                  >
                    Temizle
                  </button>
                )}
              </div>

              <select
                value={selectedCropId}
                onChange={e => setSelectedCropId(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2.5 text-xs font-bold border outline-none"
                style={{
                  background: 'var(--mks-input-bg)',
                  borderColor: 'var(--mks-input-border)',
                  color: 'var(--mks-text)'
                }}
              >
                <option value="">Tüm İşletme & Genel Bitkiler (Otomatik Tespit)</option>
                {CROP_CATEGORIES.map(cat => (
                  <optgroup key={cat.id} label={cat.name}>
                    {cat.crops.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {selectedCropProfile && (
                <div
                  className="p-3 rounded-2xl border text-xs space-y-1.5"
                  style={{
                    background: 'var(--mks-subcard)',
                    borderColor: 'var(--mks-card-border)'
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black" style={{ color: 'var(--mks-text)' }}>
                      {selectedCropProfile.name}
                    </span>
                    <span className="text-[10px] italic truncate" style={{ color: 'var(--mks-muted)' }}>
                      {selectedCropProfile.scientificName}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                    <span>pH: <strong style={{ color: 'var(--mks-text)' }}>{selectedCropProfile.optimalSoilPh}</strong></span>
                    <span>Verim: <strong style={{ color: 'var(--mks-text)' }}>{selectedCropProfile.targetYieldPerDa}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* 4-Category Smart Command Library */}
            <div className="v22-bento-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                  Akıllı Komut Kütüphanesi
                </span>
                <Sparkles size={14} style={{ color: 'var(--mks-accent-primary)' }} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['TÜMÜ', 'FİNANS', 'DEPO', 'ZİRAİ', 'TANK'] as PromptCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPromptCategory(cat)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                      promptCategory === cat ? 'v22-dark-pill' : 'v22-surface-pill'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredQuickPrompts.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSendChat(item.prompt)}
                    disabled={isSending}
                    className="w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 group disabled:opacity-50"
                    style={{
                      background: 'var(--mks-subcard)',
                      borderColor: 'var(--mks-card-border)'
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                      style={{
                        background: 'var(--mks-accent-soft)',
                        color: 'var(--mks-accent-soft-text)'
                      }}
                    >
                      <item.icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-bold leading-snug" style={{ color: 'var(--mks-text)' }}>
                        {item.label}
                      </span>
                      <span className="block text-[11px] mt-0.5 truncate" style={{ color: 'var(--mks-muted)' }}>
                        {item.subtitle}
                      </span>
                    </div>
                    <ArrowUpRight size={14} className="shrink-0 opacity-40 group-hover:opacity-100 mt-1" />
                  </button>
                ))}
              </div>
            </div>

            {/* Live Connected DB Summary */}
            <div className="v22-bento-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--mks-muted)' }}>
                  <Database size={13} style={{ color: 'var(--mks-accent-primary)' }} />
                  Canlı Bağlı Veri Kaynakları
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>Depo Çeşidi</span>
                  <span className="font-black" style={{ color: 'var(--mks-text)' }}>{inventory.length} Ürün</span>
                </div>
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>Toplam Arazi</span>
                  <span className="font-black" style={{ color: 'var(--mks-text)' }}>{radar.totalAreaDekar.toLocaleString('tr-TR')} da</span>
                </div>
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>Açık Ajanda</span>
                  <span className="font-black" style={{ color: 'var(--mks-text)' }}>{radar.pendingReminders.length} Görev</span>
                </div>
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>Beklenen Kâr</span>
                  <span className="font-black" style={{ color: 'var(--mks-accent-primary)' }}>
                    {formatCurrency(radar.expectedGrossProfit, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Chat Workspace */}
          <div className="lg:col-span-8 v22-bento-card flex flex-col h-[620px] sm:h-[700px] overflow-hidden">
            {/* Workspace Top Bar */}
            <div
              className="px-4 sm:px-5 py-3 border-b flex flex-wrap items-center justify-between gap-2"
              style={{ borderColor: 'var(--mks-card-border)', background: 'var(--mks-subcard)' }}
            >
              <div className="flex items-center gap-2">
                <Bot size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                <span className="text-xs font-black" style={{ color: 'var(--mks-text)' }}>
                  Hibrit Ziraat & Finans Copilot
                </span>
                {selectedCropProfile && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                  >
                    Odak: {selectedCropProfile.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMessages([WELCOME_MSG])}
                  className="v22-surface-pill px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Yeni Oturum
                </button>
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {messages.map(msg => (
                <div key={msg.id} className="space-y-2.5">
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 border ${
                        msg.role === 'user' ? 'v22-dark-pill rounded-br-none shadow-sm' : 'rounded-bl-none'
                      }`}
                      style={
                        msg.role === 'ai'
                          ? {
                              background: 'var(--mks-subcard)',
                              borderColor: 'var(--mks-card-border)',
                              color: 'var(--mks-text)'
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1 opacity-85">
                            {msg.role === 'ai' ? (
                              <>
                                <Bot size={12} style={{ color: 'var(--mks-accent-primary)' }} /> MKS Ziraat & ERP AI
                              </>
                            ) : (
                              'Mühendis / Yönetici'
                            )}
                          </span>
                          {msg.engineSource && msg.engineSource !== 'WELCOME' && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                              style={{
                                background:
                                  msg.engineSource === 'CLOUD_RAG' ? 'var(--mks-accent-soft)' : 'rgba(245, 158, 11, 0.16)',
                                color: msg.engineSource === 'CLOUD_RAG' ? 'var(--mks-accent-soft-text)' : '#b45309'
                              }}
                            >
                              {msg.engineSource === 'CLOUD_RAG' ? 'Bulut AI + Canlı RAG' : 'Yerel Akıllı Analiz Motoru'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] opacity-65">{msg.time}</span>
                          {msg.role === 'ai' && (
                            <button
                              onClick={() => handleCopyMessage(msg.id, msg.text)}
                              className="p-1 rounded-lg hover:opacity-80 transition-opacity"
                              title="Yanıtı Kopyala"
                            >
                              {copiedMsgId === msg.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {msg.role === 'ai' ? (
                        renderFormattedText(msg.text)
                      ) : (
                        <p className="text-sm leading-relaxed v22-keep-white">{msg.text}</p>
                      )}
                    </div>
                  </div>

                  {/* Interactive Evidence & Action Cards attached to AI Response */}
                  {msg.role === 'ai' && msg.enrichment && (
                    <div className="pl-2 sm:pl-4 space-y-2.5 max-w-[94%]">
                      {/* Matched KPI Strip */}
                      {msg.enrichment.kpiHighlights.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {msg.enrichment.kpiHighlights.map((k, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl border text-xs"
                              style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                            >
                              <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>{k.label}</span>
                              <span className="font-black" style={{ color: 'var(--mks-text)' }}>{k.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Matched Live Depot Products */}
                      {msg.enrichment.depotMatches.length > 0 && (
                        <div
                          className="p-3 rounded-2xl border space-y-2"
                          style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--mks-accent-primary)' }}>
                              <Package size={13} /> Deponuzda Eşleşen Ürünler ({msg.enrichment.depotMatches.length})
                            </span>
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate('INVENTORY')}
                                className="text-[11px] font-bold hover:underline flex items-center gap-0.5"
                                style={{ color: 'var(--mks-accent-primary)' }}
                              >
                                Depoya Git <ArrowUpRight size={12} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.enrichment.depotMatches.slice(0, 4).map(item => (
                              <div
                                key={item.id}
                                className="p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs"
                                style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                              >
                                <div className="min-w-0">
                                  <span className="font-bold block truncate" style={{ color: 'var(--mks-text)' }}>
                                    {item.pesticideName}
                                  </span>
                                  <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                                    Satış: {formatCurrency(item.sellingPrice, currency)}
                                  </span>
                                </div>
                                <span
                                  className="px-2 py-1 rounded-lg font-black text-[11px] shrink-0"
                                  style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                                >
                                  {item.quantity} {item.unit}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matched Official BKU Products */}
                      {msg.enrichment.bkuMatches.length > 0 && (
                        <div
                          className="p-3 rounded-2xl border space-y-2"
                          style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--mks-text)' }}>
                              <FileCheck2 size={13} style={{ color: 'var(--mks-accent-primary)' }} /> Resmi Bakanlık BKÜ Eşleşmeleri ({msg.enrichment.bkuMatches.length})
                            </span>
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate('PESTICIDES')}
                                className="text-[11px] font-bold hover:underline flex items-center gap-0.5"
                                style={{ color: 'var(--mks-accent-primary)' }}
                              >
                                Kütüphane <ArrowUpRight size={12} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.enrichment.bkuMatches.slice(0, 4).map((bm, idx) => (
                              <div
                                key={`${bm.pesticide.id}-${idx}`}
                                className="p-2.5 rounded-xl border text-xs space-y-1"
                                style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold truncate" style={{ color: 'var(--mks-text)' }}>
                                    {bm.pesticide.name}
                                  </span>
                                  {bm.inDepotItem && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-700 shrink-0">
                                      Depoda
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] truncate" style={{ color: 'var(--mks-muted)' }}>
                                  {bm.pesticide.activeIngredient}
                                </p>
                                <div className="flex items-center justify-between text-[10px] font-bold" style={{ color: 'var(--mks-accent-primary)' }}>
                                  <span>Doz: {bm.dosage || '-'}</span>
                                  {bm.phi && <span>PHI: {bm.phi}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Matched Debtors with WhatsApp Quick Action */}
                      {msg.enrichment.debtorMatches.length > 0 && (
                        <div
                          className="p-3 rounded-2xl border space-y-2"
                          style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-amber-700">
                              <Users size={13} /> Öncelikli Borçlu Cariler ({msg.enrichment.debtorMatches.length})
                            </span>
                            {onNavigate && (
                              <button
                                onClick={() => onNavigate('FARMERS')}
                                className="text-[11px] font-bold hover:underline flex items-center gap-0.5"
                                style={{ color: 'var(--mks-accent-primary)' }}
                              >
                                Çiftçilere Git <ArrowUpRight size={12} />
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {msg.enrichment.debtorMatches.slice(0, 4).map(d => (
                              <div
                                key={d.id}
                                className="p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs"
                                style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                              >
                                <div>
                                  <span className="font-bold" style={{ color: 'var(--mks-text)' }}>{d.fullName}</span>{' '}
                                  <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>({d.village})</span>
                                  <span className="block text-[11px] font-bold text-rose-700">
                                    {formatCurrency(d.debt, currency)} • Pay: %{d.sharePct.toFixed(1)}
                                  </span>
                                </div>
                                {d.whatsappUrl && (
                                  <a
                                    href={d.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 v22-keep-white text-white transition-all"
                                  >
                                    WhatsApp Hatırlat
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-Up Question Chips */}
                      {msg.enrichment.followUpSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {msg.enrichment.followUpSuggestions.map((sugg, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSendChat(sugg)}
                              disabled={isSending}
                              className="v22-surface-pill px-3 py-1.5 rounded-full text-[11px] font-bold transition-all disabled:opacity-50"
                            >
                              + {sugg}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl rounded-bl-none p-4 border flex items-center gap-3"
                    style={{
                      background: 'var(--mks-subcard)',
                      borderColor: 'var(--mks-card-border)',
                      color: 'var(--mks-text)'
                    }}
                  >
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--mks-accent-primary)' }} />
                    <span className="text-xs font-bold">
                      Canlı MKS veritabanı, depo stokları ve Resmi BKÜ kataloğu taranıyor...
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Composer Bar */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-3 sm:p-4 border-t flex items-center gap-2"
              style={{
                background: 'var(--mks-subcard)',
                borderColor: 'var(--mks-card-border)'
              }}
            >
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl border transition-all shrink-0 ${
                  isListening ? 'bg-rose-600 v22-keep-white text-white animate-pulse' : 'v22-surface-pill'
                }`}
                title={isListening ? 'Dinlemeyi Durdur' : 'Sesli Soru Sor (Türkçe)'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('VISION')}
                className="v22-surface-pill p-3 rounded-xl border transition-all shrink-0 hidden sm:flex"
                title="Yaprak / Zararlı Fotoğrafı Tara"
              >
                <Camera size={16} />
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={
                  isListening
                    ? 'Dinleniyor... Sorunuzu sesli söyleyin'
                    : 'Zirai hastalık, BKÜ ilacı, dozaj, stok, SKT veya çiftçi borç analizi sorun...'
                }
                className="flex-1 rounded-xl px-4 py-3 text-sm border outline-none"
                style={{
                  background: 'var(--mks-input-bg)',
                  borderColor: 'var(--mks-input-border)',
                  color: 'var(--mks-text)'
                }}
              />

              <button
                type="submit"
                disabled={isSending || !chatInput.trim()}
                className="v22-dark-pill px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-45"
              >
                <Send size={15} />
                <span className="hidden sm:inline">Gönder</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: LIVE ERP & RISK RADAR ==================== */}
      {activeTab === 'RADAR' && (
        <div className="space-y-5">
          {/* Executive Balance & Financial Health Score */}
          <div className="v22-bento-card p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <Activity size={20} style={{ color: 'var(--mks-accent-primary)' }} />
                  İşletme Finansal Sağlık & Nakit Akışı Bilançosu
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                  Canlı hesaplar, çiftçi alacakları, tedarikçi borçları ve depo kâr potansiyeli anlık analizidir.
                </p>
              </div>
              <button
                onClick={() =>
                  handleSendChat(
                    'İşletmemin nakit, kasa, müşteri alacakları, tedarikçi borçları ve depo kârlılığı üzerinden yönetici özeti ve önümüzdeki 30 gün için aksiyon planı çıkar.'
                  )
                }
                className="v22-dark-pill px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0"
              >
                <Sparkles size={14} /> AI Yönetici Özeti Çıkar
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div
                className="lg:col-span-4 p-4 rounded-2xl border space-y-2.5"
                style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    Finansal Sağlık Endeksi
                  </span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-black"
                    style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                  >
                    {radar.scoreLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black" style={{ color: 'var(--mks-text)' }}>
                    {radar.financialScore}
                  </span>
                  <span className="text-sm font-bold" style={{ color: 'var(--mks-muted)' }}>/ 100</span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden bg-black/10">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${radar.financialScore}%`,
                      background: 'var(--mks-accent-primary)'
                    }}
                  />
                </div>
                <p className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                  Net İşletme Sermayesi:{' '}
                  <strong style={{ color: 'var(--mks-text)' }}>
                    {formatCurrency(radar.netWorkingCapital, currency)}
                  </strong>
                </p>
              </div>

              <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Kasa + Banka Mevcudu', val: formatCurrency(radar.totalKasa, currency) },
                  { label: 'Toplam Müşteri Alacağı', val: formatCurrency(radar.totalReceivables, currency) },
                  { label: 'Tedarikçilere Borcumuz', val: formatCurrency(radar.totalSupplierDebt, currency) },
                  { label: 'Beklenen Depo Brüt Kârı', val: formatCurrency(radar.expectedGrossProfit, currency) }
                ].map((box, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-2xl border space-y-1"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <span className="text-[11px] block" style={{ color: 'var(--mks-muted)' }}>
                      {box.label}
                    </span>
                    <span className="text-base sm:text-lg font-black block truncate" style={{ color: 'var(--mks-text)' }}>
                      {box.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Priority Collection & Debtor Risk List */}
          <div className="v22-bento-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <Users size={18} className="text-amber-600" />
                  Öncelikli Tahsilat & Cari Risk Radarı ({radar.topDebtors.length})
                </h3>
                <p className="text-xs" style={{ color: 'var(--mks-muted)' }}>
                  Alacak yoğunluğuna göre sıralanmış yüksek riskli ve öncelikli takip gerektiren çiftçiler.
                </p>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('DEBT_TRACKING')}
                  className="v22-surface-pill px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 self-start"
                >
                  Alacak & Risk Takibi <ArrowUpRight size={13} />
                </button>
              )}
            </div>

            {radar.topDebtors.length === 0 ? (
              <div className="p-6 rounded-2xl border text-center text-xs" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-muted)' }}>
                Şu anda açık borcu bulunan kayıtlı çiftçi bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {radar.topDebtors.slice(0, 8).map(d => (
                  <div
                    key={d.id}
                    className="p-4 rounded-2xl border flex flex-col justify-between gap-3"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm" style={{ color: 'var(--mks-text)' }}>
                            {d.fullName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              d.riskLevel === 'YÜKSEK'
                                ? 'bg-rose-500/15 text-rose-700'
                                : d.riskLevel === 'ORTA'
                                  ? 'bg-amber-500/15 text-amber-700'
                                  : 'bg-emerald-500/15 text-emerald-700'
                            }`}
                          >
                            {d.riskLevel} RİSK
                          </span>
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: 'var(--mks-muted)' }}>
                          {d.village} • {d.fieldArea > 0 ? `${d.fieldArea} da (${d.cropsSummary})` : d.cropsSummary}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-rose-700 block">
                          {formatCurrency(d.debt, currency)}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--mks-muted)' }}>
                          Alacak Payı: %{d.sharePct.toFixed(1)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {d.whatsappUrl && (
                        <a
                          href={d.whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 v22-keep-white text-white transition-all"
                        >
                          WhatsApp Tahsilat Mesajı
                        </a>
                      )}
                      <button
                        onClick={() =>
                          handleSendChat(
                            `${d.fullName} (${d.village}, Bakiye: ${formatCurrency(d.debt, currency)}) için tahsilat stratejisi ve nazik kurumsal hatırlatma metni hazırla.`
                          )
                        }
                        className="v22-surface-pill px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                      >
                        <Sparkles size={12} /> AI Strateji
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3-Column Inventory, SKT & Margin Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Critical Stock */}
            <div className="v22-bento-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <AlertTriangle size={16} className="text-rose-600" />
                  Kritik / Azalan Stoklar ({radar.criticalStockItems.length})
                </h3>
                <button
                  onClick={() =>
                    handleSendChat(
                      'Kritik seviyedeki ürünlerim için acil tedarik sipariş listesi ve tahmini bütçe hesapla.'
                    )
                  }
                  className="text-[11px] font-bold"
                  style={{ color: 'var(--mks-accent-primary)' }}
                >
                  AI Planla
                </button>
              </div>
              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {radar.criticalStockItems.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--mks-muted)' }}>
                    Tüm ürünler güvenli stok seviyesinin üzerinde.
                  </p>
                ) : (
                  radar.criticalStockItems.slice(0, 12).map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <div className="min-w-0">
                        <span className="font-bold block truncate" style={{ color: 'var(--mks-text)' }}>
                          {item.pesticideName}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--mks-muted)' }}>{item.category}</span>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-[11px] font-black bg-rose-500/15 text-rose-700 shrink-0">
                        {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expiring / Lot Tracking */}
            <div className="v22-bento-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <ShieldAlert size={16} className="text-amber-600" />
                  SKT & Lot Riski ({radar.expiringItems.length})
                </h3>
                <button
                  onClick={() =>
                    handleSendChat(
                      'SKT süresi yaklaşan veya dolan lotlarım için stok eritme ve karantina aksiyonlarını yaz.'
                    )
                  }
                  className="text-[11px] font-bold"
                  style={{ color: 'var(--mks-accent-primary)' }}
                >
                  AI Çözüm
                </button>
              </div>
              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {radar.expiringItems.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--mks-muted)' }}>
                    90 gün içinde SKT süresi dolacak ürün kaydı bulunmuyor.
                  </p>
                ) : (
                  radar.expiringItems.slice(0, 10).map((e, idx) => (
                    <div
                      key={`${e.item.id}-${idx}`}
                      className="p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <div className="min-w-0">
                        <span className="font-bold block truncate" style={{ color: 'var(--mks-text)' }}>
                          {e.item.pesticideName}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--mks-muted)' }}>
                          Lot: {e.lotNumber || 'GENEL'} • SKT: {e.expiryDate}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                          e.daysLeft < 0 ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/15 text-amber-700'
                        }`}
                      >
                        {e.daysLeft < 0 ? 'Süresi Doldu' : `${e.daysLeft} gün`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Margin Products */}
            <div className="v22-bento-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <TrendingUp size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                  En Yüksek Kâr Potansiyeli
                </h3>
                <span className="text-[11px] font-bold" style={{ color: 'var(--mks-muted)' }}>
                  Ort. Marj: %{radar.averageMarginPct.toFixed(1)}
                </span>
              </div>
              <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
                {radar.topMarginItems.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--mks-muted)' }}>
                    Alış ve satış fiyatı tanımlı stok kalemi bulunduğunda burada sıralanır.
                  </p>
                ) : (
                  radar.topMarginItems.slice(0, 10).map(m => (
                    <div
                      key={m.item.id}
                      className="p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <div className="min-w-0">
                        <span className="font-bold block truncate" style={{ color: 'var(--mks-text)' }}>
                          {m.item.pesticideName}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--mks-muted)' }}>
                          Stok: {m.item.quantity} {m.item.unit} • Marj: %{m.marginPct.toFixed(1)}
                        </span>
                      </div>
                      <span
                        className="px-2 py-1 rounded-lg text-[11px] font-black shrink-0"
                        style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                      >
                        +{formatCurrency(m.totalPotentialProfit, currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Seasonal Focus & Pending Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 v22-bento-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <Calendar size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                  {radar.currentMonthName} ({radar.currentSeasonItem.season}) Zirai Mücadele Gündemi
                </h3>
                <span
                  className="text-[10px] font-black px-2.5 py-0.5 rounded-full"
                  style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                >
                  {radar.currentSeasonItem.period}
                </span>
              </div>
              {radar.currentMonthFocus && (
                <div
                  className="p-3.5 rounded-2xl border text-xs"
                  style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                >
                  <span className="font-black block mb-1" style={{ color: 'var(--mks-accent-primary)' }}>
                    Ayın Öncelikli Saha Odağı:
                  </span>
                  <p style={{ color: 'var(--mks-text)' }}>{radar.currentMonthFocus.priority}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {radar.currentSeasonItem.tasks.slice(0, 4).map((task, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border flex items-start gap-2"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--mks-accent-primary)' }} />
                    <span style={{ color: 'var(--mks-text)' }}>{task}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 v22-bento-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <Info size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                  Bekleyen Ajanda Görevleri ({radar.pendingReminders.length})
                </h3>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('REMINDERS')}
                    className="text-[11px] font-bold flex items-center gap-0.5"
                    style={{ color: 'var(--mks-accent-primary)' }}
                  >
                    Ajandaya Git <ArrowUpRight size={12} />
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[210px] overflow-y-auto pr-1">
                {radar.pendingReminders.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: 'var(--mks-muted)' }}>
                    Bekleyen açık hatırlatıcı veya saha görevi bulunmuyor.
                  </p>
                ) : (
                  radar.pendingReminders.slice(0, 6).map(r => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <div className="min-w-0">
                        <span className="font-bold block truncate" style={{ color: 'var(--mks-text)' }}>
                          {r.title}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--mks-muted)' }}>
                          {r.date ? new Date(r.date).toLocaleDateString('tr-TR') : '-'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 shrink-0">
                        {r.priority}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: SMART PRESCRIPTION & DOSAGE WIZARD ==================== */}
      {activeTab === 'WIZARD' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Wizard Controls */}
          <div className="lg:col-span-4 v22-bento-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders size={18} style={{ color: 'var(--mks-accent-primary)' }} />
              <h2 className="text-base font-black" style={{ color: 'var(--mks-text)' }}>
                Akıllı Reçete & Tank Hesaplayıcı
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mks-muted)' }}>
                  1. Kültür Bitkisi (32 Tür)
                </label>
                <select
                  value={wizardCropId}
                  onChange={e => setWizardCropId(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs font-bold border outline-none"
                  style={{
                    background: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                >
                  {CROP_CATEGORIES.map(cat => (
                    <optgroup key={cat.id} label={cat.name}>
                      {cat.crops.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mks-muted)' }}>
                  2. Hedef Hastalık / Zararlı / Besleme
                </label>
                <select
                  value={wizardProblemId}
                  onChange={e => setWizardProblemId(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs font-bold border outline-none"
                  style={{
                    background: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                >
                  {wizardProblems.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.stageName}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mks-muted)' }}>
                  3. İlaçlanacak Alan (Dekar)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={wizardArea}
                  onChange={e => setWizardArea(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm font-black border outline-none"
                  style={{
                    background: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[10, 25, 50, 100, 250].map(preset => (
                    <button
                      key={preset}
                      onClick={() => setWizardArea(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        wizardArea === preset ? 'v22-dark-pill' : 'v22-surface-pill'
                      }`}
                    >
                      {preset} da
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Dekara Su (L/da)
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={wizardWaterPerDa}
                    onChange={e => setWizardWaterPerDa(Math.max(5, Number(e.target.value) || 25))}
                    className="w-full rounded-xl px-3 py-2 text-xs font-black border outline-none"
                    style={{
                      background: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Tank Hacmi (L)
                  </label>
                  <input
                    type="number"
                    min={20}
                    step={50}
                    value={wizardTankLiters}
                    onChange={e => setWizardTankLiters(Math.max(20, Number(e.target.value) || 400))}
                    className="w-full rounded-xl px-3 py-2 text-xs font-black border outline-none"
                    style={{
                      background: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() =>
                  handleSendChat(
                    `${wizardResult.cropName} bitkisinde "${wizardResult.problemName}" sorunu için ${wizardResult.areaDekar} dekar alanda, ${wizardResult.tankLiters} L tank (${wizardResult.waterPerDekarLiters} L/da su) ile WALES karıştırma sırası, tank dozu ve PHI güvenlik kurallarını içeren tam saha reçetesi hazırla.`,
                    wizardCropId
                  )
                }
                className="w-full v22-dark-pill py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              >
                <Sparkles size={14} /> AI Mühendis Reçetesi Oluştur
              </button>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('PRESCRIPTION_NEW')}
                  className="w-full v22-surface-pill py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <FileText size={14} /> Satış & Reçete Ekranına Geç
                </button>
              )}
            </div>
          </div>

          {/* Calculation Results */}
          <div className="lg:col-span-8 space-y-4">
            <div className="v22-bento-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                    style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                  >
                    {wizardResult.cropName} • {wizardResult.problemType}
                  </span>
                  <h3 className="text-base sm:text-lg font-black mt-1" style={{ color: 'var(--mks-text)' }}>
                    {wizardResult.problemName}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[11px] block" style={{ color: 'var(--mks-muted)' }}>Toplam Su İhtiyacı</span>
                  <span className="text-xl font-black" style={{ color: 'var(--mks-accent-primary)' }}>
                    {wizardResult.totalWaterLiters.toLocaleString('tr-TR')} Litre
                  </span>
                </div>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--mks-muted)' }}>
                {wizardResult.problemDescription}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>Alan</span>
                  <span className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>{wizardResult.areaDekar} Dekar</span>
                </div>
                <div className="p-3 rounded-2xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>Gereken Tank Sayısı</span>
                  <span className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>
                    {wizardResult.exactTanks.toFixed(1)} Tank ({wizardResult.tankLiters} L)
                  </span>
                </div>
                <div className="p-3 rounded-2xl border col-span-2" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                  <span className="text-[10px] block flex items-center gap-1" style={{ color: 'var(--mks-muted)' }}>
                    <Droplets size={11} /> Su Kalitesi Standardı
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--mks-text)' }}>
                    {wizardResult.waterRulesNote}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border" style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}>
                <span className="text-[11px] font-black uppercase tracking-wider block mb-2" style={{ color: 'var(--mks-muted)' }}>
                  WALES Tank Karıştırma Sırası
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {wizardResult.mixingOrder.map((step, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold border"
                      style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)', color: 'var(--mks-text)' }}
                    >
                      {step}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Matched BKU + Live Depot Stock Matrix */}
            <div className="v22-bento-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                  <Layers size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                  Resmi BKÜ & Canlı Depo İlaç Karşılıkları ({wizardResult.products.length})
                </h3>
              </div>

              {wizardResult.products.length === 0 ? (
                <p className="text-xs py-6 text-center" style={{ color: 'var(--mks-muted)' }}>
                  Bu hedef için katalogda eşleşme bulunamadı. AI Copilot üzerinden özel reçete oluşturabilirsiniz.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {wizardResult.products.map((prod, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <div className="md:col-span-5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              prod.source === 'DEPO + BKÜ'
                                ? 'bg-emerald-500/15 text-emerald-700'
                                : prod.source === 'DEPO'
                                  ? 'bg-sky-500/15 text-sky-700'
                                  : 'bg-slate-500/15 text-slate-700'
                            }`}
                          >
                            {prod.source}
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: 'var(--mks-muted)' }}>{prod.group}</span>
                          {prod.phi && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
                              PHI: {prod.phi}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black truncate" style={{ color: 'var(--mks-text)' }}>
                          {prod.name}
                        </h4>
                        <p className="text-[11px] truncate" style={{ color: 'var(--mks-muted)' }}>
                          {prod.activeIngredient} • Doz: {prod.dosageLabel}
                        </p>
                      </div>

                      <div className="md:col-span-3 text-xs">
                        <span className="text-[10px] block" style={{ color: 'var(--mks-muted)' }}>Tank & Toplam İhtiyaç</span>
                        <span className="font-black block" style={{ color: 'var(--mks-accent-primary)' }}>
                          {prod.formattedTotalRequired}
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                          Tank başına: {prod.formattedPerTank}
                        </span>
                      </div>

                      <div className="md:col-span-4 text-xs md:text-right space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                            prod.stockStatus === 'YETERLİ'
                              ? 'bg-emerald-500/15 text-emerald-700'
                              : prod.stockStatus === 'STOK KONTROLÜ GEREKLİ'
                                ? 'bg-amber-500/15 text-amber-700'
                                : 'bg-rose-500/15 text-rose-700'
                          }`}
                        >
                          {prod.stockStatus}
                        </span>
                        {prod.inDepotItem ? (
                          <div className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                            Depo: <strong style={{ color: 'var(--mks-text)' }}>{prod.inDepotItem.quantity} {prod.inDepotItem.unit}</strong>
                            {prod.estimatedCost ? ` • Tahmini: ${formatCurrency(prod.estimatedCost, currency)}` : ''}
                          </div>
                        ) : (
                          <div className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                            Depoda kayıtlı eşdeğer yok
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: VISUAL LEAF & DISEASE SCANNER ==================== */}
      {activeTab === 'VISION' && (
        <div className="v22-bento-card p-5 sm:p-8">
          {analysisState === 'idle' && (
            <div className="flex flex-col items-center justify-center text-center py-4 max-w-2xl mx-auto space-y-6">
              <div
                className="w-20 h-20 rounded-[28px] border flex items-center justify-center relative"
                style={{
                  background: 'var(--mks-accent-soft)',
                  borderColor: 'var(--mks-card-border)',
                  color: 'var(--mks-accent-soft-text)'
                }}
              >
                <ScanSearch size={38} strokeWidth={1.7} />
                <div
                  className="absolute -bottom-2 -right-2 rounded-full p-1.5 shadow-md v22-keep-white"
                  style={{ background: 'var(--mks-accent-primary)', color: '#ffffff' }}
                >
                  <Sprout size={14} />
                </div>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--mks-text)' }}>
                  Görsel Bitki, Yaprak ve Zararlı Teşhisi
                </h2>
                <p className="text-sm leading-relaxed mt-2 max-w-lg mx-auto" style={{ color: 'var(--mks-muted)' }}>
                  Yaprak lekesi, zararlı böcek veya besin noksanlığı fotoğrafını tarayın; yapay zeka teşhis koyup
                  otomatik olarak <strong style={{ color: 'var(--mks-text)' }}>deponuzdaki ve Resmi BKÜ kataloğundaki</strong> en uygun ilaçları eşleştirsin.
                </p>
              </div>

              {/* Optional Crop Hint Selector */}
              <div className="w-full max-w-md text-left">
                <label className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--mks-muted)' }}>
                  Bitki Türü İpucu (Opsiyonel — Teşhis İsabetini Artırır)
                </label>
                <select
                  value={visionCropHint}
                  onChange={e => setVisionCropHint(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs font-bold border outline-none"
                  style={{
                    background: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                >
                  <option value="">Otomatik Bitki Tespiti (Belirsiz)</option>
                  {CROP_CATEGORIES.map(cat => (
                    <optgroup key={cat.id} label={cat.name}>
                      {cat.crops.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {cameraError && (
                <div className="w-full max-w-md p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800">
                  {cameraError}
                </div>
              )}

              {isLiveCameraOpen ? (
                <div className="w-full max-w-lg space-y-3">
                  <div className="relative rounded-3xl overflow-hidden border shadow-xl bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-72 object-cover" />
                    <button
                      onClick={stopLiveCamera}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/60 v22-keep-white text-white"
                      title="Kamerayı Kapat"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={captureFromLiveCamera}
                      className="v22-dark-pill px-6 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg"
                    >
                      <Camera size={16} /> Fotoğrafı Yakala ve Analiz Et
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full">
                  <button
                    onClick={openLiveCamera}
                    className="flex flex-col items-center justify-center gap-2.5 py-6 px-4 rounded-3xl border transition-all hover:scale-[1.01] group"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform"
                      style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                    >
                      <Video size={22} />
                    </div>
                    <span className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>Canlı Kamera</span>
                    <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>Web / Cihaz kamerası</span>
                  </button>

                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2.5 py-6 px-4 rounded-3xl border transition-all hover:scale-[1.01] group"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Camera size={22} />
                    </div>
                    <span className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>Kamera ile Çek</span>
                    <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>Hızlı saha çekimi</span>
                  </button>

                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2.5 py-6 px-4 rounded-3xl border transition-all hover:scale-[1.01] group"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <ImageIcon size={22} />
                    </div>
                    <span className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>Galeriden Yükle</span>
                    <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>Kayıtlı fotoğraf seç</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {analysisState === 'analyzing' && currentImage && (
            <div className="flex flex-col items-center justify-center text-center py-8 max-w-sm mx-auto">
              <div className="relative mb-8">
                <div className="relative rounded-3xl overflow-hidden border shadow-xl" style={{ borderColor: 'var(--mks-card-border)' }}>
                  <img src={currentImage} className="w-60 h-60 object-cover" alt="Analiz ediliyor" />
                </div>
                <div
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 border rounded-full px-5 py-2 shadow-lg flex items-center gap-2.5"
                  style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                >
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--mks-accent-primary)' }} />
                  <span className="text-xs font-black whitespace-nowrap" style={{ color: 'var(--mks-text)' }}>
                    Analiz & BKÜ Eşleştirme...
                  </span>
                </div>
              </div>
              <p className="text-sm animate-pulse" style={{ color: 'var(--mks-muted)' }}>
                Yaprak dokusu, hastalık etmeni ve depo stok uyumu taranıyor...
              </p>
            </div>
          )}

          {analysisState === 'error' && errorMessage && (
            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="w-20 h-20 bg-rose-500/15 rounded-3xl flex items-center justify-center text-rose-600 mb-4 border border-rose-500/20">
                <AlertTriangle size={36} />
              </div>
              <h2 className="text-xl font-black mb-2" style={{ color: 'var(--mks-text)' }}>
                Teşhis Tamamlanamadı
              </h2>
              <p className="max-w-md mb-6 text-sm" style={{ color: 'var(--mks-muted)' }}>{errorMessage}</p>
              <button
                onClick={resetScanner}
                className="v22-dark-pill flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs"
              >
                <RefreshCw size={16} />
                Yeni Tarama Başlat
              </button>
            </div>
          )}

          {analysisState === 'result' && resultData && (
            <div className="max-w-3xl mx-auto space-y-5">
              {currentImage && (
                <div className="relative h-56 w-full rounded-3xl overflow-hidden shadow-lg border" style={{ borderColor: 'var(--mks-card-border)' }}>
                  <img src={currentImage} className="w-full h-full object-cover" alt="Analiz edilen görsel" />
                  <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-emerald-300 v22-keep-white flex items-center gap-1.5">
                    <Bot size={14} /> Yapay Zeka Görsel Teşhisi Tamamlandı
                  </div>
                </div>
              )}

              {!resultData.basarili_mi ? (
                <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-3xl flex gap-4">
                  <AlertTriangle size={24} className="text-rose-600 shrink-0" />
                  <div>
                    <span className="block font-black text-base mb-1" style={{ color: 'var(--mks-text)' }}>
                      Sorun Tespit Edilemedi
                    </span>
                    <p className="text-sm" style={{ color: 'var(--mks-muted)' }}>
                      {resultData.hata_mesaji ||
                        'Görselden tarımsal bir veri çıkarılamadı. Daha aydınlık ve yakın plan bir fotoğraf deneyin.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Diagnosis Card */}
                  <div
                    className="p-5 rounded-3xl border space-y-4"
                    style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                  >
                    <h3 className="font-black flex items-center gap-2.5 text-base" style={{ color: 'var(--mks-text)' }}>
                      <ScanSearch size={20} style={{ color: 'var(--mks-accent-primary)' }} />
                      Teşhis Sonucu
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl p-3.5 border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}>
                        <span className="text-[11px] block mb-0.5" style={{ color: 'var(--mks-muted)' }}>Bitki Türü</span>
                        <span className="font-bold text-sm" style={{ color: 'var(--mks-text)' }}>
                          {resultData.teshis?.bitki_turu}
                        </span>
                      </div>
                      <div className="rounded-2xl p-3.5 border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}>
                        <span className="text-[11px] block mb-0.5" style={{ color: 'var(--mks-muted)' }}>Kategori</span>
                        <span className="font-bold text-sm" style={{ color: 'var(--mks-text)' }}>
                          {resultData.teshis?.sorun_kategorisi}
                        </span>
                      </div>
                    </div>

                    <div
                      className="rounded-2xl p-4 border"
                      style={{ background: 'var(--mks-accent-soft)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <span className="text-[11px] block font-bold mb-1" style={{ color: 'var(--mks-accent-soft-text)' }}>
                        Sorun Adı / Etmen
                      </span>
                      <span className="font-black text-lg" style={{ color: 'var(--mks-text)' }}>
                        {resultData.teshis?.sorun_adi}
                      </span>
                    </div>

                    <div className="rounded-2xl p-3.5 border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs" style={{ color: 'var(--mks-muted)' }}>Teşhis Güvenilirliği</span>
                        <span className="font-black text-sm" style={{ color: 'var(--mks-text)' }}>
                          %{resultData.teshis?.guvenilirlik_yuzdesi || 0}
                        </span>
                      </div>
                      <div className="w-full bg-black/10 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${resultData.teshis?.guvenilirlik_yuzdesi || 0}%`,
                            background: 'var(--mks-accent-primary)'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Prescription Card */}
                  {resultData.recete && (
                    <div
                      className="p-5 rounded-3xl border space-y-3"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <h3 className="font-black flex items-center gap-2.5 text-base" style={{ color: 'var(--mks-text)' }}>
                        <FileText size={20} style={{ color: 'var(--mks-accent-primary)' }} />
                        Mühendis Reçetesi (Depo Uyumlu)
                      </h3>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl p-3.5 border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}>
                          <span className="text-[11px] block mb-0.5" style={{ color: 'var(--mks-muted)' }}>Ürün Grubu</span>
                          <span className="font-bold text-sm" style={{ color: 'var(--mks-text)' }}>
                            {resultData.recete.urun_grubu}
                          </span>
                        </div>
                        <div className="rounded-2xl p-3.5 border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}>
                          <span className="text-[11px] block mb-0.5" style={{ color: 'var(--mks-muted)' }}>Uygulama Dozu</span>
                          <span className="font-bold text-sm" style={{ color: 'var(--mks-text)' }}>
                            {resultData.recete.uygulama_dozu}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl p-4 border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}>
                        <span className="text-[11px] block mb-1" style={{ color: 'var(--mks-muted)' }}>Aktif Madde ve Oranı</span>
                        <span className="font-bold text-sm" style={{ color: 'var(--mks-text)' }}>
                          {resultData.recete.aktif_madde_ve_orani}
                        </span>
                      </div>

                      <div className="rounded-2xl p-4 border" style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}>
                        <span className="text-[11px] block mb-2" style={{ color: 'var(--mks-muted)' }}>
                          Önerilen Ticari Referanslar
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {resultData.recete.ornek_ticari_urun_referanslari?.map((ref, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 font-bold rounded-full text-xs"
                              style={{ background: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      </div>

                      {resultData.recete.ziraat_muhendisi_notu && (
                        <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20 flex gap-3">
                          <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs text-sky-700 font-bold block mb-0.5">Ziraat Mühendisi Notu</span>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--mks-text)' }}>
                              {resultData.recete.ziraat_muhendisi_notu}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auto Live Depot & Official BKU Matches */}
                  {visionMatches && (visionMatches.depotMatches.length > 0 || visionMatches.bkuMatches.length > 0) && (
                    <div
                      className="p-5 rounded-3xl border space-y-3"
                      style={{ background: 'var(--mks-subcard)', borderColor: 'var(--mks-card-border)' }}
                    >
                      <h3 className="font-black flex items-center gap-2 text-sm" style={{ color: 'var(--mks-text)' }}>
                        <Database size={16} style={{ color: 'var(--mks-accent-primary)' }} />
                        Otomatik Depo & Resmi BKÜ Katalog Eşleşmesi
                      </h3>

                      {visionMatches.depotMatches.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {visionMatches.depotMatches.map(item => (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl border flex items-center justify-between text-xs"
                              style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                            >
                              <div>
                                <span className="font-bold block" style={{ color: 'var(--mks-text)' }}>{item.pesticideName}</span>
                                <span className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                                  Depoda mevcut: {item.quantity} {item.unit}
                                </span>
                              </div>
                              <span className="font-black" style={{ color: 'var(--mks-accent-primary)' }}>
                                {formatCurrency(item.sellingPrice, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {visionMatches.bkuMatches.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {visionMatches.bkuMatches.slice(0, 4).map((bm, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-xl border text-xs"
                              style={{ background: 'var(--mks-card)', borderColor: 'var(--mks-card-border)' }}
                            >
                              <span className="font-bold block" style={{ color: 'var(--mks-text)' }}>{bm.pesticide.name}</span>
                              <span className="text-[11px] block" style={{ color: 'var(--mks-muted)' }}>
                                {bm.pesticide.activeIngredient}
                              </span>
                              <span className="text-[10px] font-bold" style={{ color: 'var(--mks-accent-primary)' }}>
                                Doz: {bm.dosage} {bm.phi ? `• PHI: ${bm.phi}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Handoff Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() =>
                        handleSendChat(
                          `Görsel teşhiste "${resultData.teshis?.bitki_turu}" bitkisinde "${resultData.teshis?.sorun_adi}" (${resultData.recete?.aktif_madde_ve_orani}) belirlendi. Depomdaki eşdeğer ilaçlarla 50 dekar için ayrıntılı uygulama ve tank karışım planı oluştur.`
                        )
                      }
                      className="v22-dark-pill py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={15} /> Bu Teşhisi AI Copilot’a Sor
                    </button>
                    <button
                      onClick={resetScanner}
                      className="v22-surface-pill py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <ScanSearch size={15} /> Yeni Görsel Tara
                    </button>
                  </div>
                </div>
              )}

              {!resultData.basarili_mi && (
                <button
                  onClick={resetScanner}
                  className="w-full v22-dark-pill flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm"
                >
                  <ScanSearch size={18} />
                  Yeni Görsel Tara
                </button>
              )}
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

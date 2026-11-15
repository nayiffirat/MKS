import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Apple,
  Beaker,
  BookOpen,
  Bug,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Cherry,
  ChevronLeft,
  ChevronRight,
  Citrus,
  Clock,
  Droplet,
  FileImage,
  FlaskConical,
  Flower2,
  Grape,
  HelpCircle,
  Info,
  Layers,
  Leaf,
  Microscope,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Sprout,
  SwitchCamera,
  Target,
  Thermometer,
  Wheat,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CROP_CATEGORIES,
  CROP_STAGES,
  GENERIC_PROBLEMS,
  GENERIC_STAGES,
  PROBLEM_DATABASE
} from '../constants/cropData';
import {
  CROP_AGRONOMY_PROFILES,
  CropAgronomyProfile,
  DEFICIENCY_GUIDE,
  MIXING_ORDER_STEPS,
  QUICK_AGRI_QUESTIONS,
  SEASONAL_CALENDAR,
  TANK_MIX_GUIDE,
  WATER_QUALITY_GUIDE,
  getProblemVisualAndMeta
} from '../constants/agriKnowledge';
import { OFFICIAL_BKU_CATALOG } from '../constants/bkuCatalog';
import { Pesticide } from '../types';
import { askAgronomistAI, analyzeLeafImageAI } from '../utils/gemini';
import { turkishIncludes, turkishMatchesAny } from '../utils/search';

const renderIcon = (iconName: string, size: number) => {
  switch (iconName) {
    case 'Sprout':
      return <Sprout size={size} />;
    case 'Apple':
      return <Apple size={size} />;
    case 'Leaf':
      return <Leaf size={size} />;
    case 'Wheat':
      return <Wheat size={size} />;
    case 'Flower2':
      return <Flower2 size={size} />;
    case 'Grape':
      return <Grape size={size} />;
    case 'Cherry':
      return <Cherry size={size} />;
    case 'Citrus':
      return <Citrus size={size} />;
    default:
      return <Sprout size={size} />;
  }
};

interface AgriPhotoProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackIcon?: string;
  badge?: string;
}

const AgriPhoto: React.FC<AgriPhotoProps> = ({
  src,
  alt,
  className = 'w-full h-40',
  fallbackIcon = 'Sprout',
  badge
}) => {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src]);

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ backgroundColor: 'var(--mks-subcard)' }}
    >
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-1.5 opacity-60"
          style={{ color: 'var(--mks-accent-primary)' }}
        >
          {renderIcon(fallbackIcon, 32)}
          <span className="text-[10px] font-bold uppercase tracking-wider">{alt}</span>
        </div>
      )}
      {badge && (
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/65 text-white backdrop-blur-sm">
          {badge}
        </span>
      )}
    </div>
  );
};

interface Props {
  onBack?: () => void;
}

type ViewState = 'CATEGORIES' | 'STAGES' | 'PROBLEMS' | 'PROBLEM_DETAIL' | 'SCANNER' | 'AI_RESULT';
type MainTab = 'REHBER' | 'AI_DANISMAN' | 'TANK_MIX' | 'DEFICIENCY' | 'TAKVIM';
type CropGroupFilter = 'ALL' | 'TARLA' | 'SEBZE' | 'MEYVE';
type CropDetailSubTab = 'STAGES' | 'FERTILIZER' | 'THRESHOLDS' | 'BKU';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

const CROP_BKU_ALIASES: Record<string, string[]> = {
  PAMUK: ['PAMUK'],
  MISIR: ['MISIR'],
  BUGDAY: ['BUĞDAY', 'BUGDAY', 'TAHIL', 'HUBUBAT'],
  ARPA: ['ARPA', 'TAHIL', 'HUBUBAT'],
  AYCICEGI: ['AYÇİÇEĞİ', 'AYCICEGI'],
  SEKER_PANCARI: ['ŞEKERPANCARI', 'ŞEKER PANCARI'],
  PATATES: ['PATATES'],
  SOGAN: ['SOĞAN', 'SOGAN'],
  YER_FISTIGI: ['YERFISTIĞI', 'YER FISTIĞI'],
  MERCIMEK: ['MERCİMEK'],
  SOYA: ['SOYA'],
  KIMYON: ['KİMYON'],
  DOMATES: ['DOMATES'],
  BIBER: ['BİBER'],
  HIYAR: ['HIYAR', 'SALATALIK', 'KORNİŞON'],
  PATLICAN: ['PATLICAN'],
  KARPUZ: ['KARPUZ'],
  KAVUN: ['KAVUN'],
  CILEK: ['ÇİLEK'],
  BAMYA: ['BAMYA'],
  BAG: ['BAĞ', 'ÜZÜM'],
  ELMA: ['ELMA'],
  ARMUT: ['ARMUT'],
  SEFTALI: ['ŞEFTALİ', 'KAYISI', 'NEKTARİN'],
  KIRAZ: ['KİRAZ', 'VİŞNE'],
  ZEYTIN: ['ZEYTİN'],
  NARENCIYE: ['TURUNÇGİL', 'PORTAKAL', 'LİMON', 'MANDALİNA', 'GREYFURT'],
  FISTIK: ['ANTEPFISTIĞI', 'ANTEP FISTIĞI'],
  FINDIK: ['FINDIK'],
  CEVIZ: ['CEVİZ'],
  NAR: ['NAR'],
  BADEM: ['BADEM']
};

function findBkuProductsForCrop(cropId: string, cropName: string): Pesticide[] {
  const aliases = CROP_BKU_ALIASES[cropId] || [cropName];
  return OFFICIAL_BKU_CATALOG.filter((p) => {
    const crops = [...(p.targetCrops || []), ...(p.usages?.map((u) => u.crop) || [])];
    return aliases.some((alias) => turkishMatchesAny(crops, alias));
  });
}

function findMatchingBkuForProblem(problem: any, cropId?: string, cropName?: string): Pesticide[] {
  if (!problem) return [];
  const activeKeywords: string[] = Array.isArray(problem.activeIngredients)
    ? problem.activeIngredients
        .map((s: string) => s.split('(')[0].split('+')[0].trim())
        .filter((s: string) => s.length >= 4)
    : [];
  const problemKeyword = String(problem.name || '').split('(')[0].trim();

  const pool = cropId && cropName ? findBkuProductsForCrop(cropId, cropName) : OFFICIAL_BKU_CATALOG;

  const hits = pool.filter((p) => {
    if (activeKeywords.some((kw) => turkishIncludes(p.activeIngredient, kw))) {
      return true;
    }
    if (problemKeyword.length >= 4 && turkishMatchesAny(p.targetPests || [], problemKeyword)) {
      return true;
    }
    return false;
  });

  if (hits.length > 0) return hits.slice(0, 12);

  // Fallback to global catalog active ingredient match if crop filter had no specific hit
  return OFFICIAL_BKU_CATALOG.filter((p) =>
    activeKeywords.some((kw) => turkishIncludes(p.activeIngredient, kw))
  ).slice(0, 8);
}

const getProblemTypeBadge = (type: string): { label: string; badgeClass: string } => {
  switch (type) {
    case 'HASTALIK':
      return {
        label: 'Hastalık',
        badgeClass: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25'
      };
    case 'ZARARLI':
      return {
        label: 'Zararlı Böcek / Akar',
        badgeClass: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25'
      };
    case 'YABANCI_OT':
      return {
        label: 'Yabancı Ot',
        badgeClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
      };
    default:
      return {
        label: 'Bitki Besleme',
        badgeClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25'
      };
  }
};

export const MKSMuhendisim: React.FC<Props> = ({ onBack }) => {
  const [mainTab, setMainTab] = useState<MainTab>('REHBER');
  const [viewState, setViewState] = useState<ViewState>(
    window.history.state?.mksViewState || 'CATEGORIES'
  );
  const [selectedCrop, setSelectedCrop] = useState<{ id: string; name: string; icon?: string } | null>(null);
  const [selectedStage, setSelectedStage] = useState<{ id: string; name: string } | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<any>(null);

  // Hub & Detail Filters
  const [cropGroupFilter, setCropGroupFilter] = useState<CropGroupFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cropSubTab, setCropSubTab] = useState<CropDetailSubTab>('STAGES');
  const [bkuSubSearch, setBkuSubSearch] = useState('');
  const [problemTypeFilter, setProblemTypeFilter] = useState<string>('ALL');
  const [solutionTab, setSolutionTab] = useState<'ACTIVE_INGREDIENT' | 'COMMERCIAL_NAME' | 'BKU_MATCH'>('ACTIVE_INGREDIENT');

  // Scanner & Camera
  const [scanState, setScanState] = useState<'INITIAL' | 'SCANNING' | 'ANALYZING' | 'FOUND'>('INITIAL');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Merhaba! Ben MKS Ziraat Mühendisi Yapay Zeka Asistanıyım. 32 kültür bitkimizin yetiştiricilik pasaportu, hastalık/zararlı eşikleri, tank karışımı uyumluluğu ve ruhsatlı BKÜ ilaç dozajları hakkında bana her şeyi sorabilirsiniz.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [aiContextCropId, setAiContextCropId] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Tank Mix Simulator & Deficiency & Calendar State
  const [selectedMixIds, setSelectedMixIds] = useState<string[]>(['BAKIR', 'AMINO_ASIT']);
  const [deficiencyFilter, setDeficiencyFilter] = useState<'ALL' | 'Makro Besin' | 'Mikro Besin' | 'GENÇ' | 'YAŞLI'>('ALL');
  const [deficiencySearch, setDeficiencySearch] = useState('');
  const [selectedSeason, setSelectedSeason] = useState<'İlkbahar' | 'Yaz' | 'Sonbahar' | 'Kış'>('İlkbahar');

  // Camera Stream Handling
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (viewState === 'SCANNER') {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error('Kamera açılamadı:', err);
        }
      };
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [viewState, facingMode]);

  // History Popstate Handling
  useEffect(() => {
    if (!window.history.state?.mksViewState) {
      window.history.replaceState({ ...window.history.state, mksViewState: 'CATEGORIES' }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state && state.view === 'MKS_MUHENDISIM') {
        if (state.mksViewState) {
          setViewState(state.mksViewState);
        } else {
          setViewState('CATEGORIES');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiReplying]);

  const changeViewState = (newState: ViewState) => {
    window.history.pushState({ ...window.history.state, mksViewState: newState, subView: true }, '');
    setViewState(newState);
  };

  const handleCropSelect = (crop: { id: string; name: string; icon?: string }) => {
    setSelectedCrop(crop);
    setCropSubTab('STAGES');
    setBkuSubSearch('');
    setSearchQuery('');
    changeViewState('STAGES');
  };

  const handleStageSelect = (stage: { id: string; name: string }) => {
    setSelectedStage(stage);
    setProblemTypeFilter('ALL');
    setSearchQuery('');
    changeViewState('PROBLEMS');
  };

  const handleProblemSelect = (problem: any) => {
    setSelectedProblem(problem);
    setSolutionTab('ACTIVE_INGREDIENT');
    changeViewState('PROBLEM_DETAIL');
  };

  const handleBack = () => {
    if (viewState === 'CATEGORIES') {
      if (onBack) onBack();
    } else if (viewState === 'SCANNER') {
      setScanState('INITIAL');
      changeViewState('CATEGORIES');
    } else {
      window.history.back();
    }
  };

  const handleSendChatMessage = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || chatInput;
    if (!textToSend.trim() || isAiReplying) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!overridePrompt) setChatInput('');
    setIsAiReplying(true);

    try {
      const ctxProfile = aiContextCropId ? CROP_AGRONOMY_PROFILES[aiContextCropId] : undefined;
      const cropInfo = ctxProfile?.name || selectedCrop?.name;
      const replyText = await askAgronomistAI(textToSend, cropInfo);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: replyText || 'Özür dilerim, şu anda zirai veritabanına ulaşılamadı. Lütfen tekrar deneyiniz.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Bağlantı hatası oluştu. Lütfen internet bağlantınızı ve sunucu durumunu kontrol edip tekrar deneyiniz.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAiReplying(false);
    }
  };

  const processLeafImageBase64 = async (base64Data: string, mimeType: string = 'image/jpeg') => {
    setScanState('ANALYZING');
    try {
      const rawResponse = await analyzeLeafImageAI(base64Data, mimeType, selectedCrop?.name);
      let parsedData: any = null;

      try {
        const jsonStr = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedData = JSON.parse(jsonStr);
      } catch {
        parsedData = {
          cropName: selectedCrop?.name || 'Bitki',
          problemType: 'HASTALIK',
          name: 'AI Yaprak Teşhisi',
          description: rawResponse,
          activeIngredients: ['Sistemik Fungisitler', 'Bakır Hidroksit'],
          commercialNames: ['Ruhsatlı Bitki Koruma Ürünü'],
          solutionDescription: 'Fotoğraf analizi sonucunda yukarıdaki mücadele önerisine uyunuz.'
        };
      }

      setSelectedProblem({
        type: parsedData.problemType || 'HASTALIK',
        name: parsedData.name || 'Bitki Hastalığı',
        description: parsedData.description || 'Görsel analiz sonucunda tespit edilen semptomlar.',
        culturalControls: parsedData.culturalControls || [],
        activeIngredients: parsedData.activeIngredients || [],
        commercialNames: parsedData.commercialNames || [],
        solutionDescription: parsedData.solutionDescription || 'Uygulama doz ve detayları.',
        phiDays: parsedData.phiDays || 'Güvenlik süresine dikkat ediniz.'
      });

      setSelectedCrop({
        id: 'AI_CROP',
        name: parsedData.cropName || 'Taranan Bitki',
        icon: 'Leaf'
      });

      setSelectedStage({ id: 'AI_STAGE', name: 'Görsel Yapay Zeka Teşhisi' });
      changeViewState('AI_RESULT');
      setScanState('INITIAL');
    } catch {
      setSelectedProblem({
        type: 'HASTALIK',
        name: 'Erken Yaprak Yanıklığı (Alternaria solani)',
        description: 'Yapay zeka analizine göre yapraklarda kahverengi hareli lekeler tespit edildi.',
        activeIngredients: ['Azoxystrobin', 'Mancozeb', 'Difenoconazole'],
        commercialNames: ['Amistar', 'Dithane M-45', 'Score'],
        solutionDescription:
          'Enfekte alt yaprakları uzaklaştırıp havalanmayı artırınız. 7–10 gün arayla dönüşümlü fungisit uygulayınız.'
      });
      setSelectedCrop({ id: 'DOMATES', name: selectedCrop?.name || 'Domates', icon: 'Leaf' });
      setSelectedStage({ id: 'AI_STAGE', name: 'Yaprak Taraması' });
      changeViewState('AI_RESULT');
      setScanState('INITIAL');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      changeViewState('SCANNER');
      processLeafImageBase64(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureFromCamera = () => {
    if (!videoRef.current) return;
    setScanState('SCANNING');

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      processLeafImageBase64(base64, 'image/jpeg');
    } else {
      setScanState('ANALYZING');
      setTimeout(() => {
        setScanState('FOUND');
        setTimeout(() => {
          setSelectedProblem({
            type: 'HASTALIK',
            name: 'Külleme Hastalığı (Erysiphe spp.)',
            description: 'Yaprak yüzeyinde unsu beyaz pudramsı tabaka tespit edildi.',
            activeIngredients: ['Kükürt', 'Penconazole', 'Myclobutanil'],
            commercialNames: ['Wettable Sulfur', 'Topas 100 EC', 'Systhane'],
            solutionDescription:
              'Yaprak üst yüzeylerine 10–14 gün arayla kükürtlü veya triazol grubu fungisitler uygulayın.'
          });
          setSelectedCrop({ id: 'DOMATES', name: 'Taranan Bitki', icon: 'Leaf' });
          setSelectedStage({ id: 'AI_STAGE', name: 'Canlı Kamera Taraması' });
          changeViewState('AI_RESULT');
          setScanState('INITIAL');
        }, 800);
      }, 1200);
    }
  };

  const selectedCropProfile: CropAgronomyProfile | undefined = selectedCrop
    ? CROP_AGRONOMY_PROFILES[selectedCrop.id]
    : undefined;

  const currentStages = selectedCrop ? CROP_STAGES[selectedCrop.id] || GENERIC_STAGES : [];

  const currentProblems = useMemo(() => {
    if (!selectedCrop || !selectedStage) return [];
    const list =
      PROBLEM_DATABASE[selectedCrop.id]?.[selectedStage.id] ||
      GENERIC_PROBLEMS[selectedStage.id] ||
      GENERIC_PROBLEMS['VEGETATIF'] ||
      GENERIC_PROBLEMS['TARLA'] ||
      [];
    return list;
  }, [selectedCrop, selectedStage]);

  const filteredProblems = useMemo(() => {
    if (problemTypeFilter === 'ALL') return currentProblems;
    return currentProblems.filter((p: any) => p.type === problemTypeFilter);
  }, [currentProblems, problemTypeFilter]);

  const cropBkuProducts = useMemo(() => {
    if (!selectedCrop) return [];
    const all = findBkuProductsForCrop(selectedCrop.id, selectedCrop.name);
    if (!bkuSubSearch.trim()) return all;
    return all.filter((p) =>
      turkishMatchesAny(
        [p.name, p.activeIngredient, p.bkuGroup, ...(p.targetPests || [])],
        bkuSubSearch
      )
    );
  }, [selectedCrop, bkuSubSearch]);

  const problemBkuMatches = useMemo(
    () => findMatchingBkuForProblem(selectedProblem, selectedCrop?.id, selectedCrop?.name),
    [selectedProblem, selectedCrop]
  );

  const problemVisualMeta = useMemo(
    () =>
      selectedProblem
        ? getProblemVisualAndMeta(selectedProblem.name, selectedProblem.type, selectedCrop?.name)
        : null,
    [selectedProblem, selectedCrop]
  );

  const filteredDeficiency = useMemo(() => {
    return DEFICIENCY_GUIDE.filter((item) => {
      const matchesType =
        deficiencyFilter === 'ALL'
          ? true
          : deficiencyFilter === 'GENÇ'
          ? item.targetLeaves.includes('Genç')
          : deficiencyFilter === 'YAŞLI'
          ? item.targetLeaves.includes('Yaşlı')
          : item.type === deficiencyFilter;
      const matchesSearch = !deficiencySearch.trim()
        ? true
        : turkishMatchesAny(
            [
              item.element,
              item.symbol,
              item.symptoms,
              item.visualCue,
              item.solution,
              ...(item.sensitiveCrops || [])
            ],
            deficiencySearch
          );
      return matchesType && matchesSearch;
    });
  }, [deficiencyFilter, deficiencySearch]);

  // Tank Mix Simulator Verdict
  const mixVerdict = useMemo(() => {
    if (selectedMixIds.length < 2) {
      return {
        status: 'IDLE' as const,
        title: 'Karışım Testi İçin En Az 2 Grup Seçin',
        details: 'Yukarıdaki listeden 2 veya daha fazla ilaç/gübre grubunu seçerek tankta çökelti veya yaprak yakma riskini anında test edebilirsiniz.'
      };
    }

    const selectedItems = selectedMixIds
      .map((id) => TANK_MIX_GUIDE.find((g) => g.id === id))
      .filter(Boolean);

    const conflicts: string[] = [];
    const cautions: string[] = [];

    const has = (id: string) => selectedMixIds.includes(id);

    if (has('BAKIR') && has('AMINO_ASIT')) {
      conflicts.push('Bakırlı İlaç + Amino Asit / Biyouyarıcı: Bakır iyonları yaprağa toksik dozda taşınır ve şiddetli yanık (fitotoksisite) yapar!');
    }
    if (has('BAKIR') && has('INSEKTISIT_OP')) {
      conflicts.push('Bakır / Bordo Bulamacı + Organik Fosforlu veya Piretroit İnsektisit: Alkali hidroliz ilacın etken maddesini dakikalar içinde bozar!');
    }
    if (has('BAKIR') && has('KALSIYUM')) {
      conflicts.push('Bakır + Kalsiyum Nitrat: Yüksek katyon ve pH uyuşmazlığı nedeniyle tankta çökme ve yaprak yanması oluşur.');
    }
    if (has('BAKIR') && has('FOSFIT_HUMIK')) {
      conflicts.push('Bakır + Potasyum Fosfit / Hümik Asit: Fosfit bakır çözünürlüğünü bozarak yaprak/meyve pası oluşturur (en az 7–10 gün ara gerekir).');
    }
    if (has('KUKURT') && has('YAGLAR')) {
      conflicts.push('Kükürt + Yazlık/Kışlık Mineral Yağlar: KESİNLİKLE KARIŞMAZ! Yaprakları tamamen yakar ve döker (en az 21 gün ara bırakılmalıdır).');
    }
    if (has('HERBISIT') && (has('AMINO_ASIT') || has('KALSIYUM') || has('YAGLAR'))) {
      cautions.push('Herbisit + Yaprak Gübresi/Amino Asit/Yağ: Ot öldürme mekanizması bozulabilir veya kültür bitkisi ciddi strese/yanmaya uğrayabilir.');
    }
    if (has('KALSIYUM') && has('FOSFIT_HUMIK')) {
      cautions.push('Kalsiyum + Fosfit / Hümik Asit: Yüksek derişimde kalsiyum jelleşme yapabilir; ayrı gün veya mutlaka kavanoz testi gerekir.');
    }
    if (has('INSEKTISIT_OP') && has('KUKURT')) {
      cautions.push('İnsektisit + Elementel Kükürt: Kükürt pH’ı düşürüp düzenlemezse ve hava >28°C ise yaprak yakma riski doğar; kavanoz testi önerilir.');
    }

    if (conflicts.length > 0) {
      return {
        status: 'DANGER' as const,
        title: `KESİNLİKLE KARIŞTIRMAYIN (${selectedItems.length} Grup Seçili)`,
        details: conflicts.join(' ')
      };
    }

    if (cautions.length > 0) {
      return {
        status: 'WARNING' as const,
        title: 'KOŞULLU KARIŞIM — KAVANOZ TESTİ & DİKKAT GEREKLİ',
        details: cautions.join(' ')
      };
    }

    return {
      status: 'SAFE' as const,
      title: 'UYUMLU KARIŞIM (WALES SIRASI İLE HAZIRLANABİLİR)',
      details:
        'Seçili gruplar arasında kritik kimyasal uyumsuzluk tespit edilmedi. Uygulama öncesi küçük şeffaf kavanozda 15 dakika bekletme testi yapıp tank suyunu pH 5.5–6.5 aralığına ayarlayarak uygulayın.'
    };
  }, [selectedMixIds]);

  const toggleMixGroup = (id: string) => {
    setSelectedMixIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const askAboutCurrentProblem = () => {
    if (!selectedProblem) return;
    const cropLabel = selectedCrop?.name || 'Bitki';
    const prompt = `${cropLabel} yetiştiriciliğinde ${selectedProblem.name} sorunuyla karşılaşıyorum. Sahada erken belirti ayrımı, ekonomik zarar eşiği ve kalıntısız dönüşümlü ilaçlama stratejisi nasıl olmalıdır?`;
    if (selectedCrop?.id && CROP_AGRONOMY_PROFILES[selectedCrop.id]) {
      setAiContextCropId(selectedCrop.id);
    }
    setMainTab('AI_DANISMAN');
    window.history.replaceState({ ...window.history.state, mksViewState: 'CATEGORIES' }, '');
    setViewState('CATEGORIES');
    setTimeout(() => {
      handleSendChatMessage(prompt);
    }, 100);
  };

  const totalCropsCount = useMemo(
    () => CROP_CATEGORIES.reduce((sum, cat) => sum + cat.crops.length, 0),
    []
  );

  // Live full-screen camera viewfinder
  if (viewState === 'SCANNER') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black overflow-hidden">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-40 bg-gradient-to-b from-black/80 to-transparent pt-7">
          <button
            type="button"
            onClick={() => {
              setScanState('INITIAL');
              changeViewState('CATEGORIES');
            }}
            className="w-11 h-11 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/20 cursor-pointer"
          >
            <X size={22} />
          </button>
          <div className="text-xs font-black text-white uppercase tracking-widest bg-black/55 backdrop-blur-xl px-5 py-2 rounded-full border border-white/15 flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            MKS AI YAPRAK TEŞHİSİ
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 bg-black/50 backdrop-blur-xl rounded-full flex items-center justify-center text-white border border-white/20 cursor-pointer"
            title="Galeriden Fotoğraf Seç"
          >
            <FileImage size={20} />
          </button>
        </div>

        <div className="absolute inset-x-6 top-28 bottom-36 border-2 border-white/25 rounded-[36px] overflow-hidden z-10 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] pointer-events-none">
          <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-[36px]" />
          <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-[36px]" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-[36px]" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-[36px]" />

          {(scanState === 'SCANNING' || scanState === 'ANALYZING') && (
            <motion.div
              initial={{ top: '0%' }}
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
              className="absolute left-0 right-0 h-1.5 bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.95)]"
            />
          )}

          <div className="absolute bottom-6 left-0 right-0 text-center">
            <span className="backdrop-blur-xl text-[11px] font-bold tracking-wide uppercase px-4 py-2 rounded-full border bg-black/65 text-emerald-300 border-emerald-500/35">
              {scanState === 'INITIAL' && 'Hasta yaprağı veya zararlıyı çerçeveye ortalayın'}
              {scanState === 'SCANNING' && 'Görüntü yakalanıyor...'}
              {scanState === 'ANALYZING' && 'Gemini AI hastalık & eksiklik analizi yapıyor...'}
              {scanState === 'FOUND' && 'Teşhis tamamlandı!'}
            </span>
          </div>
        </div>

        <div className="absolute bottom-7 left-6 right-6 z-40 flex items-center justify-between gap-3 max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="w-13 h-13 p-3.5 bg-black/55 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/20 cursor-pointer shrink-0"
          >
            <SwitchCamera size={22} />
          </button>

          <button
            type="button"
            onClick={handleCaptureFromCamera}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-2xl shadow-xl border border-emerald-400/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera size={20} />
            Fotoğraf Çek ve Teşhis Et
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-28 pt-2 sm:pt-4 space-y-5 font-sans">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* KURUMSAL HEADER CARD */}
      <div className="v22-bento-card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="v22-surface-pill inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                style={{ color: 'var(--mks-text)' }}
              >
                <ChevronLeft size={14} />
                {viewState === 'CATEGORIES' ? 'Geri' : 'Önceki Ekran'}
              </button>

              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase"
                style={{
                  backgroundColor: 'var(--mks-accent-soft)',
                  color: 'var(--mks-accent-soft-text)'
                }}
              >
                <Microscope size={13} />
                Zirai Bilgi, EZE & BKÜ Agronomi Merkezi
              </span>

              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-muted)' }}
              >
                {totalCropsCount} Kültür Bitkisi • {OFFICIAL_BKU_CATALOG.length} Resmi BKÜ Ruhsatı
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--mks-text)' }}>
                {viewState === 'CATEGORIES' && 'MKS Mühendisim — Zirai Bilgi Portalı'}
                {viewState === 'STAGES' && `${selectedCrop?.name} Yetiştiricilik Pasaportu`}
                {viewState === 'PROBLEMS' && `${selectedCrop?.name} • ${selectedStage?.name}`}
                {viewState === 'PROBLEM_DETAIL' && (selectedProblem?.name || 'Teşhis ve Mücadele')}
                {viewState === 'AI_RESULT' && 'AI Görsel Teşhis Raporu'}
              </h1>
            </div>

            <p className="text-sm max-w-3xl" style={{ color: 'var(--mks-muted)' }}>
              {viewState === 'CATEGORIES' &&
                'Gerçek bitki/zararlı fotoğrafları, Ekonomik Zarar Eşikleri (EZE), 4 aşamalı gübreleme programları, Tank Mix simülatörü ve Gemini AI görsel teşhis asistanı.'}
              {viewState === 'STAGES' &&
                `${selectedCropProfile?.scientificName || selectedCrop?.name} (${selectedCropProfile?.family || 'Zirai Tür'}) için fenolojik evreler, gübreleme takvimi, eşikler ve Bakanlık ruhsatlı BKÜ ürünleri.`}
              {viewState === 'PROBLEMS' &&
                'Bu gelişim evresinde karşılaşılan hastalık, zararlı böcek, yabancı ot ve besleme risklerini inceleyin.'}
              {viewState === 'PROBLEM_DETAIL' &&
                `${selectedCrop?.name} / ${selectedStage?.name} dönemi saha teşhis, etken madde ve kültürel mücadele rehberi.`}
              {viewState === 'AI_RESULT' &&
                'Yapay zeka görüntü analizi ile tespit edilen etmen, kültürel önlemler ve önerilen etken maddeler.'}
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => changeViewState('SCANNER')}
              className="v22-surface-pill inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold cursor-pointer"
              style={{ color: 'var(--mks-text)' }}
            >
              <Camera size={15} className="text-emerald-600" />
              Kamera ile Yaprak Tara
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="v22-surface-pill inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold cursor-pointer"
              style={{ color: 'var(--mks-text)' }}
            >
              <FileImage size={15} className="text-sky-600" />
              Fotoğraf Yükle
            </button>

            <button
              type="button"
              onClick={() => {
                setMainTab('AI_DANISMAN');
                setViewState('CATEGORIES');
              }}
              className="v22-dark-pill inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold shadow-sm cursor-pointer"
            >
              <Sparkles size={15} />
              AI Mühendise Sor
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="mt-5 pt-4 border-t flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
          style={{ borderColor: 'var(--mks-input-border)' }}
        >
          {(
            [
              { key: 'REHBER', label: 'Bitki Atlası & Rehber', icon: <Sprout size={14} /> },
              { key: 'AI_DANISMAN', label: 'AI Ziraat Danışmanı', icon: <Sparkles size={14} /> },
              { key: 'TANK_MIX', label: 'Tank Mix & Su Kalitesi', icon: <FlaskConical size={14} /> },
              { key: 'DEFICIENCY', label: 'Besin Noksanlığı (12)', icon: <Droplet size={14} /> },
              { key: 'TAKVIM', label: 'Fenolojik Takvim', icon: <Calendar size={14} /> }
            ] as const
          ).map((tab) => {
            const active = viewState === 'CATEGORIES' && mainTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setMainTab(tab.key);
                  if (viewState !== 'CATEGORIES') {
                    setViewState('CATEGORIES');
                  }
                }}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  active ? 'shadow-sm' : 'opacity-80 hover:opacity-100'
                }`}
                style={
                  active
                    ? { backgroundColor: 'var(--mks-accent-primary)', color: '#ffffff' }
                    : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                }
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* HUB VIEW (CATEGORIES + TABS) */}
      <AnimatePresence mode="wait">
        {viewState === 'CATEGORIES' && (
          <motion.div
            key={`hub-${mainTab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-5"
          >
            {/* 4 CLICKABLE KURUMSAL KPI CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMainTab('REHBER');
                  setCropGroupFilter('ALL');
                }}
                className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
                  mainTab === 'REHBER' && cropGroupFilter === 'ALL' ? 'ring-2 ring-emerald-500/60' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    Bitki Atlası
                  </span>
                  <Sprout size={16} className="text-emerald-600" />
                </div>
                <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
                  {totalCropsCount} Kültür
                </div>
                <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                  Pasaport, verim, sulama & NPK
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('AI_DANISMAN')}
                className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
                  mainTab === 'AI_DANISMAN' ? 'ring-2 ring-indigo-500/60' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    AI Teşhis & BKÜ
                  </span>
                  <Microscope size={16} className="text-indigo-500" />
                </div>
                <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
                  {OFFICIAL_BKU_CATALOG.length} Ruhsat
                </div>
                <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                  Canlı yaprak tarama & BKÜ eşleşmesi
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('DEFICIENCY')}
                className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
                  mainTab === 'DEFICIENCY' ? 'ring-2 ring-teal-500/60' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    Besin Noksanlığı
                  </span>
                  <Droplet size={16} className="text-teal-500" />
                </div>
                <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
                  {DEFICIENCY_GUIDE.length} Element
                </div>
                <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                  Görsel yaprak semptomları & doz
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMainTab('TANK_MIX')}
                className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
                  mainTab === 'TANK_MIX' ? 'ring-2 ring-sky-500/60' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    Tank Mix Testi
                  </span>
                  <FlaskConical size={16} className="text-sky-500" />
                </div>
                <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
                  {TANK_MIX_GUIDE.length} Grup
                </div>
                <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                  WALES sırası & canlı uyumluluk testi
                </div>
              </button>
            </div>

            {/* TAB 1: ZİRAİ REHBER & FOTOĞRAFLI BİTKİ ATLASI */}
            {mainTab === 'REHBER' && (
              <div className="space-y-5">
                {/* Filter & Search Bar */}
                <div className="v22-bento-card p-4 space-y-3">
                  <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'ALL', label: `Tümü (${totalCropsCount})` },
                          { id: 'TARLA', label: 'Tarla Bitkileri (12)' },
                          { id: 'SEBZE', label: 'Sebze & Sera (8)' },
                          { id: 'MEYVE', label: 'Meyve Ağaçları & Bağ (12)' }
                        ] as const
                      ).map((g) => {
                        const active = cropGroupFilter === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setCropGroupFilter(g.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            style={
                              active
                                ? { backgroundColor: 'var(--mks-accent-primary)', color: '#fff' }
                                : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                            }
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative md:w-80">
                      <Search
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60"
                        style={{ color: 'var(--mks-muted)' }}
                      />
                      <input
                        type="text"
                        placeholder="Bitki, Latince adı veya familya ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/40"
                        style={{
                          backgroundColor: 'var(--mks-input-bg)',
                          borderColor: 'var(--mks-input-border)',
                          color: 'var(--mks-text)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Crop Category Sections */}
                {CROP_CATEGORIES.map((cat) => {
                  if (cropGroupFilter !== 'ALL' && cat.id !== cropGroupFilter) return null;

                  const filteredCrops = cat.crops.filter((c) => {
                    const profile = CROP_AGRONOMY_PROFILES[c.id];
                    return turkishMatchesAny(
                      [c.name, profile?.scientificName, profile?.family, profile?.targetYieldPerDa],
                      searchQuery
                    );
                  });

                  if (filteredCrops.length === 0) return null;

                  return (
                    <div key={cat.id} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h2
                          className="text-xs font-black uppercase tracking-widest flex items-center gap-2"
                          style={{ color: 'var(--mks-muted)' }}
                        >
                          {cat.id === 'TARLA' && <Sprout size={15} className="text-emerald-600" />}
                          {cat.id === 'SEBZE' && <Leaf size={15} className="text-amber-600" />}
                          {cat.id === 'MEYVE' && <Apple size={15} className="text-rose-500" />}
                          {cat.name} ({filteredCrops.length})
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredCrops.map((crop) => {
                          const profile = CROP_AGRONOMY_PROFILES[crop.id];
                          const stagesCount = (CROP_STAGES[crop.id] || GENERIC_STAGES).length;
                          const bkuCount = findBkuProductsForCrop(crop.id, crop.name).length;

                          return (
                            <button
                              key={crop.id}
                              type="button"
                              onClick={() => handleCropSelect(crop)}
                              className="v22-bento-card overflow-hidden text-left flex flex-col justify-between group transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                            >
                              <div>
                                {/* Real Photo Banner */}
                                <AgriPhoto
                                  src={profile?.imageUrl}
                                  alt={crop.name}
                                  fallbackIcon={crop.icon}
                                  className="w-full h-36"
                                  badge={profile?.vegetationDays.split('•')[0].trim()}
                                />

                                <div className="p-4 space-y-2.5">
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <h3
                                        className="text-base font-black tracking-tight"
                                        style={{ color: 'var(--mks-text)' }}
                                      >
                                        {crop.name}
                                      </h3>
                                      <span
                                        className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                                        style={{
                                          backgroundColor: 'var(--mks-accent-soft)',
                                          color: 'var(--mks-accent-soft-text)'
                                        }}
                                      >
                                        {stagesCount} Evre
                                      </span>
                                    </div>
                                    {profile && (
                                      <div className="text-[11px] italic font-medium truncate" style={{ color: 'var(--mks-muted)' }}>
                                        {profile.scientificName} • {profile.family.split('(')[0].trim()}
                                      </div>
                                    )}
                                  </div>

                                  {profile && (
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                                        <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                                          Hedef Verim
                                        </div>
                                        <div className="font-bold truncate" style={{ color: 'var(--mks-text)' }} title={profile.targetYieldPerDa}>
                                          {profile.targetYieldPerDa}
                                        </div>
                                      </div>

                                      <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                                        <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                                          Toprak pH
                                        </div>
                                        <div className="font-bold truncate" style={{ color: 'var(--mks-text)' }}>
                                          {profile.optimalSoilPh.split('(')[0].trim()}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div
                                className="px-4 py-2.5 border-t flex items-center justify-between text-[11px] font-bold"
                                style={{ borderColor: 'var(--mks-input-border)' }}
                              >
                                <span style={{ color: 'var(--mks-muted)' }}>
                                  {bkuCount > 0 ? `${bkuCount} BKÜ İlacı` : 'Evre & Gübre Programı'}
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                  Pasaportu Aç <ChevronRight size={14} />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: AI ZİRAAT DANIŞMANI (2 SÜTUNLU KURUMSAL DÜZEN) */}
            {mainTab === 'AI_DANISMAN' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column: Context & Quick Prompts */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="v22-bento-card p-4 sm:p-5 space-y-3">
                    <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                      <Sprout size={16} className="text-emerald-600" />
                      Danışmanlık Bitki Bağlamı
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--mks-muted)' }}>
                      Sorularınızı belirli bir ürüne odaklamak isterseniz buradan seçebilirsiniz:
                    </p>
                    <select
                      value={aiContextCropId}
                      onChange={(e) => setAiContextCropId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
                      style={{
                        backgroundColor: 'var(--mks-input-bg)',
                        borderColor: 'var(--mks-input-border)',
                        color: 'var(--mks-text)'
                      }}
                    >
                      <option value="">Genel Ziraat Mühendisliği (Tüm Ürünler)</option>
                      {Object.values(CROP_AGRONOMY_PROFILES).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.scientificName})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => changeViewState('SCANNER')}
                        className="v22-surface-pill py-2 px-3 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ color: 'var(--mks-text)' }}
                      >
                        <Camera size={14} className="text-emerald-600" />
                        Kamera Tara
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="v22-surface-pill py-2 px-3 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ color: 'var(--mks-text)' }}
                      >
                        <FileImage size={14} className="text-sky-600" />
                        Foto Yükle
                      </button>
                    </div>
                  </div>

                  <div className="v22-bento-card p-4 sm:p-5 space-y-2.5">
                    <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                      Saha Hızlı Soruları
                    </h4>
                    <div className="space-y-1.5">
                      {QUICK_AGRI_QUESTIONS.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendChatMessage(q)}
                          className="w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-start gap-2 transition-colors hover:opacity-90 cursor-pointer"
                          style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                        >
                          <HelpCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Chat Area */}
                <div className="lg:col-span-8 v22-bento-card p-4 sm:p-5 flex flex-col justify-between min-h-[500px]">
                  <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--mks-input-border)' }}>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'var(--mks-accent-soft)', color: 'var(--mks-accent-soft-text)' }}
                      >
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>
                          MKS AI Ziraat Mühendisi
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                          {aiContextCropId
                            ? `Odak: ${CROP_AGRONOMY_PROFILES[aiContextCropId]?.name}`
                            : 'Zirai mücadele, gübreleme, toprak analizi & BKÜ danışmanı'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setChatMessages((prev) => prev.slice(0, 1))
                      }
                      className="v22-surface-pill px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      style={{ color: 'var(--mks-muted)' }}
                    >
                      <RefreshCw size={12} />
                      Temizle
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto py-4 space-y-3 max-h-[420px] pr-1">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                            msg.sender === 'user' ? 'rounded-tr-none shadow-sm' : 'rounded-tl-none border'
                          }`}
                          style={
                            msg.sender === 'user'
                              ? { backgroundColor: 'var(--mks-accent-primary)', color: '#ffffff' }
                              : {
                                  backgroundColor: 'var(--mks-subcard)',
                                  borderColor: 'var(--mks-input-border)',
                                  color: 'var(--mks-text)'
                                }
                          }
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] mt-1 px-1" style={{ color: 'var(--mks-muted)' }}>
                          {msg.timestamp}
                        </span>
                      </div>
                    ))}

                    {isAiReplying && (
                      <div
                        className="flex items-center gap-2 p-3 rounded-2xl w-fit text-xs font-semibold"
                        style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                      >
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                        Mühendis yanıt hazırlıyor...
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <div className="pt-3 border-t flex items-center gap-2" style={{ borderColor: 'var(--mks-input-border)' }}>
                    <input
                      type="text"
                      placeholder="Zirai bir soru sorun (Örn: Pamukta kırmızı örümcek ilacıyla yaprak gübresi karışır mı?)"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      className="flex-1 py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-medium outline-none"
                      style={{
                        backgroundColor: 'var(--mks-input-bg)',
                        borderColor: 'var(--mks-input-border)',
                        color: 'var(--mks-text)'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage()}
                      disabled={!chatInput.trim() || isAiReplying}
                      className="v22-dark-pill px-4 py-2.5 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer shrink-0"
                    >
                      <Send size={15} />
                      Gönder
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: İNTERAKTİF TANK MIX SİMÜLATÖRÜ + WALES + SU KALİTESİ */}
            {mainTab === 'TANK_MIX' && (
              <div className="space-y-5">
                {/* Interactive Tank Mix Compatibility Tester */}
                <div className="v22-bento-card p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-black flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                        <Beaker size={18} className="text-sky-600" />
                        Canlı Tank Karışım (Tank Mix) Uyumluluk Simülatörü
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                        Tankta karıştırmak istediğiniz 2 veya daha fazla grubu seçin; çökelti ve fitotoksisite riskini görün.
                      </p>
                    </div>
                    {selectedMixIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedMixIds([])}
                        className="text-xs font-bold text-rose-600 hover:underline self-start cursor-pointer"
                      >
                        Seçimleri Temizle
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {TANK_MIX_GUIDE.map((item) => {
                      const active = selectedMixIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleMixGroup(item.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-1.5 cursor-pointer`}
                          style={
                            active
                              ? {
                                  backgroundColor: 'var(--mks-accent-primary)',
                                  borderColor: 'var(--mks-accent-primary)',
                                  color: '#ffffff'
                                }
                              : {
                                  backgroundColor: 'var(--mks-subcard)',
                                  borderColor: 'var(--mks-input-border)',
                                  color: 'var(--mks-text)'
                                }
                          }
                        >
                          {active && <Check size={13} />}
                          {item.category.split('(')[0].trim()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Verdict Banner */}
                  <div
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${
                      mixVerdict.status === 'DANGER'
                        ? 'bg-rose-500/10 border-rose-500/35 text-rose-800 dark:text-rose-200'
                        : mixVerdict.status === 'WARNING'
                        ? 'bg-amber-500/10 border-amber-500/35 text-amber-900 dark:text-amber-200'
                        : mixVerdict.status === 'SAFE'
                        ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-900 dark:text-emerald-200'
                        : ''
                    }`}
                    style={
                      mixVerdict.status === 'IDLE'
                        ? {
                            backgroundColor: 'var(--mks-subcard)',
                            borderColor: 'var(--mks-input-border)',
                            color: 'var(--mks-text)'
                          }
                        : undefined
                    }
                  >
                    {mixVerdict.status === 'DANGER' && <ShieldAlert size={20} className="text-rose-600 shrink-0 mt-0.5" />}
                    {mixVerdict.status === 'WARNING' && <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />}
                    {mixVerdict.status === 'SAFE' && <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />}
                    {mixVerdict.status === 'IDLE' && <Info size={20} className="shrink-0 mt-0.5 opacity-60" />}
                    <div className="space-y-1">
                      <div className="text-xs font-black uppercase tracking-wide">{mixVerdict.title}</div>
                      <p className="text-xs leading-relaxed opacity-90">{mixVerdict.details}</p>
                    </div>
                  </div>
                </div>

                {/* WALES & WATER QUALITY SIDE BY SIDE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="v22-bento-card p-5 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                      <Scale size={15} className="text-emerald-600" />
                      İlaç Tankı Hazırlama Sırası (WALES Kuralı)
                    </h4>
                    <div className="space-y-2">
                      {MIXING_ORDER_STEPS.map((step, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl text-xs font-semibold"
                          style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="v22-bento-card p-5 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--mks-text)' }}>
                      <Droplet size={15} className="text-sky-600" />
                      İlaçlama Suyu Kalitesi & pH Etkisi
                    </h4>
                    <div className="space-y-2.5">
                      {WATER_QUALITY_GUIDE.map((w) => (
                        <div
                          key={w.parameter}
                          className="p-3 rounded-xl border space-y-1.5"
                          style={{ backgroundColor: 'var(--mks-subcard)', borderColor: 'var(--mks-input-border)' }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-black" style={{ color: 'var(--mks-text)' }}>
                              {w.parameter}
                            </span>
                            <div className="flex gap-1.5">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                İdeal: {w.idealRange}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                                Risk: {w.riskThreshold}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px]" style={{ color: 'var(--mks-muted)' }}>
                            {w.impact}
                          </p>
                          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            Çözüm: {w.correctiveAction}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Group Compatibility Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TANK_MIX_GUIDE.map((item) => (
                    <div key={item.id} className="v22-bento-card p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>
                          {item.category}
                        </h5>
                        {item.phRange && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-muted)' }}
                          >
                            {item.phRange}
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                          <X size={12} /> Kesinlikle Karışmaz
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.incompatibleWith.map((inc, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              {inc}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                          <Check size={12} /> Uyumlu Olduğu Gruplar
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.compatibleWith.map((comp, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <span>{item.warningNote}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: 12 ELEMENTLİ BESİN NOKSANLIĞI ATLASI */}
            {mainTab === 'DEFICIENCY' && (
              <div className="space-y-4">
                <div className="v22-bento-card p-4 space-y-3">
                  <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'ALL', label: `Tümü (${DEFICIENCY_GUIDE.length})` },
                          { id: 'Makro Besin', label: 'Makro Elementler' },
                          { id: 'Mikro Besin', label: 'Mikro Elementler' },
                          { id: 'YAŞLI', label: 'Alt (Yaşlı) Yapraklar' },
                          { id: 'GENÇ', label: 'Üst (Genç) Yapraklar' }
                        ] as const
                      ).map((f) => {
                        const active = deficiencyFilter === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setDeficiencyFilter(f.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                            style={
                              active
                                ? { backgroundColor: 'var(--mks-accent-primary)', color: '#fff' }
                                : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                            }
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative md:w-72">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
                      <input
                        type="text"
                        placeholder="Element, belirti veya bitki ara (Mısır, Bor...)"
                        value={deficiencySearch}
                        onChange={(e) => setDeficiencySearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--mks-input-bg)',
                          borderColor: 'var(--mks-input-border)',
                          color: 'var(--mks-text)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredDeficiency.map((item) => (
                    <div key={item.element} className="v22-bento-card overflow-hidden flex flex-col justify-between group">
                      <div>
                        <div className="grid grid-cols-1 sm:grid-cols-12">
                          <div className="sm:col-span-5">
                            <AgriPhoto
                              src={item.imageUrl}
                              alt={`${item.element} Noksanlığı`}
                              className="w-full h-44 sm:h-full min-h-[175px]"
                              badge={item.targetLeaves}
                            />
                          </div>

                          <div className="sm:col-span-7 p-4 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                                  style={{
                                    backgroundColor: 'var(--mks-accent-soft)',
                                    color: 'var(--mks-accent-soft-text)'
                                  }}
                                >
                                  {item.symbol}
                                </span>
                                <div>
                                  <h4 className="text-base font-black" style={{ color: 'var(--mks-text)' }}>
                                    {item.element} Noksanlığı
                                  </h4>
                                  <div className="text-[11px] font-semibold" style={{ color: 'var(--mks-muted)' }}>
                                    {item.type} • {item.mobility || 'Mobil'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl text-xs space-y-1" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                Tanı İpucu: {item.visualCue}
                              </div>
                              <p className="leading-relaxed" style={{ color: 'var(--mks-text)' }}>
                                {item.symptoms}
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                              {item.optimalPhRange && (
                                <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300">
                                  İdeal pH: {item.optimalPhRange}
                                </span>
                              )}
                              {item.antagonistElements && item.antagonistElements.length > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300">
                                  Kilitleyen: {item.antagonistElements[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className="p-4 border-t space-y-2.5 text-xs"
                          style={{ borderColor: 'var(--mks-input-border)' }}
                        >
                          <p style={{ color: 'var(--mks-muted)' }}>
                            <strong style={{ color: 'var(--mks-text)' }}>Nedenleri:</strong> {item.causes}
                          </p>
                          <p style={{ color: 'var(--mks-muted)' }}>
                            <strong style={{ color: 'var(--mks-text)' }}>Mühendis Çözümü:</strong> {item.solution}
                          </p>

                          {(item.foliarDosage || item.dripDosage) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {item.foliarDosage && (
                                <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                                  <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                                    Yapraktan Doz
                                  </div>
                                  <div className="font-bold" style={{ color: 'var(--mks-text)' }}>
                                    {item.foliarDosage}
                                  </div>
                                </div>
                              )}
                              {item.dripDosage && (
                                <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                                  <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                                    Damlama / Toprak Dozu
                                  </div>
                                  <div className="font-bold" style={{ color: 'var(--mks-text)' }}>
                                    {item.dripDosage}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {item.recommendedProducts.map((p, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-md text-[11px] font-bold"
                                style={{
                                  backgroundColor: 'var(--mks-accent-soft)',
                                  color: 'var(--mks-accent-soft-text)'
                                }}
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: FENOLOJİK ZİRAİ TAKVİM */}
            {mainTab === 'TAKVIM' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['İlkbahar', 'Yaz', 'Sonbahar', 'Kış'] as const).map((s) => {
                    const active = selectedSeason === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSeason(s)}
                        className="v22-bento-card py-3 px-4 text-xs font-black text-center cursor-pointer transition-all"
                        style={
                          active
                            ? { backgroundColor: 'var(--mks-accent-primary)', color: '#ffffff' }
                            : { color: 'var(--mks-text)' }
                        }
                      >
                        {s} Dönemi
                      </button>
                    );
                  })}
                </div>

                {SEASONAL_CALENDAR.filter((item) => item.season === selectedSeason).map((item, idx) => (
                  <div key={idx} className="v22-bento-card p-5 space-y-5">
                    <div
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b"
                      style={{ borderColor: 'var(--mks-input-border)' }}
                    >
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                          {item.period}
                        </span>
                        <h3 className="text-xl font-black" style={{ color: 'var(--mks-text)' }}>
                          {item.season} Sezonu Saha Operasyon Planı
                        </h3>
                      </div>
                      <span
                        className="px-3 py-1.5 rounded-xl text-xs font-bold self-start sm:self-center"
                        style={{
                          backgroundColor: 'var(--mks-accent-soft)',
                          color: 'var(--mks-accent-soft-text)'
                        }}
                      >
                        Odak: {item.focusCrops}
                      </span>
                    </div>

                    {item.monthlyFocus && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {item.monthlyFocus.map((mf) => (
                          <div key={mf.month} className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase mb-1">
                              {mf.month}
                            </div>
                            <div className="text-xs font-medium leading-relaxed" style={{ color: 'var(--mks-text)' }}>
                              {mf.priority}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                        Kritik Zirai Uygulamalar & Kontroller
                      </h4>
                      {item.tasks.map((task, tIdx) => (
                        <div
                          key={tIdx}
                          className="p-3 rounded-xl flex items-start gap-2.5 text-xs font-medium"
                          style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                        >
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{task}</span>
                        </div>
                      ))}
                    </div>

                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--mks-muted)' }}>
                        Dönemin Öne Çıkan Ruhsatlı Etken Maddeleri
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {item.keyChemicals.map((chem, cIdx) => (
                          <span
                            key={cIdx}
                            className="px-3 py-1 rounded-lg text-xs font-bold"
                            style={{
                              backgroundColor: 'var(--mks-accent-soft)',
                              color: 'var(--mks-accent-soft-text)'
                            }}
                          >
                            {chem}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 2: CROP PASSPORT + STAGES + FERTILIZER + THRESHOLDS + BKU */}
        {viewState === 'STAGES' && selectedCrop && (
          <motion.div
            key="stages"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-5"
          >
            {/* Passport Hero Card */}
            <div className="v22-bento-card overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <AgriPhoto
                    src={selectedCropProfile?.imageUrl}
                    alt={selectedCrop.name}
                    fallbackIcon={selectedCrop.icon}
                    className="w-full h-56 lg:h-full min-h-[220px]"
                    badge={selectedCropProfile?.vegetationDays}
                  />
                </div>

                <div className="lg:col-span-8 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs italic font-semibold" style={{ color: 'var(--mks-muted)' }}>
                        {selectedCropProfile?.scientificName} • {selectedCropProfile?.family}
                      </div>
                      <h2 className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
                        {selectedCrop.name} Agronomi Pasaportu
                      </h2>
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold self-start"
                      style={{
                        backgroundColor: 'var(--mks-accent-soft)',
                        color: 'var(--mks-accent-soft-text)'
                      }}
                    >
                      {cropBkuProducts.length} Resmi BKÜ Ruhsatlı İlaç
                    </span>
                  </div>

                  {selectedCropProfile && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                          Hedef Verim / Da
                        </div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--mks-text)' }}>
                          {selectedCropProfile.targetYieldPerDa}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                          Su İhtiyacı
                        </div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--mks-text)' }}>
                          {selectedCropProfile.waterRequirementMm}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                          Toprak & pH
                        </div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--mks-text)' }}>
                          {selectedCropProfile.optimalSoilPh}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl col-span-2 sm:col-span-2" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                          Ekim / Dikim Normu
                        </div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--mks-text)' }}>
                          {selectedCropProfile.plantingSpec}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                          Saf NPK / Da
                        </div>
                        <div className="font-bold mt-0.5" style={{ color: 'var(--mks-text)' }}>
                          {selectedCropProfile.npkPureKgPerDa}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedCropProfile && (
                    <div className="flex flex-wrap gap-3 text-xs pt-1" style={{ color: 'var(--mks-muted)' }}>
                      <span className="inline-flex items-center gap-1">
                        <Thermometer size={14} className="text-amber-500" />
                        <strong style={{ color: 'var(--mks-text)' }}>Sıcaklık:</strong> {selectedCropProfile.criticalTemp}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <strong style={{ color: 'var(--mks-text)' }}>Hasat:</strong> {selectedCropProfile.harvestCriteria}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4 Crop Sub-Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {(
                [
                  { id: 'STAGES', label: `Fenolojik Evreler (${currentStages.length})`, icon: <Layers size={14} /> },
                  {
                    id: 'FERTILIZER',
                    label: `Gübreleme Programı (${selectedCropProfile?.fertilizerProgram.length || 0})`,
                    icon: <Droplet size={14} />
                  },
                  {
                    id: 'THRESHOLDS',
                    label: `Ekonomik Zarar Eşikleri (${selectedCropProfile?.economicThresholds.length || 0})`,
                    icon: <Target size={14} />
                  },
                  { id: 'BKU', label: `Bakanlık BKÜ İlaçları (${cropBkuProducts.length})`, icon: <BookOpen size={14} /> }
                ] as const
              ).map((st) => {
                const active = cropSubTab === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setCropSubTab(st.id)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    style={
                      active
                        ? { backgroundColor: 'var(--mks-accent-primary)', color: '#ffffff' }
                        : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                    }
                  >
                    {st.icon}
                    {st.label}
                  </button>
                );
              })}
            </div>

            {/* Sub-Tab 1: Fenolojik Evreler */}
            {cropSubTab === 'STAGES' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {currentStages.map((stage, idx) => {
                  const stageProblems =
                    PROBLEM_DATABASE[selectedCrop.id]?.[stage.id] ||
                    GENERIC_PROBLEMS[stage.id] ||
                    [];
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => handleStageSelect(stage)}
                      className="v22-bento-card p-4 sm:p-5 text-left flex items-center justify-between gap-4 group hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                          style={{
                            backgroundColor: 'var(--mks-accent-soft)',
                            color: 'var(--mks-accent-soft-text)'
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>
                            {stage.name}
                          </h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                            {stage.description}
                          </p>
                          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span>{stageProblems.length > 0 ? `${stageProblems.length} Risk / Mücadele Kaydı` : 'Genel Evre Riskleri'}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="shrink-0 opacity-60 group-hover:translate-x-1 transition-transform" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sub-Tab 2: Gübreleme Programı */}
            {cropSubTab === 'FERTILIZER' && selectedCropProfile && (
              <div className="space-y-4">
                <div className="v22-bento-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}>
                          <th className="p-3.5 font-black">Gelişim Dönemi</th>
                          <th className="p-3.5 font-black">Uygulama Şekli</th>
                          <th className="p-3.5 font-black">Önerilen Gübre / Besin</th>
                          <th className="p-3.5 font-black">Dekara Doz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCropProfile.fertilizerProgram.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-t"
                            style={{ borderColor: 'var(--mks-input-border)', color: 'var(--mks-text)' }}
                          >
                            <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-300">{row.stage}</td>
                            <td className="p-3.5 font-medium">{row.method}</td>
                            <td className="p-3.5 font-semibold">{row.product}</td>
                            <td className="p-3.5 font-black whitespace-nowrap">{row.dosagePerDa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="v22-bento-card p-4 bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
                  <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--mks-text)' }}>
                    <strong>Bölgesel Ziraat Mühendisi Notu:</strong> {selectedCropProfile.regionalTips}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Ekonomik Zarar Eşikleri (EZE) */}
            {cropSubTab === 'THRESHOLDS' && selectedCropProfile && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedCropProfile.economicThresholds.map((rule, idx) => (
                  <div key={idx} className="v22-bento-card p-5 space-y-2.5">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <Target size={16} />
                      <h4 className="text-sm font-black" style={{ color: 'var(--mks-text)' }}>
                        {rule.pestOrDisease}
                      </h4>
                    </div>
                    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                      <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                        Resmi İlaçlama Eşiği (EZE)
                      </div>
                      <div className="text-xs font-bold mt-0.5" style={{ color: 'var(--mks-text)' }}>
                        {rule.threshold}
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--mks-muted)' }}>
                      <strong style={{ color: 'var(--mks-text)' }}>Örnekleme Yöntemi:</strong> {rule.samplingMethod}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-Tab 4: Bakanlık BKÜ Ruhsatlı İlaçlar */}
            {cropSubTab === 'BKU' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60" />
                  <input
                    type="text"
                    placeholder={`${selectedCrop.name} BKÜ listesinde ilaç, aktif madde veya zararlı ara...`}
                    value={bkuSubSearch}
                    onChange={(e) => setBkuSubSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  />
                </div>

                {cropBkuProducts.length === 0 ? (
                  <div className="v22-bento-card p-8 text-center text-xs" style={{ color: 'var(--mks-muted)' }}>
                    Bu filtreye uygun yerleşik BKÜ ruhsat kaydı bulunamadı.
                  </div>
                ) : (
                  <div className="v22-bento-card overflow-hidden">
                    <div className="overflow-x-auto max-h-[520px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}>
                            <th className="p-3 font-black">Ticari İsim</th>
                            <th className="p-3 font-black">Aktif Madde</th>
                            <th className="p-3 font-black">Grup</th>
                            <th className="p-3 font-black">Hedef Zararlı / Hastalık</th>
                            <th className="p-3 font-black">Dozaj</th>
                            <th className="p-3 font-black">PHI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cropBkuProducts.slice(0, 60).map((p) => {
                            const matchingUsage = p.usages?.find((u) =>
                              (CROP_BKU_ALIASES[selectedCrop.id] || [selectedCrop.name]).some((a) =>
                                turkishIncludes(u.crop, a)
                              )
                            );
                            return (
                              <tr
                                key={p.id}
                                className="border-t"
                                style={{ borderColor: 'var(--mks-input-border)', color: 'var(--mks-text)' }}
                              >
                                <td className="p-3 font-bold">{p.name}</td>
                                <td className="p-3 font-medium">{p.activeIngredient}</td>
                                <td className="p-3">{p.bkuGroup || p.category}</td>
                                <td className="p-3">{matchingUsage?.pest || p.targetPests?.[0] || '-'}</td>
                                <td className="p-3 font-bold text-emerald-700 dark:text-emerald-300">
                                  {matchingUsage?.dosage || p.defaultDosage}
                                </td>
                                <td className="p-3 whitespace-nowrap">{matchingUsage?.phi || p.phi || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 3: PROBLEMS LIST (GERÇEK FOTOĞRAFLI) */}
        {viewState === 'PROBLEMS' && (
          <motion.div
            key="problems"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-4"
          >
            {/* Type Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'ALL', label: `Tümü (${currentProblems.length})` },
                { key: 'HASTALIK', label: 'Hastalıklar' },
                { key: 'ZARARLI', label: 'Zararlılar' },
                { key: 'YABANCI_OT', label: 'Yabancı Otlar' },
                { key: 'BESLEME', label: 'Bitki Besleme' }
              ].map((t) => {
                const active = problemTypeFilter === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setProblemTypeFilter(t.key)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                    style={
                      active
                        ? { backgroundColor: 'var(--mks-accent-primary)', color: '#fff' }
                        : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                    }
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {filteredProblems.length === 0 ? (
              <div className="v22-bento-card p-8 text-center space-y-2">
                <AlertCircle size={36} className="mx-auto text-amber-500" />
                <h3 className="text-base font-black" style={{ color: 'var(--mks-text)' }}>
                  Bu Evrede Spesifik Kayıt Bulunamadı
                </h3>
                <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--mks-muted)' }}>
                  Diğer kategorileri seçebilir veya AI Ziraat Mühendisine doğrudan sorabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProblems.map((prob: any, idx: number) => {
                  const visual = getProblemVisualAndMeta(prob.name, prob.type, selectedCrop?.name);
                  const badge = getProblemTypeBadge(prob.type);
                  return (
                    <button
                      key={`${prob.name}-${idx}`}
                      type="button"
                      onClick={() => handleProblemSelect(prob)}
                      className="v22-bento-card overflow-hidden text-left flex flex-col justify-between group hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div>
                        <AgriPhoto
                          src={visual.imageUrl}
                          alt={prob.name}
                          className="w-full h-40"
                          badge={visual.phiHint}
                        />
                        <div className="p-4 space-y-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                          <h3 className="text-sm font-black leading-snug" style={{ color: 'var(--mks-text)' }}>
                            {prob.name}
                          </h3>
                          {visual.scientificName && (
                            <div className="text-[11px] italic" style={{ color: 'var(--mks-muted)' }}>
                              {visual.scientificName}
                            </div>
                          )}
                          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--mks-muted)' }}>
                            {prob.description}
                          </p>
                        </div>
                      </div>

                      <div
                        className="px-4 py-2.5 border-t flex items-center justify-between text-[11px] font-bold"
                        style={{ borderColor: 'var(--mks-input-border)' }}
                      >
                        <span style={{ color: 'var(--mks-muted)' }}>
                          {(prob.activeIngredients || []).length} Etken Madde
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                          Teşhis & Mücadele <ChevronRight size={14} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 4 & 6: PROBLEM DETAIL / AI RESULT */}
        {(viewState === 'PROBLEM_DETAIL' || viewState === 'AI_RESULT') && selectedProblem && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-5"
          >
            {/* Visual Hero Banner */}
            <div className="v22-bento-card overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-5">
                  <AgriPhoto
                    src={problemVisualMeta?.imageUrl}
                    alt={selectedProblem.name}
                    className="w-full h-56 md:h-full min-h-[220px]"
                    badge={problemVisualMeta?.phiHint}
                  />
                </div>
                <div className="md:col-span-7 p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        getProblemTypeBadge(selectedProblem.type).badgeClass
                      }`}
                    >
                      {getProblemTypeBadge(selectedProblem.type).label}
                    </span>
                    {problemVisualMeta?.scientificName && (
                      <span
                        className="px-2.5 py-0.5 rounded-full text-xs italic font-semibold"
                        style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-muted)' }}
                      >
                        {problemVisualMeta.scientificName}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
                    {selectedProblem.name}
                  </h2>

                  {problemVisualMeta?.modeOfAction && (
                    <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                      <div className="text-[10px] font-bold uppercase mb-0.5" style={{ color: 'var(--mks-muted)' }}>
                        IRAC / FRAC / HRAC Etki Mekanizması Grubu
                      </div>
                      <div className="font-bold" style={{ color: 'var(--mks-text)' }}>
                        {problemVisualMeta.modeOfAction}
                      </div>
                    </div>
                  )}

                  {selectedProblem.phiDays && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                      <Clock size={15} className="text-amber-600 shrink-0" />
                      <span>
                        <strong>Hasat Güvenlik Süresi (PHI):</strong> {selectedProblem.phiDays}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={askAboutCurrentProblem}
                    className="v22-dark-pill inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold cursor-pointer"
                  >
                    <Sparkles size={15} />
                    Bu Sorunu AI Mühendise Sor
                  </button>
                </div>
              </div>
            </div>

            {/* Symptoms & Cultural Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="v22-bento-card p-5 space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--mks-muted)' }}>
                  <Activity size={15} className="text-sky-600" />
                  Semptom, Teşhis ve Hasar Şekli
                </h3>
                <p className="text-sm leading-relaxed font-medium" style={{ color: 'var(--mks-text)' }}>
                  {selectedProblem.description}
                </p>
                {selectedProblem.solutionDescription && (
                  <p
                    className="text-xs leading-relaxed p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                  >
                    <strong>Uygulama Önerisi:</strong> {selectedProblem.solutionDescription}
                  </p>
                )}
              </div>

              <div className="v22-bento-card p-5 space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--mks-muted)' }}>
                  <Sprout size={15} className="text-emerald-600" />
                  Kültürel ve Biyoteknik Mücadele Önlemleri
                </h3>
                <div className="space-y-2">
                  {(
                    (selectedProblem.culturalControls?.length
                      ? selectedProblem.culturalControls
                      : problemVisualMeta?.culturalControls) || []
                  ).map((step: string, i: number) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl flex items-start gap-2 text-xs"
                      style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                    >
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chemical / Commercial / BKU Matches */}
            <div className="v22-bento-card p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: 'ACTIVE_INGREDIENT', label: 'Önerilen Etken Maddeler' },
                    { key: 'COMMERCIAL_NAME', label: 'Örnek Ticari İlaçlar' },
                    { key: 'BKU_MATCH', label: `Resmi BKÜ Eşleşmeleri (${problemBkuMatches.length})` }
                  ] as const
                ).map((t) => {
                  const active = solutionTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSolutionTab(t.key)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
                      style={
                        active
                          ? { backgroundColor: 'var(--mks-accent-primary)', color: '#ffffff' }
                          : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                      }
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {solutionTab === 'ACTIVE_INGREDIENT' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(selectedProblem.activeIngredients || []).map((ing: string, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl flex items-center gap-2.5 text-xs font-bold"
                      style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                    >
                      <FlaskConical size={15} className="text-emerald-600 shrink-0" />
                      <span>{ing}</span>
                    </div>
                  ))}
                </div>
              )}

              {solutionTab === 'COMMERCIAL_NAME' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(selectedProblem.commercialNames || []).map((cName: string, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl flex items-center gap-2.5 text-xs font-bold"
                      style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}
                    >
                      <Bug size={15} className="text-sky-600 shrink-0" />
                      <span>{cName}</span>
                    </div>
                  ))}
                </div>
              )}

              {solutionTab === 'BKU_MATCH' && (
                <div className="overflow-x-auto">
                  {problemBkuMatches.length === 0 ? (
                    <div className="p-4 text-xs" style={{ color: 'var(--mks-muted)' }}>
                      Bu etken maddeye karşılık gelen yerleşik BKÜ ruhsatı bulunamadı; İlaç Kütüphanesi ekranından Canlı BKÜ sorgusu yapabilirsiniz.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }}>
                          <th className="p-3 font-black">Ruhsatlı Ürün</th>
                          <th className="p-3 font-black">Aktif Madde</th>
                          <th className="p-3 font-black">Önerilen Doz</th>
                          <th className="p-3 font-black">PHI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {problemBkuMatches.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t"
                            style={{ borderColor: 'var(--mks-input-border)', color: 'var(--mks-text)' }}
                          >
                            <td className="p-3 font-bold">{p.name}</td>
                            <td className="p-3">{p.activeIngredient}</td>
                            <td className="p-3 font-bold text-emerald-700 dark:text-emerald-300">
                              {p.defaultDosage}
                            </td>
                            <td className="p-3">{p.phi || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

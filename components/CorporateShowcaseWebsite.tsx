import React, { useState, useEffect, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion
} from 'motion/react';
import {
  Users,
  ScanBarcode,
  FileCheck2,
  Smartphone,
  Monitor,
  Apple,
  Download,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  Bell,
  ShieldCheck,
  Headphones,
  LogIn,
  UserPlus,
  Wheat,
  Receipt,
  Sparkles,
  MapPin,
  CalendarCheck2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Layers,
  BarChart3,
  type LucideIcon
} from 'lucide-react';
import { MksBrandLogo } from './MksBrandLogo';

export interface CorporateShowcaseProps {
  onOpenAuthModal: (mode: 'LOGIN' | 'REGISTER') => void;
  onOpenPortalTab: (tab: 'overview' | 'download' | 'pricing' | 'ios_guide') => void;
  onOpenSupport: () => void;
}

type HeroStageTab = 'studio' | 'sales5' | 'cari' | 'resmi' | 'harita' | 'ai';
type SatelliteSubLayer = 'NDVI' | 'NDMI' | 'SWIR';

interface HeroTabSpec {
  id: HeroStageTab;
  label: string;
  shortLabel: string;
  headline: string;
  caption: string;
  icon: LucideIcon;
}

const HERO_STAGE_TABS: HeroTabSpec[] = [
  {
    id: 'studio',
    label: 'MKS Stüdyo Vitrin',
    shortLabel: 'Vitrin',
    headline: 'Masaüstü, Mobil ve Barkod Okuyucu Tek Kurumsal Ekosistemde',
    caption: 'Telefon ve masaüstü bilgisayarınız arasında anlık bulut + çevrimdışı senkronizasyon.',
    icon: Monitor
  },
  {
    id: 'sales5',
    label: '5 Adımda Fatura & Satış',
    shortLabel: '5 Adım Satış',
    headline: 'Önce Çiftçi, Sonra Ekili Ürün, İlaçlar, Fiyat ve Onay',
    caption: 'Karmaşık resmi kodlardan arındırılmış kompakt depo & cari satış sihirbazı.',
    icon: Receipt
  },
  {
    id: 'cari',
    label: 'Çiftçi Cari & Devir',
    shortLabel: 'Çiftçi Cari',
    headline: 'Veresiye, Parçalı Tahsilat, POS Bloke ve Yıllık Devir',
    caption: 'WhatsApp şifresiz üretici portalı ve kaşeli çok sayfalı yıl sonu PDF bilançosu.',
    icon: Users
  },
  {
    id: 'resmi',
    label: 'Resmi Servisler',
    shortLabel: 'GTS / BKTS',
    headline: 'GTS, BKTS, B-Reçete ve EDM e-Fatura Kendi Özel Alanında',
    caption: 'GS1 2D karekod ayrıştırma ve GİB zarflama işlemleri ana satış akışını yormaz.',
    icon: ScanBarcode
  },
  {
    id: 'harita',
    label: 'TKGM Parsel & Uydu',
    shortLabel: 'TKGM Harita',
    headline: 'Ada/Parsel Sorgu, Kalıcı Tarla Sahibi Etiketi ve Uydu Katmanı',
    caption: 'Çiftçiye bağlanan parseller haritadan kaybolmaz; yakınlaştırmada harita bozulmaz.',
    icon: MapPin
  },
  {
    id: 'ai',
    label: 'MKS Yapay Zeka',
    shortLabel: 'MKS AI',
    headline: 'Canlı Depo, Cari ve Ziraat Mühendisi AI Copilot',
    caption: 'Depo stoklarınız ve BKU veritabanıyla konuşan görsel bitki teşhis asistanı.',
    icon: Sparkles
  }
];

interface GallerySlide {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  image?: string;
  highlights: string[];
  accent: string;
}

const GALLERY_SLIDES: GallerySlide[] = [
  {
    id: 'komuta',
    tag: 'MKS KURUMSAL v8.2 • ANA KOMUTA',
    title: 'Tüm bayilik operasyonu tek bakışta net.',
    subtitle: 'Açık alacaklar, kasa-banka mutabakatı, kritik depo kalemleri ve günlük saha planı.',
    image: '/showcase/apple-hero-devices.png',
    highlights: ['Canlı kasa & alacak dengesi', 'Market barkod tabancası uyumlu', 'İnternetsiz köy ve depoda kesintisiz'],
    accent: 'text-emerald-400'
  },
  {
    id: 'fatura5',
    tag: 'KOMPAKT SATIŞ SİHİRBAZI',
    title: '5 adımda hatasız satış ve iade faturası.',
    subtitle: 'Çiftçi seç → Ekili ürün → İlaç & gübre → Fiyat & adet → Önizle ve onayla.',
    highlights: ['Tek dokunuşta çiftçi kilidi yok', 'Otomatik depo stok düşümü', 'Nakit, vadeli veya parçalı tahsilat'],
    accent: 'text-sky-400'
  },
  {
    id: 'depo',
    tag: 'DEPO, BARKOD & STOK ONARIM',
    title: 'GS1 2D karekod ve onaylı stok sayımı.',
    subtitle: 'GTIN, parti no ve SKT ayrıştırma; mükerrer kart birleştirme ve sayım farkı mutabakatı.',
    image: '/showcase/apple-tile-pos-warehouse.png',
    highlights: ['FEFO öncelikli SKT takibi', 'Stok & Depo Senkronizasyon Merkezi', 'Alış faturasından otomatik stok girişi'],
    accent: 'text-amber-300'
  },
  {
    id: 'harita',
    tag: 'SAHA HARİTASI & UYDU',
    title: 'TKGM ada/parsel ve çiftçi tarla etiketleri.',
    subtitle: 'Çiftçi adına kaydedilen parseller haritada adıyla kalıcı görünür; NDVI/NDMI analizine hazırdır.',
    image: '/showcase/apple-tile-field-ipad.png',
    highlights: ['Ada / parsel / dekar otomatik okuma', 'Uydu yakınlaştırma koruması', 'NDVI • Sulama (NDMI) • Tav (SWIR)'],
    accent: 'text-emerald-300'
  },
  {
    id: 'muhendisim',
    tag: 'MKS MÜHENDİSİM & BKU KÜTÜPHANESİ',
    title: 'TARGEM/BKU ruhsatlı ilaç kütüphanesi & yapay zeka.',
    subtitle: 'Ticari isim, aktif madde, hedef zararlı ve gerçek hastalık görselleriyle anlık teşhis.',
    image: '/showcase/apple-tile-ai-muhendisim.png',
    highlights: ['Etken madde muadil radarı', 'Görsel yaprak hastalık analizi', 'Depo & cariyle entegre AI asistan'],
    accent: 'text-teal-300'
  }
];

const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const CorporateShowcaseWebsite: React.FC<CorporateShowcaseProps> = ({
  onOpenAuthModal,
  onOpenPortalTab,
  onOpenSupport
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [heroTab, setHeroTab] = useState<HeroStageTab>('studio');
  const [wizardStep, setWizardStep] = useState<number>(3);
  const [satLayer, setSatLayer] = useState<SatelliteSubLayer>('NDVI');
  const [galleryIdx, setGalleryIdx] = useState<number>(0);
  const [isGalleryPaused, setIsGalleryPaused] = useState<boolean>(false);

  const heroStageRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroStageRef,
    offset: ['start end', 'center center']
  });
  const stageScale = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [1, 1] : [0.97, 1]);
  const stageOpacity = useTransform(scrollYProgress, [0, 0.35], [0.9, 1]);

  useEffect(() => {
    if (isGalleryPaused || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      setGalleryIdx(prev => (prev + 1) % GALLERY_SLIDES.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [isGalleryPaused, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const subId = window.setInterval(() => {
      setSatLayer(prev => (prev === 'NDVI' ? 'NDMI' : prev === 'NDMI' ? 'SWIR' : 'NDVI'));
    }, 2600);
    return () => window.clearInterval(subId);
  }, [prefersReducedMotion]);

  const activeHeroSpec = HERO_STAGE_TABS.find(t => t.id === heroTab) || HERO_STAGE_TABS[0];
  const currentSlide = GALLERY_SLIDES[galleryIdx] || GALLERY_SLIDES[0];

  const appleFontStyle: React.CSSProperties = {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif'
  };

  const renderHeroInteractiveOverlay = () => {
    if (heroTab === 'studio') {
      return (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[22px] sm:rounded-[28px] bg-[#000000] border border-white/10 shadow-[0_32px_100px_rgba(0,0,0,0.85)]">
          <img
            src="/showcase/apple-hero-devices.png"
            onError={e => {
              (e.currentTarget as HTMLImageElement).src = '/showcase/corporate-agtech-hero.jpg';
            }}
            alt="Mühendis Kayıt Sistemi MacBook Pro, iPhone ve 2D Barkod Okuyucu Stüdyo Görünümü"
            className="w-full h-full object-cover"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          <div className="absolute bottom-3.5 left-4 right-4 sm:bottom-5 sm:left-6 sm:right-6 flex flex-wrap items-center justify-between gap-2 text-left">
            <div className="px-3.5 py-2 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/15">
              <div className="text-[11px] font-semibold text-emerald-400">
                Windows • macOS / Web • iOS • Android
              </div>
              <div className="text-xs sm:text-sm font-medium text-white">
                {activeHeroSpec.headline}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHeroTab('sales5')}
              className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl border border-white/20 text-xs font-medium text-white transition-colors inline-flex items-center gap-1.5"
            >
              <span>Canlı Ekranları İncele</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="aspect-[16/9] min-h-[340px] w-full overflow-hidden rounded-[22px] sm:rounded-[28px] bg-[#0D1117] border border-white/15 shadow-[0_32px_100px_rgba(0,0,0,0.85)] flex flex-col">
        {/* Window Chrome */}
        <div className="h-10 px-4 bg-[#161B22] border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
          </div>
          <span className="text-[11px] text-white/75 font-medium truncate">
            MKS Kurumsal v8.2 — {activeHeroSpec.label}
          </span>
          <button
            type="button"
            onClick={() => setHeroTab('studio')}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium shrink-0"
          >
            Stüdyo Fotoğrafı
          </button>
        </div>

        {/* Mock Content per Tab */}
        <div className="flex-1 p-4 sm:p-7 flex flex-col justify-between text-left bg-gradient-to-b from-[#0D1117] to-[#080B0F] overflow-y-auto">
          {heroTab === 'sales5' && (
            <div className="space-y-4 my-auto">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-emerald-400">Kompakt Fatura Defteri Akışı</div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white">5 Adımda Kusursuz Satış & İade</h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                  BKTS / B-Reçete Karmaşasından Arındırılmış
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[
                  { step: '1. Çiftçi', val: 'Ahmet Yılmaz', sub: 'Tek dokunuşla seçilir' },
                  { step: '2. Ekili Ürün', val: 'Pamuk • 184 Da', sub: 'Tarla & sezon seçimi' },
                  { step: '3. İlaç & Gübre', val: '3 Kalem Sepette', sub: 'Barkod veya liste' },
                  { step: '4. Fiyat & Adet', val: '₺34.850,00', sub: 'Peşin / Vadeli seçim' },
                  { step: '5. Önizleme', val: 'Onayla & Düş', sub: 'Depo + Cari işlenir' }
                ].map((s, idx) => (
                  <div
                    key={s.step}
                    className={`p-3 rounded-2xl border ${
                      idx === 4
                        ? 'bg-emerald-500/15 border-emerald-500/40'
                        : 'bg-white/[0.03] border-white/[0.08]'
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-emerald-400">{s.step}</div>
                    <div className="text-xs sm:text-sm font-semibold text-white mt-1 truncate">{s.val}</div>
                    <div className="text-[10px] text-white/60 mt-0.5 truncate">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {heroTab === 'cari' && (
            <div className="space-y-4 my-auto">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: 'Aktif Alacak', v: '₺1.842.500', c: 'text-white' },
                  { k: 'Tahsilat (Nakit/POS/Çek)', v: '₺615.000', c: 'text-emerald-400' },
                  { k: 'Yıl Sonu Devri', v: 'Tam Mutabık', c: 'text-amber-300' }
                ].map(item => (
                  <div key={item.k} className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                    <div className="text-[11px] text-white/60 truncate">{item.k}</div>
                    <div className={`text-sm sm:text-xl font-semibold mt-1 tabular-nums ${item.c}`}>{item.v}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Ahmet Yılmaz • Salça Köyü</div>
                    <div className="text-[11px] text-white/60">WhatsApp Şifresiz Ekstre Linki • 25 Kasım Vade</div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 tabular-nums">₺128.400</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">Mehmet Kaya • Akçakale</div>
                    <div className="text-[11px] text-white/60">Nakit + 30 Gün POS Bloke Parçalı Tahsilat</div>
                  </div>
                  <span className="text-sm font-semibold text-white tabular-nums">₺64.500</span>
                </div>
              </div>
            </div>
          )}

          {heroTab === 'resmi' && (
            <div className="space-y-4 my-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { title: 'GTS Gübre Takip', desc: 'DNA & 2D Karekod mal kabul ve çıkış bildirimi' },
                  { title: 'BKTS İlaç Takip', desc: 'GTIN, Lot, Seri No ve SKT ayrıştırma' },
                  { title: 'B-Reçete Sistemi', desc: 'T.C. No / İl-İlçe ile hızlı e-reçete akışı' },
                  { title: 'EDM e-Fatura', desc: 'Gelen alış faturasından otomatik stok girişi' }
                ].map(srv => (
                  <div key={srv.title} className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                    <div className="text-xs font-semibold text-emerald-300">{srv.title}</div>
                    <p className="text-[11px] text-white/75 mt-1 leading-relaxed">{srv.desc}</p>
                  </div>
                ))}
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] font-mono text-[11px] text-emerald-300 truncate">
                GS1 DataMatrix: (01)08699745120841(17)280930(10)TR2604A(21)994812 → BKTS Doğrulandı
              </div>
            </div>
          )}

          {heroTab === 'harita' && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto">
              <div className="sm:col-span-7 relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10">
                <img
                  src="/showcase/apple-tile-field-ipad.png"
                  alt="TKGM Parsel Haritası ve NDVI Uydu"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:col-span-5 space-y-2.5">
                <div className="text-xs font-semibold text-emerald-400">TKGM + Çiftçi Tarla Etiketi</div>
                <div className="text-base font-semibold text-white">Ada 142 / Parsel 8 • 184.6 Da</div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Çiftçiyi seçip &ldquo;Parseli MKS&rsquo;ye Kaydet&rdquo; dediğinizde tarla haritadan kaybolmaz; sahibi olan çiftçinin adıyla harita üzerinde kalıcı olarak gösterilir.
                </p>
                <div className="inline-flex px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                  Sahibi: Ahmet Yılmaz • Pamuk
                </div>
              </div>
            </div>
          )}

          {heroTab === 'ai' && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto">
              <div className="sm:col-span-5 relative aspect-[16/10] rounded-2xl overflow-hidden border border-white/10">
                <img
                  src="/showcase/apple-tile-ai-muhendisim.png"
                  alt="MKS Yapay Zeka Bitki Teşhis"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:col-span-7 space-y-2.5">
                <div className="text-xs font-semibold text-emerald-400">MKS Zirai & Finansal Copilot</div>
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs text-white/85 leading-relaxed">
                  &ldquo;Depomda 72 kalem aktif stok ve 87 kayıtlı müstahsil cari hesabı canlı bağlı. Pamuk yaprak biti için ruhsatlı BKU dozajını çıkarıp deponuzdaki eşdeğer ürünleri hemen listeleyebilirim.&rdquo;
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px]">Depo Stok Analizi</span>
                  <span className="px-3 py-1 rounded-full bg-white/[0.06] text-white/80 text-[11px]">BKU Ruhsat & Dozaj</span>
                  <span className="px-3 py-1 rounded-full bg-white/[0.06] text-white/80 text-[11px]">Görsel Teşhis</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={appleFontStyle}
      className="min-h-screen bg-[#FFFFFF] text-[#1D1D1F] flex flex-col overflow-x-clip selection:bg-emerald-500/30"
    >
      {/* ==================== APPLE GLOBAL TRANSLUCENT NAV (44-48px) ==================== */}
      <header className="sticky top-0 z-40 h-12 bg-[#161617]/85 backdrop-blur-2xl border-b border-white/[0.08] text-[#F5F5F7]">
        <div className="max-w-[1180px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-3">
          <a href="#ust" className="flex items-center gap-2 shrink-0 group">
            <MksBrandLogo size="sm" rounded="lg" className="border-white/15" />
            <span className="text-[13px] font-semibold tracking-tight text-white">
              MKS <span className="hidden sm:inline text-white/60 font-normal">Kurumsal</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-5 text-[12px] font-normal text-white/80">
            <a href="#hero-komuta" className="hover:text-white transition-colors whitespace-nowrap">
              MKS Kurumsal
            </a>
            <a href="#hero-cari" className="hover:text-white transition-colors whitespace-nowrap">
              Çiftçi Cari
            </a>
            <a href="#hero-resmi" className="hover:text-white transition-colors whitespace-nowrap">
              Resmi Servisler
            </a>
            <a href="#bento-izgara" className="hover:text-white transition-colors whitespace-nowrap">
              Depo & TKGM
            </a>
            <a href="#galeri-vitrin" className="hover:text-white transition-colors whitespace-nowrap">
              Ekranlar
            </a>
            <button
              type="button"
              onClick={() => onOpenPortalTab('download')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              İndir
            </button>
            <button
              type="button"
              onClick={() => onOpenPortalTab('pricing')}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Paketler
            </button>
            <button
              type="button"
              onClick={onOpenSupport}
              className="hover:text-white transition-colors whitespace-nowrap"
            >
              Destek
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuthModal('LOGIN')}
              className="h-8 px-3.5 rounded-full bg-white/[0.1] hover:bg-white/[0.18] text-white text-[11px] font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <LogIn size={12} className="hidden sm:inline text-emerald-400" />
              <span>Giriş Yap</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuthModal('REGISTER')}
              className="h-8 px-3.5 rounded-full bg-[#10B981] hover:bg-[#059669] text-[#052E16] text-[11px] font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <UserPlus size={12} className="hidden sm:inline" />
              <span>Hesap Oluştur</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Quick-Jump Ribbon (Zero Overflow) */}
      <div className="lg:hidden bg-[#1D1D1F] border-b border-white/[0.08] px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar text-[11px] text-white/80">
        <a href="#hero-cari" className="shrink-0 px-2.5 py-1 rounded-full bg-white/[0.06]">Çiftçi Cari</a>
        <a href="#hero-resmi" className="shrink-0 px-2.5 py-1 rounded-full bg-white/[0.06]">Resmi Servisler</a>
        <a href="#bento-izgara" className="shrink-0 px-2.5 py-1 rounded-full bg-white/[0.06]">Depo & TKGM</a>
        <button type="button" onClick={() => onOpenPortalTab('download')} className="shrink-0 px-2.5 py-1 rounded-full bg-white/[0.06]">İndir</button>
        <button type="button" onClick={() => onOpenPortalTab('pricing')} className="shrink-0 px-2.5 py-1 rounded-full bg-white/[0.06]">Paketler</button>
        <button type="button" onClick={onOpenSupport} className="shrink-0 px-2.5 py-1 rounded-full bg-white/[0.06]">Destek</button>
      </div>

      {/* ==================== APPLE RIBBON DUYURU ŞERİDİ ==================== */}
      <div className="bg-[#1D1D1F] text-[#F5F5F7] text-xs py-2.5 px-4 text-center border-b border-white/[0.06]">
        <span className="text-white/85">
          MKS Kurumsal v8.2 yayında. Çiftçi cari, BKTS/GTS, B-Reçete, e-Fatura ve TKGM parsel haritası tek merkezde.{' '}
        </span>
        <button
          type="button"
          onClick={() => onOpenPortalTab('pricing')}
          className="text-[#34D399] hover:underline font-medium inline-flex items-center gap-0.5 ml-1"
        >
          <span>Paketleri ve indirme seçeneklerini inceleyin</span>
          <ChevronRight size={13} />
        </button>
      </div>

      <main id="ust" className="flex-1">
        {/* ==================== BÖLÜM 1: FLAGSHIP DARK HERO ==================== */}
        <section
          id="hero-komuta"
          className="bg-[#000000] text-[#F5F5F7] pt-12 sm:pt-18 lg:pt-20 pb-12 sm:pb-16 px-4 sm:px-6 text-center overflow-hidden"
        >
          <div className="max-w-5xl mx-auto space-y-5">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: APPLE_EASE }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.07] border border-white/[0.12] text-[11px] font-medium text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>MKS Kurumsal v8.2 • Zirai ERP &amp; Saha Komuta Merkezi</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-semibold text-white tracking-[-0.035em] leading-[1.04]">
                Mühendis Kayıt Sistemi.
              </h1>

              <p className="text-lg sm:text-2xl text-[#86868B] font-normal tracking-[-0.015em] max-w-2xl mx-auto leading-snug">
                Zirai bayilik ve mühendislikte yeni standart. Kusursuz tasarım, tam resmi uyum.
              </p>

              {/* Apple Dual Pill CTAs (17px gap, 44px height) */}
              <div className="flex flex-wrap items-center justify-center gap-[17px] pt-2">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('LOGIN')}
                  className="h-11 px-7 rounded-full bg-[#10B981] hover:bg-[#059669] text-[#052E16] text-sm font-semibold transition-all inline-flex items-center gap-1.5"
                >
                  <span>Sisteme Giriş Yap</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('REGISTER')}
                  className="h-11 px-7 rounded-full border border-[#10B981]/70 text-[#34D399] hover:bg-[#10B981]/15 text-sm font-medium transition-all inline-flex items-center gap-1.5"
                >
                  <span>Ücretsiz Hesap Aç</span>
                </button>
              </div>
            </motion.div>

            {/* Apple Segmented Tab Switcher + Hero Stage */}
            <div ref={heroStageRef} className="pt-6 space-y-4">
              <div className="inline-flex max-w-full items-center gap-1 p-1 rounded-full bg-[#161617] border border-white/[0.1] overflow-x-auto no-scrollbar">
                {HERO_STAGE_TABS.map(tab => {
                  const Icon = tab.icon;
                  const active = heroTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHeroTab(tab.id)}
                      className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        active
                          ? 'bg-white text-[#1D1D1F] font-semibold shadow-sm'
                          : 'text-white/75 hover:text-white'
                      }`}
                    >
                      <Icon size={13} className={active ? 'text-emerald-600' : 'text-white/60'} />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </button>
                  );
                })}
              </div>

              <motion.div style={{ scale: stageScale, opacity: stageOpacity }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={heroTab}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: APPLE_EASE }}
                  >
                    {renderHeroInteractiveOverlay()}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ==================== BÖLÜM 2: FLAGSHIP LIGHT HERO (ÇİFTÇİ CARİ & 5 ADIM SATIŞ) ==================== */}
        <section
          id="hero-cari"
          className="bg-[#F5F5F7] text-[#1D1D1F] mt-3 py-16 sm:py-24 px-4 sm:px-6 text-center"
        >
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="space-y-3">
              <h2 className="text-3xl sm:text-5xl lg:text-[54px] font-semibold tracking-[-0.03em] leading-[1.06] text-[#1D1D1F]">
                Çiftçi Cari ve Fatura Defteri.
              </h2>
              <p className="text-base sm:text-xl text-[#6E6E73] max-w-2xl mx-auto leading-snug">
                Önce çiftçi, sonra ekili ürün, ilaçlar, fiyat ve onay. Karmaşadan uzak, kuruşu kuruşuna mutabakat.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-[17px] pt-2">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('LOGIN')}
                  className="h-11 px-7 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-medium transition-colors"
                >
                  Hemen Deneyin
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPortalTab('overview')}
                  className="h-11 px-7 rounded-full border border-[#0071E3] text-[#0071E3] hover:bg-[#0071E3] hover:text-white text-sm font-medium transition-colors inline-flex items-center gap-1"
                >
                  <span>Yıl Sonu &amp; Devir Özellikleri</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Interactive Light MKS Kurumsal Showcase Card */}
            <div className="bg-white rounded-[28px] border border-black/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.06)] p-5 sm:p-8 text-left space-y-6 mt-6">
              {/* 5-Step Progress Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 1, label: '1. Çiftçi' },
                    { id: 2, label: '2. Ekili Ürün' },
                    { id: 3, label: '3. İlaç & Gübre' },
                    { id: 4, label: '4. Fiyat & Adet' },
                    { id: 5, label: '5. Önizleme & Onay' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setWizardStep(st.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        wizardStep === st.id
                          ? 'bg-[#052E16] text-white'
                          : 'bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  Sadece Depo &amp; Cari Takibi
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 space-y-3">
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1D1D1F]">
                        Adım {wizardStep}/5:{' '}
                        {wizardStep === 1
                          ? 'Müstahsil Tek Dokunuşta Seçildi'
                          : wizardStep === 2
                          ? 'Pamuk & Buğday Tarla Parseli Bağlandı'
                          : wizardStep === 3
                          ? 'BKU İlaç ve Gübre Kalemleri Eklendi'
                          : wizardStep === 4
                          ? 'Peşin / Vadeli Birim Fiyat Hesaplandı'
                          : 'Önizleme Onaylandı — Cari ve Stok Güncellendi'}
                      </span>
                      <span className="text-emerald-700 font-semibold">Aktif</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="p-3 rounded-xl bg-white border border-black/[0.05]">
                        <div className="text-[11px] text-[#6E6E73]">Seçili Müstahsil</div>
                        <div className="text-sm font-semibold text-[#1D1D1F] mt-0.5">Ahmet Yılmaz • Salça</div>
                        <div className="text-[11px] text-emerald-700 mt-0.5">Önceki bakiye: ₺93.550</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-black/[0.05]">
                        <div className="text-[11px] text-[#6E6E73]">Fatura &amp; Sepet Tutarı</div>
                        <div className="text-sm font-semibold text-[#1D1D1F] mt-0.5 tabular-nums">₺34.850,00</div>
                        <div className="text-[11px] text-[#6E6E73] mt-0.5">Vadeli + Nakit / POS Bloke destekli</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    {[
                      { label: 'Parçalı Tahsilat', val: 'Nakit • Çek • POS' },
                      { label: 'Müstahsil Paylaşımı', val: 'Şifresiz Portal Linki' },
                      { label: 'Dönem Sonu', val: 'Kayıpsız Yıllık Devir' }
                    ].map(f => (
                      <div key={f.label} className="p-3 rounded-2xl bg-[#F5F5F7]">
                        <div className="text-[10px] text-[#6E6E73]">{f.label}</div>
                        <div className="text-xs font-semibold text-[#1D1D1F] mt-0.5">{f.val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-2.5">
                  <div className="p-4 rounded-2xl bg-[#052E16] text-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-emerald-300">Şifresiz Üretici Portalı</span>
                      <ShieldCheck size={16} className="text-emerald-400" />
                    </div>
                    <div className="text-xl font-semibold tabular-nums">₺128.400,00</div>
                    <p className="text-xs text-white/75 leading-relaxed">
                      Çiftçiniz WhatsApp üzerinden gönderilen özel bağlantıyla güncel borcunu ve kaşeli PDF ekstresini anında görür.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F5F5F7] flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1D1D1F]">Çok Sayfalı Yıl Sonu Bilanço PDF</span>
                    <span className="text-emerald-700 font-semibold">Hazır</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== BÖLÜM 3: FLAGSHIP RESMİ SERVİSLER HERO ==================== */}
        <section
          id="hero-resmi"
          className="bg-[#07130E] text-[#F5F5F7] mt-3 py-16 sm:py-24 px-4 sm:px-6 text-center"
        >
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-medium text-emerald-300">
                <ScanBarcode size={13} />
                <span>Ayrı Resmi Servisler Komuta Alanı</span>
              </div>
              <h2 className="text-3xl sm:text-5xl lg:text-[54px] font-semibold tracking-[-0.03em] leading-[1.06] text-white">
                Resmi Servisler. Kendi Özel Alanında.
              </h2>
              <p className="text-base sm:text-xl text-[#9CB0A5] max-w-2xl mx-auto leading-snug">
                GTS, BKTS, B-Reçete ve EDM e-Fatura. Fatura defterini yormadan, tek tıkla Bakanlık ve GİB entegrasyonu.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-[17px] pt-2">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('LOGIN')}
                  className="h-11 px-7 rounded-full bg-[#10B981] hover:bg-[#059669] text-[#052E16] text-sm font-semibold transition-colors"
                >
                  Servisleri Aç
                </button>
                <button
                  type="button"
                  onClick={onOpenSupport}
                  className="h-11 px-7 rounded-full border border-white/25 text-white hover:bg-white/10 text-sm font-medium transition-colors"
                >
                  BKTS / EDM Bilgi Al
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-left">
              {[
                {
                  title: 'GTS Gübre Takip',
                  badge: 'DNA & Karekod',
                  desc: 'Gübre çuvallarındaki 2D karekodu telefonla okutup mal kabul ve satış bildirimi yapın.'
                },
                {
                  title: 'BKTS İlaç Takip',
                  badge: 'GS1 DataMatrix',
                  desc: 'GTIN, parti numarası, seri no ve SKT ayrıştırması ile sıfır hatalı bakanlık bildirimi.'
                },
                {
                  title: 'B-Reçete Sistemi',
                  badge: 'E-Reçete Uyumu',
                  desc: 'Çiftçi T.C. No ve onay kodlarıyla saniyeler içinde resmi e-Reçete çıkışı oluşturun.'
                },
                {
                  title: 'EDM Resmi e-Fatura',
                  badge: 'GİB Entegre',
                  desc: 'Gelen alış faturalarını tek onayla stoğa işleyin; resmi e-Fatura / e-Arşiv kesin.'
                }
              ].map(card => (
                <div
                  key={card.title}
                  className="p-5 rounded-3xl bg-white/[0.04] border border-white/[0.1] hover:border-emerald-500/40 transition-colors space-y-2.5"
                >
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                    {card.badge}
                  </span>
                  <h3 className="text-base font-semibold text-white">{card.title}</h3>
                  <p className="text-xs text-[#A3B8AD] leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== BÖLÜM 4: APPLE.COM 2x3 BENTO PROMO GRID (12px gap) ==================== */}
        <section id="bento-izgara" className="mt-3 px-0 sm:px-3 max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* TILE 1 (Light #F5F5F7): Depo, Stok ve Barkod */}
            <div className="bg-[#F5F5F7] text-[#1D1D1F] min-h-[540px] sm:min-h-[580px] flex flex-col justify-between overflow-hidden text-center pt-10">
              <div className="px-6 sm:px-10 space-y-2.5">
                <h3 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em]">Depo &amp; Barkod.</h3>
                <p className="text-sm sm:text-base text-[#6E6E73] max-w-md mx-auto">
                  Market barkod tabancası ile hızlı çıkış, FEFO SKT takibi ve Stok Senkronizasyon Merkezi.
                </p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal('LOGIN')}
                    className="h-9 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium transition-colors"
                  >
                    Stok Sistemini Gör
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPortalTab('overview')}
                    className="h-9 px-5 rounded-full border border-[#0071E3] text-[#0071E3] hover:bg-[#0071E3] hover:text-white text-xs font-medium transition-colors"
                  >
                    Detaylar ›
                  </button>
                </div>
              </div>
              <div className="mt-6 h-[320px] sm:h-[360px] w-full overflow-hidden">
                <img
                  src="/showcase/apple-tile-pos-warehouse.png"
                  alt="MKS Depo, Barkod ve Stok Takip Tezgahı"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            {/* TILE 2 (Dark #000000): MKS Mühendisim & İlaç Kütüphanesi */}
            <div className="bg-[#000000] text-[#F5F5F7] min-h-[540px] sm:min-h-[580px] flex flex-col justify-between overflow-hidden text-center pt-10">
              <div className="px-6 sm:px-10 space-y-2.5">
                <h3 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-white">
                  MKS Mühendisim.
                </h3>
                <p className="text-sm sm:text-base text-[#86868B] max-w-md mx-auto">
                  TARGEM/BKU ruhsatlı ilaç kütüphanesi: ticari isim, aktif madde, hedef zararlı, dozaj ve gerçek yaprak görselleri.
                </p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal('LOGIN')}
                    className="h-9 px-5 rounded-full bg-[#10B981] hover:bg-[#059669] text-[#052E16] text-xs font-semibold transition-colors"
                  >
                    Kütüphaneyi Aç
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPortalTab('overview')}
                    className="h-9 px-5 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs font-medium transition-colors"
                  >
                    BKU Veritabanı ›
                  </button>
                </div>
              </div>
              <div className="mt-6 h-[320px] sm:h-[360px] w-full overflow-hidden">
                <img
                  src="/showcase/apple-tile-ai-muhendisim.png"
                  alt="MKS Mühendisim Bitki Sağlığı ve Yapay Zeka Teşhisi"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            {/* TILE 3 (Dark #081410): TKGM Parsel & Sentinel-2 Uydu */}
            <div className="bg-[#081410] text-[#F5F5F7] min-h-[540px] sm:min-h-[580px] relative flex flex-col justify-between overflow-hidden text-center pt-10">
              <div className="px-6 sm:px-10 space-y-2.5 relative z-10">
                <h3 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-white">
                  TKGM Parsel &amp; Uydu.
                </h3>
                <p className="text-sm sm:text-base text-[#A3B8AD] max-w-md mx-auto">
                  Ada/parsel sorgu, haritada kalıcı tarla sahibi etiketi ve canlı {satLayer} bitki gelişim katmanı.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {(['NDVI', 'NDMI', 'SWIR'] as const).map(layer => (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => setSatLayer(layer)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        satLayer === layer
                          ? 'bg-emerald-500 text-[#052E16] font-semibold'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {layer === 'NDVI' ? 'NDVI Gelişim' : layer === 'NDMI' ? 'NDMI Sulama' : 'SWIR Tav'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 h-[320px] sm:h-[360px] w-full relative overflow-hidden">
                <img
                  src="/showcase/apple-tile-field-ipad.png"
                  alt="TKGM Ada Parsel ve Sentinel-2 Uydu Haritası"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
                  <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-emerald-400/40 text-emerald-300 text-[11px] font-medium">
                    Kayıtlı Sahibi: Ahmet Yılmaz • Ada 142 / Parsel 8
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px]">
                    {satLayer} Aktif
                  </span>
                </div>
              </div>
            </div>

            {/* TILE 4 (Light #F5F5F7): MKS Yapay Zeka Merkezi */}
            <div className="bg-[#F5F5F7] text-[#1D1D1F] min-h-[540px] sm:min-h-[580px] flex flex-col justify-between overflow-hidden text-center pt-10 pb-8 px-6 sm:px-10">
              <div className="space-y-2.5">
                <h3 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em]">MKS Yapay Zeka.</h3>
                <p className="text-sm sm:text-base text-[#6E6E73] max-w-md mx-auto">
                  Canlı depo stoklarınıza, çiftçi alacaklarınıza ve TARGEM reçete rehberine bağlı akıllı AI Copilot.
                </p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal('LOGIN')}
                    className="h-9 px-5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium transition-colors"
                  >
                    Zirai Asistanı Aç
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-black/[0.06] shadow-sm p-5 text-left space-y-3 max-w-md mx-auto w-full my-auto">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <Sparkles size={14} /> Canlı AI Bağlantısı
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                    72 Ürün • 87 Cari
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-[#F5F5F7] text-xs text-[#1D1D1F] leading-relaxed">
                  &ldquo;Pamukta kırmızı örümcek için depomda hangi ruhsatlı ilaçlar hazır ve muadilleri neler?&rdquo;
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-xs text-[#052E16] leading-relaxed">
                  Depoda <strong>48 adet Abamectin 18 EC</strong> (SKT 09/2028) ve <strong>16 adet Hexythiazox</strong> hazır. Önerilen doz: 50 ml/100 L su.
                </div>
              </div>
            </div>

            {/* TILE 5 (Light #FBFBFD): Ajanda, Görevler & Silo Kantar */}
            <div className="bg-[#FBFBFD] border border-black/[0.04] text-[#1D1D1F] min-h-[540px] sm:min-h-[580px] flex flex-col justify-between overflow-hidden text-center pt-10 pb-8 px-6 sm:px-10">
              <div className="space-y-2.5">
                <h3 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em]">
                  Ajanda &amp; Silo Kantar.
                </h3>
                <p className="text-sm sm:text-base text-[#6E6E73] max-w-md mx-auto">
                  Kurumsal zirai takvim, çek/senet vade bildirimleri ve hububat kantar nem-fire cari mahsubu.
                </p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal('REGISTER')}
                    className="h-9 px-5 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-medium transition-colors"
                  >
                    Ücretsiz Başla
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 max-w-md mx-auto w-full my-auto text-left">
                <div className="p-4 rounded-2xl bg-[#F5F5F7] flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CalendarCheck2 size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#1D1D1F]">Zirai Takvim &amp; Vade Alarmları</div>
                    <div className="text-[11px] text-[#6E6E73]">
                      09:00 günlük saha planı, 20:00 tahsilat vade hatırlatması
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#F5F5F7] flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Wheat size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#1D1D1F]">Silo &amp; Kantar Cari Mahsubu</div>
                    <div className="text-[11px] text-[#6E6E73]">
                      Net 28.440 kg buğday alımı anında müstahsil borcundan düşülür
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#F5F5F7] flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0071E3] text-white flex items-center justify-center shrink-0">
                    <Bell size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#1D1D1F]">Çek, Senet &amp; Aranacaklar</div>
                    <div className="text-[11px] text-[#6E6E73]">
                      Geciken veya vadesi gelen kayıtlar tek dokunuşta aranır
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TILE 6 (Dark #0B0F17): Sistem İşlemleri & 4 Platform Senkron */}
            <div className="bg-[#0B0F17] text-[#F5F5F7] min-h-[540px] sm:min-h-[580px] flex flex-col justify-between overflow-hidden text-center pt-10 pb-8 px-6 sm:px-10">
              <div className="space-y-2.5">
                <h3 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-white">
                  Kusursuz Devir &amp; Senkron.
                </h3>
                <p className="text-sm sm:text-base text-[#86868B] max-w-md mx-auto">
                  Google/şifre doğrulamalı yıl sonu devri, bilanço PDF’leri, veri sağlığı denetimi ve 4 platformda sıfır kayıp.
                </p>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenPortalTab('download')}
                    className="h-9 px-5 rounded-full bg-white text-[#1D1D1F] hover:bg-white/90 text-xs font-semibold transition-colors"
                  >
                    Cihazınıza İndirin
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto w-full my-auto text-left">
                {[
                  { icon: RefreshCw, title: 'Yeni Yıla Devret', sub: 'Google & şifre korumalı sezon geçişi' },
                  { icon: BarChart3, title: 'Yıl Sonu PDF Bilanço', sub: 'Tüm cariler kuruşu kuruşuna' },
                  { icon: ShieldCheck, title: 'Veri Sağlığı & Stok Onar', sub: 'Tek tıkla kasa & depo mutabakatı' },
                  { icon: CloudOff, title: 'Çevrimdışı Çalışma', sub: 'İnternetsiz sahada anlık kayıt' }
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.09] space-y-1.5">
                      <Icon size={17} className="text-emerald-400" />
                      <div className="text-xs font-semibold text-white">{item.title}</div>
                      <div className="text-[11px] text-white/65 leading-snug">{item.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ==================== BÖLÜM 5: APPLE TV+ TARZI GALERİ & 4 PLATFORM İNDİRME ==================== */}
        <section id="galeri-vitrin" className="bg-[#FFFFFF] text-[#1D1D1F] mt-3 py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto space-y-14">
            {/* Gallery Carousel */}
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.03em] text-[#1D1D1F]">
                  Her ekranda MKS Kurumsal.
                </h2>
                <p className="text-sm sm:text-lg text-[#6E6E73]">
                  Komuta merkezinden saha haritasına kadar tüm arayüzler uyumlu.
                </p>
              </div>

              <div className="relative rounded-[28px] overflow-hidden bg-[#000000] text-white min-h-[340px] sm:min-h-[430px] shadow-[0_24px_70px_rgba(0,0,0,0.14)] flex flex-col justify-between p-6 sm:p-10">
                {currentSlide.image && (
                  <img
                    src={currentSlide.image}
                    alt={currentSlide.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-50 transition-opacity duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />

                <div className="relative z-10 flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-semibold tracking-wide ${currentSlide.accent}`}>
                    {currentSlide.tag}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Önceki ekran"
                      onClick={() => {
                        setIsGalleryPaused(true);
                        setGalleryIdx(prev => (prev - 1 + GALLERY_SLIDES.length) % GALLERY_SLIDES.length);
                      }}
                      className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Sonraki ekran"
                      onClick={() => {
                        setIsGalleryPaused(true);
                        setGalleryIdx(prev => (prev + 1) % GALLERY_SLIDES.length);
                      }}
                      className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide.id}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: APPLE_EASE }}
                    className="relative z-10 max-w-xl space-y-4 my-auto py-4"
                  >
                    <h3 className="text-2xl sm:text-4xl font-semibold tracking-[-0.025em] leading-tight text-white">
                      {currentSlide.title}
                    </h3>
                    <p className="text-sm sm:text-base text-white/80 leading-relaxed">
                      {currentSlide.subtitle}
                    </p>
                    <ul className="space-y-1.5 pt-1">
                      {currentSlide.highlights.map(h => (
                        <li key={h} className="text-xs sm:text-sm text-white/90 flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </AnimatePresence>

                <div className="relative z-10 flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenAuthModal('LOGIN')}
                    className="h-10 px-6 rounded-full bg-white text-[#1D1D1F] hover:bg-white/90 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Sistemi Başlat</span>
                    <ArrowRight size={14} />
                  </button>
                  <span className="text-xs text-white/60 tabular-nums">
                    {galleryIdx + 1} / {GALLERY_SLIDES.length}
                  </span>
                </div>
              </div>

              {/* Apple Pagination Dots + Play/Pause Control */}
              <div className="flex items-center justify-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F5F5F7]">
                  {GALLERY_SLIDES.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Slayt ${idx + 1}: ${s.title}`}
                      onClick={() => {
                        setIsGalleryPaused(true);
                        setGalleryIdx(idx);
                      }}
                      className={`h-2 rounded-full transition-all ${
                        idx === galleryIdx ? 'w-6 bg-[#1D1D1F]' : 'w-2 bg-[#86868B]/50 hover:bg-[#1D1D1F]/60'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label={isGalleryPaused ? 'Galeriyi oynat' : 'Galeriyi duraklat'}
                  onClick={() => setIsGalleryPaused(p => !p)}
                  className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] flex items-center justify-center transition-colors"
                >
                  {isGalleryPaused ? <Play size={13} /> : <Pause size={13} />}
                </button>
              </div>
            </div>

            {/* 4 Platform Download Showcase */}
            <div className="space-y-6 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-[#1D1D1F]">
                    Tüm cihazlarınız için tek hesap.
                  </h2>
                  <p className="text-sm text-[#6E6E73] mt-1">
                    Windows kasa bilgisayarında, depoda Android veya iPhone’da, ya da doğrudan web tarayıcınızda.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPortalTab('pricing')}
                  className="h-9 px-5 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] text-xs font-medium self-start sm:self-auto transition-colors"
                >
                  Paketleri Karşılaştır ›
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <a
                  href="/downloads/MKS_Masaustu_Kurulum.exe"
                  download="MKS_Masaustu_Kurulum.exe"
                  className="p-6 rounded-3xl bg-[#F5F5F7] hover:bg-[#EFEFF3] transition-colors flex flex-col justify-between gap-5"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white text-[#1D1D1F] shadow-sm flex items-center justify-center">
                    <Monitor size={20} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[#1D1D1F]">Windows Masaüstü</div>
                    <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                      Windows 10/11 kurulum (.EXE) ve 1D/2D USB barkod tabancası tam uyumu.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#0071E3] inline-flex items-center gap-1">
                    <Download size={13} /> Masaüstüne İndir
                  </span>
                </a>

                <a
                  href="/downloads/MKS_Android.apk"
                  download="MKS_Android.apk"
                  className="p-6 rounded-3xl bg-[#F5F5F7] hover:bg-[#EFEFF3] transition-colors flex flex-col justify-between gap-5"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white text-emerald-700 shadow-sm flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[#1D1D1F]">Android Mobil</div>
                    <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                      Telefon kamerasıyla karekod &amp; yaprak tarama için v8.2 APK ve Google Play.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#0071E3] inline-flex items-center gap-1">
                    <Download size={13} /> APK İndir
                  </span>
                </a>

                <a
                  href="https://apps.apple.com/tr/app/m%C3%BChendis-kay%C4%B1t-sistemi-mks/id6760776127"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-6 rounded-3xl bg-[#F5F5F7] hover:bg-[#EFEFF3] transition-colors flex flex-col justify-between gap-5 text-left"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white text-[#1D1D1F] shadow-sm flex items-center justify-center">
                    <Apple size={20} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[#1D1D1F]">iPhone &amp; iPad (iOS)</div>
                    <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                      iPhone ve iPad için resmî Apple App Store mobil uygulaması.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#0071E3] inline-flex items-center gap-1">
                    <Apple size={13} /> App Store’dan İndir <ChevronRight size={13} />
                  </span>
                </a>

                <button
                  type="button"
                  onClick={() => onOpenAuthModal('LOGIN')}
                  className="p-6 rounded-3xl bg-[#052E16] hover:bg-[#063A1D] text-white transition-colors flex flex-col justify-between gap-5 text-left"
                >
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                    <FileCheck2 size={20} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Doğrudan Web Girişi</div>
                    <p className="text-xs text-white/75 mt-1 leading-relaxed">
                      Kurulum yapmadan tarayıcı üzerinden anında MKS Kurumsal’a bağlanın.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1">
                    Sisteme Giriş Yap <ArrowRight size={13} />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ==================== BÖLÜM 6: APPLE.COM #F5F5F7 KURUMSAL FOOTER DİZİNİ ==================== */}
      <footer className="bg-[#F5F5F7] text-[#6E6E73] border-t border-[#D2D2D7] pt-10 pb-8 px-4 sm:px-6 text-[12px]">
        <div className="max-w-[980px] mx-auto space-y-6">
          {/* Footnotes */}
          <div className="space-y-2 pb-6 border-b border-[#D2D2D7] leading-relaxed text-[11px] text-[#6E6E73]">
            <p>
              1. Çevrimdışı IndexedDB ve Bulut Firestore hibrit altyapısı sayesinde internet kesilse bile satış, tahsilat ve stok işlemleri kesintisiz kaydedilir; bağlantı kurulduğunda otomatik eşitlenir.
            </p>
            <p>
              2. Tarım Bakanlığı BKTS / GTS 2D karekod, B-Reçete ve GİB/EDM e-Fatura entegrasyonları yetkili bayi ve mühendis hesap bilgileriyle çalışır.
            </p>
            <p>
              3. Kurumsal abonelikler Shopier 256-bit SSL güvenli ödeme altyapısı ve Fırat Tarım güvencesiyle sunulur.
            </p>
          </div>

          {/* 5-Column Apple Directory Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 py-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-[#1D1D1F] text-[12px]">Komuta &amp; Finans</h4>
              <ul className="space-y-1.5">
                <li><a href="#hero-cari" className="hover:text-[#1D1D1F] hover:underline">Müstahsil Cari Takibi</a></li>
                <li><a href="#hero-cari" className="hover:text-[#1D1D1F] hover:underline">5 Adım Satış &amp; İade</a></li>
                <li><a href="#bento-izgara" className="hover:text-[#1D1D1F] hover:underline">Kasa, Banka &amp; Çekler</a></li>
                <li><a href="#bento-izgara" className="hover:text-[#1D1D1F] hover:underline">Yıl Sonu PDF Bilanço</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-[#1D1D1F] text-[12px]">Resmi Servisler</h4>
              <ul className="space-y-1.5">
                <li><a href="#hero-resmi" className="hover:text-[#1D1D1F] hover:underline">GTS Gübre Takip</a></li>
                <li><a href="#hero-resmi" className="hover:text-[#1D1D1F] hover:underline">BKTS İlaç Takip</a></li>
                <li><a href="#hero-resmi" className="hover:text-[#1D1D1F] hover:underline">B-Reçete Sistemi</a></li>
                <li><a href="#hero-resmi" className="hover:text-[#1D1D1F] hover:underline">EDM e-Fatura &amp; e-Arşiv</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-[#1D1D1F] text-[12px]">Depo &amp; Saha</h4>
              <ul className="space-y-1.5">
                <li><a href="#bento-izgara" className="hover:text-[#1D1D1F] hover:underline">Barkod &amp; Stok Onarım</a></li>
                <li><a href="#bento-izgara" className="hover:text-[#1D1D1F] hover:underline">BKU İlaç Kütüphanesi</a></li>
                <li><a href="#bento-izgara" className="hover:text-[#1D1D1F] hover:underline">TKGM Parsel &amp; Uydu</a></li>
                <li><a href="#bento-izgara" className="hover:text-[#1D1D1F] hover:underline">MKS Yapay Zeka</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-[#1D1D1F] text-[12px]">Platformlar &amp; İndirme</h4>
              <ul className="space-y-1.5">
                <li>
                  <button type="button" onClick={() => onOpenPortalTab('download')} className="hover:text-[#1D1D1F] hover:underline">
                    Windows Masaüstü (.EXE)
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onOpenPortalTab('download')} className="hover:text-[#1D1D1F] hover:underline">
                    Android Mobil (.APK)
                  </button>
                </li>
                <li>
                  <a
                    href="https://apps.apple.com/tr/app/m%C3%BChendis-kay%C4%B1t-sistemi-mks/id6760776127"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#1D1D1F] hover:underline"
                  >
                    iPhone &amp; iPad (App Store)
                  </a>
                </li>
                <li>
                  <button type="button" onClick={() => onOpenAuthModal('LOGIN')} className="hover:text-[#1D1D1F] hover:underline">
                    Web Yönetim Paneli
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-[#1D1D1F] text-[12px]">Kurumsal &amp; Destek</h4>
              <ul className="space-y-1.5">
                <li>
                  <button type="button" onClick={() => onOpenPortalTab('pricing')} className="hover:text-[#1D1D1F] hover:underline">
                    Kurumsal Paketler
                  </button>
                </li>
                <li>
                  <a
                    href="https://www.shopier.com/firattarim"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[#1D1D1F] hover:underline"
                  >
                    Shopier Güvenli Mağaza
                  </a>
                </li>
                <li>
                  <button type="button" onClick={onOpenSupport} className="hover:text-[#1D1D1F] hover:underline inline-flex items-center gap-1">
                    <Headphones size={12} /> Canlı Destek Hattı
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onOpenAuthModal('REGISTER')} className="hover:text-[#1D1D1F] hover:underline">
                    Yeni Hesap Oluştur
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Legal Row */}
          <div className="pt-5 border-t border-[#D2D2D7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-2">
              <MksBrandLogo size="xs" rounded="lg" />
              <span>&copy; 2026 Mühendis Kayıt Sistemi (MKS) • Kurumsal Sürüm v8.2.0 • Tüm hakları saklıdır.</span>
            </div>
            <div className="flex items-center gap-4 text-[#424245]">
              <span>Fırat Tarım Mühendislik</span>
              <span className="inline-flex items-center gap-1">
                <Layers size={11} /> Türkiye • Türkçe
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

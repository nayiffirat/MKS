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
  Package,
  ScanBarcode,
  FileCheck2,
  Compass,
  Smartphone,
  Monitor,
  Apple,
  Download,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  RefreshCw,
  Bell,
  Phone,
  ShieldCheck,
  Headphones,
  LogIn,
  UserPlus,
  Wheat,
  Lock,
  Wallet,
  Receipt,
  type LucideIcon
} from 'lucide-react';
import { MksBrandLogo } from './MksBrandLogo';

export interface CorporateShowcaseProps {
  onOpenAuthModal: (mode: 'LOGIN' | 'REGISTER') => void;
  onOpenPortalTab: (tab: 'overview' | 'download' | 'pricing' | 'ios_guide') => void;
  onOpenSupport: () => void;
}

type ShowcaseModuleId = 'cari' | 'stok' | 'bkts_gts' | 'efatura' | 'saha_ek';
type SatelliteSubLayer = 'NDVI' | 'NDMI' | 'SWIR';

interface ShowcaseModuleSpec {
  id: ShowcaseModuleId;
  label: string;
  shortLabel: string;
  headline: string;
  summary: string;
  metrics: { label: string; value: string }[];
  icon: LucideIcon;
}

const SHOWCASE_MODULES: ShowcaseModuleSpec[] = [
  {
    id: 'cari',
    label: 'Çiftçi Cari Takibi',
    shortLabel: 'Çiftçi Cari',
    headline: 'Müstahsil veresiye, parçalı tahsilat, yıllık devir ve şifresiz cari paylaşımı',
    summary:
      'Çiftçilerinizin vadeli ilaç, gübre ve tohum alımlarını tek ekrandan takip edin. Nakit, çek, senet ve 15/30/45 gün POS bloke tahsilatlarını birleştirin; sezon sonunda tek onayla bakiyeleri yeni yıla devredin ve WhatsApp üzerinden şifresiz cari ekstre linki gönderin.',
    metrics: [
      { label: 'Tahsilat yapısı', value: 'Nakit • Çek • POS Bloke' },
      { label: 'Sezon geçişi', value: 'Kayıpsız yıllık devir' },
      { label: 'Çiftçi bilgilendirme', value: 'Şifresiz portal + PDF' }
    ],
    icon: Users
  },
  {
    id: 'stok',
    label: 'Depo ve Stok Takibi',
    shortLabel: 'Stok Takibi',
    headline: 'Market barkod tabancası ile hızlı satış, SKT takibi ve onaylı stok sayımı',
    summary:
      'Dükkân tezgâhında barkod okuyucuyla saniyeler içinde peşin veya vadeli çıkış yapın. Kritik stok seviyelerini, son kullanma tarihi yaklaşan ürünleri (FEFO) ve sayım tarihi ile adetlerin mühürlendiği net onaylı stok sayım geçmişini karmaşasız yönetin.',
    metrics: [
      { label: 'Tezgâh hızı', value: 'Barkod tabancası uyumlu' },
      { label: 'Envanter kontrolü', value: 'Tarihli onaylı sayım' },
      { label: 'Raf güvenliği', value: 'Kritik stok ve SKT uyarısı' }
    ],
    icon: Package
  },
  {
    id: 'bkts_gts',
    label: 'BKTS ve GTS Karekod',
    shortLabel: 'BKTS / GTS',
    headline: 'Tarım Bakanlığı uyumlu 2D GS1 karekodlu zirai ilaç ve gübre takibi',
    summary:
      'Fabrikadan veya toptancıdan gelen zirai ilaç (BKTS) ve gübreleri (GTS) telefon kamerası ya da 2D barkod okuyucuyla mal kabule alın. GTIN, parti numarası, seri no ve SKT verilerini otomatik ayrıştırın; aktif maddeye göre eşdeğer ilaçları anında bulun.',
    metrics: [
      { label: 'Bakanlık uyumu', value: 'BKTS • GTS • B-Reçete' },
      { label: 'Karekod okuma', value: 'GS1 DataMatrix 2D' },
      { label: 'Tezgâh desteği', value: 'Aktif madde muadil radarı' }
    ],
    icon: ScanBarcode
  },
  {
    id: 'efatura',
    label: 'EDM e-Fatura ve Kasa',
    shortLabel: 'e-Fatura',
    headline: 'Resmi e-Fatura, e-Arşiv, tedarikçi cari ve kasa-banka mutabakatı',
    summary:
      'Toptancılardan gelen alış e-Faturalarındaki ürünleri tek onayla deponuza ve tedarikçi carinize işleyin. Müşteri ve çiftçilerinize saniyeler içinde resmi e-Fatura veya e-Arşiv fatura kesin; banka, kasa ve çek portföyünüzü tek merkezde tutun.',
    metrics: [
      { label: 'Fatura entegrasyonu', value: 'EDM e-Fatura ve e-Arşiv' },
      { label: 'Alış otomasyonu', value: 'Faturadan otomatik stok' },
      { label: 'Finans kontrolü', value: 'Kasa • Banka • Tedarikçi' }
    ],
    icon: Receipt
  },
  {
    id: 'saha_ek',
    label: 'Ek Saha Araçları',
    shortLabel: 'Ek Araçlar',
    headline: 'Silo kantar mahsubu, zirai hava durumu ve parsel uydu görünümü',
    summary:
      'Temel bayi ve cari yönetiminizi destekleyen yardımcı saha araçları: hububat alımlarında kantar nem/fire mahsubu, ilaçlama rüzgar uygunluğu, uygulama içi TKGM parsel sorgusu ve isteğe bağlı Sentinel-2 tarla gelişim görünümü.',
    metrics: [
      { label: 'Hububat alımı', value: 'Silo ve kantar mahsubu' },
      { label: 'Saha kontrolü', value: 'TKGM sorgu ve parsel' },
      { label: 'Zirai destek', value: 'Hava ve uydu katmanı' }
    ],
    icon: Compass
  }
];

const EASE_CORPORATE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const CorporateShowcaseWebsite: React.FC<CorporateShowcaseProps> = ({
  onOpenAuthModal,
  onOpenPortalTab,
  onOpenSupport
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [activeModule, setActiveModule] = useState<ShowcaseModuleId>('cari');
  const [satLayer, setSatLayer] = useState<SatelliteSubLayer>('NDVI');
  const [isPaused, setIsPaused] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start end', 'center center']
  });

  const stageRotateX = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [5, 0]);
  const stageScale = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [1, 1] : [0.97, 1]);
  const stageOpacity = useTransform(scrollYProgress, [0, 0.45], [0.88, 1]);

  // Auto-advance core tabs cleanly unless hovered/interacted
  useEffect(() => {
    if (isPaused || prefersReducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveModule(prev => {
        const idx = SHOWCASE_MODULES.findIndex(m => m.id === prev);
        return SHOWCASE_MODULES[(idx + 1) % SHOWCASE_MODULES.length].id;
      });
    }, 6400);
    return () => window.clearInterval(timer);
  }, [isPaused, prefersReducedMotion]);

  useEffect(() => {
    if (activeModule !== 'saha_ek' || isPaused || prefersReducedMotion) return;
    const subTimer = window.setInterval(() => {
      setSatLayer(prev => (prev === 'NDVI' ? 'NDMI' : prev === 'NDMI' ? 'SWIR' : 'NDVI'));
    }, 2300);
    return () => window.clearInterval(subTimer);
  }, [activeModule, isPaused, prefersReducedMotion]);

  const currentSpec = SHOWCASE_MODULES.find(m => m.id === activeModule) || SHOWCASE_MODULES[0];

  const renderDesktopScreen = (moduleId: ShowcaseModuleId) => {
    switch (moduleId) {
      case 'cari':
        return (
          <div className="h-[310px] sm:h-[375px] w-full bg-[#090D14] p-4 sm:p-5 flex flex-col justify-between select-none">
            {/* Top Summary Metrics */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Toplam Açık Alacak', val: '₺1.842.500', sub: '118 aktif müstahsil', tone: 'text-white' },
                { label: 'Portföy Çek ve POS Bloke', val: '₺615.000', sub: '4 çek • 3 POS bloke', tone: 'text-emerald-400' },
                { label: '2025 → 2026 Sezon Devri', val: 'Tam Mutabık', sub: 'Önceki yıl arşivi açık', tone: 'text-amber-300' }
              ].map(card => (
                <div key={card.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                  <div className="text-[11px] text-stone-400 truncate">{card.label}</div>
                  <div className={`text-xs sm:text-base font-semibold mt-1 truncate ${card.tone}`}>{card.val}</div>
                  <div className="text-[10px] text-stone-500 mt-0.5 truncate">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Real Farmer Ledger Rows */}
            <div className="space-y-2 my-auto py-2">
              {[
                {
                  name: 'Ahmet Yılmaz • Salça Köyü',
                  detail: 'Vadeli ilaç ve yaprak gübresi reçetesi • Vade: 25 Kasım',
                  balance: '₺128.400,00',
                  badge: 'Portal Linki Gönderildi'
                },
                {
                  name: 'Mehmet Kaya • Akçakale',
                  detail: 'Parçalı tahsilat: ₺45.000 Nakit + ₺80.000 30 Gün POS Bloke',
                  balance: '₺64.500,00',
                  badge: 'Tahsilat İşlendi'
                },
                {
                  name: 'Ali Ayhan • Şahinsoylu',
                  detail: '2025 devir bakiyesi + 2026 pamuk tohum ve gübre çıkışı',
                  balance: '₺214.750,00',
                  badge: 'Kaşeli PDF Hazır'
                }
              ].map((row, idx) => (
                <motion.div
                  key={row.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07, duration: 0.32, ease: EASE_CORPORATE }}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-[13px] font-semibold text-white truncate">{row.name}</div>
                    <div className="text-[11px] text-stone-400 truncate mt-0.5">{row.detail}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-semibold text-white">{row.balance}</div>
                    <div className="text-[10px] font-medium text-emerald-400">{row.badge}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-2 border-t border-white/10">
              <span>Şifresiz Üretici Portalı ile çiftçi kendi bakiyesini görür</span>
              <span className="text-emerald-400 font-medium">Telefon + Bilgisayar anlık senkron</span>
            </div>
          </div>
        );

      case 'stok':
        return (
          <div className="h-[310px] sm:h-[375px] w-full bg-[#090D14] p-4 sm:p-5 flex flex-col justify-between select-none">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div>
                <div className="text-sm font-semibold text-white">Depo Stok Yönetimi ve Onaylı Sayım Kaydı</div>
                <div className="text-[11px] text-stone-400">
                  Son onaylanan sayım: 11 Kasım 2026 • 08:30 — Sayılan 342 kalem ve adetler mühürlendi
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                Market Barkod Tabancası Aktif
              </span>
            </div>

            <div className="space-y-2 my-auto py-2">
              {[
                {
                  name: 'DAP 18-46 Taban Gübresi (50 kg Çuval)',
                  meta: 'Alış: ₺1.180 • Satış: ₺1.340 • Merkez Depo',
                  qty: '420 Çuval',
                  status: 'Sayım Onaylı (11.11.2026)',
                  tone: 'text-emerald-400'
                },
                {
                  name: 'Coragen 20 SC • 200 ml Zirai İlaç',
                  meta: 'Barkod: 8699745120841 • SKT: 09/2028',
                  qty: '48 Adet',
                  status: 'Stok Yeterli',
                  tone: 'text-emerald-400'
                },
                {
                  name: 'Deniz Yosunu + Aminoasit Yaprak Gübresi (1 L)',
                  meta: 'Kritik sınır: 15 Adet • Öncelikli çıkış (FEFO)',
                  qty: '9 Litre',
                  status: 'Kritik Stok Uyarısı',
                  tone: 'text-amber-300'
                }
              ].map((item, idx) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07, duration: 0.32, ease: EASE_CORPORATE }}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-[13px] font-semibold text-white truncate">{item.name}</div>
                    <div className="text-[11px] text-stone-400 truncate mt-0.5">{item.meta}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-semibold text-white">{item.qty}</div>
                    <div className={`text-[10px] font-medium ${item.tone}`}>{item.status}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400">
              <span>Karmaşık defterler yerine net sayım tarihi ve onaylanan adetler</span>
              <span className="text-stone-200 font-medium">Toplam envanter değeri: ₺2.480.600</span>
            </div>
          </div>
        );

      case 'bkts_gts':
        return (
          <div className="h-[310px] sm:h-[375px] w-full bg-[#090D14] p-4 sm:p-5 flex flex-col justify-between select-none">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div>
                <div className="text-sm font-semibold text-white">Tarım Bakanlığı BKTS ve GTS 2D Karekod Merkezi</div>
                <div className="text-[11px] text-stone-400">
                  GS1 DataMatrix karekod ayrıştırma (GTIN, Parti No, Seri No, Son Kullanma Tarihi)
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                BKTS + GTS Hazır
              </span>
            </div>

            <div className="space-y-2 my-auto py-2">
              {[
                {
                  name: 'BKTS Mal Kabul • Amistar Top (1 Litre)',
                  gtin: '08691234009182',
                  lot: 'LOT-8841',
                  skt: '04/2028',
                  qty: '64 Adet',
                  status: 'BKTS Bildirimi Hazır'
                },
                {
                  name: 'GTS Karekod • Üre %46 Granül Gübre',
                  gtin: '08690045771209',
                  lot: 'GTS-9920',
                  skt: '12/2029',
                  qty: '24 Ton',
                  status: 'DNA ve Karekod Doğrulandı'
                },
                {
                  name: 'BKTS Çiftçi Satış • T.C. / Vergi No Eşleşmeli Çıkış',
                  gtin: '08699745120841',
                  lot: 'TR-2604A',
                  skt: '09/2028',
                  qty: '12 Adet',
                  status: 'Reçete ve Cariye İşlendi'
                }
              ].map((row, i) => (
                <motion.div
                  key={row.gtin + i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.34, ease: EASE_CORPORATE }}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-[13px] font-semibold text-white truncate">{row.name}</div>
                    <div className="text-[11px] text-stone-400 font-mono truncate mt-0.5">
                      GTIN {row.gtin} • Parti {row.lot} • SKT {row.skt}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-semibold text-white">{row.qty}</div>
                    <div className="text-[10px] font-medium text-emerald-400">{row.status}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400">
              <span>Aktif maddeye göre anlık eşdeğer / muadil ilaç bulucu</span>
              <span className="text-stone-200 font-medium">Kamera ve el terminali tam uyumlu</span>
            </div>
          </div>
        );

      case 'efatura':
        return (
          <div className="h-[310px] sm:h-[375px] w-full bg-[#090D14] p-4 sm:p-5 flex flex-col justify-between select-none">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div>
                <div className="text-sm font-semibold text-white">EDM e-Fatura, e-Arşiv ve Tedarikçi Cari Entegrasyonu</div>
                <div className="text-[11px] text-stone-400">
                  Gelen alış faturalarından tek tıkla stok girişi ve çiftçi/bayi satışlarında anında resmi fatura
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
                GİB / EDM Bağlantısı Aktif
              </span>
            </div>

            <div className="space-y-2 my-auto py-2">
              {[
                {
                  docNo: 'Gelen e-Fatura • #GIB202600048192',
                  party: 'Toros Tarım Sanayi ve Ticaret A.Ş. → Merkez Depo',
                  amount: '₺468.200,00',
                  state: '14 Kalem Otomatik Stoğa Alındı'
                },
                {
                  docNo: 'Giden e-Arşiv Fatura • #EAR202600011904',
                  party: 'Ahmet Yılmaz (Müstahsil Cari #104) • Zirai İlaç Çıkışı',
                  amount: '₺34.850,00',
                  state: 'Onaylandı ve PDF Gönderildi'
                },
                {
                  docNo: 'Giden Ticari e-Fatura • #EFT202600008341',
                  party: 'Bereket Tarım Ürünleri Ltd. Şti.',
                  amount: '₺142.000,00',
                  state: 'GİB Zarflandı • Cariye İşlendi'
                }
              ].map((inv, idx) => (
                <motion.div
                  key={inv.docNo}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.34, ease: EASE_CORPORATE }}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-[13px] font-semibold text-white truncate">{inv.docNo}</div>
                    <div className="text-[11px] text-stone-400 truncate mt-0.5">{inv.party}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-semibold text-white">{inv.amount}</div>
                    <div className="text-[10px] font-medium text-emerald-400">{inv.state}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400">
              <span>Çoklu depo (Merkez, Şube, Emanet) stok takibi destekli</span>
              <span className="text-stone-200 font-medium">Kasa ve banka hesaplarıyla tam entegre</span>
            </div>
          </div>
        );

      case 'saha_ek': {
        const layerMeta = {
          NDVI: {
            badge: 'Yardımcı Saha Katmanı • NDVI Bitki Gelişimi',
            polyA: 'rgba(16, 185, 129, 0.54)',
            polyB: 'rgba(52, 211, 153, 0.46)',
            stroke: '#34d399'
          },
          NDMI: {
            badge: 'Yardımcı Saha Katmanı • NDMI Sulama Durumu',
            polyA: 'rgba(14, 165, 233, 0.56)',
            polyB: 'rgba(56, 189, 248, 0.46)',
            stroke: '#38bdf8'
          },
          SWIR: {
            badge: 'Yardımcı Saha Katmanı • Çamur ve Tav Kontrolü',
            polyA: 'rgba(20, 184, 166, 0.52)',
            polyB: 'rgba(99, 102, 241, 0.52)',
            stroke: '#2dd4bf'
          }
        }[satLayer];

        return (
          <div className="relative h-[310px] sm:h-[375px] w-full bg-[#081119] overflow-hidden select-none">
            <img
              src="/showcase/aerial-parcel-base.jpg"
              onError={e => {
                (e.currentTarget as HTMLImageElement).src = '/showcase/erp-bkts-silo-showcase.jpg';
              }}
              alt="MKS Yardımcı Saha, Silo ve Parsel Araçları"
              className="absolute inset-0 w-full h-full object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06090E] via-[#06090E]/30 to-[#06090E]/65" />

            <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-10">
              <div className="px-3 py-1.5 rounded-xl bg-[#0A0F17]/90 backdrop-blur-md border border-white/15 text-[11px] text-stone-200">
                <span className="font-semibold text-white">Tamamlayıcı Saha Araçları:</span> Silo Kantar • Hava Durumu • TKGM Parsel
              </div>
              <div className="px-2.5 py-1.5 rounded-xl bg-[#0A0F17]/90 backdrop-blur-md border border-emerald-500/30 text-[11px] font-medium text-emerald-300">
                Silo 1: 840 Ton Buğday (%84)
              </div>
            </div>

            <svg viewBox="0 0 640 340" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid slice">
              <motion.polygon
                points="172,102 317,102 317,174 172,174"
                animate={{ fill: layerMeta.polyA, stroke: layerMeta.stroke }}
                transition={{ duration: 0.5, ease: EASE_CORPORATE }}
                strokeWidth="2.2"
              />
              <motion.polygon
                points="324,102 425,102 425,212 324,212"
                animate={{ fill: layerMeta.polyB, stroke: layerMeta.stroke }}
                transition={{ duration: 0.5, ease: EASE_CORPORATE }}
                strokeWidth="2.2"
              />
              <text x="190" y="138" fill="#ffffff" fontSize="12" fontWeight="700">
                TKGM Ada 142 / Parsel 8
              </text>
              <text x="190" y="155" fill="#ecfdf5" fontSize="10.5" fontWeight="600">
                184.6 Dekar • Çiftçi Kartına Bağlı
              </text>
            </svg>

            <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
              <div className="p-3 rounded-xl bg-[#0A0F17]/92 backdrop-blur-md border border-white/10 max-w-md">
                <div className="text-xs font-semibold text-white">{layerMeta.badge}</div>
                <p className="text-[11px] text-stone-300 mt-0.5">
                  Reçete ve cari takibini destekleyen kantar fişi mahsubu, ilaçlama rüzgar uyarısı ve parsel görünümü.
                </p>
              </div>
              <div className="mks-tab-rail flex items-center gap-1 p-1 rounded-xl bg-[#0A0F17]/95 border border-white/15 self-start sm:self-auto">
                {(
                  [
                    { id: 'NDVI', label: 'NDVI' },
                    { id: 'NDMI', label: 'Sulama' },
                    { id: 'SWIR', label: 'Tav' }
                  ] as const
                ).map(btn => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => {
                      setSatLayer(btn.id);
                      setIsPaused(true);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      satLayer === btn.id ? 'bg-emerald-600 text-white' : 'text-stone-300 hover:text-white'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      }
    }
  };

  const renderMobileScreen = (moduleId: ShowcaseModuleId) => {
    switch (moduleId) {
      case 'cari':
        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                <Bell size={12} /> Vade ve Tahsilat Bildirimi
              </span>
              <span className="text-[10px] text-stone-400">Mobil Cari</span>
            </div>
            {[
              { name: 'Ahmet Yılmaz • Vade hatırlatma', amt: '₺128.400' },
              { name: 'Mehmet Kaya • Tahsilat sözü', amt: '₺64.500' }
            ].map(item => (
              <div
                key={item.name}
                className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-white truncate">{item.name}</div>
                  <div className="text-[10px] text-stone-400">{item.amt}</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold inline-flex items-center gap-1 shrink-0">
                  <Phone size={10} /> Ara
                </span>
              </div>
            ))}
          </div>
        );

      case 'stok':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400">Mobil Hızlı Stok Sayımı</span>
              <span className="text-[10px] text-stone-400">Merkez Depo</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
              <div className="text-xs font-semibold text-white">DAP 18-46 Gübre (50 kg)</div>
              <div className="text-[11px] text-stone-300">Sayılan Adet: 420 Çuval</div>
              <div className="text-[10px] text-emerald-400">11.11.2026 • 08:30 itibarıyla onaylandı</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-center text-xs font-semibold text-emerald-300">
              Sayımı Onayla ve Mühürle
            </div>
          </div>
        );

      case 'bkts_gts':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400">Kamera ile 2D Karekod</span>
              <span className="text-[10px] text-stone-400">BKTS / GTS</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-emerald-500/30 space-y-1.5">
              <div className="text-[11px] text-stone-400">GS1 Karekod Okundu</div>
              <div className="text-xs font-semibold text-white">Amistar Top • 1 Litre</div>
              <div className="text-[10px] font-mono text-emerald-300">GTIN: 08691234009182 • Parti: 8841</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-center text-xs font-semibold text-white">
              Mal Kabul ve Stoğa İşlendi
            </div>
          </div>
        );

      case 'efatura':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400">Mobil e-Fatura / e-Arşiv</span>
              <span className="text-[10px] text-stone-400">EDM Resmi</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
              <div className="text-xs font-semibold text-white">Ahmet Yılmaz • ₺34.850,00</div>
              <div className="text-[11px] text-stone-300">e-Arşiv Fatura #EAR202600011904</div>
              <div className="text-[10px] text-emerald-400">Cari hesaba ve stok çıkışına işlendi</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white text-center text-xs font-semibold">
              Fatura PDF WhatsApp Paylaş
            </div>
          </div>
        );

      case 'saha_ek':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-300">Üretici Portalı ve Kantar</span>
              <span className="text-[10px] text-emerald-400">Ek Özellik</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
              <div className="text-xs font-semibold text-white">63 MKS 214 • Net 28.440 kg</div>
              <div className="text-[11px] text-stone-300">Kantar alımı müstahsil borcundan düşüldü</div>
              <div className="text-[10px] text-emerald-400">İlaçlama havası: 22°C uygun</div>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-center text-xs font-semibold text-white">
              Cari Mahsup Fişini Aç
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#06090E] text-[#F3F5F7] relative overflow-x-clip flex flex-col selection:bg-emerald-500/30 selection:text-white">
      {/* Quiet Architectural Ambient Lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[980px] h-[420px] opacity-30"
          style={{
            background:
              'radial-gradient(ellipse at center top, rgba(16, 185, 129, 0.16) 0%, rgba(14, 165, 233, 0.05) 45%, transparent 75%)'
          }}
        />
      </div>

      {/* ==================== CORPORATE HEADER ==================== */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#06090E]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[70px] flex items-center justify-between gap-3">
          <a href="#ust" className="flex items-center gap-3 min-w-0">
            <MksBrandLogo size="lg" rounded="xl" className="border-emerald-500/25 shadow-md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm sm:text-[15px] tracking-tight truncate">
                  Mühendis Kayıt Sistemi
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium text-stone-400 border border-white/10">
                  Kurumsal v8.2
                </span>
              </div>
              <span className="text-[11px] text-stone-400 hidden md:block truncate">
                Çiftçi cari takibi, depo ve stok yönetimi, BKTS / GTS karekod ve e-Fatura sistemi
              </span>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            <a
              href="#uygulama-ekranlari"
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-300 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Temel modüller
            </a>
            <a
              href="#kurumsal-altyapi"
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-300 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Kurumsal altyapı
            </a>
            <button
              type="button"
              onClick={() => onOpenPortalTab('download')}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-300 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              İndirme merkezi
            </button>
            <button
              type="button"
              onClick={() => onOpenPortalTab('pricing')}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-300 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Paketler
            </button>
            <button
              type="button"
              onClick={onOpenSupport}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-stone-300 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Destek
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuthModal('LOGIN')}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <LogIn size={14} className="text-emerald-400 hidden sm:inline" />
              <span>Giriş yap</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuthModal('REGISTER')}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
            >
              <UserPlus size={14} className="hidden sm:inline" />
              <span>Hesap oluştur</span>
            </button>
          </div>
        </div>
      </header>

      <main id="ust" className="flex-1 relative z-10">
        {/* ==================== 1. ARCHITECTURAL CORPORATE HERO (CORE ERP FIRST) ==================== */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE_CORPORATE }}
            className="max-w-3xl space-y-6"
          >
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-stone-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Zirai ilaç, gübre ve tohum bayileri ile ziraat mühendisleri için 7/24 bulut ve çevrimdışı sistem</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-semibold text-white tracking-[-0.03em] leading-[1.12]">
              Çiftçi cari takibi, depo stok, BKTS, GTS ve e-Fatura tek kurumsal sistemde.
            </h1>

            <p className="text-sm sm:text-lg text-[#94A0B0] leading-relaxed max-w-2xl">
              Müstahsil veresiye ve vadeli tahsilat hesaplarınızı, barkodlu depo ve onaylı stok sayımınızı, Tarım
              Bakanlığı uyumlu BKTS / GTS karekod bildirimlerinizi ve resmi e-Fatura süreçlerinizi telefon, bilgisayar
              ve web üzerinde sıfır veri kaybıyla yönetin.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onOpenAuthModal('LOGIN')}
                className="min-h-[46px] px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all inline-flex items-center gap-2 shadow-lg shadow-emerald-950/40"
              >
                <span>Sisteme giriş yap</span>
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuthModal('REGISTER')}
                className="min-h-[46px] px-5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 text-white text-sm font-semibold transition-colors"
              >
                Yeni kurumsal hesap aç
              </button>
              <button
                type="button"
                onClick={() => onOpenPortalTab('download')}
                className="min-h-[46px] px-4 py-3 rounded-xl text-stone-300 hover:text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                <Download size={16} className="text-emerald-400" />
                <span>Masaüstü ve mobil indir</span>
              </button>
            </div>
          </motion.div>
        </section>

        {/* ==================== 2. ANIMATED MULTI-DEVICE APP SHOWCASE STAGE ==================== */}
        <section
          id="uygulama-ekranlari"
          ref={stageRef}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24"
          style={{ perspective: 1400 }}
        >
          {/* Module Selector Rail with Animated Spring Pill */}
          <div
            className="mks-tab-rail flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0D1219] border border-white/[0.08] mb-6"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {SHOWCASE_MODULES.map(mod => {
              const Icon = mod.icon;
              const isActive = mod.id === activeModule;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setActiveModule(mod.id);
                    setIsPaused(true);
                  }}
                  className={`relative min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-[13px] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    isActive ? 'text-white' : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="mks-corporate-tab-pill"
                      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-white/[0.09] border border-white/15"
                    />
                  )}
                  <Icon size={15} className={`relative z-10 ${isActive ? 'text-emerald-400' : 'text-stone-500'}`} />
                  <span className="relative z-10 hidden sm:inline">{mod.label}</span>
                  <span className="relative z-10 sm:hidden">{mod.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Scroll-Linked 3D Corporate Product Frame */}
          <motion.div
            style={{
              rotateX: stageRotateX,
              scale: stageScale,
              opacity: stageOpacity
            }}
            className="rounded-3xl bg-[#0D1219] border border-white/[0.09] p-4 sm:p-6 lg:p-8 shadow-[0_32px_90px_rgba(0,0,0,0.65)]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* Desktop Application Window (8 cols) */}
              <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-white/10 bg-[#06090E]">
                {/* Window Chrome */}
                <div className="h-10 px-4 bg-[#0B1018] border-b border-white/[0.07] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <MksBrandLogo size="xs" rounded="lg" />
                    <span className="text-[11px] text-stone-400 font-medium truncate">
                      MKS Kurumsal Masaüstü ve Web — {currentSpec.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium shrink-0">Canlı Senkron</span>
                </div>

                {/* Animated Screen Body */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeModule}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.36, ease: EASE_CORPORATE }}
                  >
                    {renderDesktopScreen(activeModule)}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Synchronized Mobile iPhone Preview + Module Spec (4 cols) */}
              <div className="lg:col-span-4 flex flex-col justify-between space-y-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`desc-${activeModule}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.32, ease: EASE_CORPORATE }}
                    className="space-y-2.5"
                  >
                    <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-snug">
                      {currentSpec.headline}
                    </h2>
                    <p className="text-xs sm:text-[13px] text-[#94A0B0] leading-relaxed">{currentSpec.summary}</p>
                  </motion.div>
                </AnimatePresence>

                {/* Synchronized iPhone Frame */}
                <div className="rounded-[26px] p-3.5 bg-[#080C12] border border-white/15 shadow-xl">
                  <div className="w-16 h-1 rounded-full bg-white/15 mx-auto mb-3" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`mob-${activeModule}`}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.34, ease: EASE_CORPORATE }}
                    >
                      {renderMobileScreen(activeModule)}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* 3 Key Module Facts */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {currentSpec.metrics.map(m => (
                    <div key={m.label} className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                      <div className="text-[10px] text-stone-400 truncate">{m.label}</div>
                      <div className="text-[11px] font-semibold text-white mt-0.5 truncate">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ==================== 2B. CORE 4 PILLARS SCREEN GALLERY ==================== */}
          <div className="mt-14 sm:mt-20 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                  İşletmenizin dört ana omurgası
                </h2>
                <p className="text-xs sm:text-sm text-[#94A0B0] mt-1">
                  Çiftçi cari hesaplarından depo stok sayımına, Bakanlık BKTS/GTS karekodundan resmi e-Fatura’ya kadar temel ekranlar.
                </p>
              </div>
              <span className="text-xs text-stone-400">Canlı önizleme için modül kartına dokunun</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Core Card 1: Çiftçi Cari Takibi */}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: EASE_CORPORATE }}
                onClick={() => {
                  setActiveModule('cari');
                  setIsPaused(true);
                  stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="group text-left rounded-2xl bg-[#0D1219] border border-white/[0.08] hover:border-emerald-500/35 overflow-hidden transition-colors"
              >
                <div className="h-52 p-4 bg-[#080C12] border-b border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">Müstahsil Cari Portföy ve Tahsilat</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                      Yıllık Devir Garantili
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">Ahmet Yılmaz • Salça Köyü</div>
                        <div className="text-[10px] text-stone-400">Vadeli reçete + gübre çıkışı • Vade: 25 Kas</div>
                      </div>
                      <span className="font-semibold text-amber-300">₺128.400</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">Mehmet Kaya • Parçalı Tahsilat</div>
                        <div className="text-[10px] text-stone-400">Nakit + 30 Gün POS Bloke + Çek</div>
                      </div>
                      <span className="font-semibold text-emerald-400">Tahsil Edildi</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-stone-400 flex justify-between">
                    <span>Kaşeli PDF cari mutabakat</span>
                    <span className="text-emerald-400 font-medium">Şifresiz Üretici Portalı linki</span>
                  </div>
                </div>
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">1. Çiftçi Cari Takibi, Vade ve Sezon Devri</h3>
                    <p className="text-xs text-[#94A0B0] mt-1">
                      Veresiye satış, parçalı tahsilat, POS bloke takvimi, vade hatırlatmaları ve kayıpsız yıllık bakiye devri.
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-stone-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
                </div>
              </motion.button>

              {/* Core Card 2: Depo & Stok Takibi */}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: 0.06, ease: EASE_CORPORATE }}
                onClick={() => {
                  setActiveModule('stok');
                  setIsPaused(true);
                  stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="group text-left rounded-2xl bg-[#0D1219] border border-white/[0.08] hover:border-emerald-500/35 overflow-hidden transition-colors"
              >
                <div className="h-52 p-4 bg-[#080C12] border-b border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Depo Stok ve Barkodlu Hızlı Satış</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-stone-200 text-[10px] font-medium">
                      Sayım: 11.11.2026 Onaylı
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[10px] text-stone-400">Aktif Ürün</div>
                      <div className="text-xs font-semibold text-white mt-0.5">342 Kalem</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[10px] text-stone-400">Kritik Stok</div>
                      <div className="text-xs font-semibold text-amber-300 mt-0.5">7 Ürün</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-[10px] text-stone-400">Barkod Modu</div>
                      <div className="text-xs font-semibold text-emerald-400 mt-0.5">Hazır</div>
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-200 font-medium">Stok sayımı onaylandığında tarih ve adetler net kaydedilir</span>
                    <span className="text-emerald-400 font-semibold">FEFO Aktif</span>
                  </div>
                </div>
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">2. Depo Stok Takibi, Barkod ve Onaylı Sayım</h3>
                    <p className="text-xs text-[#94A0B0] mt-1">
                      Market barkod tabancası ile hızlı çıkış, SKT/kritik stok kontrolü ve şeffaf onaylı sayım geçmişi.
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-stone-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
                </div>
              </motion.button>

              {/* Core Card 3: BKTS & GTS */}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: 0.12, ease: EASE_CORPORATE }}
                onClick={() => {
                  setActiveModule('bkts_gts');
                  setIsPaused(true);
                  stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="group text-left rounded-2xl bg-[#0D1219] border border-white/[0.08] hover:border-emerald-500/35 overflow-hidden transition-colors"
              >
                <div className="h-52 p-4 bg-[#080C12] border-b border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Tarım Bakanlığı BKTS ve GTS Karekod</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                      GS1 DataMatrix 2D
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">BKTS • Coragen 20 SC (200 ml)</div>
                        <div className="text-[10px] font-mono text-stone-400">GTIN 08699745120841 • Parti TR-2604A</div>
                      </div>
                      <span className="font-semibold text-emerald-400">48 Adet</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">GTS • Üre %46 Granül Gübre</div>
                        <div className="text-[10px] font-mono text-stone-400">GTIN 08690045771209 • Parti GTS-9920</div>
                      </div>
                      <span className="font-semibold text-white">24 Ton</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-stone-400 flex justify-between">
                    <span>Aktif maddeye göre muadil ilaç bulucu</span>
                    <span className="text-emerald-400 font-medium">Mal kabul + Satış bildirimi</span>
                  </div>
                </div>
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">3. BKTS ve GTS 2D Karekod Entegrasyonu</h3>
                    <p className="text-xs text-[#94A0B0] mt-1">
                      Zirai ilaç ve gübrelerde GTIN, parti no ve SKT ayrıştırma, B-Reçete uyumu ve eşdeğer ilaç radarı.
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-stone-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
                </div>
              </motion.button>

              {/* Core Card 4: EDM e-Fatura & Kasa */}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: 0.18, ease: EASE_CORPORATE }}
                onClick={() => {
                  setActiveModule('efatura');
                  setIsPaused(true);
                  stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="group text-left rounded-2xl bg-[#0D1219] border border-white/[0.08] hover:border-emerald-500/35 overflow-hidden transition-colors"
              >
                <div className="h-52 p-4 bg-[#080C12] border-b border-white/[0.06] flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">EDM e-Fatura, e-Arşiv ve Kasa-Banka</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold">
                      Resmi Entegrasyon
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                      <div className="text-[10px] text-stone-400">Gelen Alış e-Faturası</div>
                      <div className="text-xs font-semibold text-white">₺468.200 • Toros Tarım</div>
                      <div className="text-[10px] text-emerald-400">Tek tıkla stoğa işlendi</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
                      <div className="text-[10px] text-stone-400">Kesilen e-Fatura / e-Arşiv</div>
                      <div className="text-xs font-semibold text-white">GİB Onaylı Çıkış</div>
                      <div className="text-[10px] text-amber-300">Cari ve KDV tam uyumlu</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-stone-400 flex justify-between">
                    <span>Tedarikçi cari ve çek ciro takibi</span>
                    <span className="text-stone-200 font-medium">Çoklu depo yönetimi</span>
                  </div>
                </div>
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">4. EDM e-Fatura, Tedarikçi Cari ve Kasa</h3>
                    <p className="text-xs text-[#94A0B0] mt-1">
                      Alış faturalarından otomatik ürün girişi, resmi e-Fatura/e-Arşiv kesimi ve günlük kasa-banka kontrolü.
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-stone-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
                </div>
              </motion.button>
            </div>
          </div>

          {/* ==================== 2C. SECONDARY / SUPPORTING TOOLS (SECOND PLAN) ==================== */}
          <div className="mt-10 pt-8 border-t border-white/[0.06]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <span className="text-xs font-semibold text-stone-300">
                Tamamlayıcı saha ve işletme araçları (isteğe bağlı ek modüller)
              </span>
              <span className="text-[11px] text-stone-500">
                Ana cari, stok, BKTS/GTS ve fatura akışınızı bozmadan arka planda destekler
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {[
                {
                  icon: Smartphone,
                  title: 'Şifresiz Üretici Portalı',
                  desc: 'Çiftçiye WhatsApp linki atın; uygulama kurmadan güncel borcunu ve aldığı ürünleri görsün, ödeme bildirsin.'
                },
                {
                  icon: Wheat,
                  title: 'Hububat Silo ve Kantar Mahsubu',
                  desc: 'Sezon sonunda çiftçiden alınan buğday, mısır ve pamuk tonajını nem firesiyle hesaplayıp ilaç borcundan düşün.'
                },
                {
                  icon: Compass,
                  title: 'Zirai Hava Durumu ve Tarla Haritası',
                  desc: 'Saha ziyaretlerinde ilaçlama rüzgar uygunluğu, uygulama içi TKGM parsel sorgusu ve yardımcı uydu görünümü.'
                }
              ].map(extra => {
                const ExtraIcon = extra.icon;
                return (
                  <div
                    key={extra.title}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3"
                  >
                    <div className="p-2 rounded-xl bg-white/[0.04] text-stone-300 shrink-0">
                      <ExtraIcon size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-stone-200">{extra.title}</h3>
                      <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">{extra.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== 3. EDITORIAL CORPORATE ARCHITECTURE & FIELD VISUALS ==================== */}
        <section
          id="kurumsal-altyapi"
          className="border-t border-white/[0.07] bg-[#080C13] py-20 sm:py-24"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, ease: EASE_CORPORATE }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
            >
              <div className="lg:col-span-6 space-y-5">
                <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-[-0.025em] leading-tight">
                  Telefondan girdiğiniz tahsilat ve stok kaydı, ofisteki bilgisayarınızda saniyesinde hazır.
                </h2>
                <p className="text-sm sm:text-base text-[#94A0B0] leading-relaxed">
                  Dükkân bilgisayarınız kapalıyken bile cep telefonunuzdan cari tahsilat girebilir, karekod okutabilir
                  veya reçete kesebilirsiniz. İnternetin çekmediği depoda ya da köyde yapılan her işlem cihazda korunur,
                  bağlantı geldiği anda hesabınıza kayıpsız eşitlenir.
                </p>

                <div className="space-y-3 pt-2">
                  {[
                    {
                      icon: CloudOff,
                      title: 'Sıfır veri kaybı ve çevrimdışı çalışma garantisi',
                      desc: 'İnternet kesilse bile satış, tahsilat ve stok sayımı durmaz; tüm cihazlarınız tek hesapta anında senkronize olur.'
                    },
                    {
                      icon: RefreshCw,
                      title: 'Tertemiz yeni hesap ve kusursuz yıllık sezon devri',
                      desc: 'Hesap açtığınızda örnek veri karmaşası olmadan temiz başlarsınız; yıl sonunda bakiyeler yeni sezona toplu devredilir.'
                    },
                    {
                      icon: Wallet,
                      title: 'Vade, çek/senet ve aranacaklar bildirim merkezi',
                      desc: 'Vadesi gelen müstahsil alacakları, çek-senetler ve günlük aranacak çiftçi listesi telefon ve masaüstü bildirimiyle hatırlatılır.'
                    }
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="p-4 rounded-2xl bg-[#0D1219] border border-white/[0.07] flex items-start gap-3.5"
                      >
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                          <Icon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                          <p className="text-xs text-[#94A0B0] mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-4">
                <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#0D1219] shadow-2xl">
                  <div className="aspect-[16/10] relative overflow-hidden bg-[#06090E]">
                    <img
                      src="/showcase/corporate-agtech-hero.jpg"
                      onError={e => {
                        (e.currentTarget as HTMLImageElement).src = '/showcase/erp-bkts-silo-showcase.jpg';
                      }}
                      alt="MKS Zirai Bayi ve Mühendis Kurumsal Yönetim Sistemi"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#06090E] via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-[#0A0F17]/90 backdrop-blur-md border border-white/10 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs sm:text-sm font-semibold text-white">
                          Dükkân, Depo ve Sahada Tek Kurumsal Hesap
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          Çiftçi cari • Depo stok • BKTS / GTS karekod • EDM e-Fatura
                        </div>
                      </div>
                      <ShieldCheck size={22} className="text-emerald-400 shrink-0" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-[#0D1219] border border-white/[0.07]">
                    <div className="text-lg sm:text-2xl font-semibold text-white">4 Platform</div>
                    <div className="text-[11px] text-stone-400 mt-1">Windows, Android, iOS, Web</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0D1219] border border-white/[0.07]">
                    <div className="text-lg sm:text-2xl font-semibold text-emerald-400">7/24 Aktif</div>
                    <div className="text-[11px] text-stone-400 mt-1">Bulut + Çevrimdışı Senkron</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#0D1219] border border-white/[0.07]">
                    <div className="text-lg sm:text-2xl font-semibold text-white">Tam Uyum</div>
                    <div className="text-[11px] text-stone-400 mt-1">Cari • Stok • BKTS/GTS • Fatura</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ==================== 4. MULTI-PLATFORM DOWNLOAD & DIRECT ACCESS ==================== */}
        <section className="border-t border-white/[0.07] py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2 max-w-xl">
                <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                  Tüm cihazlarınızda aynı kurumsal hesapla çalışın.
                </h2>
                <p className="text-sm text-[#94A0B0]">
                  Dükkânda Windows masaüstü programından, depoda ve sahada cep telefonunuzdan veya doğrudan tarayıcıdan erişin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenPortalTab('pricing')}
                className="min-h-[42px] px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white self-start sm:self-auto transition-colors"
              >
                Kurumsal paketleri karşılaştır
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a
                href="/downloads/MKS_Masaustu_Kurulum.exe"
                download="MKS_Masaustu_Kurulum.exe"
                className="p-5 rounded-2xl bg-[#0D1219] hover:bg-[#121923] border border-white/[0.08] transition-colors flex flex-col justify-between gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] text-white flex items-center justify-center">
                  <Monitor size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Windows Masaüstü</div>
                  <div className="text-xs text-stone-400 mt-1">Windows 10 ve 11 için tek tık kurulum ve canlı güncelleme (.exe)</div>
                </div>
                <span className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5">
                  <Download size={14} /> Masaüstüne indir
                </span>
              </a>

              <a
                href="/downloads/MKS_Android.apk"
                download="MKS_Android.apk"
                className="p-5 rounded-2xl bg-[#0D1219] hover:bg-[#121923] border border-white/[0.08] transition-colors flex flex-col justify-between gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] text-white flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Android Mobil</div>
                  <div className="text-xs text-stone-400 mt-1">Telefon ve tabletler için imzalı v8.2 paketi (.apk)</div>
                </div>
                <span className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5">
                  <Download size={14} /> Telefona indir
                </span>
              </a>

              <button
                type="button"
                onClick={() => onOpenPortalTab('ios_guide')}
                className="p-5 rounded-2xl bg-[#0D1219] hover:bg-[#121923] border border-white/[0.08] transition-colors flex flex-col justify-between gap-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] text-white flex items-center justify-center">
                  <Apple size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">iPhone ve iPad (iOS)</div>
                  <div className="text-xs text-stone-400 mt-1">Tam ekran iOS kurulumu ve bildirim aktivasyonu</div>
                </div>
                <span className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5">
                  Kurulum adımlarını aç <ArrowRight size={14} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAuthModal('LOGIN')}
                className="p-5 rounded-2xl bg-emerald-950/25 hover:bg-emerald-950/40 border border-emerald-500/30 transition-colors flex flex-col justify-between gap-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <FileCheck2 size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Doğrudan Web Girişi</div>
                  <div className="text-xs text-stone-300 mt-1">Kurulum yapmadan tarayıcı üzerinden anında oturum açın</div>
                </div>
                <span className="text-xs font-semibold text-emerald-300 inline-flex items-center gap-1.5">
                  Sisteme giriş yap <ArrowRight size={14} />
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ==================== CORPORATE FOOTER ==================== */}
      <footer className="border-t border-white/[0.07] py-8 px-4 sm:px-6 lg:px-8 text-xs text-stone-500 relative z-10 bg-[#05080D]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <MksBrandLogo size="sm" rounded="lg" />
            <span className="text-stone-400">
              &copy; 2026 Mühendis Kayıt Sistemi (MKS) • Kurumsal Sürüm v8.2.0 • Tüm hakları saklıdır.
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-stone-400">
            <button type="button" onClick={() => onOpenAuthModal('LOGIN')} className="hover:text-white transition-colors">
              Giriş yap
            </button>
            <button type="button" onClick={() => onOpenPortalTab('download')} className="hover:text-white transition-colors">
              İndirme merkezi
            </button>
            <button type="button" onClick={() => onOpenPortalTab('ios_guide')} className="hover:text-white transition-colors">
              iOS kurulum
            </button>
            <button type="button" onClick={onOpenSupport} className="hover:text-white transition-colors inline-flex items-center gap-1">
              <Headphones size={13} /> Canlı destek
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

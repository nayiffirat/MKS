import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { MksBrandLogo } from './MksBrandLogo';
import {
  ShieldCheck,
  Download,
  Monitor,
  Smartphone,
  Apple,
  CheckCircle2,
  Lock,
  Sparkles,
  ScanBarcode,
  Database,
  Crown,
  ArrowRight,
  Copy,
  Check,
  MessageCircle,
  Globe,
  Cpu,
  Layers,
  ExternalLink,
  Share2,
  X,
  Zap,
  Award,
  QrCode
} from 'lucide-react';
import {
  getSubscriptionPlans,
  getFeatureMatrix,
  MKS_FEATURE_CATALOG,
  SubscriptionTierId,
  BillingPeriod,
  purchaseSubscriptionPlan,
  syncSubscriptionConfigFromCloud
} from '../utils/subscriptionManager';
import { useBackHandler, useScrollLock } from '../utils/navigationManager';

export const WebLandingPortal: React.FC<{
  mode?: 'modal' | 'fullscreen_gate';
  currentTier?: SubscriptionTierId;
  initialTab?: 'overview' | 'download' | 'pricing' | 'ios_guide' | 'showcase';
  onClose?: () => void;
  onGoToLogin?: (mode?: 'LOGIN' | 'REGISTER') => void;
  onOpenSupport?: (category?: 'general' | 'subscription' | 'password_reset' | 'bkst_gts', prefill?: string) => void;
  onTierUpgraded?: (newTier: SubscriptionTierId) => void;
}> = ({
  mode = 'modal',
  currentTier = 'PRO',
  initialTab = 'download',
  onClose,
  onGoToLogin,
  onOpenSupport,
  onTierUpgraded
}) => {
  const normalizedInitTab = initialTab === 'showcase' ? 'overview' : initialTab;
  const [activeTab, setActiveTab] = useState<'overview' | 'download' | 'pricing' | 'ios_guide'>(normalizedInitTab);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [DeferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [purchasingTier, setPurchasingTier] = useState<SubscriptionTierId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [plans, setPlans] = useState(() => getSubscriptionPlans());
  const [featureMatrix, setFeatureMatrix] = useState(() => getFeatureMatrix());

  const officialSiteUrl = 'https://www.muhendiskayitsistemi.com.tr';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : officialSiteUrl;
  const windowsExeUrl = `${currentOrigin}/downloads/MKS_Masaustu_Kurulum.exe`;
  const androidApkUrl = `${currentOrigin}/downloads/MKS_Android.apk`;
  const googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.nayiffirat.muhendiskayitsistemi';

  useBackHandler(mode === 'modal' && !!onClose, () => onClose?.(), 'web_landing_portal', 85);
  useScrollLock(mode === 'modal');

  useEffect(() => {
    setActiveTab(initialTab === 'showcase' ? 'overview' : initialTab);
  }, [initialTab]);

  useEffect(() => {
    syncSubscriptionConfigFromCloud().then(() => {
      setPlans(getSubscriptionPlans());
      setFeatureMatrix(getFeatureMatrix());
    });
    const refreshMatrix = () => {
      setPlans(getSubscriptionPlans());
      setFeatureMatrix(getFeatureMatrix());
    };
    window.addEventListener('mks-subscription-matrix-updated', refreshMatrix);
    return () => window.removeEventListener('mks-subscription-matrix-updated', refreshMatrix);
  }, []);

  useEffect(() => {
    QRCode.toDataURL(officialSiteUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#052e16', light: '#ffffff' }
    })
      .then(url => setQrDataUrl(url))
      .catch(() => {});

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleSubscribeClick = async (tier: SubscriptionTierId) => {
    setPurchasingTier(tier);
    setStatusMessage(null);

    const period: BillingPeriod = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
    const purchasedInStore = await purchaseSubscriptionPlan(tier, period, (plan, per) => {
      const price = per === 'YEARLY' ? plan.yearlyPriceTRY : plan.monthlyPriceTRY;
      const periodLabel = per === 'YEARLY' ? 'Yıllık' : 'Aylık';
      onOpenSupport?.(
        'subscription',
        `Merhaba Fırat Bey, ${plan.name} (${periodLabel} - ${price.toLocaleString('tr-TR')} TL) paketini aktif etmek istiyorum.`
      );
    });

    setPurchasingTier(null);
    if (purchasedInStore) {
      onTierUpgraded?.(tier);
      setStatusMessage(`${tier} paketiniz başarıyla aktifleştirildi!`);
    }
  };

  return (
    <div
      className={`${
        mode === 'modal'
          ? 'fixed inset-0 z-[110] bg-black/80 backdrop-blur-xl flex items-center justify-center p-2 sm:p-5 overflow-y-auto'
          : 'min-h-screen bg-stone-950 text-stone-100 flex flex-col'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`w-full ${
          mode === 'modal'
            ? 'max-w-6xl bg-stone-950 border border-white/10 rounded-[28px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col'
            : 'max-w-7xl mx-auto flex-1 flex flex-col p-4 sm:p-8'
        }`}
      >
        {/* Top Navigation Bar */}
        <div className="px-4 sm:px-7 py-3.5 bg-stone-900/95 border-b border-white/10 space-y-3 sticky top-0 z-20 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <MksBrandLogo size="md" rounded="xl" className="border-emerald-500/30" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-white text-sm sm:text-base tracking-tight truncate">
                    Mühendis Kayıt Sistemi
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-stone-400 border border-white/10 shrink-0">
                    <Globe size={11} /> muhendiskayitsistemi.com.tr
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 truncate">
                  Web, Windows masaüstü, iOS ve Android kurulum merkezi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onGoToLogin && (
                <button
                  type="button"
                  onClick={() => onGoToLogin('LOGIN')}
                  className="min-h-[40px] px-3 sm:px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ArrowRight size={14} />
                  <span className="hidden sm:inline">Giriş yap</span>
                </button>
              )}
              {onOpenSupport && (
                <button
                  type="button"
                  onClick={() => onOpenSupport('general')}
                  className="hidden sm:flex min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-white/10 text-xs font-semibold items-center gap-1.5 transition-colors"
                >
                  <MessageCircle size={14} />
                  <span>Destek</span>
                </button>
              )}
              {onClose && (
                <button
                  type="button"
                  data-mks-modal-close="true"
                  onClick={onClose}
                  aria-label="Kapat"
                  className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile-Safe Scrollable Navigation Rail (Zero 390px Overflow) */}
          <div className="mks-tab-rail flex items-center gap-1.5 bg-stone-950 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: 'overview', label: 'Özellikler', icon: Layers },
              { id: 'download', label: 'Uygulamayı indir', icon: Download },
              { id: 'pricing', label: 'Paketler', icon: Crown },
              { id: 'ios_guide', label: 'iOS kurulumu', icon: Apple }
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`shrink-0 min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'text-stone-400 hover:text-white hover:bg-stone-900'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fullscreen Gate Banner when Web or Desktop access is disabled for the user's current plan */}
        {mode === 'fullscreen_gate' && (
          <div className="mx-4 sm:mx-7 mt-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-stone-900 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="text-white font-bold text-sm sm:text-base">
                  Web Yönetim Paneli ve Masaüstü Kasa Modu Seçili Paketlere Özeldir
                </h2>
                <p className="text-stone-300 text-xs sm:text-sm mt-0.5">
                  Mevcut paketinizde Web ve Masaüstü erişimi kapalıdır. Reklamsız kullanım, Bilgisayar/Web Yönetim
                  Paneli, Market Barkod Tabancası ve BKTS/GTS entegrasyonunu açmak için{' '}
                  <strong className="text-emerald-400">ULTRA / MAX</strong> paketine geçiş yapabilirsiniz.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs whitespace-nowrap transition-all shrink-0"
            >
              Paketleri İncele
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-8">
          {statusMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center justify-between">
              <span>{statusMessage}</span>
              <button onClick={() => setStatusMessage(null)} className="text-xs underline">
                Kapat
              </button>
            </div>
          )}

          {/* TAB 1: DOWNLOAD & INSTALL CENTER */}
          {activeTab === 'download' && (
            <div className="space-y-7">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  4 PLATFORMDA TEK MERKEZ • SIFIR VERİ KAYBI
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  MKS Uygulamasını Cihazınıza İndirin veya Yükleyin
                </h1>
                <p className="text-stone-400 text-xs sm:text-sm">
                  İster doğrudan kurulum dosyasını indirin, ister indirme bağlantısını kopyalayıp paylaşın, isterseniz
                  telefon kameranızla QR kodu okutarak saniyeler içinde kurun.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* CARD 1: WINDOWS DESKTOP (.EXE) */}
                <div className="bg-stone-900/90 border border-white/10 hover:border-emerald-500/40 rounded-3xl p-6 flex flex-col justify-between transition-all shadow-xl">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-13 h-13 p-3.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        <Monitor size={26} />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        Windows 10 / 11 (.EXE)
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">Windows Masaüstü Uygulaması</h3>
                      <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                        Dükkân ve kasa bilgisayarları için tam ekran masaüstü uygulaması. Market tipi{' '}
                        <strong className="text-stone-200">USB / Kablosuz 1D & 2D Barkod Tabancaları</strong> ile
                        sürücüsüz Tak-Çalıştır uyumludur.
                      </p>
                    </div>
                    <ul className="space-y-1.5 text-xs text-stone-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Market Barkod Tabancası (Otomatik Sepete Ekleme)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>A4 Reçete, Ekstre ve Termal Barkod Yazıcı Uyumu</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>BKTS & GTS Toplu Karekod Aktarım Köprüsü</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-6 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href="/downloads/MKS_Masaustu_Kurulum.exe"
                        download="MKS_Masaustu_Kurulum.exe"
                        className="py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-950/60 transition-all text-center"
                      >
                        <Download size={15} />
                        <span>Direkt İndir (.EXE)</span>
                      </a>
                      <a
                        href="/downloads/MKS_Masaustu_Kurulum.zip"
                        download="MKS_Masaustu_Kurulum.zip"
                        className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all text-center"
                      >
                        <Download size={15} />
                        <span>Sıkıştırılmış İndir (.ZIP)</span>
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink('win', windowsExeUrl)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-300 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        {copiedId === 'win' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copiedId === 'win' ? 'Link Kopyalandı!' : 'İndirme Linkini Kopyala'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* CARD 2: ANDROID (.APK & GOOGLE PLAY) */}
                <div className="bg-stone-900/90 border border-emerald-500/30 rounded-3xl p-6 flex flex-col justify-between transition-all shadow-xl relative overflow-hidden">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-13 h-13 p-3.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Smartphone size={26} />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Android Telefon & Tablet
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">Android Mobil Uygulaması</h3>
                      <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                        Tarlada, depoda ve dükkânda telefon kamerasıyla ilaç/gübre karekodu, alış faturası ve bitki
                        hastalığı okuyan çevrimdışı destekli Android uygulaması.
                      </p>
                    </div>
                    <ul className="space-y-1.5 text-xs text-stone-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Kamera ile 1D Barkod ve 2D BKTS/GTS Karekod Okuma</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Kenardan Parmakla Geri Kaydırma & 3 Tuş Tam Uyumu</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>İnternet Çekmeyen Tarlada Offline-First Çalışma</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-6 space-y-2.5">
                    <a
                      href={googlePlayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all"
                    >
                      <ExternalLink size={16} />
                      <span>Google Play Mağazasından İndir</span>
                    </a>
                    <div className="flex gap-2">
                      <a
                        href="/downloads/MKS_Android.apk"
                        download="MKS_Android.apk"
                        className="flex-1 py-2.5 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-200 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Download size={14} className="text-emerald-400" />
                        <span>Direkt APK İndir</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink('android', androidApkUrl)}
                        className="py-2.5 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-300 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                      >
                        {copiedId === 'android' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copiedId === 'android' ? 'Kopyalandı' : 'Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* CARD 3: iOS (iPHONE & iPAD) */}
                <div className="bg-stone-900/90 border border-white/10 hover:border-purple-500/40 rounded-3xl p-6 flex flex-col justify-between transition-all shadow-xl">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-13 h-13 p-3.5 rounded-2xl bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        <Apple size={26} />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        iPhone & iPad (iOS)
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">iOS (iPhone & iPad) Uygulaması</h3>
                      <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                        iPhone ve iPad cihazlarınızda tam ekran (Safari adres çubuğu olmadan) çalışan, kamera ile barkod
                        ve yaprak tarayan yerel iOS uygulaması ve Xcode paketi.
                      </p>
                    </div>
                    <ul className="space-y-1.5 text-xs text-stone-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>1. Yöntem: Saniyeler İçinde Ana Ekrana Tam Ekran Kurulum</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>iPhone Kamera Barkod, Fatura OCR & Dynamic Island Uyumu</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Apple StoreKit & Bulut Xcode (.IPA) Paket Desteği</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-6 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ios_guide')}
                      className="w-full py-3.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950/60 transition-all"
                    >
                      <Apple size={16} />
                      <span>iPhone / iPad'e Tek Tıkla Yükle</span>
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink('ios', officialSiteUrl)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-300 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        {copiedId === 'ios' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copiedId === 'ios' ? 'iOS Linki Kopyalandı!' : 'iOS Kurulum Linkini Kopyala'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code & Direct Web Link Banner */}
              <div className="bg-stone-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                    <QrCode size={15} />
                    <span>TELEFON KAMERASIYLA ANINDA KURULUM</span>
                  </div>
                  <h4 className="text-white font-bold text-base sm:text-lg">
                    Telefonunuzun Kamerasını Yandaki QR Koda Tutun
                  </h4>
                  <p className="text-stone-400 text-xs max-w-xl">
                    Resmi web adresimiz{' '}
                    <span className="text-emerald-400 font-mono font-semibold">
                      https://www.muhendiskayitsistemi.com.tr
                    </span>{' '}
                    üzerinden hem uygulamayı indirebilir hem de PRO/ULTRA/MAX hesabınızla Web Yönetim Paneline doğrudan
                    giriş yapabilirsiniz.
                  </p>
                </div>
                {qrDataUrl && (
                  <div className="p-3 bg-white rounded-2xl shadow-xl shrink-0">
                    <img src={qrDataUrl} alt="MKS QR Code" className="w-28 h-28" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & SUBSCRIPTION TIERS (PRO REKLAMLI / ULTRA REKLAMSIZ / MAX REKLAMSIZ) */}
          {activeTab === 'pricing' && (
            <div className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-3">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  PRO (REKLAMLI) • ULTRA (%100 REKLAMSIZ) • MAX KURUMSAL (%100 REKLAMSIZ)
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  İşletmenize Uygun MKS Paketini Seçin
                </h2>
                <p className="text-stone-400 text-xs sm:text-sm">
                  PRO sürümü reklam destekli ekonomik pakettir. %100 Reklamsız kullanım, Web/Masaüstü Kasa erişimi,
                  Tarım Bakanlığı (BKTS/GTS) ve Sınırsız Zirai Yapay Zeka için ULTRA veya MAX paketinizi seçin.
                </p>

                {/* Monthly / Yearly Toggle */}
                <div className="inline-flex items-center p-1.5 rounded-2xl bg-stone-900 border border-white/10 mt-2">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    Aylık Abonelik
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      billingCycle === 'yearly'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-stone-400 hover:text-white'
                    }`}
                  >
                    <span>Yıllık Abonelik</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-stone-950 font-black">
                      2 AY BEDAVA (%25 AVANTAJ)
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {plans.map(plan => {
                  const tierKey = plan.id;
                  const isCurrent = currentTier === tierKey;
                  const price = billingCycle === 'yearly' ? plan.yearlyPriceTRY : plan.monthlyPriceTRY;
                  const monthlyEquivalent =
                    billingCycle === 'yearly' ? Math.round(plan.yearlyPriceTRY / 12) : plan.monthlyPriceTRY;

                  const borderClass =
                    tierKey === 'MAX'
                      ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/20 via-stone-900 to-stone-950'
                      : tierKey === 'ULTRA'
                      ? 'border-blue-500/50 bg-gradient-to-b from-blue-950/25 via-stone-900 to-stone-950 ring-2 ring-blue-500/30'
                      : 'border-emerald-500/40 bg-stone-900/90';

                  return (
                    <div
                      key={tierKey}
                      className={`rounded-3xl border p-6 flex flex-col justify-between shadow-xl ${borderClass}`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide ${
                              plan.adFree
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {plan.badge}
                          </span>
                          {isCurrent && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white">
                              AKTİF PAKETİNİZ
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-xl font-black text-white">{plan.name}</h3>
                          <p className="text-stone-400 text-xs mt-1 min-h-[32px]">{plan.tagline}</p>
                        </div>

                        <div className="pt-2 border-t border-white/10">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-white">
                              {price.toLocaleString('tr-TR')} ₺
                            </span>
                            <span className="text-xs text-stone-400">
                              / {billingCycle === 'yearly' ? 'Yıl' : 'Ay'}
                            </span>
                          </div>
                          {billingCycle === 'yearly' && (
                            <p className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                              Aylık sadece {monthlyEquivalent.toLocaleString('tr-TR')} ₺'ye gelir
                            </p>
                          )}
                        </div>

                        <ul className="space-y-2 text-xs text-stone-200 pt-2">
                          {MKS_FEATURE_CATALOG.map(feat => {
                            const enabled = !!featureMatrix[tierKey]?.[feat.key];
                            return (
                              <li
                                key={feat.key}
                                className={`flex items-start gap-2 ${
                                  enabled ? 'text-stone-200' : 'text-stone-500 line-through opacity-60'
                                }`}
                              >
                                {enabled ? (
                                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                  <Lock size={13} className="text-stone-600 shrink-0 mt-0.5" />
                                )}
                                <span>{feat.title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div className="pt-6">
                        <button
                          type="button"
                          disabled={purchasingTier === tierKey}
                          onClick={() => handleSubscribeClick(tierKey)}
                          className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                            tierKey === 'MAX'
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                              : tierKey === 'ULTRA'
                              ? 'bg-blue-600 hover:bg-blue-500 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <Crown size={15} />
                          <span>
                            {purchasingTier === tierKey
                              ? 'İşleniyor...'
                              : `${plan.name} Satın Al (${billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: iOS 1-CLICK INSTALL WIZARD */}
          {activeTab === 'ios_guide' && (
            <div className="max-w-4xl mx-auto space-y-5">
              <div className="bg-stone-900 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3.5 rounded-2xl bg-purple-500/15 text-purple-300 border border-purple-500/30">
                      <Apple size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-white">
                        iPhone ve iPad (iOS) Kurulum &amp; App Store Merkezi
                      </h2>
                      <p className="text-stone-400 text-xs sm:text-sm">
                        Çiftçi Cari Takibi, Depo Stok, Kamera ile 2D BKTS/GTS Karekod ve e-Fatura iPhone &amp; iPad'inizde
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    v8.2.1 • Build 28 • iOS 14 – iOS 18 Tam Uyumlu
                  </span>
                </div>

                {/* Core ERP modules available on iPhone & iPad */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { badge: '1. ÖNCELİK', title: 'Çiftçi Cari & Devir', desc: 'Veresiye, parçalı tahsilat, yıllık devir ve WhatsApp ekstre' },
                    { badge: '2. ÖNCELİK', title: 'Depo & Stok Sayım', desc: 'iPhone kamerasıyla barkodlu satış ve onaylı stok sayımı' },
                    { badge: '3. ÖNCELİK', title: 'BKTS & GTS Karekod', desc: 'GS1 2D karekod okuma, parti/SKT ve muadil ilaç radarı' },
                    { badge: '4. ÖNCELİK', title: 'EDM e-Fatura & Kasa', desc: 'Gelen faturayı stoğa işleme, resmi fatura ve kasa takibi' },
                  ].map((m, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-stone-950/90 border border-emerald-500/20 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-400">{m.badge}</span>
                      <div className="text-xs font-bold text-white">{m.title}</div>
                      <p className="text-[11px] text-stone-400 leading-snug">{m.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-stone-950 border border-white/10 space-y-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300">
                      1. ADIM
                    </span>
                    <h4 className="text-white font-bold text-sm">Safari ile Açın</h4>
                    <p className="text-stone-400 text-xs leading-relaxed">
                      iPhone veya iPad'inizde Safari tarayıcısından{' '}
                      <strong className="text-white">muhendiskayitsistemi.com.tr</strong> adresine girin.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-950 border border-white/10 space-y-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300">
                      2. ADIM
                    </span>
                    <h4 className="text-white font-bold text-sm">Paylaş Butonuna Dokunun</h4>
                    <p className="text-stone-400 text-xs leading-relaxed">
                      Ekranın alt ortasındaki <strong className="text-white">Paylaş (Yukarı Ok)</strong> simgesine dokunun.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-stone-950 border border-white/10 space-y-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300">
                      3. ADIM
                    </span>
                    <h4 className="text-white font-bold text-sm">"Ana Ekrana Ekle" Seçin</h4>
                    <p className="text-stone-400 text-xs leading-relaxed">
                      Menüden <strong className="text-emerald-400">"Ana Ekrana Ekle"</strong> seçeneğine basıp sağ üstten{' '}
                      <strong className="text-white">Ekle</strong>'ye dokunun. Özel MKS ikonuyla tam ekran kurulur!
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-950/25 border border-purple-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-purple-300">
                      Apple App Store Connect &amp; TestFlight Paketi (v8.2.1 • Build 28)
                    </span>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Yerel iOS projesi (<code className="text-emerald-300">com.nayiffirat.muhendiskayitsistemi</code>) Apple Privacy Manifest (<code className="text-purple-300">PrivacyInfo.xcprivacy</code>), 24-bit 1024px AppIcon, kamera 2D BKTS/GTS karekod okuyucu ve bulut Xcode 16 (<code className="text-purple-300">ios-release.yml</code>) derleme hattıyla hazırdır.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyLink('ios_guide_copy', officialSiteUrl)}
                      className="px-3.5 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-200 border border-white/15 font-bold text-xs flex items-center gap-1.5"
                    >
                      {copiedId === 'ios_guide_copy' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedId === 'ios_guide_copy' ? 'Bağlantı Kopyalandı' : 'Kurulum Linkini Kopyala'}</span>
                    </button>
                    {onGoToLogin && (
                      <button
                        type="button"
                        onClick={() => onGoToLogin('LOGIN')}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black text-xs whitespace-nowrap"
                      >
                        Web'den Hemen Giriş Yap
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OVERVIEW / SHOWCASE (CORE ERP FIRST, FIELD TOOLS SECONDARY) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Primary Core ERP Visual Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-3xl overflow-hidden bg-stone-900/90 border border-emerald-500/25 shadow-2xl flex flex-col">
                  <div className="aspect-video w-full overflow-hidden bg-stone-950 relative">
                    <img
                      src="/showcase/corporate-agtech-hero.jpg"
                      alt="MKS Çiftçi Cari Takibi, Depo Stok ve Barkodlu Satış Sistemi"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-stone-950/85 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                      ÇİFTÇİ CARİ TAKİBİ • DEPO STOK • BARKODLU SATIŞ
                    </span>
                  </div>
                  <div className="p-5 space-y-1.5">
                    <h3 className="text-white font-semibold text-base">
                      Çiftçi Cari Takibi, Parçalı Tahsilat, Yıllık Devir ve Onaylı Stok Yönetimi
                    </h3>
                    <p className="text-stone-400 text-xs leading-relaxed">
                      Müstahsil veresiye hesaplarını, nakit/çek/POS bloke tahsilatlarını, sezon sonu kayıpsız yıllık bakiye devrini ve barkod tabancası uyumlu onaylı depo stok sayımlarını telefon ile bilgisayarda senkron yönetin.
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl overflow-hidden bg-stone-900/90 border border-emerald-500/20 shadow-2xl flex flex-col">
                  <div className="aspect-video w-full overflow-hidden bg-[#080C12] p-5 flex flex-col justify-between border-b border-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-semibold">
                        TARIM BAKANLIĞI BKTS / GTS • EDM RESMİ E-FATURA
                      </span>
                      <span className="text-[11px] text-stone-400 font-medium">7/24 Bulut + Çevrimdışı</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 my-auto py-2">
                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                        <div className="text-[10px] text-emerald-400 font-semibold">BKTS &amp; GTS 2D Karekod</div>
                        <div className="text-xs font-semibold text-white">GS1 DataMatrix Okuma</div>
                        <div className="text-[11px] text-stone-400">GTIN, Parti No, Seri No ve SKT ayrıştırma + aktif madde muadil radarı</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                        <div className="text-[10px] text-amber-300 font-semibold">EDM e-Fatura &amp; e-Arşiv</div>
                        <div className="text-xs font-semibold text-white">Otomatik Alış &amp; Satış</div>
                        <div className="text-[11px] text-stone-400">Gelen faturadan tek tıkla stok girişi, resmi fatura kesimi ve kasa takibi</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-stone-400 flex items-center justify-between">
                      <span>Bilgisayar kapalıyken bile telefondan kesintisiz işlem</span>
                      <span className="text-emerald-400 font-medium">Sıfır veri kaybı</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-1.5">
                    <h3 className="text-white font-semibold text-base">
                      BKTS, GTS 2D Karekod ve Resmi EDM e-Fatura Entegrasyonu
                    </h3>
                    <p className="text-stone-400 text-xs leading-relaxed">
                      Zirai ilaç ve gübre mal kabulünden çiftçiye çıkışa kadar Bakanlık karekod süreçlerini ve GİB onaylı e-Fatura / e-Arşiv işlemlerini tek kurumsal ekranda birleştirin.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    icon: Database,
                    title: '1. Çiftçi Cari Takibi & Yıllık Devir',
                    desc: 'Vadeli ilaç/gübre satışı, nakit + çek + POS bloke parçalı tahsilat, vade hatırlatmaları ve önceki yıl arşivini koruyan kusursuz yıllık bakiye devri.'
                  },
                  {
                    icon: Layers,
                    title: '2. Depo Stok, Barkod & Onaylı Sayım',
                    desc: 'Market barkod tabancası ile hızlı tezgâh satışı, kritik stok/SKT uyarıları ve sayım tarihi ile adetlerin mühürlendiği net stok sayım sistemi.'
                  },
                  {
                    icon: ScanBarcode,
                    title: '3. BKTS, GTS & B-Reçete Karekod',
                    desc: 'Telefon kamerası veya 2D okuyucu ile GS1 karekodlu mal kabul, parti/SKT takibi, TC Kimlik No ile çıkış ve aktif madde muadil ilaç bulucu.'
                  },
                  {
                    icon: ShieldCheck,
                    title: '4. EDM Resmi e-Fatura, Tedarikçi & Kasa',
                    desc: 'Gelen alış e-Faturalarını tek onayla stoğa ve tedarikçi carisine işleme, resmi e-Fatura/e-Arşiv kesimi, çek ciro ve kasa-banka mutabakatı.'
                  },
                  {
                    icon: Smartphone,
                    title: 'Şifresiz Üretici Portalı & Sıfır Kayıp',
                    desc: 'Çiftçiye WhatsApp üzerinden şifresiz cari ekstre linki paylaşımı; IndexedDB + Bulut senkronizasyonu ile telefon ve bilgisayarda sıfır veri kaybı.'
                  },
                  {
                    icon: Globe,
                    title: 'Ek Araçlar: Silo, Hava & Tarla Haritası',
                    desc: 'Ana ERP akışınızı destekleyen yardımcı araçlar: kantar nem/fire mahsubu, ilaçlama hava durumu, uygulama içi TKGM sorgusu ve uydu görünümü.'
                  }
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="p-5 rounded-3xl bg-stone-900/80 border border-white/10 space-y-2.5">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                        <Icon size={22} />
                      </div>
                      <h3 className="text-white font-semibold text-base">{item.title}</h3>
                      <p className="text-stone-400 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

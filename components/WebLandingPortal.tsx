import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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
  ScanBarcode,
  Database,
  Crown,
  CreditCard,
  ArrowRight,
  Copy,
  Check,
  MessageCircle,
  Globe,
  Layers,
  ExternalLink,
  X,
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
import { Capacitor } from '@capacitor/core';
import { auth } from '../services/firebase';
import { dbService } from '../services/db';
import { API_BASE } from '../utils/api';

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
  const normalizedInitTab = initialTab === 'showcase' ? 'overview' : initialTab === 'ios_guide' ? 'download' : initialTab;
  const [activeTab, setActiveTab] = useState<'overview' | 'download' | 'pricing'>(normalizedInitTab);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [purchasingTier, setPurchasingTier] = useState<SubscriptionTierId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shopierOrderId, setShopierOrderId] = useState('');
  const [shopierBuyerContact, setShopierBuyerContact] = useState('');
  const [claimingOrder, setClaimingOrder] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [plans, setPlans] = useState(() => getSubscriptionPlans());
  const [featureMatrix, setFeatureMatrix] = useState(() => getFeatureMatrix());

  const officialSiteUrl = 'https://www.muhendiskayitsistemi.com.tr';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : officialSiteUrl;
  const windowsExeUrl = `${currentOrigin}/downloads/MKS_Masaustu_Kurulum.exe`;
  const androidApkUrl = `${currentOrigin}/downloads/MKS_Android.apk`;
  const googlePlayUrl = 'https://play.google.com/store/apps/details?id=com.nayiffirat.muhendiskayitsistemi';
  const appStoreUrl = 'https://apps.apple.com/tr/app/m%C3%BChendis-kay%C4%B1t-sistemi-mks/id6760776127';

  useBackHandler(mode === 'modal' && !!onClose, () => onClose?.(), 'web_landing_portal', 85);
  useScrollLock(mode === 'modal');

  useEffect(() => {
    setActiveTab(initialTab === 'showcase' ? 'overview' : initialTab === 'ios_guide' ? 'download' : initialTab);
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
  }, []);

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleSubscribeClick = async (tier: SubscriptionTierId) => {
    setPurchasingTier(tier);
    const isNativeApp = Capacitor.isNativePlatform();
    setStatusMessage(isNativeApp ? 'Mağaza ödeme ekranı açılıyor...' : 'Shopier güvenli ödeme sayfası açılıyor...');

    const period: BillingPeriod = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
    const purchasedInStore = await purchaseSubscriptionPlan(tier, period, (plan, per) => {
      const price = per === 'YEARLY' ? plan.yearlyPriceTRY : plan.monthlyPriceTRY;
      const periodLabel = per === 'YEARLY' ? 'Yıllık' : 'Aylık';
      if (isNativeApp) {
        setStatusMessage(
          `${plan.name} (${periodLabel} - ${price.toLocaleString('tr-TR')} TL) mağaza üzerinden tamamlanamadı. Canlı Destek ile paketinizi hemen aktif edebiliriz.`
        );
        onOpenSupport?.(
          'subscription',
          `Merhaba Fırat Bey, ${plan.name} (${periodLabel} - ${price.toLocaleString('tr-TR')} TL) paketini aktif etmek istiyorum.`
        );
      } else {
        setStatusMessage(
          `Shopier güvenli ödeme sayfası açıldı (${plan.name} · ${periodLabel}). MKS hesabınızdaki e-posta veya telefon ile öderseniz aboneliğiniz saniyeler içinde OTOMATİK açılır; farklı e-posta kullandıysanız sayfanın altından sipariş numaranızı girebilirsiniz.`
        );
      }
    });

    setPurchasingTier(null);
    if (purchasedInStore) {
      onTierUpgraded?.(tier);
      setStatusMessage(`${tier} paketiniz başarıyla aktifleştirildi!`);
    }
  };

  const handleClaimShopierOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claimingOrder) return;
    if (!auth.currentUser) {
      setClaimFeedback({ ok: false, msg: 'Sipariş kodunu hesabınıza tanımlamak için önce MKS oturumu açın.' });
      return;
    }
    const cleanOrder = shopierOrderId.trim();
    const cleanContact = shopierBuyerContact.trim();
    if (cleanOrder.length < 4) {
      setClaimFeedback({ ok: false, msg: 'Geçerli Shopier sipariş numarasını girin.' });
      return;
    }
    if (!cleanContact) {
      setClaimFeedback({ ok: false, msg: 'Shopier ödemesinde girdiğiniz e-posta adresini veya cep telefonunu yazın.' });
      return;
    }
    setClaimingOrder(true);
    setClaimFeedback(null);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch(`${API_BASE}/api/shopier/claim-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orderId: cleanOrder, buyerContact: cleanContact }),
      });
      const data = await resp.json().catch(() => ({ ok: false, error: 'Sunucudan geçersiz yanıt alındı.' }));
      if (!resp.ok || !data?.ok) {
        setClaimFeedback({ ok: false, msg: data?.error || 'Sipariş doğrulanamadı.' });
        return;
      }
      localStorage.setItem('mks_active_tier', data.tier);
      const updatedProfile = await dbService.getUserProfile(auth.currentUser.uid).catch(() => null);
      if (updatedProfile) {
        window.dispatchEvent(new CustomEvent('mks-subscription-activated', { detail: updatedProfile }));
      }
      onTierUpgraded?.(data.tier);
      setShopierOrderId('');
      setShopierBuyerContact('');
      setClaimFeedback({ ok: true, msg: data.message || `MKS ${data.tier} aboneliğiniz aktifleştirildi!` });
    } catch {
      setClaimFeedback({ ok: false, msg: 'Sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.' });
    } finally {
      setClaimingOrder(false);
    }
  };

  return (
    <div
      className={`${
        mode === 'modal'
          ? 'fixed inset-0 z-[110] bg-black/75 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-5 overflow-y-auto'
          : 'min-h-screen bg-[#0B0D12] text-stone-100 flex flex-col'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`w-full ${
          mode === 'modal'
            ? 'max-w-6xl bg-[#0B0D12] border border-white/12 rounded-[28px] shadow-[0_32px_100px_rgba(0,0,0,0.8)] overflow-hidden max-h-[92vh] flex flex-col'
            : 'max-w-7xl mx-auto flex-1 flex flex-col p-4 sm:p-8'
        }`}
      >
        {/* Top Navigation Bar (Apple Frosted Glass) */}
        <div className="px-4 sm:px-7 py-3.5 bg-[#161617]/85 border-b border-white/[0.08] space-y-3 sticky top-0 z-20 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <MksBrandLogo size="md" rounded="xl" className="border-emerald-500/30" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-white text-sm sm:text-base tracking-tight truncate">
                    Mühendis Kayıt Sistemi
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white/70 border border-white/10 bg-white/[0.04] shrink-0">
                    <Globe size={11} /> muhendiskayitsistemi.com.tr
                  </span>
                </div>
                <p className="text-[11px] text-white/60 truncate">
                  Web, Windows masaüstü, iOS ve Android kurulum merkezi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onGoToLogin && (
                <button
                  type="button"
                  onClick={() => onGoToLogin('LOGIN')}
                  className="min-h-[38px] px-4 py-1.5 rounded-full bg-[#10B981] hover:bg-[#059669] text-[#052E16] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ArrowRight size={14} />
                  <span className="hidden sm:inline">Giriş yap</span>
                </button>
              )}
              {onOpenSupport && (
                <button
                  type="button"
                  onClick={() => onOpenSupport('general')}
                  className="hidden sm:flex min-h-[38px] px-4 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/12 text-xs font-medium items-center gap-1.5 transition-colors"
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
                  className="w-9 h-9 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>

          {/* Mobile-Safe Scrollable Apple Pill Navigation Rail */}
          <div className="mks-tab-rail inline-flex items-center gap-1 bg-white/[0.06] p-1 rounded-full border border-white/[0.08] overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: 'overview', label: 'Özellikler', icon: Layers },
              { id: 'download', label: 'Uygulamayı indir', icon: Download },
              { id: 'pricing', label: 'Paketler', icon: Crown }
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`shrink-0 min-h-[36px] flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-white text-[#1D1D1F] font-semibold shadow-sm'
                      : 'text-white/75 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-emerald-600' : 'text-white/70'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 min-h-[36px] flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all text-white/75 hover:text-white hover:bg-white/[0.06]"
            >
              <Apple size={14} className="text-white/70" />
              <span>App Store (iOS)</span>
              <ExternalLink size={11} className="text-white/60" />
            </a>
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
              className="px-5 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs whitespace-nowrap transition-all shrink-0"
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
                        className="py-3 px-4 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all text-center"
                      >
                        <Download size={15} />
                        <span>Direkt İndir (.EXE)</span>
                      </a>
                      <a
                        href="/downloads/MKS_Masaustu_Kurulum.zip"
                        download="MKS_Masaustu_Kurulum.zip"
                        className="py-3 px-4 rounded-full bg-[#10B981] hover:bg-[#059669] text-[#052E16] font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all text-center"
                      >
                        <Download size={15} />
                        <span>Sıkıştırılmış İndir (.ZIP)</span>
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink('win', windowsExeUrl)}
                        className="flex-1 py-2.5 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/85 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
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
                      className="w-full py-3.5 px-5 rounded-full bg-[#10B981] hover:bg-[#059669] text-[#052E16] font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <ExternalLink size={16} />
                      <span>Google Play Mağazasından İndir</span>
                    </a>
                    <div className="flex gap-2">
                      <a
                        href="/downloads/MKS_Android.apk"
                        download="MKS_Android.apk"
                        className="flex-1 py-2.5 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/90 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Download size={14} className="text-emerald-400" />
                        <span>Direkt APK İndir</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink('android', androidApkUrl)}
                        className="py-2.5 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/85 border border-white/10 text-xs font-medium flex items-center justify-center gap-1 transition-all"
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
                        Apple App Store
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">iOS (iPhone & iPad) Uygulaması</h3>
                      <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                        iPhone ve iPad cihazlarınız için Apple App Store üzerinden doğrudan indirilebilen resmî MKS
                        mobil uygulaması.
                      </p>
                    </div>
                    <ul className="space-y-1.5 text-xs text-stone-300">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Apple App Store Üzerinden Tek Tıkla Doğrudan İndirme</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>iPhone Kamera 1D/2D BKTS & GTS Karekod Okuma</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                        <span>Çevrimdışı Çalışma ve Tüm Cihazlarla Anlık Bulut Senkronu</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-6 space-y-2.5">
                    <a
                      href={appStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3.5 px-5 rounded-full bg-white text-[#1D1D1F] hover:bg-white/90 font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <Apple size={16} />
                      <span>App Store Mağazasından İndir</span>
                      <ExternalLink size={14} />
                    </a>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink('ios', appStoreUrl)}
                        className="flex-1 py-2.5 px-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/85 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                      >
                        {copiedId === 'ios' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copiedId === 'ios' ? 'App Store Linki Kopyalandı!' : 'App Store Linkini Kopyala'}</span>
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
                <div className="inline-flex items-center p-1 rounded-full bg-white/[0.06] border border-white/10 mt-2">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-white text-[#1D1D1F] font-semibold shadow'
                        : 'text-white/75 hover:text-white'
                    }`}
                  >
                    Aylık Abonelik
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                      billingCycle === 'yearly'
                        ? 'bg-white text-[#1D1D1F] font-semibold shadow'
                        : 'text-white/75 hover:text-white'
                    }`}
                  >
                    <span>Yıllık Abonelik</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-stone-950 font-black">
                      2 AY BEDAVA (%25 AVANTAJ)
                    </span>
                  </button>
                </div>

                {/* Shopier Trust & Payment Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-semibold shadow-sm">
                    <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>Shopier 256-Bit SSL Güvenli Kart Ödemesi</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300 font-semibold shadow-sm">
                    <CreditCard size={14} className="text-blue-400 shrink-0" />
                    <span>Tüm Kredi & Banka Kartlarına Taksit / Tek Çekim</span>
                  </span>
                  <a
                    href="https://www.shopier.com/firattarim"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-900 hover:bg-stone-800 border border-white/15 text-stone-300 font-medium transition-colors"
                  >
                    <span>Fırat Tarım Shopier Mağazası</span>
                    <ExternalLink size={12} className="text-stone-400" />
                  </a>
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

                      <div className="pt-6 space-y-2">
                        <button
                          type="button"
                          disabled={purchasingTier === tierKey}
                          onClick={() => handleSubscribeClick(tierKey)}
                          className={`w-full py-3.5 px-5 rounded-full font-semibold text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                            tierKey === 'MAX'
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-amber-950/40'
                              : tierKey === 'ULTRA'
                              ? 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-blue-950/40'
                              : 'bg-[#10B981] hover:bg-[#059669] text-[#052E16] shadow-emerald-950/40'
                          }`}
                        >
                          <CreditCard size={15} />
                          <span>
                            {purchasingTier === tierKey
                              ? 'Ödeme Sayfası Açılıyor...'
                              : `${plan.name} Satın Al (Shopier Güvenli Kart)`}
                          </span>
                        </button>
                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-stone-400">
                          <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
                          <span>Shopier ile 256-Bit SSL Korumalı Kart / Taksit</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Shopier Otomatik & Tek Kullanımlık Sipariş Kodu Aktivasyon Kutusu */}
              {!Capacitor.isNativePlatform() && (
                <div className="bg-stone-900/90 border border-emerald-500/25 rounded-3xl p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <ShieldCheck size={18} className="text-emerald-400" />
                        <span>Shopier Ödeme Sonrası Otomatik Aktivasyon &amp; Sipariş Kodu</span>
                      </h3>
                      <p className="text-xs text-stone-400 mt-1">
                        MKS hesabınızdaki e-posta veya telefon ile Shopier&apos;den aldığınızda aboneliğiniz saniyeler içinde otomatik açılır.
                        Shopier&apos;de <b>farklı bir e-posta/telefon</b> yazdıysanız tek kullanımlık sipariş numaranızla buradan anında aktif edebilirsiniz.
                      </p>
                    </div>
                  </div>

                  {auth.currentUser ? (
                    <form onSubmit={handleClaimShopierOrder} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={shopierOrderId}
                        onChange={e => setShopierOrderId(e.target.value)}
                        placeholder="Shopier Sipariş No (ör. 834912345)"
                        className="px-3.5 py-2.5 rounded-xl bg-stone-950 border border-white/15 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        value={shopierBuyerContact}
                        onChange={e => setShopierBuyerContact(e.target.value)}
                        placeholder="Shopier'deki E-Posta veya Cep Tel"
                        className="px-3.5 py-2.5 rounded-xl bg-stone-950 border border-white/15 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={claimingOrder}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-extrabold transition-colors"
                      >
                        {claimingOrder ? 'Doğrulanıyor...' : 'Siparişi Doğrula ve Paketimi Aç'}
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-950/60 border border-white/10 rounded-2xl px-4 py-3">
                      <span className="text-xs text-stone-300">
                        Farklı e-posta ile alınan Shopier sipariş kodunu tanımlamak için önce MKS hesabınıza giriş yapın.
                      </span>
                      {onGoToLogin && (
                        <button
                          type="button"
                          onClick={() => onGoToLogin('LOGIN')}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                        >
                          Giriş Yap
                        </button>
                      )}
                    </div>
                  )}

                  {claimFeedback && (
                    <p
                      className={`text-xs font-bold rounded-xl px-3.5 py-2.5 border ${
                        claimFeedback.ok
                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                      }`}
                    >
                      {claimFeedback.msg}
                    </p>
                  )}
                </div>
              )}
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
                      src="/showcase/apple-hero-devices.png"
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

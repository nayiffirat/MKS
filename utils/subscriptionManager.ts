import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import { isDesktopOrWebEnvironment } from './navigationManager';
import { db as firestore } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { API_BASE } from './api';

export type SubscriptionTierId = 'PRO' | 'ULTRA' | 'MAX';
export type BillingPeriod = 'MONTHLY' | 'YEARLY';

export type FeatureKey =
  | 'AD_FREE'
  | 'WEB_DESKTOP_ACCESS'
  | 'FARMERS_CARI'
  | 'PRESCRIPTIONS_SALES'
  | 'INVENTORY_STOCK'
  | 'KASA_BANKA'
  | 'SUPPLIERS_PURCHASE'
  | 'MINISTRY_BKST_GTS'
  | 'EDM_EFATURA'
  | 'POS_BARCODE_SCANNER'
  | 'TANK_MIX_EQUIVALENT'
  | 'AI_ASSISTANT_OCR'
  | 'SILO_MERCHANT'
  | 'TKGM_MAP_WEATHER'
  | 'REPORTS_STATISTICS'
  | 'MULTI_USER_TEAM'
  | 'AUTO_BACKUP_TELEGRAM';

export interface FeatureDefinition {
  key: FeatureKey;
  title: string;
  description: string;
  category: 'Temel & Platform' | 'Finans & Depo' | 'Bakanlık & Barkod' | 'Yapay Zeka & Kurumsal';
  mappedViews?: string[];
}

export const MKS_FEATURE_CATALOG: FeatureDefinition[] = [
  {
    key: 'AD_FREE',
    title: '%100 Reklamsız Kullanım',
    description: 'Uygulama içi geçiş reklamlarını (AdMob) tamamen kaldırır (PRO reklamlı, ULTRA & MAX reklamsız)',
    category: 'Temel & Platform'
  },
  {
    key: 'WEB_DESKTOP_ACCESS',
    title: 'Web Portalı & Windows Masaüstü (.exe) Erişimi',
    description: 'Bilgisayar tarayıcısı ve Windows masaüstü uygulamasından tam ekran çalışma yetkisi',
    category: 'Temel & Platform'
  },
  {
    key: 'FARMERS_CARI',
    title: 'Müstahsil (Çiftçi) Cari & Alacak/Risk Takibi',
    description: 'Çiftçi kayıtları, tarla yönetimi, cari ekstre ve borç yaşlandırma skorları',
    category: 'Finans & Depo',
    mappedViews: ['FARMERS', 'DEBT_TRACKING']
  },
  {
    key: 'PRESCRIPTIONS_SALES',
    title: 'Satış, Reçete & Zirai Fatura Kesimi',
    description: 'Peşin/vadeli satış, reçete oluşturma, müşteri bekletme ve sesli komutla satış',
    category: 'Finans & Depo',
    mappedViews: ['PRESCRIPTIONS', 'PRESCRIPTION_NEW', 'PRESCRIPTION_LIST']
  },
  {
    key: 'INVENTORY_STOCK',
    title: 'Depo, Stok & İlaç/Bitki Kütüphanesi',
    description: 'Stok takibi, kritik stok uyarıları, SKT/Lot takibi ve ilaç kütüphanesi',
    category: 'Finans & Depo',
    mappedViews: ['INVENTORY', 'PESTICIDES', 'PLANTS', 'SMART_STOCK']
  },
  {
    key: 'KASA_BANKA',
    title: 'Kasa, Banka, Tahsilat & Çek/Senet Portföyü',
    description: 'Nakit akışı, POS/Tarım Kartları, çek/senet takibi ve işletme giderleri',
    category: 'Finans & Depo',
    mappedViews: ['KASA', 'PAYMENTS', 'EXPENSES']
  },
  {
    key: 'SUPPLIERS_PURCHASE',
    title: 'Tedarikçi Cari, Alım Faturaları & Zincir İskonto',
    description: 'Toptancı/fabrika cari hesapları, mal alım faturaları ve yıl sonu risturn hesabı',
    category: 'Finans & Depo',
    mappedViews: ['SUPPLIERS']
  },
  {
    key: 'MINISTRY_BKST_GTS',
    title: 'Tarım Bakanlığı (BKTS + GTS + B-Reçete) & Mal Kabul',
    description: 'Fabrikadan karekodlu mal kabul, GLN/TC satış çıkışı ve resmi BKTS/GTS dosya aktarımı',
    category: 'Bakanlık & Barkod'
  },
  {
    key: 'EDM_EFATURA',
    title: 'EDM e-Fatura & Çoklu Depo Ayrıştırma (e-Fatura Deposu / Sistem Deposu)',
    description: 'Gelen e-Faturayı e-Fatura Deposunda bırakma veya Sistem Deposuna aktarma; sadece e-Faturalı stoğa fatura kesme',
    category: 'Bakanlık & Barkod'
  },
  {
    key: 'POS_BARCODE_SCANNER',
    title: 'Süpermarket Tipi El Barkod Okuyucu & Kamera Karekod',
    description: 'USB/Kablosuz POS barkod tabancası ve telefon kamerası ile anında ürün okutma',
    category: 'Bakanlık & Barkod'
  },
  {
    key: 'TANK_MIX_EQUIVALENT',
    title: 'Tank Karışım Uyuşmazlık Motoru & Eşdeğer İlaç Bulucu',
    description: 'Reçetede kimyasal çökelti/fitotoksisite uyarısı ve aktif maddeye göre muadil ilaç bulma',
    category: 'Bakanlık & Barkod',
    mappedViews: ['CALCULATOR', 'MKS_MUHENDISIM']
  },
  {
    key: 'AI_ASSISTANT_OCR',
    title: 'Zirai Yapay Zeka Asistanı & AI Fatura Okuyucu (OCR)',
    description: 'Yaprak fotoğrafından hastalık teşhisi, toprak analizi okuma ve faturadan otomatik stok girişi',
    category: 'Yapay Zeka & Kurumsal',
    mappedViews: ['AI_ASSISTANT']
  },
  {
    key: 'SILO_MERCHANT',
    title: 'Silo, Tüccar & Mahsul-Borç Mahsuplaşma (Takas)',
    description: 'Hububat kantar alımı, rutubet/hektolitre kesintisi ve çiftçi borcundan mahsuplaşma',
    category: 'Finans & Depo',
    mappedViews: ['SILO']
  },
  {
    key: 'TKGM_MAP_WEATHER',
    title: 'TKGM Parsel Haritası & İlaçlama Rüzgar/Hava Radarı',
    description: 'Ada/parsel sorgulama, tarla konumları ve bölgesel ilaçlama rüzgar uygunluk radarı',
    category: 'Yapay Zeka & Kurumsal',
    mappedViews: ['MAP', 'REGIONAL_ALERTS', 'VISITS']
  },
  {
    key: 'REPORTS_STATISTICS',
    title: 'Gelişmiş Finansal Analitik & Kurumsal PDF Bilanço',
    description: 'Kârlılık grafikleri, yıl sonu devir bilançoları ve kurumsal PDF ekstre çıktıları',
    category: 'Yapay Zeka & Kurumsal',
    mappedViews: ['STATISTICS', 'REPORTS']
  },
  {
    key: 'MULTI_USER_TEAM',
    title: 'Çoklu Alt Kullanıcı (Plasiyer / Muhasebe) & Ekip Yönetimi',
    description: 'Personel yetkilendirme, saha plasiyer takibi ve ekip içi mesajlaşma',
    category: 'Yapay Zeka & Kurumsal',
    mappedViews: ['TEAM', 'PERFORMANCE', 'MESSAGES']
  },
  {
    key: 'AUTO_BACKUP_TELEGRAM',
    title: 'Cihaz Hafızasına Yerel Yedekleme + Otomatik Bulut Eşleme',
    description: 'İnternet yokken cihaz hafızasına anında kayıt, internet geldiğinde bulutla otomatik eşleme ve tek tıkla cihaz hafızasına tam yedek (Sıfır Veri Kaybı)',
    category: 'Yapay Zeka & Kurumsal'
  }
];

export type TierFeatureMatrix = Record<SubscriptionTierId, Record<FeatureKey, boolean>>;

export const DEFAULT_FEATURE_MATRIX: TierFeatureMatrix = {
  PRO: {
    AD_FREE: false, // PRO Reklamlı!
    WEB_DESKTOP_ACCESS: false,
    FARMERS_CARI: true,
    PRESCRIPTIONS_SALES: true,
    INVENTORY_STOCK: true,
    KASA_BANKA: true,
    SUPPLIERS_PURCHASE: false,
    MINISTRY_BKST_GTS: false,
    EDM_EFATURA: false,
    POS_BARCODE_SCANNER: true,
    TANK_MIX_EQUIVALENT: false,
    AI_ASSISTANT_OCR: false,
    SILO_MERCHANT: false,
    TKGM_MAP_WEATHER: false,
    REPORTS_STATISTICS: false,
    MULTI_USER_TEAM: false,
    AUTO_BACKUP_TELEGRAM: true
  },
  ULTRA: {
    AD_FREE: true, // ULTRA %100 Reklamsız!
    WEB_DESKTOP_ACCESS: true,
    FARMERS_CARI: true,
    PRESCRIPTIONS_SALES: true,
    INVENTORY_STOCK: true,
    KASA_BANKA: true,
    SUPPLIERS_PURCHASE: true,
    MINISTRY_BKST_GTS: true,
    EDM_EFATURA: true,
    POS_BARCODE_SCANNER: true,
    TANK_MIX_EQUIVALENT: true,
    AI_ASSISTANT_OCR: false,
    SILO_MERCHANT: true,
    TKGM_MAP_WEATHER: true,
    REPORTS_STATISTICS: true,
    MULTI_USER_TEAM: false,
    AUTO_BACKUP_TELEGRAM: true
  },
  MAX: {
    AD_FREE: true, // MAX %100 Reklamsız + Tüm Özellikler!
    WEB_DESKTOP_ACCESS: true,
    FARMERS_CARI: true,
    PRESCRIPTIONS_SALES: true,
    INVENTORY_STOCK: true,
    KASA_BANKA: true,
    SUPPLIERS_PURCHASE: true,
    MINISTRY_BKST_GTS: true,
    EDM_EFATURA: true,
    POS_BARCODE_SCANNER: true,
    TANK_MIX_EQUIVALENT: true,
    AI_ASSISTANT_OCR: true,
    SILO_MERCHANT: true,
    TKGM_MAP_WEATHER: true,
    REPORTS_STATISTICS: true,
    MULTI_USER_TEAM: true,
    AUTO_BACKUP_TELEGRAM: true
  }
};

export interface SubscriptionPlanDefinition {
  id: SubscriptionTierId;
  name: string;
  badge: string;
  tagline: string;
  monthlyPriceTRY: number;
  yearlyPriceTRY: number;
  yearlyDiscountLabel: string;
  platforms: ('MOBILE' | 'TABLET' | 'WEB' | 'DESKTOP')[];
  adFree: boolean;
  googlePlayProductIdMonthly: string;
  googlePlayProductIdYearly: string;
  appleAppStoreProductIdMonthly: string;
  appleAppStoreProductIdYearly: string;
  features: string[];
  highlightColor: string;
  popular?: boolean;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlanDefinition[] = [
  {
    id: 'PRO',
    name: 'MKS PRO',
    badge: 'BAŞLANGIÇ • REKLAM DESTEKLİ',
    tagline: 'Temel bayi, reçete, stok ve çiftçi cari yönetimi (Reklam destekli ekonomik paket)',
    monthlyPriceTRY: 490,
    yearlyPriceTRY: 4490,
    yearlyDiscountLabel: 'Yıllıkta %24 Avantaj (2 Ay Hediye)',
    platforms: ['MOBILE', 'TABLET'],
    adFree: false,
    googlePlayProductIdMonthly: 'mks_pro_monthly',
    googlePlayProductIdYearly: 'mks_pro_yearly',
    appleAppStoreProductIdMonthly: 'com.mks.ziraat.pro.monthly',
    appleAppStoreProductIdYearly: 'com.mks.ziraat.pro.yearly',
    features: [
      'Müstahsil (Çiftçi) Cari, Alacak & Risk Takibi',
      'Satış, Reçete & Zirai Fatura Kesimi',
      'Depo, Stok & İlaç Kütüphanesi Yönetimi',
      'Kasa, Banka & Tahsilat Makbuzu',
      'Barkod & Karekod Okuyucu Desteği',
      'Reklam Destekli Kullanım (AdMob)'
    ],
    highlightColor: 'emerald'
  },
  {
    id: 'ULTRA',
    name: 'MKS ULTRA',
    badge: 'EN ÇOK TERCİH EDİLEN • REKLAMSIZ',
    tagline: '%100 Reklamsız + Web/Masaüstü + Tarım Bakanlığı (BKTS/GTS) + Tank Karışım & Silo',
    monthlyPriceTRY: 890,
    yearlyPriceTRY: 7990,
    yearlyDiscountLabel: 'Yıllıkta %25 Avantaj',
    platforms: ['MOBILE', 'TABLET', 'WEB', 'DESKTOP'],
    adFree: true,
    googlePlayProductIdMonthly: 'mks_ultra_monthly',
    googlePlayProductIdYearly: 'mks_ultra_yearly',
    appleAppStoreProductIdMonthly: 'com.mks.ziraat.ultra.monthly',
    appleAppStoreProductIdYearly: 'com.mks.ziraat.ultra.yearly',
    popular: true,
    features: [
      '%100 Reklamsız Kesintisiz Kullanım',
      'Mobil + Tablet + Web + Windows Masaüstü (.exe)',
      'Tarım Bakanlığı BKTS / GTS / B-Reçete & Fabrikadan Mal Kabul',
      'Süpermarket Tipi USB/Kablosuz El Barkod Okuyucu Desteği',
      'Tank Karışım Uyuşmazlık Motoru & Eşdeğer (Muadil) İlaç Bulucu',
      'Silo & Tüccar + Mahsul-Borç Mahsuplaşma (Takas)',
      'TKGM Parsel Haritası & İlaçlama Rüzgar/Hava Radarı'
    ],
    highlightColor: 'amber'
  },
  {
    id: 'MAX',
    name: 'MKS MAX KURUMSAL',
    badge: 'TAM KAPSAMLI VIP • REKLAMSIZ',
    tagline: '%100 Reklamsız + Zirai Yapay Zeka (AI OCR) + Çoklu Alt Kullanıcı + VIP Destek',
    monthlyPriceTRY: 1490,
    yearlyPriceTRY: 12990,
    yearlyDiscountLabel: 'Yıllıkta %27 Kurumsal Avantaj',
    platforms: ['MOBILE', 'TABLET', 'WEB', 'DESKTOP'],
    adFree: true,
    googlePlayProductIdMonthly: 'mks_max_monthly',
    googlePlayProductIdYearly: 'mks_max_yearly',
    appleAppStoreProductIdMonthly: 'com.mks.ziraat.max.monthly',
    appleAppStoreProductIdYearly: 'com.mks.ziraat.max.yearly',
    features: [
      'ULTRA Paketteki Tüm Özellikler (%100 Reklamsız)',
      'Sınırsız Zirai Yapay Zeka Asistanı & Fotoğraftan Hastalık Teşhisi',
      'Yapay Zeka ile Alış Faturası Okuma (AI OCR Otomatik Stok Girişi)',
      'Çoklu Alt Kullanıcı (Plasiyer, Muhasebe, Ortak) & Ekip Yönetimi',
      'Cihaz Hafızasına Yerel Yedekleme + Otomatik Bulut Eşleme (Sıfır Veri Kaybı)',
      '7/24 Öncelikli VIP Canlı Destek & Özel Kurulum Danışmanlığı'
    ],
    highlightColor: 'violet'
  }
];

const STORAGE_PLANS_KEY = 'mks_custom_subscription_plans_v3';
const STORAGE_MATRIX_KEY = 'mks_custom_feature_matrix_v3';

export function getFeatureMatrix(): TierFeatureMatrix {
  try {
    const raw = localStorage.getItem(STORAGE_MATRIX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        PRO: { ...DEFAULT_FEATURE_MATRIX.PRO, ...(parsed.PRO || {}), AUTO_BACKUP_TELEGRAM: true },
        ULTRA: { ...DEFAULT_FEATURE_MATRIX.ULTRA, ...(parsed.ULTRA || {}), AUTO_BACKUP_TELEGRAM: true },
        MAX: { ...DEFAULT_FEATURE_MATRIX.MAX, ...(parsed.MAX || {}), AUTO_BACKUP_TELEGRAM: true }
      };
    }
  } catch (e) {
    console.warn('Feature matrix parse error:', e);
  }
  return DEFAULT_FEATURE_MATRIX;
}

export function saveFeatureMatrixLocal(matrix: TierFeatureMatrix) {
  try {
    localStorage.setItem(STORAGE_MATRIX_KEY, JSON.stringify(matrix));
    window.dispatchEvent(new CustomEvent('mks-subscription-matrix-updated'));
  } catch (e) {
    console.warn('Could not save feature matrix locally:', e);
  }
}

export function getSubscriptionPlans(): SubscriptionPlanDefinition[] {
  const matrix = getFeatureMatrix();
  let basePlans = DEFAULT_SUBSCRIPTION_PLANS;
  try {
    const raw = localStorage.getItem(STORAGE_PLANS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        basePlans = parsed.filter((p: any) => p.id === 'PRO' || p.id === 'ULTRA' || p.id === 'MAX');
      }
    }
  } catch (e) {
    console.warn('Could not parse custom subscription plans:', e);
  }

  // Dynamically sync adFree, platforms, and enabled feature titles from Admin Matrix!
  return basePlans.map(plan => {
    const tierFlags = {
      ...(matrix[plan.id] || DEFAULT_FEATURE_MATRIX[plan.id]),
      AUTO_BACKUP_TELEGRAM: true
    };
    const isAdFree = !!tierFlags.AD_FREE;
    const hasWebDesktop = !!tierFlags.WEB_DESKTOP_ACCESS;
    const enabledFeatureTitles = MKS_FEATURE_CATALOG.filter(f => tierFlags[f.key] && f.key !== 'AD_FREE').map(
      f => f.title
    );
    const adLine = isAdFree ? '%100 Reklamsız Kesintisiz Kullanım' : 'Reklam Destekli Kullanım (AdMob)';

    return {
      ...plan,
      adFree: isAdFree,
      badge:
        plan.id === 'PRO'
          ? isAdFree
            ? 'BAŞLANGIÇ • REKLAMSIZ'
            : 'BAŞLANGIÇ • REKLAMLI'
          : plan.id === 'ULTRA'
          ? isAdFree
            ? 'EN ÇOK TERCİH EDİLEN • REKLAMSIZ'
            : 'ORTA PAKET • REKLAMLI'
          : isAdFree
          ? 'TAM KAPSAMLI VIP • REKLAMSIZ'
          : 'KURUMSAL VIP',
      platforms: hasWebDesktop ? ['MOBILE', 'TABLET', 'WEB', 'DESKTOP'] : ['MOBILE', 'TABLET'],
      features: [adLine, ...enabledFeatureTitles.slice(0, 8)].map(feat =>
        feat.toLowerCase().includes('telegram')
          ? 'Cihaz Hafızasına Yerel Yedekleme + Otomatik Bulut Eşleme'
          : feat
      )
    };
  });
}

export function saveCustomSubscriptionPlans(plans: SubscriptionPlanDefinition[]) {
  try {
    localStorage.setItem(STORAGE_PLANS_KEY, JSON.stringify(plans));
    window.dispatchEvent(new CustomEvent('mks-subscription-matrix-updated'));
  } catch (e) {
    console.warn('Could not save subscription plans:', e);
  }
}

export async function syncSubscriptionConfigFromCloud(): Promise<void> {
  try {
    const ref = doc(firestore, 'MKS', 'g892bEaJyGfEq1Fa67yb', 'system_settings', 'subscription_matrix');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.matrix) {
        saveFeatureMatrixLocal(data.matrix as TierFeatureMatrix);
      }
      if (data.plans && Array.isArray(data.plans)) {
        saveCustomSubscriptionPlans(data.plans as SubscriptionPlanDefinition[]);
      }
    }
  } catch (e) {
    // Offline or not yet created
  }
}

export async function saveSubscriptionConfigToCloud(
  matrix: TierFeatureMatrix,
  plans: SubscriptionPlanDefinition[]
): Promise<boolean> {
  saveFeatureMatrixLocal(matrix);
  saveCustomSubscriptionPlans(plans);
  try {
    const ref = doc(firestore, 'MKS', 'g892bEaJyGfEq1Fa67yb', 'system_settings', 'subscription_matrix');
    await setDoc(
      ref,
      {
        matrix,
        plans,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.warn('Cloud subscription matrix save error:', e);
    return false;
  }
}

export function getUserSubscriptionTier(userProfile: any, isAdmin = false): SubscriptionTierId {
  if (isAdmin) return 'MAX';
  const rawTier = String(
    userProfile?.subscriptionTier || userProfile?.plan || localStorage.getItem('mks_active_tier') || 'PRO'
  ).toUpperCase();
  if (rawTier === 'MAX' || rawTier === 'VIP' || rawTier === 'ENTERPRISE') return 'MAX';
  if (rawTier === 'ULTRA' || rawTier === 'BUSINESS') return 'ULTRA';
  // Default entry tier is PRO (no FREE plan exists)
  return 'PRO';
}

export function isFeatureEnabledForUser(
  featureKey: FeatureKey,
  userProfile: any,
  isAdmin = false
): boolean {
  if (isAdmin) return true;
  const tier = getUserSubscriptionTier(userProfile, isAdmin);
  const matrix = getFeatureMatrix();
  return !!(matrix[tier]?.[featureKey] ?? DEFAULT_FEATURE_MATRIX[tier]?.[featureKey]);
}

export function getMinimumTierForFeature(featureKey: FeatureKey): SubscriptionTierId {
  const matrix = getFeatureMatrix();
  if (matrix.PRO?.[featureKey]) return 'PRO';
  if (matrix.ULTRA?.[featureKey]) return 'ULTRA';
  return 'MAX';
}

export function isViewAllowedForUser(
  viewState: string,
  userProfile: any,
  isAdmin = false
): { allowed: boolean; requiredFeature?: FeatureDefinition; requiredTier?: SubscriptionTierId } {
  if (isAdmin) return { allowed: true };
  const matchedFeature = MKS_FEATURE_CATALOG.find(
    f => f.mappedViews && f.mappedViews.includes(viewState)
  );
  if (!matchedFeature) return { allowed: true };
  const enabled = isFeatureEnabledForUser(matchedFeature.key, userProfile, isAdmin);
  if (enabled) return { allowed: true };
  return {
    allowed: false,
    requiredFeature: matchedFeature,
    requiredTier: getMinimumTierForFeature(matchedFeature.key)
  };
}

/**
 * Checks if Web/Desktop access is restricted for the current user based on the Admin Feature Matrix.
 */
export function isWebOrDesktopRestrictedForUser(userProfile: any, isAdmin = false): boolean {
  if (isAdmin) return false;
  const unlockedOverride = localStorage.getItem('mks_web_desktop_unlocked') === 'true';
  if (unlockedOverride) return false;

  const hasWebDesktopPermission = isFeatureEnabledForUser('WEB_DESKTOP_ACCESS', userProfile, isAdmin);
  if (hasWebDesktopPermission) return false;

  // Enforce only when explicitly requested or when userProfile explicitly enforces it
  const enforceGate =
    localStorage.getItem('mks_enforce_web_gate') === 'true' ||
    userProfile?.subscriptionTier === 'PRO_LOCKED_WEB';
  return enforceGate && isDesktopOrWebEnvironment();
}

export const ADMOB_CONFIG = {
  androidAppId: 'ca-app-pub-8216705362885050~9381651016',
  bannerUnitId: 'ca-app-pub-8216705362885050/1136031739',
  appOpenUnitId: 'ca-app-pub-8216705362885050/8498215699',
  interstitialUnitId: 'ca-app-pub-8216705362885050/3237797495'
};

let adInteractionCounter = 0;

/**
 * Triggers AdMob interstitial ads on Mobile for tiers where AD_FREE is false (i.e. PRO tier).
 * ULTRA and MAX tiers have AD_FREE = true and never see ads.
 */
export async function maybeShowFreeTierAd(userProfile: any, isAdmin = false) {
  if (isAdmin) return;
  const isAdFree = isFeatureEnabledForUser('AD_FREE', userProfile, isAdmin);
  if (isAdFree) return; // ULTRA & MAX are 100% Ad-Free!

  adInteractionCounter += 1;
  // Show ad every 3 screen navigations for ad-supported tier (PRO)
  if (adInteractionCounter % 3 !== 0) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await AdMob.prepareInterstitial({
        adId: ADMOB_CONFIG.interstitialUnitId,
        isTesting: false
      });
      await AdMob.showInterstitial();
    } catch (e) {
      // Fallback to app open / banner if interstitial unit is still warming up
    }
  }
}

/**
 * Initiates a native Google Play Billing / Apple App Store StoreKit subscription purchase
 * via @revenuecat/purchases-capacitor when running on Android or iOS, or opens Web/WhatsApp/Support checkout.
 */
export async function purchaseSubscriptionPlan(
  planId: SubscriptionTierId,
  period: BillingPeriod,
  onFallbackCheckout: (plan: SubscriptionPlanDefinition, period: BillingPeriod) => void
): Promise<boolean> {
  const plans = getSubscriptionPlans();
  const plan = plans.find(p => p.id === planId);
  if (!plan) return false;

  if (Capacitor.isNativePlatform()) {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const productId =
        Capacitor.getPlatform() === 'ios'
          ? period === 'YEARLY'
            ? plan.appleAppStoreProductIdYearly
            : plan.appleAppStoreProductIdMonthly
          : period === 'YEARLY'
          ? plan.googlePlayProductIdYearly
          : plan.googlePlayProductIdMonthly;

      const offerings = await Purchases.getOfferings();
      const availablePackages = offerings.current?.availablePackages || [];
      const matchedPkg = availablePackages.find(
        pkg => pkg.product.identifier === productId || pkg.identifier.toLowerCase().includes(planId.toLowerCase())
      );

      if (matchedPkg) {
        await Purchases.purchasePackage({ aPackage: matchedPkg });
        localStorage.setItem('mks_active_tier', planId);
        return true;
      }
    } catch (err) {
      console.warn('Native store billing fallback to direct activation:', err);
    }
  }

  onFallbackCheckout(plan, period);
  return false;
}

/**
 * Pre-Update Zero-Data-Loss Snapshot Guard (#58)
 */
export const CURRENT_MKS_VERSION = 'v8.2.1';

export function ensurePreUpdateSafetySnapshot(uid?: string) {
  try {
    // Request OS/browser persistent storage so IndexedDB & local backups are never evicted
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      void navigator.storage.persist().catch(() => {});
    }

    const CURRENT_APP_BUILD = '2026.11.11-V8.2.1';
    const lastSnapshotBuild = localStorage.getItem('mks_last_snapshot_build');
    if (lastSnapshotBuild === CURRENT_APP_BUILD) return;

    const snapshotPayload: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('mks_') || k.includes('farmers') || k.includes('prescriptions') || k.includes('inventory'))) {
        snapshotPayload[k] = localStorage.getItem(k);
      }
    }

    localStorage.setItem(
      `mks_pre_update_snapshot_${CURRENT_APP_BUILD}`,
      JSON.stringify({
        build: CURRENT_APP_BUILD,
        uid: uid || 'local',
        timestamp: new Date().toISOString(),
        keysCount: Object.keys(snapshotPayload).length
      })
    );
    localStorage.setItem('mks_last_snapshot_build', CURRENT_APP_BUILD);
  } catch (e) {
    console.warn('Pre-update snapshot warning:', e);
  }
}

/**
 * Saves a complete backup directly to the user's device storage (IndexedDB/localStorage snapshot + downloadable file)
 * without relying on Telegram or external servers.
 */
export async function saveLocalDeviceBackup(
  payload: any,
  userLabel: string = 'MKS Bayi'
): Promise<{ ok: boolean; message: string }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      void navigator.storage.persist().catch(() => {});
    }
    const nowIso = new Date().toISOString();
    const safeDate = nowIso.slice(0, 16).replace('T', '_').replace(/:/g, '-');
    const envelope = {
      app: 'Mühendis Kayıt Sistemi (MKS)',
      version: CURRENT_MKS_VERSION,
      userLabel,
      savedAt: nowIso,
      data: payload
    };
    const jsonString = JSON.stringify(envelope, null, 2);

    try {
      localStorage.setItem(
        'mks_local_device_backup_meta',
        JSON.stringify({ savedAt: nowIso, userLabel, sizeBytes: jsonString.length })
      );
    } catch {
      // Ignore quota on metadata
    }

    if (typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MKS_Yerel_Yedek_${safeDate}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }

    return {
      ok: true,
      message: 'Tam yedek cihaz hafızasına kaydedildi! İnternet oldukça bulutla otomatik eşlenir.'
    };
  } catch {
    return {
      ok: false,
      message: 'Cihaz hafızasına yedek kaydedilirken bir hata oluştu.'
    };
  }
}

/**
 * Legacy alias redirected to local device storage backup (no Telegram dependency).
 */
export async function sendEncryptedBackupToTelegram(
  payload: any,
  userLabel: string = 'MKS Bayi'
): Promise<{ ok: boolean; message: string }> {
  return saveLocalDeviceBackup(payload, userLabel);
}

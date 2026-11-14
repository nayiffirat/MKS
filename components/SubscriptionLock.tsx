import React, { useState } from 'react';
import { Lock, LogOut, ShieldCheck, Sparkles, PhoneCall, ExternalLink, Check } from 'lucide-react';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import {
  SHOPIER_STORE_CONFIG,
  getSubscriptionPlans,
  purchaseSubscriptionPlan,
  SubscriptionTierId
} from '../utils/subscriptionManager';

const fmtTRY = (n: number) => `${n.toLocaleString('tr-TR')} ₺`;

interface SubscriptionLockProps {
  subscriptionEndsAt: string;
}

export const SubscriptionLock: React.FC<SubscriptionLockProps> = ({ subscriptionEndsAt }) => {
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const endDate = new Date(subscriptionEndsAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const isNativeApp = Capacitor.isNativePlatform();
  const plans = getSubscriptionPlans();
  const planOf = (id: SubscriptionTierId) => plans.find(p => p.id === id);
  const priceOf = (id: SubscriptionTierId, fbMonthly: number, fbYearly: number) => {
    const pl = planOf(id);
    const m = pl?.monthlyPriceTRY ?? fbMonthly;
    const y = pl?.yearlyPriceTRY ?? fbYearly;
    const saving = m > 0 ? Math.round((1 - y / (m * 12)) * 100) : 0;
    return {
      price: fmtTRY(cycle === 'yearly' ? y : m),
      sub: cycle === 'yearly' ? `%${saving} tasarruf` : 'Aylık yenileme',
      saving
    };
  };

  const handleRenew = (id: SubscriptionTierId, url: string) => {
    if (!isNativeApp) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // Mobil uygulamada yalnızca mağaza ödemesi; olmazsa destek hattı
    purchaseSubscriptionPlan(id, cycle === 'yearly' ? 'YEARLY' : 'MONTHLY', () => {
      window.location.href = `tel:${SHOPIER_STORE_CONFIG.supportPhone.replace(/\s/g, '')}`;
    }).then(ok => {
      if (ok) window.location.reload();
    });
  };

  const tiers: Array<{ id: SubscriptionTierId; [k: string]: any }> = [
    {
      id: 'PRO',
      name: 'MKS PRO',
      badge: 'BAŞLANGIÇ',
      ...priceOf('PRO', 490, 4490),
      period: cycle === 'yearly' ? '/ Yıl' : '/ Ay',
      desc: 'Çiftçi Cari • Reçete & Satış • Depo Stok • Kasa',
      url: cycle === 'yearly' ? SHOPIER_STORE_CONFIG.proYearlyUrl : SHOPIER_STORE_CONFIG.proMonthlyUrl,
      border: 'border-emerald-500/30 hover:border-emerald-400',
      bg: 'bg-emerald-950/20 hover:bg-emerald-950/40',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white'
    },
    {
      id: 'ULTRA',
      name: 'MKS ULTRA',
      badge: 'PROFESYONEL',
      popular: true,
      ...priceOf('ULTRA', 890, 7990),
      period: cycle === 'yearly' ? '/ Yıl' : '/ Ay',
      desc: '%100 Reklamsız • Web/Masaüstü • BKTS/GTS • Silo & Takas',
      url: cycle === 'yearly' ? SHOPIER_STORE_CONFIG.ultraYearlyUrl : SHOPIER_STORE_CONFIG.ultraMonthlyUrl,
      border: 'border-amber-500/50 hover:border-amber-400 ring-1 ring-amber-500/30',
      bg: 'bg-amber-950/25 hover:bg-amber-950/45',
      btn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-stone-950 font-black'
    },
    {
      id: 'MAX',
      name: 'MKS MAX KURUMSAL',
      badge: 'VIP KURUMSAL',
      ...priceOf('MAX', 1490, 12990),
      period: cycle === 'yearly' ? '/ Yıl' : '/ Ay',
      desc: 'Sınırsız Zirai Yapay Zeka (AI OCR) • Çoklu Plasiyer • VIP Destek',
      url: cycle === 'yearly' ? SHOPIER_STORE_CONFIG.maxYearlyUrl : SHOPIER_STORE_CONFIG.maxMonthlyUrl,
      border: 'border-violet-500/40 hover:border-violet-400',
      bg: 'bg-violet-950/20 hover:bg-violet-950/40',
      btn: 'bg-violet-600 hover:bg-violet-500 text-white'
    }
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-stone-950 flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-500 overflow-y-auto">
      <div className="w-full max-w-2xl bg-stone-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden my-auto">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-36 bg-gradient-to-b from-emerald-500/15 via-amber-500/10 to-transparent blur-2xl pointer-events-none" />

        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 border border-amber-500/20 relative z-10">
          <Lock size={28} className="text-amber-400" />
        </div>

        <h1 className="text-lg sm:text-2xl font-bold text-white mb-1 relative z-10">
          Kullanım Süreniz Sona Erdi
        </h1>
        <p className="text-xs sm:text-sm text-stone-300 mb-4 relative z-10 leading-relaxed max-w-md">
          MKS lisansınız <strong className="text-emerald-400 font-semibold">{endDate}</strong> tarihinde tamamlandı. 
          Çiftçi carileriniz ve verileriniz <strong>güvenle saklanmaktadır</strong>. 
          {isNativeApp ? 'Paketinizi seçerek hemen yenileyebilirsiniz:' : 'Paketinizi seçerek Shopier üzerinden güvenli kartla hemen yenileyebilirsiniz:'}
        </p>

        {/* Billing Period Selector (Monthly / Yearly) */}
        <div className="inline-flex items-center p-1 rounded-2xl bg-stone-950 border border-white/10 mb-4 relative z-10">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              cycle === 'monthly'
                ? 'bg-stone-800 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Aylık Ödeme
          </button>
          <button
            type="button"
            onClick={() => setCycle('yearly')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              cycle === 'yearly'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sparkles size={13} className="text-amber-300" />
            <span>Yıllık Ödeme · %{Math.max(...tiers.map(x => x.saving || 0))}'ye varan indirim</span>
          </button>
        </div>

        {/* 3 Tier Cards with Direct Shopier URLs */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10 mb-4 text-left">
          {tiers.map(t => (
            <div
              key={t.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${t.border} ${t.bg} relative`}
            >
              {t.popular && (
                <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[9px] font-black uppercase tracking-wider shadow-md">
                  En Çok Satan
                </div>
              )}
              <div className="space-y-1 mb-3">
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{t.badge}</div>
                <div className="text-sm font-bold text-white">{t.name}</div>
                <div className="flex items-baseline gap-1 pt-1">
                  <span className="text-lg font-black text-white">{t.price}</span>
                  <span className="text-[11px] text-stone-400">{t.period}</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">{t.sub}</div>
                <div className="text-[10px] text-stone-400 line-clamp-2 pt-1">{t.desc}</div>
              </div>

              <button
                type="button"
                onClick={() => handleRenew(t.id, t.url)}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md group ${t.btn}`}
              >
                <span>Yenile</span>
                {!isNativeApp && <ExternalLink size={13} className="group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </div>
          ))}
        </div>

        {/* Shopier Trust Badge (yalnızca web/masaüstü) */}
        {!isNativeApp && <div className="w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center gap-2 text-[11px] text-stone-300 mb-4 relative z-10">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
          <span>Shopier 256-Bit SSL güvencesiyle tüm banka ve kredi kartlarına taksit imkanı</span>
        </div>}

        {/* Support & Logout Options */}
        <div className="w-full space-y-2 relative z-10">
          <a
            href={`tel:${SHOPIER_STORE_CONFIG.supportPhone}`}
            className="w-full py-2.5 bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <PhoneCall size={13} className="text-emerald-400" />
            <span>Telefon Destek / Bilgi: {SHOPIER_STORE_CONFIG.supportPhone}</span>
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 text-stone-400 hover:text-stone-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <LogOut size={13} />
            <span>Farklı hesapla giriş yap</span>
          </button>
        </div>
      </div>
    </div>
  );
};

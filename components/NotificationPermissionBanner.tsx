import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import {
  PlatformPermissionState,
  dismissPermissionBannerFor24h,
  dispatchOsNotification,
  getNotificationPermissionStatus,
  isPermissionBannerDismissed,
  requestAllPlatformNotificationPermissions
} from '../utils/smartNotificationEngine';
import { useAppViewModel } from '../context/AppContext';

export const NotificationPermissionBanner: React.FC = () => {
  const { showToast, runSmartNotificationsScan } = useAppViewModel();
  const [permState, setPermState] = useState<PlatformPermissionState>('granted');
  const [dismissed, setDismissed] = useState<boolean>(() => isPermissionBannerDismissed());
  const [busy, setBusy] = useState(false);

  const syncStatus = async () => {
    const st = await getNotificationPermissionStatus();
    setPermState(st);
    setDismissed(isPermissionBannerDismissed());
  };

  useEffect(() => {
    syncStatus();
    const handler = () => {
      syncStatus();
    };
    window.addEventListener('mks-notif-perm-changed', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('mks-notif-perm-changed', handler);
      window.removeEventListener('focus', handler);
    };
  }, []);

  if (permState !== 'prompt' || dismissed) {
    return null;
  }

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await requestAllPlatformNotificationPermissions();
      setPermState(result);
      if (result === 'granted') {
        showToast('Cihaz bildirimleri aktif edildi', 'success');
        await dispatchOsNotification({
          title: 'MKS bildirimleri aktif',
          body: 'Ödeme, çek-senet-kart, günlük aranacaklar, hava durumu ve sürüm uyarıları bu cihaza iletilecek.',
          tag: 'mks-welcome-notif',
          targetView: 'NOTIFICATIONS'
        });
        await runSmartNotificationsScan(false);
      } else if (result === 'denied') {
        showToast('Bildirim izni tarayıcı veya cihaz ayarlarından kapatıldı', 'info');
      } else {
        handleDismiss();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    dismissPermissionBannerFor24h();
    setDismissed(true);
  };

  return (
    <div className="v22-bento-card mb-3 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
          <Bell size={18} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug">
            Bu cihazda bildirimleri etkinleştirin
          </h3>
          <p className="text-xs opacity-75 mt-0.5 leading-relaxed">
            Yaklaşan ödemeler, çek-senet-kart vadeleri, günlük aranacaklar listesi, zirai hava uyarıları ve sürüm güncellemeleri anında iletilsin.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <button
          type="button"
          onClick={handleAllow}
          disabled={busy}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? 'İzin isteniyor...' : 'Bildirimlere izin ver'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          title="Daha sonra hatırlat"
          className="v22-surface-pill w-10 h-10 rounded-xl flex items-center justify-center opacity-75 hover:opacity-100 transition-opacity"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

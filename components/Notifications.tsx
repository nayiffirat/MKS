import React, { useEffect, useMemo, useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  Settings,
  ArrowLeft,
  Phone,
  CreditCard,
  CloudRain,
  RefreshCw,
  ChevronRight,
  SlidersHorizontal,
  Send
} from 'lucide-react';
import { NotificationCategory, NotificationPreferences, ViewState } from '../types';
import { toTelHref } from '../utils/whatsappTemplates';
import {
  PlatformPermissionState,
  dispatchOsNotification,
  getEffectiveNotificationPrefs,
  getNotificationPermissionStatus,
  requestAllPlatformNotificationPermissions
} from '../utils/smartNotificationEngine';

interface NotificationsScreenProps {
  onBack: () => void;
  onNavigate?: (view: ViewState) => void;
}

type FilterKey = 'ALL' | NotificationCategory;

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack, onNavigate }) => {
  const {
    notifications,
    clearNotifications,
    markAllAsRead,
    userProfile,
    updateUserProfile,
    runSmartNotificationsScan,
    showToast
  } = useAppViewModel();

  const [permState, setPermState] = useState<PlatformPermissionState>('prompt');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');
  const [showPrefs, setShowPrefs] = useState(false);
  const [scanning, setScanning] = useState(false);

  const prefs = useMemo(() => getEffectiveNotificationPrefs(userProfile), [userProfile]);

  useEffect(() => {
    markAllAsRead();
    getNotificationPermissionStatus().then(setPermState).catch(() => {});

    const onPermChange = () => {
      getNotificationPermissionStatus().then(setPermState).catch(() => {});
    };
    window.addEventListener('mks-notif-perm-changed', onPermChange);
    return () => window.removeEventListener('mks-notif-perm-changed', onPermChange);
  }, []);

  const handleRequestPerm = async () => {
    const res = await requestAllPlatformNotificationPermissions();
    setPermState(res);
    if (res === 'granted') {
      showToast('Cihaz bildirim izni onaylandı', 'success');
      await dispatchOsNotification({
        title: 'Bildirim sistemi hazır',
        body: 'Vade, çek-senet-kart, arama listesi ve hava uyarıları bu cihaza gönderilecek.',
        tag: 'mks-perm-confirmed',
        targetView: 'NOTIFICATIONS'
      });
    } else if (res === 'denied') {
      showToast('Tarayıcı/cihaz ayarlarından bildirim iznini açabilirsiniz', 'info');
    }
  };

  const handleSendTest = async () => {
    if (permState !== 'granted') {
      await handleRequestPerm();
      return;
    }
    const ok = await dispatchOsNotification({
      title: 'MKS test bildirimi',
      body: 'Ödeme, çek-senet-kart, günlük aranacaklar ve hava uyarıları sorunsuz çalışıyor.',
      tag: `mks-test-${Date.now()}`,
      targetView: 'NOTIFICATIONS'
    });
    showToast(
      ok ? 'Test bildirimi cihazınıza gönderildi' : 'Bildirim gönderilemedi, izin durumunu kontrol edin',
      ok ? 'success' : 'info'
    );
  };

  const handleManualScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const found = await runSmartNotificationsScan(true);
      showToast(
        found > 0
          ? `${found} güncel bildirim özeti oluşturuldu`
          : 'Tüm vadeler ve hava durumu kontrol edildi, yeni uyarı yok',
        'success'
      );
    } finally {
      setScanning(false);
    }
  };

  const togglePref = async (key: keyof NotificationPreferences) => {
    const nextPrefs: NotificationPreferences = {
      ...prefs,
      [key]: !prefs[key]
    };
    await updateUserProfile({
      ...userProfile,
      notificationPrefs: nextPrefs
    });
  };

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'ALL') return notifications;
    return notifications.filter((n) => (n.category || 'SYSTEM') === activeFilter);
  }, [notifications, activeFilter]);

  const getCategoryIcon = (category?: NotificationCategory, type?: string) => {
    switch (category) {
      case 'CHECK_NOTE_CARD':
      case 'PAYMENT_DUE':
        return <CreditCard size={18} strokeWidth={1.75} className="text-amber-400" />;
      case 'DAILY_CALL_LIST':
        return <Phone size={18} strokeWidth={1.75} className="text-sky-400" />;
      case 'WEATHER_ALERT':
        return <CloudRain size={18} strokeWidth={1.75} className="text-blue-400" />;
      case 'APP_UPDATE':
        return <RefreshCw size={18} strokeWidth={1.75} className="text-emerald-400" />;
      default:
        if (type === 'WARNING') return <AlertTriangle size={18} strokeWidth={1.75} className="text-amber-400" />;
        if (type === 'SUCCESS') return <CheckCircle2 size={18} strokeWidth={1.75} className="text-emerald-400" />;
        if (type === 'SYSTEM') return <Settings size={18} strokeWidth={1.75} className="text-stone-400" />;
        return <Info size={18} strokeWidth={1.75} className="text-sky-400" />;
    }
  };

  const filterTabs: { id: FilterKey; label: string }[] = [
    { id: 'ALL', label: 'Tümü' },
    { id: 'PAYMENT_DUE', label: 'Ödeme vadesi' },
    { id: 'CHECK_NOTE_CARD', label: 'Çek, senet ve kart' },
    { id: 'DAILY_CALL_LIST', label: 'Günlük aranacaklar' },
    { id: 'WEATHER_ALERT', label: 'Hava durumu' },
    { id: 'APP_UPDATE', label: 'Güncellemeler' }
  ];

  const prefRows: { key: keyof NotificationPreferences; title: string; desc: string }[] = [
    {
      key: 'paymentDue',
      title: 'Ödeme yaklaştı bildirimleri',
      desc: 'Vadeli reçete alacakları ve tedarikçi ödeme vadeleri yaklaştığında uyarır'
    },
    {
      key: 'checkNoteCard',
      title: 'Çek, senet ve kart bildirimleri',
      desc: 'Portföydeki çek, senet ve kredi/üretici kartı bloke veya taksit vadelerini hatırlatır'
    },
    {
      key: 'dailyCallList',
      title: 'Günlük aranması gerekenler listesi',
      desc: 'Ödeme sözü olan çiftçiler, bugünkü ajanda ve vadesi bugün dolanlar için sabah özeti sunar'
    },
    {
      key: 'weatherAlerts',
      title: 'Zirai hava durumu bildirimleri',
      desc: 'Don riski, aşırı sıcak, kuvvetli yağış ve ilaçlama rüzgar limitlerinde uyarır'
    },
    {
      key: 'appUpdates',
      title: 'Uygulama güncelleme bildirimleri',
      desc: 'Yeni sürüm ve özellik paketleri yayınlandığında bilgi verir'
    }
  ];

  return (
    <div className="pb-28 space-y-4">
      {/* Top Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="v22-surface-pill min-h-[40px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft size={16} />
          <span>Geri</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleManualScan}
            disabled={scanning}
            className="v22-surface-pill min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold disabled:opacity-60"
          >
            <RefreshCw size={15} className={scanning ? 'animate-spin' : ''} />
            <span>Vadeleri kontrol et</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrefs((v) => !v)}
            className="v22-surface-pill min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold"
          >
            <SlidersHorizontal size={15} />
            <span>Bildirim ayarları</span>
          </button>

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearNotifications}
              className="min-h-[40px] px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
            >
              <Trash2 size={15} />
              <span>Temizle</span>
            </button>
          )}
        </div>
      </div>

      {/* Device Permission & Test Card */}
      <div className="v22-bento-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              permState === 'granted'
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-amber-500/15 text-amber-500'
            }`}
          >
            <Bell size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Cihaz bildirim izni</h3>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                  permState === 'granted'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : permState === 'denied'
                    ? 'bg-rose-500/15 text-rose-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {permState === 'granted'
                  ? 'Aktif'
                  : permState === 'denied'
                  ? 'Engellendi (Tarayıcı/Cihaz ayarlarından açın)'
                  : 'Onay bekliyor'}
              </span>
            </div>
            <p className="text-xs opacity-75 mt-0.5">
              Telefon, masaüstü uygulaması ve web tarayıcısında anlık bildirim almak için cihaz iznini açık tutun.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {permState !== 'granted' ? (
            <button
              type="button"
              onClick={handleRequestPerm}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              İzin ver
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendTest}
              className="v22-surface-pill min-h-[40px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Send size={14} />
              <span>Test bildirimi gönder</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible 5-Category Preferences */}
      {showPrefs && (
        <div className="v22-bento-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Bildirim kanalları</h4>
            <span className="text-xs opacity-65">Hesabınızla tüm cihazlarda senkronize</span>
          </div>
          <div className="divide-y divide-white/10">
            {prefRows.map((row) => {
              const enabled = prefs[row.key];
              return (
                <div key={row.key} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-medium">{row.title}</div>
                    <div className="text-[11px] opacity-70 mt-0.5">{row.desc}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => togglePref(row.key)}
                    className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 flex items-center ${
                      enabled ? 'bg-emerald-600 justify-end' : 'bg-stone-700 justify-start'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white shadow-sm block" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile-Safe Scrollable Category Filter Rail */}
      <div className="mks-tab-rail flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {filterTabs.map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`shrink-0 min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                active ? 'v22-dark-pill' : 'v22-surface-pill opacity-80 hover:opacity-100'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div className="v22-bento-card flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-stone-900/60 flex items-center justify-center mb-3 border border-white/10">
            <Bell size={28} className="opacity-45" />
          </div>
          <h3 className="font-semibold text-base mb-1">Görüntülenecek bildirim yok</h3>
          <p className="opacity-65 text-xs max-w-xs leading-relaxed">
            Vadesi yaklaşan ödeme, çek-senet-kart, günlük aranacaklar veya hava durumu uyarısı oluştuğunda burada listelenir.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((item) => (
            <div key={item.id} className="v22-bento-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-950/40 border border-white/10 flex items-center justify-center shrink-0">
                  {getCategoryIcon(item.category, item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm leading-snug">{item.title}</h4>
                    <span className="text-[11px] opacity-60 shrink-0 tabular-nums">
                      {new Date(item.date).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm opacity-80 leading-relaxed mt-1">{item.message}</p>
                </div>
              </div>

              {/* Daily Call List Interactive Items */}
              {item.callItems && item.callItems.length > 0 && (
                <div className="rounded-xl border border-white/10 divide-y divide-white/10 overflow-hidden">
                  {item.callItems.map((call) => (
                    <div
                      key={call.id}
                      className="px-3 py-2.5 flex items-center justify-between gap-2 bg-stone-950/25"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{call.name}</div>
                        <div className="text-[11px] opacity-70 truncate">
                          {call.reason}
                          {typeof call.amount === 'number' && call.amount > 0
                            ? ` • ${Math.round(call.amount).toLocaleString('tr-TR')} ₺`
                            : ''}
                        </div>
                      </div>
                      {toTelHref(call.phone) && (
                        <a
                          href={toTelHref(call.phone)}
                          className="shrink-0 min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Phone size={13} />
                          <span>Ara</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {item.targetView && onNavigate && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onNavigate(item.targetView!)}
                    className="v22-surface-pill min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <span>{item.actionLabel || 'İlgili ekrana git'}</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

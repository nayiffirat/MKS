import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  AgriCity,
  AppNotification,
  CollectionLog,
  Farmer,
  MyPayment,
  NotificationCallItem,
  NotificationCategory,
  NotificationPreferences,
  Payment,
  Prescription,
  Reminder,
  Supplier,
  SupplierPayment,
  UserProfile,
  ViewState
} from '../types';
import { AGRI_CITIES, WeatherService } from '../services/weather';
import { API_BASE } from './api';
import { safeStringify } from './json';

export const MKS_CLIENT_VERSION = '8.2.1';
export const MKS_CLIENT_BUILD = 28;
export const MKS_ALERT_CHANNEL_ID = 'mks_smart_alerts';

const SENT_LOG_STORAGE_KEY = 'mks_smart_notif_sent_v2';
const PREFS_FALLBACK_KEY = 'mks_notif_prefs_v1';
const DISMISS_PROMPT_KEY = 'mks_notif_prompt_dismissed_until';

export type PlatformPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  paymentDue: true,
  checkNoteCard: true,
  dailyCallList: true,
  weatherAlerts: true,
  appUpdates: true
};

let listenersInitialized = false;

export function getEffectiveNotificationPrefs(profile?: UserProfile | null): NotificationPreferences {
  if (profile?.notificationPrefs) {
    return { ...DEFAULT_NOTIFICATION_PREFS, ...profile.notificationPrefs };
  }
  try {
    const raw = localStorage.getItem(PREFS_FALLBACK_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export function saveNotificationPrefsLocally(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(PREFS_FALLBACK_KEY, safeStringify(prefs));
  } catch {}
}

export function isPermissionBannerDismissed(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_PROMPT_KEY) || '0');
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function dismissPermissionBannerFor24h(): void {
  try {
    localStorage.setItem(DISMISS_PROMPT_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    window.dispatchEvent(new CustomEvent('mks-notif-perm-changed'));
  } catch {}
}

export async function initNotificationInfrastructure(
  onNavigate?: (view: ViewState) => void
): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Register Web / Desktop Service Worker (/sw.js)
  if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      reg.update().catch(() => {});

      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'MKS_NOTIFICATION_CLICK' && data.targetView && onNavigate) {
          onNavigate(data.targetView as ViewState);
        }
      });
    } catch (err) {
      console.warn('Service Worker kaydı atlandı:', err);
    }
  }

  // 2. Native Android/iOS channel + tap listener
  if (Capacitor.isNativePlatform() && !listenersInitialized) {
    listenersInitialized = true;
    try {
      await LocalNotifications.createChannel({
        id: MKS_ALERT_CHANNEL_ID,
        name: 'MKS Vade, Saha ve Hava Uyarıları',
        description: 'Ödeme, çek-senet-kart, günlük aranacaklar, hava durumu ve sürüm bildirimleri',
        importance: 5,
        visibility: 1,
        vibration: true
      });
    } catch {}

    try {
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const targetView = action?.notification?.extra?.targetView as ViewState | undefined;
        if (targetView && onNavigate) {
          onNavigate(targetView);
        }
      });
    } catch {}
  }
}

export async function getNotificationPermissionStatus(): Promise<PlatformPermissionState> {
  if (typeof window === 'undefined') return 'unsupported';

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'granted') return 'granted';
      if (perm.display === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  if (!('Notification' in window)) {
    return 'unsupported';
  }
  if (window.Notification.permission === 'granted') return 'granted';
  if (window.Notification.permission === 'denied') return 'denied';
  return 'prompt';
}

export async function requestAllPlatformNotificationPermissions(): Promise<PlatformPermissionState> {
  if (typeof window === 'undefined') return 'unsupported';

  let result: PlatformPermissionState = 'unsupported';

  if (Capacitor.isNativePlatform()) {
    try {
      const req = await LocalNotifications.requestPermissions();
      result = req.display === 'granted' ? 'granted' : req.display === 'denied' ? 'denied' : 'prompt';
      if (result === 'granted') {
        await LocalNotifications.createChannel({
          id: MKS_ALERT_CHANNEL_ID,
          name: 'MKS Vade, Saha ve Hava Uyarıları',
          description: 'Ödeme, çek-senet-kart, günlük aranacaklar, hava durumu ve sürüm bildirimleri',
          importance: 5,
          visibility: 1,
          vibration: true
        }).catch(() => {});
      }
    } catch {
      result = 'denied';
    }
  } else if ('Notification' in window) {
    try {
      const timeoutPromise = new Promise<NotificationPermission>((resolve) =>
        setTimeout(() => resolve(window.Notification.permission || 'default'), 4000)
      );
      const permResult = await Promise.race([
        window.Notification.requestPermission(),
        timeoutPromise
      ]);
      result = permResult === 'granted' ? 'granted' : permResult === 'denied' ? 'denied' : 'prompt';
    } catch {
      result = 'denied';
    }
  }

  try {
    localStorage.removeItem(DISMISS_PROMPT_KEY);
    window.dispatchEvent(new CustomEvent('mks-notif-perm-changed', { detail: { status: result } }));
  } catch {}

  return result;
}

const hashId = (key: string): number => {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) - h + key.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 10001;
};

export async function dispatchOsNotification(params: {
  title: string;
  body: string;
  tag: string;
  targetView?: ViewState;
}): Promise<boolean> {
  const perm = await getNotificationPermissionStatus();
  if (perm !== 'granted') return false;

  const { title, body, tag, targetView = 'NOTIFICATIONS' } = params;

  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashId(`${tag}-${Date.now()}`),
            title,
            body,
            channelId: MKS_ALERT_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 600), allowWhileIdle: true },
            sound: 'default',
            extra: { targetView }
          }
        ]
      });
      return true;
    } catch (err) {
      console.warn('Native bildirim gönderilemedi:', err);
      return false;
    }
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/favicon.png',
          tag,
          data: { targetView, url: '/' }
        } as NotificationOptions);
        return true;
      }
    }
  } catch {}

  try {
    if ('Notification' in window && window.Notification.permission === 'granted') {
      const n = new window.Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        tag
      });
      n.onclick = () => {
        window.focus();
        window.dispatchEvent(
          new CustomEvent('mks-navigate-from-notif', { detail: { targetView } })
        );
        n.close();
      };
      return true;
    }
  } catch {}

  return false;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysFromToday(dateStr?: string): number | null {
  if (!dateStr) return null;
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function readSentLog(todayIso: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(SENT_LOG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    // Keep entries from last 14 days
    const cutoff = Date.now() - 14 * 86_400_000;
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const t = new Date(v).getTime();
      if (!isNaN(t) && t >= cutoff) {
        cleaned[k] = v;
      } else if (v === todayIso) {
        cleaned[k] = v;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeSentLog(log: Record<string, string>): void {
  try {
    localStorage.setItem(SENT_LOG_STORAGE_KEY, safeStringify(log));
  } catch {}
}

const formatTry = (amount: number): string =>
  `${Math.round(Math.abs(amount)).toLocaleString('tr-TR')} ₺`;

export async function scheduleNativeDueAlarms(
  myPayments: MyPayment[],
  dailyCallCount: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const perm = await getNotificationPermissionStatus();
  if (perm !== 'granted') return;

  try {
    // 1. Morning 09:00 Daily Call & Collection Briefing
    const morningTime = new Date();
    morningTime.setHours(9, 0, 0, 0);
    if (Date.now() >= morningTime.getTime()) {
      morningTime.setDate(morningTime.getDate() + 1);
    }
    await LocalNotifications.cancel({ notifications: [{ id: 999998 }] }).catch(() => {});
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999998,
          title: 'Günlük aranacaklar ve vade özeti',
          body:
            dailyCallCount > 0
              ? `Bugün aranması gereken ${dailyCallCount} kişi ve vade kaydı bulunuyor.`
              : 'Bugün için bekleyen acil arama kaydı bulunmuyor. Bereketli mesailer.',
          channelId: MKS_ALERT_CHANNEL_ID,
          schedule: { at: morningTime, allowWhileIdle: true },
          sound: 'default',
          extra: { targetView: 'NOTIFICATIONS' }
        }
      ]
    });

    // 2. Schedule next 15 upcoming Check / Note / Card due dates (1 day before at 09:30)
    const upcoming = (myPayments || [])
      .filter((mp) => !mp.deletedAt && mp.status === 'PENDING' && mp.dueDate)
      .map((mp) => ({ mp, diff: daysFromToday(mp.dueDate) }))
      .filter((x) => x.diff !== null && x.diff >= 1 && x.diff <= 14)
      .slice(0, 15);

    if (upcoming.length > 0) {
      const toSchedule = upcoming
        .map(({ mp }) => {
          const [y, m, d] = mp.dueDate.slice(0, 10).split('-').map(Number);
          const alarmAt = new Date(y, m - 1, d - 1, 9, 30, 0, 0);
          if (alarmAt.getTime() <= Date.now()) return null;
          const label =
            mp.type === 'CHECK'
              ? 'Çek'
              : mp.type === 'PROMISSORY_NOTE'
              ? 'Senet'
              : mp.type === 'CARD_INSTALLMENT' || mp.type === 'DEFERRED_CARD'
              ? 'Kart'
              : 'Ödeme';
          const party = mp.farmerName || mp.supplierName || 'Cari';
          return {
            id: hashId(`due-mp-${mp.id}`),
            title: `${label} vadesi yarın doluyor`,
            body: `${party} • ${formatTry(mp.amount)} tutarındaki ${label.toLowerCase()} yarın vadeli.`,
            channelId: MKS_ALERT_CHANNEL_ID,
            schedule: { at: alarmAt, allowWhileIdle: true },
            sound: 'default',
            extra: { targetView: 'PAYMENTS' }
          };
        })
        .filter(Boolean) as any[];

      if (toSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: toSchedule }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Yerel vade alarmları planlanamadı:', err);
  }
}

export interface SmartAuditInput {
  userProfile: UserProfile;
  farmers: Farmer[];
  suppliers: Supplier[];
  prescriptions: Prescription[];
  payments: Payment[];
  myPayments: MyPayment[];
  supplierPayments?: SupplierPayment[];
  reminders: Reminder[];
  collectionLogs: CollectionLog[];
  forceManualScan?: boolean;
  onEmitNotification: (notif: Omit<AppNotification, 'id' | 'date' | 'isRead'>) => Promise<void>;
}

export async function runUnifiedSmartNotificationCheck(input: SmartAuditInput): Promise<number> {
  const {
    userProfile,
    farmers,
    suppliers,
    prescriptions,
    payments,
    myPayments,
    supplierPayments = [],
    reminders,
    collectionLogs,
    forceManualScan = false,
    onEmitNotification
  } = input;

  const prefs = getEffectiveNotificationPrefs(userProfile);
  const todayIso = getTodayIso();
  const sentLog = readSentLog(todayIso);
  let emittedCount = 0;

  const farmerMap = new Map<string, Farmer>();
  for (const f of farmers || []) {
    if (!f.deletedAt) farmerMap.set(f.id, f);
  }
  const supplierMap = new Map<string, Supplier>();
  for (const s of suppliers || []) {
    if (!s.deletedAt) supplierMap.set(s.id, s);
  }

  const emitOnce = async (
    dedupKey: string,
    payload: {
      type: AppNotification['type'];
      category: NotificationCategory;
      title: string;
      message: string;
      targetView: ViewState;
      actionLabel: string;
      callItems?: NotificationCallItem[];
    }
  ) => {
    if (!forceManualScan && sentLog[dedupKey]) return;
    sentLog[dedupKey] = new Date().toISOString();
    emittedCount += 1;
    await onEmitNotification(payload);
    await dispatchOsNotification({
      title: payload.title,
      body: payload.message,
      tag: dedupKey,
      targetView: payload.targetView
    });
  };

  // =========================================================================
  // 1. ÖDEME YAKLAŞTI BİLDİRİMİ (Vadeli Reçete Alacakları & Tedarikçi Ödemeleri)
  // =========================================================================
  if (prefs.paymentDue) {
    const duePrescriptions = (prescriptions || []).filter((p) => {
      if (p.deletedAt || p.priceType !== 'TERM' || !p.dueDate) return false;
      const farmer = farmerMap.get(p.farmerId);
      if (!farmer || (farmer.balance || 0) >= -1) return false;
      const diff = daysFromToday(p.dueDate);
      return diff !== null && diff >= -7 && diff <= 3;
    });

    const dueSupplierPays = (supplierPayments || []).filter((sp) => {
      if (sp.deletedAt || sp.isPaid || !sp.dueDate) return false;
      const diff = daysFromToday(sp.dueDate);
      return diff !== null && diff >= -7 && diff <= 3;
    });

    const totalCount = duePrescriptions.length + dueSupplierPays.length;
    if (totalCount > 0) {
      const totalAmt =
        duePrescriptions.reduce((s, p) => s + Math.abs(Number(p.totalAmount) || 0), 0) +
        dueSupplierPays.reduce((s, sp) => s + Math.abs(Number(sp.amount) || 0), 0);
      const firstFarmer = duePrescriptions[0]
        ? farmerMap.get(duePrescriptions[0].farmerId)?.fullName
        : dueSupplierPays[0]
        ? supplierMap.get(dueSupplierPays[0].supplierId)?.name
        : '';

      await emitOnce(`payment-due-${todayIso}-${totalCount}`, {
        type: 'WARNING',
        category: 'PAYMENT_DUE',
        title: 'Ödeme vadesi yaklaştı',
        message: `${
          firstFarmer ? `${firstFarmer} dahil ` : ''
        }${totalCount} vadeli ödeme/tahsilat kaydının vadesi geldi veya 3 gün içinde doluyor (${formatTry(totalAmt)}).`,
        targetView: 'DEBT_TRACKING',
        actionLabel: 'Vadeli Alacakları Gör'
      });
    }
  }

  // =========================================================================
  // 2. ÇEK, SENET VE KART VADE BİLDİRİMLERİ
  // =========================================================================
  if (prefs.checkNoteCard) {
    const dueInstruments = (myPayments || []).filter((mp) => {
      if (mp.deletedAt || mp.status !== 'PENDING' || !mp.dueDate) return false;
      const diff = daysFromToday(mp.dueDate);
      return diff !== null && diff >= -7 && diff <= 3;
    });

    const dueCardUnblocks = (payments || []).filter((p) => {
      if (p.deletedAt) return false;
      if (p.method === 'CARD' && !p.isUnblocked && p.unblockDate) {
        const diff = daysFromToday(p.unblockDate);
        return diff !== null && diff >= -3 && diff <= 3;
      }
      return false;
    });

    const checkCount = dueInstruments.filter((m) => m.type === 'CHECK').length;
    const noteCount = dueInstruments.filter((m) => m.type === 'PROMISSORY_NOTE').length;
    const cardCount =
      dueInstruments.filter((m) => m.type === 'CARD_INSTALLMENT' || m.type === 'DEFERRED_CARD').length +
      dueCardUnblocks.length;
    const otherCount = dueInstruments.length - checkCount - noteCount -
      dueInstruments.filter((m) => m.type === 'CARD_INSTALLMENT' || m.type === 'DEFERRED_CARD').length;

    const totalEvrak = dueInstruments.length + dueCardUnblocks.length;
    if (totalEvrak > 0) {
      const totalEvrakAmt =
        dueInstruments.reduce((s, m) => s + Math.abs(Number(m.amount) || 0), 0) +
        dueCardUnblocks.reduce((s, c) => s + Math.abs(Number(c.amount) || 0), 0);

      const parts: string[] = [];
      if (checkCount > 0) parts.push(`${checkCount} çek`);
      if (noteCount > 0) parts.push(`${noteCount} senet`);
      if (cardCount > 0) parts.push(`${cardCount} kart taksit/bloke`);
      if (otherCount > 0) parts.push(`${otherCount} tediye`);

      await emitOnce(`check-note-card-${todayIso}-${totalEvrak}`, {
        type: 'WARNING',
        category: 'CHECK_NOTE_CARD',
        title: 'Çek, senet ve kart vade bildirimi',
        message: `Bugün ve önümüzdeki 3 gün içinde ${parts.join(', ')} kaydının vadesi bulunuyor (Toplam ${formatTry(
          totalEvrakAmt
        )}).`,
        targetView: 'PAYMENTS',
        actionLabel: 'Çek, Senet ve Kartları Aç'
      });
    }
  }

  // =========================================================================
  // 3. GÜNLÜK ARANMASI GEREKENLER LİSTESİ BİLDİRİMİ
  // =========================================================================
  const callItemsMap = new Map<string, NotificationCallItem>();

  // 3a. Collection logs with nextCallDate <= today where farmer still owes
  for (const log of collectionLogs || []) {
    if (log.deletedAt || log.status === 'PAID' || !log.nextCallDate) continue;
    const diff = daysFromToday(log.nextCallDate);
    if (diff !== null && diff <= 0) {
      const f = farmerMap.get(log.farmerId);
      if (f && (f.balance || 0) < -1) {
        callItemsMap.set(`f-${f.id}`, {
          id: f.id,
          name: f.fullName,
          phone: f.phoneNumber,
          reason: diff === 0 ? 'Bugün ödeme/arama sözü' : `${Math.abs(diff)} gün geciken arama sözü`,
          amount: Math.abs(f.balance || 0)
        });
      }
    }
  }

  // 3b. Active reminders scheduled for today
  for (const rem of reminders || []) {
    if (rem.isCompleted || !rem.date) continue;
    if (rem.date.slice(0, 10) === todayIso) {
      if (rem.farmerIds && rem.farmerIds.length > 0) {
        for (const fid of rem.farmerIds) {
          const f = farmerMap.get(fid);
          if (f && !callItemsMap.has(`f-${f.id}`)) {
            callItemsMap.set(`f-${f.id}`, {
              id: f.id,
              name: f.fullName,
              phone: f.phoneNumber,
              reason: rem.title || 'Bugünkü ajanda görevi',
              amount: (f.balance || 0) < -1 ? Math.abs(f.balance || 0) : undefined
            });
          }
        }
      } else {
        callItemsMap.set(`r-${rem.id}`, {
          id: rem.id,
          name: rem.title,
          reason: rem.description || 'Bugünkü planlı hatırlatıcı'
        });
      }
    }
  }

  // 3c. Checks / Notes / Term Prescriptions due TODAY
  for (const mp of myPayments || []) {
    if (mp.deletedAt || mp.status !== 'PENDING' || !mp.dueDate) continue;
    if (daysFromToday(mp.dueDate) === 0) {
      const f = mp.farmerId ? farmerMap.get(mp.farmerId) : undefined;
      const s = mp.supplierId ? supplierMap.get(mp.supplierId) : undefined;
      const key = f ? `f-${f.id}` : s ? `s-${s.id}` : `mp-${mp.id}`;
      if (!callItemsMap.has(key)) {
        callItemsMap.set(key, {
          id: mp.id,
          name: f?.fullName || s?.name || mp.farmerName || mp.supplierName || 'Vadesi gelen evrak',
          phone: f?.phoneNumber || s?.phoneNumber,
          reason:
            mp.type === 'CHECK'
              ? 'Bugün çek vadesi'
              : mp.type === 'PROMISSORY_NOTE'
              ? 'Bugün senet vadesi'
              : 'Bugün kart/ödeme vadesi',
          amount: Math.abs(mp.amount || 0)
        });
      }
    }
  }

  const dailyCallItems = Array.from(callItemsMap.values()).slice(0, 15);
  await scheduleNativeDueAlarms(myPayments || [], dailyCallItems.length);

  if (prefs.dailyCallList && dailyCallItems.length > 0) {
    const previewNames = dailyCallItems
      .slice(0, 3)
      .map((c) => c.name)
      .join(', ');
    const moreCount = dailyCallItems.length > 3 ? ` ve +${dailyCallItems.length - 3} kişi daha` : '';

    await emitOnce(`daily-call-list-${todayIso}-${dailyCallItems.length}`, {
      type: 'INFO',
      category: 'DAILY_CALL_LIST',
      title: `Günlük aranması gerekenler (${dailyCallItems.length} kayıt)`,
      message: `Bugün iletişime geçilmesi gereken liste: ${previewNames}${moreCount}. Bildirim detayından tek dokunuşla arayabilirsiniz.`,
      targetView: 'DEBT_TRACKING',
      actionLabel: 'Arama Listesini Aç',
      callItems: dailyCallItems
    });
  }

  // =========================================================================
  // 4. ZİRAİ HAVA DURUMU BİLDİRİMLERİ (Don, Sıcak, Kuvvetli Yağış, Rüzgar)
  // =========================================================================
  if (prefs.weatherAlerts && navigator.onLine) {
    try {
      let targetLoc: AgriCity = AGRI_CITIES[0];
      if (userProfile?.selectedCity) {
        targetLoc = userProfile.selectedCity;
      } else {
        const savedCity = localStorage.getItem('mks_selected_city');
        if (savedCity) targetLoc = JSON.parse(savedCity);
      }

      const weather = await WeatherService.getForecast(targetLoc.lat, targetLoc.lon);
      const minTemp = weather.daily.temperature_2m_min?.[0];
      const maxTemp = weather.daily.temperature_2m_max?.[0];
      const precip = weather.daily.precipitation_sum?.[0] ?? 0;
      const currentWind = weather.current?.wind_speed_10m ?? 0;

      if (typeof minTemp === 'number' && minTemp <= 2) {
        await emitOnce(`weather-frost-${todayIso}-${targetLoc.name}`, {
          type: 'WARNING',
          category: 'WEATHER_ALERT',
          title: `Zirai don uyarısı (${targetLoc.name})`,
          message: `Gece en düşük sıcaklık ${minTemp}°C seviyesine iniyor. Hassas ekili alanlar için don tedbiri alın.`,
          targetView: 'DASHBOARD',
          actionLabel: 'Hava Durumunu İncele'
        });
      } else if (typeof maxTemp === 'number' && maxTemp >= 38) {
        await emitOnce(`weather-heat-${todayIso}-${targetLoc.name}`, {
          type: 'WARNING',
          category: 'WEATHER_ALERT',
          title: `Yüksek sıcaklık uyarısı (${targetLoc.name})`,
          message: `Günün en yüksek sıcaklığı ${maxTemp}°C bekleniyor. Öğle saatlerinde ilaçlama yapmayın, sulamayı planlayın.`,
          targetView: 'DASHBOARD',
          actionLabel: 'İlaçlama Saatlerini Gör'
        });
      } else if (precip >= 10) {
        await emitOnce(`weather-rain-${todayIso}-${targetLoc.name}`, {
          type: 'WARNING',
          category: 'WEATHER_ALERT',
          title: `Yağış ve ilaçlama uyarısı (${targetLoc.name})`,
          message: `Bugün ${precip} mm yağış bekleniyor. Yıkanma riskine karşı yaprak uygulamalarını yağış sonrasına planlayın.`,
          targetView: 'DASHBOARD',
          actionLabel: 'Hava Durumunu İncele'
        });
      } else if (currentWind >= 25) {
        await emitOnce(`weather-wind-${todayIso}-${targetLoc.name}`, {
          type: 'WARNING',
          category: 'WEATHER_ALERT',
          title: `Rüzgar sürüklenme uyarısı (${targetLoc.name})`,
          message: `Anlık rüzgar hızı ${Math.round(currentWind)} km/s. İlaç sürüklenmesi (drift) riskine karşı rüzgarın düşmesini bekleyin.`,
          targetView: 'DASHBOARD',
          actionLabel: 'İlaçlama Penceresini Gör'
        });
      }
    } catch (err) {
      console.warn('Hava durumu bildirimi kontrol edilemedi:', err);
    }
  }

  // =========================================================================
  // 5. UYGULAMA GÜNCELLEME BİLDİRİMLERİ (Yerel Sürüm + Sunucu /api/version)
  // =========================================================================
  if (prefs.appUpdates) {
    try {
      const lastSeenBuild = Number(localStorage.getItem('mks_seen_app_build') || '0');
      if (lastSeenBuild !== MKS_CLIENT_BUILD) {
        localStorage.setItem('mks_seen_app_build', String(MKS_CLIENT_BUILD));
        if (lastSeenBuild > 0) {
          await emitOnce(`app-upgraded-b${MKS_CLIENT_BUILD}`, {
            type: 'SUCCESS',
            category: 'APP_UPDATE',
            title: `MKS v${MKS_CLIENT_VERSION} güncellemesi tamamlandı`,
            message:
              'Vade, çek-senet-kart, günlük aranacaklar ve hava durumu bildirimleri ile tam mobil uyum iyileştirmeleri aktif edildi.',
            targetView: 'NOTIFICATIONS',
            actionLabel: 'Yenilikleri Gör'
          });
        }
      }

      if (navigator.onLine) {
        const endpoints = Array.from(new Set([`${API_BASE}/api/version`, '/api/version']));
        for (const ep of endpoints) {
          try {
            const resp = await fetch(ep, { cache: 'no-store' });
            if (!resp.ok) continue;
            const info = await resp.json();
            const remoteBuild = Number(info?.build || 0);
            if (remoteBuild > MKS_CLIENT_BUILD) {
              await emitOnce(`app-remote-update-b${remoteBuild}`, {
                type: 'INFO',
                category: 'APP_UPDATE',
                title: `Yeni güncelleme hazır (v${info.version || 'Yeni'})`,
                message:
                  info.notes ||
                  'Yeni özellikler ve performans iyileştirmeleri yayınlandı. Uygulamayı yenileyerek hemen geçebilirsiniz.',
                targetView: 'SETTINGS',
                actionLabel: 'Güncellemeyi Yükle'
              });
            }
            break;
          } catch {}
        }
      }
    } catch {}
  }

  writeSentLog(sentLog);
  return emittedCount;
}

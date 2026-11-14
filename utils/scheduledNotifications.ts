/**
 * Zamanlı bildirimlerin cihaza kurulması.
 * - Android / iOS: işletim sistemi alarmı olarak kurulur; uygulama kapalıyken de gelir.
 * - Web / masaüstü: uygulama (sekme ya da masaüstü penceresi) açıkken zamanında gösterilir; kapalıyken kaçan bildirim
 *   uygulama açılınca (son 6 saat içindeyse) hemen gösterilir. Kapalı tarayıcıya bildirim için sunucu push gerekir (yok).
 * Her cihaz kendi eşitlenmiş verisinden planı kurar; kullanıcının giriş yaptığı her cihazda çalışır.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { buildNotificationPlan, PlanInput, PlannedNotification, ymd } from './notificationPlan';
import { dispatchOsNotification, getNotificationPermissionStatus, MKS_ALERT_CHANNEL_ID, MKS_NOTIF_ICONS } from './smartNotificationEngine';
import { requestPermission } from './permissionManager';

const ID_BASE = 880000;
const ID_COUNT = 60; // iOS aynı anda en fazla 64 bekleyen yerel bildirim tutar
const FIRED_KEY = 'mks_sched_fired_v1';
const CATCH_UP_MS = 6 * 3600 * 1000;

const readFired = (): Record<string, number> => {
  try {
    const all = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}') || {};
    const cutoff = Date.now() - 4 * 86400000;
    for (const k of Object.keys(all)) if (all[k] < cutoff) delete all[k];
    return all;
  } catch { return {}; }
};
const markFired = (key: string) => { try { const all = readFired(); all[key] = Date.now(); localStorage.setItem(FIRED_KEY, JSON.stringify(all)); } catch { /* yok say */ } };

let timers: number[] = [];
const fire = async (n: PlannedNotification) => {
  if (readFired()[n.key]) return; // başka sekme göstermiş olabilir
  markFired(n.key);
  await dispatchOsNotification({ title: n.title, body: n.body, tag: `mks-${n.key}`, targetView: n.targetView as any });
};

/** Planı yeniden hesaplar ve cihaza kurar. Veri her değiştiğinde çağrılabilir (kendi kendini yeniler). */
export async function syncScheduledNotifications(input: PlanInput): Promise<number> {
  if ((await getNotificationPermissionStatus()) !== 'granted') return 0;
  const now = new Date();

  if (Capacitor.isNativePlatform()) {
    const plan = buildNotificationPlan(input, now).slice(0, ID_COUNT);
    try {
      await LocalNotifications.cancel({ notifications: Array.from({ length: ID_COUNT }, (_, i) => ({ id: ID_BASE + i })) }).catch(() => undefined);
      await LocalNotifications.cancel({ notifications: [{ id: 999998 }] }).catch(() => undefined); // eski 09:00 özeti
      if (plan.length) {
        await LocalNotifications.schedule({
          notifications: plan.map((n, i) => ({
            id: ID_BASE + i, title: n.title, body: n.body, channelId: MKS_ALERT_CHANNEL_ID, sound: 'default', ...MKS_NOTIF_ICONS,
            schedule: { at: n.at, allowWhileIdle: true }, extra: { targetView: n.targetView }
          }))
        });
      }
    } catch (err) { console.warn('Zamanlı bildirimler kurulamadı:', err); }
    return plan.length;
  }

  // Web / masaüstü: sayfa içi zamanlayıcı + kaçanları telafi
  timers.forEach(t => window.clearTimeout(t));
  timers = [];
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const all = buildNotificationPlan(input, new Date(startOfDay.getTime() - 1));
  const fired = readFired();
  let count = 0;
  for (const n of all) {
    const dt = n.at.getTime() - now.getTime();
    if (dt <= 0) {
      if (-dt <= CATCH_UP_MS && !fired[n.key] && ymd(n.at) === ymd(now)) void fire(n);
    } else if (dt <= 24 * 3600 * 1000) {
      timers.push(window.setTimeout(() => void fire(n), dt));
      count++;
    }
  }
  return count;
}

/**
 * İlk açılışta gerekli izinleri bir kez ister.
 * Telefon (Android / iOS): bildirim, konum, kamera, mikrofon sırayla sorulur.
 * Web / masaüstü: tarayıcılar art arda izin penceresini engellediği için yalnız bildirim ve konum istenir;
 * kamera ve mikrofon ilk kullanıldıkları anda sorulur.
 */
export async function requestEssentialPermissionsOnce(): Promise<void> {
  const KEY = 'mks_perm_onboarding_v1';
  try { if (localStorage.getItem(KEY)) return; localStorage.setItem(KEY, String(Date.now())); } catch { return; }
  const keys = Capacitor.isNativePlatform() ? (['notifications', 'location', 'camera', 'microphone'] as const) : (['notifications', 'location'] as const);
  for (const k of keys) {
    try { await requestPermission(k); } catch (e) { console.warn('izin istenemedi', k, e); }
  }
}

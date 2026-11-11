import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AgriCity, AppNotification, Reminder, UserProfile } from '../types';
import { AGRI_CITIES, WeatherService } from '../services/weather';
import { safeStringify } from '../utils/json';

export const hashReminderNumericId = (id: string): number =>
  Math.abs(
    id.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0)
  );

export async function scheduleReminderNotification(reminder: Reminder): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (reminder.isCompleted) return;

    const [year, month, day] = reminder.date.split('-').map(Number);
    const rDate = new Date(year, month - 1, day);
    const notifyDate = new Date(rDate);
    notifyDate.setDate(notifyDate.getDate() - 1);
    notifyDate.setHours(20, 0, 0, 0);

    if (notifyDate.getTime() <= Date.now()) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          title: `Yarın Yapılacaklar: ${reminder.title}`,
          body: reminder.description || 'Planlanmış görevinizi unutmayın.',
          id: hashReminderNumericId(reminder.id),
          schedule: { at: notifyDate },
          sound: 'default'
        }
      ]
    });
  } catch (e) {
    console.warn('Notification scheduling failed:', e);
  }
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: hashReminderNumericId(reminderId) }] });
  } catch {}
}

export async function scheduleDailyBriefing(tomorrowCount: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 999999 }] });

    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(20, 0, 0, 0);

    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const bodyText =
      tomorrowCount > 0
        ? `Yarın için planlanmış ${tomorrowCount} göreviniz var. Hazırlıklara başlayın.`
        : `Yarın için planlanmış bir saha göreviniz yok. İyi dinlenmeler!`;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: 'Yarının saha planı',
          body: bodyText,
          channelId: 'mks_smart_alerts',
          schedule: { at: scheduledTime, allowWhileIdle: true },
          sound: 'default',
          actionTypeId: '',
          extra: { targetView: 'REMINDERS' }
        }
      ]
    });
  } catch (e) {
    console.warn('Daily briefing schedule failed:', e);
  }
}

export async function checkWeatherAlertsForProfile(
  userProfile: UserProfile,
  onNotify: (type: AppNotification['type'], title: string, message: string) => Promise<void>
): Promise<void> {
  try {
    let targetLoc: AgriCity = AGRI_CITIES[0];
    if (userProfile.selectedCity) {
      targetLoc = userProfile.selectedCity;
    } else {
      const savedCity = localStorage.getItem('mks_selected_city');
      if (savedCity) targetLoc = JSON.parse(savedCity);
    }

    const todayKey = new Date().toLocaleDateString('en-CA');
    const storedLog = localStorage.getItem('mks_daily_alert_log');
    let dailyLog: { date: string; sentTypes: string[] } = { date: todayKey, sentTypes: [] };

    if (storedLog) {
      try {
        const parsed = JSON.parse(storedLog);
        if (parsed.date === todayKey) {
          dailyLog = parsed;
          if (dailyLog.sentTypes.length > 0) return;
        }
      } catch {}
    }

    const weather = await WeatherService.getForecast(targetLoc.lat, targetLoc.lon);
    const minTemp = weather.daily.temperature_2m_min[0];
    const maxTemp = weather.daily.temperature_2m_max[0];
    const precip = weather.daily.precipitation_sum[0];

    if (minTemp <= 2) {
      await onNotify(
        'WARNING',
        `Don Riski (${targetLoc.name})`,
        `Dikkat! Gece sıcaklığı ${minTemp}°C seviyesine düşecek. Ürünlerde don riski yüksektir.`
      );
      dailyLog.sentTypes.push('FROST');
    } else if (maxTemp >= 38) {
      await onNotify(
        'WARNING',
        `Sıcaklık Uyarısı (${targetLoc.name})`,
        `Günün en yüksek sıcaklığı ${maxTemp}°C olacak. Bitki su stresine karşı sulamayı planlayın.`
      );
      dailyLog.sentTypes.push('HEAT');
    } else if (precip >= 15) {
      await onNotify(
        'WARNING',
        `Yağış Uyarısı (${targetLoc.name})`,
        `Bugün ${precip}mm yağış bekleniyor. İlaçlama planlarını revize edin.`
      );
      dailyLog.sentTypes.push('RAIN');
    }

    localStorage.setItem('mks_daily_alert_log', safeStringify(dailyLog));
  } catch (e) {
    console.error('Weather alert check failed:', e);
  }
}

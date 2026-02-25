
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { dbService } from '../services/db';
import { WeatherService, AGRI_CITIES } from '../services/weather';
import { Farmer, UIScale, AppNotification, UserProfile, Reminder, VisitLog, AgriCity } from '../types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { auth } from '../services/firebase';

interface DashboardStats {
  totalFarmers: number;
  todayPrescriptions: number;
  pendingVisits: number;
  activeReminders: number;
  tomorrowReminders: number; // Yeni istatistik
}

interface AppContextType {
  stats: DashboardStats;
  refreshStats: (syncedReminders?: Reminder[]) => Promise<void>;
  addFarmer: (farmer: Omit<Farmer, 'id'>) => Promise<void>;
  updateFarmer: (farmer: Farmer) => Promise<void>;
  deleteFarmer: (id: string) => Promise<void>;
  bulkAddFarmers: (farmers: Omit<Farmer, 'id'>[]) => Promise<void>;
  farmers: Farmer[];
  reminders: Reminder[];
  addReminder: (reminder: Omit<Reminder, 'id'>) => Promise<void>;
  editReminder: (id: string, updates: Partial<Reminder>) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  uiScale: UIScale;
  setUiScale: (scale: UIScale) => void;
  notifications: AppNotification[];
  unreadCount: number;
  clearNotifications: () => void;
  markAllAsRead: () => void;
  userProfile: UserProfile;
  updateUserProfile: (profile: UserProfile) => void;
  addSystemNotification: (type: AppNotification['type'], title: string, message: string) => Promise<void>;
  updateVisit: (visit: VisitLog) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_PROFILE: UserProfile = {
  fullName: '',
  phoneNumber: '',
  companyName: '',
  title: '',
  assistantVoice: 'FEMALE'
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalFarmers: 0,
    todayPrescriptions: 0,
    pendingVisits: 0,
    activeReminders: 0,
    tomorrowReminders: 0
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const isInitialized = useRef(false);

  const [uiScale, setUiScaleState] = useState<UIScale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mks_ui_scale');
      return (saved as UIScale) || 'SMALL';
    }
    return 'SMALL';
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('mks_user_profile');
            const parsed = saved ? JSON.parse(saved) : DEFAULT_PROFILE;
            return { ...DEFAULT_PROFILE, ...parsed };
        } catch (e) {
            console.error("Profile load error", e);
            return DEFAULT_PROFILE;
        }
    }
    return DEFAULT_PROFILE;
  });

  const refreshNotifications = async () => {
      const list = await dbService.getNotifications();
      setNotifications(list);
  };

  const cleanupOldData = async () => {
      await dbService.cleanupOldNotifications();
      await refreshNotifications();
  };

  const updateUserProfile = (profile: UserProfile) => {
      setUserProfile(profile);
      localStorage.setItem('mks_user_profile', JSON.stringify(profile));
      
      // Firebase Sync
      const user = auth.currentUser;
      if (user) {
          dbService.saveUserProfile(user.uid, profile);
      }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const clearNotifications = async () => {
      const promises = notifications.map(n => dbService.deleteNotification(n.id));
      await Promise.all(promises);
      setNotifications([]);
  };

  const markAllAsRead = async () => {
      const updated = notifications.map(n => ({ ...n, isRead: true }));
      setNotifications(updated);
      const promises = updated.map(n => dbService.updateNotification(n));
      await Promise.all(promises);
  };

  const addSystemNotification = async (type: AppNotification['type'], title: string, message: string) => {
      const newNotif: AppNotification = {
          id: crypto.randomUUID(),
          type,
          title,
          message,
          date: new Date().toISOString(),
          isRead: false
      };
      await dbService.addNotification(newNotif);
      await refreshNotifications();
  };

  const scheduleReminderNotification = async (reminder: Reminder) => {
    try {
        if (reminder.isCompleted) return;

        const [year, month, day] = reminder.date.split('-').map(Number);
        const rDate = new Date(year, month - 1, day);
        const notifyDate = new Date(rDate);
        notifyDate.setDate(notifyDate.getDate() - 1);
        notifyDate.setHours(20, 0, 0, 0);

        if (notifyDate.getTime() <= Date.now()) return;

        const numericId = Math.abs(reminder.id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));

        await LocalNotifications.schedule({
            notifications: [
                {
                    title: `Yarın Yapılacaklar: ${reminder.title}`,
                    body: reminder.description || "Planlanmış görevinizi unutmayın.",
                    id: numericId,
                    schedule: { at: notifyDate },
                    sound: 'default'
                }
            ]
        });
    } catch (e) {
        console.warn("Notification scheduling failed:", e);
    }
  };

  const cancelReminderNotification = async (reminderId: string) => {
    try {
        const numericId = Math.abs(reminderId.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0));
        await LocalNotifications.cancel({ notifications: [{ id: numericId }] });
    } catch (e) {}
  };

  // --- GÜNLÜK ÖZET BİLDİRİMİ (Akşam 20:00) ---
  const scheduleDailyBriefing = async (tomorrowCount: number) => {
    try {
        // Her seferinde eski günlük bildirimi sil (ID: 999999)
        await LocalNotifications.cancel({ notifications: [{ id: 999999 }] });

        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(20, 0, 0, 0);

        // Eğer saat 20:00'ı geçtiyse, yarına kur
        if (now > scheduledTime) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        const bodyText = tomorrowCount > 0 
            ? `Yarın için planlanmış ${tomorrowCount} göreviniz var. Hazırlıklara başlayın.`
            : `Yarın için planlanmış bir saha göreviniz yok. İyi dinlenmeler!`;

        await LocalNotifications.schedule({
            notifications: [{
                id: 999999,
                title: "🗓️ Yarının Planı",
                body: bodyText,
                schedule: { at: scheduledTime, allowWhileIdle: true },
                sound: 'default',
                actionTypeId: '',
                extra: null
            }]
        });
        
    } catch (e) {
        console.warn("Daily briefing schedule failed:", e);
    }
  };

  const checkWeatherAlerts = async () => {
    try {
        let targetLoc: AgriCity = AGRI_CITIES[0];
        if (userProfile.selectedCity) {
            targetLoc = userProfile.selectedCity;
        } else {
            const savedCity = localStorage.getItem('mks_selected_city');
            if (savedCity) targetLoc = JSON.parse(savedCity);
        }

        // Günlük kontrol mekanizması (LocalStorage tabanlı)
        const todayKey = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD formatı
        const storedLog = localStorage.getItem('mks_daily_alert_log');
        let dailyLog: { date: string, sentTypes: string[] } = { date: todayKey, sentTypes: [] };

        if (storedLog) {
            try {
                const parsed = JSON.parse(storedLog);
                if (parsed.date === todayKey) {
                    dailyLog = parsed;
                    // Eğer bugün ZATEN herhangi bir hava durumu bildirimi gönderilmişse, çık.
                    if (dailyLog.sentTypes.length > 0) return;
                }
            } catch (e) {}
        }

        const weather = await WeatherService.getForecast(targetLoc.lat, targetLoc.lon);
        const minTemp = weather.daily.temperature_2m_min[0];
        const maxTemp = weather.daily.temperature_2m_max[0];
        const precip = weather.daily.precipitation_sum[0];

        // Sadece bir tane bildirim gönderilir (Öncelik sırasına göre)
        if (minTemp <= 2) {
            // 1. Don Riski Kontrolü
            await addSystemNotification('WARNING', `Don Riski (${targetLoc.name})`, `Dikkat! Gece sıcaklığı ${minTemp}°C seviyesine düşecek. Ürünlerde don riski yüksektir.`);
            dailyLog.sentTypes.push('FROST');
        } else if (maxTemp >= 38) {
            // 2. Sıcaklık Uyarısı Kontrolü
            await addSystemNotification('WARNING', `Sıcaklık Uyarısı (${targetLoc.name})`, `Günün en yüksek sıcaklığı ${maxTemp}°C olacak. Bitki su stresine karşı sulamayı planlayın.`);
            dailyLog.sentTypes.push('HEAT');
        } else if (precip >= 15) {
            // 3. Yağış Uyarısı Kontrolü
            await addSystemNotification('WARNING', `Yağış Uyarısı (${targetLoc.name})`, `Bugün ${precip}mm yağış bekleniyor. İlaçlama planlarını revize edin.`);
            dailyLog.sentTypes.push('RAIN');
        }

        // Logu kaydet
        localStorage.setItem('mks_daily_alert_log', JSON.stringify(dailyLog));

    } catch (e) {
        console.error("Weather alert check failed:", e);
    }
  };

  const refreshStats = async (syncedReminders?: Reminder[]) => {
    const [farmerList, prescriptions, visits, reminderListFromDB] = await Promise.all([
        dbService.getFarmers(),
        dbService.getAllPrescriptions(),
        dbService.getAllVisits(),
        dbService.getReminders()
    ]);

    const finalReminders = syncedReminders || reminderListFromDB;
    
    if (syncedReminders) {
        await LocalNotifications.cancel({ notifications: syncedReminders.map(r => ({ id: Math.abs(r.id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)) })) });
        for (const r of syncedReminders) {
            await scheduleReminderNotification(r);
        }
    }

    // Yarının tarihini bul (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todayStr = new Date().toISOString().split('T')[0];
    const todaysPrescriptionsCount = prescriptions.filter(p => p.date.startsWith(todayStr)).length;
    
    // Yarının görevlerini hesapla
    const tomorrowRemindersCount = finalReminders.filter(r => r.date === tomorrowStr && !r.isCompleted).length;

    // Günlük özeti planla (Her veri değişiminde o anki duruma göre 20:00'ı günceller)
    await scheduleDailyBriefing(tomorrowRemindersCount);

    setReminders(finalReminders);
    setFarmers(farmerList);
    
    setStats({
      totalFarmers: farmerList.length,
      todayPrescriptions: todaysPrescriptionsCount,
      pendingVisits: visits.length,
      activeReminders: finalReminders.filter(r => !r.isCompleted).length,
      tomorrowReminders: tomorrowRemindersCount
    });
    
    await refreshNotifications();
  };

  const addFarmer = async (farmerData: Omit<Farmer, 'id'>) => {
    const newFarmer: Farmer = { ...farmerData, id: crypto.randomUUID() };
    await dbService.addFarmer(newFarmer);
    await refreshStats();
  };

  const updateFarmer = async (farmer: Farmer) => {
    await dbService.updateFarmer(farmer);
    await refreshStats();
  };

  const deleteFarmer = async (id: string) => {
    await dbService.deleteFarmer(id);
    await refreshStats();
  };

  const bulkAddFarmers = async (farmersData: Omit<Farmer, 'id'>[]) => {
    const promises = farmersData.map(data => dbService.addFarmer({ ...data, id: crypto.randomUUID() }));
    await Promise.all(promises);
    await refreshStats();
  };

  const addReminder = async (reminderData: Omit<Reminder, 'id'>) => {
      const newReminder: Reminder = { ...reminderData, id: crypto.randomUUID() };
      await dbService.addReminder(newReminder);
      await scheduleReminderNotification(newReminder);
      await refreshStats();
  };

  const editReminder = async (id: string, updates: Partial<Reminder>) => {
      const existing = reminders.find(r => r.id === id);
      if (!existing) return;

      const updatedReminder = { ...existing, ...updates };
      await dbService.updateReminder(updatedReminder);
      
      await cancelReminderNotification(id);
      if (!updatedReminder.isCompleted) {
          await scheduleReminderNotification(updatedReminder);
      }
      await refreshStats();
  };

  const toggleReminder = async (id: string) => {
      const reminder = reminders.find(r => r.id === id);
      if (!reminder) return;

      // 1. Durum: Görev zaten tamamlanmışsa, geri al (işaretini kaldır)
      if (reminder.isCompleted) {
          const updated = { ...reminder, isCompleted: false };
          await dbService.updateReminder(updated);
          await scheduleReminderNotification(updated);
      } 
      // 2. Durum: Görev tamamlanıyor
      else {
          // A) Mevcut görevi tamamlandı olarak işaretle (Biten sekmesine gider)
          const completedReminder = { ...reminder, isCompleted: true };
          await dbService.updateReminder(completedReminder);
          await cancelReminderNotification(id); // Tamamlandığı için bildirim iptal

          // B) Eğer tekrarlı bir görevse, bir sonraki tarih için YENİ bir görev oluştur
          if (reminder.recurrence !== 'NONE') {
              const nextDate = new Date(reminder.date);
              
              if (reminder.recurrence === 'DAILY') {
                  nextDate.setDate(nextDate.getDate() + 1);
              } else if (reminder.recurrence === 'WEEKLY') {
                  nextDate.setDate(nextDate.getDate() + 7);
              } else if (reminder.recurrence === 'MONTHLY') {
                  nextDate.setMonth(nextDate.getMonth() + 1);
              }
              
              const nextReminder: Reminder = {
                  ...reminder,
                  id: crypto.randomUUID(), // Yeni ID
                  date: nextDate.toISOString().split('T')[0], // Yeni Tarih
                  isCompleted: false // Yeni görev aktif başlar
              };

              await dbService.addReminder(nextReminder);
              await scheduleReminderNotification(nextReminder);
          }
      }
      await refreshStats();
  };

  const deleteReminder = async (id: string) => {
      await cancelReminderNotification(id);
      await dbService.deleteReminder(id);
      await refreshStats();
  };

  const updateVisit = async (visit: VisitLog) => {
    await dbService.updateVisit(visit);
    await refreshStats();
  };

  const deleteVisit = async (id: string) => {
    await dbService.deleteVisit(id);
    await refreshStats();
  };

  const setUiScale = (scale: UIScale) => {
    setUiScaleState(scale);
    localStorage.setItem('mks_ui_scale', scale);
  };

  useEffect(() => {
    const root = document.documentElement;
    switch (uiScale) {
      case 'SMALL': root.style.fontSize = '14px'; break;
      case 'MEDIUM': root.style.fontSize = '16px'; break;
      case 'LARGE': root.style.fontSize = '18.5px'; break;
    }
  }, [uiScale]);

  useEffect(() => {
    const init = async () => {
        if (isInitialized.current) return;
        
        await cleanupOldData();
        await refreshStats();
        await checkWeatherAlerts();
        
        try {
            const permission = await LocalNotifications.requestPermissions();
            if (permission.display !== 'granted') console.warn("Bildirim izinleri verilmedi.");
        } catch (e) {}

        isInitialized.current = true;
    };
    init();
  }, []);

  return (
    <AppContext.Provider value={{ 
        stats, refreshStats, addFarmer, updateFarmer, deleteFarmer, bulkAddFarmers, 
        farmers, reminders, addReminder, editReminder, toggleReminder, deleteReminder,
        uiScale, setUiScale, 
        notifications, unreadCount, clearNotifications, markAllAsRead,
        userProfile, updateUserProfile, addSystemNotification,
        updateVisit, deleteVisit
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppViewModel = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppViewModel must be used within AppProvider');
  return context;
};

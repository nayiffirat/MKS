
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { dbService } from '../services/db';
import { WeatherService, AGRI_CITIES } from '../services/weather';
import { Farmer, UIScale, AppNotification, UserProfile, Reminder, VisitLog, AgriCity, InventoryItem, Prescription, Payment, ManualDebt } from '../types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { auth } from '../services/firebase';

interface DashboardStats {
  totalFarmers: number;
  todayPrescriptions: number;
  pendingVisits: number;
  activeReminders: number;
  tomorrowReminders: number;
  totalArea: number;
  totalSales: number;
  cropDistribution: { crop: string, area: number }[];
  inventoryValue: number;
  potentialRevenue: number;
  totalDebt: number;
  regionalAlerts: { type: string, village: string, severity: string, count: number }[];
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
  inventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
  addInventoryItem: (item: InventoryItem) => Promise<void>;
  updateInventoryItem: (item: InventoryItem) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  prescriptions: Prescription[];
  refreshPrescriptions: () => Promise<void>;
  togglePrescriptionStatus: (id: string) => Promise<Prescription | null>;
  payments: Payment[];
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  manualDebts: ManualDebt[];
  addManualDebt: (debt: Omit<ManualDebt, 'id'>) => Promise<void>;
  deleteManualDebt: (id: string) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hapticFeedback: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => Promise<void>;
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
    tomorrowReminders: 0,
    totalArea: 0,
    totalSales: 0,
    cropDistribution: [],
    inventoryValue: 0,
    potentialRevenue: 0,
    totalDebt: 0,
    regionalAlerts: []
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualDebts, setManualDebts] = useState<ManualDebt[]>([]);
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error' | 'info'}[]>([]);
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

  const refreshInventory = async () => {
    const items = await dbService.getInventory();
    setInventory(items);
  };

  const addInventoryItem = async (item: InventoryItem) => {
    await dbService.addInventoryItem(item);
    await refreshInventory();
    await refreshStats();
  };

  const updateInventoryItem = async (item: InventoryItem) => {
    await dbService.updateInventoryItem(item);
    await refreshInventory();
    await refreshStats();
  };

  const deleteInventoryItem = async (id: string) => {
    await dbService.deleteInventoryItem(id);
    // Manually update local state for immediate feedback
    setInventory(prev => prev.filter(item => item.id !== id));
    await refreshStats();
  };

  const refreshPrescriptions = async () => {
    const items = await dbService.getAllPrescriptions();
    setPrescriptions(items);
  };

  const togglePrescriptionStatus = async (id: string): Promise<Prescription | null> => {
    const p = prescriptions.find(item => item.id === id);
    if (!p) return null;

    const updated: Prescription = { ...p, isProcessed: !p.isProcessed };
    await dbService.updatePrescription(updated);
    
    // Inventory synchronization
    if (updated.isProcessed && !updated.isInventoryProcessed) {
        await dbService.processInventory(updated);
    } else if (!updated.isProcessed && updated.isInventoryProcessed) {
        await dbService.revertInventory(updated);
    }

    // Fetch the absolute latest state from DB to ensure isInventoryProcessed is correct
    const latest = await dbService.getAllPrescriptions();
    const finalUpdated = latest.find(item => item.id === id) || updated;

    await refreshPrescriptions();
    await refreshInventory();
    await refreshStats();

    return finalUpdated;
  };

  const refreshStats = async (syncedReminders?: Reminder[]) => {
    const [farmerList, prescriptions, visits, reminderListFromDB, inventoryData, paymentList, manualDebtList] = await Promise.all([
        dbService.getFarmers(),
        dbService.getAllPrescriptions(),
        dbService.getAllVisits(),
        dbService.getReminders(),
        dbService.getInventory(),
        dbService.getPayments(),
        dbService.getManualDebts()
    ]);

    const finalReminders = [...(syncedReminders || reminderListFromDB)];
    
    // --- SMART CALENDAR LOGIC ---
    // Generate reminders based on crop stages if not already present
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    farmerList.forEach(farmer => {
        farmer.fields.forEach(field => {
            if (field.crop && field.plantingDate) {
                const pDate = new Date(field.plantingDate);
                const diffDays = Math.floor((today.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
                
                let title = '';
                let description = '';

                // Example logic for Cotton
                if (field.crop.toLowerCase().includes('pamuk')) {
                    if (diffDays >= 20 && diffDays <= 25) {
                        title = `${farmer.fullName} - Pamuk Üst Gübreleme`;
                        description = `${field.name} tarlasında pamuk 4-6 yaprak evresinde. Üst gübreleme zamanı.`;
                    } else if (diffDays >= 60 && diffDays <= 65) {
                        title = `${farmer.fullName} - Pamuk Zararlı Kontrolü`;
                        description = `${field.name} tarlasında pamuk taraklanma döneminde. Yeşil kurt ve emici böcek kontrolü yapılmalı.`;
                    }
                } 
                // Example logic for Corn (Mısır)
                else if (field.crop.toLowerCase().includes('mısır')) {
                    if (diffDays >= 30 && diffDays <= 35) {
                        title = `${farmer.fullName} - Mısır Üst Gübreleme`;
                        description = `${field.name} tarlasında mısır diz boyu seviyesinde. Üst gübreleme ve boğaz doldurma zamanı.`;
                    }
                }
                // Example logic for Wheat (Buğday)
                else if (field.crop.toLowerCase().includes('buğday')) {
                    if (diffDays >= 45 && diffDays <= 55) {
                        title = `${farmer.fullName} - Buğday Ot İlacı`;
                        description = `${field.name} tarlasında buğday kardeşlenme sonunda. Yabancı ot mücadelesi için uygun dönem.`;
                    }
                }

                if (title && !finalReminders.find(r => r.title === title)) {
                    finalReminders.push({
                        id: `auto-${crypto.randomUUID()}`,
                        title,
                        description,
                        date: todayStr,
                        isCompleted: false,
                        priority: 'MEDIUM',
                        recurrence: 'NONE'
                    });
                }
            }
        });
    });

    // --- REGIONAL ALERTS LOGIC ---
    const alerts: Record<string, { type: string, village: string, severity: string, count: number }> = {};
    visits.forEach(v => {
        if ((v.pestFound || v.diseaseFound) && v.severity === 'HIGH') {
            const key = `${v.pestFound || v.diseaseFound}-${v.village || 'Bilinmeyen'}`;
            if (!alerts[key]) {
                alerts[key] = {
                    type: v.pestFound || v.diseaseFound || 'Bilinmeyen',
                    village: v.village || 'Bilinmeyen',
                    severity: 'HIGH',
                    count: 0
                };
            }
            alerts[key].count++;
        }
    });
    const regionalAlerts = Object.values(alerts).filter(a => a.count >= 2); // At least 2 findings in same village

    // --- DEBT TRACKING LOGIC ---
    const farmerDebts: Record<string, number> = {};
    
    // Add prescriptions to debt
    prescriptions.forEach(p => {
        farmerDebts[p.farmerId] = (farmerDebts[p.farmerId] || 0) + (p.totalAmount || 0);
    });

    // Add manual debts
    manualDebtList.forEach(d => {
        farmerDebts[d.farmerId] = (farmerDebts[d.farmerId] || 0) + d.amount;
    });

    // Subtract payments from debt
    paymentList.forEach(pay => {
        farmerDebts[pay.farmerId] = (farmerDebts[pay.farmerId] || 0) - pay.amount;
    });

    // Update farmer objects with balance
    const updatedFarmerList = farmerList.map(f => ({
        ...f,
        balance: -(farmerDebts[f.id] || 0) // Balance is negative if they owe money
    }));

    // Total debt is the sum of all positive balances (money owed to the engineer)
    const totalDebt = Object.values(farmerDebts).reduce((acc, val) => acc + (val > 0 ? val : 0), 0);

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

    const todaysPrescriptionsCount = prescriptions.filter(p => p.date.startsWith(todayStr)).length;
    
    // Yarının görevlerini hesapla
    const tomorrowRemindersCount = finalReminders.filter(r => r.date === tomorrowStr && !r.isCompleted).length;

    // Günlük özeti planla (Her veri değişiminde o anki duruma göre 20:00'ı günceller)
    await scheduleDailyBriefing(tomorrowRemindersCount);

    // Ürün dağılımı ve toplam alan hesapla
    const distribution: Record<string, number> = {};
    let totalArea = 0;
    
    updatedFarmerList.forEach(f => {
        (f.fields || []).forEach(field => {
            const area = Number(field.size) || 0;
            const crop = field.crop || 'Belirtilmedi';
            distribution[crop] = (distribution[crop] || 0) + area;
            totalArea += area;
        });
    });

    // Toplam Satış Tutarı Hesapla
    const totalSales = prescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0);

    // Calculate Inventory Value and Potential Revenue
    const inventoryValue = inventoryData.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);
    const potentialRevenue = inventoryData.reduce((acc, item) => acc + (item.sellingPrice * item.quantity), 0);

    const cropDistribution = Object.entries(distribution)
        .map(([crop, area]) => ({ crop, area }))
        .sort((a, b) => b.area - a.area);

    setReminders(finalReminders);
    setFarmers(updatedFarmerList);
    setInventory(inventoryData);
    setPrescriptions(prescriptions);
    setPayments(paymentList);
    
    setStats({
      totalFarmers: updatedFarmerList.length,
      todayPrescriptions: todaysPrescriptionsCount,
      pendingVisits: visits.length,
      activeReminders: finalReminders.filter(r => !r.isCompleted).length,
      tomorrowReminders: tomorrowRemindersCount,
      totalArea,
      totalSales,
      cropDistribution,
      inventoryValue,
      potentialRevenue,
      totalDebt,
      regionalAlerts
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

  const addPayment = async (paymentData: Omit<Payment, 'id'>) => {
    const newPayment: Payment = { ...paymentData, id: crypto.randomUUID() };
    await dbService.addPayment(newPayment);
    await refreshStats();
  };

  const deletePayment = async (id: string) => {
    await dbService.deletePayment(id);
    await refreshStats();
  };

  const addManualDebt = async (debt: Omit<ManualDebt, 'id'>) => {
    const id = crypto.randomUUID();
    await dbService.addManualDebt({ ...debt, id });
    await refreshStats();
  };

  const deleteManualDebt = async (id: string) => {
    await dbService.deleteManualDebt(id);
    await refreshStats();
  };

  const setUiScale = (scale: UIScale) => {
    setUiScaleState(scale);
    localStorage.setItem('mks_ui_scale', scale);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const hapticFeedback = async (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
    try {
      if (type === 'success' || type === 'warning' || type === 'error') {
        const hType = type === 'success' ? NotificationType.Success : 
                      type === 'warning' ? NotificationType.Warning : 
                      NotificationType.Error;
        await Haptics.notification({ type: hType });
      } else {
        const hStyle = type === 'heavy' ? ImpactStyle.Heavy : 
                       type === 'medium' ? ImpactStyle.Medium : 
                       ImpactStyle.Light;
        await Haptics.impact({ style: hStyle });
      }
    } catch (e) {
      // Ignore if not supported
    }
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
        updateVisit, deleteVisit,
        inventory, refreshInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem,
        prescriptions, refreshPrescriptions, togglePrescriptionStatus,
        payments, addPayment, deletePayment,
        manualDebts, addManualDebt, deleteManualDebt,
        showToast, hapticFeedback
    }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-[90%] pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto ${
              toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' :
              toast.type === 'error' ? 'bg-rose-600 border-rose-500 text-white' :
              'bg-stone-800 border-stone-700 text-stone-100'
            }`}
          >
            <div className="flex-1 font-bold text-sm">{toast.message}</div>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export const useAppViewModel = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppViewModel must be used within AppProvider');
  return context;
};

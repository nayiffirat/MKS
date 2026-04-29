
import { safeStringify } from '../utils/json';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { dbService, setActionBlocked, setActionBlockedCallback } from '../services/db';
import { WeatherService, AGRI_CITIES } from '../services/weather';
import { Farmer, UIScale, AppNotification, UserProfile, Reminder, VisitLog, AgriCity, InventoryItem, Prescription, Payment, ManualDebt, Supplier, SupplierPurchase, SupplierPayment, MyPayment, PesticideCategory, ViewState, Expense, Account, Transaction, TeamMember, Message, Language, News, CollectionLog, Plant } from '../types';
import { DEFAULT_PLANTS } from '../constants/plants';
import { getTranslation } from '../utils/translations';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

let isCreatingDefaultAccount = false;

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
  cashInventoryValue: number;
  cashPotentialRevenue: number;
  totalDebt: number;
  totalExpenses: number;
  regionalAlerts: { type: string, village: string, severity: string, count: number }[];
  cashBalance?: number;
  bankBalance?: number;
  totalPendingPayables?: number;
  totalPendingReceivables?: number;
}

interface AppContextType {
  stats: DashboardStats;
  refreshStats: (syncedReminders?: Reminder[]) => Promise<void>;
  addFarmer: (farmer: Omit<Farmer, 'id'>) => Promise<void>;
  updateFarmer: (farmer: Farmer) => Promise<void>;
  deleteFarmer: (id: string) => Promise<void>;
  softDeleteFarmer: (id: string) => Promise<void>;
  restoreFarmer: (id: string) => Promise<void>;
  permanentlyDeleteFarmer: (id: string) => Promise<void>;
  bulkAddFarmers: (farmers: Omit<Farmer, 'id'>[]) => Promise<void>;
  farmers: Farmer[];
  trashedFarmers: Farmer[];
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
  updateUserProfile: (profile: UserProfile) => Promise<void>;
  teamMembers: TeamMember[];
  addTeamMember: (member: Omit<TeamMember, 'id' | 'createdAt'>) => Promise<void>;
  updateTeamMember: (member: TeamMember) => Promise<void>;
  deleteTeamMember: (id: string) => Promise<void>;
  activeTeamMember: TeamMember | null;
  setActiveTeamMember: (member: TeamMember | null, persist?: boolean) => void;
  messages: Message[];
  sendMessage: (text: string) => Promise<void>;
  syncUserProfile: (profile: UserProfile) => void;
  isAdmin: boolean;
  subscriptionStatus: 'trial' | 'active' | 'expired';
  subscriptionEndsAt: string;
  getAllUsers: () => Promise<(UserProfile & { uid: string, email?: string })[]>;
  updateUserSubscription: (uid: string, updates: Partial<UserProfile>) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  addSystemNotification: (type: AppNotification['type'], title: string, message: string) => Promise<void>;
  prescriptionLabel: string;
  farmerLabel: string;
  farmerPluralLabel: string;
  visits: VisitLog[];
  trashedVisits: VisitLog[];
  addVisit: (visit: Omit<VisitLog, 'id'>) => Promise<string>;
  updateVisit: (visit: VisitLog) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;
  softDeleteVisit: (id: string) => Promise<void>;
  restoreVisit: (id: string) => Promise<void>;
  permanentlyDeleteVisit: (id: string) => Promise<void>;
  inventory: InventoryItem[];
  trashedInventory: InventoryItem[];
  refreshInventory: () => Promise<void>;
  addInventoryItem: (item: InventoryItem) => Promise<void>;
  bulkUpdateInventoryItems: (items: InventoryItem[]) => Promise<void>;
  updateInventoryItem: (item: InventoryItem) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  softDeleteInventoryItem: (id: string) => Promise<void>;
  restoreInventoryItem: (id: string) => Promise<void>;
  permanentlyDeleteInventoryItem: (id: string) => Promise<void>;
  prescriptions: Prescription[];
  trashedPrescriptions: Prescription[];
  supplierPurchases: SupplierPurchase[];
  addPrescription: (prescription: Omit<Prescription, 'id' | 'prescriptionNo'>) => Promise<string>;
  refreshPrescriptions: () => Promise<void>;
  togglePrescriptionStatus: (id: string) => Promise<Prescription | null>;
  softDeletePrescription: (id: string) => Promise<void>;
  restorePrescription: (id: string) => Promise<void>;
  permanentlyDeletePrescription: (id: string) => Promise<void>;
  news: News[];
  addNews: (news: Omit<News, 'id'>) => Promise<void>;
  updateNews: (news: News) => Promise<void>;
  deleteNews: (id: string) => Promise<void>;
  refreshNews: () => Promise<void>;
  payments: Payment[];
  trashedPayments: Payment[];
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  updatePayment: (payment: Payment) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  softDeletePayment: (id: string) => Promise<void>;
  restorePayment: (id: string) => Promise<void>;
  permanentlyDeletePayment: (id: string) => Promise<void>;
  manualDebts: ManualDebt[];
  trashedManualDebts: ManualDebt[];
  addManualDebt: (debt: Omit<ManualDebt, 'id'>) => Promise<void>;
  updateManualDebt: (debt: ManualDebt) => Promise<void>;
  deleteManualDebt: (id: string) => Promise<void>;
  softDeleteManualDebt: (id: string) => Promise<void>;
  restoreManualDebt: (id: string) => Promise<void>;
  permanentlyDeleteManualDebt: (id: string) => Promise<void>;
  suppliers: Supplier[];
  trashedSuppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'totalDebt' | 'balance'>) => Promise<void>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  softDeleteSupplier: (id: string) => Promise<void>;
  restoreSupplier: (id: string) => Promise<void>;
  permanentlyDeleteSupplier: (id: string) => Promise<void>;
  trashedSupplierPurchases: SupplierPurchase[];
  trashedSupplierPayments: SupplierPayment[];
  addSupplierPurchase: (purchase: Omit<SupplierPurchase, 'id'>) => Promise<void>;
  updateSupplierPurchase: (purchase: SupplierPurchase) => Promise<void>;
  deleteSupplierPurchase: (id: string) => Promise<void>;
  softDeleteSupplierPurchase: (id: string) => Promise<void>;
  restoreSupplierPurchase: (id: string) => Promise<void>;
  permanentlyDeleteSupplierPurchase: (id: string) => Promise<void>;
  addSupplierPayment: (payment: Omit<SupplierPayment, 'id'>) => Promise<void>;
  updateSupplierPayment: (payment: SupplierPayment) => Promise<void>;
  deleteSupplierPayment: (id: string) => Promise<void>;
  softDeleteSupplierPayment: (id: string) => Promise<void>;
  restoreSupplierPayment: (id: string) => Promise<void>;
  permanentlyDeleteSupplierPayment: (id: string) => Promise<void>;
  myPayments: MyPayment[];
  addMyPayment: (payment: Omit<MyPayment, 'id'>) => Promise<void>;
  updateMyPayment: (payment: MyPayment) => Promise<void>;
  deleteMyPayment: (id: string) => Promise<void>;
  softDeleteMyPayment: (id: string) => Promise<void>;
  restoreMyPayment: (id: string) => Promise<void>;
  permanentlyDeleteMyPayment: (id: string) => Promise<void>;
  expenses: Expense[];
  trashedExpenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  softDeleteExpense: (id: string) => Promise<void>;
  restoreExpense: (id: string) => Promise<void>;
  permanentlyDeleteExpense: (id: string) => Promise<void>;
  accounts: Account[];
  addAccount: (account: Omit<Account, 'id' | 'balance'>) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  performManualTurnover: () => Promise<void>;
  isInitialized: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hapticFeedback: (type?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => Promise<void>;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, placeholders?: Record<string, string>) => string;
  collectionLogs: CollectionLog[];
  addCollectionLog: (log: Omit<CollectionLog, 'id'>) => Promise<void>;
  updateCollectionLog: (log: CollectionLog) => Promise<void>;
  deleteCollectionLog: (id: string) => Promise<void>;
  plants: Plant[];
  addPlant: (plant: Omit<Plant, 'id'>) => Promise<void>;
  updatePlant: (plant: Plant) => Promise<void>;
  deletePlant: (id: string) => Promise<void>;
  refreshPlants: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_PROFILE: UserProfile = {
  fullName: '',
  phoneNumber: '',
  companyName: '',
  title: '',
  highContrastMode: false,
  language: 'tr'
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
    cashInventoryValue: 0,
    cashPotentialRevenue: 0,
    totalDebt: 0,
    totalExpenses: 0,
    regionalAlerts: []
  });

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [language, setLanguageState] = useState<Language>('tr');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [trashedInventory, setTrashedInventory] = useState<InventoryItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [trashedPrescriptions, setTrashedPrescriptions] = useState<Prescription[]>([]);
  const [supplierPurchases, setSupplierPurchases] = useState<SupplierPurchase[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [trashedFarmers, setTrashedFarmers] = useState<Farmer[]>([]);
  const [trashedVisits, setTrashedVisits] = useState<VisitLog[]>([]);
  const [trashedPayments, setTrashedPayments] = useState<Payment[]>([]);
  const [trashedSuppliers, setTrashedSuppliers] = useState<Supplier[]>([]);
  const [trashedSupplierPurchases, setTrashedSupplierPurchases] = useState<SupplierPurchase[]>([]);
  const [trashedSupplierPayments, setTrashedSupplierPayments] = useState<SupplierPayment[]>([]);
  const [trashedMyPayments, setTrashedMyPayments] = useState<MyPayment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualDebts, setManualDebts] = useState<ManualDebt[]>([]);
  const [trashedManualDebts, setTrashedManualDebts] = useState<ManualDebt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [myPayments, setMyPayments] = useState<MyPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trashedExpenses, setTrashedExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [collectionLogs, setCollectionLogs] = useState<CollectionLog[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [activeTeamMember, setActiveTeamMemberState] = useState<TeamMember | null>(() => {
    if (typeof window !== 'undefined') {
      const savedLocal = localStorage.getItem('mks_active_team_member');
      if (savedLocal) return JSON.parse(savedLocal);
      const savedSession = sessionStorage.getItem('mks_active_team_member');
      if (savedSession) return JSON.parse(savedSession);
    }
    return null;
  });

  const setActiveTeamMember = (member: TeamMember | null, persist: boolean = false) => {
    setActiveTeamMemberState(member);
    if (member) {
      if (persist) {
        localStorage.setItem('mks_active_team_member', safeStringify(member));
        sessionStorage.removeItem('mks_active_team_member');
      } else {
        sessionStorage.setItem('mks_active_team_member', safeStringify(member));
        localStorage.removeItem('mks_active_team_member');
      }
    } else {
      localStorage.removeItem('mks_active_team_member');
      sessionStorage.removeItem('mks_active_team_member');
    }
  };
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error' | 'info'}[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

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

  useEffect(() => {
    if (userProfile.theme && userProfile.theme !== 'DEFAULT') {
        document.documentElement.setAttribute('data-theme', userProfile.theme);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
  }, [userProfile.theme]);

  const refreshNotifications = async () => {
      const list = await dbService.getNotifications();
      setNotifications(list);
  };

  const cleanupOldData = async () => {
      await dbService.cleanupOldNotifications();
      await refreshNotifications();
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    updateUserProfile({ ...userProfile, language: lang });
  };

  const refreshPlants = async () => {
    let list = await dbService.getPlants();
    
    // Auto-seed if empty and not explicitly done before
    if (list.length === 0) {
      const isSeeded = localStorage.getItem('mks_plants_seeded_v3');
      if (!isSeeded) {
        console.log("Seeding default plants...");
        // Use batch if possible or just wait for all
        const seedPromises = DEFAULT_PLANTS.map(pData => {
          const plant: Plant = { ...pData as any, id: crypto.randomUUID() };
          return dbService.addPlant(plant);
        });
        await Promise.all(seedPromises);
        localStorage.setItem('mks_plants_seeded_v3', 'true');
        list = await dbService.getPlants();
      }
    }
    
    setPlants(list);
  };

  const addPlant = async (plantData: Omit<Plant, 'id'>) => {
    const plant: Plant = { ...plantData, id: crypto.randomUUID() };
    await dbService.addPlant(plant);
    await refreshPlants();
  };

  const updatePlant = async (plant: Plant) => {
    await dbService.updatePlant(plant);
    await refreshPlants();
  };

  const deletePlant = async (id: string) => {
    await dbService.deletePlant(id);
    await refreshPlants();
  };

  const t = (key: string, placeholders?: Record<string, string>): string => {
    let translation = getTranslation(language, key);
    if (placeholders) {
      Object.keys(placeholders).forEach(placeholderKey => {
        translation = translation.replace(`{{${placeholderKey}}}`, placeholders[placeholderKey]);
      });
    }
    return translation;
  };

  const updateUserProfile = async (profile: UserProfile) => {
      setUserProfile(profile);
      localStorage.setItem('mks_user_profile', safeStringify(profile));
      
      // Firebase Sync
      const user = auth.currentUser;
      if (user) {
          await dbService.saveUserProfile(user.uid, profile);
      }
  };

  const syncUserProfile = (profile: UserProfile) => {
      setUserProfile(profile);
      localStorage.setItem('mks_user_profile', safeStringify(profile));
      setActiveTeamMember(null);
      localStorage.removeItem('mks_active_team_member');
  };

  const isAdmin = userProfile.role === 'admin' || auth.currentUser?.email === 'nayiffirat@gmail.com';
  const subscriptionStatus = userProfile.subscriptionStatus || 'trial';
  const subscriptionEndsAt = userProfile.subscriptionEndsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  useEffect(() => {
    const isExpired = new Date(subscriptionEndsAt || 0) < new Date() || subscriptionStatus === 'expired';
    setActionBlocked(isExpired && !isAdmin);
    
    setActionBlockedCallback(() => {
      showToast('Süreniz doldu yönetici ile iletişime geçin', 'error');
    });
  }, [subscriptionEndsAt, subscriptionStatus, isAdmin]);

  const getAllUsers = async () => {
      if (!isAdmin) return [];
      return await dbService.getAllUsers();
  };

  const updateUserSubscription = async (uid: string, updates: Partial<UserProfile>) => {
      if (!isAdmin) return;
      await dbService.updateUserSubscription(uid, updates);
      if (auth.currentUser?.uid === uid) {
          setUserProfile(prev => {
              const updated = { ...prev, ...updates };
              localStorage.setItem('mks_user_profile', safeStringify(updated));
              setActiveTeamMember(null);
              localStorage.removeItem('mks_active_team_member');
              return updated;
          });
      }
  };

  const deleteUser = async (uid: string) => {
      if (!isAdmin) return;
      await dbService.deleteUser(uid);
  };

  const sendPasswordReset = async (email: string) => {
      if (!isAdmin) return;
      try {
          await sendPasswordResetEmail(auth, email);
      } catch (error) {
          console.error("Şifre sıfırlama hatası:", error);
          throw error;
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
        localStorage.setItem('mks_daily_alert_log', safeStringify(dailyLog));

    } catch (e) {
        console.error("Weather alert check failed:", e);
    }
  };

  const refreshInventory = async () => {
    const now = new Date();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const rawInventory = await dbService.getInventory();
    const allInventoryRaw = await dbService.getAllInventoryRaw();
    const trashedInv = allInventoryRaw.filter(item => item.deletedAt);
    
    // Auto-delete trashed inventory older than 30 days in background
    const deletePromises: Promise<any>[] = [];
    for (const item of trashedInv) {
      if (item.deletedAt && now.getTime() - new Date(item.deletedAt).getTime() > thirtyDaysInMs) {
        deletePromises.push(dbService.permanentlyDeleteInventoryItem(item.id));
      }
    }
    
    if (deletePromises.length > 0) {
      Promise.allSettled(deletePromises).catch(err => console.warn("Inventory cleanup failed:", err));
    }

    setInventory(rawInventory);
    setTrashedInventory(trashedInv.filter(item => now.getTime() - new Date(item.deletedAt!).getTime() <= thirtyDaysInMs));
  };

  const addInventoryItem = async (item: InventoryItem) => {
    await dbService.addInventoryItem(item);
    await refreshInventory();
    await refreshStats();
  };

  const updateInventoryItem = async (item: InventoryItem, skipRefresh: boolean = false) => {
    await dbService.updateInventoryItem(item);
    if (!skipRefresh) {
        await refreshInventory();
        await refreshStats();
    }
  };

  const bulkUpdateInventoryItems = async (items: InventoryItem[]) => {
      for (const item of items) {
          await dbService.updateInventoryItem(item);
      }
      await refreshInventory();
      await refreshStats();
  };

  const deleteInventoryItem = async (id: string) => {
    await dbService.permanentlyDeleteInventoryItem(id);
    setInventory(prev => prev.filter(item => item.id !== id));
    setTrashedInventory(prev => prev.filter(item => item.id !== id));
    await refreshStats();
  };

  const softDeleteInventoryItem = async (id: string) => {
    await dbService.deleteInventoryItem(id);
    await refreshInventory();
    await refreshStats();
  };

  const restoreInventoryItem = async (id: string) => {
    await dbService.restoreInventoryItem(id);
    await refreshInventory();
    await refreshStats();
  };

  const permanentlyDeleteInventoryItem = async (id: string) => {
    await dbService.permanentlyDeleteInventoryItem(id);
    await refreshInventory();
    await refreshStats();
  };

  const addPrescription = async (pData: Omit<Prescription, 'id' | 'prescriptionNo'>) => {
    const id = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const prescription: Prescription = { 
        ...pData, 
        id, 
        prescriptionNo: id,
        createdById: activeTeamMember?.id,
        isInventoryProcessed: false
    };
    await dbService.addPrescription(prescription);
    await dbService.processInventory(prescription);
    await refreshPrescriptions();
    await refreshInventory();
    await refreshStats();
    return id;
  };

  const refreshPrescriptions = async () => {
    const allItems = await dbService.getAllPrescriptions();
    const activeItems = allItems.filter(p => !p.deletedAt);
    const trashedItems = allItems.filter(p => !!p.deletedAt);
    
    setPrescriptions(activeItems);
    setTrashedPrescriptions(trashedItems);
  };

  const refreshNews = async () => {
    try {
        if (navigator.onLine) {
            await dbService.syncNews();
        }
    } catch (e) {
        console.warn("News sync failed:", e);
    }
    const list = await dbService.getNews();
    setNews(list);
  };

  const togglePrescriptionStatus = async (id: string): Promise<Prescription | null> => {
    let p = prescriptions.find(item => item.id === id);
    if (!p) {
        const all = await dbService.getAllPrescriptions();
        p = all.find(item => item.id === id);
    }
    if (!p) return null;

    const newIsProcessed = !p.isProcessed;
    const updated: Prescription = { ...p, isProcessed: newIsProcessed };
    
    await dbService.updatePrescription(updated);

    // Handle inventory processing/reverting when status is toggled
    if (newIsProcessed) {
        await dbService.processInventory(updated);
    } else if (p.isInventoryProcessed) {
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
    const now = new Date();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    const [
        allPrescriptionsRaw,
        rawFarmerList, 
        rawVisitList, 
        reminderListFromDB, 
        inventoryData, 
        rawPaymentList, 
        rawManualDebtList, 
        rawSupplierList, 
        myPaymentList, 
        rawExpenseList, 
        teamMemberList, 
        messageList,
        collectionLogList
    ] = await Promise.all([
        dbService.getAllPrescriptions(),
        dbService.getFarmers(),
        dbService.getAllVisits(),
        dbService.getReminders(),
        dbService.getInventory(),
        dbService.getPayments(),
        dbService.getManualDebts(),
        dbService.getSuppliers(),
        dbService.getMyPayments(),
        dbService.getExpenses(),
        dbService.getTeamMembers(),
        dbService.getMessages(),
        dbService.getCollectionLogs()
    ]);

    // --- PRESCRIPTIONS FILTERING & AUTO-DELETE ---
    const validPrescriptions: Prescription[] = [];
    const trashed: Prescription[] = [];

    for (const p of allPrescriptionsRaw) {
        if (p.deletedAt) {
            const deletedTime = new Date(p.deletedAt).getTime();
            if (now.getTime() - deletedTime > thirtyDaysInMs) {
                await dbService.deletePrescription(p.id);
            } else {
                trashed.push(p);
            }
        } else {
            validPrescriptions.push(p);
        }
    }

    const prescriptions = validPrescriptions;

    // Fetch all purchases and payments at once
    const [allPurchasesRaw, allPaymentsRaw] = await Promise.all([
        dbService.getSupplierPurchases(),
        dbService.getSupplierPayments()
    ]);
    
    const flatPurchases = allPurchasesRaw.filter(p => !p.deletedAt);
    const flatPayments = allPaymentsRaw.filter(p => !p.deletedAt);
    
    const trashedPurchases = allPurchasesRaw.filter(p => !!p.deletedAt);
    const trashedPay = allPaymentsRaw.filter(p => !!p.deletedAt);

    // Separate active and trashed items
    const farmerList = rawFarmerList.filter(f => !f.deletedAt);
    const trashedF = rawFarmerList.filter(f => f.deletedAt);
    
    const visitList = rawVisitList.filter(v => !v.deletedAt);
    const trashedV = rawVisitList.filter(v => v.deletedAt);
    
    const paymentList = rawPaymentList.filter(p => !p.deletedAt);
    const trashedP = rawPaymentList.filter(p => p.deletedAt);
    
    const manualDebtList = rawManualDebtList.filter(d => !d.deletedAt);
    const trashedMD = rawManualDebtList.filter(d => d.deletedAt);
    
    const expenseList = rawExpenseList.filter(e => !e.deletedAt);
    const trashedE = rawExpenseList.filter(e => e.deletedAt);

    const supplierList = rawSupplierList.filter(s => !s.deletedAt);
    const trashedS = rawSupplierList.filter(s => s.deletedAt);

    const trashedSPurchases = allPurchasesRaw.filter(p => p.deletedAt);
    const trashedSPayments = allPaymentsRaw.filter(p => p.deletedAt);
    const trashedMyPayments = myPaymentList.filter(p => p.deletedAt);
    const trashedTransactions = (await dbService.getTransactions()).filter(tx => tx.deletedAt);

    // Auto-delete trashed items older than 30 days in parallel to avoid hanging
    const deletePromises: Promise<any>[] = [];

    for (const f of trashedF) {
        if (now.getTime() - new Date(f.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteFarmer(f.id));
        }
    }
    for (const v of trashedV) {
        if (now.getTime() - new Date(v.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteVisit(v.id));
        }
    }
    for (const p of trashedP) {
        if (now.getTime() - new Date(p.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deletePayment(p.id));
        }
    }
    for (const s of trashedS) {
        if (now.getTime() - new Date(s.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteSupplier(s.id));
        }
    }
    for (const d of trashedMD) {
        if (now.getTime() - new Date(d.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteManualDebt(d.id));
        }
    }
    for (const e of trashedE) {
        if (now.getTime() - new Date(e.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteExpense(e.id));
        }
    }
    for (const p of trashedSPurchases) {
        if (now.getTime() - new Date(p.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteSupplierPurchase(p.id));
        }
    }
    for (const p of trashedSPayments) {
        if (now.getTime() - new Date(p.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteSupplierPayment(p.id));
        }
    }
    for (const p of trashedMyPayments) {
        if (now.getTime() - new Date(p.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteMyPayment(p.id));
        }
    }

    for (const tx of trashedTransactions) {
        if (now.getTime() - new Date(tx.deletedAt!).getTime() > thirtyDaysInMs) {
            deletePromises.push(dbService.deleteTransaction(tx.id));
        }
    }

    if (deletePromises.length > 0) {
        // Don't await deletions, they can happen in background to prevent UI hang
        Promise.allSettled(deletePromises).catch(err => console.warn('Background cleanup failed:', err));
    }

    setTrashedFarmers(trashedF.filter(f => now.getTime() - new Date(f.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedVisits(trashedV.filter(v => now.getTime() - new Date(v.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedPayments(trashedP.filter(p => now.getTime() - new Date(p.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedSuppliers(trashedS.filter(s => now.getTime() - new Date(s.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedManualDebts(trashedMD.filter(d => now.getTime() - new Date(d.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedExpenses(trashedE.filter(e => now.getTime() - new Date(e.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedSupplierPurchases(trashedSPurchases.filter(p => now.getTime() - new Date(p.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedSupplierPayments(trashedSPayments.filter(p => now.getTime() - new Date(p.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedMyPayments(trashedMyPayments.filter(p => now.getTime() - new Date(p.deletedAt!).getTime() <= thirtyDaysInMs));

    setVisits(visitList);

    const finalReminders = [...(syncedReminders || reminderListFromDB)];
    
    const updatedSupplierList = supplierList.map((s) => {
        const purchasesForSupplier = flatPurchases.filter(p => p.supplierId === s.id);
        const paymentsForSupplier = flatPayments.filter(p => p.supplierId === s.id);
        // Only include checks that are not already part of the supplier's flatPayments (i.e. those without a relatedId linking them back)
        const checks = myPaymentList.filter(p => p.supplierId === s.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId);
        
        const totalPurchased = purchasesForSupplier.reduce((acc, p) => {
            const amt = Math.abs(Number(p.totalAmount) || 0);
            return acc + (p.type === 'RETURN' ? -amt : amt);
        }, 0);

        // Payments TO supplier increase totalPaid, Payments FROM supplier (RECEIVE) decrease totalPaid
        const totalPaid = paymentsForSupplier.reduce((acc, p) => {
            const amt = Number(p.amount) || 0;
            return acc + (p.type === 'RECEIVE' ? -amt : amt);
        }, 0) + 
        checks.reduce((acc, p) => acc + (Number(p.amount) || 0), 0); // Independent checks
        
        return {
            ...s,
            totalDebt: purchasesForSupplier.filter(p => p.type !== 'RETURN').reduce((acc, p) => acc + (Math.abs(Number(p.totalAmount)) || 0), 0),
            balance: (totalPaid || 0) - (totalPurchased || 0) // Negative means we owe money
        };
    });
    
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
                if (field.crop.toLocaleLowerCase('tr-TR').includes('pamuk')) {
                    if (diffDays >= 20 && diffDays <= 25) {
                        title = `${farmer.fullName} - Pamuk Üst Gübreleme`;
                        description = `${field.name} tarlasında pamuk 4-6 yaprak evresinde. Üst gübreleme zamanı.`;
                    } else if (diffDays >= 60 && diffDays <= 65) {
                        title = `${farmer.fullName} - Pamuk Zararlı Kontrolü`;
                        description = `${field.name} tarlasında pamuk taraklanma döneminde. Yeşil kurt ve emici böcek kontrolü yapılmalı.`;
                    }
                } 
                // Example logic for Corn (Mısır)
                else if (field.crop.toLocaleLowerCase('tr-TR').includes('mısır')) {
                    if (diffDays >= 30 && diffDays <= 35) {
                        title = `${farmer.fullName} - Mısır Üst Gübreleme`;
                        description = `${field.name} tarlasında mısır diz boyu seviyesinde. Üst gübreleme ve boğaz doldurma zamanı.`;
                    }
                }
                // Example logic for Wheat (Buğday)
                else if (field.crop.toLocaleLowerCase('tr-TR').includes('buğday')) {
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
    visitList.forEach(v => {
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
        if (p.priceType !== 'CASH') {
            const isReturn = p.type === 'RETURN';
            const multiplier = isReturn ? -1 : 1;
            farmerDebts[p.farmerId] = (farmerDebts[p.farmerId] || 0) + ((p.totalAmount || 0) * multiplier);
        }
    });

    // Add manual debts (Including turnover entries for individual balances)
    manualDebtList.forEach(d => {
        const amt = Number(d.amount) || 0;
        farmerDebts[d.farmerId] = (farmerDebts[d.farmerId] || 0) + amt;
    });

    // Subtract payments from debt
    paymentList.forEach(pay => {
        const amt = Number(pay.amount) || 0;
        farmerDebts[pay.farmerId] = (farmerDebts[pay.farmerId] || 0) - amt;
    });

    // Subtract myPayments (checks/notes) from farmer debt, only if independent
    myPaymentList.forEach(pay => {
        if (pay.farmerId && !pay.deletedAt && pay.status !== 'CANCELLED' && !pay.relatedId) {
            const amt = Number(pay.amount) || 0;
            farmerDebts[pay.farmerId] = (farmerDebts[pay.farmerId] || 0) - amt;
        }
    });

    // Total debt is the sum of all positive balances (money owed to the engineer)
    const totalDebt = Object.values(farmerDebts).reduce((acc, val) => {
        const v = Number(val) || 0;
        return acc + (v > 0 ? v : 0);
    }, 0);

    // Update farmer objects with balance
    const updatedFarmerList = farmerList.map(f => ({
        ...f,
        balance: -(farmerDebts[f.id] || 0) // Balance is negative if they owe money
    }));

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

    // Toplam Satış Tutarı Hesapla (Satışlardan İadeleri Düşerek)
    const totalSales = prescriptions.reduce((acc, p) => {
        const isReturn = p.type === 'RETURN';
        const multiplier = isReturn ? -1 : 1;
        return acc + ((p.totalAmount || 0) * multiplier);
    }, 0);

    // Toplam Gider Hesapla
    const totalExpenses = expenseList.reduce((acc, e) => acc + e.amount, 0);

    // Calculate Inventory Value and Potential Revenue
    const inventoryValue = inventoryData.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);
    const potentialRevenue = inventoryData.reduce((acc, item) => acc + (item.sellingPrice * item.quantity), 0);
    const cashInventoryValue = inventoryData.reduce((acc, item) => acc + ((item.cashBuyingPrice || 0) * item.quantity), 0);
    const cashPotentialRevenue = inventoryData.reduce((acc, item) => acc + ((item.cashPrice || 0) * item.quantity), 0);

    const cropDistribution = Object.entries(distribution)
        .map(([crop, area]) => ({ crop, area }))
        .sort((a, b) => b.area - a.area);

    setReminders(finalReminders);
    setFarmers(updatedFarmerList);
    setInventory(inventoryData);
    setPrescriptions(prescriptions);
    setTrashedPrescriptions(trashed);
    setSupplierPurchases(flatPurchases);
    setTrashedSupplierPurchases(trashedPurchases);
    setPayments(paymentList);
    setManualDebts(manualDebtList);
    setExpenses(expenseList);
    setSuppliers(updatedSupplierList);
    setMyPayments(myPaymentList);
    setTeamMembers(teamMemberList);
    setMessages(messageList);
    setCollectionLogs(collectionLogList);
    
    let accountList = await dbService.getAccounts();
    
    // Deduplicate "Nakit Kasam" if multiple were created due to race conditions
    const nakitKasamAccounts = accountList.filter(a => a.name === 'Nakit Kasam');
    if (nakitKasamAccounts.length > 1) {
        // Keep the first one, delete the rest if they have 0 balance
        for (let i = 1; i < nakitKasamAccounts.length; i++) {
            if (nakitKasamAccounts[i].balance === 0) {
                await dbService.deleteAccount(nakitKasamAccounts[i].id);
                accountList = accountList.filter(a => a.id !== nakitKasamAccounts[i].id);
            }
        }
    }

    // Create default "Nakit Kasam" if no accounts exist
    if (accountList.length === 0 && !isCreatingDefaultAccount) {
        isCreatingDefaultAccount = true;
        try {
            // Check again inside the lock
            const currentAccounts = await dbService.getAccounts();
            if (currentAccounts.length === 0) {
                const defaultAccount: Account = {
                    id: crypto.randomUUID(),
                    name: 'Nakit Kasam',
                    type: 'CASH',
                    balance: 0,
                    bankLogo: '💸' // Motivating money emoji
                };
                await dbService.addAccount(defaultAccount);
                accountList = [defaultAccount];
            } else {
                accountList = currentAccounts;
            }
        } finally {
            isCreatingDefaultAccount = false;
        }
    }

    const transactionList = (await dbService.getTransactions()).filter(tx => !tx.deletedAt);
    const activeMyPayments = myPaymentList.filter(p => !p.deletedAt);
    setAccounts(accountList);
    setTransactions(transactionList);
    
    const cashBalance = accountList.filter(a => a.type === 'CASH').reduce((acc, a) => acc + a.balance, 0);
    const bankBalance = accountList.filter(a => a.type === 'BANK').reduce((acc, a) => acc + a.balance, 0);

    const totalPendingPayables = activeMyPayments.filter(p => (p.supplierId || p.supplierName) && p.status === 'PENDING').reduce((acc, p) => acc + p.amount, 0);
    const totalPendingReceivables = activeMyPayments.filter(p => (p.farmerId || p.farmerName) && p.status === 'PENDING').reduce((acc, p) => acc + p.amount, 0);

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
      cashInventoryValue,
      cashPotentialRevenue,
      totalDebt,
      totalExpenses,
      regionalAlerts,
      cashBalance,
      bankBalance,
      totalPendingPayables,
      totalPendingReceivables
    });
    
    await refreshNotifications();
  };

  const addFarmer = async (farmerData: Omit<Farmer, 'id'>) => {
    const newFarmer: Farmer = { ...farmerData, id: crypto.randomUUID(), createdById: activeTeamMember?.id };
    await dbService.addFarmer(newFarmer);
    await refreshStats();
  };

  const updateFarmer = async (farmer: Farmer) => {
    await dbService.updateFarmer(farmer);
    await refreshStats();
  };

  const deleteFarmer = async (id: string) => {
    // 1. Delete all prescriptions and revert inventory
    const farmerPrescriptions = await dbService.getPrescriptionsByFarmer(id);
    for (const p of farmerPrescriptions) {
        if (p.isInventoryProcessed) {
            await dbService.revertInventory(p);
        }
        await dbService.deletePrescription(p.id);
    }

    // 2. Delete all payments and their transactions
    const farmerPayments = await dbService.getPaymentsByFarmer(id);
    const allTransactions = await dbService.getTransactions();
    for (const p of farmerPayments) {
        const relatedTx = allTransactions.find(tx => tx.relatedId === p.id);
        if (relatedTx) {
            await dbService.deleteTransaction(relatedTx.id);
        }
        await dbService.deletePayment(p.id);
    }

    // 3. Delete all manual debts
    const farmerDebts = await dbService.getManualDebtsByFarmer(id);
    for (const d of farmerDebts) {
        await dbService.deleteManualDebt(d.id);
    }

    // 4. Delete all visits
    const farmerVisits = await dbService.getVisitsByFarmer(id);
    for (const v of farmerVisits) {
        await dbService.deleteVisit(v.id);
    }

    // 5. Delete the farmer
    await dbService.deleteFarmer(id);
    await refreshStats();
  };

  const softDeleteFarmer = async (id: string) => {
    const farmer = farmers.find(f => f.id === id);
    if (farmer) {
        await dbService.updateFarmer({ ...farmer, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreFarmer = async (id: string) => {
    const farmer = trashedFarmers.find(f => f.id === id);
    if (farmer) {
        await dbService.updateFarmer({ ...farmer, deletedAt: null as any });
        await refreshStats();
    }
  };

  const permanentlyDeleteFarmer = async (id: string) => {
    await deleteFarmer(id);
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

  const addVisit = async (visitData: Omit<VisitLog, 'id'>) => {
    const id = crypto.randomUUID();
    const visit: VisitLog = { ...visitData, id, createdById: activeTeamMember?.id };
    await dbService.addVisit(visit);
    await refreshStats();
    return id;
  };

  const updateVisit = async (visit: VisitLog) => {
    await dbService.updateVisit(visit);
    await refreshStats();
  };

  const deleteVisit = async (id: string) => {
    await dbService.deleteVisit(id);
    await refreshStats();
  };

  const softDeleteVisit = async (id: string) => {
    const visit = visits.find(v => v.id === id);
    if (visit) {
        await dbService.updateVisit({ ...visit, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreVisit = async (id: string) => {
    const visit = trashedVisits.find(v => v.id === id);
    if (visit) {
        await dbService.updateVisit({ ...visit, deletedAt: null as any });
        await refreshStats();
    }
  };

  const permanentlyDeleteVisit = async (id: string) => {
    await deleteVisit(id);
  };

  const softDeletePrescription = async (id: string) => {
    const allPrescriptions = await dbService.getAllPrescriptions();
    const target = allPrescriptions.find(p => p.id === id);
    if (target) {
      if (target.isInventoryProcessed) {
        await dbService.revertInventory(target);
      }
      await dbService.updatePrescription({
        ...target,
        isInventoryProcessed: false,
        deletedAt: new Date().toISOString()
      });
      await refreshPrescriptions();
      await refreshInventory();
      await refreshStats();
    }
  };

  const restorePrescription = async (id: string) => {
    const allPrescriptions = await dbService.getAllPrescriptions();
    const target = allPrescriptions.find(p => p.id === id);
    if (target) {
      const restored = { ...target, deletedAt: null as any };
      await dbService.updatePrescription(restored);
      await dbService.processInventory(restored);
      await refreshPrescriptions();
      await refreshInventory();
      await refreshStats();
    }
  };

  const permanentlyDeletePrescription = async (id: string) => {
    await dbService.deletePrescription(id);
    await refreshStats();
  };

  const addNews = async (newsData: Omit<News, 'id'>) => {
    const newNews: News = { ...newsData, id: crypto.randomUUID() };
    await dbService.addNews(newNews);
    await refreshNews();
  };

  const updateNews = async (newsItem: News) => {
    await dbService.updateNews(newsItem);
    await refreshNews();
  };

  const deleteNews = async (id: string) => {
    await dbService.deleteNews(id);
    await refreshNews();
  };

  const addPayment = async (paymentData: Omit<Payment, 'id'>) => {
    const paymentId = crypto.randomUUID();
    const newPayment: Payment = { ...paymentData, id: paymentId, createdById: activeTeamMember?.id };
    await dbService.addPayment(newPayment);
    
    const farmer = farmers.find(f => f.id === newPayment.farmerId);
    const farmerName = farmer?.fullName || 'Bilinmeyen Çiftçi';

    if (newPayment.method === 'CHECK' || newPayment.method === 'TEDYE') {
        await addMyPayment({
            farmerId: newPayment.farmerId,
            farmerName,
            amount: newPayment.amount,
            issueDate: newPayment.date,
            dueDate: newPayment.dueDate || newPayment.date,
            type: newPayment.method === 'CHECK' ? 'CHECK' : 'TEDYE',
            status: 'PENDING',
            note: newPayment.note,
            accountId: newPayment.accountId,
            relatedId: paymentId
        });
    } else if (newPayment.accountId) {
      await dbService.addTransaction({
        id: crypto.randomUUID(),
        accountId: newPayment.accountId,
        type: 'INCOME',
        amount: newPayment.amount,
        date: newPayment.date,
        description: `${farmerName} ödemesi`,
        relatedId: paymentId,
        category: 'Çiftçi Ödemesi'
      });
    }
    
    await refreshStats();
  };

  const updatePayment = async (payment: Payment) => {
    await dbService.updatePayment(payment);
    
    if (payment.method === 'CHECK' || payment.method === 'TEDYE') {
        const myPaymentsList = await dbService.getMyPayments();
        const relatedMyPay = myPaymentsList.find(p => p.relatedId === payment.id);
        if (relatedMyPay) {
            const farmer = farmers.find(f => f.id === payment.farmerId);
            await dbService.updateMyPayment({
                ...relatedMyPay,
                amount: payment.amount,
                dueDate: payment.dueDate || payment.date,
                note: payment.note,
                accountId: payment.accountId,
                farmerName: farmer?.fullName || relatedMyPay.farmerName
            });
        }
    } else {
        const allTransactions = await dbService.getTransactions();
        const relatedTx = allTransactions.find(tx => tx.relatedId === payment.id);
        if (relatedTx) {
            if (payment.accountId) {
                const farmer = farmers.find(f => f.id === payment.farmerId);
                await dbService.updateTransaction({
                    ...relatedTx,
                    accountId: payment.accountId,
                    amount: payment.amount,
                    date: payment.date,
                    description: `${farmer?.fullName || 'Çiftçi'} ödemesi`
                });
            } else {
                await dbService.deleteTransaction(relatedTx.id);
            }
        } else if (payment.accountId) {
            const farmer = farmers.find(f => f.id === payment.farmerId);
            await dbService.addTransaction({
                id: crypto.randomUUID(),
                accountId: payment.accountId,
                type: 'INCOME',
                amount: payment.amount,
                date: payment.date,
                description: `${farmer?.fullName || 'Çiftçi'} ödemesi`,
                relatedId: payment.id,
                category: 'Çiftçi Ödemesi'
            });
        }
    }
    
    await refreshStats();
  };

  const deletePayment = async (id: string) => {
    const allTransactions = await dbService.getTransactions();
    const relatedTx = allTransactions.find(tx => tx.relatedId === id);
    if (relatedTx) {
      await dbService.deleteTransaction(relatedTx.id);
    }
    
    const myPays = await dbService.getMyPayments();
    const relatedMyPays = myPays.filter(p => p.relatedId === id);
    for (const p of relatedMyPays) {
        await deleteMyPayment(p.id);
    }

    await dbService.deletePayment(id);
    await refreshStats();
  };

  const softDeletePayment = async (id: string) => {
    const payment = payments.find(p => p.id === id);
    if (payment) {
        await dbService.updatePayment({ ...payment, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restorePayment = async (id: string) => {
    const payment = trashedPayments.find(p => p.id === id);
    if (payment) {
        await dbService.updatePayment({ ...payment, deletedAt: null as any });
        await refreshStats();
    }
  };

  const permanentlyDeletePayment = async (id: string) => {
    await deletePayment(id);
  };

  const addManualDebt = async (debt: Omit<ManualDebt, 'id'>) => {
    const id = crypto.randomUUID();
    await dbService.addManualDebt({ ...debt, id, createdById: activeTeamMember?.id });
    await refreshStats();
  };

  const updateManualDebt = async (debt: ManualDebt) => {
    await dbService.updateManualDebt(debt);
    await refreshStats();
  };

  const deleteManualDebt = async (id: string) => {
    await dbService.deleteManualDebt(id);
    await refreshStats();
  };

  const softDeleteManualDebt = async (id: string) => {
    const debt = manualDebts.find(d => d.id === id);
    if (debt) {
        await dbService.updateManualDebt({ ...debt, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreManualDebt = async (id: string) => {
    const debt = trashedManualDebts.find(d => d.id === id);
    if (debt) {
        await dbService.updateManualDebt({ ...debt, deletedAt: null as any });
        await refreshStats();
    }
  };

  const permanentlyDeleteManualDebt = async (id: string) => {
    await deleteManualDebt(id);
  };

  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'totalDebt' | 'balance'>) => {
    const newSupplier: Supplier = { 
        ...supplierData, 
        id: crypto.randomUUID(),
        totalDebt: 0,
        balance: 0
    };
    await dbService.addSupplier(newSupplier);
    await refreshStats();
  };

  const updateSupplier = async (supplier: Supplier) => {
    await dbService.updateSupplier(supplier);
    await refreshStats();
  };

  const deleteSupplier = async (id: string) => {
    // 1. Delete all associated purchases and revert inventory
    const purchases = await dbService.getSupplierPurchases(id);
    for (const p of purchases) {
        // Only revert inventory if the purchase was not already soft-deleted (trashed)
        if (!p.deletedAt) {
            await dbService.updateInventoryFromPurchase(p, true); // Revert inventory
        }
        await dbService.deleteSupplierPurchase(p.id);
    }

    // 2. Delete all associated payments
    const payments = await dbService.getSupplierPayments(id);
    for (const p of payments) {
        // Cleanup transactions
        const transactions = await dbService.getTransactions();
        const relatedTx = transactions.find(t => t.relatedId === p.id);
        if (relatedTx) {
            await dbService.deleteTransaction(relatedTx.id);
        }

        // Cleanup MyPayments
        const myPays = await dbService.getMyPayments();
        const relatedMyPay = myPays.find(mp => mp.relatedId === p.id || (mp.supplierId === id && mp.amount === p.amount && mp.issueDate === p.date));
        if (relatedMyPay) {
            await deleteMyPayment(relatedMyPay.id);
        }
        await dbService.deleteSupplierPayment(p.id);
    }

    // 3. Delete the supplier itself
    await dbService.deleteSupplier(id);
    await refreshStats();
  };

  const softDeleteSupplier = async (id: string) => {
    const supplier = suppliers.find(s => s.id === id);
    if (supplier) {
        await dbService.updateSupplier({ ...supplier, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreSupplier = async (id: string) => {
    const supplier = trashedSuppliers.find(s => s.id === id);
    if (supplier) {
        await dbService.updateSupplier({ ...supplier, deletedAt: null as any });
        await refreshStats();
    }
  };

  const permanentlyDeleteSupplier = async (id: string) => {
    await deleteSupplier(id);
  };

  const addSupplierPurchase = async (purchaseData: Omit<SupplierPurchase, 'id'>) => {
    const purchaseId = crypto.randomUUID();
    const purchase: SupplierPurchase = { ...purchaseData, id: purchaseId, createdById: activeTeamMember?.id };
    
    // 1. Handle new pesticides and update their IDs in the purchase record
    for (let i = 0; i < purchase.items.length; i++) {
        const item = purchase.items[i];
        if (item.pesticideId.startsWith('new-')) {
            const finalPesticideId = crypto.randomUUID();
            purchase.items[i].pesticideId = finalPesticideId;
            
            await dbService.addGlobalPesticide({
                id: finalPesticideId,
                name: item.pesticideName,
                activeIngredient: 'Belirtilmedi',
                defaultDosage: '100ml/100L',
                category: PesticideCategory.OTHER,
                description: 'Tedarikçi alımı ile otomatik eklendi.'
            });

            // Create inventory item for the new pesticide
            await dbService.addInventoryItem({
                id: crypto.randomUUID(),
                pesticideId: finalPesticideId,
                pesticideName: item.pesticideName,
                category: PesticideCategory.OTHER,
                quantity: 0, // Will be updated by updateInventoryFromPurchase
                unit: item.unit,
                buyingPrice: Number(item.buyingPrice),
                sellingPrice: Number(item.buyingPrice) * 1.2,
                lastUpdated: new Date().toISOString()
            });
        }
    }
    
    // 2. Update Inventory (Add quantities)
    await dbService.updateInventoryFromPurchase(purchase, false);
    
    // 3. Save the purchase
    await dbService.addSupplierPurchase({ ...purchase, isInventoryProcessed: true });
    
    await refreshStats();
  };

  const updateSupplierPurchase = async (purchase: SupplierPurchase) => {
    try {
        console.log('Starting updateSupplierPurchase for:', purchase.id);
        // Recalculate totalAmount
        const items = purchase.items || [];
        purchase.totalAmount = items.reduce((acc, item) => {
            const price = Number(item.buyingPrice) || 0;
            const qty = Number(item.quantity) || 0;
            return acc + (price * qty);
        }, 0);

        // 1. Get old purchase to revert inventory - Use direct lookup instead of getAll
        const oldPurchase = await dbService.getSupplierPurchaseById(purchase.id);
        
        if (oldPurchase) {
            console.log('Reverting old inventory for:', purchase.id);
            await dbService.updateInventoryFromPurchase(oldPurchase, true); // Revert old
        } else {
            console.warn('Old purchase not found for reverting inventory:', purchase.id);
        }

        // 2. Handle new pesticides in the updated purchase
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (String(item.pesticideId).startsWith('new-')) {
                console.log('Adding new pesticide from purchase:', item.pesticideName);
                const finalPesticideId = crypto.randomUUID();
                items[i].pesticideId = finalPesticideId;
                
                await dbService.addGlobalPesticide({
                    id: finalPesticideId,
                    name: item.pesticideName,
                    activeIngredient: 'Belirtilmedi',
                    defaultDosage: '100ml/100L',
                    category: PesticideCategory.OTHER,
                    description: 'Tedarikçi alımı ile otomatik eklendi.'
                });

                await dbService.addInventoryItem({
                    id: crypto.randomUUID(),
                    pesticideId: finalPesticideId,
                    pesticideName: item.pesticideName,
                    category: PesticideCategory.OTHER,
                    quantity: 0,
                    unit: item.unit,
                    buyingPrice: Number(item.buyingPrice) || 0,
                    sellingPrice: (Number(item.buyingPrice) || 0) * 1.2,
                    lastUpdated: new Date().toISOString()
                });
            }
        }

        // 3. Apply new inventory changes
        console.log('Applying new inventory for:', purchase.id);
        await dbService.updateInventoryFromPurchase(purchase, false);

        // 4. Update purchase in DB
        console.log('Finalizing purchase update in DB:', purchase.id);
        await dbService.updateSupplierPurchase({ ...purchase, isInventoryProcessed: true });

        await refreshStats();
        console.log('updateSupplierPurchase completed successfully');
    } catch (error) {
        console.error('Error in updateSupplierPurchase:', error);
        throw error;
    }
  };

  const softDeleteSupplierPurchase = async (id: string) => {
    const allPurchases = await dbService.getSupplierPurchases(); 
    const purchase = allPurchases.find(p => p.id === id);
    if (purchase && !purchase.deletedAt) {
      // Revert inventory
      await dbService.updateInventoryFromPurchase(purchase, true);
      
      // Mark as deleted
      await dbService.updateSupplierPurchase({
        ...purchase,
        isInventoryProcessed: false,
        deletedAt: new Date().toISOString()
      });
      await refreshStats();
    }
  };

  const restoreSupplierPurchase = async (id: string) => {
    const purchase = trashedSupplierPurchases.find(p => p.id === id);
    if (purchase) {
      // Restore inventory
      await dbService.updateInventoryFromPurchase(purchase, false);
      
      await dbService.updateSupplierPurchase({ ...purchase, isInventoryProcessed: true, deletedAt: null as any });
      await refreshStats();
    }
  };

  const permanentlyDeleteSupplierPurchase = async (id: string) => {
    const all = await dbService.getSupplierPurchases();
    const target = all.find(p => p.id === id);
    if (target && !target.deletedAt) {
        await dbService.updateInventoryFromPurchase(target, true);
    }
    await dbService.deleteSupplierPurchase(id);
    await refreshStats();
  };

  const deleteSupplierPurchase = async (id: string) => {
    await softDeleteSupplierPurchase(id);
  };

  const addSupplierPayment = async (paymentData: Omit<SupplierPayment, 'id'>) => {
    const paymentId = crypto.randomUUID();
    const payment: SupplierPayment = { ...paymentData, id: paymentId, createdById: activeTeamMember?.id };
    await dbService.addSupplierPayment(payment);
    
    const supplier = suppliers.find(s => s.id === payment.supplierId);
    const supplierName = supplier?.name || 'Bilinmeyen Tedarikçi';

    // If it's a check or promissory note, add to MyPayments
    if (payment.method === 'CHECK' || payment.method === 'PROMISSORY_NOTE') {
        await addMyPayment({
            supplierId: payment.supplierId,
            supplierName,
            amount: payment.amount,
            issueDate: payment.date,
            dueDate: payment.dueDate || payment.date,
            type: payment.method === 'CHECK' ? 'CHECK' : 'PROMISSORY_NOTE',
            status: 'PENDING',
            note: payment.note,
            accountId: payment.accountId,
            relatedId: paymentId
        });
    } else if (payment.method === 'CARD') {
        if (payment.installments && payment.installments > 1) {
            // Split into installments
            const installmentAmount = payment.amount / payment.installments;
            for (let i = 0; i < payment.installments; i++) {
                const dueDate = new Date(payment.date);
                dueDate.setMonth(dueDate.getMonth() + i + 1);
                
                await addMyPayment({
                    supplierId: payment.supplierId,
                    supplierName,
                    amount: installmentAmount,
                    issueDate: payment.date,
                    dueDate: dueDate.toISOString(),
                    type: 'OTHER',
                    status: 'PENDING',
                    note: `${payment.note || ''} (Taksit ${i + 1}/${payment.installments})`,
                    accountId: payment.accountId,
                    relatedId: paymentId
                });
            }
        } else if (payment.producerCardMonths && payment.producerCardMonths > 0) {
            // Producer card payment after X months
            const dueDate = new Date(payment.date);
            dueDate.setMonth(dueDate.getMonth() + payment.producerCardMonths);
            
            await addMyPayment({
                supplierId: payment.supplierId,
                supplierName,
                amount: payment.amount,
                issueDate: payment.date,
                dueDate: dueDate.toISOString(),
                type: 'OTHER',
                status: 'PENDING',
                note: `${payment.note || ''} (Üretici Kart - ${payment.producerCardMonths} Ay)`,
                accountId: payment.accountId,
                relatedId: paymentId
            });
        } else if (payment.accountId) {
            await dbService.addTransaction({
                id: crypto.randomUUID(),
                accountId: payment.accountId,
                type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
                amount: payment.amount,
                date: payment.date,
                description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı (Kart)` : `${supplierName} ödemesi (Kart)`,
                relatedId: paymentId,
                category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi'
            });
        }
    } else if (payment.accountId) {
        await dbService.addTransaction({
            id: crypto.randomUUID(),
            accountId: payment.accountId,
            type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
            amount: payment.amount,
            date: payment.date,
            description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı` : `${supplierName} ödemesi`,
            relatedId: paymentId,
            category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi'
        });
    }
    
    await refreshStats();
  };

  const updateSupplierPayment = async (payment: SupplierPayment) => {
    await dbService.updateSupplierPayment(payment);
    
    const supplier = suppliers.find(s => s.id === payment.supplierId);
    const supplierName = supplier?.name || 'Bilinmeyen Tedarikçi';

    // Delete old related records to recreate them cleanly
    const transactions = await dbService.getTransactions();
    const relatedTx = transactions.filter(t => t.relatedId === payment.id);
    for (const tx of relatedTx) {
        await dbService.deleteTransaction(tx.id);
    }
    
    const myPays = await dbService.getMyPayments();
    const relatedMyPays = myPays.filter(p => p.relatedId === payment.id);
    for (const p of relatedMyPays) {
        await dbService.deleteMyPayment(p.id);
    }

    // Recreate based on new payment details
    if (payment.method === 'CHECK' || payment.method === 'PROMISSORY_NOTE') {
        await addMyPayment({
            supplierId: payment.supplierId,
            supplierName,
            amount: payment.amount,
            issueDate: payment.date,
            dueDate: payment.dueDate || payment.date,
            type: payment.method === 'CHECK' ? 'CHECK' : 'PROMISSORY_NOTE',
            status: 'PENDING',
            note: payment.note,
            accountId: payment.accountId,
            relatedId: payment.id
        });
    } else if (payment.method === 'CARD') {
        if (payment.installments && payment.installments > 1) {
            const installmentAmount = payment.amount / payment.installments;
            for (let i = 0; i < payment.installments; i++) {
                const dueDate = new Date(payment.date);
                dueDate.setMonth(dueDate.getMonth() + i + 1);
                
                await addMyPayment({
                    supplierId: payment.supplierId,
                    supplierName,
                    amount: installmentAmount,
                    issueDate: payment.date,
                    dueDate: dueDate.toISOString(),
                    type: 'OTHER',
                    status: 'PENDING',
                    note: `${payment.note || ''} (Taksit ${i + 1}/${payment.installments})`,
                    accountId: payment.accountId,
                    relatedId: payment.id
                });
            }
        } else if (payment.producerCardMonths && payment.producerCardMonths > 0) {
            const dueDate = new Date(payment.date);
            dueDate.setMonth(dueDate.getMonth() + payment.producerCardMonths);
            
            await addMyPayment({
                supplierId: payment.supplierId,
                supplierName,
                amount: payment.amount,
                issueDate: payment.date,
                dueDate: dueDate.toISOString(),
                type: 'OTHER',
                status: 'PENDING',
                note: `${payment.note || ''} (Üretici Kart - ${payment.producerCardMonths} Ay)`,
                accountId: payment.accountId,
                relatedId: payment.id
            });
        } else if (payment.accountId) {
            await dbService.addTransaction({
                id: crypto.randomUUID(),
                accountId: payment.accountId,
                type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
                amount: payment.amount,
                date: payment.date,
                description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı (Kart)` : `${supplierName} ödemesi (Kart)`,
                relatedId: payment.id,
                category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi'
            });
        }
    } else if (payment.accountId) {
        await dbService.addTransaction({
            id: crypto.randomUUID(),
            accountId: payment.accountId,
            type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
            amount: payment.amount,
            date: payment.date,
            description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı` : `${supplierName} ödemesi`,
            relatedId: payment.id,
            category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi'
        });
    }

    await refreshStats();
  };

  const softDeleteSupplierPayment = async (id: string) => {
    const allSuppliers = await dbService.getSuppliers();
    let targetPayment: SupplierPayment | undefined;
    
    for (const s of allSuppliers) {
        const payments = await dbService.getSupplierPayments(s.id);
        targetPayment = payments.find(p => p.id === id);
        if (targetPayment) break;
    }

    if (targetPayment) {
        await dbService.updateSupplierPayment({ ...targetPayment, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreSupplierPayment = async (id: string) => {
    const payment = trashedSupplierPayments.find(p => p.id === id);
    if (payment) {
        await dbService.updateSupplierPayment({ ...payment, deletedAt: null as any });
        await refreshStats();
    }
  };

  const permanentlyDeleteSupplierPayment = async (id: string) => {
    await dbService.deleteSupplierPayment(id);
    await refreshStats();
  };

  const deleteSupplierPayment = async (id: string) => {
    await softDeleteSupplierPayment(id);
  };

  const addMyPayment = async (paymentData: Omit<MyPayment, 'id'>) => {
    const payment: MyPayment = { ...paymentData, id: crypto.randomUUID(), createdById: activeTeamMember?.id };
    await dbService.addMyPayment(payment);
    await refreshStats();
  };

  const updateMyPayment = async (payment: MyPayment) => {
    const allMyPayments = await dbService.getMyPayments();
    const oldPayment = allMyPayments.find(p => p.id === payment.id);
    await dbService.updateMyPayment(payment);
    
    // If status changed to PAID and accountId is present, create transaction
    if (payment.status === 'PAID' && oldPayment?.status !== 'PAID' && payment.accountId) {
      const isIncome = !!payment.farmerId;
      const typeLabel = payment.type === 'CHECK' ? 'Çek' : payment.type === 'TEDYE' ? 'Tedye' : 'Senet';
      const name = payment.farmerName || payment.supplierName || 'Bilinmeyen';
      
      await dbService.addTransaction({
        id: crypto.randomUUID(),
        accountId: payment.accountId,
        type: isIncome ? 'INCOME' : 'EXPENSE',
        amount: payment.amount,
        date: new Date().toISOString(),
        description: `${name} - ${typeLabel} ${isIncome ? 'Tahsilatı' : 'Ödemesi'}`,
        relatedId: payment.id,
        category: isIncome ? 'Çek/Senet Tahsilatı' : 'Çek/Senet Ödemesi'
      });
    } else if (payment.status !== 'PAID' && oldPayment?.status === 'PAID') {
      // If status changed from PAID to something else, delete the transaction
      const allTransactions = await dbService.getTransactions();
      const relatedTx = allTransactions.find(tx => tx.relatedId === payment.id);
      if (relatedTx) {
        await dbService.deleteTransaction(relatedTx.id);
      }
    }
    
    await refreshStats();
  };

  const softDeleteMyPayment = async (id: string) => {
    const allMyPayments = await dbService.getMyPayments();
    const payment = allMyPayments.find(p => p.id === id);
    if (payment) {
      await dbService.updateMyPayment({ ...payment, deletedAt: new Date().toISOString() });
      await refreshStats();
    }
  };

  const restoreMyPayment = async (id: string) => {
    const payment = trashedMyPayments.find(p => p.id === id);
    if (payment) {
      await dbService.updateMyPayment({ ...payment, deletedAt: null as any });
      await refreshStats();
    }
  };

  const permanentlyDeleteMyPayment = async (id: string) => {
    await dbService.deleteMyPayment(id);
    await refreshStats();
  };

  const deleteMyPayment = async (id: string) => {
    await softDeleteMyPayment(id);
  };

  const addExpense = async (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expenseData, id: crypto.randomUUID(), createdById: activeTeamMember?.id };
    await dbService.addExpense(newExpense);
    
    if (newExpense.accountId) {
      await dbService.addTransaction({
        id: crypto.randomUUID(),
        accountId: newExpense.accountId,
        type: 'EXPENSE',
        amount: newExpense.amount,
        date: newExpense.date,
        description: newExpense.title,
        relatedId: newExpense.id,
        category: 'Gider'
      });
    }
    
    await refreshStats();
  };

  const updateExpense = async (expense: Expense) => {
    await dbService.updateExpense(expense);
    
    // Handle transaction update
    const allTransactions = await dbService.getTransactions();
    const relatedTx = allTransactions.find(tx => tx.relatedId === expense.id);
    if (relatedTx) {
      if (expense.accountId) {
        // Update existing transaction
        await dbService.updateTransaction({
          ...relatedTx,
          accountId: expense.accountId,
          amount: expense.amount,
          date: expense.date,
          description: expense.title
        });
      } else {
        // Remove transaction if account was removed
        await dbService.deleteTransaction(relatedTx.id);
      }
    } else if (expense.accountId) {
      // Create new transaction if account was added
      await dbService.addTransaction({
        id: crypto.randomUUID(),
        accountId: expense.accountId,
        type: 'EXPENSE',
        amount: expense.amount,
        date: expense.date,
        description: expense.title,
        relatedId: expense.id,
        category: 'Gider'
      });
    }
    
    await refreshStats();
  };

  const deleteExpense = async (id: string) => {
    // Find if there is a related transaction
    const allTransactions = await dbService.getTransactions();
    const relatedTx = allTransactions.find(tx => tx.relatedId === id);
    if (relatedTx) {
      await dbService.deleteTransaction(relatedTx.id);
    }
    await dbService.deleteExpense(id);
    await refreshStats();
  };

  const softDeleteExpense = async (id: string) => {
    const expense = expenses.find(e => e.id === id);
    if (expense) {
        await dbService.updateExpense({ ...expense, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreExpense = async (id: string) => {
    const expense = trashedExpenses.find(e => e.id === id);
    if (expense) {
        await dbService.updateExpense({ ...expense, deletedAt: null as any });
        await refreshStats();
    }
  };

  const permanentlyDeleteExpense = async (id: string) => {
    await deleteExpense(id);
  };

  const addAccount = async (accountData: Omit<Account, 'id' | 'balance'>) => {
    const newAccount: Account = { ...accountData, id: crypto.randomUUID(), balance: 0 };
    await dbService.addAccount(newAccount);
    await refreshStats();
  };

  const updateAccount = async (account: Account) => {
    await dbService.updateAccount(account);
    await refreshStats();
  };

  const deleteAccount = async (id: string) => {
    const allTransactions = await dbService.getTransactions();
    const accountTxs = allTransactions.filter(tx => tx.accountId === id);
    for (const tx of accountTxs) {
      await dbService.deleteTransaction(tx.id);
    }
    await dbService.deleteAccount(id);
    await refreshStats();
  };

  const addTransaction = async (txData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = { ...txData, id: crypto.randomUUID() };
    await dbService.addTransaction(newTx);
    await refreshStats();
  };

  const deleteTransaction = async (id: string) => {
    await dbService.deleteTransaction(id);
    await refreshStats();
  };

  const addCollectionLog = async (logData: Omit<CollectionLog, 'id'>) => {
    const id = crypto.randomUUID();
    const log = { ...logData, id, createdById: activeTeamMember?.id };
    await dbService.addCollectionLog(log);
    setCollectionLogs(prev => [log, ...prev]);
  };

  const updateCollectionLog = async (log: CollectionLog) => {
    await dbService.updateCollectionLog(log);
    setCollectionLogs(prev => prev.map(l => l.id === log.id ? log : l));
  };

  const deleteCollectionLog = async (id: string) => {
    await dbService.deleteCollectionLog(id);
    setCollectionLogs(prev => prev.filter(l => l.id !== id));
  };

  const addTeamMember = async (member: Omit<TeamMember, 'id' | 'createdAt'>) => {
    const newMember: TeamMember = {
      ...member,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    await dbService.addTeamMember(newMember);
    await refreshStats();
  };

  const updateTeamMember = async (member: TeamMember) => {
    await dbService.updateTeamMember(member);
    await refreshStats();
  };

  const deleteTeamMember = async (id: string) => {
    await dbService.deleteTeamMember(id);
    await refreshStats();
  };

  const sendMessage = async (text: string) => {
    if (!activeTeamMember && userProfile.role !== 'admin') return;
    
    await dbService.sendMessage({
      id: crypto.randomUUID(),
      senderId: activeTeamMember?.id || 'admin-bypass',
      senderName: activeTeamMember?.fullName || userProfile.fullName || 'Yönetici',
      text,
      timestamp: new Date().toISOString()
    });
    await refreshStats();
  };

  const performManualTurnover = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const logs = await dbService.getTurnoverLogs();
      
      const finLog = logs.find(l => l.year === currentYear && l.type === 'FINANCIAL');
      if (finLog) {
        showToast(`${currentYear} yılı devri zaten yapılmış.`, 'info');
        return;
      }

      // Calculate balances up to the end of previous year
      const lastYear = currentYear - 1;
      const farmerBalances: Record<string, number> = {};
      
      // We need to calculate balance for ALL transactions BEFORE currentYear
      prescriptions.forEach(p => {
        const pYear = new Date(p.date).getFullYear();
        if (pYear <= lastYear && p.priceType !== 'CASH') {
          farmerBalances[p.farmerId] = (farmerBalances[p.farmerId] || 0) + (p.totalAmount || 0);
        }
      });
      
      manualDebts.forEach(d => {
        const dYear = new Date(d.date).getFullYear();
        if (dYear <= lastYear) {
          farmerBalances[d.farmerId] = (farmerBalances[d.farmerId] || 0) + d.amount;
        }
      });
      
      payments.forEach(p => {
        const pYear = new Date(p.date).getFullYear();
        if (pYear <= lastYear) {
          farmerBalances[p.farmerId] = (farmerBalances[p.farmerId] || 0) - p.amount;
        }
      });
      
      await dbService.performFinancialTurnover(currentYear, farmerBalances);
      await dbService.performInventoryTurnover(currentYear, inventory);
      
      await addSystemNotification('SUCCESS', `${currentYear} Yılı Devri`, `${currentYear} yılı için devir işlemleri başarıyla tamamlandı.`);
      showToast(`${currentYear} yılı devri tamamlandı.`, 'success');
      await refreshStats();
    } catch (e) {
      console.error("Manual turnover failed:", e);
      showToast("Devir işlemi sırasında bir hata oluştu.", 'error');
    }
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

  const syncLegacyData = async () => {
    const isSynced = localStorage.getItem('mks_inventory_sync_v2');
    if (isSynced) return;

    console.log("Starting legacy data synchronization...");
    
    const [allPrescriptions, allPurchases] = await Promise.all([
        dbService.getAllPrescriptions(),
        dbService.getSupplierPurchases()
    ]);

    // 1. Fix Prescriptions: Process those that are marked as processed but didn't update inventory
    for (const p of allPrescriptions) {
        if (p.deletedAt) continue;
        if (p.isProcessed && !p.isInventoryProcessed) {
            await dbService.processInventory(p);
        }
    }

    // 2. Fix Supplier Purchases: Ensure all quantities and total amounts are mathematically perfect and not NaN
    for (const p of allPurchases) {
        if (p.deletedAt) continue;
        let isCorrupted = false;

        // Ensure isInventoryProcessed is set
        if (p.isInventoryProcessed === undefined) {
            p.isInventoryProcessed = true;
            isCorrupted = true;
        }

        // Recalculate true total
        let trueTotal = 0;
        if (p.items && p.items.length > 0) {
            p.items.forEach(item => {
                const q = parseFloat(String(item.quantity).replace(',', '.')) || 0;
                const price = parseFloat(String(item.buyingPrice).replace(',', '.')) || 0;
                trueTotal += (q * price);
                if (q !== item.quantity || price !== item.buyingPrice) {
                    item.quantity = q;
                    item.buyingPrice = price;
                    isCorrupted = true;
                }
            });
            
            // Reapply sign logic based on type or legacy notes
            const isReturnOrSale = p.type === 'RETURN' || 
                                   (p.note && (p.note.includes('İADE') || p.note.includes('SATIŞ') || p.note.includes('azalış')));
            
            if (isReturnOrSale && trueTotal > 0) {
                trueTotal = -Math.abs(trueTotal);
            }
        } else if (p.totalAmount) {
            // No items, just raw amount? Parse it just in case
            trueTotal = parseFloat(String(p.totalAmount).replace(',', '.')) || 0;
        }

        if (p.totalAmount !== trueTotal || isNaN(p.totalAmount)) {
            p.totalAmount = trueTotal;
            isCorrupted = true;
        }

        if (isCorrupted) {
            await dbService.updateSupplierPurchase(p);
        }
    }

    // 3. Fix Supplier Payments: Ensure amounts are mathematically perfect and not NaN
    const allSupplierPayments = await dbService.getSupplierPayments();
    for (const p of allSupplierPayments) {
        if (p.deletedAt) continue;
        let isCorrupted = false;
        let trueAmount = parseFloat(String(p.amount).replace(',', '.')) || 0;
        
        // Reapply sign logic for RECEIVE type if needed
        if (p.type === 'RECEIVE' && trueAmount > 0) {
            // Amount is usually stored positive in DB, but its reduction is handled dynamically. Let's ensure it's positive in the DB.
            trueAmount = Math.abs(trueAmount);
        }

        if (p.amount !== trueAmount || isNaN(p.amount)) {
            p.amount = trueAmount;
            isCorrupted = true;
        }

        if (isCorrupted) {
            await dbService.updateSupplierPayment(p);
        }
    }

    // Force recalculate supplier debts inside the state just to be safe
    localStorage.setItem('mks_inventory_sync_v2', 'true'); // Bump version to trigger for everyone
    console.log("Legacy data synchronization completed.");
    await refreshStats();
  };

  useEffect(() => {
    const init = async () => {
        if (isInitialized) return;
        
        // Sync language from profile
        if (userProfile.language) {
            setLanguageState(userProfile.language);
        }
        
        await cleanupOldData();
        await syncLegacyData();
        await refreshStats();
        await refreshNews();
        await refreshPlants();
        await checkWeatherAlerts();
        
        setIsInitialized(true);

        try {
            const permission = await LocalNotifications.requestPermissions();
            if (permission.display !== 'granted') console.warn("Bildirim izinleri verilmedi.");
        } catch (e) {}
    };
    init();
  }, []);

    const prescriptionLabel = t('label.prescription');
    const farmerLabel = t('label.farmer');
    const farmerPluralLabel = t('label.farmers');

    return (
    <AppContext.Provider value={{ 
        stats, refreshStats, addFarmer, updateFarmer, deleteFarmer, bulkAddFarmers, softDeleteFarmer, restoreFarmer, permanentlyDeleteFarmer,
        farmers, trashedFarmers, visits, trashedVisits, reminders, addReminder, editReminder, toggleReminder, deleteReminder,
        uiScale, setUiScale, 
        notifications, unreadCount, clearNotifications, markAllAsRead,
        userProfile, updateUserProfile, syncUserProfile, isAdmin, subscriptionStatus, subscriptionEndsAt, getAllUsers, updateUserSubscription, deleteUser, sendPasswordReset, addSystemNotification,
        teamMembers, addTeamMember, updateTeamMember, deleteTeamMember, activeTeamMember, setActiveTeamMember,
        messages, sendMessage,
        prescriptionLabel, farmerLabel, farmerPluralLabel,
        addVisit, updateVisit, deleteVisit, softDeleteVisit, restoreVisit, permanentlyDeleteVisit,
        inventory, trashedInventory, refreshInventory, addInventoryItem, updateInventoryItem, bulkUpdateInventoryItems, deleteInventoryItem, softDeleteInventoryItem, restoreInventoryItem, permanentlyDeleteInventoryItem,
        prescriptions, trashedPrescriptions, supplierPurchases, addPrescription, refreshPrescriptions, togglePrescriptionStatus, softDeletePrescription, restorePrescription, permanentlyDeletePrescription,
        news, addNews, updateNews, deleteNews, refreshNews,
        payments, trashedPayments, addPayment, updatePayment, deletePayment, softDeletePayment, restorePayment, permanentlyDeletePayment,
        manualDebts, trashedManualDebts, addManualDebt, updateManualDebt, deleteManualDebt, softDeleteManualDebt, restoreManualDebt, permanentlyDeleteManualDebt,
        suppliers, trashedSuppliers, trashedSupplierPurchases, trashedSupplierPayments, addSupplier, updateSupplier, deleteSupplier, softDeleteSupplier, restoreSupplier, permanentlyDeleteSupplier, addSupplierPurchase, updateSupplierPurchase, deleteSupplierPurchase, softDeleteSupplierPurchase, restoreSupplierPurchase, permanentlyDeleteSupplierPurchase, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment, softDeleteSupplierPayment, restoreSupplierPayment, permanentlyDeleteSupplierPayment,
        myPayments, addMyPayment, updateMyPayment, deleteMyPayment, softDeleteMyPayment, restoreMyPayment, permanentlyDeleteMyPayment,
        expenses, trashedExpenses, addExpense, updateExpense, deleteExpense, softDeleteExpense, restoreExpense, permanentlyDeleteExpense,
        accounts, addAccount, updateAccount, deleteAccount,
        transactions, addTransaction, deleteTransaction,
        performManualTurnover,
        isInitialized,
        showToast, hapticFeedback,
        language, setLanguage, t,
        collectionLogs, addCollectionLog, updateCollectionLog, deleteCollectionLog,
        plants, addPlant, updatePlant, deletePlant, refreshPlants
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

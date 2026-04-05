
import { safeStringify } from '../utils/json';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { dbService, setActionBlocked, setActionBlockedCallback } from '../services/db';
import { WeatherService, AGRI_CITIES } from '../services/weather';
import { Farmer, UIScale, AppNotification, UserProfile, Reminder, VisitLog, AgriCity, InventoryItem, Prescription, Payment, ManualDebt, Supplier, SupplierPurchase, SupplierPayment, MyPayment, PesticideCategory, ViewState, Expense, Account, Transaction, TeamMember, Message, Language } from '../types';
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
  updateUserProfile: (profile: UserProfile) => void;
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
  refreshInventory: () => Promise<void>;
  addInventoryItem: (item: InventoryItem) => Promise<void>;
  updateInventoryItem: (item: InventoryItem) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  prescriptions: Prescription[];
  trashedPrescriptions: Prescription[];
  addPrescription: (prescription: Omit<Prescription, 'id' | 'prescriptionNo'>) => Promise<string>;
  refreshPrescriptions: () => Promise<void>;
  togglePrescriptionStatus: (id: string) => Promise<Prescription | null>;
  softDeletePrescription: (id: string) => Promise<void>;
  restorePrescription: (id: string) => Promise<void>;
  permanentlyDeletePrescription: (id: string) => Promise<void>;
  payments: Payment[];
  trashedPayments: Payment[];
  addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
  updatePayment: (payment: Payment) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  softDeletePayment: (id: string) => Promise<void>;
  restorePayment: (id: string) => Promise<void>;
  permanentlyDeletePayment: (id: string) => Promise<void>;
  manualDebts: ManualDebt[];
  addManualDebt: (debt: Omit<ManualDebt, 'id'>) => Promise<void>;
  updateManualDebt: (debt: ManualDebt) => Promise<void>;
  deleteManualDebt: (id: string) => Promise<void>;
  suppliers: Supplier[];
  trashedSuppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'totalDebt' | 'balance'>) => Promise<void>;
  updateSupplier: (supplier: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  softDeleteSupplier: (id: string) => Promise<void>;
  restoreSupplier: (id: string) => Promise<void>;
  permanentlyDeleteSupplier: (id: string) => Promise<void>;
  addSupplierPurchase: (purchase: Omit<SupplierPurchase, 'id'>) => Promise<void>;
  updateSupplierPurchase: (purchase: SupplierPurchase) => Promise<void>;
  deleteSupplierPurchase: (id: string) => Promise<void>;
  addSupplierPayment: (payment: Omit<SupplierPayment, 'id'>) => Promise<void>;
  updateSupplierPayment: (payment: SupplierPayment) => Promise<void>;
  deleteSupplierPayment: (id: string) => Promise<void>;
  myPayments: MyPayment[];
  addMyPayment: (payment: Omit<MyPayment, 'id'>) => Promise<void>;
  updateMyPayment: (payment: MyPayment) => Promise<void>;
  deleteMyPayment: (id: string) => Promise<void>;
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
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
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [trashedPrescriptions, setTrashedPrescriptions] = useState<Prescription[]>([]);
  const [trashedFarmers, setTrashedFarmers] = useState<Farmer[]>([]);
  const [trashedVisits, setTrashedVisits] = useState<VisitLog[]>([]);
  const [trashedPayments, setTrashedPayments] = useState<Payment[]>([]);
  const [trashedSuppliers, setTrashedSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualDebts, setManualDebts] = useState<ManualDebt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [myPayments, setMyPayments] = useState<MyPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
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

  const t = (key: string, placeholders?: Record<string, string>): string => {
    let translation = getTranslation(language, key);
    if (placeholders) {
      Object.keys(placeholders).forEach(placeholderKey => {
        translation = translation.replace(`{{${placeholderKey}}}`, placeholders[placeholderKey]);
      });
    }
    return translation;
  };

  const updateUserProfile = (profile: UserProfile) => {
      setUserProfile(profile);
      localStorage.setItem('mks_user_profile', safeStringify(profile));
      
      // Firebase Sync
      const user = auth.currentUser;
      if (user) {
          dbService.saveUserProfile(user.uid, profile);
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
    const items = await dbService.getAllPrescriptions();
    setPrescriptions(items);
  };

  const togglePrescriptionStatus = async (id: string): Promise<Prescription | null> => {
    let p = prescriptions.find(item => item.id === id);
    if (!p) {
        const all = await dbService.getAllPrescriptions();
        p = all.find(item => item.id === id);
    }
    if (!p) return null;

    const updated: Prescription = { ...p, isProcessed: !p.isProcessed };
    await dbService.updatePrescription(updated);
    
    // Fetch the absolute latest state from DB to ensure isInventoryProcessed is correct
    const latest = await dbService.getAllPrescriptions();
    const finalUpdated = latest.find(item => item.id === id) || updated;

    await refreshPrescriptions();
    await refreshInventory();
    await refreshStats();

    return finalUpdated;
  };

  const refreshStats = async (syncedReminders?: Reminder[]) => {
    const allPrescriptions = await dbService.getAllPrescriptions();
    
    // Auto-delete prescriptions in trash for more than 30 days
    const now = new Date();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const validPrescriptions: Prescription[] = [];
    const trashed: Prescription[] = [];

    for (const p of allPrescriptions) {
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

    const [rawFarmerList, rawVisitList, reminderListFromDB, inventoryData, rawPaymentList, manualDebtList, rawSupplierList, myPaymentList, expenseList, teamMemberList, messageList] = await Promise.all([
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
        dbService.getMessages()
    ]);

    // Separate active and trashed items
    const farmerList = rawFarmerList.filter(f => !f.deletedAt);
    const trashedF = rawFarmerList.filter(f => f.deletedAt);
    
    const visitList = rawVisitList.filter(v => !v.deletedAt);
    const trashedV = rawVisitList.filter(v => v.deletedAt);
    
    const paymentList = rawPaymentList.filter(p => !p.deletedAt);
    const trashedP = rawPaymentList.filter(p => p.deletedAt);
    
    const supplierList = rawSupplierList.filter(s => !s.deletedAt);
    const trashedS = rawSupplierList.filter(s => s.deletedAt);

    // Auto-delete trashed items older than 30 days
    for (const f of trashedF) {
        if (now.getTime() - new Date(f.deletedAt!).getTime() > thirtyDaysInMs) {
            await dbService.deleteFarmer(f.id);
        }
    }
    for (const v of trashedV) {
        if (now.getTime() - new Date(v.deletedAt!).getTime() > thirtyDaysInMs) {
            await dbService.deleteVisit(v.id);
        }
    }
    for (const p of trashedP) {
        if (now.getTime() - new Date(p.deletedAt!).getTime() > thirtyDaysInMs) {
            await dbService.deletePayment(p.id);
        }
    }
    for (const s of trashedS) {
        if (now.getTime() - new Date(s.deletedAt!).getTime() > thirtyDaysInMs) {
            await dbService.deleteSupplier(s.id);
        }
    }

    setTrashedFarmers(trashedF.filter(f => now.getTime() - new Date(f.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedVisits(trashedV.filter(v => now.getTime() - new Date(v.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedPayments(trashedP.filter(p => now.getTime() - new Date(p.deletedAt!).getTime() <= thirtyDaysInMs));
    setTrashedSuppliers(trashedS.filter(s => now.getTime() - new Date(s.deletedAt!).getTime() <= thirtyDaysInMs));

    setVisits(visitList);

    const finalReminders = [...(syncedReminders || reminderListFromDB)];
    
    // Fetch all purchases and payments for all suppliers to calculate balances
    const supplierPurchasesPromises = supplierList.map(s => dbService.getSupplierPurchases(s.id));
    const supplierPaymentsPromises = supplierList.map(s => dbService.getSupplierPayments(s.id));
    
    const allPurchases = await Promise.all(supplierPurchasesPromises);
    const allPayments = await Promise.all(supplierPaymentsPromises);
    
    const updatedSupplierList = supplierList.map((s, idx) => {
        const purchases = allPurchases[idx];
        const payments = allPayments[idx];
        
        const totalPurchased = purchases.reduce((acc, p) => acc + p.totalAmount, 0);
        const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
        
        return {
            ...s,
            totalDebt: totalPurchased,
            balance: totalPaid - totalPurchased // Negative means we owe money
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
            farmerDebts[p.farmerId] = (farmerDebts[p.farmerId] || 0) + (p.totalAmount || 0);
        }
    });

    // Add manual debts (excluding turnover entries to avoid double counting in grand total)
    manualDebtList.forEach(d => {
        if (!d.id.startsWith('turnover-')) {
            farmerDebts[d.farmerId] = (farmerDebts[d.farmerId] || 0) + d.amount;
        }
    });

    // Subtract payments from debt
    paymentList.forEach(pay => {
        farmerDebts[pay.farmerId] = (farmerDebts[pay.farmerId] || 0) - pay.amount;
    });

    // Total debt is the sum of all positive balances (money owed to the engineer)
    // IMPORTANT: We ignore turnover entries for the overall total debt calculation to avoid doubling
    const totalDebt = Object.values(farmerDebts).reduce((acc, val) => acc + (val > 0 ? val : 0), 0);

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

    // Toplam Satış Tutarı Hesapla
    const totalSales = prescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0);

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
    setPayments(paymentList);
    setSuppliers(updatedSupplierList);
    setMyPayments(myPaymentList);
    setExpenses(expenseList);
    setManualDebts(manualDebtList);
    setTeamMembers(teamMemberList);
    setMessages(messageList);
    
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

    const transactionList = await dbService.getTransactions();
    setAccounts(accountList);
    setTransactions(transactionList);
    
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
      regionalAlerts
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
        const { deletedAt, ...rest } = farmer;
        await dbService.updateFarmer(rest);
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
        const { deletedAt, ...rest } = visit;
        await dbService.updateVisit(rest);
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
      const { deletedAt, ...rest } = target;
      await dbService.updatePrescription(rest as Prescription);
      await dbService.processInventory(rest as Prescription);
      await refreshPrescriptions();
      await refreshInventory();
      await refreshStats();
    }
  };

  const permanentlyDeletePrescription = async (id: string) => {
    await dbService.deletePrescription(id);
    await refreshStats();
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
        const { deletedAt, ...rest } = payment;
        await dbService.updatePayment(rest);
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
    const currentInventory = await dbService.getInventory();
    for (const p of purchases) {
        for (const item of p.items) {
            const existing = currentInventory.find(i => i.pesticideId === item.pesticideId);
            if (existing) {
                const updatedItem = {
                    ...existing,
                    quantity: Math.max(0, Number(existing.quantity) - Number(item.quantity)),
                    lastUpdated: new Date().toISOString()
                };
                await dbService.updateInventoryItem(updatedItem);
                const idx = currentInventory.findIndex(i => i.id === existing.id);
                if (idx !== -1) currentInventory[idx] = updatedItem;
            }
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
        const { deletedAt, ...rest } = supplier;
        await dbService.updateSupplier(rest);
        await refreshStats();
    }
  };

  const permanentlyDeleteSupplier = async (id: string) => {
    await deleteSupplier(id);
  };

  const addSupplierPurchase = async (purchaseData: Omit<SupplierPurchase, 'id'>) => {
    const purchaseId = crypto.randomUUID();
    const purchase: SupplierPurchase = { ...purchaseData, id: purchaseId, createdById: activeTeamMember?.id };
    const currentInventory = await dbService.getInventory();
    
    // Update Inventory and fix new pesticide IDs
    for (let i = 0; i < purchase.items.length; i++) {
        const item = purchase.items[i];
        const existing = currentInventory.find(inv => inv.pesticideId === item.pesticideId);
        
        let finalPesticideId = item.pesticideId;
        
        if (existing) {
            const updatedItem = {
                ...existing,
                quantity: Math.max(0, Number(existing.quantity) + Number(item.quantity)),
                buyingPrice: item.buyingPrice, // Update buying price to latest
                lastUpdated: new Date().toISOString()
            };
            await dbService.updateInventoryItem(updatedItem);
            const idx = currentInventory.findIndex(i => i.id === existing.id);
            if (idx !== -1) currentInventory[idx] = updatedItem;
        } else {
            // If it's a new pesticide (tempId from UI), we add it to the library too
            if (item.pesticideId.startsWith('new-')) {
                finalPesticideId = crypto.randomUUID();
                purchase.items[i].pesticideId = finalPesticideId; // Update the item in the purchase record
                
                await dbService.addGlobalPesticide({
                    id: finalPesticideId,
                    name: item.pesticideName,
                    activeIngredient: 'Belirtilmedi',
                    defaultDosage: '100ml/100L',
                    category: PesticideCategory.OTHER,
                    description: 'Tedarikçi alımı ile otomatik eklendi.'
                });
            }

            const newInventoryItem = {
                id: crypto.randomUUID(),
                pesticideId: finalPesticideId,
                pesticideName: item.pesticideName,
                category: PesticideCategory.OTHER,
                quantity: Number(item.quantity),
                unit: item.unit,
                buyingPrice: Number(item.buyingPrice),
                sellingPrice: Number(item.buyingPrice) * 1.2, // Default 20% margin
                lastUpdated: new Date().toISOString()
            };
            await dbService.addInventoryItem(newInventoryItem);
            currentInventory.push(newInventoryItem);
        }
    }
    
    // Save the purchase AFTER updating the pesticide IDs
    await dbService.addSupplierPurchase(purchase);
    
    await refreshStats();
  };

  const updateSupplierPurchase = async (purchase: SupplierPurchase) => {
    // Recalculate totalAmount
    purchase.totalAmount = purchase.items.reduce((acc, item) => acc + (item.buyingPrice * item.quantity), 0);

    // 1. Get old purchase to revert inventory
    const allPurchases = await dbService.getSupplierPurchases(purchase.supplierId);
    const oldPurchase = allPurchases.find(p => p.id === purchase.id);
    const currentInventory = await dbService.getInventory();
    
    if (oldPurchase) {
        // Revert old inventory changes
        for (const item of oldPurchase.items) {
            const existing = currentInventory.find(i => i.pesticideId === item.pesticideId);
            if (existing) {
                const updatedItem = {
                    ...existing,
                    quantity: Math.max(0, Number(existing.quantity) - Number(item.quantity)),
                    lastUpdated: new Date().toISOString()
                };
                await dbService.updateInventoryItem(updatedItem);
                const idx = currentInventory.findIndex(i => i.id === existing.id);
                if (idx !== -1) currentInventory[idx] = updatedItem;
            }
        }
    }

    // 3. Apply new inventory changes and handle new pesticides
    for (let i = 0; i < purchase.items.length; i++) {
        const item = purchase.items[i];
        const existing = currentInventory.find(inv => inv.pesticideId === item.pesticideId);
        
        let finalPesticideId = item.pesticideId;
        
        if (existing) {
            const updatedItem = {
                ...existing,
                quantity: Math.max(0, Number(existing.quantity) + Number(item.quantity)),
                buyingPrice: item.buyingPrice,
                lastUpdated: new Date().toISOString()
            };
            await dbService.updateInventoryItem(updatedItem);
            const idx = currentInventory.findIndex(i => i.id === existing.id);
            if (idx !== -1) currentInventory[idx] = updatedItem;
        } else {
            // If it's a new pesticide (tempId from UI), we add it to the library too
            if (item.pesticideId.startsWith('new-')) {
                finalPesticideId = crypto.randomUUID();
                purchase.items[i].pesticideId = finalPesticideId; // Update the item in the purchase record
                
                await dbService.addGlobalPesticide({
                    id: finalPesticideId,
                    name: item.pesticideName,
                    activeIngredient: 'Belirtilmedi',
                    defaultDosage: '100ml/100L',
                    category: PesticideCategory.OTHER,
                    description: 'Tedarikçi alımı ile otomatik eklendi.'
                });
            }

            const newInventoryItem = {
                id: crypto.randomUUID(),
                pesticideId: finalPesticideId,
                pesticideName: item.pesticideName,
                category: PesticideCategory.OTHER,
                quantity: Number(item.quantity),
                unit: item.unit,
                buyingPrice: Number(item.buyingPrice),
                sellingPrice: Number(item.buyingPrice) * 1.2, // Default 20% margin
                lastUpdated: new Date().toISOString()
            };
            await dbService.addInventoryItem(newInventoryItem);
            currentInventory.push(newInventoryItem);
        }
    }

    // 2. Update purchase in DB (AFTER updating pesticide IDs)
    await dbService.updateSupplierPurchase(purchase);

    await refreshStats();
  };

  const deleteSupplierPurchase = async (id: string) => {
    const allSuppliers = await dbService.getSuppliers();
    let targetPurchase: SupplierPurchase | undefined;
    
    for (const s of allSuppliers) {
        const purchases = await dbService.getSupplierPurchases(s.id);
        targetPurchase = purchases.find(p => p.id === id);
        if (targetPurchase) break;
    }

    if (targetPurchase) {
        const currentInventory = await dbService.getInventory();
        for (const item of targetPurchase.items) {
            const existing = currentInventory.find(i => i.pesticideId === item.pesticideId);
            if (existing) {
                const updatedItem = {
                    ...existing,
                    quantity: Math.max(0, Number(existing.quantity) - Number(item.quantity)),
                    lastUpdated: new Date().toISOString()
                };
                await dbService.updateInventoryItem(updatedItem);
                
                // Update in-memory array so subsequent items in the loop see the updated quantity
                const idx = currentInventory.findIndex(i => i.id === existing.id);
                if (idx !== -1) currentInventory[idx] = updatedItem;
            }
        }
        await dbService.deleteSupplierPurchase(id);
    }

    await refreshStats();
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
                type: 'EXPENSE',
                amount: payment.amount,
                date: payment.date,
                description: `${supplierName} ödemesi (Kart)`,
                relatedId: paymentId,
                category: 'Tedarikçi Ödemesi'
            });
        }
    } else if (payment.accountId) {
        await dbService.addTransaction({
            id: crypto.randomUUID(),
            accountId: payment.accountId,
            type: 'EXPENSE',
            amount: payment.amount,
            date: payment.date,
            description: `${supplierName} ödemesi`,
            relatedId: paymentId,
            category: 'Tedarikçi Ödemesi'
        });
    }
    
    await refreshStats();
  };

  const updateSupplierPayment = async (payment: SupplierPayment) => {
    await dbService.updateSupplierPayment(payment);
    
    if (payment.method === 'CHECK' || payment.method === 'PROMISSORY_NOTE') {
        const myPaymentsList = await dbService.getMyPayments();
        const relatedMyPay = myPaymentsList.find(p => p.relatedId === payment.id);
        if (relatedMyPay) {
            await dbService.updateMyPayment({
                ...relatedMyPay,
                amount: payment.amount,
                dueDate: payment.date,
                note: payment.note,
                accountId: payment.accountId
            });
        }
    } else {
        const allTransactions = await dbService.getTransactions();
        const relatedTx = allTransactions.find(tx => tx.relatedId === payment.id);
        if (relatedTx) {
            if (payment.accountId) {
                const supplier = suppliers.find(s => s.id === payment.supplierId);
                await dbService.updateTransaction({
                    ...relatedTx,
                    accountId: payment.accountId,
                    amount: payment.amount,
                    date: payment.date,
                    description: `${supplier?.name || 'Tedarikçi'} ödemesi`
                });
            } else {
                await dbService.deleteTransaction(relatedTx.id);
            }
        } else if (payment.accountId) {
            const supplier = suppliers.find(s => s.id === payment.supplierId);
            await dbService.addTransaction({
                id: crypto.randomUUID(),
                accountId: payment.accountId,
                type: 'EXPENSE',
                amount: payment.amount,
                date: payment.date,
                description: `${supplier?.name || 'Tedarikçi'} ödemesi`,
                relatedId: payment.id,
                category: 'Tedarikçi Ödemesi'
            });
        }
    }
    await refreshStats();
  };

  const deleteSupplierPayment = async (id: string) => {
    const allSuppliers = await dbService.getSuppliers();
    let targetPayment: SupplierPayment | undefined;
    
    for (const s of allSuppliers) {
        const payments = await dbService.getSupplierPayments(s.id);
        targetPayment = payments.find(p => p.id === id);
        if (targetPayment) break;
    }

    if (targetPayment) {
        // Delete related transactions
        const transactions = await dbService.getTransactions();
        const relatedTx = transactions.find(t => t.relatedId === id);
        if (relatedTx) {
            await dbService.deleteTransaction(relatedTx.id);
        }
        
        // Delete related MyPayments
        const myPays = await dbService.getMyPayments();
        const relatedMyPays = myPays.filter(p => p.relatedId === id);
        for (const p of relatedMyPays) {
            await deleteMyPayment(p.id);
        }

        await dbService.deleteSupplierPayment(id);
    }
    
    await refreshStats();
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

  const deleteMyPayment = async (id: string) => {
    const allTransactions = await dbService.getTransactions();
    const relatedTx = allTransactions.find(tx => tx.relatedId === id);
    if (relatedTx) {
      await dbService.deleteTransaction(relatedTx.id);
    }
    await dbService.deleteMyPayment(id);
    await refreshStats();
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

  useEffect(() => {
    const init = async () => {
        if (isInitialized) return;
        
        // Sync language from profile
        if (userProfile.language) {
            setLanguageState(userProfile.language);
        }
        
        await cleanupOldData();
        await refreshStats();
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
        inventory, refreshInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem,
        prescriptions, trashedPrescriptions, addPrescription, refreshPrescriptions, togglePrescriptionStatus, softDeletePrescription, restorePrescription, permanentlyDeletePrescription,
        payments, trashedPayments, addPayment, updatePayment, deletePayment, softDeletePayment, restorePayment, permanentlyDeletePayment,
        manualDebts, addManualDebt, updateManualDebt, deleteManualDebt,
        suppliers, trashedSuppliers, addSupplier, updateSupplier, deleteSupplier, softDeleteSupplier, restoreSupplier, permanentlyDeleteSupplier, addSupplierPurchase, updateSupplierPurchase, deleteSupplierPurchase, addSupplierPayment, updateSupplierPayment, deleteSupplierPayment,
        myPayments, addMyPayment, updateMyPayment, deleteMyPayment,
        expenses, addExpense, updateExpense, deleteExpense,
        accounts, addAccount, updateAccount, deleteAccount,
        transactions, addTransaction, deleteTransaction,
        performManualTurnover,
        isInitialized,
        showToast, hapticFeedback,
        language, setLanguage, t
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

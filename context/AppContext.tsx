
import { safeStringify } from '../utils/json';
import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { dbService, setActionBlocked, setActionBlockedCallback } from '../services/db';
import { Farmer, UIScale, AppNotification, UserProfile, Reminder, VisitLog, InventoryItem, Prescription, Payment, ManualDebt, Supplier, SupplierPurchase, SupplierPayment, MyPayment, Expense, Account, Transaction, TeamMember, Message, Language, News, CollectionLog, Plant, PesticideCategory } from '../types';
import { DEFAULT_PLANTS } from '../constants/plants';
import { getTranslation } from '../utils/translations';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { auth } from '../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ToastHost, emitAppToast } from '../components/ToastHost';
import { DashboardStats, computeFullAppSnapshot } from './statsEngine';
import {
  scheduleReminderNotification,
  cancelReminderNotification,
  checkWeatherAlertsForProfile
} from './weatherNotifications';
import {
  runUnifiedSmartNotificationCheck,
  saveNotificationPrefsLocally
} from '../utils/smartNotificationEngine';
import { runLegacyDataSync } from './legacySync';
import { generateUUID } from '../utils/uuid';
import { round2 } from '../utils/dateUtils';
import { computeFarmerLedgerTotals } from '../utils/ledger';

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
  addSystemNotification: (type: AppNotification['type'], title: string, message: string, extra?: Partial<AppNotification>) => Promise<void>;
  runSmartNotificationsScan: (forceManualScan?: boolean) => Promise<number>;
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
  addPayment: (payment: Omit<Payment, 'id'> & { id?: string }) => Promise<string>;
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
  addSupplier: (supplier: Omit<Supplier, 'id' | 'totalDebt' | 'balance'>) => Promise<string>;
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
  transferBetweenAccounts: (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    description?: string;
    id?: string;
  }) => Promise<void>;
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  performManualTurnover: () => Promise<{ success: boolean; year: number }>;
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
  colorMode: 'DARK',
  language: 'tr',
  theme: 'TECHNICAL'
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
  const [isInitialized, setIsInitialized] = useState(false);

  const [uiScale, setUiScaleState] = useState<UIScale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mks_ui_scale');
      if (saved === 'SMALL' || saved === 'MEDIUM' || saved === 'LARGE') {
        return saved;
      }
      return 'MEDIUM';
    }
    return 'MEDIUM';
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
        try {
            const saved = localStorage.getItem('mks_user_profile');
            const parsed = saved ? JSON.parse(saved) : DEFAULT_PROFILE;
            const merged = { ...DEFAULT_PROFILE, ...parsed };
            if (merged.theme === 'DEFAULT' || !merged.theme) {
              merged.theme = 'TECHNICAL';
              merged.colorMode = 'DARK';
            }
            return merged;
        } catch (e) {
            console.error("Profile load error", e);
            return DEFAULT_PROFILE;
        }
    }
    return DEFAULT_PROFILE;
  });

  useEffect(() => {
    const rawTheme = userProfile.theme;
    const activeTheme =
      rawTheme && ['GLASSY_V30', 'APPLE', 'LIGHT', 'ORGANIC', 'TECHNICAL', 'MINIMAL'].includes(rawTheme)
        ? rawTheme === 'MINIMAL'
          ? 'TECHNICAL'
          : rawTheme
        : 'TECHNICAL';

    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [userProfile.theme, userProfile.colorMode]);

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
    updateUserProfile({ ...userProfile, language: lang }).catch(err => {
      console.warn('Dil tercihi buluta kaydedilemedi:', err);
    });
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
          const plant: Plant = { ...pData as any, id: generateUUID() };
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
    const plant: Plant = { ...plantData, id: generateUUID() };
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
      if (profile.notificationPrefs) {
          saveNotificationPrefsLocally(profile.notificationPrefs);
      }
      
      // Firebase Sync
      const user = auth.currentUser;
      if (user) {
          await dbService.saveUserProfile(user.uid, profile);
      }
  };

  const syncUserProfile = (profile: UserProfile) => {
      setUserProfile(prev => {
          const prevUid = prev.uid || prev.id;
          const nextUid = profile.uid || profile.id;
          if (prevUid && nextUid && prevUid !== nextUid) {
              setActiveTeamMember(null);
              localStorage.removeItem('mks_active_team_member');
          }
          const preservedTheme =
              profile.theme && profile.theme !== 'DEFAULT'
                  ? profile.theme
                  : prev.theme && prev.theme !== 'DEFAULT'
                      ? prev.theme
                      : 'TECHNICAL';
          const merged: UserProfile = {
              ...DEFAULT_PROFILE,
              ...prev,
              ...profile,
              theme: preservedTheme,
              colorMode: profile.colorMode ?? prev.colorMode ?? 'DARK',
          };
          localStorage.setItem('mks_user_profile', safeStringify(merged));
          return merged;
      });
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

  const addSystemNotification = async (
      type: AppNotification['type'],
      title: string,
      message: string,
      extra?: Partial<AppNotification>
  ) => {
      const newNotif: AppNotification = {
          id: generateUUID(),
          type,
          title,
          message,
          date: new Date().toISOString(),
          isRead: false,
          ...(extra || {})
      };
      await dbService.addNotification(newNotif);
      await refreshNotifications();
  };

  const smartScanRunningRef = useRef(false);

  const runSmartNotificationsScan = useCallback(async (forceManualScan = false): Promise<number> => {
      if (!auth.currentUser) return 0;
      if (smartScanRunningRef.current && !forceManualScan) return 0;
      smartScanRunningRef.current = true;
      try {
          const allSupplierPays = await dbService.getSupplierPayments().catch(() => [] as SupplierPayment[]);
          const count = await runUnifiedSmartNotificationCheck({
              userProfile,
              farmers,
              suppliers,
              prescriptions,
              payments,
              myPayments,
              supplierPayments: allSupplierPays,
              reminders,
              collectionLogs,
              forceManualScan,
              onEmitNotification: async (notif) => {
                  const created: AppNotification = {
                      id: generateUUID(),
                      type: notif.type,
                      category: notif.category,
                      title: notif.title,
                      message: notif.message,
                      targetView: notif.targetView,
                      actionLabel: notif.actionLabel,
                      callItems: notif.callItems,
                      date: new Date().toISOString(),
                      isRead: false
                  };
                  await dbService.addNotification(created);
              }
          });
          if (count > 0) {
              await refreshNotifications();
          }
          return count;
      } catch (err) {
          console.warn('Akıllı bildirim taraması uyarısı:', err);
          return 0;
      } finally {
          smartScanRunningRef.current = false;
      }
  }, [userProfile, farmers, suppliers, prescriptions, payments, myPayments, reminders, collectionLogs]);

  const checkWeatherAlerts = async () => {
    await checkWeatherAlertsForProfile(userProfile, addSystemNotification);
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
    const id = await dbService.nextDocumentCounter('REC');
    const accountsList = await dbService.getAccounts();
    const defaultAcc = accountsList.find(a => a.type === 'CASH') || accountsList[0];
    const targetAccId = pData.accountId || defaultAcc?.id;
    const shouldProcess = pData.isProcessed !== false;

    const prescription: Prescription = { 
        ...pData, 
        id, 
        prescriptionNo: id,
        createdById: activeTeamMember?.id,
        isProcessed: shouldProcess,
        isInventoryProcessed: false,
        accountId: pData.priceType === 'CASH' ? targetAccId : undefined
    };
    await dbService.addPrescription(prescription);
    if (shouldProcess) {
        await dbService.processInventory(prescription);
    }

    if (prescription.priceType === 'CASH' && targetAccId && shouldProcess) {
        const allTxs = await dbService.getTransactions();
        const existingTx = allTxs.find(t => t.relatedId === id && !t.deletedAt);
        if (!existingTx) {
            const farmer = farmers.find(f => f.id === prescription.farmerId);
            await dbService.addTransaction({
                id: generateUUID(),
                accountId: targetAccId,
                type: prescription.type === 'RETURN' ? 'EXPENSE' : 'INCOME',
                amount: round2(Math.abs(prescription.totalAmount || 0)),
                date: prescription.date,
                description: prescription.type === 'RETURN' ? 'Peşin İade Kasadan Çıkış' : 'Peşin Satış Tahsilatı',
                category: 'Satış/İade',
                relatedId: id,
                partyName: farmer?.fullName,
                partyType: 'FARMER',
                partyId: prescription.farmerId
            });
        }
    }

    await refreshPrescriptions();
    await refreshInventory();
    await refreshStats();
    return id;
  };

  const refreshPrescriptions = async () => {
    const allItems = await dbService.getAllPrescriptionsRaw();
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
        const all = await dbService.getAllPrescriptionsRaw();
        p = all.find(item => item.id === id && !item.deletedAt);
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
    const latest = await dbService.getAllPrescriptionsRaw();
    const finalUpdated = latest.find(item => item.id === id) || updated;

    await refreshPrescriptions();
    await refreshInventory();
    await refreshStats();

    return finalUpdated;
  };

  const refreshSeqRef = useRef(0);

  const refreshStats = useCallback(async (syncedReminders?: Reminder[]) => {
    const seq = ++refreshSeqRef.current;
    const snap = await computeFullAppSnapshot(syncedReminders);
    if (seq !== refreshSeqRef.current) return;
    setTrashedFarmers(snap.trashedFarmers);
    setTrashedVisits(snap.trashedVisits);
    setTrashedPayments(snap.trashedPayments);
    setTrashedSuppliers(snap.trashedSuppliers);
    setTrashedManualDebts(snap.trashedManualDebts);
    setTrashedExpenses(snap.trashedExpenses);
    setTrashedSupplierPurchases(snap.trashedSupplierPurchases);
    setTrashedSupplierPayments(snap.trashedSupplierPayments);
    setTrashedMyPayments(snap.trashedMyPayments);
    setVisits(snap.visits);
    setReminders(snap.reminders);
    setFarmers(snap.farmers);
    setInventory(snap.inventory);
    setPrescriptions(snap.prescriptions);
    setTrashedPrescriptions(snap.trashedPrescriptions);
    setSupplierPurchases(snap.supplierPurchases);
    setPayments(snap.payments);
    setManualDebts(snap.manualDebts);
    setExpenses(snap.expenses);
    setSuppliers(snap.suppliers);
    setMyPayments(snap.myPayments);
    setTeamMembers(snap.teamMembers);
    setMessages(snap.messages);
    setCollectionLogs(snap.collectionLogs);
    setAccounts(snap.accounts);
    setTransactions(snap.transactions);
    setStats(snap.stats);
    await refreshNotifications();
  }, []);

  const addFarmer = async (farmerData: Omit<Farmer, 'id'>) => {
    const newFarmer: Farmer = { ...farmerData, id: generateUUID(), createdById: activeTeamMember?.id };
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
    const myPays = await dbService.getMyPayments();
    for (const p of farmerPayments) {
        const relatedTx = allTransactions.find(tx => tx.relatedId === p.id);
        if (relatedTx) {
            await dbService.deleteTransaction(relatedTx.id);
        }
        
        const relatedMyPays = myPays.filter(mp => mp.relatedId === p.id);
        for (const mp of relatedMyPays) {
            await dbService.deleteMyPayment(mp.id);
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
    const promises = farmersData.map(data => dbService.addFarmer({ ...data, id: generateUUID() }));
    await Promise.all(promises);
    await refreshStats();
  };

  const addReminder = async (reminderData: Omit<Reminder, 'id'>) => {
      const newReminder: Reminder = { ...reminderData, id: generateUUID() };
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
                  id: generateUUID(), // Yeni ID
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
    const id = generateUUID();
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
    const allPrescriptions = await dbService.getAllPrescriptionsRaw();
    const target = allPrescriptions.find(p => p.id === id && !p.deletedAt);
    if (target) {
      const wasActiveProcessed = target.isProcessed !== false;

      // Revert transaction if it was CASH
      const allTransactions = await dbService.getTransactions();
      const relatedTxs = allTransactions.filter(tx => tx.relatedId === id && !tx.deletedAt);
      for (const relatedTx of relatedTxs) {
        await dbService.deleteTransaction(relatedTx.id);
      }

      if (target.isInventoryProcessed) {
        await dbService.revertInventory(target);
      }

      // D-07: Re-read fresh record after revertInventory so reverted flags are never overwritten with stale target,
      // while preserving whether the prescription was active (`isProcessed`) prior to soft-deletion.
      const postRevertList = await dbService.getAllPrescriptionsRaw();
      const freshTarget = postRevertList.find(p => p.id === id) || target;
      await dbService.updatePrescription({
        ...freshTarget,
        isProcessed: wasActiveProcessed,
        isInventoryProcessed: false,
        deletedAt: new Date().toISOString()
      });
      await refreshPrescriptions();
      await refreshInventory();
      await refreshStats();
    }
  };

  const restorePrescription = async (id: string) => {
    const allPrescriptions = await dbService.getAllPrescriptionsRaw();
    const target = allPrescriptions.find(p => p.id === id && !!p.deletedAt);
    if (target) {
      const shouldProcess = target.isProcessed !== false;

      const restored: Prescription = {
        ...target,
        isProcessed: shouldProcess,
        isInventoryProcessed: false,
        deletedAt: undefined
      };
      await dbService.updatePrescription(restored);

      // D-07: Only process inventory & recreate CASH transaction if prescription was active before deletion
      if (shouldProcess) {
        await dbService.processInventory(restored);
        if (target.priceType === 'CASH') {
          const allTxs = await dbService.getTransactions();
          const existingTx = allTxs.find(tx => tx.relatedId === target.id && !tx.deletedAt);
          if (!existingTx) {
            const accountList = await dbService.getAccounts();
            const targetAccount = target.accountId
              ? accountList.find(a => a.id === target.accountId)
              : accountList.find(a => a.type === 'CASH') || accountList[0];
            if (targetAccount) {
              const farmer = farmers.find(f => f.id === target.farmerId);
              await dbService.addTransaction({
                id: generateUUID(),
                accountId: targetAccount.id,
                type: target.type === 'RETURN' ? 'EXPENSE' : 'INCOME',
                amount: round2(Math.abs(target.totalAmount || 0)),
                date: target.date,
                description: target.type === 'RETURN' ? 'Peşin İade Kasadan Çıkış (Geri Yüklenen)' : 'Peşin Satış Tahsilatı (Geri Yüklenen)',
                category: 'Satış/İade',
                relatedId: target.id,
                partyName: farmer?.fullName,
                partyType: 'FARMER',
                partyId: target.farmerId
              });
            }
          }
        }
      }

      await refreshPrescriptions();
      await refreshInventory();
      await refreshStats();
    }
  };

  const permanentlyDeletePrescription = async (id: string) => {
    const allPrescriptions = await dbService.getAllPrescriptionsRaw();
    const target = allPrescriptions.find(p => p.id === id);
    if (target && !target.deletedAt && target.isInventoryProcessed) {
      await dbService.revertInventory(target);
    }
    const allTransactions = await dbService.getTransactions();
    for (const tx of allTransactions.filter(t => t.relatedId === id && !t.deletedAt)) {
      await dbService.deleteTransaction(tx.id);
    }
    await dbService.deletePrescription(id);
    await refreshPrescriptions();
    await refreshInventory();
    await refreshStats();
  };

  const addNews = async (newsData: Omit<News, 'id'>) => {
    const newNews: News = { ...newsData, id: generateUUID() };
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

  const buildFarmerPaymentEffects = async (rawPayment: Payment): Promise<{
    payment: Payment;
    desiredTransaction: Transaction | null;
    desiredMyPayment: MyPayment | null;
  }> => {
    const cleanAmount = round2(rawPayment.amount);
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      throw new Error("Geçerli bir ödeme tutarı giriniz (0'dan büyük olmalıdır).");
    }

    let farmer = farmers.find(f => f.id === rawPayment.farmerId);
    if (!farmer) {
      const dbFarmers = await dbService.getFarmers();
      farmer = dbFarmers.find(f => f.id === rawPayment.farmerId);
    }
    const farmerName = farmer?.fullName || 'Bilinmeyen Çiftçi';

    const [allTxs, allMyPays] = await Promise.all([
      dbService.getTransactions(),
      dbService.getMyPayments()
    ]);
    const existingTx = allTxs.find(tx => !tx.deletedAt && tx.relatedId === rawPayment.id);
    const existingMyPay = allMyPays.find(mp => !mp.deletedAt && mp.relatedId === rawPayment.id);

    let normalizedPayment: Payment = {
      ...rawPayment,
      amount: cleanAmount,
      deletedAt: undefined
    };
    let desiredTransaction: Transaction | null = null;
    let desiredMyPayment: MyPayment | null = null;

    if (normalizedPayment.method === 'CARD') {
      const rawCardOpt = String(normalizedPayment.cardOption || '');
      const isImmediatePos =
        !normalizedPayment.cardOption ||
        normalizedPayment.cardOption === 'UNBLOCKED' ||
        rawCardOpt === 'SAME_DAY' ||
        rawCardOpt === 'NEXT_DAY';

      if (isImmediatePos) {
        const commRate =
          normalizedPayment.commissionRate !== undefined
            ? round2(Math.max(0, Number(normalizedPayment.commissionRate) || 0))
            : 4;
        const commAmount = round2((cleanAmount * commRate) / 100);
        const netAmt = round2(Math.max(0, cleanAmount - commAmount));

        let txDate = normalizedPayment.date;
        if (rawCardOpt === 'NEXT_DAY' && normalizedPayment.date) {
          const nextD = new Date(normalizedPayment.date);
          if (!Number.isNaN(nextD.getTime())) {
            nextD.setDate(nextD.getDate() + 1);
            txDate = nextD.toISOString();
          }
        }

        normalizedPayment = {
          ...normalizedPayment,
          cardOption: 'UNBLOCKED',
          commissionRate: commRate,
          commissionAmount: commAmount,
          netAmount: netAmt,
          unblockDate: undefined,
          isUnblocked: true
        };

        if (normalizedPayment.accountId) {
          desiredTransaction = {
            id: existingTx?.id || generateUUID(),
            accountId: normalizedPayment.accountId,
            type: 'INCOME',
            amount: netAmt,
            date: txDate,
            description: `${farmerName} Kredi Kartı Tahsilatı (Net: ${netAmt.toLocaleString('tr-TR')} TL, %${commRate} POS Komisyonu: ${commAmount.toLocaleString('tr-TR')} TL)`,
            relatedId: normalizedPayment.id,
            category: 'Çiftçi Ödemesi',
            partyName: farmerName,
            partyType: 'FARMER',
            partyId: normalizedPayment.farmerId
          };
        }
      } else {
        // Bloke günlü kart (15, 30, 45 Gün) — D-05: Hesaba/Kasaya ANINDA geçmez; sadece DEFERRED_CARD oluşur!
        const days =
          normalizedPayment.cardOption === 'DAYS_15'
            ? 15
            : normalizedPayment.cardOption === 'DAYS_30'
              ? 30
              : 45;
        const d = new Date(normalizedPayment.date || Date.now());
        d.setDate(d.getDate() + days);
        const unblockDateStr = d.toISOString().split('T')[0];
        const commRate = round2(Math.max(0, Number(normalizedPayment.commissionRate) || 0));
        const commAmount = round2((cleanAmount * commRate) / 100);
        const netAmt = round2(Math.max(0, cleanAmount - commAmount));
        const alreadyUnblocked = existingMyPay?.status === 'PAID';

        normalizedPayment = {
          ...normalizedPayment,
          unblockDate: unblockDateStr,
          isUnblocked: alreadyUnblocked,
          commissionRate: commRate,
          commissionAmount: commAmount,
          netAmount: netAmt
        };

        const dateFormatted = new Date(unblockDateStr).toLocaleDateString('tr-TR');
        desiredMyPayment = {
          id: existingMyPay?.id || generateUUID(),
          farmerId: normalizedPayment.farmerId,
          farmerName,
          amount: netAmt,
          issueDate: normalizedPayment.date,
          dueDate: unblockDateStr,
          type: 'DEFERRED_CARD',
          status: alreadyUnblocked ? 'PAID' : 'PENDING',
          cardOption: normalizedPayment.cardOption,
          unblockDate: unblockDateStr,
          commissionRate: commRate,
          commissionAmount: commAmount,
          note: `Kredi Kartı (${days} Gün Bloke) - Bloke Kalkış: ${dateFormatted}${normalizedPayment.note ? ' - ' + normalizedPayment.note : ''}`,
          accountId: normalizedPayment.accountId,
          relatedId: normalizedPayment.id,
          createdById: normalizedPayment.createdById
        };

        // Eğer bloke kart daha önce çözülüp Kasa'ya geçtiyse, bloke çözüm kaydına bağlı işlemi de yeni net tutara eşitle
        if (alreadyUnblocked && existingMyPay) {
          const unblockTx = allTxs.find(tx => !tx.deletedAt && tx.relatedId === existingMyPay.id);
          if (unblockTx && normalizedPayment.accountId) {
            await dbService.updateTransaction({
              ...unblockTx,
              accountId: normalizedPayment.accountId,
              amount: netAmt,
              partyName: farmerName,
              partyType: 'FARMER',
              partyId: normalizedPayment.farmerId
            });
          }
        }
      }
    } else if (
      normalizedPayment.method === 'CHECK' ||
      normalizedPayment.method === 'TEDYE' ||
      String(normalizedPayment.method) === 'PROMISSORY' ||
      String(normalizedPayment.method) === 'PROMISSORY_NOTE'
    ) {
      normalizedPayment = {
        ...normalizedPayment,
        cardOption: undefined,
        unblockDate: undefined,
        isUnblocked: undefined,
        commissionRate: undefined,
        commissionAmount: undefined,
        netAmount: undefined
      };
      const mpType: MyPayment['type'] =
        normalizedPayment.method === 'CHECK'
          ? 'CHECK'
          : normalizedPayment.method === 'TEDYE'
            ? 'TEDYE'
            : 'PROMISSORY_NOTE';
      desiredMyPayment = {
        id: existingMyPay?.id || generateUUID(),
        farmerId: normalizedPayment.farmerId,
        farmerName,
        amount: cleanAmount,
        issueDate: normalizedPayment.date,
        dueDate: normalizedPayment.dueDate || normalizedPayment.date,
        type: mpType,
        status: existingMyPay?.status || 'PENDING',
        portfolioStatus: mpType === 'TEDYE' ? undefined : (existingMyPay?.portfolioStatus || 'PORTFOLIO'),
        note: normalizedPayment.note,
        accountId: normalizedPayment.accountId,
        relatedId: normalizedPayment.id,
        createdById: normalizedPayment.createdById
      };
    } else {
      normalizedPayment = {
        ...normalizedPayment,
        cardOption: undefined,
        unblockDate: undefined,
        isUnblocked: undefined,
        commissionRate: undefined,
        commissionAmount: undefined,
        netAmount: undefined
      };
      if (normalizedPayment.accountId) {
        desiredTransaction = {
          id: existingTx?.id || generateUUID(),
          accountId: normalizedPayment.accountId,
          type: 'INCOME',
          amount: cleanAmount,
          date: normalizedPayment.date,
          description: `${farmerName} ödemesi`,
          relatedId: normalizedPayment.id,
          category: 'Çiftçi Ödemesi',
          partyName: farmerName,
          partyType: 'FARMER',
          partyId: normalizedPayment.farmerId
        };
      }
    }

    return { payment: normalizedPayment, desiredTransaction, desiredMyPayment };
  };

  const addPayment = async (paymentData: Omit<Payment, 'id'> & { id?: string }): Promise<string> => {
    const paymentId = paymentData.id || generateUUID();
    const draftPayment: Payment = {
      ...paymentData,
      id: paymentId,
      createdById: activeTeamMember?.id
    };
    const effects = await buildFarmerPaymentEffects(draftPayment);
    await dbService.savePaymentWithEffects(effects);
    await refreshStats();
    return paymentId;
  };

  const updatePayment = async (payment: Payment) => {
    const effects = await buildFarmerPaymentEffects(payment);
    await dbService.savePaymentWithEffects(effects);
    await refreshStats();
  };

  const deletePayment = async (id: string) => {
    await dbService.deletePaymentWithEffects(id);
    await refreshStats();
  };

  const softDeletePayment = async (id: string) => {
    await dbService.deletePaymentWithEffects(id);
    await refreshStats();
  };

  const restorePayment = async (id: string) => {
    const payment = trashedPayments.find(p => p.id === id);
    if (payment) {
      const restoredPayment: Payment = { ...payment, deletedAt: undefined };
      await updatePayment(restoredPayment);
    }
  };

  const permanentlyDeletePayment = async (id: string) => {
    await deletePayment(id);
  };

  const addManualDebt = async (debt: Omit<ManualDebt, 'id'>) => {
    const id = generateUUID();
    await dbService.addManualDebt({ ...debt, amount: round2(debt.amount), id, createdById: activeTeamMember?.id });
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

  const addSupplier = async (supplierData: Omit<Supplier, 'id' | 'totalDebt' | 'balance'>): Promise<string> => {
    const newSupplier: Supplier = { 
        ...supplierData, 
        id: generateUUID(),
        totalDebt: 0,
        balance: 0
    };
    await dbService.addSupplier(newSupplier);
    await refreshStats();
    return newSupplier.id;
  };

  const updateSupplier = async (supplier: Supplier) => {
    await dbService.updateSupplier(supplier);
    await refreshStats();
  };

  const deleteSupplier = async (id: string) => {
    // 1. Delete all associated purchases and revert inventory
    const purchases = await dbService.getSupplierPurchases(id);
    for (const p of purchases) {
        // Only revert inventory if the purchase was processed and not already soft-deleted
        if (!p.deletedAt && p.isInventoryProcessed !== false) {
            await dbService.updateInventoryFromPurchase(p, true);
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
    const purchaseId = generateUUID();
    const clonedItems = (purchaseData.items || []).map(item => ({ ...item }));
    const purchase: SupplierPurchase = {
      ...purchaseData,
      id: purchaseId,
      items: clonedItems,
      createdById: activeTeamMember?.id
    };

    // 1. Handle new pesticides and update their IDs on cloned items (never mutating caller state)
    for (let i = 0; i < purchase.items.length; i++) {
      const item = purchase.items[i];
      if (String(item.pesticideId).startsWith('new-')) {
        const finalPesticideId = generateUUID();
        purchase.items[i] = { ...item, pesticideId: finalPesticideId };

        await dbService.addGlobalPesticide({
          id: finalPesticideId,
          name: item.pesticideName,
          activeIngredient: 'Belirtilmedi',
          defaultDosage: '',
          category: PesticideCategory.OTHER,
          description: 'Tedarikçi alımı ile otomatik eklendi.',
          barcode: item.gtin || item.barcode
        });

        await dbService.addInventoryItem({
          id: generateUUID(),
          pesticideId: finalPesticideId,
          pesticideName: item.pesticideName,
          category: PesticideCategory.OTHER,
          quantity: 0,
          unit: item.unit,
          buyingPrice: round2(Number(item.buyingPrice) || 0),
          sellingPrice: round2((Number(item.buyingPrice) || 0) * 1.2),
          gtin: item.gtin,
          barcode: item.gtin || item.barcode,
          lastUpdated: new Date().toISOString()
        });
      }
    }

    purchase.totalAmount = round2(
      purchase.items.reduce(
        (acc, item) => acc + (Number(item.buyingPrice) || 0) * (Number(item.quantity) || 0),
        0
      )
    );

    // 2. AK-19: Save purchase + update inventory atomically in one IDB transaction
    await dbService.saveSupplierPurchaseWithInventory(purchase, null);

    await refreshInventory();
    await refreshStats();
  };

  const updateSupplierPurchase = async (purchaseInput: SupplierPurchase) => {
    try {
      const oldPurchase = await dbService.getSupplierPurchaseById(purchaseInput.id);
      const clonedItems = (purchaseInput.items || []).map(item => ({ ...item }));

      for (let i = 0; i < clonedItems.length; i++) {
        const item = clonedItems[i];
        if (String(item.pesticideId).startsWith('new-')) {
          const finalPesticideId = generateUUID();
          clonedItems[i] = { ...item, pesticideId: finalPesticideId };

          await dbService.addGlobalPesticide({
            id: finalPesticideId,
            name: item.pesticideName,
            activeIngredient: 'Belirtilmedi',
            defaultDosage: '',
            category: PesticideCategory.OTHER,
            description: 'Tedarikçi alımı ile otomatik eklendi.',
            barcode: item.gtin || item.barcode
          });

          await dbService.addInventoryItem({
            id: generateUUID(),
            pesticideId: finalPesticideId,
            pesticideName: item.pesticideName,
            category: PesticideCategory.OTHER,
            quantity: 0,
            unit: item.unit,
            buyingPrice: round2(Number(item.buyingPrice) || 0),
            sellingPrice: round2((Number(item.buyingPrice) || 0) * 1.2),
            gtin: item.gtin,
            barcode: item.gtin || item.barcode,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      const updatedPurchase: SupplierPurchase = {
        ...purchaseInput,
        items: clonedItems,
        totalAmount: round2(
          clonedItems.reduce(
            (acc, item) => acc + (Number(item.buyingPrice) || 0) * (Number(item.quantity) || 0),
            0
          )
        )
      };

      // AK-19: Revert old inventory (if processed) + apply new inventory + save purchase in one IDB transaction
      await dbService.saveSupplierPurchaseWithInventory(updatedPurchase, oldPurchase);

      await refreshInventory();
      await refreshStats();
    } catch (error) {
      console.error('Error in updateSupplierPurchase:', error);
      throw error;
    }
  };

  const softDeleteSupplierPurchase = async (id: string) => {
    await dbService.softDeleteSupplierPurchaseWithInventory(id);
    await refreshInventory();
    await refreshStats();
  };

  const restoreSupplierPurchase = async (id: string) => {
    const purchase = trashedSupplierPurchases.find(p => p.id === id);
    if (purchase) {
      const restored: SupplierPurchase = { ...purchase, isInventoryProcessed: false, deletedAt: undefined };
      await dbService.saveSupplierPurchaseWithInventory(restored, null);
      await refreshInventory();
      await refreshStats();
    }
  };

  const permanentlyDeleteSupplierPurchase = async (id: string) => {
    const target = await dbService.getSupplierPurchaseById(id);
    if (target && !target.deletedAt && target.isInventoryProcessed !== false) {
      await dbService.updateInventoryFromPurchase(target, true);
    }
    await dbService.deleteSupplierPurchase(id);
    await refreshInventory();
    await refreshStats();
  };

  const deleteSupplierPurchase = async (id: string) => {
    await softDeleteSupplierPurchase(id);
  };

  const addSupplierPayment = async (paymentData: Omit<SupplierPayment, 'id'>) => {
    const paymentId = generateUUID();
    const payment: SupplierPayment = { ...paymentData, amount: round2(paymentData.amount), id: paymentId, createdById: activeTeamMember?.id };
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
            const installmentAmount = round2(payment.amount / payment.installments);
            for (let i = 0; i < payment.installments; i++) {
                const dueDate = new Date(payment.date);
                dueDate.setMonth(dueDate.getMonth() + i + 1);
                const sliceAmt =
                  i === payment.installments - 1
                    ? round2(payment.amount - installmentAmount * (payment.installments - 1))
                    : installmentAmount;
                
                await addMyPayment({
                    supplierId: payment.supplierId,
                    supplierName,
                    amount: sliceAmt,
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
                id: generateUUID(),
                accountId: payment.accountId,
                type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
                amount: payment.amount,
                date: payment.date,
                description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı (Kart)` : `${supplierName} ödemesi (Kart)`,
                relatedId: paymentId,
                category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi',
                partyName: supplierName,
                partyType: 'SUPPLIER',
                partyId: payment.supplierId
            });
        }
    } else if (payment.accountId) {
        await dbService.addTransaction({
            id: generateUUID(),
            accountId: payment.accountId,
            type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
            amount: payment.amount,
            date: payment.date,
            description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı` : `${supplierName} ödemesi`,
            relatedId: paymentId,
            category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi',
            partyName: supplierName,
            partyType: 'SUPPLIER',
            partyId: payment.supplierId
        });
    }
    
    await refreshStats();
  };

  const updateSupplierPayment = async (paymentInput: SupplierPayment) => {
    const payment: SupplierPayment = { ...paymentInput, amount: round2(paymentInput.amount) };
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
            const installmentAmount = round2(payment.amount / payment.installments);
            for (let i = 0; i < payment.installments; i++) {
                const dueDate = new Date(payment.date);
                dueDate.setMonth(dueDate.getMonth() + i + 1);
                const sliceAmt =
                  i === payment.installments - 1
                    ? round2(payment.amount - installmentAmount * (payment.installments - 1))
                    : installmentAmount;
                
                await addMyPayment({
                    supplierId: payment.supplierId,
                    supplierName,
                    amount: sliceAmt,
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
                id: generateUUID(),
                accountId: payment.accountId,
                type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
                amount: payment.amount,
                date: payment.date,
                description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı (Kart)` : `${supplierName} ödemesi (Kart)`,
                relatedId: payment.id,
                category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi',
                partyName: supplierName,
                partyType: 'SUPPLIER',
                partyId: payment.supplierId
            });
        }
    } else if (payment.accountId) {
        await dbService.addTransaction({
            id: generateUUID(),
            accountId: payment.accountId,
            type: payment.type === 'RECEIVE' ? 'INCOME' : 'EXPENSE',
            amount: payment.amount,
            date: payment.date,
            description: payment.type === 'RECEIVE' ? `${supplierName} tahsilatı` : `${supplierName} ödemesi`,
            relatedId: payment.id,
            category: payment.type === 'RECEIVE' ? 'Tedarikçi Tahsilatı' : 'Tedarikçi Ödemesi',
            partyName: supplierName,
            partyType: 'SUPPLIER',
            partyId: payment.supplierId
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
        // İlgili işlemleri (işlemler ve myPayments) tamamen silerek bakiyeyi geri al
        const transactions = await dbService.getTransactions();
        const relatedTx = transactions.filter(t => t.relatedId === id);
        for (const tx of relatedTx) {
            await dbService.deleteTransaction(tx.id);
        }

        const myPays = await dbService.getMyPayments();
        const relatedMyPays = myPays.filter(p => p.relatedId === id);
        for (const p of relatedMyPays) {
            await dbService.deleteMyPayment(p.id);
        }

        await dbService.updateSupplierPayment({ ...targetPayment, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreSupplierPayment = async (id: string) => {
    const payment = trashedSupplierPayments.find(p => p.id === id);
    if (payment) {
        // İşlemleri yeniden oluşturmak için updateSupplierPayment fonksiyonunu kullanıyoruz
        const restoredPayment = { ...payment, deletedAt: undefined as any };
        await updateSupplierPayment(restoredPayment);
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
    const payment: MyPayment = { ...paymentData, amount: round2(paymentData.amount), id: generateUUID(), createdById: activeTeamMember?.id };
    await dbService.addMyPayment(payment);
    await refreshStats();
  };

  const updateMyPayment = async (paymentInput: MyPayment) => {
    const payment: MyPayment = { ...paymentInput, amount: round2(paymentInput.amount) };
    const allMyPayments = await dbService.getMyPayments();
    const oldPayment = allMyPayments.find(p => p.id === payment.id);
    await dbService.updateMyPayment(payment);
    
    // If status changed to PAID and accountId is present, create transaction
    if (payment.status === 'PAID' && oldPayment?.status !== 'PAID' && payment.accountId) {
      const isIncome = !!payment.farmerId || !!payment.farmerName;
      const typeLabel =
        payment.type === 'CHECK' ? 'Çek' :
        payment.type === 'TEDYE' ? 'Tedye' :
        payment.type === 'DEFERRED_CARD' ? 'POS Bloke Çözümü' :
        payment.type === 'CARD_INSTALLMENT' ? 'Kart Taksidi' : 'Senet';
      const name = payment.farmerName || payment.supplierName || 'Bilinmeyen';
      
      const allTransactions = await dbService.getTransactions();
      const existingTx = allTransactions.find(tx => tx.relatedId === payment.id && !tx.deletedAt);
      if (!existingTx) {
        await dbService.addTransaction({
          id: generateUUID(),
          accountId: payment.accountId,
          type: isIncome ? 'INCOME' : 'EXPENSE',
          amount: payment.amount,
          date: new Date().toISOString(),
          description: `${name} - ${typeLabel} ${isIncome ? 'Tahsilatı' : 'Ödemesi'}`,
          relatedId: payment.id,
          category: payment.type === 'DEFERRED_CARD' ? 'POS Bloke Çözümü' : (isIncome ? 'Çek/Senet Tahsilatı' : 'Çek/Senet Ödemesi'),
          partyName: name,
          partyType: isIncome ? 'FARMER' : 'SUPPLIER',
          partyId: payment.farmerId || payment.supplierId
        });
      }
    } else if (payment.status !== 'PAID' && oldPayment?.status === 'PAID') {
      // If status changed from PAID to something else, delete the transaction
      const allTransactions = await dbService.getTransactions();
      const relatedTx = allTransactions.find(tx => tx.relatedId === payment.id && !tx.deletedAt);
      if (relatedTx) {
        await dbService.deleteTransaction(relatedTx.id);
      }
    }

    if (payment.type === 'DEFERRED_CARD' && payment.relatedId) {
      const linkedPayment = payments.find(p => p.id === payment.relatedId);
      if (linkedPayment) {
        await dbService.updatePayment({
          ...linkedPayment,
          isUnblocked: payment.status === 'PAID'
        });
      }
    }
    
    await refreshStats();
  };

  const softDeleteMyPayment = async (id: string) => {
    const allMyPayments = await dbService.getMyPayments();
    const payment = allMyPayments.find(p => p.id === id);
    if (payment) {
      const allTransactions = await dbService.getTransactions();
      const relatedTx = allTransactions.find(tx => tx.relatedId === id);
      if (relatedTx) {
          await dbService.deleteTransaction(relatedTx.id);
      }
      await dbService.updateMyPayment({ ...payment, deletedAt: new Date().toISOString() });
      await refreshStats();
    }
  };

  const restoreMyPayment = async (id: string) => {
    const payment = trashedMyPayments.find(p => p.id === id);
    if (payment) {
      const restoredPayment = { ...payment, deletedAt: undefined as any };
      await updateMyPayment(restoredPayment);
    }
  };

  const permanentlyDeleteMyPayment = async (id: string) => {
    const allTransactions = await dbService.getTransactions();
    const relatedTx = allTransactions.find(tx => tx.relatedId === id);
    if (relatedTx) {
      await dbService.deleteTransaction(relatedTx.id);
    }
    await dbService.deleteMyPayment(id);
    await refreshStats();
  };

  const deleteMyPayment = async (id: string) => {
    await softDeleteMyPayment(id);
  };

  const addExpense = async (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = { ...expenseData, amount: round2(expenseData.amount), id: generateUUID(), createdById: activeTeamMember?.id };
    await dbService.addExpense(newExpense);
    
    if (newExpense.accountId) {
      await dbService.addTransaction({
        id: generateUUID(),
        accountId: newExpense.accountId,
        type: 'EXPENSE',
        amount: newExpense.amount,
        date: newExpense.date,
        description: newExpense.title,
        relatedId: newExpense.id,
        category: 'Gider',
        partyName: newExpense.title,
        partyType: 'EXPENSE',
        partyId: newExpense.id
      });
    }
    
    await refreshStats();
  };

  const updateExpense = async (expenseInput: Expense) => {
    const expense: Expense = { ...expenseInput, amount: round2(expenseInput.amount) };
    await dbService.updateExpense(expense);
    
    // Handle transaction update
    const allTransactions = await dbService.getTransactions();
    const relatedTx = allTransactions.find(tx => tx.relatedId === expense.id && !tx.deletedAt);
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
        id: generateUUID(),
        accountId: expense.accountId,
        type: 'EXPENSE',
        amount: expense.amount,
        date: expense.date,
        description: expense.title,
        relatedId: expense.id,
        category: 'Gider',
        partyName: expense.title,
        partyType: 'EXPENSE',
        partyId: expense.id
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
        const allTransactions = await dbService.getTransactions();
        const relatedTx = allTransactions.find(tx => tx.relatedId === id);
        if (relatedTx) {
          await dbService.deleteTransaction(relatedTx.id);
        }
        await dbService.updateExpense({ ...expense, deletedAt: new Date().toISOString() });
        await refreshStats();
    }
  };

  const restoreExpense = async (id: string) => {
    const expense = trashedExpenses.find(e => e.id === id);
    if (expense) {
        const restoredExpense = { ...expense, deletedAt: undefined as any };
        await updateExpense(restoredExpense);
    }
  };

  const permanentlyDeleteExpense = async (id: string) => {
    await deleteExpense(id);
  };

  const addAccount = async (accountData: Omit<Account, 'id' | 'balance'>) => {
    const newAccount: Account = { ...accountData, id: generateUUID(), balance: 0 };
    await dbService.addAccount(newAccount);
    await refreshStats();
  };

  const updateAccount = async (account: Account) => {
    await dbService.updateAccount({ ...account, balance: round2(account.balance) });
    await refreshStats();
  };

  const deleteAccount = async (id: string) => {
    const currentAccounts = await dbService.getAccounts();
    const targetAcc = currentAccounts.find(a => a.id === id);
    if (targetAcc && Math.abs(round2(Number(targetAcc.balance) || 0)) >= 0.01) {
      showToast('Bakiyesi sıfır olmayan hesap silinemez. Önce Virman ile bakiyeyi başka bir hesaba aktarın.', 'error');
      throw new Error('NON_ZERO_ACCOUNT_BALANCE');
    }
    // AK-23: Never wipe historical transactions when archiving/deleting an account; preserve audit trail!
    await dbService.deleteAccount(id);
    await refreshStats();
  };

  const transferBetweenAccounts = async (params: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    description?: string;
    id?: string;
  }) => {
    await dbService.transferBetweenAccounts(params);
    await refreshStats();
  };

  const addTransaction = async (txData: Omit<Transaction, 'id'> & { id?: string }) => {
    const newTx: Transaction = { ...txData, amount: round2(txData.amount), id: txData.id || generateUUID() };
    await dbService.addTransaction(newTx);
    await refreshStats();
  };

  const deleteTransaction = async (id: string) => {
    await dbService.deleteTransaction(id);
    await refreshStats();
  };

  const addCollectionLog = async (logData: Omit<CollectionLog, 'id'>) => {
    const id = generateUUID();
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
      id: generateUUID(),
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
      id: generateUUID(),
      senderId: activeTeamMember?.id || 'admin-bypass',
      senderName: activeTeamMember?.fullName || userProfile.fullName || 'Yönetici',
      text,
      timestamp: new Date().toISOString()
    });
    await refreshStats();
  };

  const performManualTurnover = async (): Promise<{ success: boolean; year: number }> => {
    try {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      // D-06: Read fresh truth directly from IndexedDB and align 100% with computeFarmerLedgerTotals
      const [allFarmers, allPresc, allDebts, allPays, allMyPays, allInv, logs] = await Promise.all([
        dbService.getFarmers(),
        dbService.getAllPrescriptionsRaw(),
        dbService.getManualDebts(),
        dbService.getPayments(),
        dbService.getMyPayments(),
        dbService.getInventory(),
        dbService.getTurnoverLogs()
      ]);

      const alreadyHadLog = logs.some(l => l.year === currentYear && l.type === 'FINANCIAL');

      const prevPresc = allPresc.filter(p => {
        if (p.deletedAt) return false;
        const yr = new Date(p.date).getFullYear();
        return !Number.isNaN(yr) && yr <= lastYear;
      });
      const prevDebts = allDebts.filter(d => {
        if (d.deletedAt) return false;
        const yr = new Date(d.date).getFullYear();
        return !Number.isNaN(yr) && yr <= lastYear;
      });
      const prevPays = allPays.filter(p => {
        if (p.deletedAt) return false;
        const yr = new Date(p.date).getFullYear();
        return !Number.isNaN(yr) && yr <= lastYear;
      });
      const prevMyPays = allMyPays.filter(mp => {
        if (mp.deletedAt) return false;
        if (mp.relatedId) return true; // Keep bounced/cancelled link truth for getBouncedRelatedPaymentIds
        const yr = new Date(mp.issueDate).getFullYear();
        return !Number.isNaN(yr) && yr <= lastYear;
      });

      const farmerIdSet = new Set<string>();
      allFarmers.forEach(f => { if (!f.deletedAt) farmerIdSet.add(f.id); });
      prevPresc.forEach(p => { if (p.farmerId) farmerIdSet.add(p.farmerId); });
      prevDebts.forEach(d => { if (d.farmerId) farmerIdSet.add(d.farmerId); });
      prevPays.forEach(p => { if (p.farmerId) farmerIdSet.add(p.farmerId); });
      prevMyPays.forEach(mp => { if (mp.farmerId) farmerIdSet.add(mp.farmerId); });

      const farmerBalances: Record<string, number> = {};
      for (const farmerId of farmerIdSet) {
        const totals = computeFarmerLedgerTotals({
          farmerId,
          prescriptions: prevPresc,
          manualDebts: prevDebts,
          payments: prevPays,
          myPayments: prevMyPays
        });
        if (Math.abs(totals.netDebt) >= 0.01) {
          farmerBalances[farmerId] = totals.netDebt;
        }
      }

      await dbService.performFinancialTurnover(currentYear, farmerBalances);
      await dbService.performInventoryTurnover(currentYear, allInv);

      await addSystemNotification(
        'SUCCESS',
        `${currentYear} Yılı Devri`,
        alreadyHadLog
          ? `${currentYear} yılı devir bakiyeleri önceki yıl kayıtlarıyla yeniden doğrulandı ve eşitlendi.`
          : `${currentYear} yılı için tüm cari ve stok devir işlemleri sıfır veri kaybıyla tamamlandı.`
      );
      showToast(
        alreadyHadLog
          ? `${currentYear} yılı devir bakiyeleri yeniden doğrulandı ve güncellendi.`
          : `${currentYear} yılı devri kusursuz tamamlandı.`,
        'success'
      );
      await refreshStats();
      return { success: true, year: currentYear };
    } catch (e) {
      console.error("Manual turnover failed:", e);
      showToast("Devir işlemi sırasında bir hata oluştu.", 'error');
      return { success: false, year: new Date().getFullYear() };
    }
  };

  const setUiScale = (scale: UIScale) => {
    setUiScaleState(scale);
    localStorage.setItem('mks_ui_scale', scale);
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    emitAppToast(message, type);
  }, []);

  const hapticFeedback = useCallback(async (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
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
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    switch (uiScale) {
      case 'SMALL': root.style.fontSize = '14px'; break;
      case 'MEDIUM': root.style.fontSize = '16px'; break;
      case 'LARGE': root.style.fontSize = '18.5px'; break;
    }
  }, [uiScale]);

  const syncLegacyData = async () => {
    await runLegacyDataSync(refreshStats);
  };

  useEffect(() => {
    const init = async () => {
        if (isInitialized) return;
        
        // Sync language from profile
        if (userProfile.language) {
            setLanguageState(userProfile.language);
        }
        
        setIsInitialized(true);

        // Run background housekeeping safely without blocking login or triggering Web permission dialogs
        try {
            if (auth.currentUser || localStorage.getItem('lastUserId')) {
                await cleanupOldData().catch(() => {});
                await syncLegacyData().catch(() => {});
                await refreshNews().catch(() => {});
                await refreshPlants().catch(() => {});
                checkWeatherAlerts().catch(() => {});
            }
        } catch (err) {
            console.warn("AppProvider background init warning:", err);
        }

        if (Capacitor.isNativePlatform()) {
            try {
                const permission = await LocalNotifications.requestPermissions();
                if (permission.display !== 'granted') console.warn("Bildirim izinleri verilmedi.");
            } catch (e) {}
        }
    };
    init();
  }, []);

    const prescriptionLabel = t('label.prescription');
    const farmerLabel = t('label.farmer');
    const farmerPluralLabel = t('label.farmers');

    const contextValue = useMemo<AppContextType>(() => ({
        stats, refreshStats, addFarmer, updateFarmer, deleteFarmer, bulkAddFarmers, softDeleteFarmer, restoreFarmer, permanentlyDeleteFarmer,
        farmers, trashedFarmers, visits, trashedVisits, reminders, addReminder, editReminder, toggleReminder, deleteReminder,
        uiScale, setUiScale, 
        notifications, unreadCount, clearNotifications, markAllAsRead,
        userProfile, updateUserProfile, syncUserProfile, isAdmin, subscriptionStatus, subscriptionEndsAt, getAllUsers, updateUserSubscription, deleteUser, sendPasswordReset, addSystemNotification, runSmartNotificationsScan,
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
        accounts, addAccount, updateAccount, deleteAccount, transferBetweenAccounts,
        transactions, addTransaction, deleteTransaction,
        performManualTurnover,
        isInitialized,
        showToast, hapticFeedback,
        language, setLanguage, t,
        collectionLogs, addCollectionLog, updateCollectionLog, deleteCollectionLog,
        plants, addPlant, updatePlant, deletePlant, refreshPlants
    }), [
        stats, farmers, trashedFarmers, visits, trashedVisits, reminders, uiScale,
        notifications, unreadCount, userProfile, isAdmin, subscriptionStatus, subscriptionEndsAt,
        teamMembers, activeTeamMember, messages, prescriptionLabel, farmerLabel, farmerPluralLabel,
        inventory, trashedInventory, prescriptions, trashedPrescriptions, supplierPurchases,
        news, payments, trashedPayments, manualDebts, trashedManualDebts,
        suppliers, trashedSuppliers, trashedSupplierPurchases, trashedSupplierPayments,
        myPayments, expenses, trashedExpenses, accounts, transactions,
        isInitialized, language, collectionLogs, plants, refreshStats, runSmartNotificationsScan, showToast, hapticFeedback
    ]);

    return (
      <AppContext.Provider value={contextValue}>
        {children}
        <ToastHost />
      </AppContext.Provider>
    );
};

export const useAppViewModel = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppViewModel must be used within AppProvider');
  return context;
};


import { safeStringify } from '../utils/json';
import { openDB, DBSchema } from 'idb';
import { Farmer, Pesticide, VisitLog, Prescription, AppNotification, UserProfile, Reminder, InventoryItem, PesticideCategory, Payment, ManualDebt, Supplier, SupplierPurchase, SupplierPayment, MyPayment, TurnoverLog, Expense, Account, Transaction, TeamMember, Message } from '../types';
import { MOCK_PESTICIDES } from '../constants';
import { db as firestore, auth } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch, query, where, getDoc, onSnapshot } from 'firebase/firestore';

interface AgriDB extends DBSchema {
  farmers: {
    key: string;
    value: Farmer;
    indexes: { 'by-name': string };
  };
  pesticides: {
    key: string;
    value: Pesticide;
  };
  visits: {
    key: string;
    value: VisitLog;
    indexes: { 'by-farmer': string };
  };
  prescriptions: {
    key: string;
    value: Prescription;
    indexes: { 'by-farmer': string };
  };
  notifications: {
    key: string;
    value: AppNotification;
  };
  reminders: {
    key: string;
    value: Reminder;
    indexes: { 'by-date': string };
  };
  inventory: {
    key: string;
    value: InventoryItem;
    indexes: { 'by-pesticide': string };
  };
  payments: {
    key: string;
    value: Payment;
    indexes: { 'by-farmer': string };
  };
  manualDebts: {
    key: string;
    value: ManualDebt;
    indexes: { 'by-farmer': string };
  };
  suppliers: {
    key: string;
    value: Supplier;
  };
  supplierPurchases: {
    key: string;
    value: SupplierPurchase;
    indexes: { 'by-supplier': string };
  };
  supplierPayments: {
    key: string;
    value: SupplierPayment;
    indexes: { 'by-supplier': string };
  };
  myPayments: {
    key: string;
    value: MyPayment;
    indexes: { 'by-due-date': string };
  };
  turnoverLogs: {
    key: string;
    value: TurnoverLog;
    indexes: { 'by-year': number };
  };
  expenses: {
    key: string;
    value: Expense;
    indexes: { 'by-date': string };
  };
  accounts: {
    key: string;
    value: Account;
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'by-account': string, 'by-date': string };
  };
  teamMembers: {
    key: string;
    value: TeamMember;
  };
  messages: {
    key: string;
    value: Message;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'agri-engineer-db';
const DB_VERSION = 20;

const FS_ROOT = "MKS";
const FS_ORG = "g892bEaJyGfEq1Fa67yb";
const FS_USERS = "users";

const sanitizeForFirestore = (obj: any, cache = new WeakSet()): any => {
  if (obj === undefined || obj === null) return null;
  
  // Basic types
  if (typeof obj !== 'object') return obj;
  
  // Special types that Firestore handles
  if (obj instanceof Date) return obj;
  if (obj instanceof RegExp) return obj.toString();
  
  // Handle circular references
  if (cache.has(obj)) return null;
  cache.add(obj);

  // Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item, cache));
  }
  
  // Plain objects
  const newObj: any = {};
  try {
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      // Skip functions and other non-serializable properties
      if (typeof val === 'function') return;
      newObj[key] = sanitizeForFirestore(val, cache);
    });
  } catch (e) {
    console.warn("Error sanitizing object for Firestore:", e);
    return null;
  }
  
  return newObj;
};

export const initDB = async () => {
  return openDB<AgriDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('farmers')) {
        const farmerStore = db.createObjectStore('farmers', { keyPath: 'id' });
        farmerStore.createIndex('by-name', 'fullName');
      }
      if (!db.objectStoreNames.contains('pesticides')) {
        db.createObjectStore('pesticides', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('visits')) {
        const visitStore = db.createObjectStore('visits', { keyPath: 'id' });
        visitStore.createIndex('by-farmer', 'farmerId');
      }
      if (!db.objectStoreNames.contains('prescriptions')) {
        const prescriptionStore = db.createObjectStore('prescriptions', { keyPath: 'id' });
        prescriptionStore.createIndex('by-farmer', 'farmerId');
      }
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reminders')) {
        const reminderStore = db.createObjectStore('reminders', { keyPath: 'id' });
        reminderStore.createIndex('by-date', 'date');
      }
      if (!db.objectStoreNames.contains('inventory')) {
        const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' });
        inventoryStore.createIndex('by-pesticide', 'pesticideId');
      }
      if (!db.objectStoreNames.contains('payments')) {
        const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
        paymentStore.createIndex('by-farmer', 'farmerId');
      }
      if (!db.objectStoreNames.contains('manualDebts')) {
        const debtStore = db.createObjectStore('manualDebts', { keyPath: 'id' });
        debtStore.createIndex('by-farmer', 'farmerId');
      }
      if (!db.objectStoreNames.contains('suppliers')) {
        db.createObjectStore('suppliers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('supplierPurchases')) {
        const purchaseStore = db.createObjectStore('supplierPurchases', { keyPath: 'id' });
        purchaseStore.createIndex('by-supplier', 'supplierId');
      }
      if (!db.objectStoreNames.contains('supplierPayments')) {
        const paymentStore = db.createObjectStore('supplierPayments', { keyPath: 'id' });
        paymentStore.createIndex('by-supplier', 'supplierId');
      }
      if (!db.objectStoreNames.contains('myPayments')) {
        const myPaymentStore = db.createObjectStore('myPayments', { keyPath: 'id' });
        myPaymentStore.createIndex('by-due-date', 'dueDate');
      }
      if (!db.objectStoreNames.contains('turnoverLogs')) {
        const turnoverStore = db.createObjectStore('turnoverLogs', { keyPath: 'id' });
        turnoverStore.createIndex('by-year', 'year');
      }
      if (!db.objectStoreNames.contains('expenses')) {
        const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expenseStore.createIndex('by-date', 'date');
      }
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
        transactionStore.createIndex('by-account', 'accountId');
        transactionStore.createIndex('by-date', 'date');
      }
      if (!db.objectStoreNames.contains('teamMembers')) {
        db.createObjectStore('teamMembers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-date', 'timestamp');
      }
    },
  });
};

/**
 * Arka planda Firestore ile senkronize eder. 
 * Hata alsa bile yerel işlem başarılı sayılır.
 */
const backgroundSync = async (collectionName: string, data: any) => {
  if (!navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;

  const cleanData = sanitizeForFirestore(data);

  // UI'ı engellememek için async/await'siz arka plana atıyoruz
  setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, data.id), cleanData, { merge: true })
    .catch(err => console.warn(`Background sync failed for ${collectionName}:`, err));
};

const backgroundDelete = async (collectionName: string, id: string) => {
  if (!navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;

  deleteDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, id))
    .catch(err => console.warn(`Background delete failed for ${collectionName}:`, err));
};

let isActionBlocked = false;
let onActionBlocked: (() => void) | null = null;

export const setActionBlocked = (blocked: boolean) => {
  isActionBlocked = blocked;
};

export const setActionBlockedCallback = (cb: () => void) => {
  onActionBlocked = cb;
};

const requireAdmin = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  if (user.email === 'nayiffirat@gmail.com') return true;
  
  const snap = await getDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid));
  if (snap.exists()) {
    const profile = snap.data() as UserProfile;
    if (profile.role === 'admin') return true;
  }
  throw new Error('Unauthorized: Admin access required');
};

const dbServiceObj = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const local = localStorage.getItem('mks_user_profile');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.subscriptionStatus) return parsed;
    }

    if (navigator.onLine) {
        try {
            const snap = await getDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid));
            if (snap.exists()) {
                const profile = snap.data() as UserProfile;
                
                // Initialize subscription if missing
                if (!profile.subscriptionStatus) {
                  const email = auth.currentUser?.email;
                  const isAdmin = email === 'nayiffirat@gmail.com';
                  
                  profile.role = isAdmin ? 'admin' : 'user';
                  profile.subscriptionStatus = isAdmin ? 'active' : 'trial';
                  
                  const endDate = new Date();
                  if (isAdmin) {
                    endDate.setFullYear(2099);
                  } else {
                    endDate.setDate(endDate.getDate() + 7); // 7 days trial
                  }
                  profile.subscriptionEndsAt = endDate.toISOString();
                  
                  await this.saveUserProfile(uid, profile);
                }
                
                localStorage.setItem('mks_user_profile', safeStringify(profile));
                return profile;
            } else {
                // New user profile creation
                const email = auth.currentUser?.email;
                const isAdmin = email === 'nayiffirat@gmail.com';
                
                const endDate = new Date();
                if (isAdmin) {
                  endDate.setFullYear(2099);
                } else {
                  endDate.setDate(endDate.getDate() + 7); // 7 days trial
                }

                const newProfile: UserProfile = {
                  email: email || '',
                  createdAt: new Date().toISOString(),
                  lastLoginAt: new Date().toISOString(),
                  fullName: auth.currentUser?.displayName || '',
                  phoneNumber: '',
                  companyName: '',
                  title: 'Ziraat Mühendisi',
                  role: isAdmin ? 'admin' : 'user',
                  subscriptionStatus: isAdmin ? 'active' : 'trial',
                  subscriptionEndsAt: endDate.toISOString()
                };
                await this.saveUserProfile(uid, newProfile);
                return newProfile;
            }
        } catch (e) {}
    }
    return null;
  },

  async saveUserProfile(uid: string, profile: UserProfile) {
    localStorage.setItem('mks_user_profile', safeStringify(profile));
    if (navigator.onLine) {
        try {
            const profileToSave = { ...profile };
            // Prevent privilege escalation
            const user = auth.currentUser;
            const isRootAdmin = user?.email === 'nayiffirat@gmail.com';
            
            if (!isRootAdmin) {
                const snap = await getDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid));
                if (snap.exists()) {
                    const existingProfile = snap.data() as UserProfile;
                    // Preserve sensitive fields
                    profileToSave.role = existingProfile.role;
                    profileToSave.subscriptionStatus = existingProfile.subscriptionStatus;
                    profileToSave.subscriptionEndsAt = existingProfile.subscriptionEndsAt;
                } else {
                    // Prevent setting admin/active status on creation
                    profileToSave.role = 'user';
                    profileToSave.subscriptionStatus = 'trial';
                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + 7);
                    profileToSave.subscriptionEndsAt = endDate.toISOString();
                }
            }

            const cleanProfile = sanitizeForFirestore({ 
                ...profileToSave, 
                lastUpdate: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                email: auth.currentUser?.email || profileToSave.email
            });
            await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid), cleanProfile, { merge: true });
        } catch (error) {
            console.error("Error saving user profile:", error);
        }
    }
  },

  // --- ADMIN FUNCTIONS ---
  async getAllUsers(): Promise<(UserProfile & { uid: string, email?: string })[]> {
    if (!navigator.onLine) return [];
    try {
      await requireAdmin();
      const snap = await getDocs(collection(firestore, FS_ROOT, FS_ORG, FS_USERS));
      return snap.docs.map(d => ({ ...d.data() as UserProfile, uid: d.id }));
    } catch (error) {
      console.error("Error fetching all users:", error);
      return [];
    }
  },

  async updateUserSubscription(uid: string, updates: Partial<UserProfile>) {
    if (!navigator.onLine) return;
    try {
      await requireAdmin();
      await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid), sanitizeForFirestore(updates), { merge: true });
    } catch (error) {
      console.error("Error updating user subscription:", error);
      throw error;
    }
  },

  async deleteUser(uid: string) {
    if (!navigator.onLine) return;
    try {
      await requireAdmin();
      await deleteDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid));
    } catch (error) {
      console.error("Error deleting user profile:", error);
      throw error;
    }
  },

  /**
   * Giriş yapıldığında tüm verileri çeker ve yerelle birleştirir.
   */
  async syncAllDataOnLogin(uid: string) {
    if (!navigator.onLine) return;
    const db = await initDB();
    const userPath = [FS_ROOT, FS_ORG, FS_USERS, uid].join("/");
    const collections = ["farmers", "notifications", "visits", "prescriptions", "reminders", "inventory", "payments", "manualDebts", "suppliers", "supplierPurchases", "supplierPayments", "myPayments", "expenses", "accounts", "transactions", "teamMembers", "messages"] as const;

    for (const col of collections) {
      try {
        const snap = await getDocs(collection(firestore, userPath, col));
        const data = snap.docs.map(d => d.data());
        if (data.length > 0) {
          const tx = db.transaction(col, 'readwrite');
          await Promise.all(data.map(item => tx.store.put(item as any)));
          await tx.done;
        }
      } catch (e) {}
    }
  },

  async syncGlobalPesticides() {
    const db = await initDB();
    // Önce yerel sayıma bak
    const count = await db.count('pesticides');
    
    // Eğer yerelde hiç yoksa mock'ları bas
    if (count === 0) {
        const tx = db.transaction('pesticides', 'readwrite');
        await Promise.all(MOCK_PESTICIDES.map(p => tx.store.put(p)));
        await tx.done;
    }

    // İnternet varsa arka planda güncelle
    if (navigator.onLine) {
        getDocs(collection(firestore, 'pesticides')).then(snapshot => {
            if (!snapshot.empty) {
                const cloudData = snapshot.docs.map(d => d.data() as Pesticide);
                const tx = db.transaction('pesticides', 'readwrite');
                cloudData.forEach(p => tx.store.put(p));
            }
        }).catch(() => {});
    }
  },

  async clearLocalUserData() {
    const db = await initDB();
    const stores = ['farmers', 'visits', 'prescriptions', 'notifications', 'reminders', 'inventory', 'payments', 'manualDebts', 'suppliers', 'supplierPurchases', 'supplierPayments', 'myPayments', 'expenses', 'accounts', 'transactions', 'teamMembers', 'messages'] as const;
    for (const store of stores) await db.clear(store);
    localStorage.removeItem('mks_user_profile');
  },

  async getFarmers() {
    const db = await initDB();
    const farmers = await db.getAll('farmers');
    return farmers.map(f => ({
        ...f,
        fields: f.fields || []
    })).sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
  },

  /**
   * Üretici portalı için Firestore'dan veri çeker.
   * Bu metod engineerId parametresi ile çalışır, böylece farmer kendi telefonundan erişebilir.
   */
  async getFarmerPortalData(engineerId: string, farmerId: string) {
    try {
        const userPath = [FS_ROOT, FS_ORG, FS_USERS, engineerId].join("/");
        
        // 1. Farmer verisini çek
        const farmerDoc = await getDoc(doc(firestore, userPath, "farmers", farmerId));
        if (!farmerDoc.exists()) return null;
        const farmer = farmerDoc.data() as Farmer;

        // 2. Reçeteleri çek
        const pQuery = query(collection(firestore, userPath, "prescriptions"), where("farmerId", "==", farmerId));
        const pSnap = await getDocs(pQuery);
        const prescriptions = pSnap.docs.map(d => d.data() as Prescription);

        // 3. Ziyaretleri çek
        const vQuery = query(collection(firestore, userPath, "visits"), where("farmerId", "==", farmerId));
        const vSnap = await getDocs(vQuery);
        const visits = vSnap.docs.map(d => d.data() as VisitLog);

        // 4. Ödemeleri çek
        const payQuery = query(collection(firestore, userPath, "payments"), where("farmerId", "==", farmerId));
        const paySnap = await getDocs(payQuery);
        const payments = paySnap.docs.map(d => d.data() as any);

        // 5. Manuel borçları çek
        const debtQuery = query(collection(firestore, userPath, "manualDebts"), where("farmerId", "==", farmerId));
        const debtSnap = await getDocs(debtQuery);
        const manualDebts = debtSnap.docs.map(d => d.data() as any);

        // 6. Mühendis profilini çek
        const profileDoc = await getDoc(doc(firestore, userPath));
        const profile = profileDoc.exists() ? profileDoc.data() as UserProfile : undefined;

        return { farmer, prescriptions, visits, payments, manualDebts, profile };
    } catch (error) {
        console.error("Error fetching portal data:", error);
        return null;
    }
  },
  
  async addFarmer(farmer: Farmer) {
    const db = await initDB();
    await db.put('farmers', farmer);
    backgroundSync('farmers', farmer);
    return farmer.id;
  },

  async updateFarmer(farmer: Farmer) {
    const db = await initDB();
    await db.put('farmers', farmer);
    backgroundSync('farmers', farmer);
    return farmer.id;
  },

  async deleteFarmer(id: string) {
    const db = await initDB();
    await db.delete('farmers', id);
    backgroundDelete('farmers', id);
  },
  
  async getPesticides() {
    const db = await initDB();
    return (await db.getAll('pesticides')).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  },

  async addGlobalPesticide(pesticide: Pesticide) {
      const db = await initDB();
      await db.put('pesticides', pesticide);
      if (navigator.onLine) {
          const cleanPesticide = sanitizeForFirestore(pesticide);
          setDoc(doc(firestore, 'pesticides', pesticide.id), cleanPesticide).catch(() => {});
      }
      return pesticide.id;
  },
  
  async addVisit(visit: VisitLog) {
    const db = await initDB();
    await db.put('visits', visit);
    backgroundSync('visits', visit);
    return visit.id;
  },

  async updateVisit(visit: VisitLog) {
    const db = await initDB();
    await db.put('visits', visit);
    backgroundSync('visits', visit);
    return visit.id;
  },

  async deleteVisit(id: string) {
    const db = await initDB();
    await db.delete('visits', id);
    backgroundDelete('visits', id);
  },
  
  async getVisitsByFarmer(farmerId: string) {
    const db = await initDB();
    const visits = await db.getAllFromIndex('visits', 'by-farmer', farmerId);
    return visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
  
  async addPrescription(prescription: Prescription) {
    const db = await initDB();
    await db.put('prescriptions', prescription);
    backgroundSync('prescriptions', prescription);
    return prescription.id;
  },

  async updatePrescription(prescription: Prescription) {
    const db = await initDB();
    await db.put('prescriptions', prescription);
    backgroundSync('prescriptions', prescription);
    return prescription.id;
  },

  async deletePrescription(id: string) {
    const db = await initDB();
    await db.delete('prescriptions', id);
    backgroundDelete('prescriptions', id);
  },
  
  async getPrescriptionsByFarmer(farmerId: string) {
    const db = await initDB();
    return db.getAllFromIndex('prescriptions', 'by-farmer', farmerId);
  },
  
  async getAllPrescriptions() {
    const db = await initDB();
    return (await db.getAll('prescriptions')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
  
  async getAllVisits() {
    const db = await initDB();
    return (await db.getAll('visits')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getReminders() {
    const db = await initDB();
    return (await db.getAll('reminders')).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  async addReminder(reminder: Reminder) {
    const db = await initDB();
    await db.put('reminders', reminder);
    backgroundSync('reminders', reminder);
  },

  async updateReminder(reminder: Reminder) {
    const db = await initDB();
    await db.put('reminders', reminder);
    backgroundSync('reminders', reminder);
  },

  async deleteReminder(id: string) {
    const db = await initDB();
    await db.delete('reminders', id);
    backgroundDelete('reminders', id);
  },

  async getNotifications() {
    const db = await initDB();
    return (await db.getAll('notifications')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async addNotification(n: AppNotification) {
    const db = await initDB();
    await db.put('notifications', n);
    backgroundSync('notifications', n);
  },

  async updateNotification(n: AppNotification) {
    const db = await initDB();
    await db.put('notifications', n);
    backgroundSync('notifications', n);
  },

  async deleteNotification(id: string) {
    const db = await initDB();
    await db.delete('notifications', id);
    backgroundDelete('notifications', id);
  },

  async getInventory() {
    const db = await initDB();
    return (await db.getAll('inventory')).sort((a, b) => a.pesticideName.localeCompare(b.pesticideName, 'tr'));
  },

  async addInventoryItem(item: InventoryItem) {
    const db = await initDB();
    await db.put('inventory', item);
    backgroundSync('inventory', item);
  },

  async updateInventoryItem(item: InventoryItem) {
    const db = await initDB();
    await db.put('inventory', item);
    backgroundSync('inventory', item);
  },

  async deleteInventoryItem(id: string) {
    const db = await initDB();
    await db.delete('inventory', id);
    backgroundDelete('inventory', id);
  },

  async initializeInventoryFromPrescriptions() {
    const db = await initDB();
    const prescriptions = await db.getAll('prescriptions');
    const pesticides = await db.getAll('pesticides');
    const inventory = await db.getAll('inventory');
    
    const tx = db.transaction('inventory', 'readwrite');
    const store = tx.objectStore('inventory');
    
    const uniquePesticideIds = new Set<string>();
    prescriptions.forEach(p => {
        p.items.forEach(item => {
            uniquePesticideIds.add(item.pesticideId);
        });
    });

    const updates: InventoryItem[] = [];

    for (const pestId of uniquePesticideIds) {
        const existing = inventory.find(i => i.pesticideId === pestId);
        const pesticide = pesticides.find(p => p.id === pestId);
        
        // Find pesticide name from prescriptions if not in library
        let pesticideName = pesticide?.name;
        let category = pesticide?.category || PesticideCategory.OTHER;

        if (!pesticideName) {
            for (const p of prescriptions) {
                const item = p.items.find(i => i.pesticideId === pestId);
                if (item) {
                    pesticideName = item.pesticideName;
                    break;
                }
            }
        }

        const item: InventoryItem = {
            id: existing?.id || crypto.randomUUID(),
            pesticideId: pestId,
            pesticideName: pesticideName || 'Bilinmeyen İlaç',
            category: category,
            quantity: 1000,
            unit: 'Adet',
            buyingPrice: 1,
            sellingPrice: existing?.sellingPrice || 0,
            lastUpdated: new Date().toISOString()
        };

        await store.put(item);
        updates.push(item);
    }

    await tx.done;
    updates.forEach(item => backgroundSync('inventory', item));
  },

  async processInventory(prescription: Prescription) {
    if (prescription.isInventoryProcessed) return;

    const db = await initDB();
    const tx = db.transaction(['inventory', 'prescriptions'], 'readwrite');
    const inventoryStore = tx.objectStore('inventory');
    const prescriptionStore = tx.objectStore('prescriptions');
    
    const allInventory = await inventoryStore.getAll();
    const inventoryUpdates: InventoryItem[] = [];
    
    for (const item of prescription.items) {
        if (!item.quantity) continue;
        
        const qty = Number(item.quantity);
        if (isNaN(qty) || qty === 0) continue;

        const existingIndex = allInventory.findIndex(i => i.pesticideId === item.pesticideId);
        
        if (existingIndex !== -1) {
            const existingItem = allInventory[existingIndex];
            const updatedItem = {
                ...existingItem,
                quantity: existingItem.quantity - qty,
                lastUpdated: new Date().toISOString()
            };
            await inventoryStore.put(updatedItem);
            allInventory[existingIndex] = updatedItem; // Update in memory
            inventoryUpdates.push(updatedItem);
        } else {
            const newItem: InventoryItem = {
                id: crypto.randomUUID(),
                pesticideId: item.pesticideId,
                pesticideName: item.pesticideName,
                category: PesticideCategory.OTHER,
                quantity: -qty,
                unit: 'Adet',
                buyingPrice: 0,
                sellingPrice: item.unitPrice || 0,
                lastUpdated: new Date().toISOString()
            };
            await inventoryStore.put(newItem);
            allInventory.push(newItem); // Add to memory
            inventoryUpdates.push(newItem);
        }
    }

    const updatedPrescription: Prescription = { ...prescription, isInventoryProcessed: true };
    await prescriptionStore.put(updatedPrescription);
    
    await tx.done;

    // Sync to Firestore after successful local transaction
    inventoryUpdates.forEach(item => backgroundSync('inventory', item));
    backgroundSync('prescriptions', updatedPrescription);
  },

  async revertInventory(prescription: Prescription) {
    if (!prescription.isInventoryProcessed) return;

    const db = await initDB();
    const tx = db.transaction(['inventory', 'prescriptions'], 'readwrite');
    const inventoryStore = tx.objectStore('inventory');
    const prescriptionStore = tx.objectStore('prescriptions');
    
    const allInventory = await inventoryStore.getAll();
    const inventoryUpdates: InventoryItem[] = [];
    
    for (const item of prescription.items) {
        if (!item.quantity) continue;
        
        const qty = Number(item.quantity);
        if (isNaN(qty) || qty === 0) continue;

        const existingIndex = allInventory.findIndex(i => i.pesticideId === item.pesticideId);
        
        if (existingIndex !== -1) {
            const existingItem = allInventory[existingIndex];
            const updatedItem = {
                ...existingItem,
                quantity: existingItem.quantity + qty,
                lastUpdated: new Date().toISOString()
            };
            await inventoryStore.put(updatedItem);
            allInventory[existingIndex] = updatedItem; // Update in memory
            inventoryUpdates.push(updatedItem);
        }
    }

    const updatedPrescription: Prescription = { ...prescription, isInventoryProcessed: false };
    await prescriptionStore.put(updatedPrescription);
    
    await tx.done;

    // Sync to Firestore after successful local transaction
    inventoryUpdates.forEach(item => backgroundSync('inventory', item));
    backgroundSync('prescriptions', updatedPrescription);
  },

  async cleanupOldNotifications() {
    const db = await initDB();
    const list = await db.getAll('notifications');
    const now = Date.now();
    const expiry = 30 * 24 * 60 * 60 * 1000;
    const tx = db.transaction('notifications', 'readwrite');
    for (const n of list) {
        if (now - new Date(n.date).getTime() > expiry) {
            await tx.store.delete(n.id);
            backgroundDelete('notifications', n.id);
        }
    }
    await tx.done;
  },

  async backupAllData() {
    if (!navigator.onLine) throw new Error("İnternet bağlantısı yok.");
    
    const user = auth.currentUser;
    if (!user) throw new Error("Oturum açılmamış. Lütfen tekrar giriş yapın.");

    const db = await initDB();
    const stores = ['farmers', 'visits', 'prescriptions', 'notifications', 'reminders', 'inventory', 'payments', 'manualDebts', 'suppliers', 'supplierPurchases', 'supplierPayments', 'myPayments', 'expenses', 'accounts', 'transactions', 'teamMembers', 'messages'] as const;
    
    let total = 0;
    for (const storeName of stores) {
        const items = await db.getAll(storeName);
        await Promise.all(items.map(item => backgroundSync(storeName, item)));
        total += items.length;
    }
    
    const timestamp = new Date().toISOString();
    // Update lastSyncTime in Firestore user profile
    await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid), { lastSyncTime: timestamp }, { merge: true });

    return { total, timestamp };
  },

  async getPayments() {
    const db = await initDB();
    return (await db.getAll('payments')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getPaymentsByFarmer(farmerId: string) {
    const db = await initDB();
    return db.getAllFromIndex('payments', 'by-farmer', farmerId);
  },

  async addPayment(payment: Payment) {
    const db = await initDB();
    await db.put('payments', payment);
    backgroundSync('payments', payment);
    return payment.id;
  },

  async updatePayment(payment: Payment) {
    const db = await initDB();
    await db.put('payments', payment);
    backgroundSync('payments', payment);
  },

  async deletePayment(id: string) {
    const db = await initDB();
    await db.delete('payments', id);
    backgroundDelete('payments', id);
  },
  
  async getManualDebts() {
    const db = await initDB();
    return (await db.getAll('manualDebts')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getManualDebtsByFarmer(farmerId: string) {
    const db = await initDB();
    return db.getAllFromIndex('manualDebts', 'by-farmer', farmerId);
  },

  async addManualDebt(debt: ManualDebt) {
    const db = await initDB();
    await db.put('manualDebts', debt);
    backgroundSync('manualDebts', debt);
    return debt.id;
  },

  async updateManualDebt(debt: ManualDebt) {
    const db = await initDB();
    await db.put('manualDebts', debt);
    backgroundSync('manualDebts', debt);
    return debt.id;
  },

  async deleteManualDebt(id: string) {
    const db = await initDB();
    await db.delete('manualDebts', id);
    backgroundDelete('manualDebts', id);
  },

  async getSuppliers() {
    const db = await initDB();
    return (await db.getAll('suppliers')).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  },

  async addSupplier(supplier: Supplier) {
    const db = await initDB();
    await db.put('suppliers', supplier);
    backgroundSync('suppliers', supplier);
    return supplier.id;
  },

  async updateSupplier(supplier: Supplier) {
    const db = await initDB();
    await db.put('suppliers', supplier);
    backgroundSync('suppliers', supplier);
    return supplier.id;
  },

  async deleteSupplier(id: string) {
    const db = await initDB();
    await db.delete('suppliers', id);
    backgroundDelete('suppliers', id);
  },

  async getSupplierPurchases(supplierId: string) {
    const db = await initDB();
    return db.getAllFromIndex('supplierPurchases', 'by-supplier', supplierId);
  },

  async addSupplierPurchase(purchase: SupplierPurchase) {
    const db = await initDB();
    await db.put('supplierPurchases', purchase);
    backgroundSync('supplierPurchases', purchase);
    return purchase.id;
  },

  async updateSupplierPurchase(purchase: SupplierPurchase) {
    const db = await initDB();
    await db.put('supplierPurchases', purchase);
    backgroundSync('supplierPurchases', purchase);
    return purchase.id;
  },

  async deleteSupplierPurchase(id: string) {
    const db = await initDB();
    await db.delete('supplierPurchases', id);
    backgroundDelete('supplierPurchases', id);
  },

  async getSupplierPayments(supplierId: string) {
    const db = await initDB();
    return db.getAllFromIndex('supplierPayments', 'by-supplier', supplierId);
  },

  async addSupplierPayment(payment: SupplierPayment) {
    const db = await initDB();
    await db.put('supplierPayments', payment);
    backgroundSync('supplierPayments', payment);
    return payment.id;
  },

  async updateSupplierPayment(payment: SupplierPayment) {
    const db = await initDB();
    await db.put('supplierPayments', payment);
    backgroundSync('supplierPayments', payment);
  },

  async deleteSupplierPayment(id: string) {
    const db = await initDB();
    await db.delete('supplierPayments', id);
    backgroundDelete('supplierPayments', id);
  },

  async getMyPayments() {
    const db = await initDB();
    return (await db.getAll('myPayments')).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  },

  async addMyPayment(payment: MyPayment) {
    const db = await initDB();
    await db.put('myPayments', payment);
    backgroundSync('myPayments', payment);
    return payment.id;
  },

  async updateMyPayment(payment: MyPayment) {
    const db = await initDB();
    await db.put('myPayments', payment);
    backgroundSync('myPayments', payment);
    return payment.id;
  },

  async deleteMyPayment(id: string) {
    const db = await initDB();
    await db.delete('myPayments', id);
    backgroundDelete('myPayments', id);
  },

  // --- TURNOVER LOGS ---
  async getTurnoverLogs(): Promise<TurnoverLog[]> {
    const db = await initDB();
    return db.getAll('turnoverLogs');
  },

  async addTurnoverLog(log: TurnoverLog): Promise<void> {
    const db = await initDB();
    await db.put('turnoverLogs', log);
    
    // Sync to Firestore
    const user = auth.currentUser;
    if (user) {
      await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, 'turnoverLogs', log.id), sanitizeForFirestore(log));
    }
  },

  async performFinancialTurnover(year: number, farmerBalances: Record<string, number>): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(['manualDebts', 'turnoverLogs'], 'readwrite');
    const debtStore = tx.objectStore('manualDebts');
    const logStore = tx.objectStore('turnoverLogs');
    
    const date = `${year}-01-01T00:00:01Z`;
    const note = `${year} Devir Bakiyesi`;
    
    for (const [farmerId, balance] of Object.entries(farmerBalances)) {
      if (balance === 0) continue;
      
      const turnoverEntry: ManualDebt = {
        id: `turnover-${year}-${farmerId}`,
        farmerId,
        amount: balance,
        date,
        note
      };
      
      await debtStore.put(turnoverEntry);
      backgroundSync('manualDebts', turnoverEntry);
    }
    
    const log: TurnoverLog = {
      id: `turnover-log-fin-${year}`,
      year,
      date: new Date().toISOString(),
      type: 'FINANCIAL'
    };
    
    await logStore.put(log);
    backgroundSync('turnoverLogs', log);
    
    await tx.done;
  },

  async performInventoryTurnover(year: number, inventoryItems: InventoryItem[]): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(['turnoverLogs'], 'readwrite');
    const logStore = tx.objectStore('turnoverLogs');
    
    // For inventory, we just log that it happened. 
    // The user might want a snapshot, but for now we just mark the log.
    const log: TurnoverLog = {
      id: `turnover-log-inv-${year}`,
      year,
      date: new Date().toISOString(),
      type: 'INVENTORY'
    };
    
    await logStore.put(log);
    backgroundSync('turnoverLogs', log);
    
    await tx.done;
  },

  // --- EXPENSES ---
  async getExpenses() {
    const db = await initDB();
    return (await db.getAll('expenses')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async addExpense(expense: Expense) {
    const db = await initDB();
    await db.put('expenses', expense);
    backgroundSync('expenses', expense);
    return expense.id;
  },

  async updateExpense(expense: Expense) {
    const db = await initDB();
    await db.put('expenses', expense);
    backgroundSync('expenses', expense);
  },

  // --- ACCOUNTS & TRANSACTIONS ---
  async getAccounts() {
    const db = await initDB();
    return db.getAll('accounts');
  },

  async addAccount(account: Account) {
    const db = await initDB();
    await db.put('accounts', account);
    backgroundSync('accounts', account);
    return account.id;
  },

  async updateAccount(account: Account) {
    const db = await initDB();
    await db.put('accounts', account);
    backgroundSync('accounts', account);
    return account.id;
  },

  async deleteAccount(id: string) {
    const db = await initDB();
    await db.delete('accounts', id);
    backgroundDelete('accounts', id);
  },

  async getTransactions() {
    const db = await initDB();
    return (await db.getAll('transactions')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async addTransaction(transaction: Transaction) {
    const db = await initDB();
    await db.put('transactions', transaction);
    backgroundSync('transactions', transaction);
    
    // Update account balance
    const account = await db.get('accounts', transaction.accountId);
    if (account) {
      if (transaction.type === 'INCOME') {
        account.balance += transaction.amount;
      } else {
        account.balance -= transaction.amount;
      }
      await db.put('accounts', account);
      backgroundSync('accounts', account);
    }
    return transaction.id;
  },

  async updateTransaction(transaction: Transaction) {
    const db = await initDB();
    const oldTransaction = await db.get('transactions', transaction.id);
    
    if (oldTransaction) {
      // Revert old transaction effect
      const oldAccount = await db.get('accounts', oldTransaction.accountId);
      if (oldAccount) {
        if (oldTransaction.type === 'INCOME') {
          oldAccount.balance -= oldTransaction.amount;
        } else {
          oldAccount.balance += oldTransaction.amount;
        }
        await db.put('accounts', oldAccount);
        backgroundSync('accounts', oldAccount);
      }
    }

    await db.put('transactions', transaction);
    backgroundSync('transactions', transaction);
    
    // Apply new transaction effect
    const newAccount = await db.get('accounts', transaction.accountId);
    if (newAccount) {
      if (transaction.type === 'INCOME') {
        newAccount.balance += transaction.amount;
      } else {
        newAccount.balance -= transaction.amount;
      }
      await db.put('accounts', newAccount);
      backgroundSync('accounts', newAccount);
    }
  },

  async deleteTransaction(id: string) {
    const db = await initDB();
    const transaction = await db.get('transactions', id);
    if (transaction) {
      const account = await db.get('accounts', transaction.accountId);
      if (account) {
        if (transaction.type === 'INCOME') {
          account.balance -= transaction.amount;
        } else {
          account.balance += transaction.amount;
        }
        await db.put('accounts', account);
        backgroundSync('accounts', account);
      }
    }
    await db.delete('transactions', id);
    backgroundDelete('transactions', id);
  },

  async deleteExpense(id: string) {
    const db = await initDB();
    await db.delete('expenses', id);
    backgroundDelete('expenses', id);
  },

  // --- TEAM MEMBERS ---
  async getTeamMembers() {
    const db = await initDB();
    return db.getAll('teamMembers');
  },

  async addTeamMember(member: TeamMember) {
    const db = await initDB();
    await db.put('teamMembers', member);
    backgroundSync('teamMembers', member);
    return member.id;
  },

  async updateTeamMember(member: TeamMember) {
    const db = await initDB();
    await db.put('teamMembers', member);
    backgroundSync('teamMembers', member);
    return member.id;
  },

  async deleteTeamMember(id: string) {
    const db = await initDB();
    await db.delete('teamMembers', id);
    backgroundDelete('teamMembers', id);
  },

  // --- MESSAGES ---
  async getMessages() {
    const db = await initDB();
    return (await db.getAll('messages')).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async sendMessage(message: Message) {
    const db = await initDB();
    await db.put('messages', message);
    backgroundSync('messages', message);
    return message.id;
  },

  /**
   * Gerçek zamanlı senkronizasyon için Firestore dinleyicilerini kurar.
   * Diğer cihazlardan gelen değişiklikleri yerel veritabanına yansıtır.
   */
  setupRealtimeSync(uid: string, onSync: () => void, onProfileSync?: (profile: UserProfile) => void) {
    const userPath = [FS_ROOT, FS_ORG, FS_USERS, uid].join("/");
    const collections = ["farmers", "notifications", "visits", "prescriptions", "reminders", "inventory", "payments", "manualDebts", "suppliers", "supplierPurchases", "supplierPayments", "myPayments", "expenses", "accounts", "transactions", "teamMembers", "messages"] as const;
    
    const unsubscribes: (() => void)[] = [];

    // Profile listener
    if (onProfileSync) {
      const profileRef = doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid);
      const profileUnsub = onSnapshot(profileRef, (snapshot) => {
        if (snapshot.exists() && !snapshot.metadata.hasPendingWrites) {
          const profileData = snapshot.data() as UserProfile;
          onProfileSync(profileData);
        }
      });
      unsubscribes.push(profileUnsub);
    }

    collections.forEach(col => {
      const q = collection(firestore, userPath, col);
      const unsub = onSnapshot(q, async (snapshot) => {
        // Yerel değişiklikleri (pending writes) senkronize etmeye gerek yok, 
        // çünkü onlar zaten IndexedDB'ye yazıldı.
        if (snapshot.metadata.hasPendingWrites) return;

        const db = await initDB();
        const tx = db.transaction(col, 'readwrite');
        
        // Firestore'dan gelen tüm verileri yerel DB ile senkronize et
        // Not: Performans için sadece değişen dökümanları (snapshot.docChanges()) kullanmak daha iyidir.
        for (const change of snapshot.docChanges()) {
          if (change.type === 'added' || change.type === 'modified') {
            await tx.store.put(change.doc.data() as any);
          } else if (change.type === 'removed') {
            await tx.store.delete(change.doc.id);
          }
        }
        
        await tx.done;
        onSync(); // UI'ı bilgilendir
      }, (error) => {
        console.warn(`Realtime sync error for ${col}:`, error);
      });
      
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }
};

export const dbService = new Proxy(dbServiceObj, {
  get(target, prop) {
    const value = target[prop as keyof typeof target];
    if (typeof value === 'function') {
      const propStr = prop.toString();
      const isMutating = (propStr.startsWith('add') || 
                         propStr.startsWith('update') || 
                         propStr.startsWith('delete') || 
                         propStr.startsWith('save') ||
                         propStr.startsWith('process') ||
                         propStr.startsWith('revert') ||
                         propStr.startsWith('perform')) && 
                         propStr !== 'clearLocalUserData' &&
                         propStr !== 'cleanupOldNotifications';
                         
      if (isMutating) {
        return async (...args: any[]) => {
          if (isActionBlocked) {
            if (onActionBlocked) onActionBlocked();
            throw new Error('SUBSCRIPTION_EXPIRED');
          }
          return (value as Function).apply(target, args);
        };
      }
    }
    return value;
  }
}) as typeof dbServiceObj;

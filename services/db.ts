
import { safeStringify } from '../utils/json';
import { openDB, DBSchema } from 'idb';
import { Farmer, Pesticide, VisitLog, Prescription, AppNotification, UserProfile, Reminder, InventoryItem, PesticideCategory, Payment, ManualDebt, Supplier, SupplierPurchase, SupplierPayment, MyPayment, TurnoverLog, Expense, Account, Transaction, TeamMember, Message, News, CollectionLog, Plant, SystemError } from '../types';
import { MOCK_PESTICIDES } from '../constants';
import { db as firestore, auth, storage } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch, query, where, getDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const backgroundSyncGlobal = async (collectionName: string, data: any) => {
  const user = auth.currentUser;
  if (!user) return;

  const cleanData = sanitizeForFirestore(data);
  const docRef = doc(firestore, FS_ROOT, FS_ORG, collectionName, data.id);
  
  return setDoc(docRef, cleanData, { merge: true })
    .catch((error) => {
        console.error(`Global sync failed for ${collectionName}:`, error instanceof Error ? error.message : safeStringify(error));
    });
};

const backgroundDeleteGlobal = async (collectionName: string, id: string) => {
  return deleteDoc(doc(firestore, FS_ROOT, FS_ORG, collectionName, id))
    .catch((error) => {
        console.error(`Global delete failed for ${collectionName}:`, error instanceof Error ? error.message : safeStringify(error));
    });
};

const addSystemErrorInternal = async (error: SystemError) => {
  const db = await initDB();
  await db.put('systemErrors', error);
  // User's own path
  backgroundSync('systemErrors', error);
  // Global path for admin
  backgroundSyncGlobal('system_errors', error);
};

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
      tenantId: user?.tenantId,
      providerInfo: user?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Firestore Error: ', safeStringify(errInfo));

  // Log to central errors if not already logging an error (to prevent infinite loops)
  const isInternalError = path && (path.includes('system_errors') || path.includes('systemErrors'));
  if (!isInternalError) {
    addSystemErrorInternal({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source: `Firestore:${operationType}${path ? `:${path}` : ''}`,
      message: errorMessage,
      userEmail: user?.email || 'Bilinmiyor'
    }).catch(() => {});
  }

  // Don't throw if it's a background sync, just log
  if (operationType === OperationType.WRITE || operationType === OperationType.DELETE) {
    console.warn(`Background operation failed: ${operationType} on ${path}`);
  } else {
    throw new Error(safeStringify(errInfo));
  }
}

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
  news: {
    key: string;
    value: News;
    indexes: { 'by-date': string };
  };
  collectionLogs: {
    key: string;
    value: CollectionLog;
    indexes: { 'by-farmer': string };
  };
  plants: {
    key: string;
    value: Plant;
  };
  systemErrors: {
    key: string;
    value: SystemError;
  };
}

const DB_NAME = 'agri-engineer-db';
const DB_VERSION = 24;

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
      if (!db.objectStoreNames.contains('news')) {
        const newsStore = db.createObjectStore('news', { keyPath: 'id' });
        newsStore.createIndex('by-date', 'date');
      }
      if (!db.objectStoreNames.contains('collectionLogs')) {
        const logStore = db.createObjectStore('collectionLogs', { keyPath: 'id' });
        logStore.createIndex('by-farmer', 'farmerId');
      }
      if (!db.objectStoreNames.contains('plants')) {
        db.createObjectStore('plants', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('systemErrors')) {
        db.createObjectStore('systemErrors', { keyPath: 'id' });
      }
    },
  });
};

/**
 * Arka planda Firestore ile senkronize eder. 
 * Hata alsa bile yerel işlem başarılı sayılır.
 */
const backgroundSync = async (collectionName: string, data: any) => {
  const user = auth.currentUser;
  if (!user) return;

  const cleanData = sanitizeForFirestore(data);
  const path = [FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, data.id].join("/");

  return setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, data.id), cleanData, { merge: true })
    .catch(err => handleFirestoreError(err, OperationType.WRITE, path));
};

const backgroundDelete = async (collectionName: string, id: string) => {
  const user = auth.currentUser;
  if (!user) return;
  const path = [FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, id].join("/");

  return deleteDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, id))
    .catch(err => handleFirestoreError(err, OperationType.DELETE, path));
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
            handleFirestoreError(error, OperationType.WRITE, `${FS_ROOT}/${FS_ORG}/${FS_USERS}/${uid}`);
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
      console.error("Error fetching all users:", error instanceof Error ? error.message : safeStringify(error));
      return [];
    }
  },

  async updateUserSubscription(uid: string, updates: Partial<UserProfile>) {
    if (!navigator.onLine) return;
    try {
      await requireAdmin();
      await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid), sanitizeForFirestore(updates), { merge: true });
    } catch (error) {
      console.error("Error updating user subscription:", error instanceof Error ? error.message : safeStringify(error));
      throw error;
    }
  },

  async deleteUser(uid: string) {
    if (!navigator.onLine) return;
    try {
      await requireAdmin();
      await deleteDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid));
    } catch (error) {
      console.error("Error deleting user profile:", error instanceof Error ? error.message : safeStringify(error));
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
    const collections = ["farmers", "notifications", "visits", "prescriptions", "reminders", "inventory", "payments", "manualDebts", "suppliers", "supplierPurchases", "supplierPayments", "myPayments", "expenses", "accounts", "transactions", "teamMembers", "messages", "collectionLogs", "plants"] as const;

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
    const stores = ['farmers', 'visits', 'prescriptions', 'notifications', 'reminders', 'inventory', 'payments', 'manualDebts', 'suppliers', 'supplierPurchases', 'supplierPayments', 'myPayments', 'expenses', 'accounts', 'transactions', 'teamMembers', 'messages', 'collectionLogs', 'plants', 'systemErrors'] as const;
    for (const store of stores) await db.clear(store);
    localStorage.removeItem('mks_user_profile');
  },

  async addSystemError(error: SystemError) {
    await addSystemErrorInternal(error);
  },

  async getSystemErrors() {
    const db = await initDB();
    const errors = await db.getAll('systemErrors');
    return errors.sort((a, b) => b.timestamp - a.timestamp);
  },

  async getGlobalSystemErrors() {
    if (!navigator.onLine) return [];
    try {
      await requireAdmin();
      const path = [FS_ROOT, FS_ORG, "system_errors"].join("/");
      const snap = await getDocs(collection(firestore, path));
      return snap.docs.map(d => ({ ...d.data() as SystemError, id: d.id }))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("Error fetching global system errors:", error);
      return [];
    }
  },

  async deleteSystemError(id: string) {
    const db = await initDB();
    await db.delete('systemErrors', id);
    backgroundDelete('systemErrors', id);
    // Also try to delete from global if exists
    backgroundDeleteGlobal('system_errors', id);
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

        // 3. Reçeteleri çek
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

  async updateGlobalPesticide(pesticide: Pesticide) {
    const db = await initDB();
    await db.put('pesticides', pesticide);
    if (navigator.onLine) {
        const cleanPesticide = sanitizeForFirestore(pesticide);
        try {
            await setDoc(doc(firestore, 'pesticides', pesticide.id), cleanPesticide, { merge: true });
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `pesticides/${pesticide.id}`);
        }
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
    return visits.filter(v => !v.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    const list = await db.getAllFromIndex('prescriptions', 'by-farmer', farmerId);
    return list.filter(p => !p.deletedAt);
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
    return (await db.getAll('inventory'))
      .filter(item => !item.deletedAt)
      .sort((a, b) => a.pesticideName.localeCompare(b.pesticideName, 'tr'));
  },

  async getAllInventoryRaw() {
    const db = await initDB();
    return await db.getAll('inventory');
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
    const item = await db.get('inventory', id);
    if (item) {
      const updatedItem = { ...item, deletedAt: new Date().toISOString() };
      await db.put('inventory', updatedItem);
      backgroundSync('inventory', updatedItem);
    }
  },

  async restoreInventoryItem(id: string) {
    const db = await initDB();
    const item = await db.get('inventory', id);
    if (item) {
      const updatedItem = { ...item, deletedAt: undefined };
      const syncData = { ...updatedItem, deletedAt: null }; 
      await db.put('inventory', updatedItem);
      backgroundSync('inventory', syncData);
    }
  },

  async permanentlyDeleteInventoryItem(id: string) {
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
            ...existing, // Sustain deletedAt if it exists
            id: existing?.id || crypto.randomUUID(),
            pesticideId: pestId,
            pesticideName: pesticideName || 'Bilinmeyen İlaç',
            category: category,
            quantity: existing ? existing.quantity : 0, // Don't use 1000 ghost quantity
            unit: existing?.unit || 'Adet',
            buyingPrice: existing?.buyingPrice || 0,
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
        
        const qtyStr = String(item.quantity).replace(',', '.');
        const qty = parseFloat(qtyStr);
        if (isNaN(qty) || qty === 0) continue;

        const isReturn = prescription.type === 'RETURN';
        const qtyMultiplier = isReturn ? 1 : -1;

        const existingIndex = allInventory.findIndex(i => i.pesticideId === item.pesticideId);
        
        if (existingIndex !== -1) {
            const existingItem = allInventory[existingIndex];
            const updatedItem = {
                ...existingItem,
                quantity: existingItem.quantity + (qty * qtyMultiplier),
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
                quantity: qty * qtyMultiplier,
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
        
        const qtyStr = String(item.quantity).replace(',', '.');
        const qty = parseFloat(qtyStr);
        if (isNaN(qty) || qty === 0) continue;

        const isReturn = prescription.type === 'RETURN';
        const qtyMultiplier = isReturn ? -1 : 1;

        const existingIndex = allInventory.findIndex(i => i.pesticideId === item.pesticideId);
        
        if (existingIndex !== -1) {
            const existingItem = allInventory[existingIndex];
            const updatedItem = {
                ...existingItem,
                quantity: existingItem.quantity + (qty * qtyMultiplier),
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
    const list = await db.getAllFromIndex('payments', 'by-farmer', farmerId);
    return list.filter(p => !p.deletedAt);
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
    const list = await db.getAllFromIndex('manualDebts', 'by-farmer', farmerId);
    return list.filter(d => !d.deletedAt);
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

  async updateInventoryFromPurchase(purchase: SupplierPurchase, isRevert: boolean = false) {
    const db = await initDB();
    const tx = db.transaction('inventory', 'readwrite');
    const store = tx.objectStore('inventory');
    const index = store.index('by-pesticide');
    const updates: InventoryItem[] = [];

    const items = purchase.items || [];
    for (const item of items) {
      // Use index to get the inventory item faster
      let existing = await index.get(item.pesticideId);
      
      const qtyStr = String(item.quantity || '0').replace(',', '.');
      const quantityChange = parseFloat(qtyStr) || 0;
      
      if (isNaN(quantityChange)) {
          console.warn('Skipping item with invalid quantity:', item);
          continue;
      }
      
      const isReturnOrSale = purchase.type === 'RETURN' || purchase.note?.startsWith('SATIŞ') || quantityChange < 0;
      // Force sign based on type if needed, but here we trust the sign if it's already consistent
      const effectiveQtyChange = isReturnOrSale ? -Math.abs(quantityChange) : Math.abs(quantityChange);
      
      if (existing) {
        const currentQty = Number(existing.quantity) || 0;
        const newQuantity = currentQty + (isRevert ? -effectiveQtyChange : effectiveQtyChange);
        
        const updatedItem = {
          ...existing,
          quantity: isNaN(newQuantity) ? currentQty : newQuantity,
          buyingPrice: isRevert ? (existing.buyingPrice || 0) : (parseFloat(String(item.buyingPrice || '0').replace(',', '.')) || (existing.buyingPrice || 0)),
          sellingPrice: (isRevert || !item.sellingPrice) ? (existing.sellingPrice || 0) : (parseFloat(String(item.sellingPrice || '0').replace(',', '.')) || (existing.sellingPrice || 0)),
          lastUpdated: new Date().toISOString()
        };
        await store.put(updatedItem);
        updates.push(updatedItem);
      } else if (!isRevert) {
        // Create new inventory item if it doesn't exist and we are not reverting
        const buyingPrice = parseFloat(String(item.buyingPrice || '0').replace(',', '.')) || 0;
        const sellingPrice = item.sellingPrice ? (parseFloat(String(item.sellingPrice || '0').replace(',', '.')) || buyingPrice * 1.2) : buyingPrice * 1.2;
        
        const newItem: InventoryItem = {
          id: crypto.randomUUID(),
          pesticideId: item.pesticideId,
          pesticideName: item.pesticideName,
          category: PesticideCategory.OTHER,
          quantity: effectiveQtyChange,
          unit: item.unit || 'Adet',
          buyingPrice,
          sellingPrice,
          lastUpdated: new Date().toISOString()
        };
        await store.put(newItem);
        updates.push(newItem);
      }
    }
    await tx.done;
    // Perform background syncs in parallel without blocking the main flow too much (though we await all if possible)
    if (updates.length > 0) {
        Promise.all(updates.map(item => backgroundSync('inventory', item))).catch(() => {});
    }
  },

  async getSupplierPurchases(supplierId?: string) {
    const db = await initDB();
    if (!supplierId) {
      return db.getAll('supplierPurchases');
    }
    return db.getAllFromIndex('supplierPurchases', 'by-supplier', supplierId);
  },

  async getSupplierPurchaseById(id: string) {
    const db = await initDB();
    return db.get('supplierPurchases', id);
  },

  async getSupplierPayments(supplierId?: string) {
    const db = await initDB();
    if (!supplierId) {
      return db.getAll('supplierPayments');
    }
    return db.getAllFromIndex('supplierPayments', 'by-supplier', supplierId);
  },

  async addSupplierPurchase(purchase: SupplierPurchase) {
    const db = await initDB();
    await db.put('supplierPurchases', purchase);
    await backgroundSync('supplierPurchases', purchase);
    return purchase.id;
  },

  async updateSupplierPurchase(purchase: SupplierPurchase) {
    const db = await initDB();
    await db.put('supplierPurchases', purchase);
    // Non-blocking sync
    backgroundSync('supplierPurchases', purchase).catch(() => {});
    return purchase.id;
  },

  async deleteSupplierPurchase(id: string) {
    const db = await initDB();
    await db.delete('supplierPurchases', id);
    await backgroundDelete('supplierPurchases', id);
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

  // News Methods
  async getNews() {
    const db = await initDB();
    const list = await db.getAll('news');
    return list.filter(n => !n.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async addNews(news: News) {
    const db = await initDB();
    await db.put('news', news);
    
    const user = auth.currentUser;
    if (user) {
      const path = `${FS_ROOT}/${FS_ORG}/news/${news.id}`;
      try {
        await setDoc(doc(firestore, path), sanitizeForFirestore(news));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  async updateNews(news: News) {
    const db = await initDB();
    await db.put('news', news);
    
    const user = auth.currentUser;
    if (user) {
      const path = `${FS_ROOT}/${FS_ORG}/news/${news.id}`;
      try {
        await setDoc(doc(firestore, path), sanitizeForFirestore(news));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  async deleteNews(id: string) {
    const db = await initDB();
    const news = await db.get('news', id);
    if (news) {
      const updated = { ...news, deletedAt: new Date().toISOString() };
      await db.put('news', updated);
      
      const user = auth.currentUser;
      if (user) {
        const path = `${FS_ROOT}/${FS_ORG}/news/${id}`;
        try {
          await setDoc(doc(firestore, path), sanitizeForFirestore(updated));
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, path);
        }
      }
    }
  },

  async syncNews() {
    const user = auth.currentUser;
    if (!user) return;

    const path = `${FS_ROOT}/${FS_ORG}/news`;
    try {
      const q = query(collection(firestore, path));
      const snapshot = await getDocs(q);
      const db = await initDB();
      const tx = db.transaction('news', 'readwrite');
      for (const doc of snapshot.docs) {
        await tx.store.put(doc.data() as News);
      }
      await tx.done;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async sendMessage(message: Message) {
    const db = await initDB();
    await db.put('messages', message);
    backgroundSync('messages', message);
    return message.id;
  },

  async getCollectionLogs(): Promise<CollectionLog[]> {
    const db = await initDB();
    return db.getAll('collectionLogs');
  },

  async getPlants(): Promise<Plant[]> {
    const db = await initDB();
    const all = await db.getAll('plants');
    return all.filter(p => !p.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  },

  async addPlant(plant: Plant): Promise<void> {
    const db = await initDB();
    await db.put('plants', plant);
    backgroundSync('plants', plant);
  },

  async updatePlant(plant: Plant): Promise<void> {
    const db = await initDB();
    await db.put('plants', plant);
    backgroundSync('plants', plant);
  },

  async deletePlant(id: string): Promise<void> {
    const db = await initDB();
    const existing = await db.get('plants', id);
    if (existing) {
      const updated = { ...existing, deletedAt: new Date().toISOString() };
      await db.put('plants', updated);
      backgroundSync('plants', updated);
    }
  },

  async permanentlyDeletePlant(id: string): Promise<void> {
    const db = await initDB();
    await db.delete('plants', id);
    backgroundDelete('plants', id);
  },

  async getAllPlantsRaw(): Promise<Plant[]> {
    const db = await initDB();
    return db.getAll('plants');
  },

  async addCollectionLog(log: CollectionLog) {
    const db = await initDB();
    await db.put('collectionLogs', log);
    backgroundSync('collectionLogs', log);
  },

  async updateCollectionLog(log: CollectionLog) {
    const db = await initDB();
    await db.put('collectionLogs', log);
    backgroundSync('collectionLogs', log);
  },

  async deleteCollectionLog(id: string) {
    const db = await initDB();
    await db.delete('collectionLogs', id);
    backgroundDelete('collectionLogs', id);
  },

  /**
   * Yüklenen bir PDF'i Firebase Storage'a yükler ve indirme bağlantısını döndürür.
   * WhatsApp paylaşımı vb. için kullanılır.
   */
  async uploadPdf(file: Blob, path: string): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error("Oturum açılmadı.");
    
    // Yolu org/users/uid/pdfs/.. yapısına yerleştir.
    const fullPath = `${FS_ROOT}/${FS_ORG}/users/${user.uid}/pdfs/${path}`;
    const storageRef = ref(storage, fullPath);
    
    await uploadBytes(storageRef, file, { contentType: 'application/pdf' });
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  },

  /**
   * Gerçek zamanlı senkronizasyon için Firestore dinleyicilerini kurar.
   * Diğer cihazlardan gelen değişiklikleri yerel veritabanına yansıtır.
   */
  setupRealtimeSync(uid: string, onSync: () => void, onProfileSync?: (profile: UserProfile) => void) {
    const userPath = [FS_ROOT, FS_ORG, FS_USERS, uid].join("/");
    const collections = ["farmers", "notifications", "visits", "prescriptions", "reminders", "inventory", "payments", "manualDebts", "suppliers", "supplierPurchases", "supplierPayments", "myPayments", "expenses", "accounts", "transactions", "teamMembers", "messages", "collectionLogs", "plants"] as const;
    
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
        const db = await initDB();
        const tx = db.transaction(col, 'readwrite');
        
        for (const change of snapshot.docChanges()) {
          // Sadece yerel yazma işlemi (pending write) olmayan dökümanları işle.
          // Bu, yerel optimistik güncellemelerin Firestore'dan gelen eski verilerle ezilmesini önler.
          if (change.doc.metadata.hasPendingWrites) continue;

          if (change.type === 'added' || change.type === 'modified') {
            await tx.store.put(change.doc.data() as any);
          } else if (change.type === 'removed') {
            await tx.store.delete(change.doc.id);
          }
        }
        
        await tx.done;
        onSync(); // UI'ı bilgilendir
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `${userPath}/${col}`);
      });
      
      unsubscribes.push(unsub);
    });

    // Haberler Dinleyicisi (Global/Organizasyon Geneli)
    const newsPath = [FS_ROOT, FS_ORG, "news"].join("/");
    const newsQuery = collection(firestore, newsPath);
    const newsUnsub = onSnapshot(newsQuery, async (snapshot) => {
      const db = await initDB();
      const tx = db.transaction('news', 'readwrite');
      
      for (const change of snapshot.docChanges()) {
        if (change.doc.metadata.hasPendingWrites) continue;

        if (change.type === 'added' || change.type === 'modified') {
          await tx.store.put(change.doc.data() as any);
        } else if (change.type === 'removed') {
          await tx.store.delete(change.doc.id);
        }
      }
      
      await tx.done;
      onSync();
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, newsPath);
    });
    unsubscribes.push(newsUnsub);

    return () => unsubscribes.forEach(unsub => unsub());
  },

  async testConnection() {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const path = [FS_ROOT, FS_ORG, FS_USERS, user.uid].join("/");
      await getDocFromServer(doc(firestore, path));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
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

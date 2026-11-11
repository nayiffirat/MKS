
import { safeStringify } from '../utils/json';
import { openDB, DBSchema } from 'idb';
import { Farmer, Pesticide, VisitLog, Prescription, PrescriptionItem, AppNotification, UserProfile, Reminder, InventoryItem, InventoryBatch, PesticideCategory, Payment, ManualDebt, Supplier, SupplierPurchase, SupplierPayment, MyPayment, TurnoverLog, Expense, Account, Transaction, TeamMember, Message, News, CollectionLog, Plant, SystemError, PortalShareSnapshot, SavedMapFeature, SatelliteCacheRecord, SyncOutboxEntry, PrescriptionTemplate, PortalInquiry, MinistryShipmentRecord, MinistryRecord } from '../types';
import { MOCK_PESTICIDES } from '../constants';
import { db as firestore, auth, storage } from './firebase';
import { doc, setDoc, deleteDoc, deleteField, collection, getDocs, getDocsFromServer, writeBatch, query, where, getDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { generatePortalToken, hashSecret, isHashedSecret } from '../utils/crypto';
import { generateUUID } from '../utils/uuid';
import { round2, normalizeGtin } from '../utils/dateUtils';

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
      id: generateUUID(),
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

export interface AgriDB extends DBSchema {
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
  siloTransactions: {
    key: string;
    value: import('../types').SiloTransaction;
    indexes: { 'by-date': string, 'by-product': string };
  };
  siloContacts: {
    key: string;
    value: import('../types').SiloContact;
  };
  syncOutbox: {
    key: string;
    value: SyncOutboxEntry;
  };
  mapFeatures: {
    key: string;
    value: SavedMapFeature;
  };
  satelliteCache: {
    key: string;
    value: SatelliteCacheRecord;
    indexes: { 'by-field': string };
  };
  prescriptionTemplates: {
    key: string;
    value: PrescriptionTemplate;
  };
  ministryShipments: {
    key: string;
    value: MinistryShipmentRecord;
    indexes: { 'by-date': string; 'by-sscc': string };
  };
  ministryRecords: {
    key: string;
    value: MinistryRecord;
    indexes: { 'by-date': string; 'by-prescription': string };
  };
  counters: {
    key: string;
    value: { id: string; value: number; updatedAt: string };
  };
  edmData: {
    key: string;
    value: { id: string; data: any; updatedAt: string };
  };
}

const getDBName = () => {
    const uid = localStorage.getItem('lastUserId');
    return uid ? `agri-engineer-db-${uid}` : 'agri-engineer-db';
};
const DB_VERSION = 30;

const USER_SYNC_COLLECTIONS = [
  "farmers", "notifications", "visits", "prescriptions", "reminders",
  "inventory", "payments", "manualDebts", "suppliers", "supplierPurchases",
  "supplierPayments", "myPayments", "turnoverLogs", "expenses", "accounts",
  "transactions", "teamMembers", "messages", "collectionLogs", "plants",
  "siloTransactions", "siloContacts", "mapFeatures", "prescriptionTemplates",
  "ministryShipments", "ministryRecords"
] as const;

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

const dbPromiseCache = new Map<string, Promise<import('idb').IDBPDatabase<AgriDB>>>();

export const initDB = async () => {
  const dbName = getDBName();
  const cached = dbPromiseCache.get(dbName);
  if (cached) return cached;

  const openPromise = openDB<AgriDB>(dbName, DB_VERSION, {
    blocked() {
      console.warn("IndexedDB upgrade blocked by another tab.");
    },
    blocking(_currentVersion, _blockedVersion, event) {
      // Safely close old handle instead of forcing an infinite window.location.reload() loop
      console.warn("IndexedDB blocking an upgrade. Closing old handle...");
      try {
        (event?.target as IDBDatabase | undefined)?.close?.();
      } catch {}
      dbPromiseCache.delete(dbName);
    },
    terminated() {
      dbPromiseCache.delete(dbName);
    },
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
      if (!db.objectStoreNames.contains('siloTransactions')) {
        const siloStore = db.createObjectStore('siloTransactions', { keyPath: 'id' });
        siloStore.createIndex('by-date', 'date');
        siloStore.createIndex('by-product', 'product');
      }
      if (!db.objectStoreNames.contains('siloContacts')) {
        db.createObjectStore('siloContacts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncOutbox')) {
        db.createObjectStore('syncOutbox', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('mapFeatures')) {
        db.createObjectStore('mapFeatures', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('satelliteCache')) {
        const satStore = db.createObjectStore('satelliteCache', { keyPath: 'id' });
        satStore.createIndex('by-field', 'fieldId');
      }
      if (!db.objectStoreNames.contains('prescriptionTemplates')) {
        db.createObjectStore('prescriptionTemplates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('ministryShipments')) {
        const shipStore = db.createObjectStore('ministryShipments', { keyPath: 'id' });
        shipStore.createIndex('by-date', 'date');
        shipStore.createIndex('by-sscc', 'sscc');
      }
      if (!db.objectStoreNames.contains('ministryRecords')) {
        const recStore = db.createObjectStore('ministryRecords', { keyPath: 'id' });
        recStore.createIndex('by-date', 'date');
        recStore.createIndex('by-prescription', 'prescriptionId');
      }
      if (!db.objectStoreNames.contains('counters')) {
        db.createObjectStore('counters', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('edmData')) {
        db.createObjectStore('edmData', { keyPath: 'id' });
      }
    },
  }).catch((err) => {
    dbPromiseCache.delete(dbName);
    throw err;
  });

  dbPromiseCache.set(dbName, openPromise);
  return openPromise;
};

const portalRefreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PORTAL_SYNC_COLLECTIONS = new Set(['farmers', 'prescriptions', 'visits', 'payments', 'myPayments', 'manualDebts', 'accounts']);

let outboxRetryTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleOutboxRetry = (delayMs: number) => {
  if (typeof window === 'undefined') return;
  const clamped = Math.max(1000, Math.min(300_000, delayMs));
  if (outboxRetryTimer) clearTimeout(outboxRetryTimer);
  outboxRetryTimer = setTimeout(() => {
    outboxRetryTimer = null;
    void flushSyncOutboxInternal();
  }, clamped);
};

const enqueueSyncOutbox = async (
  collectionName: string,
  itemId: string,
  payload: any,
  op: 'UPSERT' | 'DELETE' = 'UPSERT',
  queuedAtIso?: string
) => {
  if (
    !collectionName ||
    !itemId ||
    collectionName === 'systemErrors' ||
    collectionName === 'syncOutbox' ||
    collectionName === 'satelliteCache' ||
    collectionName === 'counters' ||
    collectionName === 'edmData'
  ) {
    return;
  }
  try {
    const db = await initDB();
    const updatedAt = queuedAtIso || payload?.lastUpdated || new Date().toISOString();
    const key = `${collectionName}:${itemId}`;
    const existing = await db.get('syncOutbox', key);
    // Never overwrite a newer queued mutation with an older write
    if (existing?.updatedAt && existing.updatedAt > updatedAt) {
      return;
    }
    const { _syncedFromCloud: _ignored, ...rawPayload } = (payload && typeof payload === 'object') ? payload : {};
    const entry: SyncOutboxEntry & { ownerUid?: string; lastError?: string } = {
      id: key,
      collection: collectionName,
      itemId,
      op,
      payload: sanitizeForFirestore(rawPayload),
      updatedAt,
      retryCount: existing?.retryCount || 0,
      ownerUid: auth.currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('lastUserId') || undefined : undefined)
    };
    await db.put('syncOutbox', entry);
  } catch (err) {
    console.error('CRITICAL enqueueSyncOutbox failure:', err);
    throw err;
  }
};

const markOutboxRetryFailure = async (collectionName: string, itemId: string, err: unknown) => {
  try {
    const db = await initDB();
    const key = `${collectionName}:${itemId}`;
    const current = (await db.get('syncOutbox', key)) as (SyncOutboxEntry & { lastError?: string }) | undefined;
    const retryCount = (current?.retryCount || 0) + 1;
    if (current) {
      await db.put('syncOutbox', {
        ...current,
        retryCount,
        lastError: err instanceof Error ? err.message : String(err)
      } as SyncOutboxEntry);
    }
    const backoffMs = Math.min(300_000, 2000 * Math.pow(2, Math.min(retryCount, 7)));
    if (typeof navigator === 'undefined' || navigator.onLine) {
      scheduleOutboxRetry(backoffMs);
    }
  } catch (updateErr) {
    console.warn('markOutboxRetryFailure warning:', updateErr);
  }
};

const dequeueSyncOutbox = async (collectionName: string, itemId: string, expectedUpdatedAt?: string) => {
  try {
    const db = await initDB();
    const key = `${collectionName}:${itemId}`;
    if (expectedUpdatedAt) {
      const current = await db.get('syncOutbox', key);
      if (current && current.updatedAt && current.updatedAt > expectedUpdatedAt) {
        // A newer edit arrived while the previous write was in flight — keep the newer outbox entry!
        return;
      }
    }
    await db.delete('syncOutbox', key);
  } catch (err) {
    console.warn('dequeueSyncOutbox warning:', err);
  }
};

let isFlushingOutbox = false;
let recheckOutboxAfterFlush = false;
const flushSyncOutboxInternal = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;
  if (isFlushingOutbox) {
    recheckOutboxAfterFlush = true;
    return;
  }
  isFlushingOutbox = true;
  let minNextBackoffMs: number | null = null;
  try {
    const db = await initDB();
    const pending = (await db.getAll('syncOutbox')) as (SyncOutboxEntry & { ownerUid?: string; lastError?: string })[];
    for (const entry of pending) {
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) break;
      if (entry.ownerUid && entry.ownerUid !== user.uid) continue;
      try {
        const cleanData = sanitizeForFirestore(
          entry.payload || { id: entry.itemId, deletedAt: new Date().toISOString(), lastUpdated: new Date().toISOString() }
        );
        await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, entry.collection, entry.itemId), cleanData, { merge: true });
        await dequeueSyncOutbox(entry.collection, entry.itemId, entry.updatedAt);
      } catch (err) {
        const nextRetryCount = (entry.retryCount || 0) + 1;
        const backoff = Math.min(300_000, 2000 * Math.pow(2, Math.min(nextRetryCount, 7)));
        minNextBackoffMs = minNextBackoffMs === null ? backoff : Math.min(minNextBackoffMs, backoff);
        try {
          await db.put('syncOutbox', {
            ...entry,
            retryCount: nextRetryCount,
            lastError: err instanceof Error ? err.message : String(err)
          } as SyncOutboxEntry);
        } catch (putErr) {
          console.warn('Failed updating outbox retry metadata:', putErr);
        }
        console.warn(`Outbox retry #${nextRetryCount} deferred for ${entry.id}:`, err);
      }
    }

    // Also flush pending offline profile update if any
    const pendingProfileSync = localStorage.getItem(`mks_pending_profile_sync_${user.uid}`);
    if (pendingProfileSync === '1') {
      const rawLocal = localStorage.getItem('mks_user_profile');
      if (rawLocal) {
        try {
          const parsed = JSON.parse(rawLocal) as UserProfile;
          if (!parsed.uid || parsed.uid === user.uid) {
            await dbServiceObj.saveUserProfile(user.uid, parsed);
            localStorage.removeItem(`mks_pending_profile_sync_${user.uid}`);
          }
        } catch (profErr) {
          console.warn('Pending profile sync deferred:', profErr);
          minNextBackoffMs = minNextBackoffMs === null ? 5000 : Math.min(minNextBackoffMs, 5000);
        }
      }
    }
  } finally {
    isFlushingOutbox = false;
    if (recheckOutboxAfterFlush) {
      recheckOutboxAfterFlush = false;
      scheduleOutboxRetry(1000);
    } else if (minNextBackoffMs !== null && (typeof navigator === 'undefined' || navigator.onLine)) {
      scheduleOutboxRetry(minNextBackoffMs);
    }
  }
};

export const flushSyncOutboxNow = (): Promise<void> => flushSyncOutboxInternal();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushSyncOutboxInternal().catch((e) => console.warn('Online outbox flush warning:', e));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushSyncOutboxInternal().catch((e) => console.warn('Visibility outbox flush warning:', e));
    }
  });
}

const schedulePortalShareRefreshIfActive = (collectionName: string, data: any) => {
  if (!PORTAL_SYNC_COLLECTIONS.has(collectionName) || !data) return;
  if (collectionName === 'accounts') {
    return;
  }
  const targetFarmerId: string | undefined = collectionName === 'farmers' ? data.id : data.farmerId;
  if (!targetFarmerId) return;

  const existing = portalRefreshTimers.get(targetFarmerId);
  if (existing) clearTimeout(existing);

  portalRefreshTimers.set(
    targetFarmerId,
    setTimeout(async () => {
      portalRefreshTimers.delete(targetFarmerId);
      try {
        const db = await initDB();
        const farmer = await db.get('farmers', targetFarmerId);
        if (farmer && farmer.portalToken && !farmer.deletedAt) {
          await dbServiceObj.publishFarmerPortalShare(targetFarmerId, false);
        }
      } catch {
        // Non-blocking background portal refresh
      }
    }, 1200)
  );
};

/**
 * Write-ahead zero-data-loss sync:
 * 1. Stamps local copy without mutating caller's object in-place.
 * 2. Writes to syncOutbox FIRST so weak rural signal or app close never loses the mutation.
 * 3. Fires Firestore write asynchronously (`void`) without blocking UI, dequeuing on ACK or scheduling exponential backoff.
 */
const backgroundSync = async (collectionName: string, data: any, opts?: { preserveLastUpdated?: boolean }) => {
  if (!data || !data.id) return;
  const mutationIso = opts?.preserveLastUpdated && data.lastUpdated ? String(data.lastUpdated) : new Date().toISOString();
  const { _syncedFromCloud: _ignored, ...cleanInput } = data;
  const stamped = { ...cleanInput, lastUpdated: mutationIso };

  try {
    const db = await initDB();
    if (db.objectStoreNames.contains(collectionName as any)) {
      await db.put(collectionName as any, stamped);
    }
  } catch (putErr) {
    console.error(`Local IndexedDB put failed in backgroundSync (${collectionName}/${stamped.id}):`, putErr);
    if (collectionName !== 'systemErrors') {
      addSystemErrorInternal({
        id: generateUUID(),
        timestamp: Date.now(),
        source: `IndexedDB:put:${collectionName}`,
        message: putErr instanceof Error ? putErr.message : String(putErr),
        userEmail: auth.currentUser?.email || 'Bilinmiyor'
      }).catch(() => {});
    }
  }

  await enqueueSyncOutbox(collectionName, stamped.id, stamped, 'UPSERT', mutationIso);
  schedulePortalShareRefreshIfActive(collectionName, stamped);

  const user = auth.currentUser;
  if (!user || !navigator.onLine) {
    return;
  }

  const cleanData = sanitizeForFirestore(stamped);
  const path = [FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, stamped.id].join("/");

  void setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, stamped.id), cleanData, { merge: true })
    .then(async () => {
      await dequeueSyncOutbox(collectionName, stamped.id, mutationIso);
      try {
        const markDb = await initDB();
        if (markDb.objectStoreNames.contains(collectionName as any)) {
          const latestLocal = await markDb.get(collectionName as any, stamped.id) as any;
          if (latestLocal && (!latestLocal.lastUpdated || latestLocal.lastUpdated <= mutationIso)) {
            await markDb.put(collectionName as any, { ...latestLocal, _syncedFromCloud: true });
          }
        }
      } catch {}
    })
    .catch(async (err) => {
      await markOutboxRetryFailure(collectionName, stamped.id, err);
      handleFirestoreError(err, OperationType.WRITE, path);
    });
};

const backgroundDelete = async (collectionName: import('idb').StoreNames<import('./db').AgriDB>, id: string) => {
  const db = await initDB();
  const nowIso = new Date().toISOString();
  const item = await db.get(collectionName, id) as any;
  if (item) {
    const tombstone = { ...item, deletedAt: nowIso, lastUpdated: nowIso };
    delete tombstone._syncedFromCloud;
    await db.put(collectionName, tombstone);
    await backgroundSync(collectionName, tombstone, { preserveLastUpdated: true });
    return;
  }

  const tombstone = { id, deletedAt: nowIso, lastUpdated: nowIso };
  await enqueueSyncOutbox(collectionName, id, tombstone, 'DELETE', nowIso);

  const user = auth.currentUser;
  if (!user || !navigator.onLine) {
    return;
  }
  const path = [FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, id].join("/");
  void setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, id), tombstone, { merge: true })
    .then(() => dequeueSyncOutbox(collectionName, id, nowIso))
    .catch(async (err) => {
      await markOutboxRetryFailure(collectionName, id, err);
      handleFirestoreError(err, OperationType.WRITE, path);
    });
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

const ensureInventoryBatches = (item: InventoryItem): InventoryBatch[] => {
  if (Array.isArray(item.batches) && item.batches.length > 0) {
    return item.batches
      .map(b => ({
        lotNumber: String(b.lotNumber || 'GENEL').trim() || 'GENEL',
        expiryDate: b.expiryDate,
        quantity: round2(Number(b.quantity) || 0),
        serialNumbers: b.serialNumbers?.filter(Boolean).length ? Array.from(new Set(b.serialNumbers.filter(Boolean))) : undefined,
        receivedAt: b.receivedAt
      }))
      .filter(b => b.quantity > 0);
  }
  const legacyQty = round2(Number(item.quantity) || 0);
  if (legacyQty > 0 && (item.lotNumber || item.expiryDate || item.serialNumber)) {
    return [{
      lotNumber: String(item.lotNumber || 'GENEL').trim() || 'GENEL',
      expiryDate: item.expiryDate,
      quantity: legacyQty,
      serialNumbers: item.serialNumber ? [item.serialNumber] : undefined,
      receivedAt: item.lastUpdated || new Date().toISOString()
    }];
  }
  return [];
};

const compareBatchFefo = (a: InventoryBatch, b: InventoryBatch): number => {
  const aExp = a.expiryDate ? Date.parse(a.expiryDate) : Number.POSITIVE_INFINITY;
  const bExp = b.expiryDate ? Date.parse(b.expiryDate) : Number.POSITIVE_INFINITY;
  const safeA = Number.isFinite(aExp) ? aExp : Number.POSITIVE_INFINITY;
  const safeB = Number.isFinite(bExp) ? bExp : Number.POSITIVE_INFINITY;
  if (safeA !== safeB) return safeA - safeB;
  const aRec = a.receivedAt ? Date.parse(a.receivedAt) : 0;
  const bRec = b.receivedAt ? Date.parse(b.receivedAt) : 0;
  return (Number.isFinite(aRec) ? aRec : 0) - (Number.isFinite(bRec) ? bRec : 0);
};

const addBatchStock = (
  batches: InventoryBatch[],
  opts: { lotNumber?: string; expiryDate?: string; quantity: number; serialNumbers?: string[]; receivedAt?: string }
): InventoryBatch[] => {
  const addQty = round2(Math.max(0, Number(opts.quantity) || 0));
  if (addQty <= 0) return batches;
  const next = batches.map(b => ({
    ...b,
    serialNumbers: b.serialNumbers ? [...b.serialNumbers] : undefined
  }));
  const lot = (opts.lotNumber || '').trim();
  const serials = (opts.serialNumbers || []).map(s => String(s).trim()).filter(Boolean);
  if (!lot && !opts.expiryDate && serials.length === 0 && next.length === 0) {
    return next;
  }
  const targetLot = lot || 'GENEL';
  const targetLotKey = targetLot.toLocaleLowerCase('tr-TR');
  const existingIdx = next.findIndex(
    b => b.lotNumber.trim().toLocaleLowerCase('tr-TR') === targetLotKey &&
      (!opts.expiryDate || !b.expiryDate || b.expiryDate === opts.expiryDate)
  );
  if (existingIdx !== -1) {
    const existing = next[existingIdx];
    const mergedSerials = Array.from(new Set([...(existing.serialNumbers || []), ...serials]));
    next[existingIdx] = {
      ...existing,
      expiryDate: existing.expiryDate || opts.expiryDate,
      quantity: round2(existing.quantity + addQty),
      serialNumbers: mergedSerials.length > 0 ? mergedSerials : undefined
    };
  } else {
    next.push({
      lotNumber: targetLot,
      expiryDate: opts.expiryDate,
      quantity: addQty,
      serialNumbers: serials.length > 0 ? Array.from(new Set(serials)) : undefined,
      receivedAt: opts.receivedAt || new Date().toISOString()
    });
  }
  return next.filter(b => b.quantity > 0).sort(compareBatchFefo);
};

const deductBatchStock = (
  batches: InventoryBatch[],
  opts: {
    quantity: number;
    lotNumber?: string;
    serialNumbers?: string[];
    batchAllocations?: PrescriptionItem['batchAllocations'];
  }
): InventoryBatch[] => {
  if (batches.length === 0) return [];
  const next = batches
    .map(b => ({
      ...b,
      quantity: round2(Math.max(0, Number(b.quantity) || 0)),
      serialNumbers: b.serialNumbers ? [...b.serialNumbers] : undefined
    }))
    .filter(b => b.quantity > 0)
    .sort(compareBatchFefo);

  const soldSerials = new Set(
    [
      ...(opts.serialNumbers || []),
      ...((opts.batchAllocations || []).flatMap(a => a.serialNumbers || []))
    ]
      .map(s => String(s).trim())
      .filter(Boolean)
  );
  if (soldSerials.size > 0) {
    for (const b of next) {
      if (b.serialNumbers && b.serialNumbers.length > 0) {
        const filtered = b.serialNumbers.filter(s => !soldSerials.has(s));
        b.serialNumbers = filtered.length > 0 ? filtered : undefined;
      }
    }
  }

  const totalQty = round2(Math.max(0, Number(opts.quantity) || 0));
  let remaining = totalQty;
  if (opts.batchAllocations && opts.batchAllocations.length > 0) {
    let allocatedSum = 0;
    let shortfall = 0;
    for (const alloc of opts.batchAllocations) {
      const allocQty = round2(Math.max(0, Number(alloc.quantity) || 0));
      if (allocQty <= 0) continue;
      allocatedSum = round2(allocatedSum + allocQty);
      const lotKey = String(alloc.lotNumber || '').trim().toLocaleLowerCase('tr-TR');
      const target = next.find(b => b.lotNumber.trim().toLocaleLowerCase('tr-TR') === lotKey && b.quantity > 0);
      if (target) {
        const take = Math.min(target.quantity, allocQty);
        target.quantity = round2(target.quantity - take);
        if (allocQty > take) shortfall = round2(shortfall + (allocQty - take));
      } else {
        shortfall = round2(shortfall + allocQty);
      }
    }
    const unallocated = Math.max(0, round2(totalQty - allocatedSum));
    remaining = round2(shortfall + unallocated);
  }
  if (remaining > 0 && opts.lotNumber) {
    const lotKey = opts.lotNumber.trim().toLocaleLowerCase('tr-TR');
    for (const b of next) {
      if (remaining <= 0) break;
      if (b.lotNumber.trim().toLocaleLowerCase('tr-TR') === lotKey && b.quantity > 0) {
        const take = Math.min(b.quantity, remaining);
        b.quantity = round2(b.quantity - take);
        remaining = round2(remaining - take);
      }
    }
  }

  for (const b of next) {
    if (remaining <= 0) break;
    if (b.quantity > 0) {
      const take = Math.min(b.quantity, remaining);
      b.quantity = round2(b.quantity - take);
      remaining = round2(remaining - take);
    }
  }

  return next.filter(b => b.quantity > 0.0001).sort(compareBatchFefo);
};

const applyBatchesToInventoryItem = (item: InventoryItem, batches: InventoryBatch[]): InventoryItem => {
  const active = batches.filter(b => round2(b.quantity) > 0).sort(compareBatchFefo);
  return {
    ...item,
    batches: active.length > 0 ? active : undefined,
    lotNumber: active[0]?.lotNumber ?? item.lotNumber,
    expiryDate: active[0]?.expiryDate ?? item.expiryDate,
    revision: (Number(item.revision) || 0) + 1
  };
};

const sanitizeCanonicalBarcode = (rawBarcode?: string, rawGtin?: string): { barcode?: string; gtin?: string } => {
  const cleanGtin = normalizeGtin(rawGtin || rawBarcode) || undefined;
  let cleanBarcode: string | undefined;
  if (rawBarcode) {
    const trimmed = String(rawBarcode).trim();
    const hasGs1Delimiters = /[\x1d()]/.test(trimmed) || trimmed.length > 18;
    cleanBarcode = hasGs1Delimiters ? cleanGtin : trimmed;
  } else {
    cleanBarcode = cleanGtin;
  }
  return { barcode: cleanBarcode, gtin: cleanGtin };
};

const dbServiceObj = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    let cachedLocal: UserProfile | null = null;
    try {
      const local = localStorage.getItem('mks_user_profile');
      if (local) {
        const parsed = JSON.parse(local);
        if (!parsed.uid || parsed.uid === uid) {
          delete parsed.password;
          cachedLocal = parsed;
        }
      }
    } catch {}

    const email = auth.currentUser?.email || cachedLocal?.email || '';
    const isRootAdmin = email === 'nayiffirat@gmail.com';

    if (navigator.onLine) {
        try {
            const snap = await Promise.race([
              getDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid)),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
            ]);
            if (snap && snap.exists()) {
                const cloudData = snap.data() as UserProfile & { password?: string };
                const { password: _legacyPassword, ...safeCloudData } = cloudData;
                const localTs = cachedLocal?.lastUpdate ? new Date(cachedLocal.lastUpdate).getTime() : 0;
                const cloudTs = safeCloudData.lastUpdate ? new Date(safeCloudData.lastUpdate).getTime() : 0;
                const hasPendingOfflineProfile = localStorage.getItem(`mks_pending_profile_sync_${uid}`) === '1' && localTs > cloudTs;

                const resolvedTheme = hasPendingOfflineProfile
                  ? (cachedLocal?.theme || safeCloudData.theme || 'TECHNICAL')
                  : (safeCloudData.theme || cachedLocal?.theme || 'TECHNICAL');
                const resolvedColorMode = hasPendingOfflineProfile
                  ? (cachedLocal?.colorMode || safeCloudData.colorMode || 'DARK')
                  : (safeCloudData.colorMode || cachedLocal?.colorMode || 'DARK');
                const resolvedLang = hasPendingOfflineProfile
                  ? (cachedLocal?.language || safeCloudData.language || 'tr')
                  : (safeCloudData.language || cachedLocal?.language || 'tr');

                const profile: UserProfile = {
                  ...(hasPendingOfflineProfile ? { ...safeCloudData, ...cachedLocal } : safeCloudData),
                  uid,
                  theme: resolvedTheme,
                  colorMode: resolvedColorMode,
                  language: resolvedLang,
                };
                
                if (isRootAdmin) {
                  profile.role = 'admin';
                  profile.subscriptionStatus = 'active';
                  profile.subscriptionTier = 'MAX';
                  if (!profile.subscriptionEndsAt || new Date(profile.subscriptionEndsAt) < new Date('2090-01-01')) {
                    profile.subscriptionEndsAt = '2099-12-31T23:59:59.000Z';
                  }
                  profile.subscriptionEndsAtMs = new Date(profile.subscriptionEndsAt).getTime();
                } else if (!profile.subscriptionStatus) {
                  profile.role = profile.role || 'user';
                  profile.subscriptionStatus = 'trial';
                  profile.subscriptionTier = profile.subscriptionTier || 'PRO';
                  const endDate = new Date();
                  endDate.setDate(endDate.getDate() + 7);
                  profile.subscriptionEndsAt = endDate.toISOString();
                  profile.subscriptionEndsAtMs = endDate.getTime();
                  this.saveUserProfile(uid, profile).catch(() => {});
                } else if (profile.subscriptionEndsAt && !profile.subscriptionEndsAtMs) {
                  profile.subscriptionEndsAtMs = new Date(profile.subscriptionEndsAt).getTime();
                }

                if (hasPendingOfflineProfile) {
                  this.saveUserProfile(uid, profile).then(() => {
                    localStorage.removeItem(`mks_pending_profile_sync_${uid}`);
                  }).catch(() => {});
                }
                
                localStorage.setItem('mks_user_profile', safeStringify(profile));
                return profile;
            } else if (snap) {
                // New user profile creation (unified 7-day trial for standard users, V8 Gece default)
                const endDate = new Date();
                if (isRootAdmin) {
                  endDate.setFullYear(2099);
                } else {
                  endDate.setDate(endDate.getDate() + 7); // 7 days trial
                }

                const newProfile: UserProfile = {
                  uid,
                  email,
                  createdAt: new Date().toISOString(),
                  lastLoginAt: new Date().toISOString(),
                  lastUpdate: new Date().toISOString(),
                  fullName: auth.currentUser?.displayName || cachedLocal?.fullName || '',
                  phoneNumber: cachedLocal?.phoneNumber || '',
                  companyName: cachedLocal?.companyName || '',
                  title: cachedLocal?.title || 'Ziraat Mühendisi',
                  role: isRootAdmin ? 'admin' : 'user',
                  subscriptionStatus: isRootAdmin ? 'active' : 'trial',
                  subscriptionTier: isRootAdmin ? 'MAX' : 'PRO',
                  subscriptionEndsAt: endDate.toISOString(),
                  subscriptionEndsAtMs: endDate.getTime(),
                  theme: 'TECHNICAL',
                  colorMode: 'DARK',
                  language: cachedLocal?.language || 'tr'
                };
                await this.saveUserProfile(uid, newProfile).catch(() => {});
                localStorage.setItem('mks_user_profile', safeStringify(newProfile));
                return newProfile;
            }
        } catch (e) {
            console.warn("Cloud getUserProfile fallback to local:", e);
        }
    }

    if (cachedLocal) {
      if (isRootAdmin) {
        cachedLocal.role = 'admin';
        cachedLocal.subscriptionStatus = 'active';
        cachedLocal.subscriptionTier = 'MAX';
        cachedLocal.subscriptionEndsAt = '2099-12-31T23:59:59.000Z';
        cachedLocal.subscriptionEndsAtMs = new Date(cachedLocal.subscriptionEndsAt).getTime();
      }
      return cachedLocal;
    }

    return null;
  },

  async saveUserProfile(uid: string, profile: UserProfile) {
    const nowIso = new Date().toISOString();
    const safeLocalProfile: any = { ...profile, uid, lastUpdate: nowIso };
    delete safeLocalProfile.password;
    if (safeLocalProfile.adminPassword && !isHashedSecret(safeLocalProfile.adminPassword)) {
      safeLocalProfile.adminPassword = await hashSecret(safeLocalProfile.adminPassword);
    }
    localStorage.setItem('mks_user_profile', safeStringify(safeLocalProfile));

    if (!navigator.onLine) {
        localStorage.setItem(`mks_pending_profile_sync_${uid}`, '1');
        return;
    }

    if (navigator.onLine) {
        try {
            const profileToSave: any = { ...safeLocalProfile };
            delete profileToSave.password;

            // Prevent privilege escalation
            const user = auth.currentUser;
            const isRootAdmin = user?.email === 'nayiffirat@gmail.com';
            
            let hadLegacyPassword = false;
            if (!isRootAdmin) {
                const snap = await getDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid));
                if (snap.exists()) {
                    const existingRaw = snap.data() as any;
                    hadLegacyPassword = 'password' in existingRaw;
                    const existingProfile = existingRaw as UserProfile;
                    // Preserve sensitive billing & role fields
                    profileToSave.role = existingProfile.role || 'user';
                    profileToSave.subscriptionStatus = existingProfile.subscriptionStatus || 'trial';
                    profileToSave.subscriptionTier = existingProfile.subscriptionTier || 'PRO';
                    profileToSave.subscriptionEndsAt = existingProfile.subscriptionEndsAt;
                    profileToSave.subscriptionEndsAtMs = existingProfile.subscriptionEndsAtMs;
                } else {
                    // Prevent setting admin/active status or custom end date on creation
                    profileToSave.role = 'user';
                    profileToSave.subscriptionStatus = 'trial';
                    profileToSave.subscriptionTier = 'PRO';
                    const endDate = new Date();
                    endDate.setDate(endDate.getDate() + 7);
                    profileToSave.subscriptionEndsAt = endDate.toISOString();
                    profileToSave.subscriptionEndsAtMs = endDate.getTime();
                }
            } else if (profileToSave.subscriptionEndsAt) {
                profileToSave.subscriptionEndsAtMs = new Date(profileToSave.subscriptionEndsAt).getTime();
            }

            const cleanProfile: any = sanitizeForFirestore({ 
                ...profileToSave, 
                lastUpdate: nowIso,
                lastLoginAt: new Date().toISOString(),
                email: (auth.currentUser?.email || profileToSave.email || '').toLowerCase()
            });
            if (hadLegacyPassword) {
                cleanProfile.password = deleteField();
            }
            await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid), cleanProfile, { merge: true });
            localStorage.removeItem(`mks_pending_profile_sync_${uid}`);

            // Sync phone login directory entry if phone is valid TR mobile
            const rawPhoneKey = String(profileToSave.phoneNumber || '').replace(/\D/g, '').slice(-10);
            const activeEmail = auth.currentUser?.email || profileToSave.email;
            if (/^5\d{9}$/.test(rawPhoneKey) && activeEmail && user?.uid === uid) {
              setDoc(
                doc(firestore, FS_ROOT, FS_ORG, 'phone_directory', rawPhoneKey),
                { uid, email: activeEmail, updatedAt: new Date().toISOString() },
                { merge: true }
              ).catch(() => {});
            }
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
      const snap = await getDocsFromServer(collection(firestore, FS_ROOT, FS_ORG, FS_USERS));
      return snap.docs.map(d => {
        const raw = d.data() as any;
        delete raw.password;
        return { ...(raw as UserProfile), uid: d.id };
      });
    } catch (error) {
      console.error("Error fetching all users:", error instanceof Error ? error.message : safeStringify(error));
      return [];
    }
  },

  async updateUserSubscription(uid: string, updates: Partial<UserProfile>) {
    if (!navigator.onLine) return;
    try {
      await requireAdmin();
      const safeUpdates: any = { ...updates };
      delete safeUpdates.password;
      if (safeUpdates.subscriptionEndsAt) {
        safeUpdates.subscriptionEndsAtMs = new Date(safeUpdates.subscriptionEndsAt).getTime();
      }
      const cleanPayload = {
        ...sanitizeForFirestore(safeUpdates),
        password: deleteField()
      };
      await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid), cleanPayload, { merge: true });
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

  async flushSyncOutboxNow(): Promise<void> {
    await flushSyncOutboxInternal();
  },

  async getPendingOutboxCount(targetUid?: string): Promise<number> {
    try {
      const db = await initDB();
      const uid = targetUid || auth.currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('lastUserId') || undefined : undefined);
      const entries = (await db.getAll('syncOutbox')) as (SyncOutboxEntry & { ownerUid?: string })[];
      const relevant = entries.filter(e => !uid || !e.ownerUid || e.ownerUid === uid);
      const pendingProfile = uid && typeof localStorage !== 'undefined' && localStorage.getItem(`mks_pending_profile_sync_${uid}`) === '1' ? 1 : 0;
      return relevant.length + pendingProfile;
    } catch {
      return 0;
    }
  },

  async clearLocalData() {
    const db = await initDB();
    const collections = [...USER_SYNC_COLLECTIONS, "pesticides", "syncOutbox", "satelliteCache", "systemErrors", "counters", "edmData"] as const;
    for (const col of collections) {
      if (db.objectStoreNames.contains(col as any)) {
        const tx = db.transaction(col as any, 'readwrite');
        await tx.store.clear();
        await tx.done;
      }
    }
    // Also clear localStorage profile & scoped caches
    const uid = localStorage.getItem('lastUserId');
    localStorage.removeItem('mks_user_profile');
    localStorage.removeItem('userProfile'); // fallback
    localStorage.removeItem('lastUserId');
    if (uid) {
      localStorage.removeItem(`mks_pending_profile_sync_${uid}`);
      localStorage.removeItem(`mks_map_features_${uid}`);
      localStorage.removeItem(`mks_ministry_records_v1_${uid}`);
      localStorage.removeItem(`mks_ministry_shipments_v1_${uid}`);
    }
    console.log("Local IndexedDB cleared.");
  },

  /**
   * Kullanıcının hem buluttaki (Firestore) tüm verilerini hem de yerel
   * cihazdaki (IndexedDB, localStorage) verilerini tamamen ve kalıcı olarak siler.
   */
  async deleteAllUserData(uid: string) {
    if (!uid) return;
    const userPath = [FS_ROOT, FS_ORG, FS_USERS, uid].join("/");
    const collections = [
      ...USER_SYNC_COLLECTIONS, "systemErrors"
    ] as const;

    // 1. Buluttaki (Firestore) tüm dökümanları sil
    for (const col of collections) {
      try {
        const colRef = collection(firestore, userPath, col);
        const snapshot = await getDocsFromServer(colRef);
        if (!snapshot.empty) {
          const batchSize = 400;
          let batch = writeBatch(firestore);
          let count = 0;
          for (const document of snapshot.docs) {
            batch.delete(document.ref);
            count++;
            if (count >= batchSize) {
              await batch.commit();
              batch = writeBatch(firestore);
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }
        }
      } catch (e) {
        console.error(`Firestore wipe collection ${col} error:`, e);
      }
    }

    // 2. Kullanıcı profil belgesini sıfırla (mevcut rol ve abonelik bilgilerini koruyarak)
    try {
      const userDocRef = doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid);
      const existingSnap = await getDoc(userDocRef);
      const existingData = existingSnap.exists() ? (existingSnap.data() as UserProfile) : null;
      const isRootAdmin = auth.currentUser?.email === 'nayiffirat@gmail.com';
      const defaultEnd = new Date();
      if (isRootAdmin) defaultEnd.setFullYear(2099);
      else defaultEnd.setDate(defaultEnd.getDate() + 7);

      await setDoc(userDocRef, {
        uid: uid,
        email: auth.currentUser?.email || existingData?.email || '',
        fullName: existingData?.fullName || auth.currentUser?.displayName || 'İsimsiz Kullanıcı',
        role: existingData?.role || (isRootAdmin ? 'admin' : 'user'),
        subscriptionStatus: existingData?.subscriptionStatus || (isRootAdmin ? 'active' : 'trial'),
        subscriptionEndsAt: existingData?.subscriptionEndsAt || defaultEnd.toISOString(),
        createdAt: existingData?.createdAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Firestore user doc reset error:", e);
    }

    // 3. Yerel veritabanını (IndexedDB) tamamen temizle
    try {
      await this.clearLocalUserData(true);
      await this.clearLocalData();
    } catch (e) {
      console.error("IndexedDB wipe error:", e);
    }

    // 4. LocalStorage önbelleğini temizle
    localStorage.clear();
  },

  /**
   * Giriş yapıldığında tüm verileri çeker ve yerelle birleştirir.
   */
  async syncAllDataOnLogin(uid: string) {
    if (!navigator.onLine) return;
    // First flush any pending offline writes from syncOutbox
    await flushSyncOutboxInternal().catch(() => {});

    const db = await initDB();
    const userPath = [FS_ROOT, FS_ORG, FS_USERS, uid].join("/");
    const collections = USER_SYNC_COLLECTIONS;
    const outboxEntries = await db.getAll('syncOutbox').catch(() => []);
    const pendingOutboxKeys = new Set(outboxEntries.map(e => e.id));

    for (const col of collections) {
      try {
        const snap = await getDocsFromServer(collection(firestore, userPath, col));
        const data = snap.docs.map(d => d.data());
        const serverIds = new Set(snap.docs.map(d => d.id));
        
        const tx = db.transaction(col, 'readwrite');
        const localItems = await tx.store.getAll();
        const localMap = new Map<string, any>();
        for (const li of localItems) {
          if (li && li.id) localMap.set(li.id, li);
        }

        const offlineItemsToUpload: any[] = [];

        // 1. Merge server items with local DB (protecting local soft-deletes, outbox & newer edits)
        if (data.length > 0) {
          const putPromises: Promise<any>[] = [];
          for (const serverItem of data as any[]) {
            if (!serverItem || !serverItem.id) continue;
            const localItem = localMap.get(serverItem.id);
            if (localItem) {
              if (pendingOutboxKeys.has(`${col}:${serverItem.id}`)) {
                offlineItemsToUpload.push(localItem);
                continue;
              }
              const localTime = localItem.lastUpdated ? new Date(localItem.lastUpdated).getTime() : 0;
              const serverTime = serverItem.lastUpdated ? new Date(serverItem.lastUpdated).getTime() : 0;
              // AK-21: If locally soft-deleted, only keep local delete if localTime >= serverTime.
              // If another device explicitly restored/updated it AFTER local delete, accept server version!
              if (localItem.deletedAt && !serverItem.deletedAt) {
                if (serverTime > localTime) {
                  putPromises.push(tx.store.put({ ...serverItem, _syncedFromCloud: true }));
                  continue;
                }
                offlineItemsToUpload.push(localItem);
                continue;
              }
              // If local item has a newer lastUpdated timestamp, keep local version and push to server
              if (localTime > serverTime) {
                offlineItemsToUpload.push(localItem);
                continue;
              }
            }
            putPromises.push(tx.store.put({ ...serverItem, _syncedFromCloud: true }));
          }
          if (putPromises.length > 0) {
            await Promise.all(putPromises);
          }
        }
        
        // 2. D-08: NEVER hard-delete local items missing from server — rely strictly on `deletedAt` tombstones!
        // Any local item not yet present on Firestore (offline creation, imported backup, etc.) is queued for upload.
        for (const localItem of localItems) {
          if (localItem && localItem.id && !serverIds.has(localItem.id)) {
            offlineItemsToUpload.push(localItem);
          }
        }
        
        await tx.done;

        // 3. Upload offline-created/modified items to Firestore
        for (const offItem of offlineItemsToUpload) {
          try {
            const { _syncedFromCloud: _ignoredFlag, ...rawItem } = offItem as any;
            const cleanData = sanitizeForFirestore(rawItem);
            await setDoc(doc(firestore, userPath, col, offItem.id), cleanData, { merge: true });
            await dequeueSyncOutbox(col, offItem.id, offItem.lastUpdated);
            const markDb = await initDB();
            await markDb.put(col as any, { ...offItem, _syncedFromCloud: true });
          } catch (uploadErr) {
            await enqueueSyncOutbox(col, offItem.id, offItem, offItem.deletedAt ? 'DELETE' : 'UPSERT', offItem.lastUpdated);
            console.warn(`Sync upload failed for offline item in ${col}:`, uploadErr);
          }
        }
      } catch (e: any) {
        console.error(`Error syncing collection ${col}:`, e);
      }
    }

    // Reconcile and audit accounts and transactions after cloud sync
    await dbService.reconcileAccountBalances();
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
        try {
            const snapshot = await getDocs(collection(firestore, 'pesticides'));
            if (!snapshot.empty) {
                const cloudData = snapshot.docs.map(d => d.data() as Pesticide);
                const tx = db.transaction('pesticides', 'readwrite');
                const localKeys = await tx.store.getAllKeys();
                await Promise.all(cloudData.map(p => tx.store.put(p)));
                const serverIds = new Set(snapshot.docs.map(d => d.id));
                for (const localKey of localKeys) {
                    if (!serverIds.has(localKey as string)) {
                        await tx.store.delete(localKey);
                    }
                }
                await tx.done;
            }
        } catch {}
    }
  },

  
  async exportData() {
    const db = await initDB();
    const stores = [...USER_SYNC_COLLECTIONS];
    const exportObj: Record<string, any> = {};
    for (const store of stores) {
        const rows = await db.getAll(store as any);
        exportObj[store] = rows.map((row: any) => {
            if (!row || typeof row !== 'object') return row;
            const { _syncedFromCloud: _ignored, ...clean } = row;
            return clean;
        });
    }
    return JSON.stringify(exportObj);
  },

  async importData(jsonData: string) {
    const data = JSON.parse(jsonData);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Geçersiz yedek dosyası formatı.');
    }
    const db = await initDB();
    const stores = Object.keys(data);
    const validStores = stores.filter(
        store => store !== 'syncOutbox' && db.objectStoreNames.contains(store as any) && Array.isArray(data[store])
    );
    const syncableSet = new Set<string>(USER_SYNC_COLLECTIONS as readonly string[]);
    const nowIso = new Date().toISOString();
    const ownerUid = auth.currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('lastUserId') || undefined : undefined);

    const tx = db.transaction([...validStores, 'syncOutbox'] as any, 'readwrite');
    const outboxStore = tx.objectStore('syncOutbox');
    await outboxStore.clear();

    for (const store of validStores) {
        const os = tx.objectStore(store as any);
        await os.clear();
        for (const rawItem of data[store]) {
            if (!rawItem || typeof rawItem !== 'object' || !rawItem.id) continue;
            const { _syncedFromCloud: _ignored, ...cleanItem } = rawItem;
            const stamped = {
                ...cleanItem,
                lastUpdated: cleanItem.lastUpdated || nowIso
            };
            await os.put(stamped);
            if (syncableSet.has(store)) {
                const outboxEntry: SyncOutboxEntry & { ownerUid?: string } = {
                    id: `${store}:${stamped.id}`,
                    collection: store,
                    itemId: stamped.id,
                    op: stamped.deletedAt ? 'DELETE' : 'UPSERT',
                    payload: sanitizeForFirestore(stamped),
                    updatedAt: stamped.lastUpdated,
                    retryCount: 0,
                    ownerUid
                };
                await outboxStore.put(outboxEntry);
            }
        }
    }
    await tx.done;

    // Flush imported records to Firestore before returning so immediate reload doesn't abort writes
    await flushSyncOutboxInternal();
  },

  async clearLocalUserData(force = false) {
    await flushSyncOutboxInternal().catch(() => {});
    if (!force) {
      const pending = await this.getPendingOutboxCount().catch(() => 0);
      if ((typeof navigator !== 'undefined' && !navigator.onLine) || pending > 0) {
        // Defer destructive wipe so AuthContext.logout() can ask user confirmation first (AK-01)
        return;
      }
    }
    const db = await initDB();
    const stores = [...USER_SYNC_COLLECTIONS, 'systemErrors', 'syncOutbox', 'satelliteCache', 'counters', 'edmData'] as const;
    for (const store of stores) {
      if (db.objectStoreNames.contains(store as any)) {
        await db.clear(store as any);
      }
    }
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
    await backgroundDelete('systemErrors', id);
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
   * Çiftçi için güvenli, izole Üretici Portalı paylaşım özetini (/MKS/{org}/portal_shares/{portalToken}) oluşturur/günceller.
   * Alış fiyatları (buyingPrice), TC Kimlik No ve diğer üreticilerin verileri kesinlikle bu belgede yer almaz.
   */
  async publishFarmerPortalShare(farmerId: string, createTokenIfMissing = true): Promise<string | null> {
    const user = auth.currentUser;
    const db = await initDB();
    const farmer = await db.get('farmers', farmerId);
    if (!farmer || farmer.deletedAt) return null;

    let token = farmer.portalToken;
    if (!token || token.length < 16) {
      if (!createTokenIfMissing) return null;
      token = generatePortalToken();
      farmer.portalToken = token;
      await db.put('farmers', farmer);
      if (user) {
        setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, 'farmers', farmer.id), sanitizeForFirestore(farmer), { merge: true }).catch(() => {});
      }
    }

    if (!user || !navigator.onLine) {
      return token;
    }

    try {
      const [allPrescriptions, allVisits, allPayments, allMyPayments, allDebts, allAccounts] = await Promise.all([
        db.getAllFromIndex('prescriptions', 'by-farmer', farmerId),
        db.getAllFromIndex('visits', 'by-farmer', farmerId),
        db.getAll('payments'),
        db.getAll('myPayments'),
        db.getAll('manualDebts'),
        db.getAll('accounts')
      ]);

      let localProfile: Partial<UserProfile> = {};
      try {
        localProfile = JSON.parse(localStorage.getItem('mks_user_profile') || '{}');
      } catch {}

      const bankAccounts = allAccounts
        .filter(acc => !acc.deletedAt && acc.type === 'BANK' && acc.iban && acc.iban.trim().length > 5)
        .map(acc => ({
          name: acc.name,
          iban: acc.iban!.trim(),
          accountHolder: acc.accountHolder || localProfile.companyName || localProfile.fullName || ''
        }));

      const sanitizedFields = (farmer.fields || []).map(fld => ({
        id: fld.id,
        name: fld.name,
        size: Number(fld.size) || 0,
        crop: fld.crop || '',
        plantingDate: fld.plantingDate,
        mahalle: fld.mahalle || fld.tkgmMahalle,
        ada: fld.ada || fld.tkgmAda,
        parsel: fld.parsel || fld.tkgmParsel,
        lat: fld.lat ?? fld.centroidLat ?? fld.centroid?.lat,
        lng: fld.lng ?? fld.centroidLng ?? fld.centroid?.lon
      }));

      const sanitizedPrescriptions = allPrescriptions
        .filter(p => !p.deletedAt)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(p => ({
          id: p.id,
          prescriptionNo: p.prescriptionNo,
          date: p.date,
          totalAmount: p.totalAmount,
          priceType: p.priceType,
          type: p.type,
          items: (p.items || []).map(item => ({
            pesticideName: item.pesticideName,
            dosage: item.dosage,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
            // buyingPrice kasıtlı olarak dışarıda bırakıldı (Ticari sır koruması)
          }))
        }));

      const sanitizedVisits = allVisits
        .filter(v => !v.deletedAt)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(v => ({
          id: v.id,
          date: v.date,
          note: v.note || ''
        }));

      const bouncedRelatedPaymentIds = new Set(
        allMyPayments
          .filter(mp => !mp.deletedAt && mp.relatedId && (mp.portfolioStatus === 'BOUNCED' || mp.status === 'CANCELLED'))
          .map(mp => mp.relatedId!)
      );

      const regularPayments = allPayments
        .filter(p => p.farmerId === farmerId && !p.deletedAt && !bouncedRelatedPaymentIds.has(p.id))
        .map(p => ({
          id: p.id,
          amount: Number(p.amount) || 0,
          date: p.date,
          method: p.method,
          note: p.note || ''
        }));

      const independentMyPayments = allMyPayments
        .filter(p => p.farmerId === farmerId && !p.deletedAt && p.status !== 'CANCELLED' && p.portfolioStatus !== 'BOUNCED' && !p.relatedId)
        .map(p => ({
          id: p.id,
          amount: Number(p.amount) || 0,
          date: p.issueDate,
          method: p.type,
          note: p.note || ''
        }));

      const sanitizedDebts = allDebts
        .filter(d => d.farmerId === farmerId && !d.deletedAt && !String(d.id || '').startsWith('turnover-'))
        .map(d => ({
          id: d.id,
          amount: Number(d.amount) || 0,
          date: d.date,
          note: d.note || ''
        }));

      const snapshot: PortalShareSnapshot = {
        portalToken: token,
        engineerId: user.uid,
        farmerId: farmer.id,
        updatedAt: new Date().toISOString(),
        engineerProfile: {
          fullName: localProfile.fullName || user.displayName || 'Ziraat Mühendisi',
          companyName: localProfile.companyName || 'MKS Dijital Tarım',
          phoneNumber: localProfile.phoneNumber || '',
          currency: localProfile.currency || 'TRY',
          bankAccounts
        },
        farmer: {
          id: farmer.id,
          fullName: farmer.fullName,
          village: farmer.village || '',
          fields: sanitizedFields
          // tcNo ve koordinatlar KVKK kapsamında paylaşılmaz
        },
        prescriptions: sanitizedPrescriptions,
        visits: sanitizedVisits,
        payments: [...regularPayments, ...independentMyPayments],
        manualDebts: sanitizedDebts
      };

      await setDoc(doc(firestore, FS_ROOT, FS_ORG, 'portal_shares', token), sanitizeForFirestore(snapshot));
    } catch (err) {
      console.warn('publishFarmerPortalShare warning:', err);
    }

    return token;
  },

  /**
   * Üretici portalı için güvenli paylaşım belgesinden (/MKS/{org}/portal_shares/{portalToken}) veri çeker.
   * Mühendis kendi hesabından bakıyorsa doğrudan kendi yerel/bulut verisini de okuyabilir.
   */
  async getFarmerPortalData(engineerIdOrEmpty: string, farmerIdOrToken: string, explicitToken?: string) {
    try {
        const candidateToken = (explicitToken || farmerIdOrToken || '').trim();

        // 1. Öncelik: Güvenli Capability Token belgesinden tek sorguda oku (Giriş gerektirmez, diğer verileri ifşa etmez)
        if (candidateToken.length >= 16) {
            try {
                const shareSnap = await getDoc(doc(firestore, FS_ROOT, FS_ORG, 'portal_shares', candidateToken));
                if (shareSnap.exists()) {
                    const share = shareSnap.data() as PortalShareSnapshot;
                    return {
                        farmer: {
                            id: share.farmer.id,
                            fullName: share.farmer.fullName,
                            phoneNumber: '',
                            village: share.farmer.village,
                            fields: (share.farmer.fields || []) as any,
                            portalToken: share.portalToken
                        } as Farmer,
                        prescriptions: (share.prescriptions || []) as any as Prescription[],
                        visits: (share.visits || []) as any as VisitLog[],
                        payments: (share.payments || []) as any as Payment[],
                        manualDebts: (share.manualDebts || []) as any as ManualDebt[],
                        profile: {
                            ...(share.engineerProfile as any),
                            uid: share.engineerId
                        } as UserProfile,
                        portalToken: share.portalToken,
                        engineerId: share.engineerId
                    };
                }
            } catch (tokenErr) {
                console.warn('Portal token lookup fallback:', tokenErr);
            }
        }

        // 2. Yedek: Sadece oturum açmış mühendis kendi çiftçisine bakıyorsa kendi özel koleksiyonundan okuyabilir
        const currentUid = auth.currentUser?.uid;
        if (!engineerIdOrEmpty || currentUid !== engineerIdOrEmpty) {
            return null;
        }

        const userPath = [FS_ROOT, FS_ORG, FS_USERS, engineerIdOrEmpty].join("/");
        const farmerDoc = await getDoc(doc(firestore, userPath, "farmers", farmerIdOrToken));
        if (!farmerDoc.exists()) return null;
        const farmer = farmerDoc.data() as Farmer;
        if (farmer.deletedAt) return null;

        const [pSnap, vSnap, paySnap, myPaySnap, debtSnap, profileDoc] = await Promise.all([
            getDocs(query(collection(firestore, userPath, "prescriptions"), where("farmerId", "==", farmerIdOrToken))),
            getDocs(query(collection(firestore, userPath, "visits"), where("farmerId", "==", farmerIdOrToken))),
            getDocs(query(collection(firestore, userPath, "payments"), where("farmerId", "==", farmerIdOrToken))),
            getDocs(query(collection(firestore, userPath, "myPayments"), where("farmerId", "==", farmerIdOrToken))),
            getDocs(query(collection(firestore, userPath, "manualDebts"), where("farmerId", "==", farmerIdOrToken))),
            getDoc(doc(firestore, userPath))
        ]);

        const prescriptions = pSnap.docs.map(d => d.data() as Prescription).filter(p => !p.deletedAt);
        const visits = vSnap.docs.map(d => d.data() as VisitLog).filter(v => !v.deletedAt);
        const regularPayments = paySnap.docs.map(d => d.data() as any).filter(p => !p.deletedAt);
        const independentMyPayments = myPaySnap.docs
            .map(d => d.data() as any)
            .filter(p => !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId)
            .map(p => ({ ...p, date: p.issueDate }));
        const payments = [...regularPayments, ...independentMyPayments];
        const manualDebts = debtSnap.docs.map(d => d.data() as any).filter(d => !d.deletedAt && !String(d.id || '').startsWith('turnover-'));
        const profile = profileDoc.exists() ? (profileDoc.data() as UserProfile) : undefined;

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
    await backgroundDelete('farmers', id);
  },
  
  async getPesticides() {
    const db = await initDB();
    const items = await db.getAll('pesticides');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
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
    await backgroundDelete('visits', id);
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
    await backgroundDelete('prescriptions', id);
  },
  
  async getPrescriptionsByFarmer(farmerId: string) {
    const db = await initDB();
    const list = await db.getAllFromIndex('prescriptions', 'by-farmer', farmerId);
    return list.filter(p => !p.deletedAt);
  },
  
  async getAllPrescriptions() {
    const db = await initDB();
    const items = await db.getAll('prescriptions');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getAllPrescriptionsRaw() {
    const db = await initDB();
    const items = await db.getAll('prescriptions');
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },
  
  async getAllVisits() {
    const db = await initDB();
    const items = await db.getAll('visits');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async getReminders() {
    const db = await initDB();
    const items = await db.getAll('reminders');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
    await backgroundDelete('reminders', id);
  },

  async getNotifications() {
    const db = await initDB();
    const items = await db.getAll('notifications');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    await backgroundDelete('notifications', id);
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
    await backgroundDelete('inventory', id);
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
            id: existing?.id || generateUUID(),
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

  async applyInventoryFixes(fixes: { pesticideId: string, quantity: number }[]) {
    const db = await initDB();
    const inventory = await db.getAll('inventory');
    
    for (const fix of fixes) {
        const item = inventory.find(i => i.pesticideId === fix.pesticideId && !i.deletedAt);
        if (item) {
            const newQty = Number(fix.quantity) || 0;
            const diff = newQty - (Number(item.quantity) || 0);
            item.quantity = newQty;
            item.lastUpdated = new Date().toISOString();
            if (Math.abs(diff) > 0.0001) {
                item.adjustments = [
                    ...(item.adjustments || []),
                    {
                        date: new Date().toISOString(),
                        amount: diff,
                        note: 'Depo Onarım Düzeltmesi'
                    }
                ];
            }
            await db.put('inventory', item);
            backgroundSync('inventory', item);
        }
    }
  },

  async applyFarmerFixes(fixes: { 
      farmerId: string, 
      brokenPrescriptions: {id: string, expected: number, actual: number}[],
      brokenPayments?: {id: string, expected: number, actual: number}[],
      brokenMyPayments?: {id: string, expected: number, actual: number}[],
      brokenManualDebts?: {id: string, expected: number, actual: number}[]
  }[]) {
    const db = await initDB();
    
    // Process Prescriptions
    const txP = db.transaction('prescriptions', 'readwrite');
    const storeP = txP.objectStore('prescriptions');
    const syncQueueP = [];
    for (const fix of fixes) {
        if (!fix.brokenPrescriptions) continue;
        for (const bp of fix.brokenPrescriptions) {
            const p = await storeP.get(bp.id);
            if (p && !p.deletedAt) {
                p.totalAmount = bp.expected;
                await storeP.put(p);
                syncQueueP.push(p);
            }
        }
    }
    await txP.done;
    
    // Process Payments
    const txPay = db.transaction('payments', 'readwrite');
    const storePay = txPay.objectStore('payments');
    const syncQueuePay = [];
    for (const fix of fixes) {
        if (!fix.brokenPayments) continue;
        for (const bp of fix.brokenPayments) {
            const p = await storePay.get(bp.id);
            if (p && !p.deletedAt) {
                p.amount = bp.expected;
                await storePay.put(p);
                syncQueuePay.push(p);
            }
        }
    }
    await txPay.done;

    // Process MyPayments
    const txMyPay = db.transaction('myPayments', 'readwrite');
    const storeMyPay = txMyPay.objectStore('myPayments');
    const syncQueueMyPay = [];
    for (const fix of fixes) {
        if (!fix.brokenMyPayments) continue;
        for (const bp of fix.brokenMyPayments) {
            const p = await storeMyPay.get(bp.id);
            if (p && !p.deletedAt) {
                p.amount = bp.expected;
                await storeMyPay.put(p);
                syncQueueMyPay.push(p);
            }
        }
    }
    await txMyPay.done;

    // Process ManualDebts
    const txMD = db.transaction('manualDebts', 'readwrite');
    const storeMD = txMD.objectStore('manualDebts');
    const syncQueueMD = [];
    for (const fix of fixes) {
        if (!fix.brokenManualDebts) continue;
        for (const bp of fix.brokenManualDebts) {
            const p = await storeMD.get(bp.id);
            if (p && !p.deletedAt) {
                p.amount = bp.expected;
                await storeMD.put(p);
                syncQueueMD.push(p);
            }
        }
    }
    await txMD.done;

    syncQueueP.forEach(p => backgroundSync('prescriptions', p));
    syncQueuePay.forEach(p => backgroundSync('payments', p));
    syncQueueMyPay.forEach(p => backgroundSync('myPayments', p));
    syncQueueMD.forEach(p => backgroundSync('manualDebts', p));
  },

  async analyzeFarmerBalances(): Promise<{
      farmerId: string; 
      farmerName: string; 
      currentBalance: number; 
      calculatedBalance: number; 
      brokenPrescriptions: {id: string, expected: number, actual: number}[];
      brokenPayments: {id: string, expected: number, actual: number}[];
      brokenMyPayments: {id: string, expected: number, actual: number}[];
      brokenManualDebts: {id: string, expected: number, actual: number}[];
  }[]> {
    const db = await initDB();
    const farmers = await db.getAll('farmers');
    const payments = await db.getAll('payments');
    const myPayments = await db.getAll('myPayments');
    const prescriptions = await db.getAll('prescriptions');
    const manualDebts = await db.getAll('manualDebts');

    const results = [];

    for (const farmer of farmers) {
        if (farmer.deletedAt) continue;
        
        let currentTotalDebt = 0;
        let calculatedTotalDebt = 0;
        let currentTotalPaid = 0;
        let calculatedTotalPaid = 0;

        const brokenPayments: {id: string, expected: number, actual: number}[] = [];
        const fPayments = payments.filter(p => !p.deletedAt && p.farmerId === farmer.id);
        for(const p of fPayments) {
            currentTotalPaid += Number(p.amount) || 0;
            
            const trueAmount = parseFloat(String(p.amount).replace(',', '.')) || 0;
            calculatedTotalPaid += Math.abs(trueAmount);

            if (p.amount !== Math.abs(trueAmount) || isNaN(p.amount as any) || typeof p.amount === 'string') {
                brokenPayments.push({id: p.id, expected: Math.abs(trueAmount), actual: p.amount});
            }
        }

        const brokenMyPayments: {id: string, expected: number, actual: number}[] = [];
        const fMyPayments = myPayments.filter(p => !p.deletedAt && p.farmerId === farmer.id && p.status !== 'CANCELLED' && !p.relatedId);
        for(const p of fMyPayments) {
            currentTotalPaid += Number(p.amount) || 0;
            
            const trueAmount = parseFloat(String(p.amount).replace(',', '.')) || 0;
            calculatedTotalPaid += Math.abs(trueAmount);

            if (p.amount !== Math.abs(trueAmount) || isNaN(p.amount as any) || typeof p.amount === 'string') {
                brokenMyPayments.push({id: p.id, expected: Math.abs(trueAmount), actual: p.amount});
            }
        }

        const brokenManualDebts: {id: string, expected: number, actual: number}[] = [];
        const fManualDebts = manualDebts.filter(d => !d.deletedAt && d.farmerId === farmer.id && !d.id.startsWith('turnover-'));
        for(const d of fManualDebts) {
            currentTotalDebt += Number(d.amount) || 0;
            
            let trueAmount = parseFloat(String(d.amount).replace(',', '.')) || 0;
            // Manual debts can be negative if it's a credit, so we keep the sign.
            calculatedTotalDebt += trueAmount;

            if (d.amount !== trueAmount || isNaN(d.amount as any) || typeof d.amount === 'string') {
                brokenManualDebts.push({id: d.id, expected: trueAmount, actual: d.amount});
            }
        }

        const brokenPrescriptions: {id: string, expected: number, actual: number}[] = [];
        const fPrescriptions = prescriptions.filter(p => !p.deletedAt && p.farmerId === farmer.id);
        
        for(const p of fPrescriptions) {
            if (p.priceType === 'CASH') continue;
            
            const amt = Number(p.totalAmount) || 0;
            
            let calculatedAmt = 0;
            for(const item of (p.items || [])) {
                let itemTotal = Number(item.totalPrice) || 0;
                if (!itemTotal) {
                    const price = Number(item.unitPrice) || 0;
                    const qtyStr = String(item.quantity || '0').replace(',', '.');
                    const qty = parseFloat(qtyStr) || 0;
                    itemTotal = price * qty;
                }
                calculatedAmt += itemTotal;
            }
            
            const isReturn = p.type === 'RETURN' || (p.totalAmount !== undefined && Number(p.totalAmount) < 0) || calculatedAmt < 0;
            currentTotalDebt += (isReturn ? -Math.abs(amt) : Math.abs(amt));
            
            const discount = Number(p.discountAmount) || 0;
            let magnitude = Math.abs(calculatedAmt) - discount;
            if (magnitude < 0) magnitude = 0;

            const calcEffectiveDebt = isReturn ? -magnitude : magnitude;
            calculatedTotalDebt += calcEffectiveDebt;

            // Notice we compare the expected totalAmount value structure
            const expectedTotalAmount = isReturn ? -magnitude : magnitude;
            
            if (Math.abs(calcEffectiveDebt - (isReturn ? -Math.abs(amt) : Math.abs(amt))) > 0.01 || typeof p.totalAmount === 'string') {
                brokenPrescriptions.push({id: p.id, expected: expectedTotalAmount, actual: p.totalAmount || 0});
            }
        }

        const currentBalance = currentTotalPaid - currentTotalDebt;
        const calculatedBalance = calculatedTotalPaid - calculatedTotalDebt;

        if (Math.abs(currentBalance - calculatedBalance) > 0.01 || brokenPrescriptions.length > 0 || brokenPayments.length > 0 || brokenMyPayments.length > 0 || brokenManualDebts.length > 0) {
            results.push({
                farmerId: farmer.id,
                farmerName: farmer.fullName,
                currentBalance,
                calculatedBalance,
                brokenPrescriptions,
                brokenPayments,
                brokenMyPayments,
                brokenManualDebts
            });
        }
    }
    return results;
  },

  async analyzeInventoryBalances(): Promise<{pesticideId: string, pesticideName: string, currentQty: number, calculatedQty: number, purchasedQty: number, soldQty: number, adjustedQty: number}[]> {
    const db = await initDB();
    const inventory = await db.getAll('inventory');
    const purchases = await db.getAll('supplierPurchases');
    const prescriptions = await db.getAll('prescriptions');

    const mismatches: {pesticideId: string, pesticideName: string, currentQty: number, calculatedQty: number, purchasedQty: number, soldQty: number, adjustedQty: number}[] = [];

    for (const item of inventory) {
        if (item.deletedAt) continue;
        let purchasedQty = 0;
        let soldQty = 0;

        for (const purchase of purchases) {
            if (purchase.deletedAt) continue;
            if (purchase.isInventoryProcessed === false) continue;
            for (const pItem of (purchase.items || [])) {
                if (pItem.pesticideId === item.pesticideId) {
                    const qty = parseFloat(String(pItem.quantity || '0').replace(',', '.')) || 0;
                    const isSale = purchase.type === 'SALE';
                    const isReturn = purchase.type === 'RETURN';
                    if (isSale || isReturn || qty < 0) {
                        purchasedQty -= Math.abs(qty);
                    } else {
                        purchasedQty += Math.abs(qty);
                    }
                }
            }
        }

        for (const prescription of prescriptions) {
            if (prescription.deletedAt) continue;
            if (!prescription.isInventoryProcessed && prescription.isProcessed === false) continue;
            for (const pItem of (prescription.items || [])) {
                if (pItem.pesticideId === item.pesticideId) {
                    const qty = parseFloat(String(pItem.quantity || '0').replace(',', '.')) || 0;
                    if (prescription.type === 'RETURN') {
                        soldQty -= Math.abs(qty);
                    } else {
                        soldQty += Math.abs(qty);
                    }
                }
            }
        }

        let adjustedQty = 0;
        if (item.adjustments && item.adjustments.length > 0) {
            for (const adj of item.adjustments) {
                adjustedQty += (Number(adj.amount) || 0);
            }
        }

        const calculatedQty = Number((adjustedQty + purchasedQty - soldQty).toFixed(2));
        const currentQty = isNaN(item.quantity) ? 0 : Number((item.quantity || 0).toFixed(2));

        if (isNaN(item.quantity) || Math.abs(currentQty - calculatedQty) > 0.001) {
            mismatches.push({
                pesticideId: item.pesticideId,
                pesticideName: item.pesticideName,
                currentQty,
                calculatedQty,
                purchasedQty: Number(purchasedQty.toFixed(2)),
                soldQty: Number(soldQty.toFixed(2)),
                adjustedQty: Number(adjustedQty.toFixed(2))
            });
        }
    }

    return mismatches;
  },

  async rebuildInventoryBalances() {
    const db = await initDB();
    const inventory = await db.getAll('inventory');
    const purchases = await db.getAll('supplierPurchases');
    const prescriptions = await db.getAll('prescriptions');

    for (const item of inventory) {
        if (item.deletedAt) continue;
        let purchasedQty = 0;
        let soldQty = 0;

        for (const purchase of purchases) {
            if (purchase.deletedAt) continue;
            if (purchase.isInventoryProcessed === false) continue;
            for (const pItem of (purchase.items || [])) {
                if (pItem.pesticideId === item.pesticideId) {
                    const qty = parseFloat(String(pItem.quantity || '0').replace(',', '.')) || 0;
                    const isSale = purchase.type === 'SALE';
                    const isReturn = purchase.type === 'RETURN';
                    if (isSale || isReturn || qty < 0) {
                        purchasedQty -= Math.abs(qty);
                    } else {
                        purchasedQty += Math.abs(qty);
                    }
                }
            }
        }

        for (const prescription of prescriptions) {
            if (prescription.deletedAt) continue;
            if (!prescription.isInventoryProcessed && prescription.isProcessed === false) continue;
            for (const pItem of (prescription.items || [])) {
                if (pItem.pesticideId === item.pesticideId) {
                    const qty = parseFloat(String(pItem.quantity || '0').replace(',', '.')) || 0;
                    if (prescription.type === 'RETURN') {
                        soldQty -= Math.abs(qty);
                    } else {
                        soldQty += Math.abs(qty);
                    }
                }
            }
        }

        let adjustedQty = 0;
        if (item.adjustments && item.adjustments.length > 0) {
            for (const adj of item.adjustments) {
                adjustedQty += (Number(adj.amount) || 0);
            }
        }

        const calculatedQty = Number((adjustedQty + purchasedQty - soldQty).toFixed(2));
        const finalQty = isNaN(calculatedQty) ? 0 : calculatedQty;

        item.quantity = finalQty;
        item.lastUpdated = new Date().toISOString();
        await db.put('inventory', item);
        backgroundSync('inventory', item);
    }
  },

  async processInventory(prescription: Prescription) {
    const db = await initDB();
    const tx = db.transaction(['inventory', 'prescriptions'], 'readwrite');
    const inventoryStore = tx.objectStore('inventory');
    const prescriptionStore = tx.objectStore('prescriptions');

    // AK-16: Re-read prescription inside IDB transaction for true idempotency against double-submit / concurrent calls
    const storedRx = await prescriptionStore.get(prescription.id);
    if (storedRx?.isInventoryProcessed) {
      await tx.done;
      return;
    }
    if (!storedRx && prescription.isInventoryProcessed) {
      await tx.done;
      return;
    }

    const allInventory = await inventoryStore.getAll();
    const inventoryUpdates: InventoryItem[] = [];
    const nowIso = new Date().toISOString();

    for (const item of prescription.items || []) {
      if (!item.quantity) continue;

      const qtyStr = String(item.quantity).replace(',', '.');
      const qty = parseFloat(qtyStr);
      if (!Number.isFinite(qty) || qty === 0) continue;

      const absQty = round2(Math.abs(qty));
      const isReturn = prescription.type === 'RETURN';
      const isQuarantineReturn = isReturn && Boolean(item.quarantineReason);
      const qtyDelta = isReturn ? absQty : -absQty;
      const itemNormGtin = normalizeGtin(item.gtin);

      let existingIndex = allInventory.findIndex(i => i.pesticideId === item.pesticideId && !i.deletedAt);
      if (existingIndex === -1 && itemNormGtin) {
        existingIndex = allInventory.findIndex(
          i => !i.deletedAt && normalizeGtin(i.gtin || i.barcode) === itemNormGtin
        );
      }

      if (existingIndex !== -1) {
        const existingItem = allInventory[existingIndex];
        let updatedItem: InventoryItem;
        if (isQuarantineReturn) {
          updatedItem = {
            ...existingItem,
            quarantineQty: round2((Number(existingItem.quarantineQty) || 0) + absQty),
            quarantineLogs: [
              {
                id: generateUUID(),
                date: nowIso,
                farmerId: prescription.farmerId,
                prescriptionId: prescription.id,
                lotNumber: item.lotNumber || existingItem.lotNumber,
                expiryDate: item.expiryDate || existingItem.expiryDate,
                quantity: absQty,
                reason: item.quarantineReason || 'İade Faturası Karantinası',
                resolved: false
              },
              ...(existingItem.quarantineLogs || [])
            ],
            revision: (Number(existingItem.revision) || 0) + 1,
            lastUpdated: nowIso
          };
        } else {
          const currentBatches = ensureInventoryBatches(existingItem);
          const serialList = [
            ...(item.serialNumbers || []),
            ...(item.serialNumber ? [item.serialNumber] : [])
          ].filter(Boolean);
          const nextBatches = isReturn
            ? addBatchStock(currentBatches, {
                lotNumber: item.lotNumber || existingItem.lotNumber,
                expiryDate: item.expiryDate || existingItem.expiryDate,
                quantity: absQty,
                serialNumbers: serialList,
                receivedAt: nowIso
              })
            : deductBatchStock(currentBatches, {
                quantity: absQty,
                lotNumber: item.lotNumber,
                serialNumbers: serialList,
                batchAllocations: item.batchAllocations
              });
          updatedItem = applyBatchesToInventoryItem(
            {
              ...existingItem,
              gtin: existingItem.gtin || (itemNormGtin || undefined),
              quantity: round2((Number(existingItem.quantity) || 0) + qtyDelta),
              lastUpdated: nowIso
            },
            nextBatches
          );
        }
        await inventoryStore.put(updatedItem);
        allInventory[existingIndex] = updatedItem;
        inventoryUpdates.push(updatedItem);
      } else if (isReturn) {
        // B-15: Never create negative-stock OTHER ghost items for unknown sold pesticides;
        // only allow creating/receiving an item when a customer is returning positive stock/quarantine.
        const serialList = [
          ...(item.serialNumbers || []),
          ...(item.serialNumber ? [item.serialNumber] : [])
        ].filter(Boolean);
        const initialBatches = isQuarantineReturn
          ? []
          : addBatchStock([], {
              lotNumber: item.lotNumber,
              expiryDate: item.expiryDate,
              quantity: absQty,
              serialNumbers: serialList,
              receivedAt: nowIso
            });
        const newItem = applyBatchesToInventoryItem(
          {
            id: generateUUID(),
            pesticideId: item.pesticideId || generateUUID(),
            pesticideName: item.pesticideName,
            category: PesticideCategory.OTHER,
            quantity: isQuarantineReturn ? 0 : absQty,
            quarantineQty: isQuarantineReturn ? absQty : undefined,
            quarantineLogs: isQuarantineReturn
              ? [
                  {
                    id: generateUUID(),
                    date: nowIso,
                    farmerId: prescription.farmerId,
                    prescriptionId: prescription.id,
                    lotNumber: item.lotNumber,
                    expiryDate: item.expiryDate,
                    quantity: absQty,
                    reason: item.quarantineReason || 'İade Faturası Karantinası',
                    resolved: false
                  }
                ]
              : undefined,
            unit: 'Adet',
            buyingPrice: Number(item.buyingPrice) || 0,
            sellingPrice: Number(item.unitPrice) || 0,
            gtin: itemNormGtin || undefined,
            barcode: itemNormGtin || undefined,
            lastUpdated: nowIso
          },
          initialBatches
        );
        await inventoryStore.put(newItem);
        allInventory.push(newItem);
        inventoryUpdates.push(newItem);
      } else {
        console.warn(`[processInventory] Depoda eşleşen ürün bulunamadı, negatif hayalet stok açılmadı: ${item.pesticideName} (${item.pesticideId})`);
      }
    }

    const updatedPrescription: Prescription = {
      ...(storedRx || prescription),
      ...prescription,
      isInventoryProcessed: true,
      isProcessed: true,
      lastUpdated: nowIso
    };
    await prescriptionStore.put(updatedPrescription);

    await tx.done;

    inventoryUpdates.forEach(item => void backgroundSync('inventory', item));
    void backgroundSync('prescriptions', updatedPrescription);
  },

  async revertInventory(prescription: Prescription) {
    const db = await initDB();
    const tx = db.transaction(['inventory', 'prescriptions'], 'readwrite');
    const inventoryStore = tx.objectStore('inventory');
    const prescriptionStore = tx.objectStore('prescriptions');

    // AK-16: Re-read prescription inside IDB transaction for idempotency
    const storedRx = await prescriptionStore.get(prescription.id);
    const effectiveRx = storedRx || prescription;
    if (!effectiveRx.isInventoryProcessed) {
      await tx.done;
      return;
    }

    const allInventory = await inventoryStore.getAll();
    const inventoryUpdates: InventoryItem[] = [];
    const nowIso = new Date().toISOString();

    for (const item of effectiveRx.items || []) {
      if (!item.quantity) continue;

      const qtyStr = String(item.quantity).replace(',', '.');
      const qty = parseFloat(qtyStr);
      if (!Number.isFinite(qty) || qty === 0) continue;

      const absQty = round2(Math.abs(qty));
      const isReturn = effectiveRx.type === 'RETURN';
      const isQuarantineReturn = isReturn && Boolean(item.quarantineReason);
      const qtyDelta = isReturn ? -absQty : absQty;
      const itemNormGtin = normalizeGtin(item.gtin);

      let existingIndex = allInventory.findIndex(i => i.pesticideId === item.pesticideId && !i.deletedAt);
      if (existingIndex === -1 && itemNormGtin) {
        existingIndex = allInventory.findIndex(
          i => !i.deletedAt && normalizeGtin(i.gtin || i.barcode) === itemNormGtin
        );
      }
      // Fallback to soft-deleted inventory item if deleted after sale so revert never silently drops stock
      if (existingIndex === -1) {
        existingIndex = allInventory.findIndex(i => i.pesticideId === item.pesticideId);
      }

      if (existingIndex !== -1) {
        const existingItem = allInventory[existingIndex];
        let updatedItem: InventoryItem;
        if (isQuarantineReturn) {
          updatedItem = {
            ...existingItem,
            quarantineQty: Math.max(0, round2((Number(existingItem.quarantineQty) || 0) - absQty)),
            quarantineLogs: (existingItem.quarantineLogs || []).filter(q => q.prescriptionId !== effectiveRx.id),
            revision: (Number(existingItem.revision) || 0) + 1,
            lastUpdated: nowIso
          };
        } else {
          const currentBatches = ensureInventoryBatches(existingItem);
          const serialList = [
            ...(item.serialNumbers || []),
            ...(item.serialNumber ? [item.serialNumber] : [])
          ].filter(Boolean);
          let nextBatches = currentBatches;
          if (isReturn) {
            nextBatches = deductBatchStock(currentBatches, {
              quantity: absQty,
              lotNumber: item.lotNumber,
              serialNumbers: serialList
            });
          } else if (item.batchAllocations && item.batchAllocations.length > 0) {
            for (const alloc of item.batchAllocations) {
              nextBatches = addBatchStock(nextBatches, {
                lotNumber: alloc.lotNumber,
                expiryDate: alloc.expiryDate || item.expiryDate,
                quantity: alloc.quantity,
                serialNumbers: alloc.serialNumbers,
                receivedAt: nowIso
              });
            }
          } else {
            nextBatches = addBatchStock(currentBatches, {
              lotNumber: item.lotNumber || existingItem.lotNumber,
              expiryDate: item.expiryDate || existingItem.expiryDate,
              quantity: absQty,
              serialNumbers: serialList,
              receivedAt: nowIso
            });
          }
          updatedItem = applyBatchesToInventoryItem(
            {
              ...existingItem,
              quantity: round2((Number(existingItem.quantity) || 0) + qtyDelta),
              lastUpdated: nowIso
            },
            nextBatches
          );
        }
        await inventoryStore.put(updatedItem);
        allInventory[existingIndex] = updatedItem;
        inventoryUpdates.push(updatedItem);
      }
    }

    const updatedPrescription: Prescription = {
      ...effectiveRx,
      ...prescription,
      isInventoryProcessed: false,
      isProcessed: false,
      lastUpdated: nowIso
    };
    await prescriptionStore.put(updatedPrescription);

    await tx.done;

    inventoryUpdates.forEach(item => void backgroundSync('inventory', item));
    void backgroundSync('prescriptions', updatedPrescription);
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

    await flushSyncOutboxInternal().catch(() => {});
    const db = await initDB();
    const stores = USER_SYNC_COLLECTIONS;
    const fallbackIso = new Date().toISOString();
    
    let total = 0;
    for (const storeName of stores) {
        const items = await db.getAll(storeName);
        // AK-22: Preserve original lastUpdated timestamps so backups don't artificially beat newer edits on other devices
        await Promise.all(
          items.map(item =>
            backgroundSync(
              storeName,
              { ...(item as any), lastUpdated: (item as any).lastUpdated || fallbackIso },
              { preserveLastUpdated: true }
            )
          )
        );
        total += items.length;
    }

    await flushSyncOutboxInternal();
    const remainingOutbox = await this.getPendingOutboxCount(user.uid);
    if (remainingOutbox > 0) {
        throw new Error(`${remainingOutbox} kayıt buluta aktarılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.`);
    }
    
    const timestamp = new Date().toISOString();
    // Update lastSyncTime in Firestore user profile only after verified zero-outbox completion
    await setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid), { lastSyncTime: timestamp }, { merge: true });

    return { total, timestamp };
  },

  async getPayments() {
    const db = await initDB();
    const items = await db.getAll('payments');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    await backgroundDelete('payments', id);
  },

  /**
   * D-04 & D-05: Atomically saves a Payment FIRST along with its derived Kasa Transaction
   * OR deferred MyPayment (check/promissory/tediye/blocked POS), cleaning up stale side-effects
   * when amount, method, accountId, or cardOption changes so Kasa is NEVER double-credited.
   */
  async savePaymentWithEffects(params: {
    payment: Payment;
    desiredTransaction?: Transaction | null;
    desiredMyPayment?: MyPayment | null;
  }): Promise<string> {
    const db = await initDB();
    const nowIso = new Date().toISOString();
    const tx = db.transaction(['payments', 'transactions', 'accounts', 'myPayments'], 'readwrite');
    const payStore = tx.objectStore('payments');
    const txStore = tx.objectStore('transactions');
    const accStore = tx.objectStore('accounts');
    const myPayStore = tx.objectStore('myPayments');

    const stampedPayment: Payment & { lastUpdated?: string } = {
      ...params.payment,
      amount: round2(params.payment.amount),
      lastUpdated: nowIso
    };
    // 1. Always write Payment FIRST (D-04)
    await payStore.put(stampedPayment);

    const allTxs = await txStore.getAll();
    const allMyPays = await myPayStore.getAll();

    const affectedAccountIds = new Set<string>();
    if (params.payment.accountId) affectedAccountIds.add(params.payment.accountId);
    if (params.desiredTransaction?.accountId) affectedAccountIds.add(params.desiredTransaction.accountId);

    const syncTxs: Transaction[] = [];
    const syncMyPays: MyPayment[] = [];
    const syncAccounts: Account[] = [];

    const existingDirectTxs = allTxs.filter(t => !t.deletedAt && t.relatedId === stampedPayment.id);
    const existingMyPays = allMyPays.filter(mp => !mp.deletedAt && mp.relatedId === stampedPayment.id);

    // 2. Reconcile MyPayment (CHECK / PROMISSORY_NOTE / TEDYE / DEFERRED_CARD)
    if (params.desiredMyPayment) {
      const primaryMyPay = existingMyPays[0];
      // Soft-delete any extra duplicate MyPayments
      for (const extraMp of existingMyPays.slice(1)) {
        const tombMp: any = { ...extraMp, deletedAt: nowIso, lastUpdated: nowIso };
        await myPayStore.put(tombMp);
        syncMyPays.push(tombMp);
        // Also soft-delete any Kasa tx settled from that duplicate MyPayment
        for (const settledTx of allTxs.filter(t => !t.deletedAt && t.relatedId === extraMp.id)) {
          affectedAccountIds.add(settledTx.accountId);
          const tombTx: any = { ...settledTx, deletedAt: nowIso, lastUpdated: nowIso };
          await txStore.put(tombTx);
          syncTxs.push(tombTx);
        }
      }

      const preservedId = primaryMyPay?.id || params.desiredMyPayment.id || generateUUID();
      // If primaryMyPay previously had a settled Kasa transaction (e.g. unblocked POS or collected check)
      // and we are now rebuilding/changing it to PENDING (or changing type/cardOption), clean up or update the settled Kasa tx
      const settledTxsForPrimary = primaryMyPay
        ? allTxs.filter(t => !t.deletedAt && t.relatedId === primaryMyPay.id)
        : [];

      const preserveEndorsement =
        primaryMyPay &&
        primaryMyPay.portfolioStatus === 'ENDORSED' &&
        (params.desiredMyPayment.type === 'CHECK' || params.desiredMyPayment.type === 'PROMISSORY_NOTE');

      for (const settledTx of settledTxsForPrimary) {
        affectedAccountIds.add(settledTx.accountId);
        const tombTx: any = { ...settledTx, deletedAt: nowIso, lastUpdated: nowIso };
        await txStore.put(tombTx);
        syncTxs.push(tombTx);
      }

      const nextMyPay: MyPayment = {
        ...params.desiredMyPayment,
        id: preservedId,
        amount: round2(params.desiredMyPayment.amount),
        commissionAmount: params.desiredMyPayment.commissionAmount !== undefined
          ? round2(params.desiredMyPayment.commissionAmount)
          : undefined,
        portfolioStatus: preserveEndorsement
          ? 'ENDORSED'
          : params.desiredMyPayment.portfolioStatus,
        endorsedToSupplierId: preserveEndorsement ? primaryMyPay?.endorsedToSupplierId : params.desiredMyPayment.endorsedToSupplierId,
        endorsedToSupplierName: preserveEndorsement ? primaryMyPay?.endorsedToSupplierName : params.desiredMyPayment.endorsedToSupplierName,
        endorsedDate: preserveEndorsement ? primaryMyPay?.endorsedDate : params.desiredMyPayment.endorsedDate,
        lastUpdated: nowIso
      };
      await myPayStore.put(nextMyPay);
      syncMyPays.push(nextMyPay);
    } else {
      // Switching AWAY from CHECK / DEFERRED_CARD -> soft-delete old MyPayments & any Kasa tx settled from them
      for (const oldMp of existingMyPays) {
        const tombMp: any = { ...oldMp, deletedAt: nowIso, lastUpdated: nowIso };
        await myPayStore.put(tombMp);
        syncMyPays.push(tombMp);
        for (const settledTx of allTxs.filter(t => !t.deletedAt && t.relatedId === oldMp.id)) {
          affectedAccountIds.add(settledTx.accountId);
          const tombTx: any = { ...settledTx, deletedAt: nowIso, lastUpdated: nowIso };
          await txStore.put(tombTx);
          syncTxs.push(tombTx);
        }
      }
    }

    // 3. Reconcile direct Kasa Transaction (CASH or immediate/next-day CARD)
    if (params.desiredTransaction) {
      const primaryTx = existingDirectTxs[0];
      if (primaryTx) affectedAccountIds.add(primaryTx.accountId);
      for (const extraTx of existingDirectTxs.slice(1)) {
        affectedAccountIds.add(extraTx.accountId);
        const tombTx: any = { ...extraTx, deletedAt: nowIso, lastUpdated: nowIso };
        await txStore.put(tombTx);
        syncTxs.push(tombTx);
      }
      const nextTx: Transaction & { lastUpdated?: string } = {
        ...params.desiredTransaction,
        id: primaryTx?.id || params.desiredTransaction.id || generateUUID(),
        amount: round2(params.desiredTransaction.amount),
        relatedId: stampedPayment.id,
        lastUpdated: nowIso
      };
      affectedAccountIds.add(nextTx.accountId);
      await txStore.put(nextTx);
      syncTxs.push(nextTx);
    } else {
      for (const oldTx of existingDirectTxs) {
        affectedAccountIds.add(oldTx.accountId);
        const tombTx: any = { ...oldTx, deletedAt: nowIso, lastUpdated: nowIso };
        await txStore.put(tombTx);
        syncTxs.push(tombTx);
      }
    }

    // 4. Recompute affected account balances inside the SAME IndexedDB transaction
    if (affectedAccountIds.size > 0) {
      const freshTxs = await txStore.getAll();
      for (const accId of affectedAccountIds) {
        if (!accId) continue;
        const acc = await accStore.get(accId);
        if (!acc || acc.deletedAt) continue;
        let calc = 0;
        for (const t of freshTxs) {
          if (!t.deletedAt && t.accountId === accId) {
            calc += t.type === 'INCOME' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);
          }
        }
        const updatedAcc: Account & { lastUpdated?: string } = {
          ...acc,
          balance: round2(calc),
          lastUpdated: nowIso
        };
        await accStore.put(updatedAcc);
        syncAccounts.push(updatedAcc);
      }
    }

    await tx.done;

    void backgroundSync('payments', stampedPayment, { preserveLastUpdated: true });
    syncMyPays.forEach(mp => void backgroundSync('myPayments', mp, { preserveLastUpdated: true }));
    syncTxs.forEach(t => void backgroundSync('transactions', t, { preserveLastUpdated: true }));
    syncAccounts.forEach(acc => void backgroundSync('accounts', acc, { preserveLastUpdated: true }));

    return stampedPayment.id;
  },

  async deletePaymentWithEffects(paymentId: string): Promise<void> {
    const db = await initDB();
    const nowIso = new Date().toISOString();
    const tx = db.transaction(['payments', 'transactions', 'accounts', 'myPayments'], 'readwrite');
    const payStore = tx.objectStore('payments');
    const txStore = tx.objectStore('transactions');
    const accStore = tx.objectStore('accounts');
    const myPayStore = tx.objectStore('myPayments');

    const existingPay = await payStore.get(paymentId);
    const tombPay: any = existingPay
      ? { ...existingPay, deletedAt: nowIso, lastUpdated: nowIso }
      : { id: paymentId, deletedAt: nowIso, lastUpdated: nowIso };
    await payStore.put(tombPay);

    const allTxs = await txStore.getAll();
    const allMyPays = await myPayStore.getAll();
    const affectedAccountIds = new Set<string>();
    const syncTxs: Transaction[] = [];
    const syncMyPays: MyPayment[] = [];
    const syncAccounts: Account[] = [];

    const relatedMyPayIds = new Set<string>();
    for (const mp of allMyPays) {
      if (!mp.deletedAt && mp.relatedId === paymentId) {
        relatedMyPayIds.add(mp.id);
        const tombMp: any = { ...mp, deletedAt: nowIso, lastUpdated: nowIso };
        await myPayStore.put(tombMp);
        syncMyPays.push(tombMp);
      }
    }

    for (const t of allTxs) {
      if (!t.deletedAt && (t.relatedId === paymentId || (t.relatedId && relatedMyPayIds.has(t.relatedId)))) {
        affectedAccountIds.add(t.accountId);
        const tombTx: any = { ...t, deletedAt: nowIso, lastUpdated: nowIso };
        await txStore.put(tombTx);
        syncTxs.push(tombTx);
      }
    }

    if (affectedAccountIds.size > 0) {
      const freshTxs = await txStore.getAll();
      for (const accId of affectedAccountIds) {
        if (!accId) continue;
        const acc = await accStore.get(accId);
        if (!acc || acc.deletedAt) continue;
        let calc = 0;
        for (const t of freshTxs) {
          if (!t.deletedAt && t.accountId === accId) {
            calc += t.type === 'INCOME' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);
          }
        }
        const updatedAcc: Account & { lastUpdated?: string } = {
          ...acc,
          balance: round2(calc),
          lastUpdated: nowIso
        };
        await accStore.put(updatedAcc);
        syncAccounts.push(updatedAcc);
      }
    }

    await tx.done;

    void backgroundSync('payments', tombPay, { preserveLastUpdated: true });
    syncMyPays.forEach(mp => void backgroundSync('myPayments', mp, { preserveLastUpdated: true }));
    syncTxs.forEach(t => void backgroundSync('transactions', t, { preserveLastUpdated: true }));
    syncAccounts.forEach(acc => void backgroundSync('accounts', acc, { preserveLastUpdated: true }));
  },
  
  async getManualDebts() {
    const db = await initDB();
    const items = await db.getAll('manualDebts');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    await backgroundDelete('manualDebts', id);
  },

  async getSuppliers() {
    const db = await initDB();
    const items = await db.getAll('suppliers');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
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
    await backgroundDelete('suppliers', id);
  },

  async updateInventoryFromPurchase(purchase: SupplierPurchase, isRevert: boolean = false) {
    const db = await initDB();
    const tx = db.transaction('inventory', 'readwrite');
    const store = tx.objectStore('inventory');
    const allStoreItems = await store.getAll();
    const updates: InventoryItem[] = [];
    const nowIso = new Date().toISOString();

    const items = purchase.items || [];
    for (const item of items) {
      const itemNormGtin = normalizeGtin(item.gtin || item.barcode);
      let existingIndex = allStoreItems.findIndex(i => i.pesticideId === item.pesticideId && !i.deletedAt);
      if (existingIndex === -1 && itemNormGtin) {
        existingIndex = allStoreItems.findIndex(
          i => !i.deletedAt && normalizeGtin(i.gtin || i.barcode) === itemNormGtin
        );
      }

      const qtyStr = String(item.quantity ?? '0').replace(',', '.');
      const quantityChange = parseFloat(qtyStr);

      if (!Number.isFinite(quantityChange) || quantityChange === 0) {
        if (Number.isNaN(quantityChange)) {
          console.warn('Skipping item with invalid quantity:', item);
        }
        continue;
      }

      // AK-20: Determine direction strictly from purchase.type (NEVER from free-text purchase.note!)
      const isReturnOrSale = purchase.type === 'SALE' || purchase.type === 'RETURN' || quantityChange < 0;
      const effectiveQtyChange = isReturnOrSale ? -Math.abs(quantityChange) : Math.abs(quantityChange);
      const delta = round2(isRevert ? -effectiveQtyChange : effectiveQtyChange);
      const { barcode: cleanBarcode, gtin: cleanGtin } = sanitizeCanonicalBarcode(item.barcode, item.gtin);

      if (existingIndex !== -1) {
        const existing = allStoreItems[existingIndex];
        const currentQty = Number(existing.quantity) || 0;
        const rawNewQty = currentQty + delta;
        const newQuantity = round2(Number.isNaN(rawNewQty) ? currentQty : rawNewQty);

        const itemSerialList = Array.from(
          new Set(
            [
              ...(((item as any).serialNumbers || []) as string[]),
              ...(item.serialNumber ? [item.serialNumber] : [])
            ]
              .map(s => String(s).trim())
              .filter(Boolean)
          )
        );
        const currentBatches = ensureInventoryBatches(existing);
        const nextBatches = delta >= 0
          ? addBatchStock(currentBatches, {
              lotNumber: item.lotNumber,
              expiryDate: item.expiryDate,
              quantity: delta,
              serialNumbers: itemSerialList.length > 0 ? itemSerialList : undefined,
              receivedAt: nowIso
            })
          : deductBatchStock(currentBatches, {
              quantity: Math.abs(delta),
              lotNumber: item.lotNumber,
              serialNumbers: itemSerialList.length > 0 ? itemSerialList : undefined
            });

        const parsedBuying = parseFloat(String(item.buyingPrice ?? '0').replace(',', '.'));
        const parsedSelling = item.sellingPrice !== undefined
          ? parseFloat(String(item.sellingPrice).replace(',', '.'))
          : NaN;

        const updatedItem = applyBatchesToInventoryItem(
          {
            ...existing,
            quantity: newQuantity,
            buyingPrice: isRevert
              ? (existing.buyingPrice || 0)
              : (Number.isFinite(parsedBuying) && parsedBuying > 0 ? parsedBuying : (existing.buyingPrice || 0)),
            sellingPrice: isRevert || !Number.isFinite(parsedSelling) || parsedSelling <= 0
              ? (existing.sellingPrice || 0)
              : parsedSelling,
            gtin: existing.gtin || cleanGtin,
            barcode: existing.barcode || cleanBarcode,
            lastUpdated: nowIso
          },
          nextBatches
        );
        await store.put(updatedItem);
        allStoreItems[existingIndex] = updatedItem;
        updates.push(updatedItem);
      } else if (!isRevert && delta > 0) {
        // B-04 & B-15: Create new inventory item with clean canonical barcode/gtin & initial batch ONLY on positive stock-in
        const buyingPrice = parseFloat(String(item.buyingPrice ?? '0').replace(',', '.')) || 0;
        const sellingPrice = item.sellingPrice !== undefined
          ? (parseFloat(String(item.sellingPrice).replace(',', '.')) || round2(buyingPrice * 1.2))
          : round2(buyingPrice * 1.2);

        const itemSerialList = Array.from(
          new Set(
            [
              ...(((item as any).serialNumbers || []) as string[]),
              ...(item.serialNumber ? [item.serialNumber] : [])
            ]
              .map(s => String(s).trim())
              .filter(Boolean)
          )
        );
        const initialBatches = addBatchStock([], {
          lotNumber: item.lotNumber,
          expiryDate: item.expiryDate,
          quantity: delta,
          serialNumbers: itemSerialList.length > 0 ? itemSerialList : undefined,
          receivedAt: nowIso
        });

        const newItem = applyBatchesToInventoryItem(
          {
            id: generateUUID(),
            pesticideId: item.pesticideId || generateUUID(),
            pesticideName: item.pesticideName,
            category: PesticideCategory.OTHER,
            quantity: delta,
            unit: item.unit || 'Adet',
            buyingPrice,
            sellingPrice,
            gtin: cleanGtin,
            barcode: cleanBarcode,
            lastUpdated: nowIso
          },
          initialBatches
        );
        await store.put(newItem);
        updates.push(newItem);
        allStoreItems.push(newItem);
      }
    }
    await tx.done;
    if (updates.length > 0) {
      updates.forEach(item => void backgroundSync('inventory', item));
    }
  },

  /**
   * AK-19: Crash-safe supplier purchase persistence + inventory update.
   * Persists the purchase with `isInventoryProcessed: false` FIRST, reverts old purchase if editing,
   * applies new inventory changes, and marks `isInventoryProcessed: true`.
   */
  async saveSupplierPurchaseWithInventory(
    purchase: SupplierPurchase,
    oldPurchaseToRevert?: SupplierPurchase | null
  ): Promise<string> {
    const db = await initDB();
    const nowIso = new Date().toISOString();

    if (oldPurchaseToRevert && oldPurchaseToRevert.isInventoryProcessed !== false) {
      await this.updateInventoryFromPurchase(oldPurchaseToRevert, true);
    }

    const pendingRecord: SupplierPurchase & { lastUpdated?: string } = {
      ...purchase,
      items: (purchase.items || []).map(it => ({ ...it })),
      isInventoryProcessed: false,
      lastUpdated: nowIso
    };
    await db.put('supplierPurchases', pendingRecord);

    await this.updateInventoryFromPurchase(pendingRecord, false);

    const finalRecord: SupplierPurchase & { lastUpdated?: string } = {
      ...pendingRecord,
      isInventoryProcessed: true,
      lastUpdated: new Date().toISOString()
    };
    await db.put('supplierPurchases', finalRecord);
    void backgroundSync('supplierPurchases', finalRecord);
    return finalRecord.id;
  },

  async softDeleteSupplierPurchaseWithInventory(id: string): Promise<void> {
    const db = await initDB();
    const existing = await db.get('supplierPurchases', id);
    if (!existing || existing.deletedAt) return;

    if (existing.isInventoryProcessed !== false) {
      await this.updateInventoryFromPurchase(existing, true);
    }

    const nowIso = new Date().toISOString();
    const deleted: SupplierPurchase & { lastUpdated?: string } = {
      ...existing,
      isInventoryProcessed: false,
      deletedAt: nowIso,
      lastUpdated: nowIso
    };
    await db.put('supplierPurchases', deleted);
    void backgroundSync('supplierPurchases', deleted, { preserveLastUpdated: true });
  },

  async getSupplierPurchases(supplierId?: string) {
    const db = await initDB();
    let items;
    if (!supplierId) {
      items = await db.getAll('supplierPurchases');
    } else {
      items = await db.getAllFromIndex('supplierPurchases', 'by-supplier', supplierId);
    }
    return items.filter((i: any) => !i.deletedAt);
  },

  async getSupplierPurchaseById(id: string) {
    const db = await initDB();
    return db.get('supplierPurchases', id);
  },

  async getSupplierPayments(supplierId?: string) {
    const db = await initDB();
    let items;
    if (!supplierId) {
      items = await db.getAll('supplierPayments');
    } else {
      items = await db.getAllFromIndex('supplierPayments', 'by-supplier', supplierId);
    }
    return items.filter((i: any) => !i.deletedAt);
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
    await backgroundDelete('supplierPayments', id);
  },

  async getMyPayments() {
    const db = await initDB();
    const items = await db.getAll('myPayments');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
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
    await backgroundDelete('myPayments', id);
  },

  // --- TURNOVER LOGS ---
  async getTurnoverLogs(): Promise<TurnoverLog[]> {
    const db = await initDB();
    const items = await db.getAll('turnoverLogs');
    return items.filter((i: any) => !i.deletedAt);
  },

  async addTurnoverLog(log: TurnoverLog): Promise<void> {
    const db = await initDB();
    await db.put('turnoverLogs', log);
    await backgroundSync('turnoverLogs', log);
  },

  async performFinancialTurnover(year: number, farmerBalances: Record<string, number>): Promise<void> {
    const db = await initDB();
    const allDebts = await db.getAll('manualDebts');
    const existingTurnoverDebts = allDebts.filter(d => d.id.startsWith(`turnover-${year}-`) && !d.deletedAt);
    const tx = db.transaction(['manualDebts', 'turnoverLogs'], 'readwrite');
    const debtStore = tx.objectStore('manualDebts');
    const logStore = tx.objectStore('turnoverLogs');
    
    const date = `${year}-01-01T00:00:01Z`;
    const note = `${year} Devir Bakiyesi`;
    const nowIso = new Date().toISOString();
    const toSyncDebts: ManualDebt[] = [];
    const activeTurnoverIds = new Set<string>();
    
    for (const [farmerId, rawBalance] of Object.entries(farmerBalances)) {
      const balance = Math.round((Number(rawBalance) || 0) * 100) / 100;
      const entryId = `turnover-${year}-${farmerId}`;
      if (Math.abs(balance) < 0.01) continue;
      
      activeTurnoverIds.add(entryId);
      const turnoverEntry: ManualDebt = {
        id: entryId,
        farmerId,
        amount: balance,
        date,
        note,
        ...( { lastUpdated: nowIso } as any )
      };
      
      await debtStore.put(turnoverEntry);
      toSyncDebts.push(turnoverEntry);
    }

    // Soft-delete any obsolete turnover entries if balance dropped to 0 upon re-run
    for (const oldEntry of existingTurnoverDebts) {
      if (!activeTurnoverIds.has(oldEntry.id)) {
        const deletedEntry: any = { ...oldEntry, deletedAt: nowIso, lastUpdated: nowIso };
        await debtStore.put(deletedEntry);
        toSyncDebts.push(deletedEntry);
      }
    }
    
    const log: TurnoverLog = {
      id: `turnover-log-fin-${year}`,
      year,
      date: nowIso,
      type: 'FINANCIAL'
    };
    
    await logStore.put(log);
    await tx.done;

    for (const entry of toSyncDebts) {
      backgroundSync('manualDebts', entry);
    }
    backgroundSync('turnoverLogs', log);
  },

  async performInventoryTurnover(year: number, inventoryItems: InventoryItem[]): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(['turnoverLogs'], 'readwrite');
    const logStore = tx.objectStore('turnoverLogs');
    
    const log: TurnoverLog = {
      id: `turnover-log-inv-${year}`,
      year,
      date: new Date().toISOString(),
      type: 'INVENTORY',
      ...({ itemCount: inventoryItems.length } as any)
    };
    
    await logStore.put(log);
    await tx.done;
    backgroundSync('turnoverLogs', log);
  },

  // --- EXPENSES ---
  async getExpenses() {
    const db = await initDB();
    const items = await db.getAll('expenses');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    const items = await db.getAll('accounts');
    return items.filter((i: any) => !i.deletedAt);
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
    await backgroundDelete('accounts', id);
  },

  async getTransactions() {
    const db = await initDB();
    const items = await db.getAll('transactions');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async addTransaction(transaction: Transaction) {
    const db = await initDB();
    const nowIso = new Date().toISOString();
    const cleanTx: Transaction & { lastUpdated?: string } = {
      ...transaction,
      amount: round2(transaction.amount),
      lastUpdated: nowIso
    };

    // AK-07: Deduplicate ONLY on exact transaction.id or active relatedId — NEVER drop legitimate second manual entries!
    const existingById = await db.get('transactions', cleanTx.id);
    if (existingById && !existingById.deletedAt) {
      return existingById.id;
    }
    if (cleanTx.relatedId) {
      const allExisting = await db.getAll('transactions');
      const existingByRelated = allExisting.find((t: any) => !t.deletedAt && t.relatedId === cleanTx.relatedId);
      if (existingByRelated) {
        console.warn(`Transaction already exists for relatedId: ${cleanTx.relatedId}`);
        return existingByRelated.id;
      }
    }

    const idbTx = db.transaction(['transactions', 'accounts'], 'readwrite');
    const txStore = idbTx.objectStore('transactions');
    const accStore = idbTx.objectStore('accounts');

    await txStore.put(cleanTx);

    let updatedAccount: (Account & { lastUpdated?: string }) | null = null;
    const account = await accStore.get(cleanTx.accountId);
    if (account && !account.deletedAt) {
      const allAccountTxs = (await txStore.getAll()).filter(
        (t: any) => !t.deletedAt && t.accountId === cleanTx.accountId
      );
      let calculatedBalance = 0;
      for (const t of allAccountTxs) {
        calculatedBalance += t.type === 'INCOME' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);
      }
      updatedAccount = {
        ...account,
        balance: round2(calculatedBalance),
        lastUpdated: nowIso
      };
      await accStore.put(updatedAccount);
    }
    await idbTx.done;

    void backgroundSync('transactions', cleanTx, { preserveLastUpdated: true });
    if (updatedAccount) {
      void backgroundSync('accounts', updatedAccount, { preserveLastUpdated: true });
    }
    return cleanTx.id;
  },

  async updateTransaction(transaction: Transaction) {
    const db = await initDB();
    const nowIso = new Date().toISOString();
    const idbTx = db.transaction(['transactions', 'accounts'], 'readwrite');
    const txStore = idbTx.objectStore('transactions');
    const accStore = idbTx.objectStore('accounts');

    const oldTransaction = await txStore.get(transaction.id);
    const cleanTx: Transaction & { lastUpdated?: string } = {
      ...transaction,
      amount: round2(transaction.amount),
      lastUpdated: nowIso
    };
    await txStore.put(cleanTx);

    const accountIdsToRecalculate = new Set<string>([cleanTx.accountId]);
    if (oldTransaction && oldTransaction.accountId !== cleanTx.accountId) {
      accountIdsToRecalculate.add(oldTransaction.accountId);
    }

    const allTxs = await txStore.getAll();
    const updatedAccounts: (Account & { lastUpdated?: string })[] = [];
    for (const accId of accountIdsToRecalculate) {
      const account = await accStore.get(accId);
      if (account && !account.deletedAt) {
        let calculatedBalance = 0;
        for (const t of allTxs) {
          if (!t.deletedAt && t.accountId === accId) {
            calculatedBalance += t.type === 'INCOME' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);
          }
        }
        const nextAcc = {
          ...account,
          balance: round2(calculatedBalance),
          lastUpdated: nowIso
        };
        await accStore.put(nextAcc);
        updatedAccounts.push(nextAcc);
      }
    }
    await idbTx.done;

    void backgroundSync('transactions', cleanTx, { preserveLastUpdated: true });
    updatedAccounts.forEach(acc => void backgroundSync('accounts', acc, { preserveLastUpdated: true }));
  },

  async deleteTransaction(id: string) {
    const db = await initDB();
    const nowIso = new Date().toISOString();
    const idbTx = db.transaction(['transactions', 'accounts'], 'readwrite');
    const txStore = idbTx.objectStore('transactions');
    const accStore = idbTx.objectStore('accounts');

    const transaction = await txStore.get(id);
    if (!transaction || transaction.deletedAt) {
      await idbTx.done;
      return;
    }

    // AK-06: Soft-delete locally & recalculate account.balance BEFORE firing background network sync!
    const tombstoneTx: Transaction & { lastUpdated?: string } = {
      ...transaction,
      deletedAt: nowIso,
      lastUpdated: nowIso
    };
    await txStore.put(tombstoneTx);

    let updatedAccount: (Account & { lastUpdated?: string }) | null = null;
    const account = await accStore.get(transaction.accountId);
    if (account && !account.deletedAt) {
      const allTxs = await txStore.getAll();
      let calculatedBalance = 0;
      for (const t of allTxs) {
        if (!t.deletedAt && t.accountId === transaction.accountId) {
          calculatedBalance += t.type === 'INCOME' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);
        }
      }
      updatedAccount = {
        ...account,
        balance: round2(calculatedBalance),
        lastUpdated: nowIso
      };
      await accStore.put(updatedAccount);
    }
    await idbTx.done;

    void backgroundSync('transactions', tombstoneTx, { preserveLastUpdated: true });
    if (updatedAccount) {
      void backgroundSync('accounts', updatedAccount, { preserveLastUpdated: true });
    }
  },

  /**
   * AK-27: Atomic inter-account transfer (Virman) inside a single IndexedDB transaction.
   */
  async transferBetweenAccounts(params: {
    id?: string;
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
    description?: string;
  }): Promise<{ outTxId: string; inTxId: string }> {
    const cleanAmount = round2(params.amount);
    if (!params.fromAccountId || !params.toAccountId || params.fromAccountId === params.toAccountId) {
      throw new Error('Kaynak ve hedef hesap birbirinden farklı olmalıdır.');
    }
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      throw new Error('Geçerli bir virman tutarı giriniz.');
    }

    const db = await initDB();
    const nowIso = new Date().toISOString();
    const transferId = params.id || generateUUID();
    const outTxId = `virman-out-${transferId}`;
    const inTxId = `virman-in-${transferId}`;

    const idbTx = db.transaction(['transactions', 'accounts'], 'readwrite');
    const txStore = idbTx.objectStore('transactions');
    const accStore = idbTx.objectStore('accounts');

    const fromAcc = await accStore.get(params.fromAccountId);
    const toAcc = await accStore.get(params.toAccountId);
    if (!fromAcc || fromAcc.deletedAt || !toAcc || toAcc.deletedAt) {
      await idbTx.done;
      throw new Error('Seçilen hesaplardan biri bulunamadı.');
    }

    const existingOut = await txStore.get(outTxId);
    const existingIn = await txStore.get(inTxId);
    if (existingOut && !existingOut.deletedAt && existingIn && !existingIn.deletedAt) {
      await idbTx.done;
      return { outTxId, inTxId };
    }

    const noteSuffix = params.description?.trim() ? ` — ${params.description.trim()}` : '';
    const outTx: Transaction & { lastUpdated?: string } = {
      id: outTxId,
      accountId: fromAcc.id,
      type: 'EXPENSE',
      amount: cleanAmount,
      date: params.date,
      description: `Virman → ${toAcc.name}${noteSuffix}`,
      relatedId: `virman-out:${transferId}`,
      category: 'TRANSFER',
      partyName: toAcc.name,
      partyType: 'OTHER',
      lastUpdated: nowIso
    };
    const inTx: Transaction & { lastUpdated?: string } = {
      id: inTxId,
      accountId: toAcc.id,
      type: 'INCOME',
      amount: cleanAmount,
      date: params.date,
      description: `Virman ← ${fromAcc.name}${noteSuffix}`,
      relatedId: `virman-in:${transferId}`,
      category: 'TRANSFER',
      partyName: fromAcc.name,
      partyType: 'OTHER',
      lastUpdated: nowIso
    };

    await txStore.put(outTx);
    await txStore.put(inTx);

    const allTxs = await txStore.getAll();
    const calcBalance = (accId: string) => {
      let sum = 0;
      for (const t of allTxs) {
        if (!t.deletedAt && t.accountId === accId) {
          sum += t.type === 'INCOME' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);
        }
      }
      return round2(sum);
    };

    const updatedFromAcc: Account & { lastUpdated?: string } = {
      ...fromAcc,
      balance: calcBalance(fromAcc.id),
      lastUpdated: nowIso
    };
    const updatedToAcc: Account & { lastUpdated?: string } = {
      ...toAcc,
      balance: calcBalance(toAcc.id),
      lastUpdated: nowIso
    };

    await accStore.put(updatedFromAcc);
    await accStore.put(updatedToAcc);
    await idbTx.done;

    void backgroundSync('transactions', outTx, { preserveLastUpdated: true });
    void backgroundSync('transactions', inTx, { preserveLastUpdated: true });
    void backgroundSync('accounts', updatedFromAcc, { preserveLastUpdated: true });
    void backgroundSync('accounts', updatedToAcc, { preserveLastUpdated: true });

    return { outTxId, inTxId };
  },

  /**
   * Reconciles all accounts:
   * 1. Soft-deletes duplicate linked transactions (same relatedId) — NEVER deletes unlinked manual Kasa entries (AK-24)!
   * 2. Recalculates every account's balance to strictly equal round2(sum(INCOME) - sum(EXPENSE)) (AK-38).
   */
  _isReconcilingAccounts: false,
  async reconcileAccountBalances() {
    if (this._isReconcilingAccounts) return;
    this._isReconcilingAccounts = true;
    try {
      const db = await initDB();
      const allAccounts = await db.getAll('accounts');
      const allTransactions = (await db.getAll('transactions')).filter((t: any) => !t.deletedAt);

      // 1. Deduplicate ONLY linked transactions sharing the same relatedId (AK-24)
      const seenRelatedIds = new Set<string>();
      const duplicateLinkedTxs: Transaction[] = [];
      const validTransactions: Transaction[] = [];

      for (const tx of allTransactions) {
        if (tx.relatedId) {
          if (seenRelatedIds.has(tx.relatedId)) {
            duplicateLinkedTxs.push(tx);
            continue;
          }
          seenRelatedIds.add(tx.relatedId);
        }
        validTransactions.push(tx);
      }

      for (const dupTx of duplicateLinkedTxs) {
        await backgroundDelete('transactions', dupTx.id);
      }

      // 2. Ensure each account balance equals the exact rounded sum of its active transactions
      for (const acc of allAccounts) {
        if (acc.deletedAt) continue;
        const accTxs = validTransactions.filter(t => t.accountId === acc.id);
        let calculatedBalance = 0;
        for (const t of accTxs) {
          calculatedBalance += t.type === 'INCOME' ? (Number(t.amount) || 0) : -(Number(t.amount) || 0);
        }
        calculatedBalance = round2(calculatedBalance);

        if (Math.abs((Number(acc.balance) || 0) - calculatedBalance) >= 0.005) {
          const nextAcc = { ...acc, balance: calculatedBalance };
          await db.put('accounts', nextAcc);
          void backgroundSync('accounts', nextAcc);
        }
      }
    } catch (err) {
      console.error('Error during reconcileAccountBalances:', err);
    } finally {
      this._isReconcilingAccounts = false;
    }
  },

  async deleteExpense(id: string) {
    const db = await initDB();
    await backgroundDelete('expenses', id);
  },

  // --- TEAM MEMBERS ---
  async getTeamMembers() {
    const db = await initDB();
    const items = await db.getAll('teamMembers');
    return items.filter((i: any) => !i.deletedAt);
  },

  async addTeamMember(member: TeamMember) {
    const db = await initDB();
    const hashedMember: TeamMember = {
      ...member,
      password: member.password && !isHashedSecret(member.password) ? await hashSecret(member.password) : member.password
    };
    await db.put('teamMembers', hashedMember);
    backgroundSync('teamMembers', hashedMember);
    return hashedMember.id;
  },

  async updateTeamMember(member: TeamMember) {
    const db = await initDB();
    const existing = await db.get('teamMembers', member.id);
    const nextPassword = member.password
      ? (isHashedSecret(member.password) ? member.password : await hashSecret(member.password))
      : existing?.password;
    const hashedMember: TeamMember = {
      ...member,
      password: nextPassword
    };
    await db.put('teamMembers', hashedMember);
    backgroundSync('teamMembers', hashedMember);
    return hashedMember.id;
  },

  async deleteTeamMember(id: string) {
    const db = await initDB();
    await backgroundDelete('teamMembers', id);
  },

  // --- MESSAGES ---
  async getMessages() {
    const db = await initDB();
    const items = await db.getAll('messages');
    return items.filter((i: any) => !i.deletedAt).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
      console.warn('syncNews warning (non-fatal):', error);
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
    const items = await db.getAll('collectionLogs');
    return items.filter((i: any) => !i.deletedAt);
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
    await backgroundDelete('plants', id);
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
    await backgroundDelete('collectionLogs', id);
  },

  async getAllSiloTransactions(): Promise<import('../types').SiloTransaction[]> {
    const db = await initDB();
    const items = await db.getAll('siloTransactions');
    return items.filter((i: any) => !i.deletedAt);
  },

  async addSiloTransaction(transaction: import('../types').SiloTransaction) {
    const db = await initDB();
    await db.put('siloTransactions', transaction);
    backgroundSync('siloTransactions', transaction);
  },

  async updateSiloTransaction(transaction: import('../types').SiloTransaction) {
    const db = await initDB();
    await db.put('siloTransactions', transaction);
    backgroundSync('siloTransactions', transaction);
  },

  async deleteSiloTransaction(id: string) {
    const db = await initDB();
    const existing = await db.get('siloTransactions', id);
    if (existing?.linkedPaymentId && !existing.linkedPaymentId.startsWith('barter_')) {
      await backgroundDelete('payments', existing.linkedPaymentId);
    }
    const companionBarterTx = await db.get('siloTransactions', `${id}_barter`);
    if (companionBarterTx && !companionBarterTx.deletedAt) {
      await backgroundDelete('siloTransactions', `${id}_barter`);
    }
    await backgroundDelete('siloTransactions', id);
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
  setupRealtimeSync(uid: string, onSync: () => void, onProfileSync?: (profile: import('../types').UserProfile) => void) {
    const userPath = [FS_ROOT, FS_ORG, FS_USERS, uid].join("/");
    const collections = USER_SYNC_COLLECTIONS;
    
    const unsubscribes: (() => void)[] = [];
    let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerDebouncedSync = () => {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      syncDebounceTimer = setTimeout(() => {
        syncDebounceTimer = null;
        if (auth.currentUser?.uid === uid) {
          onSync();
        }
      }, 150);
    };

    // Kick off an outbox flush right when realtime sync attaches
    flushSyncOutboxInternal().catch(() => {});

    // Profile listener
    if (onProfileSync) {
      const profileRef = doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid);
      const profileUnsub = onSnapshot(profileRef, (snapshot) => {
        try {
          if (auth.currentUser?.uid !== uid) return;
          if (snapshot.exists() && !snapshot.metadata.hasPendingWrites) {
            const profileData = snapshot.data() as UserProfile;
            if (localStorage.getItem(`mks_pending_profile_sync_${uid}`) === '1') return;
            localStorage.setItem('mks_user_profile', safeStringify({ ...profileData, uid }));
            onProfileSync(profileData);
          }
        } catch (profileErr) {
          console.error('[setupRealtimeSync] Profile snapshot callback error:', profileErr);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `${userPath}`);
      });
      unsubscribes.push(profileUnsub);
    }

    collections.forEach(col => {
      const q = collection(firestore, userPath, col);
      const unsub = onSnapshot(q, async (snapshot) => {
        try {
          if (auth.currentUser?.uid !== uid) return;
          const db = await initDB();
          if (auth.currentUser?.uid !== uid) return;
          const outboxEntries = await db.getAll('syncOutbox').catch(() => []);
          const pendingIds = new Set(outboxEntries.filter(e => e.collection === col).map(e => e.itemId));
          const tx = db.transaction(col, 'readwrite');
          
          let changedCount = 0;
          for (const change of snapshot.docChanges()) {
            if (change.doc.metadata.hasPendingWrites) continue;
            const docId = change.doc.id;
            if (pendingIds.has(docId)) continue;

            if (change.type === 'added' || change.type === 'modified') {
              const incoming = change.doc.data() as any;
              const localExisting = await tx.store.get(docId) as any;
              if (localExisting) {
                const localTs = localExisting.lastUpdated ? new Date(localExisting.lastUpdated).getTime() : 0;
                const incomingTs = incoming.lastUpdated ? new Date(incoming.lastUpdated).getTime() : 0;
                // AK-21: Allow newer server restores (incomingTs > localTs) to revive locally soft-deleted records
                if (localExisting.deletedAt && !incoming.deletedAt) {
                  if (incomingTs <= localTs) {
                    continue;
                  }
                } else if (localTs > incomingTs) {
                  continue;
                }
              }
              await tx.store.put({ ...incoming, _syncedFromCloud: true });
              changedCount++;
            } else if (change.type === 'removed') {
              await tx.store.delete(docId);
              changedCount++;
            }
          }
          
          await tx.done;
          if (changedCount > 0) {
            triggerDebouncedSync(); // UI'ı tek seferde bilgilendir
          }
        } catch (snapErr) {
          console.error(`[setupRealtimeSync] Snapshot error for ${col}:`, snapErr);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `${userPath}/${col}`);
      });
      
      unsubscribes.push(unsub);
    });

    // Haberler Dinleyicisi (Global/Organizasyon Geneli)
    const newsPath = [FS_ROOT, FS_ORG, "news"].join("/");
    const newsQuery = collection(firestore, newsPath);
    const newsUnsub = onSnapshot(newsQuery, async (snapshot) => {
      try {
        if (auth.currentUser?.uid !== uid) return;
        const db = await initDB();
        if (auth.currentUser?.uid !== uid) return;
        const tx = db.transaction('news', 'readwrite');
        
        const ops: Promise<any>[] = [];
        for (const change of snapshot.docChanges()) {
          if (change.doc.metadata.hasPendingWrites) continue;

          if (change.type === 'added' || change.type === 'modified') {
            ops.push(tx.store.put(change.doc.data() as any));
          } else if (change.type === 'removed') {
            ops.push(tx.store.delete(change.doc.id));
          }
        }
        
        if (ops.length > 0) {
          await Promise.all(ops);
          await tx.done;
          triggerDebouncedSync();
        } else {
          await tx.done;
        }
      } catch (newsErr) {
        console.error('[setupRealtimeSync] News snapshot error:', newsErr);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, newsPath);
    });
    unsubscribes.push(newsUnsub);

    return () => {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      unsubscribes.forEach(unsub => unsub());
    };
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
  },

  async getSiloContacts() {
    const db = await initDB();
    const contacts = await db.getAll('siloContacts');
    return contacts.filter((c: any) => !c.deletedAt).sort((a: any, b: any) => a.name.localeCompare(b.name, 'tr'));
  },

  async addSiloContact(contact: import('../types').SiloContact) {
    const db = await initDB();
    await db.put('siloContacts', contact);
    backgroundSync('siloContacts', contact);
    return contact.id;
  },

  async updateSiloContact(contact: import('../types').SiloContact) {
    const db = await initDB();
    await db.put('siloContacts', contact);
    backgroundSync('siloContacts', contact);
    return contact.id;
  },

  async deleteSiloContact(id: string) {
    const db = await initDB();
    const contact = await db.get('siloContacts', id);
    if (contact) {
      const updatedContact = { ...contact, deletedAt: new Date().toISOString() };
      await db.put('siloContacts', updatedContact);
      backgroundSync('siloContacts', updatedContact);
    }
  },

  async flushSyncOutbox() {
    await flushSyncOutboxInternal();
  },

  // --- MAP FEATURES (PARSEL & HARİTA KAYITLARI - 1.8) ---
  async getMapFeatures(): Promise<SavedMapFeature[]> {
    const db = await initDB();
    const items = await db.getAll('mapFeatures');
    return items.filter(f => !f.deletedAt);
  },

  async saveMapFeature(feature: SavedMapFeature): Promise<string> {
    const db = await initDB();
    const stamped: SavedMapFeature = {
      ...feature,
      createdAt: feature.createdAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    await db.put('mapFeatures', stamped);
    backgroundSync('mapFeatures', stamped);
    return stamped.id;
  },

  async deleteMapFeature(id: string): Promise<void> {
    await backgroundDelete('mapFeatures', id);
  },

  // --- SATELLITE CACHE (5 GÜNLÜK ÇEVRİMDIŞI SENTINEL-2 ÖNBELLEĞİ - 2.3) ---
  getCurrentUserId(): string | null {
    return auth.currentUser?.uid || (typeof localStorage !== 'undefined' ? localStorage.getItem('lastUserId') : null) || null;
  },

  async getSatelliteCache(cacheKey: string, allowExpiredOffline = false): Promise<SatelliteCacheRecord | null> {
    const db = await initDB();
    const rec = await db.get('satelliteCache', cacheKey);
    if (!rec) return null;
    const expMs = rec.expiresAt ? new Date(rec.expiresAt).getTime() : 0;
    const isExpired = !Number.isFinite(expMs) || expMs <= Date.now();
    if (isExpired && (navigator.onLine || !allowExpiredOffline)) {
      return null;
    }
    return rec;
  },

  async saveSatelliteCache(record: SatelliteCacheRecord): Promise<void> {
    const db = await initDB();
    await db.put('satelliteCache', record);
    // Prune stale satellite cache entries older than 14 days past expiry to prevent unbounded IndexedDB growth
    try {
      const all = await db.getAll('satelliteCache');
      if (all.length > 40) {
        const cutoff = Date.now() - 14 * 86400_000;
        const tx = db.transaction('satelliteCache', 'readwrite');
        for (const item of all) {
          const expMs = item.expiresAt ? new Date(item.expiresAt).getTime() : 0;
          if (!Number.isFinite(expMs) || expMs < cutoff) {
            await tx.store.delete(item.id);
          }
        }
        await tx.done;
      }
    } catch {}
  },

  async clearSatelliteCacheForField(fieldId: string): Promise<void> {
    const db = await initDB();
    const matching = await db.getAllFromIndex('satelliteCache', 'by-field', fieldId);
    const tx = db.transaction('satelliteCache', 'readwrite');
    for (const r of matching) {
      await tx.store.delete(r.id);
    }
    await tx.done;
  },

  // --- PRESCRIPTION TEMPLATES (HAZIR REÇETE PAKETLERİ - #12) ---
  async getPrescriptionTemplates(): Promise<PrescriptionTemplate[]> {
    const db = await initDB();
    const list = await db.getAll('prescriptionTemplates');
    return list.filter(t => !t.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  },

  async savePrescriptionTemplate(template: PrescriptionTemplate): Promise<string> {
    const db = await initDB();
    const stamped: PrescriptionTemplate = {
      ...template,
      createdAt: template.createdAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    await db.put('prescriptionTemplates', stamped);
    backgroundSync('prescriptionTemplates', stamped);
    return stamped.id;
  },

  async deletePrescriptionTemplate(id: string): Promise<void> {
    await backgroundDelete('prescriptionTemplates', id);
  },

  // --- PRODUCER PORTAL INQUIRIES & PAYMENT NOTICES (#35 & #38) ---
  async submitPortalInquiry(inquiry: Omit<PortalInquiry, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const id = generateUUID();
    const payload: PortalInquiry = {
      ...inquiry,
      id,
      createdAt: new Date().toISOString(),
      status: 'NEW'
    };
    await setDoc(doc(firestore, FS_ROOT, FS_ORG, 'portal_inquiries', id), sanitizeForFirestore(payload));
    return id;
  },

  async getPortalInquiriesForEngineer(engineerId?: string): Promise<PortalInquiry[]> {
    const uid = engineerId || auth.currentUser?.uid;
    if (!uid || !navigator.onLine) return [];
    try {
      const q = query(collection(firestore, FS_ROOT, FS_ORG, 'portal_inquiries'), where('engineerId', '==', uid));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => d.data() as PortalInquiry)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.warn('getPortalInquiriesForEngineer warning:', err);
      return [];
    }
  },

  async getEngineerPortalInquiries(engineerId?: string): Promise<PortalInquiry[]> {
    return this.getPortalInquiriesForEngineer(engineerId);
  },

  async updatePortalInquiryStatus(
    inquiryId: string,
    status: 'NEW' | 'OPEN' | 'READ' | 'ANSWERED' | 'RESOLVED',
    engineerReply?: string
  ): Promise<void> {
    if (!navigator.onLine) return;
    const updatePayload: Record<string, any> = { status };
    if (engineerReply !== undefined) {
      updatePayload.engineerReply = engineerReply;
    }
    await setDoc(doc(firestore, FS_ROOT, FS_ORG, 'portal_inquiries', inquiryId), updatePayload, { merge: true });
  },

  // --- BKTS / GTS MINISTRY SHIPMENTS, RECORDS & SEQUENTIAL DOCUMENT COUNTERS ---
  async getMinistryShipments(): Promise<MinistryShipmentRecord[]> {
    const db = await initDB();
    const list = await db.getAll('ministryShipments');
    return list
      .filter(s => !s.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async saveMinistryShipment(rec: MinistryShipmentRecord): Promise<string> {
    const db = await initDB();
    const stamped: MinistryShipmentRecord = {
      ...rec,
      id: rec.id || generateUUID(),
      lastUpdated: new Date().toISOString()
    };
    await db.put('ministryShipments', stamped);
    void backgroundSync('ministryShipments', stamped, { preserveLastUpdated: true });
    return stamped.id;
  },

  async getMinistryRecords(): Promise<MinistryRecord[]> {
    const db = await initDB();
    const list = await db.getAll('ministryRecords');
    return list
      .filter(r => !r.deletedAt)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async saveMinistryRecord(rec: MinistryRecord): Promise<string> {
    const db = await initDB();
    const stamped: MinistryRecord = {
      ...rec,
      id: rec.id || generateUUID(),
      lastUpdated: new Date().toISOString()
    };
    await db.put('ministryRecords', stamped);
    void backgroundSync('ministryRecords', stamped, { preserveLastUpdated: true });
    return stamped.id;
  },

  async saveMinistryRecordsBatch(recs: MinistryRecord[]): Promise<void> {
    if (!Array.isArray(recs) || recs.length === 0) return;
    const db = await initDB();
    const nowIso = new Date().toISOString();
    const tx = db.transaction('ministryRecords', 'readwrite');
    const stampedList: MinistryRecord[] = [];
    for (const rec of recs) {
      if (!rec) continue;
      const stamped: MinistryRecord = {
        ...rec,
        id: rec.id || generateUUID(),
        lastUpdated: rec.lastUpdated || nowIso
      };
      await tx.store.put(stamped);
      stampedList.push(stamped);
    }
    await tx.done;
    stampedList.forEach(r => void backgroundSync('ministryRecords', r, { preserveLastUpdated: true }));
  },

  /**
   * B-01: Atomically accepts an incoming BKTS/SSCC shipment:
   * - Idempotent against repeated calls (`status === 'ACCEPTED'` by id or sscc)
   * - Increments or creates InventoryItems with batch/lot/expiry/serial & normalized GTIN
   * - Persists accepted shipment & `SHIPMENT_ACCEPT` MinistryRecords in one IndexedDB transaction
   */
  async acceptMinistryShipment(
    shipment: MinistryShipmentRecord,
    opts?: { defaultBuyingPrice?: number; defaultSellingPrice?: number }
  ): Promise<{ alreadyAccepted: boolean; shipment: MinistryShipmentRecord; records: MinistryRecord[] }> {
    const db = await initDB();
    const nowIso = new Date().toISOString();
    const tx = db.transaction(['inventory', 'ministryShipments', 'ministryRecords'], 'readwrite');
    const invStore = tx.objectStore('inventory');
    const shipStore = tx.objectStore('ministryShipments');
    const recStore = tx.objectStore('ministryRecords');

    const existingById = shipment.id ? await shipStore.get(shipment.id) : undefined;
    if (existingById && existingById.status === 'ACCEPTED' && !existingById.deletedAt) {
      await tx.done;
      return { alreadyAccepted: true, shipment: existingById, records: [] };
    }
    if (shipment.sscc) {
      const sameSscc = await shipStore.index('by-sscc').getAll(shipment.sscc);
      const acceptedSame = sameSscc.find(s => !s.deletedAt && s.status === 'ACCEPTED');
      if (acceptedSame) {
        await tx.done;
        return { alreadyAccepted: true, shipment: acceptedSame, records: [] };
      }
    }

    const allInventory = await invStore.getAll();
    const inventoryUpdates: InventoryItem[] = [];
    const createdRecords: MinistryRecord[] = [];

    for (let idx = 0; idx < (shipment.lines || []).length; idx++) {
      const line = shipment.lines[idx];
      const qty = round2(Math.max(0, Number(line.qty) || 0));
      if (qty <= 0) continue;

      const normGtin = normalizeGtin(line.gtin);
      const nameLower = String(line.name || '').trim().toLocaleLowerCase('tr-TR');
      let existingIdx = -1;
      if (normGtin) {
        existingIdx = allInventory.findIndex(
          i => !i.deletedAt && normalizeGtin(i.gtin || i.barcode) === normGtin
        );
      }
      if (existingIdx === -1 && nameLower) {
        existingIdx = allInventory.findIndex(
          i => !i.deletedAt && i.pesticideName.trim().toLocaleLowerCase('tr-TR') === nameLower
        );
      }

      let targetItem: InventoryItem;
      if (existingIdx !== -1) {
        const existing = allInventory[existingIdx];
        const nextBatches = addBatchStock(ensureInventoryBatches(existing), {
          lotNumber: line.batch,
          expiryDate: line.expiry,
          quantity: qty,
          serialNumbers: line.serial ? [line.serial] : undefined,
          receivedAt: nowIso
        });
        targetItem = applyBatchesToInventoryItem(
          {
            ...existing,
            quantity: round2((Number(existing.quantity) || 0) + qty),
            gtin: existing.gtin || (normGtin || undefined),
            barcode: existing.barcode || (normGtin || undefined),
            lastUpdated: nowIso
          },
          nextBatches
        );
        await invStore.put(targetItem);
        allInventory[existingIdx] = targetItem;
      } else {
        const nextBatches = addBatchStock([], {
          lotNumber: line.batch,
          expiryDate: line.expiry,
          quantity: qty,
          serialNumbers: line.serial ? [line.serial] : undefined,
          receivedAt: nowIso
        });
        targetItem = applyBatchesToInventoryItem(
          {
            id: generateUUID(),
            pesticideId: generateUUID(),
            pesticideName: line.name,
            category: PesticideCategory.OTHER,
            quantity: qty,
            unit: 'Adet',
            buyingPrice: opts?.defaultBuyingPrice || 0,
            sellingPrice: opts?.defaultSellingPrice || 0,
            gtin: normGtin || line.gtin || undefined,
            barcode: normGtin || line.gtin || undefined,
            lastUpdated: nowIso
          },
          nextBatches
        );
        await invStore.put(targetItem);
        allInventory.push(targetItem);
      }
      inventoryUpdates.push(targetItem);

      const minRec: MinistryRecord = {
        id: `minrec-ship-${shipment.id || shipment.sscc}-${idx}`,
        system: 'BKTS',
        recordType: 'SHIPMENT_ACCEPT',
        date: nowIso,
        documentNo: shipment.waybillNo,
        supplierName: shipment.senderName,
        sscc: shipment.sscc,
        waybillNo: shipment.waybillNo,
        pesticideId: targetItem.pesticideId,
        productName: line.name,
        gtin: normGtin || line.gtin,
        lotNumber: line.batch,
        serialNumber: line.serial,
        expiryDate: line.expiry,
        quantity: qty,
        unit: targetItem.unit || 'Adet',
        status: 'Dışa Aktarıma Hazır',
        lastUpdated: nowIso
      };
      await recStore.put(minRec);
      createdRecords.push(minRec);
    }

    const acceptedShipment: MinistryShipmentRecord = {
      ...shipment,
      id: shipment.id || generateUUID(),
      status: 'ACCEPTED',
      acceptedAt: nowIso,
      lastUpdated: nowIso
    };
    await shipStore.put(acceptedShipment);
    await tx.done;

    inventoryUpdates.forEach(item => void backgroundSync('inventory', item, { preserveLastUpdated: true }));
    void backgroundSync('ministryShipments', acceptedShipment, { preserveLastUpdated: true });
    createdRecords.forEach(rec => void backgroundSync('ministryRecords', rec, { preserveLastUpdated: true }));

    return { alreadyAccepted: false, shipment: acceptedShipment, records: createdRecords };
  },

  /**
   * B-14 & AK-17: Atomic sequential document counter (`REC-2026-0001`) guaranteed
   * never to collide with existing active or soft-deleted prescriptions.
   */
  async nextDocumentCounter(prefix = 'REC', year = new Date().getFullYear()): Promise<string> {
    const cleanPrefix = String(prefix || 'REC').trim().toUpperCase();
    const cleanYear = Number.isFinite(year) ? year : new Date().getFullYear();
    const counterKey = `${cleanPrefix}-${cleanYear}`;
    const fmt = (n: number) => `${cleanPrefix}-${cleanYear}-${String(n).padStart(4, '0')}`;
    const pattern = new RegExp(`^${cleanPrefix}-${cleanYear}-(\\d+)$`);

    const db = await initDB();
    const tx = db.transaction(['counters', 'prescriptions'], 'readwrite');
    const counterStore = tx.objectStore('counters');
    const rxStore = tx.objectStore('prescriptions');

    const [existingCounter, allPrescriptions] = await Promise.all([
      counterStore.get(counterKey),
      rxStore.getAll()
    ]);

    let maxFound = existingCounter?.value || 0;
    const taken = new Set<string>();
    for (const rx of allPrescriptions) {
      if (rx.id) {
        taken.add(rx.id);
        const mId = pattern.exec(rx.id);
        if (mId) maxFound = Math.max(maxFound, parseInt(mId[1], 10) || 0);
      }
      if (rx.prescriptionNo) {
        taken.add(rx.prescriptionNo);
        const mNo = pattern.exec(rx.prescriptionNo);
        if (mNo) maxFound = Math.max(maxFound, parseInt(mNo[1], 10) || 0);
      }
    }

    let nextNum = maxFound + 1;
    let candidate = fmt(nextNum);
    let guard = 0;
    while (taken.has(candidate) && guard++ < 10000) {
      nextNum++;
      candidate = fmt(nextNum);
    }

    await counterStore.put({
      id: counterKey,
      value: nextNum,
      updatedAt: new Date().toISOString()
    });
    await tx.done;

    return candidate;
  },

  // --- EDM WAREHOUSE INDEXEDDB MIRROR (AK-12) ---
  async saveEdmData(key: string, data: any): Promise<void> {
    if (!key) return;
    const db = await initDB();
    await db.put('edmData', {
      id: key,
      data,
      updatedAt: new Date().toISOString()
    });
  },

  async getEdmData<T = any>(key: string): Promise<T | null> {
    if (!key) return null;
    const db = await initDB();
    const rec = await db.get('edmData', key);
    return rec ? (rec.data as T) : null;
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
                         propStr.startsWith('softDelete') ||
                         propStr.startsWith('transfer') ||
                         propStr.startsWith('accept') ||
                         propStr.startsWith('process') ||
                         propStr.startsWith('revert') ||
                         propStr.startsWith('perform')) && 
                         propStr !== 'saveUserProfile' &&
                         propStr !== 'saveSatelliteCache' &&
                         propStr !== 'saveEdmData' &&
                         propStr !== 'updatePortalInquiryStatus' &&
                         propStr !== 'clearLocalUserData' &&
                         propStr !== 'cleanupOldNotifications' &&
                         propStr !== 'deleteAllUserData';
                         
      if (isMutating) {
        return async (...args: any[]) => {
          const isRootAdmin = auth.currentUser?.email === 'nayiffirat@gmail.com';
          if (isActionBlocked && !isRootAdmin) {
            if (onActionBlocked) onActionBlocked();
            throw new Error('SUBSCRIPTION_EXPIRED');
          }
          return (value as Function).apply(target, args);
        };
      }
      return (value as Function).bind(target);
    }
    return value;
  }
}) as typeof dbServiceObj;

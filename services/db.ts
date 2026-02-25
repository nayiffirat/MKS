
import { openDB, DBSchema } from 'idb';
import { Farmer, Pesticide, VisitLog, Prescription, AppNotification, UserProfile, Reminder } from '../types';
import { MOCK_PESTICIDES } from '../constants';
import { db as firestore, auth } from './firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch, query, where, getDoc } from 'firebase/firestore';

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
}

const DB_NAME = 'agri-engineer-db';
const DB_VERSION = 10;

const FS_ROOT = "MKS";
const FS_ORG = "g892bEaJyGfEq1Fa67yb";
const FS_USERS = "users";

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

  // UI'ı engellememek için async/await'siz arka plana atıyoruz
  setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, data.id), data, { merge: true })
    .catch(err => console.warn(`Background sync failed for ${collectionName}:`, err));
};

const backgroundDelete = async (collectionName: string, id: string) => {
  if (!navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;

  deleteDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, user.uid, collectionName, id))
    .catch(err => console.warn(`Background delete failed for ${collectionName}:`, err));
};

export const dbService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const local = localStorage.getItem('mks_user_profile');
    if (local) return JSON.parse(local);

    if (navigator.onLine) {
        try {
            const snap = await getDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid));
            if (snap.exists()) {
                const profile = snap.data() as UserProfile;
                localStorage.setItem('mks_user_profile', JSON.stringify(profile));
                return profile;
            }
        } catch (e) {}
    }
    return null;
  },

  async saveUserProfile(uid: string, profile: UserProfile) {
    localStorage.setItem('mks_user_profile', JSON.stringify(profile));
    if (navigator.onLine) {
        setDoc(doc(firestore, FS_ROOT, FS_ORG, FS_USERS, uid), { ...profile, lastUpdate: new Date().toISOString() }, { merge: true })
            .catch(() => {});
    }
  },

  /**
   * Giriş yapıldığında tüm verileri çeker ve yerelle birleştirir.
   */
  async syncAllDataOnLogin(uid: string) {
    if (!navigator.onLine) return;
    const db = await initDB();
    const userPath = [FS_ROOT, FS_ORG, FS_USERS, uid].join("/");
    const collections = ["farmers", "notifications", "visits", "prescriptions", "reminders"] as const;

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
    const stores = ['farmers', 'visits', 'prescriptions', 'notifications', 'reminders'] as const;
    for (const store of stores) await db.clear(store);
    localStorage.removeItem('mks_user_profile');
  },

  async getFarmers() {
    const db = await initDB();
    return (await db.getAll('farmers')).sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
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
          setDoc(doc(firestore, 'pesticides', pesticide.id), pesticide).catch(() => {});
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
  }
};

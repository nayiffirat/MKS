import { initializeApp } from "firebase/app";
import { Capacitor } from "@capacitor/core";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  GoogleAuthProvider
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  memoryLruGarbageCollector
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const isNativeCapacitor =
  Capacitor.isNativePlatform() ||
  (typeof window !== 'undefined' && window.location?.protocol === 'capacitor:');

function createAuthInstance() {
  if (isNativeCapacitor) {
    try {
      return initializeAuth(app, {
        persistence: [browserLocalPersistence, indexedDBLocalPersistence]
      });
    } catch (err) {
      console.warn("Native initializeAuth fallback to getAuth:", err);
    }
  }
  return getAuth(app);
}

export const auth = createAuthInstance();
export const googleProvider = new GoogleAuthProvider();

function createFirestoreInstance() {
  if (isNativeCapacitor) {
    return initializeFirestore(app, {
      localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }),
      experimentalAutoDetectLongPolling: true
    });
  }
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
        experimentalAutoDetectLongPolling: true
      });
    } catch (err) {
      console.warn("Firestore persistentLocalCache unavailable, falling back to memoryLocalCache:", err);
    }
  }
  return initializeFirestore(app, {
    localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() }),
    experimentalAutoDetectLongPolling: true
  });
}

export const db = createFirestoreInstance();
export const storage = getStorage(app);

// Offline persistence is backed by IndexedDB write-ahead syncOutbox (services/db.ts) and Firestore persistentLocalCache on Web/Desktop

export default app;
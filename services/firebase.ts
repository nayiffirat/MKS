import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  memoryLruGarbageCollector,
  doc,
  getDocFromServer
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

function createFirestoreInstance() {
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch (err) {
      console.warn("Firestore persistentLocalCache unavailable, falling back to memoryLocalCache:", err);
    }
  }
  return initializeFirestore(app, {
    localCache: memoryLocalCache({ garbageCollector: memoryLruGarbageCollector() })
  });
}

export const db = createFirestoreInstance();
export const storage = getStorage(app);

// Offline persistence is backed by Firestore persistentLocalCache + IndexedDB write-ahead syncOutbox (services/db.ts)

// CRITICAL: Validate Connection to Firestore on boot
async function testConnection() {
  try {
    // Attempt to read a non-existent document to check connectivity
    // We use getDocFromServer to bypass local cache
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration and internet connection.");
    } else {
      console.log("Firebase initialized (connection test completed).");
    }
  }
}

// Only run test in browser context
if (typeof window !== 'undefined') {
  testConnection();
}

export default app;
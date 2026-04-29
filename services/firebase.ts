import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// The database ID must be provided to getFirestore for Enterprise edition (which is the default in AI Studio)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Firestore persistence error:", err.code);
  });
}

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
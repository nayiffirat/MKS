import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuration updated based on the Web SDK credentials from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBR2JWNFbh7M93x3i7wy7LrXdaEDxUrpLs",
  authDomain: "muhendiskayitsistemi.firebaseapp.com",
  projectId: "muhendiskayitsistemi",
  storageBucket: "muhendiskayitsistemi.firebasestorage.app",
  messagingSenderId: "92102884744",
  appId: "1:92102884744:web:800acd065ea854076a4e3d",
  measurementId: "G-40SCW715YY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    console.warn("Firestore persistence error:", err.code);
  });
}

// Note: Analytics is typically handled by the native Android SDK when building an APK.
// Web-based Analytics (getAnalytics) is disabled here to prevent measurement ID mismatch warnings.

export default app;
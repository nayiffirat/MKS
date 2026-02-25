import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration updated based on provided google-services.json
// measurementId removed to avoid server mismatch warnings in hybrid/native environment
const firebaseConfig = {
  apiKey: "AIzaSyAvQQQmN-VpuhYKdz2fHFgGCpmDw58pnJg", 
  authDomain: "muhendiskayitsistemi.firebaseapp.com",
  projectId: "muhendiskayitsistemi",
  storageBucket: "muhendiskayitsistemi.firebasestorage.app",
  messagingSenderId: "92102884744",
  appId: "1:92102884744:android:99fb4a56d9b4a4576a4e3d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Note: Analytics is typically handled by the native Android SDK when building an APK.
// Web-based Analytics (getAnalytics) is disabled here to prevent measurement ID mismatch warnings.

export default app;
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
    User, 
    onAuthStateChanged, 
    signOut, 
    setPersistence, 
    browserLocalPersistence,
    getRedirectResult 
} from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { dbService } from '../services/db';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
    currentUser: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const syncUserToFirestore = async (user: User) => {
        try {
            // Updated to use the correct path provided in your previous config turn
            const userRef = doc(db, "MKS", "g892bEaJyGfEq1Fa67yb", "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email || '',
                    fullName: user.displayName || 'İsimsiz Kullanıcı',
                    role: 'user',
                    subscriptionStatus: 'active',
                    subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    photoURL: user.photoURL || ''
                });
            } else {
                await setDoc(userRef, { lastLogin: new Date().toISOString() }, { merge: true });
            }
        } catch (err) {
            console.error("Central Sync Error:", err);
        }
    };

    useEffect(() => {
        // Handle Global Redirect Results (Flawless Bridge)
        const checkAuthResults = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    console.log("Redirect result captured globally!");
                    await syncUserToFirestore(result.user);
                }
            } catch (error: any) {
                console.error("Global Auth Redirect Error:", error);
            }
        };
        checkAuthResults();

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && user.email) {
                localStorage.setItem('mks_user_email', user.email);
                
                // Track user ID for IndexedDB isolation
                const lastUid = localStorage.getItem('lastUserId');
                if (lastUid && lastUid !== user.uid) {
                    console.log("Farklı bir kullanıcı algılandı. Veritabanı adı 'lastUserId' ile izole edilecek.");
                }
                localStorage.setItem('lastUserId', user.uid);
            }
            setCurrentUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        try {
            await dbService.clearLocalData();
        } catch (e) {
            console.error("Local veri temizleme hatası:", e);
        }
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ currentUser, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
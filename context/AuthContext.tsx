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
            // Tek merkezden (dbService.getUserProfile) profil ve abonelik kontrolü yapılır
            await dbService.getUserProfile(user.uid);
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
                    console.log("Farklı bir kullanıcı algılandı. Bekleyen senkronizasyon kuyruğu aktarılıyor...");
                    await dbService.flushSyncOutboxNow().catch(e => console.warn("Kullanıcı değişimi outbox flush uyarısı:", e));
                    const remainingOldOutbox = await dbService.getPendingOutboxCount(lastUid).catch(() => 0);
                    if (remainingOldOutbox === 0) {
                        await dbService.clearLocalData().catch(e => console.error("Kullanıcı değişimi temizlik hatası:", e));
                    } else {
                        console.warn(`[AK-01] Önceki kullanıcıya (${lastUid}) ait ${remainingOldOutbox} bekleyen çevrimdışı kayıt korundu.`);
                    }
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
            await dbService.flushSyncOutboxNow();
        } catch (e) {
            console.warn("Çıkış öncesi outbox flush hatası:", e);
        }

        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const pendingCount = await dbService.getPendingOutboxCount().catch(() => 0);

        if (isOffline || pendingCount > 0) {
            const warningMsg = pendingCount > 0
                ? `Buluta henüz aktarılamamış ${pendingCount} adet çevrimdışı kaydınız var${isOffline ? ' ve internet bağlantınız yok' : ''}.\n\nŞimdi çıkış yaparsanız yerel veritabanı temizleneceği için bu kayıtlar kaybolabilir. Yine de çıkış yapmak istiyor musunuz?`
                : 'İnternet bağlantınız şu an çevrimdışı görünüyor. Buluta henüz aktarılmamış yerel değişiklikleriniz varsa çıkış yaptığınızda silinebilir.\n\nYine de çıkış yapmak istiyor musunuz?';
            const confirmed = typeof window !== 'undefined' ? window.confirm(warningMsg) : true;
            if (!confirmed) {
                return;
            }
        }

        try {
            await dbService.clearLocalUserData(true);
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
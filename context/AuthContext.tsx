import React, { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
    User, 
    onAuthStateChanged, 
    signOut, 
    getRedirectResult 
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { dbService } from '../services/db';

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
        const authFailsafe = window.setTimeout(() => {
            setLoading(false);
        }, 2000);

        // Handle Global Redirect Results on Web only (skip on native Capacitor WKWebView)
        if (!Capacitor.isNativePlatform()) {
            const checkAuthResults = async () => {
                try {
                    const result = await getRedirectResult(auth);
                    if (result) {
                        void syncUserToFirestore(result.user);
                    }
                } catch (error: any) {
                    console.error("Global Auth Redirect Error:", error);
                }
            };
            void checkAuthResults();
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            window.clearTimeout(authFailsafe);
            if (user) {
                if (user.email) {
                    localStorage.setItem('mks_user_email', user.email);
                }
                // Track user ID for IndexedDB isolation
                const lastUid = localStorage.getItem('lastUserId');
                if (lastUid && lastUid !== user.uid) {
                    localStorage.removeItem('mks_user_profile');
                    localStorage.removeItem('userProfile');
                    localStorage.removeItem(`mks_pending_profile_sync_${lastUid}`);
                    localStorage.removeItem(`mks_map_features_${lastUid}`);
                    localStorage.removeItem(`mks_ministry_records_v1_${lastUid}`);
                    localStorage.removeItem(`mks_ministry_shipments_v1_${lastUid}`);
                }
                localStorage.setItem('lastUserId', user.uid);
            }
            setCurrentUser(user);
            setLoading(false);

            if (user) {
                void dbService.flushSyncOutboxNow().catch((e) => console.warn("Auth init outbox flush uyarısı:", e));
            }
        });

        return () => {
            window.clearTimeout(authFailsafe);
            unsubscribe();
        };
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
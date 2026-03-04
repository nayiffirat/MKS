
import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Farmers } from './components/Farmers';
import { Pesticides } from './components/Pesticides';
import { PrescriptionForm } from './components/Prescription';
import { VisitLogForm } from './components/Visits';
import { NewsScreen } from './components/News';
import { SettingsScreen } from './components/Settings';
import { ContactScreen } from './components/Contact';
import { NotificationsScreen } from './components/Notifications';
import { ProfileScreen } from './components/Profile';
import { LoginScreen } from './components/Login';
import { StatisticsScreen } from './components/Statistics';
import { FieldAssistant } from './components/FieldAssistant';
import { RemindersScreen } from './components/Reminders';
import { InventoryScreen } from './components/Inventory';
import { AppProvider, useAppViewModel } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { dbService } from './services/db';
import { Loader2 } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

function MainApp() {
  const { currentUser, loading } = useAuth();
  const { userProfile, updateUserProfile, refreshStats } = useAppViewModel();
  
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [prescriptionFarmerId, setPrescriptionFarmerId] = useState<string | undefined>(undefined);
  const [isPrescriptionMode, setIsPrescriptionMode] = useState(false);
  const [isVisitMode, setIsVisitMode] = useState(false);
  const [isReminderAddMode, setIsReminderAddMode] = useState(false);
  const [isTomorrowMode, setIsTomorrowMode] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Native Features Initialization (StatusBar & AdMob)
  useEffect(() => {
    const initNativeFeatures = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // AdMob Başlatma (Firebase Entegrasyonu için Kritik)
          await AdMob.initialize();

          // Status Bar Ayarları
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#0c0a09' });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch (e) {
          console.error("Native Features Initialization Error:", e);
        }
      }
    };

    initNativeFeatures();
  }, []);

  // Eşitleme ve ilk yükleme mantığı
  useEffect(() => {
    const initializeAppData = async () => {
        if (currentUser && !loading) {
            // 1. ADIM: Telefonda ne varsa hemen yükle (Offline-First)
            await refreshStats();
            setInitialDataLoaded(true);

            // 2. ADIM: İnternet varsa arka planda senkronize et
            if (navigator.onLine) {
                try {
                    // Profil ve İlaç Kütüphanesi
                    const cloudProfile = await dbService.getUserProfile(currentUser.uid);
                    if (cloudProfile) updateUserProfile(cloudProfile);
                    await dbService.syncGlobalPesticides();
                    
                    // Verileri buluttan çek ve yerelle birleştir
                    await dbService.syncAllDataOnLogin(currentUser.uid);
                    
                    // Veriler güncellenmiş olabilir, tekrar arayüzü yenile
                    await refreshStats();
                } catch (e) {
                    console.warn("Background sync failed, using local data.");
                }
            }
        }
    };
    initializeAppData();
  }, [currentUser, loading]);

  // Refs for stable access in back button callback
  const currentViewRef = useRef<ViewState>('DASHBOARD');
  const isModeActiveRef = useRef<boolean>(false);

  useEffect(() => {
    currentViewRef.current = currentView;
    isModeActiveRef.current = isPrescriptionMode || isVisitMode || isReminderAddMode || isTomorrowMode;
  }, [currentView, isPrescriptionMode, isVisitMode, isReminderAddMode, isTomorrowMode]);

  useEffect(() => {
    let listenerHandle: any;
    
    const initBackButton = async () => {
        try {
            listenerHandle = await CapacitorApp.addListener('backButton', () => {
                // Check history state first for sub-views (like in PrescriptionForm)
                const historyState = window.history.state;
                
                const hasSubView = historyState?.subView;
                const isDashboard = currentViewRef.current === 'DASHBOARD';
                const hasMode = isModeActiveRef.current;

                if (hasSubView || hasMode || !isDashboard) {
                    window.history.back();
                } else {
                    CapacitorApp.exitApp();
                }
            });
        } catch (err) {
            console.error('Back button listener error:', err);
        }
    };

    initBackButton();

    return () => {
        if (listenerHandle) listenerHandle.remove();
    };
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        const state = event.state;
        if (state?.view) {
            setCurrentView(state.view);
            setIsPrescriptionMode(state.mode === 'prescription_new');
            setIsVisitMode(state.mode === 'visit_new');
            setIsReminderAddMode(state.mode === 'reminders_new');
            setIsTomorrowMode(state.mode === 'reminders_tomorrow');
            setPrescriptionFarmerId(state.farmerId);
        } else {
            setCurrentView('DASHBOARD');
            setIsPrescriptionMode(false);
            setIsVisitMode(false);
            setIsReminderAddMode(false);
            setIsTomorrowMode(false);
        }
    };
    window.addEventListener('popstate', handlePopState);
    if (!window.history.state) window.history.replaceState({ view: 'DASHBOARD' }, '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (view: string) => {
    let nextView = view as ViewState;
    let mode: string | undefined = undefined;
    let farmerId: string | undefined = undefined;

    if (view === 'PRESCRIPTION_NEW') {
        nextView = 'PRESCRIPTIONS';
        mode = 'prescription_new';
        setIsPrescriptionMode(true);
    } else if (view === 'VISIT_NEW') {
        nextView = 'VISITS';
        mode = 'visit_new';
        setIsVisitMode(true);
    } else if (view === 'REMINDERS_NEW') {
        nextView = 'REMINDERS';
        mode = 'reminders_new';
        setIsReminderAddMode(true);
    } else if (view === 'REMINDERS_TOMORROW') {
        nextView = 'REMINDERS';
        mode = 'reminders_tomorrow';
        setIsTomorrowMode(true);
    }

    window.history.pushState({ view: nextView, mode, farmerId }, '');
    setCurrentView(nextView);
  };

  const handleStartPrescription = (fId: string) => {
      window.history.pushState({ view: 'PRESCRIPTIONS', mode: 'prescription_new', farmerId: fId }, '');
      setPrescriptionFarmerId(fId);
      setIsPrescriptionMode(true);
      setCurrentView('PRESCRIPTIONS');
  };

  // Auth loading
  if (loading || (currentUser && !initialDataLoaded)) {
      return (
          <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center">
              <Loader2 size={32} className="animate-spin text-emerald-500 mb-4" />
              <p className="text-stone-500 text-xs">Veriler Yükleniyor...</p>
          </div>
      );
  }

  if (!currentUser) return <LoginScreen />;

  const renderContent = () => {
    if (isPrescriptionMode) return <PrescriptionForm onBack={() => window.history.back()} initialFarmerId={prescriptionFarmerId} />;
    if (currentView === 'VISITS' && isVisitMode) return <VisitLogForm onBack={() => window.history.back()} />;
    if (currentView === 'REMINDERS') return <RemindersScreen onBack={() => window.history.back()} initialAddMode={isReminderAddMode} initialFilter={isTomorrowMode ? 'TOMORROW' : undefined} />;
    if (currentView === 'FIELD_ASSISTANT') return <FieldAssistant onBack={() => window.history.back()} />;

    switch (currentView as any) {
        case 'DASHBOARD': return <Dashboard onNavigate={handleNavigate} />;
        case 'FARMERS': return <Farmers onBack={() => window.history.back()} onNavigateToPrescription={handleStartPrescription} />;
        case 'PESTICIDES': return <Pesticides />;
        case 'PRESCRIPTIONS': return <PrescriptionForm onBack={() => window.history.back()} />;
        case 'VISITS': return <VisitLogForm onBack={() => window.history.back()} />;
        case 'NEWS': return <NewsScreen onBackToDashboard={() => window.history.back()} />;
        case 'CONTACT': return <ContactScreen />;
        case 'SETTINGS': return <SettingsScreen onNavigate={handleNavigate} />;
        case 'NOTIFICATIONS': return <NotificationsScreen onBack={() => window.history.back()} />;
        case 'PROFILE': return <ProfileScreen onBack={() => window.history.back()} />;
        case 'STATISTICS': return <StatisticsScreen />;
        case 'REMINDERS': return <RemindersScreen onBack={() => window.history.back()} />;
        case 'INVENTORY': return <InventoryScreen />;
        default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={handleNavigate}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
        <AppProvider>
             <MainApp />
        </AppProvider>
    </AuthProvider>
  )
}

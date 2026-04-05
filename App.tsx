
import React, { useState, useEffect, useRef } from 'react';
import { ViewState } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Farmers } from './components/Farmers';
import { Pesticides } from './components/Pesticides';
import { PrescriptionForm } from './components/Prescription';
import { DeletedPrescriptions } from './components/DeletedPrescriptions';
import { VisitLogForm } from './components/Visits';
import { SettingsScreen } from './components/Settings';
import { ContactScreen } from './components/Contact';
import { NotificationsScreen } from './components/Notifications';
import { ProfileScreen } from './components/Profile';
import { LoginScreen } from './components/Login';
import { TeamLoginScreen } from './components/TeamLogin';
import { TeamScreen } from './components/TeamScreen';
import { MessagesScreen } from './components/MessagesScreen';
import { PerformanceScreen } from './components/PerformanceScreen';
import { StatisticsScreen } from './components/Statistics';
import { RemindersScreen } from './components/Reminders';
import { InventoryScreen } from './components/Inventory';
import { ExpensesScreen } from './components/Expenses';
import { Kasa } from './components/Kasa';
import { Suppliers } from './components/Suppliers';
import { Payments } from './components/Payments';
import { ProducerPortal } from './components/ProducerPortal';
import { AiAssistant } from './components/AiAssistant';
import { Calculator } from './components/Calculator';
import { MixtureTest } from './components/MixtureTest';
import { RecentTransactions } from './components/RecentTransactions';
import { Reports } from './components/Reports';
import { AdminPanel } from './components/AdminPanel';
import { SubscriptionLock } from './components/SubscriptionLock';
import { AppProvider, useAppViewModel } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { dbService } from './services/db';
import { Loader2, MessageCircle, X } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

function MainApp() {
  const { currentUser, loading } = useAuth();
  const { userProfile, updateUserProfile, syncUserProfile, refreshStats, isAdmin, subscriptionEndsAt, activeTeamMember } = useAppViewModel();
  
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [prescriptionFarmerId, setPrescriptionFarmerId] = useState<string | undefined>(undefined);
  const [editPrescriptionId, setEditPrescriptionId] = useState<string | undefined>(undefined);
  const [editVisitId, setEditVisitId] = useState<string | undefined>(undefined);
  const [isPrescriptionMode, setIsPrescriptionMode] = useState(false);
  const [isVisitMode, setIsVisitMode] = useState(false);
  const [isReminderAddMode, setIsReminderAddMode] = useState(false);
  const [isTomorrowMode, setIsTomorrowMode] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [portalFarmerId, setPortalFarmerId] = useState<string | null>(null);
  const [portalEngineerId, setPortalEngineerId] = useState<string | null>(null);
  const [hasSetAdminInitialView, setHasSetAdminInitialView] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  useEffect(() => {
    if (!currentUser) {
      setInitialDataLoaded(false);
      setHasSetAdminInitialView(false);
      setCurrentView('DASHBOARD');
    } else {
      if (localStorage.getItem('mks_show_welcome') === 'true') {
        setShowWelcomeModal(true);
        localStorage.removeItem('mks_show_welcome');
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (initialDataLoaded && isAdmin && !hasSetAdminInitialView && currentView === 'DASHBOARD') {
      setCurrentView('ADMIN_PANEL');
      setHasSetAdminInitialView(true);
    }
  }, [initialDataLoaded, isAdmin, hasSetAdminInitialView, currentView]);

  // Native Features Initialization (StatusBar & AdMob)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const portalId = params.get('portalId');
    const engineerId = params.get('engineerId');
    if (portalId) {
      setPortalFarmerId(portalId);
      setPortalEngineerId(engineerId);
      setCurrentView('PRODUCER_PORTAL');
    }

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
    let cleanupSync: (() => void) | undefined;
    
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
                    
                    // 3. ADIM: Gerçek zamanlı senkronizasyonu başlat (Çoklu cihaz desteği)
                    cleanupSync = dbService.setupRealtimeSync(currentUser.uid, () => {
                        refreshStats();
                    }, (updatedProfile) => {
                        syncUserProfile(updatedProfile);
                    });

                    // Veriler güncellenmiş olabilir, tekrar arayüzü yenile
                    await refreshStats();
                } catch (e) {
                    console.warn("Background sync failed, using local data.");
                }
            }
        }
    };
    
    initializeAppData();
    
    return () => {
        if (cleanupSync) cleanupSync();
    };
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
                const hasModal = historyState?.modal;
                const hasQuickActionsOpen = historyState?.quickActionsOpen;
                const isDashboard = currentViewRef.current === 'DASHBOARD';
                const isAdminPanel = currentViewRef.current === 'ADMIN_PANEL';
                const hasMode = isModeActiveRef.current;

                if (hasSubView || hasModal || hasQuickActionsOpen || hasMode || (!isDashboard && !isAdminPanel)) {
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
            setIsPrescriptionMode(state.mode === 'prescription_new' || state.mode === 'prescription_edit');
            setIsVisitMode(state.mode === 'visit_new' || state.mode === 'visit_edit');
            setIsReminderAddMode(state.mode === 'reminders_new');
            setIsTomorrowMode(state.mode === 'reminders_tomorrow');
            setPrescriptionFarmerId(state.farmerId);
            setEditPrescriptionId(state.prescriptionId);
            setEditVisitId(state.visitId);
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

    // Reset all special modes when navigating to a new view
    setIsPrescriptionMode(false);
    setIsVisitMode(false);
    setIsReminderAddMode(false);
    setIsTomorrowMode(false);
    setPrescriptionFarmerId(undefined);
    setEditPrescriptionId(undefined);
    setEditVisitId(undefined);

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
      setEditPrescriptionId(undefined);
      setIsPrescriptionMode(true);
      setCurrentView('PRESCRIPTIONS');
  };

  const handleEditPrescription = (pId: string) => {
      window.history.pushState({ view: 'PRESCRIPTIONS', mode: 'prescription_edit', prescriptionId: pId }, '');
      setEditPrescriptionId(pId);
      setPrescriptionFarmerId(undefined);
      setIsPrescriptionMode(true);
      setCurrentView('PRESCRIPTIONS');
  };

  const handleEditVisit = (vId: string) => {
      window.history.pushState({ view: 'VISITS', mode: 'visit_edit', visitId: vId }, '');
      setEditVisitId(vId);
      setIsVisitMode(true);
      setCurrentView('VISITS');
  };

  if (loading || (currentUser && !initialDataLoaded && currentView !== 'PRODUCER_PORTAL')) {
      return (
          <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center">
              <Loader2 size={32} className="animate-spin text-emerald-500 mb-4" />
              <p className="text-stone-500 text-xs">Veriler Yükleniyor...</p>
          </div>
      );
  }

  if (currentView === 'PRODUCER_PORTAL' && portalFarmerId) {
    return <ProducerPortal 
      farmerId={portalFarmerId} 
      engineerId={portalEngineerId || undefined}
      onBack={() => {
        setPortalFarmerId(null);
        setPortalEngineerId(null);
        setCurrentView('DASHBOARD');
        window.history.replaceState({}, '', window.location.pathname);
    }} />;
  }

  if (!currentUser) return <LoginScreen />;

  const renderContent = () => {
    if (isPrescriptionMode) return <PrescriptionForm onBack={() => window.history.back()} initialFarmerId={prescriptionFarmerId} initialPrescriptionId={editPrescriptionId} />;
    if (currentView === 'VISITS' && isVisitMode) return <VisitLogForm onBack={() => window.history.back()} initialVisitId={editVisitId} />;
    if (currentView === 'REMINDERS') return <RemindersScreen onBack={() => window.history.back()} initialAddMode={isReminderAddMode} initialFilter={isTomorrowMode ? 'TOMORROW' : undefined} />;

    switch (currentView as any) {
        case 'DASHBOARD': return <Dashboard onNavigate={handleNavigate} />;
        case 'RECENT_TRANSACTIONS': return <RecentTransactions onSelectFarmer={(id) => { setSelectedFarmerId(id); setCurrentView('FARMERS'); }} />;
        case 'FARMERS': return <Farmers 
            onBack={() => {
                if (selectedFarmerId) setSelectedFarmerId(null);
                else window.history.back();
            }} 
            onNavigateToPrescription={handleStartPrescription} 
            onEditPrescription={handleEditPrescription} 
            onEditVisit={handleEditVisit}
            selectedFarmerId={selectedFarmerId}
            onSelectFarmer={setSelectedFarmerId}
        />;
        case 'PESTICIDES': return <Pesticides />;
        case 'PRESCRIPTIONS': return <PrescriptionForm onBack={() => window.history.back()} />;
        case 'TRASH': return <DeletedPrescriptions onBack={() => window.history.back()} />;
        case 'VISITS': return <VisitLogForm onBack={() => window.history.back()} />;
        case 'CONTACT': return <ContactScreen />;
        case 'SETTINGS': return <SettingsScreen onNavigate={handleNavigate} />;
        case 'NOTIFICATIONS': return <NotificationsScreen onBack={() => window.history.back()} />;
        case 'PROFILE': return <ProfileScreen onBack={() => window.history.back()} />;
        case 'STATISTICS': return <StatisticsScreen />;
        case 'REMINDERS': return <RemindersScreen onBack={() => window.history.back()} />;
        case 'INVENTORY': return <InventoryScreen />;
        case 'KASA': return <Kasa onBack={() => window.history.back()} />;
        case 'EXPENSES': return <ExpensesScreen onBack={() => window.history.back()} />;
        case 'SUPPLIERS': return <Suppliers onBack={() => window.history.back()} />;
        case 'PAYMENTS': return <Payments onBack={() => window.history.back()} />;
        case 'CALCULATOR': return <Calculator onBack={() => window.history.back()} />;
        case 'MIXTURE_TEST': return <MixtureTest onBack={() => window.history.back()} />;
        case 'REPORTS': return <Reports />;
        case 'TEAM': return <TeamScreen onBack={() => window.history.back()} />;
        case 'MESSAGES': return <MessagesScreen onBack={() => window.history.back()} />;
        case 'PERFORMANCE': return <PerformanceScreen onBack={() => window.history.back()} />;
        case 'ADMIN_PANEL': return isAdmin ? <AdminPanel onBack={() => window.history.back()} /> : <Dashboard onNavigate={handleNavigate} />;
        default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const renderWelcomeModal = () => {
    if (!showWelcomeModal) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-stone-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-white">Hoşgeldiniz!</h3>
            <button onClick={() => setShowWelcomeModal(false)} className="text-stone-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
          <p className="text-stone-300 mb-6 leading-relaxed">
            Hoşgeldiniz, 1 haftalık deneme süresi başlamıştır. Satın alım için yöneticiyle iletişime geçiniz.
          </p>
          <a 
            href="https://wa.me/905428254087" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold flex items-center justify-center transition-colors"
          >
            <MessageCircle className="mr-2" size={20} />
            WhatsApp ile İletişime Geç
          </a>
        </div>
      </div>
    );
  };

  return (
    <Layout currentView={currentView} onNavigate={handleNavigate}>
      {renderContent()}
      {renderWelcomeModal()}
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

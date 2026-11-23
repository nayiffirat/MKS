import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { ViewState, PesticideCategory, MinistryRecord, MinistryShipmentRecord } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { LoginScreen } from './components/Login';
import { AppProvider, useAppViewModel } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { dbService } from './services/db';
import { Loader2, MessageCircle } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  executeSmartBackStep,
  initGlobalNavigationAndScrollGuard,
  EdgeSwipeBackGesture,
  useBackHandler,
  shouldAllowAppExit,
  getBackStackDepth
} from './utils/navigationManager';
import { useHardwareBarcodeScanner } from './utils/hardwareBarcodeScanner';
import {
  ensurePreUpdateSafetySnapshot,
  isWebOrDesktopRestrictedForUser,
  maybeShowFreeTierAd,
  isViewAllowedForUser,
  isFeatureEnabledForUser,
  syncSubscriptionConfigFromCloud
} from './utils/subscriptionManager';
import { MinistryIntegrationModal, type FactoryShipment, type MinistryConfig } from './components/MinistryIntegrationModal';
import { EdmIntegrationModal } from './components/EdmIntegrationModal';
import { EFaturaPanel, EFaturaPrefill } from './components/EFaturaPanel';
import { scheduleIntegrityCheck } from './services/integrity';
import { syncScheduledNotifications, requestEssentialPermissionsOnce } from './utils/scheduledNotifications';
import { WebLandingPortal } from './components/WebLandingPortal';
import { LiveSupportWidget } from './components/LiveSupportWidget';
import { MksBrandLogo } from './components/MksBrandLogo';
import { DesktopWindowTitlebar } from './components/DesktopWindowTitlebar';
import { initNotificationInfrastructure } from './utils/smartNotificationEngine';
import ModalCloseButton from './components/ModalCloseButton';
import { SUPPORT_WHATSAPP } from './constants';
import { buildWaUrl } from './utils/whatsappTemplates';
import { getLocalDateString } from './utils/dateUtils';
import { generateUUID } from './utils/uuid';

// Lazy-loaded screens for fast initial boot and code splitting
const Farmers = lazy(() => import('./components/Farmers').then(m => ({ default: m.Farmers })));
const Pesticides = lazy(() => import('./components/Pesticides').then(m => ({ default: m.Pesticides })));
const PrescriptionForm = lazy(() => import('./components/Prescription').then(m => ({ default: m.PrescriptionForm })));
const DeletedPrescriptions = lazy(() => import('./components/DeletedPrescriptions').then(m => ({ default: m.DeletedPrescriptions })));
const VisitLogForm = lazy(() => import('./components/Visits').then(m => ({ default: m.VisitLogForm })));
const SettingsScreen = lazy(() => import('./components/Settings').then(m => ({ default: m.SettingsScreen })));
const ContactScreen = lazy(() => import('./components/Contact').then(m => ({ default: m.ContactScreen })));
const NotificationsScreen = lazy(() => import('./components/Notifications').then(m => ({ default: m.NotificationsScreen })));
const ProfileScreen = lazy(() => import('./components/Profile').then(m => ({ default: m.ProfileScreen })));
const TeamScreen = lazy(() => import('./components/TeamScreen').then(m => ({ default: m.TeamScreen })));
const MessagesScreen = lazy(() => import('./components/MessagesScreen').then(m => ({ default: m.MessagesScreen })));
const PerformanceScreen = lazy(() => import('./components/PerformanceScreen').then(m => ({ default: m.PerformanceScreen })));
const StatisticsScreen = lazy(() => import('./components/Statistics').then(m => ({ default: m.StatisticsScreen })));
const RemindersScreen = lazy(() => import('./components/Reminders').then(m => ({ default: m.RemindersScreen })));
const InventoryScreen = lazy(() => import('./components/Inventory').then(m => ({ default: m.InventoryScreen })));
const DebtTracking = lazy(() => import('./components/DebtTracking').then(m => ({ default: m.DebtTracking })));
const ExpensesScreen = lazy(() => import('./components/Expenses').then(m => ({ default: m.ExpensesScreen })));
const Kasa = lazy(() => import('./components/Kasa').then(m => ({ default: m.Kasa })));
const Suppliers = lazy(() => import('./components/Suppliers').then(m => ({ default: m.Suppliers })));
const Payments = lazy(() => import('./components/Payments').then(m => ({ default: m.Payments })));
const ProducerPortal = lazy(() => import('./components/ProducerPortal').then(m => ({ default: m.ProducerPortal })));
const MKSMuhendisim = lazy(() => import('./components/MKSMuhendisim').then(m => ({ default: m.MKSMuhendisim })));
const Calculator = lazy(() => import('./components/Calculator').then(m => ({ default: m.Calculator })));
const RecentTransactions = lazy(() => import('./components/RecentTransactions').then(m => ({ default: m.RecentTransactions })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const News = lazy(() => import('./components/News').then(m => ({ default: m.News })));
const Plants = lazy(() => import('./components/Plants').then(m => ({ default: m.Plants })));
const AIAssistant = lazy(() => import('./components/AIAssistant').then(m => ({ default: m.AIAssistant })));
const SmartStock = lazy(() => import('./components/SmartStock').then(m => ({ default: m.SmartStock })));
const SiloScreen = lazy(() => import('./components/SiloScreen').then(m => ({ default: m.SiloScreen })));
const RegionalAlerts = lazy(() => import('./components/RegionalAlerts').then(m => ({ default: m.RegionalAlerts })));
const MapComponent = lazy(() => import('./components/MapComponent').then(m => ({ default: m.MapComponent })));
const UserGuide = lazy(() => import('./components/UserGuide').then(m => ({ default: m.UserGuide })));

const ViewLoader = () => (
  <div className="flex flex-col items-center justify-center py-24">
    <Loader2 size={28} className="animate-spin text-emerald-500 mb-3" />
    <p className="text-stone-500 text-xs">Ekran yükleniyor...</p>
  </div>
);

function MainApp() {
  const { currentUser, loading } = useAuth();
  const { syncUserProfile, refreshStats, refreshInventory, refreshNews, refreshPlants, isAdmin, userProfile, inventory, showToast, runSmartNotificationsScan } = useAppViewModel();
  
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
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
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [hasSetAdminInitialView, setHasSetAdminInitialView] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isMinistryModalOpen, setIsMinistryModalOpen] = useState(false);
  const [ministryModalTab, setMinistryModalTab] = useState<'malkabul' | 'satis' | 'esdeger' | 'gts' | 'bkts' | 'brecete'>('malkabul');
  const [ministryPendingShipments, setMinistryPendingShipments] = useState<FactoryShipment[]>([]);
  const [ministryTransactions, setMinistryTransactions] = useState<MinistryRecord[]>([]);
  const [isEdmModalOpen, setIsEdmModalOpen] = useState(false);
  const [isEfaturaOpen, setIsEfaturaOpen] = useState(false);
  const [efaturaPrefill, setEfaturaPrefill] = useState<EFaturaPrefill | null>(null);
  const [efaturaTab, setEfaturaTab] = useState<'issue' | 'out' | 'in' | 'settings'>('issue');
  const [edmModalTab, setEdmModalTab] = useState<'incoming' | 'issue' | 'warehouses' | 'settings'>('incoming');
  const [isWebPortalOpen, setIsWebPortalOpen] = useState(false);
  const [webPortalTab, setWebPortalTab] = useState<'showcase' | 'download' | 'pricing'>('download');
  const [isLiveSupportOpen, setIsLiveSupportOpen] = useState(false);
  const [liveSupportCategory, setLiveSupportCategory] = useState<'general' | 'subscription' | 'password_reset' | 'bkst_gts'>('general');
  const posBarcodeTimerRef = useRef<number | null>(null);

  const refreshMinistryBridgeData = useCallback(async () => {
    try {
      const [ships, recs] = await Promise.all([
        dbService.getMinistryShipments(),
        dbService.getMinistryRecords()
      ]);
      const pendingMapped: FactoryShipment[] = ships
        .filter(s => s.status === 'PENDING' && !s.deletedAt)
        .map(s => ({
          id: s.id,
          irsaliyeNo: s.waybillNo,
          sscc: s.sscc,
          supplierName: s.senderName,
          supplierGln: s.senderGln,
          date: s.date,
          lines: (s.lines || []).map(l => ({
            productName: l.name,
            gtin: l.gtin,
            lotNo: l.batch,
            expiryDate: l.expiry,
            serialNo: l.serial,
            quantity: l.qty,
            unit: 'Adet'
          }))
        }));
      setMinistryPendingShipments(pendingMapped);
      setMinistryTransactions(recs);
    } catch (err) {
      console.warn('Ministry bridge load warning:', err);
    }
  }, []);

  // Zamanlı bildirimler: vade hatırlatması (3 gün kala her akşam 20:00 + vade günü 10:00), günün planı 09:00, günün raporu 21:00.
  // Veri değiştikçe ve saat başı yeniden kurulur; ilk açılışta gerekli izinler bir kez istenir.
  const schedCtx = useAppViewModel();
  useEffect(() => {
    if (!currentUser || !initialDataLoaded) return;
    const run = () => {
      void requestEssentialPermissionsOnce()
        .then(() => syncScheduledNotifications({ myPayments: schedCtx.myPayments, prescriptions: schedCtx.prescriptions, payments: schedCtx.payments, reminders: schedCtx.reminders }))
        .catch(() => undefined);
    };
    const first = window.setTimeout(run, 4000);
    const hourly = window.setInterval(run, 60 * 60 * 1000);
    return () => { window.clearTimeout(first); window.clearInterval(hourly); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(currentUser as any)?.uid, initialDataLoaded, schedCtx.myPayments, schedCtx.prescriptions, schedCtx.payments, schedCtx.reminders]);

  // Veri sağlığı: açılıştan sonra arka planda kasa / stok / yarım kayıt denetimi
  useEffect(() => {
    if (!currentUser || !initialDataLoaded) return;
    return scheduleIntegrityCheck(String((currentUser as any)?.uid || 'local'), report => {
      if (report.open > 0) showToast(`Veri sağlığı: ${report.open} konu dikkat istiyor. Ayarlar → Veri Sağlığı Denetimi`, 'error');
      void refreshInventory();
      void refreshStats();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(currentUser as any)?.uid, initialDataLoaded]);

  useEffect(() => {
    if (currentUser && (initialDataLoaded || isMinistryModalOpen)) {
      void refreshMinistryBridgeData();
    }
  }, [currentUser, initialDataLoaded, isMinistryModalOpen, refreshMinistryBridgeData]);

  const handleAcceptMinistryShipment = useCallback(
    async (shipment: FactoryShipment, opts: { registerToMinistry: boolean; config: MinistryConfig }) => {
      const library = await dbService.getPesticides().catch(() => []);
      const record: MinistryShipmentRecord = {
        id: shipment.id || generateUUID(),
        sscc: shipment.sscc || '',
        senderGln: shipment.supplierGln,
        senderName: shipment.supplierName || '',
        waybillNo: shipment.irsaliyeNo || '',
        itemCount: (shipment.lines || []).length,
        date: shipment.date || getLocalDateString(),
        status: 'ACCEPTED',
        acceptedAt: new Date().toISOString(),
        lines: (shipment.lines || []).map(l => ({
          gtin: l.gtin || '',
          name: l.productName || '',
          batch: (l.lotNo || 'GENEL').trim() || 'GENEL',
          expiry: l.expiryDate,
          serial: l.serialNo,
          qty: Number(l.quantity) || 0,
          unit: l.unit
        }))
      };

      await dbService.acceptMinistryShipment(record, {
        library: library as any[],
        defaultCategory: opts.config.gts && !opts.config.bkts ? PesticideCategory.FERTILIZER : PesticideCategory.OTHER,
        skipRecordCreation: true,
        skipStatusGuard: true
      });

      await refreshInventory();
      await refreshStats();
      await refreshMinistryBridgeData();
    },
    [refreshInventory, refreshStats, refreshMinistryBridgeData]
  );

  // UI-14 & UI-40: Keep native StatusBar and <meta name="theme-color"> synced with active theme
  useEffect(() => {
    const rawTheme = userProfile.theme;
    const isLight =
      rawTheme === 'APPLE' ||
      rawTheme === 'LIGHT' ||
      rawTheme === 'ORGANIC' ||
      userProfile.colorMode === 'LIGHT';
    const themeColor =
      rawTheme === 'APPLE'
        ? '#f5f5f7'
        : rawTheme === 'LIGHT'
          ? '#f8fafc'
          : rawTheme === 'ORGANIC'
            ? '#fafaf9'
            : '#080d14';

    const metaEl = document.querySelector('meta[name="theme-color"]');
    if (metaEl) {
      metaEl.setAttribute('content', themeColor);
    }

    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: isLight && Capacitor.getPlatform() !== 'android' ? Style.Light : Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: themeColor }).catch(() => {});
    }
  }, [userProfile.theme, userProfile.colorMode]);

  // B-11: Purge expired pending POS barcode on mount & unmount timer
  useEffect(() => {
    try {
      const rawMeta = sessionStorage.getItem('mks_pending_pos_barcode_meta');
      if (rawMeta) {
        const parsed = JSON.parse(rawMeta) as { code?: string; ts?: number };
        if (!parsed?.ts || Date.now() - parsed.ts > 5000) {
          sessionStorage.removeItem('mks_pending_pos_barcode');
          sessionStorage.removeItem('mks_pending_pos_barcode_meta');
        }
      } else if (sessionStorage.getItem('mks_pending_pos_barcode')) {
        sessionStorage.removeItem('mks_pending_pos_barcode');
      }
    } catch {
      sessionStorage.removeItem('mks_pending_pos_barcode');
      sessionStorage.removeItem('mks_pending_pos_barcode_meta');
    }
    return () => {
      if (posBarcodeTimerRef.current) {
        window.clearTimeout(posBarcodeTimerRef.current);
      }
    };
  }, []);
  
  useEffect(() => {
    if (currentUser) {
      Promise.resolve((dbService as any).testConnection?.()).catch(() => {});
    }
  }, [currentUser]);

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
    // Check both search and hash for parameters
    const searchParams = new URLSearchParams(window.location.search);
    let tokenParam = searchParams.get('token');
    let portalId = searchParams.get('portalId');
    let engineerId = searchParams.get('engineerId');

    if (!tokenParam && (!portalId || !engineerId)) {
      const hash = window.location.hash;
      if (hash.includes('?')) {
        const hashParams = new URLSearchParams(hash.split('?')[1]);
        tokenParam = tokenParam || hashParams.get('token');
        portalId = portalId || hashParams.get('portalId');
        engineerId = engineerId || hashParams.get('engineerId');
      }
    }

    if (tokenParam || portalId) {
      // Clean up potential trailing slashes and whitespace added by some Android browsers/apps
      const cleanToken = tokenParam ? tokenParam.replace(/\/$/, '').trim() : null;
      const cleanPortalId = (portalId || tokenParam || '').replace(/\/$/, '').trim();
      const cleanEngineerId = engineerId ? engineerId.replace(/\/$/, '').trim() : null;
      
      setPortalToken(cleanToken);
      setPortalFarmerId(cleanPortalId);
      setPortalEngineerId(cleanEngineerId);
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
    initNotificationInfrastructure((targetView) => {
      setCurrentView(targetView);
    }).catch(() => {});

    const openViewParam = searchParams.get('openView');
    if (openViewParam && !tokenParam && !portalId) {
      setCurrentView(openViewParam as ViewState);
    }

    const handleNotifNav = (ev: Event) => {
      const target = (ev as CustomEvent)?.detail?.targetView as ViewState | undefined;
      if (target) setCurrentView(target);
    };
    window.addEventListener('mks-navigate-from-notif', handleNotifNav);
    return () => {
      window.removeEventListener('mks-navigate-from-notif', handleNotifNav);
    };
  }, []);

  // Akıllı 5'li bildirim tarayıcısı (Ödeme, Çek/Senet/Kart, Günlük Aranacaklar, Hava, Güncelleme)
  useEffect(() => {
    if (!currentUser || !initialDataLoaded) return;
    const initialTimer = window.setTimeout(() => {
      runSmartNotificationsScan(false).catch(() => {});
    }, 1800);
    const periodicTimer = window.setInterval(() => {
      runSmartNotificationsScan(false).catch(() => {});
    }, 30 * 60 * 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(periodicTimer);
    };
  }, [currentUser, initialDataLoaded, runSmartNotificationsScan]);

  // Eşitleme ve ilk yükleme mantığı (Sıfır Takılma Korumalı Offline-First)
  useEffect(() => {
    let cleanupSync: (() => void) | undefined;
    let failsafeTimer: number | undefined;
    let cancelled = false;
    let lastForegroundSyncAt = 0;

    if (!currentUser && !loading) {
      setInitialDataLoaded(false);
      return;
    }

    const ensureRealtimeSyncAttached = () => {
      if (cleanupSync || cancelled || !currentUser || !navigator.onLine) return;
      const stopSync = dbService.setupRealtimeSync(
        currentUser.uid,
        () => {
          refreshStats().catch(() => {});
          refreshNews().catch(() => {});
          refreshMinistryBridgeData().catch(() => {});
        },
        (updatedProfile) => {
          syncUserProfile(updatedProfile);
        }
      );
      if (cancelled) {
        stopSync();
        return;
      }
      cleanupSync = stopSync;
    };

    const initializeAppData = async () => {
      if (currentUser && !loading) {
        // Kesin güvenlik kilidi: IndexedDB veya tarayıcı eklentisi yavaşlasa bile 2.5 sn içinde ekran mutlaka açılır
        failsafeTimer = window.setTimeout(() => {
          if (!cancelled) setInitialDataLoaded(true);
        }, 2500);

        try {
          // 1. ADIM: Cihazda/tarayıcıda ne varsa anında yükle (Offline-First)
          await refreshStats();
        } catch (localErr) {
          console.warn("Initial local refresh warning:", localErr);
        } finally {
          if (failsafeTimer) window.clearTimeout(failsafeTimer);
          if (!cancelled) setInitialDataLoaded(true);
        }

        if (cancelled) return;

        // 2. ADIM: İnternet varsa arka planda arayüzü kilitlemeden senkronize et
        if (navigator.onLine) {
          try {
            const cloudProfile = await dbService.getUserProfile(currentUser.uid);
            if (cancelled) return;
            if (cloudProfile) syncUserProfile(cloudProfile);

            dbService.syncGlobalPesticides().catch(() => {});
            refreshPlants().catch(() => {});

            // Verileri buluttan çek ve yerelle birleştir
            await dbService.syncAllDataOnLogin(currentUser.uid);
            if (cancelled) return;

            // 3. ADIM: Gerçek zamanlı senkronizasyonu başlat (Çoklu cihaz desteği)
            ensureRealtimeSyncAttached();

            // Veriler güncellenmiş olabilir, tekrar arayüzü yenile
            await refreshStats();
            await refreshMinistryBridgeData().catch(() => {});
          } catch (e) {
            console.warn("Background sync failed, using local data:", e);
          }
        }
      }
    };

    initializeAppData();

    const onSubActivated = (ev: Event) => {
      const nextProf = (ev as CustomEvent)?.detail;
      if (nextProf && typeof nextProf === 'object') {
        syncUserProfile(nextProf);
      } else if (currentUser) {
        dbService.getUserProfile(currentUser.uid).then(p => { if (p) syncUserProfile(p); }).catch(() => {});
      }
    };
    window.addEventListener('mks-subscription-activated', onSubActivated);

    // Auto-sync when reconnecting to the internet
    const handleOnline = async () => {
      if (!cancelled && currentUser && !loading) {
        try {
          ensureRealtimeSyncAttached();
          await dbService.syncAllDataOnLogin(currentUser.uid);
          if (cancelled) return;
          await refreshStats();
          await refreshNews();
          await refreshMinistryBridgeData().catch(() => {});
        } catch (err) {
          console.warn("Online auto-sync error:", err);
        }
      }
    };
    window.addEventListener('online', handleOnline);

    // Ön plana dönüldüğünde (mobil/masaüstü pencere geçişi) diğer cihazdaki yeni verileri veya silmeleri hemen çek
    const handleForegroundResume = async () => {
      if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }
      if (cancelled || !currentUser || loading || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastForegroundSyncAt < 15_000) return;
      lastForegroundSyncAt = now;
      try {
        ensureRealtimeSyncAttached();
        await dbService.flushSyncOutboxNow().catch(() => {});
        const freshProf = await dbService.getUserProfile(currentUser.uid).catch(() => null);
        if (freshProf && !cancelled) syncUserProfile(freshProf);
        await dbService.syncAllDataOnLogin(currentUser.uid);
        if (cancelled) return;
        await refreshStats();
        await refreshMinistryBridgeData().catch(() => {});
      } catch (err) {
        console.warn("Foreground resume sync warning:", err);
      }
    };
    document.addEventListener('visibilitychange', handleForegroundResume);
    window.addEventListener('focus', handleForegroundResume);

    return () => {
      cancelled = true;
      if (failsafeTimer) window.clearTimeout(failsafeTimer);
      if (cleanupSync) cleanupSync();
      window.removeEventListener('mks-subscription-activated', onSubActivated);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleForegroundResume);
      window.removeEventListener('focus', handleForegroundResume);
    };
  }, [currentUser, loading]);

  // Refs for stable access in back button callback
  const currentViewRef = useRef<ViewState>('DASHBOARD');
  const isModeActiveRef = useRef<boolean>(false);
  const selectedFarmerRef = useRef<string | null>(null);
  const selectedSupplierRef = useRef<string | null>(null);

  useEffect(() => {
    currentViewRef.current = currentView;
    isModeActiveRef.current = isPrescriptionMode || isVisitMode || isReminderAddMode || isTomorrowMode;
    selectedFarmerRef.current = selectedFarmerId;
    selectedSupplierRef.current = selectedSupplierId;
  }, [currentView, isPrescriptionMode, isVisitMode, isReminderAddMode, isTomorrowMode, selectedFarmerId, selectedSupplierId]);

  // Register back handlers for farmer/supplier details & global modals
  useBackHandler(!!selectedFarmerId && currentView === 'FARMERS', () => setSelectedFarmerId(null), 'selected_farmer', 20);
  useBackHandler(!!selectedSupplierId && currentView === 'SUPPLIERS', () => setSelectedSupplierId(null), 'selected_supplier', 20);
  useBackHandler(isMinistryModalOpen, () => setIsMinistryModalOpen(false), 'ministry_modal', 75);
  useBackHandler(isEfaturaOpen, () => setIsEfaturaOpen(false), 'efatura_panel', 76);
  useBackHandler(showWelcomeModal, () => setShowWelcomeModal(false), 'welcome_modal', 80);

  // Automatic Pre-Update Safety Snapshot & Subscription Matrix Cloud Sync
  useEffect(() => {
    syncSubscriptionConfigFromCloud();
    if (currentUser && initialDataLoaded) {
      ensurePreUpdateSafetySnapshot(currentUser.uid);
    }
  }, [currentUser, initialDataLoaded]);

  // Global USB / Wireless POS Hardware Barcode Gun Listener (Desktop & Web)
  // B-11: Only auto-navigate to PRESCRIPTION_NEW when sitting idle on DASHBOARD with zero modals open,
  // and store pending barcode with strict 5-second TTL so stale codes never auto-add products later!
  useHardwareBarcodeScanner(
    (parsedGs1) => {
      if (!currentUser) return;
      const rawBarcode = parsedGs1.raw;
      const codeLabel = parsedGs1?.gtin || rawBarcode;
      if (showToast) {
        showToast(`Barkod Okuyucu: ${codeLabel}`, 'success');
      }
      window.dispatchEvent(
        new CustomEvent('mks-pos-barcode-scanned', {
          detail: { rawBarcode, parsedGs1 }
        })
      );

      const canAutoOpenPos =
        currentViewRef.current === 'DASHBOARD' &&
        !isModeActiveRef.current &&
        !isMinistryModalOpen &&
        !isEdmModalOpen &&
        !isEfaturaOpen &&
        !isWebPortalOpen &&
        !showWelcomeModal &&
        !isLiveSupportOpen &&
        getBackStackDepth() === 0;

      if (canAutoOpenPos) {
        const scannedAt = Date.now();
        sessionStorage.setItem('mks_pending_pos_barcode', rawBarcode);
        sessionStorage.setItem('mks_pending_pos_barcode_meta', JSON.stringify({ code: rawBarcode, ts: scannedAt }));
        if (posBarcodeTimerRef.current) {
          window.clearTimeout(posBarcodeTimerRef.current);
        }
        posBarcodeTimerRef.current = window.setTimeout(() => {
          try {
            const currentMeta = sessionStorage.getItem('mks_pending_pos_barcode_meta');
            if (!currentMeta || JSON.parse(currentMeta)?.ts === scannedAt) {
              sessionStorage.removeItem('mks_pending_pos_barcode');
              sessionStorage.removeItem('mks_pending_pos_barcode_meta');
            }
          } catch {
            sessionStorage.removeItem('mks_pending_pos_barcode');
            sessionStorage.removeItem('mks_pending_pos_barcode_meta');
          }
        }, 5000);
        handleNavigate('PRESCRIPTION_NEW');
      }
    }
  );

  // Unified Smart 1-Step Back Handler (Used by Android Back, Edge Swipe, Desktop ESC/Back Button)
  const handleSmartStepBack = () => {
    // 1. Check registered modal/detail layers or open DOM modals first
    if (executeSmartBackStep()) {
      return;
    }
    // 2. Check sub-detail views
    if (selectedFarmerRef.current && currentViewRef.current === 'FARMERS') {
      setSelectedFarmerId(null);
      return;
    }
    if (selectedSupplierRef.current && currentViewRef.current === 'SUPPLIERS') {
      setSelectedSupplierId(null);
      return;
    }
    // 3. Check special modes (Prescription / Visit / Reminder add/edit)
    if (isModeActiveRef.current) {
      setIsPrescriptionMode(false);
      setIsVisitMode(false);
      setIsReminderAddMode(false);
      setIsTomorrowMode(false);
      setPrescriptionFarmerId(undefined);
      setEditPrescriptionId(undefined);
      setEditVisitId(undefined);
      return;
    }
    // 4. Step back to Dashboard if on another screen
    if (currentViewRef.current !== 'DASHBOARD' && currentViewRef.current !== 'ADMIN_PANEL') {
      setCurrentView('DASHBOARD');
      window.history.pushState({ view: 'DASHBOARD' }, '');
      return;
    }
    // 5. On root Dashboard/Admin Panel: require double-press to exit on Native Android
    if (Capacitor.isNativePlatform()) {
      if (shouldAllowAppExit(showToast)) {
        CapacitorApp.exitApp();
      }
    }
  };

  useEffect(() => {
    const cleanupScrollGuard = initGlobalNavigationAndScrollGuard(handleSmartStepBack);
    return cleanupScrollGuard;
  }, []);

  useEffect(() => {
    let listenerHandle: any;
    let cancelled = false;
    
    const initBackButton = async () => {
        try {
            const handle = await CapacitorApp.addListener('backButton', () => {
                handleSmartStepBack();
            });
            if (cancelled) {
                handle.remove();
            } else {
                listenerHandle = handle;
            }
        } catch (err) {
            console.error('Back button listener error:', err);
        }
    };

    initBackButton();

    return () => {
        cancelled = true;
        if (listenerHandle) listenerHandle.remove();
    };
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        // Intercept modal/detail layers FIRST so Cari Ekstre or Modals never jump to Dashboard!
        if (executeSmartBackStep()) {
            return;
        }
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

  // Global Navigation Helpers
  useEffect(() => {
    (window as any).mks_navigate_settings = () => setCurrentView('SETTINGS');
    (window as any).mks_smart_step_back = handleSmartStepBack;
    (window as any).mks_open_ministry = (tab?: 'malkabul' | 'satis' | 'esdeger' | 'gts' | 'bkts' | 'brecete') => {
      if (tab === 'esdeger') {
        if (!isFeatureEnabledForUser('TANK_MIX_EQUIVALENT', userProfile, isAdmin)) {
          if (showToast) showToast('Eşdeğer / Muadil İlaç Bulucu seçili paketinizde kapalıdır. Paket yükseltiniz.', 'info');
          setWebPortalTab('pricing');
          setIsWebPortalOpen(true);
          return;
        }
      } else {
        if (!isFeatureEnabledForUser('MINISTRY_BKST_GTS', userProfile, isAdmin)) {
          if (showToast) showToast('Tarım Bakanlığı BKTS / GTS modülü seçili paketinizde kapalıdır. Paket yükseltiniz.', 'info');
          setWebPortalTab('pricing');
          setIsWebPortalOpen(true);
          return;
        }
      }
      if (tab) setMinistryModalTab(tab);
      setIsMinistryModalOpen(true);
    };
    (window as any).mks_open_web_portal = (tab?: 'showcase' | 'download' | 'pricing') => {
      if (tab) setWebPortalTab(tab);
      setIsWebPortalOpen(true);
    };
    (window as any).mks_open_edm = (tab?: 'incoming' | 'issue' | 'warehouses' | 'settings') => {
      if (!isFeatureEnabledForUser('EDM_EFATURA', userProfile, isAdmin)) {
        if (showToast) showToast('EDM e-Fatura & Çoklu Depo modülü seçili paketinizde kapalıdır. Paket yükseltiniz.', 'info');
        setWebPortalTab('pricing');
        setIsWebPortalOpen(true);
        return;
      }
      if (tab) setEdmModalTab(tab);
      setIsEdmModalOpen(true);
    };
    // Sade e-Fatura ekranı (EDM'ye gerçek gönderim, giden/gelen kutusu)
    (window as any).mks_open_efatura = (tab?: string, prefill?: EFaturaPrefill) => {
      if (!isFeatureEnabledForUser('EDM_EFATURA', userProfile, isAdmin)) {
        if (showToast) showToast('e-Fatura modülü seçili paketinizde kapalıdır. Paket yükseltiniz.', 'info');
        setWebPortalTab('pricing');
        setIsWebPortalOpen(true);
        return;
      }
      const validTab = tab === 'out' || tab === 'in' || tab === 'settings' || tab === 'issue' ? tab : 'issue';
      setEfaturaPrefill(prefill || null);
      setEfaturaTab(validTab);
      setIsEfaturaOpen(true);
    };
    (window as any).mks_open_live_support = (cat?: 'general' | 'subscription' | 'password_reset' | 'bkst_gts') => {
      if (cat) setLiveSupportCategory(cat);
      setIsLiveSupportOpen(true);
    };
  }, [userProfile, isAdmin]);

  const handleNavigate = (view: string) => {
    let nextView = view as ViewState;
    let mode: string | undefined = undefined;
    let farmerId: string | undefined = undefined;

    // Check Admin Panel Feature Matrix permission for the target view
    const permission = isViewAllowedForUser(view, userProfile, isAdmin);
    if (!permission.allowed) {
      if (showToast) {
        showToast(
          `"${permission.requiredFeature?.title || view}" özelliği ${permission.requiredTier || 'ULTRA'} paketinde aktiftir.`,
          'info'
        );
      }
      setWebPortalTab('pricing');
      setIsWebPortalOpen(true);
      return;
    }

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
    maybeShowFreeTierAd(userProfile, isAdmin);
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

  if (currentView === 'PRODUCER_PORTAL' && (portalFarmerId || portalToken)) {
    return (
      <Suspense fallback={<ViewLoader />}>
        <ProducerPortal 
          farmerId={portalFarmerId || portalToken || ''} 
          engineerId={portalEngineerId || undefined}
          portalToken={portalToken || undefined}
          onBack={() => {
            setPortalToken(null);
            setPortalFarmerId(null);
            setPortalEngineerId(null);
            setCurrentView('DASHBOARD');
            window.history.replaceState({}, '', window.location.pathname);
          }}
        />
      </Suspense>
    );
  }

  if (loading || (currentUser && !initialDataLoaded && currentView !== 'PRODUCER_PORTAL')) {
      return (
          <div className="min-h-dvh bg-[var(--mks-canvas-bg,#080d14)] text-[var(--mks-text,#f8fafc)] flex flex-col items-center justify-center">
              <MksBrandLogo size="xl" rounded="2xl" className="mb-4 border-emerald-500/30 shadow-xl" />
              <Loader2 size={24} className="animate-spin text-emerald-500 mb-3" />
              <p className="text-stone-400 text-xs">Veriler yükleniyor...</p>
          </div>
      );
  }

  if (!currentUser) return <LoginScreen />;

  // FREE Tier Web & Desktop Restriction Gate (FREE is Mobile-Only; PRO/ULTRA/MAX unlock Web & Desktop)
  if (isWebOrDesktopRestrictedForUser(userProfile, isAdmin)) {
    return (
      <>
        <WebLandingPortal
          mode="fullscreen_gate"
          initialTab="pricing"
          onOpenSupport={() => {
            setLiveSupportCategory('subscription');
            setIsLiveSupportOpen(true);
          }}
        />
        <LiveSupportWidget
          isOpenExternal={isLiveSupportOpen}
          onCloseExternal={() => setIsLiveSupportOpen(false)}
          initialCategory={liveSupportCategory}
        />
      </>
    );
  }

  const renderContent = () => {
    if (isPrescriptionMode) return <PrescriptionForm onBack={handleSmartStepBack} initialFarmerId={prescriptionFarmerId} initialPrescriptionId={editPrescriptionId} initialCreateMode={!editPrescriptionId} />;
    if (currentView === 'VISITS' && isVisitMode) return <VisitLogForm onBack={handleSmartStepBack} initialVisitId={editVisitId} />;
    if (currentView === 'REMINDERS') return <RemindersScreen onBack={handleSmartStepBack} initialAddMode={isReminderAddMode} initialFilter={isTomorrowMode ? 'TOMORROW' : undefined} />;

    switch (currentView) {
        case 'DASHBOARD': return <Dashboard onNavigate={handleNavigate} />;
        case 'RECENT_TRANSACTIONS': return <RecentTransactions onSelectFarmer={(id) => { setSelectedFarmerId(id); setCurrentView('FARMERS'); }} />;
        case 'FARMERS': return <Farmers 
            onBack={handleSmartStepBack} 
            onNavigateToPrescription={handleStartPrescription} 
            onEditPrescription={handleEditPrescription} 
            onEditVisit={handleEditVisit}
            selectedFarmerId={selectedFarmerId}
            onSelectFarmer={setSelectedFarmerId}
        />;
        case 'PESTICIDES': return <Pesticides />;
        case 'PRESCRIPTIONS': return <PrescriptionForm onBack={handleSmartStepBack} />;
        case 'TRASH': return <DeletedPrescriptions onBack={handleSmartStepBack} />;
        case 'VISITS': return <VisitLogForm onBack={handleSmartStepBack} />;
        case 'CONTACT': return <ContactScreen />;
        case 'SETTINGS': return <SettingsScreen onNavigate={handleNavigate} />;
        case 'NOTIFICATIONS': return <NotificationsScreen onBack={handleSmartStepBack} onNavigate={handleNavigate} />;
        case 'PROFILE': return <ProfileScreen onBack={handleSmartStepBack} />;
        case 'STATISTICS': return <StatisticsScreen onNavigate={handleNavigate} />;
        case 'LAND_DETAIL': return <StatisticsScreen onNavigate={handleNavigate} initialTab="LAND" />;
        case 'INVENTORY': return <InventoryScreen 
            onNavigateToPrescription={handleEditPrescription}
            onNavigateToSupplier={(suppId) => {
                setSelectedSupplierId(suppId);
                setCurrentView('SUPPLIERS');
            }}
        />;
        case 'DEBT_TRACKING': return <DebtTracking onSelectFarmer={(id) => { setSelectedFarmerId(id); setCurrentView('FARMERS'); }} />;
        case 'MAP': return <MapComponent onBack={handleSmartStepBack} />;
        case 'KASA': return <Kasa onBack={handleSmartStepBack} />;
        case 'EXPENSES': return <ExpensesScreen onBack={handleSmartStepBack} />;
        case 'SUPPLIERS': return <Suppliers 
            onBack={handleSmartStepBack} 
            initialSupplierId={selectedSupplierId} 
        />;
        case 'PAYMENTS': return <Payments onBack={handleSmartStepBack} />;
        case 'CALCULATOR': return <Calculator onBack={handleSmartStepBack} />;
        case 'REPORTS': return <Reports />;
        case 'TEAM': return <TeamScreen onBack={handleSmartStepBack} />;
        case 'MESSAGES': return <MessagesScreen onBack={handleSmartStepBack} />;
        case 'PERFORMANCE': return <PerformanceScreen onBack={handleSmartStepBack} />;
        case 'NEWS': return <News onBack={handleSmartStepBack} />;
        case 'ADMIN_PANEL': return isAdmin ? <AdminPanel onBack={handleSmartStepBack} /> : <Dashboard onNavigate={handleNavigate} />;
        case 'PLANTS': return <Plants onNavigate={handleNavigate} />;
        case 'MKS_MUHENDISIM': return <MKSMuhendisim onBack={handleSmartStepBack} />;
        case 'AI_ASSISTANT': return <AIAssistant onBack={handleSmartStepBack} onNavigate={handleNavigate} />;
        case 'SMART_STOCK': return <SmartStock onBack={handleSmartStepBack} />;
        case 'SILO': return <SiloScreen onBack={handleSmartStepBack} />;
        case 'REGIONAL_ALERTS': return <RegionalAlerts onBack={handleSmartStepBack} />;
        case 'USER_GUIDE': return <UserGuide onBack={handleSmartStepBack} onNavigate={handleNavigate} />;
        default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const renderWelcomeModal = () => {
    if (!showWelcomeModal) return null;
    const supportWaHref = buildWaUrl(SUPPORT_WHATSAPP, 'Merhaba, MKS paketleri ve lisans satın alımı hakkında bilgi almak istiyorum.') || `https://wa.me/${SUPPORT_WHATSAPP}`;
    return (
      <div
        className="fixed inset-0 bg-stone-950/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        onClick={() => setShowWelcomeModal(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-modal-title"
          className="bg-stone-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full max-h-[90dvh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 id="welcome-modal-title" className="text-xl font-bold text-white">Hoş geldiniz!</h3>
            <ModalCloseButton onClick={() => setShowWelcomeModal(false)} />
          </div>
          <p className="text-stone-300 mb-6 leading-relaxed text-sm">
            Hoş geldiniz, 1 haftalık deneme süreniz başlamıştır. Satın alım için yöneticiyle iletişime geçebilirsiniz.
          </p>
          <a 
            href={supportWaHref}
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full min-h-[44px] py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold flex items-center justify-center transition-colors"
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
      <EdgeSwipeBackGesture onTriggerBack={handleSmartStepBack} />
      <Suspense fallback={<ViewLoader />}>
        {renderContent()}
      </Suspense>
      {renderWelcomeModal()}
      <MinistryIntegrationModal
        isOpen={isMinistryModalOpen}
        onClose={() => setIsMinistryModalOpen(false)}
        initialTab={ministryModalTab}
        inventory={inventory}
        pendingShipments={ministryPendingShipments}
        transactions={ministryTransactions}
        onAcceptShipment={handleAcceptMinistryShipment}
        showToast={showToast}
      />
      <EFaturaPanel isOpen={isEfaturaOpen} initialTab={efaturaTab} prefill={efaturaPrefill} onClose={() => setIsEfaturaOpen(false)} />
      <EdmIntegrationModal
        isOpen={isEdmModalOpen}
        onClose={() => setIsEdmModalOpen(false)}
        initialTab={edmModalTab}
      />
      {isWebPortalOpen && (
        <WebLandingPortal
          mode="modal"
          initialTab={webPortalTab}
          onClose={() => setIsWebPortalOpen(false)}
          onOpenSupport={() => {
            setIsWebPortalOpen(false);
            setLiveSupportCategory('subscription');
            setIsLiveSupportOpen(true);
          }}
        />
      )}
      <LiveSupportWidget
        isOpenExternal={isLiveSupportOpen}
        onCloseExternal={() => setIsLiveSupportOpen(false)}
        initialCategory={liveSupportCategory}
      />
    </Layout>
  );
}

function AppProviderWrapper({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  return (
    <AppProvider key={currentUser ? currentUser.uid : 'guest'}>
      {children}
    </AppProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DesktopWindowTitlebar />
      <AuthProvider>
          <AppProviderWrapper>
               <MainApp />
          </AppProviderWrapper>
      </AuthProvider>
    </ErrorBoundary>
  );
}

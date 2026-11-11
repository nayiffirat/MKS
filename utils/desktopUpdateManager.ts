import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db as firestore, auth } from '../services/firebase';
import { flushSyncOutboxNow } from '../services/db';
import { ensurePreUpdateSafetySnapshot } from './subscriptionManager';
import { MKS_CLIENT_BUILD, MKS_CLIENT_VERSION } from './smartNotificationEngine';
import { API_BASE } from './api';

export interface MksReleaseManifest {
  version: string;
  build: number;
  desktopVersion?: string;
  desktopBuild?: number;
  desktopDownloadUrl?: string;
  androidDownloadUrl?: string;
  releasedAt?: string;
  title?: string;
  notes?: string;
}

export interface DesktopUpdateSnapshot {
  isDesktopApp: boolean;
  isNativeWindowsShell: boolean;
  isWindowControlsOverlay: boolean;
  bridgePort: number | null;
  localVersion: string;
  localBuild: number;
  localDesktopBuild: number;
  updateAvailable: boolean;
  isChecking: boolean;
  isApplying: boolean;
  progressLabel: string | null;
  remoteManifest: MksReleaseManifest | null;
}

const SESSION_DESKTOP_FLAG = 'mks_desktop_mode_active';
const SESSION_NATIVE_SHELL_FLAG = 'mks_desktop_native_shell';
const SESSION_BRIDGE_PORT_KEY = 'mks_desktop_bridge_port';
const SESSION_DESKTOP_BUILD_KEY = 'mks_desktop_exe_build';
const ACK_CLOUD_BUILD_KEY = 'mks_ack_release_build';

let currentSnapshot: DesktopUpdateSnapshot = {
  isDesktopApp: false,
  isNativeWindowsShell: false,
  isWindowControlsOverlay: false,
  bridgePort: null,
  localVersion: MKS_CLIENT_VERSION,
  localBuild: MKS_CLIENT_BUILD,
  localDesktopBuild: MKS_CLIENT_BUILD,
  updateAvailable: false,
  isChecking: false,
  isApplying: false,
  progressLabel: null,
  remoteManifest: null
};

const listeners = new Set<(snap: DesktopUpdateSnapshot) => void>();
let managerStarted = false;
let pollIntervalId: number | null = null;
let firestoreUnsub: (() => void) | null = null;
let waitingSwRegistration: ServiceWorkerRegistration | null = null;

function emitSnapshot(partial: Partial<DesktopUpdateSnapshot>) {
  currentSnapshot = { ...currentSnapshot, ...partial };
  listeners.forEach(cb => {
    try {
      cb(currentSnapshot);
    } catch {}
  });
}

function detectEnvironmentFromUrlAndBrowser() {
  if (typeof window === 'undefined') return;

  try {
    const params = new URLSearchParams(window.location.search);
    const platformParam = params.get('platform');
    const nativeShellParam = params.get('nativeShell');
    const bridgePortParam = Number(params.get('bridgePort') || '0');
    const desktopBuildParam = Number(params.get('desktopBuild') || '0');

    if (platformParam === 'desktop') {
      sessionStorage.setItem(SESSION_DESKTOP_FLAG, '1');
    }
    if (nativeShellParam === '1') {
      sessionStorage.setItem(SESSION_NATIVE_SHELL_FLAG, '1');
    }
    if (Number.isFinite(bridgePortParam) && bridgePortParam > 1024 && bridgePortParam < 65536) {
      sessionStorage.setItem(SESSION_BRIDGE_PORT_KEY, String(bridgePortParam));
    }
    if (Number.isFinite(desktopBuildParam) && desktopBuildParam > 0) {
      sessionStorage.setItem(SESSION_DESKTOP_BUILD_KEY, String(desktopBuildParam));
    }

    const wco = (navigator as any).windowControlsOverlay;
    const isWcoVisible = Boolean(wco && wco.visible);
    const isStandaloneDesktopPwa =
      window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches ||
      (window.matchMedia?.('(display-mode: standalone)')?.matches && window.innerWidth >= 900);

    const isDesktopApp =
      sessionStorage.getItem(SESSION_DESKTOP_FLAG) === '1' ||
      isWcoVisible ||
      Boolean(isStandaloneDesktopPwa);

    const isNativeWindowsShell = sessionStorage.getItem(SESSION_NATIVE_SHELL_FLAG) === '1';
    const storedPort = Number(sessionStorage.getItem(SESSION_BRIDGE_PORT_KEY) || '0');
    const storedExeBuild = Number(sessionStorage.getItem(SESSION_DESKTOP_BUILD_KEY) || '0');

    emitSnapshot({
      isDesktopApp,
      isNativeWindowsShell,
      isWindowControlsOverlay: isWcoVisible,
      bridgePort: storedPort > 1024 ? storedPort : null,
      localDesktopBuild: storedExeBuild > 0 ? storedExeBuild : MKS_CLIENT_BUILD
    });

    // Optional URL preview simulation (?previewUpdate=1) for visual verification without side effects
    if (params.get('previewUpdate') === '1') {
      const previewManifest: MksReleaseManifest = {
        version: '8.2.2',
        build: MKS_CLIENT_BUILD + 1,
        desktopVersion: '8.2.2.0',
        desktopBuild: MKS_CLIENT_BUILD + 1,
        desktopDownloadUrl: '/downloads/MKS_Masaustu_Kurulum.exe',
        releasedAt: new Date().toISOString().slice(0, 10),
        title: 'Yeni Masaüstü Güncellemesi Hazır',
        notes: 'Performans iyileştirmeleri ve yeni modül güncellemeleri hazır.'
      };
      emitSnapshot({
        updateAvailable: true,
        remoteManifest: previewManifest
      });
    }
  } catch {}
}

function getEffectiveLocalBaselineBuild(): number {
  try {
    const ack = Number(localStorage.getItem(ACK_CLOUD_BUILD_KEY) || '0');
    return Math.max(MKS_CLIENT_BUILD, Number.isFinite(ack) ? ack : 0);
  } catch {
    return MKS_CLIENT_BUILD;
  }
}

async function notifyNativeBridge(manifest: MksReleaseManifest, available: boolean) {
  const port = currentSnapshot.bridgePort;
  if (!port) return;
  try {
    const downloadHref = manifest.desktopDownloadUrl?.startsWith('http')
      ? manifest.desktopDownloadUrl
      : `${window.location.origin}${manifest.desktopDownloadUrl || '/downloads/MKS_Masaustu_Kurulum.exe'}`;

    await fetch(`http://127.0.0.1:${port}/update/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        available,
        version: manifest.version,
        build: manifest.build,
        desktopBuild: manifest.desktopBuild || manifest.build,
        downloadUrl: downloadHref,
        title: manifest.title || `MKS v${manifest.version}`,
        notes: manifest.notes || ''
      })
    });
  } catch {
    // Yerel köprü kapalıysa sessizce geç
  }
}

function evaluateCandidateManifest(candidate: Partial<MksReleaseManifest> | null | undefined) {
  if (!candidate || typeof candidate !== 'object') return;
  const remoteBuild = Number(candidate.build || 0);
  const remoteDesktopBuild = Number(candidate.desktopBuild || remoteBuild || 0);
  if (!Number.isFinite(remoteBuild) || remoteBuild <= 0) return;

  const normalized: MksReleaseManifest = {
    version: String(candidate.version || MKS_CLIENT_VERSION),
    build: remoteBuild,
    desktopVersion: String(candidate.desktopVersion || `${candidate.version || MKS_CLIENT_VERSION}.0`),
    desktopBuild: remoteDesktopBuild,
    desktopDownloadUrl: candidate.desktopDownloadUrl || '/downloads/MKS_Masaustu_Kurulum.exe',
    androidDownloadUrl: candidate.androidDownloadUrl || '/downloads/MKS_Android.apk',
    releasedAt: candidate.releasedAt || '',
    title: candidate.title || `MKS v${candidate.version}`,
    notes: candidate.notes || ''
  };

  const baselineBuild = getEffectiveLocalBaselineBuild();
  const exeNeedsUpdate =
    currentSnapshot.isNativeWindowsShell && remoteDesktopBuild > currentSnapshot.localDesktopBuild;
  const bundleNeedsUpdate = remoteBuild > baselineBuild;

  if (bundleNeedsUpdate || exeNeedsUpdate) {
    // Keep highest remote build if multiple channels report
    const existingBuild = currentSnapshot.remoteManifest?.build || 0;
    if (remoteBuild >= existingBuild) {
      emitSnapshot({
        updateAvailable: true,
        remoteManifest: normalized
      });
      void notifyNativeBridge(normalized, true);
    }
  }
}

export async function checkForMksUpdatesNow(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.onLine) return currentSnapshot.updateAvailable;
  emitSnapshot({ isChecking: true });

  try {
    const ts = Date.now();
    const endpoints = Array.from(
      new Set([
        `${API_BASE}/api/version?t=${ts}`,
        `/api/version?t=${ts}`,
        `/version.json?t=${ts}`
      ])
    );

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, { cache: 'no-store' });
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('json')) continue;
        const data = await res.json();
        if (data && (data.build || data.version)) {
          evaluateCandidateManifest(data);
          break;
        }
      } catch {
        // Sonraki uç noktayı dene
      }
    }

    // Check active Service Worker for waiting update
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update().catch(() => {});
          if (reg.waiting) {
            waitingSwRegistration = reg;
            if (!currentSnapshot.updateAvailable) {
              const swManifest: MksReleaseManifest = {
                version: MKS_CLIENT_VERSION,
                build: MKS_CLIENT_BUILD + 1,
                desktopBuild: currentSnapshot.localDesktopBuild,
                title: 'Yeni Uygulama Paketi Hazır',
                notes: 'Yeni sürüm önbelleğe indirildi, tek tıkla aktif edebilirsiniz.'
              };
              emitSnapshot({
                updateAvailable: true,
                remoteManifest: swManifest
              });
              void notifyNativeBridge(swManifest, true);
            }
          }
        }
      } catch {}
    }
  } finally {
    emitSnapshot({ isChecking: false });
  }

  return currentSnapshot.updateAvailable;
}

export async function applyMksDesktopUpdate(): Promise<void> {
  if (currentSnapshot.isApplying) return;

  const target = currentSnapshot.remoteManifest;
  const targetBuild = target?.build || MKS_CLIENT_BUILD;

  emitSnapshot({
    isApplying: true,
    progressLabel: 'Veriler eşitleniyor...'
  });

  try {
    // 1. Sıfır veri kaybı için yerel kuyruk ve güvenlik yedeğini mühürle
    ensurePreUpdateSafetySnapshot(auth.currentUser?.uid);
    if (navigator.onLine) {
      await Promise.race([
        flushSyncOutboxNow().catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);
    }

    try {
      localStorage.setItem(ACK_CLOUD_BUILD_KEY, String(targetBuild));
      localStorage.setItem('mks_seen_app_build', String(targetBuild));
    } catch {}

    emitSnapshot({ progressLabel: 'Yeni sürüm yükleniyor...' });

    // 2. Service Worker ve eski statik önbelleği temizle (IndexedDB ve Oturum %100 korunur!)
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          if (r.waiting) {
            r.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          await r.update().catch(() => {});
        }
      } catch {}
    }

    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch {}
    }

    // 3. Yerel Windows Masaüstü (.exe) köprüsü varsa hem .exe hem pencereyi güncelle ve yeniden başlat
    if (currentSnapshot.bridgePort) {
      try {
        const exeUrl = target?.desktopDownloadUrl?.startsWith('http')
          ? target.desktopDownloadUrl
          : `${window.location.origin}${target?.desktopDownloadUrl || '/downloads/MKS_Masaustu_Kurulum.exe'}`;

        const bridgeResp = await fetch(`http://127.0.0.1:${currentSnapshot.bridgePort}/update/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: target?.version || MKS_CLIENT_VERSION,
            build: targetBuild,
            desktopBuild: target?.desktopBuild || targetBuild,
            downloadUrl: exeUrl,
            relaunchUrl: `${window.location.origin}/?platform=desktop&v=${targetBuild}&t=${Date.now()}`
          })
        });

        if (bridgeResp.ok) {
          emitSnapshot({ progressLabel: 'Uygulama yeniden başlatılıyor...' });
          return;
        }
      } catch {
        // Köprü yanıt vermezse doğrudan pencereyi yeni sürüme geçir
      }
    }

    // 4. Web / PWA / Masaüstü penceresini taze paketle yeniden yükle
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('previewUpdate');
    nextUrl.searchParams.set('v', String(targetBuild));
    nextUrl.searchParams.set('updatedAt', String(Date.now()));
    window.location.replace(nextUrl.toString());
  } catch (err) {
    console.error('Güncelleme uygulanırken hata:', err);
    emitSnapshot({
      isApplying: false,
      progressLabel: null
    });
  }
}

export async function sendDesktopWindowAction(
  action: 'minimize' | 'toggle-maximize' | 'close'
): Promise<void> {
  // 1. Native Windows Desktop Bridge (MKS_Masaustu.exe)
  if (currentSnapshot.bridgePort) {
    try {
      const res = await fetch(`http://127.0.0.1:${currentSnapshot.bridgePort}/window/${action}`, {
        method: 'POST'
      });
      if (res.ok) return;
    } catch {}
  }

  // 2. Standalone / Browser Desktop Mode Fallbacks
  if (action === 'toggle-maximize') {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
    return;
  }

  if (action === 'minimize') {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      window.blur();
    } catch {}
    return;
  }

  if (action === 'close') {
    try {
      window.close();
      // Tarayıcı sekmesi script tarafından açılmadıysa güvenli şekilde ana vitrine/çıkışa yönlendir
      setTimeout(() => {
        if (!window.closed && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }, 150);
    } catch {}
  }
}

export interface DesktopPdfFileItem {
  name: string;
  path: string;
  size: number;
  date: string;
  timestamp?: number;
}

export function recordDownloadedPdf(name: string, sizeBytes?: number, filePath?: string): void {
  try {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('mks_pdf_history') || '[]';
    const list: DesktopPdfFileItem[] = JSON.parse(raw);
    const now = new Date();
    const formattedDate =
      now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const newItem: DesktopPdfFileItem = {
      name: name.trim(),
      path: filePath || name.trim(),
      size: sizeBytes && sizeBytes > 0 ? sizeBytes : 48500,
      date: formattedDate,
      timestamp: Date.now()
    };

    const deduped = [newItem, ...list.filter(item => item.name !== newItem.name)].slice(0, 50);
    localStorage.setItem('mks_pdf_history', JSON.stringify(deduped));
  } catch {}
}

export async function listDesktopPdfs(): Promise<DesktopPdfFileItem[]> {
  const merged: DesktopPdfFileItem[] = [];
  const seenNames = new Set<string>();

  // 1. Masaüstü Köprüsü (Bridge / Yerel Disk Tarama)
  if (currentSnapshot.bridgePort) {
    try {
      const res = await fetch(`http://127.0.0.1:${currentSnapshot.bridgePort}/pdf/list`, {
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.files)) {
          for (const f of data.files) {
            merged.push(f);
            seenNames.add(f.name.toLowerCase());
          }
        }
      }
    } catch {}
  }

  // 2. Tarayıcı / Uygulama içi İndirme Geçmişi (localStorage)
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('mks_pdf_history');
      if (raw) {
        const localList: DesktopPdfFileItem[] = JSON.parse(raw);
        if (Array.isArray(localList)) {
          for (const item of localList) {
            if (!seenNames.has(item.name.toLowerCase())) {
              merged.push(item);
              seenNames.add(item.name.toLowerCase());
            }
          }
        }
      }
    }
  } catch {}

  // 3. Tarih sırasına göre sırala (en yeni en üstte)
  return merged;
}

export async function openDesktopPdfFolder(): Promise<boolean> {
  if (currentSnapshot.bridgePort) {
    try {
      const res = await fetch(`http://127.0.0.1:${currentSnapshot.bridgePort}/pdf/open-folder`, {
        method: 'POST'
      });
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

export async function openDesktopPdf(filePath?: string): Promise<boolean> {
  if (currentSnapshot.bridgePort) {
    try {
      const url = filePath
        ? `http://127.0.0.1:${currentSnapshot.bridgePort}/pdf/open?path=${encodeURIComponent(filePath)}`
        : `http://127.0.0.1:${currentSnapshot.bridgePort}/pdf/open`;
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

export async function printDesktopPdf(filePath?: string): Promise<boolean> {
  if (currentSnapshot.bridgePort) {
    try {
      const url = filePath
        ? `http://127.0.0.1:${currentSnapshot.bridgePort}/pdf/print?path=${encodeURIComponent(filePath)}`
        : `http://127.0.0.1:${currentSnapshot.bridgePort}/pdf/print`;
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) return true;
    } catch {}
  }
  try {
    window.print();
    return true;
  } catch {}
  return false;
}

export async function printCurrentDesktopPage(): Promise<void> {
  if (currentSnapshot.bridgePort) {
    try {
      const res = await fetch(`http://127.0.0.1:${currentSnapshot.bridgePort}/pdf/print-current`, {
        method: 'POST'
      });
      if (res.ok) return;
    } catch {}
  }
  try {
    window.print();
  } catch {}
}

const RELEASE_VERSION_DOC_PATH = ['MKS', 'g892bEaJyGfEq1Fa67yb', 'system_settings', 'release_version'] as const;

export async function publishCloudReleaseToAllDevices(payload: {
  version: string;
  build: number;
  notes: string;
}): Promise<boolean> {
  try {
    const releaseDoc: MksReleaseManifest & { updatedAtIso: string } = {
      version: payload.version.trim() || MKS_CLIENT_VERSION,
      build: Math.max(MKS_CLIENT_BUILD, Number(payload.build) || MKS_CLIENT_BUILD + 1),
      desktopVersion: `${payload.version.trim() || MKS_CLIENT_VERSION}.0`,
      desktopBuild: Math.max(MKS_CLIENT_BUILD, Number(payload.build) || MKS_CLIENT_BUILD + 1),
      desktopDownloadUrl: '/downloads/MKS_Masaustu_Kurulum.exe',
      androidDownloadUrl: '/downloads/MKS_Android.apk',
      releasedAt: new Date().toISOString().slice(0, 10),
      title: `MKS v${payload.version.trim() || MKS_CLIENT_VERSION} Güncellemesi`,
      notes: payload.notes.trim() || 'Yeni özellikler ve sistem iyileştirmeleri yayınlandı.',
      updatedAtIso: new Date().toISOString()
    };

    await setDoc(doc(firestore, ...RELEASE_VERSION_DOC_PATH), releaseDoc, { merge: true });
    return true;
  } catch (err) {
    console.warn('Bulut sürüm sinyali yazılamadı:', err);
    return false;
  }
}

export async function getCloudReleaseManifest(): Promise<MksReleaseManifest | null> {
  try {
    const snap = await getDoc(doc(firestore, ...RELEASE_VERSION_DOC_PATH));
    if (snap.exists()) {
      return snap.data() as MksReleaseManifest;
    }
  } catch {}
  return null;
}

export function initDesktopUpdateManager(): void {
  if (managerStarted || typeof window === 'undefined') return;
  managerStarted = true;

  detectEnvironmentFromUrlAndBrowser();

  // Window Controls Overlay geometry change listener (Edge / Chrome PWA)
  const wco = (navigator as any).windowControlsOverlay;
  if (wco && typeof wco.addEventListener === 'function') {
    wco.addEventListener('geometrychange', () => {
      detectEnvironmentFromUrlAndBrowser();
    });
  }

  // Service Worker controller / update listener
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;
      if (reg.waiting) {
        waitingSwRegistration = reg;
        evaluateCandidateManifest({
          version: MKS_CLIENT_VERSION,
          build: getEffectiveLocalBaselineBuild() + 1,
          title: 'Yeni Sürüm Hazır'
        });
      }
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            waitingSwRegistration = reg;
            evaluateCandidateManifest({
              version: MKS_CLIENT_VERSION,
              build: getEffectiveLocalBaselineBuild() + 1,
              title: 'Yeni Sürüm Hazır'
            });
          }
        });
      });
    }).catch(() => {});
  }

  // Real-time Firestore listener so pushing an update notifies all open Desktop apps in <1s
  try {
    firestoreUnsub = onSnapshot(
      doc(firestore, ...RELEASE_VERSION_DOC_PATH),
      snap => {
        if (snap.exists()) {
          evaluateCandidateManifest(snap.data() as Partial<MksReleaseManifest>);
        }
      },
      () => {
        // İzin veya çevrimdışı durumunda HTTP /api/version yoklaması devam eder
      }
    );
  } catch {}

  // Immediate check + periodic 45s check + focus/online checks
  void checkForMksUpdatesNow();

  pollIntervalId = window.setInterval(() => {
    void checkForMksUpdatesNow();
  }, 45_000);

  window.addEventListener('focus', () => {
    void checkForMksUpdatesNow();
  });
  window.addEventListener('online', () => {
    void checkForMksUpdatesNow();
  });

  // Allow native C# bridge or console to trigger pre-update sync flush before restart
  (window as any).mks_trigger_desktop_update = () => applyMksDesktopUpdate();
}

export function subscribeDesktopUpdateState(
  listener: (snap: DesktopUpdateSnapshot) => void
): () => void {
  initDesktopUpdateManager();
  listeners.add(listener);
  listener(currentSnapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function getDesktopUpdateState(): DesktopUpdateSnapshot {
  initDesktopUpdateManager();
  return currentSnapshot;
}

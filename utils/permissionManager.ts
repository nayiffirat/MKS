import {
  getNotificationPermissionStatus,
  requestAllPlatformNotificationPermissions
} from './smartNotificationEngine';

/**
 * Tek merkezden cihaz izinleri (iOS, Android, Windows masaüstü, web).
 * Yeni bir özellik izin gerektirirse sadece PERMISSION_DEFS listesine eklenir.
 * Yerel uygulamalarda (Capacitor) tarayıcı API'leri, AndroidManifest / Info.plist
 * içinde tanımlı izinlerle işletim sisteminin kendi izin penceresini açar.
 */
export type PermissionKey = 'camera' | 'location' | 'notifications' | 'microphone';
export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface PermissionRequestOutcome {
  status: PermissionStatus;
  hint?: string;
}

const lastPermissionHints: Partial<Record<PermissionKey, string>> = {};

export function getPermissionHint(key: PermissionKey): string | undefined {
  return lastPermissionHints[key];
}

export interface PermissionDef {
  key: PermissionKey;
  title: string;
  reason: string;
}

export const PERMISSION_DEFS: PermissionDef[] = [
  { key: 'camera', title: 'Kamera', reason: 'BKTS/GTS 2D karekod, barkod, fatura ve yaprak hastalığı yapay zeka analizi' },
  { key: 'location', title: 'Konum', reason: 'Harita, tarla parsel çizimi, TKGM sorgusu ve ilaçlama hava durumu' },
  { key: 'notifications', title: 'Bildirimler', reason: 'Vade, çek-senet, aranacaklar ve hatırlatma uyarıları' },
  { key: 'microphone', title: 'Mikrofon', reason: 'Sesli saha notu ve sesli komut' }
];

const normalize = (s: string | undefined): PermissionStatus =>
  s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';

async function queryBrowser(name: string): Promise<PermissionStatus> {
  try {
    if (!navigator.permissions?.query) return 'prompt';
    const res = await navigator.permissions.query({ name: name as PermissionName });
    return normalize(res.state);
  } catch {
    return 'prompt';
  }
}

export async function getPermissionStatus(key: PermissionKey): Promise<PermissionStatus> {
  if (typeof navigator === 'undefined') return 'unsupported';
  switch (key) {
    case 'notifications':
      return getNotificationPermissionStatus() as Promise<PermissionStatus>;
    case 'camera':
      if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
      return queryBrowser('camera');
    case 'microphone':
      if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
      return queryBrowser('microphone');
    case 'location':
      if (!navigator.geolocation) return 'unsupported';
      return queryBrowser('geolocation');
  }
}

export async function requestPermission(key: PermissionKey): Promise<PermissionStatus> {
  delete lastPermissionHints[key];
  try {
    switch (key) {
      case 'notifications':
        return (await requestAllPlatformNotificationPermissions()) as PermissionStatus;
      case 'camera':
      case 'microphone': {
        if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
        const stream = await navigator.mediaDevices.getUserMedia(
          key === 'camera' ? { video: { facingMode: 'environment' } } : { audio: true }
        );
        stream.getTracks().forEach((t) => t.stop());
        return 'granted';
      }
      case 'location':
        if (!navigator.geolocation) return 'unsupported';
        return await new Promise<PermissionStatus>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve('granted'),
            (err) => {
              if (err.code === err.PERMISSION_DENIED) {
                resolve('denied');
              } else {
                lastPermissionHints.location =
                  'Konum sinyali alınamadı veya zaman aşımına uğradı. Cihazın GPS/Konum servisinin açık olduğundan emin olup tekrar deneyin.';
                resolve('prompt');
              }
            },
            { timeout: 15000, maximumAge: 60000 }
          );
        });
    }
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const name = err?.name || '';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
      return 'unsupported';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      lastPermissionHints[key] =
        key === 'camera'
          ? 'Kamera şu anda başka bir uygulama veya sekme tarafından kullanılıyor. Diğer uygulamayı kapatıp tekrar deneyin.'
          : 'Mikrofon şu anda başka bir uygulama tarafından kullanılıyor. Diğer uygulamayı kapatıp tekrar deneyin.';
      return 'prompt';
    }
    if (name === 'AbortError') {
      lastPermissionHints[key] = 'İzin isteği yarıda kesildi. Tekrar deneyebilirsiniz.';
      return 'prompt';
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return 'denied';
    }
    return queryBrowser(key === 'location' ? 'geolocation' : key);
  }
}

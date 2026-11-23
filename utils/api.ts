import { Capacitor } from '@capacitor/core';

/**
 * Çiftçiye WhatsApp ile gönderilecek Üretici Portalı ve bulut API kök adresi.
 * Mühendis Android APK (Capacitor) veya masaüstü uygulamasından işlem yapıyor olsa bile
 * çiftçinin kendi telefonundan uygulama indirmeden ve giriş yapmadan açabileceği canlı HTTPS adresini seçer.
 */
export const PUBLIC_PORTAL_ORIGIN = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PUBLIC_APP_URL) ||
  'https://m-hendis-kay-t-sistemi-65385039239.europe-west3.run.app'
).replace(/\/$/, '');

export const getApiBase = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    if (Capacitor.isNativePlatform()) {
      return PUBLIC_PORTAL_ORIGIN;
    }
  } catch {
    // Web ortamında devam et
  }

  const origin = window.location.origin || '';
  const hostname = window.location.hostname || '';
  const port = window.location.port || '';

  // Express API'yi aynı origin'de barındıran yerel geliştirme (:3000/:5173) ve doğrudan Cloud Run adresleri
  if (
    /^https:\/\/m-hendis-kay-t-sistemi-[a-z0-9.-]+\.run\.app$/i.test(origin) ||
    ((hostname === 'localhost' || hostname === '127.0.0.1' || /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) &&
      Boolean(port))
  ) {
    return '';
  }

  // Firebase Hosting (muhendiskayitsistemi.com, .web.app, .firebaseapp.com), Capacitor ve file:// -> Cloud Run API
  return PUBLIC_PORTAL_ORIGIN;
};

export const API_BASE = getApiBase();

export const buildPublicPortalUrl = (token: string): string => {
  const cleanToken = encodeURIComponent(token.trim());
  if (typeof window === 'undefined') {
    return `${PUBLIC_PORTAL_ORIGIN}/?token=${cleanToken}`;
  }

  const origin = window.location.origin || '';
  const isLocalOrNative =
    !origin.startsWith('http') ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin);

  if (isLocalOrNative) {
    return `${PUBLIC_PORTAL_ORIGIN}/?token=${cleanToken}`;
  }

  const basePath = window.location.pathname.replace(/\/portal\.html$/i, '/');
  const normalizedPath = basePath.endsWith('/') ? basePath : basePath.replace(/\/[^/]*$/, '/');
  const url = new URL(`${origin}${normalizedPath}`);
  url.searchParams.set('token', token.trim());
  return url.toString();
};

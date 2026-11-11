import React, { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, ChevronLeft } from 'lucide-react';

type BackHandlerEntry = {
  id: string;
  label?: string;
  handler: () => boolean | void; // return true if handled
  priority: number;
};

const backStack: BackHandlerEntry[] = [];
let lastExitAttemptTime = 0;

/**
 * D-09: X/kapat ile (geri tuşu olmadan) kapatılan katmanın sentetik geçmiş girdisi geri alınır.
 * Bu `history.back()` çağrısının ürettiği popstate "sessiz" kabul edilir ve App'in popstate
 * dinleyicisine ulaşmadan tüketilir (yoksa bir katman daha kapanır / ekran geri gider).
 */
let silentPopCount = 0;
let silentPopDeadline = 0;

if (typeof window !== 'undefined') {
  // Modül yüklenirken (App'in useEffect dinleyicisinden ÖNCE) kaydedilir → stopImmediatePropagation çalışır.
  window.addEventListener('popstate', (event: PopStateEvent) => {
    if (silentPopCount > 0) {
      if (Date.now() <= silentPopDeadline) {
        silentPopCount -= 1;
        event.stopImmediatePropagation();
        return;
      }
      // Süresi geçmiş (popstate hiç gelmemiş) sayaç gerçek bir geri hareketini yutmasın
      silentPopCount = 0;
    }
  });
}

function scheduleHistoryCleanup(id: string) {
  if (typeof window === 'undefined') return;
  // StrictMode'daki kaldır→yeniden-ekle döngüsünde gereksiz geri gitmeyi önlemek için bir tick ertele
  window.setTimeout(() => {
    if (backStack.some(item => item.id === id)) return; // katman yeniden kaydedildi
    const state = window.history.state;
    if (state && state.layerId === id) {
      silentPopCount += 1;
      silentPopDeadline = Date.now() + 1500;
      window.history.back();
    }
  }, 0);
}

export function pushBackHandler(id: string, handler: () => boolean | void, priority = 10, label?: string) {
  const existingIdx = backStack.findIndex(item => item.id === id);
  if (existingIdx !== -1) {
    backStack.splice(existingIdx, 1);
  }
  backStack.push({ id, handler, priority, label });
  backStack.sort((a, b) => a.priority - b.priority);
  // Push a synthetic history entry so browser/Android popstate catches it instead of leaving the page
  if (typeof window !== 'undefined') {
    const currentState = window.history.state || { view: 'DASHBOARD' };
    if (currentState.layerId !== id) {
      window.history.pushState({ ...currentState, layerId: id, layerDepth: backStack.length }, '');
    }
  }
  return () => removeBackHandler(id);
}

export function removeBackHandler(id: string) {
  const idx = backStack.findIndex(item => item.id === id);
  if (idx !== -1) {
    backStack.splice(idx, 1);
  }
  // Geçmişin en üstü hâlâ bu katmansa (X / ESC / Android geri ile kapatıldı) hayalet girdiyi temizle
  scheduleHistoryCleanup(id);
}

export function getBackStackDepth(): number {
  return backStack.length;
}

export function hasActiveBackLayers(): boolean {
  return backStack.length > 0;
}

let isExecutingSmartBack = false;

/** Elemanın veya en yakın konumlandırılmış atasının hesaplanmış z-index değeri (yoksa 0). */
function getEffectiveZIndex(el: HTMLElement | null): number {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (style.position !== 'static') {
      const z = parseInt(style.zIndex, 10);
      if (!isNaN(z)) return z;
    }
    node = node.parentElement;
  }
  return 0;
}

/** Görünür ve etkileşime açık mı? (kapalı çekmece: inert / aria-hidden / visibility:hidden / display:none) */
function isInteractable(el: HTMLElement): boolean {
  if (el.closest('[inert], [aria-hidden="true"]')) return false;
  if (el.getClientRects().length === 0) return false;
  return window.getComputedStyle(el).visibility !== 'hidden';
}

/**
 * Automatically checks if an unregistered modal overlay (fixed inset-0 z-50/z-[60]/z-[70])
 * is currently open in the DOM and clicks its close/cancel button so the user never loses their page.
 * UI-10: Seçim DOM sırasına göre değil, hesaplanmış z-index'e göre yapılır (eşitlikte DOM'da sonraki).
 */
function tryCloseTopmostDomModal(): boolean {
  if (typeof document === 'undefined') return false;
  const explicitCloseBtns = Array.from(document.querySelectorAll<HTMLElement>('[data-mks-modal-close="true"]'))
    .filter(isInteractable)
    .map((btn, domIndex) => ({ btn, domIndex, z: getEffectiveZIndex(btn) }))
    .sort((a, b) => (a.z - b.z) || (a.domIndex - b.domIndex));

  // Find fixed full-screen modal overlays (excluding full-screen map/views marked data-mks-not-modal="true")
  const modals = Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0'))
    .map((el, domIndex) => ({ el, domIndex, z: parseInt(window.getComputedStyle(el).zIndex, 10) }))
    .filter(({ el, z }) => {
      if (el.getAttribute('data-mks-not-modal') === 'true') return false;
      if (isNaN(z) || z < 40) return false;
      // Ignore background decorative elements or pointer-events-none layers
      if (el.classList.contains('pointer-events-none')) return false;
      if (!isInteractable(el)) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 100 && rect.height > 100;
    })
    .sort((a, b) => (a.z - b.z) || (a.domIndex - b.domIndex));

  const topExplicit = explicitCloseBtns.length > 0 ? explicitCloseBtns[explicitCloseBtns.length - 1] : null;
  const topModalEntry = modals.length > 0 ? modals[modals.length - 1] : null;

  // Açık kapatma butonu, en üstteki perde ile aynı veya daha üst katmandaysa (ya da perdenin içindeyse) onu kullan
  if (topExplicit && (!topModalEntry || topExplicit.z >= topModalEntry.z || topModalEntry.el.contains(topExplicit.btn))) {
    topExplicit.btn.click();
    return true;
  }

  if (!topModalEntry) return false;
  const topModal = topModalEntry.el;

  const explicitInside = topModal.querySelector<HTMLElement>('[data-mks-modal-close="true"]');
  if (explicitInside && isInteractable(explicitInside)) {
    explicitInside.click();
    return true;
  }

  // Look for a close button inside the topmost modal (X icon button, or Kapat/İptal/Geri button in modal header)
  const buttons = Array.from(topModal.querySelectorAll<HTMLButtonElement>('button'));
  for (const btn of buttons) {
    if (btn.getAttribute('data-mks-screen-back') === 'true') continue;
    const text = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    const hasCloseIcon = btn.querySelector('svg.lucide-x') !== null;
    if (
      hasCloseIcon ||
      aria.includes('kapat') ||
      aria.includes('close') ||
      text === 'kapat' ||
      text === 'iptal' ||
      text === 'vazgeç'
    ) {
      btn.click();
      return true;
    }
  }
  return false;
}

/**
 * Executes a single deterministic step backward:
 * 1. Topmost registered modal / detail view (e.g. Cari Ekstre -> Cari Detay -> Cari Liste)
 * 2. Topmost DOM modal overlay if any
 * 3. Returns false if nothing intercepted so App.tsx can step back its main view history.
 */
export function executeSmartBackStep(): boolean {
  if (isExecutingSmartBack) return false;
  isExecutingSmartBack = true;
  try {
    while (backStack.length > 0) {
      const top = backStack[backStack.length - 1];
      backStack.pop();
      try {
        const res = top.handler();
        if (res !== false) {
          return true;
        }
      } catch (e) {
        console.warn('Back handler error:', e);
      }
    }

    if (tryCloseTopmostDomModal()) {
      return true;
    }

    return false;
  } finally {
    isExecutingSmartBack = false;
  }
}

export function shouldAllowAppExit(showToast?: (msg: string, type?: any) => void): boolean {
  const now = Date.now();
  if (now - lastExitAttemptTime < 2200) {
    return true;
  }
  lastExitAttemptTime = now;
  if (showToast) {
    showToast('Uygulamadan çıkmak için tekrar geri tuşuna basın', 'info');
  }
  return false;
}

/**
 * React hook to register a back-button layer (e.g., when a modal, drawer, or detail screen is open).
 */
export function useBackHandler(isActive: boolean, onBack: () => void, idPrefix = 'layer', priority = 20) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const idRef = useRef(`${idPrefix}_${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (!isActive) {
      removeBackHandler(idRef.current);
      return;
    }
    const cleanup = pushBackHandler(
      idRef.current,
      () => {
        onBackRef.current();
        return true;
      },
      priority
    );
    return cleanup;
  }, [isActive, priority]);
}

/**
 * React hook to lock background scrolling when a modal or overlay is active.
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehaviorY;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehaviorY = 'contain';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehaviorY = originalOverscroll;
    };
  }, [isLocked]);
}

/**
 * Initializes automatic background scroll-lock whenever any modal (.fixed.inset-0.z-50+) is open,
 * plus ESC key support for Desktop/Web.
 */
export function initGlobalNavigationAndScrollGuard(onGlobalBackTrigger: () => void) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const checkModalsForScrollLock = () => {
    const activeModals = Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0')).filter(el => {
      if (el.classList.contains('pointer-events-none')) return false;
      if (el.getAttribute('data-mks-not-modal') === 'true') return false;
      const z = parseInt(window.getComputedStyle(el).zIndex || '0', 10);
      return z >= 45;
    });

    if (activeModals.length > 0) {
      document.body.classList.add('mks-modal-open-lock');
      activeModals.forEach(m => {
        m.style.overscrollBehavior = 'contain';
      });
    } else {
      document.body.classList.remove('mks-modal-open-lock');
    }
  };

  // UI-62: Animasyonlar sırasında yüzlerce mutasyon gelir; tarama kare başına en fazla bir kez yapılır.
  let rafId: number | null = null;
  const observer = new MutationObserver(() => {
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      checkModalsForScrollLock();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      // If user is typing in an input/textarea outside a modal, blur first; if modal or screen is active, step back
      if (executeSmartBackStep()) {
        e.preventDefault();
        return;
      }
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
        e.preventDefault();
        onGlobalBackTrigger();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  return () => {
    observer.disconnect();
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', handleKeyDown);
    document.body.classList.remove('mks-modal-open-lock');
  };
}

/**
 * Returns true if the current device is Desktop/Web (mouse/keyboard) rather than Mobile/Tablet touch.
 */
export function isDesktopOrWebEnvironment(): boolean {
  if (typeof window === 'undefined') return true;
  if (Capacitor.isNativePlatform()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('platform') === 'desktop') return true;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const isWideScreen = window.innerWidth >= 1024;
  return !isTouchDevice || isWideScreen;
}

/**
 * Edge Swipe-Back Gesture Overlay for Mobile & Tablet (iOS / mobile web touch swipe from the leading edge)
 * UI-62: Android native'de işletim sisteminin geri hareketiyle çakıştığı için devre dışı; swipeDelta ref'te tutulur
 * (dinleyiciler her dokunma hareketinde yeniden bağlanmaz); RTL (Arapça) için sağ kenardan çalışır.
 */
export const EdgeSwipeBackGesture: React.FC<{ onTriggerBack: () => void; enabled?: boolean }> = ({
  onTriggerBack,
  enabled = true
}) => {
  const [swipeDelta, setSwipeDelta] = useState(0);
  const [swipeY, setSwipeY] = useState(280);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const swipeDeltaRef = useRef(0);
  const onTriggerBackRef = useRef(onTriggerBack);
  onTriggerBackRef.current = onTriggerBack;

  const isAndroidNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  const active = enabled && !isAndroidNative;
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const EDGE = 26;
    const updateDelta = (value: number) => {
      swipeDeltaRef.current = value;
      setSwipeDelta(value);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rtl = document.documentElement.dir === 'rtl';
      const fromEdge = rtl ? window.innerWidth - touch.clientX : touch.clientX;
      // Trigger only when starting within 26px of the leading screen edge
      if (fromEdge <= EDGE) {
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        setSwipeY(touch.clientY);
      } else {
        startXRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startXRef.current === null || startYRef.current === null) return;
      const touch = e.touches[0];
      const rtl = document.documentElement.dir === 'rtl';
      const dx = rtl ? startXRef.current - touch.clientX : touch.clientX - startXRef.current;
      const dy = Math.abs(touch.clientY - startYRef.current);

      if (dy > dx * 1.2 && dy > 25) {
        // Vertical scroll, cancel edge swipe
        startXRef.current = null;
        updateDelta(0);
        return;
      }

      if (dx > 8) {
        updateDelta(Math.min(110, dx));
      }
    };

    const handleTouchEnd = () => {
      if (startXRef.current !== null && swipeDeltaRef.current >= 68) {
        onTriggerBackRef.current();
      }
      startXRef.current = null;
      startYRef.current = null;
      if (swipeDeltaRef.current !== 0) updateDelta(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [active]);

  if (!active || swipeDelta <= 10) return null;

  const progress = Math.min(1, swipeDelta / 68);
  const offset = Math.min(36, swipeDelta * 0.45) - 16;

  return (
    <div
      className={`fixed ${isRtl ? 'right-0' : 'left-0'} z-[9999] pointer-events-none flex items-center justify-center transition-transform duration-75`}
      aria-hidden="true"
      style={{
        top: Math.max(80, Math.min(window.innerHeight - 120, swipeY - 28)),
        transform: `translateX(${isRtl ? -offset : offset}px) scale(${0.75 + progress * 0.25})`,
        opacity: Math.min(1, progress * 1.2)
      }}
    >
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl border backdrop-blur-xl ${
          progress >= 1
            ? 'bg-emerald-500 text-stone-950 border-emerald-300 shadow-emerald-500/40'
            : 'bg-stone-900/90 text-white border-white/15'
        }`}
      >
        <ChevronLeft size={22} className={`stroke-[2.5] ${isRtl ? 'rotate-180' : ''}`} />
      </div>
    </div>
  );
};

/**
 * Smart Back Button that is VISIBLE on Desktop / Web (where mouse is used)
 * and AUTOMATICALLY HIDDEN on Mobile / Tablet (where touch swipe & Android nav bar are used).
 */
export const DesktopSmartBackButton: React.FC<{
  onClick: () => void;
  label?: string;
  className?: string;
}> = ({ onClick, label = 'Geri Dön', className = '' }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Önceki ekrana dön (ESC)"
      className={`mks-desktop-only-back hidden lg:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-stone-200 hover:text-white border border-white/10 transition-all active:scale-95 text-xs font-semibold shadow-sm ${className}`}
    >
      <ArrowLeft size={15} className="text-emerald-400" />
      <span>{label}</span>
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 border border-white/5 ml-0.5">
        ESC
      </span>
    </button>
  );
};

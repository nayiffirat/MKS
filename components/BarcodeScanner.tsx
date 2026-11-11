import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Check, Loader2, ScanLine, Flashlight, FlashlightOff, Keyboard, CornerDownLeft } from 'lucide-react';
import ModalCloseButton from './ModalCloseButton';
import { useBackHandler } from '../utils/navigationManager';

export interface BarcodeScanMeta {
  /** Library format name, e.g. DATA_MATRIX, QR_CODE, EAN_13 — or 'MANUAL' for typed input. */
  format?: string;
}

interface BarcodeScannerProps {
  onScan: (decodedText: string, meta?: BarcodeScanMeta) => void;
  onClose: () => void;
  continuous?: boolean;
  title?: string;
}

/** Same code is ignored for this long in continuous mode (a box held in front of the camera). */
const SAME_CODE_COOLDOWN_MS = 3000;
/** Minimum gap between any two accepted reads in continuous mode. */
const ANY_CODE_GAP_MS = 800;

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, continuous = false, title }) => {
  // Callbacks live in refs so parent re-renders never restart the camera (B-07).
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const continuousRef = useRef(continuous);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;
  continuousRef.current = continuous;

  const readerIdRef = useRef(`mks-reader-${Math.random().toString(36).slice(2, 10)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startPromiseRef = useRef<Promise<unknown> | null>(null);
  const mountedRef = useRef(true);
  const handledRef = useRef(false);        // single-shot mode: only the first read counts
  const lastCodeRef = useRef('');
  const lastTsRef = useRef(0);
  const lastAnyTsRef = useRef(0);
  const closeTimerRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const [showSuccess, setShowSuccess] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastAccepted, setLastAccepted] = useState('');

  const requestClose = useCallback(() => onCloseRef.current(), []);
  useBackHandler(true, requestClose, 'BarcodeScanner', 90);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      // Wait for a pending start() so a rapid close never leaves the camera running.
      if (startPromiseRef.current) await startPromiseRef.current.catch(() => undefined);
      if (scanner.isScanning) await scanner.stop();
    } catch (err) {
      console.warn('[BarcodeScanner] stop failed', err);
    }
    try {
      scanner.clear();
    } catch {
      /* element may already be gone */
    }
  }, []);

  const handleDecoded = useCallback((rawText: string, meta: BarcodeScanMeta, bypassCooldown = false) => {
    if (!mountedRef.current) return;
    const text = String(rawText ?? '');
    if (!text.trim()) return;
    const now = Date.now();

    if (!continuousRef.current) {
      if (handledRef.current) return;
      handledRef.current = true;
    } else if (!bypassCooldown) {
      if (now - lastAnyTsRef.current < ANY_CODE_GAP_MS) return;
      if (text === lastCodeRef.current && now - lastTsRef.current < SAME_CODE_COOLDOWN_MS) return; // B-06
    }
    lastCodeRef.current = text;
    lastTsRef.current = now;
    lastAnyTsRef.current = now;
    setLastAccepted(text.replace(/\u001D/g, '‹GS›'));

    setShowSuccess(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(40);
    try {
      onScanRef.current(text, meta);
    } catch (err) {
      console.error('[BarcodeScanner] onScan handler failed', err);
    }

    if (!continuousRef.current) {
      void stopCamera();
      closeTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) onCloseRef.current();
      }, 700);
    } else {
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
      successTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setShowSuccess(false);
      }, 650);
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    const readerId = readerIdRef.current;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.RSS_14,
            Html5QrcodeSupportedFormats.RSS_EXPANDED,
          ],
          // Native BarcodeDetector (Chrome/Android WebView) reads small DataMatrix far better than ZXing-js.
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        scannerRef.current = scanner;
        const startPromise = scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: (w: number, h: number) => {
              const size = Math.max(160, Math.floor(Math.min(w, h) * 0.72));
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
          },
          (decodedText, decodedResult) => {
            const format = (decodedResult as any)?.result?.format?.formatName as string | undefined;
            handleDecoded(decodedText, { format });
          },
          () => {
            /* per-frame decode misses are expected */
          }
        );
        startPromiseRef.current = startPromise;
        await startPromise;
        if (!mountedRef.current) {
          await stopCamera();
          return;
        }
        setIsInitializing(false);
        try {
          const caps = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          if (caps && 'torch' in caps && caps.torch) setTorchSupported(true);
        } catch {
          /* capabilities not available on this browser */
        }
      } catch (err: any) {
        console.warn('Scanner initialization failed:', err);
        if (!mountedRef.current) return;
        const name = err?.name || '';
        const msg = String(err?.message || err || '');
        setErrorText(
          name === 'NotAllowedError' || /permission|izin/i.test(msg)
            ? 'Kamera izni verilmedi. Ayarlardan kamera iznini açabilir veya barkodu aşağıdan elle girebilirsiniz.'
            : name === 'NotReadableError'
              ? 'Kamera başka bir uygulama tarafından kullanılıyor. Diğer uygulamayı kapatıp tekrar deneyin veya barkodu elle girin.'
              : 'Kamera açılamadı. Barkodu / karekodu aşağıdan elle girebilirsiniz.'
        );
        setIsInitializing(false);
        setManualOpen(true);
      }
    };

    // Small delay to ensure the reader element is in the DOM.
    const timer = window.setTimeout(() => { void startScanner(); }, 60);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
      void stopCamera();
    };
    // Camera must start exactly once per mount (B-07).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner || !torchSupported) return;
    const next = !torchOn;
    try {
      await scanner.applyVideoConstraints({ advanced: [{ torch: next } as any] } as MediaTrackConstraints);
      setTorchOn(next);
    } catch (err) {
      console.warn('[BarcodeScanner] torch toggle failed', err);
      setTorchSupported(false);
    }
  };

  const submitManual = (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    handleDecoded(code, { format: 'MANUAL' }, true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200">
      <div className="bg-stone-900 w-full max-w-sm rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl relative flex flex-col h-[min(80dvh,620px)] max-h-[90dvh]">

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between gap-2 z-30 bg-gradient-to-b from-black/90 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 backdrop-blur-md border border-emerald-500/30">
              <ScanLine size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-base tracking-wide truncate">{title || 'Barkod / Karekod Tarayıcı'}</h3>
              {continuous && <p className="text-[11px] text-emerald-300/90 font-semibold">Sürekli okuma açık</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                aria-label={torchOn ? 'Feneri kapat' : 'Feneri aç'}
                aria-pressed={torchOn}
                className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border border-white/10 transition-colors ${torchOn ? 'bg-amber-400 text-stone-900' : 'bg-stone-800/80 text-stone-200 hover:bg-stone-700/90'}`}
              >
                {torchOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
              </button>
            )}
            <ModalCloseButton onClick={requestClose} label="Tarayıcıyı kapat" />
          </div>
        </div>

        {/* Scanner Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {isInitializing && !errorText && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-stone-950">
              <Loader2 size={40} className="text-emerald-500 animate-spin mb-4" />
              <p className="text-stone-400 text-xs font-bold tracking-widest uppercase">Kamera Başlatılıyor...</p>
            </div>
          )}

          {errorText && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center bg-stone-950">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 mb-4 border border-red-500/20">
                <Camera size={32} />
              </div>
              <p className="text-white font-bold text-lg mb-2">Kamera Açılamadı</p>
              <p className="text-stone-400 text-sm leading-relaxed">{errorText}</p>
            </div>
          )}

          <div id={readerIdRef.current} className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full"></div>

          {/* Scanning Overlay Effect */}
          {!isInitializing && !errorText && !showSuccess && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <div className="relative w-[72%] max-w-[260px] aspect-square border-2 border-emerald-500/50 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>
                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.6)] animate-[mksscan_2s_ease-in-out_infinite]"></div>
              </div>
            </div>
          )}

          {/* Success Overlay */}
          {showSuccess && (
            <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-150 ${continuous ? 'bg-emerald-500/40 pointer-events-none' : 'bg-emerald-500/90'}`}>
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-2xl animate-in zoom-in duration-200">
                <Check size={40} className="text-emerald-500" />
              </div>
              <p className="text-white font-black text-2xl tracking-wide">Okundu!</p>
              {lastAccepted && <p className="mt-2 px-6 text-center text-[11px] text-white/90 font-mono break-all line-clamp-2">{lastAccepted}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative z-30 p-4 bg-stone-950/95 border-t border-white/10 flex flex-col gap-3">
          {manualOpen ? (
            <form onSubmit={submitManual} className="flex items-stretch gap-2">
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                data-barcode-input="true"
                autoFocus
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  // Wedge scanners end with Enter; the global listener cancels the default
                  // (form submit) for scan bursts, so submit explicitly here.
                  if (e.key === 'Enter') { e.preventDefault(); submitManual(); }
                }}
                placeholder="Barkod / karekod metni"
                aria-label="Manuel barkod veya karekod"
                className="flex-1 min-w-0 min-h-[44px] rounded-xl bg-stone-900 border border-white/15 px-3 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 flex items-center gap-1.5"
              >
                <CornerDownLeft size={16} /> Ekle
              </button>
            </form>
          ) : (
            <p className="text-sm text-stone-300 font-medium text-center">Barkodu / karekodu çerçevenin içine hizalayın</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setManualOpen(v => !v)}
              aria-expanded={manualOpen}
              className="flex-1 min-h-[44px] px-3 rounded-xl bg-stone-800 text-stone-100 font-bold text-sm border border-white/10 hover:bg-stone-700 transition-colors flex items-center justify-center gap-2"
            >
              <Keyboard size={16} /> {manualOpen ? 'Kameraya Dön' : 'Manuel Barkod / Karekod Gir'}
            </button>
            {(continuous || errorText) && (
              <button
                type="button"
                onClick={requestClose}
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors"
              >
                {continuous ? 'Bitir' : 'Kapat'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes mksscan {
            0% { transform: translateY(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(250px); opacity: 0; }
        }
        /* Hide html5-qrcode default UI elements */
        [id^="mks-reader-"] [id$="__dashboard_section_csr"],
        [id^="mks-reader-"] [id$="__dashboard_section_swaplink"],
        [id^="mks-reader-"] [id$="__header_message"] {
            display: none !important;
        }
      `}} />
    </div>
  );
};

export default BarcodeScanner;

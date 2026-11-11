import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Minus,
  Square,
  X,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  FileText,
  FolderOpen,
  Printer
} from 'lucide-react';
import { MksBrandLogo } from './MksBrandLogo';
import {
  DesktopUpdateSnapshot,
  subscribeDesktopUpdateState,
  applyMksDesktopUpdate,
  sendDesktopWindowAction,
  checkForMksUpdatesNow,
  openDesktopPdfFolder,
  printCurrentDesktopPage
} from '../utils/desktopUpdateManager';
import { PdfQuickAccessModal } from './PdfQuickAccessModal';

export const DesktopWindowTitlebar: React.FC = () => {
  const [snap, setSnap] = useState<DesktopUpdateSnapshot | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeDesktopUpdateState(next => {
      setSnap({ ...next });
      if (typeof document !== 'undefined') {
        const offset = next.isWindowControlsOverlay
          ? '36px'
          : next.isDesktopApp && !next.isNativeWindowsShell
          ? '34px'
          : '0px';
        document.documentElement.style.setProperty('--mks-titlebar-offset', offset);
      }
    });

    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      unsub();
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  if (!snap) return null;

  const targetVersion = snap.remoteManifest?.version || snap.localVersion;
  const targetNotes =
    snap.remoteManifest?.notes ||
    'Yeni masaüstü güncellemesi hazır. Verileriniz korunarak tek tıkla güncellenir.';

  const renderPdfAndPrintToolButtons = () => (
    <div
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className="inline-flex items-center gap-1.5 mr-2"
    >
      <button
        type="button"
        onClick={() => void openDesktopPdfFolder()}
        title="İndirilen PDF dosya konumunu / klasörünü aç"
        className="h-[24px] px-2 rounded-md bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-300 hover:text-white text-[11px] font-medium inline-flex items-center gap-1 border border-slate-700/80 transition-colors cursor-pointer"
      >
        <FolderOpen size={12} className="text-amber-400" />
        <span className="hidden sm:inline">Klasör</span>
      </button>

      <button
        type="button"
        onClick={() => setIsPdfModalOpen(true)}
        title="İndirilen tüm PDF'leri listele ve aç (Tarih Sırasına Göre)"
        className="h-[24px] px-2.5 rounded-md bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white text-[11px] font-bold inline-flex items-center gap-1 border border-rose-400/50 transition-colors cursor-pointer shadow-xs"
      >
        <FileText size={12} className="text-white" />
        <span>PDF</span>
      </button>

      <button
        type="button"
        onClick={() => void printCurrentDesktopPage()}
        title="Doğrudan Yazdır (Ctrl+P)"
        className="h-[24px] px-2 rounded-md bg-emerald-700/80 hover:bg-emerald-600 active:scale-[0.98] text-white text-[11px] font-medium inline-flex items-center gap-1 border border-emerald-500/40 transition-colors cursor-pointer"
      >
        <Printer size={12} />
        <span className="hidden sm:inline">Yazdır</span>
      </button>
    </div>
  );

  const renderUpdatePillButton = () => (
    <AnimatePresence>
      {(snap.updateAvailable || snap.isApplying) && (
        <motion.button
          key="mks-titlebar-update-btn"
          type="button"
          initial={{ opacity: 0, x: 10, scale: 0.94 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 8, scale: 0.95 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => void applyMksDesktopUpdate()}
          disabled={snap.isApplying}
          title={`MKS v${targetVersion}: ${targetNotes}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="h-[24px] px-2.5 mr-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shadow-sm border border-emerald-400/40 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-80"
        >
          {snap.isApplying ? (
            <>
              <RefreshCw size={12} className="animate-spin shrink-0" />
              <span>{snap.progressLabel || 'Güncelleniyor...'}</span>
            </>
          ) : (
            <>
              <DownloadCloud size={12} className="shrink-0" />
              <span>Güncelle (v{targetVersion})</span>
            </>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );

  // 1. Edge / Chrome PWA Window Controls Overlay Mode (sits directly inside native OS titlebar next to — □ ✕)
  if (snap.isWindowControlsOverlay) {
    return (
      <>
        <PdfQuickAccessModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} />
        <div className="h-[36px] w-full shrink-0" aria-hidden="true" />
        <div
          style={
            {
              position: 'fixed',
              top: 'env(titlebar-area-y, 0px)',
              left: 'env(titlebar-area-x, 0px)',
              width: 'env(titlebar-area-width, 100%)',
              height: 'env(titlebar-area-height, 36px)',
              WebkitAppRegion: 'drag'
            } as React.CSSProperties
          }
          className="z-[140] bg-[#070B11]/95 backdrop-blur-md border-b border-white/[0.08] px-3 flex items-center justify-between select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <MksBrandLogo size="xs" rounded="lg" />
            <span className="text-[11px] font-semibold text-stone-200 truncate">
              Mühendis Kayıt Sistemi — Masaüstü v{snap.localVersion}
            </span>
          </div>
          <div className="flex items-center">
            {renderPdfAndPrintToolButtons()}
            {renderUpdatePillButton()}
          </div>
        </div>
      </>
    );
  }

  // 2. Desktop Mode without Native C# Caption Bar (?platform=desktop in standalone window / preview)
  if (snap.isDesktopApp && !snap.isNativeWindowsShell) {
    return (
      <>
        <PdfQuickAccessModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} />
        <div
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          className="sticky top-0 z-[140] h-[34px] w-full bg-[#070B11] border-b border-white/[0.08] pl-3 flex items-center justify-between select-none shrink-0"
        >
          {/* Left: App Icon + Title + Version */}
          <div className="flex items-center gap-2 min-w-0">
            <MksBrandLogo size="xs" rounded="lg" />
            <span className="text-[11px] font-semibold text-stone-200 truncate">
              Mühendis Kayıt Sistemi
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] text-stone-400 font-medium">
              Masaüstü v{snap.localVersion}
            </span>
            {!snap.updateAvailable && (
              <button
                type="button"
                onClick={() => void checkForMksUpdatesNow()}
                disabled={snap.isChecking}
                title="Güncellemeleri denetle"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-stone-500 hover:text-stone-300 hover:bg-white/[0.04] transition-colors"
              >
                <RefreshCw size={10} className={snap.isChecking ? 'animate-spin text-emerald-400' : ''} />
                <span>{snap.isChecking ? 'Denetleniyor...' : 'Güncel'}</span>
              </button>
            )}
          </div>

          {/* Right: [Folder + PDF + Print] + [Güncelle] + [Minimize —] + [Maximize □] + [Close ✕] */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center h-full shrink-0"
          >
            {renderPdfAndPrintToolButtons()}
            {renderUpdatePillButton()}

            <button
              type="button"
              onClick={() => void sendDesktopWindowAction('minimize')}
              aria-label="Simge durumuna küçült"
              title="Aşağı indir"
              className="w-11 h-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <Minus size={14} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={() => void sendDesktopWindowAction('toggle-maximize')}
              aria-label={isFullscreen ? 'Pencere boyutuna küçült' : 'Tam ekran yap'}
              title={isFullscreen ? 'Geri yükle' : 'Ekranı kapla'}
              className="w-11 h-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <Square size={11} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={() => void sendDesktopWindowAction('close')}
              aria-label="Kapat"
              title="Uygulamayı kapat"
              className="w-11 h-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-rose-600 transition-colors"
            >
              <X size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </>
    );
  }

  // 3. Native C# Windows Shell or Web Mode:
  return (
    <>
      <PdfQuickAccessModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} />
      {(snap.updateAvailable || snap.isApplying) && (
        <div className="fixed top-2.5 right-3 z-[140] pointer-events-auto">
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onClick={() => void applyMksDesktopUpdate()}
            disabled={snap.isApplying}
            title={targetNotes}
            className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xl border border-emerald-400/40 flex items-center gap-2 transition-colors disabled:opacity-80"
          >
            {snap.isApplying ? (
              <>
                <RefreshCw size={14} className="animate-spin shrink-0" />
                <span>{snap.progressLabel || 'Güncelleniyor...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} className="shrink-0" />
                <span>Yeni Sürüm Hazır (v{targetVersion}) — Güncelle</span>
              </>
            )}
          </motion.button>
        </div>
      )}
    </>
  );
};

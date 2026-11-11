import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import type { BarcodeScanMeta } from './BarcodeScanner';

const BarcodeScannerImpl = lazy(() => import('./BarcodeScanner'));

export type { BarcodeScanMeta };

export interface LazyBarcodeScannerProps {
  /**
   * Called with the decoded text and (optionally) the symbology format name.
   * The scanner keeps callbacks in refs, so inline arrow functions are safe (no camera restarts).
   */
  onScan: (decodedText: string, meta?: BarcodeScanMeta) => void;
  onClose: () => void;
  continuous?: boolean;
  title?: string;
}

export const LazyBarcodeScanner: React.FC<LazyBarcodeScannerProps> = (props) => (
  <Suspense
    fallback={
      <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center text-white">
        <Loader2 size={32} className="animate-spin text-emerald-500 mb-3" />
        <p className="text-xs text-stone-400">Kamera barkod okuyucu yükleniyor...</p>
      </div>
    }
  >
    <BarcodeScannerImpl {...props} />
  </Suspense>
);

export default LazyBarcodeScanner;

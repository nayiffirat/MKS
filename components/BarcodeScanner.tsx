import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Check } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Initialize the scanner
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        // Success callback
        onScan(decodedText);
        
        // Show success indicator
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1000);
      },
      (errorMessage) => {
        // Error callback (optional, can be noisy)
        // console.warn(errorMessage);
      }
    );

    // Cleanup on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner on unmount", err));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-stone-900 w-full max-w-md rounded-3xl border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-stone-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Camera size={18} />
            </div>
            <h3 className="font-bold text-stone-100">Barkod / QR Okut</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-800 text-stone-400 flex items-center justify-center hover:bg-stone-700 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 relative">
          <div id="reader" className="overflow-hidden rounded-2xl border border-white/5 bg-black aspect-square"></div>
          
          {showSuccess && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm rounded-2xl animate-in fade-in duration-200">
              <Check size={64} className="text-emerald-500" />
            </div>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-sm text-stone-400">
              Ürünün barkodunu veya QR kodunu kamera çerçevesine ortalayın.
            </p>
          </div>
        </div>
        
        <div className="p-4 bg-stone-950/50 border-t border-white/5">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-stone-800 text-stone-200 rounded-xl font-bold hover:bg-stone-700 transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;

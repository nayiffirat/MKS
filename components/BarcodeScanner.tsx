import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Check, Loader2, ScanLine } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  continuous?: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, continuous = false }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const startScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode("reader", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.AZTEC,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.MAXICODE,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.RSS_14,
            Html5QrcodeSupportedFormats.RSS_EXPANDED,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
          ],
          verbose: false
        });
        await scannerRef.current.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (isMounted && isScanning) {
              setIsScanning(false);
              setShowSuccess(true);
              onScan(decodedText);
              
              if (!continuous) {
                  // Stop scanner immediately after successful scan
                  if (scannerRef.current && scannerRef.current.isScanning) {
                      scannerRef.current.stop().catch(console.warn);
                  }

                  setTimeout(() => {
                    if (isMounted) onClose();
                  }, 1000);
              } else {
                  // If continuous, just hide success message after a delay and resume scanning
                  setTimeout(() => {
                      if (isMounted) {
                          setShowSuccess(false);
                          setIsScanning(true);
                      }
                  }, 800); // Wait 0.8s before allowing next scan
              }
            }
          },
          (errorMessage) => {
            // Ignore continuous scanning errors
          }
        );
        if (isMounted) setIsInitializing(false);
      } catch (err) {
        console.warn("Scanner initialization failed:", err);
        if (isMounted) {
            setHasError(true);
            setIsInitializing(false);
        }
      }
    };

    // Small delay to ensure DOM element is ready
    const timer = setTimeout(() => {
        startScanner();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(err => console.warn("Failed to stop scanner", err));
      }
    };
  }, [onScan, onClose, isScanning]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-stone-900 w-full max-w-sm rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl relative flex flex-col h-[80vh] max-h-[600px]">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between z-20 bg-gradient-to-b from-black/90 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 backdrop-blur-md border border-emerald-500/30">
              <ScanLine size={20} />
            </div>
            <h3 className="font-bold text-white text-base tracking-wide">Barkod Tarayıcı</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500/80 backdrop-blur-md transition-colors border border-white/10"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Scanner Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {isInitializing && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-stone-950">
              <Loader2 size={40} className="text-emerald-500 animate-spin mb-4" />
              <p className="text-stone-400 text-xs font-bold tracking-widest uppercase">Kamera Başlatılıyor...</p>
            </div>
          )}
          
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6 text-center bg-stone-950">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4 border border-red-500/20">
                <Camera size={40} />
              </div>
              <p className="text-white font-bold text-lg mb-2">Kamera Açılamadı</p>
              <p className="text-stone-400 text-sm leading-relaxed">Lütfen tarayıcı ayarlarından kamera izinlerini kontrol edin veya cihazınızı yeniden başlatın.</p>
              <button onClick={onClose} className="mt-8 px-8 py-3 bg-stone-800 text-white rounded-xl font-bold hover:bg-stone-700 transition-colors">
                Kapat
              </button>
            </div>
          )}

          <div id="reader" className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full"></div>
          
          {/* Scanning Overlay Effect */}
          {!isInitializing && !hasError && !showSuccess && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                {/* Darkened edges */}
                <div className="absolute inset-0 bg-black/40"></div>
                
                {/* Target box (Clear center) */}
                <div className="relative w-64 h-64 border-2 border-emerald-500/50 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>
                    
                    {/* Animated scanning line */}
                    <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_15px_3px_rgba(52,211,153,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                </div>
            </div>
          )}

          {/* Success Overlay */}
          {showSuccess && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-500/90 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl animate-in zoom-in duration-300 delay-100">
                <Check size={48} className="text-emerald-500" />
              </div>
              <p className="text-white font-black text-2xl tracking-wide">Okundu!</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-center z-20 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center gap-4">
          <p className="text-sm text-stone-300 font-medium">
            Barkodu yeşil çerçevenin içine hizalayın
          </p>
          {continuous && (
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-colors shadow-lg w-full max-w-[200px]"
            >
              Taramayı Bitir
            </button>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
            0% { transform: translateY(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(256px); opacity: 0; }
        }
        /* Hide html5-qrcode default UI elements */
        #reader__dashboard_section_csr,
        #reader__dashboard_section_swaplink,
        #reader__header_message {
            display: none !important;
        }
      `}} />
    </div>
  );
};

export default BarcodeScanner;

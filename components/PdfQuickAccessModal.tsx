import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  FolderOpen,
  Printer,
  X,
  RefreshCw,
  ExternalLink,
  Clock,
  HardDrive
} from 'lucide-react';
import {
  listDesktopPdfs,
  openDesktopPdfFolder,
  openDesktopPdf,
  printDesktopPdf,
  printCurrentDesktopPage,
  DesktopPdfFileItem
} from '../utils/desktopUpdateManager';

interface PdfQuickAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PdfQuickAccessModal: React.FC<PdfQuickAccessModalProps> = ({
  isOpen,
  onClose
}) => {
  const [pdfFiles, setPdfFiles] = useState<DesktopPdfFileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const files = await listDesktopPdfs();
      // Tarih sırasına göre (en yeni en üstte)
      setPdfFiles(files);
    } catch {
      setPdfFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadFiles();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -12 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[88vh]"
        >
          {/* Header */}
          <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-rose-600 text-white shadow-md shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-white truncate flex items-center gap-2">
                  <span>İndirilen PDF Belgeleri</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Tarih Sırasıyla
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Fatura, defter, reçete ve rapor çıktıları
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void openDesktopPdfFolder()}
                title="Bilgisayardaki PDF Klasörünü Aç (İndirilenler)"
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 inline-flex items-center gap-1.5 transition-colors border border-slate-600/60"
              >
                <FolderOpen size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Klasör</span>
              </button>

              <button
                type="button"
                onClick={() => void loadFiles()}
                title="Listeyi Yenile"
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-400' : ''} />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="p-1.5 rounded-lg hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white transition-colors"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 min-h-[220px]">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-rose-400" />
                <span className="text-xs font-medium">PDF belgeleri taranıyor...</span>
              </div>
            ) : pdfFiles.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mb-3 border border-slate-700">
                  <FileText size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-200">Henüz indirilmiş PDF bulunamadı</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  İndirdiğiniz tüm faturalar, defterler ve reçeteler otomatik olarak bu listede tarih sırasıyla görünür.
                </p>
                <button
                  type="button"
                  onClick={() => void openDesktopPdfFolder()}
                  className="mt-4 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-2 transition-all border border-slate-700 shadow-sm"
                >
                  <FolderOpen size={14} className="text-amber-400" />
                  <span>İndirilenler Klasörünü Aç</span>
                </button>
              </div>
            ) : (
              pdfFiles.map((file, idx) => (
                <div
                  key={file.path || `${file.name}-${idx}`}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 flex items-center justify-between gap-3 transition-colors shadow-xs"
                >
                  {/* File Info */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      void openDesktopPdf(file.path);
                      onClose();
                    }}
                    title={`${file.name}\n${file.path}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white shrink-0 shadow-xs">
                        PDF
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-white truncate hover:underline hover:text-rose-200">
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 ml-8">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <Clock size={11} className="text-slate-400" />
                        {file.date}
                      </span>
                      <span>•</span>
                      <span>{Math.max(1, Math.round(file.size / 1024))} KB</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        void openDesktopPdf(file.path);
                        onClose();
                      }}
                      title="Belgeyi Aç"
                      className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-xs"
                    >
                      <ExternalLink size={12} />
                      <span>Aç</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void printDesktopPdf(file.path);
                        onClose();
                      }}
                      title="Varsayılan Yazıcıya Gönder"
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold inline-flex items-center gap-1 transition-all shadow-xs"
                    >
                      <Printer size={13} />
                      <span className="hidden sm:inline">Yazdır</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 sm:p-4 bg-slate-800/80 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                void printCurrentDesktopPage();
              }}
              className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <Printer size={15} />
              <span>Ekrandaki Sayfayı / Faturayı Yazdır (Ctrl+P)</span>
            </button>

            <button
              type="button"
              onClick={() => void openDesktopPdfFolder()}
              className="w-full sm:w-auto py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-[0.99] text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all border border-slate-600/70"
            >
              <FolderOpen size={14} className="text-amber-400" />
              <span>Bilgisayardaki PDF Klasörü</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  FolderOpen,
  Printer,
  X,
  RefreshCw,
  ExternalLink,
  Clock,
  Share2,
  Trash2,
  Download,
  Search,
  Camera,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  listArchivedPdfs,
  deleteArchivedPdf,
  clearArchivedPdfs,
  openPdfBlob,
  downloadPdfBlob,
  printPdfBlob,
  hasNativePdfBridge,
  inferPdfCategory,
  PDF_ARCHIVE_EVENT
} from '../utils/pdfArchive';
import { createMultiPagePdf, renderElementToCanvas } from '../utils/pdfHelper';
import { turkishMatchesAny } from '../utils/search';
import {
  listDesktopPdfs,
  openDesktopPdfFolder,
  openDesktopPdf,
  printDesktopPdf,
  printCurrentDesktopPage,
  getDesktopUpdateState,
  DesktopPdfFileItem
} from '../utils/desktopUpdateManager';

type PdfRow = DesktopPdfFileItem & {
  archiveId?: string;
  blob?: Blob;
  category?: string;
};

const formatStamp = (ts: number) =>
  new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
  ' ' +
  new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const formatFileSize = (bytes: number) => {
  if (!bytes || bytes <= 0) return '1 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const parseStamp = (s?: string): number => {
  const m = (s || '').match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime() : 0;
};

interface PdfQuickAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PdfQuickAccessModal: React.FC<PdfQuickAccessModalProps> = ({ isOpen, onClose }) => {
  const [pdfFiles, setPdfFiles] = useState<PdfRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const isMobileApp = Capacitor.isNativePlatform();
  const hasDesktopBridge = !isMobileApp && Boolean(getDesktopUpdateState().bridgePort);

  const canWebShareFiles = useMemo(() => {
    if (hasNativePdfBridge()) return true;
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
    try {
      const dummy = new File([new Uint8Array([37, 80, 68, 70])], 'test.pdf', { type: 'application/pdf' });
      return nav.canShare({ files: [dummy] });
    } catch {
      return false;
    }
  }, []);

  const loadFiles = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [archived, diskFiles] = await Promise.all([
        listArchivedPdfs(),
        hasDesktopBridge ? listDesktopPdfs() : Promise.resolve([] as DesktopPdfFileItem[])
      ]);

      const rows: PdfRow[] = archived.map(a => ({
        name: a.name,
        path: a.name,
        size: a.size,
        date: formatStamp(a.timestamp),
        timestamp: a.timestamp,
        archiveId: a.id,
        blob: a.blob,
        category: a.category || inferPdfCategory(a.name)
      }));

      const seen = new Set(rows.map(r => r.name.toLowerCase()));
      for (const f of diskFiles) {
        if (seen.has(f.name.toLowerCase()) || !/[\\/]/.test(f.path || '')) continue;
        rows.push({
          ...f,
          timestamp: f.timestamp || parseStamp(f.date),
          category: inferPdfCategory(f.name)
        });
      }

      rows.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setPdfFiles(rows);
    } catch {
      setPdfFiles([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setConfirmClearAll(false);
      setCaptureFeedback(null);
      return;
    }
    void loadFiles();
    const onArchived = () => void loadFiles(true);
    window.addEventListener(PDF_ARCHIVE_EVENT, onArchived);
    return () => window.removeEventListener(PDF_ARCHIVE_EVENT, onArchived);
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

  const filteredFiles = useMemo(() => {
    const q = searchTerm.trim();
    if (!q) return pdfFiles;
    return pdfFiles.filter(file => turkishMatchesAny([file.name, file.category || '', file.date], q));
  }, [pdfFiles, searchTerm]);

  const openRow = (file: PdfRow, mode: 'open' | 'share' = 'open') => {
    if (file.blob) {
      void openPdfBlob(file.name, file.blob, mode);
    } else if (hasDesktopBridge) {
      void openDesktopPdf(file.path);
    }
  };

  const downloadRow = (file: PdfRow) => {
    if (file.blob) {
      downloadPdfBlob(file.name, file.blob);
    } else if (hasDesktopBridge) {
      void openDesktopPdf(file.path);
    }
  };

  const printRow = (file: PdfRow) => {
    if (file.blob) {
      printPdfBlob(file.name, file.blob);
    } else if (hasDesktopBridge) {
      void printDesktopPdf(file.path);
      onClose();
    }
  };

  const removeRow = async (file: PdfRow) => {
    if (!file.archiveId) return;
    await deleteArchivedPdf(file.archiveId);
    setPdfFiles(prev => prev.filter(f => f.archiveId !== file.archiveId));
  };

  const handleClearAll = async () => {
    await clearArchivedPdfs();
    setPdfFiles([]);
    setConfirmClearAll(false);
  };

  const captureCurrentScreenToPdf = async () => {
    if (capturing) return;
    setCapturing(true);
    setCaptureFeedback(null);
    try {
      const targetEl = (document.querySelector('main') as HTMLElement | null) || document.body;
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const backgroundColor =
        bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent' ? bodyBg : '#ffffff';

      const canvas = await renderElementToCanvas(targetEl, {
        scale: 2,
        backgroundColor,
        useCORS: true,
        logging: false
      });

      const pdf = await createMultiPagePdf(canvas);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '_');
      const fileName = `MKS_Ekran_${stamp}.pdf`;
      pdf.save(fileName);
      setCaptureFeedback(`${fileName} oluşturuldu ve arşive eklendi.`);
      await loadFiles(true);
    } catch (err) {
      console.warn('Açık ekran PDF oluşturulamadı:', err);
      setCaptureFeedback('Ekran PDF olarak oluşturulamadı.');
    } finally {
      setCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="PDF Belgeleri ve Arşiv"
          initial={{ opacity: 0, scale: 0.96, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -12 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--mks-modal-bg)',
            borderColor: 'var(--mks-card-border)',
            color: 'var(--mks-text)'
          }}
          className="w-full max-w-2xl border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] backdrop-blur-2xl"
        >
          {/* Header (Kurumsal Başlık) */}
          <div
            style={{
              background: 'var(--mks-hero-bg)',
              borderBottom: '1px solid rgba(255,255,255,0.12)'
            }}
            className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white shadow-lg flex items-center justify-center shrink-0 border border-white/20">
                <FileText size={19} />
              </div>
              <div className="min-w-0 v22-keep-white">
                <h3 className="font-extrabold text-sm sm:text-base text-white truncate flex items-center gap-2">
                  <span className="truncate">PDF Belgeleri</span>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white border border-white/20 tabular-nums">
                    {pdfFiles.length} Belge
                  </span>
                </h3>
                <p className="text-[11px] text-white/80 truncate">
                  Oluşturulan fatura, reçete, makbuz, ekstre ve rapor arşivi
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasDesktopBridge && (
                <button
                  type="button"
                  onClick={() => void openDesktopPdfFolder()}
                  title="Bilgisayardaki PDF Klasörünü Aç"
                  className="v22-keep-white px-2.5 py-2 text-xs font-bold rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white inline-flex items-center gap-1.5 transition-colors border border-white/15"
                >
                  <FolderOpen size={14} className="text-amber-300" />
                  <span className="hidden sm:inline">Klasör</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => void loadFiles()}
                title="Listeyi Yenile"
                disabled={loading}
                aria-label="Listeyi yenile"
                className="v22-keep-white w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-colors"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin text-emerald-300' : ''} />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="v22-keep-white w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-colors"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Arama & Toplu Temizleme Barı */}
          {pdfFiles.length > 0 && (
            <div
              style={{ borderColor: 'var(--mks-card-border)' }}
              className="px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0"
            >
              {pdfFiles.length > 2 ? (
                <div className="relative flex-1 min-w-[180px]">
                  <Search
                    size={14}
                    style={{ color: 'var(--mks-muted)' }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Belge adı, tarih veya tür ara..."
                    style={{
                      background: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              ) : (
                <span style={{ color: 'var(--mks-muted)' }} className="text-[11px] font-semibold">
                  En yeni oluşturulan belgeler en üstte sıralanır
                </span>
              )}

              {pdfFiles.some(f => Boolean(f.archiveId)) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {confirmClearAll ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleClearAll()}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-colors"
                      >
                        Tümünü Sil
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAll(false)}
                        style={{
                          background: 'var(--mks-subcard)',
                          color: 'var(--mks-text)'
                        }}
                        className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors"
                      >
                        Vazgeç
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(true)}
                      style={{
                        background: 'var(--mks-subcard)',
                        color: 'var(--mks-muted)'
                      }}
                      className="px-2.5 py-1.5 rounded-xl hover:text-rose-500 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={12} />
                      <span>Listeyi Temizle</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bilgilendirme (Ekran PDF alındığında) */}
          {captureFeedback && (
            <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2 shrink-0">
              <CheckCircle2 size={14} className="shrink-0" />
              <span className="truncate">{captureFeedback}</span>
            </div>
          )}

          {/* Liste İçeriği */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 min-h-[220px]">
            {loading ? (
              <div
                style={{ color: 'var(--mks-muted)' }}
                className="py-16 flex flex-col items-center justify-center gap-2"
              >
                <RefreshCw size={24} className="animate-spin text-rose-500" />
                <span className="text-xs font-medium">PDF belgeleri yükleniyor...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <div
                  style={{
                    background: 'var(--mks-subcard)',
                    borderColor: 'var(--mks-card-border)',
                    color: 'var(--mks-muted)'
                  }}
                  className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 border shadow-sm"
                >
                  <FileText size={26} />
                </div>
                <p className="text-sm font-bold">
                  {pdfFiles.length === 0 ? 'Henüz arşivlenmiş PDF belgesi yok' : 'Aramanızla eşleşen PDF bulunamadı'}
                </p>
                <p
                  style={{ color: 'var(--mks-muted)' }}
                  className="text-xs mt-1.5 max-w-md mx-auto leading-relaxed"
                >
                  {pdfFiles.length === 0
                    ? 'Satış faturası, tahsilat makbuzu, cari ekstre, mutabakat veya depo raporu oluşturduğunuz her PDF otomatik olarak burada saklanır. Dilerseniz aşağıdaki butonla açık ekranın PDF kopyasını da hemen alabilirsiniz.'
                    : 'Farklı bir dosya adı, tür veya tarih yazarak yeniden arayabilirsiniz.'}
                </p>
                {pdfFiles.length === 0 && (
                  <button
                    type="button"
                    disabled={capturing}
                    onClick={() => void captureCurrentScreenToPdf()}
                    className="mt-4 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-md disabled:opacity-60"
                  >
                    {capturing ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                    <span>{capturing ? 'PDF Oluşturuluyor...' : 'Açık Ekranı Şimdi PDF Yap & İndir'}</span>
                  </button>
                )}
              </div>
            ) : (
              filteredFiles.map((file, idx) => (
                <div
                  key={file.archiveId || file.path || `${file.name}-${idx}`}
                  style={{
                    background: 'var(--mks-subcard)',
                    borderColor: 'var(--mks-card-border)'
                  }}
                  className="p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors shadow-xs"
                >
                  {/* Dosya Bilgisi */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => openRow(file)}
                    title={file.name}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white shrink-0 shadow-xs">
                        PDF
                      </span>
                      {file.category && (
                        <span
                          style={{
                            background: 'var(--mks-accent-soft)',
                            color: 'var(--mks-accent-soft-text)'
                          }}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0"
                        >
                          {file.category}
                        </span>
                      )}
                      <span className="text-xs sm:text-sm font-bold truncate max-w-full">{file.name}</span>
                    </div>
                    <div
                      style={{ color: 'var(--mks-muted)' }}
                      className="flex items-center gap-2 text-[11px] mt-1 font-medium"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        {file.date}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </div>

                  {/* Aksiyonlar */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => openRow(file, 'open')}
                      title="Belgeyi Aç"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold inline-flex items-center gap-1 transition-all shadow-xs"
                    >
                      <ExternalLink size={12} />
                      <span>Aç</span>
                    </button>

                    {file.blob && (
                      <button
                        type="button"
                        onClick={() => downloadRow(file)}
                        title="Cihaza İndir"
                        className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold inline-flex items-center gap-1 transition-all shadow-xs"
                      >
                        <Download size={12} />
                        <span>İndir</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => printRow(file)}
                      title="Yazdır"
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xs font-bold inline-flex items-center gap-1 transition-all shadow-xs"
                    >
                      <Printer size={12} />
                      <span className="hidden sm:inline">Yazdır</span>
                    </button>

                    {file.blob && canWebShareFiles && (
                      <button
                        type="button"
                        onClick={() => openRow(file, 'share')}
                        title="Paylaş / Gönder"
                        aria-label="Paylaş"
                        className="min-h-[36px] w-9 rounded-xl bg-teal-600 hover:bg-teal-500 active:scale-95 text-white inline-flex items-center justify-center transition-all shadow-xs"
                      >
                        <Share2 size={13} />
                      </button>
                    )}

                    {file.archiveId && (
                      <button
                        type="button"
                        onClick={() => void removeRow(file)}
                        title="Listeden kaldır"
                        aria-label="Listeden kaldır"
                        style={{
                          background: 'var(--mks-card)',
                          color: 'var(--mks-muted)',
                          borderColor: 'var(--mks-card-border)'
                        }}
                        className="min-h-[36px] w-9 rounded-xl border hover:bg-rose-600 hover:text-white hover:border-rose-600 active:scale-95 inline-flex items-center justify-center transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Alt İşlem Çubuğu */}
          <div
            style={{
              background: 'var(--mks-subcard)',
              borderColor: 'var(--mks-card-border)'
            }}
            className="p-3 sm:p-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0"
          >
            <button
              type="button"
              disabled={capturing}
              onClick={() => void captureCurrentScreenToPdf()}
              className="flex-1 min-h-[42px] py-2 px-3 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-60"
            >
              {capturing ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              <span>{capturing ? 'Ekran PDF Hazırlanıyor...' : 'Açık Ekranı PDF Yap & Arşivle'}</span>
            </button>

            {!isMobileApp && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  void printCurrentDesktopPage();
                }}
                className="flex-1 min-h-[42px] py-2 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Printer size={15} />
                <span>Ekrandaki Sayfayı Yazdır (Ctrl+P)</span>
              </button>
            )}

            {hasDesktopBridge && (
              <button
                type="button"
                onClick={() => void openDesktopPdfFolder()}
                className="min-h-[42px] py-2 px-3 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-[0.99] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all"
              >
                <FolderOpen size={14} className="text-amber-300" />
                <span>Klasörü Aç</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

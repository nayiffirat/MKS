import type { jsPDF as JsPDFInstance } from 'jspdf';
import type { Options as Html2CanvasOptions } from 'html2canvas';
import { recordDownloadedPdf } from './desktopUpdateManager';

function patchJsPdfSave(cls: any) {
  if (!cls || (cls.prototype as any)._mksSaveIntercepted) return;
  (cls.prototype as any)._mksSaveIntercepted = true;
  const originalSave = cls.prototype.save;
  cls.prototype.save = function (this: any, filename: string, ...args: any[]) {
    try {
      const name = filename || `MKS_Belge_${new Date().toISOString().slice(0, 10)}.pdf`;
      recordDownloadedPdf(name);
    } catch {}
    return originalSave.call(this, filename, ...args);
  };
}

/**
 * Dinamik olarak jspdf kütüphanesini yalnızca ihtiyaç duyulduğunda yükler (~590 KB tasarruf).
 */
export async function loadJsPdf() {
  const mod = await import('jspdf');
  patchJsPdfSave(mod.jsPDF);
  return mod.jsPDF;
}

/**
 * Dinamik olarak jspdf ve jspdf-autotable kütüphanelerini yükler.
 */
export async function loadJsPdfWithAutoTable() {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  patchJsPdfSave(jsPDF);
  return { jsPDF, autoTable: autoTableMod.default };
}

/**
 * HTML elemanını dinamik yüklenen html2canvas ile yüksek çözünürlüklü tuvale dönüştürür.
 */
export async function renderElementToCanvas(
  element: HTMLElement,
  options?: Partial<Html2CanvasOptions>
): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2;
  const crispScale = Math.max(options?.scale ?? 0, Math.min(dpr, 3), 2.5);
  return html2canvas(element, {
    useCORS: true,
    logging: false,
    ...options,
    scale: crispScale
  } as Html2CanvasOptions);
}

/**
 * HTMLCanvasElement içeriğini A4 oranında çok sayfalı PDF belgesine dönüştürür.
 */
export async function createMultiPagePdf(canvas: HTMLCanvasElement): Promise<JsPDFInstance> {
  const jsPDF = await loadJsPdf();
  const imgData = canvas.toDataURL('image/jpeg', 0.98);

  const pdfWidth = canvas.width;
  const pageHeight = (canvas.width * 297) / 210;
  const canvasHeight = canvas.height;

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'px',
    format: [pdfWidth, pageHeight]
  });

  let heightLeft = canvasHeight;
  let position = 0;

  pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, canvasHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, canvasHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

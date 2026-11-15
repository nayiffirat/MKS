import type { jsPDF as JsPDFInstance } from 'jspdf';
import type { Options as Html2CanvasOptions } from 'html2canvas';
import { archivePdf, hasNativePdfBridge, openPdfBlob } from './pdfArchive';
import { getLocalDateString } from './dateUtils';

/**
 * jsPDF v2.5.x `save` metodunu prototype yerine doğrudan her örnek (`this.save`) üzerine tanımlar.
 * Bu nedenle yalnızca prototype yaması yeterli değildir; hem `API.events['initialized']` kancasıyla
 * hem de yapıcı (`Proxy`) ve örnek yamasıyla her `.save()` çağrısını garanti altına alırız.
 */
export function patchJsPdfInstance<T extends Record<string, any>>(instance: T): T {
  if (!instance || (instance as any)._mksInstanceSavePatched) return instance;
  (instance as any)._mksInstanceSavePatched = true;

  const originalSave = typeof instance.save === 'function' ? instance.save.bind(instance) : null;

  (instance as any).save = function (filename?: string, ...args: any[]) {
    const rawName = (filename || `MKS_Belge_${getLocalDateString()}.pdf`).trim();
    const name = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

    try {
      let blob: Blob | null = null;
      if (typeof instance.output === 'function') {
        const out = instance.output('blob');
        if (out instanceof Blob) {
          blob = out;
        } else {
          const ab = instance.output('arraybuffer');
          if (ab) blob = new Blob([ab], { type: 'application/pdf' });
        }
      }

      if (blob && blob.size > 0) {
        const archiveName = name.split(/[\\/]/).pop() || name;
        void archivePdf(archiveName, blob);
        // Android WebView blob indirmeyi desteklemez: PDF'i yerel görüntüleyicide aç
        if (hasNativePdfBridge()) {
          void openPdfBlob(archiveName, blob, 'open');
          return instance;
        }
      }
    } catch (e) {
      console.warn('PDF archive intercept error:', e);
    }

    return originalSave ? originalSave(name, ...args) : instance;
  };

  return instance;
}

function patchJsPdfSave(cls: any) {
  if (!cls) return;
  if (!cls._mksEventsPatched) {
    cls._mksEventsPatched = true;
    try {
      cls.API?.events?.push([
        'initialized',
        function (this: any) {
          patchJsPdfInstance(this);
        }
      ]);
    } catch {}
  }

  // Olası özel/alt sınıflar için prototype yedek yaması
  if (cls.prototype && !cls.prototype._mksSaveIntercepted) {
    cls.prototype._mksSaveIntercepted = true;
    const protoSave = cls.prototype.save;
    if (typeof protoSave === 'function') {
      cls.prototype.save = function (this: any, filename: string, ...args: any[]) {
        patchJsPdfInstance(this);
        return this.save(filename, ...args);
      };
    }
  }
}

function wrapJsPdfConstructor<T>(cls: T): T {
  patchJsPdfSave(cls);
  const anyCls = cls as any;
  if (!anyCls || typeof anyCls !== 'function') return cls;
  if (anyCls._mksWrappedProxy) return anyCls._mksWrappedProxy as T;

  const proxied = new Proxy(anyCls, {
    construct(target, args, newTarget) {
      const inst = Reflect.construct(target, args, newTarget);
      return patchJsPdfInstance(inst);
    }
  });
  anyCls._mksWrappedProxy = proxied;
  return proxied as T;
}

/**
 * Dinamik olarak jspdf kütüphanesini yalnızca ihtiyaç duyulduğunda yükler (~590 KB tasarruf).
 */
export async function loadJsPdf() {
  const mod = await import('jspdf');
  return wrapJsPdfConstructor(mod.jsPDF);
}

/**
 * Dinamik olarak jspdf ve jspdf-autotable kütüphanelerini yükler.
 */
export async function loadJsPdfWithAutoTable() {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  const WrappedJsPdf = wrapJsPdfConstructor(jsPDF);
  return { jsPDF: WrappedJsPdf, autoTable: autoTableMod.default };
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

  return patchJsPdfInstance(pdf as unknown as Record<string, any>) as unknown as JsPDFInstance;
}

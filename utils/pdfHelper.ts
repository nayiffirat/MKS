import { jsPDF } from 'jspdf';

export function createMultiPagePdf(canvas: HTMLCanvasElement): jsPDF {
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    const pdfWidth = canvas.width;
    // Calculate A4 aspect ratio height for the given width
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

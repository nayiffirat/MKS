import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Printer, FileText, Download, Users, Package, Receipt, Loader2, ChevronRight, Calendar, X, Store } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from '../utils/currency';
import html2canvas from 'html2canvas';

export const Reports: React.FC = () => {
  const { 
    farmers, 
    inventory, 
    expenses, 
    prescriptions, 
    payments, 
    manualDebts, 
    myPayments,
    accounts, 
    userProfile,
    farmerLabel,
    farmerPluralLabel,
    prescriptionLabel,
    suppliers,
    supplierPurchases
  } = useAppViewModel();
  const [generating, setGenerating] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Helper to replace Turkish chars for standard PDF fonts if needed
  const trToEn = (text: string) => {
    return text
      .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
      .replace(/Ü/g, 'U').replace(/ü/g, 'u')
      .replace(/Ş/g, 'S').replace(/ş/g, 's')
      .replace(/İ/g, 'I').replace(/ı/g, 'i')
      .replace(/Ö/g, 'O').replace(/ö/g, 'o')
      .replace(/Ç/g, 'C').replace(/ç/g, 'c');
  };

  const isWithinRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const start = new Date(startDate);
    const end = new Date(endDate);
    // Set hours to 0 for accurate comparison
    date.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };

  // Helper for safe number rendering on standard jsPDF fonts (no currency symbol)
  const pdfCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const generateTableHtml = (title: string, headers: string[], rows: any[][], footers?: any[][], headerColor = '#1f2937') => {
      let html = `<div style="margin-bottom: 32px; page-break-inside: avoid;">`;
      if (title) {
          html += `<h3 style="font-size: 16px; font-weight: 700; margin: 0 0 12px 0; color: #1c1917; border-bottom: 2px solid #e7e5e4; padding-bottom: 8px;">${title}</h3>`;
      }
      
      html += `<table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left; margin-bottom: 8px;">
                  <thead>
                      <tr style="background-color: ${headerColor}; color: white;">`;
      
      headers.forEach((h, i) => {
          const isRight = h.toLowerCase().includes('bakiye') || h.toLowerCase().includes('tutar') || h.toLowerCase().includes('maliyet') || h.toLowerCase().includes('fiyat');
          html += `<th style="padding: 10px; border-bottom: 2px solid ${headerColor}; ${i === 0 ? 'border-top-left-radius: 6px;' : ''} ${i === headers.length - 1 ? 'border-top-right-radius: 6px;' : ''} ${isRight ? 'text-align: right;' : ''}">${h}</th>`;
      });
      
      html += `    </tr>
                  </thead>
                  <tbody>`;

      if (rows.length === 0) {
          html += `<tr><td colspan="${headers.length}" style="padding: 20px; text-align: center; color: #78716c; background-color: #fafaf9; border-bottom: 1px solid #e7e5e4;">Veri bulunamadı.</td></tr>`;
      } else {
          rows.forEach((row, i) => {
              const bg = i % 2 === 0 ? '#fafaf9' : '#ffffff';
              html += `<tr style="background-color: ${bg}; border-bottom: 1px solid #e7e5e4;">`;
              row.forEach((cell, j) => {
                  const isRight = headers[j].toLowerCase().includes('bakiye') || headers[j].toLowerCase().includes('tutar') || headers[j].toLowerCase().includes('maliyet') || headers[j].toLowerCase().includes('fiyat');
                  const isBold = typeof cell === 'string' && (cell.includes('BORÇ') || cell.includes('ALACAK') || cell.includes('ALACAKLI') || cell.includes('BORÇLU'));
                  const color = cell === 'ALACAKLI HESAP' || cell === 'ALACAKLIYIZ' ? '#059669' : (cell === 'BORÇLU HESAP (BİZE)' || cell === 'BORÇLUYUZ (TEDARİKÇİYE)' ? '#dc2626' : '#3f3f46');
                  html += `<td style="padding: 10px; color: ${color}; ${isRight ? 'text-align: right; font-family: monospace; font-weight: 600;' : ''} ${isBold ? 'font-weight: 700;' : ''}">${cell}</td>`;
              });
              html += `</tr>`;
          });
      }

      html += `</tbody>`;

      if (footers && footers.length > 0) {
          html += `<tfoot style="background-color: #f3f4f6; font-weight: bold;">`;
          footers.forEach(row => {
              html += `<tr>`;
              row.forEach((cell, j) => {
                  const isRight = j > 0;
                  html += `<td style="padding: 10px; border-top: 2px solid #e5e7eb; color: #1f2937; ${isRight ? 'text-align: right; font-family: monospace;' : ''}">${cell}</td>`;
              });
              html += `</tr>`;
          });
          html += `</tfoot>`;
      }

      html += `</table></div>`;
      return html;
  };

  const generatePdfFromHtml = async (title: string, subtitle: string, htmlContent: string, fileName: string) => {
      try {
          const container = document.createElement('div');
          container.style.position = 'absolute';
          container.style.left = '-9999px';
          container.style.top = '0';
          container.style.width = '800px';
          container.style.backgroundColor = '#ffffff';
          container.style.padding = '40px';
          container.style.color = '#1c1917';
          container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

          let baseHtml = `
              <div style="margin-bottom: 30px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                      <div>
                          <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 8px 0; color: #10b981; text-transform: uppercase;">
                              ${userProfile?.companyName || "MKS SİSTEMİ"}
                          </h1>
                          <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 4px 0; color: #1c1917;">${title}</h2>
                          ${subtitle ? `<p style="margin: 0; font-size: 13px; color: #57534e;">${subtitle}</p>` : ''}
                      </div>
                      <div style="text-align: right; color: #78716c; font-size: 11px;">
                          <p style="margin: 0 0 4px 0;"><strong>Tarih:</strong> ${format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
                          <p style="margin: 0;"><strong>Oluşturan:</strong> ${userProfile?.fullName || 'Sistem'}</p>
                      </div>
                  </div>
              </div>
              ${htmlContent}
          `;

          container.innerHTML = baseHtml;
          document.body.appendChild(container);

          const canvas = await html2canvas(container, {
              scale: 2,
              backgroundColor: '#ffffff',
              logging: false
          });

          document.body.removeChild(container);
          
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          const doc = new jsPDF({
              orientation: canvas.width > canvas.height ? 'l' : 'p',
              unit: 'px',
              format: [canvas.width, canvas.height]
          });
          
          doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
          doc.save(fileName);
      } catch(e) {
          console.error("PDF Oluşturma Hatası", e);
      }
  };

  const addCorporateHeader = (doc: any, title: string) => {
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(trToEn(userProfile?.companyName || "MKS SISTEMI"), 14, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(trToEn(title), 14, 30);
    doc.text(trToEn(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`), 196, 22, { align: 'right' });
    doc.text(trToEn(`Sorumlu: ${userProfile?.fullName || 'Ziraat Muhendisi'}`), 196, 30, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const generateBayiRaporuPDF = () => {
    setGenerating('BAYI_RAPORU');
    setTimeout(() => {
        let htmlContent = '';

        // 1. Kasa ve Banka
        const accountData = accounts.map(acc => [
            acc.name,
            acc.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabı',
            formatCurrency(acc.balance, userProfile?.currency || 'TRY')
        ]);
        const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
        htmlContent += generateTableHtml('1. KASA VE BANKA DURUMU', ['Hesap Adı', 'Tür', 'Bakiye'], accountData, [['', 'TOPLAM VARLIK', formatCurrency(totalBalance, userProfile?.currency || 'TRY')]], '#10b981'); // Emerald

        // 2. Çiftçi
        let totalReceivable = 0;
        let totalPayableToFarmers = 0;
        const farmerData = farmers.map(farmer => {
            const totalPaid = payments.filter(p => p.farmerId === farmer.id && !p.deletedAt).reduce((acc, p) => acc + p.amount, 0) + 
                              myPayments.filter(p => p.farmerId === farmer.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId).reduce((acc, p) => acc + p.amount, 0);
            const totalDebt = prescriptions.filter(p => p.farmerId === farmer.id && !p.deletedAt && p.priceType !== 'CASH').reduce((acc, p) => {
                const amt = Number(p.totalAmount) || 0;
                const isReturn = p.type === 'RETURN' || amt < 0;
                return acc + (isReturn ? -Math.abs(amt) : Math.abs(amt));
            }, 0) + 
                              manualDebts.filter(d => d.farmerId === farmer.id && !d.deletedAt && !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0);
            const balance = totalPaid - totalDebt;
            return { name: farmer.fullName, phone: farmer.phoneNumber, balance };
        }).filter(f => f.balance !== 0);

        const formattedFarmerData = farmerData.map(f => {
            if (f.balance < 0) totalReceivable += Math.abs(f.balance);
            if (f.balance > 0) totalPayableToFarmers += Math.abs(f.balance);
            return [
                f.name,
                f.phone || '-',
                formatCurrency(Math.abs(f.balance), userProfile?.currency || 'TRY'),
                f.balance >= 0 ? 'ALACAKLI HESAP' : 'BORÇLU HESAP (BİZE)'
            ];
        });
        htmlContent += generateTableHtml(`2. ${farmerPluralLabel.toLocaleUpperCase('tr-TR')} BAKİYE DURUMU (Tüm Zamanlar Kümülatif)`, ['Müşteri Adı', 'Telefon', 'Bakiye', 'Durum'], formattedFarmerData, [
            ['', 'TOPLAM MÜŞTERİ ALACAĞIMIZ', formatCurrency(totalReceivable, userProfile?.currency || 'TRY'), ''],
            ['', 'TOPLAM MÜŞTERİ BORCUMUZ', formatCurrency(totalPayableToFarmers, userProfile?.currency || 'TRY'), '']
        ], '#3b82f6'); // Blue

        // 3. Tedarikçi
        let totalSupplierDebt = 0;
        let totalSupplierReceivable = 0;
        const supplierData = suppliers.filter(s => s.balance !== 0).map(supplier => {
            if (supplier.balance < 0) totalSupplierDebt += Math.abs(supplier.balance);
            if (supplier.balance > 0) totalSupplierReceivable += supplier.balance;
            return [
                supplier.name,
                supplier.phoneNumber || '-',
                formatCurrency(Math.abs(supplier.balance), userProfile?.currency || 'TRY'),
                supplier.balance < 0 ? 'BORÇLUYUZ (TEDARİKÇİYE)' : 'ALACAKLIYIZ'
            ];
        });
        htmlContent += generateTableHtml('3. TEDARİKÇİ BAKİYE DURUMU (Tüm Zamanlar Kümülatif)', ['Tedarikçi Adı', 'Telefon', 'Bakiye', 'Durum'], supplierData, [
            ['', 'TOPLAM TEDARİKÇİ BORCUMUZ', formatCurrency(totalSupplierDebt, userProfile?.currency || 'TRY'), '']
        ], '#f59e0b'); // Amber

        // 4. Stok Durumu
        let totalInventoryBuyingValue = 0;
        const inventoryData = inventory.filter(i => i.quantity > 0).map(item => {
            const buyingValue = item.quantity * item.buyingPrice;
            totalInventoryBuyingValue += buyingValue;
            return [
                item.pesticideName,
                item.category,
                `${item.quantity} ${item.unit}`,
                formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY'),
                formatCurrency(buyingValue, userProfile?.currency || 'TRY')
            ];
        });
        htmlContent += generateTableHtml('4. DEPO / STOK DURUMU', ['Ürün Adı', 'Kategori', 'Miktar', 'Birim Maliyet', 'Toplam Maliyet'], inventoryData, [
            ['', '', 'DEPO TOPLAM MALİYETİ', '', formatCurrency(totalInventoryBuyingValue, userProfile?.currency || 'TRY')]
        ], '#8b5cf6'); // Violet

        // 5. Finansal Özet
        const filteredPayments = [...payments, ...myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED')];
        const totalIncome = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
        const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
        const netProfit = totalIncome - totalExpense;

        const financialData = [
            ['Toplam Tahsilatlar (Giren Nakit)', formatCurrency(totalIncome, userProfile?.currency || 'TRY')],
            ['Toplam Giderler ve Ödemeler (Çıkan Nakit)', formatCurrency(totalExpense, userProfile?.currency || 'TRY')],
            ['Tüm Zamanlar NET NAKİT FARKI', formatCurrency(netProfit, userProfile?.currency || 'TRY')]
        ];
        htmlContent += generateTableHtml('5. GENEL GELİR / GİDER (Tüm Zamanlar Kümülatif)', ['Kalem', 'Tutar'], financialData, [], '#e11d48'); // Rose

        generatePdfFromHtml('GENEL BAYİ RAPORU', 'İşletmenizin (kasa, müşteri, tedarikçi, depo vs.) tüm genel durumu.', htmlContent, `Bayi_Genel_Raporu_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`).then(() => {
            setGenerating(null);
        });
    }, 500);
  };

  const generateDetailedBayiRaporuPDF = () => {
    setGenerating('DETAILED_BAYI_RAPORU');
    setTimeout(() => {
        let htmlContent = '';

        // 1. Kasa ve Banka
        const accountData = accounts.map(acc => [
            acc.name,
            acc.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabı',
            formatCurrency(acc.balance, userProfile?.currency || 'TRY')
        ]);
        const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
        htmlContent += generateTableHtml('1. HESAPLAR / KASA & BANKA', ['Hesap Adı', 'Tür', 'Bakiye'], accountData, [['', 'TOPLAM VARLIK', formatCurrency(totalBalance, userProfile?.currency || 'TRY')]], '#10b981'); // Emerald

        // 2. Müşteriler (Çiftçiler)
        htmlContent += `<h3 style="font-size: 16px; font-weight: 700; margin: 32px 0 12px 0; color: #1c1917; border-bottom: 2px solid #e7e5e4; padding-bottom: 8px;">2. ${farmerPluralLabel.toLocaleUpperCase('tr-TR')} DETAYLI HESAP DÖKÜMÜ</h3>`;
        
        farmers.forEach((farmer, index) => {
            const ledger: any[] = [];
            
            prescriptions.filter(p => !p.deletedAt && p.farmerId === farmer.id).forEach(p => {
                const isDebt = p.type !== 'RETURN';
                ledger.push({
                    date: new Date(p.date || Date.now()),
                    type: isDebt ? 'Satış Faturası' : 'İade Faturası',
                    docNo: p.prescriptionNo || '-',
                    amount: p.totalAmount || 0,
                    isDebt: isDebt
                });
            });

            payments.filter(p => !p.deletedAt && p.farmerId === farmer.id).forEach(p => {
                ledger.push({
                    date: new Date(p.date),
                    type: 'Tahsilat (Bize Ödenen)',
                    docNo: '-',
                    amount: p.amount,
                    isDebt: false
                });
            });

            myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED' && p.farmerId === farmer.id).forEach(p => {
                ledger.push({
                    date: new Date(p.issueDate),
                    type: 'Müşteri Ödemesi (Bizden Çıkan)',
                    docNo: '-',
                    amount: p.amount,
                    isDebt: true
                });
            });

            manualDebts.filter(d => d.farmerId === farmer.id && !d.id.startsWith('turnover-')).forEach(d => {
                ledger.push({
                    date: new Date(d.date),
                    type: 'Bakiye Eklentisi (Borç)',
                    docNo: '-',
                    amount: d.amount,
                    isDebt: true
                });
            });

            manualDebts.filter(d => d.farmerId === farmer.id && d.id.startsWith('turnover-')).forEach(d => {
                ledger.push({
                    date: new Date(d.date),
                    type: 'Devir Bakiye',
                    docNo: '-',
                    amount: d.amount,
                    isDebt: true
                });
            });

            ledger.sort((a, b) => a.date.getTime() - b.date.getTime());

            let currentBalance = 0;
            const body = ledger.map(l => {
                if (l.isDebt) currentBalance -= l.amount;
                else currentBalance += l.amount;
                
                return [
                    format(l.date, 'dd.MM.yyyy'),
                    l.type,
                    l.docNo,
                    l.isDebt ? formatCurrency(l.amount, userProfile?.currency || 'TRY') : '', 
                    !l.isDebt ? formatCurrency(l.amount, userProfile?.currency || 'TRY') : '',
                    formatCurrency(Math.abs(currentBalance), userProfile?.currency || 'TRY') + (currentBalance < 0 ? ' (Bize Borçlu)' : ' (Bizden Alacaklı)')
                ];
            });

            htmlContent += generateTableHtml(`${index + 1}. Müşteri: ${farmer.fullName} ${farmer.phoneNumber ? `| Tel: ${farmer.phoneNumber}` : ''}`, ['Tarih', 'İşlem Türü', 'Belge No', 'Bize Borçlandı', 'Bize Ödedi', 'Bakiye Durumu'], body, [], '#3b82f6');
        });

        // 3. Tedarikçiler
        htmlContent += `<h3 style="font-size: 16px; font-weight: 700; margin: 32px 0 12px 0; color: #1c1917; border-bottom: 2px solid #e7e5e4; padding-bottom: 8px;">3. TEDARİKÇİ DETAYLI HESAP DÖKÜMÜ</h3>`;

        suppliers.forEach((supplier, index) => {
            const ledger: any[] = [];
            
            supplierPurchases.filter(p => !p.deletedAt && p.supplierId === supplier.id).forEach(p => {
                ledger.push({
                    date: new Date(p.date),
                    type: p.type === 'RETURN' ? 'Alış İade' : 'Alış Faturası',
                    docNo: p.receiptNo || '-',
                    amount: p.totalAmount || p.items.reduce((acc, i) => acc + (i.quantity * (i.buyingPrice || 0)), 0) || 0,
                    isDebtToUs: p.type !== 'RETURN'
                });
            });

            myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED' && p.supplierId === supplier.id).forEach(p => {
                ledger.push({
                    date: new Date(p.issueDate),
                    type: 'Tedarikçiye Ödeme',
                    docNo: '-',
                    amount: p.amount,
                    isDebtToUs: false
                });
            });

            ledger.sort((a, b) => a.date.getTime() - b.date.getTime());

            let currentBalance = 0;
            const body = ledger.map(l => {
                if (l.isDebtToUs) currentBalance -= l.amount;
                else currentBalance += l.amount;
                
                return [
                    format(l.date, 'dd.MM.yyyy'),
                    l.type,
                    l.docNo,
                    l.isDebtToUs ? formatCurrency(l.amount, userProfile?.currency || 'TRY') : '', 
                    !l.isDebtToUs ? formatCurrency(l.amount, userProfile?.currency || 'TRY') : '', 
                    formatCurrency(Math.abs(currentBalance), userProfile?.currency || 'TRY') + (currentBalance < 0 ? ' (Bize Borçlu)' : ' (Bize Alacaklı)')
                ];
            });

            htmlContent += generateTableHtml(`${index + 1}. Tedarikçi: ${supplier.name} ${supplier.phoneNumber ? `| Tel: ${supplier.phoneNumber}` : ''}`, ['Tarih', 'İşlem Türü', 'Belge No', 'Borçlandık', 'Ödedik', 'Bakiye Durumu'], body, [], '#f59e0b');
        });

        // 4. Stok durumu
        let totalInventoryBuyingValue = 0;
        const inventoryData = inventory.map(item => {
            const buyingValue = item.quantity * item.buyingPrice;
            totalInventoryBuyingValue += buyingValue;
            return [
                item.pesticideName,
                item.category,
                `${item.quantity} ${item.unit}`,
                formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY'),
                formatCurrency(buyingValue, userProfile?.currency || 'TRY')
            ];
        });
        htmlContent += generateTableHtml('4. TÜM DEPO / STOK DURUMU', ['Ürün Adı', 'Kategori', 'Miktar', 'Alış Birim Maliyet', 'Alış Toplam Maliyet'], inventoryData, [
            ['', '', 'TOPLAM DEPO MALİYETİ', '', formatCurrency(totalInventoryBuyingValue, userProfile?.currency || 'TRY')]
        ], '#8b5cf6'); // Violet

        // 5. Giderler
        let totalExpenseAmount = 0;
        const expenseData = [...expenses].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(e => {
            totalExpenseAmount += e.amount;
            return [
                format(new Date(e.date), 'dd.MM.yyyy'),
                e.category,
                e.note || '-',
                formatCurrency(e.amount, userProfile?.currency || 'TRY')
            ];
        });
        htmlContent += generateTableHtml('5. TÜM GİDERLER DÖKÜMÜ', ['Tarih', 'Gider Kategorisi', 'Açıklama', 'Tutar'], expenseData, [
            ['', '', 'TOPLAM GİDER', formatCurrency(totalExpenseAmount, userProfile?.currency || 'TRY')]
        ], '#e11d48'); // Rose

        generatePdfFromHtml('DETAYLI TÜM VERİ DÖKÜMÜ', 'Tüm dükkan verisinin detaylı hesap hareketi.', htmlContent, `Ayrintili_Rapor_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`).then(() => {
            setGenerating(null);
        });
    }, 500);
  };

  const generateFarmerBalancesPDF = () => {
    setGenerating('FARMER_BALANCES');
    setTimeout(() => {
        const tableData = farmers.map(farmer => {
            const fPayments = payments.filter(p => p.farmerId === farmer.id && !p.deletedAt && isWithinRange(p.date));
            const fMyPayments = myPayments.filter(p => p.farmerId === farmer.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId && isWithinRange(p.issueDate));
            const fPrescriptions = prescriptions.filter(p => p.farmerId === farmer.id && !p.deletedAt && isWithinRange(p.date));
            const fManualDebts = manualDebts.filter(d => d.farmerId === farmer.id && !d.deletedAt && isWithinRange(d.date));
            
            const totalPaid = fPayments.reduce((acc, p) => acc + p.amount, 0) + fMyPayments.reduce((acc, p) => acc + p.amount, 0);
            const totalDebt = fPrescriptions.filter(p => p.priceType !== 'CASH').reduce((acc, p) => {
                const amt = Number(p.totalAmount) || 0;
                const isReturn = p.type === 'RETURN' || amt < 0;
                return acc + (isReturn ? -Math.abs(amt) : Math.abs(amt));
            }, 0) + fManualDebts.filter(d => !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0);
            
            const balance = totalPaid - totalDebt;
            const status = balance >= 0 ? 'ALACAK' : 'BORÇ';

            return [
                farmer.fullName,
                farmer.village || '-',
                farmer.phoneNumber || '-',
                formatCurrency(Math.abs(balance), userProfile?.currency || 'TRY'),
                status
            ];
        });

        const htmlContent = generateTableHtml('ÇİFTÇİ BAKİYE ÖZETİ', ['Çiftçi Adı', 'Köy', 'Telefon', 'Bakiye', 'Durum'], tableData, [], '#10b981'); // Emerald
        generatePdfFromHtml(
            `${farmerPluralLabel.toLocaleUpperCase('tr-TR')} BAKİYE RAPORU`,
            `Dönem: ${format(new Date(startDate), 'dd.MM.yyyy')} - ${format(new Date(endDate), 'dd.MM.yyyy')}`,
            htmlContent, 
            `Ciftci_Bakiye_Raporu_${format(new Date(), 'yyyyMMdd')}.pdf`
        ).then(() => setGenerating(null));
    }, 500);
  };

  const generateInventoryPDF = () => {
    setGenerating('INVENTORY');
    setTimeout(() => {
        const tableData = inventory.map(item => {
            return [
                item.pesticideName,
                item.category,
                `${item.quantity} ${item.unit}`,
                formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY'),
                formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')
            ];
        });

        const htmlContent = generateTableHtml('STOK DURUM LİSTESİ', ['Ürün Adı', 'Kategori', 'Miktar', 'Alış Fiyatı', 'Satış Fiyatı'], tableData, [], '#8b5cf6'); // Violet
        generatePdfFromHtml(
            'STOK DURUM RAPORU',
            `Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
            htmlContent, 
            `Stok_Raporu_${format(new Date(), 'yyyyMMdd')}.pdf`
        ).then(() => setGenerating(null));
    }, 500);
  };

  const generateExpensePDF = () => {
    setGenerating('EXPENSES');
    setTimeout(() => {
        const filteredExpenses = expenses.filter(exp => isWithinRange(exp.date));
        const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const tableData = sortedExpenses.map(exp => {
            return [
                format(new Date(exp.date), 'dd.MM.yyyy'),
                exp.title,
                exp.category,
                formatCurrency(exp.amount, userProfile?.currency || 'TRY')
            ];
        });

        const totalExpense = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

        const htmlContent = generateTableHtml('GİDER DÖKÜMÜ', ['Tarih', 'Açıklama', 'Kategori', 'Tutar'], tableData, [
            ['', '', 'TOPLAM GİDER', formatCurrency(totalExpense, userProfile?.currency || 'TRY')]
        ], '#e11d48'); // Rose
        
        generatePdfFromHtml(
            'GİDER RAPORU',
            `Dönem: ${format(new Date(startDate), 'dd.MM.yyyy')} - ${format(new Date(endDate), 'dd.MM.yyyy')}`,
            htmlContent, 
            `Gider_Raporu_${format(new Date(), 'yyyyMMdd')}.pdf`
        ).then(() => setGenerating(null));
    }, 500);
  };

  const generateFinancialSummaryPDF = () => {
    setGenerating('FINANCIAL');
    setTimeout(() => {
        let htmlContent = '';

        // 1. Kasa ve Banka
        const accountData = accounts.map(acc => [
            acc.name,
            acc.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabı',
            formatCurrency(acc.balance, userProfile?.currency || 'TRY')
        ]);
        const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
        htmlContent += generateTableHtml('1. KASA VE BANKA DURUMU', ['Hesap Adı', 'Tür', 'Bakiye'], accountData, [['', 'TOPLAM VARLIK', formatCurrency(totalBalance, userProfile?.currency || 'TRY')]], '#10b981'); // Emerald

        // 2. Genel Özet
        const filteredPayments = [
            ...payments.filter(p => isWithinRange(p.date)),
            ...myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED' && isWithinRange(p.issueDate))
        ];
        const filteredExpenses = expenses.filter(e => isWithinRange(e.date));

        const totalIncome = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
        const totalExpense = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
        const netProfit = totalIncome - totalExpense;

        const financialData = [
            ['Toplam Tahsilat (Gelir)', formatCurrency(totalIncome, userProfile?.currency || 'TRY')],
            ['Toplam Gider', formatCurrency(totalExpense, userProfile?.currency || 'TRY')],
            ['Net Durum', formatCurrency(netProfit, userProfile?.currency || 'TRY')]
        ];
        
        htmlContent += generateTableHtml('2. GELİR / GİDER ÖZETİ (Seçili Dönem)', ['Kalem', 'Tutar'], financialData, [], '#3b82f6'); // Blue

        generatePdfFromHtml(
            'FİNANSAL ÖZET RAPORU',
            `Dönem: ${format(new Date(startDate), 'dd.MM.yyyy')} - ${format(new Date(endDate), 'dd.MM.yyyy')}`,
            htmlContent, 
            `Finansal_Ozet_${format(new Date(), 'yyyyMMdd')}.pdf`
        ).then(() => setGenerating(null));
    }, 500);
  };

  const reportCards = [
    {
      id: 'BAYI_RAPORU',
      title: 'Bayi Raporum',
      description: 'İşletmenizin (kasa, müşteri, tedarikçi, depo vs.) tüm genel durumunu kusursuz bir şekilde tek PDF\'te sunar.',
      icon: Store,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      action: generateBayiRaporuPDF
    },
    {
      id: 'DETAILED_BAYI_RAPORU',
      title: 'Detaylı Bayi Raporum',
      description: 'Tüm dükkan verisini (faturalar, işlemler, borçlar, giderler vb.) tarih sırasıyla eksiksiz gösterir.',
      icon: FileText,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      action: generateDetailedBayiRaporuPDF
    },
    {
      id: 'FARMER_BALANCES',
      title: `${farmerLabel} Bakiye Raporu`,
      description: `Tüm ${farmerPluralLabel.toLowerCase()}in güncel borç ve alacak durumlarını listeler.`,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      action: generateFarmerBalancesPDF
    },
    {
      id: 'FINANCIAL',
      title: 'Finansal Özet Raporu',
      description: 'Kasa, banka durumları ve genel gelir/gider özetini içerir.',
      icon: FileText,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      action: generateFinancialSummaryPDF
    },
    {
      id: 'INVENTORY',
      title: 'Stok Durum Raporu',
      description: 'Depodaki tüm ürünlerin miktar ve fiyat bilgilerini listeler.',
      icon: Package,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      action: generateInventoryPDF
    },
    {
      id: 'EXPENSES',
      title: 'Gider Raporu',
      description: 'İşletme giderlerinizin detaylı ve tarih sıralı dökümünü verir.',
      icon: Receipt,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      action: generateExpensePDF
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 px-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-stone-100 tracking-tight flex items-center">
            <Printer className="mr-2 text-emerald-500" size={20} />
            Raporlar
          </h1>
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">
            İşletmenizin tüm verilerini PDF olarak dışa aktarın
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {reportCards.map((report) => (
          <div 
            key={report.id}
            className="group bg-stone-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-5 hover:bg-stone-800/80 hover:border-white/10 transition-all duration-300 relative overflow-hidden flex flex-col"
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:from-white/10 transition-all"></div>
            
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl ${report.bgColor} flex items-center justify-center border border-white/5 shadow-inner`}>
                <report.icon size={24} className={report.color} />
              </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-base font-bold text-stone-100 mb-1">{report.title}</h3>
              <p className="text-xs text-stone-400 leading-relaxed mb-6">
                {report.description}
              </p>
            </div>

            <button 
              onClick={() => {
                if (report.id === 'BAYI_RAPORU') {
                    report.action();
                } else {
                    setSelectedReportId(report.id);
                }
              }}
              disabled={generating !== null}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center transition-all ${
                generating === report.id 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-stone-950 text-stone-300 border border-white/5 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 shadow-lg'
              }`}
            >
              {generating === report.id ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Hazırlanıyor...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  PDF Oluştur ve İndir
                </>
              )}
            </button>
          </div>
        ))}
      </div>
      
      {selectedReportId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-stone-900 border border-white/10 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-stone-100 flex items-center gap-2">
                        <Calendar className="text-emerald-500" size={20} />
                        Tarih Aralığı Seçin
                    </h2>
                    <button onClick={() => setSelectedReportId(null)} className="p-2 bg-stone-800 rounded-full text-stone-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Başlangıç</label>
                            <input 
                              type="date" 
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2.5 text-stone-100 text-xs outline-none focus:border-emerald-500/50 transition-all font-bold"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-stone-500 uppercase ml-1 mb-1 block">Bitiş</label>
                            <input 
                              type="date" 
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full bg-stone-950 border border-white/10 rounded-xl px-3 py-2.5 text-stone-100 text-xs outline-none focus:border-emerald-500/50 transition-all font-bold"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-2">
                        {[
                            { label: 'Bu Ay', start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
                            { label: 'Geçen Ay', start: format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1), 'yyyy-MM-dd'), end: format(new Date(new Date().getFullYear(), new Date().getMonth(), 0), 'yyyy-MM-dd') },
                            { label: 'Bu Yıl', start: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') },
                            { label: 'Tüm Zamanlar', start: '2020-01-01', end: format(new Date(), 'yyyy-MM-dd') }
                        ].map((preset, idx) => (
                            <button 
                              key={idx}
                              onClick={() => { setStartDate(preset.start); setEndDate(preset.end); }}
                              className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-bold border border-white/5 whitespace-nowrap active:scale-95 transition-all"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <button 
                        onClick={() => {
                            const rep = reportCards.find(r => r.id === selectedReportId);
                            if (rep) {
                                rep.action();
                            }
                            setSelectedReportId(null);
                        }}
                        className="w-full mt-4 py-3.5 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center hover:bg-emerald-500 active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                    >
                        <Download size={18} className="mr-2" /> PDF Oluştur
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

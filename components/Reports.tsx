import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Printer, FileText, Download, Users, Package, Receipt, Loader2, ChevronRight, Calendar, X, Store } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from '../utils/currency';

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
    suppliers
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

  const generateBayiRaporuPDF = () => {
    setGenerating('BAYI_RAPORU');
    setTimeout(() => {
      try {
        const doc = new jsPDF();
        
        // --- 1. HEADER ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text(trToEn(userProfile?.companyName || "BAYI RAPORU"), 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "normal");
        doc.text(`Olusturulma: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 30);
        
        let currentY = 40;

        // --- 2. KASA & BANKA DURUMU ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(trToEn("1. KASA VE BANKA DURUMU"), 14, currentY);
        
        const accountData = accounts.map(acc => [
            trToEn(acc.name),
            trToEn(acc.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabi'),
            pdfCurrency(acc.balance)
        ]);
        const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);
        
        autoTable(doc, {
            startY: currentY + 5,
            head: [['Hesap Adi', 'Tur', 'Bakiye']],
            body: accountData,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { fillColor: [16, 185, 129] },
            foot: [['', 'TOPLAM VARLIK:', pdfCurrency(totalBalance)]],
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: { 2: { halign: 'right' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // --- 3. CIFTCI (MUSTERI) BAKIYELERI ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(trToEn(`2. ${farmerPluralLabel.toLocaleUpperCase('en-US')} BAKIYE DURUMU (Tum Zamanlar Kümülatif)`), 14, currentY);
        
        let totalReceivable = 0;
        let totalPayableToFarmers = 0;
        
        const farmerData = farmers.map(farmer => {
            // Tam bakiye (kümülatif): Tarih filtresi sadece rapor gorselinde degisek, gercek cari filtrelemesi hesap karmasasi yaratabilir. 
            // Ancak, tum islemleri bastan sona aliyoruz.
            const totalPaid = payments.filter(p => p.farmerId === farmer.id).reduce((acc, p) => acc + p.amount, 0) + 
                              myPayments.filter(p => p.farmerId === farmer.id && !p.deletedAt && p.status !== 'CANCELLED').reduce((acc, p) => acc + p.amount, 0);
            const totalDebt = prescriptions.filter(p => p.farmerId === farmer.id).reduce((acc, p) => acc + (p.totalAmount || 0), 0) + 
                              manualDebts.filter(d => d.farmerId === farmer.id && !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0);
            
            const balance = totalPaid - totalDebt;
            return { name: farmer.fullName, phone: farmer.phoneNumber, balance };
        }).filter(f => f.balance !== 0); // Sadece bakiyesi olanlar

        const formattedFarmerData = farmerData.map(f => {
            if (f.balance < 0) totalReceivable += Math.abs(f.balance);
            if (f.balance > 0) totalPayableToFarmers += Math.abs(f.balance);
            
            return [
                trToEn(f.name),
                trToEn(f.phone || '-'),
                pdfCurrency(Math.abs(f.balance)),
                f.balance >= 0 ? 'ALACAKLI HESAP' : 'BORCLU HESAP (BIZE)'
            ];
        });

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Musteri Adi', 'Telefon', 'Bakiye', 'Durum']],
            body: formattedFarmerData.length > 0 ? formattedFarmerData : [['Borclu/Alacakli musteri yok', '', '', '']],
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { fillColor: [59, 130, 246] }, // Blue
            foot: [
                ['', 'TOPLAM MUSTERI ALACAGIMIZ:', pdfCurrency(totalReceivable), ''],
                ['', 'TOPLAM MUSTERI BORCUMUZ:', pdfCurrency(totalPayableToFarmers), '']
            ],
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'center' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // --- 4. TEDARIKCI BAKIYELERI ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(trToEn("3. TEDARIKCI BAKIYE DURUMU (Tum Zamanlar)"), 14, currentY);
        
        let totalSupplierDebt = 0;
        let totalSupplierReceivable = 0;
        
        const supplierData = suppliers.filter(s => s.balance !== 0).map(supplier => {
            if (supplier.balance < 0) totalSupplierDebt += Math.abs(supplier.balance);
            if (supplier.balance > 0) totalSupplierReceivable += supplier.balance;
            
            return [
                trToEn(supplier.name),
                trToEn(supplier.phoneNumber || '-'),
                pdfCurrency(Math.abs(supplier.balance)),
                supplier.balance < 0 ? 'BORCLUYUZ (TEDARIKCIYE)' : 'ALACAKLIYIZ'
            ];
        });

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Tedarikci Adi', 'Telefon', 'Bakiye', 'Durum']],
            body: supplierData.length > 0 ? supplierData : [['Kayitli bakiye yok', '', '', '']],
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { fillColor: [245, 158, 11] }, // Amber 500
            foot: [
                ['', 'TOPLAM TEDARIKCI BORCUMUZ:', pdfCurrency(totalSupplierDebt), '']
            ],
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'center' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // --- 5. STOK DURUMU ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(trToEn("4. DEPO / STOK DURUMU"), 14, currentY);
        
        let totalInventoryBuyingValue = 0;
        let totalInventorySellingValue = 0;

        const inventoryData = inventory.filter(i => i.quantity > 0).map(item => {
            const buyingValue = item.quantity * item.buyingPrice;
            const sellingValue = item.quantity * item.sellingPrice;
            totalInventoryBuyingValue += buyingValue;
            totalInventorySellingValue += sellingValue;
            
            return [
                trToEn(item.pesticideName),
                trToEn(item.category),
                `${item.quantity} ${item.unit}`,
                pdfCurrency(item.buyingPrice),
                pdfCurrency(buyingValue)
            ];
        });

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Urun Adi', 'Kategori', 'Miktar', 'Birim Maliyet', 'Toplam Maliyet']],
            body: inventoryData.length > 0 ? inventoryData : [['Depoda urun yok', '', '', '', '']],
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { fillColor: [139, 92, 246] }, // Violet 500
            foot: [
                ['', '', 'DEPO TOPLAM MALIYETI:', '', pdfCurrency(totalInventoryBuyingValue)]
            ],
            footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // --- 6. DONEMSEL GELIR / GIDER (All Time) ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(trToEn("5. GENEL GELIR / GIDER (Tum Zamanlar)"), 14, currentY);
        
        const filteredPayments = [
            ...payments,
            ...myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED')
        ];
        const filteredExpenses = expenses;

        const totalIncome = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
        const totalExpense = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
        const netProfit = totalIncome - totalExpense;

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Kalem', 'Tutar']],
            body: [
                ['Toplam Tahsilatlar (Giren Nakit)', pdfCurrency(totalIncome)],
                ['Toplam Giderler ve Odemeler (Cikan Nakit)', pdfCurrency(totalExpense)],
                ['Tum Zamanlar NET NAKIT FARKI', pdfCurrency(netProfit)]
            ],
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 10 },
            headStyles: { fillColor: [225, 29, 72] }, // Rose 600
            columnStyles: { 1: { halign: 'right' } }
        });
        
        doc.save(`Bayi_Raporu_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
        setGenerating(null);
      } catch (e) {
        console.error(e);
        setGenerating(null);
      }
    }, 500);
  };

  const generateFarmerBalancesPDF = () => {
    setGenerating('FARMER_BALANCES');
    setTimeout(() => {
      try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(trToEn("Ciftci Bakiye Raporu"), 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Donem: ${format(new Date(startDate), 'dd.MM.yyyy')} - ${format(new Date(endDate), 'dd.MM.yyyy')}`, 14, 28);

      const tableData = farmers.map(farmer => {
        const fPayments = payments.filter(p => p.farmerId === farmer.id && isWithinRange(p.date));
        const fMyPayments = myPayments.filter(p => p.farmerId === farmer.id && !p.deletedAt && p.status !== 'CANCELLED' && isWithinRange(p.issueDate));
        const fPrescriptions = prescriptions.filter(p => p.farmerId === farmer.id && isWithinRange(p.date));
        const fManualDebts = manualDebts.filter(d => d.farmerId === farmer.id && isWithinRange(d.date));
        
        const totalPaid = fPayments.reduce((acc, p) => acc + p.amount, 0) + 
                         fMyPayments.reduce((acc, p) => acc + p.amount, 0);
        const totalDebt = fPrescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0) + 
                          fManualDebts.filter(d => !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0);
        
        const balance = totalPaid - totalDebt;
        const status = balance >= 0 ? 'ALACAK' : 'BORC';

        return [
          trToEn(farmer.fullName),
          trToEn(farmer.village || '-'),
          trToEn(farmer.phoneNumber || '-'),
          pdfCurrency(Math.abs(balance)),
          status
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: [['Ciftci Adi', 'Koy', 'Telefon', 'Bakiye', 'Durum']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'center' }
        }
      });

      doc.save(`Ciftci_Bakiye_Raporu_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setGenerating(null);
    } catch (e) {
      console.error(e);
      setGenerating(null);
    }
    }, 500);
  };

  const generateInventoryPDF = () => {
    setGenerating('INVENTORY');
    setTimeout(() => {
      try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(trToEn("Stok Durum Raporu"), 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);

      const tableData = inventory.map(item => {
        return [
          trToEn(item.pesticideName),
          trToEn(item.category),
          `${item.quantity} ${item.unit}`,
          pdfCurrency(item.buyingPrice),
          pdfCurrency(item.sellingPrice)
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: [['Urun Adi', 'Kategori', 'Miktar', 'Alis Fiyati', 'Satis Fiyati']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
            2: { halign: 'center' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
      });

      doc.save(`Stok_Raporu_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setGenerating(null);
    } catch (e) {
      console.error(e);
      setGenerating(null);
    }
    }, 500);
  };

  const generateExpensePDF = () => {
    setGenerating('EXPENSES');
    setTimeout(() => {
      try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(trToEn("Gider Raporu"), 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Donem: ${format(new Date(startDate), 'dd.MM.yyyy')} - ${format(new Date(endDate), 'dd.MM.yyyy')}`, 14, 28);

      const filteredExpenses = expenses.filter(exp => isWithinRange(exp.date));
      const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const tableData = sortedExpenses.map(exp => {
        return [
          format(new Date(exp.date), 'dd.MM.yyyy'),
          trToEn(exp.title),
          trToEn(exp.category),
          pdfCurrency(exp.amount)
        ];
      });

      const totalExpense = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

      autoTable(doc, {
        startY: 35,
        head: [['Tarih', 'Aciklama', 'Kategori', 'Tutar']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [225, 29, 72] }, // Rose 600
        alternateRowStyles: { fillColor: [245, 245, 245] },
        foot: [['', '', 'TOPLAM GIDER:', pdfCurrency(totalExpense)]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            0: { halign: 'center' },
            3: { halign: 'right' }
        }
      });

      doc.save(`Gider_Raporu_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setGenerating(null);
    } catch (e) {
      console.error(e);
      setGenerating(null);
    }
    }, 500);
  };

  const generateFinancialSummaryPDF = () => {
    setGenerating('FINANCIAL');
    setTimeout(() => {
      try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(trToEn("Finansal Ozet Raporu"), 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Donem: ${format(new Date(startDate), 'dd.MM.yyyy')} - ${format(new Date(endDate), 'dd.MM.yyyy')}`, 14, 28);

      // Kasa Durumu
      let currentY = 40;
      doc.setFont("helvetica", "bold");
      doc.text(trToEn("1. Kasa ve Banka Durumu"), 14, currentY);
      
      const accountData = accounts.map(acc => [
        trToEn(acc.name),
        trToEn(acc.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabi'),
        pdfCurrency(acc.balance)
      ]);

      const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Hesap Adi', 'Tur', 'Bakiye']],
        body: accountData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] },
        foot: [['', 'TOPLAM VARLIK:', pdfCurrency(totalBalance)]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
            2: { halign: 'right' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Genel Ozet
      const filteredPayments = [
          ...payments.filter(p => isWithinRange(p.date)),
          ...myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED' && isWithinRange(p.issueDate))
      ];
      const filteredExpenses = expenses.filter(e => isWithinRange(e.date));

      const totalIncome = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
      const totalExpense = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
      const netProfit = totalIncome - totalExpense;

      doc.setFont("helvetica", "bold");
      doc.text(trToEn("2. Gelir / Gider Ozeti (Secili Donem)"), 14, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Kalem', 'Tutar']],
        body: [
          ['Toplam Tahsilat (Gelir)', pdfCurrency(totalIncome)],
          ['Toplam Gider', pdfCurrency(totalExpense)],
          ['Net Durum', pdfCurrency(netProfit)]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] }, // Blue 500
        columnStyles: {
            1: { halign: 'right' }
        }
      });

      doc.save(`Finansal_Ozet_${format(new Date(), 'yyyyMMdd')}.pdf`);
      setGenerating(null);
    } catch (e) {
      console.error(e);
      setGenerating(null);
    }
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

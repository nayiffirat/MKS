import React, { useState } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Printer, FileText, Download, Users, Package, Receipt, Loader2, ChevronRight, Calendar } from 'lucide-react';
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
    accounts, 
    userProfile,
    farmerLabel,
    farmerPluralLabel,
    prescriptionLabel
  } = useAppViewModel();
  const [generating, setGenerating] = useState<string | null>(null);

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
      doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);

      const tableData = farmers.map(farmer => {
        const fPayments = payments.filter(p => p.farmerId === farmer.id);
        const fPrescriptions = prescriptions.filter(p => p.farmerId === farmer.id);
        const fManualDebts = manualDebts.filter(d => d.farmerId === farmer.id);
        
        const totalPaid = fPayments.reduce((acc, p) => acc + p.amount, 0);
        const totalDebt = fPrescriptions.reduce((acc, p) => acc + (p.totalAmount || 0), 0) + 
                          fManualDebts.filter(d => !d.id.startsWith('turnover-')).reduce((acc, d) => acc + d.amount, 0);
        
        const balance = totalPaid - totalDebt;
        const status = balance >= 0 ? 'ALACAK' : 'BORC';

        return [
          trToEn(farmer.fullName),
          trToEn(farmer.village || '-'),
          trToEn(farmer.phoneNumber || '-'),
          formatCurrency(Math.abs(balance), userProfile?.currency || 'TRY'),
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
        alternateRowStyles: { fillColor: [245, 245, 245] }
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
          formatCurrency(item.buyingPrice, userProfile?.currency || 'TRY'),
          formatCurrency(item.sellingPrice, userProfile?.currency || 'TRY')
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: [['Urun Adi', 'Kategori', 'Miktar', 'Alis Fiyati', 'Satis Fiyati']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
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
      doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);

      const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const tableData = sortedExpenses.map(exp => {
        return [
          format(new Date(exp.date), 'dd.MM.yyyy'),
          trToEn(exp.title),
          trToEn(exp.category),
          formatCurrency(exp.amount, userProfile?.currency || 'TRY')
        ];
      });

      const totalExpense = expenses.reduce((acc, curr) => acc + curr.amount, 0);

      autoTable(doc, {
        startY: 35,
        head: [['Tarih', 'Aciklama', 'Kategori', 'Tutar']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [225, 29, 72] }, // Rose 600
        alternateRowStyles: { fillColor: [245, 245, 245] },
        foot: [['', '', 'TOPLAM GIDER:', formatCurrency(totalExpense, userProfile?.currency || 'TRY')]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
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
      doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 14, 28);

      // Kasa Durumu
      let currentY = 40;
      doc.setFont("helvetica", "bold");
      doc.text(trToEn("1. Kasa ve Banka Durumu"), 14, currentY);
      
      const accountData = accounts.map(acc => [
        trToEn(acc.name),
        trToEn(acc.type === 'CASH' ? 'Nakit Kasa' : 'Banka Hesabi'),
        formatCurrency(acc.balance, userProfile?.currency || 'TRY')
      ]);

      const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Hesap Adi', 'Tur', 'Bakiye']],
        body: accountData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [16, 185, 129] },
        foot: [['', 'TOPLAM VARLIK:', formatCurrency(totalBalance, userProfile?.currency || 'TRY')]],
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Genel Ozet
      const totalIncome = payments.reduce((acc, p) => acc + p.amount, 0);
      const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);
      const netProfit = totalIncome - totalExpense;

      doc.setFont("helvetica", "bold");
      doc.text(trToEn("2. Gelir / Gider Ozeti (Tum Zamanlar)"), 14, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Kalem', 'Tutar']],
        body: [
          ['Toplam Tahsilat (Gelir)', formatCurrency(totalIncome, userProfile?.currency || 'TRY')],
          ['Toplam Gider', formatCurrency(totalExpense, userProfile?.currency || 'TRY')],
          ['Net Durum', formatCurrency(netProfit, userProfile?.currency || 'TRY')]
        ],
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] }, // Blue 500
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              onClick={report.action}
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
      
      <div className="mt-8 bg-stone-900/40 border border-white/5 rounded-2xl p-4 flex items-start space-x-3">
        <div className="mt-0.5">
          <Calendar size={16} className="text-stone-500" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-stone-300">Özel Tarihli Raporlar</h4>
          <p className="text-[10px] text-stone-500 mt-1 leading-relaxed">
            Şu anda tüm raporlar "Tüm Zamanlar" verilerini kapsamaktadır. Gelecek güncellemelerde özel tarih aralığı seçme özelliği eklenecektir.
          </p>
        </div>
      </div>
    </div>
  );
};

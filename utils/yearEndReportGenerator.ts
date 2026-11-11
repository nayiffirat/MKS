import { createMultiPagePdf, renderElementToCanvas } from './pdfHelper';
import { format } from 'date-fns';
import { formatCurrency } from './currency';
import { 
  Farmer, 
  InventoryItem, 
  Prescription, 
  Payment, 
  ManualDebt, 
  MyPayment, 
  Supplier, 
  SupplierPurchase, 
  Account, 
  Expense, 
  UserProfile 
} from '../types';

export interface YearEndReportParams {
  targetYear: number;
  farmers: Farmer[];
  inventory: InventoryItem[];
  prescriptions: Prescription[];
  payments: Payment[];
  manualDebts: ManualDebt[];
  myPayments: MyPayment[];
  suppliers: Supplier[];
  supplierPurchases: SupplierPurchase[];
  accounts: Account[];
  expenses: Expense[];
  userProfile?: UserProfile;
}

export async function generateYearEndReportPDF(params: YearEndReportParams): Promise<void> {
  const {
    targetYear,
    farmers,
    inventory,
    prescriptions,
    payments,
    manualDebts,
    myPayments,
    suppliers,
    supplierPurchases,
    accounts,
    expenses,
    userProfile
  } = params;

  const currency = userProfile?.currency || 'TRY';

  // 1. FILTER DATA FOR TARGET YEAR
  const yearPrescriptions = prescriptions.filter(p => {
    if (p.deletedAt) return false;
    if (p.date) {
      const y = new Date(p.date).getFullYear();
      return !isNaN(y) && y === targetYear;
    }
    return false;
  });

  const yearExpenses = expenses.filter(e => {
    if (e.deletedAt) return false;
    if (e.date) {
      const y = new Date(e.date).getFullYear();
      return !isNaN(y) && y === targetYear;
    }
    return false;
  });

  // 2. PRODUCT PROFITABILITY & SALES
  const productMap: Record<string, {
    name: string;
    category: string;
    unit: string;
    qtySold: number;
    revenue: number;
    cost: number;
    profit: number;
  }> = {};

  let totalSalesRevenue = 0;
  let totalCOGS = 0;

  yearPrescriptions.forEach(p => {
    const isReturn = p.type === 'RETURN';
    p.items.forEach(item => {
      const qtyStr = String(item.quantity || '0').replace(',', '.');
      const qty = parseFloat(qtyStr) || 0;
      if (qty <= 0) return;

      const matchedInventory = inventory.find(i => i.pesticideId === item.pesticideId);
      const unitPrice = item.unitPrice || 0;
      const unitBuyingPrice = item.buyingPrice || matchedInventory?.buyingPrice || 0;

      const itemRevenue = item.totalPrice || (qty * unitPrice);
      const itemCost = qty * unitBuyingPrice;

      const name = item.pesticideName || matchedInventory?.pesticideName || 'İsimsiz Ürün';
      const category = matchedInventory?.category || 'Diğer';
      const unit = matchedInventory?.unit || 'Adet';

      if (!productMap[item.pesticideId]) {
        productMap[item.pesticideId] = {
          name,
          category,
          unit,
          qtySold: 0,
          revenue: 0,
          cost: 0,
          profit: 0
        };
      }

      const entry = productMap[item.pesticideId];
      if (isReturn) {
        entry.qtySold -= qty;
        entry.revenue -= itemRevenue;
        entry.cost -= itemCost;
        totalSalesRevenue -= itemRevenue;
        totalCOGS -= itemCost;
      } else {
        entry.qtySold += qty;
        entry.revenue += itemRevenue;
        entry.cost += itemCost;
        totalSalesRevenue += itemRevenue;
        totalCOGS += itemCost;
      }
      entry.profit = entry.revenue - entry.cost;
    });
  });

  const totalGrossProfit = totalSalesRevenue - totalCOGS;
  const totalOperatingExpenses = yearExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netOperatingProfit = totalGrossProfit - totalOperatingExpenses;

  // 3. FARMER BALANCES AT END OF TARGET YEAR
  const farmerBalanceList: { name: string; phone: string; balance: number; status: string }[] = [];
  let totalFarmerReceivables = 0; // Piyasa Alacağımız (Çiftçilerin bize borcu)
  let totalFarmerPayables = 0;    // Çiftçilere borcumuz (Fazla ödemeler)

  farmers.forEach(f => {
    if (f.deletedAt) return;
    // Calculate balance up to end of targetYear
    let sales = 0;
    let manual = 0;
    let pays = 0;

    prescriptions.forEach(p => {
      if (p.farmerId === f.id && !p.deletedAt && p.priceType !== 'CASH') {
        const y = new Date(p.date).getFullYear();
        if (y <= targetYear) {
          sales += (p.totalAmount || 0);
        }
      }
    });

    manualDebts.forEach(d => {
      if (d.farmerId === f.id && !d.deletedAt) {
        const y = new Date(d.date).getFullYear();
        if (y <= targetYear) {
          manual += (d.amount || 0);
        }
      }
    });

    payments.forEach(p => {
      if (p.farmerId === f.id && !p.deletedAt) {
        const y = new Date(p.date).getFullYear();
        if (y <= targetYear) {
          pays += (p.amount || 0);
        }
      }
    });

    const netBal = sales + manual - pays;
    if (netBal > 0) {
      totalFarmerReceivables += netBal;
      farmerBalanceList.push({ name: f.fullName, phone: f.phoneNumber || '-', balance: netBal, status: 'BORÇLU (ALACAKLIYIZ)' });
    } else if (netBal < 0) {
      totalFarmerPayables += Math.abs(netBal);
      farmerBalanceList.push({ name: f.fullName, phone: f.phoneNumber || '-', balance: netBal, status: 'ALACAKLI (BORÇLUYUZ)' });
    }
  });

  // Sort farmers by highest debt
  farmerBalanceList.sort((a, b) => b.balance - a.balance);

  // 4. SUPPLIER BALANCES AT END OF TARGET YEAR
  const supplierBalanceList: { name: string; phone: string; balance: number }[] = [];
  let totalSupplierDebt = 0;

  suppliers.forEach(s => {
    if (s.deletedAt) return;
    let purchases = 0;
    let pays = 0;

    supplierPurchases.forEach(sp => {
      if (sp.supplierId === s.id && !sp.deletedAt) {
        const y = new Date(sp.date).getFullYear();
        if (y <= targetYear) {
          const isSale = sp.type === 'SALE' || sp.note?.includes('SATIŞ');
          const isReturn = sp.type === 'RETURN' || (sp.note?.includes('İADE') && !isSale);
          if (isSale || isReturn || (sp.totalAmount && sp.totalAmount < 0)) {
            pays += Math.abs(sp.totalAmount || 0);
          } else {
            purchases += (sp.totalAmount || 0);
          }
        }
      }
    });

    myPayments.forEach(mp => {
      if (mp.supplierId === s.id && !mp.deletedAt && mp.status !== 'CANCELLED') {
        const y = new Date(mp.issueDate).getFullYear();
        if (y <= targetYear) pays += (mp.amount || 0);
      }
    });

    const netDebt = purchases - pays;
    if (netDebt !== 0) {
      if (netDebt > 0) totalSupplierDebt += netDebt;
      supplierBalanceList.push({ name: s.name, phone: s.phoneNumber || '-', balance: netDebt });
    }
  });

  // 5. INVENTORY STOCK & VALUATION
  const inventoryReport: { name: string; category: string; stock: number; unit: string; costValue: number; retailValue: number }[] = [];
  let totalStockCostValue = 0;
  let totalStockRetailValue = 0;

  inventory.forEach(item => {
    if (item.deletedAt) return;
    const stockQty = item.quantity; // current stock
    const costVal = stockQty * (item.buyingPrice || 0);
    const retailVal = stockQty * (item.sellingPrice || 0);

    totalStockCostValue += costVal;
    totalStockRetailValue += retailVal;

    inventoryReport.push({
      name: item.pesticideName,
      category: item.category || 'Diğer',
      stock: stockQty,
      unit: item.unit || 'Adet',
      costValue: costVal,
      retailValue: retailVal
    });
  });

  // 6. CASH & BANK ACCOUNTS
  let totalLiquidCash = 0;
  const accountsList = accounts.map(a => {
    totalLiquidCash += a.balance || 0;
    return { name: a.name, type: a.type === 'CASH' ? 'Kasa (Nakit)' : 'Banka / POS', balance: a.balance || 0 };
  });

  // 7. CHECKS & PROMISSORY NOTES
  const activeChecks = myPayments.filter(p => !p.deletedAt && p.status !== 'CANCELLED');
  const customerChecks = activeChecks.filter(p => p.farmerId);
  const supplierChecks = activeChecks.filter(p => p.supplierId);

  const totalCustomerChecksAmount = customerChecks.reduce((acc, c) => acc + (c.amount || 0), 0);
  const totalSupplierChecksAmount = supplierChecks.reduce((acc, c) => acc + (c.amount || 0), 0);

  // 8. HTML TEMPLATE FOR PDF GENERATION
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '850px';
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '36px';
  container.style.color = '#1c1917';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const companyTitle = (userProfile?.companyName || 'MKS ZİRAİ SİSTEMLERİ').toLocaleUpperCase('tr-TR');
  const stampTitle = (userProfile?.stampTitle || userProfile?.companyName || 'MKS SİSTEMİ').toLocaleUpperCase('tr-TR');
  const stampSubTitle = userProfile?.stampSubTitle || (userProfile?.title ? `${userProfile.title} ${userProfile?.fullName || ''}` : userProfile?.fullName || 'Ziraat Mühendisi');
  const stampTax = userProfile?.stampTaxInfo || 'Vergi D. - 1234567890';
  const stampColor = userProfile?.stampColor || '#059669';

  const productRows = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .map((p, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#fafaf9' : '#ffffff'}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
        <td style="padding: 6px 8px; font-weight: 700;">${p.name}</td>
        <td style="padding: 6px 8px; color: #57534e;">${p.category}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${p.qtySold} ${p.unit}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 600;">${formatCurrency(p.revenue, currency)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #78716c;">${formatCurrency(p.cost, currency)}</td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${p.profit >= 0 ? '#059669' : '#dc2626'};">
          ${p.profit >= 0 ? '+' : ''}${formatCurrency(p.profit, currency)}
        </td>
      </tr>
    `).join('');

  const farmerRows = farmerBalanceList.slice(0, 30).map((f, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#fafaf9' : '#ffffff'}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${f.name}</td>
      <td style="padding: 6px 8px; color: #78716c;">${f.phone}</td>
      <td style="padding: 6px 8px; text-align: center; font-weight: 700; color: ${f.balance > 0 ? '#059669' : '#dc2626'};">${f.status}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${f.balance > 0 ? '#059669' : '#dc2626'};">
        ${formatCurrency(f.balance, currency)}
      </td>
    </tr>
  `).join('');

  const supplierRows = supplierBalanceList.map((s, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#fafaf9' : '#ffffff'}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${s.name}</td>
      <td style="padding: 6px 8px; color: #78716c;">${s.phone}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: #dc2626;">
        ${formatCurrency(s.balance, currency)}
      </td>
    </tr>
  `).join('');

  const accountRows = accountsList.map((a, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#fafaf9' : '#ffffff'}; border-bottom: 1px solid #e7e5e4; font-size: 10px;">
      <td style="padding: 6px 8px; font-weight: 700;">${a.name}</td>
      <td style="padding: 6px 8px; color: #57534e;">${a.type}</td>
      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 800; color: ${a.balance >= 0 ? '#059669' : '#dc2626'};">
        ${formatCurrency(a.balance, currency)}
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <!-- HEADER -->
    <div style="border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="font-size: 22px; font-weight: 900; color: #059669; margin: 0 0 4px 0; text-transform: uppercase;">
          ${companyTitle}
        </h1>
        <h2 style="font-size: 16px; font-weight: 800; color: #1c1917; margin: 0;">
          ${targetYear} YILI SENE SONU DEVİR VE RESMİ FİNANSAL BİLANÇO RAPORU
        </h2>
        <p style="font-size: 11px; color: #78716c; margin: 4px 0 0 0;">
          İşletmenizin ${targetYear} yılı kârlılık, cari, stok, borç ve ortaklık hesap raporudur.
        </p>
      </div>
      <div style="text-align: right; font-size: 10px; color: #57534e;">
        <p style="margin: 0;"><strong>Rapor Tarihi:</strong> ${format(new Date(), 'dd.MM.yyyy HH:mm')}</p>
        <p style="margin: 2px 0 0 0;"><strong>Devir Yılı:</strong> ${targetYear}</p>
        <p style="margin: 2px 0 0 0;"><strong>Yetkili:</strong> ${userProfile?.fullName || 'Ziraat Mühendisi'}</p>
      </div>
    </div>

    <!-- 1. KÂR / ZARAR VE ÖZET MİLANDI HESABI -->
    <div style="margin-bottom: 24px; background-color: #f0fdf4; border: 1.5px solid #10b981; border-radius: 12px; padding: 16px;">
      <h3 style="font-size: 13px; font-weight: 900; color: #065f46; margin: 0 0 12px 0; text-transform: uppercase; border-bottom: 1px solid #a7f3d0; padding-bottom: 6px;">
        📊 1. ${targetYear} Yılı Genel Finansal Özet & Kâr / Zarar Tablosu
      </h3>
      <div style="display: grid; grid-template-cols: repeat(4, 1fr); gap: 12px;">
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Toplam Satış Ciro</span>
          <span style="font-size: 14px; font-weight: 900; color: #065f46; font-family: monospace;">${formatCurrency(totalSalesRevenue, currency)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Satılan Mal Maliyeti (STMM)</span>
          <span style="font-size: 14px; font-weight: 900; color: #78716c; font-family: monospace;">${formatCurrency(totalCOGS, currency)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid #d1fae5;">
          <span style="font-size: 9px; color: #047857; font-weight: 800; text-transform: uppercase; display: block;">Toplam İşletme Giderleri</span>
          <span style="font-size: 14px; font-weight: 900; color: #dc2626; font-family: monospace;">${formatCurrency(totalOperatingExpenses, currency)}</span>
        </div>
        <div style="background: white; padding: 10px; border-radius: 8px; border: 1.5px solid ${netOperatingProfit >= 0 ? '#10b981' : '#ef4444'};">
          <span style="font-size: 9px; color: ${netOperatingProfit >= 0 ? '#047857' : '#991b1b'}; font-weight: 800; text-transform: uppercase; display: block;">Net İşletme Kârı / Zararı</span>
          <span style="font-size: 15px; font-weight: 900; color: ${netOperatingProfit >= 0 ? '#059669' : '#dc2626'}; font-family: monospace;">
            ${netOperatingProfit >= 0 ? '+' : ''}${formatCurrency(netOperatingProfit, currency)}
          </span>
        </div>
      </div>

      <!-- ORTAKLIK PAYLAŞIM ANALİZİ -->
      <div style="margin-top: 14px; pt-10px; border-top: 1px dashed #a7f3d0; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 10px 14px; border-radius: 8px; border: 1px solid #a7f3d0;">
        <div>
          <span style="font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase; block;">🤝 Ortaklık & Hisseli Paylaşım Analizi</span>
          <span style="font-size: 9px; color: #047857;">Net kâr / zarar tutarının eşit ortak sayısına göre dağılımı:</span>
        </div>
        <div style="display: flex; gap: 16px; font-size: 10px; font-family: monospace;">
          <div>
            <span style="color: #78716c; font-weight: 700;">2 Eşit Ortaklı:</span>
            <span style="font-weight: 900; color: ${netOperatingProfit >= 0 ? '#059669' : '#dc2626'}; ml-1">
              Ortak Başı ${formatCurrency(netOperatingProfit / 2, currency)}
            </span>
          </div>
          <div>
            <span style="color: #78716c; font-weight: 700;">3 Eşit Ortaklı:</span>
            <span style="font-weight: 900; color: ${netOperatingProfit >= 0 ? '#059669' : '#dc2626'}; ml-1">
              Ortak Başı ${formatCurrency(netOperatingProfit / 3, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. STOK VE DEPO DURUMU -->
    <div style="margin-bottom: 24px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0; text-transform: uppercase;">
          📦 2. Depo & Stok Durumu Ve Varlık Değerlemesi
        </h3>
        <div style="font-size: 10px; font-weight: 800; font-family: monospace; color: #059669;">
          Toplam Depo Alış Değeri: ${formatCurrency(totalStockCostValue, currency)} | Perakende Satış Değeri: ${formatCurrency(totalStockRetailValue, currency)}
        </div>
      </div>
      <p style="font-size: 9px; color: #78716c; margin: 0 0 8px 0;">
        Devredilen yıl sonu itibarıyla depoda kayıtlı bulunan toplam <strong>${inventoryReport.length} adet</strong> ürün stoğu ve güncel maliyet değerleridir.
      </p>
    </div>

    <!-- 3. KASA, BANKA VE ÇEKLER -->
    <div style="margin-bottom: 24px; display: grid; grid-template-cols: 1fr 1fr; gap: 16px;">
      <!-- KASALAR VE BANKALAR -->
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px;">
        <h3 style="font-size: 11px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase; border-bottom: 1px solid #f5f5f4; padding-bottom: 4px;">
          💰 Kasalar & Banka Varlıkları
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f4; font-size: 9px; text-align: left; color: #57534e;">
              <th style="padding: 4px 6px;">Hesap Adı</th>
              <th style="padding: 4px 6px;">Tür</th>
              <th style="padding: 4px 6px; text-align: right;">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${accountRows.length > 0 ? accountRows : '<tr><td colspan="3" style="padding:8px; text-align:center; font-size:10px; color:#a8a29e;">Kasa/Banka hesabı yok</td></tr>'}
          </tbody>
        </table>
        <div style="margin-top: 8px; text-align: right; font-size: 11px; font-weight: 900; color: #059669; font-family: monospace;">
          Toplam Likit Varlık: ${formatCurrency(totalLiquidCash, currency)}
        </div>
      </div>

      <!-- ÇEK VE SENETLER -->
      <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px;">
        <h3 style="font-size: 11px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase; border-bottom: 1px solid #f5f5f4; padding-bottom: 4px;">
          📑 Çekler, Senetler & Kart Portföyü
        </h3>
        <div style="space-y: 6px; font-size: 10px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f4;">
            <span style="color: #57534e;">Müşteri Çek/Senet Alacakları (${customerChecks.length} Adet):</span>
            <span style="font-weight: 800; font-family: monospace; color: #059669;">+${formatCurrency(totalCustomerChecksAmount, currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f4;">
            <span style="color: #57534e;">Tedarikçi Çek/Senet Borçları (${supplierChecks.length} Adet):</span>
            <span style="font-weight: 800; font-family: monospace; color: #dc2626;">-${formatCurrency(totalSupplierChecksAmount, currency)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-weight: 900;">
            <span style="color: #1c1917;">Net Vadeli Çek Pozisyonu:</span>
            <span style="font-family: monospace; color: ${(totalCustomerChecksAmount - totalSupplierChecksAmount) >= 0 ? '#059669' : '#dc2626'};">
              ${formatCurrency(totalCustomerChecksAmount - totalSupplierChecksAmount, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. ÇİFTÇİ CARİ HESAP BAKİYELERİ (PIYASA ALACAKLARI) -->
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0; text-transform: uppercase;">
          👥 4. Çiftçi (Cari) Borç & Alacak Durumu
        </h3>
        <div style="font-size: 10px; font-weight: 800; font-family: monospace; color: #059669;">
          Toplam Piyasa Alacağımız: ${formatCurrency(totalFarmerReceivables, currency)} | Çiftçi Alacakları: ${formatCurrency(totalFarmerPayables, currency)}
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #1c1917; color: white; font-size: 9px; text-align: left;">
            <th style="padding: 6px 8px;">Çiftçi Adı Soyadı</th>
            <th style="padding: 6px 8px;">Telefon</th>
            <th style="padding: 6px 8px; text-align: center;">Durum</th>
            <th style="padding: 6px 8px; text-align: right;">Bakiye</th>
          </tr>
        </thead>
        <tbody>
          ${farmerRows.length > 0 ? farmerRows : '<tr><td colspan="4" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Devir öncesi bakiyesi olan çiftçi bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 5. TEDARİKCİ (BAYİ/FİRMA) BORÇLARI -->
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0; text-transform: uppercase;">
          🏭 5. Tedarikçi (Bayi) Borç Dökümü
        </h3>
        <div style="font-size: 10px; font-weight: 800; font-family: monospace; color: #dc2626;">
          Toplam Tedarikçi Borcumuz: ${formatCurrency(totalSupplierDebt, currency)}
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #1c1917; color: white; font-size: 9px; text-align: left;">
            <th style="padding: 6px 8px;">Tedarikçi Firma</th>
            <th style="padding: 6px 8px;">Telefon</th>
            <th style="padding: 6px 8px; text-align: right;">Borç Bakiyesi</th>
          </tr>
        </thead>
        <tbody>
          ${supplierRows.length > 0 ? supplierRows : '<tr><td colspan="3" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Tedarikçi borcu bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 6. ÜRÜN BAZLI KÂRLILIK DÖKÜMÜ -->
    <div style="margin-bottom: 30px;">
      <h3 style="font-size: 12px; font-weight: 900; color: #1c1917; margin: 0 0 8px 0; text-transform: uppercase;">
        🌾 6. Ürün Bazlı Satış ve Kârlılık Analizi (${targetYear})
      </h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #047857; color: white; font-size: 9px; text-align: left;">
            <th style="padding: 6px 8px;">Ürün Adı</th>
            <th style="padding: 6px 8px;">Kategori</th>
            <th style="padding: 6px 8px; text-align: right;">Satış Miktarı</th>
            <th style="padding: 6px 8px; text-align: right;">Toplam Ciro</th>
            <th style="padding: 6px 8px; text-align: right;">Tahmini Maliyet</th>
            <th style="padding: 6px 8px; text-align: right;">Net Ürün Kârı</th>
          </tr>
        </thead>
        <tbody>
          ${productRows.length > 0 ? productRows : '<tr><td colspan="6" style="padding:10px; text-align:center; font-size:10px; color:#78716c;">Satış yapılan ürün bulunamadı.</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- RESMİ KAŞE VE MKS DİJİTAL SİSTEM İMZASI -->
    <div style="margin-top: 32px; padding-top: 16px; border-top: 2px dashed #e7e5e4; display: flex; justify-content: space-between; align-items: flex-end;">
      <div style="font-size: 9.5px; color: #78716c; font-family: monospace; line-height: 1.4;">
        Bu rapor Mühendis Kayıt Sistemi (MKS) tarafından otomatik oluşturulmuştur.<br/>
        Rapor Oluşturma Zamanı: ${format(new Date(), 'dd.MM.yyyy HH:mm:ss')}<br/>
        Sene Sonu Devir Tescil Kodu: MKS-DEVIR-${targetYear}-${Math.random().toString(36).substring(2, 7).toUpperCase()}
      </div>

      <div style="border: 2.5px solid ${stampColor}; border-radius: 8px; padding: 10px 16px; transform: rotate(-2deg); color: ${stampColor}; text-align: center; max-width: 260px;">
        <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid ${stampColor}; padding-bottom: 4px; margin-bottom: 4px; font-family: serif;">
          ${stampTitle}
        </div>
        <div style="font-size: 10px; font-weight: 800; margin-bottom: 2px;">
          ${stampSubTitle}
        </div>
        <div style="font-size: 8.5px; opacity: 0.9; font-weight: 600;">
          ${stampTax}
        </div>
        <div style="font-size: 8px; opacity: 0.8; margin-top: 2px; text-transform: uppercase;">
          Resmi Onaylı Sene Sonu Devir Raporu
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await renderElementToCanvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false
    });

    document.body.removeChild(container);

    const pdf = await createMultiPagePdf(canvas);
    pdf.save(`MKS_${targetYear}_Yil_Sonu_Devir_ve_Bilanço_Raporu.pdf`);
  } catch (err) {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    console.error("Year End Report PDF generation error:", err);
    throw err;
  }
}

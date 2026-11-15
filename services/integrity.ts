/**
 * Veri sağlığı denetçisi — kasa, stok ve yarım kalmış kayıtları tarar.
 * - Güvenle onarılabilenleri (bekleyen senkronizasyon, NaN stok alanları, yarım kalmış stok işlemleri, kasa bakiye önbelleği) kendisi tamamlar.
 * - Kullanıcı kararı gerektirenleri (stok farkı, kasaya işlenmemiş peşin satış, eksi stok) GİZLEMEZ; raporlar ve tek tıkla çözüm sunar.
 * Uygulama açılışında günde en fazla iki kez arka planda çalışır; Ayarlar'dan elle de çalıştırılabilir.
 */
import { dbService } from './db';
import { generateUUID } from '../utils/uuid';
import { round2 } from '../utils/currency';
import { getLocalDateString } from '../utils/dateUtils';

export type IntegrityCode = 'HALF_SALE' | 'HALF_PURCHASE' | 'ACCOUNT_MISMATCH' | 'CASH_SALE_NO_KASA' | 'STOCK_MISMATCH' | 'NEGATIVE_STOCK';
export interface IntegrityIssue { code: IntegrityCode; title: string; detail: string; count: number; repaired: boolean }
export interface IntegrityReport { ranAt: string; ok: boolean; issues: IntegrityIssue[]; open: number; repaired: number }

const REPORT_KEY = 'mks_integrity_report';
const names = (list: string[], max = 3) => `${list.slice(0, max).join(', ')}${list.length > max ? ` ve ${list.length - max} kayıt daha` : ''}`;
const kurus = (v: unknown) => Math.round((Number(v) || 0) * 100);

export async function runIntegrityCheck(repair = true): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = [];

  // 0) Çevrimiçiyse bekleyen senkronizasyon kuyruğunu erit & NaN stok değerlerini temizle
  if (repair) {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await dbService.flushSyncOutboxNow().catch(e => console.warn('integrity: flushSyncOutboxNow', e));
    }
    await dbService.sanitizeInventoryNumbers().catch(e => console.warn('integrity: sanitizeInventoryNumbers', e));
  }

  // 1) Yarım kalmış satış / iade: belge kaydedilmiş ama stoğa işlenmemiş
  const prescriptions = (await dbService.getAllPrescriptionsRaw()).filter(p => !p.deletedAt);
  const halfSales = prescriptions.filter(p => p.isProcessed === true && p.isInventoryProcessed === false && (p.items || []).length > 0);
  if (halfSales.length) {
    let done = 0;
    if (repair) for (const p of halfSales) { try { await dbService.processInventory(p); done++; } catch (e) { console.error('integrity: processInventory', p.id, e); } }
    issues.push({
      code: 'HALF_SALE', count: halfSales.length, repaired: done === halfSales.length,
      title: 'Stoğa işlenmemiş satış kaydı',
      detail: `${names(halfSales.map(p => p.prescriptionNo || p.id))}. ${done === halfSales.length ? 'Stok düşümü tamamlandı.' : 'Stok düşümü tamamlanamadı; kaydı açıp yeniden kaydedin.'}`
    });
  }

  // 2) Yarım kalmış tedarikçi belgesi
  const purchases = (await dbService.getSupplierPurchases()).filter((p: any) => !p.deletedAt);
  const halfPurchases = purchases.filter((p: any) => p.isInventoryProcessed === false && (p.items || []).length > 0);
  if (halfPurchases.length) {
    let done = 0;
    if (repair) for (const p of halfPurchases) { try { await dbService.saveSupplierPurchaseWithInventory(p, null); done++; } catch (e) { console.error('integrity: purchase', p.id, e); } }
    issues.push({
      code: 'HALF_PURCHASE', count: halfPurchases.length, repaired: done === halfPurchases.length,
      title: 'Stoğa işlenmemiş alım / iade / tedarikçi satışı',
      detail: `${names(halfPurchases.map((p: any) => p.receiptNo || p.id))}. ${done === halfPurchases.length ? 'Stok etkisi tamamlandı.' : 'Tamamlanamadı; belgeyi açıp yeniden kaydedin.'}`
    });
  }

  // 3) Kasa / banka bakiyesi = hareketlerin toplamı mı?
  const accounts = (await dbService.getAccounts()).filter((a: any) => !a.deletedAt);
  const transactions = (await dbService.getTransactions()).filter((t: any) => !t.deletedAt);
  const sumByAcc = new Map<string, number>();
  for (const t of transactions as any[]) sumByAcc.set(t.accountId, (sumByAcc.get(t.accountId) || 0) + (t.type === 'INCOME' ? 1 : -1) * kurus(t.amount));
  const badAcc = (accounts as any[]).filter(a => Math.abs(kurus(a.balance) - (sumByAcc.get(a.id) || 0)) >= 1);
  if (badAcc.length) {
    if (repair) await dbService.reconcileAccountBalances();
    issues.push({
      code: 'ACCOUNT_MISMATCH', count: badAcc.length, repaired: repair,
      title: 'Kasa / banka bakiyesi hareketlerle uyuşmuyordu',
      detail: `${names(badAcc.map(a => `${a.name} (${(Math.abs(kurus(a.balance) - (sumByAcc.get(a.id) || 0)) / 100).toFixed(2)} fark)`))}. ${repair ? 'Bakiye hareketlerden yeniden hesaplandı.' : ''}`
    });
  }

  // 4) Peşin satış kasaya işlenmiş mi? (kullanıcı hareketi bilerek silmiş olabilir: karar sunulur)
  const txByRelated = new Set((transactions as any[]).map(t => t.relatedId).filter(Boolean));
  const cashNoKasa = prescriptions.filter(p => p.isProcessed !== false && p.priceType === 'CASH' && Math.abs(kurus(p.totalAmount)) > 0 && !txByRelated.has(p.id));
  if (cashNoKasa.length) {
    issues.push({
      code: 'CASH_SALE_NO_KASA', count: cashNoKasa.length, repaired: false,
      title: 'Peşin satış kasada görünmüyor',
      detail: `${names(cashNoKasa.map(p => p.prescriptionNo || p.id))}. Bu satışların kasa hareketi yok; kasada açık oluşturur. Aşağıdan tek tıkla kasaya işleyebilir veya vadeliye çevirebilirsiniz.`
    });
  }

  // 5) Stok = alımlar − satışlar + düzeltmeler mi?
  const inventory = (await dbService.getInventory()).filter((i: any) => !i.deletedAt);
  try {
    const mismatches = await dbService.analyzeInventoryBalances();
    if (mismatches.length) {
      issues.push({
        code: 'STOCK_MISMATCH', count: mismatches.length, repaired: false,
        title: 'Depodaki miktar kayıtlarla uyuşmuyor',
        detail: `${names(mismatches.map((m: any) => `${m.pesticideName} (depo ${m.currentQty}, kayıtlara göre ${m.calculatedQty})`))}. Kayıtları veya raftaki mevcut sayımı esas alarak senkronize edebilirsiniz.`
      });
    }
  } catch (e) { console.error('integrity: analyzeInventoryBalances', e); }

  // 6) Eksi stok
  const negative = (inventory as any[]).filter(i => (Number(i.quantity) || 0) < -0.001);
  if (negative.length) {
    issues.push({
      code: 'NEGATIVE_STOCK', count: negative.length, repaired: false,
      title: 'Eksi stok',
      detail: `${names(negative.map(i => `${i.pesticideName} (${i.quantity})`))}. Girilmemiş bir alım ya da fazla satış olabilir.`
    });
  }

  // Eksi stok bilgi amaçlıdır (alım girmeden satış yapan işletmelerde olağan): raporda görünür, uyarı sayısına girmez
  const open = issues.filter(i => !i.repaired && i.code !== 'NEGATIVE_STOCK').length;
  const report: IntegrityReport = { ranAt: new Date().toISOString(), ok: open === 0, issues, open, repaired: issues.filter(i => i.repaired).length };
  try { localStorage.setItem(REPORT_KEY, JSON.stringify(report)); } catch { /* yok say */ }
  return report;
}

export async function repairStockMismatchesFromIntegrity(mode: 'USE_LEDGER' | 'KEEP_SHELF'): Promise<number> {
  if (mode === 'USE_LEDGER') {
    const res = await dbService.rebuildInventoryBalances();
    return res.updatedCount + res.deduplicatedCount;
  }
  return await dbService.preserveInventoryCurrentQuantities();
}

export async function repairCashSalesWithoutKasa(mode: 'CONVERT_TO_CREDIT' | 'CREATE_CASH_TX'): Promise<number> {
  const [prescriptions, transactions, accounts, farmers] = await Promise.all([
    dbService.getAllPrescriptionsRaw(),
    dbService.getTransactions(),
    dbService.getAccounts(),
    dbService.getFarmers()
  ]);

  const txByRelated = new Set(transactions.filter(t => !t.deletedAt && t.relatedId).map(t => t.relatedId!));
  const cashNoKasa = prescriptions.filter(
    p => !p.deletedAt && p.isProcessed !== false && p.priceType === 'CASH' && Math.abs(kurus(p.totalAmount)) > 0 && !txByRelated.has(p.id)
  );
  if (cashNoKasa.length === 0) return 0;

  const nowIso = new Date().toISOString();

  if (mode === 'CONVERT_TO_CREDIT') {
    let fixed = 0;
    for (const p of cashNoKasa) {
      await dbService.updatePrescription({
        ...p,
        priceType: 'TERM',
        lastUpdated: nowIso
      });
      fixed++;
    }
    return fixed;
  }

  const activeAccounts = accounts.filter(a => !a.deletedAt);
  let fallbackAccount = activeAccounts.find(a => a.type === 'CASH') || activeAccounts[0];
  if (!fallbackAccount) {
    const newId = generateUUID();
    const createdAcc = {
      id: newId,
      name: 'Ana Kasa (Nakit)',
      type: 'CASH' as const,
      balance: 0,
      currency: 'TRY'
    };
    await dbService.addAccount(createdAcc);
    fallbackAccount = createdAcc;
  }

  const farmerMap = new Map(farmers.map(f => [f.id, f.fullName]));
  let createdCount = 0;

  for (const p of cashNoKasa) {
    const matchedAcc = (p.accountId && activeAccounts.find(a => a.id === p.accountId)) || fallbackAccount;
    const isReturn = p.type === 'RETURN' || Number(p.totalAmount) < 0;
    const amount = round2(Math.abs(Number(p.totalAmount) || 0));
    if (amount <= 0) continue;

    await dbService.addTransaction({
      id: generateUUID(),
      accountId: matchedAcc.id,
      type: isReturn ? 'EXPENSE' : 'INCOME',
      amount,
      date: p.date || nowIso,
      description: isReturn ? 'Peşin İade Kasadan Çıkış' : 'Peşin Satış Tahsilatı',
      category: 'Satış/İade',
      relatedId: p.id,
      partyName: farmerMap.get(p.farmerId),
      partyType: 'FARMER',
      partyId: p.farmerId
    });
    createdCount++;
  }

  await dbService.reconcileAccountBalances();
  return createdCount;
}

export async function repairNegativeStocksToZero(): Promise<number> {
  const inventory = await dbService.getInventory();
  const negative = inventory.filter(i => !i.deletedAt && (Number(i.quantity) || 0) < -0.001);
  if (negative.length === 0) return 0;

  const nowIso = new Date().toISOString();
  let fixed = 0;
  for (const item of negative) {
    const absDeficit = round2(Math.abs(Number(item.quantity) || 0));
    if (absDeficit <= 0) continue;
    await dbService.updateInventoryItem({
      ...item,
      quantity: 0,
      batches: undefined,
      adjustments: [
        ...(item.adjustments || []),
        {
          date: nowIso,
          amount: absDeficit,
          note: 'Eksi Stok Sıfırlama Düzeltmesi'
        }
      ],
      lastUpdated: nowIso
    });
    fixed++;
  }
  return fixed;
}

export const getLastIntegrityReport = (): IntegrityReport | null => {
  try { return JSON.parse(localStorage.getItem(REPORT_KEY) || 'null'); } catch { return null; }
};

/**
 * Açılıştan kısa süre sonra arka planda denetler (aynı hesapta 12 saatte bir).
 * Açık konu kalırsa bildirim kutusuna uyarı yazar ve onReport ile haber verir. İptal fonksiyonu döner.
 */
export function scheduleIntegrityCheck(userKey: string, onReport?: (r: IntegrityReport) => void): () => void {
  const stampKey = `mks_integrity_last_${userKey}`;
  const timer = window.setTimeout(async () => {
    try {
      if (Date.now() - Number(localStorage.getItem(stampKey) || 0) < 12 * 3600 * 1000) return;
      const report = await runIntegrityCheck(true);
      localStorage.setItem(stampKey, String(Date.now()));
      const day = getLocalDateString(report.ranAt);
      if (report.open > 0) {
        await dbService.addNotification({
          id: `integrity-${day}`, type: 'WARNING', isRead: false, date: report.ranAt,
          title: 'Veri sağlığı uyarısı',
          message: report.issues.filter(i => !i.repaired && i.code !== 'NEGATIVE_STOCK').map(i => `${i.title} (${i.count})`).join(' · ') + ' — Ayarlar → Veri Sağlığı Denetimi'
        });
      }
      if (report.repaired > 0) {
        await dbService.addNotification({
          id: `integrity-fix-${day}`, type: 'INFO', isRead: false, date: report.ranAt,
          title: 'Yarım kalan kayıtlar tamamlandı',
          message: report.issues.filter(i => i.repaired).map(i => `${i.title} (${i.count})`).join(' · ')
        });
      }
      if (report.issues.length) onReport?.(report);
    } catch (e) { console.error('integrity check failed', e); }
  }, 20000);
  return () => window.clearTimeout(timer);
}

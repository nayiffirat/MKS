import {
  Prescription,
  ManualDebt,
  Payment,
  MyPayment,
  SupplierPurchase,
  SupplierPayment
} from '../types';

/**
 * Yıl sonu devir (`turnover-`) kayıtları tüm yılları kapsayan genel bakiyelerde
 * reçeteler ve ödemeler zaten toplandığı için çift sayımı önlemek adına filtrelenir.
 */
export const isTurnoverDebtRecord = (id?: string): boolean =>
  Boolean(id && String(id).startsWith('turnover-'));

/**
 * Bir reçetenin/satışın cari borca olan net etkisini döndürür.
 * - Peşin (`CASH`) satışlar cari borç oluşturmaz (`0`).
 * - İade (`RETURN`) veya negatif tutarlı belgeler borçtan düşer (`-Math.abs(amt)`).
 */
export const getPrescriptionCreditImpact = (
  p: Pick<Prescription, 'totalAmount' | 'type' | 'priceType' | 'deletedAt'>
): number => {
  if (p.deletedAt || p.priceType === 'CASH') return 0;
  const amt = Number(p.totalAmount) || 0;
  const isReturn = p.type === 'RETURN' || amt < 0;
  return isReturn ? -Math.abs(amt) : Math.abs(amt);
};

/**
 * Karşılıksız / Protestolu (`BOUNCED`) veya iptal edilmiş (`CANCELLED`) çek/senetlerin
 * `payments` tablosundaki ilişkili (`relatedId`) tahsilat kimliklerini döndürür.
 */
export const getBouncedRelatedPaymentIds = (myPayments: MyPayment[] = []): Set<string> => {
  const ids = new Set<string>();
  for (const mp of myPayments) {
    if (!mp.deletedAt && mp.relatedId && (mp.portfolioStatus === 'BOUNCED' || mp.status === 'CANCELLED')) {
      ids.add(mp.relatedId);
    }
  }
  return ids;
};

/**
 * `payments` tablosuna `relatedId` ile bağlı olmayan (doğrudan `myPayments` içinden girilmiş)
 * aktif çiftçi çek/senet/tedye kayıtlarını `Payment` uyumlu biçimde döndürür.
 * Karşılıksız (`BOUNCED`) veya iptal (`CANCELLED`) kayıtlar ödenen tutara dahil edilmez.
 */
export const getIndependentFarmerMyPayments = (
  myPayments: MyPayment[],
  farmerId?: string
): Payment[] => {
  return myPayments
    .filter(
      p =>
        !p.deletedAt &&
        p.status !== 'CANCELLED' &&
        p.portfolioStatus !== 'BOUNCED' &&
        !p.relatedId &&
        Boolean(p.farmerId) &&
        (!farmerId || p.farmerId === farmerId)
    )
    .map(p => ({
      id: p.id,
      farmerId: p.farmerId!,
      amount: Number(p.amount) || 0,
      date: p.issueDate,
      method: (p.type === 'CHECK' ? 'CHECK' : 'PROMISSORY') as Payment['method'],
      note: p.note
    }));
};

export interface FarmerLedgerTotals {
  totalPrescriptionDebt: number;
  totalManualDebt: number;
  totalDebt: number;
  totalPaid: number;
  /** Pozitif ise çiftçinin kalan borcu, negatif ise alacağı (bakiye = borç - ödenen) */
  netDebt: number;
  /** Farmers / AppContext uyumlu işaretli bakiye (`totalPaid - totalDebt`: negatifse borçlu) */
  signedBalance: number;
}

/**
 * Tek bir çiftçi için tüm MKS ekranlarında (%100 birebir aynı çalışan) cari bakiye özeti.
 */
export const computeFarmerLedgerTotals = (params: {
  farmerId?: string;
  prescriptions: Prescription[];
  manualDebts: ManualDebt[];
  payments: Payment[];
  myPayments?: MyPayment[];
}): FarmerLedgerTotals => {
  const { farmerId, prescriptions, manualDebts, payments, myPayments = [] } = params;
  const bouncedRelatedIds = getBouncedRelatedPaymentIds(myPayments);

  const totalPrescriptionDebt = prescriptions
    .filter(p => !p.deletedAt && (!farmerId || p.farmerId === farmerId))
    .reduce((sum, p) => sum + getPrescriptionCreditImpact(p), 0);

  const totalManualDebt = manualDebts
    .filter(
      d =>
        !d.deletedAt &&
        !isTurnoverDebtRecord(d.id) &&
        (!farmerId || d.farmerId === farmerId)
    )
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const regularPaid = payments
    .filter(p => !p.deletedAt && !bouncedRelatedIds.has(p.id) && (!farmerId || p.farmerId === farmerId))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const independentMyPaid = myPayments
    .filter(
      p =>
        !p.deletedAt &&
        p.status !== 'CANCELLED' &&
        p.portfolioStatus !== 'BOUNCED' &&
        !p.relatedId &&
        Boolean(p.farmerId) &&
        (!farmerId || p.farmerId === farmerId)
    )
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalDebt = Math.round((totalPrescriptionDebt + totalManualDebt + Number.EPSILON) * 100) / 100;
  const totalPaid = Math.round((regularPaid + independentMyPaid + Number.EPSILON) * 100) / 100;
  const netDebt = Math.round(((totalDebt - totalPaid) + Number.EPSILON) * 100) / 100;
  const signedBalance = Math.round(((totalPaid - totalDebt) + Number.EPSILON) * 100) / 100;

  return {
    totalPrescriptionDebt,
    totalManualDebt,
    totalDebt,
    totalPaid,
    netDebt,
    signedBalance
  };
};

/**
 * FIFO (İlk Giren İlk Çıkar) yöntemiyle çiftçinin ÖDENMEMİŞ en eski borcunun gün yaşını hesaplar.
 * Yapılan toplam tahsilatlar + iadeler kronolojik olarak en eski vadeli borçları kapatır;
 * dolayısıyla geçmiş borçlarını kapatmış düzenli müşteriler eski yıllardaki faturalar yüzünden cezalandırılmaz.
 */
export const computeFifoUnpaidDebtAgeDays = (params: {
  farmerId: string;
  prescriptions: Prescription[];
  manualDebts: ManualDebt[];
  payments: Payment[];
  myPayments?: MyPayment[];
  nowMs?: number;
}): number => {
  const { farmerId, prescriptions, manualDebts, payments, myPayments = [], nowMs = Date.now() } = params;
  const totals = computeFarmerLedgerTotals({ farmerId, prescriptions, manualDebts, payments, myPayments });
  if (totals.netDebt <= 50) return 0;

  const debtEntries: { dateMs: number; amount: number }[] = [];
  let returnCredits = 0;

  for (const p of prescriptions) {
    if (p.deletedAt || p.farmerId !== farmerId || p.priceType === 'CASH') continue;
    const impact = getPrescriptionCreditImpact(p);
    if (impact > 0) {
      const ms = new Date(p.date).getTime();
      debtEntries.push({ dateMs: Number.isFinite(ms) ? ms : nowMs, amount: impact });
    } else if (impact < 0) {
      returnCredits += Math.abs(impact);
    }
  }

  for (const d of manualDebts) {
    if (d.deletedAt || isTurnoverDebtRecord(d.id) || d.farmerId !== farmerId) continue;
    const amt = Number(d.amount) || 0;
    if (amt > 0) {
      const ms = new Date(d.date).getTime();
      debtEntries.push({ dateMs: Number.isFinite(ms) ? ms : nowMs, amount: amt });
    } else if (amt < 0) {
      returnCredits += Math.abs(amt);
    }
  }

  debtEntries.sort((a, b) => a.dateMs - b.dateMs);

  let remainingPaidPool = totals.totalPaid + returnCredits;
  for (const entry of debtEntries) {
    if (remainingPaidPool >= entry.amount - 0.01) {
      remainingPaidPool -= entry.amount;
    } else {
      return Math.max(0, Math.floor((nowMs - entry.dateMs) / 86400000));
    }
  }

  return 0;
};

export interface SupplierLedgerTotals {
  totalPurchased: number;
  totalPaid: number;
  /** Negatif ise tedarikçiye kalan borcumuz (`totalPaid - totalPurchased`) */
  signedBalance: number;
}

/**
 * Tek bir tedarikçi için tüm MKS ekranlarında birebir aynı çalışan cari bakiye özeti.
 */
export const computeSupplierLedgerTotals = (params: {
  supplierId: string;
  purchases: SupplierPurchase[];
  supplierPayments: SupplierPayment[];
  myPayments?: MyPayment[];
}): SupplierLedgerTotals => {
  const { supplierId, purchases, supplierPayments, myPayments = [] } = params;

  const totalPurchased = purchases
    .filter(p => !p.deletedAt && p.supplierId === supplierId)
    .reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);

  const directPaid = supplierPayments
    .filter(p => !p.deletedAt && p.supplierId === supplierId)
    .reduce((sum, p) => {
      const amt = Number(p.amount) || 0;
      return p.type === 'RECEIVE' ? sum - amt : sum + amt;
    }, 0);

  const independentMyPaid = myPayments
    .filter(
      mp =>
        !mp.deletedAt &&
        mp.status !== 'CANCELLED' &&
        !mp.relatedId &&
        mp.supplierId === supplierId
    )
    .reduce((sum, mp) => sum + (Number(mp.amount) || 0), 0);

  const totalPaid = Math.round((directPaid + independentMyPaid + Number.EPSILON) * 100) / 100;
  const signedBalance = Math.round(((totalPaid - totalPurchased) + Number.EPSILON) * 100) / 100;

  return {
    totalPurchased: Math.round((totalPurchased + Number.EPSILON) * 100) / 100,
    totalPaid,
    signedBalance
  };
};

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { dbService } from '../services/db';
import {
  Account,
  CollectionLog,
  Expense,
  Farmer,
  InventoryItem,
  ManualDebt,
  Message,
  MyPayment,
  Payment,
  Prescription,
  Reminder,
  Supplier,
  SupplierPayment,
  SupplierPurchase,
  TeamMember,
  Transaction,
  VisitLog
} from '../types';
import { getPrescriptionCreditImpact, isTurnoverDebtRecord } from '../utils/ledger';
import {
  hashReminderNumericId,
  scheduleDailyBriefing,
  scheduleReminderNotification
} from './weatherNotifications';

let isCreatingDefaultAccount = false;

export interface DashboardStats {
  totalFarmers: number;
  todayPrescriptions: number;
  pendingVisits: number;
  activeReminders: number;
  tomorrowReminders: number;
  totalArea: number;
  totalSales: number;
  cropDistribution: { crop: string; area: number }[];
  inventoryValue: number;
  potentialRevenue: number;
  cashInventoryValue: number;
  cashPotentialRevenue: number;
  totalDebt: number;
  totalExpenses: number;
  regionalAlerts: { type: string; village: string; severity: string; count: number }[];
  cashBalance?: number;
  bankBalance?: number;
  totalPendingPayables?: number;
  totalPendingReceivables?: number;
}

export interface FullAppSnapshot {
  stats: DashboardStats;
  reminders: Reminder[];
  farmers: Farmer[];
  trashedFarmers: Farmer[];
  visits: VisitLog[];
  trashedVisits: VisitLog[];
  inventory: InventoryItem[];
  prescriptions: Prescription[];
  trashedPrescriptions: Prescription[];
  supplierPurchases: SupplierPurchase[];
  trashedSupplierPurchases: SupplierPurchase[];
  trashedSupplierPayments: SupplierPayment[];
  payments: Payment[];
  trashedPayments: Payment[];
  manualDebts: ManualDebt[];
  trashedManualDebts: ManualDebt[];
  expenses: Expense[];
  trashedExpenses: Expense[];
  suppliers: Supplier[];
  trashedSuppliers: Supplier[];
  myPayments: MyPayment[];
  trashedMyPayments: MyPayment[];
  teamMembers: TeamMember[];
  messages: Message[];
  collectionLogs: CollectionLog[];
  accounts: Account[];
  transactions: Transaction[];
}

export async function computeFullAppSnapshot(syncedReminders?: Reminder[]): Promise<FullAppSnapshot> {
  const now = new Date();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

  const [
    allPrescriptionsRaw,
    rawFarmerList,
    rawVisitList,
    reminderListFromDB,
    inventoryData,
    rawPaymentList,
    rawManualDebtList,
    rawSupplierList,
    myPaymentList,
    rawExpenseList,
    teamMemberList,
    messageList,
    collectionLogList
  ] = await Promise.all([
    dbService.getAllPrescriptions(),
    dbService.getFarmers(),
    dbService.getAllVisits(),
    dbService.getReminders(),
    dbService.getInventory(),
    dbService.getPayments(),
    dbService.getManualDebts(),
    dbService.getSuppliers(),
    dbService.getMyPayments(),
    dbService.getExpenses(),
    dbService.getTeamMembers(),
    dbService.getMessages(),
    dbService.getCollectionLogs()
  ]);

  // --- AUTO UNBLOCK EXPIRED CARD PAYMENTS ---
  const todayLocalYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const accountsListForUnblock = await dbService.getAccounts();
  const activeAccountsForUnblock = accountsListForUnblock.filter(a => !a.deletedAt);
  const defaultBankAcc =
    activeAccountsForUnblock.find(a => a.type === 'BANK') || activeAccountsForUnblock[0];
  let cachedTransactionsForUnblock: Awaited<ReturnType<typeof dbService.getTransactions>> | null = null;

  for (const p of myPaymentList) {
    if (p.deletedAt) continue;
    const isCustomerIncomingPos =
      !p.supplierId &&
      p.portfolioStatus !== 'ISSUED' &&
      p.drawerName !== 'BİZ (Kendi Ödememiz)' &&
      p.issuerName !== 'BİZ (Kendi Ödememiz)' &&
      (p.type === 'DEFERRED_CARD' || Boolean(p.cardOption));
    if (isCustomerIncomingPos && p.status === 'PENDING') {
      const dueDateStr = (p.unblockDate || p.dueDate || '').split('T')[0];
      if (dueDateStr && todayLocalYmd >= dueDateStr) {
        try {
          p.status = 'PAID';
          p.autoCollected = true;
          await dbService.updateMyPayment(p);

          const accId = p.accountId || defaultBankAcc?.id;
          if (accId) {
            if (!cachedTransactionsForUnblock) {
              cachedTransactionsForUnblock = await dbService.getTransactions();
            }
            const existingTx = cachedTransactionsForUnblock.find(t => !t.deletedAt && t.relatedId === p.id);
            if (!existingTx) {
              const name = p.farmerName || 'Müşteri';
              const newTx = {
                id: crypto.randomUUID(),
                accountId: accId,
                type: 'INCOME' as const,
                amount: p.amount,
                date: now.toISOString(),
                description: `${name} - Kredi Kartı Blokesi Kalktı (Otomatik Hesaba Aktarıldı)`,
                relatedId: p.id,
                category: 'Kredi Kartı Bloke Tahsilatı'
              };
              await dbService.addTransaction(newTx);
              cachedTransactionsForUnblock.push(newTx as any);
            }
          }

          if (p.relatedId) {
            const origP = rawPaymentList.find(orig => orig.id === p.relatedId);
            if (origP) {
              await dbService.updatePayment({ ...origP, isUnblocked: true });
            }
          }
        } catch (cardErr) {
          console.warn('Auto card unblock skipped:', cardErr);
        }
      }
    }
  }

  // --- PRESCRIPTIONS FILTERING & AUTO-DELETE ---
  const prescriptions: Prescription[] = [];
  const trashedPrescriptions: Prescription[] = [];

  for (const p of allPrescriptionsRaw) {
    if (p.deletedAt) {
      const deletedTime = new Date(p.deletedAt).getTime();
      if (now.getTime() - deletedTime > thirtyDaysInMs) {
        dbService.deletePrescription(p.id).catch(() => {});
      } else {
        trashedPrescriptions.push(p);
      }
    } else {
      prescriptions.push(p);
    }
  }

  const [allPurchasesRaw, allPaymentsRaw, allTransactionsRaw] = await Promise.all([
    dbService.getSupplierPurchases(),
    dbService.getSupplierPayments(),
    dbService.getTransactions()
  ]);

  const flatPurchases = allPurchasesRaw.filter(p => !p.deletedAt);
  const flatPayments = allPaymentsRaw.filter(p => !p.deletedAt);

  const farmerList = rawFarmerList.filter(f => !f.deletedAt);
  const trashedF = rawFarmerList.filter(f => f.deletedAt);
  const visitList = rawVisitList.filter(v => !v.deletedAt);
  const trashedV = rawVisitList.filter(v => v.deletedAt);
  const paymentList = rawPaymentList.filter(p => !p.deletedAt);
  const trashedP = rawPaymentList.filter(p => p.deletedAt);
  const manualDebtList = rawManualDebtList.filter(d => !d.deletedAt);
  const trashedMD = rawManualDebtList.filter(d => d.deletedAt);
  const expenseList = rawExpenseList.filter(e => !e.deletedAt);
  const trashedE = rawExpenseList.filter(e => e.deletedAt);
  const supplierList = rawSupplierList.filter(s => !s.deletedAt);
  const trashedS = rawSupplierList.filter(s => s.deletedAt);
  const trashedSPurchases = allPurchasesRaw.filter(p => p.deletedAt);
  const trashedSPayments = allPaymentsRaw.filter(p => p.deletedAt);
  const trashedMyPayments = myPaymentList.filter(p => p.deletedAt);
  const trashedTransactions = allTransactionsRaw.filter(tx => tx.deletedAt);

  // 30-day trash auto-purge in background
  const deletePromises: Promise<any>[] = [];
  const collectOld = <T extends { id: string; deletedAt?: string }>(
    arr: T[],
    fn: (id: string) => Promise<any>
  ) => {
    const kept: T[] = [];
    for (const item of arr) {
      if (item.deletedAt && now.getTime() - new Date(item.deletedAt).getTime() > thirtyDaysInMs) {
        deletePromises.push(fn(item.id));
      } else {
        kept.push(item);
      }
    }
    return kept;
  };

  const keptTrashedFarmers = collectOld(trashedF, id => dbService.deleteFarmer(id));
  const keptTrashedVisits = collectOld(trashedV, id => dbService.deleteVisit(id));
  const keptTrashedPayments = collectOld(trashedP, id => dbService.deletePayment(id));
  const keptTrashedSuppliers = collectOld(trashedS, id => dbService.deleteSupplier(id));
  const keptTrashedManualDebts = collectOld(trashedMD, id => dbService.deleteManualDebt(id));
  const keptTrashedExpenses = collectOld(trashedE, id => dbService.deleteExpense(id));
  const keptTrashedSPurchases = collectOld(trashedSPurchases, id => dbService.deleteSupplierPurchase(id));
  const keptTrashedSPayments = collectOld(trashedSPayments, id => dbService.deleteSupplierPayment(id));
  const keptTrashedMyPayments = collectOld(trashedMyPayments, id => dbService.deleteMyPayment(id));
  collectOld(trashedTransactions, id => dbService.deleteTransaction(id));

  if (deletePromises.length > 0) {
    Promise.allSettled(deletePromises).catch(err => console.warn('Background cleanup failed:', err));
  }

  const finalReminders = [...(syncedReminders || reminderListFromDB)];

  // --- SUPPLIER BALANCES ---
  const updatedSupplierList = supplierList.map(s => {
    const purchasesForSupplier = flatPurchases.filter(p => p.supplierId === s.id);
    const paymentsForSupplier = flatPayments.filter(p => p.supplierId === s.id);
    const checks = myPaymentList.filter(
      p => p.supplierId === s.id && !p.deletedAt && p.status !== 'CANCELLED' && !p.relatedId
    );

    const totalPurchased = purchasesForSupplier.reduce((acc, p) => {
      const amt = Math.abs(Number(p.totalAmount) || 0);
      const isReturnOrSale =
        p.type === 'RETURN' ||
        p.type === 'SALE' ||
        p.note?.includes('SATIŞ') ||
        p.note?.includes('İADE') ||
        (p.totalAmount !== undefined && Number(p.totalAmount) < 0);
      return acc + (isReturnOrSale ? -amt : amt);
    }, 0);

    const totalPaid =
      paymentsForSupplier.reduce((acc, p) => {
        const amt = Number(p.amount) || 0;
        return acc + (p.type === 'RECEIVE' ? -amt : amt);
      }, 0) + checks.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    return {
      ...s,
      totalDebt: purchasesForSupplier
        .filter(p => {
          const isReturnOrSale =
            p.type === 'RETURN' ||
            p.type === 'SALE' ||
            p.note?.includes('SATIŞ') ||
            p.note?.includes('İADE') ||
            (p.totalAmount !== undefined && Number(p.totalAmount) < 0);
          return !isReturnOrSale;
        })
        .reduce((acc, p) => acc + (Math.abs(Number(p.totalAmount)) || 0), 0),
      balance: Math.round(((totalPaid || 0) - (totalPurchased || 0) + Number.EPSILON) * 100) / 100
    };
  });

  // --- SMART CROP CALENDAR REMINDERS ---
  const todayStr = now.toISOString().split('T')[0];
  farmerList.forEach(farmer => {
    (farmer.fields || []).forEach(field => {
      if (field.crop && field.plantingDate) {
        const pDate = new Date(field.plantingDate);
        const diffDays = Math.floor((now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
        const cropLower = field.crop.toLocaleLowerCase('tr-TR');

        let title = '';
        let description = '';

        if (cropLower.includes('pamuk')) {
          if (diffDays >= 20 && diffDays <= 25) {
            title = `${farmer.fullName} - Pamuk Üst Gübreleme`;
            description = `${field.name} tarlasında pamuk 4-6 yaprak evresinde. Üst gübreleme zamanı.`;
          } else if (diffDays >= 60 && diffDays <= 65) {
            title = `${farmer.fullName} - Pamuk Zararlı Kontrolü`;
            description = `${field.name} tarlasında pamuk taraklanma döneminde. Yeşil kurt ve emici böcek kontrolü yapılmalı.`;
          }
        } else if (cropLower.includes('mısır')) {
          if (diffDays >= 30 && diffDays <= 35) {
            title = `${farmer.fullName} - Mısır Üst Gübreleme`;
            description = `${field.name} tarlasında mısır diz boyu seviyesinde. Üst gübreleme ve boğaz doldurma zamanı.`;
          }
        } else if (cropLower.includes('buğday')) {
          if (diffDays >= 45 && diffDays <= 55) {
            title = `${farmer.fullName} - Buğday Ot İlacı`;
            description = `${field.name} tarlasında buğday kardeşlenme sonunda. Yabancı ot mücadelesi için uygun dönem.`;
          }
        }

        if (title && !finalReminders.find(r => r.title === title)) {
          finalReminders.push({
            id: `auto-${crypto.randomUUID()}`,
            title,
            description,
            date: todayStr,
            isCompleted: false,
            priority: 'MEDIUM',
            recurrence: 'NONE'
          });
        }
      }
    });
  });

  // --- REGIONAL PEST ALERTS ---
  const alerts: Record<string, { type: string; village: string; severity: string; count: number }> = {};
  visitList.forEach(v => {
    if ((v.pestFound || v.diseaseFound) && v.severity === 'HIGH') {
      const key = `${v.pestFound || v.diseaseFound}-${v.village || 'Bilinmeyen'}`;
      if (!alerts[key]) {
        alerts[key] = {
          type: v.pestFound || v.diseaseFound || 'Bilinmeyen',
          village: v.village || 'Bilinmeyen',
          severity: 'HIGH',
          count: 0
        };
      }
      alerts[key].count++;
    }
  });
  const regionalAlerts = Object.values(alerts).filter(a => a.count >= 2);

  // --- FARMER DEBT TRACKING (Unified via utils/ledger.ts rules) ---
  const farmerDebts: Record<string, number> = {};

  prescriptions.forEach(p => {
    if (p.priceType !== 'CASH') {
      const parsedAmt =
        typeof p.totalAmount === 'string'
          ? parseFloat((p.totalAmount as string).replace(',', '.')) || 0
          : Number(p.totalAmount) || 0;
      const netAmt = getPrescriptionCreditImpact({ ...p, totalAmount: parsedAmt });
      farmerDebts[p.farmerId] = Math.round(((farmerDebts[p.farmerId] || 0) + netAmt + Number.EPSILON) * 100) / 100;
    }
  });

  manualDebtList.forEach(d => {
    if (!isTurnoverDebtRecord(d.id)) {
      const amt =
        typeof d.amount === 'string'
          ? parseFloat((d.amount as string).replace(',', '.')) || 0
          : Number(d.amount) || 0;
      farmerDebts[d.farmerId] = Math.round(((farmerDebts[d.farmerId] || 0) + amt + Number.EPSILON) * 100) / 100;
    }
  });

  paymentList.forEach(pay => {
    const amt =
      typeof pay.amount === 'string'
        ? parseFloat((pay.amount as string).replace(',', '.')) || 0
        : Number(pay.amount) || 0;
    farmerDebts[pay.farmerId] = Math.round(((farmerDebts[pay.farmerId] || 0) - amt + Number.EPSILON) * 100) / 100;
  });

  myPaymentList.forEach(pay => {
    if (pay.farmerId && !pay.deletedAt && pay.status !== 'CANCELLED' && !pay.relatedId) {
      const amt =
        typeof pay.amount === 'string'
          ? parseFloat((pay.amount as string).replace(',', '.')) || 0
          : Number(pay.amount) || 0;
      farmerDebts[pay.farmerId] = Math.round(((farmerDebts[pay.farmerId] || 0) - amt + Number.EPSILON) * 100) / 100;
    }
  });

  const updatedFarmerList = farmerList.map(f => ({
    ...f,
    balance: -(Math.round(((farmerDebts[f.id] || 0) + Number.EPSILON) * 100) / 100)
  }));

  const totalDebt =
    Math.round(
      (updatedFarmerList.reduce((acc, f) => {
        const bal = Number(f.balance) || 0;
        return acc + (bal < 0 ? Math.abs(bal) : 0);
      }, 0) +
        Number.EPSILON) *
        100
    ) / 100;

  if (syncedReminders && Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.cancel({
        notifications: syncedReminders.map(r => ({ id: hashReminderNumericId(r.id) }))
      });
      for (const r of syncedReminders) {
        await scheduleReminderNotification(r);
      }
    } catch (notifErr) {
      console.warn('Reminder notification sync skipped:', notifErr);
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const todaysPrescriptionsCount = prescriptions.filter(p => (p.date || '').startsWith(todayStr)).length;
  const tomorrowRemindersCount = finalReminders.filter(r => r.date === tomorrowStr && !r.isCompleted).length;

  if (Capacitor.isNativePlatform()) {
    scheduleDailyBriefing(tomorrowRemindersCount).catch(() => {});
  }

  const distribution: Record<string, number> = {};
  let totalArea = 0;

  updatedFarmerList.forEach(f => {
    (f.fields || []).forEach(field => {
      const area = Number(field.size) || 0;
      const crop = field.crop || 'Belirtilmedi';
      distribution[crop] = (distribution[crop] || 0) + area;
      totalArea += area;
    });
  });

  const totalSales = prescriptions.reduce((acc, p) => {
    const amt = Number(p.totalAmount) || 0;
    const isReturn = p.type === 'RETURN' || amt < 0;
    return acc + (isReturn ? -Math.abs(amt) : Math.abs(amt));
  }, 0);

  const totalExpenses = expenseList.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const inventoryValue = inventoryData.reduce(
    (acc, item) => acc + (Number(item.buyingPrice) || 0) * (Number(item.quantity) || 0),
    0
  );
  const potentialRevenue = inventoryData.reduce(
    (acc, item) => acc + (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 0),
    0
  );
  const cashInventoryValue = inventoryData.reduce(
    (acc, item) => acc + (Number(item.cashBuyingPrice) || 0) * (Number(item.quantity) || 0),
    0
  );
  const cashPotentialRevenue = inventoryData.reduce(
    (acc, item) => acc + (Number(item.cashPrice) || 0) * (Number(item.quantity) || 0),
    0
  );

  const cropDistribution = Object.entries(distribution)
    .map(([crop, area]) => ({ crop, area }))
    .sort((a, b) => b.area - a.area);

  // Reconcile accounts & default Nakit Kasam
  await dbService.reconcileAccountBalances();
  let accountList = await dbService.getAccounts();

  const nakitKasamAccounts = accountList.filter(a => a.name === 'Nakit Kasam');
  if (nakitKasamAccounts.length > 1) {
    for (let i = 1; i < nakitKasamAccounts.length; i++) {
      if (nakitKasamAccounts[i].balance === 0) {
        try {
          await dbService.deleteAccount(nakitKasamAccounts[i].id);
          accountList = accountList.filter(a => a.id !== nakitKasamAccounts[i].id);
        } catch {}
      }
    }
  }

  if (accountList.length === 0 && !isCreatingDefaultAccount) {
    isCreatingDefaultAccount = true;
    try {
      const currentAccounts = await dbService.getAccounts();
      if (currentAccounts.length === 0) {
        const defaultAccount: Account = {
          id: crypto.randomUUID(),
          name: 'Nakit Kasam',
          type: 'CASH',
          balance: 0,
          bankLogo: '💸'
        };
        try {
          await dbService.addAccount(defaultAccount);
        } catch {}
        accountList = [defaultAccount];
      } else {
        accountList = currentAccounts;
      }
    } finally {
      isCreatingDefaultAccount = false;
    }
  }

  const transactionList = (await dbService.getTransactions()).filter(tx => !tx.deletedAt);
  const activeMyPayments = myPaymentList.filter(p => !p.deletedAt);

  const cashBalance = accountList.filter(a => a.type === 'CASH').reduce((acc, a) => acc + a.balance, 0);
  const bankBalance = accountList.filter(a => a.type === 'BANK').reduce((acc, a) => acc + a.balance, 0);

  const totalPendingPayables = activeMyPayments
    .filter(p => (p.supplierId || p.supplierName) && p.status === 'PENDING')
    .reduce((acc, p) => acc + p.amount, 0);
  const totalPendingReceivables = activeMyPayments
    .filter(p => (p.farmerId || p.farmerName) && p.status === 'PENDING')
    .reduce((acc, p) => acc + p.amount, 0);

  return {
    stats: {
      totalFarmers: updatedFarmerList.length,
      todayPrescriptions: todaysPrescriptionsCount,
      pendingVisits: visitList.length,
      activeReminders: finalReminders.filter(r => !r.isCompleted).length,
      tomorrowReminders: tomorrowRemindersCount,
      totalArea,
      totalSales,
      cropDistribution,
      inventoryValue,
      potentialRevenue,
      cashInventoryValue,
      cashPotentialRevenue,
      totalDebt,
      totalExpenses,
      regionalAlerts,
      cashBalance,
      bankBalance,
      totalPendingPayables,
      totalPendingReceivables
    },
    reminders: finalReminders,
    farmers: updatedFarmerList,
    trashedFarmers: keptTrashedFarmers,
    visits: visitList,
    trashedVisits: keptTrashedVisits,
    inventory: inventoryData,
    prescriptions,
    trashedPrescriptions,
    supplierPurchases: flatPurchases,
    trashedSupplierPurchases: keptTrashedSPurchases,
    trashedSupplierPayments: keptTrashedSPayments,
    payments: paymentList,
    trashedPayments: keptTrashedPayments,
    manualDebts: manualDebtList,
    trashedManualDebts: keptTrashedManualDebts,
    expenses: expenseList,
    trashedExpenses: keptTrashedExpenses,
    suppliers: updatedSupplierList,
    trashedSuppliers: keptTrashedSuppliers,
    myPayments: myPaymentList,
    trashedMyPayments: keptTrashedMyPayments,
    teamMembers: teamMemberList,
    messages: messageList,
    collectionLogs: collectionLogList,
    accounts: accountList,
    transactions: transactionList
  };
}

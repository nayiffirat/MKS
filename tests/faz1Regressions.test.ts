import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrDecimal, round2 } from '../utils/currency';
import { safeJsonParse } from '../utils/json';
import { escapeHtml } from '../utils/html';
import { computeFarmerLedgerTotals, computeSupplierLedgerTotals } from '../utils/ledger';
import { MyPayment, Payment, Prescription, SupplierPayment, SupplierPurchase } from '../types';
import { dbService, isSubscriptionBlocked, setActionBlocked, setActionBlockedCallback } from '../services/db';

test('parseTrDecimal — Turkish & international formats and invalid edge cases', () => {
  assert.equal(parseTrDecimal('1250,50'), 1250.5);
  assert.equal(parseTrDecimal('1.250,50'), 1250.5);
  assert.equal(parseTrDecimal('1,250.50'), 1250.5);
  assert.equal(parseTrDecimal('1250.50'), 1250.5);
  assert.equal(parseTrDecimal('1.234.567,89'), 1234567.89);
  assert.equal(parseTrDecimal('-1.250,50'), -1250.5);
  assert.equal(parseTrDecimal(' 42,75 ₺ '), 42.75);
  assert.equal(parseTrDecimal(0), 0);
  assert.equal(parseTrDecimal('0'), 0);
  assert.equal(parseTrDecimal(''), 0);
  assert.equal(parseTrDecimal(null), 0);
  assert.equal(parseTrDecimal(undefined), 0);
  assert.equal(parseTrDecimal('abc'), 0);
  assert.equal(parseTrDecimal(NaN), 0);
  assert.equal(parseTrDecimal(Infinity), 0);
  assert.equal(round2(1250.504), 1250.5);
  assert.equal(round2(1250.505), 1250.51);
});

test('safeJsonParse — corrupted or missing JSON falls back cleanly without throwing', () => {
  assert.deepEqual(safeJsonParse('{"a":1}', { a: 0 }), { a: 1 });
  assert.deepEqual(safeJsonParse('{corrupted', { a: 0 }), { a: 0 });
  assert.deepEqual(safeJsonParse('', ['fallback']), ['fallback']);
  assert.deepEqual(safeJsonParse(null, null), null);
  assert.deepEqual(safeJsonParse(undefined, []), []);
});

test('escapeHtml — escapes XSS vectors safely', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("O'Reilly & Co."), 'O&#39;Reilly &amp; Co.');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('computeFarmerLedgerTotals — excludes CASH prescriptions and BOUNCED checks', () => {
  const prescriptions: Prescription[] = [
    {
      id: 'rx-term',
      farmerId: 'f1',
      prescriptionNo: 'R1',
      date: '2026-01-10',
      items: [],
      priceType: 'TERM',
      totalAmount: 1000,
      isInventoryProcessed: true
    },
    {
      id: 'rx-cash',
      farmerId: 'f1',
      prescriptionNo: 'R2',
      date: '2026-01-11',
      items: [],
      priceType: 'CASH',
      totalAmount: 500,
      isInventoryProcessed: true
    }
  ];

  const payments: Payment[] = [
    { id: 'p-valid', farmerId: 'f1', amount: 300, date: '2026-01-12', method: 'CASH' },
    { id: 'p-bounced', farmerId: 'f1', amount: 400, date: '2026-01-13', method: 'CHECK' }
  ];

  const myPayments: MyPayment[] = [
    {
      id: 'mp-bounced-linked',
      farmerId: 'f1',
      amount: 400,
      issueDate: '2026-01-13',
      dueDate: '2026-02-13',
      type: 'CHECK',
      status: 'PENDING',
      portfolioStatus: 'BOUNCED',
      relatedId: 'p-bounced'
    },
    {
      id: 'mp-bounced-standalone',
      farmerId: 'f1',
      amount: 200,
      issueDate: '2026-01-14',
      dueDate: '2026-02-14',
      type: 'PROMISSORY_NOTE',
      status: 'PENDING',
      portfolioStatus: 'BOUNCED'
    },
    {
      id: 'mp-valid-standalone',
      farmerId: 'f1',
      amount: 150,
      issueDate: '2026-01-15',
      dueDate: '2026-02-15',
      type: 'CHECK',
      status: 'PENDING',
      portfolioStatus: 'PORTFOLIO'
    }
  ];

  const res = computeFarmerLedgerTotals({
    farmerId: 'f1',
    prescriptions,
    manualDebts: [],
    payments,
    myPayments
  });

  // Only TERM prescription counts toward debt (1000); CASH (500) is excluded.
  assert.equal(res.totalDebt, 1000);
  // Only valid cash payment (300) + standalone valid check (150) count; BOUNCED payments excluded.
  assert.equal(res.totalPaid, 450);
  assert.equal(res.netDebt, 550);
});

test('computeSupplierLedgerTotals — uses supplierDocKind and excludes BOUNCED checks', () => {
  const purchases: SupplierPurchase[] = [
    {
      id: 'sp-buy',
      supplierId: 's1',
      date: '2026-01-01',
      type: 'PURCHASE',
      items: [],
      totalAmount: 1000
    },
    {
      id: 'sp-sale-positive-legacy',
      supplierId: 's1',
      date: '2026-01-02',
      type: 'SALE',
      items: [],
      // Even if a legacy SALE doc accidentally had a positive number, supplierDocKind classifies it as SALE -> reduces payable.
      totalAmount: 250
    },
    {
      id: 'sp-return-note-legacy',
      supplierId: 's1',
      date: '2026-01-03',
      items: [],
      note: 'İADE faturası',
      totalAmount: 100
    }
  ];

  const supplierPayments: SupplierPayment[] = [
    { id: 'pay1', supplierId: 's1', amount: 200, date: '2026-01-04', method: 'CASH', type: 'PAY' },
    { id: 'pay-check-bounced', supplierId: 's1', amount: 400, date: '2026-01-04', method: 'CHECK', type: 'PAY' },
    { id: 'pay-note-cancelled', supplierId: 's1', amount: 250, date: '2026-01-04', method: 'PROMISSORY_NOTE', type: 'PAY' }
  ];

  const myPayments: MyPayment[] = [
    {
      id: 'mp-sup-bounced',
      supplierId: 's1',
      amount: 300,
      issueDate: '2026-01-05',
      dueDate: '2026-02-05',
      type: 'CHECK',
      status: 'PENDING',
      portfolioStatus: 'BOUNCED'
    },
    {
      id: 'mp-sup-bounced-linked',
      supplierId: 's1',
      amount: 400,
      issueDate: '2026-01-04',
      dueDate: '2026-02-04',
      type: 'CHECK',
      status: 'PENDING',
      portfolioStatus: 'BOUNCED',
      relatedId: 'pay-check-bounced'
    },
    {
      id: 'mp-sup-cancelled-linked',
      supplierId: 's1',
      amount: 250,
      issueDate: '2026-01-04',
      dueDate: '2026-02-04',
      type: 'PROMISSORY_NOTE',
      status: 'CANCELLED',
      relatedId: 'pay-note-cancelled'
    },
    {
      id: 'mp-sup-valid',
      supplierId: 's1',
      amount: 150,
      issueDate: '2026-01-06',
      dueDate: '2026-02-06',
      type: 'CHECK',
      status: 'PAID'
    }
  ];

  const res = computeSupplierLedgerTotals({
    supplierId: 's1',
    purchases,
    supplierPayments,
    myPayments
  });

  // 1000 purchase - 250 sale - 100 return = 650
  assert.equal(res.totalPurchased, 650);
  // 200 direct + 150 valid check = 350 (BOUNCED standalone & linked BOUNCED/CANCELLED SupplierPayments excluded)
  assert.equal(res.totalPaid, 350);
  // We owe supplier 300
  assert.equal(res.signedBalance, -300);
});

test('dbService subscription block proxy & isSubscriptionBlocked — gates reconcileAccountBalances cleanly', async () => {
  let callbackCalls = 0;
  setActionBlockedCallback(() => {
    callbackCalls += 1;
  });
  try {
    setActionBlocked(false);
    assert.equal(isSubscriptionBlocked(), false);

    setActionBlocked(true);
    assert.equal(isSubscriptionBlocked(), true);

    await assert.rejects(
      () => dbService.reconcileAccountBalances(),
      (err: Error) => err.message === 'SUBSCRIPTION_EXPIRED'
    );
    assert.equal(callbackCalls, 1);
  } finally {
    setActionBlocked(false);
    setActionBlockedCallback(() => {});
  }
});

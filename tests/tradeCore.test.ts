/**
 * Ticari çekirdek senaryo testleri.  Çalıştırma:  npm test
 * Bu testler saf kuralları (utils/tradeCore + utils/ledger) sınar; veritabanı katmanını (IndexedDB) sınamaz.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SupplierPurchase, SupplierPayment } from '../types';
import { normalizeSupplierDoc, supplierDocKind, checkPurchaseReturn, returnableBySupplier, balanceLabel, toKurus } from '../utils/tradeCore';
import { computeSupplierLedgerTotals } from '../utils/ledger';

let seq = 0;
const doc = (supplierId: string, type: SupplierPurchase['type'], items: Array<[string, number, number]>, extra: Partial<SupplierPurchase> = {}): SupplierPurchase => ({
  id: `d${++seq}`, supplierId, date: '2026-11-13T10:00:00.000Z', type,
  items: items.map(([pesticideId, quantity, buyingPrice]) => ({ pesticideId, pesticideName: pesticideId.toUpperCase(), quantity, unit: 'Adet', buyingPrice })),
  totalAmount: 0, ...extra
});
/** Basit stok + ağırlıksız maliyet kartı: testte "depo"nun yerine geçer. */
const makeStock = () => {
  const qty = new Map<string, number>(), cost = new Map<string, number>();
  return {
    qty, cost,
    save(d: SupplierPurchase) {
      const n = normalizeSupplierDoc(d, id => cost.get(id));
      for (const it of n.items) {
        qty.set(it.pesticideId, (qty.get(it.pesticideId) || 0) + Number(it.quantity));
        if (n.type === 'PURCHASE') cost.set(it.pesticideId, it.buyingPrice);
      }
      return n;
    }
  };
};
const pay = (supplierId: string, amount: number, type?: 'RECEIVE'): SupplierPayment => ({ id: `p${++seq}`, supplierId, amount, date: '2026-11-13T12:00:00.000Z', method: 'CASH', ...(type ? { type } : {}) } as SupplierPayment);

test('Senaryo 1 — A tedarikçisinden al, B tedarikçisine sat: iade değil satış, stok 60, kâr doğru', () => {
  const stock = makeStock();
  const buy = stock.save(doc('A', 'PURCHASE', [['urun', 100, 10]]));           // 100 adet × 10,00 = 1.000,00
  const sale = stock.save(doc('B', 'SALE', [['urun', 40, 11.5]]));             // 40 adet × 11,50 = 460,00
  const all = [buy, sale];

  assert.equal(supplierDocKind(sale), 'SALE');
  assert.equal(stock.qty.get('urun'), 60);
  assert.equal(buy.totalAmount, 1000);
  assert.equal(sale.totalAmount, -460);
  assert.equal(sale.costTotal, 400);                                            // maliyet 40 × 10,00
  assert.equal(sale.profit, 60);                                                // 460 − 400
  assert.equal(sale.items[0].unitCost, 10);

  const a = computeSupplierLedgerTotals({ supplierId: 'A', purchases: all, supplierPayments: [] });
  const b = computeSupplierLedgerTotals({ supplierId: 'B', purchases: all, supplierPayments: [] });
  assert.deepEqual([balanceLabel(a.signedBalance).status, balanceLabel(a.signedBalance).amount], ['ALACAKLI', 1000]);
  assert.deepEqual([balanceLabel(b.signedBalance).status, balanceLabel(b.signedBalance).amount], ['BORCLU', 460]);
  // Satış, A'dan iade edilebilir miktarı azaltmaz (iade sayılmadı)
  assert.equal(returnableBySupplier(all, 'A').get('urun'), 100);
});

test('Senaryo 1b — 1.000 TL alınan mal 1.150 TL satılırsa 150 TL brüt kâr; satış ürün maliyet kartını bozmaz', () => {
  const stock = makeStock();
  stock.save(doc('A', 'PURCHASE', [['mal', 1, 1000]]));
  const sale = stock.save(doc('B', 'SALE', [['mal', 1, 1150]]));
  assert.equal(sale.profit, 150);
  assert.equal(stock.cost.get('mal'), 1000);
});

test('Senaryo 2 — A\'dan alınan mal B\'ye Alış İadesi olarak çıkılamaz', () => {
  const stock = makeStock();
  const all = [stock.save(doc('A', 'PURCHASE', [['urun', 100, 10]])), stock.save(doc('B', 'PURCHASE', [['baska', 5, 20]]))];

  const wrong = checkPurchaseReturn(all, 'B', [{ pesticideId: 'urun', pesticideName: 'URUN', quantity: -10 }]);
  assert.equal(wrong.length, 1);
  assert.equal(wrong[0].returnable, 0);
  assert.deepEqual(wrong[0].otherSupplierIds, ['A']);

  // Doğru tedarikçiye, alınan miktar kadar: serbest
  assert.equal(checkPurchaseReturn(all, 'A', [{ pesticideId: 'urun', pesticideName: 'URUN', quantity: -100 }]).length, 0);
  // Alınandan fazlası: engel
  assert.equal(checkPurchaseReturn(all, 'A', [{ pesticideId: 'urun', pesticideName: 'URUN', quantity: -101 }])[0].returnable, 100);
  // Önce 30 iade edildiyse kalan 70'tir
  all.push(stock.save(doc('A', 'RETURN', [['urun', 30, 10]])));
  assert.equal(checkPurchaseReturn(all, 'A', [{ pesticideId: 'urun', pesticideName: 'URUN', quantity: 71 }])[0].returnable, 70);
  assert.equal(checkPurchaseReturn(all, 'A', [{ pesticideId: 'urun', pesticideName: 'URUN', quantity: 70 }]).length, 0);
  // Gerçek iade ciro/kâr üretmez, alış maliyetiyle düşer
  const ret = all[all.length - 1];
  assert.equal(ret.totalAmount, -300);
  assert.equal(ret.profit, undefined);
  assert.equal(stock.qty.get('urun'), 70);
});

test('Senaryo 3 — Çift şapkalı cari: ondan al, ona sat, kısmi öde; yürüyen bakiye kuruşu kuruşuna', () => {
  const stock = makeStock();
  const purchases: SupplierPurchase[] = [], payments: SupplierPayment[] = [];
  const bal = () => computeSupplierLedgerTotals({ supplierId: 'X', purchases, supplierPayments: payments }).signedBalance;

  purchases.push(stock.save(doc('X', 'PURCHASE', [['gubre', 3, 333.33]])));     // 999,99 borçlandık
  assert.equal(toKurus(bal()), -99999);
  purchases.push(stock.save(doc('X', 'SALE', [['gubre', 1, 400.1]])));          // 400,10 sattık
  assert.equal(toKurus(bal()), -59989);
  payments.push(pay('X', 250.55));                                              // 250,55 ödedik
  assert.equal(toKurus(bal()), -34934);
  assert.deepEqual([balanceLabel(bal()).status, balanceLabel(bal()).amount], ['ALACAKLI', 349.34]);
  payments.push(pay('X', 349.34));                                              // kalanı kapat
  assert.equal(balanceLabel(bal()).status, 'KAPALI');
  // Kuruş kayması yok: 0,1 + 0,2 gibi toplamlar
  const tricky = normalizeSupplierDoc(doc('X', 'PURCHASE', [['a', 3, 0.1], ['b', 1, 0.2], ['c', 7, 19.99]]), () => undefined);
  assert.equal(tricky.totalAmount, 140.43);
});

test('Senaryo 4 (kural düzeyi) — aynı belge 5 kez normalleştirilse de sonuç değişmez; tür tahmin edilmez', () => {
  const stockCost = () => 10;
  let d = doc('B', 'SALE', [['urun', 40, 11.5]]);
  const first = normalizeSupplierDoc(d, stockCost);
  d = first;
  for (let i = 0; i < 5; i++) d = normalizeSupplierDoc(d, () => 999);             // maliyet kartı sonradan değişse bile satış maliyeti sabit
  assert.deepEqual(d, first);

  // Açık tür her şeyin önündedir: notunda "İADE" geçen ya da eksi satırı olan ALIM yine alımdır
  assert.equal(supplierDocKind({ type: 'PURCHASE', note: 'İADE sonrası yeniden alım', totalAmount: -5 }), 'PURCHASE');
  const p = normalizeSupplierDoc(doc('A', 'PURCHASE', [['urun', -4, 10]]), () => undefined);
  assert.equal(p.items[0].quantity, 4);
  assert.equal(p.totalAmount, 40);
  // Tür alanı olmayan eski kayıtlar: yalnız not ön eki / eksi tutar
  assert.equal(supplierDocKind({ note: 'SATIŞ: bayi', totalAmount: -100 }), 'SALE');
  assert.equal(supplierDocKind({ note: 'İADE', totalAmount: -100 }), 'RETURN');
  assert.equal(supplierDocKind({ note: 'Nisan alımı', totalAmount: 100 }), 'PURCHASE');
});

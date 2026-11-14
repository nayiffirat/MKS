/**
 * Ticari çekirdek — saf (yan etkisiz) kurallar. Veritabanına ve arayüze bağımlı değildir; tests/tradeCore.test.ts ile sınanır.
 *
 * KURAL 1: Belge türü yalnızca belgenin açık `type` alanından okunur. Cari tipinden ya da eksi miktardan TAHMİN EDİLMEZ.
 *          (Tür alanı olmayan eski kayıtlar için tek bir geriye uyum yolu vardır: supplierDocKind.)
 * KURAL 2: Tedarikçiye satış bir iade değildir: satış fiyatıyla cariyi borçlandırır, maliyetiyle stoktan düşer, kâr üretir.
 * KURAL 3: Alış iadesi yalnızca o tedarikçiden alınmış ve henüz iade edilmemiş miktar kadar yapılabilir.
 * KURAL 4: Para toplamları kuruş (tam sayı) üzerinden yapılır.
 */
import { SupplierPurchase } from '../types';

export type SupplierDocKind = 'PURCHASE' | 'RETURN' | 'SALE';

export const toKurus = (v: unknown): number => Math.round((Number(v) || 0) * 100);
export const fromKurus = (k: number): number => Math.round(k) / 100;
const absQty = (q: unknown): number => Math.abs(Number(String(q ?? 0).replace(',', '.')) || 0);

/** Belgenin türü. Açık `type` varsa yalnızca o geçerlidir; yoksa (eski kayıt) not ön eki ve eksi tutara bakılır. */
export function supplierDocKind(p: Pick<SupplierPurchase, 'type' | 'note' | 'totalAmount'>): SupplierDocKind {
  if (p.type === 'PURCHASE' || p.type === 'RETURN' || p.type === 'SALE') return p.type;
  const note = (p.note || '').trimStart();
  if (note.startsWith('SATIŞ')) return 'SALE';
  if (note.startsWith('İADE')) return 'RETURN';
  return (Number(p.totalAmount) || 0) < 0 ? 'RETURN' : 'PURCHASE';
}

export const SUPPLIER_DOC_LABEL: Record<SupplierDocKind, string> = { PURCHASE: 'Ürün Alımı', RETURN: 'Alış İadesi', SALE: 'Tedarikçiye Satış' };

/**
 * Belgeyi kaydetmeden önce tek biçime getirir (aynı belgeye iki kez uygulanırsa sonuç değişmez):
 * - type açıkça yazılır.
 * - Miktar işareti: alım +, iade ve satış − (eski kayıtlarla aynı düzen).
 * - totalAmount: alım +, iade ve satış − ; satır fiyatı (buyingPrice alanı) × miktar, kuruş hassasiyetinde.
 * - Satışta: satır fiyatı SATIŞ fiyatıdır; unitCost = satış anındaki stok maliyeti, costTotal ve profit hesaplanır.
 */
export function normalizeSupplierDoc<T extends SupplierPurchase>(doc: T, costOf: (pesticideId: string) => number | undefined): T {
  const kind = supplierDocKind(doc);
  const sign = kind === 'PURCHASE' ? 1 : -1;
  let totalK = 0, costK = 0;
  const items = (doc.items || []).map(it => {
    const q = absQty(it.quantity);
    const price = Math.abs(Number(it.buyingPrice) || 0);
    totalK += Math.round(q * price * 100);
    const next: any = { ...it, quantity: sign * q, buyingPrice: price };
    if (kind === 'SALE') {
      const known = Number((it as any).unitCost);
      const cost = Number.isFinite(known) && known >= 0 && (it as any).unitCost !== undefined ? known : Math.abs(Number(costOf(it.pesticideId)) || price);
      next.unitCost = cost;
      costK += Math.round(q * cost * 100);
    }
    return next;
  });
  const out: any = { ...doc, type: kind, items, totalAmount: fromKurus(sign * totalK) };
  if (kind === 'SALE') { out.costTotal = fromKurus(costK); out.profit = fromKurus(totalK - costK); }
  return out as T;
}

/** Bir tedarikçiden alınıp henüz iade edilmemiş miktarlar (ürün bazında). Tedarikçiye satış bu hesabı etkilemez. */
export function returnableBySupplier(purchases: SupplierPurchase[], supplierId: string, excludeDocId?: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of purchases) {
    if (p.deletedAt || p.supplierId !== supplierId || p.id === excludeDocId) continue;
    const kind = supplierDocKind(p);
    if (kind === 'SALE') continue;
    for (const it of p.items || []) m.set(it.pesticideId, (m.get(it.pesticideId) || 0) + (kind === 'PURCHASE' ? 1 : -1) * absQty(it.quantity));
  }
  return m;
}

export interface ReturnViolation { pesticideId: string; pesticideName: string; requested: number; returnable: number; otherSupplierIds: string[] }

/** Alış iadesi denetimi: bu tedarikçiden alınmamış ya da alınandan fazla ürün iade edilemez. Boş dizi = uygun. */
export function checkPurchaseReturn(
  purchases: SupplierPurchase[], supplierId: string,
  items: Array<{ pesticideId: string; pesticideName: string; quantity: number | string }>, excludeDocId?: string
): ReturnViolation[] {
  const can = returnableBySupplier(purchases, supplierId, excludeDocId);
  const want = new Map<string, { name: string; qty: number }>();
  for (const it of items) { const w = want.get(it.pesticideId) || { name: it.pesticideName, qty: 0 }; w.qty += absQty(it.quantity); want.set(it.pesticideId, w); }
  const out: ReturnViolation[] = [];
  for (const [pesticideId, w] of want) {
    const returnable = Math.max(0, Math.round((can.get(pesticideId) || 0) * 100) / 100);
    if (w.qty <= returnable + 1e-9) continue;
    const others = new Set<string>();
    for (const p of purchases) {
      if (p.deletedAt || p.supplierId === supplierId || supplierDocKind(p) !== 'PURCHASE') continue;
      if ((p.items || []).some(i => i.pesticideId === pesticideId)) others.add(p.supplierId);
    }
    out.push({ pesticideId, pesticideName: w.name, requested: w.qty, returnable, otherSupplierIds: [...others] });
  }
  return out;
}

export type BalanceStatus = 'BORCLU' | 'ALACAKLI' | 'KAPALI';
/**
 * İşaretli bakiyeyi kullanıcıya açık durumla anlatır. signedBalance: + ise cari bize borçlu, − ise biz cariye borçluyuz
 * (computeSupplierLedgerTotals.signedBalance ile aynı yön). Tedarikçi de BORÇLU görünebilir: ona mal sattıysak doğaldır.
 */
export function balanceLabel(signedBalance: number): { amount: number; status: BalanceStatus; text: string } {
  const k = toKurus(signedBalance);
  if (k === 0) return { amount: 0, status: 'KAPALI', text: 'Hesap Kapalı / Mutabık' };
  return k > 0
    ? { amount: fromKurus(k), status: 'BORCLU', text: 'BORÇLU (Tahsil Edilecek)' }
    : { amount: fromKurus(-k), status: 'ALACAKLI', text: 'ALACAKLI (Biz Ödeyeceğiz)' };
}

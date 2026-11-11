import { dbService } from '../services/db';

/**
 * Eski sürümden kalan fatura/alım/ödeme kayıtlarındaki ondalık ve stok bayraklarını tek seferlik onarır.
 */
export async function runLegacyDataSync(onAfterSync: () => Promise<void>): Promise<void> {
  const isSynced = localStorage.getItem('mks_inventory_sync_v2');
  if (isSynced) return;

  const [allPrescriptions, allPurchases] = await Promise.all([
    dbService.getAllPrescriptions(),
    dbService.getSupplierPurchases()
  ]);

  for (const p of allPrescriptions) {
    if (p.deletedAt) continue;
    if (p.isInventoryProcessed && p.isProcessed === false) {
      p.isProcessed = true;
      await dbService.updatePrescription(p);
    } else if (p.isProcessed && !p.isInventoryProcessed) {
      await dbService.processInventory(p);
    }
  }

  for (const p of allPurchases) {
    if (p.deletedAt) continue;
    let isCorrupted = false;

    if (p.isInventoryProcessed === undefined) {
      p.isInventoryProcessed = true;
      isCorrupted = true;
    }

    let trueTotal = 0;
    if (p.items && p.items.length > 0) {
      p.items.forEach(item => {
        const q = parseFloat(String(item.quantity).replace(',', '.')) || 0;
        const price = parseFloat(String(item.buyingPrice).replace(',', '.')) || 0;
        trueTotal += q * price;
        if (q !== item.quantity || price !== item.buyingPrice) {
          item.quantity = q;
          item.buyingPrice = price;
          isCorrupted = true;
        }
      });

      const isReturnOrSale =
        p.type === 'RETURN' ||
        (p.note && (p.note.includes('İADE') || p.note.includes('SATIŞ') || p.note.includes('azalış')));

      if (isReturnOrSale && trueTotal > 0) {
        trueTotal = -Math.abs(trueTotal);
      }
    } else if (p.totalAmount) {
      trueTotal = parseFloat(String(p.totalAmount).replace(',', '.')) || 0;
    }

    if (p.totalAmount !== trueTotal || isNaN(p.totalAmount)) {
      p.totalAmount = trueTotal;
      isCorrupted = true;
    }

    if (isCorrupted) {
      await dbService.updateSupplierPurchase(p);
    }
  }

  const allSupplierPayments = await dbService.getSupplierPayments();
  for (const p of allSupplierPayments) {
    if (p.deletedAt) continue;
    let isCorrupted = false;
    let trueAmount = parseFloat(String(p.amount).replace(',', '.')) || 0;

    if (p.type === 'RECEIVE' && trueAmount > 0) {
      trueAmount = Math.abs(trueAmount);
    }

    if (p.amount !== trueAmount || isNaN(p.amount)) {
      p.amount = trueAmount;
      isCorrupted = true;
    }

    if (isCorrupted) {
      await dbService.updateSupplierPayment(p);
    }
  }

  localStorage.setItem('mks_inventory_sync_v2', 'true');
  await onAfterSync();
}

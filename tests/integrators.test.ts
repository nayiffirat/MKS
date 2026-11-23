/**
 * Çoklu e-Fatura Entegratörleri (ZIP, UBL-TR ayrıştırma) ve GTS DSTRACE SSRF güvenlik testleri.
 * Yalnızca sentetik test verileri kullanılır.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSingleFileZip, extractZipEntryText } from '../server/zip';
import { MULTI_ACTIVE_PROVIDERS, parseUblDocument } from '../server/eInvoiceAdapters';
import { EINVOICE_PROVIDERS } from '../utils/edmWarehouseManager';
import { buildUblInvoice } from '../server/edm';
import { isAllowedMinistryUrl } from '../server/ministry';
import {
  resolveShopierPlanFromOrder,
  verifyShopierOsbSignature,
  verifyShopierModernSignature,
  computeNewSubscriptionEnd,
  normalizeTrPhone10,
  normalizeShopierOrderId,
} from '../server/shopier';
import crypto from 'node:crypto';

test('ZIP oluşturma ve UBL XML çıkarma roundtrip testi', () => {
  const sampleXml = '<?xml version="1.0" encoding="UTF-8"?><Invoice><ID>MKS2026000000001</ID><Note>Türkçe üğışçö</Note></Invoice>';
  const zipBuf = createSingleFileZip('test-fatura.xml', Buffer.from(sampleXml, 'utf8'));

  assert.equal(zipBuf[0], 0x50);
  assert.equal(zipBuf[1], 0x4b);

  const extracted = extractZipEntryText(zipBuf, '.xml');
  assert.ok(extracted);
  assert.equal(extracted.name, 'test-fatura.xml');
  assert.equal(extracted.text, sampleXml);

  assert.equal(extractZipEntryText(Buffer.from('not-a-zip')), null);
});

test('buildUblInvoice ve parseUblDocument UBL-TR satış/iade uyumu', () => {
  const built = buildUblInvoice({
    docType: 'EFATURA',
    scenario: 'TICARIFATURA',
    invoiceType: 'SATIS',
    sender: {
      taxNo: '1111111111',
      name: 'Örnek Zirai Bayi A.Ş.',
      district: 'Seyhan',
      city: 'Adana',
      taxOffice: 'Seyhan VD',
    },
    receiver: {
      taxNo: '2222222222',
      name: 'Sentetik Tarım Ltd.',
      district: 'Karatay',
      city: 'Konya',
    },
    lines: [
      { name: 'Bitki Koruma Ürünü X', quantity: 2, unit: 'Litre', unitPrice: 500, vatRate: 10 },
      { name: 'Granül Gübre Y', quantity: 5, unit: 'Kg', unitPrice: 100, vatRate: 20 },
    ],
    note: 'Deneme fatura',
  });

  assert.equal(built.profile, 'TICARIFATURA');
  assert.equal(built.netTotal, 1500);
  assert.equal(built.taxTotal, 200);
  assert.equal(built.payable, 1700);

  const parsed = parseUblDocument(built.xml);
  assert.equal(parsed.profile, 'TICARIFATURA');
  assert.equal(parsed.typeCode, 'SATIS');
  assert.equal(parsed.payableAmount, 1700);
  assert.equal(parsed.supplier.taxNo, '1111111111');
  assert.equal(parsed.customer.taxNo, '2222222222');
  assert.equal(parsed.lines.length, 2);
  assert.equal(parsed.lines[0].unit, 'Lt');
  assert.equal(parsed.lines[0].vatRate, 10);
});

test('Aktif çoklu entegratör kümesi ve GTS DSTRACE URL doğrulaması', () => {
  assert.equal(MULTI_ACTIVE_PROVIDERS.has('EDM'), true);
  assert.equal(MULTI_ACTIVE_PROVIDERS.has('VERIBAN'), true);
  assert.equal(MULTI_ACTIVE_PROVIDERS.has('PARK_ENTEGRASYON'), true);
  assert.equal(MULTI_ACTIVE_PROVIDERS.has('MYSOFT'), true);
  const mysoftMeta = EINVOICE_PROVIDERS.find(p => p.id === 'MYSOFT');
  assert.equal(mysoftMeta?.endpointHint, 'edocumentapi.mysoft.com.tr');

  assert.equal(isAllowedMinistryUrl('https://api.dstrace.com/gts/v1/bildirim'), true);
  assert.equal(isAllowedMinistryUrl('https://gts.dstrace.com.tr/service.asmx'), true);
  assert.equal(isAllowedMinistryUrl('https://bkst.tarbil.gov.tr/BkstWebService/BkstService.asmx'), true);

  assert.equal(isAllowedMinistryUrl('http://api.dstrace.com/gts'), false);
  assert.equal(isAllowedMinistryUrl('https://dstrace.com.evil.com/gts'), false);
  assert.equal(isAllowedMinistryUrl('https://localhost:3000/api'), false);
});

test('Shopier ürün ID, fiyat/başlık çözümleme ve süre uzatma kuralları', () => {
  assert.deepEqual(resolveShopierPlanFromOrder({ productId: '52837181' }), { tier: 'PRO', period: 'MONTHLY', days: 31 });
  assert.deepEqual(resolveShopierPlanFromOrder({ productId: '52837239' }), { tier: 'PRO', period: 'YEARLY', days: 366 });
  assert.deepEqual(resolveShopierPlanFromOrder({ productId: '52837600' }), { tier: 'ULTRA', period: 'MONTHLY', days: 31 });
  assert.deepEqual(resolveShopierPlanFromOrder({ productId: '52837843' }), { tier: 'ULTRA', period: 'YEARLY', days: 366 });
  assert.deepEqual(resolveShopierPlanFromOrder({ productId: '52837907' }), { tier: 'MAX', period: 'MONTHLY', days: 31 });
  assert.deepEqual(resolveShopierPlanFromOrder({ productId: '52837923' }), { tier: 'MAX', period: 'YEARLY', days: 366 });
  assert.deepEqual(resolveShopierPlanFromOrder({ productIds: ['abc-52837843'] }), { tier: 'ULTRA', period: 'YEARLY', days: 366 });
  assert.deepEqual(resolveShopierPlanFromOrder({ title: 'MKS MAX Yıllık Abonelik', price: 12990 }), { tier: 'MAX', period: 'YEARLY', days: 366 });

  const now = Date.UTC(2026, 5, 1, 12, 0, 0);
  const activeFuture = new Date(now + 10 * 86_400_000).toISOString();
  // Aynı pakette kalan süre üzerine +31 gün eklenir
  const extended = computeNewSubscriptionEnd(activeFuture, 'ULTRA', 'ULTRA', 'MONTHLY', now);
  assert.equal(extended.endsAtMs, now + 41 * 86_400_000);
  // Farklı pakete yükseltmede bugünden itibaren tam yıllık süre verilir
  const upgraded = computeNewSubscriptionEnd(activeFuture, 'PRO', 'MAX', 'YEARLY', now);
  assert.equal(upgraded.endsAtMs, now + 366 * 86_400_000);
});

test('Shopier OSB ve Webhook HMAC-SHA256 imza doğrulaması ve girdi temizliği', () => {
  const payload = { orderid: '834912345', email: 'bayi@ornek.com', productid: '52837600', price: '890' };
  const resB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  const user = 'osb_user_test';
  const key = 'osb_secret_key_test';
  const validHash = crypto.createHmac('sha256', key).update(`${resB64}${user}`, 'utf8').digest('hex');

  assert.equal(verifyShopierOsbSignature(resB64, user, validHash, key), true);
  assert.equal(verifyShopierOsbSignature(resB64, user, validHash.replace(/^./, validHash[0] === 'a' ? 'b' : 'a'), key), false);
  assert.equal(verifyShopierOsbSignature(resB64, 'wrong_user', validHash, key), false);

  const rawBody = JSON.stringify(payload);
  const sigB64 = crypto.createHmac('sha256', key).update(rawBody, 'utf8').digest('base64');
  assert.equal(verifyShopierModernSignature(rawBody, sigB64, key), true);
  assert.equal(verifyShopierModernSignature(rawBody, 'invalid-sig', key), false);

  assert.equal(normalizeTrPhone10('+90 (542) 825 40 87'), '5428254087');
  assert.equal(normalizeTrPhone10('05321112233'), '5321112233');
  assert.equal(normalizeShopierOrderId(' #834912345 '), '834912345');
  assert.equal(normalizeShopierOrderId('12'), '');
});

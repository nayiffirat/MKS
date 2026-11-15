/**
 * BKTS / GTS GLN, GS1 karekod ve dışa aktarım doğrulama testleri.
 * Çalıştırma: npm test
 * NOT: Yalnızca sentetik test numaraları kullanılır; gerçek bayi GLN'leri test dosyalarına yazılmaz.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcGS1CheckDigit,
  EXAMPLE_GLN,
  generateMinistryExportFile,
  inspectGLN,
  maskGLN,
  parseGS1Barcode,
  validateGLN,
} from '../utils/gs1Parser';

test('GLN doğrulama ve maskeleme — sentetik il ve GS1 Türkiye önekleri', () => {
  // Geçerli sentetik GS1 Türkiye GLN (868...)
  assert.equal(validateGLN(EXAMPLE_GLN), true);
  assert.equal(maskGLN(EXAMPLE_GLN), '8680*****0006');

  const trRes = inspectGLN(EXAMPLE_GLN);
  assert.equal(trRes.valid, true);
  assert.equal(trRes.prefixType, 'GS1_TURKEY');
  assert.equal(trRes.expectedCheckDigit, 6);
  assert.equal(trRes.actualCheckDigit, 6);

  // Geçerli sentetik Tarım Bakanlığı İl Öneki GLN (001... = Adana plaka 01)
  const body12 = '001000000000';
  const syntheticProvinceGln = `${body12}${calcGS1CheckDigit(body12)}`;
  assert.equal(validateGLN(syntheticProvinceGln), true);

  const provRes = inspectGLN(syntheticProvinceGln);
  assert.equal(provRes.valid, true);
  assert.equal(provRes.prefixType, 'MINISTRY_PROVINCE');
  assert.equal(provRes.provinceCode, '01');
  assert.equal(provRes.provinceName, 'Adana');

  // Kontrol hanesi bozuk GLN reddedilir
  const corruptedGln = `${body12}${(calcGS1CheckDigit(body12) + 1) % 10}`;
  assert.equal(validateGLN(corruptedGln), false);
  const badRes = inspectGLN(corruptedGln);
  assert.equal(badRes.valid, false);
  assert.equal(badRes.prefixType, 'INVALID');

  // Eksik hane reddedilir
  const shortRes = inspectGLN('8680000');
  assert.equal(shortRes.valid, false);
  assert.equal(shortRes.length, 7);
});

test('BKTS 2D DataMatrix ve SSCC-18 karekod ayrıştırma', () => {
  const dm = parseGS1Barcode('(01)08690000000012(17)271231(10)PARTI2026(21)SERI0001');
  assert.equal(dm.valid, true);
  assert.equal(dm.gtin, '08690000000012');
  assert.equal(dm.expiryDate, '2027-12-31');
  assert.equal(dm.batch, 'PARTI2026');
  assert.equal(dm.serial, 'SERI0001');

  const sscc17 = '38690000000000001';
  const sscc18 = `${sscc17}${calcGS1CheckDigit(sscc17)}`;
  const ssccParsed = parseGS1Barcode(sscc18);
  assert.equal(ssccParsed.valid, true);
  assert.equal(ssccParsed.type, 'SSCC');
  assert.equal(ssccParsed.sscc, sscc18);
});

test('BKTS XML/CSV dışa aktarımında serbest satışlar hariç tutulur ve GLN alanları korunur', () => {
  const maskedDealer = maskGLN(EXAMPLE_GLN);
  const xml = generateMinistryExportFile(
    [
      {
        system: 'BKTS',
        recordType: 'SHIPMENT_ACCEPT',
        date: '2026-11-15T10:00:00Z',
        senderGln: '8690000000012',
        receiverGln: maskedDealer,
        productName: 'ORNEK BKU 25 EC',
        gtin: '08690000000012',
        serialNumber: 'SN1',
        lotNumber: 'LOT1',
        expiryDate: '2027-12-31',
        quantity: 1,
        unit: 'Adet',
        documentNo: 'IRS-1',
        status: 'Dışa Aktarıma Hazır',
      },
      {
        system: 'BKTS',
        recordType: 'FREE_SALE',
        date: '2026-11-15T11:00:00Z',
        productName: 'SERBEST URUN',
        quantity: 1,
        status: 'Kayıtsız Serbest Satış',
      },
    ],
    'xml',
  );

  assert.match(xml.content, /<GonderenGLN>8690000000012<\/GonderenGLN>/);
  assert.match(xml.content, /<AliciGLN>8680\*\*\*\*\*0006<\/AliciGLN>/);
  assert.doesNotMatch(xml.content, /SERBEST URUN/);
});

import {
  MINISTRY_DEFAULT_ENDPOINTS,
  buildBReceteSoapEnvelope,
  buildBktsSoapEnvelope,
  buildGtsPayload,
  isAllowedMinistryUrl,
  isValidGln13,
} from '../server/ministry';

test('Resmi web servis URL SSRF allowlist yalnızca HTTPS .gov.tr bakanlık alan adlarına izin verir', () => {
  assert.equal(isAllowedMinistryUrl(MINISTRY_DEFAULT_ENDPOINTS.BKTS.LIVE), true);
  assert.equal(isAllowedMinistryUrl(MINISTRY_DEFAULT_ENDPOINTS.GTS.LIVE), true);
  assert.equal(isAllowedMinistryUrl(MINISTRY_DEFAULT_ENDPOINTS.BRECETE.LIVE), true);
  assert.equal(isAllowedMinistryUrl('https://sub.tarimorman.gov.tr/ws'), true);

  assert.equal(isAllowedMinistryUrl('http://bkst.tarbil.gov.tr/BkstWebService/BkstService.asmx'), false);
  assert.equal(isAllowedMinistryUrl('https://localhost/ministry'), false);
  assert.equal(isAllowedMinistryUrl('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(isAllowedMinistryUrl('https://evil.com/tarbil.gov.tr'), false);
  assert.equal(isAllowedMinistryUrl('https://bkst.tarbil.gov.tr.evil.com/ws'), false);

  assert.equal(isValidGln13(EXAMPLE_GLN), true);
  assert.equal(isValidGln13('8680000000009'), false);
});

test('BKTS SOAP zarfı (AlimBildirimi / SatisBildirimi) doğru alanları üretir ve parolayı/KeyNo değerini maskeler', () => {
  const alim = buildBktsSoapEnvelope({
    action: 'AlimBildirimi',
    gln: EXAMPLE_GLN,
    username: 'BAYI_TEST_USER',
    password: 'GIZLI_TEST_SIFRESI',
    serviceKey: 'GIZLI_TEST_KEYNO',
    records: [
      {
        recordType: 'SHIPMENT_ACCEPT',
        date: '2026-11-15T12:00:00Z',
        senderGln: '8690000000012',
        receiverGln: EXAMPLE_GLN,
        gtin: '08690000000012',
        serialNumber: 'SN999',
        lotNumber: 'LOT2026',
        expiryDate: '2027-12-31',
        quantity: 5,
        unit: 'Adet',
        waybillNo: 'IRS-2026-01',
      },
    ],
  });

  assert.equal(alim.soapAction, 'http://tempuri.org/AlimBildirimi');
  assert.match(alim.envelope, /<AlimBildirimi xmlns="http:\/\/tempuri\.org\/">/);
  assert.match(alim.envelope, /<GTIN>08690000000012<\/GTIN>/);
  assert.match(alim.envelope, /<PartiNo>LOT2026<\/PartiNo>/);
  assert.match(alim.envelope, /<SeriNo>SN999<\/SeriNo>/);
  assert.match(alim.envelope, /GIZLI_TEST_SIFRESI/);
  assert.match(alim.envelope, /GIZLI_TEST_KEYNO/);

  assert.doesNotMatch(alim.maskedEnvelope, /GIZLI_TEST_SIFRESI/);
  assert.doesNotMatch(alim.maskedEnvelope, /GIZLI_TEST_KEYNO/);
  assert.match(alim.maskedEnvelope, /<Sifre>\*\*\*\*\*\*\*\*<\/Sifre>/);
  assert.match(alim.maskedEnvelope, /<KeyNo>\*\*\*\*\*\*\*\*<\/KeyNo>/);

  const satis = buildBktsSoapEnvelope({
    action: 'SatisBildirimi',
    gln: EXAMPLE_GLN,
    username: 'BAYI_TEST_USER',
    password: 'PW1',
    serviceKey: 'KEY1',
    records: [
      {
        recordType: 'FARMER_SALE',
        farmerTcNo: '10000000146',
        bReceteCode: 'BR-2026-100',
        documentNo: 'REC-100',
        gtin: '8690000000012',
        lotNumber: 'L1',
        quantity: 2,
      },
    ],
  });
  assert.equal(satis.soapAction, 'http://tempuri.org/SatisBildirimi');
  assert.match(satis.maskedEnvelope, /<CiftciTCKN>10000000146<\/CiftciTCKN>/);
  assert.match(satis.maskedEnvelope, /<BReceteNo>BR-2026-100<\/BReceteNo>/);
  assert.match(satis.maskedEnvelope, /<GTIN>08690000000012<\/GTIN>/);
});

test('GTS JSON/SOAP yükü ve B-Reçete SOAP zarfı parolayı maskeler', () => {
  const gts = buildGtsPayload({
    action: 'GtsCiftciSatisBildirimi',
    gln: EXAMPLE_GLN,
    username: 'GTS_USER',
    password: 'GTS_SECRET_PASSWORD',
    serviceKey: 'GTS_SECRET_KEY',
    records: [
      {
        recordType: 'FARMER_SALE',
        farmerTcNo: '10000000146',
        farmerName: 'TEST MUSTAHSIL',
        gtin: '08690000000098',
        lotNumber: 'GUBRE-LOT-1',
        quantity: 10,
        unit: 'Çuval',
      },
    ],
  });

  const parsedMasked = JSON.parse(gts.maskedJson);
  assert.equal(parsedMasked.islem, 'GtsCiftciSatisBildirimi');
  assert.equal(parsedMasked.uygulama, 'MKS');
  assert.equal(parsedMasked.yetki.sifre, '********');
  assert.equal(parsedMasked.yetki.keyNo, '********');
  assert.equal(parsedMasked.kalemler[0].aliciTcknVkn, '10000000146');
  assert.doesNotMatch(gts.maskedEnvelope, /GTS_SECRET_PASSWORD|GTS_SECRET_KEY/);

  const brecete = buildBReceteSoapEnvelope({
    action: 'BReceteSatisOnayla',
    gln: EXAMPLE_GLN,
    username: 'BR_USER',
    password: 'BR_PASSWORD',
    serviceKey: 'BR_KEYNO',
    bReceteCode: 'BR-2026-999',
    farmerTcNo: '10000000146',
    records: [
      {
        gtin: '08690000000012',
        lotNumber: 'LOT-BR',
        quantity: 3,
      },
    ],
  });

  assert.equal(brecete.soapAction, 'http://brecete.tarimorman.gov.tr/BReceteSatisOnayla');
  assert.match(brecete.maskedEnvelope, /<BReceteNo>BR-2026-999<\/BReceteNo>/);
  assert.match(brecete.maskedEnvelope, /<BayiGLN>8680000000006<\/BayiGLN>/);
  assert.doesNotMatch(brecete.maskedEnvelope, /BR_PASSWORD|BR_KEYNO/);
});

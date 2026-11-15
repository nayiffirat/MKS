import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'store_assets', 'ios');
const showcaseDir = path.join(rootDir, 'public', 'showcase');
const iconsDir = path.join(rootDir, 'public', 'icons');

fs.mkdirSync(outDir, { recursive: true });

function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapWords(str, maxChars) {
  const words = String(str).trim().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

async function makeRoundedImageBuffer(imgPath, width, height, radius = 28, borderStroke = '#10b981', strokeWidth = 3) {
  const resized = await sharp(imgPath)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .ensureAlpha()
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>`
  );

  const rounded = await sharp(resized)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const borderSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${width - strokeWidth}" height="${height - strokeWidth}"
        rx="${radius}" ry="${radius}" fill="none" stroke="${borderStroke}" stroke-opacity="0.55" stroke-width="${strokeWidth}"/>
    </svg>`
  );

  return sharp(rounded)
    .composite([{ input: borderSvg, blend: 'over' }])
    .png()
    .toBuffer();
}

const PHONE_SLIDES = [
  {
    key: '1_cari_panel',
    image: 'apple-hero-devices.png',
    badge: 'MÜSTAHSİL & ÇİFTÇİ CARİ',
    line1: 'Kuruşu Kuruşuna',
    line2: 'Canlı Cari Mutabakat',
    sub: 'Parçalı tahsilat, çek/senet portföyü ve Üretici Portalı',
    panelTitle: 'Çiftçi Cari Özeti • Anlık Bakiye & Tahsilat',
    panelTag: 'CANLI SENKRON',
    rows: [
      { title: 'Ahmet Yılmaz — Pamuk / Mısır', meta: 'Parçalı Tahsilat + Üretici Portalı Aktif', metric: '48.250 TL', pill: 'Bize Borçlu', pillBg: '#065f46', pillFg: '#6ee7b7' },
      { title: 'Mehmet Demir — Buğday / Arpa', meta: 'POS Kasa + Vadeli Çek Portföyü', metric: '19.400 TL', pill: 'Vade 3 Gün', pillBg: '#78350f', pillFg: '#fcd34d' },
      { title: 'Hasan Kaya — Zeytin / Narenciye', meta: 'WhatsApp Ekstre Paylaşıldı', metric: 'Mutabık', pill: '0,00 TL', pillBg: '#1e293b', pillFg: '#cbd5e1' },
    ],
    footerLeft: 'Tek Tık WhatsApp Ekstre & PDF',
    footerRight: 'Çoklu Ödeme Bölme',
  },
  {
    key: '2_bkts_gts_brecete',
    image: 'erp-bkts-silo-showcase.jpg',
    badge: 'BAKANLIK KÖPRÜSÜ (YAKINDA)',
    line1: 'BKTS, GTS & B-Reçete',
    line2: 'Ayrı & Hızlı Ekranlar',
    sub: 'TCKN/VKN otomatik giriş, 2D karekod ve denetim defteri',
    panelTitle: 'Bakanlık Köprüsü • Modüler Servis Altyapısı',
    panelTag: 'v8.3 YENİ',
    rows: [
      { title: 'BKTS — İlaç Takip Sistemi (Yakında)', meta: '2D GS1 DataMatrix Okuyucu & Mal Kabul', metric: 'Hazır', pill: 'Ayrıştırıldı', pillBg: '#065f46', pillFg: '#6ee7b7' },
      { title: 'GTS — Gübre Takip Sistemi (Yakında)', meta: 'TCKN/VKN ile Tek Tık Bağlantı & Bildirim', metric: 'Hazır', pill: 'Hızlı Köprü', pillBg: '#1e3a8a', pillFg: '#93c5fd' },
      { title: 'B-Reçete — Resmi Reçete (Yakında)', meta: 'Denetim Defteri XML / CSV / PDF Döküm', metric: 'Aktif', pill: 'İhraca Hazır', pillBg: '#065f46', pillFg: '#6ee7b7' },
    ],
    footerLeft: 'Kamera & USB El Barkod Okuyucu',
    footerRight: 'Resmi XML / CSV / PDF',
  },
  {
    key: '3_depo_pos_barkod',
    image: 'apple-tile-pos-warehouse.png',
    badge: 'DEPO, FEFO & HIZLI POS',
    line1: 'Barkodlu Depo ve',
    line2: 'SKT Kontrollü Satış',
    sub: 'FEFO parti/lot kontrolü, onaylı sayım ve konsinye stok',
    panelTitle: 'Depo & POS • FEFO Parti ve SKT Kontrolü',
    panelTag: 'FEFO AKTİF',
    rows: [
      { title: 'Fungisit 250 SC — Parti #LT-409', meta: 'SKT: 14.08.2027 • Karekod Doğrulandı', metric: '48 Litre', pill: 'Stok Tamam', pillBg: '#065f46', pillFg: '#6ee7b7' },
      { title: 'NPK 20-20-0 Gübre — Çuval 50 Kg', meta: 'Parti #GB-112 • Kritik Eşik Kontrolü', metric: '16 Çuval', pill: 'Kritik Stok', pillBg: '#78350f', pillFg: '#fcd34d' },
      { title: 'Damla Sulama Gübresi — 25 Kg', meta: 'Emanet & Onaylı Sayım Mutabık', metric: '120 Paket', pill: 'POS Hazır', pillBg: '#1e3a8a', pillFg: '#93c5fd' },
    ],
    footerLeft: 'Süpermarket Hızında POS Satış',
    footerRight: 'Otomatik SKT Uyarısı',
  },
  {
    key: '4_uydu_tkgm_harita',
    image: 'satellite-ndvi-showcase.jpg',
    badge: 'TKGM PARSEL & UYDU ANALİZİ',
    line1: 'Sentinel-2 Uydu ve',
    line2: 'İlaçlama Hava Radarı',
    sub: 'TKGM tapu-kadastro sınırı, NDVI/NDMI sağlığı ve rüzgar radarı',
    panelTitle: 'Tarla Uydu & Hava Radarı • Ada 142 / Parsel 8',
    panelTag: 'SENTINEL-2 L2A',
    rows: [
      { title: 'NDVI Bitki Canlılık İndeksi', meta: 'Parsel Alanı: 84,5 Dekar • Pamuk', metric: '0.78', pill: 'Çok Sağlıklı', pillBg: '#065f46', pillFg: '#6ee7b7' },
      { title: 'NDMI Nem & Yüzey Islaklık Katmanı', meta: 'Kök Bölgesi Su Stresi Düşük', metric: '%64 Nem', pill: 'İdeal Denge', pillBg: '#1e3a8a', pillFg: '#93c5fd' },
      { title: 'İlaçlama Uygunluk Radarı (Delta-T)', meta: 'Rüzgar: 6 km/sa • Sıcaklık: 22 °C', metric: 'Delta-T 4.2', pill: 'İlaçlama Uygun', pillBg: '#065f46', pillFg: '#6ee7b7' },
    ],
    footerLeft: 'TKGM Anlık Sınır Çizimi',
    footerRight: 'Çok Katmanlı Analiz',
  },
  {
    key: '5_ai_muhendisim',
    image: 'apple-tile-ai-muhendisim.png',
    badge: 'MKS MÜHENDİSİM YAPAY ZEKA',
    line1: 'Yaprak Fotoğrafından',
    line2: 'BKÜ Onaylı Teşhis',
    sub: 'Hastalık/zararlı tespiti ve ruhsatlı BKÜ dozaj önerisi',
    panelTitle: 'MKS Mühendisim AI • BKÜ Veri Tabanı Destekli',
    panelTag: 'BKÜ RUHSATLI',
    rows: [
      { title: 'Yaprak & Zararlı Görüntü Teşhisi', meta: 'Ön Tanı: Pamuk Kırmızı Örümcek / Mildiyö', metric: '%94 Güven', pill: 'Analiz Tamam', pillBg: '#065f46', pillFg: '#6ee7b7' },
      { title: 'Ruhsatlı BKÜ Dozaj & Bekleme Süresi', meta: '100 L Su / Dekar Hesabı ve Phi Günü', metric: 'BKÜ Eşleşti', pill: 'Güvenli Doz', pillBg: '#1e3a8a', pillFg: '#93c5fd' },
      { title: 'Doğrudan Reçete & Stok Bağlantısı', meta: 'Depodaki Muadil Stoklarla Otomatik Eşleşir', metric: 'Tek Tık', pill: 'Reçete Hazır', pillBg: '#065f46', pillFg: '#6ee7b7' },
    ],
    footerLeft: 'Çiftçiye WhatsApp Teşhis Özeti',
    footerRight: 'Resmî BKÜ Kataloğu',
  },
  {
    key: '6_efatura_silo_kasa',
    image: 'apple-tile-field-ipad.png',
    badge: 'e-FATURA, KASA & SİLO',
    line1: 'EDM e-Fatura, Kasa ve',
    line2: 'Silo Kantar Yönetimi',
    sub: 'Resmi fatura kesimi, banka/POS virmanı ve tartım mahsubu',
    panelTitle: 'Finans, EDM e-Fatura & Silo Kantar Merkezi',
    panelTag: 'TAM MUTABAKAT',
    rows: [
      { title: 'EDM Bilişim e-Fatura / e-Arşiv', meta: 'TCKN/VKN Mükellef Sorgusu & Anlık Gönderim', metric: 'Entegre', pill: 'GİB Uyumlu', pillBg: '#065f46', pillFg: '#6ee7b7' },
      { title: 'Çoklu Kasa, Banka & POS Blokaj', meta: 'Otomatik Vade Çözümü & Virman Transferi', metric: 'Mutabık', pill: 'POS Takip', pillBg: '#1e3a8a', pillFg: '#93c5fd' },
      { title: 'Silo Kantar Tartım & Fire Hesabı', meta: 'Rutubet, Yabancı Madde ve Cari Barter Mahsubu', metric: '124,8 Ton', pill: 'Net Tartım', pillBg: '#065f46', pillFg: '#6ee7b7' },
    ],
    footerLeft: 'Kurumsal PDF Bilanço Raporu',
    footerRight: 'Çevrimdışı Güvence',
  },
];

const TABLET_SLIDES = [
  {
    key: '1_erp_dashboard',
    image: 'apple-hero-devices.png',
    badge: 'MKS KURUMSAL TABLET & OFİS ERP',
    line1: 'Çiftçi Cari, Kasa &',
    line2: 'Üretici Portalı Tek Ekranda',
    sub: 'Ziraat mühendisleri ve tarımsal bayiler için offline-first yönetim merkezi',
    bullets: [
      { k: 'Canlı Cari Mutabakat', v: 'Parçalı tahsilat, çek/senet portföyü ve tek tık WhatsApp ekstre' },
      { k: 'Çoklu Kasa & EDM e-Fatura', v: 'Nakit, banka, POS blokaj çözümü ve GİB uyumlu e-Arşiv' },
      { k: 'Çevrimdışı Senkronizasyon', v: 'Sahada internet yokken tam kayıt, bağlantı gelince otomatik bulut' },
    ],
    chips: ['iOS & iPadOS Uyumlu', 'Çiftçi Portalı Aktif', 'Kuruş Hassasiyetinde Bilanço'],
  },
  {
    key: '2_field_satellite_tkgm',
    image: 'satellite-ndvi-showcase.jpg',
    badge: 'TKGM PARSEL & SENTINEL-2 UYDU',
    line1: 'Tarla Sınırları, NDVI ve',
    line2: 'İlaçlama Hava Radarı',
    sub: 'Ada/parsel sorgulama ve uydu katmanlarıyla hassas tarım karar desteği',
    bullets: [
      { k: 'TKGM Tapu-Kadastro Köprüsü', v: 'Koordinattan parsel sınırı çizimi ve otomatik alan hesabı' },
      { k: 'Sentinel-2 L2A Çok Katmanlı Analiz', v: 'NDVI canlılık, NDMI bitki nemi ve yüzey ıslaklık haritaları' },
      { k: 'Delta-T İlaçlama Radarı', v: 'Saatlik rüzgar, sıcaklık ve nem bazlı ilaçlama uygunluk penceresi' },
    ],
    chips: ['NDVI / NDMI / Islaklık', 'Hızlı İptal Korumalı Harita', 'Arazi Keşif & Fotoğraf'],
  },
  {
    key: '3_pos_warehouse_bkts',
    image: 'erp-bkts-silo-showcase.jpg',
    badge: 'BKTS / GTS / B-REÇETE & DEPO',
    line1: 'Modüler Bakanlık Köprüsü ve',
    line2: '2D Karekodlu Depo / Silo',
    sub: 'Ayrıştırılmış servis altyapısı ve süpermarket hızında barkod okuma',
    bullets: [
      { k: 'Ayrıştırılmış Servis Ekranları', v: 'BKTS, GTS ve B-Reçete (Yakında) için XML/CSV/PDF defteri' },
      { k: 'FEFO & GS1 DataMatrix', v: 'Kamera ve el terminaliyle parti, SKT ve seri no bazlı stok takibi' },
      { k: 'Silo Kantar & Barter Mahsubu', v: 'Rutubet, fire ve yabancı madde kesintili net tartım muhasebesi' },
    ],
    chips: ['USB/Bluetooth Okuyucu', 'Otomatik Giriş Hatırlama', 'Onaylı Dijital Sayım'],
  },
  {
    key: '4_ai_diagnostics',
    image: 'apple-tile-ai-muhendisim.png',
    badge: 'MKS MÜHENDİSİM AI & BKÜ KATALOĞU',
    line1: 'Yaprak Analizi ile',
    line2: 'BKÜ Onaylı Teşhis Asistanı',
    sub: 'Tarla keşiflerinde saniyeler içinde bilimsel tanı ve ruhsatlı reçete önerisi',
    bullets: [
      { k: 'Görsel Hastalık & Zararlı Tanısı', v: 'Yaprak ve bitki fotoğrafından anlık erken uyarı analizi' },
      { k: 'Resmi BKÜ Veri Tabanı Uyumu', v: 'Etken madde, ruhsatlı ürün ve yasal dozaj doğrulaması' },
      { k: 'Tek Tık Reçete & Ekstre', v: 'Önerilen ürünleri doğrudan reçete veya satış sepetine aktarın' },
    ],
    chips: ['Resmî BKÜ Kataloğu', 'Zirai Karar Desteği', 'Hızlı WhatsApp Paylaşımı'],
  },
];

async function renderPhoneCardBuffer(slide) {
  const W = 1080;
  const H = 2160;
  const photo = await makeRoundedImageBuffer(
    path.join(showcaseDir, slide.image),
    960,
    560,
    30,
    '#34d399',
    2.5
  );
  const miniIcon = await makeRoundedImageBuffer(
    path.join(iconsDir, 'icon-512.png'),
    56,
    56,
    13,
    '#34d399',
    1.5
  );

  const rowsSvg = slide.rows
    .map((r, idx) => {
      const y = 1236 + idx * 204;
      return `
        <rect x="92" y="${y}" width="896" height="176" rx="24" fill="#0d1e17" stroke="#10b981" stroke-opacity="0.32" stroke-width="1.5"/>
        <text x="124" y="${y + 54}" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="700" fill="#ffffff">${escXml(r.title)}</text>
        <text x="124" y="${y + 96}" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="500" fill="#9ca3af">${escXml(r.meta)}</text>
        <text x="124" y="${y + 142}" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="700" fill="#34d399">${escXml(r.metric)}</text>
        <rect x="756" y="${y + 106}" width="204" height="44" rx="14" fill="${r.pillBg}"/>
        <text x="858" y="${y + 135}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="700" fill="${r.pillFg}">${escXml(r.pill)}</text>
      `;
    })
    .join('\n');

  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stop-color="#030907"/>
          <stop offset="48%" stop-color="#082317"/>
          <stop offset="100%" stop-color="#030a07"/>
        </linearGradient>
        <radialGradient id="topGlow" cx="0.5" cy="0.18" r="0.55">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#topGlow)"/>

      <rect x="132" y="102" width="400" height="44" rx="22" fill="#10b981" fill-opacity="0.16" stroke="#34d399" stroke-opacity="0.45" stroke-width="1.5"/>
      <text x="332" y="131" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#6ee7b7" letter-spacing="1.4">${escXml(slide.badge)}</text>
      <text x="1020" y="131" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="700" fill="#9ca3af">MKS v8.3 • iOS</text>

      <text x="60" y="246" font-family="Segoe UI, Arial, sans-serif" font-size="66" font-weight="800" fill="#ffffff">${escXml(slide.line1)}</text>
      <text x="60" y="324" font-family="Segoe UI, Arial, sans-serif" font-size="66" font-weight="800" fill="#34d399">${escXml(slide.line2)}</text>
      <text x="60" y="388" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="500" fill="#d1d5db">${escXml(slide.sub)}</text>

      <rect x="60" y="1088" width="960" height="944" rx="36" fill="#07120e" stroke="#34d399" stroke-opacity="0.38" stroke-width="2"/>
      <rect x="60" y="1088" width="960" height="106" rx="36" fill="#0a1c15"/>
      <rect x="60" y="1160" width="960" height="34" fill="#0a1c15"/>
      <line x1="60" y1="1194" x2="1020" y2="1194" stroke="#10b981" stroke-opacity="0.25" stroke-width="1.5"/>

      <text x="96" y="1152" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="800" fill="#ffffff">${escXml(slide.panelTitle)}</text>
      <rect x="784" y="1116" width="204" height="46" rx="14" fill="#10b981" fill-opacity="0.22" stroke="#34d399" stroke-opacity="0.55"/>
      <text x="886" y="1146" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="800" fill="#6ee7b7">${escXml(slide.panelTag)}</text>

      ${rowsSvg}

      <rect x="92" y="1878" width="434" height="92" rx="22" fill="#10b981"/>
      <text x="309" y="1933" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" fill="#03150e">${escXml(slide.footerLeft)}</text>

      <rect x="554" y="1878" width="434" height="92" rx="22" fill="#0f281d" stroke="#34d399" stroke-opacity="0.6" stroke-width="2"/>
      <text x="771" y="1933" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" fill="#6ee7b7">${escXml(slide.footerRight)}</text>
    </svg>
  `);

  return sharp(svg)
    .composite([
      { input: miniIcon, left: 60, top: 96 },
      { input: photo, left: 60, top: 462 },
    ])
    .flatten({ background: '#030907' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function renderTabletCardBuffer(slide) {
  const W = 2732;
  const H = 2048;
  const photo = await makeRoundedImageBuffer(
    path.join(showcaseDir, slide.image),
    1380,
    920,
    36,
    '#34d399',
    3
  );
  const icon = await makeRoundedImageBuffer(
    path.join(iconsDir, 'icon-512.png'),
    88,
    88,
    20,
    '#34d399',
    2
  );

  const bulletsSvg = slide.bullets
    .map((b, idx) => {
      const y = 740 + idx * 320;
      const vLines = wrapWords(b.v, 44);
      return `
        <rect x="110" y="${y}" width="1020" height="270" rx="28" fill="#091812" stroke="#10b981" stroke-opacity="0.34" stroke-width="2"/>
        <circle cx="164" cy="${y + 72}" r="13" fill="#34d399"/>
        <text x="202" y="${y + 84}" font-family="Segoe UI, Arial, sans-serif" font-size="36" font-weight="800" fill="#ffffff">${escXml(b.k)}</text>
        <text x="202" y="${y + 150}" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="500" fill="#cbd5e1">${escXml(vLines[0] || '')}</text>
        ${vLines[1] ? `<text x="202" y="${y + 194}" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="500" fill="#cbd5e1">${escXml(vLines[1])}</text>` : ''}
      `;
    })
    .join('\n');

  const subLines = wrapWords(slide.sub, 50);

  const chipsSvg = slide.chips
    .map((c, idx) => {
      const x = 1220 + idx * 476;
      return `
        <rect x="${x}" y="1480" width="446" height="190" rx="28" fill="#091812" stroke="#34d399" stroke-opacity="0.4" stroke-width="2"/>
        <text x="${x + 223}" y="1588" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="#6ee7b7">${escXml(c)}</text>
      `;
    })
    .join('\n');

  const svg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#030907"/>
          <stop offset="50%" stop-color="#072216"/>
          <stop offset="100%" stop-color="#030a07"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.72" cy="0.45" r="0.52">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>

      <rect x="226" y="146" width="610" height="54" rx="27" fill="#10b981" fill-opacity="0.16" stroke="#34d399" stroke-opacity="0.45" stroke-width="2"/>
      <text x="531" y="182" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" fill="#6ee7b7" letter-spacing="1.4">${escXml(slide.badge)}</text>

      <text x="110" y="346" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="800" fill="#ffffff">${escXml(slide.line1)}</text>
      <text x="110" y="440" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="800" fill="#34d399">${escXml(slide.line2)}</text>
      <text x="110" y="530" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="500" fill="#d1d5db">${escXml(subLines[0] || '')}</text>
      ${subLines[1] ? `<text x="110" y="576" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="500" fill="#d1d5db">${escXml(subLines[1])}</text>` : ''}

      <rect x="1220" y="140" width="1400" height="122" rx="30" fill="#091812" stroke="#10b981" stroke-opacity="0.34" stroke-width="2"/>
      <text x="1272" y="213" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#ffffff">Mühendis Kayıt Sistemi (MKS) • v8.3.0 iPadOS Kurumsal</text>
      <rect x="2342" y="168" width="240" height="66" rx="18" fill="#10b981"/>
      <text x="2462" y="212" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="27" font-weight="800" fill="#03150e">App Store</text>

      ${bulletsSvg}
      ${chipsSvg}
    </svg>
  `);

  return sharp(svg)
    .composite([
      { input: icon, left: 110, top: 130 },
      { input: photo, left: 1220, top: 340 },
    ])
    .flatten({ background: '#030907' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const IPHONE_TARGETS = [
  { prefix: 'iphone_63', w: 1179, h: 2556 },
  { prefix: 'iphone_65', w: 1242, h: 2688 },
  { prefix: 'iphone_67', w: 1290, h: 2796 },
];

async function main() {
  const generated = [];

  for (const slide of PHONE_SLIDES) {
    const baseBuf = await renderPhoneCardBuffer(slide);
    for (const target of IPHONE_TARGETS) {
      const dest = path.join(outDir, `${target.prefix}_${slide.key}.png`);
      await sharp(baseBuf)
        .resize(target.w, target.h, {
          fit: 'contain',
          background: '#030907',
        })
        .flatten({ background: '#030907' })
        .removeAlpha()
        .png({ compressionLevel: 9 })
        .toFile(dest);
      generated.push(dest);
    }
  }

  for (const slide of TABLET_SLIDES) {
    const dest = path.join(outDir, `ipad_13_${slide.key}.png`);
    const buf = await renderTabletCardBuffer(slide);
    await sharp(buf).toFile(dest);
    generated.push(dest);
  }

  for (const file of generated) {
    const meta = await sharp(file).metadata();
    const sizeKb = Math.round(fs.statSync(file).size / 1024);
    console.log(`${path.basename(file)}: ${meta.width}x${meta.height} ch=${meta.channels} (${sizeKb} KB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

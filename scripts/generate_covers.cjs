const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const logoBuffer = fs.readFileSync(path.join(__dirname, '../public/icons/icon-512.png'));
const logoBase64 = logoBuffer.toString('base64');

const packages = [
  {
    fileName: 'pro_monthly.png',
    tierName: 'PRO',
    periodName: 'AYLIK ABONELİK',
    price: '490 ₺',
    priceSub: '/ Ay',
    tag: 'BAŞLANGIÇ PAKETİ',
    features: ['Çiftçi Cari &amp; Ekstre', 'Reçete &amp; Hızlı Satış', 'Depo, Stok &amp; İlaçlar', 'Kasa &amp; Tahsilat'],
    accentColor: '#10B981',
    accentGradientStart: '#059669',
    accentGradientEnd: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.25)'
  },
  {
    fileName: 'pro_yearly.png',
    tierName: 'PRO',
    periodName: 'YILLIK ABONELİK',
    price: '4.490 ₺',
    priceSub: '/ Yıl',
    tag: '2 AY HEDİYE • %24 AVANTAJ',
    features: ['Çiftçi Cari &amp; Ekstre', 'Reçete &amp; Hızlı Satış', 'Depo, Stok &amp; İlaçlar', 'Kasa &amp; Tahsilat'],
    accentColor: '#10B981',
    accentGradientStart: '#047857',
    accentGradientEnd: '#34D399',
    glowColor: 'rgba(52, 211, 153, 0.3)'
  },
  {
    fileName: 'ultra_monthly.png',
    tierName: 'ULTRA',
    periodName: 'AYLIK ABONELİK',
    price: '890 ₺',
    priceSub: '/ Ay',
    tag: '%100 REKLAMSIZ SÜRÜM',
    features: ['Web &amp; Windows Masaüstü', 'Bakanlık BKTS &amp; GTS', 'POS Barkod Tabancası', 'Tank Karışım &amp; Silo'],
    accentColor: '#F59E0B',
    accentGradientStart: '#D97706',
    accentGradientEnd: '#FBBF24',
    glowColor: 'rgba(245, 158, 11, 0.25)'
  },
  {
    fileName: 'ultra_yearly.png',
    tierName: 'ULTRA',
    periodName: 'YILLIK ABONELİK',
    price: '7.990 ₺',
    priceSub: '/ Yıl',
    tag: 'EN ÇOK TERCİH EDİLEN • %25 AVANTAJ',
    features: ['Web &amp; Windows Masaüstü', 'Bakanlık BKTS &amp; GTS', 'POS Barkod Tabancası', 'Tank Karışım &amp; Silo'],
    accentColor: '#F59E0B',
    accentGradientStart: '#B45309',
    accentGradientEnd: '#FCD34D',
    glowColor: 'rgba(251, 191, 36, 0.35)'
  },
  {
    fileName: 'max_monthly.png',
    tierName: 'MAX KURUMSAL',
    periodName: 'AYLIK ABONELİK',
    price: '1.490 ₺',
    priceSub: '/ Ay',
    tag: 'YAPAY ZEKA + ÇOKLU EKİP',
    features: ['Sınırsız Zirai Yapay Zeka', 'Fatura OCR Otomatik Stok', 'Çoklu Plasiyer &amp; Yetki', 'Öncelikli VIP Destek'],
    accentColor: '#8B5CF6',
    accentGradientStart: '#6D28D9',
    accentGradientEnd: '#A78BFA',
    glowColor: 'rgba(139, 92, 246, 0.3)'
  },
  {
    fileName: 'max_yearly.png',
    tierName: 'MAX KURUMSAL',
    periodName: 'YILLIK ABONELİK',
    price: '12.990 ₺',
    priceSub: '/ Yıl',
    tag: 'TAM KAPSAMLI KURUMSAL VIP • %27 AVANTAJ',
    features: ['Sınırsız Zirai Yapay Zeka', 'Fatura OCR Otomatik Stok', 'Çoklu Plasiyer &amp; Yetki', 'Öncelikli VIP Destek'],
    accentColor: '#8B5CF6',
    accentGradientStart: '#5B21B6',
    accentGradientEnd: '#C4B5FD',
    glowColor: 'rgba(196, 181, 253, 0.35)'
  }
];

async function generateCover(pkg) {
  const width = 1200;
  const height = 1200;

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bgGlow" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${pkg.accentColor}" stop-opacity="0.22" />
      <stop offset="60%" stop-color="#0A0E17" stop-opacity="1" />
      <stop offset="100%" stop-color="#05080E" stop-opacity="1" />
    </radialGradient>

    <!-- Border Gradient -->
    <linearGradient id="cardBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pkg.accentGradientEnd}" stop-opacity="0.8" />
      <stop offset="50%" stop-color="#374151" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${pkg.accentGradientStart}" stop-opacity="0.6" />
    </linearGradient>

    <!-- Accent Gradient -->
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${pkg.accentGradientStart}" />
      <stop offset="100%" stop-color="${pkg.accentGradientEnd}" />
    </linearGradient>

    <!-- Shadow Filter -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Deep Background -->
  <rect width="${width}" height="${height}" fill="#06090F" />
  <rect width="${width}" height="${height}" fill="url(#bgGlow)" />

  <!-- Outer Card Frame -->
  <rect x="50" y="50" width="1100" height="1100" rx="48" fill="#0A0F1A" fill-opacity="0.75" stroke="url(#cardBorder)" stroke-width="3" filter="url(#shadow)" />

  <!-- Top System Badge -->
  <g transform="translate(100, 110)">
    <rect width="360" height="42" rx="21" fill="#1F2937" fill-opacity="0.8" stroke="#374151" stroke-width="1.5" />
    <circle cx="24" cy="21" r="6" fill="${pkg.accentColor}" />
    <text x="42" y="27" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#E5E7EB" letter-spacing="1">MÜHENDİS KAYIT SİSTEMİ</text>
  </g>

  <!-- Top Right Tag -->
  <g transform="translate(680, 105)">
    <rect width="420" height="50" rx="25" fill="url(#accentGrad)" />
    <text x="210" y="32" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">${pkg.tag}</text>
  </g>

  <!-- MKS Logo & Brand Center Header -->
  <g transform="translate(120, 220)">
    <!-- Logo container -->
    <rect x="0" y="0" width="220" height="220" rx="44" fill="#05080E" stroke="url(#cardBorder)" stroke-width="2.5" />
    <image href="data:image/png;base64,${logoBase64}" x="15" y="15" width="190" height="190" />

    <!-- Brand text beside logo -->
    <text x="260" y="65" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#9CA3AF" letter-spacing="4">MKS</text>
    <text x="260" y="130" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="900" fill="#FFFFFF" letter-spacing="-1">MKS ${pkg.tierName}</text>
    <text x="260" y="185" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="${pkg.accentColor}" letter-spacing="1">${pkg.periodName}</text>
  </g>

  <!-- Divider Line -->
  <line x1="120" y1="480" x2="1080" y2="480" stroke="#1F2937" stroke-width="2" />

  <!-- Pricing Banner -->
  <g transform="translate(120, 520)">
    <rect width="960" height="150" rx="32" fill="#0F172A" fill-opacity="0.9" stroke="url(#cardBorder)" stroke-width="2" />
    <text x="60" y="98" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="900" fill="#FFFFFF">${pkg.price}</text>
    <text x="${pkg.price.length > 7 ? 420 : 360}" y="98" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="600" fill="#94A3B8">${pkg.priceSub}</text>

    <!-- Direct activation callout -->
    <g transform="translate(620, 45)">
      <rect width="280" height="60" rx="20" fill="url(#accentGrad)" />
      <text x="140" y="38" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="#FFFFFF" text-anchor="middle">ANINDA AKTİVASYON</text>
    </g>
  </g>

  <!-- Key Features Grid -->
  <g transform="translate(120, 720)">
    <text x="0" y="0" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#64748B" letter-spacing="2">PAKET KAPSAMI VE ÖZELLİKLERİ</text>

    ${pkg.features.map((feat, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col * 490;
      const y = 35 + row * 90;
      return `
      <g transform="translate(${x}, ${y})">
        <rect width="470" height="68" rx="20" fill="#0D131F" stroke="#1E293B" stroke-width="1.5" />
        <circle cx="36" cy="34" r="14" fill="${pkg.accentColor}" fill-opacity="0.2" />
        <path d="M 30 34 L 34 38 L 43 29" stroke="${pkg.accentColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <text x="66" y="42" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" fill="#F1F5F9">${feat}</text>
      </g>
      `;
    }).join('')}
  </g>

  <!-- Bottom Trust & Platform Bar -->
  <g transform="translate(120, 960)">
    <rect width="960" height="90" rx="24" fill="#070B12" stroke="#1E293B" stroke-width="1.5" />

    <!-- Shopier Trust -->
    <g transform="translate(40, 48)">
      <circle cx="16" cy="0" r="14" fill="#10B981" fill-opacity="0.15" />
      <path d="M 16 -8 L 26 -4 L 26 3 C 26 8 22 13 16 15 C 10 13 6 8 6 3 L 6 -4 Z" fill="#10B981" />
      <text x="42" y="6" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#E2E8F0">Shopier 256-Bit SSL Güvenli Kart Ödemesi</text>
    </g>

    <!-- Platform icons text -->
    <text x="920" y="54" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#64748B" text-anchor="end">Android • iOS • Windows • Web</text>
  </g>
</svg>
  `;

  const outputPath = path.join(__dirname, '../public/shopier-covers', pkg.fileName);
  await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function run() {
  for (const pkg of packages) {
    await generateCover(pkg);
  }
  console.log('All 6 product covers generated successfully!');
}

run().catch(console.error);

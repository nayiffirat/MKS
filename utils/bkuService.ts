import { OFFICIAL_BKU_CATALOG } from '../constants/bkuCatalog';
import { BkuUsageRecommendation, Pesticide, PesticideCategory } from '../types';

const BKU_BASE_URL = 'https://bku.tarimorman.gov.tr';

const HTML_ENTITY_MAP: Record<string, string> = {
  '&Ccedil;': 'Ç', '&ccedil;': 'ç',
  '&Ouml;': 'Ö', '&ouml;': 'ö',
  '&Uuml;': 'Ü', '&uuml;': 'ü',
  '&Iuml;': 'İ', '&iuml;': 'ï',
  '&Auml;': 'Ä', '&auml;': 'ä',
  '&Scedil;': 'Ş', '&scedil;': 'ş',
  '&Gbreve;': 'Ğ', '&gbreve;': 'ğ',
  '&Idot;': 'İ', '&inodot;': 'ı',
  '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&rsquo;': "'", '&lsquo;': "'",
  '&rdquo;': '"', '&ldquo;': '"', '&ndash;': '-',
  '&mdash;': '-', '&deg;': '°', '&plusmn;': '±',
  '&mu;': 'µ', '&micro;': 'µ', '&sup2;': '²', '&sup3;': '³',
  '&reg;': '®', '&trade;': '™', '&times;': '×', '&middot;': '·'
};

export interface BkuRawRow {
  bitkiBirlesikAdi?: string;
  zararliBirlesikAdi?: string;
  aktifMaddeAdi?: string;
  ruhsatBirlesikAdi?: string;
  ruhsatGrubu?: string;
  dozu?: string;
  ilacHasatArasiSure?: string;
  tavsiyeTarihi?: string;
  ruhsatId?: number | string;
}

interface BkuSearchSuggestion {
  id: string;
  text: string;
}

export function decodeBkuText(raw: unknown): string {
  if (raw == null) return '';
  let text = String(raw);
  text = text.replace(/<\/?(p|br|div|li|tr|td)[^>]*>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&[a-zA-Z0-9#]+;/g, (match) => {
    if (HTML_ENTITY_MAP[match]) return HTML_ENTITY_MAP[match];
    if (match.startsWith('&#x') || match.startsWith('&#X')) {
      const code = parseInt(match.slice(3, -1), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (match.startsWith('&#')) {
      const code = parseInt(match.slice(2, -1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return match;
  });
  return text.replace(/\s+/g, ' ').trim();
}

export function mapBkuGroupToCategory(ruhsatGrubu: string): PesticideCategory {
  const g = decodeBkuText(ruhsatGrubu).toLocaleLowerCase('tr-TR');
  if (g.includes('nematisit') || g.includes('nematod')) return PesticideCategory.NEMATICIDE;
  if (g.includes('fungisit') && !g.includes('insektisit')) return PesticideCategory.FUNGICIDE;
  if (g.includes('herbisit')) return PesticideCategory.HERBICIDE;
  if (g.includes('insektisit') || g.includes('akarisit') || g.includes('böcek')) return PesticideCategory.INSECTICIDE;
  if (
    g.includes('bgd') ||
    g.includes('gelişim') ||
    g.includes('aktivatör') ||
    g.includes('defoliant') ||
    g.includes('desikant')
  ) {
    return PesticideCategory.GROWTH_REGULATOR;
  }
  return PesticideCategory.OTHER;
}

export function normalizeBkuProductName(name: string): string {
  return decodeBkuText(name)
    .replace(/\((?:İMAL|İTHAL|imal|ithal)\)/gi, '')
    .replace(/[®™]/g, '')
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildBkuTavsiyeUrl(seciliAramalar: string[], grupId = 0, start = 0, length = 150): string {
  const cols = [
    'bitkiBirlesikAdi',
    'zararliBirlesikAdi',
    'aktifMaddeAdi',
    'ruhsatBirlesikAdi',
    'ruhsatGrubu',
    'dozu',
    'ilacHasatArasiSure',
    'tavsiyeTarihi',
    'id'
  ];
  const params = new URLSearchParams({
    draw: '1',
    start: String(start),
    length: String(length),
    'order[0][column]': '7',
    'order[0][dir]': 'desc',
    param1: JSON.stringify({
      SeciliAramalar: seciliAramalar,
      SecilenRuhsatGrupId: grupId
    })
  });
  cols.forEach((c, i) => {
    params.set(`columns[${i}][data]`, c);
    params.set(`columns[${i}][name]`, '');
    params.set(`columns[${i}][searchable]`, 'true');
    params.set(`columns[${i}][orderable]`, i === 8 ? 'false' : 'true');
    params.set(`columns[${i}][search][value]`, '');
    params.set(`columns[${i}][search][regex]`, 'false');
  });
  return `${BKU_BASE_URL}/Kullanim/TavsiyeGetir?${params.toString()}`;
}

export function aggregateBkuRowsToPesticides(rows: BkuRawRow[]): Pesticide[] {
  const productsMap = new Map<
    string,
    {
      id: string;
      name: string;
      activeIngredient: string;
      defaultDosage: string;
      category: PesticideCategory;
      bkuGroup?: string;
      bkuRuhsatId?: string;
      phi?: string;
      targetCropsSet: Set<string>;
      targetPestsSet: Set<string>;
      usagesMap: Map<string, BkuUsageRecommendation>;
    }
  >();

  for (const row of rows) {
    const name = decodeBkuText(row.ruhsatBirlesikAdi);
    if (!name) continue;
    const key = decodeBkuText(name).toLocaleUpperCase('tr-TR');

    const crop = decodeBkuText(row.bitkiBirlesikAdi);
    const pest = decodeBkuText(row.zararliBirlesikAdi);
    const activeIngredient = decodeBkuText(row.aktifMaddeAdi);
    const dosage = decodeBkuText(row.dozu);
    const phi = decodeBkuText(row.ilacHasatArasiSure);
    const bkuGroup = decodeBkuText(row.ruhsatGrubu);
    const ruhsatId = row.ruhsatId != null ? String(row.ruhsatId) : '';
    const recDate = decodeBkuText(row.tavsiyeTarihi);

    let entry = productsMap.get(key);
    if (!entry) {
      const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'urun';
      entry = {
        id: `bku-${ruhsatId || slug}`,
        name,
        activeIngredient: activeIngredient || 'Belirtilmedi',
        defaultDosage: dosage || 'Etiket Dozu',
        category: mapBkuGroupToCategory(bkuGroup),
        bkuGroup: bkuGroup || undefined,
        bkuRuhsatId: ruhsatId || undefined,
        phi: phi && phi !== '-' ? phi : undefined,
        targetCropsSet: new Set<string>(),
        targetPestsSet: new Set<string>(),
        usagesMap: new Map<string, BkuUsageRecommendation>()
      };
      productsMap.set(key, entry);
    }

    if (entry.activeIngredient === 'Belirtilmedi' && activeIngredient) {
      entry.activeIngredient = activeIngredient;
    }
    if ((entry.defaultDosage === 'Etiket Dozu' || !entry.defaultDosage) && dosage) {
      entry.defaultDosage = dosage;
    }
    if (!entry.phi && phi && phi !== '-') {
      entry.phi = phi;
    }
    if (crop) entry.targetCropsSet.add(crop);
    if (pest) entry.targetPestsSet.add(pest);

    const usageKey = `${crop}|${pest}|${dosage}`;
    if (!entry.usagesMap.has(usageKey) && (crop || pest)) {
      const usage: BkuUsageRecommendation = {
        crop: crop || 'Genel',
        pest: pest || 'Genel',
        dosage: dosage || entry.defaultDosage
      };
      if (phi && phi !== '-') usage.phi = phi;
      if (bkuGroup) usage.group = bkuGroup;
      if (recDate) usage.recommendationDate = recDate;
      entry.usagesMap.set(usageKey, usage);
    }
  }

  const usedIds = new Set<string>();
  return Array.from(productsMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map((entry) => {
      let uniqueId = entry.id;
      let suffix = 2;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${entry.id}-${suffix++}`;
      }
      usedIds.add(uniqueId);

      const product: Pesticide = {
        id: uniqueId,
        name: entry.name,
        activeIngredient: entry.activeIngredient,
        defaultDosage: entry.defaultDosage,
        category: entry.category,
        description: `T.C. Tarım ve Orman Bakanlığı BKÜ Resmi Ruhsatlı Ürün${entry.bkuGroup ? ` (${entry.bkuGroup})` : ''}.`,
        targetCrops: Array.from(entry.targetCropsSet),
        targetPests: Array.from(entry.targetPestsSet),
        usages: Array.from(entry.usagesMap.values())
      };
      if (entry.phi) product.phi = entry.phi;
      if (entry.bkuGroup) product.bkuGroup = entry.bkuGroup;
      if (entry.bkuRuhsatId) product.bkuRuhsatId = entry.bkuRuhsatId;
      return product;
    });
}

export async function searchLiveBkuDatabase(query: string): Promise<Pesticide[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const suggestUrl = `${BKU_BASE_URL}/Kullanim/TavsiyeAramaKelimesiGetir3?pageSize=15&id=${encodeURIComponent(trimmed)}`;
  const suggestRes = await fetch(suggestUrl, {
    headers: { Accept: 'application/json, text/javascript, */*; q=0.01' }
  });
  if (!suggestRes.ok) {
    throw new Error(`BKÜ arama servisi yanıt vermedi (${suggestRes.status})`);
  }

  const suggestions: BkuSearchSuggestion[] = await suggestRes.json();
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return [];
  }

  // Prefer Ruhsat and Aktif Madde matches first, then Bitki / Zararlı (up to 6 tokens)
  const prioritized = [...suggestions].sort((a, b) => {
    const score = (text: string) => {
      if (text.startsWith('Ruhsat:')) return 0;
      if (text.startsWith('Aktif Madde:')) return 1;
      if (text.startsWith('Bitki:')) return 2;
      return 3;
    };
    return score(a.text || '') - score(b.text || '');
  });

  const selectedIds = prioritized.slice(0, 6).map((item) => item.id).filter(Boolean);
  if (selectedIds.length === 0) return [];

  const dataUrl = buildBkuTavsiyeUrl(selectedIds, 0, 0, 200);
  const dataRes = await fetch(dataUrl, {
    headers: { Accept: 'application/json, text/javascript, */*; q=0.01' }
  });
  if (!dataRes.ok) {
    throw new Error(`BKÜ tavsiye listesi alınamadı (${dataRes.status})`);
  }

  const payload = await dataRes.json();
  const rows: BkuRawRow[] = Array.isArray(payload?.data) ? payload.data : [];
  return aggregateBkuRowsToPesticides(rows);
}

const GENERIC_PLACEHOLDER_DOSAGES = new Set(['100ml/100l', 'belirtilmedi', '']);
const GENERIC_AUTO_DESCRIPTIONS = [
  'tedarikçi alımı ile otomatik eklendi',
  'depo eklemesi ile otomatik eklendi'
];

function isMissingValue(value?: string): boolean {
  if (!value) return true;
  const norm = value.trim().toLocaleLowerCase('tr-TR');
  return norm === '' || norm === 'belirtilmedi' || norm === '-' || norm === 'yok';
}

function isGenericAutoDescription(description?: string): boolean {
  if (!description) return true;
  const norm = description.trim().toLocaleLowerCase('tr-TR');
  return norm === '' || GENERIC_AUTO_DESCRIPTIONS.some((prefix) => norm.includes(prefix));
}

function findExactBkuCatalogMatch(itemName: string): Pesticide | undefined {
  const normalizedTarget = normalizeBkuProductName(itemName);
  // Guard against overly short or generic numeric formulation strings like "25 WP"
  const meaningfulAlpha = normalizedTarget.replace(/[^A-ZÇĞİÖŞÜ]/g, '');
  if (meaningfulAlpha.length < 4) return undefined;

  const exact = OFFICIAL_BKU_CATALOG.find(
    (entry) => normalizeBkuProductName(entry.name) === normalizedTarget
  );
  if (exact) return exact;

  // Match prefix where user omitted formulation or (İMAL)/(İTHAL)
  if (normalizedTarget.length >= 5) {
    return OFFICIAL_BKU_CATALOG.find((entry) => {
      const entryNorm = normalizeBkuProductName(entry.name);
      return entryNorm === normalizedTarget || entryNorm.startsWith(`${normalizedTarget} `);
    });
  }
  return undefined;
}

export function sanitizePesticideForDb(item: Pesticide): Pesticide {
  const clean: Pesticide = {
    id: item.id,
    name: item.name,
    activeIngredient: item.activeIngredient,
    defaultDosage: item.defaultDosage,
    category: item.category
  };
  if (item.description) clean.description = item.description;
  if (item.barcode) clean.barcode = item.barcode;
  if (item.deletedAt) clean.deletedAt = item.deletedAt;
  if (item.targetCrops && item.targetCrops.length > 0) clean.targetCrops = item.targetCrops;
  if (item.targetPests && item.targetPests.length > 0) clean.targetPests = item.targetPests;
  if (item.phi) clean.phi = item.phi;
  if (item.bkuGroup) clean.bkuGroup = item.bkuGroup;
  if (item.bkuRuhsatId) clean.bkuRuhsatId = item.bkuRuhsatId;
  if (item.usages && item.usages.length > 0) clean.usages = item.usages;
  return clean;
}

export function enrichIncompletePesticide(item: Pesticide): Pesticide | null {
  const missingActive = isMissingValue(item.activeIngredient);
  const missingCrops = !item.targetCrops || item.targetCrops.length === 0;
  const isOtherCategory = item.category === PesticideCategory.OTHER;
  const isGenericDosage = GENERIC_PLACEHOLDER_DOSAGES.has(
    (item.defaultDosage || '').trim().toLocaleLowerCase('tr-TR')
  );

  // Skip items that already look complete
  if (!missingActive && !missingCrops && !isOtherCategory) {
    return null;
  }

  let changed = false;
  const next: Pesticide = { ...item };

  const applyField = <K extends keyof Pesticide>(key: K, value: Pesticide[K]) => {
    if (value === undefined) return;
    const prevVal = next[key];
    if (Array.isArray(value)) {
      if (!Array.isArray(prevVal) || prevVal.length === 0) {
        next[key] = value;
        changed = true;
      }
    } else if (prevVal !== value) {
      next[key] = value;
      changed = true;
    }
  };

  // 1. Official BKU Catalog match (exact commercial name)
  const bkuMatch = findExactBkuCatalogMatch(item.name);
  if (bkuMatch) {
    if (missingActive && bkuMatch.activeIngredient) {
      applyField('activeIngredient', bkuMatch.activeIngredient);
    }
    if (isOtherCategory && bkuMatch.category !== PesticideCategory.OTHER) {
      applyField('category', bkuMatch.category);
    }
    if (isGenericDosage && bkuMatch.defaultDosage) {
      applyField('defaultDosage', bkuMatch.defaultDosage);
    }
    if (missingCrops && bkuMatch.targetCrops?.length) {
      applyField('targetCrops', bkuMatch.targetCrops);
    }
    if ((!next.targetPests || next.targetPests.length === 0) && bkuMatch.targetPests?.length) {
      applyField('targetPests', bkuMatch.targetPests);
    }
    if (!next.phi && bkuMatch.phi) applyField('phi', bkuMatch.phi);
    if (!next.bkuGroup && bkuMatch.bkuGroup) applyField('bkuGroup', bkuMatch.bkuGroup);
    if (!next.bkuRuhsatId && bkuMatch.bkuRuhsatId) applyField('bkuRuhsatId', bkuMatch.bkuRuhsatId);
    if ((!next.usages || next.usages.length === 0) && bkuMatch.usages?.length) {
      applyField('usages', bkuMatch.usages);
    }
    if (isGenericAutoDescription(item.description) && bkuMatch.description) {
      applyField('description', bkuMatch.description);
    }
    return changed ? sanitizePesticideForDb(next) : null;
  }

  const lowerName = item.name.toLocaleLowerCase('tr-TR').trim();

  // 2. Hybrid Seeds (Tohum)
  if (
    lowerName.includes('tohum') ||
    lowerName.includes('agromar') ||
    lowerName.includes('dekalb') ||
    lowerName.includes('pioneer') ||
    lowerName.includes('syngenta') && lowerName.includes('mısır')
  ) {
    if (isOtherCategory) applyField('category', PesticideCategory.SEED);
    const cropHint = lowerName.includes('mısır')
      ? 'Mısır'
      : lowerName.includes('pamuk')
      ? 'Pamuk'
      : lowerName.includes('buğday')
      ? 'Buğday'
      : lowerName.includes('arpa')
      ? 'Arpa'
      : lowerName.includes('ayçiçe')
      ? 'Ayçiçeği'
      : lowerName.includes('domates')
      ? 'Domates'
      : 'Tarla Bitkileri';
    if (missingActive) {
      const codeMatch = item.name.match(/\b\d{3,4}\b/);
      applyField(
        'activeIngredient',
        `Sertifikalı ${cropHint} Tohumu${codeMatch ? ` (Çeşit: ${codeMatch[0]})` : ''}`
      );
    }
    if (isGenericDosage) {
      applyField(
        'defaultDosage',
        cropHint === 'Mısır' ? '8.000-9.000 tohum/da (70x17 cm)' : 'Etiket Ekimi Dozu'
      );
    }
    if (missingCrops) applyField('targetCrops', [cropHint]);
    if (!next.targetPests?.length) {
      applyField('targetPests', ['Dane / Silajlık Üretim']);
    }
    if (isGenericAutoDescription(item.description)) {
      applyField('description', `MKS Zirai Kütüphane — Sertifikalı ${cropHint} tohumluk çeşidi.`);
    }
    return changed ? sanitizePesticideForDb(next) : null;
  }

  // 3. CAN 26% Calcium Ammonium Nitrate
  if (/\b26\b/.test(lowerName) && (lowerName.includes('can') || lowerName.includes('toros') || lowerName.includes('nitrat'))) {
    if (isOtherCategory) applyField('category', PesticideCategory.GRANULAR_FERTILIZER);
    if (missingActive) applyField('activeIngredient', '%26 Azot (N) + Kalsiyum (Kalsiyum Amonyum Nitrat)');
    if (isGenericDosage) applyField('defaultDosage', '15-30 kg/da (Üst Gübreleme)');
    if (missingCrops) applyField('targetCrops', ['Buğday', 'Mısır', 'Pamuk', 'Ayçiçeği', 'Meyve Ağaçları']);
    if (!next.targetPests?.length) applyField('targetPests', ['Üst Gübreleme ve Vejetatif Gelişim']);
    if (isGenericAutoDescription(item.description)) {
      applyField('description', 'Kalsiyum Amonyum Nitrat (%26 N) granül üst gübresi.');
    }
    return changed ? sanitizePesticideForDb(next) : null;
  }

  // 4. NPK / NP Granular & Water-Soluble Fertilizers (e.g. "15 30 15 25 KĞ", "16 8 24 25 KĞ", "18 18 18 25 KĞ", "20/20 süper")
  const npk3 = lowerName.match(/\b(\d{1,2})\s*[-./ ]\s*(\d{1,2})\s*[-./ ]\s*(\d{1,2})\b/);
  if (npk3) {
    const [, n, p, k] = npk3;
    const isGranularBag = /\b(25|50)\s*(kg|kğ)\b/i.test(lowerName) || lowerName.includes('taban');
    if (isOtherCategory) {
      applyField(
        'category',
        isGranularBag ? PesticideCategory.GRANULAR_FERTILIZER : PesticideCategory.FERTILIZER
      );
    }
    if (missingActive) {
      applyField(
        'activeIngredient',
        `%${n} Azot (N) + %${p} Fosfor (P₂O₅) + %${k} Potasyum (K₂O)`
      );
    }
    if (isGenericDosage) {
      applyField(
        'defaultDosage',
        isGranularBag ? '20-35 kg/da (Taban Gübresi)' : '1-2 kg/da (Damlama) / 200 g/100 L su'
      );
    }
    if (missingCrops) {
      const crops =
        Number(k) >= 20
          ? ['Patates', 'Domates', 'Bağ', 'Pamuk', 'Sebzeler']
          : Number(p) >= 25
          ? ['Pamuk', 'Mısır', 'Buğday', 'Sebzeler', 'Meyve Ağaçları']
          : ['Pamuk', 'Mısır', 'Domates', 'Biber', 'Meyve Ağaçları'];
      applyField('targetCrops', crops);
    }
    if (!next.targetPests?.length) {
      const purpose =
        Number(k) >= 20
          ? 'Meyve İrileşmesi ve Potasyum Beslemesi'
          : Number(p) >= 25
          ? 'Köklenme ve Çiçeklenme Beslemesi'
          : 'Dengeli NPK Bitki Besleme';
      applyField('targetPests', [purpose]);
    }
    if (isGenericAutoDescription(item.description)) {
      applyField('description', `${n}-${p}-${k} formülasyonlu kompoze bitki besleme gübresi.`);
    }
    return changed ? sanitizePesticideForDb(next) : null;
  }

  const np2 = lowerName.match(/\b(20)\s*[-./ ]\s*(20)\b/);
  if (np2) {
    if (isOtherCategory) applyField('category', PesticideCategory.GRANULAR_FERTILIZER);
    if (missingActive) applyField('activeIngredient', '%20 Azot (N) + %20 Fosfor (P₂O₅) Kompoze');
    if (isGenericDosage) applyField('defaultDosage', '25-40 kg/da (Taban Gübresi)');
    if (missingCrops) applyField('targetCrops', ['Buğday', 'Arpa', 'Mısır', 'Pamuk', 'Antepfıstığı']);
    if (!next.targetPests?.length) applyField('targetPests', ['Taban Gübrelemesi ve Kök Gelişimi']);
    if (isGenericAutoDescription(item.description)) {
      applyField('description', '20-20-0 Kompoze NP taban gübresi.');
    }
    return changed ? sanitizePesticideForDb(next) : null;
  }

  // 5. Named Fertilizers (DAP, Üre, Amonyum Sülfat, Potasyum Nitrat, MKP, MAP)
  if (lowerName.includes('dap') || lowerName.includes('18-46')) {
    if (isOtherCategory) applyField('category', PesticideCategory.GRANULAR_FERTILIZER);
    if (missingActive) applyField('activeIngredient', '%18 Azot (N) + %46 Fosfor (P₂O₅) (DAP)');
    if (isGenericDosage) applyField('defaultDosage', '15-25 kg/da (Taban Gübresi)');
    if (missingCrops) applyField('targetCrops', ['Buğday', 'Arpa', 'Mısır', 'Pamuk']);
    if (!next.targetPests?.length) applyField('targetPests', ['Ekim Öncesi Fosfor ve Başlangıç Azotu']);
    return changed ? sanitizePesticideForDb(next) : null;
  }

  if (lowerName.includes('üre') || lowerName.includes('urea')) {
    if (isOtherCategory) applyField('category', PesticideCategory.GRANULAR_FERTILIZER);
    if (missingActive) applyField('activeIngredient', '%46 Azot (N) (Üre)');
    if (isGenericDosage) applyField('defaultDosage', '15-25 kg/da (Üst Gübreleme)');
    if (missingCrops) applyField('targetCrops', ['Buğday', 'Mısır', 'Pamuk', 'Ayçiçeği']);
    if (!next.targetPests?.length) applyField('targetPests', ['Hızlı Azot Takviyesi ve Gelişim']);
    return changed ? sanitizePesticideForDb(next) : null;
  }

  // 6. Generic Wettable Powder / Formulations like "25 WP" where active ingredient is missing
  const genericFormMatch = lowerName.match(/^(\d+)\s*(wp|wg|sp|df)$/i);
  if (genericFormMatch) {
    const pct = genericFormMatch[1];
    const formCode = genericFormMatch[2].toUpperCase();
    if (missingActive) {
      applyField('activeIngredient', `%${pct} ${formCode} Formülasyon — Ticari Ürün Eşleştirmesi Bekliyor`);
    }
    if (isGenericDosage) {
      applyField('defaultDosage', 'Etiket Dozu (g / 100 L su)');
    }
    if (missingCrops) {
      applyField('targetCrops', ['Etiket / BKÜ Sorgusu ile Belirleyin']);
    }
    if (!next.targetPests?.length) {
      applyField('targetPests', ['Ruhsatlı Hedef Zararlı (BKÜ Detayından Seçin)']);
    }
    if (isGenericAutoDescription(item.description)) {
      applyField(
        'description',
        'Kısa formülasyon adıyla kaydedilmiş ürün; "Düzenle" veya "Canlı BKÜ\'de Sorgula" ile tam ruhsat adını eşleştirin.'
      );
    }
    return changed ? sanitizePesticideForDb(next) : null;
  }

  return changed ? sanitizePesticideForDb(next) : null;
}

import {
  Account,
  Expense,
  Farmer,
  InventoryItem,
  Pesticide,
  Prescription,
  Reminder,
  Supplier,
  VisitLog,
  UserProfile
} from '../types';
import { DashboardStats } from '../context/statsEngine';
import { OFFICIAL_BKU_CATALOG } from '../constants/bkuCatalog';
import {
  CROP_CATEGORIES,
  CROP_STAGES,
  GENERIC_PROBLEMS,
  GENERIC_STAGES,
  PROBLEM_DATABASE
} from '../constants/cropData';
import {
  CROP_AGRONOMY_PROFILES,
  DEFICIENCY_GUIDE,
  DeficiencyItem,
  MIXING_ORDER_STEPS,
  SEASONAL_CALENDAR,
  SeasonalCalendarItem,
  TANK_MIX_GUIDE,
  WATER_QUALITY_GUIDE
} from '../constants/agriKnowledge';
import { normalizeTurkish, turkishIncludes } from './search';
import { formatCurrency } from './currency';
import { buildWaUrl } from './whatsappTemplates';

export interface ErpIntelligenceContext {
  inventory: InventoryItem[];
  farmers: Farmer[];
  stats: DashboardStats;
  accounts: Account[];
  suppliers: Supplier[];
  prescriptions: Prescription[];
  reminders?: Reminder[];
  visits?: VisitLog[];
  expenses?: Expense[];
  userProfile?: UserProfile;
}

export interface DebtorRadarEntry {
  id: string;
  fullName: string;
  village: string;
  phoneNumber: string;
  debt: number;
  sharePct: number;
  riskLevel: 'YÜKSEK' | 'ORTA' | 'DÜŞÜK';
  fieldArea: number;
  cropsSummary: string;
  whatsappUrl: string;
}

export interface ExpiringRadarEntry {
  item: InventoryItem;
  lotNumber?: string;
  expiryDate: string;
  daysLeft: number;
  batchQty: number;
  status: 'SÜRESİ DOLMUŞ' | 'KRİTİK (≤30 GÜN)' | 'YAKLAŞAN (≤90 GÜN)';
}

export interface MarginRadarEntry {
  item: InventoryItem;
  unitProfit: number;
  marginPct: number;
  totalPotentialProfit: number;
}

export interface SmartErpRadar {
  currency: 'TRY' | 'USD' | 'EUR';
  financialScore: number;
  scoreLabel: 'Çok Güçlü' | 'Dengeli' | 'Dikkat Gerektirir' | 'Kritik Baskı';
  totalKasa: number;
  totalReceivables: number;
  debtorCount: number;
  totalSupplierDebt: number;
  netWorkingCapital: number;
  inventoryCost: number;
  potentialRevenue: number;
  expectedGrossProfit: number;
  averageMarginPct: number;
  totalSales: number;
  totalExpenses: number;
  activeFarmerCount: number;
  totalAreaDekar: number;
  inStockCount: number;
  outOfStockCount: number;
  topDebtors: DebtorRadarEntry[];
  criticalStockItems: InventoryItem[];
  expiringItems: ExpiringRadarEntry[];
  topMarginItems: MarginRadarEntry[];
  pendingReminders: Reminder[];
  overdueReminderCount: number;
  recentVisitsWithFindings: VisitLog[];
  currentMonthName: string;
  currentSeasonItem: SeasonalCalendarItem;
  currentMonthFocus?: { month: string; priority: string };
}

export interface CropProblemFlatItem {
  id: string;
  stageId: string;
  stageName: string;
  type: string;
  name: string;
  description: string;
  commercialNames: string[];
  activeIngredients: string[];
}

export interface BkuMatchResult {
  pesticide: Pesticide;
  matchedCrop?: string;
  matchedPest?: string;
  dosage: string;
  phi?: string;
  inDepotItem?: InventoryItem;
  score: number;
}

export interface QueryEnrichmentResult {
  intentTags: string[];
  depotMatches: InventoryItem[];
  bkuMatches: BkuMatchResult[];
  debtorMatches: DebtorRadarEntry[];
  matchedDeficiencies: DeficiencyItem[];
  matchedProblems: { cropId: string; cropName: string; problem: CropProblemFlatItem }[];
  kpiHighlights: { label: string; value: string; tone: 'emerald' | 'amber' | 'rose' | 'blue' }[];
  ragContext: string;
  followUpSuggestions: string[];
  localFallbackAnswer: string;
}

export interface SmartPrescriptionProductLine {
  source: 'DEPO + BKÜ' | 'DEPO' | 'RESMİ BKÜ';
  name: string;
  activeIngredient: string;
  group: string;
  dosageLabel: string;
  phi?: string;
  parsedUnit: string;
  perDekarAmount?: number;
  perTankAmount?: number;
  totalRequiredAmount?: number;
  formattedTotalRequired: string;
  formattedPerTank: string;
  inDepotItem?: InventoryItem;
  depotUnitPrice?: number;
  estimatedCost?: number;
  stockStatus: 'YETERLİ' | 'STOK KONTROLÜ GEREKLİ' | 'DEPODA YOK';
}

export interface SmartPrescriptionCalcResult {
  cropName: string;
  problemName: string;
  problemType: string;
  problemDescription: string;
  areaDekar: number;
  waterPerDekarLiters: number;
  totalWaterLiters: number;
  tankLiters: number;
  exactTanks: number;
  fullTanksCount: number;
  mixingOrder: string[];
  products: SmartPrescriptionProductLine[];
  waterRulesNote: string;
}

export const CROP_BKU_ALIASES: Record<string, string[]> = {
  PAMUK: ['PAMUK'],
  MISIR: ['MISIR'],
  BUGDAY: ['BUĞDAY', 'TAHIL'],
  ARPA: ['ARPA', 'TAHIL'],
  AYCICEGI: ['AYÇİÇEĞİ', 'AYÇİÇEK'],
  SEKER_PANCARI: ['ŞEKERPANCARI', 'ŞEKER PANCARI', 'PANCAR'],
  PATATES: ['PATATES'],
  SOGAN: ['SOĞAN'],
  YER_FISTIGI: ['YERFISTIĞI', 'YER FISTIĞI'],
  MERCIMEK: ['MERCİMEK'],
  SOYA: ['SOYA', 'SOYA FASULYESİ'],
  KIMYON: ['KİMYON'],
  DOMATES: ['DOMATES'],
  BIBER: ['BİBER'],
  HIYAR: ['HIYAR', 'KORNİŞON', 'SALATALIK'],
  PATLICAN: ['PATLICAN'],
  KARPUZ: ['KARPUZ'],
  KAVUN: ['KAVUN'],
  CILEK: ['ÇİLEK'],
  BAMYA: ['BAMYA'],
  BAG: ['BAĞ', 'ÜZÜM', 'ASMA'],
  ELMA: ['ELMA'],
  ARMUT: ['ARMUT'],
  SEFTALI: ['ŞEFTALİ', 'KAYISI', 'NEKTARİN'],
  KIRAZ: ['KİRAZ', 'VİŞNE'],
  ZEYTIN: ['ZEYTİN'],
  NARENCIYE: ['TURUNÇGİL', 'NARENCİYE', 'PORTAKAL', 'LİMON', 'MANDALİNA', 'GREYFURT'],
  FISTIK: ['ANTEPFISTIĞI', 'ANTEP FISTIĞI'],
  FINDIK: ['FINDIK'],
  CEVIZ: ['CEVİZ'],
  NAR: ['NAR'],
  BADEM: ['BADEM']
};

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export function getAllCropsFlat(): { id: string; name: string; categoryName: string; categoryId: string }[] {
  const list: { id: string; name: string; categoryName: string; categoryId: string }[] = [];
  for (const cat of CROP_CATEGORIES) {
    for (const crop of cat.crops) {
      list.push({ id: crop.id, name: crop.name, categoryName: cat.name, categoryId: cat.id });
    }
  }
  return list;
}

export function getCropDisplayName(cropId: string): string {
  const found = getAllCropsFlat().find(c => c.id === cropId);
  return found?.name || cropId;
}

export function getProblemsForCrop(cropId: string): CropProblemFlatItem[] {
  const cropProblems = PROBLEM_DATABASE[cropId];
  const stages = CROP_STAGES[cropId] || GENERIC_STAGES;
  const flat: CropProblemFlatItem[] = [];

  if (cropProblems) {
    for (const stage of stages) {
      const stageItems = cropProblems[stage.id] || [];
      stageItems.forEach((p, idx) => {
        flat.push({
          id: `${stage.id}::${idx}`,
          stageId: stage.id,
          stageName: stage.name,
          type: p.type || 'GENEL',
          name: p.name || 'Sorun',
          description: p.description || '',
          commercialNames: Array.isArray(p.commercialNames) ? p.commercialNames : [],
          activeIngredients: Array.isArray(p.activeIngredients) ? p.activeIngredients : []
        });
      });
    }
    // Ekstra tanımlanmış evre varsa dahil et
    for (const [stageKey, arr] of Object.entries(cropProblems)) {
      if (stages.some(s => s.id === stageKey) || !Array.isArray(arr)) continue;
      arr.forEach((p, idx) => {
        flat.push({
          id: `${stageKey}::${idx}`,
          stageId: stageKey,
          stageName: stageKey,
          type: p.type || 'GENEL',
          name: p.name || 'Sorun',
          description: p.description || '',
          commercialNames: Array.isArray(p.commercialNames) ? p.commercialNames : [],
          activeIngredients: Array.isArray(p.activeIngredients) ? p.activeIngredients : []
        });
      });
    }
  }

  if (flat.length === 0) {
    const cropCat = getAllCropsFlat().find(c => c.id === cropId)?.categoryId || 'TARLA';
    const fallbackArr = GENERIC_PROBLEMS[cropCat] || GENERIC_PROBLEMS.TARLA || [];
    fallbackArr.forEach((p, idx) => {
      flat.push({
        id: `GENERIC::${idx}`,
        stageId: 'GENERIC',
        stageName: 'Genel Gelişim Evreleri',
        type: p.type || 'GENEL',
        name: p.name || 'Sorun',
        description: p.description || '',
        commercialNames: Array.isArray(p.commercialNames) ? p.commercialNames : [],
        activeIngredients: Array.isArray(p.activeIngredients) ? p.activeIngredients : []
      });
    });
  }

  return flat;
}

function getBkuForInventoryMatch(pesticide: Pesticide, inventory: InventoryItem[]): InventoryItem | undefined {
  const normBkuName = normalizeTurkish(pesticide.name).replace(/\(imal\)|\(ithal\)/g, '').trim();
  const shortBkuToken = normBkuName.split(' ').slice(0, 2).join(' ').trim();
  const bkuActive = normalizeTurkish(pesticide.activeIngredient);

  return inventory.find(item => {
    if ((Number(item.quantity) || 0) <= 0) return false;
    const normInv = normalizeTurkish(item.pesticideName);
    if (!normInv) return false;
    if (normBkuName && (normInv.includes(normBkuName) || normBkuName.includes(normInv))) return true;
    if (shortBkuToken.length >= 4 && normInv.includes(shortBkuToken)) return true;
    if (bkuActive.length >= 5 && normInv.includes(bkuActive)) return true;
    return false;
  });
}

function daysBetweenToday(dateStr?: string): number | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.round((parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildSmartErpRadar(ctx: ErpIntelligenceContext): SmartErpRadar {
  const currency = ctx.userProfile?.currency || 'TRY';
  const companyName = ctx.userProfile?.companyName || 'MKS Zirai Bayi';
  const todayStr = new Date().toLocaleDateString('tr-TR');

  const activeInventory = (ctx.inventory || []).filter(i => !i.deletedAt);
  const activeFarmers = (ctx.farmers || []).filter(f => !f.deletedAt);
  const activeSuppliers = (ctx.suppliers || []).filter(s => !s.deletedAt);
  const activeAccounts = (ctx.accounts || []).filter(a => !a.deletedAt);

  const totalKasa = activeAccounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
  const totalReceivables = Number(ctx.stats?.totalDebt) || activeFarmers.reduce((acc, f) => acc + ((f.balance || 0) < 0 ? Math.abs(f.balance || 0) : 0), 0);
  const totalSupplierDebt = activeSuppliers.reduce((acc, s) => acc + ((s.balance || 0) < 0 ? Math.abs(s.balance || 0) : 0), 0);
  const netWorkingCapital = totalKasa + totalReceivables - totalSupplierDebt;

  const inventoryCost = Number(ctx.stats?.inventoryValue) || activeInventory.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.buyingPrice) || 0), 0);
  const potentialRevenue = Number(ctx.stats?.potentialRevenue) || activeInventory.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.sellingPrice) || 0), 0);
  const expectedGrossProfit = Math.max(0, potentialRevenue - inventoryCost);
  const averageMarginPct = inventoryCost > 0 ? ((potentialRevenue - inventoryCost) / inventoryCost) * 100 : 0;

  const debtorsRaw = activeFarmers
    .filter(f => (f.balance || 0) < -0.01)
    .sort((a, b) => (a.balance || 0) - (b.balance || 0));

  const topDebtors: DebtorRadarEntry[] = debtorsRaw.slice(0, 12).map(f => {
    const debt = Math.abs(f.balance || 0);
    const sharePct = totalReceivables > 0 ? (debt / totalReceivables) * 100 : 0;
    const fieldArea = (f.fields || []).reduce((sum, fld) => sum + (Number(fld.size) || 0), 0);
    const cropsSet = Array.from(new Set((f.fields || []).map(fld => fld.crop).filter(Boolean)));
    const riskLevel: DebtorRadarEntry['riskLevel'] =
      (f.creditLimit && debt >= f.creditLimit) || sharePct >= 10 || debt >= 250000
        ? 'YÜKSEK'
        : sharePct >= 4 || debt >= 75000
          ? 'ORTA'
          : 'DÜŞÜK';

    const msg = `Sayın ${f.fullName}, ${companyName} olarak ${todayStr} itibarıyla cari hesabınızdaki güncel bakiyeniz ${formatCurrency(debt, currency)} olarak görünmektedir. Bereketli sezonlar dileriz.`;
    return {
      id: f.id,
      fullName: f.fullName,
      village: f.village || 'Belirtilmemiş',
      phoneNumber: f.phoneNumber || '',
      debt,
      sharePct,
      riskLevel,
      fieldArea,
      cropsSummary: cropsSet.join(', ') || 'Genel',
      whatsappUrl: buildWaUrl(f.phoneNumber, msg)
    };
  });

  const criticalStockItems = activeInventory
    .filter(i => (Number(i.quantity) || 0) <= (Number(i.lowStockThreshold) || 5))
    .sort((a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0));

  const expiringItems: ExpiringRadarEntry[] = [];
  for (const item of activeInventory) {
    if ((Number(item.quantity) || 0) <= 0) continue;
    if (item.batches && item.batches.length > 0) {
      for (const b of item.batches) {
        if ((Number(b.quantity) || 0) <= 0 || !b.expiryDate) continue;
        const d = daysBetweenToday(b.expiryDate);
        if (d !== null && d <= 90) {
          expiringItems.push({
            item,
            lotNumber: b.lotNumber,
            expiryDate: b.expiryDate,
            daysLeft: d,
            batchQty: b.quantity,
            status: d < 0 ? 'SÜRESİ DOLMUŞ' : d <= 30 ? 'KRİTİK (≤30 GÜN)' : 'YAKLAŞAN (≤90 GÜN)'
          });
        }
      }
    } else if (item.expiryDate) {
      const d = daysBetweenToday(item.expiryDate);
      if (d !== null && d <= 90) {
        expiringItems.push({
          item,
          lotNumber: item.lotNumber,
          expiryDate: item.expiryDate,
          daysLeft: d,
          batchQty: item.quantity,
          status: d < 0 ? 'SÜRESİ DOLMUŞ' : d <= 30 ? 'KRİTİK (≤30 GÜN)' : 'YAKLAŞAN (≤90 GÜN)'
        });
      }
    }
  }
  expiringItems.sort((a, b) => a.daysLeft - b.daysLeft);

  const topMarginItems: MarginRadarEntry[] = activeInventory
    .filter(i => (Number(i.quantity) || 0) > 0 && (Number(i.buyingPrice) || 0) > 0 && (Number(i.sellingPrice) || 0) > (Number(i.buyingPrice) || 0))
    .map(item => {
      const unitProfit = (Number(item.sellingPrice) || 0) - (Number(item.buyingPrice) || 0);
      const marginPct = (unitProfit / (Number(item.buyingPrice) || 1)) * 100;
      return {
        item,
        unitProfit,
        marginPct,
        totalPotentialProfit: unitProfit * (Number(item.quantity) || 0)
      };
    })
    .sort((a, b) => b.totalPotentialProfit - a.totalPotentialProfit)
    .slice(0, 10);

  const pendingReminders = (ctx.reminders || [])
    .filter(r => !r.isCompleted)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const overdueReminderCount = pendingReminders.filter(r => {
    const d = daysBetweenToday(r.date);
    return d !== null && d <= 0;
  }).length;

  const recentVisitsWithFindings = (ctx.visits || [])
    .filter(v => !v.deletedAt && (v.pestFound || v.diseaseFound || v.note))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 6);

  const inStockCount = activeInventory.filter(i => (Number(i.quantity) || 0) > 0).length;
  const outOfStockCount = activeInventory.filter(i => (Number(i.quantity) || 0) <= 0).length;

  // Finansal Sağlık Skoru (0 - 100)
  let score = 68;
  if (netWorkingCapital > 0) score += 12;
  else score -= 18;
  if (totalKasa > totalSupplierDebt) score += 10;
  else if (totalSupplierDebt > 0 && totalKasa < totalSupplierDebt * 0.4) score -= 12;
  if (criticalStockItems.length > 8) score -= 8;
  else if (criticalStockItems.length <= 3) score += 5;
  if (expiringItems.some(e => e.daysLeft < 0)) score -= 7;
  if (averageMarginPct >= 20) score += 6;
  const financialScore = Math.max(18, Math.min(99, Math.round(score)));
  const scoreLabel: SmartErpRadar['scoreLabel'] =
    financialScore >= 82
      ? 'Çok Güçlü'
      : financialScore >= 64
        ? 'Dengeli'
        : financialScore >= 45
          ? 'Dikkat Gerektirir'
          : 'Kritik Baskı';

  const nowMonthIdx = new Date().getMonth();
  const currentMonthName = TR_MONTHS[nowMonthIdx] || 'Kasım';
  const seasonIdx =
    nowMonthIdx >= 2 && nowMonthIdx <= 4
      ? 0 // İlkbahar
      : nowMonthIdx >= 5 && nowMonthIdx <= 7
        ? 1 // Yaz
        : nowMonthIdx >= 8 && nowMonthIdx <= 10
          ? 2 // Sonbahar
          : 3; // Kış
  const currentSeasonItem = SEASONAL_CALENDAR[seasonIdx] || SEASONAL_CALENDAR[0];
  const currentMonthFocus = currentSeasonItem.monthlyFocus?.find(m =>
    turkishIncludes(m.month, currentMonthName)
  ) || currentSeasonItem.monthlyFocus?.[0];

  const totalAreaDekar = activeFarmers.reduce(
    (sum, f) => sum + (f.fields || []).reduce((fs, fld) => fs + (Number(fld.size) || 0), 0),
    0
  );

  return {
    currency,
    financialScore,
    scoreLabel,
    totalKasa,
    totalReceivables,
    debtorCount: debtorsRaw.length,
    totalSupplierDebt,
    netWorkingCapital,
    inventoryCost,
    potentialRevenue,
    expectedGrossProfit,
    averageMarginPct,
    totalSales: Number(ctx.stats?.totalSales) || 0,
    totalExpenses: Number(ctx.stats?.totalExpenses) || 0,
    activeFarmerCount: activeFarmers.length,
    totalAreaDekar,
    inStockCount,
    outOfStockCount,
    topDebtors,
    criticalStockItems,
    expiringItems,
    topMarginItems,
    pendingReminders,
    overdueReminderCount,
    recentVisitsWithFindings,
    currentMonthName,
    currentSeasonItem,
    currentMonthFocus
  };
}

function tokenizeQuery(query: string): string[] {
  const stopWords = new Set([
    've', 'ile', 'icin', 'için', 'bir', 'bu', 'su', 'şu', 'da', 'de', 'mi', 'mu', 'mı', 'ne',
    'kadar', 'nasil', 'nasıl', 'hangi', 'nedir', 'var', 'yok', 'en', 'gibi', 'gore', 'göre',
    'benim', 'bana', 'analiz', 'et', 'listele', 'oner', 'öner', 'yaz', 'yap', 'durum', 'durumu',
    'hakkinda', 'hakkında', 'ilac', 'ilaç', 'ilaclar', 'ilaçlar', 'doz', 'dozu', 'recete', 'reçete'
  ]);
  return normalizeTurkish(query)
    .split(/[^a-z0-9ğüşıöç]+/i)
    .filter(t => t.length >= 3 && !stopWords.has(t));
}

export function findMatchesForDiagnosis(
  cropHint: string | undefined,
  activeIngredientHint: string | undefined,
  problemHint: string | undefined,
  inventory: InventoryItem[]
): { depotMatches: InventoryItem[]; bkuMatches: BkuMatchResult[] } {
  const activeInv = (inventory || []).filter(i => !i.deletedAt && (Number(i.quantity) || 0) > 0);
  const terms = Array.from(
    new Set([
      ...tokenizeQuery(cropHint || ''),
      ...tokenizeQuery(activeIngredientHint || ''),
      ...tokenizeQuery(problemHint || '')
    ])
  );

  // BKÜ Arama
  const scoredBku: BkuMatchResult[] = [];
  for (const p of OFFICIAL_BKU_CATALOG) {
    let score = 0;
    let matchedCrop: string | undefined;
    let matchedPest: string | undefined;
    let matchedDosage = p.defaultDosage || '';
    let matchedPhi = p.phi;

    const pNameNorm = normalizeTurkish(p.name);
    const pActiveNorm = normalizeTurkish(p.activeIngredient);

    if (activeIngredientHint) {
      const actTokens = tokenizeQuery(activeIngredientHint);
      for (const t of actTokens) {
        if (pActiveNorm.includes(t)) score += 16;
        if (pNameNorm.includes(t)) score += 10;
      }
    }

    if (p.usages && p.usages.length > 0) {
      for (const u of p.usages) {
        const uCropNorm = normalizeTurkish(u.crop);
        const uPestNorm = normalizeTurkish(u.pest);
        let usageScore = 0;

        if (cropHint && (turkishIncludes(u.crop, cropHint) || tokenizeQuery(cropHint).some(t => uCropNorm.includes(t)))) {
          usageScore += 12;
        }
        if (problemHint) {
          const pTokens = tokenizeQuery(problemHint);
          for (const t of pTokens) {
            if (uPestNorm.includes(t)) usageScore += 14;
          }
        }
        if (usageScore > 0) {
          score += usageScore;
          matchedCrop = matchedCrop || u.crop;
          matchedPest = matchedPest || u.pest;
          if (u.dosage) matchedDosage = u.dosage;
          if (u.phi) matchedPhi = u.phi;
        }
      }
    } else {
      for (const t of terms) {
        if (pNameNorm.includes(t) || pActiveNorm.includes(t)) score += 6;
      }
    }

    if (score >= 12) {
      const inDepotItem = getBkuForInventoryMatch(p, activeInv);
      if (inDepotItem) score += 20;
      scoredBku.push({
        pesticide: p,
        matchedCrop: matchedCrop || p.targetCrops?.[0],
        matchedPest: matchedPest || p.targetPests?.[0],
        dosage: matchedDosage,
        phi: matchedPhi,
        inDepotItem,
        score
      });
    }
  }

  scoredBku.sort((a, b) => b.score - a.score);
  const bkuMatches = scoredBku.slice(0, 8);

  // Depo eşleşmeleri: BKU eşleşmesinden gelen + doğrudan ad/etken eşleşenler
  const depotMap = new Map<string, { item: InventoryItem; score: number }>();
  for (const bm of bkuMatches) {
    if (bm.inDepotItem) {
      depotMap.set(bm.inDepotItem.id, { item: bm.inDepotItem, score: bm.score });
    }
  }

  for (const item of activeInv) {
    const invNorm = normalizeTurkish(item.pesticideName);
    const catNorm = normalizeTurkish(item.category);
    let s = 0;
    for (const t of terms) {
      if (invNorm.includes(t)) s += 10;
      if (catNorm.includes(t)) s += 4;
    }
    if (s > 0) {
      const existing = depotMap.get(item.id);
      if (!existing || existing.score < s) {
        depotMap.set(item.id, { item, score: s });
      }
    }
  }

  const depotMatches = Array.from(depotMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(x => x.item);

  return { depotMatches, bkuMatches };
}

export function analyzeQueryLocallyAndEnrich(
  query: string,
  ctx: ErpIntelligenceContext,
  selectedCropId?: string
): QueryEnrichmentResult {
  const radar = buildSmartErpRadar(ctx);
  const qNorm = normalizeTurkish(query);
  const tokens = tokenizeQuery(query);
  const activeInv = (ctx.inventory || []).filter(i => !i.deletedAt);

  // 1. Niyet tespiti
  const intentTags: string[] = [];
  const isFinance = /borc|alacak|tahsilat|kasa|nakit|finans|kar|marj|ciro|tedarik|gider|cari/.test(qNorm);
  const isStock = /depo|stok|kritik|siparis|azalan|skt|miad|lot|urun|maliyet/.test(qNorm);
  const isTankMix = /karis|tank|ph|sertlik|wales|bakir|kukurt|yag/.test(qNorm);
  const isDeficiency = /noksan|eksik|sararma|kloroz|azot|fosfor|potas|cinko|demir|bor|magnezyum|kalsiyum/.test(qNorm);
  const isAgri = /hastalik|zararli|kurt|bit|mantar|fungus|pas|mildiyo|kullem|yanik|ot|yabanci|doz|recete|ilac|phi|bekleme|tarla/.test(qNorm);

  if (isFinance) intentTags.push('FİNANS & CARİ');
  if (isStock) intentTags.push('DEPO & SKT');
  if (isTankMix) intentTags.push('TANK KARIŞIMI');
  if (isDeficiency) intentTags.push('BESİN NOKSANLIĞI');
  if (isAgri || selectedCropId) intentTags.push('ZİRAİ TEŞHİS & BKÜ');
  if (intentTags.length === 0) intentTags.push('GENEL DANIŞMAN');

  // 2. Seçili veya soruda geçen bitkiyi belirle
  const allCrops = getAllCropsFlat();
  let detectedCrop = selectedCropId ? allCrops.find(c => c.id === selectedCropId) : undefined;
  if (!detectedCrop) {
    detectedCrop = allCrops.find(c => {
      const cNorm = normalizeTurkish(c.name);
      if (qNorm.includes(cNorm)) return true;
      const aliases = CROP_BKU_ALIASES[c.id] || [];
      return aliases.some(a => qNorm.includes(normalizeTurkish(a)));
    });
  }

  // 3. Depo stok eşleşmeleri
  const depotScored: { item: InventoryItem; score: number }[] = [];
  for (const item of activeInv) {
    const nameNorm = normalizeTurkish(item.pesticideName);
    const catNorm = normalizeTurkish(item.category);
    let score = 0;
    for (const t of tokens) {
      if (nameNorm.includes(t)) score += 12;
      if (catNorm.includes(t)) score += 5;
    }
    if (isStock && (Number(item.quantity) || 0) <= (Number(item.lowStockThreshold) || 5)) {
      score += 6;
    }
    if (score > 0) depotScored.push({ item, score });
  }
  depotScored.sort((a, b) => b.score - a.score);
  const depotMatches = depotScored.slice(0, 6).map(x => x.item);

  // 4. Resmi BKÜ Katalog Araması
  const cropAliases = detectedCrop ? (CROP_BKU_ALIASES[detectedCrop.id] || [detectedCrop.name]) : [];
  const scoredBku: BkuMatchResult[] = [];
  if (isAgri || detectedCrop || tokens.length > 0) {
    for (const p of OFFICIAL_BKU_CATALOG) {
      let score = 0;
      let matchedCrop: string | undefined;
      let matchedPest: string | undefined;
      let matchedDosage = p.defaultDosage || '';
      let matchedPhi = p.phi;

      const pNameNorm = normalizeTurkish(p.name);
      const pActNorm = normalizeTurkish(p.activeIngredient);
      const pGrpNorm = normalizeTurkish(p.bkuGroup || p.category);

      for (const t of tokens) {
        if (pNameNorm.includes(t)) score += 16;
        if (pActNorm.includes(t)) score += 15;
        if (pGrpNorm.includes(t)) score += 5;
      }

      if (p.usages && p.usages.length > 0) {
        for (const u of p.usages) {
          const uCropNorm = normalizeTurkish(u.crop);
          const uPestNorm = normalizeTurkish(u.pest);
          let uScore = 0;

          if (cropAliases.length > 0 && cropAliases.some(a => uCropNorm.includes(normalizeTurkish(a)))) {
            uScore += 10;
          }
          for (const t of tokens) {
            if (uPestNorm.includes(t)) uScore += 14;
          }
          if (uScore > 0) {
            score += uScore;
            matchedCrop = matchedCrop || u.crop;
            matchedPest = matchedPest || u.pest;
            if (u.dosage) matchedDosage = u.dosage;
            if (u.phi) matchedPhi = u.phi;
          }
        }
      }

      if (score >= 12) {
        const inDepotItem = getBkuForInventoryMatch(p, activeInv);
        if (inDepotItem) score += 22;
        scoredBku.push({
          pesticide: p,
          matchedCrop: matchedCrop || p.targetCrops?.[0],
          matchedPest: matchedPest || p.targetPests?.[0],
          dosage: matchedDosage,
          phi: matchedPhi,
          inDepotItem,
          score
        });
      }
    }
    scoredBku.sort((a, b) => b.score - a.score);
  }
  const bkuMatches = scoredBku.slice(0, 6);

  // BKÜ üzerinden tespit edilip depoda bulunan ilaçları depotMatches'a ekle
  for (const bm of bkuMatches) {
    if (bm.inDepotItem && !depotMatches.some(d => d.id === bm.inDepotItem!.id) && depotMatches.length < 6) {
      depotMatches.push(bm.inDepotItem);
    }
  }

  // 5. Problem Veritabanı Eşleşmeleri
  const matchedProblems: { cropId: string; cropName: string; problem: CropProblemFlatItem }[] = [];
  const targetCropsForProblemSearch = detectedCrop ? [detectedCrop] : allCrops;
  for (const c of targetCropsForProblemSearch) {
    const probs = getProblemsForCrop(c.id);
    for (const p of probs) {
      const combined = normalizeTurkish(`${p.name} ${p.description} ${p.activeIngredients.join(' ')}`);
      const hitCount = tokens.filter(t => combined.includes(t)).length;
      if ((detectedCrop && tokens.length === 0) || hitCount > 0) {
        matchedProblems.push({ cropId: c.id, cropName: c.name, problem: p });
      }
    }
    if (matchedProblems.length >= 6) break;
  }

  // 6. Besin Noksanlığı Eşleşmeleri
  const matchedDeficiencies = isDeficiency
    ? DEFICIENCY_GUIDE.filter(d => {
        const comb = normalizeTurkish(`${d.element} ${d.symbol} ${d.symptoms} ${d.visualCue}`);
        return tokens.some(t => comb.includes(t));
      }).slice(0, 4)
    : [];

  // 7. Cari / Borçlu Çiftçi Eşleşmeleri
  let debtorMatches: DebtorRadarEntry[] = [];
  const namedDebtors = radar.topDebtors.filter(d => {
    const dNorm = normalizeTurkish(`${d.fullName} ${d.village}`);
    return tokens.some(t => dNorm.includes(t));
  });
  if (namedDebtors.length > 0) {
    debtorMatches = namedDebtors.slice(0, 5);
  } else if (isFinance) {
    debtorMatches = radar.topDebtors.slice(0, 5);
  }

  // 8. KPI Özetleri
  const kpiHighlights: QueryEnrichmentResult['kpiHighlights'] = [];
  if (isFinance || isStock) {
    kpiHighlights.push(
      {
        label: 'Net İşletme Sermayesi',
        value: formatCurrency(radar.netWorkingCapital, radar.currency),
        tone: radar.netWorkingCapital >= 0 ? 'emerald' : 'rose'
      },
      {
        label: 'Kasa + Banka',
        value: formatCurrency(radar.totalKasa, radar.currency),
        tone: 'blue'
      },
      {
        label: 'Aktif Alacak',
        value: formatCurrency(radar.totalReceivables, radar.currency),
        tone: 'amber'
      },
      {
        label: 'Kritik Stok Kalemi',
        value: `${radar.criticalStockItems.length} Ürün`,
        tone: radar.criticalStockItems.length > 0 ? 'rose' : 'emerald'
      }
    );
  }

  // 9. Gemini için RAG Bağlam Metni
  const cropProfile = detectedCrop ? CROP_AGRONOMY_PROFILES[detectedCrop.id] : undefined;
  const ragParts: string[] = [
    `[CANLI İŞLETME ÖZETİ] Finansal Sağlık Skoru: ${radar.financialScore}/100 (${radar.scoreLabel}) | Kasa & Banka: ${formatCurrency(radar.totalKasa, radar.currency)} | Müşteri Alacağı: ${formatCurrency(radar.totalReceivables, radar.currency)} (${radar.debtorCount} borçlu cari) | Tedarikçi Borcu: ${formatCurrency(radar.totalSupplierDebt, radar.currency)} | Net İşletme Sermayesi: ${formatCurrency(radar.netWorkingCapital, radar.currency)}`,
    `[DEPO ÖZETİ] Toplam Çeşit: ${activeInv.length} (${radar.inStockCount} stokta, ${radar.outOfStockCount} tükendi) | Stok Maliyeti: ${formatCurrency(radar.inventoryCost, radar.currency)} | Potansiyel Satış Cirosu: ${formatCurrency(radar.potentialRevenue, radar.currency)} | Ortalama Kâr Marjı: %${radar.averageMarginPct.toFixed(1)}`,
    `[KRİTİK STOKLAR] ${radar.criticalStockItems.slice(0, 12).map(i => `${i.pesticideName}: ${i.quantity} ${i.unit}`).join(', ') || 'Yok'}`,
    `[YAKLAŞAN / GEÇMİŞ SKT] ${radar.expiringItems.slice(0, 8).map(e => `${e.item.pesticideName} (Lot: ${e.lotNumber || '-'}, SKT: ${e.expiryDate}, ${e.status})`).join(' | ') || 'Yaklaşan SKT yok'}`,
    `[EN YÜKSEK BORÇLU ÇİFTÇİLER] ${radar.topDebtors.slice(0, 8).map(d => `${d.fullName} (${d.village}): ${formatCurrency(d.debt, radar.currency)} [Risk: ${d.riskLevel}, Pay: %${d.sharePct.toFixed(1)}]`).join(' | ') || 'Borçlu cari yok'}`
  ];

  if (depotMatches.length > 0) {
    ragParts.push(
      `[SORGUYLA EŞLEŞEN DEPO İLAÇLARI]\n${depotMatches
        .map(i => `- ${i.pesticideName} (${i.category}): ${i.quantity} ${i.unit} | Alış: ${formatCurrency(i.buyingPrice, radar.currency)}, Satış: ${formatCurrency(i.sellingPrice, radar.currency)}`)
        .join('\n')}`
    );
  } else {
    ragParts.push(
      `[DEPODAKİ İLK 25 MEVCUT ÜRÜN]\n${activeInv
        .filter(i => (Number(i.quantity) || 0) > 0)
        .slice(0, 25)
        .map(i => `- ${i.pesticideName} (${i.category}): ${i.quantity} ${i.unit} | Satış: ${formatCurrency(i.sellingPrice, radar.currency)}`)
        .join('\n') || 'Depoda stok bulunmuyor'}`
    );
  }

  if (bkuMatches.length > 0) {
    ragParts.push(
      `[T.C. TARIM BAKANLIĞI RESMİ BKÜ KATALOĞU EŞLEŞMELERİ]\n${bkuMatches
        .map(b => `- ${b.pesticide.name} | Etken: ${b.pesticide.activeIngredient} | Bitki/Hedef: ${b.matchedCrop || '-'} / ${b.matchedPest || '-'} | Resmi Doz: ${b.dosage} | PHI: ${b.phi || 'Belirtilmemiş'} ${b.inDepotItem ? `-> [DEPODA MEVCUT: ${b.inDepotItem.quantity} ${b.inDepotItem.unit}]` : '-> (Depoda yok)'}`)
        .join('\n')}`
    );
  }

  if (cropProfile) {
    ragParts.push(
      `[BİTKİ AGRONOMİ PASAPORTU - ${cropProfile.name} (${cropProfile.scientificName})]\nOptimum Toprak pH: ${cropProfile.optimalSoilPh} | Su İhtiyacı: ${cropProfile.waterRequirementMm} | NPK (kg/da): ${cropProfile.npkPureKgPerDa} | Kritik Sıcaklık: ${cropProfile.criticalTemp} | EZE: ${cropProfile.economicThresholds.slice(0, 3).map(e => `${e.pestOrDisease}: ${e.threshold}`).join('; ')}`
    );
  }

  if (isTankMix) {
    ragParts.push(
      `[TANK KARIŞIMI & SU KALİTESİ REFERANSI] İdeal Su pH: ${WATER_QUALITY_GUIDE[0]?.idealRange} | Karıştırma Sırası (WALES): ${MIXING_ORDER_STEPS.join(' -> ')}`
    );
  }

  // 10. Takip Önerileri
  const followUpSuggestions: string[] = [];
  if (isFinance) {
    followUpSuggestions.push(
      'En yüksek borçlu 5 çiftçi için tahsilat ve WhatsApp iletişim planı hazırla',
      'Depodaki kâr marjı en yüksek ürünleri ve nakde dönüş hızını analiz et',
      'Kasa nakdi ve tedarikçi borcu vade dengesini değerlendir'
    );
  } else if (isStock) {
    followUpSuggestions.push(
      'SKT süresi yaklaşan lotlar için kampanya ve eritme stratejisi öner',
      'Kritik seviyenin altına düşen ürünlerde tahmini sipariş listesi çıkar',
      'Bu ay en çok satılan mahsullere göre depo stok yeterliliğini kontrol et'
    );
  } else if (detectedCrop) {
    followUpSuggestions.push(
      `${detectedCrop.name} için deponuzdaki uygun BKÜ ilaçlarıyla ekonomik reçete oluştur`,
      `${detectedCrop.name} gübreleme programını ve kritik sulama evrelerini özetle`,
      `${detectedCrop.name} ilaçlamasında tank karışımı ve su pH uyarılarını listele`
    );
  } else {
    followUpSuggestions.push(
      'Depodaki mevcut stoklara göre bu ayın öne çıkan bitki koruma reçetelerini listele',
      'İşletmemin nakit, alacak, stok ve kârlılık Check-Up analizini yap',
      'Kritik stok ve yaklaşan SKT uyarılarını özetle'
    );
  }

  // 11. Zengin Yerel / Yedek Zeka Yanıtı (Bulut çevrimdışı olsa bile anında tam veri yanıtı)
  const fallbackLines: string[] = [];
  fallbackLines.push(`**MKS Akıllı Yerel & RAG Analiz Raporu** (${intentTags.join(' • ')})`);

  if (isFinance) {
    fallbackLines.push(
      `1. **Finansal Sağlık & Bilanço Özeti**:\n` +
      `- **Sağlık Skoru**: ${radar.financialScore}/100 (${radar.scoreLabel})\n` +
      `- **Kasa ve Banka Mevcudu**: ${formatCurrency(radar.totalKasa, radar.currency)}\n` +
      `- **Müşteri Alacakları**: ${formatCurrency(radar.totalReceivables, radar.currency)} (${radar.debtorCount} borçlu cari)\n` +
      `- **Tedarikçi Borçları**: ${formatCurrency(radar.totalSupplierDebt, radar.currency)}\n` +
      `- **Net İşletme Sermayesi**: ${formatCurrency(radar.netWorkingCapital, radar.currency)}`
    );
    if (debtorMatches.length > 0) {
      fallbackLines.push(
        `2. **Öncelikli Tahsilat Listesi**:\n` +
        debtorMatches
          .map((d, i) => `${i + 1}. **${d.fullName}** (${d.village}) — **${formatCurrency(d.debt, radar.currency)}** (Pay: %${d.sharePct.toFixed(1)}, Risk: ${d.riskLevel})`)
          .join('\n')
      );
    }
  }

  if (isStock) {
    fallbackLines.push(
      `3. **Depo Stok & SKT Analizi**:\n` +
      `- **Depo Maliyeti**: ${formatCurrency(radar.inventoryCost, radar.currency)} | **Potansiyel Ciro**: ${formatCurrency(radar.potentialRevenue, radar.currency)} (Ort. Marj: %${radar.averageMarginPct.toFixed(1)})\n` +
      `- **Kritik / Tükenen Stoklar (${radar.criticalStockItems.length} Ürün)**: ${radar.criticalStockItems.slice(0, 8).map(i => `**${i.pesticideName}** (${i.quantity} ${i.unit})`).join(', ') || 'Kritik seviyede ürün bulunmuyor.'}\n` +
      `- **SKT Riski Taşıyan Lotlar (${radar.expiringItems.length} Kayıt)**: ${radar.expiringItems.slice(0, 5).map(e => `**${e.item.pesticideName}** (${e.expiryDate} — ${e.status})`).join(', ') || '90 gün içinde dolacak SKT kaydı yok.'}`
    );
  }

  if (bkuMatches.length > 0) {
    fallbackLines.push(
      `4. **Resmi Bakanlık BKÜ & Depo Eşleşmeleri**:\n` +
      bkuMatches
        .slice(0, 5)
        .map(b => `- **${b.pesticide.name}** (${b.pesticide.activeIngredient}) — Doz: **${b.dosage}** | PHI: ${b.phi || '-'}${b.inDepotItem ? ` — **[Depoda Var: ${b.inDepotItem.quantity} ${b.inDepotItem.unit}]**` : ''}`)
        .join('\n')
    );
  }

  if (matchedProblems.length > 0) {
    fallbackLines.push(
      `5. **Agronomik Bilgi Tabanı Eşleşmeleri**:\n` +
      matchedProblems
        .slice(0, 4)
        .map(mp => `- **${mp.cropName} / ${mp.problem.name}**: ${mp.problem.description} (Etkenler: ${mp.problem.activeIngredients.join(', ') || '-'})`)
        .join('\n')
    );
  }

  if (matchedDeficiencies.length > 0) {
    fallbackLines.push(
      `6. **Besin Noksanlığı Ayırıcı Tanı**:\n` +
      matchedDeficiencies
        .map(d => `- **${d.element} (${d.symbol})** [${d.targetLeaves}]: ${d.symptoms} → **Çözüm**: ${d.solution}`)
        .join('\n')
    );
  }

  if (isTankMix) {
    fallbackLines.push(
      `7. **Tank Karışım & Su Kalitesi Protokolü (WALES)**:\n` +
      MIXING_ORDER_STEPS.map(s => `- ${s}`).join('\n')
    );
  }

  if (fallbackLines.length === 1) {
    fallbackLines.push(
      `- **Kasa & Banka**: ${formatCurrency(radar.totalKasa, radar.currency)} | **Alacak**: ${formatCurrency(radar.totalReceivables, radar.currency)} | **Kritik Stok**: ${radar.criticalStockItems.length} Ürün.\n` +
      `- **Bu Ayın Zirai Odağı (${radar.currentMonthName})**: ${radar.currentMonthFocus?.priority || radar.currentSeasonItem.tasks[0]}\n` +
      `- Daha derin yapay zeka yorumu için sol menüden bitki seçip sorunuza devam edebilirsiniz.`
    );
  }

  return {
    intentTags,
    depotMatches,
    bkuMatches,
    debtorMatches,
    matchedDeficiencies,
    matchedProblems,
    kpiHighlights,
    ragContext: ragParts.join('\n\n'),
    followUpSuggestions,
    localFallbackAnswer: fallbackLines.join('\n\n')
  };
}

function parseDosageNumber(dosageStr: string): {
  value: number;
  unit: 'ml' | 'l' | 'g' | 'kg';
  basis: 'DA' | '100L' | 'UNKNOWN';
} | null {
  if (!dosageStr) return null;
  const clean = dosageStr.replace(/,/g, '.');
  const norm = normalizeTurkish(clean);

  // "200-250 ml/da" veya "100 ml / 100 l su"
  const match = clean.match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(ml|cc|lt|l|gr|g|kg)\b/i);
  if (!match) return null;

  const num1 = parseFloat(match[1]);
  const num2 = match[2] ? parseFloat(match[2]) : num1;
  const avg = (num1 + num2) / 2;
  const rawUnit = match[3].toLowerCase();
  const unit: 'ml' | 'l' | 'g' | 'kg' =
    rawUnit === 'cc' || rawUnit === 'ml'
      ? 'ml'
      : rawUnit === 'lt' || rawUnit === 'l'
        ? 'l'
        : rawUnit === 'gr' || rawUnit === 'g'
          ? 'g'
          : 'kg';

  let basis: 'DA' | '100L' | 'UNKNOWN' = 'UNKNOWN';
  if (/\/\s*100\s*l|100\s*lt|100\s*l\s*su/.test(norm)) {
    basis = '100L';
  } else if (/\/\s*da\b|dekara|dekar/.test(norm)) {
    basis = 'DA';
  }

  return { value: avg, unit, basis };
}

function formatScaledAmount(val: number, unit: 'ml' | 'l' | 'g' | 'kg'): string {
  if (!Number.isFinite(val) || val <= 0) return '-';
  if (unit === 'ml' && val >= 1000) return `${(val / 1000).toFixed(2)} L`;
  if (unit === 'g' && val >= 1000) return `${(val / 1000).toFixed(2)} kg`;
  return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${unit}`;
}

export function calculateSmartPrescription(params: {
  cropId: string;
  problemId: string;
  areaDekar: number;
  tankLiters: number;
  waterPerDekarLiters: number;
  inventory: InventoryItem[];
}): SmartPrescriptionCalcResult {
  const { cropId, problemId, areaDekar, tankLiters, waterPerDekarLiters, inventory } = params;
  const cropName = getCropDisplayName(cropId);
  const allProblems = getProblemsForCrop(cropId);
  const selectedProb = allProblems.find(p => p.id === problemId) || allProblems[0];

  const safeArea = Math.max(0.5, Number(areaDekar) || 1);
  const safeWaterPerDa = Math.max(5, Number(waterPerDekarLiters) || 25);
  const safeTank = Math.max(10, Number(tankLiters) || 400);

  const totalWaterLiters = Math.round(safeArea * safeWaterPerDa);
  const exactTanks = totalWaterLiters / safeTank;
  const fullTanksCount = Math.ceil(exactTanks);

  const activeInv = (inventory || []).filter(i => !i.deletedAt);
  const diag = findMatchesForDiagnosis(
    cropName,
    selectedProb?.activeIngredients?.join(' '),
    selectedProb?.name,
    activeInv
  );

  const products: SmartPrescriptionProductLine[] = [];
  const seenNames = new Set<string>();

  for (const bm of diag.bkuMatches) {
    const key = normalizeTurkish(bm.pesticide.name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    const parsed = parseDosageNumber(bm.dosage);
    let perDekarAmount: number | undefined;
    let perTankAmount: number | undefined;
    let totalRequiredAmount: number | undefined;

    if (parsed) {
      if (parsed.basis === '100L') {
        perTankAmount = (parsed.value * safeTank) / 100;
        totalRequiredAmount = (parsed.value * totalWaterLiters) / 100;
        perDekarAmount = totalRequiredAmount / safeArea;
      } else {
        perDekarAmount = parsed.value;
        totalRequiredAmount = parsed.value * safeArea;
        perTankAmount = totalRequiredAmount / exactTanks;
      }
    }

    const inDepot = bm.inDepotItem;
    const stockQty = inDepot ? Number(inDepot.quantity) || 0 : 0;
    const unitPrice = inDepot ? Number(inDepot.sellingPrice) || 0 : undefined;

    let normalizedNeededInDepotUnits = 0;
    if (totalRequiredAmount && parsed && inDepot) {
      const invUnit = normalizeTurkish(inDepot.unit);
      if ((invUnit.includes('lt') || invUnit.includes('litre') || invUnit === 'l') && parsed.unit === 'ml') {
        normalizedNeededInDepotUnits = totalRequiredAmount / 1000;
      } else if (invUnit.includes('kg') && parsed.unit === 'g') {
        normalizedNeededInDepotUnits = totalRequiredAmount / 1000;
      } else {
        normalizedNeededInDepotUnits = totalRequiredAmount / (parsed.unit === 'l' || parsed.unit === 'kg' ? 1 : 1000);
      }
    }

    const estimatedCost =
      unitPrice && normalizedNeededInDepotUnits > 0 ? normalizedNeededInDepotUnits * unitPrice : undefined;

    products.push({
      source: inDepot ? 'DEPO + BKÜ' : 'RESMİ BKÜ',
      name: bm.pesticide.name,
      activeIngredient: bm.pesticide.activeIngredient,
      group: bm.pesticide.bkuGroup || bm.pesticide.category,
      dosageLabel: bm.dosage || 'Etiket Dozu',
      phi: bm.phi,
      parsedUnit: parsed?.unit || '-',
      perDekarAmount,
      perTankAmount,
      totalRequiredAmount,
      formattedTotalRequired: parsed && totalRequiredAmount ? formatScaledAmount(totalRequiredAmount, parsed.unit) : bm.dosage,
      formattedPerTank: parsed && perTankAmount ? formatScaledAmount(perTankAmount, parsed.unit) : 'Ölçüm Gerekli',
      inDepotItem: inDepot,
      depotUnitPrice: unitPrice,
      estimatedCost,
      stockStatus: !inDepot
        ? 'DEPODA YOK'
        : normalizedNeededInDepotUnits > 0 && stockQty >= normalizedNeededInDepotUnits
          ? 'YETERLİ'
          : 'STOK KONTROLÜ GEREKLİ'
    });
  }

  // Eğer BKÜ kataloğunda az eşleşme varsa problem database ticari referanslarını ekle
  if (products.length < 3 && selectedProb?.commercialNames?.length) {
    selectedProb.commercialNames.forEach((cn, idx) => {
      if (seenNames.has(normalizeTurkish(cn))) return;
      seenNames.add(normalizeTurkish(cn));
      const invMatch = activeInv.find(i =>
        (Number(i.quantity) || 0) > 0 &&
        (turkishIncludes(i.pesticideName, cn.split('(')[0].trim()) ||
          selectedProb.activeIngredients.some(ai => turkishIncludes(i.pesticideName, ai)))
      );
      products.push({
        source: invMatch ? 'DEPO' : 'RESMİ BKÜ',
        name: cn,
        activeIngredient: selectedProb.activeIngredients[idx] || selectedProb.activeIngredients[0] || 'Etiket Bileşimi',
        group: selectedProb.type,
        dosageLabel: 'Prospektüs / Etiket Dozu',
        parsedUnit: '-',
        formattedTotalRequired: 'Etiket Dozu × ' + safeArea + ' da',
        formattedPerTank: 'Su Hacmine Oranlı',
        inDepotItem: invMatch,
        depotUnitPrice: invMatch ? Number(invMatch.sellingPrice) || 0 : undefined,
        stockStatus: invMatch ? 'STOK KONTROLÜ GEREKLİ' : 'DEPODA YOK'
      });
    });
  }

  return {
    cropName,
    problemName: selectedProb?.name || 'Genel Mücadele',
    problemType: selectedProb?.type || 'GENEL',
    problemDescription: selectedProb?.description || 'Seçili bitki ve hedef için teknik mücadele protokolü.',
    areaDekar: safeArea,
    waterPerDekarLiters: safeWaterPerDa,
    totalWaterLiters,
    tankLiters: safeTank,
    exactTanks,
    fullTanksCount,
    mixingOrder: [...MIXING_ORDER_STEPS],
    products: products.slice(0, 8),
    waterRulesNote: `Su pH: ${WATER_QUALITY_GUIDE[0]?.idealRange} | Sertlik: ${WATER_QUALITY_GUIDE[1]?.idealRange}`
  };
}

export { TANK_MIX_GUIDE, WATER_QUALITY_GUIDE, DEFICIENCY_GUIDE };

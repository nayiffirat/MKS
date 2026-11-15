import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bug,
  CheckCircle2,
  Clock,
  Droplets,
  Edit3,
  FlaskConical,
  Globe,
  Layers,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  Sprout,
  Tag
} from 'lucide-react';
import { dbService } from '../services/db';
import { Pesticide, PesticideCategory } from '../types';
import BarcodeScanner from './LazyBarcodeScanner';
import { ModalCloseButton } from './ModalCloseButton';
import { useBackHandler } from '../utils/navigationManager';
import { useAppViewModel } from '../context/AppContext';
import { turkishMatchesAny } from '../utils/search';
import { parseGS1Barcode, canonicalBarcodeFromParsed, findItemByScan } from '../utils/gs1Parser';
import { playScanBeep, playErrorBeep } from '../utils/hardwareBarcodeScanner';
import { OFFICIAL_BKU_CATALOG } from '../constants/bkuCatalog';
import {
  enrichIncompletePesticide,
  normalizeBkuProductName,
  sanitizePesticideForDb,
  searchLiveBkuDatabase
} from '../utils/bkuService';

type SourceTab = 'ALL' | 'LIBRARY' | 'BKU';
type KpiFilterMode = 'ALL' | 'INSECT_MITICIDE' | 'FUNG_HERB' | 'NUTRITION_SEED';

interface DisplayPesticideItem {
  item: Pesticide;
  inLibrary: boolean;
  isOfficialBku: boolean;
  isLiveResult: boolean;
}

const CROP_FILTER_CHIPS = [
  'Tümü',
  'Pamuk',
  'Mısır',
  'Buğday',
  'Antepfıstığı',
  'Domates',
  'Biber',
  'Zeytin',
  'Bağ',
  'Elma',
  'Patates',
  'Ayçiçeği'
];

const INITIAL_PAGE_SIZE = 36;

const getCategoryBadgeClass = (category: PesticideCategory): string => {
  switch (category) {
    case PesticideCategory.INSECTICIDE:
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
    case PesticideCategory.FUNGICIDE:
      return 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20';
    case PesticideCategory.HERBICIDE:
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20';
    case PesticideCategory.NEMATICIDE:
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20';
    case PesticideCategory.GROWTH_REGULATOR:
      return 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20';
    case PesticideCategory.FERTILIZER:
    case PesticideCategory.GRANULAR_FERTILIZER:
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
    case PesticideCategory.SEED:
      return 'bg-lime-500/10 text-lime-800 dark:text-lime-300 border-lime-500/20';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';
  }
};

const isMissingField = (val?: string): boolean => {
  if (!val) return true;
  const norm = val.trim().toLocaleLowerCase('tr-TR');
  return norm === '' || norm === 'belirtilmedi' || norm === '-';
};

const parseCommaList = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i);

export const Pesticides: React.FC = () => {
  const { showToast } = useAppViewModel();

  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [liveSearching, setLiveSearching] = useState(false);
  const [liveBkuResults, setLiveBkuResults] = useState<Pesticide[]>([]);
  const [lastLiveQuery, setLastLiveQuery] = useState<string>('');

  // Filters & navigation state
  const [sourceTab, setSourceTab] = useState<SourceTab>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [kpiFilter, setKpiFilter] = useState<KpiFilterMode>('ALL');
  const [selectedCrop, setSelectedCrop] = useState<string>('Tümü');
  const [visibleLimit, setVisibleLimit] = useState<number>(INITIAL_PAGE_SIZE);

  // Modals & Scanner
  const [detailEntry, setDetailEntry] = useState<DisplayPesticideItem | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'MODAL' | 'SEARCH' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isSavingPesticide, setIsSavingPesticide] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [defaultDosage, setDefaultDosage] = useState('');
  const [category, setCategory] = useState<PesticideCategory>(PesticideCategory.INSECTICIDE);
  const [phi, setPhi] = useState('');
  const [targetCropsInput, setTargetCropsInput] = useState('');
  const [targetPestsInput, setTargetPestsInput] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [editingExistingUsages, setEditingExistingUsages] = useState<Pesticide['usages']>(undefined);
  const [editingBkuGroup, setEditingBkuGroup] = useState<string | undefined>(undefined);
  const [editingBkuRuhsatId, setEditingBkuRuhsatId] = useState<string | undefined>(undefined);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const enrichedOnceRef = useRef(false);

  const loadPesticides = useCallback(async (runAutoEnrich = false) => {
    try {
      const list = await dbService.getPesticides();
      setPesticides(list);

      if (runAutoEnrich && !enrichedOnceRef.current) {
        enrichedOnceRef.current = true;
        const updates: Pesticide[] = [];
        for (const item of list) {
          const enriched = enrichIncompletePesticide(item);
          if (enriched) {
            updates.push(enriched);
          }
        }
        if (updates.length > 0) {
          await Promise.all(
            updates.map((upd) => dbService.updateGlobalPesticide(upd).catch(() => undefined))
          );
          const refreshed = await dbService.getPesticides();
          setPesticides(refreshed);
          showToast(
            `${updates.length} eksik kütüphane kaydı BKÜ / gübre / tohum verileriyle otomatik tamamlandı.`,
            'success'
          );
        }
      }
    } catch {
      showToast('İlaç kütüphanesi yüklenemedi.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPesticides(true);
  }, [loadPesticides]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleLimit(INITIAL_PAGE_SIZE);
  }, [sourceTab, searchTerm, selectedCategory, kpiFilter, selectedCrop]);

  useBackHandler(!!scannerTarget, () => setScannerTarget(null));
  useBackHandler(showModal && !scannerTarget, () => setShowModal(false));
  useBackHandler(!!detailEntry && !showModal && !scannerTarget, () => setDetailEntry(null));

  const libraryByNormalizedName = useMemo(() => {
    const map = new Map<string, Pesticide>();
    for (const p of pesticides) {
      map.set(normalizeBkuProductName(p.name), p);
    }
    return map;
  }, [pesticides]);

  const bkuByNormalizedName = useMemo(() => {
    const map = new Map<string, Pesticide>();
    for (const b of OFFICIAL_BKU_CATALOG) {
      map.set(normalizeBkuProductName(b.name), b);
    }
    return map;
  }, []);

  const liveByNormalizedName = useMemo(() => {
    const map = new Map<string, Pesticide>();
    for (const b of liveBkuResults) {
      map.set(normalizeBkuProductName(b.name), b);
    }
    return map;
  }, [liveBkuResults]);

  // Merge user's saved library + official BKU catalog + live query hits without duplicates
  const combinedItems = useMemo<DisplayPesticideItem[]>(() => {
    const result: DisplayPesticideItem[] = [];
    const seenNames = new Set<string>();

    // 1. Saved library items (enriched view if matching official BKU record exists)
    for (const p of pesticides) {
      const norm = normalizeBkuProductName(p.name);
      const bkuMatch = bkuByNormalizedName.get(norm) || liveByNormalizedName.get(norm);
      const merged: Pesticide = bkuMatch
        ? {
            ...p,
            activeIngredient: !isMissingField(p.activeIngredient) ? p.activeIngredient : bkuMatch.activeIngredient,
            defaultDosage:
              p.defaultDosage && p.defaultDosage.toLocaleLowerCase('tr-TR') !== '100ml/100l'
                ? p.defaultDosage
                : bkuMatch.defaultDosage,
            targetCrops: p.targetCrops?.length ? p.targetCrops : bkuMatch.targetCrops,
            targetPests: p.targetPests?.length ? p.targetPests : bkuMatch.targetPests,
            phi: p.phi || bkuMatch.phi,
            bkuGroup: p.bkuGroup || bkuMatch.bkuGroup,
            bkuRuhsatId: p.bkuRuhsatId || bkuMatch.bkuRuhsatId,
            usages: p.usages?.length ? p.usages : bkuMatch.usages
          }
        : p;

      result.push({
        item: merged,
        inLibrary: true,
        isOfficialBku: Boolean(p.bkuRuhsatId || bkuMatch),
        isLiveResult: false
      });
      seenNames.add(norm);
    }

    // 2. Live BKU results not already in library
    for (const liveItem of liveBkuResults) {
      const norm = normalizeBkuProductName(liveItem.name);
      if (seenNames.has(norm)) continue;
      result.push({
        item: liveItem,
        inLibrary: false,
        isOfficialBku: true,
        isLiveResult: true
      });
      seenNames.add(norm);
    }

    // 3. Bundled Official BKU Catalog not already in library or live results
    for (const catItem of OFFICIAL_BKU_CATALOG) {
      const norm = normalizeBkuProductName(catItem.name);
      if (seenNames.has(norm)) continue;
      result.push({
        item: catItem,
        inLibrary: false,
        isOfficialBku: true,
        isLiveResult: false
      });
      seenNames.add(norm);
    }

    return result;
  }, [pesticides, bkuByNormalizedName, liveByNormalizedName, liveBkuResults]);

  const kpiStats = useMemo(() => {
    const totalAll = combinedItems.length;
    const inLibCount = pesticides.length;
    const bkuCount = OFFICIAL_BKU_CATALOG.length + liveBkuResults.length;
    const insectMiticides = combinedItems.filter(
      (e) =>
        e.item.category === PesticideCategory.INSECTICIDE ||
        e.item.category === PesticideCategory.NEMATICIDE
    ).length;
    const fungHerb = combinedItems.filter(
      (e) =>
        e.item.category === PesticideCategory.FUNGICIDE ||
        e.item.category === PesticideCategory.HERBICIDE
    ).length;
    const nutritionSeed = combinedItems.filter(
      (e) =>
        e.item.category === PesticideCategory.FERTILIZER ||
        e.item.category === PesticideCategory.GRANULAR_FERTILIZER ||
        e.item.category === PesticideCategory.SEED ||
        e.item.category === PesticideCategory.GROWTH_REGULATOR
    ).length;
    const incompleteCount = pesticides.filter(
      (p) => isMissingField(p.activeIngredient) || !p.targetCrops?.length
    ).length;

    return {
      totalAll,
      inLibCount,
      bkuCount,
      insectMiticides,
      fungHerb,
      nutritionSeed,
      incompleteCount
    };
  }, [combinedItems, pesticides, liveBkuResults]);

  const filteredItems = useMemo(() => {
    return combinedItems.filter((entry) => {
      const p = entry.item;

      // Source tab filter
      if (sourceTab === 'LIBRARY' && !entry.inLibrary) return false;
      if (sourceTab === 'BKU' && !entry.isOfficialBku) return false;

      // KPI quick filter
      if (kpiFilter === 'INSECT_MITICIDE') {
        if (
          p.category !== PesticideCategory.INSECTICIDE &&
          p.category !== PesticideCategory.NEMATICIDE
        ) {
          return false;
        }
      } else if (kpiFilter === 'FUNG_HERB') {
        if (
          p.category !== PesticideCategory.FUNGICIDE &&
          p.category !== PesticideCategory.HERBICIDE
        ) {
          return false;
        }
      } else if (kpiFilter === 'NUTRITION_SEED') {
        if (
          p.category !== PesticideCategory.FERTILIZER &&
          p.category !== PesticideCategory.GRANULAR_FERTILIZER &&
          p.category !== PesticideCategory.SEED &&
          p.category !== PesticideCategory.GROWTH_REGULATOR
        ) {
          return false;
        }
      }

      // Exact category pill filter
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) {
        return false;
      }

      // Crop chip filter
      if (selectedCrop !== 'Tümü') {
        const cropFields: (string | undefined)[] = [
          ...(p.targetCrops || []),
          ...(p.usages?.map((u) => u.crop) || [])
        ];
        if (!turkishMatchesAny(cropFields, selectedCrop)) {
          return false;
        }
      }

      // Search query filter
      if (searchTerm.trim()) {
        const parsedScan = parseGS1Barcode(searchTerm.trim());
        if (parsedScan.valid && parsedScan.gtin) {
          const found = findItemByScan([p], parsedScan);
          if (found) return true;
        }
        const searchFields: (string | undefined)[] = [
          p.name,
          p.activeIngredient,
          p.defaultDosage,
          p.bkuGroup,
          p.barcode,
          p.description,
          ...(p.targetCrops || []),
          ...(p.targetPests || []),
          ...(p.usages?.map((u) => u.crop) || []),
          ...(p.usages?.map((u) => u.pest) || [])
        ];
        if (!turkishMatchesAny(searchFields, searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [combinedItems, sourceTab, kpiFilter, selectedCategory, selectedCrop, searchTerm]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit]
  );

  const handleLiveBkuSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchTerm).trim();
    if (q.length < 2) {
      showToast('Canlı BKÜ sorgusu için arama kutusuna en az 2 karakter yazın (örn. Coragen, Pamuk, Abamectin).', 'info');
      searchInputRef.current?.focus();
      return;
    }

    setLiveSearching(true);
    try {
      const results = await searchLiveBkuDatabase(q);
      setLiveBkuResults(results);
      setLastLiveQuery(q);
      if (results.length > 0) {
        setSourceTab('BKU');
        showToast(`Bakanlık BKÜ veritabanından "${q}" için ${results.length} ruhsatlı ürün getirildi.`, 'success');
      } else {
        showToast(`"${q}" için Bakanlık canlı BKÜ sorgusunda kayıt bulunamadı.`, 'info');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'BKÜ sunucusuna erişilemedi.';
      showToast(`Canlı BKÜ bağlantısı başarısız (${msg}). Yerleşik ${OFFICIAL_BKU_CATALOG.length} ürünlük BKÜ rehberi devrede.`, 'info');
    } finally {
      setLiveSearching(false);
    }
  };

  const handleEnrichAndSyncLibrary = async () => {
    setEnriching(true);
    try {
      let updatedCount = 0;
      const latest = await dbService.getPesticides();

      for (const item of latest) {
        const enriched = enrichIncompletePesticide(item);
        if (enriched) {
          await dbService.updateGlobalPesticide(enriched);
          updatedCount++;
          continue;
        }
        // Also upgrade existing items that lack targetCrops/usages via OFFICIAL_BKU_CATALOG
        if (!item.usages?.length || !item.targetCrops?.length) {
          const bkuMatch = bkuByNormalizedName.get(normalizeBkuProductName(item.name));
          if (bkuMatch) {
            const upgraded = sanitizePesticideForDb({
              ...item,
              activeIngredient: isMissingField(item.activeIngredient)
                ? bkuMatch.activeIngredient
                : item.activeIngredient,
              targetCrops: item.targetCrops?.length ? item.targetCrops : bkuMatch.targetCrops,
              targetPests: item.targetPests?.length ? item.targetPests : bkuMatch.targetPests,
              phi: item.phi || bkuMatch.phi,
              bkuGroup: item.bkuGroup || bkuMatch.bkuGroup,
              bkuRuhsatId: item.bkuRuhsatId || bkuMatch.bkuRuhsatId,
              usages: bkuMatch.usages
            });
            await dbService.updateGlobalPesticide(upgraded);
            updatedCount++;
          }
        }
      }

      await loadPesticides(false);
      if (updatedCount > 0) {
        showToast(`${updatedCount} kütüphane kaydı BKÜ ve tarımsal verilerle güncellendi.`, 'success');
      } else {
        showToast('Tüm mevcut kütüphane kayıtlarınız güncel durumda.', 'info');
      }
    } catch {
      showToast('Kütüphane eşitleme sırasında bir hata oluştu.', 'error');
    } finally {
      setEnriching(false);
    }
  };

  const handleQuickAddFromCatalog = async (catalogItem: Pesticide) => {
    if (savingId) return;
    setSavingId(catalogItem.id);
    try {
      const latest = await dbService.getPesticides();
      const normName = normalizeBkuProductName(catalogItem.name);
      if (latest.some((p) => normalizeBkuProductName(p.name) === normName)) {
        showToast(`"${catalogItem.name}" zaten kütüphanenizde kayıtlı.`, 'info');
        await loadPesticides(false);
        return;
      }

      const newRecord = sanitizePesticideForDb({
        ...catalogItem,
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      });
      await dbService.addGlobalPesticide(newRecord);
      await loadPesticides(false);
      showToast(`"${catalogItem.name}" kütüphanenize eklendi.`, 'success');
    } catch {
      showToast('Ürün kütüphaneye eklenemedi.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setName('');
    setActiveIngredient('');
    setDefaultDosage('');
    setCategory(PesticideCategory.INSECTICIDE);
    setPhi('');
    setTargetCropsInput('');
    setTargetPestsInput('');
    setBarcode('');
    setDescription('');
    setEditingExistingUsages(undefined);
    setEditingBkuGroup(undefined);
    setEditingBkuRuhsatId(undefined);
    setShowModal(true);
  };

  const openEditModal = (p: Pesticide) => {
    setEditingId(p.id);
    setName(p.name);
    setActiveIngredient(isMissingField(p.activeIngredient) ? '' : p.activeIngredient);
    setDefaultDosage(p.defaultDosage || '');
    setCategory(p.category);
    setPhi(p.phi || '');
    setTargetCropsInput((p.targetCrops || []).join(', '));
    setTargetPestsInput((p.targetPests || []).join(', '));
    setBarcode(p.barcode || '');
    setDescription(p.description || '');
    setEditingExistingUsages(p.usages);
    setEditingBkuGroup(p.bkuGroup);
    setEditingBkuRuhsatId(p.bkuRuhsatId);
    setShowModal(true);
  };

  const handleAutoFillFromBkuInModal = async () => {
    const query = name.trim();
    if (query.length < 2) {
      showToast('BKÜ araması için önce ticari ürün adını yazın.', 'info');
      return;
    }
    const norm = normalizeBkuProductName(query);
    let matched =
      OFFICIAL_BKU_CATALOG.find((item) => normalizeBkuProductName(item.name) === norm) ||
      OFFICIAL_BKU_CATALOG.find((item) => normalizeBkuProductName(item.name).includes(norm));

    if (!matched) {
      try {
        const live = await searchLiveBkuDatabase(query);
        matched = live[0];
      } catch {
        // Ignore offline error and inform below
      }
    }

    if (!matched) {
      showToast(`"${query}" adına uygun resmi BKÜ ruhsatı bulunamadı.`, 'info');
      return;
    }

    setName(matched.name);
    setActiveIngredient(matched.activeIngredient);
    setDefaultDosage(matched.defaultDosage);
    setCategory(matched.category);
    setPhi(matched.phi || '');
    setTargetCropsInput((matched.targetCrops || []).join(', '));
    setTargetPestsInput((matched.targetPests || []).join(', '));
    setDescription(matched.description || '');
    setEditingExistingUsages(matched.usages);
    setEditingBkuGroup(matched.bkuGroup);
    setEditingBkuRuhsatId(matched.bkuRuhsatId);
    showToast(`"${matched.name}" resmi BKÜ verileriyle dolduruldu.`, 'success');
  };

  const handleSavePesticide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingPesticide) return;
    if (!name.trim() || !activeIngredient.trim() || !defaultDosage.trim()) {
      showToast('Lütfen ürün adı, aktif madde ve dozaj alanlarını doldurun.', 'error');
      return;
    }

    setIsSavingPesticide(true);
    try {
      const rawBarcode = barcode.trim();
      const parsedBarcode = rawBarcode ? parseGS1Barcode(rawBarcode) : null;
      if (parsedBarcode && !parsedBarcode.valid) {
        playErrorBeep();
        showToast(parsedBarcode.errors[0] || 'Geçersiz barkod formatı.', 'error');
        return;
      }
      const cleanBarcode = parsedBarcode ? canonicalBarcodeFromParsed(parsedBarcode) : undefined;

      const latest = await dbService.getPesticides();
      const normalizedName = name.trim().toLocaleLowerCase('tr-TR');
      const nameDup = latest.find(
        (p) => p.id !== editingId && p.name.trim().toLocaleLowerCase('tr-TR') === normalizedName
      );
      if (nameDup) {
        playErrorBeep();
        showToast(`"${nameDup.name}" zaten kütüphanede kayıtlı.`, 'error');
        return;
      }

      if (parsedBarcode) {
        const barcodeDup = findItemByScan(
          latest.filter((p) => p.id !== editingId),
          parsedBarcode
        );
        if (barcodeDup) {
          playErrorBeep();
          showToast(
            `Bu barkod zaten "${barcodeDup.name}" ürününe tanımlı! Aynı barkod iki farklı üründe kullanılamaz.`,
            'error'
          );
          return;
        }
      }

      const parsedCrops = parseCommaList(targetCropsInput);
      const parsedPests = parseCommaList(targetPestsInput);

      const payload = sanitizePesticideForDb({
        id: editingId || `p_${Date.now()}`,
        name: name.trim(),
        activeIngredient: activeIngredient.trim(),
        defaultDosage: defaultDosage.trim(),
        category,
        description: description.trim() || undefined,
        barcode: cleanBarcode,
        phi: phi.trim() || undefined,
        targetCrops: parsedCrops,
        targetPests: parsedPests,
        bkuGroup: editingBkuGroup,
        bkuRuhsatId: editingBkuRuhsatId,
        usages: editingExistingUsages
      });

      if (editingId) {
        await dbService.updateGlobalPesticide(payload);
        showToast(`"${payload.name}" güncellendi.`, 'success');
      } else {
        await dbService.addGlobalPesticide(payload);
        showToast(`"${payload.name}" kütüphaneye eklendi.`, 'success');
      }

      setShowModal(false);
      await loadPesticides(false);
    } catch {
      showToast('Ürün kaydedilirken bir hata oluştu.', 'error');
    } finally {
      setIsSavingPesticide(false);
    }
  };

  const detailUsages = useMemo(() => {
    if (!detailEntry?.item.usages) return [];
    if (!detailSearch.trim()) return detailEntry.item.usages;
    return detailEntry.item.usages.filter((u) =>
      turkishMatchesAny([u.crop, u.pest, u.dosage, u.phi, u.group], detailSearch)
    );
  }, [detailEntry, detailSearch]);

  const toggleKpi = (mode: KpiFilterMode) => {
    setSelectedCategory('ALL');
    setKpiFilter((prev) => (prev === mode ? 'ALL' : mode));
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-28 pt-2 sm:pt-4 space-y-5 font-sans">
      {/* CORPORATE HEADER CARD */}
      <div className="v22-bento-card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase"
                style={{
                  backgroundColor: 'var(--mks-accent-soft)',
                  color: 'var(--mks-accent-soft-text)'
                }}
              >
                <BookOpen size={13} />
                T.C. Tarım ve Orman Bakanlığı BKÜ Entegre
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor: 'var(--mks-subcard)',
                  color: 'var(--mks-muted)'
                }}
              >
                {pesticides.length} Kayıtlı • {OFFICIAL_BKU_CATALOG.length} Resmi BKÜ Ürünü
              </span>
              {kpiStats.incompleteCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={12} />
                  {kpiStats.incompleteCount} Eksik Detay
                </span>
              )}
            </div>

            <h1
              className="text-2xl sm:text-3xl font-black tracking-tight"
              style={{ color: 'var(--mks-text)' }}
            >
              Kurumsal İlaç Kütüphanesi & BKÜ Rehberi
            </h1>
            <p className="text-sm max-w-3xl" style={{ color: 'var(--mks-muted)' }}>
              Ticari isim, aktif madde, ruhsatlı bitki, hedef zararlı/hastalık/ot, önerilen dozaj ve son ilaçlama ile hasat arası süre (PHI) verilerini tek merkezden yönetin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleEnrichAndSyncLibrary()}
              disabled={enriching}
              className="v22-surface-pill inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60"
              style={{ color: 'var(--mks-text)' }}
            >
              <Sparkles size={15} className={enriching ? 'animate-spin text-emerald-500' : 'text-emerald-600'} />
              {enriching ? 'Tamamlanıyor...' : 'Eksikleri BKÜ ile Tamamla'}
            </button>

            <button
              type="button"
              onClick={() => handleLiveBkuSearch()}
              disabled={liveSearching}
              className="v22-surface-pill inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60"
              style={{ color: 'var(--mks-text)' }}
            >
              <Globe size={15} className={liveSearching ? 'animate-spin text-sky-500' : 'text-sky-600'} />
              {liveSearching ? 'BKÜ Aranıyor...' : "Canlı BKÜ'de Sorgula"}
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="v22-dark-pill inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              Yeni Ürün / İlaç Ekle
            </button>
          </div>
        </div>
      </div>

      {/* 4 CLICKABLE KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => {
            setKpiFilter('ALL');
            setSelectedCategory('ALL');
          }}
          className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
            kpiFilter === 'ALL' && selectedCategory === 'ALL' ? 'ring-2 ring-emerald-500/60' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              Toplam Rehber
            </span>
            <Layers size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
            {kpiStats.totalAll}
          </div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
            {kpiStats.inLibCount} kayıtlı • {kpiStats.bkuCount} BKÜ
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleKpi('INSECT_MITICIDE')}
          className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
            kpiFilter === 'INSECT_MITICIDE' ? 'ring-2 ring-rose-500/60' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              İnsektisit & Nematod
            </span>
            <Bug size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
            {kpiStats.insectMiticides}
          </div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
            Böcek, akar & nematod ilaçları
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleKpi('FUNG_HERB')}
          className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
            kpiFilter === 'FUNG_HERB' ? 'ring-2 ring-violet-500/60' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              Fungisit & Herbisit
            </span>
            <FlaskConical size={16} className="text-violet-500" />
          </div>
          <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
            {kpiStats.fungHerb}
          </div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
            Hastalık & yabancı ot kontrolü
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleKpi('NUTRITION_SEED')}
          className={`v22-bento-card p-4 text-left transition-all cursor-pointer ${
            kpiFilter === 'NUTRITION_SEED' ? 'ring-2 ring-lime-500/60' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
              Gübre, BGD & Tohum
            </span>
            <Sprout size={16} className="text-lime-600" />
          </div>
          <div className="text-2xl font-black" style={{ color: 'var(--mks-text)' }}>
            {kpiStats.nutritionSeed}
          </div>
          <div className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--mks-muted)' }}>
            Bitki besleme, BGD & tohumluk
          </div>
        </button>
      </div>

      {/* TOOLBAR: SOURCE TABS + SEARCH + CATEGORY & CROP FILTERS */}
      <div className="v22-bento-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Source Switcher */}
          <div
            className="inline-flex p-1 rounded-xl gap-1 self-start overflow-x-auto max-w-full"
            style={{ backgroundColor: 'var(--mks-subcard)' }}
          >
            {(
              [
                { key: 'ALL', label: `TÜMÜ (${combinedItems.length})` },
                { key: 'LIBRARY', label: `KAYITLI KÜTÜPHANEM (${pesticides.length})` },
                {
                  key: 'BKU',
                  label: `RESMİ BKÜ VERİTABANI (${OFFICIAL_BKU_CATALOG.length + liveBkuResults.length})`
                }
              ] as const
            ).map((tab) => {
              const active = sourceTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSourceTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active ? 'shadow-sm' : 'opacity-75 hover:opacity-100'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: 'var(--mks-accent-primary)',
                          color: '#ffffff'
                        }
                      : { color: 'var(--mks-text)' }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {lastLiveQuery && liveBkuResults.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
              <RefreshCw size={13} />
              Canlı BKÜ: "{lastLiveQuery}" ({liveBkuResults.length} ürün yüklü)
            </div>
          )}
        </div>

        {/* Search Bar + Barcode + Live Query Trigger */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60"
              style={{ color: 'var(--mks-muted)' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Ticari isim, aktif madde, bitki (Pamuk, Mısır...), hedef zararlı veya barkod ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sourceTab === 'BKU' && searchTerm.trim().length >= 2) {
                  e.preventDefault();
                  handleLiveBkuSearch();
                }
              }}
              className="w-full pl-10 pr-24 py-2.5 rounded-xl border text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/40"
              style={{
                backgroundColor: 'var(--mks-input-bg)',
                borderColor: 'var(--mks-input-border)',
                color: 'var(--mks-text)'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer"
                style={{
                  backgroundColor: 'var(--mks-subcard)',
                  color: 'var(--mks-muted)'
                }}
              >
                Temizle
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setScannerTarget('SEARCH')}
            className="v22-surface-pill inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold cursor-pointer shrink-0"
            style={{ color: 'var(--mks-text)' }}
          >
            <QrCode size={16} />
            Barkod Tara
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1 shrink-0" style={{ color: 'var(--mks-muted)' }}>
            Grup:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('ALL');
              setKpiFilter('ALL');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'ALL' ? '' : 'opacity-75 hover:opacity-100'
            }`}
            style={
              selectedCategory === 'ALL'
                ? { backgroundColor: 'var(--mks-accent-primary)', color: '#fff' }
                : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
            }
          >
            Tümü
          </button>
          {Object.values(PesticideCategory).map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setKpiFilter('ALL');
                  setSelectedCategory(active ? 'ALL' : cat);
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active ? '' : 'opacity-75 hover:opacity-100'
                }`}
                style={
                  active
                    ? { backgroundColor: 'var(--mks-accent-primary)', color: '#fff' }
                    : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Crop Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-bold uppercase tracking-wider mr-1 shrink-0" style={{ color: 'var(--mks-muted)' }}>
            Bitki:
          </span>
          {CROP_FILTER_CHIPS.map((crop) => {
            const active = selectedCrop === crop;
            return (
              <button
                key={crop}
                type="button"
                onClick={() => setSelectedCrop(crop)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active ? '' : 'opacity-80 hover:opacity-100'
                }`}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--mks-accent-soft)',
                        color: 'var(--mks-accent-soft-text)',
                        border: '1px solid var(--mks-accent-primary)'
                      }
                    : { backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-text)' }
                }
              >
                {crop !== 'Tümü' && <Sprout size={11} />}
                {crop}
              </button>
            );
          })}
        </div>
      </div>

      {/* RESULTS SUMMARY BAR */}
      <div className="flex items-center justify-between px-1 text-xs font-semibold" style={{ color: 'var(--mks-muted)' }}>
        <span>
          Gösterilen: <strong style={{ color: 'var(--mks-text)' }}>{visibleItems.length}</strong> /{' '}
          {filteredItems.length} ürün
        </span>
        {(selectedCategory !== 'ALL' || selectedCrop !== 'Tümü' || kpiFilter !== 'ALL' || searchTerm) && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('ALL');
              setSelectedCrop('Tümü');
              setKpiFilter('ALL');
              setSearchTerm('');
            }}
            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
          >
            Filtreleri Sıfırla
          </button>
        )}
      </div>

      {/* PRODUCT CARDS GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="v22-bento-card p-5 h-60 animate-pulse opacity-60" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="v22-bento-card p-10 text-center space-y-3">
          <BookOpen size={36} className="mx-auto opacity-40" style={{ color: 'var(--mks-muted)' }} />
          <div className="text-base font-bold" style={{ color: 'var(--mks-text)' }}>
            Arama kriterlerinize uygun ürün bulunamadı.
          </div>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--mks-muted)' }}>
            Aradığınız ruhsatlı bitki koruma ürünü için Bakanlık canlı BKÜ veritabanında anlık arama yapabilir veya yeni ürün ekleyebilirsiniz.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {searchTerm.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => handleLiveBkuSearch()}
                className="v22-surface-pill inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
                style={{ color: 'var(--mks-text)' }}
              >
                <Globe size={14} className="text-sky-600" />
                "{searchTerm}" için Canlı BKÜ'de Ara
              </button>
            )}
            <button
              type="button"
              onClick={openAddModal}
              className="v22-dark-pill inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
            >
              <Plus size={14} />
              Manuel Yeni Ürün Ekle
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleItems.map((entry) => {
            const p = entry.item;
            const incompleteActive = isMissingField(p.activeIngredient);
            const crops = p.targetCrops || [];
            const pests = p.targetPests || [];
            const usagesCount = p.usages?.length || 0;

            return (
              <div
                key={`${entry.inLibrary ? 'lib' : 'bku'}-${p.id}-${p.name}`}
                className="v22-bento-card p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all hover:shadow-md"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(
                          p.category
                        )}`}
                      >
                        <FlaskConical size={11} />
                        {p.category}
                      </span>

                      {entry.inLibrary ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 size={11} />
                          KÜTÜPHANEDE
                        </span>
                      ) : entry.isLiveResult ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/15 text-sky-700 dark:text-sky-300">
                          <Globe size={11} />
                          CANLI BKÜ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-700 dark:text-blue-300">
                          <BookOpen size={11} />
                          RESMİ BKÜ
                        </span>
                      )}
                    </div>

                    {p.barcode && (
                      <span
                        title={`Barkod: ${p.barcode}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0"
                        style={{
                          backgroundColor: 'var(--mks-subcard)',
                          color: 'var(--mks-muted)'
                        }}
                      >
                        <QrCode size={11} />
                        Barkodlu
                      </span>
                    )}
                  </div>

                  {/* Commercial Name */}
                  <div>
                    <h3
                      className="text-base font-black leading-snug tracking-tight"
                      style={{ color: 'var(--mks-text)' }}
                    >
                      {p.name}
                    </h3>
                    {p.bkuGroup && p.bkuGroup !== p.category && (
                      <div className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--mks-muted)' }}>
                        Ruhsat Grubu: {p.bkuGroup}
                      </div>
                    )}
                  </div>

                  {/* Active Ingredient Box */}
                  <div
                    className="rounded-xl p-2.5 border"
                    style={{
                      backgroundColor: 'var(--mks-subcard)',
                      borderColor: incompleteActive ? 'rgba(245, 158, 11, 0.45)' : 'var(--mks-input-border)'
                    }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--mks-muted)' }}>
                      Aktif Madde / İçerik
                    </div>
                    <div
                      className={`text-xs font-bold leading-snug ${
                        incompleteActive ? 'text-amber-600 dark:text-amber-400' : ''
                      }`}
                      style={incompleteActive ? undefined : { color: 'var(--mks-text)' }}
                    >
                      {p.activeIngredient || 'Belirtilmedi'}
                    </div>
                  </div>

                  {/* Crops */}
                  {crops.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                        <Sprout size={11} className="text-emerald-600" />
                        Kullanılacağı Bitkiler
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {crops.slice(0, 4).map((crop) => (
                          <span
                            key={crop}
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                            style={{
                              backgroundColor: 'var(--mks-accent-soft)',
                              color: 'var(--mks-accent-soft-text)'
                            }}
                          >
                            {crop}
                          </span>
                        ))}
                        {crops.length > 4 && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                            style={{
                              backgroundColor: 'var(--mks-subcard)',
                              color: 'var(--mks-muted)'
                            }}
                          >
                            +{crops.length - 4} bitki
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Target Pests */}
                  {pests.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                        <Bug size={11} className="text-rose-500" />
                        Hedef Zararlı / Hastalık
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pests.slice(0, 2).map((pest) => (
                          <span
                            key={pest}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium line-clamp-1 max-w-full"
                            style={{
                              backgroundColor: 'var(--mks-subcard)',
                              color: 'var(--mks-text)'
                            }}
                            title={pest}
                          >
                            {pest}
                          </span>
                        ))}
                        {pests.length > 2 && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                            style={{
                              backgroundColor: 'var(--mks-subcard)',
                              color: 'var(--mks-muted)'
                            }}
                          >
                            +{pests.length - 2} hedef
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dosage & PHI Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div
                      className="rounded-lg px-2.5 py-2 flex items-center gap-2"
                      style={{ backgroundColor: 'var(--mks-subcard)' }}
                    >
                      <Droplets size={14} className="text-sky-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                          Dozaj
                        </div>
                        <div className="text-xs font-bold truncate" style={{ color: 'var(--mks-text)' }} title={p.defaultDosage}>
                          {p.defaultDosage}
                        </div>
                      </div>
                    </div>

                    <div
                      className="rounded-lg px-2.5 py-2 flex items-center gap-2"
                      style={{ backgroundColor: 'var(--mks-subcard)' }}
                    >
                      <Clock size={14} className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--mks-muted)' }}>
                          Hasat Süresi (PHI)
                        </div>
                        <div className="text-xs font-bold truncate" style={{ color: 'var(--mks-text)' }}>
                          {p.phi || 'Etikete Bakın'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div
                  className="pt-3 border-t flex items-center justify-between gap-2"
                  style={{ borderColor: 'var(--mks-input-border)' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDetailSearch('');
                      setDetailEntry(entry);
                    }}
                    className="v22-surface-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold cursor-pointer"
                    style={{ color: 'var(--mks-text)' }}
                  >
                    <BookOpen size={13} />
                    {usagesCount > 0 ? `Tavsiyeler (${usagesCount})` : 'Detay Gör'}
                  </button>

                  {entry.inLibrary ? (
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors"
                      style={{
                        backgroundColor: 'var(--mks-accent-soft)',
                        color: 'var(--mks-accent-soft-text)'
                      }}
                    >
                      <Edit3 size={13} />
                      Düzenle
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={savingId === p.id}
                      onClick={() => handleQuickAddFromCatalog(p)}
                      className="v22-dark-pill inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-60"
                    >
                      <Plus size={14} />
                      {savingId === p.id ? 'Ekleniyor...' : 'Kütüphaneme Ekle'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LOAD MORE PAGINATION */}
      {visibleItems.length < filteredItems.length && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + INITIAL_PAGE_SIZE)}
            className="v22-surface-pill px-6 py-2.5 text-xs font-extrabold cursor-pointer"
            style={{ color: 'var(--mks-text)' }}
          >
            Daha Fazla Göster ({filteredItems.length - visibleItems.length} ürün daha)
          </button>
        </div>
      )}

      {/* DETAIL & BKU RECOMMENDATIONS MODAL */}
      {detailEntry && (
        <div
          className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
          onClick={() => setDetailEntry(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--mks-modal-bg)',
              borderColor: 'var(--mks-input-border)',
              color: 'var(--mks-text)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 border-b flex items-start justify-between gap-4"
              style={{ borderColor: 'var(--mks-input-border)' }}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getCategoryBadgeClass(
                      detailEntry.item.category
                    )}`}
                  >
                    {detailEntry.item.category}
                  </span>
                  {detailEntry.item.bkuRuhsatId && (
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold"
                      style={{ backgroundColor: 'var(--mks-subcard)', color: 'var(--mks-muted)' }}
                    >
                      BKÜ Ruhsat #{detailEntry.item.bkuRuhsatId}
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black">{detailEntry.item.name}</h2>
              </div>
              <ModalCloseButton onClick={() => setDetailEntry(null)} />
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Core Properties */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Aktif Madde
                  </div>
                  <div className="text-sm font-bold">{detailEntry.item.activeIngredient}</div>
                </div>
                <div className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Genel Önerilen Dozaj
                  </div>
                  <div className="text-sm font-bold">{detailEntry.item.defaultDosage}</div>
                </div>
                <div className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--mks-subcard)' }}>
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Son İlaçlama - Hasat (PHI)
                  </div>
                  <div className="text-sm font-bold">{detailEntry.item.phi || 'Etiket talimatına uyunuz'}</div>
                </div>
              </div>

              {detailEntry.item.description && (
                <div className="text-xs leading-relaxed px-1" style={{ color: 'var(--mks-muted)' }}>
                  {detailEntry.item.description}
                </div>
              )}

              {/* Usage Table */}
              {detailEntry.item.usages && detailEntry.item.usages.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                      <Tag size={15} className="text-emerald-600" />
                      Bakanlık Resmi Ruhsatlı Kullanım Tavsiyeleri ({detailUsages.length})
                    </h3>
                    {detailEntry.item.usages.length > 4 && (
                      <input
                        type="text"
                        placeholder="Tablo içinde bitki veya zararlı ara..."
                        value={detailSearch}
                        onChange={(e) => setDetailSearch(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--mks-input-bg)',
                          borderColor: 'var(--mks-input-border)',
                          color: 'var(--mks-text)'
                        }}
                      />
                    )}
                  </div>

                  <div
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: 'var(--mks-input-border)' }}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--mks-subcard)' }}>
                            <th className="p-3 font-bold">Kullanılacağı Bitki</th>
                            <th className="p-3 font-bold">Hedef Zararlı / Hastalık / Ot</th>
                            <th className="p-3 font-bold">Önerilen Doz</th>
                            <th className="p-3 font-bold whitespace-nowrap">Hasat Süresi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailUsages.map((u, idx) => (
                            <tr
                              key={`${u.crop}-${u.pest}-${idx}`}
                              className="border-t"
                              style={{ borderColor: 'var(--mks-input-border)' }}
                            >
                              <td className="p-3 font-bold text-emerald-700 dark:text-emerald-300">
                                {u.crop}
                              </td>
                              <td className="p-3 font-medium">{u.pest}</td>
                              <td className="p-3 font-semibold">{u.dosage}</td>
                              <td className="p-3 whitespace-nowrap">{u.phi || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {detailEntry.item.targetCrops && detailEntry.item.targetCrops.length > 0 && (
                    <div>
                      <div className="text-xs font-bold mb-1.5">Kullanıldığı Bitkiler</div>
                      <div className="flex flex-wrap gap-1.5">
                        {detailEntry.item.targetCrops.map((c) => (
                          <span
                            key={c}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{
                              backgroundColor: 'var(--mks-accent-soft)',
                              color: 'var(--mks-accent-soft-text)'
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailEntry.item.targetPests && detailEntry.item.targetPests.length > 0 && (
                    <div>
                      <div className="text-xs font-bold mb-1.5">Hedef Zararlılar / Kullanım Amacı</div>
                      <div className="flex flex-wrap gap-1.5">
                        {detailEntry.item.targetPests.map((pest) => (
                          <span
                            key={pest}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: 'var(--mks-subcard)' }}
                          >
                            {pest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              className="px-5 py-3.5 border-t flex items-center justify-end gap-2.5"
              style={{ borderColor: 'var(--mks-input-border)' }}
            >
              <button
                type="button"
                onClick={() => setDetailEntry(null)}
                className="v22-surface-pill px-4 py-2 text-xs font-bold cursor-pointer"
                style={{ color: 'var(--mks-text)' }}
              >
                Kapat
              </button>
              {detailEntry.inLibrary ? (
                <button
                  type="button"
                  onClick={() => {
                    const savedRecord =
                      libraryByNormalizedName.get(normalizeBkuProductName(detailEntry.item.name)) ||
                      detailEntry.item;
                    setDetailEntry(null);
                    openEditModal(savedRecord);
                  }}
                  className="v22-dark-pill inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  <Edit3 size={14} />
                  Kütüphanede Düzenle
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingId === detailEntry.item.id}
                  onClick={async () => {
                    await handleQuickAddFromCatalog(detailEntry.item);
                    setDetailEntry(null);
                  }}
                  className="v22-dark-pill inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
                >
                  <Plus size={14} />
                  Kütüphaneme Ekle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CORPORATE MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl border flex flex-col overflow-hidden"
            style={{
              backgroundColor: 'var(--mks-modal-bg)',
              borderColor: 'var(--mks-input-border)',
              color: 'var(--mks-text)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--mks-input-border)' }}
            >
              <div>
                <h3 className="text-lg font-black">
                  {editingId ? 'İlaç / Ürün Kaydını Güncelle' : 'Yeni İlaç / Zirai Ürün Ekle'}
                </h3>
                <p className="text-xs" style={{ color: 'var(--mks-muted)' }}>
                  BKÜ ruhsat bilgileri, aktif madde, hedef bitki/zararlı ve GS1 barkod kaydı
                </p>
              </div>
              <ModalCloseButton onClick={() => setShowModal(false)} />
            </div>

            <form onSubmit={handleSavePesticide} className="p-5 overflow-y-auto space-y-4">
              {/* Name + AutoFill */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--mks-muted)' }}>
                    Ticari İsim *
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoFillFromBkuInModal}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    BKÜ'den Otomatik Doldur
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Örn: Coragen 20 SC"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-sm font-medium outline-none"
                  style={{
                    backgroundColor: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Aktif Madde *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: 200 g/l Chlorantraniliprole"
                    value={activeIngredient}
                    onChange={(e) => setActiveIngredient(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-medium outline-none"
                    style={{
                      backgroundColor: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Kategori
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PesticideCategory)}
                    className="w-full p-2.5 rounded-xl border text-sm font-medium outline-none"
                    style={{
                      backgroundColor: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  >
                    {Object.values(PesticideCategory).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Varsayılan Dozaj *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: 15-20 ml/da veya 25 ml/100 L su"
                    value={defaultDosage}
                    onChange={(e) => setDefaultDosage(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-medium outline-none"
                    style={{
                      backgroundColor: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                    Hasat Arası Süre (PHI)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 14 Gün"
                    value={phi}
                    onChange={(e) => setPhi(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-medium outline-none"
                    style={{
                      backgroundColor: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                  Kullanılacağı Bitkiler (Virgülle ayırın)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Pamuk, Mısır, Domates, Antepfıstığı"
                  value={targetCropsInput}
                  onChange={(e) => setTargetCropsInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-sm font-medium outline-none"
                  style={{
                    backgroundColor: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                  Hedef Zararlı / Hastalık / Yabancı Ot (Virgülle ayırın)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Yeşilkurt (Helicoverpa armigera), Kırmızıörümcek"
                  value={targetPestsInput}
                  onChange={(e) => setTargetPestsInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-sm font-medium outline-none"
                  style={{
                    backgroundColor: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                  Barkod / GS1 GTIN (Opsiyonel)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="869... veya GS1 karekod"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl border text-sm font-mono outline-none"
                    style={{
                      backgroundColor: 'var(--mks-input-bg)',
                      borderColor: 'var(--mks-input-border)',
                      color: 'var(--mks-text)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerTarget('MODAL')}
                    className="v22-surface-pill px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    style={{ color: 'var(--mks-text)' }}
                  >
                    <QrCode size={16} />
                    Tara
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--mks-muted)' }}>
                  Açıklama / Kullanım Notu
                </label>
                <textarea
                  rows={2}
                  placeholder="Uygulama dönemi, tank karışım uyarısı veya teknik notlar..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--mks-input-bg)',
                    borderColor: 'var(--mks-input-border)',
                    color: 'var(--mks-text)'
                  }}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="v22-surface-pill px-5 py-2.5 text-xs font-bold cursor-pointer"
                  style={{ color: 'var(--mks-text)' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSavingPesticide}
                  className="v22-dark-pill px-6 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSavingPesticide ? 'Kaydediliyor...' : (editingId ? 'Değişiklikleri Kaydet' : 'Kütüphaneye Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARCODE SCANNER OVERLAY */}
      {scannerTarget && (
        <BarcodeScanner
          title={scannerTarget === 'SEARCH' ? 'Barkod ile Ürün Ara' : 'Ürün Barkodu Tanımla'}
          onScan={(code) => {
            const parsed = parseGS1Barcode(code);
            if (!parsed.valid) {
              playErrorBeep();
              showToast(parsed.errors[0] || 'Geçersiz barkod formatı!', 'error');
              setScannerTarget(null);
              return;
            }
            const cleanCode = canonicalBarcodeFromParsed(parsed);
            playScanBeep();

            if (scannerTarget === 'SEARCH') {
              setSearchTerm(cleanCode);
              setSourceTab('LIBRARY');
            } else {
              setBarcode(cleanCode);
              showToast(`Barkod tanımlandı: ${cleanCode}`, 'success');
            }
            setScannerTarget(null);
          }}
          onClose={() => setScannerTarget(null)}
        />
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  ImageOverlay,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  AlertTriangle,
  Calendar,
  Cloud,
  CloudRain,
  Droplets,
  Info,
  Leaf,
  Loader2,
  RefreshCw,
  Satellite,
  Sliders,
  WifiOff,
  X,
} from 'lucide-react';
import { Field, SatelliteCacheRecord } from '../../types';
import { dbService } from '../../services/db';
import { auth } from '../../services/firebase';
import { WeatherService } from '../../services/weather';
import {
  computePolygonHash,
  computePolygonMetrics,
  geoJsonToLatLngs,
} from '../../utils/fieldPolygon';
import { useBackHandler } from '../../utils/navigationManager';
import { API_BASE } from '../../utils/api';

type SatelliteLayerKey = 'NDVI' | 'NDMI' | 'WETNESS';

interface FieldSatelliteAnalyzerModalProps {
  isOpen: boolean;
  field: Field | null;
  farmerName?: string;
  onClose: () => void;
  onEditPolygon?: () => void;
}

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const FitPolygonBounds: React.FC<{ bboxCoords: [number, number, number, number] }> = ({
  bboxCoords,
}) => {
  const map = useMap();
  useEffect(() => {
    const [west, south, east, north] = bboxCoords;
    if (!west && !east) return;
    const bounds = L.latLngBounds(
      [south, west],
      [north, east]
    );
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 18 });
    }
  }, [map, bboxCoords]);
  return null;
};

const LAYER_CONFIG: Record<
  SatelliteLayerKey,
  {
    title: string;
    shortTitle: string;
    subtitle: string;
    legend: { color: string; label: string; detail: string }[];
  }
> = {
  NDVI: {
    title: 'Bitki Gelişimi (NDVI)',
    shortTitle: 'Bitki Gelişimi (NDVI)',
    subtitle: 'B04 & B08 Klorofil ve Biyokütle İndeksi',
    legend: [
      {
        color: '#108538',
        label: 'NDVI > 0.60 — Sağlıklı & Gür Örtü',
        detail: 'Yüksek klorofil aktivitesi ve homojen bitki gelişimi',
      },
      {
        color: '#61d147',
        label: '0.40 – 0.60 — Orta Gelişim',
        detail: 'Normal vejetatif gelişim veya genç bitki örtüsü',
      },
      {
        color: '#f2ad1f',
        label: '0.20 – 0.40 — Gelişim Geriliği',
        detail: 'Seyrek çıkış, besin eksikliği veya erken stres bölgesi',
      },
      {
        color: '#db2e2e',
        label: 'NDVI < 0.20 — Çıplak Toprak / Şiddetli Stres',
        detail: 'Bitki örtüsü yok, kurumuş alan veya sürüm yüzeyi',
      },
      {
        color: '#8c949e',
        label: 'Bulut / Bulut Gölgesi Maskesi (SCL)',
        detail: 'Yarı saydam gri maske (yanlış okumayı önler)',
      },
    ],
  },
  NDMI: {
    title: 'Sulama Durumu (NDMI)',
    shortTitle: 'Sulama / Su Stresi (NDMI)',
    subtitle: 'B8A & B11 Bitki ve Kök Bölgesi Su Kontrolü',
    legend: [
      {
        color: '#1752d1',
        label: 'NDMI > 0.30 — Yüksek Su Doygunluğu',
        detail: 'Tam su kapasitesi veya yoğun sulama yapılmış bölge',
      },
      {
        color: '#38b8f5',
        label: '0.10 – 0.30 — Dengeli Nem / Yeni Sulanmış',
        detail: 'Bitki su içeriği ideal aralıkta',
      },
      {
        color: '#f5c726',
        label: '-0.10 – 0.10 — Nem Azalıyor',
        detail: 'Sulama zamanı yaklaşıyor, yaprak nemi düşüşte',
      },
      {
        color: '#e8471f',
        label: 'NDMI < -0.10 — Kuru / Ciddi Su Stresi',
        detail: 'Acil sulama kontrolü gerektiren kuru bölge',
      },
      {
        color: '#8c949e',
        label: 'Bulut / Bulut Gölgesi Maskesi (SCL)',
        detail: 'Yarı saydam gri maske',
      },
    ],
  },
  WETNESS: {
    title: 'Çamur, Tav ve Göllenme (Yüzey Islaklığı)',
    shortTitle: 'Çamur, Tav & Göllenme',
    subtitle: 'B03, B8A, B11 & B12 (SWIR Toprak Nemi ve Göllenme)',
    legend: [
      {
        color: '#6b29d9',
        label: 'Su Birikintisi / Göllenme',
        detail: 'Yüzeyde açık su veya drenaj sorunu (MNDWI > 0.10 / SCL 6)',
      },
      {
        color: '#0585c7',
        label: 'Islak / Çamur Riski — Traktör Batabilir',
        detail: 'Aşırı ıslak SWIR yüzey; ilaçlama/ekipman girişi riskli',
      },
      {
        color: '#14b894',
        label: 'Tavında / Nemli Toprak',
        detail: 'Toprak işlemesi ve kök gelişimi için dengeli yüzey nemi',
      },
      {
        color: '#c27a2e',
        label: 'Kuru Toprak',
        detail: 'Düşük yüzey nemi, traktör/ekipman geçişine uygun kuru zemin',
      },
      {
        color: '#8c949e',
        label: 'Bulut / Gölge Maskesi (SCL 3,8,9,10)',
        detail: 'Bulut gölgesinin çamur/su sanılmasını engeller',
      },
    ],
  },
};

function formatDaysAgoLabel(captureIso: string): {
  dateStr: string;
  timeStr: string;
  daysAgoLabel: string;
} {
  const dt = new Date(captureIso);
  if (isNaN(dt.getTime())) {
    return { dateStr: '-', timeStr: '-', daysAgoLabel: '-' };
  }
  const dateStr = dt.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = dt.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const diffMs = Math.max(0, Date.now() - dt.getTime());
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const daysAgoLabel =
    days === 0
      ? hours <= 1
        ? 'Az önce çekildi'
        : `Bugün (${hours} saat önce)`
      : days === 1
      ? '1 gün önce çekildi'
      : `${days} gün önce çekildi`;

  return { dateStr, timeStr, daysAgoLabel };
}

export const FieldSatelliteAnalyzerModal: React.FC<FieldSatelliteAnalyzerModalProps> = ({
  isOpen,
  field,
  farmerName,
  onClose,
  onEditPolygon,
}) => {
  useBackHandler(isOpen, onClose, 'field_satellite_analyzer', 78);

  const [activeLayer, setActiveLayer] = useState<SatelliteLayerKey>('NDVI');
  const [opacity, setOpacity] = useState<number>(0.85);
  const [cacheRecord, setCacheRecord] = useState<SatelliteCacheRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isFromOfflineCache, setIsFromOfflineCache] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [rainCrossCheck, setRainCrossCheck] = useState<{
    totalRainMm: number;
    rainyHours: number;
    hasSignificantRain: boolean;
  } | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const polygonPoints = useMemo(
    () => geoJsonToLatLngs(field?.polygonGeoJson),
    [field?.polygonGeoJson]
  );
  const metrics = useMemo(() => computePolygonMetrics(polygonPoints), [polygonPoints]);
  const polygonHash = useMemo(
    () => computePolygonHash(field?.polygonGeoJson),
    [field?.polygonGeoJson]
  );

  const runRainCrossCheck = useCallback(
    async (captureIso: string, lat: number, lng: number) => {
      try {
        const res = await WeatherService.getPrecipitationSinceCapture(lat, lng, captureIso);
        if (res.fetchFailed) {
          setRainCrossCheck(null);
          return;
        }
        setRainCrossCheck({
          totalRainMm: res.totalMm,
          rainyHours: res.rainyHoursCount,
          hasSignificantRain: res.totalMm >= 2.0,
        });
      } catch {
        setRainCrossCheck(null);
      }
    },
    []
  );

  const loadAnalysis = useCallback(
    async (forceRefresh = false) => {
      if (!field || !field.polygonGeoJson || polygonPoints.length < 3) return;

      const cacheKey = `${field.id}_${polygonHash}`;
      setErrorMsg(null);
      setErrorCode(null);

      // 1. Check 5-day local IndexedDB cache first (or always if offline)
      if (!forceRefresh) {
        const cached = await dbService.getSatelliteCache(cacheKey, !navigator.onLine);
        if (cached) {
          const cachedTimeStr = cached.fetchedAt || cached.cachedAt || new Date().toISOString();
          const ageMs = Date.now() - new Date(cachedTimeStr).getTime();
          const capIso = cached.captureDatetime || cached.captureDate || cachedTimeStr;
          if (!navigator.onLine || ageMs < FIVE_DAYS_MS) {
            setCacheRecord(cached);
            setIsFromOfflineCache(!navigator.onLine || ageMs > 60_000);
            if (navigator.onLine) {
              runRainCrossCheck(
                capIso,
                metrics.centroid.lat,
                metrics.centroid.lng
              );
            } else {
              const rainMm = cached.postCaptureRainMm ?? cached.rainSinceCaptureMm;
              if (rainMm !== undefined) {
                setRainCrossCheck({
                  totalRainMm: rainMm,
                  rainyHours: 0,
                  hasSignificantRain: rainMm >= 2.0,
                });
              }
            }
            return;
          }
        }
      }

      if (!navigator.onLine) {
        const fallbackCached = await dbService.getSatelliteCache(cacheKey, true);
        if (fallbackCached) {
          setCacheRecord(fallbackCached);
          setIsFromOfflineCache(true);
          return;
        }
        setErrorMsg(
          'İnternet bağlantısı yok ve bu parsel için kaydedilmiş çevrimdışı uydu analizi bulunamadı.'
        );
        return;
      }

      // 2. Fetch fresh multi-layer Sentinel-2 analysis from secure MKS backend
      setIsLoading(true);
      try {
        let idToken = '';
        try {
          if (auth.currentUser) {
            idToken = await auth.currentUser.getIdToken();
          }
        } catch {
          idToken = '';
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (idToken) {
          headers.Authorization = `Bearer ${idToken}`;
        }

        const parsedGeo = JSON.parse(field.polygonGeoJson);
        const resp = await fetch(`${API_BASE}/api/satellite/analyze`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ polygonGeoJson: parsedGeo }),
        });

        const data = await resp.json();
        if (!resp.ok) {
          setErrorCode(data?.code || null);
          throw new Error(data?.error || 'Uydu analizi alınamadı.');
        }

        const rainInfo = await WeatherService.getPrecipitationSinceCapture(
          metrics.centroid.lat,
          metrics.centroid.lng,
          data.captureDatetime
        );
        if (rainInfo.fetchFailed) {
          setRainCrossCheck(null);
        } else {
          setRainCrossCheck({
            totalRainMm: rainInfo.totalMm,
            rainyHours: rainInfo.rainyHoursCount,
            hasSignificantRain: rainInfo.totalMm >= 2.0,
          });
        }

        const nowIso = new Date().toISOString();
        const expiresIso = new Date(Date.now() + FIVE_DAYS_MS).toISOString();
        const validRainMm = rainInfo.fetchFailed ? undefined : rainInfo.totalMm;
        const newRecord: SatelliteCacheRecord = {
          id: cacheKey,
          fieldId: field.id,
          polygonHash,
          bbox: data.bbox,
          bounds: data.bbox,
          areaDaa: data.dekar,
          captureDate: data.captureDatetime,
          captureDatetime: data.captureDatetime,
          cloudCover: data.cloudCover,
          cachedAt: nowIso,
          fetchedAt: nowIso,
          expiresAt: expiresIso,
          layers: {
            ndvi: data.layers.ndviPngDataUrl,
            ndmi: data.layers.ndmiPngDataUrl,
            wetness: data.layers.wetnessPngDataUrl,
          },
          ndviPngDataUrl: data.layers.ndviPngDataUrl,
          ndmiPngDataUrl: data.layers.ndmiPngDataUrl,
          wetnessPngDataUrl: data.layers.wetnessPngDataUrl,
          postCaptureRainMm: validRainMm,
          rainSinceCaptureMm: validRainMm,
        };

        await dbService.saveSatelliteCache(newRecord);
        setCacheRecord(newRecord);
        setIsFromOfflineCache(false);
      } catch (err: any) {
        // Fallback to older cache if network/API failed
        const oldCache = await dbService.getSatelliteCache(cacheKey, true);
        if (oldCache) {
          setCacheRecord(oldCache);
          setIsFromOfflineCache(true);
        }
        setErrorMsg(err?.message || 'Uydu görüntüsü alınırken hata oluştu.');
      } finally {
        setIsLoading(false);
      }
    },
    [field, polygonPoints.length, polygonHash, metrics.centroid.lat, metrics.centroid.lng, runRainCrossCheck]
  );

  useEffect(() => {
    if (isOpen && field?.polygonGeoJson) {
      loadAnalysis(false);
    }
  }, [isOpen, field?.id, field?.polygonGeoJson, loadAnalysis]);

  if (!isOpen || !field) return null;

  const hasValidPolygon = polygonPoints.length >= 3;
  const activeOverlayUrl =
    activeLayer === 'NDVI'
      ? cacheRecord?.ndviPngDataUrl || cacheRecord?.layers?.ndvi
      : activeLayer === 'NDMI'
      ? cacheRecord?.ndmiPngDataUrl || cacheRecord?.layers?.ndmi
      : cacheRecord?.wetnessPngDataUrl || cacheRecord?.layers?.wetness;

  const activeBbox = cacheRecord?.bbox || cacheRecord?.bounds || metrics.bbox;
  const captureInfo = cacheRecord
    ? formatDaysAgoLabel(cacheRecord.captureDatetime || cacheRecord.captureDate || '')
    : null;
  const currentConfig = LAYER_CONFIG[activeLayer];

  return (
    <div className="fixed inset-0 z-[1350] bg-stone-950 flex flex-col">
      {/* Header */}
      <div className="bg-stone-900/95 border-b border-white/10 px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 z-[1010]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-white/10 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Satellite size={16} className="text-emerald-400 shrink-0" />
              <h3 className="text-xs sm:text-sm font-black text-white truncate">
                {farmerName ? `${farmerName} • ` : ''}
                {field.name} ({field.size || metrics.dekar} daa)
              </h3>
            </div>
            <p className="text-[10px] text-stone-400 truncate">
              Sentinel-2 L2A Çok Katmanlı Zirai Uydu Analizi {field.crop ? `• Ürün: ${field.crop}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black flex items-center gap-1">
              <WifiOff size={12} /> Çevrimdışı Önbellek
            </span>
          )}
          {onEditPolygon && (
            <button
              type="button"
              onClick={onEditPolygon}
              className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-white/10 text-[11px] font-bold transition-colors"
            >
              Sınırı Düzenle
            </button>
          )}
          <button
            type="button"
            disabled={!isOnline || isLoading || !hasValidPolygon}
            onClick={() => loadAnalysis(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-stone-950 text-[11px] font-black flex items-center gap-1.5 transition-all"
            title={isOnline ? 'Güncel uydu geçişini yeniden sorgula' : 'Çevrimdışıyken yenilenemez'}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Yeniden Sorgula</span>
          </button>
        </div>
      </div>

      {/* Layer Selector Tabs */}
      <div className="bg-stone-950 border-b border-white/10 px-3 sm:px-5 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none z-[1010]">
        <button
          type="button"
          onClick={() => setActiveLayer('NDVI')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all border ${
            activeLayer === 'NDVI'
              ? 'bg-emerald-600 text-stone-950 border-emerald-400 shadow-lg shadow-emerald-900/30'
              : 'bg-stone-900 text-stone-300 border-white/10 hover:bg-stone-800'
          }`}
        >
          <Leaf size={14} />
          <span>Bitki Gelişimi (NDVI)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLayer('NDMI')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all border ${
            activeLayer === 'NDMI'
              ? 'bg-sky-500 text-stone-950 border-sky-300 shadow-lg shadow-sky-900/30'
              : 'bg-stone-900 text-stone-300 border-white/10 hover:bg-stone-800'
          }`}
        >
          <Droplets size={14} />
          <span>Sulama Durumu (NDMI)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLayer('WETNESS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition-all border ${
            activeLayer === 'WETNESS'
              ? 'bg-indigo-500 text-white border-indigo-300 shadow-lg shadow-indigo-900/30'
              : 'bg-stone-900 text-stone-300 border-white/10 hover:bg-stone-800'
          }`}
        >
          <CloudRain size={14} />
          <span>Çamur, Tav ve Göllenme</span>
        </button>
      </div>

      {/* Post-Capture Rain Cross-Check Warning Banner (Zorunlu Hava Durumu Çapraz Kontrolü) */}
      {rainCrossCheck?.hasSignificantRain && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 flex items-start sm:items-center gap-2.5 text-amber-200 z-[1010]">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-[11px] sm:text-xs font-bold leading-snug">
            <strong>Hava Durumu Çapraz Kontrol Uyarısı:</strong> Uydunun bu fotoğrafı çektiği tarihten sonra araziye toplam{' '}
            <span className="underline font-black text-amber-300">{rainCrossCheck.totalRainMm} mm yağış</span> düştü!
            Tarladaki güncel yüzey ıslaklığı, çamur riski ve sulama ihtiyacı uydu görüntüsüne göre değişmiş olabilir.
          </p>
        </div>
      )}

      {/* Main Map + Floating Badges */}
      <div className="relative flex-1 w-full">
        {!hasValidPolygon ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <Satellite size={44} className="text-stone-600 mb-3" />
            <h4 className="text-base font-black text-white">Bu Arazi İçin Henüz Sınır Çizilmemiş</h4>
            <p className="text-xs text-stone-400 max-w-md mt-1 mb-4">
              NDVI, Sulama (NDMI) ve Çamur/Göllenme uydu analizini başlatmak için önce tarlanın sınır poligonunu harita üzerinde çizin.
            </p>
            {onEditPolygon && (
              <button
                type="button"
                onClick={onEditPolygon}
                className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black text-xs uppercase tracking-wider"
              >
                Şimdi Tarla Sınırını Çiz
              </button>
            )}
          </div>
        ) : (
          <>
            <MapContainer
              center={[metrics.centroid.lat, metrics.centroid.lng]}
              zoom={16}
              maxZoom={19}
              zoomControl={false}
              className="h-full w-full"
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                attribution="Tiles &copy; Esri"
              />
              <FitPolygonBounds bboxCoords={activeBbox} />

              <Polygon
                positions={polygonPoints.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2.5,
                  fillOpacity: 0.03,
                  dashArray: '6 4',
                }}
              />

              {activeOverlayUrl && (
                <ImageOverlay
                  url={activeOverlayUrl}
                  bounds={[
                    [activeBbox[1], activeBbox[0]],
                    [activeBbox[3], activeBbox[2]],
                  ]}
                  opacity={opacity}
                  zIndex={450}
                />
              )}
            </MapContainer>

            {/* ZORUNLU ARAYÜZ ÖZELLİĞİ: Harita Sağ Üst Köşesinde Sabit Gerçek Çekim Tarihi Rozeti */}
            {captureInfo && cacheRecord && (
              <div className="absolute top-3 right-3 z-[1000] bg-stone-950/92 backdrop-blur-xl border border-emerald-500/35 rounded-2xl px-3.5 py-2.5 shadow-2xl max-w-[300px]">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  <Calendar size={12} />
                  <span>Gerçek Uydu Çekim Tarihi</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-white font-mono mt-0.5">
                  {captureInfo.dateStr} • {captureInfo.timeStr}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-bold text-stone-300">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    {captureInfo.daysAgoLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-800 text-sky-300 border border-white/10 flex items-center gap-1">
                    <Cloud size={10} /> %{cacheRecord.cloudCover} Bulut
                  </span>
                  {isFromOfflineCache && (
                    <span className="px-2 py-0.5 rounded-md bg-stone-800 text-stone-400">
                      Önbellek
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-[1020] bg-stone-950/65 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <Loader2 size={36} className="text-emerald-400 animate-spin mb-3" />
                <p className="text-sm font-black text-white">
                  Sentinel-2 L2A Gerçek Uydu Geçişi Taranıyor...
                </p>
                <p className="text-xs text-stone-400 mt-1 max-w-sm">
                  Son 30 gün içindeki en temiz uydu çekimi seçiliyor ve NDVI, NDMI ve Çamur/Islaklık katmanları oluşturuluyor.
                </p>
              </div>
            )}

            {/* Error / Missing Key Banner */}
            {errorMsg && !isLoading && (
              <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md z-[1020] bg-rose-950/95 border border-rose-500/40 rounded-2xl p-3.5 shadow-2xl text-rose-100">
                <div className="flex items-start gap-2.5">
                  <Info size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-black text-rose-200">Uydu Verisi Uyarısı</p>
                    <p className="text-rose-100/90 leading-relaxed">{errorMsg}</p>
                    {errorCode === 'CDSE_MISSING_CREDENTIALS' && (
                      <p className="text-[10px] text-amber-300 pt-1">
                        Sunucu `.env` dosyasında `CDSE_CLIENT_ID` ve `CDSE_CLIENT_SECRET` tanımlandığında canlı analiz otomatik devreye girer.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Legend + Opacity Control Card */}
            <div className="absolute bottom-4 left-3 right-3 sm:left-4 sm:right-auto sm:w-[400px] z-[1000] bg-stone-950/92 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-white">{currentConfig.title}</h4>
                  <p className="text-[10px] text-stone-400">{currentConfig.subtitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Sliders size={12} className="text-stone-400" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(opacity * 100)}
                    onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                    className="w-20 accent-emerald-500 cursor-pointer"
                    title="Katman Saydamlığı"
                  />
                  <span className="text-[10px] font-mono font-bold text-emerald-400 w-8 text-right">
                    %{Math.round(opacity * 100)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-white/10">
                {currentConfig.legend.map((row, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-md shrink-0 mt-0.5 border border-white/20"
                      style={{ backgroundColor: row.color }}
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-stone-100 leading-tight">
                        {row.label}
                      </div>
                      <div className="text-[10px] text-stone-400 leading-tight">{row.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

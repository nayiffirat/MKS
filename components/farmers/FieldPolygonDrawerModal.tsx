import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  WMSTileLayer,
  useMap,
  useMapEvents,
  Tooltip,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Check,
  Crosshair,
  Layers,
  Loader2,
  MapPin,
  Move,
  Navigation,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  LatLngLiteral,
  computePolygonMetrics,
  geoJsonToLatLngs,
} from '../../utils/fieldPolygon';
import { useBackHandler } from '../../utils/navigationManager';
import { API_BASE } from '../../utils/api';

export interface FieldPolygonSavePayload {
  polygonGeoJson: string;
  polygonBbox: [number, number, number, number];
  centroidLat: number;
  centroidLng: number;
  dekar: number;
  tkgmIl?: string;
  tkgmIlce?: string;
  tkgmMahalle?: string;
  tkgmAda?: string;
  tkgmParsel?: string;
}

interface FieldPolygonDrawerModalProps {
  isOpen: boolean;
  fieldName?: string;
  initialGeoJson?: string;
  initialCenter?: { lat?: number; lng?: number };
  onClose: () => void;
  onSave: (payload: FieldPolygonSavePayload) => void;
}

const vertexIcon = (index: number) =>
  new L.DivIcon({
    className: 'mks-polygon-vertex-icon',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:#10b981;border:2.5px solid #ffffff;color:#052e16;font-weight:900;font-size:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.65);">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const gpsDotIcon = new L.DivIcon({
  className: 'mks-gps-dot-icon',
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:#38bdf8;border:3px solid #ffffff;box-shadow:0 0 12px rgba(56,189,248,0.85);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const DrawClickHandler: React.FC<{
  isDrawingEnabled: boolean;
  onAddVertex: (pt: LatLngLiteral) => void;
}> = ({ isDrawingEnabled, onAddVertex }) => {
  useMapEvents({
    click(e) {
      if (!isDrawingEnabled) return;
      onAddVertex({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const FitInitialBounds: React.FC<{ points: LatLngLiteral[] }> = ({ points }) => {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current || points.length < 3) return;
    fittedRef.current = true;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 });
    }
  }, [map, points]);

  return null;
};

export const FieldPolygonDrawerModal: React.FC<FieldPolygonDrawerModalProps> = ({
  isOpen,
  fieldName,
  initialGeoJson,
  initialCenter,
  onClose,
  onSave,
}) => {
  useBackHandler(isOpen, onClose, 'field_polygon_drawer', 75);

  const [points, setPoints] = useState<LatLngLiteral[]>([]);
  const [showTkgmLayer, setShowTkgmLayer] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [gpsLocation, setGpsLocation] = useState<LatLngLiteral | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isQueryingTkgm, setIsQueryingTkgm] = useState(false);
  const [tkgmMeta, setTkgmMeta] = useState<{
    il?: string;
    ilce?: string;
    mahalle?: string;
    ada?: string;
    parsel?: string;
    nitelik?: string;
    alanDekar?: number;
  } | null>(null);

  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const parsed = geoJsonToLatLngs(initialGeoJson);
    setPoints(parsed);
    setTkgmMeta(null);
    setSearchQuery('');
    setSearchResults([]);
  }, [isOpen, initialGeoJson]);

  useEffect(() => {
    if (!isOpen || searchQuery.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery.trim()
          )}&countrycodes=tr&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch {
        setSearchResults([]);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [isOpen, searchQuery]);

  const metrics = useMemo(() => computePolygonMetrics(points), [points]);

  if (!isOpen) return null;

  const defaultCenter: [number, number] =
    points.length > 0
      ? [points[0].lat, points[0].lng]
      : initialCenter?.lat && initialCenter?.lng
      ? [initialCenter.lat, initialCenter.lng]
      : [37.1674, 38.7955]; // Tarım kuşağı varsayılan merkez

  const defaultZoom = points.length > 0 || (initialCenter?.lat && initialCenter?.lng) ? 16 : 7;

  const handleGoToMyLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsLocation(pt);
        mapRef.current?.flyTo([pt.lat, pt.lng], 17, { duration: 1.1 });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLookupTkgmAtCenter = async () => {
    const center =
      points.length >= 3
        ? metrics.centroid
        : points.length > 0
        ? points[points.length - 1]
        : mapRef.current
        ? { lat: mapRef.current.getCenter().lat, lng: mapRef.current.getCenter().lng }
        : null;

    if (!center) return;
    setIsQueryingTkgm(true);
    try {
      const res = await fetch(`${API_BASE}/api/tkgm/parcel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: center.lat, lng: center.lng }),
      });
      if (res.ok) {
        const data = await res.json();
        setTkgmMeta({
          il: data.il,
          ilce: data.ilce,
          mahalle: data.mahalle,
          ada: data.ada || undefined,
          parsel: data.parsel || undefined,
          nitelik: data.nitelik,
          alanDekar: data.alanDekar,
        });
        if (data.geometry) {
          const autoPts = geoJsonToLatLngs(data.geometry);
          if (autoPts.length >= 3) {
            setPoints(autoPts);
            const bounds = L.latLngBounds(autoPts.map((p) => [p.lat, p.lng] as [number, number]));
            if (bounds.isValid()) {
              mapRef.current?.fitBounds(bounds, { padding: [48, 48], maxZoom: 18 });
            }
          }
        }
        return;
      }
      throw new Error('TKGM endpoint unavailable');
    } catch {
      // İstemci tarafı idari konum yedeği (statik barındırma veya geçici ağ kesintisi için)
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${center.lat.toFixed(6)}&lon=${center.lng.toFixed(6)}&zoom=18&addressdetails=1&accept-language=tr`
        );
        if (nomRes.ok) {
          const nom = await nomRes.json();
          const addr = nom?.address || {};
          setTkgmMeta({
            il: addr.province || addr.state || '',
            ilce: addr.town || addr.county || addr.city_district || addr.municipality || '',
            mahalle: addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || '',
            nitelik: 'Tarım Alanı (İdari Konum)',
          });
        }
      } catch {
        // ignore offline
      }
    } finally {
      setIsQueryingTkgm(false);
    }
  };

  const handleConfirmSave = () => {
    if (!metrics.feature || points.length < 3) return;
    onSave({
      polygonGeoJson: JSON.stringify(metrics.feature),
      polygonBbox: metrics.bbox,
      centroidLat: metrics.centroid.lat,
      centroidLng: metrics.centroid.lng,
      dekar: metrics.dekar,
      tkgmIl: tkgmMeta?.il,
      tkgmIlce: tkgmMeta?.ilce,
      tkgmMahalle: tkgmMeta?.mahalle,
      tkgmAda: tkgmMeta?.ada,
      tkgmParsel: tkgmMeta?.parsel,
    });
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-stone-950 flex flex-col">
      {/* Top Toolbar */}
      <div className="bg-stone-900/95 border-b border-white/10 px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-2 z-[1010]">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-white/10 transition-colors"
            title="Kapat"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black text-white truncate">
              {fieldName ? `${fieldName} — Parsel Poligon Çizimi` : 'Tarla Sınırı (Poligon) Çizimi'}
            </h3>
            <p className="text-[10px] text-stone-400 truncate">
              Esri World Imagery Uydu Altlığı • Haritaya dokunarak köşe noktalarını işaretleyin
            </p>
          </div>
        </div>

        {/* Search + Quick Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Köy, mahalle veya ilçe ara..."
              className="w-full bg-stone-950 border border-stone-700 focus:border-emerald-500 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl overflow-hidden z-[1200]">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      mapRef.current?.flyTo([parseFloat(item.lat), parseFloat(item.lon)], 16);
                      setSearchQuery(String(item.display_name || '').split(',')[0]);
                      setSearchResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-stone-200 hover:bg-stone-800 border-b border-white/5 last:border-0 truncate"
                  >
                    {item.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowTkgmLayer((v) => !v)}
            className={`px-3 py-2 rounded-xl text-[11px] font-black border transition-all flex items-center gap-1.5 shrink-0 ${
              showTkgmLayer
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-stone-800 text-stone-300 border-white/10'
            }`}
            title="TKGM Kadastro Parsel Sınırları"
          >
            <Layers size={14} />
            <span className="hidden md:inline">TKGM Sınır</span>
          </button>

          <button
            type="button"
            onClick={handleLookupTkgmAtCenter}
            disabled={isQueryingTkgm}
            className="px-3 py-2 rounded-xl text-[11px] font-black bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 shrink-0"
            title="Harita merkezindeki veya çizili parselin TKGM Ada/Parsel bilgisini getir"
          >
            {isQueryingTkgm ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>TKGM Sorgula</span>
          </button>

          <button
            type="button"
            onClick={handleGoToMyLocation}
            disabled={isLocating}
            className="px-3 py-2 rounded-xl text-[11px] font-black bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition-all flex items-center gap-1.5 shrink-0"
            title="Konumuma Git (GPS)"
          >
            {isLocating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
            <span className="hidden sm:inline">Konumuma Git</span>
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative flex-1 w-full">
        <MapContainer
          ref={mapRef}
          center={defaultCenter}
          zoom={defaultZoom}
          maxZoom={19}
          zoomControl={false}
          className="h-full w-full"
        >
          {/* Ücretsiz Esri World Imagery Uydu Altlığı */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
          />
          {/* Şeffaf Yol ve Yerleşim Etiketleri */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.75}
          />
          {showTkgmLayer && (
            <WMSTileLayer
              url="https://megsiswms.tkgm.gov.tr/tkgm.mahalli/wms"
              layers="TKGM.MAHALLI.PARSEL"
              transparent={true}
              format="image/png"
              version="1.1.1"
              maxZoom={20}
              opacity={0.65}
            />
          )}

          <FitInitialBounds points={points} />
          <DrawClickHandler
            isDrawingEnabled={true}
            onAddVertex={(pt) => setPoints((prev) => [...prev, pt])}
          />

          {gpsLocation && <Marker position={[gpsLocation.lat, gpsLocation.lng]} icon={gpsDotIcon} />}

          {points.length === 2 && (
            <Polyline
              positions={points.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: '#10b981', weight: 3, dashArray: '6 4' }}
            />
          )}

          {points.length >= 3 && (
            <Polygon
              positions={points.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color: '#10b981',
                weight: 3,
                fillColor: '#10b981',
                fillOpacity: 0.24,
              }}
            />
          )}

          {points.map((pt, idx) => (
            <Marker
              key={`v-${idx}`}
              position={[pt.lat, pt.lng]}
              icon={vertexIcon(idx)}
              draggable={true}
              eventHandlers={{
                dragend(e) {
                  const marker = e.target;
                  const nextPos = marker.getLatLng();
                  setPoints((prev) =>
                    prev.map((item, i) =>
                      i === idx ? { lat: nextPos.lat, lng: nextPos.lng } : item
                    )
                  );
                },
                contextmenu() {
                  // Sağ tık veya uzun basış ile tekil köşe silme
                  setPoints((prev) => prev.filter((_, i) => i !== idx));
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={0.9}>
                <span className="text-[10px] font-bold">
                  Köşe {idx + 1} (Sürükle / Sağ Tık Sil)
                </span>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {/* Center Crosshair Helper for TKGM Lookup */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[900]">
          <Crosshair size={22} className="text-white/40 drop-shadow" />
        </div>

        {/* TKGM Info Pill if Queried */}
        {tkgmMeta && (
          <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-sm z-[1000] bg-stone-950/90 backdrop-blur-md border border-amber-500/30 rounded-2xl p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <MapPin size={12} /> TKGM Sorgu Sonucu
              </span>
              <button
                type="button"
                onClick={() => setTkgmMeta(null)}
                className="text-stone-400 hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
            <p className="text-xs font-bold text-white">
              {[tkgmMeta.il, tkgmMeta.ilce, tkgmMeta.mahalle].filter(Boolean).join(' / ') || 'Konum Doğrulandı'}
            </p>
            <div className="flex flex-wrap gap-2 mt-1.5 text-[11px] text-stone-300">
              {tkgmMeta.ada && (
                <span className="px-2 py-0.5 rounded-lg bg-stone-800 border border-white/10">
                  Ada: <strong>{tkgmMeta.ada}</strong>
                </span>
              )}
              {tkgmMeta.parsel && (
                <span className="px-2 py-0.5 rounded-lg bg-stone-800 border border-white/10">
                  Parsel: <strong>{tkgmMeta.parsel}</strong>
                </span>
              )}
              {tkgmMeta.alanDekar ? (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Resmi Alan: <strong>{tkgmMeta.alanDekar} daa</strong>
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Bottom Floating Control & Auto Dekar Bar */}
        <div className="absolute bottom-4 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[620px] z-[1000] bg-stone-950/95 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block">
                Otomatik Hesaplanan Tarla Alanı (WGS84)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {metrics.dekar.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  daa
                </span>
                <span className="text-xs font-mono text-stone-400">
                  ({Math.round(metrics.areaM2).toLocaleString('tr-TR')} m² • {points.length} köşe)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={points.length === 0}
                onClick={() => setPoints((prev) => prev.slice(0, -1))}
                className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 border border-white/10 transition-all"
                title="Son Köşeyi Geri Al"
              >
                <Undo2 size={17} />
              </button>
              <button
                type="button"
                disabled={points.length === 0}
                onClick={() => setPoints([])}
                className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 text-rose-300 border border-rose-500/30 transition-all"
                title="Poligonu Temizle"
              >
                <Trash2 size={17} />
              </button>
              <button
                type="button"
                disabled={points.length < 3}
                onClick={handleConfirmSave}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
              >
                <Check size={16} />
                <span>Poligonu & {metrics.dekar} daa Kaydet</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-400 border-t border-white/10 pt-2">
            <Move size={13} className="text-emerald-400 shrink-0" />
            <span>
              Köşe noktalarını parmağınızla/fareyle sürükleyerek düzeltebilir, en az 3 köşe işaretlediğinizde kaydedebilirsiniz.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

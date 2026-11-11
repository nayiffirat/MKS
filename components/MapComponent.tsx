import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  Marker,
  useMapEvents,
  useMap,
  WMSTileLayer,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  ArrowLeft,
  Ruler,
  Square,
  Trash2,
  Search,
  Navigation,
  Undo2,
  Map as MapIcon,
  Layers,
  Share2,
  MapPin,
  Save,
  X,
  Edit2,
  Move,
  Satellite,
  Flame,
  Loader2,
  Check,
} from "lucide-react";
import { useAppViewModel } from "../context/AppContext";
import { dbService } from "../services/db";
import { Field, SavedMapFeature, VisitLog } from "../types";
import {
  computePolygonMetrics,
  geoJsonToLatLngs,
  latLngsToGeoJsonPolygon,
} from "../utils/fieldPolygon";
import { FieldSatelliteAnalyzerModal } from "./farmers/FieldSatelliteAnalyzerModal";
import { API_BASE } from "../utils/api";

// Fix Leaflet default marker icon URLs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const userLocationIcon = new L.DivIcon({
  className: "custom-div-icon",
  html: "<div style='width: 16px; height: 16px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5);'></div>",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const LocateButton = () => {
  const map = useMap();
  const [position, setPosition] = useState<L.LatLng | null>(null);

  useEffect(() => {
    const handleLocationFound = (e: L.LocationEvent) => {
      setPosition(e.latlng);
    };
    map.on("locationfound", handleLocationFound);
    map.locate({ setView: true, maxZoom: 16 });

    return () => {
      map.off("locationfound", handleLocationFound);
    };
  }, [map]);

  return (
    <>
      <button
        type="button"
        onClick={() => map.locate({ setView: true, maxZoom: 16 })}
        title="Konumuma Git (GPS)"
        className="absolute bottom-8 right-4 z-[1000] p-3.5 bg-stone-900 hover:bg-stone-800 rounded-2xl shadow-xl border border-white/15 text-sky-400 active:scale-95 transition-all"
      >
        <Navigation size={22} />
      </button>
      {position && <Marker position={position} icon={userLocationIcon} />}
    </>
  );
};

const SavedFeatureRenderer: React.FC<{
  feature: SavedMapFeature;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onOpenSatellite?: (feature: SavedMapFeature) => void;
}> = ({ feature, onRemove, onEdit, onOpenSatellite }) => {
  const [showMenu, setShowMenu] = useState(false);

  if (!Array.isArray(feature.points) || feature.points.length === 0) return null;

  const transparentTooltipClasses =
    "!bg-transparent !border-0 !shadow-none !p-0";

  const renderTooltipContent = () => {
    if (showMenu) {
      return (
        <div
          className="bg-stone-950/95 px-2.5 py-1.5 rounded-xl border border-white/20 shadow-2xl flex items-center gap-1.5 pointer-events-auto backdrop-blur-md"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          {feature.type === "AREA" && onOpenSatellite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSatellite(feature);
                setShowMenu(false);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-stone-950 rounded-lg px-2 py-1.5 text-[10px] font-black flex items-center gap-1 transition-colors"
              title="Uydu Analizi (NDVI / Sulama / Çamur)"
            >
              <Satellite size={12} />
              <span>Uydu</span>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(feature.id);
              setShowMenu(false);
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-1.5 flex items-center justify-center transition-colors"
            title="İsmi Düzenle"
          >
            <Edit2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(feature.id);
              setShowMenu(false);
            }}
            className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg p-1.5 flex items-center justify-center transition-colors"
            title="Sil"
          >
            <Trash2 size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
            className="bg-stone-700 hover:bg-stone-600 text-white rounded-lg p-1.5 flex items-center justify-center transition-colors"
            title="Kapat"
          >
            <X size={12} />
          </button>
        </div>
      );
    }

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setShowMenu(true);
        }}
        className="bg-stone-950/85 px-3 py-1.5 rounded-full border border-emerald-500/30 shadow-xl flex items-center gap-1.5 pointer-events-auto backdrop-blur-md cursor-pointer hover:bg-stone-900 transition-all active:scale-95"
      >
        {feature.type === "AREA" && (
          <Satellite size={11} className="text-emerald-400 shrink-0" />
        )}
        <span className="font-bold text-[11px] text-white max-w-[180px] truncate">
          {feature.name}
        </span>
      </div>
    );
  };

  if (feature.type === "COORDINATE") {
    return (
      <CircleMarker
        center={[feature.points[0].lat, feature.points[0].lng]}
        radius={6}
        pathOptions={{
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.9,
          weight: 2,
        }}
      >
        <Tooltip
          permanent
          interactive
          direction="top"
          offset={[0, -8]}
          className={transparentTooltipClasses}
        >
          {renderTooltipContent()}
        </Tooltip>
      </CircleMarker>
    );
  }

  if (feature.type === "AREA" && feature.points.length >= 3) {
    return (
      <Polygon
        positions={feature.points.map((p) => [p.lat, p.lng] as [number, number])}
        pathOptions={{
          color: "#10b981",
          fillColor: "#10b981",
          fillOpacity: 0.28,
          weight: 3,
        }}
      >
        <Tooltip
          permanent
          interactive
          direction="center"
          className={transparentTooltipClasses}
        >
          {renderTooltipContent()}
        </Tooltip>
      </Polygon>
    );
  }

  if (feature.type === "DISTANCE" && feature.points.length >= 2) {
    return (
      <Polyline
        positions={feature.points.map((p) => [p.lat, p.lng] as [number, number])}
        pathOptions={{
          color: "#ef4444",
          weight: 4,
        }}
      >
        <Tooltip
          permanent
          interactive
          direction="center"
          className={transparentTooltipClasses}
        >
          {renderTooltipContent()}
        </Tooltip>
      </Polyline>
    );
  }

  return null;
};

export const MapComponent = ({ onBack }: { onBack: () => void }) => {
  const { farmers, showToast, userProfile, updateFarmer } = useAppViewModel();
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [mode, setMode] = useState<"DISTANCE" | "AREA" | "COORDINATE" | null>(
    null
  );
  const [mapType, setMapType] = useState<"satellite" | "street">("satellite");
  const [showParsel, setShowParsel] = useState(false);
  const [showOutbreakHeatmap, setShowOutbreakHeatmap] = useState(false);
  const [visits, setVisits] = useState<VisitLog[]>([]);
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [saveDialog, setSaveDialog] = useState<{
    isOpen: boolean;
    defaultName: string;
    selectedFarmerId: string;
    cropName: string;
  }>({ isOpen: false, defaultName: "", selectedFarmerId: "", cropName: "" });

  const [savedFeatures, setSavedFeatures] = useState<SavedMapFeature[]>([]);
  const [isQueryingTkgm, setIsQueryingTkgm] = useState(false);
  const [tkgmResult, setTkgmResult] = useState<any | null>(null);
  const [tkgmAssignFarmerId, setTkgmAssignFarmerId] = useState<string>("");
  const [tkgmAssignCrop, setTkgmAssignCrop] = useState<string>("");
  const [activeSatelliteTarget, setActiveSatelliteTarget] = useState<{
    field: Field;
    farmerName?: string;
  } | null>(null);

  const isSelecting = useRef(false);
  const mapRef = useRef<L.Map>(null);

  // Escape tuşu ile haritadan güvenli ve anında çıkış (Web + Masaüstü)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeSatelliteTarget) {
        setActiveSatelliteTarget(null);
        return;
      }
      if (tkgmResult) {
        setTkgmResult(null);
        return;
      }
      if (saveDialog.isOpen) {
        setSaveDialog((prev) => ({ ...prev, isOpen: false }));
        return;
      }
      if (mode) {
        setMode(null);
        setPoints([]);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      onBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSatelliteTarget, tkgmResult, saveDialog.isOpen, mode, onBack]);

  // Kalıcı Harita Parsellerini IndexedDB + Firestore'dan Yükle (Eski localStorage kayıtlarını da sıfır kayıpla taşı)
  useEffect(() => {
    let mounted = true;
    const loadFeatures = async () => {
      try {
        const dbItems = await dbService.getMapFeatures();
        const uid = dbService.getCurrentUserId() || userProfile?.uid || "guest";
        const legacyKeys = [
          `mks_map_saved_features_${uid}`,
          "mks_map_saved_features_undefined",
        ];
        const existingIds = new Set(dbItems.map((f) => f.id));
        const migrated: SavedMapFeature[] = [...dbItems];

        for (const key of legacyKeys) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                if (item?.id && Array.isArray(item.points) && !existingIds.has(item.id)) {
                  const normalized: SavedMapFeature = {
                    id: String(item.id),
                    name: String(item.name || "Kayıtlı Parsel"),
                    type: item.type || "AREA",
                    points: item.points,
                    farmerId: item.farmerId,
                    createdAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                  };
                  await dbService.saveMapFeature(normalized);
                  migrated.push(normalized);
                  existingIds.add(normalized.id);
                }
              }
            }
            localStorage.removeItem(key);
          } catch {
            // ignore malformed legacy
          }
        }

        if (mounted) {
          setSavedFeatures(migrated);
        }
      } catch (err) {
        console.error("Harita parselleri yüklenemedi:", err);
      }
    };
    loadFeatures();
    dbService.getAllVisits().then((v: VisitLog[]) => {
      if (mounted) setVisits(v.filter((item: VisitLog) => !item.deletedAt));
    });
    return () => {
      mounted = false;
    };
  }, [userProfile?.uid]);

  // Çiftçi kartlarındaki çizili tarla poligonlarını harita üzerinde otomatik göster
  const farmerFieldPolygons = useMemo(() => {
    const list: {
      farmerId: string;
      farmerName: string;
      field: Field;
      latlngs: { lat: number; lng: number }[];
    }[] = [];
    for (const farmer of farmers) {
      if (farmer.deletedAt || !Array.isArray(farmer.fields)) continue;
      for (const fld of farmer.fields) {
        if (!fld.polygonGeoJson) continue;
        const pts = geoJsonToLatLngs(fld.polygonGeoJson);
        if (pts.length >= 3) {
          list.push({
            farmerId: farmer.id,
            farmerName: farmer.fullName,
            field: fld,
            latlngs: pts,
          });
        }
      }
    }
    return list;
  }, [farmers]);

  // Faz 4 #6: Köy Bazlı Salgın & Zararlı Isı Haritası noktaları
  const outbreakClusters = useMemo(() => {
    if (!showOutbreakHeatmap) return [];
    const byFarmer = new Map(farmers.map((f) => [f.id, f]));
    const clusters = new Map<
      string,
      { village: string; lat: number; lng: number; count: number; notes: string[] }
    >();

    const cutoffMs = Date.now() - 45 * 86_400_000;
    for (const v of visits) {
      if (new Date(v.date).getTime() < cutoffMs) continue;
      const farmer = byFarmer.get(v.farmerId);
      let lat = farmer?.latitude;
      let lng = farmer?.longitude;
      if ((!lat || !lng) && farmer?.fields?.length) {
        const fldWithCentroid = farmer.fields.find((fl) => fl.centroidLat && fl.centroidLng);
        if (fldWithCentroid) {
          lat = fldWithCentroid.centroidLat;
          lng = fldWithCentroid.centroidLng;
        }
      }
      if (!lat || !lng) continue;
      const key = (farmer?.village || "Bölge").trim().toLowerCase();
      const cur = clusters.get(key) || {
        village: farmer?.village || "Bölge",
        lat,
        lng,
        count: 0,
        notes: [],
      };
      cur.count += 1;
      if (v.note && cur.notes.length < 3) {
        cur.notes.push(v.note.slice(0, 60));
      }
      clusters.set(key, cur);
    }
    return Array.from(clusters.values());
  }, [showOutbreakHeatmap, visits, farmers]);

  useEffect(() => {
    if (search.length < 3) {
      setSuggestions([]);
      return;
    }
    if (isSelecting.current) {
      isSelecting.current = false;
      setSuggestions([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            search
          )}&countrycodes=tr&limit=5`
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Arama hatası:", err);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleSelectSuggestion = (sug: any) => {
    if (mapRef.current) {
      mapRef.current.flyTo([parseFloat(sug.lat), parseFloat(sug.lon)], 15);
    }
    isSelecting.current = true;
    setSearch(sug.display_name.split(",")[0]);
    setSuggestions([]);
  };

  const MapEvents = () => {
    useMapEvents({
      click: (e) => {
        if (mode === "COORDINATE") {
          setPoints([e.latlng]);
          setTkgmResult(null);
        } else if (mode) {
          setPoints([...points, e.latlng]);
        }
      },
    });
    return null;
  };

  const polygonMetrics = useMemo(
    () =>
      computePolygonMetrics(
        points.map((p) => ({ lat: p.lat, lng: p.lng }))
      ),
    [points]
  );

  const totalDistance = points.reduce(
    (acc, curr, i, arr) => (i === 0 ? 0 : acc + curr.distanceTo(arr[i - 1])),
    0
  );

  const handleSaveFeature = () => {
    let defaultName = "Konum";
    if (mode === "AREA") defaultName = "Tarla Parseli";
    if (mode === "DISTANCE") defaultName = "Mesafe Hattı";

    setSaveDialog({
      isOpen: true,
      defaultName,
      selectedFarmerId: "",
      cropName: "",
    });
  };

  const confirmSave = async () => {
    const cleanName = saveDialog.defaultName.trim();
    if (!cleanName || !mode) return;

    const farmerId = saveDialog.selectedFarmerId || undefined;
    let finalName = cleanName;
    if (mode === "AREA") {
      finalName = `${cleanName} (${polygonMetrics.dekar.toFixed(2)} daa)`;
    } else if (mode === "DISTANCE") {
      finalName = `${cleanName} (${totalDistance.toFixed(0)} m)`;
    }

    let linkedFieldId: string | undefined;

    if (farmerId) {
      const farmer = farmers.find((f) => f.id === farmerId);
      if (farmer) {
        if (mode === "COORDINATE" && points[0]) {
          await updateFarmer({
            ...farmer,
            latitude: points[0].lat,
            longitude: points[0].lng,
          });
        } else if (mode === "AREA" && polygonMetrics.feature) {
          linkedFieldId = crypto.randomUUID();
          const newField: Field = {
            id: linkedFieldId,
            name: cleanName,
            size: polygonMetrics.dekar,
            crop: saveDialog.cropName.trim() || "Belirtilmedi",
            polygonGeoJson: JSON.stringify(polygonMetrics.feature),
            polygonBbox: polygonMetrics.bbox,
            centroidLat: polygonMetrics.centroid.lat,
            centroidLng: polygonMetrics.centroid.lng,
          };
          await updateFarmer({
            ...farmer,
            latitude: farmer.latitude || polygonMetrics.centroid.lat,
            longitude: farmer.longitude || polygonMetrics.centroid.lng,
            fields: [...(farmer.fields || []), newField],
          });
        }
      }
    }

    const newFeature: SavedMapFeature = {
      id: crypto.randomUUID(),
      name: finalName,
      type: mode,
      points: points.map((p) => ({ lat: p.lat, lng: p.lng })),
      farmerId,
      fieldId: linkedFieldId,
      dekar: mode === "AREA" ? polygonMetrics.dekar : undefined,
      polygonGeoJson:
        mode === "AREA" && polygonMetrics.feature
          ? JSON.stringify(polygonMetrics.feature)
          : undefined,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    await dbService.saveMapFeature(newFeature);
    setSavedFeatures((prev) => [...prev, newFeature]);
    setPoints([]);
    setMode(null);
    setSaveDialog({
      isOpen: false,
      defaultName: "",
      selectedFarmerId: "",
      cropName: "",
    });
    showToast("Parsel kalıcı olarak haritaya ve hesabınıza kaydedildi.", "success");
  };

  const handleRemoveFeature = async (id: string) => {
    if (window.confirm("Bu parsel kaydını haritadan silmek istediğinize emin misiniz?")) {
      await dbService.deleteMapFeature(id);
      setSavedFeatures((prev) => prev.filter((f) => f.id !== id));
      showToast("Parsel kaydı silindi.", "info");
    }
  };

  const handleEditFeature = async (id: string) => {
    const feature = savedFeatures.find((f) => f.id === id);
    if (!feature) return;
    const newName = window.prompt("Parsel / kayıt ismini düzenleyin:", feature.name);
    if (newName && newName.trim()) {
      const updated: SavedMapFeature = {
        ...feature,
        name: newName.trim(),
        lastUpdated: new Date().toISOString(),
      };
      await dbService.saveMapFeature(updated);
      setSavedFeatures((prev) => prev.map((f) => (f.id === id ? updated : f)));
    }
  };

  const handleOpenSatelliteFromSaved = (feature: SavedMapFeature) => {
    const geoJson =
      feature.polygonGeoJson ||
      JSON.stringify(latLngsToGeoJsonPolygon(feature.points));
    if (!geoJson) return;
    const metrics = computePolygonMetrics(feature.points);
    const farmer = feature.farmerId
      ? farmers.find((f) => f.id === feature.farmerId)
      : undefined;

    setActiveSatelliteTarget({
      farmerName: farmer?.fullName,
      field: {
        id: feature.fieldId || `map_${feature.id}`,
        name: feature.name,
        size: feature.dekar || metrics.dekar,
        crop: "",
        polygonGeoJson: geoJson,
        polygonBbox: metrics.bbox,
        centroidLat: metrics.centroid.lat,
        centroidLng: metrics.centroid.lng,
      },
    });
  };

  // Uygulama İçi Canlı TKGM Sorgusu (Dış sayfaya yönlendirmeden doğrudan sonuç verir)
  const handleInAppTkgmQuery = async () => {
    if (!points[0]) return;
    const cleanLat = Number(points[0].lat.toFixed(6));
    const cleanLng = Number(points[0].lng.toFixed(6));
    setIsQueryingTkgm(true);
    setTkgmResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/tkgm/parcel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: cleanLat, lng: cleanLng }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "TKGM sorgusu başarısız oldu.");
      }
      setTkgmResult(data);
      if (data.geometry) {
        const polyPts = geoJsonToLatLngs(data.geometry);
        if (polyPts.length >= 3 && mapRef.current) {
          const bounds = L.latLngBounds(
            polyPts.map((p) => [p.lat, p.lng] as [number, number])
          );
          if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
          }
        }
      }
    } catch (err: any) {
      // İstemci tarafı idari konum yedeği (statik barındırma veya geçici ağ kesintisi için)
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${cleanLat}&lon=${cleanLng}&zoom=18&addressdetails=1&accept-language=tr`
        );
        if (nomRes.ok) {
          const nom = await nomRes.json();
          const addr = nom?.address || {};
          setTkgmResult({
            source: "KONUM_IDARI",
            il: addr.province || addr.state || "",
            ilce: addr.town || addr.county || addr.city_district || addr.municipality || "",
            mahalle: addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || "",
            ada: "",
            parsel: "",
            alanM2: 0,
            alanDekar: 0,
            nitelik: "Tarım Alanı (İdari Konum Doğrulandı)",
            lat: cleanLat,
            lng: cleanLng,
            geometry: null,
            note: "İdari mahalle/köy bilgisi doğrulandı. 'Parselleri Çiz' (TKGM WMS) katmanını açarak sınırları harita üstünde görebilir ve kaydedebilirsiniz.",
          });
          return;
        }
      } catch {
        // ignore fallback error
      }
      showToast(err?.message || "TKGM parsel sorgusu yapılamadı.", "error");
    } finally {
      setIsQueryingTkgm(false);
    }
  };

  const handleSaveTkgmParcelToFarmer = async () => {
    if (!tkgmResult) return;
    const polyPts = tkgmResult.geometry
      ? geoJsonToLatLngs(tkgmResult.geometry)
      : [];
    const metrics = polyPts.length >= 3 ? computePolygonMetrics(polyPts) : null;
    const dekar = tkgmResult.alanDekar || metrics?.dekar || 0;
    const label = [
      tkgmResult.mahalle,
      tkgmResult.ada ? `Ada ${tkgmResult.ada}` : "",
      tkgmResult.parsel ? `Parsel ${tkgmResult.parsel}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    let fieldId: string | undefined;
    if (tkgmAssignFarmerId) {
      const farmer = farmers.find((f) => f.id === tkgmAssignFarmerId);
      if (farmer) {
        fieldId = crypto.randomUUID();
        const newField: Field = {
          id: fieldId,
          name: label || "TKGM Parseli",
          size: dekar,
          crop: tkgmAssignCrop.trim() || "Belirtilmedi",
          polygonGeoJson: metrics?.feature
            ? JSON.stringify(metrics.feature)
            : undefined,
          polygonBbox: metrics?.bbox,
          centroidLat: tkgmResult.lat,
          centroidLng: tkgmResult.lng,
          tkgmIl: tkgmResult.il,
          tkgmIlce: tkgmResult.ilce,
          tkgmMahalle: tkgmResult.mahalle,
          tkgmAda: tkgmResult.ada,
          tkgmParsel: tkgmResult.parsel,
        };
        await updateFarmer({
          ...farmer,
          latitude: farmer.latitude || tkgmResult.lat,
          longitude: farmer.longitude || tkgmResult.lng,
          fields: [...(farmer.fields || []), newField],
        });
      }
    }

    const newSaved: SavedMapFeature = {
      id: crypto.randomUUID(),
      name: `${label || "TKGM Parseli"}${dekar ? ` (${dekar} daa)` : ""}`,
      type: polyPts.length >= 3 ? "AREA" : "COORDINATE",
      points:
        polyPts.length >= 3
          ? polyPts
          : [{ lat: tkgmResult.lat, lng: tkgmResult.lng }],
      farmerId: tkgmAssignFarmerId || undefined,
      fieldId,
      dekar: dekar || undefined,
      polygonGeoJson: metrics?.feature ? JSON.stringify(metrics.feature) : undefined,
      tkgmInfo: {
        il: tkgmResult.il,
        ilce: tkgmResult.ilce,
        mahalle: tkgmResult.mahalle,
        ada: tkgmResult.ada,
        parsel: tkgmResult.parsel,
        nitelik: tkgmResult.nitelik,
        alanM2: tkgmResult.alanM2,
      },
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    await dbService.saveMapFeature(newSaved);
    setSavedFeatures((prev) => [...prev, newSaved]);
    setTkgmResult(null);
    setPoints([]);
    setMode(null);
    showToast("TKGM parseli başarıyla kaydedildi.", "success");
  };

  return (
    <div
      data-mks-not-modal="true"
      className="fixed inset-0 z-[100] flex flex-col pt-safe bg-stone-950"
    >
      {/* Üst Kontrol Çubuğu */}
      <div className="absolute top-3 left-3 right-3 z-[1000] space-y-2 max-w-4xl mx-auto">
        <div className="flex gap-2 items-center bg-stone-900/95 backdrop-blur-md p-2 rounded-2xl border border-white/15 shadow-2xl">
          <button
            type="button"
            data-mks-screen-back="true"
            onClick={onBack}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-stone-800 hover:bg-rose-600/90 text-stone-100 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all border border-white/10 shrink-0"
            title="Haritadan Çık (ESC)"
          >
            <ArrowLeft size={16} />
            <span className="hidden xs:inline sm:inline">Haritadan Çık</span>
            <span className="inline sm:hidden">Çık</span>
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (suggestions.length > 0) {
                handleSelectSuggestion(suggestions[0]);
              }
            }}
            className="relative flex-1 min-w-0"
          >
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              size={16}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Köy, mahalle veya ilçe ara..."
              className="w-full bg-stone-950 text-white py-2.5 pl-9 pr-3 rounded-xl text-xs outline-none border border-stone-800 focus:border-emerald-500 transition-all"
            />
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl flex flex-col z-[1100]">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="text-left px-3 py-2.5 text-xs text-stone-200 hover:bg-stone-800 border-b border-stone-800/60 last:border-0 truncate"
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Araç Butonları */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full">
          <button
            type="button"
            onClick={() => {
              setShowParsel((p) => !p);
              if (!showParsel) {
                showToast("TKGM kadastro parsel sınırları açıldı.", "info");
              }
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-xs font-bold transition-colors border ${
              showParsel
                ? "bg-indigo-600 text-white shadow-lg border-indigo-400"
                : "bg-stone-900/95 text-stone-200 border-white/10 hover:bg-stone-800"
            }`}
          >
            <Layers size={16} />
            <span className="text-[10px] text-center leading-tight">
              TKGM Sınır
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "COORDINATE" ? null : "COORDINATE");
              setPoints([]);
              setTkgmResult(null);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-xs font-bold transition-colors border ${
              mode === "COORDINATE"
                ? "bg-amber-600 text-white shadow-lg border-amber-400"
                : "bg-stone-900/95 text-stone-200 border-white/10 hover:bg-stone-800"
            }`}
          >
            <MapPin size={16} />
            <span className="text-[10px] text-center leading-tight">
              TKGM Sorgu
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "AREA" ? null : "AREA");
              setPoints([]);
              setTkgmResult(null);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-xs font-bold transition-colors border ${
              mode === "AREA"
                ? "bg-emerald-600 text-stone-950 shadow-lg border-emerald-300"
                : "bg-stone-900/95 text-stone-200 border-white/10 hover:bg-stone-800"
            }`}
          >
            <Square size={16} />
            <span className="text-[10px] text-center leading-tight">
              Parsel Çiz
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "DISTANCE" ? null : "DISTANCE");
              setPoints([]);
              setTkgmResult(null);
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-xs font-bold transition-colors border ${
              mode === "DISTANCE"
                ? "bg-sky-600 text-white shadow-lg border-sky-400"
                : "bg-stone-900/95 text-stone-200 border-white/10 hover:bg-stone-800"
            }`}
          >
            <Ruler size={16} />
            <span className="text-[10px] text-center leading-tight">
              Mesafe
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowOutbreakHeatmap((v) => !v)}
            className={`min-h-[48px] flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl text-xs font-bold transition-colors border ${
              showOutbreakHeatmap
                ? "bg-rose-600 text-white shadow-lg border-rose-400"
                : "bg-stone-900/95 text-stone-200 border-white/10 hover:bg-stone-800"
            }`}
          >
            <Flame size={16} />
            <span className="text-[10px] text-center leading-tight">
              Salgın
            </span>
          </button>
        </div>

        {mode && points.length > 0 && (
          <div className="flex gap-2 items-center justify-end">
            <button
              type="button"
              onClick={() => setPoints((p) => p.slice(0, -1))}
              className="p-2.5 rounded-xl bg-stone-900 text-stone-200 hover:bg-stone-800 transition-colors shadow-lg border border-white/10"
              title="Son Noktayı Geri Al"
            >
              <Undo2 size={17} />
            </button>
            <button
              type="button"
              onClick={() => {
                setPoints([]);
                setTkgmResult(null);
              }}
              className="p-2.5 rounded-xl bg-rose-900/90 text-rose-100 hover:bg-rose-800 transition-colors shadow-lg border border-rose-700"
              title="Temizle"
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>

      {/* Poligon (Alan) veya Mesafe Alt Kayıt Kartı */}
      {mode && mode !== "COORDINATE" && (
        <div className="absolute bottom-4 left-3 right-3 z-[1000] md:left-4 md:right-auto bg-stone-950/92 backdrop-blur-xl px-4 sm:px-5 py-4 rounded-3xl border border-white/15 shadow-2xl flex flex-col gap-3 md:w-[390px] max-w-[calc(100vw-24px)] max-h-[65vh] overflow-y-auto">
          {saveDialog.isOpen ? (
            <div className="flex flex-col gap-2.5 w-full">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Parseli Kalıcı Olarak Kaydet
              </span>
              <input
                autoFocus
                value={saveDialog.defaultName}
                onChange={(e) =>
                  setSaveDialog((prev) => ({ ...prev, defaultName: e.target.value }))
                }
                placeholder="Parsel / Arazi adı..."
                className="bg-stone-900 text-white text-xs px-4 py-2.5 rounded-xl outline-none border border-stone-700 focus:border-emerald-500"
              />
              {mode === "AREA" && (
                <>
                  <select
                    value={saveDialog.selectedFarmerId}
                    onChange={(e) =>
                      setSaveDialog((prev) => ({
                        ...prev,
                        selectedFarmerId: e.target.value,
                      }))
                    }
                    className="bg-stone-900 text-white text-xs px-4 py-2.5 rounded-xl outline-none border border-stone-700 focus:border-emerald-500"
                  >
                    <option value="">Çiftçi Kartına Bağla (İsteğe Bağlı)</option>
                    {farmers
                      .filter((f) => !f.deletedAt)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.fullName} {f.village ? `(${f.village})` : ""}
                        </option>
                      ))}
                  </select>
                  {saveDialog.selectedFarmerId && (
                    <input
                      value={saveDialog.cropName}
                      onChange={(e) =>
                        setSaveDialog((prev) => ({ ...prev, cropName: e.target.value }))
                      }
                      placeholder="Ekili Ürün (Örn: Pamuk, Buğday, Mısır)"
                      className="bg-stone-900 text-white text-xs px-4 py-2.5 rounded-xl outline-none border border-stone-700 focus:border-emerald-500"
                    />
                  )}
                </>
              )}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setSaveDialog((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-3.5 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={confirmSave}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-xs font-black flex items-center gap-1.5"
                >
                  <Save size={15} />
                  <span>Kaydet</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-stone-400 font-black uppercase tracking-wider block">
                    {mode === "DISTANCE" ? "Toplam Mesafe" : "Otomatik Dekar Hesabı"}
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {mode === "DISTANCE"
                      ? `${totalDistance.toFixed(0)} m`
                      : `${polygonMetrics.dekar.toFixed(2)} daa`}
                  </span>
                </div>
                {(mode === "DISTANCE" ? points.length > 1 : points.length > 2) && (
                  <button
                    type="button"
                    onClick={handleSaveFeature}
                    className="bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black text-xs px-4 py-3 rounded-2xl flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
                  >
                    <Save size={16} />
                    <span>Parseli Kaydet</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1.5 border-t border-white/10 text-[11px] text-stone-300">
                <Move size={13} className="shrink-0 text-amber-400" />
                <span>
                  Haritaya dokunarak köşe ekleyin, köşeleri sürükleyerek sınırı hassaslaştırın.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Koordinat ve Uygulama İçi TKGM Sorgu Kartı */}
      {mode === "COORDINATE" && points.length > 0 && (
        <div className="absolute bottom-4 left-3 right-3 z-[1000] md:left-4 md:right-auto bg-stone-950/95 backdrop-blur-xl px-4 sm:px-5 py-4 rounded-3xl border border-white/15 shadow-2xl flex flex-col gap-3 md:w-[400px] max-w-[calc(100vw-24px)] max-h-[68vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-stone-400 font-black uppercase tracking-wider block">
                Seçilen Koordinat
              </span>
              <span className="font-mono text-xs font-bold text-amber-400">
                {points[0].lat.toFixed(6)}, {points[0].lng.toFixed(6)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPoints([]);
                setTkgmResult(null);
              }}
              className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>

          {/* Uygulama İçi TKGM Sorgu Sonucu */}
          {tkgmResult && (
            <div className="bg-indigo-950/50 border border-indigo-500/35 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                  TKGM Parsel Sorgu Sonucu
                </span>
                {tkgmResult.alanDekar > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-black font-mono">
                    {tkgmResult.alanDekar} daa
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-stone-900/80 p-2 rounded-xl border border-white/5">
                  <span className="text-[9px] text-stone-400 uppercase block">İl / İlçe</span>
                  <span className="font-bold text-white">
                    {[tkgmResult.il, tkgmResult.ilce].filter(Boolean).join(" / ") || "-"}
                  </span>
                </div>
                <div className="bg-stone-900/80 p-2 rounded-xl border border-white/5">
                  <span className="text-[9px] text-stone-400 uppercase block">Mahalle / Köy</span>
                  <span className="font-bold text-white">{tkgmResult.mahalle || "-"}</span>
                </div>
                <div className="bg-stone-900/80 p-2 rounded-xl border border-white/5">
                  <span className="text-[9px] text-stone-400 uppercase block">Ada / Parsel</span>
                  <span className="font-black font-mono text-amber-300">
                    {tkgmResult.ada || "-"} / {tkgmResult.parsel || "-"}
                  </span>
                </div>
                <div className="bg-stone-900/80 p-2 rounded-xl border border-white/5">
                  <span className="text-[9px] text-stone-400 uppercase block">Nitelik</span>
                  <span className="font-bold text-stone-200 truncate block">
                    {tkgmResult.nitelik || "Tarla"}
                  </span>
                </div>
              </div>

              {tkgmResult.note && (
                <p className="text-[10px] text-stone-300 leading-relaxed">{tkgmResult.note}</p>
              )}

              <div className="pt-2 border-t border-white/10 space-y-2">
                <select
                  value={tkgmAssignFarmerId}
                  onChange={(e) => setTkgmAssignFarmerId(e.target.value)}
                  className="w-full bg-stone-900 text-white text-xs px-3 py-2 rounded-xl border border-stone-700 outline-none"
                >
                  <option value="">Sadece Haritaya Kaydet (Çiftçi Seçilmedi)</option>
                  {farmers
                    .filter((f) => !f.deletedAt)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        Çiftçiye Ekle: {f.fullName}
                      </option>
                    ))}
                </select>
                {tkgmAssignFarmerId && (
                  <input
                    value={tkgmAssignCrop}
                    onChange={(e) => setTkgmAssignCrop(e.target.value)}
                    placeholder="Ekili ürün (Örn: Pamuk, Mısır, Fıstık)"
                    className="w-full bg-stone-900 text-white text-xs px-3 py-2 rounded-xl border border-stone-700 outline-none"
                  />
                )}
                <button
                  type="button"
                  onClick={handleSaveTkgmParcelToFarmer}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5"
                >
                  <Check size={15} />
                  <span>Parseli MKS'ye Kaydet</span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isQueryingTkgm}
              onClick={handleInAppTkgmQuery}
              className="bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 text-[11px] font-black py-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all border border-indigo-500/35 active:scale-95"
            >
              {isQueryingTkgm ? (
                <Loader2 size={18} className="animate-spin text-indigo-300" />
              ) : (
                <MapIcon size={18} className="text-indigo-300" />
              )}
              <span>TKGM'de Sorgula</span>
            </button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Tarla Konumu: https://maps.google.com/?q=${points[0].lat},${points[0].lng}`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="bg-stone-900 hover:bg-stone-800 text-stone-200 text-[11px] font-bold py-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all border border-white/10 active:scale-95"
            >
              <Share2 size={18} className="text-emerald-400" />
              <span>Paylaş</span>
            </a>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${points[0].lat},${points[0].lng}`}
              target="_blank"
              rel="noreferrer"
              className="bg-stone-900 hover:bg-stone-800 text-stone-200 text-[11px] font-bold py-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all border border-white/10 active:scale-95"
            >
              <Navigation size={18} className="text-sky-400" />
              <span>Yol Tarifi</span>
            </a>
          </div>
        </div>
      )}

      {/* Altlık Değiştirici (Esri Uydu <-> Sokak) */}
      <div className="absolute bottom-24 right-4 z-[1000] flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() =>
            setMapType((t) => (t === "satellite" ? "street" : "satellite"))
          }
          className="flex items-center gap-2 p-3.5 rounded-2xl bg-stone-900 text-stone-200 shadow-xl border border-white/15 hover:bg-stone-800 transition-colors"
          title={
            mapType === "satellite"
              ? "Sokak Haritasına Geç"
              : "Esri Uydu Haritasına Geç"
          }
        >
          <Layers size={20} />
        </button>
      </div>

      {/* Ana Harita */}
      <MapContainer
        ref={mapRef}
        center={[38.5, 36.5]}
        zoom={7}
        maxZoom={19}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url={
            mapType === "satellite"
              ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
          maxZoom={19}
          attribution={
            mapType === "satellite"
              ? "Tiles &copy; Esri"
              : "&copy; OpenStreetMap contributors"
          }
        />
        {mapType === "satellite" && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            opacity={0.75}
          />
        )}

        {showParsel && (
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

        <MapEvents />
        <LocateButton />

        {/* Çiftçi Kartlarına Bağlı Arazi Poligonları */}
        {farmerFieldPolygons.map(({ farmerId, farmerName, field, latlngs }) => (
          <Polygon
            key={`farmer-fld-${farmerId}-${field.id}`}
            positions={latlngs.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{
              color: "#38bdf8",
              fillColor: "#38bdf8",
              fillOpacity: 0.25,
              weight: 2.5,
            }}
            eventHandlers={{
              click: () => {
                setActiveSatelliteTarget({ field, farmerName });
              },
            }}
          >
            <Tooltip permanent direction="center" className="!bg-stone-950/90 !border !border-sky-500/40 !text-white !rounded-full !px-3 !py-1 !text-[10px] !font-bold">
              <span>
                {farmerName} • {field.name} ({field.size} daa) — Uydu Analizi
              </span>
            </Tooltip>
          </Polygon>
        ))}

        {/* Kalıcı Kayıtlı Harita Parselleri */}
        {savedFeatures.map((f) => (
          <SavedFeatureRenderer
            key={f.id}
            feature={f}
            onRemove={handleRemoveFeature}
            onEdit={handleEditFeature}
            onOpenSatellite={handleOpenSatelliteFromSaved}
          />
        ))}

        {/* TKGM Sorgusundan Dönen Resmi Parsel Sınırı Önizlemesi */}
        {tkgmResult?.geometry && (() => {
          const pts = geoJsonToLatLngs(tkgmResult.geometry);
          if (pts.length < 3) return null;
          return (
            <Polygon
              positions={pts.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color: "#f59e0b",
                fillColor: "#f59e0b",
                fillOpacity: 0.3,
                weight: 3,
              }}
            />
          );
        })()}

        {/* Faz 4 #6: Köy Bazlı Salgın & Zararlı Isı Haritası */}
        {outbreakClusters.map((cluster, idx) => (
          <CircleMarker
            key={`outbreak-${idx}`}
            center={[cluster.lat, cluster.lng]}
            radius={Math.min(36, 14 + cluster.count * 5)}
            pathOptions={{
              color: cluster.count >= 3 ? "#ef4444" : "#f59e0b",
              fillColor: cluster.count >= 3 ? "#ef4444" : "#f59e0b",
              fillOpacity: 0.4,
              weight: 2,
            }}
          >
            <Tooltip direction="top" permanent={cluster.count >= 2}>
              <div className="text-[10px] font-bold">
                <strong>{cluster.village}:</strong> {cluster.count} Saha Gözlemi
                {cluster.notes[0] ? ` (${cluster.notes[0]})` : ""}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Aktif Çizim Noktaları */}
        {points.map((p, i) => (
          <Marker
            key={`point-${i}`}
            position={p}
            draggable={true}
            eventHandlers={{
              dragend: (e: any) => {
                const marker = e.target;
                if (marker) {
                  const newPos = marker.getLatLng();
                  setPoints((prev) => {
                    const next = [...prev];
                    next[i] = newPos;
                    return next;
                  });
                }
              },
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -20]} opacity={0.95}>
              <div className="text-[11px] font-bold text-stone-900 bg-white/95 px-2 py-0.5 rounded shadow flex items-center gap-1 border border-stone-300 pointer-events-none select-none">
                <Move size={10} className="text-amber-600" />
                <span>Köşe {i + 1}</span>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {mode === "DISTANCE" && points.length > 1 && (
          <Polyline positions={points} color="#38bdf8" weight={4} />
        )}
        {mode === "AREA" && points.length > 2 && (
          <Polygon
            positions={points}
            pathOptions={{
              color: "#10b981",
              fillColor: "#10b981",
              fillOpacity: 0.28,
              weight: 3,
            }}
          />
        )}
      </MapContainer>

      {/* Çok Katmanlı Uydu Analizi Modalı */}
      <FieldSatelliteAnalyzerModal
        isOpen={!!activeSatelliteTarget}
        field={activeSatelliteTarget?.field || null}
        farmerName={activeSatelliteTarget?.farmerName}
        onClose={() => setActiveSatelliteTarget(null)}
      />
    </div>
  );
};

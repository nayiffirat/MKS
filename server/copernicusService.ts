import bbox from "@turf/bbox";
import area from "@turf/area";

/**
 * Copernicus Data Space Ecosystem (CDSE) Zero-Cost Sentinel-2 L2A Multi-Layer Agronomic Service
 * + TKGM Live Parcel Spatial Lookup Helper
 *
 * Security Invariant:
 * - CDSE_CLIENT_ID and CDSE_CLIENT_SECRET stay strictly in server process.env (.env).
 * - Never expose client secret or raw OAuth tokens to the browser/client bundle.
 */

const CDSE_TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const CDSE_CATALOG_URL =
  "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search";
const CDSE_PROCESS_URL =
  "https://sh.dataspace.copernicus.eu/api/v1/process";

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAtMs = 0;

export function isCopernicusConfigured(): boolean {
  const clientId = (process.env.CDSE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.CDSE_CLIENT_SECRET || "").trim();
  return (
    clientId.length > 8 &&
    clientSecret.length > 8 &&
    !clientId.includes("BURAYA_") &&
    !clientSecret.includes("BURAYA_")
  );
}

export async function getCdseAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && now < cachedTokenExpiresAtMs - 45_000) {
    return cachedAccessToken;
  }

  const clientId = (process.env.CDSE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.CDSE_CLIENT_SECRET || "").trim();

  if (!isCopernicusConfigured()) {
    throw Object.assign(
      new Error(
        "Copernicus API anahtarları (.env -> CDSE_CLIENT_ID / CDSE_CLIENT_SECRET) henüz tanımlanmamış."
      ),
      { code: "CDSE_MISSING_CREDENTIALS", status: 503 }
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(CDSE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    throw Object.assign(
      new Error(`Copernicus OAuth2 kimlik doğrulaması başarısız (HTTP ${resp.status}).`),
      { code: "CDSE_AUTH_FAILED", status: 502 }
    );
  }

  const data: any = await resp.json();
  if (!data?.access_token) {
    throw Object.assign(new Error("Copernicus token yanıtı geçersiz."), {
      code: "CDSE_INVALID_TOKEN",
      status: 502,
    });
  }

  const expiresInSec = Number(data.expires_in) || 600;
  cachedAccessToken = String(data.access_token);
  cachedTokenExpiresAtMs = now + expiresInSec * 1000;
  return cachedAccessToken;
}

/**
 * Evalscript V3 - Layer A: Bitki Gelişimi (NDVI = (B08 - B04) / (B08 + B04))
 * - Outside polygon: transparent (dataMask = 0)
 * - Cloud shadow (SCL 3) & Clouds (SCL 8, 9, 10): semi-transparent grey [0.55, 0.58, 0.62, 0.55]
 * - NDVI < 0.20: Red (Bare soil / severe stress)
 * - 0.20 - 0.40: Orange-Yellow (Stunted / sparse growth)
 * - 0.40 - 0.60: Light Green (Moderate growth)
 * - > 0.60: Deep Green (Healthy vigorous canopy)
 */
export const EVALSCRIPT_NDVI_V3 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) {
    return [0, 0, 0, 0];
  }
  const scl = sample.SCL;
  if (scl === 3 || scl === 8 || scl === 9 || scl === 10) {
    return [0.55, 0.58, 0.62, 0.55];
  }
  const denom = sample.B08 + sample.B04;
  const ndvi = denom === 0 ? 0 : (sample.B08 - sample.B04) / denom;

  if (ndvi < 0.20) {
    return [0.86, 0.18, 0.18, 0.88]; // Kırmızı: Çıplak toprak / Şiddetli stres
  } else if (ndvi < 0.40) {
    return [0.95, 0.68, 0.12, 0.88]; // Turuncu-Sarı: Gelişim geriliği
  } else if (ndvi < 0.60) {
    return [0.38, 0.82, 0.28, 0.88]; // Açık Yeşil: Orta gelişim
  } else {
    return [0.06, 0.52, 0.22, 0.92]; // Koyu Yeşil: Sağlıklı ve gür bitki örtüsü
  }
}`;

/**
 * Evalscript V3 - Layer B: Sulama Durumu (NDMI = (B8A - B11) / (B8A + B11))
 * - Outside polygon: transparent (dataMask = 0)
 * - Cloud shadow (SCL 3) & Clouds (SCL 8, 9, 10): semi-transparent grey
 * - NDMI < -0.10: Red-Orange (Dry / severe water stress)
 * - -0.10 - 0.10: Yellow (Moisture dropping / irrigation approaching)
 * - 0.10 - 0.30: Sky Blue (Balanced moisture / freshly irrigated)
 * - > 0.30: Deep Blue (High water saturation)
 */
export const EVALSCRIPT_NDMI_V3 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B8A", "B11", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) {
    return [0, 0, 0, 0];
  }
  const scl = sample.SCL;
  if (scl === 3 || scl === 8 || scl === 9 || scl === 10) {
    return [0.55, 0.58, 0.62, 0.55];
  }
  const denom = sample.B8A + sample.B11;
  const ndmi = denom === 0 ? 0 : (sample.B8A - sample.B11) / denom;

  if (ndmi < -0.10) {
    return [0.91, 0.28, 0.12, 0.88]; // Kırmızı-Turuncu: Kuru / Ciddi su stresi
  } else if (ndmi < 0.10) {
    return [0.96, 0.78, 0.15, 0.88]; // Sarı: Nem azalıyor / Sulama zamanı yaklaşıyor
  } else if (ndmi < 0.30) {
    return [0.22, 0.72, 0.96, 0.88]; // Açık Mavi: Dengeli nem / Yeni sulanmış
  } else {
    return [0.09, 0.32, 0.82, 0.92]; // Koyu Mavi: Yüksek su doygunluğu
  }
}`;

/**
 * Evalscript V3 - Layer C: Çamur, Tav ve Göllenme - Yüzey Islaklığı
 * Uses B03, B8A, B11, B12 (SWIR soil moisture) + SCL:
 * - Outside polygon: transparent (dataMask = 0)
 * - Cloud shadow (3) & Clouds (8, 9, 10): semi-transparent grey (prevents cloud shadow being mistaken for mud/water!)
 * - Ponding / Standing water: ((B03 - B11)/(B03 + B11) > 0.10 || SCL == 6) -> Indigo/Purple
 * - Mud risk / Over-wet surface: ((B8A - B12)/(B8A + B12) > 0.28 && B12 < 0.13) -> Deep Cyan/Blue ("Traktör Batabilir")
 * - Field capacity / Moist ("Tavında"): ((B8A - B12)/(B8A + B12) between 0.10 and 0.28) -> Turquoise-Green
 * - Dry soil: (B12 >= 0.24 && low moisture index) or remaining dry surface -> Earth Amber/Brown
 */
export const EVALSCRIPT_WETNESS_V3 = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B8A", "B11", "B12", "SCL", "dataMask"] }],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) {
    return [0, 0, 0, 0];
  }
  const scl = sample.SCL;
  if (scl === 3 || scl === 8 || scl === 9 || scl === 10) {
    return [0.55, 0.58, 0.62, 0.55];
  }

  const mndwiDenom = sample.B03 + sample.B11;
  const mndwi = mndwiDenom === 0 ? -1 : (sample.B03 - sample.B11) / mndwiDenom;

  const swirDenom = sample.B8A + sample.B12;
  const swirMoisture = swirDenom === 0 ? -1 : (sample.B8A - sample.B12) / swirDenom;

  // 1. Göllenme / Su Birikintisi
  if (mndwi > 0.10 || scl === 6) {
    return [0.42, 0.16, 0.85, 0.92]; // Mor / Lacivert: Su Birikintisi / Göllenme
  }

  // 2. Çamur Riski / Aşırı Islak Yüzey (Traktör Batabilir)
  if (swirMoisture > 0.28 && sample.B12 < 0.13) {
    return [0.02, 0.52, 0.78, 0.90]; // Koyu Mavi / Camgöbeği: Islak / Çamur Riski
  }

  // 3. Tavında / Nemli Toprak
  if (swirMoisture >= 0.10 && swirMoisture <= 0.28) {
    return [0.08, 0.72, 0.58, 0.88]; // Turkuaz-Yeşil: Tavında / Nemli
  }

  // 4. Kuru Toprak (B12 >= 0.24 ve düşük nem indeksi veya kalan kuru yüzey)
  if (sample.B12 >= 0.24 && swirMoisture < 0.10) {
    return [0.76, 0.48, 0.18, 0.88]; // Toprak Kahverengisi / Kehribar: Kuru Toprak
  }

  return [0.82, 0.58, 0.26, 0.85]; // Hafif Kuru Yüzey
}`;

export interface SatellitePassMetadata {
  sceneId: string;
  captureDatetime: string; // Real satellite overpass ISO timestamp
  cloudCover: number;
  usedFallbackCloudThreshold: boolean;
}

/**
 * Step 1: Query CDSE STAC Catalog API for the newest low-cloud Sentinel-2 L2A pass intersecting the field polygon.
 */
export async function findLatestSentinel2Pass(
  geometry: { type: "Polygon"; coordinates: number[][][] },
  token: string,
  lookbackDays = 30
): Promise<SatellitePassMetadata> {
  const now = new Date();
  const from = new Date(now.getTime() - lookbackDays * 86_400_000);
  const datetimeInterval = `${from.toISOString()}/${now.toISOString()}`;

  const searchCatalog = async (maxCloud: number) => {
    const payload = {
      collections: ["sentinel-2-l2a"],
      datetime: datetimeInterval,
      intersects: geometry,
      limit: 20,
      filter: {
        op: "<=",
        args: [{ property: "eo:cloud_cover" }, maxCloud],
      },
      "filter-lang": "cql2-json",
    };

    const res = await fetch(CDSE_CATALOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // Fallback without CQL2 filter in case catalog endpoint rejects filter extension, filtering client-side
      const plainRes = await fetch(CDSE_CATALOG_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          collections: ["sentinel-2-l2a"],
          datetime: datetimeInterval,
          intersects: geometry,
          limit: 30,
        }),
      });
      if (!plainRes.ok) {
        throw Object.assign(
          new Error(`Uydu kataloğu sorgulanamadı (HTTP ${plainRes.status}).`),
          { code: "CDSE_CATALOG_ERROR", status: 502 }
        );
      }
      const plainData: any = await plainRes.json();
      const features: any[] = Array.isArray(plainData?.features) ? plainData.features : [];
      return features.filter(
        (f) => Number(f?.properties?.["eo:cloud_cover"] ?? 100) <= maxCloud
      );
    }

    const data: any = await res.json();
    const features: any[] = Array.isArray(data?.features) ? data.features : [];
    return features.filter(
      (f) => Number(f?.properties?.["eo:cloud_cover"] ?? 100) <= maxCloud
    );
  };

  // Primary rule: last 30 days with eo:cloud_cover <= 20%
  let candidates = await searchCatalog(20);
  let usedFallbackCloudThreshold = false;

  // Graceful winter/cloudy-week fallback up to 45 days & <= 45% cloud if zero scenes exist under 20%
  if (candidates.length === 0) {
    usedFallbackCloudThreshold = true;
    candidates = await searchCatalog(45);
  }

  if (candidates.length === 0) {
    throw Object.assign(
      new Error(
        "Son 30 gün içinde bu parsel üzerinde bulutsuz/uygun Sentinel-2 uydu geçişi bulunamadı."
      ),
      { code: "NO_CLEAR_SATELLITE_PASS", status: 404 }
    );
  }

  // Sort strictly descending by real capture datetime
  candidates.sort((a, b) => {
    const ta = new Date(a?.properties?.datetime || 0).getTime();
    const tb = new Date(b?.properties?.datetime || 0).getTime();
    return tb - ta;
  });

  const best = candidates[0];
  return {
    sceneId: String(best.id || "sentinel-2-l2a"),
    captureDatetime: String(best.properties?.datetime || new Date().toISOString()),
    cloudCover: Math.round(Number(best.properties?.["eo:cloud_cover"] ?? 0) * 10) / 10,
    usedFallbackCloudThreshold,
  };
}

/**
 * Step 2: Render a single RGBA PNG layer via Sentinel Hub Process API locked tightly to the exact STAC capture pass.
 */
async function renderProcessLayerBase64(
  geometry: { type: "Polygon"; coordinates: number[][][] },
  captureDatetime: string,
  maxCloudCoverage: number,
  evalscript: string,
  width: number,
  height: number,
  token: string
): Promise<string> {
  const parsedCaptureMs = new Date(captureDatetime).getTime();
  let fromIso: string;
  let toIso: string;
  if (Number.isFinite(parsedCaptureMs)) {
    // Lock tightly (±30 minutes) around the exact STAC satellite overpass timestamp
    fromIso = new Date(parsedCaptureMs - 30 * 60_000).toISOString();
    toIso = new Date(parsedCaptureMs + 30 * 60_000).toISOString();
  } else {
    const captureDay = captureDatetime.slice(0, 10);
    fromIso = `${captureDay}T00:00:00Z`;
    toIso = `${captureDay}T23:59:59Z`;
  }

  const body = {
    input: {
      bounds: {
        geometry,
        properties: {
          crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
        },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            timeRange: {
              from: fromIso,
              to: toIso,
            },
            maxCloudCoverage: Math.min(100, Math.max(20, Math.ceil(maxCloudCoverage + 5))),
            mosaickingOrder: "leastCC",
          },
        },
      ],
    },
    output: {
      width,
      height,
      responses: [
        {
          identifier: "default",
          format: {
            type: "image/png",
          },
        },
      ],
    },
    evalscript,
  };

  const resp = await fetch(CDSE_PROCESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "image/png",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw Object.assign(
      new Error(`Sentinel Process API görüntü üretemedi (HTTP ${resp.status}).`),
      { code: "CDSE_PROCESS_ERROR", status: 502 }
    );
  }

  const arrayBuffer = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

export interface MultiLayerSatelliteResponse {
  captureDatetime: string;
  cloudCover: number;
  sceneId: string;
  usedFallbackCloudThreshold: boolean;
  bbox: [number, number, number, number];
  dekar: number;
  layers: {
    ndviPngDataUrl: string;
    ndmiPngDataUrl: string;
    wetnessPngDataUrl: string;
  };
}

/**
 * Full orchestrator: validates polygon, resolves latest real capture timestamp, and renders all 3 RGBA PNG layers in parallel.
 */
export async function analyzeFieldPolygonSatellite(
  rawGeoJson: any
): Promise<MultiLayerSatelliteResponse> {
  const geom = rawGeoJson?.type === "Feature" ? rawGeoJson.geometry : rawGeoJson;
  if (
    !geom ||
    geom.type !== "Polygon" ||
    !Array.isArray(geom.coordinates) ||
    !Array.isArray(geom.coordinates[0]) ||
    geom.coordinates[0].length < 4
  ) {
    throw Object.assign(
      new Error("Geçerli bir WGS84 (EPSG:4326) tarla poligonu gönderilmelidir (en az 3 köşe)."),
      { code: "INVALID_POLYGON", status: 400 }
    );
  }

  const feature = { type: "Feature" as const, properties: {}, geometry: geom };
  const areaM2 = area(feature as any);
  if (areaM2 < 100) {
    throw Object.assign(
      new Error("Çizilen poligon çok küçük (en az 0.1 dekar olmalıdır)."),
      { code: "POLYGON_TOO_SMALL", status: 400 }
    );
  }
  if (areaM2 > 50_000_000) {
    throw Object.assign(
      new Error("Tek seferde en fazla 50.000 dekar büyüklüğünde parsel analiz edilebilir."),
      { code: "POLYGON_TOO_LARGE", status: 400 }
    );
  }

  const rawBbox = bbox(feature as any);
  const typedBbox: [number, number, number, number] = [
    Number(rawBbox[0].toFixed(7)),
    Number(rawBbox[1].toFixed(7)),
    Number(rawBbox[2].toFixed(7)),
    Number(rawBbox[3].toFixed(7)),
  ];
  const dekar = Math.round((areaM2 / 1000) * 100) / 100;

  // Compute crisp aspect-aware pixel dimensions (between 256px and 768px) so field pixels stay sharp
  const lonSpan = Math.max(0.0002, typedBbox[2] - typedBbox[0]);
  const latSpan = Math.max(0.0002, typedBbox[3] - typedBbox[1]);
  const midLatRad = (((typedBbox[1] + typedBbox[3]) / 2) * Math.PI) / 180;
  const metricRatio = (lonSpan * Math.cos(midLatRad)) / latSpan;

  let width = 512;
  let height = 512;
  if (metricRatio >= 1) {
    width = 640;
    height = Math.max(256, Math.min(640, Math.round(640 / metricRatio)));
  } else {
    height = 640;
    width = Math.max(256, Math.min(640, Math.round(640 * metricRatio)));
  }

  const token = await getCdseAccessToken(false);
  const pass = await findLatestSentinel2Pass(geom, token, 30);

  const [ndviPngDataUrl, ndmiPngDataUrl, wetnessPngDataUrl] = await Promise.all([
    renderProcessLayerBase64(geom, pass.captureDatetime, pass.cloudCover, EVALSCRIPT_NDVI_V3, width, height, token),
    renderProcessLayerBase64(geom, pass.captureDatetime, pass.cloudCover, EVALSCRIPT_NDMI_V3, width, height, token),
    renderProcessLayerBase64(geom, pass.captureDatetime, pass.cloudCover, EVALSCRIPT_WETNESS_V3, width, height, token),
  ]);

  return {
    captureDatetime: pass.captureDatetime,
    cloudCover: pass.cloudCover,
    sceneId: pass.sceneId,
    usedFallbackCloudThreshold: pass.usedFallbackCloudThreshold,
    bbox: typedBbox,
    dekar,
    layers: {
      ndviPngDataUrl,
      ndmiPngDataUrl,
      wetnessPngDataUrl,
    },
  };
}

/**
 * In-App TKGM Parcel Lookup by Coordinate (with official CBS API + WMS GetFeatureInfo + Nominatim administrative enrichment)
 * so engineers see parcel details directly inside MKS without being forced out to parselsorgu.tkgm.gov.tr.
 */
export async function lookupTkgmParcelByCoord(lat: number, lng: number): Promise<any> {
  const cleanLat = Number(lat.toFixed(6));
  const cleanLng = Number(lng.toFixed(6));

  // 1. Try official TKGM MEGSIS CBS REST v3.1 / v3 endpoints
  const tkgmEndpoints = [
    `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api/parsel/${cleanLat}/${cleanLng}/`,
    `https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api/parsel/${cleanLat}/${cleanLng}/`,
  ];

  for (const url of tkgmEndpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MKS-MuhendisKayitSistemi/4.0",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data: any = await res.json();
        const props = data?.properties || data;
        if (props && (props.parselNo || props.ParselNo || props.adaNo || props.ilAd)) {
          let alanM2 = Number(
            String(props.alan || props.Alan || "0")
              .replace(/\./g, "")
              .replace(",", ".")
          );
          if ((!alanM2 || isNaN(alanM2)) && data?.geometry) {
            try {
              alanM2 = area({ type: "Feature", properties: {}, geometry: data.geometry } as any);
            } catch {
              alanM2 = 0;
            }
          }
          return {
            source: "TKGM_CBS",
            il: props.ilAd || props.Il || "",
            ilce: props.ilceAd || props.Ilce || "",
            mahalle: props.mahalleAd || props.Mahalle || "",
            ada: String(props.adaNo ?? props.Ada ?? "0"),
            parsel: String(props.parselNo ?? props.ParselNo ?? ""),
            alanM2: Math.round(alanM2 * 100) / 100,
            alanDekar: Math.round((alanM2 / 1000) * 100) / 100,
            nitelik: props.nitelik || props.Nitelik || "Tarla / Arazi",
            mevkii: props.mevkii || props.Mevkii || "",
            pafta: props.pafta || props.Pafta || "",
            ozet: props.ozet || "",
            lat: cleanLat,
            lng: cleanLng,
            geometry: data?.geometry || null,
          };
        }
      }
    } catch {
      // Proceed to WMS GetFeatureInfo / administrative lookup
    }
  }

  // 2. Try TKGM WMS GetFeatureInfo (JSON / GML / HTML properties)
  try {
    const delta = 0.0005;
    const bboxStr = `${cleanLng - delta},${cleanLat - delta},${cleanLng + delta},${cleanLat + delta}`;
    const wmsUrl =
      `https://megsiswms.tkgm.gov.tr/tkgm.mahalli/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
      `&LAYERS=TKGM.MAHALLI.PARSEL&QUERY_LAYERS=TKGM.MAHALLI.PARSEL&SRS=EPSG:4326` +
      `&BBOX=${bboxStr}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=application/json`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    const wmsRes = await fetch(wmsUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (wmsRes.ok) {
      const wmsJson: any = await wmsRes.json().catch(() => null);
      const feat = wmsJson?.features?.[0];
      if (feat?.properties) {
        const p = feat.properties;
        let alanM2 = Number(
          String(p.ALAN || p.alan || "0")
            .replace(/\./g, "")
            .replace(",", ".")
        );
        if ((!alanM2 || isNaN(alanM2)) && feat.geometry) {
          try {
            alanM2 = area(feat as any);
          } catch {
            alanM2 = 0;
          }
        }
        return {
          source: "TKGM_WMS",
          il: p.ILAD || p.ilAd || "",
          ilce: p.ILCEAD || p.ilceAd || "",
          mahalle: p.MAHALLEAD || p.mahalleAd || "",
          ada: String(p.ADANO ?? p.adaNo ?? "-"),
          parsel: String(p.PARSELNO ?? p.parselNo ?? "-"),
          alanM2: Math.round(alanM2 * 100) / 100,
          alanDekar: Math.round((alanM2 / 1000) * 100) / 100,
          nitelik: p.NITELIK || p.nitelik || "Tarım Arazisi",
          mevkii: p.MEVKII || p.mevkii || "",
          pafta: p.PAFTA || p.pafta || "",
          lat: cleanLat,
          lng: cleanLng,
          geometry: feat.geometry || null,
        };
      }
    }
  } catch {
    // Proceed to Nominatim administrative reverse geocoding
  }

  // 3. Always return rich in-app administrative location details so the user never leaves MKS empty-handed
  let il = "";
  let ilce = "";
  let mahalle = "";
  let displayName = "";
  try {
    const nomController = new AbortController();
    const nomTimer = setTimeout(() => nomController.abort(), 8000);
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${cleanLat}&lon=${cleanLng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "MKS-MuhendisKayitSistemi/4.0",
          "Accept-Language": "tr",
        },
        signal: nomController.signal,
      }
    );
    clearTimeout(nomTimer);
    if (nomRes.ok) {
      const nom: any = await nomRes.json();
      const addr = nom?.address || {};
      il = addr.province || addr.state || "";
      ilce = addr.town || addr.county || addr.city_district || addr.municipality || "";
      mahalle = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet || "";
      displayName = nom?.display_name || "";
    }
  } catch {
    // ignore
  }

  return {
    source: "KONUM_IDARI",
    il,
    ilce,
    mahalle,
    ada: "",
    parsel: "",
    alanM2: 0,
    alanDekar: 0,
    nitelik: "Tarım Alanı (İdari Konum Doğrulandı)",
    mevkii: displayName,
    pafta: "",
    lat: cleanLat,
    lng: cleanLng,
    geometry: null,
    note: "TKGM anlık servis hız sınırında olduğu için idari mahalle/köy bilgisi getirildi. 'Parselleri Çiz' katmanını açarak parsel sınırlarını harita üstünde görebilir ve tek tıkla çizebilirsiniz.",
  };
}

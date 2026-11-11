import area from '@turf/area';
import bbox from '@turf/bbox';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface FieldPolygonFeature {
  type: 'Feature';
  properties?: Record<string, any>;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][]; // [[[lng, lat], ...]] RFC 7946 EPSG:4326
  };
}

/**
 * Converts an array of Leaflet/UI {lat, lng} vertices into a closed RFC 7946 WGS84 (EPSG:4326) GeoJSON Polygon Feature.
 */
export function latLngsToGeoJsonPolygon(points: LatLngLiteral[], properties: Record<string, any> = {}): FieldPolygonFeature | null {
  if (!Array.isArray(points) || points.length < 3) return null;

  const ring: number[][] = points.map((p) => [
    Number(Number(p.lng).toFixed(7)),
    Number(Number(p.lat).toFixed(7)),
  ]);

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  if (ring.length < 4) return null;

  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}

/**
 * Extracts open {lat, lng} vertices from a GeoJSON Feature, Polygon, or MultiPolygon.
 */
export function geoJsonToLatLngs(geoJsonInput: string | Record<string, any> | undefined | null): LatLngLiteral[] {
  if (!geoJsonInput) return [];
  try {
    const parsed = typeof geoJsonInput === 'string' ? JSON.parse(geoJsonInput) : geoJsonInput;
    const geom = parsed?.type === 'Feature' ? parsed.geometry : parsed;
    if (!geom) return [];

    let ring: number[][] = [];
    if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
      ring = geom.coordinates[0];
    } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates?.[0]?.[0])) {
      ring = geom.coordinates[0][0];
    }

    if (ring.length < 3) return [];

    // Drop duplicate closing coordinate for interactive vertex editing
    const first = ring[0];
    const last = ring[ring.length - 1];
    const openRing =
      ring.length > 3 && first[0] === last[0] && first[1] === last[1]
        ? ring.slice(0, -1)
        : ring;

    return openRing
      .filter((coord) => Array.isArray(coord) && coord.length >= 2)
      .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
      .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));
  } catch {
    return [];
  }
}

/**
 * Calculates accurate geodesic area in m² and Dekar (1000 m² = 1 daa) + [west, south, east, north] bbox using @turf/area & @turf/bbox.
 */
export function computePolygonMetrics(pointsOrGeoJson: LatLngLiteral[] | FieldPolygonFeature): {
  areaM2: number;
  dekar: number;
  bbox: [number, number, number, number];
  centroid: LatLngLiteral;
  feature: FieldPolygonFeature | null;
} {
  const feature = Array.isArray(pointsOrGeoJson)
    ? latLngsToGeoJsonPolygon(pointsOrGeoJson)
    : pointsOrGeoJson;

  if (!feature) {
    return {
      areaM2: 0,
      dekar: 0,
      bbox: [0, 0, 0, 0],
      centroid: { lat: 39.0, lng: 35.0 },
      feature: null,
    };
  }

  const areaM2 = Math.max(0, area(feature as any));
  const dekar = Math.round((areaM2 / 1000) * 100) / 100;
  const rawBbox = bbox(feature as any);
  const typedBbox: [number, number, number, number] = [
    Number(rawBbox[0].toFixed(7)),
    Number(rawBbox[1].toFixed(7)),
    Number(rawBbox[2].toFixed(7)),
    Number(rawBbox[3].toFixed(7)),
  ];

  const centroid: LatLngLiteral = {
    lat: Number(((typedBbox[1] + typedBbox[3]) / 2).toFixed(6)),
    lng: Number(((typedBbox[0] + typedBbox[2]) / 2).toFixed(6)),
  };

  return { areaM2, dekar, bbox: typedBbox, centroid, feature };
}

/**
 * Deterministic lightweight hash of polygon coordinates so cache invalidates automatically when boundary vertices move.
 */
export function computePolygonHash(featureOrJson: string | FieldPolygonFeature | null | undefined): string {
  if (!featureOrJson) return 'empty';
  const raw =
    typeof featureOrJson === 'string'
      ? featureOrJson
      : JSON.stringify(featureOrJson.geometry?.coordinates || []);
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

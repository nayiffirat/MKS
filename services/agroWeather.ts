/**
 * AgroWeatherService — parsel bazlı zirai hava verisi.
 * - Open-Meteo (anahtarsız): anlık + 48 saat + 10 gün + toprak + ET0 + 15 dk'lık yağış
 * - RainViewer (anahtarsız): son 2 saatin gerçek radar kareleri
 * - Stale-while-revalidate önbellek: ekran son veriyle anında açılır, arka planda yenilenir
 * Sağlayıcı değiştirmek için: AgroWeatherService.setProvider(new BaskaSaglayici())
 */
import { calculateDeltaT, evaluateSprayingConditions, isWetWeatherCode, SpraySuitabilityLevel } from './weather';

export interface GeoPoint { lat: number; lon: number }

export interface AgroHour {
  t: number; // unix saniye (UTC)
  temp: number; feels: number; code: number; isDay: boolean;
  cloud: number; cloudLow: number; cloudMid: number; cloudHigh: number;
  precip: number; precipProb: number; rain: number; showers: number; snow: number;
  rh: number; dew: number; pressure: number; visibility: number; uv: number;
  wind: number; wind80: number; windDir: number; gust: number; steerDir: number;
  et0: number; soilT0: number; soilT6: number; soilT18: number; soilM01: number; soilM39: number;
}
export interface AgroDay {
  t: number; code: number; tMax: number; tMin: number; precipSum: number; precipProb: number;
  sunrise: number; sunset: number; uvMax: number; et0: number; windMax: number; gustMax: number;
}
export interface AgroWeather {
  provider: string;
  fetchedAt: number; // ms
  lat: number; lon: number;
  utcOffset: number; // saniye
  current: {
    t: number; temp: number; feels: number; code: number; isDay: boolean; cloud: number; rh: number;
    precip: number; pressure: number; wind: number; windDir: number; gust: number;
  };
  hours: AgroHour[]; // içinde bulunulan saatten itibaren 48 saat
  days: AgroDay[]; // bugünden itibaren 10 gün
  minutely: Array<{ t: number; mm: number }>; // şimdiden itibaren 15 dk'lık yağış (2 saat)
  histMax: number[]; histMin: number[]; // GDD için: geçmiş 14 gün + tahmin
}

export interface IWeatherProvider {
  id: string;
  fetch(p: GeoPoint, signal?: AbortSignal): Promise<AgroWeather>;
}

const n = (v: any, d = 0) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : d);

// ------------------------------------------------------------------ Open-Meteo
const HOURLY = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'precipitation_probability', 'precipitation', 'rain', 'showers',
  'snowfall', 'weather_code', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'surface_pressure', 'visibility', 'uv_index', 'is_day',
  'wind_speed_10m', 'wind_speed_80m', 'wind_direction_10m', 'wind_gusts_10m', 'wind_direction_700hPa', 'et0_fao_evapotranspiration',
  'soil_temperature_0cm', 'soil_temperature_6cm', 'soil_temperature_18cm', 'soil_moisture_0_to_1cm', 'soil_moisture_3_to_9cm'
];
const DAILY = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'precipitation_probability_max', 'sunrise', 'sunset', 'uv_index_max',
  'et0_fao_evapotranspiration', 'wind_speed_10m_max', 'wind_gusts_10m_max'
];
const CURRENT = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day', 'precipitation', 'weather_code', 'cloud_cover', 'surface_pressure',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'
];

export class OpenMeteoProvider implements IWeatherProvider {
  id = 'open-meteo';
  async fetch(p: GeoPoint, signal?: AbortSignal): Promise<AgroWeather> {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}` +
      `&current=${CURRENT.join(',')}&hourly=${HOURLY.join(',')}&daily=${DAILY.join(',')}&minutely_15=precipitation` +
      `&past_days=14&forecast_days=10&timezone=auto&timeformat=unixtime`;
    const resp = await fetch(url, { signal });
    if (!resp.ok) throw new Error(`Open-Meteo ${resp.status}`);
    const r = await resp.json();
    const h = r.hourly || {}, d = r.daily || {}, c = r.current || {}, m = r.minutely_15 || {};
    const nowS = Math.floor(Date.now() / 1000);

    const hStart = Math.max(0, (h.time || []).findIndex((t: number) => t + 3600 > nowS));
    const hours: AgroHour[] = (h.time || []).slice(hStart, hStart + 48).map((t: number, k: number) => {
      const i = hStart + k;
      return {
        t, temp: n(h.temperature_2m?.[i]), feels: n(h.apparent_temperature?.[i]), code: n(h.weather_code?.[i]), isDay: n(h.is_day?.[i], 1) === 1,
        cloud: n(h.cloud_cover?.[i]), cloudLow: n(h.cloud_cover_low?.[i]), cloudMid: n(h.cloud_cover_mid?.[i]), cloudHigh: n(h.cloud_cover_high?.[i]),
        precip: n(h.precipitation?.[i]), precipProb: n(h.precipitation_probability?.[i]), rain: n(h.rain?.[i]), showers: n(h.showers?.[i]), snow: n(h.snowfall?.[i]),
        rh: n(h.relative_humidity_2m?.[i], 50), dew: n(h.dew_point_2m?.[i]), pressure: n(h.surface_pressure?.[i], 1013), visibility: n(h.visibility?.[i], 10000), uv: n(h.uv_index?.[i]),
        wind: n(h.wind_speed_10m?.[i]), wind80: n(h.wind_speed_80m?.[i]), windDir: n(h.wind_direction_10m?.[i]), gust: n(h.wind_gusts_10m?.[i]),
        steerDir: n(h.wind_direction_700hPa?.[i], n(h.wind_direction_10m?.[i])), et0: n(h.et0_fao_evapotranspiration?.[i]),
        soilT0: n(h.soil_temperature_0cm?.[i], NaN), soilT6: n(h.soil_temperature_6cm?.[i], NaN), soilT18: n(h.soil_temperature_18cm?.[i], NaN),
        soilM01: n(h.soil_moisture_0_to_1cm?.[i], NaN), soilM39: n(h.soil_moisture_3_to_9cm?.[i], NaN)
      };
    });

    const dStart = Math.max(0, (d.time || []).findIndex((t: number) => t + 86400 > nowS));
    const days: AgroDay[] = (d.time || []).slice(dStart, dStart + 10).map((t: number, k: number) => {
      const i = dStart + k;
      return {
        t, code: n(d.weather_code?.[i]), tMax: n(d.temperature_2m_max?.[i]), tMin: n(d.temperature_2m_min?.[i]), precipSum: n(d.precipitation_sum?.[i]),
        precipProb: n(d.precipitation_probability_max?.[i]), sunrise: n(d.sunrise?.[i]), sunset: n(d.sunset?.[i]), uvMax: n(d.uv_index_max?.[i]),
        et0: n(d.et0_fao_evapotranspiration?.[i]), windMax: n(d.wind_speed_10m_max?.[i]), gustMax: n(d.wind_gusts_10m_max?.[i])
      };
    });

    const mStart = Math.max(0, (m.time || []).findIndex((t: number) => t + 900 > nowS));
    const minutely = (m.time || []).slice(mStart, mStart + 8).map((t: number, k: number) => ({ t, mm: n(m.precipitation?.[mStart + k]) }));

    return {
      provider: this.id, fetchedAt: Date.now(), lat: p.lat, lon: p.lon, utcOffset: n(r.utc_offset_seconds, 10800),
      current: {
        t: n(c.time, nowS), temp: n(c.temperature_2m, hours[0]?.temp), feels: n(c.apparent_temperature, hours[0]?.feels), code: n(c.weather_code, hours[0]?.code),
        isDay: n(c.is_day, 1) === 1, cloud: n(c.cloud_cover, hours[0]?.cloud), rh: n(c.relative_humidity_2m, hours[0]?.rh), precip: n(c.precipitation),
        pressure: n(c.surface_pressure, hours[0]?.pressure), wind: n(c.wind_speed_10m, hours[0]?.wind), windDir: n(c.wind_direction_10m, hours[0]?.windDir), gust: n(c.wind_gusts_10m, hours[0]?.gust)
      },
      hours, days, minutely,
      histMax: (d.temperature_2m_max || []).slice(0, dStart + 7).map((v: any) => n(v)),
      histMin: (d.temperature_2m_min || []).slice(0, dStart + 7).map((v: any) => n(v))
    };
  }
}

// ------------------------------------------------------------------ Önbellek (stale-while-revalidate)
const CACHE_KEY = 'mks_agro_wx_v1';
const CACHE_MAX = 8;
const FRESH_MS = 10 * 60 * 1000;
const keyOf = (p: GeoPoint) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
const readCache = (): Record<string, AgroWeather> => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch { return {}; }
};
const writeCache = (p: GeoPoint, w: AgroWeather) => {
  try {
    const all = readCache();
    all[keyOf(p)] = w;
    const keys = Object.keys(all).sort((a, b) => (all[b].fetchedAt || 0) - (all[a].fetchedAt || 0));
    for (const k of keys.slice(CACHE_MAX)) delete all[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* depolama dolu olabilir: önbelleksiz devam */ }
};

let provider: IWeatherProvider = new OpenMeteoProvider();

export const AgroWeatherService = {
  setProvider(p: IWeatherProvider) { provider = p; },
  getCached(p: GeoPoint): AgroWeather | null { return readCache()[keyOf(p)] || null; },
  /**
   * Önbellekteki veriyi hemen (0 ms) verir, ardından günceli çekip tekrar bildirir.
   * onData(veri, bayat) — bayat=true: önbellekten geldi, arka planda yenileniyor.
   */
  load(p: GeoPoint, onData: (w: AgroWeather, stale: boolean) => void, onError?: (hadCache: boolean) => void, force = false): () => void {
    const ctrl = new AbortController();
    const cached = this.getCached(p);
    const isFresh = !!cached && Date.now() - cached.fetchedAt < FRESH_MS;
    if (cached) onData(cached, !isFresh || force);
    if (!isFresh || force) {
      provider.fetch(p, ctrl.signal)
        .then(w => { writeCache(p, w); onData(w, false); })
        .catch(err => { if (err?.name !== 'AbortError') onError?.(!!cached); });
    }
    return () => ctrl.abort();
  }
};

// ------------------------------------------------------------------ RainViewer radar
export interface RadarFrame { time: number; path: string }
export interface RadarIndex { host: string; frames: RadarFrame[]; fetchedAt: number }
let radarMemo: RadarIndex | null = null;

/** Son 2 saatin radar kareleri (10 dk aralıkla). RainViewer 2026'dan beri tahmin ve uydu karesi vermiyor. */
export async function fetchRadarIndex(force = false): Promise<RadarIndex> {
  if (!force && radarMemo && Date.now() - radarMemo.fetchedAt < 4 * 60 * 1000) return radarMemo;
  const resp = await fetch('https://api.rainviewer.com/public/weather-maps.json');
  if (!resp.ok) throw new Error(`RainViewer ${resp.status}`);
  const r = await resp.json();
  const frames: RadarFrame[] = [...(r?.radar?.past || []), ...(r?.radar?.nowcast || [])].filter((f: any) => f?.path && f?.time).map((f: any) => ({ time: f.time, path: f.path }));
  radarMemo = { host: r?.host || 'https://tilecache.rainviewer.com', frames, fetchedAt: Date.now() };
  return radarMemo;
}
/**
 * Ücretsiz katman: en fazla yakınlık 7, tek renk şeması (2), dakikada 100 istek sınırı.
 * İstek sayısını azaltmak için 512 px karo kullanılır: Leaflet'te tileSize: 512, zoomOffset: -1, maxNativeZoom: RADAR_MAX_NATIVE_ZOOM + 1.
 */
export const radarTileUrl = (idx: RadarIndex, f: RadarFrame) => `${idx.host}${f.path}/512/{z}/{x}/{y}/2/1_1.png`;
export const RADAR_MAX_NATIVE_ZOOM = 7;

// ------------------------------------------------------------------ Zirai analiz
export type SprayLevel = SpraySuitabilityLevel;
export interface SprayVerdict { level: SprayLevel; reason: string; deltaT: number }

export const isWet = isWetWeatherCode;
export const isSnow = (code: number) => (code >= 71 && code <= 77) || code === 85 || code === 86;
export const isThunder = (code: number) => code >= 95;
export const isHail = (code: number) => code === 96 || code === 99;

export function sprayVerdict(h: Pick<AgroHour, 'temp' | 'rh' | 'wind' | 'gust' | 'precipProb' | 'code'>): SprayVerdict {
  return evaluateSprayingConditions({
    tempC: h.temp,
    humidity: h.rh,
    windKmh: h.wind,
    gustKmh: h.gust,
    precipProb: h.precipProb,
    weatherCode: h.code,
  });
}

export interface SprayWindow { start: number; end: number; level: SprayLevel; avgWind: number; maxRainProb: number; avgDeltaT: number }
/** Önümüzdeki 24 saatte en uzun kesintisiz ideal (yoksa dikkatli) ilaçlama penceresi. Yalnızca gündüz saatleri. */
export function bestSprayWindow(hours: AgroHour[]): SprayWindow | null {
  const day = hours.slice(0, 24);
  for (const want of ['IDEAL', 'DIKKAT'] as SprayLevel[]) {
    let best: { s: number; e: number } | null = null, s = -1;
    for (let i = 0; i <= day.length; i++) {
      const ok = i < day.length && day[i].isDay && (sprayVerdict(day[i]).level === want || (want === 'DIKKAT' && sprayVerdict(day[i]).level === 'IDEAL'));
      if (ok && s < 0) s = i;
      if (!ok && s >= 0) { if (!best || i - s > best.e - best.s) best = { s, e: i }; s = -1; }
    }
    if (best) {
      const seg = day.slice(best.s, best.e);
      const avg = (f: (h: AgroHour) => number) => seg.reduce((a, h) => a + f(h), 0) / seg.length;
      return {
        start: seg[0].t, end: seg[seg.length - 1].t + 3600, level: want, avgWind: Math.round(avg(h => h.wind)),
        maxRainProb: Math.round(Math.max(...seg.map(h => h.precipProb))), avgDeltaT: Math.round(avg(h => calculateDeltaT(h.temp, h.rh)) * 10) / 10
      };
    }
  }
  return null;
}

const COMPASS_FROM = ['kuzeyden', 'kuzeydoğudan', 'doğudan', 'güneydoğudan', 'güneyden', 'güneybatıdan', 'batıdan', 'kuzeybatıdan'];
const COMPASS_SHORT = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
export const compassFrom = (deg: number) => COMPASS_FROM[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
export const compassShort = (deg: number) => COMPASS_SHORT[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export interface NextRain { slots: Array<{ t: number; mm: number }>; headline: string; active: boolean; peak: number }
/** 15 dakikalık yağış projeksiyonundan "önümüzdeki saat" özeti. Yön: 700 hPa yönlendirici rüzgar. */
export function nextRain(w: AgroWeather): NextRain {
  const slots = w.minutely.slice(0, 8);
  const TH = 0.05;
  const peak = Math.max(0, ...slots.map(s => s.mm));
  const word = (mm: number) => (isSnow(w.hours[0]?.code ?? 0) ? 'kar yağışı' : mm >= 1.9 ? 'sağanak yağış' : mm >= 0.4 ? 'yağmur' : 'hafif yağmur');
  if (!slots.length) return { slots, headline: 'Dakikalık yağış verisi alınamadı.', active: false, peak };
  const first = slots.findIndex(s => s.mm > TH);
  if (first < 0) return { slots, headline: 'Önümüzdeki 2 saatte parselinizde yağış beklenmiyor.', active: false, peak };
  let end = first;
  while (end < slots.length && slots[end].mm > TH) end++;
  const dur = (end - first) * 15;
  const tail = end >= slots.length ? 'en az ' : 'yaklaşık ';
  if (first === 0) {
    return { slots, active: true, peak, headline: end >= slots.length ? `Parselinizde ${word(peak)} var; en az 2 saat daha sürecek.` : `Parselinizde ${word(peak)} var; yaklaşık ${dur} dakika sonra duracak.` };
  }
  const from = compassFrom(w.hours[0]?.steerDir ?? w.current.windDir);
  return { slots, active: true, peak, headline: `Yaklaşık ${first * 15} dakika içinde parselinize ${from} ${word(peak)} giriyor; ${tail}${dur} dakika sürecek.` };
}

export interface FrostInfo { minTemp: number; at: number; level: 'YOK' | 'IZLE' | 'RISK' | 'DON'; text: string }
export function frostInfo(hours: AgroHour[]): FrostInfo {
  const seg = hours.slice(0, 36);
  if (!seg.length) return { minTemp: 0, at: 0, level: 'YOK', text: '' };
  const min = seg.reduce((a, h) => (h.temp < a.temp ? h : a), seg[0]);
  const level = min.temp <= 0 ? 'DON' : min.temp <= 2 ? 'RISK' : min.temp <= 4 ? 'IZLE' : 'YOK';
  const text = level === 'DON' ? 'Zirai don bekleniyor: koruma önlemi alın.' : level === 'RISK' ? 'Don riski yüksek: hassas ürünleri koruyun.' : level === 'IZLE' ? 'Sınırda: gece sıcaklığını izleyin.' : 'Önümüzdeki 36 saatte don riski yok.';
  return { minTemp: min.temp, at: min.t, level, text };
}

export interface LeafWetness { wetHours: number; risk: 'DUSUK' | 'ORTA' | 'YUKSEK'; text: string }
/** Yaprak ıslaklığı tahmini: nem ≥ %90 ya da sıcaklık–çiy noktası farkı < 2°C olan saatler. */
export function leafWetness(hours: AgroHour[]): LeafWetness {
  const seg = hours.slice(0, 24);
  const wet = seg.filter(h => h.rh >= 90 || h.temp - h.dew < 2 || h.precip > 0.1);
  const warm = wet.filter(h => h.temp >= 10 && h.temp <= 28).length;
  const risk = warm >= 8 ? 'YUKSEK' : warm >= 4 ? 'ORTA' : 'DUSUK';
  const text = risk === 'YUKSEK' ? 'Mantari hastalık riski yüksek: koruyucu uygulama planlayın.' : risk === 'ORTA' ? 'Yaprak ıslaklığı uzuyor: hastalık takibi yapın.' : 'Yaprak ıslaklığı düşük.';
  return { wetHours: wet.length, risk, text };
}

export interface SoilInfo { t0: number; t6: number; t18: number; m01: number; m39: number; sowing: string; sowingOk: boolean; moisture: string }
export function soilInfo(h?: AgroHour): SoilInfo | null {
  if (!h || !Number.isFinite(h.soilT6)) return null;
  const t = h.soilT6;
  const sowing = t >= 15 ? 'Sıcak iklim ekimine uygun (mısır, pamuk)' : t >= 10 ? 'Çimlenmeye uygun' : t >= 5 ? 'Yalnız serin iklim tahılları' : 'Ekim için soğuk';
  const m = Number.isFinite(h.soilM39) ? h.soilM39 : h.soilM01;
  const moisture = !Number.isFinite(m) ? '—' : m >= 0.35 ? 'Çok nemli' : m >= 0.22 ? 'Nemli' : m >= 0.12 ? 'Orta' : 'Kuru';
  return { t0: h.soilT0, t6: h.soilT6, t18: h.soilT18, m01: h.soilM01, m39: h.soilM39, sowing, sowingOk: t >= 10, moisture };
}

export interface WaterBalance { et0Today: number; et7: number; rain7: number; deficit: number; text: string }
export function waterBalance(days: AgroDay[]): WaterBalance {
  const wk = days.slice(0, 7);
  const et7 = wk.reduce((a, d) => a + d.et0, 0), rain7 = wk.reduce((a, d) => a + d.precipSum, 0);
  const deficit = Math.round((et7 - rain7) * 10) / 10;
  const text = deficit > 25 ? 'Sulama ihtiyacı yüksek.' : deficit > 8 ? 'Sulama planlayın.' : deficit > 0 ? 'Hafif su açığı.' : 'Yağış su kaybını karşılıyor.';
  return { et0Today: days[0]?.et0 ?? 0, et7: Math.round(et7 * 10) / 10, rain7: Math.round(rain7 * 10) / 10, deficit, text };
}

export function driftVerdict(wind: number, gust: number): { label: string; level: SprayLevel } {
  if (wind > 15 || gust > 25) return { label: 'Sürüklenme yüksek: uygulama yapmayın', level: 'UYGUNSUZ' };
  if (wind > 10 || gust > 18) return { label: 'Sınırda: iri damla, alçak bum', level: 'DIKKAT' };
  if (wind < 3) return { label: 'Durgun hava: inversiyon riskine dikkat', level: 'DIKKAT' };
  return { label: 'Pülverizatör ve drone için uygun', level: 'IDEAL' };
}

// ------------------------------------------------------------------ Astronomi
/** Güneşin ufuk açısı (derece). */
export function solarElevation(lat: number, lon: number, ms = Date.now()): number {
  const rad = Math.PI / 180;
  const d = ms / 86400000 - 10957.5; // J2000'den gün
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * rad) - ra;
  return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad;
}
/** Ay evresi 0..1 (0 = yeni ay, 0.5 = dolunay). */
export function moonPhase(ms = Date.now()): number {
  const p = ((ms / 86400000 - 10962.76) / 29.530588853) % 1; // 2000-01-06 18:14 UTC yeni ay
  return p < 0 ? p + 1 : p;
}

const WMO_TR: Array<[number, number, string]> = [
  [0, 0, 'Açık'], [1, 1, 'Az bulutlu'], [2, 2, 'Parçalı bulutlu'], [3, 3, 'Kapalı'], [45, 48, 'Sisli'], [51, 55, 'Çisenti'], [56, 57, 'Donan çisenti'],
  [61, 61, 'Hafif yağmur'], [63, 63, 'Yağmurlu'], [65, 65, 'Kuvvetli yağmur'], [66, 67, 'Donan yağmur'], [71, 75, 'Kar yağışlı'], [77, 77, 'Kar taneleri'],
  [80, 81, 'Sağanak'], [82, 82, 'Şiddetli sağanak'], [85, 86, 'Kar sağanağı'], [95, 95, 'Gök gürültülü fırtına'], [96, 99, 'Dolu ve fırtına']
];
export const wmoLabel = (code: number) => (WMO_TR.find(([a, b]) => code >= a && code <= b) || [0, 0, 'Bulutlu'])[2];

/** Parselin yerel saatine göre biçimlendirme (cihaz saat diliminden bağımsız). */
export const localParts = (t: number, utcOffset: number) => {
  const d = new Date((t + utcOffset) * 1000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), dow: d.getUTCDay(), day: d.getUTCDate(), month: d.getUTCMonth() };
};
export const hhmm = (t: number, utcOffset: number) => {
  const p = localParts(t, utcOffset);
  return `${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`;
};

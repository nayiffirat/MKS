import { AgriCity } from '../types';

export interface HourlySprayingSlot {
  timeIso: string;
  hourLabel: string;
  tempC: number;
  humidity: number;
  windKmh: number;
  gustKmh: number;
  deltaT: number;
  rainProb: number;
  suitability: 'IDEAL' | 'DIKKAT' | 'UYGUNSUZ';
  reason: string;
}

export interface GddPestAlert {
  id: string;
  pestName: string;
  crop: string;
  baseTempC: number;
  accumulatedGdd: number;
  thresholdGdd: number;
  riskLevel: 'YUKSEK' | 'ORTA' | 'DUSUK';
  advice: string;
}

export interface WeatherResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m?: number;
    weather_code: number;
    relative_humidity_2m: number;
    time: string;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weather_code: number[];
  };
  hourly?: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    wind_gusts_10m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
}

export interface PostCaptureRainReport {
  totalMm: number;
  rainyHoursCount: number;
  lastRainIso?: string;
  fetchFailed?: boolean;
}

export const AGRI_CITIES: AgriCity[] = [
  { name: 'Şanlıurfa', lat: 37.16, lon: 38.79 },
  { name: 'Adana', lat: 37.00, lon: 35.32 },
  { name: 'Konya', lat: 37.87, lon: 32.48 },
  { name: 'Antalya', lat: 36.88, lon: 30.70 },
  { name: 'İzmir', lat: 38.41, lon: 27.12 },
  { name: 'Diyarbakır', lat: 37.91, lon: 40.23 },
  { name: 'Manisa', lat: 38.61, lon: 27.42 },
  { name: 'Bursa', lat: 40.18, lon: 29.06 }
];

/**
 * Stull (2011) psychrometric wet-bulb temperature formula & Delta-T (T - Tw).
 * Ideal Delta-T for agrochemical spraying: 2.0°C - 8.0°C.
 */
export function calculateDeltaT(tempC: number, rhPercent: number): number {
  const T = Number.isFinite(tempC) ? tempC : 20;
  const RH = Math.min(100, Math.max(5, Number.isFinite(rhPercent) ? rhPercent : 50));
  const tw =
    T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) +
    Math.atan(T + RH) -
    Math.atan(RH - 1.676331) +
    0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) -
    4.686035;
  return Math.max(0, Math.round((T - tw) * 10) / 10);
}

/**
 * Evaluates next 12 hours of spraying suitability based on Delta-T, Wind, Gusts & Rain probability (#1).
 */
export function computeHourlySprayingWindow(weather: WeatherResponse | null): HourlySprayingSlot[] {
  if (!weather?.hourly?.time?.length) return [];
  const nowMs = Date.now() - 30 * 60 * 1000;
  const slots: HourlySprayingSlot[] = [];

  for (let i = 0; i < weather.hourly.time.length && slots.length < 12; i++) {
    const tIso = weather.hourly.time[i];
    const ms = new Date(tIso).getTime();
    if (isNaN(ms) || ms < nowMs) continue;

    const tempC = Number(weather.hourly.temperature_2m?.[i] ?? weather.current.temperature_2m);
    const humidity = Number(weather.hourly.relative_humidity_2m?.[i] ?? weather.current.relative_humidity_2m);
    const windKmh = Number(weather.hourly.wind_speed_10m?.[i] ?? weather.current.wind_speed_10m);
    const gustKmh = Number(weather.hourly.wind_gusts_10m?.[i] ?? windKmh * 1.25);
    const rainProb = Number(weather.hourly.precipitation_probability?.[i] ?? 0);
    const wCode = Number(weather.hourly.weather_code?.[i] ?? 0);
    const deltaT = calculateDeltaT(tempC, humidity);

    let suitability: 'IDEAL' | 'DIKKAT' | 'UYGUNSUZ' = 'IDEAL';
    let reason = 'İdeal Delta-T ve düşük rüzgar';

    const isRaining = rainProb >= 45 || (wCode >= 51 && wCode <= 99);
    if (isRaining) {
      suitability = 'UYGUNSUZ';
      reason = 'Yağış / Yıkanma riski';
    } else if (windKmh > 15 || gustKmh > 22) {
      suitability = 'UYGUNSUZ';
      reason = `Yüksek rüzgar (${Math.round(windKmh)} km/s) sürüklenme riski`;
    } else if (deltaT > 10 || tempC > 33) {
      suitability = 'UYGUNSUZ';
      reason = `Yüksek buharlaşma (ΔT ${deltaT}°C)`;
    } else if (tempC < 5) {
      suitability = 'UYGUNSUZ';
      reason = 'Düşük sıcaklık (<5°C)';
    } else if (windKmh > 10 || deltaT > 8 || deltaT < 2 || rainProb >= 25) {
      suitability = 'DIKKAT';
      reason = windKmh > 10 ? 'Sınırda rüzgar (iri damla meme kullanın)' : `Sınırda ΔT (${deltaT}°C)`;
    }

    const d = new Date(tIso);
    slots.push({
      timeIso: tIso,
      hourLabel: `${String(d.getHours()).padStart(2, '0')}:00`,
      tempC: Math.round(tempC * 10) / 10,
      humidity: Math.round(humidity),
      windKmh: Math.round(windKmh),
      gustKmh: Math.round(gustKmh),
      deltaT,
      rainProb: Math.round(rainProb),
      suitability,
      reason,
    });
  }

  return slots;
}

/**
 * Computes GDD (Growing Degree Days / Etkili Sıcaklık Toplamı) & Pest Emergence Alerts (#2).
 */
export function computeGddPestAlerts(
  dailyMax: number[],
  dailyMin: number[],
  currentHumidity = 50
): GddPestAlert[] {
  const calcGdd = (baseC: number) => {
    let sum = 0;
    const len = Math.min(dailyMax.length, dailyMin.length);
    for (let i = 0; i < len; i++) {
      const tMax = Math.min(35, Number(dailyMax[i]) || 0);
      const tMin = Math.max(baseC, Number(dailyMin[i]) || 0);
      const avg = (tMax + tMin) / 2;
      if (avg > baseC) sum += avg - baseC;
    }
    return Math.round(sum * 10) / 10;
  };

  const gdd10 = calcGdd(10); // 14+7 day rolling window (base 10°C)
  const gdd8 = calcGdd(8);   // 14+7 day rolling window (base 8°C)
  const gdd12 = calcGdd(12); // 14+7 day rolling window (base 12°C)

  const alerts: GddPestAlert[] = [
    {
      id: 'codling_moth',
      pestName: 'Elma İçkurdu & Yaprakbüken',
      crop: 'Meyve (Elma / Armut / Ceviz)',
      baseTempC: 10,
      accumulatedGdd: gdd10,
      thresholdGdd: 110,
      riskLevel: gdd10 >= 110 ? 'YUKSEK' : gdd10 >= 65 ? 'ORTA' : 'DUSUK',
      advice:
        gdd10 >= 110
          ? '21 günlük GDD eşiği aşıldı: Feromon tuzak kontrolü ve larva çıkış ilaçlaması önerilir.'
          : 'Sıcaklık birikimi izleniyor; tuzak kontrollerini sürdürün.',
    },
    {
      id: 'helicoverpa_thrips',
      pestName: 'Yeşil Kurt & Thrips Aktivitesi',
      crop: 'Pamuk / Mısır / Sebze',
      baseTempC: 12,
      accumulatedGdd: gdd12,
      thresholdGdd: 135,
      riskLevel: gdd12 >= 135 ? 'YUKSEK' : gdd12 >= 80 ? 'ORTA' : 'DUSUK',
      advice:
        gdd12 >= 135
          ? 'Yumurta açılım hızı yüksek: Üst sürgün ve çiçek kontrolü yapın.'
          : 'Henüz tepe uçuş eşiğinin altında.',
    },
    {
      id: 'fungal_infection',
      pestName: 'Mildiyö / Kara Leke Enfeksiyon İndeksi',
      crop: 'Bağ / Hububat / Sebze',
      baseTempC: 8,
      accumulatedGdd: gdd8,
      thresholdGdd: 95,
      riskLevel: currentHumidity >= 72 && gdd8 >= 75 ? 'YUKSEK' : currentHumidity >= 58 && gdd8 >= 55 ? 'ORTA' : 'DUSUK',
      advice:
        currentHumidity >= 72 && gdd8 >= 75
          ? `Yüksek nem (%${Math.round(currentHumidity)}) + ılıman sıcaklık: Koruyucu fungisit uygulaması planlayın.`
          : 'Nem ve sıcaklık dengeli; yaprak ıslaklığı takibi yeterli.',
    },
  ];

  return alerts;
}

export const WeatherService = {
  async getForecast(lat: number, lon: number): Promise<WeatherResponse> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&past_days=14&forecast_days=7&timezone=auto`
      );
      if (!response.ok) throw new Error('Weather API Error');
      const raw = await response.json();
      // Keep daily slice starting from today for 7-day forecast UI while preserving full GDD history on raw._fullDaily
      const todayIso = new Date().toISOString().split('T')[0];
      const startIdx = Array.isArray(raw?.daily?.time)
        ? Math.max(0, raw.daily.time.findIndex((t: string) => t >= todayIso))
        : 0;

      const fullDaily = raw.daily;
      const slicedDaily = raw.daily
        ? {
            time: raw.daily.time.slice(startIdx, startIdx + 7),
            temperature_2m_max: raw.daily.temperature_2m_max.slice(startIdx, startIdx + 7),
            temperature_2m_min: raw.daily.temperature_2m_min.slice(startIdx, startIdx + 7),
            precipitation_sum: raw.daily.precipitation_sum.slice(startIdx, startIdx + 7),
            weather_code: raw.daily.weather_code.slice(startIdx, startIdx + 7),
            _fullMax: fullDaily.temperature_2m_max,
            _fullMin: fullDaily.temperature_2m_min,
          }
        : raw.daily;

      return {
        ...raw,
        daily: slicedDaily,
      };
    } catch (error) {
      console.warn('Weather API unreachable, using fallback.', error);
      return {
        current: {
          temperature_2m: 20,
          wind_speed_10m: 8,
          wind_gusts_10m: 12,
          weather_code: 0,
          relative_humidity_2m: 48,
          time: new Date().toISOString()
        },
        daily: {
          time: Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return d.toISOString().split('T')[0];
          }),
          temperature_2m_max: [22, 23, 24, 23, 22, 23, 24],
          temperature_2m_min: [10, 11, 12, 11, 10, 11, 12],
          precipitation_sum: [0, 0, 0, 0, 0, 0, 0],
          weather_code: [0, 1, 2, 1, 0, 0, 0]
        }
      };
    }
  },

  /**
   * Cross-checks actual hourly precipitation AFTER a Sentinel-2 satellite capture timestamp (Section 2.4).
   */
  async getPrecipitationSinceCapture(
    lat: number,
    lon: number,
    captureIso: string
  ): Promise<PostCaptureRainReport> {
    try {
      const captureMs = new Date(captureIso).getTime();
      if (isNaN(captureMs)) return { totalMm: 0, rainyHoursCount: 0 };

      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_days=31&forecast_days=1&hourly=precipitation&timezone=UTC`
      );
      if (!response.ok) return { totalMm: 0, rainyHoursCount: 0, fetchFailed: true };
      const data = await response.json();
      const times: string[] = data?.hourly?.time || [];
      const precip: number[] = data?.hourly?.precipitation || [];

      const nowMs = Date.now();
      let totalMm = 0;
      let rainyHoursCount = 0;
      let lastRainIso: string | undefined;

      for (let i = 0; i < times.length; i++) {
        // Open-Meteo UTC timestamps lack 'Z', append 'Z' if absent
        const iso = times[i].endsWith('Z') ? times[i] : `${times[i]}Z`;
        const tMs = new Date(iso).getTime();
        if (tMs > captureMs && tMs <= nowMs) {
          const val = Number(precip[i]) || 0;
          if (val > 0) {
            totalMm += val;
            if (val >= 0.2) {
              rainyHoursCount += 1;
              lastRainIso = iso;
            }
          }
        }
      }

      return {
        totalMm: Math.round(totalMm * 10) / 10,
        rainyHoursCount,
        lastRainIso,
      };
    } catch {
      return { totalMm: 0, rainyHoursCount: 0, fetchFailed: true };
    }
  },

  async searchLocations(query: string): Promise<AgriCity[]> {
    if (!query || query.length < 3) return [];
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=tr&format=json`
      );
      const data = await response.json();
      if (!data.results) return [];

      return data.results
        .filter((item: any) => item.country_code === 'TR')
        .map((item: any) => ({
          name: item.name,
          lat: item.latitude,
          lon: item.longitude,
          admin1: item.admin1
        }));
    } catch (error) {
      console.error('Geocoding API Error', error);
      return [];
    }
  },

  async reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=tr`
      );
      const data = await response.json();
      return (
        data.address?.town ||
        data.address?.city ||
        data.address?.district ||
        data.address?.province ||
        'Mevcut Konum'
      );
    } catch {
      return 'Mevcut Konum';
    }
  }
};

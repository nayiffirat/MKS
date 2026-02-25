
import { AgriCity } from '../types';

export interface WeatherResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    relative_humidity_2m: number;
    time: string;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
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

export const WeatherService = {
  async getForecast(lat: number, lon: number): Promise<WeatherResponse> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
      );
      if (!response.ok) throw new Error('Weather API Error');
      return await response.json();
    } catch (error) {
      console.warn('Weather API unreachable, using fallback.', error);
      return {
        current: {
          temperature_2m: 22,
          wind_speed_10m: 8,
          weather_code: 0,
          relative_humidity_2m: 50,
          time: new Date().toISOString()
        },
        daily: {
          time: Array.from({length: 7}, (_, i) => {
             const d = new Date();
             d.setDate(d.getDate() + i);
             return d.toISOString().split('T')[0];
          }),
          temperature_2m_max: [24, 25, 26, 25, 24, 25, 26],
          temperature_2m_min: [12, 13, 14, 13, 12, 13, 14],
          precipitation_sum: [0, 0, 0, 0, 0, 0, 0]
        }
      };
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
        console.error("Geocoding API Error", error);
        return [];
    }
  },

  /**
   * Identifies the location name from coordinates
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
      try {
          const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=tr`
          );
          const data = await response.json();
          return data.address.town || data.address.city || data.address.district || data.address.province || "Bilinmeyen Konum";
      } catch (e) {
          return "Mevcut Konum";
      }
  }
};

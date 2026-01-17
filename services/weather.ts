export interface WeatherResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    relative_humidity_2m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
  };
}

export const WeatherService = {
  async getForecast(): Promise<WeatherResponse> {
    // Default location: Şanlıurfa (Example agricultural hub in Turkey)
    const lat = 37.16;
    const lon = 38.79;
    
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,precipitation_sum&timezone=auto`
      );
      if (!response.ok) throw new Error('Weather API Error');
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch weather', error);
      throw error;
    }
  }
};
import { useState, useEffect, useCallback } from 'react';
import { WeatherService, WeatherResponse } from '../services/weather';

export const useWeatherViewModel = () => {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWeather = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await WeatherService.getForecast();
      setWeather(data);
    } catch (err) {
      setError('Hava durumu verisi güncellenemedi.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWeather();
  }, [refreshWeather]);

  const getSprayingAdvice = (windSpeed: number) => {
    if (windSpeed > 20) {
      return { status: 'RISKLI', message: 'Rüzgar çok şiddetli! İlaçlama yapmayınız.', color: 'text-red-600', bg: 'bg-red-50' };
    } else if (windSpeed > 10) {
      return { status: 'DIKKAT', message: 'Rüzgar var. Dikkatli ilaçlama yapınız.', color: 'text-orange-600', bg: 'bg-orange-50' };
    } else {
      return { status: 'UYGUN', message: 'Hava ilaçlama için uygun.', color: 'text-agri-600', bg: 'bg-agri-50' };
    }
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return 'Açık';
    if (code >= 1 && code <= 3) return 'Parçalı Bulutlu';
    if (code >= 45 && code <= 48) return 'Sisli';
    if (code >= 51 && code <= 67) return 'Yağmurlu';
    if (code >= 71) return 'Karlı';
    return 'Bulutlu';
  };

  return {
    weather,
    isLoading,
    error,
    refreshWeather,
    getSprayingAdvice,
    getWeatherDescription
  };
};
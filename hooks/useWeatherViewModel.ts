
import { safeStringify } from '../utils/json';
import { useState, useEffect, useCallback } from 'react';
import { WeatherService, WeatherResponse, AGRI_CITIES } from '../services/weather';
import { AgriCity } from '../types';
import { useAppViewModel } from '../context/AppContext';

export const useWeatherViewModel = () => {
  const { userProfile, updateUserProfile } = useAppViewModel();

  const [selectedCity, setSelectedCity] = useState<AgriCity>(() => {
    // 1. Profilde kayıtlı mı?
    if (userProfile.selectedCity) return userProfile.selectedCity;
    
    // 2. Local'de kayıtlı mı? (Migration için)
    const saved = localStorage.getItem('mks_selected_city');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return AGRI_CITIES[0];
      }
    }
    return AGRI_CITIES[0];
  });

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchResults, setSearchResults] = useState<AgriCity[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const refreshWeather = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await WeatherService.getForecast(selectedCity.lat, selectedCity.lon);
      setWeather(data);
    } catch (err) {
      setError('Hava durumu verisi güncellenemedi.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity]);

  // Profil değiştikçe senkronize ol
  useEffect(() => {
    if (userProfile.selectedCity && userProfile.selectedCity.name !== selectedCity.name) {
        setSelectedCity(userProfile.selectedCity);
    }
  }, [userProfile.selectedCity]);

  useEffect(() => {
    refreshWeather();
  }, [refreshWeather]);

  const searchLocations = async (query: string) => {
      if (query.length < 3) {
          setSearchResults([]);
          return;
      }
      setIsSearching(true);
      const results = await WeatherService.searchLocations(query);
      setSearchResults(results);
      setIsSearching(false);
  };

  const changeCity = (city: AgriCity) => {
    setSelectedCity(city);
    // Profile kaydet (Firebase'e otomatik gider)
    updateUserProfile({ ...userProfile, selectedCity: city });
    localStorage.setItem('mks_selected_city', safeStringify(city));
    setSearchResults([]); 
  };

  const detectCurrentLocation = async () => {
      if (!("geolocation" in navigator)) {
          alert("Tarayıcınız konum özelliğini desteklemiyor.");
          return;
      }

      setIsSearching(true);
      navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          const locationName = await WeatherService.reverseGeocode(latitude, longitude);
          const newLoc = { name: locationName, lat: latitude, lon: longitude };
          changeCity(newLoc);
          setIsSearching(false);
      }, (err) => {
          console.error(err);
          setIsSearching(false);
          alert("Konum izni reddedildi veya konum alınamadı.");
      });
  };

  const getSprayingAdvice = (windSpeed: number, temperature: number) => {
    const now = new Date();
    const month = now.getMonth();
    const hour = now.getHours();

    if (windSpeed > 20) {
      return { 
        status: 'KRİTİK', 
        message: 'Şiddetli rüzgar! İlaçlama kesinlikle yapılamaz.', 
        color: 'text-red-400', 
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        iconColor: 'text-red-500'
      };
    }

    const isSummer = month >= 5 && month <= 7;

    if (isSummer && (hour < 6 || hour >= 11)) {
      return { 
        status: 'SAAT UYGUN DEĞİL', 
        message: 'Yaz sıcağı riski! İlaçlama sadece sabah 06-11 arası önerilir.', 
        color: 'text-orange-400', 
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
        iconColor: 'text-orange-500'
      };
    }

    if (windSpeed > 10) {
      return { 
        status: 'RÜZGARLI', 
        message: 'Rüzgar hızı sınırda. İlaçlama kalitesi düşebilir.', 
        color: 'text-yellow-400', 
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        iconColor: 'text-yellow-500'
      };
    }

    if (temperature < 11 || temperature > 39) {
      return { 
        status: 'SICAKLIK UYGUN DEĞİL', 
        message: 'Ekstrem sıcaklık! İlaç etkisini kaybedebilir veya bitkiyi yakabilir.', 
        color: 'text-rose-400', 
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        iconColor: 'text-rose-500'
      };
    }

    return { 
      status: 'İDEAL ŞARTLAR', 
      message: 'Hava ve rüzgar ilaçlama için mükemmel durumda.', 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      iconColor: 'text-emerald-500'
    };
  };

  const getWeatherUITheme = (code: number) => {
    if (code === 0) return { label: 'Açık Gökyüzü', gradient: 'from-orange-400/20 to-amber-600/5', icon: 'sun' };
    if (code >= 1 && code <= 3) return { label: 'Parçalı Bulutlu', gradient: 'from-blue-400/10 to-stone-800/20', icon: 'cloud-sun' };
    if (code >= 45 && code <= 48) return { label: 'Sisli', gradient: 'from-gray-500/20 to-stone-900/40', icon: 'fog' };
    if (code >= 51 && code <= 67) return { label: 'Yağmurlu', gradient: 'from-indigo-500/20 to-blue-900/40', icon: 'rain' };
    if (code >= 71) return { label: 'Karlı', gradient: 'from-sky-100/10 to-stone-900/40', icon: 'snow' };
    return { label: 'Bulutlu', gradient: 'from-stone-600/20 to-stone-900/40', icon: 'cloud' };
  };

  return {
    selectedCity,
    changeCity,
    weather,
    isLoading,
    error,
    refreshWeather,
    getSprayingAdvice,
    getWeatherUITheme,
    searchLocations,
    searchResults,
    isSearching,
    detectCurrentLocation
  };
};

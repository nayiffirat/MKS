
import { safeStringify } from '../utils/json';
import { useState, useEffect, useCallback } from 'react';
import { WeatherService, WeatherResponse, AGRI_CITIES } from '../services/weather';
import { AgriCity } from '../types';
import { useAppViewModel } from '../context/AppContext';

const weatherCache: { [key: string]: { data: WeatherResponse; timestamp: number } } = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const useWeatherViewModel = () => {
  const { userProfile, updateUserProfile, t } = useAppViewModel();

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

  const refreshWeather = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const cacheKey = `${selectedCity.lat}-${selectedCity.lon}`;
      const now = Date.now();

      if (!force && weatherCache[cacheKey] && (now - weatherCache[cacheKey].timestamp < CACHE_DURATION)) {
          setWeather(weatherCache[cacheKey].data);
          setIsLoading(false);
          return;
      }

      const data = await WeatherService.getForecast(selectedCity.lat, selectedCity.lon);
      weatherCache[cacheKey] = { data, timestamp: now };
      setWeather(data);
    } catch (err) {
      setError(t('weather.error.fetch'));
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
          alert(t('weather.error.geolocation'));
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
          alert(t('weather.error.denied'));
      });
  };

  const getSprayingAdvice = (windSpeed: number, temperature: number, weatherCode: number) => {
    const now = new Date();
    const month = now.getMonth();
    const hour = now.getHours();

    const isRainyOrSnowy = (weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 80 && weatherCode <= 86) || (weatherCode >= 95);

    if (isRainyOrSnowy) {
      return { 
          status: 'İLAÇLAMAYA UYGUN DEĞİL', 
          message: 'Yağışlı veya fırtınalı hava. Atılan ilaç yıkanıp gideceği veya tehlikeli olacağı için ilaçlama yapılamaz.', 
          color: 'text-red-400', 
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          iconColor: 'text-red-500',
          isSuitable: false
      };
    }

    if (windSpeed > 15) {
      return { 
          status: 'İLAÇLAMAYA UYGUN DEĞİL', 
          message: 'Şiddetli rüzgar! İlaç savrulacağı için ilaçlama kesinlikle yapılamaz.', 
          color: 'text-red-400', 
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          iconColor: 'text-red-500',
          isSuitable: false
      };
    }

    if (temperature < 5 || temperature > 35) {
      return { 
          status: 'İLAÇLAMAYA UYGUN DEĞİL', 
          message: 'Ekstrem sıcaklık! İlaç etkisini kaybedebilir veya bitkiyi yakabilir.', 
          color: 'text-rose-400', 
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/20',
          iconColor: 'text-rose-500',
          isSuitable: false
      };
    }

    const isSummer = month >= 5 && month <= 7;
    // In summer, mid day (11 to 17) is usually very hot and sunny, stomatas close, evaporation is high
    if (isSummer && (hour >= 11 && hour <= 17)) {
      return { 
          status: 'ŞU AN UYGUN DEĞİL', 
          message: 'Yaz sıcağında güneş tepedeyken ilaçlama yapılmaz. Sabah erken veya akşam serinliğini bekleyin.', 
          color: 'text-orange-400', 
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/20',
          iconColor: 'text-orange-500',
          isSuitable: false
      };
    }

    if (windSpeed > 10) {
      return { 
          status: 'DİKKATLİ OLUN', 
          message: 'Rüzgar hızı sınırda. İlaçlama yapılabilir ancak damla çapını büyütün ve sürüklenmeye dikkat edin.', 
          color: 'text-yellow-400', 
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/20',
          iconColor: 'text-yellow-500',
          isSuitable: true
      };
    }

    return { 
        status: 'İLAÇLAMAYA UYGUN', 
        message: 'Hava koşulları (rüzgar, sıcaklık ve yağış durumu) ilaçlama için mükemmel.', 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        iconColor: 'text-emerald-500',
        isSuitable: true
    };
  };

  const getWeatherUITheme = (code: number) => {
    // WMO Weather interpretation codes
    if (code === 0) return { label: 'Açık', gradient: 'from-orange-400/20 to-amber-600/5', icon: 'sun' };
    if (code === 1 || code === 2) return { label: 'Parçalı Bulutlu', gradient: 'from-blue-400/10 to-stone-800/20', icon: 'cloud-sun' };
    if (code === 3) return { label: 'Çok Bulutlu', gradient: 'from-stone-600/20 to-stone-900/40', icon: 'cloud' };
    if (code >= 45 && code <= 48) return { label: 'Sisli', gradient: 'from-gray-500/20 to-stone-900/40', icon: 'fog' };
    if (code >= 51 && code <= 67) return { label: 'Yağmurlu', gradient: 'from-indigo-500/20 to-blue-900/40', icon: 'rain' };
    if (code >= 71 && code <= 77) return { label: 'Karlı', gradient: 'from-sky-100/10 to-stone-900/40', icon: 'snow' };
    if (code >= 80 && code <= 82) return { label: 'Sağanak Yağışlı', gradient: 'from-indigo-600/20 to-blue-900/50', icon: 'rain' };
    if (code >= 85 && code <= 86) return { label: 'Yoğun Kar', gradient: 'from-sky-200/20 to-stone-900/50', icon: 'snow' };
    if (code >= 95) return { label: 'Fırtına', gradient: 'from-purple-500/20 to-stone-900/50', icon: 'lightning' };
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

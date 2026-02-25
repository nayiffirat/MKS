
import React, { useState } from 'react';
import { useWeatherViewModel } from '../hooks/useWeatherViewModel';
import { AGRI_CITIES } from '../services/weather';
import { Sun, Wind, Droplets, X, CloudRain, MapPin, RefreshCw, ArrowLeft, ChevronRight, Sunrise, Sunset, Zap, Cloud, CloudSun, CloudLightning, CloudSnow, Thermometer, Waves, Sparkles, Search, Loader2, LocateFixed } from 'lucide-react';

export const WeatherWidget: React.FC = () => {
  const { weather, isLoading, refreshWeather, getSprayingAdvice, getWeatherUITheme, selectedCity, changeCity, searchLocations, searchResults, isSearching, detectCurrentLocation } = useWeatherViewModel();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!weather && isLoading) return <div className="h-20 bg-stone-900/50 rounded-2xl animate-pulse mb-3 border border-white/5"></div>;
  if (!weather) return null;

  const current = weather.current;
  const theme = getWeatherUITheme(current.weather_code);
  const advice = getSprayingAdvice(current.wind_speed_10m, current.temperature_2m);
  const WeatherIcon = ({ code, size=20 }: any) => {
    if (code === 0) return <Sun size={size} className="text-amber-400" />;
    if (code >= 1 && code <= 3) return <CloudSun size={size} className="text-amber-200" />;
    if (code >= 51) return <CloudRain size={size} className="text-blue-400" />;
    return <Cloud size={size} className="text-stone-300" />;
  };

  return (
    <>
      <div className={`relative mb-3 overflow-hidden rounded-[1.3rem] p-2.5 border border-white/10 shadow-lg bg-gradient-to-br ${theme.gradient} group`}>
        <div className="absolute -top-5 -right-5 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
        <div className="relative z-10 flex flex-col space-y-1.5">
            <div className="flex justify-between items-center">
                <button onClick={() => setIsCitySelectorOpen(true)} className="flex items-center space-x-1.5 bg-black/20 px-2 py-0.5 rounded-lg border border-white/5 active:scale-95"><MapPin size={9} className="text-emerald-400" /><span className="text-[9px] font-bold text-stone-100">{selectedCity.name}</span></button>
                <div className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-md border border-white/5 ${advice.bg}`}><Zap size={9} className={advice.iconColor} /><span className={`text-[7px] font-black uppercase ${advice.color}`}>{advice.status}</span></div>
            </div>
            <div onClick={() => setIsDialogOpen(true)} className="flex justify-between items-center cursor-pointer">
                <div className="flex items-center space-x-2">
                    <span className="text-4xl font-bold text-white tracking-tighter">{Math.round(current.temperature_2m)}°</span>
                    <div className="border-l border-white/10 pl-2"><div className="flex items-center space-x-1"><WeatherIcon code={current.weather_code} size={12} /><span className="text-[9px] text-stone-200 font-bold uppercase">{theme.label}</span></div></div>
                </div>
                <div className="flex items-center space-x-2 text-[9px] font-bold text-stone-300">
                    <div className="flex items-center space-x-1 bg-black/10 px-1.5 py-0.5 rounded"><Wind size={9} /><span className="text-stone-200">{Math.round(current.wind_speed_10m)}</span></div>
                    <div className="flex items-center space-x-1 bg-black/10 px-1.5 py-0.5 rounded"><Droplets size={9} className="text-blue-300" /><span className="text-stone-200">%{current.relative_humidity_2m}</span></div>
                </div>
            </div>
        </div>
      </div>

      {isCitySelectorOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end animate-in fade-in duration-300">
            <div className="w-full bg-stone-900 rounded-t-[2.5rem] p-5 pb-10 border-t border-white/10 h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Konum Seç</h3>
                    <button onClick={() => setIsCitySelectorOpen(false)} className="bg-stone-800 p-2 rounded-full text-stone-400"><X size={20}/></button>
                </div>
                <button onClick={() => { detectCurrentLocation(); setIsCitySelectorOpen(false); }} className="w-full mb-4 flex items-center justify-center space-x-2 py-3 bg-emerald-600/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-sm"><LocateFixed size={16} /><span>Mevcut Konum</span></button>
                <div className="relative mb-4"><Search size={16} className="absolute left-3 top-3.5 text-stone-500" /><input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); searchLocations(e.target.value); }} placeholder="İlçe ara..." className="w-full bg-stone-800 rounded-xl py-3 pl-10 pr-3 text-stone-200 text-sm outline-none" /></div>
                <div className="flex-1 overflow-y-auto space-y-1">{searchResults.map((res, i) => (<button key={i} onClick={() => { changeCity(res); setIsCitySelectorOpen(false); }} className="w-full text-left p-3 rounded-xl bg-stone-800/40 hover:bg-stone-800 text-stone-200 text-sm font-bold">{res.name}</button>))}</div>
            </div>
        </div>
      )}
      
      {isDialogOpen && (
          <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col p-6">
              <button onClick={() => setIsDialogOpen(false)} className="self-start mb-6 p-2 bg-stone-900 rounded-full"><ArrowLeft size={24} className="text-stone-400"/></button>
              <div className="text-center"><h2 className="text-6xl font-black text-white">{Math.round(current.temperature_2m)}°</h2><p className="text-stone-400 text-lg mt-2">{theme.label}</p></div>
              <div className="mt-10 grid grid-cols-2 gap-4">
                  <div className="bg-stone-900 p-4 rounded-2xl border border-white/5"><p className="text-xs text-stone-500 uppercase">Rüzgar</p><p className="text-xl font-bold text-white">{current.wind_speed_10m} km/s</p></div>
                  <div className="bg-stone-900 p-4 rounded-2xl border border-white/5"><p className="text-xs text-stone-500 uppercase">Nem</p><p className="text-xl font-bold text-white">%{current.relative_humidity_2m}</p></div>
              </div>
          </div>
      )}
    </>
  );
};

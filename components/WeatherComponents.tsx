
import React, { useState, useRef } from 'react';
import { useWeatherViewModel } from '../hooks/useWeatherViewModel';

const WeatherAnimations = () => (
    <style>{`
        @keyframes rainFall {
            0% { transform: translateY(-10vh); opacity: 0; }
            10% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes snowFall {
            0% { transform: translateY(-10vh) translateX(0); opacity: 0; }
            10% { opacity: 1; }
            50% { transform: translateY(40vh) translateX(20px); }
            90% { opacity: 1; }
            100% { transform: translateY(100vh) translateX(-20px); opacity: 0; }
        }
        @keyframes lightningStrike {
            0% { opacity: 0; }
            1% { opacity: 0.8; }
            2% { opacity: 0; }
            10% { opacity: 0; }
            11% { opacity: 0.5; }
            12% { opacity: 0; }
            100% { opacity: 0; }
        }
        @keyframes panCloud {
            0% { transform: translateX(-50%); opacity: 0; }
            10% { opacity: 0.2; }
            90% { opacity: 0.2; }
            100% { transform: translateX(100%); opacity: 0; }
        }
    `}</style>
);

const WeatherBackgroundAnimation = ({ code }: { code: number }) => {
    const isSunny = code === 0 || code === 1;
    const isRainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
    const isSnowy = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
    const isThunder = code >= 95;
    const isCloudy = code === 2 || code === 3 || (code >= 45 && code <= 48);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen">
            {isSunny && (
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/20 rounded-full blur-[40px] animate-pulse" style={{ animationDuration: '4s' }}></div>
            )}
            
            {(isRainy || isThunder) && Array.from({ length: 30 }).map((_, i) => (
                <div 
                    key={i} 
                    className="absolute bg-gradient-to-b from-transparent to-blue-300 w-[1px] h-20"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `-20%`,
                        animation: `rainFall ${0.4 + Math.random() * 0.4}s linear infinite`,
                        animationDelay: `${Math.random()}s`,
                    }}
                />
            ))}

            {isThunder && (
                <div className="absolute inset-0 bg-white/60 mix-blend-overlay" style={{ animation: 'lightningStrike 6s infinite' }}></div>
            )}

            {isSnowy && Array.from({ length: 40 }).map((_, i) => (
                <div 
                    key={i} 
                    className="absolute bg-white/80 rounded-full w-2 h-2 blur-[1px]"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `-10%`,
                        animation: `snowFall ${2 + Math.random() * 3}s linear infinite`,
                        animationDelay: `${Math.random() * 3}s`,
                    }}
                />
            ))}

            {isCloudy && Array.from({ length: 3 }).map((_, i) => (
                <div 
                    key={i} 
                    className="absolute bg-white/10 rounded-full blur-3xl"
                    style={{
                        width: `${100 + Math.random() * 100}px`,
                        height: `${50 + Math.random() * 50}px`,
                        left: `-50%`,
                        top: `${Math.random() * 50}%`,
                        animation: `panCloud ${15 + Math.random() * 10}s linear infinite`,
                        animationDelay: `${Math.random() * 5}s`,
                    }}
                />
            ))}
        </div>
    );
};
import { useAppViewModel } from '../context/AppContext';
import { AGRI_CITIES } from '../services/weather';
import { Sun, Wind, Droplets, X, CloudRain, MapPin, RefreshCw, ArrowLeft, ChevronRight, Sunrise, Sunset, Zap, Cloud, CloudSun, CloudLightning, CloudSnow, Thermometer, Waves, Sparkles, Search, Loader2, LocateFixed } from 'lucide-react';

export const WeatherWidget: React.FC = () => {
  const { weather, isLoading, refreshWeather, getSprayingAdvice, getWeatherUITheme, selectedCity, changeCity, searchLocations, searchResults, isSearching, detectCurrentLocation } = useWeatherViewModel();
  const { t } = useAppViewModel();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchQuery(val);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
          searchLocations(val);
      }, 500);
  };

  if (!weather && isLoading) return <div className="h-20 bg-stone-900/50 rounded-2xl animate-pulse mb-3 border border-white/5"></div>;
  if (!weather) return null;

  const current = weather.current;
  const theme = getWeatherUITheme(current.weather_code);
  const advice = getSprayingAdvice(current.wind_speed_10m, current.temperature_2m, current.weather_code);
  const WeatherIcon = ({ code, size=20 }: any) => {
    if (code === 0) return <Sun size={size} className="text-amber-400" />;
    if (code === 1 || code === 2) return <CloudSun size={size} className="text-amber-200" />;
    if (code >= 45 && code <= 48) return <div className="text-gray-400 relative" style={{width: size, height: size}}><Cloud size={size} className="absolute inset-0 opacity-50" /><div className="absolute inset-0 flex items-center justify-center font-black text-[8px] opacity-70">SİS</div></div>;
    if (code >= 51 && code <= 67) return <CloudRain size={size} className="text-blue-400" />;
    if (code >= 71 && code <= 77) return <CloudSnow size={size} className="text-white" />;
    if (code >= 80 && code <= 82) return <CloudRain size={size} className="text-indigo-400" />;
    if (code >= 85 && code <= 86) return <CloudSnow size={size} className="text-sky-200" />;
    if (code >= 95) return <CloudLightning size={size} className="text-purple-400" />;
    return <Cloud size={size} className="text-stone-300" />;
  };

  return (
    <>
      <div className={`relative overflow-hidden rounded-[1.3rem] p-2.5 border border-white/10 shadow-lg bg-gradient-to-br ${theme.gradient} group h-full`}>
        <WeatherAnimations />
        <WeatherBackgroundAnimation code={current.weather_code} />
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
                    <h3 className="text-lg font-bold text-white">{t('weather.select_location')}</h3>
                    <button onClick={() => setIsCitySelectorOpen(false)} className="bg-stone-800 p-2 rounded-full text-stone-400"><X size={20}/></button>
                </div>
                <button onClick={() => { detectCurrentLocation(); setIsCitySelectorOpen(false); }} className="w-full mb-4 flex items-center justify-center space-x-2 py-3 bg-emerald-600/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-sm"><LocateFixed size={16} /><span>{t('weather.current_location')}</span></button>
                <div className="relative mb-4"><Search size={16} className="absolute left-3 top-3.5 text-stone-500" /><input type="text" value={searchQuery} onChange={handleSearchChange} placeholder={t('weather.search_placeholder')} className="w-full bg-stone-800 rounded-xl py-3 pl-10 pr-3 text-stone-200 text-sm outline-none" /></div>
                <div className="flex-1 overflow-y-auto space-y-1">{searchResults.map((res, i) => (<button key={i} onClick={() => { changeCity(res); setIsCitySelectorOpen(false); }} className="w-full text-left p-3 rounded-xl bg-stone-800/40 hover:bg-stone-800 text-stone-200 text-sm font-bold">{res.name}</button>))}</div>
            </div>
        </div>
      )}
      
      {isDialogOpen && (
          <div className="fixed inset-0 z-[100] bg-stone-950 flex flex-col p-5 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-300">
              <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-50"><WeatherBackgroundAnimation code={current.weather_code} /></div>
              
              <div className="flex justify-between items-center mb-6 relative z-10">
                <button onClick={() => setIsDialogOpen(false)} className="p-2 bg-stone-900 rounded-full hover:bg-stone-800 transition-colors"><ArrowLeft size={20} className="text-stone-400"/></button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 rounded-full border border-white/5">
                    <MapPin size={12} className="text-emerald-500" />
                    <span className="text-xs font-bold text-stone-200">{selectedCity.name}</span>
                </div>
              </div>
              
              <div className="text-center mb-8 relative z-10">
                  <div className="flex justify-center mb-2 drop-shadow-2xl">
                     <WeatherIcon code={current.weather_code} size={84} />
                  </div>
                  <h2 className="text-7xl font-black text-white tracking-tighter">{Math.round(current.temperature_2m)}°</h2>
                  <p className="text-stone-400 text-lg mt-1 font-medium">{theme.label}</p>
              </div>

              {/* Advanced info */}
              <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
                  <div className="bg-stone-900/80 p-4 rounded-3xl border border-white/5 flex flex-col items-center">
                    <Wind size={20} className="text-stone-500 mb-2" />
                    <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest">{t('weather.wind')}</p>
                    <p className="text-2xl font-black text-white mt-1">{Math.round(current.wind_speed_10m)} <span className="text-sm text-stone-500">km/s</span></p>
                  </div>
                  <div className="bg-stone-900/80 p-4 rounded-3xl border border-white/5 flex flex-col items-center">
                    <Droplets size={20} className="text-blue-400 mb-2" />
                    <p className="text-[10px] text-stone-500 uppercase font-black tracking-widest">{t('weather.humidity')}</p>
                    <p className="text-2xl font-black text-white mt-1">%{current.relative_humidity_2m}</p>
                  </div>
              </div>

               {/* Spraying Advice Alert */}
              <div className={`p-4 rounded-3xl border mb-6 flex gap-3 items-start ${advice.bg} ${advice.border} relative z-10`}>
                  <Zap size={24} className={`shrink-0 ${advice.iconColor}`} />
                  <div>
                      <h4 className={`text-sm font-black uppercase tracking-widest mb-1 ${advice.color}`}>{advice.status}</h4>
                      <p className={`text-xs font-medium leading-relaxed opacity-90 ${advice.color}`}>{advice.message}</p>
                  </div>
              </div>

              {/* 7 Day Forecast */}
              <div className="pb-10 relative z-10">
                  <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3 px-2">7 Günlük Tahmin</h3>
                  <div className="space-y-2">
                      {weather.daily.time.map((dateStr, idx) => {
                          const dateObj = new Date(dateStr);
                          const dayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'long' });
                          const isToday = new Date().toDateString() === dateObj.toDateString();
                          return (
                              <div key={idx} className="flex items-center justify-between p-3.5 bg-stone-900/40 rounded-2xl border border-white/5">
                                  <span className="text-xs font-bold text-stone-300 w-24">{isToday ? "Bugün" : dayName}</span>
                                  <div className="flex gap-4 items-center">
                                      <WeatherIcon code={weather.daily.weather_code[idx]} size={16} />
                                      <div className="flex flex-col items-end w-8">
                                          <span className="text-sm font-black text-white">{Math.round(weather.daily.temperature_2m_max[idx])}°</span>
                                          <span className="text-[10px] font-bold text-stone-500">{Math.round(weather.daily.temperature_2m_min[idx])}°</span>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

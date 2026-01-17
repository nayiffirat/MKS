import React, { useState } from 'react';
import { useWeatherViewModel } from '../hooks/useWeatherViewModel';
import { Cloud, Sun, Wind, Droplets, Calendar, X, AlertTriangle, CloudRain, MapPin, RefreshCw, Loader2 } from 'lucide-react';

export const WeatherWidget: React.FC = () => {
  const { weather, isLoading, refreshWeather, getSprayingAdvice, getWeatherDescription } = useWeatherViewModel();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!weather && isLoading) return <div className="h-24 bg-stone-100 rounded-xl animate-pulse mb-6 border border-stone-200"></div>;
  if (!weather) return null;

  const current = weather.current;
  const advice = getSprayingAdvice(current.wind_speed_10m);
  const isRisky = current.wind_speed_10m > 20;

  return (
    <>
      <div 
        onClick={() => setIsDialogOpen(true)}
        className={`relative mb-6 p-4 rounded-xl border cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center justify-between group ${isRisky ? 'bg-red-50 border-red-200' : 'bg-white border-agri-100'}`}
      >
        <div className="flex items-center space-x-4">
           <div className={`p-3 rounded-full ${isRisky ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              {isLoading ? <Loader2 className="animate-spin" size={24}/> : (current.weather_code <= 3 ? <Sun size={24} /> : <CloudRain size={24} />)}
           </div>
           <div>
              <h3 className="font-bold text-stone-800 flex items-center">
                 Şanlıurfa, TR
                 <span className="ml-2 text-xs font-normal text-stone-500 bg-white/50 px-2 py-0.5 rounded-full border border-stone-100">
                    {getWeatherDescription(current.weather_code)}
                 </span>
              </h3>
              <p className="text-2xl font-bold text-stone-900">{Math.round(current.temperature_2m)}°C</p>
           </div>
        </div>

        <div className="text-right hidden md:block">
           <div className={`flex items-center justify-end text-sm font-medium ${advice.color}`}>
              <Wind size={16} className="mr-1" />
              Rüzgar: {current.wind_speed_10m} km/s
           </div>
           <p className="text-xs text-stone-500 mt-1">{advice.message}</p>
        </div>
        
        <div className="md:hidden text-right">
             <span className={`text-xs font-bold px-2 py-1 rounded ${advice.bg} ${advice.color}`}>
                {advice.status}
             </span>
        </div>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              <div className="bg-agri-700 text-white p-4 flex justify-between items-center shrink-0">
                 <div className="flex items-center">
                    <Cloud className="mr-2" />
                    <h3 className="font-bold text-lg">Haftalık Tarım Tahmini</h3>
                 </div>
                 <div className="flex items-center space-x-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); refreshWeather(); }} 
                      disabled={isLoading}
                      className="hover:bg-white/20 rounded-full p-2 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setIsDialogOpen(false)} className="hover:bg-white/20 rounded-full p-2"><X size={20}/></button>
                 </div>
              </div>

              <div className="overflow-y-auto flex-1 relative">
                 {isLoading && (
                    <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="flex flex-col items-center">
                            <Loader2 className="animate-spin text-agri-600 mb-2" size={40} />
                            <span className="text-agri-800 font-medium">Veriler Güncelleniyor...</span>
                        </div>
                    </div>
                 )}

                 <div className="p-6 bg-agri-50 border-b border-agri-100">
                    <div className="flex items-start mb-4">
                        <MapPin className="text-agri-600 mr-2 mt-1" size={20} />
                        <div>
                            <h2 className="text-2xl font-bold text-agri-900">Şanlıurfa</h2>
                            <p className="text-agri-700">{Math.round(current.temperature_2m)}°C - {getWeatherDescription(current.weather_code)}</p>
                        </div>
                    </div>

                    <div className={`p-4 rounded-xl border ${advice.bg} ${advice.color} flex items-start mb-4`}>
                        <AlertTriangle size={24} className="mr-3 flex-shrink-0" />
                        <div>
                            <h4 className="font-bold text-sm uppercase">İlaçlama Durumu: {advice.status}</h4>
                            <p className="text-sm mt-1">{advice.message}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-agri-100 flex items-center">
                            <Droplets className="text-blue-500 mr-3" />
                            <div>
                                <p className="text-xs text-stone-500">Nem Oranı</p>
                                <p className="font-bold text-stone-800">%{current.relative_humidity_2m}</p>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-agri-100 flex items-center">
                            <Wind className="text-stone-500 mr-3" />
                            <div>
                                <p className="text-xs text-stone-500">Rüzgar Hızı</p>
                                <p className="font-bold text-stone-800">{current.wind_speed_10m} km/s</p>
                            </div>
                        </div>
                    </div>
                 </div>

                 <div>
                    <h4 className="px-6 py-3 text-xs font-bold text-stone-500 uppercase bg-stone-50 sticky top-0 border-b">Önümüzdeki 7 Gün</h4>
                    {weather.daily.time.map((dateStr, index) => (
                        <div key={index} className="flex items-center justify-between px-6 py-4 border-b border-stone-50 last:border-0 hover:bg-stone-50">
                            <div className="flex items-center">
                                <Calendar size={18} className="text-agri-400 mr-3" />
                                <div>
                                    <p className="font-bold text-stone-700">
                                        {new Date(dateStr).toLocaleDateString('tr-TR', { weekday: 'long' })}
                                    </p>
                                    <p className="text-xs text-stone-400">{new Date(dateStr).toLocaleDateString('tr-TR')}</p>
                                </div>
                            </div>
                            <div className="text-right flex items-center space-x-4">
                                <div className="text-center">
                                    <p className="text-xs text-stone-400">Yağış</p>
                                    <p className="font-medium text-blue-600 flex items-center justify-end">
                                        <Droplets size={12} className="mr-1"/> 
                                        {weather.daily.precipitation_sum[index]} mm
                                    </p>
                                </div>
                                <div className="w-16 text-right">
                                    <span className="text-lg font-bold text-stone-800">{Math.round(weather.daily.temperature_2m_max[index])}°</span>
                                </div>
                            </div>
                        </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </>
  );
};
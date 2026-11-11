import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useWeatherViewModel } from '../hooks/useWeatherViewModel';
import { useAppViewModel } from '../context/AppContext';
import {
  AGRI_CITIES,
  calculateDeltaT,
  computeHourlySprayingWindow,
  computeGddPestAlerts,
} from '../services/weather';
import { dbService } from '../services/db';
import { PortalInquiry } from '../types';
import { ModalCloseButton } from './ModalCloseButton';
import { useBackHandler } from '../utils/navigationManager';
import {
  Sun,
  Wind,
  Droplets,
  CloudRain,
  MapPin,
  ArrowLeft,
  Zap,
  Cloud,
  CloudSun,
  CloudLightning,
  CloudSnow,
  Thermometer,
  Search,
  LocateFixed,
  Bug,
  CalendarCheck,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

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
        <div
          className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/20 rounded-full blur-[40px] animate-pulse"
          style={{ animationDuration: '4s' }}
        />
      )}
      {(isRainy || isThunder) &&
        Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-gradient-to-b from-transparent to-blue-300 w-[1px] h-20"
            style={{
              left: `${(i * 17) % 100}%`,
              top: `-20%`,
              animation: `rainFall ${0.45 + (i % 5) * 0.08}s linear infinite`,
              animationDelay: `${(i % 7) * 0.14}s`,
            }}
          />
        ))}
      {isThunder && (
        <div
          className="absolute inset-0 bg-white/60 mix-blend-overlay"
          style={{ animation: 'lightningStrike 6s infinite' }}
        />
      )}
      {isSnowy &&
        Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white/80 rounded-full w-2 h-2 blur-[1px]"
            style={{
              left: `${(i * 13) % 100}%`,
              top: `-10%`,
              animation: `snowFall ${2.2 + (i % 4) * 0.7}s linear infinite`,
              animationDelay: `${(i % 6) * 0.4}s`,
            }}
          />
        ))}
      {isCloudy &&
        Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-white/10 rounded-full blur-3xl"
            style={{
              width: `${120 + i * 40}px`,
              height: `${55 + i * 18}px`,
              left: `-50%`,
              top: `${15 + i * 20}%`,
              animation: `panCloud ${16 + i * 4}s linear infinite`,
              animationDelay: `${i * 2}s`,
            }}
          />
        ))}
    </div>
  );
};

const WeatherIcon = ({ code, size = 20 }: { code: number; size?: number }) => {
  if (code === 0) return <Sun size={size} className="text-amber-400" />;
  if (code === 1 || code === 2) return <CloudSun size={size} className="text-amber-200" />;
  if (code >= 45 && code <= 48)
    return (
      <div className="text-gray-400 relative" style={{ width: size, height: size }}>
        <Cloud size={size} className="absolute inset-0 opacity-50" />
        <div className="absolute inset-0 flex items-center justify-center font-black text-[11px] leading-none opacity-70">SİS</div>
      </div>
    );
  if (code >= 51 && code <= 67) return <CloudRain size={size} className="text-blue-400" />;
  if (code >= 71 && code <= 77) return <CloudSnow size={size} className="text-white" />;
  if (code >= 80 && code <= 82) return <CloudRain size={size} className="text-indigo-400" />;
  if (code >= 85 && code <= 86) return <CloudSnow size={size} className="text-sky-200" />;
  if (code >= 95) return <CloudLightning size={size} className="text-purple-400" />;
  return <Cloud size={size} className="text-stone-300" />;
};

export const WeatherWidget: React.FC = () => {
  const {
    weather,
    isLoading,
    refreshWeather,
    getSprayingAdvice,
    getWeatherUITheme,
    selectedCity,
    changeCity,
    searchLocations,
    searchResults,
    detectCurrentLocation,
  } = useWeatherViewModel();
  const { t } = useAppViewModel();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCitySelectorOpen, setIsCitySelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useBackHandler(isDialogOpen, () => setIsDialogOpen(false), 'WeatherComponents_detail', 50);
  // City selector can open on top of the detail dialog, so it gets a higher priority.
  useBackHandler(isCitySelectorOpen, () => setIsCitySelectorOpen(false), 'WeatherComponents_citySelector', 60);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(val);
    }, 450);
  };

  const hourlyWindow = useMemo(() => computeHourlySprayingWindow(weather), [weather]);
  const gddAlerts = useMemo(() => {
    if (!weather?.daily) return [];
    const fullMax = (weather.daily as any)._fullMax || weather.daily.temperature_2m_max || [];
    const fullMin = (weather.daily as any)._fullMin || weather.daily.temperature_2m_min || [];
    return computeGddPestAlerts(fullMax, fullMin, weather.current?.relative_humidity_2m || 50);
  }, [weather]);

  if (!weather && isLoading)
    return <div className="h-24 bg-stone-900/50 rounded-2xl animate-pulse mb-3 border border-white/5" />;
  if (!weather) return null;

  const current = weather.current;
  const theme = getWeatherUITheme(current.weather_code);
  const advice = getSprayingAdvice(current.wind_speed_10m, current.temperature_2m, current.weather_code);
  const deltaT = calculateDeltaT(current.temperature_2m, current.relative_humidity_2m);

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-[1.3rem] p-3 border border-white/10 shadow-lg bg-gradient-to-br ${theme.gradient} group h-full`}
      >
        <WeatherAnimations />
        <WeatherBackgroundAnimation code={current.weather_code} />
        <div className="relative z-10 flex flex-col space-y-2">
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsCitySelectorOpen(true)}
              className="flex items-center space-x-1.5 bg-black/30 hover:bg-black/45 px-3 py-1.5 min-h-[36px] rounded-xl border border-white/10 active:scale-95 transition-all"
            >
              <MapPin size={12} className="text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-stone-100">{selectedCity.name}</span>
            </button>
            <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-white/10 ${advice.bg}`}>
              <Zap size={11} className={advice.iconColor} />
              <span className={`text-[11px] font-bold ${advice.color}`}>{advice.status}</span>
            </div>
          </div>

          <div onClick={() => setIsDialogOpen(true)} className="flex justify-between items-center cursor-pointer pt-0.5">
            <div className="flex items-center space-x-2.5">
              <span className="text-3xl font-black text-white tracking-tight tabular-nums">
                {Math.round(current.temperature_2m)}°C
              </span>
              <div className="border-l border-white/15 pl-2.5">
                <div className="flex items-center space-x-1.5">
                  <WeatherIcon code={current.weather_code} size={15} />
                  <span className="text-[11px] text-stone-100 font-bold">{theme.label}</span>
                </div>
                <div className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                  ΔT: {deltaT}°C {deltaT >= 2 && deltaT <= 8 ? '(İdeal Damla)' : '(Buharlaşma Riski)'}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-[11px] font-bold text-stone-200">
              <div className="flex items-center space-x-1 bg-black/25 px-2 py-0.5 rounded-md">
                <Wind size={11} className="text-sky-300" />
                <span>{Math.round(current.wind_speed_10m)} km/s</span>
              </div>
              <div className="flex items-center space-x-1 bg-black/25 px-2 py-0.5 rounded-md">
                <Droplets size={11} className="text-blue-300" />
                <span>%{current.relative_humidity_2m} Nem</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* City Selector Modal */}
      {isCitySelectorOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsCitySelectorOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-stone-900 rounded-t-[2rem] sm:rounded-3xl p-5 pb-8 border border-white/10 max-h-[82dvh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">{t('weather.select_location') || 'Tarım Bölgesi Seçin'}</h3>
              <ModalCloseButton onClick={() => setIsCitySelectorOpen(false)} className="!rounded-full" />
            </div>
            <button
              onClick={() => {
                detectCurrentLocation();
                setIsCitySelectorOpen(false);
              }}
              className="w-full mb-3 flex items-center justify-center space-x-2 py-2.5 bg-emerald-600/15 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold text-xs"
            >
              <LocateFixed size={15} />
              <span>{t('weather.current_location') || 'GPS Konumumu Kullan'}</span>
            </button>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-3 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={t('weather.search_placeholder') || 'İl veya ilçe ara...'}
                className="w-full bg-stone-950 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-stone-200 text-xs outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {(searchQuery.length >= 3 ? searchResults : AGRI_CITIES).map((res, i) => (
                <button
                  key={i}
                  onClick={() => {
                    changeCity(res);
                    setIsCitySelectorOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl bg-stone-800/50 hover:bg-stone-800 text-stone-200 text-xs font-bold flex items-center justify-between"
                >
                  <span>{res.name}</span>
                  {res.admin1 && <span className="text-[11px] text-stone-400">{res.admin1}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Agro-Weather, Delta-T & GDD Modal */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-[120] bg-stone-950/95 backdrop-blur-xl flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
          <div className="max-w-3xl w-full mx-auto space-y-5 pb-10">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="px-3 py-2 bg-stone-900 rounded-xl border border-white/10 hover:bg-stone-800 transition-colors flex items-center gap-1.5 text-xs font-bold text-stone-200"
              >
                <ArrowLeft size={16} />
                <span>Kapat</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCitySelectorOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 rounded-full border border-white/10 hover:border-emerald-500/40"
                >
                  <MapPin size={13} className="text-emerald-400" />
                  <span className="text-xs font-bold text-stone-200">{selectedCity.name}</span>
                </button>
                <button
                  onClick={() => refreshWeather(true)}
                  className="p-2 bg-stone-900 rounded-full border border-white/10 text-stone-300 hover:text-white"
                  title="Hava Durumunu Yenile"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            {/* Hero Current Weather */}
            <div className="bg-stone-900/90 border border-white/10 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <WeatherIcon code={current.weather_code} size={56} />
                <div>
                  <div className="text-4xl sm:text-5xl font-black text-white tabular-nums">
                    {Math.round(current.temperature_2m)}°C
                  </div>
                  <div className="text-sm text-stone-300 font-semibold mt-0.5">{theme.label}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5 w-full sm:w-auto">
                <div className="bg-stone-950/80 px-3.5 py-2.5 rounded-2xl border border-white/5 text-center">
                  <div className="text-[11px] text-stone-400 font-bold uppercase">Rüzgar</div>
                  <div className="text-base font-black text-white mt-0.5">{Math.round(current.wind_speed_10m)} km/s</div>
                </div>
                <div className="bg-stone-950/80 px-3.5 py-2.5 rounded-2xl border border-white/5 text-center">
                  <div className="text-[11px] text-stone-400 font-bold uppercase">Bağıl Nem</div>
                  <div className="text-base font-black text-sky-300 mt-0.5">%{current.relative_humidity_2m}</div>
                </div>
                <div className="bg-stone-950/80 px-3.5 py-2.5 rounded-2xl border border-white/5 text-center">
                  <div className="text-[11px] text-stone-400 font-bold uppercase">Delta-T (ΔT)</div>
                  <div
                    className={`text-base font-black mt-0.5 ${
                      deltaT >= 2 && deltaT <= 8 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {deltaT}°C
                  </div>
                </div>
              </div>
            </div>

            {/* Spraying Suitability Banner */}
            <div className={`p-4 rounded-2xl border flex gap-3 items-start ${advice.bg} ${advice.border}`}>
              <Zap size={22} className={`shrink-0 mt-0.5 ${advice.iconColor}`} />
              <div>
                <h4 className={`text-xs font-black uppercase tracking-wider ${advice.color}`}>{advice.status}</h4>
                <p className="text-xs text-stone-200 mt-1 leading-relaxed">
                  {advice.message} • Anlık Delta-T değeri <b>{deltaT}°C</b>{' '}
                  {deltaT >= 2 && deltaT <= 8
                    ? '(2°C–8°C ideal ilaçlama aralığında; damlacık tutunması yüksek).'
                    : deltaT > 8
                    ? '(8°C üzerinde damlacık yaprağa ulaşmadan buharlaşabilir; yayıcı-yapıştırıcı kullanın).'
                    : '(Çok yüksek nem / çiğ riski; yaprak yüzeyinden akma olabilir).'}
                </p>
              </div>
            </div>

            {/* #1: 12-Hour Spraying Window */}
            {hourlyWindow.length > 0 && (
              <div className="bg-stone-900/90 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Clock size={14} /> 12 Saatlik İlaçlama Uygunluk Penceresi (Delta-T & Rüzgar)
                  </h3>
                  <span className="text-[11px] text-stone-400 font-semibold">Yeşil saatler ilaçlama için idealdir</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {hourlyWindow.map((slot, idx) => {
                    const pillCls =
                      slot.suitability === 'IDEAL'
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : slot.suitability === 'DIKKAT'
                        ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                        : 'bg-rose-500/15 border-rose-500/35 text-rose-300';
                    return (
                      <div key={idx} className={`p-2.5 rounded-2xl border text-center space-y-1 ${pillCls}`} title={slot.reason}>
                        <div className="text-xs font-black text-white font-mono">{slot.hourLabel}</div>
                        <div className="text-[11px] font-bold">{slot.tempC}°C</div>
                        <div className="text-[11px] opacity-90">ΔT {slot.deltaT} • {slot.windKmh}km/s</div>
                        <div className="text-[11px] font-black uppercase tracking-tight">
                          {slot.suitability === 'IDEAL' ? '✓ Uygun' : slot.suitability === 'DIKKAT' ? '⚠ Dikkat' : '✕ Uygunsuz'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* #2: GDD Pest Emergence Alerts */}
            {gddAlerts.length > 0 && (
              <div className="bg-stone-900/90 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Bug size={14} /> GDD (Gün-Derece) Zararlı & Hastalık Çıkış Tahmini
                  </h3>
                  <span className="text-[11px] text-stone-400">Son 14 Gün + 7 Gün Tahmini Sıcaklık Birikimi</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {gddAlerts.map(alert => {
                    const badgeCls =
                      alert.riskLevel === 'YUKSEK'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : alert.riskLevel === 'ORTA'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                    return (
                      <div key={alert.id} className="bg-stone-950/80 border border-white/10 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-white">{alert.pestName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${badgeCls}`}>
                            {alert.riskLevel} RİSK
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 font-semibold">
                          {alert.crop} • Baz {alert.baseTempC}°C • Birikim: <b className="text-white">{alert.accumulatedGdd} GDD</b>
                        </div>
                        <p className="text-[11px] text-stone-300 leading-relaxed">{alert.advice}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7-Day Forecast */}
            <div className="bg-stone-900/90 border border-white/10 rounded-3xl p-4 sm:p-5">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-wider mb-3">7 Günlük Tarım Tahmini</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {weather.daily.time.map((dateStr, idx) => {
                  const dateObj = new Date(dateStr);
                  const dayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' });
                  const isToday = new Date().toDateString() === dateObj.toDateString();
                  const rainMm = Number(weather.daily.precipitation_sum?.[idx] || 0);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-stone-950/70 rounded-2xl border border-white/5"
                    >
                      <span className="text-xs font-bold text-stone-200">{isToday ? 'Bugün' : dayName}</span>
                      <div className="flex gap-3 items-center">
                        {rainMm > 0 && (
                          <span className="text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                            {rainMm.toFixed(1)} mm
                          </span>
                        )}
                        <WeatherIcon code={weather.daily.weather_code[idx]} size={16} />
                        <div className="flex items-baseline gap-1.5 font-mono">
                          <span className="text-xs font-black text-white">
                            {Math.round(weather.daily.temperature_2m_max[idx])}°
                          </span>
                          <span className="text-[11px] font-bold text-stone-500">
                            {Math.round(weather.daily.temperature_2m_min[idx])}°
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Top-of-Dashboard Live Weather, Delta-T Spraying Suitability, Morning Briefing & Farmer Portal Inbox Strip
 * (Covers items 1.13, #1, #2, #35, #38, #45 across ALL themes).
 */
export const DashboardWeatherAndBriefingBanner: React.FC<{
  onNavigate: (view: any) => void;
}> = ({ onNavigate }) => {
  const { weather, selectedCity, getSprayingAdvice, getWeatherUITheme, changeCity, detectCurrentLocation } =
    useWeatherViewModel();
  const { inventory, reminders, myPayments, farmers, showToast } = useAppViewModel();

  const [isPortalInboxOpen, setIsPortalInboxOpen] = useState(false);
  const [inquiries, setInquiries] = useState<PortalInquiry[]>([]);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [isCityQuickOpen, setIsCityQuickOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useBackHandler(isDetailOpen, () => setIsDetailOpen(false), 'WeatherComponents_bannerDetail', 50);
  useBackHandler(isPortalInboxOpen, () => setIsPortalInboxOpen(false), 'WeatherComponents_portalInbox', 50);

  useEffect(() => {
    let mounted = true;
    dbService
      .getEngineerPortalInquiries()
      .then(list => {
        if (mounted) setInquiries(list);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isPortalInboxOpen]);

  const expiringOrLowCount = useMemo(() => {
    const now = Date.now();
    const in60Days = now + 60 * 86400000;
    return (inventory || []).filter(i => {
      if (i.deletedAt) return false;
      const isLow = Number(i.quantity || 0) <= Number(i.lowStockThreshold || 5);
      const expMs = i.expiryDate ? new Date(i.expiryDate).getTime() : NaN;
      const isExpiring = !isNaN(expMs) && expMs <= in60Days;
      return isLow || isExpiring;
    }).length;
  }, [inventory]);

  const dueChecksCount = useMemo(() => {
    const in7Days = Date.now() + 7 * 86400000;
    return (myPayments || []).filter(p => {
      if (p.status === 'PAID') return false;
      const ms = new Date(p.dueDate).getTime();
      return !isNaN(ms) && ms <= in7Days;
    }).length;
  }, [myPayments]);

  const openRemindersCount = useMemo(() => (reminders || []).filter(r => !r.isCompleted).length, [reminders]);
  const unreadInquiriesCount = useMemo(() => inquiries.filter(q => q.status === 'OPEN').length, [inquiries]);

  const current = weather?.current;
  const deltaT = current ? calculateDeltaT(current.temperature_2m, current.relative_humidity_2m) : 4.5;
  const advice = current
    ? getSprayingAdvice(current.wind_speed_10m, current.temperature_2m, current.weather_code)
    : { status: 'Yükleniyor', color: 'text-emerald-400', bg: 'bg-emerald-500/15', isSuitable: true };
  const theme = current ? getWeatherUITheme(current.weather_code) : { label: 'Açık' };
  const hourlySlots = useMemo(() => computeHourlySprayingWindow(weather), [weather]);
  const idealHoursLabel = useMemo(() => {
    const ideal = hourlySlots.filter(s => s.suitability === 'IDEAL');
    if (ideal.length === 0) return 'Bugün uygun saat sınırlı';
    return `${ideal[0].hourLabel} – ${ideal[ideal.length - 1].hourLabel} arası uygun`;
  }, [hourlySlots]);

  const gddHighCount = useMemo(() => {
    if (!weather?.daily) return 0;
    const fullMax = (weather.daily as any)._fullMax || weather.daily.temperature_2m_max || [];
    const fullMin = (weather.daily as any)._fullMin || weather.daily.temperature_2m_min || [];
    return computeGddPestAlerts(fullMax, fullMin, current?.relative_humidity_2m || 50).filter(
      a => a.riskLevel !== 'DUSUK'
    ).length;
  }, [weather, current]);

  const handleResolveInquiry = async (inq: PortalInquiry) => {
    const reply = (replyTexts[inq.id] || '').trim();
    await dbService.updatePortalInquiryStatus(inq.id, 'ANSWERED', reply || 'İncelendi / Onaylandı');
    setInquiries(prev =>
      prev.map(item => (item.id === inq.id ? { ...item, status: 'ANSWERED', engineerReply: reply } : item))
    );
    showToast?.('Üretici bildirimi yanıtlandı olarak işaretlendi.', 'success');
  };

  return (
    <>
      <div className="v22-bento-card p-3.5 sm:p-4 border border-emerald-500/20 shadow-lg">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-center">
          {/* Left 5 Cols: Live Weather + Delta-T Spraying Radar */}
          <div className="xl:col-span-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-stone-950/85 border border-white/10 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <WeatherIcon code={current?.weather_code ?? 0} size={26} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsCityQuickOpen(!isCityQuickOpen)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-emerald-300 transition-colors"
                  >
                    <MapPin size={12} />
                    <span className="truncate max-w-[130px]">{selectedCity.name}</span>
                  </button>
                  <span className="text-xl font-black tracking-tight tabular-nums text-white">
                    {current ? `${Math.round(current.temperature_2m)}°C` : '—'}
                  </span>
                  <span className="text-[11px] text-stone-300 font-semibold">{theme.label}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-stone-300 font-semibold mt-1 flex-wrap tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Wind size={11} className="text-sky-400" />
                    {current ? `${Math.round(current.wind_speed_10m)} km/s` : '—'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Droplets size={11} className="text-blue-400" />
                    {current ? `%${current.relative_humidity_2m}` : '—'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                    <Thermometer size={11} />
                    ΔT {deltaT}°C
                  </span>
                </div>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setIsDetailOpen(true)}
                className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-bold border border-white/10 ${advice.bg} ${advice.color} hover:opacity-90 transition-opacity`}
              >
                {advice.status}
              </button>
              <button
                type="button"
                onClick={() => setIsDetailOpen(true)}
                className="text-[11px] text-stone-300 hover:text-emerald-300 font-semibold underline-offset-2 hover:underline py-1"
              >
                {idealHoursLabel} →
              </button>
            </div>
          </div>

          {/* Right 7 Cols: Engineer Morning Briefing Pills (#45, #17, #2, #35/#38) */}
          <div className="xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('INVENTORY')}
              className="p-2.5 rounded-2xl bg-stone-900/75 hover:bg-stone-900 border border-white/10 text-left transition-all"
            >
              <div className="flex items-center justify-between text-amber-400">
                <AlertTriangle size={14} />
                <span className="text-sm font-black font-mono text-white">{expiringOrLowCount}</span>
              </div>
              <div className="text-[11px] font-bold text-stone-200 mt-1 truncate">Kritik Stok & SKT</div>
              <div className="text-[11px] text-stone-400 truncate">FEFO & Azalan Ürün</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('PAYMENTS')}
              className="p-2.5 rounded-2xl bg-stone-900/75 hover:bg-stone-900 border border-white/10 text-left transition-all"
            >
              <div className="flex items-center justify-between text-sky-400">
                <CalendarCheck size={14} />
                <span className="text-sm font-black font-mono text-white">{dueChecksCount + openRemindersCount}</span>
              </div>
              <div className="text-[11px] font-bold text-stone-200 mt-1 truncate">Sabah Brifingi</div>
              <div className="text-[11px] text-stone-400 truncate">
                {dueChecksCount} Vade • {openRemindersCount} Görev
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsDetailOpen(true)}
              className="p-2.5 rounded-2xl bg-stone-900/75 hover:bg-stone-900 border border-white/10 text-left transition-all"
            >
              <div className="flex items-center justify-between text-rose-400">
                <Bug size={14} />
                <span className="text-sm font-black font-mono text-white">{gddHighCount}</span>
              </div>
              <div className="text-[11px] font-bold text-stone-200 mt-1 truncate">GDD Zararlı Riski</div>
              <div className="text-[11px] text-stone-400 truncate">Gün-Derece Tahmini</div>
            </button>

            <button
              type="button"
              onClick={() => setIsPortalInboxOpen(true)}
              className="p-2.5 rounded-2xl bg-stone-900/75 hover:bg-stone-900 border border-white/10 text-left transition-all relative"
            >
              <div className="flex items-center justify-between text-emerald-400">
                <MessageSquare size={14} />
                <span className="text-sm font-black font-mono text-white">{unreadInquiriesCount}</span>
              </div>
              <div className="text-[11px] font-bold text-stone-200 mt-1 truncate">Üretici Portalı</div>
              <div className="text-[11px] text-stone-400 truncate">Soru & Ödeme Bildirimi</div>
              {unreadInquiriesCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>
          </div>
        </div>

        {/* Quick City Bar */}
        {isCityQuickOpen && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                detectCurrentLocation();
                setIsCityQuickOpen(false);
              }}
              className="px-3 py-1.5 min-h-[38px] rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5"
            >
              <LocateFixed size={13} /> GPS Konumum
            </button>
            {AGRI_CITIES.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => {
                  changeCity(c);
                  setIsCityQuickOpen(false);
                }}
                className={`px-3 py-1.5 min-h-[38px] rounded-xl text-xs font-bold border transition-colors ${
                  selectedCity.name === c.name
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-stone-900 text-stone-300 border-white/10 hover:bg-stone-800'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hidden WeatherWidget modal trigger when user clicks "idealHoursLabel" or "GDD Zararlı Riski" */}
      {isDetailOpen && (
        <div
          className="fixed inset-0 z-[120] bg-stone-950/95 backdrop-blur-xl flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar"
          onClick={() => setIsDetailOpen(false)}
        >
          <div className="max-w-3xl w-full mx-auto space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400" />
                <span>{selectedCity.name} • Zirai Hava, Delta-T İlaçlama Penceresi & GDD Radarı</span>
              </h3>
              <ModalCloseButton onClick={() => setIsDetailOpen(false)} />
            </div>
            <WeatherWidget />
            {hourlySlots.length > 0 && (
              <div className="bg-stone-900 border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="text-xs font-black text-emerald-400 uppercase">
                  Önümüzdeki 12 Saat İlaçlama Uygunluğu (Delta-T + Rüzgar)
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {hourlySlots.map((slot, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-xl border text-center ${
                        slot.suitability === 'IDEAL'
                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                          : slot.suitability === 'DIKKAT'
                          ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                          : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                      }`}
                    >
                      <div className="text-xs font-black text-white font-mono">{slot.hourLabel}</div>
                      <div className="text-[11px] font-bold">{slot.tempC}°C</div>
                      <div className="text-[11px]">ΔT {slot.deltaT} • {slot.windKmh}km/s</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {weather?.daily && (
              <div className="bg-stone-900 border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="text-xs font-black text-amber-400 uppercase">
                  GDD (Etkili Sıcaklık Toplamı) Zararlı & Hastalık Tahmini
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {computeGddPestAlerts(
                    (weather.daily as any)._fullMax || weather.daily.temperature_2m_max || [],
                    (weather.daily as any)._fullMin || weather.daily.temperature_2m_min || [],
                    current?.relative_humidity_2m || 50
                  ).map(a => (
                    <div key={a.id} className="bg-stone-950 border border-white/10 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">{a.pestName}</span>
                        <span className="text-[11px] font-black text-amber-300">{a.accumulatedGdd} GDD</span>
                      </div>
                      <div className="text-[11px] text-stone-400">{a.crop}</div>
                      <p className="text-[11px] text-stone-300">{a.advice}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Producer Portal Inquiries & Payment Notifications Modal (#35 & #38) */}
      {isPortalInboxOpen && (
        <div
          className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsPortalInboxOpen(false)}
        >
          <div
            className="bg-stone-950 border border-white/15 rounded-3xl w-full max-w-2xl max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-stone-900/80">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <MessageSquare size={18} className="text-emerald-400" />
                  <span>Üretici Portalından Gelen Sorular & Ödeme Bildirimleri</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Çiftçilerinizin portal linki üzerinden gönderdiği hastalık fotoğrafları ve IBAN ödeme bildirimleri
                </p>
              </div>
              <ModalCloseButton onClick={() => setIsPortalInboxOpen(false)} />
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {inquiries.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500/60" />
                  <div className="font-bold text-stone-200">Henüz üretici portalından gelen yeni bildirim yok</div>
                  <p>Müstahsillerinize cari portal linki paylaştığınızda gönderdikleri fotoğraf ve ödeme bildirimleri anında buraya düşer.</p>
                </div>
              ) : (
                inquiries.map(inq => {
                  const farmerMatch = farmers.find(f => f.id === inq.farmerId);
                  return (
                    <div
                      key={inq.id}
                      className={`rounded-2xl border p-4 space-y-3 ${
                        inq.status === 'OPEN'
                          ? 'bg-stone-900 border-emerald-500/40'
                          : 'bg-stone-900/40 border-white/10 opacity-80'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                              inq.type === 'PAYMENT_NOTICE'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            }`}
                          >
                            {inq.type === 'PAYMENT_NOTICE' ? 'Ödeme bildirimi' : 'Mühendise soru / fotoğraf'}
                          </span>
                          <span className="text-sm font-black text-white">
                            {inq.farmerName || farmerMatch?.fullName || 'Üretici'}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-400">
                          {new Date(inq.createdAt).toLocaleString('tr-TR')}
                        </span>
                      </div>

                      {inq.claimedAmount ? (
                        <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 font-bold">
                          Bildirilen Ödeme Tutarı: {Number(inq.claimedAmount).toLocaleString('tr-TR')} ₺
                        </div>
                      ) : null}

                      <p className="text-xs text-stone-200 whitespace-pre-wrap">{inq.message}</p>

                      {inq.photoBase64 && (
                        <img
                          src={inq.photoBase64}
                          alt="Tarla fotoğrafı"
                          className="max-h-56 rounded-xl border border-white/10 object-contain bg-black"
                        />
                      )}

                      {inq.status === 'OPEN' ? (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <input
                            value={replyTexts[inq.id] || ''}
                            onChange={e => setReplyTexts(prev => ({ ...prev, [inq.id]: e.target.value }))}
                            placeholder="Kısa not veya yanıt (isteğe bağlı)..."
                            className="flex-1 px-3 py-2 rounded-xl bg-stone-950 border border-white/15 text-xs text-white"
                          />
                          <button
                            onClick={() => handleResolveInquiry(inq)}
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs shrink-0"
                          >
                            ✓ İncelendi İşaretle
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-400 font-semibold">
                          ✓ Yanıtlandı {inq.engineerReply ? `• "${inq.engineerReply}"` : ''}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

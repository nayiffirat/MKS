/**
 * AgroWeatherScreen — parsel bazlı zirai hava durumu ekranı.
 * Canlı gökyüzü (AtmosphericStage) üzerinde buzlu cam kartlar; kartlar .weather-glass-card sınıfını taşır (yağmur üst kenarlarına çarpar).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, MapPin, ChevronDown, RefreshCw, SunMedium, Sun, Moon, Cloud, CloudSun, CloudMoon, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning,
  Wind, Droplets, Thermometer, Snowflake, Sunrise, Sunset, Gauge, Sprout, Navigation, LocateFixed, Search, SprayCan, Umbrella, Bug, Eye, Radar
} from 'lucide-react';
import { useAppViewModel } from '../../context/AppContext';
import { useBackHandler } from '../../utils/navigationManager';
import { AGRI_CITIES, WeatherService, computeGddPestAlerts } from '../../services/weather';
import {
  AgroWeather, AgroWeatherService, AgroHour, bestSprayWindow, compassShort, driftVerdict, frostInfo, hhmm, leafWetness, localParts, nextRain, soilInfo,
  sprayVerdict, SprayLevel, waterBalance, wmoLabel
} from '../../services/agroWeather';
import { AtmosphericStage } from './AtmosphericStage';
import { LiveRadarMap } from './LiveRadarMap';

interface Loc { id: string; name: string; sub?: string; lat: number; lon: number; polygon?: Array<{ lat: number; lng: number }> }
const LOC_KEY = 'mks_agro_wx_loc';
const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const LEVEL: Record<SprayLevel, { c: string; t: string }> = { IDEAL: { c: '#34d399', t: 'İdeal' }, DIKKAT: { c: '#fbbf24', t: 'Dikkatli' }, UYGUNSUZ: { c: '#f87171', t: 'Uygun değil' } };
const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('tr-TR');

const CSS = `
.wx-root{position:fixed;inset:0;z-index:110;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,sans-serif;--p:0}
.wx-scroll{position:absolute;inset:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.wx-wrap{max-width:1120px;margin:0 auto;padding:0 12px calc(28px + env(safe-area-inset-bottom))}
.wx-bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 12px 10px;margin:0 -12px;
  background:rgba(10,16,30,calc(var(--p)*.62));backdrop-filter:blur(calc(var(--p)*22px)) saturate(170%);-webkit-backdrop-filter:blur(calc(var(--p)*22px)) saturate(170%);border-bottom:1px solid rgba(255,255,255,calc(var(--p)*.14))}
.wx-btn{min-width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(12,18,32,.38);color:#fff;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;
  backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);font-weight:700;font-size:14px;padding:0 12px}
.wx-btn[aria-pressed=true]{background:rgba(251,191,36,.92);color:#1a1300;border-color:transparent}
.wx-mini{opacity:var(--p);font-weight:800;font-size:15px;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.wx-hero{text-align:center;padding:6px 0 22px;opacity:calc(1 - var(--p));transform:scale(calc(1 - var(--p)*.14));transform-origin:50% 0;text-shadow:0 2px 12px rgba(0,0,0,.35)}
.wx-temp{font-size:clamp(76px,22vw,128px);font-weight:200;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.wx-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.wx-all,.wx-wide{grid-column:1/-1}
@media(min-width:900px){.wx-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.wx-wide{grid-column:span 2}}
.weather-glass-card{position:relative;border-radius:22px;padding:14px;background:rgba(14,22,40,.40);border:1px solid rgba(255,255,255,.18);
  backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);box-shadow:0 8px 30px rgba(0,0,0,.18);text-shadow:0 1px 2px rgba(0,0,0,.35);min-width:0}
.wx-outdoor .weather-glass-card{background:rgba(4,8,18,.84);border-color:rgba(255,255,255,.4);text-shadow:none}
.wx-outdoor .wx-cap,.wx-outdoor .wx-dim{opacity:1}
.wx-cap{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.74;margin-bottom:8px}
.wx-dim{opacity:.78}
.wx-big{font-size:30px;font-weight:600;line-height:1.05;font-variant-numeric:tabular-nums}
.wx-sm{font-size:12.5px;line-height:1.35}
.wx-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:11.5px;font-weight:800;color:#06121f}
.wx-hours{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;margin:0 -6px;padding:0 6px}
.wx-hours::-webkit-scrollbar{display:none}
.wx-hour{flex:0 0 54px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:14px;border:0;background:transparent;color:#fff;cursor:pointer;font:inherit}
.wx-hour[aria-pressed=true]{background:rgba(255,255,255,.16)}
.wx-row{display:grid;grid-template-columns:44px 26px 38px 34px 1fr 34px;align-items:center;gap:6px;padding:7px 0;border-top:1px solid rgba(255,255,255,.12);font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.wx-track{height:6px;border-radius:3px;background:rgba(255,255,255,.16);position:relative}
.wx-sheet{position:fixed;inset:0;z-index:125;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}
.wx-sheet>div{width:100%;max-width:520px;max-height:82dvh;display:flex;flex-direction:column;border-radius:24px 24px 0 0;background:rgba(14,20,36,.96);border:1px solid rgba(255,255,255,.16);padding:14px 14px calc(14px + env(safe-area-inset-bottom));color:#fff}
@media(min-width:640px){.wx-sheet{align-items:center}.wx-sheet>div{border-radius:24px}}
.wx-item{display:flex;align-items:center;gap:10px;width:100%;min-height:50px;padding:8px 10px;border-radius:14px;border:0;background:transparent;color:#fff;text-align:left;cursor:pointer;font:inherit}
.wx-item:hover,.wx-item[aria-current=true]{background:rgba(255,255,255,.1)}
.wx-input{width:100%;min-height:46px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff;padding:0 12px 0 38px;font-size:15px;outline:none}
.wx-input::placeholder{color:rgba(255,255,255,.55)}
@media(prefers-reduced-motion:reduce){.wx-hero{transform:none}}
`;

const WxIcon: React.FC<{ code: number; day?: boolean; size?: number }> = ({ code, day = true, size = 22 }) => {
  const I = code === 0 ? (day ? Sun : Moon) : code <= 2 ? (day ? CloudSun : CloudMoon) : code === 3 ? Cloud : code <= 48 ? CloudFog : code <= 57 ? CloudDrizzle
    : code <= 67 ? CloudRain : code <= 77 ? CloudSnow : code <= 82 ? CloudRain : code <= 86 ? CloudSnow : CloudLightning;
  const color = code === 0 && day ? '#fde047' : code >= 95 ? '#c4b5fd' : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? '#93c5fd' : '#fff';
  return <I size={size} color={color} strokeWidth={1.8} />;
};

const tempColor = (t: number) => {
  const stops: Array<[number, [number, number, number]]> = [[-10, [129, 140, 248]], [0, [96, 165, 250]], [10, [45, 212, 191]], [18, [163, 230, 53]], [26, [250, 204, 21]], [33, [251, 146, 60]], [42, [239, 68, 68]]];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`;
};

const fieldCenter = (f: any): { lat: number; lon: number } | null => {
  const lat = f?.centroid?.lat ?? f?.centroidLat ?? f?.lat, lon = f?.centroid?.lon ?? f?.centroidLng ?? f?.lng;
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  const pts = f?.polygonPoints;
  if (Array.isArray(pts) && pts.length) return { lat: pts.reduce((a: number, p: any) => a + p.lat, 0) / pts.length, lon: pts.reduce((a: number, p: any) => a + p.lng, 0) / pts.length };
  return null;
};

const Card: React.FC<{ icon: React.ElementType; title: string; className?: string; children: React.ReactNode }> = ({ icon: Icon, title, className = '', children }) => (
  <section className={`weather-glass-card ${className}`}>
    <div className="wx-cap"><Icon size={13} /> {title}</div>
    {children}
  </section>
);

export const AgroWeatherScreen: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { farmers, userProfile, showToast } = useAppViewModel();
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const cityLoc = useMemo<Loc>(() => {
    let c: any = (userProfile as any)?.selectedCity;
    if (!c) { try { c = JSON.parse(localStorage.getItem('mks_selected_city') || 'null'); } catch { c = null; } }
    c = c || AGRI_CITIES[0];
    return { id: `city:${c.name}`, name: c.name, sub: 'Kayıtlı konum', lat: c.lat, lon: c.lon };
  }, [userProfile]);
  const parcels = useMemo<Loc[]>(() => {
    const out: Loc[] = [];
    for (const f of farmers || []) for (const fl of f.fields || []) {
      const c = fieldCenter(fl);
      if (c) out.push({ id: `field:${fl.id}`, name: fl.name || 'Parsel', sub: `${f.fullName}${fl.crop ? ` · ${fl.crop}` : ''}`, lat: c.lat, lon: c.lon, polygon: fl.polygonPoints });
    }
    return out;
  }, [farmers]);

  const [loc, setLoc] = useState<Loc>(() => {
    try { const s = JSON.parse(localStorage.getItem(LOC_KEY) || 'null'); if (s && Number.isFinite(s.lat) && Number.isFinite(s.lon)) return s; } catch { /* yok say */ }
    return cityLoc;
  });
  const pickLoc = (l: Loc) => { setLoc(l); setSheet(false); setQuery(''); try { localStorage.setItem(LOC_KEY, JSON.stringify(l)); } catch { /* yok say */ } scrollRef.current?.scrollTo({ top: 0 }); };

  const [w, setW] = useState<AgroWeather | null>(null);
  const [status, setStatus] = useState<'loading' | 'fresh' | 'stale' | 'offline' | 'error'>('loading');
  const [tick, setTick] = useState(0);
  const [outdoor, setOutdoor] = useState(() => localStorage.getItem('mks_agro_wx_outdoor') === '1');
  const [sheet, setSheet] = useState(false);
  const [query, setQuery] = useState('');
  const [fullRadar, setFullRadar] = useState(false);
  const [selHour, setSelHour] = useState(-1);
  const [locating, setLocating] = useState(false);

  useBackHandler(isOpen && sheet, () => setSheet(false), 'AgroWeather_sheet', 72);
  useBackHandler(isOpen && fullRadar, () => setFullRadar(false), 'AgroWeather_radar', 74);

  useEffect(() => {
    if (!isOpen) return;
    setStatus(AgroWeatherService.getCached(loc) ? 'stale' : 'loading');
    setW(AgroWeatherService.getCached(loc));
    setSelHour(-1);
    return AgroWeatherService.load(loc, (data, stale) => { setW(data); setStatus(stale ? 'stale' : 'fresh'); }, hadCache => setStatus(hadCache ? 'offline' : 'error'), tick > 0);
  }, [isOpen, loc, tick]);

  // Açıkken 10 dakikada bir sessizce yenile
  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') setTick(t => t + 1); }, 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  // Kaydırdıkça küçülen başlık: React'i yeniden çizmeden CSS değişkeni
  const onScroll = useCallback(() => {
    const el = scrollRef.current, root = rootRef.current;
    if (el && root) root.style.setProperty('--p', String(Math.min(1, el.scrollTop / 150)));
  }, []);

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) return showToast?.('Bu cihazda konum alınamıyor.', 'error');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords;
      const name = await WeatherService.reverseGeocode(latitude, longitude);
      setLocating(false);
      pickLoc({ id: 'gps', name, sub: 'Mevcut konum', lat: latitude, lon: longitude });
    }, () => { setLocating(false); showToast?.('Konum izni verilmedi.', 'error'); }, { enableHighAccuracy: true, timeout: 12000 });
  };

  const d = useMemo(() => {
    if (!w) return null;
    const hours = w.hours.slice(0, 24);
    const verdicts = hours.map(h => sprayVerdict(h));
    const gMin = Math.min(...w.days.map(x => x.tMin)), gMax = Math.max(...w.days.map(x => x.tMax));
    return {
      hours, verdicts, gMin, gMax, win: bestSprayWindow(w.hours), rain: nextRain(w), frost: frostInfo(w.hours), leaf: leafWetness(w.hours), soil: soilInfo(w.hours[0]),
      water: waterBalance(w.days), drift: driftVerdict(w.current.wind, w.current.gust), gdd: computeGddPestAlerts(w.histMax, w.histMin, w.current.rh)
    };
  }, [w]);

  if (!isOpen) return null;
  const off = w?.utcOffset ?? 10800;
  const cur = w?.current;
  const today = w?.days[0];
  const filtered = parcels.filter(p => !query.trim() || `${p.name} ${p.sub}`.toLocaleLowerCase('tr-TR').includes(query.trim().toLocaleLowerCase('tr-TR'))).slice(0, 60);
  const statusText = status === 'stale' ? 'Güncelleniyor…' : status === 'offline' && w ? `Çevrimdışı · son veri ${new Date(w.fetchedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : '';
  const h0 = w?.hours[0];
  const sunP = today && cur ? Math.min(1, Math.max(0, (cur.t - today.sunrise) / Math.max(1, today.sunset - today.sunrise))) : 0;
  const sunUp = !!today && !!cur && cur.t >= today.sunrise && cur.t <= today.sunset;
  const pTrend = w && w.hours[3] ? w.hours[3].pressure - w.hours[0].pressure : 0;

  return createPortal(
    <div ref={rootRef} className={`wx-root mks-on-dark ${outdoor ? 'wx-outdoor' : ''}`}>
      <style>{CSS}</style>
      <div style={{ position: 'absolute', inset: 0, background: '#0b1220' }} />
      {cur && <AtmosphericStage lat={loc.lat} lon={loc.lon} code={cur.code} cloud={cur.cloud} windKmh={cur.wind} windDir={cur.windDir} precip={cur.precip} scrollRoot={scrollRef} />}

      <div ref={scrollRef} className="wx-scroll" onScroll={onScroll}>
        <div className="wx-wrap">
          <div className="wx-bar">
            <button type="button" className="wx-btn" onClick={onClose} aria-label="Kapat" style={{ padding: 0 }}><X size={20} /></button>
            <button type="button" className="wx-btn" onClick={() => setSheet(true)} style={{ minWidth: 0, flex: '0 1 auto' }}>
              <MapPin size={15} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span> <ChevronDown size={15} />
            </button>
            <span className="wx-mini" style={{ flex: 1, textAlign: 'center' }}>{cur ? `${r0(cur.temp)}° · ${wmoLabel(cur.code)}` : ''}</span>
            <button type="button" className="wx-btn" onClick={() => setOutdoor(v => { localStorage.setItem('mks_agro_wx_outdoor', v ? '0' : '1'); return !v; })} aria-pressed={outdoor} aria-label="Güneş altı saha modu" title="Güneş altı saha modu" style={{ padding: 0 }}><SunMedium size={19} /></button>
            <button type="button" className="wx-btn" onClick={() => setTick(t => t + 1)} aria-label="Yenile" style={{ padding: 0 }}><RefreshCw size={17} className={status === 'stale' || status === 'loading' ? 'animate-spin' : ''} /></button>
          </div>

          {!w && (
            <div className="weather-glass-card" style={{ marginTop: 80, textAlign: 'center', padding: 28 }}>
              {status === 'error' ? (
                <>
                  <p style={{ margin: 0, fontWeight: 700 }}>Hava verisi alınamadı.</p>
                  <p className="wx-sm wx-dim" style={{ margin: '6px 0 14px' }}>İnternet bağlantınızı kontrol edip tekrar deneyin.</p>
                  <button type="button" className="wx-btn" style={{ margin: '0 auto' }} onClick={() => setTick(t => t + 1)}><RefreshCw size={16} /> Tekrar Dene</button>
                </>
              ) : <p style={{ margin: 0, fontWeight: 600 }}>Hava verisi alınıyor…</p>}
            </div>
          )}

          {w && cur && d && today && (
            <>
              <div className="wx-hero">
                <div style={{ fontSize: 26, fontWeight: 500 }}>{loc.name}</div>
                {loc.sub && <div className="wx-sm wx-dim">{loc.sub}</div>}
                <div className="wx-temp">{r0(cur.temp)}°</div>
                <div style={{ fontSize: 19, fontWeight: 600 }}>{wmoLabel(cur.code)}</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>Y: {r0(today.tMax)}° &nbsp; D: {r0(today.tMin)}° &nbsp;·&nbsp; Hissedilen {r0(cur.feels)}°</div>
                {statusText && <div className="wx-sm" style={{ marginTop: 6, fontWeight: 700 }}>{statusText}</div>}
              </div>

              <div className="wx-grid">
                {/* Önümüzdeki saat yağış */}
                <Card icon={Umbrella} title="Önümüzdeki 2 saat · yağış" className="wx-all">
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>{d.rain.headline}</p>
                  {d.rain.active && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 54, marginTop: 12 }}>
                        {d.rain.slots.map((s, i) => (
                          <div key={s.t} title={`${r1(s.mm)} mm`} style={{ flex: 1, borderRadius: 4, minHeight: 3, height: `${Math.max(5, Math.min(100, (s.mm / Math.max(1, d.rain.peak)) * 100))}%`, background: s.mm > 0.05 ? 'linear-gradient(180deg,#7dd3fc,#3b82f6)' : 'rgba(255,255,255,.2)', opacity: i === 0 ? 1 : 0.9 }} />
                        ))}
                      </div>
                      <div className="wx-sm wx-dim" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}><span>Şimdi</span><span>30 dk</span><span>60 dk</span><span>90 dk</span><span>2 sa</span></div>
                    </>
                  )}
                </Card>

                {/* Saatlik + ilaçlama uygunluğu */}
                <Card icon={SprayCan} title="Saatlik hava · ilaçlama uygunluğu" className="wx-all">
                  <p style={{ margin: '0 0 8px', fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>
                    {selHour >= 0 && d.hours[selHour]
                      ? `${hhmm(d.hours[selHour].t, off)} · ${LEVEL[d.verdicts[selHour].level].t}: ${d.verdicts[selHour].reason} · Rüzgar ${r0(d.hours[selHour].wind)} km/s · ΔT ${d.verdicts[selHour].deltaT}°`
                      : d.win
                        ? `İlaçlama için en ${d.win.level === 'IDEAL' ? 'güvenli' : 'uygun (dikkatli)'} pencere: ${hhmm(d.win.start, off)} – ${hhmm(d.win.end, off)} (Rüzgar ${d.win.avgWind} km/s, yağış riski %${d.win.maxRainProb}, ΔT ${r1(d.win.avgDeltaT)}°)`
                        : 'Önümüzdeki 24 saatte gündüz ilaçlamaya uygun pencere görünmüyor.'}
                  </p>
                  <div className="wx-hours">
                    {d.hours.map((h, i) => (
                      <button key={h.t} type="button" className="wx-hour" aria-pressed={selHour === i} onClick={() => setSelHour(selHour === i ? -1 : i)}>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{i === 0 ? 'Şimdi' : String(localParts(h.t, off).h).padStart(2, '0')}</span>
                        <WxIcon code={h.code} day={h.isDay} />
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#7dd3fc', height: 12 }}>{h.precipProb >= 20 ? `%${r0(h.precipProb)}` : ''}</span>
                        <span style={{ fontSize: 16, fontWeight: 600 }}>{r0(h.temp)}°</span>
                        <span title={d.verdicts[i].reason} style={{ width: 12, height: 12, borderRadius: 6, background: LEVEL[d.verdicts[i].level].c, boxShadow: '0 0 0 2px rgba(0,0,0,.25)' }} />
                      </button>
                    ))}
                  </div>
                  <div className="wx-sm wx-dim" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                    {(Object.keys(LEVEL) as SprayLevel[]).map(k => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 5, background: LEVEL[k].c, display: 'inline-block' }} />{LEVEL[k].t}</span>)}
                    <span>· saate dokunun</span>
                  </div>
                </Card>

                {/* Radar */}
                <Card icon={Radar} title="Canlı yağış radarı" className="wx-wide">
                  <div style={{ height: 230, borderRadius: 16, overflow: 'hidden' }}>
                    {!fullRadar && <LiveRadarMap compact lat={loc.lat} lon={loc.lon} utcOffset={off} polygon={loc.polygon} windKmh={cur.wind} windDir={cur.windDir} onExpand={() => setFullRadar(true)} />}
                  </div>
                </Card>

                {/* 10 gün */}
                <Card icon={Thermometer} title="10 günlük tahmin" className="wx-wide">
                  {w.days.map((x, i) => {
                    const span = Math.max(1, d.gMax - d.gMin);
                    const left = ((x.tMin - d.gMin) / span) * 100, width = Math.max(6, ((x.tMax - x.tMin) / span) * 100);
                    return (
                      <div key={x.t} className="wx-row" style={i === 0 ? { borderTop: 0 } : undefined}>
                        <span>{i === 0 ? 'Bugün' : DAYS[localParts(x.t + 43200, off).dow]}</span>
                        <WxIcon code={x.code} size={20} />
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#7dd3fc' }}>{x.precipProb >= 20 ? `%${r0(x.precipProb)}` : ''}</span>
                        <span className="wx-dim" style={{ textAlign: 'right' }}>{r0(x.tMin)}°</span>
                        <div className="wx-track">
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${Math.min(100 - left, width)}%`, borderRadius: 3, background: `linear-gradient(90deg, ${tempColor(x.tMin)}, ${tempColor(x.tMax)})` }} />
                          {i === 0 && <div style={{ position: 'absolute', top: -2, width: 10, height: 10, borderRadius: 5, background: '#fff', border: '2px solid rgba(0,0,0,.45)', left: `calc(${Math.min(100, Math.max(0, ((cur.temp - d.gMin) / span) * 100))}% - 5px)` }} />}
                        </div>
                        <span style={{ textAlign: 'right' }}>{r0(x.tMax)}°</span>
                      </div>
                    );
                  })}
                </Card>

                {/* Rüzgar ve sürüklenme */}
                <Card icon={Wind} title="Rüzgar · sürüklenme">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg viewBox="0 0 100 100" width="84" height="84" style={{ flexShrink: 0 }} role="img" aria-label={`Rüzgar ${compassShort(cur.windDir)} yönünden`}>
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" strokeDasharray="2 5.68" />
                      {['K', 'D', 'G', 'B'].map((t, i) => <text key={t} x={50 + 34 * Math.sin((i * Math.PI) / 2)} y={54 - 34 * Math.cos((i * Math.PI) / 2)} textAnchor="middle" fontSize="10" fontWeight="800" fill="rgba(255,255,255,.8)">{t}</text>)}
                      <g style={{ transform: `rotate(${cur.windDir + 180}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.2s cubic-bezier(.2,.8,.2,1)' }}>
                        <line x1="50" y1="72" x2="50" y2="26" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M50 16 L57 30 L43 30 Z" fill="#34d399" />
                        <circle cx="50" cy="74" r="3.5" fill="none" stroke="#fff" strokeWidth="2" />
                      </g>
                    </svg>
                    <div style={{ minWidth: 0 }}>
                      <div className="wx-big">{r0(cur.wind)}<span style={{ fontSize: 14, fontWeight: 700 }}> km/s</span></div>
                      <div className="wx-sm wx-dim">Hamle {r0(cur.gust)} · {compassShort(cur.windDir)}</div>
                      {h0 && h0.wind80 > 0 && <div className="wx-sm wx-dim">80 m: {r0(h0.wind80)} km/s</div>}
                    </div>
                  </div>
                  <div className="wx-sm" style={{ marginTop: 8, fontWeight: 700, color: LEVEL[d.drift.level].c }}>{d.drift.label}</div>
                </Card>

                {/* Toprak */}
                <Card icon={Sprout} title="Toprak sıcaklığı · nemi">
                  {d.soil ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, textAlign: 'center' }}>
                        {([['0 cm', d.soil.t0], ['6 cm', d.soil.t6], ['18 cm', d.soil.t18]] as const).map(([l, v]) => (
                          <div key={l}><div style={{ fontSize: 21, fontWeight: 600 }}>{Number.isFinite(v) ? `${r0(v)}°` : '—'}</div><div className="wx-sm wx-dim">{l}</div></div>
                        ))}
                      </div>
                      <div style={{ marginTop: 8 }}><span className="wx-chip" style={{ background: d.soil.sowingOk ? '#34d399' : '#fbbf24' }}>{d.soil.sowing}</span></div>
                      <div className="wx-sm" style={{ marginTop: 6 }}>Kök bölgesi nemi: <b>{d.soil.moisture}</b>{Number.isFinite(d.soil.m39) ? ` (%${r0(d.soil.m39 * 100)})` : ''}</div>
                    </>
                  ) : <p className="wx-sm wx-dim" style={{ margin: 0 }}>Bu konum için toprak verisi yok.</p>}
                </Card>

                {/* ET0 */}
                <Card icon={Droplets} title="Buharlaşma (ET₀) · sulama">
                  <div className="wx-big">{r1(d.water.et0Today)}<span style={{ fontSize: 14, fontWeight: 700 }}> mm/gün</span></div>
                  <div className="wx-sm wx-dim" style={{ marginTop: 4 }}>7 gün: su kaybı {r1(d.water.et7)} mm · yağış {r1(d.water.rain7)} mm</div>
                  <div className="wx-sm" style={{ marginTop: 6, fontWeight: 700, color: d.water.deficit > 8 ? '#fbbf24' : '#34d399' }}>{d.water.deficit > 0 ? `Açık ${r1(d.water.deficit)} mm · ` : ''}{d.water.text}</div>
                  <div className="wx-sm wx-dim" style={{ marginTop: 4 }}>Parselin NDMI / sulama analiziyle birlikte değerlendirin.</div>
                </Card>

                {/* Don ve çiy */}
                <Card icon={Snowflake} title="Zirai don · çiy noktası">
                  <div className="wx-big" style={{ color: d.frost.level === 'DON' || d.frost.level === 'RISK' ? '#f87171' : d.frost.level === 'IZLE' ? '#fbbf24' : '#fff' }}>{r0(d.frost.minTemp)}°</div>
                  <div className="wx-sm wx-dim">En düşük · {hhmm(d.frost.at, off)}</div>
                  <div className="wx-sm" style={{ marginTop: 6, fontWeight: 700, color: d.frost.level === 'YOK' ? '#34d399' : d.frost.level === 'IZLE' ? '#fbbf24' : '#f87171' }}>{d.frost.text}</div>
                  <div className="wx-sm" style={{ marginTop: 6 }}>Çiy noktası {h0 ? r0(h0.dew) : '—'}° · ıslak yaprak {d.leaf.wetHours} sa</div>
                  <div className="wx-sm" style={{ fontWeight: 700, color: d.leaf.risk === 'YUKSEK' ? '#f87171' : d.leaf.risk === 'ORTA' ? '#fbbf24' : '#34d399' }}>{d.leaf.text}</div>
                </Card>

                {/* Güneş yörüngesi + UV */}
                <Card icon={Sunrise} title="Güneş · UV">
                  <svg viewBox="0 0 120 62" width="100%" style={{ display: 'block', maxHeight: 84 }} aria-hidden="true">
                    <path d="M8 52 A52 52 0 0 1 112 52" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.6" strokeDasharray="3 3" />
                    <line x1="2" y1="52" x2="118" y2="52" stroke="rgba(255,255,255,.4)" strokeWidth="1" />
                    {sunUp && <circle cx={60 - 52 * Math.cos(Math.PI * sunP)} cy={52 - 52 * Math.sin(Math.PI * sunP) * 0.92} r="5.5" fill="#fde047" stroke="rgba(255,255,255,.7)" strokeWidth="1.5" />}
                  </svg>
                  <div className="wx-sm" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Sunrise size={13} /> {hhmm(today.sunrise, off)}</span>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Sunset size={13} /> {hhmm(today.sunset, off)}</span>
                  </div>
                  <div className="wx-sm" style={{ marginTop: 6 }}>UV en yüksek <b>{r0(today.uvMax)}</b> · {today.uvMax >= 8 ? 'Çok yüksek: korunun' : today.uvMax >= 6 ? 'Yüksek' : today.uvMax >= 3 ? 'Orta' : 'Düşük'}</div>
                </Card>

                {/* Basınç + nem + görüş */}
                <Card icon={Gauge} title="Basınç · nem · görüş">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg viewBox="0 0 100 62" width="92" style={{ flexShrink: 0 }} aria-hidden="true">
                      <path d="M10 54 A40 40 0 0 1 90 54" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="6" strokeLinecap="round" />
                      <g style={{ transform: `rotate(${Math.min(90, Math.max(-90, ((cur.pressure - 1000) / 45) * 90))}deg)`, transformOrigin: '50px 54px', transition: 'transform 1.2s ease' }}>
                        <line x1="50" y1="54" x2="50" y2="20" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                      </g>
                      <circle cx="50" cy="54" r="4" fill="#fff" />
                    </svg>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 600 }}>{r0(cur.pressure)}<span style={{ fontSize: 12, fontWeight: 700 }}> hPa</span></div>
                      <div className="wx-sm wx-dim">{Math.abs(pTrend) < 0.8 ? 'Sabit' : pTrend > 0 ? 'Yükseliyor' : 'Düşüyor: hava bozabilir'}</div>
                    </div>
                  </div>
                  <div className="wx-sm" style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Droplets size={13} /> Nem %{r0(cur.rh)}</span>
                    {h0 && <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Eye size={13} /> {h0.visibility >= 10000 ? '10+ km' : `${r1(h0.visibility / 1000)} km`}</span>}
                  </div>
                </Card>

                {/* Zararlı / hastalık (GDD) */}
                <Card icon={Bug} title="Zararlı ve hastalık takibi (sıcaklık toplamı)" className="wx-all">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
                    {d.gdd.map(a => (
                      <div key={a.id} style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                          <b style={{ fontSize: 14 }}>{a.pestName}</b>
                          <span className="wx-chip" style={{ background: a.riskLevel === 'YUKSEK' ? '#f87171' : a.riskLevel === 'ORTA' ? '#fbbf24' : '#34d399' }}>{a.riskLevel === 'YUKSEK' ? 'Yüksek' : a.riskLevel === 'ORTA' ? 'Orta' : 'Düşük'}</span>
                        </div>
                        <div className="wx-sm wx-dim">{a.crop} · {r0(a.accumulatedGdd)} / {a.thresholdGdd} gün-derece</div>
                        <div className="wx-track" style={{ margin: '6px 0' }}><div style={{ position: 'absolute', inset: 0, width: `${Math.min(100, (a.accumulatedGdd / a.thresholdGdd) * 100)}%`, borderRadius: 3, background: a.riskLevel === 'YUKSEK' ? '#f87171' : a.riskLevel === 'ORTA' ? '#fbbf24' : '#34d399' }} /></div>
                        <div className="wx-sm">{a.advice}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
              <p className="wx-sm wx-dim" style={{ textAlign: 'center', margin: '16px 0 0' }}>Veri: Open-Meteo · Radar: RainViewer · {loc.lat.toFixed(3)}, {loc.lon.toFixed(3)}</p>
            </>
          )}
        </div>
      </div>

      {/* Konum / parsel seçici */}
      {sheet && (
        <div className="wx-sheet" onClick={() => setSheet(false)}>
          <div onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <b style={{ fontSize: 17 }}>Konum veya parsel seç</b>
              <button type="button" className="wx-btn" onClick={() => setSheet(false)} aria-label="Kapat" style={{ padding: 0 }}><X size={18} /></button>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 15, opacity: 0.7 }} />
              <input className="wx-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Parsel veya çiftçi ara" />
            </div>
            <div style={{ overflowY: 'auto', minHeight: 0 }}>
              <button type="button" className="wx-item" onClick={useMyLocation} disabled={locating}>
                <LocateFixed size={18} color="#34d399" /> <span><b>Mevcut Konumum</b><br /><span className="wx-sm wx-dim">{locating ? 'Konum alınıyor…' : 'Bulunduğum tarla için'}</span></span>
              </button>
              <button type="button" className="wx-item" aria-current={loc.id === cityLoc.id} onClick={() => pickLoc(cityLoc)}>
                <Navigation size={18} /> <span><b>{cityLoc.name}</b><br /><span className="wx-sm wx-dim">Kayıtlı konum</span></span>
              </button>
              {parcels.length > 0 && <div className="wx-cap" style={{ margin: '10px 10px 4px' }}>Kayıtlı parseller ({parcels.length})</div>}
              {filtered.map(p => (
                <button key={p.id} type="button" className="wx-item" aria-current={loc.id === p.id} onClick={() => pickLoc(p)}>
                  <MapPin size={18} color="#34d399" /> <span style={{ minWidth: 0 }}><b>{p.name}</b><br /><span className="wx-sm wx-dim">{p.sub}</span></span>
                </button>
              ))}
              {parcels.length === 0 && <p className="wx-sm wx-dim" style={{ padding: '8px 10px' }}>Haritada sınırı çizilmiş parsel yok. Parsel Haritası'ndan tarla ekleyince burada görünür.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Tam ekran radar */}
      {fullRadar && cur && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 130 }}>
          <LiveRadarMap lat={loc.lat} lon={loc.lon} utcOffset={off} polygon={loc.polygon} windKmh={cur.wind} windDir={cur.windDir} onClose={() => setFullRadar(false)} />
        </div>
      )}
    </div>,
    document.body
  );
};

export default AgroWeatherScreen;

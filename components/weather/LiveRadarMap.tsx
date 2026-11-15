/**
 * LiveRadarMap — canlı yağış radarı, uydu bulut görüntüsü ve rüzgar akış çizgileri.
 * - RadarAnimator: çift tamponlu (dual-buffer) karo katmanı; sonraki kare önceden yüklenir, opaklık geçişiyle göz kırpmadan akar.
 * - MapRadarControl: aynı animatörü MKS ana parsel haritasına (react-leaflet) ekler.
 */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from 'react-leaflet';
import { Play, Pause, CloudRain, Satellite, Wind, Maximize2, X, Radar } from 'lucide-react';
import { fetchRadarIndex, radarTileUrl, RadarIndex, RADAR_MAX_NATIVE_ZOOM, hhmm } from '../../services/agroWeather';

export interface RadarState { ready: boolean; error: boolean; index: number; count: number; time: number; playing: boolean }

export class RadarAnimator {
  private front: L.TileLayer;
  private back: L.TileLayer;
  private idx: RadarIndex | null = null;
  private token = 0;
  private timer = 0;
  private loadTimeout = 0;
  private raf = 0;
  private dead = false;
  private visible = true;
  index = 0;
  playing = false;

  constructor(private map: L.Map, private onChange: (s: RadarState) => void, private opacity = 0.78) {
    if (!map.getPane('mksRadar')) { const pane = map.createPane('mksRadar'); pane.style.zIndex = '350'; pane.style.pointerEvents = 'none'; }
    const mk = () => L.tileLayer('', { pane: 'mksRadar', opacity: 0, maxNativeZoom: RADAR_MAX_NATIVE_ZOOM + 1, maxZoom: 19, tileSize: 512, zoomOffset: -1, updateWhenIdle: true, keepBuffer: 1, attribution: 'Radar &copy; RainViewer' });
    this.front = mk(); this.back = mk();
  }

  private emit(error = false) {
    const f = this.idx?.frames[this.index];
    this.onChange({ ready: !!this.idx && !!f, error, index: this.index, count: this.idx?.frames.length || 0, time: f?.time || 0, playing: this.playing });
  }

  async init(autoplay: boolean) {
    try {
      this.idx = await fetchRadarIndex();
      if (this.dead) return;
      if (!this.idx.frames.length) throw new Error('no frames');
      this.front.addTo(this.map); this.back.addTo(this.map);
      this.index = this.idx.frames.length - 1;
      this.front.setUrl(radarTileUrl(this.idx, this.idx.frames[this.index]));
      this.front.setOpacity(this.visible ? this.opacity : 0);
      this.emit();
      if (autoplay) this.play();
    } catch { if (!this.dead) this.emit(true); }
  }

  /** Arka tampona kareyi yükler; hazır olunca (ya da 1,4 sn sonra) geçişi başlatır. */
  private load(i: number, then: () => void) {
    if (!this.idx) return;
    const my = ++this.token;
    let done = false;
    window.clearTimeout(this.loadTimeout);
    const go = () => { if (done || my !== this.token || this.dead) return; done = true; window.clearTimeout(this.loadTimeout); this.back.off('load', go); then(); };
    this.back.setOpacity(0);
    this.back.once('load', go);
    this.back.setUrl(radarTileUrl(this.idx, this.idx.frames[i]));
    this.loadTimeout = window.setTimeout(go, 1400);
  }

  private fade(i: number, after?: () => void) {
    cancelAnimationFrame(this.raf);
    const start = performance.now(), target = this.visible ? this.opacity : 0;
    const step = (now: number) => {
      if (this.dead) return;
      const t = Math.min(1, (now - start) / 320);
      this.front.setOpacity(target * (1 - t)); this.back.setOpacity(target * t);
      if (t < 1) { this.raf = requestAnimationFrame(step); return; }
      const f = this.front; this.front = this.back; this.back = f;
      this.index = i; this.emit(); after?.();
    };
    this.raf = requestAnimationFrame(step);
  }

  show(i: number) {
    if (!this.idx) return;
    const n = this.idx.frames.length;
    const k = Math.max(0, Math.min(n - 1, i));
    if (k === this.index) return;
    this.load(k, () => this.fade(k));
  }

  private tick = () => {
    if (!this.playing || !this.idx || this.dead) return;
    const n = this.idx.frames.length, next = (this.index + 1) % n;
    this.load(next, () => this.fade(next, () => {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(this.tick, next === n - 1 ? 1600 : 450); // son karede (şimdi) biraz bekle
    }));
  };
  play() { if (this.playing || !this.idx) return; this.playing = true; this.emit(); this.tick(); }
  pause() { this.playing = false; window.clearTimeout(this.timer); this.emit(); }
  toggle() { if (this.playing) this.pause(); else this.play(); }

  setVisible(v: boolean) {
    this.visible = v;
    this.front.setOpacity(v ? this.opacity : 0); this.back.setOpacity(0);
    if (!v) this.pause();
  }

  destroy() {
    this.dead = true; this.playing = false; this.token++;
    window.clearTimeout(this.timer); window.clearTimeout(this.loadTimeout); cancelAnimationFrame(this.raf);
    this.back.off('load');
    this.front.remove(); this.back.remove();
  }
}

/** Rüzgar yönü ve hızıyla akan parçacık çizgileri (ilaç sürüklenme yönünü görmek için). */
export function attachWindLayer(container: HTMLElement, getWind: () => { kmh: number; dir: number }) {
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '450', pointerEvents: 'none', display: 'none' } as CSSStyleDeclaration);
  container.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let W = 0, H = 0, raf = 0, last = 0, t = 0, on = false, shown = true;
  let parts: Array<{ x: number; y: number; age: number; life: number }> = [];
  const seedOne = (p: { x: number; y: number; age: number; life: number }) => { p.x = Math.random() * W; p.y = Math.random() * H; p.age = 0; p.life = 1.5 + Math.random() * 3; return p; };
  const resize = () => {
    const r = container.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const n = Math.round(Math.min(240, Math.max(60, (W * H) / 5200)));
    parts = Array.from({ length: n }, () => seedOne({ x: 0, y: 0, age: 0, life: 0 }));
    if (on && reduced) drawStatic();
  };
  // Hareket azaltma açıkken: akış yönünü gösteren sabit çizgiler
  const drawStatic = () => {
    const { kmh, dir } = getWind();
    const rad = (dir * Math.PI) / 180, len = Math.min(46, 12 + kmh * 1.4);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.25; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const p of parts) { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.sin(rad) * len, p.y + Math.cos(rad) * len); }
    ctx.stroke();
  };
  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; t += dt;
    const { kmh, dir } = getWind();
    const rad = (dir * Math.PI) / 180, speed = Math.min(240, 18 + kmh * 5);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.085)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,0.78)'; ctx.lineWidth = 1.25; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const p of parts) {
      const wob = 0.28 * Math.sin(p.x * 0.008 + p.y * 0.006 + t * 0.35);
      const vx = -Math.sin(rad + wob) * speed, vy = Math.cos(rad + wob) * speed;
      const nx = p.x + vx * dt, ny = p.y + vy * dt;
      ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny);
      p.x = nx; p.y = ny; p.age += dt;
      if (p.age > p.life || nx < -10 || nx > W + 10 || ny < -10 || ny > H + 10) seedOne(p);
    }
    ctx.stroke();
    if (on && shown && !reduced) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf && on && shown && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const onVis = () => { shown = document.visibilityState === 'visible'; if (shown) kick(); else stop(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(resize); ro.observe(container);
  resize();
  return {
    setVisible(v: boolean) {
      on = v; cv.style.display = v ? 'block' : 'none';
      if (!v) { stop(); return; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      if (reduced) drawStatic(); else kick();
    },
    destroy() { stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); cv.remove(); }
  };
}

type LayerId = 'radar' | 'cloud' | 'wind';
const gibsUrl = () => {
  const d = new Date(Date.now() - 30 * 3600 * 1000).toISOString().slice(0, 10); // dünün tamamlanmış uydu geçişi
  return { date: d, url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg` };
};
const glass: React.CSSProperties = { background: 'rgba(12,18,32,0.62)', backdropFilter: 'blur(22px) saturate(170%)', WebkitBackdropFilter: 'blur(22px) saturate(170%)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff' };

export interface LiveRadarMapProps {
  lat: number; lon: number; utcOffset: number;
  polygon?: Array<{ lat: number; lng: number }>;
  windKmh: number; windDir: number;
  compact?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

export const LiveRadarMap: React.FC<LiveRadarMapProps> = ({ lat, lon, utcOffset, polygon, windKmh, windDir, compact, onExpand, onClose }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const animRef = useRef<RadarAnimator | null>(null);
  const windRef = useRef<ReturnType<typeof attachWindLayer> | null>(null);
  const cloudRef = useRef<L.TileLayer | null>(null);
  const shapeRef = useRef<L.LayerGroup | null>(null);
  const wind = useRef({ kmh: windKmh, dir: windDir });
  wind.current = { kmh: windKmh, dir: windDir };
  const [st, setSt] = useState<RadarState>({ ready: false, error: false, index: 0, count: 0, time: 0, playing: false });
  const [layer, setLayer] = useState<LayerId>('radar');

  useEffect(() => {
    const box = boxRef.current!;
    const map = L.map(box, {
      zoomControl: false, attributionControl: !compact, dragging: !compact, scrollWheelZoom: !compact, doubleClickZoom: !compact,
      touchZoom: !compact, boxZoom: false, keyboard: false, minZoom: 4, maxZoom: 13
    }).setView([lat, lon], compact ? 7 : 8);
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
    L.tileLayer(`${esri}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 16, maxZoom: 19, attribution: 'Tiles &copy; Esri' }).addTo(map);
    if (!map.getPane('mksLabels')) { const lp = map.createPane('mksLabels'); lp.style.zIndex = '380'; lp.style.pointerEvents = 'none'; }
    L.tileLayer(`${esri}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { pane: 'mksLabels', maxNativeZoom: 16, maxZoom: 19, opacity: 0.9 }).addTo(map);
    mapRef.current = map;
    shapeRef.current = L.layerGroup().addTo(map);
    const anim = new RadarAnimator(map, setSt);
    animRef.current = anim;
    void anim.init(true);
    windRef.current = attachWindLayer(box, () => wind.current);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(box);
    return () => { ro.disconnect(); anim.destroy(); windRef.current?.destroy(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parsel sınırı ve konum işareti
  useEffect(() => {
    const map = mapRef.current, group = shapeRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (polygon && polygon.length >= 3) L.polygon(polygon.map(p => [p.lat, p.lng] as [number, number]), { color: '#34d399', weight: 2.5, fillColor: '#34d399', fillOpacity: 0.18 }).addTo(group);
    L.circleMarker([lat, lon], { radius: 13, color: '#34d399', weight: 1, opacity: 0.6, fillColor: '#34d399', fillOpacity: 0.18 }).addTo(group);
    L.circleMarker([lat, lon], { radius: 5, color: '#fff', weight: 2, fillColor: '#10b981', fillOpacity: 1 }).addTo(group);
    map.setView([lat, lon], map.getZoom(), { animate: false });
  }, [lat, lon, polygon]);

  // Katman seçimi
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    animRef.current?.setVisible(layer !== 'cloud');
    if (layer !== 'cloud' && !animRef.current?.playing) animRef.current?.play();
    windRef.current?.setVisible(layer === 'wind');
    if (layer === 'cloud') {
      if (!cloudRef.current) cloudRef.current = L.tileLayer(gibsUrl().url, { maxNativeZoom: 9, maxZoom: 19, opacity: 0.92, attribution: 'Uydu: NASA GIBS / VIIRS' });
      cloudRef.current.addTo(map);
    } else cloudRef.current?.remove();
  }, [layer]);

  const isLive = st.count > 0 && st.index === st.count - 1;
  const ago = st.time ? Math.max(0, Math.round((Date.now() / 1000 - st.time) / 60)) : 0;
  const badge = layer === 'cloud' ? `Uydu · ${gibsUrl().date.split('-').reverse().join('.')}` : st.error ? 'Radar alınamadı' : !st.ready ? 'Radar yükleniyor…' : `${hhmm(st.time, utcOffset)}${isLive ? ' · Şimdi' : ` · ${ago} dk önce`}`;
  const layers: Array<[LayerId, string, React.ElementType]> = [['radar', 'Yağış Radarı', CloudRain], ['cloud', 'Uydu Bulut', Satellite], ['wind', 'Rüzgar Akışı', Wind]];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: compact ? 16 : 0, background: '#0b1220' }}>
      <div ref={boxRef} style={{ position: 'absolute', inset: 0 }} />
      {compact ? (
        <button type="button" onClick={onExpand} aria-label="Radarı tam ekran aç" style={{ position: 'absolute', inset: 0, zIndex: 500, background: 'transparent', border: 0, cursor: 'pointer' }}>
          <span style={{ ...glass, position: 'absolute', left: 10, bottom: 10, padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{badge}</span>
          <span style={{ ...glass, position: 'absolute', right: 10, top: 10, width: 36, height: 36, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Maximize2 size={16} /></span>
        </button>
      ) : (
        <>
          <div style={{ position: 'absolute', zIndex: 500, top: 'max(12px, env(safe-area-inset-top))', left: 12, right: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ ...glass, flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: 4, borderRadius: 16 }}>
              {layers.map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => setLayer(id)} aria-pressed={layer === id}
                  style={{ minHeight: 40, borderRadius: 12, border: 0, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#fff', background: layer === id ? 'rgba(255,255,255,0.24)' : 'transparent' }}>
                  <Icon size={14} /> <span>{label}</span>
                </button>
              ))}
            </div>
            {onClose && (
              <button type="button" onClick={onClose} aria-label="Kapat" style={{ ...glass, width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={20} /></button>
            )}
          </div>
          <div style={{ ...glass, position: 'absolute', zIndex: 500, left: 12, right: 12, bottom: 'max(14px, env(safe-area-inset-bottom))', borderRadius: 20, padding: '10px 12px' }}>
            {layer === 'cloud' ? (
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>{badge} · gerçek renkli günlük uydu görüntüsü (NASA). Canlı değildir; bulut dağılımını genel olarak gösterir.</p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={() => animRef.current?.toggle()} disabled={!st.ready} aria-label={st.playing ? 'Durdur' : 'Oynat'}
                    style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 14, border: 0, cursor: 'pointer', background: 'rgba(255,255,255,0.22)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {st.playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <input type="range" min={0} max={Math.max(0, st.count - 1)} value={st.index} disabled={!st.ready} aria-label="Radar zamanı"
                    onChange={e => { animRef.current?.pause(); animRef.current?.show(Number(e.target.value)); }} style={{ flex: 1, minWidth: 0, accentColor: '#34d399', height: 28 }} />
                  <span style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', background: isLive ? 'rgba(16,185,129,0.9)' : 'rgba(255,255,255,0.18)' }}>{badge}</span>
                </div>
                <p style={{ margin: '6px 2px 0', fontSize: 11, opacity: 0.8 }}>
                  {layer === 'wind' ? `Çizgiler rüzgarın gittiği yönü gösterir: ${Math.round(windKmh)} km/s. İlaç bu yöne sürüklenir.` : 'Son 2 saatin gerçek radar ölçümü. Sonraki saat tahmini üstteki yağış kartındadır.'}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/** MKS ana parsel haritası için radar düğmesi (MapContainer içine konur). */
export const MapRadarControl: React.FC = () => {
  const map = useMap();
  const boxRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<RadarAnimator | null>(null);
  const [on, setOn] = useState(false);
  const [st, setSt] = useState<RadarState>({ ready: false, error: false, index: 0, count: 0, time: 0, playing: false });

  useEffect(() => { if (boxRef.current) { L.DomEvent.disableClickPropagation(boxRef.current); L.DomEvent.disableScrollPropagation(boxRef.current); } }, []);
  useEffect(() => {
    if (!on) return;
    const anim = new RadarAnimator(map, setSt, 0.7);
    animRef.current = anim;
    void anim.init(true);
    return () => { anim.destroy(); animRef.current = null; setSt(s => ({ ...s, ready: false, playing: false })); };
  }, [on, map]);

  const d = st.time ? new Date(st.time * 1000) : null;
  const label = st.error ? 'Radar alınamadı' : !st.ready || !d ? 'Yükleniyor…' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}${st.index === st.count - 1 ? ' · Şimdi' : ''}`;
  return (
    <div ref={boxRef} style={{ position: 'absolute', zIndex: 1000, left: 12, top: '42%', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={() => setOn(v => !v)} aria-pressed={on} title="Canlı yağış radarı"
        style={{ ...glass, width: 44, height: 44, borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'rgba(16,185,129,0.92)' : glass.background }}>
        <Radar size={19} />
      </button>
      {on && (
        <div style={{ ...glass, height: 44, borderRadius: 14, padding: '0 6px 0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button type="button" onClick={() => animRef.current?.toggle()} disabled={!st.ready} aria-label={st.playing ? 'Durdur' : 'Oynat'}
            style={{ width: 36, height: 36, borderRadius: 10, border: 0, cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {st.playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', paddingRight: 6 }}>{label}</span>
        </div>
      )}
    </div>
  );
};

export default LiveRadarMap;

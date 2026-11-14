/**
 * AtmosphericStage — gerçek hava verisine bağlı canlı gökyüzü.
 * Katmanlar (arkadan öne): gökyüzü gradyanı → yıldız/ay/güneş (Canvas 2D) → FBM bulutlar (WebGL, yoksa Canvas) → yağış + sıçrama + şimşek (Canvas 2D)
 * Video/GIF yok. Görünmeyince tamamen durur; kare hızı düşerse kaliteyi kendisi kademelendirir.
 */
import React, { useEffect, useRef } from 'react';
import { solarElevation, moonPhase, isSnow, isThunder, isHail, isWet } from '../../services/agroWeather';

export interface AtmosphericStageProps {
  lat: number; lon: number;
  code: number; cloud: number; windKmh: number; windDir: number; precip: number;
  /** Yağmurun çarpacağı kartların seçicisi */
  cardSelector?: string;
  scrollRoot?: React.RefObject<HTMLElement>;
}

type RGB = [number, number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const css = (c: RGB) => `rgb(${c.map(v => Math.round(v)).join(',')})`;

// Güneş açısına göre gökyüzü durakları: [açı, üst, orta, alt]
const SKY: Array<[number, RGB, RGB, RGB]> = [
  [-18, [4, 8, 22], [8, 14, 40], [14, 24, 58]],
  [-8, [10, 18, 48], [28, 34, 78], [70, 58, 98]],
  [-2, [24, 40, 92], [120, 84, 120], [236, 140, 92]],
  [3, [52, 92, 160], [226, 150, 110], [250, 196, 128]],
  [10, [44, 112, 200], [120, 170, 224], [214, 214, 208]],
  [25, [28, 104, 214], [72, 150, 232], [150, 200, 244]]
];

export function skyFor(elev: number, cloud: number, code: number) {
  let i = 0;
  while (i < SKY.length - 2 && elev > SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1];
  const t = clamp01((elev - a[0]) / (b[0] - a[0]));
  let top = mix3(a[1], b[1], t), mid = mix3(a[2], b[2], t), bot = mix3(a[3], b[3], t);
  const light = sstep(-6, 12, elev);
  const storm = isThunder(code) ? 1 : isWet(code) ? 0.55 : 0;
  const g = clamp01((cloud / 100) * 0.78 + storm * 0.2);
  const k = lerp(0.2, 1, light) * lerp(1, 0.55, storm);
  top = mix3(top, [86 * k, 96 * k, 114 * k], g);
  mid = mix3(mid, [118 * k, 128 * k, 146 * k], g);
  bot = mix3(bot, [150 * k, 158 * k, 172 * k], g);
  // Gün doğumu / batımı: bulut rengi sıcak tona kayar
  const golden = sstep(-4, 2, elev) * (1 - sstep(4, 14, elev)) * (1 - g * 0.7);
  const tint: RGB = mix3([1, 1, 1], [1, 0.74, 0.56], golden);
  return { gradient: `linear-gradient(180deg, ${css(top)} 0%, ${css(mid)} 55%, ${css(bot)} 100%)`, light, storm, tint };
}

const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res; uniform float u_time; uniform float u_scroll; uniform float u_cover; uniform float u_dark; uniform float u_light; uniform vec3 u_tint; uniform int u_oct;
float hash(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { if (i >= u_oct) break; v += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * u_res.x / u_res.y, uv.y);
  vec2 q1 = p * vec2(1.5, 2.6) + vec2(u_scroll, u_time * 0.008);
  vec2 q2 = p * vec2(2.9, 4.6) + vec2(u_scroll * 1.7 + 40.0, -u_time * 0.012);
  float n1 = fbm(q1 + fbm(q1 * 0.5 + 3.0) * 0.55);
  float n2 = fbm(q2);
  float thr = mix(0.74, 0.26, u_cover);
  float d1 = smoothstep(thr, thr + 0.26, n1);
  float d2 = smoothstep(thr + 0.04, thr + 0.30, n2) * 0.5;
  float vfade = mix(smoothstep(0.10, 0.80, uv.y), 1.0, u_cover * 0.85);
  float dens = clamp(d1 + d2 * (1.0 - d1), 0.0, 1.0) * vfade;
  float body = fbm(q1 + vec2(0.0, -0.10));
  float shade = mix(1.0, 0.58, smoothstep(0.30, 0.75, body) * (0.35 + 0.65 * u_cover));
  vec3 col = mix(vec3(0.13, 0.15, 0.22), vec3(1.0), u_light) * u_tint * shade;
  col = mix(col, col * vec3(0.32, 0.35, 0.44), u_dark);
  float alpha = dens * mix(0.50, 0.94, u_cover);
  gl_FragColor = vec4(col * alpha, alpha);
}`;

interface Drop { x: number; y: number; vy: number; len: number; kind: 0 | 1 | 2; ph: number; bounced: boolean }
interface Splash { x: number; y: number; vx: number; vy: number; life: number }

export const AtmosphericStage: React.FC<AtmosphericStageProps> = (props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const celRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const p = useRef(props);
  p.current = props;

  useEffect(() => {
    const root = rootRef.current!, sky = skyRef.current!, cel = celRef.current!, glc = glRef.current!, fx = fxRef.current!;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const celCtx = cel.getContext('2d')!, fxCtx = fx.getContext('2d')!;
    let W = 0, H = 0;
    let quality = 0; // 0 yüksek, 1 orta, 2 düşük
    const cloudScale = () => [0.5, 0.38, 0.28][quality];
    let rectsDirty = true, lastRects = 0, celDirty = true, lastCel = 0, lastSky = '';

    // ---- WebGL bulutlar
    let gl: WebGLRenderingContext | null = null;
    const uni: Record<string, WebGLUniformLocation | null> = {};
    try {
      gl = glc.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' }) as WebGLRenderingContext | null;
      if (gl) {
        const g = gl;
        const sh = (type: number, src: string) => { const s = g.createShader(type)!; g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error('shader'); return s; };
        const prog = g.createProgram()!;
        g.attachShader(prog, sh(g.VERTEX_SHADER, VERT)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, FRAG)); g.linkProgram(prog);
        if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error('link');
        g.useProgram(prog);
        const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
        g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
        const loc = g.getAttribLocation(prog, 'a'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
        for (const k of ['u_res', 'u_time', 'u_scroll', 'u_cover', 'u_dark', 'u_light', 'u_tint', 'u_oct']) uni[k] = g.getUniformLocation(prog, k);
      }
    } catch { gl = null; }
    if (!gl) glc.style.display = 'none';

    const resize = () => {
      const r = root.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      for (const c of [cel, fx]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      glc.width = Math.max(2, Math.round(W * dpr * cloudScale())); glc.height = Math.max(2, Math.round(H * dpr * cloudScale()));
      gl?.viewport(0, 0, glc.width, glc.height);
      rectsDirty = true; celDirty = true;
    };

    // ---- Kart kenarları (yağmur çarpışması)
    let rects: Array<{ l: number; r: number; t: number }> = [];
    const refreshRects = () => {
      const base = root.getBoundingClientRect();
      const scope: ParentNode = p.current.scrollRoot?.current || document;
      rects = Array.from(scope.querySelectorAll(p.current.cardSelector || '.weather-glass-card')).map(el => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return { l: r.left - base.left, r: r.right - base.left, t: r.top - base.top };
      }).filter(r => r.t > 4 && r.t < H - 2 && r.r > 0 && r.l < W);
      rectsDirty = false; lastRects = performance.now();
    };
    const onScroll = () => { rectsDirty = true; };
    const scrollEl = p.current.scrollRoot?.current;
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });

    // ---- Yıldızlar (sabit tohum)
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const stars = Array.from({ length: 110 }, () => ({ x: rnd(), y: rnd() * 0.75, r: 0.4 + rnd() * 1.1, ph: rnd() * 6.28, sp: 0.6 + rnd() * 1.8 }));
    const blobs = Array.from({ length: 9 }, (_, i) => ({ x: rnd(), y: 0.04 + rnd() * 0.42, r: 0.16 + rnd() * 0.2, sp: 0.5 + (i % 3) * 0.35 }));

    let env = skyFor(10, 0, 0), elev = 10;
    const updateEnv = () => {
      const c = p.current;
      elev = solarElevation(c.lat, c.lon);
      env = skyFor(elev, c.cloud, c.code);
      if (env.gradient !== lastSky) { sky.style.background = env.gradient; lastSky = env.gradient; }
    };

    const drawCelestial = (time: number, scroll: number) => {
      const c = p.current, ctx = celCtx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const clear = 1 - clamp01(c.cloud / 100) * 0.85;
      const night = 1 - env.light;
      if (night > 0.35) {
        const a = ((night - 0.35) / 0.65) * clear;
        ctx.fillStyle = '#fff';
        for (const s of stars) {
          ctx.globalAlpha = a * (0.45 + 0.55 * Math.sin(time * s.sp + s.ph) ** 2);
          ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283); ctx.fill();
        }
        // Ay: gerçek evreye göre aydınlık oranı
        const ph = moonPhase(), mx = W * 0.78, my = H * 0.13, mr = Math.min(W, H) * 0.045;
        const lit = (1 - Math.cos(ph * 2 * Math.PI)) / 2;
        ctx.globalAlpha = a * (0.25 + 0.75 * lit);
        const halo = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 5);
        halo.addColorStop(0, 'rgba(210,225,255,0.35)'); halo.addColorStop(1, 'rgba(210,225,255,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, mr * 5, 0, 6.283); ctx.fill();
        ctx.globalAlpha = a * 0.95;
        ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.clip();
        ctx.fillStyle = 'rgba(120,135,170,0.35)'; ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
        ctx.fillStyle = '#eef3ff';
        const off = (ph < 0.5 ? -1 : 1) * (1 - lit) * 2 * mr; // karanlık kısım kaydırılmış disk ile bırakılır
        ctx.beginPath(); ctx.arc(mx - off, my, mr * (1 + Math.abs(off) / (mr * 4)), 0, 6.283); ctx.fill();
        ctx.restore();
      }
      if (elev > -2 && clear > 0.25) {
        // Güneş tacı ve ışık huzmeleri
        const a = clear * sstep(-2, 6, elev);
        const sx = W * 0.74, sy = H * lerp(0.34, 0.07, clamp01(elev / 60)), R = Math.max(W, H) * 0.55;
        const warm = 1 - sstep(4, 16, elev);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
        g.addColorStop(0, `rgba(255,${Math.round(lerp(250, 214, warm))},${Math.round(lerp(225, 150, warm))},${0.95 * a})`);
        g.addColorStop(0.06, `rgba(255,${Math.round(lerp(240, 190, warm))},${Math.round(lerp(190, 120, warm))},${0.5 * a})`);
        g.addColorStop(0.3, `rgba(255,230,180,${0.14 * a})`); g.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(time * 0.02);
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          const rg = ctx.createLinearGradient(0, 0, R * 0.8, 0);
          rg.addColorStop(0, `rgba(255,245,215,${0.1 * a})`); rg.addColorStop(1, 'rgba(255,245,215,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 0.8, -R * 0.035); ctx.lineTo(R * 0.8, R * 0.035); ctx.fill();
        }
        ctx.restore();
      }
      if (!gl) {
        // WebGL yoksa: yumuşak katmanlı bulutlar
        const cover = clamp01(c.cloud / 100);
        const shade = Math.round(lerp(60, 255, env.light) * lerp(1, 0.45, env.storm));
        for (const b of blobs) {
          const x = ((((b.x - scroll * 0.12 * b.sp) % 1.4) + 1.4) % 1.4) - 0.2;
          const r = b.r * W * (0.7 + cover);
          const g = ctx.createRadialGradient(x * W, b.y * H, 0, x * W, b.y * H, r);
          g.addColorStop(0, `rgba(${shade},${shade},${Math.min(255, shade + 8)},${0.5 * cover + 0.08})`); g.addColorStop(1, `rgba(${shade},${shade},${shade},0)`);
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(x * W - r, b.y * H - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
    };

    const drawClouds = (time: number, scroll: number) => {
      if (!gl) return;
      const c = p.current;
      gl.uniform2f(uni.u_res, glc.width, glc.height);
      gl.uniform1f(uni.u_time, time); gl.uniform1f(uni.u_scroll, scroll);
      gl.uniform1f(uni.u_cover, clamp01(c.cloud / 100)); gl.uniform1f(uni.u_dark, env.storm * clamp01(c.cloud / 70));
      gl.uniform1f(uni.u_light, env.light); gl.uniform3f(uni.u_tint, env.tint[0], env.tint[1], env.tint[2]);
      gl.uniform1i(uni.u_oct, [5, 4, 3][quality]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // ---- Yağış fiziği
    const drops: Drop[] = [];
    const splashes: Splash[] = [];
    let flash = 0, nextFlash = 3 + Math.random() * 5, flashX = 0.5;
    const targetCount = () => {
      const c = p.current, code = c.code;
      if (!isWet(code) && c.precip < 0.1) return 0;
      let base = isSnow(code) ? (code >= 75 ? 220 : code >= 73 ? 150 : 90)
        : isThunder(code) ? 320 : code === 65 || code === 82 || code === 67 ? 300 : code === 63 || code === 81 || code === 80 ? 210 : code >= 61 ? 140 : 80;
      base += Math.min(120, c.precip * 40);
      return Math.round(base * [1, 0.6, 0.35][quality] * Math.min(2, Math.max(0.6, (W * H) / 320000)));
    };
    const slant = () => {
      const c = p.current;
      return -Math.sin((c.windDir * Math.PI) / 180) * Math.tan((Math.min(38, c.windKmh * 1.4) * Math.PI) / 180);
    };
    const spawn = (d: Drop | null, top: boolean): Drop => {
      const c = p.current;
      const snow = isSnow(c.code), hail = !snow && isHail(c.code) && Math.random() < 0.12;
      const o = d || ({} as Drop);
      o.kind = snow ? 1 : hail ? 2 : 0;
      o.x = Math.random() * (W + 200) - 100; o.y = top ? -20 - Math.random() * 60 : Math.random() * H;
      o.vy = snow ? 50 + Math.random() * 70 : hail ? 900 + Math.random() * 300 : 820 + Math.random() * 520;
      o.len = snow ? 1.2 + Math.random() * 2 : hail ? 2 + Math.random() * 1.6 : 10 + Math.random() * 16;
      o.ph = Math.random() * 6.28; o.bounced = false;
      return o;
    };
    const drawPrecip = (dt: number, time: number) => {
      const ctx = fxCtx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const want = targetCount();
      while (drops.length < want) drops.push(spawn(null, false));
      if (drops.length > want) drops.length = want;
      const sl = slant();
      ctx.strokeStyle = `rgba(214,228,255,${lerp(0.5, 0.62, env.light)})`; ctx.lineWidth = 1.15; ctx.lineCap = 'round';
      ctx.beginPath(); // tüm yağmur çizgileri tek path
      for (const d of drops) {
        const py = d.y;
        const vx = d.kind === 1 ? sl * 90 + Math.sin(time * 1.3 + d.ph) * 22 : sl * Math.abs(d.vy);
        d.y += d.vy * dt; d.x += vx * dt;
        if (d.kind === 2 && d.bounced) d.vy += 2600 * dt;
        let hit = false;
        if (d.vy > 0) {
          for (const r of rects) {
            if (d.x >= r.l && d.x <= r.r && py <= r.t && d.y >= r.t) {
              if (d.kind === 2 && !d.bounced) { d.bounced = true; d.y = r.t - 1; d.vy = -d.vy * 0.28; }
              else {
                hit = true;
                if (splashes.length < 260) {
                  const k = d.kind === 1 ? 1 : 3;
                  for (let i = 0; i < k; i++) splashes.push({ x: d.x, y: r.t, vx: (Math.random() - 0.5) * 150 + sl * 60, vy: -60 - Math.random() * 130, life: 0.28 + Math.random() * 0.2 });
                }
              }
              break;
            }
          }
        }
        if (hit || d.y > H + 30 || d.x < -140 || d.x > W + 140) { spawn(d, true); continue; }
        if (d.kind === 0) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - sl * d.len, d.y - d.len); }
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      for (const d of drops) if (d.kind !== 0) { ctx.beginPath(); ctx.arc(d.x, d.y, d.len, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = 'rgba(225,236,255,0.8)'; // sıçramalar
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.life -= dt;
        if (s.life <= 0) { splashes[i] = splashes[splashes.length - 1]; splashes.pop(); continue; }
        s.vy += 620 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.globalAlpha = Math.min(1, s.life * 4);
        ctx.fillRect(s.x, s.y, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
      if (isThunder(p.current.code)) {
        // şimşek: bulut içinden yayılan çift çakma
        nextFlash -= dt;
        if (nextFlash <= 0) { flash = 1; flashX = 0.15 + Math.random() * 0.7; nextFlash = 3.5 + Math.random() * 7; }
        if (flash > 0) {
          flash -= dt * 2.6;
          const f = Math.max(0, flash);
          const a = (f > 0.72 ? 1 : f > 0.5 ? 0.25 : f > 0.34 ? 0.8 : f * 1.6) * 0.5;
          const g = ctx.createRadialGradient(W * flashX, H * 0.12, 0, W * flashX, H * 0.12, Math.max(W, H) * 0.9);
          g.addColorStop(0, `rgba(236,240,255,${a})`); g.addColorStop(0.35, `rgba(190,205,255,${a * 0.45})`); g.addColorStop(1, 'rgba(190,205,255,0)');
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
        }
      }
    };

    // ---- Döngü: görünürlük + adaptif kalite
    let raf = 0, last = 0, time = 0, scroll = 0, visible = document.visibilityState === 'visible', onScreen = true, lastEnv = 0;
    let frames = 0, acc = 0, slowStreak = 0;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now; time += dt;
      const c = p.current;
      scroll += dt * (0.006 + (Math.min(60, c.windKmh) / 60) * 0.05) * (Math.sin((c.windDir * Math.PI) / 180) >= 0 ? 1 : -1);
      if (!lastEnv || now - lastEnv > 5000) { updateEnv(); lastEnv = now; celDirty = true; }
      if (rectsDirty || now - lastRects > 500) refreshRects();
      if (celDirty || now - lastCel > 110) { drawCelestial(time, scroll); lastCel = now; celDirty = false; }
      drawClouds(time, scroll);
      drawPrecip(dt, time);
      frames++; acc += dt; // kare hızı izleyici: 40 FPS altı sürerse kaliteyi düşür
      if (acc >= 2) {
        const fps = frames / acc; frames = 0; acc = 0;
        slowStreak = fps < 40 ? slowStreak + 1 : 0;
        if (slowStreak >= 2 && quality < 2) { quality++; slowStreak = 0; resize(); }
      }
      if (visible && onScreen && !reduced) raf = requestAnimationFrame(frame);
    };
    const staticFrame = () => { updateEnv(); drawCelestial(0, 0); drawClouds(0, 0); };
    const kick = () => { if (!raf && visible && onScreen && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) kick(); else stop(); };
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(es => { onScreen = es[0]?.isIntersecting ?? true; if (onScreen) kick(); else stop(); });
    io.observe(root);
    const ro = new ResizeObserver(() => { resize(); if (reduced) staticFrame(); });
    ro.observe(root);
    resize();
    if (reduced) staticFrame(); else kick();
    const poke = reduced ? window.setInterval(staticFrame, 60000) : 0;

    return () => {
      stop(); if (poke) window.clearInterval(poke); io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scrollEl?.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layer: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' };
  return (
    <div ref={rootRef} aria-hidden="true" style={{ ...layer, overflow: 'hidden' }}>
      <div ref={skyRef} style={{ ...layer, transition: 'background 1.2s ease' }} />
      <canvas ref={celRef} style={layer} />
      <canvas ref={glRef} style={layer} />
      <canvas ref={fxRef} style={layer} />
    </div>
  );
};

export default AtmosphericStage;

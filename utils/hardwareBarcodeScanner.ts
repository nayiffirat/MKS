import { useEffect, useRef } from 'react';
import { parseGS1Barcode, GS, GS1ParseResult } from './gs1Parser';

export const HARDWARE_BARCODE_EVENT = 'mks-hardware-barcode';

/**
 * Keyboard-wedge timing. USB guns type ~5-30ms/char, Bluetooth / Android terminals
 * often 40-80ms/char; humans are ~100ms+.
 */
const MAX_AVG_INTERVAL_MS = 85;
const RESET_GAP_MS = 160;       // a pause longer than this starts a new buffer
const MIN_LENGTH = 6;
const MIN_LENGTH_IN_INPUT = 8;  // stricter inside text fields so fast typists are not hijacked

/** Inputs that intentionally receive scans keep the text (e.g. barcode fields). */
export const SCAN_TARGET_ATTR = 'data-barcode-input';

let refCount = 0;
let detach: (() => void) | null = null;
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = audioCtx ?? new Ctor();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freq: number, startOffset: number, duration: number, type: OscillatorType, peak: number): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

/** Short pleasant POS beep (880Hz, 90ms) via one shared AudioContext. Silently no-ops if unavailable. */
export function playScanBeep(): void {
  try {
    tone(880, 0, 0.09, 'sine', 0.25);
  } catch {
    /* audio is best-effort */
  }
}

/** Low double "buzz" for not-found / duplicate / expired scans (shares the same AudioContext). */
export function playErrorBeep(): void {
  try {
    tone(220, 0, 0.12, 'square', 0.12);
    tone(180, 0.16, 0.16, 'square', 0.12);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([60, 40, 60]);
  } catch {
    /* audio is best-effort */
  }
}

function isEditable(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

// US-layout reconstruction for non alphanumeric keys (scanners emit US HID codes by default).
const US_SYMBOLS: Record<string, [string, string]> = {
  Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'],
  Backslash: ['\\', '|'], IntlBackslash: ['\\', '|'], Semicolon: [';', ':'], Quote: ["'", '"'],
  Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], Backquote: ['`', '~'], Space: [' ', ' '],
};
const US_SHIFT_DIGITS = [')', '!', '@', '#', '$', '%', '^', '&', '*', '('];
const NUMPAD: Record<string, string> = {
  NumpadDecimal: '.', NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/', NumpadComma: ',',
};

export type ScannerLayout = 'US' | 'NATIVE';
const LAYOUT_KEY = 'mks_scanner_layout';

/** 'US' (default): rebuild every character from `e.code`. 'NATIVE': trust `e.key` except Turkish letters. */
export function getHardwareScannerLayout(): ScannerLayout {
  try { return localStorage.getItem(LAYOUT_KEY) === 'NATIVE' ? 'NATIVE' : 'US'; } catch { return 'US'; }
}
export function setHardwareScannerLayout(layout: ScannerLayout): void {
  try { localStorage.setItem(LAYOUT_KEY, layout); } catch (e) { console.warn('[scanner] layout persist failed', e); }
}

/**
 * Reconstructs the ASCII character the scanner intended from the physical key (`e.code`) and
 * Shift state, so Turkish Q layouts (ı/İ/i/I, ş, ç …) and CapsLock never corrupt GS1 Lot/Seri text.
 */
export function charFromKeyEvent(e: KeyboardEvent, layout: ScannerLayout = 'US'): string | null {
  if (e.metaKey) return null;
  const code = e.code || '';
  const shift = e.shiftKey;
  if (/^Key[A-Z]$/.test(code)) {
    const letter = code.slice(3);
    return shift ? letter : letter.toLowerCase();
  }
  if (/^Digit\d$/.test(code)) {
    const d = Number(code.slice(5));
    if (!shift) return String(d);
    return layout === 'US' ? US_SHIFT_DIGITS[d] : (e.key.length === 1 ? e.key : null);
  }
  if (/^Numpad\d$/.test(code)) return code.slice(6);
  if (NUMPAD[code]) return NUMPAD[code];
  if (layout === 'US' && US_SYMBOLS[code]) return US_SYMBOLS[code][shift ? 1 : 0];
  if (e.key && e.key.length === 1) {
    // Map stray Turkish letters to ASCII (GS1 character set is ASCII only)
    const tr: Record<string, string> = { 'ı': 'i', 'İ': 'I', 'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', 'ç': 'c', 'Ç': 'C', 'ö': 'o', 'Ö': 'O', 'ü': 'u', 'Ü': 'U' };
    return tr[e.key] ?? e.key;
  }
  return null;
}

/** Sets a React-controlled input's value and notifies React (native setter + input event). */
function restoreInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  try {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (err) {
    console.warn('[scanner] could not restore input value', err);
  }
}

/**
 * Installs one global keydown listener (ref-counted). Returns a cleanup function.
 * Keyboard-wedge scanners type fast and end with Enter/Tab; human typing is ignored by timing.
 * When a burst lands inside a normal text field, the burst is stripped from that field and
 * Enter/Tab is cancelled so forms are not submitted. Fields marked `data-barcode-input="true"`
 * keep the scanned text and handle it themselves (no global event is dispatched for them).
 */
export function initHardwareBarcodeScanner(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  refCount++;
  if (!detach) {
    let buffer = '';
    let firstTs = 0;
    let lastTs = 0;
    let burstTarget: HTMLInputElement | HTMLTextAreaElement | null = null;
    let valueBefore = '';
    let layout: ScannerLayout = getHardwareScannerLayout();

    const reset = () => { buffer = ''; burstTarget = null; valueBefore = ''; };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const now = performance.now();
      if (buffer && now - lastTs > RESET_GAP_MS) reset();

      // Market tipi USB / Bluetooth / el terminali okuyucular Enter veya Tab ile bitirir.
      if (e.key === 'Enter' || e.key === 'NumpadEnter' || (e.key === 'Tab' && buffer.length >= MIN_LENGTH)) {
        const len = buffer.length;
        const avg = len > 1 ? (lastTs - firstTs) / (len - 1) : Infinity;
        const code = buffer;
        const target = burstTarget;
        const before = valueBefore;
        reset();
        const inField = isEditable(e.target);
        const minLen = inField ? MIN_LENGTH_IN_INPUT : MIN_LENGTH;
        if (len < minLen || avg >= MAX_AVG_INTERVAL_MS) return;

        // A real scanner burst: never let Enter/Tab submit a form or move focus.
        e.preventDefault();
        const optIn = inField && (e.target as HTMLElement).getAttribute(SCAN_TARGET_ATTR) === 'true';
        if (optIn) return; // the field owns the scan
        if (target && target === e.target && typeof target.value === 'string') {
          // Strip the burst that the browser typed into the focused field.
          if (target.value !== before) restoreInputValue(target, before);
        }
        const parsed: GS1ParseResult = parseGS1Barcode(code);
        playScanBeep();
        window.dispatchEvent(new CustomEvent<GS1ParseResult>(HARDWARE_BARCODE_EVENT, { detail: parsed }));
        return;
      }

      // Scanners send GS (FNC1) as Ctrl+] in wedge mode (or a literal 0x1D).
      let ch: string | null = null;
      if ((e.ctrlKey && (e.key === ']' || e.code === 'BracketRight')) || e.key === GS) ch = GS;
      else if (!e.ctrlKey && !e.altKey) ch = charFromKeyEvent(e, layout);
      if (ch === null) return;

      if (!buffer) {
        firstTs = now;
        layout = getHardwareScannerLayout();
        const t = e.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
          burstTarget = t;
          valueBefore = t.value;
        } else {
          burstTarget = null;
          valueBefore = '';
        }
      }
      buffer += ch;
      lastTs = now;
    };

    window.addEventListener('keydown', onKeyDown, true);
    detach = () => window.removeEventListener('keydown', onKeyDown, true);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount--;
    if (refCount <= 0 && detach) { detach(); detach = null; refCount = 0; }
  };
}

/** React hook: subscribes to hardware scans for the component's lifetime. */
export function useHardwareBarcodeScanner(onScan: (parsed: GS1ParseResult) => void): void {
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    const release = initHardwareBarcodeScanner();
    const handler = (e: Event) => cb.current((e as CustomEvent<GS1ParseResult>).detail);
    window.addEventListener(HARDWARE_BARCODE_EVENT, handler);
    return () => {
      window.removeEventListener(HARDWARE_BARCODE_EVENT, handler);
      release();
    };
  }, []);
}

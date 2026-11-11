import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Camera, MapPin, Bell, Mic, CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  PERMISSION_DEFS,
  PermissionKey,
  PermissionStatus,
  getPermissionHint,
  getPermissionStatus,
  requestPermission
} from '../utils/permissionManager';

const ICONS: Record<PermissionKey, React.ElementType> = {
  camera: Camera,
  location: MapPin,
  notifications: Bell,
  microphone: Mic
};

const getSettingsInstructions = (): string => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    return 'Ayarlar → Uygulamalar → MKS → İzinler yolundan bu izni açıp uygulamaya dönün.';
  }
  if (platform === 'ios') {
    return 'Ayarlar → MKS menüsünden ilgili izni açıp uygulamaya dönün.';
  }
  return 'Tarayıcı adres çubuğunun solundaki kilit/ayarlar simgesine tıklayıp bu izni "İzin Ver" olarak değiştirin.';
};

const PermissionsPanel: React.FC = () => {
  const [statuses, setStatuses] = useState<Partial<Record<PermissionKey, PermissionStatus>>>({});
  const [hints, setHints] = useState<Partial<Record<PermissionKey, string>>>({});
  const [busy, setBusy] = useState<PermissionKey | 'all' | null>(null);

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      PERMISSION_DEFS.map(async (d) => [d.key, await getPermissionStatus(d.key)] as const)
    );
    const nextStatuses = Object.fromEntries(entries) as Partial<Record<PermissionKey, PermissionStatus>>;
    setStatuses(nextStatuses);
    setHints((prev) => {
      const next = { ...prev };
      for (const d of PERMISSION_DEFS) {
        if (nextStatuses[d.key] === 'granted') {
          delete next[d.key];
        } else {
          const latestHint = getPermissionHint(d.key);
          if (latestHint) next[d.key] = latestHint;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    let appStateSub: { remove: () => Promise<void> } | null = null;
    let disposed = false;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive && !disposed) void refresh();
    })
      .then((handle) => {
        if (disposed) {
          void handle.remove();
        } else {
          appStateSub = handle;
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (appStateSub) void appStateSub.remove();
    };
  }, [refresh]);

  const grant = async (key: PermissionKey) => {
    setBusy(key);
    const result = await requestPermission(key);
    const hint = getPermissionHint(key);
    setStatuses((s) => ({ ...s, [key]: result }));
    setHints((h) => {
      const next = { ...h };
      if (hint && result !== 'granted') next[key] = hint;
      else delete next[key];
      return next;
    });
    setBusy(null);
  };

  const grantAll = async () => {
    setBusy('all');
    for (const d of PERMISSION_DEFS) {
      if (statuses[d.key] === 'granted' || statuses[d.key] === 'unsupported') continue;
      const result = await requestPermission(d.key);
      const hint = getPermissionHint(d.key);
      setStatuses((s) => ({ ...s, [d.key]: result }));
      setHints((h) => {
        const next = { ...h };
        if (hint && result !== 'granted') next[d.key] = hint;
        else delete next[d.key];
        return next;
      });
    }
    setBusy(null);
  };

  const missing = PERMISSION_DEFS.some((d) => statuses[d.key] === 'prompt' || statuses[d.key] === 'denied');
  const settingsGuide = getSettingsInstructions();

  return (
    <div className="bg-stone-900 rounded-3xl p-5 border border-emerald-500/20 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/30">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Cihaz İzinleri</h3>
            <p className="text-[11px] text-stone-400">Kamera, konum, bildirim ve mikrofon tek yerden</p>
          </div>
        </div>
        {missing && (
          <button
            type="button"
            onClick={grantAll}
            disabled={busy !== null}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black disabled:opacity-60"
          >
            {busy === 'all' ? 'İsteniyor…' : 'Hepsine İzin Ver'}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {PERMISSION_DEFS.map((d) => {
          const Icon = ICONS[d.key];
          const st = statuses[d.key];
          const hint = hints[d.key];
          return (
            <div key={d.key} className="flex items-center gap-3 p-3 rounded-2xl bg-stone-950/70 border border-white/5">
              <Icon size={18} className="text-stone-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white">{d.title}</div>
                <div className="text-[11px] text-stone-400 leading-snug">{d.reason}</div>
                {st === 'denied' && (
                  <div className="text-[11px] text-amber-400 mt-1.5 flex items-start gap-1.5 leading-snug">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      <strong>İzin engellenmiş:</strong> {settingsGuide}
                    </span>
                  </div>
                )}
                {st !== 'granted' && st !== 'denied' && hint && (
                  <div className="text-[11px] text-sky-300 mt-1.5 flex items-start gap-1.5 leading-snug">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    <span>{hint}</span>
                  </div>
                )}
              </div>
              {st === 'granted' ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 shrink-0">
                  <CheckCircle2 size={14} /> Açık
                </span>
              ) : st === 'unsupported' ? (
                <span className="text-[11px] text-stone-400 shrink-0">Cihazda yok</span>
              ) : (
                <button
                  type="button"
                  onClick={() => grant(d.key)}
                  disabled={busy !== null}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold border border-white/10 shrink-0 disabled:opacity-60 flex items-center justify-center"
                >
                  {busy === d.key ? <Loader2 size={14} className="animate-spin" /> : st === 'denied' ? 'Tekrar Dene' : 'İzin Ver'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-stone-400 leading-relaxed">
        Fotoğraf ve PDF seçerken galeri/dosya izni, seçim anında cihaz tarafından otomatik sorulur.
        USB, Bluetooth ve el terminali barkod okuyucular ek izin gerektirmeden çalışır.
      </p>
    </div>
  );
};

export default PermissionsPanel;

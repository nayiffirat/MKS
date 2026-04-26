import React from 'react';
import { MapPin, AlertCircle, RefreshCw } from 'lucide-react';

export const RegionalAlerts = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="pb-24 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-4 bg-stone-950/80 backdrop-blur sticky top-0 z-10 border-b border-white/5">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-200">Geri</button>
        <h2 className="text-lg font-bold text-stone-100">Bölgesel Uyarılar</h2>
        <button className="text-emerald-500">
          <RefreshCw size={20} />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-stone-900 p-4 rounded-2xl border border-rose-500/20 text-center">
            <AlertCircle className="mx-auto text-rose-500 mb-2" size={32} />
            <h3 className="font-bold text-white mb-1">Şu an aktif uyarı bulunmuyor</h3>
            <p className="text-stone-400 text-xs">Konumunuz için herhangi bir zirai risk tespit edilmedi.</p>
        </div>
        <div className="bg-stone-900 rounded-2xl p-4 border border-white/5 shadow-inner">
            <iframe 
                src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d11500!2d35!3d39!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1str!2str!4v1714000000000!5m2!1str!2str" 
                width="100%" 
                height="300" 
                style={{border:0, borderRadius: '1rem'}} 
                allowFullScreen={false} 
                loading="lazy"
                title="Bölgesel Harita"
            ></iframe>
            <div className="mt-4 flex items-center gap-2 text-stone-500 text-xs">
                <MapPin size={16} className="text-emerald-500" />
                <span>Konum: Türkiye Geneli Zirai Tahmin</span>
            </div>
        </div>
      </div>
    </div>
  );
};

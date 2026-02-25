import React, { useEffect } from 'react';
import { useAppViewModel } from '../context/AppContext';
import { Bell, CheckCircle, AlertTriangle, Info, Trash2, Settings, ArrowLeft } from 'lucide-react';

export const NotificationsScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { notifications, clearNotifications, markAllAsRead } = useAppViewModel();

  useEffect(() => {
      // Mark all as read when screen opens
      markAllAsRead();
  }, []);

  const getIcon = (type: string) => {
      switch(type) {
          case 'WARNING': return <AlertTriangle size={20} className="text-amber-400" />;
          case 'SUCCESS': return <CheckCircle size={20} className="text-emerald-500" />;
          case 'SYSTEM': return <Settings size={20} className="text-stone-400" />;
          default: return <Info size={20} className="text-blue-500" />;
      }
  };

  const getBgColor = (type: string) => {
      switch(type) {
          case 'WARNING': return 'bg-amber-900/10 border-amber-500/30';
          case 'SUCCESS': return 'bg-emerald-900/10 border-emerald-900/30';
          case 'SYSTEM': return 'bg-stone-800 border-white/5';
          default: return 'bg-blue-900/10 border-blue-900/30';
      }
  };

  return (
    <div className="pb-24 animate-in slide-in-from-right duration-300">
        
        {/* Header Action */}
        <div className="flex justify-between items-center mb-6 px-4 pt-2">
             <button onClick={onBack} className="text-stone-400 hover:text-stone-200 flex items-center -ml-2">
                <ArrowLeft size={20} className="mr-1" /> Geri
             </button>
             {notifications.length > 0 && (
                 <button 
                    onClick={clearNotifications}
                    className="flex items-center text-xs font-bold text-red-400 bg-red-900/10 px-3 py-1.5 rounded-full hover:bg-red-900/30 transition-colors"
                 >
                    <Trash2 size={14} className="mr-1.5" />
                    Tümünü Temizle
                 </button>
             )}
        </div>

        {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-24 h-24 bg-stone-900 rounded-full flex items-center justify-center mb-4 border border-stone-800 shadow-inner">
                    <Bell size={40} className="text-stone-600 opacity-50" />
                </div>
                <h3 className="text-stone-300 font-bold text-lg mb-1">Bildiriminiz Yok</h3>
                <p className="text-stone-500 text-sm max-w-xs">Şu an için görüntülenecek yeni bir bildirim bulunmuyor.</p>
            </div>
        ) : (
            <div className="space-y-3 px-4">
                {notifications.map((item) => (
                    <div 
                        key={item.id} 
                        className={`p-4 rounded-2xl border flex items-start space-x-4 animate-in fade-in slide-in-from-top-2 duration-300 ${getBgColor(item.type)}`}
                    >
                        <div className="mt-0.5 shrink-0 p-2 bg-stone-950/40 rounded-lg">
                            {getIcon(item.type)}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`font-bold text-sm ${item.type === 'WARNING' ? 'text-amber-200' : 'text-stone-200'}`}>{item.title}</h4>
                                <span className="text-[10px] text-stone-500 font-medium">
                                    {new Date(item.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            <p className="text-sm text-stone-400 leading-relaxed">
                                {item.message}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )}

        <div className="text-center mt-8 px-8">
            <p className="text-[10px] text-stone-600">
                Bildirimler son 30 gün boyunca saklanır. Zirai uyarılar konumunuza göre otomatik gönderilir.
            </p>
        </div>
    </div>
  );
};
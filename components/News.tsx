
import React, { useState } from 'react';
import { ChevronLeft, Newspaper, Calendar, ChevronRight, X, Megaphone } from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';
import { News as NewsType } from '../types';
import { EmptyState } from './EmptyState';

interface NewsProps {
    onBack: () => void;
}

export const News: React.FC<NewsProps> = ({ onBack }) => {
    const { news } = useAppViewModel();
    const [selectedNews, setSelectedNews] = useState<NewsType | null>(null);

    return (
        <div className="p-4 space-y-4 pb-24 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-6">
                <button 
                    onClick={onBack}
                    className="p-2 bg-stone-900 border border-white/10 rounded-xl text-stone-400 hover:text-white transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black text-stone-100">MKS Haber</h1>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Sektörel Gelişmeler ve Duyurular</p>
                </div>
                <a 
                    href="https://wa.me/905428254087?text=%C3%9Ccretsiz%20reklam%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-2 px-3 py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-xl text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all active:scale-95 group"
                >
                    <Megaphone size={14} className="group-hover:rotate-12 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ücretsiz Reklam</span>
                </a>
            </div>

            {news.length === 0 ? (
                <EmptyState
                    icon={Newspaper}
                    title="Haber bulunamadı"
                    description="Henüz yayınlanmış bir haber bulunmuyor. Lütfen daha sonra tekrar kontrol edin."
                />
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {news.map((item) => (
                        <div 
                            key={item.id}
                            onClick={() => setSelectedNews(item)}
                            className="bg-stone-900/50 border border-white/5 rounded-2xl overflow-hidden group hover:border-white/10 transition-all cursor-pointer active:scale-[0.98]"
                        >
                            <div className="flex gap-4 p-4">
                                <div className="w-24 h-24 rounded-xl bg-stone-800 shrink-0 overflow-hidden border border-white/5">
                                    {item.imageUrl ? (
                                        <img 
                                            src={item.imageUrl} 
                                            alt={item.title} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-stone-700">
                                            <Newspaper size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black rounded uppercase tracking-widest border border-blue-500/20">
                                            {item.category || 'Haber'}
                                        </span>
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-stone-500">
                                            <Calendar size={10} />
                                            {new Date(item.date).toLocaleDateString('tr-TR')}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-white text-sm line-clamp-1 mb-1 group-hover:text-blue-400 transition-colors">{item.title}</h3>
                                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">{item.content}</p>
                                </div>
                                <div className="flex items-center">
                                    <ChevronRight size={16} className="text-stone-700 group-hover:text-stone-300 transition-colors" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* News Detail Modal */}
            {selectedNews && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
                        <div className="relative h-48 sm:h-64 bg-stone-800 shrink-0">
                            {selectedNews.imageUrl ? (
                                <img 
                                    src={selectedNews.imageUrl} 
                                    alt={selectedNews.title}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-700">
                                    <Newspaper size={64} />
                                </div>
                            )}
                            <button 
                                onClick={() => setSelectedNews(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-stone-900 to-transparent">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 bg-blue-600 text-[8px] font-black text-white rounded uppercase tracking-widest">
                                        {selectedNews.category || 'Haber'}
                                    </span>
                                    <span className="text-[10px] font-bold text-stone-400">
                                        {new Date(selectedNews.date).toLocaleDateString('tr-TR')}
                                    </span>
                                </div>
                                <h2 className="text-lg font-black text-white leading-tight">{selectedNews.title}</h2>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="prose prose-invert max-w-none">
                                <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-wrap">
                                    {selectedNews.content}
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-white/5 bg-stone-900/80 shrink-0">
                            <button 
                                onClick={() => setSelectedNews(null)}
                                className="w-full py-3 bg-stone-800 text-stone-300 rounded-xl font-bold text-sm hover:bg-stone-700 transition-colors"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

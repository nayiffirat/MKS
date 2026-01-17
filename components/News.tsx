import React, { useState, useRef, useEffect } from 'react';
import { useNewsViewModel } from '../hooks/useNewsViewModel';
import { NewsItem, NewsCategory } from '../types';
import { RefreshCw, ArrowLeft, ExternalLink, Calendar, Newspaper, ChevronRight, Loader2 } from 'lucide-react';

interface NewsScreenProps {
  onBackToDashboard: () => void;
}

export const NewsScreen: React.FC<NewsScreenProps> = ({ onBackToDashboard }) => {
  const { activeCategory, currentNewsList, isLoading, changeCategory, refreshCurrentCategory } = useNewsViewModel();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  
  // Ref for scrollable tab container to scroll selected tab into view
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Categories list for iteration
  const categories = Object.values(NewsCategory);

  // Detail View
  if (selectedNews) {
    return (
      <div className="max-w-3xl mx-auto p-4 pb-24 animate-in slide-in-from-right duration-200">
        <div className="flex items-center mb-6">
          <button onClick={() => setSelectedNews(null)} className="p-2 -ml-2 hover:bg-stone-100 rounded-full text-stone-600 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <span className="ml-2 font-bold text-lg text-stone-800">Haber Detayı</span>
        </div>
        <article className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          {selectedNews.imageUrl && (
            <div className="h-56 w-full overflow-hidden relative">
               <img src={selectedNews.imageUrl} alt={selectedNews.title} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
               <div className="absolute bottom-4 left-4">
                  <span className="bg-agri-600 text-white text-xs font-bold px-2 py-1 rounded-md uppercase">
                    {selectedNews.category}
                  </span>
               </div>
            </div>
          )}
          <div className="p-6">
            <div className="flex items-center text-sm text-stone-500 font-medium mb-3">
              <Calendar size={16} className="mr-1" />
              {new Date(selectedNews.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <h1 className="text-2xl font-bold text-stone-900 mb-4 leading-tight">{selectedNews.title}</h1>
            <p className="text-stone-700 leading-relaxed whitespace-pre-line text-lg">{selectedNews.detailText}</p>
          </div>
          <div className="p-4 bg-stone-50 border-t border-stone-100">
            <button onClick={() => window.open(selectedNews.sourceUrl, '_blank')} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center justify-center">
              <ExternalLink size={20} className="mr-2" /> Haberin Kaynağına Git
            </button>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen md:h-auto md:min-h-screen bg-earth-50 max-w-3xl mx-auto md:pb-24">
      
      {/* Top App Bar with Tab Row */}
      <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-stone-200">
        <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center">
                <button onClick={onBackToDashboard} className="mr-3 md:hidden">
                    <ArrowLeft size={20} className="text-stone-500" />
                </button>
                <h1 className="text-xl font-bold text-stone-800 flex items-center">
                <Newspaper className="mr-2 text-agri-600" /> Haberler
                </h1>
            </div>
            <button onClick={refreshCurrentCategory} disabled={isLoading} className="p-2 bg-stone-50 text-agri-600 rounded-lg hover:bg-agri-50 disabled:opacity-50 transition-colors">
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
        </div>

        {/* Scrollable Tab Row */}
        <div 
            ref={tabsContainerRef}
            className="flex overflow-x-auto no-scrollbar px-2 space-x-1 border-b border-stone-100"
        >
            {categories.map((cat) => (
                <button
                    key={cat}
                    onClick={() => changeCategory(cat)}
                    className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors duration-200 ${
                        activeCategory === cat 
                        ? 'border-agri-600 text-agri-700' 
                        : 'border-transparent text-stone-400 hover:text-stone-600'
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>
      </div>

      {/* Pager Content Area (Scrollable List) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Loading Indicator */}
        {isLoading && currentNewsList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
                <Loader2 className="animate-spin text-agri-500 mb-2" size={40} />
                <p className="text-stone-500">{activeCategory} haberleri yükleniyor...</p>
            </div>
        )}

        {/* Content List */}
        {!isLoading && currentNewsList.length === 0 ? (
             <div className="text-center py-20 text-stone-400">
                Bu kategoride henüz haber yok.
             </div>
        ) : (
            currentNewsList.map((item) => (
                <div 
                    key={item.id} 
                    onClick={() => setSelectedNews(item)} 
                    className="bg-white p-0 rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:border-agri-300 cursor-pointer transition-all group overflow-hidden animate-in slide-in-from-bottom-2 duration-300"
                >
                    <div className="flex flex-col sm:flex-row h-full">
                        {/* Image Section */}
                        <div className="w-full sm:w-32 h-40 sm:h-auto bg-stone-100 relative shrink-0">
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-300"><Newspaper size={32} /></div>
                            )}
                            {/* Mobile Category Badge */}
                            <div className="absolute top-2 left-2 sm:hidden">
                                <span className="bg-white/90 backdrop-blur-sm text-stone-800 text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                                    {item.category}
                                </span>
                            </div>
                        </div>

                        {/* Text Section */}
                        <div className="p-4 flex flex-col justify-between flex-1">
                            <div>
                                <div className="hidden sm:flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-agri-600 bg-agri-50 px-2 py-0.5 rounded border border-agri-100">{item.category}</span>
                                    <span className="text-xs text-stone-400">{new Date(item.date).toLocaleDateString('tr-TR')}</span>
                                </div>
                                <h3 className="font-bold text-stone-800 line-clamp-2 group-hover:text-agri-700 transition-colors mb-2 text-lg">{item.title}</h3>
                                <p className="text-sm text-stone-500 line-clamp-2 leading-relaxed">{item.summary}</p>
                            </div>
                            
                            <div className="flex justify-between items-end mt-3 sm:mt-0">
                                <span className="text-xs text-stone-400 font-medium sm:hidden">{new Date(item.date).toLocaleDateString('tr-TR')}</span>
                                <div className="flex items-center text-xs font-bold text-agri-600 ml-auto group-hover:translate-x-1 transition-transform">
                                    DEVAMINI OKU <ChevronRight size={14} className="ml-1" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { RefreshCw, ExternalLink, Clock, Share2, ChevronLeft, ArrowRight, Newspaper, Loader2 } from 'lucide-react';
import { useNewsViewModel } from '../hooks/useNewsViewModel';
import { NewsItem } from '../types';

const CATEGORIES = [
  "SON DAKİKA",
  "TARIM",
  "EKONOMİ",
  "SPOR",
  "DÜNYA",
  "TEKNOLOJİ",
  "SAĞLIK",
  "OTOMOTİV",
  "MAGAZİN"
];

interface NewsScreenProps {
  onBackToDashboard: () => void;
}

export const NewsScreen: React.FC<NewsScreenProps> = ({ onBackToDashboard }) => {
  const { 
      activeCategory, 
      currentNewsList, 
      isLoading, 
      changeCategory, 
      refreshCurrentCategory 
  } = useNewsViewModel();

  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  // --- DETAIL VIEW (Overlay) ---
  if (selectedNews) {
    return (
      <div className="fixed inset-0 bg-stone-950 z-[60] flex flex-col animate-in slide-in-from-bottom-10 duration-300">
        {/* Transparent Header for Back Button */}
        <div className="absolute top-0 left-0 w-full p-4 z-20 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent h-24">
          <button 
            onClick={() => setSelectedNews(null)}
            className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex space-x-2">
            <button 
                onClick={() => {
                    if (navigator.share) {
                        navigator.share({
                            title: selectedNews.title,
                            text: selectedNews.summary,
                            url: selectedNews.sourceUrl
                        }).catch(console.error);
                    }
                }}
                className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors"
            >
               <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* Hero Image */}
        <div className="w-full h-[45vh] relative shrink-0 bg-stone-900">
             <img 
               src={selectedNews.imageUrl} 
               alt={selectedNews.title}
               className="w-full h-full object-cover opacity-90"
               onError={(e) => {
                   (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/10b981/ffffff?text=MKS+Haber';
               }}
             />
             <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-stone-950 via-stone-950/90 to-transparent"></div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto bg-stone-950 -mt-10 relative z-10 px-6">
             <div className="mb-4">
                 <span className="inline-block px-3 py-1 bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
                    {activeCategory}
                 </span>
                 <h1 className="text-2xl md:text-3xl font-bold text-stone-100 leading-tight font-serif mb-4">
                   {selectedNews.title}
                 </h1>
                 
                 <div className="flex items-center text-xs text-stone-400 font-medium mb-6 pb-6 border-b border-stone-800">
                    <div className="flex items-center mr-4">
                        <div className="w-6 h-6 rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center font-bold mr-2">M</div>
                        MyNet
                    </div>
                    <span className="flex items-center">
                        <Clock size={14} className="mr-1"/> 
                        {new Date(selectedNews.date).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                 </div>

                 {/* Summary */}
                 <p className="text-lg text-stone-300 font-medium italic leading-relaxed mb-6">
                    "{selectedNews.summary}"
                 </p>

                 {/* Full Text / Content */}
                 <div className="text-stone-300 leading-8 text-lg opacity-90 mt-6 prose prose-invert max-w-none">
                     {/* Clean up any potential HTML if accidentally rendered, though currently stripping in hook */}
                    {selectedNews.detailText}
                 </div>
             </div>
             <div className="h-24"></div> 
        </div>

        {/* Bottom Floating Action */}
        <div className="absolute bottom-6 left-6 right-6">
           <a 
             href={selectedNews.sourceUrl}
             target="_blank"
             rel="noopener noreferrer"
             className="w-full bg-stone-100 text-stone-950 py-4 rounded-2xl font-bold flex items-center justify-center shadow-2xl hover:bg-white transition-colors"
           >
             <ExternalLink size={18} className="mr-2" /> Haberin Devamını Oku (MyNet)
           </a>
        </div>
      </div>
    );
  }

  // --- MAIN LIST VIEW ---
  return (
    <div className="flex flex-col h-screen md:h-auto bg-transparent">
      
      {/* Header with Back & Refresh */}
      <div className="flex items-center justify-between px-4 py-2 bg-stone-950/80 backdrop-blur-md sticky top-0 z-20">
          <button onClick={onBackToDashboard} className="flex items-center text-stone-400 hover:text-white">
              <ChevronLeft size={24} /> <span className="ml-1 font-bold">Ana Sayfa</span>
          </button>
          <button 
            onClick={refreshCurrentCategory} 
            disabled={isLoading}
            className={`p-2 rounded-full bg-stone-800 text-stone-400 hover:text-white transition-all active:scale-90 ${isLoading ? 'bg-emerald-900/20 text-emerald-500' : ''}`}
          >
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
      </div>

      {/* Scrollable Tabs */}
      <div className="sticky top-12 z-10 bg-stone-950/90 backdrop-blur-md border-b border-white/5 shadow-sm pt-2">
        <div className="flex overflow-x-auto no-scrollbar px-2 pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => changeCategory(cat)}
              className={`flex-shrink-0 px-5 py-2 mx-1 rounded-full text-xs font-bold transition-all duration-300 whitespace-nowrap border ${
                activeCategory === cat 
                  ? 'bg-emerald-700 text-white border-emerald-600 shadow-md transform scale-105' 
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:border-stone-600 hover:text-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* News Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 min-h-[50vh] relative">
         
         {/* Loading Indicator Overlay */}
         {isLoading && currentNewsList.length > 0 && (
             <div className="sticky top-0 z-30 mb-4 animate-in slide-in-from-top-2 duration-300">
                 <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-lg flex items-center justify-center">
                     <Loader2 size={14} className="animate-spin mr-2" />
                     Veriler güncelleniyor...
                 </div>
             </div>
         )}

         {isLoading && currentNewsList.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 space-y-4">
                 <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-stone-500 text-sm animate-pulse">MyNet'ten Haberler Yükleniyor...</p>
             </div>
         ) : currentNewsList.length === 0 ? (
             <div className="text-center py-20 bg-stone-900/40 rounded-3xl border border-white/5 mx-4">
                 <Newspaper size={48} className="mx-auto text-stone-600 mb-4" />
                 <p className="text-stone-400 font-bold">Haber bulunamadı.</p>
                 <p className="text-stone-600 text-sm mt-1">İnternet bağlantınızı kontrol edip yenileyin.</p>
             </div>
         ) : (
             <>
                {/* Featured Item (First item) */}
                {currentNewsList.length > 0 && (
                    <div 
                        onClick={() => setSelectedNews(currentNewsList[0])}
                        className="relative h-64 rounded-3xl overflow-hidden shadow-lg group cursor-pointer mb-6 border border-white/10"
                    >
                        <img 
                            src={currentNewsList[0].imageUrl} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90" 
                            alt={currentNewsList[0].title}
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/10b981/ffffff?text=MKS+Haber';
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-5 w-full">
                            <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block shadow-sm">MANŞET</span>
                            <h2 className="text-white font-bold text-xl leading-snug line-clamp-2 mb-1 drop-shadow-md">{currentNewsList[0].title}</h2>
                            <div className="flex items-center text-stone-300 text-xs mt-2 font-medium">
                                <span>MyNet</span>
                                <span className="mx-2">•</span>
                                <span>{new Date(currentNewsList[0].date).toLocaleDateString('tr-TR')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* List Items */}
                {currentNewsList.slice(1).map((item, index) => (
                <React.Fragment key={item.id}>
                    <div 
                        onClick={() => setSelectedNews(item)}
                        className="bg-stone-900/60 backdrop-blur-sm rounded-2xl p-3 shadow-sm border border-white/5 flex space-x-4 cursor-pointer active:scale-[0.98] transition-all hover:bg-stone-800/80 hover:border-emerald-500/30 group"
                    >
                        <div className="w-24 h-24 rounded-xl bg-stone-800 overflow-hidden shrink-0 border border-white/5 relative">
                            <img 
                                src={item.imageUrl} 
                                alt={item.title} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/10b981/ffffff?text=MKS+Haber';
                                }}
                            />
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                                <h3 className="text-sm font-bold text-stone-200 leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors">
                                    {item.title}
                                </h3>
                            </div>
                            
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-stone-500 font-medium bg-stone-950 px-2 py-0.5 rounded border border-white/5">
                                    MyNet
                                </span>
                                <span className="text-[10px] text-stone-400 flex items-center">
                                    <Clock size={10} className="mr-1" /> {new Date(item.date).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-center text-stone-600 group-hover:text-emerald-500 transition-colors">
                            <ArrowRight size={18} />
                        </div>
                    </div>
                </React.Fragment>
                ))}
             </>
         )}
      </div>
    </div>
  );
};

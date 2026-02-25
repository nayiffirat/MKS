
import { useState, useEffect, useCallback, useRef } from 'react';
import { NewsItem, NewsCategory } from '../types';

// RSS Kaynak Haritası
const RSS_MAP: Record<string, string> = {
  'TARIM': 'https://webagron.com/feed/', 
  'TEKNOLOJİ': 'https://www.trthaber.com/bilim_teknoloji_articles.rss',
  'EKONOMİ': 'https://www.trthaber.com/ekonomi_articles.rss',
  'SİYASET': 'https://www.trthaber.com/gundem_articles.rss',
  'SPOR': 'https://www.trthaber.com/spor_articles.rss',
  'SAĞLIK': 'https://www.trthaber.com/saglik_articles.rss',
  'OTOMOTİV': 'https://www.trthaber.com/ekonomi_articles.rss',
  'MAGAZİN': 'https://www.trthaber.com/kultur_sanat_articles.rss',
  'DÜNYA': 'https://www.trthaber.com/dunya_articles.rss',
  'SON DAKİKA': 'https://www.trthaber.com/sondakika.rss'
};

const CACHE_DURATION = 60 * 60 * 1000; // 1 Saat

export const useNewsViewModel = () => {
  const [activeCategory, setActiveCategory] = useState<string>('SON DAKİKA');
  const [newsData, setNewsData] = useState<Record<string, NewsItem[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newsDataRef = useRef<Record<string, NewsItem[]>>({});
  const lastUpdatedRef = useRef<Record<string, number>>({});

  const fetchCategoryData = useCallback(async (category: string, forceRefresh = false) => {
    const now = Date.now();
    const lastFetchTime = lastUpdatedRef.current[category] || 0;
    
    // Eğer zorla yenileme yoksa ve veri önbellekte tazeyse (1 saat dolmadıysa) kullan
    if (!forceRefresh && newsDataRef.current[category] && (now - lastFetchTime < CACHE_DURATION)) {
        setNewsData(prev => ({ ...prev, [category]: newsDataRef.current[category] }));
        return;
    }

    setIsLoading(true);
    setError(null);

    const rssUrl = RSS_MAP[category] || RSS_MAP['SON DAKİKA'];
    // Cache buster ekleyerek tarayıcı/CDN önbelleğini aş
    const cacheBuster = `&cb=${now}_${Math.random().toString(36).substring(7)}`;

    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}${cacheBuster}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Servis hatası');
        const data = await res.json();
        
        if (data.status === 'ok') {
            const items = data.items.map((item: any, index: number) => {
                let imageUrl = item.thumbnail || item.enclosure?.link;
                if (!imageUrl && item.description) {
                    const imgMatch = item.description.match(/src="([^"]+)"/);
                    if (imgMatch) imageUrl = imgMatch[1];
                }
                return {
                    id: item.guid || `news-${index}-${now}`,
                    category: category as NewsCategory,
                    title: item.title,
                    summary: item.description ? item.description.replace(/<[^>]*>?/gm, '').substring(0, 150) + '...' : 'Detaylar için tıklayın.',
                    detailText: item.content || item.description,
                    imageUrl: imageUrl || `https://placehold.co/600x400/10b981/ffffff?text=${encodeURIComponent(category)}`,
                    sourceUrl: item.link,
                    date: item.pubDate
                };
            });

            newsDataRef.current[category] = items;
            lastUpdatedRef.current[category] = now;
            setNewsData(prev => ({ ...prev, [category]: items }));
        }
    } catch (err) {
      console.error("Haber çekme hatası:", err);
      setError('Haberler şu an yüklenemiyor.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Kategori değiştiğinde veriyi çek
  useEffect(() => {
    fetchCategoryData(activeCategory);
  }, [activeCategory, fetchCategoryData]);

  // Otomatik Güncelleme Mekanizması (Her dakika kontrol et, 1 saati geçtiyse yenile)
  useEffect(() => {
    const intervalId = setInterval(() => {
        const now = Date.now();
        const lastFetchTime = lastUpdatedRef.current[activeCategory] || 0;
        if (now - lastFetchTime > CACHE_DURATION) {
            console.log(`Otomatik güncelleme: ${activeCategory}`);
            fetchCategoryData(activeCategory, true);
        }
    }, 60000); // 1 dakika

    return () => clearInterval(intervalId);
  }, [activeCategory, fetchCategoryData]);

  const changeCategory = (category: string) => {
    setActiveCategory(category);
  };

  const refreshCurrentCategory = () => {
    fetchCategoryData(activeCategory, true);
  };

  return {
    activeCategory,
    currentNewsList: newsData[activeCategory] || [],
    isLoading,
    error,
    changeCategory,
    refreshCurrentCategory
  };
};

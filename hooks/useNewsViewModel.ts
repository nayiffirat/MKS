import { useState, useEffect, useCallback } from 'react';
import { NewsItem, NewsCategory } from '../types';
import { NEWS_TEMPLATES } from '../constants';

export const useNewsViewModel = () => {
  // State to hold active category
  const [activeCategory, setActiveCategory] = useState<NewsCategory>(NewsCategory.AGRICULTURE);
  
  // State to hold data for ALL categories (caching mechanism)
  // Initialize with empty arrays, will be populated on demand
  const [newsData, setNewsData] = useState<Record<NewsCategory, NewsItem[]>>({
    [NewsCategory.AGRICULTURE]: [],
    [NewsCategory.TECHNOLOGY]: [],
    [NewsCategory.ECONOMY]: [],
    [NewsCategory.POLITICS]: [],
    [NewsCategory.SPORTS]: [],
    [NewsCategory.HEALTH]: [],
    [NewsCategory.AUTOMOTIVE]: [],
    [NewsCategory.MAGAZINE]: [],
    [NewsCategory.WORLD]: []
  });

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Helper to generate mock news
  const generateMockNews = (category: NewsCategory, count: number = 20): NewsItem[] => {
    const template = NEWS_TEMPLATES[category];
    if (!template) return [];

    const items: NewsItem[] = [];
    for (let i = 0; i < count; i++) {
      // Pick random title and summary from templates
      const randomTitle = template.titles[Math.floor(Math.random() * template.titles.length)];
      const randomSummary = template.summaries[Math.floor(Math.random() * template.summaries.length)];
      
      // Random Date within last 30 days
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      // Random Image Seed
      const randomSeed = Math.floor(Math.random() * 10000) + i;

      items.push({
        id: `${category.toLowerCase()}-${i}-${Date.now()}`,
        category: category,
        title: randomTitle,
        summary: randomSummary,
        detailText: `${randomSummary}\n\n${randomTitle} hakkında detaylı gelişmeler yakında eklenecektir. Bu içerik, ${category} kategorisi için oluşturulmuş örnek bir metindir. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
        date: date.toISOString(),
        sourceUrl: '#',
        imageUrl: `https://picsum.photos/seed/${randomSeed}/400/250`
      });
    }
    return items;
  };

  // Function to fetch (generate) data for a specific category
  const fetchCategoryData = useCallback(async (category: NewsCategory) => {
    setIsLoading(true);
    
    // Simulate Network Delay for realism
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Generate fresh data
    const data = generateMockNews(category, 20);
    
    setNewsData(prev => ({
      ...prev,
      [category]: data
    }));
    
    setIsLoading(false);
  }, []);

  // Initial load logic
  useEffect(() => {
    // If data for the active category is empty, fetch it
    if (newsData[activeCategory].length === 0) {
        fetchCategoryData(activeCategory);
    }
  }, [activeCategory, fetchCategoryData, newsData]);

  // Method to switch tabs
  const changeCategory = (category: NewsCategory) => {
    setActiveCategory(category);
  };

  // Method to force refresh current category (regenerate random data)
  const refreshCurrentCategory = () => {
    fetchCategoryData(activeCategory);
  };

  return {
    activeCategory,
    currentNewsList: newsData[activeCategory],
    isLoading,
    changeCategory,
    refreshCurrentCategory
  };
};
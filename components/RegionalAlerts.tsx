import React, { useState, useMemo } from 'react';
import { 
  MapPin, AlertCircle, RefreshCw, ArrowLeft, ShieldAlert, Thermometer, 
  Droplets, Wind, Bug, Flame, CheckCircle2, ChevronRight, MessageSquare, 
  Sparkles, Filter, Zap, Share2, AlertTriangle, Info, Sprout, Send, FlaskConical,
  Search, ExternalLink, Calendar, BellRing
} from 'lucide-react';
import { useAppViewModel } from '../context/AppContext';

interface RegionalAlert {
  id: string;
  region: string;
  regionCode: string;
  crop: string;
  threatType: 'HASTALIK' | 'ZARARLI' | 'IKLIM';
  title: string;
  scientificName?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  temperature: string;
  humidity: string;
  riskWindow: string;
  description: string;
  activeIngredients: string[];
  recommendedPesticides: string[];
  culturalMeasures: string[];
  date: string;
}

const REGIONAL_ALERT_DATA: RegionalAlert[] = [
  {
    id: 'ALERT-001',
    region: 'Adana / Çukurova',
    regionCode: 'ADANA',
    crop: 'Pamuk',
    threatType: 'ZARARLI',
    title: 'Çizgili Yaprakkurdu (Prodenya) ve Yeşilkurt Salgın Uyarısı',
    scientificName: 'Spodoptera littoralis / Helicoverpa armigera',
    severity: 'CRITICAL',
    temperature: '34°C - 38°C',
    humidity: '%65 - %75',
    riskWindow: 'Önümüzdeki 24-48 Saat',
    description: 'Yüksek gece sıcaklıkları ve bağıl nem oranı kelebek uçuşlarını ve yumurta açılımını tavan yaptırdı. Taraklanma ve koza dönemindeki pamuklarda tarak dökümü riski maksimum seviyededir.',
    activeIngredients: ['Chlorantraniliprole', 'Indoxacarb', 'Emamectin Benzoate'],
    recommendedPesticides: ['Coragen 20 SC (FMC)', 'Avaunt (FMC)', 'Affirm (Syngenta)'],
    culturalMeasures: ['Tarla kenarlarındaki yabancı otlar temizlenmeli', 'Gece sulamalarından sonra tarla gözlemi yapılmalı'],
    date: 'Bugün, 09:30'
  },
  {
    id: 'ALERT-002',
    region: 'Şanlıurfa / Harran',
    regionCode: 'SANLIURFA',
    crop: 'Pamuk',
    threatType: 'ZARARLI',
    title: 'Kırmızı Örümcek ve Beyazsinek Şiddetli Popülasyon Artışı',
    scientificName: 'Tetranychus cinnabarinus / Bemisia tabaci',
    severity: 'HIGH',
    temperature: '39°C - 42°C',
    humidity: '%35 - %45',
    riskWindow: '3-5 Gün İçi',
    description: 'Aşırı kuru sıcak hava koşulları sebebiyle yaprak altlarında kırmızı örümcek kolonileşmesi başladı. Zamanında müdahale edilmezse yapraklarda kızarma ve yaprak dökümü kaçınılmazdır.',
    activeIngredients: ['Abamectin', 'Spiromesifen', 'Spirodiclofen'],
    recommendedPesticides: ['Agrimec (Syngenta)', 'Oberon (Bayer)', 'Envidor (Bayer)'],
    culturalMeasures: ['Aşırı azotlu gübrelemeden kaçınılmalı', 'Tarla tozlanmasını önlemek için kanal yolları nemlendirilmeli'],
    date: 'Bugün, 08:15'
  },
  {
    id: 'ALERT-003',
    region: 'Antalya / Serik & Kumluca',
    regionCode: 'ANTALYA',
    crop: 'Domates',
    threatType: 'HASTALIK',
    title: 'Sera Domates Mildiyösü ve Tuta Absoluta İkili Tehdit',
    scientificName: 'Phytophthora infestans / Tuta absoluta',
    severity: 'CRITICAL',
    temperature: '26°C - 30°C',
    humidity: '%85 - %95',
    riskWindow: 'Derhal İlaçlama Gerekli',
    description: 'Gece nem yoğuşması ve yüksek orantılı nem mantar sporlarının çimlenmesini tetikledi. Yapraklarda morumsu siyah ıslak lekeler ve Tuta galerileri gözlemleniyor.',
    activeIngredients: ['Mandipropamid', 'Fluopicolide + Propamocarb', 'Metaflumizone'],
    recommendedPesticides: ['Revus (Syngenta)', 'Infinito (Bayer)', 'Alverde (BASF)'],
    culturalMeasures: ['Sera havalandırması artırılmalı', 'Bulaşık alt yapraklar toplanıp imha edilmeli'],
    date: 'Bugün, 07:45'
  },
  {
    id: 'ALERT-004',
    region: 'Manisa & İzmir / Gediz Ovası',
    regionCode: 'MANISA',
    crop: 'Bağ (Üzüm)',
    threatType: 'HASTALIK',
    title: 'Bağ Mildiyösü ve Külleme Spor Üreme Uyarısı',
    scientificName: 'Plasmopara viticola / Uncinula necator',
    severity: 'HIGH',
    temperature: '24°C - 28°C',
    humidity: '%80 - %90',
    riskWindow: '24 Saat İçi',
    description: 'Son yağışlar sonrası somaklarda ve genç tane oluşum evresinde yağ lekesi belirtileri hızla yayılıyor. Külleme sporları için sıcaklık optimum banttadır.',
    activeIngredients: ['Copper Hydroxide', 'Azoxystrobin', 'Penconazole'],
    recommendedPesticides: ['Kocide 2000 (Dupont)', 'Amistar (Syngenta)', 'Topas 100 EC (Syngenta)'],
    culturalMeasures: ['Yaprak alma ve aralama çalışması yapılmalı', 'Salkım havalanması sağlanmalı'],
    date: 'Dün, 16:20'
  },
  {
    id: 'ALERT-005',
    region: 'Konya / Karapınar & Çumra',
    regionCode: 'KONYA',
    crop: 'Şeker Pancarı & Mısır',
    threatType: 'ZARARLI',
    title: 'Mısır Koçan Kurdu ve Pancar Cercospora Yaprak Lekesi',
    scientificName: 'Sesamia nonagrioides / Cercospora beticola',
    severity: 'MEDIUM',
    temperature: '30°C - 33°C',
    humidity: '%55 - %65',
    riskWindow: '4-6 Gün İçi',
    description: 'Yağmurlama sulama sonrası yaprak ıslaklık süresinin uzaması pancarda Cercospora noktalanmalarını tetikliyor. Mısırda tepe püskülü döllenme dönemi tırtıl zararı riski mevcut.',
    activeIngredients: ['Epoxiconazole + Pyraclostrobin', 'Chlorantraniliprole'],
    recommendedPesticides: ['Opera Max (BASF)', 'Coragen 20 SC (FMC)'],
    culturalMeasures: ['Gece yağmurlama sulaması süreleri kısaltılmalı', 'Tarladaki sarı yapraklar takip edilmeli'],
    date: 'Dün, 14:10'
  },
  {
    id: 'ALERT-006',
    region: 'Bursa / İnegöl & İznik',
    regionCode: 'BURSA',
    crop: 'Elma & Şeftali',
    threatType: 'HASTALIK',
    title: 'Elma Karalekesi ve Şeftali Monilyası Yağış Riski',
    scientificName: 'Venturia inaequalis / Monilinia laxa',
    severity: 'HIGH',
    temperature: '20°C - 23°C',
    humidity: '%88 - %98',
    riskWindow: 'İnfeksiyon Riski Akut',
    description: 'Bölgede beklenen çiseleyen yağmur ve yüksek nem karaleke sporu çimlenme süresini aşmıştır. Sistemik ve koruyucu fungisit kombinasyonu gereklidir.',
    activeIngredients: ['Difenoconazole', 'Captan', 'Boscalid + Pyraclostrobin'],
    recommendedPesticides: ['Score 250 EC (Syngenta)', 'Captan 80 WG', 'Signum (BASF)'],
    culturalMeasures: ['Meyve seyreltmesi yapılmalı', 'Ağaç içi hava akımı açılmalı'],
    date: '2 Gün Önce'
  }
];

export const RegionalAlerts: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { farmers, showToast, hapticFeedback } = useAppViewModel();
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const filteredAlerts = useMemo(() => {
    return REGIONAL_ALERT_DATA.filter(alert => {
      const matchRegion = selectedRegion === 'ALL' || alert.regionCode === selectedRegion;
      const matchSeverity = selectedSeverity === 'ALL' || alert.severity === selectedSeverity;
      const matchQuery = !searchQuery || 
        alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.crop.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.region.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRegion && matchSeverity && matchQuery;
    });
  }, [selectedRegion, selectedSeverity, searchQuery]);

  const handleShareWhatsApp = (alert: RegionalAlert) => {
    hapticFeedback?.();
    const text = `⚠️ *ZİRAİ ERKEN UYARI VE ALARM* ⚠️\n\n` +
      `📍 *Bölge:* ${alert.region}\n` +
      `🌱 *Ürün:* ${alert.crop}\n` +
      `🚨 *Tehdit:* ${alert.title}\n` +
      `🌡️ *Sıcaklık/Nem:* ${alert.temperature} | ${alert.humidity}\n` +
      `⏳ *Müdahale Süresi:* ${alert.riskWindow}\n\n` +
      `📝 *Açıklama:* ${alert.description}\n\n` +
      `🧪 *Önerilen Etken Maddeler:* ${alert.activeIngredients.join(', ')}\n` +
      `💊 *Örnek İlaçlar:* ${alert.recommendedPesticides.join(', ')}\n\n` +
      `İyi çalışmalar dileriz.\nMKS Ziraat Mühendisliği Saha Bilgilendirme`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleGenerateAiRiskReport = () => {
    hapticFeedback?.();
    setAiAnalyzing(true);
    setAiReport(null);

    setTimeout(() => {
      setAiAnalyzing(false);
      setAiReport(
        `📊 **Yapay Zeka Saha Risk Özeti (${selectedRegion === 'ALL' ? 'Türkiye Geneli' : selectedRegion})**:\n\n` +
        `• **Gece/Gündüz Nem İndeksi**: %78 ortalama ile fungal spor çimlenmesi kritik seviyede.\n` +
        `• **Zararlı Popülasyon Hızı**: Gece sıcaklıklarının 22°C üzerinde kalması nedeniyle emici böcek yumurta açılım süresi 4 günden 2 güne düşmüştür.\n` +
        `• **Öncelikli Tavsiye**: Tarlalara periyodik gözlem yaparak rulet ve sarı yapışkan tuzaklar kurunuz. Koruyucu fungisit + sistemik insektisit tank karışımları tavsiye edilir.`
      );
      showToast?.('Bölgesel risk raporu hazırlandı');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-28 animate-in slide-in-from-right duration-300">
      {/* Sticky Header */}
      <div className="flex items-center justify-between p-4 bg-stone-900/90 backdrop-blur-md sticky top-0 z-30 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack} 
            className="p-2 bg-stone-800 hover:bg-stone-700 rounded-xl text-stone-300 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="text-rose-500 animate-pulse" size={20} />
              Bölgesel Zirai Risk Radarı
            </h1>
            <p className="text-xs text-stone-400">Erken Uyarı & Salgın Hastalık/Zararlı Takibi</p>
          </div>
        </div>

        <button 
          onClick={handleGenerateAiRiskReport}
          disabled={aiAnalyzing}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950 transition-all active:scale-95 disabled:opacity-50"
        >
          {aiAnalyzing ? (
            <RefreshCw className="animate-spin" size={14} />
          ) : (
            <Sparkles size={14} />
          )}
          <span>AI Risk Raporu</span>
        </button>
      </div>

      <div className="p-4 space-y-5 max-w-4xl mx-auto">
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-stone-900/80 border border-rose-500/30 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-400 mb-1">
              <span className="text-[11px] font-medium text-stone-400">Kritik Alarm</span>
              <Flame size={16} />
            </div>
            <div className="text-2xl font-black text-rose-500">
              {REGIONAL_ALERT_DATA.filter(a => a.severity === 'CRITICAL').length}
            </div>
            <span className="text-[10px] text-stone-500">Acil Müdahale</span>
          </div>

          <div className="bg-stone-900/80 border border-amber-500/30 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-400 mb-1">
              <span className="text-[11px] font-medium text-stone-400">Nem & Spor</span>
              <Droplets size={16} />
            </div>
            <div className="text-2xl font-black text-amber-400">%82</div>
            <span className="text-[10px] text-stone-500">Fungal İnfeksiyon</span>
          </div>

          <div className="bg-stone-900/80 border border-emerald-500/30 p-3.5 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-medium text-stone-400">Takip Edilen</span>
              <Sprout size={16} />
            </div>
            <div className="text-2xl font-black text-emerald-400">8 Bölge</div>
            <span className="text-[10px] text-stone-500">Canlı Radar</span>
          </div>
        </div>

        {/* AI Report Card if generated */}
        {aiReport && (
          <div className="bg-gradient-to-r from-emerald-950/60 to-stone-900 border border-emerald-500/40 p-4 rounded-2xl space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={16} /> Yapay Zeka Saha Risk Özeti
              </span>
              <button onClick={() => setAiReport(null)} className="text-stone-500 hover:text-white text-xs">Kapat</button>
            </div>
            <div className="text-xs text-stone-300 whitespace-pre-line leading-relaxed">
              {aiReport}
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-stone-500" size={16} />
            <input 
              type="text"
              placeholder="Zararlı, hastalık veya ürün ara (ör: Pamuk, Tuta, Mildiyö)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-900 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedRegion('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === 'ALL' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
              }`}
            >
              Tüm Bölgeler
            </button>
            <button
              onClick={() => setSelectedRegion('ADANA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === 'ADANA' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
              }`}
            >
              Adana / Çukurova
            </button>
            <button
              onClick={() => setSelectedRegion('SANLIURFA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === 'SANLIURFA' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
              }`}
            >
              Şanlıurfa / Harran
            </button>
            <button
              onClick={() => setSelectedRegion('ANTALYA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === 'ANTALYA' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
              }`}
            >
              Antalya / Sera
            </button>
            <button
              onClick={() => setSelectedRegion('MANISA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === 'MANISA' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
              }`}
            >
              Manisa & İzmir
            </button>
            <button
              onClick={() => setSelectedRegion('KONYA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === 'KONYA' 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
              }`}
            >
              Konya
            </button>
          </div>
        </div>

        {/* Alert List */}
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="bg-stone-900 p-8 rounded-2xl border border-white/5 text-center space-y-2">
              <CheckCircle2 className="mx-auto text-emerald-500" size={36} />
              <h3 className="font-bold text-white text-sm">Seçilen Filtreye Ait Uyarı Bulunmadı</h3>
              <p className="text-stone-400 text-xs">Aradığınız kriterlerde aktif zirai tehlike kaydı yok.</p>
            </div>
          ) : (
            filteredAlerts.map(alert => (
              <div 
                key={alert.id} 
                className={`bg-stone-900/90 rounded-2xl border p-4 space-y-4 shadow-lg transition-all ${
                  alert.severity === 'CRITICAL'
                    ? 'border-rose-500/40 shadow-rose-950/20'
                    : alert.severity === 'HIGH'
                    ? 'border-amber-500/30'
                    : 'border-white/10'
                }`}
              >
                {/* Alert Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : alert.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {alert.severity === 'CRITICAL' ? '🔥 KRİTİK SAHA ALARMI' : alert.severity === 'HIGH' ? '⚠️ YÜKSEK RİSK' : 'ℹ️ ORTA RİSK'}
                      </span>
                      <span className="text-[11px] text-stone-400 flex items-center gap-1">
                        <MapPin size={12} className="text-emerald-500" /> {alert.region}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white leading-snug">{alert.title}</h3>
                    {alert.scientificName && (
                      <p className="text-xs text-stone-400 italic font-mono">{alert.scientificName}</p>
                    )}
                  </div>

                  <span className="px-2.5 py-1 bg-stone-800 text-emerald-400 text-xs font-semibold rounded-lg shrink-0">
                    {alert.crop}
                  </span>
                </div>

                {/* Weather Metrics */}
                <div className="grid grid-cols-3 gap-2 bg-stone-950/60 p-2.5 rounded-xl text-xs border border-white/5">
                  <div className="flex items-center gap-1.5 text-stone-300">
                    <Thermometer size={14} className="text-rose-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-stone-500">Sıcaklık</div>
                      <div className="font-semibold text-stone-200">{alert.temperature}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-stone-300">
                    <Droplets size={14} className="text-blue-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-stone-500">Bağıl Nem</div>
                      <div className="font-semibold text-stone-200">{alert.humidity}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-stone-300">
                    <Calendar size={14} className="text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-stone-500">Pencere</div>
                      <div className="font-semibold text-stone-200">{alert.riskWindow}</div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-stone-300 leading-relaxed bg-stone-950/30 p-3 rounded-xl border border-white/5">
                  {alert.description}
                </p>

                {/* Recommendations */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-stone-400 font-medium block mb-1">🧪 Önerilen Etken Maddeler (Ruhsatlı):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {alert.activeIngredients.map((ing, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-md text-[11px]">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-400 font-medium block mb-1">💊 Örnek Ticari Ürünler:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {alert.recommendedPesticides.map((pest, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-stone-800 text-stone-300 rounded-md text-[11px]">
                          {pest}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleShareWhatsApp(alert)}
                    className="flex-1 py-2 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageSquare size={14} />
                    <span>WhatsApp Uyarısı Paylaş</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

import { Pesticide, PesticideCategory } from './types';

export const MOCK_PESTICIDES: Pesticide[] = [
  { id: '1', name: 'Alpha Guard', activeIngredient: 'Cypermethrin', defaultDosage: '50ml/100L', category: PesticideCategory.INSECTICIDE },
  { id: '2', name: 'Weed Killer X', activeIngredient: 'Glyphosate', defaultDosage: '200ml/100L', category: PesticideCategory.HERBICIDE },
  { id: '3', name: 'Fungi Stop', activeIngredient: 'Tebuconazole', defaultDosage: '75ml/100L', category: PesticideCategory.FUNGICIDE },
  { id: '4', name: 'Mega Growth', activeIngredient: 'Nitrogen+Zinc', defaultDosage: '250g/100L', category: PesticideCategory.FERTILIZER },
];

export const APP_NAME = "Mühendis Kayıt Sistemi";
export const ENGINEER_NAME_DEFAULT = "Ziraat Müh. Ahmet Yılmaz";

// Templates for generating random news
export const NEWS_TEMPLATES: Record<string, { titles: string[], summaries: string[] }> = {
  TARIM: {
    titles: [
      'Gübre Fiyatlarında Beklenen İndirim Geldi',
      '2024 Yılı Tarımsal Destekleme Bütçesi Onaylandı',
      'Kuraklıkla Mücadelede Yeni Eylem Planı',
      'Çiftçiye Mazot Desteği Ödemeleri Başlıyor',
      'Yerli Tohum Üretiminde Rekor Artış',
      'Organik Tarım İhracatında Hedef Büyütüldü',
      'Akıllı Tarım Uygulamaları Yaygınlaşıyor',
      'Buğday Taban Fiyatları Açıklandı',
      'Seralarda Enerji Verimliliği Dönemi',
      'Meyve İhracatında Rusya Pazarı Genişliyor'
    ],
    summaries: [
      'Tarım ve Orman Bakanlığı tarafından yapılan son dakika açıklamasına göre üreticilerin yüzünü güldürecek gelişmeler yaşanıyor.',
      'Resmi Gazete\'de yayımlanan kararname ile birlikte tarımsal girdilerde yeni bir dönem başlıyor.',
      'İklim değişikliğinin etkilerini en aza indirmek amacıyla hazırlanan raporda çarpıcı detaylar yer alıyor.',
      'Üretim maliyetlerini düşürmek ve verimliliği artırmak için devlet destekli hibe programları devreye alındı.',
      'Ziraat Odaları Birliği Başkanı, hasat sezonu öncesi çiftçilere önemli uyarılarda bulundu.'
    ]
  },
  TEKNOLOJİ: {
    titles: [
      'Yapay Zeka Tarım Sektörünü Dönüştürüyor',
      'Android 16 Özellikleri Sızdırıldı',
      'Yerli Elektrikli Traktör Seri Üretime Geçiyor',
      '5G Altyapısı Kırsal Bölgelere Ulaşıyor',
      'Yeni Nesil Drone ile İlaçlama Dönemi',
      'Google\'dan Çiftçilere Özel Uygulama',
      'Kuantum Bilgisayarlarda Büyük Adım',
      'Siber Güvenlikte Yeni Tehdit: Fidye Yazılımları',
      'Uzaydan Tarla Takibi Yapan Uydu Fırlatıldı',
      'Giyilebilir Teknolojiler Sağlığı İzliyor'
    ],
    summaries: [
      'Teknoloji devlerinin son geliştirmeleri, günlük hayatı ve endüstriyel süreçleri kökten değiştirmeye hazırlanıyor.',
      'Silikon Vadisi\'nden gelen son haberler, yatırımcıların dikkatini yapay zeka girişimlerine çekti.',
      'Yeni geliştirilen sensör teknolojileri sayesinde verimlilik %40 oranında artırıldı.',
      'Mobil dünyada yaşanan rekabet, kullanıcılara daha uygun fiyatlı ve yüksek performanslı cihazlar sunuyor.',
      'Dijital dönüşüm süreci, geleneksel sektörlerin de teknolojiyle entegre olmasını zorunlu kılıyor.'
    ]
  },
  EKONOMİ: {
    titles: [
      'Merkez Bankası Faiz Kararını Açıkladı',
      'Altın Fiyatlarında Tarihi Zirve',
      'Döviz Kurlarında Son Durum',
      'Enflasyon Rakamları Beklentiyi Aştı',
      'İhracatta Yeni Rekor: Otomotiv Sektörü',
      'Borsa İstanbul Güne Yükselişle Başladı',
      'Kripto Para Piyasasında Hareketli Saatler',
      'Konut Fiyatlarında Düşüş Beklentisi',
      'Asgari Ücret Tespit Komisyonu Toplanıyor',
      'Turizm Gelirleri Yüzleri Güldürdü'
    ],
    summaries: [
      'Piyasalardaki belirsizlik sürerken, uzmanlar yatırımcıları temkinli olmaları konusunda uyarıyor.',
      'Global piyasalardaki gelişmeler, iç piyasada da etkisini hissettirmeye devam ediyor.',
      'Ekonomi yönetiminin aldığı yeni tedbirler, orta vadeli programın hedeflerine ulaşılmasını kolaylaştıracak.',
      'Bankaların kredi faiz oranlarında yaptığı güncelleme, tüketici alışkanlıklarını doğrudan etkiliyor.',
      'Yatırım araçları arasında yaşanan geçişkenlik, portföy yönetiminin önemini bir kez daha ortaya koydu.'
    ]
  },
  SİYASET: {
    titles: [
      'Meclis Genel Kurulu Toplanıyor',
      'Yeni Anayasa Çalışmaları Başladı',
      'Kabine Toplantısı Sonrası Önemli Açıklamalar',
      'Yerel Seçim Hazırlıkları Hız Kazandı',
      'Parti Gruplarında Gündem Ekonomi',
      'Uluslararası Diplomasi Trafiği Yoğunlaştı',
      'Meclis\'ten Geçen Yeni Torba Yasa',
      'Siyasi Partilerden Ortak Bildiri',
      'Belediyelerden Kentsel Dönüşüm Hamlesi',
      'Seçim Kanununda Değişiklik Teklifi'
    ],
    summaries: [
      'Ankara kulislerinde konuşulan son iddialara göre, önümüzdeki günlerde önemli değişiklikler olabilir.',
      'Siyasi parti liderlerinin karşılıklı açıklamaları gündemdeki sıcaklığını koruyor.',
      'Meclis gündemine gelen yasa teklifi, kamuoyunda geniş yankı uyandırdı.',
      'Hükümet yetkilileri, vatandaşların taleplerini karşılamak için yeni projeler üzerinde çalışıyor.',
      'Diplomatik kaynaklardan alınan bilgilere göre, iki ülke arasındaki ilişkilerde yeni bir sayfa açılıyor.'
    ]
  },
  SPOR: {
    titles: [
      'Süper Lig\'de Derbi Heyecanı',
      'Milli Takım Avrupa Şampiyonası Yolunda',
      'Transfer Döneminin En Pahalı İmzası',
      'NBA\'de Temsilcimizden Muhteşem Performans',
      'Voleybolun Sultanları Finalde',
      'Formula 1 İstanbul Park İddiası',
      'Teniste Grand Slam Heyecanı Başlıyor',
      'Amatör Sporlara Dev Destek',
      'Şampiyonlar Ligi Kura Çekimi Yapıldı',
      'Olimpiyat Hazırlıkları Tam Gaz Sürüyor'
    ],
    summaries: [
      'Son dakikada gelen gol, stadyumu bayram yerine çevirdi ve şampiyonluk yolunda kritik bir viraj dönüldü.',
      'Teknik direktörün maç sonu açıklamaları, takım içindeki dengeleri değiştirecek gibi görünüyor.',
      'Yıldız oyuncunun sakatlığı, teknik heyeti kara kara düşündürürken alternatif planlar devreye sokuldu.',
      'Spor camiası, efsane ismin vedasıyla sarsıldı; törene binlerce taraftar katıldı.',
      'Genç yeteneklerin performansı, gelecek turnuvalar için umut ışığı oldu.'
    ]
  },
  SAĞLIK: {
    titles: [
      'Grip Salgınına Karşı Uzman Uyarısı',
      'Yerli Kanser İlacında Faz 3 Çalışmaları',
      'Sağlıklı Beslenmenin 10 Altın Kuralı',
      'Hastanelerde Randevu Sistemi Güncellendi',
      'Kalp Sağlığı İçin Yürüyüşün Önemi',
      'Diyabetle Mücadelede Yeni Yöntemler',
      'Ruh Sağlığı Yasası Meclis Gündeminde',
      'Aşı Çalışmalarında Sevindirici Gelişme',
      'Teknoloji Bağımlılığı Çocukları Tehdit Ediyor',
      'Uyku Düzeninin Bağışıklığa Etkisi'
    ],
    summaries: [
      'Dünya Sağlık Örgütü\'nün son raporu, küresel sağlık risklerine karşı alınması gereken önlemleri sıraladı.',
      'Hekimler, mevsim geçişlerinde artan hastalıklara karşı bağışıklık sistemini güçlendirmenin yollarını anlattı.',
      'Yapılan bilimsel araştırmalar, düzenli egzersizin kronik hastalık riskini %50 azalttığını ortaya koydu.',
      'Sağlık Bakanlığı, vatandaşların sağlık hizmetlerine erişimini kolaylaştırmak için dijital altyapıyı güçlendiriyor.',
      'Uzman diyetisyenler, şok diyetlerin zararlarına dikkat çekerek dengeli beslenme uyarısında bulundu.'
    ]
  },
  OTOMOTİV: {
    titles: [
      'Yerli Otomobil Togg Yollarda',
      'Elektrikli Araç Satışlarında Patlama',
      'ÖTV İndirimi Beklentisi Piyasayı Durdurdu',
      'Çinli Markalar Türkiye Pazarına Giriyor',
      'Otonom Sürüş Teknolojisinde Devrim',
      'İkinci El Otomobil Piyasası Hareketlendi',
      'Benzinli Araçlara Veda Tarihi Açıklandı',
      'Hibrit Modellerde Kampanya Dönemi',
      'Yerli Batarya Fabrikası Temeli Atıldı',
      'Otomobil Fiyatlarında Kur Etkisi'
    ],
    summaries: [
      'Otomotiv Distribütörleri Derneği verilerine göre, geçen aya oranla satışlarda ciddi bir artış gözlemlendi.',
      'Yeni modelin lansmanı, otomobil tutkunları tarafından büyük bir ilgiyle takip edildi.',
      'Sektör temsilcileri, tedarik zincirindeki sorunların aşılmasıyla birlikte üretimin hızlanacağını belirtiyor.',
      'Şarj istasyonu ağının genişlemesi, elektrikli araç tercihini olumlu yönde etkiliyor.',
      'Güvenlik testlerinden tam not alan yeni SUV modeli, ailelerin gözdesi olmaya aday.'
    ]
  },
  MAGAZİN: {
    titles: [
      'Ünlü Şarkıcı Dünya Turnesine Çıkıyor',
      'Yılın Düğünü İçin Geri Sayım Başladı',
      'Ödül Töreninde Şıklık Yarışı',
      'Gişe Rekoru Kıran Filmin Devamı Geliyor',
      'Sosyal Medya Fenomenine Büyük Şok',
      'Ünlü Oyuncu Sektörü Bıraktığını Açıkladı',
      'Yaz Konserleri Takvimi Belli Oldu',
      'Moda Haftasında Türk Tasarımcı Rüzgarı',
      'Boşanma Davasında Sürpriz Gelişme',
      'Dizi Setinde Aşk İddiası'
    ],
    summaries: [
      'Magazin dünyası bu haberi konuşuyor; ünlü çiftin ayrılık kararı hayranlarını üzdü.',
      'Kırmızı halıda boy gösteren yıldızlar, kıyafetleriyle geceye damga vurdu.',
      'Sosyal medya hesabından yaptığı paylaşımla sessizliğini bozan sanatçı, iddialara yanıt verdi.',
      'Yeni projesi için imaj değiştiren oyuncu, hayranlarından tam not aldı.',
      'Yaz tatilini Bodrum\'da geçiren ünlü isim, objektiflere neşeli pozlar verdi.'
    ]
  },
  DÜNYA: {
    titles: [
      'Birleşmiş Milletler\'den Acil Çağrı',
      'İklim Zirvesi\'nde Kritik Kararlar',
      'Avrupa\'da Enerji Krizi Endişesi',
      'ABD Başkanlık Seçimleri Yaklaşıyor',
      'Asya Piyasalarında Sert Düşüş',
      'Ortadoğu\'da Barış Görüşmeleri',
      'Uzay Yarışında Yeni Aktörler',
      'Küresel Isınma Tehdidi Büyüyor',
      'Teknoloji Savaşları Kızışıyor',
      'Göçmen Sorunu İçin Ortak Çözüm Arayışı'
    ],
    summaries: [
      'Dünya liderleri, küresel sorunlara çözüm bulmak amacıyla düzenlenen zirvede bir araya geldi.',
      'Uluslararası basında yer alan haberlere göre, bölgedeki gerilim tırmanmaya devam ediyor.',
      'Bilim insanları, buzullardaki erimenin beklenenden daha hızlı gerçekleştiği konusunda uyardı.',
      'Sınır ötesi operasyonla ilgili yapılan açıklama, diplomatik ilişkilerde yeni bir süreci başlattı.',
      'Dünya genelinde artan gıda fiyatları, gelişmekte olan ülkeleri zor durumda bırakıyor.'
    ]
  }
};
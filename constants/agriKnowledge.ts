export interface TankMixItem {
  id: string;
  category: string;
  compatibleWith: string[];
  conditionalWith: string[];
  incompatibleWith: string[];
  warningNote: string;
}

export const TANK_MIX_GUIDE: TankMixItem[] = [
  {
    id: 'BAKIR',
    category: 'Bakırlı İlaçlar (Bordo Bulamacı, Bakır Hidroksit, Bakır Oksiklorür)',
    compatibleWith: ['Kükürt (Belli pH aralığında)', 'Bazı Kontak Fungisitler (Mancozeb - nötr ortamda)'],
    conditionalWith: ['Sıvı Yaprak Gübreleri (Asidik olmayanlar)'],
    incompatibleWith: ['Organik Fosforlu İnsektisitler', 'Asidik Yaprak Gübreleri', 'Amino Asitler', 'Yüzey Aktif Maddeler / Yayıcı Yapıştırıcılar', 'Yağlar'],
    warningNote: 'Bakır yüksek pH veya yüksek asiditede çöker ve yaprağı yakar. Bakırlı ilaçlar tek başına veya nötr ortamda uygulanmalıdır.'
  },
  {
    id: 'KUKURT',
    category: 'Kükürtlü İlaçlar (Toz veya Sıvı Kükürt)',
    compatibleWith: ['Piretroit İnsektisitler', 'Çoğu Fungisit'],
    conditionalWith: ['Yaprak Gübreleri'],
    incompatibleWith: ['Yağlar ve Mineral Yağlı İlaçlar (En az 21 gün ara verilmelidir)', 'Aşırı sıcak havalarda (30°C üzeri) tüm ilaçlar'],
    warningNote: 'Yazın 30°C üzerindeki sıcaklıklarda kükürt kullanımı fitotoksite (yaprak yakması) riski taşır. Yağlı ilaçlarla asla karıştırılmaz.'
  },
  {
    id: 'AMINO_ASIT',
    category: 'Amino Asit & Biyouyarıcılar (Seaweed / Deniz Yosunu)',
    compatibleWith: ['Sistemik Fungisitler', 'İnsektisitler', 'Makro ve Mikro Yaprak Gübreleri (N, P, K, Zn, Fe)'],
    conditionalWith: ['Herbisitler (Ot İlaçları - sadece ot ilacı etki artırımı istendiğinde)'],
    incompatibleWith: ['Bakırlı İlaçlar', 'Kalsiyum Nitrat (Yüksek derişimde)'],
    warningNote: 'Amino asitler bitki tarafından hızla emildiği için yanındaki ilacın emilimini de artırır. Bakırla karıştırılırsa bitkiye bakır zehirlenmesi yapabilir.'
  },
  {
    id: 'KALSIYUM',
    category: 'Kalsiyum Yaprak Gübreleri (Kalsiyum Nitrat / CaCl2)',
    compatibleWith: ['Bor', 'Çinko (EDTA Şelatlı)', 'Akarisitlerin bir kısmı'],
    conditionalWith: ['Nötr Fungisitler'],
    incompatibleWith: ['Sülfatlı Gübreler (Potasyum Sülfat, Magnezyum Sülfat - ÇİPS (Alçı) ÇÖKELTİSİ YAPAR!)', 'Fosforlu Gübreler (MAP, MKP - Kalsiyum Fosfat Çökelir)'],
    warningNote: 'Kalsiyum sülfat veya fosfat ile karıştırıldığında depoda beyaz çökelti oluşur ve damlama/meme tıkaması yapar.'
  },
  {
    id: 'HERBISIT',
    category: 'Herbisitler (Yabancı Ot İlaçları - Dar / Geniş Yapraklı)',
    compatibleWith: ['Özel Yayıcı Yapıştırıcılar'],
    conditionalWith: ['Zararlı İlaçları (Insektisitler)'],
    incompatibleWith: ['Çinko ve Demir Gübreleri', 'Kuvvetli Asidik / Bazik Yaprak Gübreleri', 'Bitki Gelişim Düzenleyicileri'],
    warningNote: 'Ot ilaçları kültür bitkisini strese sokabilir. Yaprak gübresi veya mikro element eklemek ot ilacının yabancı otu öldürme etkisini zayıflatabilir.'
  },
  {
    id: 'YAGLAR',
    category: 'Yazlık ve Kışlık Yağlar (Mineral Yağlar)',
    compatibleWith: ['Organik Fosforlular'],
    conditionalWith: ['Bazı Kontak İnsektisitler'],
    incompatibleWith: ['Kükürt', 'Captan / Folpet içerikli fungisitler', 'Dithianon'],
    warningNote: 'Kükürt ile yağ uygulaması arasında en az 3 hafta (21 gün) süre olmalıdır.'
  }
];

export const MIXING_ORDER_STEPS = [
  '1. Depoya 1/2 veya 2/3 oranında temiz su doldurun ve karıştırıcıyı çalıştırın.',
  '2. Su düzenleyici / pH ayarlayıcı ve Köpük Önleyici ekleyin.',
  '3. Suda Çözünür Poşetler (WSB) veya Islanabilir Toz (WP) ilaçları ekleyin.',
  '4. Suda Dağılabilir Granül (WG / WDG) ilaçları ön karıştırma kaplarında eriterek ekleyin.',
  '5. Süspansiyon Konsantre (SC / FS) ve Akıcı Formülasyonları ekleyin.',
  '6. Emülsiyon Konsantre (EC) sıvı ilaçları ekleyin.',
  '7. Sıvı Yaprak Gübreleri, Amino Asit ve Biyouyarıcıları ekleyin.',
  '8. En son Yayıcı Yapıştırıcı / Yüzey Aktif Maddeleri ekleyerek su seviyesini tamamlayın.'
];

export interface DeficiencyItem {
  element: string;
  symbol: string;
  type: 'Makro Besin' | 'Mikro Besin';
  targetLeaves: 'Yaşlı (Alt) Yapraklar' | 'Genç (Üst) Yapraklar' | 'Tüm Bitki' | 'Genç (Üst) Yapraklar & Çiçekler';
  symptoms: string;
  visualCue: string;
  causes: string;
  solution: string;
  recommendedProducts: string[];
}

export const DEFICIENCY_GUIDE: DeficiencyItem[] = [
  {
    element: 'Azot',
    symbol: 'N',
    type: 'Makro Besin',
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    symptoms: 'Alt yapraklardan başlayan genel açık yeşil ve sararma (kloroz). Bitki gelişimi yavaşlar, gövde ince kalır, alt yapraklar erken kuruyup dökülür.',
    visualCue: 'Yaprak ayasının tamamı homojen şekilde sararır, damarlar da sarıdır.',
    causes: 'Toprakta yetersiz organik madde, aşırı yıkanma (yağış/aşırı sulama), düşük toprak sıcaklığı.',
    solution: 'Topraktan Üre (%46 N) veya Amonyum Nitrat (%26 CAN / %33 AN), yapraktan sıvı aminoasitli azot takviyesi.',
    recommendedProducts: ['Toros Üre %46', 'İgsaş CAN %26', 'Speedfol N', 'UAN 32 Sıvı Azot']
  },
  {
    element: 'Fosfor',
    symbol: 'P',
    type: 'Makro Besin',
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    symptoms: 'Yaşlı yaprakların alt yüzeyinde ve damarlarda morarma, kırmızımsı-mor renk değişimi (antosiyan birikimi). Kök gelişimi durur, çiçeklenme ve meyve tutumu zayıflar.',
    visualCue: 'Koyu yeşil, donuk ve alt yüzeyi moraran yapraklar.',
    causes: 'Soğuk toprak (kök çalışamaz), yüksek/düşük pH (kireçli veya çok asidik topraklar P bağlar).',
    solution: 'Kökten MAP (12-61-0), 10-52-10 gibi yüksek fosforlu gübreler veya damlamadan phosphoric acid uygulaması.',
    recommendedProducts: ['Novalon 10-52-10', 'Haifa MAP', 'P-Nutri Sıvı Fosfor', 'YaraTera Krista MAP']
  },
  {
    element: 'Potasyum',
    symbol: 'K',
    type: 'Makro Besin',
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    symptoms: 'Yaşlı yaprakların kenarlarında ve uçlarında yanıklık, kuruma (marjinal nekroz). Yaprak kenarları kavrulmuş gibi görünür. Meyve irileşemez, rengi mat kalır, şeker/Brix oranı düşük olur.',
    visualCue: 'Yaprak ortası yeşil kalırken dış kenarların kahverengi yanması.',
    causes: 'Hafif kumlu topraklar, aşırı magnezyum veya kalsiyum yüklemesi (antagonizma).',
    solution: 'Potasyum Nitrat (13-0-46), Potasyum Sülfat veya KTS (Potasyum Tiyosülfat) yapraktan/damlamadan verilmelidir.',
    recommendedProducts: ['Multi-K 13-0-46', 'SoluPotasse', 'Speedfol K', 'KTS Sıvı Potasyum']
  },
  {
    element: 'Kalsiyum',
    symbol: 'Ca',
    type: 'Makro Besin',
    targetLeaves: 'Genç (Üst) Yapraklar',
    symptoms: 'Genç tepe yapraklarının uçlarında şekil bozukluğu ve kıvrılma (kanca yaprak). Domates ve biberde meyve altında kararma (Çiçek Burnu Çürüklüğü - Blossom End Rot), elmalarda Acı Ben (Bitter Pit).',
    visualCue: 'Meyve dip kısmında siyah çökük leke, taze yaprak uçlarının çürümesi.',
    causes: 'Düzensiz sulama, aşırı sıcak/kuru hava (kalsiyum ksilomla taşınamaz), yüksek potasyum veya amonyum uygulaması.',
    solution: 'Düzenli sulama rejimi, yapraktan Kalsiyum Nitrat veya şelatlı kalsiyum püskürtülmesi.',
    recommendedProducts: ['YaraLiva Calcinit', 'Speedfol Ca', 'Calbit C (Valagro)', 'Wuxal Calcium']
  },
  {
    element: 'Magnezyum',
    symbol: 'Mg',
    type: 'Makro Besin',
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    symptoms: 'Yaşlı yapraklarda ana damarlar yeşil kalırken damar aralarının parlak sarıya dönmesi (V şeklinde damar arası kloroz). İleri safhada yaprak kenarları kıvrılır.',
    visualCue: 'Damarlar ip gibi yeşil, damar araları tamamen sarı.',
    causes: 'Aşırı potasyum gübrelemesi (K-Mg rekabeti), asidik veya aşırı yıkanmış topraklar.',
    solution: 'Magnezyum Sülfat (Epsom Tuzu) yapraktan (%1-2 doz) veya damlamadan uygulaması.',
    recommendedProducts: ['Magnesiogreen', 'YaraTera Krista MAG', 'Mag-Nutri Sıvı Magnezyum']
  },
  {
    element: 'Demir',
    symbol: 'Fe',
    type: 'Mikro Besin',
    targetLeaves: 'Genç (Üst) Yapraklar',
    symptoms: 'Genç tepe yapraklarında ince damarlar dahi yeşil kalırken damar aralarının fildişi/sarı renge dönüşmesi (Sarılık / Kloroz). Ağır durumlarda yaprak tamamen beyazlaşır.',
    visualCue: 'Taze tepe yapraklarında ince yaprak damarları şebeke gibi yeşil, aralar bembeyaz/sarı.',
    causes: 'Yüksek toprak pH (pH > 7.5), yüksek aktif kireç, toprağın aşırı çamur/su altında kalıp kök havalanmasının durması.',
    solution: 'Topraktan EDDHA şelatlı demir (Örn: Fe-%6 EDDHA - Orto-Orto oranı yüksek) veya yapraktan Fe-EDTA uygulaması.',
    recommendedProducts: ['Sequestrene 138 Fe (Syngenta)', 'Basi green Fe-EDDHA', 'Ferro fast', 'YaraVita Fer leaf']
  },
  {
    element: 'Çinko',
    symbol: 'Zn',
    type: 'Mikro Besin',
    targetLeaves: 'Genç (Üst) Yapraklar',
    symptoms: 'Genç yaprakların ufak kalması, boğum aralarının kısalması (Rozetleşme). Mısırda tepe yaprakların iki yanında beyaz/sarı geniş şeritler oluşması.',
    visualCue: 'Meyve ağaçlarında sürgün ucunda minyatür rozet yapraklar.',
    causes: 'Yüksek kireç, yüksek fosforlu gübreleme (P-Zn kilitlenmesi).',
    solution: 'Yapraktan veya topraktan Çinko Sülfat veya Zn-EDTA şelatı uygulaması.',
    recommendedProducts: ['YaraVita Zintrac', 'Speedfol Zinc', 'Zinc 15', 'Wuxal Zinc']
  },
  {
    element: 'Bor',
    symbol: 'B',
    type: 'Mikro Besin',
    targetLeaves: 'Genç (Üst) Yapraklar & Çiçekler',
    symptoms: 'Büyüme noktalarının ölmesi, tepe tomurcuğunun siyahlaşıp kuruması. Çiçek dökümü, polen tüpü oluşamaması. Zeytinde ve şekerpancarından iç çürüklüğü (Öz Çürüklüğü), meyvelerde şekil bozukluğu.',
    visualCue: 'Gövde ve meyvede mantarlaşma, çatlama ve tepe kuruması.',
    causes: 'Kuru hava koşulları, kireçli topraklar, aşırı azot kullanımı.',
    solution: 'Çiçeklenme öncesi ve sonrası yapraktan Etanolamin Bor çözeltileri püskürtülmesi.',
    recommendedProducts: ['YaraVita Bortrac', 'Speedfol Bor', 'Borzin', 'Wuxal Boron']
  }
];

export interface SeasonalCalendarItem {
  season: 'İlkbahar' | 'Yaz' | 'Sonbahar' | 'Kış';
  period: string;
  focusCrops: string;
  tasks: string[];
  keyChemicals: string[];
}

export const SEASONAL_CALENDAR: SeasonalCalendarItem[] = [
  {
    season: 'Kış',
    period: 'Aralık - Şubat',
    focusCrops: 'Meyve Ağaçları, Zeytin, Bağ, Kışlık Buğday',
    tasks: [
      'Meyve ve zeytin ağaçlarında kış budaması sonrası Bordo Bulamacı (%1.5-2) veya Bakır Oksiklorür uygulaması.',
      'Kışlık zararlılar (Kırmızı Örümcek yumurtaları, Kabuklu Bitler) için Kışlık Yağ uygulaması.',
      'Buğday tarlalarında kök boğazı çürüklüğü ve bambul takibi.',
      'Toprak analiz numunelerinin alınması ve taban gübre planlaması.'
    ],
    keyChemicals: ['Bordo Bulamacı', 'Bakır Oksiklorür', 'Kışlık Mineral Yağlar', 'Mancozeb']
  },
  {
    season: 'İlkbahar',
    period: 'Mart - Mayıs',
    focusCrops: 'Pamuk, Mısır, Buğday, Sebzeler, Meyve Ağaçları',
    tasks: [
      'Meyve ağaçlarında pembe/beyaz tomurcuk döneminde karaleke ve monilya koruyucu ilaçlaması.',
      'Buğdayda kardeşlenme bitimi / sapa kalkmada üst azot (Üre/CAN) ve sarı pas + ot ilaçlaması.',
      'Pamuk ve Mısır ekim öncesi taban gübreleme (15-15-15 / 20-20-0 + Zn) ve fide çökerten önlemleri.',
      'Sebze fidelerinin dikimi sonrası ilk köklendirici (MAP + Aminoasit) can suyu uygulaması.'
    ],
    keyChemicals: ['Prothioconazole', 'Tebuconazole', 'Tribenuron-methyl', 'Chlorpyrifos', 'Previcur Energy']
  },
  {
    season: 'Yaz',
    period: 'Haziran - Ağustos',
    focusCrops: 'Pamuk, Mısır, Seralar, Ayçiçeği, Sebzeler, Bağ',
    tasks: [
      'Pamukta taraklanma ve çiçeklenmede Yeşilkurt, Beyazsinek ve Kırmızı Örümcek sıkı takibi.',
      'Mısırda tepe püskülü döllenme dönemi bor ve çinko takviyesi ile mısır kurdu ilaçlaması.',
      'Domates, biber ve hıyarda külleme, mildiyö ve tuta absoluta zararlısı mücadelesi.',
      'Meyve irileşme evresinde Potasyum Nitrat / KTS ile tonaj ve şeker birikimi sağlama.'
    ],
    keyChemicals: ['Coragen (Chlorantraniliprole)', 'Movento (Spirotetramat)', 'Agrimec (Abamectin)', 'Potasyum Nitrat']
  },
  {
    season: 'Sonbahar',
    period: 'Eylül - Kasım',
    focusCrops: 'Hasat Dönemi Ürünler, Hububat Ekimleri, Zeytin Hasadı',
    tasks: [
      'Pamukta makineli hasat öncesi yaprak dökücü (Defoliant) uygulaması.',
      'Zeytinde sinek vuruk takibi ve renk dönümü sonrası hasat hazırlıkları.',
      'Kışlık buğday ve arpa tohumlarının tohum ilaçlaması (Sürme/Rastık önlemi) ile ekimi.',
      'Tarlalarda derin sürüm ve kompoze taban gübrelerinin toprağa karıştırılması.'
    ],
    keyChemicals: ['Thidiazuron + Diuron (Defoliant)', 'Fludioxonil (Tohum İlacı)', 'Deltamethrin', 'Bakır Hidroksit']
  }
];

export const QUICK_AGRI_QUESTIONS = [
  'Domateslerde çiçek burnu çürüklüğü nasıl önlenir?',
  'Pamukta 2. su ne zaman verilmeli ve piksar kullanımı?',
  'Buğdayda pas ilacıyla geniş yapraklı ot ilacı karıştırılır mı?',
  'Serada kırmızı örümceğe karşı biyolojik mücadele nasıl yapılır?',
  'Damla sulamadan kalsiyum ve fosfor neden birlikte verilmez?',
  'Zeytinde halkalı leke için bordo bulamacı dozajı ve zamanı',
  'Mısırda tepe püskülü döneminde hangi mikro elementler verilir?'
];

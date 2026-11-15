export interface TankMixItem {
  id: string;
  category: string;
  compatibleWith: string[];
  conditionalWith: string[];
  incompatibleWith: string[];
  warningNote: string;
  phRange?: string;
}

export interface WaterQualityRule {
  parameter: string;
  idealRange: string;
  riskThreshold: string;
  impact: string;
  correctiveAction: string;
}

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
  imageUrl?: string;
  mobility?: 'Hareketli (Mobil)' | 'Yarı Hareketli' | 'Hareketsiz (İmmobil)';
  optimalPhRange?: string;
  antagonistElements?: string[];
  foliarDosage?: string;
  dripDosage?: string;
  sensitiveCrops?: string[];
}

export interface SeasonalCalendarItem {
  season: 'İlkbahar' | 'Yaz' | 'Sonbahar' | 'Kış';
  period: string;
  focusCrops: string;
  tasks: string[];
  keyChemicals: string[];
  monthlyFocus?: { month: string; priority: string }[];
}

export interface FertilizerStageStep {
  stage: string;
  method: string;
  product: string;
  dosagePerDa: string;
}

export interface ThresholdRule {
  pestOrDisease: string;
  threshold: string;
  samplingMethod: string;
}

export interface CropAgronomyProfile {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  categoryGroup: 'TARLA' | 'SEBZE' | 'MEYVE';
  imageUrl: string;
  vegetationDays: string;
  optimalSoilPh: string;
  soilPreference: string;
  waterRequirementMm: string;
  criticalWaterStages: string;
  targetYieldPerDa: string;
  plantingSpec: string;
  npkPureKgPerDa: string;
  criticalTemp: string;
  harvestCriteria: string;
  fertilizerProgram: FertilizerStageStep[];
  economicThresholds: ThresholdRule[];
  regionalTips: string;
}

export interface ProblemVisualMeta {
  imageUrl: string;
  scientificName?: string;
  modeOfAction?: string;
  culturalControls: string[];
  phiHint?: string;
}

export const WATER_QUALITY_GUIDE: WaterQualityRule[] = [
  {
    parameter: 'Su pH Değeri',
    idealRange: '5.5 – 6.5 (Hafif Asidik)',
    riskThreshold: 'pH > 7.5 (Alkali Hidroliz)',
    impact: 'Organik fosforlu, karbamatlı ve Captan/Bacillus içerikli ilaçlar yüksek pH’da dakikalar içinde parçalanıp etkisini yitirir.',
    correctiveAction: 'İlacı eklemeden önce tank suyunu sitrik asit veya pH düşürücü tampon çözelti ile 5.5–6.5 aralığına çekin.'
  },
  {
    parameter: 'Su Sertliği (CaCO₃)',
    idealRange: '< 150 ppm (Yumuşak Su)',
    riskThreshold: '> 300 ppm (Sert Kuyu Suyu)',
    impact: 'Sudaki Ca²⁺ ve Mg²⁺ katyonları Glyphosate, 2,4-D ve aminoasit şelatlarını bağlayarak etkinliği %40’a kadar düşürür.',
    correctiveAction: 'Herbisitlerden önce %1–2 Amonyum Sülfat veya su yumuşatıcı şelat ajan ekleyin.'
  },
  {
    parameter: 'Su Sıcaklığı & Çamur',
    idealRange: '12°C – 25°C, berrak su',
    riskThreshold: '< 8°C buz gibi veya bulanık kanal suyu',
    impact: 'Soğuk su WP/WG formülasyonların erimesini geciktirir; kil/mil partikülleri Paraquat, Glyphosate ve bakırlı ilaçları adsorbe eder.',
    correctiveAction: 'WG/WP ilaçları ılık suda ön karıştırma (bulamaç) yapın, en az 50 mesh filtre kullanın.'
  }
];

export const TANK_MIX_GUIDE: TankMixItem[] = [
  {
    id: 'BAKIR',
    category: 'Bakırlı İlaçlar (Bordo Bulamacı, Bakır Hidroksit, Bakır Oksiklorür)',
    phRange: 'Nötr / Hafif Alkali (pH 6.8–8.0)',
    compatibleWith: ['Kükürt (Nötr pH aralığında)', 'Mancozeb (Nötr ortamda koruyucu)'],
    conditionalWith: ['Kışlık Mineral Yağlar (Sadece yapraksız kış döneminde)'],
    incompatibleWith: [
      'Organik Fosforlu İnsektisitler',
      'Asidik Yaprak Gübreleri (Fosforik asit, Aminoasit)',
      'Kalsiyum Nitrat & Kükürtlü Aminoasitler',
      'Kuvvetli Yayıcı Yapıştırıcılar / Silikonlar'
    ],
    warningNote: 'Asidik ortamlarda çözünmüş bakır iyonları (Cu²⁺) hızla artarak yaprak ve meyvede pas/yakma (fitotoksisite) yapar. Bakır uygulamaları tek başına yapılmalıdır.'
  },
  {
    id: 'KUKURT',
    category: 'Kükürtlü İlaçlar (Toz / Sıvı Elementel Kükürt)',
    phRange: 'Nötr (pH 6.0–7.5)',
    compatibleWith: ['Sentetik Piretroitler', 'Bakır Hidroksit (Düşük sıcaklıkta)'],
    conditionalWith: ['Triazol & Strobilurin Fungisitler'],
    incompatibleWith: [
      'Yazlık / Kışlık Mineral Yağlar (En az 21 gün ara!)',
      'Captan ve Dikofol içeren formülasyonlar',
      '30°C üzerindeki öğle sıcağı'
    ],
    warningNote: '30°C üzeri sıcaklıkta elementel kükürt süblimleşerek yaprak dokusunu yakar. Yağlı ürünlerle arasında minimum 3 hafta beklenmelidir.'
  },
  {
    id: 'AMINO_ASIT',
    category: 'Amino Asit, Deniz Yosunu & Biyouyarıcılar',
    phRange: 'Hafif Asidik (pH 5.0–6.8)',
    compatibleWith: ['Sistemik Fungisitler', 'İnsektisitlerin Çoğu', 'NPK & EDTA Mikro Elementler'],
    conditionalWith: ['Selektif Herbisitler (Kültür bitkisinde stres riskini artırabilir)'],
    incompatibleWith: ['Tüm Bakırlı İlaçlar (Bordo dahil)', 'Yüksek Derişimli Kalsiyum Nitrat', 'Alkalin Kükürt'],
    warningNote: 'Amino asitler kutikula geçirgenliğini artırarak beraberindeki bakır veya fosfor iyonlarının toksik dozda yaprağa taşınmasına neden olur.'
  },
  {
    id: 'KALSIYUM',
    category: 'Kalsiyum Gübreleri (Kalsiyum Nitrat, Kalsiyum Klorür)',
    phRange: 'Hafif Asidik (pH 5.5–6.8)',
    compatibleWith: ['Bor (Etanolamin)', 'Çinko (EDTA Şelatlı)', 'Üre'],
    conditionalWith: ['Nötr Sistemik Fungisitler (Kavanoz testi ile)'],
    incompatibleWith: [
      'Sülfatlı Gübreler (Potasyum Sülfat, Magnezyum Sülfat, Amonyum Sülfat — Alçı Taşı Çökelir!)',
      'Fosforlu Gübreler (MAP, MKP, Fosforik Asit — Trikalsiyum Fosfat Çökelir!)'
    ],
    warningNote: 'Damla sulama tankında A (Kalsiyum/Demir) ve B (Fosfor/Sülfat/Magnezyum) gübre tankları daima ayrı tutulmalıdır.'
  },
  {
    id: 'HERBISIT',
    category: 'Herbisitler (Geniş / Dar Yapraklı Ot İlaçları)',
    phRange: 'pH 5.0–6.5',
    compatibleWith: ['Non-iyonik Yayıcı Yapıştırıcılar', 'Amonyum Sülfat (%1–2 Su Düzenleyici)'],
    conditionalWith: ['Bazı Piretroit İnsektisitler (Etiket onaylı ise)'],
    incompatibleWith: [
      'Çinko, Demir, Magnezyum Yaprak Gübreleri (Antagonizma!)',
      'Bakırlı ve Yüksek Alkalili İlaçlar',
      'Amino Asit & Hormonlar (Ot öldürmeyi bozar veya kültürü yakar)'
    ],
    warningNote: 'Dar yapraklı herbisitler ile geniş yapraklı herbisitler aynı tankta karıştırıldığında genellikle ot kontrolü %25–40 düşer.'
  },
  {
    id: 'YAGLAR',
    category: 'Yazlık ve Kışlık Mineral Yağlar',
    phRange: 'pH 6.0–7.5',
    compatibleWith: ['Belirli Organik Fosforlu İnsektisitler', 'Abamectin (Düşük doz yayıcı)'],
    conditionalWith: ['Spinosad / IGR İnsektisitler'],
    incompatibleWith: [
      'Kükürt (21 gün ara kuralı)',
      'Captan / Folpet / Dithianon içerikli fungisitler',
      'Herbisitler ve Sıvı Yaprak Gübreleri'
    ],
    warningNote: 'Bitki susuz ve 30°C üzeri sıcakta iken mineral yağ uygulaması stoma tıkanmasına ve yaprak dökümüne yol açar.'
  },
  {
    id: 'INSEKTISIT_OP',
    category: 'Organik Fosforlu, Piretroit ve Diamid İnsektisitler',
    phRange: 'Asidik (pH 5.0–6.2)',
    compatibleWith: ['Nötr Sistemik Fungisitler', 'EDTA Şelatlı Mikro Elementler'],
    conditionalWith: ['Nötr NPK Yaprak Gübreleri'],
    incompatibleWith: [
      'Bordo Bulamacı, Kireçli Kükürt ve Bakır Oksiklorür (Alkali Hidroliz!)',
      'Yüksek pH (> 7.5) Kuyu Suları'
    ],
    warningNote: 'Chlorpyrifos, Lambda-cyhalothrin ve Malathion yüksek pH suda yarı ömrünü saatler içinde kaybeder; su pH’ı mutlaka 5.5–6.0’a indirilmelidir.'
  },
  {
    id: 'FOSFIT_HUMIK',
    category: 'Fosfitler (Potasyum Fosfit) ve Hümik/Fülvik Asitler',
    phRange: 'Fülvik pH 4–8 / Hümik > pH 7.0',
    compatibleWith: ['Nötr Potasyum ve Üre Kaynakları', 'Çoğu Fungisit (Kavanoz testi ile)'],
    conditionalWith: ['Şelatlı Mikro Elementler (Fülvik asit asidik ortamda daha kararlıdır)'],
    incompatibleWith: [
      'Hümik Asit + Düşük pH Güçlü Asitler (Hümik asit pH < 4.5 ortamda jelleşip çöker!)',
      'Kalsiyum Nitrat & Yüksek Derişimli Bakır (Fosfit yaprakta bakır yakmasını tetikler)'
    ],
    warningNote: 'Bakırlı uygulama ile Potasyum Fosfit arasında en az 7–10 gün bırakılmalıdır.'
  }
];

export const MIXING_ORDER_STEPS = [
  '1. Depoyu %50–%65 temiz su ile doldurun ve karıştırıcıyı çalıştırın.',
  '2. Su düzenleyici: pH düşürücü tampon (5.5–6.5) veya sert su şelatlayıcı ekleyin.',
  '3. Köpük kesici ve suda çözünen ambalajları (WSP / WSB) tamamen eritin.',
  '4. Katı toz ve granülleri (WP, WG, WDG, DF) ayrı kovada bulamaç yapıp ekleyin (WALES - W).',
  '5. Süspansiyon akıcı sıvıları (SC, SE, CS, OD, FS) yavaşça karışıma verin (L).',
  '6. Emülsiyon konsantre (EC, EW) ve çözelti (SL) ilaçları ekleyin (E).',
  '7. Yaprak gübreleri (NPK, şelatlı iz element, aminoasit/yosun) ilave edin.',
  '8. En son yayıcı-yapıştırıcı / adjuvanı koyup tank hacmini %100 su ile tamamlayın (S).'
];

export const DEFICIENCY_GUIDE: DeficiencyItem[] = [
  {
    element: 'Azot',
    symbol: 'N',
    type: 'Makro Besin',
    mobility: 'Hareketli (Mobil)',
    optimalPhRange: '6.0 – 7.5',
    antagonistElements: ['Yüksek Karbon (Anız)', 'Aşırı K (Yüksek dozda)'],
    sensitiveCrops: ['Mısır', 'Buğday', 'Pamuk', 'Lahana'],
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Spitskool_stikstofgebrek_%28nitrogen_deficiency%29_Brassica_oleracea_convar._capitata_var._alba.jpg/960px-Spitskool_stikstofgebrek_%28nitrogen_deficiency%29_Brassica_oleracea_convar._capitata_var._alba.jpg',
    symptoms: 'Alt yaşlı yapraklardan başlayan genel soluk yeşil ve sarı renk değişimi (kloroz). Bitki gelişimi duraklar, gövde incelir, alt yapraklar kuruyup erken dökülür; mısırda yaprak ucundan "V" şeklinde sararma tipiktir.',
    visualCue: 'Alt yaprak ayasının tamamı damarlar dahil homojen şekilde sararır.',
    causes: 'Aşırı sulama/yağışla yıkanma, düşük toprak sıcaklığı, anız çürümesinde azot bağlanması, yetersiz gübreleme.',
    solution: 'Topraktan Üre (%46 N), Amonyum Sülfat (%21 N) veya CAN %26; acil durumda yapraktan düşük biüreli Üre + Aminoasit spreyi.',
    foliarDosage: '300–500 g/100 L su (Düşük biüreli Üre) veya %1–2 Üre-Amonyum çözeltisi',
    dripDosage: '3–5 kg saf N/da (Sezona bölünmüş)',
    recommendedProducts: ['Toros Üre %46', 'İgsaş CAN %26', 'UAN 32 Sıvı Azot', 'Speedfol N']
  },
  {
    element: 'Fosfor',
    symbol: 'P',
    type: 'Makro Besin',
    mobility: 'Hareketli (Mobil)',
    optimalPhRange: '6.0 – 7.0',
    antagonistElements: ['Yüksek Kireç (Ca)', 'Yüksek Demir/Alüminyum', 'Aşırı Çinko kilitlenmesi'],
    sensitiveCrops: ['Mısır', 'Pamuk', 'Domates', 'Şeker Pancarı'],
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/94/%D9%86%D9%82%D8%B5_%D8%A7%D9%84%D9%81%D8%B3%D9%81%D9%88%D8%B1_%D8%B9%D9%84%D9%89_%D8%A7%D9%84%D8%B0%D8%B1%D8%A9.jpg',
    symptoms: 'Yaşlı yaprakların alt yüzü, sap ve yaprak kenarlarında antosiyanin birikimine bağlı mor-kırmızı renklenme. Kök gelişimi zayıflar, kardeşlenme ve çiçeklenme gecikir.',
    visualCue: 'Koyu mat yeşil yapraklar üzerinde belirgin morumsu-kırmızı kenarlar.',
    causes: 'Erken ilkbahar soğuk toprak (< 13°C), yüksek pH kireçli topraklarda kalsiyumca fiksasyon.',
    solution: 'Ekimde banda/çiziye MAP, DAP veya 10-52-10; damlamadan Fosforik Asit veya Üre Fosfat ile pH düşürerek kök alımını açma.',
    foliarDosage: '250–350 g/100 L su (10-52-10 veya MKP)',
    dripDosage: '2–4 kg/da MAP (12-61-0) veya 1.5–2 L/da Fosforik Asit',
    recommendedProducts: ['Novalon 10-52-10', 'Haifa MAP 12-61-0', 'Üre Fosfat 17-44-0', 'DAP 18-46-0']
  },
  {
    element: 'Potasyum',
    symbol: 'K',
    type: 'Makro Besin',
    mobility: 'Hareketli (Mobil)',
    optimalPhRange: '6.0 – 7.8',
    antagonistElements: ['Aşırı Kalsiyum (Ca)', 'Aşırı Magnezyum (Mg)', 'Aşırı Amonyum (NH₄⁺)'],
    sensitiveCrops: ['Pamuk', 'Patates', 'Domates', 'Bağ', 'Antep Fıstığı'],
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/K-deficient_dry_bean_5_2012_02_16_Cedara_009.jpg/960px-K-deficient_dry_bean_5_2012_02_16_Cedara_009.jpg',
    symptoms: 'Alt yaprakların uç ve dış kenarlarında sarı hareli yanıklık ve kavrulma (marjinal nekroz). Pamukta "Potasyum Paslanması", domates ve meyvelerde düzensiz kızarma (yeşil omuz) ve şeker/kalibre düşüşü görülür.',
    visualCue: 'Yaprak iç dokusu yeşil kalırken kenarların testere gibi kuruyup kavrulması.',
    causes: 'Aşırı kumlu yıkanmış topraklar, ağır meyve yükü döneminde K tükenmesi, Ca/Mg antagonizması.',
    solution: 'Damlamadan Potasyum Sülfat (0-0-50), Potasyum Nitrat (13-0-46) veya sıvı KTS; meyve irileşme evresinde yapraktan Potasyum takviyesi.',
    foliarDosage: '300–400 g/100 L su (Potasyum Nitrat / Şelatlı K)',
    dripDosage: '3–6 kg/da SoluPotasse / Multi-K (Bölünmüş doz)',
    recommendedProducts: ['Multi-K 13-0-46', 'SoluPotasse (0-0-50+18S)', 'KTS Sıvı Potasyum', 'Speedfol K']
  },
  {
    element: 'Kalsiyum',
    symbol: 'Ca',
    type: 'Makro Besin',
    mobility: 'Hareketsiz (İmmobil)',
    optimalPhRange: '6.2 – 7.8',
    antagonistElements: ['Aşırı Potasyum (K)', 'Aşırı Amonyum (NH₄⁺)', 'Yüksek Tuzluluk (EC)'],
    sensitiveCrops: ['Domates', 'Biber', 'Elma', 'Karpuz', 'Patates'],
    targetLeaves: 'Genç (Üst) Yapraklar',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Blossom_end_rot.JPG/960px-Blossom_end_rot.JPG',
    symptoms: 'Genç tepe yapraklarında kancalaşma ve kenar yanıklığı; domates, biber ve karpuzda meyve dip kısmında siyah çökük çürüklük (Çiçek Burnu Çürüklüğü); elmada Acı Benek (Bitter Pit).',
    visualCue: 'Meyve alt tabanında su emmiş görünümlü siyah çökük yara, genç uçlarda kıvrılma.',
    causes: 'Düzensiz sulama (kurak-yaş şoku), aşırı sıcak ve düşük nemde terleme durması, yüksek NH₄⁺/K yüklemesi.',
    solution: 'Düzenli toprak nemi + damlamadan Kalsiyum Nitrat (ayrı tanktan) + meyve ceviz iriliğinden itibaren düzenli yaprak Kalsiyumu.',
    foliarDosage: '250–350 ml/100 L su (Aminoasit/B kompleksi Ca)',
    dripDosage: '3–5 kg/da Kalsiyum Nitrat (Fosfor/Sülfatsız gün)',
    recommendedProducts: ['YaraLiva Calcinit', 'Calbit C (Valagro)', 'Wuxal Calcium', 'Speedfol Ca']
  },
  {
    element: 'Magnezyum',
    symbol: 'Mg',
    type: 'Makro Besin',
    mobility: 'Hareketli (Mobil)',
    optimalPhRange: '6.0 – 7.8',
    antagonistElements: ['Yüksek Potasyum (K)', 'Yüksek Kalsiyum (Ca)', 'Yüksek Amonyum'],
    sensitiveCrops: ['Domates', 'Bağ', 'Narenciye', 'Patates', 'Pamuk'],
    targetLeaves: 'Yaşlı (Alt) Yapraklar',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Sweetgum-leaf-interveinal-chlorosis.jpg',
    symptoms: 'Klorofil molekülünün merkez atomu olduğu için yaşlı yapraklarda ana damarlar üçgen şeklinde yeşil kalırken damar araları parlak sarı/kırmızıya döner (balık kılçığı deseni).',
    visualCue: 'Yaşlı yaprakta yeşil kalan ana damarlar ve parlak sarı-turuncu damar araları.',
    causes: 'Aşırı potasyum gübrelemesi (K/Mg dengesizliği), hafif asidik ve kumlu topraklar.',
    solution: 'Damlamadan Magnezyum Sülfat (Epsom Tuzu) veya yapraktan Magnezyum Nitrat püskürtülmesi.',
    foliarDosage: '400–600 g/100 L su (Magnezyum Sülfat) veya 250 ml şelatlı Mg',
    dripDosage: '2–4 kg/da Magnezyum Sülfat / Nitrat',
    recommendedProducts: ['Magnesiogreen (%16 MgO)', 'YaraTera Krista MgS', 'Magnisal', 'Wuxal Magnesium']
  },
  {
    element: 'Kükürt',
    symbol: 'S',
    type: 'Makro Besin',
    mobility: 'Yarı Hareketli',
    optimalPhRange: '5.5 – 7.5',
    antagonistElements: ['Yüksek Molibdat (MoO₄²⁻)'],
    sensitiveCrops: ['Soğan', 'Kanola', 'Buğday', 'Mısır', 'Soya'],
    targetLeaves: 'Genç (Üst) Yapraklar',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/63/K-deficient_soyabean_Cedara_2013_02_08_08_24_24_7488.jpg',
    symptoms: 'Azot eksikliğine çok benzer şekilde genel sararma yapar fakat Azotun aksine genç/üst yapraklarda belirir! Soğan ve lahana grubunda aroma düşüşü, buğdayda erken dönemde sapsarı tarla görünümü oluşturur.',
    visualCue: 'Üst genç yaprakların tamamının soluk limon sarısı renk alması.',
    causes: 'Yüksek saf Üre kullanılıp Sülfatlı gübre atlanılması, düşük organik madde, yıkanma.',
    solution: 'Üst gübrelemede Amonyum Sülfat (%21 N + %24 S), sıvı elementel kükürt veya KTS/MgSO₄ takviyesi.',
    foliarDosage: '200–300 ml/100 L su (Mikronize sıvı kükürt — < 28°C)',
    dripDosage: '3–5 kg/da Amonyum Sülfat veya 1–2 L KTS',
    recommendedProducts: ['Toros Amonyum Sülfat %21', 'Thiovit Jet', 'KTS Sıvı Kükürt', 'Mikro-S']
  },
  {
    element: 'Demir',
    symbol: 'Fe',
    type: 'Mikro Besin',
    mobility: 'Hareketsiz (İmmobil)',
    optimalPhRange: '5.0 – 6.8',
    antagonistElements: ['Yüksek Kireç / Bikarbonat (HCO₃⁻)', 'Aşırı Fosfor', 'Yüksek Bakır/Mangan'],
    sensitiveCrops: ['Şeftali', 'Bağ', 'Narenciye', 'Çilek', 'Antep Fıstığı', 'Mısır'],
    targetLeaves: 'Genç (Üst) Yapraklar',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d6/Clorosi_fulles_llimonerhu.JPG/960px-Clorosi_fulles_llimonerhu.JPG',
    symptoms: 'En genç sürgün uçlarındaki yapraklarda en ince kılcal damarlar dahi ince yeşil ağ gibi kalırken damar araları limon sarısına veya fildişi beyazına döner (Kireç Sarılığı).',
    visualCue: 'Sürgün ucunda bembeyaz yaprak üzerinde keskin yeşil ince damar ağı.',
    causes: 'Yüksek pH (> 7.5), yüksek aktif kireç (%15+), sulamada bikarbonatlı kuyu suyu ve aşırı taban suyu/havasız kök bölgesi.',
    solution: 'Yüksek pH topraklarda mutlaka pH 4–9 stabil **Fe-EDDHA (Orto-Orto oranı ≥ %4.2–4.8)** kökten uygulanmalıdır; acil durumlarda yapraktan Fe-DTPA/EDTA verilir.',
    foliarDosage: '100–150 g/100 L su (Fe-EDTA / Fe-DTPA akşam serinliğinde)',
    dripDosage: '0.5–1.5 kg/da (Tarla/Sebze) • 30–80 g/ağaç Fe-EDDHA %6',
    recommendedProducts: ['Sequestrene 138 Fe (Syngenta)', 'BasiGreen Fe-EDDHA %4.8 o-o', 'FerroFast', 'YaraVita Ferritrac']
  },
  {
    element: 'Çinko',
    symbol: 'Zn',
    type: 'Mikro Besin',
    mobility: 'Yarı Hareketli',
    optimalPhRange: '5.5 – 7.0',
    antagonistElements: ['Yüksek Fosfor (P-Zn Kilitlenmesi!)', 'Yüksek pH ve Kireç'],
    sensitiveCrops: ['Mısır', 'Buğday', 'Narenciye', 'Elma', 'Antep Fıstığı', 'Pamuk'],
    targetLeaves: 'Genç (Üst) Yapraklar',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Citrus_limon_leaf_-_unidentified_deficiency.jpg',
    symptoms: 'Genç yapraklar küçülür (küçük yapraklılık), sürgün boğum araları kısalır ve uçta "Rozetleşme" oluşur. Mısırda erken evrede orta damar yanlarında geniş sarımsı-beyaz bantlar görülür.',
    visualCue: 'Sürgün ucunda küçülmüş dar rozet yapraklar; mısır yaprağında beyaz-sarı şeritler.',
    causes: 'Türkiye topraklarının %50’sinden fazlasında yüksek kireç ve aşırı taban DAP/TSP fosfor uygulaması (P-Zn antagonizması).',
    solution: 'Mısır ve buğday ekiminde çinkolu taban gübresi (15-15-15+Zn) veya tohum kaplama; meyvede çiçek öncesi ve hasat sonrası yüksek konsantreli çinko spreyi.',
    foliarDosage: '150–250 ml/100 L su (Zn-EDTA veya Sıvı Çinko Oksit)',
    dripDosage: '300–500 g/da Çinko Sülfat veya Zn-EDTA',
    recommendedProducts: ['YaraVita Zintrac', 'Speedfol Zinc', 'Zinc 15 EDTA', 'Wuxal Zinc']
  },
  {
    element: 'Bor',
    symbol: 'B',
    type: 'Mikro Besin',
    mobility: 'Hareketsiz (İmmobil)',
    optimalPhRange: '5.5 – 7.2',
    antagonistElements: ['Aşırı Kalsiyum', 'Kuvvetli Kireç', 'Aşırı Kuraklık'],
    sensitiveCrops: ['Zeytin', 'Ayçiçeği', 'Şeker Pancarı', 'Pamuk', 'Elma', 'Antep Fıstığı', 'Bağ'],
    targetLeaves: 'Genç (Üst) Yapraklar & Çiçekler',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ad/Banana_%28Musa_sp.%29-_Boron_deficiency_and_black_leaf_streak_disease.jpg/960px-Banana_%28Musa_sp.%29-_Boron_deficiency_and_black_leaf_streak_disease.jpg',
    symptoms: 'Büyüme uçlarında ölüm ve kırılganlık; polen tüpü oluşamadığı için şiddetli çiçek ve küçük meyve dökümü ("boncuklanma"); şeker pancarında Öz Çürüklüğü, zeytinde maymun yüzü meyve, pamukta koza içi döküm.',
    visualCue: 'Çiçek tutmama, meyve yüzeyinde mantarlaşma/çatlama ve sürgün ucu kuruması.',
    causes: 'Kuraklık (bor kütle akışıyla taşınır), yüksek pH kireçli veya yıkanmış kumlu topraklar.',
    solution: 'Çiçeklenme öncesi (pembe tomurcuk / taraklanma) mutlaka düşük dozda Etanolamin Bor uygulaması; doz aşımına dikkat edilmelidir (toksisite eşiği dardır!).',
    foliarDosage: '100–150 ml/100 L su (Etanolamin Bor — Doz aşmayın!)',
    dripDosage: '150–300 g/da Disodyum Oktaborat (Etidot-67)',
    recommendedProducts: ['YaraVita Bortrac', 'Etidot-67 (%20.8 B)', 'Speedfol Bor', 'Borocal']
  },
  {
    element: 'Mangan',
    symbol: 'Mn',
    type: 'Mikro Besin',
    mobility: 'Hareketsiz (İmmobil)',
    optimalPhRange: '5.0 – 6.5',
    antagonistElements: ['Yüksek Demir', 'Yüksek pH (> 7.2)', 'Çok Kuru/Kabarık Toprak'],
    sensitiveCrops: ['Soya Fasulyesi', 'Buğday', 'Arpa', 'Şeker Pancarı', 'Narenciye'],
    targetLeaves: 'Genç (Üst) Yapraklar',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/K-deficient_dry_bean_5_2012_02_16_Cedara_009.jpg/960px-K-deficient_dry_bean_5_2012_02_16_Cedara_009.jpg',
    symptoms: 'Genç yapraklarda damar araları sararırken ince damarların yeşil kaldığı balıksırtı görünümü (Demir eksikliğinden farkı dokunun bembeyaz değil zeytuni sarı olması ve ince kahverengi beneklerdir). Yulaf/buğdayda "Gri Benek".',
    visualCue: 'Genç yapraklarda damar arası sarı-yeşil mozaik ve zamanla küçük kahverengi nekroz benekleri.',
    causes: 'Kireçli ve yüksek pH alkali topraklar, yüksek organik maddeli gevşek turba toprakları.',
    solution: 'Yapraktan Mn-EDTA şelatı veya Mangan Sülfat uygulaması (kökten verilen Mn alkali toprakta hızla okside olup bağlanır).',
    foliarDosage: '150–250 g/100 L su (Mn-EDTA veya %32 Mangan Sülfat)',
    dripDosage: '250–400 g/da Mn-EDTA (Asidik gübrelerle)',
    recommendedProducts: ['YaraVita Mantrac Pro', 'Mn-EDTA %13', 'Librel Mn', 'Speedfol Mn']
  },
  {
    element: 'Bakır',
    symbol: 'Cu',
    type: 'Mikro Besin',
    mobility: 'Hareketsiz (İmmobil)',
    optimalPhRange: '5.5 – 7.0',
    antagonistElements: ['Aşırı Fosfor', 'Yüksek Organik Madde (Turba)', 'Aşırı Azot'],
    sensitiveCrops: ['Buğday', 'Arpa', 'Narenciye', 'Soğan'],
    targetLeaves: 'Genç (Üst) Yapraklar',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Starr-120608-7321-Brassica_rapa-broccoli_rabe_leaf_with_copper_deficiency-Ulupalakua_Ranch-Maui_%2824777617959%29.jpg/960px-Starr-120608-7321-Brassica_rapa-broccoli_rabe_leaf_with_copper_deficiency-Ulupalakua_Ranch-Maui_%2824777617959%29.jpg',
    symptoms: 'Genç yaprakların uçlarında burkulma ("kamçı yaprak"), solgunluk, beyazlaşma ve başakların boş (kısır) kalması. Narenciyede "Ekzantem" (zamk akıntılı sürgün kuruması).',
    visualCue: 'Tahıllarda bayrak yaprak ucunun iplik gibi kıvrılıp solması, başak ucunun boş kalması.',
    causes: 'Yüksek humuslu/organik topraklar, yoğun NPK gübrelemesi sonrası iz element ihmal edilmesi.',
    solution: 'Yapraktan Cu-EDTA şelatı (bakır hidroksit içeren hastalık ilaçlamaları da kısmen bakır ihtiyacını karşılar).',
    foliarDosage: '75–150 g/100 L su (Cu-EDTA %14 — Yaprak yakmamak için doz aşılmamalı)',
    dripDosage: '100–250 g/da Cu-EDTA',
    recommendedProducts: ['YaraVita Coptrac', 'Cu-EDTA %14', 'Kocide 2000 (Koruyucu)']
  },
  {
    element: 'Molibden',
    symbol: 'Mo',
    type: 'Mikro Besin',
    mobility: 'Hareketli (Mobil)',
    optimalPhRange: '6.5 – 8.0',
    antagonistElements: ['Düşük pH (< 5.5 Asit Toprak!)', 'Yüksek Sülfat (SO₄²⁻)'],
    sensitiveCrops: ['Karnabahar', 'Lahana', 'Mercimek', 'Soya', 'Kavun'],
    targetLeaves: 'Genç (Üst) Yapraklar & Çiçekler',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Mo-def-points2.jpg/960px-Mo-def-points2.jpg',
    symptoms: 'Baklagillerde kök nodüllerinde Rhizobium bakterisi azot bağlayamaz (azot eksikliği gibi genel sararma). Lahanagillerde yaprak ayası daralıp sadece orta damar kalır ("Kamçı Kuyruk - Whiptail").',
    visualCue: 'Asidik toprakta daralmış büzüşük yapraklar ve uç yanıklığı.',
    causes: 'Çok asidik topraklar (Diğer mikro elementlerin aksine Mo asit toprakta bağlanır!) ve yoğun Sülfat uygulamaları.',
    solution: 'Asit toprakların kireçlenerek pH’ının 6.5’e yükseltilmesi, tohum ekiminde veya yapraktan Sodyum/Amonyum Molibdat uygulaması.',
    foliarDosage: '30–50 g/100 L su (Sodyum Molibdat veya Bor+Molibden kompleksi)',
    dripDosage: '50–100 g/da Molibden Şelatı / Tohum Kaplama',
    recommendedProducts: ['Molitrac', 'Bor-Mo Sıvı', 'Sodyum Molibdat %39 Mo', 'YaraVita Bortrac + Mo']
  }
];

export const SEASONAL_CALENDAR: SeasonalCalendarItem[] = [
  {
    season: 'Kış',
    period: 'Aralık – Şubat',
    focusCrops: 'Meyve Ağaçları, Zeytin, Bağ, Kışlık Buğday & Arpa',
    tasks: [
      'Meyve ağaçları, zeytin ve bağda kış budaması sonrası budama yaralarını koruma ve Bordo Bulamacı (%1.5–2) veya Bakır Oksiklorür uygulaması.',
      'Kabuklu bitler, San Jose ve Kırmızı Örümcek kış yumurtalarına karşı gözler uyanmadan Kışlık Mineral Yağ uygulaması.',
      'Kışlık hububatta (Buğday/Arpa) kök boğazı çürüklüğü kontrolü ve toprak üstü su birikintilerinin tahliyesi.',
      'Toprak analiz numunelerinin alınarak bahar taban gübrelemesinin (NPK + kükürt/organik madde) planlanması.'
    ],
    keyChemicals: ['Bordo Bulamacı', 'Bakır Oksiklorür', 'Kışlık Mineral Yağlar', 'Triadimenol'],
    monthlyFocus: [
      { month: 'Aralık', priority: 'Budama ve %2 Bordo Bulamacı ile dal kanseri/bakteriyel koruma' },
      { month: 'Ocak', priority: 'Toprak analizi, kış yağış drenajı ve hububatta ekin kambur böceği kontrolü' },
      { month: 'Şubat', priority: 'Gözler kabarmadan kışlık mineral yağ + bahar taban gübresi stok hazırlığı' }
    ]
  },
  {
    season: 'İlkbahar',
    period: 'Mart – Mayıs',
    focusCrops: 'Pamuk, Mısır, Buğday, Antep Fıstığı, Sebze Fideleri, Meyveler',
    tasks: [
      'Meyve ağaçlarında pembe/beyaz tomurcukta Elma Karalekesi, Monilya ve Antepfıstığı Karazenk koruyucu ilaçlamaları.',
      'Buğdayda kardeşlenme bitimi/sapa kalkmada 1. ve 2. üst azot (Üre/CAN) + Süne/Kımıl kışlak çıkışı ve Sarı Pas takibi + yabancı ot mücadelesi.',
      'Pamuk ve Mısır ekim öncesi taban gübre (20-20-0 / 15-15-15+Zn), çıkış öncesi herbisit ve fide çökerteni/bozkurt tedbirleri.',
      'Sebze fidelerinin şaşırtılmasıyla birlikte yüksek fosforlu (10-52-10 MAP) + hümik/köklendirici can suyu uygulaması.'
    ],
    keyChemicals: ['Prothioconazole', 'Tebuconazole', 'Tribenuron-methyl', 'Tefluthrin', 'Pendimethalin'],
    monthlyFocus: [
      { month: 'Mart', priority: 'Hububat kardeşlenme üst gübre & pas/ot ilaçlaması; bağ-meyvede göz uyanması' },
      { month: 'Nisan', priority: 'Pamuk ve Mısır ekimi, bozkurt kontrolü; Antepfıstığı Psillidi 1. döl takibi' },
      { month: 'Mayıs', priority: 'Pamuk tarak başlangıcı ve thrips/yaprakbiti; meyvelerde Elma İçkurdu 1. ilaçlama' }
    ]
  },
  {
    season: 'Yaz',
    period: 'Haziran – Ağustos',
    focusCrops: 'Pamuk, Mısır, Sebze & Seralar, Ayçiçeği, Bağ, Antep Fıstığı',
    tasks: [
      'Pamukta taraklanma–çiçeklenme boyunca Yeşilkurt, Beyazsinek, Kırmızı Örümcek (iki noktalı) ve Lygus böceği EZE takipli ilaçlamalar.',
      'Mısırda V6–V12 ve tepe püskülü öncesi Mısır Kurdu + Pamuk Çizgili Yaprakkurdu kontrolü ve yapraktan Bor + Çinko uygulaması.',
      'Domates, biber ve patlıcanda Tuta absoluta feromon tuzak takibi, Külleme/Mildiyö ve Çiçek Burnu Çürüklüğü için Kalsiyum takviyesi.',
      'Meyve irileşme ve pamuk koza tutumu döneminde yüksek Potasyum (0-0-50 / 13-0-46) ve ısı stresi yönetimi.'
    ],
    keyChemicals: ['Chlorantraniliprole', 'Spirotetramat', 'Emamectin Benzoate', 'Abamectin', 'Azoxystrobin'],
    monthlyFocus: [
      { month: 'Haziran', priority: 'Pamuk taraklanma Mepiquat Chloride (boy düzenleme), mısır azot üst gübre & kurt' },
      { month: 'Temmuz', priority: 'Sıcaklık stresinde sulama sıklığı, Pamuk Beyazsineği ve Kırmızı Örümcek pik takibi' },
      { month: 'Ağustos', priority: 'Koza/meyve dolumu Potasyum sülfat, bağda külleme/botrytis ve son hasat aralığı (PHI)' }
    ]
  },
  {
    season: 'Sonbahar',
    period: 'Eylül – Kasım',
    focusCrops: 'Pamuk Hasadı, Kışlık Hububat Ekimi, Zeytin, Bağ, Meyve Bahçeleri',
    tasks: [
      'Pamukta kozaların %60–70 açtığı dönemde makineli hasat öncesi yaprak dökücü (Defoliant) ve koza açtırıcı uygulaması.',
      'Zeytinde Zeytin Sineği vuruk kontrolü ve yaprak dökümü sonrası Halkalı Leke (Spilocaea oleagina) bakırlı koruması.',
      'Kışlık buğday, arpa ve mercimek tohumlarının Sürme ve Rastık hastalıklarına karşı tohum ilacıyla ilaçlanarak ekilmesi.',
      'Meyve ağaçlarında hasat sonrası yapraklar dökülmeden "Göz Besleme" (Yapraktan %5 Çinko + Bor + Üre) yüklemesi.'
    ],
    keyChemicals: ['Thidiazuron + Diuron', 'Fludioxonil + Difenoconazole', 'Bakır Oksiklorür', 'Potasyum Nitrat'],
    monthlyFocus: [
      { month: 'Eylül', priority: 'Pamuk defoliant hazırlığı, zeytin sineği takibi ve domates/biber son hasat PHI kontrolü' },
      { month: 'Ekim', priority: 'Meyvelerde hasat sonrası göz besleme (Zn+B), hububat toprak işleme ve taban gübresi' },
      { month: 'Kasım', priority: 'Kışlık buğday/arpa/mercimek ekimi, yaprak dökümü %75 olduğunda sonbahar Bordo Bulamacı' }
    ]
  }
];

export const QUICK_AGRI_QUESTIONS = [
  'Domateslerde çiçek burnu çürüklüğü neden olur ve nasıl önlenir?',
  'Pamukta taraklanma döneminde Yeşilkurt ekonomik zarar eşiği nedir?',
  'Buğdayda sarı pas ilacıyla geniş yapraklı ot ilacı aynı tankta karışır mı?',
  'Yüksek kireçli toprakta Demir sarılığı için EDTA mı EDDHA mı kullanılmalı?',
  'Damla sulamadan Kalsiyum Nitrat ve MAP neden aynı gün verilmez?',
  'Antepfıstığında Psillid (Fıstık Ballığı) için en doğru ilaçlama zamanı nedir?',
  'Mısırda çinko noksanlığı beyaz çizgileri hangi dönemde önlenir?'
];

export const CROP_AGRONOMY_PROFILES: Record<string, CropAgronomyProfile> = {
  PAMUK: {
    id: 'PAMUK',
    name: 'Pamuk',
    scientificName: 'Gossypium hirsutum',
    family: 'Malvaceae (Ebegümecigiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/CottonPlant.JPG/500px-CottonPlant.JPG',
    vegetationDays: '150–175 Gün',
    optimalSoilPh: 'pH 6.2 – 7.8 (Derin tınlı, drenajı iyi alüvyal toprak)',
    soilPreference: 'Tuzluluğa orta dayanıklı; kaymak tabakası yapmayan tınlı bünye',
    waterRequirementMm: '650–850 mm (Karık veya Damla Sulama)',
    criticalWaterStages: 'Çiçeklenme başlangıcı ve Koza bağlama dönemi (susuzluk koza döker)',
    targetYieldPerDa: '480 – 650 kg/da Kütlü Pamuk',
    plantingSpec: 'Sıra arası 70–75 cm, sıra üzeri 12–16 cm • Tohum: 2.2–2.8 kg/da • Derinlik: 3–4 cm',
    npkPureKgPerDa: '16–20 kg N • 6–8 kg P₂O₅ • 8–12 kg K₂O',
    criticalTemp: 'Çimlenme min. 15°C • Çiçek/koza tutumu optimum 27–32°C',
    harvestCriteria: 'Kozaların %65–75 açtığı, lif neminin %12 altına düştüğü dönem',
    fertilizerProgram: [
      { stage: 'Ekim Öncesi Taban', method: 'Bant / Fırfır + Toprak Altı', product: '20-20-0+Zn veya 15-15-15 Kompoze', dosagePerDa: '30–35 kg/da' },
      { stage: 'Taraklanma Öncesi (1. Üst)', method: 'Çapa ile Sıra Arası / Damlama', product: 'Üre (%46 N) veya Amonyum Sülfat', dosagePerDa: '15–18 kg/da' },
      { stage: 'Çiçeklenme – İlk Koza', method: 'Damlama + Yaprak', product: 'CAN %26 + Yapraktan Bor & Çinko', dosagePerDa: '12–15 kg/da + 150 ml Bor' },
      { stage: 'Koza Gelişimi & Dolum', method: 'Damlama Sulama', product: 'Potasyum Nitrat (13-0-46) / Potasyum Sülfat', dosagePerDa: '8–10 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Pamuk Yaprakbiti / Thrips', threshold: 'Fide döneminde yaprak başına 10–15 adet trips veya yaprakların %50 kıvrılması', samplingMethod: '100 rastgele fide alt yaprak sayımı' },
      { pestOrDisease: 'Yeşilkurt (Helicoverpa armigera)', threshold: '100 bitkide ortalama 2 larva (küçük larva evresi)', samplingMethod: 'Zikzak yürüyüşle 100 tepe sürgünü ve tarak kontrolü' },
      { pestOrDisease: 'Tütün Beyazsineği (Bemisia tabaci)', threshold: 'Yaprak başına 5 ergin veya 10 nimf/pupa', samplingMethod: 'Bitkinin orta kat yapraklarında alt yüzey kontrolü' },
      { pestOrDisease: 'İki Noktalı Kırmızıörümcek', threshold: 'Mücadele eşiği yaprak başına 5–10 birey (Kışlık veya lokal bulaşma)', samplingMethod: 'Tarla kenarlarından içe doğru yaprak incelemesi' }
    ],
    regionalTips: 'Şanlıurfa (GAP) ve Çukurova koşullarında boylanmayı önlemek ve erken koza bağlamak için taraklanma sonrası Mepiquat Chloride (BGD) uygulaması verimi korur; hasat öncesi %60 koza açımında Thidiazuron+Diuron defoliant uygulanır.'
  },
  MISIR: {
    id: 'MISIR',
    name: 'Mısır',
    scientificName: 'Zea mays',
    family: 'Poaceae (Buğdaygiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/VegCorn.jpg/500px-VegCorn.jpg',
    vegetationDays: '115–140 Gün (Ana Ürün) • 95–105 Gün (İkinci Ürün)',
    optimalSoilPh: 'pH 5.8 – 7.5 (Organik maddece zengin derin tınlı toprak)',
    soilPreference: 'Su tutmayan, havalanması yüksek nötr pH topraklar',
    waterRequirementMm: '550–750 mm (Yağmurlama / Damlama)',
    criticalWaterStages: 'Tepe püskülü – Püskül çıkarma ve Süt olumu (en kritik dönem)',
    targetYieldPerDa: '1.150 – 1.550 kg/da Dane • 6–8 Ton/da Silaj',
    plantingSpec: 'Sıra arası 70 cm, sıra üzeri 15–18 cm • 8.000–9.000 tohum/da • Derinlik: 4–5 cm',
    npkPureKgPerDa: '22–28 kg N • 8–10 kg P₂O₅ • 8–12 kg K₂O + Çinko',
    criticalTemp: 'Toprak 10–12°C ekim • Döllenmede 38°C üzeri poleni yakar',
    harvestCriteria: 'Danede siyah tabaka oluşumu ve nemin %15–18 seviyesine inmesi',
    fertilizerProgram: [
      { stage: 'Ekim / Taban (Starter)', method: 'Banda Ekimle', product: '18-46-0 DAP veya Mikrogranül 10-52-10+Zn', dosagePerDa: '20–25 kg/da (veya 3 kg/da starter)' },
      { stage: '5–7 Yapraklı Dönem (V6)', method: 'Çapa veya Damlama', product: 'Üre (%46 N) + Yapraktan Çinko EDTA', dosagePerDa: '20–25 kg/da + 200 ml Zn' },
      { stage: 'Diz Boyu – Hızlı Uzama (V10)', method: 'Damlama / Karık', product: 'UAN 32 veya CAN %26', dosagePerDa: '18–22 kg/da' },
      { stage: 'Tepe Püskülü Öncesi (VT)', method: 'Damlama / Yaprak', product: 'Potasyum Nitrat + Bor', dosagePerDa: '6–8 kg/da + 120 ml Bor' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Mısır Kurdu (Ostrinia nubilalis)', threshold: 'Bitkilerin %5’inde yaprakta taze yeniş deliği ve yumurta paketi', samplingMethod: '100 bitkide gövde ve boğum yaprak koltuğu kontrolü' },
      { pestOrDisease: 'Pamuk Çizgili Yaprakkurdu / Yeşilkurt', threshold: 'V4–V8 arası yapraklarda 100 bitkide %10 taze yaprak yenik oranı', samplingMethod: 'Yaprak huni içi larva kontrolü' },
      { pestOrDisease: 'Bozkurt (Agrotis spp.)', threshold: 'm²’de 2–3 larva veya %5 kesilmiş genç fide', samplingMethod: 'Fide sıralarında toprak 5 cm kazılarak larva araması' }
    ],
    regionalTips: 'İkinci ürün mısır ekimlerinde yüksek sıcaklık polen canlılığını düşürebilir; V6–V8 arasında Çinko (Zn) ihmal edilirse yapraklarda beyaz bant (çinko kilitlenmesi) verimi %25 düşürür.'
  },
  BUGDAY: {
    id: 'BUGDAY',
    name: 'Buğday',
    scientificName: 'Triticum aestivum / T. durum',
    family: 'Poaceae (Buğdaygiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Bl%C3%A9_tendre_%28GRAPELLI%29_AO-5-cliche_Jean_Weber_%285%29_%2823975019962%29.jpg/500px-Bl%C3%A9_tendre_%28GRAPELLI%29_AO-5-cliche_Jean_Weber_%285%29_%2823975019962%29.jpg',
    vegetationDays: '210–250 Gün (Kışlık Ekim)',
    optimalSoilPh: 'pH 6.0 – 7.8 (Killi-tınlı verimli toprak)',
    soilPreference: 'Drenajı iyi, ağır olmayan killi-tınlı toprak',
    waterRequirementMm: '400–550 mm (Yağış + Sapa Kalkma/Başaklama Takviye Sulama)',
    criticalWaterStages: 'Sapa kalkma ve Başaklanma–Süt olumu',
    targetYieldPerDa: '500 – 850 kg/da (Sulu) • 300 – 450 kg/da (Kuru)',
    plantingSpec: 'Sıra arası 12–14 cm • Tohum: 20–24 kg/da (450–500 tohum/m²) • Derinlik: 4–5 cm',
    npkPureKgPerDa: '12–16 kg N • 6–8 kg P₂O₅ • 4–6 kg K₂O',
    criticalTemp: 'Kardeşlenmede kar altı -20°C dayanır • Çiçeklenmede -2°C don zararı',
    harvestCriteria: 'Danelere tırnak geçmeyecek kadar sertleştiği ve nemin %13 altında olduğu dönem',
    fertilizerProgram: [
      { stage: 'Sonbahar Ekim (Taban)', method: 'Mibzerle Toprak Altı', product: '18-46-0 DAP veya 20-20-0+Zn', dosagePerDa: '18–22 kg/da' },
      { stage: 'Kardeşlenme Başlangıcı (Şubat–Mart)', method: 'Fırfır ile Serpme', product: 'Üre (%46 N) — Sadece toprak nemliyken', dosagePerDa: '14–18 kg/da' },
      { stage: 'Sapa Kalkma (Mart Sonu–Nisan)', method: 'Üst Gübreleme', product: 'CAN %26 veya Amonyum Sülfat %21', dosagePerDa: '15–18 kg/da' },
      { stage: 'Bayrak Yaprak & Pas İlaçlaması', method: 'Pülverizatörle Yaprak', product: 'Sıvı Çinko + Mangan + Potasyum', dosagePerDa: '200 ml/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Süne (Eurygaster integriceps)', threshold: 'Kışlaktan inenlerde m²’de 0.8–1.0 ergin • Yeni nesilde m²’de 10+ nimf', samplingMethod: '1/4 m² çerçeve atılarak ergin/nimf sayımı' },
      { pestOrDisease: 'Sarı Pas (Puccinia striiformis)', threshold: 'Tarlada ilk pas püstülleri ve bayrak yaprak altı bulaşması %5 olduğunda', samplingMethod: 'Tarla içi 5 noktada yaprak kontrolü' },
      { pestOrDisease: 'Geniş ve Dar Yapraklı Otlar', threshold: 'm²’de 3–5 yabancı ot veya tarla hardalı/yabani yulaf yoğunluğu', samplingMethod: 'Kardeşlenme–sapa kalkma öncesi herbisit kontrolü' }
    ],
    regionalTips: 'Süne mücadelesinde gereksiz ergin ilaçlamasından kaçınıp devlet/ilçe tarım eşik ilanlarına göre nimf döneminde ilaçlama yapılmalı; bayrak yaprağı Sarı Pas ve Septoryaya karşı korumak verimin %40’ını garanti eder.'
  },
  ARPA: {
    id: 'ARPA',
    name: 'Arpa',
    scientificName: 'Hordeum vulgare',
    family: 'Poaceae (Buğdaygiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Barley_%28Hordeum_vulgare%29_-_United_States_National_Arboretum_-_24_May_2009.jpg/500px-Barley_%28Hordeum_vulgare%29_-_United_States_National_Arboretum_-_24_May_2009.jpg',
    vegetationDays: '185–220 Gün',
    optimalSoilPh: 'pH 6.2 – 8.0 (Tuzluluğa buğdaydan daha toleranslı)',
    soilPreference: 'Kireçli ve orta verimli topraklarda yüksek performans',
    waterRequirementMm: '350–450 mm',
    criticalWaterStages: 'Kardeşlenme sonu ve Başaklanma dönemi',
    targetYieldPerDa: '450 – 700 kg/da (Sulu) • 280 – 400 kg/da (Kuru)',
    plantingSpec: 'Sıra arası 12–14 cm • Tohum: 18–22 kg/da • Derinlik: 4–5 cm',
    npkPureKgPerDa: '10–13 kg N • 5–7 kg P₂O₅',
    criticalTemp: 'Kış soğuğuna buğdaydan hassas; -12°C altı örtüsüz zarar riski',
    harvestCriteria: 'Başakların eğildiği ve dane neminin %13 altına düştüğü evre (yatma öncesi)',
    fertilizerProgram: [
      { stage: 'Ekim (Taban)', method: 'Mibzerle', product: '20-20-0 Kompoze veya 18-46-0 DAP', dosagePerDa: '15–20 kg/da' },
      { stage: 'Kardeşlenme (Bahar Başı)', method: 'Üst Gübre', product: 'Üre (%46 N) veya Amonyum Sülfat', dosagePerDa: '12–15 kg/da' },
      { stage: 'Sapa Kalkma (Yatmaya Dikkat!)', method: 'Düşük Doz Üst Gübre', product: 'CAN %26 (Bireysel yatma riskinde azot kısılır)', dosagePerDa: '8–10 kg/da' },
      { stage: 'Yaprak Lekesi Mücadelesiyle', method: 'Pülverizatörle', product: 'Sıvı Çinko + Mangan', dosagePerDa: '150 ml/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Arpa Yaprak Lekesi (Rhynchosporium / Net Blotch)', threshold: 'Üstten 2. yaprakta %5–10 leke alanı görüldüğünde', samplingMethod: 'Sapa kalkma–başak öncesi 50 sap kontrolü' },
      { pestOrDisease: 'Ekin Kambur Böceği (Zabrus)', threshold: 'Sonbaharda m²’de 3–4 larva veya yaprakların tespih gibi bükülmesi', samplingMethod: 'Tarla kenar sıralarında erken çıkış gözlemi' }
    ],
    regionalTips: 'Maltlık ve yemlik arpada aşırı azot yatmaya ve protein sapmasına yol açar; tohumun Sürme/Kapalı Rastık için mutlaka fungisitle ilaçlanması şarttır.'
  },
  AYCICEGI: {
    id: 'AYCICEGI',
    name: 'Ayçiçeği',
    scientificName: 'Helianthus annuus',
    family: 'Asteraceae (Papatyagiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Sunflower_sky_backdrop.jpg/500px-Sunflower_sky_backdrop.jpg',
    vegetationDays: '110–135 Gün',
    optimalSoilPh: 'pH 6.0 – 7.8 (Derin köklenebilen tınlı toprak)',
    soilPreference: 'Kazık kök için taban taşı kırılmış derin topraklar',
    waterRequirementMm: '450–600 mm',
    criticalWaterStages: 'Tabla oluşumu (yıldız evresi) ve Çiçeklenme–Tane dolumu',
    targetYieldPerDa: '280 – 450 kg/da (Yağlık Hibrit)',
    plantingSpec: 'Sıra arası 70 cm, sıra üzeri 22–28 cm • 5.000–6.000 bitki/da • Derinlik: 4–5 cm',
    npkPureKgPerDa: '10–14 kg N • 6–8 kg P₂O₅ • 6–10 kg K₂O + Bor',
    criticalTemp: '8°C toprak ekimi • Çiçeklenme 22–28°C (Arı tozlaşması kritik)',
    harvestCriteria: 'Tabla arkasının limon/kahverengiye döndüğü, tane neminin %10–12 olduğu evre',
    fertilizerProgram: [
      { stage: 'Ekim / Taban', method: 'Banda veya Karıştırma', product: '15-15-15 Kompoze veya 20-20-0', dosagePerDa: '25–30 kg/da' },
      { stage: '4–6 Yaprak (Boğaz Doldurma)', method: 'Ara Çapasıyla', product: 'Üre (%46 N) veya Amonyum Sülfat', dosagePerDa: '12–15 kg/da' },
      { stage: 'Yıldız Tabla Evresi', method: 'Pülverizatörle Yaprak', product: 'Etanolamin Bor + Çinko', dosagePerDa: '150–200 ml/da Bor' },
      { stage: 'Çiçeklenme Öncesi', method: 'Damlama (Suluysa)', product: 'Potasyum Sülfat (Yağ oranı artışı için)', dosagePerDa: '5–8 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Canavar Otu (Orobanche cumana)', threshold: 'IMI / Clearfield toleranslı çeşitlerde 4–6 yaprakta tek uygulama (Imazamox)', samplingMethod: 'Tarla geçmişi ve çıkış yoğunluğu kontrolü' },
      { pestOrDisease: 'Ayçiçeği Güvesi / Yeşilkurt', threshold: '100 tablada 20+ larva (Çiçek sonrası)', samplingMethod: 'Tabla içi tüpsü çiçek kontrolü' }
    ],
    regionalTips: 'Ayçiçeğinde en yaygın verim kaybı "ortası boş tabla"dır; yıldız tabla evresinde yapraktan Bor uygulaması polen canlılığını artırarak tane dolumunu maksimize eder.'
  },
  SEKER_PANCARI: {
    id: 'SEKER_PANCARI',
    name: 'Şeker Pancarı',
    scientificName: 'Beta vulgaris subsp. vulgaris',
    family: 'Amaranthaceae (Horozibiğigiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/276_Beta_vulgaris_L.jpg/500px-276_Beta_vulgaris_L.jpg',
    vegetationDays: '180–210 Gün',
    optimalSoilPh: 'pH 6.5 – 7.8 (Derin işlenmiş killi-tınlı toprak)',
    soilPreference: 'Yüzey sertleşmesi olmayan derin gevşek toprak (çatallı kök yapmaması için)',
    waterRequirementMm: '650–800 mm (Yağmurlama / Damlama)',
    criticalWaterStages: 'Çıkış (2–4 yaprak) ve Temmuz–Ağustos kök kalınlaşması (Hasattan 20 gün önce su kesilir)',
    targetYieldPerDa: '7.500 – 11.000 kg/da Kök (%16–18 Polar)',
    plantingSpec: 'Sıra arası 45 cm, sıra üzeri 18–20 cm • 1–1.2 ünite tohum/da • Derinlik: 2–3 cm',
    npkPureKgPerDa: '16–20 kg N • 8–12 kg P₂O₅ • 12–16 kg K₂O + Bor',
    criticalTemp: '8–10°C ekim • Eylül serin geceler şeker (polar) birikimini artırır',
    harvestCriteria: 'Dış yaprakların sarardığı ve polar analizinin %16 üzerine çıktığı Ekim–Kasım',
    fertilizerProgram: [
      { stage: 'Sonbahar / Ekim Taban', method: 'Toprağa Karıştırma', product: '15-15-15 veya 12-30-12 Kompoze', dosagePerDa: '40–50 kg/da' },
      { stage: '4–6 Yaprak (Tekleme Sonrası)', method: '1. Çapa ile', product: 'Amonyum Sülfat (%21 N) veya CAN %26', dosagePerDa: '20–25 kg/da' },
      { stage: 'Sıra Kapanmadan Önce', method: '2. Çapa + Yaprak', product: 'CAN %26 + Sıvı Bor (Öz Çürüklüğü Önlemi)', dosagePerDa: '15–20 kg/da + 200 ml Bor' },
      { stage: 'Ağustos Kök İrileşmesi', method: 'Damlama / Yaprak', product: 'Potasyum Sülfat (Poları artırır; geç azot poları düşürür!)', dosagePerDa: '8–10 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Cercospora Yaprak Lekesi (Cercospora beticola)', threshold: 'İlk yuvarlak kenarı kırmızımsı lekeler görüldüğünde koruyucu sistemik fungisit', samplingMethod: 'Temmuz rutubetli havalarda haftalık alt yaprak takibi' },
      { pestOrDisease: 'Pancar Hortumlu Böceği / Toprak Pireleri', threshold: 'Kotiledon dönemde 10 bitkide 3–4 yenik yaprak veya %25 yaprak alanı kaybı', samplingMethod: 'Erken çıkış sıra boyu sayım' }
    ],
    regionalTips: 'Temmuz ortasından sonra yüksek doz Azot vermek polar (şeker) oranını sert düşürür; Cercospora lekelerini erken durdurmak şeker verimini %30 korur ve aynı tarlaya 4 yılda bir münavebe gerekir.'
  },
  PATATES: {
    id: 'PATATES',
    name: 'Patates',
    scientificName: 'Solanum tuberosum',
    family: 'Solanaceae (Patlıcangiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Patates.jpg/500px-Patates.jpg',
    vegetationDays: '100–130 Gün',
    optimalSoilPh: 'pH 5.5 – 6.8 (Hafif asidik, uyuz hastalığını azaltır!)',
    soilPreference: 'Gevşek kumlu-tınlı, iyi drenajlı derin toprak',
    waterRequirementMm: '500–650 mm (Düzenli nem — düzensizlik yumru çatlatır!)',
    criticalWaterStages: 'Stolon bağlama ve yumru irileşmesi',
    targetYieldPerDa: '4.000 – 6.500 kg/da',
    plantingSpec: 'Sıra arası 70–75 cm, sıra üzeri 25–30 cm • Yumru tohum: 200–250 kg/da • Derinlik: 10–12 cm',
    npkPureKgPerDa: '18–22 kg N • 10–12 kg P₂O₅ • 22–28 kg K₂O + Kükürt',
    criticalTemp: 'Yumru bağlama gece 15–18°C ideal; 28°C üzeri yumru gelişimini durdurur',
    harvestCriteria: 'Üst aksam kuruduktan 14 gün sonra yumru kabuğu tam sertleşince',
    fertilizerProgram: [
      { stage: 'Dikim Sırasında (Taban)', method: 'Bant / Karık İçine', product: '15-15-15 veya 12-12-17+Mg (Klorürsüz!)', dosagePerDa: '50–70 kg/da' },
      { stage: 'Boğaz Doldurma (20–25 cm Boy)', method: 'Sıra Üzerine', product: 'Amonyum Sülfat (%21 N + %24 S) — Uyuz baskılar', dosagePerDa: '20–25 kg/da' },
      { stage: 'Çiçeklenme & Yumru Bağlama', method: 'Damlama / Yaprak', product: '13-40-13 + Kalsiyum (Depo dayanımı için)', dosagePerDa: '4–5 kg/da' },
      { stage: 'Yumru İrileşme Dönemi', method: 'Damlama Sulama', product: 'Potasyum Sülfat (0-0-50) — Nişasta & kuru madde', dosagePerDa: '10–12 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Patates Böceği (Leptinotarsa decemlineata)', threshold: 'Bitki başına ortalama 1 ergin/yumurta kümesi veya 1.–2. dönem larva çıkışı', samplingMethod: 'Tarla kenarlarından başlayarak 100 ocak kontrolü' },
      { pestOrDisease: 'Patates Mildiyösü (Phytophthora infestans)', threshold: 'Yağış / çiğ sonrası ilk su emmiş leke veya çevre tarlada bildirimde koruyucu sprey', samplingMethod: 'Gece nemi > %85 ve 15–22°C koşullarda günlük gözlem' }
    ],
    regionalTips: 'Patateste kesinlikle Klorlu (Potasyum Klorür) gübre kullanılmamalıdır (nişasta ve cips kalitesini bozar); Potasyum Sülfat tercih edilmelidir. Mildiyö 3 günde tüm tarlayı yakabilir.'
  },
  SOGAN: {
    id: 'SOGAN',
    name: 'Soğan',
    scientificName: 'Allium cepa',
    family: 'Amaryllidaceae (Nergisgiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a2/Mixed_onions.jpg/500px-Mixed_onions.jpg',
    vegetationDays: '130–160 Gün',
    optimalSoilPh: 'pH 6.2 – 7.5',
    soilPreference: 'Süzek tınlı, taşsız ve organik maddece dengeli toprak',
    waterRequirementMm: '450–600 mm (Sığ saçak kök — sık ama az sulama)',
    criticalWaterStages: 'Çıkış ve Baş bağlama–baş büyümesi (Olgunlaşmada kesilir)',
    targetYieldPerDa: '4.500 – 7.500 kg/da',
    plantingSpec: '3–4 sıralı tahta üzerinde sıra arası 20–25 cm • Tohum: 500–700 g/da • Derinlik: 1.5–2 cm',
    npkPureKgPerDa: '14–18 kg N • 8–10 kg P₂O₅ • 14–18 kg K₂O + Kükürt',
    criticalTemp: 'Baş bağlama için çeşit gün uzunluğu (12–16 saat) ve 20–25°C',
    harvestCriteria: 'Yaprakların %60–75 boyundan devrilip yattığı ve boynun inceldiği evre',
    fertilizerProgram: [
      { stage: 'Ekim Taban', method: 'Toprak Hazırlığında', product: '15-15-15 veya DAP + Kükürt', dosagePerDa: '35–40 kg/da' },
      { stage: '3–4 Yapraklı Dönem', method: 'Damlama / Yağmurlama', product: 'Amonyum Sülfat (%21 N + %24 S)', dosagePerDa: '15–18 kg/da' },
      { stage: 'Baş Bağlama Başlangıcı', method: 'Damlama', product: '20-20-20 + Çinko & Bakır (Kabuk rengi için)', dosagePerDa: '4–5 kg/da' },
      { stage: 'Baş Büyümesi', method: 'Damlama (Hasat 3 hafta önce azot kesilir!)', product: 'Potasyum Sülfat (0-0-50)', dosagePerDa: '8–10 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Soğan Trips (Thrips tabaci)', threshold: 'Bitki başına 10–15 adet ergin veya nimf (yaprak dip koltuklarında)', samplingMethod: '25 bitki yaprak arası büyüteçle sayım' },
      { pestOrDisease: 'Soğan Mildiyösü (Peronospora destructor)', threshold: 'Sabah çiğinde yaprakta ilk gri-mor spor tabakası görüldüğünde', samplingMethod: 'Serin yağışlı Nisan–Mayıs günlerinde tarla gezisi' }
    ],
    regionalTips: 'Geç dönemde fazla Azot vermek başın kalın boyunlu olmasına ve depoda hızla çürümesine (Botrytis boyun çürüklüğü) neden olur; Potasyum + Bakır kabuk kalitesini ve depo ömrünü uzatır.'
  },
  YER_FISTIGI: {
    id: 'YER_FISTIGI',
    name: 'Yer Fıstığı',
    scientificName: 'Arachis hypogaea',
    family: 'Fabaceae (Baklagiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Peanuts_%28dried_pods_marketed%29.jpg/960px-Peanuts_%28dried_pods_marketed%29.jpg',
    vegetationDays: '130–150 Gün',
    optimalSoilPh: 'pH 6.0 – 7.2',
    soilPreference: 'Gevşek kumlu-tınlı toprak (iğnelerin toprağa batabilmesi için!)',
    waterRequirementMm: '500–650 mm',
    criticalWaterStages: 'İğne batması (Ginofor) ve Kapsül dolumu',
    targetYieldPerDa: '400 – 580 kg/da Kabuklu',
    plantingSpec: 'Sıra arası 70 cm, sıra üzeri 15–18 cm • 8–10 kg iç tohum/da • Derinlik: 4–5 cm',
    npkPureKgPerDa: '4–6 kg Başlangıç N • 8–10 kg P₂O₅ • 8–10 kg K₂O + Yüksek Kalsiyum!',
    criticalTemp: 'Toprak 18°C ekim • 26–30°C optimum büyüme',
    harvestCriteria: 'Kapsül iç zarının kahverengileşip damarlanması (%70 olgun kapsül)',
    fertilizerProgram: [
      { stage: 'Ekim (Taban)', method: 'Bant', product: '18-46-0 DAP veya TSP + Rhizobium Aşılama', dosagePerDa: '15–20 kg/da' },
      { stage: 'Çiçeklenme Başlangıcı', method: 'Yapraktan', product: 'Demir (Fe) + Çinko + Molibden (Nodül aktivitesi)', dosagePerDa: '150 ml/da' },
      { stage: 'İğne Batma Dönemi (ÇOK KRİTİK!)', method: 'Sıra Üzerine Jips / Ca', product: 'Tarım Jipsi (Kalsiyum Sülfat) veya Kalsiyum Nitrat', dosagePerDa: '40–60 kg Jips/da (veya 10 kg Kalsiyum)' },
      { stage: 'Kapsül Dolumu', method: 'Damlama / Yaprak', product: 'Bor + Potasyum Sülfat', dosagePerDa: '4 kg/da K₂SO₄ + 100 ml Bor' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Yerfıstığı Kırmızı Örümcek & Pamuk Yaprakkurdu', threshold: 'Yaprak altlarında koloni başlangıcı ve 100 bitkide %10 yaprak yenik', samplingMethod: 'Temmuz sıcaklarında alt yaprak kontrolü' },
      { pestOrDisease: 'Cercospora Yaprak Lekesi & Aflatoksin Riski', threshold: 'Yapraklarda %5 leke görüldüğünde fungisit + hasat zamanı su stresi önlenmeli', samplingMethod: 'Alt yaprak leke gözlemi ve hasat öncesi nem kontrolü' }
    ],
    regionalTips: 'Yer fıstığı iğneleri kalsiyumu köklerden değil doğrudan meyve kabuğundan topraktan emer! İğne batma döneminde Jips/Kalsiyum verilmezse içi boş ("fıs") kapsül oluşur.'
  },
  MERCIMEK: {
    id: 'MERCIMEK',
    name: 'Mercimek',
    scientificName: 'Lens culinaris',
    family: 'Fabaceae (Baklagiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/3_types_of_lentil.jpg/960px-3_types_of_lentil.jpg',
    vegetationDays: '165–190 Gün (Kışlık) • 110–125 Gün (Yazlık)',
    optimalSoilPh: 'pH 6.2 – 8.0',
    soilPreference: 'Su tutmayan, taşsız killi-tınlı toprak (su birikimine çok hassas)',
    waterRequirementMm: '300–400 mm (Kuru tarımda kış yağışları)',
    criticalWaterStages: 'Çiçeklenme ve Bakla dolumu',
    targetYieldPerDa: '140 – 250 kg/da',
    plantingSpec: 'Sıra arası 15–20 cm • Kırmızı mercimek: 10–12 kg/da • Derinlik: 4–5 cm',
    npkPureKgPerDa: '2–3 kg Başlangıç N • 5–7 kg P₂O₅ + Kükürt',
    criticalTemp: 'Çiçeklenmede 32°C üstü bakla tutumunu azaltır',
    harvestCriteria: 'Alt baklaların sararıp ses çıkardığı ve yaprakların döküldüğü Mayıs–Haziran',
    fertilizerProgram: [
      { stage: 'Ekim (Taban)', method: 'Mibzerle', product: '18-46-0 DAP veya 20-20-0', dosagePerDa: '12–15 kg/da' },
      { stage: 'Çıkış – Kardeşlenme', method: 'Yaprak', product: 'Deniz Yosunu + Çinko + Molibden (Nodül destek)', dosagePerDa: '150 ml/da' },
      { stage: 'Çiçeklenme Öncesi', method: 'Yaprak', product: 'Etanolamin Bor + Fosfor', dosagePerDa: '100 ml/da' },
      { stage: 'Bakla Dolumu', method: 'İhtiyaçta Yaprak', product: 'Potasyum Sülfat + Kükürt', dosagePerDa: '200 g/100 L su' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Mercimek Hortumlu Böceği (Sitona crinitus)', threshold: 'Fide döneminde yaprak kenarlarında "U" şeklinde tırtıklanma ve m²’de 5+ ergin', samplingMethod: 'İlkbahar başında ılık öğleden sonra çıkış sayımı' },
      { pestOrDisease: 'Mercimek Tohumböceği (Bruchus lentis)', threshold: 'Çiçeklenme–ilk bakla evresinde tarla kenarlarında atrapta 3–5 ergin', samplingMethod: '10 atrap sallaması (Hasat sonrası kurtlu dane önlemi)' },
      { pestOrDisease: 'Ascochyta Yanıklığı', threshold: 'Yağışlı Nisan ayında yaprak/gövdede konsantrik lekeler görüldüğünde', samplingMethod: 'Alt gövde ve bakla kontrolü' }
    ],
    regionalTips: 'Kırmızı mercimekte en büyük problem hasat kaybı ve Tohumböceği (kurtlanma)dır; tarlayı ekim sonrası merdane (loğ) ile düzleştirmek biçim yüksekliğini düşürür ve bakla kaybını azaltır.'
  },
  SOYA: {
    id: 'SOYA',
    name: 'Soya Fasulyesi',
    scientificName: 'Glycine max',
    family: 'Fabaceae (Baklagiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Soybean.USDA.jpg/500px-Soybean.USDA.jpg',
    vegetationDays: '105–135 Gün',
    optimalSoilPh: 'pH 6.0 – 7.2',
    soilPreference: 'Tuzsuz veya çok az tuzlu tınlı topraklar',
    waterRequirementMm: '480–620 mm',
    criticalWaterStages: 'Çiçeklenme başlangıcı ve Bakla dolumu (R3–R6)',
    targetYieldPerDa: '380 – 520 kg/da',
    plantingSpec: 'Sıra arası 70 cm, sıra üzeri 4–5 cm • 7–9 kg/da • Derinlik: 3–4 cm',
    npkPureKgPerDa: '4–5 kg Başlangıç N (Bakteri yoksa 12 kg) • 7–9 kg P₂O₅ • 6–8 kg K₂O',
    criticalTemp: 'Ekimde toprak 14°C+ • Çiçeklenmede 25–30°C',
    harvestCriteria: 'Yaprakların %95 döküldüğü ve danede nemin %13 altına düştüğü dönem',
    fertilizerProgram: [
      { stage: 'Ekim Öncesi', method: 'Tohum İnokülasyonu + Taban', product: 'Bradyrhizobium japonicum Bakteri Aşısı + DAP', dosagePerDa: '15 kg/da DAP' },
      { stage: '3–4 Üç yapraklı Dönem', method: 'Yapraktan', product: 'Mangan EDTA + Demir EDDHA (Kireç sarılığına)', dosagePerDa: '150 ml Mn + 100 g Fe' },
      { stage: 'Çiçeklenme (R1)', method: 'Yapraktan / Damlama', product: 'Bor + Molibden + Denge NPK', dosagePerDa: '100 ml Bor + Mo' },
      { stage: 'Bakla Dolumu (R5)', method: 'Damlama / Yaprak', product: 'Potasyum Nitrat / Sülfat', dosagePerDa: '5–6 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Pamuk Çizgili Yaprakkurdu / Yeşilkurt', threshold: 'Çiçek sonrası dönemde %15–20 yaprak yüzeyi yenik veya bakla hasarı', samplingMethod: 'Silkeleme bezi ile m² başına düşen larva sayımı' },
      { pestOrDisease: 'İki Noktalı Kırmızıörümcek & Beyazsinek', threshold: 'Yaprak başına 5–8 birey ve alt yaprakta bronzlaşma başlangıcı', samplingMethod: 'Sıcak Temmuz rüzgarlı sınır sıraları' }
    ],
    regionalTips: 'Soya baklagil olsa da tohumuna mutlaka Bradyrhizobium japonicum bakterisi aşılanmalıdır; yüksek kireçli topraklarda erken dönemde Mangan ve Demir eksikliği hızla görülür.'
  },
  KIMYON: {
    id: 'KIMYON',
    name: 'Kimyon',
    scientificName: 'Cuminum cyminum',
    family: 'Apiaceae (Maydanozgiller)',
    categoryGroup: 'TARLA',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6d/Cuminum_cyminum-2-market-yercaud-salem-India.JPG/960px-Cuminum_cyminum-2-market-yercaud-salem-India.JPG',
    vegetationDays: '110–130 Gün',
    optimalSoilPh: 'pH 6.5 – 7.8',
    soilPreference: 'İyi drenajlı, hafif kireçli tınlı toprak',
    waterRequirementMm: '250–350 mm (Aşırı nem kök çürüklüğü yapar)',
    criticalWaterStages: 'Çıkış sonrası rozet dönemi ve şemsiye çiçek oluşumu',
    targetYieldPerDa: '70 – 130 kg/da',
    plantingSpec: 'Sıra arası 20–25 cm • Tohum: 1.5–2 kg/da • Derinlik: 1.5–2 cm',
    npkPureKgPerDa: '5–7 kg N • 5–6 kg P₂O₅ • 4–5 kg K₂O',
    criticalTemp: 'Kurak ve sıcak havayı sever, aşırı bahar yağışında yanıklık hassasiyeti',
    harvestCriteria: 'Bitkinin sararıp tohumların kahverengileştiği ve uçucu yağın zirvede olduğu sabah çiği',
    fertilizerProgram: [
      { stage: 'Ekim (Taban)', method: 'Toprağa', product: '15-15-15 veya 20-20-0', dosagePerDa: '15–20 kg/da' },
      { stage: 'Sapa Kalkma Başlangıcı', method: 'Üst Gübre', product: 'Amonyum Sülfat (%21 N + %24 S) — Uçucu yağ için', dosagePerDa: '8–10 kg/da' },
      { stage: 'Şemsiye Oluşumu', method: 'Pülverizatörle', product: 'Deniz Yosunu + Fosfor + Potasyum', dosagePerDa: '200 ml/da' },
      { stage: 'Tohum Bağlama', method: 'Gerektiğinde Yaprak', product: 'Sıvı Potasyum + Bor', dosagePerDa: '150 ml/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Kimyon Yanıklığı (Alternaria burnsii)', threshold: 'Nisan–Mayıs yağmurlarından hemen sonra koruyucu fungisit (ilk leke beklenmez)', samplingMethod: 'Hava nemi > %70 ve 22–28°C döneminde günlük gövde kontrolü' },
      { pestOrDisease: 'Kimyon Yaprakbiti (Hydaphis coriandri)', threshold: 'Şemsiye saplarında koloni oluşumu %10 bitki bulaşması', samplingMethod: 'Çiçeklenme şemsiyeleri kontrolü' }
    ],
    regionalTips: 'Kimyonda en büyük tehdit Alternaria Yanıklığıdır; yağış ve bulutlu hava hemen ardından koruyucu fungisit atılmazsa 4–5 gün içinde tüm çiçek şemsiyelerini siyahlaştırıp kurutur.'
  },
  DOMATES: {
    id: 'DOMATES',
    name: 'Domates',
    scientificName: 'Solanum lycopersicum',
    family: 'Solanaceae (Patlıcangiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/500px-Tomato_je.jpg',
    vegetationDays: '95–135 Gün (Tarla) • 180+ Gün (Sera)',
    optimalSoilPh: 'pH 6.0 – 6.8 (Hafif asidik tınlı)',
    soilPreference: 'Organik maddece zengin, taban suyu olmayan süzek toprak',
    waterRequirementMm: '550–750 mm (Damla Sulama + Malç)',
    criticalWaterStages: 'Çiçeklenme sonrası meyve tutumu ve kızarma (düzensiz sulama meyve çatlatır)',
    targetYieldPerDa: '9 – 14 Ton/da (Açık) • 22 – 35 Ton/da (Sera)',
    plantingSpec: 'Sıra arası 120–140 cm, sıra üzeri 35–45 cm • 2.200–2.800 fide/da',
    npkPureKgPerDa: '20–26 kg N • 10–14 kg P₂O₅ • 28–38 kg K₂O + 8–10 kg CaO',
    criticalTemp: 'Polen döllenmesi gece 13°C altı ve gündüz 33°C üstü bozulur',
    harvestCriteria: 'Salçalık tam kırmızı; sofralık pembe-kırmızı renk dönümü',
    fertilizerProgram: [
      { stage: 'Fide Dikimi (İlk 15 Gün)', method: 'Damlamadan Can Suyu', product: '10-52-10 MAP + Hümik Asit + Köklendirici', dosagePerDa: '2–3 kg/da' },
      { stage: 'Vejetatif – İlk Çiçek', method: 'Damlamadan', product: '20-20-20 + EDTA Mikro Element', dosagePerDa: '3–4 kg/da / hafta' },
      { stage: 'Meyve Tutumu (Çok Kritik!)', method: 'Ayrı Gün Damlama + Yaprak', product: 'Kalsiyum Nitrat + Magnezyum + Bor (Çiçek burnuna)', dosagePerDa: '3 kg Ca(NO₃)₂ / hafta' },
      { stage: 'Kızarma & Hasat', method: 'Damlama (Sülfatlı/Nitratlı)', product: 'Potasyum Nitrat (13-0-46) / 8-12-36', dosagePerDa: '5–6 kg/da / hafta' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Domates Güvesi (Tuta absoluta)', threshold: 'Feromon tuzakta haftada 3+ ergin veya 100 yaprakta 3 galeri', samplingMethod: 'Su tuzakları ve taze tepe yapraklarında galeri taraması' },
      { pestOrDisease: 'Mildiyö (Phytophthora infestans)', threshold: 'Yağışlı ve 18–22°C nemli havada belirti beklemeden koruyucu uygulama', samplingMethod: 'Sera nem ölçümü ve alt yaprak lekeleri' },
      { pestOrDisease: 'Kırmızı Örümcek & Pas Akarı', threshold: 'Yaprak başına 3–5 birey veya gövdede bronz paslaşma', samplingMethod: 'Büyüteçle (20x) alt yaprak ve gövde kontrolü' }
    ],
    regionalTips: 'Domateste çiçek burnu çürüklüğünü (kara dip) önlemek için Kalsiyum nitratı asla Fosfor ve Sülfatlı gübrelerle karıştırmayın; yüksek Azot ve düzensiz sulama Ca taşınımını bloke eder.'
  },
  BIBER: {
    id: 'BIBER',
    name: 'Biber',
    scientificName: 'Capsicum annuum',
    family: 'Solanaceae (Patlıcangiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Green-Yellow-Red-Pepper-2009.jpg/500px-Green-Yellow-Red-Pepper-2009.jpg',
    vegetationDays: '110–150 Gün',
    optimalSoilPh: 'pH 6.0 – 7.0',
    soilPreference: 'Süzek humuslu tınlı toprak (kök çürüklüğüne çok hassas)',
    waterRequirementMm: '550–700 mm (Sık ve kontrollü damla sulama)',
    criticalWaterStages: 'Çiçeklenme, meyve tutumu ve Temmuz sıcakları',
    targetYieldPerDa: '4.500 – 8.000 kg/da',
    plantingSpec: 'Çift sıra tahtada 70x45 cm veya tek sıra 90x35 cm • 3.200–3.800 fide/da',
    npkPureKgPerDa: '18–24 kg N • 10–12 kg P₂O₅ • 22–28 kg K₂O + Ca + Mg',
    criticalTemp: 'Optimum 21–27°C • 34°C üstü çiçek dökümü ve güneş yanığı',
    harvestCriteria: 'Çeşide özgü dolgunluk ve parlak kabuk sertliği (Kapya/Salçalık tam kırmızı)',
    fertilizerProgram: [
      { stage: 'Fide Tutunması (0–20 Gün)', method: 'Damlama', product: '10-52-10 MAP + Aminoasit', dosagePerDa: '2–2.5 kg/da' },
      { stage: 'Dallanma & İlk Çiçek', method: 'Damlama', product: '18-18-18 + Mg + Mikro Element', dosagePerDa: '3 kg/da' },
      { stage: 'Meyve Tutumu', method: 'Damlama + Yaprak', product: 'Kalsiyum Nitrat + Magnezyum Sülfat (Farklı günlerde)', dosagePerDa: '3–4 kg/da' },
      { stage: 'Sürekli Hasat', method: 'Damlama', product: '15-5-30 veya Potasyum Nitrat (Et kalınlığı için)', dosagePerDa: '4–5 kg/da / hafta' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Batı Çiçek Thripsi (Frankliniella occidentalis)', threshold: 'Çiçek başına 2–3 trips bireyi (TSWV virüsü taşıdığı için sıfır toleransa yakın!)', samplingMethod: 'Beyaz kağıda çiçek silkeleme veya mavi yapışkan tuzak' },
      { pestOrDisease: 'Phytophthora Kök Boğazı Yanıklığı', threshold: 'Sırtta su birikmesi önlenmeli, dikimde koruyucu drenç uygulaması', samplingMethod: 'Solgunluk başlangıcında boğaz kabuğu soyma kontrolü' }
    ],
    regionalTips: 'Biber kökü su göllenmesine kesinlikle tahammül etmez (masura üzerine dikim şarttır); Thrips mücadelesinde Spinosad/Spinetoram dönüşümlü kullanılmalıdır çünkü direnç çok hızlı gelişir.'
  },
  HIYAR: {
    id: 'HIYAR',
    name: 'Hıyar',
    scientificName: 'Cucumis sativus',
    family: 'Cucurbitaceae (Kabakgiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/ARS_cucumber.jpg/500px-ARS_cucumber.jpg',
    vegetationDays: '65–95 Gün (Hızlı hasat)',
    optimalSoilPh: 'pH 5.8 – 6.8',
    soilPreference: 'Tuzluluğa ÇOK hassas, yüksek humuslu ve havadar toprak',
    waterRequirementMm: '400–550 mm (Günlük damla sulama)',
    criticalWaterStages: 'Sürekli çiçek ve meyve büyümesi (en hafif susuzlukta meyve acılaşır!)',
    targetYieldPerDa: '10 – 18 Ton/da (Sera/Sırık)',
    plantingSpec: 'Sıra arası 100–120 cm, sıra üzeri 35–40 cm • 2.200–2.600 fide/da',
    npkPureKgPerDa: '22–28 kg N • 10–12 kg P₂O₅ • 30–35 kg K₂O + Mg',
    criticalTemp: 'Optimum 22–28°C • 10°C altı üşüme zararı',
    harvestCriteria: 'Çeşide özgü boyda ve taze körpe iken günaşırı hasat',
    fertilizerProgram: [
      { stage: 'Fide Tutumu', method: 'Damlama', product: '10-52-10 + Deniz Yosunu', dosagePerDa: '2 kg/da' },
      { stage: 'Hızlı Kol Atma', method: 'Damlama', product: '20-20-20 + Magnezyum', dosagePerDa: '3–4 kg/da' },
      { stage: 'Meyve Yükü & Hasat', method: 'Damlama (EC < 2.2 dS/m tutulmalı!)', product: 'Potasyum Nitrat + Kalsiyum Nitrat (Dönüşümlü)', dosagePerDa: '4–5 kg/da' },
      { stage: 'Yaprak Yaşlanma Önlemi', method: 'Yapraktan', product: 'Magnezyum + Silisyum + Mikro Element', dosagePerDa: '200 ml/100 L su' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Mildiyö (Pseudoperonospora cubensis)', threshold: 'Yaprak üstünde köşeli sarı lekeler görüldüğü an (nemli ortamda saatler içinde yayılır)', samplingMethod: 'Sabah alt yapraklarda gri-mor spor incelemesi' },
      { pestOrDisease: 'İki Noktalı Kırmızıörümcek & Beyazsinek', threshold: 'Yaprak başına 3–5 kırmızıörümcek veya 5 ergin beyazsinek', samplingMethod: 'Sıcak köşelerden başlayarak yaprak altı kontrolü' }
    ],
    regionalTips: 'Hıyarda köşe başı sararmaları (köşeli yaprak lekesi veya mildiyö) ile Magnezyum noksanlığı sık karıştırılır; tuzlu gübrelemede EC aşırı yükselirse kök yanması oluşur.'
  },
  PATLICAN: {
    id: 'PATLICAN',
    name: 'Patlıcan',
    scientificName: 'Solanum melongena',
    family: 'Solanaceae (Patlıcangiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Solanum_melongena_24_08_2012_%281%29.JPG/500px-Solanum_melongena_24_08_2012_%281%29.JPG',
    vegetationDays: '120–160 Gün',
    optimalSoilPh: 'pH 6.0 – 7.2',
    soilPreference: 'Derin, organik maddece zengin tınlı toprak (münavebe şart)',
    waterRequirementMm: '600–800 mm',
    criticalWaterStages: 'Çiçeklenme ve meyve büyümesi',
    targetYieldPerDa: '7 – 12 Ton/da',
    plantingSpec: 'Sıra arası 100–120 cm, sıra üzeri 45–55 cm • 1.700–2.000 fide/da',
    npkPureKgPerDa: '20–26 kg N • 10–12 kg P₂O₅ • 26–32 kg K₂O + Mg + Fe',
    criticalTemp: 'Sıcağı sever (25–32°C); 12°C altında çiçek tutmaz',
    harvestCriteria: 'Meyve parlak mor/siyah iken tohumların sertleşmediği dönem',
    fertilizerProgram: [
      { stage: 'Fide Dikimi', method: 'Damlama', product: '10-52-10 MAP + Köklendirici', dosagePerDa: '2–2.5 kg/da' },
      { stage: 'Dallanma – İlk Çiçek', method: 'Damlama', product: '20-20-20 + Demir Şelatı + Çinko', dosagePerDa: '3.5 kg/da' },
      { stage: 'Meyve Tutumu', method: 'Damlama (Ayrı gün)', product: 'Kalsiyum Nitrat + Bor', dosagePerDa: '3 kg/da' },
      { stage: 'Hasat Süreci', method: 'Damlama', product: '15-5-30 + Magnezyum Sülfat (Meyve parlaklığı)', dosagePerDa: '4–5 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Kırmızı Örümcek (Tetranychus urticae)', threshold: 'Patlıcan tüylü yaprağı nedeniyle çok hassastır; yaprak başına 3–5 bireyde hemen ilaçlama', samplingMethod: 'Haftalık orta ve alt yaprak büyüteç sayımı' },
      { pestOrDisease: 'Verticillium Solgunluğu', threshold: 'Mücadelesi önleyicidir: Solanaceae dışı 4 yıllık münavebe veya aşılı fide!', samplingMethod: 'Öğle sıcağında tek taraflı yaprak pörsümesi' }
    ],
    regionalTips: 'Patlıcan Verticillium solgunluğuna ve Kırmızı Örümceğe karşı sebzeler içinde en hassas türdür; aynı tarlada domates/biber/patates sonrası dikimden kaçınılmalı ve aşılı fide tercih edilmelidir.'
  },
  KARPUZ: {
    id: 'KARPUZ',
    name: 'Karpuz',
    scientificName: 'Citrullus lanatus',
    family: 'Cucurbitaceae (Kabakgiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Taiwan_2009_Tainan_City_Organic_Farm_Watermelon_FRD_7962.jpg/500px-Taiwan_2009_Tainan_City_Organic_Farm_Watermelon_FRD_7962.jpg',
    vegetationDays: '85–110 Gün',
    optimalSoilPh: 'pH 6.0 – 7.2',
    soilPreference: 'Sıcak kumlu-tınlı, derin süzek toprak',
    waterRequirementMm: '400–550 mm (Hasat 7–10 gün önce su kesilir!)',
    criticalWaterStages: 'Kol atma sonrası ve Meyve ceviz–karpuz iriliğine geçişi',
    targetYieldPerDa: '6 – 10 Ton/da (Aşılı fide ile 10+ Ton/da)',
    plantingSpec: 'Sıra arası 200–250 cm, sıra üzeri 80–120 cm • 350–550 aşılı fide/da',
    npkPureKgPerDa: '14–18 kg N • 8–10 kg P₂O₅ • 20–26 kg K₂O + Mg + B',
    criticalTemp: 'Optimum 25–33°C; çiçeklenme öncesi arı aktivitesi kritik',
    harvestCriteria: 'Meyve sapı yanındaki sülüğün (bıyık) kuruması, alt karın sararması ve tok ses',
    fertilizerProgram: [
      { stage: 'Fide Dikimi – Kol Atma', method: 'Damlama', product: '10-52-10 MAP + Hümik Asit', dosagePerDa: '2 kg/da' },
      { stage: 'Kol Uzaması & Çiçeklenme', method: 'Damlama + Yaprak', product: '20-20-20 + Bor + Çinko (Arı zararsız saat)', dosagePerDa: '3 kg/da' },
      { stage: 'Meyve Tutumu (Elma İriliği)', method: 'Damlama (Ayrı tank)', product: 'Kalsiyum Nitrat + Magnezyum (Meyve çatlamasına)', dosagePerDa: '3 kg/da' },
      { stage: 'Şekerlenmeye Geçiş (Brix)', method: 'Damlama', product: 'Potasyum Sülfat / Potasyum Nitrat (Azot azaltılır)', dosagePerDa: '5–6 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Kavun/Karpuz Yaprakbiti (Aphis gossypii)', threshold: 'Bitki sürgün uçlarında kolonileşme (%10–15 bulaşma) — Virüs ve balglama yapar', samplingMethod: 'Sürgün ucu ve çiçek alt yaprak kontrolü' },
      { pestOrDisease: 'Külleme & Mildiyö', threshold: 'İlk beyaz pudramsı küf (külleme) veya sarı köşeli leke görüldüğünde', samplingMethod: 'Kol altındaki yaşlı yapraklar' }
    ],
    regionalTips: 'Çiçeklenme döneminde arılar aktifken kesinlikle arıya zehirli insektisit atılmamalı, akşam geç saatte güvenli ürün seçilmelidir; hasattan 1 hafta önce sulamayı kısmak meyve çatlamasını önler ve şeker (Brix) oranını yükseltir.'
  },
  KAVUN: {
    id: 'KAVUN',
    name: 'Kavun',
    scientificName: 'Cucumis melo',
    family: 'Cucurbitaceae (Kabakgiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Cantaloupe_and_canary_melon.jpg/500px-Cantaloupe_and_canary_melon.jpg',
    vegetationDays: '85–115 Gün',
    optimalSoilPh: 'pH 6.2 – 7.5',
    soilPreference: 'Sıcak tınlı, taban suyu düşük süzek toprak',
    waterRequirementMm: '350–480 mm (Aşırı sulama tadı bozar ve Fusarium tetikler)',
    criticalWaterStages: 'Çiçeklenme ve Meyve irileşmesi (Olgunlaşmada su çok azaltılır)',
    targetYieldPerDa: '3.500 – 6.000 kg/da',
    plantingSpec: 'Sıra arası 180–200 cm, sıra üzeri 60–80 cm • 650–850 fide/da',
    npkPureKgPerDa: '12–16 kg N • 7–9 kg P₂O₅ • 18–22 kg K₂O + Bor',
    criticalTemp: '24–32°C güneşli kuru iklim aroma ve Brix artırır',
    harvestCriteria: 'Meyve sapı etrafında çatlama halkası, yoğun koku ve kabuk rengi dönümü',
    fertilizerProgram: [
      { stage: 'Fide / Çıkış', method: 'Damlama', product: '10-52-10 MAP + Fosfor', dosagePerDa: '2 kg/da' },
      { stage: 'Çiçeklenme', method: 'Yapraktan + Damlama', product: '18-18-18 + Bor + Çinko', dosagePerDa: '2.5 kg/da' },
      { stage: 'Meyve Büyümesi', method: 'Damlama (Ayrı gün)', product: 'Kalsiyum Nitrat + Magnezyum', dosagePerDa: '3 kg/da' },
      { stage: 'Tatlanma (Son 3 Hafta)', method: 'Damlama (Az su)', product: 'Potasyum Sülfat (0-0-50+18S)', dosagePerDa: '5–7 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Kavun Sineği (Myiopardalis pardalina)', threshold: 'İlk fındık iriliği meyvelerde yumurta bırakma delikleri ve ergin gözlemi', samplingMethod: 'Sabah taze küçük meyve yüzeyi incelemesi' },
      { pestOrDisease: 'Külleme & Antraknoz', threshold: 'Alt yaşlı yapraklarda ilk beyaz küf noktası', samplingMethod: 'Haftalık gövde kolu alt yaprak taraması' }
    ],
    regionalTips: 'Kavun Fusarium solgunluğuna çok hassastır; kök boğazı ıslanmayacak şekilde karık/damla sırtı yapılmalı ve olgunlaşma döneminde fazla su verilerek "tatsızlaşma" engellenmelidir.'
  },
  CILEK: {
    id: 'CILEK',
    name: 'Çilek',
    scientificName: 'Fragaria × ananassa',
    family: 'Rosaceae (Gülgiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Garden_strawberry_%28Fragaria_%C3%97_ananassa%29_single2.jpg/500px-Garden_strawberry_%28Fragaria_%C3%97_ananassa%29_single2.jpg',
    vegetationDays: 'Çok Yıllık / 8–10 Ay Hasat Periyodu',
    optimalSoilPh: 'pH 5.5 – 6.5 (Hafif asidik — Demir kilitlenmemesi için!)',
    soilPreference: 'Tuzsuz (EC < 1.2), yüksek organik maddeli kumlu-tınlı malçlı sedde',
    waterRequirementMm: '500–700 mm (Yüksek frekanslı kısa damla sulama)',
    criticalWaterStages: 'Çiçeklenme ve sürekli meyve irileşme–hasat',
    targetYieldPerDa: '3.500 – 6.500 kg/da',
    plantingSpec: 'Sedde arası 100–120 cm (çift sıra), sıra üzeri 25–30 cm • 5.500–6.500 frigo fide/da',
    npkPureKgPerDa: '16–22 kg N • 10–12 kg P₂O₅ • 24–30 kg K₂O + Fe + Ca',
    criticalTemp: 'Çiçekler -1°C’de yanar (siyah göz); optimum 18–25°C',
    harvestCriteria: 'Meyvenin %80–90 parlak kırmızı renge ulaştığı sabah serinliği',
    fertilizerProgram: [
      { stage: 'Fide Tutumu (İlk 3 Hafta)', method: 'Damlama', product: '10-52-10 MAP + Hümik + Köklendirici', dosagePerDa: '1.5–2 kg/da' },
      { stage: 'Taç Genişlemesi', method: 'Damlama', product: '20-20-20 + Fe-EDDHA (Kloroz önlemi)', dosagePerDa: '2.5 kg/da + 300 g Fe-EDDHA' },
      { stage: 'Çiçek & Yeşil Meyve', method: 'Damlama (Ayrı gün)', product: 'Kalsiyum Nitrat + Bor (Meyve raf ömrü)', dosagePerDa: '2.5 kg/da' },
      { stage: 'Hasat Dalgaları', method: 'Damlama', product: '13-0-46 veya 8-12-36 + Mg (Şeker & Sertlik)', dosagePerDa: '3–4 kg/da / hafta' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Kurşuni Küf (Botrytis cinerea)', threshold: 'Nemli ve 15–22°C havalarda tam çiçeklenmeden itibaren koruyucu ilaçlama', samplingMethod: 'Çiçek taç yapraklarında kahverengileşme ve sedde arası nem' },
      { pestOrDisease: 'Kırmızı Örümcek & Trips', threshold: 'Yaprak başına 3–5 kırmızı örümcek; çiçek başına 2 trips', samplingMethod: '20x el merceği ile genç orta yaprak altları' }
    ],
    regionalTips: 'Çilek Demir eksikliğine ve Kurşuni Küf’e karşı çok hassastır; sızdırmaz siyah malç + sedde üzerinde yetiştirilmeli, tuzlu kuyu suyu kullanılıyorsa sık kısa yıkama sulaması yapılmalıdır.'
  },
  BAMYA: {
    id: 'BAMYA',
    name: 'Bamya',
    scientificName: 'Abelmoschus esculentus',
    family: 'Malvaceae (Ebegümecigiller)',
    categoryGroup: 'SEBZE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Hong_Kong_Okra_Aug_25_2012.JPG/500px-Hong_Kong_Okra_Aug_25_2012.JPG',
    vegetationDays: '110–140 Gün',
    optimalSoilPh: 'pH 6.0 – 7.5',
    soilPreference: 'Sıcak tınlı, süzek toprak (Pamuk familyasındandır)',
    waterRequirementMm: '400–550 mm',
    criticalWaterStages: 'Çiçeklenme ve sürekli kapsül tutumu',
    targetYieldPerDa: '1.200 – 2.200 kg/da Taze Kapsül',
    plantingSpec: 'Sıra arası 60–70 cm, sıra üzeri 20–25 cm • Tohum: 2.5–3.5 kg/da',
    npkPureKgPerDa: '10–14 kg N • 6–8 kg P₂O₅ • 10–12 kg K₂O',
    criticalTemp: 'Soğuğa çok hassastır; toprak 16°C altında ekilmemeli (Optimum 25–35°C)',
    harvestCriteria: 'Çiçek açtıktan 4–6 gün sonra, 3–5 cm körpe ve çıtır iken her gün hasat',
    fertilizerProgram: [
      { stage: 'Ekim (Taban)', method: 'Bant', product: '15-15-15 veya 20-20-0', dosagePerDa: '25–30 kg/da' },
      { stage: 'Boğaz Doldurma (15–20 cm)', method: 'Sıra Arası / Damlama', product: 'Üre (%46 N) veya CAN %26', dosagePerDa: '10–12 kg/da' },
      { stage: 'Çiçek – Kapsül Başlangıcı', method: 'Damlama / Yaprak', product: '20-20-20 + Çinko + Bor', dosagePerDa: '2.5 kg/da' },
      { stage: 'Sürekli Hasat', method: 'Damlama', product: 'Potasyum Nitrat (Meyvelerin eğrilmemesi için)', dosagePerDa: '3–4 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Pamuk Yaprakbiti & Yeşilkurt / Dikenlikurt', threshold: 'Sürgün uçlarında yaprakbiti kolonisi veya %5 delik kapsül', samplingMethod: 'Her gün hasat esnasında kapsül ve çiçek tabanı kontrolü' },
      { pestOrDisease: 'Külleme (Erysiphe cichoracearum)', threshold: 'Alt yapraklarda ilk beyaz tozlu lekeler görüldüğünde', samplingMethod: 'Temmuz–Ağustos serin gecelerde alt yaprak gözlemi' }
    ],
    regionalTips: 'Bamya günlük hasat edildiği için kullanılan ilaçların **PHI (Hasat Arası Süresi) 1–3 gün** olan biyolojik veya kısa bekleme süreli ruhsatlı ürünlerden seçilmesi yasal kalıntı için zorunludur.'
  },
  BAG: {
    id: 'BAG',
    name: 'Bağ (Üzüm)',
    scientificName: 'Vitis vinifera',
    family: 'Vitaceae (Asmagiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Pione_Grapes.jpg/960px-Pione_Grapes.jpg',
    vegetationDays: 'Çok Yıllık • 140–170 Gün Aktif Sezon',
    optimalSoilPh: 'pH 5.8 – 7.8 (Kireç toleranslı anaçlarla kireçli topraklarda dahi yetişir)',
    soilPreference: 'İyi drenajlı kumlu-çakıllı, tınlı derin toprak',
    waterRequirementMm: '400–600 mm (Ben düşmede sulama azaltılır)',
    criticalWaterStages: 'Sürgün gelişimi ve Koruktan ben düşmeye kadar (Hasada 15 gün kala su kesilir)',
    targetYieldPerDa: '1.800 – 3.500 kg/da (Sofralık/Kurutmalık)',
    plantingSpec: '3.0 m x 1.5–2.0 m (165–220 omca/da) • Gobli veya Telli Terbiye',
    npkPureKgPerDa: '8–12 kg N • 4–6 kg P₂O₅ • 12–16 kg K₂O + Mg + B + Fe',
    criticalTemp: 'İlkbahar geç donları -1°C sürgün yakar; +38°C salkım güneş yanığı',
    harvestCriteria: 'Refraktometre ile kuru madde ≥ 16–20° Brix (çeşide göre) ve çekirdek esmerleşmesi',
    fertilizerProgram: [
      { stage: 'Göz Uyanması – Kış Sonu', method: 'Bant / Damlama', product: '15-15-15 veya 12-30-12 + Çinko', dosagePerDa: '25–30 kg/da' },
      { stage: 'Sürgün 25 cm – Çiçek Öncesi', method: 'Yapraktan (Çok Kritik!)', product: 'Etanolamin Bor + Çinko + Mg (Silkeleme Önlemi)', dosagePerDa: '150 ml/da Bor + 150 ml Zn' },
      { stage: 'Koruk İriliği (Saçma Dönemi)', method: 'Damlama (Ayrı gün)', product: 'Kalsiyum Nitrat + Magnezyum Sülfat', dosagePerDa: '4–5 kg/da' },
      { stage: 'Ben Düşme – Olgunluk', method: 'Damlama', product: 'Potasyum Sülfat (Şeker ve renk için)', dosagePerDa: '8–10 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Bağ Küllemesi (Erysiphe necator)', threshold: 'Koruyucu program: Sürgünler 20–25 cm iken başlar (çiçek öncesi, çiçek sonu, koruk)', samplingMethod: 'Geçmiş bulaşık asmalarda erken salkım ve yaprak muayenesi' },
      { pestOrDisease: 'Bağ Mildiyösü (Plasmopara viticola)', threshold: '10–10–24 kuralı (Sürgün 10 cm, sıcaklık 10°C+, 24 saatte 10 mm yağış) hemen ardından', samplingMethod: 'Yaprakta "Yağ Lekesi" ve alt yüzeyde beyaz küf kontrolü' },
      { pestOrDisease: 'Salkım Güvesi (Lobesia botrana)', threshold: 'Feromon tuzak pikini izleyen yumurta açılımı (Her dölde 1–2 larva/salkım)', samplingMethod: 'Tarım İl/İlçe tahmin uyarı mesajı + eşeysel çekici tuzak' }
    ],
    regionalTips: 'Bağda çiçeklenme öncesinde Bor + Çinko verilmesi tane tutumunu ("boncuklanma" ve "silkme" önlemi) doğrudan artırır; Ben düşme sonrası Kükürt uygulamaları kalıntı ve renk lekesi riskine karşı dikkatli yapılmalıdır.'
  },
  ELMA: {
    id: 'ELMA',
    name: 'Elma',
    scientificName: 'Malus domestica',
    family: 'Rosaceae (Gülgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Pink_lady_and_cross_section.jpg/960px-Pink_lady_and_cross_section.jpg',
    vegetationDays: 'Çok Yıllık • 700–1.200 Saat Soğuklama (+7.2°C altı)',
    optimalSoilPh: 'pH 6.0 – 7.0',
    soilPreference: 'Derin, süzek, taban suyu olmayan killi-tınlı toprak',
    waterRequirementMm: '650–850 mm (Damla / Mini Sprink)',
    criticalWaterStages: 'Meyve tutumu, Haziran büyümesi ve renklenme öncesi',
    targetYieldPerDa: '4.500 – 8.000 kg/da (Yarı/Tam bodur modern bahçe)',
    plantingSpec: 'M9 Tam Bodur: 3.5 x 1.0–1.2 m (240–280 ağaç/da) • Yarı Bodur MM106: 4.5 x 2.5 m',
    npkPureKgPerDa: '10–15 kg N • 5–7 kg P₂O₅ • 14–18 kg K₂O + Çok Yüksek Kalsiyum!',
    criticalTemp: 'Pembe tomurcuk -2°C, Tam çiçek -1.5°C don zararı',
    harvestCriteria: 'Nişasta-iyot indeksi (4–6), et sertliği ve sapın kolay ayrılması',
    fertilizerProgram: [
      { stage: 'Göz Kabarması', method: 'Damlama / Taban', product: '15-15-15 veya Amonyum Sülfat + Çinko', dosagePerDa: '20–25 kg/da' },
      { stage: 'Taç Yaprak Dökümü – Ceviz İriliği', method: 'Yapraktan (5–7 Kez!)', product: 'Kalsiyum Klorür / Kalsiyum Şelat (Acı Benek önlemi)', dosagePerDa: '300 ml/100 L su' },
      { stage: 'Yaz Meyve İrileşmesi', method: 'Damlama', product: 'Potasyum Nitrat + Magnezyum Sülfat', dosagePerDa: '6–8 kg/da' },
      { stage: 'Hasat Sonrası (Yaprak Dökülmeden)', method: 'Yapraktan "Göz Besleme"', product: 'Bor (%20.8) + Çinko + Düşük Biüreli Üre (%3–4)', dosagePerDa: '300 g/100 L' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Elma Karalekesi (Venturia inaequalis)', threshold: 'Mills enfeksiyon şartları (yaprak ıslaklığı x sıcaklık): Fare kulağı, pembe tomurcuk, taç yaprak dökümü', samplingMethod: 'Meteoroloji yaprak ıslaklık sensörü & askospor olgunluk uyarısı' },
      { pestOrDisease: 'Elma İçkurdu (Cydia pomonella)', threshold: 'Feromon tuzakta hafta başına 3–5 kelebek + Etkili Sıcaklık Toplamı 150 gün-derece', samplingMethod: 'Bahçe çapında feromon tuzak (1 tuzak / 10–20 da)' }
    ],
    regionalTips: 'Elmalarda soğuk hava deposunda görülen "Acı Benek" (Bitter Pit) hastalık değil Kalsiyum noksanlığıdır; Mayıs’tan Ağustos’a 15 gün arayla yapılan yaprak kalsiyumu %90 engeller.'
  },
  ARMUT: {
    id: 'ARMUT',
    name: 'Armut',
    scientificName: 'Pyrus communis',
    family: 'Rosaceae (Gülgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Pears.jpg',
    vegetationDays: 'Çok Yıllık • 600–900 Saat Soğuklama',
    optimalSoilPh: 'pH 6.0 – 7.4',
    soilPreference: 'Derin killi-tınlı toprak (Ayva anacında pH > 7.5 kireç klorozu riski)',
    waterRequirementMm: '600–750 mm',
    criticalWaterStages: 'Meyve tutumu ve Ağustos irileşmesi',
    targetYieldPerDa: '3.500 – 5.500 kg/da (Deveci / Santa Maria)',
    plantingSpec: '4.0 x 1.5–2.0 m (Ayva anaçlı) veya 5.0 x 3.5 m (Çöğür)',
    npkPureKgPerDa: '9–13 kg N • 4–6 kg P₂O₅ • 12–15 kg K₂O + Fe + Ca',
    criticalTemp: 'Çiçeklenme elmadan 10 gün erken olduğundan ilkbahar donu riski yüksek',
    harvestCriteria: 'Tam olgunlaşmadan sert (yeşil) hasat edilip soğukta olgunlaştırılır',
    fertilizerProgram: [
      { stage: 'Bahar Başı', method: 'Damlama / Band', product: '15-15-15 + Demir EDDHA (Ayva anacı klorozu için)', dosagePerDa: '20 kg/da + 500 g Fe-EDDHA' },
      { stage: 'Meyve Tutumu', method: 'Yapraktan', product: 'Bor + Çinko + Deniz Yosunu', dosagePerDa: '200 ml/100 L su' },
      { stage: 'Yaz Gelişimi (Ateş Yanıklığına Dikkat!)', method: 'Damlama', product: 'Potasyum Sülfat + Kalsiyum (Azot sınırlandırılır!)', dosagePerDa: '6–8 kg/da' },
      { stage: 'Hasat Sonrası', method: 'Yapraktan', product: 'Çinko + Bor + Fosfit', dosagePerDa: '250 ml/100 L' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Armut Psillidi (Cacopsylla pyri)', threshold: '100 sürgünde %15 nimf veya yaprakta yapışkan balglı kurum (fumajin) başlangıcı', samplingMethod: 'Genç yaprak sürgünlerinde bal/nimf taraması' },
      { pestOrDisease: 'Ateş Yanıklığı (Erwinia amylovora)', threshold: 'Bakteriyeldir! Çiçek döneminde >18°C yağışta koruyucu bakır/fosetil; kuruyan dallar 40 cm alttan kesilip yakılır', samplingMethod: '"Çoban Değneği" şeklinde kararan taze sürgün uçları' }
    ],
    regionalTips: 'Armutta aşırı Azot vermek yumuşak taze sürgün oluşturarak ölümcül Ateş Yanıklığı bakterisini (Erwinia) ve Armut Psillidini patlatır; gübreleme dengeli tutulmalıdır.'
  },
  SEFTALI: {
    id: 'SEFTALI',
    name: 'Şeftali / Kayısı',
    scientificName: 'Prunus persica / P. armeniaca',
    family: 'Rosaceae (Gülgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/PrunusPersica4.jpg/960px-PrunusPersica4.jpg',
    vegetationDays: 'Çok Yıllık • 450–800 Saat Soğuklama',
    optimalSoilPh: 'pH 6.0 – 7.2',
    soilPreference: 'Süzek kumlu-tınlı, havadar toprak (su birikimine çok hassas)',
    waterRequirementMm: '550–700 mm',
    criticalWaterStages: 'Çekirdek sertleşmesi sonrası son 4 hafta hızlı şişme ("son su")',
    targetYieldPerDa: '3.000 – 5.000 kg/da',
    plantingSpec: '5.0 x 3.5–4.0 m (50–60 ağaç/da)',
    npkPureKgPerDa: '12–16 kg N • 5–7 kg P₂O₅ • 15–20 kg K₂O + Fe',
    criticalTemp: 'Çok erken çiçek açtığı için -1°C geç donlarından ağır etkilenir',
    harvestCriteria: 'Zemin renginin yeşilden krem/altın sarısına dönmesi',
    fertilizerProgram: [
      { stage: 'Göz Uyanması', method: 'Damlama / Taban', product: '15-15-15 veya 20-20-0 + Fe-EDDHA', dosagePerDa: '20–25 kg/da' },
      { stage: 'Çiçek Sonrası – Çağla', method: 'Yapraktan + Damlama', product: 'Kalsiyum + Bor + Çinko', dosagePerDa: '250 ml/100 L su' },
      { stage: 'Çekirdek Sertleşmesi Sonrası', method: 'Damlama', product: 'Potasyum Nitrat + Magnezyum Sülfat', dosagePerDa: '7–9 kg/da' },
      { stage: 'Hasat Öncesi (Renklenmede)', method: 'Damlama', product: 'Potasyum Sülfat (Şeker ve sertlik için)', dosagePerDa: '6–8 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Yaprak Kıvırcıklığı (Taphrina deformans)', threshold: 'Tomurcuklar henüz açılmadan (Kırmızı/Pembe uç evresi) %100 koruyucu ilaçlama şart!', samplingMethod: 'Yaprak açıldıktan sonra ilaçlama işe yaramaz!' },
      { pestOrDisease: 'Şeftali Filiz Güvesi / Akdeniz Meyve Sineği', threshold: 'Feromon/McPhail tuzakta 1 sinek görüldüğünde olgunlaşan meyvede hemen mücadele', samplingMethod: 'Hasattan 30–40 gün önce tuzak asımı' }
    ],
    regionalTips: 'Şeftalide Yaprak Kıvırcıklığı (Klobor) ve kayısıda Monilya (Çiçek yanıklığı) ile mücadele sadece göz kabarması ve beyaz tomurcuk başında önlenebilir; hastalık çıktıktan sonra atılan ilaç sadece gelecek yılı kurtarır.'
  },
  KIRAZ: {
    id: 'KIRAZ',
    name: 'Kiraz',
    scientificName: 'Prunus avium',
    family: 'Rosaceae (Gülgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/Cherry_season_%2848216568227%29.jpg/960px-Cherry_season_%2848216568227%29.jpg',
    vegetationDays: 'Çok Yıllık • 800–1.200 Saat Soğuklama',
    optimalSoilPh: 'pH 6.0 – 7.2',
    soilPreference: 'Mutlaka çok iyi drenajlı derin tınlı toprak (kök boğulmasına tahammülü sıfır)',
    waterRequirementMm: '500–650 mm (Hasat öncesi yağışta meyve çatlar!)',
    criticalWaterStages: 'Meyve irileşmesi ve hemen hasat sonrası çiçek gözü farklılaşması',
    targetYieldPerDa: '1.200 – 2.200 kg/da (0900 Ziraat)',
    plantingSpec: 'Gisela Bodur: 4.0 x 2.5 m • İdris/MaxMa: 5.0 x 4.0 m (Tozlayıcı %15)',
    npkPureKgPerDa: '8–12 kg N • 4–5 kg P₂O₅ • 12–15 kg K₂O + Ca + B',
    criticalTemp: 'Çiçeklenme -2°C don riski; yağış hasatta çatlamaya yol açar',
    harvestCriteria: 'Tam çeşide özgü koyu kırmızı renk ve tatlanma (saplı hasat)',
    fertilizerProgram: [
      { stage: 'Bahar Uyanması', method: 'Damlama / Band', product: '15-15-15 veya Amonyum Sülfat', dosagePerDa: '15–20 kg/da' },
      { stage: 'Çiçek – Nohut İriliği', method: 'Yapraktan', product: 'Bor + Çinko + Kalsiyum + GA₃ (Çatlama & sertlik)', dosagePerDa: '200 ml Ca + 100 ml B' },
      { stage: 'Ben Düşme (Pembeleşme)', method: 'Yapraktan + Damlama', product: 'Potasyum Sülfat + Kalsiyum Klorür (Çatlama önler)', dosagePerDa: '5 kg K₂SO₄ + Ca sprey' },
      { stage: 'Hasat Sonrası (TEMMUZ — KRİTİK!)', method: 'Damlama + Yaprak', product: 'Gelecek yılın meyve gözü için N + B + Zn yüklemesi', dosagePerDa: '10 kg Üre + 150 ml Bor' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Kiraz Sineği (Rhagoletis cerasi)', threshold: 'Sarı yapışkan tuzakta ilk ergin sinek + meyvelerde ben düşme başlangıcı', samplingMethod: 'Ağaçların güney cephesine dekara 2 adet sarı tuzak asımı' },
      { pestOrDisease: 'Monilya (Monilinia laxa)', threshold: 'Çiçek başlangıcında (%5–10 çiçek) ve tam çiçekte (%90) yağış riskinde koruyucu sprey', samplingMethod: 'İlkbahar sis ve yağmur takibi' }
    ],
    regionalTips: 'Kirazda ertesi yılın meyve tomurcukları **hasattan hemen sonraki 4–6 haftada** (Temmuz) oluşur! Bu dönemde ağaç susuz veya aç bırakılırsa gelecek yıl ikiz meyve ve çiçek dökümü yaşanır.'
  },
  ZEYTIN: {
    id: 'ZEYTIN',
    name: 'Zeytin',
    scientificName: 'Olea europaea',
    family: 'Oleaceae (Zeytingiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Olivesfromjordan.jpg',
    vegetationDays: 'Çok Yıllık (Her Dem Yeşil)',
    optimalSoilPh: 'pH 6.0 – 8.2 (Kireçli ve kayalık yamaçlara yüksek uyum)',
    soilPreference: 'Su birikmeyen kireçli-tınlı, çakıllı süzek toprak',
    waterRequirementMm: '350–500 mm (Kuru/Sulu)',
    criticalWaterStages: 'Bahar çiçeklenme öncesi (sürgün) ve Ağustos yağ oluşumu dönemi',
    targetYieldPerDa: '600 – 1.400 kg/da (Periyodisite yönetimi ile)',
    plantingSpec: '6 x 6 m (28 ağaç/da) • Süper Yoğun: 4 x 1.5 m',
    npkPureKgPerDa: '8–12 kg N • 4–5 kg P₂O₅ • 12–16 kg K₂O + Çok Yüksek Bor!',
    criticalTemp: '-7°C altı odun donu; çiçekte 34°C kuru poyraz döllenmeyi bozar',
    harvestCriteria: 'Sofralık yeşil/siyah irilik; yağlıkta mor dönüm ve en yüksek yağ/kuru madde',
    fertilizerProgram: [
      { stage: 'Kış Sonu (Şubat–Mart)', method: 'Taç İzdüşümüne Gömme', product: '15-15-15 veya 20-20-0 + Boraks/Etidot-67', dosagePerDa: '25–30 kg/da + 250 g B/da' },
      { stage: 'Somak Çıkışı – Çiçek Öncesi (Nisan)', method: 'Yapraktan (EN ÖNEMLİ!)', product: 'Etanolamin Bor + Çinko + Deniz Yosunu', dosagePerDa: '200 ml Bor + 150 ml Zn / 100 L' },
      { stage: 'Çekirdek Sertleşmesi (Temmuz)', method: 'Damlama / Yaprak', product: 'Potasyum Sülfat + Kalsiyum', dosagePerDa: '5–8 kg/da' },
      { stage: 'Sonbahar (Eylül)', method: 'Yapraktan', product: 'Potasyum + Sıvı Kükürt / Bakır (Halkalı leke)', dosagePerDa: '300 ml K₂O' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Zeytin Halkalı Leke (Spilocaea oleagina)', threshold: 'İlkbahar uyanmadan (%1.5 Bordo) ve sonbahar ilk yağmurlardan önce bakırlı ilaçlama', samplingMethod: 'Sodyum hidroksit (NaOH) ile yaprak içi gizli leke testi' },
      { pestOrDisease: 'Zeytin Sineği (Bactrocera oleae)', threshold: 'Sofralıkta %1–2 vuruk; Yağlıkta %6–8 vuruk + McPhail tuzakta ergin artışı', samplingMethod: 'Çekirdek sertleşmesinden itibaren haftalık 100 meyve vuruk kontrolü' },
      { pestOrDisease: 'Zeytin Güvesi (Prays oleae)', threshold: 'Çiçek neslinde %10 bulaşık salkım; Meyve neslinde mercimek iriliğinde %10 canlı yumurta', samplingMethod: 'Sürgün/somak incelemesi ve eşeysel tuzak' }
    ],
    regionalTips: 'Zeytinde "var yılı – yok yılı" (periyodisite) kırılmasının sırrı, hasattan hemen sonraki düzenli budama + çiçek öncesi **Bor (B)** + yaz sonu **Potasyum (K)** dengesidir.'
  },
  NARENCIYE: {
    id: 'NARENCIYE',
    name: 'Narenciye',
    scientificName: 'Citrus sinensis / C. limon / C. reticulata',
    family: 'Rutaceae (Turunçgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Oranges_-_whole-halved-segment.jpg/960px-Oranges_-_whole-halved-segment.jpg',
    vegetationDays: 'Çok Yıllık (Her Dem Yeşil)',
    optimalSoilPh: 'pH 5.8 – 7.5 (Tuzluluğa hassas)',
    soilPreference: 'Derin, süzek tınlı toprak',
    waterRequirementMm: '750–950 mm',
    criticalWaterStages: 'Çiçeklenme, Haziran meyve dökümü ve yaz sıcakları',
    targetYieldPerDa: '3.500 – 6.000 kg/da',
    plantingSpec: '6 x 4 m (42 ağaç/da) veya 5 x 3 m',
    npkPureKgPerDa: '14–18 kg N • 5–7 kg P₂O₅ • 15–20 kg K₂O + Çok Yüksek Mg, Zn, Mn, Fe!',
    criticalTemp: '-2°C meyve donar, -5°C ağaç zarar görür (Limon daha hassas)',
    harvestCriteria: 'Şeker / Asit (Brix/Asit) oranı standarda ulaştığında (çeşide göre ≥ 6.5–8)',
    fertilizerProgram: [
      { stage: 'Bahar Sürgünü (Şubat Sonu)', method: 'Taç İzdüşümü / Damlama', product: '15-15-15 veya Amonyum Sülfat + Fe-EDDHA', dosagePerDa: '30–35 kg/da + 500 g Fe' },
      { stage: 'Çiçeklenme Sonrası', method: 'Yapraktan', product: 'Çinko + Mangan + Bor + Üre (%0.5 düşük biüreli)', dosagePerDa: '200 ml Zn+Mn + 100 ml B' },
      { stage: 'Haziran Dökümü Sonrası', method: 'Damlama', product: 'Magnezyum Nitrat + Kalsiyum Nitrat', dosagePerDa: '5–6 kg/da' },
      { stage: 'Meyve Büyüme (Ağustos–Eylül)', method: 'Damlama', product: 'Potasyum Nitrat / Potasyum Sülfat (Kabuk kalınlığı ve irilik)', dosagePerDa: '8–10 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Akdeniz Meyve Sineği (Ceratitis capitata)', threshold: 'Trimedlure tuzağında meyve renk dönümünde günlük 1+ sinek yakalandığında zehirli yem dal ilaçlaması', samplingMethod: 'Ağustos sonundan itibaren tuzak kontrolü' },
      { pestOrDisease: 'Turunçgil Kırmızı Örümceği & Pas Böcüsü', threshold: 'Yaprak başına 3–5 kırmızıörümcek veya 1 cm² meyvede pas böcüsü', samplingMethod: 'Meyve altlarında büyüteç muayenesi' }
    ],
    regionalTips: 'Narenciye yapraklarında en yaygın görülen noksanlıklar Çinko (alacalı benekli küçük yaprak), Magnezyum (ters V sararması) ve Demir (kireç klorozu)dur; potasyum eksik kalırsa meyveler ufak kalır.'
  },
  FISTIK: {
    id: 'FISTIK',
    name: 'Antep Fıstığı',
    scientificName: 'Pistacia vera',
    family: 'Anacardiaceae (Sakızgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b5/Pistachio_vera.jpg/960px-Pistachio_vera.jpg',
    vegetationDays: 'Çok Yıllık • 700–1.000 Saat Soğuklama (Kuraklığa yüksek direnç)',
    optimalSoilPh: 'pH 7.0 – 8.2 (Kireçli ve taşlı toprakları çok iyi değerlendirir)',
    soilPreference: 'Derin kireçli-tınlı, su tutmayan toprak',
    waterRequirementMm: '350–550 mm (Sulu sistemde verim ve çıtlama %40 artar!)',
    criticalWaterStages: 'İç doldurma (Temmuz) ve Karagöz (gelecek yılın gözleri) beslenme dönemi',
    targetYieldPerDa: '150 – 350 kg/da Kuru Kabuklu (Sulu bahçede 350+ kg)',
    plantingSpec: '8 x 8 m (16 ağaç/da) veya Sulu 6 x 6 m (Her 8–10 dişi ağaca 1 erkek ağaç)',
    npkPureKgPerDa: '8–12 kg N • 5–7 kg P₂O₅ • 10–14 kg K₂O + Çok Yüksek Çinko & Bor!',
    criticalTemp: 'Yaz 35–42°C meyve içi/yağ oluşumu için ideal; çiçekte geç donlara dikkat',
    harvestCriteria: 'Dış kırmızı kabuğun (ben) yumuşayıp ayrıldığı ve iç çıtlamanın tamamlandığı Ağustos–Eylül',
    fertilizerProgram: [
      { stage: 'Kış Sonu (Şubat–Mart)', method: 'Taç İzdüşümüne Gömme', product: '15-15-15 veya 20-20-0 + Tarım Kükürdü (pH için)', dosagePerDa: '25–30 kg/da + 15 kg Kükürt' },
      { stage: 'Tomurcuk Kabarması (Nisan)', method: 'Yapraktan', product: 'Çinko EDTA + Etanolamin Bor + Üre', dosagePerDa: '200 ml Zn + 150 ml Bor / 100 L' },
      { stage: 'İç Doldurma (Haziran–Temmuz)', method: 'Damlama / Yaprak', product: 'Potasyum Nitrat + Magnezyum (Çıtlama ve doluluk için!)', dosagePerDa: '6–8 kg/da' },
      { stage: 'Hasat Öncesi / Karagöz Koruma', method: 'Yapraktan', product: 'Potasyum + Fosfit + Bor (Karagöz dökümünü önler)', dosagePerDa: '250 ml/100 L' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Antepfıstığı Psillidi (Agonoscena pistaciae)', threshold: 'Bileşik yaprak başına 20–30 nimf (Yapışkan tatlı madde "Ballık" başlamadan!)', samplingMethod: 'Mayıs–Ağustos arası haftalık 100 bileşik yaprak sayımı' },
      { pestOrDisease: 'Karazenk (Pseudocercospora pistacina)', threshold: 'İlk bahar yağışlarında (yapraklar gelişirken) hemen koruyucu uygulama', samplingMethod: 'Alt yapraklarda siyah-kahverengi köşeli lekeler' },
      { pestOrDisease: 'Meyve İçkurdu / Göz Kurdu (Recurvaria / Megastigmus)', threshold: 'Yumurta çıkışıyla eşzamanlı mücadele (Sadece Tarım İl Müdürlüğü uyarısında)', samplingMethod: 'Sertleşmemiş mercimek/nohut iriliği salkımlarda kontrol' }
    ],
    regionalTips: 'Antep Fıstığı’nda halk arasında "Ballık" denen Psillid tatlı maddesi oluşursa yapraklar yanar ve **gelecek yılın Karagöz meyve tomurcukları dökülür**. İç doldurma ve çıtlama oranı yazlık sulama + Potasyum + Bor dengesine bağlıdır.'
  },
  FINDIK: {
    id: 'FINDIK',
    name: 'Fındık',
    scientificName: 'Corylus avellana',
    family: 'Betulaceae (Huşgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Hazelnuts_%28Corylus_avellana%29_-_whole_with_kernels_%28cropped2%29.jpg/960px-Hazelnuts_%28Corylus_avellana%29_-_whole_with_kernels_%28cropped2%29.jpg',
    vegetationDays: 'Çok Yıllık • Kışın Tozlaşır (Aralık–Şubat Karanfil/Püskül)',
    optimalSoilPh: 'pH 5.5 – 7.0 (Asidik Karadeniz topraklarında Kireçleme gerekir!)',
    soilPreference: 'Süzek tınlı, organik maddece zengin toprak',
    waterRequirementMm: '800+ mm (Yağış + Temmuz kuraklığında takviye)',
    criticalWaterStages: 'Mayıs–Haziran döllenme ve Temmuz iç dolumu',
    targetYieldPerDa: '150 – 280 kg/da Kabuklu',
    plantingSpec: 'Ocak sistemi: 4 x 4 m (55–65 ocak/da, her ocakta 4–6 dal) • Tek gövde 4 x 2.5 m',
    npkPureKgPerDa: '10–14 kg N • 4–6 kg P₂O₅ • 8–12 kg K₂O + Kireç + Bor',
    criticalTemp: 'Kış karanfiller -8°C’ye dayanır; Mart yapraklanması sonrası -2°C don tehlikeli',
    harvestCriteria: 'Zurufların sararıp kuruduğu ve tanelerin zuruftan döküldüğü Ağustos',
    fertilizerProgram: [
      { stage: 'Kış Sonu (pH < 5.5 ise)', method: 'Ocak Çevresine Gömme', product: 'Tarım Kireci / Dolomit (3 yılda bir) + 15-15-15', dosagePerDa: '100 kg Dolomit + 25 kg 15-15-15' },
      { stage: 'Mart Yapraklanma', method: 'Yüzey Serpme', product: 'CAN %26 (Toprak asidikse Üre yerine Kalsiyumlu nitrat)', dosagePerDa: '15–20 kg/da' },
      { stage: 'Mayıs (Çotanak Dolum Öncesi)', method: 'Yapraktan + Üst', product: 'CAN %26 + Yapraktan Etanolamin Bor + Çinko', dosagePerDa: '12 kg/da + 150 ml B' },
      { stage: 'Haziran – Temmuz', method: 'Yapraktan', product: 'Potasyum Nitrat + Magnezyum (Randıman ve yağ için)', dosagePerDa: '300 g/100 L' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Fındık Kurdu (Curculio nucum)', threshold: 'Mayıs başında çarşafa düşen 10 ocakta 2+ ergin böcek ("sarı/kahverengi burunlu")', samplingMethod: 'Sabah serinliğinde 10 ocağa bez çarşaf üzerine sopa ile silkeleme' },
      { pestOrDisease: 'Fındık Kokarcası (Halyomorpha halys / Nezara)', threshold: 'Ocakta 1–2 ergin/nimf (İçte buruşukluk ve acı lekelenme yapar)', samplingMethod: 'Silkeleme çarşafı ve feromon tuzakları' },
      { pestOrDisease: 'Külleme & Kozalak Akarı', threshold: 'Kış sonunda sürgünlerde %20+ şişmiş kozalak varsa Nisan’da göç anında kükürt', samplingMethod: 'Şubat–Mart dal muayenesi' }
    ],
    regionalTips: 'Fındık bahçelerinde yağış nedeniyle toprak pH’ı genellikle 4.5–5.2’ye düşer; pH düzeltilmeden atılan fosfor gübresi bitkice alınamaz. Çiçeklenme kışın olsa da **döllenme Mayıs’ta gerçekleştiği** için Mayıs Bor spreyi boş çotanğı azaltır.'
  },
  CEVIZ: {
    id: 'CEVIZ',
    name: 'Ceviz',
    scientificName: 'Juglans regia',
    family: 'Juglandaceae (Cevizgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Walnuts_-_whole_and_open_with_halved_kernel.jpg/960px-Walnuts_-_whole_and_open_with_halved_kernel.jpg',
    vegetationDays: 'Çok Yıllık • 400–900 Saat Soğuklama (Chandler geç uyanır)',
    optimalSoilPh: 'pH 6.2 – 7.5',
    soilPreference: 'En az 2.5–3 metre derin, taban suyu olmayan süzek tınlı toprak!',
    waterRequirementMm: '700–900 mm (Aşırı su kök çürüklüğü yapar!)',
    criticalWaterStages: 'Sürgün gelişimi ve Temmuz iç doldurma–beyaz renk koruma',
    targetYieldPerDa: '350 – 650 kg/da Kuru Kabuklu (Chandler)',
    plantingSpec: '7 x 5 m veya 8 x 4 m (28–35 ağaç/da) • Tozlayıcı Franquette (%5–8)',
    npkPureKgPerDa: '12–16 kg N • 5–7 kg P₂O₅ • 10–14 kg K₂O + Çok Yüksek Bor & Bakır!',
    criticalTemp: '38°C üstü kabukta ve içte güneş yanığı (büzüşme); don cephesinde erken çeşit riskli',
    harvestCriteria: 'Yeşil kabuğun %75 çatlayıp ceviz iç zarının koyulaşmaya başladığı Eylül–Ekim',
    fertilizerProgram: [
      { stage: 'Bahar Uyanması (Nisan)', method: 'Damlama / Band', product: '15-15-15 veya Amonyum Sülfat + Hümik', dosagePerDa: '25–30 kg/da' },
      { stage: 'Mayıs – Sürgün & Çiçek', method: 'Yapraktan + Damlama', product: 'Bor + Çinko + CAN %26', dosagePerDa: '150 ml B + 200 ml Zn / 100 L' },
      { stage: 'Temmuz İç Doldurma', method: 'Damlama', product: 'Potasyum Sülfat + Magnezyum (Beyaz iç ve dolgunluk)', dosagePerDa: '7–9 kg/da' },
      { stage: 'Güneş Yanığı Önlemi', method: 'Yapraktan Koruma', product: 'Kaolin Kili (Surround) + Kalsiyum (Temmuz sıcaklarında)', dosagePerDa: '3 kg/100 L su' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Ceviz Antraknozu & Bakteriyel Yanıklık (Xanthomonas)', threshold: 'İlkbahar yağışlı her dönemde sürgün 5–10 cm iken koruyucu Bakır + Mancozeb', samplingMethod: 'Tomurcuk kabarması ve yağmurlu Nisan–Mayıs takibi' },
      { pestOrDisease: 'Ceviz İçkurdu (Cydia pomonella)', threshold: 'Feromon tuzakta hafta başına 3+ kelebek (Genellikle Mayıs sonu & Temmuz 2. döl)', samplingMethod: 'Ağaç üst taç kısmına feromon tuzak' }
    ],
    regionalTips: 'Cevizde "bakteriyel yanıklık" erken bahar yağmurlarında meyve ve sürgünleri karartır; göz uyanmasından meyve nohut iriliğine gelene kadar 2–3 koruyucu bakır uygulaması şarttır. Yaz güneşi yanığı Kaolin Kili ile %80 engellenir.'
  },
  NAR: {
    id: 'NAR',
    name: 'Nar',
    scientificName: 'Punica granatum',
    family: 'Lythraceae (Kınagiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Pomegranate_fruit_-_whole_and_piece_with_arils.jpg/960px-Pomegranate_fruit_-_whole_and_piece_with_arils.jpg',
    vegetationDays: 'Çok Yıllık • 150–250 Saat Düşük Soğuklama',
    optimalSoilPh: 'pH 5.8 – 7.8 (Hafif tuzlu ve kireçli topraklara dayanıklı)',
    soilPreference: 'Derin alüvyal killi-tınlı toprak',
    waterRequirementMm: '550–750 mm (DÜZENLİ SULAMA — Aksi halde tüm meyveler çatlar!)',
    criticalWaterStages: 'Ağustos–Eylül meyve şişme ve renk dönümü (Ani su şoku kabuğu yarır)',
    targetYieldPerDa: '3.000 – 5.000 kg/da (Hicaznar)',
    plantingSpec: '5 x 3 m veya 4.5 x 3 m (65–75 ağaç/da)',
    npkPureKgPerDa: '10–14 kg N • 5–6 kg P₂O₅ • 16–20 kg K₂O + Ca + B + Zn',
    criticalTemp: '-10°C altı gövde çatlar; 38°C üstü güney yüzlerde güneş yanığı',
    harvestCriteria: 'Kabuk kırmızıya dönüp tane asitliği düştüğünde (> 15° Brix)',
    fertilizerProgram: [
      { stage: 'Bahar Sürgünü', method: 'Damlama / Band', product: '15-15-15 + Demir EDDHA', dosagePerDa: '25 kg/da' },
      { stage: 'Çiçeklenme (Mayıs–Haziran)', method: 'Yapraktan', product: 'Bor + Çinko (Hermafrodit çiçek tutumu)', dosagePerDa: '150 ml B + 200 ml Zn' },
      { stage: 'Meyve Büyümesi (Temmuz–Ağustos)', method: 'Damlama + Yaprak', product: 'Kalsiyum Nitrat + Kaolin Kili (Çatlama ve güneş yanığına)', dosagePerDa: '5 kg Ca / da + 3 kg Kaolin' },
      { stage: 'Renk Dönümü (Eylül)', method: 'Damlama', product: 'Potasyum Sülfat (Şeker ve koyu kırmızı dane)', dosagePerDa: '7–9 kg/da' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Harnup Güvesi (Ectomyelois ceratoniae)', threshold: 'Meyve taçlarında ilk yumurta/larva pislikleri ve yaprakbiti ballığı kontrolü (Yaprakbiti önlenmezse güve kaliks içine girer!)', samplingMethod: 'Haftalık kaliks (taç) içi kontrolü ve feromon tuzak' },
      { pestOrDisease: 'Nar Yaprakbiti & Akdeniz Meyve Sineği', threshold: 'Sürgün ve meyvelerde koloni başlangıcı; sonbahar tuzakta sinek', samplingMethod: 'Haziran–Eylül arası düzenli tarama' }
    ],
    regionalTips: 'Narda meyve çatlamasının iki ana sebebi düzensiz sulama ve Kalsiyum/Bor eksikliğidir; damla sulama periyodu Eylül sonuna kadar kesintisiz sabit nemde tutulmalıdır.'
  },
  BADEM: {
    id: 'BADEM',
    name: 'Badem',
    scientificName: 'Prunus amygdalus',
    family: 'Rosaceae (Gülgiller)',
    categoryGroup: 'MEYVE',
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/37/Almonds_-_in_shell%2C_shell_cracked_open%2C_shelled%2C_blanched.jpg/960px-Almonds_-_in_shell%2C_shell_cracked_open%2C_shelled%2C_blanched.jpg',
    vegetationDays: 'Çok Yıllık • 250–500 Saat Soğuklama (Ferragnes/Ferraduel geç açar)',
    optimalSoilPh: 'pH 6.2 – 8.0',
    soilPreference: 'Mutlaka iyi drenajlı derin kireçli-tınlı toprak (su birikiminde ölür!)',
    waterRequirementMm: '400–600 mm (Sulama ile verim 2.5 kat artar)',
    criticalWaterStages: 'Çağla büyümesi ve Yaz iç doldurma (Hasattan 20 gün önce kavlama için su azaltılır)',
    targetYieldPerDa: '220 – 450 kg/da İç Badem (Sulu modern bahçe)',
    plantingSpec: '6 x 4 m veya 6 x 5 m (33–42 ağaç/da) • En az %30 uyumlu tozlayıcı şart',
    npkPureKgPerDa: '10–14 kg N • 5–6 kg P₂O₅ • 12–16 kg K₂O + Çok Yüksek Bor & Çinko!',
    criticalTemp: 'Erken çiçeklenme nedeniyle -1.5°C ilkbahar don riski (Geç açan Ferragnes tercih edilir)',
    harvestCriteria: 'Dış yeşil kabuğun (kavlak) %80 açılıp için kuruduğu Ağustos–Eylül',
    fertilizerProgram: [
      { stage: 'Bahar Uyanması (Şubat–Mart)', method: 'Band / Damlama', product: '15-15-15 veya Amonyum Sülfat', dosagePerDa: '20–25 kg/da' },
      { stage: 'Pembe Tomurcuk – Çağla', method: 'Yapraktan', product: 'Bor + Çinko (Bademde polen yaşamı için kritik)', dosagePerDa: '150 ml B + 200 ml Zn / 100 L' },
      { stage: 'İç Doldurma (Mayıs–Haziran)', method: 'Damlama', product: 'CAN %26 + Potasyum Sülfat', dosagePerDa: '6–8 kg/da' },
      { stage: 'Hasat Sonrası (Ekim)', method: 'Yapraktan (Yaprak dökülmeden)', product: 'Etanolamin Bor + Çinko + %3 Üre (Ertesi yıl çiçek gücü!)', dosagePerDa: '250 g/100 L' }
    ],
    economicThresholds: [
      { pestOrDisease: 'Badem İçkurdu (Eurytoma amygdali)', threshold: 'Ergin çıkış kafeslerinde ilkbahar ilk çıkıştan 5–7 gün sonra çağlalar nohut iriliğindeyken mücadele!', samplingMethod: 'Kışın toplanan kurtlu badem kafesi takibi (İlçe Tarım duyurusu)' },
      { pestOrDisease: 'Monilya & Yaprak Delen (Çil)', threshold: 'Pembe tomurcuk ve taç yaprak dökümünde yağışlı havada mutlaka koruyucu fungisit', samplingMethod: 'Çiçeklenme yağışlarının anlık takibi' }
    ],
    regionalTips: 'Badem kendi kendini dölleyemeyen bir ağaçtır (Ferragnes + Ferraduel birlikte dikilmelidir) ve **Bor eksikliğine en duyarlı sert çekirdekli türdür**; hasat sonrası yapraktan atılan Bor+Çinko gelecek yılın meyve tutumunu doğrudan belirler.'
  }
};

export function getProblemVisualAndMeta(
  problemName: string,
  problemType: string,
  _cropName?: string
): ProblemVisualMeta {
  const n = (problemName || '').toLocaleLowerCase('tr-TR');

  if (n.includes('yeşilkurt') || n.includes('helicoverpa')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Helicoverpa_armigera.jpg',
      scientificName: 'Helicoverpa armigera',
      modeOfAction: 'IRAC Grup 28 (Chlorantraniliprole), Grup 6 (Emamectin Benzoate), Grup 5 (Spinosad)',
      culturalControls: [
        'Hasat sonrası tarla derin sürümü ile topraktaki kışlayan pupaların imhası.',
        'Pamuk ve mısırda tuzak şerit ekimi ve aşırı azotlu gübrelemeden kaçınılması.',
        'İlaçlamanın larvalar koza/meyve içine girmeden 1.–2. larva evresinde akşam serinliğinde yapılması.'
      ],
      phiHint: '3–14 Gün (Etken maddeye göre)'
    };
  }

  if (n.includes('yaprakkurdu') || n.includes('yaprak kurdu') || n.includes('spodoptera')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Spodoptera_littoralis.JPG/960px-Spodoptera_littoralis.JPG',
      scientificName: 'Spodoptera littoralis / S. exigua',
      modeOfAction: 'IRAC Grup 28, Grup 6, Grup 15 (Lufenuron / Novaluron)',
      culturalControls: [
        'Yabancı otların (sirken, horozibiği) temizlenmesi.',
        'Yumurta paketlerinin akşamüzeri tarla kenarlarında kontrol edilmesi ve grup halindeki yeni çıkmış larvaların erken müdahalesi.'
      ],
      phiHint: '3–7 Gün'
    };
  }

  if (n.includes('beyazsinek') || n.includes('bemisia')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3c/Silverleaf_Whitefly_%28Bemisia_tabaci%29_adult.jpg',
      scientificName: 'Bemisia tabaci',
      modeOfAction: 'IRAC Grup 23 (Spirotetramat), Grup 7C (Pyriproxyfen), Grup 29 (Flonicamid), Grup 4C (Sulfoxaflor)',
      culturalControls: [
        'Sera havalandırmalarında 50 mesh tül sineklik kullanılması ve sarı yapışkan tuzaklar asılması.',
        'Pamukta aşırı sulama ve geç azot verilmesinden kaçınılarak sıkışık ve gölgeli bitki tacı oluşumunun önlenmesi.'
      ],
      phiHint: '3–14 Gün'
    };
  }

  if (n.includes('kırmızıörümcek') || n.includes('kırmızı örümcek') || n.includes('tetranychus') || n.includes('akarisit')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Tetranychus_urticae_%284883560779%29.jpg/960px-Tetranychus_urticae_%284883560779%29.jpg',
      scientificName: 'Tetranychus urticae',
      modeOfAction: 'IRAC Grup 6 (Abamectin), Grup 23 (Spirodiclofen), Grup 10A (Etoxazole / Hexythiazox)',
      culturalControls: [
        'Tarla kenarındaki toz kalkmasını azaltmak ve yabancı ot konukçularını temizlemek.',
        'Aynı etki grubundan arka arkaya ilaç kullanmayıp yumurta+nimf ve ergin gruplarını münavebeli atmak (yaprak altı kaplama ilaçlama).'
      ],
      phiHint: '3–21 Gün'
    };
  }

  if (n.includes('tuta') || n.includes('domates güvesi')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Tuta_absoluta_5432149.jpg',
      scientificName: 'Phthorimaea (Tuta) absoluta',
      modeOfAction: 'IRAC Grup 28 + Grup 6 + Grup 5 (Spinetoram) + Bacillus thuringiensis (Grup 11A)',
      culturalControls: [
        'Dekara 2–4 adet su/feromon tuzağı kurulması ve bulaşık galerili alt yaprakların naylon torbada bahçeden uzaklaştırılması.',
        'Domates hasadından sonra sera/tarlada artıkları tamamen yakarak veya derin gömerek döngünün kırılması.'
      ],
      phiHint: '3 Gün'
    };
  }

  if (n.includes('bozkurt') || n.includes('telkurdu') || n.includes('agrotis')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Agrotis_ipsilon_aneituma.jpg',
      scientificName: 'Agrotis ipsilon / Agriotes spp.',
      modeOfAction: 'IRAC Grup 3A (Tefluthrin, Deltamethrin, Lambda-cyhalothrin — Kepekli zehirli yem veya kök bölgesi)',
      culturalControls: [
        'Ekim öncesi tarla yabancı otlarının en az 2–3 hafta önceden temizlenip işlenmesi.',
        'Bozkurt kesik fideleri akşam günbatımından sonra yüzeye çıktığı için mücadelenin ikindi–akşam saatlerinde sıra üzeri yapılması.'
      ],
      phiHint: 'Ekim / Fide Dönemi'
    };
  }

  if (n.includes('trips') || n.includes('thrips')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Thrips_tabaci%2C_Frankliniella_occidentalis.jpg',
      scientificName: 'Thrips tabaci / Frankliniella occidentalis',
      modeOfAction: 'IRAC Grup 5 (Spinetoram, Spinosad), Grup 4A/4D',
      culturalControls: [
        'Mavi yapışkan tuzaklarla erken ergin takibi ve sera kenarlarındaki çiçekli yabancı otların temizlenmesi.',
        'Direnç kırılması için yüksek basınçlı ince püskürtme ile çiçek ve yaprak kını içine temas sağlanması.'
      ],
      phiHint: '3–7 Gün'
    };
  }

  if (n.includes('yaprakbiti') || n.includes('yaprak biti') || n.includes('aphis') || n.includes('psillid')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Green_peach_aphid_%28Myzus_persicae%29_on_a_stem%2C_Lisbon%2C_Portugal_%28approx._GPS_location%29_julesvernex2.jpg/960px-Green_peach_aphid_%28Myzus_persicae%29_on_a_stem%2C_Lisbon%2C_Portugal_%28approx._GPS_location%29_julesvernex2.jpg',
      scientificName: 'Aphis gossypii / Myzus persicae / Agonoscena pistaciae',
      modeOfAction: 'IRAC Grup 29 (Flonicamid), Grup 9B (Pymetrozine), Grup 4A (Acetamiprid)',
      culturalControls: [
        'Uğurböceği (Coccinellidae) ve Chrysoperla gibi doğal düşmanları koruyan seçici sistemik ilaçların tercih edilmesi.',
        'Gereksiz aşırı azotlu gübrelemeden (yumuşak taze sürgün oluşumundan) kaçınılması.'
      ],
      phiHint: '3–14 Gün'
    };
  }

  if (n.includes('süne') || n.includes('kımıl') || n.includes('eurygaster')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Eurygaster_integriceps_Puton.jpg',
      scientificName: 'Eurygaster integriceps',
      modeOfAction: 'IRAC Grup 3A (Lambda-cyhalothrin, Deltamethrin, Alpha-cypermethrin)',
      culturalControls: [
        'Erken olgunlaşan yerli/kışlık buğday çeşitlerinin ekimi ve hasadın geciktirilmemesi.',
        'Yumurta parazitoitleri (Trissolcus spp.) korunması için Tarım Bakanlığı nimf eşik duyurularına uyulması.'
      ],
      phiHint: '14–21 Gün'
    };
  }

  if (n.includes('mısır kurdu') || n.includes('ostrinia')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Ostrinia_nubilalis01.jpg/960px-Ostrinia_nubilalis01.jpg',
      scientificName: 'Ostrinia nubilalis',
      modeOfAction: 'IRAC Grup 28 (Chlorantraniliprole), Grup 15 + Grup 3A',
      culturalControls: [
        'Hasattan sonra mısır sap ve anızlarının parçalanıp toprağa derin gömülerek kışlayan larvaların yok edilmesi.',
        'İkinci ürün ekim tarihinin bölgesel pik uçuşundan kaçacak şekilde ayarlanması.'
      ],
      phiHint: '7–14 Gün'
    };
  }

  if (n.includes('patates böceği') || n.includes('leptinotarsa')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Imago_of_Colorado_potato_beetle_on_leaf.jpg/960px-Imago_of_Colorado_potato_beetle_on_leaf.jpg',
      scientificName: 'Leptinotarsa decemlineata',
      modeOfAction: 'IRAC Grup 5 (Spinosad), Grup 28, Grup 4A',
      culturalControls: [
        'Patatesin üst üste aynı tarlaya dikilmemesi (hububat/mısır münavebesi).',
        'Hasat sonrası tarladaki yumru artıklarının toplanıp imha edilmesi.'
      ],
      phiHint: '3–14 Gün'
    };
  }

  if (n.includes('içkurdu') || n.includes('iç kurdu') || n.includes('cydia')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Cydia_pomonella_trap_2012-06-05.jpg/960px-Cydia_pomonella_trap_2012-06-05.jpg',
      scientificName: 'Cydia pomonella',
      modeOfAction: 'IRAC Grup 28, Grup 15, Şaşırtma Feromon Yayıcılar',
      culturalControls: [
        'Gövdelere Haziran başında oluklu mukavva tuzak bant sarılıp toplanan diyapoz larvalarının imhası.',
        'Kurtlanıp yere düşen meyvelerin düzenli toplanıp derin gömülmesi.'
      ],
      phiHint: '7–14 Gün'
    };
  }

  if (n.includes('salkım güvesi') || n.includes('lobesia')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Lobesia_sp._%28reliquana_or_botrana%5E%29_European_Grapevine_Moth_%28Lobesia_botrana%29_-_Flickr_-_gailhampshire.jpg',
      scientificName: 'Lobesia botrana',
      modeOfAction: 'IRAC Grup 28, Grup 5 (Spinosad), Grup 18 (Methoxyfenozide)',
      culturalControls: [
        'Asmalarda salkımların havalanmasını sağlayan yaz budaması (yaprak alma).',
        '1., 2. ve 3. döl feromon tuzak takiplerine göre zamanlı ilaçlama.'
      ],
      phiHint: '3–14 Gün'
    };
  }

  if (n.includes('zeytin sineği') || n.includes('bactrocera') || n.includes('akdeniz meyve sineği')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Bactrocera_oleae_g1.jpg/960px-Bactrocera_oleae_g1.jpg',
      scientificName: 'Bactrocera oleae / Ceratitis capitata',
      modeOfAction: 'IRAC Grup 5 (Spinosad + Protein Hidrolizat zehirli yem), Grup 4A, Kitlesel Tuzak',
      culturalControls: [
        'Hasattan sonra yere dökülen vuruklu meyvelerin toplanması ve erken hasat.',
        'Dekara 5–10 adet besin çekicili tuzak veya zehirli yem kısmi dal ilaçlaması.'
      ],
      phiHint: '7–14 Gün'
    };
  }

  if (n.includes('mildiyö') || n.includes('phytophthora') || n.includes('plasmopara') || n.includes('peronospora')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/aa/Late_blight_on_potato_leaf_2.jpg/960px-Late_blight_on_potato_leaf_2.jpg',
      scientificName: 'Phytophthora infestans / Plasmopara viticola',
      modeOfAction: 'FRAC Grup 4 (Metalaxyl-M), Grup 40 (Dimethomorph, Mandipropamid), Grup 11 + Grup M03',
      culturalControls: [
        'Sık dikimden kaçınılması, alt yaprak budamasıyla sıralar arası hava akımının açılması.',
        'Yağmurlama sulama yerine akşam/gece yaprak ıslatmayan damla sulama tercih edilmesi.'
      ],
      phiHint: '3–14 Gün'
    };
  }

  if (n.includes('erken yaprak') || n.includes('alternaria') || n.includes('stemphylium') || n.includes('leke')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Alternaria_solani_-_leaf_lesions.jpg/960px-Alternaria_solani_-_leaf_lesions.jpg',
      scientificName: 'Alternaria solani / Alternaria spp.',
      modeOfAction: 'FRAC Grup 11 (Azoxystrobin, Pyraclostrobin), Grup 3 (Difenoconazole), Grup 7',
      culturalControls: [
        'Alt yaşlı hastalıklı yaprakların toplanıp yakılması ve 3 yıllık münavebe.',
        'Potasyum ve Kalsiyum dengesi sağlanarak yaprak dokusunun güçlendirilmesi.'
      ],
      phiHint: '3–14 Gün'
    };
  }

  if (n.includes('karaleke') || n.includes('venturia') || n.includes('halkalı leke')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Apple_scab_SEM.jpg',
      scientificName: 'Venturia inaequalis / Spilocaea oleagina',
      modeOfAction: 'FRAC Grup 3 (Difenoconazole, Myclobutanil), Grup U12 (Dodine), Grup M01 (Bakır)',
      culturalControls: [
        'Sonbaharda dökülen hastalıklı yaprakların toprağa karıştırılması veya %5 Üre spreyi ile çürütülmesi.',
        'Taç içini açan kış budaması ile bahçede yaprak ıslaklık süresinin azaltılması.'
      ],
      phiHint: '14–21 Gün'
    };
  }

  if (n.includes('külleme') || n.includes('erysiphe') || n.includes('oidium') || n.includes('uncinula')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/51/Powdery_mildew_9.jpg/960px-Powdery_mildew_9.jpg',
      scientificName: 'Erysiphe / Uncinula necator / Leveillula taurica',
      modeOfAction: 'FRAC Grup M02 (Kükürt), Grup 3 (Penconazole, Tebuconazole), Grup 13 (Quinoxyfen), Grup 7',
      culturalControls: [
        'Asma ve sebzede koltuk alma/yaprak alma ile güneşlenme ve hava sirkülasyonunun artırılması.',
        'Aşırı azotlu gübrelemeden kaçınılması (gölgede aşırı sulu ve zayıf doku küllemeye davetiye çıkarır).'
      ],
      phiHint: '3–14 Gün'
    };
  }

  if (n.includes('kurşuni') || n.includes('botrytis') || n.includes('boyun çürüklüğü') || n.includes('monilya') || n.includes('sklerotinia')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Aardbei_Lambada_vruchtrot_Botrytis_cinerea.jpg',
      scientificName: 'Botrytis cinerea / Monilinia laxa',
      modeOfAction: 'FRAC Grup 7+11 (Boscalid+Pyraclostrobin), Grup 12+9 (Fludioxonil+Cyprodinil), Grup 17 (Fenhexamid)',
      culturalControls: [
        'Serada sabah erken havalandırma ile nemin %75 altına düşürülmesi.',
        'Hastalıklı çiçek/meyvelerin kesilerek bahçe dışına çıkarılması ve kalsiyum takviyesi.'
      ],
      phiHint: '1–7 Gün'
    };
  }

  if (n.includes('pas') || n.includes('puccinia')) {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Stripe_rust_on_wheat.jpg',
      scientificName: 'Puccinia striiformis / P. triticina',
      modeOfAction: 'FRAC Grup 3 (Prothioconazole, Tebuconazole, Epoxiconazole), Grup 11 + Grup 7',
      culturalControls: [
        'Pas hastalıklarına toleranslı sertifikalı buğday çeşitlerinin tercih edilmesi.',
        'Bayrak yaprağın çıkış döneminde koruyucu veya ilk püstüller görüldüğünde ivedi fungisit uygulaması.'
      ],
      phiHint: '28–35 Gün'
    };
  }

  if (n.includes('canavar otu') || n.includes('orobanche')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/82/Orobanche_uniflora_3303f.JPG/960px-Orobanche_uniflora_3303f.JPG',
      scientificName: 'Orobanche cumana / Phelipanche ramosa',
      modeOfAction: 'HRAC Grup 2 (Imazamox — Clearfield IMI toleranslı çeşitlerde)',
      culturalControls: [
        'Canavar otuna dayanıklı/toleranslı IMI veya yeni nesil ayçiçeği hibritlerinin ekilmesi.',
        'Sürgünlerin çiçek açıp tohum dökmeden tarladan sökülmesi ve mısır/buğday münavebesi.'
      ],
      phiHint: 'Çıkış Sonrası 4–6 Yaprak'
    };
  }

  if (n.includes('kanyaş') || n.includes('dar') || n.includes('sorghum') || n.includes('ayrık')) {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Sorghum_halepense_closeup.jpg/960px-Sorghum_halepense_closeup.jpg',
      scientificName: 'Sorghum halepense / Echinochloa crus-galli',
      modeOfAction: 'HRAC Grup 1 (Quizalofop-p-ethyl, Haloxyfop-R-methyl, Clethodim, Fluazifop-p-butyl)',
      culturalControls: [
        'Rizomlu kanyaş yoğun tarlalarda yaz sonu derin sürüm ile rizomların güneşe/donmaya çıkarılması.',
        'Geniş yapraklı kültür bitkilerinde kanyaş 20–30 cm boydayken yayıcı ile herbisit uygulanması.'
      ],
      phiHint: '45–90 Gün'
    };
  }

  if (n.includes('geniş yaprak') || n.includes('sirken') || n.includes('sarmaşık') || n.includes('tilkikuyruğu') || problemType === 'YABANCI_OT') {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Convolvulus_arvensis_in_Aveyron_%282%29.jpg/960px-Convolvulus_arvensis_in_Aveyron_%282%29.jpg',
      scientificName: 'Convolvulus arvensis / Amaranthus / Chenopodium',
      modeOfAction: 'HRAC Grup 15 (Pendimethalin), Grup 2 (Tribenuron-methyl), Grup 4 (2,4-D / Dicamba)',
      culturalControls: [
        'Yabancı otlar tohum bağlamadan mekanik çapa ve uygun münavebe uygulanması.',
        'Çıkış öncesi toprak herbisitlerinin nemli veya hafif yağmurlu tavda atılması.'
      ],
      phiHint: '30–90 Gün'
    };
  }

  if (problemType === 'BESLEME') {
    return {
      imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/Backlit_ficus_elastica_leaf_texture_2014_01.jpg/960px-Backlit_ficus_elastica_leaf_texture_2014_01.jpg',
      scientificName: 'Bitki Fizyolojisi ve Besin Dengesi',
      modeOfAction: 'Toprak pH Optimizasyonu + Şelatlı Yaprak / Damlama Beslemesi',
      culturalControls: [
        'Her sezon öncesi toprak ve sulama suyu analizi yaptırılarak gübreleme programının kalibre edilmesi.',
        'Yapraktan besleme uygulamalarının sabah erken veya akşam serinliğinde stoma açıkken yapılması.'
      ],
      phiHint: 'Kalıntı Riski Yok (Gübre)'
    };
  }

  if (problemType === 'ZARARLI') {
    return {
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Helicoverpa_armigera.jpg',
      scientificName: 'Tarımsal Zararlı Etmeni',
      modeOfAction: 'IRAC Etki Mekanizması Rotasyonlu Mücadele',
      culturalControls: [
        'Ekonomik Zarar Eşiği (EZE) aşılmadan kimyasal ilaçlama yapılmaması ve faydalı böceklerin korunması.',
        'Bulaşık bitki artıklarının temizlenmesi ve yabancı ot konukçularının yok edilmesi.'
      ],
      phiHint: 'Etiket Talimatına Bakınız'
    };
  }

  // Default HASTALIK fallback real photo
  return {
    imageUrl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Alternaria_solani_-_leaf_lesions.jpg/960px-Alternaria_solani_-_leaf_lesions.jpg',
    scientificName: 'Fitopatolojik Etmen',
    modeOfAction: 'FRAC Grup Rotasyonlu Koruyucu ve Sistemik Fungisit Mücadelesi',
    culturalControls: [
      'Sertifikalı ve temiz tohum/fide kullanımı, dengeli NPK besleme ve sıralar arası havalandırma.',
      'Üst üste aynı familya bitkilerinin dikilmemesi (en az 3 yıllık ekim nöbeti).'
    ],
    phiHint: 'Etiket Talimatına Bakınız'
  };
}

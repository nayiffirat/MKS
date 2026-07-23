export const CROP_CATEGORIES = [
    {
        id: 'TARLA',
        name: 'Tarla Bitkileri',
        crops: [
            { id: 'PAMUK', name: 'Pamuk', icon: 'Sprout' },
            { id: 'MISIR', name: 'Mısır', icon: 'Sprout' },
            { id: 'BUGDAY', name: 'Buğday', icon: 'Wheat' },
            { id: 'ARPA', name: 'Arpa', icon: 'Wheat' },
            { id: 'AYCICEGI', name: 'Ayçiçeği', icon: 'Flower2' },
            { id: 'SEKER_PANCARI', name: 'Şeker Pancarı', icon: 'Leaf' },
            { id: 'PATATES', name: 'Patates', icon: 'Leaf' },
            { id: 'SOGAN', name: 'Soğan', icon: 'Leaf' },
            { id: 'YER_FISTIGI', name: 'Yer Fıstığı', icon: 'Sprout' },
            { id: 'MERCIMEK', name: 'Mercimek', icon: 'Sprout' },
            { id: 'SOYA', name: 'Soya Fasulyesi', icon: 'Sprout' },
            { id: 'KIMYON', name: 'Kimyon', icon: 'Leaf' }
        ]
    },
    {
        id: 'SEBZE',
        name: 'Sebze & Sera Bitkileri',
        crops: [
            { id: 'DOMATES', name: 'Domates', icon: 'Leaf' },
            { id: 'BIBER', name: 'Biber', icon: 'Leaf' },
            { id: 'HIYAR', name: 'Hıyar', icon: 'Leaf' },
            { id: 'PATLICAN', name: 'Patlıcan', icon: 'Leaf' },
            { id: 'KARPUZ', name: 'Karpuz', icon: 'Leaf' },
            { id: 'KAVUN', name: 'Kavun', icon: 'Leaf' },
            { id: 'CILEK', name: 'Çilek', icon: 'Leaf' },
            { id: 'BAMYA', name: 'Bamya', icon: 'Leaf' }
        ]
    },
    {
        id: 'MEYVE',
        name: 'Meyve Ağaçları & Bağ',
        crops: [
            { id: 'BAG', name: 'Bağ (Üzüm)', icon: 'Grape' },
            { id: 'ELMA', name: 'Elma', icon: 'Apple' },
            { id: 'ARMUT', name: 'Armut', icon: 'Apple' },
            { id: 'SEFTALI', name: 'Şeftali / Kayısı', icon: 'Apple' },
            { id: 'KIRAZ', name: 'Kiraz', icon: 'Cherry' },
            { id: 'ZEYTIN', name: 'Zeytin', icon: 'Leaf' },
            { id: 'NARENCIYE', name: 'Narenciye', icon: 'Citrus' },
            { id: 'FISTIK', name: 'Antep Fıstığı', icon: 'Leaf' },
            { id: 'FINDIK', name: 'Fındık', icon: 'Leaf' },
            { id: 'CEVIZ', name: 'Ceviz', icon: 'Leaf' },
            { id: 'NAR', name: 'Nar', icon: 'Apple' },
            { id: 'BADEM', name: 'Badem', icon: 'Leaf' }
        ]
    }
];

export const CROP_STAGES: Record<string, { id: string; name: string; description: string }[]> = {

    SOGAN: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Tohumun veya arpacığın sürmesi.' },
        { id: 'VEGETATIF', name: 'Yaprak Gelişimi', description: 'Toprak üstü yaprak gelişimi.' },
        { id: 'BAS_BAGLAMA', name: 'Baş Bağlama', description: 'Soğan başlarının oluşmaya başlaması.' },
        { id: 'BAS_BUYUMESI', name: 'Baş Büyümesi', description: 'Başların irileştiği evre.' },
        { id: 'HASAT', name: 'Hasat', description: 'Yaprakların yatması ve kuruma.' }
    ],
    PAMUK: [
        { id: 'CIKIS', name: 'Çıkış ve Fide Dönemi', description: 'Tohumun çimlenip ilk gerçek yaprakların çıktığı evre.' },
        { id: 'TARAKLANMA', name: 'Taraklanma Dönemi', description: 'İlk çiçek tomurcuklarının (tarak) görülmeye başlandığı evre.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme Dönemi', description: 'Çiçeklerin açtığı ve döllenmenin gerçekleştiği evre.' },
        { id: 'KOZA', name: 'Koza Gelişimi', description: 'Kozaların büyüdüğü ve olgunlaştığı dönem.' },
        { id: 'HASAT', name: 'Hasat Öncesi', description: 'Kozaların açtığı ve hasat hazırlıklarının yapıldığı dönem.' }
    ],
    MISIR: [
        { id: 'CIKIS', name: 'Çıkış ve Fide (V1-V5)', description: 'Çıkıştan 5. yaprağa kadar olan dönem.' },
        { id: 'GELISIM', name: 'Hızlı Büyüme (V6-V18)', description: 'Bitki boyunun hızla arttığı ve tepe püskülü öncesi dönem.' },
        { id: 'TEPE_PUSKULU', name: 'Tepe Püskülü ve Döllenme (VT-R1)', description: 'Polenlerin döküldüğü ve koçan püsküllerinin çıktığı evre.' },
        { id: 'TANE_DOLUM', name: 'Tane Dolum ve Olgunlaşma (R2-R6)', description: 'Süt olumu, hamur olumu ve fizyolojik olgunluk.' }
    ],
    DOMATES: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Şaşırtma ve ilk yaprak gelişimi.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Gövde ve yaprakların hızla geliştiği dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Salkımların açtığı evre.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu ve Büyüme', description: 'Meyvelerin oluştuğu ve irileştiği dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Meyvelerin kızardığı dönem.' }
    ],
    BUGDAY: [
        { id: 'KARDESLENME', name: 'Kardeşlenme Dönemi', description: 'Kışa giriş ve ilkbahar başı kardeşlenme evresi.' },
        { id: 'SAPA_KALKMA', name: 'Sapa Kalkma', description: 'Bitki boyunun hızla uzadığı dönem.' },
        { id: 'BASAKLANMA', name: 'Başaklanma ve Çiçeklenme', description: 'Başakların kından çıktığı ve döllendiği dönem.' },
        { id: 'SUT_OLUMU', name: 'Süt ve Sarı Olum', description: 'Tanelerin dolduğu dönem.' }
    ],
    ARPA: [
        { id: 'KARDESLENME', name: 'Kardeşlenme Dönemi', description: 'İlkbahar başı kardeşlenme evresi.' },
        { id: 'SAPA_KALKMA', name: 'Sapa Kalkma', description: 'Bitki boyunun uzadığı dönem.' },
        { id: 'BASAKLANMA', name: 'Başaklanma ve Çiçeklenme', description: 'Başakların kından çıktığı dönem.' },
        { id: 'SUT_OLUMU', name: 'Süt ve Sarı Olum', description: 'Tanelerin dolduğu ve sarardığı dönem.' }
    ],
    AYCICEGI: [
        { id: 'CIKIS', name: 'Çıkış ve Fide', description: 'Tohum çimlenmesi ve ilk yapraklar.' },
        { id: 'GELISIM', name: 'Vejetatif Gelişim', description: 'Rozet yaprak oluşumu ve boya kalkma.' },
        { id: 'TABLA', name: 'Tabla (Yıldız) Oluşumu', description: 'Çiçek tablasının belirdiği dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Tabladaki çiçeklerin açtığı ve tozlandığı evre.' },
        { id: 'TANE_DOLUM', name: 'Tane Dolumu ve Olgunlaşma', description: 'Çekirdeklerin iç doldurduğu ve kuruduğu dönem.' }
    ],
    SEKER_PANCARI: [
        { id: 'CIKIS', name: 'Çıkış ve Kotiledon', description: 'Fidelerin toprak yüzeyine çıktığı dönem.' },
        { id: 'YAPRAKLANMA', name: 'Yaprak Gelişimi (2-8 Yaprak)', description: 'Gerçek yaprakların oluştuğu hassas dönem.' },
        { id: 'KOK_GELISIMI', name: 'Kök Kalınlaşması', description: 'Kökün hızla kalınlaştığı ve şeker biriktirmeye başladığı dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Şeker oranının maksimize olduğu sonbahar dönemi.' }
    ],
    PATATES: [
        { id: 'CIKIS', name: 'Çıkış ve Sürgün', description: 'Yumrudan sürgünlerin çıktığı dönem.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Toprak üstü aksamının geliştiği dönem.' },
        { id: 'YUMRU_OLUSUMU', name: 'Stolon ve Yumru Oluşumu', description: 'Toprak altında yumruların belirmeye başladığı dönem.' },
        { id: 'YUMRU_BUYUMESI', name: 'Yumru Büyümesi', description: 'Yumruların hızla irileştiği evre.' },
        { id: 'HASAT', name: 'Olgunlaşma', description: 'Bitkinin sarardığı ve kabuk sertleşmesinin olduğu dönem.' }
    ],
    BAG: [
        { id: 'UYANMA', name: 'Gözlerin Uyanması (Ağlama)', description: 'İlkbaharda asma suyunun yürüdüğü ve tomurcukların kabardığı dönem.' },
        { id: 'SURGUN', name: 'Sürgün ve Somak Gelişimi', description: 'Yeni sürgünlerin ve çiçek salkımlarının oluştuğu evre.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklerin açıp tozlandığı hassas dönem.' },
        { id: 'MEYVE_TUTUMU', name: 'Koruk (Saçma İriliği)', description: 'Tanelerin tuttuğu ve büyümeye başladığı evre.' },
        { id: 'BEN_DUSME', name: 'Ben Düşme (Veraison)', description: 'Tanelerin renk değiştirdiği ve tatlandığı evre.' },
        { id: 'HASAT', name: 'Olgunluk ve Hasat', description: 'Şeker oranının hasat seviyesine geldiği dönem.' }
    ],
    ZEYTIN: [
        { id: 'SÜRGÜN', name: 'Sürgün ve Tomurcuklanma', description: 'Bahar başlangıcında yeni sürgünlerin ve somakların belirmesi.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklerin açtığı ve tozlanmanın olduğu dönem.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Karabiber iriliğinden zeytin iriliğine geçiş.' },
        { id: 'CEKIRDEK', name: 'Çekirdek Sertleşmesi', description: 'Meyvenin irileşip çekirdeğin sertleştiği yaz ayları.' },
        { id: 'HASAT', name: 'Renk Dönümü ve Hasat', description: 'Meyvelerin yeşilden mora döndüğü sonbahar/kış dönemi.' }
    ],
    ELMA: [
        { id: 'TOMURCUK', name: 'Göz Kabarması ve Fare Kulağı', description: 'Kış uykusundan uyanma ve ilk yeşil uçların görünmesi.' },
        { id: 'PEMBE_TOMURCUK', name: 'Pembe Tomurcuk', description: 'Çiçeklerin açmadan önceki pembe göründüğü dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme (Tam Çiçek)', description: 'Çiçeklerin açtığı döllenme dönemi.' },
        { id: 'TAÇ_YAPRAK_DOKUMU', name: 'Taç Yaprak Dökümü', description: 'Meyve tutumunun başladığı kritik dönem.' },
        { id: 'MEYVE_GELISIMI', name: 'Meyve Gelişimi (Ceviz İriliği)', description: 'Meyvelerin irileştiği dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Renklenme ve tatlanma dönemi.' }
    ],
    YER_FISTIGI: [
        { id: 'CIKIS', name: 'Çıkış ve Fide', description: 'Tohumun çimlenip toprak yüzeyine çıktığı dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklerin açıp döllenmenin gerçekleştiği evre.' },
        { id: 'IGNE_OLUSUMU', name: 'İğne Oluşumu (Ginofor)', description: 'Döllenen çiçeklerin uzayarak toprağa girdiği dönem.' },
        { id: 'KAPSUL', name: 'Kapsül (Meyve) Gelişimi', description: 'Toprak altında fıstık kapsüllerinin dolduğu dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Yaprakların sarardığı, kapsüllerin olgunlaştığı evre.' }
    ],
    MERCIMEK: [
        { id: 'CIKIS', name: 'Çıkış ve Fide', description: 'Tohumun çimlenip toprak yüzeyine çıktığı ilk dönem.' },
        { id: 'DALLANMA', name: 'Dallanma', description: 'Yan dalların oluşup bitkinin hacim kazandığı dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklerin açtığı ve tozlandığı kritik dönem.' },
        { id: 'BAKLA_OLUSUMU', name: 'Bakla Oluşumu', description: 'Mercimek baklalarının oluştuğu evre.' },
        { id: 'HASAT', name: 'Sarı Olum ve Hasat', description: 'Bitkinin sararıp kuruduğu hasat zamanı.' }
    ],
    SOYA: [
        { id: 'CIKIS', name: 'Çıkış (VE)', description: 'Kotiledonların toprak yüzeyine çıktığı dönem.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim (Vn)', description: 'Yaprak ve dalların hızla geliştiği evre.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme (R1-R2)', description: 'Çiçeklerin açtığı ve tam çiçeklenme dönemi.' },
        { id: 'BAKLA', name: 'Bakla Oluşumu (R3-R4)', description: 'Baklaların büyüdüğü kritik su ihtiyacı dönemi.' },
        { id: 'TANE_DOLUM', name: 'Tane Dolumu (R5-R6)', description: 'Tohumların bakla içinde dolduğu ve irileştiği dönem.' },
        { id: 'HASAT', name: 'Fizyolojik Olum ve Hasat', description: 'Yaprakların döküldüğü ve baklaların kuruduğu dönem.' }
    ],
    KIMYON: [
        { id: 'CIKIS', name: 'Çıkış ve Fide', description: 'Tohumların yavaş çimlendiği ve rozet yaprakların oluştuğu evre.' },
        { id: 'SAPA_KALKMA', name: 'Sapa Kalkma ve Dallanma', description: 'Ana sapın uzadığı ve yan dalların belirdiği dönem.' },
        { id: 'CICEKLENME', name: 'Şemsiye (Çiçek) Oluşumu', description: 'Şemsiye şeklindeki çiçeklerin açtığı evre.' },
        { id: 'TOHUM_BAGLAMA', name: 'Tohum Bağlama', description: 'Döllenme sonrası kimyon tohumlarının oluştuğu dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Tohumların esmerleştiği hasat dönemi.' }
    ],
    BAMYA: [
        { id: 'CIKIS', name: 'Çıkış ve Fide', description: 'Kotiledon yaprakların ve ilk gerçek yaprakların oluşumu.' },
        { id: 'GELISIM', name: 'Vejetatif Gelişim', description: 'Bitkinin hızla boylandığı ve dallandığı dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Aşağıdan yukarıya doğru çiçeklerin açtığı evre.' },
        { id: 'MEYVE', name: 'Meyve Gelişimi (Kapsül)', description: 'Bamya meyvelerinin hızla geliştiği dönem.' },
        { id: 'HASAT', name: 'Sürekli Hasat', description: 'Kartlaşmadan taze olarak sürekli hasat dönemi.' }
    ],
    NAR: [
        { id: 'UYANMA', name: 'Uyanma ve Sürgün', description: 'Gözlerin uyanıp yeni sürgünlerin belirdiği bahar başı.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Kademeli olarak çiçeklerin açtığı ve döllendiği dönem.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Taç yaprakların dökülüp küçük meyvelerin belirdiği evre.' },
        { id: 'MEYVE_BUYUMESI', name: 'Meyve Büyümesi', description: 'Meyvelerin irileştiği, su ve besin ihtiyacının arttığı yaz dönemi.' },
        { id: 'HASAT', name: 'Renk Dönümü ve Hasat', description: 'Meyvelerin kızardığı, tanelerin tatlandığı ve çatlama riskinin olduğu dönem.' }
    ],
    BADEM: [
        { id: 'TOMURCUK', name: 'Göz Kabarması ve Pembe Tomurcuk', description: 'Bahar başlangıcında çiçek tomurcuklarının uyanması.' },
        { id: 'CICEKLENME', name: 'Tam Çiçeklenme', description: 'Çiçeklerin tamamen açtığı, donlara karşı en hassas dönem.' },
        { id: 'MEYVE_TUTUMU', name: 'Çağla Oluşumu', description: 'Çiçek dökümünden sonra çağlaların belirdiği evre.' },
        { id: 'IC_DOLDURMA', name: 'İç Doldurma ve Çekirdek Sertleşmesi', description: 'Meyvenin irileştiği ve kabuğun sertleştiği yaz dönemi.' },
        { id: 'KABUK_CATLAMA', name: 'Kabuk Çatlaması (Kavlama)', description: 'Dış yeşil kabuğun kuruyup açıldığı dönem.' },
        { id: 'HASAT', name: 'Hasat', description: 'Bademlerin tamamen kuruyup hasat edildiği dönem.' }
    ],

    BIBER: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Şaşırtma ve ilk yaprak gelişimi.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Dallanma ve yapraklanma dönemi.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklerin açtığı ve döllendiği evre.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Meyvelerin bağladığı ve irileştiği dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Hasat dönemi.' }
    ],
    HIYAR: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Çimlenme ve ilk yapraklar.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Kol atma ve hızlı büyüme evresi.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklenme ve döllenme dönemi.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Hızlı meyve irileşmesi.' },
        { id: 'HASAT', name: 'Hasat', description: 'Günlük veya günaşırı hasat dönemi.' }
    ],
    PATLICAN: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Şaşırtma ve ilk yapraklar.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Dallanma ve yapraklanma.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklenme ve döllenme dönemi.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Meyve irileşmesi.' },
        { id: 'HASAT', name: 'Hasat', description: 'Hasat dönemi.' }
    ],
    KARPUZ: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Çimlenme ve ilk yapraklar.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim (Kol Atma)', description: 'Kolların uzadığı ve alan kapladığı dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Erkek ve dişi çiçeklerin açtığı dönem.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Meyvelerin bağladığı evre.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Meyve içinin olgunlaştığı dönem.' }
    ],
    KAVUN: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Çimlenme ve ilk yapraklar.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim (Kol Atma)', description: 'Kolların uzadığı dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklenme dönemi.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Meyvelerin irileşmesi.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Tatlanma (Brix artışı) ve hasat.' }
    ],
    CILEK: [
        { id: 'FIDE', name: 'Fide / Uyanma', description: 'Dikim sonrası veya uyanma dönemi.' },
        { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Yaprak ve taç gelişimi.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçek salkımlarının açtığı evre.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu ve Büyümesi', description: 'Meyvelerin irileşmesi.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Renklenme ve tatlanma dönemi.' }
    ],
    ARMUT: [
        { id: 'TOMURCUK', name: 'Göz Kabarması ve Beyaz Tomurcuk', description: 'Kış uykusundan uyanma.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklerin açtığı döllenme dönemi.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Taç yaprak dökümü ve meyve başlangıcı.' },
        { id: 'MEYVE_GELISIMI', name: 'Meyve Gelişimi', description: 'Meyvelerin irileştiği dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Hasat zamanı.' }
    ],
    SEFTALI: [
        { id: 'TOMURCUK', name: 'Tomurcuk Kabarması', description: 'Kışlık uyanma.' },
        { id: 'PEMBE_TOMURCUK', name: 'Pembe Tomurcuk', description: 'Çiçek açmadan önceki dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçeklenme ve döllenme.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Kürdan dönemi ve meyve tutumu.' },
        { id: 'MEYVE_GELISIMI', name: 'Meyve Büyümesi ve Renklenme', description: 'Meyvelerin büyüdüğü dönem.' },
        { id: 'HASAT', name: 'Olgunlaşma ve Hasat', description: 'Tatlanma ve hasat.' }
    ],
    KIRAZ: [
        { id: 'TOMURCUK', name: 'Tomurcuk Uyanması', description: 'Bahar başlangıcı.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Tam çiçeklenme evresi.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Meyvelerin nohut iriliğine geldiği dönem.' },
        { id: 'MEYVE_GELISIMI', name: 'Meyve İrileşmesi ve Ben Düşme', description: 'Meyvenin irileşip renk aldığı evre.' },
        { id: 'HASAT', name: 'Hasat', description: 'Tatlanma ve hasat.' }
    ],
    NARENCIYE: [
        { id: 'SURGUN', name: 'Bahar Sürgünü', description: 'Bahar uyanması.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Çiçek açımı ve döllenme.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu (Haziran Dökümü)', description: 'Doğal meyve dökümleri ve tutum.' },
        { id: 'MEYVE_GELISIMI', name: 'Meyve İrileşmesi', description: 'Yaz boyu meyvelerin büyümesi.' },
        { id: 'HASAT', name: 'Renk Dönümü ve Hasat', description: 'Tatlanma ve renklenme.' }
    ],
    FISTIK: [
        { id: 'TOMURCUK', name: 'Gözlerin Kabarması', description: 'Bahar uyanması.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Salkımların (Karagöz) çiçeklendiği dönem.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Meyvelerin tuttuğu dönem.' },
        { id: 'IC_DOLDURMA', name: 'İç Doldurma', description: 'Kabuk içinin dolduğu dönem.' },
        { id: 'HASAT', name: 'Kabuk Çatlaması ve Hasat', description: 'Hasat dönemi.' }
    ],
    FINDIK: [
        { id: 'PÜSKÜL', name: 'Püskül (Karanfil) Oluşumu', description: 'Erkek çiçeklerin püskül oluşturduğu dönem.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Tozlanma dönemi (Kış sonu / Erken Bahar).' },
        { id: 'MEYVE_TUTUMU', name: 'Çotanak Oluşumu', description: 'Meyve taslaklarının belirmesi.' },
        { id: 'IC_DOLDURMA', name: 'İç Doldurma', description: 'Fındık içinin gelişimi.' },
        { id: 'HASAT', name: 'Hasat', description: 'Kavuzların sarardığı ve hasat dönemi.' }
    ],
    CEVIZ: [
        { id: 'TOMURCUK', name: 'Tomurcuk Uyanması', description: 'Bahar uyanması.' },
        { id: 'CICEKLENME', name: 'Çiçeklenme', description: 'Erkek (püskül) ve dişi çiçeklerin döllenmesi.' },
        { id: 'MEYVE_TUTUMU', name: 'Meyve Tutumu', description: 'Meyvelerin ceviz iriliğine geldiği evre.' },
        { id: 'IC_DOLDURMA', name: 'İç Doldurma', description: 'Ceviz içinin gelişmesi.' },
        { id: 'HASAT', name: 'Hasat', description: 'Yeşil kabuğun çatlaması ve hasat.' }
    ]

};

// Generic fallback for unmapped crops
export const GENERIC_STAGES = [
    { id: 'FIDE', name: 'Fide / Erken Gelişim', description: 'Ekimden sonraki ilk büyüme evresi.' },
    { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Hızlı boy atma ve yapraklanma evresi.' },
    { id: 'GENERATIF', name: 'Generatif Gelişim (Çiçeklenme)', description: 'Çiçeklenme ve döllenme dönemi.' },
    { id: 'MEYVE', name: 'Meyve / Ürün Oluşumu', description: 'Ürünün büyüdüğü ve geliştiği dönem.' },
    { id: 'HASAT', name: 'Olgunlaşma', description: 'Hasada yaklaşım ve renk dönümü dönemi.' }
];

export const PROBLEM_DATABASE: Record<string, Record<string, any[]>> = {

    SOGAN: {
        FIDE: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü', description: 'Köklerin sararması ve çürümesi.', activeIngredients: ['Thiram', 'Metalaxyl'] },
            { type: 'ZARARLI', name: 'Soğan Sineği', description: 'Kurtçuklar fideyi yer.', activeIngredients: ['Chlorpyrifos (Toprak)'] }
        ],
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Mildiyö (Peronospora)', description: 'Yapraklarda kuruma.', activeIngredients: ['Mancozeb', 'Metalaxyl'] },
            { type: 'ZARARLI', name: 'Trips', description: 'Yapraklarda gümüşi lekeler.', activeIngredients: ['Spinetoram', 'Acetamiprid'] }
        ],
        BAS_BAGLAMA: [
            { type: 'HASTALIK', name: 'Siyah Küf', description: 'Baş çürümesi başlangıcı.', activeIngredients: ['Tebuconazole'] }
        ],
        BAS_BUYUMESI: [
            { type: 'ZARARLI', name: 'Trips', description: 'Zarar devam eder.', activeIngredients: ['Spinosad'] },
            { type: 'BESLEME', name: 'Potasyum ve Kükürt', description: 'Baş irileşmesi ve aroma (kükürt) için.', activeIngredients: ['Potasyum Sülfat'] }
        ],
        HASAT: [
            { type: 'HASTALIK', name: 'Boyun Çürüklüğü (Botrytis)', description: 'Depoda çürüme yapar.', activeIngredients: ['Boscalid', 'Kültürel Önlem'] }
        ]
    },

    PAMUK: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Fide Kök Çürüklüğü (Çökerten)', description: 'Tohumun çimlenmesi ve fidenin toprak yüzeyine çıkışı sırasında, Rhizoctonia solani, Fusarium spp., ve Pythium spp. gibi toprak kökenli patojenlerin neden olduğu kompleks bir hastalıktır. Fide kök boğazında esmerleşme, incelme ve devrilme görülür. Erken ekim, soğuk ve aşırı nemli topraklar riski artırır.', commercialNames: ['Previcur Energy (Bayer)', 'Celest Max (Syngenta)', 'Rizolex-T (Sumi Agro)', 'Pomarsol Forte (Bayer)', 'Maxim XL (Syngenta)'], activeIngredients: ['Propamocarb + Fosetyl-Al', 'Fludioxonil', 'Tolclofos-methyl + Thiram', 'Thiram', 'Metalaxyl-M + Fludioxonil'] },
            { type: 'ZARARLI', name: 'Telkurdu (Agriotes spp.) ve Bozkurt (Agrotis spp.)', description: 'Telkurtları tohumları ve genç fidelerin köklerini kemirir. Bozkurtlar ise geceleri toprak yüzeyine çıkarak fideleri toprak seviyesinden keserek öldürür. Tarlada keltepelere (boşluklara) neden olurlar.', commercialNames: ['Gaucho 600 FS (Bayer)', 'Force 20 CS (Syngenta)', 'Dursban 4 (Corteva)', 'Regent 200 SC (BASF)'], activeIngredients: ['Imidacloprid (Tohum)', 'Tefluthrin', 'Chlorpyrifos-ethyl', 'Fipronil'] },
            { type: 'ZARARLI', name: 'Trips (Thrips tabaci)', description: 'Genç bitkilerin yaprak altlarında ve büyüme noktalarında özsuyu emerek beslenirler. Yapraklarda gümüşi lekeler, kıvrılmalar, şekil bozuklukları ve büyümede ciddi duraklamalar görülür.', commercialNames: ['Laser (Corteva)', 'Radiant 120 SC (Corteva)', 'Mospilan (Sumi Agro)', 'Confidor (Bayer)'], activeIngredients: ['Spinosad', 'Spinetoram', 'Acetamiprid', 'Imidacloprid'] },
            { type: 'YABANCI_OT', name: 'Dar ve Geniş Yapraklı Otlar', description: 'Pamuk bitkisi erken dönemde yavaş büyüdüğü için (Darıcan, Geliç, Domuz Pıtrağı gibi) ot rekabetine çok hassastır. Su, ışık ve besin maddelerine ortak olurlar.', commercialNames: ['Stomp Aqua (BASF)', 'Treflan (Corteva)', 'Roundup (Bayer - Ekim öncesi)', 'Fusilade Max (Syngenta)'], activeIngredients: ['Pendimethalin', 'Trifluralin', 'Glyphosate', 'Fluazifop-p-butyl'] },
            { type: 'BESLEME', name: 'Kök Geliştirici, Fosfor ve Çinko İhtiyacı', description: 'Fidenin şaşırtma veya çimlenme sonrasında güçlü kılcal kök yapısı oluşturması, soğuk stresini atlatması için yüksek oranda alınabilir Fosfor (P), Çinko (Zn) ve biyouyarıcılara ihtiyaç vardır.', commercialNames: ['Novalon 10-52-10 (Doktor Tarsa)', 'Peters Professional (ICL)', 'Megafol (Valagro / Syngenta)', 'Blackjak (Hektaş)', 'Zinc 15 (Doktor Tarsa)'], activeIngredients: ['10-52-10 MAP', 'Hümik / Fülvik Asit', 'Deniz Yosunu (Ascophyllum nodosum)', 'EDTA Çelatlı Çinko'] }
        ],
        TARAKLANMA: [
            { type: 'ZARARLI', name: 'Yeşilkurt (Helicoverpa armigera)', description: 'Pamuğun en tahripkar zararlılarındandır. Larvaları yeni oluşan tarakları delerek içini yer ve dökülmelerine (fıtıklaşma) neden olur. Verimi doğrudan düşürür.', commercialNames: ['Avaunt 150 EC (FMC)', 'Coragen 20 SC (FMC)', 'Radiant 120 SC (Corteva)', 'Karate Zeon (Syngenta)'], activeIngredients: ['Indoxacarb', 'Chlorantraniliprole', 'Spinetoram', 'Lambda-cyhalothrin'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği (Bemisia tabaci)', description: 'Yaprak altlarında bitki özsuyunu emer. Salgıladığı tatlımsı madde (ballık/fumajin) yaprakları kaplar, fotosentezi engeller. Pamuk lif kalitesini düşürür.', commercialNames: ['Oberon SC 240 (Bayer)', 'Admiral (Sumi Agro)', 'Mospilan (Sumi Agro)', 'Movento 100 SC (Bayer)'], activeIngredients: ['Spiromesifen', 'Pyriproxyfen', 'Acetamiprid', 'Spirotetramat'] },
            { type: 'ZARARLI', name: 'Lygus (Bitki Tahtakurus)', description: 'Taraklara sokup emerek beslenir. Emgi yerlerinde kararmalar olur ve taraklar dökülür. Pamuğun "boş kalmasına" neden olan sinsi bir zararlıdır.', commercialNames: ['Teppeki (ISK Biosciences)', 'Closer (Corteva)', 'Polo (Syngenta)'], activeIngredients: ['Flonicamid', 'Sulfoxaflor', 'Diafenthiuron'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek (Tetranychus spp.)', description: 'Özellikle sıcak ve kurak dönemlerde popülasyonu hızla artar. Yaprakların alt yüzeyinde beslenerek kızarma, paslanma ve erken yaprak dökümüne neden olur.', commercialNames: ['Agrimec 18 EC (Syngenta)', 'Envidor Speed (Bayer)', 'Floramite (UPL)', 'Nissorun (Nippon Soda)'], activeIngredients: ['Abamectin', 'Spirodiclofen', 'Bifenazate', 'Hexythiazox'] },
            { type: 'HASTALIK', name: 'Solgunluk (Verticillium dahliae)', description: 'İletim demetlerinin tıkanmasıyla alt yapraklardan başlayan solma ve damar aralarında sarı-kahverengi lekeler görülür. Kimyasal mücadelesi zordur, kültürel önlem gerektirir.', commercialNames: ['Dayanıklı çeşit (May, Progen)', 'Kültürel Önlem (Dengeli sulama)'], activeIngredients: ['Dayanıklı Tohum Çeşitleri', 'Münavebe (Ekim Nöbeti)', 'Aşırı Azottan Kaçınma'] },
            { type: 'BESLEME', name: 'Azot İhtiyacı', description: 'Taraklanma dönemi, pamugun boy attığı ve vejetatif gelişiminin zirveye ulaştığı dönemdir. Yeterli gövde ve dal oluşumu için yüksek Azot (N) takviyesi şarttır.', commercialNames: ['Toros Üre (Toros Tarım)', 'İgsaş CAN 26 (İgsaş)', 'UAN 32 Sıvı Azot (Toros)'], activeIngredients: ['Üre (%46 N)', 'Amonyum Nitrat', 'Sıvı Azot Çözeltileri'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Yeşilkurt (Helicoverpa armigera)', description: 'Zararı taraklardan çiçeklere ve genç kozalara geçer. Çiçeklerin içine girerek taç yaprakları ve dişi organı tahrip eder. Açmış çiçeği dökebilir.', commercialNames: ['Coragen 20 SC (FMC)', 'Voliam Targo (Syngenta)', 'Proclaim (Syngenta)', 'Dipel (Valent)'], activeIngredients: ['Chlorantraniliprole', 'Abamectin + Chlorantraniliprole', 'Emamectin benzoate', 'Bacillus thuringiensis'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği', description: 'Yaz sıcaklarıyla birlikte popülasyonu patlama yapar. Yaprak altları tamamen yumurta, larva ve erginlerle kaplanabilir.', commercialNames: ['Movento 100 SC (Bayer)', 'Oberon (Bayer)', 'Pegasus (Syngenta)', 'Applaud (Corteva)'], activeIngredients: ['Spirotetramat', 'Spiromesifen', 'Diafenthiuron', 'Buprofezin'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Fotosentez alanını ciddi şekilde daraltarak çiçek tutumunu azaltır ve kozaların küçük kalmasına sebep olur.', commercialNames: ['Omite (UPL)', 'Agrimec (Syngenta)', 'Acramite (UPL)'], activeIngredients: ['Propargite', 'Abamectin', 'Bifenazate'] },
            { type: 'BESLEME', name: 'Bor ve Çinko İhtiyacı', description: 'Çiçek dökülmesini engellemek, polen tüpü gelişimini hızlandırmak ve maksimum koza tutumu sağlamak için yapraktan Bor (B) ve Çinko (Zn) uygulamaları kritiktir.', commercialNames: ['YaraVita Bortrac (Yara)', 'YaraVita Zintrac (Yara)', 'Borzin (Doktor Tarsa)', 'Speedfol Bor (Doktor Tarsa)'], activeIngredients: ['Sıvı Etanolamin Bor', 'Çinko Sülfat', 'Çinko-Bor Kombinasyonları'] }
        ],
        KOZA: [
            { type: 'ZARARLI', name: 'Yeşilkurt ve Pembe Kurt (Pectinophora gossypiella)', description: 'Kozaların içine girerek çiğidi ve lifi tahrip ederler. Pembe kurt koza içinde beslenerek lifin renk değiştirmesine (pembeleşme) ve çürümesine neden olur.', commercialNames: ['Avaunt 150 EC (FMC)', 'Radiant 120 SC (Corteva)', 'Coragen (FMC)'], activeIngredients: ['Indoxacarb', 'Spinetoram', 'Chlorantraniliprole'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yapraklar kuruduğu için kozalar olgunlaşamaz (kavruk kalır), erken açılır veya dökülür.', commercialNames: ['Oberon (Bayer)', 'Zoom (Valent)'], activeIngredients: ['Spiromesifen', 'Etoxazole'] },
            { type: 'ZARARLI', name: 'Beyazsinek', description: 'En büyük zararı açılan kozalardaki pamuk liflerine ballı madde (fumajin) salgılayarak lifin çırçırlanmasını zorlaştırması ve kaliteyi (dereceyi) düşürmesidir.', commercialNames: ['Movento (Bayer)', 'Teppeki (ISK Biosciences)'], activeIngredients: ['Spirotetramat', 'Flonicamid'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı (Koza Dolumu)', description: 'Kozaların hızlı büyümesi, dolgunlaşması, liflerin uzaması ve mukavemet kazanması için pamugun en çok Potasyuma (K) ihtiyaç duyduğu evredir.', commercialNames: ['Multi-K (Haifa)', 'YaraTera Krista K (Yara)', 'KTS (Tessenderlo Kerley)'], activeIngredients: ['Potasyum Nitrat (13-0-46)', 'Potasyum Tiyosülfat (Sıvı K)', 'Potasyum Sülfat'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Yaprak Dökücü (Defoliant) İhtiyacı', description: 'Makineli hasadın sorunsuz yapılabilmesi, liflerin yaprak kırıntılarıyla kirlenmemesi ve yeşil kozaların hızla açılması için yaprakların döktürülmesi gerekir.', commercialNames: ['Dropp Ultra (Bayer)', 'Shark (FMC)', 'Bollseye (UPL)'], activeIngredients: ['Thidiazuron + Diuron', 'Carfentrazone-ethyl', 'Cacodylic acid'] }
        ]
    },
    MISIR: {
        CIKIS: [
            { type: 'ZARARLI', name: 'Bozkurt ve Telkurdu', description: 'Toprak altı zararlıları. Telkurdu (Agriotes) tohumu oyar, Bozkurt (Agrotis) ise toprak yüzeyine çıkan genç mısır fidelerini dipten keser. Tarlada ölü fideler görülür.', commercialNames: ['Cruiser 350 FS (Syngenta)', 'Force 20 CS (Syngenta)', 'Decis (Bayer)'], activeIngredients: ['Thiamethoxam (Tohum)', 'Tefluthrin', 'Deltamethrin (Yeşil aksam/Toprak)'] },
            { type: 'HASTALIK', name: 'Fide Kök Çürüklüğü (Pythium, Fusarium)', description: 'Özellikle erken ekim yapılan ve soğuk/yağışlı geçen ilkbaharlarda, tohumun çürümesine veya zayıf fidelerin ölmesine neden olur.', commercialNames: ['Maxim XL (Syngenta)', 'Celest (Syngenta)', 'Vitavax (UPL)'], activeIngredients: ['Fludioxonil + Metalaxyl-M', 'Fludioxonil', 'Carboxin + Thiram'] },
            { type: 'YABANCI_OT', name: 'Dar ve Geniş Yapraklı Otlar', description: 'Mısırın ilk 3-4 haftalık dönemi ot rekabetine en duyarlı olduğu dönemdir. Geliç, Darıcan, Pıtrak gibi otlar mısırı boğarak verimi %50 ye kadar düşürebilir.', commercialNames: ['Callisto (Syngenta)', 'Motivell (BASF)', 'Equip (Bayer)', 'Laudis (Bayer)', 'Lumax (Syngenta)'], activeIngredients: ['Mesotrione', 'Nicosulfuron', 'Foramsulfuron', 'Tembotrione', 'S-metolachlor + Mesotrione + Terbuthylazine'] },
            { type: 'BESLEME', name: 'Fosfor ve Çinko İhtiyacı', description: 'Güçlü ve derin kök gelişimi, sap kalınlığı ve erken dönem soğuk stresi direncini artırmak için mibzerle ekim esnasında Fosfor (P) ve Çinko (Zn) uygulaması şarttır.', commercialNames: ['Microstar PZ (Sipcam)', 'YaraMila Actyva (Yara)', 'Zinc 15 (Doktor Tarsa)'], activeIngredients: ['Mikrogranül MAP + Çinko', '20-20-0+Zn Taban Gübresi', 'Çinko Sülfat'] }
        ],
        GELISIM: [
            { type: 'ZARARLI', name: 'Mısır Koçankurdu (Sesamia) ve Mısır Kurdu (Ostrinia)', description: 'Larvalar önce yaprak helezonlarında beslenir, yapraklarda sıra halinde delikler (saçma deliği) açar. Daha sonra gövdeyi delip içine girerler.', commercialNames: ['Coragen 20 SC (FMC)', 'Radiant 120 SC (Corteva)', 'Avaunt (FMC)', 'Karate Zeon (Syngenta)'], activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Indoxacarb', 'Lambda-cyhalothrin'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Alt yapraklardan başlayarak yaprakları sarartır ve kurutur. Şiddetli zararda mısır bitkisi uzaktan ateşte yanmış gibi (kızıl/sarı) görünür.', commercialNames: ['Oberon (Bayer)', 'Agrimec (Syngenta)', 'Nissorun (Nippon)'], activeIngredients: ['Spiromesifen', 'Abamectin', 'Hexythiazox'] },
            { type: 'BESLEME', name: 'Azot ve Çinko İhtiyacı', description: 'Mısır bitkisinin boya kalktığı, günlük büyümenin en hızlı olduğu evredir. Bitkinin toplam azot ihtiyacının %60-70 i bu dönemde karşılanmalıdır.', commercialNames: ['İgsaş Üre (İgsaş)', 'YaraVita Zintrac (Yara)', 'Megafol (Valagro / Syngenta)', 'Toros Amonyum Sülfat'], activeIngredients: ['Üre (%46 N)', 'Yapraktan Sıvı Çinko', 'Deniz Yosunu ve Aminoasitler', 'Amonyum Sülfat'] }
        ],
        TEPE_PUSKULU: [
            { type: 'ZARARLI', name: 'Mısır Kurdu (Ostrinia nubilalis)', description: 'Tepe püskülüne (erkek organ) saldırarak püskülü kırar, polen dökümünü azaltır ve aşağı inerek koçana girmeye başlar.', commercialNames: ['Coragen (FMC)', 'Voliam Targo (Syngenta)', 'Ampligo (Syngenta)', 'Dipel (Valent)'], activeIngredients: ['Chlorantraniliprole', 'Abamectin + Chlorantraniliprole', 'Chlorantraniliprole + Lambda-cyhalothrin', 'Bacillus thuringiensis'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Bu dönemde kırmızı örümcek zararı yeşil aksamı kurutursa, bitki polen üretemez ve koçanlar boş (dişsiz) kalır.', commercialNames: ['Envidor (Bayer)', 'Floramite (UPL)'], activeIngredients: ['Spirodiclofen', 'Bifenazate'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Polenlerin çimlenme gücünü artırmak, döllenmeyi garantiye almak ve koçan ucuna kadar tam doluluk sağlamak için Bor (B) gereklidir.', commercialNames: ['YaraVita Bortrac (Yara)', 'Speedfol Bor (Doktor Tarsa)', 'Wuxal Boron (Aglukon)'], activeIngredients: ['Yapraktan Sıvı Etanolamin Bor', 'Borik Asit (Suda Çözünür)'] }
        ],
        TANE_DOLUM: [
            { type: 'ZARARLI', name: 'Mısır Kurdu ve Koçankurdu', description: 'Doğrudan koçan içine girerek taneleri yerler. Açtıkları deliklerden Fusarium gibi mantarlar girer ve aflatoksin oluşumuna neden olur.', commercialNames: ['Coragen 20 SC (FMC)', 'Radiant (Corteva)', 'Success (Corteva)'], activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Spinosad'] },
            { type: 'HASTALIK', name: 'Koçan Çürüklükleri (Fusarium, Aspergillus)', description: 'Tanelerin üzerinde pembe, beyaz veya siyah mantar dokuları (mikotoksin/aflatoksin) oluşur. Yem değerini ve pazar fiyatını düşürür.', commercialNames: ['Zararlı mücadelesi (Kurt kontrolü)', 'Hasatta nem kontrolü'], activeIngredients: ['Önleyici Kurt İlaçlaması (Coragen)', 'Kültürel Önlemler'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Süt ve hamur olum evrelerinde koçanların ağırlaşması, hektolitre ağırlığının artması (irilik) ve tanenin sertleşmesi için Potasyum (K) şarttır.', commercialNames: ['YaraTera Krista K (Yara)', 'SoluPotasse (Tessenderlo)', 'Multi-K (Haifa)'], activeIngredients: ['Potasyum Nitrat (13-0-46)', 'Potasyum Sülfat', 'Yapraktan Sıvı Potasyum'] }
        ]
    },
    BUGDAY: {
        KARDESLENME: [
            { type: 'HASTALIK', name: 'Kök ve Kökboğazı Çürüklüğü (Pseudocercosporella, Fusarium)', description: 'Köklerde ve sapın toprağa yakın boğumlarında kahverengileşme, çürüme. Kardeşlenmeyi zayıflatır, bitkilerin cılız kalmasına ve ileri dönemde yatmasına (beyaz başak) yol açar.', commercialNames: ['Lamardor (Bayer)', 'Input (Bayer)', 'Folicur (Bayer)', 'Celest (Syngenta)'], activeIngredients: ['Prothioconazole + Tebuconazole', 'Prothioconazole + Spiroxamine', 'Tebuconazole', 'Fludioxonil (Tohum)'] },
            { type: 'ZARARLI', name: 'Ekin Bambulu (Zabrus spp.)', description: 'Sonbahar ve ilkbahar başlarında genç buğday yapraklarını toprak içine çekerek veya kemirerek tarlada yer yer boşluklar yaratır.', commercialNames: ['Decis (Bayer)', 'Karate Zeon (Syngenta)', 'Marshall (FMC - Tohum)'], activeIngredients: ['Deltamethrin', 'Lambda-cyhalothrin', 'Carbosulfan'] },
            { type: 'YABANCI_OT', name: 'Geniş Yapraklı Otlar (Sinapis, Galium vb.)', description: 'Yabani hardal, yapışkan otu, gelincik, şahtere gibi geniş yapraklı otlar buğdayla su, ışık ve besin rekabetine girer.', commercialNames: ['Granstar (FMC)', 'Esteron (Corteva)', 'Mustang (Corteva)', 'Sekator (Bayer)'], activeIngredients: ['Tribenuron-methyl', '2,4-D Ester', 'Florasulam', 'Amidosulfuron + Iodosulfuron'] },
            { type: 'YABANCI_OT', name: 'Dar Yapraklı Otlar (Yabani Yulaf, Delice, Tilkikuyruğu)', description: 'Buğdayla aynı aileden oldukları için çok daha tehlikeli rekabetçilerdir. Hızla boylanıp buğdayı gölgeler ve verimi %70 e kadar düşürebilirler.', commercialNames: ['Topik (Syngenta)', 'Axial (Syngenta)', 'Atlantis (Bayer)', 'Puma Super (Bayer)'], activeIngredients: ['Clodinafop-propargyl', 'Pinoxaden', 'Mesosulfuron-methyl', 'Fenoxaprop-P-ethyl'] },
            { type: 'BESLEME', name: 'Azotlu Üst Gübreleme', description: 'Kardeş sayısını maksimize etmek, kök tacı gelişimini teşvik etmek ve bitkinin kıştan güçlü çıkmasını sağlamak için üst azot gübrelemesi.', commercialNames: ['Toros Üre (Toros Tarım)', 'İgsaş Amonyum Sülfat (AS)', 'Toros %21 AS'], activeIngredients: ['Üre (%46 N)', 'Amonyum Sülfat (%21 N, %24 S)'] }
        ],
        SAPA_KALKMA: [
            { type: 'HASTALIK', name: 'Sarı Pas (Puccinia striiformis) ve Kahverengi Pas', description: 'Özellikle serin ve yağışlı/nemli ilkbaharlarda yapraklarda makine dikişi şeklinde sarı-turuncu püstüller (tozlar) oluşur. Fotosentezi bitirir, buğdayı kurutur.', commercialNames: ['Opera Max (BASF)', 'Amistar (Syngenta)', 'Folicur (Bayer)', 'Nativo (Bayer)'], activeIngredients: ['Epoxiconazole + Pyraclostrobin', 'Azoxystrobin', 'Tebuconazole', 'Tebuconazole + Trifloxystrobin'] },
            { type: 'HASTALIK', name: 'Septoria Yaprak Lekesi (Septoria tritici)', description: 'Alt yapraklardan başlayarak yukarı doğru ilerleyen, üzerinde siyah noktacıklar (piknitler) bulunan kahverengi-sarı nekrotik lekelenmeler.', commercialNames: ['Input (Bayer)', 'Priaxor (BASF)', 'Aviator Xpro (Bayer)'], activeIngredients: ['Prothioconazole + Spiroxamine', 'Fluxapyroxad + Pyraclostrobin', 'Bixafen + Prothioconazole'] },
            { type: 'HASTALIK', name: 'Külleme (Blumeria graminis)', description: 'Sap, yaprak ve başakta pamukçuk şeklinde beyaz unsu örtü. Nemli ve sık ekilmiş tarlalarda şiddetlidir.', commercialNames: ['Corbel (BASF)', 'Folicur (Bayer)', 'Topas (Syngenta)'], activeIngredients: ['Fenpropimorph', 'Tebuconazole', 'Penconazole'] },
            { type: 'ZARARLI', name: 'Süne (Eurygaster spp.) - Ergin Göçü', description: 'Kışlaklardan (dağlardan) tarlaya göç eden ergin süneler, sapa kalkan buğday gövdesini emerek üst kısmın kurumasına ("akbaşak" veya "kurtboğazı") neden olur.', commercialNames: ['Karate Zeon (Syngenta)', 'Fury (FMC)', 'Decis (Bayer)'], activeIngredients: ['Lambda-cyhalothrin', 'Zeta-cypermethrin', 'Deltamethrin'] },
            { type: 'BESLEME', name: 'İkinci Azot Uygulaması (Boy Gübresi)', description: 'Sapa kalkma dönemi, bitkinin sap ve başak taslaklarını oluşturduğu dönemdir. Sağlam sap ve iri başaklar için Nitrat formunda azot verilir.', commercialNames: ['Toros CAN 26 (Amonyum Nitrat)', 'İgsaş CAN 26'], activeIngredients: ['Kalsiyum Amonyum Nitrat (%26 N)'] }
        ],
        BASAKLANMA: [
            { type: 'ZARARLI', name: 'Süne (Nimf/Yavru Dönemi)', description: 'Yumurtadan çıkan yavrular (nimfler) buğday başaklarındaki sütlü taneleri emerek beslenir. Emilen tanelerin glüten yapısı bozulur, ekmeklik kalitesi sıfıra iner (Süne tahribatı).', commercialNames: ['Karate Zeon (Syngenta)', 'Decis (Bayer)', 'Fastac (BASF)', 'Sivanto (Bayer)'], activeIngredients: ['Lambda-cyhalothrin', 'Deltamethrin', 'Alpha-cypermethrin', 'Flupyradifurone'] },
            { type: 'HASTALIK', name: 'Sarı Pas, Kahverengi Pas ve Fusarium Başak Yanıklığı', description: 'Buğdayın verimini belirleyen "Bayrak Yaprak" (en üst yaprak) ve Başak enfeksiyonları. Fusarium başaklarda pembemsi-beyaz ağarmalar (kısmi kuruma) yapar ve mikotoksin üretir.', commercialNames: ['Prosaro (Bayer)', 'Opera Max (BASF)', 'Nativo (Bayer)', 'Osiris (BASF)'], activeIngredients: ['Prothioconazole + Tebuconazole', 'Epoxiconazole + Pyraclostrobin', 'Tebuconazole + Trifloxystrobin', 'Epoxiconazole + Metconazole'] },
            { type: 'BESLEME', name: 'Çinko ve Bor İhtiyacı', description: 'Polen tüpü gelişimi, başakta tam döllenme (kör başak kalmaması) ve tane tutumu için bayrak yaprak döneminde yapraktan mikro element uygulaması faydalıdır.', commercialNames: ['YaraVita Zintrac (Yara)', 'Zinc 15 (Doktor Tarsa)', 'Speedfol Bor (Doktor Tarsa)'], activeIngredients: ['Sıvı Çinko', 'EDTA Çelatlı Çinko', 'Borik Asit'] }
        ],
        SUT_OLUMU: [
            { type: 'ZARARLI', name: 'Süne (İleri Evre Nimf ve Yeni Erginler) ve Kımıl (Aelia spp.)', description: 'Tane zararını (glüten yıkımını) maksimize ettikleri en tehlikeli kritik dönemdir. Devlet destekli veya bölgesel kontrollü süne ilaçlamaları bu evrede yapılır.', commercialNames: ['Karate Zeon (Syngenta)', 'Decis (Bayer)', 'Buldock (Bayer)'], activeIngredients: ['Lambda-cyhalothrin', 'Deltamethrin', 'Beta-cyfluthrin'] }
        ]
    },

    DOMATES: {
        FIDE: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Çökerten)', description: 'Tohum yataklarında veya şaşırtma sonrasında fidelerin kök boğazının esmerleşip incelerek devrilmesine neden olur. Pythium, Rhizoctonia, Phytophthora ve Fusarium gibi mantarların oluşturduğu kompleks bir hastalıktır.', commercialNames: ['Previcur Energy (Bayer)', 'Ridomil Gold (Syngenta)', 'Tachigaren (Sumi Agro)', 'Maxim XL (Syngenta)', 'Pomarsol (Bayer)'], activeIngredients: ['Propamocarb + Fosetyl-Al', 'Metalaxyl-M + Mancozeb', 'Hymexazol', 'Metalaxyl-M + Fludioxonil', 'Thiram'] },
            { type: 'ZARARLI', name: 'Toprakaltı Zararlıları (Danaburnu, Bozkurt, Telkurdu)', description: 'Danaburnu (Gryllotalpa) ön ayaklarıyla toprakta galeriler açarak kökleri keser. Bozkurt ve Telkurdu da fideleri dipten kopararak ölümüne neden olur.', commercialNames: ['Dursban 4 (Corteva - Toprak)', 'Force 20 CS (Syngenta)', 'Kepekli Zehirli Yemler'], activeIngredients: ['Chlorpyrifos', 'Tefluthrin', 'Chlorpyrifos + Kepek'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği (Bemisia tabaci) ve Yaprakbiti', description: 'Özsuyu emerek fidenin zayıflamasına neden olurlar. En büyük zararları TYLCV (Domates Sarı Yaprak Kıvırcıklığı Virüsü) ve TSWV (Domates Lekeli Solgunluk Virüsü) taşıyıcısı (vektörü) olmalarıdır.', commercialNames: ['Confidor (Bayer)', 'Mospilan (Sumi Agro)', 'Actara (Syngenta)', 'Polo (Syngenta)'], activeIngredients: ['Imidacloprid', 'Acetamiprid', 'Thiamethoxam', 'Diafenthiuron'] },
            { type: 'BESLEME', name: 'Kök Geliştirici, Fosfor ve Aminoasit İhtiyacı', description: 'Şaşırtılan fidenin toprakla bütünleşmesi (tutunması), stresin azaltılması ve yeni kılcal kök patlaması için yüksek Fosfor (P) ve deniz yosunu/aminoasit kombinasyonları uygulanır.', commercialNames: ['Novalon 10-52-10 (Doktor Tarsa)', 'Isabion (Syngenta)', 'Megafol (Valagro)', 'Radifarm (Valagro)', 'Peters Professional (ICL)'], activeIngredients: ['MAP Tabanlı Gübre', 'Serbest Aminoasitler', 'Deniz Yosunu Özütü', 'Organik Karbon', 'Kök Uyarıcı Peptitler'] }
        ],
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Mildiyö (Phytophthora infestans)', description: 'Yapraklarda soluk yeşil/sarımtırak, su emmiş gibi görünen büyük lekeler başlar. Alt yüzeyinde beyaz-kül rengi mantar örtüsü (pamukçuk) oluşur. Rutubetli havalarda tarlayı/serayı birkaç günde yok edebilen bir salgındır.', commercialNames: ['Ridomil Gold MZ (Syngenta)', 'Curzate R (Corteva)', 'Acrobat Plus (BASF)', 'Revus (Syngenta)', 'Infinito (Bayer)'], activeIngredients: ['Metalaxyl-M + Mancozeb', 'Cymoxanil + Bakır', 'Dimethomorph + Mancozeb', 'Mandipropamid', 'Fluopicolide + Propamocarb'] },
            { type: 'HASTALIK', name: 'Bakteriyel Leke (Xanthomonas) ve Kanser (Clavibacter)', description: 'Yapraklarda çevresi sarı haleli küçük kahverengi/siyah nekrotik lekeler oluşur. Erken dönemde hastalık fark edilirse koruyucu bakır uygulamaları yapılır, aksi halde tedavisi yoktur.', commercialNames: ['Kocide 2000 (Certis)', 'Cuprocol (Syngenta)', 'Bordo Bulamacı (Hektaş)', 'Coprantol Duo (Syngenta)'], activeIngredients: ['Bakır hidroksit', 'Bakır oksiklorür', 'Bakır sülfat + Kalsiyum hidroksit', 'Bakır oksiklorür + Bakır hidroksit'] },
            { type: 'HASTALIK', name: 'Külleme (Leveillula taurica)', description: 'Yaprakların üst yüzeyinde sarımtırak lekeler, alt yüzeyinde ise beyaz unumsu bir mantar tabakası görülür. Şiddetli enfeksiyonda yapraklar kurur.', commercialNames: ['Topas (Syngenta)', 'Kumulus (BASF)', 'Ortiva (Syngenta)', 'Nativo (Bayer)'], activeIngredients: ['Penconazole', 'Kükürt (Suda eriyen)', 'Azoxystrobin', 'Tebuconazole + Trifloxystrobin'] },
            { type: 'ZARARLI', name: 'Tuta absoluta (Domates Güvesi)', description: 'Domatesin baş belasıdır. Yapraklarda beyaz renkli, tül benzeri şeffaf galeriler (oyuklar) açarak klorofil dokusunu tüketir.', commercialNames: ['Coragen 20 SC (FMC)', 'Radiant 120 SC (Corteva)', 'Alverde (BASF)', 'Voliam (Syngenta)', 'Takumi (Nihon Nohyaku)'], activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Metaflumizone', 'Chlorantraniliprole + Abamectin', 'Flubendiamide'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Alt yapraklardan başlayarak yaprak özsuyunu emer, klorofili parçalar. Yapraklar sararır, kıvrılır ve ince bir ağ ile kaplanır.', commercialNames: ['Agrimec (Syngenta)', 'Oberon (Bayer)', 'Floramite (UPL)', 'Kanemite (Agro-Kanesho)'], activeIngredients: ['Abamectin', 'Spiromesifen', 'Bifenazate', 'Acequinocyl'] },
            { type: 'BESLEME', name: 'Azot, Çinko ve Magnezyum İhtiyacı', description: 'Bitkinin hızla boylandığı, yeni yaprak ve dalların oluştuğu evredir. Dengeli N-P-K (20-20-20) ile birlikte magnezyum sülfat ve çinko takviyesi renk ve fotosentez kapasitesini artırır.', commercialNames: ['Novalon 20-20-20 (Doktor Tarsa)', 'Epsom Tuzu', 'YaraVita Zintrac (Yara)', 'Poly-Feed (Haifa)'], activeIngredients: ['20-20-20 NPK Damlama Gübresi', 'Magnezyum Sülfat', 'Sıvı Çinko', 'Mikro Element Katkılı NPK'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Çiçek Tripsi (Frankliniella occidentalis)', description: 'Sarı-kahverengi, çok küçük ve hareketli böceklerdir. Çiçeklerin içinde yaşarlar, polenlerle beslenip çiçeklerin kurumasına ve TSWV virüsünün bulaşmasına neden olurlar.', commercialNames: ['Laser (Corteva)', 'Radiant (Corteva)', 'Dicarzol (Gowan)', 'Match (Syngenta)'], activeIngredients: ['Spinosad', 'Spinetoram', 'Formetanate', 'Lufenuron'] },
            { type: 'ZARARLI', name: 'Tuta absoluta', description: 'Erken dönemdeki taze çiçek salkımlarını ve çiçek saplarını keserek meyve bağlamayı tamamen durdurabilir.', commercialNames: ['Coragen (FMC)', 'Voliam Targo (Syngenta)', 'Proclaim (Syngenta)'], activeIngredients: ['Chlorantraniliprole', 'Abamectin + Chlorantraniliprole', 'Emamectin benzoate'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis cinerea)', description: 'Özellikle nemin yüksek olduğu seralarda taç yapraklarda başlar, çiçeklerin gri-kahverengi bir küfle kaplanıp yanmış gibi kurumasına (çiçek yanıklığı) neden olur.', commercialNames: ['Signum (BASF)', 'Switch (Syngenta)', 'Teldor (Bayer)', 'Cantus (BASF)'], activeIngredients: ['Boscalid + Pyraclostrobin', 'Fludioxonil + Cyprodinil', 'Fenhexamid', 'Boscalid'] },
            { type: 'BESLEME', name: 'Bor, Çinko ve Kalsiyum İhtiyacı', description: 'Çiçek dökümünü engellemek, polen kalitesini ve döllenmeyi (meyve tutumunu) maksimuma çıkarmak için Bor (B) ve Çinko (Zn) şarttır.', commercialNames: ['YaraLiva Calcinit (Yara)', 'YaraVita Bortrac (Yara)', 'Borzin (Doktor Tarsa)', 'Speedfol Çinko-Bor (Doktor Tarsa)'], activeIngredients: ['Kalsiyum Nitrat', 'Sıvı Etanolamin Bor', 'Çinko-Bor Süspansiyonu', 'Kalsiyum-Bor Kompleksi'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'BESLEME', name: 'Kalsiyum İhtiyacı (Çiçek Burnu Çürüklüğü Önleme)', description: 'Meyvenin hızla büyüdüğü dönemde Kalsiyum (Ca) yetersizliğinden veya taşınamamasından dolayı meyvenin alt ucunda siyah, sert, kuru çökmeler (çiçek burnu çürüklüğü) oluşur.', commercialNames: ['YaraLiva Calcinit (Yara)', 'Stopit (Yara)', 'Caltrac (Yara)', 'Wuxal Calcium (Aglukon)', 'Borocal (Tradecorp)'], activeIngredients: ['Kalsiyum Nitrat (Damlama)', 'Sıvı Kalsiyum Klorür (Yaprak)', 'Kalsiyum Oksit Süspansiyonu', 'Kalsiyum-Bor Karışımı'] },
            { type: 'ZARARLI', name: 'Tuta absoluta (Meyve Zararı)', description: 'Larvalar doğrudan yeşil veya kırmızı meyveleri delerek içeri girer. Açılan deliklerden sekonder mantarlar girer ve meyve çürür, pazar değeri sıfırlanır.', commercialNames: ['Coragen (FMC)', 'Radiant (Corteva)', 'Proclaim (Syngenta)', 'Dipel (Valent)'], activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Emamectin benzoate', 'Bacillus thuringiensis (Biyolojik)'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu (Helicoverpa armigera)', description: 'Tutaya göre çok daha büyük olan larvalar, domates meyvelerinin içine yarısına kadar girerek beslenirler.', commercialNames: ['Avaunt (FMC)', 'Proclaim (Syngenta)', 'Karate Zeon (Syngenta)'], activeIngredients: ['Indoxacarb', 'Emamectin benzoate', 'Lambda-cyhalothrin'] },
            { type: 'HASTALIK', name: 'Mildiyö (Meyve Enfeksiyonu)', description: 'Yapraklardan meyvelere sıçrar. Meyvelerin üzerinde sert, pürüzlü, kahverengi-siyah lekeler oluşur. Meyveler kızaramaz, çürür.', commercialNames: ['Acrobat Plus (BASF)', 'Aliette (Bayer)', 'Equation Pro (Corteva)'], activeIngredients: ['Dimethomorph + Mancozeb', 'Fosetyl-Al', 'Famoxadone + Cymoxanil'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf (Meyve ve Gövde)', description: 'Seralarda yüksek nemde domatesin gövdesinde çöküntülü gri yaralar açar, meyve sapından girerek meyvenin dökülmesine veya çürümesine neden olur.', commercialNames: ['Signum (BASF)', 'Switch (Syngenta)', 'Luna Sensation (Bayer)'], activeIngredients: ['Boscalid + Pyraclostrobin', 'Fludioxonil + Cyprodinil', 'Fluopyram + Trifloxystrobin'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Meyvelerin hızlı irileşmesi, içinin dolması (boşluk yapmaması) ve renklenmenin başlaması için bitki NPK dengesinde Potasyuma ağırlık verir.', commercialNames: ['Multi-K (Haifa)', 'SoluPotasse (Tessenderlo)', 'Novalon 5-5-40 (Doktor Tarsa)', 'Pioner K (Pioner)'], activeIngredients: ['Potasyum Nitrat', 'Potasyum Sülfat', 'Yüksek K İçerikli NPK', 'Potasyum Karbonat'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Potasyum ve Fosfit İhtiyacı (Renk, Brix ve Raf Ömrü)', description: 'Meyvenin kıpkırmızı, parlak bir renk alması, içindeki şeker (Brix) oranının yükselmesi, asitliğin dengelenmesi ve raf ömrünün (sertliğin) artırılması.', commercialNames: ['KTS (Tessenderlo Kerley)', 'YaraTera Krista K (Yara)', 'Fosfonatlı Ürünler (Örn: Phosfik)'], activeIngredients: ['Sıvı Potasyum Tiyosülfat', 'Potasyum Nitrat', 'Potasyum Fosfit'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf ve Alternaria (Erken Yanıklık)', description: 'Hasat sırasında koparılan sap yerlerinden, çatlaklardan veya eziklerden mantarlar girerek depo veya nakliye sırasında çürümeye neden olur.', commercialNames: ['Serenade (Bayer)', 'Switch (Syngenta)', 'Amistar (Syngenta)'], activeIngredients: ['Bacillus subtilis (Biyolojik - Sıfır Kalıntı)', 'Fludioxonil + Cyprodinil (Kısa PHI)', 'Azoxystrobin'] }
        ]
    },
    ELMA: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Elma Karalekesi (Venturia inaequalis)', description: 'Hastalığın en kritik evresidir. Kışlayan mantar sporları, tomurcuklar uyanıp farekulağı dönemine geldiğinde ilk yağmurlarla beraber enfeksiyon yapar.', commercialNames: ['Bordo Bulamacı (Hektaş)', 'Kocide 2000 (Certis)', 'Syllit (Agriphar)', 'Delan (BASF)'], activeIngredients: ['Bakır sülfat + Kireç', 'Bakır hidroksit', 'Dodine', 'Dithianon'] },
            { type: 'HASTALIK', name: 'Külleme (Podosphaera leucotricha)', description: 'Geçen yıldan sürgün uçlarında kışlayan miseller uyanır ve yeni çıkan yaprakların beyaz bir unla kaplanmasına, kıvrılmasına neden olur.', commercialNames: ['Kumulus (BASF)', 'Cosavet (Sulphur Mills)'], activeIngredients: ['Suyla Karışabilir Kükürt (WG)'] },
            { type: 'ZARARLI', name: 'Elma Gözkurdu ve Yaprakbiti (Kışlık yumurtalar)', description: 'Dallarda kışlayan yaprakbiti ve kırmızı örümcek yumurtaları tomurcuk patlamasıyla uyanır. Gözkurtları uyanan gözlerin içini oyar.', commercialNames: ['Yazlık Yağlar (Çeşitli firmalar)', 'Dursban 4 (Eğer izinli kaldıysa)'], activeIngredients: ['Parafinik Yağlar', 'Chlorpyrifos-methyl'] },
            { type: 'BESLEME', name: 'Çinko ve Bor (Uyanma Öncesi)', description: 'Gözlerin eşzamanlı, güçlü ve eksiksiz uyanması, soğuk zararına karşı bitki özsuyunun direnç kazanması için tomurcuk kabarmadan önce uygulanır.', commercialNames: ['YaraVita Zintrac (Yara)', 'YaraVita Bortrac (Yara)', 'Zinc 15 (Doktor Tarsa)'], activeIngredients: ['Yüksek konsantre sıvı Çinko', 'Etanolamin Bor', 'EDTA Çinko'] }
        ],
        PEMBE_TOMURCUK: [
            { type: 'HASTALIK', name: 'Elma Karalekesi', description: 'Yağmurlu ve rüzgarlı ilkbahar günlerinde (Askospor uçuşunun zirvesi) yeni açmak üzere olan yaprakları korumak şarttır. Sistemik ilaçlara geçilir.', commercialNames: ['Score 250 EC (Syngenta)', 'Syllit (Agriphar)', 'Merpan 80 WG (Adama)', 'Systhane (Corteva)'], activeIngredients: ['Difenoconazole', 'Dodine', 'Captan', 'Myclobutanil'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yaprak ve sürgünlerde hastalık şiddetlenerek çiçeklere atlama riski doğurur.', commercialNames: ['Topas (Syngenta)', 'Nimrod (Adama)', 'Domark (Sipcam)'], activeIngredients: ['Penconazole', 'Bupirimate', 'Tetraconazole'] },
            { type: 'HASTALIK', name: 'Çiçek Monilyası (Monilinia laxa)', description: 'Hastalığın çiçeklerin içine girmesini önlemek için çiçekler açmadan hemen önce (pembe tomurcukta) koruyucu fungisit atılması zorunludur.', commercialNames: ['Folicur (Bayer)', 'Merpan 80 WG (Adama)', 'Rovral (FMC)'], activeIngredients: ['Tebuconazole', 'Captan', 'Iprodione'] },
            { type: 'ZARARLI', name: 'Yaprakbiti ve Gözkurdu', description: 'Açmakta olan tomurcukları ve genç yaprakları emer, şekil bozukluklarına neden olurlar.', commercialNames: ['Calypso (Bayer - eğer izinliyse)', 'Mospilan (Sumi Agro)', 'Teppeki (ISK)'], activeIngredients: ['Thiacloprid', 'Acetamiprid', 'Flonicamid'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Yağmurlu ve sisli havalarda çiçeklerin kahverengileşip yanmış/haşlanmış gibi kurumasına yol açar.', commercialNames: ['Merpan 80 WG (Adama)', 'Signum (BASF)', 'Chorus (Syngenta)'], activeIngredients: ['Captan', 'Boscalid + Pyraclostrobin', 'Cyprodinil'] },
            { type: 'HASTALIK', name: 'Ateş Yanıklığı (Erwinia amylovora)', description: 'Çiçeklerden giren bakteriler dal boyunca aşağı doğru iner, sürgün ucu baston/çengel şeklinde kıvrılır, siyahlaşarak kurur. Tedavisi çok zordur.', commercialNames: ['Aliette (Bayer)', 'Kocide 2000 (Düşük doz)', 'Serenade (Bayer)'], activeIngredients: ['Fosetyl-Al', 'Bakır hidroksit', 'Bacillus subtilis'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Dişi organın borusunu uzatmak, polen çimlenmesini maksimize etmek ve arıların tozlaştırma başarısını artırmak için gereklidir.', commercialNames: ['Isabion (Syngenta)', 'YaraVita Bortrac (Yara)', 'Maxicrop (Deniz Yosunu)'], activeIngredients: ['Aminoasitler', 'Borik Asit / Etanolamin Bor', 'Deniz Yosunu'] }
        ],
        MEYVE_GELISIMI: [
            { type: 'BESLEME', name: 'Kalsiyum Takviyesi (Acı Benek Önleme)', description: 'Elmada (özellikle Granny Smith ve Starking çeşitlerinde) hücre duvarı zayıflığından dolayı meyve kabuğunda acı, çökük, kahverengi lekeler (Acı Benek - Bitter Pit) oluşmasını önler.', commercialNames: ['Stopit (Yara)', 'Caltrac (Yara)', 'Wuxal Calcium (Aglukon)', 'Borocal (Tradecorp)'], activeIngredients: ['Sıvı Kalsiyum Klorür', 'Kalsiyum Oksit', 'Kalsiyum + Aminoasit', 'Kalsiyum + Bor'] },
            { type: 'ZARARLI', name: 'Elma İçkurdu (Cydia pomonella)', description: 'Elmanın en kritik zararlısıdır. Yumurtadan çıkan larvalar 24 saat içinde meyveyi delerek çekirdek evine (özüne) kadar ilerler ve meyvenin dökülmesine veya kurtlu satılmasına neden olur.', commercialNames: ['Coragen (FMC)', 'Radiant (Corteva)', 'Imidan (Gowan)', 'Runner (Corteva)', 'Madex (Andermatt - Biyolojik)'], activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Phosmet', 'Methoxyfenozide', 'Cydia pomonella Granulosis Virüsü (CpGV)'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaz sıcaklarıyla birlikte yapraklarda paslı, sarımsı bir renk oluşturur. Fotosentez düşer, meyve kalibresi küçük kalır.', commercialNames: ['Agrimec (Syngenta)', 'Floramite (UPL)', 'Envidor (Bayer)', 'Zoom (Valent)'], activeIngredients: ['Abamectin', 'Bifenazate', 'Spirodiclofen', 'Etoxazole'] },
            { type: 'ZARARLI', name: 'San Jose Kabuklubiti', description: 'Gövdede ve dallarda koloniler kurar, ağacı zayıflatır. Meyveye geçtiğinde üzerinde küçük kırmızı haleli lekeler (çil) oluşturarak ihracat değerini sıfırlar.', commercialNames: ['Admiral (Sumi Agro)', 'Movento (Bayer)', 'Reldan (Corteva)'], activeIngredients: ['Pyriproxyfen', 'Spirotetramat', 'Chlorpyrifos-methyl'] },
            { type: 'HASTALIK', name: 'Elma Karalekesi', description: 'Meyve büyürken bulaşırsa, meyve üzerinde kadifemsi kahverengi-siyah lekeler oluşturur. İleri dönemde meyvenin o kısımları sertleşir, şekilsizleşir ve çatlar.', commercialNames: ['Score 250 EC (Syngenta)', 'Merpan 80 WG (Adama)', 'Cabrio (BASF)', 'Flint (Bayer)'], activeIngredients: ['Difenoconazole', 'Captan', 'Pyraclostrobin', 'Trifloxystrobin'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Meyvenin hücrelerinin büyümesi (kalibre), tatlanması ve yavaş yavaş renk atmaya (kızarmaya/sarmaya) başlaması için yüksek Potasyum (K) verilir.', commercialNames: ['Multi-K (Haifa)', 'Novalon 5-5-40 (Doktor Tarsa)', 'YaraTera Krista K'], activeIngredients: ['Potasyum Nitrat (Damlama)', 'Yüksek Potasyumlu NPK Gübreler'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Potasyum İhtiyacı (Renk ve Kalite)', description: 'Hasada 3-4 hafta kala meyvelere tam rengini verdirmek, homojen bir parlaklık sağlamak ve şekerini (Brix) artırmak için sıvı potasyum uygulamaları yapılır.', commercialNames: ['SoluPotasse (Tessenderlo)', 'KTS (Tessenderlo Kerley)'], activeIngredients: ['Potasyum Sülfat', 'Sıvı Potasyum Tiyosülfat'] },
            { type: 'HASTALIK', name: 'Hasat Öncesi Çürüklükler (Penicillium, Alternaria, Botrytis)', description: 'Meyve kabuğundaki mikroskobik çatlaklardan veya hasat sırasındaki eziklerden girerek elmanın soğuk havada (depoda) aylar içinde çürümesine neden olan depo depo hastalıklarıdır.', commercialNames: ['Geoxe (Syngenta)', 'Merpan 80 WG (Adama)', 'Bellis (BASF)'], activeIngredients: ['Fludioxonil (Hasada yakın kullanım)', 'Captan', 'Boscalid + Pyraclostrobin'] },
            { type: 'ZARARLI', name: 'Elma İçkurdu (Son Döl)', description: 'Geç hasat edilen çeşitlerde (Pink Lady, Fuji vb.) son döl uçuşlarına karşı, kalıntı bırakmayan (kısa PHI süreli) ilaçlamalarla son vuruklar engellenir.', commercialNames: ['Radiant (Corteva)', 'Madex (Andermatt)'], activeIngredients: ['Spinetoram (7 gün PHI)', 'CpGV Virüsü (0 gün PHI)'] }
        ]
    },
    BAG: {
        UYANMA: [
            { type: 'HASTALIK', name: 'Ölükol (Phomopsis viticola)', description: 'Kışlık ilaçlama yapılmayan bağlarda, sürgünler uyanırken göz diplerinden giren mantar, sürgünlerde çatlaklara, siyah esmer lekelere ve bağın kurumasına ("ölükol") yol açar.', commercialNames: ['Bordo Bulamacı (Hektaş)', 'Cuprocol (Syngenta)'], activeIngredients: ['Bakır Sülfat + Kalsiyum hidroksit', 'Bakır oksiklorür'] },
            { type: 'ZARARLI', name: 'Bağ Uyuzu (Eriophyes vitis)', description: 'Çok küçük akarlardır, uyanan tomurcuklarda beslenirler. Gözlerin zayıf uyanmasına ve ileride yapraklarda kabarcıklar oluşmasına neden olurlar.', commercialNames: ['Kumulus (BASF)', 'Agrimec (Syngenta)'], activeIngredients: ['Suda Eriyebilir Kükürt (WG)', 'Abamectin'] },
            { type: 'BESLEME', name: 'Çinko-Bor İhtiyacı', description: 'Gözlerin eşzamanlı ve gür bir şekilde uyanması, salkım taslaklarının sağlıklı oluşabilmesi için sürgün dönemi öncesinde uygulanır.', commercialNames: ['YaraVita Zintrac (Yara)', 'Speedfol Çinko (Doktor Tarsa)', 'YaraVita Bortrac (Yara)'], activeIngredients: ['Yüksek oranda Sıvı Çinko', 'Etanolamin Bor'] }
        ],
        SURGUN: [
            { type: 'HASTALIK', name: 'Ölükol (Phomopsis)', description: 'Sürgünler 15-20 cm olduğunda hastalık sürgün diplerinde siyah, eliptik lekeler ve derin yarıklar açar.', commercialNames: ['Dithane M-45 (Corteva)', 'Merpan 80 WG (Adama)', 'Folpan (Adama)', 'Antracol (Bayer)'], activeIngredients: ['Mancozeb', 'Captan', 'Folpet', 'Propineb'] },
            { type: 'HASTALIK', name: 'Külleme (Erysiphe necator)', description: 'Yeni oluşan yeşil sürgünlerde, taze yapraklarda şarabımsı kırmızı lekeler ve beyaz unsu mantar tabakası.', commercialNames: ['Kumulus (BASF - Toz/Suda Kükürt)', 'Topas (Syngenta)', 'Systhane (Corteva)'], activeIngredients: ['Kükürt', 'Penconazole', 'Myclobutanil'] },
            { type: 'ZARARLI', name: 'Bağ Yaprakuyuzu ve Kırmızı Örümcek', description: 'Uyuz, yaprağın üstünde siğil/kabarcık, altında ise yoğun beyazımsı mantar benzeri tüylenme yapar. Kırmızı örümcek yaprakları kızartıp kurutur.', commercialNames: ['Agrimec (Syngenta)', 'Envidor (Bayer)'], activeIngredients: ['Abamectin', 'Spirodiclofen'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Mildiyö (Plasmopara viticola)', description: 'Nemli havalarda yapraklarda "Yağ Lekesi", yaprak altında ise pamukçuk oluşur. Çiçek salkımlarını vurursa salkımlar tamamen kıvrılıp siyahlaşır ve kurur ("Salkım Mildiyösü").', commercialNames: ['Ridomil Gold MZ (Syngenta)', 'Acrobat Plus (BASF)', 'Curzate (Corteva)', 'Mikal Flash (Bayer)'], activeIngredients: ['Metalaxyl-M + Mancozeb', 'Dimethomorph + Mancozeb', 'Cymoxanil + Mancozeb', 'Fosetyl-Al + Folpet'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Çiçek salkımlarında enfeksiyon yaparsa çiçek dökümlerine ve "silkmeye" neden olur.', commercialNames: ['Topas (Syngenta)', 'Folicur (Bayer)', 'Collis (BASF)'], activeIngredients: ['Penconazole', 'Tebuconazole', 'Boscalid + Kresoxim-methyl'] },
            { type: 'BESLEME', name: 'Bor, Çinko, Fosfor', description: 'Asmada sık görülen "boncuklanma" (bazı tanelerin çok iri, bazılarının küçük ve çekirdeksiz kalması) fizyolojik sorununu engellemek, polen verimini artırmak için atılır.', commercialNames: ['YaraVita Bortrac (Yara)', 'Isabion (Syngenta)', 'Speedfol Çinko-Bor (Doktor Tarsa)'], activeIngredients: ['Borik Asit / Etanolamin Bor', 'Aminoasit Kompleksleri', 'Çinko ve Bor Süspansiyonu'] },
            { type: 'ZARARLI', name: 'Trips (Thrips tabaci)', description: 'Çiçek kapsüllerinde beslenerek döllenmeyi bozar ve verim düşüklüğü (silkmeye) neden olur.', commercialNames: ['Laser (Corteva)', 'Mospilan (Sumi Agro)'], activeIngredients: ['Spinosad', 'Acetamiprid'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'HASTALIK', name: 'Mildiyö (Salkım ve Tane)', description: 'Koruk halindeki tanelerde (saçma-nohut büyüklüğü) içeri çökmüş kahverengileşmeler, derimsi bir sertleşme ve çürüme yapar.', commercialNames: ['Ridomil Gold MZ (Syngenta)', 'Aliette (Bayer)', 'Equation Pro (Corteva)'], activeIngredients: ['Metalaxyl-M + Mancozeb', 'Fosetyl-Al', 'Famoxadone + Cymoxanil'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Taneler koruk dönemindeyken bulaşırsa, büyüyen iç basınca dayanamayan tane kabuğu derin şekilde (yıldız şeklinde) "çatlar" ve çekirdekler görünür.', commercialNames: ['Kumulus (BASF)', 'Folicur (Bayer)', 'Ortiva (Syngenta)'], activeIngredients: ['Kükürt', 'Tebuconazole', 'Azoxystrobin'] },
            { type: 'ZARARLI', name: 'Salkım Güvesi (Lobesia botrana)', description: 'Bağın ana zararlısıdır. Larvalar 1. dölde tomurcuk/çiçekleri, 2. dölde korukları oyar. Açılan yaralardan Kurşuni Küf çok hızlı yayılır.', commercialNames: ['Coragen (FMC)', 'Laser (Corteva)', 'Avaunt (FMC)', 'Dipel (Valent)'], activeIngredients: ['Chlorantraniliprole', 'Spinosad', 'Indoxacarb', 'Bacillus thuringiensis'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis cinerea)', description: 'Taneler büyüyüp salkım kapanmadan (taneler birbirine değmeden) hemen önce içine koruyucu mantar ilacı zerk edilmesi şarttır.', commercialNames: ['Signum (BASF)', 'Switch (Syngenta)', 'Cantus (BASF)'], activeIngredients: ['Boscalid + Pyraclostrobin', 'Fludioxonil + Cyprodinil', 'Boscalid'] },
            { type: 'BESLEME', name: 'Potasyum ve Magnezyum', description: 'Tanelerin hızlı ve hacimli irileşmesi, sap bağlarının kuvvetlenmesi için Magnezyum (yeşil renk) ve Potasyum.', commercialNames: ['Epsom Tuzu (Magnezyum Sülfat)', 'Multi-K (Haifa)', 'Novalon 5-5-40 (Doktor Tarsa)'], activeIngredients: ['Magnezyum Sülfat', 'Potasyum Nitrat', 'Yüksek K içerikli NPK'] }
        ],
        BEN_DUSME: [
            { type: 'HASTALIK', name: 'Kurşuni Küf', description: 'Tanelere "ben düştüğünde" (renk dönüşümü/tatlanma başladığında) kabuk incelir ve çatlamalara açık hale gelir. Kurşuni küf bu dönemde salkımı çürütür.', commercialNames: ['Teldor (Bayer)', 'Switch (Syngenta)', 'Scala (BASF)'], activeIngredients: ['Fenhexamid', 'Fludioxonil + Cyprodinil', 'Pyrimethanil'] },
            { type: 'ZARARLI', name: 'Salkım Güvesi (Tatlı Koruk Dölü)', description: 'Larvalar doğrudan tatlılaşan taneleri oyar. Meyve suyunun akmasına ve salkımın içinin vıcık vıcık çürümesine neden olur.', commercialNames: ['Laser (Corteva)', 'Proclaim (Syngenta)'], activeIngredients: ['Spinosad', 'Emamectin benzoate'] },
            { type: 'BESLEME', name: 'Potasyum', description: 'Üzümün çeşidine göre siyah, kırmızı veya altın sarısı rengini tam alması, şeker (Brix) oranının zirveye çıkması ve homojen olgunlaşma için.', commercialNames: ['KTS (Tessenderlo Kerley)', 'SoluPotasse (Tessenderlo)', 'Fosfit Bazlı Ürünler'], activeIngredients: ['Sıvı Potasyum Tiyosülfat', 'Potasyum Sülfat', 'Potasyum Fosfit'] }
        ],
        HASAT: [
            { type: 'HASTALIK', name: 'Kurşuni Küf (Hasat ve İhracat Evresi)', description: 'Özellikle sofralık ve ihracatlık üzümlerde yolda veya soğuk hava deposunda salkımların pamuklanıp çürümemesi için hasada yakın (kısa PHI değerli) ilaçlar kullanılır.', commercialNames: ['Switch (Syngenta)', 'Serenade (Bayer)', 'Teldor (Bayer)'], activeIngredients: ['Fludioxonil + Cyprodinil (Kısa kalıntı)', 'Bacillus subtilis (Biyolojik)', 'Fenhexamid'] },
            { type: 'ZARARLI', name: 'Arı ve Kuş Zararı', description: 'İyice tatlılaşan üzümleri yaban arıları, eşekarısı ve kuşlar patlatarak salkım bütünlüğünü bozar.', commercialNames: ['Tül/File Çekme', 'Feromon Tuzakları'], activeIngredients: ['Fiziksel Koruma'] }
        ]
    },

    ZEYTIN: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Zeytin Halkalı Lekesi (Spilocaea oleagina)', description: 'İlkbaharda artan nem ve sıcaklıkla birlikte yapraklarda tavuskuşu gözü (iç içe halkalar) şeklinde siyah/kahverengi lekeler oluşur. Yaprakları döker, ağacı zayıflatır.', commercialNames: ['Bordo Bulamacı (Hektaş)', 'Kocide 2000 (Certis)', 'Syllit (Agriphar)', 'Flint (Bayer)'], activeIngredients: ['Bakır sülfat + Kireç', 'Bakır hidroksit', 'Dodine', 'Trifloxystrobin'] },
            { type: 'ZARARLI', name: 'Zeytin Pamuklubiti (Euphyllura olivina)', description: 'Çiçek salkımlarında pamukçuk/köpük şeklinde koloniler kurarak bitki özsuyunu emer, çiçeklerin açmadan kurumasına (kısırlaşmasına) neden olur.', commercialNames: ['Decis (Bayer)', 'Karate Zeon (Syngenta)'], activeIngredients: ['Deltamethrin', 'Lambda-cyhalothrin'] },
            { type: 'BESLEME', name: 'Bor ve Çinko İhtiyacı', description: 'Çiçek tomurcuklarının sağlıklı taslak oluşturması ve somakların (zeytin salkımlarının) güçlenmesi için tomurcuk kabarma döneminde uygulanır.', commercialNames: ['YaraVita Bortrac (Yara)', 'YaraVita Zintrac (Yara)', 'Borzin (Doktor Tarsa)'], activeIngredients: ['Etanolamin Bor', 'Sıvı Çinko', 'Çinko-Bor Süspansiyonu'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Zeytin Güvesi (Prays oleae) - Çiçek Dölü', description: 'Çiçek salkımlarının içine girerek tomurcukları ve çiçekleri ağlarla birbirine bağlar, içini yiyerek somakları kurutur.', commercialNames: ['Dipel (Valent)', 'Laser (Corteva)', 'Coragen (FMC)'], activeIngredients: ['Bacillus thuringiensis (Çiçekte arı güvenliği için)', 'Spinosad', 'Chlorantraniliprole'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Tam çiçeklenme döneminde polen tüpü gelişimi ve verimi artırmak için Bor (B) gereklidir.', commercialNames: ['Isabion (Syngenta)', 'Speedfol Bor (Doktor Tarsa)'], activeIngredients: ['Aminoasit + Borik Asit'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Zeytin Güvesi (Meyve Dölü)', description: 'Çiçek dölünden çıkan kelebekler, saçma büyüklüğündeki zeytinlerin sap dibine yumurta bırakır. Larva meyvenin içine (çekirdeğe) girerek meyvenin "karabiber" büyüklüğündeyken veya iri dönemdeyken dökülmesine neden olur.', commercialNames: ['Laser (Corteva)', 'Coragen (FMC)', 'Decis (Bayer)'], activeIngredients: ['Spinosad', 'Chlorantraniliprole', 'Deltamethrin'] },
            { type: 'ZARARLI', name: 'Zeytin Sineği (Bactrocera oleae) (İlk Vuruklar)', description: 'Erkenci çeşitlerde iri meyvelere vurmaya başlar. Meyvenin içine yumurta bırakır, larva meyveyi oyar, zeytinyağında asitliği (dizemi) yükseltir.', commercialNames: ['Success (Corteva - Zehirli Yem Kısmi Dal İlaçlaması)', 'Calypso (Bayer)'], activeIngredients: ['Spinosad + Cezbedici Yem', 'Thiacloprid'] },
            { type: 'HASTALIK', name: 'Antraknoz ve Halkalı Leke', description: 'Yağışlı geçen yaz başlarında meyvelerde çürüme ve yapraklarda dökülme.', commercialNames: ['Flint (Bayer)', 'Bordo Bulamacı (Hektaş)'], activeIngredients: ['Trifloxystrobin', 'Bakır'] },
            { type: 'BESLEME', name: 'Azot ve Potasyum', description: 'Zeytinlerin irileşmesi, çekirdeğin odunlaşması evresinde ağacın kuvvetli kalması için Azot (N) ve Potasyum (K).', commercialNames: ['Multi-K (Haifa)', 'Novalon 20-20-20 (Doktor Tarsa)'], activeIngredients: ['Potasyum Nitrat', '20-20-20 NPK Damlama'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Zeytin Sineği', description: 'Yağlanma başladığında ve havalar serinlediğinde zeytin sineği popülasyonu patlama yapar. Kaliteli zeytinyağı için kesinlikle vuruksuz zeytin gerekir.', commercialNames: ['Success (Corteva)', 'Laser (Corteva)'], activeIngredients: ['Spinosad (Kısmi dal veya kaplama)'] },
            { type: 'HASTALIK', name: 'Zeytin Dal Kanseri (Pseudomonas savastanoi)', description: 'Hasat sırasındaki sırık vurmaları, budama hataları veya dolu yaralarından giren bakteriler dallarda siğil/ur oluşturur. Hasat sonrası koruyucu bakır uygulaması şarttır.', commercialNames: ['Bordo Bulamacı (Hektaş)', 'Kocide 2000 (Certis)'], activeIngredients: ['Bakır sülfat + Kireç', 'Bakır hidroksit'] }
        ]
    },
    BADEM: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Badem Dal Kanseri (Pseudomonas) ve Klok (Taphrina)', description: 'Tomurcuklar patlamadan hemen önce Klok (Yaprak Kıvırcıklığı) ve bakteriyel hastalıklara karşı göztaşı veya bordo bulamacı ile ağaçlar yıkanır.', commercialNames: ['Bordo Bulamacı (Hektaş)', 'Kocide 2000 (Certis)', 'Pomarsol (Bayer)'], activeIngredients: ['Bakır Sülfat + Kireç', 'Bakır hidroksit', 'Thiram'] },
            { type: 'BESLEME', name: 'Çinko-Bor Uyanma Dozu', description: 'Badem erken uyanan bir ağaçtır, ilkbahar geç donlarına yakalanmamak ve çiçeklenmeyi senkronize etmek için.', commercialNames: ['YaraVita Zintrac (Yara)', 'YaraVita Bortrac (Yara)'], activeIngredients: ['Sıvı Çinko', 'Etanolamin Bor'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Bademde çiçeklenme dönemi uzun sürdüğü için, yağışlı günlerde çiçeklerin yanıp kurumaması adına tam çiçeklenmede ilaçlanır.', commercialNames: ['Signum (BASF)', 'Merpan 80 WG (Adama)', 'Chorus (Syngenta)'], activeIngredients: ['Boscalid + Pyraclostrobin', 'Captan', 'Cyprodinil'] },
            { type: 'ZARARLI', name: 'Badem İçkurdu (Eurytoma amygdali)', description: 'Meyve çağla dönemine geçtiğinde sinekler meyvenin içine uzun bir boru (ovipozitör) ile yumurta bırakır. Larva bademin içini (etini) yiyerek siyah, içi boş bademler bırakır.', commercialNames: ['Decis (Bayer)', 'Karate Zeon (Syngenta)'], activeIngredients: ['Deltamethrin', 'Lambda-cyhalothrin'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Döllenme ve meyve tutumu.', commercialNames: ['Isabion (Syngenta)', 'Speedfol Bor (Doktor Tarsa)'], activeIngredients: ['Aminoasit', 'Borik Asit'] }
        ]
    },
    YER_FISTIGI: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Boğazı Çürüklüğü (Aspergillus niger, Sclerotium)', description: 'Tohum yatağında fidelerin kök boğazında siyah spor kitlesi (kara küf) veya beyaz miseller oluşur.', commercialNames: ['Maxim XL (Syngenta)', 'Celest (Syngenta)'], activeIngredients: ['Fludioxonil + Metalaxyl', 'Fludioxonil (Tohum ilaçlaması)'] },
            { type: 'YABANCI_OT', name: 'Dar ve Geniş Yapraklı Otlar', description: 'Yer fıstığı yayılarak büyüdüğü için ot kontrolü çok önemlidir.', commercialNames: ['Stomp Aqua (BASF)', 'Treflan (Corteva)'], activeIngredients: ['Pendimethalin', 'Trifluralin'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Yaprak Lekesi (Cercospora arachidicola)', description: 'Yer fıstığının en yıkıcı hastalığıdır. Yapraklarda sarı haleli siyah/kahverengi lekeler oluşur, yapraklar hızla dökülür, fıstık "iğne" atamaz.', commercialNames: ['Score (Syngenta)', 'Amistar (Syngenta)', 'Folicur (Bayer)', 'Nativo (Bayer)'], activeIngredients: ['Difenoconazole', 'Azoxystrobin', 'Tebuconazole', 'Tebuconazole + Trifloxystrobin'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu ve Prodenya', description: 'Taze yaprakları ve çiçekleri hızla tüketirler.', commercialNames: ['Coragen (FMC)', 'Avaunt (FMC)'], activeIngredients: ['Chlorantraniliprole', 'Indoxacarb'] },
            { type: 'BESLEME', name: 'Kalsiyum İhtiyacı', description: 'Fıstıkların (iğnelerin) toprağa girdiği dönemde, içinin boş kalmaması ve sağlam kabuk bağlaması için doğrudan meyve bölgesine Kalsiyum gerekir.', commercialNames: ['YaraLiva Calcinit (Yara)', 'Alçıtaşı (Jips - Kalsiyum Sülfat)'], activeIngredients: ['Kalsiyum Nitrat', 'Kalsiyum Sülfat'] }
        ]
    },

    MERCIMEK: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Fusarium spp.)', description: 'Mercimeğin erken döneminde soğuk ve nemli topraklarda köklerin kararıp incelmesi. Bitki cılız kalır.', commercialNames: ['Maxim XL (Syngenta)', 'Celest (Syngenta)'], activeIngredients: ['Metalaxyl + Fludioxonil'] },
            { type: 'YABANCI_OT', name: 'Dar Yapraklı Otlar', description: 'Mercimek ot rekabetine çok zayıftır. Çıkış öncesi ve sonrası yabancı ot kontrolü şarttır.', commercialNames: ['Stomp Aqua (BASF)', 'Linuron (Çeşitli)'], activeIngredients: ['Pendimethalin', 'Linuron'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Antraknoz ve Pas', description: 'Özellikle nemli bahar aylarında gövde ve yapraklarda yuvarlak, çökük, kahverengi lekeler.', commercialNames: ['Mancozeb 80 WP', 'Score (Syngenta)'], activeIngredients: ['Mancozeb', 'Difenoconazole'] },
            { type: 'ZARARLI', name: 'Mercimek Hortumlu Böceği', description: 'Bitkinin taze kısımlarını kemirir.', commercialNames: ['Decis (Bayer)', 'Karate Zeon (Syngenta)'], activeIngredients: ['Deltamethrin', 'Lambda-cyhalothrin'] },
            { type: 'BESLEME', name: 'Fosfor ve Molibden', description: 'Köklerde azot bağlayan nodozitelerin çalışması ve dane dolumu için Molibden ve Fosfor.', commercialNames: ['MAP Gübresi', 'YaraVita Molytrac (Yara)'], activeIngredients: ['Mono Amonyum Fosfat', 'Sodyum Molibdat'] }
        ]
    },
    SOYA: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Fide Yanıklığı ve Kök Çürüklüğü', description: 'Ekim sonrası topraktaki mantarların tohumu veya genç fideyi çürütmesi.', commercialNames: ['Maxim XL (Syngenta)', 'Vitavax (UPL)'], activeIngredients: ['Fludioxonil + Metalaxyl', 'Carboxin + Thiram'] },
            { type: 'BESLEME', name: 'Bakteri İnokülasyonu (Aşılama)', description: 'Soyanın havadaki azotu bağlaması için ekimden önce tohumlara Rhizobium bakterisi bulaştırılır.', commercialNames: ['Rhizobium japonicum kültürü'], activeIngredients: ['Canlı Rhizobium Bakterisi'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Yeşilkurt ve Prodenya', description: 'Soya yapraklarını hızla tüketirler, daha sonra baklalara zarar verirler.', commercialNames: ['Coragen (FMC)', 'Radiant (Corteva)'], activeIngredients: ['Chlorantraniliprole', 'Spinetoram'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek ve Beyazsinek', description: 'Sıcak havalarda bitki özsuyunu emerek yaprakları kuruturlar.', commercialNames: ['Agrimec (Syngenta)', 'Oberon (Bayer)'], activeIngredients: ['Abamectin', 'Spiromesifen'] },
            { type: 'BESLEME', name: 'Fosfor ve Potasyum', description: 'Bakla dolumu ve danelerin iri, yağlı olması için.', commercialNames: ['Multi-K (Haifa)', 'Fosforlu Üst Gübreler'], activeIngredients: ['Potasyum Nitrat'] }
        ]
    },
    KIMYON: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Fusarium oxysporum f.sp. cumini)', description: 'Kimyonun ana sorunudur. Bitkilerin kökboğazından çürüyüp sararması ve tarlada bölüm bölüm kuruması (Solgunluk).', commercialNames: ['Tohum İlaçlaması (Syllit vb.)', 'Toprak Solarizasyonu'], activeIngredients: ['Dodine', 'Kültürel Önlemler'] },
            { type: 'YABANCI_OT', name: 'Dar ve Geniş Yapraklı Otlar', description: 'Kimyon yavaş büyür, yabancı ot kontrolü çok önemlidir.', commercialNames: ['Afalon (Bayer)', 'Stomp Aqua (BASF)'], activeIngredients: ['Linuron', 'Pendimethalin'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Külleme', description: 'Bitkinin üzerinde beyaz, unsu bir tabaka.', commercialNames: ['Kumulus (BASF)', 'Topas (Syngenta)'], activeIngredients: ['Kükürt', 'Penconazole'] },
            { type: 'HASTALIK', name: 'Yanıklık (Alternaria)', description: 'Çiçek ve şemsiyelerin üzerinde kararmalar.', commercialNames: ['Score (Syngenta)', 'Amistar (Syngenta)'], activeIngredients: ['Difenoconazole', 'Azoxystrobin'] }
        ]
    },
    BAMYA: {
        GELISIM: [
            { type: 'ZARARLI', name: 'Bamya Yaprakbiti ve Beyazsinek', description: 'Genç yapraklarda ve tepe sürgünlerinde emgi yaparak bitkiyi zayıflatır ve virüs bulaştırırlar.', commercialNames: ['Mospilan (Sumi Agro)', 'Confidor (Bayer)'], activeIngredients: ['Acetamiprid', 'Imidacloprid'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Bamya yapraklarında beyaz unsu tabaka.', commercialNames: ['Topas (Syngenta)', 'Kumulus (BASF)'], activeIngredients: ['Penconazole', 'Kükürt'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Yeşilkurt (Helicoverpa armigera)', description: 'Bamya meyvelerini delerek içine girer ve çürütür.', commercialNames: ['Coragen (FMC)', 'Laser (Corteva)'], activeIngredients: ['Chlorantraniliprole', 'Spinosad'] }
        ]
    },
    NAR: {
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Nar Yaprakbiti', description: 'Genç sürgünleri ve taze çiçekleri emer.', commercialNames: ['Mospilan (Sumi Agro)', 'Actara (Syngenta)'], activeIngredients: ['Acetamiprid', 'Thiamethoxam'] },
            { type: 'BESLEME', name: 'Bor ve Çinko', description: 'Nar çiçeklerinin güçlü tutması ve dökülmemesi için.', commercialNames: ['YaraVita Bortrac (Yara)', 'Speedfol Çinko-Bor (Doktor Tarsa)'], activeIngredients: ['Borik Asit', 'Sıvı Çinko'] }
        ],
        MEYVE_GELISIMI: [
            { type: 'ZARARLI', name: 'Harpuz (Nar Beyazsinek / Unlubiti)', description: 'Meyve kabuğunda kalitesizleşme, siyah isli (fumajin) tabaka.', commercialNames: ['Movento (Bayer)', 'Admiral (Sumi Agro)'], activeIngredients: ['Spirotetramat', 'Pyriproxyfen'] },
            { type: 'HASTALIK', name: 'Meyve Çatlaması', description: 'Düzensiz sulama ve kalsiyum eksikliği meyvelerin çatlamasına neden olur.', commercialNames: ['Stopit (Yara)', 'Wuxal Calcium (Aglukon)'], activeIngredients: ['Kalsiyum Klorür', 'Düzenli Sulama'] }
        ]
    },

    BIBER: {
        FIDE: [
            { type: 'HASTALIK', name: 'Çökerten', description: 'Fide devrilmesi.', activeIngredients: ['Propamocarb', 'Fosetyl-Al'] },
            { type: 'ZARARLI', name: 'Toprak Zararlıları', description: 'Kök kesen zararlılar.', activeIngredients: ['Chlorpyrifos', 'Tefluthrin'] }
        ],
        VEGETATIF: [
            { type: 'ZARARLI', name: 'Yaprakbiti ve Beyazsinek', description: 'Virüs taşıyıcı emiciler.', activeIngredients: ['Acetamiprid', 'Imidacloprid'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yapraklarda beyaz pudra.', activeIngredients: ['Penconazole', 'Kükürt'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Çiçek Tripsi', description: 'Çiçek dökümü.', activeIngredients: ['Spinosad', 'Spinetoram'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'BESLEME', name: 'Kalsiyum Eksikliği', description: 'Çiçek burnu çürüklüğü.', activeIngredients: ['Kalsiyum Nitrat'] },
            { type: 'ZARARLI', name: 'Yeşilkurt', description: 'Biberleri deler.', activeIngredients: ['Emamectin benzoate', 'Indoxacarb'] }
        ]
    },
    HIYAR: {
        FIDE: [
            { type: 'HASTALIK', name: 'Çökerten', description: 'Fide kök çürümesi.', activeIngredients: ['Metalaxyl'] }
        ],
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Yalancı Mildiyö', description: 'Yapraklarda sarı lekeler.', activeIngredients: ['Cymoxanil', 'Propamocarb'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprak altlarında ağlar ve kuruma.', activeIngredients: ['Abamectin', 'Spiromesifen'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Trips', description: 'Meyve eğrilikleri yapar.', activeIngredients: ['Spinosad'] }
        ]
    },
    PATLICAN: {
        VEGETATIF: [
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Çok hassastır, yapraklar sararır.', activeIngredients: ['Abamectin', 'Bifenazate'] },
            { type: 'ZARARLI', name: 'Beyazsinek', description: 'Emgi zararı.', activeIngredients: ['Acetamiprid'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Yeşilkurt', description: 'Meyveleri deler.', activeIngredients: ['Indoxacarb'] }
        ]
    },
    KARPUZ: {
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Antraknoz', description: 'Yapraklarda esmer, ortası delik lekeler.', activeIngredients: ['Mancozeb', 'Azoxystrobin'] },
            { type: 'ZARARLI', name: 'Yaprakbiti', description: 'Kol uçlarında toplanır.', activeIngredients: ['Acetamiprid'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Yaprak kuruması.', activeIngredients: ['Metalaxyl'] }
        ]
    },
    KAVUN: {
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Külleme', description: 'Yapraklar beyazlaşır ve kurur.', activeIngredients: ['Penconazole', 'Kükürt'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Kavun Sineği', description: 'Meyve içine larva bırakır.', activeIngredients: ['Deltamethrin', 'Spinosad (Yem)'] }
        ]
    },
    CILEK: {
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Kırmızı Kökk çürüklüğü', description: 'Köklerde çürüme.', activeIngredients: ['Fosetyl-Al'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprak kuruması.', activeIngredients: ['Abamectin'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis)', description: 'Meyve çürümesi.', activeIngredients: ['Boscalid', 'Fludioxonil'] },
            { type: 'ZARARLI', name: 'Trips', description: 'Meyvelerde bronzlaşma.', activeIngredients: ['Spinosad'] }
        ]
    },
    ARMUT: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Armut Karalekesi', description: 'Tomurcuk enfeksiyonları.', activeIngredients: ['Dodine', 'Bordo Bulamacı'] },
            { type: 'ZARARLI', name: 'Armut Kaplanı', description: 'Yaprak emgisi.', activeIngredients: ['Acetamiprid'] }
        ],
        MEYVE_GELISIMI: [
            { type: 'ZARARLI', name: 'Armut Psillidi', description: 'Ballı madde salgılayarak fumajin yapar.', activeIngredients: ['Spirotetramat', 'Abamectin'] },
            { type: 'HASTALIK', name: 'Ateş Yanıklığı', description: 'Sürgün kurumaları.', activeIngredients: ['Fosetyl-Al'] }
        ]
    },
    SEFTALI: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Şeftali Yaprak Kıvırcıklığı (Taphrina)', description: 'Yaprakların şekli bozulur ve kızarır.', activeIngredients: ['Bordo Bulamacı', 'Thiram', 'Captan'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Çiçek ve sürgün kuruması.', activeIngredients: ['Tebuconazole', 'Boscalid'] }
        ],
        MEYVE_GELISIMI: [
            { type: 'ZARARLI', name: 'Doğu Meyvegüvesi', description: 'Sürgün ve meyvelere girer.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram'] }
        ]
    },
    KIRAZ: {
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Sürgün uçları kurur.', activeIngredients: ['Tebuconazole'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Kiraz Sineği', description: 'Meyvede kurtlanma.', activeIngredients: ['Spinosad (Yem)', 'Acetamiprid'] }
        ]
    },
    NARENCIYE: {
        SURGUN: [
            { type: 'ZARARLI', name: 'Yaprak Galerigüvesi', description: 'Sürgün yapraklarında galeriler.', activeIngredients: ['Abamectin'] }
        ],
        MEYVE_GELISIMI: [
            { type: 'ZARARLI', name: 'Kırmızı Kabuklubit ve Unlubit', description: 'Meyve kalitesini bozar.', activeIngredients: ['Spirotetramat', 'Pyriproxyfen'] },
            { type: 'ZARARLI', name: 'Pas Böngüsü', description: 'Meyve kabuğunda kararma.', activeIngredients: ['Abamectin', 'Spirodiclofen'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Akdeniz Meyve Sineği', description: 'Hasat öncesi vuruklar.', activeIngredients: ['Spinosad (Yem)', 'Malathion'] }
        ]
    },
    FISTIK: {
        TOMURCUK: [
            { type: 'ZARARLI', name: 'Fıstık Psillidi', description: 'Tomurcuklarda beslenir.', activeIngredients: ['Acetamiprid'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Fıstık İçgüvesi', description: 'Meyve içini yer.', activeIngredients: ['Deltamethrin'] }
        ]
    },
    FINDIK: {
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Fındık Küllemesi', description: 'Çotanaklarda kuruma.', activeIngredients: ['Kükürt', 'Penconazole'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Fındık Kurdu', description: 'Çotanakları deler.', activeIngredients: ['Thiacloprid', 'Deltamethrin'] },
            { type: 'ZARARLI', name: 'Fındık Yeşil Kokarcası', description: 'Fındık içini bozar (lekeli iç).', activeIngredients: ['Lambda-cyhalothrin'] }
        ]
    },
    CEVIZ: {
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Ceviz Antraknozu', description: 'Yapraklarda ve meyvede kararmalar.', activeIngredients: ['Mancozeb', 'Bordo Bulamacı'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Ceviz İçkurdu', description: 'Meyve içine girer.', activeIngredients: ['Chlorantraniliprole', 'Spinosad'] }
        ]
    }

};

export const GENERIC_PROBLEMS: Record<string, any[]> = {
    MEYVE_AGACLARI: [
        { type: 'ZARARLI', name: 'Kabuklubitler ve Unlubitler', description: 'Ağacın özsuyunu emerek kuruturlar. Yazlık veya kışlık yağlarla mücadele edilir.', commercialNames: ['Yazlık Yağ (Mineral Yağ)', 'Movento (Bayer)', 'Admiral (Sumi Agro)'], activeIngredients: ['Parafinik Yağ', 'Spirotetramat', 'Pyriproxyfen'] },
        { type: 'HASTALIK', name: 'Ağaç Kanserleri ve Zamklanma', description: 'Gövdede çatlaklar, yaralar ve reçine akıntıları. Budama aletleri dezenfekte edilmeli, bakır kullanılmalıdır.', commercialNames: ['Bordo Bulamacı (Hektaş)', 'Kocide 2000 (Certis)'], activeIngredients: ['Bakır Sülfat + Kireç', 'Bakır Hidroksit'] }
    ],
    SEBZELER: [
        { type: 'ZARARLI', name: 'Kök-Ur Nematodları (Meloidogyne spp.)', description: 'Köklerde irili ufaklı urlar (nodüller) oluşturarak bitkinin su ve besin alımını tamamen tıkar. Bitkiler gündüzleri solar.', commercialNames: ['Velum Prime (Bayer)', 'Nemathorin (Syngenta)', 'Bio-Nematon (Biyolojik)'], activeIngredients: ['Fluopyram', 'Fosthiazate', 'Paecilomyces lilacinus'] },
        { type: 'ZARARLI', name: 'Yaprak Galerisineği (Liriomyza spp.)', description: 'Yapraklarda ince yılan kavi (kıvrımlı) beyaz galeriler açarlar. Fotosentezi durdururlar.', commercialNames: ['Trigard (Syngenta)', 'Agrimec (Syngenta)', 'Laser (Corteva)'], activeIngredients: ['Cyromazine', 'Abamectin', 'Spinosad'] }
    ],
    TARLA_BITKILERI: [
        { type: 'BESLEME', name: 'İz Element Eksiklikleri (Demir, Çinko, Mangan)', description: 'pH değeri yüksek kireçli topraklarda bitkilerin yapraklarında sararma (Kloroz) görülür. Şelatlı mikro elementler kullanılmalıdır.', commercialNames: ['Sequestrene (Syngenta)', 'YaraVita Tenso Cocktail (Yara)', 'Rexolin (Yara)'], activeIngredients: ['EDDHA Çelatlı Demir', 'EDTA Çelatlı Çinko, Mangan, Bakır'] },
        { type: 'HASTALIK', name: 'Toprak Kökenli Solgunluklar (Fusarium, Verticillium, Macrophomina)', description: 'Kimyasal mücadelesi zordur. Hastalıksız tohum, derin sürüm, münavebe ve dirençli çeşit seçimi uygulanır.', commercialNames: ['Trichoderma harzianum (Trianum-P vb.)', 'Toprak Solarizasyonu'], activeIngredients: ['Trichoderma spp. (Faydalı Mantar)', 'Kültürel Mücadele'] }
    ]
};

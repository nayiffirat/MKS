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
        { id: 'SAPA_KALKMA', name: 'Sapa Kalkma ve Dallanma', description: 'Ana sapın uzadığı ve yan dallanın belirdiği dönem.' },
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

export const GENERIC_STAGES = [
    { id: 'FIDE', name: 'Fide / Erken Gelişim', description: 'Ekimden sonraki ilk büyüme evresi.' },
    { id: 'VEGETATIF', name: 'Vejetatif Gelişim', description: 'Hızlı boy atma ve yapraklanma evresi.' },
    { id: 'GENERATIF', name: 'Generatif Gelişim (Çiçeklenme)', description: 'Çiçeklenme ve döllenme dönemi.' },
    { id: 'MEYVE', name: 'Meyve / Ürün Oluşumu', description: 'Ürünün büyüdüğü ve geliştiği dönem.' },
    { id: 'HASAT', name: 'Olgunlaşma', description: 'Hasada yaklaşım ve renk dönümü dönemi.' }
];

export const GENERIC_PROBLEMS: Record<string, any[]> = {
    TARLA: [
        { type: 'HASTALIK', name: 'Fide Çökerteni (Pythium / Rhizoctonia)', description: 'Genç fidelerin sap tabanında çürüme ve devrilme.', commercialNames: ['Previcur Energy (Bayer)', 'Celest Max (Syngenta)'], activeIngredients: ['Propamocarb + Fosetyl-Al', 'Fludioxonil'] },
        { type: 'BESLEME', name: 'Erken Dönem Kök Geliştirici (Fosfor & Çinko)', description: 'Tohumun çimlenip saçak kök yapması için yüksek Fosfor ve Çinko desteği.', commercialNames: ['Novalon 10-52-10 (Doktor Tarsa)', 'Blackjak (Hektaş)'], activeIngredients: ['10-52-10 MAP', 'Hümik Asit', 'EDTA Çinko'] },
        { type: 'ZARARLI', name: 'Telkurdu ve Bozkurt', description: 'Toprak altı zararlıları.', commercialNames: ['Force 20 CS (Syngenta)', 'Decis (Bayer)'], activeIngredients: ['Tefluthrin', 'Deltamethrin'] }
    ],
    SEBZE: [
        { type: 'HASTALIK', name: 'Fide Kök Boğazı Çürüklüğü', description: 'Şaşırtma sonrası kök boğazı kararmaları.', commercialNames: ['Previcur Energy (Bayer)'], activeIngredients: ['Propamocarb + Fosetyl-Al'] },
        { type: 'BESLEME', name: 'Kök ve Gövde Geliştirici (10-52-10 MAP)', description: 'Fide döneminde kökleşme ve gövde kalınlaşması.', commercialNames: ['Novalon 10-52-10 (Doktor Tarsa)', 'Radifarm (Valagro)'], activeIngredients: ['10-52-10 MAP', 'Kök Uyarıcı Peptitler'] },
        { type: 'ZARARLI', name: 'Yaprakbiti ve Kırmızı Örümcek', description: 'Sebzelerde emgi yapan yaygın zararlılar.', commercialNames: ['Mospilan (Sumi Agro)', 'Agrimec (Syngenta)'], activeIngredients: ['Acetamiprid', 'Abamectin'] }
    ],
    MEYVE: [
        { type: 'HASTALIK', name: 'Bakteriyel ve Mantari Koruma (Bordo Bulamacı)', description: 'Göz kabarması öncesi koruyucu bakır uygulaması.', commercialNames: ['Bordo Bulamacı', 'Kocide 2000'], activeIngredients: ['Bakır Sülfat', 'Bakır Hidroksit'] },
        { type: 'BESLEME', name: 'Uyanma Öncesi Çinko ve Bor Yüklemesi', description: 'Bahar uyanmasında gözlerin güçlü uyanması.', commercialNames: ['YaraVita Zintrac (Yara)', 'Speedfol Bor (Doktor Tarsa)'], activeIngredients: ['Sıvı Çinko', 'Etanolamin Bor'] }
    ]
};


export const PROBLEM_DATABASE: Record<string, Record<string, any[]>> = {
    "SOGAN": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici, Fosfor ve Çinko İhtiyacı",
                "description": "Tohumun ve arpacığın çimlenerek güçlü kılcal kök yapısı oluşturması, soğuk stresini atlatması için yüksek oranda alınabilir Fosfor (P) ve Çinko (Zn) gereklidir.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Peters Professional (ICL)",
                    "Blackjak Hümik Asit (Hektaş)",
                    "Zinc 15 (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Hümik / Fülvik Asit",
                    "EDTA Çelatlı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kök Çürüklüğü (Pythium / Rhizoctonia)",
                "description": "Köklerin sararması, esmerleşmesi ve çürümesi. Genç fidelerin kurumasına yol açar.",
                "commercialNames": [
                    "Previcur Energy (Bayer)",
                    "Celest Max (Syngenta)",
                    "Pomarsol Forte (Bayer)"
                ],
                "activeIngredients": [
                    "Propamocarb + Fosetyl-Al",
                    "Fludioxonil",
                    "Thiram"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Soğan Sineği (Delia antiqua)",
                "description": "Kurtçuklar (larvalar) genç soğanın kök boğazına girerek içini yer ve fidenin sararıp kurumasına yol açar.",
                "commercialNames": [
                    "Dursban 4 (Corteva)",
                    "Force 20 CS (Syngenta)"
                ],
                "activeIngredients": [
                    "Chlorpyrifos-ethyl",
                    "Tefluthrin"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Azot ve Kükürt Gübrelemesi",
                "description": "Yaprak sayısını ve yeşil aksam hacmini artırmak için Azot (N) ve soğanın kendine özgü aromasını oluşturan Kükürt (S) takviyesi.",
                "commercialNames": [
                    "Toros Amonyum Sülfat %21 S (Toros Tarım)",
                    "İgsaş CAN %26",
                    "YaraVita Zintrac (Yara)"
                ],
                "activeIngredients": [
                    "Amonyum Sülfat (%21 N, %24 S)",
                    "Kalsiyum Amonyum Nitrat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Mildiyö (Peronospora destructor)",
                "description": "Yapraklarda morumsu-gri mantar tabakası ve yaprak uçlarından aşağı doğru kuruma. Rutubetli havalarda hızla yayılır.",
                "commercialNames": [
                    "Ridomil Gold MZ (Syngenta)",
                    "Acrobat Plus (BASF)",
                    "Curzate (Corteva)"
                ],
                "activeIngredients": [
                    "Metalaxyl-M + Mancozeb",
                    "Dimethomorph + Mancozeb",
                    "Cymoxanil + Mancozeb"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Soğan Trips (Thrips tabaci)",
                "description": "Yapraklarda emgi yaparak gümüşi lekeler ve çizikler oluşturur. Fotosentez alanını yok eder.",
                "commercialNames": [
                    "Radiant 120 SC (Corteva)",
                    "Laser (Corteva)",
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Spinetoram",
                    "Spinosad",
                    "Acetamiprid"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Dar ve Geniş Yapraklı Otlar",
                "description": "Soğan bitkisi dar yapraklı olduğu için ot rekabetine çok hassastır.",
                "commercialNames": [
                    "Goal 2E (Corteva)",
                    "Stomp Aqua (BASF)",
                    "Fusilade Max (Syngenta)"
                ],
                "activeIngredients": [
                    "Oxyfluorfen",
                    "Pendimethalin",
                    "Fluazifop-p-butyl"
                ]
            }
        ],
        "BAS_BAGLAMA": [
            {
                "type": "BESLEME",
                "name": "Denge Gübrelemesi (20-20-20 NPK + Bor)",
                "description": "Yaprak gelişiminden baş oluşturma evresine geçişte dengeli besin takviyesi ve polen/doku sağlamlığı için Bor.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "YaraVita Bortrac (Yara)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Etanolamin Bor",
                    "Aminoasitler"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Siyah Küf (Aspergillus niger)",
                "description": "Baş bağlama aşamasında kabuk aralarında siyah tozlu spor tabakası oluşturur.",
                "commercialNames": [
                    "Folicur (Bayer)",
                    "Dithane M-45 (Corteva)"
                ],
                "activeIngredients": [
                    "Tebuconazole",
                    "Mancozeb"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Stemphylium Yaprak Yanıklığı",
                "description": "Yapraklarda elips şeklinde baklava desenli kahverengi lekeler oluşur.",
                "commercialNames": [
                    "Amistar (Syngenta)",
                    "Score 250 EC (Syngenta)"
                ],
                "activeIngredients": [
                    "Azoxystrobin",
                    "Difenoconazole"
                ]
            }
        ],
        "BAS_BUYUMESI": [
            {
                "type": "BESLEME",
                "name": "Potasyum ve Kükürt İhtiyacı",
                "description": "Soğan başlarının irileşmesi, sıkılaşması, kuru madde oranının artması ve aroma kazanması için yoğun Potasyum ve Kükürt desteği.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat (0-0-50+18S)",
                    "Potasyum Tiyosülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Soğan Trips",
                "description": "Baş büyümesi sırasında emgi zararı devam ederek soğan kabuklarında pürüzlenme ve küçülme yapar.",
                "commercialNames": [
                    "Spintor (Corteva)",
                    "Confidor (Bayer)"
                ],
                "activeIngredients": [
                    "Spinosad",
                    "Imidacloprid"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Potasyum ve Depo Dayanımı Gübrelemesi",
                "description": "Hasat öncesi başların kabuk sertliği ve depoda çürümeden uzun süre dayanabilmesi için folyar Potasyum takviyesi.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "YaraTera Krista K (Yara)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Boyun Çürüklüğü (Botrytis allii)",
                "description": "Yaprakların yattığı boyun kısmından girerek depolama esnasında soğanın içten yumuşayıp çürümesine yol açar.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil"
                ]
            }
        ]
    },
    "AYCICEGI": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici, Fosfor ve Çinko İhtiyacı",
                "description": "Tohumun çimlenip toprak yüzeyine çıkması, derine inen güçlü kazık kök ve kılcal kök yapısı oluşturması için Fosfor (P) ve Çinko (Zn) takviyesi.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Microstar PZ (Sipcam)",
                    "Blackjak (Hektaş)",
                    "Zinc 15 (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Mikrogranül MAP + Çinko",
                    "Hümik / Fülvik Asit",
                    "EDTA Çelatlı Çinko"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Bozkurt (Agrotis spp.) ve Telkurdu (Agriotes spp.)",
                "description": "Toprak altı zararlıları. Bozkurt fideleri toprak seviyesinden keserek devirir; Telkurdu ise çimlenen tohumu ve kökleri delerek öldürür.",
                "commercialNames": [
                    "Force 20 CS (Syngenta)",
                    "Gaucho 600 FS (Bayer)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Tefluthrin",
                    "Imidacloprid (Tohum)",
                    "Deltamethrin"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fide Kök Çürüklüğü (Pythium / Rhizoctonia)",
                "description": "Toprak nemli ve soğuk olduğunda tohum çürümesi veya fidenin devrilmesi.",
                "commercialNames": [
                    "Maxim XL (Syngenta)",
                    "Celest (Syngenta)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Metalaxyl-M"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Dar ve Geniş Yapraklı Otlar (Çıkış Öncesi)",
                "description": "Erken dönemde ayçiçeği fidelerinin ot baskısı altında kalmasını önler.",
                "commercialNames": [
                    "Stomp Aqua (BASF)",
                    "Racer 25 EC (Adama)"
                ],
                "activeIngredients": [
                    "Pendimethalin",
                    "Flurochloridone"
                ]
            }
        ],
        "GELISIM": [
            {
                "type": "BESLEME",
                "name": "Vejetatif Gelişim Gübrelemesi (Azot, Çinko ve Bor)",
                "description": "Ayçiçeğinin rozet yaprak döneminden boya kalkma evresine geçtiği en hızlı büyüme dönemidir. Gövde kalınlaşması, geniş yaprak alanı ve yüksek fotosentez için Azot (Üre veya CAN 26) çapa ile verilir; yapraktan Bor (B) ve Çinko (Zn) uygulanır.",
                "commercialNames": [
                    "Toros Üre %46 (Toros Tarım)",
                    "İgsaş CAN %26 (İgsaş)",
                    "YaraVita Bortrac (Yara)",
                    "Speedfol Zinc (Doktor Tarsa)",
                    "Megafol (Valagro)"
                ],
                "activeIngredients": [
                    "Üre (%46 N)",
                    "Kalsiyum Amonyum Nitrat (%26 N)",
                    "Sıvı Etanolamin Bor",
                    "EDTA Çelatlı Çinko",
                    "Aminoasit ve Deniz Yosunu"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Ayçiçeği Mildiyösü (Plasmopara halstedii)",
                "description": "Yapraklarda açık yeşil-sarı lekeler, alt yüzeyde beyaz unsu küf tabakası ve bitkide ciddi cüceleşme (bodur kalma).",
                "commercialNames": [
                    "Ridomil Gold MZ (Syngenta)",
                    "Amistar (Syngenta)",
                    "Acrobat Plus (BASF)"
                ],
                "activeIngredients": [
                    "Metalaxyl-M + Mancozeb",
                    "Azoxystrobin",
                    "Dimethomorph"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ayçiçeği Makaslı Böceği (Lethrus cephalotes) ve Yeşilkurt",
                "description": "Makaslı böcek genç taze yaprakları ve sürgünleri makas gibi keser. Yeşilkurt larvaları taze yaprakları yer.",
                "commercialNames": [
                    "Decis (Bayer)",
                    "Karate Zeon (Syngenta)"
                ],
                "activeIngredients": [
                    "Deltamethrin",
                    "Lambda-cyhalothrin"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Canavar Otu (Orobanche cumana / Şeytan Şalgamı)",
                "description": "Ayçiçeği köklerine asalak olarak yapışan, klorofilsiz parazit ot. Bitkinin besinini emerek kurutur.",
                "commercialNames": [
                    "Pulsar 40 (BASF)",
                    "Intervix (BASF - IMI Grubu Çeşitlerde)"
                ],
                "activeIngredients": [
                    "Imazamox (Clearfield Toleranslı Çeşitlerde)"
                ]
            }
        ],
        "TABLA": [
            {
                "type": "BESLEME",
                "name": "Tabla Büyütme, Bor ve Kükürt İhtiyacı",
                "description": "Yıldız (tabla) oluşum evresinde çiçek tablasının genişlemesi, polen tüpünün sağlıklı oluşumu için Bor (B) ve Kükürt desteği şarttır.",
                "commercialNames": [
                    "YaraVita Bortrac (Yara)",
                    "Speedfol Bor (Doktor Tarsa)",
                    "Borzin (Doktor Tarsa)",
                    "Toros Amonyum Sülfat"
                ],
                "activeIngredients": [
                    "Sıvı Etanolamin Bor",
                    "Borik Asit",
                    "Amonyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Sklerotinia Kök ve Gövde Çürüklüğü (Beyaz Küf)",
                "description": "Gövdede ve tabla arkasında ıslak çürümeler, beyaz pamuksu miseller ve siyah sklerotlar (çam kozalağı benzeri çekirdekler) oluşur.",
                "commercialNames": [
                    "Cantus (BASF)",
                    "Propulse (Bayer)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Boscalid",
                    "Fluopyram + Prothioconazole",
                    "Tebuconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ayçiçeği Güvesi (Homoeosoma nebulella) ve Yaprakbitleri",
                "description": "Güve larvaları tablayı delerek tomurcukları yer, ağ örer. Yaprakbitleri özsuyu emer.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Acetamiprid"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Döllenme ve Tane Tutumu Gübrelemesi (Bor & Potasyum)",
                "description": "Tabladaki tüpsü çiçeklerin eksiksiz döllenmesi, boş çekirdek (boş kovan) kalmaması ve polen canlılığı için Bor ve Potasyum takviyesi.",
                "commercialNames": [
                    "Borocal (Tradecorp)",
                    "Multi-K (Haifa)",
                    "Speedfol Bor (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Kalsiyum-Bor Kompleksi",
                    "Potasyum Nitrat",
                    "Sıvı Bor"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Tabla Çürüklüğü (Rhizopus stolonifer & Botrytis cinerea)",
                "description": "Yağışlı ve nemli çiçeklenme döneminde tablanın arka kısmının kahverengileşip yumuşaması ve çürümesi.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yeşilkurt (Helicoverpa armigera)",
                "description": "Tablanın ön yüzündeki açık çiçekleri ve taze tohumları yer.",
                "commercialNames": [
                    "Dipel DF (Valent - Arı Dostu Biyolojik)",
                    "Radiant 120 SC (Corteva)"
                ],
                "activeIngredients": [
                    "Bacillus thuringiensis",
                    "Spinetoram"
                ]
            }
        ],
        "TANE_DOLUM": [
            {
                "type": "BESLEME",
                "name": "Yağ Oranı (Brix) ve Tane Dolumu Gübrelemesi (Potasyum & Kükürt)",
                "description": "Çekirdek içinin tam dolması, hektolitre (özgül) ağırlığının artması ve yağ oranının (%45-50+) yükselmesi için Potasyum Sülfat uygulaması.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat (0-0-50+18S)",
                    "Potasyum Tiyosülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Phomopsis Gövde Kanseri (Diaporthe helianthi) ve Alternaria",
                "description": "Yaprak uçlarında üçgen şeklinde kurumalar ve gövdede gri-kahverengi lekeler. Bitkinin vaktinden önce kurumasına neden olur.",
                "commercialNames": [
                    "Amistar Extra (Syngenta)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Azoxystrobin + Difenoconazole",
                    "Tebuconazole"
                ]
            }
        ]
    },
    "SEKER_PANCARI": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici Fosfor ve Çinko İhtiyacı",
                "description": "Şeker pancarı tohuma çok hassastır. Çimlenen kotiledonların hızlı büyümesi ve kılcal kök tesisi için Fosfor (P) ve Çinko (Zn) takviyesi.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Microstar PZ (Sipcam)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Mikrogranül MAP + Çinko",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kök Boğazı Yanıklığı / Black Root Rot (Hymexazol)",
                "description": "Genç fidenin kök boğazı siyahlaşır, incelir ve ip gibi olarak devrilir.",
                "commercialNames": [
                    "Tachigaren 30 WP (Sumi Agro)",
                    "Pomarsol (Bayer)"
                ],
                "activeIngredients": [
                    "Hymexazol",
                    "Thiram"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Toprak Kurtları (Telkurdu, Bozkurt) ve Pancar Piresi",
                "description": "Telkurtları kökü deler, Bozkurt fideleri keser. Pancar piresi kotiledon yaprakları saçma gibi delik deşik eder.",
                "commercialNames": [
                    "Force 20 CS (Syngenta)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Tefluthrin",
                    "Deltamethrin"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Dar ve Geniş Yapraklı Otlar",
                "description": "Pancar erken dönemde çok yavaş büyüdüğü için ot kontrolü hayatidir.",
                "commercialNames": [
                    "Goltix (Adama)",
                    "Betanal SE (Bayer)"
                ],
                "activeIngredients": [
                    "Metamitron",
                    "Phenmedipham + Desmedipham + Ethofumesate"
                ]
            }
        ],
        "YAPRAKLANMA": [
            {
                "type": "BESLEME",
                "name": "Azot, Çinko ve Magnezyum Gübrelemesi",
                "description": "Yaprak kanopisini büyütmek ve klorofil sentezini artırmak için Azot (CAN %26), Magnezyum Sülfat ve Çinko uygulaması.",
                "commercialNames": [
                    "İgsaş CAN %26",
                    "Epsom Tuzu (Magnezyum Sülfat)",
                    "YaraVita Zintrac (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Amonyum Nitrat",
                    "Magnezyum Sülfat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Pancar Küllemesi (Erysiphe betae)",
                "description": "Yapraklarda un serpilmiş gibi beyaz mantar tabakası. Fotosentezi düşürür.",
                "commercialNames": [
                    "Kumulus (BASF)",
                    "Topas (Syngenta)",
                    "Score (Syngenta)"
                ],
                "activeIngredients": [
                    "Kükürt",
                    "Penconazole",
                    "Difenoconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Pancar Yaprakbiti (Aphis fabae) ve Pancar Sineği",
                "description": "Siyah yaprakbitleri yaprak altlarında kolonileşir, yaprakları büzüştürür ve virüs taşır.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Confidor (Bayer)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Imidacloprid"
                ]
            }
        ],
        "KOK_GELISIMI": [
            {
                "type": "BESLEME",
                "name": "Şeker Birikimi (Polar) ve Bor Gübrelemesi",
                "description": "Pancar kökünün kalınlaştığı, polar (şeker) oranının yükseldiği dönemdir. Bor eksikliğinde kök tacında çürümeler (kuru çürüklük) oluşur. Bor (B) ve Potasyum takviyesi şarttır.",
                "commercialNames": [
                    "YaraVita Bortrac (Yara)",
                    "Borzin (Doktor Tarsa)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Sıvı Etanolamin Bor",
                    "Borik Asit",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Cercospora Yaprak Lekesi (Cercospora beticola)",
                "description": "Pancarın en yıkıcı yaprak hastalığıdır. Yapraklarda kırmızı-kahverengi halkalı küçük lekeler oluşur, yapraklar tamamen kurur. Polar oranını %5-6 düşürür.",
                "commercialNames": [
                    "Sphere Max (Bayer)",
                    "Amistar Extra (Syngenta)",
                    "Nativo (Bayer)"
                ],
                "activeIngredients": [
                    "Trifloxystrobin + Cyproconazole",
                    "Azoxystrobin + Difenoconazole",
                    "Tebuconazole + Trifloxystrobin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Pancar Çizgili Böceği (Chaetocnema tibialis)",
                "description": "Yapraklarda çukurlar ve delikler açarak beslenir.",
                "commercialNames": [
                    "Karate Zeon (Syngenta)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Lambda-cyhalothrin",
                    "Deltamethrin"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Son Dönem Potasyum ve Kükürt İhtiyacı",
                "description": "Hasat öncesinde kökteki şeker (polar) oranını zirveye çıkarmak ve fabrika firesini düşürmek için Potasyum Sülfat folyar uygulaması.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Rhizoctonia Kök Çürüklüğü (Rhizoctonia solani)",
                "description": "Kökün toprak altındaki kısmında siyah süngerimsi çürümeler yapar, pancar başını kurutur.",
                "commercialNames": [
                    "Amistar (Syngenta)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Azoxystrobin",
                    "Tebuconazole"
                ]
            }
        ]
    },
    "PATATES": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Kök ve Sürgün Geliştirici Gübreleme (Fosfor & Çinko)",
                "description": "Yumrudan çıkan ilk sürgünlerin güçlü kök atması ve toprağı çabuk kaplaması için yüksek Fosfor (P) ve Çinko (Zn).",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Blackjak (Hektaş)",
                    "Microstar PZ (Sipcam)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Hümik Asit",
                    "Mikrogranül MAP + Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Siyah Siğil ve Kök Çürüklüğü (Rhizoctonia solani)",
                "description": "Filizlerin uçlarının kararıp yanmasına ve yumru üzerinde siyah toprak benzeri siğiller (sklerot) oluşmasına neden olur.",
                "commercialNames": [
                    "Monceren (Bayer)",
                    "Celest Top (Syngenta)"
                ],
                "activeIngredients": [
                    "Pencycuron",
                    "Fludioxonil + Difenoconazole + Thiamethoxam"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Telkurdu (Agriotes spp.) ve Bozkurt",
                "description": "Telkurtları ana yumruyu ve yeni oluşan stolonları oyar.",
                "commercialNames": [
                    "Force 20 CS (Syngenta)",
                    "Regent (BASF)"
                ],
                "activeIngredients": [
                    "Tefluthrin",
                    "Fipronil"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Gövde ve Yaprak Gelişimi için Azot & Magnezyum",
                "description": "Boğaz doldurma sonrası gövde kalınlaşması ve yeşil aksam kütlesini artırmak için Azot (Üre / CAN) ve fotosentez için Magnezyum Sülfat.",
                "commercialNames": [
                    "Toros Üre %46",
                    "Epsom Tuzu (Magnezyum Sülfat)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "Üre",
                    "Magnezyum Sülfat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Erken Yanıklık (Alternaria solani)",
                "description": "Alt yapraklarda hedef tahtası (iç içe halkalar) şeklinde koyu kahverengi lekeler.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Dithane M-45 (Corteva)",
                    "Signum (BASF)"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Mancozeb",
                    "Boscalid + Pyraclostrobin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Patates Böceği (Leptinotarsa decemlineata)",
                "description": "Erginler ve çizgili turuncu larvalar yaprakları oburca yiyerek patatesi çalı gibi dımdızlak bırakır.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Radiant (Corteva)",
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinetoram",
                    "Acetamiprid"
                ]
            }
        ],
        "YUMRU_OLUSUMU": [
            {
                "type": "BESLEME",
                "name": "Stolon ve Yumru Bağlama Döneminde Kalsiyum & Fosfor",
                "description": "Patatesin toprak altı stolon uçlarının yumruya dönüşmesi (yumru set sayısı) ve hücre duvarı sağlamlığı için Kalsiyum Nitrat ve MAP.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Stopit (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "10-52-10 MAP",
                    "Sıvı Kalsiyum"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Patates Mildiyösü (Phytophthora infestans)",
                "description": "Patatesin 1 numaralı düşmanıdır! Yapraklarda su emmiş gibi büyük morumsu-siyah lekeler ve alt yüzeyde beyaz pamukçuk. Tarlayı günler içinde yok edebilir.",
                "commercialNames": [
                    "Revus (Syngenta)",
                    "Infinito (Bayer)",
                    "Ridomil Gold MZ (Syngenta)",
                    "Acrobat Plus (BASF)"
                ],
                "activeIngredients": [
                    "Mandipropamid",
                    "Fluopicolide + Propamocarb",
                    "Metalaxyl-M + Mancozeb",
                    "Dimethomorph + Mancozeb"
                ]
            }
        ],
        "YUMRU_BUYUMESI": [
            {
                "type": "BESLEME",
                "name": "Yumru İrileşmesi ve Kalite için Yüksek Potasyum",
                "description": "Toprak altındaki yumruların hızla irileşmesi, nişasta ve kuru madde birikimi, iç kararmalarının önlenmesi için yoğun Potasyum (K) takviyesi.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)",
                    "Novalon 5-5-40 (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat",
                    "5-5-40 NPK"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yumru Mildiyösü Bulaşması",
                "description": "Yapraklardan sızan mildiyö sporlarının yağmur ve sulama suyuyla yumruya inip yumruyu içten kahverengileştirip çürütmesi.",
                "commercialNames": [
                    "Ranman Top (ISK)",
                    "Infinito (Bayer)"
                ],
                "activeIngredients": [
                    "Cyazofamid",
                    "Fluopicolide + Propamocarb"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Patates Güvesi (Phthorimaea operculella)",
                "description": "Larvalar yumruları delerek galeriler açar ve pisletir.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Voliam Targo (Syngenta)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Abamectin + Chlorantraniliprole"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Kabuk Sertleşmesi ve Depo Dayanımı için Potasyum Sülfat",
                "description": "Söküm öncesi yaprak kurutma (desikasyon) ile beraber yumru kabuğunun kalınlaşması ve depolama ömrünün uzaması için Potasyum Sülfat.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Adi Uyuz (Streptomyces scabies) ve Depo Çürüklükleri",
                "description": "Yumru kabuğunda krater gibi yüzeysel veya derin uyuz yaraları.",
                "commercialNames": [
                    "Kültürel Önlem (Düşük pH)",
                    "Fludioxonil (Depo)"
                ]
            }
        ]
    },
    "ARPA": {
        "KARDESLENME": [
            {
                "type": "BESLEME",
                "name": "Azotlu Üst Gübreleme (Kardeşlenme)",
                "description": "Kardeş sayısını artırmak ve kök tacını güçlendirmek için erken ilkbahar Azot uygulaması (Üre veya Amonyum Sülfat).",
                "commercialNames": [
                    "Toros Üre %46",
                    "İgsaş Amonyum Sülfat %21 S"
                ],
                "activeIngredients": [
                    "Üre",
                    "Amonyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Arpa Yaprak Lekesi / Rhynchosporium secalis",
                "description": "Yapraklarda etrafı koyu kahverengi, ortası gri eliptik haşlanmış gibi lekeler.",
                "commercialNames": [
                    "Input (Bayer)",
                    "Opera Max (BASF)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Prothioconazole + Spiroxamine",
                    "Epoxiconazole + Pyraclostrobin",
                    "Tebuconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ekin Bambulu (Zabrus spp.)",
                "description": "Erken evrede yaprakları toprağa çekerek kemirir.",
                "commercialNames": [
                    "Decis (Bayer)",
                    "Karate Zeon (Syngenta)"
                ],
                "activeIngredients": [
                    "Deltamethrin",
                    "Lambda-cyhalothrin"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Geniş ve Dar Yapraklı Otlar",
                "description": "Arpa tarlasında yabancı ot mücadelesi.",
                "commercialNames": [
                    "Axial (Syngenta)",
                    "Granstar (FMC)",
                    "Mustang (Corteva)"
                ],
                "activeIngredients": [
                    "Pinoxaden",
                    "Tribenuron-methyl",
                    "Florasulam + 2,4-D"
                ]
            }
        ],
        "SAPA_KALKMA": [
            {
                "type": "BESLEME",
                "name": "Azot ve Çinko Takviyesi (Boy Gübresi)",
                "description": "Sağlam sap ve iri başak taslağı için CAN %26 ve yapraktan Çinko takviyesi.",
                "commercialNames": [
                    "İgsaş CAN %26",
                    "YaraVita Zintrac (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Amonyum Nitrat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Arpa Çizgili Yaprak Lekesi (Helminthosporium gramineum)",
                "description": "Yapraklar boyunca uzun sarı-kahverengi çizgiler ve yaprağın boyuna yırtılması.",
                "commercialNames": [
                    "Amistar Extra (Syngenta)",
                    "Priaxor (BASF)"
                ],
                "activeIngredients": [
                    "Azoxystrobin + Difenoconazole",
                    "Fluxapyroxad + Pyraclostrobin"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Blumeria graminis)",
                "description": "Yaprak ve sapta pamuksu beyaz örtü.",
                "commercialNames": [
                    "Corbel (BASF)",
                    "Topas (Syngenta)"
                ],
                "activeIngredients": [
                    "Fenpropimorph",
                    "Penconazole"
                ]
            }
        ],
        "BASAKLANMA": [
            {
                "type": "BESLEME",
                "name": "Çinko ve Bor Takviyesi",
                "description": "Başakta kör tane kalmaması ve döllenme başarısı için folyar çinko ve bor.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "Speedfol Bor (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Ağ Yaprak Lekesi (Pyrenophora teres)",
                "description": "Yapraklarda enine ve boyuna ağ görünümünde koyu kahverengi çizgiler.",
                "commercialNames": [
                    "Nativo (Bayer)",
                    "Opera Max (BASF)"
                ],
                "activeIngredients": [
                    "Tebuconazole + Trifloxystrobin",
                    "Epoxiconazole + Pyraclostrobin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Süne (Nimf Dönemi)",
                "description": "Başaktaki sütlü taneleri emerek tane ağırlığını ve çimlenme gücünü düşürür.",
                "commercialNames": [
                    "Karate Zeon (Syngenta)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Lambda-cyhalothrin",
                    "Deltamethrin"
                ]
            }
        ],
        "SUT_OLUMU": [
            {
                "type": "BESLEME",
                "name": "Potasyum İhtiyacı (Tane Ağırlaşması)",
                "description": "Hektolitre ağırlığını (dolgunluk) ve yemlik/malatlık kaliteyi artırmak için Potasyum.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Süne ve Kımıl İleri Evre Nimfler",
                "description": "Taneleri emmeye devam eden zararlılara karşı son ilaçlamalar.",
                "commercialNames": [
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Deltamethrin"
                ]
            }
        ]
    },
    "YER_FISTIGI": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici ve Fosfor İhtiyacı",
                "description": "Tohum çimlenmesi sonrası güçlü kök sistemi için Fosfor ve Çinko.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kök Boğazı Çürüklüğü (Aspergillus niger, Sclerotium)",
                "description": "Fidelerin kök boğazında siyah spor kitlesi (kara küf) veya beyaz miseller.",
                "commercialNames": [
                    "Maxim XL (Syngenta)",
                    "Celest (Syngenta)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Metalaxyl-M"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Dar ve Geniş Yapraklı Otlar",
                "description": "Fıstık toprağa yayılarak büyüdüğü için çıkış öncesi ot kontrolü kritiktir.",
                "commercialNames": [
                    "Stomp Aqua (BASF)",
                    "Treflan (Corteva)"
                ],
                "activeIngredients": [
                    "Pendimethalin",
                    "Trifluralin"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Bor ve Molibden Takviyesi",
                "description": "Çiçek verimi ve köklerdeki Rhizobium azot bakterilerinin aktivitesi için Bor ve Molibden.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "YaraVita Molytrac (Yara)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Sodyum Molibdat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yaprak Lekesi (Cercospora arachidicola)",
                "description": "Yapraklarda sarı haleli siyah lekeler. Yaprakları döker, iğne atımını durdurur.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Amistar (Syngenta)",
                    "Nativo (Bayer)"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Azoxystrobin",
                    "Tebuconazole + Trifloxystrobin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Pamuk Yeşilkurtu ve Prodenya",
                "description": "Taze yaprakları ve çiçekleri yerler.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Avaunt (FMC)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Indoxacarb"
                ]
            }
        ],
        "IGNE_OLUSUMU": [
            {
                "type": "BESLEME",
                "name": "Kalsiyum İhtiyacı (İğnelerin Toprağa Girmesi)",
                "description": "Döllenen çiçek uzayarak toprağa girer (iğne/ginofor). Meyvenin boş kalmaması ve kovan doldurması için topraktan Kalsiyum uygulaması şarttır.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Jips (Kalsiyum Sülfat)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Kalsiyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Telkurdu ve Toprak Kurtları",
                "description": "Toprağa giren taze iğneleri kemirerek meyve oluşumunu engeller.",
                "commercialNames": [
                    "Force 20 CS (Syngenta)"
                ],
                "activeIngredients": [
                    "Tefluthrin"
                ]
            }
        ],
        "KAPSUL": [
            {
                "type": "BESLEME",
                "name": "Kapsül İç Dolumu için Potasyum & Kalsiyum",
                "description": "Toprak altındaki fıstık kapsüllerinin dolması, içinin yağlanması ve kabuğun sertleşmesi.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)",
                    "Stopit (Yara)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat",
                    "Sıvı Kalsiyum"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kapsül Çürüklüğü (Sclerotium rolfsii)",
                "description": "Toprak altındaki kapsüllerde beyaz küf ve çürüme.",
                "commercialNames": [
                    "Cantus (BASF)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Boscalid",
                    "Tebuconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek",
                "description": "Yaprakları sarartıp kurutarak fotosentezi engeller.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Oberon (Bayer)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Spiromesifen"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Hasat Öncesi Potasyum Sülfat",
                "description": "Kapsüllerin homojen olgunlaşması ve depo ömrü.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Aflatoksin Riski (Aspergillus flavus)",
                "description": "Hasat ve kurutma sırasında nemden oluşan zehirli küf mantarı.",
                "commercialNames": [
                    "Kültürel Önlem (Hızlı Kurutma)"
                ]
            }
        ]
    },
    "MERCIMEK": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Çimlenme ve Kök Geliştirici Fosfor",
                "description": "Mercimeğin zayıf kök yapısını güçlendirmek için çıkışta Fosfor ve Çinko.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kök Çürüklüğü (Fusarium spp.)",
                "description": "Soğuk ve nemli topraklarda köklerin incelip esmerleşmesi.",
                "commercialNames": [
                    "Maxim XL (Syngenta)",
                    "Celest (Syngenta)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Metalaxyl-M"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Dar ve Geniş Yapraklı Otlar",
                "description": "Mercimek ot rekabetine çok zayıftır.",
                "commercialNames": [
                    "Stomp Aqua (BASF)",
                    "Linuron (Çeşitli)"
                ],
                "activeIngredients": [
                    "Pendimethalin",
                    "Linuron"
                ]
            }
        ],
        "DALLANMA": [
            {
                "type": "BESLEME",
                "name": "Yan Dal ve Hacim için Azot & Çinko",
                "description": "Mercimeğin çalılaşması, yan dal ve çiçek potansiyelini artırması için Azot ve Çinko.",
                "commercialNames": [
                    "İgsaş CAN %26",
                    "YaraVita Zintrac (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Amonyum Nitrat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Mercimek Antraknozu (Ascochyta lentis)",
                "description": "Gövde ve yapraklarda yuvarlak çökük kahverengi lekeler.",
                "commercialNames": [
                    "Mancozeb 80 WP",
                    "Score 250 EC (Syngenta)"
                ],
                "activeIngredients": [
                    "Mancozeb",
                    "Difenoconazole"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Dar Yapraklı Otlar (Yabani Yulaf vb.)",
                "description": "Yapraktan uygulanan dar yapraklı herbisitler.",
                "commercialNames": [
                    "Fusilade Max (Syngenta)",
                    "Targa Super (Nissan)"
                ],
                "activeIngredients": [
                    "Fluazifop-p-butyl",
                    "Quizalofop-p-ethyl"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Tutumu ve Nodül Aktivitesi için Molibden & Bor",
                "description": "Çiçeklerin dökülmemesi, bakla bağlaması ve kök nodüllerinin hava azotunu bağlaması.",
                "commercialNames": [
                    "YaraVita Molytrac (Yara)",
                    "Speedfol Bor (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Sodyum Molibdat",
                    "Borik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Mercimek Pası (Uromyces fabae)",
                "description": "Yapraklarda pas rengi püstüller ve yaprak dökümü.",
                "commercialNames": [
                    "Folicur (Bayer)",
                    "Score (Syngenta)"
                ],
                "activeIngredients": [
                    "Tebuconazole",
                    "Difenoconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Mercimek Hortumlu Böceği (Sitona crinitus)",
                "description": "Erginler yaprakları hilal şeklinde kemirir, larvalar kök nodüllerini yer.",
                "commercialNames": [
                    "Decis (Bayer)",
                    "Karate Zeon (Syngenta)"
                ],
                "activeIngredients": [
                    "Deltamethrin",
                    "Lambda-cyhalothrin"
                ]
            }
        ],
        "BAKLA_OLUSUMU": [
            {
                "type": "BESLEME",
                "name": "Bakla Dolumu için Potasyum Nitrat",
                "description": "Bakla içindeki mercimek tanelerinin iri ve dolgun olması.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Mercimek Tohum Böceği (Bruchus lentis)",
                "description": "Bakla içine yumurta bırakarak tanenin içinde kurtlanma yapar.",
                "commercialNames": [
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Deltamethrin"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Sarı Olum Dönemi Potasyum Sülfat",
                "description": "Tanelerin sertleşmesi ve kuruma.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            }
        ]
    },
    "SOYA": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Bakteri Aşılaması (Rhizobium japonicum) & Fosfor",
                "description": "Tohum ekiminde bakteri aşısı ve köklenme için MAP gübresi.",
                "commercialNames": [
                    "Rhizobium Kültürü",
                    "Novalon 10-52-10 (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Canlı Rhizobium Bakterisi",
                    "10-52-10 MAP"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fide Yanıklığı ve Kök Çürüklüğü",
                "description": "Çimlenen tohumun ve fidenin devrilmesi.",
                "commercialNames": [
                    "Maxim XL (Syngenta)",
                    "Vitavax (UPL)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Metalaxyl-M",
                    "Carboxin + Thiram"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Gövde ve Boğum Arası için Azot, Çinko ve Magnezyum",
                "description": "Soyanın boylanması, boğum sayısını artırması ve yaprak alanı için besleme.",
                "commercialNames": [
                    "Toros Üre %46",
                    "Epsom Tuzu (Magnezyum Sülfat)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "Üre",
                    "Magnezyum Sülfat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Geniş ve Dar Yapraklı Otlar",
                "description": "Soya tarlasında ot mücadelesi.",
                "commercialNames": [
                    "Pivot 100 (BASF)",
                    "Basagran (BASF)"
                ],
                "activeIngredients": [
                    "Imazethapyr",
                    "Bentazon"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Tutumu ve Döllenme için Bor, Molibden, Aminoasit",
                "description": "Çiçek dökümünü engellemek ve bakla sayısını maksimize etmek.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "YaraVita Molytrac",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Sodyum Molibdat",
                    "Aminoasit"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yeşilkurt ve Prodenya",
                "description": "Soya yapraklarını ve çiçek salkımlarını hızla tüketirler.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Radiant (Corteva)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinetoram"
                ]
            }
        ],
        "BAKLA": [
            {
                "type": "BESLEME",
                "name": "Bakla Büyümesi ve Çatlama Önleme için Kalsiyum Nitrat",
                "description": "Baklaların uzaması ve hücre duvarı sağlamlığı.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Soya Pası (Phakopsora pachyrhizi)",
                "description": "Yapraklarda kahverengi pas püstülleri ve erken yaprak dökümü.",
                "commercialNames": [
                    "Amistar (Syngenta)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Azoxystrobin",
                    "Tebuconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek ve Beyazsinek",
                "description": "Özsuyu emerek yaprakları kuruturlar.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Oberon (Bayer)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Spiromesifen"
                ]
            }
        ],
        "TANE_DOLUM": [
            {
                "type": "BESLEME",
                "name": "Tane İriliği, Protein ve Yağ Oranı için Potasyum",
                "description": "Bakla içindeki tohumların yağ ve protein oranını yükselten Potasyum.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Fizyolojik Olum Potasyum Sülfat",
                "description": "Baklaların sararıp kuruduğu hasat evresi.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            }
        ]
    },
    "KIMYON": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Kök Tutunması ve Rozet Oluşumu için Fosfor & Çinko",
                "description": "Kimyonun ilk dönem yavaş büyümesinde güçlü kök yapması için.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Zinc 15 (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "EDTA Çelatlı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kimyon Solgunluğu ve Kök Çürüklüğü (Fusarium oxysporum f.sp. cumini)",
                "description": "Kimyonun 1 numaralı felaketidir! Bitkilerin kökboğazından çürüyüp tarlada öbek öbek kuruması.",
                "commercialNames": [
                    "Tohum İlaçlaması (Maxim XL)",
                    "Trichoderma (Trianum)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Metalaxyl-M",
                    "Trichoderma harzianum"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Çıkış Öncesi Yabancı Ot Mücadelesi",
                "description": "Kimyon ot rekabetine dayanamaz.",
                "commercialNames": [
                    "Stomp Aqua (BASF)",
                    "Linuron"
                ],
                "activeIngredients": [
                    "Pendimethalin",
                    "Linuron"
                ]
            }
        ],
        "SAPA_KALKMA": [
            {
                "type": "BESLEME",
                "name": "Sap Uzaması ve Yan Dallanma için Denge NPK",
                "description": "Kimyonun dallanması ve çiçek şemsiyesi potansiyelini artırmak.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Megafol (Valagro)"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Deniz Yosunu ve Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kimyon Yanıklığı (Alternaria burnsii)",
                "description": "Sap ve yapraklarda kahverengi kararmalar.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Amistar (Syngenta)"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Azoxystrobin"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Şemsiye Çiçek Tutumu için Bor & Aminoasit",
                "description": "Şemsiye şeklindeki çiçeklerin tam dökülmeden tohum bağlaması.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Erysiphe cichoracearum)",
                "description": "Şemsiyelerde beyaz unsu örtü.",
                "commercialNames": [
                    "Kumulus (BASF)",
                    "Topas (Syngenta)"
                ],
                "activeIngredients": [
                    "Kükürt",
                    "Penconazole"
                ]
            }
        ],
        "TOHUM_BAGLAMA": [
            {
                "type": "BESLEME",
                "name": "Kimyon Tohumu Dolumu ve Uçucu Yağ Oranı (Potasyum)",
                "description": "Tohumların iç doldurması, dolgunlaşması ve uçucu yağ (aroma) oranının yükselmesi.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Hasat Öncesi Esmerleşme Gübrelemesi",
                "description": "Tohumların esmerleştiği ve kuruduğu dönem.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            }
        ]
    },
    "BIBER": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici, Fosfor ve Aminoasit İhtiyacı",
                "description": "Biber fidesinin dikim sonrası şokunu atlatması, hızlı kök patlaması yapması için yüksek Fosfor ve Aminoasit.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Radifarm (Valagro)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Serbest Aminoasitler",
                    "Deniz Yosunu"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kök Çürüklüğü / Çökerten (Pythium, Rhizoctonia)",
                "description": "Fide kök boğazının incelerek devrilmesi.",
                "commercialNames": [
                    "Previcur Energy (Bayer)",
                    "Tachigaren (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Propamocarb + Fosetyl-Al",
                    "Hymexazol"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Toprak Kurtları ve Yaprakbiti",
                "description": "Danaburnu ve Bozkurt fideleri keser; yaprakbitleri virüs bulaştırır.",
                "commercialNames": [
                    "Dursban 4 (Corteva)",
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Chlorpyrifos-ethyl",
                    "Acetamiprid"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Gövde ve Dallanma için Azot, Çinko ve Magnezyum",
                "description": "Biberin çatallaşması (dallanması), yaprak hacmini genişletmesi ve klorofil sentezi.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Epsom Tuzu (Magnezyum Sülfat)",
                    "YaraVita Zintrac (Yara)"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Magnezyum Sülfat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Biber Kök Boğazı Yanıklığı (Phytophthora capsici)",
                "description": "Biberin en tehlikeli hastalığıdır! Gövde toprağa yakın yerden siyahlaşır, bitki aniden tepeden aşağı kurur.",
                "commercialNames": [
                    "Ridomil Gold MZ (Syngenta)",
                    "Aliette (Bayer)",
                    "Acrobat Plus (BASF)"
                ],
                "activeIngredients": [
                    "Metalaxyl-M + Mancozeb",
                    "Fosetyl-Al",
                    "Dimethomorph + Mancozeb"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Leveillula taurica)",
                "description": "Yaprakların altında beyaz unsu tabaka, üstünde sarı lekeler.",
                "commercialNames": [
                    "Topas (Syngenta)",
                    "Kumulus (BASF)",
                    "Ortiva (Syngenta)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Kükürt",
                    "Azoxystrobin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yaprakbiti ve Beyazsinek",
                "description": "Özsuyu emer ve sarılık virüsleri taşır.",
                "commercialNames": [
                    "Confidor (Bayer)",
                    "Spiromesifen (Bayer)"
                ],
                "activeIngredients": [
                    "Imidacloprid",
                    "Spiromesifen"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Polen Tüpü ve Çiçek Tutumu için Bor, Çinko & Kalsiyum",
                "description": "Biber çiçeklerinin dökülmesini (çiçek silkmeyi) engellemek ve meyve tutumunu artırmak.",
                "commercialNames": [
                    "Speedfol Çinko-Bor (Doktor Tarsa)",
                    "YaraVita Bortrac (Yara)",
                    "YaraLiva Calcinit"
                ],
                "activeIngredients": [
                    "Çinko-Bor Süspansiyonu",
                    "Etanolamin Bor",
                    "Kalsiyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kurşuni Küf (Botrytis cinerea)",
                "description": "Çiçek taç yapraklarında gri-kahverengi küflenme ve çiçek dökümü.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Çiçek Tripsi (Frankliniella occidentalis)",
                "description": "Çiçek içinde polenleri yer, biber meyvelerinin kıvrık/şekilsiz olmasına yol açar.",
                "commercialNames": [
                    "Laser (Corteva)",
                    "Radiant (Corteva)"
                ],
                "activeIngredients": [
                    "Spinosad",
                    "Spinetoram"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Çiçek Burnu Çürüklüğü Önleme (Kalsiyum) & Potasyum",
                "description": "Biber meyvelerinin uç kısmının kararıp çürümesini önlemek için Kalsiyum; irileşme için Potasyum Nitrat.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Stopit (Yara)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum Klorür",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yeşilkurt (Helicoverpa armigera) ve Prodenya",
                "description": "Larvalar biber meyvesini delerek içine girer ve çürütür.",
                "commercialNames": [
                    "Avaunt 150 EC (FMC)",
                    "Proclaim (Syngenta)",
                    "Coragen (FMC)"
                ],
                "activeIngredients": [
                    "Indoxacarb",
                    "Emamectin benzoate",
                    "Chlorantraniliprole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek",
                "description": "Yaprakları kurutarak meyvelerin güneşte yanmasına (güneş yanıklığı) sebep olur.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Floramite (UPL)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Bifenazate"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Meyve Parlaklığı, Renk ve Et Kalınlığı için Potasyum Tiyosülfat",
                "description": "Kırmızı biberlerde (Kapiya/Salçalık) kıpkırmızı homojen renk ve et kalınlığı için Potasyum.",
                "commercialNames": [
                    "KTS (Tessenderlo Kerley)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Tiyosülfat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Hasat Öncesi Meyve Çürüklükleri",
                "description": "Alternaria ve Botrytis çürüklükleri.",
                "commercialNames": [
                    "Serenade (Bayer)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Bacillus subtilis",
                    "Fludioxonil + Cyprodinil"
                ]
            }
        ]
    },
    "HIYAR": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici Fosfor ve Deniz Yosunu",
                "description": "Hıyar fidesinin hızlı kök atması ve ilk yaprak yapısı.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Megafol (Valagro)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Deniz Yosunu ve Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fide Çökerteni (Pythium spp.)",
                "description": "Fidelerin sulama sonrası devrilip ölmesi.",
                "commercialNames": [
                    "Previcur Energy (Bayer)"
                ],
                "activeIngredients": [
                    "Propamocarb + Fosetyl-Al"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Hızlı Büyüme ve Kol Atma için Azot & Magnezyum",
                "description": "Hıyarın günde 10-15 cm uzadığı hızlı vejetatif evrede Azot ve Klorofil için Magnezyum.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Epsom Tuzu (Magnezyum Sülfat)"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yalancı Mildiyö (Pseudoperonospora cubensis)",
                "description": "Yaprakların üst yüzeyinde damarlarla sınırlandırılmış köşeli sarı lekeler, alt yüzeyde koyu morumsu mantar örtüsü.",
                "commercialNames": [
                    "Curzate R (Corteva)",
                    "Acrobat Plus (BASF)",
                    "Infinito (Bayer)"
                ],
                "activeIngredients": [
                    "Cymoxanil + Bakır",
                    "Dimethomorph + Mancozeb",
                    "Fluopicolide + Propamocarb"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Sphaerotheca fuliginea)",
                "description": "Yapraklar üzerinde un serpilmiş gibi beyaz pudra tabakası.",
                "commercialNames": [
                    "Topas (Syngenta)",
                    "Kumulus (BASF)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Kükürt"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek (Tetranychus urticae)",
                "description": "Hıyar yapraklarını sarartıp alt yüzeyde yoğun ağlar örer.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Oberon (Bayer)",
                    "Nissorun (Nippon)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Spiromesifen",
                    "Hexythiazox"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Dişi Çiçek Sayısı ve Tutum için Bor & Hümik Asit",
                "description": "Hıyarda dişi çiçek oranını ve meyve bağlama başarısını artırmak.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kurşuni Küf (Botrytis cinerea)",
                "description": "Çiçek uçlarında gri çürümeler.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Teldor (Bayer)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fenhexamid"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Çiçek Tripsi",
                "description": "Meyvede sararma, kıvrılma ve kanca şekli yapma.",
                "commercialNames": [
                    "Laser (Corteva)",
                    "Dicarzol (Gowan)"
                ],
                "activeIngredients": [
                    "Spinosad",
                    "Formetanate"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Şekil Bozukluğunu Önlemek için Kalsiyum & Potasyum",
                "description": "Hıyar meyvelerinin bel vermesini, incelmesini önlemek ve küt düzgün meyve için Kalsiyum ve Potasyum.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Köşeli Yaprak Lekesi (Pseudomonas lachrymans)",
                "description": "Yapraklarda ve meyvelerde baktiyerel su emmiş çökük lekeler ve damlamalar.",
                "commercialNames": [
                    "Cuprocol (Syngenta)",
                    "Kocide 2000"
                ],
                "activeIngredients": [
                    "Bakır Oksiklorür",
                    "Bakır Hidroksit"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Sürekli Hasatta Meyve İrileşmesi için Dengeli NPK (15-5-30)",
                "description": "Hıyar her gün veya günaşırı toplanır. Meyve sürekliliği için Potasyum ağırlıklı NPK.",
                "commercialNames": [
                    "Novalon 15-5-30 (Doktor Tarsa)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "15-5-30 NPK",
                    "Potasyum Tiyosülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Hasat Dönemi Mildiyö Mücadelesi",
                "description": "Kalıntı bırakmayan sıfır gün PHI ürünler.",
                "commercialNames": [
                    "Serenade (Bayer)",
                    "Revus (Syngenta)"
                ],
                "activeIngredients": [
                    "Bacillus subtilis",
                    "Mandipropamid"
                ]
            }
        ]
    },
    "PATLICAN": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Kök Uyarıcı ve Fosfor İhtiyacı",
                "description": "Patlıcan fidesinin güçlü kazık kök atması için Fosfor ve Aminoasit.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Radifarm (Valagro)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Kök Uyarıcı Peptitler"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kök Çürüklüğü (Pythium spp.)",
                "description": "Fide devrilmesi.",
                "commercialNames": [
                    "Previcur Energy (Bayer)"
                ],
                "activeIngredients": [
                    "Propamocarb + Fosetyl-Al"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Gövde ve Yaprak İri Yapısı için Azot, Çinko ve Demir",
                "description": "Patlıcanın kaba yaprak yapısı ve güçlü gövdesi için Azot, Şelatlı Demir ve Çinko.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Sequestrene (Syngenta)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "EDDHA Demir",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Erken Yanıklık (Alternaria solani) ve Verticillium",
                "description": "Yapraklarda koyu lekeler ve aniden tek taraflı yaprak solmaları.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Trichoderma (Trianum)"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Trichoderma harzianum"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek (Tetranychus spp.)",
                "description": "Patlıcan kırmızı örümceğe en hassas sebzedir! Yaprakları sarartıp pas rengine çevirir.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Floramite (UPL)",
                    "Kanemite (Agro-Kanesho)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Bifenazate",
                    "Acequinocyl"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Beyazsinek ve Yaprakbiti",
                "description": "Yaprak altlarını kaplayan emiciler.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Oberon (Bayer)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Spiromesifen"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Silkelemesini Önlemek için Bor & Çinko",
                "description": "Patlıcan çiçeklerinin sararıp dökülmesini engellemek.",
                "commercialNames": [
                    "Speedfol Çinko-Bor (Doktor Tarsa)",
                    "YaraVita Bortrac"
                ],
                "activeIngredients": [
                    "Çinko-Bor Süspansiyonu",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kurşuni Küf (Botrytis cinerea)",
                "description": "Çiçek salkımlarında gri küf.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Çiçek Tripsi",
                "description": "Çiçek içi zararlı.",
                "commercialNames": [
                    "Laser (Corteva)"
                ],
                "activeIngredients": [
                    "Spinosad"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Çatlaması ve Kararmaya Karşı Kalsiyum & Potasyum",
                "description": "Patlıcan meyvelerinin et dolgunluğu ve parlaklığı için Kalsiyum ve Potasyum.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yeşilkurt (Helicoverpa armigera)",
                "description": "Meyveyi delerek çürüten kurtlar.",
                "commercialNames": [
                    "Avaunt (FMC)",
                    "Coragen (FMC)"
                ],
                "activeIngredients": [
                    "Indoxacarb",
                    "Chlorantraniliprole"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Parlak Koyu Mor Renk ve Et Dolgunluğu için Potasyum Tiyosülfat",
                "description": "Hasatta simsiyah parlak patlıcan rengi ve raf ömrü.",
                "commercialNames": [
                    "KTS (Tessenderlo Kerley)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Tiyosülfat",
                    "Potasyum Sülfat"
                ]
            }
        ]
    },
    "KARPUZ": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Kök ve Fide Tutunması için Fosfor & Hümik Asit",
                "description": "Şaşırtılan karpuz fidelerinin hızlı saçak kök yapması için.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fide Çökerteni (Propamocarb)",
                "description": "Fide kök boğazı çürümesi.",
                "commercialNames": [
                    "Previcur Energy (Bayer)"
                ],
                "activeIngredients": [
                    "Propamocarb + Fosetyl-Al"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Kol Atma ve Yapraklanma için Azot & Çinko",
                "description": "Karpuz kollarının tarlayı hızla kapatması ve yaprak alanının artması için Azot, Çinko ve Magnezyum.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "YaraVita Zintrac",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Sıvı Çinko",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Karpuz Antraknozu (Colletotrichum orbiculare)",
                "description": "Yapraklarda ve sapta dairesel çökük siyah lekeler.",
                "commercialNames": [
                    "Dithane M-45 (Corteva)",
                    "Score 250 EC (Syngenta)",
                    "Amistar (Syngenta)"
                ],
                "activeIngredients": [
                    "Mancozeb",
                    "Difenoconazole",
                    "Azoxystrobin"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fusaryum Solgunluğu (Fusarium oxysporum f.sp. niveum)",
                "description": "Sıcak saatlerde kol uçlarının pörsümesi ve bitkinin aniden kuruması.",
                "commercialNames": [
                    "Kültürel Önlem (Aşılı Fide)",
                    "Trianum (Koppert)"
                ],
                "activeIngredients": [
                    "Trichoderma harzianum"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yaprakbiti ve Kırmızı Örümcek",
                "description": "Kol uçlarında emgi zararı.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Agrimec (Syngenta)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Abamectin"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Dişi Çiçek Tutumu ve Döllenme için Bor & Aminoasit",
                "description": "Karpuz kollarındaki dişi çiçeklerin meyveye dönüşmesi.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Podosphaera xanthii)",
                "description": "Yapraklarda beyaz unsu örtü.",
                "commercialNames": [
                    "Kumulus (BASF)",
                    "Topas (Syngenta)"
                ],
                "activeIngredients": [
                    "Kükürt",
                    "Penconazole"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Yarma/Çatlamasını Önlemek için Kalsiyum & Potasyum",
                "description": "Karpuzların hızlı irileşirken kabuk çatlaması yapmaması için Kalsiyum Nitrat; kilo alması için Potasyum Nitrat.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yalancı Mildiyö (Pseudoperonospora cubensis)",
                "description": "Yapraklarda sarı köşeli lekeler ve hızlı kuruma.",
                "commercialNames": [
                    "Acrobat Plus (BASF)",
                    "Ridomil Gold MZ (Syngenta)"
                ],
                "activeIngredients": [
                    "Dimethomorph + Mancozeb",
                    "Metalaxyl-M + Mancozeb"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yeşilkurt (Helicoverpa armigera)",
                "description": "Karpuz kabuğunu kemirerek yaralar açar.",
                "commercialNames": [
                    "Avaunt (FMC)",
                    "Coragen (FMC)"
                ],
                "activeIngredients": [
                    "Indoxacarb",
                    "Chlorantraniliprole"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Şeker Oranı (Brix), Kırmızı Renk ve Kabuk Dayanımı için Potasyum",
                "description": "Karpuz içinin kıpkırmızı, gözenekli (kristalize), yüksek şekerli (Brix 12+) olması.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat"
                ]
            }
        ]
    },
    "KAVUN": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Kök Uyarıcı ve Fosfor",
                "description": "Kavun fidesi kökleşmesi.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kök Çürüklüğü",
                "description": "Fide devrilmesi.",
                "commercialNames": [
                    "Previcur Energy (Bayer)"
                ],
                "activeIngredients": [
                    "Propamocarb"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Kol Uzaması ve Gövde Kalınlaşması için Azot & Magnezyum",
                "description": "Kavun bitkisinin güçlü vejetatif yapı kazanması.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kavun Küllemesi (Podosphaera xanthii)",
                "description": "Yapraklarda beyaz unlu görünüm. Kavunun tatlanmasını engeller.",
                "commercialNames": [
                    "Topas (Syngenta)",
                    "Kumulus (BASF)",
                    "Ortiva (Syngenta)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Kükürt",
                    "Azoxystrobin"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fusaryum Solgunluğu",
                "description": "Kollarda aniden kuruma.",
                "commercialNames": [
                    "Aşılı Fide Kullanımı",
                    "Trianum"
                ],
                "activeIngredients": [
                    "Trichoderma harzianum"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Döllenme ve Meyve Bağlama için Bor & Çinko",
                "description": "Çiçek dökümünü engellemek.",
                "commercialNames": [
                    "Speedfol Çinko-Bor (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Çinko-Bor Süspansiyonu"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Çatlama Önleme ve Meyve İrileşmesi için Kalsiyum & Potasyum",
                "description": "Kavunda dilimlenme ve çıtır kabuk sağlamlığı için Kalsiyum ve Potasyum.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yalancı Mildiyö (Pseudoperonospora cubensis)",
                "description": "Yaprak kurumaları.",
                "commercialNames": [
                    "Acrobat Plus (BASF)",
                    "Curzate R (Corteva)"
                ],
                "activeIngredients": [
                    "Dimethomorph",
                    "Cymoxanil + Bakır"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kavun Sineği (Myiopardalis pardalina)",
                "description": "Kavun meyvesine yumurta bırakır, larvalar içini kurtlandırır ve kokutur.",
                "commercialNames": [
                    "Decis (Bayer)",
                    "Success (Corteva)"
                ],
                "activeIngredients": [
                    "Deltamethrin",
                    "Spinosad Yem"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Yüksek Brix (Şeker Oranı), Çıtır Doku ve Aroma için Sıvı Potasyum",
                "description": "Kavunun kendine özgü tat ve kokusunun (aroma) zirve yapması.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat"
                ]
            }
        ]
    },
    "CILEK": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Dikim Sonrası Kök Tutunması için Yüksek Fosfor & Hümik Asit",
                "description": "Frigo veya taze çilek fidelerinin hızlı kök uyumu.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kırmızı Kök Çürüklüğü (Phytophthora fragariae)",
                "description": "Köklerin iç kısmının kırmızımsı silindir şeklinde çürümesi ve fidenin kuruması.",
                "commercialNames": [
                    "Aliette (Bayer)",
                    "Previcur Energy (Bayer)"
                ],
                "activeIngredients": [
                    "Fosetyl-Al",
                    "Propamocarb + Fosetyl-Al"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Taç Gelişimi ve Yapraklanma için Azot, Demir ve Çinko",
                "description": "Çilek tacının çoğalması, yaprak klorozu (sararma) olmaması için Şelatlı Demir ve Azot.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Sequestrene (Syngenta)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "EDDHA Demir",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Çilek Yaprak Lekesi (Mycosphaerella fragariae)",
                "description": "Yapraklarda mor kenarlı beyaz merkezli lekeler (kuş gözü).",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Dithane M-45 (Corteva)"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Mancozeb"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Sphaerotheca macularis)",
                "description": "Yaprakların kenarlarının yukarı doğru kıvrılması ve alt yüzde beyaz toz.",
                "commercialNames": [
                    "Topas (Syngenta)",
                    "Kumulus (BASF)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Kükürt"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek (Tetranychus urticae)",
                "description": "Çilekte yaprakları bronzlaştırıp verimi tamamen bitirir.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Floramite (UPL)",
                    "Nissorun (Nippon)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Bifenazate",
                    "Hexythiazox"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Salkımlarının Güçlenmesi için Bor, Çinko, Aminoasit",
                "description": "Çiçeklenme yoğunluğunu ve polen kalitesini artırmak.",
                "commercialNames": [
                    "Speedfol Çinko-Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Çinko-Bor Süspansiyonu",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kurşuni Küf (Botrytis cinerea)",
                "description": "Çileğin en büyük düşmanıdır! Çiçek ve taze meyvelerde gri pamuksu çürüme.",
                "commercialNames": [
                    "Switch 62.5 WG (Syngenta)",
                    "Signum (BASF)",
                    "Teldor (Bayer)",
                    "Cantus (BASF)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Cyprodinil",
                    "Boscalid + Pyraclostrobin",
                    "Fenhexamid",
                    "Boscalid"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Çiçek Tripsi (Frankliniella occidentalis)",
                "description": "Meyvelerde bronzlaşma, sertleşme ve şekil bozukluğu yapar.",
                "commercialNames": [
                    "Laser (Corteva)",
                    "Spintor (Corteva)"
                ],
                "activeIngredients": [
                    "Spinosad"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Sertliği ve Şekil Düzgünlüğü için Kalsiyum Nitrat",
                "description": "Çilek meyvesinin yumuşamasını önlemek ve raf ömrü sağlamak.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Stopit (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Çilek Akarı (Phytonemus pallidus)",
                "description": "Genç taze yaprakları büzüştürür ve meyveleri şekilsizleştirir.",
                "commercialNames": [
                    "Agrimec (Syngenta)"
                ],
                "activeIngredients": [
                    "Abamectin"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Kırmızı Renk, Aroma ve Depo Ömrü için Sıvı Potasyum Tiyosülfat",
                "description": "Çileğin şekerli, kokulu ve parlak kırmızı renk alması.",
                "commercialNames": [
                    "KTS (Tessenderlo Kerley)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Tiyosülfat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Hasat İçi Kurşuni Küf Mücadelesi",
                "description": "Kalıntısız biyolojik mücadele.",
                "commercialNames": [
                    "Serenade (Bayer)"
                ],
                "activeIngredients": [
                    "Bacillus subtilis"
                ]
            }
        ]
    },
    "BAMYA": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Çimlenme ve Kök Gelişimi için Fosfor & Çinko",
                "description": "Bamya tohumunun sert kabuğunu kırıp çimlenmesinden sonra köklenmesi.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Zinc 15"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "EDTA Çelatlı Çinko"
                ]
            }
        ],
        "GELISIM": [
            {
                "type": "BESLEME",
                "name": "Hızlı Boylanma ve Gövde için Azot & Magnezyum",
                "description": "Bamyanın vejetatif büyümesi.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Erysiphe cichoracearum)",
                "description": "Bamya yapraklarında beyaz unlanma.",
                "commercialNames": [
                    "Kumulus (BASF)",
                    "Topas (Syngenta)"
                ],
                "activeIngredients": [
                    "Kükürt",
                    "Penconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Bamya Yaprakbiti ve Beyazsinek",
                "description": "Sürgün uçlarında emgi zararı.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Acetamiprid"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Sürekli Çiçek Verme için Bor & Aminoasit",
                "description": "Aşağıdan yukarı çiçeklenme.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            }
        ],
        "MEYVE": [
            {
                "type": "BESLEME",
                "name": "Taze Meyve Dokusu ve Kartlaşmayı Geciktirmek için Kalsiyum",
                "description": "Bamyaların çabuk liflenip kartlaşmasını engellemek.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Yeşilkurt (Helicoverpa armigera)",
                "description": "Bamya meyvelerini deler.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Avaunt (FMC)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Indoxacarb"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Sürekli Hasatta Verim Devamlılığı için Potasyum & Aminoasit",
                "description": "Günlük bamya toplamada güçten düşmemesi için.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Megafol (Valagro)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Deniz Yosunu ve Aminoasit"
                ]
            }
        ]
    },
    "BAG": {
        "UYANMA": [
            {
                "type": "BESLEME",
                "name": "Gözlerin Uyanması ve Kök Aktivitesi için Çinko & Bor",
                "description": "İlkbaharda asma suyunun yürümesi (ağlama) ve gözlerin düzgün uyanması için Çinko ve Bor.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "Speedfol Bor (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Ölü Kol (Phomopsis viticola)",
                "description": "Bahar sürgünlerinin tabanında siyah çatlaklar ve lekeler.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Dithane M-45 (Corteva)",
                    "Folpan (Adama)"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Mancozeb",
                    "Folpet"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Bağ Uyuzu (Eriophyes vitis)",
                "description": "Gözler uyanırken yaprak üstünde kabarcıklar (siğil) oluşturur.",
                "commercialNames": [
                    "Kumulus DF (BASF)"
                ],
                "activeIngredients": [
                    "Kükürt"
                ]
            }
        ],
        "SURGUN": [
            {
                "type": "BESLEME",
                "name": "Sürgün U uzaması ve Somak Gelişimi için Azot, Demir & Çinko",
                "description": "Sürgünlerin güçlenmesi, sararmanın (kloroz) önlenmesi için Şelatlı Demir (Fe) ve Azot.",
                "commercialNames": [
                    "Sequestrene 138 Fe (Syngenta)",
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "EDDHA Demir",
                    "20-20-20 NPK",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Bağ Mildiyösü (Plasmopara viticola)",
                "description": "Yaprak üstünde yağ lekesi, alt yüzeyde beyaz küf ve somaklarda kuruma.",
                "commercialNames": [
                    "Ridomil Gold MZ (Syngenta)",
                    "Acrobat Plus (BASF)",
                    "Mikal Flash (Bayer)"
                ],
                "activeIngredients": [
                    "Metalaxyl-M + Mancozeb",
                    "Dimethomorph + Mancozeb",
                    "Fosetyl-Al + Folpet"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Bağ Küllemesi (Uncinula necator)",
                "description": "Sürgünlerde ve yapraklarda unlu beyaz tabaka.",
                "commercialNames": [
                    "Topas (Syngenta)",
                    "Kumulus (BASF)",
                    "Collis (BASF)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Kükürt",
                    "Boscalid + Kresoxim-methyl"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Bağ Salkım Güvesi (Lobesia botrana) - 1. Döl",
                "description": "Çiçek tomurcuklarını ve somakları ağ ile örerek yer.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Laser (Corteva)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinosad",
                    "Deltamethrin"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Tutumu ve Silkmeyi Önlemek için Bor & Çinko",
                "description": "Somağın tam çiçeklenmesinde silkmeyi engellemek ve boncuklanmanın önüne geçmek.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Borocal (Tradecorp)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Kalsiyum-Bor Kompleksi",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Bağ Küllemesi (Çiçek İlaçlaması)",
                "description": "Çiçek döneminde külleme teli yakarsa salkım tamamen yok olur.",
                "commercialNames": [
                    "Vivando (BASF)",
                    "Flint (Bayer)"
                ],
                "activeIngredients": [
                    "Metrafenone",
                    "Trifloxystrobin"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Koruk İrileşmesi ve Tane İriliği için Kalsiyum & Gibberellin (Çekirdeksiz)",
                "description": "Saçma iriliğindeki korukların büyümesi ve tane dökülmemesi için Kalsiyum Nitrat.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Stopit (Yara)",
                    "Progibb (Sumitomo - Sofra Üzüm)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum",
                    "Gibberellic Acid (GA3)"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kurşuni Küf (Botrytis cinerea)",
                "description": "Koruk döneminde taneler arasına yerleşen çürüklük mantarı.",
                "commercialNames": [
                    "Switch (Syngenta)",
                    "Cantus (BASF)",
                    "Teldor (Bayer)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Cyprodinil",
                    "Boscalid",
                    "Fenhexamid"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Salkım Güvesi - 2. Döl ve Bağ Unlubiti",
                "description": "Korukları deler, unlubit salkımda yapışkan ballık yapar.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Movento (Bayer - Unlubit)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spirotetramat"
                ]
            }
        ],
        "BEN_DUSME": [
            {
                "type": "BESLEME",
                "name": "Ben Düşme (Veraison), Şeker (Brix) ve Renk için Potasyum",
                "description": "Tanelerin yumuşadığı, renk aldığı (sarı/kırmızı/siyah) ve şekerlendiği evrede yoğun Potasyum.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kurşuni Küf (Hasat Öncesi)",
                "description": "Tanelerin patlayarak çürümesi.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Kalibre, Albeni ve Depo Ömrü için Potasyum Sülfat",
                "description": "Sofralık ve kurutmalık üzümde kalite ve randıman.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Salkım Güvesi - 3. Döl",
                "description": "Olgun üzümleri delerek sirke sineklerini çeker.",
                "commercialNames": [
                    "Laser (Corteva - Kalıntısız)"
                ],
                "activeIngredients": [
                    "Spinosad"
                ]
            }
        ]
    },
    "ELMA": {
        "TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Göz Kabarması ve Fare Kulağı Döneminde Çinko & Bor",
                "description": "Elma ağacının kış uykusundan güçlü uyanması ve ilk yeşil uçlar için Çinko ve Bor.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "YaraVita Bortrac (Yara)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor",
                    "Hümik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Elma Karalekesi (Venturia inaequalis) - Birincil Enfeksiyon",
                "description": "Elmanın 1 numaralı hastalığı! Yaprak ve sürgünlerde kadifemsi zeytin yeşili/siyah lekeler.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Copper Count N",
                    "Dithane M-45 (Corteva)",
                    "Delan 700 (BASF)"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Mancozeb",
                    "Dithianon"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek Kış Yumurtaları ve Kabuklubitler",
                "description": "Tomurcuk uyanmadan önce kışlayan zararlılara karşı yağlama.",
                "commercialNames": [
                    "Yazlık / Kışlık Beyaz Yağlar"
                ],
                "activeIngredients": [
                    "Mineral Yağlar"
                ]
            }
        ],
        "PEMBE_TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Çiçek Kalitesi ve Soğuk Stresi için Aminoasit & Deniz Yosunu",
                "description": "Pembe tomurcuk evresinde ilkbahar geç donlarına dayanıklılık ve çiçek sağlığı.",
                "commercialNames": [
                    "Isabion (Syngenta)",
                    "Megafol (Valagro)",
                    "Speedfol Bor"
                ],
                "activeIngredients": [
                    "Aminoasitler",
                    "Deniz Yosunu",
                    "Borik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Elma Karalekesi (Pembe Tomurcuk Dönemi)",
                "description": "Çiçek sapı ve çanak yapraklarda karaleke bulaşmasını önleme.",
                "commercialNames": [
                    "Chorus 50 WG (Syngenta)",
                    "Score 250 EC (Syngenta)",
                    "Mythos (Bayer)"
                ],
                "activeIngredients": [
                    "Cyprodinil",
                    "Difenoconazole",
                    "Pyrimethanil"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Elma Küllemesi (Podosphaera leucotricha)",
                "description": "Taze sürgün uçlarında gümüşi beyaz örtü (unlu sürgünler).",
                "commercialNames": [
                    "Topas 100 EC (Syngenta)",
                    "Kumulus (BASF)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Kükürt"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Elma Yeşil Yaprakbiti (Aphis pomi) ve Kırmızı Örümcek",
                "description": "Taze yaprak kıvrılmaları.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Confidor (Bayer)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Imidacloprid"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Polen Canlılığı ve Döllenme için Bor & Çinko",
                "description": "Tam çiçeklenmede meyve tutum oranını artırmak.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Borocal (Tradecorp)"
                ],
                "activeIngredients": [
                    "Sıvı Bor",
                    "Kalsiyum-Bor Kompleksi"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Ateş Yanıklığı (Erwinia amylovora)",
                "description": "Elma ve armudun en tehlikeli bakteriyel hastalığı! Çiçekler aniden siyahlaşır, sürgünler baston gibi bükülerek yanmış görünüm alır.",
                "commercialNames": [
                    "Serenade ASO (Bayer)",
                    "Aliette (Bayer)",
                    "Bakır Hidroksit (Düşük Doz)"
                ],
                "activeIngredients": [
                    "Bacillus subtilis",
                    "Fosetyl-Al",
                    "Bakır Hidroksit"
                ]
            }
        ],
        "TAÇ_YAPRAK_DOKUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Tutumu ve Acı Benek Önleme için Kalsiyum Nitrat",
                "description": "Çiçek dökümünden hemen sonra meyvede acı benek (Bitter Pit) olmaması için Kalsiyum.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Stopit (Yara)",
                    "Wuxal Calcium"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum Klorür"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Elma Karalekesi (Meyve Tutum Dönemi)",
                "description": "Küçük meyvelerde karaleke tutmasını önlemek.",
                "commercialNames": [
                    "Flint 50 WG (Bayer)",
                    "Bellis (BASF)",
                    "Captan 80 WG"
                ],
                "activeIngredients": [
                    "Trifloxystrobin",
                    "Boscalid + Pyraclostrobin",
                    "Captan"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Elma İçkurdu (Cydia pomonella) - 1. Döl",
                "description": "Elmanın 1 numaralı zararlısı! Larvalar meyveyi delerek çekirdeğe kadar girer.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Radiant (Corteva)",
                    "Voliam Targo (Syngenta)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinetoram",
                    "Abamectin + Chlorantraniliprole"
                ]
            }
        ],
        "MEYVE_GELISIMI": [
            {
                "type": "BESLEME",
                "name": "Meyve İrileşmesi ve Kalite için Potasyum & Kalsiyum",
                "description": "Ceviz iriliğindeki elmaların büyümesi, gevrek dokusu ve Kalsiyum yüklemesi.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "Stopit (Yara)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Sıvı Kalsiyum",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Elma İçkurdu - 2. Döl ve Kırmızı Örümcek",
                "description": "Yazın meyve del kurdu ve yaprakları bronzlaştıran kırmızı örümcekler.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Envidor (Bayer)",
                    "Kanemite (Agro-Kanesho)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spirodiclofen",
                    "Acequinocyl"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Renklenme (Kırmızı Elmalarda), Brix ve Soğuk Depo Ömrü",
                "description": "Elmaların kütür kütür sert kalması, soğuk depoda 8-10 ay dayanması ve kırmızı çeşitlerde kaplama renk için Potasyum.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Depo Çürüklükleri (Penicillium expansum & Botrytis)",
                "description": "Depolama sırasında meyve çürümeleri.",
                "commercialNames": [
                    "Geoxe (Syngenta)",
                    "Scholar (Syngenta)"
                ],
                "activeIngredients": [
                    "Fludioxonil"
                ]
            }
        ]
    },
    "ARMUT": {
        "TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Uyanma Öncesi Çinko ve Bor Dozu",
                "description": "Armut tomurcuklarının uyanması ve polen gözü sağlamlığı.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "YaraVita Bortrac (Yara)"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Armut Karalekesi (Venturia pirina)",
                "description": "Yaprak ve meyvede zeytin yeşili karaleke lekeleri.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Dodine 65 WP",
                    "Dithane M-45 (Corteva)"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Dodine",
                    "Mancozeb"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Polen Tüpü ve Çiçek Döllenmesi için Bor & Aminoasit",
                "description": "Armutta çiçek tutumunu artırmak.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Ateş Yanıklığı (Erwinia amylovora)",
                "description": "Armudun en büyük felaketidir! Çiçekler siyahlaşır, sürgünler baston şeklinde kıvrılıp yanar.",
                "commercialNames": [
                    "Serenade ASO (Bayer)",
                    "Aliette (Bayer)",
                    "Kocide 2000 (Bakır Hidroksit)"
                ],
                "activeIngredients": [
                    "Bacillus subtilis",
                    "Fosetyl-Al",
                    "Bakır Hidroksit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Çiçek Monilyası",
                "description": "Çiçek yanıklığı.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Tebuconazole"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Tebuconazole"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Tutumu ve Taş Hücre Önleme için Kalsiyum & Çinko",
                "description": "Armut meyvelerinde taşlaşmayı önlemek ve hücre dokusunu güçlendirmek için Kalsiyum.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Stopit (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Armut Psillidi (Cacopsylla pyri)",
                "description": "Armudun en tehlikeli zararlısıdır! Nymphler yoğun tatlımsı sıvı (ballık) salgılar, füsamjin mantarı geliştirir, ağacı siyahlaştırır ve yaprak döker.",
                "commercialNames": [
                    "Movento 100 SC (Bayer)",
                    "Agrimec (Syngenta)",
                    "Envidor (Bayer)"
                ],
                "activeIngredients": [
                    "Spirotetramat",
                    "Abamectin",
                    "Spirodiclofen"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Armut İçkurdu (Cydia pomonella)",
                "description": "Meyveyi delip çekirdeğe girer.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Radiant (Corteva)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinetoram"
                ]
            }
        ],
        "MEYVE_GELISIMI": [
            {
                "type": "BESLEME",
                "name": "Meyve İrileşmesi ve Kalite için Potasyum & Kalsiyum",
                "description": "Armutların sulu, gevrek ve iri olması için Potasyum.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "Stopit (Yara)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Sıvı Kalsiyum",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Armut Karalekesi ve Septoria",
                "description": "Yaprak ve meyve lekeleri.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Captan 80 WG"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Captan"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Armut Psillidi 2. ve 3. Döl",
                "description": "Yazın ballık yapan psillid mücadelesi.",
                "commercialNames": [
                    "Movento (Bayer)",
                    "Pyriproxyfen"
                ],
                "activeIngredients": [
                    "Spirotetramat",
                    "Pyriproxyfen"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Meyve Tatlılığı (Brix) ve Soğuk Depo Dayanımı",
                "description": "Armudun soğuk hava deposunda Karartma yapmadan uzun süre dayanabilmesi.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Depo Çürüklükleri",
                "description": "Penicillium çürüklükleri.",
                "commercialNames": [
                    "Scholar (Syngenta)"
                ],
                "activeIngredients": [
                    "Fludioxonil"
                ]
            }
        ]
    },
    "SEFTALI": {
        "TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Uyanma Öncesi Çinko & Bor",
                "description": "Şeftali ve kayısı gözlerinin uyanması.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "Speedfol Bor"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Şeftali Yaprak Kıvırcıklığı / Klok (Taphrina deformans)",
                "description": "Bahar başlangıcında yaprakların büzüşmesi, kırmızımsı etlenmesi ve dökülmesi.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Pomarsol Forte (Bayer)",
                    "Captan 80 WG"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Thiram",
                    "Captan"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Bakteriyel Leke (Xanthomonas)",
                "description": "Yapraklarda saçma deliği gibi delikler.",
                "commercialNames": [
                    "Kocide 2000 (Bakır Hidroksit)"
                ],
                "activeIngredients": [
                    "Bakır Hidroksit"
                ]
            }
        ],
        "PEMBE_TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Çiçek Açımı Hazırlığı için Aminoasit & Deniz Yosunu",
                "description": "Çiçeklerin don stresine dayanması.",
                "commercialNames": [
                    "Isabion (Syngenta)",
                    "Megafol (Valagro)"
                ],
                "activeIngredients": [
                    "Aminoasit",
                    "Deniz Yosunu"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Çiçek Monilyası (Monilinia laxa)",
                "description": "Şeftali ve kayısının 1 numaralı çiçek hastalığı! Çiçeklerkuruyup gamzeli sürgünlerde kurutma yapar.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Chorus (Syngenta)",
                    "Tebuconazole"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Cyprodinil",
                    "Tebuconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Şeftali Yaprakbiti (Myzus persicae)",
                "description": "Tomurcuk yapraklarını kıvırır.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Confidor (Bayer)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Imidacloprid"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Tam Çiçeklenmede Bor Takviyesi",
                "description": "Polen canlılığı ve tutumu.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Borik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Monilya Koruyucu İlaçlama",
                "description": "Çiçek dökümünde 2. monilya uygulaması.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Çağla Döneminde Kalsiyum ve Çinko",
                "description": "Meyve sertliği ve kabuk sağlamlığı.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Doğu Meyvegüvesi (Grapholita molesta)",
                "description": "Taze sürgün uçlarını ve taze çağlaları deler.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Radiant (Corteva)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinetoram"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Şeftali Güvesi (Anarsia lineatella)",
                "description": "Sürgün ve meyve zararlısı.",
                "commercialNames": [
                    "Avaunt (FMC)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Indoxacarb",
                    "Deltamethrin"
                ]
            }
        ],
        "MEYVE_GELISIMI": [
            {
                "type": "BESLEME",
                "name": "Meyve İrileşmesi ve Kızarması için Potasyum & Magnezyum",
                "description": "Şeftali ve nektarinlerin kütle alması, renklenmesi ve şekerlenmesi.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "SoluPotasse (Tessenderlo)",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Potasyum Sülfat",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Sphaerotheca pannosa)",
                "description": "Meyve kabuğunda beyaz unlu lekeler.",
                "commercialNames": [
                    "Topas (Syngenta)",
                    "Kumulus (BASF)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Kükürt"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek ve Doğu Meyvegüvesi",
                "description": "Meyve kurdu ve yaprak zararlısı.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Coragen (FMC)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Chlorantraniliprole"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Aromatik Tat, Parlak Renk ve İhracat Kalitesi için Potasyum",
                "description": "Şeftalinin tam şekerlenmesi ve yola dayanması.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Meyve Monilyası (Monilinia fructigena)",
                "description": "Olgun meyvede kahverengi halkalı çürüklük.",
                "commercialNames": [
                    "Teldor (Bayer)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Fenhexamid",
                    "Fludioxonil + Cyprodinil"
                ]
            }
        ]
    },
    "KIRAZ": {
        "TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Erken Uyanma Çinko ve Bor Dozu",
                "description": "Kiraz tomurcuklarının uyanması.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "Speedfol Bor"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Borik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Bakteriyel Kanser ve Zamklanma (Pseudomonas syringae)",
                "description": "Gövde ve dallarda siyah kanser yaraları ve sarı-kahverengi zamk akıntısı.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Kocide 2000 (Bakır Hidroksit)"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Bakır Hidroksit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yaprak Delen / Çil (Stigmina carpophila)",
                "description": "Yapraklarda saçma deliği lekeleri.",
                "commercialNames": [
                    "Captan 80 WG",
                    "Dithane M-45 (Corteva)"
                ],
                "activeIngredients": [
                    "Captan",
                    "Mancozeb"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Tutumu ve Döllenme için Bor & Aminoasit",
                "description": "Kirazda çiçek silkmeyi engellemek.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Çiçek Monilyası (Monilinia laxa)",
                "description": "Kirazın en büyük düşmanıdır! Çiçekleri kurutup saman gibi yapar.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)",
                    "Tebuconazole"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil",
                    "Tebuconazole"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Nohut Büyüklüğünde Meyve Çatlamasını Önlemek için Kalsiyum",
                "description": "Kirazda yağmur çatlamasını önlemek için folyar Kalsiyum yüklemesi.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Wuxal Calcium",
                    "Stopit (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum Klorür"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yaprak Delen / Çil",
                "description": "Meyvede çil lekesi.",
                "commercialNames": [
                    "Captan 80 WG"
                ],
                "activeIngredients": [
                    "Captan"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Siyah Kiraz Yaprakbiti (Myzus cerasi)",
                "description": "Sürgün uçlarındaki yaprakları büzüştürür ve siyahlaştırır.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Confidor (Bayer)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Imidacloprid"
                ]
            }
        ],
        "MEYVE_GELISIMI": [
            {
                "type": "BESLEME",
                "name": "Kalibre (İrilik), Sertlik ve Ben Düşme için Potasyum Nitrat",
                "description": "Kirazın 28-30+ mm kalibreye ulaşması, et sertliği ve rengi.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Meyve Monilyası",
                "description": "Meyve çürüklüğü.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Teldor (Bayer)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fenhexamid"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kiraz Sineği (Rhagoletis cerasi)",
                "description": "Kirazda kurtlanmanın sebebidir! Yumurtasını meyveye bırakır, vuruk yapar.",
                "commercialNames": [
                    "Success 0.24 CB (Corteva - Spinosad Yem)",
                    "Mospilan (Sumi Agro)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Spinosad Yem",
                    "Acetamiprid",
                    "Deltamethrin"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "İhracat Kalitesi, Çatlamama ve Sap Yeşilliği için Sıvı Potasyum & Kalsiyum",
                "description": "Kiraz sapının kurumaması (yeşil kalması) ve sert meyve.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Borocal (Tradecorp)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Kalsiyum-Bor Kompleksi"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kiraz Sineği Son Döl Mücadelesi",
                "description": "Kalıntısız ilaçlama.",
                "commercialNames": [
                    "Laser (Corteva)"
                ],
                "activeIngredients": [
                    "Spinosad"
                ]
            }
        ]
    },
    "NARENCIYE": {
        "SURGUN": [
            {
                "type": "BESLEME",
                "name": "Bahar Uyanması için Çinko, Demir ve Azot",
                "description": "Narenciye ağaçlarında sararmanın (kloroz) önlenmesi ve güçlü bahar sürgünü.",
                "commercialNames": [
                    "Sequestrene 138 Fe (Syngenta)",
                    "YaraVita Zintrac",
                    "Novalon 20-20-20"
                ],
                "activeIngredients": [
                    "EDDHA Demir",
                    "Sıvı Çinko",
                    "20-20-20 NPK"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Uçkurutan (Phoma tracheiphila)",
                "description": "Özellikle limonlarda dal uçlarından geriye doğru kuruma ve dal kesitinde turuncu-kırmızı renk değişimi.",
                "commercialNames": [
                    "Kocide 2000 (Bakır Hidroksit)",
                    "Aliette (Bayer)"
                ],
                "activeIngredients": [
                    "Bakır Hidroksit",
                    "Fosetyl-Al"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Narenciye Yaprak Galerigüvesi (Phyllocnistis citrella)",
                "description": "Taze yaprakların içinde gümüşi galeriler açarak büzüştürür.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Acetamiprid"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Narenciye Yaprakbiti",
                "description": "Taze sürgün emicisi.",
                "commercialNames": [
                    "Confidor (Bayer)"
                ],
                "activeIngredients": [
                    "Imidacloprid"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Salkımları ve Döllenme için Bor & Çinko",
                "description": "Çiçek dökümünü azaltmak.",
                "commercialNames": [
                    "Speedfol Çinko-Bor (Doktor Tarsa)",
                    "YaraVita Bortrac"
                ],
                "activeIngredients": [
                    "Çinko-Bor Süspansiyonu",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Narenciye Çiçek Tripsi (Pezothrips kellyanus)",
                "description": "Çiçek taç yaprakları altındaki halkalarda çentik/yara izi bırakır.",
                "commercialNames": [
                    "Laser (Corteva)",
                    "Spintor (Corteva)"
                ],
                "activeIngredients": [
                    "Spinosad"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Botrytis Çiçek Yanıklığı",
                "description": "Çiçek çürümesi.",
                "commercialNames": [
                    "Signum (BASF)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Haziran Dökümünü Azaltmak ve Meyve Tutumu için Kalsiyum Nitrat & Aminoasit",
                "description": "Narenciyede aşırı Haziran dökümünü engellemek.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Megafol (Valagro)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Deniz Yosunu ve Aminoasit"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Narenciye Unlubiti (Planococcus citri)",
                "description": "Meyve çanak yaprağı altına ve göbeğe yerleşerek beyaz unlu tabaka ve tatlımsı sıvı salgılar.",
                "commercialNames": [
                    "Movento 100 SC (Bayer)",
                    "Admiral 10 EC (Sumitomo)"
                ],
                "activeIngredients": [
                    "Spirotetramat",
                    "Pyriproxyfen"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Kabuklubit (Aonidiella aurantii)",
                "description": "Meyve kabuğunda kırmızı noktalar halinde kabuklu bit lekesi.",
                "commercialNames": [
                    "Admiral (Sumitomo)",
                    "Yazlık Yağlar"
                ],
                "activeIngredients": [
                    "Pyriproxyfen",
                    "Mineral Yağ"
                ]
            }
        ],
        "MEYVE_GELISIMI": [
            {
                "type": "BESLEME",
                "name": "Yaz İrileşmesi ve Kabuk Kalınlığını Dengede Tutmak için Potasyum",
                "description": "Meyvelerin irileşmesi, kabuk çatlamasının önlenmesi ve kovan doluluğu.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "SoluPotasse (Tessenderlo)",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Potasyum Sülfat",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Pas Böcüsü (Phyllocoptruta oleivora)",
                "description": "Portakal ve limon kabuğunu pas rengine/siyaha çevirir (paslı meyve).",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Envidor (Bayer)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Spirodiclofen"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Narenciye Kırmızıörümceği",
                "description": "Yaprak yapraklanmasını kurutur.",
                "commercialNames": [
                    "Floramite (UPL)"
                ],
                "activeIngredients": [
                    "Bifenazate"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Renk Dönümü (Sarı/Turuncu), Şeker-Asit Dengesi için Potasyum",
                "description": "Meyvenin turuncu/sarı renk alması ve Brix şeker oranı.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Tiyosülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Akdeniz Meyve Sineği (Ceratitis capitata)",
                "description": "Narenciyenin 1 numaralı ihracat zararlısı! Olgun meyvelere vuruk yapar, meyveyi dökertir ve kurtlandırır.",
                "commercialNames": [
                    "Success 0.24 CB (Corteva - Spinosad Cezbedici Yem)",
                    "Fyfanon (Cheminova)"
                ],
                "activeIngredients": [
                    "Spinosad Yem",
                    "Malathion"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Depo Çürüklükleri (Penicillium digitatum - Yeşil/Mavi Küf)",
                "description": "Depoda meyve çürümesi.",
                "commercialNames": [
                    "Scholar (Syngenta)",
                    "Thiobencarb"
                ],
                "activeIngredients": [
                    "Fludioxonil"
                ]
            }
        ]
    },
    "FISTIK": {
        "TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Karagöz Tomurcuk Kabarması için Çinko ve Bor",
                "description": "Antep fıstığında uyanma öncesi karagöz tomurcuklarının güçlenmesi.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "YaraVita Bortrac (Yara)"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Karazengi (Septoria pistacina)",
                "description": "Yapraklarda siyah dairesel lekeler ve erken yaprak dökümü.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Dithane M-45 (Corteva)",
                    "Score 250 EC (Syngenta)"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Mancozeb",
                    "Difenoconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fıstık Psillidi (Agonoscena pistaciae)",
                "description": "Antep fıstığının en yıkıcı zararlısı! Nymphler yapraklarda tatlımsı sıvı (fıstık balı) yapıp karagözleri ve yaprakları tamamen döker.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Movento 100 SC (Bayer)",
                    "Envidor (Bayer)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Spirotetramat",
                    "Spirodiclofen"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Döllenmesi ve Erkek/Dişi Uyum için Bor & Aminoasit",
                "description": "Karagözlerin tozlaşma başarısı ve çıtlak oranı için Bor.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fıstık Karagöz Kurdu",
                "description": "Tomurcukları kemirir.",
                "commercialNames": [
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Deltamethrin"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Bağlama ve Çıtlak Çıkarma için Denge NPK & Çinko",
                "description": "Salkım meyve tutumu.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Antepfıstığı İçgüvesi (Recurvaria pistaciicola)",
                "description": "Taze meyveleri delerek içini yer, dökülmeye sebep olur.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Deltamethrin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fıstık Psillidi (Yaz Dönemi Popülasyonu)",
                "description": "Yazın yaprak dökümünü önlemek.",
                "commercialNames": [
                    "Movento (Bayer)",
                    "Spirodiclofen"
                ],
                "activeIngredients": [
                    "Spirotetramat",
                    "Spirodiclofen"
                ]
            }
        ],
        "IC_DOLDURMA": [
            {
                "type": "BESLEME",
                "name": "İç Doldurma (Fıstık İçi Yeşermesi) ve Çıtlama Oranı için Yüksek Potasyum",
                "description": "Antep fıstığının içinin dolması, yeşil rengini alması ve kırmızı kabuğun çıtlaması için Potasyum.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Karazengi ve Alternaria",
                "description": "Yaprak ve meyve lekeleri.",
                "commercialNames": [
                    "Amistar (Syngenta)",
                    "Nativo (Bayer)"
                ],
                "activeIngredients": [
                    "Azoxystrobin",
                    "Tebuconazole + Trifloxystrobin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fıstık İçkurdu (Megastigmus pistaciae)",
                "description": "Sertleşen meyve kabuğunun içine yumurta koyar.",
                "commercialNames": [
                    "Karate Zeon (Syngenta)"
                ],
                "activeIngredients": [
                    "Lambda-cyhalothrin"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Kabuk Çatlaması (Çıtlama) ve Dolgunluk için Potasyum Sülfat",
                "description": "Kırmızı kabuğun kolay soyulması ve yüksek çıtlama randımanı.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Sonbahar Çinko-Bor Yıkaması",
                "description": "Gelecek yılın karagöz tomurcuklarını beslemek için yaprak dökümü öncesi çinko ve bor uygulaması.",
                "commercialNames": [
                    "YaraVita Zintrac",
                    "Speedfol Bor"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor"
                ]
            }
        ]
    },
    "FINDIK": {
        "PÜSKÜL": [
            {
                "type": "BESLEME",
                "name": "Püskül ve Karanfil Gelişimi için Bor & Çinko",
                "description": "Fındıkta kışın erkek püsküllerinin ve dişi karanfillerin gelişimi.",
                "commercialNames": [
                    "YaraVita Bortrac (Yara)",
                    "Speedfol Çinko"
                ],
                "activeIngredients": [
                    "Etanolamin Bor",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fındık Küllemesi (Erysiphe corylacei)",
                "description": "Yapraklarda ve püstüllerde beyaz unlanma.",
                "commercialNames": [
                    "Kumulus (BASF)",
                    "Topas (Syngenta)"
                ],
                "activeIngredients": [
                    "Kükürt",
                    "Penconazole"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Karanfillerin Döllenmesi için Bor & Hümik Asit",
                "description": "Karanfil döllenmesini desteklemek.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Hümik Asit"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fındık Kozalak Akarı (Phytoptus avellanae)",
                "description": "Tomurcukları şişirerek kozalak (gül) haline getirir, meyve vermesini engeller.",
                "commercialNames": [
                    "Kumulus DF (BASF)",
                    "Agrimec (Syngenta)"
                ],
                "activeIngredients": [
                    "Kükürt",
                    "Abamectin"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Çotanak Oluşumu ve Yaprak Büyümesi için Azot & Çinko",
                "description": "Çotanakların büyümesi.",
                "commercialNames": [
                    "İgsaş CAN %26",
                    "Novalon 20-20-20",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "Kalsiyum Amonyum Nitrat",
                    "20-20-20 NPK",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fındık Kurdu (Curculio nucum)",
                "description": "Fındığın en ana zararlısıdır! Mercimek büyüklüğündeki çotanağı delerek sarı karamuk yapar, ileride fındık içini yer.",
                "commercialNames": [
                    "Calypso (Bayer)",
                    "Decis (Bayer)",
                    "Sevin (Bayer)"
                ],
                "activeIngredients": [
                    "Thiacloprid",
                    "Deltamethrin",
                    "Carbaryl"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kahverengi Kokarca (Halyomorpha halys)",
                "description": "Fındık çotanaklarını emerek fındık içinin çürük ve lekeli olmasına yol açan invaziv zararlı.",
                "commercialNames": [
                    "Karate Zeon (Syngenta)",
                    "Talstar (FMC)"
                ],
                "activeIngredients": [
                    "Lambda-cyhalothrin",
                    "Bifenthrin"
                ]
            }
        ],
        "IC_DOLDURMA": [
            {
                "type": "BESLEME",
                "name": "Fındık İçi Dolumu ve Yağ Oranı için Potasyum Nitrat & Magnezyum",
                "description": "Çotanak içindeki fındığın dolması, boş kalmaması (kara karamuk olmaması) ve yağlanması.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "Epsom Tuzu (Magnezyum Sülfat)"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fındık Küllemesi (Yaz Mücadelesi)",
                "description": "Yaprakların erken kuruyup dökülmesini engellemek.",
                "commercialNames": [
                    "Topas (Syngenta)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Penconazole",
                    "Tebuconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fındık Yeşil Kokarcası (Palomena prasina)",
                "description": "Fındık içini emerek acılaştırır.",
                "commercialNames": [
                    "Karate Zeon (Syngenta)"
                ],
                "activeIngredients": [
                    "Lambda-cyhalothrin"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Kavuz Sararması ve İç Randımanı için Potasyum Sülfat",
                "description": "Fındık kavuzunun sararması, dalın silkelenince dökülmesi ve randıman yükseltme.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            }
        ]
    },
    "CEVIZ": {
        "TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Göz Kabarma Döneminde Çinko & Bor Dozu",
                "description": "Ceviz uyanmasında çinko noksanlığı yaprak küçülmesine (rozetleşme) sebep olur. Yüksek Çinko ve Bor uygulaması.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "Speedfol Bor (Doktor Tarsa)"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Bakteriyel Yanıklık (Xanthomonas arboricola pv. juglandis)",
                "description": "Cevizin 1 numaralı hastalığıdır! Erken baharda sürgün, yaprak ve erkek çiçek püstüllerini siyahlaştırır, meyveleri düşürür.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Kocide 2000 (Bakır Hidroksit)",
                    "Cuprocol"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Bakır Hidroksit",
                    "Bakır Oksiklorür"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Ceviz Antraknozu (Gnomonia leptostyla)",
                "description": "Yapraklarda ve yeşil kabukta dairesel çökük siyah lekeler.",
                "commercialNames": [
                    "Dithane M-45 (Corteva)",
                    "Mancozeb 80 WP"
                ],
                "activeIngredients": [
                    "Mancozeb"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Erkek Püskül ve Dişi Çiçek Döllenmesi için Bor & Aminoasit",
                "description": "Ceviz dişi çiçeklerinin döllenmesi.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Bakteriyel Yanıklık (Çiçek İlaçlaması)",
                "description": "Dişi çiçeklerin bakteriden korunması.",
                "commercialNames": [
                    "Bakır Hidroksit (Düşük Doz)"
                ],
                "activeIngredients": [
                    "Bakır Hidroksit"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve İrileşmesi ve Yeşil Kabuk Kalınlığı için Azot, Çinko, Kalsiyum",
                "description": "Ceviz meyvelerinin irileşmesi ve sürgün boyu uzaması.",
                "commercialNames": [
                    "İgsaş CAN %26",
                    "YaraVita Zintrac",
                    "YaraLiva Calcinit"
                ],
                "activeIngredients": [
                    "Kalsiyum Amonyum Nitrat",
                    "Sıvı Çinko",
                    "Kalsiyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ceviz İçkurdu (Cydia pomonella) - 1. Döl",
                "description": "Cevizin en ana zararlısıdır! Larva meyvenin göbeğinden girerek içini yer ve küçük cevizleri dökertir.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Radiant (Corteva)",
                    "Imidan (Gowan)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinetoram",
                    "Phosmet"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ceviz Yaprakbiti",
                "description": "Yaprak altlarında emgi yapar.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Acetamiprid"
                ]
            }
        ],
        "IC_DOLDURMA": [
            {
                "type": "BESLEME",
                "name": "Ceviz İçi Beyazlaşması, Yağ Doygunluğu ve Kabuk Sertleşmesi",
                "description": "Ceviz içinin dolması, için beyaz renk alması (kararmaması) ve ahşap iç kabuğun kemikleşmesi için yoğun Potasyum & Magnezyum.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "SoluPotasse (Tessenderlo)",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Potasyum Sülfat",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Ceviz Antraknozu",
                "description": "Yaprak dökümünü engellemek.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Amistar (Syngenta)"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Azoxystrobin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ceviz İçkurdu - 2. Döl",
                "description": "İç doldurma döneminde meyve kurutma.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Radiant (Corteva)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spinetoram"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Yeşil Kabuk Çatlaması (Kavlama) ve Depo Ömrü için Potasyum Sülfat",
                "description": "Dış yeşil kabuğun (kavuz) kendiliğinden çatlayarak cevizin kolay ayrılması.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ceviz Sineği (Rhagoletis completa)",
                "description": "Yeşil kabuğun içine yumurta bırakır, kabuğu siyah vıcık vıcık çürütür ve iç kabuğu lekelendirir.",
                "commercialNames": [
                    "Success (Corteva - Spinosad Yem)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Spinosad Yem",
                    "Deltamethrin"
                ]
            }
        ]
    },
    "NAR": {
        "UYANMA": [
            {
                "type": "BESLEME",
                "name": "Bahar Uyanması için Çinko, Demir ve Azot",
                "description": "Narda ilkbahar uyanması.",
                "commercialNames": [
                    "YaraVita Zintrac",
                    "Sequestrene 138 Fe",
                    "Novalon 20-20-20"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "EDDHA Demir",
                    "20-20-20 NPK"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Gövde Kanseri ve Mantari Lekeler",
                "description": "Gövde yaralanmaları.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Kocide 2000"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Bakır Hidroksit"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Dökümünü Önlemek için Bor & Çinko",
                "description": "Nar çiçeklerinin dökülmesini önlemek.",
                "commercialNames": [
                    "Speedfol Çinko-Bor (Doktor Tarsa)",
                    "Borzin"
                ],
                "activeIngredients": [
                    "Çinko-Bor Süspansiyonu",
                    "Borik Asit"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Nar Yaprakbiti (Aphis punicae)",
                "description": "Çiçek ve sürgün emicisi.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Actara (Syngenta)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Thiamethoxam"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Meyve Tutumu ve Taç Dökümü Sonrası Kalsiyum Nitrat",
                "description": "Küçük narların hücre dokusunu güçlendirmek.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Wuxal Calcium"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Nar Güvesi (Ectomyelois ceratoniae) ve Harnup Güvesi",
                "description": "Nar taç yaprak göbeğine yumurta bırakarak narın içini kurtlandırır.",
                "commercialNames": [
                    "Dipel DF (Valent - Biyolojik)",
                    "Radiant (Corteva)"
                ],
                "activeIngredients": [
                    "Bacillus thuringiensis",
                    "Spinetoram"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Nar Unlubiti (Pseudococcus spp.)",
                "description": "Nar göbeğinde ve kabuğunda unlu tabaka.",
                "commercialNames": [
                    "Movento 100 SC (Bayer)",
                    "Admiral (Sumitomo)"
                ],
                "activeIngredients": [
                    "Spirotetramat",
                    "Pyriproxyfen"
                ]
            }
        ],
        "MEYVE_BUYUMESI": [
            {
                "type": "BESLEME",
                "name": "Nar Meyve Çatlamasını Önleme (Kalsiyum & Potasyum)",
                "description": "Narların büyüme evresinde kabuk çatlayıp tanelerin saçılmasını engellemek için düzenli sulama + Kalsiyum Klorür + Potasyum Nitrat.",
                "commercialNames": [
                    "Stopit (Yara)",
                    "Multi-K (Haifa)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Sıvı Kalsiyum Klorür",
                    "Potasyum Nitrat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Harnup Güvesi ve Unlubit",
                "description": "Nar iç Çürüklüğü zararlısı.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Movento (Bayer)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Spirotetramat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Meyve Lekesi ve Alternaria",
                "description": "Kabukta siyah noktalar.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Dithane M-45"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Mancozeb"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Kıpkırmızı Kabuk, Tane Renklenmesi ve Brix için Potasyum Tiyosülfat",
                "description": "Nar tanelerinin kıpkırmızı yakut rengi alması ve şekerlenmesi.",
                "commercialNames": [
                    "KTS (Tessenderlo Kerley)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Tiyosülfat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Depo Çürüklükleri",
                "description": "Soğuk depoda nar çürümesi.",
                "commercialNames": [
                    "Serenade (Bayer)",
                    "Fludioxonil"
                ],
                "activeIngredients": [
                    "Bacillus subtilis",
                    "Fludioxonil"
                ]
            }
        ]
    },
    "BADEM": {
        "TOMURCUK": [
            {
                "type": "BESLEME",
                "name": "Erken Uyanma Çinko ve Bor Dozu",
                "description": "Badem göz uyanması.",
                "commercialNames": [
                    "YaraVita Zintrac (Yara)",
                    "Speedfol Bor"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Borik Asit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Badem Dal Kanseri & Klok (Taphrina)",
                "description": "Dal kanseri ve yaprak büzüşmesi.",
                "commercialNames": [
                    "Bordo Bulamacı",
                    "Pomarsol Forte (Bayer)"
                ],
                "activeIngredients": [
                    "Bakır Sülfat",
                    "Thiram"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçeklenmede Döllenme için Bor & Aminoasit",
                "description": "Badem erken çiçek açtığı için döllenme başarısı şarttır.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Aminoasit"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Çiçek Monilyası (Monilinia laxa)",
                "description": "Badem çiçeklerinin kuruması.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Chorus (Syngenta)",
                    "Merpan (Adama)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Cyprodinil",
                    "Captan"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Çağla Döneminde Kalsiyum ve Denge NPK",
                "description": "Taze çağla büyümesi.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Novalon 20-20-20"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "20-20-20 NPK"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Badem İçkurdu (Eurytoma amygdali)",
                "description": "Bademin 1 numaralı düşmanıdır! Meyve içine yumurta bırakır, içi yer, bademleri siyahlaştırıp dalında mumyalaştırır.",
                "commercialNames": [
                    "Decis (Bayer)",
                    "Karate Zeon (Syngenta)"
                ],
                "activeIngredients": [
                    "Deltamethrin",
                    "Lambda-cyhalothrin"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Badem Yaprakbiti",
                "description": "Taze sürgün emicisi.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Acetamiprid"
                ]
            }
        ],
        "IC_DOLDURMA": [
            {
                "type": "BESLEME",
                "name": "İç Dolumu ve Çekirdek Odunlaşması için Potasyum Nitrat",
                "description": "Badem içinin dolması ve yağlanması.",
                "commercialNames": [
                    "Multi-K (Haifa)",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "Potasyum Nitrat",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kırmızı Yaprak Lekesi (Polystigma rubrum)",
                "description": "Yapraklarda kırmızı kiremit rengi lekeler ve erken dökülme.",
                "commercialNames": [
                    "Dithane M-45 (Corteva)",
                    "Score 250 EC (Syngenta)"
                ],
                "activeIngredients": [
                    "Mancozeb",
                    "Difenoconazole"
                ]
            }
        ],
        "KABUK_CATLAMA": [
            {
                "type": "BESLEME",
                "name": "Yeşil Kabuk Çatlaması (Kavlama) için Potasyum Sülfat",
                "description": "Dış yeşil kabuğun yarılarak iç sert kabuğun ortaya çıkması.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Ağaç Yorgunluğunu Almak için Çinko-Bor Sonbahar Uygulaması",
                "description": "Hasat sonrası ağacın gelecek yıla hazırlanması.",
                "commercialNames": [
                    "YaraVita Zintrac",
                    "Speedfol Bor"
                ],
                "activeIngredients": [
                    "Sıvı Çinko",
                    "Etanolamin Bor"
                ]
            }
        ]
    },
    "PAMUK": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici, Fosfor ve Çinko İhtiyacı",
                "description": "Tohumun çimlenip ilk çapa dönemine gelene kadar güçlü kazık kök yapması için Fosfor ve Çinko.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Blackjak (Hektaş)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Hümik Asit",
                    "EDTA Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fide Kök Çürüklüğü (Rhizoctonia solani / Pythium)",
                "description": "Pamuk fidelerinin kök boğazının iplik gibi incelip devrilmesi (çökerten).",
                "commercialNames": [
                    "Maxim XL (Syngenta)",
                    "Monceren (Bayer)"
                ],
                "activeIngredients": [
                    "Fludioxonil + Metalaxyl-M",
                    "Pencycuron"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Fide Tripsi (Thrips tabaci) ve Bozkurt",
                "description": "Taze yaprakçıkları emerek gümüşi leke ve kıvrılma yapar; Bozkurt fideleri keser.",
                "commercialNames": [
                    "Confidor (Bayer)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Imidacloprid",
                    "Deltamethrin"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Çıkış Öncesi Yabancı Ot Mücadelesi",
                "description": "Pamuk tarlasında çimlenme öncesi ot kontrolü.",
                "commercialNames": [
                    "Stomp Aqua (BASF)",
                    "Cotoran (Adama)"
                ],
                "activeIngredients": [
                    "Pendimethalin",
                    "Fluometuron"
                ]
            }
        ],
        "TARAKLANMA": [
            {
                "type": "BESLEME",
                "name": "Tarak Gelişimi ve Tarak Dökümünü Önlemek için Bor & Çinko",
                "description": "Pamuğun taraklanma evresinde tarak silkmesini önlemek, dallanmayı teşvik etmek.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "YaraVita Zintrac (Yara)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Sıvı Çinko",
                    "Aminoasit"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Çizgili Yaprakkurdu (Prodenya) ve Yeşilkurt",
                "description": "Tarakları delerek içini yer, tarağın sararıp parantez gibi açılmasına (tarak dökümü) sebep olur.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Avaunt (FMC)",
                    "Radiant (Corteva)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Indoxacarb",
                    "Spinetoram"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Solgunluk (Verticillium dahliae)",
                "description": "Yapraklarda damar aralarında sararma (kaplan deseni) ve damar iletim demetlerinin kararması.",
                "commercialNames": [
                    "Kültürel Önlem (Dengeli Sulama)",
                    "Trianum (Koppert)"
                ],
                "activeIngredients": [
                    "Trichoderma harzianum"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Tutumu, Kozaya Dönüşüm ve Bor/Magnezyum",
                "description": "Sarı ve pembe çiçeklerin döllenip koza tutması için Bor ve Magnezyum.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "Epsom Tuzu (Magnezyum Sülfat)"
                ],
                "activeIngredients": [
                    "Sıvı Bor",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Pamuk Çizgili Böceği (Lygus) ve Yaprakbiti",
                "description": "Çiçek ve küçük kozalarda emgi yaparak dökülmeye yol açar.",
                "commercialNames": [
                    "Mospilan (Sumi Agro)",
                    "Confidor (Bayer)"
                ],
                "activeIngredients": [
                    "Acetamiprid",
                    "Imidacloprid"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Kırmızı Örümcek (Tetranychus cinnabarinus)",
                "description": "Pamuk yapraklarını kızartır/kızıllştırır ve erken yaprak dökümü yapar.",
                "commercialNames": [
                    "Agrimec (Syngenta)",
                    "Oberon (Bayer)"
                ],
                "activeIngredients": [
                    "Abamectin",
                    "Spiromesifen"
                ]
            }
        ],
        "KOZA": [
            {
                "type": "BESLEME",
                "name": "Koza İrileşmesi, Elyaf Lif Uzunluğu ve Mukavemet için Potasyum",
                "description": "Kozaların irileşmesi, elyaf lif kalitesi, çeper kalınlığı ve ağırlık için yoğun Potasyum (K).",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)",
                    "KTS (Tessenderlo Kerley)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat",
                    "Potasyum Tiyosülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Koza Kurdu (Yeşilkurt & Pembe Kurt)",
                "description": "Kozaları delerek lifleri siyahlaştırır ve çürütür.",
                "commercialNames": [
                    "Coragen (FMC)",
                    "Avaunt (FMC)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Indoxacarb"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Koza Açtırıcı ve Yaprak Dökücü Hazırlığı",
                "description": "Hasat öncesi kozaların aynı anda açması ve yaprakların dökülmesi için uygulama.",
                "commercialNames": [
                    "Dropp Ultra (Bayer)",
                    "Finish (Bayer)"
                ],
                "activeIngredients": [
                    "Thidiazuron + Diuron",
                    "Ethephon"
                ]
            }
        ]
    },
    "MISIR": {
        "CIKIS": [
            {
                "type": "BESLEME",
                "name": "Çıkış Gübrelemesi (Fosfor & Çinko)",
                "description": "Mısır çimlenme ve köklenme evresinde soğuk stresi morarmasını önlemek için Çinko ve MAP.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Microstar PZ (Sipcam)",
                    "Zinc 15"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Mikrogranül MAP + Çinko",
                    "EDTA Çinko"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Telkurdu (Agriotes spp.) ve Bozkurt",
                "description": "Çimlenen mısır tohumunu ve kök boğazını kemirir.",
                "commercialNames": [
                    "Force 20 CS (Syngenta)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Tefluthrin",
                    "Deltamethrin"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Çıkış Öncesi ve Erken Çıkış Ot Mücadelesi",
                "description": "Dar ve geniş yapraklı otlar.",
                "commercialNames": [
                    "Merlin Flexx (Bayer)",
                    "Adengo (Bayer)"
                ],
                "activeIngredients": [
                    "Isoxaflutole + Cyprosulfamide",
                    "Isoxaflutole + Thiencarbazone-methyl"
                ]
            }
        ],
        "GELISIM": [
            {
                "type": "BESLEME",
                "name": "Hızlı Büyüme (Ara Çapası) Azot ve Çinko Yüklemesi",
                "description": "Mısırın V6-V12 döneminde boyatması için topraktan Üre (%46) veya A.Nitrat; yapraktan Çinko ve Magnezyum.",
                "commercialNames": [
                    "Toros Üre %46",
                    "İgsaş CAN %26",
                    "YaraVita Zintrac",
                    "Epsom Tuzu"
                ],
                "activeIngredients": [
                    "Üre",
                    "Kalsiyum Amonyum Nitrat",
                    "Sıvı Çinko",
                    "Magnezyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Koçan Kurdu (Sesamia nonagrioides) ve Mısır Kurdu (Ostrinia nubilalis)",
                "description": "Mısır sapının içine girerek galeriler açar, sapı kırar.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Ampligo (Syngenta)",
                    "Karate Zeon"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Chlorantraniliprole + Lambda-cyhalothrin",
                    "Lambda-cyhalothrin"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Çıkış Sonrası Ot Mücadelesi",
                "description": "Mısır boylandıktan sonra ot ilaçlaması.",
                "commercialNames": [
                    "Laudis (Bayer)",
                    "Elumis (Syngenta)"
                ],
                "activeIngredients": [
                    "Tembotrione",
                    "Nicosulfuron + Mesotrione"
                ]
            }
        ],
        "TEPE_PUSKULU": [
            {
                "type": "BESLEME",
                "name": "Polen Dökümü ve Püskül Döneminde Bor & Potasyum",
                "description": "Tepe püskülü polen canlılığı ve koçan püskülünün eksiksiz döllenmesi için Bor.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "YaraVita Bortrac"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Etanolamin Bor"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Koçan Kurdu ve Yeşilkurt (Koçan Püskülü İlaçlaması)",
                "description": "Koçan püskülünü yiyerek döllenmeyi engeller.",
                "commercialNames": [
                    "Coragen 20 SC (FMC)",
                    "Avaunt (FMC)"
                ],
                "activeIngredients": [
                    "Chlorantraniliprole",
                    "Indoxacarb"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Mısır Rastığı (Ustilago maydis)",
                "description": "Koçanda veya sapta büyük gri-siyah mantari ur (gal) oluşumu.",
                "commercialNames": [
                    "Kültürel Önlem (Dengeli Azot)"
                ]
            }
        ],
        "TANE_DOLUM": [
            {
                "type": "BESLEME",
                "name": "Süt Olum ve Hamur Olumda Tane Ağırlığı (Hektolitre) için Potasyum",
                "description": "Koçandaki tanelerin sonuna kadar dolması ve hektolitre ağırlığı artışı.",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Yaprak Yanıklığı (Helminthosporium maydis / turcicum)",
                "description": "Yapraklarda uzun mekik şeklinde kahverengi yanıklık lekeleri.",
                "commercialNames": [
                    "Amistar Opti (Syngenta)",
                    "Nativo (Bayer)"
                ],
                "activeIngredients": [
                    "Azoxystrobin + Chlorothalonil",
                    "Tebuconazole + Trifloxystrobin"
                ]
            }
        ]
    },
    "BUGDAY": {
        "KARDESLENME": [
            {
                "type": "BESLEME",
                "name": "Azotlu Üst Gübreleme (1. Doz Üre / Amonyum Sülfat)",
                "description": "Kardeş sayısını ve kök boğazı sağlamlığını artırmak için ilkbahar başı Azot takviyesi.",
                "commercialNames": [
                    "Toros Üre %46",
                    "İgsaş Amonyum Sülfat %21 S"
                ],
                "activeIngredients": [
                    "Üre",
                    "Amonyum Sülfat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Ekin Bambulu (Zabrus spp.) ve Kök Kurdu",
                "description": "Yaprakları toprağa çekip yer.",
                "commercialNames": [
                    "Decis (Bayer)",
                    "Karate Zeon (Syngenta)"
                ],
                "activeIngredients": [
                    "Deltamethrin",
                    "Lambda-cyhalothrin"
                ]
            },
            {
                "type": "YABANCI_OT",
                "name": "Geniş ve Dar Yapraklı Yabancı Ot Mücadelesi",
                "description": "Kardeşlenme sonunda yabancı ot mücadelesi.",
                "commercialNames": [
                    "Granstar (FMC)",
                    "Axial (Syngenta)",
                    "Mustang (Corteva)"
                ],
                "activeIngredients": [
                    "Tribenuron-methyl",
                    "Pinoxaden",
                    "Florasulam + 2,4-D"
                ]
            }
        ],
        "SAPA_KALKMA": [
            {
                "type": "BESLEME",
                "name": "Sap Uzaması ve Boy Gübresi (2. Doz CAN %26 + Çinko)",
                "description": "Yatmaya dayanıklı güçlü sap ve başak taslağı büyümesi için Azot ve yapraktan Çinko.",
                "commercialNames": [
                    "İgsaş CAN %26",
                    "YaraVita Zintrac (Yara)"
                ],
                "activeIngredients": [
                    "Kalsiyum Amonyum Nitrat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Sarı Pas (Puccinia striiformis)",
                "description": "Buğdayın en tehlikeli yaprak hastalığı! Yapraklarda makine dikişi gibi sarı püstül Çizgileri.",
                "commercialNames": [
                    "Nativo (Bayer)",
                    "Opera Max (BASF)",
                    "Amistar Extra (Syngenta)",
                    "Folicur (Bayer)"
                ],
                "activeIngredients": [
                    "Tebuconazole + Trifloxystrobin",
                    "Epoxiconazole + Pyraclostrobin",
                    "Azoxystrobin + Difenoconazole",
                    "Tebuconazole"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Septorya Yaprak Lekesi (Septoria tritici)",
                "description": "Yapraklarda elips şeklinde içinde siyah noktacıklar (piknit) bulunan kahverengi lekeler.",
                "commercialNames": [
                    "Input (Bayer)",
                    "Score 250 EC (Syngenta)"
                ],
                "activeIngredients": [
                    "Prothioconazole + Spiroxamine",
                    "Difenoconazole"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Külleme (Blumeria graminis)",
                "description": "Yaprak tabanında unlu beyaz örtü.",
                "commercialNames": [
                    "Corbel (BASF)",
                    "Topas (Syngenta)"
                ],
                "activeIngredients": [
                    "Fenpropimorph",
                    "Penconazole"
                ]
            }
        ],
        "BASAKLANMA": [
            {
                "type": "BESLEME",
                "name": "Başak Döllenmesi ve Tane Sayısı için Bor & Çinko",
                "description": "Başakta kör tane kalmaması ve polen canlılığı.",
                "commercialNames": [
                    "Speedfol Bor (Doktor Tarsa)",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "Borik Asit",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Başak Yanıklığı / Fusaryum (Fusarium graminearum)",
                "description": "Çiçeklenme döneminde yağışla başakların beyazlaşıp saman rengi alması, tanelerde pembe küf.",
                "commercialNames": [
                    "Prosaro (Bayer)",
                    "Caramba (BASF)"
                ],
                "activeIngredients": [
                    "Prothioconazole + Tebuconazole",
                    "Metconazole"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Süne (Eurygaster integriceps) - Nimf Mücadelesi",
                "description": "Başaktaki taneleri emerek gluten kalitesini sıfırlar (ekmeklik değeri düşer).",
                "commercialNames": [
                    "Karate Zeon (Syngenta)",
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Lambda-cyhalothrin",
                    "Deltamethrin"
                ]
            }
        ],
        "SUT_OLUMU": [
            {
                "type": "BESLEME",
                "name": "Tane Ağırlığı (Hektolitre) ve Protein Oranı için Potasyum",
                "description": "Süt olumdan sarı oluma geçerken tane dolgunluğu ve yüksek protein (Gluten).",
                "commercialNames": [
                    "SoluPotasse (Tessenderlo)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Potasyum Sülfat",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Süne ve Kımıl İleri Evre Nimfler",
                "description": "Emgi zararlısı takibi.",
                "commercialNames": [
                    "Decis (Bayer)"
                ],
                "activeIngredients": [
                    "Deltamethrin"
                ]
            }
        ]
    },
    "DOMATES": {
        "FIDE": [
            {
                "type": "BESLEME",
                "name": "Kök Geliştirici ve Şok Önleyici (Fosfor & Aminoasit)",
                "description": "Fide dikiminden sonra kılcal kök tesis etmek için.",
                "commercialNames": [
                    "Novalon 10-52-10 (Doktor Tarsa)",
                    "Radifarm (Valagro)",
                    "Isabion (Syngenta)"
                ],
                "activeIngredients": [
                    "10-52-10 MAP",
                    "Aminoasit",
                    "Deniz Yosunu"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Fide Çökerteni (Pythium / Rhizoctonia)",
                "description": "Fide kök boğazı devrilmeleri.",
                "commercialNames": [
                    "Previcur Energy (Bayer)",
                    "Tachigaren (Sumi Agro)"
                ],
                "activeIngredients": [
                    "Propamocarb + Fosetyl-Al",
                    "Hymexazol"
                ]
            }
        ],
        "VEGETATIF": [
            {
                "type": "BESLEME",
                "name": "Gövde ve Dallanma için Azot, Çinko ve Magnezyum",
                "description": "Domates çalı yapısının büyümesi ve klorofil sentetik gücü.",
                "commercialNames": [
                    "Novalon 20-20-20 (Doktor Tarsa)",
                    "Epsom Tuzu",
                    "YaraVita Zintrac"
                ],
                "activeIngredients": [
                    "20-20-20 NPK",
                    "Magnezyum Sülfat",
                    "Sıvı Çinko"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Domates Mildiyösü (Phytophthora infestans)",
                "description": "Yapraklarda su emmiş gibi morumsu-siyah lekeler ve alt yüzde beyaz küf tabakası.",
                "commercialNames": [
                    "Revus (Syngenta)",
                    "Infinito (Bayer)",
                    "Ridomil Gold MZ (Syngenta)"
                ],
                "activeIngredients": [
                    "Mandipropamid",
                    "Fluopicolide + Propamocarb",
                    "Metalaxyl-M + Mancozeb"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Erken Yanıklık (Alternaria solani)",
                "description": "Yapraklarda hedef tahtası halkalı lekeler.",
                "commercialNames": [
                    "Score 250 EC (Syngenta)",
                    "Dithane M-45 (Corteva)"
                ],
                "activeIngredients": [
                    "Difenoconazole",
                    "Mancozeb"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Domates Yaprakgalerimaymuncuğu (Tuta absoluta)",
                "description": "Domatesin 1 numaralı felaketidir! Larvalar yaprak parankimini ve meyveleri delerek dantel gibi işler.",
                "commercialNames": [
                    "Alverde (BASF)",
                    "Affirm (Syngenta)",
                    "Coragen (FMC)",
                    "Voliam Targo"
                ],
                "activeIngredients": [
                    "Metaflumizone",
                    "Emamectin benzoate",
                    "Chlorantraniliprole",
                    "Abamectin + Chlorantraniliprole"
                ]
            }
        ],
        "CICEKLENME": [
            {
                "type": "BESLEME",
                "name": "Çiçek Salkımları ve Döllenme için Bor & Çinko",
                "description": "Çiçek silkmeyi engellemek.",
                "commercialNames": [
                    "Speedfol Çinko-Bor (Doktor Tarsa)",
                    "Borocal (Tradecorp)"
                ],
                "activeIngredients": [
                    "Çinko-Bor Süspansiyonu",
                    "Kalsiyum-Bor Kompleksi"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Kurşuni Küf (Botrytis cinerea)",
                "description": "Çiçek ve meyve saplarında gri çürütme.",
                "commercialNames": [
                    "Signum (BASF)",
                    "Switch (Syngenta)"
                ],
                "activeIngredients": [
                    "Boscalid + Pyraclostrobin",
                    "Fludioxonil + Cyprodinil"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Çiçek Tripsi (Frankliniella occidentalis)",
                "description": "Çiçek içi zararlısı.",
                "commercialNames": [
                    "Laser (Corteva)"
                ],
                "activeIngredients": [
                    "Spinosad"
                ]
            }
        ],
        "MEYVE_TUTUMU": [
            {
                "type": "BESLEME",
                "name": "Çiçek Burnu Çürüklüğü (Çiçek Çatlaması) Önleme (Kalsiyum) & Potasyum",
                "description": "Meyve alt tabanında siyah çökük yara (kalsiyum noksanlığı) oluşmaması için folyar Kalsiyum.",
                "commercialNames": [
                    "YaraLiva Calcinit (Yara)",
                    "Stopit (Yara)",
                    "Multi-K (Haifa)"
                ],
                "activeIngredients": [
                    "Kalsiyum Nitrat",
                    "Sıvı Kalsiyum Klorür",
                    "Potasyum Nitrat"
                ]
            },
            {
                "type": "ZARARLI",
                "name": "Tuta Absoluta ve Yeşilkurt (Helicoverpa armigera)",
                "description": "Meyve sapı dibinden içeri girerek domatesi delerler.",
                "commercialNames": [
                    "Affirm (Syngenta)",
                    "Avaunt (FMC)",
                    "Coragen (FMC)"
                ],
                "activeIngredients": [
                    "Emamectin benzoate",
                    "Indoxacarb",
                    "Chlorantraniliprole"
                ]
            }
        ],
        "HASAT": [
            {
                "type": "BESLEME",
                "name": "Kırmızı Renk (Likopen), Brix ve Raf Ömrü için Potasyum Tiyosülfat",
                "description": "Domateslerin sert kalması, kıpkırmızı renklenmesi ve tatlanması.",
                "commercialNames": [
                    "KTS (Tessenderlo Kerley)",
                    "SoluPotasse (Tessenderlo)"
                ],
                "activeIngredients": [
                    "Potasyum Tiyosülfat",
                    "Potasyum Sülfat"
                ]
            },
            {
                "type": "HASTALIK",
                "name": "Hasat İçi Çürüklükler",
                "description": "Alternaria ve Botrytis.",
                "commercialNames": [
                    "Serenade (Bayer)"
                ],
                "activeIngredients": [
                    "Bacillus subtilis"
                ]
            }
        ]
    }
};

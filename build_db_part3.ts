import fs from 'fs';

const part3 = `
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
`;

fs.appendFileSync('generated_db.ts', part3, 'utf8');
console.log('Appended part 3');

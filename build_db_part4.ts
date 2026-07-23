import fs from 'fs';

const part4 = `
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
`;

fs.appendFileSync('generated_db.ts', part4, 'utf8');
console.log('Appended part 4 and GENERIC_PROBLEMS');

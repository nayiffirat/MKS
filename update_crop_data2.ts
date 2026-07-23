import fs from 'fs';

const newProblemDB = `export const PROBLEM_DATABASE: Record<string, Record<string, any[]>> = {
    PAMUK: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Fide Kök Çürüklüğü (Çökerten)', description: 'Fidelerin toprak seviyesinden çürüyüp devrilmesine neden olur.', activeIngredients: ['Previcur Energy (Bayer) - Aktif: Propamocarb + Fosetyl', 'Celest Max (Syngenta) - Aktif: Fludioxonil', 'Rizolex-T (Sumi Agro) - Aktif: Tolclofos-methyl + Thiram', 'Pomarsol Forte (Bayer) - Aktif: Thiram'] },
            { type: 'ZARARLI', name: 'Telkurdu (Agriotes spp.) ve Bozkurt', description: 'Tohumları ve genç fidelerin köklerini kemirir.', activeIngredients: ['Gaucho (Bayer) - Aktif: Imidacloprid', 'Force 20 CS (Syngenta) - Aktif: Tefluthrin', 'Dursban 4 (Corteva) - Aktif: Chlorpyrifos'] },
            { type: 'ZARARLI', name: 'Trips (Thysanoptera)', description: 'Genç yapraklarda gümüşi lekeler ve kıvrılmalar.', activeIngredients: ['Laser (Corteva) - Aktif: Spinosad', 'Radiant (Corteva) - Aktif: Spinetoram', 'Mospilan (Sumi Agro) - Aktif: Acetamiprid'] },
            { type: 'YABANCI_OT', name: 'Dar Yapraklı Otlar', description: 'Erken rekabetçi otlar.', activeIngredients: ['Stomp Aqua (BASF) - Aktif: Pendimethalin', 'Treflan (Corteva) - Aktif: Trifluralin'] },
            { type: 'BESLEME', name: 'Kök Geliştirici ve Fosfor İhtiyacı', description: 'Fide kök yapısı için.', activeIngredients: ['Novalon 10-52-10 (Doktor Tarsa)', 'Peters Professional (ICL)', 'Megafol (Valagro / Syngenta)', 'Blackjak (Hektaş) - Hümik/Fülvik'] }
        ],
        TARAKLANMA: [
            { type: 'ZARARLI', name: 'Yeşilkurt (Helicoverpa armigera)', description: 'Tarakları delerek beslenir ve dökülmeler yapar.', activeIngredients: ['Avaunt 150 EC (FMC) - Aktif: Indoxacarb', 'Coragen 20 SC (FMC) - Aktif: Chlorantraniliprole', 'Radiant 120 SC (Corteva) - Aktif: Spinetoram'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği (Bemisia tabaci)', description: 'Bitki özsuyunu emer ve fumajin (karaballık) salgılar.', activeIngredients: ['Oberon SC 240 (Bayer) - Aktif: Spiromesifen', 'Admiral (Sumi Agro) - Aktif: Pyriproxyfen', 'Mospilan (Sumi Agro) - Aktif: Acetamiprid'] },
            { type: 'ZARARLI', name: 'Lygus (Bitki Tahtakurus)', description: 'Taraklara sokup emerek dökülmelere neden olur.', activeIngredients: ['Teppeki (ISK Biosciences) - Aktif: Flonicamid', 'Closer (Corteva) - Aktif: Sulfoxaflor'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yapraklarda kızarma ve kuruma yapar.', activeIngredients: ['Agrimec 18 EC (Syngenta) - Aktif: Abamectin', 'Envidor Speed (Bayer) - Aktif: Spirodiclofen', 'Floramite (UPL) - Aktif: Bifenazate'] },
            { type: 'HASTALIK', name: 'Solgunluk (Verticillium dahliae)', description: 'İletim demetlerinin tıkanmasıyla yapraklarda solma.', activeIngredients: ['Dayanıklı çeşit seçimi (May Tohum, Progen)', 'Dengeli sulama, ölçülü azot (Kültürel Önlem)'] },
            { type: 'BESLEME', name: 'Azot İhtiyacı', description: 'Hızlı boy atma dönemi.', activeIngredients: ['Toros Üre (Toros Tarım)', 'İgsaş CAN 26 (İgsaş)', 'UAN 32 Sıvı Azot (Toros)'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Yeşilkurt (Helicoverpa armigera)', description: 'Tarak, çiçek ve genç kozaları delerek beslenir.', activeIngredients: ['Coragen 20 SC (FMC)', 'Voliam Targo (Syngenta)', 'Proclaim (Syngenta) - Aktif: Emamectin benzoate'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği', description: 'Bitki özsuyunu emer ve fumajin oluşturur.', activeIngredients: ['Movento 100 SC (Bayer) - Aktif: Spirotetramat', 'Oberon (Bayer)', 'Pegasus (Syngenta) - Aktif: Diafenthiuron'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Sıcak havalarda popülasyonu artar, fotosentezi engeller.', activeIngredients: ['Omite (UPL) - Aktif: Propargite', 'Agrimec (Syngenta)', 'Nissorun (Nippon Soda) - Aktif: Hexythiazox'] },
            { type: 'BESLEME', name: 'Bor ve Çinko İhtiyacı', description: 'Çiçek dökülmesini engellemek için.', activeIngredients: ['YaraVita Bortrac (Yara)', 'YaraVita Zintrac (Yara)', 'Borzin (Doktor Tarsa)'] }
        ],
        KOZA: [
            { type: 'ZARARLI', name: 'Yeşilkurt ve Pembe Kurt', description: 'Kozaların içine girerek lifi ve çiğidi tahrip ederler.', activeIngredients: ['Avaunt 150 EC (FMC)', 'Radiant (Corteva)', 'Coragen (FMC)'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Kozaların olgunlaşmasını geciktirir.', activeIngredients: ['Oberon (Bayer)', 'Agrimec (Syngenta)'] },
            { type: 'ZARARLI', name: 'Beyazsinek', description: 'Açılan kozalardaki pamuk lifine ballı madde salgılar (Fumajin).', activeIngredients: ['Movento (Bayer)', 'Teppeki (ISK Biosciences)'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı (Koza Dolumu)', description: 'Kozaların olgunlaşması ve lif kalitesi için yüksek potasyum.', activeIngredients: ['Multi-K (Haifa)', 'YaraTera Krista K (Yara) - Potasyum Nitrat', 'KTS (Tessenderlo Kerley) - Sıvı Potasyum Tiyosülfat'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Yaprak Dökücü (Defoliant) İhtiyacı', description: 'Makineli hasadı kolaylaştırmak için kozalar açtığında yaprak döktürülür.', activeIngredients: ['Dropp Ultra (Bayer) - Aktif: Thidiazuron + Diuron', 'Shark (FMC) - Aktif: Carfentrazone-ethyl'] }
        ]
    },
    MISIR: {
        CIKIS: [
            { type: 'ZARARLI', name: 'Bozkurt ve Telkurdu', description: 'Genç mısır fidelerini toprak seviyesinden keserek öldürür.', activeIngredients: ['Cruiser 350 FS (Syngenta) - Aktif: Thiamethoxam (Tohum)', 'Force 20 CS (Syngenta) - Aktif: Tefluthrin', 'Decis (Bayer) - Aktif: Deltamethrin (Yeşil Aksam)'] },
            { type: 'HASTALIK', name: 'Fide Kök Çürüklüğü', description: 'Erken dönemde soğuk topraklarda görülür.', activeIngredients: ['Maxim XL (Syngenta) - Aktif: Fludioxonil + Metalaxyl-M (Tohum)'] },
            { type: 'YABANCI_OT', name: 'Dar ve Geniş Yapraklı Otlar', description: 'Mısırın ilk gelişim aşamasında ot rekabeti.', activeIngredients: ['Callisto (Syngenta) - Aktif: Mesotrione', 'Motivell (BASF) - Aktif: Nicosulfuron', 'Equip (Bayer) - Aktif: Foramsulfuron', 'Laudis (Bayer) - Aktif: Tembotrione'] },
            { type: 'BESLEME', name: 'Fosfor ve Çinko İhtiyacı', description: 'Güçlü kök gelişimi ve erken dönem soğuk stresi için.', activeIngredients: ['Microstar PZ (Sipcam) - Mikrogranül gübre', 'YaraMila Actyva (Yara) - Taban gübresi', 'Zinc 15 (Doktor Tarsa)'] }
        ],
        GELISIM: [
            { type: 'ZARARLI', name: 'Mısır Koçankurdu ve Mısır Kurdu', description: 'Gövdeyi delip içine girer, tepe püskülünü kırar.', activeIngredients: ['Coragen 20 SC (FMC)', 'Radiant 120 SC (Corteva)', 'Avaunt (FMC)', 'Karate Zeon (Syngenta) - Aktif: Lambda-cyhalothrin'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprakları kurutarak fotosentezi durdurur.', activeIngredients: ['Oberon (Bayer)', 'Agrimec (Syngenta)'] },
            { type: 'BESLEME', name: 'Azot ve Çinko İhtiyacı', description: 'Mısırın en çok azot tükettiği ve boylandığı dönemdir.', activeIngredients: ['İgsaş Üre (İgsaş)', 'YaraVita Zintrac (Yara) - Yapraktan sıvı çinko', 'Megafol (Valagro / Syngenta)'] }
        ],
        TEPE_PUSKULU: [
            { type: 'ZARARLI', name: 'Mısır Kurdu (Ostrinia nubilalis)', description: 'Tepe püskülünde beslenip koçana iner.', activeIngredients: ['Coragen (FMC)', 'Voliam Targo (Syngenta)', 'Ampligo (Syngenta)'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Bu evrede şiddetli zararı döl tutumunu etkiler.', activeIngredients: ['Envidor (Bayer)', 'Nissorun (Nippon Soda)'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Tozlanma verimini (koçan uç doluluğunu) artırmak için.', activeIngredients: ['YaraVita Bortrac (Yara) - Yapraktan', 'Speedfol Bor (Doktor Tarsa)'] }
        ],
        TANE_DOLUM: [
            { type: 'ZARARLI', name: 'Mısır Kurdu', description: 'Koçan içinde beslenerek doğrudan verimi düşürür ve çürüklüklere zemin hazırlar.', activeIngredients: ['Coragen 20 SC (FMC)', 'Radiant (Corteva)'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Tane iriliğini ve koçan ağırlığını artırır.', activeIngredients: ['YaraTera Krista K (Yara)', 'SoluPotasse (Tessenderlo) - Potasyum Sülfat'] },
            { type: 'HASTALIK', name: 'Koçan Çürüklükleri (Fusarium, Aspergillus)', description: 'Böcek deliklerinden girerek mikotoksin (aflatoksin) yapar.', activeIngredients: ['Zararlı mücadelesi (Coragen, Radiant) anahtardır'] }
        ]
    },
    BUGDAY: {
        KARDESLENME: [
            { type: 'HASTALIK', name: 'Kök ve Kökboğazı Çürüklüğü', description: 'Köklerin esmerleşip çürümesi, kardeşlenmeyi zayıflatır.', activeIngredients: ['Lamardor (Bayer) - Tohum ilacı', 'Input (Bayer) - Aktif: Prothioconazole + Spiroxamine', 'Folicur (Bayer) - Aktif: Tebuconazole'] },
            { type: 'ZARARLI', name: 'Ekin Bambulu', description: 'Genç yaprakları kemirerek tarlada yer yer boşluklar yaratır.', activeIngredients: ['Decis (Bayer) - Aktif: Deltamethrin', 'Karate Zeon (Syngenta)'] },
            { type: 'YABANCI_OT', name: 'Geniş Yapraklı Otlar (Sinapis arvensis, vb.)', description: 'Buğdayla rekabete girer.', activeIngredients: ['Granstar (FMC) - Aktif: Tribenuron-methyl', 'Esteron (Corteva) - Aktif: 2,4-D Ester', 'Mustang (Corteva) - Aktif: Florasulam'] },
            { type: 'YABANCI_OT', name: 'Dar Yapraklı Otlar (Yabani Yulaf, Delice)', description: 'Çok ciddi verim kaybı yapar.', activeIngredients: ['Topik (Syngenta) - Aktif: Clodinafop-propargyl', 'Axial (Syngenta) - Aktif: Pinoxaden', 'Atlantis (Bayer) - Aktif: Mesosulfuron-methyl'] },
            { type: 'BESLEME', name: 'Azotlu Üst Gübreleme', description: 'Kardeş sayısını artırmak için azot ihtiyacı.', activeIngredients: ['Toros Üre (Toros Tarım)', 'İgsaş Amonyum Sülfat (AS)'] }
        ],
        SAPA_KALKMA: [
            { type: 'HASTALIK', name: 'Sarı Pas (Puccinia striiformis) ve Kahverengi Pas', description: 'Yapraklarda makine dikişi şeklinde sarı püstüller oluşur.', activeIngredients: ['Opera Max (BASF) - Aktif: Epoxiconazole + Pyraclostrobin', 'Amistar (Syngenta) - Aktif: Azoxystrobin', 'Folicur (Bayer)'] },
            { type: 'HASTALIK', name: 'Septoria Yaprak Lekesi', description: 'Alt yapraklardan başlayarak kahverengi nekrotik lekeler oluşturur.', activeIngredients: ['Input (Bayer)', 'Priaxor (BASF) - Aktif: Fluxapyroxad + Pyraclostrobin'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yapraklarda beyaz unsu örtü.', activeIngredients: ['Corbel (BASF) - Aktif: Fenpropimorph', 'Folicur (Bayer)'] },
            { type: 'ZARARLI', name: 'Süne (Ergin Göçü)', description: 'Kışlaklardan tarlaya göç eden erginler gövdeyi sokup emerek akbaşak yapar.', activeIngredients: ['Karate Zeon (Syngenta)', 'Fury (FMC) - Aktif: Zeta-cypermethrin'] },
            { type: 'BESLEME', name: 'İkinci Azot Uygulaması', description: 'Başak oluşumunu ve boyu destekler.', activeIngredients: ['Toros CAN 26 (Amonyum Nitrat)'] }
        ],
        BASAKLANMA: [
            { type: 'ZARARLI', name: 'Süne (Nimf/Yavru)', description: 'Süt olumunda taneleri emerek ekmeklik kaliteyi düşürür.', activeIngredients: ['Karate Zeon (Syngenta)', 'Decis (Bayer)', 'Fastac (BASF) - Aktif: Alpha-cypermethrin'] },
            { type: 'HASTALIK', name: 'Sarı Pas ve Kahverengi Pas', description: 'Bayrak yaprağı korumak çok kritiktir.', activeIngredients: ['Opera Max (BASF)', 'Nativo (Bayer) - Aktif: Tebuconazole + Trifloxystrobin'] },
            { type: 'HASTALIK', name: 'Fusarium Başak Yanıklığı', description: 'Başaklarda kısmi ağarmalar ve pembeleşme.', activeIngredients: ['Prosaro (Bayer) - Aktif: Prothioconazole + Tebuconazole'] },
            { type: 'BESLEME', name: 'Çinko İhtiyacı', description: 'Polen tüpü gelişimi ve tane tutumu için önemlidir.', activeIngredients: ['YaraVita Zintrac (Yara)', 'Zinc 15 (Doktor Tarsa)'] }
        ],
        SUT_OLUMU: [
            { type: 'ZARARLI', name: 'Süne (İleri Evre Nimf / Yeni Ergin)', description: 'Tane zararını maksimize ettiği kritik dönem.', activeIngredients: ['Karate Zeon (Syngenta)', 'Decis (Bayer)'] }
        ]
    },
    DOMATES: {
        FIDE: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Çökerten)', description: 'Toprak kaynaklı mantarların neden olduğu fide devrilmesi.', activeIngredients: ['Previcur Energy (Bayer)', 'Ridomil Gold (Syngenta) - Aktif: Metalaxyl-M + Mancozeb', 'Tachigaren (Sumi Agro) - Aktif: Hymexazol'] },
            { type: 'ZARARLI', name: 'Toprakaltı Zararlıları (Danaburnu, Bozkurt)', description: 'Fideyi dipten keser.', activeIngredients: ['Dursban 4 (Corteva) - Toprak uygulaması', 'Force 20 CS (Syngenta)'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği', description: 'Fideden itibaren virüs (TYLCV) bulaştırabilir.', activeIngredients: ['Confidor (Bayer) - Aktif: Imidacloprid', 'Mospilan (Sumi Agro)'] },
            { type: 'BESLEME', name: 'Kök Geliştirici ve Fosfor', description: 'Güçlü kök atımı için.', activeIngredients: ['Novalon 10-52-10 (Doktor Tarsa)', 'Isabion (Syngenta) - Aminoasit', 'Megafol (Valagro)'] }
        ],
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Mildiyö (Phytophthora infestans)', description: 'Yapraklarda su emmiş gibi lekeler, pamukçuk.', activeIngredients: ['Ridomil Gold MZ (Syngenta)', 'Curzate (Corteva) - Aktif: Cymoxanil', 'Acrobat Plus (BASF) - Aktif: Dimethomorph + Mancozeb', 'Revus (Syngenta) - Aktif: Mandipropamid'] },
            { type: 'HASTALIK', name: 'Bakteriyel Leke ve Kanser', description: 'Yapraklarda kahverengi lekeler, kuruma.', activeIngredients: ['Kocide 2000 (Certis) - Bakır hidroksit', 'Cuprocol (Syngenta) - Bakır oksiklorür', 'Dithane M-45 (Corteva) - Mancozeb'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yaprak yüzeyinde unumsu beyaz tabaka.', activeIngredients: ['Topas (Syngenta) - Aktif: Penconazole', 'Kumulus (BASF) - Kükürt', 'Ortiva (Syngenta) - Aktif: Azoxystrobin'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği ve Yaprakbiti', description: 'Özsuyu emer, virüs taşır.', activeIngredients: ['Mospilan (Sumi Agro)', 'Oberon (Bayer)', 'Movento (Bayer)'] },
            { type: 'ZARARLI', name: 'Tuta absoluta (Domates Güvesi)', description: 'Yapraklarda beyaz tül benzeri galeriler açar.', activeIngredients: ['Coragen (FMC)', 'Radiant (Corteva)', 'Alverde (BASF) - Aktif: Metaflumizone'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Alt yapraklardan başlayıp kuruma yapar.', activeIngredients: ['Agrimec (Syngenta)', 'Oberon (Bayer)', 'Floramite (UPL)'] },
            { type: 'BESLEME', name: 'Azot ve Çinko İhtiyacı', description: 'Boya kalkma ve yeşil aksam.', activeIngredients: ['Novalon 20-20-20 (Doktor Tarsa)', 'Epsom Tuzu (Magnezyum Sülfat)'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Çiçek Tripsi (Frankliniella occidentalis)', description: 'Çiçekleri kurutur, TSWV virüsü taşır.', activeIngredients: ['Laser (Corteva) - Aktif: Spinosad', 'Radiant (Corteva)', 'Dicarzol (Gowan) - Aktif: Formetanate'] },
            { type: 'ZARARLI', name: 'Tuta absoluta', description: 'Çiçek salkımlarını kesebilir.', activeIngredients: ['Coragen (FMC)', 'Voliam (Syngenta)'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis cinerea)', description: 'Sera ortamında çiçek kuruması.', activeIngredients: ['Signum (BASF) - Aktif: Boscalid + Pyraclostrobin', 'Switch (Syngenta) - Aktif: Fludioxonil + Cyprodinil'] },
            { type: 'BESLEME', name: 'Bor ve Çinko İhtiyacı', description: 'Çiçek dökülmesini önlemek ve döllenmeyi artırmak için.', activeIngredients: ['YaraLiva Calcinit (Yara)', 'YaraVita Bortrac (Yara)', 'Borzin (Doktor Tarsa)'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'BESLEME', name: 'Kalsiyum İhtiyacı (Çiçek Burnu Çürüklüğü)', description: 'Hızlı meyve büyümesinde meyve ucu kararması.', activeIngredients: ['YaraLiva Calcinit (Yara) - Kalsiyum Nitrat', 'Stopit (Yara) - Yapraktan Sıvı Kalsiyum Klorür', 'Caltrac (Yara)'] },
            { type: 'ZARARLI', name: 'Tuta absoluta', description: 'Meyveleri delerek pazar değerini sıfırlar.', activeIngredients: ['Coragen (FMC)', 'Radiant (Corteva)', 'Proclaim (Syngenta) - Aktif: Emamectin benzoate', 'Dipel (Valent) - Aktif: Bacillus thuringiensis'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu (Helicoverpa armigera)', description: 'Olgunlaşmakta olan meyvelere delik açar.', activeIngredients: ['Avaunt (FMC)', 'Proclaim (Syngenta)'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf', description: 'Meyve saplarında ve gövdede çürüme.', activeIngredients: ['Signum (BASF)', 'Switch (Syngenta)'] },
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Meyvelerde kahverengi sert çürümeler.', activeIngredients: ['Acrobat Plus (BASF)', 'Aliette (Bayer) - Aktif: Fosetyl-Al'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Meyve irileşmesi için.', activeIngredients: ['Multi-K (Haifa)', 'SoluPotasse (Tessenderlo)'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Renklenme, parlaklık ve tat (Brix) artışı.', activeIngredients: ['KTS (Tessenderlo Kerley) - Sıvı Potasyum Tiyosülfat', 'YaraTera Krista K (Yara)'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf ve Alternaria (Erken Yanıklık)', description: 'Hasat yaralarından ve nemden dolayı çürüme.', activeIngredients: ['Serenade (Bayer) - Biyolojik (Bacillus subtilis)', 'Switch (Syngenta) - Kısa PHI'] }
        ]
    },
    ELMA: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Elma Karalekesi', description: 'Uyanma dönemi ilk enfeksiyon başlangıcıdır.', activeIngredients: ['Bordo Bulamacı (Hektaş) - %2 Dozda', 'Kocide 2000 (Certis)', 'Syllit (Agriphar) - Aktif: Dodine'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Sürgün kışlaklarındaki miseller uyanır.', activeIngredients: ['Kumulus (BASF) - Suyla karışabilir kükürt'] },
            { type: 'ZARARLI', name: 'Elma Gözkurdu ve Yaprakbiti (Kışlık yumurtalar)', description: 'Uyanan gözlerde emgi yapar.', activeIngredients: ['Yazlık Yağlar + İzinli İnsektisit (Örn. Chlorpyrifos-methyl)'] },
            { type: 'BESLEME', name: 'Çinko ve Bor (Uyanma Öncesi)', description: 'Tomurcuk patlamasını eşzamanlı yapmak için.', activeIngredients: ['YaraVita Zintrac (Yara)', 'YaraVita Bortrac (Yara)'] }
        ],
        PEMBE_TOMURCUK: [
            { type: 'HASTALIK', name: 'Elma Karalekesi (Venturia inaequalis)', description: 'Yağmurlarla birlikte spor uçuşu en yoğundur.', activeIngredients: ['Syllit (Agriphar) - Aktif: Dodine', 'Delan (BASF) - Aktif: Dithianon', 'Merpan 80 WG (Adama) - Aktif: Captan', 'Systhane (Corteva) - Aktif: Myclobutanil'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yapraklarda ve tomurcuklarda beyaz unsu örtü.', activeIngredients: ['Topas (Syngenta) - Aktif: Penconazole', 'Nimrod (Adama) - Aktif: Bupirimate'] },
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Pembe tomurcukta önleyici ilaçlama şarttır.', activeIngredients: ['Folicur (Bayer) - Aktif: Tebuconazole', 'Merpan 80 WG (Adama)'] },
            { type: 'ZARARLI', name: 'Yaprakbiti ve Gözkurdu', description: 'Tomurcukları kemirir.', activeIngredients: ['Calypso (Bayer) - Aktif: Thiacloprid (Eğer yasaklanmadıysa)', 'Mospilan (Sumi Agro)'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası (Monilinia laxa)', description: 'Çiçeklerin yanmış gibi kurumasına yol açar.', activeIngredients: ['Merpan 80 WG (Adama)', 'Signum (BASF) - Aktif: Boscalid + Pyraclostrobin'] },
            { type: 'HASTALIK', name: 'Ateş Yanıklığı (Erwinia amylovora)', description: 'Çiçeklerde enfeksiyon, sürgünlerde geriye doğru kararma-çengel.', activeIngredients: ['Aliette (Bayer) - Aktif: Fosetyl-Al', 'Kocide 2000 (Düşük doz)', 'Kasumin (Hokko) - Aktif: Kasugamycin (İzinli ise)'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Polen çimlenmesini maksimize etmek için.', activeIngredients: ['Isabion (Syngenta)', 'YaraVita Bortrac (Yara)'] }
        ],
        MEYVE_GELISIMI: [
            { type: 'BESLEME', name: 'Kalsiyum Takviyesi (Acı Benek Önleme)', description: 'Hücre duvarı sağlamlığı, acı benek önleme.', activeIngredients: ['Stopit (Yara) - Sıvı Kalsiyum Klorür', 'Caltrac (Yara)', 'Wuxal Calcium (Aglukon)'] },
            { type: 'ZARARLI', name: 'Elma İçkurdu (Cydia pomonella)', description: 'Elmanın en önemli zararlısı. Larvalar meyveyi deler.', activeIngredients: ['Coragen (FMC) - Aktif: Chlorantraniliprole', 'Radiant (Corteva) - Aktif: Spinetoram', 'Imidan (Gowan) - Aktif: Phosmet', 'Runner (Corteva) - Aktif: Methoxyfenozide', 'Madex (Andermatt) - CpGV Virüsü'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Sıcak aylarda yaprakları sarartır.', activeIngredients: ['Agrimec (Syngenta) - Aktif: Abamectin', 'Floramite (UPL) - Aktif: Bifenazate', 'Envidor (Bayer) - Aktif: Spirodiclofen', 'Zoom (Valent) - Aktif: Etoxazole'] },
            { type: 'ZARARLI', name: 'San Jose Kabuklubiti', description: 'Meyvede kırmızı haleli lekeler yapar.', activeIngredients: ['Admiral (Sumi Agro) - Aktif: Pyriproxyfen', 'Movento (Bayer) - Aktif: Spirotetramat'] },
            { type: 'HASTALIK', name: 'Elma Karalekesi', description: 'Meyve üzerinde lekelenme ve çatlama yapar.', activeIngredients: ['Score 250 EC (Syngenta) - Aktif: Difenoconazole', 'Merpan 80 WG (Adama)', 'Cabrio (BASF) - Aktif: Pyraclostrobin'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Sürgün gelişimini durdurur.', activeIngredients: ['Topas (Syngenta)', 'Kumulus (BASF)'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Meyve irileşmesi için.', activeIngredients: ['Multi-K (Haifa)', 'Novalon 5-5-40 (Doktor Tarsa)'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Renklenme ve tat.', activeIngredients: ['SoluPotasse (Tessenderlo)', 'KTS (Tessenderlo Kerley)'] },
            { type: 'HASTALIK', name: 'Hasat Öncesi Çürüklükler (Penicillium, Alternaria)', description: 'Depo ömrünü azaltan mantari çürümeler.', activeIngredients: ['Geoxe (Syngenta) - Aktif: Fludioxonil', 'Merpan 80 WG (Adama)'] },
            { type: 'ZARARLI', name: 'Elma İçkurdu (Son Döl)', description: 'Geçci çeşitlerde vurukları engellemek.', activeIngredients: ['Radiant (Corteva) - PHI süresi 7 gün', 'Madex (Andermatt) - Sıfır kalıntı'] }
        ]
    },
    BAG: {
        UYANMA: [
            { type: 'HASTALIK', name: 'Ölükol (Phomopsis viticola)', description: 'Kışlık ilaçlama ve budama önlemleri.', activeIngredients: ['Bordo Bulamacı (Hektaş)', 'Cuprocol (Syngenta) - Bakır oksiklorür'] },
            { type: 'ZARARLI', name: 'Bağ Uyuzu', description: 'Uyanan gözlerde emgi yapar.', activeIngredients: ['Kumulus (BASF) - Kükürt', 'Agrimec (Syngenta) - Abamectin'] },
            { type: 'BESLEME', name: 'Çinko-Bor İhtiyacı', description: 'Eşzamanlı uyanma.', activeIngredients: ['YaraVita Zintrac (Yara)', 'Speedfol Çinko (Doktor Tarsa)'] }
        ],
        SURGUN: [
            { type: 'HASTALIK', name: 'Ölükol', description: 'Sürgünlerde çatlaklar, lekeler.', activeIngredients: ['Dithane M-45 (Corteva) - Aktif: Mancozeb', 'Merpan 80 WG (Adama) - Aktif: Captan', 'Folpan (Adama) - Aktif: Folpet'] },
            { type: 'HASTALIK', name: 'Külleme (Erysiphe necator)', description: 'Sürgün ve yapraklarda unsu tabaka.', activeIngredients: ['Kumulus (BASF) - Toz Kükürt', 'Topas (Syngenta) - Aktif: Penconazole', 'Systhane (Corteva) - Aktif: Myclobutanil'] },
            { type: 'ZARARLI', name: 'Bağ Yaprakuyuzu ve Kırmızı Örümcek', description: 'Yaprak altlarında kabarcıklar, kuruma.', activeIngredients: ['Agrimec (Syngenta)', 'Envidor (Bayer)'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Mildiyö (Plasmopara viticola)', description: 'Yağmurlarla enfeksiyon riski çok yüksektir.', activeIngredients: ['Ridomil Gold MZ (Syngenta) - Aktif: Metalaxyl-M + Mancozeb', 'Acrobat Plus (BASF) - Aktif: Dimethomorph + Mancozeb', 'Curzate (Corteva) - Aktif: Cymoxanil'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Çiçek salkımlarını kurutabilir.', activeIngredients: ['Topas (Syngenta)', 'Folicur (Bayer) - Aktif: Tebuconazole'] },
            { type: 'BESLEME', name: 'Bor, Çinko, Fosfor', description: 'Boncuklanmayı (iri/ufak tane) engellemek.', activeIngredients: ['YaraVita Bortrac (Yara)', 'Isabion (Syngenta)'] },
            { type: 'ZARARLI', name: 'Trips', description: 'Çiçekleri döker.', activeIngredients: ['Laser (Corteva) - Aktif: Spinosad'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Salkımlarda kahverengileşme.', activeIngredients: ['Ridomil Gold MZ (Syngenta)', 'Aliette (Bayer) - Aktif: Fosetyl-Al'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Tanelerde çatlama.', activeIngredients: ['Kumulus (BASF)', 'Folicur (Bayer)', 'Ortiva (Syngenta) - Aktif: Azoxystrobin'] },
            { type: 'ZARARLI', name: 'Salkım Güvesi (Lobesia botrana)', description: 'Korukları delerek beslenir, kurşuni küf kapısı açar.', activeIngredients: ['Coragen (FMC) - Aktif: Chlorantraniliprole', 'Laser (Corteva) - Aktif: Spinosad', 'Avaunt (FMC) - Aktif: Indoxacarb', 'Dipel (Valent) - Aktif: Bacillus thuringiensis'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis cinerea)', description: 'Salkım kapanmadan önce ilaçlama şarttır.', activeIngredients: ['Signum (BASF) - Aktif: Boscalid + Pyraclostrobin', 'Switch (Syngenta) - Aktif: Fludioxonil + Cyprodinil'] },
            { type: 'BESLEME', name: 'Potasyum ve Magnezyum', description: 'Tane irileşmesi.', activeIngredients: ['Epsom Tuzu (Magnezyum Sülfat)', 'Multi-K (Haifa) - Potasyum Nitrat'] }
        ],
        BEN_DUSME: [
            { type: 'HASTALIK', name: 'Kurşuni Küf', description: 'Nem ve çatlamalar çürümeyi başlatır.', activeIngredients: ['Teldor (Bayer) - Aktif: Fenhexamid', 'Switch (Syngenta)'] },
            { type: 'ZARARLI', name: 'Salkım Güvesi', description: 'Tatlılaşan taneleri deler.', activeIngredients: ['Laser (Corteva)', 'Proclaim (Syngenta) - Aktif: Emamectin benzoate'] },
            { type: 'BESLEME', name: 'Potasyum', description: 'Renk ve şeker (Brix) oranını tavan yaptırır.', activeIngredients: ['KTS (Tessenderlo Kerley) - Sıvı Potasyum Tiyosülfat'] }
        ],
        HASAT: [
            { type: 'HASTALIK', name: 'Kurşuni Küf', description: 'Hasat öncesi kritik son dönem.', activeIngredients: ['Switch (Syngenta) - Kısa PHI değerli', 'Serenade (Bayer) - Biyolojik'] },
            { type: 'ZARARLI', name: 'Arı ve Kuş Zararı', description: 'Meyveleri parçalarlar.', activeIngredients: ['Kültürel önlem (Tül vb)'] }
        ]
    },
    ZEYTIN: {
        SÜRGÜN: [
            { type: 'HASTALIK', name: 'Zeytin Halkalı Lekesi (Spilocaea oleagina)', description: 'Tavus gözü lekesi, şiddetli yaprak dökümü.', activeIngredients: ['Bordo Bulamacı (Hektaş)', 'Cuprocol (Syngenta) - Bakır oksiklorür', 'Stroby (BASF) - Aktif: Kresoxim-methyl'] },
            { type: 'ZARARLI', name: 'Zeytin Güvesi (Prays oleae) - Yaprak Dölü', description: 'Yapraklarda galeriler açar.', activeIngredients: ['Decis (Bayer) - Aktif: Deltamethrin', 'Bi-58 (BASF) - Aktif: Dimethoate (İzinli ise)'] },
            { type: 'BESLEME', name: 'Azot ve Bor', description: 'Yeni sürgünler ve tomurcuk farklılaşması.', activeIngredients: ['Toros Üre (Toros Tarım)', 'YaraVita Bortrac (Yara)'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Zeytin Güvesi - Çiçek Dölü', description: 'Çiçek salkımlarını yer.', activeIngredients: ['Dipel (Valent) - Aktif: Bacillus thuringiensis', 'Decis (Bayer)'] },
            { type: 'ZARARLI', name: 'Zeytin Pamuklubiti', description: 'Tomurcuklarda pamukçuk salgısı.', activeIngredients: ['Bi-58 (BASF) - Aktif: Dimethoate', 'Dursban 4 (Corteva)'] },
            { type: 'BESLEME', name: 'Bor İhtiyacı', description: 'Tozlanma ve meyve tutumunu artırmak için.', activeIngredients: ['Speedfol Bor (Doktor Tarsa)'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Zeytin Güvesi - Meyve Dölü', description: 'Zeytinin içine girip çekirdeği yer.', activeIngredients: ['Bi-58 (BASF)', 'Laser (Corteva) - Aktif: Spinosad'] },
            { type: 'ZARARLI', name: 'Zeytin Sineği (Bactrocera oleae) - İlk Vuruk', description: 'Erken zeytin sineği popülasyonu.', activeIngredients: ['Success (Corteva) - Aktif: Spinosad', 'Bi-58 (BASF)'] },
            { type: 'BESLEME', name: 'Fosfor ve Potasyum', description: 'Meyve irileşmesi.', activeIngredients: ['Novalon 10-52-10 (Doktor Tarsa)', 'Multi-K (Haifa)'] }
        ],
        CEKIRDEK: [
            { type: 'ZARARLI', name: 'Zeytin Sineği', description: 'Meyve etine yumurta bırakır, kurtlanma.', activeIngredients: ['Success 0.24 CB (Corteva) - Spinosad (Zehirli yem)', 'Decis (Bayer)', 'Surround (Engelhard) - Kaolin kili (Uzaklaştırıcı)'] },
            { type: 'ZARARLI', name: 'Zeytin Güvesi - Meyve Dölü', description: 'Hasada doğru meyve dökümüne sebep olur.', activeIngredients: ['Laser (Corteva)', 'Decis (Bayer)'] },
            { type: 'HASTALIK', name: 'Zeytin Dal Kanseri', description: 'Dolu ve budama yaralarından giren bakteri ürleri.', activeIngredients: ['Bordo Bulamacı (Hektaş)', 'Kocide 2000 (Certis)'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Zeytin Sineği', description: 'Zeytinyağı asiditesini son aşamada bozar.', activeIngredients: ['Success (Corteva) - Kısa kalıntı süresi'] },
            { type: 'HASTALIK', name: 'Zeytin Halkalı Lekesi (Sonbahar enfeksiyonu)', description: 'Yağmurlarla birlikte yeniden başlar.', activeIngredients: ['Bordo Bulamacı (Hektaş) - Hasat sonrası %2 dozda'] }
        ]
    },
    BADEM: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Uyanan tomurcuklarda risk.', activeIngredients: ['Merpan 80 WG (Adama) - Aktif: Captan', 'Folicur (Bayer) - Aktif: Tebuconazole'] },
            { type: 'HASTALIK', name: 'Badem Yaprak Delen (Klasterosporium)', description: 'Yapraklarda delinmeler başlar.', activeIngredients: ['Bordo Bulamacı (Hektaş)', 'Merpan 80 WG (Adama)'] },
            { type: 'BESLEME', name: 'Çinko-Bor', description: 'Gözlerin güçlü uyanması.', activeIngredients: ['Zinc 15 (Doktor Tarsa)', 'YaraVita Bortrac (Yara)'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Çiçeklerin yanmış gibi kurumasına neden olur.', activeIngredients: ['Signum (BASF) - Aktif: Boscalid + Pyraclostrobin', 'Systhane (Corteva) - Aktif: Myclobutanil'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Döllenme gücü için.', activeIngredients: ['Speedfol Bor (Doktor Tarsa)'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Badem İçkurdu (Eurytoma amygdali)', description: 'Çağla 7-8mm iken ilaçlama gerekir.', activeIngredients: ['Decis (Bayer) - Aktif: Deltamethrin', 'Karate Zeon (Syngenta) - Aktif: Lambda-cyhalothrin'] },
            { type: 'HASTALIK', name: 'Yaprak Delen', description: 'Meyvelerde ve yapraklarda lekeler.', activeIngredients: ['Merpan 80 WG (Adama)', 'Pomarsol Forte (Bayer) - Aktif: Thiram'] },
            { type: 'BESLEME', name: 'Azot ve Fosfor', description: 'Meyve dökümünü engellemek.', activeIngredients: ['YaraMila Complex (Yara)'] }
        ],
        IC_DOLDURMA: [
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprakları zayıflatır.', activeIngredients: ['Envidor (Bayer) - Aktif: Spirodiclofen', 'Agrimec (Syngenta) - Aktif: Abamectin'] },
            { type: 'BESLEME', name: 'Potasyum ve Çinko İhtiyacı', description: 'İç doldurma oranını artırmak için.', activeIngredients: ['SoluPotasse (Tessenderlo)', 'YaraVita Zintrac (Yara)'] }
        ],
        KABUK_CATLAMA: [
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Geç dönem popülasyon.', activeIngredients: ['Agrimec (Syngenta)'] }
        ]
    },
    YER_FISTIGI: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Boğazı Çürüklüğü (Aspergillus niger, Sclerotium rolfsii)', description: 'Çıkış öncesi ve sonrası fidelerde kurumalara neden olur.', activeIngredients: ['Pomarsol (Bayer) - Tohum İlaçlaması (Thiram)', 'Celest (Syngenta) - Tohum İlaçlaması (Fludioxonil)', 'Amistar (Syngenta) - Toprak (Azoxystrobin)'] },
            { type: 'YABANCI_OT', name: 'Yabancı Otlar', description: 'Yer fıstığının ilk gelişimi yavaş olduğundan ot rekabetine çok hassastır.', activeIngredients: ['Stomp Aqua (BASF) - Aktif: Pendimethalin (Ekim öncesi)', 'Pulsar (BASF) - Aktif: Imazamox (Çıkış sonrası)'] }
        ],
        CICEKLENME: [
            { type: 'BESLEME', name: 'Kalsiyum (Ca) ve Bor İhtiyacı', description: 'Çiçeklenme yoğunluğunu ve iğne oluşumunu teşvik.', activeIngredients: ['YaraLiva Calcinit (Yara) - Kalsiyum Nitrat', 'YaraVita Bortrac (Yara)'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu (Helicoverpa)', description: 'Çiçekleri ve iğneleri yer.', activeIngredients: ['Avaunt (FMC) - Aktif: Indoxacarb'] }
        ],
        IGNE_OLUSUMU: [
            { type: 'BESLEME', name: 'Kalsiyum (Ca) İhtiyacı (Mutlak)', description: 'İğnelerin toprağa girmesi ve boş kapsül (pop) oranının düşmesi için kalsiyuma mutlak ihtiyaç vardır.', activeIngredients: ['Kalsiyum Sülfat (Jips)'] },
            { type: 'HASTALIK', name: 'Yaprak Lekesi (Cercospora arachidicola)', description: 'Yapraklarda kahverengi/siyah lekeler ve erken yaprak dökümü.', activeIngredients: ['Bravo (Syngenta) - Aktif: Chlorothalonil', 'Folicur (Bayer) - Aktif: Tebuconazole', 'Amistar Top (Syngenta) - Aktif: Azoxystrobin + Difenoconazole'] }
        ],
        KAPSUL: [
            { type: 'HASTALIK', name: 'Yaprak Lekesi (Cercospora)', description: 'Dökülmelerin şiddetlenmesi verimi düşürür.', activeIngredients: ['Folicur (Bayer)', 'Amistar (Syngenta)'] },
            { type: 'BESLEME', name: 'Potasyum', description: 'Kapsül dolumu için.', activeIngredients: ['YaraTera Krista K (Yara) - Potasyum Nitrat'] },
            { type: 'ZARARLI', name: 'Toprakaltı Zararlıları', description: 'Kapsülleri kemirirler.', activeIngredients: ['Dursban 4 (Corteva) - Aktif: Chlorpyrifos (Toprak uygulaması)'] }
        ],
        HASAT: [
            { type: 'HASTALIK', name: 'Meyve Çürüklükleri (Sclerotium)', description: 'Kapsüllerde beyaz misel tabakası ve çürüme.', activeIngredients: ['Kültürel önlem, ürün rotasyonu'] }
        ]
    },
    MERCIMEK: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Fusarium, Rhizoctonia)', description: 'Toprak kaynaklı patojenler fidelerin sararıp ölmesine neden olur.', activeIngredients: ['Kültürel önlem: Ekim nöbeti', 'Pomarsol (Bayer) - Tohum ilaçlaması (Thiram)'] },
            { type: 'YABANCI_OT', name: 'Geniş ve Dar Yapraklı Otlar', description: 'Mercimek bitkisi kısa boylu olduğu için ot rekabetine zayıftır.', activeIngredients: ['Stomp Aqua (BASF) - Aktif: Pendimethalin', 'Afalon (Bayer) - Aktif: Linuron'] }
        ],
        DALLANMA: [
            { type: 'ZARARLI', name: 'Mercimek Hortumlu Böceği (Sitona crinitus)', description: 'Erginler yaprak kenarlarını oyar, larvalar kök nodyumlarını yer.', activeIngredients: ['Fastac (BASF) - Aktif: Alpha-cypermethrin', 'Decis (Bayer) - Aktif: Deltamethrin'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Apion (Apion spp.)', description: 'Larvalar gövde ve tepe tomurcuklarında beslenir, gelişimi durdurur.', activeIngredients: ['Malathion 65 EM (Hektaş)', 'Decis (Bayer)'] },
            { type: 'ZARARLI', name: 'Mercimek Hortumlu Böceği', description: 'Zararı devam eder.', activeIngredients: ['Karate Zeon (Syngenta) - Aktif: Lambda-cyhalothrin'] },
            { type: 'HASTALIK', name: 'Mildiyö ve Pas', description: 'Nemli bölgelerde çiçekleri döker.', activeIngredients: ['Dithane M-45 (Corteva) - Aktif: Mancozeb'] }
        ],
        BAKLA_OLUSUMU: [
            { type: 'ZARARLI', name: 'Yeşil Kurt (Helicoverpa)', description: 'Baklaları deler.', activeIngredients: ['Avaunt (FMC) - Aktif: Indoxacarb'] },
            { type: 'BESLEME', name: 'Fosfor ve Potasyum', description: 'Bakla dolumu için.', activeIngredients: ['Novalon (Doktor Tarsa) - Yapraktan NP-K'] }
        ]
    },
    SOYA: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü', description: 'Soğuk topraklarda çimlenme sorunları.', activeIngredients: ['Pomarsol (Bayer) - Aktif: Thiram', 'Apron (Syngenta) - Aktif: Metalaxyl'] },
            { type: 'YABANCI_OT', name: 'Yabancı Otlar', description: 'Erken dönem ot rekabeti.', activeIngredients: ['Pulsar (BASF) - Aktif: Imazamox', 'Stomp Aqua (BASF) - Aktif: Pendimethalin'] }
        ],
        VEGETATIF: [
            { type: 'ZARARLI', name: 'Soya Kapsülkurdu (Etiella zinckenella)', description: 'Gövdeye ve ileride kapsüle girer.', activeIngredients: ['Avaunt (FMC) - Aktif: Indoxacarb', 'Coragen (FMC) - Aktif: Chlorantraniliprole'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu', description: 'Yaprakları ve sürgünleri yer.', activeIngredients: ['Proclaim (Syngenta) - Aktif: Emamectin benzoate'] },
            { type: 'BESLEME', name: 'Bakteri Aşısı ve Azot', description: 'Rhizobium bakterisi nodüllerinin oluşumu.', activeIngredients: ['Düşük doz Azot (Başlangıç)'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Mildiyö (Peronospora manshurica)', description: 'Yapraklarda sarımsı lekeler, mantar örtüsü.', activeIngredients: ['Dithane M-45 (Corteva) - Aktif: Mancozeb', 'Ridomil Gold (Syngenta) - Aktif: Metalaxyl-M'] },
            { type: 'ZARARLI', name: 'Yeşil Kokarca (Nezara viridula)', description: 'Çiçekleri emer.', activeIngredients: ['Mospilan (Sumi Agro) - Aktif: Acetamiprid', 'Actara (Syngenta) - Aktif: Thiamethoxam'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Çiçek dökümünü azaltır.', activeIngredients: ['YaraVita Bortrac (Yara)'] }
        ],
        BAKLA: [
            { type: 'ZARARLI', name: 'Soya Kapsülkurdu', description: 'Kapsülleri delerek tohumları yer.', activeIngredients: ['Radiant (Corteva) - Aktif: Spinetoram', 'Coragen (FMC)'] },
            { type: 'ZARARLI', name: 'Yeşil Kokarca', description: 'Kapsülleri emerek buruşuk tohuma neden olur.', activeIngredients: ['Decis (Bayer) - Aktif: Deltamethrin'] },
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Nemli havalarda zarara devam eder.', activeIngredients: ['Curzate (Corteva) - Aktif: Cymoxanil'] }
        ],
        TANE_DOLUM: [
            { type: 'ZARARLI', name: 'Yeşil Kokarca', description: 'Kaliteyi bozar.', activeIngredients: ['Mospilan (Sumi Agro) - Aktif: Acetamiprid'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Yağ ve protein oranını artırmak için.', activeIngredients: ['SoluPotasse (Tessenderlo)', 'Multi-K (Haifa)'] }
        ]
    },
    KIMYON: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Solgunluk (Fusarium oxysporum)', description: 'Erken dönemde köklerde enfeksiyon.', activeIngredients: ['Tohum ilaçlaması (Thiram, Fludioxonil)'] },
            { type: 'YABANCI_OT', name: 'Ot Rekabeti', description: 'Rozet döneminde çok yavaş büyür, ot boğar.', activeIngredients: ['Afalon (Bayer) - Aktif: Linuron (Çıkış öncesi)', 'El ile yolma'] }
        ],
        SAPA_KALKMA: [
            { type: 'HASTALIK', name: 'Yanıklık (Alternaria spp.)', description: 'Yaprak ve saplarda kahverengi-siyah lekeler. Şiddetli zararlıdır.', activeIngredients: ['Dithane M-45 (Corteva) - Aktif: Mancozeb', 'Folicur (Bayer) - Aktif: Tebuconazole', 'Ortiva (Syngenta) - Aktif: Azoxystrobin'] },
            { type: 'HASTALIK', name: 'Solgunluk (Fusarium)', description: 'İletim demetlerinin tıkanmasıyla bitki aniden çöker.', activeIngredients: ['Dayanıklı tohum, Kültürel önlemler'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Kimyon Güvesi (Depressaria daucella)', description: 'Şemsiyelerde ağ örer, çiçek ve tohum taslaklarını yer.', activeIngredients: ['Dipel (Valent) - Aktif: Bacillus thuringiensis', 'Decis (Bayer) - Aktif: Deltamethrin', 'Malathion (Hektaş)'] },
            { type: 'HASTALIK', name: 'Yanıklık (Alternaria)', description: 'Şemsiyeleri kurutarak tohum bağlamayı engeller.', activeIngredients: ['Amistar (Syngenta) - Aktif: Azoxystrobin', 'Cabrio (BASF) - Aktif: Pyraclostrobin'] }
        ],
        TOHUM_BAGLAMA: [
            { type: 'ZARARLI', name: 'Kimyon Güvesi', description: 'Tohumları yiyerek boşaltır.', activeIngredients: ['Decis (Bayer) - Aktif: Deltamethrin'] },
            { type: 'BESLEME', name: 'Potasyum ve Fosfor', description: 'Tohum iriliği için.', activeIngredients: ['Novalon (Doktor Tarsa) - Yapraktan gübreleme'] }
        ]
    },
    BAMYA: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Çökerten)', description: 'Fidelerde kuruma.', activeIngredients: ['Apron (Syngenta) - Aktif: Metalaxyl', 'Pomarsol (Bayer) - Aktif: Thiram'] },
            { type: 'ZARARLI', name: 'Bozkurt', description: 'Fideleri keser.', activeIngredients: ['Dursban 4 (Corteva) - Aktif: Chlorpyrifos (Toprak)'] }
        ],
        GELISIM: [
            { type: 'HASTALIK', name: 'Külleme (Erysiphe cichoracearum)', description: 'Yapraklarda beyaz unsu tabaka.', activeIngredients: ['Topas (Syngenta) - Aktif: Penconazole', 'Kumulus (BASF) - Kükürt', 'Systhane (Corteva) - Aktif: Myclobutanil'] },
            { type: 'ZARARLI', name: 'Pamuk Yaprakkurdu (Spodoptera)', description: 'Yaprakları yiyerek zar zar bırakır.', activeIngredients: ['Avaunt (FMC) - Aktif: Indoxacarb', 'Proclaim (Syngenta) - Aktif: Emamectin benzoate'] },
            { type: 'ZARARLI', name: 'Yaprakbitleri', description: 'Özsuyu emerek yaprağı kıvırır.', activeIngredients: ['Mospilan (Sumi Agro) - Aktif: Acetamiprid'] },
            { type: 'BESLEME', name: 'Azot İhtiyacı', description: 'Hızlı boylanma.', activeIngredients: ['Toros CAN 26 (Toros) - Amonyum Nitrat'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu (Helicoverpa)', description: 'Çiçekleri deler.', activeIngredients: ['Avaunt (FMC) - Aktif: Indoxacarb'] },
            { type: 'ZARARLI', name: 'Yaprakbitleri', description: 'Çiçeklere de zarar verir.', activeIngredients: ['Actara (Syngenta) - Aktif: Thiamethoxam'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Mücadele edilmezse kurutur.', activeIngredients: ['Kumulus (BASF)', 'Topas (Syngenta)'] }
        ],
        MEYVE: [
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu ve Yaprakkurdu', description: 'Meyveleri delerek pazar değerini sıfırlar.', activeIngredients: ['Proclaim (Syngenta) - Aktif: Emamectin benzoate', 'Alverde (BASF) - Aktif: Metaflumizone'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Alt yapraklardan kuruma başlatır.', activeIngredients: ['Agrimec (Syngenta) - Aktif: Abamectin', 'Oberon (Bayer) - Aktif: Spiromesifen'] },
            { type: 'BESLEME', name: 'Düzenli Sulama ve Besleme', description: 'Meyvelerin hızlı irileşip kartlaşmaması için sürekli nem ve azot/potasyum.', activeIngredients: ['Novalon Damlama Gübreleri (Doktor Tarsa)'] }
        ]
    },
    NAR: {
        UYANMA: [
            { type: 'HASTALIK', name: 'Nar Kahverengi Leke Hastalığı', description: 'İlk enfeksiyonlar başlar.', activeIngredients: ['Bordo Bulamacı (Hektaş)', 'Cuprocol (Syngenta) - Bakır oksiklorür'] },
            { type: 'BESLEME', name: 'Çinko-Bor', description: 'Göz uyanması.', activeIngredients: ['Zinc 15 (Doktor Tarsa)', 'YaraVita Zintrac (Yara)'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Nar Yaprakbiti (Aphis punicae)', description: 'Sürgün ve çiçeklerde koloniler oluşturur. Ballı madde salgılar.', activeIngredients: ['Mospilan (Sumi Agro) - Aktif: Acetamiprid', 'Actara (Syngenta) - Aktif: Thiamethoxam'] },
            { type: 'HASTALIK', name: 'Kahverengi Leke', description: 'Çiçek dökümü yapabilir.', activeIngredients: ['Dithane M-45 (Corteva) - Aktif: Mancozeb', 'Merpan 80 WG (Adama) - Aktif: Captan'] }
        ],
        MEYVE_BUYUMESI: [
            { type: 'ZARARLI', name: 'Nar Yaprakbiti', description: 'Zararına devam eder.', activeIngredients: ['Confidor (Bayer) - Aktif: Imidacloprid'] },
            { type: 'ZARARLI', name: 'Harnup Güvesi (Ectomyelois ceratoniae)', description: 'Yumurtalarını taç kısmına bırakır.', activeIngredients: ['Dipel (Valent) - Aktif: Bacillus thuringiensis', 'Laser (Corteva) - Aktif: Spinosad'] },
            { type: 'ZARARLI', name: 'Akdeniz Meyve Sineği', description: 'Erken vuruklar.', activeIngredients: ['Zehirli Yem Dalı (Spinosad veya Malathion)'] },
            { type: 'BESLEME', name: 'Meyve Çatlaması (Fizyolojik)', description: 'Düzensiz sulama ve kalsiyum eksikliği meyve çatlatır.', activeIngredients: ['YaraLiva Calcinit (Yara) - Kalsiyum Nitrat', 'YaraVita Bortrac (Yara)', 'Düzenli Sulama'] },
            { type: 'HASTALIK', name: 'Kahverengi Leke', description: 'Meyvelerde lekeler.', activeIngredients: ['Ortiva (Syngenta) - Aktif: Azoxystrobin'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Akdeniz Meyve Sineği (Ceratitis capitata)', description: 'Kabuğa yumurta bırakır, meyve çürür.', activeIngredients: ['Success 0.24 CB (Corteva) - Spinosad (Zehirli Yem)', 'Malathion (Hektaş)', 'Decis (Bayer) - Aktif: Deltamethrin'] },
            { type: 'ZARARLI', name: 'Harnup Güvesi', description: 'Özellikle çatlak narlara girerek taneleri yer, mantari çürümelere sebep olur.', activeIngredients: ['Runner (Corteva) - Aktif: Methoxyfenozide', 'Dipel (Valent) - Aktif: Bacillus thuringiensis'] },
            { type: 'BESLEME', name: 'Potasyum', description: 'Renk ve kalite.', activeIngredients: ['KTS (Tessenderlo Kerley) - Sıvı Potasyum', 'Multi-K (Haifa)'] }
        ]
    }
};

export const GENERIC_PROBLEMS: Record<string, any[]> = {
    FIDE: [
        { type: 'BESLEME', name: 'Kök Geliştirici ve Fosfor İhtiyacı', description: 'Fidenin şaşırtılması veya çimlenme sonrasında güçlü kök yapısı oluşturması için fosfor ve kök uyarıcılara ihtiyaç vardır.', activeIngredients: ['Novalon 10-52-10 (Doktor Tarsa) - MAP tabanlı', 'Acadian (Acadian Seaplants) - Deniz Yosunu', 'Isabion (Syngenta) - Aminoasit', 'Rooting Hormonları (IBA, NAA)'] },
        { type: 'HASTALIK', name: 'Kök Çürüklüğü (Çökerten)', description: 'Toprak kaynaklı mantarların neden olduğu fide devrilmesi ve kuruması.', activeIngredients: ['Previcur Energy (Bayer) - Aktif: Propamocarb + Fosetyl', 'Ridomil Gold (Syngenta) - Aktif: Metalaxyl-M', 'Pomarsol Forte (Bayer) - Aktif: Thiram', 'Merpan 80 WG (Adama) - Aktif: Captan'] },
        { type: 'ZARARLI', name: 'Toprakaltı Zararlıları', description: 'Kökleri keser.', activeIngredients: ['Dursban 4 (Corteva) - Aktif: Chlorpyrifos', 'Force 20 CS (Syngenta) - Aktif: Tefluthrin'] }
    ],
    VEGETATIF: [
        { type: 'BESLEME', name: 'Azot ve İz Element İhtiyacı', description: 'Bitkinin yeşil aksamının (boy, yaprak) hızla geliştiği bu dönemde yoğun Azot ve Mikro element (Çinko) ihtiyacı olur.', activeIngredients: ['Toros Üre / İgsaş CAN 26', 'YaraVita Zintrac (Yara) - Çinko', 'Epsom Tuzu - Magnezyum', 'Megafol (Valagro) - Deniz Yosunu/Aminoasit'] },
        { type: 'ZARARLI', name: 'Yaprakbitleri, Beyazsinek ve Trips', description: 'Özsuyu emerek virüs taşır, yaprakları bozar.', activeIngredients: ['Mospilan (Sumi Agro) - Aktif: Acetamiprid', 'Oberon (Bayer) - Aktif: Spiromesifen', 'Laser (Corteva) - Aktif: Spinosad'] },
        { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprak sararması.', activeIngredients: ['Agrimec (Syngenta) - Aktif: Abamectin'] },
        { type: 'HASTALIK', name: 'Külleme ve Mildiyö', description: 'Yapraklarda unsu tabaka veya lekeler.', activeIngredients: ['Kumulus (BASF) - Kükürt', 'Ridomil Gold (Syngenta) - Metalaxyl', 'Ortiva (Syngenta) - Azoxystrobin'] }
    ],
    GENERATIF: [
        { type: 'BESLEME', name: 'Çiçeklenme ve Polen Tutumu İhtiyacı', description: 'Döllenmenin başarılı olması, çiçek dökümlerinin engellenmesi için Bor ve Çinko.', activeIngredients: ['Borzin (Doktor Tarsa) - Çinko-Bor Kombinasyonu', 'Novalon (Doktor Tarsa) - Fosfor', 'Isabion (Syngenta) - Deniz Yosunu'] },
        { type: 'ZARARLI', name: 'Trips ve Yaprakbitleri', description: 'Çiçekleri kurutur.', activeIngredients: ['Laser (Corteva) - Spinosad', 'Mospilan (Sumi Agro) - Acetamiprid'] },
        { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis)', description: 'Çiçek yanıklığı.', activeIngredients: ['Signum (BASF) - Boscalid', 'Switch (Syngenta) - Fludioxonil'] }
    ],
    MEYVE: [
        { type: 'BESLEME', name: 'Kalsiyum ve Potasyum', description: 'Hücre bölünmesi, irileşme ve çiçek burnu/acı benek gibi lekeleri önleme.', activeIngredients: ['YaraLiva Calcinit (Yara) - Kalsiyum Nitrat', 'SoluPotasse (Tessenderlo) - Potasyum Sülfat'] },
        { type: 'ZARARLI', name: 'Meyve Delici/İçkurtları', description: 'Meyveyi deler.', activeIngredients: ['Coragen (FMC) - Chlorantraniliprole', 'Radiant (Corteva) - Spinetoram'] },
        { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Stres.', activeIngredients: ['Oberon (Bayer) - Spiromesifen'] },
        { type: 'HASTALIK', name: 'Mildiyö ve Meyve Çürüklükleri', description: 'Meyvede leke.', activeIngredients: ['Acrobat Plus (BASF) - Dimethomorph', 'Ortiva (Syngenta) - Azoxystrobin'] }
    ],
    HASAT: [
        { type: 'BESLEME', name: 'Renk ve Briks (Şeker) Artışı', description: 'Meyvenin tam olgunlaşması, rengini alması ve tatlanması için yoğun Potasyum uygulanır.', activeIngredients: ['KTS (Tessenderlo Kerley) - Potasyum Tiyosülfat', 'Multi-K (Haifa) - Sıvı Potasyum', 'Phosfik (Valagro) - Fosfit'] },
        { type: 'HASTALIK', name: 'Hasat Öncesi Çürüklükler', description: 'Nemin artmasıyla mantari (Botrytis, Penicillium) çürümeler.', activeIngredients: ['Switch (Syngenta) - Kısa PHI değerli fungisit', 'Serenade (Bayer) - Biyolojik'] },
        { type: 'ZARARLI', name: 'Meyve Sinekleri', description: 'Vuruk.', activeIngredients: ['Success 0.24 CB (Corteva) - Zehirli Yem'] }
    ]
};
`;

let fileContent = fs.readFileSync('constants/cropData.ts', 'utf8');
const startIndex = fileContent.indexOf('export const PROBLEM_DATABASE');
if (startIndex !== -1) {
    fileContent = fileContent.substring(0, startIndex) + newProblemDB;
    fs.writeFileSync('constants/cropData.ts', fileContent, 'utf8');
    console.log('Successfully updated cropData.ts');
} else {
    console.error('Could not find PROBLEM_DATABASE export');
}

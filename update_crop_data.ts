import fs from 'fs';

let fileContent = fs.readFileSync('constants/cropData.ts', 'utf8');

// We'll replace the PROBLEM_DATABASE entirely
const newProblemDB = `export const PROBLEM_DATABASE: Record<string, Record<string, any[]>> = {
    PAMUK: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Fide Kök Çürüklüğü (Çökerten)', description: 'Fidelerin toprak seviyesinden çürüyüp devrilmesine neden olur.', activeIngredients: ['Fludioxonil + Metalaxyl-M', 'Tolclofos-methyl', 'Thiram'] },
            { type: 'ZARARLI', name: 'Telkurdu (Agriotes spp.) ve Bozkurt', description: 'Tohumları ve genç fidelerin köklerini kemirir.', activeIngredients: ['Imidacloprid (Tohum İlacı)', 'Tefluthrin', 'Chlorpyrifos-ethyl'] },
            { type: 'ZARARLI', name: 'Trips (Thysanoptera)', description: 'Genç yapraklarda gümüşi lekeler ve kıvrılmalar.', activeIngredients: ['Spinosad', 'Spinetoram', 'Acetamiprid'] },
            { type: 'YABANCI_OT', name: 'Dar Yapraklı Otlar', description: 'Erken rekabetçi otlar.', activeIngredients: ['Pendimethalin', 'Trifluralin'] },
            { type: 'BESLEME', name: 'Kök Geliştirici ve Fosfor İhtiyacı', description: 'Fide kök yapısı için.', activeIngredients: ['10-52-10 MAP', 'Hümik/Fülvik Asitler'] }
        ],
        TARAKLANMA: [
            { type: 'ZARARLI', name: 'Yeşilkurt (Helicoverpa armigera)', description: 'Tarakları delerek beslenir ve dökülmeler yapar.', activeIngredients: ['Indoxacarb', 'Chlorantraniliprole', 'Spinetoram'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği (Bemisia tabaci)', description: 'Bitki özsuyunu emer ve fumajin (karaballık) salgılar.', activeIngredients: ['Spiromesifen', 'Pyriproxyfen', 'Acetamiprid'] },
            { type: 'ZARARLI', name: 'Lygus (Bitki Tahtakurus)', description: 'Taraklara sokup emerek dökülmelere neden olur.', activeIngredients: ['Flonicamid', 'Acetamiprid'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yapraklarda kızarma ve kuruma yapar.', activeIngredients: ['Abamectin', 'Spiromesifen', 'Bifenazate'] },
            { type: 'HASTALIK', name: 'Solgunluk (Verticillium dahliae)', description: 'İletim demetlerinin tıkanmasıyla yapraklarda solma.', activeIngredients: ['Kültürel önlem: Dayanıklı çeşit'] },
            { type: 'BESLEME', name: 'Azot İhtiyacı', description: 'Hızlı boy atma dönemi.', activeIngredients: ['Üre / Amonyum Nitrat'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Yeşilkurt (Helicoverpa armigera)', description: 'Tarak, çiçek ve genç kozaları delerek beslenir.', activeIngredients: ['Indoxacarb', 'Chlorantraniliprole', 'Spinetoram'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği', description: 'Bitki özsuyunu emer ve fumajin oluşturur.', activeIngredients: ['Spiromesifen', 'Spirotetramat', 'Diafenthiuron'] },
            { type: 'ZARARLI', name: 'Lygus', description: 'Tarak ve genç kozaları döker.', activeIngredients: ['Flonicamid', 'Sulfoxaflor'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Sıcak havalarda popülasyonu artar, fotosentezi engeller.', activeIngredients: ['Abamectin', 'Bifenazate', 'Propargite'] },
            { type: 'HASTALIK', name: 'Solgunluk (Verticillium)', description: 'Çiçeklenme ile su stresi artınca belirtiler çoğalır.', activeIngredients: ['Dengeli sulama, ölçülü azot'] },
            { type: 'BESLEME', name: 'Bor ve Çinko İhtiyacı', description: 'Çiçek dökülmesini engellemek için.', activeIngredients: ['Yapraktan Bor + Çinko'] }
        ],
        KOZA: [
            { type: 'ZARARLI', name: 'Yeşilkurt ve Pembe Kurt', description: 'Kozaların içine girerek lifi ve çiğidi tahrip ederler.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Indoxacarb'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Kozaların olgunlaşmasını geciktirir.', activeIngredients: ['Abamectin', 'Spiromesifen'] },
            { type: 'ZARARLI', name: 'Beyazsinek', description: 'Açılan kozalardaki pamuk lifine ballı madde salgılar (Fumajin).', activeIngredients: ['Spiromesifen', 'Acetamiprid'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı (Koza Dolumu)', description: 'Kozaların olgunlaşması ve lif kalitesi için yüksek potasyum.', activeIngredients: ['Potasyum Nitrat', 'KTS'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Yaprak Dökücü (Defoliant) İhtiyacı', description: 'Makineli hasadı kolaylaştırmak için kozalar açtığında yaprak döktürülür.', activeIngredients: ['Thidiazuron + Diuron', 'Carfentrazone-ethyl'] },
            { type: 'ZARARLI', name: 'Beyazsinek (Son Döl)', description: 'Kaliteyi düşüren ballı madde (fumajin) salgısını önlemek için.', activeIngredients: ['Temas etkili böcek ilaçları'] }
        ]
    },
    MISIR: {
        CIKIS: [
            { type: 'ZARARLI', name: 'Bozkurt ve Telkurdu', description: 'Genç mısır fidelerini toprak seviyesinden keserek öldürür.', activeIngredients: ['Tefluthrin', 'Thiamethoxam (Tohum)'] },
            { type: 'HASTALIK', name: 'Fide Kök Çürüklüğü', description: 'Erken dönemde soğuk topraklarda görülür.', activeIngredients: ['Fludioxonil', 'Thiram'] },
            { type: 'YABANCI_OT', name: 'Dar ve Geniş Yapraklı Otlar', description: 'Mısırın ilk gelişim aşamasında ot rekabeti.', activeIngredients: ['Nicosulfuron', 'Mesotrione', 'Foramsulfuron'] },
            { type: 'BESLEME', name: 'Fosfor ve Çinko İhtiyacı', description: 'Güçlü kök gelişimi ve erken dönem soğuk stresi için.', activeIngredients: ['10-52-10 MAP', 'Kök bölgesine Çinko (Zn)'] }
        ],
        GELISIM: [
            { type: 'ZARARLI', name: 'Mısır Koçankurdu ve Mısır Kurdu', description: 'Gövdeyi delip içine girer, tepe püskülünü kırar.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Indoxacarb'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprakları kurutarak fotosentezi durdurur.', activeIngredients: ['Spiromesifen', 'Abamectin'] },
            { type: 'BESLEME', name: 'Azot ve Çinko İhtiyacı', description: 'Mısırın en çok azot tükettiği ve boylandığı dönemdir.', activeIngredients: ['Üre', 'Çinko Sülfat'] },
            { type: 'HASTALIK', name: 'Rastık (Ustilago maydis)', description: 'Sıcak ve kurak stresi sonrası bitkide şişkin ur oluşumları.', activeIngredients: ['Kültürel önlem', 'Dayanıklı çeşit'] }
        ],
        TEPE_PUSKULU: [
            { type: 'ZARARLI', name: 'Mısır Kurdu (Ostrinia nubilalis)', description: 'Tepe püskülünde beslenip koçana iner.', activeIngredients: ['Chlorantraniliprole', 'Lambda-cyhalothrin'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Bu evrede şiddetli zararı döl tutumunu etkiler.', activeIngredients: ['Spiromesifen', 'Hexythiazox'] },
            { type: 'ZARARLI', name: 'Yaprakbiti (Aphid)', description: 'Püsküllerde ballı madde salgılayarak döllenmeyi bozabilir.', activeIngredients: ['Acetamiprid'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Tozlanma verimini (koçan uç doluluğunu) artırmak için.', activeIngredients: ['Sıvı Bor (Yapraktan)'] }
        ],
        TANE_DOLUM: [
            { type: 'ZARARLI', name: 'Mısır Kurdu', description: 'Koçan içinde beslenerek doğrudan verimi düşürür ve çürüklüklere zemin hazırlar.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Tane dolum döneminde yeşil kalmayı engeller.', activeIngredients: ['Abamectin'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Tane iriliğini ve koçan ağırlığını artırır.', activeIngredients: ['Potasyum Nitrat'] },
            { type: 'HASTALIK', name: 'Koçan Çürüklükleri (Fusarium, Aspergillus)', description: 'Böcek deliklerinden girerek mikotoksin (aflatoksin) yapar.', activeIngredients: ['Zararlı mücadelesi anahtardır'] }
        ]
    },
    BUGDAY: {
        KARDESLENME: [
            { type: 'HASTALIK', name: 'Kök ve Kökboğazı Çürüklüğü', description: 'Köklerin esmerleşip çürümesi, kardeşlenmeyi zayıflatır.', activeIngredients: ['Prothioconazole', 'Tebuconazole', 'Fludioxonil (Tohum)'] },
            { type: 'ZARARLI', name: 'Ekin Bambulu', description: 'Genç yaprakları kemirerek tarlada yer yer boşluklar yaratır.', activeIngredients: ['Deltamethrin', 'Lambda-cyhalothrin'] },
            { type: 'YABANCI_OT', name: 'Geniş Yapraklı Otlar (Sinapis arvensis, vb.)', description: 'Buğdayla rekabete girer.', activeIngredients: ['Tribenuron-methyl', '2,4-D Ester'] },
            { type: 'YABANCI_OT', name: 'Dar Yapraklı Otlar (Yabani Yulaf, Delice)', description: 'Çok ciddi verim kaybı yapar.', activeIngredients: ['Clodinafop-propargyl', 'Pinoxaden'] },
            { type: 'BESLEME', name: 'Azotlu Üst Gübreleme', description: 'Kardeş sayısını artırmak için azot ihtiyacı.', activeIngredients: ['Üre', 'Amonyum Sülfat'] }
        ],
        SAPA_KALKMA: [
            { type: 'HASTALIK', name: 'Sarı Pas (Puccinia striiformis) ve Kahverengi Pas', description: 'Yapraklarda makine dikişi şeklinde sarı püstüller oluşur.', activeIngredients: ['Tebuconazole', 'Epoxiconazole', 'Azoxystrobin'] },
            { type: 'HASTALIK', name: 'Septoria Yaprak Lekesi', description: 'Alt yapraklardan başlayarak kahverengi nekrotik lekeler oluşturur.', activeIngredients: ['Prothioconazole', 'Pyraclostrobin'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yapraklarda beyaz unsu örtü.', activeIngredients: ['Tebuconazole', 'Cyproconazole'] },
            { type: 'ZARARLI', name: 'Süne (Ergin Göçü)', description: 'Kışlaklardan tarlaya göç eden erginler gövdeyi sokup emerek akbaşak yapar.', activeIngredients: ['Lambda-cyhalothrin', 'Zeta-cypermethrin'] },
            { type: 'BESLEME', name: 'İkinci Azot Uygulaması', description: 'Başak oluşumunu ve boyu destekler.', activeIngredients: ['Amonyum Nitrat (CAN)'] }
        ],
        BASAKLANMA: [
            { type: 'ZARARLI', name: 'Süne (Nimf/Yavru)', description: 'Süt olumunda taneleri emerek ekmeklik kaliteyi düşürür.', activeIngredients: ['Lambda-cyhalothrin', 'Deltamethrin', 'Alpha-cypermethrin'] },
            { type: 'HASTALIK', name: 'Sarı Pas ve Kahverengi Pas', description: 'Bayrak yaprağı korumak çok kritiktir.', activeIngredients: ['Tebuconazole', 'Epoxiconazole'] },
            { type: 'HASTALIK', name: 'Fusarium Başak Yanıklığı', description: 'Başaklarda kısmi ağarmalar ve pembeleşme.', activeIngredients: ['Tebuconazole', 'Prothioconazole'] },
            { type: 'HASTALIK', name: 'Septoria ve Külleme', description: 'Üst yapraklara sıçramaması için önlem.', activeIngredients: ['Prothioconazole', 'Azoxystrobin'] },
            { type: 'BESLEME', name: 'Çinko İhtiyacı', description: 'Polen tüpü gelişimi ve tane tutumu için önemlidir.', activeIngredients: ['Yapraktan Çinko'] }
        ],
        SUT_OLUMU: [
            { type: 'ZARARLI', name: 'Süne (İleri Evre Nimf / Yeni Ergin)', description: 'Tane zararını maksimize ettiği kritik dönem.', activeIngredients: ['Lambda-cyhalothrin', 'Zeta-cypermethrin'] },
            { type: 'ZARARLI', name: 'Kımıl', description: 'Süneye benzer şekilde emgi zararı yapar.', activeIngredients: ['Deltamethrin'] },
            { type: 'HASTALIK', name: 'Sarı Pas (Son dönem enfeksiyonları)', description: 'Tane dolumunu durdurabilir.', activeIngredients: ['Tebuconazole (Eğer hasada süre varsa)'] }
        ]
    },
    DOMATES: {
        FIDE: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Çökerten)', description: 'Toprak kaynaklı mantarların neden olduğu fide devrilmesi.', activeIngredients: ['Propamocarb', 'Fosetyl-Al', 'Metalaxyl-M'] },
            { type: 'ZARARLI', name: 'Toprakaltı Zararlıları (Danaburnu, Bozkurt)', description: 'Fideyi dipten keser.', activeIngredients: ['Chlorpyrifos-ethyl (Toprak)', 'Tefluthrin'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği', description: 'Fideden itibaren virüs (TYLCV) bulaştırabilir.', activeIngredients: ['Imidacloprid', 'Acetamiprid'] },
            { type: 'BESLEME', name: 'Kök Geliştirici ve Fosfor', description: 'Güçlü kök atımı için.', activeIngredients: ['MAP', 'Aminoasit', 'Deniz Yosunu'] }
        ],
        VEGETATIF: [
            { type: 'HASTALIK', name: 'Mildiyö (Phytophthora infestans)', description: 'Yapraklarda su emmiş gibi lekeler, pamukçuk.', activeIngredients: ['Metalaxyl-M + Mancozeb', 'Cymoxanil', 'Dimethomorph'] },
            { type: 'HASTALIK', name: 'Bakteriyel Leke ve Kanser', description: 'Yapraklarda kahverengi lekeler, kuruma.', activeIngredients: ['Bakır oksiklorür', 'Bakır sülfat', 'Mancozeb'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yaprak yüzeyinde unumsu beyaz tabaka.', activeIngredients: ['Penconazole', 'Kükürt', 'Azoxystrobin'] },
            { type: 'ZARARLI', name: 'Tütün Beyazsineği ve Yaprakbiti', description: 'Özsuyu emer, virüs taşır.', activeIngredients: ['Acetamiprid', 'Spiromesifen', 'Spirotetramat'] },
            { type: 'ZARARLI', name: 'Tuta absoluta (Domates Güvesi)', description: 'Yapraklarda beyaz tül benzeri galeriler açar.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Metaflumizone'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Alt yapraklardan başlayıp kuruma yapar.', activeIngredients: ['Abamectin', 'Spiromesifen'] },
            { type: 'BESLEME', name: 'Azot ve Çinko İhtiyacı', description: 'Boya kalkma ve yeşil aksam.', activeIngredients: ['20-20-20 Gübre', 'Magnezyum Sülfat'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Çiçek Tripsi (Frankliniella occidentalis)', description: 'Çiçekleri kurutur, TSWV virüsü taşır.', activeIngredients: ['Spinosad', 'Spinetoram', 'Formetanate'] },
            { type: 'ZARARLI', name: 'Tuta absoluta', description: 'Çiçek salkımlarını kesebilir.', activeIngredients: ['Chlorantraniliprole'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis cinerea)', description: 'Sera ortamında çiçek kuruması.', activeIngredients: ['Boscalid', 'Fludioxonil'] },
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Salgın devam edebilir.', activeIngredients: ['Cymoxanil', 'Metalaxyl'] },
            { type: 'BESLEME', name: 'Bor ve Çinko İhtiyacı', description: 'Çiçek dökülmesini önlemek ve döllenmeyi artırmak için.', activeIngredients: ['Kalsiyum-Bor takviyesi', 'Deniz yosunu'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'BESLEME', name: 'Kalsiyum İhtiyacı (Çiçek Burnu Çürüklüğü)', description: 'Hızlı meyve büyümesinde meyve ucu kararması.', activeIngredients: ['Kalsiyum Nitrat', 'Kalsiyum klorür yapraktan'] },
            { type: 'ZARARLI', name: 'Tuta absoluta', description: 'Meyveleri delerek pazar değerini sıfırlar.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Emamectin benzoate', 'Bacillus thuringiensis'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Stres yaratıp meyve kalibresini düşürür.', activeIngredients: ['Abamectin', 'Bifenazate', 'Hexythiazox'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu (Helicoverpa armigera)', description: 'Olgunlaşmakta olan meyvelere delik açar.', activeIngredients: ['Indoxacarb', 'Emamectin benzoate'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf', description: 'Meyve saplarında ve gövdede çürüme.', activeIngredients: ['Boscalid', 'Fludioxonil + Cyprodinil'] },
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Meyvelerde kahverengi sert çürümeler.', activeIngredients: ['Dimethomorph', 'Fosetyl-Al'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Meyve irileşmesi için.', activeIngredients: ['Potasyum Nitrat', 'Potasyum Sülfat'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Renklenme, parlaklık ve tat (Brix) artışı.', activeIngredients: ['Potasyum Tiyosülfat (KTS)', 'Sıvı Potasyum'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf ve Alternaria (Erken Yanıklık)', description: 'Hasat yaralarından ve nemden dolayı çürüme.', activeIngredients: ['Hasat aralığı (PHI) kısa fungisitler (Boscalid)'] },
            { type: 'ZARARLI', name: 'Tuta absoluta', description: 'Kalan meyvelere son zarar.', activeIngredients: ['Biyolojik preparatlar (B. thuringiensis)'] }
        ]
    },
    ELMA: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Elma Karalekesi', description: 'Uyanma dönemi ilk enfeksiyon başlangıcıdır.', activeIngredients: ['Bakır sülfat', 'Bordo Bulamacı', 'Dodine'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Sürgün kışlaklarındaki miseller uyanır.', activeIngredients: ['Sulphur (Kükürt)'] },
            { type: 'ZARARLI', name: 'Elma Gözkurdu ve Yaprakbiti (Kışlık yumurtalar)', description: 'Uyanan gözlerde emgi yapar.', activeIngredients: ['Kışlık Yağlar + Chlorpyrifos (izinli ise)'] },
            { type: 'BESLEME', name: 'Çinko ve Bor (Uyanma Öncesi)', description: 'Tomurcuk patlamasını eşzamanlı yapmak için.', activeIngredients: ['Çinko Sülfat', 'Sıvı Bor'] }
        ],
        PEMBE_TOMURCUK: [
            { type: 'HASTALIK', name: 'Elma Karalekesi (Venturia inaequalis)', description: 'Yağmurlarla birlikte spor uçuşu en yoğundur.', activeIngredients: ['Dodine', 'Dithianon', 'Captan', 'Myclobutanil'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Yapraklarda ve tomurcuklarda beyaz unsu örtü.', activeIngredients: ['Penconazole', 'Bupirimate'] },
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Pembe tomurcukta önleyici ilaçlama şarttır.', activeIngredients: ['Tebuconazole', 'Captan'] },
            { type: 'ZARARLI', name: 'Yaprakbiti ve Gözkurdu', description: 'Tomurcukları kemirir.', activeIngredients: ['Thiacloprid', 'Acetamiprid'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası (Monilinia laxa)', description: 'Çiçeklerin yanmış gibi kurumasına yol açar.', activeIngredients: ['Captan', 'Boscalid + Pyraclostrobin'] },
            { type: 'HASTALIK', name: 'Ateş Yanıklığı (Erwinia amylovora)', description: 'Çiçeklerde enfeksiyon, sürgünlerde geriye doğru kararma-çengel.', activeIngredients: ['Bakır preparatları', 'Fosetyl-Al', 'Antibiyotikler (yasal izinli olanlar)'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Polen çimlenmesini maksimize etmek için.', activeIngredients: ['Deniz yosunu', 'Bor (B) takviyesi'] }
        ],
        MEYVE_GELISIMI: [
            { type: 'BESLEME', name: 'Kalsiyum Takviyesi (Acı Benek Önleme)', description: 'Hücre duvarı sağlamlığı, acı benek önleme.', activeIngredients: ['Sıvı Kalsiyum Klorür (Yapraktan)'] },
            { type: 'ZARARLI', name: 'Elma İçkurdu (Cydia pomonella)', description: 'Elmanın en önemli zararlısı. Larvalar meyveyi deler.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram', 'Phosmet', 'Methoxyfenozide', 'CpGV Virüsü'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Sıcak aylarda yaprakları sarartır.', activeIngredients: ['Abamectin', 'Bifenazate', 'Spirodiclofen', 'Etoxazole'] },
            { type: 'ZARARLI', name: 'San Jose Kabuklubiti', description: 'Meyvede kırmızı haleli lekeler yapar.', activeIngredients: ['Pyriproxyfen', 'Spirotetramat'] },
            { type: 'HASTALIK', name: 'Elma Karalekesi', description: 'Meyve üzerinde lekelenme ve çatlama yapar.', activeIngredients: ['Difenoconazole', 'Captan', 'Pyraclostrobin'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Sürgün gelişimini durdurur.', activeIngredients: ['Penconazole', 'Kükürt'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Meyve irileşmesi için.', activeIngredients: ['Potasyum Nitrat'] }
        ],
        HASAT: [
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Renklenme ve tat.', activeIngredients: ['Potasyum Sülfat', 'KTS'] },
            { type: 'HASTALIK', name: 'Hasat Öncesi Çürüklükler (Penicillium, Alternaria)', description: 'Depo ömrünü azaltan mantari çürümeler.', activeIngredients: ['Fludioxonil', 'Captan'] },
            { type: 'ZARARLI', name: 'Elma İçkurdu (Son Döl)', description: 'Geçci çeşitlerde vurukları engellemek.', activeIngredients: ['Hasat süresi (PHI) kısa ilaçlar (Spinetoram)'] }
        ]
    },
    BAG: {
        UYANMA: [
            { type: 'HASTALIK', name: 'Ölükol (Phomopsis viticola)', description: 'Kışlık ilaçlama ve budama önlemleri.', activeIngredients: ['Bordo Bulamacı', 'Bakır Sülfat'] },
            { type: 'ZARARLI', name: 'Bağ Uyuzu', description: 'Uyanan gözlerde emgi yapar.', activeIngredients: ['Kükürt', 'Abamectin'] },
            { type: 'BESLEME', name: 'Çinko-Bor İhtiyacı', description: 'Eşzamanlı uyanma.', activeIngredients: ['Çinko Sülfat'] }
        ],
        SURGUN: [
            { type: 'HASTALIK', name: 'Ölükol', description: 'Sürgünlerde çatlaklar, lekeler.', activeIngredients: ['Mancozeb', 'Captan', 'Folpet'] },
            { type: 'HASTALIK', name: 'Külleme (Erysiphe necator)', description: 'Sürgün ve yapraklarda unsu tabaka.', activeIngredients: ['Sulphur (Kükürt)', 'Penconazole', 'Myclobutanil'] },
            { type: 'ZARARLI', name: 'Bağ Yaprakuyuzu ve Kırmızı Örümcek', description: 'Yaprak altlarında kabarcıklar, kuruma.', activeIngredients: ['Abamectin', 'Spirodiclofen'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Mildiyö (Plasmopara viticola)', description: 'Yağmurlarla enfeksiyon riski çok yüksektir.', activeIngredients: ['Metalaxyl-M', 'Dimethomorph', 'Cymoxanil'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Çiçek salkımlarını kurutabilir.', activeIngredients: ['Penconazole', 'Tebuconazole'] },
            { type: 'BESLEME', name: 'Bor, Çinko, Fosfor', description: 'Boncuklanmayı (iri/ufak tane) engellemek.', activeIngredients: ['Sıvı Bor-Çinko Kombinasyonları'] },
            { type: 'ZARARLI', name: 'Trips', description: 'Çiçekleri döker.', activeIngredients: ['Spinosad'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Salkımlarda kahverengileşme.', activeIngredients: ['Metalaxyl-M + Mancozeb', 'Fosetyl-Al'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Tanelerde çatlama.', activeIngredients: ['Sulphur (Toz)', 'Tebuconazole', 'Azoxystrobin'] },
            { type: 'ZARARLI', name: 'Salkım Güvesi (Lobesia botrana)', description: 'Korukları delerek beslenir, kurşuni küf kapısı açar.', activeIngredients: ['Chlorantraniliprole', 'Spinosad', 'Indoxacarb', 'Bacillus thuringiensis'] },
            { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis cinerea)', description: 'Salkım kapanmadan önce ilaçlama şarttır.', activeIngredients: ['Boscalid', 'Fludioxonil + Cyprodinil'] },
            { type: 'BESLEME', name: 'Potasyum ve Magnezyum', description: 'Tane irileşmesi.', activeIngredients: ['Magnezyum Sülfat', 'Potasyum Nitrat'] }
        ],
        BEN_DUSME: [
            { type: 'HASTALIK', name: 'Kurşuni Küf', description: 'Nem ve çatlamalar çürümeyi başlatır.', activeIngredients: ['Fenhexamid', 'Fludioxonil'] },
            { type: 'ZARARLI', name: 'Salkım Güvesi', description: 'Tatlılaşan taneleri deler.', activeIngredients: ['Spinosad', 'Emamectin benzoate'] },
            { type: 'BESLEME', name: 'Potasyum', description: 'Renk ve şeker (Brix) oranını tavan yaptırır.', activeIngredients: ['Sıvı Potasyum'] }
        ],
        HASAT: [
            { type: 'HASTALIK', name: 'Kurşuni Küf', description: 'Hasat öncesi kritik son dönem.', activeIngredients: ['Kısa PHI değerli fungisitler'] },
            { type: 'ZARARLI', name: 'Arı ve Kuş Zararı', description: 'Meyveleri parçalarlar.', activeIngredients: ['Kültürel önlem (Tül vb)'] }
        ]
    },
    ZEYTIN: {
        SÜRGÜN: [
            { type: 'HASTALIK', name: 'Zeytin Halkalı Lekesi (Spilocaea oleagina)', description: 'Tavus gözü lekesi, şiddetli yaprak dökümü.', activeIngredients: ['Bordo Bulamacı', 'Bakır oksiklorür', 'Kresoxim-methyl'] },
            { type: 'ZARARLI', name: 'Zeytin Güvesi (Prays oleae) - Yaprak Dölü', description: 'Yapraklarda galeriler açar.', activeIngredients: ['Deltamethrin', 'Dimethoate'] },
            { type: 'BESLEME', name: 'Azot ve Bor', description: 'Yeni sürgünler ve tomurcuk farklılaşması.', activeIngredients: ['Üre', 'Bor takviyesi'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Zeytin Güvesi - Çiçek Dölü', description: 'Çiçek salkımlarını yer.', activeIngredients: ['Bacillus thuringiensis', 'Deltamethrin'] },
            { type: 'ZARARLI', name: 'Zeytin Pamuklubiti', description: 'Tomurcuklarda pamukçuk salgısı.', activeIngredients: ['Dimethoate'] },
            { type: 'BESLEME', name: 'Bor İhtiyacı', description: 'Tozlanma ve meyve tutumunu artırmak için.', activeIngredients: ['Yapraktan sıvı Bor'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Zeytin Güvesi - Meyve Dölü', description: 'Zeytinin içine girip çekirdeği yer.', activeIngredients: ['Dimethoate', 'Spinosad'] },
            { type: 'ZARARLI', name: 'Zeytin Sineği (Bactrocera oleae) - İlk Vuruk', description: 'Erken zeytin sineği popülasyonu.', activeIngredients: ['Spinosad', 'Dimethoate'] },
            { type: 'BESLEME', name: 'Fosfor ve Potasyum', description: 'Meyve irileşmesi.', activeIngredients: ['MAP', 'Potasyum Nitrat'] }
        ],
        CEKIRDEK: [
            { type: 'ZARARLI', name: 'Zeytin Sineği', description: 'Meyve etine yumurta bırakır, kurtlanma.', activeIngredients: ['Spinosad (Zehirli yem)', 'Deltamethrin', 'Kaolin kili'] },
            { type: 'ZARARLI', name: 'Zeytin Güvesi - Meyve Dölü', description: 'Hasada doğru meyve dökümüne sebep olur.', activeIngredients: ['Spinosad', 'Deltamethrin'] },
            { type: 'HASTALIK', name: 'Zeytin Dal Kanseri', description: 'Dolu ve budama yaralarından giren bakteri ürleri.', activeIngredients: ['Bakırlı preparatlar'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Zeytin Sineği', description: 'Zeytinyağı asiditesini son aşamada bozar.', activeIngredients: ['Kısa etkili ilaçlar'] },
            { type: 'HASTALIK', name: 'Zeytin Halkalı Lekesi (Sonbahar enfeksiyonu)', description: 'Yağmurlarla birlikte yeniden başlar.', activeIngredients: ['Bordo Bulamacı (Hasat sonrası)'] }
        ]
    },
    BADEM: {
        TOMURCUK: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Uyanan tomurcuklarda risk.', activeIngredients: ['Captan', 'Tebuconazole'] },
            { type: 'HASTALIK', name: 'Badem Yaprak Delen (Klasterosporium)', description: 'Yapraklarda delinmeler başlar.', activeIngredients: ['Bordo Bulamacı', 'Captan'] },
            { type: 'BESLEME', name: 'Çinko-Bor', description: 'Gözlerin güçlü uyanması.', activeIngredients: ['Çinko sülfat', 'Bor'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Çiçek Monilyası', description: 'Çiçeklerin yanmış gibi kurumasına neden olur.', activeIngredients: ['Boscalid + Pyraclostrobin', 'Myclobutanil'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Döllenme gücü için.', activeIngredients: ['Bor'] }
        ],
        MEYVE_TUTUMU: [
            { type: 'ZARARLI', name: 'Badem İçkurdu (Eurytoma amygdali)', description: 'Çağla 7-8mm iken ilaçlama gerekir.', activeIngredients: ['Deltamethrin', 'Lambda-cyhalothrin'] },
            { type: 'HASTALIK', name: 'Yaprak Delen', description: 'Meyvelerde ve yapraklarda lekeler.', activeIngredients: ['Captan', 'Thiram'] },
            { type: 'BESLEME', name: 'Azot ve Fosfor', description: 'Meyve dökümünü engellemek.', activeIngredients: ['Dengeli gübreleme'] }
        ],
        IC_DOLDURMA: [
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprakları zayıflatır.', activeIngredients: ['Spirodiclofen', 'Abamectin'] },
            { type: 'BESLEME', name: 'Potasyum ve Çinko İhtiyacı', description: 'İç doldurma oranını artırmak için.', activeIngredients: ['Sıvı Potasyum', 'Çinko Sülfat'] }
        ],
        KABUK_CATLAMA: [
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Geç dönem popülasyon.', activeIngredients: ['Abamectin'] }
        ]
    },
    YER_FISTIGI: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Boğazı Çürüklüğü (Aspergillus niger, Sclerotium rolfsii)', description: 'Çıkış öncesi ve sonrası fidelerde kurumalara neden olur.', activeIngredients: ['Tohum İlaçlaması (Thiram, Fludioxonil)', 'Azoxystrobin'] },
            { type: 'YABANCI_OT', name: 'Yabancı Otlar', description: 'Yer fıstığının ilk gelişimi yavaş olduğundan ot rekabetine çok hassastır.', activeIngredients: ['Pendimethalin (Ekim öncesi)', 'Imazamox (Çıkış sonrası)'] }
        ],
        CICEKLENME: [
            { type: 'BESLEME', name: 'Kalsiyum (Ca) ve Bor İhtiyacı', description: 'Çiçeklenme yoğunluğunu ve iğne oluşumunu teşvik.', activeIngredients: ['Kalsiyum Nitrat', 'Bor'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu (Helicoverpa)', description: 'Çiçekleri ve iğneleri yer.', activeIngredients: ['Indoxacarb'] }
        ],
        IGNE_OLUSUMU: [
            { type: 'BESLEME', name: 'Kalsiyum (Ca) İhtiyacı (Mutlak)', description: 'İğnelerin toprağa girmesi ve boş kapsül (pop) oranının düşmesi için kalsiyuma mutlak ihtiyaç vardır.', activeIngredients: ['Kalsiyum Sülfat (Jips)'] },
            { type: 'HASTALIK', name: 'Yaprak Lekesi (Cercospora arachidicola)', description: 'Yapraklarda kahverengi/siyah lekeler ve erken yaprak dökümü.', activeIngredients: ['Chlorothalonil', 'Tebuconazole', 'Azoxystrobin + Difenoconazole'] }
        ],
        KAPSUL: [
            { type: 'HASTALIK', name: 'Yaprak Lekesi (Cercospora)', description: 'Dökülmelerin şiddetlenmesi verimi düşürür.', activeIngredients: ['Tebuconazole', 'Azoxystrobin'] },
            { type: 'BESLEME', name: 'Potasyum', description: 'Kapsül dolumu için.', activeIngredients: ['Potasyum Nitrat'] },
            { type: 'ZARARLI', name: 'Toprakaltı Zararlıları', description: 'Kapsülleri kemirirler.', activeIngredients: ['Chlorpyrifos (Toprak uygulaması)'] }
        ],
        HASAT: [
            { type: 'HASTALIK', name: 'Meyve Çürüklükleri (Sclerotium)', description: 'Kapsüllerde beyaz misel tabakası ve çürüme.', activeIngredients: ['Kültürel önlem, ürün rotasyonu'] }
        ]
    },
    MERCIMEK: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Fusarium, Rhizoctonia)', description: 'Toprak kaynaklı patojenler fidelerin sararıp ölmesine neden olur.', activeIngredients: ['Kültürel önlem: Ekim nöbeti', 'Tohum ilaçlaması (Thiram)'] },
            { type: 'YABANCI_OT', name: 'Geniş ve Dar Yapraklı Otlar', description: 'Mercimek bitkisi kısa boylu olduğu için ot rekabetine zayıftır.', activeIngredients: ['Pendimethalin', 'Linuron'] }
        ],
        DALLANMA: [
            { type: 'ZARARLI', name: 'Mercimek Hortumlu Böceği (Sitona crinitus)', description: 'Erginler yaprak kenarlarını oyar, larvalar kök nodyumlarını yer.', activeIngredients: ['Alpha-cypermethrin', 'Deltamethrin'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Apion (Apion spp.)', description: 'Larvalar gövde ve tepe tomurcuklarında beslenir, gelişimi durdurur.', activeIngredients: ['Malathion', 'Deltamethrin'] },
            { type: 'ZARARLI', name: 'Mercimek Hortumlu Böceği', description: 'Zararı devam eder.', activeIngredients: ['Lambda-cyhalothrin'] },
            { type: 'HASTALIK', name: 'Mildiyö ve Pas', description: 'Nemli bölgelerde çiçekleri döker.', activeIngredients: ['Mancozeb'] }
        ],
        BAKLA_OLUSUMU: [
            { type: 'ZARARLI', name: 'Yeşil Kurt (Helicoverpa)', description: 'Baklaları deler.', activeIngredients: ['Indoxacarb'] },
            { type: 'BESLEME', name: 'Fosfor ve Potasyum', description: 'Bakla dolumu için.', activeIngredients: ['Yapraktan NP-K'] }
        ]
    },
    SOYA: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü', description: 'Soğuk topraklarda çimlenme sorunları.', activeIngredients: ['Thiram', 'Metalaxyl'] },
            { type: 'YABANCI_OT', name: 'Yabancı Otlar', description: 'Erken dönem ot rekabeti.', activeIngredients: ['Imazamox', 'Pendimethalin'] }
        ],
        VEGETATIF: [
            { type: 'ZARARLI', name: 'Soya Kapsülkurdu (Etiella zinckenella)', description: 'Gövdeye ve ileride kapsüle girer.', activeIngredients: ['Indoxacarb', 'Chlorantraniliprole'] },
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu', description: 'Yaprakları ve sürgünleri yer.', activeIngredients: ['Emamectin benzoate'] },
            { type: 'BESLEME', name: 'Bakteri Aşısı ve Azot', description: 'Rhizobium bakterisi nodüllerinin oluşumu.', activeIngredients: ['Düşük doz Azot (Başlangıç)'] }
        ],
        CICEKLENME: [
            { type: 'HASTALIK', name: 'Mildiyö (Peronospora manshurica)', description: 'Yapraklarda sarımsı lekeler, mantar örtüsü.', activeIngredients: ['Mancozeb', 'Metalaxyl-M'] },
            { type: 'ZARARLI', name: 'Yeşil Kokarca (Nezara viridula)', description: 'Çiçekleri emer.', activeIngredients: ['Acetamiprid', 'Thiamethoxam'] },
            { type: 'BESLEME', name: 'Bor Takviyesi', description: 'Çiçek dökümünü azaltır.', activeIngredients: ['Bor'] }
        ],
        BAKLA: [
            { type: 'ZARARLI', name: 'Soya Kapsülkurdu', description: 'Kapsülleri delerek tohumları yer.', activeIngredients: ['Spinetoram', 'Chlorantraniliprole'] },
            { type: 'ZARARLI', name: 'Yeşil Kokarca', description: 'Kapsülleri emerek buruşuk tohuma neden olur.', activeIngredients: ['Deltamethrin'] },
            { type: 'HASTALIK', name: 'Mildiyö', description: 'Nemli havalarda zarara devam eder.', activeIngredients: ['Cymoxanil'] }
        ],
        TANE_DOLUM: [
            { type: 'ZARARLI', name: 'Yeşil Kokarca', description: 'Kaliteyi bozar.', activeIngredients: ['Acetamiprid'] },
            { type: 'BESLEME', name: 'Potasyum İhtiyacı', description: 'Yağ ve protein oranını artırmak için.', activeIngredients: ['Potasyum Sülfat / Nitrat'] }
        ]
    },
    KIMYON: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Solgunluk (Fusarium oxysporum)', description: 'Erken dönemde köklerde enfeksiyon.', activeIngredients: ['Tohum ilaçlaması'] },
            { type: 'YABANCI_OT', name: 'Ot Rekabeti', description: 'Rozet döneminde çok yavaş büyür, ot boğar.', activeIngredients: ['Linuron (Çıkış öncesi)', 'El ile yolma'] }
        ],
        SAPA_KALKMA: [
            { type: 'HASTALIK', name: 'Yanıklık (Alternaria spp.)', description: 'Yaprak ve saplarda kahverengi-siyah lekeler. Şiddetli zararlıdır.', activeIngredients: ['Mancozeb', 'Tebuconazole', 'Azoxystrobin'] },
            { type: 'HASTALIK', name: 'Solgunluk (Fusarium)', description: 'İletim demetlerinin tıkanmasıyla bitki aniden çöker.', activeIngredients: ['Dayanıklı tohum, Kültürel önlemler'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Kimyon Güvesi (Depressaria daucella)', description: 'Şemsiyelerde ağ örer, çiçek ve tohum taslaklarını yer.', activeIngredients: ['Bacillus thuringiensis', 'Deltamethrin', 'Malathion'] },
            { type: 'HASTALIK', name: 'Yanıklık (Alternaria)', description: 'Şemsiyeleri kurutarak tohum bağlamayı engeller.', activeIngredients: ['Azoxystrobin', 'Pyraclostrobin'] }
        ],
        TOHUM_BAGLAMA: [
            { type: 'ZARARLI', name: 'Kimyon Güvesi', description: 'Tohumları yiyerek boşaltır.', activeIngredients: ['Deltamethrin'] },
            { type: 'BESLEME', name: 'Potasyum ve Fosfor', description: 'Tohum iriliği için.', activeIngredients: ['Yapraktan gübreleme'] }
        ]
    },
    BAMYA: {
        CIKIS: [
            { type: 'HASTALIK', name: 'Kök Çürüklüğü (Çökerten)', description: 'Fidelerde kuruma.', activeIngredients: ['Metalaxyl', 'Thiram'] },
            { type: 'ZARARLI', name: 'Bozkurt', description: 'Fideleri keser.', activeIngredients: ['Chlorpyrifos (Toprak)'] }
        ],
        GELISIM: [
            { type: 'HASTALIK', name: 'Külleme (Erysiphe cichoracearum)', description: 'Yapraklarda beyaz unsu tabaka.', activeIngredients: ['Penconazole', 'Kükürt', 'Myclobutanil'] },
            { type: 'ZARARLI', name: 'Pamuk Yaprakkurdu (Spodoptera)', description: 'Yaprakları yiyerek zar zar bırakır.', activeIngredients: ['Indoxacarb', 'Emamectin benzoate'] },
            { type: 'ZARARLI', name: 'Yaprakbitleri', description: 'Özsuyu emerek yaprağı kıvırır.', activeIngredients: ['Acetamiprid'] },
            { type: 'BESLEME', name: 'Azot İhtiyacı', description: 'Hızlı boylanma.', activeIngredients: ['Amonyum Nitrat'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu (Helicoverpa)', description: 'Çiçekleri deler.', activeIngredients: ['Indoxacarb'] },
            { type: 'ZARARLI', name: 'Yaprakbitleri', description: 'Çiçeklere de zarar verir.', activeIngredients: ['Thiamethoxam'] },
            { type: 'HASTALIK', name: 'Külleme', description: 'Mücadele edilmezse kurutur.', activeIngredients: ['Kükürt', 'Penconazole'] }
        ],
        MEYVE: [
            { type: 'ZARARLI', name: 'Pamuk Yeşilkurtu ve Yaprakkurdu', description: 'Meyveleri delerek pazar değerini sıfırlar.', activeIngredients: ['Emamectin benzoate', 'Metaflumizone'] },
            { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Alt yapraklardan kuruma başlatır.', activeIngredients: ['Abamectin', 'Spiromesifen'] },
            { type: 'BESLEME', name: 'Düzenli Sulama ve Besleme', description: 'Meyvelerin hızlı irileşip kartlaşmaması için sürekli nem ve azot/potasyum.', activeIngredients: ['Damlama gübreleri'] }
        ]
    },
    NAR: {
        UYANMA: [
            { type: 'HASTALIK', name: 'Nar Kahverengi Leke Hastalığı', description: 'İlk enfeksiyonlar başlar.', activeIngredients: ['Bordo Bulamacı', 'Bakır oksiklorür'] },
            { type: 'BESLEME', name: 'Çinko-Bor', description: 'Göz uyanması.', activeIngredients: ['Çinko sülfat'] }
        ],
        CICEKLENME: [
            { type: 'ZARARLI', name: 'Nar Yaprakbiti (Aphis punicae)', description: 'Sürgün ve çiçeklerde koloniler oluşturur. Ballı madde salgılar.', activeIngredients: ['Acetamiprid', 'Thiamethoxam'] },
            { type: 'HASTALIK', name: 'Kahverengi Leke', description: 'Çiçek dökümü yapabilir.', activeIngredients: ['Mancozeb', 'Captan'] }
        ],
        MEYVE_BUYUMESI: [
            { type: 'ZARARLI', name: 'Nar Yaprakbiti', description: 'Zararına devam eder.', activeIngredients: ['Imidacloprid'] },
            { type: 'ZARARLI', name: 'Harnup Güvesi (Ectomyelois ceratoniae)', description: 'Yumurtalarını taç kısmına bırakır.', activeIngredients: ['Bacillus thuringiensis', 'Spinosad'] },
            { type: 'ZARARLI', name: 'Akdeniz Meyve Sineği', description: 'Erken vuruklar.', activeIngredients: ['Zehirli Yem Dalı'] },
            { type: 'BESLEME', name: 'Meyve Çatlaması (Fizyolojik)', description: 'Düzensiz sulama ve kalsiyum eksikliği meyve çatlatır.', activeIngredients: ['Kalsiyum Nitrat', 'Bor', 'Düzenli Sulama'] },
            { type: 'HASTALIK', name: 'Kahverengi Leke', description: 'Meyvelerde lekeler.', activeIngredients: ['Azoxystrobin'] }
        ],
        HASAT: [
            { type: 'ZARARLI', name: 'Akdeniz Meyve Sineği (Ceratitis capitata)', description: 'Kabuğa yumurta bırakır, meyve çürür.', activeIngredients: ['Spinosad (Zehirli Yem)', 'Malathion', 'Deltamethrin'] },
            { type: 'ZARARLI', name: 'Harnup Güvesi', description: 'Özellikle çatlak narlara girerek taneleri yer, mantari çürümelere sebep olur.', activeIngredients: ['Methoxyfenozide', 'Bacillus thuringiensis'] },
            { type: 'BESLEME', name: 'Potasyum', description: 'Renk ve kalite.', activeIngredients: ['Sıvı Potasyum'] }
        ]
    }
};

export const GENERIC_PROBLEMS: Record<string, any[]> = {
    FIDE: [
        { type: 'BESLEME', name: 'Kök Geliştirici ve Fosfor İhtiyacı', description: 'Fidenin şaşırtılması veya çimlenme sonrasında güçlü kök yapısı oluşturması için fosfor ve kök uyarıcılara ihtiyaç vardır.', activeIngredients: ['10-52-10 (MAP tabanlı gübreler)', 'Deniz Yosunu', 'Aminoasitler', 'Köklendirici (IBA, NAA)'] },
        { type: 'HASTALIK', name: 'Kök Çürüklüğü (Çökerten)', description: 'Toprak kaynaklı mantarların neden olduğu fide devrilmesi ve kuruması.', activeIngredients: ['Propamocarb', 'Fosetyl-Al', 'Metalaxyl-M', 'Thiram', 'Captan'] },
        { type: 'ZARARLI', name: 'Toprakaltı Zararlıları', description: 'Kökleri keser.', activeIngredients: ['Chlorpyrifos', 'Tefluthrin'] }
    ],
    VEGETATIF: [
        { type: 'BESLEME', name: 'Azot ve İz Element İhtiyacı', description: 'Bitkinin yeşil aksamının (boy, yaprak) hızla geliştiği bu dönemde yoğun Azot ve Mikro element (Çinko) ihtiyacı olur.', activeIngredients: ['Üre / Amonyum Nitrat', 'Çinko (Zn)', 'Magnezyum', 'Deniz Yosunu'] },
        { type: 'ZARARLI', name: 'Yaprakbitleri, Beyazsinek ve Trips', description: 'Özsuyu emerek virüs taşır, yaprakları bozar.', activeIngredients: ['Acetamiprid', 'Spiromesifen', 'Spinosad'] },
        { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Yaprak sararması.', activeIngredients: ['Abamectin'] },
        { type: 'HASTALIK', name: 'Külleme ve Mildiyö', description: 'Yapraklarda unsu tabaka veya lekeler.', activeIngredients: ['Kükürt', 'Metalaxyl', 'Azoxystrobin'] }
    ],
    GENERATIF: [
        { type: 'BESLEME', name: 'Çiçeklenme ve Polen Tutumu İhtiyacı', description: 'Döllenmenin başarılı olması, çiçek dökümlerinin engellenmesi için Bor ve Çinko.', activeIngredients: ['Çinko-Bor Kombinasyonları', 'Fosfor', 'Deniz Yosunu'] },
        { type: 'ZARARLI', name: 'Trips ve Yaprakbitleri', description: 'Çiçekleri kurutur.', activeIngredients: ['Spinosad', 'Acetamiprid'] },
        { type: 'HASTALIK', name: 'Kurşuni Küf (Botrytis)', description: 'Çiçek yanıklığı.', activeIngredients: ['Boscalid', 'Fludioxonil'] }
    ],
    MEYVE: [
        { type: 'BESLEME', name: 'Kalsiyum ve Potasyum', description: 'Hücre bölünmesi, irileşme ve çiçek burnu/acı benek gibi lekeleri önleme.', activeIngredients: ['Kalsiyum Nitrat', 'Potasyum Sülfat'] },
        { type: 'ZARARLI', name: 'Meyve Delici/İçkurtları', description: 'Meyveyi deler.', activeIngredients: ['Chlorantraniliprole', 'Spinetoram'] },
        { type: 'ZARARLI', name: 'Kırmızı Örümcek', description: 'Stres.', activeIngredients: ['Spiromesifen'] },
        { type: 'HASTALIK', name: 'Mildiyö ve Meyve Çürüklükleri', description: 'Meyvede leke.', activeIngredients: ['Dimethomorph', 'Azoxystrobin'] }
    ],
    HASAT: [
        { type: 'BESLEME', name: 'Renk ve Briks (Şeker) Artışı', description: 'Meyvenin tam olgunlaşması, rengini alması ve tatlanması için yoğun Potasyum uygulanır.', activeIngredients: ['Potasyum Tiyosülfat (KTS)', 'Sıvı Potasyum', 'Fosfit'] },
        { type: 'HASTALIK', name: 'Hasat Öncesi Çürüklükler', description: 'Nemin artmasıyla mantari (Botrytis, Penicillium) çürümeler.', activeIngredients: ['Hasat aralığı (PHI) çok kısa olan, kalıntı bırakmayan fungisitler'] },
        { type: 'ZARARLI', name: 'Meyve Sinekleri', description: 'Vuruk.', activeIngredients: ['Zehirli Yem'] }
    ]
};
`;

const startIndex = fileContent.indexOf('export const PROBLEM_DATABASE');
if (startIndex !== -1) {
    fileContent = fileContent.substring(0, startIndex) + newProblemDB;
    fs.writeFileSync('constants/cropData.ts', fileContent, 'utf8');
    console.log('Successfully updated cropData.ts');
} else {
    console.error('Could not find PROBLEM_DATABASE export');
}

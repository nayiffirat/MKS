import fs from 'fs';

const STAGES = `
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
`;

const PROBLEMS = `
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
`;

const content = fs.readFileSync('constants/cropData.ts', 'utf8');
const stagesMatch = content.match(/export const CROP_STAGES: Record<string, \{ id: string; name: string; description: string \}\[\]> = \{([\s\S]*?)\n\};/);
const problemsMatch = content.match(/export const PROBLEM_DATABASE: Record<string, Record<string, any\[\]>> = \{([\s\S]*?)\n\};/);

if (stagesMatch && problemsMatch) {
    const newStages = stagesMatch[1] + ",\n" + STAGES;
    const newProblems = problemsMatch[1] + ",\n" + PROBLEMS;

    let newContent = content.replace(stagesMatch[0], `export const CROP_STAGES: Record<string, { id: string; name: string; description: string }[]> = {${newStages}\n};`);
    newContent = newContent.replace(problemsMatch[0], `export const PROBLEM_DATABASE: Record<string, Record<string, any[]>> = {${newProblems}\n};`);

    fs.writeFileSync('constants/cropData.ts', newContent, 'utf8');
    console.log("Successfully updated cropData.ts");
} else {
    console.error("Could not match the blocks.");
}

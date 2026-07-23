import fs from 'fs';

const STAGES = `
    SOGAN: [
        { id: 'FIDE', name: 'Fide Dönemi', description: 'Tohumun veya arpacığın sürmesi.' },
        { id: 'VEGETATIF', name: 'Yaprak Gelişimi', description: 'Toprak üstü yaprak gelişimi.' },
        { id: 'BAS_BAGLAMA', name: 'Baş Bağlama', description: 'Soğan başlarının oluşmaya başlaması.' },
        { id: 'BAS_BUYUMESI', name: 'Baş Büyümesi', description: 'Başların irileştiği evre.' },
        { id: 'HASAT', name: 'Hasat', description: 'Yaprakların yatması ve kuruma.' }
    ]`;

const PROBLEMS = `
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
    }`;

const content = fs.readFileSync('constants/cropData.ts', 'utf8');

let newContent = content.replace(/export const CROP_STAGES: Record<string, \{ id: string; name: string; description: string \}\[\]> = \{/, "export const CROP_STAGES: Record<string, { id: string; name: string; description: string }[]> = {\n" + STAGES + ",");
newContent = newContent.replace(/export const PROBLEM_DATABASE: Record<string, Record<string, any\[\]>> = \{/, "export const PROBLEM_DATABASE: Record<string, Record<string, any[]>> = {\n" + PROBLEMS + ",");

fs.writeFileSync('constants/cropData.ts', newContent, 'utf8');
console.log("Added SOGAN");

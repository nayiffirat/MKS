
import { Pesticide, PesticideCategory } from './types';

export const APP_NAME = "Mühendis Kayıt Sistemi";

export const MOCK_PESTICIDES: Pesticide[] = [
  // --- SYNGENTA ---
  { id: 'syn-1', name: 'Amistar Trio', activeIngredient: 'Azoxystrobin + Propiconazole + Cyproconazole', defaultDosage: '60 ml/da', category: PesticideCategory.FUNGICIDE, description: 'Buğdayda pas ve külleme hastalıkları için sistemik çözüm.' },
  { id: 'syn-2', name: 'Score 250 EC', activeIngredient: 'Difenoconazole', defaultDosage: '40 ml/100L', category: PesticideCategory.FUNGICIDE, description: 'Karaleke ve külleme için standart ürün.' },
  { id: 'syn-3', name: 'Affirm', activeIngredient: 'Emamectin benzoate', defaultDosage: '150 g/da', category: PesticideCategory.INSECTICIDE, description: 'Lepidoptera türlerine (Tuta, Yeşil Kurt) karşı üstün performans.' },
  { id: 'syn-5', name: 'Axial', activeIngredient: 'Pinoxaden', defaultDosage: '70 ml/da', category: PesticideCategory.HERBICIDE, description: 'Buğday ve arpada dar yapraklı ot ilacı.' },

  // --- BAYER ---
  { id: 'bayer-1', name: 'Movento SC 100', activeIngredient: 'Spirotetramat', defaultDosage: '100 ml/100L', category: PesticideCategory.INSECTICIDE, description: 'Çift yönlü sistemik taşıma özelliği ile gizli zararlılara karşı etkili.' },
  { id: 'bayer-2', name: 'Atlantis Star', activeIngredient: 'Mesosulfuron + Iodosulfuron', defaultDosage: '30 g/da', category: PesticideCategory.HERBICIDE, description: 'Hububatta geniş ve dar yapraklı otlara karşı tam çözüm.' },
  { id: 'bayer-3', name: 'Luna Experience', activeIngredient: 'Fluopyram + Tebuconazole', defaultDosage: '60 ml/100L', category: PesticideCategory.FUNGICIDE, description: 'Meyve ve sebzede külleme ve monilya ilacı.' },

  // --- CORTEVA ---
  { id: 'cor-1', name: 'Delegate 250 WG', activeIngredient: 'Spinetoram', defaultDosage: '30 g/da', category: PesticideCategory.INSECTICIDE, description: 'Thrips ve meyve iç kurdu için yeni nesil çözüm.' },
  { id: 'cor-2', name: 'Closer SC', activeIngredient: 'Isoclast active', defaultDosage: '20 ml/da', category: PesticideCategory.INSECTICIDE, description: 'Yaprak biti ve beyaz sinek için sistemik koruma.' },
  { id: 'cor-3', name: 'Mustang', activeIngredient: '2,4-D + Florasulam', defaultDosage: '60 ml/da', category: PesticideCategory.HERBICIDE, description: 'Hububatta geniş yapraklı ot mücadelesi.' },

  // --- FMC ---
  { id: 'fmc-1', name: 'Benevia', activeIngredient: 'Cyantraniliprole', defaultDosage: '60 ml/da', category: PesticideCategory.INSECTICIDE, description: 'Sebzelerde emici ve çiğneyici zararlılara karşı üstün koruma.' },
  { id: 'fmc-2', name: 'Verimark', activeIngredient: 'Cyantraniliprole', defaultDosage: '15 ml/1000 fide', category: PesticideCategory.INSECTICIDE, description: 'Can suyu uygulaması ile kökten uca sistemik koruma.' },
  { id: 'fmc-3', name: 'Coragen', activeIngredient: 'Chlorantraniliprole', defaultDosage: '15 ml/da', category: PesticideCategory.INSECTICIDE, description: 'Meyve ve sebzede kurt mücadelesinde dünya lideri.' },

  // --- SUMITOMO ---
  { id: 'sum-1', name: 'Sumi-Alpha', activeIngredient: 'Esfenvalerate', defaultDosage: '20 ml/da', category: PesticideCategory.INSECTICIDE, description: 'Geniş spektrumlu, ani etkili insektisit.' },
  { id: 'sum-2', name: 'Admiral 10 EC', activeIngredient: 'Pyriproxyfen', defaultDosage: '50 ml/da', category: PesticideCategory.INSECTICIDE, description: 'Beyaz sinek larvalarına karşı gelişim düzenleyici.' },

  // --- HEKTAŞ ---
  { id: 'hek-1', name: 'Joker', activeIngredient: 'Chlorpyrifos-methyl', defaultDosage: '100 ml/da', category: PesticideCategory.INSECTICIDE, description: 'Depo zararlıları ve genel insektisit.' },
  { id: 'hek-2', name: 'Hekvidane 2.5 EC', activeIngredient: 'Lambda-cyhalothrin', defaultDosage: '30 ml/da', category: PesticideCategory.INSECTICIDE, description: 'Çok yönlü temas etkili böcek ilacı.' },

  // --- BASF ---
  { id: 'basf-1', name: 'Bellis', activeIngredient: 'Boscalid + Pyraclostrobin', defaultDosage: '60 g/100L', category: PesticideCategory.FUNGICIDE, description: 'Depo çürüklüğü ve külleme kontrolü.' },
  { id: 'basf-2', name: 'Signum', activeIngredient: 'Boscalid + Pyraclostrobin', defaultDosage: '100 g/da', category: PesticideCategory.FUNGICIDE, description: 'Sebzelerde geniş spektrumlu fungisit.' },

  // --- SECTOR TARIM (BGD & ÖZEL ÜRÜNLER) ---
  { id: 'sec-1', name: 'Sector Gibb Tablet', activeIngredient: 'Gibberellic Acid (GA3) 1g', defaultDosage: '1 Adet/100L', category: PesticideCategory.GROWTH_REGULATOR, description: 'Üzümde salkım uzatma, narenciyede meyve tutumu ve pazar değerini artırma.' },
  { id: 'sec-2', name: 'Sector Tonik', activeIngredient: 'Sodyum Orto/Para Nitrofenolat', defaultDosage: '50 ml/100L', category: PesticideCategory.GROWTH_REGULATOR, description: 'Bitki hücrelerini aktive eden, strese karşı direnç sağlayan ve verimi artıran biostimülant.' },
  { id: 'sec-3', name: 'Sectormate 48 SL', activeIngredient: 'Ethephon 480 g/L', defaultDosage: '200 ml/da', category: PesticideCategory.GROWTH_REGULATOR, description: 'Pamukta koza açtırıcı, meyve ağaçlarında hasat olgunlaştırıcı ve renklendirici.' },
  { id: 'sec-4', name: 'Sector Root', activeIngredient: 'Indole Butyric Acid (IBA) + Amino Asit', defaultDosage: '100 ml/100L', category: PesticideCategory.GROWTH_REGULATOR, description: 'Fide ve fidanlarda kılcal kök oluşumunu teşvik eden güçlü köklendirici.' },
  { id: 'sec-5', name: 'Sector Combi', activeIngredient: 'Mikro Element Karışımı (Zn, B, Fe, Mn)', defaultDosage: '100 gr/100L', category: PesticideCategory.FERTILIZER, description: 'Bitkideki iz element noksanlıklarını gideren, şelatlı toz yaprak gübresi.' },
  { id: 'sec-6', name: 'Sector Amino', activeIngredient: 'Serbest Amino Asitler', defaultDosage: '250 ml/100L', category: PesticideCategory.GROWTH_REGULATOR, description: 'Bitkinin stres koşullarını atlatmasına yardımcı olan organik gelişim düzenleyici.' },

  // --- DIGER BITKI GELISIM DUZENLEYICILER (BGD) ---
  { id: 'bgd-1', name: 'Progibb 40 SG', activeIngredient: 'Gibberellic Acid (GA3)', defaultDosage: '10 g/da', category: PesticideCategory.GROWTH_REGULATOR, description: 'Meyve tutumu ve salkım uzatma için.' },
  { id: 'bgd-2', name: 'Atonik', activeIngredient: 'Sodium Ortho-Nitrophenolate', defaultDosage: '50 ml/100L', category: PesticideCategory.GROWTH_REGULATOR, description: 'Hücre yenileyici, stres önleyici bitki aktivatörü.' },
  { id: 'bgd-3', name: 'Ethrel', activeIngredient: 'Ethephon', defaultDosage: '150 ml/da', category: PesticideCategory.GROWTH_REGULATOR, description: 'Meyve olgunlaştırma ve pamukta koza açtırma.' },

  // --- GUBRE & BESLEME ---
  { id: 'fer-1', name: 'Urea (%46 N)', activeIngredient: 'Azot', defaultDosage: '20 kg/da', category: PesticideCategory.FERTILIZER, description: 'Üst gübreleme için temel azot kaynağı.' },
  { id: 'fer-2', name: 'Quantum Plus', activeIngredient: 'Sıvı Aminoasit', defaultDosage: '250 ml/100L', category: PesticideCategory.FERTILIZER, description: 'Hızlı absorpsiyon sağlayan biyostimülant.' },
  { id: 'fer-3', name: 'Potasol', activeIngredient: 'Sıvı Potasyum', defaultDosage: '300 ml/da', category: PesticideCategory.FERTILIZER, description: 'Meyve iriltme ve renklenme desteği.' },
  { id: 'fer-4', name: 'Calbit C', activeIngredient: 'Kalsiyum', defaultDosage: '250 ml/100L', category: PesticideCategory.FERTILIZER, description: 'Meyve sertliği ve raf ömrü için kalsiyum desteği.' },
  { id: 'fer-5', name: 'Zintrac', activeIngredient: 'Çinko (%40 Zn)', defaultDosage: '100 ml/da', category: PesticideCategory.FERTILIZER, description: 'Kardeşlenme ve sürgün gelişimi için konsantre çinko.' },
  { id: 'fer-6', name: 'Bortrac', activeIngredient: 'Bor (%15 B)', defaultDosage: '100 ml/da', category: PesticideCategory.FERTILIZER, description: 'Çiçeklenme ve polen sağlığı için hayati önemde.' }
];

export const NEWS_TEMPLATES: Record<string, { titles: string[], summaries: string[] }> = {
  TARIM: {
    titles: ['Gübre Desteği Artırıldı', 'Yeni Hasat Sezonu Başladı', 'Kuraklık Riski Analizi'],
    summaries: ['Tarım Bakanlığı tarafından açıklanan yeni paketle üreticilere ek destek sağlanacak.']
  }
};

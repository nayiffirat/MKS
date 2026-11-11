import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Flame,
  Star,
  ShieldCheck,
  Sparkles,
  Barcode,
  FileText,
  Users,
  Package,
  Landmark,
  FlaskConical,
  Wallet,
  Sprout,
  Truck,
  Map,
  Calculator,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  Printer,
  Mic,
  PauseCircle,
  CreditCard,
  Smartphone,
  Download,
  Crown,
  Layers,
  Eye,
  HelpCircle,
  MessageCircle
} from 'lucide-react';
import { useBackHandler } from '../utils/navigationManager';

interface UserGuideProps {
  onBack: () => void;
  onNavigate: (view: string) => void;
}

export interface GuideFeatureItem {
  id: string;
  rank: number;
  importanceBadge: string;
  importanceColor: 'rose' | 'amber' | 'emerald' | 'sky' | 'violet';
  categoryId: string;
  title: string;
  subtitle: string;
  summary: string;
  targetView?: string;
  customAction?: 'OPEN_BKST' | 'OPEN_EDM' | 'OPEN_EQUIVALENT' | 'OPEN_DOWNLOADS' | 'OPEN_SUPPORT';
  actionLabel: string;
  visualType:
    | 'POS_BARCODE'
    | 'MINISTRY_BKST'
    | 'TANK_MIX'
    | 'FARMER_CREDIT'
    | 'INVENTORY_OCR'
    | 'SILO_BARTER'
    | 'AI_DIAGNOSIS'
    | 'SECURITY_BACKUP';
  steps: string[];
  proTip: string;
  shortcuts?: string[];
}

export interface GuideCategory {
  id: string;
  priorityOrder: number;
  title: string;
  subtitle: string;
  badgeText: string;
  icon: any;
  accentClass: string;
}

const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: 'CAT_1_POS_SALES',
    priorityOrder: 1,
    title: '1. Günlük Hızlı Satış, Reçete & Barkod POS',
    subtitle: 'Tezgahta müşteriyi bekletmeden saniyeler içinde satış ve reçete kesme',
    badgeText: '🔥 ÖNEM DERECESİ #1 (EN KRİTİK)',
    icon: Barcode,
    accentClass: 'from-rose-500/20 to-amber-500/10 border-rose-500/40 text-rose-300'
  },
  {
    id: 'CAT_2_MINISTRY',
    priorityOrder: 2,
    title: '2. Tarım Bakanlığı (BKTS + GTS + B-Reçete) & Mal Kabul',
    subtitle: 'Karekodlu ilaç/gübre bildirimi, fabrikadan mal kabulü ve kayıtsız serbest satış',
    badgeText: '🏛️ ÖNEM DERECESİ #2 (RESMİ MEVZUAT)',
    icon: Landmark,
    accentClass: 'from-amber-500/20 to-emerald-500/10 border-amber-500/40 text-amber-300'
  },
  {
    id: 'CAT_3_AGRI_ENGINE',
    priorityOrder: 3,
    title: '3. Eşdeğer (Muadil) İlaç & Tank Karışım Motoru',
    subtitle: 'Stokta olmayan ilacın muadilini bulma ve tankta çökme/fitotoksisite kontrolü',
    badgeText: '🧪 ÖNEM DERECESİ #3 (ZİRAİ GÜVENLİK)',
    icon: FlaskConical,
    accentClass: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300'
  },
  {
    id: 'CAT_4_FARMERS_CARI',
    priorityOrder: 4,
    title: '4. Müşteri (Çiftçi) Cari, Veresiye, Tahsilat & Risk Skoru',
    subtitle: 'Cari ekstre, vade yaşlandırma, A+/B/C risk puanı ve WhatsApp borç hatırlatma',
    badgeText: '👥 ÖNEM DERECESİ #4 (CARİ & ALACAK)',
    icon: Users,
    accentClass: 'from-sky-500/20 to-blue-500/10 border-sky-500/40 text-sky-300'
  },
  {
    id: 'CAT_5_INVENTORY_OCR',
    priorityOrder: 5,
    title: '5. Depo, Stok, AI Fatura Okuma (OCR) & Tedarikçiler',
    subtitle: 'Fotoğraftan alış faturası okuma, SKT/Lot takibi ve zincirleme iskonto hesabı',
    badgeText: '📦 ÖNEM DERECESİ #5 (STOK & MALİYET)',
    icon: Package,
    accentClass: 'from-indigo-500/20 to-violet-500/10 border-indigo-500/40 text-indigo-300'
  },
  {
    id: 'CAT_6_SILO_FINANCE',
    priorityOrder: 6,
    title: '6. Zahire / Silo, Kasa, Çek/Senet & Yıl Sonu Devir',
    subtitle: 'Mahsul alım-satım, borca karşılık ekin takası, kasa-banka ve yıl sonu devir',
    badgeText: '🌾 ÖNEM DERECESİ #6 (MUHASEBE & ZAHİRE)',
    icon: Sprout,
    accentClass: 'from-yellow-500/20 to-amber-500/10 border-yellow-500/40 text-yellow-300'
  },
  {
    id: 'CAT_7_AI_FIELD',
    priorityOrder: 7,
    title: '7. Zirai Yapay Zeka, TKGM Parsel Haritası & Saha Ziyareti',
    subtitle: 'Yaprak fotoğrafından hastalık teşhisi, ada/parsel sorgu ve tarla ziyaret raporu',
    badgeText: '🤖 ÖNEM DERECESİ #7 (YAPAY ZEKA & SAHA)',
    icon: Sparkles,
    accentClass: 'from-fuchsia-500/20 to-purple-500/10 border-fuchsia-500/40 text-fuchsia-300'
  },
  {
    id: 'CAT_8_SECURITY_SYSTEM',
    priorityOrder: 8,
    title: '8. Güvenlik, 3 Yöntemli Giriş, Yerel Hafıza + Bulut Eşleme & Paketler',
    subtitle: 'Google/Telefon/E-Posta hesap bağlama, cihaz hafızasına yerel yedekleme ve PRO/ULTRA/MAX',
    badgeText: '🛡️ ÖNEM DERECESİ #8 (SİSTEM & GÜVENLİK)',
    icon: ShieldCheck,
    accentClass: 'from-teal-500/20 to-emerald-500/10 border-teal-500/40 text-teal-300'
  }
];

const GUIDE_FEATURES: GuideFeatureItem[] = [
  // ================= KATEGORİ 1: HIZLI SATIŞ & BARKOD POS =================
  {
    id: 'FEAT_1_POS_RX',
    rank: 1,
    importanceBadge: '🔥 #1 EN KRİTİK ÖZELLİK',
    importanceColor: 'rose',
    categoryId: 'CAT_1_POS_SALES',
    title: 'Süpermarket Tipi Barkod Tabancası & Hızlı Satış / Reçete',
    subtitle: 'USB/Kablosuz barkod okuyucu veya telefon kamerası ile 1 saniyede sepete ürün ekleme',
    summary:
      'Bilgisayarınıza taktığınız kablolu veya kablosuz barkod okuyucu tabanca ile herhangi bir ekrandayken ilacın barkodunu veya GS1 karekodunu okuttuğunuzda MKS otomatik olarak algılar, ürünü bulur ve satış sepetine ekler.',
    targetView: 'PRESCRIPTION_NEW',
    actionLabel: 'Hızlı Satış / Reçete Ekranını Aç',
    visualType: 'POS_BARCODE',
    steps: [
      'Ana Panelden veya sol menüden "Satış & Reçeteler" (Yeni Satış) ekranını açın ya da doğrudan barkod tabancasıyla ürünü okutun.',
      'Müşteri (Çiftçi) seçin; peşin veya vadeli (veresiye) satış tipini belirleyin.',
      'Barkod tabancası ile okutulan her ilaç/gübre otomatik olarak GTIN, Seri No, Lot ve SKT bilgileriyle sepete düşer.',
      'Sepetteki ürünlerin toplam ağırlığı (Kg/Lt) ve Holder/Tank dozaj hesabı otomatik görüntülenir.',
      '"Satışı Tamamla & Fiş Yazdır" butonuna basarak hem stoktan düşün, hem müşteri carisine işleyin hem de resmi reçete/satış fişi PDF çıktısı alın.'
    ],
    proTip:
      'İmleci arama kutusuna tıklamanıza gerek yoktur! MKS, süpermarket kasaları gibi barkod tabancasından gelen milisaniyelik tuş vuruşlarını arka planda otomatik yakalar.',
    shortcuts: ['Barkod Tabancası Otomatik Algılama', 'ESC = 1 Adım Geri Dön']
  },
  {
    id: 'FEAT_2_PARK_VOICE',
    rank: 2,
    importanceBadge: '🔥 #2 TEZGAH HIZLANDIRICI',
    importanceColor: 'rose',
    categoryId: 'CAT_1_POS_SALES',
    title: 'Müşteri Beklet (Sepeti Park Et) & Sesli Komut ile Satış',
    subtitle: 'Yoğun sezonda sırada bekleyen ikinci müşterinin satışını araya alma ve sesle ürün ekleme',
    summary:
      'Bir çiftçi ilaç seçerken "Bir dakika traktöre bakıp geliyorum" dediğinde sepeti silmenize gerek kalmaz. "Müşteri Beklet" tuşuyla mevcut sepeti park edip sıradaki müşterinin satışını yapabilir, sonra tek tıkla kaldığınız yerden devam edebilirsiniz.',
    targetView: 'PRESCRIPTION_NEW',
    actionLabel: 'Müşteri Beklet & Sesli Komutu Dene',
    visualType: 'POS_BARCODE',
    steps: [
      'Satış/Reçete ekranının üst barındaki "⏸️ Müşteri Beklet" butonuna tıklayın.',
      'Mevcut müşterinin sepeti ve seçili ürünleri hafızaya alınır ve ekran yeni müşteri için temizlenir.',
      'İkinci müşterinin satışını tamamladıktan sonra üstteki "Bekleyen Sepeti Geri Yükle" rozetine tıklayın.',
      'Elleriniz doluyken "🎙️ Sesli Komut" butonuna basıp "3 adet Coragen ekle" diyerek sepete sesle ürün ekleyebilirsiniz.'
    ],
    proTip:
      'Satış ekranında ayrıca çiftçinin tarlası için kaç tank (Holder - 400L / 600L / 1000L / 2000L) ilaç gerekeceği ve traktör/römork toplam yük ağırlığı (Kg/Ton) otomatik hesaplanır.'
  },

  // ================= KATEGORİ 2: TARIM BAKANLIĞI (BKTS + GTS + B-REÇETE) =================
  {
    id: 'FEAT_3_MINISTRY_MODES',
    rank: 3,
    importanceBadge: '🏛️ #3 RESMİ MEVZUAT & ESNEK MOD',
    importanceColor: 'amber',
    categoryId: 'CAT_2_MINISTRY',
    title: 'Tarım Bakanlığı BKTS / GTS / B-Reçete & "Kaydı Yok" Serbest Mod',
    subtitle: 'İster Bakanlık GLN kaydınızla tam entegre, ister "Kaydı Yok / Serbest Satış" modunda sıfır hata ile çalışın',
    summary:
      'BKTS (Bitki Koruma Ürünleri Takip Sistemi), GTS (Gübre Takip Sistemi) ve E-Reçete/B-Reçete süreçlerini tek ekranda yönetir. Bakanlık kaydı olmayan veya GLN numarası girmek istemeyen bayiler şalteri "Kaydı Yok" konumuna alarak hiçbir uyarı/engel almadan satış yapabilir.',
    customAction: 'OPEN_BKST',
    actionLabel: 'BKTS / GTS Bakanlık Merkezini Aç',
    visualType: 'MINISTRY_BKST',
    steps: [
      'Üst bardaki veya Ana Paneldeki "🏛️ BKTS / GTS" butonuna tıklayın.',
      'BKTS, GTS ve B-Reçete şalterlerinden hangilerini kullanıyorsanız "Aktif", kullanmıyorsanız "Kaydı Yok / Serbest" konumuna getirin.',
      'Kayıtlı bayi iseniz "Bakanlık Kimlik & GLN Ayarları" bölümüne kendi 13 haneli GLN numaranızı (868...) ve servis şifrenizi girin.',
      'Satış ekranında her satış için "Bakanlık Kayıtlı" veya "Kayıtsız / Serbest Satış" seçeneğini anlık değiştirebilirsiniz.'
    ],
    proTip:
      'Denetim geldiğinde "Satış & Denetim Defteri" sekmesinden tek tıkla resmi XML, TXT veya kaşeli/imzalı yazdırılabilir Denetim Defteri çıktısı alabilirsiniz.'
  },
  {
    id: 'FEAT_4_FACTORY_MALKABUL',
    rank: 4,
    importanceBadge: '🏛️ #4 FABRİKADAN MAL KABUL',
    importanceColor: 'amber',
    categoryId: 'CAT_2_MINISTRY',
    title: 'Fabrikadan / Toptancıdan Gelen İlaç ve Gübrelerin Tek Tıkla Mal Kabulü',
    subtitle: 'SSCC koli barkodu veya İrsaliye No ile gelen sevkiyatları tek tıkla hem Bakanlıkta onaylayın hem MKS depoya ekleyin',
    summary:
      'Fabrika veya distribütör size ilaç/gübre gönderdiğinde tek tek elle stok kartı açmanıza gerek yoktur. Koli üzerindeki SSCC barkodunu okutarak veya irsaliyeyi seçerek tüm kalemleri Lot, SKT ve adetleriyle saniyede deponuza alabilirsiniz.',
    customAction: 'OPEN_BKST',
    actionLabel: 'Fabrikadan Mal Kabul Ekranını Aç',
    visualType: 'MINISTRY_BKST',
    steps: [
      '"🏛️ BKTS / GTS" penceresinde "1. Fabrikadan Mal Kabul (Alım)" sekmesini açın (veya Depo ekranındaki "Fabrikadan Mal Kabul" butonuna basın).',
      'Koli üzerindeki 18 haneli SSCC barkodunu barkod tabancasıyla okutun veya İrsaliye numarasını girin.',
      'Sevkiyat içeriğindeki ilaç/gübre kalemlerini, Lot numaralarını ve Son Kullanma Tarihlerini (SKT) kontrol edin.',
      '"✅ Mal Kabulünü Onayla & MKS Depoya Ekle" butonuna bastığınızda ürünler otomatik olarak envanterinize eklenir.'
    ],
    proTip:
      '"Sadece MKS Depoya İşle (Bakanlık Bildirimsiz)" kutucuğunu işaretlerseniz GLN numarası olmadan da irsaliyeli ürünleri deponuza tek tıkla aktarabilirsiniz.'
  },
  {
    id: 'FEAT_4B_EDM_EFATURA_WAREHOUSE',
    rank: 4.5,
    importanceBadge: '🧾 #4.5 EDM e-FATURA DEPOSU & SİSTEM DEPOSU AYRIŞTIRMA',
    importanceColor: 'violet',
    categoryId: 'CAT_2_MINISTRY',
    title: 'EDM e-Fatura Deposu vs. Sistem Deposu (Farklı Kesilen Faturalar İçin Akıllı Ayrım)',
    subtitle: 'Gelen e-Faturayı ister "Sadece e-Fatura Deposunda Bırakın", ister "Sistem Deposuna & Tedarikçi Carisine Aktarın"',
    summary:
      'Bazen fiziki olarak aldığınız mal ile size kesilen e-Fatura farklı olabilir. Bu durumda "Sadece e-Fatura Deposunda Bırak" seçeneği ile fiziki dükkan stoğunuzu ve gerçek Tedarikçi Carinizi hiç bozmadan ürünü resmi e-Fatura Deposuna alırsınız. Müşteriye e-Fatura keseceğiniz zaman karşınıza SADECE e-Fatura ile gelmiş ürünler çıkar; böylece yanlış ürün faturası kesme hatası %100 önlenir!',
    customAction: 'OPEN_EDM',
    actionLabel: 'EDM e-Fatura & Çoklu Depo Merkezini Aç',
    visualType: 'MINISTRY_BKST',
    steps: [
      'Üst bardaki veya Depo ekranındaki "🧾 EDM e-Fatura" butonuna tıklayın.',
      '"1. Gelen e-Faturalar & Depo Seçimi" sekmesinde faturanın tamamı veya her kalem için ayrı ayrı seçim yapın:',
      '• [🧾 Sadece e-Fatura Deposunda Bırak]: Fiziki Sistem Deposuna ve Tedarikçi Carisine dokunmaz; sadece resmi fatura stoğuna ekler.',
      '• [🔄 Sistem Deposuna & Cariye Aktar]: Hem e-Fatura Deposuna, hem dükkan stoğuna (Sistem Deposu), hem de Tedarikçi Carisine işler.',
      '"2. e-Fatura / e-Arşiv Kes" sekmesini açtığınızda karşınıza SADECE e-Fatura Deposunda stoğu bulunan ürünler çıkar; e-Faturasız ürünler gizlenir!'
    ],
    proTip:
      '"3. Depolar Arası Stok" sekmesinden her ürünün 🧾 e-Fatura Stoğunu, 🏛️ BKTS / 🌱 GTS Stoğunu ve 🏠 Fiziki Sistem Stoğunu yan yana karşılaştırabilirsiniz.'
  },

  // ================= KATEGORİ 3: ZİRAİ KARAR DESTEK & TANK KARIŞIMI =================
  {
    id: 'FEAT_5_TANK_MIX_EQUIV',
    rank: 5,
    importanceBadge: '🧪 #5 ZİRAİ GÜVENLİK KALKANI',
    importanceColor: 'emerald',
    categoryId: 'CAT_3_AGRI_ENGINE',
    title: 'Eşdeğer (Muadil) İlaç Bulucu & Tank Karışım Uyuşmazlık Motoru',
    subtitle: 'Stokta biten ilacın aynı etken maddeli muadilini bulma ve yanlış ilaç karışımlarını (çökme/yakma) önleme',
    summary:
      'Çiftçinin istediği ilaç deponuzda kalmadığında aynı etken maddeye sahip stoktaki diğer ilaçları anında listeler. Ayrıca reçeteye birden fazla ilaç eklendiğinde kimyasal çökme veya yaprak yakma (fitotoksisite) riski varsa sesli ve görsel uyarı verir.',
    customAction: 'OPEN_EQUIVALENT',
    actionLabel: 'Eşdeğer İlaç & Tank Karışım Motorunu Aç',
    visualType: 'TANK_MIX',
    steps: [
      'Depo/Stok ekranında veya BKTS Merkezinde "🧪 Eşdeğer İlaç & Karışım Motoru" butonuna tıklayın.',
      'Arama kutusuna ilacın adını veya etken maddesini (örn. "Abamectin", "Tebuconazole", "Bakır") yazın.',
      'Sistem deponuzda bulunan tüm muadil/eşdeğer ürünleri stok miktarları ve fiyatlarıyla yan yana listeler.',
      'Reçete ekranında Bakırlı ilaç + Kalsiyum veya Kükürt + Yazlık Yağ gibi uyumsuz ürünler aynı sepete eklenirse kırmızı "TANK KARIŞIM UYARISI" bandı otomatik açılır ve doğru karıştırma sırasını (WP -> SC -> EC -> SL) gösterir.'
    ],
    proTip:
      'Tank karışım sırası kuralı: Holder tankına önce Suda Dağılan Granül/Toz (WG/WP), sonra Süspansiyon (SC), sonra Emülsiyon (EC) ve en son Sıvı/Yayıcı-Yapıştırıcı (SL) eklenir.'
  },

  // ================= KATEGORİ 4: MÜŞTERİ (ÇİFTÇİ) CARİ & RİSK YÖNETİMİ =================
  {
    id: 'FEAT_6_FARMER_CARI_RISK',
    rank: 6,
    importanceBadge: '👥 #6 CARİ & RİSK KONTROLÜ',
    importanceColor: 'sky',
    categoryId: 'CAT_4_FARMERS_CARI',
    title: 'Müşteri Cari Kartı, Kredi Risk Skoru (A+/B/C) & Vade Yaşlandırma',
    subtitle: 'Kime ne kadar veresiye verilebileceğini gösteren akıllı risk puanı, geciken alacak takibi ve WhatsApp ekstre',
    summary:
      'Her müşterinin ödeme geçmişine ve geciken borç süresine göre otomatik Kredi Risk Notu (A+ Güvenilir, B Normal, C Riskli) hesaplanır. Cari Ekstre PDF olarak indirilebilir veya tek tıkla WhatsApp üzerinden çiftçiye gönderilebilir.',
    targetView: 'FARMERS',
    actionLabel: 'Müşteriler (Cari) Ekranına Git',
    visualType: 'FARMER_CREDIT',
    steps: [
      'Sol menüden "Müşteriler (Cari)" ekranını açın ve listeden bir çiftçiye tıklayın.',
      'Çiftçi kartının üst kısmında "Kredi Risk Notu (A+ / B / C)" ve "Vade Yaşlandırma (30/60/90+ Gün)" rozetlerini inceleyin.',
      '"Tahsilat Al", "Borç Ekle", "Ürün İadesi" veya "Cari Ekstre / Rapor" butonlarıyla tüm finansal işlemleri yönetin.',
      'Cari Ekstre açıkken geri tuşuna (veya ESC / mobil parmak kaydırma) bastığınızda Ana Panele atlamaz; sırasıyla Cari Kartına -> Müşteri Listesine -> Ana Panele adım adım döner.'
    ],
    proTip:
      'Hasat vadeli satışlarda çiftçinin ekinine (Pamuk, Mısır, Buğday, Fıstık vb.) göre otomatik hasat vade tarihi atanır ve vadesi yaklaşan alacaklar "Alacak & Risk Takibi" ekranında listelenir.'
  },

  // ================= KATEGORİ 5: DEPO, AI FATURA OCR & TEDARİKÇİ İSKONTO =================
  {
    id: 'FEAT_7_INVENTORY_AI_OCR',
    rank: 7,
    importanceBadge: '📦 #7 AI FATURA OKUMA & STOK',
    importanceColor: 'violet',
    categoryId: 'CAT_5_INVENTORY_OCR',
    title: 'Yapay Zeka (AI OCR) ile Alış Faturası Okuma, SKT Alarmı & Zincirleme İskonto',
    subtitle: 'Toptancı faturasının fotoğrafını çekip otomatik stok girişi yapma ve %10+%5+%3 zincirleme iskonto hesabı',
    summary:
      'Toptancıdan gelen uzun kağıt faturaları tek tek elle girmek yerine fotoğrafını yükleyin; yapay zeka ürün adlarını, adetleri ve birim maliyetleri otomatik okusun. Ayrıca SKT tarihi yaklaşan ilaçları renkli uyarılarla takip edin.',
    targetView: 'INVENTORY',
    actionLabel: 'Depo & Envanter Ekranına Git',
    visualType: 'INVENTORY_OCR',
    steps: [
      '"Depo & Stok" ekranını açın ve üst bardaki "📄 AI Fatura Okuma (OCR)" butonuna tıklayın.',
      'Alış faturasının fotoğrafını seçin; MKS yapay zeka motoru kalemleri ayrıştırıp onayınıza sunar.',
      'Tedarikçi alımlarında sezon iskonto zincirini (%10 + %5 + %3 gibi) girerek ürünün gerçek net birim maliyetini kuruşu kuruşuna hesaplayın.',
      'Depo listesindeki "SKT Yaklaşanlar" ve "Kritik Stok" filtreleriyle son kullanma tarihi yaklaşan ilaçları öncelikli satın.'
    ],
    proTip:
      '"Akıllı Stok Tahmini" ekranı geçen yılın aynı ayındaki satışlarınıza bakarak önümüzdeki ay hangi ilaçtan kaç adet sipariş vermeniz gerektiğini önceden raporlar.'
  },

  // ================= KATEGORİ 6: ZAHİRE / SİLO & KASA MUHASEBESİ =================
  {
    id: 'FEAT_8_SILO_KASA_TURNOVER',
    rank: 8,
    importanceBadge: '🌾 #8 ZAHİRE TAKAS & MUHASEBE',
    importanceColor: 'amber',
    categoryId: 'CAT_6_SILO_FINANCE',
    title: 'Silo / Zahire Mahsul Takası, Kasa-Banka, Çek/Senet & Yıl Sonu Devir',
    subtitle: 'Çiftçinin ilaç borcuna karşılık buğday/mısır/pamuk alımı, kantar/rutubet hesabı ve kasa yönetimi',
    summary:
      'Hem zirai ilaç satışı hem de zahire (Buğday, Mısır, Pamuk, Arpa, Ayçiçeği, Antepfıstığı, Zeytin) alım-satımı yapan bayiler için tonaj, nakliye, komisyon ve çiftçi cari borcundan mahsuplaşma (barter) işlemlerini tek ekranda toplar.',
    targetView: 'SILO',
    actionLabel: 'Silo & Tüccar Ekranına Git',
    visualType: 'SILO_BARTER',
    steps: [
      '"Silo & Tüccar" ekranından alınan veya satılan mahsulün tonajını, birim fiyatını, plaka ve nakliye bilgilerini girin.',
      '"Kasa & Banka" ve "Tahsilat & Çekler" ekranlarından nakit, POS (bloke gün hesabı dahil), çek ve senet portföyünüzü takip edin.',
      'Yıl sonunda "Ayarlar -> Sistem -> Yıl Sonu Devir İşlemi" ile tüm cari bakiyeleri ve stokları yeni yıla tek tıkla, PDF devir raporu mühürlü olarak aktarın.'
    ],
    proTip:
      'Kredi kartı (POS) tahsilatlarında 15/30/45 gün bloke veya komisyon oranını seçtiğinizde MKS net hesaba geçecek tutarı ve bloke çözüm tarihini otomatik takip eder.'
  },

  // ================= KATEGORİ 7: ZİRAİ YAPAY ZEKA & HARİTA / SAHA =================
  {
    id: 'FEAT_9_AI_MAP_VISITS',
    rank: 9,
    importanceBadge: '🤖 #9 ZİRAİ ZEKA & TKGM PARSEL',
    importanceColor: 'violet',
    categoryId: 'CAT_7_AI_FIELD',
    title: 'Yaprak Fotoğrafından Hastalık Teşhisi (Zirai AI) & TKGM Parsel Haritası',
    subtitle: 'Fotoğraftan hastalık/zararlı analizi, TKGM Ada/Parsel haritası ve tarla ziyaret raporları',
    summary:
      'Çiftçinin getirdiği hastalıklı yaprak veya meyve fotoğrafını Zirai Yapay Zeka Asistanına yükleyerek olası hastalıkları, zararlıları ve mücadele önerilerini saniyeler içinde görün. TKGM Haritası üzerinden tarla sınırlarını ve ekili ürünleri kaydedin.',
    targetView: 'AI_ASSISTANT',
    actionLabel: 'Zirai Yapay Zeka Asistanını Aç',
    visualType: 'AI_DIAGNOSIS',
    steps: [
      'Sol menüden "Zirai AI Asistan" veya "MKS Mühendisim" ekranını açın.',
      'Bitki fotoğrafını yükleyin veya sorunuzu yazın (Örn: "Domateste mildiyö ve yaprak galeri güvesi için program önerisi").',
      '"TKGM Parsel Haritası" ekranından İl/İlçe/Mahalle/Ada/Parsel sorgulayarak çiftçinin tarlasını harita üzerinde işaretleyin.',
      '"Tarla Ziyaretleri" ekranından saha gözlem notlarını ve fotoğraflarını kaydedip çiftçiye raporlayın.'
    ],
    proTip:
      'Arazide güneş altında çalışırken üst bardaki "☀️ Güneş / Tarla Modu" (Yüksek Kontrast) butonuna basarak ekranın parlak güneş altında bile cam gibi okunmasını sağlayabilirsiniz.'
  },

  // ================= KATEGORİ 8: GÜVENLİK, 3 YÖNTEMLİ GİRİŞ & YEDEKLEME =================
  {
    id: 'FEAT_10_AUTH_BACKUP_PLANS',
    rank: 10,
    importanceBadge: '🛡️ #10 TAM VERİ ZIRHI & YEDEK',
    importanceColor: 'emerald',
    categoryId: 'CAT_8_SECURITY_SYSTEM',
    title: '3 Yöntemli Giriş, Cihaz Hafızasına Yerel Yedekleme, Bulut Eşleme & PRO / ULTRA / MAX',
    subtitle: 'Google/Telefon/E-Posta ile giriş, cihaz hafızasına yerel yedekleme ve internet oldukça otomatik bulut eşleme',
    summary:
      'İster Google hesabınızla, ister Cep Telefonu numaranızla (05XX...), ister E-Posta ile giriş yapın. Girdiğiniz her veri önce cihazınızın yerel hafızasına kaydedilir, internet oldukça bulutla otomatik eşlenir (sıfır veri kaybı).',
    targetView: 'SETTINGS',
    actionLabel: 'Ayarlar & Veri Yedekleme Ekranına Git',
    visualType: 'SECURITY_BACKUP',
    steps: [
      '"Profil" ekranındaki "Bağlı Giriş Yöntemlerim" kartından mevcut hesabınıza Google ve Telefon numaranızı bağlayın; böylece hangi yöntemle girerseniz girin aynı verilere ulaşırsınız.',
      '"Ayarlar -> Veri Aktarımı & Yedek" ekranından "Cihaz Hafızasına Yedek Kaydet (.JSON)" veya AES-256 ".mksbackup" ile tüm verilerinizi doğrudan cihazınızın hafızasına yedekleyin.',
      'Her uygulama güncellemesinden önce "Sıfır Veri Kaybı Zırhı" verilerinizi otomatik mühürler ve internet oldukça bulutla eşler; hiçbir güncellemede tek bir satır veriniz silinmez.',
      'Yönetim Paneli (Admin) üzerinden PRO (Reklamlı), ULTRA (%100 Reklamsız) ve MAX (%100 Reklamsız Kurumsal) paket fiyatlarını ve hangi pakette hangi özelliklerin açılacağını dilediğiniz an değiştirebilirsiniz.'
    ],
    proTip:
      'Yardıma ihtiyacınız olduğunda sağ alttaki veya üst bardaki "💬 Canlı Destek" butonuna tıklayarak doğrudan yönetim ekibine anlık mesaj gönderebilirsiniz.'
  }
];

/**
 * Renders an illustrated interactive visual diagram for each guide feature
 */
const FeatureVisualDiagram: React.FC<{ type: GuideFeatureItem['visualType'] }> = ({ type }) => {
  switch (type) {
    case 'POS_BARCODE':
      return (
        <div className="bg-stone-950/90 border border-rose-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <Barcode size={14} /> CANLI POS BARKOD & HIZLI REÇETE AKIŞI
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
              Tabanca Hazır ●
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5">
              <div className="text-xs font-black text-white">1. Barkod Okut</div>
              <div className="text-[10px] text-stone-400 mt-1 font-mono">(01)0868...(21)SERİ</div>
              <div className="mt-1.5 inline-block px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[9px] font-bold">
                USB Tabanca / Kamera
              </div>
            </div>
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5">
              <div className="text-xs font-black text-white">2. Sepet & Tank</div>
              <div className="text-[10px] text-emerald-400 mt-1 font-bold">Holder: 1000L / 2.5 Tank</div>
              <div className="mt-1.5 inline-block px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[9px] font-bold">
                ⏸️ Müşteri Beklet
              </div>
            </div>
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5">
              <div className="text-xs font-black text-white">3. Tek Tıkla Bitir</div>
              <div className="text-[10px] text-sky-400 mt-1 font-bold">Stok + Cari + PDF Fiş</div>
              <div className="mt-1.5 inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold">
                ✅ Satışı Tamamla
              </div>
            </div>
          </div>
        </div>
      );

    case 'MINISTRY_BKST':
      return (
        <div className="bg-stone-950/90 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Landmark size={14} /> TARIM BAKANLIĞI ESNEK ŞALTER & MAL KABUL ŞEMASI
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
              GLN Esnek Mod
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-stone-900 border border-emerald-500/30 rounded-xl p-3">
              <div className="text-xs font-black text-emerald-400">🟢 Bakanlık Kaydı Var</div>
              <p className="text-[10px] text-stone-300 mt-1">
                Bayi kendi 13 haneli GLN numarasını girer. Fabrikadan gelen SSCC kolileri ve satışlar Denetim Defterine (XML/TXT) işlenir.
              </p>
            </div>
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-3">
              <div className="text-xs font-black text-stone-200">⚪ Kaydı Yok / Serbest Satış</div>
              <p className="text-[10px] text-stone-400 mt-1">
                Bakanlık şalteri kapalıdır. Hiçbir GLN veya karekod zorunluluğu olmadan doğrudan MKS Depo ve Cari üzerinden satış yapılır.
              </p>
            </div>
          </div>
        </div>
      );

    case 'TANK_MIX':
      return (
        <div className="bg-stone-950/90 border border-emerald-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <FlaskConical size={14} /> EŞDEĞER İLAÇ & TANK KARIŞIM KONTROLÜ
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
              Çökme / pH Kalkanı
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 text-xs">
            <div className="flex-1 w-full bg-stone-900 border border-white/10 rounded-xl p-2.5">
              <span className="text-[10px] text-stone-400 font-bold block">ARANAN ETKEN MADDE</span>
              <span className="font-black text-white">Abamectin 18 g/L (EC)</span>
              <span className="block text-[10px] text-emerald-400 mt-0.5">→ Stoktaki 3 Muadil Ürün Bulundu</span>
            </div>
            <div className="flex-1 w-full bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5">
              <span className="text-[10px] text-rose-300 font-black block">⚠️ KARIŞIM UYARISI ÖRNEĞİ</span>
              <span className="font-bold text-white text-[11px]">Bakırlı İlaç + Kalsiyum / Kükürt + Yağ</span>
              <span className="block text-[10px] text-rose-300 mt-0.5">Fitotoksisite & Çökme Riski! Ayrı uygulayın.</span>
            </div>
          </div>
        </div>
      );

    case 'FARMER_CREDIT':
      return (
        <div className="bg-stone-950/90 border border-sky-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Users size={14} /> CARİ RİSK SKORU & TEK ADIM GERİ DÖNÜŞ YIĞINI
            </span>
            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
              Akıllı Navigasyon
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-900 border border-white/10 rounded-xl p-2.5 text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-black">A+ Güvenilir Cari</span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-black">B Normal Risk</span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-black">C Gecikmiş (90+ Gün)</span>
          </div>
          <div className="text-[10px] text-stone-300 bg-stone-900/70 rounded-xl p-2 border border-white/5 font-mono text-center">
            Cari Ekstre Açık ➔ [Geri Tuşu] ➔ Müşteri Kartı ➔ [Geri Tuşu] ➔ Müşteri Listesi ➔ Ana Panel
          </div>
        </div>
      );

    case 'INVENTORY_OCR':
      return (
        <div className="bg-stone-950/90 border border-indigo-500/30 rounded-2xl p-4 space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Package size={14} /> AI FATURA OCR & ZİNCİRLEME İSKONTO (%10+%5+%3)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5">
              <div className="font-black text-white">📸 Fatura Fotoğrafı Yükle</div>
              <div className="text-[10px] text-stone-400 mt-1">Yapay zeka ürün adı, adet ve alış fiyatını otomatik tabloya döker.</div>
            </div>
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5">
              <div className="font-black text-emerald-400">🧮 Net Maliyet Hesabı</div>
              <div className="text-[10px] text-stone-400 mt-1">1.000 ₺ Liste ➔ %10 + %5 İskonto = 855,00 ₺ Gerçek Net Maliyet.</div>
            </div>
          </div>
        </div>
      );

    case 'SILO_BARTER':
      return (
        <div className="bg-stone-950/90 border border-yellow-500/30 rounded-2xl p-4 space-y-2 shadow-inner">
          <div className="text-[10px] font-black uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
            <Sprout size={14} /> MAHSUL / ZAHİRE ALIM-SATIM & CARİ BORÇ MAHSUPLAŞMA
          </div>
          <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5 text-[11px] text-stone-300 flex items-center justify-between">
            <span>🌾 Buğday / Mısır / Pamuk / Fıstık Kantar Girişi</span>
            <span className="text-emerald-400 font-black">➔ Çiftçi İlaç Borcundan Otomatik Düşüm</span>
          </div>
        </div>
      );

    case 'AI_DIAGNOSIS':
      return (
        <div className="bg-stone-950/90 border border-fuchsia-500/30 rounded-2xl p-4 space-y-2 shadow-inner">
          <div className="text-[10px] font-black uppercase tracking-wider text-fuchsia-400 flex items-center gap-1.5">
            <Sparkles size={14} /> YAPRAK FOTOĞRAFINDAN TEŞHİS & TKGM PARSEL HARİTASI
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5 text-stone-300">
              🌿 <b>Fotoğraf Analizi:</b> Yapraktaki leke/zararlıyı tarar, uygun etken maddeleri önerir.
            </div>
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2.5 text-stone-300">
              🗺️ <b>TKGM Ada/Parsel:</b> Tarla sınırlarını ve ekili ürünü harita üzerinde işaretler.
            </div>
          </div>
        </div>
      );

    case 'SECURITY_BACKUP':
    default:
      return (
        <div className="bg-stone-950/90 border border-teal-500/30 rounded-2xl p-4 space-y-2 shadow-inner">
          <div className="text-[10px] font-black uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <ShieldCheck size={14} /> 3 YÖNTEMLİ GİRİŞ + YEREL HAFIZA &amp; BULUT EŞLEME + PRO/ULTRA/MAX
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px] text-center">
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2 text-stone-200 font-bold">
              🔐 Google + 05XX Telefon + E-Posta Bağlama
            </div>
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2 text-sky-300 font-bold">
              💾 Cihaz Hafızasına Yerel Yedek + Bulut Eşleme
            </div>
            <div className="bg-stone-900 border border-white/10 rounded-xl p-2 text-amber-300 font-bold">
              👑 Admin Panelinden Paket & Özellik Seçimi
            </div>
          </div>
        </div>
      );
  }
};

export const UserGuide: React.FC<UserGuideProps> = ({ onBack, onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFeatureIds, setExpandedFeatureIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    GUIDE_FEATURES.forEach(f => {
      initial[f.id] = true;
    });
    return initial;
  });

  // If user filtered a specific category, pressing back resets filter first before leaving UserGuide
  useBackHandler(
    selectedCategory !== 'ALL' || searchQuery.trim().length > 0,
    () => {
      setSelectedCategory('ALL');
      setSearchQuery('');
    },
    'user_guide_filter_reset',
    55
  );

  const toggleFeature = (id: string) => {
    setExpandedFeatureIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = (open: boolean) => {
    const next: Record<string, boolean> = {};
    GUIDE_FEATURES.forEach(f => {
      next[f.id] = open;
    });
    setExpandedFeatureIds(next);
  };

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GUIDE_CATEGORIES.map(cat => {
      const items = GUIDE_FEATURES.filter(item => {
        if (selectedCategory !== 'ALL' && item.categoryId !== selectedCategory) return false;
        if (item.categoryId !== cat.id) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.steps.some(s => s.toLowerCase().includes(q))
        );
      }).sort((a, b) => a.rank - b.rank);

      return {
        category: cat,
        items
      };
    }).filter(group => group.items.length > 0);
  }, [selectedCategory, searchQuery]);

  const handleFeatureAction = (item: GuideFeatureItem) => {
    if (item.customAction === 'OPEN_BKST') {
      if ((window as any).mks_open_ministry) (window as any).mks_open_ministry('malkabul');
      return;
    }
    if (item.customAction === 'OPEN_EDM') {
      if ((window as any).mks_open_edm) (window as any).mks_open_edm('incoming');
      return;
    }
    if (item.customAction === 'OPEN_EQUIVALENT') {
      if ((window as any).mks_open_ministry) (window as any).mks_open_ministry('esdeger');
      return;
    }
    if (item.customAction === 'OPEN_DOWNLOADS') {
      if ((window as any).mks_open_web_portal) (window as any).mks_open_web_portal('download');
      return;
    }
    if (item.customAction === 'OPEN_SUPPORT') {
      if ((window as any).mks_open_live_support) (window as any).mks_open_live_support('general');
      return;
    }
    if (item.targetView) {
      onNavigate(item.targetView);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      {/* ==================== HERO HEADER ==================== */}
      <div className="bg-stone-900/90 border border-emerald-500/25 rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <button
              onClick={onBack}
              className="p-2.5 min-h-[42px] min-w-[42px] flex items-center justify-center rounded-2xl bg-stone-950/90 hover:bg-stone-800 text-stone-300 hover:text-white border border-white/10 transition-all shrink-0 mt-0.5"
              title="Geri Dön"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-2">
                <BookOpen size={14} /> Adım adım görselli kullanım kılavuzu
              </div>
              <h1 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                MKS Görselli Kullanım Kılavuzu
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 mt-1 max-w-3xl leading-relaxed">
                Uygulamadaki tüm özellikler bir zirai ilaç/gübre bayisinin ve ziraat mühendisinin <b>günlük kullanım önem sırasına (1&apos;den 8&apos;e)</b> göre düzenlenmiştir. Her özelliğin altında <b>görsel şeması</b>, <b>adım adım yapılışı</b> ve <b>&ldquo;Hemen Aç&rdquo;</b> kısayolu yer alır.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => expandAll(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-200 border border-white/10 text-xs font-bold transition-all"
            >
              Tümünü aç
            </button>
            <button
              onClick={() => expandAll(false)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-400 border border-white/10 text-xs font-bold transition-all"
            >
              Tümünü daralt
            </button>
            <button
              onClick={() => window.print()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Printer size={14} /> Yazdır / PDF
            </button>
          </div>
        </div>

        {/* Search & Quick Priority Bar */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-3 relative z-10 min-w-0">
          <div className="lg:col-span-5 relative min-w-0">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Özellik ara (Barkod, BKTS, Cari Ekstre, Tank, Uydu)..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-950/90 border border-white/15 rounded-2xl text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="lg:col-span-7 mks-tab-rail pb-1">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`shrink-0 min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-500 text-stone-950 border-emerald-400 shadow-sm font-extrabold'
                  : 'bg-stone-950/90 text-stone-300 border-white/10 hover:bg-stone-800'
              }`}
            >
              Tüm kategoriler ({GUIDE_FEATURES.length})
            </button>
            {GUIDE_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500 text-stone-950 border-emerald-400 shadow-sm font-extrabold'
                      : 'bg-stone-950/90 text-stone-300 border-white/10 hover:bg-stone-800'
                  }`}
                >
                  <Icon size={14} />
                  <span>#{cat.priorityOrder} {cat.title.split('.')[1]?.trim().split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================== CATEGORY OVERVIEW GRID ==================== */}
      {selectedCategory === 'ALL' && !searchQuery && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {GUIDE_CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`text-left p-4 rounded-2xl bg-gradient-to-br ${cat.accentClass} border hover:scale-[1.01] transition-all flex flex-col justify-between gap-3`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/40">
                    ÖNEM #{cat.priorityOrder}
                  </span>
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white leading-snug">{cat.title}</h3>
                  <p className="text-[11px] text-stone-300/90 mt-1 line-clamp-2">{cat.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ==================== CATEGORIZED VISUAL GUIDE CARDS ==================== */}
      <div className="space-y-8">
        {filteredCategories.map(({ category, items }) => {
          const CatIcon = category.icon;
          return (
            <section
              key={category.id}
              className="bg-stone-900/70 border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl"
            >
              {/* Category Banner */}
              <div className={`p-4 rounded-2xl bg-gradient-to-r ${category.accentClass} border flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-stone-950/70 border border-white/10 text-white shrink-0">
                    <CatIcon size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-stone-950/70 text-emerald-300">
                      {category.badgeText}
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white mt-1">{category.title}</h2>
                    <p className="text-xs text-stone-200/90">{category.subtitle}</p>
                  </div>
                </div>
              </div>

              {/* Feature Cards inside Category */}
              <div className="space-y-4">
                {items.map(item => {
                  const isExpanded = !!expandedFeatureIds[item.id];
                  return (
                    <div
                      key={item.id}
                      className="bg-stone-950/70 border border-white/10 rounded-2xl overflow-hidden transition-all"
                    >
                      {/* Feature Header */}
                      <div
                        onClick={() => toggleFeature(item.id)}
                        className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                            #{item.rank}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {item.importanceBadge}
                              </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-white">{item.title}</h3>
                            <p className="text-xs text-stone-400 mt-0.5">{item.subtitle}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="p-2 rounded-xl bg-stone-900 text-stone-400 hover:text-white border border-white/10 shrink-0"
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </div>

                      {/* Feature Body (Visual Diagram + Numbered Steps + Pro Tip + Direct Action Button) */}
                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-white/5 space-y-4">
                          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">{item.summary}</p>

                          {/* Illustrated Visual Schema */}
                          <FeatureVisualDiagram type={item.visualType} />

                          {/* Step-by-Step Guide */}
                          <div className="bg-stone-900/90 border border-white/10 rounded-2xl p-4 space-y-2.5">
                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 size={15} /> Adım Adım Nasıl Kullanılır?
                            </h4>
                            <ol className="space-y-2">
                              {item.steps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-200">
                                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-relaxed">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          {/* Pro Tip & Direct Action Footer */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-3.5">
                            <div className="flex items-start gap-2.5">
                              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-xs text-stone-300">
                                <b className="text-amber-300">Uzman İpucu:</b> {item.proTip}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFeatureAction(item)}
                              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-lg transition-all"
                            >
                              <Play size={14} /> {item.actionLabel}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default UserGuide;

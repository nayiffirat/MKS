# MKS — Antigravity için Değişiklik ve Test Raporu

Tarih: 13.11.2026 · Hazırlayan: Claude · Kapsam: bu oturumda yapılan üç iş (ticari çekirdek, e-Fatura, hava durumu)

**Durum:** `npx tsc --noEmit` temiz. `npm test` 5/5 geçiyor. Hiçbir şey git'e işlenmedi (çalışma ağacında 160+ değişmiş dosya var): **teste başlamadan önce bir commit al.** Kullanıcının gerçek verisine test kaydı eklenmedi; aşağıdaki elle testleri **deneme hesabıyla** yap.

---

## 1. Ticari çekirdek (tedarikçi tarafı)

### Uyulacak kurallar (bundan sonra yazılan her kod için)
1. **Belge türü tahmin edilmez.** Tür yalnızca `SupplierPurchase.type` alanından okunur. Okuma için tek fonksiyon: `supplierDocKind()` (`utils/tradeCore.ts`). `note.includes('İADE')`, `totalAmount < 0`, cari tipi gibi dolaylı kontroller **yazma**.
2. **Tedarikçiye satış iade değildir.** `type: 'SALE'`; satır fiyatı satış fiyatıdır, maliyet `unitCost`, belge üzerinde `costTotal` ve `profit` tutulur.
3. **Belge kaydetmeden önce** `normalizeSupplierDoc()` çağrılır (context bunu yapıyor). Elle `totalAmount` hesaplama.
4. **Stok + belge tek işlemde** yazılır: `dbService.saveSupplierPurchaseWithInventory`. Ayrı ayrı `put` + `updateInventoryFromPurchase` çağırma.
5. **Para toplamı kuruşla** yapılır: `toKurus / fromKurus`.

### Değişen dosyalar
| Dosya | Ne değişti |
|---|---|
| `utils/tradeCore.ts` (yeni) | `supplierDocKind`, `normalizeSupplierDoc`, `returnableBySupplier`, `checkPurchaseReturn`, `balanceLabel`, `toKurus/fromKurus` |
| `tests/tradeCore.test.ts` (yeni) | 5 senaryo testi; `package.json` içine `"test": "tsx --test tests/*.test.ts"` eklendi |
| `types.ts` | `SupplierPurchase.costTotal`, `.profit`, `items[].unitCost` (hepsi isteğe bağlı; eski kayıtlar bozulmaz) |
| `context/AppContext.tsx` | `addSupplierPurchase` ve `updateSupplierPurchase` artık `normalizeSupplierDoc` kullanıyor |
| `services/db.ts` | `_applyPurchaseToInventory` (yeni iç yardımcı); `saveSupplierPurchaseWithInventory` ve `softDeleteSupplierPurchaseWithInventory` **tek IndexedDB işlemi**; aynı belge ikinci kez gelirse stoğa tekrar yansımaz; iade/satış artık ürünün alış ve satış fiyat kartını **değiştirmiyor** |
| `components/Suppliers.tsx` | 22 yerde not/işaret tahmini `supplierDocKind` ile değişti; alış iadesinde kaynak kilidi + "Toptan Satış Olarak Kaydet" diyaloğu; satış kartında "Brüt Kâr" satırı; fiyat etiketi satışta "Satış Fiyatı", iadede "İade Fiyatı" |

### Düzeltilen gerçek hatalar
- Tedarikçiye satışta girilen fiyat, ürünün **alış fiyatı kartının üzerine yazılıyordu** (sonraki kâr hesapları bozuluyordu). Artık yazılmıyor.
- Notunda "İADE" ya da "SATIŞ" kelimesi geçen normal bir alım, listede iade/satış gibi görünüyordu. Artık açık tür geçerli.
- Alım kaydı 4 ayrı adımdı; ortada kesilirse belge "işlenmedi" kalıp stok yarım kalabiliyordu.

### Elle test listesi (Tedarikçiler ekranı, deneme hesabı)
| # | Adım | Beklenen |
|---|---|---|
| T1 | A tedarikçisinden "Ürün X" 100 adet, 10 TL alım gir | Stok +100; A bakiyesi 1.000 TL **alacaklı** (biz borçluyuz) |
| T2 | B tedarikçisine "Satış" → Ürün X 40 adet, fiyatı 11,50 yap | Stok 60; belge "Tedarikçiye Satış"; toplam 460; **Brüt Kâr 60,00**; B 460 TL **borçlu**; Ürün X alış fiyatı hâlâ 10 |
| T3 | B tedarikçisine "İade" → Ürün X 10 adet | Kayıt **engellenir**; diyalog: "…A firmasından satın alınmıştır… Toptan Satış olarak kaydetmek ister misiniz?" |
| T4 | T3 diyaloğunda "Toptan Satış Olarak Kaydet" | Satış penceresi aynı ürünle açılır; iade kaydı oluşmaz |
| T5 | A tedarikçisine "İade" → 101 adet | Engellenir: "iade edilebilir miktar 100" |
| T6 | A tedarikçisine "İade" → 30 adet | Kaydedilir; stok 30; A bakiyesi 700 alacaklı; kâr satırı **yok** |
| T7 | T6 sonrası A'ya 71 adet iade dene | Engellenir (kalan 70) |
| T8 | T2 satışını sil | Stok 40 geri gelir; B bakiyesi 0 |
| T9 | T1 alımını düzenle: 100 → 120 adet | Stok farkı +20; toplam 1.200 |
| T10 | Kaydet düğmesine çok hızlı 5 kez bas (alım, iade, satış ayrı ayrı) | Tek belge, stok tek sefer değişir (düğmede eşzamanlı kilit var; ayrıca aynı belge kimliği ikinci kez gelirse veritabanı stoğa yansıtmaz) |
| T11 | Eski (tür alanı boş) alım kayıtları olan hesapta listeyi aç | Hepsi "Ürün Alımı" görünür; bakiyeler eskisiyle aynı |
| T12 | Tedarikçi PDF raporu al | Satış "Tedarikçiye Satış", iade "Alış İadesi" satırı; bakiye ekranla aynı |

**Bilinen sınır (T3/T5):** Kilit, alım belgelerine bakar. Uygulamaya alım belgesi girilmeden elle eklenmiş stok iade edilemez; önce alımı girmek gerekir. Bu kasıtlı.

### Kalan işler (yapılmadı — sırayla)
1. **Çiftçi satışı tek atomik işlem değil.** `Prescription.tsx handleSave` ve `AppContext.addPrescription`: fatura → `processInventory` → kasa hareketi → ziyaret → Bakanlık defteri ayrı işlemler. Hedef: `['prescriptions','inventory','transactions','accounts','syncOutbox']` üzerinde tek işlem. `processInventory` ve `addTransaction` gövdelerini `_applyPurchaseToInventory` örneğindeki gibi "depoyu parametre alan" yardımcılara ayır.
2. **Çiftçi tarafında tür tahmini:** `p.type === 'RETURN' || tutar < 0` kalıbı 59 yerde (Farmers, Dashboard, Statistics, statsEngine, FarmerFinancialAnalysisModal…). `tradeCore`'a `prescriptionKind()` ekle, hepsini ona bağla.
3. **Bakiye hesabı kopyaları:** `Farmers.tsx:601-619`, `Reports.tsx:449-500`, `Suppliers.tsx` dönem özeti kendi toplamını yapıyor. Hepsi `utils/ledger.ts` fonksiyonlarını kullanmalı. `Supplier.balance / totalDebt` saklanan alanları (`Suppliers.tsx` içinde bir yerde okunuyor) kaldırılmalı.
4. **Stok hareket tablosu yok.** Stok 12 yerde doğrudan `quantity + x` ile değişiyor (`Inventory.tsx`, `App.tsx:215,254`, `EdmIntegrationModal.tsx:758,1104`, `MinistryIntegrationModal.tsx:710`). Hedef: `stockMovements` deposu + tüm değişikliklerin oradan geçmesi.
5. **Defter (`ledgerEntries`), ters kayıt (storno) ve denetim günlüğü yok.** Kalıcı silme (`permanentlyDelete*`) hâlâ açık.
6. **Birleşik cari yok.** Çiftçi ve tedarikçi ayrı tablolar; aynı kişi iki kart.
7. **Ağırlıklı ortalama maliyet uygulanmadı.** Maliyet = son alış fiyatı. Karar kullanıcıda.
8. **İstatistik/Rapor ekranları tedarikçiye satış kârını (`profit`) henüz okumuyor.**
9. **Çok cihaz:** iki cihaz aynı anda aynı ürünü satarsa bulutta son yazan kazanır. Sunucu tarafı kilit gerekir.
10. **Veritabanı düzeyi test yok.** Testler saf kuralları sınıyor; IndexedDB geri alma (rollback) ve çift tıklama testi için `fake-indexeddb` kurulmalı (kurulmadı).

---

## 2. e-Fatura (EDM)

Dosyalar: `server/edm.ts`, `components/EFaturaPanel.tsx`, `App.tsx`, `components/Prescription.tsx`, `types.ts` (`Prescription.eInvoiceNo / eInvoiceUuid`).

- Sunucu uçları: `cancel-invoice`, `respond-invoice`, `invoice-detail`; `send-invoice` artık `invoiceType: 'IADE'` + `refInvoiceNo/refInvoiceDate` kabul ediyor.
- Ekran: Satış / İade seçimi, "faturası kesilmemiş satışlar" listesi, altta sabit toplam + "Faturayı Kes", "Stok ve cari hesaba işle" kutusu, Giden'de "İade Faturası Kes" ve "İptal Et", Gelen'de "Kabul Et / Reddet".
- Satış formunda **e-FATURA** düğmesi (ödeme satırı): seçiliyse kayıttan sonra panel o satışla açılır. Fatura Defteri kartında "e-Fatura" / "İade e-Fatura" / "Kesildi".

EDM **test ortamında** doğrulananlar: giriş, mükellef sorgusu, e-Fatura ve e-Arşiv gönderimi, liste, görüntüleme, e-Arşiv iptali, iade faturası (`EA42026000000717`).

| # | Test (EDM Ayarlar → Ortam: **Test**) | Beklenen |
|---|---|---|
| E1 | Satış formunda e-FATURA'yı seç, satışı kaydet | Panel dolu açılır; kesince satış kartında "Kesildi" |
| E2 | Fatura Defteri kartından "e-Fatura" | Aynı; ikinci kez kesilemez (kart "Kesildi") |
| E3 | Panelden, satışa bağlı olmadan, kayıtlı müşteriyle fatura kes; "Stok ve cari hesaba işle" açık, Vadeli | Yeni satış kaydı oluşur, stok düşer, müşteri borçlanır, kayıtta fatura no var |
| E4 | E3'ü listeden seçilmeyen (elle yazılan) ürünle yap | Sarı uyarı çıkar; o ürün stoktan düşmez |
| E5 | Giden → bir e-Arşiv → "İade Faturası Kes" | Alıcı, satırlar, asıl fatura no/tarih dolu gelir |
| E6 | **Denenmedi:** Gelen ticari faturada Kabul / Reddet | EDM'den başarı yanıtı; liste yenilenir |
| E7 | Şifre | Uygulamayı kapatıp açınca şifre silinmiş olmalı (yalnız oturumda tutulur) |

Bilinen: satışta KDV oranı tutulmadığı için satırlar %20 ve "KDV dahil" gelir. Canlı ortam denenmedi. Telefonda çalışması için sunucunun (Cloud Run) yeniden yayınlanması gerekir. `APPLICATION_NAME` her istekte "MKS" kalmalı (EDM hak edişi buna göre hesaplıyor).

---

## 3. Hava durumu

Dosyalar: `services/agroWeather.ts`, `components/weather/AtmosphericStage.tsx`, `LiveRadarMap.tsx`, `AgroWeatherScreen.tsx`; bağlantı: `WeatherComponents.tsx` (karta dokununca açılır, lazy), `MapComponent.tsx` (`<MapRadarControl />`).

Bilerek farklı yapılanlar: RainViewer 01.01.2026'dan beri tahmin (nowcast) ve uydu karesi vermiyor, en fazla yakınlık 7, dakikada 100 istek. Bu yüzden radar yalnız son 2 saat; gelecek yağış Open-Meteo 15 dk verisinden; "Uydu Bulut" NASA GIBS günlük görüntüsü (canlı değil); radar karoları 512 px.

| # | Test | Beklenen |
|---|---|---|
| H1 | Ana sayfa → Saha Hava → karta dokun | Tam ekran açılır; gökyüzü saate uygun; 11 kart dolu |
| H2 | Yağışlı bir konum seç (konum seçici) | Yağmur rüzgara göre eğik düşer, **kart üst kenarında sıçrar**; fırtına kodunda şimşek |
| H3 | Aşağı kaydır | Büyük başlık küçülür, üstte "16° · Az bulutlu" kalır; kare hızı düşmez |
| H4 | Radar kartı → tam ekran → oynat | Kareler göz kırpmadan geçer; zaman rozeti ilerler; son karede "Şimdi" |
| H5 | "Rüzgar Akışı" | Çizgiler rüzgarın gittiği yöne akar |
| H6 | İnterneti kapat, ekranı yeniden aç | Son veri anında gelir, "Çevrimdışı · son veri HH:MM" |
| H7 | Başka sekmeye geç / ekranı kapat | Animasyon durur (CPU boşta) |
| H8 | Güneş düğmesi (saha modu) | Kartlar koyulaşır, yazılar keskinleşir; tercih kalıcı |
| H9 | Parsel Haritası → sol kenardaki radar düğmesi | Radar haritaya biner; oynat/durdur çalışır; kapatınca kalkar |
| H10 | Düşük donanımlı Android | Akıcı; takılırsa bulut/yağmur kalitesi kendiliğinden düşer |

**Denenemedi:** animasyon akıcılığı ve H2 (test tarayıcısında hareket kısıtlıydı, o an yağış yoktu), telefon performansı.

---

## 4. Yayın notları
- `build_apk.ps1` artık önce `npx vite build` çalıştırıyor (önceden eski paketi APK'ya koyuyordu). Son derlenen: v33 / 8.3.0 — **bu rapordaki ticari çekirdek ve hava durumu değişikliklerinden önce derlendi.**
- Sunucu (`server/edm.ts`) Cloud Run'a yayınlanmadı.
- Çalıştırma: `npm run dev` (port 3000), `npx tsc --noEmit`, `npm test`.

---

## 5. Ek (13.11 akşam): kâr bağlantısı ve veri sağlığı denetçisi

**Kâr bağlantısı** — `components/Statistics.tsx` kâr/zarar hesabı artık tedarikçiye satış belgelerini de topluyor (ciro = belge tutarı, maliyet = `costTotal`; eski kayıtlarda stok alış fiyatı).

**Veri sağlığı denetçisi** — `services/integrity.ts` (yeni), `App.tsx` (açılıştan 20 sn sonra, hesap başına 12 saatte bir), `components/Settings.tsx` ("Veri Sağlığı Denetimi" düğmesi + sonuç penceresi).

| Kontrol | Bulursa |
|---|---|
| Satış kaydedilmiş, stoğa işlenmemiş (`isProcessed === true && isInventoryProcessed === false`) | **Otomatik tamamlar** (`processInventory`, kendi içinde tekrar korumalı) |
| Tedarikçi belgesi stoğa işlenmemiş | **Otomatik tamamlar** (`saveSupplierPurchaseWithInventory`) |
| Kasa/banka bakiyesi ≠ hareket toplamı | **Otomatik düzeltir** (`reconcileAccountBalances`) ve bildirir |
| Peşin satışın kasa hareketi yok | Yalnız bildirir (kullanıcı hareketi bilerek silmiş olabilir) |
| Depo miktarı ≠ alımlar − satışlar + düzeltmeler | Yalnız bildirir (Depo'daki mevcut stok denetimi ekranına yönlendirir) |
| Eksi stok | Raporda gösterir; uyarı sayısına katmaz |

Açık konu kalırsa bildirim kutusuna "Veri sağlığı uyarısı" yazar ve bir kez toast gösterir.

| # | Test | Beklenen |
|---|---|---|
| V1 | Ayarlar → Veri Sağlığı Denetimi | Pencere açılır; temiz hesapta "Her şey tutarlı" |
| V2 | Deneme hesabında bir peşin satışın kasa hareketini Kasa'dan sil, denetimi çalıştır | "Peşin satış kasada görünmüyor (1)" |
| V3 | Depo'da bir ürünün miktarını elle değiştir (düzeltme kaydı oluşturmadan mümkünse), denetimi çalıştır | "Depodaki miktar kayıtlarla uyuşmuyor" |
| V4 | İstatistik → kâr/zarar: T2'deki tedarikçi satışından sonra | Toplam kâr 60,00 artmış olmalı |
| V5 | Uygulamayı aç, 20 sn bekle | Açık konu varsa toast + bildirim; 12 saat içinde tekrar etmez |

**Yanlış alarm riski (kontrol et):** "Peşin satış kasada görünmüyor" kontrolü, satışın `id`'si ile `relatedId`'si eşleşen kasa hareketi arar. Kasa hareketi başka bir kimlikle bağlanan eski kayıtlarda yanlış alarm verebilir.

---

## 6. Ek (13.11 gece): zamanlı bildirimler ve izinler

Dosyalar: `utils/notificationPlan.ts` (saf plan, testli), `utils/scheduledNotifications.ts` (cihaza kurma + ilk açılış izinleri), `tests/notificationPlan.test.ts`, `App.tsx` (bağlantı), `utils/smartNotificationEngine.ts` (eski `scheduleNativeDueAlarms` devre dışı: çift bildirim olmasın).

**Kurallar (cihazın yerel saati)**
- Vade (`myPayments`, durum `PENDING`): vadeden 3, 2, 1 gün önce **20:00**; vade günü **10:00**; sonra biter. Aynı güne düşen vadeler tek bildirimde toplanır. Ödendi/iptal/silindi ise kurulmaz.
- Günün planı: her gün **09:00** (o günün hatırlatıcıları + vadesi gelenler).
- Günün raporu: her gün **21:00** (satış adedi, net tutar, tahsilat). Bugünkü gerçek rakamla; sonraki günler genel metinle kurulur ve uygulama açıldıkça güncellenir.
- 7 gün ileriye kurulur; veri değişince ve saat başı yenilenir. Yerel bildirim kimlikleri 880000–880059.

**Platform davranışı**
| Platform | Uygulama kapalıyken | Not |
|---|---|---|
| Android / iOS | Gelir (işletim sistemi alarmı) | Android 14'te tam-saat izni yoksa birkaç dakika gecikebilir |
| Web / masaüstü (Edge-Chrome uygulama penceresi) | **Gelmez** | Açıkken zamanında gösterilir; açılınca son 6 saatte kaçan bildirim hemen gösterilir. Kapalıyken bildirim için sunucu push (FCM) gerekir: yapılmadı |

**İzinler:** ilk girişte bir kez — telefon: bildirim, konum, kamera, mikrofon sırayla; web/masaüstü: bildirim ve konum (kamera/mikrofon ilk kullanımda). Manifest/Info.plist'te eksik izin bulunmadı (Android: konum, kamera, mikrofon, bildirim, tam-saat alarm, açılışta yeniden kurma; iOS: konum-kullanırken, kamera, fotoğraflar, mikrofon). Dosya erişimi: PDF/dosya seçimi sistem seçicisiyle yapıldığı için ek izin gerekmiyor.

| # | Test | Beklenen |
|---|---|---|
| B1 | `npm test` | 9/9 (4'ü bildirim planı) |
| B2 | Telefonda vadesi 3 gün sonra olan bir çek/ödeme gir, uygulamayı kapat | O akşam 20:00, sonraki iki akşam 20:00, vade günü 10:00 bildirimi; sonra gelmez |
| B3 | B2'deki kaydı "ödendi" yap | Kalan hatırlatmalar iptal olur |
| B4 | Telefon: 21:00 ve 09:00 | "Günün raporu" ve "Günün planı" gelir; rapor o günün rakamlarını taşır (gün içinde uygulama açıldıysa) |
| B5 | Web'de sekme açıkken 21:00 | Bildirim gelir; iki sekme açıksa tek bildirim |
| B6 | Web'i 21:00'de kapalı tut, 22:00'de aç | Rapor bildirimi açılışta bir kez gösterilir |
| B7 | Temiz kurulumda ilk giriş (telefon) | 4 izin penceresi sırayla; ikinci açılışta tekrar sorulmaz |
| B8 | Eski sürümden güncelleme | 09:00'da **tek** bildirim (eski "Günlük aranacaklar" özeti gelmemeli) |

**Bildirim logosu (13.11 gece):** Android için `res/drawable-xxxhdpi/ic_stat_mks.png` (beyaz silüet, durum çubuğu) ve `res/drawable-nodpi/mks_notif_logo.png` (renkli logo, bildirim gövdesi) eklendi; `MKS_NOTIF_ICONS` sabiti ve `capacitor.config.json → plugins.LocalNotifications`. Web/masaüstü zaten `/icons/icon-192.png` kullanıyor; iOS uygulama simgesini kendisi gösterir. Test B9: Android'de bildirim gelince durum çubuğunda MKS silüeti, bildirimin sağında renkli logo görünmeli (yeni APK gerekir).

**Depo ekranı sadeleştirme (13.11 gece):** `components/Inventory.tsx` üst bölümü 7 satırdan 2 satıra indi. 1. satır: sekmeler (Depo / Analiz / Kâr) + `⋯ İşlemler`. 2. satır: arama + filtre + `+`. Mal Kabul, Fatura Tara, Sipariş, Fiyatlar, Muadil, e-Fatura düğmeleri ve PDF raporları `İşlemler` menüsüne; kategori, yıl, stok durumu ve SKT filtreleri `Filtre` paneline taşındı. SKT riski varsa aramanın altında tek satır uyarı çıkar. Test D1: menüdeki 10 işlemin her biri eski düğmesiyle aynı pencereyi açmalı. D2: filtre rozeti etkin filtre sayısını göstermeli, "Filtreleri temizle" hepsini sıfırlamalı. D3: 360 px genişlikte taşma olmamalı.

**Panel hava penceresi (13.11 gece):** Ana paneldeki hava şeridine dokununca açılan ve telefonda boş görünen eski "Zirai Hava, Delta-T İlaçlama Penceresi & GDD Radarı" penceresi kaldırıldı; artık tam ekran hava ekranı (`AgroWeatherScreen`) açılıyor. Test H11: Panel → hava şeridine dokun → tam ekran hava ekranı açılmalı, geri tuşu kapatmalı.

**Uydu analizi "is not valid JSON" hatası (13.11 gece):** Neden: istemci doğru adrese gidiyor (`FieldSatelliteAnalyzerModal.tsx` → `${API_BASE}/api/satellite/analyze`, telefonda API_BASE = Cloud Run kök adresi), ancak canlı Cloud Run sunucusu eski sürüm ve bu yolu içermiyor: `POST /api/satellite/analyze` → 404 text/html, `GET /api/satellite/status` ve `/api/version` → 200 text/html (index.html); `/api/check-ai` ise JSON dönüyor. Yol yerel `server.ts` içinde tanımlı (437. satır), yani yalnız yayın eksik. · Düzeltme: `components/farmers/FieldSatelliteAnalyzerModal.tsx` içinde `resp.json()` öncesi Content-Type kontrolü ve ayrıştırma koruması eklendi; JSON olmayan yanıtta kırmızı kutuda "Uydu servisine şu an ulaşılamıyor. İnternet bağlantınızı kontrol edin; sorun sürerse uygulamayı güncelleyin." gösterilir, sunucunun kendi `{ error }` mesajları eskisi gibi gösterilir. API_BASE atlayan başka göreli `/api/` çağrısı bulunmadı (`utils/gemini.ts` ve `utils/desktopUpdateManager.ts` içindeki göreli adresler API_BASE denemesinden sonra gelen yedeklerdir, dokunulmadı). tsc temiz, npm test 9/9. · Kalan: canlı sunucunun güncel `server.ts` ile yeniden yayınlanması gerekiyor (gcloud bu bilgisayarda yok); yayın olmadan uydu verisi telefonda gelmez, yalnız mesaj düzelir — o da yeni APK gerektirir. · Test U1: telefonda parsel → uydu analizi → ya veri gelmeli ya da anlaşılır Türkçe mesaj; ham "Unexpected token" görünmemeli.

**Sunucu yayını hazırlığı (13.11 gece):** gcloud D:\gcloud altına kuruldu. Yayın: D:\MKS\SUNUCU_YAYINLA.bat (önce trafik almayan "deneme" sürümü, üç API yoklaması, onayla canlıya alma, geri alma komutu). Giriş ve yayın kullanıcı tarafından yapılacak; henüz yapılmadı.


**Deneme yayını (14.11):** proje gen-lang-client-0867370962, `gcloud run deploy --source . --no-traffic --tag deneme` 12 sn içinde "Validating configuration" adımında BAŞARISIZ oldu: `spec.template.metadata.annotations[run.googleapis.com/sources]: Source annotation has sources that are not referenced by a container.` (servis AI Studio "derlemesiz kaynak" yöntemiyle kurulmuş; şablonda `run.googleapis.com/sources` ve `run.googleapis.com/base-images` notları, `image: scratch`, port 3000 ve `/bin/sh -c` komutu var, Dockerfile yayını bunlarla çakışıyor). Yeni revizyon, Cloud Build derlemesi ya da Artifact Registry deposu oluşmadı; yalnız `cloudbuild.googleapis.com` API'si etkinleştirildi. Trafik: canlı hâlâ m-hendis-kay-t-sistemi-00093-ptb %100. Canlı yoklama: /api/version ve /api/satellite/status 200 ama HTML (SPA geri dönüşü, yeni API yok), POST /api/edm/test-connection 404; yani canlı eski sürüm. Canlıya alma yapılmadı. Geri alma gerekmez; hiçbir şey değişmedi.


**Deneme yayını – ikinci deneme (14.11):** Yol 1 varyant (iii) (imaj Cloud Build ile ayrı derlendi: europe-west3-docker.pkg.dev/gen-lang-client-0867370962/cloud-run-source-deploy/mks-server:deneme; servis YAML kopyasından run.googleapis.com/sources ve base-images notları ile runtimeClassName kaldırılıp `gcloud run services replace` ile yayınlandı; --clear-base-image, --no-automatic-updates ve beta yolları başarısız), revizyon m-hendis-kay-t-sistemi-00094-pzl (etiket deneme, %0), deneme adresi https://deneme---m-hendis-kay-t-sistemi-ztibvklfjq-ey.a.run.app, canlı trafik: m-hendis-kay-t-sistemi-00093-ptb %100 (değişmedi; servis artık bu revizyona sabit, "en son revizyonu izle" modunda değil). Yoklamalar: deneme / 200 HTML, /api/version 200 JSON (8.2.1, build 28), /api/satellite/status 200 JSON (configured:false), /api/edm/test-connection 401 JSON, /api/satellite/analyze 401 JSON, /api/check-ai 200 JSON (ready), APK HEAD 200 (14,2 MB); canlıda /api/version ve /api/satellite/status HTML (SPA) döndü, /api/edm/test-connection 404 (eski sürüm ayakta). Günlüklerde başlangıç hatası yok. CORS: deneme https://localhost ve capacitor://localhost için Access-Control-Allow-Origin kökenin kendisi (izinli; ALLOWED_ORIGINS tanımsız olsa da sabit listede), izinsiz köken 500; canlı her kökene * döndürüyor; yeni sunucu yalnız GET/POST/OPTIONS yöntemlerine izin veriyor. Canlıya alma yapılmadı.

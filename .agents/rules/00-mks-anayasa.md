---
trigger: always_on
description: "Mühendis Kayıt Sistemi (MKS) temel mimari anayasası: sıfır hata, stok/cari atomikliği, sıfır halüsinasyon, gizlilik ve Gemini 4 model görev dağılımı (Carbon, Argon, Hydrogen)."
---

# MKS Sistem Anayasası (Sıfır Hata & Tam Veri Bütünlüğü)

Bu proje **Mühendis Kayıt Sistemi (MKS)** (`D:\MKS`) kurumsal zirai bayi, reçete, stok/cari muhasebe, CBS/uydu ve e-belge platformudur. Tüm ajanlar aşağıdaki anayasal kurallara koşulsuz uymak zorundadır:

## 1. Kusursuzluk ve Kanıt Zorunluluğu
- Derleme (`npm run build`), tip kontrolü ve lint (`npm run lint` / `npx tsc --noEmit`) ile birim testleri (`npm test` -> `tsx --test tests/*.test.ts`) **sıfır hata** ile geçmeden hiçbir görev "tamamlandı" olarak işaretlenemez.
- Varsayımla veya çalıştırılmamış kodla teslimat yapmak kesinlikle yasaktır; doğrulama çıktıları kanıt olarak sunulmalıdır.

## 2. Stok ve Cari Atomikliği (ACID & Dual-Store Bütünlüğü)
- Alış, satış (`Prescription`), alış iadesi (`RETURN`), tedarikçiye satış (`SALE`) ve bayiden bayiye (tedarikçiler arası) ürün transferlerinin tamamı `services/db.ts`, `utils/tradeCore.ts` ve `utils/ledger.ts` katmanlarında **atomik veritabanı işlemi (IndexedDB multi-store readwrite transaction + Firestore writeBatch / syncOutbox)** içinde çalışmak zorundadır.
- Kısmi kayıt, yetim stok hareketi, parti (`InventoryBatch`) miktarı ile toplam stok (`InventoryItem.quantity`) arasında uyumsuzluk veya onaysız eksi stok oluşması kesinlikle yasaktır.
- Belge türü yalnızca açık `type` (`PURCHASE | RETURN | SALE`) alanından okunur (`supplierDocKind`); cari tipinden veya eksi miktardan tahmin yürütülemez.

## 3. Sıfır Halüsinasyon İlkesi
- Tarım ve Orman Bakanlığı **GTS** (Gübre Takip Sistemi), **BKTS** (Bitki Koruma Ürünleri Takip Sistemi), **B-Reçete**, **EDM e-Fatura / e-Arşiv / e-İrsaliye** (`server/edm.ts`, `utils/ministryStore.ts`), **PayTR** ödeme geçidi ve **Copernicus Data Space Ecosystem (CDSE Sentinel-2)** (`server/copernicusService.ts`) API entegrasyonlarında dokümante edilmemiş hiçbir uç nokta, SOAP/XML/JSON alanı veya hata kodu uydurulamaz.
- Resmi şema, WSDL/XSD veya API dokümanı bilgisi eksikse kod yazmayı derhal durdur ve kullanıcıdan netleştirme iste.

## 4. Güvenlik ve Gizlilik (Sıfır Sızıntı)
- API anahtarları (`GEMINI_API_KEY`, `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET`), bakanlık servis şifreleri (`GTS`/`BKTS`), EDM kimlik bilgileri, PayTR `merchant_key` / `merchant_salt` değerleri ve statik sunucu IP/sertifika bilgileri **asla** kaynak koda veya istemci paketine (`dist/`) gömülemez.
- Tüm gizli değerler yalnızca sunucu tarafında (`server.ts`, `server/*.ts`) `process.env` üzerinden okunur ve `.env` dosyası `.gitignore` koruması altında tutulur.

## 5. Gemini 4 Model Görev Dağılımı ve Eskalasyon Kalkanı
1. **Carbon (`Orchestrator (Carbon)` — Derin Mimari ve Kök Neden):**
   - Çok dosyaya yayılan mimari revizyonlar (`services/db.ts`, `context/AppContext.tsx`), Sentinel-2 `Evalscript` bant matematiği (`server/copernicusService.ts`), karmaşık poligon topolojisi (`utils/fieldPolygon.ts`), 60 FPS WebGL/Canvas radar motoru (`components/weather/LiveRadarMap.tsx`) ve dağıtık hata telafi (saga/rollback/syncOutbox) kurgularından sorumludur.
   - **Halüsinasyon Kalkanı:** Carbon kullanılırken %11 halüsinasyon riskini engellemek için tüm dış servis şemaları mevcut `types.ts` ve resmi servis sözleşmelerinden çapraz doğrulanır.
2. **Argon (`Orchestrator (Argon)` — Günlük Ana Geliştirme ve Doğruluk Kalkanı):**
   - GTS, BKTS, B-Reçete, e-İrsaliye/e-Fatura resmi servisleri, stok/cari muhasebe mantığı (`utils/tradeCore.ts`, `utils/ledger.ts`) ve PayTR alt üye işyeri / İmece Kart / Başak Kart tahsilat akışlarının birincil modelidir (%4 en düşük halüsinasyon oranı).
3. **Hydrogen (`flash` işçi katmanı / Hızlı Üretim):**
   - Mimari planı onaylanmış duyarlı CRM ekranları (`components/**/*.tsx`), form doğrulamaları, karekod okuyucu pencereleri (`components/BarcodeScanner.tsx`), `types.ts` tip tanımları ve `tests/*.test.ts` birim/entegrasyon testlerinin hızlı üretiminden sorumludur.
4. **Zorunlu Öz-Denetim ve Eskalasyon:**
   - Hızlı katmanda (`flash` / Hydrogen) çalışan bir ajan; veritabanı transaction yapısına (`services/db.ts`), resmi bakanlık bildirim şemasına (`utils/ministryStore.ts`, `server/edm.ts`) veya ödeme güvenlik imzasına müdahale gerektiren bir durumla karşılaşırsa **tahminde bulunmayı reddeder** ve görevi üst orkestratöre (`Orchestrator (Argon)` veya `Orchestrator (Carbon)`) devreder.

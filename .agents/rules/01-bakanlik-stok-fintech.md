---
trigger: model_decision
description: "GTS, BKTS, B-Reçete, DataMatrix karekod, e-İrsaliye, stok/cari hareketleri, PayTR alt üye işyeri ve İmece/Başak tarım kartı ödeme işlemlerinde etkinleştir."
---

# Bakanlık Servisleri (GTS/BKTS/B-Reçete), Stok/Cari Muhasebe ve FinTech Kuralları

Bu kural seti `utils/gs1Parser.ts`, `utils/ministryStore.ts`, `utils/tradeCore.ts`, `utils/ledger.ts`, `utils/currency.ts`, `utils/edmWarehouseManager.ts`, `server/edm.ts`, `services/db.ts` ve ilgili stok/reçete/tahsilat bileşenlerinde yapılan tüm çalışmalarda zorunludur.

## 1. GS1 DataMatrix (Karekod) Ayrıştırma ve Doğrulama (`utils/gs1Parser.ts`)
- **Zorunlu AI Alanları:** GTIN `(01)` (14 haneye normalize edilmiş ve Modulo-10 kontrol basamağı doğrulanmış), Seri Numarası `(21)`, Parti/Lot Numarası `(10)` ve Son Kullanma Tarihi `(17)` (`YYMMDD` -> `YYYY-MM-DD`, ayın son günü `00` kuralı dahil) alanlarını ve `FNC1` (`\u001D` GS) grup ayırıcı karakterlerini hatasız ayrıştır.
- **Satış Anı Engelleme:**
  - SKT'si geçmiş (`expired: true`) ürünlerin reçeteye veya satış sepetine eklenmesini işlem anında engelle.
  - Sistemde daha önce satılmış, çıkışı yapılmış veya `ministryRecords` / `InventoryBatch` içinde tüketilmiş seri numaralı `(21)` tekil karekodların mükerrer satışını işlem anında reddet.
  - Değişken uzunluklu `(10)` veya `(21)` alanlarında `FNC1` ayırıcısı eksikse `ambiguous: true` bayrağını kaldır ve kullanıcıdan manuel doğrulama iste.

## 2. Saha Çift Tıklama ve Tekrarlı İstek Koruması (`Idempotency`)
- Zayıf saha internetinde çift gönderimi önlemek için her GTS/BKTS bildirimi, e-İrsaliye/e-Fatura kesimi (`server/edm.ts`), stok düşümü ve tahsilat isteğine deterministik veya UUID tabanlı benzersiz bir `idempotency_key` tanımla.
- İstemci tarafında işlem devam ederken tetikleyici butonu kilitle (`isSubmitting`); sunucu ve yerel veritabanı (`services/db.ts`) katmanında aynı `idempotency_key` ile gelen mükerrer istekleri ikinci kez işleme sokmadan önceki başarılı sonucu döndür.

## 3. Resmi Servis Hata Telafisi (Rollback / Saga & Kuyruk Yönetimi)
- GTS, BKTS veya EDM e-İrsaliye/e-Fatura servisi zaman aşımına uğrar veya hata dönerse yerel stok ve cari hareketin askıda/tutarsız kalmasını önleyecek atomik geri alma (**rollback**) mekanizmasını veya `syncOutbox` / `ministryRecords` üzerinde açık `TELAFİ_BEKLİYOR` (`COMPENSATION_PENDING` / `RETRY_QUEUED`) durumunu zorunlu tut.
- Resmi serviste onaylanmamış bir belgenin numarası kesinleşmiş gibi kilitlenemez; hata detayı sistem hata günlüğüne (`systemErrors`) kaydedilir ve kullanıcıya anlaşılır telafi aksiyonu sunulur.

## 4. Finansal Kesinlik ve PayTR / Tarım Kartı Güvenliği
- **Kuruş Aritmetiği Zorunluluğu (`utils/tradeCore.ts`):** Tutar, KDV, iskonto, bayi komisyonu, alt üye işyeri hakedişi ile **İmece Kart** ve **Başak Kart** hasat vadeli/taksitli hesaplamalarında ham `float` / `double` toplama-çıkarma kullanımı yasaktır. Tüm parasal hesaplamalar tam kuruş (`toKurus` -> `integer`) veya sabit noktalı `Decimal` aritmetiği üzerinden yapılmalı, yalnızca gösterim/kayıt aşamasında `fromKurus` ile dönüştürülmelidir.
- **PayTR Callback & İmza Doğrulaması:** PayTR bildirim (callback/webhook) uç noktasında `merchant_oid`, `status`, `total_amount` değerleri üzerinden `merchant_key` ve `merchant_salt` ile **HMAC-SHA256 `hash` doğrulaması** (`crypto.timingSafeEqual`) ve veritabanındaki beklenen sipariş tutarı (kuruş bazında birebir eşleşme) kontrolü yapılmadan hiçbir sipariş veya abonelik onaylanamaz.

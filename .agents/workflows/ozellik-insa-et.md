---
name: ozellik-insa-et
description: "Yeni bir MKS özelliğini planlama, kodlama, denetim ve test adımlarıyla uçtan uca hatasız geliştirir."
---

# MKS Uçtan Uca Özellik İnşa İş Akışı (`/ozellik-insa-et`)

Yeni bir MKS özelliği geliştirirken sıfır hata ve tam veri bütünlüğü için aşağıdaki 4 adımı sırasıyla uygula:

## Adım 1: Keşif, Etki Analizi ve Mimari Plan (`mks-bas-mimar`)
1. İlgili mevcut dosyaları (`types.ts`, `services/db.ts`, `utils/tradeCore.ts`, `server.ts`, `components/**`) tara.
2. Özelliğin yerel IndexedDB + Firestore (`services/db.ts`) şemasına ve dış servislere (GTS, BKTS, B-Reçete, EDM e-İrsaliye/e-Fatura, PayTR, Copernicus Sentinel-2) etkisini analiz et ve net uygulama planını çıkar.
3. Belirsiz veya dokümante edilmemiş bir resmi servis şeması varsa **kodlamaya başlamadan önce** durup kullanıcıya sor.

## Adım 2: Atomik İş Mantığı ve Arayüz/Test Kodlaması
1. İş mantığı, stok/cari muhasebe (`utils/tradeCore.ts`, `utils/ledger.ts`) ve resmi servis katmanını (`utils/ministryStore.ts`, `server/edm.ts`) **atomik transaction**, tam kuruş aritmetiği (`toKurus`), `idempotency_key` ve `rollback` / `TELAFİ_BEKLİYOR` kurallarına göre uygula.
2. Harita, poligon, Sentinel-2 uydu veya meteoroloji radarı bileşenlerini `cbs-radar-uzmani` alt ajanıyla tamamla.
3. Duyarlı CRM arayüzünü (masaüstü + saha mobil yüksek kontrast) ve `tests/*.test.ts` birim testlerini `hydrogen-arayuz-test-iscisi` alt ajanıyla tamamla.

## Adım 3: Bağımsız Güvenlik ve Bütünlük Denetimi (`bakanlik-odeme-denetcisi`)
1. Değişen tüm dosyaları `bakanlik-odeme-denetcisi` alt ajanına salt okunur olarak denetlet.
2. Denetçinin raporladığı **KRİTİK** ve **ORTA** seviye tüm stok kayması, yarış durumu, rollback eksikliği, kuruş yuvarlama veya gizli anahtar sızıntısı risklerini eksiksiz gider.

## Adım 4: Gerçek Doğrulama ve Sıfır Hata Kanıtı
`D:\MKS` kök dizininde aşağıdaki doğrulama komutlarını sırasıyla çalıştır ve çıktıları raporla:
1. Tip kontrolü ve lint: `npm run lint` (`tsc --noEmit && eslint .`)
2. Birim testleri: `npm test` (`tsx --test tests/*.test.ts`)
3. Üretim derlemesi: `npm run build` (`vite build && esbuild server.ts ...`)

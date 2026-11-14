---
name: tam-denetim
description: "Commit veya yayın öncesinde son değişiklikleri stok bütünlüğü, GTS/BKTS/PayTR güvenliği, harita bellek sızıntısı ve tip hatalarına karşı denetler."
---

# MKS Yayın ve Commit Öncesi Tam Denetim İş Akışı (`/tam-denetim`)

Commit, Firebase Hosting yayını veya Android/iOS/Masaüstü paketlemesi öncesinde aşağıdaki 4 adımı sırasıyla çalıştır:

## Adım 1: Değişen Dosyaların Tespiti
1. `D:\MKS` dizininde `git status --short` ve `git diff --stat` komutlarını çalıştırarak değişen ve eklenen tüm dosyaları listele.
2. `.env`, `.env.local`, `*.jks`, `*.keystore` veya sertifika dosyalarının yanlışlıkla sahneye (staged) alınmadığını doğrula.

## Adım 2: Stok, Bakanlık ve FinTech Güvenlik Denetimi (`bakanlik-odeme-denetcisi`)
1. `bakanlik-odeme-denetcisi` alt ajanını çalıştırarak değişen kodları şu kriterlere göre denetlet:
   - Stok/cari atomikliği ve alış iadesi (`checkPurchaseReturn`) tutarlılığı,
   - GS1 DataMatrix (`utils/gs1Parser.ts`) SKT/seri numarası doğrulaması ve `idempotency_key` koruması,
   - GTS/BKTS/EDM e-İrsaliye hata telafisi (`rollback` / `TELAFİ_BEKLİYOR`),
   - PayTR HMAC-SHA256 `hash` doğrulaması ve tam kuruş (`toKurus`) aritmetiği,
   - Ortam değişkeni (`process.env`) ve API anahtarı sızıntısı kontrolü.

## Adım 3: CBS, Uydu ve Radar Bellek Sızıntısı Kontrolü
1. Eğer harita (`components/MapComponent.tsx`, `utils/fieldPolygon.ts`), uydu (`server/copernicusService.ts`, `FieldSatelliteAnalyzerModal.tsx`) veya radar (`components/weather/LiveRadarMap.tsx`) dosyaları değiştiyse:
   - GeoJSON `[lng, lat]` ile Leaflet `[lat, lng]` koordinat sırasını,
   - `@turf/area` jeodezik dekar (`1000 m² = 1 da`) hesabını ve uydu çekim tarihi rozetini,
   - Bileşen çıkışında (`unmount`) `WebGL` dokuları, `Canvas` tamponları, Leaflet katmanları ve `requestAnimationFrame` zamanlayıcılarının (`destroy`/`dispose`) eksiksiz temizlendiğini doğrula.

## Adım 4: Derleme, Lint ve Test Kanıtı
`D:\MKS` dizininde aşağıdaki komutları çalıştır ve sonuçları maddeler halinde kullanıcıya sun:
1. `npm run lint` (`tsc --noEmit && eslint .`)
2. `npm test` (`tsx --test tests/*.test.ts`)
3. `npm run build`

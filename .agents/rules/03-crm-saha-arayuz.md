---
trigger: glob
globs: "{App.tsx,index.css,components/**/*.tsx,context/**/*.tsx,hooks/**/*.ts}"
---

# CRM, Saha Mobil ve Masaüstü Çift Ekran Arayüz Kuralları

Bu kural seti MKS'nin tüm kullanıcı arayüzü bileşenlerinde (`components/**/*.tsx`), tema/stil sisteminde (`index.css`) ve ekran durumu yönetiminde (`context/**`, `hooks/**`) zorunludur.

## 1. Çift Ekran (Masaüstü + Saha Mobil) Uyumu ve Kontrast Garantisi
- **Tasarım Token Sadakati:** `index.css` içindeki tema değişkenlerinden (`--mks-card`, `--mks-text`, `--mks-muted`, `data-theme="TECHNICAL"`, `APPLE`, `LIGHT`, `ORGANIC`, `GLASSY_V30`) sapma. Koyu zeminli kartların (`.v22-forest-card`, `.v22-bento-card`, `.v22-pro-subcard`, hava durumu bannerları) içinde koyu yeşil veya siyah (`#0b211d`, `#0f7652`, `#116a4e`) metin kullanarak okunaksız düşük kontrast oluşturma; koyu zeminlerde parlak zümrüt (`#34d399` / `text-emerald-300`) ve net beyaz (`#ffffff` / `text-white`) kullan (minimum WCAG AA 4.5:1 kontrast).
- **Masaüstü Görünümü:** Geniş ekranlarda yoğun tablo, Bento özet kartları ve harita/detay bölünmüş yönetim görünümü sun; düzeni, hizalamaları ve kart oranlarını bozma.
- **Saha Mobil Görünümü:** Güneş ışığı altında yüksek okunabilirlik, tek elle başparmakla erişilebilir birincil aksiyon butonları (minimum `44x44px` dokunma alanı) ve hızlı kamera karekod okuyucu (`BarcodeScanner` / `LazyBarcodeScanner`) tetikleyicisi sun.

## 2. Zayıf Saha Ağı Dayanıklılığı (Offline-First UX)
- Kırsal saha koşullarında internet bağlantısı koptuğunda veya yavaşladığında kullanıcıların girdiği reçete, cari, tahsilat veya tarla çizim form verilerini **asla kaybettirme**; yerel IndexedDB (`services/db.ts`) ve `syncOutbox` kuyruğu üzerinden kesintisiz çalışmaya devam et.
- Yükleme ve kayıt sırasında ilgili butonları kilitleyerek (`disabled` + görsel yükleniyor göstergesi) mükerrer tıklamayı engelle; ağ hatası durumunda form içeriğini koruyarak anlaşılır Türkçe yeniden deneme (`Tekrar Dene`) veya çevrimdışı kuyruğa alma akışı göster.

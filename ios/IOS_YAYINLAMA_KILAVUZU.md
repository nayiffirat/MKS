# MKS (Mühendis Kayıt Sistemi) — iOS App Store & TestFlight Yayınlama Kılavuzu (`v8.2.1` • Build `28`)

Bu klasör (`D:\MKS\ios\App`), **Mühendis Kayıt Sistemi (MKS)** uygulamasının Apple App Store Connect ve TestFlight inceleme kurallarına %100 uyumlu yerel Capacitor iOS projesini içerir.

---

## 1. Tamamlanan Apple İnceleme (App Review) Hazırlıkları

1. **Bundle Identifier & Sürüm Bilgileri (`project.pbxproj`):**
   - **Bundle ID:** `com.nayiffirat.muhendiskayitsistemi`
   - **Sürüm (`MARKETING_VERSION`):** `8.2.1`
   - **Derleme (`CURRENT_PROJECT_VERSION`):** `28`
   - **Minimum iOS Sürümü (`IPHONEOS_DEPLOYMENT_TARGET`):** `14.0` (Xcode 16 ve güncel CocoaPods standartları ile tam uyumlu)
   - **Varsayılan Dil & Bölge:** Türkçe (`tr`)

2. **Apple Zorunlu Gizlilik Bildirimi (`ITMS-91053` Koruması):**
   - `ios/App/App/PrivacyInfo.xcprivacy` dosyası oluşturuldu ve Xcode `PBXResourcesBuildPhase` içine bağlandı.
   - `NSPrivacyAccessedAPICategoryUserDefaults` (`CA92.1`), `FileTimestamp` (`C617.1`), `SystemBootTime` (`35F9.1`) ve `DiskSpace` (`E174.1`) nedenleri eksiksiz tanımlandı.

3. **24-bit Opak RGB App Store İkonu (`ITMS-90717` Koruması):**
   - `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (`1024x1024`, alfa kanalsız 24-bit RGB) Play Console kurumsal MKS logosundan üretildi.
   - `public/icons/apple-touch-icon.png` (`180x180`, 24-bit RGB) Safari Ana Ekrana Ekle (PWA) kurulumları için hazırlandı.

4. **İzin Metinleri & Özel URL Şeması (`Info.plist`):**
   - Kamera (2D BKTS/GTS Karekod, Barkod ve e-Fatura OCR), Konum, Mikrofon, Fotoğraf Galerisi ve AdMob (`NSUserTrackingUsageDescription`) Türkçe izin açıklamaları eklendi.
   - `mks://` ve `com.nayiffirat.muhendiskayitsistemi://` derin bağlantı (Deep Link) şemaları tanımlandı.
   - Gece (`#080D14`) açılış ekranı (`LaunchScreen.storyboard`) ve durum çubuğu (`UIStatusBarStyleLightContent`) ayarlandı.

5. **Yabancı Platform İkililerini Temizleyici (`Apple Guideline 2.5.2` Koruması):**
   - `npm run sync:ios` komutu çalıştırıldığında `scripts/prepare-ios-bundle.mjs` otomatik devreye girer ve `ios/App/App/public` içinden Android `.apk`, Windows `.exe` ve `server.cjs` dosyalarını temizler (~14 MB tasarruf + Apple reddi önleme).

---

## 2. Fiziksel Mac Olmadan Bulutta `.ipa` Üretimi (GitHub Actions)

Depoda `.github/workflows/ios-release.yml` iş akışı hazırdır:

1. Değişiklikleri GitHub deponuza (`https://github.com/nayiffirat/MKS`) gönderin.
2. GitHub -> **Actions** -> **MKS iOS App Store & TestFlight Build (v8.2.1 - Build 28)** sekmesine girin.
3. **Run workflow** butonuna tıklayın:
   - İmzasız test/arşiv doğrulaması için `export_signed_ipa: false` seçin.
   - Doğrudan App Store Connect / TestFlight imzalı `.ipa` için GitHub Secrets bölümüne `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_PRIVATE_KEY` ekleyip `export_signed_ipa: true` seçin.

---

## 3. App Store Connect Mağaza Metinleri (Temel ERP Öncelikli)

- **Uygulama Adı:** Mühendis Kayıt Sistemi (MKS)
- **Alt Başlık (30 karakter):** Çiftçi Cari, Stok, BKTS, Fatura
- **Anahtar Kelimeler:** zirai ilaç,çiftçi cari,stok takibi,bkts,gts,b-reçete,e-fatura,ziraat mühendisi,barkod,veresiye
- **Tanıtım Sıralaması:**
  1. Çiftçi Cari Takibi, Parçalı Tahsilat ve Kayıpsız Yıllık Devir
  2. Depo ve Stok Takibi (Barkodlu Satış + Onaylı Stok Sayımı)
  3. Tarım Bakanlığı BKTS, GTS 2D Karekod ve Aktif Madde Muadil Radarı
  4. Resmi EDM e-Fatura, e-Arşiv ve Kasa-Banka Mutabakatı
  5. Yardımcı Saha Araçları (Silo Kantar, İlaçlama Hava Durumu, TKGM Parsel ve Uydu Analizi)

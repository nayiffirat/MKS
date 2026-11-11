# MKS v8.1 — 4 Platform Yayın, iOS, Resmi Web Sitesi ve 7/24 Bulut Rehberi

## 1. Bilgisayar Kapalıyken Çalışma Mimarisi (%100 Bulut + Çevrimdışı)
- **Veritabanı & Kimlik Doğrulama:** Tüm kullanıcı hesapları, müstahsil carileri, reçeteler, stok sayımları, harita parselleri ve girişsiz **Üretici Portalı** Google Firebase (`muhendiskayitsistemi`) bulut sunucularında 7/24 çalışır.
- **Yerel Sunucu Bağımsızlığı:** Yerel HASANO (`8787`) bağımlılığı tamamen kaldırılmıştır. Sizin bilgisayarınız tamamen kapalı olsa bile Android, iOS, Web, Masaüstü ve çiftçilere gönderdiğiniz Üretici Portalı bağlantıları kesintisiz çalışmaya devam eder.
- **Tarlada İnternetsiz Çalışma:** Cihaz içi `IndexedDB + Sync Outbox` motoru sayesinde tarlada internet çekmese bile yapılan tüm işlemler kaydedilir; internet geldiği saniye buluta otomatik aktarılır.

---

## 2. Hazır Kurulum ve Yayın Paketleri
1. **Resmi Web Sitesi, Tanıtım Görselleri & Giriş Merkezi:**
   - Derlenmiş üretim klasörü: `D:\MKS\dist` (Arka uç sunucusu: `D:\MKS\dist\server.cjs`)
   - Görseller: `D:\MKS\public\showcase\satellite-ndvi-showcase.jpg`, `D:\MKS\public\showcase\erp-bkts-silo-showcase.jpg`, `D:\MKS\public\icons\og-banner.jpg`
   - İkon Seti (Web / PWA / Apple Touch / App Store): `D:\MKS\public\icons\` (`favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-1024.png`)
   - Ziyaretçiler web adresine girdiğinde sol tarafta yüksek çözünürlüklü ürün vitrinini ve indirme bağlantılarını, sağ tarafta ise doğrudan **MKS Giriş Yap / Ücretsiz Kayıt Ol / SMS / Google Giriş** panelini görür.

2. **Android (Telefon & Tablet — API 36, v26 / 8.1.0):**
   - Doğrudan Kurulum APK: `D:\MKS\MKS_Test_API36_v26.apk` (ve `dist/downloads/MKS_Android.apk`)
   - Google Play Console Yayın Paketi: `D:\MKS\MKS_PlayStore_API36_v26.aab`

3. **iOS (iPhone & iPad — v8.1.0, Build 26):**
   - **Yöntem A (Anında Kurulum — Safari Ana Ekrana Ekle):** iPhone/iPad Safari ile siteye girip **Paylaş -> Ana Ekrana Ekle** seçildiğinde özel `180x180` MKS ikonuyla tam ekran (adres çubuksuz) uygulama olarak kurulur.
   - **Yöntem B (App Store / TestFlight `.IPA` Paketi):**
     - Güncel Xcode projesi: `D:\MKS\ios\App\App.xcworkspace` (`Bundle ID: com.nayiffirat.muhendiskayitsistemi`, `1024x1024` alfa kanalsız App Store ikonu ve kamera/GPS/mikrofon/konuşma tanıma `Info.plist` izinleri hazır).
     - Mac bilgisayar olmadan bulutta `.ipa` üretmek için `.github/workflows/ios-appstore-build.yml` GitHub Actions iş akışı hazırlanmıştır (GitHub -> **Actions -> MKS iOS App Store (.IPA) Build -> Run workflow**).

4. **Windows Masaüstü Uygulaması (`.EXE`, v8.1):**
   - Kurulum Dosyası: `D:\MKS\desktop\MKS_Masaustu_Kurulum.exe` (ve `dist/downloads/MKS_Masaustu_Kurulum.exe`)
   - Çift tıklandığında kendisini `%LOCALAPPDATA%\MKS` klasörüne kurar, Masaüstü ve Başlat Menüsü kısayollarını oluşturur ve tam ekran uygulama penceresinde açılır.

---

## 3. Bulut Sunucusunu Güncelleme Komutları (İsteğe Bağlı Tek Komut)
Yeni eklenen Faz-4, Uydu Analizi ve Resmi Web Sitesi arayüzünü canlı bulut adreslerinize göndermek için:

### A) Firebase Hosting & Firestore Kuralları:
```powershell
cd D:\MKS
firebase login
firebase deploy --only firestore:rules,hosting
```

### B) Google Cloud Run (Copernicus Uydu & AI Arka Uç Sunucusu Dahil):
`D:\MKS\Dockerfile` hazır olduğu için Google Cloud Run panelinden GitHub deponuzu bağlayarak veya CLI ile tek komutla yayınlayabilirsiniz:
```powershell
gcloud run deploy m-hendis-kay-t-sistemi --source D:\MKS --region europe-west3 --allow-unauthenticated
```

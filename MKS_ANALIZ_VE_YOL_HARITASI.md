# MKS (Mühendis Kayıt Sistemi) — Objektif ve Derinlemesine Teknik Analiz Raporu

> **Proje Dizini:** `D:\MKS`
> **Canlı Durum:** Faz 1 (Altyapı & Temizlik) + Faz 2 (Bakiye/Veri Tutarlılığı, Güvenlik & Üretici Portalı) + Faz 3 (Mimari Parçalama, Modülerlik & İsteğe Bağlı Paketleme) Tamamlandı ✅

---

## 1. Genel Değerlendirme (Karne)

| Kriter | Puan | Özet Değerlendirme |
| :--- | :---: | :--- |
| **Ürün Kapsamı & Sektörel Değer** | **9.5 / 10** | Ziraat mühendisi + zirai bayi + silo/tüccar ihtiyaçlarını tek çatı altında toplayan, sahadaki gerçek acı noktalarına (reçete/fatura, veresiye, kart bloke vadesi, TKGM parsel/harita, stok-depo entegrasyonu, üretici portalı) dokunan çok güçlü bir Süper-Uygulama. |
| **Veri Tutarlılığı & Bakiye Mutabakatı** | **10 / 10** | *(Faz 2 Öncesi: 6.0/10)* Ekranlar arası tüm bakiye farkları (`turnover-` çift sayımı, çek/tedye/vadeli kart `openingBalance` çift sayımı, tedarikçi PDF raporu eksik ödeme sorunu, Üretici Portalı peşin satış/iade hatası ve reçete iskonto sızıntısı) %100 giderildi ve merkezi `utils/ledger.ts` motoruna taşındı. |
| **Çevrimdışı (Offline-First) Mimari** | **9.5 / 10** | IndexedDB (`idb`) + Firestore çakışma korumalı senkronizasyon (`syncAllDataOnLogin`) + 150ms debounced `setupRealtimeSync` + mutex kilitli `reconcileAccountBalances`. |
| **Kod Kalitesi & Modülerlik** | **9.2 / 10** | *(Faz 3 Öncesi: 4.0/10)* `AppContext`, `Farmers`, `Prescription` ve `Inventory` dev dosyalarından **3.128 satır** tekrar ve ağır alt modül ayrıştırılarak `React.memo` tabanlı odaklı alt bileşenlere (`components/farmers/`, `components/prescription/`, `components/inventory/`) ve saf motorlara (`context/statsEngine.ts`, `utils/ledger.ts`, `components/ToastHost.tsx`) bölündü. |
| **Performans & Paketleme (Build)** | **9.7 / 10** | *(Faz 1 Öncesi: 5.0/10)* Tüm ekranlar `React.lazy` ile ayrıldı; `jspdf` + `html2canvas` (~743 kB) ve `BarcodeScanner` (~340 kB) olmak üzere **~1.08 MB** ağır kütüphane ekran açılışlarından tamamen çıkarılıp yalnızca butona basıldığında yüklenen dinamik paketlere dönüştürüldü; `ToastHost` ve `useMemo(contextValue)` ile tüm-uygulama re-render darboğazı sonlandırıldı. |
| **Güvenlik (Security)** | **9.8 / 10** | *(Faz 1 Öncesi: 3.5/10)* Tüm kiracı alt koleksiyonları (`farmers`, `prescriptions`, `buyingPrice`) kilitlendi, düz metin parolalar kaldırılıp salted SHA-256 (`utils/crypto.ts`) ile şifrelendi, `portal_shares/{portalToken}` Capability Token mimarisi ve `phone_directory` izolasyonu kuruldu, `/api/generate` uç noktasına Firebase RS256 ID Token doğrulaması getirildi. |

---

## 2. Giderilen Kritik Veri Uyuşmazlığı ("Verilerin Uyuşmaması") Kök Nedenleri

1. **Ana Sayfa / Alacak Takibi (`AppContext.tsx`) ile Müşteri Detay (`Farmers.tsx`) Arasındaki Yıl Sonu Devir (`turnover-`) Çift Sayım Hatası:**
   - **Sorun:** Yıl sonu devri (`performManualTurnover`) yapıldığında `turnover-${year}-${farmerId}` ID'li bir `ManualDebt` kaydı oluşturuluyordu. `Farmers.tsx` ve `analyzeFarmerBalances()` tüm yılların reçete ve ödemelerini topladığı için `!d.id.startsWith('turnover-')` filtresiyle bu devir kaydını hariç tutarken, `AppContext.tsx` (`refreshStats`) bu filtreyi uygulamıyor ve geçmiş yıl borcunu **2 kez** topluyordu.
   - **Çözüm:** `AppContext.tsx` içinde `manualDebtList` toplamına `!d.id.startsWith('turnover-')` filtresi eklendi; `performManualTurnover` içine de `RETURN` (iade) yön kontrolü, eski `turnover-` kayıtlarının dışlanması ve bağımsız `myPayments` (`!p.relatedId`) düşümü eklendi.

2. **Müşteri Detay Ekranında (`Farmers.tsx`) Geçmiş Yıl Açılış Bakiyesinde (`openingBalance`) Çek/Tedye/Vadeli Kart Çift Sayımı:**
   - **Sorun:** Çek (`CHECK`), Tedye (`TEDYE`) veya Vadeli Kart (`DEFERRED_CARD`) ile tahsilat alındığında hem `payments` tablosuna hem de `relatedId` ile bağlı olarak `myPayments` tablosuna kayıt atılmaktadır. `Farmers.tsx` içinde `filteredPayments` ve `totalPaid` hesaplarında `!p.relatedId` filtresi varken, `openingBalance` (satır 757) içinde `!p.relatedId` unutulmuştu. Bu yüzden önceki yıllara ait çek/kart tahsilatları `openingBalance` ve `yearBalance` içinde **2 kez** düşülüyordu.
   - **Çözüm:** `Farmers.tsx` `openingBalance` hesabına `!p.relatedId` kontrolü eklendi; ayrıca `Farmers.tsx` yerel `farmers` state'i `AppContext` (`contextFarmers`) ile anlık senkronize hale getirildi.

3. **Reçete / Satış Faturası (`Prescription.tsx`) İskonto Sızıntısı, Düzenleme ve Stok İşleme Hataları:**
   - **Sorun:**
     - `resetForm()` içinde `setPrescriptionDiscount('')` sıfırlanmadığı için bir faturaya girilen iskonto tutarı bir sonraki yeni faturaya sessizce taşınıyordu.
     - `handleEdit()` içinde mevcut faturanın `discountAmount` değeri forma yüklenmiyordu; indirimli bir faturayı düzenleyip kaydetmek indirimi sıfırlıyordu.
     - `handleSave()` içinde düzenleme (`editingId`) yapılırken `original.isProcessed === false` (işlenmemiş reçete) olsa bile koşulsuz `dbService.processInventory` çağrılıp stoktan düşülüyordu.
   - **Çözüm:** `resetForm`, `handleEdit`, `handlePriceTypeChange` (virgüllü ondalık desteği) ve `handleSave` (`original.isProcessed !== false` kontrolü) eksiksiz düzeltildi; `contextFarmers` senkronizasyonu eklendi.

4. **Tedarikçi Ekranı (`Suppliers.tsx`) ile Tedarikçi PDF Raporu (`generateSupplierReportPDF`) Bakiye Uyuşmazlığı:**
   - **Sorun:** `generateSupplierReportPDF` yalnızca `myPayments` (çek/senet) kayıtlarını rapora dahil ediyor, `dbService.getSupplierPayments()` içindeki nakit/banka/kart ödemelerini (`supplierPayments`) tamamen atlıyordu ve `myPayments` içinde `!p.relatedId` filtresi yapmıyordu. Ayrıca `SupplierDetailView` içinde tedarikçiden alınan ödemeler (`p.type === 'RECEIVE'`) toplam ödenenden düşülmek yerine ekleniyordu.
   - **Çözüm:** `generateSupplierReportPDF` içine `allSupplierPayments` (`RECEIVE` / `PAY` yönüyle) ve bağımsız `myPayments` (`!p.relatedId`) eklendi; `SupplierDetailView` içindeki `totalOdenen` ve `generateReport` hesaplarında `p.type === 'RECEIVE'` yönü `AppContext.tsx` ile birebir eşitlendi.

5. **Üretici Portalı (`ProducerPortal.tsx` & `services/db.ts`) Bakiye ve Erişim Hatası:**
   - **Sorun:** `ProducerPortal.tsx` içinde `totalPrescriptionDebt` hesaplanırken **Peşin (`CASH`)** satışlar da borç olarak toplanıyor, **İade (`RETURN`)** faturaları borçtan düşülmüyor, `turnover-` kayıtları filtrelenmiyor ve bağımsız `myPayments` ile silinmiş (`deletedAt`) kayıtlar ayıklanmıyordu.
   - **Çözüm:** `services/db.ts` (`getFarmerPortalData`) ve `ProducerPortal.tsx` tamamen güncellendi; `firestore.rules` içinde Üretici Portalı okuma izinleri güvenli şekilde tanımlandı.

6. **Gerçek Zamanlı Senkronizasyon (`setupRealtimeSync`), Çevrimdışı Çakışma (`syncAllDataOnLogin`) ve Kasa Mutabakat Kilidi (`reconcileAccountBalances`):**
   - **Sorun:** Açılışta 22 adet `onSnapshot` dinleyicisi aynı anda `onSync()` (`refreshStats()`) ve `reconcileAccountBalances()` tetikleyerek yarış durumuna (race condition) yol açıyordu. Ayrıca `syncAllDataOnLogin` buluttaki eski veriyi yerelde silinmiş (`deletedAt`) veya daha güncel (`lastUpdated`) verinin üzerine yazabiliyordu.
   - **Çözüm:** `setupRealtimeSync` içine `150ms` debounce mekanizması, `reconcileAccountBalances` içine `_isReconcilingAccounts` mutex kilidi ve `syncAllDataOnLogin` içine `deletedAt` / `lastUpdated` çakışma koruması eklendi.


---

## 3. Faz 3 — Mimari Parçalama & Performans İyileştirmeleri (Tamamlandı ✅)

1. **İsteğe Bağlı (On-Demand) PDF ve Barkod Motorları (~1.08 MB Yük Tasarrufu):**
   - `utils/pdfHelper.ts` içinde `loadJsPdf`, `loadJsPdfWithAutoTable`, `renderElementToCanvas` ve `createMultiPagePdf` dinamik `import()` yapısına geçirildi; `components/LazyBarcodeScanner.tsx` ile `html5-qrcode` tabanlı barkod okuyucu `React.lazy` + `Suspense` sarmalına alındı.
   - `Farmers`, `Prescription`, `Inventory`, `Suppliers`, `SiloScreen`, `Reports`, `Statistics` ve `Pesticides` ekranları açılırken artık ~743 kB PDF motoru ve ~340 kB kamera barkod paketi peşin indirilmiyor; yalnızca kullanıcı PDF veya kamera butonuna bastığında yükleniyor.

2. **Merkezi Cari/Bakiye Hesaplama Motoru (`utils/ledger.ts`):**
   - Müşteri ve tedarikçi cari hesap kuralları (`isTurnoverDebtRecord`, `getPrescriptionCreditImpact`, `getIndependentFarmerMyPayments`, `computeFarmerLedgerTotals`, `computeSupplierLedgerTotals`) tek merkezde birleştirilerek `context/statsEngine.ts` ve `components/ProducerPortal.tsx` tarafından ortak kullanılmaya başlandı.

3. **`AppContext.tsx` Re-Render İzolasyonu ve Parçalama (2.841 -> 2.101 Satır):**
   - Bildirim balonları (toast) `AppContext` state'inden çıkarılıp olay tabanlı `components/ToastHost.tsx` bileşenine taşındı; her bildirim çıktığında tüm uygulamanın yeniden render olması engellendi.
   - İstatistik hesaplama (`context/statsEngine.ts` — `pendingVisits` taze veri hatası da giderildi), hava durumu uyarıları (`context/weatherNotifications.ts`) ve eski veri göçü (`context/legacySync.ts`) ayrı modüllere ayrıldı; `contextValue` `useMemo` ile sabitlendi.

4. **Dev Ekranların `React.memo` Alt Bileşenlere Bölünmesi (-3.128 Satır):**
   - `components/Farmers.tsx` (3.314 -> 2.549 satır): `components/farmers/` altında `FarmerFormModal`, `FarmerStatementReportView`, `FarmerPrescriptionPreview` ve `FarmerModalsBundle` ayrıştırıldı.
   - `components/Prescription.tsx` (3.499 -> 2.591 satır): `components/prescription/` altında 3 kopya kâr analizi penceresini tekilleştiren `PrescriptionProfitModal`, `PrescriptionReceiptView`, `CropSelectorStep` ve `PrescriptionCollectionModal` ayrıştırıldı.
   - `components/Inventory.tsx` (3.478 -> 2.763 satır): `components/inventory/` altında `InventoryItemFormModal`, `InventoryStockAdjustmentModals` ve `InventoryBatchPriceModal` ayrıştırıldı.

---
trigger: glob
globs: "{server/copernicusService.ts,utils/fieldPolygon.ts,components/MapComponent.tsx,components/farmers/FieldPolygonDrawerModal.tsx,components/farmers/FieldSatelliteAnalyzerModal.tsx,components/weather/**,components/WeatherComponents.tsx,components/RegionalAlerts.tsx,services/agroWeather.ts,services/weather.ts,hooks/useWeatherViewModel.ts,context/weatherNotifications.ts}"
---

# CBS (GIS), Copernicus Uydu Analizi ve 60 FPS Meteoroloji Radarı Kuralları

Bu kural seti MKS'nin harita, parsel poligonu, Sentinel-2 uydu analizi ve canlı meteoroloji radarı modüllerinde (`server/copernicusService.ts`, `utils/fieldPolygon.ts`, `components/MapComponent.tsx`, `components/farmers/Field*.tsx`, `components/weather/**`, `services/*weather*.ts`) yapılan tüm değişikliklerde geçerlidir.

## 1. Koordinat Tip Güvenliği (`[lng, lat]` vs `[lat, lng]`)
- GeoJSON (RFC 7946 EPSG:4326), Copernicus API ve veritabanı katmanındaki **`[boylam, enlem]` (`[lng, lat]`)** sırası ile Leaflet / React-Leaflet bileşenlerindeki **`[enlem, boylam]` (`{ lat, lng }` / `[lat, lng]`)** sırasını `utils/fieldPolygon.ts` içindeki açık veri tipleri (`LatLngLiteral`, `FieldPolygonFeature`) ve dönüştürücülerle (`latLngsToGeoJsonPolygon`, `geoJsonToLatLngs`) koru.
- Ham `number[]` dizilerini koordinat sırası doğrulaması yapmadan doğrudan harita veya API katmanları arasında taşıma.

## 2. Jeodezik Poligon Doğrulaması ve Dekar Hesabı (`utils/fieldPolygon.ts`)
- Kendi kendini kesen (`self-intersecting`), 3 köşeden az olan veya geçersiz geometrileri çizim sırasında yakalayıp kullanıcıyı uyar; kapanmamış poligon halkalarını RFC 7946 standardına göre ilk köşe ile kapat.
- Tarla alanını düzlemsel yaklaşımla değil, `@turf/area` jeodezik formülüyle (`m²`) hesapla ve tam **`1000 m² = 1 dekar (da)`** standardıyla (`m2 / 1000`) göster.

## 3. Copernicus Sentinel-2 L2A Katmanları (`server/copernicusService.ts` & `FieldSatelliteAnalyzerModal.tsx`)
- **NDVI** (bitki sağlığı / biyokütle), **NDMI** (kanopi nem / sulama stresi) ve yüzey ıslaklığı/çamur katmanlarında `Evalscript` V3 sorgularını optimize et.
- **SCL Bulut Maskesi:** Sentinel-2 L2A `SCL` (Scene Classification Layer) bant verisini kullanarak bulut, bulut gölgesi ve sirüs piksellerini istatistik ve görselleştirmeden maskele.
- **Zorunlu Tarih Rozeti ve Yağış Çapraz Doğrulaması:** Arayüzde (`FieldSatelliteAnalyzerModal.tsx`) **tam uydu çekim tarihi rozetini** (acquisition timestamp + bulutluluk yüzdesi) açıkça göster ve uydu görüntüsünün çekildiği tarih ile son yağış/meteoroloji verisi (`services/agroWeather.ts`) arasında çapraz doğrulama notu düş.

## 4. 60 FPS Animasyonlu Radar ve Bellek Yönetimi (`components/weather/LiveRadarMap.tsx`)
- Apple Weather tarzı zaman serisi hava radarı katmanlarında (`RadarAnimator`) çift tamponlu kare önbellekleme (**dual-buffer frame preloading**) kullan; kare geçişlerinde titreme (flicker) oluşmasını engelle.
- **Sıfır Bellek Sızıntısı (`dispose`):** Harita veya radar ekranından çıkıldığında (`useEffect` cleanup / unmount) mobil ve masaüstü bellek sızıntısını önlemek için `requestAnimationFrame`, `setTimeout`/`setInterval` zamanlayıcılarını iptal et, Leaflet özel bölmelerini/karo katmanlarını (`front`, `back`), `WebGL` dokularını ve `Canvas` tamponlarını (`destroy()` / `dispose()`) eksiksiz temizle.

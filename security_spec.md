# MKS Firestore & API Security Specification (Faz 2 Sertleştirilmiş Mimari)

## 1. Veri Değişmezleri (Data Invariants)
1. **Tam Kiracı İzolasyonu (Zero Cross-Tenant Leak)**: `/MKS/{orgId}/users/{userId}/...` altındaki tüm kullanıcı profilleri ve 22 alt koleksiyon (`farmers`, `prescriptions`, `visits`, `payments`, `myPayments`, `manualDebts`, `inventory`, `suppliers`, `teamMembers` vb.) **yalnızca** sahibi olan `{userId}` veya doğrulanmış Root Admin (`nayiffirat@gmail.com`, `email_verified == true`) tarafından okunabilir/yazılabilir. Herkese açık (`allow read: if true`) hiçbir kural bırakılmamıştır.
2. **Düz Metin Parola Yasağı (Zero Plaintext Password)**: Kullanıcı belgelerinde `password` alanı saklanamaz; istemci veya API üzerinden yeni bir `password` alanı yazılması Firestore kuralları düzeyinde engellenmiştir (`!('password' in request.resource.data)`). Ekip üyeleri (`teamMembers`) ve yönetici kilit parolaları (`adminPassword`) yalnızca rastgele salt + SHA-256 (`sha256$<salt>$<hash>`) formatında saklanır.
3. **Rol ve Abonelik Kilidi (Subscription & Privilege Lock)**:
   - Yeni kayıt olan her kullanıcı yalnızca `role: 'user'`, `subscriptionStatus: 'trial'`, `subscriptionTier: 'PRO'` ve en fazla `request.time + 8 gün` (`subscriptionEndsAtMs`) ile oluşturulabilir.
   - Normal kullanıcılar kendi profillerini güncellerken `role`, `subscriptionStatus`, `subscriptionTier`, `subscriptionEndsAt` ve `subscriptionEndsAtMs` alanlarını değiştiremez.
4. **Capability-Token Tabanlı Üretici Portalı (`portal_shares/{portalToken}`)**:
   - Çiftçilere WhatsApp üzerinden gönderilen ekstre linkleri artık mühendisin özel koleksiyonlarını açmaz.
   - Bunun yerine kriptografik olarak üretilen en az 32 karakterlik `portalToken` ile `/MKS/{orgId}/portal_shares/{portalToken}` belgesine tekil okuma (`allow get`) yapılır; `allow list` tamamen kapalıdır.
   - Bu özet belgede ilaç **alış fiyatları (`buyingPrice`)**, çiftçi **TC Kimlik No (`tcNo`)** ve tarla GPS koordinatları kesinlikle yer almaz (KVKK ve ticari sır koruması).
5. **İzole Telefon Giriş Dizini (`phone_directory/{phoneKey}`)**:
   - Telefon numarasıyla giriş için tüm `/users` koleksiyonunu sorgulamak yerine `/MKS/{orgId}/phone_directory/{10HaneliTelefon}` üzerinde yalnızca tekil `get` izni verilir (`allow list: if isRootAdmin()`).
6. **Yapay Zeka Proxy Kimlik Doğrulaması (`/api/generate`)**:
   - `server.ts` üzerindeki `/api/generate` uç noktası Firebase ID Token (`Authorization: Bearer <JWT>`) RS256 imza doğrulaması ve kullanıcı/IP bazlı hız sınırlaması (Rate Limit) ile korunur.
   - API anahtarları (`OMNIROUTE_TOKEN`, `GEMINI_API_KEY`) kaynak koddan çıkarılarak `.env` dosyasına taşınmıştır.

## 2. Güvenlik Denetim Özeti (Red Team Audit Matrisi)
| Zafiyet Sınıfı | Önceki Durum | Faz 2 Sonrası Durum | Savunma Mekanizması |
| :--- | :--- | :--- | :--- |
| Cross-Tenant Veri Sızıntısı (`/users`, `farmers`, `prescriptions`) | AÇIK (`allow read: if true`) | **KAPATILDI** | `isOwner(userId) \|\| isRootAdmin()` zorunluluğu + `portal_shares` izolasyonu |
| Bayi İlaç Alış Fiyatı (`buyingPrice`) İfşası | AÇIK | **KAPATILDI** | `publishFarmerPortalShare` sanitizasyonu + özel koleksiyon kilidi |
| Firestore & LocalStorage Düz Metin Parola | AÇIK | **KAPATILDI** | `deleteField()` temizliği + Firestore `password` yazma yasağı + salted SHA-256 |
| Kayıtta 365 Gün Ücretsiz `active` Abonelik | AÇIK (`Login.tsx`) | **KAPATILDI** | Tek merkezli 7 gün `trial` + Firestore `subscriptionEndsAtMs` üst sınır kontrolü |
| Sabit Kodlu Admin Parolası (`636311` / `admin:admin`) | AÇIK | **KAPATILDI** | Sabit şifreler kaldırıldı; Firebase Re-Auth + salted SHA-256 doğrulaması eklendi |
| Kimliksiz `/api/generate` Kota Sömürüsü | AÇIK | **KAPATILDI** | Firebase RS256 ID Token doğrulaması + CORS kısıtlaması + Rate Limiter |

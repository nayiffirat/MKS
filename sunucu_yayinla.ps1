# =====================================================================
#  MKS - Cloud Run sunucusunu güvenli biçimde yeniden yayınlama betiği
#  Kullanım: D:\MKS\SUNUCU_YAYINLA.bat dosyasına çift tıklayın.
#  Adımlar:
#    1) Google hesabıyla giriş (gerekirse tarayıcı açılır)
#    2) Proje kimliğini otomatik bulma (proje numarası 65385039239)
#    3) Mevcut servisi gösterme
#    4) Trafik ALMAYAN "deneme" sürümünü yayınlama (onayınızla)
#    5) Deneme adresini yoklama (API'ler JSON dönüyor mu?)
#    6) Onayınızla canlıya alma + geri alma komutunu gösterme
#  Bu betik hiçbir gizli değer (şifre/anahtar) istemez ve yazdırmaz.
# =====================================================================

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Servis      = 'm-hendis-kay-t-sistemi'
$Bolge       = 'europe-west3'
$ProjeNumara = '65385039239'
$Etiket      = 'deneme'
$gcloud      = 'D:\gcloud\google-cloud-sdk\bin\gcloud.cmd'

function Baslik($metin) {
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor DarkCyan
    Write-Host "  $metin" -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor DarkCyan
}
function Dur($metin) {
    Write-Host ''
    Write-Host "HATA: $metin" -ForegroundColor Red
    Write-Host 'İşlem durduruldu. Canlı sunucuda hiçbir değişiklik yapılmadı (aksi yazmadıkça).' -ForegroundColor Yellow
    exit 1
}
function Kontrol($adim) {
    if ($LASTEXITCODE -ne 0) { Dur "$adim başarısız oldu (çıkış kodu $LASTEXITCODE)." }
}
function Sor($soru) {
    $c = Read-Host "$soru (E/H)"
    return ($c -match '^\s*[eE]\s*$')
}

# ---------------------------------------------------------------------
Baslik '1/6  gcloud ve proje klasörü denetleniyor'
if (-not (Test-Path $gcloud)) {
    $bulunan = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
    if ($bulunan) { $gcloud = $bulunan.Source } else { Dur "gcloud bulunamadı ($gcloud)." }
}
Write-Host "gcloud: $gcloud"
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path (Join-Path $PSScriptRoot 'Dockerfile'))) { Dur "Dockerfile bulunamadı: $PSScriptRoot" }
if (-not (Test-Path (Join-Path $PSScriptRoot 'server.ts'))) { Dur "server.ts bulunamadı: $PSScriptRoot" }
Write-Host "Proje klasörü: $PSScriptRoot"

# ---------------------------------------------------------------------
Baslik '2/6  Google hesabı ve proje kimliği'
$hesap = (& $gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>$null | Select-Object -First 1)
if (-not $hesap) {
    Write-Host 'Etkin Google hesabı yok. Tarayıcı açılacak; sunucuyu kuran Google hesabıyla giriş yapın.' -ForegroundColor Yellow
    & $gcloud auth login
    Kontrol 'Google girişi'
    $hesap = (& $gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>$null | Select-Object -First 1)
    if (-not $hesap) { Dur 'Giriş yapıldı görünmüyor.' }
}
Write-Host "Etkin hesap: $hesap"

$ProjeId = (& $gcloud projects list --filter="projectNumber=$ProjeNumara" --format="value(projectId)" 2>$null | Select-Object -First 1)
Kontrol 'Proje listesi'
if (-not $ProjeId) {
    Dur "Bu Google hesabında $ProjeNumara numaralı proje görünmüyor; sunucuyu kuran hesapla giriş yapın (gcloud auth login)."
}
$ProjeId = $ProjeId.Trim()
Write-Host "Proje kimliği: $ProjeId"

# ---------------------------------------------------------------------
Baslik '3/6  Mevcut servis'
$jsonMetin = (& $gcloud run services describe $Servis --region $Bolge --project $ProjeId --format=json 2>$null) -join "`n"
Kontrol 'Servis bilgisi okuma'
$svc = $jsonMetin | ConvertFrom-Json
$eskiRevizyon = $svc.status.latestReadyRevisionName
$trafikteki = @($svc.status.traffic | Where-Object { $_.percent -gt 0 })
if ($trafikteki.Count -eq 1 -and $trafikteki[0].revisionName) { $eskiRevizyon = $trafikteki[0].revisionName }
Write-Host "Adres               : $($svc.status.url)"
Write-Host "Son hazır revizyon  : $($svc.status.latestReadyRevisionName)"
Write-Host "Şu an trafik alan   :"
foreach ($t in $svc.status.traffic) {
    $ad = if ($t.revisionName) { $t.revisionName } else { "(en son: $($svc.status.latestReadyRevisionName))" }
    Write-Host ("   {0,3}%  {1}  {2}" -f [int]$t.percent, $ad, $(if ($t.tag) { "etiket=$($t.tag)" } else { '' }))
}
$envAdlari = @()
foreach ($c in @($svc.spec.template.spec.containers)) { foreach ($e in @($c.env)) { if ($e.name) { $envAdlari += $e.name } } }
Write-Host "Ortam değişkeni ADLARI (değerler gösterilmez): $(if ($envAdlari.Count) { $envAdlari -join ', ' } else { '(yok)' })"

$uyduEksik = -not (($envAdlari -contains 'CDSE_CLIENT_ID') -and ($envAdlari -contains 'CDSE_CLIENT_SECRET'))
if ($uyduEksik) {
    Write-Host ''
    Write-Host 'NOT (uydu): Serviste CDSE_CLIENT_ID / CDSE_CLIENT_SECRET tanımlı değil.' -ForegroundColor Yellow
    Write-Host '  Yayından sonra uydu analizi veri getirmez. Bunları kendiniz girin:' -ForegroundColor Yellow
    Write-Host '  Cloud Console -> Cloud Run -> m-hendis-kay-t-sistemi -> "Edit & deploy new revision"' -ForegroundColor Yellow
    Write-Host '  -> "Variables & Secrets" bölümü. (Bu betik gizli değer istemez/yazmaz.)' -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
Baslik '4/6  Trafik ALMAYAN deneme sürümü'
Write-Host 'Şimdi bu klasördeki kod Google Cloud Build ile derlenip yeni bir revizyon olarak yüklenecek.'
Write-Host 'Bu revizyon trafik ALMAZ; kullanıcılar eski sürümü kullanmaya devam eder.'
Write-Host 'Mevcut ortam değişkenleri ve ayarlar korunur. Süre: genellikle 5-15 dakika.'
Write-Host 'gcloud ilk seferde "Artifact Registry deposu oluşturulsun mu" ya da "API etkinleştirilsin mi" diye sorarsa Y yazın.' -ForegroundColor DarkYellow
if (-not (Sor 'Devam edilsin mi?')) { Write-Host 'Vazgeçildi. Hiçbir şey değiştirilmedi.'; exit 0 }

& $gcloud run deploy $Servis --source . --region $Bolge --project $ProjeId --no-traffic --tag $Etiket
Kontrol 'Deneme sürümü yayını'

$jsonMetin = (& $gcloud run services describe $Servis --region $Bolge --project $ProjeId --format=json 2>$null) -join "`n"
Kontrol 'Yayın sonrası servis bilgisi'
$svc2 = $jsonMetin | ConvertFrom-Json
$yeniRevizyon = $svc2.status.latestCreatedRevisionName
$denemeUrl = (@($svc2.status.traffic | Where-Object { $_.tag -eq $Etiket }) | Select-Object -First 1).url
if (-not $denemeUrl) { Dur 'Deneme adresi bulunamadı (etiket görünmüyor). Canlı trafik değişmedi.' }
Write-Host "Yeni revizyon : $yeniRevizyon"
Write-Host "Deneme adresi : $denemeUrl"

# ---------------------------------------------------------------------
Baslik '5/6  Deneme adresi yoklanıyor'
function Yokla($yontem, $yol) {
    $url = $denemeUrl.TrimEnd('/') + $yol
    if ($yontem -eq 'POST') {
        $sonuc = & curl.exe -s -o NUL -m 60 -X POST -H 'Content-Type: application/json' -d '{}' -w '%{http_code}|%{content_type}' $url
    } else {
        $sonuc = & curl.exe -s -o NUL -m 60 -w '%{http_code}|%{content_type}' $url
    }
    $p = "$sonuc".Split('|')
    [pscustomobject]@{ Yontem = $yontem; Yol = $yol; Kod = $p[0]; Tur = $(if ($p.Count -gt 1) { $p[1] } else { '' }) }
}
$sonuclar = @(
    (Yokla 'GET'  '/api/version'),
    (Yokla 'GET'  '/api/satellite/status'),
    (Yokla 'POST' '/api/edm/test-connection'),
    (Yokla 'GET'  '/')
)
foreach ($s in $sonuclar) {
    $json = $s.Tur -match 'application/json'
    $html = $s.Tur -match 'text/html'
    if ($s.Yol -eq '/') {
        $s | Add-Member Durum $(if ($s.Kod -eq '200' -and $html) { 'BAŞARILI' } else { 'BAŞARISIZ' })
    } elseif ($s.Yol -eq '/api/edm/test-connection') {
        $s | Add-Member Durum $(if ($json -and $s.Kod -match '^(200|400|401|403)$') { 'BAŞARILI' } else { 'BAŞARISIZ' })
    } else {
        $s | Add-Member Durum $(if ($json -and $s.Kod -eq '200') { 'BAŞARILI' } else { 'BAŞARISIZ' })
    }
}
$sonuclar | Format-Table Yontem, Yol, Kod, Tur, Durum -AutoSize | Out-String -Width 160 | Write-Host

try {
    $uydu = Invoke-RestMethod -Uri ($denemeUrl.TrimEnd('/') + '/api/satellite/status') -TimeoutSec 30
    Write-Host "Uydu yapılandırması (configured): $($uydu.configured)"
    if (-not $uydu.configured) { Write-Host 'Uydu anahtarları yok: CDSE_CLIENT_ID / CDSE_CLIENT_SECRET girilmeden uydu analizi veri getirmez (yukarıdaki nota bakın).' -ForegroundColor Yellow }
} catch { }

# ---------------------------------------------------------------------
Baslik '6/6  Canlıya alma'
$gerial = "& '$gcloud' run services update-traffic $Servis --to-revisions $eskiRevizyon=100 --region $Bolge --project $ProjeId"
$hepsiTamam = -not ($sonuclar | Where-Object { $_.Durum -ne 'BAŞARILI' })
if (-not $hepsiTamam) {
    Write-Host 'Yoklamaların hepsi başarılı değil. Canlı trafiğe DOKUNULMADI;' -ForegroundColor Red
    Write-Host "eski sürüm ($eskiRevizyon) yayında kalmaya devam ediyor." -ForegroundColor Red
    Write-Host "Deneme sürümünü tarayıcıda inceleyebilirsiniz: $denemeUrl"
    exit 1
}
if (-not (Sor 'Tüm yoklamalar başarılı. Canlıya alınsın mı?')) {
    Write-Host "Canlı trafiğe dokunulmadı; eski sürüm ($eskiRevizyon) yayında." -ForegroundColor Yellow
    Write-Host "Deneme adresi açık kalır: $denemeUrl"
    exit 0
}
& $gcloud run services update-traffic $Servis --to-latest --region $Bolge --project $ProjeId
Kontrol 'Trafiği yeni sürüme çevirme'

Write-Host ''
Write-Host "Yeni sürüm ($yeniRevizyon) canlıda: $($svc2.status.url)" -ForegroundColor Green
Write-Host ''
Write-Host 'Sorun çıkarsa ESKİ SÜRÜME GERİ DÖNMEK için şu komutu PowerShell''e yapıştırın:' -ForegroundColor Yellow
Write-Host "  $gerial" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Bitti.'

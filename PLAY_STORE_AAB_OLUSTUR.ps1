# ==============================================================================
# MKS — Google Play Console Android 16 (API 36) .AAB Üretim Aracı
# ==============================================================================
param(
    [int]$VersionCode = 27,
    [string]$VersionName = "8.2.0"
)

$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "D:\Projem\AI\HASANO\toolchain\jdk17\jdk-17.0.13+11"
$env:ANDROID_HOME = "D:\Projem\AI\HASANO\toolchain\android-sdk"
$env:ANDROID_SDK_ROOT = "D:\Projem\AI\HASANO\toolchain\android-sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "`n[1/3] MKS Web & V30 Glassy Arayüz Derleniyor..." -ForegroundColor Cyan
Set-Location "D:\MKS"
npm run build

Write-Host "`n[2/3] Capacitor Android 16 (API 36) Senkronize Ediliyor..." -ForegroundColor Cyan
npx cap sync android

Write-Host "`n[3/3] Google Play Console Üretim Paketi (.aab) Derleniyor (API 36 | versionCode=$VersionCode)..." -ForegroundColor Cyan
Set-Location "D:\MKS\android"
.\gradlew.bat bundleRelease "-PversionCode=$VersionCode" "-PversionName=$VersionName"

$aabPath = "D:\MKS\android\app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aabPath) {
    Copy-Item $aabPath "D:\MKS\MKS_PlayStore_API36_v$VersionCode.aab" -Force
    Write-Host "`n==================================================================" -ForegroundColor Green
    Write-Host " BAŞARILI! Google Play Console .AAB Paketiniz Hazır:" -ForegroundColor Green
    Write-Host " -> D:\MKS\MKS_PlayStore_API36_v$VersionCode.aab" -ForegroundColor Yellow
    Write-Host "==================================================================`n" -ForegroundColor Green
}

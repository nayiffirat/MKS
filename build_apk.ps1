$env:JAVA_HOME = "D:\Projem\AI\HASANO\toolchain\jdk17\jdk-17.0.13+11"
$env:ANDROID_HOME = "D:\Projem\AI\HASANO\toolchain\android-sdk"
$env:ANDROID_SDK_ROOT = "D:\Projem\AI\HASANO\toolchain\android-sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location "D:\MKS"
npm run build
npx cap sync android

Set-Location "D:\MKS\android"
.\gradlew.bat assembleRelease "-PversionCode=34" "-PversionName=8.3.1"

$apkSource = "D:\MKS\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkSource) {
    Copy-Item $apkSource "D:\MKS\public\downloads\MKS_Android.apk" -Force
    Copy-Item $apkSource "D:\MKS\dist\downloads\MKS_Android.apk" -Force
    Copy-Item $apkSource "D:\MKS\Claude outputs\MKS_Android_v34.apk" -Force
    Copy-Item $apkSource "C:\Users\win11\Desktop\MKS_Android_v34.apk" -Force
    Write-Host "SUCCESS: APK v34 updated and copied to downloads and Desktop!" -ForegroundColor Green
} else {
    Write-Host "ERROR: APK not found at $apkSource" -ForegroundColor Red
    exit 1
}

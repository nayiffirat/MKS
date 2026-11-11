$env:JAVA_HOME = "D:\Projem\AI\HASANO\toolchain\jdk17\jdk-17.0.13+11"
$env:ANDROID_HOME = "D:\Projem\AI\HASANO\toolchain\android-sdk"
$env:ANDROID_SDK_ROOT = "D:\Projem\AI\HASANO\toolchain\android-sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location "D:\MKS"
npx cap sync android

Set-Location "D:\MKS\android"
.\gradlew.bat assembleRelease "-PversionCode=29" "-PversionName=8.2.1"

$apkSource = "D:\MKS\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkSource) {
    Copy-Item $apkSource "D:\MKS\public\downloads\MKS_Android.apk" -Force
    Copy-Item $apkSource "D:\MKS\dist\downloads\MKS_Android.apk" -Force
    Copy-Item $apkSource "C:\Users\win11\Desktop\MKS_Android_v29.apk" -Force
    Write-Host "SUCCESS: APK updated and copied to downloads and Desktop!" -ForegroundColor Green
} else {
    Write-Host "ERROR: APK not found at $apkSource" -ForegroundColor Red
}

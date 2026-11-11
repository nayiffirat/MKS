@echo off
chcp 65001 >nul
title MKS Yerel Sunucu (Port 3000)
cd /d "%~dp0.."
echo ============================================================
echo   MKS Mühendis Kayıt Sistemi - Yerel Masaüstü Sunucusu
echo   Adres: http://127.0.0.1:3000
echo ============================================================
set NODE_ENV=production
if exist "dist\server.cjs" (
    node dist\server.cjs
) else (
    npm run dev
)
pause

@echo off
REM Prometa One Frontend - Hizli baslatma
echo.
echo ===============================================
echo   PROMETA ONE - FRONTEND BASLATILIYOR...
echo ===============================================
echo.

cd /d "%~dp0frontend"

REM node_modules yoksa once npm install yap
if not exist "node_modules" (
    echo node_modules bulunamadi, paketler yukleniyor...
    echo Bu islem 2-5 dakika surebilir...
    echo.
    call npm install
    if errorlevel 1 (
        echo HATA: npm install basarisiz oldu.
        pause
        exit /b 1
    )
)

echo.
echo Vite dev server baslatiliyor...
echo Tarayicida acin: http://localhost:5173
echo.
echo Durdurmak icin: Ctrl+C
echo.

call npm run dev

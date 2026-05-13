@echo off
REM Prometa One Backend - Hizli baslatma
echo.
echo ===============================================
echo   PROMETA ONE - BACKEND BASLATILIYOR...
echo ===============================================
echo.

cd /d "%~dp0api-server"

echo Docker container'lari baslatiliyor...
docker compose up -d

if errorlevel 1 (
    echo.
    echo HATA: Docker calismiyor olabilir.
    echo Docker Desktop'i acin ve tekrar deneyin.
    echo.
    pause
    exit /b 1
)

echo.
echo Backend hazirlaniyor (15 saniye bekleyin)...
timeout /t 15 /nobreak

echo.
echo Container durumu:
docker compose ps

echo.
echo ===============================================
echo   BACKEND HAZIR!
echo ===============================================
echo   API:     http://localhost:3000/v1/health
echo   Adminer: http://localhost:8080 (--profile tools ile)
echo.
echo   Loglari gormek icin:
echo   docker compose logs -f api
echo ===============================================
echo.
pause

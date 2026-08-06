@echo off
REM M Suite - Tum sistemi durdur
echo.
echo ===============================================
echo   M SUITE - DURDURULUYOR...
echo ===============================================
echo.

cd /d "%~dp0api-server"
docker compose down

echo.
echo ===============================================
echo   SISTEM DURDURULDU
echo ===============================================
echo.
echo NOT: Veri tabani verisi korundu (postgres_data volume).
echo Tum veriyi silmek icin: docker compose down -v
echo.
pause

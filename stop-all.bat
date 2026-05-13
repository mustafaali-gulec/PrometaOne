@echo off
REM Prometa One - Tum sistemi durdur
echo.
echo ===============================================
echo   PROMETA ONE - DURDURULUYOR...
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

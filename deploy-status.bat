@echo off
REM =============================================================
REM  Prometa One - Deploy Durum Izleme
REM  Calistiran servislerin durumu + son deploy kayitlari
REM =============================================================
cd /d "%~dp0"

echo.
echo ===============================================================
echo   PROMETA ONE - SERVIS DURUMU
echo ===============================================================
docker compose ps
echo.

echo ===============================================================
echo   ERISIM ADRESLERI
echo ===============================================================
echo   Frontend    : http://localhost:5173
echo   Backend API : http://localhost:3000/v1
echo   ML Service  : http://localhost:8001
echo   Adminer     : http://localhost:8080  (sadece 'tools' profili)
echo.

echo ===============================================================
echo   SON DEPLOY KAYITLARI (deploy\deploy-history.log)
echo ===============================================================
if exist "deploy\deploy-history.log" (
  powershell -NoProfile -Command "Get-Content 'deploy\deploy-history.log' -Tail 10"
) else (
  echo   Henuz deploy kaydi yok.
)
echo.
pause

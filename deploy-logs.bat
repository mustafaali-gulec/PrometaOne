@echo off
REM =============================================================
REM  Prometa One - Canli Log Izleme
REM  Kullanim:
REM    deploy-logs.bat            -> tum servisler
REM    deploy-logs.bat backend    -> sadece backend
REM    deploy-logs.bat frontend   -> sadece frontend
REM    deploy-logs.bat ml-service -> sadece ml-service
REM  Cikis: Ctrl+C
REM =============================================================
cd /d "%~dp0"

if "%~1"=="" (
  echo [Tum servisler] canli log akisi... ^(Ctrl+C ile cik^)
  docker compose logs -f --tail=100
) else (
  echo [%~1] canli log akisi... ^(Ctrl+C ile cik^)
  docker compose logs -f --tail=100 %~1
)

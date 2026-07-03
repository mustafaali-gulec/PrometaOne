@echo off
rem =============================================================
rem PROMETA ONE - Terminal Kurulum Sihirbazi baslaticisi
rem (Istemci bilgisayarlarda calistirilir - Docker gerekmez)
rem =============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Kurulum-Terminal.ps1"
echo.
pause

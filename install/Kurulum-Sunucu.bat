@echo off
rem =============================================================
rem M SUITE - Sunucu Kurulum Sihirbazi baslaticisi
rem Sag tiklayip "Yonetici olarak calistir" secin.
rem =============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Kurulum-Sunucu.ps1"
echo.
pause

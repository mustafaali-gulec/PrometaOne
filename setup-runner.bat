@echo off
REM =============================================================
REM  Prometa One - Self-Hosted Runner Kurulum Launcher
REM  Kullanim:
REM    setup-runner.bat <REPO_URL> <TOKEN>
REM  Ornek:
REM    setup-runner.bat https://github.com/kullanici/prometa-one AXXXTOKEN
REM
REM  TOKEN nereden? GitHub repo > Settings > Actions > Runners
REM    > "New self-hosted runner" > Windows > gosterilen "token" degeri.
REM
REM  Servis olarak kurmak icin sonuna "service" ekle:
REM    setup-runner.bat <REPO_URL> <TOKEN> service
REM =============================================================
cd /d "%~dp0"

if "%~1"=="" goto :usage
if "%~2"=="" goto :usage

set "SVC="
if /I "%~3"=="service" set "SVC=-AsService"

powershell -ExecutionPolicy Bypass -File "%~dp0tools\setup-github-runner.ps1" -RepoUrl "%~1" -Token "%~2" %SVC%
goto :eof

:usage
echo.
echo   KULLANIM:
echo     setup-runner.bat ^<REPO_URL^> ^<TOKEN^> [service]
echo.
echo   Ornek:
echo     setup-runner.bat https://github.com/kullanici/prometa-one AXXXTOKEN
echo.
echo   TOKEN: GitHub repo ^> Settings ^> Actions ^> Runners ^> New self-hosted runner ^> Windows
echo.
pause

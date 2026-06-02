<#
.SYNOPSIS
  Prometa One - GitHub Actions self-hosted runner kurulumu (Windows).
  DevOps ajani tarafindan hazirlandi.

.DESCRIPTION
  Bu script GitHub Actions runner'i indirir, repo'ya kaydeder ve calistirir.
  Calistirinca push'ta otomatik deploy (.github/workflows/deploy.yml) bu PC'de calisir.

.PARAMETER RepoUrl
  GitHub repo adresin. Ornek: https://github.com/kullanici/prometa-one

.PARAMETER Token
  Repo > Settings > Actions > Runners > "New self-hosted runner" ekranindaki
  kayit token'i (RUNNER REGISTRATION TOKEN). Kisa omurludur, her kurulumda yenisi alinir.

.PARAMETER RunnerName
  (Opsiyonel) Runner adi. Varsayilan: bilgisayar adi + "-prometa".

.PARAMETER AsService
  (Opsiyonel) Verilirse runner Windows servisi olarak kurulur (reboot'ta otomatik baslar).
  NOT: Docker Desktop kullanici-bazli oldugu icin, servis modunda Docker'a erisim sorun
  cikarabilir. Local Docker deploy icin interaktif mod (varsayilan) daha guvenlidir.

.EXAMPLE
  # Interaktif (onerilen - bu pencere acik kaldigi surece calisir):
  powershell -ExecutionPolicy Bypass -File tools\setup-github-runner.ps1 `
    -RepoUrl https://github.com/kullanici/prometa-one -Token AXXX...

.EXAMPLE
  # Servis olarak:
  powershell -ExecutionPolicy Bypass -File tools\setup-github-runner.ps1 `
    -RepoUrl https://github.com/kullanici/prometa-one -Token AXXX... -AsService
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string] $RepoUrl,
  [Parameter(Mandatory = $true)] [string] $Token,
  [string] $RunnerName = "$env:COMPUTERNAME-prometa",
  [switch] $AsService
)

$ErrorActionPreference = "Stop"
$RunnerDir = "C:\actions-runner-prometa"

Write-Host "=== Prometa One - Self-Hosted Runner Kurulumu ===" -ForegroundColor Cyan

# 0. On kontroller
Write-Host "[0/5] On kontroller..." -ForegroundColor Yellow
try { docker version --format '{{.Server.Version}}' | Out-Null }
catch { Write-Warning "Docker calismiyor gibi. Deploy adimi icin Docker Desktop ACIK olmali." }

# 1. Klasor
Write-Host "[1/5] Klasor hazirlaniyor: $RunnerDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $RunnerDir | Out-Null
Set-Location $RunnerDir

# 2. En guncel runner surumunu bul
Write-Host "[2/5] En guncel runner surumu bulunuyor..." -ForegroundColor Yellow
$rel = Invoke-RestMethod -Uri "https://api.github.com/repos/actions/runner/releases/latest" `
  -Headers @{ "User-Agent" = "prometa-setup" }
$version = $rel.tag_name.TrimStart("v")
$zip = "actions-runner-win-x64-$version.zip"
$url = "https://github.com/actions/runner/releases/download/v$version/$zip"
Write-Host "      Surum: v$version"

# 3. Indir + ac (zaten varsa tekrar indirme)
if (-not (Test-Path "$RunnerDir\config.cmd")) {
  Write-Host "[3/5] Indiriliyor..." -ForegroundColor Yellow
  Invoke-WebRequest -Uri $url -OutFile "$RunnerDir\$zip"
  Write-Host "      Aciliyor..."
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory("$RunnerDir\$zip", $RunnerDir)
} else {
  Write-Host "[3/5] Runner zaten indirilmis, atlandi." -ForegroundColor Yellow
}

# 4. Kayit (unattended)
Write-Host "[4/5] Repo'ya kaydediliyor: $RepoUrl" -ForegroundColor Yellow
$configArgs = @(
  "--url", $RepoUrl,
  "--token", $Token,
  "--name", $RunnerName,
  "--labels", "self-hosted,windows,docker",
  "--work", "_work",
  "--unattended",
  "--replace"
)
if ($AsService) { $configArgs += @("--runasservice") }
& "$RunnerDir\config.cmd" @configArgs

# 5. Baslat
if ($AsService) {
  Write-Host "[5/5] Servis olarak kuruldu ve baslatildi. Reboot'ta otomatik calisir." -ForegroundColor Green
  Write-Host "      Durum: GitHub > Settings > Actions > Runners (Idle gorunmeli)"
} else {
  Write-Host "[5/5] Runner baslatiliyor (bu pencere ACIK kalmali)..." -ForegroundColor Green
  Write-Host "      Durdurmak icin Ctrl+C. Servis icin script'i -AsService ile calistir."
  & "$RunnerDir\run.cmd"
}

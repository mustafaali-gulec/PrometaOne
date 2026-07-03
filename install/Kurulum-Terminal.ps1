# =============================================================================
# PROMETA ONE — TERMINAL KURULUM SIHIRBAZI (istemci bilgisayarlar)
# =============================================================================
# Bu sihirbaz TERMINAL (istemci) bilgisayarlarda calistirilir. Docker GEREKMEZ;
# uygulama sunucuda calisir, terminal yalnizca tarayicidan baglanir.
#
# Adimlar:
#   1. Sunucu adresi + port sor, /v1/health ile baglanti testi
#   2. Terminal adi (bilgi amacli - kimlik tarayicida otomatik uretilir)
#   3. Masaustu + Baslat Menusu kisayolu (Edge/Chrome uygulama modu)
#   4. Opsiyonel: Windows acilisinda otomatik baslatma
#   5. Ozet
#
# NOT: Terminal kimligi, uygulama tarayicida ILK ACILDIGINDA otomatik uretilir
# ve sunucuya kaydedilir; bu sihirbazin ekstra kayit yapmasi gerekmez.
# =============================================================================
#requires -Version 5.1

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

function Write-Ok([string]$Text)   { Write-Host ("  [OK] {0}" -f $Text) -ForegroundColor Green }
function Write-Uyari([string]$Text){ Write-Host ("  [UYARI] {0}" -f $Text) -ForegroundColor Yellow }
function Write-Hata([string]$Text) { Write-Host ("  [HATA] {0}" -f $Text) -ForegroundColor Red }
function Write-Bilgi([string]$Text){ Write-Host ("  {0}" -f $Text) -ForegroundColor Gray }

function Read-EvetHayir([string]$Soru, [string]$Default) {
    $ek = '(e/H)'
    if ($Default -eq 'E') { $ek = '(E/h)' }
    $cevap = Read-Host ("  {0} {1}" -f $Soru, $ek)
    if ([string]::IsNullOrWhiteSpace($cevap)) { $cevap = $Default }
    return ($cevap.Trim().Substring(0,1).ToUpperInvariant() -eq 'E')
}

Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host '   PROMETA ONE - TERMINAL KURULUM SIHIRBAZI' -ForegroundColor Cyan
Write-Host '   (Istemci bilgisayar - Docker gerekmez)' -ForegroundColor Cyan
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host ''

# --- 1) Sunucu adresi + baglanti testi ---------------------------------------
$temelUrl = $null
while ($true) {
    $sunucu = Read-Host '  Sunucu adresi veya IP (ornek: 192.168.1.10)'
    if ([string]::IsNullOrWhiteSpace($sunucu)) {
        Write-Hata 'Sunucu adresi bos olamaz.'
        continue
    }
    $sunucu = $sunucu.Trim().TrimEnd('/')
    # Kullanici http:// ile yazdiysa temizle
    $sunucu = $sunucu -replace '^https?://', ''
    $portGirdi = Read-Host '  Port [80]'
    if ([string]::IsNullOrWhiteSpace($portGirdi)) { $portGirdi = '80' }
    $port = 0
    if (-not [int]::TryParse($portGirdi.Trim(), [ref]$port)) { $port = 80 }

    if ($port -eq 80) { $temelUrl = ("http://{0}" -f $sunucu) }
    else { $temelUrl = ("http://{0}:{1}" -f $sunucu, $port) }

    Write-Bilgi ("Baglanti test ediliyor: {0}/v1/health ..." -f $temelUrl)
    $basarili = $false
    try {
        $yanit = Invoke-WebRequest -UseBasicParsing -Uri ("{0}/v1/health" -f $temelUrl) -TimeoutSec 8
        if ($yanit.StatusCode -eq 200) { $basarili = $true }
    } catch {
        $basarili = $false
    }

    if ($basarili) {
        Write-Ok 'Sunucuya baglanti basarili.'
        break
    }

    Write-Hata 'Sunucuya ulasilamadi.'
    Write-Bilgi 'Kontrol edin: (1) Sunucu acik mi ve kurulum tamamlandi mi?'
    Write-Bilgi '(2) Adres/port dogru mu? (3) Ag baglantisi ve guvenlik duvari?'
    $devamEt = Read-EvetHayir 'Yine de bu adresle devam edilsin mi?' 'H'
    if ($devamEt) {
        Write-Uyari 'Baglanti dogrulanmadan devam ediliyor.'
        break
    }
}

# --- 2) Terminal adi -----------------------------------------------------------
$terminalAdi = Read-Host ("  Terminal adi [{0}]" -f $env:COMPUTERNAME)
if ([string]::IsNullOrWhiteSpace($terminalAdi)) { $terminalAdi = $env:COMPUTERNAME }
Write-Ok ("Terminal adi: {0}" -f $terminalAdi)
Write-Bilgi 'Not: Terminal kimligi tarayicida ilk acilista otomatik olusturulur;'
Write-Bilgi 'ekstra bir kayit islemi gerekmez.'

# --- 3) Kisayollar --------------------------------------------------------------
Write-Bilgi 'Kisayollar olusturuluyor...'

# Tarayici bul: once Edge, sonra Chrome; ikisi de yoksa .url (varsayilan tarayici)
$tarayici = $null
$kokler = @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA)
$gorelier = @(
    'Microsoft\Edge\Application\msedge.exe',
    'Google\Chrome\Application\chrome.exe'
)
$adaylar = New-Object System.Collections.Generic.List[string]
foreach ($goreli in $gorelier) {
    foreach ($kok in $kokler) {
        if (-not [string]::IsNullOrWhiteSpace($kok)) {
            $adaylar.Add((Join-Path $kok $goreli))
        }
    }
}
foreach ($aday in $adaylar) {
    if (Test-Path $aday) { $tarayici = $aday; break }
}

$masaustu = [Environment]::GetFolderPath('Desktop')
$baslatMenusu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$hedefler = @($masaustu, $baslatMenusu)

$shell = New-Object -ComObject WScript.Shell
$olusanlar = New-Object System.Collections.Generic.List[string]

foreach ($klasor in $hedefler) {
    if (-not (Test-Path $klasor)) { continue }
    if ($tarayici) {
        # Uygulama modu (adres cubugu olmadan, tam ekran benzeri pencere)
        $lnkYolu = Join-Path $klasor 'Prometa One.lnk'
        $lnk = $shell.CreateShortcut($lnkYolu)
        $lnk.TargetPath = $tarayici
        $lnk.Arguments = ("--app={0}/" -f $temelUrl)
        $lnk.IconLocation = ("{0},0" -f $tarayici)
        $lnk.Description = ("Prometa One - {0}" -f $terminalAdi)
        $lnk.WorkingDirectory = (Split-Path -Parent $tarayici)
        $lnk.Save()
        $olusanlar.Add($lnkYolu)
    } else {
        # Varsayilan tarayici ile URL kisayolu
        $urlYolu = Join-Path $klasor 'Prometa One.url'
        $icerik = @('[InternetShortcut]', ("URL={0}/" -f $temelUrl))
        $icerik | Out-File -FilePath $urlYolu -Encoding ascii -Force
        $olusanlar.Add($urlYolu)
    }
}

if ($tarayici) {
    Write-Ok ("Kisayollar olusturuldu (uygulama modu: {0})." -f (Split-Path -Leaf $tarayici))
} else {
    Write-Uyari 'Edge/Chrome bulunamadi - varsayilan tarayici icin .url kisayolu olusturuldu.'
}
foreach ($k in $olusanlar) { Write-Bilgi ("  {0}" -f $k) }

# --- 4) Otomatik baslatma (opsiyonel) --------------------------------------------
$otoBaslat = Read-EvetHayir 'Windows oturumu acildiginda Prometa One otomatik baslasin mi?' 'H'
if ($otoBaslat) {
    $startup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
    if (-not (Test-Path $startup)) { New-Item -ItemType Directory -Path $startup -Force | Out-Null }
    $kaynak = $olusanlar[0]
    Copy-Item -Path $kaynak -Destination $startup -Force
    Write-Ok ("Otomatik baslatma etkin: {0}" -f (Join-Path $startup (Split-Path -Leaf $kaynak)))
}

# --- 5) Ozet ---------------------------------------------------------------------
Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Green
Write-Host '   TERMINAL KURULUMU TAMAMLANDI' -ForegroundColor Green
Write-Host '  =====================================================' -ForegroundColor Green
Write-Host ("   Sunucu        : {0}" -f $temelUrl) -ForegroundColor White
Write-Host ("   Terminal adi  : {0}" -f $terminalAdi) -ForegroundColor White
Write-Host '   Baslatma      : Masaustundeki "Prometa One" kisayolu' -ForegroundColor White
Write-Host ''
Write-Host '   Ilk aciliste kullanici adi/sifrenizle giris yapin.' -ForegroundColor Gray
Write-Host '   Terminal kimligi ilk aciliste otomatik olusturulur.' -ForegroundColor Gray
Write-Host '  =====================================================' -ForegroundColor Green
Write-Host ''

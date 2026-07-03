# =============================================================================
# PROMETA ONE — SUNUCU KURULUM SIHIRBAZI (Windows)
# =============================================================================
# Bu sihirbaz Prometa One'i tek bir SUNUCU bilgisayara kurar. Terminal
# bilgisayarlar sunucuya tarayicidan baglanir (install/Kurulum-Terminal.ps1).
#
# Adimlar:
#   1. Yonetici (admin) kontrolu
#   2. On kosul: Docker + Docker Compose + calisan daemon
#   3. Donanim Kimligi (lisans parmak izi) hesaplama
#   4. Lisans dosyasi (./license/license.lic)
#   5. Yapilandirma (.env.prod: port, SMTP, guclu rastgele sifreler)
#   6. Kurulum: image yukle (paket modu) veya build (kaynak modu) + up -d
#   7. Veritabani migration (+ opsiyonel seed)
#   8. Lisans aktivasyonu
#   9. Guvenlik duvari kurali
#  10. Saglik kontrolu + ozet ekrani
#
# Idempotent: tekrar calistirildiginda guncelleme moduna girer (mevcut
# .env.prod korunabilir; image'lar yeniden yuklenir/build edilir; up -d +
# migrate calisir, veri kaybi olmaz).
#
# Donanim Kimligi sozlesmesi (lisans ureticisiyle AYNI olmali):
#   Kaynak: Win32_ComputerSystemProduct.UUID (yoksa kayit defteri MachineGuid)
#   Normalizasyon: kirp (trim) + BUYUK harf -> UTF-8 -> SHA256 ->
#   ilk 16 hex BUYUK harf -> XXXX-XXXX-XXXX-XXXX
# =============================================================================
#requires -Version 5.1

$ErrorActionPreference = 'Stop'

# --- Sabitler ----------------------------------------------------------------
$script:ComposeFile = 'docker-compose.prod.yml'
$script:EnvFile     = '.env.prod'
$script:FirewallRuleName = 'Prometa One Web'
$script:DockerDesktopUrl = 'https://www.docker.com/products/docker-desktop/'

# Proje koku = bu script'in bulundugu klasorun ustu (install/ -> paket koku)
$script:Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $script:Root $script:ComposeFile))) {
    # Script paket kokunden de calistirilmis olabilir
    if (Test-Path (Join-Path (Get-Location) $script:ComposeFile)) {
        $script:Root = (Get-Location).Path
    }
}
Set-Location $script:Root

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

# --- Yardimci fonksiyonlar ----------------------------------------------------
function Write-Banner {
    Write-Host ''
    Write-Host '  =====================================================' -ForegroundColor Cyan
    Write-Host '   PROMETA ONE - SUNUCU KURULUM SIHIRBAZI' -ForegroundColor Cyan
    Write-Host '   Finans / IK / AI Platformu - Uretim Kurulumu' -ForegroundColor Cyan
    Write-Host '  =====================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Step([int]$No, [string]$Text) {
    Write-Host ''
    Write-Host ("=== ADIM {0}/10 - {1} ===" -f $No, $Text) -ForegroundColor Cyan
}

function Write-Ok([string]$Text)   { Write-Host ("  [OK] {0}" -f $Text) -ForegroundColor Green }
function Write-Uyari([string]$Text){ Write-Host ("  [UYARI] {0}" -f $Text) -ForegroundColor Yellow }
function Write-Hata([string]$Text) { Write-Host ("  [HATA] {0}" -f $Text) -ForegroundColor Red }
function Write-Bilgi([string]$Text){ Write-Host ("  {0}" -f $Text) -ForegroundColor Gray }

# Evet/Hayir sorusu; $Default 'E' veya 'H'
function Read-EvetHayir([string]$Soru, [string]$Default) {
    $ek = '(e/H)'
    if ($Default -eq 'E') { $ek = '(E/h)' }
    $cevap = Read-Host ("  {0} {1}" -f $Soru, $ek)
    if ([string]::IsNullOrWhiteSpace($cevap)) { $cevap = $Default }
    return ($cevap.Trim().Substring(0,1).ToUpperInvariant() -eq 'E')
}

# docker compose calistirici (compose dosyasi + env dosyasi sabit)
function Invoke-Compose([string[]]$Cargs) {
    & docker compose -f $script:ComposeFile --env-file $script:EnvFile @Cargs
    return $LASTEXITCODE
}

# Guclu rastgele sifre: 48 bayt CSPRNG -> base64 -> alfanumerik (URL/env guvenli)
function New-GucluSifre {
    param([int]$ByteLen = 48)
    $bytes = New-Object byte[] $ByteLen
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $b64 = [Convert]::ToBase64String($bytes)
    $temiz = $b64 -replace '[+/=]', ''
    if ($temiz.Length -lt 48) {
        # Nadir durum: cok fazla ozel karakter cikarsa tamamla
        $temiz = $temiz + (New-GucluSifre -ByteLen 24)
    }
    return $temiz.Substring(0, 48)
}

# Donanim Kimligi (lisans parmak izi) — sozlesme icin dosya basindaki nota bakin
function Get-DonanimKimligi {
    $uuid = $null
    try {
        $uuid = (Get-CimInstance -ClassName Win32_ComputerSystemProduct -ErrorAction Stop).UUID
    } catch {
        $uuid = $null
    }
    # Bilinen gecersiz/placeholder UUID'ler -> MachineGuid'e dus
    $gecersiz = @(
        '00000000-0000-0000-0000-000000000000',
        'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
        '03000200-0400-0500-0006-000700080009'
    )
    if ([string]::IsNullOrWhiteSpace($uuid) -or ($gecersiz -contains $uuid.Trim().ToUpperInvariant())) {
        Write-Uyari 'Donanim UUID okunamadi/gecersiz - kayit defteri MachineGuid kullanilacak.'
        $uuid = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid
    }
    $norm = $uuid.Trim().ToUpperInvariant()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($norm))
    } finally { $sha.Dispose() }
    $hex = -join ($hashBytes | ForEach-Object { $_.ToString('X2') })
    $p = $hex.Substring(0, 16)
    return ('{0}-{1}-{2}-{3}' -f $p.Substring(0,4), $p.Substring(4,4), $p.Substring(8,4), $p.Substring(12,4))
}

# Mevcut .env.prod'u hashtable olarak oku
function Read-EnvDosyasi([string]$Yol) {
    $sonuc = @{}
    if (Test-Path $Yol) {
        foreach ($satir in (Get-Content -Path $Yol)) {
            if ($satir -match '^\s*#') { continue }
            if ($satir -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
                $sonuc[$matches[1]] = $matches[2]
            }
        }
    }
    return $sonuc
}

# =============================================================================
# BASLANGIC
# =============================================================================
Write-Banner
Write-Bilgi ("Calisma klasoru: {0}" -f $script:Root)

# --- ADIM 1: Yonetici kontrolu -------------------------------------------------
Write-Step 1 'Yonetici (Admin) Kontrolu'
$kimlik = [Security.Principal.WindowsIdentity]::GetCurrent()
$prensipal = New-Object Security.Principal.WindowsPrincipal($kimlik)
if (-not $prensipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Hata 'Bu sihirbaz YONETICI olarak calistirilmalidir.'
    Write-Bilgi 'Cozum: Kurulum-Sunucu.bat dosyasina sag tiklayin -> "Yonetici olarak calistir".'
    Write-Bilgi '(Guvenlik duvari kurali ve Docker islemleri icin yonetici yetkisi gereklidir.)'
    exit 1
}
Write-Ok 'Yonetici yetkisi dogrulandi.'

# --- ADIM 2: On kosullar --------------------------------------------------------
Write-Step 2 'On Kosul Kontrolu (Docker)'
$dockerKomut = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerKomut) {
    Write-Hata 'Docker bulunamadi.'
    Write-Bilgi 'Cozum: Docker Desktop kurun ve bilgisayari yeniden baslatin:'
    Write-Bilgi ("  {0}" -f $script:DockerDesktopUrl)
    Write-Bilgi 'Kurulumdan sonra bu sihirbazi tekrar calistirin.'
    exit 1
}
Write-Ok ("Docker bulundu: {0}" -f $dockerKomut.Source)

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Hata 'Docker daemon calismiyor.'
    Write-Bilgi 'Cozum: Docker Desktop uygulamasini baslatin, "Engine running" olana kadar'
    Write-Bilgi 'bekleyin ve bu sihirbazi tekrar calistirin.'
    exit 1
}
Write-Ok 'Docker daemon calisiyor.'

& docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Hata 'Docker Compose (v2) bulunamadi.'
    Write-Bilgi ("Cozum: Guncel Docker Desktop compose icerir: {0}" -f $script:DockerDesktopUrl)
    exit 1
}
Write-Ok 'Docker Compose hazir.'

if (-not (Test-Path (Join-Path $script:Root $script:ComposeFile))) {
    Write-Hata ("{0} bulunamadi. Sihirbaz, paket kokundeki install\ klasorunden calistirilmalidir." -f $script:ComposeFile)
    exit 1
}

# --- ADIM 3: Donanim Kimligi ----------------------------------------------------
Write-Step 3 'Donanim Kimligi (Lisans Parmak Izi)'
$parmakIzi = Get-DonanimKimligi
Write-Host ''
Write-Host '  +--------------------------------------------------+' -ForegroundColor White
Write-Host ("  |   DONANIM KIMLIGI :  {0}         |" -f $parmakIzi) -ForegroundColor White
Write-Host '  +--------------------------------------------------+' -ForegroundColor White
Write-Host ''
Write-Bilgi 'Bu kimligi Promet Bilisim''e iletin; lisans dosyaniz (license.lic)'
Write-Bilgi 'bu makineye ozel uretilecektir. Kimlik donanima baglidir, degismez.'

# --- ADIM 4: Lisans dosyasi ------------------------------------------------------
Write-Step 4 'Lisans Dosyasi'
$lisansKlasoru = Join-Path $script:Root 'license'
if (-not (Test-Path $lisansKlasoru)) {
    New-Item -ItemType Directory -Path $lisansKlasoru | Out-Null
}
$lisansDosyasi = Join-Path $lisansKlasoru 'license.lic'
$lisansVar = Test-Path $lisansDosyasi
if ($lisansVar) {
    Write-Ok ("Lisans dosyasi mevcut: {0}" -f $lisansDosyasi)
} else {
    Write-Bilgi 'license\license.lic bulunamadi.'
    while (-not $lisansVar) {
        $yol = Read-Host '  Lisans dosyasinin tam yolunu girin (lisanssiz devam icin bos birakin)'
        if ([string]::IsNullOrWhiteSpace($yol)) {
            Write-Uyari 'LISANSSIZ devam ediliyor. Kurulum tamamlanir ancak uygulama,'
            Write-Uyari 'lisans dosyasi yuklenip aktive edilene kadar KILITLI kalir.'
            Write-Bilgi 'Sonradan aktivasyon: license\license.lic dosyasini koyup su komutu calistirin:'
            Write-Bilgi '  docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run license:activate -- /license/license.lic'
            break
        }
        $yol = $yol.Trim('"').Trim()
        if (Test-Path $yol) {
            Copy-Item -Path $yol -Destination $lisansDosyasi -Force
            $lisansVar = $true
            Write-Ok ("Lisans kopyalandi: {0}" -f $lisansDosyasi)
        } else {
            Write-Hata ("Dosya bulunamadi: {0} - tekrar deneyin." -f $yol)
        }
    }
}

# --- ADIM 5: Yapilandirma (.env.prod) --------------------------------------------
Write-Step 5 'Yapilandirma (.env.prod)'
$envYolu = Join-Path $script:Root $script:EnvFile
$mevcutEnv = Read-EnvDosyasi $envYolu
$envYaz = $true
$httpPort = 80

if ($mevcutEnv.Count -gt 0) {
    Write-Uyari ("Mevcut bir {0} dosyasi bulundu (guncelleme modu)." -f $script:EnvFile)
    $yenidenYaz = Read-EvetHayir 'Yapilandirmayi yeniden olusturmak ister misiniz?' 'H'
    if (-not $yenidenYaz) {
        $envYaz = $false
        if ($mevcutEnv.ContainsKey('HTTP_PORT')) { $httpPort = [int]$mevcutEnv['HTTP_PORT'] }
        Write-Ok ("Mevcut yapilandirma korunuyor (HTTP portu: {0})." -f $httpPort)
    }
}

if ($envYaz) {
    # HTTP portu
    $portGirdi = Read-Host '  Web arayuzu HTTP portu [80]'
    if ([string]::IsNullOrWhiteSpace($portGirdi)) { $portGirdi = '80' }
    $httpPort = 0
    if (-not [int]::TryParse($portGirdi, [ref]$httpPort)) { $httpPort = 80 }
    if ($httpPort -lt 1 -or $httpPort -gt 65535) { $httpPort = 80 }
    Write-Ok ("HTTP portu: {0}" -f $httpPort)

    # SMTP (opsiyonel)
    Write-Bilgi 'E-posta (SMTP) ayarlari opsiyoneldir; bos birakirsaniz e-posta gonderimi kapali kalir.'
    $smtpHost = Read-Host '  SMTP sunucusu (bos = kapali)'
    $smtpPort = '587'; $smtpUser = ''; $smtpPass = ''; $smtpFrom = 'Prometa One <noreply@prometahr.com>'; $smtpSecure = 'false'
    $emailProvider = 'console'
    if (-not [string]::IsNullOrWhiteSpace($smtpHost)) {
        $emailProvider = 'smtp'
        $g = Read-Host '  SMTP portu [587]'
        if (-not [string]::IsNullOrWhiteSpace($g)) { $smtpPort = $g.Trim() }
        $smtpUser = Read-Host '  SMTP kullanici adi'
        $smtpPass = Read-Host '  SMTP sifresi'
        $g = Read-Host ("  Gonderen adresi [{0}]" -f $smtpFrom)
        if (-not [string]::IsNullOrWhiteSpace($g)) { $smtpFrom = $g.Trim() }
        if ($smtpPort -eq '465') { $smtpSecure = 'true' }
    }

    # Gizli anahtarlar: mevcutsa koru (DB sifresi degisirse eski volume'a baglanti kopar!)
    $pgSifre = $null; $jwtSecret = $null; $jwtRefresh = $null
    $eskiVar = ($mevcutEnv.ContainsKey('POSTGRES_PASSWORD') -and -not [string]::IsNullOrWhiteSpace($mevcutEnv['POSTGRES_PASSWORD']))
    if ($eskiVar) {
        $koru = Read-EvetHayir 'Mevcut gizli anahtarlar (DB sifresi / JWT) KORUNSUN mu? (Onerilen: Evet)' 'E'
        if ($koru) {
            $pgSifre    = $mevcutEnv['POSTGRES_PASSWORD']
            $jwtSecret  = $mevcutEnv['JWT_SECRET']
            $jwtRefresh = $mevcutEnv['JWT_REFRESH_SECRET']
            Write-Ok 'Mevcut gizli anahtarlar korundu.'
        } else {
            Write-Uyari 'DIKKAT: Veritabani sifresini degistirmek, MEVCUT veritabani volume''u'
            Write-Uyari 'ile baglanti hatasina yol acar (Postgres ilk kurulum sifresini kullanir).'
        }
    }
    if ([string]::IsNullOrWhiteSpace($pgSifre))    { $pgSifre    = New-GucluSifre }
    if ([string]::IsNullOrWhiteSpace($jwtSecret))  { $jwtSecret  = New-GucluSifre }
    if ([string]::IsNullOrWhiteSpace($jwtRefresh)) { $jwtRefresh = New-GucluSifre }

    # CORS/APP_URL: localhost + sunucu IP'leri (terminaller IP ile baglanir)
    $portEki = ''
    if ($httpPort -ne 80) { $portEki = (":{0}" -f $httpPort) }
    $originler = New-Object System.Collections.Generic.List[string]
    $originler.Add(("http://localhost{0}" -f $portEki))
    try {
        $ipler = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
        foreach ($ip in $ipler) { $originler.Add(("http://{0}{1}" -f $ip.IPAddress, $portEki)) }
    } catch {}
    $corsOrigins = ($originler | Select-Object -Unique) -join ','
    $appUrl = $originler[0]

    $envIcerik = @(
        '# =============================================================',
        '# PROMETA ONE - uretim ortam degiskenleri',
        ("# Kurulum sihirbazi tarafindan uretildi: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        '# BU DOSYAYI YEDEKLEYIN ve kimseyle paylasmayin (sifreler icerir).',
        '# =============================================================',
        ("HTTP_PORT={0}" -f $httpPort),
        ("POSTGRES_PASSWORD={0}" -f $pgSifre),
        ("JWT_SECRET={0}" -f $jwtSecret),
        ("JWT_REFRESH_SECRET={0}" -f $jwtRefresh),
        ("PROMETA_FINGERPRINT={0}" -f $parmakIzi),
        ("CORS_ORIGINS={0}" -f $corsOrigins),
        ("APP_URL={0}" -f $appUrl),
        ("EMAIL_PROVIDER={0}" -f $emailProvider),
        ("SMTP_HOST={0}" -f $smtpHost),
        ("SMTP_PORT={0}" -f $smtpPort),
        ("SMTP_USER={0}" -f $smtpUser),
        ("SMTP_PASS={0}" -f $smtpPass),
        ("SMTP_FROM={0}" -f $smtpFrom),
        ("SMTP_SECURE={0}" -f $smtpSecure),
        '# Santiye (construction) profili acilirsa: KAFKA_BROKERS=kafka:9092',
        'KAFKA_BROKERS='
    )
    # ASCII + BOM'suz yaz — docker compose env dosyasi BOM kabul etmez
    $envIcerik | Out-File -FilePath $envYolu -Encoding ascii -Force
    Write-Ok ("{0} yazildi." -f $script:EnvFile)
} else {
    # Korunan dosyada parmak izi eksikse tamamla (eski kurulumdan gelme olabilir)
    if (-not $mevcutEnv.ContainsKey('PROMETA_FINGERPRINT') -or [string]::IsNullOrWhiteSpace($mevcutEnv['PROMETA_FINGERPRINT'])) {
        Add-Content -Path $envYolu -Value ("PROMETA_FINGERPRINT={0}" -f $parmakIzi) -Encoding ascii
        Write-Ok 'PROMETA_FINGERPRINT mevcut dosyaya eklendi.'
    }
}

# --- ADIM 6: Kurulum (image yukle / build) + baslat ------------------------------
Write-Step 6 'Uygulama Kurulumu'
$imageTar = Join-Path $script:Root 'images\prometa-one-images.tar'
if (Test-Path $imageTar) {
    Write-Bilgi 'Musteri paketi modu: hazir image arsivi yukleniyor (docker load)...'
    Write-Bilgi 'Bu islem birkac dakika surebilir.'
    & docker load -i $imageTar
    if ($LASTEXITCODE -ne 0) {
        Write-Hata 'Image arsivi yuklenemedi. Arsiv dosyasi bozuk olabilir.'
        Write-Bilgi 'Cozum: Kurulum paketini yeniden indirin/kopyalayin ve tekrar deneyin.'
        exit 1
    }
    Write-Ok 'Image''lar yuklendi.'
} else {
    Write-Bilgi 'Kaynak modu: image''lar yerelde derleniyor (docker compose build)...'
    Write-Bilgi 'Ilk derleme 10-20 dakika surebilir.'
    $rc = Invoke-Compose @('build')
    if ($rc -ne 0) {
        Write-Hata 'Derleme basarisiz. Yukaridaki hata ciktisini kontrol edin.'
        Write-Bilgi 'Cozum: Internet baglantisini ve disk alanini (en az 10 GB) kontrol edin.'
        exit 1
    }
    Write-Ok 'Derleme tamamlandi.'
}

Write-Bilgi 'Servisler baslatiliyor (docker compose up -d)...'
$rc = Invoke-Compose @('up', '-d')
if ($rc -ne 0) {
    Write-Hata 'Servisler baslatilamadi.'
    Write-Bilgi ("Cozum: '{0}' portu baska bir uygulama tarafindan kullaniliyor olabilir." -f $httpPort)
    Write-Bilgi 'Sihirbazi tekrar calistirip farkli bir port secin veya cakisan uygulamayi kapatin.'
    Write-Bilgi 'Detayli log: docker compose -f docker-compose.prod.yml --env-file .env.prod logs'
    exit 1
}
Write-Ok 'Servisler baslatildi (postgres, api, web, ml-service).'

# --- ADIM 7: Veritabani migration + seed -----------------------------------------
Write-Step 7 'Veritabani Hazirligi (Migration)'
$migrateBasarili = $false
for ($deneme = 1; $deneme -le 3; $deneme++) {
    $rc = Invoke-Compose @('exec', '-T', 'api', 'npm', 'run', 'migrate')
    if ($rc -eq 0) { $migrateBasarili = $true; break }
    Write-Uyari ("Migration denemesi {0}/3 basarisiz - API''nin acilmasi bekleniyor..." -f $deneme)
    Start-Sleep -Seconds 10
}
if ($migrateBasarili) {
    Write-Ok 'Veritabani semasi guncel (migration tamam).'
} else {
    Write-Hata 'Migration calistirilamadi.'
    Write-Bilgi 'Cozum: Birkac dakika sonra sunu elle calistirin:'
    Write-Bilgi '  docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run migrate'
}

$seedIste = Read-EvetHayir 'Ilk kurulum mu? Baslangic verileri (seed) yuklensin mi?' 'H'
if ($seedIste) {
    $rc = Invoke-Compose @('exec', '-T', 'api', 'npm', 'run', 'seed')
    if ($rc -eq 0) { Write-Ok 'Baslangic verileri yuklendi.' }
    else { Write-Uyari 'Seed calistirilamadi (mevcut kurulumda tekrar gerekmez).' }
}

# --- ADIM 8: Lisans aktivasyonu ---------------------------------------------------
Write-Step 8 'Lisans Aktivasyonu'
if (Test-Path $lisansDosyasi) {
    $rc = Invoke-Compose @('exec', '-T', 'api', 'npm', 'run', 'license:activate', '--', '/license/license.lic')
    if ($rc -eq 0) {
        Write-Ok 'Lisans aktive edildi.'
        Write-Bilgi ("Durum sorgusu: http://localhost:{0}/v1/license/status" -f $httpPort)
    } else {
        Write-Uyari 'Lisans aktivasyonu basarisiz oldu.'
        Write-Bilgi 'Olasi nedenler: lisans baska bir makine icin uretilmis (Donanim Kimligi'
        Write-Bilgi 'uyusmuyor), suresi dolmus veya dosya bozuk. Promet Bilisim ile iletisime gecin.'
        Write-Bilgi ("Bu makinenin Donanim Kimligi: {0}" -f $parmakIzi)
    }
} else {
    Write-Uyari 'Lisans dosyasi yok - aktivasyon atlandi. Uygulama lisans yuklenene kadar kilitlidir.'
}

# --- ADIM 9: Guvenlik duvari ------------------------------------------------------
Write-Step 9 'Guvenlik Duvari Kurali'
# Idempotent: varsa sil, yeniden ekle (port degismis olabilir)
& netsh advfirewall firewall delete rule name="$script:FirewallRuleName" *> $null
& netsh advfirewall firewall add rule name="$script:FirewallRuleName" dir=in action=allow protocol=TCP localport=$httpPort | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Ok ("Gelen TCP {0} portu icin '{1}' kurali eklendi." -f $httpPort, $script:FirewallRuleName)
} else {
    Write-Uyari 'Guvenlik duvari kurali eklenemedi. Terminaller baglanamazsa portu elle acin:'
    Write-Bilgi ("  netsh advfirewall firewall add rule name=""{0}"" dir=in action=allow protocol=TCP localport={1}" -f $script:FirewallRuleName, $httpPort)
}

# --- ADIM 10: Saglik kontrolu + ozet ----------------------------------------------
Write-Step 10 'Saglik Kontrolu'
$saglikUrl = ("http://localhost:{0}/v1/health" -f $httpPort)
Write-Bilgi ("{0} adresi kontrol ediliyor (en fazla 60 sn)..." -f $saglikUrl)
$saglikli = $false
$bitis = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $bitis) {
    try {
        $yanit = Invoke-WebRequest -UseBasicParsing -Uri $saglikUrl -TimeoutSec 5
        if ($yanit.StatusCode -eq 200) { $saglikli = $true; break }
    } catch {}
    Start-Sleep -Seconds 3
}

if ($saglikli) {
    Write-Ok 'Sistem SAGLIKLI - kurulum tamamlandi!'
} else {
    Write-Uyari 'Saglik kontrolu 60 saniyede yanit vermedi. Servisler hala aciliyor olabilir.'
    Write-Bilgi 'Birkac dakika sonra tarayicidan kontrol edin. Log icin:'
    Write-Bilgi '  docker compose -f docker-compose.prod.yml --env-file .env.prod logs api'
}

# Ozet ekrani
$portEki2 = ''
if ($httpPort -ne 80) { $portEki2 = (":{0}" -f $httpPort) }
Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Green
Write-Host '   KURULUM OZETI' -ForegroundColor Green
Write-Host '  =====================================================' -ForegroundColor Green
Write-Host ("   Donanim Kimligi : {0}" -f $parmakIzi) -ForegroundColor White
Write-Host ("   Web arayuzu     : http://localhost{0}" -f $portEki2) -ForegroundColor White
Write-Host ''
Write-Host '   Bu sunucunun ag adresleri (terminaller icin):' -ForegroundColor White
try {
    $ipListe = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }
    foreach ($ip in $ipListe) {
        Write-Host ("     http://{0}{1}" -f $ip.IPAddress, $portEki2) -ForegroundColor Cyan
    }
} catch {
    Write-Host '     (IP adresleri okunamadi - ipconfig ile kontrol edin)' -ForegroundColor Yellow
}
Write-Host ''
Write-Host '   TERMINAL KURULUMU:' -ForegroundColor White
Write-Host '   Her terminal bilgisayarda install\Kurulum-Terminal.bat dosyasini' -ForegroundColor Gray
Write-Host '   calistirin ve yukaridaki adreslerden birini girin.' -ForegroundColor Gray
Write-Host '   (Terminallerde Docker GEREKMEZ; sadece tarayici yeterlidir.)' -ForegroundColor Gray
Write-Host ''
Write-Host '   Ayrintili bilgi: install\KURULUM_KILAVUZU.md' -ForegroundColor Gray
Write-Host '  =====================================================' -ForegroundColor Green
Write-Host ''

# =============================================================================
# PROMETA ONE — MUSTERI KURULUM PAKETI URETICISI (package-release.ps1)
# =============================================================================
# SADECE URETICI FIRMADA (Promet Bilisim) calistirilir. Cikan zip musteriye
# gonderilir. PAKETE KAYNAK KOD GIRMEZ — yalnizca:
#   - Derlenmis Docker image arsivi (images/prometa-one-images.tar)
#   - docker-compose.prod.yml
#   - install/ (kurulum sihirbazlari + kilavuz)
#   - license/ (bos - musteri lisans dosyasini buraya koyar)
#
# Kullanim:
#   powershell -ExecutionPolicy Bypass -File tools\package-release.ps1
#   ... -IncludeConstruction   # Santiye modulu image'larini da pakete ekler
#   ... -SkipBuild             # image'lar zaten guncel ise build'i atla
#
# Cikti: release\prometa-one-<yyyyMMdd-HHmm>\ + ayni adla .zip
#
# NOT: docker save ile base image (postgres:16-alpine) da arsive dahil edilir;
# boylece musteri sunucusu INTERNETSIZ de kurulabilir.
# =============================================================================
#requires -Version 5.1
param(
    [switch]$IncludeConstruction,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

# Proje koku = bu script'in bulundugu klasorun ustu (tools/ -> kok)
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Ok([string]$Text)   { Write-Host ("  [OK] {0}" -f $Text) -ForegroundColor Green }
function Write-Bilgi([string]$Text){ Write-Host ("  {0}" -f $Text) -ForegroundColor Gray }
function Write-Hata([string]$Text) { Write-Host ("  [HATA] {0}" -f $Text) -ForegroundColor Red }

Write-Host ''
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host '   PROMETA ONE - MUSTERI PAKETI URETICISI' -ForegroundColor Cyan
Write-Host '  =====================================================' -ForegroundColor Cyan
Write-Host ''

# --- On kosul: Docker ---------------------------------------------------------
& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Hata 'Docker daemon calismiyor. Docker Desktop''i baslatin.'
    exit 1
}

# --- 1) Prod image'lari derle ---------------------------------------------------
# compose dosyasi ${POSTGRES_PASSWORD:?} gibi zorunlu degiskenler icerir;
# build asamasinda gercek sifre GEREKMEZ (runtime env) - gecici dummy env yeter.
$geciciEnv = Join-Path $env:TEMP ('prometa-pkg-{0}.env' -f (Get-Random))
@(
    'POSTGRES_PASSWORD=build-only-dummy',
    'JWT_SECRET=build-only-dummy-min-32-chars-xxxxxxxxxxxx',
    'JWT_REFRESH_SECRET=build-only-dummy-min-32-chars-xxxxxxxxxx'
) | Out-File -FilePath $geciciEnv -Encoding ascii -Force

try {
    if (-not $SkipBuild) {
        Write-Bilgi 'Uretim image''lari derleniyor (api, web, ml-service)...'
        $servisler = @('api', 'web', 'ml-service')
        $profilArgs = @()
        # construction-service prod compose'da 'construction' profili altinda —
        # ismen hedeflense de profili acik tutmak derlemeyi deterministik yapar.
        if ($IncludeConstruction) {
            $servisler += 'construction-service'
            $profilArgs = @('--profile', 'construction')
        }
        & docker compose -f docker-compose.prod.yml --env-file $geciciEnv @profilArgs build @servisler
        if ($LASTEXITCODE -ne 0) {
            Write-Hata 'Derleme basarisiz. Yukaridaki hatayi kontrol edin.'
            exit 1
        }
        Write-Ok 'Derleme tamamlandi.'
    } else {
        Write-Bilgi 'Build atlandi (-SkipBuild) - mevcut image''lar paketlenecek.'
    }

    # --- 2) Base image'lari cek (offline kurulum icin) ---------------------------
    $imageListe = @(
        'prometa-one/api:latest',
        'prometa-one/web:latest',
        'prometa-one/ml:latest',
        'postgres:16-alpine'
    )
    if ($IncludeConstruction) {
        $imageListe += @('prometa-one/construction:latest', 'bitnami/kafka:3.7')
    }
    foreach ($img in @('postgres:16-alpine') + $(if ($IncludeConstruction) { @('bitnami/kafka:3.7') } else { @() })) {
        & docker image inspect $img *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Bilgi ("Base image cekiliyor: {0}" -f $img)
            & docker pull $img
            if ($LASTEXITCODE -ne 0) { Write-Hata ("Image cekilemedi: {0}" -f $img); exit 1 }
        }
    }

    # --- 3) Paket klasoru -----------------------------------------------------------
    $etiket = Get-Date -Format 'yyyyMMdd-HHmm'
    $paketAdi = ("prometa-one-{0}" -f $etiket)
    $paketKlasoru = Join-Path $Root ("release\{0}" -f $paketAdi)
    if (Test-Path $paketKlasoru) { Remove-Item -Recurse -Force $paketKlasoru }
    New-Item -ItemType Directory -Path (Join-Path $paketKlasoru 'images') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $paketKlasoru 'license') -Force | Out-Null

    # --- 4) Image arsivi (docker save) ------------------------------------------------
    Write-Bilgi ("Image'lar arsivleniyor ({0} adet) - bu islem uzun surebilir..." -f $imageListe.Count)
    $tarYolu = Join-Path $paketKlasoru 'images\prometa-one-images.tar'
    & docker save -o $tarYolu @imageListe
    if ($LASTEXITCODE -ne 0) {
        Write-Hata 'docker save basarisiz.'
        exit 1
    }
    $tarBoyut = [math]::Round((Get-Item $tarYolu).Length / 1GB, 2)
    Write-Ok ("Image arsivi hazir: images\prometa-one-images.tar ({0} GB)" -f $tarBoyut)

    # --- 5) Compose + kurulum dosyalari ------------------------------------------------
    Copy-Item -Path (Join-Path $Root 'docker-compose.prod.yml') -Destination $paketKlasoru -Force
    Copy-Item -Path (Join-Path $Root 'install') -Destination $paketKlasoru -Recurse -Force
    @(
        'Bu klasore Promet Bilisim''den aldiginiz lisans dosyasini license.lic',
        'adiyla koyun. Kurulum sihirbazi (install\Kurulum-Sunucu.bat) dosyayi',
        'otomatik bulur ve aktive eder.',
        '',
        'Lisans almak icin: sihirbazin 3. adimda gosterdigi DONANIM KIMLIGI''ni',
        'Promet Bilisim''e iletin.'
    ) | Out-File -FilePath (Join-Path $paketKlasoru 'license\BENIOKU.txt') -Encoding utf8 -Force
    @(
        'PROMETA ONE - KURULUM PAKETI',
        '============================',
        '',
        'SUNUCU KURULUMU : install\Kurulum-Sunucu.bat  (sag tik -> Yonetici olarak calistir)',
        'TERMINAL KURULUMU: install\Kurulum-Terminal.bat (her istemci bilgisayarda)',
        '',
        'Ayrintili kilavuz: install\KURULUM_KILAVUZU.md',
        '',
        ("Paket tarihi: {0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm')),
        ("Santiye modulu: {0}" -f $(if ($IncludeConstruction) { 'DAHIL' } else { 'dahil degil' }))
    ) | Out-File -FilePath (Join-Path $paketKlasoru 'BENIOKU.txt') -Encoding utf8 -Force
    Write-Ok 'Compose + kurulum sihirbazlari + kilavuz kopyalandi.'

    # --- 6) Zip ---------------------------------------------------------------------
    $zipYolu = Join-Path $Root ("release\{0}.zip" -f $paketAdi)
    if (Test-Path $zipYolu) { Remove-Item -Force $zipYolu }
    Write-Bilgi 'Zip arsivi olusturuluyor...'
    Compress-Archive -Path $paketKlasoru -DestinationPath $zipYolu -CompressionLevel Optimal
    $zipBoyut = [math]::Round((Get-Item $zipYolu).Length / 1GB, 2)

    Write-Host ''
    Write-Host '  =====================================================' -ForegroundColor Green
    Write-Host '   PAKET HAZIR' -ForegroundColor Green
    Write-Host '  =====================================================' -ForegroundColor Green
    Write-Host ("   Klasor : {0}" -f $paketKlasoru) -ForegroundColor White
    Write-Host ("   Zip    : {0} ({1} GB)" -f $zipYolu, $zipBoyut) -ForegroundColor White
    Write-Host ''
    Write-Host '   Musteriye zip''i gonderin. Musteri tarafinda:' -ForegroundColor Gray
    Write-Host '   1. Zip''i sunucuya acar (orn. C:\prometa-one\)' -ForegroundColor Gray
    Write-Host '   2. install\Kurulum-Sunucu.bat -> Yonetici olarak calistirir' -ForegroundColor Gray
    Write-Host '   3. Sihirbazin verdigi DONANIM KIMLIGI ile lisans talep eder' -ForegroundColor Gray
    Write-Host '  =====================================================' -ForegroundColor Green
    Write-Host ''
} finally {
    if (Test-Path $geciciEnv) { Remove-Item -Force $geciciEnv }
}

# AJAN_KOORDINASYON.docx'i .md "Islem Logu"ndan TEK KOMUTLA yeniler.
# Akis:  docx ac (.tmp-docx)  ->  node tools/sync-log-docx.cjs  ->  forward-slash repack  ->  dogrula  ->  yaz
# Onemli: repack entry adlarini '/' ile yazar. PowerShell 5.1 [ZipFile]::CreateFromDirectory
#         '\' uretir ve Word docx'i reddeder; bu yuzden her entry tek tek forward-slash adla eklenir.
# Kullanim:  powershell -ExecutionPolicy Bypass -File tools\sync-log-docx.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot            # repo koku = tools/'un ust dizini
$docx = Join-Path $root 'AJAN_KOORDINASYON.docx'
$tmp  = Join-Path $root '.tmp-docx'
$out  = Join-Path $env:TEMP ('ajan_docx_' + [guid]::NewGuid().ToString('N') + '.docx')

if (-not (Test-Path $docx)) { throw "Bulunamadi: $docx" }
if ([IO.Directory]::Exists($tmp)) { [IO.Directory]::Delete($tmp, $true) }

# 1) docx'i ac
[IO.Compression.ZipFile]::ExtractToDirectory($docx, $tmp)

# 2) md "Islem Logu" -> .tmp-docx/word/document.xml (90 satir + turetilmis header)
Push-Location $root
try { node tools/sync-log-docx.cjs } finally { Pop-Location }

# 3) repack: her dosyayi forward-slash entry adiyla yeni zip'e ekle
$base = (Get-Item $tmp).FullName
$fs   = [IO.File]::Open($out, [IO.FileMode]::CreateNew)
$zip  = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
foreach ($file in Get-ChildItem -Path $tmp -Recurse -File) {
  $rel   = $file.FullName.Substring($base.Length + 1).Replace([char]92, [char]47)
  $entry = $zip.CreateEntry($rel, [IO.Compression.CompressionLevel]::Optimal)
  $es    = $entry.Open()
  $bytes = [IO.File]::ReadAllBytes($file.FullName)
  $es.Write($bytes, 0, $bytes.Length)
  $es.Dispose()
}
$zip.Dispose(); $fs.Dispose()

# 4) dogrula -> SADECE gecerliyse gercek docx'i degistir (bozuk repack docx'i bozmasin)
$z = [IO.Compression.ZipFile]::OpenRead($out)
$names = $z.Entries | ForEach-Object { $_.FullName }
$z.Dispose()
$bs = [char]92; $hasBack = $false
foreach ($n in $names) { if ($n.Contains($bs)) { $hasBack = $true } }
$ok = ($names -contains 'word/document.xml') -and ($names -contains '[Content_Types].xml') -and (-not $hasBack)
if ($ok) {
  Copy-Item $out $docx -Force
  Write-Output ("OK -> AJAN_KOORDINASYON.docx guncellendi ({0} entry)" -f $names.Count)
} else {
  throw "Repack dogrulamasi basarisiz (entry yapisi) -> docx KORUNDU"
}

# 5) temizlik
[IO.Directory]::Delete($tmp, $true)
[IO.File]::Delete($out)

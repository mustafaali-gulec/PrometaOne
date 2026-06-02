# Otomatik Deploy Kurulumu (Self-Hosted · Local Docker)

DevOps ajanı tarafından hazırlandı. Amaç: `master`/`main` dalına her **push**'ta,
**kendi bilgisayarında** otomatik olarak build + test + deploy çalışsın; sen de
durumu/logları script'lerle izleyesin.

## Nasıl çalışır?

```
Sen kod push edersin  ──►  GitHub  ──►  PC'ndeki self-hosted runner
                                              │
                                   npm ci → lint → typecheck → test
                                              │
                                   docker compose up -d --build
                                              │
                                   deploy/deploy-history.log'a kayıt
```

GitHub Actions bulutta çalışır ama deploy hedefin **kendi PC'n** olduğu için,
build/deploy adımlarını senin makinende çalıştıran bir **self-hosted runner** kullanıyoruz.

---

## Tek seferlik kurulum (senin yapman gereken 3 adım)

> Bunlar senin GitHub hesabın ve makinenle yapılır; ajan senin yerine yapamaz.

### 1. Docker Desktop kurulu ve açık olsun

Windows'ta Docker Desktop yüklü ve çalışır durumda olmalı (`docker compose version` çalışmalı).

### 2. GitHub deposu + remote

Henüz remote yok. GitHub'da boş bir repo aç, sonra:

```bash
git remote add origin https://github.com/<kullanici>/<repo>.git
git push -u origin master
```

### 3. Self-hosted runner kur (hazır script ile)

Hazır kurulum script'i indirme + kayıt + başlatmayı senin yerine yapar. Sana sadece
iki şey lazım: **repo URL** ve **kayıt token'ı**.

**Token'ı al:** GitHub repo → **Settings → Actions → Runners → New self-hosted runner → Windows**.
Açılan ekranda gösterilen `--token` değerini kopyala (kısa ömürlüdür).

**Script'i çalıştır** (proje klasöründe, PowerShell veya CMD):

```bat
:: İnteraktif (önerilen — pencere açık kaldıkça çalışır):
setup-runner.bat https://github.com/<kullanici>/<repo> <TOKEN>

:: Windows servisi olarak (reboot'ta otomatik başlar):
setup-runner.bat https://github.com/<kullanici>/<repo> <TOKEN> service
```

Script şunları yapar: en güncel runner'ı indirir → `C:\actions-runner-prometa`'ya açar →
repo'ya `self-hosted,windows,docker` etiketleriyle kaydeder → başlatır.
GitHub → Settings → Actions → Runners'ta **"Idle"** görününce hazırdır.

> Not: Docker Desktop kullanıcı-bazlı çalıştığı için, **local Docker deploy'da interaktif mod
> daha güvenilir**. Servis modunda Docker'a erişim için servis hesabının Docker'a yetkili olması gerekir.

Runner "Idle" görününce hazırdır.

---

## Kullanım

- **Otomatik:** `master`/`main`'e push et → pipeline kendiliğinden çalışır.
- **Manuel tetikleme:** GitHub → **Actions → Deploy → Run workflow**.

## İzleme (bilgisayarından)

| Komut               | Ne yapar                                                              |
| ------------------- | --------------------------------------------------------------------- |
| `deploy-status.bat` | Servis durumları + erişim adresleri + son 10 deploy kaydı             |
| `deploy-logs.bat`   | Tüm servislerin canlı logu (`deploy-logs.bat backend` ile tek servis) |
| GitHub → Actions    | Her deploy'un adım adım çıktısı, başarı/hata                          |

Deploy geçmişi ayrıca `deploy/deploy-history.log` dosyasına yazılır.

## Pipeline adımları (`.github/workflows/deploy.yml`)

`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `docker compose up -d --build` → durum + log.
Test/lint/typecheck başarısız olursa deploy yapılmaz (kalite kapısı).

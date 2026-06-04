# Oturum Devir Notu — Ajan Ekibi & Otomatik Deploy

Bu dosya, Cowork oturumunda yapılan işleri ve kaldığın yeri özetler. Amaç: code
ortamında (Claude Code / VS Code) kaldığın yerden sorunsuz devam edebilmen.

Tarih: 2026-06-01 / 2026-06-02 · Repo: `C:\prometa-one` · Branch: `master`
Remote: `https://github.com/mustafaali-gulec/PrometaOne.git`

---

## 1. Yapılanlar (tamamlandı)

### a) Ajan ekibi yapısı

7 rollü bir ajan ekibi tanımlandı ve `AJAN_KOORDINASYON.docx` (repo kökü) dosyasında
belgelendi. Roller: **TL** Team Lider, **FE** Frontend, **BE** Backend, **QA** Testçi,
**DB** Veritabanı, **AC** Kullanıcı & Yetki, **DO** DevOps/Deploy.

- Yetki modeli: _tam yetki, kritikte onay_ (dosya silme, push, migration, yıkıcı SQL,
  major sürüm yükseltme, secret değişikliği onaya tabi).
- Dosyanın "İşlem Logu" bölümü = yapılan tüm işlerin kronolojik geçmişi (şu an v1.4).

### b) Sistem rolleri isim değişikliği

`frontend/src/App.jsx` içindeki `ROLES` tanımı:

- `Yönetici` (Seviye 4) → **Admin** (`admin` anahtarı)
- `Mali Müdür` (Seviye 3) → **Yönetici** (`cfo` anahtarı)

Anahtarlar (`admin`, `cfo`) ve seviyeler değişmedi; sadece görünen etiketler. `seed.sql`
etkilenmedi. Bu değişiklik commit'lenmeyi bekliyor (working tree'de).

### c) Otomatik deploy altyapısı (DevOps)

Model: `master`/`main`'e push → PC'deki self-hosted runner build+test yapar →
`docker compose up` ile local Docker'da ayağa kaldırır → sen status/log izlersin.

Oluşturulan dosyalar:
| Dosya | Amaç |
|-------|------|
| `.github/workflows/deploy.yml` | CI/CD: push'ta `npm ci → lint → typecheck → test → docker compose up -d --build` |
| `deploy-status.bat` | Servis durumu + erişim adresleri + son deploy kayıtları |
| `deploy-logs.bat` | Canlı log akışı (tüm servisler veya tek servis) |
| `setup-runner.bat` + `tools/setup-github-runner.ps1` | Self-hosted runner indirme/kayıt/başlatma scripti |
| `DEPLOY_SETUP.md` | Deploy kurulum rehberi (detaylar burada) |

### d) Self-hosted runner

- Repo GitHub'a push edildi (ilk commit).
- Runner `C:\actions-runner-prometa`'ya kuruldu, GitHub'a bağlandı, **Windows servisi**
  olarak çalışıyor (`actions.runner.mustafaali-gulec-PrometaOne.MUSTAFAG`). Reboot'ta otomatik başlar.
- Etiketler: `self-hosted, Windows, X64`. Workflow `runs-on: [self-hosted]` bununla eşleşir.

---

## 2. Sıradaki adımlar (yapılacak)

1. **Deploy dosyalarını commit + push et** (workflow GitHub'da olmadan deploy tetiklenmez):

   ```bat
   cd /d C:\prometa-one
   git add .github deploy-status.bat deploy-logs.bat setup-runner.bat tools DEPLOY_SETUP.md AJAN_KOORDINASYON.docx
   git commit -m "ci: self-hosted deploy workflow + devops araclari"
   git push
   ```

   (App.jsx rol değişikliğini de göndermek istersen `frontend/src/App.jsx`'i de `git add`'e ekle.)

2. **İlk deploy'u izle:** GitHub → Actions → "Deploy" workflow'u. Veya `deploy-status.bat`.

3. **Docker erişim uyarısı:** Runner `NT AUTHORITY\NETWORK SERVICE` ile servis olarak kurulu.
   Docker Desktop kullanıcı-bazlı çalıştığından `docker compose` adımı
   "cannot connect to Docker daemon" verebilir. Çözüm seçenekleri:
   - Runner servisini kendi Windows kullanıcı hesabınla yeniden kur, **veya**
   - Servis hesabını Docker'a yetkilendir (docker-users grubu / TCP daemon).

---

## 3. Bilinmesi gerekenler

- **Working tree'de çok sayıda commit'lenmemiş WIP var** (özellikle `App.jsx` ve `api-server/`).
  `git add .` ile hepsini gönderirsen, testten geçmeyen kod deploy'u test adımında durdurabilir
  (bu CI'nin beklenen davranışı).
- Cowork oturumundaki sandbox mount'u dosya okurken ara ara NUL baytı karıştırıyordu; bu bir
  **ortam artefaktıydı, senin dosyaların sağlam**. Code ortamında bu sorun yok.
- Güvenlik: oturumda paylaşılan GitHub PAT ifşa oldu — henüz yapmadıysan **revoke et**.

## 4. Erişim adresleri (deploy sonrası)

Frontend `http://localhost:5173` · Backend API `http://localhost:3000/v1` ·
ML Service `http://localhost:8001` · Adminer `http://localhost:8080` (tools profili)

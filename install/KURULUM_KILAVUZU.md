# Prometa One — Kurulum Kılavuzu

Bu kılavuz, Prometa One'ın **1 sunucu + N terminal** mimarisiyle müşteri
ortamına kurulumunu anlatır. Uygulama yalnızca sunucuda çalışır; terminal
bilgisayarlar sunucuya tarayıcıdan bağlanır (terminallerde Docker **gerekmez**).

> Hızlı yol: Sunucuda `install\Kurulum-Sunucu.bat` → her terminalde
> `install\Kurulum-Terminal.bat`. Sihirbazlar aşağıdaki tüm adımları
> otomatik yürütür; bu belge ayrıntı ve sorun giderme içindir.

---

## 1. Mimari ve paket içeriği

```
┌─────────────┐   http://<SUNUCU_IP>:<PORT>   ┌──────────────────────────────┐
│  Terminal 1 │ ────────────────────────────► │  SUNUCU (Docker)             │
│  Terminal 2 │ ────────────────────────────► │   web (nginx: SPA + proxy)   │
│  Terminal N │ ────────────────────────────► │   api (lisans + iş mantığı)  │
└─────────────┘                               │   postgres  ·  ml-service    │
                                              └──────────────────────────────┘
```

Kurulum paketi (`tools/package-release.ps1` ile üretilir) şu yapıdadır:

```
prometa-one-kurulum/
├─ docker-compose.prod.yml      # üretim compose tanımı
├─ images/
│  └─ prometa-one-images.tar    # hazır Docker image arşivi (paket modu)
├─ install/
│  ├─ Kurulum-Sunucu.bat/.ps1   # sunucu sihirbazı (Windows)
│  ├─ kurulum-sunucu.sh         # sunucu sihirbazı (Linux)
│  ├─ Kurulum-Terminal.bat/.ps1 # terminal sihirbazı (Windows)
│  └─ KURULUM_KILAVUZU.md       # bu belge
└─ license/                     # license.lic buraya konur (kurulumda oluşur)
```

`images/prometa-one-images.tar` yoksa sihirbaz **kaynak modu**na düşer ve
image'ları yerelde derler (git deposundan kurulumda kullanılır; internet +
10-20 dk gerektirir).

## 2. Sistem gereksinimleri

| Bileşen | Sunucu                                             | Terminal             |
| ------- | -------------------------------------------------- | -------------------- |
| İşletim | Windows 10/11 veya Windows Server / Linux          | Windows 10/11        |
| Yazılım | Docker Desktop (veya Linux'ta docker + compose v2) | Yalnızca tarayıcı    |
| Donanım | 4 çekirdek, 8 GB RAM, 20 GB boş disk (öneri)       | —                    |
| Ağ      | Terminallerin erişebildiği sabit IP önerilir       | Sunucuya LAN erişimi |

## 3. Sunucu kurulumu (Windows)

1. Kurulum paketini sunucuya kopyalayın (ör. `C:\PrometaOne`).
2. `install\Kurulum-Sunucu.bat` dosyasına **sağ tık → Yönetici olarak
   çalıştır**.
3. Sihirbaz sırasıyla şunları yapar:
   1. **Yönetici kontrolü** — güvenlik duvarı ve Docker işlemleri için gerekli.
   2. **Ön koşul** — Docker + Compose v2 + çalışan daemon denetlenir.
   3. **Donanım Kimliği** — `XXXX-XXXX-XXXX-XXXX` biçiminde lisans parmak izi
      hesaplanıp ekranda gösterilir. Bu değeri **Promet Bilişim'e iletin**;
      lisans dosyanız bu makineye özel kesilir.
   4. **Lisans dosyası** — `license\license.lic` aranır; yoksa dosya yolu
      sorulur. Lisanssız da devam edilebilir (uygulama, lisans yüklenene kadar
      kilitli kalır — bkz. §6).
   5. **Yapılandırma** — HTTP portu ve opsiyonel SMTP sorulur; güçlü rastgele
      şifrelerle `.env.prod` üretilir. Tekrar çalıştırmada mevcut dosya
      **korunabilir** (güncelleme modu).
   6. **Kurulum** — `images\prometa-one-images.tar` varsa `docker load`
      (paket modu), yoksa `docker compose build` (kaynak modu); ardından
      `up -d`.
   7. **Migration** — veritabanı şeması güncellenir; ilk kurulumda opsiyonel
      başlangıç verisi (seed) yüklenebilir.
   8. **Lisans aktivasyonu** — `license.lic` konteyner içinden doğrulanıp
      veritabanına işlenir.
   9. **Güvenlik duvarı** — seçilen port için gelen TCP kuralı eklenir.
   10. **Sağlık kontrolü** — `/v1/health` 200 dönene kadar (en fazla 60 sn)
       beklenir; özet ekranında sunucunun ağ adresleri listelenir.

Linux sunucuda aynı akış için: `sudo bash install/kurulum-sunucu.sh`

### Kurulum sonrası doğrulama

- Web arayüzü: `http://localhost:<PORT>` (sunucudan) / `http://<SUNUCU_IP>:<PORT>` (ağdan)
- Sağlık: `http://localhost:<PORT>/v1/health`
- Lisans durumu: `http://localhost:<PORT>/v1/license/status`

## 4. Terminal kurulumu

Her terminal bilgisayarda:

1. `install\Kurulum-Terminal.bat` çalıştırın (yönetici yetkisi gerekmez).
2. Sunucu adresini/IP'sini ve portu girin — sihirbaz `/v1/health` ile
   bağlantıyı test eder.
3. Masaüstü + Başlat Menüsü'ne **"Prometa One"** kısayolu oluşturulur
   (Edge/Chrome uygulama modu; ikisi de yoksa varsayılan tarayıcı `.url`).
4. İsterseniz Windows oturum açılışında otomatik başlatma etkinleştirilir.

Terminal kimliği (koltuk sayımı için) uygulama tarayıcıda **ilk açıldığında
otomatik üretilir** ve sunucuya kaydedilir; ek bir işlem gerekmez.

## 5. Lisanslama

- Lisans, Ed25519 imzalı bir `license.lic` dosyasıdır: müşteri adı, bitiş
  tarihi, **maksimum terminal (koltuk) sayısı** ve opsiyonel donanım kilidi
  içerir. Dosya değiştirilirse imza bozulur ve lisans geçersiz olur.
- Süresi dolan/eksik lisansta uygulama tam ekran bir kilitleme ekranı gösterir;
  bitişe 14 gün kala sağ altta uyarı bandı çıkar.
- Terminal limiti aşılırsa yeni terminal `403 Terminal limiti aşıldı` alır;
  yönetici, yönetim ekranından kullanılmayan terminalleri kaldırabilir.

### Yeni/yenilenen lisansı yükleme (iki yol)

1. **Uygulamadan (önerilen):** kilit ekranında yönetici kullanıcı adı + şifre
   girip `license.lic` dosyasını seçin → **Lisansı Yükle**.
2. **Sunucudan komutla:** dosyayı `license\license.lic` konumuna koyup:

   ```
   docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run license:activate -- /license/license.lic
   ```

## 6. Sık karşılaşılan sorunlar

| Belirti                                           | Neden / Çözüm                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Docker daemon calismiyor`                        | Docker Desktop'ı başlatın, "Engine running" olunca sihirbazı tekrar çalıştırın.                                                                                   |
| Servisler başlamıyor / port hatası                | Seçilen port başka uygulamada olabilir. Sihirbazı tekrar çalıştırıp farklı port seçin. Log: `docker compose -f docker-compose.prod.yml --env-file .env.prod logs` |
| Terminal sunucuya ulaşamıyor                      | Sunucu açık mı, IP/port doğru mu, güvenlik duvarı kuralı ("Prometa One Web") var mı kontrol edin.                                                                 |
| `Lisans aktivasyonu basarisiz`                    | Lisans başka makine için kesilmiş (Donanım Kimliği uyuşmuyor), süresi dolmuş veya dosya bozuk. Özet ekranındaki Donanım Kimliği ile Promet Bilişim'e başvurun.    |
| Uygulama açılıyor ama "Lisans yüklü değil" ekranı | `license.lic` yüklenmemiş — §5'teki iki yoldan biriyle aktive edin.                                                                                               |
| Migration hatası                                  | API'nin açılması uzun sürmüş olabilir; birkaç dakika sonra elle: `docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run migrate`        |
| DB şifresi değişince bağlantı hatası              | Postgres ilk kurulum şifresini kullanır. Güncellemede "gizli anahtarlar korunsun mu?" sorusuna **Evet** deyin.                                                    |

## 7. Güncelleme

Yeni sürüm paketini aynı klasörün üzerine açıp sunucu sihirbazını tekrar
çalıştırın. Sihirbaz idempotenttir: `.env.prod` korunur, yeni image'lar
yüklenir, `up -d` + `migrate` çalışır; **veri kaybı olmaz** (veriler Docker
volume'larında tutulur).

## 8. Yedekleme (önerilen)

- `.env.prod` dosyasını güvenli bir yere yedekleyin (şifreler içerir).
- Veritabanı yedeği:

  ```
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres pg_dump -U prometa prometa_one > yedek.sql
  ```

---

Destek: **Promet Bilişim** — kurulum sırasında görüntülenen Donanım Kimliği'ni
ve varsa hata ekran görüntüsünü iletin.

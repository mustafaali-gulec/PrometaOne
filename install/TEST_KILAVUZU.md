# Prometa One — Kurulum Kabul Testi (Kontrol Listesi)

Bu belge, kurulum sihirbazlarının **gerçek bir müşteri makinesinde** doğru
çalıştığını doğrulamak içindir. Her adımın yanında beklenen sonuç ve
işaretleme kutusu var; VM/test makinesinde yanında açıp sırayla ilerle.

> **Neden temiz makine?** Sihirbazların test ettiği şeylerin çoğu (Docker'ın
> hiç kurulu olmaması, portların boş olması, image'ların `docker load` ile ilk
> kez yüklenmesi, makineye özel Donanım Kimliği, sıfırdan güvenlik duvarı
> kuralı) geliştirme makinesinde zaten "kirli" durumdadır. Temiz bir ortam
> olmadan bu yollar atlanır ve yanıltıcı "başarılı" sonucu alırsın.

---

## 0. Test ortamı seçenekleri

| Seçenek                       | Ortam                                                          | Not                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** (en sadık)              | Temiz Windows 10/11 VM (Hyper-V / VirtualBox) + Docker Desktop | Docker Desktop için **iç içe sanallaştırma** şart: `Set-VMProcessor -VMName <ad> -ExposeVirtualizationExtensions $true` (VM kapalıyken). Kurulumdan sonra **snapshot** al. |
| **B** (önerilen, az sürtünme) | Bulut Linux VM (docker + compose v2)                           | `kurulum-sunucu.sh` ile sunucu; terminalleri kendi Windows makinenin tarayıcısından test et. Nested-virt / Docker Desktop derdi yok.                                       |
| **C** (en gerçekçi)           | Boş ikinci fiziksel PC                                         | Docker Desktop kur, paketi aç, `Kurulum-Sunucu.bat`.                                                                                                                       |

**Çok-terminal testi için ikinci bir makine (veya kendi ana makinen) gerekir** —
terminal↔sunucu ağ/firewall/CORS/koltuk sayımı ancak farklı bir makineden
gerçekçi test edilir.

---

## 1. Ön hazırlık (üretici tarafı — kendi makinende)

- [ ] **1.1** Müşteri paketini üret:
      `powershell -ExecutionPolicy Bypass -File tools\package-release.ps1`
      → Beklenen: `release\prometa-one-<tarih>.zip` oluşur (images tar + compose + install).
- [ ] **1.2** Zip'i test makinesine kopyala ve bir klasöre aç (örn. `C:\PrometaOne`).
- [ ] **1.3** Lisans üretici anahtarının yerinde olduğunu doğrula:
      `node tools\license-generator\cli.js verify --help` çalışıyor mu; `keys\license-private.pem` mevcut mu.

---

## 2. Sunucu sihirbazı — kurulum

Windows: `install\Kurulum-Sunucu.bat` → sağ tık → **Yönetici olarak çalıştır**.
Linux: `sudo bash install/kurulum-sunucu.sh`.

- [ ] **2.1 Yönetici kontrolü** — yönetici değilken uyarı verip çıkıyor; yönetici olarak geçiyor.
- [ ] **2.2 Docker ön-koşulu** — Docker yok/kapalıysa anlaşılır Türkçe hata + çözüm; kuruluysa geçiyor.
      _(Docker Desktop ilk açılışta "Engine running" olana kadar bekle.)_
- [ ] **2.3 Donanım Kimliği** — ekranda `XXXX-XXXX-XXXX-XXXX` biçiminde çıkıyor. **Not al:** `____-____-____-____`
- [ ] **2.4 Lisans adımı — LİSANSSIZ devam** — dosya yolu boş bırakıldığında "lisanssız devam / uygulama kilitli kalır" uyarısı veriyor ve kuruluma devam ediyor.
- [ ] **2.5 Yapılandırma** — HTTP portu sorusu; SMTP boş geçilebiliyor; `.env.prod` yazılıyor (güçlü rastgele `POSTGRES_PASSWORD`/`JWT_SECRET`/`JWT_REFRESH_SECRET` + `PROMETA_FINGERPRINT` = 2.3'teki kimlik).
- [ ] **2.6 Kurulum modu** — pakette `images\prometa-one-images.tar` olduğu için **paket modu** (`docker load`) çalışıyor (build'e düşmüyor).
- [ ] **2.7 up -d** — postgres, api, web, ml-service konteynerleri ayağa kalkıyor (`docker compose -f docker-compose.prod.yml --env-file .env.prod ps`).
- [ ] **2.8 Migration** — `npm run migrate` başarıyla koşuyor; ilk kurulum sorusuna seed dendiyse başlangıç verisi yükleniyor.
- [ ] **2.9 Güvenlik duvarı** — seçilen port için "Prometa One Web" gelen kuralı ekleniyor.
- [ ] **2.10 Sağlık kontrolü** — `http://localhost:<port>/v1/health` 200 dönüyor; özet ekranında sunucunun IP adresleri listeleniyor.

---

## 3. Lisans zorlaması — kilit ekranı (kritik)

- [ ] **3.1** Sunucunun tarayıcısında `http://localhost:<port>` açıldığında **tam ekran kilit ekranı** görünüyor (lisans henüz yok).
- [ ] **3.2** `http://localhost:<port>/v1/license/status` → `{"valid":false,"reason":"missing"}` benzeri dönüyor.
- [ ] **3.3** Kilit ekranı 4 dilde de düzgün (sağ üstten TR/EN/DE/AR; Arapça'da sağdan-sola).

---

## 4. Lisans kesme + aktivasyon (round-trip)

Üretici tarafında (kendi makinende), 2.3'teki kimliği kullan:

- [ ] **4.1** Lisans kes:
      `node tools\license-generator\cli.js issue --customer "Test Musteri" --valid-until 2027-07-03 --max-terminals 5 --fingerprint <2.3'TEKI-KIMLIK> --out license.lic`
      → Beklenen: `license.lic` oluşur, `verify` ile GEÇERLİ görünür.
- [ ] **4.2** `license.lic`'i sunucuya kopyala. Aktivasyon — iki yoldan biri:
  - Sihirbazı tekrar çalıştır (dosya yolunu sorar), **veya**
  - `docker compose -f docker-compose.prod.yml --env-file .env.prod exec api npm run license:activate -- /license/license.lic`, **veya**
  - Uygulamadaki kilit ekranından admin kullanıcı adı/şifre + dosya seçerek.
- [ ] **4.3** Aktivasyon sonrası kilit kalkıyor; `/v1/license/status` → `valid:true`, doğru müşteri adı, bitiş tarihi, `maxTerminals:5`.
- [ ] **4.4** Uygulamaya admin ile girip **Sistem → Lisans Yönetimi** ekranı açılıyor: durum/kalan gün, Donanım Kimliği, koltuk doluluğu doğru görünüyor.

---

## 5. Negatif testler (güvenlik — bunlar BAŞARISIZ olmalı ki sistem doğru çalışsın)

- [ ] **5.1 Yanlış makine** — başka/rastgele bir fingerprint ile lisans kes → aktivasyon **reddedilmeli** (`fingerprint_mismatch`); uygulama kilitli kalmalı.
- [ ] **5.2 Süresi geçmiş** — `--valid-until 2020-01-01` ile lisans kes → aktivasyon **reddedilmeli** (`expired`).
- [ ] **5.3 Tahrif** — geçerli `license.lic` içinde `maxTerminals` değerini elle değiştir → aktivasyon **reddedilmeli** (imza bozulur, `invalid_signature`).
- [ ] **5.4 Lisans silme** — DB'den lisansı kaldırıp (`DELETE FROM license_store;`) tarayıcıyı yenile → uygulama **tekrar kilitlenmeli** (≤60 sn cache sonrası).

---

## 6. Terminal sihirbazı — farklı bir makineden

İkinci makinede: `install\Kurulum-Terminal.bat` (yönetici gerekmez).

- [ ] **6.1** Sunucu IP + port giriliyor → `/v1/health` bağlantı testi geçiyor.
- [ ] **6.2** Yanlış IP/port girildiğinde anlaşılır hata + tekrar deneme / yine de devam seçeneği.
- [ ] **6.3** Terminal adı soruluyor (varsayılan: bilgisayar adı).
- [ ] **6.4** Masaüstü + Başlat Menüsü'ne **"Prometa One"** kısayolu oluşuyor (Edge/Chrome uygulama modu; ikisi de yoksa `.url`).
- [ ] **6.5** Kısayol açılınca uygulama sunucudan yükleniyor, giriş ekranı geliyor.
- [ ] **6.6** (Opsiyonel) Windows açılışında otomatik başlatma seçildiyse Startup klasörüne kısayol kopyalanıyor.

---

## 7. Çok-terminal + koltuk limiti (asıl senaryo)

5 terminallik lisansla (4.1), 5+ ayrı istemciden dene. _(Tek makinen varsa: farklı
tarayıcılar + gizli sekmeler her biri yeni bir terminal kimliği üretir.)_

- [ ] **7.1** 5 ayrı terminalden giriş → hepsi çalışıyor; **Lisans Yönetimi → Terminaller** tablosunda 5 kayıt görünüyor.
- [ ] **7.2** **6. terminal** → "Terminal limiti aşıldı" ekranı geliyor, uygulamaya girilemiyor.
- [ ] **7.3** Lisans Yönetimi'nden kullanılmayan bir terminali **Sil** → koltuk boşalıyor → 6. terminal artık girebiliyor.
- [ ] **7.4** Silinen terminal tekrar bağlanınca "(bu terminal)" rozeti + yeniden kayıt doğru çalışıyor.

---

## 8. Güncelleme (idempotency) + kalıcılık

- [ ] **8.1** Sunucu sihirbazını **tekrar** çalıştır → "güncelleme modu"na giriyor; "gizli anahtarlar korunsun mu?" sorusuna **Evet** de.
- [ ] **8.2** Güncelleme sonrası: mevcut veriler (şirketler, kasa, kullanıcılar) **kayıpsız** duruyor; lisans hâlâ aktif.
- [ ] **8.3** Sunucuyu yeniden başlat (VM restart) → konteynerler `unless-stopped` ile otomatik ayağa kalkıyor; uygulama erişilebilir.

---

## 9. Ağ güvenliği doğrulaması

- [ ] **9.1** Sunucuda `docker compose -f docker-compose.prod.yml --env-file .env.prod ps` → **yalnız `web`** (nginx) portu dışarı yayınlanmış; postgres/api/ml host portu YOK.
- [ ] **9.2** Terminal makinesinden `http://<SUNUCU_IP>:5432` / `:3000` / `:8001` **açılMAMALI** (bağlantı reddi/zaman aşımı) — yalnız `http://<SUNUCU_IP>:<port>` çalışmalı.

---

## 10. Yedekleme provası

- [ ] **10.1** `docker compose ... exec -T postgres pg_dump -U prometa prometa_one > yedek.sql` → dolu bir dosya üretiyor.
- [ ] **10.2** `.env.prod` dosyasını güvenli bir yere yedekledin (şifreleri içerir).

---

## Sık takılınan noktalar (test sırasında)

- Docker Desktop "Engine running" olmadan sihirbaz çalışırsa "daemon çalışmıyor" der — bekle, tekrar çalıştır.
- **80 portu** IIS/Skype gibi bir şeyle çakışabilir → sihirbazda farklı port (örn. 8080) seç, terminal sihirbazında da aynısını gir.
- **VM'i lisans kestikten sonra klonlama/sıfırlama** → Donanım Kimliği değişir, lisans geçersiz olur. Fingerprint'i sabitleyip öyle lisansla.
- İki makine **aynı ağda** olmalı. Terminal bağlanamıyorsa önce sunucuda `http://localhost` açılıyor mu bak (açılıyorsa sorun ağ/firewall/IP).
- Lisans aktivasyonunu API ≤60 sn içinde otomatik görür (cache) — hemen yansımazsa kısa bekle veya tarayıcıyı yenile.

---

**Sonuç:** Tüm kutular işaretlendiğinde kurulum paketi müşteri sahasına
hazırdır. Takılınan adımın numarasını ve ekran çıktısını Promet Bilişim'e ilet.

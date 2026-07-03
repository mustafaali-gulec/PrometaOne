# Prometa One — Lisans Üretici (license-generator)

Ed25519 imzalı `license.lic` dosyaları üreten, bağımlılıksız (saf `node:crypto`)
CLI aracı.

> ## ⚠️ ÇOK ÖNEMLİ — GÜVENLİK
>
> - Bu klasör **SADECE üretici firmada (Promet Bilişim) çalışır**. Müşteri
>   kurulumlarına, müşteri sunucularına veya dağıtım paketlerine **ASLA
>   kopyalanmaz**.
> - `keys/license-private.pem` (özel anahtar) **HİÇBİR KOŞULDA müşteriye veya
>   git deposuna gönderilmez**. `keys/` klasörü kök `.gitignore`'da tanımlıdır —
>   bu satırı kaldırmayın.
> - Private key ele geçirilirse herkes geçerli lisans üretebilir. Bu durumda
>   yeni anahtar çifti üretmek (keygen --force) ve **tüm müşterilere yeni public
>   key gömülü sürüm + yeni lisans** dağıtmak gerekir.
> - Private key'i **mutlaka güvenli bir yere yedekleyin** (şifreli USB, parola
>   kasası vb.). Anahtar kaybolursa mevcut müşterilere yeni lisans
>   **kesilemez**; yukarıdaki anahtar-rotasyonu prosedürü işletilir.

## Kurulum

Ek bağımlılık yoktur; Node.js 20+ yeterlidir.

## Komutlar

### 1) `keygen` — anahtar çifti üret (tek seferlik)

```bash
node tools/license-generator/cli.js keygen
```

- `keys/license-private.pem` (Ed25519 özel anahtar) ve
  `keys/license-public.pem` üretir.
- Public key PEM'ini stdout'a basar — bu PEM
  `api-server/src/modules/licensing/publicKey.ts` içine gömülür.
- Mevcut private key varsa **üzerine yazmaz** (hata verir); bilinçli yenileme
  için `--force` gerekir. `--force` sonrası eski public key ile kesilmiş tüm
  lisanslar geçersiz olur!

### 2) `issue` — lisans kes

```bash
node tools/license-generator/cli.js issue \
  --customer "Acme İnşaat A.Ş." \
  --valid-until 2027-07-03 \
  --max-terminals 5 \
  --fingerprint AB12-CD34-EF56-7890 \
  --features "*" \
  --notes "Yıllık sözleşme #2026-42" \
  --out acme-license.lic
```

| Parametre         | Zorunlu | Açıklama                                                                 |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| `--customer`      | Evet    | Müşteri firma adı                                                        |
| `--valid-until`   | Evet    | `YYYY-MM-DD`; o günün **sonuna kadar** (23:59:59, UTC+3) geçerli         |
| `--max-terminals` | Hayır   | Eşzamanlı kayıtlı terminal (koltuk) sayısı; öndeğer 1                    |
| `--fingerprint`   | Hayır   | Donanım Kimliği (`XXXX-XXXX-XXXX-XXXX`); verilmezse makineye kilitlenmez |
| `--features`      | Hayır   | Virgülle ayrık özellik listesi; öndeğer `*` (hepsi)                      |
| `--notes`         | Hayır   | Serbest not (sözleşme no vb.)                                            |
| `--out`           | Hayır   | Çıktı dosyası; öndeğer `license.lic`                                     |

### 3) `verify` — lisans doğrula

```bash
node tools/license-generator/cli.js verify acme-license.lic --fingerprint AB12-CD34-EF56-7890
```

İmza + ürün + geçerlilik tarihi + (verildiyse) parmak izini kontrol eder,
insan-okur özet basar. Geçersizse çıkış kodu `2`.

## Lisans kesme akışı (müşteri kurulumu)

1. Müşteri, kurulum sihirbazındaki **Donanım Kimliği** (fingerprint,
   `XXXX-XXXX-XXXX-XXXX`) değerini size gönderir. (Sunucu tarafında
   `GET /v1/license/fingerprint` da aynı değeri döner.)
2. Siz üretici makinede lisansı kesersiniz:
   ```bash
   node tools/license-generator/cli.js issue --customer "Firma" \
     --valid-until 2027-07-03 --max-terminals 5 \
     --fingerprint <MÜŞTERİNİN-GÖNDERDİĞİ> --out license.lic
   ```
3. `verify` ile kontrol edip `license.lic` dosyasını müşteriye gönderirsiniz
   (e-posta/USB — dosya imzalıdır, değiştirilirse geçersiz olur; gizli değildir).
4. Müşteri lisansı iki yoldan biriyle etkinleştirir:
   - Uygulamada admin olarak `POST /v1/license/activate` (kurulum sihirbazı /
     yönetim ekranı), veya
   - Sunucuda: `docker compose exec api npm run license:activate -- /license/license.lic`

## Dosya formatı (`license.lic`)

```json
{
  "payload": {
    "licenseId": "LIC-2026-5A1157",
    "product": "prometa-one",
    "customer": "Firma Adı",
    "issuedAt": "2026-07-03T07:57:50.805Z",
    "validUntil": "2027-07-03",
    "maxTerminals": 5,
    "fingerprint": "AB12-CD34-EF56-7890",
    "features": ["*"],
    "notes": ""
  },
  "signature": "<base64: canonicalJSON(payload) üzerinde Ed25519 imza>"
}
```

`canonicalJSON` = anahtarları rekürsif alfabetik sıralanmış `JSON.stringify`.
Aynı fonksiyon hem bu CLI'da hem
`api-server/src/modules/licensing/application/verifier.ts` içinde **birebir
aynı** tutulmalıdır — imza bu kanonik metin üzerinde atılır/doğrulanır.

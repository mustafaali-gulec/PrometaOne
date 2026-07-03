#!/usr/bin/env bash
# =============================================================================
# PROMETA ONE — SUNUCU KURULUM SIHIRBAZI (Linux)
# =============================================================================
# Windows esdegerinin (Kurulum-Sunucu.ps1) birebir Linux karsiligi.
# root olarak calistirin: sudo bash install/kurulum-sunucu.sh
#
# Adimlar: (1) root kontrolu (2) docker/compose kontrolu (3) Donanim Kimligi
# (4) lisans dosyasi (5) .env.prod (6) image yukle/build + up -d (7) migrate
# (+seed) (8) lisans aktivasyonu (9) guvenlik duvari (ufw) (10) saglik + ozet
#
# Donanim Kimligi sozlesmesi (lisans ureticisiyle AYNI olmali):
#   Kaynak: /sys/class/dmi/id/product_uuid (yoksa /etc/machine-id)
#   Normalizasyon: bosluk kirp + BUYUK harf -> SHA256 (sha256sum) ->
#   ilk 16 hex BUYUK harf -> XXXX-XXXX-XXXX-XXXX
# =============================================================================
set -u

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
DOCKER_URL="https://docs.docker.com/engine/install/"

# Renkler
if [ -t 1 ]; then
  C_CYAN="\033[0;36m"; C_GREEN="\033[0;32m"; C_YELLOW="\033[0;33m"; C_RED="\033[0;31m"; C_GRAY="\033[0;90m"; C_RESET="\033[0m"
else
  C_CYAN=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_GRAY=""; C_RESET=""
fi

adim()  { printf "\n${C_CYAN}=== ADIM %s/10 - %s ===${C_RESET}\n" "$1" "$2"; }
ok()    { printf "  ${C_GREEN}[OK]${C_RESET} %s\n" "$1"; }
uyari() { printf "  ${C_YELLOW}[UYARI]${C_RESET} %s\n" "$1"; }
hata()  { printf "  ${C_RED}[HATA]${C_RESET} %s\n" "$1"; }
bilgi() { printf "  ${C_GRAY}%s${C_RESET}\n" "$1"; }

evet_hayir() {
  # $1=soru $2=varsayilan (E|H) -> return 0 = evet
  local soru="$1" varsayilan="$2" ek cevap
  if [ "$varsayilan" = "E" ]; then ek="(E/h)"; else ek="(e/H)"; fi
  printf "  %s %s " "$soru" "$ek"
  read -r cevap
  if [ -z "$cevap" ]; then cevap="$varsayilan"; fi
  case "$cevap" in
    [Ee]*) return 0 ;;
    *) return 1 ;;
  esac
}

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# Proje koku = script klasorunun ustu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
if [ ! -f "$ROOT/$COMPOSE_FILE" ] && [ -f "$(pwd)/$COMPOSE_FILE" ]; then
  ROOT="$(pwd)"
fi
cd "$ROOT" || exit 1

printf "\n"
printf "  ${C_CYAN}=====================================================${C_RESET}\n"
printf "  ${C_CYAN} PROMETA ONE - SUNUCU KURULUM SIHIRBAZI (Linux)${C_RESET}\n"
printf "  ${C_CYAN}=====================================================${C_RESET}\n"
bilgi "Calisma klasoru: $ROOT"

# --- ADIM 1: root kontrolu ----------------------------------------------------
adim 1 "Yetki Kontrolu (root)"
if [ "$(id -u)" -ne 0 ]; then
  hata "Bu sihirbaz root olarak calistirilmalidir."
  bilgi "Cozum: sudo bash install/kurulum-sunucu.sh"
  exit 1
fi
ok "root yetkisi dogrulandi."

# --- ADIM 2: Docker on kosullari ------------------------------------------------
adim 2 "On Kosul Kontrolu (Docker)"
if ! command -v docker >/dev/null 2>&1; then
  hata "Docker bulunamadi."
  bilgi "Cozum: Docker Engine kurun: $DOCKER_URL"
  exit 1
fi
ok "Docker bulundu: $(command -v docker)"

if ! docker info >/dev/null 2>&1; then
  hata "Docker daemon calismiyor."
  bilgi "Cozum: systemctl start docker  (ve acilista: systemctl enable docker)"
  exit 1
fi
ok "Docker daemon calisiyor."

if ! docker compose version >/dev/null 2>&1; then
  hata "Docker Compose (v2 eklentisi) bulunamadi."
  bilgi "Cozum: docker-compose-plugin paketini kurun: $DOCKER_URL"
  exit 1
fi
ok "Docker Compose hazir."

if [ ! -f "$ROOT/$COMPOSE_FILE" ]; then
  hata "$COMPOSE_FILE bulunamadi. Sihirbazi paket kokundeki install/ klasorunden calistirin."
  exit 1
fi

# --- ADIM 3: Donanim Kimligi ------------------------------------------------------
adim 3 "Donanim Kimligi (Lisans Parmak Izi)"
UUID_KAYNAK=""
if [ -r /sys/class/dmi/id/product_uuid ]; then
  UUID_KAYNAK="$(cat /sys/class/dmi/id/product_uuid)"
elif [ -r /etc/machine-id ]; then
  uyari "product_uuid okunamadi - /etc/machine-id kullanilacak."
  UUID_KAYNAK="$(cat /etc/machine-id)"
fi
if [ -z "$UUID_KAYNAK" ]; then
  hata "Donanim kimligi kaynagi bulunamadi (product_uuid / machine-id)."
  exit 1
fi
# Normalizasyon: bosluklari kirp + BUYUK harf (sozlesme — dosya basina bakin)
UUID_NORM="$(printf '%s' "$UUID_KAYNAK" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]')"
HEX="$(printf '%s' "$UUID_NORM" | sha256sum | awk '{print $1}' | cut -c1-16 | tr '[:lower:]' '[:upper:]')"
FINGERPRINT="$(printf '%s' "$HEX" | sed 's/\(....\)\(....\)\(....\)\(....\)/\1-\2-\3-\4/')"
printf "\n"
printf "  +--------------------------------------------------+\n"
printf "  |   DONANIM KIMLIGI :  %s         |\n" "$FINGERPRINT"
printf "  +--------------------------------------------------+\n\n"
bilgi "Bu kimligi Promet Bilisim'e iletin; lisans dosyaniz (license.lic)"
bilgi "bu makineye ozel uretilecektir."

# --- ADIM 4: Lisans dosyasi --------------------------------------------------------
adim 4 "Lisans Dosyasi"
mkdir -p "$ROOT/license"
LIC_DOSYA="$ROOT/license/license.lic"
LISANS_VAR=0
if [ -f "$LIC_DOSYA" ]; then
  ok "Lisans dosyasi mevcut: $LIC_DOSYA"
  LISANS_VAR=1
else
  bilgi "license/license.lic bulunamadi."
  while [ "$LISANS_VAR" -eq 0 ]; do
    printf "  Lisans dosyasinin tam yolunu girin (lisanssiz devam icin bos birakin): "
    read -r LIC_YOL
    if [ -z "$LIC_YOL" ]; then
      uyari "LISANSSIZ devam ediliyor. Uygulama, lisans yuklenip aktive edilene kadar KILITLI kalir."
      bilgi "Sonradan aktivasyon: license/license.lic dosyasini koyup calistirin:"
      bilgi "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec api npm run license:activate -- /license/license.lic"
      break
    fi
    if [ -f "$LIC_YOL" ]; then
      cp "$LIC_YOL" "$LIC_DOSYA"
      LISANS_VAR=1
      ok "Lisans kopyalandi: $LIC_DOSYA"
    else
      hata "Dosya bulunamadi: $LIC_YOL - tekrar deneyin."
    fi
  done
fi

# --- ADIM 5: Yapilandirma (.env.prod) ----------------------------------------------
adim 5 "Yapilandirma ($ENV_FILE)"

rastgele_sifre() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '+/=\n' | cut -c1-48
  else
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48
  fi
}

env_oku() { # $1=anahtar
  grep -E "^$1=" "$ROOT/$ENV_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2-
}

ENV_YAZ=1
HTTP_PORT=80
if [ -f "$ROOT/$ENV_FILE" ]; then
  uyari "Mevcut bir $ENV_FILE dosyasi bulundu (guncelleme modu)."
  if evet_hayir "Yapilandirmayi yeniden olusturmak ister misiniz?" "H"; then
    ENV_YAZ=1
  else
    ENV_YAZ=0
    ESKI_PORT="$(env_oku HTTP_PORT)"
    if [ -n "$ESKI_PORT" ]; then HTTP_PORT="$ESKI_PORT"; fi
    ok "Mevcut yapilandirma korunuyor (HTTP portu: $HTTP_PORT)."
    # Parmak izi eksikse tamamla
    if [ -z "$(env_oku PROMETA_FINGERPRINT)" ]; then
      printf 'PROMETA_FINGERPRINT=%s\n' "$FINGERPRINT" >> "$ROOT/$ENV_FILE"
      ok "PROMETA_FINGERPRINT mevcut dosyaya eklendi."
    fi
  fi
fi

if [ "$ENV_YAZ" -eq 1 ]; then
  printf "  Web arayuzu HTTP portu [80]: "
  read -r PORT_GIRDI
  if [ -n "$PORT_GIRDI" ]; then HTTP_PORT="$PORT_GIRDI"; else HTTP_PORT=80; fi
  case "$HTTP_PORT" in (*[!0-9]*|'') HTTP_PORT=80 ;; esac
  ok "HTTP portu: $HTTP_PORT"

  bilgi "E-posta (SMTP) ayarlari opsiyoneldir; bos gecilebilir."
  printf "  SMTP sunucusu (bos = kapali): "
  read -r SMTP_HOST
  SMTP_PORT=587; SMTP_USER=""; SMTP_PASS=""; SMTP_FROM="Prometa One <noreply@prometahr.com>"; SMTP_SECURE=false
  EMAIL_PROVIDER=console
  if [ -n "$SMTP_HOST" ]; then
    EMAIL_PROVIDER=smtp
    printf "  SMTP portu [587]: "; read -r G; if [ -n "$G" ]; then SMTP_PORT="$G"; fi
    printf "  SMTP kullanici adi: "; read -r SMTP_USER
    printf "  SMTP sifresi: "; read -r SMTP_PASS
    printf "  Gonderen adresi [%s]: " "$SMTP_FROM"; read -r G; if [ -n "$G" ]; then SMTP_FROM="$G"; fi
    if [ "$SMTP_PORT" = "465" ]; then SMTP_SECURE=true; fi
  fi

  # Gizli anahtarlar: mevcutsa koru secenegi
  PG_SIFRE=""; JWT_S=""; JWT_R=""
  if [ -n "$(env_oku POSTGRES_PASSWORD)" ]; then
    if evet_hayir "Mevcut gizli anahtarlar (DB sifresi / JWT) KORUNSUN mu? (Onerilen: Evet)" "E"; then
      PG_SIFRE="$(env_oku POSTGRES_PASSWORD)"
      JWT_S="$(env_oku JWT_SECRET)"
      JWT_R="$(env_oku JWT_REFRESH_SECRET)"
      ok "Mevcut gizli anahtarlar korundu."
    else
      uyari "DIKKAT: DB sifresi degisirse mevcut veritabani volume'una baglanti kopar."
    fi
  fi
  if [ -z "$PG_SIFRE" ]; then PG_SIFRE="$(rastgele_sifre)"; fi
  if [ -z "$JWT_S" ]; then JWT_S="$(rastgele_sifre)"; fi
  if [ -z "$JWT_R" ]; then JWT_R="$(rastgele_sifre)"; fi

  # CORS/APP_URL: localhost + sunucu IP'leri
  if [ "$HTTP_PORT" = "80" ]; then PORT_EKI=""; else PORT_EKI=":$HTTP_PORT"; fi
  CORS="http://localhost$PORT_EKI"
  for IP in $(hostname -I 2>/dev/null); do
    case "$IP" in
      127.*|169.254.*|*:*) ;; # loopback / link-local / IPv6 atla
      *) CORS="$CORS,http://$IP$PORT_EKI" ;;
    esac
  done
  APP_URL="http://localhost$PORT_EKI"

  {
    echo "# ============================================================="
    echo "# PROMETA ONE - uretim ortam degiskenleri"
    echo "# Kurulum sihirbazi tarafindan uretildi: $(date '+%Y-%m-%d %H:%M')"
    echo "# BU DOSYAYI YEDEKLEYIN ve kimseyle paylasmayin (sifreler icerir)."
    echo "# ============================================================="
    echo "HTTP_PORT=$HTTP_PORT"
    echo "POSTGRES_PASSWORD=$PG_SIFRE"
    echo "JWT_SECRET=$JWT_S"
    echo "JWT_REFRESH_SECRET=$JWT_R"
    echo "PROMETA_FINGERPRINT=$FINGERPRINT"
    echo "CORS_ORIGINS=$CORS"
    echo "APP_URL=$APP_URL"
    echo "EMAIL_PROVIDER=$EMAIL_PROVIDER"
    echo "SMTP_HOST=$SMTP_HOST"
    echo "SMTP_PORT=$SMTP_PORT"
    echo "SMTP_USER=$SMTP_USER"
    echo "SMTP_PASS=$SMTP_PASS"
    echo "SMTP_FROM=$SMTP_FROM"
    echo "SMTP_SECURE=$SMTP_SECURE"
    echo "# Santiye (construction) profili acilirsa: KAFKA_BROKERS=kafka:9092"
    echo "KAFKA_BROKERS="
  } > "$ROOT/$ENV_FILE"
  chmod 600 "$ROOT/$ENV_FILE"
  ok "$ENV_FILE yazildi (izinler: 600)."
fi

# --- ADIM 6: Kurulum (image yukle / build) + baslat ---------------------------------
adim 6 "Uygulama Kurulumu"
IMAGE_TAR="$ROOT/images/prometa-one-images.tar"
if [ -f "$IMAGE_TAR" ]; then
  bilgi "Musteri paketi modu: hazir image arsivi yukleniyor (docker load)..."
  if ! docker load -i "$IMAGE_TAR"; then
    hata "Image arsivi yuklenemedi. Paket bozuk olabilir - yeniden kopyalayip deneyin."
    exit 1
  fi
  ok "Image'lar yuklendi."
else
  bilgi "Kaynak modu: image'lar yerelde derleniyor (ilk derleme 10-20 dk surebilir)..."
  if ! compose build; then
    hata "Derleme basarisiz. Internet baglantisini ve disk alanini kontrol edin."
    exit 1
  fi
  ok "Derleme tamamlandi."
fi

bilgi "Servisler baslatiliyor (docker compose up -d)..."
if ! compose up -d; then
  hata "Servisler baslatilamadi."
  bilgi "Cozum: $HTTP_PORT portu baska bir uygulama tarafindan kullaniliyor olabilir."
  bilgi "Log: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs"
  exit 1
fi
ok "Servisler baslatildi (postgres, api, web, ml-service)."

# --- ADIM 7: Migration + seed --------------------------------------------------------
adim 7 "Veritabani Hazirligi (Migration)"
MIGRATE_OK=0
for DENEME in 1 2 3; do
  if compose exec -T api npm run migrate; then
    MIGRATE_OK=1
    break
  fi
  uyari "Migration denemesi $DENEME/3 basarisiz - API'nin acilmasi bekleniyor..."
  sleep 10
done
if [ "$MIGRATE_OK" -eq 1 ]; then
  ok "Veritabani semasi guncel (migration tamam)."
else
  hata "Migration calistirilamadi. Birkac dakika sonra elle deneyin:"
  bilgi "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE exec api npm run migrate"
fi

if evet_hayir "Ilk kurulum mu? Baslangic verileri (seed) yuklensin mi?" "H"; then
  if compose exec -T api npm run seed; then
    ok "Baslangic verileri yuklendi."
  else
    uyari "Seed calistirilamadi (mevcut kurulumda tekrar gerekmez)."
  fi
fi

# --- ADIM 8: Lisans aktivasyonu --------------------------------------------------------
adim 8 "Lisans Aktivasyonu"
if [ -f "$LIC_DOSYA" ]; then
  if compose exec -T api npm run license:activate -- /license/license.lic; then
    ok "Lisans aktive edildi."
    bilgi "Durum sorgusu: http://localhost:$HTTP_PORT/v1/license/status"
  else
    uyari "Lisans aktivasyonu basarisiz."
    bilgi "Olasi nedenler: lisans baska makine icin uretilmis, suresi dolmus veya dosya bozuk."
    bilgi "Bu makinenin Donanim Kimligi: $FINGERPRINT"
  fi
else
  uyari "Lisans dosyasi yok - aktivasyon atlandi. Uygulama lisans yuklenene kadar kilitlidir."
fi

# --- ADIM 9: Guvenlik duvari -------------------------------------------------------------
adim 9 "Guvenlik Duvari"
if command -v ufw >/dev/null 2>&1; then
  ufw allow "$HTTP_PORT/tcp" >/dev/null 2>&1
  ok "ufw: gelen TCP $HTTP_PORT izni eklendi."
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="$HTTP_PORT/tcp" >/dev/null 2>&1
  firewall-cmd --reload >/dev/null 2>&1
  ok "firewalld: gelen TCP $HTTP_PORT izni eklendi."
else
  uyari "ufw/firewalld bulunamadi. Terminaller baglanamazsa $HTTP_PORT portunu elle acin."
fi

# --- ADIM 10: Saglik + ozet ----------------------------------------------------------------
adim 10 "Saglik Kontrolu"
SAGLIK_URL="http://localhost:$HTTP_PORT/v1/health"
bilgi "$SAGLIK_URL kontrol ediliyor (en fazla 60 sn)..."
SAGLIKLI=0
SON=$(( $(date +%s) + 60 ))
while [ "$(date +%s)" -lt "$SON" ]; do
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS -m 5 "$SAGLIK_URL" >/dev/null 2>&1; then SAGLIKLI=1; break; fi
  else
    if wget -q -T 5 -O /dev/null "$SAGLIK_URL" 2>/dev/null; then SAGLIKLI=1; break; fi
  fi
  sleep 3
done

if [ "$SAGLIKLI" -eq 1 ]; then
  ok "Sistem SAGLIKLI - kurulum tamamlandi!"
else
  uyari "Saglik kontrolu 60 saniyede yanit vermedi. Servisler hala aciliyor olabilir."
  bilgi "Log: docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs api"
fi

if [ "$HTTP_PORT" = "80" ]; then PORT_EKI2=""; else PORT_EKI2=":$HTTP_PORT"; fi
printf "\n"
printf "  ${C_GREEN}=====================================================${C_RESET}\n"
printf "  ${C_GREEN} KURULUM OZETI${C_RESET}\n"
printf "  ${C_GREEN}=====================================================${C_RESET}\n"
printf "   Donanim Kimligi : %s\n" "$FINGERPRINT"
printf "   Web arayuzu     : http://localhost%s\n" "$PORT_EKI2"
printf "\n   Bu sunucunun ag adresleri (terminaller icin):\n"
for IP in $(hostname -I 2>/dev/null); do
  case "$IP" in
    127.*|169.254.*|*:*) ;;
    *) printf "     ${C_CYAN}http://%s%s${C_RESET}\n" "$IP" "$PORT_EKI2" ;;
  esac
done
printf "\n   TERMINAL KURULUMU:\n"
printf "   Windows terminallerde install\\\\Kurulum-Terminal.bat calistirin ve\n"
printf "   yukaridaki adreslerden birini girin. (Docker GEREKMEZ.)\n"
printf "\n   Ayrintili bilgi: install/KURULUM_KILAVUZU.md\n"
printf "  ${C_GREEN}=====================================================${C_RESET}\n\n"

/**
 * Prometa One — Lisans Katmanı (framework'süz vanilla JS)
 * --------------------------------------------------------
 * 1) Terminal kimliği üretir (localStorage) ve window.fetch'i sararak tüm /v1
 *    isteklerine X-Terminal-Id / X-Terminal-Name header'larını ekler.
 * 2) Sayfa açılışında GET /v1/license/status çağırır:
 *      - backend eski/erişilemez → HİÇBİR ŞEY yapmaz (mevcut davranış korunur)
 *      - valid=false            → tam ekran bloklayıcı overlay
 *      - valid=true & daysLeft<=14 → sağ altta kapatılabilir uyarı bandı
 * 3) Fetch yanıtlarını gözler: 403 + body.error 'license_*' → overlay açılır.
 * 4) Overlay içinde yönetici girişi + lisans dosyası (.lic/.json) ile
 *    POST /v1/license/activate akışı vardır.
 *
 * Backend sözleşmesi:
 *   GET  /v1/license/status  → { valid, reason?, customer?, validUntil?, daysLeft?,
 *                                maxTerminals?, terminalsUsed? }
 *   POST /v1/auth/login      → { accessToken, ... }  (App.jsx ile aynı şema)
 *   POST /v1/license/activate (Bearer) body { license: <json> } → { ok, status } | 400 { message }
 *
 * Tüm metinler TR/EN/DE/AR; Arapça'da overlay/band dir="rtl" alır.
 * App CSS'ine bağımlılık YOKTUR (inline stiller).
 */

(function initPrometaLicense() {
  if (typeof window === 'undefined') return;
  if (window.__PROMETA_LICENSE_INIT__) return; // HMR / çift import koruması
  window.__PROMETA_LICENSE_INIT__ = true;

  /* =====================================================================
     ÇEVİRİLER — tr / en / de / ar
  ===================================================================== */
  const MESSAGES = {
    tr: {
      brand: 'Prometa One',
      kicker: 'Lisans Doğrulaması',
      reason_missing_title: 'Lisans yüklü değil',
      reason_missing_desc:
        'Bu sunucuda etkin bir lisans bulunamadı. Devam etmek için lisans dosyanızı yükleyin.',
      reason_invalid_signature_title: 'Lisans geçersiz',
      reason_invalid_signature_desc:
        'Lisans dosyasının imzası doğrulanamadı. Lütfen geçerli bir lisans dosyası yükleyin.',
      reason_invalid_title: 'Lisans geçersiz',
      reason_invalid_desc: 'Lisansınız doğrulanamadı. Lütfen geçerli bir lisans dosyası yükleyin.',
      reason_expired_title: 'Lisans süresi doldu',
      reason_expired_desc:
        'Lisans süresi doldu (bitiş: {date}). Devam etmek için yeni lisans dosyanızı yükleyin.',
      reason_expired_desc_nodate:
        'Lisansınızın geçerlilik süresi sona erdi. Devam etmek için yeni lisans dosyanızı yükleyin.',
      reason_not_yet_valid_title: 'Lisans henüz geçerli değil',
      reason_not_yet_valid_desc:
        'Lisansın başlangıç tarihi henüz gelmedi. Sunucu saatini kontrol edin veya geçerli bir lisans yükleyin.',
      reason_fingerprint_mismatch_title: 'Lisans bu sunucuya ait değil',
      reason_fingerprint_mismatch_desc:
        'Lisans dosyası farklı bir sunucu için düzenlenmiş. Bu sunucuya ait lisans dosyasını yükleyin.',
      reason_wrong_product_title: 'Lisans farklı bir ürüne ait',
      reason_wrong_product_desc:
        'Yüklenen lisans Prometa One için düzenlenmemiş. Lütfen doğru ürün lisansını yükleyin.',
      reason_seat_limit_title: 'Terminal limiti aşıldı',
      reason_seat_limit_desc: 'Terminal limiti aşıldı — yöneticinizle görüşün.',
      seat_usage: 'Kullanılan terminal: {used}/{max}',
      customer_label: 'Lisans sahibi',
      form_username: 'Yönetici kullanıcı adı',
      form_password: 'Şifre',
      form_file: 'Lisans dosyası (.lic / .json)',
      form_file_empty: 'Dosya seçilmedi',
      form_file_choose: 'Dosya Seç',
      btn_upload: 'Lisansı Yükle',
      btn_uploading: 'Yükleniyor…',
      btn_retry: 'Yeniden Dene',
      btn_retrying: 'Denetleniyor…',
      err_creds_required: 'Kullanıcı adı ve şifre gerekli.',
      err_file_required: 'Lütfen bir lisans dosyası seçin.',
      err_file_invalid: 'Lisans dosyası okunamadı — geçerli bir dosya seçin.',
      err_login_failed: 'Giriş başarısız — kullanıcı adı veya şifreyi kontrol edin.',
      err_activate_failed: 'Lisans yüklenemedi.',
      err_still_invalid: 'Lisans hâlâ geçersiz görünüyor.',
      err_network: 'Sunucuya ulaşılamadı — bağlantınızı kontrol edin.',
      ok_activated: 'Lisans yüklendi. Uygulama yeniden başlatılıyor…',
      banner_days_left: 'Lisansınızın bitmesine {days} gün kaldı',
      banner_close: 'Kapat',
    },
    en: {
      brand: 'Prometa One',
      kicker: 'License Verification',
      reason_missing_title: 'No license installed',
      reason_missing_desc:
        'No active license was found on this server. Upload your license file to continue.',
      reason_invalid_signature_title: 'License invalid',
      reason_invalid_signature_desc:
        'The signature of the license file could not be verified. Please upload a valid license file.',
      reason_invalid_title: 'License invalid',
      reason_invalid_desc:
        'Your license could not be validated. Please upload a valid license file.',
      reason_expired_title: 'License expired',
      reason_expired_desc:
        'The license has expired (end date: {date}). Upload a new license file to continue.',
      reason_expired_desc_nodate:
        'Your license has expired. Upload a new license file to continue.',
      reason_not_yet_valid_title: 'License not yet valid',
      reason_not_yet_valid_desc:
        'The license start date has not been reached yet. Check the server clock or upload a valid license.',
      reason_fingerprint_mismatch_title: 'License does not belong to this server',
      reason_fingerprint_mismatch_desc:
        'The license file was issued for a different server. Upload the license file issued for this server.',
      reason_wrong_product_title: 'License belongs to a different product',
      reason_wrong_product_desc:
        'The installed license was not issued for Prometa One. Please upload the correct product license.',
      reason_seat_limit_title: 'Terminal limit exceeded',
      reason_seat_limit_desc:
        'The terminal limit has been exceeded — please contact your administrator.',
      seat_usage: 'Terminals in use: {used}/{max}',
      customer_label: 'Licensed to',
      form_username: 'Administrator username',
      form_password: 'Password',
      form_file: 'License file (.lic / .json)',
      form_file_empty: 'No file selected',
      form_file_choose: 'Choose File',
      btn_upload: 'Upload License',
      btn_uploading: 'Uploading…',
      btn_retry: 'Try Again',
      btn_retrying: 'Checking…',
      err_creds_required: 'Username and password are required.',
      err_file_required: 'Please select a license file.',
      err_file_invalid: 'The license file could not be read — please select a valid file.',
      err_login_failed: 'Sign-in failed — check the username or password.',
      err_activate_failed: 'The license could not be installed.',
      err_still_invalid: 'The license still appears to be invalid.',
      err_network: 'The server could not be reached — check your connection.',
      ok_activated: 'License installed. Restarting the application…',
      banner_days_left: 'Your license expires in {days} days',
      banner_close: 'Close',
    },
    de: {
      brand: 'Prometa One',
      kicker: 'Lizenzprüfung',
      reason_missing_title: 'Keine Lizenz installiert',
      reason_missing_desc:
        'Auf diesem Server wurde keine aktive Lizenz gefunden. Laden Sie Ihre Lizenzdatei hoch, um fortzufahren.',
      reason_invalid_signature_title: 'Lizenz ungültig',
      reason_invalid_signature_desc:
        'Die Signatur der Lizenzdatei konnte nicht überprüft werden. Bitte laden Sie eine gültige Lizenzdatei hoch.',
      reason_invalid_title: 'Lizenz ungültig',
      reason_invalid_desc:
        'Ihre Lizenz konnte nicht validiert werden. Bitte laden Sie eine gültige Lizenzdatei hoch.',
      reason_expired_title: 'Lizenz abgelaufen',
      reason_expired_desc:
        'Die Lizenz ist abgelaufen (Ablaufdatum: {date}). Laden Sie eine neue Lizenzdatei hoch, um fortzufahren.',
      reason_expired_desc_nodate:
        'Ihre Lizenz ist abgelaufen. Laden Sie eine neue Lizenzdatei hoch, um fortzufahren.',
      reason_not_yet_valid_title: 'Lizenz noch nicht gültig',
      reason_not_yet_valid_desc:
        'Das Startdatum der Lizenz wurde noch nicht erreicht. Prüfen Sie die Serveruhr oder laden Sie eine gültige Lizenz hoch.',
      reason_fingerprint_mismatch_title: 'Lizenz gehört nicht zu diesem Server',
      reason_fingerprint_mismatch_desc:
        'Die Lizenzdatei wurde für einen anderen Server ausgestellt. Laden Sie die für diesen Server ausgestellte Lizenzdatei hoch.',
      reason_wrong_product_title: 'Lizenz gehört zu einem anderen Produkt',
      reason_wrong_product_desc:
        'Die installierte Lizenz wurde nicht für Prometa One ausgestellt. Bitte laden Sie die richtige Produktlizenz hoch.',
      reason_seat_limit_title: 'Terminal-Limit überschritten',
      reason_seat_limit_desc:
        'Das Terminal-Limit wurde überschritten — wenden Sie sich bitte an Ihren Administrator.',
      seat_usage: 'Verwendete Terminals: {used}/{max}',
      customer_label: 'Lizenziert für',
      form_username: 'Administrator-Benutzername',
      form_password: 'Passwort',
      form_file: 'Lizenzdatei (.lic / .json)',
      form_file_empty: 'Keine Datei ausgewählt',
      form_file_choose: 'Datei auswählen',
      btn_upload: 'Lizenz hochladen',
      btn_uploading: 'Wird hochgeladen…',
      btn_retry: 'Erneut versuchen',
      btn_retrying: 'Wird geprüft…',
      err_creds_required: 'Benutzername und Passwort sind erforderlich.',
      err_file_required: 'Bitte wählen Sie eine Lizenzdatei aus.',
      err_file_invalid:
        'Die Lizenzdatei konnte nicht gelesen werden — bitte wählen Sie eine gültige Datei.',
      err_login_failed: 'Anmeldung fehlgeschlagen — prüfen Sie Benutzername oder Passwort.',
      err_activate_failed: 'Die Lizenz konnte nicht installiert werden.',
      err_still_invalid: 'Die Lizenz scheint weiterhin ungültig zu sein.',
      err_network: 'Der Server ist nicht erreichbar — prüfen Sie Ihre Verbindung.',
      ok_activated: 'Lizenz installiert. Die Anwendung wird neu gestartet…',
      banner_days_left: 'Ihre Lizenz läuft in {days} Tagen ab',
      banner_close: 'Schließen',
    },
    ar: {
      brand: 'Prometa One',
      kicker: 'التحقق من الرخصة',
      reason_missing_title: 'لا توجد رخصة مثبّتة',
      reason_missing_desc:
        'لم يتم العثور على رخصة سارية على هذا الخادم. يرجى تحميل ملف الرخصة للمتابعة.',
      reason_invalid_signature_title: 'الرخصة غير صالحة',
      reason_invalid_signature_desc: 'تعذّر التحقق من توقيع ملف الرخصة. يرجى تحميل ملف رخصة صالح.',
      reason_invalid_title: 'الرخصة غير صالحة',
      reason_invalid_desc: 'تعذّر التحقق من صلاحية رخصتكم. يرجى تحميل ملف رخصة صالح.',
      reason_expired_title: 'انتهت صلاحية الرخصة',
      reason_expired_desc:
        'انتهت صلاحية الرخصة (تاريخ الانتهاء: {date}). يرجى تحميل ملف رخصة جديد للمتابعة.',
      reason_expired_desc_nodate: 'انتهت صلاحية رخصتكم. يرجى تحميل ملف رخصة جديد للمتابعة.',
      reason_not_yet_valid_title: 'الرخصة لم تصبح سارية بعد',
      reason_not_yet_valid_desc:
        'لم يحن تاريخ بدء سريان الرخصة بعد. تحقق من ساعة الخادم أو قم بتحميل رخصة سارية.',
      reason_fingerprint_mismatch_title: 'الرخصة لا تخص هذا الخادم',
      reason_fingerprint_mismatch_desc:
        'صدر ملف الرخصة لخادم آخر. يرجى تحميل ملف الرخصة الصادر لهذا الخادم.',
      reason_wrong_product_title: 'الرخصة تخص منتجًا آخر',
      reason_wrong_product_desc:
        'الرخصة المثبّتة لم تصدر لمنتج Prometa One. يرجى تحميل رخصة المنتج الصحيحة.',
      reason_seat_limit_title: 'تم تجاوز حد الأجهزة الطرفية',
      reason_seat_limit_desc: 'تم تجاوز حد الأجهزة الطرفية — يرجى التواصل مع مسؤول النظام.',
      seat_usage: 'الأجهزة الطرفية المستخدمة: {used}/{max}',
      customer_label: 'الرخصة باسم',
      form_username: 'اسم مستخدم المسؤول',
      form_password: 'كلمة المرور',
      form_file: 'ملف الرخصة ‎(.lic / .json)',
      form_file_empty: 'لم يتم اختيار ملف',
      form_file_choose: 'اختيار ملف',
      btn_upload: 'تحميل الرخصة',
      btn_uploading: 'جارٍ التحميل…',
      btn_retry: 'إعادة المحاولة',
      btn_retrying: 'جارٍ التحقق…',
      err_creds_required: 'اسم المستخدم وكلمة المرور مطلوبان.',
      err_file_required: 'يرجى اختيار ملف الرخصة.',
      err_file_invalid: 'تعذّرت قراءة ملف الرخصة — يرجى اختيار ملف صالح.',
      err_login_failed: 'فشل تسجيل الدخول — تحقق من اسم المستخدم أو كلمة المرور.',
      err_activate_failed: 'تعذّر تثبيت الرخصة.',
      err_still_invalid: 'لا تزال الرخصة تبدو غير صالحة.',
      err_network: 'تعذّر الوصول إلى الخادم — تحقق من اتصالك بالشبكة.',
      ok_activated: 'تم تثبيت الرخصة. جارٍ إعادة تشغيل التطبيق…',
      banner_days_left: 'تنتهي صلاحية رخصتكم خلال {days} يومًا',
      banner_close: 'إغلاق',
    },
  };

  const DATE_LOCALES = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', ar: 'ar' };

  function getLang() {
    try {
      const w = window.__PROMETA_LANG__;
      if (w && MESSAGES[w]) return w;
    } catch {
      /* yoksay */
    }
    try {
      // App.jsx S katmanı JSON.stringify ile yazar → JSON.parse gerekli
      const raw = window.localStorage.getItem('promet:lang');
      if (raw) {
        let v = raw;
        try {
          v = JSON.parse(raw);
        } catch {
          /* düz string olabilir */
        }
        if (v && MESSAGES[v]) return v;
      }
    } catch {
      /* yoksay */
    }
    return 'tr';
  }

  function t(key, params) {
    const lang = getLang();
    const dict = MESSAGES[lang] || MESSAGES.tr;
    let text = dict[key] != null ? dict[key] : MESSAGES.tr[key] != null ? MESSAGES.tr[key] : key;
    if (params) {
      Object.keys(params).forEach((p) => {
        text = text.split('{' + p + '}').join(String(params[p]));
      });
    }
    return text;
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString(DATE_LOCALES[getLang()] || 'tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return String(value);
    }
  }

  /* =====================================================================
     1) TERMİNAL KİMLİĞİ
  ===================================================================== */
  const TERMINAL_ID_KEY = 'prometa:terminalId';
  const TERMINAL_NAME_KEY = 'prometa:terminalName';
  const memStore = {}; // localStorage erişilemezse oturum içi yedek

  function lsGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memStore[key] || null;
    }
  }
  function lsSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memStore[key] = value;
    }
  }

  function generateUuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch {
      /* aşağıdaki yedeğe düş */
    }
    // RFC4122 v4 yedeği
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getTerminalId() {
    let id = lsGet(TERMINAL_ID_KEY);
    if (!id) {
      id = generateUuid();
      lsSet(TERMINAL_ID_KEY, id);
    }
    return id;
  }

  function getTerminalName() {
    let name = lsGet(TERMINAL_NAME_KEY);
    if (!name) {
      name = 'Terminal-' + getTerminalId().slice(0, 4);
      lsSet(TERMINAL_NAME_KEY, name);
    }
    return name;
  }

  // Kimliği hemen üret (ilk /v1 isteğinden önce hazır olsun)
  getTerminalId();
  getTerminalName();

  /* =====================================================================
     window.fetch MONKEY-PATCH — /v1 isteklerine terminal header'ları +
     403 license_* yanıt gözlemi
  ===================================================================== */
  function isV1Url(url) {
    if (!url) return false;
    if (typeof url !== 'string') return false;
    if (url === '/v1' || url.indexOf('/v1/') === 0) return true; // göreli
    try {
      const u = new URL(url, window.location.origin);
      return (
        u.origin === window.location.origin &&
        (u.pathname === '/v1' || u.pathname.indexOf('/v1/') === 0)
      );
    } catch {
      return false;
    }
  }

  function extractUrl(input) {
    try {
      if (typeof input === 'string') return input;
      if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
      if (input && typeof input.url === 'string') return input.url; // Request objesi
    } catch {
      /* yoksay */
    }
    return '';
  }

  function inspectLicenseResponse(res) {
    try {
      if (!res || res.status !== 403) return;
      if (overlayVisible()) return; // zaten açık
      const ct = res.headers && res.headers.get ? res.headers.get('content-type') || '' : '';
      if (ct.indexOf('json') === -1) return;
      res
        .clone()
        .json()
        .then((body) => {
          const code = body && body.error;
          if (typeof code !== 'string' || code.indexOf('license_') !== 0) return;
          if (code === 'license_seat_limit') {
            showOverlay({ valid: false, reason: 'seat_limit' });
          } else if (code === 'license_expired') {
            showOverlay({ valid: false, reason: 'expired' });
          } else {
            showOverlay({ valid: false, reason: 'invalid' });
          }
        })
        .catch(() => {
          /* gövde okunamadı — yoksay */
        });
    } catch {
      /* asla uygulamayı bozma */
    }
  }

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (originalFetch) {
    window.fetch = function patchedFetch(input, init) {
      let patchedInput = input;
      let patchedInit = init;
      let watch = false;
      try {
        const url = extractUrl(input);
        if (isV1Url(url)) {
          watch = true;
          const tid = getTerminalId();
          const tname = encodeURIComponent(getTerminalName());
          if (typeof Request !== 'undefined' && input instanceof Request) {
            // Request objesi: init ile birleştir, header'ları ezmeden ekle
            const merged = init ? new Request(input, init) : input;
            const headers = new Headers(merged.headers);
            if (!headers.has('X-Terminal-Id')) headers.set('X-Terminal-Id', tid);
            if (!headers.has('X-Terminal-Name')) headers.set('X-Terminal-Name', tname);
            patchedInput = new Request(merged, { headers });
            patchedInit = undefined;
          } else {
            const headers = new Headers((init && init.headers) || undefined);
            if (!headers.has('X-Terminal-Id')) headers.set('X-Terminal-Id', tid);
            if (!headers.has('X-Terminal-Name')) headers.set('X-Terminal-Name', tname);
            patchedInit = Object.assign({}, init, { headers });
          }
        }
      } catch {
        // Header eklenemezse isteği olduğu gibi geçir — uygulama akışı bozulmasın
        patchedInput = input;
        patchedInit = init;
      }
      const promise = originalFetch(patchedInput, patchedInit);
      if (!watch) return promise;
      return promise.then((res) => {
        inspectLicenseResponse(res);
        return res;
      });
    };
  }

  /* =====================================================================
     ORTAK UI YARDIMCILARI (inline stil, app CSS bağımsız)
  ===================================================================== */
  const COLORS = {
    backdrop: 'radial-gradient(1100px 700px at 50% 18%, #10233f 0%, #060d1a 62%)',
    card: '#0b1728',
    cardBorder: 'rgba(16,185,129,0.28)',
    text: '#e2e8f0',
    textDim: '#94a3b8',
    accent: '#10b981',
    accentDark: '#0c8f6f',
    danger: '#f87171',
    inputBg: '#0f2036',
    inputBorder: '#22405f',
  };
  const FONT_STACK = "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

  function el(tag, styles, attrs) {
    const node = document.createElement(tag);
    if (styles) Object.assign(node.style, styles);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function whenBodyReady(fn) {
    if (document.body) {
      fn();
      return;
    }
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  /* =====================================================================
     2) BLOKLAYICI OVERLAY
  ===================================================================== */
  const OVERLAY_ID = 'prometa-license-overlay';
  const BANNER_ID = 'prometa-license-banner';

  function overlayVisible() {
    return !!document.getElementById(OVERLAY_ID);
  }

  function removeOverlay() {
    const node = document.getElementById(OVERLAY_ID);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function reasonKeys(status) {
    const reason = (status && status.reason) || 'invalid';
    const known = [
      'missing',
      'invalid_signature',
      'expired',
      'not_yet_valid',
      'fingerprint_mismatch',
      'wrong_product',
      'seat_limit',
      'invalid',
    ];
    const r = known.indexOf(reason) !== -1 ? reason : 'invalid';
    return { titleKey: 'reason_' + r + '_title', descKey: 'reason_' + r + '_desc', reason: r };
  }

  function buildDescription(status, rk) {
    if (rk.reason === 'expired') {
      const date = formatDate(status && status.validUntil);
      return date ? t('reason_expired_desc', { date }) : t('reason_expired_desc_nodate');
    }
    return t(rk.descKey);
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('read_error'));
      reader.readAsText(file);
    });
  }

  function showOverlay(status) {
    whenBodyReady(() => {
      removeBanner(); // overlay açıkken uyarı bandına gerek yok
      renderOverlay(status || { valid: false, reason: 'invalid' });
    });
  }

  function renderOverlay(status) {
    removeOverlay();
    const lang = getLang();
    const isRtl = lang === 'ar';
    const rk = reasonKeys(status);
    const isSeatLimit = rk.reason === 'seat_limit';

    const overlay = el(
      'div',
      {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483000',
        background: COLORS.backdrop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflow: 'auto',
        fontFamily: FONT_STACK,
        color: COLORS.text,
        textAlign: 'start',
      },
      { id: OVERLAY_ID, dir: isRtl ? 'rtl' : 'ltr', role: 'alertdialog', 'aria-modal': 'true' },
    );

    const card = el('div', {
      width: '100%',
      maxWidth: '440px',
      background: COLORS.card,
      border: '1px solid ' + COLORS.cardBorder,
      borderRadius: '16px',
      boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
      padding: '32px 32px 28px',
      boxSizing: 'border-box',
    });

    // Logo + alt başlık
    const brandRow = el('div', { marginBottom: '20px' });
    const brand = el(
      'div',
      {
        fontSize: '22px',
        fontWeight: '700',
        letterSpacing: '0.4px',
      },
      { text: '' },
    );
    const brandPro = el('span', { color: COLORS.text }, { text: 'Prometa ' });
    const brandOne = el('span', { color: COLORS.accent }, { text: 'One' });
    brand.appendChild(brandPro);
    brand.appendChild(brandOne);
    const kicker = el(
      'div',
      {
        marginTop: '4px',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        color: COLORS.textDim,
      },
      { text: t('kicker') },
    );
    brandRow.appendChild(brand);
    brandRow.appendChild(kicker);
    card.appendChild(brandRow);

    // Durum başlığı + açıklama
    const title = el(
      'div',
      {
        fontSize: '18px',
        fontWeight: '600',
        color: '#fbbf24',
        marginBottom: '8px',
      },
      { text: t(rk.titleKey) },
    );
    const desc = el(
      'div',
      {
        fontSize: '14px',
        lineHeight: '1.55',
        color: COLORS.textDim,
        marginBottom: '18px',
      },
      { text: buildDescription(status, rk) },
    );
    card.appendChild(title);
    card.appendChild(desc);

    // Lisans sahibi (varsa)
    if (status && status.customer) {
      const cust = el(
        'div',
        {
          fontSize: '13px',
          color: COLORS.textDim,
          marginBottom: '14px',
        },
        { text: t('customer_label') + ': ' + status.customer },
      );
      card.appendChild(cust);
    }

    // Seat limit bilgisi
    if (isSeatLimit && status && (status.terminalsUsed != null || status.maxTerminals != null)) {
      const seats = el(
        'div',
        {
          fontSize: '14px',
          fontWeight: '600',
          color: COLORS.text,
          background: COLORS.inputBg,
          border: '1px solid ' + COLORS.inputBorder,
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '18px',
        },
        {
          text: t('seat_usage', {
            used: status.terminalsUsed != null ? status.terminalsUsed : '?',
            max: status.maxTerminals != null ? status.maxTerminals : '?',
          }),
        },
      );
      card.appendChild(seats);
    }

    // Mesaj alanı (hata/başarı)
    const msgBox = el('div', {
      display: 'none',
      fontSize: '13px',
      lineHeight: '1.5',
      borderRadius: '8px',
      padding: '10px 12px',
      marginBottom: '14px',
    });
    function setMsg(text, kind) {
      msgBox.textContent = text;
      msgBox.style.display = 'block';
      if (kind === 'ok') {
        msgBox.style.color = '#6ee7b7';
        msgBox.style.background = 'rgba(16,185,129,0.12)';
        msgBox.style.border = '1px solid rgba(16,185,129,0.35)';
      } else {
        msgBox.style.color = COLORS.danger;
        msgBox.style.background = 'rgba(248,113,113,0.10)';
        msgBox.style.border = '1px solid rgba(248,113,113,0.35)';
      }
    }
    function clearMsg() {
      msgBox.style.display = 'none';
      msgBox.textContent = '';
    }

    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box',
      background: COLORS.inputBg,
      border: '1px solid ' + COLORS.inputBorder,
      borderRadius: '8px',
      color: COLORS.text,
      fontSize: '14px',
      fontFamily: FONT_STACK,
      padding: '10px 12px',
      outline: 'none',
      marginTop: '5px',
    };
    const labelStyle = {
      display: 'block',
      fontSize: '12px',
      fontWeight: '600',
      color: COLORS.textDim,
      marginBottom: '12px',
    };

    let userInput = null;
    let passInput = null;
    let selectedFile = null;
    let uploadBtn = null;
    let busy = false;

    // AKTİVASYON FORMU — seat_limit HARİÇ tüm durumlarda
    if (!isSeatLimit) {
      const form = el('form', { margin: '0 0 4px' });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
      });

      const userLabel = el('label', labelStyle, { text: t('form_username') });
      userInput = el('input', inputStyle, {
        type: 'text',
        autocomplete: 'username',
        name: 'prometa-license-user',
      });
      userLabel.appendChild(userInput);
      form.appendChild(userLabel);

      const passLabel = el('label', labelStyle, { text: t('form_password') });
      passInput = el('input', inputStyle, {
        type: 'password',
        autocomplete: 'current-password',
        name: 'prometa-license-pass',
      });
      passLabel.appendChild(passInput);
      form.appendChild(passLabel);

      // Dosya seçici (gizli input + buton + dosya adı)
      const fileLabel = el('div', labelStyle, { text: t('form_file') });
      const fileRow = el('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginTop: '5px',
      });
      const fileInput = el(
        'input',
        { display: 'none' },
        {
          type: 'file',
          accept: '.lic,.json,application/json',
        },
      );
      const fileBtn = el(
        'button',
        {
          background: 'transparent',
          border: '1px solid ' + COLORS.inputBorder,
          borderRadius: '8px',
          color: COLORS.text,
          fontSize: '13px',
          fontFamily: FONT_STACK,
          padding: '8px 14px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        },
        { type: 'button', text: t('form_file_choose') },
      );
      const fileName = el(
        'span',
        {
          fontSize: '13px',
          color: COLORS.textDim,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
        { text: t('form_file_empty') },
      );
      fileBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        fileName.textContent = selectedFile ? selectedFile.name : t('form_file_empty');
        fileName.style.color = selectedFile ? COLORS.text : COLORS.textDim;
        clearMsg();
      });
      fileRow.appendChild(fileBtn);
      fileRow.appendChild(fileName);
      form.appendChild(fileLabel);
      form.appendChild(fileRow);
      form.appendChild(fileInput);
      form.appendChild(el('div', { height: '14px' }));
      form.appendChild(msgBox);
      card.appendChild(form);
    } else {
      card.appendChild(msgBox);
    }

    // Butonlar
    const btnRow = el('div', {
      display: 'flex',
      gap: '10px',
      marginTop: '6px',
      flexWrap: 'wrap',
    });

    function makeButton(text, primary) {
      return el(
        'button',
        {
          flex: primary ? '1 1 auto' : '0 0 auto',
          background: primary ? COLORS.accent : 'transparent',
          border: primary ? '1px solid ' + COLORS.accent : '1px solid ' + COLORS.inputBorder,
          borderRadius: '8px',
          color: primary ? '#04241a' : COLORS.text,
          fontSize: '14px',
          fontWeight: '600',
          fontFamily: FONT_STACK,
          padding: '11px 18px',
          cursor: 'pointer',
        },
        { type: 'button', text },
      );
    }

    if (!isSeatLimit) {
      uploadBtn = makeButton(t('btn_upload'), true);
      uploadBtn.addEventListener('click', onUpload);
      btnRow.appendChild(uploadBtn);
    }
    const retryBtn = makeButton(t('btn_retry'), isSeatLimit);
    retryBtn.addEventListener('click', onRetry);
    btnRow.appendChild(retryBtn);
    card.appendChild(btnRow);

    function setBusy(next) {
      busy = next;
      if (uploadBtn) {
        uploadBtn.disabled = next;
        uploadBtn.style.opacity = next ? '0.6' : '1';
        uploadBtn.style.cursor = next ? 'default' : 'pointer';
        uploadBtn.textContent = next ? t('btn_uploading') : t('btn_upload');
      }
      retryBtn.disabled = next;
      retryBtn.style.opacity = next ? '0.6' : '1';
      retryBtn.style.cursor = next ? 'default' : 'pointer';
    }

    async function onUpload() {
      if (busy) return;
      clearMsg();
      const username = userInput ? userInput.value.trim() : '';
      const password = passInput ? passInput.value : '';
      if (!username || !password) {
        setMsg(t('err_creds_required'));
        return;
      }
      if (!selectedFile) {
        setMsg(t('err_file_required'));
        return;
      }

      let licenseJson;
      try {
        const text = await readFileText(selectedFile);
        licenseJson = JSON.parse(text);
      } catch {
        setMsg(t('err_file_invalid'));
        return;
      }

      setBusy(true);
      try {
        // 1) Yönetici girişi — App.jsx login şemasıyla birebir aynı
        let token = null;
        try {
          const loginRes = await window.fetch('/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          if (loginRes.ok) {
            const tokens = await loginRes.json().catch(() => null);
            token = tokens && tokens.accessToken ? tokens.accessToken : null;
          }
        } catch {
          setMsg(t('err_network'));
          return;
        }
        if (!token) {
          setMsg(t('err_login_failed'));
          return;
        }

        // 2) Lisansı etkinleştir
        let actRes;
        try {
          actRes = await window.fetch('/v1/license/activate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify({ license: licenseJson }),
          });
        } catch {
          setMsg(t('err_network'));
          return;
        }
        if (actRes.ok) {
          setMsg(t('ok_activated'), 'ok');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          const err = await actRes.json().catch(() => null);
          setMsg(err && err.message ? String(err.message) : t('err_activate_failed'));
        }
      } finally {
        setBusy(false);
      }
    }

    async function onRetry() {
      if (busy) return;
      clearMsg();
      retryBtn.textContent = t('btn_retrying');
      setBusy(true);
      try {
        const fresh = await fetchLicenseStatus();
        if (fresh && fresh.valid === true) {
          removeOverlay();
          window.location.reload();
          return;
        }
        if (fresh && fresh.valid === false) {
          // Sebep değişmiş olabilir — overlay'i güncel durumla yeniden çiz
          renderOverlay(fresh);
          return;
        }
        setMsg(fresh === null ? t('err_network') : t('err_still_invalid'));
      } finally {
        setBusy(false);
        retryBtn.textContent = t('btn_retry');
      }
    }

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  /* =====================================================================
     3) SÜRE UYARI BANDI (valid=true & daysLeft<=14)
  ===================================================================== */
  function removeBanner() {
    const node = document.getElementById(BANNER_ID);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  function showExpiryBanner(status) {
    whenBodyReady(() => {
      if (overlayVisible()) return;
      removeBanner();
      const lang = getLang();
      const isRtl = lang === 'ar';
      const days = Math.max(0, Number(status.daysLeft) || 0);

      const banner = el(
        'div',
        {
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: '2147482000',
          maxWidth: '340px',
          background: COLORS.card,
          border: '1px solid rgba(251,191,36,0.45)',
          borderRadius: '12px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          padding: '13px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          fontFamily: FONT_STACK,
          color: COLORS.text,
          fontSize: '13px',
          lineHeight: '1.5',
          textAlign: 'start',
        },
        { id: BANNER_ID, dir: isRtl ? 'rtl' : 'ltr', role: 'status' },
      );

      const icon = el('div', {
        flex: '0 0 auto',
        width: '10px',
        height: '10px',
        marginTop: '5px',
        borderRadius: '50%',
        background: '#fbbf24',
      });
      const text = el(
        'div',
        { flex: '1 1 auto' },
        {
          text: t('banner_days_left', { days }),
        },
      );
      const closeBtn = el(
        'button',
        {
          flex: '0 0 auto',
          background: 'transparent',
          border: 'none',
          color: COLORS.textDim,
          fontSize: '16px',
          lineHeight: '1',
          cursor: 'pointer',
          padding: '0 2px',
          fontFamily: FONT_STACK,
        },
        { type: 'button', 'aria-label': t('banner_close'), text: '×' },
      );
      closeBtn.addEventListener('click', removeBanner);

      banner.appendChild(icon);
      banner.appendChild(text);
      banner.appendChild(closeBtn);
      document.body.appendChild(banner);
    });
  }

  /* =====================================================================
     4) AÇILIŞTA LİSANS DENETİMİ
  ===================================================================== */
  function makeTimeoutSignal(ms) {
    try {
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(ms);
      }
      if (typeof AbortController !== 'undefined') {
        const c = new AbortController();
        setTimeout(() => c.abort(), ms);
        return c.signal;
      }
    } catch {
      /* signal'sız devam */
    }
    return undefined;
  }

  // null → backend erişilemez/eski (hiçbir şey yapma); obje → status gövdesi
  async function fetchLicenseStatus() {
    let res;
    try {
      res = await window.fetch('/v1/license/status', {
        method: 'GET',
        signal: makeTimeoutSignal(3000),
      });
    } catch {
      return null;
    }
    if (!res || !res.ok) return null; // 404 = eski backend → dokunma
    try {
      const body = await res.json();
      return body && typeof body === 'object' ? body : null;
    } catch {
      return null;
    }
  }

  async function checkLicenseOnLoad() {
    const status = await fetchLicenseStatus();
    if (!status) return; // backend eski/erişilemez → mevcut davranış korunur
    if (status.valid === false) {
      showOverlay(status);
    } else if (
      status.valid === true &&
      typeof status.daysLeft === 'number' &&
      status.daysLeft <= 14
    ) {
      showExpiryBanner(status);
    }
  }

  checkLicenseOnLoad();

  // Hata ayıklama / manuel tetikleme için küçük bir API
  window.__PROMETA_LICENSE__ = {
    recheck: checkLicenseOnLoad,
    getTerminalId,
    getTerminalName,
  };
})();

/**
 * KDV1 beyanname kod katalogları (GİB e-Beyan kodları → 4 dilli etiket).
 *
 * Kodlar GİB sözleşmesindeki KDV1_XXX biçiminde; resmi Türkçe adlar esas
 * alınır, en/de/ar özet çeviridir. Uzun istisna aralıkları (201-250, 301-350)
 * için curated (sık kullanılan) adlar + kalanına kod tabanlı jenerik etiket.
 */

/** entry {tr,en,de,ar} → aktif dilde etiket (tr fallback). */
export function label(entry, lang) {
  if (!entry) return '';
  return entry[lang] || entry.tr;
}

/** Kod listesinde koda karşılık gelen etiketi döndürür ("kod — ad"). */
export function codeLabel(list, code, lang) {
  const e = list.find((x) => x.code === code);
  return e ? `${e.code.replace('KDV1_', '')} — ${label(e, lang)}` : code;
}

// --- Dönem ayları ----------------------------------------------------------
export const AYLAR = [
  { code: 'OCAK', tr: 'Ocak', en: 'January', de: 'Januar', ar: 'يناير' },
  { code: 'SUBAT', tr: 'Şubat', en: 'February', de: 'Februar', ar: 'فبراير' },
  { code: 'MART', tr: 'Mart', en: 'March', de: 'März', ar: 'مارس' },
  { code: 'NISAN', tr: 'Nisan', en: 'April', de: 'April', ar: 'أبريل' },
  { code: 'MAYIS', tr: 'Mayıs', en: 'May', de: 'Mai', ar: 'مايو' },
  { code: 'HAZIRAN', tr: 'Haziran', en: 'June', de: 'Juni', ar: 'يونيو' },
  { code: 'TEMMUZ', tr: 'Temmuz', en: 'July', de: 'Juli', ar: 'يوليو' },
  { code: 'AGUSTOS', tr: 'Ağustos', en: 'August', de: 'August', ar: 'أغسطس' },
  { code: 'EYLUL', tr: 'Eylül', en: 'September', de: 'September', ar: 'سبتمبر' },
  { code: 'EKIM', tr: 'Ekim', en: 'October', de: 'Oktober', ar: 'أكتوبر' },
  { code: 'KASIM', tr: 'Kasım', en: 'November', de: 'November', ar: 'نوفمبر' },
  { code: 'ARALIK', tr: 'Aralık', en: 'December', de: 'Dezember', ar: 'ديسمبر' },
];

// --- Lokal durum -----------------------------------------------------------
export const LOKAL_DURUM = {
  taslak: { tr: 'Taslak', en: 'Draft', de: 'Entwurf', ar: 'مسودة' },
  gonderildi: { tr: 'Gönderildi', en: 'Sent', de: 'Gesendet', ar: 'أُرسلت' },
  kontrol_edildi: { tr: 'Kontrol Edildi', en: 'Checked', de: 'Geprüft', ar: 'تم التحقق' },
  onaylandi: { tr: 'Onaylandı', en: 'Approved', de: 'Genehmigt', ar: 'تمت الموافقة' },
  hatali: { tr: 'Hatalı', en: 'Error', de: 'Fehlerhaft', ar: 'خطأ' },
};

// --- GİB durum -------------------------------------------------------------
export const GIB_DURUM = {
  TASLAK: { tr: 'Taslak', en: 'Draft', de: 'Entwurf', ar: 'مسودة' },
  ONAY_BEKLIYOR: {
    tr: 'Onay Bekliyor',
    en: 'Pending Approval',
    de: 'Genehmigung ausstehend',
    ar: 'بانتظار الموافقة',
  },
  ONAYLANDI: { tr: 'Onaylandı', en: 'Approved', de: 'Genehmigt', ar: 'تمت الموافقة' },
  HATALI: { tr: 'Hatalı', en: 'Error', de: 'Fehlerhaft', ar: 'خطأ' },
  IPTAL_EDILDI: { tr: 'İptal Edildi', en: 'Cancelled', de: 'Storniert', ar: 'أُلغيت' },
  KOPYALANIYOR: { tr: 'Kopyalanıyor', en: 'Copying', de: 'Wird kopiert', ar: 'يتم النسخ' },
  SILINDI: { tr: 'Silindi', en: 'Deleted', de: 'Gelöscht', ar: 'محذوفة' },
};

// --- Matrah: Tevkifat Uygulanmayan İşlemler --------------------------------
export const MATRAH_TEVKIFATSIZ = [
  {
    code: 'KDV1_1100',
    tr: 'Tevkifat Uygulanmayan İşlemler',
    en: 'Transactions Without Withholding',
    de: 'Umsätze ohne Steuerabzug',
    ar: 'معاملات بدون اقتطاع',
  },
];

// --- Matrah: Diğer İşlemler ------------------------------------------------
export const DIGER_ISLEM_TURU = [
  {
    code: 'KDV1_501',
    tr: 'Kısmi İstisna Kapsamına Giren İşlemler',
    en: 'Partial exemption transactions',
    de: 'Teilbefreite Umsätze',
    ar: 'معاملات إعفاء جزئي',
  },
  {
    code: 'KDV1_503',
    tr: 'Amortismana Tabi Sabit Kıymet Satışları',
    en: 'Depreciable fixed asset sales',
    de: 'Verkauf abschreibbarer Anlagen',
    ar: 'مبيعات أصول ثابتة قابلة للإهلاك',
  },
  {
    code: 'KDV1_504',
    tr: 'Vergiye Tabi Diğer İşlemler',
    en: 'Other taxable transactions',
    de: 'Sonstige steuerpflichtige Umsätze',
    ar: 'معاملات خاضعة أخرى',
  },
  {
    code: 'KDV1_505',
    tr: 'Vergiye Tabi İşlem Bulunmaması',
    en: 'No taxable transaction',
    de: 'Kein steuerpflichtiger Umsatz',
    ar: 'لا توجد معاملة خاضعة',
  },
  {
    code: 'KDV1_506',
    tr: 'İade Edilmesi Gereken KDV',
    en: 'VAT to be refunded',
    de: 'Zu erstattende USt.',
    ar: 'ضريبة مستحقة الرد',
  },
  {
    code: 'KDV1_507',
    tr: 'Diğer İşlemler',
    en: 'Other transactions',
    de: 'Sonstige Umsätze',
    ar: 'معاملات أخرى',
  },
  {
    code: 'KDV1_508',
    tr: 'Diğer İşlemler',
    en: 'Other transactions',
    de: 'Sonstige Umsätze',
    ar: 'معاملات أخرى',
  },
  {
    code: 'KDV1_509',
    tr: 'Diğer İşlemler',
    en: 'Other transactions',
    de: 'Sonstige Umsätze',
    ar: 'معاملات أخرى',
  },
  {
    code: 'KDV1_510',
    tr: 'Diğer İşlemler',
    en: 'Other transactions',
    de: 'Sonstige Umsätze',
    ar: 'معاملات أخرى',
  },
  {
    code: 'KDV1_550',
    tr: 'Diğer İşlemler',
    en: 'Other transactions',
    de: 'Sonstige Umsätze',
    ar: 'معاملات أخرى',
  },
];

// --- İndirimler: Önceki Dönemden Devreden — değişiklik nedeni --------------
export const DEVREDEN_NEDEN = [
  {
    code: 'KDV1_1',
    tr: 'Önceki Dönemden Devreden KDV',
    en: 'VAT carried from previous period',
    de: 'USt.-Übertrag aus Vorperiode',
    ar: 'ضريبة مرحّلة من الفترة السابقة',
  },
  { code: 'KDV1_2', tr: 'Birleşme', en: 'Merger', de: 'Verschmelzung', ar: 'اندماج' },
  { code: 'KDV1_5', tr: 'Devir', en: 'Transfer', de: 'Übertragung', ar: 'نقل' },
  { code: 'KDV1_6', tr: 'Bölünme', en: 'Demerger', de: 'Spaltung', ar: 'انقسام' },
  {
    code: 'KDV1_9',
    tr: 'Tür Değişikliği',
    en: 'Type change',
    de: 'Formwechsel',
    ar: 'تغيير النوع',
  },
  { code: 'KDV1_10', tr: 'Diğer', en: 'Other', de: 'Sonstiges', ar: 'أخرى' },
  { code: 'KDV1_11', tr: 'Diğer', en: 'Other', de: 'Sonstiges', ar: 'أخرى' },
  { code: 'KDV1_12', tr: 'Diğer', en: 'Other', de: 'Sonstiges', ar: 'أخرى' },
  { code: 'KDV1_13', tr: 'Diğer', en: 'Other', de: 'Sonstiges', ar: 'أخرى' },
  { code: 'KDV1_14', tr: 'Diğer', en: 'Other', de: 'Sonstiges', ar: 'أخرى' },
  { code: 'KDV1_15', tr: 'Diğer', en: 'Other', de: 'Sonstiges', ar: 'أخرى' },
];

// --- İndirimler: Diğer İndirimler ------------------------------------------
export const DIGER_INDIRIM_TURU = [
  {
    code: 'KDV1_103',
    tr: 'Bu Döneme Ait İndirilecek KDV',
    en: 'Deductible VAT for this period',
    de: 'Abziehbare USt. dieser Periode',
    ar: 'ضريبة قابلة للخصم لهذه الفترة',
  },
  {
    code: 'KDV1_104',
    tr: 'Satıştan İade Edilen İşlemlerden Doğan KDV',
    en: 'VAT from sales returns',
    de: 'USt. aus Verkaufsrückgaben',
    ar: 'ضريبة من مرتجعات المبيعات',
  },
  {
    code: 'KDV1_106',
    tr: 'Diğer İndirilecek KDV',
    en: 'Other deductible VAT',
    de: 'Sonstige abziehbare USt.',
    ar: 'ضريبة أخرى قابلة للخصم',
  },
  {
    code: 'KDV1_107',
    tr: 'Kanunun 11/1-c ve Geçici 17. Md. İade İndirimi',
    en: 'Art. 11/1-c & Prov. 17 refund deduction',
    de: 'Erstattungsabzug Art. 11/1-c',
    ar: 'خصم الرد بموجب المادة 11/1-c',
  },
  {
    code: 'KDV1_108',
    tr: 'Bu Döneme Ait İndirilecek KDV (Oranlar)',
    en: 'Deductible VAT this period (by rate)',
    de: 'Abziehbare USt. (nach Satz)',
    ar: 'ضريبة قابلة للخصم (حسب النسبة)',
  },
  {
    code: 'KDV1_109',
    tr: 'Sorumlu Sıfatıyla Beyan Edilerek Ödenen KDV',
    en: 'VAT paid as tax responsible',
    de: 'Als Steuerschuldner gezahlte USt.',
    ar: 'ضريبة مدفوعة بصفة المسؤول',
  },
  {
    code: 'KDV1_110',
    tr: 'İthalde Ödenen KDV',
    en: 'VAT paid on import',
    de: 'Bei Einfuhr gezahlte USt.',
    ar: 'ضريبة مدفوعة عند الاستيراد',
  },
  {
    code: 'KDV1_111',
    tr: 'Değersiz Hale Gelen Alacaklara İlişkin İndirilecek KDV',
    en: 'Deductible VAT on worthless receivables',
    de: 'Abziehbare USt. auf uneinbringliche Forderungen',
    ar: 'ضريبة قابلة للخصم على ديون معدومة',
  },
];

// --- İndirilecek KDV oranlara göre dağılım — indirim türü ------------------
export const DAGILIM_INDIRIM_TURU = [
  {
    code: 'KDV1_108',
    tr: 'Bu Döneme Ait İndirilecek KDV',
    en: 'Deductible VAT this period',
    de: 'Abziehbare USt. dieser Periode',
    ar: 'ضريبة قابلة للخصم لهذه الفترة',
  },
  {
    code: 'KDV1_110',
    tr: 'İthalde Ödenen KDV',
    en: 'VAT paid on import',
    de: 'Bei Einfuhr gezahlte USt.',
    ar: 'ضريبة مدفوعة عند الاستيراد',
  },
];

// --- İhraç Kaydıyla Teslimler — işlem türü ---------------------------------
export const IHRAC_ISLEM_TURU = [
  {
    code: 'KDV1_701',
    tr: 'İhracatı Yapılacak Nihai Ürün Teslimi (11/1-c)',
    en: 'Delivery of goods for export (11/1-c)',
    de: 'Lieferung von Exportwaren (11/1-c)',
    ar: 'تسليم سلع للتصدير (11/1-c)',
  },
  {
    code: 'KDV1_702',
    tr: 'DİİB/GKİB Kapsamında Teslim (Geçici 17)',
    en: 'DIIB/GKIB delivery (Provisional 17)',
    de: 'DIIB/GKIB-Lieferung (Prov. 17)',
    ar: 'تسليم ضمن DIIB/GKIB (المؤقتة 17)',
  },
];

// --- Sorumlu Sıfatıyla Ödenen KDV (109) — ödeme türü -----------------------
export const ODEME_TURU_109 = [
  { code: 'KDV1_1', tr: 'Ödendi', en: 'Paid', de: 'Bezahlt', ar: 'مدفوع' },
  {
    code: 'KDV1_2',
    tr: 'Emanetteki Tutardan Mahsuben Ödendi',
    en: 'Offset from deposit',
    de: 'Aus Verwahrung verrechnet',
    ar: 'مقاصة من الأمانة',
  },
  {
    code: 'KDV1_3',
    tr: 'İade Dosyasından Mahsup Talep Edildi',
    en: 'Offset requested from refund file',
    de: 'Verrechnung aus Erstattungsakte beantragt',
    ar: 'طلب مقاصة من ملف الرد',
  },
];

// --- Kısmî Tevkifat işlem türleri (Ekler, 601-627) — resmi GİB adları ------
export const KISMI_TEVKIFAT_TURU = [
  {
    code: 'KDV1_601',
    tr: 'Yapım İşleri ile Mühendislik-Mimarlık ve Etüt-Proje Hizmetleri',
    en: 'Construction & engineering/architecture services',
    de: 'Bau- und Ingenieurleistungen',
    ar: 'أعمال إنشاء وخدمات هندسية',
  },
  {
    code: 'KDV1_602',
    tr: 'Etüt, Plan-Proje, Danışmanlık, Denetim ve Benzeri Hizmetler',
    en: 'Study, project, consultancy, audit services',
    de: 'Studien-, Projekt-, Beratungsleistungen',
    ar: 'خدمات دراسة ومشاريع واستشارات',
  },
  {
    code: 'KDV1_603',
    tr: 'Makine, Teçhizat, Demirbaş ve Taşıt Tadil, Bakım ve Onarım',
    en: 'Machinery/vehicle maintenance & repair',
    de: 'Maschinen-/Fahrzeugwartung u. -reparatur',
    ar: 'صيانة وإصلاح آلات ومركبات',
  },
  {
    code: 'KDV1_604',
    tr: 'Yemek Servis Hizmeti',
    en: 'Catering service',
    de: 'Verpflegungsdienst',
    ar: 'خدمة تقديم الطعام',
  },
  {
    code: 'KDV1_605',
    tr: 'Organizasyon Hizmeti',
    en: 'Organization service',
    de: 'Organisationsdienst',
    ar: 'خدمة تنظيم',
  },
  {
    code: 'KDV1_606',
    tr: 'İşgücü Temin Hizmetleri',
    en: 'Labor supply services',
    de: 'Personalgestellung',
    ar: 'خدمات توفير العمالة',
  },
  {
    code: 'KDV1_607',
    tr: 'Özel Güvenlik Hizmeti',
    en: 'Private security service',
    de: 'Sicherheitsdienst',
    ar: 'خدمة أمن خاص',
  },
  {
    code: 'KDV1_608',
    tr: 'Yapı Denetim Hizmetleri',
    en: 'Building inspection services',
    de: 'Bauüberwachung',
    ar: 'خدمات تدقيق المباني',
  },
  {
    code: 'KDV1_609',
    tr: 'Fason Tekstil, Konfeksiyon, Çanta ve Ayakkabı Dikim İşleri',
    en: 'Contract textile/apparel manufacturing',
    de: 'Lohnfertigung Textil/Bekleidung',
    ar: 'خياطة نسيج وملابس بالمقاولة',
  },
  {
    code: 'KDV1_610',
    tr: 'Turistik Mağazalara Müşteri Bulma/Götürme Hizmetleri',
    en: 'Tourist store customer sourcing',
    de: 'Kundenvermittlung Touristikläden',
    ar: 'جلب زبائن للمتاجر السياحية',
  },
  {
    code: 'KDV1_611',
    tr: 'Spor Kulüplerinin Yayın, Reklam ve İsim Hakkı Gelirleri',
    en: 'Sports club broadcast/ad/name rights',
    de: 'Sportclub-Rechteerlöse',
    ar: 'حقوق البث والإعلان للأندية',
  },
  {
    code: 'KDV1_612',
    tr: 'Temizlik Hizmeti',
    en: 'Cleaning service',
    de: 'Reinigungsdienst',
    ar: 'خدمة تنظيف',
  },
  {
    code: 'KDV1_613',
    tr: 'Çevre ve Bahçe Bakım Hizmetleri',
    en: 'Environment & garden maintenance',
    de: 'Umwelt- und Gartenpflege',
    ar: 'صيانة بيئة وحدائق',
  },
  {
    code: 'KDV1_614',
    tr: 'Servis Taşımacılığı Hizmeti',
    en: 'Shuttle transport service',
    de: 'Shuttle-Transport',
    ar: 'خدمة نقل',
  },
  {
    code: 'KDV1_615',
    tr: 'Her Türlü Baskı ve Basım Hizmetleri',
    en: 'Printing services',
    de: 'Druckdienstleistungen',
    ar: 'خدمات طباعة',
  },
  {
    code: 'KDV1_616',
    tr: 'Diğer Hizmetler',
    en: 'Other services',
    de: 'Sonstige Dienstleistungen',
    ar: 'خدمات أخرى',
  },
  {
    code: 'KDV1_617',
    tr: 'Hurda Metalden Elde Edilen Külçe Teslimleri',
    en: 'Ingot from scrap metal delivery',
    de: 'Barren aus Schrott',
    ar: 'تسليم سبائك من الخردة',
  },
  {
    code: 'KDV1_618',
    tr: 'Bakır, Çinko, Demir Çelik, Alüminyum, Kurşun Külçe Teslimi',
    en: 'Copper/zinc/steel/aluminum/lead ingot',
    de: 'Kupfer-/Zink-/Stahl-Barren',
    ar: 'تسليم سبائك معدنية',
  },
  {
    code: 'KDV1_619',
    tr: 'Bakır, Çinko, Alüminyum ve Kurşun Ürünlerinin Teslimi',
    en: 'Copper/zinc/aluminum/lead products',
    de: 'Kupfer-/Zink-/Alu-Produkte',
    ar: 'تسليم منتجات معدنية',
  },
  {
    code: 'KDV1_620',
    tr: 'İstisnadan Vazgeçenlerin Hurda ve Atık Teslimi',
    en: 'Scrap/waste delivery (exemption waived)',
    de: 'Schrott-/Abfalllieferung',
    ar: 'تسليم خردة ونفايات',
  },
  {
    code: 'KDV1_621',
    tr: 'Metal, Plastik, Lastik, Kauçuk, Kâğıt, Cam Hurdadan Hammadde Teslimi',
    en: 'Raw material from scrap delivery',
    de: 'Rohstoff aus Schrott',
    ar: 'مواد خام من الخردة',
  },
  {
    code: 'KDV1_622',
    tr: 'Pamuk, Tiftik, Yün, Yapağı, Ham Post ve Deri Teslimleri',
    en: 'Cotton/wool/hide delivery',
    de: 'Baumwolle/Wolle/Häute',
    ar: 'تسليم قطن وصوف وجلود',
  },
  {
    code: 'KDV1_623',
    tr: 'Ağaç ve Orman Ürünleri Teslimi',
    en: 'Timber & forest products delivery',
    de: 'Holz- und Forstprodukte',
    ar: 'تسليم منتجات خشبية وحرجية',
  },
  {
    code: 'KDV1_624',
    tr: 'Yük Taşımacılığı Hizmeti',
    en: 'Freight transport service',
    de: 'Frachttransport',
    ar: 'خدمة نقل بضائع',
  },
  {
    code: 'KDV1_625',
    tr: 'Ticari Reklam Hizmetleri',
    en: 'Commercial advertising services',
    de: 'Werbedienstleistungen',
    ar: 'خدمات إعلان تجاري',
  },
  {
    code: 'KDV1_626',
    tr: 'Diğer Teslimler',
    en: 'Other deliveries',
    de: 'Sonstige Lieferungen',
    ar: 'تسليمات أخرى',
  },
  {
    code: 'KDV1_627',
    tr: 'Demir-Çelik Ürünlerinin Teslimi',
    en: 'Iron & steel products delivery',
    de: 'Eisen-/Stahlprodukte',
    ar: 'تسليم منتجات حديد وصلب',
  },
];

/** Curated (sık kullanılan) kısmî istisna adları; kalanı jenerik üretilir. */
const KISMI_ISTISNA_ADLARI = {
  KDV1_201: {
    tr: 'Mükellefe Yapılan Teslim ve Hizmetler (17/2)',
    en: 'Deliveries/services to taxpayer (17/2)',
    de: 'Lieferungen an Steuerpflichtige (17/2)',
    ar: 'تسليمات وخدمات للمكلف (17/2)',
  },
  KDV1_212: {
    tr: 'Serbest Bölgelerde Verilen Hizmetler (17/4-ı)',
    en: 'Services in free zones (17/4-ı)',
    de: 'Dienstleistungen in Freizonen (17/4-ı)',
    ar: 'خدمات في المناطق الحرة (17/4-ı)',
  },
  KDV1_223: {
    tr: 'Teknoloji Geliştirme Bölgelerinde Yapılan İşlemler (Geçici 20/1)',
    en: 'Technology development zone transactions (Prov. 20/1)',
    de: 'Technologiezonen-Umsätze (Prov. 20/1)',
    ar: 'معاملات مناطق تطوير التقنية (المؤقتة 20/1)',
  },
};

/** Curated (sık kullanılan) tam istisna adları; kalanı jenerik üretilir. */
const TAM_ISTISNA_ADLARI = {
  KDV1_301: { tr: 'Mal İhracatı', en: 'Goods export', de: 'Warenexport', ar: 'تصدير سلع' },
  KDV1_302: {
    tr: 'Hizmet İhracatı',
    en: 'Service export',
    de: 'Dienstleistungsexport',
    ar: 'تصدير خدمات',
  },
  KDV1_308: {
    tr: 'Yatırım Teşvik Belgesi Kapsamında Makine-Teçhizat Teslimi',
    en: 'Investment incentive machinery delivery',
    de: 'Maschinenlieferung mit Investitionsanreiz',
    ar: 'تسليم آلات ضمن حوافز الاستثمار',
  },
  KDV1_310: {
    tr: 'Ulusal Güvenlik Amaçlı Teslim ve Hizmetler (13/f)',
    en: 'National security deliveries (13/f)',
    de: 'Lieferungen für nationale Sicherheit (13/f)',
    ar: 'تسليمات لأغراض الأمن الوطني (13/f)',
  },
  KDV1_316: {
    tr: 'Serbest Bölge Müşterileri İçin Fason Hizmetler (11/1-a)',
    en: 'Contract services for free-zone customers (11/1-a)',
    de: 'Lohnleistungen für Freizonenkunden (11/1-a)',
    ar: 'خدمات بالمقاولة لعملاء المناطق الحرة (11/1-a)',
  },
  KDV1_328: {
    tr: 'Konut veya İş Yeri Teslimleri (13/i)',
    en: 'Residence/workplace delivery (13/i)',
    de: 'Wohnungs-/Gewerbelieferung (13/i)',
    ar: 'تسليم مساكن أو أماكن عمل (13/i)',
  },
};

function genRange(prefix, from, to, curated, base) {
  const out = [];
  for (let n = from; n <= to; n++) {
    const code = `${prefix}${n}`;
    if (curated[code]) {
      out.push({ code, ...curated[code] });
    } else {
      out.push({
        code,
        tr: `${base.tr} (${n})`,
        en: `${base.en} (${n})`,
        de: `${base.de} (${n})`,
        ar: `${base.ar} (${n})`,
      });
    }
  }
  return out;
}

// --- İstisnalar: Kısmî İstisna (201-250) -----------------------------------
export const KISMI_ISTISNA_TURU = genRange('KDV1_', 201, 250, KISMI_ISTISNA_ADLARI, {
  tr: 'Kısmî İstisna',
  en: 'Partial exemption',
  de: 'Teilbefreiung',
  ar: 'إعفاء جزئي',
}).filter(
  (e) =>
    e.code !== 'KDV1_203' &&
    e.code !== 'KDV1_210' &&
    e.code !== 'KDV1_222' &&
    e.code !== 'KDV1_224',
);

// --- İstisnalar: Tam İstisna (301-350) -------------------------------------
export const TAM_ISTISNA_TURU = genRange('KDV1_', 301, 350, TAM_ISTISNA_ADLARI, {
  tr: 'Tam İstisna',
  en: 'Full exemption',
  de: 'Vollbefreiung',
  ar: 'إعفاء كامل',
});

// --- KDV oranı seçenekleri (yaygın) ----------------------------------------
export const KDV_ORANLARI = [0, 0.01, 0.08, 0.1, 0.18, 0.2];

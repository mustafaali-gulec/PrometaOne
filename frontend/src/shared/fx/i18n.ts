/**
 * Döviz (FX) çekirdeği için çok dilli etiket kataloğu (TR/EN/DE/AR).
 *
 * App.jsx I18N_DICT'inden bağımsız; modül kendi metinlerini taşır.
 * (Dil Ajanı kuralı: her UI metni baştan TR/EN/DE/AR.)
 */
export type Lang = 'tr' | 'en' | 'de' | 'ar';

export type FxLabelKey =
  | 'fx.enable'
  | 'fx.enableHint'
  | 'fx.currency'
  | 'fx.rateSource'
  | 'fx.source.tcmb'
  | 'fx.source.manual'
  | 'fx.rate'
  | 'fx.rateOne'
  | 'fx.tryEquivalent'
  | 'fx.basis.record'
  | 'fx.basis.history'
  | 'fx.basis.current'
  | 'fx.basis.missing'
  | 'fx.loading'
  | 'fx.refresh'
  | 'fx.noRate'
  | 'fx.manualHint'
  | 'fx.displayNote';

const DICT: Record<FxLabelKey, Record<Lang, string>> = {
  'fx.enable': {
    tr: 'Dövizli kayıt',
    en: 'Foreign currency entry',
    de: 'Fremdwährungsbuchung',
    ar: 'قيد بالعملة الأجنبية',
  },
  'fx.enableHint': {
    tr: 'Tutar dövizle girilir; TL karşılığı kurdan hesaplanıp kayda yazılır.',
    en: 'The amount is entered in foreign currency; its TRY equivalent is computed from the rate and stored.',
    de: 'Der Betrag wird in Fremdwährung erfasst; der TRY-Gegenwert wird aus dem Kurs berechnet und gespeichert.',
    ar: 'يُدخل المبلغ بالعملة الأجنبية؛ ويُحسب مقابله بالليرة التركية من سعر الصرف ويُحفظ.',
  },
  'fx.currency': { tr: 'Para birimi', en: 'Currency', de: 'Währung', ar: 'العملة' },
  'fx.rateSource': { tr: 'Kur kaynağı', en: 'Rate source', de: 'Kursquelle', ar: 'مصدر سعر الصرف' },
  'fx.source.tcmb': {
    tr: 'Merkez Bankası (TCMB)',
    en: 'Central Bank (TCMB)',
    de: 'Zentralbank (TCMB)',
    ar: 'البنك المركزي (TCMB)',
  },
  'fx.source.manual': { tr: 'Manuel kur', en: 'Manual rate', de: 'Manueller Kurs', ar: 'سعر يدوي' },
  'fx.rate': { tr: 'Kur', en: 'Rate', de: 'Kurs', ar: 'سعر الصرف' },
  'fx.rateOne': { tr: '1 {cur} =', en: '1 {cur} =', de: '1 {cur} =', ar: '١ {cur} =' },
  'fx.tryEquivalent': {
    tr: 'TL karşılığı',
    en: 'TRY equivalent',
    de: 'TRY-Gegenwert',
    ar: 'المقابل بالليرة التركية',
  },
  'fx.basis.record': {
    tr: 'Kayda yazılan kur',
    en: 'Rate stored on the record',
    de: 'Im Beleg gespeicherter Kurs',
    ar: 'السعر المحفوظ في القيد',
  },
  'fx.basis.history': {
    tr: '{date} tarihli TCMB kuru',
    en: 'TCMB rate of {date}',
    de: 'TCMB-Kurs vom {date}',
    ar: 'سعر TCMB بتاريخ {date}',
  },
  'fx.basis.current': {
    tr: 'Güncel TCMB kuru (belge tarihine ait kur bulunamadı)',
    en: 'Current TCMB rate (no rate found for the document date)',
    de: 'Aktueller TCMB-Kurs (kein Kurs für das Belegdatum gefunden)',
    ar: 'سعر TCMB الحالي (لم يُعثر على سعر لتاريخ المستند)',
  },
  'fx.basis.missing': {
    tr: 'Kur bulunamadı — tutarı doğrulayın',
    en: 'No rate available — verify the amount',
    de: 'Kein Kurs verfügbar — Betrag prüfen',
    ar: 'لا يتوفر سعر صرف — تحقق من المبلغ',
  },
  'fx.loading': {
    tr: 'Kur alınıyor…',
    en: 'Fetching rate…',
    de: 'Kurs wird abgerufen…',
    ar: 'جارٍ جلب السعر…',
  },
  'fx.refresh': {
    tr: 'Kuru yenile',
    en: 'Refresh rate',
    de: 'Kurs aktualisieren',
    ar: 'تحديث السعر',
  },
  'fx.noRate': {
    tr: 'Kur girilmedi',
    en: 'No rate entered',
    de: 'Kein Kurs eingegeben',
    ar: 'لم يتم إدخال سعر',
  },
  'fx.manualHint': {
    tr: 'Girdiğiniz kur kayda yazılır ve sonradan değişmez.',
    en: 'The rate you enter is stored on the record and will not change later.',
    de: 'Der eingegebene Kurs wird im Beleg gespeichert und ändert sich später nicht.',
    ar: 'يُحفظ السعر الذي تدخله في القيد ولا يتغير لاحقًا.',
  },
  'fx.displayNote': {
    tr: 'Tutarlar {cur} cinsinden gösteriliyor',
    en: 'Amounts are shown in {cur}',
    de: 'Beträge werden in {cur} angezeigt',
    ar: 'تُعرض المبالغ بعملة {cur}',
  },
};

/** FX etiketi getir; `vars` ile {placeholder} doldurulur. */
export function fxT(
  key: FxLabelKey,
  lang: string | undefined,
  vars?: Record<string, string>,
): string {
  const l: Lang = lang === 'en' || lang === 'de' || lang === 'ar' ? lang : 'tr';
  let text = DICT[key]?.[l] ?? DICT[key]?.tr ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(v);
  }
  return text;
}

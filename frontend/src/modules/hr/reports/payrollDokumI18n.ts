/**
 * Bordro Dökümü raporu — TR/EN/DE/AR etiket sözlüğü.
 *
 * Rapor hem ekranda (önizleme), hem Excel (xlsx), hem yazdırma (PDF) çıktısında
 * aynı etiketleri kullanır. Sütun başlıkları kaynak bordro dökümündeki kısaltmalarla
 * birebir aynıdır (TR); diğer dillerde okunur karşılıkları verilir.
 */

export type PayrollDokumLang = 'tr' | 'en' | 'de' | 'ar';

const LANGS: readonly PayrollDokumLang[] = ['tr', 'en', 'de', 'ar'];

export type PayrollDokumLabels = Record<PayrollDokumLang, string>;

/** Etiket sözlüğü — anahtar → { tr, en, de, ar }. */
export const PAYROLL_DOKUM_LABELS = {
  // --- Ekran / rapor başlıkları ---
  reportsTitle: { tr: 'Raporlar', en: 'Reports', de: 'Berichte', ar: 'التقارير' },
  reportsSubtitle: {
    tr: 'İnsan kaynakları raporları — parametreleri seçip Excel, PDF veya ekran çıktısı alın',
    en: 'HR reports — pick the parameters and output to Excel, PDF or screen',
    de: 'HR-Berichte — Parameter wählen und als Excel, PDF oder Bildschirmausgabe erzeugen',
    ar: 'تقارير الموارد البشرية — اختر المعايير وأخرج النتيجة إلى Excel أو PDF أو الشاشة',
  },
  dokumTitle: { tr: 'BORDRO DÖKÜMÜ', en: 'PAYROLL REGISTER', de: 'LOHNJOURNAL', ar: 'كشف الرواتب' },
  dokumCardTitle: {
    tr: 'Bordro Dökümü',
    en: 'Payroll Register',
    de: 'Lohnjournal',
    ar: 'كشف الرواتب',
  },
  dokumCardDesc: {
    tr: 'Dönem bordrosunun personel bazlı tam dökümü (kazanç/kesinti kırılımı, toplamlar, icmal)',
    en: 'Full per-employee register of a period payroll (earning/deduction breakdown, totals, summary)',
    de: 'Vollständiges Journal einer Abrechnungsperiode je Mitarbeiter (Verdienst/Abzüge, Summen, Zusammenfassung)',
    ar: 'كشف كامل لرواتب الفترة لكل موظف (تفصيل المكاسب والاستقطاعات، المجاميع، الملخص)',
  },
  backToList: {
    tr: '← Rapor listesi',
    en: '← Report list',
    de: '← Berichtsliste',
    ar: '← قائمة التقارير',
  },

  // --- Parametre etiketleri (kaynak ekranla aynı sıra) ---
  pWorkplace: { tr: 'İşyeri', en: 'Workplace', de: 'Betriebsstätte', ar: 'المنشأة' },
  pDepartment: { tr: 'Bölüm', en: 'Department', de: 'Abteilung', ar: 'القسم' },
  pMonths: { tr: 'Aylar', en: 'Month', de: 'Monat', ar: 'الشهر' },
  pEmployee: { tr: 'Personel Bordro', en: 'Employee', de: 'Mitarbeiter', ar: 'الموظف' },
  pPayrollSource: {
    tr: 'Bordro Tipi',
    en: 'Payroll Source',
    de: 'Abrechnungsquelle',
    ar: 'مصدر الرواتب',
  },
  pWageBasis: {
    tr: 'Günlük/Saatlik Ücret',
    en: 'Daily/Hourly Wage',
    de: 'Tages-/Stundenlohn',
    ar: 'الأجر اليومي/الساعي',
  },
  pLayout: { tr: 'Bordro Türü', en: 'Register Layout', de: 'Journalart', ar: 'نوع الكشف' },
  pColumnPicker: {
    tr: 'Sütunları seçmek için buraya tıklayınız.',
    en: 'Click here to choose the columns.',
    de: 'Klicken Sie hier, um die Spalten auszuwählen.',
    ar: 'اضغط هنا لاختيار الأعمدة.',
  },
  pLawNo: { tr: 'Kanun No', en: 'Law No', de: 'Gesetz-Nr.', ar: 'رقم القانون' },
  pTotals: { tr: 'Toplamlar', en: 'Totals', de: 'Summen', ar: 'المجاميع' },
  pIcmal: { tr: 'İcmal', en: 'Summary', de: 'Zusammenfassung', ar: 'الملخص' },
  pComponentTotals: {
    tr: 'Kazanç/Kesinti Toplamları',
    en: 'Earning/Deduction Totals',
    de: 'Verdienst-/Abzugssummen',
    ar: 'مجاميع المكاسب/الاستقطاعات',
  },
  pPageBreak: { tr: 'Sayfa Sonu', en: 'Page Break', de: 'Seitenumbruch', ar: 'فاصل الصفحة' },
  pPreparerSign: {
    tr: 'Düzenleyen İmza',
    en: 'Preparer Signature',
    de: 'Unterschrift Erstellt von',
    ar: 'توقيع المُعِد',
  },
  pCheckerSign: {
    tr: 'Kontrol Eden İmza',
    en: 'Checker Signature',
    de: 'Unterschrift Geprüft von',
    ar: 'توقيع المُراجِع',
  },
  pApproverSign: {
    tr: 'Onay İmza',
    en: 'Approver Signature',
    de: 'Unterschrift Genehmigt von',
    ar: 'توقيع المعتمد',
  },
  pSgkGroup: { tr: 'SSK Grup', en: 'SSI Group', de: 'SV-Gruppe', ar: 'مجموعة الضمان' },
  pCurrency: { tr: 'Döviz Türü', en: 'Currency', de: 'Währung', ar: 'العملة' },
  pRateBasis: { tr: 'Alış/Satış', en: 'Buying/Selling', de: 'Ankauf/Verkauf', ar: 'شراء/بيع' },
  pRateDate: { tr: 'Döviz Tarihi', en: 'Rate Date', de: 'Kursdatum', ar: 'تاريخ سعر الصرف' },
  pRate: { tr: 'Kur', en: 'Rate', de: 'Kurs', ar: 'سعر الصرف' },
  pMissingDays: { tr: 'Eksik Gün', en: 'Missing Days', de: 'Fehltage', ar: 'الأيام الناقصة' },
  pTablePlacement: {
    tr: 'İcmal ve Kazanç/Kesinti',
    en: 'Summary & Earning/Deduction',
    de: 'Zusammenfassung & Verdienst/Abzug',
    ar: 'الملخص والمكاسب/الاستقطاعات',
  },
  pPerPage: {
    tr: 'Sayfadaki Personel Sayısı',
    en: 'Employees per Page',
    de: 'Mitarbeiter pro Seite',
    ar: 'عدد الموظفين في الصفحة',
  },
  pFilterBlock: { tr: 'Filtre', en: 'Filter', de: 'Filter', ar: 'المُرشِّح' },
  pShowDate: { tr: 'Tarih Göster', en: 'Show Date', de: 'Datum anzeigen', ar: 'إظهار التاريخ' },
  pPageNumbers: {
    tr: 'Sayfa Numarası Yazdır',
    en: 'Print Page Numbers',
    de: 'Seitenzahlen drucken',
    ar: 'طباعة أرقام الصفحات',
  },
  pOutput: { tr: 'Rapor Türü', en: 'Output Format', de: 'Ausgabeformat', ar: 'صيغة الإخراج' },
  pEmail: { tr: 'E-Posta', en: 'E-mail', de: 'E-Mail', ar: 'البريد الإلكتروني' },
  pFont: { tr: 'Yazı Tipi', en: 'Font', de: 'Schriftart', ar: 'نوع الخط' },
  pShowFooter: {
    tr: 'Alt Bilgi Göster',
    en: 'Show Footer',
    de: 'Fußzeile anzeigen',
    ar: 'إظهار التذييل',
  },

  // --- Ortak seçenek değerleri ---
  optAll: { tr: 'Tümü', en: 'All', de: 'Alle', ar: 'الكل' },
  optSelect: { tr: 'Seçiniz', en: 'Select', de: 'Auswählen', ar: 'اختر' },
  optShow: { tr: 'Göster', en: 'Show', de: 'Anzeigen', ar: 'إظهار' },
  optHide: { tr: 'Gösterme', en: 'Hide', de: 'Ausblenden', ar: 'إخفاء' },
  optYes: { tr: 'Evet', en: 'Yes', de: 'Ja', ar: 'نعم' },
  optNo: { tr: 'Hayır', en: 'No', de: 'Nein', ar: 'لا' },
  optAuto: { tr: 'Otomatik', en: 'Automatic', de: 'Automatisch', ar: 'تلقائي' },
  optBuying: { tr: 'Alış', en: 'Buying', de: 'Ankauf', ar: 'شراء' },
  optSelling: { tr: 'Satış', en: 'Selling', de: 'Verkauf', ar: 'بيع' },

  // Bordro Tipi
  optSourceAuto: {
    tr: 'Kayıtlı bordro varsa onu kullan',
    en: 'Use the saved run when available',
    de: 'Gespeicherten Lauf verwenden, falls vorhanden',
    ar: 'استخدم التشغيل المحفوظ إن وُجد',
  },
  optSourceSaved: {
    tr: 'Yalnız kayıtlı bordro',
    en: 'Saved run only',
    de: 'Nur gespeicherter Lauf',
    ar: 'التشغيل المحفوظ فقط',
  },
  optSourceLive: {
    tr: 'Anlık hesaplama',
    en: 'Live calculation',
    de: 'Live-Berechnung',
    ar: 'حساب فوري',
  },

  // Günlük/Saatlik ücret
  optWageFromTotal: {
    tr: 'Toplam Kazançtan Hesapla',
    en: 'Derive from Total Earning',
    de: 'Aus Gesamtverdienst berechnen',
    ar: 'احسب من إجمالي الكسب',
  },
  optWageFromGross: {
    tr: 'Brüt Ücretten Hesapla',
    en: 'Derive from Gross Salary',
    de: 'Aus Bruttolohn berechnen',
    ar: 'احسب من الأجر الإجمالي',
  },
  optWageHourly: {
    tr: 'Saatlik (Toplam Kazançtan)',
    en: 'Hourly (from Total Earning)',
    de: 'Stündlich (aus Gesamtverdienst)',
    ar: 'بالساعة (من إجمالي الكسب)',
  },

  // Bordro Türü (yerleşim)
  optLayoutDetailed: {
    tr: 'Detaylı Bordro',
    en: 'Detailed Register',
    de: 'Detailliertes Journal',
    ar: 'كشف مفصّل',
  },
  optLayoutSummary: {
    tr: 'Özet Bordro',
    en: 'Summary Register',
    de: 'Kurzjournal',
    ar: 'كشف موجز',
  },

  // Sayfa sonu
  optPageBreakNone: {
    tr: 'Kayıt Bölünmesin',
    en: 'Keep records together',
    de: 'Datensätze nicht trennen',
    ar: 'لا تفصل السجلات',
  },
  optPageBreakPerEmployee: {
    tr: 'Her Personel Yeni Sayfa',
    en: 'New page per employee',
    de: 'Neue Seite je Mitarbeiter',
    ar: 'صفحة جديدة لكل موظف',
  },

  // Eksik gün
  optMissingSingleLine: {
    tr: 'Eksik Gün ve Nedeni Tek Satır Şeklinde',
    en: 'Missing days and reason on a single line',
    de: 'Fehltage und Grund in einer Zeile',
    ar: 'الأيام الناقصة وسببها في سطر واحد',
  },
  optMissingSeparateLine: {
    tr: 'Eksik Gün Nedeni Ayrı Satırda',
    en: 'Missing-day reason on its own line',
    de: 'Grund der Fehltage in eigener Zeile',
    ar: 'سبب الأيام الناقصة في سطر مستقل',
  },

  // İcmal / kazanç-kesinti yerleşimi
  optTablesSeparate: {
    tr: 'Excelde Ayrı Tablolarda Yazdır',
    en: 'Separate sheets in Excel',
    de: 'In Excel als separate Blätter',
    ar: 'أوراق منفصلة في Excel',
  },
  optTablesSame: {
    tr: 'Aynı Tabloda Yazdır',
    en: 'Same sheet',
    de: 'Im selben Blatt',
    ar: 'في نفس الورقة',
  },

  // Sayfadaki personel sayısı
  optPerPageAuto: {
    tr: 'Otomatik (Eğer personel bilgileri yarıda kalırsa)',
    en: 'Automatic (avoid splitting an employee)',
    de: 'Automatisch (Mitarbeiter nicht trennen)',
    ar: 'تلقائي (دون تقسيم بيانات الموظف)',
  },

  // Rapor türü
  optOutputExcel: {
    tr: 'Excel (xlsx)',
    en: 'Excel (xlsx)',
    de: 'Excel (xlsx)',
    ar: 'Excel (xlsx)',
  },
  optOutputPdf: { tr: 'PDF / Yazdır', en: 'PDF / Print', de: 'PDF / Drucken', ar: 'PDF / طباعة' },
  optOutputScreen: {
    tr: 'Ekranda Görüntüle',
    en: 'Show on screen',
    de: 'Auf dem Bildschirm',
    ar: 'عرض على الشاشة',
  },

  // E-posta
  optEmailNone: { tr: 'Gönderme', en: 'Do not send', de: 'Nicht senden', ar: 'لا ترسل' },
  optEmailSend: { tr: 'Gönder', en: 'Send', de: 'Senden', ar: 'أرسل' },
  emailToPlaceholder: {
    tr: 'alici@firma.com',
    en: 'recipient@company.com',
    de: 'empfaenger@firma.de',
    ar: 'recipient@company.com',
  },

  // --- Rapor başlık bloğu (kaynak dökümle aynı) ---
  hCompany: { tr: 'Kurum Adı', en: 'Company Name', de: 'Firmenname', ar: 'اسم الشركة' },
  hAddress: { tr: 'Adres', en: 'Address', de: 'Adresse', ar: 'العنوان' },
  hWorkplace: { tr: 'İşyeri Adı', en: 'Workplace', de: 'Betriebsstätte', ar: 'المنشأة' },
  hDepartment: { tr: 'Bölüm', en: 'Department', de: 'Abteilung', ar: 'القسم' },
  hSgkNo: {
    tr: 'SSK İşyeri No',
    en: 'SSI Workplace No',
    de: 'SV-Betriebsnummer',
    ar: 'رقم منشأة الضمان',
  },
  hSgkBranch: { tr: 'SSK Şube', en: 'SSI Branch', de: 'SV-Zweigstelle', ar: 'فرع الضمان' },
  hTaxOffice: { tr: 'Vergi Dairesi', en: 'Tax Office', de: 'Finanzamt', ar: 'مكتب الضرائب' },
  hTaxNumber: { tr: 'Vergi Numarası', en: 'Tax Number', de: 'Steuernummer', ar: 'الرقم الضريبي' },
  hPeriod: { tr: 'Ay / Yıl', en: 'Month / Year', de: 'Monat / Jahr', ar: 'الشهر / السنة' },
  hMersis: { tr: 'Mersis Numarası', en: 'Mersis Number', de: 'Mersis-Nummer', ar: 'رقم Mersis' },
  hCurrency: {
    tr: 'Döviz / Kur',
    en: 'Currency / Rate',
    de: 'Währung / Kurs',
    ar: 'العملة / السعر',
  },
  hReportDate: { tr: 'Rapor Tarihi', en: 'Report Date', de: 'Berichtsdatum', ar: 'تاريخ التقرير' },

  // --- Tablo içi sabitler ---
  rowTotals: { tr: 'Toplamlar: ', en: 'Totals: ', de: 'Summen: ', ar: ' :المجاميع' },
  rowNetEarning: { tr: 'Net Kazanç', en: 'Net Earning', de: 'Nettoverdienst', ar: 'الكسب الصافي' },
  rowNormalDays: { tr: 'Normal Gün', en: 'Normal Days', de: 'Normaltage', ar: 'الأيام العادية' },
  rowWeekend: { tr: 'Hafta Tatili', en: 'Weekly Rest', de: 'Wochenruhe', ar: 'الراحة الأسبوعية' },
  rowSick: { tr: 'Rapor', en: 'Sick Leave', de: 'Krankenstand', ar: 'تقرير مرضي' },
  rowAnnualLeave: { tr: 'Yıllık İzin', en: 'Annual Leave', de: 'Jahresurlaub', ar: 'إجازة سنوية' },
  rowUnpaid: {
    tr: 'Ücretsiz İzin',
    en: 'Unpaid Leave',
    de: 'Unbezahlter Urlaub',
    ar: 'إجازة بدون أجر',
  },
  rowMissingReason: {
    tr: 'Eksik Gün Nedeni',
    en: 'Missing-day reason',
    de: 'Grund der Fehltage',
    ar: 'سبب الأيام الناقصة',
  },

  icmalTitle: { tr: 'İCMAL', en: 'SUMMARY', de: 'ZUSAMMENFASSUNG', ar: 'الملخص' },
  icmalGroup: {
    tr: 'İşyeri / Kanun',
    en: 'Workplace / Law',
    de: 'Betrieb / Gesetz',
    ar: 'المنشأة / القانون',
  },
  icmalHeadcount: { tr: 'Personel', en: 'Headcount', de: 'Personen', ar: 'عدد الموظفين' },
  componentTotalsTitle: {
    tr: 'KAZANÇ / KESİNTİ TOPLAMLARI',
    en: 'EARNING / DEDUCTION TOTALS',
    de: 'VERDIENST- / ABZUGSSUMMEN',
    ar: 'مجاميع المكاسب / الاستقطاعات',
  },
  ctKind: { tr: 'Tür', en: 'Kind', de: 'Art', ar: 'النوع' },
  ctCode: { tr: 'Kod', en: 'Code', de: 'Code', ar: 'الرمز' },
  ctName: { tr: 'Açıklama', en: 'Description', de: 'Bezeichnung', ar: 'الوصف' },
  ctCount: { tr: 'Kişi', en: 'Count', de: 'Anzahl', ar: 'العدد' },
  ctTotal: { tr: 'Tutar', en: 'Amount', de: 'Betrag', ar: 'المبلغ' },
  ctEarning: { tr: 'Kazanç', en: 'Earning', de: 'Verdienst', ar: 'كسب' },
  ctDeduction: { tr: 'Kesinti', en: 'Deduction', de: 'Abzug', ar: 'استقطاع' },

  signPreparer: { tr: 'Düzenleyen', en: 'Prepared by', de: 'Erstellt von', ar: 'أعدّه' },
  signChecker: { tr: 'Kontrol Eden', en: 'Checked by', de: 'Geprüft von', ar: 'راجعه' },
  signApprover: { tr: 'Onaylayan', en: 'Approved by', de: 'Genehmigt von', ar: 'اعتمده' },
  pageOf: { tr: 'Sayfa', en: 'Page', de: 'Seite', ar: 'صفحة' },
  footerNote: {
    tr: 'M Suite — İK Bordro Dökümü',
    en: 'M Suite — HR Payroll Register',
    de: 'M Suite — HR-Lohnjournal',
    ar: 'M Suite — كشف رواتب الموارد البشرية',
  },

  // --- Sütun başlıkları (varsayılan 25 sütun kaynak dökümle birebir) ---
  cSeq: { tr: '#', en: '#', de: '#', ar: '#' },
  cName: { tr: 'Adı Soyadı', en: 'Full Name', de: 'Name', ar: 'الاسم واللقب' },
  cTcNo: { tr: 'TCKN', en: 'National ID', de: 'Ausweis-Nr.', ar: 'رقم الهوية' },
  cMissingDays: { tr: 'Eksik Gün ', en: 'Missing D.', de: 'Fehltage', ar: 'أيام ناقصة' },
  cStartDate: { tr: 'Giriş T', en: 'Hire D.', de: 'Eintritt', ar: 'ت.المباشرة' },
  cExitDate: { tr: 'Çıkış T', en: 'Exit D.', de: 'Austritt', ar: 'ت.الانتهاء' },
  cLawNo: { tr: 'Kanun', en: 'Law', de: 'Gesetz', ar: 'القانون' },
  cWageBasis: { tr: 'Ücret G/S', en: 'Wage D/H', de: 'Lohn T/Std', ar: 'الأجر ي/س' },
  cTotalDays: { tr: 'T.Gün', en: 'T.Days', de: 'Ges.Tage', ar: 'إج.الأيام' },
  cLeaveDays: { tr: 'İz.Gün', en: 'Lv.Days', de: 'Url.Tage', ar: 'أيام إجازة' },
  cNormalEarning: { tr: 'Nor.Kazanç', en: 'Base Earn.', de: 'Grundverd.', ar: 'الكسب العادي' },
  cAgi: { tr: 'AGİ', en: 'MLA', de: 'AGİ', ar: 'AGİ' },
  cTotalEarning: { tr: 'Top.Kazanç', en: 'Tot.Earn.', de: 'Ges.Verd.', ar: 'إج.الكسب' },
  cOtherEarning: { tr: 'Diğ.Kazanç', en: 'Oth.Earn.', de: 'Sonst.Verd.', ar: 'كسب آخر' },
  cSgkBase: { tr: 'SSK M.', en: 'SSI Base', de: 'SV-Bem.', ar: 'أساس الضمان' },
  cSgkEmployer: { tr: 'SSK İşveren', en: 'SSI Empr.', de: 'SV-AG', ar: 'ضمان ص.العمل' },
  cSgkEmployee: { tr: 'SSK İşçi', en: 'SSI Empl.', de: 'SV-AN', ar: 'ضمان العامل' },
  cGvBase: { tr: 'G.V.M', en: 'IT Base', de: 'ESt-Bem.', ar: 'أساس الضريبة' },
  cGvCumulative: { tr: 'Top.GVM', en: 'Cum.IT Base', de: 'Kum.ESt-Bem.', ar: 'الأساس التراكمي' },
  cIncomeTax: { tr: 'Gel.Ver.', en: 'Income Tax', de: 'ESt', ar: 'ضريبة الدخل' },
  cRemainingTax: { tr: 'Kalan GV', en: 'Net IT', de: 'Rest-ESt', ar: 'الضريبة المتبقية' },
  cStampDuty: { tr: 'Damga V', en: 'Stamp Duty', de: 'Stempelst.', ar: 'رسم الطوابع' },
  cSpecialDeduction: { tr: 'Öz.Kesinti', en: 'Oth.Deduct.', de: 'Sonst.Abz.', ar: 'استقطاع خاص' },
  cNetPaid: { tr: 'N.Ödenen', en: 'Net Paid', de: 'Nettozahlung', ar: 'الصافي المدفوع' },
  cSignature: { tr: 'İmza', en: 'Signature', de: 'Unterschrift', ar: 'التوقيع' },
  // Ek (varsayılan kapalı) sütunlar
  cUnempEmployee: {
    tr: 'İşsizlik İşçi',
    en: 'Unempl. Empl.',
    de: 'ALV-AN',
    ar: 'تأمين البطالة (عامل)',
  },
  cUnempEmployer: {
    tr: 'İşsizlik İşveren',
    en: 'Unempl. Empr.',
    de: 'ALV-AG',
    ar: 'تأمين البطالة (ص.عمل)',
  },
  cGrossSalary: { tr: 'Brüt Ücret', en: 'Gross Salary', de: 'Bruttolohn', ar: 'الأجر الإجمالي' },
  cGvExempt: {
    tr: 'AÜ GV İstisnası',
    en: 'Min.Wage IT Exempt.',
    de: 'ESt-Befr. Mindestlohn',
    ar: 'إعفاء ضريبة الحد الأدنى',
  },
  cDvExempt: {
    tr: 'AÜ DV İstisnası',
    en: 'Min.Wage SD Exempt.',
    de: 'Stempelst.-Befr.',
    ar: 'إعفاء رسم الطوابع',
  },
  cEmployerCost: {
    tr: 'İşveren Maliyeti',
    en: 'Employer Cost',
    de: 'AG-Kosten',
    ar: 'تكلفة صاحب العمل',
  },
  cDepartment: { tr: 'Bölüm', en: 'Department', de: 'Abteilung', ar: 'القسم' },
  cWorkplace: { tr: 'İşyeri', en: 'Workplace', de: 'Betrieb', ar: 'المنشأة' },
  cJobTitle: { tr: 'Görev', en: 'Job Title', de: 'Position', ar: 'المسمى الوظيفي' },
  cIban: { tr: 'IBAN', en: 'IBAN', de: 'IBAN', ar: 'IBAN' },
  cWorkedDays: { tr: 'Çalışılan Gün', en: 'Worked Days', de: 'Arbeitstage', ar: 'أيام العمل' },
  cOvertimeHours: { tr: 'F.Mesai Saat', en: 'Overtime Hrs', de: 'Überstunden', ar: 'ساعات إضافية' },

  // --- Kullanıcı mesajları ---
  msgNoData: {
    tr: 'Seçilen dönem ve filtrelerle bordro satırı bulunamadı.',
    en: 'No payroll rows found for the selected period and filters.',
    de: 'Für den gewählten Zeitraum und die Filter wurden keine Zeilen gefunden.',
    ar: 'لا توجد سجلات رواتب للفترة والمرشحات المحددة.',
  },
  msgNoSavedRun: {
    tr: 'Bu döneme ait kayıtlı bordro yok. "Anlık hesaplama" seçeneğiyle deneyin.',
    en: 'No saved payroll run for this period. Try the "Live calculation" option.',
    de: 'Kein gespeicherter Lauf für diesen Zeitraum. Versuchen Sie „Live-Berechnung“.',
    ar: 'لا يوجد تشغيل رواتب محفوظ لهذه الفترة. جرّب خيار «حساب فوري».',
  },
  msgReady: {
    tr: 'Rapor hazırlandı',
    en: 'Report generated',
    de: 'Bericht erstellt',
    ar: 'تم إنشاء التقرير',
  },
  msgEmailNeeded: {
    tr: 'E-posta göndermek için alıcı adresi girin.',
    en: 'Enter a recipient address to send the e-mail.',
    de: 'Geben Sie eine Empfängeradresse ein, um die E-Mail zu senden.',
    ar: 'أدخل عنوان المستلم لإرسال البريد الإلكتروني.',
  },
  msgEmailSent: {
    tr: 'E-posta gönderildi',
    en: 'E-mail sent',
    de: 'E-Mail gesendet',
    ar: 'تم إرسال البريد الإلكتروني',
  },
  msgEmailFailed: {
    tr: 'E-posta gönderilemedi',
    en: 'E-mail could not be sent',
    de: 'E-Mail konnte nicht gesendet werden',
    ar: 'تعذر إرسال البريد الإلكتروني',
  },
  msgPopupBlocked: {
    tr: 'Yazdırma penceresi açılamadı — tarayıcı pop-up iznini açın.',
    en: 'Print window could not be opened — allow browser pop-ups.',
    de: 'Druckfenster konnte nicht geöffnet werden — erlauben Sie Pop-ups.',
    ar: 'تعذر فتح نافذة الطباعة — فعّل النوافذ المنبثقة في المتصفح.',
  },
  btnRun: {
    tr: 'Raporu Oluştur',
    en: 'Generate Report',
    de: 'Bericht erstellen',
    ar: 'إنشاء التقرير',
  },
  btnColumns: { tr: 'Sütunlar', en: 'Columns', de: 'Spalten', ar: 'الأعمدة' },
  btnExcel: {
    tr: 'Excel indir',
    en: 'Download Excel',
    de: 'Excel herunterladen',
    ar: 'تنزيل Excel',
  },
  btnPrint: { tr: 'Yazdır / PDF', en: 'Print / PDF', de: 'Drucken / PDF', ar: 'طباعة / PDF' },
  btnFetchRate: { tr: 'Kur', en: 'Rate', de: 'Kurs', ar: 'السعر' },
  btnSelectAll: { tr: 'Tümünü seç', en: 'Select all', de: 'Alle auswählen', ar: 'اختر الكل' },
  btnResetColumns: {
    tr: 'Varsayılana dön',
    en: 'Reset to default',
    de: 'Standard wiederherstellen',
    ar: 'استعادة الافتراضي',
  },
  columnsModalTitle: {
    tr: 'Rapor Sütunları',
    en: 'Report Columns',
    de: 'Berichtsspalten',
    ar: 'أعمدة التقرير',
  },
  rowsCount: { tr: 'satır', en: 'rows', de: 'Zeilen', ar: 'سجل' },
} as const satisfies Record<string, PayrollDokumLabels>;

export type PayrollDokumLabelKey = keyof typeof PAYROLL_DOKUM_LABELS;

/** Etiketi verilen dilde döndürür (bilinmeyen dil → TR). */
export function dokumT(key: PayrollDokumLabelKey, lang: string | null | undefined): string {
  const entry = PAYROLL_DOKUM_LABELS[key];
  const l = (LANGS as readonly string[]).includes(String(lang)) ? (lang as PayrollDokumLang) : 'tr';
  return entry[l];
}

/** Ay adları — Excel başlığında "HAZİRAN / 2026" gibi kullanılır. */
const MONTH_NAMES: Record<PayrollDokumLang, readonly string[]> = {
  tr: [
    'OCAK',
    'ŞUBAT',
    'MART',
    'NİSAN',
    'MAYIS',
    'HAZİRAN',
    'TEMMUZ',
    'AĞUSTOS',
    'EYLÜL',
    'EKİM',
    'KASIM',
    'ARALIK',
  ],
  en: [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ],
  de: [
    'JANUAR',
    'FEBRUAR',
    'MÄRZ',
    'APRIL',
    'MAI',
    'JUNI',
    'JULI',
    'AUGUST',
    'SEPTEMBER',
    'OKTOBER',
    'NOVEMBER',
    'DEZEMBER',
  ],
  ar: [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ],
};

/** 1-12 → ay adı (verilen dilde, büyük harf). */
export function dokumMonthName(month: number, lang: string | null | undefined): string {
  const l = (LANGS as readonly string[]).includes(String(lang)) ? (lang as PayrollDokumLang) : 'tr';
  const names = MONTH_NAMES[l];
  return names[Math.min(11, Math.max(0, Math.trunc(month) - 1))] ?? '';
}

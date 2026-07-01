/**
 * Expense modülü için çok dilli etiket kataloğu (TR/EN/DE/AR).
 *
 * App.jsx I18N_DICT'inden bağımsız; modül kendi metinlerini taşır.
 * (Dil Ajanı kuralı: her UI metni baştan TR/EN/DE/AR.)
 */
export type Lang = 'tr' | 'en' | 'de' | 'ar';

export type ExpenseLabelKey =
  | 'cards.title'
  | 'cards.subtitle'
  | 'cards.count'
  | 'cards.new'
  | 'cards.close'
  | 'cards.reload'
  | 'cards.loading'
  | 'cards.search'
  | 'cards.includeInactive'
  | 'cards.empty'
  | 'cards.col.code'
  | 'cards.col.name'
  | 'cards.col.category'
  | 'cards.col.direction'
  | 'cards.col.account'
  | 'cards.col.actions'
  | 'cards.dir.in'
  | 'cards.dir.out'
  | 'cards.f.code'
  | 'cards.f.name'
  | 'cards.f.category'
  | 'cards.f.account'
  | 'cards.f.note'
  | 'cards.save'
  | 'cards.saving'
  | 'cards.cancel'
  | 'cards.edit'
  | 'cards.deactivate'
  | 'cards.deactivateConfirm'
  | 'cards.err.nameRequired'
  | 'cards.err.create'
  | 'cards.err.update'
  | 'cards.passive'
  | 'cards.newTitle'
  | 'cards.editTitle'
  | 'cards.sum.total'
  | 'cards.sum.income'
  | 'cards.sum.expense'
  | 'cards.status'
  | 'cards.status.active'
  | 'cards.status.passive'
  | 'cards.tab.general'
  | 'cards.tab.accounting'
  | 'cards.tab.budget'
  | 'cards.f.direction'
  | 'cards.f.kdv'
  | 'cards.f.tevkifat'
  | 'cards.f.taxDeductible'
  | 'cards.f.taxDeductibleHint'
  | 'cards.f.costCenter'
  | 'cards.f.paymentMethod'
  | 'cards.f.currency'
  | 'cards.f.defaultAmount'
  | 'cards.f.monthlyBudget'
  | 'cards.f.recurring'
  | 'cards.f.vendor'
  | 'cards.pm.cash'
  | 'cards.pm.card'
  | 'cards.pm.transfer'
  | 'cards.pm.none'
  | 'cards.meta.noAccount'
  | 'cards.meta.budget'
  | 'cards.ledger.tooltip'
  | 'cards.ledger.title'
  | 'cards.ledger.empty'
  | 'cards.ledger.count'
  | 'cards.ledger.totalIn'
  | 'cards.ledger.totalOut'
  | 'cards.ledger.net'
  | 'cards.ledger.col.date'
  | 'cards.ledger.col.desc'
  | 'cards.ledger.col.dir'
  | 'cards.ledger.col.method'
  | 'cards.ledger.col.source'
  | 'cards.ledger.col.amount'
  | 'imp.title'
  | 'imp.format'
  | 'imp.format.canTekel'
  | 'imp.format.generic'
  | 'imp.targetKasa'
  | 'imp.file'
  | 'imp.includeCard'
  | 'imp.createCards'
  | 'imp.preview'
  | 'imp.parsing'
  | 'imp.confirm'
  | 'imp.importing'
  | 'imp.cancel'
  | 'imp.summary'
  | 'imp.entries'
  | 'imp.totalIn'
  | 'imp.totalOut'
  | 'imp.dateRange'
  | 'imp.sheets'
  | 'imp.detectedCards'
  | 'imp.warnings'
  | 'imp.previewNote'
  | 'imp.col.date'
  | 'imp.col.type'
  | 'imp.col.amount'
  | 'imp.col.method'
  | 'imp.col.desc'
  | 'imp.col.category'
  | 'imp.method.cash'
  | 'imp.method.card'
  | 'imp.noFile'
  | 'imp.noEntries'
  | 'imp.readError'
  | 'imp.mapping'
  | 'imp.map.headerRow'
  | 'imp.map.date'
  | 'imp.map.desc'
  | 'imp.map.amountIn'
  | 'imp.map.amountOut'
  | 'imp.map.amount'
  | 'imp.map.type'
  | 'imp.map.category'
  | 'imp.map.invoiceNo'
  | 'imp.map.none'
  | 'imp.done';

const DICT: Record<ExpenseLabelKey, Record<Lang, string>> = {
  'cards.title': {
    tr: 'Gider Kartları',
    en: 'Expense Cards',
    de: 'Ausgabenkarten',
    ar: 'بطاقات المصروفات',
  },
  'cards.subtitle': {
    tr: 'Kasa ve gider hareketleri için tanımlı gider kartları (malzeme kartları gibi).',
    en: 'Defined expense cards for cash and expense transactions (like material cards).',
    de: 'Definierte Ausgabenkarten für Kassen- und Ausgabenbewegungen (wie Materialkarten).',
    ar: 'بطاقات مصروفات معرّفة لحركات الصندوق والمصروفات (مثل بطاقات المواد).',
  },
  'cards.count': {
    tr: 'Gider Kartları',
    en: 'Expense Cards',
    de: 'Ausgabenkarten',
    ar: 'بطاقات المصروفات',
  },
  'cards.new': {
    tr: '+ Gider Kartı',
    en: '+ Expense Card',
    de: '+ Ausgabenkarte',
    ar: '+ بطاقة مصروف',
  },
  'cards.close': { tr: 'Kapat', en: 'Close', de: 'Schließen', ar: 'إغلاق' },
  'cards.reload': { tr: 'Yenile', en: 'Reload', de: 'Neu laden', ar: 'تحديث' },
  'cards.loading': { tr: 'Yükleniyor…', en: 'Loading…', de: 'Lädt…', ar: 'جارٍ التحميل…' },
  'cards.search': {
    tr: 'Ara (kod/ad/mahiyet)',
    en: 'Search (code/name/category)',
    de: 'Suche (Code/Name/Kategorie)',
    ar: 'بحث (الرمز/الاسم/الفئة)',
  },
  'cards.includeInactive': {
    tr: 'Pasifleri göster',
    en: 'Show inactive',
    de: 'Inaktive anzeigen',
    ar: 'عرض غير النشطة',
  },
  'cards.empty': {
    tr: 'Henüz gider kartı yok.',
    en: 'No expense cards yet.',
    de: 'Noch keine Ausgabenkarten.',
    ar: 'لا توجد بطاقات مصروفات بعد.',
  },
  'cards.col.code': { tr: 'Kod', en: 'Code', de: 'Code', ar: 'الرمز' },
  'cards.col.name': { tr: 'Ad', en: 'Name', de: 'Name', ar: 'الاسم' },
  'cards.col.category': {
    tr: 'Mahiyet / Grup',
    en: 'Category / Group',
    de: 'Kategorie / Gruppe',
    ar: 'الفئة / المجموعة',
  },
  'cards.col.direction': { tr: 'Yön', en: 'Direction', de: 'Richtung', ar: 'الاتجاه' },
  'cards.col.account': { tr: 'Muh. Hesap', en: 'Account', de: 'Konto', ar: 'الحساب' },
  'cards.col.actions': { tr: 'İşlem', en: 'Actions', de: 'Aktionen', ar: 'إجراءات' },
  'cards.dir.in': { tr: 'Gelir', en: 'Income', de: 'Einnahme', ar: 'دخل' },
  'cards.dir.out': { tr: 'Gider', en: 'Expense', de: 'Ausgabe', ar: 'مصروف' },
  'cards.f.code': {
    tr: 'Kod (ops. — boş bırak: otomatik)',
    en: 'Code (opt. — empty: auto)',
    de: 'Code (opt. — leer: auto)',
    ar: 'الرمز (اختياري — فارغ: تلقائي)',
  },
  'cards.f.name': {
    tr: 'Gider kartı adı',
    en: 'Expense card name',
    de: 'Name der Ausgabenkarte',
    ar: 'اسم بطاقة المصروف',
  },
  'cards.f.category': {
    tr: 'Mahiyet / grup (ops.)',
    en: 'Category / group (opt.)',
    de: 'Kategorie / Gruppe (opt.)',
    ar: 'الفئة / المجموعة (اختياري)',
  },
  'cards.f.account': {
    tr: 'Muhasebe hesap kodu (ops.)',
    en: 'Account code (opt.)',
    de: 'Kontocode (opt.)',
    ar: 'رمز الحساب (اختياري)',
  },
  'cards.f.note': {
    tr: 'Not (ops.)',
    en: 'Note (opt.)',
    de: 'Notiz (opt.)',
    ar: 'ملاحظة (اختياري)',
  },
  'cards.save': { tr: 'Kaydet', en: 'Save', de: 'Speichern', ar: 'حفظ' },
  'cards.saving': { tr: 'Kaydediliyor…', en: 'Saving…', de: 'Speichern…', ar: 'جارٍ الحفظ…' },
  'cards.cancel': { tr: 'İptal', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' },
  'cards.edit': { tr: 'Düzenle', en: 'Edit', de: 'Bearbeiten', ar: 'تعديل' },
  'cards.deactivate': {
    tr: 'Pasifleştir',
    en: 'Deactivate',
    de: 'Deaktivieren',
    ar: 'إلغاء التنشيط',
  },
  'cards.deactivateConfirm': {
    tr: 'Bu gider kartını pasifleştirmek istediğinizden emin misiniz?',
    en: 'Are you sure you want to deactivate this expense card?',
    de: 'Möchten Sie diese Ausgabenkarte wirklich deaktivieren?',
    ar: 'هل أنت متأكد أنك تريد إلغاء تنشيط بطاقة المصروف هذه؟',
  },
  'cards.err.nameRequired': {
    tr: 'Gider kartı adı zorunlu',
    en: 'Name is required',
    de: 'Name erforderlich',
    ar: 'الاسم مطلوب',
  },
  'cards.err.create': {
    tr: 'Gider kartı eklenemedi',
    en: 'Could not create expense card',
    de: 'Ausgabenkarte konnte nicht erstellt werden',
    ar: 'تعذر إنشاء بطاقة المصروف',
  },
  'cards.err.update': {
    tr: 'Gider kartı güncellenemedi',
    en: 'Could not update expense card',
    de: 'Ausgabenkarte konnte nicht aktualisiert werden',
    ar: 'تعذر تحديث بطاقة المصروف',
  },
  'cards.passive': { tr: '(pasif)', en: '(inactive)', de: '(inaktiv)', ar: '(غير نشط)' },
  'cards.newTitle': {
    tr: 'Yeni Gider Kartı',
    en: 'New Expense Card',
    de: 'Neue Ausgabenkarte',
    ar: 'بطاقة مصروف جديدة',
  },
  'cards.editTitle': {
    tr: 'Gider Kartı Düzenle',
    en: 'Edit Expense Card',
    de: 'Ausgabenkarte bearbeiten',
    ar: 'تعديل بطاقة المصروف',
  },
  'cards.sum.total': { tr: 'Toplam', en: 'Total', de: 'Gesamt', ar: 'الإجمالي' },
  'cards.sum.income': { tr: 'Gelir', en: 'Income', de: 'Einnahme', ar: 'دخل' },
  'cards.sum.expense': { tr: 'Gider', en: 'Expense', de: 'Ausgabe', ar: 'مصروف' },
  'cards.status': { tr: 'Durum', en: 'Status', de: 'Status', ar: 'الحالة' },
  'cards.status.active': { tr: 'Aktif', en: 'Active', de: 'Aktiv', ar: 'نشط' },
  'cards.status.passive': { tr: 'Pasif', en: 'Inactive', de: 'Inaktiv', ar: 'غير نشط' },
  'cards.tab.general': { tr: 'Genel', en: 'General', de: 'Allgemein', ar: 'عام' },
  'cards.tab.accounting': {
    tr: 'Muhasebe & Vergi',
    en: 'Accounting & Tax',
    de: 'Buchhaltung & Steuer',
    ar: 'المحاسبة والضرائب',
  },
  'cards.tab.budget': {
    tr: 'Bütçe & Varsayılanlar',
    en: 'Budget & Defaults',
    de: 'Budget & Standardwerte',
    ar: 'الميزانية والإعدادات الافتراضية',
  },
  'cards.f.direction': { tr: 'Yön', en: 'Direction', de: 'Richtung', ar: 'الاتجاه' },
  'cards.f.kdv': {
    tr: 'KDV Oranı (%)',
    en: 'VAT Rate (%)',
    de: 'MwSt.-Satz (%)',
    ar: 'نسبة الضريبة (%)',
  },
  'cards.f.tevkifat': {
    tr: 'Tevkifat Kodu',
    en: 'Withholding Code',
    de: 'Einbehaltungscode',
    ar: 'رمز الاقتطاع',
  },
  'cards.f.taxDeductible': {
    tr: 'Kanunen Kabul Edilen Gider',
    en: 'Tax-Deductible Expense',
    de: 'Steuerlich absetzbar',
    ar: 'مصروف قابل للخصم الضريبي',
  },
  'cards.f.taxDeductibleHint': {
    tr: 'İşaretli değilse KKEG (kanunen kabul edilmeyen gider) sayılır.',
    en: 'If unchecked, treated as a non-deductible expense.',
    de: 'Wenn nicht markiert, als nicht abzugsfähig behandelt.',
    ar: 'إذا لم يُحدد، يُعامل كمصروف غير قابل للخصم.',
  },
  'cards.f.costCenter': {
    tr: 'Masraf Merkezi / Proje',
    en: 'Cost Center / Project',
    de: 'Kostenstelle / Projekt',
    ar: 'مركز التكلفة / المشروع',
  },
  'cards.f.paymentMethod': {
    tr: 'Varsayılan Ödeme Yöntemi',
    en: 'Default Payment Method',
    de: 'Standard-Zahlungsart',
    ar: 'طريقة الدفع الافتراضية',
  },
  'cards.f.currency': { tr: 'Para Birimi', en: 'Currency', de: 'Währung', ar: 'العملة' },
  'cards.f.defaultAmount': {
    tr: 'Varsayılan Tutar',
    en: 'Default Amount',
    de: 'Standardbetrag',
    ar: 'المبلغ الافتراضي',
  },
  'cards.f.monthlyBudget': {
    tr: 'Aylık Bütçe Limiti',
    en: 'Monthly Budget Limit',
    de: 'Monatliches Budgetlimit',
    ar: 'حد الميزانية الشهري',
  },
  'cards.f.recurring': {
    tr: 'Düzenli / Tekrarlayan Gider',
    en: 'Recurring Expense',
    de: 'Wiederkehrende Ausgabe',
    ar: 'مصروف متكرر',
  },
  'cards.f.vendor': {
    tr: 'Varsayılan Tedarikçi / Cari',
    en: 'Default Vendor',
    de: 'Standard-Lieferant',
    ar: 'المورّد الافتراضي',
  },
  'cards.pm.cash': { tr: 'Nakit', en: 'Cash', de: 'Bar', ar: 'نقد' },
  'cards.pm.card': { tr: 'Kredi Kartı', en: 'Card', de: 'Karte', ar: 'بطاقة' },
  'cards.pm.transfer': { tr: 'Havale / EFT', en: 'Transfer', de: 'Überweisung', ar: 'تحويل' },
  'cards.pm.none': { tr: '— seçilmedi —', en: '— none —', de: '— keine —', ar: '— لا شيء —' },
  'cards.meta.noAccount': {
    tr: 'Hesap yok',
    en: 'No account',
    de: 'Kein Konto',
    ar: 'لا يوجد حساب',
  },
  'cards.meta.budget': { tr: 'Bütçe', en: 'Budget', de: 'Budget', ar: 'الميزانية' },
  'cards.ledger.tooltip': {
    tr: 'Ekstre (hareket dökümü)',
    en: 'Statement (transactions)',
    de: 'Kontoauszug (Bewegungen)',
    ar: 'كشف الحركات',
  },
  'cards.ledger.title': { tr: 'Ekstre', en: 'Statement', de: 'Kontoauszug', ar: 'كشف الحساب' },
  'cards.ledger.empty': {
    tr: 'Bu gider kartına ait kasa hareketi bulunamadı.',
    en: 'No cash transactions found for this expense card.',
    de: 'Keine Kassenbewegungen für diese Ausgabenkarte gefunden.',
    ar: 'لا توجد حركات صندوق لبطاقة المصروف هذه.',
  },
  'cards.ledger.count': { tr: 'Hareket', en: 'Transactions', de: 'Bewegungen', ar: 'حركات' },
  'cards.ledger.totalIn': {
    tr: 'Toplam Giriş',
    en: 'Total In',
    de: 'Summe Eingang',
    ar: 'إجمالي الوارد',
  },
  'cards.ledger.totalOut': {
    tr: 'Toplam Çıkış',
    en: 'Total Out',
    de: 'Summe Ausgang',
    ar: 'إجمالي الصادر',
  },
  'cards.ledger.net': { tr: 'Net', en: 'Net', de: 'Netto', ar: 'الصافي' },
  'cards.ledger.col.date': { tr: 'Tarih', en: 'Date', de: 'Datum', ar: 'التاريخ' },
  'cards.ledger.col.desc': { tr: 'Açıklama', en: 'Description', de: 'Beschreibung', ar: 'الوصف' },
  'cards.ledger.col.dir': { tr: 'Yön', en: 'Direction', de: 'Richtung', ar: 'الاتجاه' },
  'cards.ledger.col.method': { tr: 'Ödeme', en: 'Method', de: 'Methode', ar: 'الدفع' },
  'cards.ledger.col.source': {
    tr: 'Kasa/Kaynak',
    en: 'Cash box/Source',
    de: 'Kasse/Quelle',
    ar: 'الصندوق/المصدر',
  },
  'cards.ledger.col.amount': { tr: 'Tutar', en: 'Amount', de: 'Betrag', ar: 'المبلغ' },

  'imp.title': {
    tr: 'Excel’den Kasa İçe Aktar',
    en: 'Import Cash from Excel',
    de: 'Kasse aus Excel importieren',
    ar: 'استيراد الصندوق من Excel',
  },
  'imp.format': { tr: 'Excel formatı', en: 'Excel format', de: 'Excel-Format', ar: 'تنسيق Excel' },
  'imp.format.canTekel': {
    tr: 'CAN TEKEL Günlük Kasa Raporu',
    en: 'CAN TEKEL Daily Cash Report',
    de: 'CAN TEKEL Tageskassenbericht',
    ar: 'تقرير CAN TEKEL النقدي اليومي',
  },
  'imp.format.generic': {
    tr: 'Genel (kolon eşleme)',
    en: 'Generic (column mapping)',
    de: 'Generisch (Spaltenzuordnung)',
    ar: 'عام (تعيين الأعمدة)',
  },
  'imp.targetKasa': {
    tr: 'Hedef kasa',
    en: 'Target cash box',
    de: 'Ziel-Kasse',
    ar: 'الصندوق المستهدف',
  },
  'imp.file': { tr: 'Excel dosyası', en: 'Excel file', de: 'Excel-Datei', ar: 'ملف Excel' },
  'imp.includeCard': {
    tr: 'Kredi kartı hareketlerini de dahil et',
    en: 'Include credit card transactions too',
    de: 'Kreditkartenbewegungen einbeziehen',
    ar: 'تضمين معاملات بطاقة الائتمان',
  },
  'imp.createCards': {
    tr: 'Tespit edilen gider kartlarını oluştur',
    en: 'Create detected expense cards',
    de: 'Erkannte Ausgabenkarten erstellen',
    ar: 'إنشاء بطاقات المصروفات المكتشفة',
  },
  'imp.preview': { tr: 'Önizle', en: 'Preview', de: 'Vorschau', ar: 'معاينة' },
  'imp.parsing': {
    tr: 'Çözümleniyor…',
    en: 'Parsing…',
    de: 'Wird analysiert…',
    ar: 'جارٍ التحليل…',
  },
  'imp.confirm': { tr: 'İçe Aktar', en: 'Import', de: 'Importieren', ar: 'استيراد' },
  'imp.importing': {
    tr: 'Aktarılıyor…',
    en: 'Importing…',
    de: 'Importieren…',
    ar: 'جارٍ الاستيراد…',
  },
  'imp.cancel': { tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' },
  'imp.summary': { tr: 'Özet', en: 'Summary', de: 'Zusammenfassung', ar: 'ملخّص' },
  'imp.entries': { tr: 'Hareket', en: 'Entries', de: 'Bewegungen', ar: 'حركات' },
  'imp.totalIn': { tr: 'Toplam Giriş', en: 'Total In', de: 'Summe Eingang', ar: 'إجمالي الوارد' },
  'imp.totalOut': { tr: 'Toplam Çıkış', en: 'Total Out', de: 'Summe Ausgang', ar: 'إجمالي الصادر' },
  'imp.dateRange': {
    tr: 'Tarih aralığı',
    en: 'Date range',
    de: 'Datumsbereich',
    ar: 'النطاق الزمني',
  },
  'imp.sheets': { tr: 'Sayfa', en: 'Sheets', de: 'Blätter', ar: 'أوراق' },
  'imp.detectedCards': {
    tr: 'Tespit edilen gider kartları',
    en: 'Detected expense cards',
    de: 'Erkannte Ausgabenkarten',
    ar: 'بطاقات المصروفات المكتشفة',
  },
  'imp.warnings': { tr: 'Uyarılar', en: 'Warnings', de: 'Warnungen', ar: 'تحذيرات' },
  'imp.previewNote': {
    tr: 'İlk 50 hareket gösteriliyor.',
    en: 'Showing first 50 entries.',
    de: 'Erste 50 Bewegungen werden angezeigt.',
    ar: 'عرض أول 50 حركة.',
  },
  'imp.col.date': { tr: 'Tarih', en: 'Date', de: 'Datum', ar: 'التاريخ' },
  'imp.col.type': { tr: 'Tip', en: 'Type', de: 'Typ', ar: 'النوع' },
  'imp.col.amount': { tr: 'Tutar', en: 'Amount', de: 'Betrag', ar: 'المبلغ' },
  'imp.col.method': { tr: 'Ödeme', en: 'Method', de: 'Methode', ar: 'الدفع' },
  'imp.col.desc': { tr: 'Açıklama', en: 'Description', de: 'Beschreibung', ar: 'الوصف' },
  'imp.col.category': { tr: 'Mahiyet', en: 'Category', de: 'Kategorie', ar: 'الفئة' },
  'imp.method.cash': { tr: 'Nakit', en: 'Cash', de: 'Bar', ar: 'نقد' },
  'imp.method.card': { tr: 'Kredi Kartı', en: 'Card', de: 'Karte', ar: 'بطاقة' },
  'imp.noFile': {
    tr: 'Önce bir Excel dosyası seçin',
    en: 'Select an Excel file first',
    de: 'Wählen Sie zuerst eine Excel-Datei',
    ar: 'اختر ملف Excel أولاً',
  },
  'imp.noEntries': {
    tr: 'İçe aktarılacak hareket bulunamadı',
    en: 'No entries to import',
    de: 'Keine Bewegungen zum Importieren',
    ar: 'لا توجد حركات للاستيراد',
  },
  'imp.readError': {
    tr: 'Excel dosyası okunamadı',
    en: 'Could not read Excel file',
    de: 'Excel-Datei konnte nicht gelesen werden',
    ar: 'تعذر قراءة ملف Excel',
  },
  'imp.mapping': {
    tr: 'Kolon eşleme',
    en: 'Column mapping',
    de: 'Spaltenzuordnung',
    ar: 'تعيين الأعمدة',
  },
  'imp.map.headerRow': { tr: 'Başlık satırı', en: 'Header row', de: 'Kopfzeile', ar: 'صف العنوان' },
  'imp.map.date': { tr: 'Tarih sütunu', en: 'Date column', de: 'Datumsspalte', ar: 'عمود التاريخ' },
  'imp.map.desc': {
    tr: 'Açıklama sütunu',
    en: 'Description column',
    de: 'Beschreibungsspalte',
    ar: 'عمود الوصف',
  },
  'imp.map.amountIn': {
    tr: 'Giriş tutarı sütunu',
    en: 'Amount-in column',
    de: 'Eingangsbetrag-Spalte',
    ar: 'عمود المبلغ الوارد',
  },
  'imp.map.amountOut': {
    tr: 'Çıkış tutarı sütunu',
    en: 'Amount-out column',
    de: 'Ausgangsbetrag-Spalte',
    ar: 'عمود المبلغ الصادر',
  },
  'imp.map.amount': {
    tr: 'Tutar sütunu (tek)',
    en: 'Amount column (single)',
    de: 'Betragsspalte (einzeln)',
    ar: 'عمود المبلغ (واحد)',
  },
  'imp.map.type': {
    tr: 'Tip sütunu (giriş/çıkış)',
    en: 'Type column (in/out)',
    de: 'Typspalte (ein/aus)',
    ar: 'عمود النوع (وارد/صادر)',
  },
  'imp.map.category': {
    tr: 'Mahiyet sütunu',
    en: 'Category column',
    de: 'Kategoriespalte',
    ar: 'عمود الفئة',
  },
  'imp.map.invoiceNo': {
    tr: 'Fatura no sütunu',
    en: 'Invoice no. column',
    de: 'Rechnungsnr.-Spalte',
    ar: 'عمود رقم الفاتورة',
  },
  'imp.map.none': { tr: '— yok —', en: '— none —', de: '— keine —', ar: '— لا شيء —' },
  'imp.done': { tr: 'içe aktarıldı', en: 'imported', de: 'importiert', ar: 'تم الاستيراد' },
};

export function el(key: ExpenseLabelKey, lang: string): string {
  const row = DICT[key];
  const l: Lang = lang === 'en' || lang === 'de' || lang === 'ar' ? lang : 'tr';
  return row[l];
}

/**
 * Sabit Kıymet modülü i18n kataloğu (TR/EN/DE/AR).
 * App.jsx I18N_DICT'e alternatif modül-yerel kalıp (performance/i18n.ts örneği).
 * Kullanım: tfa("cards.title", lang)
 */

const CAT = {
  // Genel
  'module.title': {
    tr: 'Sabit Kıymet Yönetimi',
    en: 'Fixed Asset Management',
    de: 'Anlagenverwaltung',
    ar: 'إدارة الأصول الثابتة',
  },
  'tab.cards': {
    tr: 'Kıymet Kartları',
    en: 'Asset Cards',
    de: 'Anlagenkarten',
    ar: 'بطاقات الأصول',
  },
  'tab.depreciation': { tr: 'Amortisman', en: 'Depreciation', de: 'Abschreibung', ar: 'الإهلاك' },
  'tab.movements': { tr: 'Hareketler', en: 'Movements', de: 'Bewegungen', ar: 'الحركات' },
  'tab.reports': { tr: 'Raporlar', en: 'Reports', de: 'Berichte', ar: 'التقارير' },
  'common.search': {
    tr: 'Ara (kod, ad)...',
    en: 'Search (code, name)...',
    de: 'Suchen (Code, Name)...',
    ar: 'بحث (الرمز، الاسم)...',
  },
  'common.all': { tr: 'Tümü', en: 'All', de: 'Alle', ar: 'الكل' },
  'common.actions': { tr: 'İşlem', en: 'Actions', de: 'Aktionen', ar: 'إجراءات' },
  'common.save': { tr: 'Kaydet', en: 'Save', de: 'Speichern', ar: 'حفظ' },
  'common.cancel': { tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' },
  'common.edit': { tr: 'Düzenle', en: 'Edit', de: 'Bearbeiten', ar: 'تعديل' },
  'common.delete': { tr: 'Sil', en: 'Delete', de: 'Löschen', ar: 'حذف' },
  'common.total': { tr: 'Toplam', en: 'Total', de: 'Gesamt', ar: 'الإجمالي' },
  'common.date': { tr: 'Tarih', en: 'Date', de: 'Datum', ar: 'التاريخ' },
  'common.notes': { tr: 'Notlar', en: 'Notes', de: 'Notizen', ar: 'ملاحظات' },
  'common.empty': {
    tr: 'Kayıt yok.',
    en: 'No records.',
    de: 'Keine Einträge.',
    ar: 'لا توجد سجلات.',
  },
  'common.select': { tr: 'Seçin...', en: 'Select...', de: 'Auswählen...', ar: 'اختر...' },

  // Kart alanları
  'field.code': { tr: 'Kod', en: 'Code', de: 'Code', ar: 'الرمز' },
  'field.name': { tr: 'Kıymet Adı', en: 'Asset Name', de: 'Anlagenname', ar: 'اسم الأصل' },
  'field.category': { tr: 'Kategori', en: 'Category', de: 'Kategorie', ar: 'الفئة' },
  'field.location': { tr: 'Lokasyon', en: 'Location', de: 'Standort', ar: 'الموقع' },
  'field.department': { tr: 'Departman', en: 'Department', de: 'Abteilung', ar: 'القسم' },
  'field.employee': {
    tr: 'Sorumlu Personel',
    en: 'Responsible Employee',
    de: 'Verantwortlicher',
    ar: 'الموظف المسؤول',
  },
  'field.acquisitionDate': {
    tr: 'Edinim Tarihi',
    en: 'Acquisition Date',
    de: 'Anschaffungsdatum',
    ar: 'تاريخ الاقتناء',
  },
  'field.acquisitionCost': {
    tr: 'Edinim Bedeli (KDV hariç)',
    en: 'Acquisition Cost (excl. VAT)',
    de: 'Anschaffungskosten (o. USt.)',
    ar: 'تكلفة الاقتناء (بدون ض.ق.م)',
  },
  'field.usefulLife': {
    tr: 'Faydalı Ömür (yıl)',
    en: 'Useful Life (years)',
    de: 'Nutzungsdauer (Jahre)',
    ar: 'العمر الإنتاجي (سنوات)',
  },
  'field.method': {
    tr: 'Amortisman Yöntemi',
    en: 'Depreciation Method',
    de: 'Abschreibungsmethode',
    ar: 'طريقة الإهلاك',
  },
  'field.isPassengerCar': {
    tr: 'Binek otomobil (kıst amortisman)',
    en: 'Passenger car (pro-rata)',
    de: 'Pkw (zeitanteilig)',
    ar: 'سيارة ركوب (إهلاك نسبي)',
  },
  'field.salvageValue': {
    tr: 'Hurda Değeri',
    en: 'Salvage Value',
    de: 'Restwert',
    ar: 'قيمة الخردة',
  },
  'field.openingAccumulated': {
    tr: 'Devir Birikmiş Amortisman',
    en: 'Opening Accum. Depreciation',
    de: 'Anfangsbestand kum. AfA',
    ar: 'الإهلاك المتراكم الافتتاحي',
  },
  'field.assetAccount': {
    tr: 'Kıymet Hesabı (25x)',
    en: 'Asset Account (25x)',
    de: 'Anlagenkonto (25x)',
    ar: 'حساب الأصل (25x)',
  },
  'field.accumAccount': {
    tr: 'Birikmiş Amortisman Hesabı (257/268)',
    en: 'Accum. Depreciation Account',
    de: 'Konto kum. AfA (257/268)',
    ar: 'حساب الإهلاك المتراكم',
  },
  'field.expenseAccount': {
    tr: 'Gider Hesabı (770/730/760)',
    en: 'Expense Account',
    de: 'Aufwandskonto',
    ar: 'حساب المصروف',
  },
  'field.status': { tr: 'Durum', en: 'Status', de: 'Status', ar: 'الحالة' },
  'field.accumulated': {
    tr: 'Birikmiş Amortisman',
    en: 'Accum. Depreciation',
    de: 'Kum. Abschreibung',
    ar: 'الإهلاك المتراكم',
  },
  'field.nbv': {
    tr: 'Net Defter Değeri',
    en: 'Net Book Value',
    de: 'Restbuchwert',
    ar: 'صافي القيمة الدفترية',
  },

  // Yöntem / durum / kategori / hareket tipleri
  'method.normal': {
    tr: 'Normal (doğrusal)',
    en: 'Straight-line',
    de: 'Linear',
    ar: 'القسط الثابت',
  },
  'method.declining': {
    tr: 'Azalan bakiyeler',
    en: 'Declining balance',
    de: 'Degressiv',
    ar: 'الرصيد المتناقص',
  },
  'status.active': { tr: 'Aktif', en: 'Active', de: 'Aktiv', ar: 'نشط' },
  'status.sold': { tr: 'Satıldı', en: 'Sold', de: 'Verkauft', ar: 'مُباع' },
  'status.scrapped': { tr: 'Hurdaya Ayrıldı', en: 'Scrapped', de: 'Verschrottet', ar: 'مُخرد' },
  'status.inactive': { tr: 'Pasif', en: 'Inactive', de: 'Inaktiv', ar: 'غير نشط' },
  'cat.bina': { tr: 'Bina', en: 'Building', de: 'Gebäude', ar: 'مبنى' },
  'cat.tasit': { tr: 'Taşıt', en: 'Vehicle', de: 'Fahrzeug', ar: 'مركبة' },
  'cat.binek_oto': { tr: 'Binek Otomobil', en: 'Passenger Car', de: 'Pkw', ar: 'سيارة ركوب' },
  'cat.makine': {
    tr: 'Makine ve Cihaz',
    en: 'Machinery & Equipment',
    de: 'Maschinen & Geräte',
    ar: 'آلات ومعدات',
  },
  'cat.demirbas': {
    tr: 'Demirbaş',
    en: 'Furniture & Fixtures',
    de: 'Betriebsausstattung',
    ar: 'أثاث وتجهيزات',
  },
  'cat.bilgisayar': {
    tr: 'Bilgisayar ve Donanım',
    en: 'Computers & Hardware',
    de: 'Computer & Hardware',
    ar: 'حواسيب وأجهزة',
  },
  'cat.yazilim': {
    tr: 'Yazılım / Haklar',
    en: 'Software / Rights',
    de: 'Software / Rechte',
    ar: 'برمجيات / حقوق',
  },
  'cat.ozel_maliyet': {
    tr: 'Özel Maliyet',
    en: 'Leasehold Improvement',
    de: 'Mietereinbauten',
    ar: 'تحسينات مستأجرة',
  },
  'cat.arazi': {
    tr: 'Arazi ve Arsa (amortismansız)',
    en: 'Land (non-depreciable)',
    de: 'Grundstück (keine AfA)',
    ar: 'أرض (بدون إهلاك)',
  },
  'cat.diger': { tr: 'Diğer', en: 'Other', de: 'Sonstige', ar: 'أخرى' },
  'mov.transfer': { tr: 'Transfer', en: 'Transfer', de: 'Umlagerung', ar: 'نقل' },
  'mov.sale': { tr: 'Satış', en: 'Sale', de: 'Verkauf', ar: 'بيع' },
  'mov.scrap': { tr: 'Hurda', en: 'Scrap', de: 'Verschrottung', ar: 'إخراد' },

  // Kartlar sekmesi
  'cards.new': { tr: 'Yeni Kıymet', en: 'New Asset', de: 'Neue Anlage', ar: 'أصل جديد' },
  'cards.editTitle': {
    tr: 'Kıymet Kartı Düzenle',
    en: 'Edit Asset Card',
    de: 'Anlagenkarte bearbeiten',
    ar: 'تعديل بطاقة الأصل',
  },
  'cards.newTitle': {
    tr: 'Yeni Kıymet Kartı',
    en: 'New Asset Card',
    de: 'Neue Anlagenkarte',
    ar: 'بطاقة أصل جديدة',
  },
  'cards.deleteBlockedRuns': {
    tr: 'amortisman koşumunda kullanılmış',
    en: 'used in a depreciation run',
    de: 'in einem AfA-Lauf verwendet',
    ar: 'مستخدم في تشغيل إهلاك',
  },
  'cards.deleteBlockedMovements': {
    tr: 'hareket kaydı var',
    en: 'has movement records',
    de: 'hat Bewegungen',
    ar: 'له سجلات حركة',
  },

  // Amortisman sekmesi
  'dep.runPanel': {
    tr: 'Amortisman Koşumu',
    en: 'Depreciation Run',
    de: 'Abschreibungslauf',
    ar: 'تشغيل الإهلاك',
  },
  'dep.period': {
    tr: 'Dönem Sonu (ay)',
    en: 'Period End (month)',
    de: 'Periodenende (Monat)',
    ar: 'نهاية الفترة (شهر)',
  },
  'dep.periodHint': {
    tr: 'Seçilen ay sonuna kadar tahakkuk etmesi gereken amortisman, daha önce kayıtlananlar düşülerek hesaplanır (mükerrer kayıt oluşmaz).',
    en: 'Depreciation accrued through the selected month, net of previously booked amounts (no double booking).',
    de: 'Bis zum gewählten Monat aufgelaufene AfA abzüglich bereits gebuchter Beträge (keine Doppelbuchung).',
    ar: 'الإهلاك المستحق حتى نهاية الشهر المحدد بعد خصم المبالغ المسجلة سابقاً (لا قيد مزدوج).',
  },
  'dep.preview': { tr: 'Önizle', en: 'Preview', de: 'Vorschau', ar: 'معاينة' },
  'dep.runAndPost': {
    tr: 'Koş ve Fişle',
    en: 'Run & Post',
    de: 'Ausführen & Buchen',
    ar: 'تشغيل وترحيل',
  },
  'dep.noLines': {
    tr: 'Bu dönem için ayrılacak amortisman yok.',
    en: 'Nothing to depreciate for this period.',
    de: 'Keine AfA für diese Periode.',
    ar: 'لا يوجد إهلاك لهذه الفترة.',
  },
  'dep.voucherCreated': {
    tr: 'Amortisman fişi oluşturuldu',
    en: 'Depreciation voucher posted',
    de: 'AfA-Beleg gebucht',
    ar: 'تم ترحيل سند الإهلاك',
  },
  'dep.history': {
    tr: 'Koşum Geçmişi',
    en: 'Run History',
    de: 'Laufhistorie',
    ar: 'سجل التشغيلات',
  },
  'dep.lineCount': { tr: 'Satır', en: 'Lines', de: 'Zeilen', ar: 'الأسطر' },
  'dep.voucherNo': { tr: 'Fiş No', en: 'Voucher No', de: 'Beleg-Nr.', ar: 'رقم السند' },
  'dep.deleteRunConfirm': {
    tr: 'Koşum ve bağlı yevmiye fişi birlikte silinecek. Bu işlem yalnızca en son koşum için yapılabilir.',
    en: 'The run and its journal voucher will be deleted together. Only the latest run can be deleted.',
    de: 'Lauf und zugehöriger Buchungsbeleg werden gelöscht. Nur der letzte Lauf kann gelöscht werden.',
    ar: 'سيُحذف التشغيل وسند اليومية المرتبط به معاً. يمكن حذف آخر تشغيل فقط.',
  },
  'dep.onlyLatestDeletable': {
    tr: 'Yalnızca en son koşum silinebilir',
    en: 'Only the latest run can be deleted',
    de: 'Nur der letzte Lauf kann gelöscht werden',
    ar: 'يمكن حذف آخر تشغيل فقط',
  },
  'dep.planViewer': {
    tr: 'Amortisman Planı',
    en: 'Depreciation Plan',
    de: 'Abschreibungsplan',
    ar: 'خطة الإهلاك',
  },
  'dep.planYear': { tr: 'Yıl', en: 'Year', de: 'Jahr', ar: 'السنة' },
  'dep.planAnnual': {
    tr: 'Yıllık Amortisman',
    en: 'Annual Depreciation',
    de: 'Jahres-AfA',
    ar: 'الإهلاك السنوي',
  },
  'dep.planAccum': {
    tr: 'Birikmiş (dönem sonu)',
    en: 'Accumulated (EoY)',
    de: 'Kumuliert (Jahresende)',
    ar: 'المتراكم (نهاية السنة)',
  },
  'dep.planNbv': {
    tr: 'Net Defter Değeri',
    en: 'Net Book Value',
    de: 'Restbuchwert',
    ar: 'صافي القيمة الدفترية',
  },
  'dep.amount': { tr: 'Tutar', en: 'Amount', de: 'Betrag', ar: 'المبلغ' },

  // Hareketler sekmesi
  'mov.new': { tr: 'Yeni Hareket', en: 'New Movement', de: 'Neue Bewegung', ar: 'حركة جديدة' },
  'mov.type': { tr: 'Hareket Tipi', en: 'Movement Type', de: 'Bewegungsart', ar: 'نوع الحركة' },
  'mov.asset': { tr: 'Sabit Kıymet', en: 'Fixed Asset', de: 'Anlage', ar: 'الأصل الثابت' },
  'mov.salePrice': {
    tr: 'Satış Bedeli (KDV hariç)',
    en: 'Sale Price (excl. VAT)',
    de: 'Verkaufspreis (o. USt.)',
    ar: 'سعر البيع (بدون ض.ق.م)',
  },
  'mov.vatRate': {
    tr: 'KDV Oranı (%)',
    en: 'VAT Rate (%)',
    de: 'USt.-Satz (%)',
    ar: 'نسبة ض.ق.م (%)',
  },
  'mov.counterAccount': {
    tr: 'Karşı Hesap (tahsilat/alacak)',
    en: 'Counter Account',
    de: 'Gegenkonto',
    ar: 'الحساب المقابل',
  },
  'mov.toLocation': {
    tr: 'Yeni Lokasyon',
    en: 'New Location',
    de: 'Neuer Standort',
    ar: 'الموقع الجديد',
  },
  'mov.gainLoss': {
    tr: 'Satış Kar/Zararı',
    en: 'Gain/Loss on Sale',
    de: 'Veräußerungsgewinn/-verlust',
    ar: 'ربح/خسارة البيع',
  },
  'mov.saleDone': {
    tr: 'Satış kaydedildi ve fiş oluşturuldu',
    en: 'Sale recorded and voucher posted',
    de: 'Verkauf erfasst und Beleg gebucht',
    ar: 'تم تسجيل البيع وترحيل السند',
  },
  'mov.scrapDone': {
    tr: 'Hurda kaydı ve fişi oluşturuldu',
    en: 'Scrap recorded and voucher posted',
    de: 'Verschrottung erfasst und Beleg gebucht',
    ar: 'تم تسجيل الإخراد وترحيل السند',
  },
  'mov.transferDone': {
    tr: 'Transfer kaydedildi',
    en: 'Transfer recorded',
    de: 'Umlagerung erfasst',
    ar: 'تم تسجيل النقل',
  },
  'mov.onlyTransferDeletable': {
    tr: 'Satış/hurda hareketleri silinemez (muhasebe fişi oluşturuldu). Düzeltme için ters kayıt kullanın.',
    en: 'Sale/scrap movements cannot be deleted (voucher posted). Use a reversing entry.',
    de: 'Verkauf/Verschrottung kann nicht gelöscht werden (Beleg gebucht). Stornobuchung verwenden.',
    ar: 'لا يمكن حذف حركات البيع/الإخراد (تم ترحيل السند). استخدم قيداً عكسياً.',
  },
  'mov.scrapConfirm': {
    tr: 'Kıymet hurdaya ayrılacak, kalan net defter değeri gider yazılacak ve fiş oluşturulacak.',
    en: 'The asset will be scrapped; remaining NBV is expensed and a voucher is posted.',
    de: 'Anlage wird verschrottet; Restbuchwert wird Aufwand, Beleg wird gebucht.',
    ar: 'سيتم إخراد الأصل؛ يُحمَّل صافي القيمة المتبقية كمصروف ويُرحَّل سند.',
  },

  // Raporlar
  'rep.summary': { tr: 'Özet', en: 'Summary', de: 'Zusammenfassung', ar: 'الملخص' },
  'rep.activeCount': {
    tr: 'Aktif Kıymet',
    en: 'Active Assets',
    de: 'Aktive Anlagen',
    ar: 'الأصول النشطة',
  },
  'rep.totalCost': {
    tr: 'Toplam Maliyet',
    en: 'Total Cost',
    de: 'Gesamtkosten',
    ar: 'إجمالي التكلفة',
  },
  'rep.totalAccum': {
    tr: 'Toplam Birikmiş Amortisman',
    en: 'Total Accum. Depreciation',
    de: 'Gesamte kum. AfA',
    ar: 'إجمالي الإهلاك المتراكم',
  },
  'rep.totalNbv': {
    tr: 'Toplam Net Defter Değeri',
    en: 'Total Net Book Value',
    de: 'Gesamter Restbuchwert',
    ar: 'إجمالي صافي القيمة الدفترية',
  },
  'rep.byCategory': {
    tr: 'Kategori Bazında Dağılım',
    en: 'Breakdown by Category',
    de: 'Aufteilung nach Kategorie',
    ar: 'التوزيع حسب الفئة',
  },
  'rep.assetList': {
    tr: 'Sabit Kıymet Listesi',
    en: 'Fixed Asset Register',
    de: 'Anlagenverzeichnis',
    ar: 'سجل الأصول الثابتة',
  },
  'rep.exportCsv': {
    tr: 'CSV Dışa Aktar',
    en: 'Export CSV',
    de: 'CSV exportieren',
    ar: 'تصدير CSV',
  },
  'rep.count': { tr: 'Adet', en: 'Count', de: 'Anzahl', ar: 'العدد' },

  // Doğrulama / hata mesajları
  'err.nameRequired': {
    tr: 'Kıymet adı zorunludur',
    en: 'Asset name is required',
    de: 'Anlagenname ist erforderlich',
    ar: 'اسم الأصل مطلوب',
  },
  'err.dateRequired': {
    tr: 'Edinim tarihi zorunludur',
    en: 'Acquisition date is required',
    de: 'Anschaffungsdatum ist erforderlich',
    ar: 'تاريخ الاقتناء مطلوب',
  },
  'err.costPositive': {
    tr: "Edinim bedeli 0'dan büyük olmalıdır",
    en: 'Acquisition cost must be positive',
    de: 'Anschaffungskosten müssen positiv sein',
    ar: 'يجب أن تكون تكلفة الاقتناء موجبة',
  },
  'err.accountsRequired': {
    tr: 'Kıymet, birikmiş amortisman ve gider hesapları seçilmelidir',
    en: 'Asset, accumulated depreciation and expense accounts must be selected',
    de: 'Anlagen-, AfA- und Aufwandskonto müssen gewählt werden',
    ar: 'يجب اختيار حسابات الأصل والإهلاك المتراكم والمصروف',
  },
  'err.assetRequired': {
    tr: 'Sabit kıymet seçin',
    en: 'Select a fixed asset',
    de: 'Anlage auswählen',
    ar: 'اختر أصلاً ثابتاً',
  },
  'err.priceRequired': {
    tr: 'Satış bedeli girin',
    en: 'Enter a sale price',
    de: 'Verkaufspreis eingeben',
    ar: 'أدخل سعر البيع',
  },
  'err.voucherFailed': {
    tr: 'Fiş oluşturulamadı',
    en: 'Voucher could not be created',
    de: 'Beleg konnte nicht erstellt werden',
    ar: 'تعذر إنشاء السند',
  },
};

export function tfa(key, lang) {
  const e = CAT[key];
  if (!e) return key;
  return e[lang] || e.tr;
}

export default CAT;

/**
 * Şantiye Faz 1-2 ekranları için çok dilli etiket kataloğu (TR/EN/DE/AR).
 *
 * App.jsx I18N_DICT'inden bağımsız; modül kendi metinlerini taşır
 * (shared/fx/i18n.ts ile aynı kalıp — Dil Ajanı kuralı: her UI metni baştan
 * TR/EN/DE/AR).
 */
export type Lang = 'tr' | 'en' | 'de' | 'ar';

export type CsLabelKey =
  // Ortak
  | 'cs.common.project'
  | 'cs.common.selectProject'
  | 'cs.common.save'
  | 'cs.common.cancel'
  | 'cs.common.add'
  | 'cs.common.edit'
  | 'cs.common.delete'
  | 'cs.common.close'
  | 'cs.common.loading'
  | 'cs.common.none'
  | 'cs.common.code'
  | 'cs.common.name'
  | 'cs.common.note'
  | 'cs.common.status'
  | 'cs.common.actions'
  | 'cs.common.total'
  | 'cs.common.search'
  | 'cs.common.refresh'
  | 'cs.common.showInactive'
  | 'cs.common.noRecords'
  | 'cs.common.required'
  // Mekân kırılımı
  | 'cs.loc.title'
  | 'cs.loc.subtitle'
  | 'cs.loc.tree'
  | 'cs.loc.kind'
  | 'cs.loc.kind.site'
  | 'cs.loc.kind.block'
  | 'cs.loc.kind.floor'
  | 'cs.loc.kind.unit'
  | 'cs.loc.kind.zone'
  | 'cs.loc.addChild'
  | 'cs.loc.addRoot'
  | 'cs.loc.unitType'
  | 'cs.loc.grossArea'
  | 'cs.loc.netArea'
  | 'cs.loc.landShare'
  | 'cs.loc.facade'
  | 'cs.loc.unitCount'
  | 'cs.loc.netAreaTotal'
  | 'cs.loc.path'
  | 'cs.loc.move'
  | 'cs.loc.moveTo'
  | 'cs.loc.moveToRoot'
  | 'cs.loc.deactivate'
  | 'cs.loc.hardDelete'
  | 'cs.loc.deleteBlocked'
  | 'cs.loc.deleteConfirm'
  | 'cs.loc.deactivateConfirm'
  | 'cs.loc.empty'
  | 'cs.loc.emptyHint'
  | 'cs.loc.nameHint'
  // Toplu üretim
  | 'cs.gen.title'
  | 'cs.gen.hint'
  | 'cs.gen.blocks'
  | 'cs.gen.blocksHint'
  | 'cs.gen.floors'
  | 'cs.gen.floorsHint'
  | 'cs.gen.unitsPerFloor'
  | 'cs.gen.numbering'
  | 'cs.gen.numbering.perFloor'
  | 'cs.gen.numbering.sequential'
  | 'cs.gen.defaultUnitType'
  | 'cs.gen.parent'
  | 'cs.gen.parentRoot'
  | 'cs.gen.blockNameTpl'
  | 'cs.gen.floorNameTpl'
  | 'cs.gen.unitNameTpl'
  | 'cs.gen.tplHint'
  | 'cs.gen.preview'
  | 'cs.gen.run'
  | 'cs.gen.done'
  | 'cs.gen.idempotent'
  // Şablon
  | 'cs.tpl.title'
  | 'cs.tpl.subtitle'
  | 'cs.tpl.scope'
  | 'cs.tpl.scope.general'
  | 'cs.tpl.scope.block'
  | 'cs.tpl.scope.floor'
  | 'cs.tpl.scope.unit'
  | 'cs.tpl.description'
  | 'cs.tpl.pctInProgress'
  | 'cs.tpl.pctHasDefects'
  | 'cs.tpl.pctHint'
  | 'cs.tpl.itemCount'
  | 'cs.tpl.new'
  | 'cs.tpl.groups'
  | 'cs.tpl.group'
  | 'cs.tpl.addGroup'
  | 'cs.tpl.items'
  | 'cs.tpl.addItem'
  | 'cs.tpl.groupWeight'
  | 'cs.tpl.itemWeight'
  | 'cs.tpl.saveBody'
  | 'cs.tpl.bodySaved'
  | 'cs.tpl.affected'
  | 'cs.tpl.affectedWarn'
  | 'cs.tpl.weightWarnTemplate'
  | 'cs.tpl.weightWarnGroup'
  | 'cs.tpl.weightOk'
  | 'cs.tpl.selectHint'
  | 'cs.tpl.linkedPoz'
  // Takip
  | 'cs.trk.title'
  | 'cs.trk.subtitle'
  | 'cs.trk.new'
  | 'cs.trk.template'
  | 'cs.trk.projectWeight'
  | 'cs.trk.projectWeightHint'
  | 'cs.trk.plannedStart'
  | 'cs.trk.plannedEnd'
  | 'cs.trk.assignedUser'
  | 'cs.trk.scopeLocations'
  | 'cs.trk.scopeHint'
  | 'cs.trk.progress'
  | 'cs.trk.planned'
  | 'cs.trk.deviation'
  | 'cs.trk.locationCount'
  | 'cs.trk.status.draft'
  | 'cs.trk.status.active'
  | 'cs.trk.status.completed'
  | 'cs.trk.status.cancelled'
  | 'cs.trk.activate'
  | 'cs.trk.complete'
  | 'cs.trk.reopen'
  | 'cs.trk.cancel'
  | 'cs.trk.openBoard'
  | 'cs.trk.backToList'
  | 'cs.trk.syncTemplate'
  | 'cs.trk.syncDone'
  | 'cs.trk.addLocations'
  | 'cs.trk.removeLocation'
  | 'cs.trk.removeLocationConfirm'
  | 'cs.trk.noTrackings'
  | 'cs.trk.noTemplates'
  | 'cs.trk.aheadOfPlan'
  | 'cs.trk.behindPlan'
  | 'cs.trk.onPlan'
  | 'cs.trk.noPlanDates'
  // Saha ekranı
  | 'cs.board.state'
  | 'cs.board.state.notStarted'
  | 'cs.board.state.inProgress'
  | 'cs.board.state.hasDefects'
  | 'cs.board.state.completed'
  | 'cs.board.work'
  | 'cs.board.workGroup'
  | 'cs.board.groupWeight'
  | 'cs.board.itemWeight'
  | 'cs.board.effectivePct'
  | 'cs.board.override'
  | 'cs.board.overrideHint'
  | 'cs.board.inspectedBy'
  | 'cs.board.inspectedAt'
  | 'cs.board.history'
  | 'cs.board.historyTitle'
  | 'cs.board.noHistory'
  | 'cs.board.pendingChanges'
  | 'cs.board.saveChanges'
  | 'cs.board.discardChanges'
  | 'cs.board.notActive'
  | 'cs.board.completedCount'
  | 'cs.board.defectCount'
  | 'cs.board.inProgressCount'
  | 'cs.board.itemCount'
  | 'cs.board.locationWeight'
  | 'cs.board.emptyScope'
  // Proje fiziksel ilerleme
  | 'cs.pp.title'
  | 'cs.pp.projectProgress'
  | 'cs.pp.weightSum'
  | 'cs.pp.unmeasured'
  | 'cs.pp.unmeasuredWarn'
  | 'cs.pp.trackingCount'
  | 'cs.pp.breakdown'
  | 'cs.pp.contribution'
  | 'cs.pp.noTrackings';

const DICT: Record<CsLabelKey, Record<Lang, string>> = {
  // ===== ORTAK =============================================================
  'cs.common.project': { tr: 'Proje', en: 'Project', de: 'Projekt', ar: 'المشروع' },
  'cs.common.selectProject': {
    tr: 'Proje seçin',
    en: 'Select a project',
    de: 'Projekt auswählen',
    ar: 'اختر مشروعًا',
  },
  'cs.common.save': { tr: 'Kaydet', en: 'Save', de: 'Speichern', ar: 'حفظ' },
  'cs.common.cancel': { tr: 'Vazgeç', en: 'Cancel', de: 'Abbrechen', ar: 'إلغاء' },
  'cs.common.add': { tr: 'Ekle', en: 'Add', de: 'Hinzufügen', ar: 'إضافة' },
  'cs.common.edit': { tr: 'Düzenle', en: 'Edit', de: 'Bearbeiten', ar: 'تعديل' },
  'cs.common.delete': { tr: 'Sil', en: 'Delete', de: 'Löschen', ar: 'حذف' },
  'cs.common.close': { tr: 'Kapat', en: 'Close', de: 'Schließen', ar: 'إغلاق' },
  'cs.common.loading': {
    tr: 'Yükleniyor…',
    en: 'Loading…',
    de: 'Wird geladen…',
    ar: 'جارٍ التحميل…',
  },
  'cs.common.none': { tr: '—', en: '—', de: '—', ar: '—' },
  'cs.common.code': { tr: 'Kod', en: 'Code', de: 'Code', ar: 'الرمز' },
  'cs.common.name': { tr: 'Ad', en: 'Name', de: 'Name', ar: 'الاسم' },
  'cs.common.note': { tr: 'Not', en: 'Note', de: 'Notiz', ar: 'ملاحظة' },
  'cs.common.status': { tr: 'Durum', en: 'Status', de: 'Status', ar: 'الحالة' },
  'cs.common.actions': { tr: 'İşlem', en: 'Actions', de: 'Aktionen', ar: 'إجراءات' },
  'cs.common.total': { tr: 'Toplam', en: 'Total', de: 'Gesamt', ar: 'الإجمالي' },
  'cs.common.search': { tr: 'Ara', en: 'Search', de: 'Suchen', ar: 'بحث' },
  'cs.common.refresh': { tr: 'Yenile', en: 'Refresh', de: 'Aktualisieren', ar: 'تحديث' },
  'cs.common.showInactive': {
    tr: 'Pasifleri göster',
    en: 'Show inactive',
    de: 'Inaktive anzeigen',
    ar: 'إظهار غير النشِط',
  },
  'cs.common.noRecords': {
    tr: 'Kayıt bulunamadı',
    en: 'No records found',
    de: 'Keine Einträge gefunden',
    ar: 'لا توجد سجلات',
  },
  'cs.common.required': { tr: 'zorunlu', en: 'required', de: 'erforderlich', ar: 'مطلوب' },

  // ===== MEKÂN KIRILIMI ====================================================
  'cs.loc.title': {
    tr: 'Mekân Kırılımı',
    en: 'Location Breakdown',
    de: 'Standortstruktur',
    ar: 'تقسيم المواقع',
  },
  'cs.loc.subtitle': {
    tr: 'Saha > Blok > Kat > Bağımsız Bölüm ağacı. Gider, puantaj, keşif ve ilerleme kayıtları bu ağaca bağlanır.',
    en: 'Site > Block > Floor > Unit tree. Costs, timesheets, estimates and progress records attach to this tree.',
    de: 'Baum Baustelle > Block > Etage > Einheit. Kosten, Stundennachweise, Aufmaße und Fortschritte hängen an diesem Baum.',
    ar: 'شجرة الموقع > العمارة > الطابق > الوحدة. تُربط المصروفات وكشوف الدوام والكشوف وسجلات التقدم بهذه الشجرة.',
  },
  'cs.loc.tree': { tr: 'Ağaç', en: 'Tree', de: 'Baum', ar: 'الشجرة' },
  'cs.loc.kind': { tr: 'Tip', en: 'Type', de: 'Typ', ar: 'النوع' },
  'cs.loc.kind.site': { tr: 'Saha', en: 'Site', de: 'Baustelle', ar: 'موقع' },
  'cs.loc.kind.block': { tr: 'Blok', en: 'Block', de: 'Block', ar: 'عمارة' },
  'cs.loc.kind.floor': { tr: 'Kat', en: 'Floor', de: 'Etage', ar: 'طابق' },
  'cs.loc.kind.unit': { tr: 'Bağımsız Bölüm', en: 'Unit', de: 'Einheit', ar: 'وحدة' },
  'cs.loc.kind.zone': { tr: 'Bölge', en: 'Zone', de: 'Zone', ar: 'منطقة' },
  'cs.loc.addChild': {
    tr: 'Alt mekân ekle',
    en: 'Add sub-location',
    de: 'Unterstandort hinzufügen',
    ar: 'إضافة موقع فرعي',
  },
  'cs.loc.addRoot': {
    tr: 'Kök mekân ekle',
    en: 'Add root location',
    de: 'Wurzelstandort hinzufügen',
    ar: 'إضافة موقع جذري',
  },
  'cs.loc.unitType': { tr: 'Daire tipi', en: 'Unit type', de: 'Einheitstyp', ar: 'نوع الوحدة' },
  'cs.loc.grossArea': {
    tr: 'Brüt alan (m²)',
    en: 'Gross area (m²)',
    de: 'Bruttofläche (m²)',
    ar: 'المساحة الإجمالية (م²)',
  },
  'cs.loc.netArea': {
    tr: 'Net alan (m²)',
    en: 'Net area (m²)',
    de: 'Nettofläche (m²)',
    ar: 'المساحة الصافية (م²)',
  },
  'cs.loc.landShare': {
    tr: 'Arsa payı',
    en: 'Land share',
    de: 'Grundstücksanteil',
    ar: 'حصة الأرض',
  },
  'cs.loc.facade': { tr: 'Cephe', en: 'Facade', de: 'Fassade', ar: 'الواجهة' },
  'cs.loc.unitCount': { tr: 'B.Bölüm', en: 'Units', de: 'Einheiten', ar: 'الوحدات' },
  'cs.loc.netAreaTotal': {
    tr: 'Net alan toplamı',
    en: 'Total net area',
    de: 'Nettofläche gesamt',
    ar: 'إجمالي المساحة الصافية',
  },
  'cs.loc.path': { tr: 'Tam yol', en: 'Full path', de: 'Vollständiger Pfad', ar: 'المسار الكامل' },
  'cs.loc.move': { tr: 'Taşı', en: 'Move', de: 'Verschieben', ar: 'نقل' },
  'cs.loc.moveTo': {
    tr: 'Yeni üst mekân',
    en: 'New parent location',
    de: 'Neuer übergeordneter Standort',
    ar: 'الموقع الأب الجديد',
  },
  'cs.loc.moveToRoot': {
    tr: '(kök seviyeye taşı)',
    en: '(move to root level)',
    de: '(auf Wurzelebene verschieben)',
    ar: '(نقل إلى المستوى الجذري)',
  },
  'cs.loc.deactivate': { tr: 'Pasife çek', en: 'Deactivate', de: 'Deaktivieren', ar: 'تعطيل' },
  'cs.loc.hardDelete': {
    tr: 'Kalıcı sil',
    en: 'Delete permanently',
    de: 'Endgültig löschen',
    ar: 'حذف نهائي',
  },
  'cs.loc.deleteBlocked': {
    tr: 'Kalıcı silinemez — bağlı kayıt var: {blockers}. Pasife çekebilirsiniz; geçmiş kayıtların mekân etiketi korunur.',
    en: 'Cannot delete permanently — linked records exist: {blockers}. You can deactivate instead; past records keep their location label.',
    de: 'Endgültiges Löschen nicht möglich — verknüpfte Datensätze: {blockers}. Sie können stattdessen deaktivieren; vorhandene Datensätze behalten ihre Standortangabe.',
    ar: 'لا يمكن الحذف النهائي — توجد سجلات مرتبطة: {blockers}. يمكنك التعطيل بدلًا من ذلك؛ وتحتفظ السجلات السابقة بوسم موقعها.',
  },
  'cs.loc.deleteConfirm': {
    tr: '"{name}" kalıcı olarak silinecek. Onaylıyor musunuz?',
    en: '"{name}" will be permanently deleted. Do you confirm?',
    de: '"{name}" wird endgültig gelöscht. Bestätigen Sie?',
    ar: 'سيتم حذف "{name}" نهائيًا. هل تؤكد؟',
  },
  'cs.loc.deactivateConfirm': {
    tr: '"{name}" pasife çekilecek. Onaylıyor musunuz?',
    en: '"{name}" will be deactivated. Do you confirm?',
    de: '"{name}" wird deaktiviert. Bestätigen Sie?',
    ar: 'سيتم تعطيل "{name}". هل تؤكد؟',
  },
  'cs.loc.empty': {
    tr: 'Bu projede henüz mekân tanımı yok.',
    en: 'No locations defined for this project yet.',
    de: 'Für dieses Projekt sind noch keine Standorte definiert.',
    ar: 'لا توجد مواقع مُعرَّفة لهذا المشروع بعد.',
  },
  'cs.loc.emptyHint': {
    tr: 'Tek tek eklemek yerine toplu üretim sihirbazını kullanabilirsiniz.',
    en: 'Instead of adding one by one, you can use the bulk generation wizard.',
    de: 'Anstatt einzeln hinzuzufügen, können Sie den Massenerstellungsassistenten verwenden.',
    ar: 'بدلًا من الإضافة واحدًا واحدًا، يمكنك استخدام معالج الإنشاء الجماعي.',
  },
  'cs.loc.nameHint': {
    tr: 'Boş bırakılırsa kod ad olarak kullanılır.',
    en: 'If left empty, the code is used as the name.',
    de: 'Wenn leer, wird der Code als Name verwendet.',
    ar: 'إذا تُرك فارغًا، يُستخدم الرمز كاسم.',
  },

  // ===== TOPLU ÜRETİM ======================================================
  'cs.gen.title': {
    tr: 'Toplu Mekân Üretimi',
    en: 'Bulk Location Generation',
    de: 'Standorte massenweise erzeugen',
    ar: 'إنشاء المواقع بالجملة',
  },
  'cs.gen.hint': {
    tr: 'Blok × kat × daire iskeletini tek seferde kurar. Var olan kodlar atlanır, bu yüzden yeni blok eklemek için tekrar çalıştırılabilir.',
    en: 'Creates the block × floor × unit skeleton in one go. Existing codes are skipped, so it can be re-run to add new blocks.',
    de: 'Erstellt das Gerüst Block × Etage × Einheit in einem Durchgang. Vorhandene Codes werden übersprungen, sodass ein erneuter Lauf neue Blöcke ergänzt.',
    ar: 'يُنشئ هيكل العمارة × الطابق × الوحدة بخطوة واحدة. تُتجاهل الرموز الموجودة، لذا يمكن إعادة تشغيله لإضافة عمارات جديدة.',
  },
  'cs.gen.blocks': { tr: 'Blok kodları', en: 'Block codes', de: 'Blockcodes', ar: 'رموز العمارات' },
  'cs.gen.blocksHint': {
    tr: 'Virgülle ayırın, ör. A, B, C',
    en: 'Separate with commas, e.g. A, B, C',
    de: 'Mit Kommas trennen, z. B. A, B, C',
    ar: 'افصل بفواصل، مثل A, B, C',
  },
  'cs.gen.floors': { tr: 'Kat kodları', en: 'Floor codes', de: 'Etagencodes', ar: 'رموز الطوابق' },
  'cs.gen.floorsHint': {
    tr: 'Virgülle ayırın, ör. -1, 0, 1, 2. Boş bırakılırsa kat üretilmez.',
    en: 'Separate with commas, e.g. -1, 0, 1, 2. If left empty, no floors are created.',
    de: 'Mit Kommas trennen, z. B. -1, 0, 1, 2. Wenn leer, werden keine Etagen erzeugt.',
    ar: 'افصل بفواصل، مثل -1, 0, 1, 2. إذا تُرك فارغًا، لا تُنشأ طوابق.',
  },
  'cs.gen.unitsPerFloor': {
    tr: 'Kat başına bağımsız bölüm',
    en: 'Units per floor',
    de: 'Einheiten pro Etage',
    ar: 'وحدات لكل طابق',
  },
  'cs.gen.numbering': { tr: 'Numaralandırma', en: 'Numbering', de: 'Nummerierung', ar: 'الترقيم' },
  'cs.gen.numbering.perFloor': {
    tr: 'Her katta 1’den başla',
    en: 'Restart at 1 on each floor',
    de: 'Auf jeder Etage bei 1 beginnen',
    ar: 'ابدأ من 1 في كل طابق',
  },
  'cs.gen.numbering.sequential': {
    tr: 'Blok içinde sürekli artan',
    en: 'Continuous within the block',
    de: 'Fortlaufend innerhalb des Blocks',
    ar: 'متسلسل داخل العمارة',
  },
  'cs.gen.defaultUnitType': {
    tr: 'Varsayılan daire tipi',
    en: 'Default unit type',
    de: 'Standard-Einheitstyp',
    ar: 'نوع الوحدة الافتراضي',
  },
  'cs.gen.parent': {
    tr: 'Bloklar nereye eklenecek',
    en: 'Where to add the blocks',
    de: 'Wohin die Blöcke kommen',
    ar: 'أين تُضاف العمارات',
  },
  'cs.gen.parentRoot': {
    tr: 'Kök seviye (proje altına)',
    en: 'Root level (directly under project)',
    de: 'Wurzelebene (direkt unter dem Projekt)',
    ar: 'المستوى الجذري (تحت المشروع مباشرة)',
  },
  'cs.gen.blockNameTpl': {
    tr: 'Blok adı şablonu',
    en: 'Block name template',
    de: 'Vorlage für Blocknamen',
    ar: 'قالب اسم العمارة',
  },
  'cs.gen.floorNameTpl': {
    tr: 'Kat adı şablonu',
    en: 'Floor name template',
    de: 'Vorlage für Etagennamen',
    ar: 'قالب اسم الطابق',
  },
  'cs.gen.unitNameTpl': {
    tr: 'Daire adı şablonu',
    en: 'Unit name template',
    de: 'Vorlage für Einheitsnamen',
    ar: 'قالب اسم الوحدة',
  },
  'cs.gen.tplHint': {
    tr: '{code} yer tutucusu kodla değiştirilir.',
    en: 'The {code} placeholder is replaced with the code.',
    de: 'Der Platzhalter {code} wird durch den Code ersetzt.',
    ar: 'يُستبدل العنصر البديل {code} بالرمز.',
  },
  'cs.gen.preview': {
    tr: 'Üretilecek düğüm',
    en: 'Nodes to be created',
    de: 'Zu erzeugende Knoten',
    ar: 'العقد التي ستُنشأ',
  },
  'cs.gen.run': { tr: 'Üret', en: 'Generate', de: 'Erzeugen', ar: 'إنشاء' },
  'cs.gen.done': {
    tr: '{n} yeni mekân üretildi.',
    en: '{n} new locations created.',
    de: '{n} neue Standorte erstellt.',
    ar: 'تم إنشاء {n} موقعًا جديدًا.',
  },
  'cs.gen.idempotent': {
    tr: 'Hiç yeni mekân üretilmedi — hepsi zaten vardı.',
    en: 'No new locations created — they already existed.',
    de: 'Keine neuen Standorte erstellt — sie waren bereits vorhanden.',
    ar: 'لم تُنشأ مواقع جديدة — كانت موجودة بالفعل.',
  },

  // ===== ŞABLON ============================================================
  'cs.tpl.title': {
    tr: 'İlerleme Takip Şablonları',
    en: 'Progress Tracking Templates',
    de: 'Fortschritts-Vorlagen',
    ar: 'قوالب تتبع التقدم',
  },
  'cs.tpl.subtitle': {
    tr: 'İş grubu ve iş ağırlıklarından oluşan ölçüm cetveli. Şirket seviyesinde tanımlanır, projeler arasında yeniden kullanılır.',
    en: 'A measurement scale built from work-group and work-item weights. Defined company-wide and reused across projects.',
    de: 'Ein Bewertungsraster aus Arbeitsgruppen- und Arbeitsgewichten. Unternehmensweit definiert und projektübergreifend wiederverwendet.',
    ar: 'مقياس قياس مبني على أوزان مجموعات الأعمال وبنودها. يُعرَّف على مستوى الشركة ويُعاد استخدامه بين المشاريع.',
  },
  'cs.tpl.scope': { tr: 'Kapsam', en: 'Scope', de: 'Umfang', ar: 'النطاق' },
  'cs.tpl.scope.general': {
    tr: 'Genel (saha)',
    en: 'General (site)',
    de: 'Allgemein (Baustelle)',
    ar: 'عام (الموقع)',
  },
  'cs.tpl.scope.block': {
    tr: 'Blok bazlı',
    en: 'Block based',
    de: 'Blockbasiert',
    ar: 'حسب العمارة',
  },
  'cs.tpl.scope.floor': {
    tr: 'Kat bazlı',
    en: 'Floor based',
    de: 'Etagenbasiert',
    ar: 'حسب الطابق',
  },
  'cs.tpl.scope.unit': {
    tr: 'Daire bazlı',
    en: 'Unit based',
    de: 'Einheitsbasiert',
    ar: 'حسب الوحدة',
  },
  'cs.tpl.description': { tr: 'Açıklama', en: 'Description', de: 'Beschreibung', ar: 'الوصف' },
  'cs.tpl.pctInProgress': {
    tr: '"Devam ediyor" yüzdesi',
    en: '"In progress" percentage',
    de: 'Prozentsatz „In Bearbeitung“',
    ar: 'نسبة "قيد التنفيذ"',
  },
  'cs.tpl.pctHasDefects': {
    tr: '"Eksikleri var" yüzdesi',
    en: '"Has defects" percentage',
    de: 'Prozentsatz „Mit Mängeln“',
    ar: 'نسبة "به نواقص"',
  },
  'cs.tpl.pctHint': {
    tr: '"Başlamadı" her zaman %0, "Tamamlandı" her zaman %100 sayılır.',
    en: '"Not started" always counts as 0%, "Completed" always as 100%.',
    de: '„Nicht begonnen“ zählt immer als 0 %, „Abgeschlossen“ immer als 100 %.',
    ar: 'تُحسب "لم تبدأ" دائمًا 0%، و"مكتملة" دائمًا 100%.',
  },
  'cs.tpl.itemCount': {
    tr: 'İş sayısı',
    en: 'Work items',
    de: 'Arbeitspositionen',
    ar: 'عدد البنود',
  },
  'cs.tpl.new': { tr: 'Yeni şablon', en: 'New template', de: 'Neue Vorlage', ar: 'قالب جديد' },
  'cs.tpl.groups': {
    tr: 'İş grupları',
    en: 'Work groups',
    de: 'Arbeitsgruppen',
    ar: 'مجموعات الأعمال',
  },
  'cs.tpl.group': { tr: 'İş grubu', en: 'Work group', de: 'Arbeitsgruppe', ar: 'مجموعة أعمال' },
  'cs.tpl.addGroup': {
    tr: 'Grup ekle',
    en: 'Add group',
    de: 'Gruppe hinzufügen',
    ar: 'إضافة مجموعة',
  },
  'cs.tpl.items': { tr: 'İşler', en: 'Work items', de: 'Arbeitspositionen', ar: 'البنود' },
  'cs.tpl.addItem': {
    tr: 'İş ekle',
    en: 'Add work item',
    de: 'Position hinzufügen',
    ar: 'إضافة بند',
  },
  'cs.tpl.groupWeight': {
    tr: 'İ.G. Oranı (%)',
    en: 'Group weight (%)',
    de: 'Gruppengewicht (%)',
    ar: 'وزن المجموعة (%)',
  },
  'cs.tpl.itemWeight': {
    tr: 'İ. Oranı (%)',
    en: 'Item weight (%)',
    de: 'Positionsgewicht (%)',
    ar: 'وزن البند (%)',
  },
  'cs.tpl.saveBody': {
    tr: 'Şablon gövdesini kaydet',
    en: 'Save template body',
    de: 'Vorlageninhalt speichern',
    ar: 'حفظ محتوى القالب',
  },
  'cs.tpl.bodySaved': {
    tr: 'Şablon gövdesi kaydedildi.',
    en: 'Template body saved.',
    de: 'Vorlageninhalt gespeichert.',
    ar: 'تم حفظ محتوى القالب.',
  },
  'cs.tpl.affected': {
    tr: '{n} takip bu şablonu kullanıyor.',
    en: '{n} tracking(s) use this template.',
    de: '{n} Verfolgung(en) verwenden diese Vorlage.',
    ar: '{n} تتبُّع يستخدم هذا القالب.',
  },
  'cs.tpl.affectedWarn': {
    tr: 'Gövdeyi değiştirmek ölçüm cetvelini değiştirir: bu şablonu kullanan {n} takipte girilmiş saha tikleri silinir. Devam edilsin mi?',
    en: 'Changing the body changes the measurement scale: field ticks already entered in {n} tracking(s) using this template will be deleted. Continue?',
    de: 'Eine Änderung des Inhalts ändert das Bewertungsraster: Die in {n} Verfolgung(en) mit dieser Vorlage erfassten Feldhäkchen werden gelöscht. Fortfahren?',
    ar: 'تغيير المحتوى يغيّر مقياس القياس: ستُحذف علامات الميدان المُدخلة في {n} تتبُّع يستخدم هذا القالب. أتريد المتابعة؟',
  },
  'cs.tpl.weightWarnTemplate': {
    tr: 'Grup ağırlıkları toplamı %{sum} — %100 olmalı.',
    en: 'Group weights total {sum}% — should be 100%.',
    de: 'Summe der Gruppengewichte {sum} % — sollte 100 % sein.',
    ar: 'مجموع أوزان المجموعات {sum}% — يجب أن يكون 100%.',
  },
  'cs.tpl.weightWarnGroup': {
    tr: '"{group}" grubundaki iş ağırlıkları toplamı %{sum} — %100 olmalı.',
    en: 'Work-item weights in group "{group}" total {sum}% — should be 100%.',
    de: 'Positionsgewichte in Gruppe „{group}“ ergeben {sum} % — sollten 100 % sein.',
    ar: 'مجموع أوزان البنود في مجموعة "{group}" هو {sum}% — يجب أن يكون 100%.',
  },
  'cs.tpl.weightOk': {
    tr: 'Ağırlıklar tutarlı (%100).',
    en: 'Weights are consistent (100%).',
    de: 'Gewichte sind konsistent (100 %).',
    ar: 'الأوزان متسقة (100%).',
  },
  'cs.tpl.selectHint': {
    tr: 'Düzenlemek için soldan bir şablon seçin.',
    en: 'Select a template on the left to edit it.',
    de: 'Wählen Sie links eine Vorlage zum Bearbeiten.',
    ar: 'اختر قالبًا من اليسار لتحريره.',
  },
  'cs.tpl.linkedPoz': {
    tr: 'Bağlı poz',
    en: 'Linked item code',
    de: 'Verknüpfte Position',
    ar: 'البند المرتبط',
  },

  // ===== TAKİP =============================================================
  'cs.trk.title': {
    tr: 'Güncel Durum Takipleri',
    en: 'Physical Progress Trackings',
    de: 'Ist-Stand-Verfolgungen',
    ar: 'متابعات الحالة الحالية',
  },
  'cs.trk.subtitle': {
    tr: 'Fiziksel ilerlemeyi hakedişten bağımsız ölçer. Taşeron sözleşmesi olmayan (kendi ekibiyle yapılan) iş de buradan görünür.',
    en: 'Measures physical progress independently of progress payments. Work without a subcontract (done by own crew) is visible here too.',
    de: 'Misst den physischen Fortschritt unabhängig von Abschlagszahlungen. Auch Arbeiten ohne Nachunternehmervertrag (Eigenleistung) sind hier sichtbar.',
    ar: 'يقيس التقدم المادي بمعزل عن المستخلصات. تظهر هنا أيضًا الأعمال بدون عقد مقاول (المنفذة بالطاقم الذاتي).',
  },
  'cs.trk.new': { tr: 'Yeni takip', en: 'New tracking', de: 'Neue Verfolgung', ar: 'متابعة جديدة' },
  'cs.trk.template': { tr: 'Şablon', en: 'Template', de: 'Vorlage', ar: 'القالب' },
  'cs.trk.projectWeight': {
    tr: 'Projeye etki oranı (%)',
    en: 'Weight in project (%)',
    de: 'Gewicht im Projekt (%)',
    ar: 'نسبة التأثير على المشروع (%)',
  },
  'cs.trk.projectWeightHint': {
    tr: 'Projedeki tüm takiplerin etki oranı toplamı %100 olmalı. Eksik kalan pay ölçülmemiş iş sayılır ve %0 katkı verir.',
    en: 'The weights of all trackings in the project should total 100%. Any shortfall counts as unmeasured work and contributes 0%.',
    de: 'Die Gewichte aller Verfolgungen im Projekt sollten 100 % ergeben. Ein Fehlbetrag gilt als nicht gemessene Arbeit und trägt 0 % bei.',
    ar: 'يجب أن يبلغ مجموع أوزان كل المتابعات في المشروع 100%. أي نقص يُعدّ عملًا غير مقيس ومساهمته 0%.',
  },
  'cs.trk.plannedStart': {
    tr: 'Planlanan başlangıç',
    en: 'Planned start',
    de: 'Geplanter Beginn',
    ar: 'البداية المخططة',
  },
  'cs.trk.plannedEnd': {
    tr: 'Planlanan bitiş',
    en: 'Planned end',
    de: 'Geplantes Ende',
    ar: 'النهاية المخططة',
  },
  'cs.trk.assignedUser': {
    tr: 'Atanan kullanıcı',
    en: 'Assigned user',
    de: 'Zugewiesener Benutzer',
    ar: 'المستخدم المُعيَّن',
  },
  'cs.trk.scopeLocations': {
    tr: 'Kapsam mekânları',
    en: 'Scope locations',
    de: 'Umfangsstandorte',
    ar: 'مواقع النطاق',
  },
  'cs.trk.scopeHint': {
    tr: 'Şablonun kapsamına uygun tipteki mekânları seçin. Her mekân için şablondaki tüm işler ayrı satır olarak açılır.',
    en: 'Pick locations whose type matches the template scope. Every work item in the template is materialised as a row for each location.',
    de: 'Wählen Sie Standorte, deren Typ zum Vorlagenumfang passt. Jede Arbeitsposition der Vorlage wird für jeden Standort als Zeile angelegt.',
    ar: 'اختر مواقع يتوافق نوعها مع نطاق القالب. يُنشأ لكل موقع سطر لكل بند في القالب.',
  },
  'cs.trk.progress': { tr: 'İlerleme', en: 'Progress', de: 'Fortschritt', ar: 'التقدم' },
  'cs.trk.planned': { tr: 'Planlanan', en: 'Planned', de: 'Geplant', ar: 'المخطط' },
  'cs.trk.deviation': { tr: 'Sapma', en: 'Deviation', de: 'Abweichung', ar: 'الانحراف' },
  'cs.trk.locationCount': { tr: 'Mekân', en: 'Locations', de: 'Standorte', ar: 'المواقع' },
  'cs.trk.status.draft': { tr: 'Taslak', en: 'Draft', de: 'Entwurf', ar: 'مسودة' },
  'cs.trk.status.active': { tr: 'Aktif', en: 'Active', de: 'Aktiv', ar: 'نشِط' },
  'cs.trk.status.completed': {
    tr: 'Tamamlandı',
    en: 'Completed',
    de: 'Abgeschlossen',
    ar: 'مكتمل',
  },
  'cs.trk.status.cancelled': { tr: 'İptal', en: 'Cancelled', de: 'Storniert', ar: 'ملغى' },
  'cs.trk.activate': { tr: 'Aktife al', en: 'Activate', de: 'Aktivieren', ar: 'تنشيط' },
  'cs.trk.complete': { tr: 'Tamamla', en: 'Complete', de: 'Abschließen', ar: 'إكمال' },
  'cs.trk.reopen': { tr: 'Yeniden aç', en: 'Reopen', de: 'Wieder öffnen', ar: 'إعادة فتح' },
  'cs.trk.cancel': {
    tr: 'İptal et',
    en: 'Cancel tracking',
    de: 'Verfolgung stornieren',
    ar: 'إلغاء المتابعة',
  },
  'cs.trk.openBoard': {
    tr: 'Saha ekranı',
    en: 'Field board',
    de: 'Feldübersicht',
    ar: 'لوحة الميدان',
  },
  'cs.trk.backToList': {
    tr: '← Takip listesi',
    en: '← Tracking list',
    de: '← Verfolgungsliste',
    ar: '← قائمة المتابعات',
  },
  'cs.trk.syncTemplate': {
    tr: 'Şablonla eşitle',
    en: 'Sync with template',
    de: 'Mit Vorlage abgleichen',
    ar: 'مزامنة مع القالب',
  },
  'cs.trk.syncDone': {
    tr: '{n} yeni iş satırı eklendi (mevcut tikler korundu).',
    en: '{n} new work rows added (existing ticks preserved).',
    de: '{n} neue Arbeitszeilen hinzugefügt (bestehende Häkchen erhalten).',
    ar: 'أُضيف {n} سطر عمل جديد (مع الحفاظ على العلامات الحالية).',
  },
  'cs.trk.addLocations': {
    tr: 'Kapsama mekân ekle',
    en: 'Add locations to scope',
    de: 'Standorte zum Umfang hinzufügen',
    ar: 'إضافة مواقع إلى النطاق',
  },
  'cs.trk.removeLocation': {
    tr: 'Kapsamdan çıkar',
    en: 'Remove from scope',
    de: 'Aus Umfang entfernen',
    ar: 'إزالة من النطاق',
  },
  'cs.trk.removeLocationConfirm': {
    tr: '"{name}" kapsamdan çıkarılacak ve bu mekân için girilmiş saha tikleri silinecek. Onaylıyor musunuz?',
    en: '"{name}" will be removed from the scope and the field ticks entered for this location will be deleted. Do you confirm?',
    de: '„{name}“ wird aus dem Umfang entfernt und die für diesen Standort erfassten Feldhäkchen werden gelöscht. Bestätigen Sie?',
    ar: 'ستُزال "{name}" من النطاق وستُحذف علامات الميدان المُدخلة لهذا الموقع. هل تؤكد؟',
  },
  'cs.trk.noTrackings': {
    tr: 'Bu projede henüz takip yok.',
    en: 'No trackings for this project yet.',
    de: 'Noch keine Verfolgungen für dieses Projekt.',
    ar: 'لا توجد متابعات لهذا المشروع بعد.',
  },
  'cs.trk.noTemplates': {
    tr: 'Takip kurmak için önce bir ilerleme takip şablonu tanımlamanız gerekir.',
    en: 'You need to define a progress tracking template before creating a tracking.',
    de: 'Bevor Sie eine Verfolgung anlegen, müssen Sie eine Fortschritts-Vorlage definieren.',
    ar: 'يجب تعريف قالب تتبع تقدم قبل إنشاء متابعة.',
  },
  'cs.trk.aheadOfPlan': {
    tr: 'planın önünde',
    en: 'ahead of plan',
    de: 'vor Plan',
    ar: 'متقدم على الخطة',
  },
  'cs.trk.behindPlan': {
    tr: 'planın gerisinde',
    en: 'behind plan',
    de: 'hinter Plan',
    ar: 'متأخر عن الخطة',
  },
  'cs.trk.onPlan': { tr: 'planla uyumlu', en: 'on plan', de: 'im Plan', ar: 'مطابق للخطة' },
  'cs.trk.noPlanDates': {
    tr: 'Plan tarihi girilmediği için sapma hesaplanamıyor.',
    en: 'Deviation cannot be computed because no plan dates were entered.',
    de: 'Abweichung nicht berechenbar, da keine Plandaten erfasst wurden.',
    ar: 'لا يمكن حساب الانحراف لعدم إدخال تواريخ الخطة.',
  },

  // ===== SAHA EKRANI =======================================================
  'cs.board.state': { tr: 'Saha durumu', en: 'Field state', de: 'Feldstatus', ar: 'حالة الميدان' },
  'cs.board.state.notStarted': {
    tr: 'Başlamadı',
    en: 'Not started',
    de: 'Nicht begonnen',
    ar: 'لم تبدأ',
  },
  'cs.board.state.inProgress': {
    tr: 'Devam ediyor',
    en: 'In progress',
    de: 'In Bearbeitung',
    ar: 'قيد التنفيذ',
  },
  'cs.board.state.hasDefects': {
    tr: 'Eksikleri var',
    en: 'Has defects',
    de: 'Mit Mängeln',
    ar: 'به نواقص',
  },
  'cs.board.state.completed': {
    tr: 'Tamamlandı',
    en: 'Completed',
    de: 'Abgeschlossen',
    ar: 'مكتملة',
  },
  'cs.board.work': { tr: 'İş', en: 'Work item', de: 'Position', ar: 'البند' },
  'cs.board.workGroup': {
    tr: 'İş grubu',
    en: 'Work group',
    de: 'Arbeitsgruppe',
    ar: 'مجموعة الأعمال',
  },
  'cs.board.groupWeight': { tr: 'İ.G. Oran', en: 'Grp. wt.', de: 'Gr.-Gew.', ar: 'وزن المجموعة' },
  'cs.board.itemWeight': { tr: 'İ. Oran', en: 'Item wt.', de: 'Pos.-Gew.', ar: 'وزن البند' },
  'cs.board.effectivePct': { tr: 'Yüzde', en: 'Percent', de: 'Prozent', ar: 'النسبة' },
  'cs.board.override': { tr: 'Kısmi', en: 'Partial', de: 'Teilweise', ar: 'جزئي' },
  'cs.board.overrideHint': {
    tr: 'Kısmi imalat yüzdesi. Girilirse durumun varsayılan yüzdesini ezer.',
    en: 'Partial completion percentage. If entered, it overrides the state’s default percentage.',
    de: 'Prozentsatz der Teilfertigstellung. Falls erfasst, überschreibt er den Standardprozentsatz des Status.',
    ar: 'نسبة الإنجاز الجزئي. إذا أُدخلت، فهي تتجاوز النسبة الافتراضية للحالة.',
  },
  'cs.board.inspectedBy': {
    tr: 'Denetleyen',
    en: 'Inspected by',
    de: 'Geprüft von',
    ar: 'المُعاين',
  },
  'cs.board.inspectedAt': {
    tr: 'Denetim tarihi',
    en: 'Inspection date',
    de: 'Prüfdatum',
    ar: 'تاريخ المعاينة',
  },
  'cs.board.history': { tr: 'Geçmiş', en: 'History', de: 'Verlauf', ar: 'السجل' },
  'cs.board.historyTitle': {
    tr: 'Durum geçmişi',
    en: 'State history',
    de: 'Statusverlauf',
    ar: 'سجل الحالة',
  },
  'cs.board.noHistory': {
    tr: 'Henüz değişiklik yok.',
    en: 'No changes yet.',
    de: 'Noch keine Änderungen.',
    ar: 'لا تغييرات بعد.',
  },
  'cs.board.pendingChanges': {
    tr: '{n} değişiklik kaydedilmedi',
    en: '{n} unsaved change(s)',
    de: '{n} nicht gespeicherte Änderung(en)',
    ar: '{n} تغيير غير محفوظ',
  },
  'cs.board.saveChanges': {
    tr: 'Değişiklikleri kaydet',
    en: 'Save changes',
    de: 'Änderungen speichern',
    ar: 'حفظ التغييرات',
  },
  'cs.board.discardChanges': {
    tr: 'Değişiklikleri at',
    en: 'Discard changes',
    de: 'Änderungen verwerfen',
    ar: 'تجاهل التغييرات',
  },
  'cs.board.notActive': {
    tr: 'Saha durumu yalnız aktif takipte güncellenebilir. Bu takip: {status}.',
    en: 'Field state can only be updated on an active tracking. This tracking is: {status}.',
    de: 'Der Feldstatus kann nur bei einer aktiven Verfolgung aktualisiert werden. Diese Verfolgung ist: {status}.',
    ar: 'لا يمكن تحديث حالة الميدان إلا في متابعة نشِطة. هذه المتابعة: {status}.',
  },
  'cs.board.completedCount': { tr: 'tamam', en: 'done', de: 'fertig', ar: 'مكتمل' },
  'cs.board.defectCount': { tr: 'eksikli', en: 'defective', de: 'mangelhaft', ar: 'به نواقص' },
  'cs.board.inProgressCount': { tr: 'devam', en: 'in progress', de: 'laufend', ar: 'قيد التنفيذ' },
  'cs.board.itemCount': { tr: 'iş', en: 'items', de: 'Positionen', ar: 'بنود' },
  'cs.board.locationWeight': {
    tr: 'Mekân ağırlığı',
    en: 'Location weight',
    de: 'Standortgewicht',
    ar: 'وزن الموقع',
  },
  'cs.board.emptyScope': {
    tr: 'Bu takibin kapsamında mekân yok.',
    en: 'This tracking has no locations in its scope.',
    de: 'Diese Verfolgung hat keine Standorte im Umfang.',
    ar: 'لا توجد مواقع في نطاق هذه المتابعة.',
  },

  // ===== PROJE FİZİKSEL İLERLEME ===========================================
  'cs.pp.title': {
    tr: 'Proje Fiziksel İlerlemesi',
    en: 'Project Physical Progress',
    de: 'Physischer Projektfortschritt',
    ar: 'التقدم المادي للمشروع',
  },
  'cs.pp.projectProgress': {
    tr: 'Proje durumu',
    en: 'Project status',
    de: 'Projektstand',
    ar: 'حالة المشروع',
  },
  'cs.pp.weightSum': {
    tr: 'Ağırlık toplamı',
    en: 'Weight total',
    de: 'Gewichtssumme',
    ar: 'مجموع الأوزان',
  },
  'cs.pp.unmeasured': { tr: 'Ölçülmeyen', en: 'Unmeasured', de: 'Nicht gemessen', ar: 'غير مقيس' },
  'cs.pp.unmeasuredWarn': {
    tr: 'Projenin %{n} kadarı hiçbir takip tarafından ölçülmüyor ve %0 katkı veriyor. Etki oranlarını %100’e tamamlayın.',
    en: '{n}% of the project is not measured by any tracking and contributes 0%. Complete the weights to 100%.',
    de: '{n} % des Projekts werden von keiner Verfolgung gemessen und tragen 0 % bei. Ergänzen Sie die Gewichte auf 100 %.',
    ar: '{n}% من المشروع لا تقيسه أي متابعة ومساهمته 0%. أكمِل الأوزان إلى 100%.',
  },
  'cs.pp.trackingCount': {
    tr: 'Takip sayısı',
    en: 'Trackings',
    de: 'Verfolgungen',
    ar: 'عدد المتابعات',
  },
  'cs.pp.breakdown': {
    tr: 'Takip kırılımı',
    en: 'Tracking breakdown',
    de: 'Aufschlüsselung',
    ar: 'تفصيل المتابعات',
  },
  'cs.pp.contribution': { tr: 'Katkı', en: 'Contribution', de: 'Beitrag', ar: 'المساهمة' },
  'cs.pp.noTrackings': {
    tr: 'Fiziksel ilerleme ölçülmüyor — bu projede takip tanımlı değil.',
    en: 'Physical progress is not being measured — no tracking is defined for this project.',
    de: 'Der physische Fortschritt wird nicht gemessen — für dieses Projekt ist keine Verfolgung definiert.',
    ar: 'لا يُقاس التقدم المادي — لا توجد متابعة مُعرَّفة لهذا المشروع.',
  },
};

/** Şantiye etiketi getir; `vars` ile {placeholder} doldurulur. */
export function csT(
  key: CsLabelKey,
  lang: string | undefined,
  vars?: Record<string, string | number>,
): string {
  const l: Lang = lang === 'en' || lang === 'de' || lang === 'ar' ? lang : 'tr';
  let text = DICT[key]?.[l] ?? DICT[key]?.tr ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  }
  return text;
}

/** Lokasyon tipi etiketi. */
export function locationKindLabel(kind: string, lang: string | undefined): string {
  switch (kind) {
    case 'site':
      return csT('cs.loc.kind.site', lang);
    case 'block':
      return csT('cs.loc.kind.block', lang);
    case 'floor':
      return csT('cs.loc.kind.floor', lang);
    case 'unit':
      return csT('cs.loc.kind.unit', lang);
    case 'zone':
      return csT('cs.loc.kind.zone', lang);
    default:
      return kind;
  }
}

/** Saha durumu etiketi. */
export function itemStateLabel(state: string, lang: string | undefined): string {
  switch (state) {
    case 'not_started':
      return csT('cs.board.state.notStarted', lang);
    case 'in_progress':
      return csT('cs.board.state.inProgress', lang);
    case 'has_defects':
      return csT('cs.board.state.hasDefects', lang);
    case 'completed':
      return csT('cs.board.state.completed', lang);
    default:
      return state;
  }
}

/** Takip durumu etiketi. */
export function trackingStatusLabel(status: string, lang: string | undefined): string {
  switch (status) {
    case 'draft':
      return csT('cs.trk.status.draft', lang);
    case 'active':
      return csT('cs.trk.status.active', lang);
    case 'completed':
      return csT('cs.trk.status.completed', lang);
    case 'cancelled':
      return csT('cs.trk.status.cancelled', lang);
    default:
      return status;
  }
}

/** Takip kapsamı etiketi. */
export function trackScopeLabel(scope: string, lang: string | undefined): string {
  switch (scope) {
    case 'general':
      return csT('cs.tpl.scope.general', lang);
    case 'block':
      return csT('cs.tpl.scope.block', lang);
    case 'floor':
      return csT('cs.tpl.scope.floor', lang);
    case 'unit':
      return csT('cs.tpl.scope.unit', lang);
    default:
      return scope;
  }
}

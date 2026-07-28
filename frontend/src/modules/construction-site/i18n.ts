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
  | 'cs.pp.noTrackings'
  // Şantiye günlüğü (Faz 3)
  | 'cs.dlog.title'
  | 'cs.dlog.subtitle'
  | 'cs.dlog.calendar'
  | 'cs.dlog.prevMonth'
  | 'cs.dlog.nextMonth'
  | 'cs.dlog.today'
  | 'cs.dlog.backToCalendar'
  | 'cs.dlog.noDay'
  | 'cs.dlog.createDay'
  | 'cs.dlog.workState'
  | 'cs.dlog.workState.working'
  | 'cs.dlog.workState.notWorking'
  | 'cs.dlog.workState.partial'
  | 'cs.dlog.temp'
  | 'cs.dlog.weatherNote'
  | 'cs.dlog.noWorkReason'
  | 'cs.dlog.noWorkReasonRequired'
  | 'cs.dlog.summary'
  | 'cs.dlog.lock'
  | 'cs.dlog.unlock'
  | 'cs.dlog.lockConfirm'
  | 'cs.dlog.unlockConfirm'
  | 'cs.dlog.lockedBanner'
  | 'cs.dlog.lockedAt'
  | 'cs.dlog.saveHeader'
  | 'cs.dlog.addEntry'
  | 'cs.dlog.deleteEntryConfirm'
  | 'cs.dlog.reqFieldsHint'
  | 'cs.dlog.files'
  | 'cs.dlog.addFile'
  | 'cs.dlog.fileUrl'
  | 'cs.dlog.fileTitle'
  | 'cs.dlog.noFiles'
  | 'cs.dlog.comments'
  | 'cs.dlog.addComment'
  | 'cs.dlog.commentPlaceholder'
  | 'cs.dlog.noComments'
  | 'cs.dlog.commentOnLockedHint'
  // Gün toplamları
  | 'cs.dlog.tot.ownHeadcount'
  | 'cs.dlog.tot.subHeadcount'
  | 'cs.dlog.tot.hours'
  | 'cs.dlog.tot.equipHours'
  | 'cs.dlog.tot.accidents'
  | 'cs.dlog.tot.production'
  | 'cs.dlog.tot.delivery'
  | 'cs.dlog.tot.entries'
  // Kayıt tipleri
  | 'cs.dlog.kind.subcontractor'
  | 'cs.dlog.kind.personnel'
  | 'cs.dlog.kind.equipment'
  | 'cs.dlog.kind.note'
  | 'cs.dlog.kind.delivery'
  | 'cs.dlog.kind.accident'
  | 'cs.dlog.kind.material_used'
  | 'cs.dlog.kind.production'
  | 'cs.dlog.kind.fuel'
  | 'cs.dlog.kind.maintenance'
  | 'cs.dlog.kind.visitor'
  // Satır alanları
  | 'cs.dlog.f.vendorId'
  | 'cs.dlog.f.personnelId'
  | 'cs.dlog.f.machineId'
  | 'cs.dlog.f.materialId'
  | 'cs.dlog.f.boqLineId'
  | 'cs.dlog.f.trackingItemId'
  | 'cs.dlog.f.locationId'
  | 'cs.dlog.f.crewName'
  | 'cs.dlog.f.personName'
  | 'cs.dlog.f.description'
  | 'cs.dlog.f.headcount'
  | 'cs.dlog.f.hours'
  | 'cs.dlog.f.idleHours'
  | 'cs.dlog.f.qty'
  | 'cs.dlog.f.unit'
  | 'cs.dlog.f.amount'
  | 'cs.dlog.f.waybillNo'
  | 'cs.dlog.f.occurredAt'
  | 'cs.dlog.f.severity'
  | 'cs.dlog.f.lostDays'
  // İSG şiddet
  | 'cs.dlog.sev.near_miss'
  | 'cs.dlog.sev.first_aid'
  | 'cs.dlog.sev.medical'
  | 'cs.dlog.sev.lost_time'
  | 'cs.dlog.sev.fatal'
  // Raporlar
  | 'cs.dlog.rep.tab.calendar'
  | 'cs.dlog.rep.tab.manpower'
  | 'cs.dlog.rep.tab.safety'
  | 'cs.dlog.rep.tab.production'
  | 'cs.dlog.rep.range'
  | 'cs.dlog.rep.from'
  | 'cs.dlog.rep.to'
  | 'cs.dlog.mp.title'
  | 'cs.dlog.mp.ownHours'
  | 'cs.dlog.mp.subHours'
  | 'cs.dlog.mp.totalHours'
  | 'cs.dlog.mp.workedDays'
  | 'cs.dlog.mp.notWorkedDays'
  | 'cs.dlog.mp.avgHeadcount'
  | 'cs.dlog.mp.date'
  | 'cs.dlog.sf.title'
  | 'cs.dlog.sf.totalHours'
  | 'cs.dlog.sf.accidents'
  | 'cs.dlog.sf.recordable'
  | 'cs.dlog.sf.nearMiss'
  | 'cs.dlog.sf.lostDays'
  | 'cs.dlog.sf.frequencyRate'
  | 'cs.dlog.sf.severityRate'
  | 'cs.dlog.sf.rateUndefined'
  | 'cs.dlog.sf.frequencyHint'
  | 'cs.dlog.sf.severityHint'
  | 'cs.dlog.pr.title'
  | 'cs.dlog.pr.boqLine'
  | 'cs.dlog.pr.producedQty'
  | 'cs.dlog.pr.entryCount'
  | 'cs.dlog.pr.firstDate'
  | 'cs.dlog.pr.lastDate'
  | 'cs.dlog.pr.hint'
  // Adam×saat & verimlilik (Faz 4)
  | 'cs.perf.title'
  | 'cs.perf.subtitle'
  | 'cs.perf.contract'
  | 'cs.perf.selectContract'
  | 'cs.perf.allContracts'
  | 'cs.perf.editManhours'
  | 'cs.perf.saveManhours'
  | 'cs.perf.manhoursSaved'
  | 'cs.perf.noPlanWarn'
  | 'cs.perf.noLines'
  // Kolon grupları
  | 'cs.perf.grp.planned'
  | 'cs.perf.grp.qty'
  | 'cs.perf.grp.manhours'
  | 'cs.perf.grp.productivity'
  | 'cs.perf.grp.amount'
  // Kolonlar
  | 'cs.perf.c.pozNo'
  | 'cs.perf.c.description'
  | 'cs.perf.c.unit'
  | 'cs.perf.c.plannedQty'
  | 'cs.perf.c.unitPrice'
  | 'cs.perf.c.plannedAmount'
  | 'cs.perf.c.pursantaj'
  | 'cs.perf.c.unitManhours'
  | 'cs.perf.c.plannedManhours'
  | 'cs.perf.c.progressQty'
  | 'cs.perf.c.producedQty'
  | 'cs.perf.c.progressPct'
  | 'cs.perf.c.producedPct'
  | 'cs.perf.c.earnedPursantaj'
  | 'cs.perf.c.productionVsProgress'
  | 'cs.perf.c.ownManhours'
  | 'cs.perf.c.subManhours'
  | 'cs.perf.c.actualManhours'
  | 'cs.perf.c.machineHours'
  | 'cs.perf.c.manhourPct'
  | 'cs.perf.c.progressGap'
  | 'cs.perf.c.actualUnitManhours'
  | 'cs.perf.c.expectedManhours'
  | 'cs.perf.c.efficiency'
  | 'cs.perf.c.manhourVariance'
  | 'cs.perf.c.eacManhours'
  | 'cs.perf.c.eacVariance'
  | 'cs.perf.c.progressAmount'
  | 'cs.perf.c.expenseAmount'
  // İpuçları
  | 'cs.perf.h.unitManhours'
  | 'cs.perf.h.progressQty'
  | 'cs.perf.h.producedQty'
  | 'cs.perf.h.progressGap'
  | 'cs.perf.h.efficiency'
  | 'cs.perf.h.eac'
  | 'cs.perf.h.productionVsProgress'
  | 'cs.perf.h.machineHours'
  // Verim bandı
  | 'cs.perf.band.unknown'
  | 'cs.perf.band.critical'
  | 'cs.perf.band.behind'
  | 'cs.perf.band.onTrack'
  | 'cs.perf.band.ahead'
  // Özet
  | 'cs.perf.s.title'
  | 'cs.perf.s.lineCount'
  | 'cs.perf.s.linesWithoutPlan'
  | 'cs.perf.s.weighted';

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

  // ===== ŞANTİYE GÜNLÜĞÜ (FAZ 3) ===========================================
  'cs.dlog.title': {
    tr: 'Şantiye Günlüğü',
    en: 'Site Daily Log',
    de: 'Bautagebuch',
    ar: 'يومية الموقع',
  },
  'cs.dlog.subtitle': {
    tr: 'Günlük rapor hukuki ve teknik bir kayıttır: hangi gün çalışıldı, kim kaç saat çalıştı, ne imal edildi, kaza oldu mu. Rapor kilitlendikten sonra satırlar değiştirilemez.',
    en: 'The daily report is a legal and technical record: which days were worked, who worked how many hours, what was produced, whether an accident occurred. Once locked, entries cannot be changed.',
    de: 'Der Tagesbericht ist ein rechtlicher und technischer Nachweis: an welchen Tagen gearbeitet wurde, wer wie viele Stunden arbeitete, was hergestellt wurde, ob ein Unfall geschah. Nach dem Sperren sind Einträge unveränderlich.',
    ar: 'التقرير اليومي سجل قانوني وفني: في أي يوم تم العمل، ومن عمل كم ساعة، وما تم إنتاجه، وهل وقع حادث. بعد القفل لا يمكن تغيير السجلات.',
  },
  'cs.dlog.calendar': {
    tr: 'Takvim',
    en: 'Calendar',
    de: 'Kalender',
    ar: 'التقويم',
  },
  'cs.dlog.prevMonth': {
    tr: 'Önceki ay',
    en: 'Previous month',
    de: 'Vorheriger Monat',
    ar: 'الشهر السابق',
  },
  'cs.dlog.nextMonth': {
    tr: 'Sonraki ay',
    en: 'Next month',
    de: 'Nächster Monat',
    ar: 'الشهر التالي',
  },
  'cs.dlog.today': {
    tr: 'Bugün',
    en: 'Today',
    de: 'Heute',
    ar: 'اليوم',
  },
  'cs.dlog.backToCalendar': {
    tr: '← Takvim',
    en: '← Calendar',
    de: '← Kalender',
    ar: '← التقويم',
  },
  'cs.dlog.noDay': {
    tr: 'Bu gün için henüz rapor açılmadı.',
    en: 'No report has been opened for this day yet.',
    de: 'Für diesen Tag wurde noch kein Bericht angelegt.',
    ar: 'لم يُفتح تقرير لهذا اليوم بعد.',
  },
  'cs.dlog.createDay': {
    tr: 'Bu günün raporunu aç',
    en: 'Open this day’s report',
    de: 'Bericht für diesen Tag anlegen',
    ar: 'افتح تقرير هذا اليوم',
  },
  'cs.dlog.workState': {
    tr: 'Çalışma durumu',
    en: 'Work state',
    de: 'Arbeitsstatus',
    ar: 'حالة العمل',
  },
  'cs.dlog.workState.working': {
    tr: 'Çalışıldı',
    en: 'Worked',
    de: 'Gearbeitet',
    ar: 'تم العمل',
  },
  'cs.dlog.workState.notWorking': {
    tr: 'Çalışılmadı',
    en: 'Not worked',
    de: 'Nicht gearbeitet',
    ar: 'لم يتم العمل',
  },
  'cs.dlog.workState.partial': {
    tr: 'Yarım gün',
    en: 'Half day',
    de: 'Halber Tag',
    ar: 'نصف يوم',
  },
  'cs.dlog.temp': {
    tr: 'Sıcaklık (°C)',
    en: 'Temperature (°C)',
    de: 'Temperatur (°C)',
    ar: 'درجة الحرارة (°م)',
  },
  'cs.dlog.weatherNote': {
    tr: 'Hava notu',
    en: 'Weather note',
    de: 'Wetternotiz',
    ar: 'ملاحظة الطقس',
  },
  'cs.dlog.noWorkReason': {
    tr: 'Çalışılmama gerekçesi',
    en: 'Reason for no work',
    de: 'Grund für Arbeitsausfall',
    ar: 'سبب عدم العمل',
  },
  'cs.dlog.noWorkReasonRequired': {
    tr: 'Çalışılmayan gün için gerekçe zorunludur — hakediş süre uzatımı taleplerinde delil olarak kullanılır.',
    en: 'A reason is required for a non-working day — it is used as evidence in time-extension claims.',
    de: 'Für einen Ausfalltag ist eine Begründung erforderlich — sie dient als Nachweis bei Bauzeitverlängerungen.',
    ar: 'السبب مطلوب ليوم بلا عمل — يُستخدم دليلًا في مطالبات تمديد المدة.',
  },
  'cs.dlog.summary': {
    tr: 'Gün özeti',
    en: 'Day summary',
    de: 'Tageszusammenfassung',
    ar: 'ملخص اليوم',
  },
  'cs.dlog.lock': {
    tr: 'Raporu kilitle',
    en: 'Lock report',
    de: 'Bericht sperren',
    ar: 'قفل التقرير',
  },
  'cs.dlog.unlock': {
    tr: 'Kilidi aç',
    en: 'Unlock',
    de: 'Entsperren',
    ar: 'إلغاء القفل',
  },
  'cs.dlog.lockConfirm': {
    tr: '{date} raporu kilitlenecek. Kilitlendikten sonra satır eklenemez ve değiştirilemez. Onaylıyor musunuz?',
    en: 'The report for {date} will be locked. After locking, entries cannot be added or changed. Do you confirm?',
    de: 'Der Bericht für {date} wird gesperrt. Danach können keine Einträge hinzugefügt oder geändert werden. Bestätigen Sie?',
    ar: 'سيتم قفل تقرير {date}. بعد القفل لا يمكن إضافة أو تغيير السجلات. هل تؤكد؟',
  },
  'cs.dlog.unlockConfirm': {
    tr: '{date} raporunun kilidi açılacak. Kapanmış bir raporu yeniden açmak kanıt değerine dokunur ve iz bırakır. Onaylıyor musunuz?',
    en: 'The report for {date} will be unlocked. Reopening a closed report affects its evidentiary value and leaves an audit trail. Do you confirm?',
    de: 'Der Bericht für {date} wird entsperrt. Das Wiederöffnen eines abgeschlossenen Berichts berührt seinen Beweiswert und hinterlässt eine Spur. Bestätigen Sie?',
    ar: 'سيتم إلغاء قفل تقرير {date}. إعادة فتح تقرير مغلق تمسّ قيمته الإثباتية وتترك أثرًا. هل تؤكد؟',
  },
  'cs.dlog.lockedBanner': {
    tr: 'Bu rapor kilitli — satır eklenemez ve değiştirilemez. Yorum yapmak serbesttir.',
    en: 'This report is locked — entries cannot be added or changed. Commenting is still allowed.',
    de: 'Dieser Bericht ist gesperrt — Einträge können nicht hinzugefügt oder geändert werden. Kommentieren ist weiterhin möglich.',
    ar: 'هذا التقرير مقفل — لا يمكن إضافة أو تغيير السجلات. التعليق مسموح.',
  },
  'cs.dlog.lockedAt': {
    tr: 'Kilitlenme',
    en: 'Locked at',
    de: 'Gesperrt am',
    ar: 'وقت القفل',
  },
  'cs.dlog.saveHeader': {
    tr: 'Gün bilgilerini kaydet',
    en: 'Save day details',
    de: 'Tagesangaben speichern',
    ar: 'حفظ بيانات اليوم',
  },
  'cs.dlog.addEntry': {
    tr: 'Kayıt ekle',
    en: 'Add entry',
    de: 'Eintrag hinzufügen',
    ar: 'إضافة سجل',
  },
  'cs.dlog.deleteEntryConfirm': {
    tr: 'Bu kayıt silinecek. Onaylıyor musunuz?',
    en: 'This entry will be deleted. Do you confirm?',
    de: 'Dieser Eintrag wird gelöscht. Bestätigen Sie?',
    ar: 'سيتم حذف هذا السجل. هل تؤكد؟',
  },
  'cs.dlog.reqFieldsHint': {
    tr: 'Yıldızlı alanlar bu kayıt tipi için zorunludur.',
    en: 'Starred fields are required for this entry type.',
    de: 'Mit Stern markierte Felder sind für diesen Eintragstyp erforderlich.',
    ar: 'الحقول المعلَّمة بنجمة مطلوبة لهذا النوع.',
  },
  'cs.dlog.files': {
    tr: 'Galeri / Ekler',
    en: 'Gallery / Attachments',
    de: 'Galerie / Anhänge',
    ar: 'المعرض / المرفقات',
  },
  'cs.dlog.addFile': {
    tr: 'Ek ekle',
    en: 'Add attachment',
    de: 'Anhang hinzufügen',
    ar: 'إضافة مرفق',
  },
  'cs.dlog.fileUrl': {
    tr: 'Dosya bağlantısı',
    en: 'File link',
    de: 'Dateilink',
    ar: 'رابط الملف',
  },
  'cs.dlog.fileTitle': {
    tr: 'Başlık',
    en: 'Title',
    de: 'Titel',
    ar: 'العنوان',
  },
  'cs.dlog.noFiles': {
    tr: 'Henüz ekli resim veya döküman yok.',
    en: 'No images or documents attached yet.',
    de: 'Noch keine Bilder oder Dokumente angehängt.',
    ar: 'لا صور أو مستندات مرفقة بعد.',
  },
  'cs.dlog.comments': {
    tr: 'Yorumlar',
    en: 'Comments',
    de: 'Kommentare',
    ar: 'التعليقات',
  },
  'cs.dlog.addComment': {
    tr: 'Yorum ekle',
    en: 'Add comment',
    de: 'Kommentar hinzufügen',
    ar: 'إضافة تعليق',
  },
  'cs.dlog.commentPlaceholder': {
    tr: 'Teknik ofis şerhi, saha notu…',
    en: 'Technical office remark, field note…',
    de: 'Anmerkung des technischen Büros, Feldnotiz…',
    ar: 'ملاحظة المكتب الفني، ملاحظة ميدانية…',
  },
  'cs.dlog.noComments': {
    tr: 'Henüz yorum yok.',
    en: 'No comments yet.',
    de: 'Noch keine Kommentare.',
    ar: 'لا تعليقات بعد.',
  },
  'cs.dlog.commentOnLockedHint': {
    tr: 'Kilit veriyi dondurur, yazışmayı değil.',
    en: 'The lock freezes data, not correspondence.',
    de: 'Die Sperre friert Daten ein, nicht die Korrespondenz.',
    ar: 'القفل يجمّد البيانات لا المراسلات.',
  },
  'cs.dlog.tot.ownHeadcount': {
    tr: 'Kendi personeli',
    en: 'Own staff',
    de: 'Eigenes Personal',
    ar: 'الطاقم الذاتي',
  },
  'cs.dlog.tot.subHeadcount': {
    tr: 'Taşeron',
    en: 'Subcontractor',
    de: 'Nachunternehmer',
    ar: 'المقاول',
  },
  'cs.dlog.tot.hours': {
    tr: 'Saat',
    en: 'Hours',
    de: 'Stunden',
    ar: 'ساعات',
  },
  'cs.dlog.tot.equipHours': {
    tr: 'Makine saati',
    en: 'Machine hours',
    de: 'Maschinenstunden',
    ar: 'ساعات الآلات',
  },
  'cs.dlog.tot.accidents': {
    tr: 'Kaza',
    en: 'Accidents',
    de: 'Unfälle',
    ar: 'الحوادث',
  },
  'cs.dlog.tot.production': {
    tr: 'İmalat',
    en: 'Production',
    de: 'Herstellung',
    ar: 'الإنتاج',
  },
  'cs.dlog.tot.delivery': {
    tr: 'Teslimat',
    en: 'Deliveries',
    de: 'Lieferungen',
    ar: 'التسليمات',
  },
  'cs.dlog.tot.entries': {
    tr: 'Kayıt',
    en: 'Entries',
    de: 'Einträge',
    ar: 'السجلات',
  },
  'cs.dlog.kind.subcontractor': {
    tr: 'Taşeron Kayıtları',
    en: 'Subcontractor Records',
    de: 'Nachunternehmer-Einträge',
    ar: 'سجلات المقاولين',
  },
  'cs.dlog.kind.personnel': {
    tr: 'Personel Kayıtları',
    en: 'Personnel Records',
    de: 'Personaleinträge',
    ar: 'سجلات الطاقم',
  },
  'cs.dlog.kind.equipment': {
    tr: 'Ekipman Kayıtları',
    en: 'Equipment Records',
    de: 'Geräteeinträge',
    ar: 'سجلات المعدات',
  },
  'cs.dlog.kind.note': {
    tr: 'Not Kayıtları',
    en: 'Notes',
    de: 'Notizen',
    ar: 'الملاحظات',
  },
  'cs.dlog.kind.delivery': {
    tr: 'Sipariş Teslimat Kayıtları',
    en: 'Delivery Records',
    de: 'Lieferungseinträge',
    ar: 'سجلات التسليم',
  },
  'cs.dlog.kind.accident': {
    tr: 'Kaza Kayıtları (İSG)',
    en: 'Accident Records (H&S)',
    de: 'Unfalleinträge (SGA)',
    ar: 'سجلات الحوادث (السلامة)',
  },
  'cs.dlog.kind.material_used': {
    tr: 'Kullanılan Malzeme',
    en: 'Materials Used',
    de: 'Verbrauchtes Material',
    ar: 'المواد المستخدمة',
  },
  'cs.dlog.kind.production': {
    tr: 'İmalat Kayıtları',
    en: 'Production Records',
    de: 'Herstellungseinträge',
    ar: 'سجلات الإنتاج',
  },
  'cs.dlog.kind.fuel': {
    tr: 'Yakıt ve Sarf Malzeme',
    en: 'Fuel & Consumables',
    de: 'Kraftstoff & Verbrauchsmaterial',
    ar: 'الوقود والمستهلكات',
  },
  'cs.dlog.kind.maintenance': {
    tr: 'Bakım / Servis',
    en: 'Maintenance / Service',
    de: 'Wartung / Service',
    ar: 'الصيانة / الخدمة',
  },
  'cs.dlog.kind.visitor': {
    tr: 'Ziyaretçi Kayıtları',
    en: 'Visitor Records',
    de: 'Besuchereinträge',
    ar: 'سجلات الزوار',
  },
  'cs.dlog.f.vendorId': {
    tr: 'Firma',
    en: 'Company',
    de: 'Firma',
    ar: 'الشركة',
  },
  'cs.dlog.f.personnelId': {
    tr: 'Personel',
    en: 'Personnel',
    de: 'Personal',
    ar: 'الموظف',
  },
  'cs.dlog.f.machineId': {
    tr: 'Makine',
    en: 'Machine',
    de: 'Maschine',
    ar: 'الآلة',
  },
  'cs.dlog.f.materialId': {
    tr: 'Malzeme',
    en: 'Material',
    de: 'Material',
    ar: 'المادة',
  },
  'cs.dlog.f.boqLineId': {
    tr: 'Keşif satırı',
    en: 'BoQ line',
    de: 'LV-Position',
    ar: 'بند الكشف',
  },
  'cs.dlog.f.trackingItemId': {
    tr: 'Takip iş kalemi',
    en: 'Tracking work item',
    de: 'Verfolgungsposition',
    ar: 'بند المتابعة',
  },
  'cs.dlog.f.locationId': {
    tr: 'Mekân',
    en: 'Location',
    de: 'Standort',
    ar: 'الموقع',
  },
  'cs.dlog.f.crewName': {
    tr: 'Ekip',
    en: 'Crew',
    de: 'Team',
    ar: 'الفريق',
  },
  'cs.dlog.f.personName': {
    tr: 'Kişi adı',
    en: 'Person name',
    de: 'Name der Person',
    ar: 'اسم الشخص',
  },
  'cs.dlog.f.description': {
    tr: 'Açıklama',
    en: 'Description',
    de: 'Beschreibung',
    ar: 'الوصف',
  },
  'cs.dlog.f.headcount': {
    tr: 'Kişi sayısı',
    en: 'Headcount',
    de: 'Personenanzahl',
    ar: 'عدد الأفراد',
  },
  'cs.dlog.f.hours': {
    tr: 'Çalışma saati',
    en: 'Work hours',
    de: 'Arbeitsstunden',
    ar: 'ساعات العمل',
  },
  'cs.dlog.f.idleHours': {
    tr: 'Rölanti saati',
    en: 'Idle hours',
    de: 'Leerlaufstunden',
    ar: 'ساعات الخمول',
  },
  'cs.dlog.f.qty': {
    tr: 'Miktar',
    en: 'Quantity',
    de: 'Menge',
    ar: 'الكمية',
  },
  'cs.dlog.f.unit': {
    tr: 'Birim',
    en: 'Unit',
    de: 'Einheit',
    ar: 'الوحدة',
  },
  'cs.dlog.f.amount': {
    tr: 'Tutar',
    en: 'Amount',
    de: 'Betrag',
    ar: 'المبلغ',
  },
  'cs.dlog.f.waybillNo': {
    tr: 'İrsaliye no',
    en: 'Waybill no',
    de: 'Lieferscheinnr.',
    ar: 'رقم بوليصة',
  },
  'cs.dlog.f.occurredAt': {
    tr: 'Saat',
    en: 'Time',
    de: 'Uhrzeit',
    ar: 'الوقت',
  },
  'cs.dlog.f.severity': {
    tr: 'Olay şiddeti',
    en: 'Event severity',
    de: 'Schweregrad',
    ar: 'شدة الحادث',
  },
  'cs.dlog.f.lostDays': {
    tr: 'Kayıp gün',
    en: 'Lost days',
    de: 'Ausfalltage',
    ar: 'الأيام المفقودة',
  },
  'cs.dlog.sev.near_miss': {
    tr: 'Ramak kala',
    en: 'Near miss',
    de: 'Beinaheunfall',
    ar: 'حادث وشيك',
  },
  'cs.dlog.sev.first_aid': {
    tr: 'İlk yardım',
    en: 'First aid',
    de: 'Erste Hilfe',
    ar: 'إسعاف أولي',
  },
  'cs.dlog.sev.medical': {
    tr: 'Tıbbi müdahale',
    en: 'Medical treatment',
    de: 'Medizinische Behandlung',
    ar: 'علاج طبي',
  },
  'cs.dlog.sev.lost_time': {
    tr: 'İş günü kaybı',
    en: 'Lost time',
    de: 'Ausfallzeit',
    ar: 'فقدان وقت عمل',
  },
  'cs.dlog.sev.fatal': {
    tr: 'Ölümlü',
    en: 'Fatal',
    de: 'Tödlich',
    ar: 'مُميت',
  },
  'cs.dlog.rep.tab.calendar': {
    tr: 'Takvim',
    en: 'Calendar',
    de: 'Kalender',
    ar: 'التقويم',
  },
  'cs.dlog.rep.tab.manpower': {
    tr: 'İş Gücü',
    en: 'Manpower',
    de: 'Arbeitskräfte',
    ar: 'القوى العاملة',
  },
  'cs.dlog.rep.tab.safety': {
    tr: 'İSG',
    en: 'Health & Safety',
    de: 'SGA',
    ar: 'السلامة',
  },
  'cs.dlog.rep.tab.production': {
    tr: 'İmalat',
    en: 'Production',
    de: 'Herstellung',
    ar: 'الإنتاج',
  },
  'cs.dlog.rep.range': {
    tr: 'Tarih aralığı',
    en: 'Date range',
    de: 'Zeitraum',
    ar: 'النطاق الزمني',
  },
  'cs.dlog.rep.from': {
    tr: 'Başlangıç',
    en: 'From',
    de: 'Von',
    ar: 'من',
  },
  'cs.dlog.rep.to': {
    tr: 'Bitiş',
    en: 'To',
    de: 'Bis',
    ar: 'إلى',
  },
  'cs.dlog.mp.title': {
    tr: 'İş Gücü Raporu',
    en: 'Manpower Report',
    de: 'Arbeitskräftebericht',
    ar: 'تقرير القوى العاملة',
  },
  'cs.dlog.mp.ownHours': {
    tr: 'Kendi personeli saati',
    en: 'Own staff hours',
    de: 'Stunden eigenes Personal',
    ar: 'ساعات الطاقم الذاتي',
  },
  'cs.dlog.mp.subHours': {
    tr: 'Taşeron saati',
    en: 'Subcontractor hours',
    de: 'Nachunternehmerstunden',
    ar: 'ساعات المقاول',
  },
  'cs.dlog.mp.totalHours': {
    tr: 'Toplam saat',
    en: 'Total hours',
    de: 'Gesamtstunden',
    ar: 'إجمالي الساعات',
  },
  'cs.dlog.mp.workedDays': {
    tr: 'Çalışılan gün',
    en: 'Worked days',
    de: 'Arbeitstage',
    ar: 'أيام العمل',
  },
  'cs.dlog.mp.notWorkedDays': {
    tr: 'Çalışılmayan gün',
    en: 'Non-working days',
    de: 'Ausfalltage',
    ar: 'أيام بلا عمل',
  },
  'cs.dlog.mp.avgHeadcount': {
    tr: 'Ortalama günlük mevcut',
    en: 'Average daily headcount',
    de: 'Durchschnittliche Tagesbelegschaft',
    ar: 'المتوسط اليومي للأفراد',
  },
  'cs.dlog.mp.date': {
    tr: 'Tarih',
    en: 'Date',
    de: 'Datum',
    ar: 'التاريخ',
  },
  'cs.dlog.sf.title': {
    tr: 'İSG Özeti',
    en: 'Health & Safety Summary',
    de: 'SGA-Zusammenfassung',
    ar: 'ملخص السلامة',
  },
  'cs.dlog.sf.totalHours': {
    tr: 'Toplam çalışma saati',
    en: 'Total work hours',
    de: 'Gesamtarbeitsstunden',
    ar: 'إجمالي ساعات العمل',
  },
  'cs.dlog.sf.accidents': {
    tr: 'Toplam olay',
    en: 'Total events',
    de: 'Ereignisse insgesamt',
    ar: 'إجمالي الأحداث',
  },
  'cs.dlog.sf.recordable': {
    tr: 'Kaydedilebilir kaza',
    en: 'Recordable accidents',
    de: 'Meldepflichtige Unfälle',
    ar: 'الحوادث القابلة للتسجيل',
  },
  'cs.dlog.sf.nearMiss': {
    tr: 'Ramak kala',
    en: 'Near misses',
    de: 'Beinaheunfälle',
    ar: 'حوادث وشيكة',
  },
  'cs.dlog.sf.lostDays': {
    tr: 'Kayıp gün',
    en: 'Lost days',
    de: 'Ausfalltage',
    ar: 'الأيام المفقودة',
  },
  'cs.dlog.sf.frequencyRate': {
    tr: 'Kaza sıklık oranı',
    en: 'Accident frequency rate',
    de: 'Unfallhäufigkeitsrate',
    ar: 'معدل تكرار الحوادث',
  },
  'cs.dlog.sf.severityRate': {
    tr: 'Kaza ağırlık oranı',
    en: 'Accident severity rate',
    de: 'Unfallschwererate',
    ar: 'معدل شدة الحوادث',
  },
  'cs.dlog.sf.rateUndefined': {
    tr: 'Çalışma saati girilmediği için oran hesaplanamaz.',
    en: 'The rate cannot be computed because no work hours were recorded.',
    de: 'Die Rate ist nicht berechenbar, da keine Arbeitsstunden erfasst wurden.',
    ar: 'لا يمكن حساب المعدل لعدم تسجيل ساعات عمل.',
  },
  'cs.dlog.sf.frequencyHint': {
    tr: 'Kaydedilebilir kaza × 1.000.000 / toplam çalışma saati. Ramak kala sayılmaz.',
    en: 'Recordable accidents × 1,000,000 / total work hours. Near misses are excluded.',
    de: 'Meldepflichtige Unfälle × 1.000.000 / Gesamtarbeitsstunden. Beinaheunfälle zählen nicht.',
    ar: 'الحوادث القابلة للتسجيل × 1.000.000 / إجمالي ساعات العمل. لا تُحسب الحوادث الوشيكة.',
  },
  'cs.dlog.sf.severityHint': {
    tr: 'Kayıp gün × 1.000 / toplam çalışma saati.',
    en: 'Lost days × 1,000 / total work hours.',
    de: 'Ausfalltage × 1.000 / Gesamtarbeitsstunden.',
    ar: 'الأيام المفقودة × 1.000 / إجمالي ساعات العمل.',
  },
  'cs.dlog.pr.title': {
    tr: 'Gerçekleşen İmalat',
    en: 'Actual Production',
    de: 'Tatsächliche Herstellung',
    ar: 'الإنتاج الفعلي',
  },
  'cs.dlog.pr.boqLine': {
    tr: 'Keşif satırı',
    en: 'BoQ line',
    de: 'LV-Position',
    ar: 'بند الكشف',
  },
  'cs.dlog.pr.producedQty': {
    tr: 'Üretilen miktar',
    en: 'Produced quantity',
    de: 'Hergestellte Menge',
    ar: 'الكمية المنتجة',
  },
  'cs.dlog.pr.entryCount': {
    tr: 'Kayıt sayısı',
    en: 'Entry count',
    de: 'Anzahl Einträge',
    ar: 'عدد السجلات',
  },
  'cs.dlog.pr.firstDate': {
    tr: 'İlk kayıt',
    en: 'First entry',
    de: 'Erster Eintrag',
    ar: 'أول سجل',
  },
  'cs.dlog.pr.lastDate': {
    tr: 'Son kayıt',
    en: 'Last entry',
    de: 'Letzter Eintrag',
    ar: 'آخر سجل',
  },
  'cs.dlog.pr.hint': {
    tr: 'Günlük imalat kayıtlarından toplanır; hakedişten bağımsız ölçümdür.',
    en: 'Aggregated from daily production entries; measured independently of progress payments.',
    de: 'Aus den täglichen Herstellungseinträgen aggregiert; unabhängig von Abschlagszahlungen gemessen.',
    ar: 'يُجمَّع من سجلات الإنتاج اليومية؛ قياس مستقل عن المستخلصات.',
  },

  // ===== ADAM×SAAT & VERİMLİLİK (FAZ 4) ====================================
  'cs.perf.title': {
    tr: 'Adam×Saat & Verimlilik',
    en: 'Man-hours & Productivity',
    de: 'Personenstunden & Produktivität',
    ar: 'ساعات العمل والإنتاجية',
  },
  'cs.perf.subtitle': {
    tr: 'Poz bazlı işçilik performansı. Şantiyede kâr çoğunlukla burada kaybolur: miktarın yarısını yapmışken adam-saatin çoğunu yakmışsan tutar tablosu hâlâ iyi görünürken iş fiilen batıyordur.',
    en: 'Work-item level labour performance. Profit is usually lost here: if you have done half the quantity but burned most of the man-hours, the cost table still looks fine while the job is actually sinking.',
    de: 'Arbeitsleistung auf Positionsebene. Hier geht der Gewinn meist verloren: Wenn die halbe Menge erbracht, aber der Großteil der Stunden verbraucht ist, sieht die Kostentabelle noch gut aus, während das Projekt kippt.',
    ar: 'أداء العمالة على مستوى البند. هنا تُفقد الأرباح غالبًا: إذا أنجزت نصف الكمية واستهلكت معظم ساعات العمل، يبدو جدول التكلفة جيدًا بينما العمل يغرق فعليًا.',
  },
  'cs.perf.contract': {
    tr: 'Sözleşme',
    en: 'Contract',
    de: 'Vertrag',
    ar: 'العقد',
  },
  'cs.perf.selectContract': {
    tr: 'Sözleşme seçin',
    en: 'Select a contract',
    de: 'Vertrag auswählen',
    ar: 'اختر عقدًا',
  },
  'cs.perf.allContracts': {
    tr: 'Tüm sözleşmeler (proje geneli)',
    en: 'All contracts (whole project)',
    de: 'Alle Verträge (gesamtes Projekt)',
    ar: 'كل العقود (المشروع بأكمله)',
  },
  'cs.perf.editManhours': {
    tr: 'Birim adam×saat gir',
    en: 'Enter unit man-hours',
    de: 'Personenstunden je Einheit erfassen',
    ar: 'إدخال ساعات العمل للوحدة',
  },
  'cs.perf.saveManhours': {
    tr: 'Adam×saatleri kaydet',
    en: 'Save man-hours',
    de: 'Stunden speichern',
    ar: 'حفظ ساعات العمل',
  },
  'cs.perf.manhoursSaved': {
    tr: '{n} satır güncellendi.',
    en: '{n} row(s) updated.',
    de: '{n} Zeile(n) aktualisiert.',
    ar: 'تم تحديث {n} سطرًا.',
  },
  'cs.perf.noPlanWarn': {
    tr: '{n} pozda planlanan adam×saat girilmemiş — bu pozlarda verim ölçülemiyor ve genel verim rakamı eksik veriye dayanıyor.',
    en: 'Planned man-hours are missing on {n} work item(s) — productivity cannot be measured there and the overall figure rests on incomplete data.',
    de: 'Bei {n} Position(en) fehlen geplante Stunden — dort ist die Produktivität nicht messbar und der Gesamtwert beruht auf unvollständigen Daten.',
    ar: 'ساعات العمل المخططة غير مُدخلة في {n} بند — لا يمكن قياس الإنتاجية هناك والرقم العام يستند إلى بيانات ناقصة.',
  },
  'cs.perf.noLines': {
    tr: 'Bu sözleşmede keşif satırı yok.',
    en: 'This contract has no BoQ lines.',
    de: 'Dieser Vertrag hat keine LV-Positionen.',
    ar: 'لا توجد بنود كشف في هذا العقد.',
  },
  'cs.perf.grp.planned': {
    tr: 'PLANLANAN',
    en: 'PLANNED',
    de: 'GEPLANT',
    ar: 'المخطط',
  },
  'cs.perf.grp.qty': {
    tr: 'MİKTAR',
    en: 'QUANTITY',
    de: 'MENGE',
    ar: 'الكمية',
  },
  'cs.perf.grp.manhours': {
    tr: 'ADAM×SAAT',
    en: 'MAN-HOURS',
    de: 'PERSONENSTUNDEN',
    ar: 'ساعات العمل',
  },
  'cs.perf.grp.productivity': {
    tr: 'VERİMLİLİK',
    en: 'PRODUCTIVITY',
    de: 'PRODUKTIVITÄT',
    ar: 'الإنتاجية',
  },
  'cs.perf.grp.amount': {
    tr: 'TUTAR',
    en: 'AMOUNT',
    de: 'BETRAG',
    ar: 'المبلغ',
  },
  'cs.perf.c.pozNo': {
    tr: 'Poz No',
    en: 'Item no',
    de: 'Pos.-Nr.',
    ar: 'رقم البند',
  },
  'cs.perf.c.description': {
    tr: 'Poz Açıklama',
    en: 'Description',
    de: 'Beschreibung',
    ar: 'وصف البند',
  },
  'cs.perf.c.unit': {
    tr: 'Birim',
    en: 'Unit',
    de: 'Einheit',
    ar: 'الوحدة',
  },
  'cs.perf.c.plannedQty': {
    tr: 'Planlanan Miktar',
    en: 'Planned qty',
    de: 'Geplante Menge',
    ar: 'الكمية المخططة',
  },
  'cs.perf.c.unitPrice': {
    tr: 'Birim Fiyat',
    en: 'Unit price',
    de: 'Einheitspreis',
    ar: 'سعر الوحدة',
  },
  'cs.perf.c.plannedAmount': {
    tr: 'Planlanan Tutar',
    en: 'Planned amount',
    de: 'Geplanter Betrag',
    ar: 'المبلغ المخطط',
  },
  'cs.perf.c.pursantaj': {
    tr: 'Pursantaj',
    en: 'Weighting',
    de: 'Gewichtung',
    ar: 'النسبة',
  },
  'cs.perf.c.unitManhours': {
    tr: 'Birim A×S',
    en: 'Unit m-h',
    de: 'Std./Einheit',
    ar: 'ساعة/وحدة',
  },
  'cs.perf.c.plannedManhours': {
    tr: 'Planlanan A×S',
    en: 'Planned m-h',
    de: 'Geplante Std.',
    ar: 'الساعات المخططة',
  },
  'cs.perf.c.progressQty': {
    tr: 'Hakediş Miktarı',
    en: 'Progress qty',
    de: 'Abgerechnete Menge',
    ar: 'كمية المستخلص',
  },
  'cs.perf.c.producedQty': {
    tr: 'İmal Edilen',
    en: 'Produced',
    de: 'Hergestellt',
    ar: 'المنتَج',
  },
  'cs.perf.c.progressPct': {
    tr: 'Hakediş %',
    en: 'Progress %',
    de: 'Abrechnung %',
    ar: 'نسبة المستخلص',
  },
  'cs.perf.c.producedPct': {
    tr: 'İmalat %',
    en: 'Production %',
    de: 'Herstellung %',
    ar: 'نسبة الإنتاج',
  },
  'cs.perf.c.earnedPursantaj': {
    tr: 'Kazanılan Pursantaj',
    en: 'Earned weighting',
    de: 'Erreichte Gewichtung',
    ar: 'النسبة المكتسبة',
  },
  'cs.perf.c.productionVsProgress': {
    tr: 'İmalat − Hakediş',
    en: 'Production − progress',
    de: 'Herstellung − Abrechnung',
    ar: 'الإنتاج − المستخلص',
  },
  'cs.perf.c.ownManhours': {
    tr: 'Kendi A×S',
    en: 'Own m-h',
    de: 'Eigene Std.',
    ar: 'ساعات ذاتية',
  },
  'cs.perf.c.subManhours': {
    tr: 'Taşeron A×S',
    en: 'Sub m-h',
    de: 'NU-Std.',
    ar: 'ساعات المقاول',
  },
  'cs.perf.c.actualManhours': {
    tr: 'Gerçekleşen A×S',
    en: 'Actual m-h',
    de: 'Ist-Std.',
    ar: 'الساعات الفعلية',
  },
  'cs.perf.c.machineHours': {
    tr: 'Makine Saati',
    en: 'Machine hours',
    de: 'Maschinenstd.',
    ar: 'ساعات الآلة',
  },
  'cs.perf.c.manhourPct': {
    tr: 'A×S %',
    en: 'M-h %',
    de: 'Std. %',
    ar: 'نسبة الساعات',
  },
  'cs.perf.c.progressGap': {
    tr: 'Makas',
    en: 'Gap',
    de: 'Schere',
    ar: 'الفجوة',
  },
  'cs.perf.c.actualUnitManhours': {
    tr: 'Gerçekleşen Birim A×S',
    en: 'Actual unit m-h',
    de: 'Ist-Std./Einheit',
    ar: 'ساعة/وحدة فعلية',
  },
  'cs.perf.c.expectedManhours': {
    tr: 'Beklenen A×S',
    en: 'Expected m-h',
    de: 'Erwartete Std.',
    ar: 'الساعات المتوقعة',
  },
  'cs.perf.c.efficiency': {
    tr: 'Verim',
    en: 'Efficiency',
    de: 'Effizienz',
    ar: 'الكفاءة',
  },
  'cs.perf.c.manhourVariance': {
    tr: 'A×S Sapması',
    en: 'M-h variance',
    de: 'Std.-Abweichung',
    ar: 'انحراف الساعات',
  },
  'cs.perf.c.eacManhours': {
    tr: 'Tahmini Bitiş A×S',
    en: 'Estimate at completion',
    de: 'Prognose bei Fertigstellung',
    ar: 'التقدير عند الإنجاز',
  },
  'cs.perf.c.eacVariance': {
    tr: 'Tahmini Sapma',
    en: 'Estimated variance',
    de: 'Prognostizierte Abweichung',
    ar: 'الانحراف المتوقع',
  },
  'cs.perf.c.progressAmount': {
    tr: 'Hakediş Tutarı',
    en: 'Progress amount',
    de: 'Abgerechneter Betrag',
    ar: 'مبلغ المستخلص',
  },
  'cs.perf.c.expenseAmount': {
    tr: 'Fiili Gider',
    en: 'Actual cost',
    de: 'Ist-Kosten',
    ar: 'التكلفة الفعلية',
  },
  'cs.perf.h.unitManhours': {
    tr: 'Bir birim imalat için planlanan işçilik (ör. 1 m³ kalıp = 2,5 adam×saat). Analiz/rayiç kitaplarından ya da firmanın geçmiş verisinden gelir.',
    en: 'Planned labour per unit of work (e.g. 1 m³ formwork = 2.5 man-hours). Comes from rate books or the company’s own history.',
    de: 'Geplante Arbeit je Leistungseinheit (z. B. 1 m³ Schalung = 2,5 Personenstunden). Aus Kalkulationsbüchern oder eigener Historie.',
    ar: 'العمل المخطط لكل وحدة (مثال: 1 م³ قوالب = 2.5 ساعة عمل). يأتي من كتب التحليل أو من بيانات الشركة السابقة.',
  },
  'cs.perf.h.progressQty': {
    tr: 'Hakedişten gelen kümülatif miktar (yalnız onaylanmış/ödenmiş) — MALİ gerçeklik.',
    en: 'Cumulative quantity from progress payments (approved/paid only) — the FINANCIAL reality.',
    de: 'Kumulierte Menge aus Abschlagszahlungen (nur genehmigt/bezahlt) — die FINANZIELLE Realität.',
    ar: 'الكمية التراكمية من المستخلصات (المعتمدة/المدفوعة فقط) — الواقع المالي.',
  },
  'cs.perf.h.producedQty': {
    tr: 'Şantiye günlüğü imalat kayıtlarından gelen miktar — FİZİKSEL gerçeklik.',
    en: 'Quantity from daily-log production entries — the PHYSICAL reality.',
    de: 'Menge aus den Herstellungseinträgen des Bautagebuchs — die PHYSISCHE Realität.',
    ar: 'الكمية من سجلات الإنتاج في يومية الموقع — الواقع المادي.',
  },
  'cs.perf.h.progressGap': {
    tr: 'İmalat yüzdesi eksi adam×saat yüzdesi. Negatif değer adam-saatin miktardan hızlı tükendiğini, yani kâr kaybının başladığını gösterir.',
    en: 'Production percentage minus man-hour percentage. A negative value means man-hours are burning faster than quantity — profit erosion has begun.',
    de: 'Herstellungsprozentsatz minus Stundenprozentsatz. Ein negativer Wert bedeutet: Stunden verbrauchen sich schneller als Menge — die Marge beginnt zu erodieren.',
    ar: 'نسبة الإنتاج ناقص نسبة ساعات العمل. القيمة السالبة تعني أن الساعات تُستهلك أسرع من الكمية — أي بدء تآكل الربح.',
  },
  'cs.perf.h.efficiency': {
    tr: 'Beklenen adam×saat / harcanan adam×saat. 1’in üstü planın önünde, altı gerisinde. %10 tolerans uygulanır.',
    en: 'Expected man-hours / spent man-hours. Above 1 is ahead of plan, below is behind. A 10% tolerance applies.',
    de: 'Erwartete / verbrauchte Personenstunden. Über 1 bedeutet vor Plan, darunter hinter Plan. Es gilt eine Toleranz von 10 %.',
    ar: 'الساعات المتوقعة ÷ الساعات المستهلكة. أعلى من 1 متقدم على الخطة، وأقل متأخر. تُطبَّق سماحية 10%.',
  },
  'cs.perf.h.eac': {
    tr: 'Mevcut verimle devam edilirse iş bitiminde harcanacak toplam adam×saat. Verim henüz ölçülemiyorsa plan değeri gösterilir.',
    en: 'Total man-hours at completion if the current productivity continues. If productivity cannot be measured yet, the planned value is shown.',
    de: 'Gesamtstunden bei Fertigstellung, wenn die aktuelle Produktivität anhält. Ist sie noch nicht messbar, wird der Planwert gezeigt.',
    ar: 'إجمالي ساعات العمل عند الإنجاز إذا استمرت الإنتاجية الحالية. إذا لم تكن قابلة للقياس بعد، تُعرض القيمة المخططة.',
  },
  'cs.perf.h.productionVsProgress': {
    tr: 'Pozitif: fiziksel üretim hakedişin önünde, hakediş kesilmemiş iş var (nakit riski). Negatif: hakediş üretimin önünde (denetim riski).',
    en: 'Positive: physical production is ahead of billing, there is unbilled work (cash risk). Negative: billing is ahead of production (audit risk).',
    de: 'Positiv: die physische Leistung liegt vor der Abrechnung, es gibt nicht abgerechnete Arbeit (Liquiditätsrisiko). Negativ: die Abrechnung liegt vor der Leistung (Prüfungsrisiko).',
    ar: 'موجب: الإنتاج المادي متقدم على الفوترة، وهناك عمل غير مفوتر (مخاطر نقدية). سالب: الفوترة متقدمة على الإنتاج (مخاطر تدقيق).',
  },
  'cs.perf.h.machineHours': {
    tr: 'Makine saati adam×saat değildir; verim hesabına girmez, ayrıca raporlanır.',
    en: 'Machine hours are not man-hours; they are excluded from productivity and reported separately.',
    de: 'Maschinenstunden sind keine Personenstunden; sie fließen nicht in die Produktivität ein und werden separat berichtet.',
    ar: 'ساعات الآلة ليست ساعات عمل؛ لا تدخل في حساب الإنتاجية وتُعرض بشكل منفصل.',
  },
  'cs.perf.band.unknown': {
    tr: 'Ölçülemiyor',
    en: 'Not measurable',
    de: 'Nicht messbar',
    ar: 'غير قابل للقياس',
  },
  'cs.perf.band.critical': {
    tr: 'Kritik',
    en: 'Critical',
    de: 'Kritisch',
    ar: 'حرج',
  },
  'cs.perf.band.behind': {
    tr: 'Geride',
    en: 'Behind',
    de: 'Hinter Plan',
    ar: 'متأخر',
  },
  'cs.perf.band.onTrack': {
    tr: 'Yolunda',
    en: 'On track',
    de: 'Im Plan',
    ar: 'على المسار',
  },
  'cs.perf.band.ahead': {
    tr: 'Önde',
    en: 'Ahead',
    de: 'Vor Plan',
    ar: 'متقدم',
  },
  'cs.perf.s.title': {
    tr: 'Performans Özeti',
    en: 'Performance Summary',
    de: 'Leistungsübersicht',
    ar: 'ملخص الأداء',
  },
  'cs.perf.s.lineCount': {
    tr: 'Poz sayısı',
    en: 'Work items',
    de: 'Positionen',
    ar: 'عدد البنود',
  },
  'cs.perf.s.linesWithoutPlan': {
    tr: 'Planı olmayan poz',
    en: 'Items without plan',
    de: 'Positionen ohne Plan',
    ar: 'بنود بلا خطة',
  },
  'cs.perf.s.weighted': {
    tr: 'ağırlıklı',
    en: 'weighted',
    de: 'gewichtet',
    ar: 'مرجَّح',
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

/** Günlük rapor kayıt tipi etiketi (bölüm başlığı). */
export function logKindLabel(kind: string, lang: string | undefined): string {
  const key = `cs.dlog.kind.${kind}` as CsLabelKey;
  return csT(key, lang);
}

/** Satır alanı etiketi. */
export function logFieldLabel(field: string, lang: string | undefined): string {
  const key = `cs.dlog.f.${field}` as CsLabelKey;
  return csT(key, lang);
}

/** İSG olay şiddeti etiketi. */
export function accidentSeverityLabel(severity: string, lang: string | undefined): string {
  const key = `cs.dlog.sev.${severity}` as CsLabelKey;
  return csT(key, lang);
}

/** Günün çalışma durumu etiketi. */
export function workStateLabel(state: string, lang: string | undefined): string {
  switch (state) {
    case 'working':
      return csT('cs.dlog.workState.working', lang);
    case 'not_working':
      return csT('cs.dlog.workState.notWorking', lang);
    case 'partial':
      return csT('cs.dlog.workState.partial', lang);
    default:
      return state;
  }
}

/** Verim bandı etiketi (arayüz rengi ve yorumu tek yerden). */
export function efficiencyBandLabel(band: string, lang: string | undefined): string {
  switch (band) {
    case 'critical':
      return csT('cs.perf.band.critical', lang);
    case 'behind':
      return csT('cs.perf.band.behind', lang);
    case 'onTrack':
      return csT('cs.perf.band.onTrack', lang);
    case 'ahead':
      return csT('cs.perf.band.ahead', lang);
    default:
      return csT('cs.perf.band.unknown', lang);
  }
}

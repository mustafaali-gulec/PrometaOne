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
  | 'cs.perf.s.weighted'
  // FAZ 5 — Jenerik onay akışı
  | 'cs.apr.title'
  | 'cs.apr.subtitle'
  | 'cs.apr.tab.inbox'
  | 'cs.apr.tab.flows'
  | 'cs.apr.inbox.actionable'
  | 'cs.apr.inbox.waiting'
  | 'cs.apr.inbox.waitingHint'
  | 'cs.apr.inbox.empty'
  | 'cs.apr.b.dueToday'
  | 'cs.apr.b.overdue1to7'
  | 'cs.apr.b.overdueOver7'
  | 'cs.apr.b.upcoming'
  | 'cs.apr.b.noDueDate'
  | 'cs.apr.c.doc'
  | 'cs.apr.c.docKind'
  | 'cs.apr.c.title'
  | 'cs.apr.c.mode'
  | 'cs.apr.c.progress'
  | 'cs.apr.c.seq'
  | 'cs.apr.c.approver'
  | 'cs.apr.c.dueDate'
  | 'cs.apr.c.decision'
  | 'cs.apr.c.decidedAt'
  | 'cs.apr.c.decidedBy'
  | 'cs.apr.c.comment'
  | 'cs.apr.c.createdAt'
  | 'cs.apr.c.completedAt'
  | 'cs.apr.c.overdue'
  | 'cs.apr.c.nextApprover'
  | 'cs.apr.c.minApprovals'
  | 'cs.apr.mode.ordered'
  | 'cs.apr.mode.unordered'
  | 'cs.apr.mode.orderedHint'
  | 'cs.apr.mode.unorderedHint'
  | 'cs.apr.status.pending'
  | 'cs.apr.status.approved'
  | 'cs.apr.status.rejected'
  | 'cs.apr.status.cancelled'
  | 'cs.apr.dec.pending'
  | 'cs.apr.dec.approved'
  | 'cs.apr.dec.rejected'
  | 'cs.apr.dec.skipped'
  | 'cs.apr.dec.delegated'
  | 'cs.apr.kind.contract'
  | 'cs.apr.kind.progress'
  | 'cs.apr.kind.material_request'
  | 'cs.apr.kind.expense'
  | 'cs.apr.kind.advance'
  | 'cs.apr.kind.daily_log'
  | 'cs.apr.kind.tracking'
  | 'cs.apr.kind.boq'
  | 'cs.apr.kind.measurement'
  | 'cs.apr.kind.payment'
  | 'cs.apr.act.approve'
  | 'cs.apr.act.reject'
  | 'cs.apr.act.cancelFlow'
  | 'cs.apr.act.start'
  | 'cs.apr.act.detail'
  | 'cs.apr.dlg.approveTitle'
  | 'cs.apr.dlg.rejectTitle'
  | 'cs.apr.dlg.commentApprove'
  | 'cs.apr.dlg.commentReject'
  | 'cs.apr.dlg.rejectWarn'
  | 'cs.apr.dlg.reasonRequired'
  | 'cs.apr.dlg.delegateWarn'
  | 'cs.apr.msg.approved'
  | 'cs.apr.msg.rejected'
  | 'cs.apr.msg.flowCompleted'
  | 'cs.apr.msg.cancelled'
  | 'cs.apr.msg.started'
  | 'cs.apr.msg.cancelConfirm'
  | 'cs.apr.new.title'
  | 'cs.apr.new.hint'
  | 'cs.apr.new.approvers'
  | 'cs.apr.new.addApprover'
  | 'cs.apr.new.userId'
  | 'cs.apr.new.allMustApprove'
  | 'cs.apr.new.minApprovalsHint'
  | 'cs.apr.new.needApprover'
  | 'cs.apr.new.dupApprover'
  | 'cs.apr.f.overdueOnly'
  | 'cs.apr.f.allKinds'
  | 'cs.apr.f.allStatuses'
  | 'cs.apr.f.allProjects'
  | 'cs.apr.flows.empty'
  | 'cs.apr.flows.count'
  | 'cs.apr.steps'
  | 'cs.apr.history.title'
  | 'cs.apr.history.empty'
  | 'cs.apr.hist.created'
  | 'cs.apr.hist.approved'
  | 'cs.apr.hist.rejected'
  | 'cs.apr.hist.cancelled'
  | 'cs.apr.badge.none'
  | 'cs.apr.days'
  | 'cs.apr.user'
  | 'cs.apr.you'
  | 'cs.apr.noDueDate'
  | 'cs.apr.selfOnly'
  // FAZ 6 — Kalite & Güvenlik
  | 'cs.qg.title'
  | 'cs.qg.subtitle'
  | 'cs.qg.tab.defects'
  | 'cs.qg.tab.inspections'
  | 'cs.qg.tab.scorecard'
  | 'cs.qg.tab.rfi'
  | 'cs.qg.tab.assignments'
  | 'cs.qg.c.code'
  | 'cs.qg.c.title'
  | 'cs.qg.c.location'
  | 'cs.qg.c.vendor'
  | 'cs.qg.c.responsible'
  | 'cs.qg.c.dueDate'
  | 'cs.qg.c.overdue'
  | 'cs.qg.c.priority'
  | 'cs.qg.c.createdAt'
  | 'cs.qg.c.description'
  | 'cs.qg.c.note'
  | 'cs.qg.days'
  | 'cs.qg.user'
  | 'cs.qg.filter.openOnly'
  | 'cs.qg.filter.overdueOnly'
  | 'cs.qg.filter.all'
  | 'cs.qg.detail'
  | 'cs.qg.saved'
  | 'cs.qg.def.new'
  | 'cs.qg.def.kind'
  | 'cs.qg.def.severity'
  | 'cs.qg.def.source'
  | 'cs.qg.def.reopen'
  | 'cs.qg.def.costEstimate'
  | 'cs.qg.def.costActual'
  | 'cs.qg.def.dueDateHint'
  | 'cs.qg.def.statusNote'
  | 'cs.qg.def.history'
  | 'cs.qg.def.empty'
  | 'cs.qg.def.s.open'
  | 'cs.qg.def.s.awaitingVerify'
  | 'cs.qg.def.s.closedCount'
  | 'cs.qg.def.s.critical'
  | 'cs.qg.def.s.overdue'
  | 'cs.qg.def.s.reopened'
  | 'cs.qg.def.s.avgFix'
  | 'cs.qg.def.reopenBadge'
  | 'cs.qg.dk.workmanship'
  | 'cs.qg.dk.missing_work'
  | 'cs.qg.dk.material_damage'
  | 'cs.qg.dk.dimensional'
  | 'cs.qg.dk.plumbing'
  | 'cs.qg.dk.electrical'
  | 'cs.qg.dk.paint'
  | 'cs.qg.dk.insulation'
  | 'cs.qg.dk.cleaning'
  | 'cs.qg.dk.safety'
  | 'cs.qg.dk.other'
  | 'cs.qg.sev.very_low'
  | 'cs.qg.sev.low'
  | 'cs.qg.sev.medium'
  | 'cs.qg.sev.high'
  | 'cs.qg.sev.critical'
  | 'cs.qg.ds.open'
  | 'cs.qg.ds.in_progress'
  | 'cs.qg.ds.fixed'
  | 'cs.qg.ds.verified'
  | 'cs.qg.ds.closed'
  | 'cs.qg.ds.rejected'
  | 'cs.qg.src.internal'
  | 'cs.qg.src.inspection'
  | 'cs.qg.src.daily_log'
  | 'cs.qg.src.client'
  | 'cs.qg.src.rfi'
  | 'cs.qg.ins.templates'
  | 'cs.qg.ins.newTemplate'
  | 'cs.qg.ins.templateKind'
  | 'cs.qg.ins.passPct'
  | 'cs.qg.ins.items'
  | 'cs.qg.ins.addItem'
  | 'cs.qg.ins.itemText'
  | 'cs.qg.ins.weight'
  | 'cs.qg.ins.maxScore'
  | 'cs.qg.ins.critical'
  | 'cs.qg.ins.criticalHint'
  | 'cs.qg.ins.new'
  | 'cs.qg.ins.template'
  | 'cs.qg.ins.date'
  | 'cs.qg.ins.period'
  | 'cs.qg.ins.inspector'
  | 'cs.qg.ins.score'
  | 'cs.qg.ins.grade'
  | 'cs.qg.ins.passed'
  | 'cs.qg.ins.failed'
  | 'cs.qg.ins.notMeasured'
  | 'cs.qg.ins.na'
  | 'cs.qg.ins.naHint'
  | 'cs.qg.ins.unanswered'
  | 'cs.qg.ins.criticalFail'
  | 'cs.qg.ins.saveAnswers'
  | 'cs.qg.ins.complete'
  | 'cs.qg.ins.approve'
  | 'cs.qg.ins.backToDraft'
  | 'cs.qg.ins.approveWarn'
  | 'cs.qg.ins.raiseDefect'
  | 'cs.qg.ins.defectLinked'
  | 'cs.qg.ins.empty'
  | 'cs.qg.ins.vendorRequired'
  | 'cs.qg.itk.quality'
  | 'cs.qg.itk.subcontractor_scorecard'
  | 'cs.qg.itk.hse'
  | 'cs.qg.itk.handover'
  | 'cs.qg.itk.other'
  | 'cs.qg.is.draft'
  | 'cs.qg.is.completed'
  | 'cs.qg.is.approved'
  | 'cs.qg.is.cancelled'
  | 'cs.qg.sc.subtitle'
  | 'cs.qg.sc.inspections'
  | 'cs.qg.sc.avgScore'
  | 'cs.qg.sc.minScore'
  | 'cs.qg.sc.failed'
  | 'cs.qg.sc.defects'
  | 'cs.qg.sc.open'
  | 'cs.qg.sc.severe'
  | 'cs.qg.sc.lastInspection'
  | 'cs.qg.sc.empty'
  | 'cs.qg.rfi.new'
  | 'cs.qg.rfi.subject'
  | 'cs.qg.rfi.question'
  | 'cs.qg.rfi.answer'
  | 'cs.qg.rfi.discipline'
  | 'cs.qg.rfi.askedTo'
  | 'cs.qg.rfi.age'
  | 'cs.qg.rfi.impactDays'
  | 'cs.qg.rfi.impactCost'
  | 'cs.qg.rfi.impactHint'
  | 'cs.qg.rfi.writeAnswer'
  | 'cs.qg.rfi.answerRequired'
  | 'cs.qg.rfi.empty'
  | 'cs.qg.rfi.s.oldestOpen'
  | 'cs.qg.rfi.s.avgAnswer'
  | 'cs.qg.rfi.s.impactTotal'
  | 'cs.qg.disc.architectural'
  | 'cs.qg.disc.structural'
  | 'cs.qg.disc.mechanical'
  | 'cs.qg.disc.electrical'
  | 'cs.qg.disc.infrastructure'
  | 'cs.qg.disc.landscape'
  | 'cs.qg.disc.geotechnical'
  | 'cs.qg.disc.other'
  | 'cs.qg.rs.open'
  | 'cs.qg.rs.answered'
  | 'cs.qg.rs.closed'
  | 'cs.qg.rs.cancelled'
  | 'cs.qg.pr.low'
  | 'cs.qg.pr.medium'
  | 'cs.qg.pr.high'
  | 'cs.qg.pr.urgent'
  | 'cs.qg.asg.new'
  | 'cs.qg.asg.assignedTo'
  | 'cs.qg.asg.progress'
  | 'cs.qg.asg.startDate'
  | 'cs.qg.asg.source'
  | 'cs.qg.asg.sourceHint'
  | 'cs.qg.asg.empty'
  | 'cs.qg.asg.done100'
  | 'cs.qg.as.open'
  | 'cs.qg.as.in_progress'
  | 'cs.qg.as.done'
  | 'cs.qg.as.cancelled'
  | 'cs.qg.asrc.defect'
  | 'cs.qg.asrc.rfi'
  | 'cs.qg.asrc.inspection'
  | 'cs.qg.asrc.daily_log'
  | 'cs.qg.asrc.tracking'
  // FAZ 7 — Taahhüt & EVM
  | 'cs.cmt.title'
  | 'cs.cmt.subtitle'
  | 'cs.cmt.new'
  | 'cs.cmt.c.refNo'
  | 'cs.cmt.c.source'
  | 'cs.cmt.c.amount'
  | 'cs.cmt.c.delivered'
  | 'cs.cmt.c.open'
  | 'cs.cmt.c.committedAt'
  | 'cs.cmt.c.boqLine'
  | 'cs.cmt.c.contract'
  | 'cs.cmt.src.purchase_order'
  | 'cs.cmt.src.subcontract'
  | 'cs.cmt.src.manual'
  | 'cs.cmt.st.open'
  | 'cs.cmt.st.partial'
  | 'cs.cmt.st.closed'
  | 'cs.cmt.st.cancelled'
  | 'cs.cmt.act.delivery'
  | 'cs.cmt.act.close'
  | 'cs.cmt.act.cancel'
  | 'cs.cmt.deliveryHint'
  | 'cs.cmt.closeConfirm'
  | 'cs.cmt.cancelConfirm'
  | 'cs.cmt.empty'
  | 'cs.cmt.s.openTotal'
  | 'cs.cmt.s.committedTotal'
  | 'cs.cmt.s.openCount'
  | 'cs.cmt.s.unlinked'
  | 'cs.cmt.s.unlinkedHint'
  | 'cs.evm.title'
  | 'cs.evm.bac'
  | 'cs.evm.ev'
  | 'cs.evm.ac'
  | 'cs.evm.openCommitted'
  | 'cs.evm.exposure'
  | 'cs.evm.remaining'
  | 'cs.evm.cpi'
  | 'cs.evm.cpiHint'
  | 'cs.evm.exposureHint'
  | 'cs.evm.noSpi'
  | 'cs.evm.pctEarned'
  | 'cs.evm.pctExposure'
  | 'cs.perf.grp.commitment'
  | 'cs.perf.c.committed'
  | 'cs.perf.c.openCommitted'
  | 'cs.perf.c.costExposure'
  | 'cs.perf.c.budgetVariance'
  | 'cs.perf.h.budgetVariance'
  // FAZ 8 — İş programı
  | 'cs.sch.title'
  | 'cs.sch.subtitle'
  | 'cs.sch.tab.gantt'
  | 'cs.sch.tab.curve'
  | 'cs.sch.new'
  | 'cs.sch.c.name'
  | 'cs.sch.c.kind'
  | 'cs.sch.c.plannedStart'
  | 'cs.sch.c.plannedEnd'
  | 'cs.sch.c.actualStart'
  | 'cs.sch.c.actualEnd'
  | 'cs.sch.c.progress'
  | 'cs.sch.c.weight'
  | 'cs.sch.c.parent'
  | 'cs.sch.c.dependsOn'
  | 'cs.sch.c.tracking'
  | 'cs.sch.kind.group'
  | 'cs.sch.kind.task'
  | 'cs.sch.kind.milestone'
  | 'cs.sch.s.tasks'
  | 'cs.sch.s.done'
  | 'cs.sch.s.overdue'
  | 'cs.sch.s.notStartedLate'
  | 'cs.sch.s.range'
  | 'cs.sch.empty'
  | 'cs.sch.milestoneHint'
  | 'cs.sch.weightHint'
  | 'cs.sch.prog.title'
  | 'cs.sch.prog.asOf'
  | 'cs.sch.prog.hint'
  | 'cs.sch.prog.fromTracking'
  | 'cs.sch.prog.fromTrackingHint'
  | 'cs.sch.prog.log'
  | 'cs.sch.gantt.today'
  | 'cs.sch.gantt.planned'
  | 'cs.sch.gantt.actual'
  | 'cs.sch.curve.weightExplicit'
  | 'cs.sch.curve.weightDuration'
  | 'cs.sch.curve.empty'
  | 'cs.sch.curve.actualNote'
  | 'cs.sch.deleteConfirm'
  | 'cs.sch.trackingDrift'
  // FAZ 9 — Makine parkı
  | 'cs.mp.title'
  | 'cs.mp.subtitle'
  | 'cs.mp.c.machine'
  | 'cs.mp.c.plate'
  | 'cs.mp.c.chassis'
  | 'cs.mp.c.engine'
  | 'cs.mp.c.brand'
  | 'cs.mp.c.model'
  | 'cs.mp.c.modelYear'
  | 'cs.mp.c.meter'
  | 'cs.mp.c.meterType'
  | 'cs.mp.c.ownership'
  | 'cs.mp.c.warranty'
  | 'cs.mp.c.rental'
  | 'cs.mp.c.maintenance'
  | 'cs.mp.c.purchaseDate'
  | 'cs.mp.meter.km'
  | 'cs.mp.meter.hour'
  | 'cs.mp.own.owned'
  | 'cs.mp.own.rented'
  | 'cs.mp.own.subcontractor'
  | 'cs.mp.rp.daily'
  | 'cs.mp.rp.monthly'
  | 'cs.mp.rentalStart'
  | 'cs.mp.rentalEnd'
  | 'cs.mp.rentalCost'
  | 'cs.mp.rentalDaysLeft'
  | 'cs.mp.rentalExpired'
  | 'cs.mp.warrantyUntil'
  | 'cs.mp.warrantyMeter'
  | 'cs.mp.warrantyHint'
  | 'cs.mp.warranty.in'
  | 'cs.mp.warranty.out'
  | 'cs.mp.warranty.none'
  | 'cs.mp.warranty.daysLeft'
  | 'cs.mp.warranty.meterLeft'
  | 'cs.mp.meterPanel.title'
  | 'cs.mp.meterPanel.hint'
  | 'cs.mp.meterPanel.value'
  | 'cs.mp.meterPanel.isReset'
  | 'cs.mp.meterPanel.log'
  | 'cs.mp.plan.title'
  | 'cs.mp.plan.new'
  | 'cs.mp.plan.name'
  | 'cs.mp.plan.intervalType'
  | 'cs.mp.plan.intervalValue'
  | 'cs.mp.plan.it.meter'
  | 'cs.mp.plan.it.days'
  | 'cs.mp.plan.lastDone'
  | 'cs.mp.plan.nextDue'
  | 'cs.mp.plan.remaining'
  | 'cs.mp.plan.noBaseline'
  | 'cs.mp.plan.baselineHint'
  | 'cs.mp.plan.overdue'
  | 'cs.mp.plan.deleteConfirm'
  | 'cs.mp.rec.title'
  | 'cs.mp.rec.new'
  | 'cs.mp.rec.plan'
  | 'cs.mp.rec.planNone'
  | 'cs.mp.rec.doneAt'
  | 'cs.mp.rec.meterAt'
  | 'cs.mp.rec.cost'
  | 'cs.mp.rec.hint'
  | 'cs.mp.empty'
  | 'cs.mp.detailsPanel'
  // FAZ 10 — Konut satış
  | 'cs.us.title'
  | 'cs.us.subtitle'
  | 'cs.us.empty'
  | 'cs.us.barterInfo'
  | 'cs.us.sum.units'
  | 'cs.us.sum.available'
  | 'cs.us.sum.reserved'
  | 'cs.us.sum.sold'
  | 'cs.us.sum.barter'
  | 'cs.us.sum.soldValue'
  | 'cs.us.sum.barterValue'
  | 'cs.us.sum.collected'
  | 'cs.us.sum.remaining'
  | 'cs.us.sum.refundLiability'
  | 'cs.us.sum.unpriced'
  | 'cs.us.sum.openCr'
  | 'cs.us.sum.cancelled'
  | 'cs.us.sum.availableListValue'
  | 'cs.us.st.available'
  | 'cs.us.st.reserved'
  | 'cs.us.st.sold'
  | 'cs.us.st.barter'
  | 'cs.us.st.cancelled'
  | 'cs.us.f.unit'
  | 'cs.us.f.type'
  | 'cs.us.f.area'
  | 'cs.us.f.listPrice'
  | 'cs.us.f.salePrice'
  | 'cs.us.f.discount'
  | 'cs.us.f.buyer'
  | 'cs.us.f.collected'
  | 'cs.us.f.remaining'
  | 'cs.us.f.openCr'
  | 'cs.us.price.edit'
  | 'cs.us.price.hint'
  | 'cs.us.form.new'
  | 'cs.us.form.status'
  | 'cs.us.form.buyer'
  | 'cs.us.form.vendor'
  | 'cs.us.form.vendorHint'
  | 'cs.us.form.listPrice'
  | 'cs.us.form.listPriceHint'
  | 'cs.us.form.salePrice'
  | 'cs.us.form.reservedAt'
  | 'cs.us.form.soldAt'
  | 'cs.us.form.create'
  | 'cs.us.det.title'
  | 'cs.us.det.source'
  | 'cs.us.det.refNo'
  | 'cs.us.det.frozenList'
  | 'cs.us.det.cancelNote'
  | 'cs.us.det.cancelPrompt'
  | 'cs.us.det.needNote'
  | 'cs.us.tr.sold'
  | 'cs.us.tr.barter'
  | 'cs.us.tr.cancelled'
  | 'cs.us.pay.title'
  | 'cs.us.pay.add'
  | 'cs.us.pay.kind'
  | 'cs.us.pay.kind.collection'
  | 'cs.us.pay.kind.refund'
  | 'cs.us.pay.method'
  | 'cs.us.pay.method.cash'
  | 'cs.us.pay.method.bank'
  | 'cs.us.pay.method.cheque'
  | 'cs.us.pay.method.other'
  | 'cs.us.pay.date'
  | 'cs.us.pay.amount'
  | 'cs.us.pay.none'
  | 'cs.us.pay.deleteConfirm'
  | 'cs.us.cr.title'
  | 'cs.us.cr.add'
  | 'cs.us.cr.field.title'
  | 'cs.us.cr.field.desc'
  | 'cs.us.cr.field.cost'
  | 'cs.us.cr.costFrozenHint'
  | 'cs.us.cr.approve'
  | 'cs.us.cr.reject'
  | 'cs.us.cr.done'
  | 'cs.us.cr.rejectNote'
  | 'cs.us.cr.none'
  | 'cs.us.cr.st.open'
  | 'cs.us.cr.st.approved'
  | 'cs.us.cr.st.rejected'
  | 'cs.us.cr.st.done'
  // FAZ 11 — İşbirliği
  | 'cs.cb.title'
  | 'cs.cb.subtitle'
  | 'cs.cb.tab.wall'
  | 'cs.cb.tab.team'
  | 'cs.cb.tab.gallery'
  | 'cs.cb.wall.new'
  | 'cs.cb.wall.titleField'
  | 'cs.cb.wall.bodyField'
  | 'cs.cb.wall.pin'
  | 'cs.cb.wall.pinned'
  | 'cs.cb.wall.recipients'
  | 'cs.cb.wall.recipientsHint'
  | 'cs.cb.wall.publish'
  | 'cs.cb.wall.empty'
  | 'cs.cb.wall.edited'
  | 'cs.cb.wall.readStats'
  | 'cs.cb.wall.readPctUnknown'
  | 'cs.cb.wall.readers'
  | 'cs.cb.wall.noReaders'
  | 'cs.cb.wall.comments'
  | 'cs.cb.wall.addComment'
  | 'cs.cb.wall.deleteConfirm'
  | 'cs.cb.wall.unpin'
  | 'cs.cb.wall.myUnread'
  | 'cs.cb.team.add'
  | 'cs.cb.team.userId'
  | 'cs.cb.team.name'
  | 'cs.cb.team.role'
  | 'cs.cb.team.titleField'
  | 'cs.cb.team.remove'
  | 'cs.cb.team.removeConfirm'
  | 'cs.cb.team.empty'
  | 'cs.cb.team.denomHint'
  | 'cs.cb.role.manager'
  | 'cs.cb.role.engineer'
  | 'cs.cb.role.site_chief'
  | 'cs.cb.role.foreman'
  | 'cs.cb.role.accountant'
  | 'cs.cb.role.viewer'
  | 'cs.cb.role.other'
  | 'cs.cb.gal.add'
  | 'cs.cb.gal.titleField'
  | 'cs.cb.gal.takenAt'
  | 'cs.cb.gal.location'
  | 'cs.cb.gal.locationHint'
  | 'cs.cb.gal.file'
  | 'cs.cb.gal.url'
  | 'cs.cb.gal.empty'
  | 'cs.cb.gal.deleteConfirm'
  | 'cs.cb.gal.needPayload'
  | 'cs.cb.gal.external';

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

  'cs.apr.title': {
    tr: 'Onay Akışları',
    en: 'Approval Flows',
    de: 'Genehmigungsabläufe',
    ar: 'مسارات الموافقة',
  },
  'cs.apr.subtitle': {
    tr: 'Her belge tipi için tek onay motoru: sıralı veya sırasız, onaycı başına bitiş tarihi, tam karar izi.',
    en: 'One approval engine for every document type: ordered or unordered, a due date per approver, a full decision trail.',
    de: 'Eine Genehmigungs-Engine für jeden Belegtyp: geordnet oder unsortiert, Fälligkeitsdatum pro Genehmiger, vollständige Entscheidungsspur.',
    ar: 'محرك موافقة واحد لكل نوع مستند: مرتب أو غير مرتب، تاريخ استحقاق لكل معتمد، وسجل كامل للقرارات.',
  },
  'cs.apr.tab.inbox': {
    tr: 'Bana Atanan Onaylar',
    en: 'My Approvals',
    de: 'Meine Genehmigungen',
    ar: 'الموافقات المسندة إليّ',
  },
  'cs.apr.tab.flows': {
    tr: 'Tüm Akışlar',
    en: 'All Flows',
    de: 'Alle Abläufe',
    ar: 'كل المسارات',
  },
  'cs.apr.inbox.actionable': {
    tr: 'Şimdi karar verebileceğiniz',
    en: 'Awaiting your decision',
    de: 'Warten auf Ihre Entscheidung',
    ar: 'بانتظار قرارك',
  },
  'cs.apr.inbox.waiting': {
    tr: 'Sıranız beklemede',
    en: 'Your turn has not come yet',
    de: 'Ihre Reihe ist noch nicht gekommen',
    ar: 'لم يحن دورك بعد',
  },
  'cs.apr.inbox.waitingHint': {
    tr: 'Sıralı akışta önceki onaycılar karar verince bu satırlar size düşecek.',
    en: 'In an ordered flow these rows reach you once the earlier approvers decide.',
    de: 'In einem geordneten Ablauf erreichen Sie diese Zeilen, sobald die vorherigen Genehmiger entschieden haben.',
    ar: 'في المسار المرتب تصل إليك هذه السطور بعد أن يقرر المعتمدون السابقون.',
  },
  'cs.apr.inbox.empty': {
    tr: 'Onayınızı bekleyen belge yok.',
    en: 'No document is waiting for your approval.',
    de: 'Kein Beleg wartet auf Ihre Genehmigung.',
    ar: 'لا يوجد مستند ينتظر موافقتك.',
  },
  'cs.apr.b.dueToday': {
    tr: 'Bugün teslim',
    en: 'Due today',
    de: 'Heute fällig',
    ar: 'مستحق اليوم',
  },
  'cs.apr.b.overdue1to7': {
    tr: '1-7 gün gecikmiş',
    en: '1-7 days overdue',
    de: '1-7 Tage überfällig',
    ar: 'متأخر 1-7 أيام',
  },
  'cs.apr.b.overdueOver7': {
    tr: '7 günden fazla gecikmiş',
    en: 'Over 7 days overdue',
    de: 'Über 7 Tage überfällig',
    ar: 'متأخر أكثر من 7 أيام',
  },
  'cs.apr.b.upcoming': {
    tr: 'İleri tarihli',
    en: 'Upcoming',
    de: 'Bevorstehend',
    ar: 'قادم',
  },
  'cs.apr.b.noDueDate': {
    tr: 'Tarihsiz',
    en: 'No due date',
    de: 'Ohne Fälligkeit',
    ar: 'بدون تاريخ استحقاق',
  },
  'cs.apr.c.doc': {
    tr: 'Belge',
    en: 'Document',
    de: 'Beleg',
    ar: 'المستند',
  },
  'cs.apr.c.docKind': {
    tr: 'Belge tipi',
    en: 'Document type',
    de: 'Belegtyp',
    ar: 'نوع المستند',
  },
  'cs.apr.c.title': {
    tr: 'Başlık',
    en: 'Title',
    de: 'Titel',
    ar: 'العنوان',
  },
  'cs.apr.c.mode': {
    tr: 'Akış tipi',
    en: 'Flow type',
    de: 'Ablaufart',
    ar: 'نوع المسار',
  },
  'cs.apr.c.progress': {
    tr: 'Onay sırası',
    en: 'Approval progress',
    de: 'Genehmigungsfortschritt',
    ar: 'تقدم الموافقة',
  },
  'cs.apr.c.seq': {
    tr: 'Sıra',
    en: 'Seq.',
    de: 'Reihenfolge',
    ar: 'الترتيب',
  },
  'cs.apr.c.approver': {
    tr: 'Onaycı',
    en: 'Approver',
    de: 'Genehmiger',
    ar: 'المعتمد',
  },
  'cs.apr.c.dueDate': {
    tr: 'Bitiş tarihi',
    en: 'Due date',
    de: 'Fälligkeitsdatum',
    ar: 'تاريخ الاستحقاق',
  },
  'cs.apr.c.decision': {
    tr: 'Karar',
    en: 'Decision',
    de: 'Entscheidung',
    ar: 'القرار',
  },
  'cs.apr.c.decidedAt': {
    tr: 'Karar tarihi',
    en: 'Decided at',
    de: 'Entschieden am',
    ar: 'تاريخ القرار',
  },
  'cs.apr.c.decidedBy': {
    tr: 'Kararı veren',
    en: 'Decided by',
    de: 'Entschieden von',
    ar: 'صاحب القرار',
  },
  'cs.apr.c.comment': {
    tr: 'Açıklama',
    en: 'Comment',
    de: 'Kommentar',
    ar: 'ملاحظة',
  },
  'cs.apr.c.createdAt': {
    tr: 'Başlatıldı',
    en: 'Started',
    de: 'Gestartet',
    ar: 'بدأ في',
  },
  'cs.apr.c.completedAt': {
    tr: 'Kapandı',
    en: 'Closed',
    de: 'Abgeschlossen',
    ar: 'أُغلق في',
  },
  'cs.apr.c.overdue': {
    tr: 'Gecikme',
    en: 'Overdue',
    de: 'Verzug',
    ar: 'التأخير',
  },
  'cs.apr.c.nextApprover': {
    tr: 'Sıradaki onaycı',
    en: 'Next approver',
    de: 'Nächster Genehmiger',
    ar: 'المعتمد التالي',
  },
  'cs.apr.c.minApprovals': {
    tr: 'Gereken onay',
    en: 'Approvals required',
    de: 'Erforderliche Genehmigungen',
    ar: 'الموافقات المطلوبة',
  },
  'cs.apr.mode.ordered': {
    tr: 'Sıralı',
    en: 'Ordered',
    de: 'Geordnet',
    ar: 'مرتب',
  },
  'cs.apr.mode.unordered': {
    tr: 'Sırasız',
    en: 'Unordered',
    de: 'Unsortiert',
    ar: 'غير مرتب',
  },
  'cs.apr.mode.orderedHint': {
    tr: 'Yalnız sırası gelen onaycı karar verebilir.',
    en: 'Only the approver whose turn it is can decide.',
    de: 'Nur der Genehmiger, der an der Reihe ist, kann entscheiden.',
    ar: 'يمكن للمعتمد صاحب الدور فقط أن يقرر.',
  },
  'cs.apr.mode.unorderedHint': {
    tr: 'Bekleyen onaycıların hepsi aynı anda karar verebilir.',
    en: 'All pending approvers can decide at the same time.',
    de: 'Alle ausstehenden Genehmiger können gleichzeitig entscheiden.',
    ar: 'يمكن لجميع المعتمدين المنتظرين أن يقرروا في الوقت نفسه.',
  },
  'cs.apr.status.pending': {
    tr: 'Bekliyor',
    en: 'Pending',
    de: 'Ausstehend',
    ar: 'قيد الانتظار',
  },
  'cs.apr.status.approved': {
    tr: 'Onaylandı',
    en: 'Approved',
    de: 'Genehmigt',
    ar: 'تم الاعتماد',
  },
  'cs.apr.status.rejected': {
    tr: 'Reddedildi',
    en: 'Rejected',
    de: 'Abgelehnt',
    ar: 'مرفوض',
  },
  'cs.apr.status.cancelled': {
    tr: 'İptal edildi',
    en: 'Cancelled',
    de: 'Storniert',
    ar: 'ملغى',
  },
  'cs.apr.dec.pending': {
    tr: 'Bekliyor',
    en: 'Pending',
    de: 'Ausstehend',
    ar: 'قيد الانتظار',
  },
  'cs.apr.dec.approved': {
    tr: 'Onayladı',
    en: 'Approved',
    de: 'Genehmigt',
    ar: 'اعتمد',
  },
  'cs.apr.dec.rejected': {
    tr: 'Reddetti',
    en: 'Rejected',
    de: 'Abgelehnt',
    ar: 'رفض',
  },
  'cs.apr.dec.skipped': {
    tr: 'Sorulmadı',
    en: 'Not asked',
    de: 'Nicht gefragt',
    ar: 'لم يُسأل',
  },
  'cs.apr.dec.delegated': {
    tr: 'Vekâleten onaylandı',
    en: 'Approved by proxy',
    de: 'Stellvertretend genehmigt',
    ar: 'اعتُمد بالوكالة',
  },
  'cs.apr.kind.contract': {
    tr: 'Sözleşme',
    en: 'Contract',
    de: 'Vertrag',
    ar: 'العقد',
  },
  'cs.apr.kind.progress': {
    tr: 'Hakediş',
    en: 'Progress payment',
    de: 'Abschlagszahlung',
    ar: 'المستخلص',
  },
  'cs.apr.kind.material_request': {
    tr: 'Malzeme talebi',
    en: 'Material request',
    de: 'Materialanforderung',
    ar: 'طلب مواد',
  },
  'cs.apr.kind.expense': {
    tr: 'Harcama',
    en: 'Expense',
    de: 'Ausgabe',
    ar: 'المصروف',
  },
  'cs.apr.kind.advance': {
    tr: 'Avans',
    en: 'Advance',
    de: 'Vorschuss',
    ar: 'السلفة',
  },
  'cs.apr.kind.daily_log': {
    tr: 'Günlük rapor',
    en: 'Daily log',
    de: 'Bautagesbericht',
    ar: 'التقرير اليومي',
  },
  'cs.apr.kind.tracking': {
    tr: 'İlerleme takibi',
    en: 'Progress tracking',
    de: 'Fortschrittsverfolgung',
    ar: 'متابعة التقدم',
  },
  'cs.apr.kind.boq': {
    tr: 'Keşif',
    en: 'Bill of quantities',
    de: 'Leistungsverzeichnis',
    ar: 'جدول الكميات',
  },
  'cs.apr.kind.measurement': {
    tr: 'Metraj',
    en: 'Measurement',
    de: 'Aufmaß',
    ar: 'الحصر',
  },
  'cs.apr.kind.payment': {
    tr: 'Ödeme',
    en: 'Payment',
    de: 'Zahlung',
    ar: 'الدفعة',
  },
  'cs.apr.act.approve': {
    tr: 'Onayla',
    en: 'Approve',
    de: 'Genehmigen',
    ar: 'اعتماد',
  },
  'cs.apr.act.reject': {
    tr: 'Reddet',
    en: 'Reject',
    de: 'Ablehnen',
    ar: 'رفض',
  },
  'cs.apr.act.cancelFlow': {
    tr: 'Akışı iptal et',
    en: 'Cancel flow',
    de: 'Ablauf stornieren',
    ar: 'إلغاء المسار',
  },
  'cs.apr.act.start': {
    tr: 'Onaya gönder',
    en: 'Send for approval',
    de: 'Zur Genehmigung senden',
    ar: 'إرسال للاعتماد',
  },
  'cs.apr.act.detail': {
    tr: 'Ayrıntı',
    en: 'Detail',
    de: 'Detail',
    ar: 'التفاصيل',
  },
  'cs.apr.dlg.approveTitle': {
    tr: 'Onay ver',
    en: 'Give approval',
    de: 'Genehmigung erteilen',
    ar: 'إعطاء الموافقة',
  },
  'cs.apr.dlg.rejectTitle': {
    tr: 'Reddet',
    en: 'Reject',
    de: 'Ablehnen',
    ar: 'رفض',
  },
  'cs.apr.dlg.commentApprove': {
    tr: 'Açıklama (isteğe bağlı)',
    en: 'Comment (optional)',
    de: 'Kommentar (optional)',
    ar: 'ملاحظة (اختياري)',
  },
  'cs.apr.dlg.commentReject': {
    tr: 'Red gerekçesi',
    en: 'Reason for rejection',
    de: 'Ablehnungsgrund',
    ar: 'سبب الرفض',
  },
  'cs.apr.dlg.rejectWarn': {
    tr: 'Red bütün akışı bitirir: kalan onaycılara sorulmaz ve belge ilerlemez.',
    en: 'A rejection ends the whole flow: the remaining approvers are not asked and the document does not proceed.',
    de: 'Eine Ablehnung beendet den gesamten Ablauf: Die übrigen Genehmiger werden nicht gefragt und der Beleg läuft nicht weiter.',
    ar: 'الرفض ينهي المسار بالكامل: لا يُسأل بقية المعتمدين ولا يتقدم المستند.',
  },
  'cs.apr.dlg.reasonRequired': {
    tr: 'Red için gerekçe yazın.',
    en: 'Please write a reason for the rejection.',
    de: 'Bitte geben Sie einen Ablehnungsgrund an.',
    ar: 'يرجى كتابة سبب الرفض.',
  },
  'cs.apr.dlg.delegateWarn': {
    tr: 'Bu adım başka bir onaycıya ait. Vekâleten karar verirseniz izde adınız görünür.',
    en: 'This step belongs to another approver. If you decide by proxy your name appears in the trail.',
    de: 'Dieser Schritt gehört einem anderen Genehmiger. Bei einer Stellvertreterentscheidung erscheint Ihr Name in der Spur.',
    ar: 'هذه الخطوة تخص معتمدًا آخر. إذا قررت بالوكالة فسيظهر اسمك في السجل.',
  },
  'cs.apr.msg.approved': {
    tr: 'Onayınız kaydedildi.',
    en: 'Your approval was recorded.',
    de: 'Ihre Genehmigung wurde erfasst.',
    ar: 'تم تسجيل موافقتك.',
  },
  'cs.apr.msg.rejected': {
    tr: 'Red kaydedildi; akış kapandı.',
    en: 'The rejection was recorded; the flow is closed.',
    de: 'Die Ablehnung wurde erfasst; der Ablauf ist abgeschlossen.',
    ar: 'تم تسجيل الرفض؛ وأُغلق المسار.',
  },
  'cs.apr.msg.flowCompleted': {
    tr: 'Akış tamamlandı — belge onaylandı.',
    en: 'Flow completed — the document is approved.',
    de: 'Ablauf abgeschlossen — der Beleg ist genehmigt.',
    ar: 'اكتمل المسار — تم اعتماد المستند.',
  },
  'cs.apr.msg.cancelled': {
    tr: 'Akış iptal edildi.',
    en: 'The flow was cancelled.',
    de: 'Der Ablauf wurde storniert.',
    ar: 'تم إلغاء المسار.',
  },
  'cs.apr.msg.started': {
    tr: 'Onay akışı başlatıldı.',
    en: 'The approval flow was started.',
    de: 'Der Genehmigungsablauf wurde gestartet.',
    ar: 'تم بدء مسار الموافقة.',
  },
  'cs.apr.msg.cancelConfirm': {
    tr: 'Bu onay akışı iptal edilsin mi? Bekleyen onaycılara artık sorulmaz.',
    en: 'Cancel this approval flow? The pending approvers will no longer be asked.',
    de: 'Diesen Genehmigungsablauf stornieren? Die ausstehenden Genehmiger werden nicht mehr gefragt.',
    ar: 'هل تُلغى مسار الموافقة هذا؟ لن يُسأل المعتمدون المنتظرون بعد الآن.',
  },
  'cs.apr.new.title': {
    tr: 'Yeni onay akışı',
    en: 'New approval flow',
    de: 'Neuer Genehmigungsablauf',
    ar: 'مسار موافقة جديد',
  },
  'cs.apr.new.hint': {
    tr: 'Bir belgenin aynı anda tek aktif akışı olabilir. Onaycı sırası aşağıdaki sıradır.',
    en: 'A document can have only one active flow at a time. The approver order is the order below.',
    de: 'Ein Beleg kann nur einen aktiven Ablauf gleichzeitig haben. Die Genehmigerreihenfolge ist die untenstehende.',
    ar: 'يمكن أن يكون للمستند مسار نشط واحد فقط في وقت واحد. ترتيب المعتمدين هو الترتيب أدناه.',
  },
  'cs.apr.new.approvers': {
    tr: 'Onaycılar',
    en: 'Approvers',
    de: 'Genehmiger',
    ar: 'المعتمدون',
  },
  'cs.apr.new.addApprover': {
    tr: '+ Onaycı',
    en: '+ Approver',
    de: '+ Genehmiger',
    ar: '+ معتمد',
  },
  'cs.apr.new.userId': {
    tr: 'Kullanıcı no',
    en: 'User no',
    de: 'Benutzernr.',
    ar: 'رقم المستخدم',
  },
  'cs.apr.new.allMustApprove': {
    tr: 'Herkes onaylamalı',
    en: 'Everyone must approve',
    de: 'Alle müssen genehmigen',
    ar: 'يجب أن يوافق الجميع',
  },
  'cs.apr.new.minApprovalsHint': {
    tr: 'Boş bırakılırsa herkes onaylamalı. Sayı girilirse (3 onaycıdan 2) o sayıya ulaşınca akış onaylanır.',
    en: 'If left empty everyone must approve. If a number is given (2 of 3 approvers) the flow is approved when that count is reached.',
    de: 'Bleibt es leer, müssen alle genehmigen. Wird eine Zahl angegeben (2 von 3 Genehmigern), gilt der Ablauf ab dieser Anzahl als genehmigt.',
    ar: 'إذا تُرك فارغًا يجب أن يوافق الجميع. وإذا أُدخل رقم (2 من 3 معتمدين) يُعتمد المسار عند الوصول إلى هذا العدد.',
  },
  'cs.apr.new.needApprover': {
    tr: 'En az bir onaycı ekleyin.',
    en: 'Add at least one approver.',
    de: 'Fügen Sie mindestens einen Genehmiger hinzu.',
    ar: 'أضف معتمدًا واحدًا على الأقل.',
  },
  'cs.apr.new.dupApprover': {
    tr: 'Aynı kullanıcı akışta iki kez onaycı olamaz.',
    en: 'The same user cannot be an approver twice in one flow.',
    de: 'Derselbe Benutzer kann in einem Ablauf nicht zweimal Genehmiger sein.',
    ar: 'لا يمكن أن يكون المستخدم نفسه معتمدًا مرتين في المسار.',
  },
  'cs.apr.f.overdueOnly': {
    tr: 'Yalnız gecikmişler',
    en: 'Overdue only',
    de: 'Nur überfällige',
    ar: 'المتأخرة فقط',
  },
  'cs.apr.f.allKinds': {
    tr: 'Bütün belge tipleri',
    en: 'All document types',
    de: 'Alle Belegtypen',
    ar: 'كل أنواع المستندات',
  },
  'cs.apr.f.allStatuses': {
    tr: 'Bütün durumlar',
    en: 'All statuses',
    de: 'Alle Status',
    ar: 'كل الحالات',
  },
  'cs.apr.f.allProjects': {
    tr: 'Bütün projeler',
    en: 'All projects',
    de: 'Alle Projekte',
    ar: 'كل المشاريع',
  },
  'cs.apr.flows.empty': {
    tr: 'Bu süzgeçlerle onay akışı yok.',
    en: 'No approval flow matches these filters.',
    de: 'Kein Genehmigungsablauf entspricht diesen Filtern.',
    ar: 'لا يوجد مسار موافقة يطابق هذه المرشحات.',
  },
  'cs.apr.flows.count': {
    tr: '{n} akış',
    en: '{n} flows',
    de: '{n} Abläufe',
    ar: '{n} مسار',
  },
  'cs.apr.steps': {
    tr: 'Onay adımları',
    en: 'Approval steps',
    de: 'Genehmigungsschritte',
    ar: 'خطوات الموافقة',
  },
  'cs.apr.history.title': {
    tr: 'Karar izi',
    en: 'Decision trail',
    de: 'Entscheidungsspur',
    ar: 'سجل القرارات',
  },
  'cs.apr.history.empty': {
    tr: 'Kayıt yok.',
    en: 'No records.',
    de: 'Keine Einträge.',
    ar: 'لا توجد سجلات.',
  },
  'cs.apr.hist.created': {
    tr: 'Akış başlatıldı',
    en: 'Flow started',
    de: 'Ablauf gestartet',
    ar: 'بدأ المسار',
  },
  'cs.apr.hist.approved': {
    tr: 'Onaylandı',
    en: 'Approved',
    de: 'Genehmigt',
    ar: 'تم الاعتماد',
  },
  'cs.apr.hist.rejected': {
    tr: 'Reddedildi',
    en: 'Rejected',
    de: 'Abgelehnt',
    ar: 'مرفوض',
  },
  'cs.apr.hist.cancelled': {
    tr: 'İptal edildi',
    en: 'Cancelled',
    de: 'Storniert',
    ar: 'ملغى',
  },
  'cs.apr.badge.none': {
    tr: 'Onay akışı yok',
    en: 'No approval flow',
    de: 'Kein Genehmigungsablauf',
    ar: 'لا يوجد مسار موافقة',
  },
  'cs.apr.days': {
    tr: '{n} gün',
    en: '{n} days',
    de: '{n} Tage',
    ar: '{n} يوم',
  },
  'cs.apr.user': {
    tr: 'Kullanıcı #{id}',
    en: 'User #{id}',
    de: 'Benutzer #{id}',
    ar: 'المستخدم #{id}',
  },
  'cs.apr.you': {
    tr: 'siz',
    en: 'you',
    de: 'Sie',
    ar: 'أنت',
  },
  'cs.apr.noDueDate': {
    tr: 'tarihsiz',
    en: 'no due date',
    de: 'ohne Fälligkeit',
    ar: 'بدون تاريخ',
  },
  'cs.apr.selfOnly': {
    tr: 'Yalnız kendi adımınıza karar verebilirsiniz; başkasının adımı yönetici yetkisi ister.',
    en: 'You can only decide on your own step; another approver’s step requires manager rights.',
    de: 'Sie können nur über Ihren eigenen Schritt entscheiden; der Schritt eines anderen erfordert Managerrechte.',
    ar: 'يمكنك أن تقرر في خطوتك فقط؛ خطوة معتمد آخر تتطلب صلاحية مدير.',
  },

  'cs.qg.title': {
    tr: 'Kalite & Güvenlik',
    en: 'Quality & Safety',
    de: 'Qualität & Sicherheit',
    ar: 'الجودة والسلامة',
  },
  'cs.qg.subtitle': {
    tr: 'Hasar-eksiklik listesi, denetleme ve taşeron karnesi, bilgi talebi (RFI) ve saha görevlendirmesi — hepsi mekân ağacına bağlı.',
    en: 'Punch list, inspections with subcontractor scorecard, requests for information (RFI) and site assignments — all tied to the location tree.',
    de: 'Mängelliste, Inspektionen mit Nachunternehmer-Zeugnis, Informationsanfragen (RFI) und Baustellenaufträge — alle an den Ortsbaum gebunden.',
    ar: 'قائمة العيوب، والتفتيش مع بطاقة تقييم المقاول، وطلبات المعلومات، وتكليفات الموقع — كلها مرتبطة بشجرة المواقع.',
  },
  'cs.qg.tab.defects': {
    tr: 'Hasar-Eksiklik',
    en: 'Punch List',
    de: 'Mängelliste',
    ar: 'العيوب والنواقص',
  },
  'cs.qg.tab.inspections': {
    tr: 'Denetleme',
    en: 'Inspections',
    de: 'Inspektionen',
    ar: 'التفتيش',
  },
  'cs.qg.tab.scorecard': {
    tr: 'Taşeron Karnesi',
    en: 'Vendor Scorecard',
    de: 'Nachunternehmer-Zeugnis',
    ar: 'بطاقة تقييم المقاول',
  },
  'cs.qg.tab.rfi': {
    tr: 'Bilgi Talebi (RFI)',
    en: 'RFI',
    de: 'Informationsanfragen (RFI)',
    ar: 'طلبات المعلومات',
  },
  'cs.qg.tab.assignments': {
    tr: 'Görevlendirme',
    en: 'Assignments',
    de: 'Aufträge',
    ar: 'التكليفات',
  },
  'cs.qg.c.code': {
    tr: 'Kod',
    en: 'Code',
    de: 'Code',
    ar: 'الرمز',
  },
  'cs.qg.c.title': {
    tr: 'Başlık',
    en: 'Title',
    de: 'Titel',
    ar: 'العنوان',
  },
  'cs.qg.c.location': {
    tr: 'Mekân no',
    en: 'Location no',
    de: 'Ort-Nr.',
    ar: 'رقم الموقع',
  },
  'cs.qg.c.vendor': {
    tr: 'Taşeron no',
    en: 'Vendor no',
    de: 'Nachunternehmer-Nr.',
    ar: 'رقم المقاول',
  },
  'cs.qg.c.responsible': {
    tr: 'Sorumlu no',
    en: 'Responsible no',
    de: 'Verantwortlicher-Nr.',
    ar: 'رقم المسؤول',
  },
  'cs.qg.c.dueDate': {
    tr: 'Bitiş tarihi',
    en: 'Due date',
    de: 'Fälligkeitsdatum',
    ar: 'تاريخ الاستحقاق',
  },
  'cs.qg.c.overdue': {
    tr: 'Gecikme',
    en: 'Overdue',
    de: 'Verzug',
    ar: 'التأخير',
  },
  'cs.qg.c.priority': {
    tr: 'Öncelik',
    en: 'Priority',
    de: 'Priorität',
    ar: 'الأولوية',
  },
  'cs.qg.c.createdAt': {
    tr: 'Açılış',
    en: 'Opened',
    de: 'Eröffnet',
    ar: 'فُتح في',
  },
  'cs.qg.c.description': {
    tr: 'Açıklama',
    en: 'Description',
    de: 'Beschreibung',
    ar: 'الوصف',
  },
  'cs.qg.c.note': {
    tr: 'Not',
    en: 'Note',
    de: 'Notiz',
    ar: 'ملاحظة',
  },
  'cs.qg.days': {
    tr: '{n} gün',
    en: '{n} days',
    de: '{n} Tage',
    ar: '{n} يوم',
  },
  'cs.qg.user': {
    tr: 'Kullanıcı #{id}',
    en: 'User #{id}',
    de: 'Benutzer #{id}',
    ar: 'المستخدم #{id}',
  },
  'cs.qg.filter.openOnly': {
    tr: 'Yalnız açıklar',
    en: 'Open only',
    de: 'Nur offene',
    ar: 'المفتوحة فقط',
  },
  'cs.qg.filter.overdueOnly': {
    tr: 'Yalnız gecikmişler',
    en: 'Overdue only',
    de: 'Nur überfällige',
    ar: 'المتأخرة فقط',
  },
  'cs.qg.filter.all': {
    tr: 'Tümü',
    en: 'All',
    de: 'Alle',
    ar: 'الكل',
  },
  'cs.qg.detail': {
    tr: 'Ayrıntı',
    en: 'Detail',
    de: 'Detail',
    ar: 'التفاصيل',
  },
  'cs.qg.saved': {
    tr: 'Kaydedildi.',
    en: 'Saved.',
    de: 'Gespeichert.',
    ar: 'تم الحفظ.',
  },
  'cs.qg.def.new': {
    tr: '+ Hasar-Eksiklik',
    en: '+ Defect',
    de: '+ Mangel',
    ar: '+ عيب',
  },
  'cs.qg.def.kind': {
    tr: 'Hasar tipi',
    en: 'Defect type',
    de: 'Mangelart',
    ar: 'نوع العيب',
  },
  'cs.qg.def.severity': {
    tr: 'Aciliyet',
    en: 'Severity',
    de: 'Dringlichkeit',
    ar: 'الأولوية',
  },
  'cs.qg.def.source': {
    tr: 'Kaynak',
    en: 'Source',
    de: 'Quelle',
    ar: 'المصدر',
  },
  'cs.qg.def.reopen': {
    tr: 'Tekrar',
    en: 'Reopens',
    de: 'Wiederöffnungen',
    ar: 'إعادة الفتح',
  },
  'cs.qg.def.costEstimate': {
    tr: 'Tahmini maliyet',
    en: 'Estimated cost',
    de: 'Geschätzte Kosten',
    ar: 'التكلفة التقديرية',
  },
  'cs.qg.def.costActual': {
    tr: 'Gerçekleşen maliyet',
    en: 'Actual cost',
    de: 'Tatsächliche Kosten',
    ar: 'التكلفة الفعلية',
  },
  'cs.qg.def.dueDateHint': {
    tr: 'Boş bırakılırsa aciliyete göre önerilir (kritik: ertesi gün, çok düşük: 30 gün).',
    en: 'If left empty it is suggested from severity (critical: next day, very low: 30 days).',
    de: 'Bleibt es leer, wird es aus der Dringlichkeit vorgeschlagen (kritisch: nächster Tag, sehr niedrig: 30 Tage).',
    ar: 'إذا تُرك فارغًا يُقترح حسب الأولوية (حرج: اليوم التالي، منخفض جدًا: 30 يومًا).',
  },
  'cs.qg.def.statusNote': {
    tr: 'Durum notu',
    en: 'Status note',
    de: 'Statusnotiz',
    ar: 'ملاحظة الحالة',
  },
  'cs.qg.def.history': {
    tr: 'Durum izi',
    en: 'Status trail',
    de: 'Statusverlauf',
    ar: 'سجل الحالة',
  },
  'cs.qg.def.empty': {
    tr: 'Bu süzgeçlerle hasar-eksiklik kaydı yok.',
    en: 'No defect matches these filters.',
    de: 'Kein Mangel entspricht diesen Filtern.',
    ar: 'لا يوجد عيب يطابق هذه المرشحات.',
  },
  'cs.qg.def.s.open': {
    tr: 'Açık',
    en: 'Open',
    de: 'Offen',
    ar: 'مفتوح',
  },
  'cs.qg.def.s.awaitingVerify': {
    tr: 'Doğrulama bekleyen',
    en: 'Awaiting verification',
    de: 'Wartet auf Prüfung',
    ar: 'بانتظار التحقق',
  },
  'cs.qg.def.s.closedCount': {
    tr: 'Kapanan',
    en: 'Closed',
    de: 'Geschlossen',
    ar: 'مغلق',
  },
  'cs.qg.def.s.critical': {
    tr: 'Kritik',
    en: 'Critical',
    de: 'Kritisch',
    ar: 'حرج',
  },
  'cs.qg.def.s.overdue': {
    tr: 'Gecikmiş',
    en: 'Overdue',
    de: 'Überfällig',
    ar: 'متأخر',
  },
  'cs.qg.def.s.reopened': {
    tr: 'Yeniden açılan',
    en: 'Reopened',
    de: 'Wiedereröffnet',
    ar: 'أُعيد فتحه',
  },
  'cs.qg.def.s.avgFix': {
    tr: 'Ort. giderme (gün)',
    en: 'Avg. fix (days)',
    de: 'Ø Behebung (Tage)',
    ar: 'متوسط الإصلاح (يوم)',
  },
  'cs.qg.def.reopenBadge': {
    tr: '{n} kez yeniden açıldı — "giderildi" deyip geçen iş',
    en: 'Reopened {n} times — work marked fixed that was not',
    de: '{n}-mal wiedereröffnet — als behoben gemeldete, aber nicht behobene Arbeit',
    ar: 'أُعيد فتحه {n} مرة — عمل قيل إنه أُصلح ولم يكن كذلك',
  },
  'cs.qg.dk.workmanship': {
    tr: 'İşçilik hatası',
    en: 'Workmanship',
    de: 'Ausführungsfehler',
    ar: 'خطأ في التنفيذ',
  },
  'cs.qg.dk.missing_work': {
    tr: 'Eksik imalat',
    en: 'Missing work',
    de: 'Fehlende Leistung',
    ar: 'عمل ناقص',
  },
  'cs.qg.dk.material_damage': {
    tr: 'Malzeme hasarı',
    en: 'Material damage',
    de: 'Materialschaden',
    ar: 'تلف المواد',
  },
  'cs.qg.dk.dimensional': {
    tr: 'Ölçü/kot hatası',
    en: 'Dimensional error',
    de: 'Maß-/Höhenfehler',
    ar: 'خطأ في الأبعاد',
  },
  'cs.qg.dk.plumbing': {
    tr: 'Tesisat',
    en: 'Plumbing',
    de: 'Sanitär',
    ar: 'السباكة',
  },
  'cs.qg.dk.electrical': {
    tr: 'Elektrik',
    en: 'Electrical',
    de: 'Elektrik',
    ar: 'الكهرباء',
  },
  'cs.qg.dk.paint': {
    tr: 'Boya/kaplama',
    en: 'Paint/finish',
    de: 'Anstrich/Belag',
    ar: 'الدهان/التشطيب',
  },
  'cs.qg.dk.insulation': {
    tr: 'Yalıtım',
    en: 'Insulation',
    de: 'Abdichtung/Dämmung',
    ar: 'العزل',
  },
  'cs.qg.dk.cleaning': {
    tr: 'Temizlik',
    en: 'Cleaning',
    de: 'Reinigung',
    ar: 'النظافة',
  },
  'cs.qg.dk.safety': {
    tr: 'Güvenlik',
    en: 'Safety',
    de: 'Sicherheit',
    ar: 'السلامة',
  },
  'cs.qg.dk.other': {
    tr: 'Diğer',
    en: 'Other',
    de: 'Sonstiges',
    ar: 'أخرى',
  },
  'cs.qg.sev.very_low': {
    tr: 'Çok düşük',
    en: 'Very low',
    de: 'Sehr niedrig',
    ar: 'منخفض جدًا',
  },
  'cs.qg.sev.low': {
    tr: 'Düşük',
    en: 'Low',
    de: 'Niedrig',
    ar: 'منخفض',
  },
  'cs.qg.sev.medium': {
    tr: 'Orta',
    en: 'Medium',
    de: 'Mittel',
    ar: 'متوسط',
  },
  'cs.qg.sev.high': {
    tr: 'Yüksek',
    en: 'High',
    de: 'Hoch',
    ar: 'مرتفع',
  },
  'cs.qg.sev.critical': {
    tr: 'Kritik',
    en: 'Critical',
    de: 'Kritisch',
    ar: 'حرج',
  },
  'cs.qg.ds.open': {
    tr: 'Açık',
    en: 'Open',
    de: 'Offen',
    ar: 'مفتوح',
  },
  'cs.qg.ds.in_progress': {
    tr: 'Gideriliyor',
    en: 'In progress',
    de: 'In Bearbeitung',
    ar: 'قيد المعالجة',
  },
  'cs.qg.ds.fixed': {
    tr: 'Giderildi',
    en: 'Fixed',
    de: 'Behoben',
    ar: 'أُصلح',
  },
  'cs.qg.ds.verified': {
    tr: 'Doğrulandı',
    en: 'Verified',
    de: 'Geprüft',
    ar: 'تم التحقق',
  },
  'cs.qg.ds.closed': {
    tr: 'Kapandı',
    en: 'Closed',
    de: 'Geschlossen',
    ar: 'مغلق',
  },
  'cs.qg.ds.rejected': {
    tr: 'Reddedildi',
    en: 'Rejected',
    de: 'Abgelehnt',
    ar: 'مرفوض',
  },
  'cs.qg.src.internal': {
    tr: 'İç kontrol',
    en: 'Internal',
    de: 'Interne Kontrolle',
    ar: 'رقابة داخلية',
  },
  'cs.qg.src.inspection': {
    tr: 'Denetim',
    en: 'Inspection',
    de: 'Inspektion',
    ar: 'تفتيش',
  },
  'cs.qg.src.daily_log': {
    tr: 'Günlük rapor',
    en: 'Daily log',
    de: 'Bautagebuch',
    ar: 'التقرير اليومي',
  },
  'cs.qg.src.client': {
    tr: 'İşveren/müşteri',
    en: 'Client',
    de: 'Auftraggeber/Kunde',
    ar: 'العميل',
  },
  'cs.qg.src.rfi': {
    tr: 'Bilgi talebi',
    en: 'RFI',
    de: 'Informationsanfrage',
    ar: 'طلب معلومات',
  },
  'cs.qg.ins.templates': {
    tr: 'Denetim şablonları',
    en: 'Inspection templates',
    de: 'Inspektionsvorlagen',
    ar: 'قوالب التفتيش',
  },
  'cs.qg.ins.newTemplate': {
    tr: '+ Şablon',
    en: '+ Template',
    de: '+ Vorlage',
    ar: '+ قالب',
  },
  'cs.qg.ins.templateKind': {
    tr: 'Şablon tipi',
    en: 'Template type',
    de: 'Vorlagentyp',
    ar: 'نوع القالب',
  },
  'cs.qg.ins.passPct': {
    tr: 'Geçme eşiği (%)',
    en: 'Pass threshold (%)',
    de: 'Bestehensgrenze (%)',
    ar: 'حد النجاح (%)',
  },
  'cs.qg.ins.items': {
    tr: 'Maddeler',
    en: 'Items',
    de: 'Positionen',
    ar: 'البنود',
  },
  'cs.qg.ins.addItem': {
    tr: '+ Madde',
    en: '+ Item',
    de: '+ Position',
    ar: '+ بند',
  },
  'cs.qg.ins.itemText': {
    tr: 'Madde metni',
    en: 'Item text',
    de: 'Positionstext',
    ar: 'نص البند',
  },
  'cs.qg.ins.weight': {
    tr: 'Ağırlık',
    en: 'Weight',
    de: 'Gewicht',
    ar: 'الوزن',
  },
  'cs.qg.ins.maxScore': {
    tr: 'Tam puan',
    en: 'Max score',
    de: 'Höchstpunktzahl',
    ar: 'الدرجة القصوى',
  },
  'cs.qg.ins.critical': {
    tr: 'Kritik',
    en: 'Critical',
    de: 'Kritisch',
    ar: 'حرج',
  },
  'cs.qg.ins.criticalHint': {
    tr: 'Kritik madde sıfır alırsa denetim toplam puandan bağımsız BAŞARISIZ olur (baret takmamak telafi edilemez).',
    en: 'If a critical item scores zero the inspection FAILS regardless of the total score (no hard hat cannot be compensated).',
    de: 'Erhält eine kritische Position null Punkte, FÄLLT die Inspektion unabhängig von der Gesamtpunktzahl durch (fehlender Helm ist nicht kompensierbar).',
    ar: 'إذا حصل بند حرج على صفر تفشل عملية التفتيش بغض النظر عن المجموع (عدم ارتداء الخوذة لا يُعوَّض).',
  },
  'cs.qg.ins.new': {
    tr: '+ Denetim',
    en: '+ Inspection',
    de: '+ Inspektion',
    ar: '+ تفتيش',
  },
  'cs.qg.ins.template': {
    tr: 'Şablon',
    en: 'Template',
    de: 'Vorlage',
    ar: 'القالب',
  },
  'cs.qg.ins.date': {
    tr: 'Denetim tarihi',
    en: 'Inspection date',
    de: 'Inspektionsdatum',
    ar: 'تاريخ التفتيش',
  },
  'cs.qg.ins.period': {
    tr: 'Dönem',
    en: 'Period',
    de: 'Zeitraum',
    ar: 'الفترة',
  },
  'cs.qg.ins.inspector': {
    tr: 'Denetçi',
    en: 'Inspector',
    de: 'Prüfer',
    ar: 'المفتش',
  },
  'cs.qg.ins.score': {
    tr: 'Puan',
    en: 'Score',
    de: 'Punktzahl',
    ar: 'الدرجة',
  },
  'cs.qg.ins.grade': {
    tr: 'Not',
    en: 'Grade',
    de: 'Note',
    ar: 'التقدير',
  },
  'cs.qg.ins.passed': {
    tr: 'Geçti',
    en: 'Passed',
    de: 'Bestanden',
    ar: 'ناجح',
  },
  'cs.qg.ins.failed': {
    tr: 'Kaldı',
    en: 'Failed',
    de: 'Durchgefallen',
    ar: 'راسب',
  },
  'cs.qg.ins.notMeasured': {
    tr: 'Ölçülmedi',
    en: 'Not measured',
    de: 'Nicht gemessen',
    ar: 'لم يُقَس',
  },
  'cs.qg.ins.na': {
    tr: 'Uygulanamaz',
    en: 'N/A',
    de: 'Entfällt',
    ar: 'لا ينطبق',
  },
  'cs.qg.ins.naHint': {
    tr: 'Uygulanamaz madde paydan da paydadan da düşer — 0 vermek taşeronu yapmadığı iş için cezalandırır.',
    en: 'An N/A item is removed from both numerator and denominator — scoring 0 punishes the vendor for work that does not exist.',
    de: 'Eine entfallende Position wird aus Zähler und Nenner entfernt — 0 Punkte bestrafen den Nachunternehmer für nicht existierende Arbeit.',
    ar: 'البند غير المنطبق يُحذف من البسط والمقام — إعطاء صفر يعاقب المقاول على عمل غير موجود.',
  },
  'cs.qg.ins.unanswered': {
    tr: '{n} madde cevapsız',
    en: '{n} items unanswered',
    de: '{n} Positionen unbeantwortet',
    ar: '{n} بند دون إجابة',
  },
  'cs.qg.ins.criticalFail': {
    tr: '{n} kritik madde sıfır — denetim kalır',
    en: '{n} critical items at zero — inspection fails',
    de: '{n} kritische Positionen bei null — Inspektion fällt durch',
    ar: '{n} بند حرج عند الصفر — يفشل التفتيش',
  },
  'cs.qg.ins.saveAnswers': {
    tr: 'Cevapları kaydet',
    en: 'Save answers',
    de: 'Antworten speichern',
    ar: 'حفظ الإجابات',
  },
  'cs.qg.ins.complete': {
    tr: 'Tamamla',
    en: 'Complete',
    de: 'Abschließen',
    ar: 'إكمال',
  },
  'cs.qg.ins.approve': {
    tr: 'Onayla (karneye işle)',
    en: 'Approve (publish to scorecard)',
    de: 'Genehmigen (ins Zeugnis)',
    ar: 'اعتماد (إلى بطاقة التقييم)',
  },
  'cs.qg.ins.backToDraft': {
    tr: 'Taslağa döndür',
    en: 'Back to draft',
    de: 'Zurück zum Entwurf',
    ar: 'إعادة إلى المسودة',
  },
  'cs.qg.ins.approveWarn': {
    tr: 'Onaylanan denetim taslağa dönemez ve cevabı değişmez — karne bu puanla yayınlanır.',
    en: 'An approved inspection cannot return to draft and its answers cannot change — the scorecard is published with this score.',
    de: 'Eine genehmigte Inspektion kann nicht zum Entwurf zurück und ihre Antworten sind unveränderlich — das Zeugnis wird mit dieser Punktzahl veröffentlicht.',
    ar: 'التفتيش المعتمد لا يعود مسودة ولا تتغير إجاباته — تُنشر بطاقة التقييم بهذه الدرجة.',
  },
  'cs.qg.ins.raiseDefect': {
    tr: 'Kusur aç',
    en: 'Raise defect',
    de: 'Mangel anlegen',
    ar: 'فتح عيب',
  },
  'cs.qg.ins.defectLinked': {
    tr: 'Kusur: {code}',
    en: 'Defect: {code}',
    de: 'Mangel: {code}',
    ar: 'العيب: {code}',
  },
  'cs.qg.ins.empty': {
    tr: 'Bu süzgeçlerle denetim yok.',
    en: 'No inspection matches these filters.',
    de: 'Keine Inspektion entspricht diesen Filtern.',
    ar: 'لا يوجد تفتيش يطابق هذه المرشحات.',
  },
  'cs.qg.ins.vendorRequired': {
    tr: 'Karne formu taşeron seçilmeden başlatılamaz.',
    en: 'A scorecard inspection cannot start without a vendor.',
    de: 'Eine Zeugnis-Inspektion kann nicht ohne Nachunternehmer beginnen.',
    ar: 'لا يمكن بدء تفتيش بطاقة التقييم دون اختيار مقاول.',
  },
  'cs.qg.itk.quality': {
    tr: 'Kalite kontrol',
    en: 'Quality control',
    de: 'Qualitätskontrolle',
    ar: 'مراقبة الجودة',
  },
  'cs.qg.itk.subcontractor_scorecard': {
    tr: 'Taşeron karne formu',
    en: 'Subcontractor scorecard',
    de: 'Nachunternehmer-Zeugnis',
    ar: 'بطاقة تقييم المقاول',
  },
  'cs.qg.itk.hse': {
    tr: 'İSG saha turu',
    en: 'HSE walkdown',
    de: 'HSE-Begehung',
    ar: 'جولة السلامة',
  },
  'cs.qg.itk.handover': {
    tr: 'Teslim öncesi',
    en: 'Handover',
    de: 'Übergabe',
    ar: 'ما قبل التسليم',
  },
  'cs.qg.itk.other': {
    tr: 'Diğer',
    en: 'Other',
    de: 'Sonstiges',
    ar: 'أخرى',
  },
  'cs.qg.is.draft': {
    tr: 'Taslak',
    en: 'Draft',
    de: 'Entwurf',
    ar: 'مسودة',
  },
  'cs.qg.is.completed': {
    tr: 'Tamamlandı',
    en: 'Completed',
    de: 'Abgeschlossen',
    ar: 'مكتمل',
  },
  'cs.qg.is.approved': {
    tr: 'Onaylandı',
    en: 'Approved',
    de: 'Genehmigt',
    ar: 'معتمد',
  },
  'cs.qg.is.cancelled': {
    tr: 'İptal',
    en: 'Cancelled',
    de: 'Storniert',
    ar: 'ملغى',
  },
  'cs.qg.sc.subtitle': {
    tr: 'Denetim puanı + hasar-eksiklik davranışı tek satırda. Tekrar sayısı "giderildi" deyip geçen işi gösterir.',
    en: 'Inspection score + defect behaviour in one row. The reopen count exposes work marked fixed that was not.',
    de: 'Inspektionspunktzahl + Mängelverhalten in einer Zeile. Die Wiederöffnungszahl zeigt als behoben gemeldete, aber nicht behobene Arbeit.',
    ar: 'درجة التفتيش وسلوك العيوب في سطر واحد. عدد إعادة الفتح يكشف الأعمال التي قيل إنها أُصلحت ولم تكن كذلك.',
  },
  'cs.qg.sc.inspections': {
    tr: 'Denetim',
    en: 'Inspections',
    de: 'Inspektionen',
    ar: 'التفتيشات',
  },
  'cs.qg.sc.avgScore': {
    tr: 'Ort. puan',
    en: 'Avg. score',
    de: 'Ø Punktzahl',
    ar: 'متوسط الدرجة',
  },
  'cs.qg.sc.minScore': {
    tr: 'En düşük',
    en: 'Lowest',
    de: 'Niedrigste',
    ar: 'الأدنى',
  },
  'cs.qg.sc.failed': {
    tr: 'Kalınan',
    en: 'Failed',
    de: 'Durchgefallen',
    ar: 'راسب',
  },
  'cs.qg.sc.defects': {
    tr: 'Kusur',
    en: 'Defects',
    de: 'Mängel',
    ar: 'العيوب',
  },
  'cs.qg.sc.open': {
    tr: 'Açık',
    en: 'Open',
    de: 'Offen',
    ar: 'مفتوح',
  },
  'cs.qg.sc.severe': {
    tr: 'Ağır',
    en: 'Severe',
    de: 'Schwer',
    ar: 'جسيم',
  },
  'cs.qg.sc.lastInspection': {
    tr: 'Son denetim',
    en: 'Last inspection',
    de: 'Letzte Inspektion',
    ar: 'آخر تفتيش',
  },
  'cs.qg.sc.empty': {
    tr: 'Henüz karneye girecek veri yok — tamamlanmış denetim veya taşerona yazılmış kusur gerekir.',
    en: 'No scorecard data yet — a completed inspection or a vendor-attributed defect is needed.',
    de: 'Noch keine Zeugnisdaten — eine abgeschlossene Inspektion oder ein zugeordneter Mangel ist nötig.',
    ar: 'لا توجد بيانات بعد — يلزم تفتيش مكتمل أو عيب منسوب إلى مقاول.',
  },
  'cs.qg.rfi.new': {
    tr: '+ Bilgi Talebi',
    en: '+ RFI',
    de: '+ Anfrage',
    ar: '+ طلب معلومات',
  },
  'cs.qg.rfi.subject': {
    tr: 'Konu',
    en: 'Subject',
    de: 'Betreff',
    ar: 'الموضوع',
  },
  'cs.qg.rfi.question': {
    tr: 'Soru',
    en: 'Question',
    de: 'Frage',
    ar: 'السؤال',
  },
  'cs.qg.rfi.answer': {
    tr: 'Cevap',
    en: 'Answer',
    de: 'Antwort',
    ar: 'الإجابة',
  },
  'cs.qg.rfi.discipline': {
    tr: 'Disiplin',
    en: 'Discipline',
    de: 'Fachbereich',
    ar: 'التخصص',
  },
  'cs.qg.rfi.askedTo': {
    tr: 'Cevaplayacak no',
    en: 'Answerer no',
    de: 'Beantworter-Nr.',
    ar: 'رقم المجيب',
  },
  'cs.qg.rfi.age': {
    tr: 'Yaş',
    en: 'Age',
    de: 'Alter',
    ar: 'العمر',
  },
  'cs.qg.rfi.impactDays': {
    tr: 'Süre etkisi (gün)',
    en: 'Time impact (days)',
    de: 'Zeitwirkung (Tage)',
    ar: 'أثر المدة (يوم)',
  },
  'cs.qg.rfi.impactCost': {
    tr: 'Maliyet etkisi',
    en: 'Cost impact',
    de: 'Kostenwirkung',
    ar: 'أثر التكلفة',
  },
  'cs.qg.rfi.impactHint': {
    tr: 'Kamu ihalesinde süre uzatımı talebinin dayanağı cevapsız kalan bilgi talepleridir — etkiyi kaydedin.',
    en: 'In public tenders unanswered RFIs are the basis of time-extension claims — record the impact.',
    de: 'Bei öffentlichen Vergaben sind unbeantwortete RFIs die Grundlage von Bauzeitverlängerungen — Wirkung erfassen.',
    ar: 'في المناقصات العامة تكون طلبات المعلومات غير المجابة أساس مطالبات تمديد المدة — سجّل الأثر.',
  },
  'cs.qg.rfi.writeAnswer': {
    tr: 'Cevap yaz',
    en: 'Write answer',
    de: 'Antwort schreiben',
    ar: 'كتابة إجابة',
  },
  'cs.qg.rfi.answerRequired': {
    tr: 'Cevap boş olamaz.',
    en: 'The answer cannot be empty.',
    de: 'Die Antwort darf nicht leer sein.',
    ar: 'لا يمكن أن تكون الإجابة فارغة.',
  },
  'cs.qg.rfi.empty': {
    tr: 'Bu süzgeçlerle bilgi talebi yok.',
    en: 'No RFI matches these filters.',
    de: 'Keine Anfrage entspricht diesen Filtern.',
    ar: 'لا يوجد طلب يطابق هذه المرشحات.',
  },
  'cs.qg.rfi.s.oldestOpen': {
    tr: 'En eski açık (gün)',
    en: 'Oldest open (days)',
    de: 'Älteste offene (Tage)',
    ar: 'أقدم مفتوح (يوم)',
  },
  'cs.qg.rfi.s.avgAnswer': {
    tr: 'Ort. cevap (gün)',
    en: 'Avg. answer (days)',
    de: 'Ø Antwort (Tage)',
    ar: 'متوسط الإجابة (يوم)',
  },
  'cs.qg.rfi.s.impactTotal': {
    tr: 'Toplam süre etkisi',
    en: 'Total time impact',
    de: 'Gesamte Zeitwirkung',
    ar: 'إجمالي أثر المدة',
  },
  'cs.qg.disc.architectural': {
    tr: 'Mimari',
    en: 'Architectural',
    de: 'Architektur',
    ar: 'معماري',
  },
  'cs.qg.disc.structural': {
    tr: 'Statik',
    en: 'Structural',
    de: 'Tragwerk',
    ar: 'إنشائي',
  },
  'cs.qg.disc.mechanical': {
    tr: 'Mekanik',
    en: 'Mechanical',
    de: 'HLS',
    ar: 'ميكانيكي',
  },
  'cs.qg.disc.electrical': {
    tr: 'Elektrik',
    en: 'Electrical',
    de: 'Elektro',
    ar: 'كهربائي',
  },
  'cs.qg.disc.infrastructure': {
    tr: 'Altyapı',
    en: 'Infrastructure',
    de: 'Infrastruktur',
    ar: 'بنية تحتية',
  },
  'cs.qg.disc.landscape': {
    tr: 'Peyzaj',
    en: 'Landscape',
    de: 'Freianlagen',
    ar: 'تنسيق المواقع',
  },
  'cs.qg.disc.geotechnical': {
    tr: 'Geoteknik',
    en: 'Geotechnical',
    de: 'Geotechnik',
    ar: 'جيوتقني',
  },
  'cs.qg.disc.other': {
    tr: 'Diğer',
    en: 'Other',
    de: 'Sonstiges',
    ar: 'أخرى',
  },
  'cs.qg.rs.open': {
    tr: 'Açık',
    en: 'Open',
    de: 'Offen',
    ar: 'مفتوح',
  },
  'cs.qg.rs.answered': {
    tr: 'Cevaplandı',
    en: 'Answered',
    de: 'Beantwortet',
    ar: 'مجاب',
  },
  'cs.qg.rs.closed': {
    tr: 'Kapandı',
    en: 'Closed',
    de: 'Geschlossen',
    ar: 'مغلق',
  },
  'cs.qg.rs.cancelled': {
    tr: 'İptal',
    en: 'Cancelled',
    de: 'Storniert',
    ar: 'ملغى',
  },
  'cs.qg.pr.low': {
    tr: 'Düşük',
    en: 'Low',
    de: 'Niedrig',
    ar: 'منخفضة',
  },
  'cs.qg.pr.medium': {
    tr: 'Orta',
    en: 'Medium',
    de: 'Mittel',
    ar: 'متوسطة',
  },
  'cs.qg.pr.high': {
    tr: 'Yüksek',
    en: 'High',
    de: 'Hoch',
    ar: 'عالية',
  },
  'cs.qg.pr.urgent': {
    tr: 'Acil',
    en: 'Urgent',
    de: 'Dringend',
    ar: 'عاجلة',
  },
  'cs.qg.asg.new': {
    tr: '+ Görev',
    en: '+ Assignment',
    de: '+ Auftrag',
    ar: '+ تكليف',
  },
  'cs.qg.asg.assignedTo': {
    tr: 'Atanan no',
    en: 'Assignee no',
    de: 'Zugewiesener-Nr.',
    ar: 'رقم المكلَّف',
  },
  'cs.qg.asg.progress': {
    tr: 'İlerleme',
    en: 'Progress',
    de: 'Fortschritt',
    ar: 'التقدم',
  },
  'cs.qg.asg.startDate': {
    tr: 'Başlangıç',
    en: 'Start',
    de: 'Beginn',
    ar: 'البداية',
  },
  'cs.qg.asg.source': {
    tr: 'Kaynak belge',
    en: 'Source document',
    de: 'Quellbeleg',
    ar: 'المستند المصدر',
  },
  'cs.qg.asg.sourceHint': {
    tr: 'Buradaki görev bir kaynak belgeye bağlı saha işidir; genel görevler için görev modülünü kullanın.',
    en: 'An assignment here is site work tied to a source document; use the task module for general tasks.',
    de: 'Ein Auftrag hier ist an einen Quellbeleg gebundene Baustellenarbeit; für allgemeine Aufgaben das Aufgabenmodul nutzen.',
    ar: 'التكليف هنا عمل ميداني مرتبط بمستند مصدر؛ للمهام العامة استخدم وحدة المهام.',
  },
  'cs.qg.asg.empty': {
    tr: 'Bu süzgeçlerle görev yok.',
    en: 'No assignment matches these filters.',
    de: 'Kein Auftrag entspricht diesen Filtern.',
    ar: 'لا يوجد تكليف يطابق هذه المرشحات.',
  },
  'cs.qg.asg.done100': {
    tr: 'Biten görev %100 sayılır; yüzde ayrıca girilmez.',
    en: 'A finished assignment counts as 100%; the percentage is not entered separately.',
    de: 'Ein abgeschlossener Auftrag zählt als 100 %; der Prozentsatz wird nicht separat erfasst.',
    ar: 'التكليف المنتهي يُحسب 100٪؛ لا تُدخل النسبة على حدة.',
  },
  'cs.qg.as.open': {
    tr: 'Açık',
    en: 'Open',
    de: 'Offen',
    ar: 'مفتوح',
  },
  'cs.qg.as.in_progress': {
    tr: 'Devam ediyor',
    en: 'In progress',
    de: 'In Arbeit',
    ar: 'قيد التنفيذ',
  },
  'cs.qg.as.done': {
    tr: 'Bitti',
    en: 'Done',
    de: 'Erledigt',
    ar: 'منجز',
  },
  'cs.qg.as.cancelled': {
    tr: 'İptal',
    en: 'Cancelled',
    de: 'Storniert',
    ar: 'ملغى',
  },
  'cs.qg.asrc.defect': {
    tr: 'Hasar-eksiklik',
    en: 'Defect',
    de: 'Mangel',
    ar: 'عيب',
  },
  'cs.qg.asrc.rfi': {
    tr: 'Bilgi talebi',
    en: 'RFI',
    de: 'Anfrage',
    ar: 'طلب معلومات',
  },
  'cs.qg.asrc.inspection': {
    tr: 'Denetim',
    en: 'Inspection',
    de: 'Inspektion',
    ar: 'تفتيش',
  },
  'cs.qg.asrc.daily_log': {
    tr: 'Günlük rapor',
    en: 'Daily log',
    de: 'Bautagebuch',
    ar: 'التقرير اليومي',
  },
  'cs.qg.asrc.tracking': {
    tr: 'İlerleme takibi',
    en: 'Progress tracking',
    de: 'Fortschrittsverfolgung',
    ar: 'متابعة التقدم',
  },

  'cs.cmt.title': {
    tr: 'Taahhütler & EVM',
    en: 'Commitments & EVM',
    de: 'Obligos & EVM',
    ar: 'الالتزامات و EVM',
  },
  'cs.cmt.subtitle': {
    tr: 'Verilmiş ama henüz faturalanmamış para: siparişler, taşeron anlaşmaları, elle girilen taahhütler. Taahhütsüz bütçe tablosu yalan söyler.',
    en: 'Money committed but not yet invoiced: purchase orders, subcontract agreements, manual entries. A budget table without commitments lies.',
    de: 'Zugesagtes, aber noch nicht fakturiertes Geld: Bestellungen, Nachunternehmerverträge, manuelle Einträge. Eine Budgettabelle ohne Obligos lügt.',
    ar: 'أموال ملتزم بها لم تُفوتر بعد: أوامر شراء، اتفاقيات مقاولين، إدخالات يدوية. جدول ميزانية بلا التزامات يكذب.',
  },
  'cs.cmt.new': {
    tr: '+ Taahhüt',
    en: '+ Commitment',
    de: '+ Obligo',
    ar: '+ التزام',
  },
  'cs.cmt.c.refNo': {
    tr: 'Belge no',
    en: 'Ref no',
    de: 'Beleg-Nr.',
    ar: 'رقم المستند',
  },
  'cs.cmt.c.source': {
    tr: 'Kaynak',
    en: 'Source',
    de: 'Quelle',
    ar: 'المصدر',
  },
  'cs.cmt.c.amount': {
    tr: 'Tutar',
    en: 'Amount',
    de: 'Betrag',
    ar: 'المبلغ',
  },
  'cs.cmt.c.delivered': {
    tr: 'Teslim alınan',
    en: 'Delivered',
    de: 'Geliefert',
    ar: 'المستلم',
  },
  'cs.cmt.c.open': {
    tr: 'Açık taahhüt',
    en: 'Open commitment',
    de: 'Offenes Obligo',
    ar: 'الالتزام المفتوح',
  },
  'cs.cmt.c.committedAt': {
    tr: 'Taahhüt tarihi',
    en: 'Committed on',
    de: 'Zugesagt am',
    ar: 'تاريخ الالتزام',
  },
  'cs.cmt.c.boqLine': {
    tr: 'Keşif satırı no',
    en: 'BoQ line no',
    de: 'LV-Positions-Nr.',
    ar: 'رقم بند الكميات',
  },
  'cs.cmt.c.contract': {
    tr: 'Sözleşme no',
    en: 'Contract no',
    de: 'Vertrags-Nr.',
    ar: 'رقم العقد',
  },
  'cs.cmt.src.purchase_order': {
    tr: 'Satınalma siparişi',
    en: 'Purchase order',
    de: 'Bestellung',
    ar: 'أمر شراء',
  },
  'cs.cmt.src.subcontract': {
    tr: 'Taşeron anlaşması',
    en: 'Subcontract',
    de: 'Nachunternehmervertrag',
    ar: 'عقد مقاول',
  },
  'cs.cmt.src.manual': {
    tr: 'Elle giriş',
    en: 'Manual',
    de: 'Manuell',
    ar: 'إدخال يدوي',
  },
  'cs.cmt.st.open': {
    tr: 'Açık',
    en: 'Open',
    de: 'Offen',
    ar: 'مفتوح',
  },
  'cs.cmt.st.partial': {
    tr: 'Kısmi teslim',
    en: 'Partially delivered',
    de: 'Teilgeliefert',
    ar: 'مستلم جزئيًا',
  },
  'cs.cmt.st.closed': {
    tr: 'Kapandı',
    en: 'Closed',
    de: 'Geschlossen',
    ar: 'مغلق',
  },
  'cs.cmt.st.cancelled': {
    tr: 'İptal',
    en: 'Cancelled',
    de: 'Storniert',
    ar: 'ملغى',
  },
  'cs.cmt.act.delivery': {
    tr: 'Teslimat',
    en: 'Delivery',
    de: 'Lieferung',
    ar: 'تسليم',
  },
  'cs.cmt.act.close': {
    tr: 'Kapat',
    en: 'Close',
    de: 'Schließen',
    ar: 'إغلاق',
  },
  'cs.cmt.act.cancel': {
    tr: 'İptal et',
    en: 'Cancel',
    de: 'Stornieren',
    ar: 'إلغاء',
  },
  'cs.cmt.deliveryHint': {
    tr: 'KÜMÜLATİF teslim tutarı girilir (bu teslimatın tutarı değil, bugüne kadarki toplam). Tam teslimde taahhüt otomatik kapanır.',
    en: 'Enter the CUMULATIVE delivered amount (total to date, not this delivery). Full delivery closes the commitment automatically.',
    de: 'Der KUMULIERTE Lieferbetrag wird erfasst (Gesamtsumme bis heute, nicht diese Lieferung). Volllieferung schließt das Obligo automatisch.',
    ar: 'يُدخل المبلغ المستلم التراكمي (الإجمالي حتى اليوم، لا هذه الدفعة). التسليم الكامل يغلق الالتزام تلقائيًا.',
  },
  'cs.cmt.closeConfirm': {
    tr: 'Taahhüt kapatılsın mı? Kalan açık tutar maruziyetten düşer ve kayıt bir daha düzenlenemez.',
    en: 'Close this commitment? The remaining open amount leaves the exposure and the record can no longer be edited.',
    de: 'Dieses Obligo schließen? Der offene Restbetrag verlässt die Exponierung und der Eintrag ist nicht mehr editierbar.',
    ar: 'هل يُغلق هذا الالتزام؟ يخرج المبلغ المفتوح المتبقي من التعرض ولا يمكن تعديل السجل بعدها.',
  },
  'cs.cmt.cancelConfirm': {
    tr: 'Taahhüt iptal edilsin mi? Teslim alınmış kısım kalır, açık kısım maruziyetten düşer.',
    en: 'Cancel this commitment? The delivered part remains; the open part leaves the exposure.',
    de: 'Dieses Obligo stornieren? Der gelieferte Teil bleibt; der offene Teil verlässt die Exponierung.',
    ar: 'هل يُلغى هذا الالتزام؟ يبقى الجزء المستلم ويخرج الجزء المفتوح من التعرض.',
  },
  'cs.cmt.empty': {
    tr: 'Bu süzgeçlerle taahhüt yok.',
    en: 'No commitment matches these filters.',
    de: 'Kein Obligo entspricht diesen Filtern.',
    ar: 'لا يوجد التزام يطابق هذه المرشحات.',
  },
  'cs.cmt.s.openTotal': {
    tr: 'Açık taahhüt',
    en: 'Open committed',
    de: 'Offenes Obligo',
    ar: 'الالتزام المفتوح',
  },
  'cs.cmt.s.committedTotal': {
    tr: 'Toplam taahhüt',
    en: 'Total committed',
    de: 'Gesamtobligo',
    ar: 'إجمالي الالتزام',
  },
  'cs.cmt.s.openCount': {
    tr: 'Açık kayıt',
    en: 'Open records',
    de: 'Offene Einträge',
    ar: 'سجلات مفتوحة',
  },
  'cs.cmt.s.unlinked': {
    tr: 'Poza bağlanmamış',
    en: 'Not linked to BoQ',
    de: 'Ohne LV-Bezug',
    ar: 'غير مرتبط بالبند',
  },
  'cs.cmt.s.unlinkedHint': {
    tr: 'Poza bağlanmamış taahhüt sözleşme EVM toplamlarına girmez — veri kalitesi göstergesi.',
    en: 'Commitments not linked to a BoQ line are excluded from contract EVM totals — a data quality signal.',
    de: 'Obligos ohne LV-Bezug fließen nicht in die Vertrags-EVM-Summen ein — ein Datenqualitätssignal.',
    ar: 'الالتزامات غير المرتبطة ببند لا تدخل في مجاميع EVM للعقد — مؤشر على جودة البيانات.',
  },
  'cs.evm.title': {
    tr: 'Sözleşme EVM',
    en: 'Contract EVM',
    de: 'Vertrags-EVM',
    ar: 'EVM للعقد',
  },
  'cs.evm.bac': {
    tr: 'Bütçe (BAC)',
    en: 'Budget (BAC)',
    de: 'Budget (BAC)',
    ar: 'الميزانية (BAC)',
  },
  'cs.evm.ev': {
    tr: 'Hakediş (EV)',
    en: 'Earned (EV)',
    de: 'Erbracht (EV)',
    ar: 'المكتسب (EV)',
  },
  'cs.evm.ac': {
    tr: 'Fiili gider (AC)',
    en: 'Actual cost (AC)',
    de: 'Ist-Kosten (AC)',
    ar: 'التكلفة الفعلية (AC)',
  },
  'cs.evm.openCommitted': {
    tr: 'Açık taahhüt',
    en: 'Open committed',
    de: 'Offenes Obligo',
    ar: 'الالتزام المفتوح',
  },
  'cs.evm.exposure': {
    tr: 'Maruziyet',
    en: 'Exposure',
    de: 'Exponierung',
    ar: 'التعرض',
  },
  'cs.evm.remaining': {
    tr: 'Bütçe kalan',
    en: 'Budget remaining',
    de: 'Restbudget',
    ar: 'المتبقي من الميزانية',
  },
  'cs.evm.cpi': {
    tr: 'CPI',
    en: 'CPI',
    de: 'CPI',
    ar: 'CPI',
  },
  'cs.evm.cpiHint': {
    tr: 'CPI = hakediş / fiili gider. 1 altı: kazandığından çok harcıyor.',
    en: 'CPI = earned value / actual cost. Below 1: spending more than earning.',
    de: 'CPI = Fertigstellungswert / Ist-Kosten. Unter 1: es wird mehr ausgegeben als verdient.',
    ar: 'CPI = القيمة المكتسبة ÷ التكلفة الفعلية. أقل من 1: الإنفاق أكثر من الكسب.',
  },
  'cs.evm.exposureHint': {
    tr: 'Maruziyet = fiili gider + açık taahhüt. Sipariş vermeden önce bakılacak sayı budur, harcama değil.',
    en: 'Exposure = actual cost + open commitments. This is the number to check before ordering, not spend.',
    de: 'Exponierung = Ist-Kosten + offene Obligos. Diese Zahl zählt vor einer Bestellung, nicht die Ausgaben.',
    ar: 'التعرض = التكلفة الفعلية + الالتزامات المفتوحة. هذا هو الرقم الذي يُراجع قبل الطلب، لا الإنفاق.',
  },
  'cs.evm.noSpi': {
    tr: 'SPI ve klasik EAC bilerek yok: zaman-fazlı bütçe (baseline) olmadan hesaplanamaz; uydurmak yanlış güven verir.',
    en: 'SPI and classic EAC are intentionally absent: they cannot be computed without a time-phased baseline; faking them gives false confidence.',
    de: 'SPI und klassisches EAC fehlen bewusst: ohne zeitphasenbezogene Baseline nicht berechenbar; sie zu erfinden gibt falsche Sicherheit.',
    ar: 'SPI و EAC الكلاسيكي غائبان عمدًا: لا يمكن حسابهما دون خط أساس زمني؛ اختلاقهما يمنح ثقة زائفة.',
  },
  'cs.evm.pctEarned': {
    tr: 'Kazanılan %',
    en: 'Earned %',
    de: 'Erbracht %',
    ar: 'المكتسب ٪',
  },
  'cs.evm.pctExposure': {
    tr: 'Maruziyet %',
    en: 'Exposure %',
    de: 'Exponierung %',
    ar: 'التعرض ٪',
  },
  'cs.perf.grp.commitment': {
    tr: 'TAAHHÜT & MALİYET',
    en: 'COMMITMENT & COST',
    de: 'OBLIGO & KOSTEN',
    ar: 'الالتزام والتكلفة',
  },
  'cs.perf.c.committed': {
    tr: 'Sipariş (taahhüt)',
    en: 'Committed (POs)',
    de: 'Obligo (Bestellungen)',
    ar: 'الطلبات (التزام)',
  },
  'cs.perf.c.openCommitted': {
    tr: 'Açık taahhüt',
    en: 'Open committed',
    de: 'Offenes Obligo',
    ar: 'الالتزام المفتوح',
  },
  'cs.perf.c.costExposure': {
    tr: 'Maruziyet',
    en: 'Exposure',
    de: 'Exponierung',
    ar: 'التعرض',
  },
  'cs.perf.c.budgetVariance': {
    tr: 'Bütçe sapması',
    en: 'Budget variance',
    de: 'Budgetabweichung',
    ar: 'انحراف الميزانية',
  },
  'cs.perf.h.budgetVariance': {
    tr: 'Planlanan − (fiili + açık taahhüt). Negatif: poz bütçeyi aşmış ya da aşmak üzere — sipariş verilirken görünmeli.',
    en: 'Planned − (actual + open committed). Negative: the line has exceeded or is about to exceed budget — visible before ordering.',
    de: 'Geplant − (Ist + offenes Obligo). Negativ: die Position hat das Budget überschritten oder steht kurz davor.',
    ar: 'المخطط − (الفعلي + الالتزام المفتوح). سالب: تجاوز البند الميزانية أو أوشك — يجب أن يظهر قبل الطلب.',
  },

  'cs.sch.title': {
    tr: 'İş Programı',
    en: 'Schedule',
    de: 'Terminplan',
    ar: 'البرنامج الزمني',
  },
  'cs.sch.subtitle': {
    tr: 'Aktivite listesi (WBS), Gantt ve planlanan/fiili S-eğrisi. Fiili eğri ilerleme kayıtlarından çizilir — kayıt yoksa eğri de yoktur.',
    en: 'Activity list (WBS), Gantt and planned/actual S-curve. The actual curve is drawn from progress records — no record, no curve.',
    de: 'Vorgangsliste (PSP), Gantt und Soll/Ist-S-Kurve. Die Ist-Kurve entsteht aus Fortschrittseinträgen — kein Eintrag, keine Kurve.',
    ar: 'قائمة الأنشطة، ومخطط جانت، ومنحنى S المخطط/الفعلي. يُرسم المنحنى الفعلي من سجلات التقدم — لا سجل، لا منحنى.',
  },
  'cs.sch.tab.gantt': {
    tr: 'Gantt',
    en: 'Gantt',
    de: 'Gantt',
    ar: 'جانت',
  },
  'cs.sch.tab.curve': {
    tr: 'S-Eğrisi',
    en: 'S-Curve',
    de: 'S-Kurve',
    ar: 'منحنى S',
  },
  'cs.sch.new': {
    tr: '+ Aktivite',
    en: '+ Activity',
    de: '+ Vorgang',
    ar: '+ نشاط',
  },
  'cs.sch.c.name': {
    tr: 'Aktivite',
    en: 'Activity',
    de: 'Vorgang',
    ar: 'النشاط',
  },
  'cs.sch.c.kind': {
    tr: 'Tip',
    en: 'Type',
    de: 'Typ',
    ar: 'النوع',
  },
  'cs.sch.c.plannedStart': {
    tr: 'Plan başlangıç',
    en: 'Planned start',
    de: 'Soll-Beginn',
    ar: 'البداية المخططة',
  },
  'cs.sch.c.plannedEnd': {
    tr: 'Plan bitiş',
    en: 'Planned end',
    de: 'Soll-Ende',
    ar: 'النهاية المخططة',
  },
  'cs.sch.c.actualStart': {
    tr: 'Fiili başlangıç',
    en: 'Actual start',
    de: 'Ist-Beginn',
    ar: 'البداية الفعلية',
  },
  'cs.sch.c.actualEnd': {
    tr: 'Fiili bitiş',
    en: 'Actual end',
    de: 'Ist-Ende',
    ar: 'النهاية الفعلية',
  },
  'cs.sch.c.progress': {
    tr: 'İlerleme',
    en: 'Progress',
    de: 'Fortschritt',
    ar: 'التقدم',
  },
  'cs.sch.c.weight': {
    tr: 'Ağırlık',
    en: 'Weight',
    de: 'Gewicht',
    ar: 'الوزن',
  },
  'cs.sch.c.parent': {
    tr: 'Üst grup',
    en: 'Parent group',
    de: 'Übergruppe',
    ar: 'المجموعة الأم',
  },
  'cs.sch.c.dependsOn': {
    tr: 'Öncül',
    en: 'Predecessor',
    de: 'Vorgänger',
    ar: 'السابق',
  },
  'cs.sch.c.tracking': {
    tr: 'Fiziksel takip no',
    en: 'Tracking no',
    de: 'Verfolgungs-Nr.',
    ar: 'رقم المتابعة',
  },
  'cs.sch.kind.group': {
    tr: 'Grup',
    en: 'Group',
    de: 'Gruppe',
    ar: 'مجموعة',
  },
  'cs.sch.kind.task': {
    tr: 'İş',
    en: 'Task',
    de: 'Vorgang',
    ar: 'مهمة',
  },
  'cs.sch.kind.milestone': {
    tr: 'Kilometre taşı',
    en: 'Milestone',
    de: 'Meilenstein',
    ar: 'معلم رئيسي',
  },
  'cs.sch.s.tasks': {
    tr: 'Yaprak aktivite',
    en: 'Leaf activities',
    de: 'Blattvorgänge',
    ar: 'أنشطة طرفية',
  },
  'cs.sch.s.done': {
    tr: 'Biten',
    en: 'Done',
    de: 'Fertig',
    ar: 'منجز',
  },
  'cs.sch.s.overdue': {
    tr: 'Gecikmiş',
    en: 'Overdue',
    de: 'Überfällig',
    ar: 'متأخر',
  },
  'cs.sch.s.notStartedLate': {
    tr: 'Geç kalan başlangıç',
    en: 'Late to start',
    de: 'Verspäteter Beginn',
    ar: 'بداية متأخرة',
  },
  'cs.sch.s.range': {
    tr: 'Program aralığı',
    en: 'Schedule range',
    de: 'Terminbereich',
    ar: 'نطاق البرنامج',
  },
  'cs.sch.empty': {
    tr: 'Bu projede henüz aktivite yok. İlk aktiviteyi ekleyin — grup satırları WBS başlığıdır, eğriye yalnız iş ve kilometre taşları girer.',
    en: 'No activities in this project yet. Add the first one — group rows are WBS headers; only tasks and milestones enter the curve.',
    de: 'Noch keine Vorgänge in diesem Projekt. Fügen Sie den ersten hinzu — Gruppenzeilen sind PSP-Überschriften; nur Vorgänge und Meilensteine gehen in die Kurve ein.',
    ar: 'لا توجد أنشطة في هذا المشروع بعد. أضف الأول — صفوف المجموعات عناوين، والمنحنى يشمل المهام والمعالم فقط.',
  },
  'cs.sch.milestoneHint': {
    tr: 'Kilometre taşının süresi yoktur; yalnız tarih seçilir.',
    en: 'A milestone has no duration; only a date is chosen.',
    de: 'Ein Meilenstein hat keine Dauer; nur ein Datum wird gewählt.',
    ar: 'المعلم الرئيسي بلا مدة؛ يُختار تاريخ فقط.',
  },
  'cs.sch.weightHint': {
    tr: 'Boş bırakılabilir: hiç ağırlık girilmezse eğri süre-orantılı çizilir.',
    en: 'May be left empty: with no weights the curve is duration-weighted.',
    de: 'Kann leer bleiben: ohne Gewichte wird die Kurve dauerproportional gezeichnet.',
    ar: 'يمكن تركه فارغًا: دون أوزان يُرسم المنحنى بتناسب المدة.',
  },
  'cs.sch.prog.title': {
    tr: 'İlerleme kaydı',
    en: 'Record progress',
    de: 'Fortschritt erfassen',
    ar: 'تسجيل التقدم',
  },
  'cs.sch.prog.asOf': {
    tr: 'Tarih',
    en: 'As of',
    de: 'Stichtag',
    ar: 'بتاريخ',
  },
  'cs.sch.prog.hint': {
    tr: 'Her kayıt günlüğe düşer ve fiili S-eğrisini besler. Aynı güne ikinci kayıt üzerine yazar (düzeltme). Geleceğe kayıt yazılamaz.',
    en: 'Every record goes to the log and feeds the actual S-curve. A second record on the same day overwrites (a correction). No future records.',
    de: 'Jeder Eintrag geht ins Journal und speist die Ist-Kurve. Ein zweiter Eintrag am selben Tag überschreibt (Korrektur). Keine Zukunftseinträge.',
    ar: 'كل تسجيل يدخل السجل ويغذي المنحنى الفعلي. تسجيل ثانٍ في اليوم نفسه يستبدل (تصحيح). لا تسجيلات مستقبلية.',
  },
  'cs.sch.prog.fromTracking': {
    tr: 'Takipten çek ({pct}%)',
    en: 'Pull from tracking ({pct}%)',
    de: 'Aus Verfolgung übernehmen ({pct}%)',
    ar: 'سحب من المتابعة ({pct}٪)',
  },
  'cs.sch.prog.fromTrackingHint': {
    tr: 'Bağlı fiziksel takibin güncel yüzdesini aktiviteye yazar. Otomatik değildir: program yüzdesi beyandır, takip ölçümdür.',
    en: 'Writes the linked tracking percentage into the activity. Not automatic: the schedule percentage is a declaration, tracking is a measurement.',
    de: 'Schreibt den Prozentwert der verknüpften Verfolgung in den Vorgang. Nicht automatisch: der Terminplanwert ist eine Erklärung, die Verfolgung eine Messung.',
    ar: 'يكتب نسبة المتابعة المرتبطة في النشاط. ليس تلقائيًا: نسبة البرنامج إقرار والمتابعة قياس.',
  },
  'cs.sch.prog.log': {
    tr: 'İlerleme günlüğü',
    en: 'Progress log',
    de: 'Fortschrittsjournal',
    ar: 'سجل التقدم',
  },
  'cs.sch.gantt.today': {
    tr: 'Bugün',
    en: 'Today',
    de: 'Heute',
    ar: 'اليوم',
  },
  'cs.sch.gantt.planned': {
    tr: 'Planlanan',
    en: 'Planned',
    de: 'Soll',
    ar: 'المخطط',
  },
  'cs.sch.gantt.actual': {
    tr: 'Fiili',
    en: 'Actual',
    de: 'Ist',
    ar: 'الفعلي',
  },
  'cs.sch.curve.weightExplicit': {
    tr: 'Ağırlıklar: girilen değerlerle',
    en: 'Weights: as entered',
    de: 'Gewichte: wie erfasst',
    ar: 'الأوزان: كما أُدخلت',
  },
  'cs.sch.curve.weightDuration': {
    tr: 'Ağırlıklar: süre-orantılı (ağırlık girilmemiş)',
    en: 'Weights: duration-based (none entered)',
    de: 'Gewichte: dauerproportional (keine erfasst)',
    ar: 'الأوزان: بتناسب المدة (لم تُدخل)',
  },
  'cs.sch.curve.empty': {
    tr: 'Eğri için aktivite gerekli.',
    en: 'Activities are needed for the curve.',
    de: 'Für die Kurve sind Vorgänge nötig.',
    ar: 'المنحنى يحتاج إلى أنشطة.',
  },
  'cs.sch.curve.actualNote': {
    tr: 'Fiili çizgi yalnız kayıtlı ilerleme günlerinde yükselir; gelecek çizilmez.',
    en: 'The actual line rises only on recorded progress days; the future is not drawn.',
    de: 'Die Ist-Linie steigt nur an erfassten Fortschrittstagen; die Zukunft wird nicht gezeichnet.',
    ar: 'يرتفع الخط الفعلي فقط في أيام التقدم المسجلة؛ لا يُرسم المستقبل.',
  },
  'cs.sch.deleteConfirm': {
    tr: 'Aktivite silinsin mi? İlerleme günlüğü kayıtları denetim izi olarak kalır.',
    en: 'Delete this activity? Its progress log remains as an audit trail.',
    de: 'Diesen Vorgang löschen? Sein Fortschrittsjournal bleibt als Prüfpfad erhalten.',
    ar: 'هل يُحذف هذا النشاط؟ يبقى سجل تقدمه كأثر تدقيق.',
  },
  'cs.sch.trackingDrift': {
    tr: 'Takip: {pct}%',
    en: 'Tracking: {pct}%',
    de: 'Verfolgung: {pct}%',
    ar: 'المتابعة: {pct}٪',
  },

  'cs.mp.title': {
    tr: 'Makine Parkı',
    en: 'Machine Park',
    de: 'Maschinenpark',
    ar: 'حظيرة المعدات',
  },
  'cs.mp.subtitle': {
    tr: 'Sahiplik, plaka/şase/motor, KM-saat sayacı, garanti ve bakım planı. Sayaç geriye gitmez; sayaç değişimi işaretle ve notla kaydedilir.',
    en: 'Ownership, plate/chassis/engine, km-hour meter, warranty and maintenance plan. The meter never rolls back; a meter change is recorded with a flag and a note.',
    de: 'Eigentum, Kennzeichen/Fahrgestell/Motor, km-Stunden-Zähler, Garantie und Wartungsplan. Der Zähler läuft nie rückwärts; ein Zählerwechsel wird mit Kennzeichen und Notiz erfasst.',
    ar: 'الملكية، اللوحة/الشاسيه/المحرك، عداد الكيلومترات-الساعات، الضمان وخطة الصيانة. العداد لا يرجع؛ يُسجل تغيير العداد بعلامة وملاحظة.',
  },
  'cs.mp.c.machine': {
    tr: 'Makine',
    en: 'Machine',
    de: 'Maschine',
    ar: 'الآلة',
  },
  'cs.mp.c.plate': {
    tr: 'Plaka',
    en: 'Plate',
    de: 'Kennzeichen',
    ar: 'اللوحة',
  },
  'cs.mp.c.chassis': {
    tr: 'Şase no',
    en: 'Chassis no',
    de: 'Fahrgestell-Nr.',
    ar: 'رقم الشاسيه',
  },
  'cs.mp.c.engine': {
    tr: 'Motor no',
    en: 'Engine no',
    de: 'Motor-Nr.',
    ar: 'رقم المحرك',
  },
  'cs.mp.c.brand': {
    tr: 'Marka',
    en: 'Brand',
    de: 'Marke',
    ar: 'الماركة',
  },
  'cs.mp.c.model': {
    tr: 'Model',
    en: 'Model',
    de: 'Modell',
    ar: 'الموديل',
  },
  'cs.mp.c.modelYear': {
    tr: 'Model yılı',
    en: 'Model year',
    de: 'Baujahr',
    ar: 'سنة الصنع',
  },
  'cs.mp.c.meter': {
    tr: 'Sayaç',
    en: 'Meter',
    de: 'Zähler',
    ar: 'العداد',
  },
  'cs.mp.c.meterType': {
    tr: 'Sayaç tipi',
    en: 'Meter type',
    de: 'Zählertyp',
    ar: 'نوع العداد',
  },
  'cs.mp.c.ownership': {
    tr: 'Sahiplik',
    en: 'Ownership',
    de: 'Eigentum',
    ar: 'الملكية',
  },
  'cs.mp.c.warranty': {
    tr: 'Garanti',
    en: 'Warranty',
    de: 'Garantie',
    ar: 'الضمان',
  },
  'cs.mp.c.rental': {
    tr: 'Kiralama',
    en: 'Rental',
    de: 'Miete',
    ar: 'الإيجار',
  },
  'cs.mp.c.maintenance': {
    tr: 'Bakım',
    en: 'Maintenance',
    de: 'Wartung',
    ar: 'الصيانة',
  },
  'cs.mp.c.purchaseDate': {
    tr: 'Satın alma tarihi',
    en: 'Purchase date',
    de: 'Kaufdatum',
    ar: 'تاريخ الشراء',
  },
  'cs.mp.meter.km': {
    tr: 'KM',
    en: 'KM',
    de: 'km',
    ar: 'كم',
  },
  'cs.mp.meter.hour': {
    tr: 'Saat',
    en: 'Hours',
    de: 'Stunden',
    ar: 'ساعة',
  },
  'cs.mp.own.owned': {
    tr: 'Öz mal',
    en: 'Owned',
    de: 'Eigen',
    ar: 'مملوكة',
  },
  'cs.mp.own.rented': {
    tr: 'Kiralık',
    en: 'Rented',
    de: 'Gemietet',
    ar: 'مستأجرة',
  },
  'cs.mp.own.subcontractor': {
    tr: 'Taşeron makinesi',
    en: 'Subcontractor',
    de: 'Nachunternehmer',
    ar: 'مقاول',
  },
  'cs.mp.rp.daily': {
    tr: 'Günlük',
    en: 'Daily',
    de: 'Täglich',
    ar: 'يومي',
  },
  'cs.mp.rp.monthly': {
    tr: 'Aylık',
    en: 'Monthly',
    de: 'Monatlich',
    ar: 'شهري',
  },
  'cs.mp.rentalStart': {
    tr: 'Kira başlangıcı',
    en: 'Rental start',
    de: 'Mietbeginn',
    ar: 'بداية الإيجار',
  },
  'cs.mp.rentalEnd': {
    tr: 'Kira bitişi',
    en: 'Rental end',
    de: 'Mietende',
    ar: 'نهاية الإيجار',
  },
  'cs.mp.rentalCost': {
    tr: 'Kira bedeli',
    en: 'Rental cost',
    de: 'Mietkosten',
    ar: 'قيمة الإيجار',
  },
  'cs.mp.rentalDaysLeft': {
    tr: 'Kirada kalan {n} gün',
    en: '{n} days left on rental',
    de: '{n} Tage Restmiete',
    ar: 'باقي {n} يوم من الإيجار',
  },
  'cs.mp.rentalExpired': {
    tr: 'Kira süresi dolmuş',
    en: 'Rental expired',
    de: 'Miete abgelaufen',
    ar: 'انتهى الإيجار',
  },
  'cs.mp.warrantyUntil': {
    tr: 'Garanti bitiş tarihi',
    en: 'Warranty until',
    de: 'Garantie bis',
    ar: 'الضمان حتى',
  },
  'cs.mp.warrantyMeter': {
    tr: 'Garanti sayaç sınırı',
    en: 'Warranty meter limit',
    de: 'Garantie-Zählergrenze',
    ar: 'حد عداد الضمان',
  },
  'cs.mp.warrantyHint': {
    tr: 'İki sınırdan hangisi önce dolarsa garanti biter ("2 yıl / 100.000 km" mantığı). İkisi de boşsa garanti bilgisi yok sayılır.',
    en: 'Whichever limit is reached first ends the warranty (the "2 years / 100,000 km" logic). If both are empty, warranty info is treated as unknown.',
    de: 'Welche Grenze zuerst erreicht wird, beendet die Garantie (die Logik "2 Jahre / 100.000 km"). Sind beide leer, gilt die Garantie als unbekannt.',
    ar: 'أي حد يكتمل أولًا ينهي الضمان (منطق "سنتان / 100,000 كم"). إذا كان كلاهما فارغًا يُعد الضمان غير معروف.',
  },
  'cs.mp.warranty.in': {
    tr: 'Garantide',
    en: 'In warranty',
    de: 'In Garantie',
    ar: 'في الضمان',
  },
  'cs.mp.warranty.out': {
    tr: 'Garanti bitti',
    en: 'Out of warranty',
    de: 'Garantie abgelaufen',
    ar: 'انتهى الضمان',
  },
  'cs.mp.warranty.none': {
    tr: 'Garanti bilgisi yok',
    en: 'No warranty info',
    de: 'Keine Garantieinfo',
    ar: 'لا معلومات ضمان',
  },
  'cs.mp.warranty.daysLeft': {
    tr: '{n} gün kaldı',
    en: '{n} days left',
    de: '{n} Tage übrig',
    ar: 'باقي {n} يوم',
  },
  'cs.mp.warranty.meterLeft': {
    tr: '{n} {unit} kaldı',
    en: '{n} {unit} left',
    de: '{n} {unit} übrig',
    ar: 'باقي {n} {unit}',
  },
  'cs.mp.meterPanel.title': {
    tr: 'Sayaç okuması',
    en: 'Meter reading',
    de: 'Zählerstand erfassen',
    ar: 'قراءة العداد',
  },
  'cs.mp.meterPanel.hint': {
    tr: 'Sayaç geriye gidemez — sessiz düşüş garanti ve bakım hesabını bozar. Sayaç değişiminde "sayaç değişti" işaretleyin ve not yazın. Aynı güne ikinci okuma üzerine yazar.',
    en: 'The meter cannot roll back — a silent drop corrupts warranty and maintenance math. On a meter change, tick "meter changed" and write a note. A second reading on the same day overwrites.',
    de: 'Der Zähler kann nicht zurücklaufen — ein stiller Rückgang verfälscht Garantie- und Wartungsrechnung. Bei Zählerwechsel "Zähler gewechselt" ankreuzen und Notiz schreiben. Eine zweite Erfassung am selben Tag überschreibt.',
    ar: 'العداد لا يرجع — الانخفاض الصامت يفسد حساب الضمان والصيانة. عند تغيير العداد علّم "تغير العداد" واكتب ملاحظة. القراءة الثانية في اليوم نفسه تستبدل.',
  },
  'cs.mp.meterPanel.value': {
    tr: 'Sayaç değeri',
    en: 'Meter value',
    de: 'Zählerstand',
    ar: 'قيمة العداد',
  },
  'cs.mp.meterPanel.isReset': {
    tr: 'Sayaç değişti/sıfırlandı',
    en: 'Meter changed/reset',
    de: 'Zähler gewechselt/zurückgesetzt',
    ar: 'تغير العداد/صُفّر',
  },
  'cs.mp.meterPanel.log': {
    tr: 'Sayaç günlüğü',
    en: 'Meter log',
    de: 'Zählerjournal',
    ar: 'سجل العداد',
  },
  'cs.mp.plan.title': {
    tr: 'Bakım planları',
    en: 'Maintenance plans',
    de: 'Wartungspläne',
    ar: 'خطط الصيانة',
  },
  'cs.mp.plan.new': {
    tr: '+ Bakım planı',
    en: '+ Maintenance plan',
    de: '+ Wartungsplan',
    ar: '+ خطة صيانة',
  },
  'cs.mp.plan.name': {
    tr: 'Plan adı',
    en: 'Plan name',
    de: 'Planname',
    ar: 'اسم الخطة',
  },
  'cs.mp.plan.intervalType': {
    tr: 'Aralık tipi',
    en: 'Interval type',
    de: 'Intervalltyp',
    ar: 'نوع الفترة',
  },
  'cs.mp.plan.intervalValue': {
    tr: 'Aralık',
    en: 'Interval',
    de: 'Intervall',
    ar: 'الفترة',
  },
  'cs.mp.plan.it.meter': {
    tr: 'Sayaç bazlı',
    en: 'Meter-based',
    de: 'Zählerbasiert',
    ar: 'حسب العداد',
  },
  'cs.mp.plan.it.days': {
    tr: 'Gün bazlı',
    en: 'Day-based',
    de: 'Tagesbasiert',
    ar: 'حسب الأيام',
  },
  'cs.mp.plan.lastDone': {
    tr: 'Son yapılan',
    en: 'Last done',
    de: 'Zuletzt erledigt',
    ar: 'آخر تنفيذ',
  },
  'cs.mp.plan.nextDue': {
    tr: 'Sıradaki vade',
    en: 'Next due',
    de: 'Nächste Fälligkeit',
    ar: 'الاستحقاق التالي',
  },
  'cs.mp.plan.remaining': {
    tr: 'Kalan',
    en: 'Remaining',
    de: 'Verbleibend',
    ar: 'المتبقي',
  },
  'cs.mp.plan.noBaseline': {
    tr: 'İlk bakım kaydı bekleniyor — vade hesaplanamıyor',
    en: 'Waiting for the first maintenance record — due cannot be computed',
    de: 'Erster Wartungseintrag ausstehend — Fälligkeit nicht berechenbar',
    ar: 'بانتظار أول سجل صيانة — لا يمكن حساب الاستحقاق',
  },
  'cs.mp.plan.baselineHint': {
    tr: 'Son yapılan bakım izi (sayaç/tarih) girilirse vade hemen hesaplanır; boş bırakılırsa ilk bakım kaydına kadar vade gösterilmez — uydurma vade yazılmaz.',
    en: 'If the last-done trail (meter/date) is entered the due is computed at once; if left empty no due is shown until the first record — no fabricated due dates.',
    de: 'Wird die Zuletzt-erledigt-Spur (Zähler/Datum) erfasst, wird die Fälligkeit sofort berechnet; sonst wird bis zum ersten Eintrag keine angezeigt — keine erfundenen Fälligkeiten.',
    ar: 'إذا أُدخل أثر آخر تنفيذ (عداد/تاريخ) يُحسب الاستحقاق فورًا؛ وإلا فلا يُعرض حتى أول سجل — لا استحقاقات مختلقة.',
  },
  'cs.mp.plan.overdue': {
    tr: 'VADE GEÇMİŞ',
    en: 'OVERDUE',
    de: 'ÜBERFÄLLIG',
    ar: 'متأخر',
  },
  'cs.mp.plan.deleteConfirm': {
    tr: 'Bakım planı kaldırılsın mı? Yapılmış bakım kayıtları denetim izi olarak kalır.',
    en: 'Remove this maintenance plan? Completed records remain as an audit trail.',
    de: 'Diesen Wartungsplan entfernen? Erledigte Einträge bleiben als Prüfpfad erhalten.',
    ar: 'هل تُزال خطة الصيانة؟ تبقى سجلات الصيانة المنجزة كأثر تدقيق.',
  },
  'cs.mp.rec.title': {
    tr: 'Bakım kayıtları',
    en: 'Maintenance records',
    de: 'Wartungseinträge',
    ar: 'سجلات الصيانة',
  },
  'cs.mp.rec.new': {
    tr: '+ Bakım kaydı',
    en: '+ Maintenance record',
    de: '+ Wartungseintrag',
    ar: '+ سجل صيانة',
  },
  'cs.mp.rec.plan': {
    tr: 'Bağlı plan',
    en: 'Linked plan',
    de: 'Verknüpfter Plan',
    ar: 'الخطة المرتبطة',
  },
  'cs.mp.rec.planNone': {
    tr: 'Plansız (arıza/tek seferlik)',
    en: 'Unplanned (breakdown/one-off)',
    de: 'Ungeplant (Störung/einmalig)',
    ar: 'بدون خطة (عطل/مرة واحدة)',
  },
  'cs.mp.rec.doneAt': {
    tr: 'Yapıldığı tarih',
    en: 'Done on',
    de: 'Erledigt am',
    ar: 'تاريخ التنفيذ',
  },
  'cs.mp.rec.meterAt': {
    tr: 'Bakımdaki sayaç',
    en: 'Meter at service',
    de: 'Zählerstand bei Wartung',
    ar: 'العداد عند الصيانة',
  },
  'cs.mp.rec.cost': {
    tr: 'Maliyet',
    en: 'Cost',
    de: 'Kosten',
    ar: 'التكلفة',
  },
  'cs.mp.rec.hint': {
    tr: 'Plana bağlı kayıt planın vadesini ilerletir. Sayaç girilirse aynı işlemde sayaç okuması olarak da işlenir — bakımda sayaç zaten okunur.',
    en: 'A record linked to a plan advances its due. If a meter is entered it is also processed as a meter reading — the meter is read during maintenance anyway.',
    de: 'Ein planbezogener Eintrag verschiebt dessen Fälligkeit. Ein erfasster Zählerstand wird zugleich als Zählerablesung verarbeitet — bei der Wartung wird der Zähler ohnehin abgelesen.',
    ar: 'السجل المرتبط بخطة يقدّم استحقاقها. إذا أُدخل العداد يُعالج كقراءة عداد في العملية نفسها — العداد يُقرأ أثناء الصيانة أصلًا.',
  },
  'cs.mp.empty': {
    tr: 'Bu şirkette makine yok. Makineler İş Gücü & Makine ekranından açılır.',
    en: 'No machines in this company. Machines are created on the Labour & Machines screen.',
    de: 'Keine Maschinen in dieser Firma. Maschinen werden im Bildschirm Personal & Maschinen angelegt.',
    ar: 'لا توجد آلات في هذه الشركة. تُنشأ الآلات من شاشة العمالة والآلات.',
  },
  'cs.mp.detailsPanel': {
    tr: 'Kart detayları',
    en: 'Card details',
    de: 'Kartendetails',
    ar: 'تفاصيل البطاقة',
  },
  'cs.us.title': {
    tr: 'Konut Satış',
    en: 'Unit Sales',
    de: 'Wohnungsverkauf',
    ar: 'مبيعات الوحدات',
  },
  'cs.us.subtitle': {
    tr: "Bağımsız bölüm envanteri, satış durumu, tahsilat ve müşteri değişiklik istekleri. Daireler mekân ağacından gelir; müşteri ilişkisi Satış CRM'de yürür.",
    en: 'Unit inventory, sale status, collections and customer change requests. Units come from the location tree; the customer relationship lives in Sales CRM.',
    de: 'Wohnungsbestand, Verkaufsstatus, Zahlungseingänge und Kundenänderungswünsche. Einheiten stammen aus dem Standortbaum; die Kundenbeziehung läuft im Vertriebs-CRM.',
    ar: 'مخزون الوحدات وحالة البيع والتحصيلات وطلبات تغيير العملاء. تأتي الوحدات من شجرة المواقع؛ وعلاقة العميل تدار في نظام CRM للمبيعات.',
  },
  'cs.us.empty': {
    tr: 'Bu projede bağımsız bölüm yok. Daireler Mekân Kırılımı ekranında (blok/kat/daire) tanımlanır.',
    en: 'This project has no units. Units are defined on the Location Breakdown screen (block/floor/unit).',
    de: 'Dieses Projekt hat keine Einheiten. Einheiten werden im Bildschirm Standortstruktur (Block/Etage/Einheit) definiert.',
    ar: 'لا توجد وحدات في هذا المشروع. تُعرَّف الوحدات في شاشة تقسيم المواقع (بلوك/طابق/وحدة).',
  },
  'cs.us.barterInfo': {
    tr: 'İş karşılığı verilen daire nakit girişi değildir; taşeron borcunu mahsup eder ve satılan ciroda ayrı gösterilir.',
    en: 'A unit given in exchange for work is not cash income; it offsets the subcontractor payable and is reported separately from sold value.',
    de: 'Eine gegen Leistung übergebene Einheit ist kein Bareingang; sie verrechnet die Nachunternehmer-Verbindlichkeit und wird getrennt vom Verkaufswert ausgewiesen.',
    ar: 'الوحدة الممنوحة مقابل العمل ليست دخلاً نقدياً؛ بل تُخصم من مستحقات المقاول من الباطن وتُعرض منفصلة عن قيمة المبيعات.',
  },
  'cs.us.sum.units': {
    tr: 'Toplam Daire',
    en: 'Total Units',
    de: 'Einheiten gesamt',
    ar: 'إجمالي الوحدات',
  },
  'cs.us.sum.available': {
    tr: 'Satışta',
    en: 'Available',
    de: 'Verfügbar',
    ar: 'متاح للبيع',
  },
  'cs.us.sum.reserved': {
    tr: 'Rezerve',
    en: 'Reserved',
    de: 'Reserviert',
    ar: 'محجوز',
  },
  'cs.us.sum.sold': {
    tr: 'Satıldı',
    en: 'Sold',
    de: 'Verkauft',
    ar: 'مباع',
  },
  'cs.us.sum.barter': {
    tr: 'İş Karşılığı',
    en: 'Barter (for work)',
    de: 'Gegenleistung',
    ar: 'مقابل العمل',
  },
  'cs.us.sum.soldValue': {
    tr: 'Satış Değeri',
    en: 'Sold Value',
    de: 'Verkaufswert',
    ar: 'قيمة المبيعات',
  },
  'cs.us.sum.barterValue': {
    tr: 'İş Karşılığı Bedeli',
    en: 'Barter Value',
    de: 'Gegenleistungswert',
    ar: 'قيمة مقابل العمل',
  },
  'cs.us.sum.collected': {
    tr: 'Tahsilat',
    en: 'Collected',
    de: 'Eingezogen',
    ar: 'المحصَّل',
  },
  'cs.us.sum.remaining': {
    tr: 'Kalan',
    en: 'Remaining',
    de: 'Offen',
    ar: 'المتبقي',
  },
  'cs.us.sum.refundLiability': {
    tr: 'İade Yükümlülüğü',
    en: 'Refund Liability',
    de: 'Erstattungsverpflichtung',
    ar: 'التزام الاسترداد',
  },
  'cs.us.sum.unpriced': {
    tr: '{n} boş dairenin liste fiyatı girilmemiş',
    en: '{n} available unit(s) have no list price',
    de: '{n} verfügbare Einheit(en) ohne Listenpreis',
    ar: '{n} وحدة متاحة بدون سعر معلن',
  },
  'cs.us.sum.openCr': {
    tr: 'Açık Değişiklik İsteği',
    en: 'Open Change Requests',
    de: 'Offene Änderungswünsche',
    ar: 'طلبات تغيير مفتوحة',
  },
  'cs.us.sum.cancelled': {
    tr: 'İptal Edilen Satış',
    en: 'Cancelled Sales',
    de: 'Stornierte Verkäufe',
    ar: 'مبيعات ملغاة',
  },
  'cs.us.sum.availableListValue': {
    tr: 'Boş Daire Liste Değeri',
    en: 'Available List Value',
    de: 'Listenwert verfügbarer Einheiten',
    ar: 'القيمة المعلنة للوحدات المتاحة',
  },
  'cs.us.st.available': {
    tr: 'Satışta',
    en: 'Available',
    de: 'Verfügbar',
    ar: 'متاح',
  },
  'cs.us.st.reserved': {
    tr: 'Rezerve',
    en: 'Reserved',
    de: 'Reserviert',
    ar: 'محجوز',
  },
  'cs.us.st.sold': {
    tr: 'Satıldı',
    en: 'Sold',
    de: 'Verkauft',
    ar: 'مباع',
  },
  'cs.us.st.barter': {
    tr: 'İş Karşılığı',
    en: 'Barter',
    de: 'Gegenleistung',
    ar: 'مقابل العمل',
  },
  'cs.us.st.cancelled': {
    tr: 'İptal',
    en: 'Cancelled',
    de: 'Storniert',
    ar: 'ملغى',
  },
  'cs.us.f.unit': {
    tr: 'Daire',
    en: 'Unit',
    de: 'Einheit',
    ar: 'الوحدة',
  },
  'cs.us.f.type': {
    tr: 'Tip',
    en: 'Type',
    de: 'Typ',
    ar: 'النوع',
  },
  'cs.us.f.area': {
    tr: 'Brüt m²',
    en: 'Gross m²',
    de: 'Brutto m²',
    ar: 'م² إجمالي',
  },
  'cs.us.f.listPrice': {
    tr: 'Liste Fiyatı',
    en: 'List Price',
    de: 'Listenpreis',
    ar: 'السعر المعلن',
  },
  'cs.us.f.salePrice': {
    tr: 'Satış Fiyatı',
    en: 'Sale Price',
    de: 'Verkaufspreis',
    ar: 'سعر البيع',
  },
  'cs.us.f.discount': {
    tr: 'İskonto',
    en: 'Discount',
    de: 'Nachlass',
    ar: 'الخصم',
  },
  'cs.us.f.buyer': {
    tr: 'Alıcı / Taşeron',
    en: 'Buyer / Vendor',
    de: 'Käufer / Nachunternehmer',
    ar: 'المشتري / المقاول',
  },
  'cs.us.f.collected': {
    tr: 'Tahsilat',
    en: 'Collected',
    de: 'Eingezogen',
    ar: 'المحصَّل',
  },
  'cs.us.f.remaining': {
    tr: 'Kalan',
    en: 'Remaining',
    de: 'Offen',
    ar: 'المتبقي',
  },
  'cs.us.f.openCr': {
    tr: 'Değişiklik',
    en: 'Changes',
    de: 'Änderungen',
    ar: 'التغييرات',
  },
  'cs.us.price.edit': {
    tr: 'Liste fiyatı gir',
    en: 'Set list price',
    de: 'Listenpreis erfassen',
    ar: 'إدخال السعر المعلن',
  },
  'cs.us.price.hint': {
    tr: 'Defterdeki fiyat — satış anında kayda donar, sonradan değişse tarihi iskonto oynamaz.',
    en: 'Price book value — frozen into the sale record at sale time; later changes do not rewrite historical discounts.',
    de: 'Preisbuchwert — wird beim Verkauf im Datensatz eingefroren; spätere Änderungen verändern historische Nachlässe nicht.',
    ar: 'قيمة دفتر الأسعار — تُثبَّت في سجل البيع لحظة البيع؛ ولا تغيّر التعديلات اللاحقة الخصومات التاريخية.',
  },
  'cs.us.form.new': {
    tr: 'Satış / Rezervasyon',
    en: 'Sale / Reservation',
    de: 'Verkauf / Reservierung',
    ar: 'بيع / حجز',
  },
  'cs.us.form.status': {
    tr: 'Durum',
    en: 'Status',
    de: 'Status',
    ar: 'الحالة',
  },
  'cs.us.form.buyer': {
    tr: 'Alıcı adı',
    en: 'Buyer name',
    de: 'Käufername',
    ar: 'اسم المشتري',
  },
  'cs.us.form.vendor': {
    tr: 'Taşeron No (İş Karşılığı)',
    en: 'Vendor ID (barter)',
    de: 'Nachunternehmer-Nr. (Gegenleistung)',
    ar: 'رقم المقاول (مقابل العمل)',
  },
  'cs.us.form.vendorHint': {
    tr: 'İş karşılığında daire taşerona hakediş yerine verilir — taşeron zorunludur.',
    en: 'In a barter sale the unit is given to a subcontractor in lieu of payment — the vendor is mandatory.',
    de: 'Bei Gegenleistung wird die Einheit dem Nachunternehmer anstelle der Zahlung übergeben — der Nachunternehmer ist Pflicht.',
    ar: 'في البيع مقابل العمل تُمنح الوحدة للمقاول بدلاً من الدفع — تحديد المقاول إلزامي.',
  },
  'cs.us.form.listPrice': {
    tr: 'Liste fiyatı (boşsa defterden)',
    en: 'List price (from price book if empty)',
    de: 'Listenpreis (leer = aus Preisbuch)',
    ar: 'السعر المعلن (من الدفتر إن تُرك فارغاً)',
  },
  'cs.us.form.listPriceHint': {
    tr: 'Boş bırakılırsa defterdeki liste fiyatı satışa donar.',
    en: 'If left empty, the price book value is frozen into the sale.',
    de: 'Bleibt das Feld leer, wird der Preisbuchwert im Verkauf eingefroren.',
    ar: 'إذا تُرك فارغاً يُثبَّت سعر الدفتر في سجل البيع.',
  },
  'cs.us.form.salePrice': {
    tr: 'Satış fiyatı',
    en: 'Sale price',
    de: 'Verkaufspreis',
    ar: 'سعر البيع',
  },
  'cs.us.form.reservedAt': {
    tr: 'Rezervasyon tarihi',
    en: 'Reservation date',
    de: 'Reservierungsdatum',
    ar: 'تاريخ الحجز',
  },
  'cs.us.form.soldAt': {
    tr: 'Satış tarihi',
    en: 'Sale date',
    de: 'Verkaufsdatum',
    ar: 'تاريخ البيع',
  },
  'cs.us.form.create': {
    tr: 'Kaydet',
    en: 'Save',
    de: 'Speichern',
    ar: 'حفظ',
  },
  'cs.us.det.title': {
    tr: 'Satış Detayı',
    en: 'Sale Detail',
    de: 'Verkaufsdetail',
    ar: 'تفاصيل البيع',
  },
  'cs.us.det.source': {
    tr: 'Kaynak',
    en: 'Source',
    de: 'Quelle',
    ar: 'المصدر',
  },
  'cs.us.det.refNo': {
    tr: 'CRM referansı',
    en: 'CRM reference',
    de: 'CRM-Referenz',
    ar: 'مرجع CRM',
  },
  'cs.us.det.frozenList': {
    tr: 'Satış anındaki liste fiyatı',
    en: 'List price at sale time',
    de: 'Listenpreis zum Verkaufszeitpunkt',
    ar: 'السعر المعلن لحظة البيع',
  },
  'cs.us.det.cancelNote': {
    tr: 'İptal gerekçesi',
    en: 'Cancellation reason',
    de: 'Stornogrund',
    ar: 'سبب الإلغاء',
  },
  'cs.us.det.cancelPrompt': {
    tr: 'İptal gerekçesi (zorunlu)',
    en: 'Cancellation reason (required)',
    de: 'Stornogrund (Pflicht)',
    ar: 'سبب الإلغاء (إلزامي)',
  },
  'cs.us.det.needNote': {
    tr: 'İptal için gerekçe yazın — daire envantere dönerken "neden boşaldı" sorusunun cevabı burada durur.',
    en: 'Enter a reason to cancel — when the unit returns to inventory, this is where "why did it free up" is answered.',
    de: 'Geben Sie einen Stornogrund an — kehrt die Einheit in den Bestand zurück, steht die Antwort auf „warum" hier.',
    ar: 'اكتب سبب الإلغاء — عند عودة الوحدة إلى المخزون تبقى إجابة «لماذا أُخليت» هنا.',
  },
  'cs.us.tr.sold': {
    tr: 'Satışa çevir',
    en: 'Mark as sold',
    de: 'Als verkauft markieren',
    ar: 'تحويل إلى مباع',
  },
  'cs.us.tr.barter': {
    tr: 'İş karşılığına çevir',
    en: 'Convert to barter',
    de: 'In Gegenleistung umwandeln',
    ar: 'تحويل إلى مقابل العمل',
  },
  'cs.us.tr.cancelled': {
    tr: 'İptal et',
    en: 'Cancel sale',
    de: 'Stornieren',
    ar: 'إلغاء',
  },
  'cs.us.pay.title': {
    tr: 'Tahsilat',
    en: 'Collections',
    de: 'Zahlungseingänge',
    ar: 'التحصيلات',
  },
  'cs.us.pay.add': {
    tr: 'Tahsilat ekle',
    en: 'Add payment',
    de: 'Zahlung erfassen',
    ar: 'إضافة دفعة',
  },
  'cs.us.pay.kind': {
    tr: 'Tür',
    en: 'Kind',
    de: 'Art',
    ar: 'النوع',
  },
  'cs.us.pay.kind.collection': {
    tr: 'Tahsilat',
    en: 'Collection',
    de: 'Einzahlung',
    ar: 'تحصيل',
  },
  'cs.us.pay.kind.refund': {
    tr: 'İade',
    en: 'Refund',
    de: 'Erstattung',
    ar: 'استرداد',
  },
  'cs.us.pay.method': {
    tr: 'Yöntem',
    en: 'Method',
    de: 'Methode',
    ar: 'الطريقة',
  },
  'cs.us.pay.method.cash': {
    tr: 'Nakit',
    en: 'Cash',
    de: 'Bar',
    ar: 'نقداً',
  },
  'cs.us.pay.method.bank': {
    tr: 'Banka',
    en: 'Bank',
    de: 'Bank',
    ar: 'بنك',
  },
  'cs.us.pay.method.cheque': {
    tr: 'Çek',
    en: 'Cheque',
    de: 'Scheck',
    ar: 'شيك',
  },
  'cs.us.pay.method.other': {
    tr: 'Diğer',
    en: 'Other',
    de: 'Sonstiges',
    ar: 'أخرى',
  },
  'cs.us.pay.date': {
    tr: 'Tarih',
    en: 'Date',
    de: 'Datum',
    ar: 'التاريخ',
  },
  'cs.us.pay.amount': {
    tr: 'Tutar',
    en: 'Amount',
    de: 'Betrag',
    ar: 'المبلغ',
  },
  'cs.us.pay.none': {
    tr: 'Henüz tahsilat yok.',
    en: 'No payments yet.',
    de: 'Noch keine Zahlungen.',
    ar: 'لا توجد دفعات بعد.',
  },
  'cs.us.pay.deleteConfirm': {
    tr: 'Bu tahsilat satırı silinsin mi?',
    en: 'Delete this payment row?',
    de: 'Diese Zahlungszeile löschen?',
    ar: 'هل تريد حذف سطر الدفعة هذا؟',
  },
  'cs.us.cr.title': {
    tr: 'Değişiklik İstekleri',
    en: 'Change Requests',
    de: 'Änderungswünsche',
    ar: 'طلبات التغيير',
  },
  'cs.us.cr.add': {
    tr: 'İstek ekle',
    en: 'Add request',
    de: 'Wunsch erfassen',
    ar: 'إضافة طلب',
  },
  'cs.us.cr.field.title': {
    tr: 'Başlık',
    en: 'Title',
    de: 'Titel',
    ar: 'العنوان',
  },
  'cs.us.cr.field.desc': {
    tr: 'Açıklama',
    en: 'Description',
    de: 'Beschreibung',
    ar: 'الوصف',
  },
  'cs.us.cr.field.cost': {
    tr: 'Bedel',
    en: 'Cost',
    de: 'Kosten',
    ar: 'التكلفة',
  },
  'cs.us.cr.costFrozenHint': {
    tr: 'Onaylanan bedel sözleşmeseldir ve kaleme donar; fiyat değişecekse yeni istek açılır.',
    en: 'An approved cost is contractual and frozen; open a new request to change the price.',
    de: 'Genehmigte Kosten sind vertraglich und eingefroren; für Preisänderungen neuen Wunsch anlegen.',
    ar: 'التكلفة المعتمدة تعاقدية ومثبتة؛ لتغيير السعر يُفتح طلب جديد.',
  },
  'cs.us.cr.approve': {
    tr: 'Onayla',
    en: 'Approve',
    de: 'Genehmigen',
    ar: 'اعتماد',
  },
  'cs.us.cr.reject': {
    tr: 'Reddet',
    en: 'Reject',
    de: 'Ablehnen',
    ar: 'رفض',
  },
  'cs.us.cr.done': {
    tr: 'Tamamlandı',
    en: 'Done',
    de: 'Erledigt',
    ar: 'تم',
  },
  'cs.us.cr.rejectNote': {
    tr: 'Red gerekçesi (zorunlu)',
    en: 'Rejection reason (required)',
    de: 'Ablehnungsgrund (Pflicht)',
    ar: 'سبب الرفض (إلزامي)',
  },
  'cs.us.cr.none': {
    tr: 'Değişiklik isteği yok.',
    en: 'No change requests.',
    de: 'Keine Änderungswünsche.',
    ar: 'لا توجد طلبات تغيير.',
  },
  'cs.us.cr.st.open': {
    tr: 'Açık',
    en: 'Open',
    de: 'Offen',
    ar: 'مفتوح',
  },
  'cs.us.cr.st.approved': {
    tr: 'Onaylı',
    en: 'Approved',
    de: 'Genehmigt',
    ar: 'معتمد',
  },
  'cs.us.cr.st.rejected': {
    tr: 'Reddedildi',
    en: 'Rejected',
    de: 'Abgelehnt',
    ar: 'مرفوض',
  },
  'cs.us.cr.st.done': {
    tr: 'Tamamlandı',
    en: 'Done',
    de: 'Erledigt',
    ar: 'منجز',
  },
  'cs.cb.title': {
    tr: 'İşbirliği',
    en: 'Collaboration',
    de: 'Zusammenarbeit',
    ar: 'التعاون',
  },
  'cs.cb.subtitle': {
    tr: 'Duyuru panosu, proje ekibi, okunma bilgisi ve galeri. Okunma oranının paydası açık bilgilendirme listesi ya da aktif ekiptir.',
    en: 'Announcement board, project team, read receipts and gallery. The read-rate denominator is the explicit notify list or the active team.',
    de: 'Schwarzes Brett, Projektteam, Lesebestätigungen und Galerie. Nenner der Lesequote ist die explizite Verteilerliste oder das aktive Team.',
    ar: 'لوحة الإعلانات وفريق المشروع وإيصالات القراءة والمعرض. مقام نسبة القراءة هو قائمة الإبلاغ الصريحة أو الفريق النشط.',
  },
  'cs.cb.tab.wall': {
    tr: 'Duyuru Panosu',
    en: 'Board',
    de: 'Schwarzes Brett',
    ar: 'لوحة الإعلانات',
  },
  'cs.cb.tab.team': {
    tr: 'Proje Ekibi',
    en: 'Project Team',
    de: 'Projektteam',
    ar: 'فريق المشروع',
  },
  'cs.cb.tab.gallery': {
    tr: 'Galeri',
    en: 'Gallery',
    de: 'Galerie',
    ar: 'المعرض',
  },
  'cs.cb.wall.new': {
    tr: 'Yeni duyuru',
    en: 'New post',
    de: 'Neuer Beitrag',
    ar: 'منشور جديد',
  },
  'cs.cb.wall.titleField': {
    tr: 'Başlık (isteğe bağlı)',
    en: 'Title (optional)',
    de: 'Titel (optional)',
    ar: 'العنوان (اختياري)',
  },
  'cs.cb.wall.bodyField': {
    tr: 'Metin',
    en: 'Body',
    de: 'Text',
    ar: 'النص',
  },
  'cs.cb.wall.pin': {
    tr: 'Sabitle',
    en: 'Pin',
    de: 'Anheften',
    ar: 'تثبيت',
  },
  'cs.cb.wall.pinned': {
    tr: 'Sabit',
    en: 'Pinned',
    de: 'Angeheftet',
    ar: 'مثبت',
  },
  'cs.cb.wall.recipients': {
    tr: 'Bilgilendirme listesi (isteğe bağlı)',
    en: 'Notify list (optional)',
    de: 'Verteilerliste (optional)',
    ar: 'قائمة الإبلاغ (اختياري)',
  },
  'cs.cb.wall.recipientsHint': {
    tr: 'Boş bırakılırsa hedef kitle tüm aktif ekiptir; seçilirse okunma oranı yalnız seçilenler üzerinden hesaplanır.',
    en: 'If left empty the audience is the whole active team; if set, the read rate is computed over the selected people only.',
    de: 'Bleibt sie leer, ist die Zielgruppe das gesamte aktive Team; sonst wird die Lesequote nur über die Ausgewählten berechnet.',
    ar: 'إذا تُركت فارغة يكون الجمهور كل الفريق النشط؛ وإذا حُددت تُحسب نسبة القراءة على المحددين فقط.',
  },
  'cs.cb.wall.publish': {
    tr: 'Yayınla',
    en: 'Publish',
    de: 'Veröffentlichen',
    ar: 'نشر',
  },
  'cs.cb.wall.empty': {
    tr: 'Bu projede duyuru yok.',
    en: 'No posts in this project.',
    de: 'Keine Beiträge in diesem Projekt.',
    ar: 'لا توجد منشورات في هذا المشروع.',
  },
  'cs.cb.wall.edited': {
    tr: 'düzenlendi',
    en: 'edited',
    de: 'bearbeitet',
    ar: 'عُدِّل',
  },
  'cs.cb.wall.readStats': {
    tr: '{read}/{total} okudu',
    en: '{read}/{total} read',
    de: '{read}/{total} gelesen',
    ar: 'قرأه {read}/{total}',
  },
  'cs.cb.wall.readPctUnknown': {
    tr: 'Hedef kitle tanımsız — ekip boş ve liste yok',
    en: 'Audience undefined — team empty and no list',
    de: 'Zielgruppe undefiniert — Team leer und keine Liste',
    ar: 'الجمهور غير محدد — الفريق فارغ ولا توجد قائمة',
  },
  'cs.cb.wall.readers': {
    tr: 'Okuyanlar',
    en: 'Readers',
    de: 'Gelesen von',
    ar: 'القرّاء',
  },
  'cs.cb.wall.noReaders': {
    tr: 'Henüz okuyan yok.',
    en: 'No readers yet.',
    de: 'Noch niemand hat gelesen.',
    ar: 'لا قرّاء بعد.',
  },
  'cs.cb.wall.comments': {
    tr: 'Yorumlar',
    en: 'Comments',
    de: 'Kommentare',
    ar: 'التعليقات',
  },
  'cs.cb.wall.addComment': {
    tr: 'Yorum yaz…',
    en: 'Write a comment…',
    de: 'Kommentar schreiben…',
    ar: 'اكتب تعليقاً…',
  },
  'cs.cb.wall.deleteConfirm': {
    tr: 'Bu duyuru silinsin mi? Okunma izi korunur (yumuşak silme).',
    en: 'Delete this post? Read trail is kept (soft delete).',
    de: 'Diesen Beitrag löschen? Lesespur bleibt erhalten (Soft Delete).',
    ar: 'هل تريد حذف هذا المنشور؟ يُحتفظ بسجل القراءة (حذف ناعم).',
  },
  'cs.cb.wall.unpin': {
    tr: 'Sabitlemeyi kaldır',
    en: 'Unpin',
    de: 'Lösen',
    ar: 'إلغاء التثبيت',
  },
  'cs.cb.wall.myUnread': {
    tr: 'Okumadınız',
    en: 'Unread',
    de: 'Ungelesen',
    ar: 'غير مقروء',
  },
  'cs.cb.team.add': {
    tr: 'Üye ekle',
    en: 'Add member',
    de: 'Mitglied hinzufügen',
    ar: 'إضافة عضو',
  },
  'cs.cb.team.userId': {
    tr: 'Kullanıcı No',
    en: 'User ID',
    de: 'Benutzer-Nr.',
    ar: 'رقم المستخدم',
  },
  'cs.cb.team.name': {
    tr: 'Görünen ad',
    en: 'Display name',
    de: 'Anzeigename',
    ar: 'الاسم الظاهر',
  },
  'cs.cb.team.role': {
    tr: 'Rol',
    en: 'Role',
    de: 'Rolle',
    ar: 'الدور',
  },
  'cs.cb.team.titleField': {
    tr: 'Unvan',
    en: 'Title',
    de: 'Titel',
    ar: 'اللقب',
  },
  'cs.cb.team.remove': {
    tr: 'Çıkar',
    en: 'Remove',
    de: 'Entfernen',
    ar: 'إزالة',
  },
  'cs.cb.team.removeConfirm': {
    tr: 'Üye ekipten çıkarılsın mı? Okuma/yorum izi korunur; okunma paydasından düşer.',
    en: 'Remove member from the team? Read/comment trail is kept; they leave the read denominator.',
    de: 'Mitglied aus dem Team entfernen? Lese-/Kommentarspur bleibt; fällt aus dem Lesequoten-Nenner.',
    ar: 'هل تريد إزالة العضو من الفريق؟ يُحتفظ بسجل القراءة/التعليق؛ ويُستبعد من مقام نسبة القراءة.',
  },
  'cs.cb.team.empty': {
    tr: 'Proje ekibi boş. Ekip, duyuruların okunma oranının paydasıdır.',
    en: 'The project team is empty. The team is the denominator of post read rates.',
    de: 'Das Projektteam ist leer. Das Team ist der Nenner der Lesequoten.',
    ar: 'فريق المشروع فارغ. الفريق هو مقام نسب قراءة المنشورات.',
  },
  'cs.cb.team.denomHint': {
    tr: 'Geri dönen üye aynı kaydı canlandırır — payda şişmez.',
    en: 'A returning member revives the same record — the denominator does not inflate.',
    de: 'Ein zurückkehrendes Mitglied reaktiviert denselben Datensatz — der Nenner bläht nicht auf.',
    ar: 'العضو العائد يعيد تفعيل السجل نفسه — لا يتضخم المقام.',
  },
  'cs.cb.role.manager': {
    tr: 'Proje Müdürü',
    en: 'Project Manager',
    de: 'Projektleiter',
    ar: 'مدير المشروع',
  },
  'cs.cb.role.engineer': {
    tr: 'Mühendis',
    en: 'Engineer',
    de: 'Ingenieur',
    ar: 'مهندس',
  },
  'cs.cb.role.site_chief': {
    tr: 'Şantiye Şefi',
    en: 'Site Chief',
    de: 'Bauleiter',
    ar: 'رئيس الموقع',
  },
  'cs.cb.role.foreman': {
    tr: 'Formen',
    en: 'Foreman',
    de: 'Polier',
    ar: 'ملاحظ عمال',
  },
  'cs.cb.role.accountant': {
    tr: 'Muhasebe',
    en: 'Accountant',
    de: 'Buchhaltung',
    ar: 'محاسب',
  },
  'cs.cb.role.viewer': {
    tr: 'İzleyici',
    en: 'Viewer',
    de: 'Beobachter',
    ar: 'مشاهد',
  },
  'cs.cb.role.other': {
    tr: 'Diğer',
    en: 'Other',
    de: 'Sonstige',
    ar: 'أخرى',
  },
  'cs.cb.gal.add': {
    tr: 'Fotoğraf ekle',
    en: 'Add photo',
    de: 'Foto hinzufügen',
    ar: 'إضافة صورة',
  },
  'cs.cb.gal.titleField': {
    tr: 'Açıklama',
    en: 'Caption',
    de: 'Beschreibung',
    ar: 'الوصف',
  },
  'cs.cb.gal.takenAt': {
    tr: 'Çekim tarihi',
    en: 'Taken at',
    de: 'Aufnahmedatum',
    ar: 'تاريخ الالتقاط',
  },
  'cs.cb.gal.location': {
    tr: 'Mekân No (isteğe bağlı)',
    en: 'Location ID (optional)',
    de: 'Standort-Nr. (optional)',
    ar: 'رقم الموقع (اختياري)',
  },
  'cs.cb.gal.locationHint': {
    tr: 'Fotoğrafı mekân ağacına bağlar — "hangi blokta/dairede" sorusu galeriyi rapora bağlar.',
    en: 'Links the photo to the location tree — "which block/unit" ties the gallery to reports.',
    de: 'Verknüpft das Foto mit dem Standortbaum — „welcher Block/welche Einheit" verbindet Galerie und Berichte.',
    ar: 'يربط الصورة بشجرة المواقع — سؤال «أي بلوك/وحدة» يربط المعرض بالتقارير.',
  },
  'cs.cb.gal.file': {
    tr: 'Dosya',
    en: 'File',
    de: 'Datei',
    ar: 'الملف',
  },
  'cs.cb.gal.url': {
    tr: 'ya da URL',
    en: 'or URL',
    de: 'oder URL',
    ar: 'أو رابط',
  },
  'cs.cb.gal.empty': {
    tr: 'Galeride fotoğraf yok.',
    en: 'No photos in the gallery.',
    de: 'Keine Fotos in der Galerie.',
    ar: 'لا توجد صور في المعرض.',
  },
  'cs.cb.gal.deleteConfirm': {
    tr: 'Fotoğraf galeriden kaldırılsın mı?',
    en: 'Remove the photo from the gallery?',
    de: 'Foto aus der Galerie entfernen?',
    ar: 'هل تريد إزالة الصورة من المعرض؟',
  },
  'cs.cb.gal.needPayload': {
    tr: 'Dosya seçin ya da URL girin.',
    en: 'Pick a file or enter a URL.',
    de: 'Datei wählen oder URL eingeben.',
    ar: 'اختر ملفاً أو أدخل رابطاً.',
  },
  'cs.cb.gal.external': {
    tr: 'Dış bağlantı',
    en: 'External link',
    de: 'Externer Link',
    ar: 'رابط خارجي',
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

/** Onay akışının bağlı olduğu belge tipi etiketi. */
export function approvalDocKindLabel(kind: string, lang: string | undefined): string {
  return csT(`cs.apr.kind.${kind}` as CsLabelKey, lang);
}

/** Akış durumu etiketi. */
export function approvalStatusLabel(status: string, lang: string | undefined): string {
  return csT(`cs.apr.status.${status}` as CsLabelKey, lang);
}

/** Adım kararı etiketi ('delegated' onay sayılır ama ayrı gösterilir). */
export function approvalDecisionLabel(decision: string, lang: string | undefined): string {
  return csT(`cs.apr.dec.${decision}` as CsLabelKey, lang);
}

/** Akış tipi etiketi (sıralı/sırasız). */
export function approvalModeLabel(mode: string, lang: string | undefined): string {
  return mode === 'unordered'
    ? csT('cs.apr.mode.unordered', lang)
    : csT('cs.apr.mode.ordered', lang);
}

/** Karar izi satırının eylem etiketi; bilinmeyen eylem ham haliyle gösterilir. */
export function approvalHistoryActionLabel(action: string, lang: string | undefined): string {
  switch (action) {
    case 'created':
      return csT('cs.apr.hist.created', lang);
    case 'approved':
      return csT('cs.apr.hist.approved', lang);
    case 'rejected':
      return csT('cs.apr.hist.rejected', lang);
    case 'cancelled':
      return csT('cs.apr.hist.cancelled', lang);
    default:
      return action;
  }
}

/** Hasar tipi etiketi. */
export function defectKindLabel(kind: string, lang: string | undefined): string {
  return csT(`cs.qg.dk.${kind}` as CsLabelKey, lang);
}

/** Aciliyet etiketi. */
export function defectSeverityLabel(severity: string, lang: string | undefined): string {
  return csT(`cs.qg.sev.${severity}` as CsLabelKey, lang);
}

/** Hasar-eksiklik durum etiketi. */
export function defectStatusLabel(status: string, lang: string | undefined): string {
  return csT(`cs.qg.ds.${status}` as CsLabelKey, lang);
}

/** Kayıt kaynağı etiketi. */
export function defectSourceLabel(source: string, lang: string | undefined): string {
  return csT(`cs.qg.src.${source}` as CsLabelKey, lang);
}

/** Denetim şablonu tipi etiketi. */
export function inspectionTemplateKindLabel(kind: string, lang: string | undefined): string {
  return csT(`cs.qg.itk.${kind}` as CsLabelKey, lang);
}

/** Denetim durumu etiketi. */
export function inspectionStatusLabel(status: string, lang: string | undefined): string {
  return csT(`cs.qg.is.${status}` as CsLabelKey, lang);
}

/** RFI disiplini etiketi. */
export function rfiDisciplineLabel(discipline: string, lang: string | undefined): string {
  return csT(`cs.qg.disc.${discipline}` as CsLabelKey, lang);
}

/** RFI durumu etiketi. */
export function rfiStatusLabel(status: string, lang: string | undefined): string {
  return csT(`cs.qg.rs.${status}` as CsLabelKey, lang);
}

/** Öncelik etiketi (RFI + görevlendirme ortak). */
export function qualityPriorityLabel(priority: string, lang: string | undefined): string {
  return csT(`cs.qg.pr.${priority}` as CsLabelKey, lang);
}

/** Görev durumu etiketi. */
export function assignmentStatusLabel(status: string, lang: string | undefined): string {
  return csT(`cs.qg.as.${status}` as CsLabelKey, lang);
}

/** Görev kaynak belge tipi etiketi. */
export function assignmentSourceLabel(source: string, lang: string | undefined): string {
  return csT(`cs.qg.asrc.${source}` as CsLabelKey, lang);
}

/** Taahhüt kaynağı etiketi. */
export function commitmentSourceLabel(source: string, lang: string | undefined): string {
  return csT(`cs.cmt.src.${source}` as CsLabelKey, lang);
}

/** Taahhüt durumu etiketi. */
export function commitmentStatusLabel(status: string, lang: string | undefined): string {
  return csT(`cs.cmt.st.${status}` as CsLabelKey, lang);
}

/** Aktivite tipi etiketi. */
export function activityKindLabel(kind: string, lang: string | undefined): string {
  return csT(`cs.sch.kind.${kind}` as CsLabelKey, lang);
}

/** Sayaç tipi etiketi (KM/Saat). */
export function meterTypeLabel(type: string, lang: string | undefined): string {
  return csT(`cs.mp.meter.${type}` as CsLabelKey, lang);
}

/** Sahiplik etiketi (öz mal/kiralık/taşeron). */
export function machineOwnershipLabel(kind: string, lang: string | undefined): string {
  return csT(`cs.mp.own.${kind}` as CsLabelKey, lang);
}

/** Bakım aralık tipi etiketi. */
export function maintenanceIntervalLabel(type: string, lang: string | undefined): string {
  return csT(`cs.mp.plan.it.${type}` as CsLabelKey, lang);
}

/** Bağımsız bölüm satış durumu etiketi ('available' türetilmiş durum). */
export function unitSaleStatusLabel(status: string, lang: string | undefined): string {
  switch (status) {
    case 'available':
      return csT('cs.us.st.available', lang);
    case 'reserved':
      return csT('cs.us.st.reserved', lang);
    case 'sold':
      return csT('cs.us.st.sold', lang);
    case 'barter':
      return csT('cs.us.st.barter', lang);
    case 'cancelled':
      return csT('cs.us.st.cancelled', lang);
    default:
      return status;
  }
}

/** Tahsilat türü etiketi. */
export function unitPaymentKindLabel(kind: string, lang: string | undefined): string {
  switch (kind) {
    case 'collection':
      return csT('cs.us.pay.kind.collection', lang);
    case 'refund':
      return csT('cs.us.pay.kind.refund', lang);
    default:
      return kind;
  }
}

/** Tahsilat yöntemi etiketi. */
export function unitPaymentMethodLabel(method: string, lang: string | undefined): string {
  switch (method) {
    case 'cash':
      return csT('cs.us.pay.method.cash', lang);
    case 'bank':
      return csT('cs.us.pay.method.bank', lang);
    case 'cheque':
      return csT('cs.us.pay.method.cheque', lang);
    case 'other':
      return csT('cs.us.pay.method.other', lang);
    default:
      return method;
  }
}

/** Değişiklik isteği durumu etiketi. */
export function changeRequestStatusLabel(status: string, lang: string | undefined): string {
  switch (status) {
    case 'open':
      return csT('cs.us.cr.st.open', lang);
    case 'approved':
      return csT('cs.us.cr.st.approved', lang);
    case 'rejected':
      return csT('cs.us.cr.st.rejected', lang);
    case 'done':
      return csT('cs.us.cr.st.done', lang);
    default:
      return status;
  }
}

/** Proje ekibi rolü etiketi. */
export function memberRoleLabel(role: string, lang: string | undefined): string {
  switch (role) {
    case 'manager':
      return csT('cs.cb.role.manager', lang);
    case 'engineer':
      return csT('cs.cb.role.engineer', lang);
    case 'site_chief':
      return csT('cs.cb.role.site_chief', lang);
    case 'foreman':
      return csT('cs.cb.role.foreman', lang);
    case 'accountant':
      return csT('cs.cb.role.accountant', lang);
    case 'viewer':
      return csT('cs.cb.role.viewer', lang);
    case 'other':
      return csT('cs.cb.role.other', lang);
    default:
      return role;
  }
}

/**
 * Kalite & Güvenlik use-case'leri (FAZ 6).
 *
 * DENETİM → HASAR-EKSİKLİK KÖPRÜSÜ bu katmanda: başarısız denetim maddesinden
 * tek çağrıyla hasar-eksiklik kaydı doğar ve cevaba geri bağlanır. Denetimin
 * "işe dönüştüğü" yer burasıdır — form doldurup rafa kaldırmak değil.
 *
 * KOD ÜRETİMİ sunucuda (DEF-0001, RFI-0001, GRV-0001, DEN-0001): istemcinin
 * kod üretmesi iki sekmede çakışır; sıra numarası kaynağın yanında durmalı.
 */
import type { Assignment } from '../../domain/entities/Assignment.js';
import type { Defect } from '../../domain/entities/Defect.js';
import type { Rfi } from '../../domain/entities/Rfi.js';
import {
  AssignmentNotFoundError,
  ConstructionValidationError,
  DefectNotFoundError,
  InspectionNotFoundError,
  InspectionTemplateNotFoundError,
  ProjectNotFoundError,
  RfiNotFoundError,
} from '../../domain/errors/ConstructionErrors.js';
import type { CurrencyCode } from '../../domain/valueObjects/Currency.js';
import {
  suggestedDueDate,
  type AssignmentSource,
  type AssignmentStatus,
  type DefectKind,
  type DefectSeverity,
  type DefectSource,
  type DefectStatus,
  type FileStage,
  type InspectionScoring,
  type InspectionStatus,
  type InspectionTemplateKind,
  type Priority,
  type QualityDocKind,
  type RfiDiscipline,
  type RfiStatus,
} from '../../domain/valueObjects/QualitySafety.js';
import {
  toAssignmentDto,
  toDefectDto,
  toInspectionDto,
  toInspectionTemplateDto,
  toRfiDto,
  type AssignmentDto,
  type DefectDto,
  type InspectionDto,
  type InspectionTemplateDto,
  type RfiDto,
} from '../dto/QualityDtos.js';
import type { Clock } from '../ports/Clock.js';
import type { ProjectRepository } from '../ports/ProjectRepository.js';
import type {
  AssignmentFilter,
  AssignmentRepository,
  AssignmentSummaryRow,
  DefectFilter,
  DefectHistoryRow,
  DefectRepository,
  DefectSummaryRow,
  InspectionFilter,
  InspectionRepository,
  NewQualityFileInput,
  QualityFileRepository,
  QualityFileRow,
  RfiFilter,
  RfiRepository,
  RfiSummaryRow,
  VendorScorecardRow,
} from '../ports/QualityRepositories.js';

// ============================================================================
// HASAR-EKSİKLİK
// ============================================================================

export interface CreateDefectInput {
  companyId: number;
  projectId: number;
  locationId?: number | null | undefined;
  code?: string | undefined;
  title: string;
  description?: string | null | undefined;
  defectKind: DefectKind;
  severity?: DefectSeverity | undefined;
  vendorId?: number | null | undefined;
  responsibleUserId?: number | null | undefined;
  reporterUserId?: number | null | undefined;
  source?: DefectSource | undefined;
  boqLineId?: number | null | undefined;
  dueDate?: string | null | undefined;
  costEstimate?: number | undefined;
  currency?: CurrencyCode | undefined;
}

export class CreateDefectUseCase {
  constructor(
    private readonly defects: DefectRepository,
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateDefectInput): Promise<DefectDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const severity = input.severity ?? 'medium';
    const created = await this.defects.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      locationId: input.locationId ?? null,
      code: input.code?.trim() || (await this.defects.nextCode(input.companyId, input.projectId)),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      defectKind: input.defectKind,
      severity,
      vendorId: input.vendorId ?? null,
      responsibleUserId: input.responsibleUserId ?? null,
      reporterUserId: input.reporterUserId ?? null,
      source: input.source ?? 'internal',
      boqLineId: input.boqLineId ?? null,
      // Bitiş tarihi verilmezse aciliyetten ÖNERİLİR (kritik=1 gün ... çok
      // düşük=30 gün). Tarihsiz kusur gecikme listesine hiç düşmez ve unutulur.
      dueDate: input.dueDate ?? suggestedDueDate(severity, this.clock.now()),
      costEstimate: input.costEstimate ?? 0,
      currency: input.currency ?? 'TRY',
    });
    return toDefectDto(created);
  }
}

export interface UpdateDefectInput {
  defectId: number;
  companyId: number;
  locationId?: number | null | undefined;
  title?: string | undefined;
  description?: string | null | undefined;
  defectKind?: DefectKind | undefined;
  severity?: DefectSeverity | undefined;
  vendorId?: number | null | undefined;
  responsibleUserId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  dueDate?: string | null | undefined;
  costEstimate?: number | undefined;
  costActual?: number | undefined;
  currency?: CurrencyCode | undefined;
}

export class UpdateDefectUseCase {
  constructor(
    private readonly defects: DefectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateDefectInput): Promise<DefectDto> {
    const defect = await this.requireDefect(input.defectId, input.companyId);
    const { defectId: _d, companyId: _c, ...patch } = input;
    const updated = defect.update(
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      this.clock.now(),
    );
    return toDefectDto(await this.defects.update(updated));
  }

  private async requireDefect(id: number, companyId: number): Promise<Defect> {
    const defect = await this.defects.findById(id, companyId);
    if (!defect) throw new DefectNotFoundError(id);
    return defect;
  }
}

export class ChangeDefectStatusUseCase {
  constructor(
    private readonly defects: DefectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    defectId: number;
    companyId: number;
    status: DefectStatus;
    note?: string | null | undefined;
    actorUserId?: number | null | undefined;
  }): Promise<DefectDto> {
    const defect = await this.defects.findById(input.defectId, input.companyId);
    if (!defect) throw new DefectNotFoundError(input.defectId);
    const from = defect.status;
    const changed = defect.changeStatus(input.status, input.actorUserId ?? null, this.clock.now());
    // Durum + geçmiş satırı tek transaction'da — taşeronla en tartışmalı
    // belgenin izi yarım yazılamaz.
    await this.defects.changeStatus(changed, from, input.note ?? null, input.actorUserId ?? null);
    return toDefectDto(changed);
  }
}

export class ListDefectsUseCase {
  constructor(private readonly defects: DefectRepository) {}

  async execute(input: DefectFilter & { companyId: number }): Promise<DefectDto[]> {
    const { companyId, ...filter } = input;
    const rows = await this.defects.list(companyId, filter);
    return rows.map(toDefectDto);
  }
}

export class GetDefectUseCase {
  constructor(private readonly defects: DefectRepository) {}

  async execute(input: {
    defectId: number;
    companyId: number;
  }): Promise<{ defect: DefectDto; history: ReadonlyArray<DefectHistoryRow> }> {
    const defect = await this.defects.findById(input.defectId, input.companyId);
    if (!defect) throw new DefectNotFoundError(input.defectId);
    const history = await this.defects.history(input.defectId, input.companyId);
    return { defect: toDefectDto(defect), history };
  }
}

export class GetDefectSummaryUseCase {
  constructor(private readonly defects: DefectRepository) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    byLocation?: boolean | undefined;
  }): Promise<ReadonlyArray<DefectSummaryRow>> {
    return this.defects.summary(input.companyId, input.projectId, {
      byLocation: input.byLocation ?? false,
    });
  }
}

// ============================================================================
// DENETLEME
// ============================================================================

export interface CreateInspectionTemplateInput {
  companyId: number;
  code: string;
  name: string;
  kind?: InspectionTemplateKind | undefined;
  description?: string | null | undefined;
  scoring?: InspectionScoring | undefined;
  passPct?: number | undefined;
  items: ReadonlyArray<{
    category?: string | null | undefined;
    code: string;
    text: string;
    weight?: number | undefined;
    maxScore?: number | undefined;
    isCritical?: boolean | undefined;
    sortOrder?: number | undefined;
  }>;
}

export class CreateInspectionTemplateUseCase {
  constructor(private readonly inspections: InspectionRepository) {}

  async execute(input: CreateInspectionTemplateInput): Promise<InspectionTemplateDto> {
    if (input.items.length === 0) {
      throw new ConstructionValidationError('denetim şablonu en az bir madde gerektirir');
    }
    const codes = new Set(input.items.map((i) => i.code.trim()));
    if (codes.size !== input.items.length) {
      throw new ConstructionValidationError('şablonda madde kodu tekrar edemez');
    }
    const created = await this.inspections.insertTemplate({
      companyId: input.companyId,
      code: input.code.trim(),
      name: input.name.trim(),
      kind: input.kind ?? 'quality',
      description: input.description?.trim() || null,
      scoring: input.scoring ?? 'weighted',
      passPct: input.passPct ?? 70,
      items: input.items.map((i, idx) => ({
        category: i.category?.trim() || null,
        code: i.code.trim(),
        text: i.text.trim(),
        weight: i.weight ?? 1,
        // pass_fail şablonda tam puan 1'dir (uygun/uygun değil)
        maxScore: i.maxScore ?? (input.scoring === 'pass_fail' ? 1 : 5),
        isCritical: i.isCritical ?? false,
        sortOrder: i.sortOrder ?? idx,
      })),
    });
    return toInspectionTemplateDto(created);
  }
}

export class ListInspectionTemplatesUseCase {
  constructor(private readonly inspections: InspectionRepository) {}

  async execute(input: {
    companyId: number;
    kind?: InspectionTemplateKind | undefined;
    includeInactive?: boolean | undefined;
  }): Promise<InspectionTemplateDto[]> {
    const rows = await this.inspections.listTemplates(input.companyId, {
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      includeInactive: input.includeInactive ?? false,
    });
    return rows.map(toInspectionTemplateDto);
  }
}

export class ReplaceInspectionTemplateItemsUseCase {
  constructor(private readonly inspections: InspectionRepository) {}

  async execute(input: {
    templateId: number;
    companyId: number;
    items: CreateInspectionTemplateInput['items'];
  }): Promise<InspectionTemplateDto> {
    const tpl = await this.inspections.findTemplate(input.templateId, input.companyId);
    if (!tpl) throw new InspectionTemplateNotFoundError(input.templateId);
    if (input.items.length === 0) {
      throw new ConstructionValidationError('denetim şablonu en az bir madde gerektirir');
    }
    // Geçmiş denetimler ETKİLENMEZ: cevaplar madde metnini/ağırlığını kopyalar.
    const updated = await this.inspections.replaceTemplateItems(
      input.templateId,
      input.companyId,
      input.items.map((i, idx) => ({
        category: i.category?.trim() || null,
        code: i.code.trim(),
        text: i.text.trim(),
        weight: i.weight ?? 1,
        maxScore: i.maxScore ?? 5,
        isCritical: i.isCritical ?? false,
        sortOrder: i.sortOrder ?? idx,
      })),
    );
    return toInspectionTemplateDto(updated);
  }
}

export class DeactivateInspectionTemplateUseCase {
  constructor(private readonly inspections: InspectionRepository) {}

  async execute(input: { templateId: number; companyId: number }): Promise<InspectionTemplateDto> {
    const tpl = await this.inspections.findTemplate(input.templateId, input.companyId);
    if (!tpl) throw new InspectionTemplateNotFoundError(input.templateId);
    return toInspectionTemplateDto(
      await this.inspections.deactivateTemplate(input.templateId, input.companyId),
    );
  }
}

export interface StartInspectionInput {
  companyId: number;
  projectId: number;
  templateId: number;
  locationId?: number | null | undefined;
  code?: string | undefined;
  vendorId?: number | null | undefined;
  contractId?: number | null | undefined;
  inspectorUserId?: number | null | undefined;
  inspectionDate: string;
  periodLabel?: string | null | undefined;
  note?: string | null | undefined;
}

export class StartInspectionUseCase {
  constructor(
    private readonly inspections: InspectionRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: StartInspectionInput): Promise<InspectionDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    const tpl = await this.inspections.findTemplate(input.templateId, input.companyId);
    if (!tpl) throw new InspectionTemplateNotFoundError(input.templateId);

    // Taşeron Karne Formu taşeronsuz başlatılamaz — kime karne verildiği
    // belirsiz bir karne denetimi rapora giremez.
    if (tpl.requiresVendor && (input.vendorId === null || input.vendorId === undefined)) {
      throw new ConstructionValidationError('karne formu denetimi taşeron seçilmeden başlatılamaz');
    }

    const created = await this.inspections.insertInspection({
      companyId: input.companyId,
      projectId: input.projectId,
      templateId: input.templateId,
      locationId: input.locationId ?? null,
      code: input.code?.trim() || (await this.inspections.nextInspectionCode(input.companyId)),
      vendorId: input.vendorId ?? null,
      contractId: input.contractId ?? null,
      inspectorUserId: input.inspectorUserId ?? null,
      inspectionDate: input.inspectionDate,
      periodLabel: input.periodLabel?.trim() || null,
      note: input.note?.trim() || null,
    });
    return toInspectionDto(created);
  }
}

export class SaveInspectionAnswersUseCase {
  constructor(
    private readonly inspections: InspectionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    inspectionId: number;
    companyId: number;
    answers: ReadonlyArray<{
      itemId: number;
      score?: number | null | undefined;
      isNa?: boolean | undefined;
      note?: string | null | undefined;
    }>;
  }): Promise<InspectionDto> {
    const ins = await this.inspections.findInspection(input.inspectionId, input.companyId);
    if (!ins) throw new InspectionNotFoundError(input.inspectionId);
    const updated = ins.setAnswers(
      input.answers.map((a) => ({
        itemId: a.itemId,
        score: a.score ?? null,
        ...(a.isNa !== undefined ? { isNa: a.isNa } : {}),
        ...(a.note !== undefined ? { note: a.note } : {}),
      })),
      this.clock.now(),
    );
    await this.inspections.saveAnswers(updated);
    return toInspectionDto(updated);
  }
}

export class ChangeInspectionStatusUseCase {
  constructor(
    private readonly inspections: InspectionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    inspectionId: number;
    companyId: number;
    status: InspectionStatus;
  }): Promise<InspectionDto> {
    const ins = await this.inspections.findInspection(input.inspectionId, input.companyId);
    if (!ins) throw new InspectionNotFoundError(input.inspectionId);
    const changed = ins.changeStatus(input.status, this.clock.now());
    await this.inspections.changeInspectionStatus(changed);
    return toInspectionDto(changed);
  }
}

export class ListInspectionsUseCase {
  constructor(private readonly inspections: InspectionRepository) {}

  async execute(input: InspectionFilter & { companyId: number }): Promise<InspectionDto[]> {
    const { companyId, ...filter } = input;
    const rows = await this.inspections.listInspections(companyId, filter);
    return rows.map(toInspectionDto);
  }
}

export class GetInspectionUseCase {
  constructor(private readonly inspections: InspectionRepository) {}

  async execute(input: { inspectionId: number; companyId: number }): Promise<InspectionDto> {
    const ins = await this.inspections.findInspection(input.inspectionId, input.companyId);
    if (!ins) throw new InspectionNotFoundError(input.inspectionId);
    return toInspectionDto(ins);
  }
}

/**
 * Başarısız denetim maddesinden hasar-eksiklik kaydı doğurur ve cevaba bağlar.
 * Denetimin işe dönüştüğü yer: form doldurup rafa kaldırmak değil.
 */
export class RaiseDefectFromAnswerUseCase {
  constructor(
    private readonly inspections: InspectionRepository,
    private readonly createDefect: CreateDefectUseCase,
  ) {}

  async execute(input: {
    inspectionId: number;
    companyId: number;
    itemId: number;
    defectKind: DefectKind;
    severity?: DefectSeverity | undefined;
    vendorId?: number | null | undefined;
    responsibleUserId?: number | null | undefined;
    dueDate?: string | null | undefined;
    reporterUserId?: number | null | undefined;
  }): Promise<{ inspection: InspectionDto; defect: DefectDto }> {
    const ins = await this.inspections.findInspection(input.inspectionId, input.companyId);
    if (!ins) throw new InspectionNotFoundError(input.inspectionId);
    const j = ins.toJSON();
    const answer = j.answers.find((a) => a.itemId === input.itemId);
    if (answer === undefined) {
      throw new ConstructionValidationError('denetim maddesi bu denetimde yok');
    }
    if (answer.defectId !== null) {
      throw new ConstructionValidationError(
        'bu maddeden zaten bir hasar-eksiklik kaydı doğmuş — ikinci kayıt tekrar sayımı bozar',
      );
    }

    const defect = await this.createDefect.execute({
      companyId: input.companyId,
      projectId: j.projectId,
      locationId: j.locationId,
      title: answer.itemText,
      description: answer.note,
      defectKind: input.defectKind,
      severity: input.severity ?? 'medium',
      // Taşeron verilmezse denetimin taşeronu devralınır — karne denetiminden
      // doğan kusur karnedeki taşerona yazılmalı.
      vendorId: input.vendorId ?? j.vendorId,
      responsibleUserId: input.responsibleUserId ?? null,
      reporterUserId: input.reporterUserId ?? j.inspectorUserId,
      source: 'inspection',
      dueDate: input.dueDate ?? null,
    });

    await this.inspections.linkAnswerDefect(answer.id, input.companyId, defect.id);
    const fresh = await this.inspections.findInspection(input.inspectionId, input.companyId);
    return { inspection: toInspectionDto(fresh ?? ins), defect };
  }
}

export class GetVendorScorecardUseCase {
  constructor(private readonly inspections: InspectionRepository) {}

  async execute(input: {
    companyId: number;
    projectId?: number | undefined;
    vendorId?: number | undefined;
  }): Promise<ReadonlyArray<VendorScorecardRow>> {
    return this.inspections.scorecard(input.companyId, {
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.vendorId !== undefined ? { vendorId: input.vendorId } : {}),
    });
  }
}

// ============================================================================
// RFI
// ============================================================================

export interface CreateRfiInput {
  companyId: number;
  projectId: number;
  locationId?: number | null | undefined;
  code?: string | undefined;
  subject: string;
  question: string;
  discipline?: RfiDiscipline | undefined;
  priority?: Priority | undefined;
  askedBy?: number | null | undefined;
  askedToUserId?: number | null | undefined;
  vendorId?: number | null | undefined;
  boqLineId?: number | null | undefined;
  dueDate?: string | null | undefined;
  impactDays?: number | undefined;
  impactCost?: number | undefined;
  currency?: CurrencyCode | undefined;
}

export class CreateRfiUseCase {
  constructor(
    private readonly rfis: RfiRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: CreateRfiInput): Promise<RfiDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);

    const created = await this.rfis.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      locationId: input.locationId ?? null,
      code: input.code?.trim() || (await this.rfis.nextCode(input.companyId, input.projectId)),
      subject: input.subject.trim(),
      question: input.question.trim(),
      discipline: input.discipline ?? 'architectural',
      priority: input.priority ?? 'medium',
      askedBy: input.askedBy ?? null,
      askedToUserId: input.askedToUserId ?? null,
      vendorId: input.vendorId ?? null,
      boqLineId: input.boqLineId ?? null,
      dueDate: input.dueDate ?? null,
      impactDays: input.impactDays ?? 0,
      impactCost: input.impactCost ?? 0,
      currency: input.currency ?? 'TRY',
    });
    return toRfiDto(created);
  }
}

export class UpdateRfiUseCase {
  constructor(
    private readonly rfis: RfiRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    rfiId: number;
    companyId: number;
    locationId?: number | null | undefined;
    subject?: string | undefined;
    question?: string | undefined;
    discipline?: RfiDiscipline | undefined;
    priority?: Priority | undefined;
    askedToUserId?: number | null | undefined;
    vendorId?: number | null | undefined;
    boqLineId?: number | null | undefined;
    dueDate?: string | null | undefined;
    impactDays?: number | undefined;
    impactCost?: number | undefined;
    currency?: CurrencyCode | undefined;
  }): Promise<RfiDto> {
    const rfi = await this.requireRfi(input.rfiId, input.companyId);
    const { rfiId: _r, companyId: _c, ...patch } = input;
    const updated = rfi.update(
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      this.clock.now(),
    );
    return toRfiDto(await this.rfis.update(updated));
  }

  private async requireRfi(id: number, companyId: number): Promise<Rfi> {
    const rfi = await this.rfis.findById(id, companyId);
    if (!rfi) throw new RfiNotFoundError(id);
    return rfi;
  }
}

export class AnswerRfiUseCase {
  constructor(
    private readonly rfis: RfiRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    rfiId: number;
    companyId: number;
    answer: string;
    actorUserId?: number | null | undefined;
  }): Promise<RfiDto> {
    const rfi = await this.rfis.findById(input.rfiId, input.companyId);
    if (!rfi) throw new RfiNotFoundError(input.rfiId);
    const answered = rfi.answerQuestion(input.answer, input.actorUserId ?? null, this.clock.now());
    return toRfiDto(await this.rfis.update(answered));
  }
}

export class ChangeRfiStatusUseCase {
  constructor(
    private readonly rfis: RfiRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { rfiId: number; companyId: number; status: RfiStatus }): Promise<RfiDto> {
    const rfi = await this.rfis.findById(input.rfiId, input.companyId);
    if (!rfi) throw new RfiNotFoundError(input.rfiId);
    const changed = rfi.changeStatus(input.status, this.clock.now());
    return toRfiDto(await this.rfis.update(changed));
  }
}

export class ListRfisUseCase {
  constructor(private readonly rfis: RfiRepository) {}

  async execute(input: RfiFilter & { companyId: number }): Promise<RfiDto[]> {
    const { companyId, ...filter } = input;
    const rows = await this.rfis.list(companyId, filter);
    return rows.map(toRfiDto);
  }
}

export class GetRfiSummaryUseCase {
  constructor(private readonly rfis: RfiRepository) {}

  async execute(input: { companyId: number; projectId: number }): Promise<RfiSummaryRow | null> {
    return this.rfis.summary(input.companyId, input.projectId);
  }
}

// ============================================================================
// GÖREVLENDİRME
// ============================================================================

export interface CreateAssignmentInput {
  companyId: number;
  projectId: number;
  locationId?: number | null | undefined;
  code?: string | undefined;
  title: string;
  description?: string | null | undefined;
  assignedToUserId?: number | null | undefined;
  vendorId?: number | null | undefined;
  assignedBy?: number | null | undefined;
  priority?: Priority | undefined;
  startDate?: string | null | undefined;
  dueDate?: string | null | undefined;
  sourceKind?: AssignmentSource | null | undefined;
  sourceId?: number | null | undefined;
}

export class CreateAssignmentUseCase {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly projects: ProjectRepository,
  ) {}

  async execute(input: CreateAssignmentInput): Promise<AssignmentDto> {
    const project = await this.projects.findById(input.projectId, input.companyId);
    if (!project) throw new ProjectNotFoundError(input.projectId);
    if ((input.sourceKind == null) !== (input.sourceId == null)) {
      throw new ConstructionValidationError('kaynak tipi ve kaynak kimliği birlikte verilmeli');
    }

    const created = await this.assignments.insert({
      companyId: input.companyId,
      projectId: input.projectId,
      locationId: input.locationId ?? null,
      code:
        input.code?.trim() || (await this.assignments.nextCode(input.companyId, input.projectId)),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assignedToUserId: input.assignedToUserId ?? null,
      vendorId: input.vendorId ?? null,
      assignedBy: input.assignedBy ?? null,
      priority: input.priority ?? 'medium',
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      sourceKind: input.sourceKind ?? null,
      sourceId: input.sourceId ?? null,
    });
    return toAssignmentDto(created);
  }
}

export class UpdateAssignmentUseCase {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    assignmentId: number;
    companyId: number;
    locationId?: number | null | undefined;
    title?: string | undefined;
    description?: string | null | undefined;
    assignedToUserId?: number | null | undefined;
    vendorId?: number | null | undefined;
    priority?: Priority | undefined;
    startDate?: string | null | undefined;
    dueDate?: string | null | undefined;
    progressPct?: number | undefined;
  }): Promise<AssignmentDto> {
    const asg = await this.requireAssignment(input.assignmentId, input.companyId);
    const { assignmentId: _a, companyId: _c, ...patch } = input;
    const updated = asg.update(
      Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      this.clock.now(),
    );
    return toAssignmentDto(await this.assignments.update(updated));
  }

  private async requireAssignment(id: number, companyId: number): Promise<Assignment> {
    const asg = await this.assignments.findById(id, companyId);
    if (!asg) throw new AssignmentNotFoundError(id);
    return asg;
  }
}

export class ChangeAssignmentStatusUseCase {
  constructor(
    private readonly assignments: AssignmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    assignmentId: number;
    companyId: number;
    status: AssignmentStatus;
  }): Promise<AssignmentDto> {
    const asg = await this.assignments.findById(input.assignmentId, input.companyId);
    if (!asg) throw new AssignmentNotFoundError(input.assignmentId);
    const changed = asg.changeStatus(input.status, this.clock.now());
    return toAssignmentDto(await this.assignments.update(changed));
  }
}

export class ListAssignmentsUseCase {
  constructor(private readonly assignments: AssignmentRepository) {}

  async execute(input: AssignmentFilter & { companyId: number }): Promise<AssignmentDto[]> {
    const { companyId, ...filter } = input;
    const rows = await this.assignments.list(companyId, filter);
    return rows.map(toAssignmentDto);
  }
}

export class GetAssignmentSummaryUseCase {
  constructor(private readonly assignments: AssignmentRepository) {}

  async execute(input: {
    companyId: number;
    projectId: number;
    byUser?: boolean | undefined;
  }): Promise<ReadonlyArray<AssignmentSummaryRow>> {
    return this.assignments.summary(input.companyId, input.projectId, {
      byUser: input.byUser ?? false,
    });
  }
}

// ============================================================================
// ORTAK EK DOSYASI
// ============================================================================

export class AddQualityFileUseCase {
  constructor(private readonly files: QualityFileRepository) {}

  async execute(
    input: Omit<
      NewQualityFileInput,
      | 'fileKind'
      | 'stage'
      | 'title'
      | 'fileUrl'
      | 'content'
      | 'mimeType'
      | 'sizeBytes'
      | 'createdBy'
    > & {
      fileKind?: string | undefined;
      stage?: FileStage | undefined;
      title?: string | null | undefined;
      fileUrl?: string | null | undefined;
      content?: Buffer | null | undefined;
      mimeType?: string | null | undefined;
      sizeBytes?: number | null | undefined;
      createdBy?: number | null | undefined;
    },
  ): Promise<QualityFileRow> {
    if ((input.fileUrl ?? null) === null && (input.content ?? null) === null) {
      throw new ConstructionValidationError('ek dosya için URL veya içerik verilmeli');
    }
    return this.files.insert({
      companyId: input.companyId,
      docKind: input.docKind,
      docId: input.docId,
      fileKind: input.fileKind ?? 'photo',
      stage: input.stage ?? 'before',
      title: input.title?.trim() || null,
      fileUrl: input.fileUrl ?? null,
      content: input.content ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      createdBy: input.createdBy ?? null,
    });
  }
}

export class ListQualityFilesUseCase {
  constructor(private readonly files: QualityFileRepository) {}

  async execute(input: {
    companyId: number;
    docKind: QualityDocKind;
    docId: number;
  }): Promise<ReadonlyArray<QualityFileRow>> {
    return this.files.list(input.companyId, input.docKind, input.docId);
  }
}

export class DeleteQualityFileUseCase {
  constructor(private readonly files: QualityFileRepository) {}

  async execute(input: { fileId: number; companyId: number }): Promise<{ deleted: boolean }> {
    const deleted = await this.files.delete(input.fileId, input.companyId);
    return { deleted };
  }
}

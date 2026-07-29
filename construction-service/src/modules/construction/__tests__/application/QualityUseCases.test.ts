/**
 * FAZ 6 — Kalite & Güvenlik testleri.
 *
 * Ağırlık DOMAIN MANTIĞINDA: hasar-eksiklik durum makinesi + reopen sayacı,
 * denetim puanlama kuralları (N/A, cevapsız, kritik madde), RFI geçişleri,
 * görevlendirme yüzde düzeltmesi. SQL görünümleri smoke'ta canlı sınanır.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Assignment, type AssignmentProps } from '../../domain/entities/Assignment.js';
import { Defect, type DefectProps } from '../../domain/entities/Defect.js';
import {
  Inspection,
  InspectionTemplate,
  type InspectionAnswerProps,
  type InspectionProps,
} from '../../domain/entities/Inspection.js';
import { Rfi, type RfiProps } from '../../domain/entities/Rfi.js';
import {
  ConstructionValidationError,
  InspectionNotEditableError,
  InvalidStatusTransitionError,
} from '../../domain/errors/ConstructionErrors.js';
import {
  computeInspectionScore,
  gradeOf,
  normalizeProgress,
  overdueDays,
  suggestedDueDate,
} from '../../domain/valueObjects/QualitySafety.js';

const NOW = new Date('2026-07-29T10:00:00.000Z');
const TODAY = '2026-07-29';

// ===== HASAR-EKSİKLİK =======================================================

function defect(over: Partial<DefectProps> = {}): Defect {
  return Defect.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    locationId: 10,
    code: 'DEF-0001',
    title: 'Banyo fayansı çatlak',
    description: null,
    defectKind: 'workmanship',
    severity: 'medium',
    status: 'open',
    vendorId: 77,
    responsibleUserId: 3,
    reporterUserId: 2,
    source: 'internal',
    boqLineId: null,
    dueDate: '2026-08-05',
    fixedAt: null,
    fixedBy: null,
    verifiedAt: null,
    verifiedBy: null,
    closedAt: null,
    costEstimate: 1500,
    costActual: 0,
    currency: 'TRY',
    reopenCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

describe('Defect — durum makinesi', () => {
  it('open → fixed giderme izini yazar', () => {
    const d = defect().changeStatus('fixed', 42, NOW);
    const j = d.toJSON();
    assert.equal(j.status, 'fixed');
    assert.equal(j.fixedBy, 42);
    assert.deepEqual(j.fixedAt, NOW);
  });

  it('fixed → verified doğrulama izini yazar; verified → closed kapanış', () => {
    const d = defect()
      .changeStatus('fixed', 42, NOW)
      .changeStatus('verified', 7, NOW)
      .changeStatus('closed', 7, NOW);
    const j = d.toJSON();
    assert.equal(j.status, 'closed');
    assert.equal(j.verifiedBy, 7);
    assert.notEqual(j.closedAt, null);
  });

  it('giderilmiş kaydın yeniden açılması reopen sayacını artırır ve izleri temizler', () => {
    const d = defect().changeStatus('fixed', 42, NOW).changeStatus('open', 7, NOW);
    const j = d.toJSON();
    assert.equal(j.status, 'open');
    assert.equal(j.reopenCount, 1);
    // "doğrulanmış ama açık" satırı kalmasın: izler temizlenir
    assert.equal(j.fixedAt, null);
    assert.equal(j.fixedBy, null);
    assert.equal(j.verifiedAt, null);
  });

  it('reddedilmiş kaydın yeniden açılması reopen SAYILMAZ (tekrar eden kusur değil)', () => {
    const d = defect().changeStatus('rejected', 7, NOW).changeStatus('open', 7, NOW);
    assert.equal(d.reopenCount, 0);
  });

  it('closed terminaldir', () => {
    const d = defect()
      .changeStatus('fixed', 42, NOW)
      .changeStatus('verified', 7, NOW)
      .changeStatus('closed', 7, NOW);
    assert.throws(() => d.changeStatus('open', 7, NOW), InvalidStatusTransitionError);
  });

  it('open → verified atlanamaz (gidermeden doğrulama olmaz)', () => {
    assert.throws(() => defect().changeStatus('verified', 7, NOW), InvalidStatusTransitionError);
  });

  it('verified ama fixedAt boş kayıt kurulamaz', () => {
    assert.throws(
      () => defect({ status: 'verified', verifiedAt: NOW, fixedAt: null }),
      ConstructionValidationError,
    );
  });

  it('gecikme: kapanmış kayıtta hesaplanmaz', () => {
    const late = defect({ dueDate: '2026-07-20' });
    assert.equal(late.overdueDays(TODAY), 9);
    const closed = late.changeStatus('fixed', 1, NOW).changeStatus('verified', 1, NOW);
    assert.equal(closed.overdueDays(TODAY), null);
  });

  it('aciliyetten önerilen bitiş tarihi: kritik = ertesi gün', () => {
    assert.equal(suggestedDueDate('critical', NOW), '2026-07-30');
    assert.equal(suggestedDueDate('very_low', NOW), '2026-08-28');
  });
});

// ===== DENETİM PUANLAMA =====================================================

describe('computeInspectionScore', () => {
  const a = (over: Partial<Parameters<typeof computeInspectionScore>[0][number]>) => ({
    weight: 1,
    maxScore: 5,
    score: null as number | null,
    isNa: false,
    ...over,
  });

  it('ağırlıklı puan ve harf notu', () => {
    const r = computeInspectionScore(
      [a({ score: 5, weight: 2 }), a({ score: 3 }), a({ score: 4 })],
      70,
    );
    // (10+3+4) / (10+5+5) = 17/20 = %85 → B
    assert.equal(r.scorePct, 85);
    assert.equal(r.grade, 'B');
    assert.equal(r.passed, true);
  });

  it('N/A madde paydan DA paydadan DA düşer (0 vermek cezalandırır)', () => {
    const r = computeInspectionScore([a({ score: 5 }), a({ isNa: true })], 70);
    assert.equal(r.scorePct, 100);
    assert.equal(r.naCount, 1);
  });

  it('cevaplanmamış madde paydadan düşer ama sayısı raporlanır', () => {
    const r = computeInspectionScore([a({ score: 5 }), a({ score: null })], 70);
    assert.equal(r.scorePct, 100);
    assert.equal(r.unansweredCount, 1);
  });

  it('sıfır alan KRİTİK madde toplam puana bakılmaksızın kalır', () => {
    const r = computeInspectionScore(
      [a({ score: 5, weight: 10 }), a({ score: 0, isCritical: true })],
      70,
    );
    // Puan yüksek (%90+) ama kritik madde sıfır → başarısız
    assert.equal(r.criticalFailures, 1);
    assert.equal(r.passed, false);
  });

  it('puanlanacak madde yoksa yüzde NULL (0 değil — ölçülmedi ≠ sıfır aldı)', () => {
    const r = computeInspectionScore([a({ isNa: true }), a({ score: null })], 70);
    assert.equal(r.scorePct, null);
    assert.equal(r.passed, null);
  });

  it('harf notları sınırlarda doğru', () => {
    assert.equal(gradeOf(90), 'A');
    assert.equal(gradeOf(89.9), 'B');
    assert.equal(gradeOf(70), 'C');
    assert.equal(gradeOf(59.9), 'E');
  });
});

// ===== DENETİM ENTITY =======================================================

function answer(
  over: Partial<InspectionAnswerProps> & { id: number; itemId: number },
): InspectionAnswerProps {
  return {
    companyId: 1,
    inspectionId: 1,
    itemText: 'Madde',
    weight: 1,
    maxScore: 5,
    score: null,
    isNa: false,
    note: null,
    defectId: null,
    isCritical: false,
    ...over,
  };
}

function inspection(over: Partial<InspectionProps> = {}): Inspection {
  return Inspection.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    templateId: 9,
    locationId: null,
    code: 'DEN-0001',
    vendorId: 77,
    contractId: null,
    inspectorUserId: 2,
    inspectionDate: '2026-07-29',
    periodLabel: null,
    status: 'draft',
    note: null,
    totalScore: 0,
    maxScore: 0,
    scorePct: null,
    grade: null,
    passed: null,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    answers: [answer({ id: 1, itemId: 11 }), answer({ id: 2, itemId: 12 })],
    passPct: 70,
    ...over,
  });
}

describe('Inspection', () => {
  it('cevap yazmak puanı HER SEFERİNDE tazeler', () => {
    const ins = inspection().setAnswers([{ itemId: 11, score: 4 }], NOW);
    const j = ins.toJSON();
    // 4/5 = %80 (madde 12 cevapsız — paydadan düşer)
    assert.equal(j.scorePct, 80);
    assert.equal(j.grade, 'B');
  });

  it('N/A işaretlenen madde puanını kaybeder', () => {
    const ins = inspection()
      .setAnswers([{ itemId: 11, score: 3 }], NOW)
      .setAnswers(
        [
          { itemId: 11, isNa: true },
          { itemId: 12, score: 5 },
        ],
        NOW,
      );
    const j = ins.toJSON();
    const a11 = j.answers.find((x) => x.itemId === 11)!;
    assert.equal(a11.isNa, true);
    assert.equal(a11.score, null);
    assert.equal(j.scorePct, 100);
  });

  it('boş form tamamlanamaz', () => {
    assert.throws(() => inspection().changeStatus('completed', NOW), ConstructionValidationError);
  });

  it('tamamlanan denetim taslağa dönebilir; onaylanan DÖNEMEZ', () => {
    const done = inspection()
      .setAnswers([{ itemId: 11, score: 4 }], NOW)
      .changeStatus('completed', NOW);
    assert.equal(done.changeStatus('draft', NOW).status, 'draft');
    const approved = done.changeStatus('approved', NOW);
    assert.throws(() => approved.changeStatus('draft', NOW), InvalidStatusTransitionError);
  });

  it('onaylanmış denetimin cevapları değiştirilemez', () => {
    const approved = inspection()
      .setAnswers([{ itemId: 11, score: 4 }], NOW)
      .changeStatus('completed', NOW)
      .changeStatus('approved', NOW);
    assert.throws(
      () => approved.setAnswers([{ itemId: 11, score: 1 }], NOW),
      InspectionNotEditableError,
    );
  });

  it('puan aralık dışıysa madde adıyla reddedilir', () => {
    assert.throws(
      () => inspection().setAnswers([{ itemId: 11, score: 9 }], NOW),
      ConstructionValidationError,
    );
  });
});

describe('InspectionTemplate', () => {
  it('karne formu taşeron ister', () => {
    const tpl = InspectionTemplate.create({
      id: 1,
      companyId: 1,
      code: 'KARNE',
      name: 'Taşeron Karne Formu',
      kind: 'subcontractor_scorecard',
      description: null,
      scoring: 'weighted',
      passPct: 70,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
      items: [],
    });
    assert.equal(tpl.requiresVendor, true);
  });
});

// ===== RFI ==================================================================

function rfi(over: Partial<RfiProps> = {}): Rfi {
  return Rfi.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    locationId: null,
    code: 'RFI-0001',
    subject: 'Perde kalınlığı',
    question: 'P12 perdesi 25 mi 30 mu?',
    discipline: 'structural',
    priority: 'high',
    status: 'open',
    askedBy: 2,
    askedToUserId: 9,
    vendorId: null,
    boqLineId: null,
    dueDate: '2026-08-01',
    answer: null,
    answeredBy: null,
    answeredAt: null,
    closedAt: null,
    impactDays: 0,
    impactCost: 0,
    currency: 'TRY',
    createdAt: new Date('2026-07-20T08:00:00.000Z'),
    updatedAt: NOW,
    ...over,
  });
}

describe('Rfi', () => {
  it('cevap yazmak durumu answered yapar ve izi tutar', () => {
    const r = rfi().answerQuestion('30 cm, revize pafta R-04.', 9, NOW);
    const j = r.toJSON();
    assert.equal(j.status, 'answered');
    assert.equal(j.answeredBy, 9);
    assert.equal(j.answer, '30 cm, revize pafta R-04.');
  });

  it('answered → open (yetersiz cevap) cevabı KORUR', () => {
    const r = rfi().answerQuestion('Bakılacak.', 9, NOW).changeStatus('open', NOW);
    const j = r.toJSON();
    assert.equal(j.status, 'open');
    assert.equal(j.answer, 'Bakılacak.'); // iz değeri var, silinmez
  });

  it('açık RFI cevapsız da kapatılabilir (soru geçersizleşti)', () => {
    const r = rfi().changeStatus('closed', NOW);
    assert.equal(r.status, 'closed');
  });

  it('elle answered geçişi cevap ister', () => {
    assert.throws(() => rfi().changeStatus('answered', NOW), ConstructionValidationError);
  });

  it('yaş günü hesaplanır (süre uzatımı dayanağı)', () => {
    assert.equal(rfi().ageDays(TODAY), 9);
  });
});

// ===== GÖREVLENDİRME ========================================================

function assignment(over: Partial<AssignmentProps> = {}): Assignment {
  return Assignment.create({
    id: 1,
    companyId: 1,
    projectId: 5,
    locationId: null,
    code: 'GRV-0001',
    title: 'İskele bağlantılarını kontrol et',
    description: null,
    assignedToUserId: 4,
    vendorId: null,
    assignedBy: 2,
    priority: 'high',
    status: 'open',
    startDate: null,
    dueDate: '2026-08-01',
    doneAt: null,
    progressPct: 0,
    sourceKind: 'defect',
    sourceId: 33,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
}

describe('Assignment', () => {
  it('done daima %100 ve doneAt yazılır', () => {
    const a = assignment({ progressPct: 60 }).changeStatus('done', NOW);
    const j = a.toJSON();
    assert.equal(j.progressPct, 100);
    assert.deepEqual(j.doneAt, NOW);
  });

  it('done → in_progress: doneAt silinir, yüzde 100 kalır (iş yok sayılmaz)', () => {
    const a = assignment().changeStatus('done', NOW).changeStatus('in_progress', NOW);
    const j = a.toJSON();
    assert.equal(j.doneAt, null);
    assert.equal(j.progressPct, 100);
  });

  it('yarım kaynak referansı reddedilir', () => {
    assert.throws(
      () => assignment({ sourceKind: 'rfi', sourceId: null }),
      ConstructionValidationError,
    );
  });

  it('başlangıç bitişten sonra olamaz', () => {
    assert.throws(
      () => assignment({ startDate: '2026-08-10', dueDate: '2026-08-01' }),
      ConstructionValidationError,
    );
  });

  it('normalizeProgress: done→100, aralık dışı kırpılır', () => {
    assert.equal(normalizeProgress('done', 60), 100);
    assert.equal(normalizeProgress('open', 130), 100);
    assert.equal(normalizeProgress('open', -5), 0);
  });
});

// ===== ORTAK ================================================================

describe('overdueDays', () => {
  it('kapanmış kayıtta null, ileri tarihte 0, geçmişte gün sayısı', () => {
    assert.equal(overdueDays('2026-07-20', false, TODAY), null);
    assert.equal(overdueDays('2026-08-15', true, TODAY), 0);
    assert.equal(overdueDays('2026-07-20', true, TODAY), 9);
    assert.equal(overdueDays(null, true, TODAY), null);
  });
});

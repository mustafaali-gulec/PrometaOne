/**
 * OnayAkisiManager — Jenerik onay akışı ekranı (FAZ 5).
 *
 * İki sekme:
 *  1) BANA ATANAN ONAYLAR — özelliğin en çok kullanılan parçası. Gecikme kovaları
 *     (bugün / 1-7 gün / 7+ gün / tarihsiz) üstte; altta "şimdi karar
 *     verebileceğiniz" ve "sıranız beklemede" listeleri AYRI durur. Sırası
 *     gelmemiş onayı yapılacak iş gibi göstermek kullanıcıyı boşa uğraştırır,
 *     ama tamamen saklamak da "bu belge bana gelecek" bilgisini gizler.
 *  2) TÜM AKIŞLAR — süzgeçli liste + seçilen akışın adımları ve karar izi.
 *
 * ÜÇ ARAYÜZ KARARI:
 *  - RED AYRI BİR DÜĞME, onaydan sonra sorulan bir soru değil. Red bütün akışı
 *    kapatır; "onayla" düğmesine basıp diyalogda yanlış seçeneği tıklamak geri
 *    alınamaz bir sonuç doğurur. Ayrıca redde gerekçe ZORUNLU tutulur — akış
 *    kapandıktan sonra "neden reddedildi" sorusunun cevabı başka yerde yok.
 *  - VEKÂLETEN ONAY GİZLENMEZ ama uyarı ile verilir: adım başkasınınsa diyalog
 *    bunu söyler. Backend zaten yönetici yetkisi istiyor (403); arayüz sürprizi
 *    önler.
 *  - İPTAL yalnız `canApprove` ile görünür ve onay ister. Başlatılmış bir onayı
 *    geri almak, bekleyen onaycıların sırasını sessizce düşürür.
 *
 * "BEN KİMİM" bilgisi JWT çözülerek değil `/approvals/mine` yanıtındaki userId
 * ile bulunur — token biçimi değişse arayüz kırılmasın.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  ApprovalDocKind,
  ApprovalFlowDto,
  ApprovalFlowSummaryDto,
  ApprovalHistoryRowDto,
  ApprovalStatus,
  ApprovalStepDto,
  MyApprovalsDto,
  PendingApprovalRowDto,
  ProjectDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import {
  approvalDecisionLabel,
  approvalDocKindLabel,
  approvalHistoryActionLabel,
  approvalModeLabel,
  approvalStatusLabel,
  csT,
} from '../../i18n';
import { useProjects } from '../hooks/useProjects';

const DOC_KINDS: ApprovalDocKind[] = [
  'contract',
  'progress',
  'material_request',
  'expense',
  'advance',
  'daily_log',
  'tracking',
  'boq',
  'measurement',
  'payment',
];
const STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

export interface OnayAkisiManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
  /**
   * Yönetici yetkisi: akışı iptal etmek ve BAŞKASININ adımına vekâleten karar
   * vermek. Backend ayrıca denetler (403) — burası sürprizi önler.
   */
  canApprove?: boolean | undefined;
  /** Yeni akış başlatma yetkisi (yazma). */
  canCreate?: boolean | undefined;
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
  /** Doğrudan bir akışın ayrıntısıyla açmak için (belge satırından geliş). */
  initialFlowId?: number | undefined;
}

const box: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 12,
  background: '#fff',
};
const label: CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 2 };
const input: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};
const btn: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: 12,
};
const btnPrimary: CSSProperties = {
  ...btn,
  background: '#16a34a',
  borderColor: '#16a34a',
  color: '#fff',
};
const btnDanger: CSSProperties = {
  ...btn,
  background: '#fff',
  borderColor: '#fca5a5',
  color: '#b91c1c',
};
const errBox: CSSProperties = {
  border: '1px solid #fca5a5',
  background: '#fef2f2',
  color: '#b91c1c',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
};
const okBox: CSSProperties = {
  ...errBox,
  border: '1px solid #86efac',
  background: '#f0fdf4',
  color: '#15803d',
};
const warnBox: CSSProperties = {
  ...errBox,
  border: '1px solid #fcd34d',
  background: '#fffbeb',
  color: '#b45309',
};
const th: CSSProperties = {
  padding: '5px 7px',
  fontSize: 11,
  color: '#334155',
  background: '#f8fafc',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #e2e8f0',
  fontWeight: 600,
};
const td: CSSProperties = {
  padding: '5px 7px',
  fontSize: 12,
  borderTop: '1px solid #f1f5f9',
  textAlign: 'left',
};

const DECISION_COLOR: Record<string, string> = {
  pending: '#b45309',
  approved: '#15803d',
  delegated: '#0369a1',
  rejected: '#b91c1c',
  skipped: '#94a3b8',
};
const STATUS_COLOR: Record<string, string> = {
  pending: '#b45309',
  approved: '#15803d',
  rejected: '#b91c1c',
  cancelled: '#64748b',
};

/** ISO zaman damgasını yerel kısa biçime çevirir; boşsa "—". */
const dt = (v: string | null): string => (v === null ? '—' : new Date(v).toLocaleString('tr-TR'));

export function OnayAkisiManager({
  api,
  companyId,
  lang,
  canApprove,
  canCreate,
  confirmAsync,
  initialFlowId,
}: OnayAkisiManagerProps): JSX.Element {
  const [tab, setTab] = useState<'inbox' | 'flows'>(
    initialFlowId === undefined ? 'inbox' : 'flows',
  );
  const [mine, setMine] = useState<MyApprovalsDto | null>(null);
  const [flows, setFlows] = useState<ReadonlyArray<ApprovalFlowSummaryDto>>([]);
  const [flow, setFlow] = useState<ApprovalFlowDto | null>(null);
  const [history, setHistory] = useState<ReadonlyArray<ApprovalHistoryRowDto>>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Süzgeçler (Tüm Akışlar sekmesi)
  const [fDocKind, setFDocKind] = useState<ApprovalDocKind | ''>('');
  const [fStatus, setFStatus] = useState<ApprovalStatus | ''>('pending');
  const [fProjectId, setFProjectId] = useState<number>(0);
  const [fOverdue, setFOverdue] = useState(false);

  /** Karar diyaloğu: hangi adım, onay mı red mi. */
  const [decision, setDecision] = useState<{ step: ApprovalStepDto; approve: boolean } | null>(
    null,
  );

  const { projects } = useProjects(api, companyId);

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );

  const confirm = useCallback(
    async (msg: string): Promise<boolean> => {
      if (confirmAsync) return confirmAsync(msg);
      return Promise.resolve(globalThis.confirm(msg));
    },
    [confirmAsync],
  );

  const loadMine = useCallback(async (): Promise<void> => {
    try {
      setMine(await api.getMyApprovals(companyId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId]);

  const loadFlows = useCallback(async (): Promise<void> => {
    try {
      const res = await api.listApprovalFlows(companyId, {
        ...(fDocKind === '' ? {} : { docKind: fDocKind }),
        ...(fStatus === '' ? {} : { status: fStatus }),
        ...(fProjectId > 0 ? { projectId: fProjectId } : {}),
        ...(fOverdue ? { overdueOnly: true } : {}),
      });
      setFlows(res.flows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, fDocKind, fStatus, fProjectId, fOverdue]);

  const openFlow = useCallback(
    async (flowId: number): Promise<void> => {
      setError(null);
      try {
        const [f, h] = await Promise.all([
          api.getApprovalFlow(flowId, companyId),
          api.getApprovalHistory(flowId, companyId),
        ]);
        setFlow(f);
        setHistory(h.history);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api, companyId],
  );

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    if (tab === 'flows') void loadFlows();
  }, [tab, loadFlows]);

  useEffect(() => {
    if (initialFlowId !== undefined) void openFlow(initialFlowId);
  }, [initialFlowId, openFlow]);

  const myUserId = mine?.userId ?? null;

  /** Karar sonrası: akış, liste ve kutu birlikte tazelenir. */
  const refreshAll = useCallback(
    async (flowId: number): Promise<void> => {
      await Promise.all([openFlow(flowId), loadMine(), tab === 'flows' ? loadFlows() : undefined]);
    },
    [openFlow, loadMine, loadFlows, tab],
  );

  const submitDecision = async (comment: string): Promise<void> => {
    if (decision === null || flow === null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.decideApprovalStep(flow.id, decision.step.id, {
        companyId,
        approve: decision.approve,
        ...(comment.trim() === '' ? {} : { comment: comment.trim() }),
      });
      setDecision(null);
      await refreshAll(flow.id);
      if (!decision.approve) setInfo(t('cs.apr.msg.rejected'));
      else if (res.completed) setInfo(t('cs.apr.msg.flowCompleted'));
      else setInfo(t('cs.apr.msg.approved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Kutudaki satırdan karar: adım bilgisini akışın kendisinden alır. Satırda
   * adım kimliği var ama karar diyaloğu "bu adım benim mi" sorusunu sormak için
   * tam adıma ihtiyaç duyuyor.
   */
  const decideFromInbox = async (row: PendingApprovalRowDto, approve: boolean): Promise<void> => {
    setError(null);
    try {
      const f = await api.getApprovalFlow(row.flowId, companyId);
      const step = f.steps.find((s) => s.id === row.stepId);
      if (step === undefined) return;
      const h = await api.getApprovalHistory(row.flowId, companyId);
      setFlow(f);
      setHistory(h.history);
      setDecision({ step, approve });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cancelFlow = async (): Promise<void> => {
    if (flow === null) return;
    if (!(await confirm(t('cs.apr.msg.cancelConfirm')))) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await api.cancelApprovalFlow(flow.id, companyId);
      await refreshAll(flow.id);
      setInfo(t('cs.apr.msg.cancelled'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('cs.apr.title')}</h3>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('cs.apr.subtitle')}</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0' }}>
        {(['inbox', 'flows'] as const).map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderBottom: tab === tb ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === tb ? 600 : 400,
              color: tab === tb ? '#1d4ed8' : '#475569',
            }}
          >
            {tb === 'inbox' ? t('cs.apr.tab.inbox') : t('cs.apr.tab.flows')}
            {tb === 'inbox' && mine !== null && mine.actionable.length > 0
              ? ` (${String(mine.actionable.length)})`
              : ''}
          </button>
        ))}
      </div>

      {error !== null && <div style={errBox}>{error}</div>}
      {info !== null && <div style={okBox}>{info}</div>}

      {tab === 'inbox' ? (
        <InboxPanel
          mine={mine}
          lang={lang}
          onOpen={(flowId) => {
            setTab('flows');
            void openFlow(flowId);
          }}
          onDecide={(row, approve) => void decideFromInbox(row, approve)}
        />
      ) : (
        <>
          <div
            style={{ ...box, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div style={{ minWidth: 180 }}>
              <span style={label}>{t('cs.apr.c.docKind')}</span>
              <select
                style={input}
                value={fDocKind}
                onChange={(e) => setFDocKind(e.target.value as ApprovalDocKind | '')}
              >
                <option value="">{t('cs.apr.f.allKinds')}</option>
                {DOC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {approvalDocKindLabel(k, lang)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 150 }}>
              <span style={label}>{t('cs.common.status')}</span>
              <select
                style={input}
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as ApprovalStatus | '')}
              >
                <option value="">{t('cs.apr.f.allStatuses')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {approvalStatusLabel(s, lang)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 200 }}>
              <span style={label}>{t('cs.common.project')}</span>
              <select
                style={input}
                value={fProjectId === 0 ? '' : String(fProjectId)}
                onChange={(e) => setFProjectId(e.target.value === '' ? 0 : Number(e.target.value))}
              >
                <option value="">{t('cs.apr.f.allProjects')}</option>
                {projects.map((p: ProjectDto) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={fOverdue}
                onChange={(e) => setFOverdue(e.target.checked)}
              />
              {t('cs.apr.f.overdueOnly')}
            </label>
            <button type="button" style={btn} onClick={() => void loadFlows()}>
              {t('cs.common.refresh')}
            </button>
            {canCreate === true && (
              <button type="button" style={btn} onClick={() => setShowNew((v) => !v)}>
                {showNew ? t('cs.common.close') : t('cs.apr.new.title')}
              </button>
            )}
          </div>

          {showNew && canCreate === true && (
            <NewFlowForm
              lang={lang}
              projects={projects}
              busy={busy}
              onCancel={() => setShowNew(false)}
              onSubmit={async (body) => {
                setBusy(true);
                setError(null);
                setInfo(null);
                try {
                  const created = await api.startApprovalFlow({ companyId, ...body });
                  setShowNew(false);
                  setInfo(t('cs.apr.msg.started'));
                  await loadFlows();
                  await openFlow(created.id);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}

          <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
            <div
              style={{
                padding: '6px 10px',
                fontSize: 12,
                color: '#64748b',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              {t('cs.apr.flows.count', { n: flows.length })}
            </div>
            {flows.length === 0 ? (
              <div style={{ padding: 12, fontSize: 13, color: '#64748b' }}>
                {t('cs.apr.flows.empty')}
              </div>
            ) : (
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={th}>{t('cs.apr.c.doc')}</th>
                    <th style={th}>{t('cs.apr.c.title')}</th>
                    <th style={th}>{t('cs.apr.c.mode')}</th>
                    <th style={th}>{t('cs.common.status')}</th>
                    <th style={th}>{t('cs.apr.c.progress')}</th>
                    <th style={th}>{t('cs.apr.c.nextApprover')}</th>
                    <th style={th}>{t('cs.apr.c.dueDate')}</th>
                    <th style={th}>{t('cs.apr.c.overdue')}</th>
                    <th style={th}>{t('cs.apr.c.createdAt')}</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {flows.map((f) => (
                    <tr
                      key={f.flowId}
                      style={flow?.id === f.flowId ? { background: '#eff6ff' } : undefined}
                    >
                      <td style={td}>
                        {approvalDocKindLabel(f.docKind, lang)} #{String(f.docId)}
                      </td>
                      <td style={td}>{f.title ?? '—'}</td>
                      <td style={td}>{approvalModeLabel(f.mode, lang)}</td>
                      <td style={{ ...td, color: STATUS_COLOR[f.status], fontWeight: 600 }}>
                        {approvalStatusLabel(f.status, lang)}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {String(f.approvedCount)}/{String(f.requiredCount)}
                      </td>
                      <td style={td}>
                        {f.currentApproverUserId === null
                          ? '—'
                          : t('cs.apr.user', { id: f.currentApproverUserId })}
                      </td>
                      <td style={td}>{f.nextDueDate ?? t('cs.apr.noDueDate')}</td>
                      <td style={{ ...td, color: '#b91c1c', fontWeight: 600 }}>
                        {f.daysOverdue !== null && f.daysOverdue > 0
                          ? t('cs.apr.days', { n: f.daysOverdue })
                          : ''}
                      </td>
                      <td style={{ ...td, color: '#64748b' }}>{dt(f.createdAt)}</td>
                      <td style={td}>
                        <button type="button" style={btn} onClick={() => void openFlow(f.flowId)}>
                          {t('cs.apr.act.detail')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {flow !== null && (
            <FlowDetail
              flow={flow}
              history={history}
              lang={lang}
              myUserId={myUserId}
              canApprove={canApprove === true}
              busy={busy}
              onDecide={(step, approve) => setDecision({ step, approve })}
              onCancelFlow={() => void cancelFlow()}
              onClose={() => setFlow(null)}
            />
          )}
        </>
      )}

      {decision !== null && flow !== null && (
        <DecisionDialog
          step={decision.step}
          approve={decision.approve}
          flow={flow}
          lang={lang}
          myUserId={myUserId}
          busy={busy}
          onClose={() => setDecision(null)}
          onSubmit={(comment) => void submitDecision(comment)}
        />
      )}
    </div>
  );
}

// ===== Bana atanan onaylar ==================================================

function InboxPanel({
  mine,
  lang,
  onOpen,
  onDecide,
}: {
  mine: MyApprovalsDto | null;
  lang: string | undefined;
  onOpen: (flowId: number) => void;
  onDecide: (row: PendingApprovalRowDto, approve: boolean) => void;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  if (mine === null) {
    return <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.common.loading')}</div>;
  }

  const total = mine.actionable.length + mine.waiting.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...box, display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <Bucket label={t('cs.apr.b.dueToday')} value={mine.buckets.dueToday} color="#334155" />
        <Bucket
          label={t('cs.apr.b.overdue1to7')}
          value={mine.buckets.overdue1to7}
          color="#b45309"
        />
        <Bucket
          label={t('cs.apr.b.overdueOver7')}
          value={mine.buckets.overdueOver7}
          color="#b91c1c"
        />
        <Bucket label={t('cs.apr.b.upcoming')} value={mine.buckets.upcoming} color="#0369a1" />
        <Bucket label={t('cs.apr.b.noDueDate')} value={mine.buckets.noDueDate} color="#64748b" />
      </div>

      {total === 0 ? (
        <div style={{ ...box, color: '#64748b', fontSize: 13 }}>{t('cs.apr.inbox.empty')}</div>
      ) : (
        <>
          <InboxList
            title={`${t('cs.apr.inbox.actionable')} (${String(mine.actionable.length)})`}
            rows={mine.actionable}
            lang={lang}
            showActions
            onOpen={onOpen}
            onDecide={onDecide}
          />
          {mine.waiting.length > 0 && (
            <InboxList
              title={`${t('cs.apr.inbox.waiting')} (${String(mine.waiting.length)})`}
              hint={t('cs.apr.inbox.waitingHint')}
              rows={mine.waiting}
              lang={lang}
              showActions={false}
              onOpen={onOpen}
              onDecide={onDecide}
            />
          )}
        </>
      )}
    </div>
  );
}

function Bucket({
  label: lbl,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): JSX.Element {
  return (
    <div>
      <span style={label}>{lbl}</span>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color }}>{String(value)}</div>
    </div>
  );
}

function InboxList({
  title,
  hint,
  rows,
  lang,
  showActions,
  onOpen,
  onDecide,
}: {
  title: string;
  hint?: string;
  rows: ReadonlyArray<PendingApprovalRowDto>;
  lang: string | undefined;
  showActions: boolean;
  onOpen: (flowId: number) => void;
  onDecide: (row: PendingApprovalRowDto, approve: boolean) => void;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  return (
    <div style={{ ...box, padding: 0 }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {hint !== undefined && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{hint}</div>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 10, fontSize: 12, color: '#64748b' }}>
          {t('cs.common.noRecords')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.apr.c.doc')}</th>
                <th style={th}>{t('cs.apr.c.title')}</th>
                <th style={th}>{t('cs.apr.c.mode')}</th>
                <th style={th}>{t('cs.apr.c.seq')}</th>
                <th style={th}>{t('cs.apr.c.dueDate')}</th>
                <th style={th}>{t('cs.apr.c.overdue')}</th>
                <th style={th}>{t('cs.apr.c.createdAt')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const late = r.daysOverdue !== null && r.daysOverdue > 0;
                return (
                  <tr key={r.stepId} style={late ? { background: '#fef2f2' } : undefined}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {approvalDocKindLabel(r.docKind, lang)} #{String(r.docId)}
                    </td>
                    <td style={td}>{r.title ?? '—'}</td>
                    <td style={td}>{approvalModeLabel(r.mode, lang)}</td>
                    <td style={td}>{String(r.seqNo)}</td>
                    <td style={td}>{r.dueDate ?? t('cs.apr.noDueDate')}</td>
                    <td style={{ ...td, color: '#b91c1c', fontWeight: 600 }}>
                      {late ? t('cs.apr.days', { n: r.daysOverdue ?? 0 }) : ''}
                    </td>
                    <td style={{ ...td, color: '#64748b' }}>{dt(r.flowCreatedAt)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {showActions && (
                        <>
                          <button
                            type="button"
                            style={btnPrimary}
                            onClick={() => onDecide(r, true)}
                          >
                            {t('cs.apr.act.approve')}
                          </button>{' '}
                          <button
                            type="button"
                            style={btnDanger}
                            onClick={() => onDecide(r, false)}
                          >
                            {t('cs.apr.act.reject')}
                          </button>{' '}
                        </>
                      )}
                      <button type="button" style={btn} onClick={() => onOpen(r.flowId)}>
                        {t('cs.apr.act.detail')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== Akış ayrıntısı =======================================================

function FlowDetail({
  flow,
  history,
  lang,
  myUserId,
  canApprove,
  busy,
  onDecide,
  onCancelFlow,
  onClose,
}: {
  flow: ApprovalFlowDto;
  history: ReadonlyArray<ApprovalHistoryRowDto>;
  lang: string | undefined;
  myUserId: number | null;
  canApprove: boolean;
  busy: boolean;
  onDecide: (step: ApprovalStepDto, approve: boolean) => void;
  onCancelFlow: () => void;
  onClose: () => void;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  return (
    <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {approvalDocKindLabel(flow.docKind, lang)} #{String(flow.docId)}
            {flow.title === null ? '' : ` · ${flow.title}`}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {approvalModeLabel(flow.mode, lang)} ·{' '}
            {flow.mode === 'ordered'
              ? t('cs.apr.mode.orderedHint')
              : t('cs.apr.mode.unorderedHint')}
          </div>
          {flow.note !== null && <div style={{ fontSize: 12, marginTop: 4 }}>{flow.note}</div>}
        </div>
        <div>
          <span style={label}>{t('cs.common.status')}</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: STATUS_COLOR[flow.status] }}>
            {approvalStatusLabel(flow.status, lang)}
          </div>
        </div>
        <div>
          <span style={label}>{t('cs.apr.c.progress')}</span>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {String(flow.approvedCount)}/{String(flow.requiredCount)}
          </div>
        </div>
        <div>
          <span style={label} title={t('cs.apr.new.minApprovalsHint')}>
            {t('cs.apr.c.minApprovals')}
          </span>
          <div style={{ fontSize: 13 }}>
            {flow.minApprovals === null
              ? t('cs.apr.new.allMustApprove')
              : String(flow.minApprovals)}
          </div>
        </div>
        <div>
          <span style={label}>{t('cs.apr.c.createdAt')}</span>
          <div style={{ fontSize: 13 }}>{dt(flow.createdAt)}</div>
        </div>
        {flow.completedAt !== null && (
          <div>
            <span style={label}>{t('cs.apr.c.completedAt')}</span>
            <div style={{ fontSize: 13 }}>{dt(flow.completedAt)}</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {flow.open && canApprove && (
            <button type="button" style={btnDanger} disabled={busy} onClick={onCancelFlow}>
              {t('cs.apr.act.cancelFlow')}
            </button>
          )}
          <button type="button" style={btn} onClick={onClose}>
            {t('cs.common.close')}
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('cs.apr.steps')}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={th}>{t('cs.apr.c.seq')}</th>
                <th style={th}>{t('cs.apr.c.approver')}</th>
                <th style={th}>{t('cs.apr.c.dueDate')}</th>
                <th style={th}>{t('cs.apr.c.decision')}</th>
                <th style={th}>{t('cs.apr.c.decidedAt')}</th>
                <th style={th}>{t('cs.apr.c.decidedBy')}</th>
                <th style={th}>{t('cs.apr.c.comment')}</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {flow.steps.map((s) => {
                const mineStep = myUserId !== null && s.approverUserId === myUserId;
                // Kendi adımı her zaman; başkasının adımı yalnız yönetici (vekâleten).
                const mayDecide = s.actionable && flow.open && (mineStep || canApprove);
                const late = s.daysOverdue !== null && s.daysOverdue > 0;
                return (
                  <tr
                    key={s.id}
                    style={
                      s.actionable && flow.open
                        ? { background: late ? '#fef2f2' : '#fffbeb' }
                        : undefined
                    }
                  >
                    <td style={td}>{String(s.seqNo)}</td>
                    <td style={{ ...td, fontWeight: mineStep ? 700 : 400 }}>
                      {t('cs.apr.user', { id: s.approverUserId })}
                      {mineStep ? ` (${t('cs.apr.you')})` : ''}
                    </td>
                    <td style={td}>
                      {s.dueDate ?? t('cs.apr.noDueDate')}
                      {late ? ` · ${t('cs.apr.days', { n: s.daysOverdue ?? 0 })}` : ''}
                    </td>
                    <td style={{ ...td, color: DECISION_COLOR[s.decision], fontWeight: 600 }}>
                      {approvalDecisionLabel(s.decision, lang)}
                    </td>
                    <td style={{ ...td, color: '#64748b' }}>{dt(s.decidedAt)}</td>
                    <td style={td}>
                      {s.decidedBy === null ? '—' : t('cs.apr.user', { id: s.decidedBy })}
                    </td>
                    <td style={{ ...td, whiteSpace: 'normal' }}>{s.comment ?? '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {mayDecide && (
                        <>
                          <button
                            type="button"
                            style={btnPrimary}
                            disabled={busy}
                            onClick={() => onDecide(s, true)}
                          >
                            {t('cs.apr.act.approve')}
                          </button>{' '}
                          <button
                            type="button"
                            style={btnDanger}
                            disabled={busy}
                            onClick={() => onDecide(s, false)}
                          >
                            {t('cs.apr.act.reject')}
                          </button>
                        </>
                      )}
                      {s.actionable && flow.open && !mayDecide && (
                        <span
                          style={{ fontSize: 11, color: '#94a3b8' }}
                          title={t('cs.apr.selfOnly')}
                        >
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {t('cs.apr.history.title')}
        </div>
        {history.length === 0 ? (
          <div style={{ fontSize: 12, color: '#64748b' }}>{t('cs.apr.history.empty')}</div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#334155' }}>
            {history.map((h) => (
              <li key={h.id} style={{ marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>
                  {approvalHistoryActionLabel(h.action, lang)}
                </span>
                {' · '}
                {h.actor === null ? '—' : t('cs.apr.user', { id: h.actor })}
                {' · '}
                <span style={{ color: '#64748b' }}>{dt(h.createdAt)}</span>
                {h.note === null ? '' : ` · ${h.note}`}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// ===== Karar diyaloğu =======================================================

function DecisionDialog({
  step,
  approve,
  flow,
  lang,
  myUserId,
  busy,
  onClose,
  onSubmit,
}: {
  step: ApprovalStepDto;
  approve: boolean;
  flow: ApprovalFlowDto;
  lang: string | undefined;
  myUserId: number | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
}): JSX.Element {
  const [comment, setComment] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const delegating = myUserId !== null && step.approverUserId !== myUserId;

  const submit = (): void => {
    // Red gerekçesi ZORUNLU: akış kapandıktan sonra "neden" başka yerde yok.
    if (!approve && comment.trim() === '') {
      setLocalError(t('cs.apr.dlg.reasonRequired'));
      return;
    }
    setLocalError(null);
    onSubmit(comment);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div style={{ ...box, width: 460, maxWidth: '100%', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {approve ? t('cs.apr.dlg.approveTitle') : t('cs.apr.dlg.rejectTitle')}
        </div>
        <div style={{ fontSize: 12, color: '#475569' }}>
          {approvalDocKindLabel(flow.docKind, lang)} #{String(flow.docId)}
          {flow.title === null ? '' : ` · ${flow.title}`}
          {' · '}
          {t('cs.apr.c.seq')} {String(step.seqNo)}
        </div>

        {!approve && <div style={warnBox}>{t('cs.apr.dlg.rejectWarn')}</div>}
        {delegating && <div style={warnBox}>{t('cs.apr.dlg.delegateWarn')}</div>}

        <div>
          <span style={label}>
            {approve ? t('cs.apr.dlg.commentApprove') : t('cs.apr.dlg.commentReject')}
          </span>
          <textarea
            style={{ ...input, minHeight: 76, resize: 'vertical' }}
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        {localError !== null && <div style={errBox}>{localError}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={btn} onClick={onClose}>
            {t('cs.common.cancel')}
          </button>
          <button
            type="button"
            style={approve ? btnPrimary : { ...btnDanger, background: '#b91c1c', color: '#fff' }}
            disabled={busy}
            onClick={submit}
          >
            {busy
              ? t('cs.common.loading')
              : approve
                ? t('cs.apr.act.approve')
                : t('cs.apr.act.reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Yeni akış formu ======================================================

interface NewFlowDraft {
  docKind: ApprovalDocKind;
  docId: number;
  projectId?: number | null;
  mode?: 'ordered' | 'unordered';
  minApprovals?: number | null;
  title?: string | null;
  note?: string | null;
  approvers: { approverUserId: number; dueDate?: string | null }[];
}

function NewFlowForm({
  lang,
  projects,
  busy,
  onCancel,
  onSubmit,
}: {
  lang: string | undefined;
  projects: ReadonlyArray<ProjectDto>;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: NewFlowDraft) => Promise<void>;
}): JSX.Element {
  const t = (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>): string =>
    csT(k, lang, vars);

  const [docKind, setDocKind] = useState<ApprovalDocKind>('progress');
  const [docId, setDocId] = useState('');
  const [projectId, setProjectId] = useState(0);
  const [mode, setMode] = useState<'ordered' | 'unordered'>('ordered');
  const [minApprovals, setMinApprovals] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<{ userId: string; dueDate: string }[]>([
    { userId: '', dueDate: '' },
  ]);
  const [localError, setLocalError] = useState<string | null>(null);

  const approvers = useMemo(
    () =>
      rows
        .map((r) => ({ id: Number(r.userId.trim()), dueDate: r.dueDate.trim() }))
        .filter((r) => Number.isFinite(r.id) && r.id > 0),
    [rows],
  );

  const submit = (): void => {
    const id = Number(docId.trim());
    if (!Number.isFinite(id) || id <= 0) {
      setLocalError(t('cs.common.required'));
      return;
    }
    if (approvers.length === 0) {
      setLocalError(t('cs.apr.new.needApprover'));
      return;
    }
    if (new Set(approvers.map((a) => a.id)).size !== approvers.length) {
      setLocalError(t('cs.apr.new.dupApprover'));
      return;
    }
    const min = minApprovals.trim() === '' ? null : Number(minApprovals.trim());
    if (min !== null && (!Number.isFinite(min) || min < 1 || min > approvers.length)) {
      setLocalError(t('cs.apr.new.minApprovalsHint'));
      return;
    }
    setLocalError(null);
    void onSubmit({
      docKind,
      docId: id,
      projectId: projectId > 0 ? projectId : null,
      mode,
      minApprovals: min,
      title: title.trim() === '' ? null : title.trim(),
      note: note.trim() === '' ? null : note.trim(),
      approvers: approvers.map((a) => ({
        approverUserId: a.id,
        dueDate: a.dueDate === '' ? null : a.dueDate,
      })),
    });
  };

  return (
    <div style={{ ...box, display: 'grid', gap: 10 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('cs.apr.new.title')}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t('cs.apr.new.hint')}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 170 }}>
          <span style={label}>{t('cs.apr.c.docKind')}</span>
          <select
            style={input}
            value={docKind}
            onChange={(e) => setDocKind(e.target.value as ApprovalDocKind)}
          >
            {DOC_KINDS.map((k) => (
              <option key={k} value={k}>
                {approvalDocKindLabel(k, lang)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ width: 110 }}>
          <span style={label}>{t('cs.apr.c.doc')} #</span>
          <input style={input} value={docId} onChange={(e) => setDocId(e.target.value)} />
        </div>
        <div style={{ minWidth: 190 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId === 0 ? '' : String(projectId)}
            onChange={(e) => setProjectId(e.target.value === '' ? 0 : Number(e.target.value))}
          >
            <option value="">{t('cs.common.none')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 150 }}>
          <span style={label}>{t('cs.apr.c.mode')}</span>
          <select
            style={input}
            value={mode}
            onChange={(e) => setMode(e.target.value as 'ordered' | 'unordered')}
          >
            <option value="ordered">{t('cs.apr.mode.ordered')}</option>
            <option value="unordered">{t('cs.apr.mode.unordered')}</option>
          </select>
        </div>
        <div style={{ width: 130 }}>
          <span style={label} title={t('cs.apr.new.minApprovalsHint')}>
            {t('cs.apr.c.minApprovals')}
          </span>
          <input
            style={input}
            value={minApprovals}
            placeholder={t('cs.apr.new.allMustApprove')}
            onChange={(e) => setMinApprovals(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span style={label}>{t('cs.apr.c.title')}</span>
          <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>

      <div>
        <span style={label}>{t('cs.common.note')}</span>
        <textarea
          style={{ ...input, minHeight: 46, resize: 'vertical' }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          {t('cs.apr.new.approvers')}
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-end' }}>
            <div style={{ width: 34, fontSize: 12, color: '#64748b', paddingBottom: 7 }}>
              {String(i + 1)}.
            </div>
            <div style={{ width: 140 }}>
              <span style={label}>{t('cs.apr.new.userId')}</span>
              <input
                style={input}
                value={r.userId}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, userId: e.target.value } : x)),
                  )
                }
              />
            </div>
            <div style={{ width: 170 }}>
              <span style={label}>{t('cs.apr.c.dueDate')}</span>
              <input
                type="date"
                style={input}
                value={r.dueDate}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)),
                  )
                }
              />
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                style={btnDanger}
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                {t('cs.common.delete')}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          style={btn}
          onClick={() => setRows((prev) => [...prev, { userId: '', dueDate: '' }])}
        >
          {t('cs.apr.new.addApprover')}
        </button>
      </div>

      {localError !== null && <div style={errBox}>{localError}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" style={btn} onClick={onCancel}>
          {t('cs.common.cancel')}
        </button>
        <button
          type="button"
          style={{ ...btnPrimary, background: '#2563eb', borderColor: '#2563eb' }}
          disabled={busy}
          onClick={submit}
        >
          {busy ? t('cs.common.loading') : t('cs.apr.act.start')}
        </button>
      </div>
    </div>
  );
}

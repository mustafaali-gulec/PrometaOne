/**
 * MetrajManager — Yeşil Defter (kümülatif metraj) + Ataşman (ölçü-detayı). SF-8.
 *
 * Sözleşme seç → keşif satırı bazında yeşil defter kayıtları + kümülatif özet.
 * Bir kayda ataşman eklenince (formül/boyut a×b×c×adet → miktar) yeşil defter
 * ölçülen metrajı ataşman toplamına otomatik senkronlanır (backend).
 */
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  AttachmentDto,
  BoqLineDto,
  ContractDto,
  MeasurementDto,
  MeasurementSummaryLineDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { useContracts } from '../hooks/useContracts';

interface Props {
  api: ConstructionApi;
  companyId: number;
}

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Ataşman miktarı önizleme (backend computeAttachmentQty ile aynı mantık). */
function previewQty(
  dimA: string,
  dimB: string,
  dimC: string,
  countN: string,
  manual: string,
): number {
  const a = numOrNull(dimA);
  const b = numOrNull(dimB);
  const c = numOrNull(dimC);
  const n = numOrNull(countN);
  const hasDim = a != null || b != null || c != null;
  if (!hasDim) return Math.max(0, numOrNull(manual) ?? 0);
  return Math.max(0, (a ?? 1) * (b ?? 1) * (c ?? 1) * (n ?? 1));
}

export function MetrajManager({ api, companyId }: Props): JSX.Element {
  const { contracts } = useContracts(api, companyId);
  const [contractId, setContractId] = useState<number>(0);
  const [boqLines, setBoqLines] = useState<ReadonlyArray<BoqLineDto>>([]);
  const [measurements, setMeasurements] = useState<ReadonlyArray<MeasurementDto>>([]);
  const [summary, setSummary] = useState<ReadonlyArray<MeasurementSummaryLineDto>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Yeni yeşil defter kaydı formu
  const [boqLineId, setBoqLineId] = useState<number>(0);
  const [measuredAt, setMeasuredAt] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Ataşman paneli
  const [openId, setOpenId] = useState<number>(0);
  const [attachments, setAttachments] = useState<ReadonlyArray<AttachmentDto>>([]);
  const [aFormula, setAFormula] = useState('');
  const [aDimA, setADimA] = useState('');
  const [aDimB, setADimB] = useState('');
  const [aDimC, setADimC] = useState('');
  const [aCount, setACount] = useState('');
  const [aManual, setAManual] = useState('');
  const [aFile, setAFile] = useState('');

  const boqLabel = useCallback(
    (id: number): string => {
      const l = boqLines.find((x) => x.id === id);
      return l ? `${l.pozNo ? l.pozNo + ' · ' : ''}${l.description} (${l.unit})` : `#${String(id)}`;
    },
    [boqLines],
  );

  const reload = useCallback(async () => {
    if (!(contractId > 0)) {
      setBoqLines([]);
      setMeasurements([]);
      setSummary([]);
      return;
    }
    setError(null);
    try {
      const [boq, ms, sum] = await Promise.all([
        api.getBoq(contractId, companyId),
        api.listMeasurements(companyId, contractId),
        api.getMeasurementSummary(contractId, companyId),
      ]);
      setBoqLines(boq.lines);
      setMeasurements(ms.measurements);
      setSummary(sum.lines);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [api, companyId, contractId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadAttachments = useCallback(
    async (mid: number) => {
      try {
        const res = await api.listAttachments(companyId, mid);
        setAttachments(res.attachments);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, companyId],
  );

  const toggleOpen = async (mid: number): Promise<void> => {
    if (openId === mid) {
      setOpenId(0);
      setAttachments([]);
      return;
    }
    setOpenId(mid);
    await loadAttachments(mid);
  };

  const addMeasurement = async (): Promise<void> => {
    if (!(boqLineId > 0)) {
      setError('Keşif satırı seçin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createMeasurement({
        companyId,
        contractId,
        boqLineId,
        measuredAt: measuredAt || null,
        note: note.trim() || null,
      });
      setBoqLineId(0);
      setMeasuredAt('');
      setNote('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeMeasurement = async (mid: number): Promise<void> => {
    setBusy(true);
    try {
      await api.deleteMeasurement(mid, companyId);
      if (openId === mid) setOpenId(0);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const addAttachment = async (mid: number): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api.createAttachment({
        companyId,
        measurementId: mid,
        formula: aFormula.trim() || null,
        dimA: numOrNull(aDimA),
        dimB: numOrNull(aDimB),
        dimC: numOrNull(aDimC),
        countN: numOrNull(aCount),
        manualQty: numOrNull(aManual),
        fileUrl: aFile.trim() || null,
      });
      setAFormula('');
      setADimA('');
      setADimB('');
      setADimC('');
      setACount('');
      setAManual('');
      setAFile('');
      await loadAttachments(mid);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeAttachment = async (aid: number, mid: number): Promise<void> => {
    setBusy(true);
    try {
      await api.deleteAttachment(aid, companyId);
      await loadAttachments(mid);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const th: CSSProperties = {
    textAlign: 'left',
    padding: '6px 8px',
    fontSize: 12,
    color: 'var(--ink-mute)',
  };
  const td: CSSProperties = {
    padding: '6px 8px',
    fontSize: 13,
    borderTop: '1px solid var(--line)',
  };
  const inp = 'input';

  return (
    <div className="space-y-3">
      <div className="card p-2 flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Sözleşme</span>
        <select
          className={inp}
          value={contractId}
          onChange={(e) => {
            setContractId(Number(e.target.value));
            setOpenId(0);
          }}
          style={{ minWidth: 260 }}
        >
          <option value={0}>— Seçin —</option>
          {contracts.map((c: ContractDto) => (
            <option key={c.id} value={c.id}>
              {c.contractNo ? c.contractNo + ' · ' : ''}
              {c.title} ({c.partyKind === 'employer' ? 'İşveren' : 'Taşeron'})
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="card p-2" style={{ color: 'var(--negative)', fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      {contractId > 0 ? (
        <>
          {/* Kümülatif özet */}
          {summary.length > 0 ? (
            <div className="card p-2">
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                Kümülatif Metraj (keşif satırı bazında)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {summary.map((s) => (
                  <span
                    key={s.boqLineId}
                    className="chip"
                    style={{
                      fontSize: 11,
                      background: 'var(--bg-alt)',
                      padding: '3px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {boqLabel(s.boqLineId)}: <strong>{s.totalMeasured}</strong>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Yeni yeşil defter kaydı */}
          <div className="card p-2 flex items-end gap-2" style={{ flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Keşif Satırı</div>
              <select
                className={inp}
                value={boqLineId}
                onChange={(e) => setBoqLineId(Number(e.target.value))}
                style={{ minWidth: 240 }}
              >
                <option value={0}>— Seçin —</option>
                {boqLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {boqLabel(l.id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Ölçüm Tarihi</div>
              <input
                className={inp}
                type="date"
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>Not</div>
              <input
                className={inp}
                style={{ width: '100%' }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="dönem / açıklama"
              />
            </div>
            <button className="btn" disabled={busy} onClick={() => void addMeasurement()}>
              + Yeşil Defter Kaydı
            </button>
          </div>

          {/* Kayıt listesi */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="grid" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Keşif Satırı</th>
                  <th style={th}>Ölçülen Metraj</th>
                  <th style={th}>Tarih</th>
                  <th style={th}>Not</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {measurements.length === 0 ? (
                  <tr>
                    <td style={td} colSpan={5}>
                      <span style={{ color: 'var(--ink-mute)' }}>Henüz metraj kaydı yok.</span>
                    </td>
                  </tr>
                ) : (
                  measurements.map((m) => (
                    <MeasurementRow
                      key={m.id}
                      m={m}
                      boqLabel={boqLabel}
                      open={openId === m.id}
                      attachments={openId === m.id ? attachments : []}
                      busy={busy}
                      td={td}
                      onToggle={() => void toggleOpen(m.id)}
                      onDelete={() => void removeMeasurement(m.id)}
                      onDeleteAttachment={(aid) => void removeAttachment(aid, m.id)}
                      onAddAttachment={() => void addAttachment(m.id)}
                      preview={previewQty(aDimA, aDimB, aDimC, aCount, aManual)}
                      formState={{ aFormula, aDimA, aDimB, aDimC, aCount, aManual, aFile }}
                      setForm={{
                        setAFormula,
                        setADimA,
                        setADimB,
                        setADimC,
                        setACount,
                        setAManual,
                        setAFile,
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card p-3" style={{ color: 'var(--ink-mute)', fontSize: 13 }}>
          Yeşil defter/ataşman girmek için bir sözleşme seçin.
        </div>
      )}
    </div>
  );
}

interface RowProps {
  m: MeasurementDto;
  boqLabel: (id: number) => string;
  open: boolean;
  attachments: ReadonlyArray<AttachmentDto>;
  busy: boolean;
  td: CSSProperties;
  onToggle: () => void;
  onDelete: () => void;
  onDeleteAttachment: (aid: number) => void;
  onAddAttachment: () => void;
  preview: number;
  formState: {
    aFormula: string;
    aDimA: string;
    aDimB: string;
    aDimC: string;
    aCount: string;
    aManual: string;
    aFile: string;
  };
  setForm: {
    setAFormula: (v: string) => void;
    setADimA: (v: string) => void;
    setADimB: (v: string) => void;
    setADimC: (v: string) => void;
    setACount: (v: string) => void;
    setAManual: (v: string) => void;
    setAFile: (v: string) => void;
  };
}

function MeasurementRow(p: RowProps): JSX.Element {
  const { m, td } = p;
  return (
    <>
      <tr>
        <td style={td}>{p.boqLabel(m.boqLineId)}</td>
        <td style={{ ...td, fontWeight: 700 }}>{m.measuredQty}</td>
        <td style={td}>{m.measuredAt ?? '—'}</td>
        <td style={td}>{m.note ?? '—'}</td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>
          <button className="btn" style={{ fontSize: 11 }} onClick={p.onToggle}>
            {p.open ? 'Ataşmanı Gizle' : 'Ataşman'}
          </button>{' '}
          <button
            className="btn"
            style={{ fontSize: 11, color: 'var(--negative)' }}
            disabled={p.busy}
            onClick={p.onDelete}
          >
            Sil
          </button>
        </td>
      </tr>
      {p.open ? (
        <tr>
          <td style={{ ...td, background: 'var(--bg-alt)' }} colSpan={5}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Ataşman (ölçü-detayı) — a×b×c×adet; boyut yoksa elle miktar
            </div>
            {p.attachments.length > 0 ? (
              <div style={{ marginBottom: 8 }}>
                {p.attachments.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      padding: '2px 0',
                    }}
                  >
                    <span style={{ minWidth: 220 }}>
                      {a.formula ? a.formula + ' · ' : ''}
                      {[a.dimA, a.dimB, a.dimC].filter((x) => x != null).join(' × ')}
                      {a.countN != null ? ` × ${String(a.countN)} ad` : ''}
                    </span>
                    <strong style={{ minWidth: 70 }}>= {a.resultQty}</strong>
                    {a.fileUrl ? (
                      <a href={a.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                        dosya
                      </a>
                    ) : null}
                    <button
                      className="btn"
                      style={{ fontSize: 10, color: 'var(--negative)' }}
                      disabled={p.busy}
                      onClick={() => p.onDeleteAttachment(a.id)}
                    >
                      sil
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <input
                className="input"
                style={{ width: 130 }}
                placeholder="formül/açıklama"
                value={p.formState.aFormula}
                onChange={(e) => p.setForm.setAFormula(e.target.value)}
              />
              <input
                className="input mono"
                style={{ width: 60 }}
                placeholder="a"
                value={p.formState.aDimA}
                onChange={(e) => p.setForm.setADimA(e.target.value)}
              />
              <input
                className="input mono"
                style={{ width: 60 }}
                placeholder="b"
                value={p.formState.aDimB}
                onChange={(e) => p.setForm.setADimB(e.target.value)}
              />
              <input
                className="input mono"
                style={{ width: 60 }}
                placeholder="c"
                value={p.formState.aDimC}
                onChange={(e) => p.setForm.setADimC(e.target.value)}
              />
              <input
                className="input mono"
                style={{ width: 60 }}
                placeholder="adet"
                value={p.formState.aCount}
                onChange={(e) => p.setForm.setACount(e.target.value)}
              />
              <input
                className="input mono"
                style={{ width: 80 }}
                placeholder="elle miktar"
                value={p.formState.aManual}
                onChange={(e) => p.setForm.setAManual(e.target.value)}
              />
              <input
                className="input"
                style={{ width: 150 }}
                placeholder="dosya URL (ops.)"
                value={p.formState.aFile}
                onChange={(e) => p.setForm.setAFile(e.target.value)}
              />
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                = <strong>{p.preview}</strong>
              </span>
              <button className="btn" disabled={p.busy} onClick={p.onAddAttachment}>
                + Ataşman
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

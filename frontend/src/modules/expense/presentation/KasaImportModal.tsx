/**
 * KasaImportModal — Kasa hareketlerini Excel'den içe aktarma sihirbazı.
 *
 * Akış: dosya seç → (genel formatta) kolon eşle → "Önizle" (dosya tarayıcıda
 * matrise çevrilir, backend /v1/expense/kasa-import/parse ile çözümlenir) →
 * önizleme → "İçe Aktar". Tespit edilen gider kartları backend'e bulk-upsert
 * edilir; normalize hareketler `onConfirm` ile KasaManager'a verilir (kasa
 * blob'una eklenir). Backend bulk-import kuralı: parse mantığı use-case'te.
 */
import { useMemo, useState } from 'react';

import * as XLSX from 'xlsx';

import type {
  GenericColumnMap,
  KasaImportEntry,
  KasaImportFormat,
  KasaImportResult,
  KasaImportSheet,
} from '../application/dto/ExpenseDtos';
import { StaticAuthTokenProvider } from '../application/ports/AuthTokenProvider';
import type { ExpenseApi } from '../application/ports/ExpenseApi';
import { ExpenseApiClient } from '../infrastructure/api/ExpenseApiClient';

import { el } from './i18n';
import { extractToken } from './token';

export interface KasaAccountLite {
  id: string;
  name: string;
  currency?: string;
}

export interface KasaImportModalProps {
  apiBaseUrl?: string;
  accessToken?: string;
  companyId: number;
  lang?: string;
  kasaAccounts: ReadonlyArray<KasaAccountLite>;
  defaultKasaId?: string | null;
  onClose: () => void;
  /** Onaylanan (filtrelenmiş) hareketler + hedef kasa id. */
  onConfirm: (
    entries: ReadonlyArray<KasaImportEntry>,
    kasaAccountId: string,
  ) => void | Promise<void>;
}

const MAX_PREVIEW = 50;

/** Kolon eşleme iç durumu — tüm alanlar sayı; -1 = "yok" (undefined yerine,
 *  exactOptionalPropertyTypes uyumu için). */
interface ColMapState {
  date: number;
  description: number;
  amountIn: number;
  amountOut: number;
  amount: number;
  type: number;
  category: number;
  invoiceNo: number;
}

/** xlsx hücresini güvenli şekilde metne çevirir (object → ''). */
function stringifyCell(cell: unknown): string {
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  return '';
}

/** ColMapState → backend GenericColumnMap (negatif alanlar atlanır). */
function buildColumnMap(headerRowIndex: number, c: ColMapState): GenericColumnMap {
  const map: GenericColumnMap = { headerRowIndex, date: c.date, description: c.description };
  if (c.amountIn >= 0) map.amountIn = c.amountIn;
  if (c.amountOut >= 0) map.amountOut = c.amountOut;
  if (c.amount >= 0) map.amount = c.amount;
  if (c.type >= 0) map.type = c.type;
  if (c.category >= 0) map.category = c.category;
  if (c.invoiceNo >= 0) map.invoiceNo = c.invoiceNo;
  return map;
}

export function KasaImportModal({
  apiBaseUrl = '',
  accessToken,
  companyId,
  lang = 'tr',
  kasaAccounts,
  defaultKasaId,
  onClose,
  onConfirm,
}: KasaImportModalProps): JSX.Element {
  const api: ExpenseApi = useMemo(() => {
    const token = accessToken ?? extractToken();
    return new ExpenseApiClient(apiBaseUrl, new StaticAuthTokenProvider(token));
  }, [apiBaseUrl, accessToken]);

  const [formatId, setFormatId] = useState<KasaImportFormat>('can_tekel_daily');
  const [targetKasa, setTargetKasa] = useState<string>(defaultKasaId ?? kasaAccounts[0]?.id ?? '');
  const [includeCard, setIncludeCard] = useState<boolean>(false);
  const [createCards, setCreateCards] = useState<boolean>(true);
  const [fileName, setFileName] = useState<string>('');
  const [sheets, setSheets] = useState<KasaImportSheet[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [colMap, setColMap] = useState<ColMapState>({
    date: 0,
    description: 1,
    amountIn: 2,
    amountOut: 3,
    amount: -1,
    type: -1,
    category: -1,
    invoiceNo: -1,
  });
  const [result, setResult] = useState<KasaImportResult | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = async (file: File): Promise<void> => {
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const parsed: KasaImportSheet[] = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        if (ws === undefined) return { name, rows: [] };
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          raw: false,
          defval: '',
        });
        const rows = aoa.map((r) => (Array.isArray(r) ? r : []).map(stringifyCell));
        return { name, rows };
      });
      setSheets(parsed);
      // Genel format için ilk sayfanın başlık satırını çıkar
      const first = parsed[0];
      const hdr = first?.rows[headerRowIndex] ?? [];
      setHeaders(hdr);
    } catch (e) {
      setError(e instanceof Error ? e.message : el('imp.readError', lang));
    }
  };

  const recomputeHeaders = (rowIdx: number): void => {
    const first = sheets[0];
    setHeaders(first?.rows[rowIdx] ?? []);
  };

  const onPreview = async (): Promise<void> => {
    if (sheets.length === 0) {
      setError(el('imp.noFile', lang));
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const year = new Date().getFullYear();
      if (formatId === 'generic') {
        const firstOnly = sheets.slice(0, 1);
        const map = buildColumnMap(headerRowIndex, colMap);
        const res = await api.parseKasaImport({
          companyId,
          formatId,
          year,
          sheets: firstOnly,
          columnMap: map,
        });
        setResult(res);
      } else {
        const res = await api.parseKasaImport({ companyId, formatId, year, sheets });
        setResult(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  };

  const visibleEntries = useMemo<ReadonlyArray<KasaImportEntry>>(() => {
    if (result === null) return [];
    return includeCard ? result.entries : result.entries.filter((e) => e.paymentMethod !== 'card');
  }, [result, includeCard]);

  const onImport = async (): Promise<void> => {
    if (result === null) return;
    if (targetKasa === '') {
      setError(el('imp.targetKasa', lang));
      return;
    }
    if (visibleEntries.length === 0) {
      setError(el('imp.noEntries', lang));
      return;
    }
    setImporting(true);
    setError(null);
    try {
      if (createCards && result.expenseCards.length > 0) {
        await api.bulkUpsertExpenseCards({
          companyId,
          cards: result.expenseCards.map((c) => ({
            name: c.name,
            category: c.category,
            direction: c.direction,
          })),
        });
      }
      await onConfirm(visibleEntries, targetKasa);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImporting(false);
    }
  };

  return (
    // Yalnız doğrudan arka plana (backdrop) tıklayınca kapanır; panel içi tıklamalar
    // kapatmaz (target===currentTarget). Klavye ile kapatma "✕"/Vazgeç ile.
    <div
      style={overlay}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div style={panel} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, margin: 0, marginRight: 'auto' }}>{el('imp.title', lang)}</h2>
          <button onClick={onClose} style={btnStyle()}>
            ✕
          </button>
        </div>

        {/* Ayarlar */}
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={fieldLabel}>
              {el('imp.format', lang)}
              <select
                value={formatId}
                onChange={(ev) => {
                  setFormatId(ev.target.value as KasaImportFormat);
                  setResult(null);
                }}
                style={fieldStyle()}
              >
                <option value="can_tekel_daily">{el('imp.format.canTekel', lang)}</option>
                <option value="generic">{el('imp.format.generic', lang)}</option>
              </select>
            </label>
            <label style={fieldLabel}>
              {el('imp.targetKasa', lang)}
              <select
                value={targetKasa}
                onChange={(ev) => setTargetKasa(ev.target.value)}
                style={fieldStyle()}
              >
                {kasaAccounts.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.currency !== undefined ? ` (${k.currency})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldLabel}>
              {el('imp.file', lang)}
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.xlsm"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f !== undefined) void readFile(f);
                }}
                style={{ fontSize: 12 }}
              />
            </label>
          </div>
          {fileName !== '' ? (
            <div style={{ fontSize: 12, color: 'var(--ink-muted, #666)' }}>📄 {fileName}</div>
          ) : null}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={includeCard}
                onChange={(ev) => setIncludeCard(ev.target.checked)}
              />
              {el('imp.includeCard', lang)}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={createCards}
                onChange={(ev) => setCreateCards(ev.target.checked)}
              />
              {el('imp.createCards', lang)}
            </label>
          </div>

          {/* Genel format: kolon eşleme */}
          {formatId === 'generic' && headers.length > 0 ? (
            <GenericMapping
              lang={lang}
              headers={headers}
              headerRowIndex={headerRowIndex}
              colMap={colMap}
              onHeaderRowChange={(idx) => {
                setHeaderRowIndex(idx);
                recomputeHeaders(idx);
              }}
              onColMapChange={(m) => setColMap(m)}
            />
          ) : null}
        </div>

        {error !== null ? <div style={errorBox}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => void onPreview()}
            disabled={parsing || sheets.length === 0}
            style={btnPrimary()}
          >
            {parsing ? el('imp.parsing', lang) : el('imp.preview', lang)}
          </button>
          {result !== null ? (
            <button onClick={() => void onImport()} disabled={importing} style={btnSuccess()}>
              {importing
                ? el('imp.importing', lang)
                : `${el('imp.confirm', lang)} (${visibleEntries.length})`}
            </button>
          ) : null}
          <button onClick={onClose} style={btnStyle()}>
            {el('imp.cancel', lang)}
          </button>
        </div>

        {/* Önizleme */}
        {result !== null ? (
          <PreviewBlock lang={lang} result={result} visibleEntries={visibleEntries} />
        ) : null}
      </div>
    </div>
  );
}

function GenericMapping({
  lang,
  headers,
  headerRowIndex,
  colMap,
  onHeaderRowChange,
  onColMapChange,
}: {
  lang: string;
  headers: string[];
  headerRowIndex: number;
  colMap: ColMapState;
  onHeaderRowChange: (idx: number) => void;
  onColMapChange: (m: ColMapState) => void;
}): JSX.Element {
  const colOptions = (
    <>
      <option value={-1}>{el('imp.map.none', lang)}</option>
      {headers.map((h, i) => (
        <option key={i} value={i}>
          {i}: {h === '' ? `(col ${i})` : h}
        </option>
      ))}
    </>
  );
  const set = (patch: Partial<ColMapState>): void => {
    onColMapChange({ ...colMap, ...patch });
  };

  return (
    <div style={{ border: '1px solid var(--line, #e5e7eb)', borderRadius: 6, padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        {el('imp.mapping', lang)}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8,
        }}
      >
        <label style={fieldLabel}>
          {el('imp.map.headerRow', lang)}
          <input
            type="number"
            min={0}
            value={headerRowIndex}
            onChange={(ev) => onHeaderRowChange(Math.max(0, Number(ev.target.value)))}
            style={fieldStyle()}
          />
        </label>
        <label style={fieldLabel}>
          {el('imp.map.date', lang)}
          <select
            value={colMap.date}
            onChange={(ev) => set({ date: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
        <label style={fieldLabel}>
          {el('imp.map.desc', lang)}
          <select
            value={colMap.description}
            onChange={(ev) => set({ description: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
        <label style={fieldLabel}>
          {el('imp.map.amountIn', lang)}
          <select
            value={colMap.amountIn}
            onChange={(ev) => set({ amountIn: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
        <label style={fieldLabel}>
          {el('imp.map.amountOut', lang)}
          <select
            value={colMap.amountOut}
            onChange={(ev) => set({ amountOut: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
        <label style={fieldLabel}>
          {el('imp.map.amount', lang)}
          <select
            value={colMap.amount}
            onChange={(ev) => set({ amount: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
        <label style={fieldLabel}>
          {el('imp.map.type', lang)}
          <select
            value={colMap.type}
            onChange={(ev) => set({ type: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
        <label style={fieldLabel}>
          {el('imp.map.category', lang)}
          <select
            value={colMap.category}
            onChange={(ev) => set({ category: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
        <label style={fieldLabel}>
          {el('imp.map.invoiceNo', lang)}
          <select
            value={colMap.invoiceNo}
            onChange={(ev) => set({ invoiceNo: Number(ev.target.value) })}
            style={fieldStyle()}
          >
            {colOptions}
          </select>
        </label>
      </div>
    </div>
  );
}

function PreviewBlock({
  lang,
  result,
  visibleEntries,
}: {
  lang: string;
  result: KasaImportResult;
  visibleEntries: ReadonlyArray<KasaImportEntry>;
}): JSX.Element {
  const fmt = (n: number): string =>
    n.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const s = result.summary;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, fontSize: 12 }}>
        <Stat label={el('imp.entries', lang)} value={String(visibleEntries.length)} />
        <Stat label={el('imp.totalIn', lang)} value={fmt(s.totalIn)} />
        <Stat label={el('imp.totalOut', lang)} value={fmt(s.totalOut)} />
        <Stat label={el('imp.sheets', lang)} value={String(s.sheetCount)} />
        <Stat
          label={el('imp.dateRange', lang)}
          value={`${s.dateRange.from ?? '—'} → ${s.dateRange.to ?? '—'}`}
        />
      </div>

      {result.warnings.length > 0 ? (
        <div
          style={{
            ...errorBox,
            background: 'var(--warn-bg, #fef3c7)',
            color: 'var(--warn, #92400e)',
            border: '1px solid #fcd34d',
          }}
        >
          <strong>{el('imp.warnings', lang)}:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {result.warnings.slice(0, 10).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.expenseCards.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {el('imp.detectedCards', lang)} ({result.expenseCards.length})
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {result.expenseCards.map((c, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--paper-2, #f1f5f9)',
                  border: '1px solid var(--line, #e2e8f0)',
                }}
              >
                {c.name} <span style={{ opacity: 0.6 }}>×{c.occurrences}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div
        style={{
          maxHeight: 280,
          overflow: 'auto',
          border: '1px solid var(--line, #e5e7eb)',
          borderRadius: 6,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
                position: 'sticky',
                top: 0,
                background: 'var(--paper, #fff)',
              }}
            >
              <th style={thStyle()}>{el('imp.col.date', lang)}</th>
              <th style={thStyle()}>{el('imp.col.type', lang)}</th>
              <th style={{ ...thStyle(), textAlign: 'right' }}>{el('imp.col.amount', lang)}</th>
              <th style={thStyle()}>{el('imp.col.method', lang)}</th>
              <th style={thStyle()}>{el('imp.col.desc', lang)}</th>
              <th style={thStyle()}>{el('imp.col.category', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.slice(0, MAX_PREVIEW).map((e, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--line, #f0f0f0)' }}>
                <td style={tdStyle()}>{e.date}</td>
                <td
                  style={{
                    ...tdStyle(),
                    color: e.type === 'in' ? 'var(--ok, #15803d)' : 'var(--danger, #b91c1c)',
                  }}
                >
                  {e.type === 'in' ? '▲' : '▼'}
                </td>
                <td style={{ ...tdStyle(), textAlign: 'right' }}>{fmt(e.amount)}</td>
                <td style={tdStyle()}>
                  {e.paymentMethod === 'cash'
                    ? el('imp.method.cash', lang)
                    : e.paymentMethod === 'card'
                      ? el('imp.method.card', lang)
                      : ''}
                </td>
                <td style={tdStyle()}>{e.description}</td>
                <td style={tdStyle()}>{e.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleEntries.length > MAX_PREVIEW ? (
        <div style={{ fontSize: 11, color: 'var(--ink-muted, #888)', marginTop: 4 }}>
          {el('imp.previewNote', lang)}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--paper-2, #f8fafc)',
        border: '1px solid var(--line, #e2e8f0)',
        borderRadius: 6,
        padding: '6px 10px',
      }}
    >
      <div style={{ color: 'var(--ink-muted, #666)', fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

// --- stiller ----------------------------------------------------------------
const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: 24,
  zIndex: 1000,
  overflow: 'auto',
};
const panel: React.CSSProperties = {
  background: 'var(--paper, #fff)',
  color: 'var(--ink, #111)',
  borderRadius: 10,
  padding: 18,
  width: '100%',
  maxWidth: 860,
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
};
const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
};
const errorBox: React.CSSProperties = {
  padding: 10,
  background: 'var(--danger-bg, #fee2e2)',
  color: 'var(--danger, #b91c1c)',
  border: '1px solid var(--danger, #fca5a5)',
  borderRadius: 6,
  marginBottom: 10,
  fontSize: 13,
};
function fieldStyle(): React.CSSProperties {
  return {
    padding: '6px 8px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    fontSize: 12,
    background: 'var(--paper, #fff)',
    color: 'var(--ink, #111)',
  };
}
function thStyle(): React.CSSProperties {
  return { padding: '6px 8px', fontSize: 11, color: 'var(--ink-muted, #666)', fontWeight: 600 };
}
function tdStyle(): React.CSSProperties {
  return { padding: '5px 8px' };
}
function btnStyle(): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid var(--line, #d1d5db)',
    borderRadius: 4,
    background: 'var(--paper, #fff)',
    color: 'var(--ink, #111)',
    cursor: 'pointer',
    fontSize: 12,
  };
}
function btnPrimary(): React.CSSProperties {
  return {
    padding: '7px 14px',
    border: 'none',
    background: 'var(--accent, #0066cc)',
    color: '#fff',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  };
}
function btnSuccess(): React.CSSProperties {
  return {
    padding: '7px 14px',
    border: 'none',
    background: 'var(--ok, #15803d)',
    color: '#fff',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  };
}

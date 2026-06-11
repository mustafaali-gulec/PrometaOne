/**
 * InvoiceNoteHints — fatura not/açıklama metninden yapılandırılmış ipuçları.
 *
 * GİB e-faturalarında vade ve proje bilgisi standart alan değildir; satıcılar
 * bunları "Genel Açıklamalar" / cbc:Note serbest metnine yazar. Bu servis o
 * metinden best-effort çıkarım yapar:
 *
 *   - Vade:  "Vade: 10.07.2026" | "Vade Tarihi: 2026-07-10" | "Vade: 60 gün"
 *            (gün biçiminde issueDate + N gün hesaplanır)
 *   - Proje: "Proje: PRJ-001" | "Proje Kodu: ŞNT-2026-04" | "Proje No= X12"
 *            (yanlış pozitifleri önlemek için ':', '#' veya '=' ayracı şart)
 *
 * Saf domain — IO yok. Hem UBL hem GİB HTML/PDF parser'ları kullanır.
 */

export interface NoteHints {
  dueDate: string | null;
  projectCode: string | null;
}

/** "dd.mm.yyyy" / "dd/mm/yyyy" / "dd-mm-yyyy" / "yyyy-mm-dd" → "YYYY-MM-DD" | null. */
function normalizeDateToken(raw: string): string | null {
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const tr = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!tr) return null;
  const dd = tr[1]!.padStart(2, '0');
  const mm = tr[2]!.padStart(2, '0');
  let yyyy = tr[3]!;
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  const m = Number(mm);
  const d = Number(dd);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** issueDate (YYYY-MM-DD) + N gün → YYYY-MM-DD (UTC, DST'siz). */
function addDays(isoDate: string, days: number): string | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export const InvoiceNoteHints = {
  extract(notes: string | null | undefined, issueDate: string): NoteHints {
    // JS /i bayrağı 'İ' (U+0130) ↔ 'i' eşlemesi yapmaz ("VADE TARİHİ" kaçar);
    // Türkçe büyük İ'yi ASCII i'ye indirger, gerisini /i halleder.
    const text = (notes ?? '').replace(/İ/g, 'i').trim();
    if (text === '') return { dueDate: null, projectCode: null };

    // --- Vade ---------------------------------------------------------------
    let dueDate: string | null = null;
    const vadeDate = text.match(
      /vade(?:si)?(?:\s*tarihi)?\s*[:=]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    );
    if (vadeDate && vadeDate[1] !== undefined) {
      dueDate = normalizeDateToken(vadeDate[1]);
    }
    if (dueDate === null) {
      const vadeDays = text.match(/vade(?:si)?\s*[:=]?\s*(\d{1,3})\s*g[üu]n/i);
      if (vadeDays && vadeDays[1] !== undefined) {
        dueDate = addDays(issueDate, Number(vadeDays[1]));
      }
    }

    // --- Proje kodu ----------------------------------------------------------
    let projectCode: string | null = null;
    const proje = text.match(
      /proje(?:\s*(?:kodu|kod|no))?\s*[:#=]\s*([A-Za-z0-9ÇĞİÖŞÜçğıöşü][A-Za-z0-9ÇĞİÖŞÜçğıöşü._/-]{0,30})/i,
    );
    if (proje && proje[1] !== undefined) {
      projectCode = proje[1].replace(/[.,;]+$/, '');
      if (projectCode === '') projectCode = null;
    }

    return { dueDate, projectCode };
  },
} as const;

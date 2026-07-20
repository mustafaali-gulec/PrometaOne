/**
 * Sabit Kıymet amortisman motoru + otomatik yevmiye fişi üreteçleri.
 *
 * VUK kuralları:
 *  - Normal (doğrusal): yıllık = itfa matrahı / faydalı ömür.
 *  - Azalan bakiyeler: oran = min(2/ömür, %50), net defter değerine uygulanır;
 *    son yıl kalan tamamı yazılır.
 *  - Kıst amortisman YALNIZ binek otomobiller: ilk yıl ay kıstı (edinim ayı dahil),
 *    ilk yıldan ayrılamayan tutar SON yıla eklenir (süre uzamaz).
 *  - Aylıklandırma: edinim yılında (kıst değilse) tam yıllık tutar kalan aylara
 *    yayılır; sonraki yıllarda yıllık/12. Koşum "dönem sonuna kadar tahakkuk −
 *    daha önce kayıtlanan" farkını giderleştirir → idempotent, mükerrer kayıt olmaz.
 *
 * Backend paritesi: api-server/src/modules/fixedassets/domain/services/DepreciationCalculator.ts
 * aynı kuralları uygular; POST /v1/fixed-assets/depreciation/preview ile karşılaştırılabilir.
 */

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Kategori şablonları: varsayılan faydalı ömür + hesap eşlemesi (TDHP) + kıst önerisi
export const FA_CATEGORIES = {
  bina: { life: 50, asset: '252', accum: '257', expense: '770', kist: false },
  tasit: { life: 5, asset: '254', accum: '257', expense: '770', kist: false },
  binek_oto: { life: 5, asset: '254', accum: '257', expense: '770', kist: true },
  makine: { life: 10, asset: '253', accum: '257', expense: '730', kist: false },
  demirbas: { life: 5, asset: '255', accum: '257', expense: '770', kist: false },
  bilgisayar: { life: 4, asset: '255', accum: '257', expense: '770', kist: false },
  yazilim: { life: 3, asset: '260', accum: '268', expense: '770', kist: false },
  ozel_maliyet: { life: 5, asset: '264', accum: '268', expense: '770', kist: false },
  arazi: { life: 0, asset: '250', accum: '', expense: '', kist: false },
  diger: { life: 5, asset: '255', accum: '257', expense: '770', kist: false },
};

const parseYm = (s) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(s || ''));
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null;
};

// "YYYY-MM" ayının son günü → "YYYY-MM-DD"
export function monthEnd(period) {
  const p = parseYm(period);
  if (!p) return '';
  const last = new Date(p.y, p.m, 0).getDate();
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function itfaBase(asset) {
  const cost = Number(asset.acquisitionCost) || 0;
  const salvage = Number(asset.salvageValue) || 0;
  return Math.max(0, round2(cost - salvage));
}

/**
 * Yıl bazlı amortisman planı: [{year, annual, accumulatedEnd, nbvEnd}]
 * nbvEnd = maliyet − birikmiş (hurda değeri düşülmeden görüntülenen defter değeri).
 */
export function computeAnnualPlan(asset) {
  const base = itfaBase(asset);
  const n = Number(asset.usefulLifeYears) || 0;
  const acq = parseYm(asset.acquisitionDate);
  if (!acq || n <= 0 || base <= 0) return [];
  const cost = Number(asset.acquisitionCost) || 0;
  const isKist = !!asset.isPassengerCar;
  const rate = asset.method === 'declining' ? Math.min(2 / n, 0.5) : 1 / n;

  const plan = [];
  let accumulated = 0;
  for (let i = 0; i < n; i++) {
    const year = acq.y + i;
    let annual;
    if (i === n - 1) {
      annual = round2(base - accumulated); // son yıl: kalanın tamamı (ertelenen kıst dahil)
    } else if (asset.method === 'declining') {
      annual = round2((cost - accumulated) * rate);
    } else {
      annual = round2(base / n);
    }
    if (i === 0 && isKist && i !== n - 1) {
      const months = 13 - acq.m;
      annual = round2(annual * (months / 12)); // ilk yıl ay kıstı; fark son yılda kapanır
    }
    annual = Math.min(annual, round2(base - accumulated));
    accumulated = round2(accumulated + annual);
    plan.push({ year, annual, accumulatedEnd: accumulated, nbvEnd: round2(cost - accumulated) });
  }
  return plan;
}

/**
 * Alımdan verilen dönem ("YYYY-MM") sonuna kadar tahakkuk etmesi gereken
 * birikmiş amortisman (plana göre aylıklandırılmış). Devir (openingAccumulated)
 * DAHİL DEĞİLDİR — plan matematiği maliyet üzerinden yürür.
 */
export function accumulatedThrough(asset, period) {
  const p = parseYm(period);
  const acq = parseYm(asset.acquisitionDate);
  if (!p || !acq) return 0;
  if (p.y < acq.y || (p.y === acq.y && p.m < acq.m)) return 0;
  const plan = computeAnnualPlan(asset);
  if (!plan.length) return 0;
  const base = itfaBase(asset);

  let total = 0;
  for (const row of plan) {
    if (row.year < p.y) {
      total += row.annual;
      continue;
    }
    if (row.year > p.y) break;
    // İçinde bulunulan plan yılı: aylık dağıtım
    const isAcqYear = row.year === acq.y;
    const startMonth = isAcqYear ? acq.m : 1;
    const monthsInYear = 13 - startMonth; // amortisman ayrılan ay sayısı (bu yıl içinde)
    const elapsed = Math.min(p.m, 12) - startMonth + 1;
    if (elapsed <= 0) break;
    total += row.annual * (elapsed / monthsInYear);
    break;
  }
  return Math.min(round2(total), base);
}

/** Koşumlardan kıymet başına kayıtlı amortisman toplamı (posted koşum satırları). */
export function bookedByAsset(runs) {
  const map = {};
  (runs || []).forEach((r) => {
    if (r.status === 'cancelled') return;
    (r.lines || []).forEach((l) => {
      map[l.assetId] = round2((map[l.assetId] || 0) + (Number(l.amount) || 0));
    });
  });
  return map;
}

/**
 * Dönem koşum satırları: her aktif kıymet için
 * tutar = max(0, dönem sonuna kadar tahakkuk − (devir + önceki koşumlar)).
 */
export function computeRunLines(period, assets, runs) {
  const booked = bookedByAsset(runs);
  const lines = [];
  (assets || []).forEach((a) => {
    if (a.status !== 'active') return;
    if ((Number(a.usefulLifeYears) || 0) <= 0) return;
    const target = accumulatedThrough(a, period);
    const already = round2((Number(a.openingAccumulated) || 0) + (booked[a.id] || 0));
    const amount = round2(Math.max(0, target - already));
    if (amount > 0) {
      lines.push({
        assetId: a.id,
        assetCode: a.code,
        assetName: a.name,
        expenseAccountCode: a.expenseAccountCode || '770',
        accumAccountCode: a.accumAccountCode || '257',
        amount,
      });
    }
  });
  return lines;
}

/** Kıymetin kayıtlı birikmiş amortismanı (devir + koşumlar) — NBV hesapları için. */
export function bookedAccumulated(asset, runs) {
  const booked = bookedByAsset(runs);
  return round2((Number(asset.openingAccumulated) || 0) + (booked[asset.id] || 0));
}

/* ---------------- Fiş üreteçleri ---------------- */

// App.jsx generateVoucherNo ile aynı format: PREFIX-YIL-00001 (mahsup = MAH)
function nextVoucherNo(entries, year, prefix = 'MAH') {
  const p = `${prefix}-${year}-`;
  let maxNo = 0;
  (entries || []).forEach((e) => {
    if (e.voucherNo && e.voucherNo.startsWith(p)) {
      const m = e.voucherNo.match(/-(\d+)$/);
      if (m) maxNo = Math.max(maxNo, parseInt(m[1], 10));
    }
  });
  return `${p}${String(maxNo + 1).padStart(5, '0')}`;
}

const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function accountOk(accounts, code) {
  const a = (accounts || []).find((x) => x.code === code);
  return !!a && a.allowTransaction !== false && a.active !== false;
}

function buildVoucher({ date, description, lines, entries, source, sourceId, createdBy }) {
  const totalDebit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  if (Math.abs(totalDebit - totalCredit) >= 0.01) {
    return { success: false, error: 'unbalanced' };
  }
  const now = new Date().toISOString();
  return {
    success: true,
    voucher: {
      id: 'je_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      voucherNo: nextVoucherNo(entries, date.slice(0, 4)),
      voucherType: 'compound',
      date,
      entryTime: hhmm(),
      yevmiyeMaddeNo: '',
      description,
      projectId: '',
      lines,
      totalDebit,
      totalCredit,
      status: 'posted',
      source,
      sourceId,
      tags: ['fixedasset'],
      attachments: [],
      createdAt: now,
      createdBy: createdBy || '',
      postedAt: now,
      postedBy: createdBy || '',
    },
  };
}

const mkLine = (accountCode, description, debit, credit) => ({
  id: 'jel_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
  accountCode,
  description,
  debit: round2(debit),
  credit: round2(credit),
  currency: 'TRY',
  foreignAmount: null,
  exchangeRate: 1,
});

/**
 * Amortisman koşumu fişi (Mahsup): kıymet başına
 *   BORÇ  gider hesabı (770/730/760)
 *   ALACAK birikmiş amortisman (257/268)
 * Her satırda açıklama zorunlu (GİB validateGibFis).
 */
export function generateVoucherFromDepreciationRun({
  period,
  runId,
  runLines,
  accounts,
  entries,
  createdBy,
}) {
  for (const l of runLines) {
    if (!accountOk(accounts, l.expenseAccountCode) || !accountOk(accounts, l.accumAccountCode)) {
      return {
        success: false,
        error: 'account',
        accountCode: !accountOk(accounts, l.expenseAccountCode)
          ? l.expenseAccountCode
          : l.accumAccountCode,
      };
    }
  }
  const date = monthEnd(period);
  const lines = [];
  runLines.forEach((l) => {
    const desc = `Amortisman ${period} — ${l.assetCode} ${l.assetName}`;
    lines.push(mkLine(l.expenseAccountCode, desc, l.amount, 0));
    lines.push(mkLine(l.accumAccountCode, desc, 0, l.amount));
  });
  return buildVoucher({
    date,
    description: `Amortisman koşumu ${period}`,
    lines,
    entries,
    source: 'fixedasset',
    sourceId: runId,
    createdBy,
  });
}

/**
 * Satış fişi (Mahsup):
 *   BORÇ  karşı hesap (satış bedeli + KDV)
 *   BORÇ  birikmiş amortisman (kayıtlı birikmiş)
 *   ALACAK kıymet hesabı (maliyet)
 *   ALACAK 391 Hesaplanan KDV (varsa)
 *   Fark → ALACAK 679 (kâr) veya BORÇ 689 (zarar)
 */
export function generateVoucherFromAssetSale({
  asset,
  movement,
  accumulated,
  accounts,
  entries,
  createdBy,
}) {
  const cost = round2(asset.acquisitionCost);
  const price = round2(movement.amount);
  const vat = round2(price * ((Number(movement.vatRate) || 0) / 100));
  const counter = movement.counterAccountCode || '136';
  const nbv = round2(cost - accumulated);
  const gainLoss = round2(price - nbv); // + kâr / − zarar

  const need = [counter, asset.assetAccountCode];
  if (accumulated > 0) need.push(asset.accumAccountCode);
  if (vat > 0) need.push('391');
  need.push(gainLoss >= 0 ? '679' : '689');
  for (const code of need) {
    if (!accountOk(accounts, code)) return { success: false, error: 'account', accountCode: code };
  }

  const desc = `Sabit kıymet satışı — ${asset.code} ${asset.name}`;
  const lines = [mkLine(counter, desc, round2(price + vat), 0)];
  if (accumulated > 0) lines.push(mkLine(asset.accumAccountCode, desc, accumulated, 0));
  lines.push(mkLine(asset.assetAccountCode, desc, 0, cost));
  if (vat > 0) lines.push(mkLine('391', `${desc} (KDV)`, 0, vat));
  if (gainLoss > 0) lines.push(mkLine('679', `${desc} (satış kârı)`, 0, gainLoss));
  else if (gainLoss < 0) lines.push(mkLine('689', `${desc} (satış zararı)`, -gainLoss, 0));

  const result = buildVoucher({
    date: movement.date,
    description: desc,
    lines,
    entries,
    source: 'fixedasset',
    sourceId: movement.id,
    createdBy,
  });
  if (result.success) result.gainLoss = gainLoss;
  return result;
}

/**
 * Hurda fişi (Mahsup):
 *   BORÇ  birikmiş amortisman (kayıtlı birikmiş)
 *   BORÇ  689 (kalan net defter değeri — zarar)
 *   ALACAK kıymet hesabı (maliyet)
 */
export function generateVoucherFromAssetScrap({
  asset,
  movement,
  accumulated,
  accounts,
  entries,
  createdBy,
}) {
  const cost = round2(asset.acquisitionCost);
  const nbv = round2(cost - accumulated);
  const need = [asset.assetAccountCode];
  if (accumulated > 0) need.push(asset.accumAccountCode);
  if (nbv > 0) need.push('689');
  for (const code of need) {
    if (!accountOk(accounts, code)) return { success: false, error: 'account', accountCode: code };
  }
  const desc = `Sabit kıymet hurda — ${asset.code} ${asset.name}`;
  const lines = [];
  if (accumulated > 0) lines.push(mkLine(asset.accumAccountCode, desc, accumulated, 0));
  if (nbv > 0) lines.push(mkLine('689', `${desc} (hurda zararı)`, nbv, 0));
  lines.push(mkLine(asset.assetAccountCode, desc, 0, cost));
  return buildVoucher({
    date: movement.date,
    description: desc,
    lines,
    entries,
    source: 'fixedasset',
    sourceId: movement.id,
    createdBy,
  });
}

/** Sıradaki kıymet kodu: SK-0001, SK-0002... */
export function nextAssetCode(assets) {
  let maxNo = 0;
  (assets || []).forEach((a) => {
    const m = /^SK-(\d+)$/.exec(a.code || '');
    if (m) maxNo = Math.max(maxNo, parseInt(m[1], 10));
  });
  return `SK-${String(maxNo + 1).padStart(4, '0')}`;
}

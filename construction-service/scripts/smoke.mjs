/**
 * Faz 1→2→3→4→5→6 uçtan uca duman testi. Tek süreç, fetch tabanlı.
 *
 * Yerel dev sunucusuna (varsayılan :3003) karşı koşar; ürettiği tüm veriyi
 * sonunda temizler. Geçici dosya — depoya girmez.
 *
 * Kullanım:  npm run smoke  (veya: node scripts/smoke.mjs http://localhost:3003)
 */
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3003';
const B = `${BASE}/v1/construction`;

const secret = /^JWT_SECRET=(.*)$/m
  .exec(readFileSync(new URL('../.env', import.meta.url), 'utf8'))?.[1]
  ?.trim();
if (!secret) throw new Error('JWT_SECRET bulunamadı');
const TOKEN = jwt.sign({ sub: 1, username: 'e2e', role: 'admin', companies: [1] }, secret, {
  expiresIn: '30m',
});

/** Bugüne göre gün kaydırmalı ISO tarih (kova sınamaları için). */
function dayShift(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

let ok = 0;
let fail = 0;
const failures = [];

function chk(name, expected, actual) {
  const same =
    expected === actual ||
    (typeof expected === 'number' &&
      typeof actual === 'number' &&
      Math.abs(expected - actual) < 1e-9);
  if (same) {
    ok += 1;
    console.log(`  OK   ${name.padEnd(56)} ${String(actual)}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL ${name.padEnd(56)} beklenen=${String(expected)} gerçek=${String(actual)}`);
  }
}

async function call(method, path, body) {
  const res = await fetch(`${B}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json;
  try {
    json = text === '' ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}
const get = (p) => call('GET', p);
const post = (p, b) => call('POST', p, b);
const put = (p, b) => call('PUT', p, b);
const del = (p) => call('DELETE', p);

const r4 = (n) => (n === null || n === undefined ? n : Math.round(n * 10000) / 10000);

async function main() {
  console.log('=== FAZ 1: proje + mekân ağacı ===');
  const prj = (await post('projects', { companyId: 1, name: 'E2E Faz1234' })).json;
  chk('proje oluşturuldu', true, typeof prj?.id === 'number');
  const PRJ = prj.id;

  const gen = (
    await post('locations/bulk-generate', {
      companyId: 1,
      projectId: PRJ,
      blocks: ['A', 'B'],
      floors: ['0', '1'],
      unitsPerFloor: 2,
      defaultUnitType: '2+1',
    })
  ).json;
  chk('toplu üretim düğüm sayısı (2 blok + 4 kat + 8 daire)', 14, gen.createdCount);

  const again = (
    await post('locations/bulk-generate', {
      companyId: 1,
      projectId: PRJ,
      blocks: ['A', 'B'],
      floors: ['0', '1'],
      unitsPerFloor: 2,
    })
  ).json;
  chk('tekrar koşumda kopya üretmez (idempotent)', 0, again.createdCount);

  const tree = (await get(`projects/${PRJ}/locations?companyId=1`)).json;
  chk('ağaç kök sayısı', 2, tree.tree.length);
  chk('A blok altındaki bağımsız bölüm sayısı (rollup)', 4, tree.tree[0].unitCount);
  const ABLOK = tree.tree[0].id;
  const BBLOK = tree.tree[1].id;

  // Geçersiz iç içe geçme reddedilmeli
  const badNest = await post('locations', {
    companyId: 1,
    projectId: PRJ,
    parentId: ABLOK,
    kind: 'block',
    code: 'X',
  });
  chk('blok altına blok eklenemez', 400, badNest.status);

  console.log('=== FAZ 2: şablon + takip + saha durumu ===');
  const tpl = (
    await post('progress-templates', {
      companyId: 1,
      name: 'E2E Blok Şablonu',
      scope: 'block',
      body: {
        groups: [
          {
            code: 'TML',
            name: 'Temel',
            weightPct: 40,
            items: [
              { code: 'T1', name: 'Dolgu', weightPct: 4 },
              { code: 'T2', name: 'Drenaj', weightPct: 1 },
              { code: 'T3', name: 'Grobeton', weightPct: 72 },
              { code: 'T4', name: 'Kazı', weightPct: 23 },
            ],
          },
          {
            code: 'KBA',
            name: 'Kaba',
            weightPct: 40,
            items: [
              { code: 'K1', name: 'Kalıp', weightPct: 20 },
              { code: 'K2', name: 'Demir', weightPct: 20 },
              { code: 'K3', name: 'Beton', weightPct: 20 },
              { code: 'K4', name: 'Duvar', weightPct: 20 },
              { code: 'K5', name: 'Sıva', weightPct: 20 },
            ],
          },
          {
            code: 'CTI',
            name: 'Çatı',
            weightPct: 20,
            items: [
              { code: 'C1', name: 'Karkas', weightPct: 50 },
              { code: 'C2', name: 'Örtü', weightPct: 30 },
              { code: 'C3', name: 'İzolasyon', weightPct: 20 },
            ],
          },
        ],
      },
    })
  ).json;
  chk('şablon iş kalemi sayısı', 12, tpl.itemCount);
  chk('ağırlık tutarlı (uyarı yok)', 0, tpl.weightIssues.length);
  const TPL = tpl.id;

  const trk = (
    await post('trackings', {
      companyId: 1,
      projectId: PRJ,
      templateId: TPL,
      name: 'E2E Takip',
      projectWeightPct: 45,
      locationIds: [ABLOK, BBLOK],
    })
  ).json;
  const TRK = trk.id;
  chk('takip oluşturuldu (taslak)', 'draft', trk.status);

  // Kapsam tipi denetimi: unit kapsamlı şablona blok verilemez
  const unitTpl = (
    await post('progress-templates', {
      companyId: 1,
      name: 'E2E Daire Şablonu',
      scope: 'unit',
      body: {
        groups: [
          {
            code: 'G',
            name: 'G',
            weightPct: 100,
            items: [{ code: 'I', name: 'I', weightPct: 100 }],
          },
        ],
      },
    })
  ).json;
  const badScope = await post('trackings', {
    companyId: 1,
    projectId: PRJ,
    templateId: unitTpl.id,
    name: 'Kapsam hatası',
    locationIds: [ABLOK],
  });
  chk('daire kapsamlı şablona blok verilemez', 400, badScope.status);

  const draftWrite = await put(`trackings/${TRK}/items`, {
    companyId: 1,
    updates: [{ trackingItemId: 1, state: 'completed' }],
  });
  chk('TASLAK takipte saha durumu reddedilir', 400, draftWrite.status);

  await post(`trackings/${TRK}/status`, { companyId: 1, status: 'active' });
  let board = (await get(`trackings/${TRK}/board?companyId=1`)).json;
  chk('saha ekranı lokasyon sayısı', 2, board.locations.length);
  chk('A blok iş kalemi sayısı (12 iş materyalize)', 12, board.locations[0].itemCount);

  // Imperium demo senaryosu
  const byName = {};
  for (const g of board.locations[0].groups) {
    for (const it of g.items) byName[it.itemName] = it.trackingItemId;
  }
  await put(`trackings/${TRK}/items`, {
    companyId: 1,
    updates: [
      { trackingItemId: byName['Dolgu'], state: 'completed' },
      { trackingItemId: byName['Drenaj'], state: 'completed' },
      { trackingItemId: byName['Grobeton'], state: 'in_progress' },
      { trackingItemId: byName['Kazı'], state: 'in_progress' },
      { trackingItemId: byName['Kalıp'], state: 'completed' },
      { trackingItemId: byName['Demir'], state: 'completed' },
      { trackingItemId: byName['Beton'], state: 'completed' },
      { trackingItemId: byName['Duvar'], state: 'has_defects' },
      { trackingItemId: byName['Karkas'], state: 'in_progress', overridePct: 30 },
    ],
  });

  board = (await get(`trackings/${TRK}/board?companyId=1`)).json;
  chk('A blok ilerlemesi (52,5×0,4 + 75×0,4 + 15×0,2)', 54, r4(board.locations[0].progressPct));

  const pp = (await get(`projects/${PRJ}/physical-progress?companyId=1`)).json;
  chk('takip ilerlemesi (54+0)/2', 27, r4(pp.trackings[0].progressPct));
  chk('proje fiziksel ilerlemesi 27×0,45', 12.15, r4(pp.progressPct));
  chk('ölçülmeyen ağırlık payı', 55, r4(pp.unmeasuredWeight));

  console.log('=== FAZ 3: şantiye günlüğü ===');
  const ctr = (
    await post('contracts', {
      companyId: 1,
      projectId: PRJ,
      partyKind: 'subcontractor',
      title: 'E2E Kaba',
      amount: 1000000,
    })
  ).json;
  const CTR = ctr.id;
  const boq = (
    await put(`contracts/${CTR}/boq`, {
      companyId: 1,
      lines: [
        {
          lineNo: 1,
          pozNo: 'A-1',
          description: 'Kalıp',
          unit: 'm2',
          quantity: 100,
          unitPrice: 500,
        },
      ],
    })
  ).json;
  chk('keşif satırı oluşturuldu', 1, boq.lines.length);
  const BOQ = boq.lines[0].id;

  const day = (await get(`projects/${PRJ}/daily-logs/2026-07-15?companyId=1&create=true`)).json;
  const LOG = day.log.id;
  chk('gün 11 bölümle açıldı', 11, day.sections.length);

  const badAcc = await put(`daily-logs/${LOG}/entries`, {
    companyId: 1,
    kind: 'accident',
    description: 'Kayma',
  });
  chk('kaza kaydı şiddet olmadan 400 (500 değil)', 400, badAcc.status);

  const badNote = await put(`daily-logs/${LOG}/entries`, {
    companyId: 1,
    kind: 'note',
    description: 'kirli',
    headcount: 5,
  });
  chk('not kaydına kişi sayısı girilirse 400', 400, badNote.status);

  await put(`daily-logs/${LOG}/entries`, {
    companyId: 1,
    kind: 'subcontractor',
    vendorId: 77,
    headcount: 5,
    hours: 40,
    description: 'Kalıp',
    boqLineId: BOQ,
  });
  await put(`daily-logs/${LOG}/entries`, {
    companyId: 1,
    kind: 'production',
    description: 'Kalıp imalatı',
    qty: 50,
    unit: 'm2',
    boqLineId: BOQ,
  });
  await put(`daily-logs/${LOG}/entries`, {
    companyId: 1,
    kind: 'accident',
    severity: 'lost_time',
    lostDays: 5,
    description: 'Kayma',
  });
  await put(`daily-logs/${LOG}/entries`, {
    companyId: 1,
    kind: 'accident',
    severity: 'near_miss',
    description: 'Ramak kala',
  });

  const day2 = (await get(`projects/${PRJ}/daily-logs/2026-07-15?companyId=1`)).json;
  chk('gün reddedilen satırdan sonra okunabilir', 200, day2 === null ? 0 : 200);
  chk('taşeron kişi sayısı', 5, day2.totals.subHeadcount);
  chk('kaza sayısı (2 olay)', 2, day2.totals.accidentCount);
  chk('gerçek kaza (ramak kala hariç)', 1, day2.totals.realAccidentCount);
  chk('kayıt sayısı (geçersizler girmedi)', 4, day2.totals.entryCount);

  const sf = (
    await get(`projects/${PRJ}/safety-summary?companyId=1&fromDate=2026-07-01&toDate=2026-07-31`)
  ).json;
  chk('İSG sıklık oranı (1×1.000.000/40)', 25000, r4(sf.frequencyRate));
  chk('İSG ağırlık oranı (5×1.000/40)', 125, r4(sf.severityRate));

  const mp = (
    await get(`projects/${PRJ}/manpower?companyId=1&fromDate=2026-07-01&toDate=2026-07-31`)
  ).json;
  chk('iş gücü toplam saat', 40, r4(mp.totalHours));

  await post(`daily-logs/${LOG}/status`, { companyId: 1, status: 'locked' });
  const lockedWrite = await put(`daily-logs/${LOG}/entries`, {
    companyId: 1,
    kind: 'note',
    description: 'geç not',
  });
  chk('kilitli günde satır eklenemez', 409, lockedWrite.status);
  const lockedComment = await post(`daily-logs/${LOG}/comments`, {
    companyId: 1,
    body: 'Teknik ofis şerhi',
  });
  chk('kilitli günde YORUM yapılabilir', 201, lockedComment.status);

  console.log('=== FAZ 4: adam×saat & verimlilik ===');
  await put(`contracts/${CTR}/unit-manhours`, {
    companyId: 1,
    updates: [{ boqLineId: BOQ, unitManhours: 2 }],
  });
  const badLine = await put(`contracts/${CTR}/unit-manhours`, {
    companyId: 1,
    updates: [{ boqLineId: 999999, unitManhours: 2 }],
  });
  chk('başka sözleşmenin satırına yazılamaz', 400, badLine.status);

  const perf = (await get(`contracts/${CTR}/performance?companyId=1`)).json;
  const row = perf.rows[0];
  chk('planlanan adam×saat (100×2)', 200, r4(row.plannedManhours));
  chk('gerçekleşen adam×saat (taşeron 40)', 40, r4(row.actualManhours));
  chk('üretilen miktar (imalat kaydından)', 50, r4(row.producedQty));
  chk('beklenen adam×saat (50×2)', 100, r4(row.expectedManhours));
  chk('verim (100/40)', 2.5, r4(row.efficiency));
  chk('adam×saat sapması (40−100)', -60, r4(row.manhourVariance));
  chk('ilerleme-işçilik makası (50−20)', 30, r4(row.progressGap));
  chk('EAC (100×0,8)', 80, r4(row.eacManhours));
  chk('verim bandı', 'ahead', row.band);
  chk('imalat−hakediş farkı (50−0)', 50, r4(row.productionVsProgressQty));
  chk('planı olmayan satır sayısı', 0, perf.summary.linesWithoutPlan);
  chk('ağırlıklı verim özeti', 2.5, r4(perf.summary.efficiency));

  console.log('=== FAZ 5: jenerik onay akışı ===');
  const noApproval = await get(`approvals/doc/progress/${String(BOQ)}?companyId=1`);
  chk('akışı olmayan belge 204 döner (404 değil)', 204, noApproval.status);

  const af = (
    await post('approvals', {
      companyId: 1,
      docKind: 'progress',
      docId: 4242,
      projectId: PRJ,
      mode: 'ordered',
      title: 'E2E hakediş onayı',
      approvers: [
        { approverUserId: 1, dueDate: '2026-07-20' },
        { approverUserId: 2 },
        { approverUserId: 3 },
      ],
    })
  ).json;
  chk('akış 3 adımla kuruldu', 3, af.steps.length);
  chk('gereken onay sayısı (minApprovals yok → hepsi)', 3, af.requiredCount);
  chk('sıradaki onaycı ilk adım', 1, af.currentApproverUserId);
  chk('yalnız ilk adım eyleme geçebilir', true, af.steps[0].actionable);
  chk('ikinci adım henüz eyleme geçemez', false, af.steps[1].actionable);
  chk('gecikmiş adım gün sayısı taşıyor', true, (af.steps[0].daysOverdue ?? 0) > 0);

  const dupFlow = await post('approvals', {
    companyId: 1,
    docKind: 'progress',
    docId: 4242,
    approvers: [{ approverUserId: 1 }],
  });
  chk('aynı belgede ikinci aktif akış 409', 409, dupFlow.status);

  // Sırası gelmemiş adıma karar → 400
  const outOfOrder = await post(
    `approvals/${String(af.id)}/steps/${String(af.steps[1].id)}/decide`,
    {
      companyId: 1,
      approve: true,
    },
  );
  chk('sırası gelmemiş adıma karar 400', 400, outOfOrder.status);

  const d1 = (
    await post(`approvals/${String(af.id)}/steps/${String(af.steps[0].id)}/decide`, {
      companyId: 1,
      approve: true,
      comment: 'Metraj kontrol edildi',
    })
  ).json;
  chk('ilk onaydan sonra akış açık kalır', false, d1.completed);
  chk('sıra ikinci onaycıya geçti', 2, d1.flow.currentApproverUserId);
  chk('onay sayısı 1', 1, d1.flow.approvedCount);

  const mine = (await get('approvals/mine?companyId=1')).json;
  chk('bana atanan onaylar kutusu çalışıyor', true, Array.isArray(mine.actionable));

  /**
   * GECİKME KOVALARI. Görünüm ileri tarihte de daysOverdue=0 döndürür (gecikme
   * yok demek); bunu "bugün teslim" saymak paneli yalan söyletiyordu. Kovalar
   * FARK ile sınanır — kutu kullanıcının bütün bekleyen adımlarını sayar, mutlak
   * sayı DB'de duran başka akışlardan etkilenir.
   */
  const before = mine.buckets;
  const todayFlow = (
    await post('approvals', {
      companyId: 1,
      docKind: 'expense',
      docId: 4243,
      mode: 'unordered',
      title: 'kova sınaması — bugün',
      approvers: [
        { approverUserId: 1, dueDate: dayShift(0) },
        { approverUserId: 9, dueDate: dayShift(-20) },
      ],
    })
  ).json;
  const laterFlow = (
    await post('approvals', {
      companyId: 1,
      docKind: 'expense',
      docId: 4244,
      mode: 'unordered',
      title: 'kova sınaması — ileri tarih',
      approvers: [{ approverUserId: 1, dueDate: dayShift(30) }],
    })
  ).json;
  const mine2 = (await get('approvals/mine?companyId=1')).json;
  chk('kova: bugün teslim +1', 1, mine2.buckets.dueToday - before.dueToday);
  chk('kova: ileri tarihli +1 (bugün sayılmaz)', 1, mine2.buckets.upcoming - before.upcoming);
  chk('kova: gecikme kovaları değişmedi', 0, mine2.buckets.overdue1to7 - before.overdue1to7);
  chk(
    'kova: ileri tarihli adım gecikmiş listesinde yok',
    0,
    mine2.overdue.filter((r) => r.flowId === laterFlow.id).length,
  );

  // status=pending şart: önceki koşumların iptal edilmiş akışları aynı belge
  // numarasında duruyor (denetim izi silinmez), filtresiz sorgu her koşumda büyür.
  const listed = (await get('approvals?companyId=1&docId=4243&status=pending')).json.flows;
  chk('sırasız akış listede', 1, listed.length);
  chk('sırasız akışta sıradaki onaycı yok', null, listed[0].currentApproverUserId);
  chk('en erken bitiş tarihinden gecikme', true, listed[0].daysOverdue >= 20);

  await post(`approvals/${String(todayFlow.id)}/cancel`, { companyId: 1 });
  const cancelled = (await get(`approvals/${String(todayFlow.id)}?companyId=1`)).json;
  chk('iptal edilen akış cancelled', 'cancelled', cancelled.status);
  chk(
    'iptalde bekleyen adımlar skipped',
    0,
    cancelled.steps.filter((st) => st.decision === 'pending').length,
  );
  await post(`approvals/${String(laterFlow.id)}/cancel`, { companyId: 1 });

  // Kalan iki adım admin token'ıyla vekâleten onaylanır → 'delegated'
  const d2 = (
    await post(`approvals/${String(af.id)}/steps/${String(af.steps[1].id)}/decide`, {
      companyId: 1,
      approve: true,
    })
  ).json;
  chk('vekâleten onay delegated olarak işaretlendi', 'delegated', d2.flow.steps[1].decision);

  const d3 = (
    await post(`approvals/${String(af.id)}/steps/${String(af.steps[2].id)}/decide`, {
      companyId: 1,
      approve: true,
    })
  ).json;
  chk('son onay akışı tamamladı', true, d3.completed);
  chk('akış onaylandı', 'approved', d3.flow.status);

  const hist = (await get(`approvals/${String(af.id)}/history?companyId=1`)).json;
  chk('geçmiş: created + 3 karar', 4, hist.history.length);

  // Red terminal: sırasız modda min 2 onay, biri onaylar biri reddeder
  const af2 = (
    await post('approvals', {
      companyId: 1,
      docKind: 'expense',
      docId: 4243,
      projectId: PRJ,
      mode: 'unordered',
      minApprovals: 2,
      approvers: [{ approverUserId: 1 }, { approverUserId: 2 }, { approverUserId: 3 }],
    })
  ).json;
  chk('sırasız modda sıradaki onaycı null', null, af2.currentApproverUserId);
  chk('sırasız modda son adım da eyleme geçebilir', true, af2.steps[2].actionable);

  await post(`approvals/${String(af2.id)}/steps/${String(af2.steps[2].id)}/decide`, {
    companyId: 1,
    approve: true,
  });
  const rej = (
    await post(`approvals/${String(af2.id)}/steps/${String(af2.steps[0].id)}/decide`, {
      companyId: 1,
      approve: false,
      comment: 'Belge eksik',
    })
  ).json;
  chk('red akışı reddetti (çoğunluk onaylamış olsa bile)', 'rejected', rej.flow.status);
  chk('kalan adım skipped', 'skipped', rej.flow.steps[1].decision);

  const afterClose = await post(
    `approvals/${String(af2.id)}/steps/${String(af2.steps[1].id)}/decide`,
    { companyId: 1, approve: true },
  );
  chk('kapanmış akışta karar 400', 400, afterClose.status);

  // min_approvals ile kısmi onay: 3 onaycıdan 2'si yeter
  const af3 = (
    await post('approvals', {
      companyId: 1,
      docKind: 'material_request',
      docId: 4244,
      mode: 'unordered',
      minApprovals: 2,
      approvers: [{ approverUserId: 1 }, { approverUserId: 2 }, { approverUserId: 3 }],
    })
  ).json;
  await post(`approvals/${String(af3.id)}/steps/${String(af3.steps[0].id)}/decide`, {
    companyId: 1,
    approve: true,
  });
  const done = (
    await post(`approvals/${String(af3.id)}/steps/${String(af3.steps[1].id)}/decide`, {
      companyId: 1,
      approve: true,
    })
  ).json;
  chk('2/3 onayla akış onaylandı', 'approved', done.flow.status);
  chk('sorulmayan adım skipped', 'skipped', done.flow.steps[2].decision);

  console.log('=== FAZ 6: kalite & güvenlik ===');

  // --- Hasar-eksiklik yaşam döngüsü ---
  const dfx = (
    await post('defects', {
      companyId: 1,
      projectId: PRJ,
      title: 'Banyo fayansı çatlak',
      defectKind: 'workmanship',
      severity: 'critical',
      vendorId: 1,
    })
  ).json;
  chk('hasar-eksiklik kodu sunucuda üretildi', 'DEF-0001', dfx.code);
  chk('kritik kusura ertesi gün bitiş önerildi', dayShift(1), dfx.dueDate);
  chk('geçiş listesi durumla geliyor', true, dfx.allowedTransitions.includes('fixed'));

  const badVerify = await post(`defects/${String(dfx.id)}/status`, {
    companyId: 1,
    status: 'verified',
  });
  chk('gidermeden doğrulama 400', 400, badVerify.status);

  await post(`defects/${String(dfx.id)}/status`, {
    companyId: 1,
    status: 'fixed',
    note: 'değişti',
  });
  const reopened = (
    await post(`defects/${String(dfx.id)}/status`, {
      companyId: 1,
      status: 'open',
      note: 'fayans yine çatlak',
    })
  ).json;
  chk('yeniden açılış reopen sayacını artırdı', 1, reopened.reopenCount);
  chk('yeniden açılışta giderme izi temizlendi', null, reopened.fixedAt);

  await post(`defects/${String(dfx.id)}/status`, { companyId: 1, status: 'fixed' });
  const verified = (
    await post(`defects/${String(dfx.id)}/status`, { companyId: 1, status: 'verified' })
  ).json;
  chk('giderilen kayıt doğrulandı', 'verified', verified.status);

  const dHist = (await get(`defects/${String(dfx.id)}?companyId=1`)).json;
  // open(açılış) + fixed + open + fixed + verified = 5 satır
  chk('hasar-eksiklik geçmişi tam', 5, dHist.history.length);

  const dSum = (await get(`defects/summary?companyId=1&projectId=${String(PRJ)}`)).json.rows[0];
  chk('özet: yeniden açılan kusur sayılıyor', 1, dSum.reopenedCount);

  // --- Denetleme: Taşeron Karne Formu ---
  const tpl6 = (
    await post('inspection-templates', {
      companyId: 1,
      code: `E2E-KARNE-${String(PRJ)}`,
      name: 'E2E Taşeron Karnesi',
      kind: 'subcontractor_scorecard',
      passPct: 70,
      items: [
        { code: 'K1', text: 'İmalat kalitesi', weight: 2, maxScore: 5 },
        { code: 'K2', text: 'İş programına uyum', weight: 1, maxScore: 5 },
        { code: 'ISG', text: 'Baret/KKD kullanımı', weight: 1, maxScore: 5, isCritical: true },
      ],
    })
  ).json;
  chk('karne şablonu kuruldu (3 madde)', 3, tpl6.items.length);
  chk('karne formu taşeron istiyor', true, tpl6.requiresVendor);

  const noVendor = await post('inspections', {
    companyId: 1,
    projectId: PRJ,
    templateId: tpl6.id,
    inspectionDate: dayShift(0),
  });
  chk('karne denetimi taşeronsuz 400', 400, noVendor.status);

  const insp = (
    await post('inspections', {
      companyId: 1,
      projectId: PRJ,
      templateId: tpl6.id,
      vendorId: 1,
      inspectionDate: dayShift(0),
      periodLabel: '2026-07',
    })
  ).json;
  chk('denetim cevap iskeletiyle kuruldu', 3, insp.answers.length);
  chk('denetim kodu üretildi', true, insp.code.startsWith('DEN-'));

  const k1 = insp.answers.find((x) => x.itemText === 'İmalat kalitesi');
  const k2 = insp.answers.find((x) => x.itemText === 'İş programına uyum');
  const isg = insp.answers.find((x) => x.itemText === 'Baret/KKD kullanımı');

  // Kritik madde SIFIR: puan yüksek olsa da denetim kalmalı
  const scored = (
    await put(`inspections/${String(insp.id)}/answers`, {
      companyId: 1,
      answers: [
        { itemId: k1.itemId, score: 5 },
        { itemId: k2.itemId, isNa: true },
        { itemId: isg.itemId, score: 0 },
      ],
    })
  ).json;
  // (5×2 + 0×1) / (5×2 + 5×1) = 10/15 = %66,67 — N/A paydadan düştü
  chk('N/A madde paydadan düştü', 66.67, scored.live.scorePct);
  chk('kritik madde sıfır → kaldı', false, scored.live.passed);
  chk('kritik başarısızlık sayısı', 1, scored.live.criticalFailures);

  // Düzeltilmiş puanla tamamla
  const rescored = (
    await put(`inspections/${String(insp.id)}/answers`, {
      companyId: 1,
      answers: [{ itemId: isg.itemId, score: 4 }],
    })
  ).json;
  chk('yeni puanla geçti (14/15)', true, rescored.live.passed);
  const completed = (
    await post(`inspections/${String(insp.id)}/status`, { companyId: 1, status: 'completed' })
  ).json;
  chk('denetim tamamlandı, harf notu', 'A', completed.grade);

  // Başarısız maddeden hasar-eksiklik doğur — taşeron denetimden devralınır
  const raised = (
    await post(`inspections/${String(insp.id)}/items/${String(k1.itemId)}/raise-defect`, {
      companyId: 1,
      defectKind: 'workmanship',
      severity: 'high',
    })
  ).json;
  chk('denetim maddesinden kusur doğdu', 'inspection', raised.defect.source);
  chk('kusur karnedeki taşerona yazıldı', 1, raised.defect.vendorId);
  const dupRaise = await post(
    `inspections/${String(insp.id)}/items/${String(k1.itemId)}/raise-defect`,
    { companyId: 1, defectKind: 'workmanship' },
  );
  chk('aynı maddeden ikinci kusur 400', 400, dupRaise.status);

  await post(`inspections/${String(insp.id)}/status`, { companyId: 1, status: 'approved' });
  const editApproved = await put(`inspections/${String(insp.id)}/answers`, {
    companyId: 1,
    answers: [{ itemId: k1.itemId, score: 1 }],
  });
  chk('onaylanmış denetimin cevabı değiştirilemez (400)', 400, editApproved.status);

  const card = (await get(`vendor-scorecard?companyId=1&projectId=${String(PRJ)}`)).json.rows;
  chk('taşeron karnesi satırı oluştu', 1, card.length);
  chk('karnede denetim sayısı', 1, card[0].inspectionCount);
  chk('karnede reopen toplamı', 1, card[0].reopenTotal);

  // --- RFI ---
  const rfi = (
    await post('rfis', {
      companyId: 1,
      projectId: PRJ,
      subject: 'P12 perde kalınlığı',
      question: '25 mi 30 mu?',
      discipline: 'structural',
      priority: 'urgent',
      dueDate: dayShift(-2),
      impactDays: 3,
    })
  ).json;
  chk('RFI kodu üretildi', 'RFI-0001', rfi.code);
  chk('RFI gecikmesi sunucuda hesaplandı', 2, rfi.daysOverdue);

  const answered = (
    await post(`rfis/${String(rfi.id)}/answer`, { companyId: 1, answer: '30 cm, pafta R-04.' })
  ).json;
  chk('cevap durumu answered yaptı', 'answered', answered.status);

  const rfiReopen = (await post(`rfis/${String(rfi.id)}/status`, { companyId: 1, status: 'open' }))
    .json;
  chk('yeniden açılan RFI cevabı korur', '30 cm, pafta R-04.', rfiReopen.answer);
  await post(`rfis/${String(rfi.id)}/status`, { companyId: 1, status: 'closed' });

  const rfiSum = (await get(`rfis/summary?companyId=1&projectId=${String(PRJ)}`)).json;
  chk('RFI özetinde süre etkisi toplamı', 3, rfiSum.impactDaysTotal);

  // --- Görevlendirme ---
  const asg = (
    await post('assignments', {
      companyId: 1,
      projectId: PRJ,
      title: 'Fayans söküm-yenileme',
      sourceKind: 'defect',
      sourceId: dfx.id,
      dueDate: dayShift(3),
    })
  ).json;
  chk('görev kodu üretildi', 'GRV-0001', asg.code);

  const halfSource = await post('assignments', {
    companyId: 1,
    projectId: PRJ,
    title: 'yarım kaynak',
    sourceKind: 'rfi',
  });
  chk('yarım kaynak referansı 400', 400, halfSource.status);

  const doneAsg = (
    await post(`assignments/${String(asg.id)}/status`, { companyId: 1, status: 'done' })
  ).json;
  chk('biten görev %100', 100, doneAsg.progressPct);

  const bySource = (
    await get(`assignments?companyId=1&sourceKind=defect&sourceId=${String(dfx.id)}`)
  ).json.assignments;
  chk('kaynak belgeden görev bulunur', 1, bySource.length);

  // --- Ortak ek dosyası ---
  const qf = (
    await post('quality-files', {
      companyId: 1,
      docKind: 'defect',
      docId: dfx.id,
      stage: 'after',
      title: 'Yenilenen fayans',
      contentBase64: Buffer.from('e2e-foto').toString('base64'),
      mimeType: 'image/jpeg',
    })
  ).json;
  chk('ek dosya yüklendi (gömülü)', true, qf.hasContent);
  const qfList = (await get(`quality-files/defect/${String(dfx.id)}?companyId=1`)).json.files;
  chk('ek dosya listelendi', 1, qfList.length);
  const qfDel = (await del(`quality-files/${String(qf.id)}?companyId=1`)).json;
  chk('ek dosya silindi', true, qfDel.deleted);

  console.log('=== TEMİZLİK ===');
  await del(`projects/${PRJ}?companyId=1`);
  await del(`progress-templates/${TPL}?companyId=1`);
  await del(`progress-templates/${unitTpl.id}?companyId=1`);
  for (const f of [af, af2, af3]) {
    await post(`approvals/${String(f.id)}/cancel`, { companyId: 1 });
  }
  await del(`inspection-templates/${String(tpl6.id)}?companyId=1`);
  console.log('  proje pasife çekildi, şablonlar pasifleştirildi');

  console.log(`\nSONUÇ: ${String(ok)} geçti, ${String(fail)} başarısız`);
  if (fail > 0) {
    console.log('Başarısızlar: ' + failures.join(' | '));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('E2E hatası:', e);
  process.exitCode = 1;
});

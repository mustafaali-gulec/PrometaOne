/**
 * Satınalma Siparişi (PO) baskı/PDF raporu.
 *
 * Örnek SAS çıktısı formatını birebir taklit eden, bağımsız (self-contained)
 * yazdırılabilir HTML üretir; tarayıcının "Yazdır → PDF olarak kaydet"i ile PDF
 * alınır (ek bağımlılık yok). Düzen: başlık + SAS no/tarih, Satıcı (tedarikçi) ve
 * Fatura (firma) blokları, Siparişi oluşturan / ödeme vadesi, kalem tablosu,
 * toplam ve koşullar.
 */
import type { PurchaseOrderDto, VendorDto } from '../../application/dto/PurchasingDtos';

export interface ReportCompany {
  name?: string | null;
  taxNo?: string | null;
  taxOffice?: string | null;
  address?: string | null;
}

export interface PurchaseOrderReportInput {
  order: PurchaseOrderDto;
  vendor?: VendorDto | null;
  /** Alıcı (sipariş veren) firma — "Fatura Bilgileri" bloğu. */
  company?: ReportCompany;
  createdByName?: string;
  paymentTerm?: string;
  /** Koşullar listesi; verilmezse DEFAULT_PO_TERMS kullanılır. */
  terms?: ReadonlyArray<string>;
  lang?: 'tr' | 'en';
}

/** Standart (jenerik) satınalma siparişi koşulları — örnek SAS'tan uyarlanmıştır. */
export const DEFAULT_PO_TERMS: ReadonlyArray<string> = [
  'Göndermiş olduğumuz Satınalma Siparişi’nin (SAS) firmanıza ulaşmasından itibaren 2 gün içerisinde itiraz etmemeniz durumunda SAS içeriğini ve koşullarını kabul etmiş olacaksınız.',
  'Şirketimiz; SAS’taki ürün/hizmetlerin tesliminin eksik veya geç olması ya da koşullara uygun olmaması durumunda, teslim süresinin dolduğu günün mesai bitimi itibarıyla SAS’i iptal etme ve oluşan zararları firmanızdan tazmin etme haklarını saklı tutar.',
  'Şirketimizin sipariş tarihinden önce verilmiş yazılı onayı olmadan, bu siparişe ilişkin para alacağı dahil olmak üzere siparişten doğan hak ve yükümlülükler tamamen veya kısmen, doğrudan veya dolaylı olarak başka bir kişiye temlik ve/veya devir edilemez.',
  'Teslimat noktasında imzalanan irsaliyenin bir kopyası fatura ile birlikte gönderilmelidir.',
  'El yazısı ile düzenlenmiş faturalar kabul edilmeyip iade edilecektir.',
  'SAS numarasının fatura üzerinde bulunması zorunludur. Üzerinde SAS numarası olmayan faturalar iade edilecektir.',
  'Yurt içi döviz faturalarında ödeme ve tahsilat TL üzerinden yapılır; kur, ödeme gününden bir gün önce saat 15:30’da yayımlanan TCMB Döviz Satış Kuru ile hesaplanır.',
  'Bu siparişe ait bilgiler, Şirketimizden onay alınmadan 3. firmalar ile paylaşılamaz.',
];

const nf = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtAmount(n: number): string {
  return nf.format(Number.isFinite(n) ? n : 0);
}

function fmtDate(iso: string | null): string {
  if (iso === null || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${String(d.getFullYear())}`;
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPurchaseOrderReportHtml(input: PurchaseOrderReportInput): string {
  const { order, vendor } = input;
  const company = input.company ?? {};
  const terms = input.terms ?? DEFAULT_PO_TERMS;
  const orderDate = fmtDate(order.orderedAt ?? order.createdAt);

  const rows = order.lines
    .map((l) => {
      const tutar = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
      return `<tr>
        <td class="mono">${esc(String(l.lineNo * 10).padStart(5, '0'))}</td>
        <td>${esc(l.description)}</td>
        <td class="num">${nf.format(Number(l.quantity) || 0)}</td>
        <td class="num">${fmtAmount(Number(l.unitPrice) || 0)}</td>
        <td class="num">${fmtAmount(tutar)}</td>
      </tr>`;
    })
    .join('');

  const termsHtml = terms
    .map((t, i) => `<li><span class="tn">${i + 1})</span> ${esc(t)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"/>
<title>Satınalma Siparişi ${esc(order.poNo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color:#111; margin:0; padding:24px; font-size:12px; }
  .doc { max-width: 800px; margin: 0 auto; }
  h1 { font-size: 18px; margin:0 0 2px; letter-spacing:.5px; }
  .sasno { font-size:12px; color:#333; margin-bottom:14px; }
  .cols { display:flex; gap:24px; }
  .col { flex:1; }
  .box-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.4px;
    border-bottom:1px solid #999; padding-bottom:3px; margin:10px 0 6px; color:#444; }
  .kv { margin:1px 0; }
  .kv b { display:inline-block; min-width:96px; color:#555; font-weight:600; }
  table.items { width:100%; border-collapse:collapse; margin-top:14px; }
  table.items th { background:#f1f1f1; border-bottom:1.5px solid #888; padding:6px 8px; text-align:left; font-size:11px; }
  table.items td { border-bottom:1px solid #e3e3e3; padding:6px 8px; vertical-align:top; }
  .num { text-align:right; font-variant-numeric: tabular-nums; }
  .mono { font-family: ui-monospace, "Consolas", monospace; }
  .total { text-align:right; font-weight:700; font-size:13px; margin-top:8px; padding-top:6px; border-top:2px solid #888; }
  .terms { margin-top:18px; }
  .terms h2 { font-size:12px; margin:0 0 6px; }
  .terms ul { list-style:none; padding:0; margin:0; }
  .terms li { font-size:10.5px; color:#333; margin:3px 0; line-height:1.35; }
  .terms .tn { font-weight:700; color:#111; margin-right:3px; }
  .cur { margin-top:12px; font-weight:600; border-top:1px solid #ddd; padding-top:6px; }
  @media print { body { padding:0; } .doc { max-width:none; } }
</style></head>
<body><div class="doc">
  <div class="cols">
    <div class="col">
      <h1>Satınalma Siparişi</h1>
      <div class="sasno">${esc(order.poNo)} / ${orderDate}</div>
    </div>
    <div class="col">
      <div class="box-title">Satıcı Bilgileri</div>
      <div class="kv"><b>Ünvan</b>${esc(vendor?.name ?? '—')}</div>
      ${vendor?.code ? `<div class="kv"><b>Cari Kodu</b>${esc(vendor.code)}</div>` : ''}
      ${vendor?.taxOffice ? `<div class="kv"><b>Vergi Dairesi</b>${esc(vendor.taxOffice)}</div>` : ''}
      ${vendor?.taxId ? `<div class="kv"><b>Vergi No</b>${esc(vendor.taxId)}</div>` : ''}
      ${vendor?.address ? `<div class="kv"><b>Adres</b>${esc(vendor.address)}</div>` : ''}
    </div>
  </div>

  <div class="cols">
    <div class="col">
      <div class="box-title">Fatura Bilgileri</div>
      <div class="kv"><b>Ünvan</b>${esc(company.name ?? '—')}</div>
      ${company.taxOffice ? `<div class="kv"><b>Vergi Dairesi</b>${esc(company.taxOffice)}</div>` : ''}
      ${company.taxNo ? `<div class="kv"><b>Vergi No</b>${esc(company.taxNo)}</div>` : ''}
      ${company.address ? `<div class="kv"><b>Adres</b>${esc(company.address)}</div>` : ''}
    </div>
    <div class="col">
      <div class="box-title">Siparişi Oluşturan / Ödeme Vadesi</div>
      <div class="kv">${esc(input.createdByName ?? '—')}</div>
      <div class="kv">${esc(input.paymentTerm ?? 'Peşin Ödeme')}</div>
    </div>
  </div>

  <div class="cur">Para birimi: ${esc(order.currency)}</div>

  <table class="items">
    <thead><tr>
      <th>Kalem</th><th>Malzeme / Açıklama</th><th class="num">Miktar</th>
      <th class="num">Birim Fiyat</th><th class="num">Tutar</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Toplam: ${fmtAmount(order.totalAmount)} ${esc(order.currency)}</div>

  <div class="terms">
    <h2>Koşullar</h2>
    <ul>${termsHtml}</ul>
  </div>
</div></body></html>`;
}

/**
 * Raporu yeni pencerede açıp yazdırma diyaloğunu tetikler.
 * (Tarayıcıda "PDF olarak kaydet" ile PDF alınır.)
 */
export function printPurchaseOrder(input: PurchaseOrderReportInput): void {
  if (typeof window === 'undefined') return;
  const html = buildPurchaseOrderReportHtml(input);
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (w === null) {
    // Popup engellendiyse: blob indir
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAS-${input.order.poNo}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // İçerik render olduktan sonra yazdır.
  w.setTimeout(() => {
    w.print();
  }, 250);
}

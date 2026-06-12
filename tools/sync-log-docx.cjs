// AJAN_KOORDINASYON.md Islem Logu tablosunu .tmp-docx/word/document.xml'e yazar.
// Header satiri korunur; tum veri satirlari md'den yeniden uretilir (zebra dolgu).
const fs = require('fs');

// 1) md'den Islem Logu satirlarini al
const md = fs.readFileSync('AJAN_KOORDINASYON.md', 'utf8');
const lines = md.split('\n');
const start = lines.findIndex((l) => l.includes('# 6. Islem Logu'));
const tableLines = lines.slice(start).filter((l) => l.startsWith('|'));
const dataLines = tableLines.slice(2); // header + separator atla

const unescapeMd = (s) => s.replace(/\\([|_*\\#&<>])/g, '$1').trim();
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = dataLines.map((l) => {
  // kacisli olmayan pipe'lara gore bol
  const cells = l
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((c) => xmlEscape(unescapeMd(c)));
  if (cells.length !== 6) throw new Error('6 sutun degil: ' + l.slice(0, 80));
  return cells;
});
console.log('md veri satiri:', rows.length);

// 2) hucre/satir XML sablonu (mevcut docx satir stiliyle birebir)
const WIDTHS = [1100, 1100, 3100, 800, 1200, 2060];
const cellXml = (text, w, fill) =>
  `<w:tc><w:tcPr><w:tcW w:type="dxa" w:w="${w}"/>` +
  `<w:tcBorders><w:top w:val="single" w:color="BFBFBF" w:sz="1"/><w:left w:val="single" w:color="BFBFBF" w:sz="1"/><w:bottom w:val="single" w:color="BFBFBF" w:sz="1"/><w:right w:val="single" w:color="BFBFBF" w:sz="1"/></w:tcBorders>` +
  `<w:shd w:fill="${fill}" w:val="clear"/>` +
  `<w:tcMar><w:top w:type="dxa" w:w="80"/><w:left w:type="dxa" w:w="120"/><w:bottom w:type="dxa" w:w="80"/><w:right w:type="dxa" w:w="120"/></w:tcMar></w:tcPr>` +
  `<w:p><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
const rowXml = (cells, i) => {
  const fill = i % 2 === 0 ? 'FFFFFF' : 'F2F2F2';
  return '<w:tr>' + cells.map((c, j) => cellXml(c, WIDTHS[j], fill)).join('') + '</w:tr>';
};

// 3) document.xml'de Islem Logu tablosunu bul ve veri satirlarini degistir
const docPath = '.tmp-docx/word/document.xml';
let doc = fs.readFileSync(docPath, 'utf8');
const hIdx = doc.indexOf('6. Islem Logu');
const tblStart = doc.indexOf('<w:tbl>', hIdx);
const headerEnd = doc.indexOf('</w:tr>', tblStart) + '</w:tr>'.length;
const tblEnd = doc.indexOf('</w:tbl>', tblStart);
if (hIdx < 0 || tblStart < 0 || tblEnd < 0) throw new Error('tablo bulunamadi');
const oldRowCount = (doc.slice(headerEnd, tblEnd).match(/<w:tr>/g) || []).length;
doc = doc.slice(0, headerEnd) + rows.map(rowXml).join('') + doc.slice(tblEnd);

// 4) baslik blogundaki guncelleme tarihi + surum
doc = doc.replace(/Son guncelleme: \d{4}-\d{2}-\d{2}/, 'Son guncelleme: 2026-06-12');
doc = doc.replace(/Surum: 1\.8/, 'Surum: 1.9');

fs.writeFileSync(docPath, doc, 'utf8');
console.log('eski veri satiri:', oldRowCount, '-> yeni:', rows.length);

/**
 * PdfParseTextExtractor — pdf-parse (pdf.js tabanlı) ile PDF → düz metin.
 *
 * Not: ana 'pdf-parse' girişi (index.js) module.parent yokken debug moduna
 * düşüp test dosyası okumaya çalıştığı için iç modül doğrudan import edilir.
 */
// @ts-expect-error — pdf-parse iç modülünün tip bildirimi yok (@types ana girişi tipler).
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

import type { PdfTextExtractor } from '../../application/ports/PdfTextExtractor.js';

interface PdfParseResult {
  text: string;
}

export class PdfParseTextExtractor implements PdfTextExtractor {
  async extractText(pdf: Buffer): Promise<string> {
    const result = await (pdfParse as (b: Buffer) => Promise<PdfParseResult>)(pdf);
    return result.text ?? '';
  }
}

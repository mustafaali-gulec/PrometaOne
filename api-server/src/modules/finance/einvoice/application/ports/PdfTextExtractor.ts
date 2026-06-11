/**
 * PdfTextExtractor — PDF baytlarından düz metin çıkarımı (port).
 *
 * Domain/application PDF kütüphanesine bağımlı olmasın diye soyutlandı.
 * Üretim adaptörü: infrastructure/pdf/PdfParseTextExtractor (pdf-parse).
 */
export interface PdfTextExtractor {
  extractText(pdf: Buffer): Promise<string>;
}

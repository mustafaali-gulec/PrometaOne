/**
 * buildXlsxBuffer — RunResult'tan xlsx Buffer üretir (exceljs).
 * Zamanlanmış rapor e-posta eki için. Sunucu tarafı export YALNIZ buradan
 * (HTTP export yok — istemci xlsx kullanır).
 */
import ExcelJS from 'exceljs';

import type { RunResult } from '../../application/ports/SqlExecutor.js';

export async function buildXlsxBuffer(result: RunResult, sheetName = 'Rapor'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31) || 'Rapor');
  ws.addRow(result.columns.map((c) => c.key));
  ws.getRow(1).font = { bold: true };
  for (const row of result.rows) {
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

import type { SpreadsheetCell } from './formulaEngine';

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

// ── CSV/Excel import helpers ───────────────────────
export function parseCSV(text: string): SpreadsheetCell[][] {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) { cells.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cells.push(current.trim());
    return cells.map(v => ({ value: v }));
  });
}

export async function parseExcelFile(file: File): Promise<SpreadsheetCell[][]> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [[{ value: '' }]];
  const data: SpreadsheetCell[][] = [];
  ws.eachRow((row) => {
    const cells: SpreadsheetCell[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push({ value: String(cell.value ?? '') });
    });
    data.push(cells);
  });
  // Normalize column count
  const maxCols = Math.max(...data.map(r => r.length), 1);
  return data.map(r => {
    while (r.length < maxCols) r.push({ value: '' });
    return r;
  });
}

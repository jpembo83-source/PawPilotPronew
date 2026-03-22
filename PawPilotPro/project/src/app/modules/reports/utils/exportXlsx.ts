import ExcelJS from 'exceljs';
import { toast } from 'sonner';

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?[\]:]/g, '_').slice(0, 31) || 'Sheet';
}

function triggerDownload(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToXlsx(
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string,
  sheetName = 'Report'
) {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(sanitizeSheetName(sheetName));

    ws.columns = columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width || 18,
    }));

    for (const row of data) {
      ws.addRow(columns.reduce((acc, c) => ({ ...acc, [c.key]: row[c.key] ?? '' }), {}));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    triggerDownload(buffer, filename);
  } catch (err) {
    console.error('Excel export failed:', err);
    toast.error('Failed to export spreadsheet. Please try again.');
  }
}

export async function exportMultiSheetXlsx(
  sheets: { name: string; data: Record<string, any>[]; columns: ExportColumn[] }[],
  filename: string
) {
  try {
    const workbook = new ExcelJS.Workbook();
    const usedNames = new Set<string>();

    for (const sheet of sheets) {
      let name = sanitizeSheetName(sheet.name);
      let counter = 1;
      while (usedNames.has(name)) {
        name = sanitizeSheetName(sheet.name).slice(0, 28) + `_${counter++}`;
      }
      usedNames.add(name);

      const ws = workbook.addWorksheet(name);

      ws.columns = sheet.columns.map(c => ({
        header: c.header,
        key: c.key,
        width: c.width || 18,
      }));

      for (const row of sheet.data) {
        ws.addRow(sheet.columns.reduce((acc, c) => ({ ...acc, [c.key]: row[c.key] ?? '' }), {}));
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    triggerDownload(buffer, filename);
  } catch (err) {
    console.error('Excel export failed:', err);
    toast.error('Failed to export spreadsheet. Please try again.');
  }
}

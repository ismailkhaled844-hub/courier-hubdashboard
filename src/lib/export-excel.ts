import * as XLSX from 'xlsx';

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  
  // Auto-width columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)).toString().length + 4,
  }));
  ws['!cols'] = colWidths;
  
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

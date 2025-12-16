import * as XLSX from 'xlsx';

export interface RankingExportSheet {
  name: string;
  rows: Record<string, unknown>[];
}

export const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const str = String(value).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    )
  ];
  return lines.join('\n');
};

// Convert multiple sheets to CSV with section headers
export const sheetsToCSV = (sheets: RankingExportSheet[]) => {
  const sections: string[] = [];
  
  sheets.forEach((sheet) => {
    if (sheet.rows.length === 0) return;
    
    // Add section header
    sections.push(`\n=== ${sheet.name} ===\n`);
    sections.push(toCsv(sheet.rows));
  });
  
  return sections.join('\n');
};

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadXlsx = (filename: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return;
  
  // Create a workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  
  // Set column widths for better readability
  const colWidths = Object.keys(rows[0]).map((key) => ({
    wch: Math.max(key.length, 15)
  }));
  ws['!cols'] = colWidths;
  
  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Scores');
  
  // Write the file
  XLSX.writeFile(wb, filename);
};

// Export with multiple sheets (one per category/division)
export const downloadXlsxMultiSheet = (filename: string, sheets: RankingExportSheet[]) => {
  const wb = XLSX.utils.book_new();
  
  sheets.forEach((sheet) => {
    if (sheet.rows.length === 0) return;
    
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    
    // Set column widths for better readability
    const colWidths = Object.keys(sheet.rows[0]).map((key) => ({
      wch: Math.max(key.length, 12)
    }));
    ws['!cols'] = colWidths;
    
    // Truncate sheet name to 31 chars (Excel limit)
    const sheetName = sheet.name.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  
  XLSX.writeFile(wb, filename);
};



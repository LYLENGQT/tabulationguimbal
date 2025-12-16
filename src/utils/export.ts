import * as XLSX from 'xlsx-js-style';

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

// Parse sheet name to extract category and division
const parseSheetInfo = (name: string): { category: string; division: 'male' | 'female' } => {
  const parts = name.split(' - ');
  const divisionPart = parts[parts.length - 1].toLowerCase();
  const category = parts.slice(0, -1).join(' - ');
  return {
    category,
    division: divisionPart === 'female' ? 'female' : 'male'
  };
};

// Convert multiple sheets to CSV with section headers
export const sheetsToCSV = (sheets: RankingExportSheet[]) => {
  const sections: string[] = [];
  
  sheets.forEach((sheet) => {
    if (sheet.rows.length === 0) return;
    
    const { category, division } = parseSheetInfo(sheet.name);
    
    // Add title header
    sections.push('\n');
    sections.push('Disyembre sa Guimbal 2025');
    sections.push(division === 'male' ? 'MR TEEN GUIMBAL' : 'MS TEEN GUIMBAL');
    sections.push(category);
    sections.push('');
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
  
  // Apply center alignment to all cells
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          alignment: {
            horizontal: 'center',
            vertical: 'center'
          }
        };
      }
    }
  }
  
  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Scores');
  
  // Write the file
  XLSX.writeFile(wb, filename);
};

// Helper to get rank background color
const getRankBgColor = (rank: number | string): string | null => {
  const numRank = typeof rank === 'string' ? parseFloat(rank) : rank;
  if (numRank <= 1.5) return 'FFD700'; // Gold
  if (numRank <= 2.5) return 'C0C0C0'; // Silver
  if (numRank <= 3.5) return 'CD7F32'; // Bronze
  return null;
};

// Export with multiple sheets (one per category/division)
export const downloadXlsxMultiSheet = (filename: string, sheets: RankingExportSheet[]) => {
  const wb = XLSX.utils.book_new();
  
  sheets.forEach((sheet) => {
    if (sheet.rows.length === 0) return;
    
    const { category, division } = parseSheetInfo(sheet.name);
    const headers = Object.keys(sheet.rows[0]);
    const numCols = headers.length;
    
    // Create title rows
    const titleRows = [
      { title: 'Disyembre sa Guimbal 2025' },
      { title: division === 'male' ? 'MR TEEN GUIMBAL' : 'MS TEEN GUIMBAL' },
      { title: category },
      {} // Empty row before data
    ];
    
    // Create worksheet with title rows first
    const ws: XLSX.WorkSheet = {};
    
    // Add title rows (merged across all columns)
    const titleRowOffset = titleRows.length;
    
    // Row 0: "Disyembre sa Guimbal 2025"
    ws['A1'] = { v: titleRows[0].title, t: 's', s: {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: 'center', vertical: 'center' }
    }};
    
    // Row 1: "MR TEEN GUIMBAL" or "MS TEEN GUIMBAL"
    ws['A2'] = { v: titleRows[1].title, t: 's', s: {
      font: { bold: true, sz: 12 },
      alignment: { horizontal: 'center', vertical: 'center' }
    }};
    
    // Row 2: Category name
    ws['A3'] = { v: titleRows[2].title, t: 's', s: {
      font: { bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' }
    }};
    
    // Row 3: Empty row (spacer)
    
    // Add merges for title rows
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }, // Row 1 merge
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }, // Row 2 merge
      { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } }  // Row 3 merge
    ];
    
    // Add header row (row index 4, which is row 5 in Excel)
    const headerRowIndex = titleRowOffset;
    headers.forEach((header, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIndex, c: colIdx });
      ws[cellRef] = {
        v: header,
        t: 's',
        s: {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E0E0E0' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: { bottom: { style: 'thin', color: { rgb: '000000' } } }
        }
      };
    });
    
    // Add data rows
    const rankColIndex = headers.indexOf('Rank');
    sheet.rows.forEach((row, rowIdx) => {
      const excelRowIdx = headerRowIndex + 1 + rowIdx;
      headers.forEach((header, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: excelRowIdx, c: colIdx });
        const cellValue = row[header];
        const isRankCol = colIdx === rankColIndex;
        
        // Base style
        const style: Record<string, unknown> = {
          alignment: { horizontal: 'center', vertical: 'center' }
        };
        
        // Rank column highlighting
        if (isRankCol && cellValue !== undefined && cellValue !== null) {
          const bgColor = getRankBgColor(cellValue as number | string);
          if (bgColor) {
            style.fill = { fgColor: { rgb: bgColor } };
            style.font = { bold: true };
          }
        }
        
        ws[cellRef] = {
          v: cellValue ?? '',
          t: typeof cellValue === 'number' ? 'n' : 's',
          s: style
        };
      });
    });
    
    // Set worksheet range
    const totalRows = headerRowIndex + 1 + sheet.rows.length;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: numCols - 1 } });
    
    // Set column widths
    ws['!cols'] = headers.map((key) => ({
      wch: Math.max(key.length, 12)
    }));
    
    // Set row heights for title rows
    ws['!rows'] = [
      { hpt: 22 }, // Title row 1
      { hpt: 20 }, // Title row 2
      { hpt: 18 }, // Title row 3 (category)
      { hpt: 10 }  // Empty spacer row
    ];
    
    // Truncate sheet name to 31 chars (Excel limit)
    const sheetName = sheet.name.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  
  XLSX.writeFile(wb, filename);
};



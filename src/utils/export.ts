import * as XLSX from 'xlsx';

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

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadExcel = (filename: string, data: Array<Record<string, unknown>>, sheetName = 'Sheet1') => {
  if (!data.length) {
    alert('No data to export');
    return;
  }

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert data to worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths (auto-size based on content)
  const maxWidth = 50;
  const colWidths = Object.keys(data[0]).map((key) => {
    const maxLength = Math.max(
      key.length,
      ...data.map((row) => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLength + 2, maxWidth) };
  });
  worksheet['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Write file
  XLSX.writeFile(workbook, filename);
};

export const downloadExcelMultiSheet = (
  filename: string,
  sheets: Array<{ name: string; data: Array<Record<string, unknown>> }>
) => {
  if (!sheets.length) {
    alert('No data to export');
    return;
  }

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Add each sheet
  sheets.forEach(({ name, data }) => {
    if (data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Set column widths
      const maxWidth = 50;
      const colWidths = Object.keys(data[0]).map((key) => {
        const maxLength = Math.max(
          key.length,
          ...data.map((row) => String(row[key] || '').length)
        );
        return { wch: Math.min(maxLength + 2, maxWidth) };
      });
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    }
  });

  // Write file
  XLSX.writeFile(workbook, filename);
};



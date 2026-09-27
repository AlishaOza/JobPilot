import ExcelJS from "exceljs";

export async function readWorksheetRows(
  filePath: string,
  requiredHeaders: string[],
): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`Excel file ${filePath} is missing columns: ${missing.join(", ")}`);
  }

  const rows: Record<string, string>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const record: Record<string, string> = {};
    headers.forEach((header, colNumber) => {
      if (!header) {
        return;
      }
      record[header] = cellToString(row.getCell(colNumber).value);
    });
    const hasValue = Object.values(record).some((value) => value.trim() !== "");
    if (hasValue) {
      rows.push(record);
    }
  });

  return rows;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && "text" in value) {
    return String(value.text);
  }
  if (typeof value === "object" && value !== null && "hyperlink" in value) {
    const hyperlink = value as unknown as ExcelJS.CellHyperlinkValue;
    return String(hyperlink.text ?? hyperlink.hyperlink ?? "");
  }
  return String(value);
}

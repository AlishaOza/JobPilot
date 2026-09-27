import { mkdir } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

export async function writeWorksheet(
  filePath: string,
  sheetName: string,
  headers: string[],
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(18, header.length + 4) }));

  for (const row of rows) {
    const mapped: Record<string, string | number | boolean> = {};
    for (const header of headers) {
      const value = row[header];
      mapped[header] = value === null || value === undefined ? "" : value;
    }
    worksheet.addRow(mapped);
  }

  worksheet.getRow(1).font = { bold: true };
  await workbook.xlsx.writeFile(filePath);
}

export const JOB_HEADERS = ["Company", "Role", "Location", "Job URL", "Apply URL", "Source", "Posted", "Posted At"] as const;

export const APPLICATION_HEADERS = [
  "Application ID",
  "Company",
  "Role",
  "Location",
  "Job URL",
  "Application URL",
  "Destination",
  "Posted",
  "Posting Status",
  "Resume",
  "Status",
  "Manual Review",
  "Missing Information",
  "Answers",
  "Created At",
  "Submitted At",
  "Follow Up Date",
  "Notes",
] as const;

export const CONTACT_HEADERS = [
  "Company",
  "Recruiter",
  "Role",
  "LinkedIn",
  "Email",
  "Phone",
  "Status",
  "Last Contacted",
  "Follow Up Date",
  "Notes",
] as const;

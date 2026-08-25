/**
 * Parses an uploaded leads file into header/row form, accepting both CSV
 * (via PapaParse, unchanged) and Excel .xlsx (via exceljs). Added because a
 * common real-world export — e.g. Firmable, Apollo, LinkedIn Sales
 * Navigator — comes as .xlsx, not .csv; before this, selecting one either
 * got blocked by the file picker or (if forced through some other path) got
 * silently mis-parsed as garbled CSV text, corrupting every column
 * including phone.
 *
 * exceljs over the `xlsx` npm package deliberately: the npm-published
 * `xlsx` (SheetJS) is stuck on 0.18.5 with two unpatched high-severity CVEs
 * (prototype pollution, ReDoS) since fixed builds are only distributed from
 * SheetJS's own CDN, not npm — not acceptable for parsing untrusted
 * user-uploaded files.
 */
import Papa from "papaparse";
import ExcelJS from "exceljs";

export type ParsedSheet = { headers: string[]; rows: Record<string, string>[] };

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export function isXlsxFile(file: { name: string; type?: string }): boolean {
  return file.name.toLowerCase().endsWith(".xlsx") || (!!file.type && XLSX_MIME_TYPES.has(file.type));
}

function parseCsvText(text: string): ParsedSheet {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

/** Cell values come back typed (Date, number, formula result, rich text) — flatten every shape to the plain string the rest of the import pipeline expects. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text; // rich text
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue); // formula
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("");
  }
  return String(value);
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell.value).trim();
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header row already consumed above
    const record: Record<string, string> = {};
    let hasAnyValue = false;
    headers.forEach((header, i) => {
      if (!header) return;
      const value = cellToString(row.getCell(i + 1).value).trim();
      record[header] = value;
      if (value) hasAnyValue = true;
    });
    // Excel keeps trailing blank rows in a worksheet's used range — skip
    // them the same way skipEmptyLines already does for CSV.
    if (hasAnyValue) rows.push(record);
  });

  return { headers: headers.filter(Boolean), rows };
}

/** Browser-side: parses a File (CSV or .xlsx) into the same header/row shape either way. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  if (isXlsxFile(file)) {
    return parseXlsxBuffer(await file.arrayBuffer());
  }
  return parseCsvText(await file.text());
}

/** Server-side: same as parseSpreadsheetFile, from a Node Buffer + filename/type instead of a browser File. */
export async function parseSpreadsheetBuffer(buffer: Buffer, meta: { name: string; type?: string }): Promise<ParsedSheet> {
  if (isXlsxFile(meta)) {
    return parseXlsxBuffer(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  }
  return parseCsvText(buffer.toString("utf-8"));
}

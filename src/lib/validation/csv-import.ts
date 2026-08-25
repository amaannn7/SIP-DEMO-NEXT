/**
 * CSV row -> lead field mapping. Two paths: an explicit column mapping
 * confirmed by the user in the import UI's mapping step (applyColumnMapping,
 * in csv-field-map.ts), or this fixed alias-based auto-map used as a
 * fallback when no mapping is supplied (e.g. a programmatic API call).
 *
 * Validation is a separate pass (validateRow) from mapping — mapping never
 * silently drops or blanks a value a user actually typed in their CSV;
 * instead validateRow flags it as an issue so the mapping-step UI and the
 * import result can both tell the user exactly what happened to that row,
 * rather than a value just vanishing with no trace.
 */
import { guessFieldForHeader, IMPORT_TARGET_FIELDS, type ImportTargetField } from "./csv-field-map";

export type ParsedCsvRow = Record<string, string>;

export type MappedLeadRow = Record<ImportTargetField, string>;

function emptyMappedRow(): Record<ImportTargetField, string> {
  return Object.fromEntries(IMPORT_TARGET_FIELDS.map((f) => [f, ""])) as Record<ImportTargetField, string>;
}

export function mapCsvRow(row: ParsedCsvRow): MappedLeadRow {
  const raw = emptyMappedRow();
  for (const header of Object.keys(row)) {
    const field = guessFieldForHeader(header);
    if (field && row[header]) raw[field] = row[header].trim();
  }
  return raw;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RowIssueCode = "invalid_email" | "no_identifying_data";

export const ROW_ISSUE_LABELS: Record<RowIssueCode, string> = {
  invalid_email: "Invalid email format",
  no_identifying_data: "No name, company, email, or phone",
};

export type RowValidation = {
  /** True only when the row has no blocking issues and is safe to insert as-is. */
  ok: boolean;
  issues: RowIssueCode[];
  /** The row with normalization applied (lowercased/validated email, https-prefixed website) — always returned, even when `ok` is false, so the mapping preview can still show what WOULD be inserted. */
  normalized: MappedLeadRow;
};

/**
 * Validates + normalizes one mapped row. Never silently discards a
 * non-empty value: an unparseable email is flagged as `invalid_email`
 * (kept in `normalized.email` as-is, not blanked) rather than quietly
 * dropped the way the previous single-pass mapper did.
 */
export function validateRow(mapped: MappedLeadRow): RowValidation {
  const issues: RowIssueCode[] = [];

  const emailValid = !mapped.email || EMAIL_RE.test(mapped.email);
  if (!emailValid) issues.push("invalid_email");

  const hasIdentifyingData = Boolean(mapped.email || mapped.firstName || mapped.lastName || mapped.company || mapped.phone);
  if (!hasIdentifyingData) issues.push("no_identifying_data");

  const normalized: MappedLeadRow = {
    ...mapped,
    email: mapped.email && emailValid ? mapped.email.toLowerCase() : mapped.email,
    website: mapped.website ? (/^https?:\/\//i.test(mapped.website) ? mapped.website : `https://${mapped.website}`) : "",
  };

  return { ok: issues.length === 0, issues, normalized };
}

/** True when the row has no blocking validation issues — a valid email (if present) and at least one identifying field. */
export function isRowUsable(row: MappedLeadRow): boolean {
  return validateRow(row).ok;
}

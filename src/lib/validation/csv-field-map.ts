/**
 * The 13 mappable target fields for CSV import (12 lead fields + external
 * record id), matching the source system's column-mapping step. Auto-guess
 * aliases live here so the same alias list drives both the browser preview
 * (auto-suggested mapping the user can override) and the server-side import
 * (applies whatever mapping was confirmed).
 */
export const IMPORT_TARGET_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "title",
  "industry",
  "country",
  "website",
  "linkedin",
  "companySize",
  "notes",
  "zohoRecordId",
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

export const IMPORT_TARGET_LABELS: Record<ImportTargetField, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  title: "Title",
  industry: "Industry",
  country: "Country",
  website: "Website",
  linkedin: "LinkedIn",
  companySize: "Company size",
  notes: "Notes",
  zohoRecordId: "External record ID",
};

const FIELD_ALIASES: Record<ImportTargetField, string[]> = {
  firstName: ["first_name", "first name", "firstname", "first_name"],
  lastName: ["last_name", "last name", "lastname", "last_name"],
  // "primary email"/"primary work email" first — Firmable-style exports
  // list several email columns (primary/secondary/other, each with its own
  // deliverability flag); the primary one is the best single default to
  // auto-map, the rest stay Skip and are still manually mappable.
  email: ["email", "email address", "primary email", "primary work email", "work email"],
  // Same reasoning as email: "primary mobile" is Firmable/Apollo/LinkedIn
  // Sales Navigator's own column name for the lead's main phone number —
  // previously missing from this list entirely, so it fell back to Skip
  // instead of auto-mapping like every other recognized header does.
  phone: ["phone", "phone_number", "phone number", "mobile", "primary mobile", "primary phone"],
  company: ["company", "company_name", "account_name", "company name"],
  title: ["title", "job_title", "designation", "job title"],
  industry: ["industry"],
  country: ["country", "location", "mailing_country"],
  website: ["website", "company_website", "company website", "domain", "company domain"],
  linkedin: ["linkedin", "linkedin_url", "linkedin url"],
  companySize: ["company_size", "employees", "no_of_employees", "company size"],
  notes: ["notes", "description"],
  zohoRecordId: ["zoho_id", "record id", "recordid", "id", "external record id"],
};

/** Best-guess target field for a raw CSV header, or null if nothing matches — the user confirms/overrides in the mapping step. */
export function guessFieldForHeader(header: string): ImportTargetField | null {
  const normalized = header.trim().toLowerCase();
  for (const field of IMPORT_TARGET_FIELDS) {
    if (FIELD_ALIASES[field].some((alias) => alias === normalized)) return field;
  }
  return null;
}

export type ImportColumnMapping = Record<string, ImportTargetField | "">;

/** Applies a confirmed header -> field mapping to one parsed CSV row. */
export function applyColumnMapping(row: Record<string, string>, mapping: ImportColumnMapping): Record<ImportTargetField, string> {
  const result = Object.fromEntries(IMPORT_TARGET_FIELDS.map((f) => [f, ""])) as Record<ImportTargetField, string>;
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    const value = row[header];
    if (value) result[field] = value.trim();
  }
  return result;
}

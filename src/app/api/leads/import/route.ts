import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { leads, leadSourceEnum } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/session";
import { findExistingLeadKeys, nameCompanyDedupeKey, logLeadActivity } from "@/lib/db/queries/leads";
import { mapCsvRow, validateRow, type MappedLeadRow } from "@/lib/validation/csv-import";
import { applyColumnMapping, type ImportColumnMapping } from "@/lib/validation/csv-field-map";
import { parseSpreadsheetBuffer } from "@/lib/validation/spreadsheet-parse";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";
import { initialStageForSource } from "@/lib/leads/initial-stage";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — generous for a leads CSV, cheap to reject anything absurd

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    throw err;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const skipDuplicates = formData.get("skip_duplicates") !== "false";
  const mappingRaw = formData.get("mapping");
  const sourceRaw = formData.get("source");
  const source = leadSourceEnum.enumValues.includes(sourceRaw as (typeof leadSourceEnum.enumValues)[number])
    ? (sourceRaw as (typeof leadSourceEnum.enumValues)[number])
    : "import";

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ success: false, error: "File too large (max 5MB)" }, { status: 400 });
  }

  let columnMapping: ImportColumnMapping | null = null;
  if (typeof mappingRaw === "string" && mappingRaw) {
    try {
      columnMapping = JSON.parse(mappingRaw);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid column mapping" }, { status: 400 });
    }
  }

  let parsedSheet;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsedSheet = await parseSpreadsheetBuffer(buffer, { name: file.name, type: file.type });
  } catch {
    return NextResponse.json({ success: false, error: "Could not parse this file. Make sure it's a valid CSV or .xlsx file." }, { status: 400 });
  }
  if (parsedSheet.rows.length === 0) {
    return NextResponse.json({ success: false, error: "No rows found in this file" }, { status: 400 });
  }

  const existing = skipDuplicates
    ? await findExistingLeadKeys(session.user.orgId)
    : { emails: new Set<string>(), zohoIds: new Set<string>(), nameCompanyKeys: new Set<string>() };

  let imported = 0;
  let skipped = 0;
  let invalid = 0;
  const duplicateEmails: string[] = [];
  // Row-level identifiers (name/email/company, whichever is available) for
  // rows that failed validation — surfaced to the user instead of the
  // previous silent drop, so a row with a genuinely typo'd email doesn't
  // just vanish with no trace.
  const invalidRows: { row: string; issues: string[] }[] = [];
  const toInsert: (typeof leads.$inferInsert)[] = [];

  for (const row of parsedSheet.rows) {
    const mapped: MappedLeadRow = columnMapping ? (applyColumnMapping(row, columnMapping) as MappedLeadRow) : mapCsvRow(row);
    const validation = validateRow(mapped);
    if (!validation.ok) {
      invalid++;
      if (invalidRows.length < 25) {
        const label = [mapped.firstName, mapped.lastName].filter(Boolean).join(" ") || mapped.email || mapped.company || "(unlabeled row)";
        invalidRows.push({ row: label, issues: validation.issues });
      }
      continue;
    }
    const normalized = validation.normalized;

    // Name+company is only a duplicate signal when there's no email to check
    // instead — matches the source system's own asymmetric rule exactly.
    const nameCompanyKey =
      !normalized.email && (normalized.firstName || normalized.lastName)
        ? nameCompanyDedupeKey(normalized.firstName, normalized.lastName, normalized.company)
        : null;

    const isDuplicate =
      skipDuplicates &&
      ((normalized.zohoRecordId && existing.zohoIds.has(normalized.zohoRecordId)) ||
        (normalized.email && existing.emails.has(normalized.email)) ||
        (nameCompanyKey && existing.nameCompanyKeys.has(nameCompanyKey)));

    if (isDuplicate) {
      skipped++;
      if (duplicateEmails.length < 10) duplicateEmails.push(normalized.email || normalized.company || "unknown");
      continue;
    }

    if (normalized.email) existing.emails.add(normalized.email);
    if (normalized.zohoRecordId) existing.zohoIds.add(normalized.zohoRecordId);
    if (nameCompanyKey) existing.nameCompanyKeys.add(nameCompanyKey);

    toInsert.push({
      orgId: session.user.orgId,
      ownerId: session.user.id,
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      email: normalized.email || null,
      phone: normalized.phone || null,
      company: normalized.company || null,
      title: normalized.title || null,
      industry: normalized.industry || null,
      country: normalized.country || null,
      website: normalized.website || null,
      linkedin: normalized.linkedin || null,
      companySize: normalized.companySize || null,
      notes: normalized.notes || null,
      source,
      stage: initialStageForSource(source),
      zohoRecordId: normalized.zohoRecordId || null,
      lastActivityAt: new Date(),
    });
    imported++;
  }

  if (toInsert.length > 0) {
    const inserted = await db.insert(leads).values(toInsert).returning({ id: leads.id });
    await Promise.all(
      inserted.map((row) =>
        logLeadActivity({
          orgId: session.user.orgId,
          leadId: row.id,
          actorId: session.user.id,
          type: "imported",
        }),
      ),
    );
    // Scored in the background of the response (not awaited per-row above)
    // would be nicer for large imports, but at this scale sequential is
    // fine and keeps failures visible instead of silently swallowed.
    await Promise.all(inserted.map((row) => recomputeAndSaveLeadScores(session.user.orgId, row.id)));
    // Every other lead-mutating path calls this — this was the one place
    // that didn't, so newly imported leads could be invisible to search and
    // the leads list until something else happened to revalidate /leads.
    revalidatePath("/leads");
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    invalid,
    ...(duplicateEmails.length > 0 ? { duplicates: duplicateEmails } : {}),
    ...(invalidRows.length > 0 ? { invalidRows } : {}),
  });
}

import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/session";
import { STAGE_LABELS } from "@/lib/leads/stages";
import { CALL_OUTCOME_LABELS } from "@/lib/calls/outcomes";

const CSV_FIELDS = [
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
  "stage",
  "notes",
  "fitGrade",
  "fitScore",
  "emailsSentCount",
  "callsMadeCount",
  "lastCallOutcome",
  "createdAt",
  "updatedAt",
] as const;

const CSV_HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Company",
  "Title",
  "Industry",
  "Country",
  "Website",
  "LinkedIn",
  "Company Size",
  "Stage",
  "Notes",
  "Fit Grade",
  "Fit Score",
  "Emails Sent",
  "Calls Made",
  "Last Call Outcome",
  "Created At",
  "Updated At",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    throw err;
  }

  const idsParam = new URL(request.url).searchParams.get("ids");
  const conditions = [eq(leads.orgId, session.user.orgId), eq(leads.isDeleted, false)];
  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean);
    conditions.push(inArray(leads.id, ids));
  }

  const rows = await db
    .select()
    .from(leads)
    .where(and(...conditions));

  const lines = [CSV_HEADERS.map(csvEscape).join(",")];
  for (const lead of rows) {
    const values = CSV_FIELDS.map((field) => {
      if (field === "stage") return STAGE_LABELS[lead.stage];
      if (field === "lastCallOutcome") return lead.lastCallOutcome ? CALL_OUTCOME_LABELS[lead.lastCallOutcome] : "";
      if (field === "createdAt" || field === "updatedAt") return lead[field].toISOString();
      return String(lead[field] ?? "");
    });
    lines.push(values.map(csvEscape).join(","));
  }

  const csv = lines.join("\r\n");
  const filename = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

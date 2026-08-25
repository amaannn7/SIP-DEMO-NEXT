import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, leads, emailHistory, enrichmentResults, callLogs, leadActivity, callOutcomeEnum } from "@/lib/db/schema";
import type { ReportDateRange } from "@/lib/reports/date-range";

export type RepActivityRow = {
  userId: string;
  displayName: string;
  calls: number;
  conversions: number;
  emails: number;
  research: number;
  leadsCreated: number;
  activeDays: number;
};

const QUALIFIED_STAGES = ["consultation_booked", "won"] as const;

/**
 * Per-rep KPI table — real SQL GROUP BY per metric (source system looped
 * over in-memory JSON per rep; this aggregates in Postgres instead), then
 * joined by rep in application code since each metric comes from a
 * different table.
 */
export async function getRepActivityReport(orgId: string, range: ReportDateRange): Promise<RepActivityRow[]> {
  const { from, to } = range;

  const [reps, callsRows, emailsRows, researchRows, conversionsRows, leadsCreatedRows, activeDaysRows] = await Promise.all([
    db.query.users.findMany({ where: eq(users.orgId, orgId), columns: { id: true, displayName: true } }),

    db
      .select({ userId: callLogs.loggedBy, count: sql<number>`count(*)::int` })
      .from(callLogs)
      .where(and(eq(callLogs.orgId, orgId), gte(callLogs.createdAt, from), lte(callLogs.createdAt, to)))
      .groupBy(callLogs.loggedBy),

    db
      .select({ userId: leads.ownerId, count: sql<number>`count(*)::int` })
      .from(emailHistory)
      .innerJoin(leads, eq(emailHistory.leadId, leads.id))
      .where(and(eq(emailHistory.orgId, orgId), gte(emailHistory.createdAt, from), lte(emailHistory.createdAt, to)))
      .groupBy(leads.ownerId),

    db
      .select({ userId: leads.ownerId, count: sql<number>`count(*)::int` })
      .from(enrichmentResults)
      .innerJoin(leads, eq(enrichmentResults.leadId, leads.id))
      .where(and(eq(enrichmentResults.orgId, orgId), gte(enrichmentResults.createdAt, from), lte(enrichmentResults.createdAt, to)))
      .groupBy(leads.ownerId),

    db
      .select({ userId: leads.ownerId, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(
          eq(leads.orgId, orgId),
          sql`${leads.stage} IN (${sql.join(
            QUALIFIED_STAGES.map((s) => sql`${s}`),
            sql`, `,
          )})`,
          gte(leads.updatedAt, from),
          lte(leads.updatedAt, to),
        ),
      )
      .groupBy(leads.ownerId),

    db
      .select({ userId: leads.ownerId, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.orgId, orgId), gte(leads.createdAt, from), lte(leads.createdAt, to)))
      .groupBy(leads.ownerId),

    db
      .select({ userId: leadActivity.actorId, days: sql<number>`count(distinct date(${leadActivity.createdAt}))::int` })
      .from(leadActivity)
      .where(and(eq(leadActivity.orgId, orgId), gte(leadActivity.createdAt, from), lte(leadActivity.createdAt, to)))
      .groupBy(leadActivity.actorId),
  ]);

  const toMap = (rows: { userId: string | null; count: number }[]) =>
    new Map(rows.filter((r) => r.userId).map((r) => [r.userId as string, r.count]));
  const callsMap = toMap(callsRows);
  const emailsMap = toMap(emailsRows);
  const researchMap = toMap(researchRows);
  const conversionsMap = toMap(conversionsRows);
  const leadsCreatedMap = toMap(leadsCreatedRows);
  const activeDaysMap = new Map(
    activeDaysRows.filter((r) => r.userId).map((r) => [r.userId as string, r.days]),
  );

  return reps.map((rep) => ({
    userId: rep.id,
    displayName: rep.displayName,
    calls: callsMap.get(rep.id) ?? 0,
    conversions: conversionsMap.get(rep.id) ?? 0,
    emails: emailsMap.get(rep.id) ?? 0,
    research: researchMap.get(rep.id) ?? 0,
    leadsCreated: leadsCreatedMap.get(rep.id) ?? 0,
    activeDays: activeDaysMap.get(rep.id) ?? 0,
  }));
}

export type CallOutcomeSummary = { outcome: string; count: number };

export type CallsReportFilters = { repId?: string; outcome?: string };

export async function getCallsReport(orgId: string, range: ReportDateRange, filters: CallsReportFilters = {}) {
  const { from, to } = range;
  const baseConditions = [eq(callLogs.orgId, orgId), gte(callLogs.createdAt, from), lte(callLogs.createdAt, to)];
  if (filters.repId) baseConditions.push(eq(callLogs.loggedBy, filters.repId));
  if (filters.outcome) baseConditions.push(eq(callLogs.outcome, filters.outcome as (typeof callOutcomeEnum.enumValues)[number]));

  const [rows, outcomeSummary] = await Promise.all([
    db.query.callLogs.findMany({
      where: and(...baseConditions),
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
      with: {
        lead: { columns: { id: true, firstName: true, lastName: true, company: true } },
        loggedByUser: { columns: { id: true, displayName: true } },
      },
    }),
    db
      .select({ outcome: callLogs.outcome, count: sql<number>`count(*)::int` })
      .from(callLogs)
      .where(and(...baseConditions))
      .groupBy(callLogs.outcome),
  ]);

  return { rows, outcomeSummary };
}

export type ActivityTimelineEntry = {
  id: string;
  type: string;
  createdAt: Date;
  actorName: string | null;
  leadName: string | null;
  payload: Record<string, unknown>;
};

export async function getActivityTimeline(orgId: string, range: ReportDateRange, limit = 100): Promise<ActivityTimelineEntry[]> {
  const rows = await db.query.leadActivity.findMany({
    where: and(eq(leadActivity.orgId, orgId), gte(leadActivity.createdAt, range.from), lte(leadActivity.createdAt, range.to)),
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    limit,
    with: {
      actor: { columns: { displayName: true } },
      lead: { columns: { firstName: true, lastName: true, company: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    createdAt: row.createdAt,
    actorName: row.actor?.displayName ?? null,
    leadName: row.lead ? [row.lead.firstName, row.lead.lastName].filter(Boolean).join(" ") || row.lead.company : null,
    payload: row.payload,
  }));
}

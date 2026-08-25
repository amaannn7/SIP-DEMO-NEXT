import "server-only";

import { and, eq, ne, sql, gte, lte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, users, callLogs, emailHistory, enrichmentResults, leadActivity } from "@/lib/db/schema";
import { STAGE_LABELS } from "@/lib/leads/stages";
import { calculateSlaStatus } from "@/lib/scoring/sla-status";
import { calculateDaysSinceActivity } from "@/lib/scoring/days-since-activity";
import { getSlaMaxDaysByStage } from "@/lib/db/queries/org-settings";
import { todayDateString, startOfDay, endOfDay } from "@/lib/daily/today";

const FUNNEL_STAGE_ORDER = ["new_lead", "research", "email_sent", "call_attempted", "engaged", "consultation_booked"] as const;

export type OperationsMetrics = {
  activePipeline: number;
  consultationsMtd: number;
  overdueActions: number;
  staleStages: number;
  responseRatePercent: number;
};

export async function getOperationsMetrics(orgId: string): Promise<OperationsMetrics> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [activeRows, consultationsRows, slaMaxDays, emailedRows, respondedRows] = await Promise.all([
    db.query.leads.findMany({
      where: and(eq(leads.orgId, orgId), eq(leads.isDeleted, false), ne(leads.stage, "won"), ne(leads.stage, "lost")),
      columns: { stage: true, source: true, createdAt: true, lastActivityAt: true, followupDate: true },
    }),
    // Ports the source system's stage_entered_at check exactly: a lead only
    // counts toward this month if it actually MOVED into consultation_booked
    // this month — not merely edited some unrelated field this month while
    // already sitting in that stage. Falls back to createdAt for a lead
    // created directly into the stage (no stage_changed row to look up).
    db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from ${leads} l
      where l.org_id = ${orgId}
        and l.is_deleted = false
        and l.stage = 'consultation_booked'
        and coalesce(
          (
            select la.created_at from ${leadActivity} la
            where la.lead_id = l.id and la.type = 'stage_changed' and la.payload->>'to' = 'consultation_booked'
            order by la.created_at desc limit 1
          ),
          l.created_at
        ) >= ${startOfMonth.toISOString()}::timestamptz
    `),
    getSlaMaxDaysByStage(orgId),
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.orgId, orgId), gte(leads.emailsSentCount, 1))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.orgId, orgId), gte(leads.emailsSentCount, 1), ne(leads.stage, "email_sent"))),
  ]);

  const now = new Date();
  let overdueActions = 0;
  let staleStages = 0;
  for (const lead of activeRows) {
    const daysSinceActivity = calculateDaysSinceActivity(lead, now);
    const sla = calculateSlaStatus(lead, daysSinceActivity, slaMaxDays, now);
    if (sla.isOverdue) overdueActions++;
    if (sla.urgency === "critical") staleStages++;
  }

  const emailed = emailedRows[0]?.count ?? 0;
  const responded = respondedRows[0]?.count ?? 0;
  const responseRatePercent = emailed > 0 ? Math.round((responded / emailed) * 100) : 0;

  return {
    activePipeline: activeRows.length,
    consultationsMtd: consultationsRows[0]?.count ?? 0,
    overdueActions,
    staleStages,
    responseRatePercent,
  };
}

export type TeamActivityToday = {
  callsDone: number;
  callsTarget: number;
  emailsDone: number;
  emailsTarget: number;
  researchDone: number;
  researchTarget: number;
};

export async function getTeamActivityToday(orgId: string, targets: { callsTarget: number; emailsTarget: number; researchTarget: number }) {
  const today = todayDateString();
  const from = startOfDay(today);
  const to = endOfDay(today);

  const [[calls], [emails], [research]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(callLogs).where(and(eq(callLogs.orgId, orgId), gte(callLogs.createdAt, from), lte(callLogs.createdAt, to))),
    db.select({ count: sql<number>`count(*)::int` }).from(emailHistory).where(and(eq(emailHistory.orgId, orgId), gte(emailHistory.createdAt, from), lte(emailHistory.createdAt, to))),
    db.select({ count: sql<number>`count(*)::int` }).from(enrichmentResults).where(and(eq(enrichmentResults.orgId, orgId), gte(enrichmentResults.createdAt, from), lte(enrichmentResults.createdAt, to))),
  ]);

  return {
    callsDone: calls?.count ?? 0,
    callsTarget: targets.callsTarget,
    emailsDone: emails?.count ?? 0,
    emailsTarget: targets.emailsTarget,
    researchDone: research?.count ?? 0,
    researchTarget: targets.researchTarget,
  };
}

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  shareOfPipelinePercent: number;
  /**
   * Stage-over-stage conversion: this stage's count as a percent of the
   * previous stage's count, ports the source system's cc-funnel-rate column
   * (its own cumulative/cumulative formula always evaluated to 100% — a bug,
   * not a rate — so this computes the ratio the column was actually trying
   * to show). Null for the first stage, which has no "previous" to compare
   * against, matching the source system leaving it blank there too.
   */
  conversionRatePercent: number | null;
};

/**
 * Each lead sits in exactly one stage bucket (no stage-history table), so
 * both percentages here are bucket-count ratios, not true per-cohort
 * drop-off — the same limitation the source system's own bucket-count
 * approach has, just without its rate-formula bug.
 */
export async function getPipelineFunnel(orgId: string): Promise<FunnelStage[]> {
  const rows = await db
    .select({ stage: leads.stage, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), eq(leads.isDeleted, false)))
    .groupBy(leads.stage);

  const countByStage = new Map(rows.map((r) => [r.stage, r.count]));
  const totalInFunnel = FUNNEL_STAGE_ORDER.reduce((sum, stage) => sum + (countByStage.get(stage) ?? 0), 0);

  return FUNNEL_STAGE_ORDER.map((stage, i) => {
    const count = countByStage.get(stage) ?? 0;
    const previousCount = i > 0 ? (countByStage.get(FUNNEL_STAGE_ORDER[i - 1]) ?? 0) : null;
    return {
      key: stage,
      label: STAGE_LABELS[stage],
      count,
      shareOfPipelinePercent: totalInFunnel > 0 ? Math.round((count / totalInFunnel) * 100) : 0,
      conversionRatePercent: previousCount !== null && previousCount > 0 ? Math.round((count / previousCount) * 100) : null,
    };
  });
}

export type SourceSplitEntry = { key: string; label: string; count: number };

export async function getLeadSourceSplit(orgId: string): Promise<SourceSplitEntry[]> {
  const rows = await db
    .select({ source: leads.source, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.orgId, orgId), eq(leads.isDeleted, false)))
    .groupBy(leads.source);

  const labels: Record<string, string> = { import: "Imported", inbound: "Inbound", manual: "Manual", other: "Other" };
  return rows.map((r) => ({ key: r.source, label: labels[r.source] ?? r.source, count: r.count })).sort((a, b) => b.count - a.count);
}

export type StageAgingEntry = { key: string; label: string; avgDays: number };

/**
 * Average time actually spent in the current stage — ports the source
 * system's stage_entered_at-based calculation exactly (not "time since last
 * touched," a different question calculateDaysSinceActivity answers). Looks
 * up each lead's most recent stage_changed activity landing on its current
 * stage, falling back to createdAt for a lead created directly into it.
 */
export async function getAverageTimeInStage(orgId: string): Promise<StageAgingEntry[]> {
  const rows = await db.execute<{ stage: string; avg_days: number }>(sql`
    select l.stage, avg(
      extract(epoch from (now() - coalesce(
        (
          select la.created_at from ${leadActivity} la
          where la.lead_id = l.id and la.type = 'stage_changed' and la.payload->>'to' = l.stage::text
          order by la.created_at desc limit 1
        ),
        l.created_at
      ))) / 86400
    )::float as avg_days
    from ${leads} l
    where l.org_id = ${orgId} and l.is_deleted = false and l.stage not in ('won', 'lost')
    group by l.stage
  `);

  const avgByStage = new Map(rows.map((r) => [r.stage, r.avg_days]));

  return FUNNEL_STAGE_ORDER.map((stage) => ({
    key: stage,
    label: STAGE_LABELS[stage],
    avgDays: Math.round((avgByStage.get(stage) ?? 0) * 10) / 10,
  })).filter((entry) => avgByStage.has(entry.key));
}

export type RepActivitySummary = {
  userId: string;
  displayName: string;
  calls: number;
  emails: number;
  research: number;
  consultations: number;
};

export async function getTeamActivityByRep(orgId: string): Promise<RepActivitySummary[]> {
  const today = todayDateString();
  const from = startOfDay(today);
  const to = endOfDay(today);

  const [reps, callsRows, emailsRows, researchRows, consultRows] = await Promise.all([
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
    // Ports the source system's per-rep "consultations" exactly: a running
    // count of leads CURRENTLY booked or won (won has necessarily passed
    // through booked) — not a "booked today" count, which is what the date
    // filter this replaced was actually computing.
    db
      .select({ userId: leads.ownerId, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.orgId, orgId), eq(leads.isDeleted, false), inArray(leads.stage, ["consultation_booked", "won"])))
      .groupBy(leads.ownerId),
  ]);

  const toMap = (rows: { userId: string | null; count: number }[]) => new Map(rows.filter((r) => r.userId).map((r) => [r.userId as string, r.count]));
  const callsMap = toMap(callsRows);
  const emailsMap = toMap(emailsRows);
  const researchMap = toMap(researchRows);
  const consultMap = toMap(consultRows);

  return reps.map((rep) => ({
    userId: rep.id,
    displayName: rep.displayName,
    calls: callsMap.get(rep.id) ?? 0,
    emails: emailsMap.get(rep.id) ?? 0,
    research: researchMap.get(rep.id) ?? 0,
    consultations: consultMap.get(rep.id) ?? 0,
  }));
}

export type ParkedLostReason = { label: string; count: number };

/** Ports the source system's parked/lost breakdown exactly: buckets by the lead's own rejectionReason (set when a rep parks/rejects/marks a lead lost), not by an unrelated call outcome. */
export async function getParkedLostReasons(orgId: string): Promise<ParkedLostReason[]> {
  const rows = await db.query.leads.findMany({
    where: and(eq(leads.orgId, orgId), eq(leads.isDeleted, false), sql`${leads.stage} IN ('nurture_parked', 'lost')`),
    columns: { rejectionReason: true },
  });

  const counts = new Map<string, number>();
  for (const lead of rows) {
    const key = lead.rejectionReason?.trim() || "No reason logged";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// Session activity (online/last-seen/active-minutes/session history) moved
// to lib/db/queries/session-activity.ts — it's shared by the admin dashboard
// preview and the full Users-page view, and grouping real ping history into
// logical sessions is substantial enough to warrant its own module.

import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, callLogs, emailHistory } from "@/lib/db/schema";
import { CALL_OUTCOME_LABELS } from "@/lib/calls/outcomes";
import { todayDateString, startOfDay, endOfDay } from "@/lib/daily/today";

export type TemperatureCounts = { on_fire: number; hot: number; warm: number; cold: number };

export async function getTemperatureCounts(orgId: string, ownerId: string | null): Promise<TemperatureCounts> {
  const conditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false)];
  if (ownerId) conditions.push(eq(leads.ownerId, ownerId));

  const rows = await db
    .select({ temperature: leads.temperature, count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...conditions))
    .groupBy(leads.temperature);

  const countByTemp = new Map(rows.map((r) => [r.temperature, r.count]));
  return {
    on_fire: countByTemp.get("on_fire") ?? 0,
    hot: countByTemp.get("hot") ?? 0,
    warm: countByTemp.get("warm") ?? 0,
    cold: countByTemp.get("cold") ?? 0,
  };
}

export type QueueSummaryCounts = {
  inboundUrgent: number;
  callsDue: number;
  emailsDue: number;
  followups: number;
  research: number;
  overdue: number;
};

/** Six action-type buckets, matching the source system's Queue Summary — batches by what needs doing, not by temperature. */
export async function getQueueSummary(orgId: string, ownerId: string | null): Promise<QueueSummaryCounts> {
  const conditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false)];
  if (ownerId) conditions.push(eq(leads.ownerId, ownerId));

  const rows = await db.query.leads.findMany({
    where: and(...conditions),
    columns: { stage: true, source: true, followupDate: true },
  });

  const now = new Date();
  let inboundUrgent = 0;
  let callsDue = 0;
  let emailsDue = 0;
  let followups = 0;
  let research = 0;
  let overdue = 0;

  for (const lead of rows) {
    if (lead.source === "inbound" && lead.stage === "call_attempted") inboundUrgent++;
    if (lead.stage === "email_sent") callsDue++;
    if (lead.stage === "research") emailsDue++;
    if (lead.followupDate && lead.followupDate >= now) followups++;
    if (lead.stage === "research") research++;
    if (lead.followupDate && lead.followupDate < now) overdue++;
  }

  return { inboundUrgent, callsDue, emailsDue, followups, research, overdue };
}

export type TodayActivitySummary = { emailsSentToday: number; callsPredictedTomorrow: number };

export async function getTodayActivitySummary(orgId: string, ownerId: string | null): Promise<TodayActivitySummary> {
  const today = todayDateString();
  const from = startOfDay(today);
  const to = endOfDay(today);

  const emailConditions = [eq(emailHistory.orgId, orgId), gte(emailHistory.createdAt, from), lte(emailHistory.createdAt, to)];
  const leadConditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false), eq(leads.stage, "email_sent"), gte(leads.updatedAt, from), lte(leads.updatedAt, to)];
  if (ownerId) {
    leadConditions.push(eq(leads.ownerId, ownerId));
  }

  const [[emailsRow], predictedRows] = await Promise.all([
    ownerId
      ? db
          .select({ count: sql<number>`count(*)::int` })
          .from(emailHistory)
          .innerJoin(leads, eq(emailHistory.leadId, leads.id))
          .where(and(...emailConditions, eq(leads.ownerId, ownerId)))
      : db.select({ count: sql<number>`count(*)::int` }).from(emailHistory).where(and(...emailConditions)),
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(...leadConditions)),
  ]);

  return {
    emailsSentToday: emailsRow?.count ?? 0,
    callsPredictedTomorrow: predictedRows[0]?.count ?? 0,
  };
}

export type ActionCardLead = { id: string; name: string; company: string; detail: string };

export async function getTodaysCalls(orgId: string, ownerId: string | null, limit = 5): Promise<{ items: ActionCardLead[]; total: number }> {
  const today = todayDateString();
  const from = startOfDay(today);
  const to = endOfDay(today);

  const conditions = [eq(callLogs.orgId, orgId), gte(callLogs.createdAt, from), lte(callLogs.createdAt, to)];

  const rows = await db.query.callLogs.findMany({
    where: and(...conditions),
    orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    with: { lead: { columns: { id: true, firstName: true, lastName: true, company: true, ownerId: true } } },
  });

  const scoped = ownerId ? rows.filter((r) => r.lead?.ownerId === ownerId) : rows;

  return {
    total: scoped.length,
    items: scoped.slice(0, limit).map((row) => ({
      id: row.lead?.id ?? row.id,
      name: row.lead ? `${row.lead.firstName} ${row.lead.lastName}`.trim() : "–",
      company: row.lead?.company ?? "",
      detail: row.outcome ? CALL_OUTCOME_LABELS[row.outcome] : "Not yet logged",
    })),
  };
}

export async function getEmailsToSend(orgId: string, ownerId: string | null, limit = 5): Promise<{ items: ActionCardLead[]; total: number }> {
  const conditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false), eq(leads.stage, "research")];
  if (ownerId) conditions.push(eq(leads.ownerId, ownerId));

  const [rows, [{ count }]] = await Promise.all([
    db.query.leads.findMany({
      where: and(...conditions),
      orderBy: (fields, { desc }) => [desc(fields.lastActivityAt)],
      limit,
      columns: { id: true, firstName: true, lastName: true, company: true, fitGrade: true },
    }),
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(...conditions)),
  ]);

  return {
    total: count,
    items: rows.map((lead) => ({
      id: lead.id,
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      company: lead.company ?? "",
      detail: lead.fitGrade && lead.fitGrade !== "Unscored" ? `Grade ${lead.fitGrade}` : "",
    })),
  };
}

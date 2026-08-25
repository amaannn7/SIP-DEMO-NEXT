import "server-only";

import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailHistory, enrichmentResults, callLogs, leads } from "@/lib/db/schema";
import { startOfDay, endOfDay, todayDateString } from "@/lib/daily/today";

export type DailyProgress = {
  callsDone: number;
  emailsDone: number;
  researchDone: number;
};

/**
 * Real activity counts for "today" — no manual counter. Emails and research
 * count generation events (email_history/enrichment_results rows); calls
 * count manually-logged call_logs rows. All three are scoped to leads owned
 * by this rep, matching the source system's per-rep daily progress.
 */
export async function getDailyProgress(orgId: string, userId: string, dateString = todayDateString()): Promise<DailyProgress> {
  const from = startOfDay(dateString);
  const to = endOfDay(dateString);

  const [[emails], [research], [calls]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailHistory)
      .innerJoin(leads, eq(emailHistory.leadId, leads.id))
      .where(
        and(eq(emailHistory.orgId, orgId), eq(leads.ownerId, userId), gte(emailHistory.createdAt, from), lte(emailHistory.createdAt, to)),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(enrichmentResults)
      .innerJoin(leads, eq(enrichmentResults.leadId, leads.id))
      .where(
        and(
          eq(enrichmentResults.orgId, orgId),
          eq(leads.ownerId, userId),
          gte(enrichmentResults.createdAt, from),
          lte(enrichmentResults.createdAt, to),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(callLogs)
      .where(and(eq(callLogs.orgId, orgId), eq(callLogs.loggedBy, userId), gte(callLogs.createdAt, from), lte(callLogs.createdAt, to))),
  ]);

  return {
    callsDone: calls?.count ?? 0,
    emailsDone: emails?.count ?? 0,
    researchDone: research?.count ?? 0,
  };
}

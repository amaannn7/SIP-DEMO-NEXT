import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";

export type DashboardBriefingStats = {
  onFireCount: number;
  callbacksDue: number;
  emailsReady: number;
  overdueCount: number;
};

/**
 * Rules-based stat aggregation, not an LLM call — matches the source
 * system's dashboard briefing, which was never actually AI-generated
 * despite the name. Same four counts, same order.
 */
export async function loadDashboardBriefingStats(orgId: string, ownerId: string | null): Promise<DashboardBriefingStats> {
  const startOfToday = new Date();
  startOfToday.setHours(23, 59, 59, 999); // "due today or earlier" inclusive of all of today

  const baseConditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false)];
  if (ownerId) baseConditions.push(eq(leads.ownerId, ownerId));

  const rows = await db.query.leads.findMany({
    where: and(...baseConditions),
    columns: {
      temperature: true,
      stage: true,
      followupDate: true,
    },
  });

  const now = new Date();
  let onFireCount = 0;
  let callbacksDue = 0;
  let overdueCount = 0;
  let emailsReady = 0;

  for (const lead of rows) {
    if (lead.temperature === "on_fire") onFireCount++;
    if (lead.stage === "research") emailsReady++;
    if (lead.followupDate) {
      if (lead.followupDate < now) overdueCount++;
      else if (lead.followupDate <= startOfToday) callbacksDue++;
    }
  }

  return { onFireCount, callbacksDue, emailsReady, overdueCount };
}

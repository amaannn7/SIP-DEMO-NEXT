import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { STAGE_LABELS } from "@/lib/leads/stages";
import type { RecentLead } from "@/lib/dashboard/types";

const CLOSED_STAGES = new Set(["won", "lost"]);

export async function getRecentLeads(orgId: string, ownerId: string | null, limit = 4): Promise<RecentLead[]> {
  const conditions = [eq(leads.orgId, orgId), eq(leads.isDeleted, false)];
  if (ownerId) conditions.push(eq(leads.ownerId, ownerId));

  const rows = await db.query.leads.findMany({
    where: and(...conditions),
    orderBy: (fields, { desc }) => [desc(fields.lastActivityAt), desc(fields.createdAt)],
    limit,
  });

  return rows.map((lead) => ({
    id: lead.id,
    company: lead.company || `${lead.firstName} ${lead.lastName}`.trim() || "Unnamed lead",
    contact: `${lead.firstName} ${lead.lastName}`.trim() || "–",
    nextAction: describeNextAction(lead),
    temperature: lead.temperature ?? "cold",
  }));
}

function describeNextAction(lead: typeof leads.$inferSelect): string {
  if (CLOSED_STAGES.has(lead.stage)) return STAGE_LABELS[lead.stage];
  if (lead.followupDate) {
    const isPast = lead.followupDate < new Date();
    return isPast ? "Follow-up overdue" : "Follow-up scheduled";
  }
  return STAGE_LABELS[lead.stage];
}

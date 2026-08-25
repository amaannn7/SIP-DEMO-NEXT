import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, leadActivity, POSITIVE_CALL_OUTCOMES } from "@/lib/db/schema";
import { recomputeLeadScores } from "./recompute";
import { getFitGradeThresholds, listIcpFields } from "@/lib/db/queries/org-settings";

/**
 * Recomputes and persists a lead's scores. Call after any write that could
 * change its fit/engagement/temperature/velocity — created, custom_fields
 * edited, stage changed, or a new lead_activity row logged.
 */
export async function recomputeAndSaveLeadScores(orgId: string, leadId: string): Promise<void> {
  const [lead, icpFieldDefs, thresholds, activityRows] = await Promise.all([
    db.query.leads.findFirst({ where: eq(leads.id, leadId) }),
    listIcpFields(orgId),
    getFitGradeThresholds(orgId),
    db.query.leadActivity.findMany({ where: eq(leadActivity.leadId, leadId) }),
  ]);

  if (!lead || lead.orgId !== orgId) return;

  const scores = recomputeLeadScores(
    {
      customFields: lead.customFields,
      stage: lead.stage,
      source: lead.source,
      createdAt: lead.createdAt,
      lastActivityAt: lead.lastActivityAt,
      followupDate: lead.followupDate,
      activityTimestamps: activityRows.map((a) => a.createdAt),
      hasEnrichment: lead.hasEnrichment,
      emailsSentCount: lead.emailsSentCount,
      callsMadeCount: lead.callsMadeCount,
      hasPositiveCallOutcome: lead.lastCallOutcome !== null && POSITIVE_CALL_OUTCOMES.has(lead.lastCallOutcome),
    },
    icpFieldDefs,
    thresholds,
  );

  await db
    .update(leads)
    .set({
      fitScore: scores.fitScore,
      fitGrade: scores.fitGrade,
      fitFactors: scores.fitFactors,
      fitDisqualifiers: scores.fitDisqualifiers,
      engagementScore: scores.engagementScore,
      temperature: scores.temperature,
      velocity: scores.velocity,
      scoresUpdatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));
}

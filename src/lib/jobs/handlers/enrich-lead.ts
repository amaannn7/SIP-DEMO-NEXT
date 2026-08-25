import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, orgSettings, enrichmentResults, jobRuns } from "@/lib/db/schema";
import { callLLM } from "@/lib/ai/call-llm";
import { buildResearchPrompt, enrichmentResultSchema } from "@/lib/ai/prompts/enrichment";
import { stripJsonFences } from "@/lib/ai/prompts/shared";
import { logLeadActivity } from "@/lib/db/queries/leads";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";
import type { EnrichLeadJobData } from "@/lib/jobs/queue";

export async function handleEnrichLead(data: EnrichLeadJobData): Promise<void> {
  const { jobRunId, orgId, leadId } = data;

  await db.update(jobRuns).set({ status: "processing" }).where(eq(jobRuns.id, jobRunId));

  try {
    const [lead, settings] = await Promise.all([
      db.query.leads.findFirst({ where: eq(leads.id, leadId) }),
      db.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) }),
    ]);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const prompt = buildResearchPrompt(
      {
        firstName: lead.firstName,
        lastName: lead.lastName,
        title: lead.title,
        company: lead.company,
        industry: lead.industry,
        country: lead.country,
        website: lead.website,
        companySize: lead.companySize,
      },
      settings?.brandContext ?? {},
    );

    const result = await callLLM(orgId, prompt);
    if (!result.success) throw new Error(result.error);

    const parsed = enrichmentResultSchema.safeParse(JSON.parse(stripJsonFences(result.content)));
    if (!parsed.success) {
      throw new Error(`AI returned an unexpected shape: ${parsed.error.issues[0]?.message ?? "validation failed"}`);
    }
    const payload = parsed.data;

    const [row] = await db
      .insert(enrichmentResults)
      .values({
        orgId,
        leadId,
        jobRunId,
        researchScore: payload.research_score.score,
        researchQuality: payload.research_score.quality,
        researchFactors: payload.research_score.factors,
        sources: payload.sources,
        companyProfile: payload.company_profile,
        industryIntelligence: payload.industry_intelligence,
        prospectAnalysis: payload.prospect_analysis,
        salesStrategy: payload.sales_strategy,
      })
      .returning({ id: enrichmentResults.id });

    // Ports the source system's research-completed handling: advance
    // new_lead -> research automatically, but never downgrade a lead that
    // has already moved further along (e.g. email_sent, engaged).
    const advancesStage = lead.stage === "new_lead" || lead.stage === "research";

    await Promise.all([
      db
        .update(leads)
        .set({ hasEnrichment: true, ...(advancesStage ? { stage: "research" as const } : {}) })
        .where(eq(leads.id, leadId)),
      db.update(jobRuns).set({ status: "completed", resultId: row.id, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId)),
      logLeadActivity({
        orgId,
        leadId,
        actorId: null,
        type: "enrichment_completed",
        payload: { jobRunId, researchScore: payload.research_score.score },
      }),
    ]);

    if (advancesStage && lead.stage !== "research") {
      await logLeadActivity({
        orgId,
        leadId,
        actorId: null,
        type: "stage_changed",
        payload: { from: lead.stage, to: "research", reason: "research_completed" },
      });
    }

    await recomputeAndSaveLeadScores(orgId, leadId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.update(jobRuns).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
    throw err;
  }
}

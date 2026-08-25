import "server-only";

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, orgSettings, enrichmentResults, callPitches, jobRuns, users } from "@/lib/db/schema";
import { callLLM } from "@/lib/ai/call-llm";
import { buildCallPitchPrompt, CALL_PITCH_TITLES } from "@/lib/ai/prompts/call-pitch";
import { enrichmentResultSchema } from "@/lib/ai/prompts/enrichment";
import { resolveEffectiveBrandContext } from "@/lib/ai/prompts/effective-brand";
import { renderSenderIdentity } from "@/lib/ai/prompts/shared";
import { logLeadActivity } from "@/lib/db/queries/leads";
import { getEffectiveSenderProfile } from "@/lib/db/queries/sender-profile";
import type { GenerateCallPitchJobData } from "@/lib/jobs/queue";

export async function handleGenerateCallPitch(data: GenerateCallPitchJobData): Promise<void> {
  const { jobRunId, orgId, leadId, pitchType, customInstructions } = data;

  await db.update(jobRuns).set({ status: "processing" }).where(eq(jobRuns.id, jobRunId));

  try {
    const [lead, settings, latestEnrichment] = await Promise.all([
      db.query.leads.findFirst({ where: eq(leads.id, leadId) }),
      db.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) }),
      db.query.enrichmentResults.findFirst({
        where: eq(enrichmentResults.leadId, leadId),
        orderBy: desc(enrichmentResults.createdAt),
      }),
    ]);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const owner = lead.ownerId ? await db.query.users.findFirst({ where: eq(users.id, lead.ownerId), columns: { displayName: true } }) : null;
    const senderProfile = lead.ownerId ? await getEffectiveSenderProfile(orgId, lead.ownerId) : null;

    const enrichmentParsed = latestEnrichment
      ? enrichmentResultSchema.safeParse({
          research_score: { score: latestEnrichment.researchScore ?? 0, quality: latestEnrichment.researchQuality ?? "", factors: latestEnrichment.researchFactors },
          sources: latestEnrichment.sources,
          company_profile: latestEnrichment.companyProfile,
          industry_intelligence: latestEnrichment.industryIntelligence,
          prospect_analysis: latestEnrichment.prospectAnalysis,
          sales_strategy: latestEnrichment.salesStrategy,
        })
      : null;

    const prompt = buildCallPitchPrompt({
      pitchType,
      lead: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        title: lead.title,
        company: lead.company,
        industry: lead.industry,
        country: lead.country,
        website: lead.website,
        companySize: lead.companySize,
      },
      brand: resolveEffectiveBrandContext(settings?.brandContext ?? {}, senderProfile),
      senderIdentity: renderSenderIdentity(
        senderProfile ?? { senderName: "", senderTitle: "", senderCompany: "" },
        owner?.displayName ?? "",
        "Business Development Manager",
      ),
      enrichment: enrichmentParsed?.success ? enrichmentParsed.data : null,
      customInstructions,
    });

    const result = await callLLM(orgId, prompt);
    if (!result.success) throw new Error(result.error);

    const [row] = await db
      .insert(callPitches)
      .values({
        orgId,
        leadId,
        jobRunId,
        pitchType,
        title: CALL_PITCH_TITLES[pitchType],
        script: result.content.trim(),
      })
      .returning({ id: callPitches.id });

    await Promise.all([
      db.update(jobRuns).set({ status: "completed", resultId: row.id, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId)),
      logLeadActivity({
        orgId,
        leadId,
        actorId: null,
        type: "call_pitch_generated",
        payload: { jobRunId, pitchType },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.update(jobRuns).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
    throw err;
  }
}

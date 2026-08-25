import "server-only";

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, enrichmentResults } from "@/lib/db/schema";
import { callLLM } from "@/lib/ai/call-llm";
import { buildNextBestActionPrompt, nbaResponseSchema } from "@/lib/ai/prompts/next-best-action";
import { enrichmentResultSchema } from "@/lib/ai/prompts/enrichment";
import { stripJsonFences } from "@/lib/ai/prompts/shared";
import { calculateDaysSinceActivity } from "@/lib/scoring/days-since-activity";
import { generateRuleBasedNba, type NextBestAction } from "./rule-based";

/**
 * Ports the source system's generateNextBestAction: AI-backed recommendation
 * with a rule-based fallback on any failure (no provider configured, LLM
 * error, or an unparseable response) — matching the legacy's "always return
 * something usable" behavior rather than surfacing an error to the rep.
 */
export async function generateNextBestAction(orgId: string, leadId: string, useAi: boolean): Promise<NextBestAction> {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead not found");

  const daysSinceActivity = calculateDaysSinceActivity(
    { lastActivityAt: lead.lastActivityAt, followupDate: lead.followupDate, createdAt: lead.createdAt },
    new Date(),
  );

  const ruleBasedInput = {
    stage: lead.stage,
    temperature: lead.temperature,
    velocity: lead.velocity,
    callsMadeCount: lead.callsMadeCount,
    lastCallOutcome: lead.lastCallOutcome,
    daysSinceActivity,
    callAnchor: lead.callAnchor,
  };

  if (!useAi) {
    return generateRuleBasedNba(ruleBasedInput);
  }

  const latestEnrichment = await db.query.enrichmentResults.findFirst({
    where: eq(enrichmentResults.leadId, leadId),
    orderBy: desc(enrichmentResults.createdAt),
  });
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

  const prompt = buildNextBestActionPrompt({
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
    stage: lead.stage,
    temperature: lead.temperature ?? "cold",
    velocity: lead.velocity ?? "stalled",
    fitGrade: lead.fitGrade,
    engagementScore: lead.engagementScore,
    daysSinceActivity,
    callsMadeCount: lead.callsMadeCount,
    emailsSentCount: lead.emailsSentCount,
    lastCallOutcome: lead.lastCallOutcome,
    followupDate: lead.followupDate,
    enrichment: enrichmentParsed?.success ? enrichmentParsed.data : null,
  });

  try {
    const result = await callLLM(orgId, prompt);
    if (!result.success) return generateRuleBasedNba(ruleBasedInput);

    const parsed = nbaResponseSchema.safeParse(JSON.parse(stripJsonFences(result.content)));
    if (!parsed.success) return generateRuleBasedNba(ruleBasedInput);

    return {
      action: parsed.data.action,
      urgency: parsed.data.urgency,
      reason: parsed.data.reason,
      talkingPoint: parsed.data.talking_point,
      riskIfDelayed: parsed.data.risk_if_delayed,
      source: "ai",
    };
  } catch {
    return generateRuleBasedNba(ruleBasedInput);
  }
}

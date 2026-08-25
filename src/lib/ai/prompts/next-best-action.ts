import { z } from "zod";
import { renderLeadBlock, type LeadPromptFields } from "./shared";
import type { EnrichmentResultPayload } from "./enrichment";

export const nbaResponseSchema = z.object({
  action: z.enum(["call", "email", "followup", "research", "wait", "drop"]),
  urgency: z.enum(["critical", "high", "medium", "low"]),
  reason: z.string(),
  talking_point: z.string().default(""),
  risk_if_delayed: z.string().default(""),
});

function summarizeResearch(enrichment: EnrichmentResultPayload | null): string {
  if (!enrichment) return "No research on file yet.";
  const pains = enrichment.prospect_analysis.pain_points.slice(0, 3).map((p) => p.pain);
  const hooks = enrichment.sales_strategy.opening_hooks.slice(0, 2).map((h) => h.hook);
  const parts: string[] = [];
  if (pains.length) parts.push(`Pain points: ${pains.join(", ")}.`);
  if (hooks.length) parts.push(`Hooks: ${hooks.join(", ")}.`);
  return parts.join(" ") || "No research on file yet.";
}

export function buildNextBestActionPrompt(params: {
  lead: LeadPromptFields;
  stage: string;
  temperature: string;
  velocity: string;
  fitGrade: string | null;
  engagementScore: number | null;
  daysSinceActivity: number;
  callsMadeCount: number;
  emailsSentCount: number;
  lastCallOutcome: string | null;
  followupDate: Date | null;
  enrichment: EnrichmentResultPayload | null;
}): string {
  const {
    lead,
    stage,
    temperature,
    velocity,
    fitGrade,
    engagementScore,
    daysSinceActivity,
    callsMadeCount,
    emailsSentCount,
    lastCallOutcome,
    followupDate,
    enrichment,
  } = params;

  return `You are a sales intelligence AI. Based on the lead data below, recommend the SINGLE best next action.

LEAD DATA:
${renderLeadBlock(lead)}
Status: ${stage}
Temperature: ${temperature} (cold/warm/hot/on_fire)
Velocity: ${velocity} (stalled/slowing/stable/accelerating)
ICP Grade: ${fitGrade ?? "unknown"}
Engagement Score: ${engagementScore ?? 0}/100
Days since last activity: ${daysSinceActivity}
Calls made: ${callsMadeCount}
Emails sent: ${emailsSentCount}
Last call outcome: ${lastCallOutcome ?? "none"}
Scheduled followup: ${followupDate ? followupDate.toISOString().slice(0, 10) : "none"}
Research: ${summarizeResearch(enrichment)}

Return a JSON object with exactly these fields:
{
  "action": "call|email|followup|research|wait|drop",
  "urgency": "critical|high|medium|low",
  "reason": "One sentence explaining why this action now",
  "talking_point": "A specific thing to mention based on their situation",
  "risk_if_delayed": "What happens if you don't act today"
}

Only return valid JSON, no other text.`;
}

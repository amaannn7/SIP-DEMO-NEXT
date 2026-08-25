import { z } from "zod";
import type { AiBrandContext } from "@/lib/db/schema";
import { renderBrandContext, renderLeadBlock, type LeadPromptFields } from "./shared";

export const enrichmentResultSchema = z.object({
  research_score: z.object({
    score: z.number(),
    quality: z.string(),
    factors: z.array(z.string()),
  }),
  sources: z.array(z.object({ title: z.string(), url: z.string(), description: z.string() })),
  company_profile: z.object({
    description: z.string(),
    key_products_services: z.array(z.string()),
    market_position: z.string(),
    growth_stage: z.string(),
  }),
  industry_intelligence: z.object({
    top_challenges: z.array(z.object({ challenge: z.string(), impact: z.string() })),
    trends: z.array(z.string()),
    competitive_pressures: z.string(),
  }),
  prospect_analysis: z.object({
    pain_points: z.array(z.object({ pain: z.string(), evidence: z.string() })),
    responsibilities: z.array(z.string()),
    success_metrics: z.array(z.string()),
    buying_power: z.string(),
  }),
  sales_strategy: z.object({
    opening_hooks: z.array(z.object({ hook: z.string(), why: z.string() })),
    value_angles: z.array(z.object({ angle: z.string(), connects_to: z.string() })),
    discovery_questions: z.array(z.string()),
    objections: z.array(z.object({ objection: z.string(), response: z.string() })),
    avoid: z.array(z.string()),
  }),
});

export type EnrichmentResultPayload = z.infer<typeof enrichmentResultSchema>;

const SCHEMA_EXAMPLE = `{
  "research_score": { "score": 0-100, "quality": "string", "factors": ["string"] },
  "sources": [{ "title": "string", "url": "string", "description": "string" }],
  "company_profile": {
    "description": "string", "key_products_services": ["string"],
    "market_position": "string", "growth_stage": "string"
  },
  "industry_intelligence": {
    "top_challenges": [{ "challenge": "string", "impact": "string" }],
    "trends": ["string"], "competitive_pressures": "string"
  },
  "prospect_analysis": {
    "pain_points": [{ "pain": "string", "evidence": "string" }],
    "responsibilities": ["string"], "success_metrics": ["string"], "buying_power": "string"
  },
  "sales_strategy": {
    "opening_hooks": [{ "hook": "string", "why": "string" }],
    "value_angles": [{ "angle": "string", "connects_to": "string" }],
    "discovery_questions": ["string"],
    "objections": [{ "objection": "string", "response": "string" }],
    "avoid": ["string"]
  }
}`;

export function buildResearchPrompt(lead: LeadPromptFields, brand: AiBrandContext): string {
  return `You are a B2B sales intelligence analyst preparing a prospect research brief for a rep.

${renderBrandContext(brand)}

PROSPECT
${renderLeadBlock(lead)}

Research this prospect and their company using what you know, and produce a structured brief a sales rep can use to write a personalized outreach email and prepare for a call. Infer sensible, realistic detail from the company/industry/title context given — do not invent specific facts you could not plausibly know (like exact revenue figures), but do provide informed, industry-typical analysis.

Respond with ONLY valid JSON, no markdown code fences, no commentary before or after. Match this exact shape:

${SCHEMA_EXAMPLE}

SOURCES: Generate realistic, plausible source URLs based on the company name and industry (e.g. company website, LinkedIn, an industry report). Include 2-4 sources that would logically provide the research data above.

SCORING GUIDELINES for research_score.score (0-100) — this is a descriptive read of fit, separate from and not authoritative over the org's own ICP scoring:
- 80-100: Strong fit. Title/role signals real buying authority, company profile closely matches the target customer described above, clear and immediate use case.
- 60-79: Good fit. Plausible buying influence or a company profile that mostly matches, but some uncertainty on authority, timing, or exact fit.
- 40-59: Workable fit. Some signal of relevance, but authority, company profile, or use case is unclear or only partially matches.
- Below 40: Weak or unclear fit — role has little apparent influence over a purchase decision like this, or the company profile doesn't match the target customer described above.
Set research_score.quality to a short label consistent with that tier (e.g. "Strong", "Good", "Workable", "Weak"), and research_score.factors to 2-3 short phrases naming the specific signals that drove the score.`;
}

import type { AiBrandContext } from "@/lib/db/schema";
import type { EnrichmentResultPayload } from "./enrichment";
import { renderBrandContext, renderLeadBlock, type LeadPromptFields } from "./shared";

export type CallPitchType = "cold_with_email" | "cold_no_email" | "callback" | "discovery" | "demo";

/** Matches the source system: pitchType only changes the returned title, not the prompt structure — except the emailSent framing line. */
export const CALL_PITCH_TITLES: Record<CallPitchType, string> = {
  cold_with_email: "Cold Call Script (Email Sent)",
  cold_no_email: "Cold Call Script (No Prior Email)",
  callback: "Call Back Script",
  discovery: "Discovery Call Script",
  demo: "Demo Introduction Script",
};

/**
 * Ports the source system's generateCallPitch() context block exactly, which
 * pulls VALIDATED PAIN POINTS (up to 3), PERSONA KPIs (all success metrics),
 * and LIKELY OBJECTIONS (up to 3) from the enrichment data — restructured
 * there under account_intelligence/persona_intelligence/pain_hypothesis, but
 * traced back to the same research fields this app already stores directly
 * (prospect_analysis.pain_points, prospect_analysis.success_metrics,
 * sales_strategy.objections). The old version here only ever surfaced the
 * first pain point and first objection, thinner than what a rep calling from
 * the source system's script would have had to work with.
 */
function enrichmentSummary(enrichment: EnrichmentResultPayload | null): string {
  if (!enrichment) return "No research brief available yet — build the pitch from the prospect details alone.";
  const { company_profile, prospect_analysis, sales_strategy } = enrichment;
  const hook = sales_strategy.opening_hooks[0];
  const lines = [`Company summary: ${company_profile.description}`];
  if (hook) lines.push(`Suggested opening hook: ${hook.hook}`);

  const painPoints = prospect_analysis.pain_points.slice(0, 3);
  if (painPoints.length > 0) {
    lines.push(`Validated pain points:\n${painPoints.map((p) => `- ${p.pain}`).join("\n")}`);
  }
  if (prospect_analysis.success_metrics.length > 0) {
    lines.push(`Persona KPIs: ${prospect_analysis.success_metrics.join(", ")}`);
  }
  const objections = sales_strategy.objections.slice(0, 3);
  if (objections.length > 0) {
    lines.push(`Likely objections:\n${objections.map((o) => `- ${o.objection} -> response: ${o.response}`).join("\n")}`);
  }
  return lines.join("\n");
}

export function buildCallPitchPrompt(params: {
  pitchType: CallPitchType;
  lead: LeadPromptFields;
  brand: AiBrandContext;
  senderIdentity: string;
  enrichment: EnrichmentResultPayload | null;
  customInstructions?: string;
}): string {
  const { pitchType, lead, brand, senderIdentity, enrichment, customInstructions } = params;
  const emailSent = pitchType === "cold_with_email";

  const openingReasonLine = emailSent
    ? "Reference the email you sent them recently as the reason for the call (\"following up on the note I sent\")."
    : "This is a cold call with no prior email — open by stating who you are and why you're calling, no email reference.";

  const parts = [
    `You are a sales rep preparing a phone call script.`,
    senderIdentity,
    renderBrandContext(brand),
    `PROSPECT\n${renderLeadBlock(lead)}`,
    `RESEARCH BRIEF\n${enrichmentSummary(enrichment)}`,
    `Write a call script with these sections, in this order, using clear section headers. This is a live-call navigation script, not a monologue — a branch point after each section is what makes it usable on an actual call, not optional structure:

1. OPENING — how to greet and identify yourself. ${openingReasonLine} End with a check like "Do you have a couple of minutes, or is now a bad time?"
   Then a branch:
   - IF NOT A GOOD TIME: one line acknowledging it and asking when would be a better time to call back (this is its own response, not a jump to GRACEFUL EXIT).
   - IF YES, THEY HAVE A MINUTE: continue to WHO WE ARE.
   - IF THEY SAY NOT INTERESTED AT ALL: jump straight to GRACEFUL EXIT.

2. REASON FOR CALL — one sentence, direct.

3. WHO WE ARE — 1-2 sentences on the company, from the brand context above.

4. PAIN POINTS — 2-3 questions or statements surfacing the likely pain points from the research brief, ending with a check like "Does any of that sound familiar?"
   Then a branch:
   - IF NOTHING RESONATES: 2-3 fallback probing questions to try once more, then a branch — IF SOMETHING RESONATES continue to THE ASK, IF STILL NOTHING jump to GRACEFUL EXIT.
   - IF SOMETHING RESONATES immediately: continue straight to THE ASK.

5. THE ASK — the specific next step to propose (meeting, demo, follow-up call — pick what fits a "${pitchType}" call).
   Then a branch:
   - IF THEY SAY YES: a short booking exchange (propose a day/time, confirm, warm close).
   - IF THEY SAY NO: jump to GRACEFUL EXIT.

6. GRACEFUL EXIT — write this section's actual content EXACTLY ONCE, at the very end of the script, even though multiple branches above jump to it. Every branch that "jumps to GRACEFUL EXIT" must only say so in one short line (e.g. "-> Jump to GRACEFUL EXIT") — never repeat the exit script itself inline. The one real GRACEFUL EXIT block covers: no interest, asked to be called back later, and wanting to end the call now — each as its own short line the rep can read straight from.

Do not invent any additional sections, branches, or exit points beyond the ones described above. Keep the whole script under 500 words. Write it as something a rep reads from and navigates live, not prose about the call.`,
  ];

  if (customInstructions?.trim()) {
    parts.push(`MANDATORY INSTRUCTIONS FROM THE REP (these override any conflicting guidance above):\n${customInstructions.trim()}`);
  }

  return parts.join("\n\n");
}

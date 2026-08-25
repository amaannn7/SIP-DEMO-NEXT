import type { AiBrandContext } from "@/lib/db/schema";
import type { EnrichmentResultPayload } from "./enrichment";
import { renderBrandContext, renderLeadBlock, stripMarkdownEmphasis, type LeadPromptFields } from "./shared";

export type EmailSequenceStep = "initial" | "followup1" | "followup2" | "breakup";

export type PreviousEmail = { subject: string; body: string };

const LANGUAGE_RULES = `Language rules:
- No exclamation marks.
- No hype words ("amazing", "revolutionary", "game-changing").
- Short sentences, under 20 words each. Plain language over jargon.
- Sentence case only — no ALL CAPS except real acronyms.
- Sound like a person who researched this prospect, not a template.
- Never offer to attach or send a catalogue/brochure/deck — the goal is a conversation, not a document.
- Never make a sales claim in the subject line — earn the open with curiosity or specificity, not a pitch.`;

/** Field labels the model must return, per step — parsed back out with parseLabeledFields. */
const STEP_FIELDS: Record<EmailSequenceStep, string[]> = {
  initial: ["SUBJECT", "OPENER", "PROBLEM_BRIDGE", "CTA"],
  followup1: ["SUBJECT", "RECONNECT_VALUE", "CTA"],
  followup2: ["SUBJECT", "ACKNOWLEDGE_PROOF", "CTA_EASYOUT"],
  breakup: ["SUBJECT", "BODY"],
};

export type EmailOutcomeCounts = { replied: number; noResponse: number; bounced: number; meetingBooked: number };

/**
 * Ports the source system's email-performance feedback exactly: prior
 * outcomes on THIS lead shape tone guidance for the next email (e.g. several
 * no-response emails nudge the model toward a different angle).
 */
function emailHistoryGuidance(counts: EmailOutcomeCounts | null): string | null {
  if (!counts) return null;
  const lines: string[] = [];
  if (counts.noResponse > 0) {
    lines.push(`${counts.noResponse} email(s) got no response. Try a different angle or shorter message.`);
  }
  if (counts.replied > 0) {
    lines.push(`Previous email(s) got replies — maintain similar conversational tone.`);
  }
  if (counts.meetingBooked > 0) {
    lines.push(`A meeting was booked before. Reference the relationship.`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function enrichmentSummary(enrichment: EnrichmentResultPayload | null): string {
  if (!enrichment) return "No research brief available yet — write from the prospect details alone.";
  const painPoint = enrichment.prospect_analysis.pain_points[0];
  const hook = enrichment.sales_strategy.opening_hooks[0];
  const valueAngle = enrichment.sales_strategy.value_angles[0];
  const challenge = enrichment.industry_intelligence.top_challenges[0];
  const lines = [`Company summary: ${enrichment.company_profile.description}`];
  if (challenge) lines.push(`Industry challenge: ${challenge.challenge} (${challenge.impact})`);
  if (painPoint) lines.push(`Likely pain point: ${painPoint.pain} (${painPoint.evidence})`);
  if (hook) lines.push(`Suggested opening hook: ${hook.hook} — ${hook.why}`);
  if (valueAngle) lines.push(`Suggested value angle: ${valueAngle.angle} -> connects to ${valueAngle.connects_to}`);
  return lines.join("\n");
}

function stepInstructions(step: EmailSequenceStep, previous: PreviousEmail | null): string {
  switch (step) {
    case "initial":
      return `This is the FIRST email in the sequence. Write:
SUBJECT: 4-6 words, specific, no clickbait
OPENER: 1-2 sentences showing you understand their situation
PROBLEM_BRIDGE: 2-3 sentences connecting their likely pain point to the value proposition, grounded in the research above
CTA: one low-friction next step, phrased as a question`;
    case "followup1":
      return `This is FOLLOW-UP 1, sent a few days after the initial email got no reply. Reference the previous email naturally rather than restating it.

PREVIOUS EMAIL SENT:
${previous ? `${previous.subject}\n\n${previous.body}` : "(not available)"}

Write:
SUBJECT: 4-6 words, distinct from the previous subject
RECONNECT_VALUE: 2-3 sentences adding one new piece of value or angle, not a repeat of email 1
CTA: one low-friction next step`;
    case "followup2":
      return `This is FOLLOW-UP 2, the final value-add before a breakup email. Reference the sequence so far briefly.

PREVIOUS EMAIL SENT:
${previous ? `${previous.subject}\n\n${previous.body}` : "(not available)"}

Write:
SUBJECT: 4-6 words
ACKNOWLEDGE_PROOF: 2-3 sentences, acknowledge they're busy, offer one concrete proof point or resource
CTA_EASYOUT: a next step that's easy to say yes OR no to`;
    case "breakup":
      return `This is the BREAKUP email — the last in the sequence. Give the prospect explicit permission to say no. No previous email is referenced.

Write:
SUBJECT: short, direct, signals this is the last touch
BODY: 3-5 sentences total. Acknowledge the silence without guilt-tripping, restate the value proposition in one line, invite them to reach out if timing changes, and close warmly.`;
  }
}

export function buildEmailPrompt(params: {
  step: EmailSequenceStep;
  lead: LeadPromptFields;
  brand: AiBrandContext;
  senderIdentity: string;
  enrichment: EnrichmentResultPayload | null;
  previousEmail: PreviousEmail | null;
  emailOutcomeCounts?: EmailOutcomeCounts | null;
  customInstructions?: string;
}): string {
  const { step, lead, brand, senderIdentity, enrichment, previousEmail, emailOutcomeCounts, customInstructions } = params;

  const parts = [
    `You are a sales rep writing a personalized outreach email.`,
    senderIdentity,
    renderBrandContext(brand),
    `PROSPECT\n${renderLeadBlock(lead)}`,
    `RESEARCH BRIEF\n${enrichmentSummary(enrichment)}`,
    stepInstructions(step, previousEmail),
    LANGUAGE_RULES,
  ];

  const historyGuidance = emailHistoryGuidance(emailOutcomeCounts ?? null);
  if (historyGuidance) {
    parts.push(`EMAIL HISTORY ON THIS LEAD\n${historyGuidance}`);
  }

  if (customInstructions?.trim()) {
    parts.push(`MANDATORY INSTRUCTIONS FROM THE REP (these override any conflicting guidance above):\n${customInstructions.trim()}`);
  }

  parts.push(
    `Respond with ONLY the labeled fields below, one per line, no extra commentary, no markdown:\n${STEP_FIELDS[step]
      .map((f) => `${f}: ...`)
      .join("\n")}`,
  );

  return parts.join("\n\n");
}

/** Parses the LLM's `LABEL: value` response format back into a field map. Values may span multiple lines up to the next label. */
export function parseLabeledFields(raw: string, fields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = new RegExp(`(${fields.join("|")}):\\s*([\\s\\S]*?)(?=\\n(?:${fields.join("|")}):|$)`, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    result[match[1]] = stripMarkdownEmphasis(match[2].trim());
  }
  return result;
}

/**
 * Joins each part with a blank line between them ("\n\n") so the rendered
 * email (whitespace-pre-wrap) shows real paragraph breaks — greeting, opener,
 * problem bridge, and CTA each get their own visual paragraph instead of
 * running together as one dense block. A single "\n" only wraps to the next
 * line with no gap; a blank line is what actually reads as a new paragraph.
 */
export function assembleEmailBody(step: EmailSequenceStep, fields: Record<string, string>, firstName: string): string {
  const greeting = `Hi ${firstName || "there"},`;
  const parts = ((): string[] => {
    switch (step) {
      case "initial":
        return [greeting, fields.OPENER, fields.PROBLEM_BRIDGE, fields.CTA];
      case "followup1":
        return [greeting, fields.RECONNECT_VALUE, fields.CTA];
      case "followup2":
        return [greeting, fields.ACKNOWLEDGE_PROOF, fields.CTA_EASYOUT];
      case "breakup":
        return [greeting, fields.BODY];
    }
  })();
  return parts.filter(Boolean).join("\n\n");
}

export function getEmailStepFields(step: EmailSequenceStep): string[] {
  return STEP_FIELDS[step];
}

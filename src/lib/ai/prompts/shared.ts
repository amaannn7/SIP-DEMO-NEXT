import type { AiBrandContext } from "@/lib/db/schema";

/** Renders the org's brand context into prompt text, with generic fallbacks so a fresh org with no configuration still gets usable output. */
export function renderBrandContext(brand: AiBrandContext): string {
  const description = brand.companyDescription?.trim() || "a B2B company selling to other businesses";
  const valueProp = brand.valueProposition?.trim() || "helping customers solve an important operational problem";
  const socialProof = brand.socialProof?.trim();
  const tone = brand.toneGuidelines?.trim() || "Direct, professional, no hype or exclamation marks.";

  const lines = [`Company: ${description}`, `Value proposition: ${valueProp}`];
  if (socialProof) lines.push(`Social proof: ${socialProof}`);
  lines.push(`Tone guidelines: ${tone}`);
  return lines.join("\n");
}

/**
 * Ports the source system's SENDER line exactly: who the AI-generated
 * content is written as. A blank sender_name always falls back to the rep's
 * real account name (never a generic placeholder — "Your Name" only reads
 * right in the source system's UI copy, never inside generated content), and
 * a blank title falls back to a generic-but-real title so the pitch never
 * reads "I'm the ." with a dangling gap.
 */
export function renderSenderIdentity(
  senderProfile: { senderName: string; senderTitle: string; senderCompany: string },
  accountDisplayName: string,
  defaultTitle = "",
): string {
  const name = senderProfile.senderName.trim() || accountDisplayName || "Your Name";
  const title = senderProfile.senderTitle.trim() || defaultTitle;
  const company = senderProfile.senderCompany.trim();
  return `SENDER: ${[name, title].filter(Boolean).join(", ")}${company ? ` at ${company}` : ""}`;
}

export type LeadPromptFields = {
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  industry: string | null;
  country: string | null;
  website: string | null;
  companySize: string | null;
};

export function renderLeadBlock(lead: LeadPromptFields): string {
  const fields: [string, string | null][] = [
    ["Name", `${lead.firstName} ${lead.lastName}`.trim() || null],
    ["Title", lead.title],
    ["Company", lead.company],
    ["Industry", lead.industry],
    ["Country", lead.country],
    ["Website", lead.website],
    ["Company size", lead.companySize],
  ];
  return fields
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** Strips ```json fences an LLM sometimes wraps output in, matching the source system's fallback. */
export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

/**
 * Strips markdown emphasis (**bold**, *italic*) an LLM sometimes adds to plain
 * text output — prompts ask for "clear section headers" or plain prose
 * without dictating a format, and models are free to reach for markdown.
 * Every surface that renders this output does so as plain text, not
 * markdown, so left-in asterisks show up literally to the rep.
 */
export function stripMarkdownEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, "$1");
}

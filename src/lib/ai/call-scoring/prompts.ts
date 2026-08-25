import { z } from "zod";

/** Ports the source system's classifyCallContent: a cheap first pass on the opening of the transcript, filtering calls that shouldn't reach the expensive main scoring call at all. */
export function buildContentClassificationPrompt(transcriptExcerpt: string): string {
  return `Classify the start of this call transcript into exactly one category: sales_call, voicemail, wrong_number, internal_call, administrative_call.

TRANSCRIPT (opening):
${transcriptExcerpt}

Respond with ONLY the category name, nothing else.`;
}

export type ContentClassification = "sales_call" | "voicemail" | "wrong_number" | "internal_call" | "administrative_call";

const executionCategorySchema = z.object({ score: z.number().min(0).max(5), reason: z.string(), evidence: z.string() });

export const callScoringResponseSchema = z.object({
  execution: z.object({
    opening_positioning: executionCategorySchema,
    discovery_quality: executionCategorySchema,
    active_listening: executionCategorySchema,
    relevance_personalisation: executionCategorySchema,
    objection_handling: executionCategorySchema.nullable(),
    closing_next_step: executionCategorySchema,
  }),
  objectives: z.array(z.object({ objective: z.string(), completed: z.boolean() })),
  prohibited_claims: z.array(z.string()),
  correct_disqualification: z.boolean(),
  strengths: z.array(z.string()).max(3),
  coaching_opportunities: z.array(z.string()).max(3),
  confidence: z.number().min(0).max(1),
});

export type CallScoringResponse = z.infer<typeof callScoringResponseSchema>;

/**
 * Ports the source system's scoreExecutionAndObjectives prompt structure:
 * 6 execution categories 0-5 each with a reason and an evidence quote,
 * per-objective completion against the pitch's talking points, prohibited-
 * claims detection, correct-disqualification detection, and strengths/
 * coaching bullets.
 */
export function buildCallScoringPrompt(params: {
  transcript: string;
  pitchObjectives: string[];
  loggedOutcome: string | null;
}): string {
  const { transcript, pitchObjectives, loggedOutcome } = params;
  return `You are a sales call quality reviewer. Score this call transcript against the rubric below.

TRANSCRIPT:
${transcript}

CALL OBJECTIVES (from the rep's call pitch/script for this call):
${pitchObjectives.length > 0 ? pitchObjectives.map((o) => `- ${o}`).join("\n") : "No specific objectives on file — judge against general best practice."}

LOGGED OUTCOME (what the rep recorded after the call, may not be set yet): ${loggedOutcome ?? "(not logged yet)"}

Score these execution categories 0-5, each with a one-sentence reason and a short direct quote from the transcript as evidence:
1. opening_positioning
2. discovery_quality
3. active_listening
4. relevance_personalisation
5. objection_handling (use null if no objection came up in the call)
6. closing_next_step

Then for each objective listed above, mark true/false whether the transcript shows it was addressed.

Also flag: any prohibited/false claims made by the rep, whether the call was correctly disqualified if the prospect was clearly not a fit, up to 3 strengths, and up to 3 coaching opportunities.

Respond with ONLY valid JSON, no markdown, matching this exact shape:
{
  "execution": {
    "opening_positioning": {"score": 0-5, "reason": "...", "evidence": "..."},
    "discovery_quality": {"score": 0-5, "reason": "...", "evidence": "..."},
    "active_listening": {"score": 0-5, "reason": "...", "evidence": "..."},
    "relevance_personalisation": {"score": 0-5, "reason": "...", "evidence": "..."},
    "objection_handling": {"score": 0-5, "reason": "...", "evidence": "..."} or null,
    "closing_next_step": {"score": 0-5, "reason": "...", "evidence": "..."}
  },
  "objectives": [{"objective": "...", "completed": true}],
  "prohibited_claims": ["..."],
  "correct_disqualification": false,
  "strengths": ["..."],
  "coaching_opportunities": ["..."],
  "confidence": 0.0-1.0
}`;
}

/** Ports the source system's verifyOutcomeAgainstTranscript — a short, cheap check. */
export function buildOutcomeVerificationPrompt(transcript: string, loggedOutcome: string): string {
  return `Does this call transcript support the rep's logged outcome of "${loggedOutcome}"?

TRANSCRIPT:
${transcript}

Respond with ONLY "yes" or "no".`;
}

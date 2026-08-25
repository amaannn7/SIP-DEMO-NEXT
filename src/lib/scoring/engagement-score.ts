import { calculateDaysSinceActivity } from "./days-since-activity";

export type EngagementInput = {
  hasEnrichment: boolean;
  emailsSentCount: number;
  callsMadeCount: number;
  hasPositiveCallOutcome: boolean;
  stage: string;
  lastActivityAt: Date | null;
  followupDate: Date | null;
  createdAt: Date;
};

export type EngagementResult = {
  score: number;
  breakdown: Record<string, number>;
};

const QUALIFIED_STAGES = new Set(["consultation_booked", "won"]);

/**
 * Ports the source system's calculateEngagementScore. Call/email counts and
 * outcomes are plain inputs here rather than being read off a stored lead
 * record directly — those data sources (AI email generation, call logging)
 * are later phases, so every call site today passes zero/false and the
 * formula naturally contributes nothing until that data actually exists.
 */
export function calculateEngagementScore(input: EngagementInput, now: Date = new Date()): EngagementResult {
  let score = 0;
  const breakdown: Record<string, number> = {};

  if (input.hasEnrichment) {
    score += 10;
    breakdown.research = 10;
  }

  if (input.emailsSentCount > 0) {
    const emailPoints = Math.min(20, input.emailsSentCount * 10);
    score += emailPoints;
    breakdown.emails = emailPoints;
  }

  if (input.callsMadeCount > 0) {
    const callPoints = Math.min(25, input.callsMadeCount * 15);
    score += callPoints;
    breakdown.calls = callPoints;
  }

  if (input.hasPositiveCallOutcome) {
    score += 25;
    breakdown.positive_outcome = 25;
  }

  if (QUALIFIED_STAGES.has(input.stage)) {
    score += 30;
    breakdown.qualified = 30;
  }

  const daysSinceActivity = calculateDaysSinceActivity(
    { lastActivityAt: input.lastActivityAt, followupDate: input.followupDate, createdAt: input.createdAt },
    now,
  );
  if (daysSinceActivity > 7) {
    const weeksInactive = Math.floor(daysSinceActivity / 7);
    const decay = Math.min(30, weeksInactive * 5);
    score -= decay;
    breakdown.decay = -decay;
  }

  return { score: Math.max(0, Math.min(100, score)), breakdown };
}

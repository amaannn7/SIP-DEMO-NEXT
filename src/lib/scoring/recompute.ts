import { calculateFitScore, type IcpFieldDef, type FitGradeThresholds } from "./fit-score";
import { calculateEngagementScore, type EngagementInput } from "./engagement-score";
import { calculateTemperature, type EmailOutcome } from "./temperature";
import { calculateVelocity } from "./velocity";
import { calculateDaysSinceActivity } from "./days-since-activity";

export type RecomputeLeadInput = {
  customFields: Record<string, unknown>;
  stage: string;
  source: string;
  createdAt: Date;
  lastActivityAt: Date | null;
  followupDate: Date | null;
  hasEnrichment?: boolean;
  emailsSentCount?: number;
  callsMadeCount?: number;
  hasPositiveCallOutcome?: boolean;
  emailOutcomes?: EmailOutcome[];
  /** Timestamps of lead_activity rows, used for the velocity trend. */
  activityTimestamps?: Date[];
};

export type RecomputedScores = {
  fitScore: number;
  fitGrade: "A" | "B" | "C" | "Disqualified" | "Unscored";
  fitFactors: string[];
  fitDisqualifiers: string[];
  engagementScore: number;
  temperature: "on_fire" | "hot" | "warm" | "cold";
  velocity: "accelerating" | "stable" | "slowing" | "stalled";
  daysSinceActivity: number;
};

/**
 * Orchestrates the pure scoring functions — ports the source system's
 * recalculateAllLeadScores. Called from lead-mutating Server Actions after
 * a write, and (later) from a scheduled job for recency-driven decay even
 * when nothing else about the lead changed.
 */
export function recomputeLeadScores(
  lead: RecomputeLeadInput,
  icpFieldDefs: IcpFieldDef[],
  thresholds: FitGradeThresholds,
  now: Date = new Date(),
): RecomputedScores {
  const hasEnrichment = lead.hasEnrichment ?? false;

  const fitResult = calculateFitScore(lead.customFields, icpFieldDefs, thresholds);

  const engagementInput: EngagementInput = {
    hasEnrichment,
    emailsSentCount: lead.emailsSentCount ?? 0,
    callsMadeCount: lead.callsMadeCount ?? 0,
    hasPositiveCallOutcome: lead.hasPositiveCallOutcome ?? false,
    stage: lead.stage,
    lastActivityAt: lead.lastActivityAt,
    followupDate: lead.followupDate,
    createdAt: lead.createdAt,
  };
  const engagementResult = calculateEngagementScore(engagementInput, now);

  const daysSinceActivity = calculateDaysSinceActivity(
    { lastActivityAt: lead.lastActivityAt, followupDate: lead.followupDate, createdAt: lead.createdAt },
    now,
  );

  const temperature = calculateTemperature({
    fitScore: fitResult.score,
    engagementScore: engagementResult.score,
    daysSinceActivity,
    emailOutcomes: lead.emailOutcomes,
  });

  const velocity = calculateVelocity(lead.activityTimestamps ?? [], daysSinceActivity, now);

  return {
    fitScore: fitResult.score,
    fitGrade: fitResult.grade,
    fitFactors: fitResult.factors,
    fitDisqualifiers: fitResult.disqualifiers,
    engagementScore: engagementResult.score,
    temperature,
    velocity,
    daysSinceActivity,
  };
}

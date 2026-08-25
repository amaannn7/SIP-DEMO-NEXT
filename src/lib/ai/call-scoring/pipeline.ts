import type { CallScoringResponse } from "./prompts";

/** Ports the source system's scoreProcessCompletion — deterministic, no LLM: notes quality + follow-up SLA timing. */
export function scoreProcessCompletion(params: { notes: string | null; hasFollowup: boolean; followupSetPromptly: boolean }): {
  score: number;
  breakdown: { notesQuality: string; followupTimingOk: boolean };
} {
  const notesLength = params.notes?.trim().length ?? 0;
  const notesQuality = notesLength === 0 ? "missing" : notesLength < 20 ? "brief" : "detailed";
  const notesScore = notesQuality === "missing" ? 0 : notesQuality === "brief" ? 5 : 10;
  const followupScore = !params.hasFollowup ? 5 : params.followupSetPromptly ? 10 : 3;
  return {
    score: notesScore + followupScore,
    breakdown: { notesQuality, followupTimingOk: !params.hasFollowup || params.followupSetPromptly },
  };
}

/** Ports the source system's computePenalties: prohibited claims (15pts each) + zero-effort closing (5pts), capped at 30. */
export function computePenalties(params: { prohibitedClaims: string[]; closingScore: number }): { penalties: number; reasons: string[] } {
  const reasons: string[] = [];
  let penalties = 0;
  for (const claim of params.prohibitedClaims) {
    penalties += 15;
    reasons.push(`Prohibited claim: ${claim}`);
  }
  if (params.closingScore === 0) {
    penalties += 5;
    reasons.push("Zero-effort closing — no next step proposed");
  }
  return { penalties: Math.min(30, penalties), reasons };
}

export type CallScoreClassification =
  | "correctly_disqualified"
  | "effective_call"
  | "well_handled_no_immediate_progress"
  | "positive_result_execution_risk"
  | "ineffective_call"
  | "mixed_result";

/** Ports the source system's classifyCall — 6-bucket outcome classification from the component scores. */
export function classifyCall(params: {
  correctDisqualification: boolean;
  executionScore: number;
  outcomeIsPositive: boolean;
  finalScore: number;
}): CallScoreClassification {
  if (params.correctDisqualification) return "correctly_disqualified";
  if (params.executionScore >= 4 && params.outcomeIsPositive) return "effective_call";
  if (params.executionScore >= 4 && !params.outcomeIsPositive) return "well_handled_no_immediate_progress";
  if (params.executionScore < 2.5 && params.outcomeIsPositive) return "positive_result_execution_risk";
  if (params.executionScore < 2.5 && !params.outcomeIsPositive) return "ineffective_call";
  return "mixed_result";
}

const POSITIVE_OUTCOMES = new Set(["interested_followup", "consultation_booked", "callback_requested"]);

/** Ports the source system's final weighted-score formula: execution*0.5 + objectives*0.2 + outcome*0.2 + process*0.1 - penalties. */
export function computeFinalScore(params: {
  executionAvg0to5: number;
  objectiveCompletionRate0to1: number;
  outcomeScore0to100: number;
  processScore0to100: number;
  penalties: number;
}): number {
  const executionScore100 = (params.executionAvg0to5 / 5) * 100;
  const objectiveScore100 = params.objectiveCompletionRate0to1 * 100;
  const weighted =
    executionScore100 * 0.5 + objectiveScore100 * 0.2 + params.outcomeScore0to100 * 0.2 + params.processScore0to100 * 0.1;
  return Math.max(0, weighted - params.penalties);
}

export function averageExecutionScore(execution: CallScoringResponse["execution"]): number {
  const scores = Object.values(execution)
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .map((c) => c.score);
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

export function objectiveCompletionRate(objectives: CallScoringResponse["objectives"]): number {
  if (objectives.length === 0) return 1;
  const completed = objectives.filter((o) => o.completed).length;
  return completed / objectives.length;
}

export function isPositiveOutcome(outcome: string | null): boolean {
  return outcome !== null && POSITIVE_OUTCOMES.has(outcome);
}

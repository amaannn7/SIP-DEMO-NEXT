import { describe, it, expect } from "vitest";
import { checkCallEligibility } from "./eligibility";
import {
  scoreProcessCompletion,
  computePenalties,
  classifyCall,
  computeFinalScore,
  averageExecutionScore,
  objectiveCompletionRate,
  isPositiveOutcome,
} from "./pipeline";

describe("checkCallEligibility", () => {
  const base = { via: "aircall", outcome: null, durationSeconds: 120, transcriptStatus: "ready", transcriptConfidence: 0.9 };

  it("is eligible when all conditions are met", () => {
    expect(checkCallEligibility(base, 60, 0.75)).toEqual({ eligible: true });
  });

  it("rejects manual calls", () => {
    expect(checkCallEligibility({ ...base, via: "manual" }, 60, 0.75)).toEqual({ eligible: false, reason: "Not an Aircall call" });
  });

  it("rejects calls under the minimum duration", () => {
    const result = checkCallEligibility({ ...base, durationSeconds: 30 }, 60, 0.75);
    expect(result.eligible).toBe(false);
  });

  it("rejects calls with no transcript", () => {
    const result = checkCallEligibility({ ...base, transcriptStatus: "pending" }, 60, 0.75);
    expect(result.eligible).toBe(false);
  });

  it("rejects calls below the minimum transcript confidence", () => {
    const result = checkCallEligibility({ ...base, transcriptConfidence: 0.5 }, 60, 0.75);
    expect(result.eligible).toBe(false);
  });
});

describe("scoreProcessCompletion", () => {
  it("scores missing notes as 0, brief as 5, detailed as 10", () => {
    expect(scoreProcessCompletion({ notes: null, hasFollowup: false, followupSetPromptly: false }).breakdown.notesQuality).toBe("missing");
    expect(scoreProcessCompletion({ notes: "ok", hasFollowup: false, followupSetPromptly: false }).breakdown.notesQuality).toBe("brief");
    expect(scoreProcessCompletion({ notes: "a".repeat(30), hasFollowup: false, followupSetPromptly: false }).breakdown.notesQuality).toBe("detailed");
  });

  it("penalizes a followup that wasn't set promptly", () => {
    const result = scoreProcessCompletion({ notes: "a".repeat(30), hasFollowup: true, followupSetPromptly: false });
    expect(result.breakdown.followupTimingOk).toBe(false);
  });
});

describe("computePenalties", () => {
  it("adds 15 per prohibited claim, capped at 30", () => {
    const result = computePenalties({ prohibitedClaims: ["a", "b", "c"], closingScore: 3 });
    expect(result.penalties).toBe(30);
    expect(result.reasons).toHaveLength(3);
  });

  it("adds 5 for zero-effort closing", () => {
    const result = computePenalties({ prohibitedClaims: [], closingScore: 0 });
    expect(result.penalties).toBe(5);
  });
});

describe("classifyCall", () => {
  it("classifies correct disqualification first, regardless of other scores", () => {
    expect(classifyCall({ correctDisqualification: true, executionScore: 1, outcomeIsPositive: false, finalScore: 10 })).toBe("correctly_disqualified");
  });

  it("classifies high execution + positive outcome as effective_call", () => {
    expect(classifyCall({ correctDisqualification: false, executionScore: 4.5, outcomeIsPositive: true, finalScore: 80 })).toBe("effective_call");
  });

  it("classifies high execution + no positive outcome as well_handled_no_immediate_progress", () => {
    expect(classifyCall({ correctDisqualification: false, executionScore: 4.5, outcomeIsPositive: false, finalScore: 50 })).toBe(
      "well_handled_no_immediate_progress",
    );
  });

  it("classifies low execution + positive outcome as positive_result_execution_risk", () => {
    expect(classifyCall({ correctDisqualification: false, executionScore: 2, outcomeIsPositive: true, finalScore: 40 })).toBe(
      "positive_result_execution_risk",
    );
  });

  it("classifies low execution + no positive outcome as ineffective_call", () => {
    expect(classifyCall({ correctDisqualification: false, executionScore: 2, outcomeIsPositive: false, finalScore: 20 })).toBe("ineffective_call");
  });

  it("classifies mid execution as mixed_result", () => {
    expect(classifyCall({ correctDisqualification: false, executionScore: 3, outcomeIsPositive: true, finalScore: 60 })).toBe("mixed_result");
  });
});

describe("computeFinalScore", () => {
  it("weights execution 50%, objectives 20%, outcome 20%, process 10%, then subtracts penalties", () => {
    const score = computeFinalScore({
      executionAvg0to5: 5,
      objectiveCompletionRate0to1: 1,
      outcomeScore0to100: 100,
      processScore0to100: 100,
      penalties: 0,
    });
    expect(score).toBe(100);
  });

  it("never goes below 0 even with heavy penalties", () => {
    const score = computeFinalScore({
      executionAvg0to5: 1,
      objectiveCompletionRate0to1: 0,
      outcomeScore0to100: 0,
      processScore0to100: 0,
      penalties: 100,
    });
    expect(score).toBe(0);
  });
});

describe("averageExecutionScore", () => {
  it("averages non-null category scores, skipping null (e.g. no objection came up)", () => {
    const execution = {
      opening_positioning: { score: 4, reason: "", evidence: "" },
      discovery_quality: { score: 4, reason: "", evidence: "" },
      active_listening: { score: 4, reason: "", evidence: "" },
      relevance_personalisation: { score: 4, reason: "", evidence: "" },
      objection_handling: null,
      closing_next_step: { score: 4, reason: "", evidence: "" },
    };
    expect(averageExecutionScore(execution)).toBe(4);
  });
});

describe("objectiveCompletionRate", () => {
  it("returns 1 when there are no objectives to evaluate", () => {
    expect(objectiveCompletionRate([])).toBe(1);
  });

  it("returns the completed fraction", () => {
    expect(objectiveCompletionRate([{ objective: "a", completed: true }, { objective: "b", completed: false }])).toBe(0.5);
  });
});

describe("isPositiveOutcome", () => {
  it("treats interested_followup/consultation_booked/callback_requested as positive", () => {
    expect(isPositiveOutcome("interested_followup")).toBe(true);
    expect(isPositiveOutcome("consultation_booked")).toBe(true);
    expect(isPositiveOutcome("callback_requested")).toBe(true);
  });

  it("treats everything else, including null, as not positive", () => {
    expect(isPositiveOutcome("not_interested")).toBe(false);
    expect(isPositiveOutcome(null)).toBe(false);
  });
});

export type CallForScoring = {
  via: string;
  outcome: string | null;
  durationSeconds: number | null;
  transcriptStatus: string | null;
  transcriptConfidence: number | null;
};

/**
 * Ports the source system's checkCallEligibility exactly: deterministic,
 * no LLM call spent on a call that can't meaningfully be scored.
 */
export function checkCallEligibility(
  call: CallForScoring,
  minDurationSeconds: number,
  minConfidence: number,
): { eligible: true } | { eligible: false; reason: string } {
  if (call.via !== "aircall") return { eligible: false, reason: "Not an Aircall call" };
  if (call.durationSeconds === null || call.durationSeconds < minDurationSeconds) {
    return { eligible: false, reason: `Call too short (under ${minDurationSeconds}s)` };
  }
  if (call.transcriptStatus !== "ready") {
    return { eligible: false, reason: `Transcript not ready (status: ${call.transcriptStatus ?? "none"})` };
  }
  if (call.transcriptConfidence !== null && call.transcriptConfidence < minConfidence) {
    return { eligible: false, reason: `Transcript confidence too low (${call.transcriptConfidence})` };
  }
  return { eligible: true };
}

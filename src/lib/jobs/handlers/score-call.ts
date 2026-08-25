import "server-only";

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs, callScores, jobRuns, callPitches, aircallSettings } from "@/lib/db/schema";
import { callLLM } from "@/lib/ai/call-llm";
import { stripJsonFences } from "@/lib/ai/prompts/shared";
import { checkCallEligibility } from "@/lib/ai/call-scoring/eligibility";
import { buildContentClassificationPrompt, buildCallScoringPrompt, buildOutcomeVerificationPrompt, callScoringResponseSchema } from "@/lib/ai/call-scoring/prompts";
import {
  scoreProcessCompletion,
  computePenalties,
  classifyCall,
  computeFinalScore,
  averageExecutionScore,
  objectiveCompletionRate,
  isPositiveOutcome,
} from "@/lib/ai/call-scoring/pipeline";
import type { ScoreCallJobData } from "@/lib/jobs/queue";

// Section headers a call-pitch script uses (buildCallPitchPrompt) — reused
// here as a stand-in for legacy's structured evaluation_blueprint, which
// this app's call_pitches table doesn't have (plain script text only).
// Scoring objective-completion against these section titles is looser than
// legacy's per-objective blueprint, but avoids adding a new schema field
// purely for this one downstream consumer.
const PITCH_OBJECTIVE_SECTIONS = ["REASON FOR CALL", "PAIN POINTS", "THE ASK"];

export async function handleScoreCall(data: ScoreCallJobData): Promise<void> {
  const { jobRunId, orgId, callLogId } = data;

  await db.update(jobRuns).set({ status: "processing" }).where(eq(jobRuns.id, jobRunId));

  try {
    const [call, settings] = await Promise.all([
      db.query.callLogs.findFirst({ where: eq(callLogs.id, callLogId) }),
      db.query.aircallSettings.findFirst({ where: eq(aircallSettings.orgId, orgId) }),
    ]);
    if (!call) throw new Error(`Call log ${callLogId} not found`);

    const minDuration = settings?.minCallDurationSeconds ?? 60;
    const minConfidence = settings?.minTranscriptConfidence ?? 0.75;

    const eligibility = checkCallEligibility(
      { via: call.via, outcome: call.outcome, durationSeconds: call.durationSeconds, transcriptStatus: call.transcriptStatus, transcriptConfidence: call.transcriptConfidence },
      minDuration,
      minConfidence,
    );

    if (!eligibility.eligible) {
      const [row] = await db.insert(callScores).values({ callLogId, jobRunId, eligible: false, ineligibleReason: eligibility.reason }).returning({ id: callScores.id });
      await db.update(jobRuns).set({ status: "completed", resultId: row.id, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
      return;
    }

    const transcript = call.transcript!;

    // Content classification — cheap first pass, skip scoring entirely for
    // non-sales-call content (voicemail, wrong number, etc).
    const classificationResult = await callLLM(orgId, buildContentClassificationPrompt(transcript.slice(0, 600)));
    const classification = classificationResult.success ? classificationResult.content.trim().toLowerCase() : "sales_call";
    if (classification !== "sales_call") {
      const [row] = await db
        .insert(callScores)
        .values({ callLogId, jobRunId, eligible: false, ineligibleReason: `Not a sales call (classified as ${classification})` })
        .returning({ id: callScores.id });
      await db.update(jobRuns).set({ status: "completed", resultId: row.id, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
      return;
    }

    const latestPitch = await db.query.callPitches.findFirst({
      where: eq(callPitches.leadId, call.leadId),
      orderBy: desc(callPitches.createdAt),
    });
    const pitchObjectives = latestPitch ? PITCH_OBJECTIVE_SECTIONS.filter((s) => latestPitch.script.toUpperCase().includes(s)) : [];

    const mainResult = await callLLM(orgId, buildCallScoringPrompt({ transcript, pitchObjectives, loggedOutcome: call.outcome }));
    if (!mainResult.success) throw new Error(mainResult.error);
    const parsed = callScoringResponseSchema.safeParse(JSON.parse(stripJsonFences(mainResult.content)));
    if (!parsed.success) throw new Error(`Scoring response did not match expected shape: ${parsed.error.message}`);
    const scoring = parsed.data;

    // Outcome verification — cross-check the rep's logged outcome against
    // the transcript with a second short call, only if an outcome exists yet.
    let outcomeSupported = true;
    if (call.outcome) {
      const verifyResult = await callLLM(orgId, buildOutcomeVerificationPrompt(transcript, call.outcome));
      outcomeSupported = verifyResult.success ? verifyResult.content.trim().toLowerCase().startsWith("y") : true;
    }

    const process = scoreProcessCompletion({
      notes: call.notes,
      hasFollowup: false, // this app tracks follow-up date on the lead, not per-call — process score deliberately doesn't penalize a call log without direct followup-date visibility.
      followupSetPromptly: true,
    });

    const penalties = computePenalties({ prohibitedClaims: scoring.prohibited_claims, closingScore: scoring.execution.closing_next_step.score });

    const executionAvg = averageExecutionScore(scoring.execution);
    const objectiveRate = objectiveCompletionRate(scoring.objectives);
    const outcomeScore = call.outcome ? (isPositiveOutcome(call.outcome) && outcomeSupported ? 100 : outcomeSupported ? 60 : 20) : 50;

    const finalScore = computeFinalScore({
      executionAvg0to5: executionAvg,
      objectiveCompletionRate0to1: objectiveRate,
      outcomeScore0to100: outcomeScore,
      processScore0to100: process.score,
      penalties: penalties.penalties,
    });

    const classificationBucket = classifyCall({
      correctDisqualification: scoring.correct_disqualification,
      executionScore: executionAvg,
      outcomeIsPositive: isPositiveOutcome(call.outcome),
      finalScore,
    });

    const [row] = await db
      .insert(callScores)
      .values({
        callLogId,
        jobRunId,
        eligible: true,
        executionScore: executionAvg,
        executionBreakdown: Object.fromEntries(
          Object.entries(scoring.execution).filter(([, v]) => v !== null).map(([k, v]) => [k, v as { score: number; reason: string; evidence: string }]),
        ),
        objectiveCompletionScore: objectiveRate * 100,
        objectiveBreakdown: scoring.objectives,
        outcomeScore,
        outcomeBreakdown: { loggedOutcome: call.outcome ?? "not_logged", transcriptSupportsOutcome: outcomeSupported, note: "" },
        processScore: process.score,
        processBreakdown: process.breakdown,
        penalties: penalties.penalties,
        penaltyReasons: penalties.reasons,
        finalScore,
        classification: classificationBucket,
        confidence: scoring.confidence,
        strengths: scoring.strengths,
        coachingOpportunities: scoring.coaching_opportunities,
      })
      .returning({ id: callScores.id });

    await db.update(jobRuns).set({ status: "completed", resultId: row.id, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.update(jobRuns).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(jobRuns.id, jobRunId));
    throw err;
  }
}

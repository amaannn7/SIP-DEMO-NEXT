import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobRuns, callLogs } from "@/lib/db/schema";
import { getStartedBoss, QUEUE_NAMES } from "./queue";
import { handleEnrichLead } from "./handlers/enrich-lead";
import { handleGenerateEmail } from "./handlers/generate-email";
import { handleGenerateCallPitch } from "./handlers/generate-call-pitch";
import type { EmailSequenceStep } from "@/lib/ai/prompts/email";
import type { CallPitchType } from "@/lib/ai/prompts/call-pitch";

async function createJobRun(params: {
  orgId: string;
  leadId: string;
  actorId: string;
  type: "enrich_lead" | "generate_email" | "generate_call_pitch";
  input: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(jobRuns)
    .values({
      orgId: params.orgId,
      leadId: params.leadId,
      actorId: params.actorId,
      type: params.type,
      input: params.input,
    })
    .returning({ id: jobRuns.id });
  return row.id;
}

// enrich_lead/generate_email/generate_call_pitch run inline, awaited, right
// here — not handed to pg-boss for a background worker to pick up. Each is
// a single LLM call (a few seconds), well within a Vercel serverless
// function's timeout, and Vercel can't run pg-boss's persistent worker
// process at all — there's no separate worker to hand these off to in that
// environment. The job_runs row + status columns stay exactly as they were
// (the client still enqueues then polls /api/jobs/[jobRunId]), so nothing
// about the calling code or the UI needs to change; this only changes WHO
// does the work, from a separate process to the Server Action itself.
// score_call/reconcile_transcripts stay on the real queue — they're
// webhook/cron-triggered, not a user waiting on a button click, and
// reconcile_transcripts in particular is inherently a recurring sweep.

// Each handler already sets job_runs.status = "failed" (with .error) in its
// own catch block before re-throwing — that re-throw exists for pg-boss's
// benefit (it uses a thrown error to mark a queue job failed/retryable),
// which no longer applies once called directly. Swallowing it here keeps
// this function's contract exactly what every caller already relies on
// ("always resolves to a jobRunId; check the job_runs row for the outcome"),
// instead of an unhandled rejection surfacing as a generic Next.js error
// boundary on the client for what the UI already has a clean path to show.
async function runInline(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    console.error("[jobs] inline handler failed (already recorded on job_runs):", err);
  }
}

export async function enqueueEnrichLead(params: { orgId: string; leadId: string; actorId: string }): Promise<string> {
  const jobRunId = await createJobRun({ ...params, type: "enrich_lead", input: {} });
  await runInline(() => handleEnrichLead({ jobRunId, orgId: params.orgId, leadId: params.leadId }));
  return jobRunId;
}

export async function enqueueGenerateEmail(params: {
  orgId: string;
  leadId: string;
  actorId: string;
  sequenceStep: EmailSequenceStep;
  customInstructions?: string;
  includeSignature?: boolean;
}): Promise<string> {
  const jobRunId = await createJobRun({
    ...params,
    type: "generate_email",
    input: { sequenceStep: params.sequenceStep, customInstructions: params.customInstructions, includeSignature: params.includeSignature },
  });
  await runInline(() =>
    handleGenerateEmail({
      jobRunId,
      orgId: params.orgId,
      leadId: params.leadId,
      actorId: params.actorId,
      sequenceStep: params.sequenceStep,
      customInstructions: params.customInstructions,
      includeSignature: params.includeSignature,
    }),
  );
  return jobRunId;
}

export async function enqueueGenerateCallPitch(params: {
  orgId: string;
  leadId: string;
  actorId: string;
  pitchType: CallPitchType;
  customInstructions?: string;
}): Promise<string> {
  const jobRunId = await createJobRun({
    ...params,
    type: "generate_call_pitch",
    input: { pitchType: params.pitchType, customInstructions: params.customInstructions },
  });
  await runInline(() =>
    handleGenerateCallPitch({
      jobRunId,
      orgId: params.orgId,
      leadId: params.leadId,
      pitchType: params.pitchType,
      customInstructions: params.customInstructions,
    }),
  );
  return jobRunId;
}

/**
 * Triggered by the Aircall webhook (transcription.created), not by a rep —
 * no actorId, and leadId is looked up from the call log rather than passed
 * in, since the webhook only knows the call log id.
 */
export async function enqueueScoreCall(params: { orgId: string; callLogId: string }): Promise<string> {
  const [call] = await db.select({ leadId: callLogs.leadId }).from(callLogs).where(eq(callLogs.id, params.callLogId));
  const [row] = await db
    .insert(jobRuns)
    .values({ orgId: params.orgId, leadId: call?.leadId ?? null, actorId: null, type: "score_call", input: { callLogId: params.callLogId } })
    .returning({ id: jobRuns.id });

  const boss = await getStartedBoss();
  await boss.send(QUEUE_NAMES.scoreCall, { jobRunId: row.id, orgId: params.orgId, callLogId: params.callLogId });
  return row.id;
}

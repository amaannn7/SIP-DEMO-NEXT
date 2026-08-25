import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobRuns, callLogs } from "@/lib/db/schema";
import { getStartedBoss, QUEUE_NAMES } from "./queue";
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

export async function enqueueEnrichLead(params: { orgId: string; leadId: string; actorId: string }): Promise<string> {
  const jobRunId = await createJobRun({ ...params, type: "enrich_lead", input: {} });
  const boss = await getStartedBoss();
  await boss.send(QUEUE_NAMES.enrichLead, { jobRunId, orgId: params.orgId, leadId: params.leadId });
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
  const boss = await getStartedBoss();
  await boss.send(QUEUE_NAMES.generateEmail, {
    jobRunId,
    orgId: params.orgId,
    leadId: params.leadId,
    actorId: params.actorId,
    sequenceStep: params.sequenceStep,
    customInstructions: params.customInstructions,
    includeSignature: params.includeSignature,
  });
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
  const boss = await getStartedBoss();
  await boss.send(QUEUE_NAMES.generateCallPitch, {
    jobRunId,
    orgId: params.orgId,
    leadId: params.leadId,
    pitchType: params.pitchType,
    customInstructions: params.customInstructions,
  });
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

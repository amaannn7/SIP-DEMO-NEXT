"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { leadIdsBelongToOrg } from "@/lib/db/queries/leads";
import { enqueueEnrichLead, enqueueGenerateEmail, enqueueGenerateCallPitch } from "@/lib/jobs/enqueue";
import { emailSequenceStepEnum, callPitchTypeEnum } from "@/lib/db/schema";
import { generateNextBestAction } from "@/lib/next-best-action/generate";
import type { NextBestAction } from "@/lib/next-best-action/rule-based";

const sequenceStepSchema = z.enum(emailSequenceStepEnum.enumValues);
const pitchTypeSchema = z.enum(callPitchTypeEnum.enumValues);

async function assertLeadInOrg(orgId: string, leadId: string) {
  const ids = await leadIdsBelongToOrg(orgId, [leadId]);
  if (ids.length === 0) {
    throw new Error("Lead not found");
  }
}

export async function triggerEnrichLeadAction(leadId: string): Promise<{ jobRunId: string } | { error: string }> {
  const session = await requireAuth();
  await assertLeadInOrg(session.user.orgId, leadId);
  const jobRunId = await enqueueEnrichLead({ orgId: session.user.orgId, leadId, actorId: session.user.id });
  return { jobRunId };
}

const customInstructionsSchema = z.string().trim().max(1000).optional();

export async function triggerGenerateEmailAction(
  leadId: string,
  sequenceStep: string,
  customInstructions?: string,
  includeSignature = true,
): Promise<{ jobRunId: string } | { error: string }> {
  const session = await requireAuth();
  const parsed = sequenceStepSchema.safeParse(sequenceStep);
  if (!parsed.success) return { error: "Invalid sequence step" };
  await assertLeadInOrg(session.user.orgId, leadId);
  const jobRunId = await enqueueGenerateEmail({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    sequenceStep: parsed.data,
    customInstructions: customInstructionsSchema.parse(customInstructions) || undefined,
    includeSignature,
  });
  return { jobRunId };
}

export async function triggerGenerateCallPitchAction(
  leadId: string,
  pitchType: string,
  customInstructions?: string,
): Promise<{ jobRunId: string } | { error: string }> {
  const session = await requireAuth();
  const parsed = pitchTypeSchema.safeParse(pitchType);
  if (!parsed.success) return { error: "Invalid pitch type" };
  await assertLeadInOrg(session.user.orgId, leadId);
  const jobRunId = await enqueueGenerateCallPitch({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    pitchType: parsed.data,
    customInstructions: customInstructionsSchema.parse(customInstructions) || undefined,
  });
  return { jobRunId };
}

export async function getNextBestActionAction(leadId: string, useAi: boolean): Promise<{ recommendation: NextBestAction } | { error: string }> {
  const session = await requireAuth();
  await assertLeadInOrg(session.user.orgId, leadId);
  try {
    const recommendation = await generateNextBestAction(session.user.orgId, leadId, useAi);
    return { recommendation };
  } catch {
    return { error: "Could not generate a recommendation for this lead" };
  }
}

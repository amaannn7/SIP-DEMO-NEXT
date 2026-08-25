"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads, emailHistory, emailOutcomeEnum, emailSkipReasonEnum } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { logLeadActivity, assertLeadWriteAccess } from "@/lib/db/queries/leads";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";

const emailOutcomeSchema = z.object({
  outcome: z.enum(emailOutcomeEnum.enumValues),
});

/**
 * Ports the source system's Skip Email flow exactly: a rep can bypass
 * emailing entirely and jump straight to the Call tab, recording why. Sets
 * stage to call_attempted the same as confirmSkipEmail — never sends
 * anything, never touches emailsSentCount.
 */
export async function skipEmailAction(leadId: string, reason: (typeof emailSkipReasonEnum.enumValues)[number]): Promise<{ error?: string }> {
  const session = await requireAuth();

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) return { error: "Lead not found" };

  await db
    .update(leads)
    .set({ emailSkipped: reason, stage: "call_attempted", lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await logLeadActivity({ orgId: session.user.orgId, leadId, actorId: session.user.id, type: "email_skipped", payload: { reason } });

  if (lead.stage !== "call_attempted") {
    await logLeadActivity({
      orgId: session.user.orgId,
      leadId,
      actorId: session.user.id,
      type: "stage_changed",
      payload: { from: lead.stage, to: "call_attempted", reason: "email_skipped" },
    });
  }

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}

/**
 * Ports the source system's save-email: the moment a generated draft
 * actually counts — increments emails_sent and advances the lead's stage,
 * same as the source system's markEmailSent -> save-email flow. Generating
 * (handleGenerateEmail) deliberately does neither, so regenerating a draft
 * never inflates the count or the stage before the rep has sent anything.
 */
export async function markEmailSentAction(leadId: string, emailId: string): Promise<{ error?: string }> {
  const session = await requireAuth();

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) return { error: "Lead not found" };

  const [email] = await db
    .select({ id: emailHistory.id, sentAt: emailHistory.sentAt, sequenceStep: emailHistory.sequenceStep })
    .from(emailHistory)
    .where(and(eq(emailHistory.id, emailId), eq(emailHistory.leadId, leadId), eq(emailHistory.orgId, session.user.orgId)));
  if (!email) return { error: "Email not found" };
  if (email.sentAt) return {};

  // Ports the source system's save-email advance-from set exactly
  // (['new_lead', 'research', 'engaged']) — a lead that replied and moved to
  // 'engaged' still moves back to 'email_sent' when the rep sends a
  // follow-up, matching legacy's pipeline instead of leaving it stuck.
  const advancesStage = lead.stage === "new_lead" || lead.stage === "research" || lead.stage === "engaged";
  const nextStage = advancesStage ? ("email_sent" as const) : lead.stage;

  await Promise.all([
    db.update(emailHistory).set({ sentAt: new Date() }).where(eq(emailHistory.id, emailId)),
    db
      .update(leads)
      .set({ emailsSentCount: lead.emailsSentCount + 1, lastEmailStep: email.sequenceStep, stage: nextStage, lastActivityAt: new Date() })
      .where(eq(leads.id, leadId)),
    logLeadActivity({ orgId: session.user.orgId, leadId, actorId: session.user.id, type: "email_sent", payload: { emailId } }),
  ]);

  if (nextStage !== lead.stage) {
    await logLeadActivity({
      orgId: session.user.orgId,
      leadId,
      actorId: session.user.id,
      type: "stage_changed",
      payload: { from: lead.stage, to: nextStage, reason: "email_sent" },
    });
  }

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}

/** Ports the source system's email-outcome: replied/meeting_booked auto-advance the lead's stage, same as a positive call outcome does. */
const STAGE_BY_EMAIL_OUTCOME: Partial<Record<(typeof emailOutcomeEnum.enumValues)[number], (typeof leads.$inferSelect)["stage"]>> = {
  replied: "engaged",
  meeting_booked: "consultation_booked",
};

export type LogEmailOutcomeState = { error?: string };

export async function logEmailOutcomeAction(
  leadId: string,
  emailId: string,
  _prevState: LogEmailOutcomeState,
  formData: FormData,
): Promise<LogEmailOutcomeState> {
  const session = await requireAuth();

  const parsed = emailOutcomeSchema.safeParse({ outcome: formData.get("outcome") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid outcome" };
  }

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) {
    return { error: "Lead not found" };
  }

  const [email] = await db
    .select({ id: emailHistory.id })
    .from(emailHistory)
    .where(and(eq(emailHistory.id, emailId), eq(emailHistory.leadId, leadId), eq(emailHistory.orgId, session.user.orgId)));
  if (!email) {
    return { error: "Email not found" };
  }

  const nextStage = STAGE_BY_EMAIL_OUTCOME[parsed.data.outcome];

  await db
    .update(emailHistory)
    .set({ outcome: parsed.data.outcome, outcomeAt: new Date() })
    .where(eq(emailHistory.id, emailId));

  await db
    .update(leads)
    .set({
      lastActivityAt: new Date(),
      updatedAt: new Date(),
      ...(nextStage ? { stage: nextStage } : {}),
    })
    .where(eq(leads.id, leadId));

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: "email_outcome_logged",
    payload: { outcome: parsed.data.outcome, emailId },
  });

  if (nextStage && nextStage !== lead.stage) {
    await logLeadActivity({
      orgId: session.user.orgId,
      leadId,
      actorId: session.user.id,
      type: "stage_changed",
      payload: { from: lead.stage, to: nextStage, reason: "email_outcome" },
    });
  }

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}

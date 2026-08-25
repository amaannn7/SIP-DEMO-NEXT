"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads, callLogs, callOutcomeEnum, nextActionEnum } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { logLeadActivity, assertLeadWriteAccess } from "@/lib/db/queries/leads";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";
import { listIcpFields } from "@/lib/db/queries/org-settings";
import { CALL_OUTCOME_LABELS } from "@/lib/calls/outcomes";
import type { IcpFieldDef } from "@/lib/scoring/fit-score";

const logCallSchema = z
  .object({
    outcome: z.enum(callOutcomeEnum.enumValues),
    notes: z.string().trim().max(500).optional(),
    nextAction: z.enum(nextActionEnum.enumValues),
    followupDate: z.string().optional(),
  })
  // Ports the source system's saveCallOutcome() gate: choosing "Schedule
  // Follow-up" as the next action requires a date, exactly like legacy only
  // reveals/requires the date picker for that one option.
  .refine((data) => data.nextAction !== "followup_date" || Boolean(data.followupDate), {
    message: "Select a follow-up date",
    path: ["followupDate"],
  });

/**
 * Default stage transition per outcome — ports the source system's
 * macktilesCallOutcomeConfig() stage table exactly: 'not_interested' and
 * 'wrong_number' park for possible later re-engagement rather than closing
 * the lead as permanently lost, 'callback_requested' stays in the calling
 * cadence rather than skipping ahead to 'engaged', and the three
 * couldn't-reach outcomes explicitly (re-)land the lead at 'call_attempted'
 * even if it started elsewhere. This is the DEFAULT only — see
 * resolveNextStage below for the rep's Next Action override.
 */
const STAGE_BY_OUTCOME: Record<(typeof callOutcomeEnum.enumValues)[number], (typeof leads.$inferSelect)["stage"]> = {
  no_answer_retry: "call_attempted",
  left_voicemail: "call_attempted",
  gatekeeper: "call_attempted",
  wrong_number: "nurture_parked",
  not_interested: "nurture_parked",
  interested_followup: "engaged",
  consultation_booked: "consultation_booked",
  callback_requested: "call_attempted",
  not_right_time_park_90: "nurture_parked",
};

/**
 * Ports the source system's exact two-case override: the rep's Next Action
 * choice can force the lead past whatever stage the outcome alone would
 * imply — e.g. a "no answer" call where the rep books a consultation anyway,
 * or a call the rep decides to park regardless of the raw outcome. Every
 * other Next Action value defers entirely to the outcome's default stage;
 * the submitted next_action is never trusted for anything beyond these two
 * specific overrides.
 */
function resolveNextStage(
  outcome: (typeof callOutcomeEnum.enumValues)[number],
  nextAction: (typeof nextActionEnum.enumValues)[number],
): (typeof leads.$inferSelect)["stage"] {
  if (nextAction === "consultation_booked") return "consultation_booked";
  if (nextAction === "nurture_parked") return "nurture_parked";
  return STAGE_BY_OUTCOME[outcome];
}

const PARK_OR_DISQUALIFY_OUTCOMES = new Set<(typeof callOutcomeEnum.enumValues)[number]>([
  "not_interested",
  "wrong_number",
  "not_right_time_park_90",
]);

export type LogCallState = { error?: string; fieldErrors?: Record<string, string> };

/** Parses the org's ICP fields out of the same FormData the outcome form submits — see saveIcpAnswersAction for the per-type parsing this mirrors. */
function parseIcpAnswers(formData: FormData, fieldDefs: IcpFieldDef[], existing: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };
  for (const field of fieldDefs) {
    if (field.fieldType === "multiselect") {
      const values = formData.getAll(`icp.${field.key}`).map(String).filter(Boolean);
      if (values.length > 0) next[field.key] = values;
      else delete next[field.key];
      continue;
    }
    const raw = formData.get(`icp.${field.key}`);
    if (raw === null || raw === "") {
      delete next[field.key];
      continue;
    }
    if (field.fieldType === "boolean") {
      next[field.key] = raw === "true";
    } else if (field.fieldType === "number") {
      const num = Number(raw);
      if (!Number.isNaN(num)) next[field.key] = num;
    } else {
      next[field.key] = String(raw);
    }
  }
  return next;
}

/**
 * Single atomic save for the whole Outcome tab wizard (Outcome -> Qualification
 * Data -> Notes -> Next Action), matching the source system's saveCallOutcome()
 * — one submit, one request, rather than the call-log and ICP-answers forms
 * saving independently. "At least one qualification field" is checked against
 * what's being submitted in THIS request, not against whatever was saved by an
 * earlier, disconnected form.
 */
export async function logCallOutcomeAction(leadId: string, _prevState: LogCallState, formData: FormData): Promise<LogCallState> {
  const session = await requireAuth();

  const parsed = logCallSchema.safeParse({
    outcome: formData.get("outcome"),
    notes: formData.get("notes") || undefined,
    nextAction: formData.get("nextAction"),
    followupDate: formData.get("followupDate") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key] = issue.message;
    }
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", fieldErrors };
  }

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) {
    return { error: "Lead not found" };
  }

  const icpFields = await listIcpFields(session.user.orgId);
  const nextCustomFields = parseIcpAnswers(formData, icpFields, lead.customFields);

  // Matches the source system: if the org has any qualification fields
  // configured, at least one must be answered to save a call outcome — not
  // every field, just some qualification data captured with this call.
  if (icpFields.length > 0) {
    const hasAnyAnswer = icpFields.some((field) => {
      const value = nextCustomFields[field.key];
      return value !== undefined && value !== null && value !== "";
    });
    if (!hasAnyAnswer) {
      return {
        error: "Fill in at least one qualification field before saving this outcome",
        fieldErrors: { qualification: "Fill in at least one qualification field before saving this outcome" },
      };
    }
  }

  // 'not_right_time_park_90' defaults to a 90-day followup when the rep
  // didn't pick a date, matching the source system's park-for-90-days intent.
  let followupDate = parsed.data.followupDate ? new Date(parsed.data.followupDate) : undefined;
  if (!followupDate && parsed.data.outcome === "not_right_time_park_90") {
    followupDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }
  const nextStage = resolveNextStage(parsed.data.outcome, parsed.data.nextAction);
  const outcomeLabel = CALL_OUTCOME_LABELS[parsed.data.outcome];

  await db.insert(callLogs).values({
    orgId: session.user.orgId,
    leadId,
    loggedBy: session.user.id,
    outcome: parsed.data.outcome,
    nextAction: parsed.data.nextAction,
    notes: parsed.data.notes,
  });

  await db
    .update(leads)
    .set({
      callsMadeCount: sql`${leads.callsMadeCount} + 1`,
      lastCallOutcome: parsed.data.outcome,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
      stage: nextStage,
      customFields: nextCustomFields,
      ...(followupDate ? { followupDate } : {}),
      ...(PARK_OR_DISQUALIFY_OUTCOMES.has(parsed.data.outcome) ? { rejectionReason: outcomeLabel } : {}),
    })
    .where(eq(leads.id, leadId));

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: "call_logged",
    payload: { outcome: parsed.data.outcome, nextAction: parsed.data.nextAction },
  });

  if (nextStage !== lead.stage) {
    await logLeadActivity({
      orgId: session.user.orgId,
      leadId,
      actorId: session.user.id,
      type: "stage_changed",
      payload: { from: lead.stage, to: nextStage, reason: "call_outcome" },
    });
  }

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}

// Stages a rep might plausibly still be in when they actually pick up the
// phone — ports the source system's start-call guard exactly
// (`in_array(getLeadStage($lead), ['email_sent', 'research', 'new_lead'])`).
// A lead already further along (engaged, consultation_booked, etc.) is left
// alone — starting another call on it shouldn't walk the stage backwards.
const START_CALL_ADVANCE_FROM = new Set<(typeof leads.$inferSelect)["stage"]>(["new_lead", "research", "email_sent"]);

export type StartCallState = { error?: string };

/**
 * Ports the source system's start-call (Aircall click-to-dial) side effect,
 * minus the actual dialing — this app has no phone integration, so the
 * button is a rep's manual "I'm calling now" declaration instead of a
 * click-to-dial trigger. What it reproduces is the part that was missing
 * from the rewrite entirely: stage advances to call_attempted the moment the
 * rep starts the call, not only once an outcome is eventually logged. Without
 * this, a lead a rep has already called still reads "Email Sent" and the
 * Call step never shows as reached until the Outcome form is submitted.
 */
export async function startCallAction(leadId: string): Promise<StartCallState> {
  const session = await requireAuth();

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) return { error: "Lead not found" };

  const advancesStage = START_CALL_ADVANCE_FROM.has(lead.stage);
  const nextStage = advancesStage ? ("call_attempted" as const) : lead.stage;

  await db
    .update(leads)
    .set({
      callsMadeCount: sql`${leads.callsMadeCount} + 1`,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
      ...(advancesStage ? { stage: nextStage } : {}),
    })
    .where(eq(leads.id, leadId));

  await logLeadActivity({ orgId: session.user.orgId, leadId, actorId: session.user.id, type: "call_started", payload: {} });

  if (advancesStage) {
    await logLeadActivity({
      orgId: session.user.orgId,
      leadId,
      actorId: session.user.id,
      type: "stage_changed",
      payload: { from: lead.stage, to: nextStage, reason: "call_started" },
    });
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}

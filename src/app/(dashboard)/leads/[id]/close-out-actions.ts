"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { logLeadActivity, assertLeadWriteAccess } from "@/lib/db/queries/leads";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";

/**
 * Mark Won/Lost/Dropped — a dedicated close-out action rather than the
 * generic stage select, matching the source system: Won/Lost buttons only
 * appear once a lead has reached consultation_booked/won/lost and remain
 * available afterward so a close-out can be corrected; Drop (-> nurture_parked)
 * is reachable from any earlier stage as its own "Park or reject" action,
 * ported from the source system's drop-lead endpoint.
 */
async function closeOutLead(leadId: string, stage: "won" | "lost" | "nurture_parked", rejectionReason?: string): Promise<{ error?: string }> {
  const session = await requireAuth();

  const existing = await assertLeadWriteAccess(session, leadId);
  if (!existing) {
    return { error: "Lead not found" };
  }

  await db
    .update(leads)
    .set({
      stage,
      rejectionReason: stage === "lost" || stage === "nurture_parked" ? rejectionReason || null : null,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(leads.id, leadId), eq(leads.orgId, session.user.orgId)));

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: "stage_changed",
    payload: { from: existing.stage, to: stage, reason: "manual_update", ...(rejectionReason ? { rejectionReason } : {}) },
  });

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return {};
}

export async function markLeadWonAction(leadId: string): Promise<void> {
  await closeOutLead(leadId, "won");
}

const reasonSchema = z.string().trim().max(500).optional();

export type MarkLeadLostState = { error?: string };

export async function markLeadLostAction(
  leadId: string,
  _prevState: MarkLeadLostState,
  formData: FormData,
): Promise<MarkLeadLostState> {
  const parsed = reasonSchema.safeParse(formData.get("reason") || undefined);
  if (!parsed.success) {
    return { error: "Invalid reason" };
  }
  const result = await closeOutLead(leadId, "lost", parsed.data);
  return result;
}

export type DropLeadState = { error?: string };

/** Ports the source system's drop-lead: park/reject a lead from any stage, with an optional reason, independent of a call outcome. */
export async function dropLeadAction(leadId: string, _prevState: DropLeadState, formData: FormData): Promise<DropLeadState> {
  const parsed = reasonSchema.safeParse(formData.get("reason") || undefined);
  if (!parsed.success) {
    return { error: "Invalid reason" };
  }
  const result = await closeOutLead(leadId, "nurture_parked", parsed.data);
  return result;
}

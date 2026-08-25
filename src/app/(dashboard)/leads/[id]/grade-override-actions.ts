"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { assertLeadWriteAccess } from "@/lib/db/queries/leads";
import { GRADE_OVERRIDE_REASONS } from "@/lib/leads/grade-override-reasons";

const overrideSchema = z
  .object({
    reason: z.enum(GRADE_OVERRIDE_REASONS.map((r) => r.id) as [string, ...string[]]),
    notes: z.string().trim().max(500).optional().default(""),
  })
  .refine((data) => data.reason !== "other" || data.notes.length > 0, { message: "Notes are required for \"Other\"" });

export type GradeOverrideState = { error?: string };

/**
 * Ports the source system's grade-override: an annotation documenting why a
 * rep is proceeding on this lead despite its grade — informational only,
 * never changes fitGrade or unlocks anything (the source system's own gating
 * comment is explicit: "grade is for information only, does NOT block
 * actions"), just renders "(Overridden)" next to the grade badge with an
 * audit trail of who/when/why.
 */
export async function setGradeOverrideAction(leadId: string, _prevState: GradeOverrideState, formData: FormData): Promise<GradeOverrideState> {
  const session = await requireAuth();
  const parsed = overrideSchema.safeParse({ reason: formData.get("reason"), notes: formData.get("notes") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) {
    return { error: "Lead not found" };
  }

  await db
    .update(leads)
    .set({
      gradeOverride: {
        reason: parsed.data.reason,
        notes: parsed.data.notes,
        overriddenBy: session.user.displayName,
        overriddenAt: new Date().toISOString(),
        originalGrade: lead.fitGrade ?? "",
      },
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function clearGradeOverrideAction(leadId: string): Promise<void> {
  const session = await requireAuth();
  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) return;
  await db
    .update(leads)
    .set({ gradeOverride: null, updatedAt: new Date() })
    .where(eq(leads.id, leadId));
  revalidatePath(`/leads/${leadId}`);
}

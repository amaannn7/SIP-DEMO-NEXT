"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dailyCommitments, dailyCommitmentActionEnum } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { upsertPersonalDailyTargets } from "@/lib/db/queries/daily-targets";
import { todayDateString } from "@/lib/daily/today";
import { leadIdsBelongToOrg } from "@/lib/db/queries/leads";

const addCommitmentSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(300),
  leadId: z.string().uuid().optional(),
  action: z.enum(dailyCommitmentActionEnum.enumValues).optional().default("other"),
  dueTime: z.string().trim().max(20).optional(),
});

export type AddCommitmentState = { error?: string };

export async function addCommitmentAction(_prevState: AddCommitmentState, formData: FormData): Promise<AddCommitmentState> {
  const session = await requireAuth();
  const parsed = addCommitmentSchema.safeParse({
    description: formData.get("description"),
    leadId: formData.get("leadId") || undefined,
    action: formData.get("action") || undefined,
    dueTime: formData.get("dueTime") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // A raw lead ID field lets a rep link a commitment without a full picker
  // (matches the source system's manual-entry flow) — verify it's a real
  // lead in this org before trusting it, rather than silently storing
  // whatever was typed.
  let leadId: string | undefined;
  if (parsed.data.leadId) {
    const validIds = await leadIdsBelongToOrg(session.user.orgId, [parsed.data.leadId]);
    if (validIds.length === 0) {
      return { error: "Lead ID not found in your organization" };
    }
    leadId = validIds[0];
  }

  await db.insert(dailyCommitments).values({
    orgId: session.user.orgId,
    userId: session.user.id,
    leadId,
    forDate: todayDateString(),
    description: parsed.data.description,
    action: parsed.data.action,
    dueTime: parsed.data.dueTime,
  });

  revalidatePath("/commitments");
  return {};
}

export async function toggleCommitmentAction(commitmentId: string, isCompleted: boolean): Promise<void> {
  const session = await requireAuth();
  await db
    .update(dailyCommitments)
    .set({ isCompleted, completedAt: isCompleted ? new Date() : null })
    .where(
      and(eq(dailyCommitments.id, commitmentId), eq(dailyCommitments.orgId, session.user.orgId), eq(dailyCommitments.userId, session.user.id)),
    );

  revalidatePath("/commitments");
}

export async function deleteCommitmentAction(commitmentId: string): Promise<void> {
  const session = await requireAuth();
  await db
    .delete(dailyCommitments)
    .where(
      and(eq(dailyCommitments.id, commitmentId), eq(dailyCommitments.orgId, session.user.orgId), eq(dailyCommitments.userId, session.user.id)),
    );

  revalidatePath("/commitments");
}

const targetsSchema = z.object({
  callsTarget: z.coerce.number().int().min(0).max(500),
  emailsTarget: z.coerce.number().int().min(0).max(500),
  researchTarget: z.coerce.number().int().min(0).max(500),
});

export type SaveTargetsState = { error?: string };

export async function savePersonalTargetsAction(_prevState: SaveTargetsState, formData: FormData): Promise<SaveTargetsState> {
  const session = await requireAuth();
  const parsed = targetsSchema.safeParse({
    callsTarget: formData.get("callsTarget"),
    emailsTarget: formData.get("emailsTarget"),
    researchTarget: formData.get("researchTarget"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await upsertPersonalDailyTargets(session.user.orgId, session.user.id, parsed.data);

  revalidatePath("/commitments");
  return {};
}

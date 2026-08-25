"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { leads, leadStageEnum } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { logLeadActivity, assertLeadWriteAccess } from "@/lib/db/queries/leads";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";

const stageSchema = z.enum(leadStageEnum.enumValues);

export async function updateLeadStageAction(leadId: string, stage: string): Promise<void> {
  const session = await requireAuth();
  const parsed = stageSchema.safeParse(stage);
  if (!parsed.success) return;

  const existing = await assertLeadWriteAccess(session, leadId);
  if (!existing || existing.stage === parsed.data) return;

  await db
    .update(leads)
    .set({ stage: parsed.data, lastActivityAt: new Date(), updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.orgId, session.user.orgId)));

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: "stage_changed",
    payload: { from: existing.stage, to: parsed.data },
  });

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

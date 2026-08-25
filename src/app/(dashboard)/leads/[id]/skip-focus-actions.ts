"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { assertLeadWriteAccess } from "@/lib/db/queries/leads";
import { SKIP_DURATIONS, type SkipDuration } from "@/lib/leads/skip-durations";

/** Ports the source system's skip-focus-item: snoozes a lead out of the Focus Queue until skippedUntil passes. */
export async function skipFocusItemAction(leadId: string, duration: SkipDuration): Promise<void> {
  const session = await requireAuth();
  const config = SKIP_DURATIONS[duration];
  if (!config) return;

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) return;

  const skippedUntil = new Date(Date.now() + config.ms);
  await db
    .update(leads)
    .set({ skippedUntil })
    .where(eq(leads.id, leadId));

  revalidatePath("/dashboard");
}

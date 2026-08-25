"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { upsertOrgDefaultDailyTargets } from "@/lib/db/queries/daily-targets";

const targetsSchema = z.object({
  callsTarget: z.coerce.number().int().min(0).max(500),
  emailsTarget: z.coerce.number().int().min(0).max(500),
  researchTarget: z.coerce.number().int().min(0).max(500),
});

export type SaveOrgTargetsState = { error?: string };

export async function saveOrgDefaultTargetsAction(_prevState: SaveOrgTargetsState, formData: FormData): Promise<SaveOrgTargetsState> {
  const session = await requireRole("admin");

  const parsed = targetsSchema.safeParse({
    callsTarget: formData.get("callsTarget"),
    emailsTarget: formData.get("emailsTarget"),
    researchTarget: formData.get("researchTarget"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await upsertOrgDefaultDailyTargets(session.user.orgId, parsed.data);

  revalidatePath("/admin/settings");
  return {};
}

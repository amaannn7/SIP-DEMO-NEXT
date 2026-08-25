"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { listIcpFields } from "@/lib/db/queries/org-settings";
import { logLeadActivity, assertLeadWriteAccess } from "@/lib/db/queries/leads";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";

export type SaveIcpAnswersState = { error?: string; success?: boolean };

/** Parses submitted field values against the org's ICP field definitions (types the raw FormData entries by fieldType, drops empty/unset answers). */
export async function saveIcpAnswersAction(
  leadId: string,
  _prevState: SaveIcpAnswersState,
  formData: FormData,
): Promise<SaveIcpAnswersState> {
  const session = await requireAuth();

  const [lead, fieldDefs] = await Promise.all([assertLeadWriteAccess(session, leadId), listIcpFields(session.user.orgId)]);
  if (!lead) {
    return { error: "Lead not found" };
  }

  const nextCustomFields: Record<string, unknown> = { ...lead.customFields };
  for (const field of fieldDefs) {
    if (field.fieldType === "multiselect") {
      const values = formData.getAll(field.key).map(String).filter(Boolean);
      if (values.length > 0) nextCustomFields[field.key] = values;
      else delete nextCustomFields[field.key];
      continue;
    }

    const raw = formData.get(field.key);
    if (raw === null || raw === "") {
      delete nextCustomFields[field.key];
      continue;
    }
    if (field.fieldType === "boolean") {
      nextCustomFields[field.key] = raw === "true";
    } else if (field.fieldType === "number") {
      const num = Number(raw);
      if (!Number.isNaN(num)) nextCustomFields[field.key] = num;
    } else {
      nextCustomFields[field.key] = String(raw);
    }
  }

  await db
    .update(leads)
    .set({ customFields: nextCustomFields, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.orgId, session.user.orgId)));

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: "updated",
    payload: { section: "qualification_data" },
  });

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { success: true };
}

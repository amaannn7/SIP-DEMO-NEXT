"use server";

import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { icpFields, orgSettings, icpFieldTypeEnum, type IcpFieldOption } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { z } from "zod";

const weightSchema = z.coerce.number().int().min(0).max(100);
const thresholdSchema = z.coerce.number().int().min(0).max(100);

export async function updateIcpFieldWeightAction(fieldId: string, formData: FormData): Promise<void> {
  const session = await requireRole("admin");
  const parsed = weightSchema.safeParse(formData.get("weight"));
  if (!parsed.success) return;

  await db
    .update(icpFields)
    .set({ weight: parsed.data, updatedAt: new Date() })
    .where(and(eq(icpFields.id, fieldId), eq(icpFields.orgId, session.user.orgId)));

  revalidatePath("/admin/settings");
}

/**
 * Toggles a single option's isIdeal or isDisqualifying flag in place —
 * lets an admin mark a specific answer as the top-priority signal or as an
 * automatic red flag, mirroring the source system's hardcoded
 * ideal-segment/disqualifier rules without hardcoding any field names.
 */
export async function updateIcpOptionFlagAction(
  fieldId: string,
  optionValue: string,
  flag: "isIdeal" | "isDisqualifying",
  value: boolean,
): Promise<void> {
  const session = await requireRole("admin");
  const field = await db.query.icpFields.findFirst({
    where: and(eq(icpFields.id, fieldId), eq(icpFields.orgId, session.user.orgId)),
  });
  if (!field || !field.options) return;

  const updatedOptions: IcpFieldOption[] = field.options.map((option) =>
    option.value === optionValue ? { ...option, [flag]: value || undefined } : option,
  );

  await db.update(icpFields).set({ options: updatedOptions, updatedAt: new Date() }).where(eq(icpFields.id, fieldId));
  revalidatePath("/admin/settings");
}

export async function toggleIcpFieldEnabledAction(fieldId: string, isEnabled: boolean): Promise<void> {
  const session = await requireRole("admin");
  await db
    .update(icpFields)
    .set({ isEnabled, updatedAt: new Date() })
    .where(and(eq(icpFields.id, fieldId), eq(icpFields.orgId, session.user.orgId)));

  revalidatePath("/admin/settings");
}

export async function deleteIcpFieldAction(fieldId: string): Promise<void> {
  const session = await requireRole("admin");
  await db.delete(icpFields).where(and(eq(icpFields.id, fieldId), eq(icpFields.orgId, session.user.orgId)));
  revalidatePath("/admin/settings");
}

const createIcpFieldSchema = z.object({
  label: z.string().trim().min(1, "Question is required").max(200),
  subtitle: z.string().trim().max(300).optional().default(""),
  fieldType: z.enum(icpFieldTypeEnum.enumValues),
  weight: z.coerce.number().int().min(0).max(100),
  // One option per line as "Label" — each earns an equal fraction of the
  // field's weight; the admin can rebalance individual option weights later
  // if some options should count for more than others.
  optionLines: z.array(z.string().trim().min(1)).optional().default([]),
});

export type CreateIcpFieldState = { error?: string };

/** Ports the source system's add-req-form: a new qualification question with its own options, appended after the existing fields. */
export async function createIcpFieldAction(_prevState: CreateIcpFieldState, formData: FormData): Promise<CreateIcpFieldState> {
  const session = await requireRole("admin");

  const optionLines = String(formData.get("options") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = createIcpFieldSchema.safeParse({
    label: formData.get("label"),
    subtitle: formData.get("subtitle") ?? undefined,
    fieldType: formData.get("fieldType"),
    weight: formData.get("weight"),
    optionLines,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.fieldType !== "text" && parsed.data.optionLines.length === 0) {
    return { error: "Add at least one option" };
  }

  const options: IcpFieldOption[] | null =
    parsed.data.fieldType === "text"
      ? null
      : parsed.data.optionLines.map((label, i) => ({
          value: `opt_${i}`,
          label,
          weight: Math.round((1 / parsed.data.optionLines.length) * 100) / 100,
        }));

  const key = `custom_${Date.now().toString(36)}`;
  const [maxSort] = await db
    .select({ max: sql<number>`coalesce(max(${icpFields.sortOrder}), 0)::int` })
    .from(icpFields)
    .where(eq(icpFields.orgId, session.user.orgId));

  await db.insert(icpFields).values({
    orgId: session.user.orgId,
    key,
    label: parsed.data.label,
    subtitle: parsed.data.subtitle || null,
    fieldType: parsed.data.fieldType,
    options,
    weight: parsed.data.weight,
    sortOrder: (maxSort?.max ?? 0) + 1,
  });

  revalidatePath("/admin/settings");
  return {};
}

export async function updateThresholdsAction(_prevState: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const session = await requireRole("admin");

  const a = thresholdSchema.safeParse(formData.get("gradeAThreshold"));
  const b = thresholdSchema.safeParse(formData.get("gradeBThreshold"));
  const c = thresholdSchema.safeParse(formData.get("gradeCThreshold"));

  if (!a.success || !b.success || !c.success) {
    return { error: "Thresholds must be numbers between 0 and 100" };
  }
  if (!(a.data > b.data && b.data > c.data)) {
    return { error: "Thresholds must be in descending order: A > B > C" };
  }

  await db
    .insert(orgSettings)
    .values({
      orgId: session.user.orgId,
      fitGradeAThreshold: a.data,
      fitGradeBThreshold: b.data,
      fitGradeCThreshold: c.data,
    })
    .onConflictDoUpdate({
      target: orgSettings.orgId,
      set: {
        fitGradeAThreshold: a.data,
        fitGradeBThreshold: b.data,
        fitGradeCThreshold: c.data,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/admin/settings");
  return {};
}

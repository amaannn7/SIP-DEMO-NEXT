"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { leadInputSchema, leadUpdateSchema } from "@/lib/validation/leads";
import { logLeadActivity, leadIdsBelongToOrg } from "@/lib/db/queries/leads";
import { recomputeAndSaveLeadScores } from "@/lib/scoring/apply";
import { initialStageForSource } from "@/lib/leads/initial-stage";

export type LeadFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const LEAD_FORM_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "title",
  "industry",
  "country",
  "website",
  "linkedin",
  "companySize",
  "notes",
  "callAnchor",
  "source",
  "sourceDetail",
  "stage",
] as const;

// Only includes keys actually present in the FormData — a field this form
// never asked for reads as "not provided" (leaves the column untouched) via
// Zod's .partial(), not as "clear it" the way formData.get()'s null would.
// This is what makes single-field inline-edit submits safe: a FormData with
// just { firstName } won't wipe every other column on the lead.
function parseLeadForm(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of LEAD_FORM_FIELDS) {
    if (formData.has(field)) {
      result[field] = formData.get(field);
    }
  }
  return result;
}

export async function createLeadAction(_prevState: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const session = await requireAuth();
  const parsed = leadInputSchema.safeParse(parseLeadForm(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  if (!parsed.data.email && !parsed.data.phone && !parsed.data.company) {
    return { error: "Provide at least an email, phone, or company" };
  }

  const now = new Date();
  // "Use source default" (the form's blank Initial Stage option) resolves
  // here rather than falling through to the new_lead column default —
  // an inbound lead has already reached out, so it starts past cold
  // outreach at call_attempted.
  const stage = parsed.data.stage ?? initialStageForSource(parsed.data.source);

  const [lead] = await db
    .insert(leads)
    .values({
      orgId: session.user.orgId,
      ownerId: session.user.id,
      lastActivityAt: now,
      ...parsed.data,
      stage,
    })
    .returning({ id: leads.id });

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId: lead.id,
    actorId: session.user.id,
    type: "created",
    payload: { source: parsed.data.source },
  });

  await recomputeAndSaveLeadScores(session.user.orgId, lead.id);

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

/** Same owner-or-admin scoping emptyTrashAction/bulkDeleteLeadsAction already use — a rep can only act on their own leads, an admin/super_admin on any lead in the org. */
function leadOwnershipCondition(session: Awaited<ReturnType<typeof requireAuth>>, leadId: string) {
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  const conditions = [eq(leads.id, leadId), eq(leads.orgId, session.user.orgId)];
  if (!isAdmin) conditions.push(eq(leads.ownerId, session.user.id));
  return and(...conditions);
}

export async function updateLeadAction(leadId: string, _prevState: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const session = await requireAuth();
  const stage = formData.get("stage");
  const parsed = leadUpdateSchema.safeParse({
    ...parseLeadForm(formData),
    stage: stage || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const [existing] = await db
    .select({ stage: leads.stage })
    .from(leads)
    .where(leadOwnershipCondition(session, leadId));

  if (!existing) {
    return { error: "Lead not found" };
  }

  const isStageChange = Boolean(parsed.data.stage && parsed.data.stage !== existing.stage);

  await db
    .update(leads)
    .set({ ...parsed.data, lastActivityAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: isStageChange ? "stage_changed" : "updated",
    payload: isStageChange ? { from: existing.stage, to: parsed.data.stage } : {},
  });

  await recomputeAndSaveLeadScores(session.user.orgId, leadId);

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return {};
}

export async function softDeleteLeadAction(leadId: string): Promise<void> {
  const session = await requireAuth();
  const [result] = await db
    .update(leads)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(leadOwnershipCondition(session, leadId))
    .returning({ id: leads.id });
  if (!result) return;

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: "deleted",
  });

  revalidatePath("/leads");
}

export async function restoreLeadAction(leadId: string): Promise<void> {
  const session = await requireAuth();
  const [result] = await db
    .update(leads)
    .set({ isDeleted: false, deletedAt: null })
    .where(leadOwnershipCondition(session, leadId))
    .returning({ id: leads.id });
  if (!result) return;

  await logLeadActivity({
    orgId: session.user.orgId,
    leadId,
    actorId: session.user.id,
    type: "restored",
  });

  revalidatePath("/leads");
}

/** Ports the source system's permanent-delete: only allowed on a lead already in trash. */
export async function permanentDeleteLeadAction(leadId: string): Promise<void> {
  const session = await requireAuth();
  await db.delete(leads).where(and(leadOwnershipCondition(session, leadId), eq(leads.isDeleted, true)));
  revalidatePath("/leads");
}

/** Ports the source system's empty-trash: purges every soft-deleted lead the caller can see (own leads for a rep, org-wide for a manager). */
export async function emptyTrashAction(): Promise<void> {
  const session = await requireAuth();
  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  const scopeConditions = [eq(leads.orgId, session.user.orgId), eq(leads.isDeleted, true)];
  if (!isAdmin) {
    scopeConditions.push(eq(leads.ownerId, session.user.id));
  }
  await db.delete(leads).where(and(...scopeConditions));
  revalidatePath("/leads");
}

export async function bulkDeleteLeadsAction(leadIds: string[]): Promise<void> {
  const session = await requireAuth();
  const validIds = await leadIdsBelongToOrg(session.user.orgId, leadIds);
  if (validIds.length === 0) return;

  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  const scopeConditions = [eq(leads.orgId, session.user.orgId), inArray(leads.id, validIds)];
  if (!isAdmin) {
    scopeConditions.push(eq(leads.ownerId, session.user.id));
  }

  await db
    .update(leads)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(and(...scopeConditions));

  revalidatePath("/leads");
}

export async function reassignLeadAction(leadId: string, newOwnerId: string): Promise<void> {
  const session = await requireRole("admin");
  await db
    .update(leads)
    .set({ ownerId: newOwnerId, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.orgId, session.user.orgId)));

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

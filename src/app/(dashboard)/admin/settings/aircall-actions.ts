"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import {
  saveAircallCredentials,
  saveAircallWebhookToken,
  setAircallEnabled,
  saveScoringSettings,
  getAircallCredentials,
} from "@/lib/db/queries/aircall-settings";
import { pingAircall, dialLead } from "@/lib/aircall/client";
import { db } from "@/lib/db";
import { leads, users, aircallSettings, llmProviderEnum } from "@/lib/db/schema";
import { normalizeToE164 } from "@/lib/leads/phone";
import { logLeadActivity, assertLeadWriteAccess } from "@/lib/db/queries/leads";

const credentialsSchema = z.object({
  apiId: z.string().trim().min(1, "API ID is required"),
  apiToken: z.string().trim().min(1, "API Token is required"),
});

export type AircallSettingsState = { error?: string };

export async function saveAircallCredentialsAction(_prevState: AircallSettingsState, formData: FormData): Promise<AircallSettingsState> {
  const session = await requireRole("super_admin");
  const parsed = credentialsSchema.safeParse({ apiId: formData.get("apiId"), apiToken: formData.get("apiToken") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await saveAircallCredentials(session.user.orgId, parsed.data.apiId, parsed.data.apiToken);
  revalidatePath("/admin/settings");
  return {};
}

/** Generates a random webhook token server-side rather than accepting a rep-typed one — matches the settings card's "Generate" button, not a free-text field. */
export async function generateAircallWebhookTokenAction(): Promise<{ error?: string }> {
  const session = await requireRole("super_admin");
  const token = randomBytes(24).toString("hex");
  await saveAircallWebhookToken(session.user.orgId, token);
  revalidatePath("/admin/settings");
  return {};
}

export async function setAircallEnabledAction(isEnabled: boolean): Promise<void> {
  const session = await requireRole("super_admin");
  await setAircallEnabled(session.user.orgId, isEnabled);
  revalidatePath("/admin/settings");
}

const scoringSchema = z.object({
  scoringEnabled: z.boolean(),
  scoringProvider: z.enum(llmProviderEnum.enumValues),
  minCallDurationSeconds: z.number().int().min(0).max(3600),
  minTranscriptConfidence: z.number().min(0).max(1),
});

export async function saveScoringSettingsAction(input: z.infer<typeof scoringSchema>): Promise<AircallSettingsState> {
  const session = await requireRole("super_admin");
  const parsed = scoringSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  await saveScoringSettings(session.user.orgId, parsed.data);
  revalidatePath("/admin/settings");
  return {};
}

export async function testAircallConnectionAction(): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole("super_admin");
  const creds = await getAircallCredentials(session.user.orgId);
  if (!creds) return { success: false, error: "No credentials saved yet" };
  return pingAircall(creds.apiId, creds.apiToken);
}

/**
 * Ports the source system's aircall-dial side effects (minus the actual
 * dial's own stage advance, which happens on call.ended via the webhook, not
 * here — matches the source system's explicit "only call.ended knows if a
 * call genuinely happened" comment). This just triggers the ring.
 */
export async function dialLeadViaAircallAction(leadId: string): Promise<{ error?: string }> {
  const session = await requireRole("rep");

  const lead = await assertLeadWriteAccess(session, leadId);
  if (!lead) return { error: "Lead not found" };
  if (!lead.phone) return { error: "This lead has no phone number" };

  const [user] = await db
    .select({ aircallUserId: users.aircallUserId, aircallNumberId: users.aircallNumberId })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user?.aircallUserId || !user.aircallNumberId) {
    return { error: "Your account isn't linked to Aircall yet. Ask an admin to link it on the Users page." };
  }

  const settings = await db.query.aircallSettings.findFirst({ where: eq(aircallSettings.orgId, session.user.orgId) });
  if (!settings?.isEnabled) return { error: "Aircall isn't enabled for this organization" };

  const creds = await getAircallCredentials(session.user.orgId);
  if (!creds) return { error: "Aircall isn't configured for this organization" };

  const e164 = normalizeToE164(lead.phone);
  if (!e164) return { error: "Couldn't parse this lead's phone number" };

  const result = await dialLead(creds.apiId, creds.apiToken, user.aircallUserId, user.aircallNumberId, e164);
  if (!result.success) return { error: result.error };

  // Ports the source system's aircall-dial exactly: the dial click itself
  // only bumps the stage (from these 3 starting stages) — it does NOT
  // increment callsMadeCount or write a call log, since dialing doesn't mean
  // the call actually happened. Only the webhook's call.ended event (which
  // knows whether it was answered) does that.
  const advancesStage = lead.stage === "new_lead" || lead.stage === "research" || lead.stage === "email_sent";
  if (advancesStage) {
    await db.update(leads).set({ stage: "call_attempted", lastActivityAt: new Date() }).where(eq(leads.id, leadId));
  }

  await logLeadActivity({ orgId: session.user.orgId, leadId, actorId: session.user.id, type: "call_started", payload: { via: "aircall" } });
  revalidatePath(`/leads/${leadId}`);
  return {};
}

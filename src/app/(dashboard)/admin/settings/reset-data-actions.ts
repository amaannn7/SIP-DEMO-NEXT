"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, chatConversations, activityPings, notifications, dailyCommitments, dailyPerformance, jobRuns } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { createChannel } from "@/lib/db/queries/chat-channels";

const CONFIRM_PHRASE = "WIPE ALL DATA";

export type ResetOrgDataState = { error?: string; message?: string };

/**
 * Ports the source system's reset-all-data super-admin "UAT reset" exactly:
 * an exact-match typed confirmation phrase gate (server-side only, no
 * trimming/case-folding — the client can send whatever was typed and this is
 * the sole authority), wiping leads/chat/activity/notifications for a fresh
 * test cycle while leaving user accounts, My Context, and admin config
 * (API keys, ICP fields, org settings/daily-target defaults) untouched.
 *
 * One deliberate deviation from the source: it had no org concept at all and
 * wiped its single shared install; this app is multi-org, so every delete is
 * scoped to the caller's own org rather than every org in the deployment.
 */
export async function resetOrgDataAction(confirmPhrase: string): Promise<ResetOrgDataState> {
  const session = await requireRole("super_admin");

  if (confirmPhrase !== CONFIRM_PHRASE) {
    return { error: `Confirmation phrase required: type ${CONFIRM_PHRASE}` };
  }

  const orgId = session.user.orgId;

  await db.transaction(async (tx) => {
    // Deleting leads cascades to lead_activity, enrichment_results,
    // email_history, call_pitches, call_logs, and lead-linked notifications
    // automatically (all onDelete: cascade FKs) — no explicit deletes needed
    // for those.
    await tx.delete(leads).where(eq(leads.orgId, orgId));
    // Deleting conversations cascades to chat_messages, chat_conversation_members,
    // and (via messages) chat_message_reactions.
    await tx.delete(chatConversations).where(eq(chatConversations.orgId, orgId));
    await tx.delete(activityPings).where(eq(activityPings.orgId, orgId));
    await tx.delete(notifications).where(eq(notifications.orgId, orgId));
    // Accumulated test activity, not config — daily_targets (quota config,
    // including per-rep overrides) is intentionally left alone, same as the
    // source system leaves admin config untouched.
    await tx.delete(dailyCommitments).where(eq(dailyCommitments.orgId, orgId));
    await tx.delete(dailyPerformance).where(eq(dailyPerformance.orgId, orgId));
    await tx.delete(jobRuns).where(eq(jobRuns.orgId, orgId));
  });

  // Re-seed a default #general channel, matching the source system's comment
  // that chat channels "re-seed to just #general/#deals" after a wipe.
  await createChannel(orgId, session.user.id, { name: "general", description: "", isPrivate: false, memberIds: [] });

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/chat");
  revalidatePath("/workbench");

  return { message: "All leads, chat, and activity data cleared. User accounts and settings were kept." };
}

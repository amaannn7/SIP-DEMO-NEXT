import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, leads } from "@/lib/db/schema";
import { generateNotifications, type NotificationLeadInput } from "@/lib/notifications/generate";
import { calculateDaysSinceActivity } from "@/lib/scoring/days-since-activity";

const LIST_LIMIT = 50;

/**
 * Ports the source system's generate-notifications endpoint: scoped to the
 * calling rep's own active leads (managers get their own personal set, same
 * as the source system — this is a per-rep worklist alert, not an org feed).
 * Dedup is now a real unique index (userId, dedupeKey) rather than an
 * in-app check against unread rows, so a concurrent double-call can't
 * double-insert.
 */
export async function generateAndSaveNotifications(orgId: string, userId: string, now: Date = new Date()) {
  const [activeLeads, existing] = await Promise.all([
    db.query.leads.findMany({
      where: and(eq(leads.orgId, orgId), eq(leads.ownerId, userId), eq(leads.isDeleted, false)),
    }),
    db.query.notifications.findMany({ where: eq(notifications.userId, userId), columns: { dedupeKey: true } }),
  ]);

  const input: NotificationLeadInput[] = activeLeads.map((lead) => ({
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    stage: lead.stage,
    temperature: lead.temperature,
    followupDate: lead.followupDate,
    daysSinceActivity: calculateDaysSinceActivity(
      { lastActivityAt: lead.lastActivityAt, followupDate: lead.followupDate, createdAt: lead.createdAt },
      now,
    ),
  }));

  const existingKeys = new Set(existing.map((n) => n.dedupeKey));
  const generated = generateNotifications(input, existingKeys, now);
  if (generated.length === 0) return 0;

  await db
    .insert(notifications)
    .values(
      generated.map((n) => ({
        orgId,
        userId,
        leadId: n.leadId,
        dedupeKey: n.dedupeKey,
        type: n.type,
        title: n.title,
        body: n.body,
      })),
    )
    .onConflictDoNothing();

  return generated.length;
}

export async function listNotifications(userId: string) {
  return db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: desc(notifications.createdAt),
    limit: LIST_LIMIT,
  });
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const rows = await db.query.notifications.findMany({
    where: and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    columns: { id: true },
  });
  return rows.length;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: string) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function dismissNotification(userId: string, notificationId: string) {
  await db.delete(notifications).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function dismissAllNotifications(userId: string) {
  await db.delete(notifications).where(eq(notifications.userId, userId));
}

/**
 * Ports the source system's notifyChatMentions(): fires a targeted
 * notification for each org member whose name is @mentioned in a channel
 * message. Deduped per (recipient, message) via the unique dedupeKey, same
 * mechanism as the lead-based notification types above.
 */
export async function createChatMentionNotification(params: {
  orgId: string;
  recipientUserId: string;
  chatConversationId: string;
  senderName: string;
  conversationLabel: string;
  messageId: string;
  bodyPreview: string;
}) {
  await db
    .insert(notifications)
    .values({
      orgId: params.orgId,
      userId: params.recipientUserId,
      chatConversationId: params.chatConversationId,
      dedupeKey: `chat_mention_${params.messageId}_${params.recipientUserId}`,
      type: "chat_mention",
      title: `${params.senderName} mentioned you in ${params.conversationLabel}`,
      body: params.bodyPreview,
    })
    .onConflictDoNothing();
}

/**
 * Ports the source system's log_call_outcome chat notification — fired when
 * an Aircall call ends, nudging the rep who took the call to log its
 * outcome (the webhook only knows the call happened, not what came of it).
 */
export async function createCallOutcomePendingNotification(params: {
  orgId: string;
  recipientUserId: string;
  leadId: string;
  leadName: string;
  callLogId: string;
}) {
  await db
    .insert(notifications)
    .values({
      orgId: params.orgId,
      userId: params.recipientUserId,
      leadId: params.leadId,
      dedupeKey: `call_outcome_pending_${params.callLogId}`,
      type: "call_outcome_pending",
      title: `Log the outcome of your call with ${params.leadName}`,
      body: "The call just ended. Log what happened to keep this lead's pipeline accurate.",
    })
    .onConflictDoNothing();
}

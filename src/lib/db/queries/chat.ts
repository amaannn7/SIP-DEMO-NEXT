import "server-only";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatConversationMembers, chatConversations, chatMessageReactions, chatMessages, users } from "@/lib/db/schema";

export type ConversationSummary = {
  id: string;
  kind: "channel" | "dm";
  name: string | null;
  description: string | null;
  isPrivate: boolean;
  otherUser: { id: string; displayName: string; avatarUrl: string | null } | null;
  unreadCount: number;
  lastMessage: { body: string; senderName: string; createdAt: Date } | null;
};

/** Every conversation the user can see: public channels, private channels they're a member of, and DMs they're a party to. */
export async function listConversationsForUser(orgId: string, userId: string): Promise<ConversationSummary[]> {
  const memberships = await db.query.chatConversationMembers.findMany({
    where: eq(chatConversationMembers.userId, userId),
  });
  const memberConversationIds = memberships.map((m) => m.conversationId);
  const lastReadByConversation = new Map(memberships.map((m) => [m.conversationId, m.lastReadAt]));

  const visible = await db.query.chatConversations.findMany({
    where: and(
      eq(chatConversations.orgId, orgId),
      memberConversationIds.length > 0
        ? sql`(${chatConversations.isPrivate} = false OR ${inArray(chatConversations.id, memberConversationIds)})`
        : eq(chatConversations.isPrivate, false),
    ),
    with: {
      members: { with: { user: { columns: { id: true, displayName: true, avatarUrl: true } } } },
    },
  });

  // DMs are always private and membership-gated — the OR above only surfaces
  // a DM row if the user is already a member, so no extra filtering needed.
  const dms = visible.filter((c) => c.kind === "dm");
  const channels = visible.filter((c) => c.kind === "channel");
  const relevant = [...channels, ...dms.filter((c) => memberConversationIds.includes(c.id))];

  if (relevant.length === 0) return [];

  const [lastMessages, unreadRows] = await Promise.all([
    getLastMessagePerConversation(relevant.map((c) => c.id)),
    getUnreadCounts(
      relevant.map((c) => c.id),
      userId,
      lastReadByConversation,
    ),
  ]);

  return relevant.map((c) => {
    const otherMember = c.kind === "dm" ? c.members.find((m) => m.userId !== userId)?.user : undefined;
    return {
      id: c.id,
      kind: c.kind,
      name: c.name,
      description: c.description,
      isPrivate: c.isPrivate,
      otherUser: otherMember ? { id: otherMember.id, displayName: otherMember.displayName, avatarUrl: otherMember.avatarUrl } : null,
      unreadCount: unreadRows.get(c.id) ?? 0,
      lastMessage: lastMessages.get(c.id) ?? null,
    };
  });
}

async function getLastMessagePerConversation(conversationIds: string[]) {
  if (conversationIds.length === 0) return new Map();
  const rows = await db
    .select({
      conversationId: chatMessages.conversationId,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      senderName: users.displayName,
      // Cast to int — row_number() is bigint in Postgres, which postgres.js
      // deserializes as a string (to avoid precision loss on large values),
      // so an uncast `row.rn === 1` here would never match.
      rn: sql<number>`(row_number() over (partition by ${chatMessages.conversationId} order by ${chatMessages.createdAt} desc))::int`.as("rn"),
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.senderId))
    .where(and(inArray(chatMessages.conversationId, conversationIds), isNull(chatMessages.deletedAt)));

  const map = new Map<string, { body: string; senderName: string; createdAt: Date }>();
  for (const row of rows) {
    if (row.rn === 1) map.set(row.conversationId, { body: row.body, senderName: row.senderName, createdAt: row.createdAt });
  }
  return map;
}

const EPOCH = new Date(0);

/**
 * One query for every conversation's unread count, each compared against its
 * own last-read watermark — a VALUES join carrying the per-conversation
 * threshold, rather than N+1 individual queries or an in-JS filter pass.
 */
async function getUnreadCounts(conversationIds: string[], userId: string, lastReadByConversation: Map<string, Date | null>) {
  if (conversationIds.length === 0) return new Map<string, number>();

  const thresholds = conversationIds.map((id) => sql`(${id}::uuid, ${(lastReadByConversation.get(id) ?? EPOCH).toISOString()}::timestamptz)`);

  const rows = await db.execute<{ conversation_id: string; count: number }>(sql`
    select t.conversation_id, count(m.id)::int as count
    from (values ${sql.join(thresholds, sql`, `)}) as t(conversation_id, last_read_at)
    left join ${chatMessages} as m
      on m.conversation_id = t.conversation_id
      and m.deleted_at is null
      and m.sender_id != ${userId}
      and m.created_at > t.last_read_at
    group by t.conversation_id
  `);

  return new Map(rows.map((row) => [row.conversation_id, row.count]));
}

export async function getTotalUnreadCount(orgId: string, userId: string): Promise<number> {
  const conversations = await listConversationsForUser(orgId, userId);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

export async function isConversationMember(conversationId: string, userId: string): Promise<boolean> {
  const row = await db.query.chatConversationMembers.findFirst({
    where: and(eq(chatConversationMembers.conversationId, conversationId), eq(chatConversationMembers.userId, userId)),
  });
  return row !== undefined;
}

/** Public channels don't require a membership row to read/post — anyone in the org can. Private channels and DMs do. */
export async function canAccessConversation(orgId: string, conversationId: string, userId: string): Promise<boolean> {
  const conversation = await db.query.chatConversations.findFirst({
    where: and(eq(chatConversations.id, conversationId), eq(chatConversations.orgId, orgId)),
  });
  if (!conversation) return false;
  if (conversation.kind === "channel" && !conversation.isPrivate) return true;
  return isConversationMember(conversationId, userId);
}

export async function getOrCreateDmConversation(orgId: string, userAId: string, userBId: string) {
  const existing = await db
    .select({ conversationId: chatConversationMembers.conversationId })
    .from(chatConversationMembers)
    .innerJoin(chatConversations, eq(chatConversations.id, chatConversationMembers.conversationId))
    .where(and(eq(chatConversations.orgId, orgId), eq(chatConversations.kind, "dm"), eq(chatConversationMembers.userId, userAId)));

  const candidateIds = existing.map((r) => r.conversationId);
  if (candidateIds.length > 0) {
    const match = await db
      .select({ conversationId: chatConversationMembers.conversationId })
      .from(chatConversationMembers)
      .where(and(inArray(chatConversationMembers.conversationId, candidateIds), eq(chatConversationMembers.userId, userBId)));
    if (match[0]) return match[0].conversationId;
  }

  return db.transaction(async (tx) => {
    const [conversation] = await tx.insert(chatConversations).values({ orgId, kind: "dm", isPrivate: true }).returning({ id: chatConversations.id });
    await tx.insert(chatConversationMembers).values([
      { conversationId: conversation.id, userId: userAId },
      { conversationId: conversation.id, userId: userBId },
    ]);
    return conversation.id;
  });
}

export async function listMessages(conversationId: string, before?: Date) {
  const rows = await db.query.chatMessages.findMany({
    where: and(eq(chatMessages.conversationId, conversationId), before ? sql`${chatMessages.createdAt} < ${before}` : undefined),
    orderBy: desc(chatMessages.createdAt),
    limit: 50,
    with: {
      sender: { columns: { id: true, displayName: true, avatarUrl: true } },
      reactions: { with: { user: { columns: { id: true, displayName: true } } } },
      replyTo: { columns: { id: true, body: true, deletedAt: true }, with: { sender: { columns: { displayName: true } } } },
    },
  });
  return rows.reverse();
}

export async function getPinnedMessage(conversationId: string) {
  return db.query.chatMessages.findFirst({
    where: and(eq(chatMessages.conversationId, conversationId), sql`${chatMessages.pinnedAt} is not null`),
    with: { sender: { columns: { id: true, displayName: true } }, pinner: { columns: { id: true, displayName: true } } },
  });
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachment?: { key: string; name: string; type: string; size: number },
  replyToId?: string | null,
) {
  const [message] = await db
    .insert(chatMessages)
    .values({
      conversationId,
      senderId,
      body,
      attachmentKey: attachment?.key,
      attachmentName: attachment?.name,
      attachmentType: attachment?.type,
      attachmentSize: attachment?.size,
      replyToId: replyToId ?? null,
    })
    .returning();
  const full = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, message.id),
    with: {
      sender: { columns: { id: true, displayName: true, avatarUrl: true } },
      reactions: true,
      replyTo: { columns: { id: true, body: true, deletedAt: true }, with: { sender: { columns: { displayName: true } } } },
    },
  });
  return full!;
}

/**
 * A public channel has no membership rows by design (see chatConversations —
 * null/empty members means "everyone in the org can see it"), so there's
 * nowhere to store a read watermark for it until someone actually reads it.
 * Upsert rather than update: the first read from a given user creates their
 * membership row on the spot, every read after that just bumps it.
 */
export async function markConversationRead(conversationId: string, userId: string) {
  await db
    .insert(chatConversationMembers)
    .values({ conversationId, userId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [chatConversationMembers.conversationId, chatConversationMembers.userId],
      set: { lastReadAt: new Date() },
    });
}

export async function deleteMessage(messageId: string) {
  await db.update(chatMessages).set({ deletedAt: new Date(), body: "" }).where(eq(chatMessages.id, messageId));
}

export async function editMessage(messageId: string, body: string) {
  await db.update(chatMessages).set({ body, editedAt: new Date() }).where(eq(chatMessages.id, messageId));
}

export async function togglePin(conversationId: string, messageId: string, userId: string, pin: boolean) {
  await db.transaction(async (tx) => {
    if (pin) {
      await tx
        .update(chatMessages)
        .set({ pinnedAt: null, pinnedBy: null })
        .where(and(eq(chatMessages.conversationId, conversationId), sql`${chatMessages.pinnedAt} is not null`));
      await tx.update(chatMessages).set({ pinnedAt: new Date(), pinnedBy: userId }).where(eq(chatMessages.id, messageId));
    } else {
      await tx.update(chatMessages).set({ pinnedAt: null, pinnedBy: null }).where(eq(chatMessages.id, messageId));
    }
  });
}

export async function toggleReaction(messageId: string, userId: string, emoji: string): Promise<"added" | "removed"> {
  const existing = await db.query.chatMessageReactions.findFirst({
    where: and(eq(chatMessageReactions.messageId, messageId), eq(chatMessageReactions.userId, userId), eq(chatMessageReactions.emoji, emoji)),
  });
  if (existing) {
    await db.delete(chatMessageReactions).where(eq(chatMessageReactions.id, existing.id));
    return "removed";
  }
  await db.insert(chatMessageReactions).values({ messageId, userId, emoji });
  return "added";
}

export async function getMessageConversationId(messageId: string): Promise<string | null> {
  const row = await db.query.chatMessages.findFirst({ where: eq(chatMessages.id, messageId), columns: { conversationId: true } });
  return row?.conversationId ?? null;
}

export async function getMessageForOwnershipCheck(messageId: string): Promise<{ conversationId: string; senderId: string } | null> {
  const row = await db.query.chatMessages.findFirst({
    where: eq(chatMessages.id, messageId),
    columns: { conversationId: true, senderId: true },
  });
  return row ?? null;
}

/** Everyone who could see a message in this conversation — the pool @mentions are matched against. */
export async function getConversationAudience(
  orgId: string,
  conversationId: string,
): Promise<{ id: string; displayName: string }[]> {
  const conversation = await db.query.chatConversations.findFirst({
    where: and(eq(chatConversations.id, conversationId), eq(chatConversations.orgId, orgId)),
  });
  if (!conversation) return [];

  if (conversation.kind === "channel" && !conversation.isPrivate) {
    return db.query.users.findMany({
      where: eq(users.orgId, orgId),
      columns: { id: true, displayName: true },
    });
  }

  const members = await db.query.chatConversationMembers.findMany({
    where: eq(chatConversationMembers.conversationId, conversationId),
    with: { user: { columns: { id: true, displayName: true } } },
  });
  return members.map((m) => m.user);
}

import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatConversationMembers, chatConversations } from "@/lib/db/schema";

export async function listChannels(orgId: string) {
  return db.query.chatConversations.findMany({
    where: and(eq(chatConversations.orgId, orgId), eq(chatConversations.kind, "channel")),
    with: { members: { with: { user: { columns: { id: true, displayName: true } } } } },
    orderBy: (c, { asc }) => asc(c.createdAt),
  });
}

export async function createChannel(
  orgId: string,
  createdBy: string,
  fields: { name: string; description: string; isPrivate: boolean; memberIds: string[] },
) {
  return db.transaction(async (tx) => {
    const [channel] = await tx
      .insert(chatConversations)
      .values({
        orgId,
        kind: "channel",
        name: fields.name,
        description: fields.description || null,
        isPrivate: fields.isPrivate,
        createdBy,
      })
      .returning();

    if (fields.isPrivate) {
      const memberIds = new Set([...fields.memberIds, createdBy]);
      await tx.insert(chatConversationMembers).values([...memberIds].map((userId) => ({ conversationId: channel.id, userId })));
    }
    return channel;
  });
}

export async function updateChannelMembers(conversationId: string, memberIds: string[], creatorId?: string) {
  await db.transaction(async (tx) => {
    await tx.delete(chatConversationMembers).where(eq(chatConversationMembers.conversationId, conversationId));
    const memberIds_ = creatorId ? [...new Set([...memberIds, creatorId])] : memberIds;
    if (memberIds_.length > 0) {
      await tx.insert(chatConversationMembers).values(memberIds_.map((userId) => ({ conversationId, userId })));
    }
  });
}

export async function deleteChannel(orgId: string, conversationId: string) {
  await db.delete(chatConversations).where(and(eq(chatConversations.id, conversationId), eq(chatConversations.orgId, orgId), eq(chatConversations.kind, "channel")));
}

export async function channelNameExists(orgId: string, name: string): Promise<boolean> {
  const row = await db.query.chatConversations.findFirst({
    where: and(eq(chatConversations.orgId, orgId), eq(chatConversations.name, name)),
  });
  return row !== undefined;
}

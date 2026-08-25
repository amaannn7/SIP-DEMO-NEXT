"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { chatConversations, users } from "@/lib/db/schema";
import { notifyChatEvent } from "@/lib/chat/notify";
import { findMentionedUserIds } from "@/lib/chat/mentions";
import { createChatMentionNotification } from "@/lib/db/queries/notifications";
import { uploadObject, getObjectSignedUrl } from "@/lib/storage/s3";
import {
  canAccessConversation,
  deleteMessage,
  editMessage,
  getConversationAudience,
  getMessageConversationId,
  getMessageForOwnershipCheck,
  getOrCreateDmConversation,
  markConversationRead,
  sendMessage,
  toggleReaction,
  togglePin,
} from "@/lib/db/queries/chat";
import { channelNameExists, createChannel, deleteChannel, updateChannelMembers } from "@/lib/db/queries/chat-channels";
import { createChannelSchema, reactionSchema, sendMessageSchema, updateChannelMembersSchema } from "@/lib/validation/chat";

export type ActionState = { error?: string };

export async function createChannelAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireRole("admin");

  const parsed = createChannelSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    isPrivate: formData.get("isPrivate") ?? undefined,
    memberIds: formData.getAll("memberIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid channel" };
  }

  if (await channelNameExists(session.user.orgId, parsed.data.name)) {
    return { error: "A channel with this name already exists" };
  }

  await createChannel(session.user.orgId, session.user.id, parsed.data);
  revalidatePath("/chat");
  return {};
}

export async function deleteChannelAction(conversationId: string): Promise<void> {
  const session = await requireRole("admin");
  await deleteChannel(session.user.orgId, conversationId);
  revalidatePath("/chat");
}

export async function updateChannelMembersAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = updateChannelMembersSchema.safeParse({
    conversationId: formData.get("conversationId"),
    memberIds: formData.getAll("memberIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  await updateChannelMembers(parsed.data.conversationId, parsed.data.memberIds);
  revalidatePath("/chat");
  return {};
}

export async function openDmAction(otherUserId: string): Promise<{ conversationId: string }> {
  const session = await requireAuth();
  const target = await db.query.users.findFirst({ where: eq(users.id, otherUserId) });
  if (!target || target.orgId !== session.user.orgId) {
    throw new Error("User not found");
  }
  const conversationId = await getOrCreateDmConversation(session.user.orgId, session.user.id, otherUserId);
  return { conversationId };
}

export async function sendMessageAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAuth();
  const parsed = sendMessageSchema.safeParse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
    replyToId: formData.get("replyToId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }

  const allowed = await canAccessConversation(session.user.orgId, parsed.data.conversationId, session.user.id);
  if (!allowed) {
    return { error: "You don't have access to this conversation" };
  }

  let replyToId: string | undefined;
  if (parsed.data.replyToId) {
    // A reply must point at a message in the same conversation — otherwise a
    // crafted replyToId could link a message into a thread the sender can't
    // even see.
    const targetConversationId = await getMessageConversationId(parsed.data.replyToId);
    if (targetConversationId === parsed.data.conversationId) replyToId = parsed.data.replyToId;
  }

  let attachment: { key: string; name: string; type: string; size: number } | undefined;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadChatAttachment(file);
    if ("error" in uploaded) return { error: uploaded.error };
    attachment = uploaded;
  }
  if (!parsed.data.body && !attachment) {
    return { error: "Message can't be empty" };
  }

  const message = await sendMessage(parsed.data.conversationId, session.user.id, parsed.data.body, attachment, replyToId);
  await markConversationRead(parsed.data.conversationId, session.user.id);

  const attachmentPayload = attachment
    ? { name: attachment.name, type: attachment.type, size: attachment.size, url: await getObjectSignedUrl(attachment.key) }
    : null;
  const replyToPayload = message.replyTo
    ? { id: message.replyTo.id, senderName: message.replyTo.sender.displayName, body: message.replyTo.deletedAt ? "Message deleted" : message.replyTo.body }
    : null;

  await notifyChatEvent({
    type: "message",
    conversationId: parsed.data.conversationId,
    orgId: session.user.orgId,
    message: {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.sender.displayName,
      senderAvatarUrl: message.sender.avatarUrl,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      attachment: attachmentPayload,
      replyTo: replyToPayload,
    },
  });

  await notifyMentions(session.user.orgId, parsed.data.conversationId, session.user.id, session.user.displayName, parsed.data.body, message.id);

  return {};
}

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

async function uploadChatAttachment(file: File): Promise<{ key: string; name: string; type: string; size: number } | { error: string }> {
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: "File too large (max 5MB)" };
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) return { error: "File type not allowed" };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = await uploadObject({ keyPrefix: "chat-attachments", fileName: file.name, contentType: file.type, body: buffer });
    return { key, name: file.name, type: file.type, size: file.size };
  } catch (err) {
    // Object storage being unreachable (MinIO/S3 down or misconfigured) must
    // surface as a normal composer error the user can read and retry from,
    // not an uncaught exception — an unhandled throw inside a Server Action
    // crashes the whole page (a Next.js "Server Components render" error
    // with the real message stripped in production), taking down every
    // other conversation and message on screen for something that's really
    // just "this one send failed."
    console.error("Chat attachment upload failed:", err);
    return { error: "Couldn't upload the attachment. Try again in a moment." };
  }
}

async function notifyMentions(
  orgId: string,
  conversationId: string,
  senderId: string,
  senderName: string,
  body: string,
  messageId: string,
): Promise<void> {
  if (!body.includes("@")) return;

  const conversation = await db.query.chatConversations.findFirst({ where: eq(chatConversations.id, conversationId) });
  // @mentions only make sense in channels, matching the source system —
  // a DM already has exactly one other recipient, so a mention adds nothing.
  if (!conversation || conversation.kind !== "channel") return;

  const audience = await getConversationAudience(orgId, conversationId);
  const mentionedIds = findMentionedUserIds(body, audience).filter((id) => id !== senderId);
  if (mentionedIds.length === 0) return;

  const conversationLabel = conversation.name ? `#${conversation.name}` : "a channel";
  await Promise.all(
    mentionedIds.map((recipientUserId) =>
      createChatMentionNotification({
        orgId,
        recipientUserId,
        chatConversationId: conversationId,
        senderName,
        conversationLabel,
        messageId,
        bodyPreview: body.slice(0, 140),
      }),
    ),
  );
}

export async function sendTypingAction(conversationId: string): Promise<void> {
  const session = await requireAuth();
  const allowed = await canAccessConversation(session.user.orgId, conversationId, session.user.id);
  if (!allowed) return;
  await notifyChatEvent({
    type: "typing",
    conversationId,
    orgId: session.user.orgId,
    userId: session.user.id,
    userName: session.user.displayName,
  });
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const session = await requireAuth();
  await markConversationRead(conversationId, session.user.id);
}

export async function deleteMessageAction(messageId: string): Promise<void> {
  const session = await requireAuth();
  const message = await getMessageForOwnershipCheck(messageId);
  if (!message) return;
  const allowed = await canAccessConversation(session.user.orgId, message.conversationId, session.user.id);
  if (!allowed) return;

  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  if (message.senderId !== session.user.id && !isAdmin) return;

  await deleteMessage(messageId);
  await notifyChatEvent({ type: "message_deleted", conversationId: message.conversationId, orgId: session.user.orgId, messageId });
}

export async function editMessageAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAuth();
  const messageId = String(formData.get("messageId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!messageId || !body) return { error: "Message can't be empty" };

  const message = await getMessageForOwnershipCheck(messageId);
  if (!message) return { error: "Message not found" };
  const allowed = await canAccessConversation(session.user.orgId, message.conversationId, session.user.id);
  if (!allowed) return { error: "Not authorized" };
  if (message.senderId !== session.user.id) return { error: "You can only edit your own messages" };

  await editMessage(messageId, body);
  await notifyChatEvent({ type: "message_edited", conversationId: message.conversationId, orgId: session.user.orgId, messageId, body });
  return {};
}

export async function toggleReactionAction(messageId: string, emoji: string): Promise<void> {
  const session = await requireAuth();
  const parsed = reactionSchema.safeParse({ messageId, emoji });
  if (!parsed.success) return;

  const conversationId = await getMessageConversationId(parsed.data.messageId);
  if (!conversationId) return;
  const allowed = await canAccessConversation(session.user.orgId, conversationId, session.user.id);
  if (!allowed) return;

  const action = await toggleReaction(parsed.data.messageId, session.user.id, parsed.data.emoji);
  await notifyChatEvent({
    type: "reaction",
    conversationId,
    orgId: session.user.orgId,
    messageId: parsed.data.messageId,
    emoji: parsed.data.emoji,
    userId: session.user.id,
    action,
  });
}

export async function togglePinAction(messageId: string, pin: boolean): Promise<void> {
  const session = await requireAuth();
  const conversationId = await getMessageConversationId(messageId);
  if (!conversationId) return;
  const allowed = await canAccessConversation(session.user.orgId, conversationId, session.user.id);
  if (!allowed) return;

  await togglePin(conversationId, messageId, session.user.id, pin);
  await notifyChatEvent({ type: "pin", conversationId, orgId: session.user.orgId, messageId, pinned: pin });
  revalidatePath("/chat");
}

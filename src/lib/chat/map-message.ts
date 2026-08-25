import { getObjectSignedUrl } from "@/lib/storage/s3";
import type { ChatMessage, ReactionGroup } from "@/components/chat/types";

type RawMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  pinnedAt: Date | null;
  attachmentKey: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentSize: number | null;
  sender: { id: string; displayName: string; avatarUrl: string | null };
  reactions: { emoji: string; userId: string }[];
  replyTo?: { id: string; body: string; deletedAt: Date | null; sender: { displayName: string } } | null;
};

export async function mapMessage(raw: RawMessage): Promise<ChatMessage> {
  const grouped = new Map<string, string[]>();
  for (const r of raw.reactions) {
    const list = grouped.get(r.emoji) ?? [];
    list.push(r.userId);
    grouped.set(r.emoji, list);
  }
  const reactions: ReactionGroup[] = [...grouped.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));

  // getObjectSignedUrl talks to S3/MinIO — if that's unreachable, one old
  // message with an attachment must not take down the entire message list
  // fetch for the whole conversation (every message here is mapped in the
  // same Promise.all in the /api/chat/messages route). Render the message
  // with its attachment metadata intact but no working link rather than
  // failing to load the conversation at all.
  let attachment: ChatMessage["attachment"] = null;
  if (raw.attachmentKey && raw.attachmentName && raw.attachmentType && raw.attachmentSize !== null) {
    try {
      const url = await getObjectSignedUrl(raw.attachmentKey);
      attachment = { name: raw.attachmentName, type: raw.attachmentType, size: raw.attachmentSize, url };
    } catch (err) {
      console.error("Failed to get signed URL for chat attachment:", err);
      attachment = { name: raw.attachmentName, type: raw.attachmentType, size: raw.attachmentSize, url: "" };
    }
  }

  const replyTo = raw.replyTo
    ? { id: raw.replyTo.id, senderName: raw.replyTo.sender.displayName, body: raw.replyTo.deletedAt ? "Message deleted" : raw.replyTo.body }
    : null;

  return {
    id: raw.id,
    conversationId: raw.conversationId,
    senderId: raw.senderId,
    senderName: raw.sender.displayName,
    senderAvatarUrl: raw.sender.avatarUrl,
    body: raw.body,
    createdAt: raw.createdAt.toISOString(),
    editedAt: raw.editedAt?.toISOString() ?? null,
    deletedAt: raw.deletedAt?.toISOString() ?? null,
    pinnedAt: raw.pinnedAt?.toISOString() ?? null,
    reactions,
    attachment,
    replyTo,
  };
}

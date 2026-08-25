export type ChatMessagePayload = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
  attachment: { name: string; type: string; size: number; url: string } | null;
  replyTo: { id: string; senderName: string; body: string } | null;
};

export type ChatEvent =
  | { type: "message"; conversationId: string; orgId: string; message: ChatMessagePayload }
  | { type: "message_deleted"; conversationId: string; orgId: string; messageId: string }
  | { type: "message_edited"; conversationId: string; orgId: string; messageId: string; body: string }
  // "action" + full reaction-group snapshot for that emoji lets a client
  // patch its cache directly (toggle one user in/out of one emoji's list)
  // instead of refetching the whole message list on every reaction click.
  | { type: "reaction"; conversationId: string; orgId: string; messageId: string; emoji: string; userId: string; action: "added" | "removed" }
  | { type: "pin"; conversationId: string; orgId: string; messageId: string; pinned: boolean }
  // Ephemeral — never persisted, just relayed live to whoever has the thread open.
  | { type: "typing"; conversationId: string; orgId: string; userId: string; userName: string };

export const CHAT_NOTIFY_CHANNEL = "chat_events";

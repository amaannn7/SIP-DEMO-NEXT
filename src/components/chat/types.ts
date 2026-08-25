export type ConversationListItem = {
  id: string;
  kind: "channel" | "dm";
  name: string | null;
  description: string | null;
  isPrivate: boolean;
  otherUser: { id: string; displayName: string; avatarUrl: string | null } | null;
  unreadCount: number;
  lastMessage: { body: string; senderName: string; createdAt: Date } | null;
};

export type ChatUser = { id: string; displayName: string; avatarUrl: string | null };

export type ChannelSummary = {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  memberIds: string[];
};

export type ReactionGroup = { emoji: string; userIds: string[] };

export type ChatAttachment = { name: string; type: string; size: number; url: string };

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinnedAt?: string | null;
  reactions: ReactionGroup[];
  attachment?: ChatAttachment | null;
  pending?: boolean;
  replyTo?: { id: string; senderName: string; body: string } | null;
};

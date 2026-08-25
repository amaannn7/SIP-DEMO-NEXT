import { z } from "zod";

const CHANNEL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;

export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Channel name is required")
    .regex(CHANNEL_NAME_PATTERN, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().max(200).optional().default(""),
  isPrivate: z.coerce.boolean().optional().default(false),
  memberIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateChannelMembersSchema = z.object({
  conversationId: z.string().uuid(),
  memberIds: z.array(z.string().uuid()),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  // Empty is allowed here — an attachment-only message (no caption) is valid,
  // same as the source system's chat-upload. sendMessageAction rejects the
  // combination of empty body + no attachment itself.
  body: z.string().trim().max(4000),
  replyToId: z.string().uuid().optional(),
});

export const reactionSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().trim().min(1).max(8),
});

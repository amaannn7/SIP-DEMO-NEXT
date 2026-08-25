import { db } from "@/lib/db";
import { chatConversations } from "@/lib/db/schema";

/** Every org gets a public "general" channel out of the box — same role as the source system's auto-seeded default channel, but created once at org setup rather than lazily on first API read. */
export async function seedDefaultChatChannel(orgId: string, createdBy: string): Promise<void> {
  await db.insert(chatConversations).values({
    orgId,
    kind: "channel",
    name: "general",
    description: "Company-wide chat",
    isPrivate: false,
    createdBy,
  });
}

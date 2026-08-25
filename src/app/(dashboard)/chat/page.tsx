import { requireAuthForPage } from "@/lib/auth/session";
import { listConversationsForUser } from "@/lib/db/queries/chat";
import { listChannels } from "@/lib/db/queries/chat-channels";
import { listOrgUsers } from "@/lib/db/queries/users";
import { ChatShell } from "@/components/chat/chat-shell";

export default async function ChatPage() {
  const session = await requireAuthForPage();
  const [conversations, channels, orgUsers] = await Promise.all([
    listConversationsForUser(session.user.orgId, session.user.id),
    listChannels(session.user.orgId),
    listOrgUsers(session.user.orgId),
  ]);

  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";

  return (
    <ChatShell
      currentUser={{ id: session.user.id, displayName: session.user.displayName, avatarUrl: session.user.avatarUrl }}
      isAdmin={isAdmin}
      initialConversations={conversations}
      allChannels={channels.map((c) => ({
        id: c.id,
        name: c.name ?? "",
        description: c.description,
        isPrivate: c.isPrivate,
        memberIds: c.members.map((m) => m.userId),
      }))}
      orgUsers={orgUsers
        .filter((u) => u.id !== session.user.id)
        .map((u) => ({ id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl }))}
    />
  );
}

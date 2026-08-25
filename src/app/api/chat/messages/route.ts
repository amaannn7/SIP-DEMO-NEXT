import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canAccessConversation, getPinnedMessage, listMessages, markConversationRead } from "@/lib/db/queries/chat";
import { mapMessage } from "@/lib/chat/map-message";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const before = searchParams.get("before");
  if (!conversationId) {
    return NextResponse.json({ success: false, error: "conversationId required" }, { status: 400 });
  }

  const allowed = await canAccessConversation(session.user.orgId, conversationId, session.user.id);
  if (!allowed) {
    return NextResponse.json({ success: false, error: "Not authorized" }, { status: 403 });
  }

  const [rows, pinned] = await Promise.all([
    listMessages(conversationId, before ? new Date(before) : undefined),
    getPinnedMessage(conversationId),
  ]);

  if (!before) {
    await markConversationRead(conversationId, session.user.id);
  }

  return NextResponse.json({
    success: true,
    messages: await Promise.all(rows.map(mapMessage)),
    pinned: pinned ? { id: pinned.id, body: pinned.body, senderName: pinned.sender.displayName, pinnedByName: pinned.pinner?.displayName ?? null } : null,
  });
}

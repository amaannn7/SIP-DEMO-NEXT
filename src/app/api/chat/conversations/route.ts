import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listConversationsForUser } from "@/lib/db/queries/chat";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }
  const conversations = await listConversationsForUser(session.user.orgId, session.user.id);
  return NextResponse.json({ success: true, conversations });
}

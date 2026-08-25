import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOnlineUserIds } from "@/lib/db/queries/session-activity";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }
  const onlineUserIds = await getOnlineUserIds(session.user.orgId);
  return NextResponse.json({ success: true, onlineUserIds: [...onlineUserIds] });
}

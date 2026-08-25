import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listTickets, getTicketsSummary } from "@/lib/db/queries/tickets";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }
  const showClosed = new URL(req.url).searchParams.get("closed") === "1";

  const [tickets, summary] = await Promise.all([
    listTickets(session.user.orgId, session.user.id, session.user.role, showClosed),
    getTicketsSummary(session.user.orgId, session.user.id, session.user.role),
  ]);

  return NextResponse.json({ success: true, tickets, summary });
}

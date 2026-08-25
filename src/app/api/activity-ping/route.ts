import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, activityPings } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";

const pingSchema = z.object({ page: z.string().trim().max(200).optional() });

/**
 * Ports the source system's activity-ping: a lightweight heartbeat from the
 * authenticated shell. Writes a row to activity_pings (the source of truth
 * for session-grouping/active-minutes on the admin Users page and dashboard
 * preview — see getSessionActivity) and also updates sessions.lastSeenAt as
 * a cheap last-known cache for the "online now" dot.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const parsed = pingSchema.safeParse(await req.json().catch(() => ({})));
  const page = parsed.success ? parsed.data.page : undefined;
  const now = new Date();

  await Promise.all([
    db
      .update(sessions)
      .set({ lastSeenAt: now, ...(page ? { lastPage: page } : {}) })
      .where(eq(sessions.id, session.id)),
    db.insert(activityPings).values({ orgId: session.user.orgId, userId: session.user.id, page, pingedAt: now }),
  ]);

  return NextResponse.json({ success: true });
}

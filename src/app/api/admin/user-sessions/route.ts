import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getSessionActivity } from "@/lib/db/queries/session-activity";

const VALID_DAYS = new Set([1, 7, 30, 90]);

/** Ports the source system's user-sessions endpoint's days-range picker (Today/7/30/90 days) on the Users page. */
export async function GET(req: Request) {
  const session = await requireRole("admin");

  const { searchParams } = new URL(req.url);
  const rawDays = Number(searchParams.get("days") ?? 7);
  const days = VALID_DAYS.has(rawDays) ? rawDays : 7;

  const allRows = await getSessionActivity(session.user.orgId, days);
  const rows = session.user.role === "super_admin" ? allRows : allRows.filter((row) => row.role !== "super_admin");
  return NextResponse.json({ success: true, rows, days });
}

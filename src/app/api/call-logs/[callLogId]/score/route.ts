import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs, callScores } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ callLogId: string }> }) {
  const session = await requireAuth();
  const { callLogId } = await params;

  const [call] = await db.select({ id: callLogs.id }).from(callLogs).where(and(eq(callLogs.id, callLogId), eq(callLogs.orgId, session.user.orgId)));
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const score = await db.query.callScores.findFirst({ where: eq(callScores.callLogId, callLogId) });
  if (!score) return NextResponse.json({ error: "Not scored yet" }, { status: 404 });

  return NextResponse.json({ score });
}

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getObjectSignedUrl } from "@/lib/storage/s3";

/** Signs a fresh URL on demand rather than storing/returning one — matches the same pattern as chat attachments, since a stored URL would go stale before it's ever clicked. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ callLogId: string }> }) {
  const session = await requireAuth();
  const { callLogId } = await params;

  const [row] = await db
    .select({ recordingKey: callLogs.recordingKey })
    .from(callLogs)
    .where(and(eq(callLogs.id, callLogId), eq(callLogs.orgId, session.user.orgId)));

  if (!row?.recordingKey) {
    return NextResponse.json({ error: "No recording available" }, { status: 404 });
  }

  const url = await getObjectSignedUrl(row.recordingKey);
  return NextResponse.json({ url });
}

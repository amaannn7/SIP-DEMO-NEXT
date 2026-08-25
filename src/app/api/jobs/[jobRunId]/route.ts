import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobRuns } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth/session";

export async function GET(_req: Request, { params }: { params: Promise<{ jobRunId: string }> }) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    throw err;
  }

  const { jobRunId } = await params;

  const jobRun = await db.query.jobRuns.findFirst({
    where: and(eq(jobRuns.id, jobRunId), eq(jobRuns.orgId, session.user.orgId)),
  });

  if (!jobRun) {
    return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    id: jobRun.id,
    status: jobRun.status,
    resultId: jobRun.resultId,
    error: jobRun.error,
  });
}

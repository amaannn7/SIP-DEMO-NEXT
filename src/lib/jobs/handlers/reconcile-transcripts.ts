import "server-only";

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs } from "@/lib/db/schema";
import { getAircallCredentials } from "@/lib/db/queries/aircall-settings";
import { fetchTranscript } from "@/lib/aircall/client";
import { enqueueScoreCall } from "@/lib/jobs/enqueue";

const STUCK_AFTER_MS = 10 * 60 * 1000; // 10 minutes
const GIVE_UP_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Ports the source system's reconcile-transcripts cron sweep — but as a
 * pg-boss scheduled job (native recurring-job support) rather than a
 * separate cron-hits-an-endpoint script + shared-secret header, since this
 * app already runs pg-boss for everything else. Re-fetches transcripts
 * stuck in "pending" via a direct API call, and gives up (marks 'failed')
 * after 2 hours so a call doesn't stay pending forever.
 */
export async function reconcileTranscripts(): Promise<void> {
  const now = Date.now();
  const stuck = await db
    .select({ id: callLogs.id, orgId: callLogs.orgId, aircallCallId: callLogs.aircallCallId, createdAt: callLogs.createdAt })
    .from(callLogs)
    .where(and(eq(callLogs.via, "aircall"), eq(callLogs.transcriptStatus, "pending")));

  for (const call of stuck) {
    if (!call.aircallCallId) continue;
    const ageMs = now - call.createdAt.getTime();
    if (ageMs < STUCK_AFTER_MS) continue;

    if (ageMs > GIVE_UP_AFTER_MS) {
      await db.update(callLogs).set({ transcriptStatus: "failed" }).where(eq(callLogs.id, call.id));
      continue;
    }

    const creds = await getAircallCredentials(call.orgId);
    if (!creds) continue;

    const result = await fetchTranscript(creds.apiId, creds.apiToken, call.aircallCallId);
    if (result.success) {
      await db.update(callLogs).set({ transcript: result.transcript, transcriptStatus: "ready" }).where(eq(callLogs.id, call.id));
      await enqueueScoreCall({ orgId: call.orgId, callLogId: call.id });
    }
  }
}

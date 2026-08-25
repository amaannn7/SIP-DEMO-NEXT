import "server-only";

import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { enrichmentResults, emailHistory, callPitches } from "@/lib/db/schema";

export async function getLatestEnrichment(leadId: string) {
  return db.query.enrichmentResults.findFirst({
    where: eq(enrichmentResults.leadId, leadId),
    orderBy: desc(enrichmentResults.createdAt),
  });
}

export async function listEmailHistory(leadId: string) {
  return db.query.emailHistory.findMany({
    where: eq(emailHistory.leadId, leadId),
    orderBy: desc(emailHistory.createdAt),
  });
}

export async function listCallPitches(leadId: string) {
  return db.query.callPitches.findMany({
    where: eq(callPitches.leadId, leadId),
    orderBy: desc(callPitches.createdAt),
  });
}

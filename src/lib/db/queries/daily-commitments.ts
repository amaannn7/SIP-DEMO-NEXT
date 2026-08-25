import "server-only";

import { and, eq, lt, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyCommitments } from "@/lib/db/schema";
import { todayDateString } from "@/lib/daily/today";

/** Today's commitments plus any incomplete items from prior days ("carried over"), matching the source system's carry-over behavior — nothing is ever silently dropped. */
export async function listCommitmentsForToday(orgId: string, userId: string, dateString = todayDateString()) {
  const [today, carriedOver] = await Promise.all([
    db.query.dailyCommitments.findMany({
      where: and(eq(dailyCommitments.orgId, orgId), eq(dailyCommitments.userId, userId), eq(dailyCommitments.forDate, dateString)),
      orderBy: asc(dailyCommitments.createdAt),
      with: { lead: { columns: { id: true, firstName: true, lastName: true, company: true } } },
    }),
    db.query.dailyCommitments.findMany({
      where: and(
        eq(dailyCommitments.orgId, orgId),
        eq(dailyCommitments.userId, userId),
        eq(dailyCommitments.isCompleted, false),
        lt(dailyCommitments.forDate, dateString),
      ),
      orderBy: asc(dailyCommitments.createdAt),
      with: { lead: { columns: { id: true, firstName: true, lastName: true, company: true } } },
    }),
  ]);

  return { today, carriedOver };
}

import "server-only";

import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyPerformance } from "@/lib/db/schema";
import { todayDateString } from "@/lib/daily/today";

export async function saveDailyPerformanceSnapshot(params: {
  orgId: string;
  userId: string;
  callsDone: number;
  callsTarget: number;
  emailsDone: number;
  emailsTarget: number;
  researchDone: number;
  researchTarget: number;
  dateString?: string;
}): Promise<void> {
  const dateString = params.dateString ?? todayDateString();
  // Matches the source system's streak logic: only calls and emails count
  // toward a "target met" day — research isn't checked.
  const targetMet = params.callsDone >= params.callsTarget && params.emailsDone >= params.emailsTarget;

  await db
    .insert(dailyPerformance)
    .values({
      orgId: params.orgId,
      userId: params.userId,
      forDate: dateString,
      callsDone: params.callsDone,
      callsTarget: params.callsTarget,
      emailsDone: params.emailsDone,
      emailsTarget: params.emailsTarget,
      researchDone: params.researchDone,
      researchTarget: params.researchTarget,
      targetMet,
    })
    .onConflictDoUpdate({
      target: [dailyPerformance.orgId, dailyPerformance.userId, dailyPerformance.forDate],
      set: {
        callsDone: params.callsDone,
        callsTarget: params.callsTarget,
        emailsDone: params.emailsDone,
        emailsTarget: params.emailsTarget,
        researchDone: params.researchDone,
        researchTarget: params.researchTarget,
        targetMet,
        savedAt: new Date(),
      },
    });
}

/** Consecutive target-met days ending yesterday-or-today — stops at the first day with no row or an unmet target. Today not having a row yet (or not yet meeting target) doesn't break a streak already built through yesterday. */
export async function getCurrentStreak(orgId: string, userId: string): Promise<number> {
  const rows = await db.query.dailyPerformance.findMany({
    where: and(eq(dailyPerformance.orgId, orgId), eq(dailyPerformance.userId, userId)),
    orderBy: desc(dailyPerformance.forDate),
    limit: 90,
  });
  const rowsByDate = new Map(rows.map((r) => [r.forDate, r]));

  const today = todayDateString();
  let streak = 0;
  let cursor = today;
  let first = true;
  while (true) {
    const row = rowsByDate.get(cursor);
    const met = row?.targetMet ?? false;
    if (!met) {
      // Only today itself is allowed to be missing/unmet without breaking the streak (it's still in progress).
      if (first && cursor === today) {
        cursor = shiftDateString(cursor, -1);
        first = false;
        continue;
      }
      break;
    }
    streak++;
    cursor = shiftDateString(cursor, -1);
    first = false;
  }
  return streak;
}

function shiftDateString(dateString: string, deltaDays: number): string {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

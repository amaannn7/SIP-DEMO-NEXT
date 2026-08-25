import "server-only";

import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyTargets, DEFAULT_DAILY_TARGETS } from "@/lib/db/schema";

export type EffectiveDailyTargets = {
  callsTarget: number;
  emailsTarget: number;
  researchTarget: number;
  /** "personal" if the rep has their own override, "org" if using the org default, "fallback" if neither exists. */
  source: "personal" | "org" | "fallback";
};

/** Fallback chain: rep's personal override -> org-wide default -> hardcoded fallback. Ports the source system's effectiveDailyTargets. */
export async function getEffectiveDailyTargets(orgId: string, userId: string): Promise<EffectiveDailyTargets> {
  const [personal, orgDefault] = await Promise.all([
    db.query.dailyTargets.findFirst({ where: and(eq(dailyTargets.orgId, orgId), eq(dailyTargets.userId, userId)) }),
    db.query.dailyTargets.findFirst({ where: and(eq(dailyTargets.orgId, orgId), isNull(dailyTargets.userId)) }),
  ]);

  if (personal) {
    return {
      callsTarget: personal.callsTarget,
      emailsTarget: personal.emailsTarget,
      researchTarget: personal.researchTarget,
      source: "personal",
    };
  }
  if (orgDefault) {
    return {
      callsTarget: orgDefault.callsTarget,
      emailsTarget: orgDefault.emailsTarget,
      researchTarget: orgDefault.researchTarget,
      source: "org",
    };
  }
  return { ...DEFAULT_DAILY_TARGETS, source: "fallback" };
}

export async function getOrgDefaultDailyTargets(orgId: string) {
  const row = await db.query.dailyTargets.findFirst({
    where: and(eq(dailyTargets.orgId, orgId), isNull(dailyTargets.userId)),
  });
  return row
    ? { callsTarget: row.callsTarget, emailsTarget: row.emailsTarget, researchTarget: row.researchTarget }
    : DEFAULT_DAILY_TARGETS;
}

export async function upsertOrgDefaultDailyTargets(
  orgId: string,
  targets: { callsTarget: number; emailsTarget: number; researchTarget: number },
): Promise<void> {
  await db
    .insert(dailyTargets)
    .values({ orgId, userId: null, ...targets })
    .onConflictDoUpdate({
      target: [dailyTargets.orgId],
      targetWhere: sql`${dailyTargets.userId} IS NULL`,
      set: { ...targets, updatedAt: new Date() },
    });
}

export async function upsertPersonalDailyTargets(
  orgId: string,
  userId: string,
  targets: { callsTarget: number; emailsTarget: number; researchTarget: number },
): Promise<void> {
  await db
    .insert(dailyTargets)
    .values({ orgId, userId, ...targets })
    .onConflictDoUpdate({
      target: [dailyTargets.orgId, dailyTargets.userId],
      targetWhere: sql`${dailyTargets.userId} IS NOT NULL`,
      set: { ...targets, updatedAt: new Date() },
    });
}

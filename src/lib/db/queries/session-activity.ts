import "server-only";

import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, activityPings } from "@/lib/db/schema";

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // "online now" if seen in the last 3 minutes, matches the source system
const SESSION_GAP_MS = 30 * 60 * 1000; // a 30+ minute gap between pings starts a new logical session, matches the source system

export type UserSession = {
  start: Date;
  end: Date;
  durationMins: number;
  pages: string[];
};

export type SessionActivityRow = {
  userId: string;
  displayName: string;
  role: "rep" | "admin" | "super_admin";
  isOnline: boolean;
  lastSeenAt: Date | null;
  lastPage: string | null;
  activeMinsToday: number;
  sessionsThisPeriod: number;
  sessions: UserSession[];
};

/**
 * Groups a user's activity pings (ordered ascending) into logical sessions —
 * ports the source system's user-sessions handler exactly: a gap of more
 * than 30 minutes between consecutive pings starts a new session; a
 * session's duration is the span from its first to its last ping, rounded up
 * to the nearest minute with a 1-minute floor (a single ping is still a real
 * minute of activity, not a zero-length session).
 */
function groupPingsIntoSessions(pings: { pingedAt: Date; page: string | null }[]): UserSession[] {
  const result: UserSession[] = [];
  let sessionStart: Date | null = null;
  let sessionEnd: Date | null = null;
  let pages: string[] = [];
  let prevTime: number | null = null;

  const flush = () => {
    if (sessionStart === null || sessionEnd === null) return;
    const durationMins = Math.max(1, Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 60_000) + 1);
    result.push({ start: sessionStart, end: sessionEnd, durationMins, pages: [...new Set(pages)] });
  };

  for (const ping of pings) {
    const t = ping.pingedAt.getTime();
    if (prevTime === null || t - prevTime > SESSION_GAP_MS) {
      flush();
      sessionStart = ping.pingedAt;
      pages = [];
    }
    sessionEnd = ping.pingedAt;
    if (ping.page) pages.push(ping.page);
    prevTime = t;
  }
  flush();

  return result;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Cheap presence check — just who's currently online, for a dot next to a name (chat, DM picker). Doesn't need the full session/page history getSessionActivity builds. */
export async function getOnlineUserIds(orgId: string): Promise<Set<string>> {
  const since = new Date(Date.now() - ONLINE_THRESHOLD_MS);
  const rows = await db
    .selectDistinct({ userId: activityPings.userId })
    .from(activityPings)
    .innerJoin(users, eq(users.id, activityPings.userId))
    .where(and(eq(users.orgId, orgId), gte(activityPings.pingedAt, since)));
  return new Set(rows.map((r) => r.userId));
}

/**
 * Ports the source system's user-sessions admin view: per-user online/last-seen/
 * last-page, active-minutes-today, and real logical sessions (grouped from the
 * activity_pings log, not from login/cookie session rows — those inflate on
 * every login regardless of actual usage and were the rebuild's original bug).
 * The source system's "on a call" indicator is Aircall-only and correctly not
 * ported here.
 */
export async function getSessionActivity(orgId: string, days = 7): Promise<SessionActivityRow[]> {
  const orgUsers = await db.query.users.findMany({
    where: and(eq(users.orgId, orgId), eq(users.isActive, true)),
    columns: { id: true, displayName: true, role: true },
  });
  if (orgUsers.length === 0) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const allPings = await db
    .select({ userId: activityPings.userId, pingedAt: activityPings.pingedAt, page: activityPings.page })
    .from(activityPings)
    .where(
      and(
        inArray(
          activityPings.userId,
          orgUsers.map((u) => u.id),
        ),
        gte(activityPings.pingedAt, since),
      ),
    )
    .orderBy(asc(activityPings.pingedAt));

  const now = Date.now();
  const today = new Date();

  return orgUsers
    .map((user) => {
      const userPings = allPings.filter((p) => p.userId === user.id);
      const sessions = groupPingsIntoSessions(userPings);
      const lastPing = userPings[userPings.length - 1] ?? null;
      const lastSeenAt = lastPing?.pingedAt ?? null;
      const activeMinsToday = sessions.filter((s) => isSameLocalDay(s.start, today)).reduce((sum, s) => sum + s.durationMins, 0);

      return {
        userId: user.id,
        displayName: user.displayName,
        role: user.role,
        isOnline: lastSeenAt !== null && now - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS,
        lastSeenAt,
        lastPage: lastPing?.page ?? null,
        activeMinsToday: Math.min(activeMinsToday, 480), // capped at 8h/day, matches the source system
        sessionsThisPeriod: sessions.length,
        sessions: sessions.slice().reverse(), // most recent session first, matches the source system
      };
    })
    .sort((a, b) => (b.lastSeenAt?.getTime() ?? 0) - (a.lastSeenAt?.getTime() ?? 0));
}

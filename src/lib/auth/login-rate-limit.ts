import "server-only";

import { and, count, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Brute-force protection on login — the source system had no equivalent
 * (only a generic per-IP API throttle, not attempt-tracking), so this is a
 * genuine security addition rather than a port. Locks out a specific
 * IP+email pairing rather than the account globally, so one attacker can't
 * lock a real user out of their own account from a different IP.
 */
async function getClientIdentifier(email: string): Promise<string> {
  const headerList = await headers();
  // Behind a reverse proxy (Caddy in this deployment), the real client IP is
  // the first entry in X-Forwarded-For; falls back to a shared bucket if
  // that header is ever absent (e.g. direct-to-app in local dev).
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  return `${ip}:${email.trim().toLowerCase()}`;
}

export async function isLoginLocked(email: string): Promise<boolean> {
  const identifier = await getClientIdentifier(email);
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ value: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.identifier, identifier), gt(loginAttempts.createdAt, since)));
  return (row?.value ?? 0) >= MAX_ATTEMPTS;
}

export async function recordFailedLoginAttempt(email: string): Promise<void> {
  const identifier = await getClientIdentifier(email);
  await db.insert(loginAttempts).values({ identifier });
}

export async function clearLoginAttempts(email: string): Promise<void> {
  const identifier = await getClientIdentifier(email);
  await db.delete(loginAttempts).where(eq(loginAttempts.identifier, identifier));
}

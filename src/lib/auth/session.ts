import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type userRoleEnum } from "@/lib/db/schema";

export const SESSION_COOKIE = "session_id";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type SessionUser = {
  id: string;
  orgId: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarUrl: string | null;
  hasCompletedOnboarding: boolean;
};

export type Session = {
  id: string;
  user: SessionUser;
  /** Present when an admin is impersonating `user` — the admin's own account. */
  impersonatedBy: SessionUser | null;
};

/**
 * Creates a new session row and sets the session cookie. If `impersonatorId`
 * is provided, this session represents that admin impersonating `userId`.
 */
export async function createSession(userId: string, impersonatorId?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      impersonatedBy: impersonatorId ?? null,
      expiresAt,
    })
    .returning({ id: sessions.id });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Ports the source system's password-reset behavior: changing a password invalidates every existing session for that user, not just the current one. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Reads the current session from the cookie, joins the acting user (and the
 * impersonator, if any). Cached per-request so repeated calls across Server
 * Components/Actions in the same request don't re-hit the database.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const row = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: {
      user: true,
      impersonator: true,
    },
  });

  if (!row || row.expiresAt < new Date() || !row.user.isActive) {
    return null;
  }

  return {
    id: row.id,
    user: toSessionUser(row.user),
    impersonatedBy: row.impersonator ? toSessionUser(row.impersonator) : null,
  };
});

function toSessionUser(user: typeof users.$inferSelect): SessionUser {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    hasCompletedOnboarding: user.hasCompletedOnboarding,
  };
}

/** Throws by redirecting-equivalent error for route handlers/Server Actions to catch, or returns the session. */
export async function requireAuth(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Authentication required");
  }
  return session;
}

const ROLE_RANK: Record<UserRole, number> = {
  rep: 0,
  admin: 1,
  super_admin: 2,
};

export async function requireRole(minRole: UserRole): Promise<Session> {
  const session = await requireAuth();
  if (ROLE_RANK[session.user.role] < ROLE_RANK[minRole]) {
    throw new AuthError(`${minRole} access required`, 403);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Page-component variants of requireAuth/requireRole: redirect instead of
 * throwing AuthError. Use these in `page.tsx`/`layout.tsx` files; use
 * requireAuth/requireRole (which throw) in Server Actions and Route
 * Handlers, where the caller needs a real error response, not a redirect.
 */
export async function requireAuthForPage(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireRoleForPage(minRole: UserRole): Promise<Session> {
  const session = await requireAuthForPage();
  if (ROLE_RANK[session.user.role] < ROLE_RANK[minRole]) {
    redirect("/dashboard");
  }
  return session;
}

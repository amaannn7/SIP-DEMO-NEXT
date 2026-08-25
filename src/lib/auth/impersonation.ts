import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, destroySession, requireAuth, requireRole, AuthError } from "./session";

/**
 * Super admin starts impersonating any other user in the org (matching the
 * source system: impersonation is super-admin-only, and any non-self user
 * can be the target — including other admins). Self-impersonation is
 * blocked since it's meaningless and would just churn the session.
 */
export async function startImpersonation(targetUserId: string): Promise<void> {
  const session = await requireRole("super_admin");

  if (targetUserId === session.user.id) {
    throw new AuthError("Cannot impersonate yourself", 400);
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
  });

  if (!target || target.orgId !== session.user.orgId) {
    throw new AuthError("User not found", 404);
  }

  await destroySession();
  await createSession(target.id, session.user.id);
}

export async function stopImpersonation(): Promise<void> {
  const session = await requireAuth();
  if (!session.impersonatedBy) {
    return;
  }
  await destroySession();
  await createSession(session.impersonatedBy.id);
}

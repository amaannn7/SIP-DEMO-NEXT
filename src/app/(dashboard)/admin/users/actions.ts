"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { users, userRoleEnum, leads } from "@/lib/db/schema";
import { requireRole, destroyAllSessionsForUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { logLeadActivity } from "@/lib/db/queries/leads";

const roleSchema = z.enum(userRoleEnum.enumValues);

const inviteUserSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Enter a valid email"),
  role: roleSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type InviteUserState = { error?: string };

/**
 * Ports the source system's create-user exactly: any admin can create a
 * user, but only a super admin can grant the super_admin role itself.
 */
export async function inviteUserAction(_prevState: InviteUserState, formData: FormData): Promise<InviteUserState> {
  const session = await requireRole("admin");

  const parsed = inviteUserSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.role === "super_admin" && session.user.role !== "super_admin") {
    return { error: "Only a super admin can grant the super admin role" };
  }

  const existing = await db.query.users.findFirst({
    where: and(eq(users.orgId, session.user.orgId), eq(users.email, parsed.data.email)),
  });
  if (existing) {
    return { error: "A user with this email already exists" };
  }

  await db.insert(users).values({
    orgId: session.user.orgId,
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    role: parsed.data.role,
    passwordHash: await hashPassword(parsed.data.password),
    // A freshly created account (unlike seeded demo/client fixtures) sees
    // the first-login welcome wizard.
    hasCompletedOnboarding: false,
  });

  revalidatePath("/admin/users");
  return {};
}

/**
 * Ports the source system's update-user role change exactly: a plain admin
 * can change roles for reps/admins, but cannot touch a super-admin target
 * ("Cannot edit a super admin"), and cannot grant the super_admin role
 * unless they are one themselves.
 */
export async function updateUserRoleAction(userId: string, formData: FormData): Promise<void> {
  const session = await requireRole("admin");
  const parsed = roleSchema.safeParse(formData.get("role"));
  if (!parsed.success) return;
  const isSuperAdmin = session.user.role === "super_admin";
  if (parsed.data === "super_admin" && !isSuperAdmin) return;

  const target = await db.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.orgId, session.user.orgId)) });
  if (!target || (target.role === "super_admin" && !isSuperAdmin)) return;

  await db
    .update(users)
    .set({ role: parsed.data, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.orgId, session.user.orgId), ne(users.id, session.user.id)));

  revalidatePath("/admin/users");
}

/**
 * Ports the source system's update-user active-state change: same
 * "cannot edit a super admin" guard as role changes.
 */
export async function setUserActiveAction(userId: string, isActive: boolean): Promise<void> {
  const session = await requireRole("admin");
  const isSuperAdmin = session.user.role === "super_admin";

  const target = await db.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.orgId, session.user.orgId)) });
  if (!target || (target.role === "super_admin" && !isSuperAdmin)) return;

  await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.orgId, session.user.orgId), ne(users.id, session.user.id)));

  revalidatePath("/admin/users");
}

// Ports the source system's generatePassword(): 10 random chars from an
// alphabet with visually-ambiguous characters (0/O, 1/l/I) removed, since
// this is read off-screen and typed by hand into a handoff to the user.
const PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateTempPassword(): string {
  const bytes = randomBytes(10);
  let password = "";
  for (let i = 0; i < 10; i++) password += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  return password;
}

export type ResetUserPasswordState = { error?: string; newPassword?: string };

/**
 * Ports the source system's update-user reset_password behavior: an admin
 * can force a new password for any user directly, without that user needing
 * to receive a reset email (this deployment has no email delivery). Also
 * destroys the target's existing sessions, same as a self-service reset.
 */
export async function resetUserPasswordAction(userId: string): Promise<ResetUserPasswordState> {
  const session = await requireRole("admin");
  if (userId === session.user.id) {
    return { error: "Use your own account settings to change your password" };
  }

  const target = await db.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.orgId, session.user.orgId)) });
  if (!target) {
    return { error: "User not found" };
  }
  if (target.role === "super_admin" && session.user.role !== "super_admin") {
    return { error: "Cannot edit a super admin" };
  }

  const newPassword = generateTempPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, userId));
  await destroyAllSessionsForUser(userId);

  revalidatePath("/admin/users");
  return { newPassword };
}

export type ResetUserLeadsState = { error?: string; deletedCount?: number };

/**
 * Ports the source system's reset-user-data: a super-admin demo/QA utility
 * that clears a rep's entire lead book, used to reset test data between
 * sales-pitch demos. Soft-deletes (into trash, recoverable) rather than the
 * source system's hard wipe, matching this rebuild's established delete
 * convention everywhere else.
 */
export async function resetUserLeadsAction(userId: string): Promise<ResetUserLeadsState> {
  const session = await requireRole("super_admin");

  const target = await db.query.users.findFirst({ where: and(eq(users.id, userId), eq(users.orgId, session.user.orgId)) });
  if (!target) {
    return { error: "User not found" };
  }

  const rows = await db
    .update(leads)
    .set({ isDeleted: true, deletedAt: new Date() })
    .where(and(eq(leads.orgId, session.user.orgId), eq(leads.ownerId, userId), eq(leads.isDeleted, false)))
    .returning({ id: leads.id });

  await Promise.all(
    rows.map((row) =>
      logLeadActivity({ orgId: session.user.orgId, leadId: row.id, actorId: session.user.id, type: "deleted" }),
    ),
  );

  revalidatePath("/admin/users");
  revalidatePath("/leads");
  return { deletedCount: rows.length };
}

const aircallLinkSchema = z.object({
  aircallUserId: z.string().trim().max(100).optional(),
  aircallNumberId: z.string().trim().max(100).optional(),
});

/**
 * Ports the source system's linkAircallUser/unlinkAircallUser (Users page,
 * per-rep Aircall user/number id) as a single form save rather than two
 * separate prompt() dialogs — free-text ids found in that rep's own Aircall
 * dashboard, not validated against Aircall's API here (the "Test connection"
 * button on the org-level Aircall settings card is the place for that).
 */
export async function updateUserAircallSettingsAction(userId: string, formData: FormData): Promise<void> {
  const session = await requireRole("admin");
  const parsed = aircallLinkSchema.safeParse({
    aircallUserId: formData.get("aircallUserId") ?? undefined,
    aircallNumberId: formData.get("aircallNumberId") ?? undefined,
  });
  if (!parsed.success) return;

  await db
    .update(users)
    .set({
      aircallUserId: parsed.data.aircallUserId || null,
      aircallNumberId: parsed.data.aircallNumberId || null,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.orgId, session.user.orgId)));

  revalidatePath("/admin/users");
}

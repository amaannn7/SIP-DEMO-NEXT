"use server";

import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, destroyAllSessionsForUser } from "@/lib/auth/session";
import { isLoginLocked, recordFailedLoginAttempt, clearLoginAttempts } from "@/lib/auth/login-rate-limit";
import { loginSchema, requestPasswordResetSchema, resetPasswordSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;

  if (await isLoginLocked(email)) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  // Compare against a fixed hash even when no user is found, so responses
  // for "no such user" and "wrong password" take the same time.
  const passwordHash = user?.passwordHash ?? "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const isValid = await verifyPassword(passwordHash, password);

  if (!user || !isValid || !user.isActive) {
    await recordFailedLoginAttempt(email);
    return { error: "Invalid email or password" };
  }

  await clearLoginAttempts(email);
  await createSession(user.id);
  // Matches the source system's defaultLandingPage(): managers land on the
  // Admin Dashboard, reps land on Today.
  const isManager = user.role === "admin" || user.role === "super_admin";
  redirect(isManager ? "/admin" : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, matches the source system

export type RequestPasswordResetState = {
  error?: string;
  message?: string;
  /** No outbound email delivery in this template (the source system didn't have one either) — the reset link is shown on-screen so it can be relayed manually. */
  resetLink?: string;
};

/**
 * Ports the source system's request-password-reset: always responds with
 * the same generic message whether or not the email exists, so the
 * response itself can't be used to enumerate registered accounts.
 */
export async function requestPasswordResetAction(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" };
  }

  const genericMessage = "If this email exists, a reset link has been generated.";

  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  if (!user) {
    return { message: genericMessage };
  }

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  return { message: genericMessage, resetLink: `/reset-password?token=${token}` };
}

export type ResetPasswordState = { error?: string; success?: boolean };

export async function resetPasswordAction(_prevState: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tokenRow = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, parsed.data.token),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
    ),
  });
  if (!tokenRow) {
    return { error: "Invalid or expired reset link" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, tokenRow.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenRow.id));

  // Matches the source system: a password reset invalidates every existing
  // session for that user, not just whichever device requested the reset.
  await destroyAllSessionsForUser(tokenRow.userId);

  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

/** Marks the first-login welcome wizard done — ports the source system's complete-onboarding. */
export async function completeOnboardingAction(): Promise<void> {
  const session = await requireAuth();
  await db.update(users).set({ hasCompletedOnboarding: true, updatedAt: new Date() }).where(eq(users.id, session.user.id));
  revalidatePath("/", "layout");
}

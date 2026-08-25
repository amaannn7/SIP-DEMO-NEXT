"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { startImpersonation, stopImpersonation } from "@/lib/auth/impersonation";

export async function impersonateUserAction(userId: string): Promise<void> {
  await startImpersonation(userId);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function stopImpersonationAction(): Promise<void> {
  await stopImpersonation();
  revalidatePath("/", "layout");
  redirect("/admin/users");
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";

/** Admin cleanup tool — ports the source system's delete-call-log (there, an Aircall call_history entry; here, a manually logged call). */
export async function deleteCallLogAction(callLogId: string): Promise<void> {
  const session = await requireRole("admin");
  await db.delete(callLogs).where(and(eq(callLogs.id, callLogId), eq(callLogs.orgId, session.user.orgId)));
  revalidatePath("/reports");
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth/session";
import {
  generateAndSaveNotifications,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
} from "@/lib/db/queries/notifications";

export async function GET() {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    throw err;
  }

  await generateAndSaveNotifications(session.user.orgId, session.user.id);
  const items = await listNotifications(session.user.id);
  return NextResponse.json({ success: true, notifications: items });
}

const postSchema = z.object({
  action: z.enum(["mark_read", "mark_all_read", "dismiss", "dismiss_all"]),
  notificationId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const { action, notificationId } = parsed.data;
  if ((action === "mark_read" || action === "dismiss") && !notificationId) {
    return NextResponse.json({ success: false, error: "notificationId is required" }, { status: 400 });
  }

  if (action === "mark_read") await markNotificationRead(session.user.id, notificationId!);
  if (action === "mark_all_read") await markAllNotificationsRead(session.user.id);
  if (action === "dismiss") await dismissNotification(session.user.id, notificationId!);
  if (action === "dismiss_all") await dismissAllNotifications(session.user.id);

  return NextResponse.json({ success: true });
}

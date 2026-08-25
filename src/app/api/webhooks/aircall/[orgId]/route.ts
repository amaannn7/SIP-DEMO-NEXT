import "server-only";

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { callLogs, leads, users, aircallOnCall } from "@/lib/db/schema";
import { getAircallWebhookToken } from "@/lib/db/queries/aircall-settings";
import { findLeadByPhone, logLeadActivity } from "@/lib/db/queries/leads";
import { createCallOutcomePendingNotification } from "@/lib/db/queries/notifications";
import { uploadObject } from "@/lib/storage/s3";
import { enqueueScoreCall } from "@/lib/jobs/enqueue";

type AircallWebhookBody = {
  event: string;
  data: {
    id: number;
    user?: { id: number; name: string };
    raw_digits?: string;
    direction?: "inbound" | "outbound";
    started_at?: number;
    ended_at?: number;
    answered_at?: number | null;
    duration?: number;
    recording?: string | null;
    comments?: { content: string }[];
    tags?: { name: string }[];
    transcription?: unknown;
    transcript?: unknown;
    summary?: unknown;
  };
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Ports the source system's aircall-webhook exactly: verifies a shared
 * bearer token (Aircall's own webhook auth transport isn't documented, so
 * the source system invented this shared-token scheme, same here), then
 * dispatches on `event`. Org id is embedded in the URL path (this app is
 * multi-org-capable, unlike the source system's single-install model) so
 * the token lookup and every write below is correctly scoped without
 * needing auth on an inbound webhook request.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const configuredToken = await getAircallWebhookToken(orgId);
  if (!configuredToken) {
    return NextResponse.json({ error: "Webhook not configured for this organization" }, { status: 404 });
  }

  const headerToken =
    request.headers.get("x-aircall-webhook-token") ??
    request.headers.get("x-webhook-token") ??
    request.headers.get("x-aircall-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.nextUrl.searchParams.get("token") ??
    "";

  if (!headerToken || !safeEqual(headerToken, configuredToken)) {
    return NextResponse.json({ error: "Invalid webhook token" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AircallWebhookBody | null;
  if (!body?.event || !body.data) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  switch (body.event) {
    case "call.created":
      await handleCallCreated(orgId, body.data);
      break;
    case "call.hungup":
      await db.delete(aircallOnCall).where(eq(aircallOnCall.aircallCallId, String(body.data.id)));
      break;
    case "call.ended":
      await db.delete(aircallOnCall).where(eq(aircallOnCall.aircallCallId, String(body.data.id)));
      await handleCallEnded(orgId, body.data);
      break;
    case "call.commented":
    case "call.tagged":
      await handleCallPatch(body.data);
      break;
    case "transcription.created":
      await handleTranscriptionCreated(orgId, body.data);
      break;
    case "summary.created":
      await handleSummaryCreated(body.data);
      break;
    default:
      break;
  }

  return NextResponse.json({ success: true });
}

async function handleCallCreated(orgId: string, data: AircallWebhookBody["data"]) {
  if (!data.user) return;
  const [matchedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.aircallUserId, String(data.user.id))));

  await db
    .insert(aircallOnCall)
    .values({
      aircallCallId: String(data.id),
      orgId,
      userId: matchedUser?.id ?? null,
      userName: data.user.name,
      phone: data.raw_digits ?? null,
      direction: data.direction ?? null,
    })
    .onConflictDoUpdate({
      target: aircallOnCall.aircallCallId,
      set: { userName: data.user.name, phone: data.raw_digits ?? null, direction: data.direction ?? null },
    });
}

async function handleCallEnded(orgId: string, data: AircallWebhookBody["data"]) {
  if (!data.raw_digits) return;

  const [matchedUser] = data.user
    ? await db.select({ id: users.id }).from(users).where(and(eq(users.orgId, orgId), eq(users.aircallUserId, String(data.user.id))))
    : [null];

  const lead = await findLeadByPhone(orgId, data.raw_digits, matchedUser?.id ?? null);
  if (!lead) return;

  // call_logs.loggedBy is required — fall back to the lead's owner when the
  // dialing rep couldn't be matched to an Aircall user id (not linked yet).
  // If neither resolves, there's no sensible attribution for this call log,
  // so it's skipped entirely rather than writing a broken reference.
  const loggedBy = matchedUser?.id ?? lead.ownerId;
  if (!loggedBy) return;

  const answered = Boolean(data.answered_at);
  const durationSeconds = data.duration ?? null;

  let recordingKey: string | null = null;
  if (data.recording) {
    // Aircall's recording URLs expire quickly — pull it down and store it
    // ourselves rather than persisting a URL that goes stale.
    try {
      const res = await fetch(data.recording);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        recordingKey = await uploadObject({ keyPrefix: "call-recordings", fileName: `${data.id}.mp3`, contentType: "audio/mpeg", body: buffer });
      }
    } catch {
      // Recording download failures shouldn't block the rest of call.ended processing.
    }
  }

  // outcome is left null here — this row is the technical record of the
  // call itself (duration/recording/transcript), written before the rep has
  // had a chance to qualify what happened. logCallOutcomeAction inserts its
  // own row with the rep's chosen outcome (and is what actually increments
  // callsMadeCount) once they respond to the call_outcome_pending nudge
  // below — deliberately NOT incremented here too, which would double-count
  // against that. One real deviation from the source system (whose single
  // call_history row covers both the technical record and the outcome, so
  // it only ever increments once, right here) — a consequence of this app's
  // outcome-logging being its own separate action rather than a patch onto
  // the same row.
  const [callLog] = await db
    .insert(callLogs)
    .values({
      orgId,
      leadId: lead.id,
      loggedBy,
      via: "aircall",
      aircallCallId: String(data.id),
      direction: data.direction ?? null,
      durationSeconds,
      recordingKey,
      transcriptStatus: "pending",
    })
    .returning({ id: callLogs.id });

  await db.update(leads).set({ lastActivityAt: new Date() }).where(eq(leads.id, lead.id));

  await logLeadActivity({ orgId, leadId: lead.id, actorId: matchedUser?.id ?? null, type: "call_started", payload: { via: "aircall", aircallCallId: data.id } });

  // Only nudge for answered calls — a missed call has no outcome to qualify.
  if (matchedUser && answered) {
    const [leadRow] = await db.select({ firstName: leads.firstName, lastName: leads.lastName }).from(leads).where(eq(leads.id, lead.id));
    await createCallOutcomePendingNotification({
      orgId,
      recipientUserId: matchedUser.id,
      leadId: lead.id,
      leadName: leadRow ? `${leadRow.firstName} ${leadRow.lastName}`.trim() || "this lead" : "this lead",
      callLogId: callLog.id,
    });
  }
}

async function handleCallPatch(data: AircallWebhookBody["data"]) {
  const notes = data.comments?.map((c) => c.content).join("\n") || undefined;
  const tags = data.tags?.map((t) => t.name).join(", ") || undefined;
  if (!notes && !tags) return;
  await db
    .update(callLogs)
    .set({ ...(notes ? { notes } : {}) })
    .where(eq(callLogs.aircallCallId, String(data.id)));
}

async function handleTranscriptionCreated(orgId: string, data: AircallWebhookBody["data"]) {
  const raw = data.transcription ?? data.transcript;
  const transcript = typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : null;
  if (!transcript) return;

  const [row] = await db
    .update(callLogs)
    .set({ transcript, transcriptStatus: "ready" })
    .where(eq(callLogs.aircallCallId, String(data.id)))
    .returning({ id: callLogs.id, orgId: callLogs.orgId });

  if (row) {
    await enqueueScoreCall({ orgId: row.orgId, callLogId: row.id });
  }
}

async function handleSummaryCreated(data: AircallWebhookBody["data"]) {
  const summary = typeof data.summary === "string" ? data.summary : data.summary ? JSON.stringify(data.summary) : null;
  if (!summary) return;
  await db.update(callLogs).set({ aiSummary: summary }).where(eq(callLogs.aircallCallId, String(data.id)));
}

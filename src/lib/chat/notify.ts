import "server-only";

import postgres from "postgres";
import { CHAT_NOTIFY_CHANNEL, type ChatEvent } from "./events";

const databaseUrl = process.env.DATABASE_URL;

// NOTIFY payloads are capped at 8000 bytes by Postgres; keep the pushed
// preview short and let the chat-ws client re-fetch full detail via the
// existing message-list query if it ever needs more than this carries.
const MAX_BODY_PREVIEW = 2000;

// One small dedicated connection, reused across calls and across hot
// reloads in dev — a fresh connection per `notify` would add real latency
// under load, and the app's main pool (capped at 1 in dev, see
// lib/db/index.ts) shouldn't be shared with this fire-and-forget path.
const globalForChatNotify = globalThis as unknown as { __chatNotifySql?: postgres.Sql };

function getNotifySql(): postgres.Sql | null {
  if (!databaseUrl) return null;
  if (!globalForChatNotify.__chatNotifySql) {
    globalForChatNotify.__chatNotifySql = postgres(databaseUrl, { max: 1 });
  }
  return globalForChatNotify.__chatNotifySql;
}

export async function notifyChatEvent(event: ChatEvent): Promise<void> {
  const sql = getNotifySql();
  if (!sql) return;

  const trimmed: ChatEvent =
    event.type === "message"
      ? { ...event, message: { ...event.message, body: event.message.body.slice(0, MAX_BODY_PREVIEW) } }
      : event.type === "message_edited"
        ? { ...event, body: event.body.slice(0, MAX_BODY_PREVIEW) }
        : event;

  await sql.notify(CHAT_NOTIFY_CHANNEL, JSON.stringify(trimmed));
}

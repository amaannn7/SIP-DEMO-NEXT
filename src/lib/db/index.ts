import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// Reuse a single connection pool across hot reloads in dev, and across
// invocations in a long-running Node process in production.
const globalForDb = globalThis as unknown as {
  __dbClient?: postgres.Sql;
};

const client =
  globalForDb.__dbClient ??
  postgres(databaseUrl, {
    // max: 1 in dev used to serialize every request (page loads, server
    // actions, and the notification/chat/AI-job polling queries all fighting
    // over one connection) — that's what was behind requests taking
    // 30-150s. The client is reused across hot reloads via globalForDb
    // either way, so a small pool is safe here too.
    max: process.env.NODE_ENV === "production" ? 10 : 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dbClient = client;
}

export const db = drizzle(client, { schema });

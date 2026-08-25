import "server-only";

import { PgBoss } from "pg-boss";

/**
 * pg-boss queue names — one per AI job type, matching jobTypeEnum in the
 * schema. Kept 1:1 with the enum so a job_runs.type value maps directly to
 * a queue name.
 */
export const QUEUE_NAMES = {
  enrichLead: "enrich_lead",
  generateEmail: "generate_email",
  generateCallPitch: "generate_call_pitch",
  scoreCall: "score_call",
  reconcileTranscripts: "reconcile_transcripts",
} as const;

export type EnrichLeadJobData = { jobRunId: string; orgId: string; leadId: string };
export type GenerateEmailJobData = {
  jobRunId: string;
  orgId: string;
  leadId: string;
  actorId: string;
  sequenceStep: "initial" | "followup1" | "followup2" | "breakup";
  customInstructions?: string;
  includeSignature?: boolean;
};
export type GenerateCallPitchJobData = {
  jobRunId: string;
  orgId: string;
  leadId: string;
  pitchType: "cold_with_email" | "cold_no_email" | "callback" | "discovery" | "demo";
  customInstructions?: string;
};
export type ScoreCallJobData = { jobRunId: string; orgId: string; callLogId: string };

// Reuse a single boss instance across hot reloads in dev, same pattern as
// lib/db/index.ts's connection pool.
const globalForBoss = globalThis as unknown as { __pgBoss?: PgBoss };

function createBoss(): PgBoss {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  const boss = new PgBoss(databaseUrl);
  // pg-boss is an EventEmitter — a transient DB hiccup (connection reset,
  // pool timeout) emits 'error', and Node treats an unlistened 'error' event
  // as fatal, crashing the whole worker process. Log and keep running
  // instead; pg-boss retries its own polling loop after a connection error.
  boss.on("error", (err) => {
    console.error("pg-boss error:", err);
  });
  return boss;
}

export function getBoss(): PgBoss {
  if (!globalForBoss.__pgBoss) {
    globalForBoss.__pgBoss = createBoss();
  }
  return globalForBoss.__pgBoss;
}

let startPromise: Promise<PgBoss> | null = null;

/** Idempotent — safe to call from every Server Action that enqueues a job. */
export async function getStartedBoss(): Promise<PgBoss> {
  const boss = getBoss();
  if (!startPromise) {
    startPromise = boss.start().then(async (started) => {
      for (const queueName of Object.values(QUEUE_NAMES)) {
        await started.createQueue(queueName);
      }
      return started;
    });
  }
  return startPromise;
}

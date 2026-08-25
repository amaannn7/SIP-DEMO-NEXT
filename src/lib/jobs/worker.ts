import "server-only";

import {
  getStartedBoss,
  QUEUE_NAMES,
  type EnrichLeadJobData,
  type GenerateEmailJobData,
  type GenerateCallPitchJobData,
  type ScoreCallJobData,
} from "./queue";
import { handleEnrichLead } from "./handlers/enrich-lead";
import { handleGenerateEmail } from "./handlers/generate-email";
import { handleGenerateCallPitch } from "./handlers/generate-call-pitch";
import { handleScoreCall } from "./handlers/score-call";
import { reconcileTranscripts } from "./handlers/reconcile-transcripts";

/** Registers all AI job handlers with pg-boss. Call once from the worker entrypoint (scripts/worker.ts). */
export async function startWorker(): Promise<void> {
  const boss = await getStartedBoss();

  await boss.work<EnrichLeadJobData>(QUEUE_NAMES.enrichLead, async ([job]) => {
    await handleEnrichLead(job.data);
  });

  await boss.work<GenerateEmailJobData>(QUEUE_NAMES.generateEmail, async ([job]) => {
    await handleGenerateEmail(job.data);
  });

  await boss.work<GenerateCallPitchJobData>(QUEUE_NAMES.generateCallPitch, async ([job]) => {
    await handleGenerateCallPitch(job.data);
  });

  await boss.work<ScoreCallJobData>(QUEUE_NAMES.scoreCall, async ([job]) => {
    await handleScoreCall(job.data);
  });

  await boss.work(QUEUE_NAMES.reconcileTranscripts, async () => {
    await reconcileTranscripts();
  });
  // Every 5 minutes, matching the source system's cron cadence for its
  // reconcile-transcripts sweep — pg-boss's native scheduling replaces that
  // system's separate cron-hits-an-endpoint script.
  await boss.schedule(QUEUE_NAMES.reconcileTranscripts, "*/5 * * * *");

  console.log("AI job worker started, listening on:", Object.values(QUEUE_NAMES).join(", "));
}

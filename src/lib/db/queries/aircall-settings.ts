import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aircallSettings } from "@/lib/db/schema";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/ai/key-encryption";

export type AircallSettingsView = {
  /** The admin's own toggle state, as configured — shown honestly on the settings page even when incomplete, so they can see what they set. */
  isEnabled: boolean;
  /** True whenever the toggle is on — gates whether the dial/call-history UI shows up on the Call tab. Credentials aren't required for this to be true: without them the dial button still renders, and clicking it returns a clear "not configured yet" message rather than crashing (see dialLeadViaAircallAction). */
  isOperational: boolean;
  scoringEnabled: boolean;
  scoringProvider: string;
  minCallDurationSeconds: number;
  minTranscriptConfidence: number;
  maskedApiId: string | null;
  maskedApiToken: string | null;
  hasWebhookToken: boolean;
};

const DEFAULTS: AircallSettingsView = {
  isEnabled: false,
  isOperational: false,
  scoringEnabled: false,
  scoringProvider: "groq",
  minCallDurationSeconds: 60,
  minTranscriptConfidence: 0.75,
  maskedApiId: null,
  maskedApiToken: null,
  hasWebhookToken: false,
};

export async function getAircallSettingsView(orgId: string): Promise<AircallSettingsView> {
  const row = await db.query.aircallSettings.findFirst({ where: eq(aircallSettings.orgId, orgId) });
  if (!row) return DEFAULTS;
  return {
    isEnabled: row.isEnabled,
    isOperational: row.isEnabled,
    scoringEnabled: row.scoringEnabled,
    scoringProvider: row.scoringProvider,
    minCallDurationSeconds: row.minCallDurationSeconds,
    minTranscriptConfidence: row.minTranscriptConfidence,
    maskedApiId:
      row.encryptedApiId && row.apiIdNonce ? maskApiKey(decryptApiKey(row.encryptedApiId, row.apiIdNonce)) : null,
    maskedApiToken:
      row.encryptedApiToken && row.apiTokenNonce
        ? maskApiKey(decryptApiKey(row.encryptedApiToken, row.apiTokenNonce))
        : null,
    hasWebhookToken: Boolean(row.encryptedWebhookToken),
  };
}

/** Decrypts the real API id/token for making a live Aircall API call (dial, ping) — never returned to the client, only used server-side. */
export async function getAircallCredentials(orgId: string): Promise<{ apiId: string; apiToken: string } | null> {
  const row = await db.query.aircallSettings.findFirst({ where: eq(aircallSettings.orgId, orgId) });
  if (!row?.encryptedApiId || !row.apiIdNonce || !row.encryptedApiToken || !row.apiTokenNonce) return null;
  return {
    apiId: decryptApiKey(row.encryptedApiId, row.apiIdNonce),
    apiToken: decryptApiKey(row.encryptedApiToken, row.apiTokenNonce),
  };
}

/** Used by the webhook receiver to verify the shared token — decrypted once per request. */
export async function getAircallWebhookToken(orgId: string): Promise<string | null> {
  const row = await db.query.aircallSettings.findFirst({ where: eq(aircallSettings.orgId, orgId) });
  if (!row?.encryptedWebhookToken || !row.webhookTokenNonce) return null;
  return decryptApiKey(row.encryptedWebhookToken, row.webhookTokenNonce);
}

async function ensureRow(orgId: string) {
  await db.insert(aircallSettings).values({ orgId }).onConflictDoNothing();
}

export async function saveAircallCredentials(orgId: string, apiId: string, apiToken: string): Promise<void> {
  await ensureRow(orgId);
  const id = encryptApiKey(apiId);
  const token = encryptApiKey(apiToken);
  await db
    .update(aircallSettings)
    .set({
      encryptedApiId: id.encryptedKey,
      apiIdNonce: id.keyNonce,
      encryptedApiToken: token.encryptedKey,
      apiTokenNonce: token.keyNonce,
      updatedAt: new Date(),
    })
    .where(eq(aircallSettings.orgId, orgId));
}

export async function saveAircallWebhookToken(orgId: string, token: string): Promise<void> {
  await ensureRow(orgId);
  const encrypted = encryptApiKey(token);
  await db
    .update(aircallSettings)
    .set({ encryptedWebhookToken: encrypted.encryptedKey, webhookTokenNonce: encrypted.keyNonce, updatedAt: new Date() })
    .where(eq(aircallSettings.orgId, orgId));
}

export async function setAircallEnabled(orgId: string, isEnabled: boolean): Promise<void> {
  await ensureRow(orgId);
  await db.update(aircallSettings).set({ isEnabled, updatedAt: new Date() }).where(eq(aircallSettings.orgId, orgId));
}

export async function saveScoringSettings(
  orgId: string,
  fields: { scoringEnabled: boolean; scoringProvider: string; minCallDurationSeconds: number; minTranscriptConfidence: number },
): Promise<void> {
  await ensureRow(orgId);
  await db
    .update(aircallSettings)
    .set({
      scoringEnabled: fields.scoringEnabled,
      scoringProvider: fields.scoringProvider as "groq" | "gemini" | "anthropic" | "cerebras",
      minCallDurationSeconds: fields.minCallDurationSeconds,
      minTranscriptConfidence: fields.minTranscriptConfidence,
      updatedAt: new Date(),
    })
    .where(eq(aircallSettings.orgId, orgId));
}

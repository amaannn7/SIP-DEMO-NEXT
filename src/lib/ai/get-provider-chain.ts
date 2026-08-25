import "server-only";

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, orgSettings } from "@/lib/db/schema";
import { decryptApiKey } from "./key-encryption";
import type { LLMProvider } from "./provider";
import { groqProvider } from "./providers/groq";
import { cerebrasProvider } from "./providers/cerebras";
import { geminiProvider } from "./providers/gemini";
import { anthropicProvider } from "./providers/anthropic";

/**
 * Fallback order ports the source system's callLLM chain exactly:
 * groq -> cerebras -> gemini -> anthropic. The org's preferred provider (if
 * it has a key configured) is tried first, then the rest of the chain in
 * this fixed order.
 */
const FALLBACK_ORDER: LLMProvider[] = [groqProvider, cerebrasProvider, geminiProvider, anthropicProvider];

export type ResolvedProvider = { provider: LLMProvider; apiKey: string };

/**
 * Builds the ordered list of (provider, decrypted key) pairs to try for an
 * org, preferred provider first. Providers with no active key configured
 * are skipped entirely rather than attempted and failed.
 */
export async function getProviderChain(orgId: string): Promise<ResolvedProvider[]> {
  const [settings, keyRows] = await Promise.all([
    db.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) }),
    db.query.apiKeys.findMany({ where: and(eq(apiKeys.orgId, orgId), eq(apiKeys.isActive, true)) }),
  ]);

  const keyByProvider = new Map(keyRows.map((row) => [row.provider, row]));
  const preferred = settings?.aiProviderPreference;

  const ordered = preferred
    ? [FALLBACK_ORDER.find((p) => p.name === preferred), ...FALLBACK_ORDER.filter((p) => p.name !== preferred)].filter(
        (p): p is LLMProvider => p !== undefined,
      )
    : FALLBACK_ORDER;

  const resolved: ResolvedProvider[] = [];
  for (const provider of ordered) {
    const row = keyByProvider.get(provider.name);
    if (!row) continue;
    resolved.push({ provider, apiKey: decryptApiKey(row.encryptedKey, row.keyNonce) });
  }
  return resolved;
}

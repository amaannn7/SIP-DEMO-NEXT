import "server-only";

import { getProviderChain } from "./get-provider-chain";

export type CallLLMResult =
  | { success: true; content: string; provider: string }
  | { success: false; error: string };

/**
 * Ports the source system's callLLM: tries configured providers in order
 * (preferred provider first, then the fixed groq -> cerebras -> gemini ->
 * anthropic fallback chain), falling through to the next one on ANY
 * failure — rate limit, bad key, malformed response. The goal is "get an
 * answer," not "surface exactly which provider broke."
 */
export async function callLLM(orgId: string, prompt: string): Promise<CallLLMResult> {
  const chain = await getProviderChain(orgId);
  if (chain.length === 0) {
    return { success: false, error: "No AI provider is configured for this organization." };
  }

  let lastErrorWasRateLimit = false;
  for (const { provider, apiKey } of chain) {
    const result = await provider.generateText(prompt, apiKey);
    if (result.success) {
      return { success: true, content: result.content, provider: provider.name };
    }
    // Logged server-side only, for debugging — never shown to the user (see
    // the sanitized message below).
    console.error(`[callLLM] provider "${provider.name}" failed:`, result.error);
    lastErrorWasRateLimit = /rate.?limit/i.test(result.error);
  }

  // This message reaches the end user verbatim (job_runs.error -> the lead
  // detail page's error box) — every provider's own raw error (often a full
  // JSON payload with internal model names/error codes) used to be
  // interpolated straight into it. A rate-limit is common enough and
  // actionable enough to name specifically; anything else collapses to one
  // generic line instead of leaking provider implementation details.
  const reason = lastErrorWasRateLimit ? "the AI provider is rate-limited right now" : "the AI provider returned an error";
  return { success: false, error: `Generation failed — ${reason}. Please try again in a moment.` };
}

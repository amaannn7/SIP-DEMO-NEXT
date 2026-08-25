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

  let lastError = "Unknown error";
  for (const { provider, apiKey } of chain) {
    const result = await provider.generateText(prompt, apiKey);
    if (result.success) {
      return { success: true, content: result.content, provider: provider.name };
    }
    lastError = result.error;
  }

  return { success: false, error: `All AI providers failed. Last error: ${lastError}` };
}

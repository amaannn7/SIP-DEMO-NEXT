/**
 * Provider abstraction replacing the source system's callLLM ->
 * callGroq/callGemini/callAnthropic/callCerebras switch statement. Adding a
 * 5th provider is "add a file that implements this interface," not "edit a
 * switch statement."
 */
export type LLMResult =
  | { success: true; content: string }
  | { success: false; error: string; status?: number };

export interface LLMProvider {
  readonly name: "groq" | "gemini" | "anthropic" | "cerebras";
  generateText(prompt: string, apiKey: string): Promise<LLMResult>;
}

/**
 * Groq/Gemini/Anthropic/Cerebras all phrase rate-limit errors differently,
 * and not every failure includes a reliable status code — checks both the
 * HTTP status (429) and common wording as a safety net. Ports the source
 * system's isRateLimitError exactly.
 */
export function isRateLimitError(result: LLMResult): boolean {
  if (!result.success) {
    if (result.status === 429) return true;
    const msg = result.error.toLowerCase();
    return (
      msg !== "" &&
      (msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("tokens per day") ||
        msg.includes("resource_exhausted"))
    );
  }
  return false;
}

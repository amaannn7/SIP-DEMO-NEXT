import type { LLMProvider, LLMResult } from "../provider";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
// Current at time of writing — the legacy system had this pinned to a stale
// snapshot (claude-sonnet-4-20250514); keep this updated as new models ship.
const MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_VERSION = "2023-06-01";
// Ported verbatim from the source system's callAnthropic() — every prompt in
// this app (enrichment/email/call-pitch/NBA) already states its own output
// format, but this system prompt is a real behavioral input Anthropic
// receives on every call, not just architecture, so it's worth matching.
const SYSTEM_PROMPT =
  "You are a B2B sales intelligence AI. Always return valid JSON when asked for structured data. Be specific, practical, and focused on driving conversions.";

export const anthropicProvider: LLMProvider = {
  name: "anthropic",
  async generateText(prompt, apiKey) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "network error" };
    }

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: body, status: res.status };
    }

    const data = (await res.json()) as {
      content?: { type?: string; text?: string }[];
    };
    const content = data.content?.find((block) => block.type === "text")?.text;
    if (!content) {
      return { success: false, error: "Anthropic response had no content" };
    }
    return { success: true, content } satisfies LLMResult;
  },
};

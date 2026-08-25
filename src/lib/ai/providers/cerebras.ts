import type { LLMProvider, LLMResult } from "../provider";

const ENDPOINT = "https://api.cerebras.ai/v1/chat/completions";
// llama-3.3-70b is deprecated on Cerebras; gpt-oss-120b is the current
// flagship model there too (same model Groq serves — see groq.ts), so both
// providers now agree on model choice, not just token budget.
const MODEL = "gpt-oss-120b";
// Matches Groq's budget for the same reason: the largest structured response
// this app asks for (research/enrichment JSON) needs real headroom, and
// there's no upside to leaving this at a provider default that might be lower.
const MAX_TOKENS = 4096;

export const cerebrasProvider: LLMProvider = {
  name: "cerebras",
  async generateText(prompt, apiKey) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: MAX_TOKENS,
          temperature: 0.7,
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
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { success: false, error: "Cerebras response had no content" };
    }
    return { success: true, content } satisfies LLMResult;
  },
};

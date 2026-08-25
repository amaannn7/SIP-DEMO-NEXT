import type { LLMProvider, LLMResult } from "../provider";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";
// gpt-oss-120b is a reasoning model that spends part of its token budget on
// an internal "reasoning" field before ever writing visible content — the
// source system found the smaller default silently truncated `content` to
// empty (finish_reason: length) on larger structured responses like
// research/enrichment, with no error surfaced. Confirmed empirically there;
// ported forward since this is the same model, not a different one.
const MAX_TOKENS = 4096;

export const groqProvider: LLMProvider = {
  name: "groq",
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
      return { success: false, error: "Groq response had no content" };
    }
    return { success: true, content } satisfies LLMResult;
  },
};

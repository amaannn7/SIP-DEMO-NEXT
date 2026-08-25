import type { LLMProvider, LLMResult } from "../provider";

const MODEL = "gemini-2.0-flash";
const ENDPOINT = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

export const geminiProvider: LLMProvider = {
  name: "gemini",
  async generateText(prompt, apiKey) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
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
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      return {
        success: false,
        error: data.promptFeedback?.blockReason ?? "Gemini response had no content",
      };
    }
    return { success: true, content } satisfies LLMResult;
  },
};

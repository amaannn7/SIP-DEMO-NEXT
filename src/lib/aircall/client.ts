import "server-only";

const BASE_URL = "https://api.aircall.io/v1";

function authHeader(apiId: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${apiId}:${apiToken}`).toString("base64")}`;
}

async function aircallRequest<T = unknown>(
  apiId: string,
  apiToken: string,
  path: string,
  init?: RequestInit,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader(apiId, apiToken),
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, error: `Aircall API error ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as T;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Aircall request failed" };
  }
}

/** Connection test — ports the source system's test-aircall (GET /ping). */
export async function pingAircall(apiId: string, apiToken: string): Promise<{ success: boolean; error?: string }> {
  const result = await aircallRequest(apiId, apiToken, "/ping");
  return result.success ? { success: true } : { success: false, error: result.error };
}

/** Click-to-dial — ports the source system's aircall-dial (POST /users/{id}/calls). Aircall's own app rings first; the lead is only dialed once the rep answers. */
export async function dialLead(
  apiId: string,
  apiToken: string,
  aircallUserId: string,
  numberId: string,
  toE164: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await aircallRequest(apiId, apiToken, `/users/${aircallUserId}/calls`, {
    method: "POST",
    body: JSON.stringify({ number_id: Number(numberId), to: toE164 }),
  });
  return result.success ? { success: true } : { success: false, error: result.error };
}

type TranscriptionResponse = { transcription?: unknown; transcript?: unknown };

/** Ports the source system's direct transcript fetch (GET /calls/{id}/transcription) — used both as a webhook fallback and by the reconcile sweep. */
export async function fetchTranscript(
  apiId: string,
  apiToken: string,
  callId: string,
): Promise<{ success: true; transcript: string } | { success: false; error: string }> {
  const result = await aircallRequest<TranscriptionResponse>(apiId, apiToken, `/calls/${callId}/transcription`);
  if (!result.success) return result;
  const raw = result.data.transcription ?? result.data.transcript;
  if (typeof raw === "string") return { success: true, transcript: raw };
  if (raw) return { success: true, transcript: JSON.stringify(raw) };
  return { success: false, error: "No transcript in response" };
}

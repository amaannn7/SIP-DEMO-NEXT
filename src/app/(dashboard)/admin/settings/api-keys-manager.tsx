"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { MaskedApiKey } from "@/lib/db/queries/org-settings";
import { saveApiKeyAction, deleteApiKeyAction, updateProviderPreferenceAction, testApiKeyAction } from "./ai-actions";

const PROVIDERS = [
  { value: "groq", label: "Groq" },
  { value: "cerebras", label: "Cerebras" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
] as const;

export function ApiKeysManager({
  keys,
  preferredProvider,
}: {
  keys: MaskedApiKey[];
  preferredProvider: string;
}) {
  const keyByProvider = new Map(keys.map((k) => [k.provider, k]));

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="provider-preference">
          Preferred provider
        </label>
        <form action={updateProviderPreferenceAction}>
          <select
            id="provider-preference"
            name="provider"
            defaultValue={preferredProvider}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </form>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Tried first; automatically falls back through the other configured providers on failure.
        </p>
      </div>

      <div className="divide-y divide-border rounded-md border border-border">
        {PROVIDERS.map((p) => (
          <ProviderRow key={p.value} provider={p.value} label={p.label} existing={keyByProvider.get(p.value)} />
        ))}
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  label,
  existing,
}: {
  provider: string;
  label: string;
  existing?: MaskedApiKey;
}) {
  const [editing, setEditing] = useState(!existing);
  const [state, formAction] = useActionState(saveApiKeyAction, {});
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !state.error) {
      setEditing(false);
    }
    submittedRef.current = false;
  }, [state]);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-24 shrink-0 text-sm font-medium text-foreground">{label}</div>

      {editing ? (
        <form
          action={formAction}
          onSubmit={() => {
            submittedRef.current = true;
          }}
          className="flex flex-1 items-center gap-2"
        >
          <input type="hidden" name="provider" value={provider} />
          <input
            type="password"
            name="apiKey"
            placeholder="Paste API key"
            autoComplete="off"
            className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <SaveButton />
          {existing && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          )}
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{existing?.masked}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-xs text-muted-foreground underline decoration-dotted hover:text-foreground"
          >
            Replace
          </button>
          <TestConnectionButton provider={provider} />
          <form action={deleteApiKeyAction.bind(null, provider)}>
            <button
              type="submit"
              className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label={`Remove ${label} key`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </form>
        </div>
      )}

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}

function TestConnectionButton({ provider }: { provider: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  function handleTest() {
    setResult(null);
    startTransition(async () => {
      const res = await testApiKeyAction(provider);
      setResult(res);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleTest}
        disabled={isPending}
        className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-60"
      >
        {isPending && <Loader2 className="size-3 animate-spin" />}
        Test
      </button>
      {result?.success && <CheckCircle2 className="size-3.5 text-success" aria-label="Connected" />}
      {result && !result.success && <XCircle className="size-3.5 text-destructive" aria-label={result.error ?? "Failed"} />}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

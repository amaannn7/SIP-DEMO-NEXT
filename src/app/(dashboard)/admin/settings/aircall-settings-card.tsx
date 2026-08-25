"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Phone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { AircallSettingsView } from "@/lib/db/queries/aircall-settings";
import {
  saveAircallCredentialsAction,
  generateAircallWebhookTokenAction,
  setAircallEnabledAction,
  saveScoringSettingsAction,
  testAircallConnectionAction,
} from "./aircall-actions";

const PROVIDERS = [
  { value: "groq", label: "Groq" },
  { value: "cerebras", label: "Cerebras" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Anthropic" },
] as const;

export function AircallSettingsCard({
  settings,
  orgId,
  canConfigure,
}: {
  settings: AircallSettingsView;
  orgId: string;
  /** Only super_admin can edit Aircall config; other admins see the card (so it's not invisible) with a "Not configured" read-only note instead of live forms they can't submit. */
  canConfigure: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(settings.isEnabled);

  function toggleEnabled() {
    const next = !isEnabled;
    setIsEnabled(next);
    setAircallEnabledAction(next);
  }

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/aircall/${orgId}` : `/api/webhooks/aircall/${orgId}`;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5 lg:col-span-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Aircall</h3>
        </div>
        {canConfigure ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Enabled
            <input type="checkbox" checked={isEnabled} onChange={toggleEnabled} className="size-3.5 accent-[var(--primary)]" />
          </label>
        ) : (
          <span className={`text-xs font-medium ${isEnabled ? "text-success" : "text-muted-foreground"}`}>
            {isEnabled ? "Enabled" : "Disabled"}
          </span>
        )}
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">
        Click-to-dial and live call events. Requires an Aircall account with API access.
      </p>

      {!canConfigure ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Not configured. Only a super admin can set up Aircall credentials and scoring.
        </p>
      ) : (
        <>
          {isEnabled && !settings.maskedApiId && (
            <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-warning-foreground">
              Enabled, but no API credentials are saved yet. Dialing won&rsquo;t work anywhere in the app until you add
              them below.
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <CredentialsForm maskedApiId={settings.maskedApiId} maskedApiToken={settings.maskedApiToken} />
              <WebhookTokenSection hasToken={settings.hasWebhookToken} webhookUrl={webhookUrl} />
            </div>
            <ScoringForm settings={settings} />
          </div>
        </>
      )}
    </div>
  );
}

function CredentialsForm({ maskedApiId, maskedApiToken }: { maskedApiId: string | null; maskedApiToken: string | null }) {
  const [editing, setEditing] = useState(!maskedApiId);
  const [state, formAction] = useActionState(saveAircallCredentialsAction, {});
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !state.error) setEditing(false);
    submittedRef.current = false;
  }, [state]);

  if (!editing) {
    return (
      <div className="rounded-md border border-border p-3">
        <p className="mb-2 text-xs font-medium text-foreground">API credentials</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">ID {maskedApiId} · Token {maskedApiToken}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted-foreground underline decoration-dotted hover:text-foreground">
            Replace
          </button>
          <TestConnectionButton />
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="space-y-2 rounded-md border border-border p-3"
    >
      <p className="mb-1 text-xs font-medium text-foreground">API credentials</p>
      <input
        type="password"
        name="apiId"
        placeholder="API ID"
        autoComplete="off"
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
      />
      <input
        type="password"
        name="apiToken"
        placeholder="API Token"
        autoComplete="off"
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
      />
      <div className="flex items-center gap-2">
        <SaveButton />
        {maskedApiId && (
          <button type="button" onClick={() => setEditing(false)} className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted">
            Cancel
          </button>
        )}
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

function WebhookTokenSection({ hasToken, webhookUrl }: { hasToken: boolean; webhookUrl: string }) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-md border border-border p-3">
      <p className="mb-2 text-xs font-medium text-foreground">Webhook</p>
      <div className="mb-2 flex items-center gap-2">
        <input readOnly value={webhookUrl} className="h-8 flex-1 rounded-md border border-input bg-muted/40 px-2 font-mono text-[11px] text-muted-foreground" />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(webhookUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="h-8 shrink-0 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Subscribe to: call.created, call.answered, call.hungup, call.ended, call.commented, call.tagged,
        transcription.created, summary.created.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          await generateAircallWebhookTokenAction();
          toast.success("New webhook token generated");
        })}
        className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
      >
        {hasToken ? "Regenerate token" : "Generate token"}
      </button>
    </div>
  );
}

function ScoringForm({ settings }: { settings: AircallSettingsView }) {
  const [enabled, setEnabled] = useState(settings.scoringEnabled);
  const [provider, setProvider] = useState(settings.scoringProvider);
  const [minDuration, setMinDuration] = useState(settings.minCallDurationSeconds);
  const [minConfidence, setMinConfidence] = useState(settings.minTranscriptConfidence);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveScoringSettingsAction({
        scoringEnabled: enabled,
        scoringProvider: provider as (typeof PROVIDERS)[number]["value"],
        minCallDurationSeconds: minDuration,
        minTranscriptConfidence: minConfidence,
      });
      if (result.error) toast.error(result.error);
      else toast.success("Scoring settings saved");
    });
  }

  return (
    <div className="space-y-2.5 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">AI call scoring</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Enabled
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-3.5 accent-[var(--primary)]" />
        </label>
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Min duration (s)</label>
          <input
            type="number"
            value={minDuration}
            onChange={(e) => setMinDuration(Number(e.target.value))}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Min confidence</label>
          <input
            type="number"
            step="0.05"
            min={0}
            max={1}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={save}
        className="h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--primary)" }}
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function TestConnectionButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const res = await testAircallConnectionAction();
            setResult(res);
          })
        }
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

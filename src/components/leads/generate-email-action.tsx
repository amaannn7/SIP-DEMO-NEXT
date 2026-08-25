"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerGenerateEmailAction } from "@/app/(dashboard)/leads/[id]/ai-actions";
import { useAiJobTrigger } from "./use-ai-job-trigger";

// Ports the source system's own step descriptions from generateEmailContent()
// (each case's leading comment: "sent a few days after initial got no
// reply," "final value-add before a breakup email," etc.) so the sequence
// reads as a clear step-by-step cadence — the email equivalent of the call
// script's branch labels telling a rep what each part of the flow is for.
const EMAIL_STEPS = [
  { value: "initial", label: "Initial", hint: "First outreach, personalized to their research" },
  { value: "followup1", label: "Follow-up 1", hint: "3-4 days after initial, if no reply. Adds new value" },
  { value: "followup2", label: "Follow-up 2", hint: "Final value-add before the breakup email" },
  { value: "breakup", label: "Breakup", hint: "Last touch, closes the loop, no hard feelings" },
] as const;

/** Ports the source system's .email-type-tabs row exactly: a plain row of
 * clickable step tabs above the generate action, rather than a step picker
 * squeezed into a dropdown attached to the button — the four step names
 * (Initial / Follow-up 1 / Follow-up 2 / Breakup) need to read as the tab
 * row they are, not be truncated inside a small <select>. */
export function GenerateEmailAction({ leadId }: { leadId: string }) {
  const [emailStep, setEmailStep] = useState<(typeof EMAIL_STEPS)[number]["value"]>("initial");
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const { trigger, isBusy, error } = useAiJobTrigger(() =>
    triggerGenerateEmailAction(leadId, emailStep, customInstructions, includeSignature),
  );
  const activeStep = EMAIL_STEPS.find((s) => s.value === emailStep)!;

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {EMAIL_STEPS.map((step) => (
          <button
            key={step.value}
            type="button"
            onClick={() => setEmailStep(step.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              emailStep === step.value
                ? "border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]"
                : "border-border text-foreground hover:bg-muted",
            )}
          >
            {step.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{activeStep.hint}</p>

      <textarea
        value={customInstructions}
        onChange={(e) => setCustomInstructions(e.target.value)}
        placeholder="Custom instructions for this email (optional), overrides default guidance"
        rows={2}
        maxLength={1000}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
      />

      <label className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={includeSignature}
          onChange={(e) => setIncludeSignature(e.target.checked)}
          className="size-3.5 rounded border-input accent-[var(--primary)]"
        />
        Include signature
      </label>

      <button
        type="button"
        onClick={trigger}
        disabled={isBusy}
        className="flex h-9 w-fit items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
      >
        {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
        {isBusy ? "Generating…" : `Generate ${activeStep.label.toLowerCase()} email`}
      </button>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

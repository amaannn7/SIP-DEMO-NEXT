"use client";

import { useState } from "react";
import { Loader2, Phone, ChevronDown } from "lucide-react";
import { triggerGenerateCallPitchAction } from "@/app/(dashboard)/leads/[id]/ai-actions";
import { useAiJobTrigger } from "./use-ai-job-trigger";

const PITCH_TYPES = [
  { value: "cold_with_email", label: "Cold call (email sent)" },
  { value: "cold_no_email", label: "Cold call (no email)" },
  { value: "callback", label: "Call back" },
  { value: "discovery", label: "Discovery call" },
  { value: "demo", label: "Demo intro" },
] as const;

export function GenerateCallPitchAction({ leadId }: { leadId: string }) {
  const [pitchType, setPitchType] = useState<(typeof PITCH_TYPES)[number]["value"]>("cold_with_email");
  const [customInstructions, setCustomInstructions] = useState("");
  const { trigger, isBusy, error } = useAiJobTrigger(() =>
    triggerGenerateCallPitchAction(leadId, pitchType, customInstructions),
  );

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex items-center rounded-full border border-border bg-card pl-3.5">
        <select
          value={pitchType}
          onChange={(e) => setPitchType(e.target.value as typeof pitchType)}
          className="h-9 appearance-none bg-transparent pr-1 text-xs font-medium text-foreground outline-none"
        >
          {PITCH_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        <ChevronDown className="mr-1.5 size-3 text-muted-foreground" />
        <button
          type="button"
          onClick={trigger}
          disabled={isBusy}
          className="-m-px flex h-9 items-center gap-1.5 rounded-r-full bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
        >
          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Phone className="size-3.5" />}
          {isBusy ? "Generating…" : "Generate script"}
        </button>
      </div>

      <textarea
        value={customInstructions}
        onChange={(e) => setCustomInstructions(e.target.value)}
        placeholder="Custom instructions for this call pitch (optional), overrides default guidance"
        rows={2}
        maxLength={1000}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
      />

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

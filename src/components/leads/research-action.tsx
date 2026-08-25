"use client";

import { Loader2, Search } from "lucide-react";
import { triggerEnrichLeadAction } from "@/app/(dashboard)/leads/[id]/ai-actions";
import { useAiJobTrigger } from "./use-ai-job-trigger";

export function ResearchAction({ leadId, hasEnrichment }: { leadId: string; hasEnrichment: boolean }) {
  const { trigger, isBusy, error } = useAiJobTrigger(() => triggerEnrichLeadAction(leadId));

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={trigger}
          disabled={isBusy}
          className="flex h-9 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition-all hover:brightness-105 hover:shadow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
        >
          {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          {isBusy ? "Researching…" : hasEnrichment ? "Refresh research" : "Research this lead"}
        </button>
      </div>
      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, PhoneCall, Mail, Search, RotateCcw, Clock, XCircle, ListChecks, CheckCircle2 } from "lucide-react";
import { getNextBestActionAction } from "@/app/(dashboard)/leads/[id]/ai-actions";
import { updateLeadStageAction } from "@/app/(dashboard)/leads/[id]/stage-actions";
import type { NextBestAction, NbaAction, NbaUrgency } from "@/lib/next-best-action/rule-based";
import type { WorkflowStep } from "@/lib/leads/workflow";

const ACTION_ICONS: Record<NbaAction, typeof PhoneCall> = {
  call: PhoneCall,
  email: Mail,
  followup: RotateCcw,
  research: Search,
  wait: Clock,
  drop: XCircle,
  review: ListChecks,
  close: CheckCircle2,
};

// Ports the source system's getAIRecActionButton() map exactly — each action
// jumps to the tab where a rep would actually carry it out, or (for
// close/drop) applies the stage change directly, same as legacy's
// updateLeadStatus() shortcut.
const ACTION_LABELS: Record<NbaAction, string> = {
  research: "Start Research",
  email: "Generate Email",
  followup: "Send Follow-up",
  call: "Prepare Call",
  review: "View Profile",
  wait: "Waiting…",
  close: "Mark Consultation Booked",
  drop: "Park Lead",
};

const ACTION_STEP: Partial<Record<NbaAction, WorkflowStep>> = {
  research: "research",
  email: "email",
  followup: "email",
  call: "call",
  review: "profile",
};

const URGENCY_STYLES: Record<NbaUrgency, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-[color-mix(in_oklch,var(--warning)_60%,black)]/40 bg-[var(--warning)]/10 text-[color-mix(in_oklch,var(--warning)_70%,black)]",
  medium: "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]",
  low: "border-border bg-muted text-muted-foreground",
};

export function NextBestActionPanel({
  leadId,
  stage,
  onNavigateToStep,
}: {
  leadId: string;
  stage: string;
  onNavigateToStep: (step: WorkflowStep) => void;
}) {
  const router = useRouter();
  const [nba, setNba] = useState<NextBestAction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchNba(useAi: boolean) {
    setIsLoading(true);
    setError(null);
    const result = await getNextBestActionAction(leadId, useAi);
    setIsLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setNba(result.recommendation);
  }

  async function handleAction() {
    if (!nba) return;
    const step = ACTION_STEP[nba.action];
    if (step) {
      onNavigateToStep(step);
      return;
    }
    // close/drop apply the stage change directly, matching legacy's
    // updateLeadStatus() shortcut rather than sending the rep to a tab.
    const nextStage = nba.action === "close" ? "consultation_booked" : nba.action === "drop" ? "nurture_parked" : null;
    if (!nextStage || nextStage === stage) return;
    setIsApplying(true);
    await updateLeadStageAction(leadId, nextStage);
    setIsApplying(false);
    router.refresh();
  }

  const Icon = nba ? ACTION_ICONS[nba.action] : ListChecks;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Next best action</h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fetchNba(false)}
            disabled={isLoading}
            className="h-7 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Quick check
          </button>
          <button
            type="button"
            onClick={() => fetchNba(true)}
            disabled={isLoading}
            className="flex h-7 items-center gap-1 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            Ask AI
          </button>
        </div>
      </div>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}

      {!error && !nba && !isLoading && <p className="text-xs text-muted-foreground">Get a recommendation for what to do with this lead next.</p>}

      {nba && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${URGENCY_STYLES[nba.urgency]}`}>
              <Icon className="size-3.5" />
              {nba.action} · {nba.urgency}
            </span>
            {nba.source === "ai" && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">AI-generated</span>}
          </div>
          <p className="text-sm text-foreground">{nba.reason}</p>
          {nba.talkingPoint && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Talking point:</span> {nba.talkingPoint}
            </p>
          )}
          {nba.riskIfDelayed && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">If delayed:</span> {nba.riskIfDelayed}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAction}
              disabled={nba.action === "wait" || isApplying}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplying ? <Loader2 className="size-3 animate-spin" /> : null}
              {ACTION_LABELS[nba.action]}
            </button>
            <button
              type="button"
              onClick={() => setNba(null)}
              className="h-8 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_STEPS, type WorkflowStep } from "@/lib/leads/workflow";

/**
 * A connected progress track rather than five identically-weighted pills
 * (legacy's renderLeadWorkflow) or a numbered/locked stepper (an earlier
 * rewrite pass). Each step is a dot on a line: filled + a connecting segment
 * once done, ringed while current, hollow while upcoming. Locked steps carry
 * a small lock glyph directly on their dot — so a rep sees *why* a step isn't
 * reachable without needing to click it first and read a toast — but the row
 * stays flat and scannable, not a wizard.
 */
export function WorkflowStepper({
  status,
  activeStep,
  onSelect,
  lockedSteps,
  nextActionLabel,
  nextActionDetail,
}: {
  status: Record<WorkflowStep, "done" | "current" | "upcoming">;
  activeStep: WorkflowStep;
  onSelect: (step: WorkflowStep) => void;
  lockedSteps: Set<WorkflowStep>;
  nextActionLabel: string;
  nextActionDetail: string;
}) {
  return (
    <div>
      <div className="flex items-center">
        {WORKFLOW_STEPS.map((step, index) => {
          const state = status[step.key];
          const isActive = activeStep === step.key;
          const isLocked = lockedSteps.has(step.key);
          const isDone = state === "done";
          const isLast = index === WORKFLOW_STEPS.length - 1;

          return (
            <div key={step.key} className={cn("flex items-center", !isLast && "flex-1")}>
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-disabled={isLocked}
                aria-current={isActive ? "step" : undefined}
                className="group flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-all",
                    isActive
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)] ring-4 ring-[color-mix(in_oklch,var(--primary)_16%,transparent)]"
                      : isDone
                        ? "border-[var(--success)] bg-[var(--success)] text-white"
                        : isLocked
                          ? "border-dashed border-border bg-transparent text-muted-foreground/40"
                          : "border-border bg-card text-muted-foreground group-hover:border-[var(--primary)]/50 group-hover:text-foreground",
                  )}
                >
                  {isLocked ? <Lock className="size-2.5" strokeWidth={2.5} /> : isDone ? "✓" : null}
                </span>
                <span
                  className={cn(
                    "text-[12px] font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "text-foreground"
                      : isLocked
                        ? "text-muted-foreground/40"
                        : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {step.label}
                </span>
              </button>

              {!isLast && (
                <span
                  className={cn(
                    "mx-1.5 h-0.5 flex-1 rounded-full transition-colors",
                    isDone ? "bg-[var(--success)]" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3.5 py-2.5 text-[13px]">
        <span className="font-semibold text-foreground">Next:</span>
        <span className="text-muted-foreground">{nextActionLabel}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="text-muted-foreground">{nextActionDetail}</span>
      </div>
    </div>
  );
}

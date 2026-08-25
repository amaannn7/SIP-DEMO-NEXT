"use client";

import { ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKFLOW_STEPS, type WorkflowStep } from "@/lib/leads/workflow";

/**
 * A forward-motion affordance so moving through Profile -> Research -> Email
 * -> Call -> Outcome doesn't require scrolling back up to the stepper every
 * time. Rendered twice per tab (top, right under the stage row, and bottom,
 * after the tab's content) via the `compact` prop — a long tab (e.g. a
 * Research brief with 15+ sections) previously only offered this at the very
 * bottom, invisible without scrolling past everything first. Disabled (not
 * hidden) when the next step is locked, so a rep sees the whole path and why
 * they can't jump ahead yet, rather than the button just disappearing.
 */
export function ContinueToNextStep({
  currentStep,
  isNextLocked,
  nextLockedReason,
  onContinue,
  compact = false,
}: {
  currentStep: WorkflowStep;
  isNextLocked: boolean;
  nextLockedReason?: string;
  onContinue: (step: WorkflowStep) => void;
  /** Top placement: no divider/padding, smaller button — sits inline right under the stepper/stage row instead of closing out the tab. */
  compact?: boolean;
}) {
  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.key === currentStep);
  const next = WORKFLOW_STEPS[currentIndex + 1];
  if (!next) return null; // Outcome is the last step — nothing to continue to.

  return (
    <div className={compact ? "flex items-center justify-end" : "flex items-center justify-end border-t border-border pt-4"}>
      <button
        type="button"
        onClick={() => !isNextLocked && onContinue(next.key)}
        disabled={isNextLocked}
        title={isNextLocked ? nextLockedReason : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-lg font-semibold transition-all",
          compact ? "h-8 px-3 text-xs" : "h-9 px-4 text-[13px]",
          isNextLocked
            ? "cursor-not-allowed bg-muted text-muted-foreground/50"
            : "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm hover:brightness-105",
        )}
      >
        {isNextLocked ? <Lock className="size-3.5" strokeWidth={2.5} /> : null}
        Continue to {next.label}
        {!isNextLocked && <ArrowRight className="size-3.5" />}
      </button>
    </div>
  );
}

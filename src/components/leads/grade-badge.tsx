import { cn } from "@/lib/utils";

// Filled tint rather than a bare outline — the grade is a headline attribute on
// the lead header and was disappearing against the card. `warning` keeps a
// darkened text color on light mode only; `text-warning-foreground` (the old
// value) is a *background-pairing* token and was near-invisible here.
const GRADE_STYLES: Record<string, string> = {
  A: "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]",
  B: "bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]",
  C: "bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[color-mix(in_oklch,var(--warning),black_28%)] dark:text-[var(--warning)]",
  Disqualified: "bg-destructive/10 text-destructive",
  Unscored: "bg-muted text-muted-foreground",
};

/** Fit-grade pill shown alongside stage/source in the lead header — ports the source system's "Grade Unscored" badge. */
export function GradeBadge({ grade, score }: { grade: string | null; score: number | null }) {
  const label = grade ?? "Unscored";
  return (
    <span
      className={cn(
        "tnum inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        GRADE_STYLES[label],
      )}
    >
      Grade {label}
      {score !== null && label !== "Unscored" ? ` (${score}%)` : ""}
    </span>
  );
}

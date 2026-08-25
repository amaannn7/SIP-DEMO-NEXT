import Link from "next/link";
import { ScoreRing } from "@/components/leads/score-ring";
import { ActionBadge, type FocusQueueAction } from "@/components/leads/action-badge";
import { SkipFocusButton } from "@/components/leads/skip-focus-button";
import type { FocusQueueItem } from "@/lib/focus-queue/generate";

export function FocusQueueList({ items }: { items: FocusQueueItem[] }) {
  return (
    <ul className="-mx-2 divide-y divide-border">
      {items.map((item) => (
        <li key={item.leadId}>
          <Link
            href={`/leads/${item.leadId}`}
            className="row-hover flex items-center gap-3 rounded-md px-2 py-2.5"
          >
            <ScoreRing score={fitGradeToScore(item.fitGrade)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{item.name || item.company || "Unnamed lead"}</p>
              <p className="truncate text-xs text-muted-foreground">{item.reason}</p>
            </div>
            <SkipFocusButton leadId={item.leadId} />
            <ActionBadge action={item.suggestedAction as FocusQueueAction} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ScoreRing expects a 0-100 number; the queue's fitGrade is a letter, so
// approximate a representative number per grade purely for the ring's color
// tier (high/mid/low) — not a real score, just enough to color-code.
function fitGradeToScore(grade: string): number {
  switch (grade) {
    case "A":
      return 90;
    case "B":
      return 70;
    case "C":
      return 50;
    default:
      return 20;
  }
}

import { Flame } from "lucide-react";

/** Ports the source system's cc-streak / commit-streak pill — shown next to a page title when the viewer has a current daily-target streak. */
export function StreakBadge({ days }: { days: number }) {
  if (days <= 0) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-md bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning-foreground">
      <Flame className="size-3.5 text-warning" strokeWidth={2} />
      {days} day{days === 1 ? "" : "s"} streak
    </div>
  );
}

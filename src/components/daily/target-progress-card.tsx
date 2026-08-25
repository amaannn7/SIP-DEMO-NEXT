import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function statusText(done: number, target: number): string {
  if (target <= 0) return "No target set";
  if (done <= 0) return "Not started";
  const percent = Math.round((done / target) * 100);
  if (percent >= 100) return "Complete";
  // Was "{percent}% to go" above 50 and "{100-percent}% remaining" below it —
  // two different meanings for the same shape of sentence, and both redundant
  // with the percentage printed beside it. State what's left in real units.
  return `${target - done} to go`;
}

export function TargetProgressCard({
  label,
  icon: Icon,
  done,
  target,
}: {
  label: string;
  icon: LucideIcon;
  done: number;
  target: number;
}) {
  const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const complete = target > 0 && done >= target;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            complete
              ? "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]"
              : "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]",
          )}
        >
          {complete ? <Check className="size-4" strokeWidth={2.5} /> : <Icon className="size-4" strokeWidth={2} />}
        </div>
      </div>

      <p className="tnum mt-3 text-3xl font-bold tracking-tight text-foreground">
        {done}
        <span className="text-base font-medium text-muted-foreground"> / {target}</span>
      </p>

      {/* Progress fills carry the brand gradient (one of its sanctioned uses),
          switching to solid success green once the target is met. At zero the
          track keeps a 2% sliver of fill so the bar reads as "nothing yet"
          rather than as a component that failed to render. */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", !complete && "brand-gradient")}
          style={{
            width: percent > 0 ? `${percent}%` : "2%",
            opacity: percent > 0 ? 1 : 0.35,
            ...(complete ? { background: "var(--success)" } : {}),
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{statusText(done, target)}</p>
        <p className="tnum text-[11px] font-semibold text-foreground">{percent}%</p>
      </div>
    </div>
  );
}

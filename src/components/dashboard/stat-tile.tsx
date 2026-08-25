import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "primary" | "success" | "warning" | "accent";

type StatTileProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: Accent;
  /**
   * Period-over-period change, as a percentage. Positive renders green with an
   * up arrow, negative red with a down arrow — the reference's
   * "+20.1% from last month" treatment. Omit when there's no comparison to
   * make; an absent delta is honest, a zero delta is a claim.
   */
  delta?: number;
  /** Names the comparison window, e.g. "from last month". */
  deltaLabel?: string;
  /**
   * Set when a lower number is the good outcome (e.g. overdue leads), so a
   * negative delta renders green instead of red.
   */
  invertDelta?: boolean;
};

/**
 * Tinted icon chip + colored glyph. This is what carries color into the
 * dashboard grid — the previous monochrome tiles are why it read as pale.
 */
const CHIP_STYLES: Record<Accent, string> = {
  primary: "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]",
  success: "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]",
  warning: "bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[color-mix(in_oklch,var(--warning),black_25%)] dark:text-[var(--warning)]",
  accent: "bg-[color-mix(in_oklch,var(--accent)_12%,transparent)] text-[var(--accent)]",
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
  delta,
  deltaLabel,
  invertDelta = false,
}: StatTileProps) {
  const hasDelta = delta !== undefined && Number.isFinite(delta);
  const positive = hasDelta && (invertDelta ? delta < 0 : delta > 0);
  const DeltaIcon = hasDelta && delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", CHIP_STYLES[accent])}>
          <Icon className="size-4" strokeWidth={2} />
        </div>
      </div>

      <p className="tnum mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>

      {(hasDelta || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {hasDelta && delta !== 0 && (
            <span
              className={cn(
                "tnum inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                positive
                  ? "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)]"
                  : "bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-[var(--destructive)]",
              )}
            >
              <DeltaIcon className="size-3" strokeWidth={2.5} />
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </span>
          )}
          {(deltaLabel || hint) && (
            <span className="text-[11px] text-muted-foreground">{deltaLabel ?? hint}</span>
          )}
        </div>
      )}
    </div>
  );
}

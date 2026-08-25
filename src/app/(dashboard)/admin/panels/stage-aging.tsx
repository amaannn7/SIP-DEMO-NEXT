import { SectionCard, SectionEmpty } from "@/components/shared/section-card";
import type { StageAgingEntry } from "@/lib/db/queries/admin-dashboard";

export function StageAgingPanel({ entries }: { entries: StageAgingEntry[] }) {
  const max = Math.max(1, ...entries.map((e) => e.avgDays));

  return (
    <SectionCard title="Average time in stage" description="Days since last activity, per active stage">
      {entries.length === 0 ? (
        <SectionEmpty>No active leads.</SectionEmpty>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            // Aging is a warning signal, so the bar warms toward red as a stage
            // approaches the slowest one in the set — grey bars said nothing.
            const share = entry.avgDays / max;
            const fill =
              share >= 0.75
                ? "var(--destructive)"
                : share >= 0.4
                  ? "var(--warning)"
                  : "var(--primary)";

            return (
              <div key={entry.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{entry.label}</span>
                  <span className="tnum shrink-0 text-[13px] font-bold" style={{ color: fill }}>
                    {entry.avgDays}d
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${share * 100}%`, background: fill }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

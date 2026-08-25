import { SectionCard, SectionEmpty } from "@/components/shared/section-card";
import type { SourceSplitEntry } from "@/lib/db/queries/admin-dashboard";

// Chart series, cycled — source is a categorical dimension, so each gets its
// own hue from the brand-derived chart palette rather than all-grey boxes.
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function LeadSourceSplitPanel({ sources }: { sources: SourceSplitEntry[] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0);

  return (
    <SectionCard title="Lead source split" description="Where the pipeline comes from">
      {sources.length === 0 ? (
        <SectionEmpty>No leads yet.</SectionEmpty>
      ) : (
        <>
          {/* Single stacked bar gives the split its shape before the reader
              parses any individual number. */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            {sources.map((source, i) => (
              <div
                key={source.key}
                style={{
                  width: `${total > 0 ? (source.count / total) * 100 : 0}%`,
                  background: SERIES[i % SERIES.length],
                }}
                title={`${source.label}: ${source.count}`}
              />
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {sources.map((source, i) => (
              <div key={source.key} className="flex items-center gap-2.5 rounded-lg border border-border p-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: SERIES[i % SERIES.length] }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="tnum text-lg font-bold leading-none text-foreground">{source.count}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground" title={source.label}>
                    {source.label}
                    {total > 0 && <span className="tnum"> · {Math.round((source.count / total) * 100)}%</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

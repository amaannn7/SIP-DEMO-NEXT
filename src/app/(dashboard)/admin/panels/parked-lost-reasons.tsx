import { SectionCard, SectionEmpty } from "@/components/shared/section-card";
import type { ParkedLostReason } from "@/lib/db/queries/admin-dashboard";

export function ParkedLostReasonsPanel({ reasons }: { reasons: ParkedLostReason[] }) {
  const total = reasons.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...reasons.map((r) => r.count));

  return (
    <SectionCard title="Parked / lost reasons" description="Why deals stall or close out">
      {reasons.length === 0 ? (
        <SectionEmpty>No parked or lost leads.</SectionEmpty>
      ) : (
        <ul className="space-y-2.5">
          {reasons.map((reason) => {
            const percent = total > 0 ? Math.round((reason.count / total) * 100) : 0;
            return (
              <li key={reason.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">{reason.label}</span>
                  <span className="tnum shrink-0 text-muted-foreground">
                    <span className="text-[13px] font-bold text-foreground">{reason.count}</span>
                    <span className="ml-1 text-[10px]">({percent}%)</span>
                  </span>
                </div>
                {/* A ranked bar turns a bare list of counts into a distribution
                    the reader can compare without doing the arithmetic. */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--temp-cold)]"
                    style={{ width: `${(reason.count / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

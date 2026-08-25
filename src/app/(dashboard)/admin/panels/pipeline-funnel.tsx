import { SectionCard, SectionEmpty } from "@/components/shared/section-card";
import type { FunnelStage } from "@/lib/db/queries/admin-dashboard";

export function PipelineFunnelPanel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <SectionCard title="Pipeline by stage" description="Volume and stage-to-stage conversion">
      {stages.length === 0 ? (
        <SectionEmpty>No pipeline data yet.</SectionEmpty>
      ) : (
        <div className="space-y-3">
          {stages.map((stage, index) => {
            // Bars walk the brand spectrum by depth in the funnel (cyan-ish at
            // the top, magenta at the bottom), so the shape of the funnel is
            // legible from color alone as well as from length.
            const progress = stages.length > 1 ? index / (stages.length - 1) : 0;
            const fill = `color-mix(in oklch, var(--brand-magenta) ${Math.round(progress * 100)}%, var(--brand-violet))`;

            return (
              <div key={stage.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-foreground">{stage.label}</span>
                  <span className="tnum flex shrink-0 items-baseline gap-1.5 text-muted-foreground">
                    <span className="text-[13px] font-bold text-foreground">{stage.count}</span>
                    <span className="text-[10px]">({stage.shareOfPipelinePercent}%)</span>
                    {stage.conversionRatePercent !== null && (
                      // This is a stage-over-stage ratio, so it legitimately
                      // exceeds 100% when a later stage holds more leads than
                      // the one before it (backlog, or leads entering
                      // mid-pipeline). Green would read as "great conversion",
                      // so anything over 100% is shown neutral and flagged as
                      // a backlog instead of celebrated.
                      <span
                        className={
                          stage.conversionRatePercent > 100
                            ? "rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground"
                            : "rounded-full bg-[color-mix(in_oklch,var(--success)_14%,transparent)] px-1.5 text-[10px] font-semibold text-[var(--success)]"
                        }
                        title={
                          stage.conversionRatePercent > 100
                            ? "More leads here than in the previous stage: a backlog, not a conversion gain"
                            : "Share of the previous stage that reached this one"
                        }
                      >
                        → {stage.conversionRatePercent}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${(stage.count / max) * 100}%`, background: fill }}
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

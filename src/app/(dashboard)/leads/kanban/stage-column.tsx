"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { STAGE_LABELS, type LeadStage } from "@/lib/leads/stages";
import type { leads } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { LeadCard } from "./lead-card";

type Lead = typeof leads.$inferSelect;

/** Same per-stage tone tokens as StageFilterStrip/StageBadge, so a column header reads as the same stage wherever it appears. */
const STAGE_TONES: Record<LeadStage, string> = {
  new_lead: "var(--temp-cold)",
  research: "var(--chart-3)",
  email_sent: "var(--warning)",
  call_attempted: "var(--primary)",
  engaged: "var(--accent)",
  consultation_booked: "var(--primary)",
  nurture_parked: "var(--temp-cold)",
  won: "var(--success)",
  lost: "var(--destructive)",
};

export function StageColumn({
  stage,
  leads: rows,
  ownerNameById,
}: {
  stage: LeadStage;
  leads: Lead[];
  ownerNameById?: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } });
  const tone = STAGE_TONES[stage];

  return (
    <div className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30">
      <div className="flex items-center gap-2 rounded-t-xl border-b border-border bg-card px-3 py-2.5">
        <span className="size-2 shrink-0 rounded-full" style={{ background: tone }} aria-hidden />
        <h3 className="truncate text-[13px] font-semibold text-foreground">{STAGE_LABELS[stage]}</h3>
        <span className="tnum ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {rows.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors",
          isOver && "bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]",
        )}
      >
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {rows.map((lead) => (
            <LeadCard key={lead.id} lead={lead} ownerName={ownerNameById?.[lead.ownerId ?? ""]} />
          ))}
        </SortableContext>

        {rows.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 py-6 text-[11px] text-muted-foreground">
            Drop a lead here
          </div>
        )}
      </div>
    </div>
  );
}

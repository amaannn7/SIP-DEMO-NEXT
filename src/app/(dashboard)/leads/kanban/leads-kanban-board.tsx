"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { leads, leadStageEnum } from "@/lib/db/schema";
import { STAGE_ORDER } from "@/lib/leads/stages";
import { LeadCard } from "./lead-card";
import { StageColumn } from "./stage-column";
import { useUpdateLeadStage } from "./use-update-lead-stage";

type Lead = typeof leads.$inferSelect;
type LeadStage = (typeof leadStageEnum.enumValues)[number];

export function LeadsKanbanBoard({
  leads: allLeads,
  ownerNameById,
}: {
  leads: Lead[];
  /** rep id -> display name, only passed for managers so cards can show whose lead it is. */
  ownerNameById?: Record<string, string>;
}) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const updateStage = useUpdateLeadStage();

  // Require a small drag distance before a click on a card counts as a drag —
  // without this, a plain click-to-open-lead on the card's own body would
  // sometimes get eaten as a zero-distance drag start.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const columns = useMemo(() => {
    const byStage = new Map<LeadStage, Lead[]>(STAGE_ORDER.map((s) => [s, []]));
    for (const lead of allLeads) {
      byStage.get(lead.stage)?.push(lead);
    }
    return byStage;
  }, [allLeads]);

  function handleDragStart(event: DragStartEvent) {
    const lead = event.active.data.current?.lead as Lead | undefined;
    setActiveLead(lead ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const lead = active.data.current?.lead as Lead | undefined;
    if (!lead) return;

    // Dropped over another card (sortable item) -> take that card's column;
    // dropped over an empty column area -> `over.id` is the stage itself.
    const overStage = (over.data.current?.stage as LeadStage | undefined) ?? (over.data.current?.lead as Lead | undefined)?.stage;
    const targetStage = (STAGE_ORDER as string[]).includes(over.id as string) ? (over.id as LeadStage) : overStage;

    if (!targetStage || targetStage === lead.stage) return;

    updateStage.mutate({ leadId: lead.id, stage: targetStage });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[calc(100vh-260px)] min-h-[420px] gap-3 overflow-x-auto pb-2">
        {STAGE_ORDER.map((stage) => (
          <StageColumn key={stage} stage={stage} leads={columns.get(stage) ?? []} ownerNameById={ownerNameById} />
        ))}
      </div>

      <DragOverlay>{activeLead ? <LeadCard lead={activeLead} ownerName={ownerNameById?.[activeLead.ownerId ?? ""]} /> : null}</DragOverlay>
    </DndContext>
  );
}

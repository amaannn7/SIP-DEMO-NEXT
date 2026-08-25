"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { LeadAvatar } from "@/components/leads/lead-avatar";
import { SourceBadge } from "@/components/leads/source-badge";
import { TemperatureBadge } from "@/components/leads/temperature-badge";
import type { leads } from "@/lib/db/schema";
import { describeNextActionDetailed } from "@/lib/leads/workflow";
import { cn } from "@/lib/utils";

type Lead = typeof leads.$inferSelect;

export function LeadCard({ lead, ownerName }: { lead: Lead; ownerName?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unnamed lead";
  const nextAction = describeNextActionDetailed(lead);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "card-surface group rounded-lg border border-border bg-card p-3 shadow-sm",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to move lead"
          className="mt-0.5 flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>

        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1" onClick={(e) => isDragging && e.preventDefault()}>
          <div className="flex items-center gap-2">
            <LeadAvatar firstName={lead.firstName} lastName={lead.lastName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground hover:underline">{name}</span>
              {lead.company && <span className="block truncate text-[11px] text-muted-foreground">{lead.company}</span>}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {lead.temperature && <TemperatureBadge temperature={lead.temperature} />}
            <SourceBadge source={lead.source} />
          </div>

          <p className="mt-2 truncate text-[11px] text-muted-foreground" title={nextAction.detail}>
            {nextAction.label}
          </p>

          {ownerName && (
            <p className="mt-1.5 truncate text-[10px] font-medium text-muted-foreground/70">{ownerName}</p>
          )}
        </Link>
      </div>
    </div>
  );
}

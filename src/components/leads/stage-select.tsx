"use client";

import { useTransition } from "react";
import { STAGE_LABELS } from "@/lib/leads/stages";
import type { leadStageEnum } from "@/lib/db/schema";
import { updateLeadStageAction } from "@/app/(dashboard)/leads/[id]/stage-actions";

type LeadStage = (typeof leadStageEnum.enumValues)[number];

const STAGE_ORDER: LeadStage[] = [
  "new_lead",
  "research",
  "email_sent",
  "call_attempted",
  "engaged",
  "consultation_booked",
  "nurture_parked",
  "won",
  "lost",
];

export function StageSelect({ leadId, stage }: { leadId: string; stage: LeadStage }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-muted-foreground" htmlFor="lead-stage-select">
        Stage
      </label>
      <select
        id="lead-stage-select"
        defaultValue={stage}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as LeadStage;
          startTransition(() => {
            updateLeadStageAction(leadId, next);
          });
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-[var(--primary)] disabled:opacity-60"
      >
        {STAGE_ORDER.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

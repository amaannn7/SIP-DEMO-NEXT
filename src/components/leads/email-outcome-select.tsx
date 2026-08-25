"use client";

import { useTransition } from "react";
import { EMAIL_OUTCOME_OPTIONS } from "@/lib/calls/email-outcomes";
import { logEmailOutcomeAction } from "@/app/(dashboard)/leads/[id]/email-outcome-actions";

/** Ports the source system's per-email outcome marker — replied/meeting_booked auto-advance the lead's stage. */
export function EmailOutcomeSelect({ leadId, emailId, outcome }: { leadId: string; emailId: string; outcome: string | null }) {
  const [isPending, startTransition] = useTransition();
  const action = logEmailOutcomeAction.bind(null, leadId, emailId);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Outcome:</span>
      <select
        defaultValue={outcome ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          const formData = new FormData();
          formData.set("outcome", value);
          startTransition(() => {
            action({}, formData);
          });
        }}
        className="h-6 rounded-md border border-input bg-background px-1.5 text-[11px] text-foreground outline-none focus:border-[var(--primary)] disabled:opacity-60"
      >
        <option value="">Not set</option>
        {EMAIL_OUTCOME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

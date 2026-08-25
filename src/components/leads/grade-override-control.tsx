"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { X } from "lucide-react";
import { setGradeOverrideAction, clearGradeOverrideAction, type GradeOverrideState } from "@/app/(dashboard)/leads/[id]/grade-override-actions";
import { GRADE_OVERRIDE_REASONS } from "@/lib/leads/grade-override-reasons";

type GradeOverride = { reason: string; notes: string; overriddenBy: string; overriddenAt: string; originalGrade: string } | null;

const initialState: GradeOverrideState = {};

/**
 * Ports the source system's grade-override affordance: informational only —
 * it never changes the grade or unlocks anything, it just documents (with an
 * audit trail) why a rep is proceeding despite the grade shown.
 */
export function GradeOverrideControl({ leadId, override }: { leadId: string; override: GradeOverride }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, formAction] = useActionState(setGradeOverrideAction.bind(null, leadId), initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !state.error) setOpen(false);
    submittedRef.current = false;
  }, [state]);

  if (override) {
    const reasonLabel = GRADE_OVERRIDE_REASONS.find((r) => r.id === override.reason)?.label ?? override.reason;
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 px-2 py-0.5 text-[11px] font-medium text-warning-foreground" title={`${reasonLabel}${override.notes ? `: ${override.notes}` : ""}, by ${override.overriddenBy}`}>
        Overridden
        <button
          type="button"
          onClick={() => startTransition(() => clearGradeOverrideAction(leadId))}
          disabled={isPending}
          className="text-warning-foreground/70 hover:text-warning-foreground"
          aria-label="Clear override"
        >
          <X className="size-3" />
        </button>
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-muted-foreground underline decoration-dotted hover:text-foreground"
      >
        Override grade
      </button>
    );
  }

  return (
    <div className="w-full rounded-md border border-border bg-card p-3">
      <form
        action={formAction}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="space-y-2"
      >
        <div className="flex flex-wrap gap-1.5">
          {GRADE_OVERRIDE_REASONS.map((r) => (
            <label key={r.id} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary)]/10">
              <input type="radio" name="reason" value={r.id} className="sr-only" required />
              {r.label}
            </label>
          ))}
        </div>
        <textarea
          name="notes"
          rows={2}
          placeholder="Notes (required for &quot;Other&quot;)"
          className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-[var(--primary)]"
        />
        {state.error && <p className="text-[11px] text-destructive">{state.error}</p>}
        <div className="flex gap-2">
          <SubmitButton />
          <button type="button" onClick={() => setOpen(false)} className="h-7 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground hover:bg-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-7 rounded-md px-2.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Saving…" : "Apply override"}
    </button>
  );
}

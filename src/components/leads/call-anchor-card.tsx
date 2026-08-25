"use client";

import { useRef, useState, useTransition } from "react";
import { Phone, Pencil, Check, X } from "lucide-react";
import { updateLeadAction } from "@/app/(dashboard)/leads/actions";

const DEFAULT_ANCHOR = "This lead shows potential based on their role and industry fit.";

/**
 * Ports the source system's Call Anchor block from the top of its Research
 * tab ("Call Anchor - Why This Lead is Worth Calling", editable in place,
 * with a specific default placeholder shown — never persisted — until the
 * rep actually writes one). The rewrite's `callAnchor` field is also
 * editable from the Profile tab as "Note for next contact"; both edit the
 * same underlying value, this just surfaces it with the source system's own
 * heading and default text where Research puts it front-and-center.
 */
export function CallAnchorCard({ leadId, value }: { leadId: string; value: string | null }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function save() {
    const newValue = textareaRef.current?.value ?? "";
    const formData = new FormData();
    formData.set("callAnchor", newValue);
    startTransition(async () => {
      const result = await updateLeadAction(leadId, {}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditing(false);
    });
  }

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Phone className="size-3.5 text-[var(--primary)]" strokeWidth={2} />
        <h3 className="text-[13px] font-semibold text-foreground">Call Anchor: Why This Lead is Worth Calling</h3>
      </div>

      {editing ? (
        <div>
          <textarea
            ref={textareaRef}
            defaultValue={value ?? ""}
            autoFocus
            disabled={isPending}
            rows={3}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            className="w-full resize-none rounded-md border border-[var(--primary)] bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--primary)]/10"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-success hover:bg-success/10 disabled:opacity-50"
              aria-label="Save"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={isPending}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
              aria-label="Cancel"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="group/field flex items-start gap-1.5">
          <p className="flex-1 text-sm whitespace-pre-wrap text-foreground">{value || DEFAULT_ANCHOR}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/field:opacity-100"
            aria-label="Edit call anchor"
          >
            <Pencil className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SkipForward } from "lucide-react";
import { skipEmailAction } from "@/app/(dashboard)/leads/[id]/email-outcome-actions";

// Exact wording, ported verbatim from the source system's confirmSkipEmail reason select.
const SKIP_REASONS: { value: "already_contacted" | "phone_preferred" | "referral" | "other"; label: string }[] = [
  { value: "already_contacted", label: "Already contacted via other channel" },
  { value: "phone_preferred", label: "Phone contact preferred" },
  { value: "referral", label: "Warm referral - no email needed" },
  { value: "other", label: "Other" },
];

/** Ports the source system's Skip Email flow — a rep bypasses emailing entirely and the Call tab unlocks the same way it would after a sent email. */
export function SkipEmailButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // No default reason — ports the source system's confirmSkipEmail() exactly:
  // the select starts on a blank "Select reason..." option and the confirm
  // click is blocked until the rep actively picks one, so a reason is never
  // silently recorded on their behalf.
  const [reason, setReason] = useState<(typeof SKIP_REASONS)[number]["value"] | "">("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SkipForward className="size-3.5" />
        Skip email
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium text-foreground">Why skip email for this lead?</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value as typeof reason)}
        className="mb-2 h-8 w-full max-w-72 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
      >
        <option value="">Select reason…</option>
        {SKIP_REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!reason) {
              setError("Select a reason");
              return;
            }
            startTransition(async () => {
              const result = await skipEmailAction(leadId, reason);
              if (result.error) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
          className="h-7 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--primary)" }}
        >
          {isPending ? "Skipping…" : "Confirm skip"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-7 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

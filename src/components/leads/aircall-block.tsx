"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Phone, Loader2 } from "lucide-react";
import { dialLeadViaAircallAction } from "@/app/(dashboard)/admin/settings/aircall-actions";

/**
 * Ports the source system's renderAircallBlock exactly: a banner at the very
 * top of the Call tab (above pitch generation, above call history) with a
 * one-click dial button and an explanation of what happens — Aircall's own
 * app rings first, the lead is only actually dialed once answered, and the
 * call is recorded/logged automatically.
 */
export function AircallBlock({ leadId, phone, onStarted }: { leadId: string; phone: string | null; onStarted: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await dialLeadViaAircallAction(leadId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
      onStarted();
    });
  }

  return (
    <div className="card-surface flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.06] px-5 py-4">
      <div className="flex items-center gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
          <Phone className="size-5" />
        </span>
        <div>
          {phone ? (
            <>
              <p className="text-[15px] font-semibold tracking-tight text-foreground">{phone}</p>
              <p className="text-[11px] text-muted-foreground">Rings your Aircall app first. Recorded and logged here automatically.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">No phone number on this lead</p>
              <p className="text-[11px] text-muted-foreground">Add one to enable click-to-dial via Aircall.</p>
            </>
          )}
        </div>
      </div>
      {phone && (
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--success)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
          {isPending ? "Calling…" : "Call via Aircall"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, Loader2 } from "lucide-react";
import { startCallAction } from "@/app/(dashboard)/leads/[id]/call-log-actions";

/**
 * Ports the source system's "Start Call" button — the piece that was missing
 * entirely from the rewrite. Clicking it declares "I'm calling now": advances
 * the lead to Call Attempted immediately (not only once an outcome is later
 * logged) and jumps straight to the Outcome tab, ready to record what
 * happened. No dialer integration here, so this is a manual declaration
 * rather than an actual click-to-dial trigger — the stage-advance side
 * effect is the part that matters for keeping the pipeline stage accurate.
 */
export function StartCallButton({ leadId, onStarted }: { leadId: string; onStarted: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await startCallAction(leadId);
      if (!result.error) {
        router.refresh();
        onStarted();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <PhoneCall className="size-3.5" />}
      {isPending ? "Starting…" : "Start Call"}
    </button>
  );
}

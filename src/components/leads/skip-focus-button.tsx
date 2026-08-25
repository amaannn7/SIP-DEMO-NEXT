"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { skipFocusItemAction } from "@/app/(dashboard)/leads/[id]/skip-focus-actions";
import { SKIP_DURATIONS, type SkipDuration } from "@/lib/leads/skip-durations";

/** Ports the source system's Focus Queue "Skip" button — a proper dropdown instead of the source's window.prompt() fallback. */
export function SkipFocusButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function skip(duration: SkipDuration) {
    setOpen(false);
    startTransition(async () => {
      await skipFocusItemAction(leadId, duration);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        <Clock className="size-3" />
        Skip
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} />
          <div className="absolute top-7 right-0 z-40 w-32 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {(Object.entries(SKIP_DURATIONS) as [SkipDuration, (typeof SKIP_DURATIONS)[SkipDuration]][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  skip(key);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

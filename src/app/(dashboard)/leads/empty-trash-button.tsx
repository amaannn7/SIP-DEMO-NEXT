"use client";

import { useTransition } from "react";
import { XCircle } from "lucide-react";
import { emptyTrashAction } from "./actions";

/** Ports the source system's empty-trash: permanently purges every soft-deleted lead in scope. */
export function EmptyTrashButton({ onEmptied }: { onEmptied?: () => void } = {}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Permanently delete all leads in trash? This cannot be undone.")) return;
        startTransition(async () => {
          await emptyTrashAction();
          onEmptied?.();
        });
      }}
      className="flex h-8 items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
    >
      <XCircle className="size-3.5" />
      {isPending ? "Emptying…" : "Empty trash"}
    </button>
  );
}

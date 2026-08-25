"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCallLogAction } from "./call-log-actions";

export function DeleteCallLogButton({ callLogId }: { callLogId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this call log entry? This cannot be undone.")) return;
        startTransition(() => deleteCallLogAction(callLogId));
      }}
      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
      aria-label="Delete call log"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

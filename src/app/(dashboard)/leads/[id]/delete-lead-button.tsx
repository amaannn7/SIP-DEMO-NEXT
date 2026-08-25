"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { softDeleteLeadAction } from "../actions";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Move this lead to trash?")) return;
        startTransition(async () => {
          await softDeleteLeadAction(leadId);
          router.push("/leads");
        });
      }}
      className="flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
    >
      <Trash2 className="size-3.5" />
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}

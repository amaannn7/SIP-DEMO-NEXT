"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { markEmailSentAction } from "@/app/(dashboard)/leads/[id]/email-outcome-actions";

/** The rep's explicit confirmation that a generated draft was actually sent — this is the only thing that counts it and advances the lead's stage. */
export function MarkEmailSentButton({ leadId, emailId }: { leadId: string; emailId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await markEmailSentAction(leadId, emailId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--primary)" }}
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
        Mark as sent
      </button>
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

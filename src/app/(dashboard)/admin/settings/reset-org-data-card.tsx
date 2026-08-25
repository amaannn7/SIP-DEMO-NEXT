"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { resetOrgDataAction } from "./reset-data-actions";

const CONFIRM_PHRASE = "WIPE ALL DATA";

/**
 * Ports the source system's "UAT Reset" card exactly: super-admin-only,
 * a typed-phrase confirm (not a plain confirm() dialog, since that can't
 * collect free text) that only enables the destructive button once the
 * exact phrase is typed. The server action is the sole authority on the
 * phrase match — this client-side check is just what enables the button.
 */
export function ResetOrgDataCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();
  const matches = typed === CONFIRM_PHRASE;

  function submit() {
    startTransition(async () => {
      const result = await resetOrgDataAction(typed);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Data cleared");
      setOpen(false);
      setTyped("");
    });
  }

  return (
    <div className="card-surface rounded-xl border border-destructive/30 bg-card p-5 lg:col-span-2">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="size-4 text-destructive" />
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Reset test data</h3>
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">
        Wipe all leads, chat, and activity data back to empty for a fresh test cycle. User accounts and their My
        Context settings are kept, so testers can log straight back in. This cannot be undone. Only use this on a
        test environment, never once real customer data exists.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-9 rounded-lg border border-destructive/30 bg-destructive/5 px-4 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          Wipe all test data
        </button>
      ) : (
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-foreground">
            Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="h-9 w-full max-w-72 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/10"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!matches || isPending}
              onClick={submit}
              className="h-9 rounded-lg bg-destructive px-4 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Wiping…" : "Wipe everything"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              className="h-9 rounded-lg border border-border px-4 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

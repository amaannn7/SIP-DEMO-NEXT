"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignLeadAction } from "../actions";

export function ReassignLeadSelect({
  leadId,
  ownerId,
  users,
}: {
  leadId: string;
  ownerId: string | null;
  users: { id: string; displayName: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(null);
  const router = useRouter();

  const pendingOwner = pendingOwnerId ? users.find((u) => u.id === pendingOwnerId) : null;

  function confirmReassign() {
    if (!pendingOwnerId) return;
    startTransition(async () => {
      await reassignLeadAction(leadId, pendingOwnerId);
      router.refresh();
      setPendingOwnerId(null);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={ownerId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const newOwnerId = e.target.value;
          if (!newOwnerId || newOwnerId === ownerId) return;
          // Ports the source system's openReassignLead() customConfirm() step
          // — reassigning is a real ownership change, so it needs an explicit
          // confirm click rather than firing immediately on select, where a
          // misclick would silently move the lead.
          setPendingOwnerId(newOwnerId);
        }}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-[var(--primary)] disabled:opacity-60"
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.displayName}
          </option>
        ))}
      </select>
      {pendingOwner && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Reassign to {pendingOwner.displayName}?
          <button
            type="button"
            disabled={isPending}
            onClick={confirmReassign}
            className="rounded-md px-2 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--primary)" }}
          >
            {isPending ? "Saving…" : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setPendingOwnerId(null)}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}

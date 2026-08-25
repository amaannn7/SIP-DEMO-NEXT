"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "./user-avatar";
import type { ChatUser } from "./types";

export function NewDmPicker({
  orgUsers,
  onlineUserIds,
  onClose,
  onPick,
}: {
  orgUsers: ChatUser[];
  onlineUserIds: Set<string>;
  onClose: () => void;
  onPick: (userId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = orgUsers.filter((u) => u.displayName.toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-sm p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm">New direct message</DialogTitle>
        </DialogHeader>
        <div className="p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teammates…"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>
        <div className="max-h-72 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">No teammates found</p>}
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onPick(u.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted"
            >
              <UserAvatar name={u.displayName} avatarUrl={u.avatarUrl} size="sm" isOnline={onlineUserIds.has(u.id)} />
              {u.displayName}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

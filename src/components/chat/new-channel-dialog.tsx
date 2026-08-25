"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createChannelAction } from "@/app/(dashboard)/chat/actions";
import type { ChatUser } from "./types";

export function NewChannelDialog({ orgUsers, onClose }: { orgUsers: ChatUser[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("isPrivate", isPrivate ? "true" : "false");
    if (isPrivate) {
      for (const id of memberIds) formData.append("memberIds", id);
    }
    startTransition(async () => {
      const result = await createChannelAction({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">New channel</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="channel-name">
              Name
            </label>
            <input
              id="channel-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. deals"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="channel-desc">
              Description (optional)
            </label>
            <input
              id="channel-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="size-3.5 accent-[var(--primary)]" />
            Private: only invited teammates can see this channel
          </label>

          {isPrivate && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Members</p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {orgUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={memberIds.has(u.id)}
                      onChange={() => toggleMember(u.id)}
                      className="size-3.5 accent-[var(--primary)]"
                    />
                    {u.displayName}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !name.trim()}
            className="h-8 rounded-md px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "var(--primary)" }}
          >
            {isPending ? "Creating…" : "Create channel"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

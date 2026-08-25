"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Trash2, Users } from "lucide-react";
import { deleteChannelAction, updateChannelMembersAction } from "@/app/(dashboard)/chat/actions";
import type { ChannelSummary, ChatUser } from "./types";

export function ChannelSettingsMenu({ channel, orgUsers }: { channel: ChannelSummary; orgUsers: ChatUser[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set(channel.memberIds));
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveMembers() {
    const formData = new FormData();
    formData.set("conversationId", channel.id);
    for (const id of memberIds) formData.append("memberIds", id);
    startTransition(async () => {
      await updateChannelMembersAction({}, formData);
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      setShowMembers(false);
      setOpen(false);
    });
  }

  function remove() {
    if (!confirm(`Delete #${channel.name}? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteChannelAction(channel.id);
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      setOpen(false);
    });
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        aria-label="Channel settings"
      >
        <MoreVertical className="size-3.5" />
      </button>

      {open && !showMembers && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-6 right-0 z-40 w-44 rounded-md border border-border bg-card py-1 shadow-lg">
            {channel.isPrivate && (
              <button
                type="button"
                onClick={() => setShowMembers(true)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted"
              >
                <Users className="size-3.5" /> Manage members
              </button>
            )}
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-muted"
            >
              <Trash2 className="size-3.5" /> Delete channel
            </button>
          </div>
        </>
      )}

      {showMembers && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowMembers(false)} />
          <div className="absolute top-6 right-0 z-40 w-56 rounded-md border border-border bg-card p-2 shadow-lg">
            <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">Members of #{channel.name}</p>
            <div className="max-h-48 overflow-y-auto">
              {orgUsers.map((u) => (
                <label key={u.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs text-foreground hover:bg-muted">
                  <input type="checkbox" checked={memberIds.has(u.id)} onChange={() => toggle(u.id)} className="size-3.5 accent-[var(--primary)]" />
                  {u.displayName}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={saveMembers}
              disabled={isPending}
              className="mt-1.5 h-7 w-full rounded-md text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--primary)" }}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

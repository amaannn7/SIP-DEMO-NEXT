"use client";

import { useMemo } from "react";
import { Archive, LifeBuoy, MessageSquarePlus, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format-date";
import type { TicketDTO, TicketsSummaryDTO } from "./types";

const STATUS_DOT: Record<string, string> = {
  open: "bg-warning",
  in_progress: "bg-[var(--primary)]",
  resolved: "bg-success",
  closed: "bg-muted-foreground",
};

export function TicketList({
  tickets,
  summary,
  activeId,
  onSelect,
  onNewTicket,
  showClosed,
  onToggleClosed,
}: {
  tickets: TicketDTO[];
  summary: TicketsSummaryDTO;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewTicket: () => void;
  showClosed: boolean;
  onToggleClosed: () => void;
}) {
  // Working queue reads top-to-bottom by urgency: open first, then
  // in-progress, resolved last — same triage order a helpdesk inbox sorts
  // by, rather than a flat reverse-chronological feed where an old
  // untouched ticket can bury itself under fresh chatter on a resolved one.
  const grouped = useMemo(() => {
    const rank: Record<string, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 };
    return [...tickets].sort((a, b) => {
      const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (r !== 0) return r;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [tickets]);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground">Feedback &amp; Support</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {summary.open} open &middot; {summary.inProgress} in progress
          </p>
        </div>
        <button
          type="button"
          onClick={onNewTicket}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-[var(--primary)]"
          aria-label="New ticket"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted">
              <MessageSquarePlus className="size-4 text-muted-foreground" />
            </span>
            <p className="text-xs text-muted-foreground">{showClosed ? "No closed tickets" : "No tickets yet"}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {grouped.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} active={ticket.id === activeId} onClick={() => onSelect(ticket.id)} />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleClosed}
        className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Archive className="size-3.5" />
        {showClosed ? "Back to open tickets" : `Closed tickets (${summary.closed})`}
      </button>
    </aside>
  );
}

function TicketRow({ ticket, active, onClick }: { ticket: TicketDTO; active: boolean; onClick: () => void }) {
  const lastMessage = ticket.replies.at(-1);
  const preview = lastMessage ? `${lastMessage.author.displayName}: ${lastMessage.message}` : ticket.message;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={cn(
        "group relative flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)]" : "hover:bg-muted",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-[var(--primary)]" aria-hidden />}
      <span
        className={cn(
          "mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full",
          active ? "bg-[color-mix(in_oklch,var(--primary)_18%,transparent)] text-[var(--primary)]" : "bg-muted text-muted-foreground",
        )}
      >
        {ticket.type === "feedback" ? <Sparkles className="size-3.5" /> : <LifeBuoy className="size-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[13px] font-medium text-foreground">{ticket.subject}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">{formatTimeAgo(new Date(ticket.updatedAt))}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[ticket.status])} aria-hidden />
          <p className="truncate text-[11px] text-muted-foreground">{preview}</p>
        </div>
      </div>
    </div>
  );
}
